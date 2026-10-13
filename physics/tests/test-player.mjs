#!/usr/bin/env node
/* test-player.mjs: unit checks of table-player.js against examples/scatter-drop.table.json (Node, no browser).
   usage: node tests/test-player.mjs [--table examples/scatter-drop.table.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTablePlayer } from '../table-player.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2);
const table = JSON.parse(fs.readFileSync(path.resolve(argv.includes('--table') ? argv[argv.indexOf('--table') + 1] : path.join(HERE, '..', 'examples', 'scatter-drop.table.json')), 'utf8'));
const P = createTablePlayer(table), nb = P.ids.length, dt = P.step, steps = P.steps, FPS = 30;
const res = {}; let ok = true; const check = (name, pass, info) => { res[name] = { pass, ...(info || {}) }; if (!pass) ok = false; };

/* 1. at the step times the player returns the table rows exactly */
{ let worst = 0; const o = new Array(7); for (const s of [0, 1, 59, 60, 120, 121, 200, 239]) for (let i = 0; i < nb; i++) { P.poseAt(s * dt, i, o); const r = table.frames[s]; for (let k = 0; k < 7; k++) worst = Math.max(worst, Math.abs(o[k] - r[i * 7 + k])); }
  check('exact_at_step_times', worst < 1e-5, { worstAbsDiff: worst }); }   // 1e-6 table grid; the player renormalises quaternions
/* 2. unit quaternions, shortest arc (no sign flips between neighbouring samples) at 8 sub-frame times per frame */
{ let worstNorm = 0, flips = 0; const a = new Array(7), b = new Array(7);
  for (let i = 0; i < nb; i++) { let prev = null; for (let k = 0; k <= 120 * 8; k++) { const t = Math.min(k / 8 / FPS, P.duration); P.poseAt(t, i, a); worstNorm = Math.max(worstNorm, Math.abs(Math.hypot(a[3], a[4], a[5], a[6]) - 1)); if (prev && prev[3] * a[3] + prev[4] * a[4] + prev[5] * a[5] + prev[6] * a[6] < 0) flips++; prev = a.slice(); } }
  check('unit_quaternions_no_flips', worstNorm < 1e-12 && flips === 0, { worstNormError: worstNorm, signFlips: flips }); }
/* 3. born: the box is not alive before t = 2.0 s, alive at 2.0 s exactly */
{ const bi = P.index.box; check('box_born_at_2s', !P.aliveAt(2.0 - 1e-3, bi) && P.aliveAt(2.0, bi) && P.aliveAt(0.0, 0) && P.aliveAt(30 / FPS * 2, bi), { bornSeconds: table.meta.bodies[bi].born * dt }); }
/* 4. pure function of t: any call order gives bit-identical results */
{ const ts = Array.from({ length: 400 }, (_, k) => (k * 7919 % 4001) / 4001 * P.duration), A = ts.map((t) => JSON.stringify(P.poseAt(t, 3, new Array(7)))), order = ts.map((_, k) => k).reverse();
  const B = []; for (const k of order) { P.poseAt(1.234, 5, new Array(7)); B[k] = JSON.stringify(P.poseAt(ts[k], 3, new Array(7))); }
  check('pure_function_of_t', A.every((x, k) => x === B[k])); }
/* 5. smoothness under the kit's sub-frame times: t = (n + ((k + 0.5) / N - 0.5) * 0.5) / fps. Second difference of position on the 1/240 s grid vs the raw table's second difference (per body, worst) */
{ let w2 = 0, wraw = 0; const a = new Array(7), b = new Array(7), c = new Array(7), h = 1 / 240;
  for (let i = 0; i < nb; i++) { for (let k = 8; k < 960 - 8; k++) { const t = k * h; P.poseAt(t - h, i, a); P.poseAt(t, i, b); P.poseAt(t + h, i, c); if (!P.aliveAt(t - h, i)) continue; w2 = Math.max(w2, Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1], a[2] - 2 * b[2] + c[2])); }
    for (let s = 1; s < steps; s++) { if (s - 1 < table.meta.bodies[i].born) continue; const r0 = table.frames[s - 1], r1 = table.frames[s], r2 = table.frames[s + 1], o = i * 7; wraw = Math.max(wraw, Math.hypot(r0[o] - 2 * r1[o] + r2[o], r0[o + 1] - 2 * r1[o + 1] + r2[o + 1], r0[o + 2] - 2 * r1[o + 2] + r2[o + 2])); } }
  check('interpolation_smooth', w2 <= wraw * 0.5 + 1e-9, { maxSecondDiff_1_240s_grid: +w2.toExponential(2), maxSecondDiff_raw_1_60s_rows: +wraw.toExponential(2), note: 'a linear lerp over a 1/60 s step has at most a quarter of the 1/60 s curvature on a 1/240 s grid (second difference scales with h^2)' }); }
/* 6. throughput */
{ const o = new Array(7), t0 = performance.now(); let n = 0; for (let r = 0; r < 4000; r++) for (let i = 0; i < nb; i++) { P.poseAt((r % 1000) / 250, i, o); n++; } const ms = performance.now() - t0; check('speed', true, { callsPerSecond: Math.round(n / (ms / 1000)), ms_for_one_apply_of_25_bodies: +(ms / 4000).toFixed(4) }); }
/* 7. motion() for the subframe hook + events */
{ const m0 = P.motion(0.5), m1 = P.motion(1.9), m2 = P.motion(3.9); check('motion_hook', m0 > 1 && m2 < 0.5, { motion_at_0p5s: +m0.toFixed(2), motion_at_1p9s: +m1.toFixed(2), motion_at_3p9s: +m2.toFixed(3), boxFirstContactSeconds: P.firstContact('box') }); }

console.log(JSON.stringify(res, null, 1));
console.log(ok ? 'ALL PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
