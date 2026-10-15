/* templates/trailer: the plan's craft rules, node only (CI runs it): run  node templates/trailer/trailer.test.mjs
   For every cut (full, 30, 15), both aspects and every score style: the plan is pure; the lengths sit in their windows; every section starts on the score's markers and
   every shot boundary on the half-beat grid; the montage accelerates (act 3 cuts faster than act 2, act 2 faster than act 1); act-3 bar downbeats are cuts; the silence
   before the hit is black, planned quiet and 1-3 s long; the title lands ON the hit frame; the release card holds; the honesty labels are on; any non-cut transition has
   a reason; 9:16 has no bars and every text box sits inside the frame; a footage path turns a placeholder plate into a media shot; the JS markers equal the plan's score. */
import { CONFIG, buildPlan, PROJECT_MAP } from './config.mjs';
import { scoreMarkers, SCORES } from '../_shared/film/plan-film.mjs';
import { lintClaims, lintTransitions } from '../_shared/plan.mjs';
import { PLATE_KINDS } from '../_shared/film/plates.js';
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok || !info ? '' : '  ' + info}`); };
const mk = (o = {}) => { const C = structuredClone(CONFIG); for (const [k, v] of Object.entries(o)) { const ks = k.split('.'); let x = C; for (const q of ks.slice(0, -1)) x = x[q]; x[ks.at(-1)] = v; } return buildPlan(C); };
const WIN = { full: [60, 150], 30: [26, 32], 15: [12, 20] };   // 15: about 15 s at 120 BPM; the 80-84 BPM scores keep their silence, ring and tail beats and run to about 19.6 s
for (const length of ['full', 30, 15]) for (const aspect of ['16:9', '9:16']) for (const genre of ['thriller', 'scifi', 'horror', 'drama']) {
  const P = mk({ length, aspect, genre }), tag = `${length} ${aspect} ${genre}`, F = P.score.markers, fps = P.fps, fpb = P.framesPerBeat, q = Math.round(fpb / 2), fr = (t) => Math.round(t * fps);
  check(`${tag}: pure (two builds, same JSON)`, JSON.stringify(P) === JSON.stringify(mk({ length, aspect, genre })));
  check(`${tag}: ${P.seconds} s inside the ${WIN[length].join('-')} s window`, P.seconds >= WIN[length][0] && P.seconds <= WIN[length][1]);
  const shots = P.shots, ends = shots.map((s) => fr(s.start + s.dur)), contiguous = shots.every((s, i) => i === 0 ? fr(s.start) === 0 : fr(s.start) === ends[i - 1]);
  check(`${tag}: shots tile the timeline end to end (${shots.length} shots)`, contiguous && ends.at(-1) === F.end);
  const onGrid = (f) => { const k = f * 2 / fpb; return Math.abs(f - Math.round(k) * fpb / 2) <= 0.5 + 1e-9; };
  check(`${tag}: every boundary on the half-beat grid of the score (${fpb} frames / beat)`, shots.every((s) => onGrid(fr(s.start))), shots.filter((s) => !onGrid(fr(s.start))).map((s) => s.id + '@' + fr(s.start)).slice(0, 4).join(' '));
  const sec = (name) => shots.filter((s) => s.sec === name), rate = (xs, a, b) => xs.length / Math.max(1e-9, (b - a) / fps);
  const inR = (a, b) => shots.filter((s) => fr(s.start) >= a && fr(s.start) < b), r1 = rate(inR(0, F.act2_start), 0, F.act2_start), r2 = rate(inR(F.act2_start, F.act3_start), F.act2_start, F.act3_start), r3 = rate(inR(F.act3_start, F.gap_start), F.act3_start, F.gap_start);
  check(`${tag}: the cut rate accelerates (${r1.toFixed(2)} -> ${r2.toFixed(2)} -> ${r3.toFixed(2)} shots / s)`, r3 > r2 * 1.05 && r2 >= r1 * 0.999);
  check(`${tag}: every act-3 bar downbeat is a cut (the braams land on cuts)`, Array.from({ length: (F.gap_start - F.act3_start) / (4 * fpb) }, (_, k) => F.act3_start + k * 4 * fpb).every((b) => shots.some((s) => fr(s.start) === b)));
  const sil = shots.find((s) => s.id === 'silence'), quiet = P.audio.quiet.find((x) => x.kind === 'gap');
  check(`${tag}: the silence before the hit is black, planned quiet and ${sil && sil.dur.toFixed(2)} s`, sil && sil.kind === 'black' && sil.dur >= 1 && sil.dur <= 3.1 && quiet && Math.abs(quiet.t[0] - sil.start) < 1e-6);
  const ti = shots.find((s) => s.id === 'title'), tg = P.gfx.find((g) => g.id.startsWith('title.trailer') && Math.abs(g.at - ti.start) < 1e-6);
  check(`${tag}: the title lands ON the hit frame (${F.hit}) and holds`, fr(ti.start) === F.hit && ti.hold && tg && tg.params.text === CONFIG.film.title);
  check(`${tag}: the release card holds to the end, the date card is on it`, shots.at(-1).id === 'release' && shots.at(-1).hold && P.gfx.some((g) => g.id === 'card.releaseDate'));
  check(`${tag}: labels on (film pill + slot labels), claims and transitions lint clean`, P.labels.film === CONFIG.text.label && P.labels.slots && !lintClaims(P.claims).length && !lintTransitions(shots).length);
  check(`${tag}: plates are real kinds, sounds are pack ids`, shots.filter((s) => s.kind === 'plate').every((s) => PLATE_KINDS.includes(s.plate)) && P.cues.every((c) => /^sfx\/[a-z0-9_]+\/[a-z0-9_]+$/.test(c.id)));
  check(`${tag}: ${aspect === '9:16' ? 'no bars on 9:16' : 'letterbox ' + P.letterbox + ' -> ' + P.bars + ' px bars, asked for in plan.eyes'}`, aspect === '9:16' ? P.bars === 0 && !P.eyes.letterbox : P.bars > 0 && P.eyes.letterbox);
  check(`${tag}: every text box lies inside the frame`, P.texts.every((t) => t.box[0] >= 0 && t.box[1] >= 0 && t.box[2] <= P.W && t.box[3] <= P.H && t.box[2] > t.box[0]));
  const M = scoreMarkers(P.score.style, fps, P.score.act_bars, P.score.button_beats, P.score.tail_beats);
  check(`${tag}: the plan's score markers are the score's (${P.score.style}, ${M.bpm} BPM)`, JSON.stringify(M.frames) === JSON.stringify(F) && SCORES[P.score.style]);
}
{ const P = mk({ 'media.coast.src': '/abs/your-coast.mp4' }), s = P.shots.filter((x) => x.label === 'coast at night');
  check('a footage path turns the coast plate into a media shot (in-point moves on each re-use)', s.length >= 2 && s.every((x) => x.kind === 'media' && x.src === '/abs/your-coast.mp4') && new Set(s.map((x) => x.mediaStart)).size === s.length); }
{ const P = mk({ 'text.quote': { quote: 'X', source: '' } }), q = P.gfx.find((g) => g.id === 'card.quote');
  check('a quote with a blank source still goes to card.quote (which renders the red "needs a source" card, never the quote alone)', q && q.params.source === ''); }
check('PROJECT_MAP covers the shared project fields', ['brand.name', 'brand.accent', 'text.title', 'media.hero', 'music', 'aspects'].every((k) => PROJECT_MAP[k]));
console.log(`\ntrailer: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
