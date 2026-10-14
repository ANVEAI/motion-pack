/* camera module tests (pure math, node): determinism, purity, dolly-zoom width invariance, whip timing, handheld bounds + spectrum, envelopes, lock, lint, cover scale, bake equivalence.
   run: node camera/tests/camera.test.mjs   (exit 1 on failure) */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as C3 from '../cam3d.js'; import * as C2 from '../cam2d.js'; import { bakeGSAP } from '../bake.js'; import { reporter } from '../../layers/tests/harness.mjs';
const R = reporter('camera'); const here = path.dirname(fileURLToPath(import.meta.url));
const flat = (s) => JSON.stringify(s), freeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && freeze(v)); return Object.freeze(o); };
const base = freeze(structuredClone(C3.KIT.wide)), rng = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const hits = [1.0, 2.5, 4.0];
const cams3 = { hold: C3.hold(base), pushIn: C3.pushIn(base, { at: 1 }), pushSlow: C3.pushSlow(base), pullOut: C3.pullOut(base, { at: 1 }), orbit: C3.orbit(base, { at: 0.5 }), crane: C3.crane(base, { at: 0.5 }), truck: C3.truck(base, { at: 0.5 }),
  dollyZoom: C3.dollyZoom(base, { at: 0.5 }), whipOut: C3.whipPan(base, { at: 1 }), whipIn: C3.whipPan(base, { at: 1, mode: 'in' }), handheld: C3.handheld(base, { level: 'action', seed: 4 }), beatPunch: C3.beatPunch(base, { hits }), dutch: C3.dutch(base, { at: 1 }),
  breathe: C3.breathe(base), impactShake: C3.impactShake(base, { hits }), stacked: C3.handheld(C3.beatPunch(C3.pushIn(C3.hold(base), { at: 1 }), { hits }), { level: 'doc', seed: 2 }), kitDrift: C3.kitDrift(base, 5) };
const cams2 = { push2d: C2.push2d(C2.ID2, { at: 1 }), pull2d: C2.pull2d(C2.ID2, { at: 1 }), pan2d: C2.pan2d(C2.ID2, { at: 1 }), whipOut: C2.whip2d(C2.ID2, { at: 1 }), whipIn: C2.whip2d(C2.ID2, { at: 1, mode: 'in' }), handheld2d: C2.handheld2d(C2.ID2, { seed: 3 }),
  punchCadence: C2.punchCadence(C2.ID2, { boundaries: [1.2, 3.1, 6.4, 8.8] }), punchIn: C2.punchIn2d(C2.ID2, { at: 1, returnAt: 2 }), beat: C2.beatPunch2d(C2.ID2, { hits }), kenBurns: C2.kenBurns(C2.ID2, { at: 0, dur: 4 }), dutch2d: C2.dutch2d(C2.ID2, { at: 1 }), breathe2d: C2.breathe2d(C2.ID2), shake2d: C2.shake2d(C2.ID2, { hits }),
  scaleDive: C2.scaleDive(C2.ID2, { at: 0.5, dur: 3, levels: 3, ratio: [8, 6, 10], focus: [[0.6, 0.4], [0.3, 0.7], [0.5, 0.5]] }), pullbackToScreen: C2.pullbackToScreen(C2.handheld2d(C2.ID2, { level: 'subtle' }), { at: 1, dur: 2.4, quad: [[0.3, 0.28], [0.66, 0.31], [0.65, 0.6], [0.31, 0.58]] }) };

/* 1-2. determinism in any order + purity (frozen base would throw on mutation) */
const ts = Array.from({ length: 240 }, () => rng() * 9);
for (const [group, cams] of [['3d', cams3], ['2d', cams2]]) {
  let okAll = true, bad = '';
  for (const [name, f] of Object.entries(cams)) { const a = ts.map((t) => flat(f(t))), idx = ts.map((_, i) => i).sort(() => rng() - 0.5), b = []; idx.forEach((i) => { b[i] = flat(f(ts[i])); }); const sorted = [...ts].sort((x, y) => x - y).map((t) => flat(f(t))), again = ts.map((t) => flat(f(t))); if (!a.every((v, i) => v === b[i] && v === again[i])) { okAll = false; bad += name + ' '; } if (!sorted.length) okAll = false; }
  R.check(`${group}: every preset gives identical state for the same t in shuffled / repeated order (${Object.keys(cams).length} presets x 240 samples), frozen base never mutated`, okAll, bad);
}
const numsOf = (o) => (typeof o === 'number' ? [o] : Array.isArray(o) ? o.flatMap(numsOf) : o && typeof o === 'object' ? Object.values(o).flatMap(numsOf) : []);
let finite = true; for (const f of [...Object.values(cams3), ...Object.values(cams2)]) for (const t of [-5, 0, 0.001, 3.3, 99, 1e4]) if (!numsOf(f(t)).every(Number.isFinite)) finite = false;
R.check('all presets finite for t in [-5 .. 1e4]', finite);

