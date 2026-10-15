/* motion-pack / layers / backgrounds.js: opaque procedural BACKGROUND fields drawn with Canvas2D (2026-10-14). Owned code, no assets.
   They sit at the bottom of a shot (order 1) and carry type: one accent colour on a light field (or the reverse).
     gridTunnel  perspective wireframe tunnel converging on a vanishing point: longitudinal lines on 4 walls + cross-section rings that drift
                 towards the camera (closed form: ring k sits at z = zNear + (k + 1 - frac(t * drift)) so the state at t needs no history),
                 optional slow zoom, depth fog at the vanishing point.
     dotGrid     regular dot field anchored on the frame centre, optional drift, radial edge fade, a clear hole behind type and a radial glow.
     meshGradient (2026-10-14, round 3) soft mesh / aurora field: 3-8 colour blobs (gaussian-like radial falloff) drifting on closed-form
                 Lissajous paths (loop: L makes every frequency a multiple of 1/L, so the field repeats exactly), optional vertical sky base,
                 optional seeded grain (a 256 px noise tile re-offset per grain frame by a hash of the frame number). Palettes: MESH_PALETTES.
     auroraRibbon (2026-10-15, round 6; backgrounds-r6.js) a bottom-anchored glowing ribbon in brand colours that rises on cue (riseAt) and drifts; loop: exact seam.
   Same layer contract as overlay.js / canvas2d.js (canvas + mix-blend-mode, render(t, {frame})); mounted through overlay.js mountStack:
     mountStack(el, [{ kind: 'gridTunnel', params: { color: '#4A18ED', bg: '#F5F2EA' } }], { width, height, fps })
   Sizes are px at 1080 (scaled by H / 1080), so 16:9 and 9:16 share numbers. Pure functions of t: no clock, no random. */
