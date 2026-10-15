/* motion-pack / templates/_shared/human/screen.mjs: PURE screen-recording maths for tutorials (node + browser, no DOM, no clock).
   Coordinates are fractions of the recorded screen (0..1), times are seconds on the output timeline.
     cursorFromClicks(clicks, opts)   estimate a cursor track from click timestamps: the pointer travels on a minimum-jerk arc and settles before each click
                                      (an ESTIMATE: record the real track with your recorder when you can; the plan says which one it used)
     cursorAt(track, t)               the pointer position at t (linear between samples)
     zoomKeys(clicks, opts)           zoom-in windows around click groups: ramp in before the first click, hold, ramp out (merged when clicks are close)
     zoomScale(keys, t)               the zoom factor at t (eased in and out)
     zoomView(keys, track, t, opts)   { s, cx, cy }: the zoom factor and the view centre that follows the SMOOTHED cursor (a fixed window average: pure), clamped to the screen
     viewTransform(view, screen, box, fit)   CSS numbers to show that view of a screen of size `screen` inside a panel of size `box` ('cover' fills the panel and pans)
     pipState(pip, t, { keys, track })      webcam picture-in-picture: opacity and scale, auto-hidden while zoomed in, inside hide windows, or when the cursor nears its corner */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k, seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const minJerk = (x) => { x = clamp(x); return x * x * x * (10 - 15 * x + 6 * x * x); };
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };

export function cursorFromClicks(clicks, { fps = 30, start = [0.5, 0.55], startAt = 0, end = null, settle = 0.14, minMove = 0.28, maxMove = 0.95, speed = 1.1, arc = 0.06 } = {}) {
  const C = (clicks || []).map((c) => ({ t: +c.t, x: clamp(+c.x), y: clamp(+c.y) })).filter((c) => Number.isFinite(c.t)).sort((a, b) => a.t - b.t);
  const legs = []; let px = start[0], py = start[1], pt = startAt;
  for (const c of C) { const d = Math.hypot(c.x - px, (c.y - py) * 0.5625), dur = clamp(d / speed + 0.18, minMove, maxMove), t1 = Math.max(pt + 0.05, c.t - settle), t0 = Math.max(pt, t1 - dur);
    legs.push({ t0, t1, x0: px, y0: py, x1: c.x, y1: c.y }); px = c.x; py = c.y; pt = c.t + 0.08; }
  const T = end ?? (C.length ? C.at(-1).t + 1 : startAt + 1), n = Math.max(1, Math.round((T - startAt) * fps)), track = [];
  const posAt = (t) => { let x = start[0], y = start[1]; for (const L of legs) { if (t < L.t0) break; const k = minJerk(seg(t, L.t0, L.t1)), dx = L.x1 - L.x0, dy = L.y1 - L.y0, len = Math.hypot(dx, dy) || 1, bow = Math.sin(Math.PI * k) * arc * len;
    x = lerp(L.x0, L.x1, k) - (dy / len) * bow; y = lerp(L.y0, L.y1, k) + (dx / len) * bow; } return [x, y]; };
  const clickF = new Set(C.map((c) => Math.round((c.t - startAt) * fps)));
  for (let f = 0; f <= n; f++) { const t = startAt + f / fps, [x, y] = posAt(t); track.push([+t.toFixed(4), +clamp(x).toFixed(4), +clamp(y).toFixed(4), ...(clickF.has(f) ? [1] : [])]); }
  return { track, legs: legs.length, estimated: true };
}
export function cursorAt(track, t) {
  if (!track || !track.length) return [0.5, 0.5]; if (t <= track[0][0]) return [track[0][1], track[0][2]]; const N = track.length - 1; if (t >= track[N][0]) return [track[N][1], track[N][2]];
  let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (track[m][0] <= t) lo = m; else hi = m; }
  const a = track[lo], b = track[hi], k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}
