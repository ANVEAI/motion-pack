/* motion-pack / type / gfx / pathsample.js: SVG path -> points -> arc-length table (2026-10-14, round 4/5). Pure, no DOM: node and browser.
     flattenPath(d, { seg = 24 })      -> [[x, y], ...] for the FIRST subpath (M/m L/l H/h V/v C/c S/s Q/q T/t Z/z; an arc A/a is flattened as a straight line)
     arcTable(pts, closed)             -> { pts, cum: [0, ...], len, closed }   (computed once per path; cache it)
     pointAt(tab, s)                   -> { x, y, a }   position and tangent angle (rad) at arc length s (clamped; wrapped when closed)
     resample(tab, n)                  -> n points evenly spaced in arc length (closed: no duplicate end point)
     PATHS                             -> owned preset paths in a 1920 x 1080 box (wave, arc, swoop, loop, spiral, bird) for demos and tests
   Used by type.textOnPath (glyph i at arc length s0(t) + offset_i) and layers.epicycleDraw (DFT of the resampled points). Owned code. */
export function flattenPath(d, { seg = 24 } = {}) {
  const toks = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [], out = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, started = false, last = '';
  const num = () => +toks[i++], push = (px, py) => out.push([px, py]);
  const cubic = (x1, y1, x2, y2, x3, y3) => { for (let k = 1; k <= seg; k++) { const t = k / seg, u = 1 - t; push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3); } };
  const quad = (x1, y1, x2, y2) => { for (let k = 1; k <= seg; k++) { const t = k / seg, u = 1 - t; push(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2); } };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { if (started) break; x = num() + ox; y = num() + oy; sx = x; sy = y; push(x, y); started = true; cmd = rel ? 'l' : 'L'; last = 'M'; continue; }
    if (C === 'Z') { if (x !== sx || y !== sy) push(sx, sy); x = sx; y = sy; last = 'Z'; continue; }
    if (C === 'L') { x = num() + ox; y = num() + oy; push(x, y); }
    else if (C === 'H') { x = num() + ox; push(x, y); }
    else if (C === 'V') { y = num() + oy; push(x, y); }
    else if (C === 'C') { const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy; cubic(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; x = x3; y = y3; }
    else if (C === 'S') { const x1 = 'CS'.includes(last) ? 2 * x - cx : x, y1 = 'CS'.includes(last) ? 2 * y - cy : y, x2 = num() + ox, y2 = num() + oy, x3 = num() + ox, y3 = num() + oy; cubic(x1, y1, x2, y2, x3, y3); cx = x2; cy = y2; x = x3; y = y3; }
    else if (C === 'Q') { const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy; quad(x1, y1, x2, y2); cx = x1; cy = y1; x = x2; y = y2; }
    else if (C === 'T') { const x1 = 'QT'.includes(last) ? 2 * x - cx : x, y1 = 'QT'.includes(last) ? 2 * y - cy : y, x2 = num() + ox, y2 = num() + oy; quad(x1, y1, x2, y2); cx = x1; cy = y1; x = x2; y = y2; }
    else if (C === 'A') { num(); num(); num(); num(); num(); x = num() + ox; y = num() + oy; push(x, y); }
    else { i++; continue; }
    last = C;
  }
  return out.filter((p, k) => k === 0 || p[0] !== out[k - 1][0] || p[1] !== out[k - 1][1]);
}
export function arcTable(pts, closed = false) {
  const P = closed && pts.length > 1 && (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1]) ? [...pts, pts[0]] : pts.slice(), cum = [0];
  for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
  return { pts: P, cum, len: cum.at(-1), closed };
}
export function pointAt(tab, s) {
  const { pts, cum, len } = tab; if (pts.length < 2 || len <= 0) return { x: pts[0]?.[0] ?? 0, y: pts[0]?.[1] ?? 0, a: 0 };
  if (tab.closed) s = ((s % len) + len) % len; else s = Math.min(len, Math.max(0, s));
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const d = cum[hi] - cum[lo] || 1, k = (s - cum[lo]) / d, [x0, y0] = pts[lo], [x1, y1] = pts[hi];
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, a: Math.atan2(y1 - y0, x1 - x0) };
}
export function resample(tab, n) { const m = tab.closed ? n : n - 1; return Array.from({ length: n }, (_, k) => { const q = pointAt(tab, (tab.len * k) / Math.max(1, m)); return [q.x, q.y]; }); }
/* owned preset paths (1920 x 1080 box); bird = a generic stylised bird outline drawn for the pack (not a reference figure) */
export const PATHS = {
  wave: 'M120 640 C420 360 700 360 960 560 S1500 780 1800 470',
  arc: 'M260 780 Q960 120 1660 780',
  swoop: 'M140 860 C520 900 640 380 980 420 C1280 455 1360 720 1780 260',
  loop: 'M160 760 C600 760 820 220 1040 320 C1260 420 1000 760 860 600 C720 440 1200 300 1760 340',
  spiral: 'M960 540 C1000 520 1020 560 990 590 C940 640 870 580 890 520 C915 440 1040 430 1080 520 C1130 640 1000 720 890 690 C760 650 740 480 830 410 C960 310 1150 380 1180 540 C1210 720 1030 820 880 790',
  bird: 'M960 300 C1020 300 1060 340 1070 390 L1150 410 L1075 430 C1080 520 1060 600 1000 650 C1100 640 1220 600 1330 520 C1300 640 1180 740 1020 760 L1000 860 L960 760 L920 860 L900 760 C760 740 660 660 640 560 C720 600 820 630 900 640 C850 590 830 520 840 450 C850 360 900 300 960 300 Z',
};
