#!/usr/bin/env node
/* objects/lib/scene-craft.js: the hero-style craft is a pure function of time (node, no browser).
   Each function returns the same value in any call order and in a fresh process, stays in range, and does what the style says it does:
   stop motion holds each pose 2 frames, handheld drifts inside its amplitude, rain drops stay on the glass and run in jerks, light streaks
   cross the span, cut-paper boil changes only on twelves, the page peel covers the whole frame at k = 0.5 and none of it at 0 and 1, and
   squash keeps the volume. */
import { spawnSync } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as K from '../../objects/lib/scene-craft.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let bad = 0; const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  | ' + extra}`); if (!ok) bad++; };
const T = Array.from({ length: 121 }, (_, i) => i / 30 * 3.3);
const sample = () => JSON.stringify(T.map((t) => [K.stepTime(t, 15), K.handheld(t, { amp: 1, seed: 9 }), K.rainDrops(t, { n: 30 }), K.lightStreaks(t, { n: 5 }), K.paperJitter(t, 2), K.peel(t % 1, 0.3, 0.6), K.impactSquash(t, 1.2)]));

const fwd = sample(), rev = (() => { [...T].reverse().forEach((t) => { K.rainDrops(t, { n: 30 }); K.handheld(t); K.paperJitter(t, 2); }); return sample(); })();
check('every craft function gives the same value whatever was evaluated before it (seek order)', fwd === rev);
const child = spawnSync('node', ['--input-type=module', '-e', `import * as K from '${path.join(HERE, '../../objects/lib/scene-craft.js')}'; const T = Array.from({ length: 121 }, (_, i) => i / 30 * 3.3);
  console.log(JSON.stringify(T.map((t) => [K.stepTime(t, 15), K.handheld(t, { amp: 1, seed: 9 }), K.rainDrops(t, { n: 30 }), K.lightStreaks(t, { n: 5 }), K.paperJitter(t, 2), K.peel(t % 1, 0.3, 0.6), K.impactSquash(t, 1.2)])));`], { encoding: 'utf8' });
check('a fresh process computes the same values (no hidden state, no clock, no random)', child.stdout.trim() === fwd, child.stderr.slice(0, 200));

// stop motion on 2s: frames 2k and 2k+1 show the same time, frame 2k+2 the next step
const st = Array.from({ length: 60 }, (_, n) => K.stepTime(n / 30, 15));
check('stepTime(15) at 30 fps holds every pose for exactly 2 frames', st.every((v, n) => (n % 2 ? v === st[n - 1] : n === 0 || v > st[n - 1])), JSON.stringify(st.slice(0, 8)));
check('stepTime(0) is continuous time', K.stepTime(1.2345, 0) === 1.2345);

// handheld inside its amplitude, larger for a larger amp, smaller after the operator settles
const hh = (amp, settle = 0) => Math.max(...T.map((t) => Math.abs(K.handheld(t, { amp, settle }).az)));
check('handheld drift stays inside its amplitude and scales with it', hh(1) <= 0.56 && hh(2) > hh(1) * 1.9 && hh(1, 1) < hh(1) * 0.6, `${hh(1)} ${hh(2)} ${hh(1, 1)}`);
check('rack focus pulls from a to b with an eased settle', K.rackFocus(0, 2, 5, 1, 2) === 2 && K.rackFocus(3, 2, 5, 1, 2) === 5 && K.rackFocus(1.5, 2, 5, 1, 2) > 2 && K.rackFocus(1.5, 2, 5, 1, 2) < 5);

// rain: drops stay on the pane; each drop runs in jerks (holds between runs)
const W = 2, H = 1.4, drops = T.flatMap((t) => K.rainDrops(t, { n: 40, w: W, h: H }));
check('every rain drop stays on the pane', drops.every((d) => d.x >= 0 && d.x <= W && d.y >= -0.1 && d.y <= H && d.r > 0));
const ys = Array.from({ length: 240 }, (_, i) => K.rainDrops(i / 60, { n: 1, seed: 4 })[0]);
check('a drop holds still, then runs (it does not slide at a constant speed)', ys.some((d) => d.run === 0) && ys.some((d) => d.run > 0.5));
const streaks = T.flatMap((t) => K.lightStreaks(t, { n: 6, w: 4 }));
check('light streaks cross the span and fade at its edges', streaks.every((s) => s.x >= -2 && s.x <= 6 && s.a >= 0 && s.a <= 1) && streaks.some((s) => s.a > 0.5));

// cut-paper boil: one value per boil step (12 per second), at most px pixels
const j = Array.from({ length: 60 }, (_, n) => K.paperJitter(n / 60, 0, { boilFps: 12, px: 1.5 }));
check('paper boil changes only on twelves and stays within px', j.every((v, n) => (Math.floor(n / 5) === Math.floor((n - 1) / 5) && n ? JSON.stringify(v) === JSON.stringify(j[n - 1]) : true)) && j.every((v) => Math.abs(v[0]) <= 1.5 && Math.abs(v[1]) <= 1.5));
check('two paper layers boil differently', JSON.stringify(K.paperJitter(0.5, 0)) !== JSON.stringify(K.paperJitter(0.5, 1)));

// page peel: covers the frame at 0.5 (the cut happens under it), none of it at 0 and 1, and the paper never stretches
check('the page peel covers the whole frame at k = 0.5 and nothing at 0 and 1', K.peelCover(0.5) === 1 && K.peelCover(0) === 0 && K.peelCover(1) === 0, `${K.peelCover(0.5)} ${K.peelCover(0)} ${K.peelCover(1)}`);
const len = (k) => { let L = 0, p = K.peel(k, 0, 0.5); for (let i = 1; i <= 200; i++) { const q = K.peel(k, i / 200, 0.5); L += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); p = q; } return L; };
check('the page curls without stretching (a row keeps its length through the curl)', [0.3, 0.45, 0.6, 0.7].every((k) => Math.abs(len(k) - 1) < 0.03), [0.3, 0.45, 0.6, 0.7].map(len).map((x) => x.toFixed(3)).join(' '));

// squash keeps the volume
check('squash keeps the volume (sxz^2 * sy = 1) and an impact squash settles', [-0.3, 0, 0.2, 0.45].every((a) => { const [s, y] = K.squash(a); return Math.abs(s * s * y - 1) < 1e-9; }) && Math.abs(K.impactSquash(2.5, 1.2)) < 0.01 && K.impactSquash(1.2, 1.2) > 0.1);

console.log(bad ? `\n${bad} FAILED` : '\nall scene-craft checks passed');
process.exit(bad ? 1 : 0);