/* group clicks closer than `merge` s; each group -> { t0 ramp start, t1 fully in, t2 ramp-out start, t3 out, scale } */
export function zoomKeys(clicks, { scale = 1.8, lead = 0.55, ramp = 0.45, hold = 1.1, merge = 1.6, minGap = 0.6, groups = null } = {}) {
  const C = (clicks || []).map((c) => +c.t).filter(Number.isFinite).sort((a, b) => a - b), G = [];
  for (const t of C) { const g = G.at(-1); if (g && t - g.at(-1) <= merge) g.push(t); else G.push([t]); }
  const keys = []; for (const g of G) { const t1 = g[0] - lead + ramp, t0 = t1 - ramp, t2 = g.at(-1) + hold, t3 = t2 + ramp, prev = keys.at(-1);
    if (prev && t0 - prev.t3 < minGap) { prev.t2 = t2; prev.t3 = t3; continue; } keys.push({ t0: +Math.max(0, t0).toFixed(3), t1: +Math.max(0, t1).toFixed(3), t2: +t2.toFixed(3), t3: +t3.toFixed(3), scale }); }
  return keys;
}
export function zoomScale(keys, t) { let s = 1; for (const k of keys || []) { if (t < k.t0 || t > k.t3) continue; const v = t < k.t1 ? ease(seg(t, k.t0, k.t1)) : t <= k.t2 ? 1 : 1 - ease(seg(t, k.t2, k.t3)); s = Math.max(s, lerp(1, k.scale, v)); } return s; }
/* the focus is the cursor averaged over the last `follow` seconds (12 fixed taps: a pure function of t, no state), so the view glides instead of jittering */
export function zoomView(keys, track, t, { follow = 0.5, taps = 12 } = {}) {
  const s = zoomScale(keys, t); let fx = 0, fy = 0;
  for (let i = 0; i < taps; i++) { const [x, y] = cursorAt(track, t - (i / (taps - 1)) * follow); fx += x; fy += y; }
  fx /= taps; fy /= taps;
  return { s: +s.toFixed(5), cx: clamp(fx), cy: clamp(fy) };
}
/* view {s, cx, cy} of a screen [Ws, Hs] inside a panel [Wb, Hb]: returns { k (CSS scale of the screen element), tx, ty (px, transform-origin 0 0), visible: [x0, y0, x1, y1] fractions } */
export function viewTransform(view, [Ws, Hs], [Wb, Hb], fit = 'contain') {
  const base = fit === 'cover' ? Math.max(Wb / Ws, Hb / Hs) : Math.min(Wb / Ws, Hb / Hs), k = base * Math.max(1, view.s), vw = Wb / (k * Ws), vh = Hb / (k * Hs);
  const cx = vw >= 1 ? 0.5 : clamp(view.cx, vw / 2, 1 - vw / 2), cy = vh >= 1 ? 0.5 : clamp(view.cy, vh / 2, 1 - vh / 2);
  return { k: +k.toFixed(5), tx: +(Wb / 2 - cx * Ws * k).toFixed(2), ty: +(Hb / 2 - cy * Hs * k).toFixed(2), visible: [cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2].map((v) => +v.toFixed(4)) };
}
/* PiP: corner 'tl' | 'tr' | 'bl' | 'br'; hide windows [[a, b]]; autoHide: ['zoom', 'cursor']. Fades over `fade` s; every input is a pure function of t */
export function pipState(pip, t, { keys = [], track = [], fade = 0.25 } = {}) {
  let vis = 1;
  for (const [a, b] of pip.hide || []) vis = Math.min(vis, 1 - seg(t, a - fade, a) * (1 - seg(t, b, b + fade)));
  const auto = pip.autoHide || [];
  if (auto.includes('zoom')) { const z = zoomScale(keys, t), top = Math.max(1.0001, ...keys.map((k) => k.scale)); vis = Math.min(vis, 1 - clamp((z - 1) / (top - 1) * 1.6)); }
  if (auto.includes('cursor') && track.length) { const corner = pip.corner || 'br', cx = corner.includes('l') ? 0.12 : 0.88, cy = corner.startsWith('t') ? 0.15 : 0.85; let d = 0;
    for (let i = 0; i < 6; i++) { const [x, y] = cursorAt(track, t - i * 0.05); d += Math.hypot(x - cx, (y - cy) * 0.5625); } d /= 6; vis = Math.min(vis, seg(d, 0.14, 0.26)); }
  return { opacity: +vis.toFixed(4), scale: +lerp(0.9, 1, vis).toFixed(4) };
}