import { BG_R6 } from './backgrounds-r6.js';   // round 6 (2026-10-15): auroraRibbon
import { BG_LIM, guardKinds } from './limits.js';
const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, a)).toFixed(4)})`; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;
function hashf(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
/* meshGradient palettes: colours of the blobs (first = the dominant one), the base fill, and the base mode */
export const MESH_PALETTES = {
  peach: { colors: ['#FFC9A6', '#F6A6C8', '#C7B5FF', '#FFE2C2', '#FFB38A'], bg: '#FFF0E3' },
  lilac: { colors: ['#C6B3FF', '#F2C2E4', '#9EB8FF', '#EDE4FF', '#B79CFF'], bg: '#F2EDFF' },
  sky: { colors: ['#86B8FF', '#BCD8FF', '#FFD3B5', '#FFB0C4'], bg: '#A9CBFF', base: 'vertical' },
  dusk: { colors: ['#6A2C8C', '#E0457B', '#FF9E6B', '#2B2A72', '#9B3FB0'], bg: '#1C1533' },
  mint: { colors: ['#A6EFD6', '#BCE0FF', '#FFF0B8', '#D2F7E8'], bg: '#EEFFF8' },
  ink: { colors: ['#2A1E5C', '#4A18ED', '#123048', '#3B1470'], bg: '#0B0B10' },
};
/* seeded grain tile (256 px, mid-grey +- noise); null where no canvas can be made (node tests): the field still draws, without grain */
const grainTiles = new Map();
function grainTile(g, seed) {
  if (grainTiles.has(seed)) return grainTiles.get(seed);
  const doc = g && g.canvas && g.canvas.ownerDocument; let c = null;
  if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(256, 256); else if (doc && doc.createElement) { c = doc.createElement('canvas'); c.width = c.height = 256; }
  if (!c) return null;
  const x = c.getContext('2d'), im = x.createImageData(256, 256);
  for (let i = 0; i < 65536; i++) { const v = Math.round(128 + (hashf(seed, i, 7) + hashf(seed, i, 11) - 1) * 127); im.data[4 * i] = im.data[4 * i + 1] = im.data[4 * i + 2] = v; im.data[4 * i + 3] = 255; }
  x.putImageData(im, 0, 0); grainTiles.set(seed, c); return c;
}
/* blob i of meshGradient at t: centre (fractions of W, H) and radius (fraction of the frame diagonal). Closed form. */
export function meshBlob(i, t, p) {
  const h = (k) => hashf(p.seed, i, k), n = Math.max(1, Math.round(p.blobs)), L = p.loop > 0 ? p.loop : 0;
  const a0 = TAU * (i / n) + 0.9 * h(1), hx = 0.5 + 0.3 * Math.cos(a0) * (0.6 + 0.4 * h(2)), hy = 0.5 + 0.3 * Math.sin(a0) * (0.6 + 0.4 * h(2));
  const f1 = L ? (1 + Math.floor(h(3) * 2)) / L : p.speed * (0.7 + 0.6 * h(3)), f2 = L ? (1 + Math.floor(h(4) * 3)) / L : p.speed * (1.1 + 0.8 * h(4)), f3 = L ? 1 / L : p.speed * (0.5 + 0.5 * h(9));
  const x = hx + p.travel * (0.75 * Math.sin(TAU * (f1 * t + h(5))) + 0.25 * Math.sin(TAU * (f2 * t + h(6))))* 0.85;
  const y = hy + p.travel * (0.75 * Math.cos(TAU * (f1 * t + h(7))) + 0.25 * Math.sin(TAU * (f2 * t + h(8))));
  const r = 0.5 * p.size * (0.8 + 0.4 * h(10)) * (1 + 0.08 * Math.sin(TAU * (f3 * t + h(11))));
  return { x, y, r };
}

export const BG = {
  gridTunnel: { blend: 'normal', order: 1, tags: ['grid', 'tunnel', 'perspective', 'wireframe', 'background', 'launch', 'tech'],
    d: { color: '#4A18ED', bg: '#F5F2EA', lines: 8, depth: 12, drift: 0.5, zoom: 0, vp: [0.5, 0.5], width: 2, fade: 0.9, intensity: 1 },
    doc: 'lines = longitudinal lines per wall, depth = rings in view, drift = rings per second towards the camera (0 = still), zoom = focal growth per second, vp = vanishing point (fractions), width = line px @1080, fade = fog at the vanishing point',
    draw(g, W, H, t, p) {
      const S = H / 1080, cx = p.vp[0] * W, cy = p.vp[1] * H, f = (H / 2) * (1 + p.zoom * t), X = W / H, Y = 1, zN = 0.6, zF = zN + p.depth;
      const P = (x, y, z) => [cx + (x / z) * f, cy + (y / z) * f];
      g.fillStyle = p.bg; g.fillRect(0, 0, W, H); g.lineWidth = p.width * S; g.lineJoin = 'miter'; g.strokeStyle = rgba(p.color, p.intensity);
      /* longitudinal lines: n + 1 per wall (corners shared), from far behind the camera plane to the far end */
      const n = Math.max(1, Math.round(p.lines)); g.beginPath();
      for (let i = 0; i <= n; i++) { const u = -1 + (2 * i) / n;
        for (const [x, y] of [[u * X, -Y], [u * X, Y], [-X, u * Y], [X, u * Y]]) { const a = P(x, y, 0.05), b = P(x, y, zF); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } }
      g.stroke();
      /* rings: drift towards the camera; each fades in at the far end and out as it passes the near plane */
      const ph = frac(t * p.drift);
      for (let k = 0; k <= p.depth; k++) { const z = zN + (k + 1 - ph); if (z > zF) continue;
        const a = p.intensity * sstep(0, 1, zF - z) * sstep(0, 0.4, z - zN), [x0, y0] = P(-X, -Y, z), [x1, y1] = P(X, Y, z); if (a <= 0.002) continue;
        g.strokeStyle = rgba(p.color, a); g.strokeRect(x0, y0, x1 - x0, y1 - y0); }
      /* depth fog: the background colour gathers at the vanishing point */
      if (p.fade > 0) { const R = (f * Y) / (zN + 2.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, rgba(p.bg, p.fade)); gr.addColorStop(0.55, rgba(p.bg, p.fade * 0.6)); gr.addColorStop(1, rgba(p.bg, 0));
        g.fillStyle = gr; g.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
    } },
  dotGrid: { blend: 'normal', order: 1, tags: ['dots', 'grid', 'pattern', 'background', 'glow', 'tech', 'clean'],
    d: { color: '#4A18ED', bg: '#F5F2EA', spacing: 36, radius: 3, drift: [0, 0], fade: 0.5, hole: 0, glow: 0.5, glowColor: null, glowAt: [0.5, 0.5], glowRadius: 0.55, intensity: 1 },
    doc: 'spacing / radius px @1080; drift px/s @1080; fade = dots fade toward the edges (0..1); hole = clear radius around glowAt (fraction of H) for type; glow = radial gradient strength behind the dots (glowColor defaults to color, glowRadius fraction of the frame diagonal)',
    draw(g, W, H, t, p) {
      const S = H / 1080, sp = Math.max(4, p.spacing * S), r = Math.max(0.5, p.radius * S), gx = p.glowAt[0] * W, gy = p.glowAt[1] * H, diag = Math.hypot(W, H) / 2;
      g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
      if (p.glow > 0) { const R = p.glowRadius * diag * 2, gr = g.createRadialGradient(gx, gy, 0, gx, gy, R), c = p.glowColor || p.color;
        gr.addColorStop(0, rgba(c, 0.55 * p.glow)); gr.addColorStop(0.45, rgba(c, 0.22 * p.glow)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      /* dots on a lattice through the frame centre, shifted by drift * t (wrapped to one cell) */
      const ox = frac((W / 2 + p.drift[0] * S * t) / sp) * sp, oy = frac((H / 2 + p.drift[1] * S * t) / sp) * sp, LV = 12, buckets = Array.from({ length: LV + 1 }, () => []);
      for (let y = oy - sp; y < H + sp; y += sp) for (let x = ox - sp; x < W + sp; x += sp) {
        const e = Math.hypot(x - W / 2, y - H / 2) / diag, hd = p.hole > 0 ? Math.hypot(x - gx, y - gy) / (p.hole * H) : 9;
        const a = (1 - p.fade * sstep(0.3, 1.0, e)) * sstep(0.7, 1.15, hd); if (a > 0.004) buckets[Math.round(a * LV)].push(x, y); }
      buckets.forEach((pts, k) => { if (!pts.length || !k) return; g.fillStyle = rgba(p.color, p.intensity * k / LV); g.beginPath();
        for (let i = 0; i < pts.length; i += 2) { g.moveTo(pts[i] + r, pts[i + 1]); g.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2); } g.fill(); });
    } },
  meshGradient: { blend: 'normal', order: 1, tags: ['mesh', 'gradient', 'aurora', 'soft', 'background', 'saas', 'launch', 'calm'],
    d: { palette: 'peach', colors: null, bg: null, base: null, blobs: 5, size: 0.62, travel: 0.16, speed: 0.05, loop: 0, seed: 3, grain: 0.04, grainFps: 24, intensity: 1 },
    doc: 'palette peach | lilac | sky | dusk | mint | ink (or colors: [3-8 hex] + bg); base flat | vertical (sky); blobs = count; size = blob radius as a fraction of the frame diagonal; travel = path amplitude (fraction of H); speed = Hz of the slowest path; loop = seconds for an exact repeat (0 = free); grain = noise amount (0 = off), re-seeded grainFps times per second',
    draw(g, W, H, t, p) {
      const P = MESH_PALETTES[p.palette] || MESH_PALETTES.peach, cols = p.colors && p.colors.length ? p.colors : P.colors, bg = p.bg || P.bg, base = p.base || P.base || 'flat', D = Math.hypot(W, H);
      if (base === 'vertical') { const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, cols[0]); lg.addColorStop(1, cols[cols.length - 1]); g.fillStyle = lg; } else g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.min(8, Math.round(p.blobs)));
      for (let i = 0; i < n; i++) { const b = meshBlob(i, t, p), cx = b.x * W, cy = b.y * H, R = b.r * D, gr = g.createRadialGradient(cx, cy, 0, cx, cy, R), c = cols[i % cols.length];
        for (let k = 0; k <= 6; k++) { const s = k / 6; gr.addColorStop(s, rgba(c, p.intensity * (1 - s * s) ** 2)); }
        g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      if (p.grain > 0) { const tile = grainTile(g, p.seed >>> 0); if (tile) { const f = Math.floor(t * p.grainFps + 1e-6), ox = Math.floor(hashf(p.seed, f, 1) * 256), oy = Math.floor(hashf(p.seed, f, 2) * 256);
        g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = Math.min(1, p.grain * 4); g.translate(-ox, -oy); g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(ox, oy, W, H); g.restore(); } }
    } },
};
Object.assign(BG, BG_R6);
guardKinds(BG, BG_LIM);   // draw sanitises p first (layers/limits.js)
export const BG_KINDS = Object.keys(BG);

export class BackgroundLayer {
  constructor(canvas, kind, params = {}, { width = 1920, height = 1080, fps = 30, seed = 1 } = {}) {
    if (!BG[kind]) throw new Error('unknown background kind ' + kind);
    this.kind = kind; this.canvas = canvas; this.W = canvas.width = width; this.H = canvas.height = height; this.fps = fps; this.seed = seed; this.g = canvas.getContext('2d');
    this.setParams(params); canvas.style.mixBlendMode = BG[kind].blend; canvas.dataset.mpKind = kind;
  }
  setParams(p) { this.p = { ...BG[this.kind].d, ...p }; return this; }
  render(t, { frame } = {}) { const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.W, this.H); BG[this.kind].draw(g, this.W, this.H, frame != null ? frame / this.fps : t, this.p); return this; }
}
