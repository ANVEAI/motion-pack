/* motion-pack / type / gfx / cards.js: image-card systems (2026-10-14). Owned code; placeholder pictures are procedural (no third-party photos).
     layout.cardStack  a fanned stack that riffles: cards flip back -> front one after another and land on top; inline in a sentence or centred.
     layout.cardRiver  diagonal streams of cards crossing the frame, seeded layout, keep-out rects so words sit still in the gaps,
                       exact multi-sample motion blur (each shutter sample drawn opaque, then accumulated with 'lighter' at 1/S: a box filter).
   Pure state (node-testable, seek-safe):  cardsAt(id, t, params, {W, H}) -> [{ x, y, w, h, rot, sx, face, img, z, alpha, lift }]
     x, y = card centre px; rot = degrees; sx = horizontal squash of the flip (|cos|); face = 'back' | 'front'; img = image index; z = draw order.
   Canvas back-end:  drawCards(g, cards, images, p)  |  renderCards(g, id, t, params, {W, H}, images)  (adds motion blur when params.samples > 1)
   Mount:            mountCards(root, id, params, {W, H, images}) -> { canvas, render(t) }   (one <canvas> per system; bind with gfx bindHF)
   Images: CanvasImageSource or URL strings (loaded once at mount; mount at module run so the page's load event waits for them),
           or placeholderCards(n, seed) -> procedural "photo" canvases (abstract landscapes and shapes, clearly illustrations). */
import { E, clamp, lerp, seg, mulberry32 } from '../ease.js';

