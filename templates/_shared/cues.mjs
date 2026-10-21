/* motion-pack/templates/_shared/cues.mjs: export a template's PLAN without a browser.
     node templates/_shared/cues.mjs <template-dir> [--project project.json] [--aspect 9:16] [--set path.to.key=value ...] [--name plan] [--allow-lint]  -> <dir>/out/<name>.json
   <dir>/config.mjs exports CONFIG (the editable block) and buildPlan(C) -> { fps, seconds, shots, cues, claims, ... } (pure).
   THE LINT IS A GATE: a claim with a digit and no `source` (lint.proof) or a non-cut transition with no reason (lint.tx) prints the problem, still writes the plan (plan.lint lists it) and exits 2,
   so every genre template's make.mjs (runPlan runs this first) and render3d.sh stop before anything is staged, mixed or rendered (the part demos run the same gate, compose.mjs lintPlan/lintStop). --allow-lint (or MP_ALLOW_LINT=1, for render3d.sh) lets the build go on and records the
   waived problems in plan.lint.allowed. lint.pace is reported only.
   A project with a "playbook" block (mp plan) has its format's sound shape applied to the plan before the gate (templates/_shared/playbook.mjs). */
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { lintPace } from './plan.mjs'; import { lintPlan, lintStop } from './compose.mjs'; import { loadConfig, parseArgs, stripComments } from './project.mjs'; import { applyPlaybook } from './playbook.mjs';
const argv = process.argv.slice(2), dir = path.resolve(argv[0] || '.');
const { buildPlan } = await import(pathToFileURL(path.join(dir, 'config.mjs')).href);
const C = await loadConfig(dir, argv.slice(1), { who: 'cues.mjs' });   // CONFIG + --project (PROJECT_MAP) + --aspect + --set (project.mjs: an unknown key, a missing file or an unsourced digit exits 2)
const name = argv.includes('--name') ? argv[argv.indexOf('--name') + 1] : 'plan';
const plan = buildPlan(C);
/* the format's sound shape: project.json "playbook" (written by `mp plan`) -> quiet open, bass entry, silence under the name, tail, end hold, first sound (_shared/playbook.mjs) */
{ const pa = parseArgs(argv.slice(1)); if (pa.project) { const pb = stripComments(JSON.parse(fs.readFileSync(pa.project, 'utf8'))).playbook; if (pb) { applyPlaybook(plan, pb); console.error(`cues.mjs: playbook ${pb.format || ''}: ${plan.playbook.applied.join('; ')}`); } } }
plan.lint = { pace: plan.shots && plan.shots.length ? lintPace(plan.shots, plan.paceRule || {}) : null };
const fails = lintPlan(plan);   // lint.proof + lint.tx (compose.mjs: the gate every make.mjs shares)
fs.mkdirSync(path.join(dir, 'out'), { recursive: true }); const out = path.join(dir, 'out', name + '.json');
fs.writeFileSync(out, JSON.stringify(plan, null, 1));
const L = plan.lint; console.log(out, `${plan.cues.length} cues, ${(plan.shots || []).length} shots, ${plan.seconds}s`, L.claimsWithoutSource.length ? 'LINT proof FAIL: ' + L.claimsWithoutSource.join(' | ') : 'proof ok', L.unmotivatedTransitions.length ? 'LINT tx FAIL: ' + L.unmotivatedTransitions : 'tx ok', L.pace ? JSON.stringify(L.pace) : '');
lintStop(fails, 'cues.mjs');
