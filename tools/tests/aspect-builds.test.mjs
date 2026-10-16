/* node tools/tests/aspect-builds.test.mjs: the aspect being built reaches every genre template, through the project path `mp render` uses (--project + --aspect)
   and through --aspect alone, and the shared builders that parse their own --set (hardware, SaaS, human, film) see it too. Node only, no browser, no render.
   16 Oct: mp render wrote 1920x1080 files named -9x16 (hardware-teaser, trailer, saas-feature-drop, founder-story) and a 1080x1920 file named -16x9 (vlog-personal):
   templates whose PROJECT_MAP maps the project's `aspects` list never saw the aspect, and those builders read only `--set aspect=`. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), TPL = path.join(ROOT, 'templates');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const P = await imp('templates/_shared/project.mjs'), { aspectFlag } = await imp('templates/_shared/compose.mjs');
let pass = 0, fail = 0; const ok = (name, c, why = '') => { if (c) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, why); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aspect-builds-')), proj = path.join(tmp, 'project.json');
fs.writeFileSync(proj, JSON.stringify({ version: 1, aspects: ['16:9', '9:16'], brand: {} }));
const dims = (p) => (p.W && p.H ? [p.W, p.H] : Array.isArray(p.size) ? p.size : null);
const ids = fs.readdirSync(TPL).filter((d) => !d.startsWith('_') && !d.startsWith('demo-') && fs.existsSync(path.join(TPL, d, 'config.mjs'))).sort();
let checked = 0;
for (const id of ids) {
  const dir = path.join(TPL, id), mod = await import(pathToFileURL(path.join(dir, 'config.mjs')).href), A = mod.ASPECTS || { '16:9': { how: 'native' }, '9:16': { how: 'native' } };
  for (const [a, v] of Object.entries(A)) { if (v.how === 'manual') continue;
    for (const via of ['project', 'aspect']) {
      const r = await P.resolve(dir, { project: via === 'project' ? proj : null, aspect: a, sets: [] }), d = dims(mod.buildPlan(r.C));
      if (!d) continue;   // a three.js template (the aspect is a render argument of render3d.sh) or a plan that keeps its size elsewhere
      checked++; ok(`${id} ${a} via ${via === 'project' ? '--project + --aspect (mp)' : '--aspect'}: the plan is ${d.join('x')}`, d.join('x') === P.ASPECT_SIZES[a].join('x'), 'wanted ' + P.ASPECT_SIZES[a].join('x')); } } }
ok(`at least 40 template x aspect x path builds checked (${checked})`, checked >= 40);
/* the builders that parse their own --set: aspectFlag turns --aspect into --set aspect= (in place), and each builder's own parse then sees 9:16 */
const av = aspectFlag(['--project', 'p.json', '--aspect', '9:16', '--set', 'length=10']);
ok('aspectFlag: --aspect 9:16 -> --set aspect=9:16, other flags kept', JSON.stringify(av) === JSON.stringify(['--project', 'p.json', '--set', 'aspect=9:16', '--set', 'length=10']), JSON.stringify(av));
ok('aspectFlag: an explicit --set aspect= wins and --aspect is dropped', JSON.stringify(aspectFlag(['--aspect', '16:9', '--set', 'aspect=9:16'])) === JSON.stringify(['--set', 'aspect=9:16']));
const { planArgs } = await imp('templates/_hw/makehw.mjs');
ok('hardware builder: --aspect 9:16 names the plan plan-tall', planArgs(aspectFlag(['--aspect', '9:16'])).includes('plan-tall'));
const { parseSets } = await imp('templates/_shared/saas/make.mjs'), SF = await import(pathToFileURL(path.join(TPL, 'saas-feature-drop', 'config.mjs')).href);
ok('SaaS builder: --aspect 9:16 builds the 9:16 CONFIG', parseSets(aspectFlag(['--aspect', '9:16']), structuredClone(SF.CONFIG)).aspect === '9:16');
const { aspectArgs } = await imp('templates/_shared/human/build.mjs'), FS = await import(pathToFileURL(path.join(TPL, 'founder-story', 'config.mjs')).href), VL = await import(pathToFileURL(path.join(TPL, 'vlog-personal', 'config.mjs')).href);
ok('human builder: founder-story --aspect 9:16 writes its 9:16 plan in its own folder', (() => { const r = aspectArgs(FS.CONFIG, aspectFlag(['--aspect', '9:16']), '16:9'); return r.C.aspect === '9:16' && r.planName !== 'plan'; })());
ok('human builder: vlog-personal (9:16 native) --aspect 16:9 writes its 16:9 plan in wide/', (() => { const r = aspectArgs(VL.CONFIG, aspectFlag(['--aspect', '16:9']), '9:16'); return r.C.aspect === '16:9' && r.planName !== 'plan'; })());
const { filmJob } = await imp('templates/_shared/film/make-film.mjs');
const fj = await filmJob(path.join(TPL, 'trailer'), 'trailer', aspectFlag(['--aspect', '9:16']));
ok('film builder: trailer --aspect 9:16 builds the 9x16 project', fj.C.aspect === '9:16' && /9x16/.test(fj.tag), fj.tag);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\naspect builds: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