const D2R = Math.PI / 180;
export const hash = (...k) => { let h = 2166136261 >>> 0; for (const v of k) { h ^= Math.imul((v * 1000) | 0, 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; };
const mod = (a, n) => ((a % n) + n) % n;

/* ---------------- cardStack ---------------- */
function stackAt(t, p, { W, H }) {
  const S = H / 1080, n = p.n, h = p.cardH * S, w = h * p.aspect, mid = (n - 1) / 2, out = [];
  const flips = p.count ?? n, cx = p.x * W, cy = p.y * H;
  for (let i = 0; i < n; i++) {
    const enter = E.pop(seg(t, p.enterAt + i * p.enterStagger, p.enterAt + i * p.enterStagger + 0.35)); if (enter <= 0) continue;
    // the flip events this card owns: k = i, i + n, i + 2n, ... (k < flips); the latest one that has started drives it
    let k = -1; for (let q = i; q < flips; q += n) if (t >= p.riffleAt + q * p.every) k = q;
    let face = 'back', img = -1, sx = 1, lift = 0, z = i, rot = (i - mid) * p.fan + (hash(p.seed, i, 1) - 0.5) * p.jitter, dx = (i - mid) * p.spread * S, dy = -Math.abs(i - mid) * 2 * S;
    if (k >= 0) {
      const u = seg(t, p.riffleAt + k * p.every, p.riffleAt + k * p.every + p.flipDur), prev = k - n >= 0 ? (k - n) % p.images : -1;
      sx = Math.abs(Math.cos(Math.PI * u)); lift = Math.sin(Math.PI * u) * p.lift * S;
      face = u < 0.5 ? (prev < 0 ? 'back' : 'front') : 'front'; img = u < 0.5 ? prev : k % p.images;
      z = n + k;                                              // a flipped card lands on top of everything flipped before it
      const r2 = (hash(p.seed, k, 2) - 0.5) * p.landJitter;   // it lands with a fresh small angle, so the pile reads as riffled, not re-ordered
      rot = lerp(rot, r2, E.soft(u)); dx = lerp(dx, (hash(p.seed, k, 3) - 0.5) * p.spread * S, E.soft(u)); dy = lerp(dy, 0, E.soft(u));
    }
    const ex = p.exitAt != null ? 1 - E.exit(seg(t, p.exitAt, p.exitAt + 0.25)) : 1; if (ex <= 0) continue;
    const sc = enter * ex * (1 + 0.05 * Math.sin(Math.PI * clamp(lift / Math.max(1e-6, p.lift * S))));
    out.push({ x: cx + dx, y: cy + dy - lift, w: w * sc, h: h * sc, rot, sx, face, img, z, alpha: 1, lift });
  }
  return out.sort((a, b) => a.z - b.z);
}

/* ---------------- cardRiver ---------------- */
/* along-lane position (px) of a card: linear travel from t0; fill = the lane starts full (cards already in frame) */
function laneS(t, p, s0, P, span, S) {
  const v = p.speed * S, tau = t - p.t0;
  if (p.fill) return mod(s0 + v * tau + P / 2, P) - P / 2;
  const u = -span / 2 - P + s0 + v * tau;                    // queued behind the entry edge, then streams through and wraps
  return u < -P / 2 ? u : mod(u + P / 2, P) - P / 2;
}
function riverAt(t, p, { W, H }) {
  const S = H / 1080, th = p.angle * D2R, d = [Math.cos(th), Math.sin(th)], nrm = [-d[1], d[0]], span = Math.hypot(W, H) + 2 * p.cardH * S * 1.5;
  const C = [p.cx * W, p.cy * H], out = [];
  const keep = (p.keepOut || []).map((r) => { const rc = [r.x * W, r.y * H], hw = r.w * W / 2 + p.margin * S, hh = r.h * H / 2 + p.margin * S;
    const cs = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], pd = cs.map(([a, b]) => a * d[0] + b * d[1]), pn = cs.map(([a, b]) => a * nrm[0] + b * nrm[1]);
    return { rc, d0: Math.min(...pd), d1: Math.max(...pd), n0: Math.min(...pn), n1: Math.max(...pn) }; });
  p.lanes.forEach((lane, l) => {
    const off = (typeof lane === 'number' ? lane : lane.off) * H, cnt = Math.ceil(span / (p.spacing * S)) + 1, P = cnt * p.spacing * S;
    const dir = (typeof lane === 'object' && lane.dir) || 1, spd = (typeof lane === 'object' && lane.speed) || 1;
    for (let i = 0; i < cnt; i++) {
      const r = (q) => hash(p.seed, l, i, q), s0 = i * p.spacing * S + (r(1) - 0.5) * p.spacing * S * 0.35;
      let s = laneS(t, { ...p, speed: p.speed * spd }, s0, P, span, S) * dir; if (Math.abs(s) > span / 2 + P) continue;
      let q = off + (r(2) - 0.5) * p.wobble * S;
      const sz = lerp(1 - p.sizeJitter, 1 + p.sizeJitter, r(3)), h = p.cardH * S * sz, w = h * (r(6) < p.landscape ? 1 / p.aspect : p.aspect), rad = Math.hypot(w, h) / 2;
      // flow around keep-out rects: push the card along the lane normal, eased by how far along the lane it is from the rect (a stone in a river)
      for (const k of keep) {
        const rel = [C[0] + d[0] * s + nrm[0] * q - k.rc[0], C[1] + d[1] * s + nrm[1] * q - k.rc[1]], dd = rel[0] * d[0] + rel[1] * d[1], nn = rel[0] * nrm[0] + rel[1] * nrm[1];
        const out1 = dd < k.d0 ? k.d0 - dd : dd > k.d1 ? dd - k.d1 : 0, wgt = 1 - clamp((out1 - rad * 0.3) / (p.soft * S)), tgt = nn >= (k.n0 + k.n1) / 2 ? Math.max(nn, k.n1 + rad) : Math.min(nn, k.n0 - rad);
        q += (tgt - nn) * (wgt > 0 ? wgt * wgt * (3 - 2 * wgt) : 0);
      }
      const x = C[0] + d[0] * s + nrm[0] * q, y = C[1] + d[1] * s + nrm[1] * q;
      if (x < -rad * 2 || x > W + rad * 2 || y < -rad * 2 || y > H + rad * 2) continue;
      const fade = p.fadeAt != null ? 1 - E.exit(seg(t, p.fadeAt, p.fadeAt + 0.3)) : 1;
      out.push({ x, y, w, h, rot: (r(4) - 0.5) * 2 * p.rotJitter, sx: 1, face: 'front', img: Math.floor(r(5) * p.images), z: sz * 100 + l, alpha: fade, lift: 0 });
    }
  });
  return out.sort((a, b) => a.z - b.z);
}

const STACK_D = { x: 0.5, y: 0.5, n: 6, cardH: 300, aspect: 0.78, fan: 4, spread: 10, jitter: 3, landJitter: 8, lift: 26, enterAt: 0, enterStagger: 0.04, riffleAt: 0.5, every: 0.14, flipDur: 0.22, count: null, images: 8, exitAt: null, seed: 3, radius: 18, border: 0, borderColor: '#FFFFFF', back: '#4A18ED', backInk: '#FFFFFF', shadow: 0.28, samples: 1, shutter: 0.5 };
const RIVER_D = { angle: -28, cx: 0.5, cy: 0.5, lanes: [-0.3, 0.3], spacing: 260, cardH: 190, aspect: 0.78, landscape: 0.25, sizeJitter: 0.18, rotJitter: 7, wobble: 70, speed: 520, t0: 0, fill: true, keepOut: [], margin: 40, soft: 220,
  images: 12, fadeAt: null, seed: 7, radius: 16, border: 0, borderColor: '#FFFFFF', back: '#4A18ED', backInk: '#FFFFFF', shadow: 0.22, samples: 6, shutter: 0.5 };
export const CARDS = {
  'layout.cardStack': { tags: ['cards', 'stack', 'riffle', 'flip', 'inline-media', 'photos'], d: STACK_D, at: stackAt, sfx: ['sfx/paper/flip', 'per flip, anchor on the flip start + 1 f'] },
  'layout.cardRiver': { tags: ['cards', 'river', 'stream', 'diagonal', 'motion-blur', 'photos', 'collage'], d: RIVER_D, at: riverAt, sfx: ['sfx/whoosh/swish_s', 'on the river entrance; a soft bed of air under it'] },
};
export const CARD_IDS = Object.keys(CARDS);
export function cardsAt(id, t, params = {}, size = { W: 1920, H: 1080 }) { const c = CARDS[id]; if (!c) throw new Error('unknown card system ' + id); return c.at(t, { ...c.d, ...params }, size); }
/* flip event times of a stack (for the sound cue sheet): [{t, k, card}] */
export function stackFlipTimes(params = {}) { const p = { ...STACK_D, ...params }, n = p.count ?? p.n; return Array.from({ length: n }, (_, k) => ({ t: +(p.riffleAt + k * p.every).toFixed(6), k, card: k % p.n })); }

/* ---------------- canvas back-end ---------------- */
function cover(g, img, w, h) { const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height; if (!iw || !ih) return false;
  const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k; g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, -w / 2, -h / 2, w, h); return true; }
