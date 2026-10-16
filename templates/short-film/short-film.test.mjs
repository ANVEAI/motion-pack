/* templates/short-film: node only (CI runs it): run  node templates/short-film/short-film.test.mjs
   The plan is pure at both aspects; scenes tile the timeline; every scene's sound starts j s before its picture (J cut) and the previous one lingers l s where there is no J
   (L cut); chapter titles sit on black before their scene; slugs type on at the scene start; subtitle times are scene-relative; a whisper words.json groups into lines of
   at most 42 characters; the lines JSON file and the inline lines give the same plan; the credits roll follows a dip to black and holds; the score enters at `scoreIn`;
   a footage path (your shot, or the three.js stage render) replaces the placeholder plate; a voice file switches the mode to vo with a duck. */
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { CONFIG, buildPlan, linesOf, PROJECT_MAP } from './config.mjs';
import { jlCut } from '../_shared/film/plan-film.mjs';
import { lintTransitions } from '../_shared/plan.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok || !info ? '' : '  ' + info}`); };
const mk = (o = {}) => { const C = structuredClone(CONFIG); for (const [k, v] of Object.entries(o)) { const ks = k.split('.'); let x = C; for (const q of ks.slice(0, -1)) x = x[q]; x[ks.at(-1)] = v; } return buildPlan(C); };
for (const aspect of ['16:9', '9:16']) {
  const P = mk({ aspect }), sh = P.shots, fr = (t) => Math.round(t * P.fps);
  check(`${aspect}: pure plan, ${P.seconds} s, ${sh.length} shots tile the timeline`, JSON.stringify(P) === JSON.stringify(mk({ aspect })) && sh.every((s, i) => i === 0 ? s.start === 0 : fr(s.start) === fr(sh[i - 1].start + sh[i - 1].dur)));
  check(`${aspect}: transitions lint clean (dissolves and dips carry reasons)`, !lintTransitions(sh).length);
  const ch = sh.find((s) => s.sec === 'chapter'), s2 = P.scenes.find((x) => x.id === 's2');
  check(`${aspect}: the chapter title sits on black right before its scene`, ch && ch.kind === 'black' && Math.abs(ch.start + ch.dur - s2.start) < 1e-6 && P.gfx.some((g) => g.id === 'title.filmChapter' && g.at >= ch.start && g.at < s2.start));
  const amb = P.cues.filter((c) => /amb\//.test(c.id));
  check(`${aspect}: J cut: each scene's sound leads its picture by ${CONFIG.jl.j} s`, P.scenes.slice(1).every((x) => amb.some((c) => Math.abs(c.t - (x.start - CONFIG.jl.j)) < 1e-6)));
  check(`${aspect}: subtitles are scene-relative (line 4 = scene s2 + 7.2 s)`, P.gfx.some((g) => g.id === 'caption.filmSubtitle' && Math.abs(g.at - (s2.start + 7.2)) < 1e-6));
  check(`${aspect}: slugs type on ${CONFIG.slugDelay} s into each scene`, P.scenes.every((x) => P.gfx.some((g) => g.id === 'card.scene' && Math.abs(g.at - (x.start + CONFIG.slugDelay)) < 1e-4)));
  const cr = sh.at(-1);
  check(`${aspect}: credits roll after a dip to black, held`, cr.id === 'credits' && cr.txKind === 'dip' && cr.hold && P.gfx.some((g) => g.id === 'credits.roll' && g.at > cr.start));
  check(`${aspect}: the score enters on scene ${CONFIG.scoreIn} (bed automation rises there)`, P.bedAutomation.some((b) => b.gain_db === CONFIG.bedDb.in && b.frame > fr(s2.start)) && P.bedAutomation[0].gain_db === CONFIG.bedDb.open);
  check(`${aspect}: text boxes inside the frame, labels on`, P.labels.film && P.texts.every((t) => t.box[0] >= 0 && t.box[2] <= P.W && t.box[1] >= 0 && t.box[3] <= P.H));
}
{ const r = jlCut([{ id: 'a', start: 0, dur: 5, sound: 'x' }, { id: 'b', start: 5, dur: 5, sound: 'y', j: 0 }, { id: 'c', start: 10, dur: 5, sound: 'z' }], { j: 0.5, l: 0.4 });
  check('jlCut: J leads the next picture, L lingers where there is no J', r[0].until === 5.4 && r[1].from === 5 && r[1].until === 10 && r[2].from === 9.5, JSON.stringify(r)); }
{ const L = linesOf([{ w: 'Relay', s: 0, e: 0.3 }, { w: 'North.', s: 0.35, e: 0.7 }, { w: 'Do', s: 0.8, e: 0.9 }, { w: 'you', s: 0.95, e: 1.1 }, { w: 'copy?', s: 1.15, e: 1.5 }, { w: 'Later', s: 3.0, e: 3.4 }]);
  check('linesOf groups whisper words into lines at sentence ends and pauses', L.length === 3 && L[0].text === 'Relay North.' && L[1].text === 'Do you copy?' && L[2].s === 3.0, JSON.stringify(L)); }
check('the lines JSON file gives the same plan as the inline lines', JSON.stringify(mk({ lines: path.join(HERE, 'lines.example.json') }).gfx) === JSON.stringify(mk().gfx));
{ const P = mk({ 'media.stage.src': '/abs/film-scene-wide.mp4' }), s = P.shots.find((x) => x.src === '/abs/film-scene-wide.mp4');
  check('the three.js stage slot takes the film-scene render (a media shot)', s && s.kind === 'media'); }
{ const P = mk({ 'voice.src': '/abs/dialogue.wav' }); check('a voice file switches the plan to vo mode with a 12 dB duck', P.vo === '/abs/dialogue.wav' && P.duckDb === 12 && P.audio.mode === 'vo'); }
check('PROJECT_MAP covers the shared project fields', ['brand.name', 'text.title', 'voice.words', 'media.hero', 'music', 'aspects'].every((k) => PROJECT_MAP[k]));
console.log(`\nshort-film: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
