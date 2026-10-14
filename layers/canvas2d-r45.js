/* motion-pack / layers / canvas2d-r45.js: round 4/5 Canvas2D layers (2026-10-14). Owned code, no assets. Merged into canvas2d.js K2D, so they mount
   through overlay.js mountStack like every other kind. Pure functions of t (no clock, no Math.random, no history); seeded hashes only.
     embeddingCloud  a 3D point cloud of dots and media thumbnails in seeded clusters, slowly rotating (closed-form projection); a query chip flies in, its k
                     nearest neighbours (precomputed once from the query vector, no per-frame search) light up and lift toward the camera with thin
                     similarity lines; optional collapse of every point onto a mark's outline. loop: L makes the rotation repeat exactly every L s.
     epicycleDraw    a Fourier-epicycle drawing of any SVG path: DFT of the arc-length-resampled path (computed once, cached), chained rotating circles
                     whose tip traces the path; N terms per step (steps re-trace at higher fidelity), trail drawn from the analytic curve (not accumulated),
                     optional inset of the circles around the tip, a glow stroke and an N / error readout.
     hexMosaic       a field of hex tiles (flat colours, an owned engraved-line texture, or images you pass) that flip in waves from a point; a product
                     panel can float above. loop: L repeats the waves exactly every L s (a brand-texture background).
     convergeToDot   a flat paper-style network (hollow nodes, small dots, thin lines) that contracts into one solid dot ("many -> one"), or blooms from it
                     (reverse). Lines are recomputed from the node positions every frame (stateless). Pair with overlay `paper` for grain.
   embeddingState / epicycleState / hexState / convergeState expose the maths (tests, and DOM elements that must follow a point).
   Images (embeddingCloud, hexMosaic): loaded once per source and shared; preloadImages(srcs) / mountStack(...).ready() resolve when they are decoded (await before the first frame). */
import { E, clamp, lerp, seg, TAU } from './ease.js';
import { flattenPath, arcTable, resample, PATHS } from '../type/gfx/pathsample.js';
import { DEFAULT_MARK } from '../type/gfx/media.js';