/* 3. dolly zoom: subject width invariance + the research arithmetic */
const dz = C3.dollyZoom({ ...base, fov: 20, dist: 12 }, { at: 0.5, dur: 2.4, fovTo: 55 }); let wmin = 1e9, wmax = 0; for (let i = 0; i <= 90; i++) { const s = dz(0.5 + 2.4 * i / 90), w = 1 / (s.dist * Math.tan(s.fov * Math.PI / 360)); wmin = Math.min(wmin, w); wmax = Math.max(wmax, w); }
R.check(`dolly zoom keeps projected subject width constant (spread ${(100 * (wmax / wmin - 1)).toFixed(4)}%) and ends at dist ${dz(3).dist.toFixed(2)} (research: 12 -> 4.06)`, wmax / wmin - 1 < 1e-9 && Math.abs(dz(3).dist - 4.06) < 0.02 && dz(0.4).fov === 20 && Math.abs(dz(9).fov - 55) < 1e-9);

/* 4. whip pan */
const wo = C3.whipPan(base, { at: 1, dur: 7 / 30, deg: 70 }), wi = C3.whipPan(base, { at: 1, dur: 7 / 30, deg: 70, mode: 'in' });
const sp = []; for (let i = 0; i <= 7; i++) sp.push(Math.abs(C3.speedAz(wo, 1 + i / 30)));
R.check(`whip pan out: 0 -> +70 deg in exactly 7 frames, speed peaks mid-whip (${sp.map((v) => v.toFixed(0)).join('/')} deg/s), roll returns to 0`, Math.abs(wo(1).az - base.az) < 1e-9 && Math.abs(wo(1 + 7 / 30).az - base.az - 70) < 1e-9 && Math.abs(wo(0.5).az - base.az) < 1e-9 && sp.indexOf(Math.max(...sp)) >= 3 && sp.indexOf(Math.max(...sp)) <= 4 && Math.abs(wo(1 + 7 / 30).roll) < 1e-9 && Math.abs(wo(1).roll) < 1e-9 && Math.max(...sp) > 8 * sp[0] + 50);
R.check('whip pan in: starts at -70 deg, lands on the base az; cut midpoint = at + 3.5 frames', Math.abs(wi(1).az - base.az + 70) < 1e-9 && Math.abs(wi(1 + 7 / 30).az - base.az) < 1e-9 && Math.abs(C3.whipMid(1) - (1 + 3.5 / 30)) < 1e-12);

