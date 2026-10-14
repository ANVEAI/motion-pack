/* motion-pack / layers / canvas2d-r3.js: round-3 Canvas2D layers (2026-10-14). Owned code, no assets. Merged into canvas2d.js K2D, so they mount
   through overlay.js mountStack like every other kind. Pure functions of t (no clock, no random, no history).
     dotCondense   N dots drift in a loose field, then converge on cue into FEWER dots (area-preserving merge), a LINE, or a WORD (text sampled to
                   points once per text/size, cached). Each dot's path is closed form: home position + seeded wobble -> eased lerp to its target,
                   with a seeded start delay. Dots and targets are both sorted left to right before pairing, so the flow reads as one motion.
     hologramBeam  a projector cone from a source point (a character, a device) to a floating window (or a wireframe globe), with concentric
                   shimmer rings travelling along the beam, a source glow, frame-hashed flicker, and the window materialising (vertical scale +
                   scanlines + a sweep band). Screen blend: it reads on dark or mid plates; on a light plate lower `intensity` or use a darker colour.
   dotCondenseState(t, p, {W, H}) and hologramState(t, p) expose the maths (tests, and DOM elements that must follow the beam's window). */
import { E, clamp, lerp, seg, TAU } from './ease.js';

function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const hexRGB = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(4)})`;
const SANS = "Manrope, 'Helvetica Neue', Arial, sans-serif";
const makeCanvas = (g, w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const d = g && g.canvas && g.canvas.ownerDocument; if (!d || !d.createElement) return null; const c = d.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------------- dotCondense ---------------- */
const wordCache = new Map();
/* points (px) covering `text`, about `want` of them, on a lattice inside the glyphs. Needs a canvas (browser); null otherwise. */
export function wordPoints(g, text, { W, H, size = 0.24, weight = 800, center = [0.5, 0.5], want = 160, font = SANS } = {}) {
  const key = [text, W, H, size, weight, center, want, font].join('|'); if (wordCache.has(key)) return wordCache.get(key);
  const q = 4, cw = Math.ceil(W / q), ch = Math.ceil(H / q), c = makeCanvas(g, cw, ch); if (!c) return null;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${weight} ${(size * H / q).toFixed(2)}px ${font}`; x.fillText(text, center[0] * cw, center[1] * ch);
  const d = x.getImageData(0, 0, cw, ch).data, filled = []; for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) if (d[(y * cw + xx) * 4] > 127) filled.push([xx, y]);
  const step = Math.max(1, Math.round(Math.sqrt(filled.length / Math.max(1, want)))); let pts = filled.filter(([a, b]) => a % step === 0 && b % step === 0).map(([a, b]) => [(a + 0.5) * q, (b + 0.5) * q]);
  if (pts.length > want) { const k = pts.length / want; pts = Array.from({ length: want }, (_, i) => pts[Math.floor(i * k)]); }
  wordCache.set(key, pts); return pts;
}
/* targets (px) for mode fewer | line | word */
function targets(g, p, W, H) {
  const S = H / 1080, n = Math.max(1, Math.round(p.n));
  if (p.to === 'word') { const want = Math.round(p.count ?? n), pts = wordPoints(g, p.text, { W, H, size: p.size, weight: p.weight, center: p.center, want }); if (pts && pts.length) return pts; }
  if (p.to === 'line' || p.to === 'word') { const m = Math.max(2, Math.round(p.count ?? 24)), [x0, y0, x1, y1] = p.line; return Array.from({ length: m }, (_, i) => [lerp(x0, x1, i / (m - 1)) * W, lerp(y0, y1, i / (m - 1)) * H]); }
  /* fewer: a centred grid of `count` dots, `gap` px @1080 apart */
  const m = Math.max(1, Math.round(p.count ?? 20)), cols = Math.max(1, Math.round(p.cols ?? Math.ceil(Math.sqrt(m * 2.2)))), rows = Math.ceil(m / cols), gap = p.gap * S;
  return Array.from({ length: m }, (_, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, m - r * cols), c = i - r * cols; return [p.center[0] * W + (c - (inRow - 1) / 2) * gap, p.center[1] * H + (r - (rows - 1) / 2) * gap]; });
}
const plans = new Map();
function plan(g, p, W, H) {
  const key = JSON.stringify([p.n, p.to, p.count, p.cols, p.gap, p.text, p.size, p.weight, p.center, p.line, p.field, p.seed, W, H]); if (plans.has(key)) return plans.get(key);
  const n = Math.max(1, Math.round(p.n)), T = targets(g, p, W, H), [fx, fy, fw, fh] = p.field;
  const home = Array.from({ length: n }, (_, i) => [(fx + fw * hashf(p.seed, i, 1)) * W, (fy + fh * hashf(p.seed, i, 2)) * H]);
  const byX = (pts) => pts.map((q, i) => [q, i]).sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[1] - b[1]).map((x) => x[1]);
  const dOrd = byX(home), tOrd = byX(T), tgt = new Array(n), mult = new Array(T.length).fill(0);
  dOrd.forEach((di, rank) => { const ti = tOrd[Math.min(T.length - 1, Math.floor(rank * T.length / n))]; tgt[di] = ti; mult[ti]++; });
  const out = { home, T, tgt, mult }; plans.set(key, out); return out;
}
/* state at t: [{ x, y, r, k }] per dot (px, k = arrival 0..1) */
export function dotCondenseState(t, pIn, { W = 1920, H = 1080, g = null } = {}) {
  const p = { ...K2D_R3.dotCondense.d, ...pIn }, S = H / 1080, P = plan(g, p, W, H), ease = E[p.ease] || E.hero, r0 = p.radius * S;
  return P.home.map(([hx, hy], i) => {
    const h = (k) => hashf(p.seed, i, k), w = p.drift * S, wx = hx + w * Math.sin(TAU * ((0.11 + 0.17 * h(3)) * t + h(4))), wy = hy + w * Math.cos(TAU * ((0.09 + 0.15 * h(5)) * t + h(6)));
    const d0 = p.at + p.stagger * h(7), k = ease(seg(t, d0, d0 + p.dur)), [tx, ty] = P.T[P.tgt[i]];
    const rEnd = p.endRadius != null ? p.endRadius * S : p.to === 'fewer' ? r0 * Math.sqrt(P.mult[P.tgt[i]]) : p.to === 'word' ? r0 * 1.35 : r0;
    return { x: lerp(wx, tx, k), y: lerp(wy, ty, k), r: lerp(r0, rEnd, k), k };
  });
}