function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const hexRGB = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(4)})`;
const mixC = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))));
const gauss = (a, b) => Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(TAU * b);
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace", SANS = "Manrope, 'Helvetica Neue', Arial, sans-serif";
const textW = (g, s, px) => { const m = typeof g.measureText === 'function' ? g.measureText(s) : null; return m && m.width > 0 ? m.width : s.length * px * 0.56; };
/* images: ONE load per source, shared by every frame, so a frame is a pure function of t once preloadImages() has resolved (await it, or stack.ready(), before the first
   frame, as with fonts). A string source loads through new Image() exactly once; an object (ImageBitmap, canvas, a loaded <img>) passes through. Until a source is decoded, or if it
   failed, its placeholder is drawn (never a half state), and a failed source stays a placeholder for good. */
const imgCache = new Map();
function loadImg(src) {
  let e = imgCache.get(src); if (e) return e; e = { im: null, ok: false }; imgCache.set(src, e);
  if (typeof Image === 'undefined') { e.p = Promise.resolve(e); return e; }
  const im = new Image(), fin = (ok) => { e.ok = ok && im.naturalWidth > 0; return e; }; e.im = im;
  e.p = new Promise((res) => { im.onload = () => (im.decode ? im.decode().then(() => res(fin(true)), () => res(fin(true))) : res(fin(true))); im.onerror = () => res(fin(false)); }); im.src = src; return e;
}
export const imgOf = (src) => { if (!src) return null; if (typeof src === 'object') return src.naturalWidth || src.width ? src : null; const e = loadImg(src); return e.ok ? e.im : null; };
/* resolves when every string source is decoded (or failed); layers call it from setParams, mountStack(...).ready() waits for all of them */
export const preloadImages = (srcs = []) => Promise.all([...new Set((srcs || []).filter((x) => typeof x === 'string'))].map((x) => loadImg(x).p));
/* loop phase: frame-exact so t and t + L give the same bits */
const loopPhase = (t, L, fps = 30) => { const F = Math.round(L * fps), f = Math.round(t * fps); return (((f % F) + F) % F) / F; };
const THUMB_PAL = [['#F7D9B5', '#FF7A3D', '#3E7C59'], ['#CFE6FF', '#FFD23A', '#2B4BA8'], ['#FFE3EC', '#FF4F7B', '#5B2EA6'], ['#E8F5E1', '#2BD9A0', '#2F6B3E'], ['#FFF1C9', '#FF9F1C', '#7A2E1E'], ['#DFF6F4', '#00B3A4', '#1F3A93']];

/* ---------------- embeddingCloud ---------------- */
const cloudPlans = new Map();
export function cloudPlan(p, W, H) {
  const key = JSON.stringify([p.n, p.clusters, p.spread, p.thumbs, p.seed, p.queryCluster, p.k, p.to, p.markSize, p.mark, p.center, W, H]); if (cloudPlans.has(key)) return cloudPlans.get(key);
  const nT = Math.min(48, Math.max(0, Math.round(p.thumbs))), n = Math.max(1, Math.round(p.n)) + nT, C = Math.max(1, Math.round(p.clusters)), s = p.seed;
  const cen = Array.from({ length: C }, (_, j) => { const a = TAU * hashf(s, j, 1), b = Math.acos(2 * hashf(s, j, 2) - 1), r = 0.62 * Math.cbrt(0.35 + 0.65 * hashf(s, j, 3)); return [r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * 0.8, r * Math.sin(b) * Math.sin(a)]; });
  const pts = Array.from({ length: n }, (_, i) => { const j = i % C, o = [0, 1, 2].map((d) => gauss(hashf(s, i, 10 + d), hashf(s, i, 20 + d)) * p.spread); return { pos: cen[j].map((v, d) => v + o[d]), cl: j, thumb: i >= n - nT, ti: i - (n - nT), pal: Math.floor(hashf(s, i, 30) * THUMB_PAL.length) }; });
  const qc = cen[(p.queryCluster ?? 0) % C], q = qc.map((v, d) => v + 0.4 * p.spread * gauss(hashf(s, 99, d), hashf(s, 98, d)));
  const order = pts.map((pt, i) => [Math.hypot(pt.pos[0] - q[0], pt.pos[1] - q[1], pt.pos[2] - q[2]), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const nn = order.slice(0, Math.max(1, Math.round(p.k))).map(([, i]) => i), rank = new Map(nn.map((i, r) => [i, r]));
  const S = H / 1080, cx = p.center[0] * W, cy = p.center[1] * H, m = arcTable(flattenPath(p.mark || DEFAULT_MARK, { seg: 16 }), true), ms = (p.markSize * H) / 100;
  const tgt = resample(m, n).map(([x, y]) => [cx + (x - 50) * ms, cy + (y - 50) * ms]);
  const out = { pts, q, nn, rank, tgt, S }; cloudPlans.set(key, out); return out;
}
/* screen state at t: points [{ x, y, z, r, a, thumb, nb (neighbour rank or -1), lit (0..1) }], chip { x, y, k }. Closed form. */
export function embeddingState(t, pIn, { W = 1920, H = 1080 } = {}) {
  const p = { ...K2D_R45.embeddingCloud.d, ...pIn }, P = cloudPlan(p, W, H), S = P.S, R = p.radius * H, cx = p.center[0] * W, cy = p.center[1] * H;
  const th = p.loop > 0 ? TAU * loopPhase(t, p.loop, p.fps) : TAU * p.spin * t, ct = Math.cos(th), st = Math.sin(th), cxr = Math.cos(p.tilt), sxr = Math.sin(p.tilt);
  const kq = p.queryAt == null ? 0 : E.hero(seg(t, p.queryAt, p.queryAt + p.queryDur)), kl = p.queryAt == null ? 0 : E.hero(seg(t, p.queryAt + p.queryDur * 0.6, p.queryAt + p.queryDur * 0.6 + p.liftDur));
  const proj = ([x, y, z], dz = 0) => { const x1 = x * ct + z * st, z1 = -x * st + z * ct, y2 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr + dz, k = p.fov / (p.fov - z2); return { x: cx + x1 * R * k, y: cy + y2 * R * k, z: z2, k }; };
  const pts = P.pts.map((pt, i) => { const nb = P.rank.has(i) ? P.rank.get(i) : -1, lit = nb >= 0 ? kl * clamp(1.4 - nb * 0.06) : 0, q = proj(pt.pos, nb >= 0 ? p.lift * kl : 0);
    const kc = p.collapseAt == null ? 0 : E.cam(seg(t, p.collapseAt + 0.35 * hashf(p.seed, i, 40), p.collapseAt + 0.35 * hashf(p.seed, i, 40) + p.collapse)), [tx, ty] = P.tgt[i];
    const base = (pt.thumb ? p.thumbSize : p.dot) * S * q.k * (1 + 0.6 * lit), r = lerp(base, p.dot * S * 1.1, pt.thumb ? kc : kc * 0.5), a = clamp(0.35 + 0.65 * (q.z + 1) / 2) * (1 - 0.6 * kq * (nb < 0 ? 1 : 0)) + lit * 0.5;
    return { x: lerp(q.x, tx, kc), y: lerp(q.y, ty, kc), z: q.z, r, a: clamp(lerp(a, 1, kc)), thumb: pt.thumb, ti: pt.ti, pal: pt.pal, nb, lit, kc }; });
  const qp = proj(P.q), chip = { x: lerp(cx, qp.x, kq), y: lerp(-0.1 * H, qp.y - 70 * S, kq), k: kq, tx: qp.x, ty: qp.y };
  return { pts, chip, kq, kl };
}

/* ---------------- epicycleDraw ---------------- */
const dftCache = new Map(), curveCache = new Map();
/* the DFT of the path: { coef: [{ k, re, im, amp }] sorted by amplitude (k = 0 first), M, pts (px, resampled input), ref (px, the input path as drawn), size } */
export function epicycleDFT(p, W, H) {
  const d = Array.isArray(p.path) ? null : PATHS[p.path] || p.path, key = JSON.stringify([d || p.path, p.samples, p.pathBox, p.closed, p.scale, p.center, W, H]); if (dftCache.has(key)) return dftCache.get(key);
  const [bw, bh] = p.pathBox, s = Math.min(W / bw, H / bh) * p.scale, ox = p.center[0] * W - (bw * s) / 2, oy = p.center[1] * H - (bh * s) / 2;
  const raw = (Array.isArray(p.path) ? p.path : flattenPath(d, { seg: 48 })).map(([x, y]) => [ox + x * s, oy + y * s]), M = Math.max(8, 2 * Math.round(p.samples / 2));
  /* a Fourier series is periodic: a closed outline is sampled once round; an OPEN path (closed: false) is traced there and back along itself, so no chord is drawn between its ends */
  const closed = p.closed === 'auto' || p.closed == null ? (d ? /z\s*$/i.test(d.trim()) : false) || Math.hypot(raw[0][0] - raw.at(-1)[0], raw[0][1] - raw.at(-1)[1]) < 1 : p.closed !== false;
  let pts; if (closed) pts = resample(arcTable(raw, true), M); else { const f = resample(arcTable(raw, false), M / 2 + 1); pts = [...f, ...f.slice(1, -1).reverse()]; }
  const coef = []; for (let k = -Math.floor(M / 2); k < Math.ceil(M / 2); k++) { let re = 0, im = 0; for (let n = 0; n < M; n++) { const a = (-TAU * k * n) / M, c = Math.cos(a), sn = Math.sin(a); re += pts[n][0] * c - pts[n][1] * sn; im += pts[n][0] * sn + pts[n][1] * c; } coef.push({ k, re: re / M, im: im / M, amp: Math.hypot(re, im) / M }); }
  coef.sort((a, b) => (a.k === 0 ? -1 : b.k === 0 ? 1 : b.amp - a.amp || a.k - b.k));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const ref = closed && Math.hypot(raw[0][0] - raw.at(-1)[0], raw[0][1] - raw.at(-1)[1]) > 1e-9 ? [...raw, raw[0]] : raw;   /* the input path itself (px), what the error is measured against */
  const out = { coef, M, pts, ref, closed, size: Math.hypot(x1 - x0, y1 - y0), key }; dftCache.set(key, out); return out;
}
/* tip of the first N terms at phase phi (0..1, one trace) */
export function epicycleTip(D, N, phi) { let x = 0, y = 0; for (let j = 0; j < Math.min(N, D.coef.length); j++) { const c = D.coef[j], a = TAU * c.k * phi, cs = Math.cos(a), sn = Math.sin(a); x += c.re * cs - c.im * sn; y += c.re * sn + c.im * cs; } return [x, y]; }
/* the analytic curve for N terms, sampled once at R phases (+ its mean distance from the INPUT PATH (every segment of it, not just the DFT's samples), % of the figure's diagonal) */
const segDist = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)); return Math.hypot(x - a[0] - k * dx, y - a[1] - k * dy); };
export function epicycleCurve(D, N, R = 1440) {
  const key = D.key + '|' + N + '|' + R; if (curveCache.has(key)) return curveCache.get(key);
  const pts = Array.from({ length: R + 1 }, (_, i) => epicycleTip(D, N, i / R)); let e = 0; for (let i = 0; i < R; i++) { const [x, y] = pts[i]; let m = Infinity; for (let j = 0; j < D.ref.length - 1; j++) m = Math.min(m, segDist(x, y, D.ref[j], D.ref[j + 1])); e += m; }
  const out = { pts, R, err: (100 * e) / R / Math.max(1, D.size) }; curveCache.set(key, out); return out;
}
/* the error as printed: two decimals, or '<0.01' once it is below what two decimals can show (never a bare 0.00) */
export const errText = (e) => (e < 0.01 ? '<0.01' : e.toFixed(2));
const termsOf = (v, D) => (v === 'full' ? D.coef.length : Math.max(1, Math.min(D.coef.length, Math.round(v))));
/* state at t: { N, phi, step, tip: [x, y], progressive } */
export function epicycleState(t, pIn, { W = 1920, H = 1080 } = {}) {
  const p = { ...K2D_R45.epicycleDraw.d, ...pIn }, D = epicycleDFT(p, W, H), steps = p.steps && p.steps.length ? p.steps : [[0, p.terms]];
  let j = 0; for (let i = 0; i < steps.length; i++) if (t >= p.at + steps[i][0]) j = i; const N = termsOf(steps[j][1], D), u = t - p.at - steps[j][0];
  const phi = p.loop && steps.length === 1 ? loopPhase(t - p.at, p.period, p.fps) : Math.max(0, u) / p.period;
  return { D, N, phi, step: j, tip: epicycleTip(D, N, phi % 1), first: !(p.loop && steps.length === 1) && phi < 1, on: t >= p.at };
}

/* ---------------- hexMosaic ---------------- */
const hexPlans = new Map();
function hexPlan(p, W, H) {
  const key = JSON.stringify([p.radius, p.gap, W, H, p.seed]); if (hexPlans.has(key)) return hexPlans.get(key);
  const S = H / 1080, r = p.radius * S, w = Math.sqrt(3) * r, tiles = [], rows = Math.ceil(H / (1.5 * r)) + 2, cols = Math.ceil(W / w) + 2;
  for (let row = -1; row < rows; row++) for (let col = -1; col < cols; col++) { const x = col * w + (row & 1 ? w / 2 : 0), y = row * 1.5 * r; tiles.push({ x, y, i: tiles.length, h: hashf(p.seed, row, col) }); }
  const out = { tiles, r, S }; hexPlans.set(key, out); return out;
}
/* wave times: explicit [{ at, from, speed }] or, with loop L, one wave every L / faces from loopFrom (infinite both ways, frame-exact) */
export function hexState(t, pIn, { W = 1920, H = 1080 } = {}) {
  const p = { ...K2D_R45.hexMosaic.d, ...pIn }, P = hexPlan(p, W, H), nF = Math.max(1, p.faces.length);
  const tt = p.loop > 0 ? loopPhase(t, p.loop, p.fps) * p.loop : t;
  return P.tiles.map((tl) => {
    let n = 0, last = -1e9;
    if (p.loop > 0) { const ev = p.loop / nF, [fx, fy] = p.loopFrom, d = Math.hypot(tl.x - fx * W, tl.y - fy * H) / (p.speed * P.S) + 0.08 * tl.h; n = Math.floor((tt - d) / ev); last = n * ev + d; }
    else for (const wv of p.waves) { const [fx, fy] = wv.from || [0, 0.5], tw = wv.at + Math.hypot(tl.x - fx * W, tl.y - fy * H) / ((wv.speed ?? p.speed) * P.S) + 0.08 * tl.h; if (t >= tw) { n++; last = tw; } }
    const k = seg(tt, last, last + p.flip), cur = ((n % nF) + nF) % nF, prev = (((n - 1) % nF) + nF) % nF;
    return { x: tl.x, y: tl.y, h: tl.h, i: tl.i, face: k < 0.5 && (p.loop > 0 || n > 0) ? prev : cur, sx: Math.abs(Math.cos(Math.PI * k)), k };
  });
}

/* ---------------- convergeToDot ---------------- */
const netPlans = new Map();
function netPlan(p, W, H) {
  const key = JSON.stringify([p.nodes, p.field, p.center, p.seed, p.links, W, H]); if (netPlans.has(key)) return netPlans.get(key);
  const S = H / 1080, cx = p.center[0] * W, cy = p.center[1] * H, R = p.field * H, n = Math.max(2, Math.round(p.nodes));
  const nodes = Array.from({ length: n }, (_, i) => { if (!i) return { x: cx, y: cy, r: p.hub, d: 0, kind: 'hub' };
    const a = TAU * hashf(p.seed, i, 1), rr = R * (0.25 + 0.75 * Math.sqrt(hashf(p.seed, i, 2))), x = cx + Math.cos(a) * rr * (W > H ? 1.35 : 1), y = cy + Math.sin(a) * rr;
    return { x, y, r: hashf(p.seed, i, 3) < 0.35 ? 3 + 2 * hashf(p.seed, i, 4) : 7 + 14 * hashf(p.seed, i, 5), d: Math.hypot(x - cx, y - cy), kind: hashf(p.seed, i, 3) < 0.35 ? 'dot' : 'ring' }; });
  const dmax = Math.max(...nodes.map((q) => q.d)) || 1, edges = [];
  nodes.forEach((q, i) => { if (!i) return; if (hashf(p.seed, i, 6) < 0.55) edges.push([0, i]);
    const near = nodes.map((o, j) => [Math.hypot(o.x - q.x, o.y - q.y), j]).filter(([, j]) => j && j !== i).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let m = 0; m < p.links && m < near.length; m++) if (hashf(p.seed, i, 7 + m) < 0.6) { const e = [Math.min(i, near[m][1]), Math.max(i, near[m][1])]; if (!edges.some((x) => x[0] === e[0] && x[1] === e[1])) edges.push(e); } });
  if (!edges.some((e) => e[0] === 0)) edges.push([0, 1]);
  const out = { nodes, edges, dmax, S, cx, cy }; netPlans.set(key, out); return out;
}
/* node positions at t: [{ x, y, r, k }] + the hub radius. k = 0 home, 1 merged into the dot. Outer nodes leave first (order 'outside-in'). */
export function convergeState(t, pIn, { W = 1920, H = 1080 } = {}) {
  const p = { ...K2D_R45.convergeToDot.d, ...pIn }, P = netPlan(p, W, H), S = P.S, ease = E[p.ease] || E.move;
  const nodes = P.nodes.map((q, i) => { if (!i) return { x: q.x, y: q.y, r: q.r * S, k: 0, kind: q.kind };
    const rd = q.d / P.dmax, dl = p.stagger * (p.order === 'inside-out' ? rd : 1 - rd), kk = ease(seg(t, p.at + dl, p.at + dl + p.dur)), k = p.reverse ? 1 - ease(seg(t, p.at + p.stagger - dl, p.at + p.stagger - dl + p.dur)) : kk;
    const w = p.wobble * S * (1 - k), wx = w * Math.sin(TAU * (0.13 + 0.1 * hashf(p.seed, i, 8)) * t + TAU * hashf(p.seed, i, 9)), wy = w * Math.cos(TAU * (0.11 + 0.1 * hashf(p.seed, i, 10)) * t + TAU * hashf(p.seed, i, 11));
    return { x: lerp(q.x + wx, P.cx, k), y: lerp(q.y + wy, P.cy, k), r: q.r * S * (1 - k) ** 0.6, k, kind: q.kind }; });
  const done = nodes.slice(1).reduce((a, q) => a + q.k, 0) / Math.max(1, nodes.length - 1), hub = lerp(p.hub, p.dot, E.soft(done)) * S;
  return { nodes, edges: P.edges, hub, done };
}

const hexPath = (g, x, y, r, sx = 1) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const px = x + r * Math.cos(a) * sx, py = y + r * Math.sin(a); if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
export const K2D_R45 = {
  embeddingCloud: { blend: 'normal', order: 40, tags: ['embedding', 'vector-space', 'point-cloud', '3d', 'search', 'retrieval', 'nearest-neighbours', 'ai', 'explainer'],
    d: { n: 260, clusters: 6, spread: 0.13, thumbs: 22, thumbSize: 34, dot: 2.8, radius: 0.55, center: [0.5, 0.52], spin: 0.03, loop: 0, fps: 30, tilt: 0.28, fov: 2.6, color: '#9FE3B4', accent: '#FFE07A',
      query: 'a dog on the beach', queryAt: 1.0, queryDur: 0.7, liftDur: 0.6, k: 6, lift: 0.45, queryCluster: 0, lines: true, chipBg: 'rgba(14,20,16,0.82)', chipInk: '#FFFFFF',
      collapseAt: null, collapse: 0.9, markSize: 0.34, mark: null, images: [], intensity: 1, seed: 3 },
    doc: 'n dots + thumbs (<= 48) media tiles in `clusters` seeded gaussian clusters (spread), radius = cloud radius (fraction of H), spin turns/s (or loop: L s per exact turn), tilt rad, fov camera distance in radii; query chip text flies in at queryAt, the k nearest neighbours (precomputed) lift by `lift` toward the camera with lines; collapseAt: every point lands on the outline of `mark` (an SVG path d in a 100 box, e.g. your icon or logo; null = the pack placeholder mark; markSize = its height as a fraction of H); images: optional thumbnail sources (URLs / data URLs, or decoded images; each point always shows the same one). Await stack.ready() before the first frame, like fonts: until a source is decoded its tile is a placeholder, after that every frame draws the image',
    assets: (p) => p.images,   // sources the layer preloads (Canvas2DLayer.ready / mountStack(...).ready)
    draw(g, W, H, t, p) {
      const st = embeddingState(t, p, { W, H }), S = H / 1080, C = hexRGB(p.color), A = hexRGB(p.accent), I = p.intensity;
      g.fillStyle = rgba(C, 0.8 * I); g.beginPath(); let any = false;
      for (const q of st.pts) if (!q.thumb && q.nb < 0) { g.moveTo(q.x + q.r, q.y); g.arc(q.x, q.y, q.r, 0, TAU); any = true; }
      if (any) { g.globalAlpha = 1; g.fill(); }
      if (p.lines && st.kl > 0 && st.kq > 0.99) { g.lineWidth = 1.2 * S; for (const q of st.pts) if (q.nb >= 0 && q.kc < 0.5) { const kk = clamp(st.kl * 1.3 - q.nb * 0.05); if (kk <= 0) continue;
        g.strokeStyle = rgba(A, 0.55 * I * (1 - q.kc * 2)); g.beginPath(); g.moveTo(st.chip.tx, st.chip.ty); g.lineTo(lerp(st.chip.tx, q.x, kk), lerp(st.chip.ty, q.y, kk)); g.stroke(); } }
      const th = st.pts.filter((q) => q.thumb || q.nb >= 0).sort((a, b) => a.z - b.z || a.nb - b.nb);
      for (const q of th) { g.globalAlpha = clamp(q.a * I);
        if (q.thumb) { const w = q.r * 2 * 1.33, h = q.r * 2, im = imgOf(p.images && p.images.length ? p.images[q.ti % p.images.length] : null), P = THUMB_PAL[q.pal];
          if (q.kc > 0.6) { g.fillStyle = rgba(mixC(C, A, q.lit), 1); g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.fill(); continue; }
          g.save(); g.beginPath(); g.roundRect(q.x - w / 2, q.y - h / 2, w, h, 3 * S); g.clip();
          if (im) g.drawImage(im, q.x - w / 2, q.y - h / 2, w, h); else { g.fillStyle = P[0]; g.fillRect(q.x - w / 2, q.y - h / 2, w, h); g.fillStyle = P[1]; g.beginPath(); g.arc(q.x + w * 0.2, q.y - h * 0.15, h * 0.16, 0, TAU); g.fill(); g.fillStyle = P[2]; g.fillRect(q.x - w / 2, q.y + h * 0.12, w, h * 0.4); }
          g.restore(); if (q.lit > 0.01) { g.strokeStyle = rgba(A, q.lit * I); g.lineWidth = 2 * S; g.beginPath(); g.roundRect(q.x - w / 2, q.y - h / 2, w, h, 3 * S); g.stroke(); } }
        else { g.fillStyle = rgba(mixC(C, A, q.lit), 1); g.beginPath(); g.arc(q.x, q.y, q.r * (1 + q.lit), 0, TAU); g.fill(); if (q.lit > 0.05) { g.fillStyle = rgba(A, 0.25 * q.lit); g.beginPath(); g.arc(q.x, q.y, q.r * 4, 0, TAU); g.fill(); } } }
      g.globalAlpha = 1;
      if (p.queryAt != null && st.kq > 0 && p.query) { const px = 26 * S, fh = 30 * S; g.font = `600 ${px.toFixed(1)}px ${SANS}`; const w = textW(g, p.query, px) + 2 * fh, x = st.chip.x - w / 2, y = st.chip.y - fh, a = clamp(st.kq * 2) * I * (1 - (p.collapseAt == null ? 0 : seg(t, p.collapseAt, p.collapseAt + 0.3)));
        if (a > 0.004) { g.globalAlpha = a; g.fillStyle = p.chipBg; g.beginPath(); g.roundRect(x, y, w, 2 * fh, fh); g.fill(); g.strokeStyle = rgba(A, 0.7); g.lineWidth = 1.5 * S; g.stroke();
          g.fillStyle = p.chipInk; g.font = `600 ${px.toFixed(1)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.query, st.chip.x, st.chip.y + 1 * S); g.globalAlpha = 1; } }
    } },
  epicycleDraw: { blend: 'normal', order: 56, tags: ['epicycles', 'fourier', 'math', 'drawing', 'line-art', 'fidelity-ladder', 'explainer', 'glow'],
    d: { path: 'bird', pathBox: [1920, 1080], closed: 'auto', scale: 0.9, center: [0.5, 0.48], samples: 1024, terms: 64, steps: null, period: 4, at: 0, loop: false, fps: 30, trail: 1, progressive: true,
      circles: true, maxCircles: 80, arms: true, inset: null, insetZoom: 4, color: '#8FDBFF', circleColor: '#8FDBFF', width: 2.2, glow: 10, readout: true, readoutAt: [0.5, 0.93], readColor: '#CFEFFF', source: 'mean distance of the drawn curve from the input path', intensity: 1 },
    doc: 'path = an SVG d string, a preset (wave, arc, swoop, loop, spiral, bird) or [[x, y], ...] in pathBox px; closed auto (default: closed when the path ends in z or returns to its start) | true = a closed outline | false = an open path traced there and back (a Fourier series is periodic); samples = DFT size, even (resampled by arc length; sharp corners round off by under 1 px at 1024); terms N (or steps [[t, N | "full"], ...]: each step re-traces at higher fidelity); period = s per trace; loop (single step: exact repeat every period); trail = fraction of the figure kept behind the tip (1 = all); circles / arms / inset [x, y, w, h] fractions + insetZoom; readout prints N, the mean distance of the drawn curve from the INPUT path (every segment of it, not only the samples; N = full is under 0.05%, not exactly 0) and the `source` note under it, always (an empty `source` falls back to the default note; readout: false hides the numbers), type from the shorter frame side, at readoutAt [x, y] (move it up inside a 9:16 safe zone)',
    draw(g, W, H, t, p) {
      const st = epicycleState(t, p, { W, H }); if (!st.on) return; const D = st.D, S = H / 1080, C = hexRGB(p.color), CC = hexRGB(p.circleColor), I = p.intensity, cv = epicycleCurve(D, st.N), R = cv.R;
      const phi = st.phi, f = phi % 1, i1 = Math.floor(f * R), lo = st.first && p.progressive ? Math.max(0, f - p.trail) : f - p.trail;
      const drawCurve = (lw, a) => { const B = 8, span = Math.max(1e-6, f - lo); for (let b = 0; b < B; b++) { const a0 = lo + (span * b) / B, a1 = lo + (span * (b + 1)) / B; if (a1 - a0 <= 0) continue;
        g.strokeStyle = rgba(C, a * I * (p.trail >= 1 ? 1 : 0.15 + (0.85 * (b + 1)) / B)); g.lineWidth = lw; g.beginPath(); let first = true;
        for (let q = Math.floor(a0 * R); q <= Math.ceil(a1 * R); q++) { const qq = ((q % R) + R) % R, [x, y] = cv.pts[qq]; if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
        if (b === B - 1) g.lineTo(st.tip[0], st.tip[1]); g.stroke(); } };
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (p.glow > 0) { g.save(); g.shadowColor = rgba(C, 0.9); g.shadowBlur = p.glow * S; drawCurve(p.width * S * 1.6, 0.5); g.restore(); }
      drawCurve(p.width * S, 1);
      const chain = (tr, sc, lwk) => { let x = 0, y = 0; const nC = Math.min(st.N, p.maxCircles); g.lineWidth = lwk;
        for (let j = 0; j < nC; j++) { const c = D.coef[j], a = TAU * c.k * f, nx = x + c.re * Math.cos(a) - c.im * Math.sin(a), ny = y + c.re * Math.sin(a) + c.im * Math.cos(a);
          if (j > 0 && c.amp * sc > 0.6) { if (p.circles) { g.strokeStyle = rgba(CC, 0.28 * I); g.beginPath(); g.arc(tr(x, y)[0], tr(x, y)[1], c.amp * sc, 0, TAU); g.stroke(); }
            if (p.arms) { g.strokeStyle = rgba(CC, 0.6 * I); g.beginPath(); g.moveTo(...tr(x, y)); g.lineTo(...tr(nx, ny)); g.stroke(); } }
          x = nx; y = ny; } return [x, y]; };
      chain((x, y) => [x, y], 1, 1 * S);
      g.fillStyle = rgba([255, 255, 255], 0.95 * I); g.beginPath(); g.arc(st.tip[0], st.tip[1], 3.2 * S, 0, TAU); g.fill();
      if (p.inset) { const [ix, iy, iw, ih] = [p.inset[0] * W, p.inset[1] * H, p.inset[2] * W, p.inset[3] * H], z = p.insetZoom, tr = (x, y) => [ix + iw / 2 + (x - st.tip[0]) * z, iy + ih / 2 + (y - st.tip[1]) * z];
        g.save(); g.fillStyle = 'rgba(4,10,20,0.72)'; g.strokeStyle = rgba(CC, 0.5 * I); g.lineWidth = 1 * S; g.beginPath(); g.rect(ix, iy, iw, ih); g.fill(); g.stroke(); g.clip();
        g.strokeStyle = rgba(C, 0.9 * I); g.lineWidth = p.width * S; g.beginPath(); for (let q = -60; q <= 0; q++) { const qq = (((i1 + q) % R) + R) % R, pt = tr(...cv.pts[qq]); if (q === -60) g.moveTo(...pt); else g.lineTo(...pt); } g.stroke();
        chain(tr, z, 1 * S); g.restore(); }
      if (p.readout) { const Sr = Math.min(W, H) / 1080, [rx, ry] = p.readoutAt, src = p.source || K2D_R45.epicycleDraw.d.source;   /* type from the shorter side; a printed number always carries its note */
        g.fillStyle = rgba(hexRGB(p.readColor), 0.92 * I); g.font = `600 ${(38 * Sr).toFixed(1)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText(`N = ${st.N}`, rx * W, ry * H - 66 * Sr); g.font = `500 ${(26 * Sr).toFixed(1)}px ${MONO}`; g.fillText(`${st.N} rotating circles  ·  mean error ${errText(cv.err)}% of size`, rx * W, ry * H - 28 * Sr);
        g.fillStyle = rgba(hexRGB(p.readColor), 0.72 * I); g.font = `500 ${(22 * Sr).toFixed(1)}px ${MONO}`; g.fillText(src, rx * W, ry * H + 4 * Sr); }
    } },
  hexMosaic: { blend: 'normal', order: 1, tags: ['hex', 'mosaic', 'tiles', 'texture', 'background', 'brand-texture', 'flip', 'wave', 'engraved'],
    d: { radius: 64, gap: 5, faces: ['color', 'engrave'], palette: ['#3557D6', '#F2B33D', '#E4572E', '#2BB673', '#9B5DE5', '#00A6A6', '#F3F1EC'], texBg: '#E7E4DC', texInk: '#3B3B44', images: [],
      waves: [{ at: 0.3, from: [0, 0.5] }], speed: 1500, flip: 0.32, loop: 0, loopFrom: [0, 0.5], fps: 30, bg: '#F3F1EC', panel: null, intensity: 1, seed: 6 },
    doc: 'radius = hex circumradius px @1080, gap px; faces = sequence of tile faces (color | engrave | image) a wave flips each tile to the next; waves [{ at, from: [x, y] fractions, speed px/s @1080 }]; flip = s per tile flip; loop L: one wave every L / faces from loopFrom, exact repeat (the panel bob then makes a whole number of 4 s swings per loop, so the seam holds with a panel too); images: sources for image faces (clip-path); panel { rect: [x, y, w, h] fractions, color, radius } floats above. Image faces are preloaded like embeddingCloud images (await stack.ready()); the lattice is offset rows of pointy-top hexes (the same geometry as axial coordinates)',
    assets: (p) => (p.faces.includes('image') ? p.images : []),
    draw(g, W, H, t, p) {
      const P = hexPlan(p, W, H), S = P.S, r = P.r - p.gap * S * 0.5, I = p.intensity, tiles = hexState(t, p, { W, H });
      if (p.bg) { g.fillStyle = p.bg; g.fillRect(0, 0, W, H); }
      g.globalAlpha = I;
      for (const tl of tiles) { const face = p.faces[tl.face] || 'color', sx = Math.max(0.02, tl.sx);
        if (face === 'image' && p.images && p.images.length) { const im = imgOf(p.images[tl.i % p.images.length]); g.save(); hexPath(g, tl.x, tl.y, r, sx); g.clip();
          if (im) { const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max((2 * r * sx) / iw, (2 * r) / ih); g.drawImage(im, tl.x - (iw * k) / 2, tl.y - (ih * k) / 2, iw * k, ih * k); } else { g.fillStyle = p.texBg; g.fill(); } g.restore(); continue; }
        if (face === 'engrave') { g.save(); hexPath(g, tl.x, tl.y, r, sx); g.fillStyle = p.texBg; g.fill(); g.clip(); g.strokeStyle = p.texInk; g.lineWidth = 1 * S; g.globalAlpha = I * 0.55;
          const a = Math.PI * tl.h, ca = Math.cos(a), sa = Math.sin(a), sp = (5 + 3 * hashf(tl.i, 2)) * S; g.beginPath(); for (let d = -r; d <= r; d += sp) { g.moveTo(tl.x + ca * d - sa * r, tl.y + sa * d + ca * r); g.lineTo(tl.x + ca * d + sa * r, tl.y + sa * d - ca * r); } g.stroke();
          g.globalAlpha = I; g.lineWidth = 1.6 * S; g.beginPath(); g.arc(tl.x + (hashf(tl.i, 3) - 0.5) * r * 0.5 * sx, tl.y + (hashf(tl.i, 4) - 0.5) * r * 0.5, r * (0.3 + 0.25 * hashf(tl.i, 5)) * sx, 0, TAU); g.stroke(); g.restore(); continue; }
        hexPath(g, tl.x, tl.y, r, sx); g.fillStyle = p.palette[Math.floor(tl.h * p.palette.length) % p.palette.length]; g.fill(); }
      g.globalAlpha = 1;
      if (p.panel) { const pn = { color: '#FFFFFF', radius: 18, bob: 6, ...p.panel }, [px, py, pw, ph] = [pn.rect[0] * W, pn.rect[1] * H + Math.sin(p.loop > 0 ? TAU * Math.max(1, Math.round(p.loop / 4)) * loopPhase(t, p.loop, p.fps) : (TAU * t) / 4) * pn.bob * S, pn.rect[2] * W, pn.rect[3] * H];
        g.save(); g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 40 * S; g.shadowOffsetY = 16 * S; g.fillStyle = pn.color; g.beginPath(); g.roundRect(px, py, pw, ph, pn.radius * S); g.fill(); g.restore();
        g.fillStyle = '#E9E7F0'; g.fillRect(px, py + 46 * S, pw, 1.5 * S); [0.62, 0.48, 0.55, 0.3].forEach((w, i) => { g.fillStyle = i ? '#E3E3EA' : '#4A18ED'; g.beginPath(); g.roundRect(px + 28 * S, py + (78 + i * 34) * S, pw * w, 14 * S, 7 * S); g.fill(); });
        [0, 1, 2].forEach((i) => { g.fillStyle = ['#FF5F57', '#FEBC2E', '#28C840'][i]; g.beginPath(); g.arc(px + (24 + i * 20) * S, py + 23 * S, 6 * S, 0, TAU); g.fill(); }); }
    } },
  convergeToDot: { blend: 'normal', order: 57, tags: ['network', 'nodes', 'converge', 'many-to-one', 'paper', 'flat', 'insert', 'explainer', 'bloom'],
    d: { nodes: 24, field: 0.34, center: [0.5, 0.5], links: 1, hub: 12, dot: 56, at: 0.6, dur: 1.1, stagger: 0.5, order: 'outside-in', ease: 'move', reverse: false, wobble: 6,
      ink: '#6E6E78', line: '#8E8E98', lineW: 1.6, dotColor: '#3557D6', bg: null, intensity: 1, seed: 4 },
    doc: 'nodes seeded in a field (radius fraction of H, wider in 16:9) around center; links = nearest-neighbour edges per node (plus hub edges); hub / dot = start and end radius of the solid dot px @1080; at / dur / stagger (radius-dependent delay; order outside-in | inside-out); reverse blooms the network out of the dot; bg = paper colour or null (transparent)',
    draw(g, W, H, t, p) {
      const st = convergeState(t, p, { W, H }), S = H / 1080, I = p.intensity, L = hexRGB(p.line), K = hexRGB(p.ink);
      if (p.bg) { g.fillStyle = p.bg; g.fillRect(0, 0, W, H); }
      g.lineWidth = p.lineW * S; g.strokeStyle = rgba(L, 0.9 * I); g.beginPath();
      for (const [a, b] of st.edges) { const A = st.nodes[a], B = st.nodes[b]; if (Math.max(A.k, B.k) > 0.985) continue; g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); } g.stroke();
      for (const q of st.nodes.slice(1)) { if (q.r < 0.3) continue; g.globalAlpha = I * clamp(1.2 - q.k);
        if (q.kind === 'dot') { g.fillStyle = rgba(K, 1); g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); g.fill(); }
        else { g.fillStyle = p.bg || '#F3F1EC'; g.strokeStyle = rgba(K, 1); g.lineWidth = 1.8 * S; g.beginPath(); g.arc(q.x, q.y, q.r, 0, TAU); if (p.bg) g.fill(); g.stroke(); } }
      g.globalAlpha = I; g.fillStyle = p.dotColor; g.beginPath(); const n = st.nodes[0]; g.arc(n.x, n.y, st.hub, 0, TAU); g.fill(); g.globalAlpha = 1;
    } },
};
/* one sound per action, as local seconds from the layer's own t (the plan adds the layer's start): cuesR45(kind, params) -> [{ t, id: 'sfx/<cat>/<name>', why }].
   Hit contract: t is the frame of the visual event; the mixer anchors the sample one frame later (gotchas.md). hexMosaic with loop gives none (a background). */
export const CUES_R45 = {
  embeddingCloud: (p) => [...(p.queryAt == null ? [] : [{ t: p.queryAt, id: 'sfx/ui/slide', why: 'the query chip flies in' }, { t: +(p.queryAt + p.queryDur * 0.6 + p.liftDur * 0.5).toFixed(4), id: 'sfx/ui/pop', why: 'the nearest neighbours light up and lift' }]),
    ...(p.collapseAt == null ? [] : [{ t: p.collapseAt, id: 'sfx/sparkle/letter_assemble', why: 'the cloud collapses into the mark' }])],
  epicycleDraw: (p) => (p.steps && p.steps.length ? p.steps : [[0, p.terms]]).map(([t], i) => ({ t: +(p.at + t).toFixed(4), id: i ? 'sfx/ui/tick' : 'sfx/whoosh/swish_xs', why: i ? `step ${i + 1}: the drawing re-traces with more circles` : 'the drawing starts' })),
  hexMosaic: (p) => (p.loop > 0 ? [] : p.waves.map((w) => ({ t: w.at, id: 'sfx/whoosh/swish_s', why: 'a wave flips the tiles' }))),
  convergeToDot: (p) => (p.reverse ? [{ t: p.at, id: 'sfx/whoosh/swish_s', why: 'the dot blooms into a network' }] : [{ t: p.at, id: 'sfx/whoosh/swish_s', why: 'the network starts to contract' }, { t: +(p.at + p.stagger + p.dur).toFixed(4), id: 'sfx/hit/soft', why: 'the last node lands: one dot' }]),
};
export const cuesR45 = (kind, params = {}) => { const f = CUES_R45[kind]; if (!f) throw new Error('no round-4/5 cues for ' + kind); return f({ ...K2D_R45[kind].d, ...params }); };