/* 5. handheld: px bounds, linear level scaling, band-limited spectrum, seed behaviour */
const trace = (cam, key, n = 900, fps = 30) => Array.from({ length: n }, (_, i) => cam(i / fps)[key]); const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length), mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const pxTrace = (cam) => trace(cam, 'az').map((v) => (v - base.az) / (base.fov / 1080));
const hDoc = C3.handheld(base, { level: 'doc', seed: 1 }), hAct = C3.handheld(base, { level: 'action', seed: 1 }), hSub = C3.handheld(base, { level: 'subtle', seed: 1 });
const pDoc = pxTrace(hDoc), pAct = pxTrace(hAct), bound = (L) => L * (5 * (1 + 1.27 + 0.79) / Math.sqrt(1 + 1.27 ** 2 + 0.79 ** 2) + 0.8 * (1.8 / Math.sqrt(1.64))) * 1.001;
R.check(`handheld doc: horizontal shake peak ${Math.max(...pDoc.map(Math.abs)).toFixed(1)} px <= ${bound(1).toFixed(1)}, RMS ${rms(pDoc).toFixed(2)} px; action/doc RMS ratio ${(rms(pAct) / rms(pDoc)).toFixed(3)} (expect 2.5)`, Math.max(...pDoc.map(Math.abs)) <= bound(1) && Math.abs(rms(pAct) / rms(pDoc) - 2.5) < 0.01 && rms(pDoc) > 2 && rms(pDoc) < 5);
const N = pDoc.length, m0 = mean(pDoc), cen = pDoc.map((v) => v - m0), binPow = (k) => { let re = 0, im = 0; cen.forEach((v, i) => { re += v * Math.cos(2 * Math.PI * k * i / N); im -= v * Math.sin(2 * Math.PI * k * i / N); }); return re * re + im * im; };
let tot = 0, near = 0, hi = 0; for (let k = 1; k <= N / 2; k++) { const f = k * 30 / N, p = binPow(k); tot += p; if ([0.37, 0.83, 1.31, 7.1, 9.3].some((l) => Math.abs(f - l) <= 0.12)) near += p; if (f > 10) hi += p; }
R.check(`handheld spectrum: designed lines (0.37 0.83 1.31 7.1 9.3 Hz +-0.12) carry ${(100 * near / tot).toFixed(0)}% of power, beyond 10 Hz up to Nyquist ${(100 * hi / tot).toFixed(2)}%`, near / tot > 0.9 && hi / tot < 0.01);
const maxRoll = Math.max(...trace(hAct, 'roll').map(Math.abs)), maxFov = Math.max(...trace(hAct, 'fov').map((v) => Math.abs(v / base.fov - 1)));
R.check(`handheld action: roll peak ${maxRoll.toFixed(2)} deg, fov breathing ${(100 * maxFov).toFixed(2)}%, subtle < doc < action RMS`, maxRoll < 2.5 * (0.25 * 1.7 + 0.04 * 1.4) && maxFov < 0.015 && rms(trace(hSub, 'roll')) < rms(trace(hDoc, 'roll')) && rms(trace(hDoc, 'roll')) < rms(trace(hAct, 'roll')));
R.check('handheld: same seed identical, different seed different', flat(C3.handheld(base, { seed: 1 })(2.2)) === flat(C3.handheld(base, { seed: 1 })(2.2)) && flat(C3.handheld(base, { seed: 1 })(2.2)) !== flat(C3.handheld(base, { seed: 2 })(2.2)));

/* 6. envelopes: beat punch + shake peak ON the hit */
const bp = C3.beatPunch(base, { hits: [1.0], amount: 0.012 });
R.check(`beat punch: peak ${bp(1).punch.toFixed(4)} = amount ON the hit, zero 1 frame before attack, zero after 8 frames`, Math.abs(bp(1).punch - 0.012) < 1e-12 && bp(1 - 2 / 30).punch === 0 && bp(1 + 8 / 30 + 0.001).punch === 0 && bp(1 + 2 / 30).punch < bp(1 + 1 / 30).punch);
const is = C3.impactShake(base, { hits: [1.0], px: 8 }); const sh = [0, 1, 2, 3, 4, 5].map((k) => Math.hypot(...is(1 + k / 30).shake));
R.check(`impact shake decays over ~4 frames (${sh.map((v) => v.toFixed(1)).join(' ')} px)`, sh[0] > 1 && sh[4] < sh[0] * 0.5 && sh[5] <= sh[1]);

/* 7. lock + lint */
const moving = C3.orbit(base, { at: 0, dur: 5, deg: 40 }), locked = C3.lock(moving, [[2, 2.5]]);
R.check('lock freezes the camera over a key action; unlocked outside', flat(locked(2.2)) === flat(moving(2)) && flat(locked(2.49)) === flat(moving(2)) && flat(locked(1.5)) === flat(moving(1.5)) && flat(locked(3)) === flat(moving(3)));
const lint1 = C3.lintCameraMoves(moving, [[2, 2.5]]), lint2 = C3.lintCameraMoves(locked, [[2, 2.5]]), lint3 = C3.lintCameraMoves(C3.hold(base), [[1, 2]]);
R.check('lintCameraMoves flags a moving camera under a key action, passes locked and a hold', lint1.length === 1 && lint2.length === 0 && lint3.length === 0, flat(lint1.map((x) => x.az.toFixed(1))));
const seq = C3.sequence([[0, C3.hold(base)], [2, C3.pushIn(base, { at: 2 })]]); R.check('sequence cuts between cameras', seq(1.9).dist === base.dist && seq(3.5).dist < base.dist);

