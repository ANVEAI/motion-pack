/* motion-pack/templates/_shared/cues.mjs: export a template's PLAN without a browser.
     node templates/_shared/cues.mjs <template-dir> [--set path.to.key=value ...] [--name plan] [--allow-lint]  -> <dir>/out/<name>.json
   <dir>/config.mjs exports CONFIG (the editable block) and buildPlan(C) -> { fps, seconds, shots, cues, claims, ... } (pure).
   THE LINT IS A GATE: a claim with a digit and no `source` (lint.proof) or a non-cut transition with no reason (lint.tx) prints the problem, still writes the plan (plan.lint lists it) and exits 2,
   so every make.mjs (they all run this first) and render3d.sh stop before anything is staged, mixed or rendered. --allow-lint (or MP_ALLOW_LINT=1, for render3d.sh) lets the build go on and records the
   waived problems in plan.lint.allowed. lint.pace is reported only. */
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { lintClaims, lintTransitions, lintPace, lintFailures } from './plan.mjs';
const argv = process.argv.slice(2), dir = path.resolve(argv[0] || '.'), allowLint = argv.includes('--allow-lint') || process.env.MP_ALLOW_LINT === '1';
const { CONFIG, buildPlan } = await import(pathToFileURL(path.join(dir, 'config.mjs')).href);
const C = structuredClone(CONFIG);
for (let i = 1; i < argv.length; i++) if (argv[i] === '--set') { const [k, v] = argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const name = argv.includes('--name') ? argv[argv.indexOf('--name') + 1] : 'plan';
const plan = buildPlan(C);
plan.lint = { claimsWithoutSource: lintClaims(plan.claims).map((c) => c.text), unmotivatedTransitions: lintTransitions(plan.shots || []), pace: plan.shots && plan.shots.length ? lintPace(plan.shots, plan.paceRule || {}) : null };
const fails = lintFailures(plan.lint); if (fails.length && allowLint) plan.lint.allowed = fails;   // a waived problem stays on the record (ears, the critic and a reviewer can see it)
fs.mkdirSync(path.join(dir, 'out'), { recursive: true }); const out = path.join(dir, 'out', name + '.json');
fs.writeFileSync(out, JSON.stringify(plan, null, 1));
const L = plan.lint; console.log(out, `${plan.cues.length} cues, ${(plan.shots || []).length} shots, ${plan.seconds}s`, L.claimsWithoutSource.length ? 'LINT proof FAIL: ' + L.claimsWithoutSource.join(' | ') : 'proof ok', L.unmotivatedTransitions.length ? 'LINT tx FAIL: ' + L.unmotivatedTransitions : 'tx ok', L.pace ? JSON.stringify(L.pace) : '');
if (fails.length) {
  console.error(`\ncues.mjs: ${fails.length} lint problem${fails.length === 1 ? '' : 's'}${allowLint ? ' (waived by --allow-lint, recorded in plan.lint.allowed)' : ', build stopped (exit 2)'}\n  - ${fails.join('\n  - ')}`);
  if (!allowLint) { console.error('\nFix the CONFIG block, or pass --allow-lint to build anyway (MP_ALLOW_LINT=1 for render3d.sh). Never waive a stat that has no source.'); process.exit(2); }
}
