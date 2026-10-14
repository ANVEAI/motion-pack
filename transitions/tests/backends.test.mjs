/* every transition id resolves to a back-end that exists (node, no browser). run: node transitions/tests/backends.test.mjs
   tools/lint.mjs checks the registry schema and that a listed gl / dom back-end exists. This adds what nothing in CI checked: every GL-only key has a DOM
   approximation (so a HyperFrames DOM template can play any id), every approximation is a GL-only key and points at a real DOM back-end with params that
   resolve, the 'curve' key is the speed-ramp function, the published catalog.json agrees with the code on back-ends, and every id a template or planner
   can write (key, kebab-case, alias, edit-grammar id, xfade-* name) resolves through lib/ids.js resolveTx to a kind its back-end can play.
   The DOM and GL back-ends themselves run in real Chrome only (transitions/tests/dom-sheet.mjs, renders); see docs/testing.md. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { REGISTRY } from '../lib/registry.js'; import { SHADERS } from '../lib/tx-shaders.js'; import { DOM_KEYS } from '../lib/tx-dom.js'; import { APPROX, APPROX_KEYS } from '../lib/tx-dom-x.js';
import { ALIASES, resolveTx } from '../lib/ids.js'; import { speedRamp, resolveParams } from '../lib/tx-core.js'; import { reporter } from '../../layers/tests/harness.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), R0 = reporter('transition back-ends'), R = { check: (l, ok, d = '') => R0.check(l, ok, ok ? '' : d), done: () => R0.done(), get failed() { return R0.failed; } };
const KEYS = Object.keys(REGISTRY), KNOWN = ['gl', 'dom', 'curve'], glOnly = KEYS.filter((k) => REGISTRY[k].backends.includes('gl') && !REGISTRY[k].backends.includes('dom'));

const unknown = KEYS.filter((k) => REGISTRY[k].backends.some((b) => !KNOWN.includes(b)));
const noGl = KEYS.filter((k) => REGISTRY[k].backends.includes('gl') && !(typeof SHADERS[k] === 'string' && /void\s+main|vec4\s+transition/.test(SHADERS[k])));
const noDom = KEYS.filter((k) => REGISTRY[k].backends.includes('dom') && !DOM_KEYS.includes(k));
R.check(`every one of the ${KEYS.length} ids lists only known back-ends (gl, dom, curve), every gl one has a shader and every dom one a DOM function`, !unknown.length && !noGl.length && !noDom.length, [unknown, noGl, noDom].map((x) => x.join(' ')).join(' | '));

const noApprox = glOnly.filter((k) => !APPROX_KEYS.includes(k)), stray = APPROX_KEYS.filter((k) => !glOnly.includes(k));
const badVia = APPROX_KEYS.filter((k) => { const a = APPROX[k]; if (a.fn) return typeof a.fn !== 'function'; if (!DOM_KEYS.includes(a.via) || APPROX_KEYS.includes(a.via) || typeof a.params !== 'function') return true;
  try { const P = resolveParams(REGISTRY[k], {}), q = resolveParams(REGISTRY[a.via], a.params(P)); return Object.values(q).some((v) => v === undefined || (typeof v === 'number' && !Number.isFinite(v))); } catch { return true; } });
R.check(`all ${glOnly.length} GL-only ids have a DOM approximation; every approximation is a GL-only id and is either its own function or a real DOM back-end with params that resolve to finite values`, glOnly.length > 0 && !noApprox.length && !stray.length && !badVia.length, [noApprox, stray, badVia].map((x) => x.join(' ')).join(' | '));

const curve = KEYS.filter((k) => REGISTRY[k].backends.includes('curve'));
let rampOk = false, rampInfo = ''; try { const f = speedRamp([{ t: 0, rate: 1 }, { t: 0.5, rate: 0.25 }, { t: 1, rate: 1 }]); rampInfo = Object.keys(f || {}).join(','); rampOk = !!f && typeof f.rateAt === 'function' && Math.abs(f.rateAt(0.5) - 0.25) < 1e-9; } catch (e) { rampInfo = e.message; }
R.check(`the curve id(s) (${curve.join(', ')}) are the speed-ramp retime function in lib/tx-core.js`, curve.length >= 1 && curve.every((k) => k === 'speedRamp') && rampOk, rampInfo);

const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8')).transitions, ck = new Map(cat.map((t) => [t.key, t]));
const catBad = KEYS.filter((k) => !ck.has(k) || JSON.stringify([...ck.get(k).backends].sort()) !== JSON.stringify([...REGISTRY[k].backends].sort())).concat(cat.filter((t) => !REGISTRY[t.key]).map((t) => t.key));
R.check(`catalog.json lists exactly the ${KEYS.length} registry ids with the same back-ends`, cat.length === KEYS.length && !catBad.length, catBad.join(' '));

const names = Object.keys(ALIASES), unresolved = [], wrongKind = [];
for (const n of names) { const r = resolveTx('transitions/' + n); if (!r) { unresolved.push(n); continue; }
  if (r.key == null) { if (!['cut', 'smash'].includes(r.kind)) wrongKind.push(n); continue; }
  if (!REGISTRY[r.key]) { unresolved.push(n); continue; }
  const want = DOM_KEYS.includes(r.key) || APPROX_KEYS.includes(r.key) ? 'dom' : 'gl'; if (r.kind !== want) wrongKind.push(`${n}:${r.kind}!=${want}`); }
R.check(`all ${names.length} transition names a template can write (keys, kebab-case, aliases, edit grammar, xfade-*) resolve to a registry id (or cut / smash) of a kind its back-end can play`, names.length > KEYS.length && !unresolved.length && !wrongKind.length, [unresolved, wrongKind].map((x) => x.slice(0, 6).join(' ')).join(' | '));
R.check('an unknown name resolves to null (templates hard-cut and tools/check_ids.py fails the build), never to a random id', resolveTx('transitions/noSuchTransition') === null && resolveTx('') === null);
process.exit(R.done() && R.failed ? 1 : 0);