/* 8. 2D: punch cadence, ease-out, lint, cover scale */
const pc = cams2.punchCadence, sc = (t) => pc(t).scale;
R.check(`punch cadence: 1.00 -> 1.08 -> 1.00 -> 1.15 at the boundaries, 6-frame ease-out-expo (scale 1 frame in: ${sc(1.2 + 1 / 30).toFixed(3)} of 1.08)`, sc(1) === 1 && Math.abs(sc(1.2 + 6 / 30) - 1.08) < 1e-6 && Math.abs(sc(3.1 + 6 / 30) - 1.0) < 1e-6 && Math.abs(sc(6.4 + 6 / 30) - 1.15) < 1e-6 && sc(1.2 + 1 / 30) > 1.0 + 0.08 * 0.45 && sc(1.2 + 1 / 30) < 1.08);
const scalesOk = [1.0, 1.08, 1.0, 1.15].every((v, i, a) => v !== a[(i + 1) % a.length]); R.check('default cadence never repeats the same framing back-to-back (incl. wrap-around)', scalesOk);
const l1 = C2.lintPunchCadence(pc, 12), l2 = C2.lintPunchCadence(C2.punchCadence(C2.ID2, { boundaries: [1, 2, 3.5], scales: [1, 1.1, 1, 1.15] }), 6);
R.check(`lintPunchCadence: cadence at 1.2/6.4 s passes (${l1.onsets.join(',')}), 1 s and 3.5 s punches flagged`, l1.violations.length === 0 && l2.violations.length === 1, flat(l2.violations));
const bf = (rot, tx, ty, W, H, s) => { const a = rot * Math.PI / 180, c = Math.cos(a), si = Math.sin(a); for (const [cx, cy] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]) { const u = c * (cx - tx) + si * (cy - ty), v = -si * (cx - tx) + c * (cy - ty); if (Math.abs(u) > s * W / 2 + 1e-6 || Math.abs(v) > s * H / 2 + 1e-6) return false; } return true; };
let coverOk = true; for (let i = 0; i < 200; i++) { const rot = (rng() - 0.5) * 8, tx = (rng() - 0.5) * 80, ty = (rng() - 0.5) * 60, s = C2.coverScale(rot, tx, ty, 1920, 1080); if (!bf(rot, tx, ty, 1920, 1080, s) || (s > 1.0005 && bf(rot, tx, ty, 1920, 1080, s * 0.995))) coverOk = false; }
R.check('coverScale is the exact minimum scale that hides the edges (200 random rot/translate cases, brute-force corner test)', coverOk && C2.coverScale(0, 0, 0, 1920, 1080) === 1);
const wh = C2.whip2d(C2.ID2, { at: 1, dx: 1.2 }), blurs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => wh(1 + k / 30).blur);
R.check(`2D whip: streak blur peaks mid-whip (${blurs.map((v) => v.toFixed(0)).join('/')} px), zero outside, x travels 1.2 H`, blurs.indexOf(Math.max(...blurs)) >= 3 && blurs.indexOf(Math.max(...blurs)) <= 4 && wh(0.5).blur === 0 && wh(2).blur === 0 && Math.abs(wh(2).x - 1.2) < 1e-9);

