/* templates/title-sequence: node only (CI runs it): run  node templates/title-sequence/title-sequence.test.mjs
   For every genre preset and both aspects: pure plan, 30-60 s, names land on the bed's beats and never overlap (one name at a time), positions stay in the frame,
   textures change only on dissolves with a reason, the title follows the names and "directed by" closes, the labels are on, the bed is a real library id. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { CONFIG, buildPlan, PROJECT_MAP } from './config.mjs';
import { lintTransitions } from '../_shared/plan.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), MUSIC = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'music/manifest.json'), 'utf8')).items.map((i) => i.id));
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok || !info ? '' : '  ' + info}`); };
const mk = (o) => buildPlan({ ...structuredClone(CONFIG), ...o });
for (const genre of Object.keys(CONFIG.beds)) for (const aspect of ['16:9', '9:16']) for (const length of [30, 40, 60]) {
  const P = mk({ genre, aspect, length }), tag = `${genre} ${aspect} ${length} s`, fpb = P.framesPerBeat, fr = (t) => Math.round(t * P.fps);
  check(`${tag}: pure, ${P.seconds} s in 30-60 s, bed ${P.music} exists`, JSON.stringify(P) === JSON.stringify(mk({ genre, aspect, length })) && P.seconds >= 29.5 && P.seconds <= 60.5 && MUSIC.has('music.' + P.music.slice(6)));
  const names = P.gfx.filter((g) => g.id === 'title.namesOver' && g.params.size >= 60), main = names.slice(0, -1);
  check(`${tag}: ${names.length} names, each on a beat, one at a time`, names.length >= 4 && names.every((g) => fr(g.at) % fpb === 0 || fr(g.at) % fpb === 0) && main.every((g, i) => i === 0 || g.at >= main[i - 1].at + main[i - 1].dur - 1e-6));
  const ti = P.gfx.find((g) => g.id.startsWith('title.trailer')), last = names.at(-1);
  check(`${tag}: the title follows the names, "directed by" closes`, ti && main.every((g) => g.at < ti.at) && last.at >= ti.at + ti.dur - 1e-6 && last.params.role === CONFIG.text.directedBy[0]);
  check(`${tag}: textures tile the timeline, change on dissolves with reasons`, P.shots.every((s, i) => i === 0 || (Math.abs(s.start - P.shots[i - 1].start - P.shots[i - 1].dur) < 1e-6 && s.txKind === 'dissolve')) && !lintTransitions(P.shots).length);
  check(`${tag}: labels on, text boxes inside the frame`, P.labels.film && P.texts.every((t) => t.box[0] >= 0 && t.box[2] <= P.W && t.box[1] >= 0 && t.box[3] <= P.H));
}
check('PROJECT_MAP covers the shared project fields', ['brand.accent', 'text.title', 'media.hero', 'music', 'aspects'].every((k) => PROJECT_MAP[k]));
console.log(`\ntitle-sequence: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
