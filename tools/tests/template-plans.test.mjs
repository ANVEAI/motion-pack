/* every genre template's plan builds without a browser, a GPU or a render, and the committed out/plan.json is current (node only). run: node tools/tests/template-plans.test.mjs
   For each templates/<name>/config.mjs: buildPlan(CONFIG) runs (it is pure: twice the same JSON), passes the same lints as templates/_shared/cues.mjs (every claim has a source,
   every transition a reason, pace within the template's rule), every cue and transition id resolves to a real sound / transition, and the plan equals the committed
   out/plan.json (a stale plan fails with the command that regenerates it). Templates without a config.mjs (the demo-* pages built by make.mjs) build their plan inside
   make.mjs together with the mix and the staged media, so they are not covered here (docs/testing.md). */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { reporter } from '../../layers/tests/harness.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), R = reporter('template plans');
const { lintClaims, lintTransitions, lintPace } = await import(pathToFileURL(path.join(ROOT, 'templates/_shared/plan.mjs')).href);
const { REGISTRY } = await import(pathToFileURL(path.join(ROOT, 'transitions/lib/registry.js')).href), { resolveTx } = await import(pathToFileURL(path.join(ROOT, 'transitions/lib/ids.js')).href);
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), MUSIC = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'music/manifest.json'), 'utf8')).items.map((i) => i.id));
const soundOk = (id) => (/^sfx\//.test(id) ? SFX.has('snd.' + id.split('/').slice(1).join('.')) : /^music\//.test(id) ? MUSIC.has('music.' + id.slice(6)) : false);
const txOk = (id) => { const r = resolveTx(id); return !!r && (r.key ? !!REGISTRY[r.key] : ['cut', 'smash'].includes(r.kind)); };   /* the same resolver templates use (lib/ids.js) */
/* the plan exactly as cues.mjs writes it (cues.mjs adds the lint block) */
const built = (buildPlan, CONFIG) => { const plan = buildPlan(structuredClone(CONFIG)); plan.lint = { claimsWithoutSource: lintClaims(plan.claims).map((c) => c.text), unmotivatedTransitions: lintTransitions(plan.shots || []), pace: plan.shots && plan.shots.length ? lintPace(plan.shots, plan.paceRule || {}) : null }; return plan; };
const dirs = fs.readdirSync(path.join(ROOT, 'templates')).filter((d) => fs.existsSync(path.join(ROOT, 'templates', d, 'config.mjs'))).sort();
for (const d of dirs) {
  const dir = path.join(ROOT, 'templates', d); let plan, again, err = '';
  try { const { CONFIG, buildPlan } = await import(pathToFileURL(path.join(dir, 'config.mjs')).href); plan = built(buildPlan, CONFIG); again = built(buildPlan, CONFIG); } catch (e) { err = e.message; }
  if (!plan) { R.check(`${d}: buildPlan(CONFIG) runs`, false, err); continue; }
  const L = plan.lint, cues = plan.cues || [], badCue = cues.filter((c) => !soundOk(c.id)).map((c) => c.id), shots = plan.shots || [];
  const badTx = shots.map((s) => s.tx && (s.tx.id || s.tx.key || s.tx)).filter((t) => t && typeof t === 'string' && !txOk(t));
  const file = path.join(dir, 'out', 'plan.json'), committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null, fresh = JSON.stringify(plan, null, 1);
  R.check(`${d}: plan builds without a browser (${shots.length} shots, ${cues.length} cues, ${plan.seconds} s), is pure, passes the claim / transition / pace lints, every cue resolves`,
    JSON.stringify(plan) === JSON.stringify(again) && !L.claimsWithoutSource.length && !L.unmotivatedTransitions.length && (!L.pace || L.pace.pass) && cues.length > 0 && plan.seconds > 0 && !badCue.length && !badTx.length,
    [L.claimsWithoutSource.length ? 'claims without source: ' + L.claimsWithoutSource.slice(0, 2).join(' | ') : '', L.unmotivatedTransitions.length ? 'unmotivated: ' + JSON.stringify(L.unmotivatedTransitions).slice(0, 120) : '', L.pace && !L.pace.pass ? 'pace ' + JSON.stringify(L.pace) : '', badCue.length ? 'unknown sounds ' + badCue.join(' ') : '', badTx.length ? 'unknown transitions ' + badTx.join(' ') : ''].filter(Boolean).join('; '));
  R.check(`${d}: the committed out/plan.json is the plan the config builds`, committed === fresh, committed == null ? 'no committed plan' : committed === fresh ? '' : `stale: run \`node templates/_shared/cues.mjs templates/${d}\` and commit out/plan.json`);
}
R.check(`all ${dirs.length} templates with a config.mjs were checked`, dirs.length >= 10);
process.exit(R.done() && R.failed ? 1 : 0);