export function drawCardBack(g, w, h, p) {
  g.fillStyle = p.back; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = p.backInk; g.globalAlpha *= 0.22; g.lineWidth = Math.max(1, w * 0.012);
  for (let x = -w; x < w; x += w * 0.09) { g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x + h, h / 2); g.stroke(); }
  g.globalAlpha /= 0.22; g.lineWidth = Math.max(1.5, w * 0.02); g.beginPath(); g.arc(0, 0, w * 0.16, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(w * 0.16, -w * 0.02, w * 0.035, 0, Math.PI * 2); g.fillStyle = p.backInk; g.fill();
}
export function drawCards(g, cards, images, p) {
  for (const c of cards) {
    if (c.alpha <= 0 || c.sx < 0.002 || c.w < 1) continue; const r = Math.min(p.radius * c.h / 300, c.w / 2), b = p.border * c.h / 300;
    g.save(); g.globalAlpha = c.alpha; g.translate(c.x, c.y); g.rotate(c.rot * D2R); g.scale(c.sx, 1);
    if (p.shadow > 0) { g.shadowColor = `rgba(0,0,0,${(p.shadow * (1 + c.lift / 60)).toFixed(3)})`; g.shadowBlur = c.h * (0.08 + c.lift / 900); g.shadowOffsetY = c.h * (0.03 + c.lift / 1200); }
    g.beginPath(); g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, r); g.fillStyle = b > 0 ? p.borderColor : '#DDDBD6'; g.fill(); g.shadowColor = 'transparent';
    g.save(); g.beginPath(); g.roundRect(-c.w / 2 + b, -c.h / 2 + b, c.w - 2 * b, c.h - 2 * b, Math.max(0, r - b)); g.clip();
    const img = c.img >= 0 ? images[c.img % Math.max(1, images.length)] : null;
    if (c.face === 'back' || !img || !cover(g, img, c.w - 2 * b, c.h - 2 * b)) drawCardBack(g, c.w - 2 * b, c.h - 2 * b, p);
    if (c.sx < 0.999) { g.fillStyle = `rgba(0,0,0,${(0.35 * (1 - c.sx)).toFixed(3)})`; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); }   // edge-on darkening sells the flip
    g.restore(); g.restore();
  }
}
let scratch = null;
/* draw one system at t; params.samples > 1 = multi-sample motion blur over params.shutter frames (centred on t), exact box filter */
export function renderCards(g, id, t, params, size, images, fps = 30) {
  const c = CARDS[id], p = { ...c.d, ...params }, n = Math.max(1, p.samples | 0);
  if (n === 1) { drawCards(g, c.at(t, p, size), images, p); return; }
  const cv = g.canvas; if (!scratch || scratch.width !== cv.width || scratch.height !== cv.height) { scratch = document.createElement('canvas'); scratch.width = cv.width; scratch.height = cv.height; }
  const sg = scratch.getContext('2d'); g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) { const ts = t + p.shutter / fps * ((k + 0.5) / n - 0.5); sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, scratch.width, scratch.height); drawCards(sg, c.at(ts, p, size), images, p); g.globalAlpha = 1 / n; g.drawImage(scratch, 0, 0); }
  g.restore();
}

