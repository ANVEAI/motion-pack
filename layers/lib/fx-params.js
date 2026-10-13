/* motion-pack / layers: CPU-side parameter builders shared by the Finisher and the OverlayLayer (leak blobs, intensity envelopes, colour helpers). Pure. */
import { mulberry32, env, windowEnv } from '../ease.js';
export const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const dec = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const pad = (a, n) => a.concat(new Array(Math.max(0, n - a.length)).fill(0));
/* 3..5 anisotropic blobs entering from an edge; seeded; stable across frames */
export function leakParams(c, A) {
  const r = mulberry32(c.seed * 9973 + 1), n = Math.min(5, c.count), P = [], M = [], C = [];
  for (let i = 0; i < n; i++) {
    const edge = c.edge === 'any' ? ['left', 'right', 'top', 'bottom'][Math.floor(r() * 4)] : c.edge, s = 0.25 + 0.30 * r();
    let cx, cy, sx = s, sy = s * 1.8;
    if (edge === 'left') { cx = -0.02 + 0.10 * r(); cy = 0.15 + 0.7 * r(); } else if (edge === 'right') { cx = 0.92 + 0.10 * r(); cy = 0.15 + 0.7 * r(); }
    else { cx = 0.15 + 0.7 * r(); cy = edge === 'top' ? 0.92 + 0.1 * r() : -0.02 + 0.1 * r(); sx = s * 1.8; sy = s; }
    P.push([cx, cy, sx, sy]); M.push([0.06 * (0.6 + r()), 0.05 * (0.6 + r()), 0.08 + 0.1 * r(), r() * 6.283]); C.push(hexRGB(c.colors[i % c.colors.length]).map((v) => dec(v) ** 0.6));
  }
  return { n, P: pad(P.flat(), 20), M: pad(M.flat(), 20), C: pad(C.flat(), 15) };
}
/* overall leak intensity at t: eased in/hold/out window, or a breathing loop, plus flash spikes that peak ON the cut frame */
export function leakIntensity(lk, t, fps, cuts = []) {
  if (!lk.on) return 0; const e = lk.envelope;
  let I = lk.loop ? lk.intensity * (0.65 + 0.35 * Math.sin(6.2831853 * 0.11 * t + lk.seed)) : lk.intensity * windowEnv(t, e.start, e.in, e.hold, e.out);
  for (const f of lk.flashes || []) I = Math.max(I, env(t, [f.t ?? f], { attack: (f.attack ?? 3) / fps, decay: (f.decay ?? 12) / fps }));
  for (const f of cuts) I = Math.max(I, env(t, [f], { attack: 3 / fps, decay: 12 / fps }));
  return I;
}
