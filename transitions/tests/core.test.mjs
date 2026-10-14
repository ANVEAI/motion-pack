/* motion-pack / transitions / tests / core.test.mjs: pure-function tests (node tests/core.test.mjs). */
import assert from 'node:assert/strict';
import { EASES, ease, snapBpm, txWindow, progressAt, speedRamp, RAMP_PRESETS, matchPose, poseToCss, resolveParams } from '../lib/tx-core.js';
import { planEdits, stateAt, lintPlan } from '../lib/sequence.js';
import { REGISTRY } from '../lib/registry.js';
import { bayerIndex, ditherOrder, ditherState, springStep, shareProgress } from '../lib/tx-dom-x.js';
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

t('eases hit 0 and 1 and are deterministic', () => { for (const [k, f] of Object.entries(EASES)) { assert.ok(Math.abs(f(0)) < 1e-6, k); assert.ok(Math.abs(f(1) - 1) < 1e-6, k); assert.equal(f(0.37), f(0.37)); } });
t('cubic-bezier whip is symmetric-ish and monotonic', () => { let prev = -1; for (let i = 0; i <= 100; i++) { const v = ease('whip', i / 100); assert.ok(v >= prev - 1e-9); prev = v; } assert.ok(Math.abs(ease('whip', 0.5) - 0.5) < 0.02); });
t('snapBpm makes a whole number of frames per beat', () => { for (const b of [110, 128, 140, 97]) { const s = snapBpm(b, 30); assert.ok(Math.abs(30 * 60 / s - Math.round(30 * 60 / s)) < 1e-9); } assert.equal(snapBpm(120, 30), 120); });
t('txWindow puts the swap exactly on the cut frame', () => { for (const [k, e] of Object.entries(REGISTRY)) for (const bpm of [null, 100, 128]) {
  const w = txWindow(e, { fps: 30, bpm, cutFrame: 90 }); assert.ok(Number.isInteger(w.start) && Number.isInteger(w.end), k);
  assert.ok(Math.abs(progressAt(w, 90) - Math.round(e.timing.cut * w.frames) / w.frames) < 1e-9, k); assert.equal(w.end - w.start, w.frames); } });
t('speed ramps are monotonic and continuous', () => { for (const [k, keys] of Object.entries(RAMP_PRESETS)) { const r = speedRamp(keys, { anchor: 1 }); let prev = -Infinity;
  for (let i = 0; i <= 400; i++) { const v = r.map(i / 200); assert.ok(v >= prev - 1e-12, k); if (i) assert.ok(v - prev < 0.05, k); prev = v; } } });
