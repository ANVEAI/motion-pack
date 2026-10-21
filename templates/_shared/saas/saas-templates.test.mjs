/* the three SaaS templates (saas-launch, saas-feature-drop, saas-explainer; lane xp-saas, 2026-10-16). Node only, no browser, no render (CI runs this):
     node templates/_shared/saas/saas-templates.test.mjs
   For each template, at 16:9 and 9:16 and every length it offers: buildPlan runs and is pure (same JSON twice); the film is as long as asked (+-1 s; a VO sets its own length); scene starts sit on
   whole frames and, with no VO, on the bed's beat grid; every claim with a digit has a source (lint.proof) and every non-cut transition a reason (lint.tx); every cue resolves to a library sound;
   every headline / caption / kicker box sits inside the platform's safe rect (type/safezones.js: wideTitle at 16:9, conservative at 9:16); the 9:16 plan is a RE-LAYOUT (its boxes are not the 16:9
   ones scaled); a digit in CONFIG.text fails the build; PROJECT_MAP points at real CONFIG fields; a media slot with a screenshot replaces the placeholder screen (and drops its label), a recording
   becomes a plan.videos layer; the explainer's VO mode puts every scene change in a breath between two lines (never inside a word) and refuses a transcript whose word count does not match. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { lintClaims, lintTransitions } from '../plan.mjs';
import { safeRect } from '../../../type/safezones.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? '  | ' + info : ''}`); };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), sndOk = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const T = { 'saas-launch': [35, 45, 60, 75], 'saas-feature-drop': [15, 20, 30], 'saas-explainer': [60, 70, 90] };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
for (const [name, lengths] of Object.entries(T)) {
  const { CONFIG, buildPlan, PROJECT_MAP } = await import(pathToFileURL(path.join(ROOT, 'templates', name, 'config.mjs')).href), B = (o = {}) => buildPlan({ ...structuredClone(CONFIG), ...o });
  for (const aspect of ['16:9', '9:16']) for (const length of lengths) {
    const tag = `${name} ${aspect} ${length}s`; let p, p2; try { p = B({ aspect, length }); p2 = B({ aspect, length }); } catch (e) { check(`${tag}: builds`, false, e.message); continue; }
    check(`${tag}: builds and is pure`, JSON.stringify(p) === JSON.stringify(p2));
    check(`${tag}: as long as asked (+-1 s)`, Math.abs(p.seconds - length) <= 1, String(p.seconds));
    const beat = 60 / CONFIG.bpm; check(`${tag}: scene starts on whole frames and on the beat grid`, p.scenes.every((s) => Math.abs(s.start * p.fps - Math.round(s.start * p.fps)) < 1e-3 && Math.abs(s.start / beat - Math.round(s.start / beat)) < 1e-3));
    check(`${tag}: lint.proof and lint.tx pass`, !lintClaims(p.claims).length && !lintTransitions(p.shots).length);
    check(`${tag}: every cue resolves to a library sound`, p.cues.length > 10 && p.cues.every((c) => sndOk(c.id)), p.cues.filter((c) => !sndOk(c.id)).map((c) => c.id).join(' '));
    const R = safeRect(aspect === '16:9' ? 'wideTitle' : 'conservative', p.W, p.H), out = p.texts.filter((t) => t.box && (t.box[0] < R.x0 - 0.5 || t.box[1] < R.y0 - 0.5 || t.box[2] > R.x1 + 0.5 || t.box[3] > R.y1 + 0.5));
    check(`${tag}: every text box inside the safe rect`, !out.length, out.slice(0, 3).map((t) => `${t.id} ${t.box}`).join(' | '));
    check(`${tag}: headlines at least 48 px (16:9) / 56 px (9:16)`, p.texts.filter((t) => t.role === 'headline').every((t) => t.fontPx >= (aspect === '16:9' ? 48 : 56)));
  }
  const w = B({ aspect: '16:9' }), t = B({ aspect: '9:16' }), boxes = (p) => p.scenes.flatMap((s) => s.items.filter((i) => i.params?.box).map((i) => i.params.box.join(',')));
  check(`${name}: 9:16 is a re-layout (its window boxes are not the 16:9 ones)`, boxes(t).some((b, i) => b !== boxes(w)[i]) && t.W === 1080 && t.H === 1920);
  let threw = ''; try { B({ text: { ...CONFIG.text, [Object.keys(CONFIG.text).find((k) => typeof CONFIG.text[k] === 'string')]: 'Saves 40% of your week' } }); } catch (e) { threw = e.message; }
  check(`${name}: a digit in CONFIG.text fails the build`, /digit/.test(threw), threw);
  const missing = Object.values(PROJECT_MAP).flatMap((v) => (typeof v === 'string' || Array.isArray(v) ? [].concat(v) : [].concat(v.to))).filter((v) => get(CONFIG, v) === undefined && !/logo|words|audio/.test(v));
  check(`${name}: PROJECT_MAP points at real CONFIG fields`, !missing.length, missing.join(' '));
  { const e = PROJECT_MAP['brand.name'], ctx = { defaults: CONFIG }, to = typeof e === 'string' ? [e] : e.to, vals = typeof e === 'string' ? ['Orbit'] : e.fn('Orbit', ctx);
    check(`${name}: brand.name renames the demo brand everywhere the copy names it`, to.every((p, i) => !String(vals[i]).includes(CONFIG.brand.name)), JSON.stringify(vals)); }
  const slot = Object.keys(CONFIG.media || {})[0];
  if (slot) { const img = B({ media: { ...CONFIG.media, [slot]: { src: '/abs/shot.png', label: '' } } }), vid = B({ media: { ...CONFIG.media, [slot]: { src: '/abs/rec.mp4', start: 2, label: '' } } }), its = (p) => p.scenes.flatMap((s) => s.items);
    check(`${name}: a screenshot in media.${slot} replaces the placeholder screen and its label`, its(img).some((i) => i.params?.screen?.src === 'assets/media/shot.png' && i.params.label === '' && !i.screen));
    check(`${name}: a recording in media.${slot} becomes a plan.videos layer`, vid.videos.length > 0 && vid.videos.every((v) => v.src === 'assets/media/rec.mp4' && v.start === 2)); }
}
/* the explainer's VO mode */
{ const { CONFIG, buildPlan } = await import(pathToFileURL(path.join(ROOT, 'templates/saas-explainer/config.mjs')).href), words = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/saas-explainer/words.example.json'), 'utf8')).words;
  const p = buildPlan({ ...structuredClone(CONFIG), voice: { words: 'words.example.json', audio: null } }), inWord = (t) => words.some((w) => t > w.s + 1e-6 && t < w.e - 1e-6);
  check('explainer VO: every scene change sits in a breath (never inside a word)', p.scenes.slice(1).every((s) => !inWord(s.start)));
  check('explainer VO: mode vo, the bed ducks under plan.vo, captions carry the word timings', p.audio.mode === 'vo' && p.vo === 'vo.wav' && p.duckDb > 0 && p.scenes[0].caption.chunks[0].words?.length > 0);
  const bad = path.join(here, '.words-bad.tmp.json'); fs.writeFileSync(bad, JSON.stringify(words.slice(0, -3))); let threw = ''; try { buildPlan({ ...structuredClone(CONFIG), voice: { words: bad, audio: null } }); } catch (e) { threw = e.message; } fs.rmSync(bad, { force: true });
  check('explainer VO: a transcript whose word count does not match the narration is refused', /words/.test(threw), threw); }
console.log(`\nsaas templates: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