/* 9. bake: tl.set per frame equals toGSAP(cam(t)) exactly; CSS and GSAP outputs agree */
const calls = []; const fakeTl = { set: (tg, v, t) => { calls.push([v, t]); return fakeTl; }, fromTo: (tg, v, to, t) => { calls.push([v, t]); return fakeTl; } }; const cam = C2.handheld2d(C2.push2d(C2.ID2, { at: 0.3 }), { seed: 5 });
bakeGSAP(fakeTl, '#world', cam, { t0: 0, dur: 2, fps: 30 }); let bakeOk = calls.length === 61; calls.forEach(([v, t]) => { const e = C2.toGSAP(cam(t)); if (flat(v) !== flat(e)) bakeOk = false; });
const css = C2.toCSS(cam(1.3)), g = C2.toGSAP(cam(1.3)); const nums = css.transform.match(/-?[\d.]+/g).map(Number);
R.check('bakeGSAP writes one tl.set per frame (61 for 2 s) identical to toGSAP(cam(t)); CSS transform numbers match GSAP vars', bakeOk && Math.abs(nums[0] - g.x) < 1e-3 && Math.abs(nums[1] - g.y) < 1e-3 && Math.abs(nums[3] - g.scale) < 1e-4);
/* 9b. round 3: scaleDive (exponential zoom, hidden swaps) + pullbackToScreen (comp lands on a screen quad) */
{ const R8 = [8, 6, 10], F = [[0.6, 0.4], [0.3, 0.7], [0.5, 0.5], [0.5, 0.5]], dv = C2.scaleDive(C2.ID2, { at: 0, dur: 3, levels: 3, ratio: R8, focus: F, ease: 'lin' });
  /* log-scale speed constant (ease lin): d ln(zoom) / dt is the same in every level */
  const tot = Math.log(8 * 6 * 10), lnz = (t) => { const s = dv(t), done = R8.slice(0, s.dive.level).reduce((a, r) => a + Math.log(r), 0); return done + Math.log(s.scale); };
  const sp = [0.3, 1.1, 1.9, 2.6].map((t) => (lnz(t + 0.01) - lnz(t - 0.01)) / 0.02);
  /* hand-off: just before level i ends, the next level drawn at scale/ratio (origin focus[i]) maps its frame onto the region of level i around focus[i] */
  let hand = true; for (const tEnd of [Math.log(8) / tot * 3, (Math.log(8) + Math.log(6)) / tot * 3]) { const a = dv(tEnd - 1e-6), b = dv(tEnd + 1e-6);
    if (!(a.dive.next && a.dive.next.opacity > 0.999 && Math.abs(a.scale / a.dive.ratio - 1) < 1e-4 && Math.abs(b.scale - 1) < 1e-4 && b.dive.level === a.dive.level + 1)) hand = false;
    const q = [0.13, 0.81], inner = C2.mapPoint2({ ...a, scale: a.scale / a.dive.ratio }, q), outer = C2.mapPoint2(a, [a.dive.origin[0] + (q[0] - a.dive.origin[0]) / a.dive.ratio, a.dive.origin[1] + (q[1] - a.dive.origin[1]) / a.dive.ratio]); if (Math.hypot(inner[0] - outer[0], inner[1] - outer[1]) > 1e-9) hand = false; }
  R.check(`scaleDive: constant log-zoom speed across levels (${sp.map((v) => v.toFixed(3)).join('/')} per s, expected ${(tot / 3).toFixed(3)}); every hand-off lands the next level at scale 1 exactly where level i showed it; ends on level 3 at scale 1`,
    sp.every((v) => Math.abs(v - tot / 3) < 1e-3) && hand && dv(3.5).dive.level === 3 && dv(3.5).scale === 1 && dv(-1).scale === 1 && dv(-1).dive.level === 0);
  const css = C2.scaleDiveCSS(dv(0.9), 4); R.check('scaleDiveCSS: the current level visible, the next one fading in above it, the others hidden', css.length === 4 && css[dv(0.9).dive.level].opacity === '1' && css.filter((c) => c.visibility === 'visible').length <= 2);
  const quad = [[0.3, 0.28], [0.66, 0.31], [0.65, 0.6], [0.31, 0.58]], pb = C2.pullbackToScreen(C2.ID2, { at: 1, dur: 2.4, quad, lock: 0.35 }), s0 = pb(0.5), s1 = pb(4), sm = pb(1.6);
  const eq = (A, B) => A.every((p, i) => Math.hypot(p[0] - B[i][0], p[1] - B[i][1]) < 1e-9), mq = quad.map((q) => C2.mapPoint2(sm, q));
  const xs = quad.map((q) => C2.mapPoint2(s0, q)[0]), ys = quad.map((q) => C2.mapPoint2(s0, q)[1]);
  R.check(`pullbackToScreen: starts with the comp full frame and the quad's box filling the frame (${Math.min(...xs).toFixed(3)}..${Math.max(...xs).toFixed(3)} x ${Math.min(...ys).toFixed(3)}..${Math.max(...ys).toFixed(3)}), ends with the comp exactly on the quad at plate scale 1; once locked the corners ride the camera`,
    eq(s0.pin.corners, [[0, 0], [1, 0], [1, 1], [0, 1]]) && Math.abs(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) - 1) < 1e-9 && eq(s1.pin.corners, quad) && Math.abs(s1.scale - 1) < 1e-12 && Math.abs(s1.x) < 1e-12 && (sm.pin.lock < 1 || eq(sm.pin.corners, mq)) && eq(pb(3.0).pin.corners, quad.map((q) => C2.mapPoint2(pb(3.0), q)))); }
/* 10. ease copies identical across modules */
const e1 = fs.readFileSync(path.join(here, '../ease.js'), 'utf8'), e2 = fs.readFileSync(path.join(here, '../../layers/ease.js'), 'utf8'), e3 = fs.readFileSync(path.join(here, '../../type/ease.js'), 'utf8');
R.check('ease.js is byte-identical in layers/, type/ and camera/', e1 === e2 && e2 === e3);
const res = R.done(); fs.writeFileSync(path.join(here, 'last-run.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