t('speedRamp hit: slowest rate on the anchor', () => { const r = speedRamp(RAMP_PRESETS.hit, { anchor: 2 }); assert.ok(Math.abs(r.rateAt(2) - 0.3) < 1e-9); assert.equal(r.rateAt(0), 1); });
t('match anchors coincide across the cut', () => {
  const a = { x: 0.3, y: 0.6, scale: 0.3, rot: 0.2 }, b = { x: 0.7, y: 0.4, scale: 0.45, rot: -0.1 };
  const pa = matchPose(a, b, 0.5 - 1e-9), pb = matchPose(a, b, 0.5);
  assert.ok(Math.abs(pa.at.x - pb.at.x) < 1e-6 && Math.abs(pa.at.y - pb.at.y) < 1e-6);
  assert.ok(Math.abs(pa.k * a.scale - pb.k * b.scale) < 1e-6, 'on-screen sizes match');
  assert.ok(Math.abs((a.rot + pa.rot) - (b.rot + pb.rot)) < 1e-6, 'on-screen rotations match');
  const p0 = matchPose(a, b, 0), p1 = matchPose(a, b, 1); assert.ok(Math.abs(p0.k - 1) < 1e-9 && Math.abs(p1.k - 1) < 1e-9 && p0.at.x === a.x && Math.abs(p1.at.x - b.x) < 1e-12);
  assert.match(poseToCss(p0, 1920, 1080), /^matrix\(1,0,/); });
t('resolveParams rejects typos', () => { assert.throws(() => resolveParams(REGISTRY.whip, { blurmax: 1 })); assert.equal(resolveParams(REGISTRY.whip, {}).blurMax, 0.08); });
t('sequence: swap on the cut, overlap lint', () => {
  const plan = planEdits([{ cut_s: 1, key: 'whip' }, { cut_s: 2, key: 'flash' }], { bpm: 120 });
  assert.deepEqual(stateAt(0.2, plan), { shot: 0 }); assert.equal(stateAt(1, plan).p, REGISTRY.whip.timing.cut); assert.deepEqual(stateAt(3, plan), { shot: 2 });
  assert.equal(lintPlan(plan).length, 0); assert.equal(lintPlan(planEdits([{ cut_s: 1, key: 'ink' }, { cut_s: 1.2, key: 'ink' }])).length, 1); });
t('ditherDissolve: Bayer matrices, block order and states (A -> accent -> B, never back)', () => {
  assert.deepEqual([0, 1, 2, 3].map(y => [0, 1, 2, 3].map(x => bayerIndex(x, y, 2))), [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]);
  const m8 = new Set(); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) m8.add(bayerIndex(x, y, 3)); assert.equal(m8.size, 64);
  const P = { ...Object.fromEntries(Object.entries(REGISTRY.ditherDissolve.params).map(([k, s]) => [k, s.default])) }, g = { w: 1920, h: 1080, cs: 24 }, count = (e) => { const c = [0, 0, 0]; for (let y = 0; y < 45; y++) for (let x = 0; x < 80; x++) c[ditherState(ditherOrder(x, y, P, g), e, P.band)]++; return c; };
  assert.deepEqual(count(0), [3600, 0, 0]); assert.deepEqual(count(1), [0, 0, 3600]); const mid = count(REGISTRY.ditherDissolve.timing.cut); assert.ok(mid[1] > 1800, 'most blocks are accent on the cut');
  for (let y = 0; y < 45; y += 7) for (let x = 0; x < 80; x += 9) { const v = ditherOrder(x, y, P, g); assert.ok(v > 0 && v < 1); let prev = 0; for (let i = 0; i <= 60; i++) { const s = ditherState(v, i / 60, P.band); assert.ok(s >= prev); prev = s; } }
  assert.equal(ditherOrder(5, 7, P, g), ditherOrder(5, 7, P, g)); });
t('sharedElement: the spring step is exactly 0 / 1 at the window ends for every bounce, bounce overshoots and 0 never does; staggered keys all land by p = 1', () => {
  for (const b of [0, 0.3, 0.6, 1]) { assert.equal(springStep(0, b), 0); assert.equal(springStep(1, b), 1); assert.equal(springStep(-0.2, b), 0); assert.equal(springStep(1.3, b), 1); }
  let mx0 = 0, mx6 = 0; for (let i = 0; i <= 400; i++) { mx0 = Math.max(mx0, springStep(i / 400, 0)); mx6 = Math.max(mx6, springStep(i / 400, 0.6)); } assert.ok(mx0 <= 1 + 1e-12, 'critically damped never overshoots'); assert.ok(mx6 > 1.05, 'bounce 0.6 overshoots');
  const P = { stagger: 0.15, bounce: 0.3 }; for (let i = 0; i < 5; i++) { assert.equal(shareProgress(0, i, 5, P), 0); assert.equal(shareProgress(1, i, 5, P), 1); } assert.ok(shareProgress(0.3, 0, 5, P) > shareProgress(0.3, 4, 5, P), 'first key leads'); });
t('sketchToRender: registry contract (swap after A has gone to paper, lines draw within the first half)', () => { const e = REGISTRY.sketchToRender; assert.ok(e.timing.cut <= 0.35 && e.params.draw.default + 0.06 < 0.55); assert.deepEqual(e.backends, ['gl', 'dom']); });
console.log(`${n} tests passed`);