/* ---------------- procedural placeholder pictures (owned; abstract, so nobody mistakes them for real photos) ---------------- */
const PAL = [['#FFB38A', '#FF6B6B', '#3D2C8D'], ['#9AD0F5', '#3E7CB1', '#F7E7CE'], ['#C5E8B7', '#2E8B57', '#F4D35E'], ['#F6C1D0', '#B83B5E', '#6A2C70'], ['#FFE29A', '#F08A4B', '#2B2D42'],
  ['#B8B5FF', '#4A18ED', '#EDEEF7'], ['#A0E7E5', '#0F7173', '#FBE7C6'], ['#FFD6A5', '#9B5DE5', '#00BBF9'], ['#E9E3D5', '#7D5A50', '#B4846C'], ['#D0F4DE', '#FF99C8', '#5E548E']];
export function placeholderCard(seed, { w = 480, h = 600, kind = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = mulberry32(seed * 7919 + 11), pal = PAL[seed % PAL.length], kd = kind || ['land', 'sun', 'shapes', 'stripes', 'arch'][seed % 5];
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (kd === 'land' || kd === 'sun') {
    g.fillStyle = kd === 'sun' ? '#FFF4D6' : pal[1]; g.beginPath(); g.arc(w * (0.25 + 0.5 * r()), h * (0.22 + 0.15 * r()), w * (0.1 + 0.08 * r()), 0, Math.PI * 2); g.fill();
    for (let L = 0; L < 3; L++) { g.fillStyle = L === 2 ? pal[1] : L === 1 ? pal[2] : pal[1] + '99'; g.beginPath(); g.moveTo(0, h); const y0 = h * (0.5 + 0.13 * L), a = h * (0.05 + 0.05 * r()), f = 1 + 2 * r(), ph = r() * 6;
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + a * Math.sin(x / w * Math.PI * f + ph)); g.lineTo(w, h); g.fill(); }
  } else if (kd === 'shapes') { for (let i = 0; i < 6; i++) { g.fillStyle = pal[i % 3] === pal[0] ? '#FFFFFF' : pal[(i + 1) % 3]; g.globalAlpha = 0.85; g.beginPath(); const R = w * (0.08 + 0.18 * r());
      if (i % 2) g.arc(w * r(), h * r(), R, 0, Math.PI * 2); else g.roundRect(w * r() - R, h * r() - R, 2 * R, 2 * R, R * 0.3); g.fill(); } g.globalAlpha = 1; }
  else if (kd === 'stripes') { g.save(); g.translate(w / 2, h / 2); g.rotate(-0.5 + r()); for (let i = -8; i < 8; i++) { g.fillStyle = i % 2 ? pal[1] : '#FFFFFF'; g.globalAlpha = i % 2 ? 0.9 : 0.35; g.fillRect(i * w * 0.12, -h, w * 0.06, 2 * h); } g.restore(); g.globalAlpha = 1; }
  else { g.fillStyle = pal[1]; g.beginPath(); g.moveTo(w * 0.2, h); g.lineTo(w * 0.2, h * 0.45); g.arc(w / 2, h * 0.45, w * 0.3, Math.PI, 0); g.lineTo(w * 0.8, h); g.fill(); g.fillStyle = '#FFFFFF55'; g.fillRect(0, h * 0.82, w, h * 0.18); }
  g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 400; i++) g.fillRect(r() * w, r() * h, 2, 2);   // seeded speckle so flat colour does not band
  return c;
}
export const placeholderCards = (n, seed = 1, o = {}) => Array.from({ length: n }, (_, i) => placeholderCard(seed * 31 + i, o));
/* URL strings -> HTMLImageElements (started now, so the page load waits); anything else passes through */
export function loadImages(list, onload) { return (list || []).map((s) => { if (typeof s !== 'string') return s; const im = new Image(); im.decoding = 'sync'; if (onload) im.onload = onload; im.src = s; return im; }); }

export function mountCards(root, id, params = {}, { W = 1920, H = 1080, images = null, fps = 30 } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' }); root.appendChild(cv);
  const g = cv.getContext('2d'); let last = 0; const P = { ...CARDS[id].d, ...params };
  const imgs = images ? loadImages(images, () => api.render(last)) : placeholderCards(P.images, P.seed);
  const api = { canvas: cv, images: imgs, render(t) { last = t; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); renderCards(g, id, t, { ...params, images: imgs.length }, { W, H }, imgs, fps); return this; } };
  return api;
}