/* ---------------- hologramBeam ---------------- */
/* beam = how far the cone has reached the window (0..1), win = how far the window has materialised (0..1), flick = this frame's flicker gain */
export function hologramState(t, pIn = {}) {
  const p = { ...K2D_R3.hologramBeam.d, ...pIn }, u = t - p.at;
  const beam = E.expoOut(seg(u, 0, p.on * 0.6)), win = E.hero(seg(u, p.on * 0.35, p.on)), f = Math.floor(t * p.fps + 1e-6);
  return { beam, win, flick: 1 - p.flicker * hashf(p.seed, f, 3) };
}

export const K2D_R3 = {
  dotCondense: { blend: 'normal', order: 57, tags: ['dots', 'particles', 'condense', 'converge', 'word', 'data', 'explainer', 'method'],
    d: { n: 220, to: 'fewer', count: null, cols: null, gap: 46, text: 'one idea', size: 0.26, weight: 800, center: [0.5, 0.5], line: [0.2, 0.5, 0.8, 0.5], field: [0.06, 0.1, 0.88, 0.8],
      at: 1.0, dur: 1.2, stagger: 0.45, ease: 'hero', radius: 4, endRadius: null, drift: 10, color: '#141218', toColor: null, intensity: 1, seed: 5 },
    doc: 'n dots in `field` (fractions x, y, w, h) converge from at (+ seeded delay up to stagger s) over dur: to fewer (count dots on a centred grid, gap px @1080, merged dots grow by sqrt of how many landed), line ([x0, y0, x1, y1] fractions, count points) or word (text, size = cap height fraction of H, center); radius px @1080; drift = wobble px; toColor tints arrivals',
    draw(g, W, H, t, p) {
      const st = dotCondenseState(t, p, { W, H, g }), c0 = hexRGB(p.color), c1 = p.toColor ? hexRGB(p.toColor) : null;
      if (!c1) { g.fillStyle = rgba(c0, p.intensity); g.beginPath(); for (const d of st) { g.moveTo(d.x + d.r, d.y); g.arc(d.x, d.y, d.r, 0, TAU); } g.fill(); return; }
      const B = 8, buckets = Array.from({ length: B + 1 }, () => []); for (const d of st) buckets[Math.round(d.k * B)].push(d);
      buckets.forEach((ds, j) => { if (!ds.length) return; const k = j / B; g.fillStyle = rgba(c0.map((v, i) => Math.round(lerp(v, c1[i], k))), p.intensity); g.beginPath(); for (const d of ds) { g.moveTo(d.x + d.r, d.y); g.arc(d.x, d.y, d.r, 0, TAU); } g.fill(); });
    } },
  hologramBeam: { blend: 'screen', order: 20, tags: ['hologram', 'beam', 'projector', 'sci-fi', 'mascot', 'window', 'globe', 'glow'],
    d: { from: [0.2, 0.8], rect: [0.48, 0.16, 0.4, 0.5], mode: 'window', color: '#7FE7FF', at: 0, on: 0.6, intensity: 0.85, rings: 7, speed: 0.6, scan: 140, flicker: 0.12, fps: 30,
      fill: 0.1, radius: 16, spin: 0.12, seed: 2 },
    doc: 'from = source point (fractions); rect = window [x, y, w, h] fractions; mode window | globe (wireframe globe inscribed in rect); at / on = power-on start and length (s); rings = shimmer rings along the beam, speed = rings per second; scan = scanlines per frame height inside the window; flicker 0..1 per frame (hashed); fill = window tint alpha; radius px @1080; spin = globe turns per second',
    draw(g, W, H, t, p) {
      if (t < p.at) return;
      const S = H / 1080, C = hexRGB(p.color), I = p.intensity, st = hologramState(t, p), sx = p.from[0] * W, sy = p.from[1] * H;
      const [rx, ry, rw, rh0] = [p.rect[0] * W, p.rect[1] * H, p.rect[2] * W, p.rect[3] * H], cy = ry + rh0 / 2, rh = Math.max(1, rh0 * Math.max(0.02, st.win)), cx = rx + rw / 2;
      const corners = p.mode === 'globe' ? (() => { const R = Math.min(rw, rh0) / 2 * Math.max(0.02, st.win); return Array.from({ length: 16 }, (_, i) => [cx + R * Math.cos(TAU * i / 16), cy + R * Math.sin(TAU * i / 16)]); })()
        : [[rx, cy - rh / 2], [rx + rw, cy - rh / 2], [rx + rw, cy + rh / 2], [rx, cy + rh / 2]];
      /* the cone: source -> the two silhouette corners (extreme angles about the source -> centre axis) */
      const ax = Math.atan2(cy - sy, cx - sx), ang = (q) => { let a = Math.atan2(q[1] - sy, q[0] - sx) - ax; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
      let lo = corners[0], hi = corners[0]; for (const q of corners) { if (ang(q) < ang(lo)) lo = q; if (ang(q) > ang(hi)) hi = q; }
      const b = st.beam, A = [lerp(sx, lo[0], b), lerp(sy, lo[1], b)], Bq = [lerp(sx, hi[0], b), lerp(sy, hi[1], b)], len = Math.hypot(cx - sx, cy - sy) * b, f = st.flick;
      g.save();
      if (p.mode !== 'globe') { g.beginPath(); g.rect(0, 0, W, H); g.roundRect(rx, cy - rh / 2, rw, rh, Math.min(p.radius * S, rh / 2, rw / 2)); g.clip('evenodd'); }   // the cone ends on the window outline
      const lg = g.createLinearGradient(sx, sy, lerp(sx, cx, b), lerp(sy, cy, b)); lg.addColorStop(0, rgba(C, 0.5 * I * f)); lg.addColorStop(1, rgba(C, 0.14 * I * f));
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(A[0], A[1]); g.lineTo(Bq[0], Bq[1]); g.closePath(); g.fillStyle = lg; g.fill();
      g.save(); g.clip();   // shimmer rings travelling out along the beam
      g.lineWidth = 2.2 * S; for (let k = 0; k < p.rings; k++) { const s = (k / p.rings + t * p.speed / p.rings) % 1, r = s * len; if (r < 4) continue; g.strokeStyle = rgba(C, 0.28 * I * f * Math.sin(Math.PI * s)); g.beginPath(); g.arc(sx, sy, r, ax - 1.2, ax + 1.2); g.stroke(); }
      g.restore();
      g.lineWidth = 2 * S; for (const q of [A, Bq]) { const eg = g.createLinearGradient(sx, sy, q[0], q[1]); eg.addColorStop(0, rgba(C, 0.85 * I * f)); eg.addColorStop(1, rgba(C, 0.25 * I * f)); g.strokeStyle = eg; g.beginPath(); g.moveTo(sx, sy); g.lineTo(q[0], q[1]); g.stroke(); }
      if (p.mode !== 'globe') { g.restore(); g.save(); }
      const sr = 46 * S, sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, rgba([255, 255, 255], 0.9 * I * f)); sg.addColorStop(0.25, rgba(C, 0.7 * I * f)); sg.addColorStop(1, rgba(C, 0)); g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, 2 * sr, 2 * sr);
      if (st.win > 0.001) {
        const wa = I * f * st.win;
        if (p.mode === 'globe') {
          const R = Math.min(rw, rh0) / 2 * st.win, sp = TAU * p.spin * t; g.lineWidth = 1.8 * S; g.strokeStyle = rgba(C, 0.85 * wa); g.shadowColor = rgba(C, 0.9); g.shadowBlur = 14 * S;
          g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.shadowBlur = 0; g.strokeStyle = rgba(C, 0.5 * wa);
          for (let k = -2; k <= 2; k++) { const ph = k * Math.PI / 6, yy = cy + R * Math.sin(ph), xr = R * Math.cos(ph); g.beginPath(); g.ellipse(cx, yy, xr, xr * 0.16, 0, 0, TAU); g.stroke(); }
          for (let m = 0; m < 6; m++) { const a = sp + m * Math.PI / 6, xr = R * Math.abs(Math.sin(a)); g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, xr), R, 0, 0, TAU); g.stroke(); }
        } else {
          const y0 = cy - rh / 2, rr = Math.min(p.radius * S, rh / 2, rw / 2);
          g.beginPath(); g.roundRect(rx, y0, rw, rh, rr); g.fillStyle = rgba(C, p.fill * wa); g.fill();
          g.save(); g.clip(); const pitch = Math.max(2, H / p.scan); g.fillStyle = rgba(C, 0.07 * wa); for (let y = y0 + ((t * 40 * S) % pitch); y < y0 + rh; y += pitch) g.fillRect(rx, y, rw, Math.max(1, pitch * 0.35));
          const sw = ((t * p.speed * 0.5) % 1) * (rh + 60 * S) - 30 * S, bg2 = g.createLinearGradient(0, y0 + sw - 30 * S, 0, y0 + sw + 30 * S); bg2.addColorStop(0, rgba(C, 0)); bg2.addColorStop(0.5, rgba(C, 0.22 * wa)); bg2.addColorStop(1, rgba(C, 0));
          g.fillStyle = bg2; g.fillRect(rx, y0 + sw - 30 * S, rw, 60 * S); g.restore();
          g.lineWidth = 2.4 * S; g.strokeStyle = rgba(C, 0.95 * wa); g.shadowColor = rgba(C, 0.9); g.shadowBlur = 18 * S; g.beginPath(); g.roundRect(rx, y0, rw, rh, rr); g.stroke(); g.shadowBlur = 0;
        }
      }
      g.restore();
    } },
};
