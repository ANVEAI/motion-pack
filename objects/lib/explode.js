/* motion-pack/objects/lib/explode.js (xp-hardware, 2026-10-16): the EXPLODED-VIEW CHOREOGRAPHER. Pure (no three.js, no DOM): part offsets as a function of t,
   so the 3D plate and a node-side overlay (spec callouts on the parts) agree to the frame.
     const X = explodePlan(parts, { at: 2.0, dur: 0.85, stagger: 0.09, overshoot: 0.05, hold: 2.4, back: true, backStagger: 0.07, breathe: 0.025 });
     explodeAt(X, t) -> { [id]: { k, off: [x, y, z], rot: [rx, ry, rz] } }       k = 0 assembled, 1 fully out (it can pass 1 on the overshoot)
   parts = [{ id, dir: [x, y, z], dist, order?, spin?: [rx, ry, rz] (radians at k = 1), delay? }]. The cascade goes in `order` (default: list order): the first part
   leaves first. Craft (learned from exploded views in hardware launch films, not copied): parts leave one after another a few frames apart, each on an
   ease-out with a small overshoot so it settles like a mass, the stack then breathes very slightly while it holds (the shot is alive, the parts read as
   floating, not frozen), and the reassembly runs in the REVERSE order so the part that left first seats last.
   Timing defaults are in seconds; every value is clamped so a hostile number cannot produce NaN or an endless loop. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const fin = (v, d) => (Number.isFinite(v) ? v : d);
/* ease-out with a decaying overshoot: 0 -> 1 + o -> 1 (a closed-form "backOut" that settles, never oscillates more than once) */
export function settle(u, o = 0.05) {
  u = clamp(u); if (u >= 1) return 1;
  const e = 1 - Math.pow(1 - u, 2.6);                   // ease-out
  return e + o * Math.sin(Math.PI * seg(u, 0.55, 1));    // one overshoot bump, peaking ~1 + 0.8 o at u ~ 0.78, back to exactly 1 at u = 1
}
/* the reassembly ease: ease-in-out, lands exactly on 0 with a 2% seat dip (the part presses home) */
function seatIn(u, d = 0.02) { u = clamp(u); const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; return 1 - e - d * Math.sin(Math.PI * clamp((u - 0.82) / 0.18)); }

export function explodePlan(parts, o = {}) {
  const P = (parts || []).slice(0, 64).map((p, i) => ({ id: String(p.id ?? 'p' + i), dir: (p.dir || [0, 1, 0]).slice(0, 3).map((v) => fin(+v, 0)), dist: fin(+p.dist, 0.3), order: fin(+p.order, i), spin: (p.spin || [0, 0, 0]).slice(0, 3).map((v) => fin(+v, 0)), delay: fin(+p.delay, 0) }));
  const L = Math.hypot; P.forEach((p) => { const l = L(...p.dir) || 1; p.dir = p.dir.map((v) => v / l); });
  const ord = P.slice().sort((a, b) => a.order - b.order);
  const at = fin(+o.at, 0), dur = clamp(fin(+o.dur, 0.85), 0.05, 10), stagger = clamp(fin(+o.stagger, 0.09), 0, 2), hold = clamp(fin(+o.hold, 2.0), 0, 600);
  const out = ord.map((p, i) => ({ ...p, t0: at + p.delay + i * stagger }));
  const outEnd = Math.max(at, ...out.map((p) => p.t0)) + dur;
  const back = o.back !== false, bStag = clamp(fin(+o.backStagger, stagger * 0.8), 0, 2), bDur = clamp(fin(+o.backDur, dur * 0.9), 0.05, 10), backAt = outEnd + hold;
  const rev = out.slice().reverse(); rev.forEach((p, i) => { p.b0 = backAt + i * bStag; });   // the last part out leaves the stack first on the way back: the first one seats last
  const seatEnd = back ? Math.max(...rev.map((p) => p.b0), backAt) + bDur : Infinity;
  return { parts: out, at, dur, stagger, hold, back, backAt, bDur, outEnd, seatEnd, overshoot: clamp(fin(+o.overshoot, 0.05), 0, 0.3), breathe: clamp(fin(+o.breathe, 0.025), 0, 0.2), breatheHz: clamp(fin(+o.breatheHz, 0.35), 0, 4) };
}

export function explodeAt(X, t) {
  const res = {}; t = fin(+t, 0);
  for (const p of X.parts) {
    let k = settle(seg(t, p.t0, p.t0 + X.dur), X.overshoot);
    if (t >= X.outEnd && (!X.back || t < X.backAt + 1e-9)) k *= 1 + X.breathe * Math.sin(2 * Math.PI * X.breatheHz * (t - X.outEnd)) * seg(t, X.outEnd, X.outEnd + 0.4) * (X.back ? 1 - seg(t, X.backAt - 0.4, X.backAt) : 1);   // the hold breathes (in and out over 0.4 s, so the way back starts from rest)
    if (X.back && t >= p.b0) k = seatIn(seg(t, p.b0, p.b0 + X.bDur));
    if (X.back && t >= p.b0 + X.bDur) k = 0;
    res[p.id] = { k, off: p.dir.map((v) => v * p.dist * k), rot: p.spin.map((v) => v * k) };
  }
  return res;
}
/* the cue sheet of a choreography: one release per part leaving, one seat per part arriving (absolute seconds), for the plan's sound */
export function explodeCues(X, { release = 'sfx/hw/parts_separate', seat = 'sfx/hw/parts_seat', maxRelease = 3 } = {}) {
  const c = X.parts.slice(0, maxRelease).map((p, i) => ({ t: +p.t0.toFixed(4), id: release, why: `explode: ${p.id} leaves${i ? '' : ' (the cascade starts)'}` }));
  if (X.back) X.parts.forEach((p) => c.push({ t: +(p.b0 + X.bDur * 0.97).toFixed(4), id: seat, why: `reassembly: ${p.id} seats` }));
  return c.sort((a, b) => a.t - b.t);
}
