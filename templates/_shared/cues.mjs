/* motion-pack/templates/_shared/cues.mjs: export a template's PLAN without a browser.
     node templates/_shared/cues.mjs <template-dir> [--set path.to.key=value ...] [--name plan]  -> <dir>/out/<name>.json
   <dir>/config.mjs exports CONFIG (the editable block) and buildPlan(C) -> { fps, seconds, shots, cues, claims, ... } (pure). */
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { lintClaims, lintTransitions, lintPace } from './plan.mjs';
const argv = process.argv.slice(2), dir = path.resolve(argv[0] || '.');
const { CONFIG, buildPlan } = await import(pathToFileURL(path.join(dir, 'config.mjs')).href);
const C = structuredClone(CONFIG);
for (let i = 1; i < argv.length; i++) if (argv[i] === '--set') { const [k, v] = argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const name = argv.includes('--name') ? argv[argv.indexOf('--name') + 1] : 'plan';
const plan = buildPlan(C);
plan.lint = { claimsWithoutSource: lintClaims(plan.claims).map((c) => c.text), unmotivatedTransitions: lintTransitions(plan.shots || []), pace: plan.shots && plan.shots.length ? lintPace(plan.shots, plan.paceRule || {}) : null };
fs.mkdirSync(path.join(dir, 'out'), { recursive: true }); const out = path.join(dir, 'out', name + '.json');
fs.writeFileSync(out, JSON.stringify(plan, null, 1));
const L = plan.lint; console.log(out, `${plan.cues.length} cues, ${(plan.shots || []).length} shots, ${plan.seconds}s`, L.claimsWithoutSource.length ? 'LINT proof FAIL: ' + L.claimsWithoutSource.join(' | ') : 'proof ok', L.unmotivatedTransitions.length ? 'LINT tx FAIL: ' + L.unmotivatedTransitions : 'tx ok', L.pace ? JSON.stringify(L.pace) : '');
