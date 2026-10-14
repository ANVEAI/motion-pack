/* motion-pack / type / gfx / board.js: layout.evidenceBoard (2026-10-14), the documentary / comedy "conspiracy board" title device.
   A cork board with pinned photo and paper slots, red string drawn on between the pins, a sticky-note title, and a camera push across it.
   Owned code; the cork, paper and pins are procedural. Pictures come from params images (CanvasImageSource or URL) or cards.js placeholders.
     boardAt(t, p, {W, H}) -> { cam: {cx, cy, zoom}, slots: [{x, y, w, h, rot, k, ...}], strings: [{a:[x,y], b:[x,y], c:[x,y], k}], title: {k, ...} }  (pure, node-testable)
     drawBoard(g, t, p, {W, H}, images)   canvas back-end;   mountBoard(root, params, {W, H, images}) -> { canvas, render(t) }
   Board space: x, y in 0..1 of a board that is p.boardW x p.boardH frame-widths/heights (default 1.25 x 1.25), so the push has room;
   zoom 1 / boardW (0.8) shows the whole board, the default push runs 0.84 -> 1.12.
   Timing: slots pin on at slotsAt + i * stagger (a 9 f drop + settle), strings draw on from stringsAt (stagger, 14 f each), the title note slaps on at title.at. */
import { E, clamp, lerp, seg, mulberry32 } from '../ease.js';
import { placeholderCards, loadImages } from './cards.js';

const D2R = Math.PI / 180;
export const BOARD_D = {
  seed: 5, boardW: 1.25, boardH: 1.25, cork: '#B98A5A', corkDark: '#8C6239', frame: '#4A2F1B', frameW: 0.035,
  slots: [ { x: 0.2, y: 0.24, w: 0.17, h: 0.26, rot: -6, kind: 'photo', img: 0, label: 'EXHIBIT A' }, { x: 0.47, y: 0.18, w: 0.15, h: 0.2, rot: 4, kind: 'paper', lines: 6 },
    { x: 0.77, y: 0.27, w: 0.17, h: 0.24, rot: 7, kind: 'photo', img: 1, label: 'LAST SEEN' }, { x: 0.24, y: 0.7, w: 0.18, h: 0.22, rot: 5, kind: 'paper', lines: 7, redact: true },
    { x: 0.53, y: 0.75, w: 0.16, h: 0.24, rot: -4, kind: 'photo', img: 2, label: '?' }, { x: 0.8, y: 0.72, w: 0.15, h: 0.21, rot: -8, kind: 'photo', img: 3 } ],
  strings: [[0, 1], [1, 2], [0, 3], [3, 4], [4, 2], [4, 5], [1, 4]], string: '#C8102E', sag: 0.06, stringW: 4,
  title: { text: 'WHERE DID IT GO?', sub: 'a documentary', x: 0.5, y: 0.47, size: 0.2, rot: -3, at: 1.1, color: '#FFE45C', ink: '#16130F' },
  slotsAt: 0.0, stagger: 0.12, stringsAt: 0.55, stringStagger: 0.1, stringDur: 14 / 30,
  push: { from: [0.5, 0.5, 0.84], to: [0.48, 0.47, 1.12], at: 0, dur: 3.6, ease: 'cam' }, images: 4, pin: '#D7263D', exitAt: null,
};
/* camera: centre (board fractions) + zoom (1 = the board's frame-sized window fills the frame) */
export function camAt(t, p) { const P = p.push, k = (E[P.ease] || E.cam)(seg(t, P.at, P.at + P.dur)); return { cx: lerp(P.from[0], P.to[0], k), cy: lerp(P.from[1], P.to[1], k), zoom: lerp(P.from[2], P.to[2], k) }; }
const pinOf = (s, W, H, p) => { const bw = p.boardW * W, bh = p.boardH * H, x = s.x * bw, y = s.y * bh, h = s.h * bh, r = s.rot * D2R, oy = -h / 2 + h * 0.07; return [x - Math.sin(r) * oy, y + Math.cos(r) * oy]; };
export function boardAt(t, p, { W, H }) {
  const bw = p.boardW * W, bh = p.boardH * H;
  const slots = p.slots.map((s, i) => { const t0 = p.slotsAt + i * p.stagger, k = seg(t, t0, t0 + 9 / 30), drop = E.hero(k);
    return { ...s, i, k: t >= t0 ? 1 : 0, x: s.x * bw, y: s.y * bh - (1 - drop) * 30 * H / 1080, w: s.w * bw, h: s.h * bh, rot: s.rot + (1 - drop) * 6, scale: lerp(1.12, 1, drop), alpha: clamp(k * 3), pinK: E.pop(seg(t, t0 + 6 / 30, t0 + 14 / 30)) }; });
  const strings = p.strings.map(([a, b], j) => { const A = pinOf(p.slots[a], W, H, p), B = pinOf(p.slots[b], W, H, p), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const t0 = p.stringsAt + j * p.stringStagger; return { a: A, b: B, c: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + p.sag * len * 2], k: E.soft(seg(t, t0, t0 + p.stringDur)) }; });
  const T = p.title, title = T ? { ...T, x: T.x * bw, y: T.y * bh, s: T.size * bh, k: seg(t, T.at, T.at + 8 / 30), pop: E.pop(seg(t, T.at, T.at + 8 / 30)) } : null;
  const fade = p.exitAt != null ? 1 - E.exit(seg(t, p.exitAt, p.exitAt + 0.25)) : 1;
  return { cam: camAt(t, p), bw, bh, slots, strings, title, fade };
}
/* quadratic Bezier A-C-B cut at u (de Casteljau): the drawn-on part of a string */
export function qsplit(A, C, B, u) { const P1 = [lerp(A[0], C[0], u), lerp(A[1], C[1], u)], P2 = [lerp(C[0], B[0], u), lerp(C[1], B[1], u)]; return [A, P1, [lerp(P1[0], P2[0], u), lerp(P1[1], P2[1], u)]]; }

const corkCache = new Map();
function corkTex(p, bw, bh) {
  const key = [p.seed, p.cork, p.corkDark, Math.round(bw), Math.round(bh)].join(); if (corkCache.has(key)) return corkCache.get(key);
  const c = document.createElement('canvas'); c.width = Math.round(bw); c.height = Math.round(bh); const g = c.getContext('2d'), r = mulberry32(p.seed * 131 + 7);
  g.fillStyle = p.cork; g.fillRect(0, 0, c.width, c.height); const n = Math.round(c.width * c.height / 260);
  for (let i = 0; i < n; i++) { const v = r(); g.fillStyle = v < 0.5 ? p.corkDark : v < 0.8 ? '#D6AB78' : '#6E4A2A'; g.globalAlpha = 0.18 + 0.4 * r(); const s = 1 + r() * 3.2; g.fillRect(r() * c.width, r() * c.height, s, s * (0.6 + r())); }
  g.globalAlpha = 1; const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,5,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height); corkCache.set(key, c); return c;
}
function cover(g, img, x, y, w, h) { const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height; if (!iw || !ih) return false; const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k; g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h); return true; }
const FONT = "Manrope, 'Helvetica Neue', Arial, sans-serif";
function drawSlot(g, s, images, p, S) {
  g.save(); g.globalAlpha = s.alpha; g.translate(s.x, s.y); g.rotate(s.rot * D2R); g.scale(s.scale, s.scale);
  g.shadowColor = 'rgba(30,15,0,0.45)'; g.shadowBlur = 18 * S; g.shadowOffsetY = 8 * S; const r = mulberry32(p.seed * 17 + s.i * 101);
  if (s.kind === 'photo') {
    const b = s.w * 0.06, bb = s.label ? s.h * 0.18 : b; g.fillStyle = '#F7F4EC'; g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); g.shadowColor = 'transparent';
    const img = images[(s.img ?? s.i) % Math.max(1, images.length)]; g.fillStyle = '#2A2724'; g.fillRect(-s.w / 2 + b, -s.h / 2 + b, s.w - 2 * b, s.h - b - bb);
    if (img) cover(g, img, -s.w / 2 + b, -s.h / 2 + b, s.w - 2 * b, s.h - b - bb);
    if (s.redactFace) { g.fillStyle = '#0B0B0B'; g.fillRect(-s.w * 0.32, -s.h * 0.22, s.w * 0.64, s.h * 0.08); }
    if (s.label) { g.fillStyle = '#2A2724'; g.font = `700 ${(bb * 0.42).toFixed(1)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.label, 0, s.h / 2 - bb / 2); }
  } else {
    g.fillStyle = s.kind === 'note' ? (s.color || '#FFE45C') : '#FBFAF5'; g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); g.shadowColor = 'transparent';
    if (s.kind !== 'note') { g.strokeStyle = 'rgba(70,110,170,0.35)'; g.lineWidth = 1.5 * S; for (let y = -s.h / 2 + s.h * 0.2; y < s.h / 2 - 4; y += s.h * 0.09) { g.beginPath(); g.moveTo(-s.w / 2, y); g.lineTo(s.w / 2, y); g.stroke(); } }
    const n = s.lines ?? 5; g.lineCap = 'round';
    for (let i = 0; i < n; i++) { const y = -s.h / 2 + s.h * (0.2 + i * 0.09) - 3 * S, w = s.w * (0.5 + 0.35 * r()), red = s.redact && i % 3 === 1;
      g.strokeStyle = red ? '#0B0B0B' : '#3A3A48'; g.lineWidth = (red ? s.h * 0.055 : 2.2 * S); g.beginPath(); g.moveTo(-s.w * 0.4, y); for (let x = 0; x <= w; x += 6 * S) g.lineTo(-s.w * 0.4 + x, y + (red ? 0 : Math.sin(x * 0.11 + i) * 1.6 * S)); g.stroke(); }
    if (s.text) { g.fillStyle = '#16130F'; g.font = `800 ${(s.h * 0.14).toFixed(1)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.text, 0, 0); }
  }
  g.restore();
  if (s.pinK > 0) { const [px, py] = (() => { const oy = -s.h / 2 + s.h * 0.07, rr = s.rot * D2R; return [s.x - Math.sin(rr) * oy, s.y + Math.cos(rr) * oy]; })(), R = 9 * S * s.pinK;
    g.fillStyle = 'rgba(30,10,0,0.35)'; g.beginPath(); g.arc(px + 4 * S, py + 5 * S, R, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(px - R * 0.35, py - R * 0.35, R * 0.1, px, py, R); gr.addColorStop(0, '#FF8A8A'); gr.addColorStop(0.45, p.pin); gr.addColorStop(1, '#6E0A14'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.fill(); }
}
export function drawBoard(g, t, params, { W, H }, images = []) {
  const p = { ...BOARD_D, ...params, title: params.title === null ? null : { ...BOARD_D.title, ...(params.title || {}) }, push: { ...BOARD_D.push, ...(params.push || {}) } }, B = boardAt(t, p, { W, H }), S = H / 1080;
  if (B.fade <= 0) return B;
  g.save(); g.globalAlpha = B.fade;
  // camera: board point (cx, cy) at the frame centre, zoom about it
  g.translate(W / 2, H / 2); g.scale(B.cam.zoom * W / (B.bw / p.boardW), B.cam.zoom * W / (B.bw / p.boardW)); g.translate(-B.cam.cx * B.bw, -B.cam.cy * B.bh);
  const fw = p.frameW * B.bh; g.fillStyle = p.frame; g.fillRect(-fw, -fw, B.bw + 2 * fw, B.bh + 2 * fw); g.drawImage(corkTex(p, B.bw, B.bh), 0, 0, B.bw, B.bh);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 * S; g.strokeRect(0, 0, B.bw, B.bh);
  for (const s of B.slots) if (s.k) drawSlot(g, s, images, p, S);
  g.lineCap = 'round';
  for (const st of B.strings) { if (st.k <= 0) continue; const [A, C, E2] = qsplit(st.a, st.c, st.b, st.k);
    for (const [col, w, o] of [['rgba(40,0,0,0.35)', p.stringW * 1.2, 3], [p.string, p.stringW, 0]]) { g.strokeStyle = col; g.lineWidth = w * S; g.beginPath(); g.moveTo(A[0] + o * S, A[1] + o * S); g.quadraticCurveTo(C[0] + o * S, C[1] + o * S, E2[0] + o * S, E2[1] + o * S); g.stroke(); } }
  const T = B.title;
  if (T && T.k > 0) { g.save(); g.translate(T.x, T.y); g.rotate(T.rot * D2R); g.scale(Math.max(0.001, T.pop), Math.max(0.001, T.pop)); const s = T.s;
    g.shadowColor = 'rgba(30,15,0,0.45)'; g.shadowBlur = 22 * S; g.shadowOffsetY = 10 * S; g.fillStyle = T.color; g.fillRect(-s * 1.3 / 2, -s / 2, s * 1.3, s); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(-s * 1.3 / 2, -s / 2, s * 1.3, s * 0.12);   // the glue strip
    const words = String(T.text).split(' '), lines = []; let line = ''; for (const w of words) { if ((line + ' ' + w).trim().length > 10 && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) lines.push(line);
    const fs = Math.min(s * 0.24, s * 1.18 / Math.max(...lines.map((l) => l.length * 0.62))); g.fillStyle = T.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${fs.toFixed(1)}px ${FONT}`;
    const y0 = -((lines.length - 1) * fs * 1.02) / 2 - (T.sub ? fs * 0.3 : 0); lines.forEach((l, i) => { g.save(); g.translate(0, y0 + i * fs * 1.02); g.scale(0.86, 1); g.fillText(l, 0, 0); g.restore(); });
    if (T.sub) { g.font = `600 ${(fs * 0.42).toFixed(1)}px ${FONT}`; g.fillText(T.sub, 0, y0 + lines.length * fs * 1.02 + fs * 0.05); }
    g.restore(); }
  g.restore(); return B;
}
export const BOARD = { 'layout.evidenceBoard': { file: 'type/gfx/board.js', tags: ['board', 'evidence', 'conspiracy', 'documentary', 'comedy', 'title-device', 'red-string', 'push'], d: BOARD_D,
  at: (t, p, size) => boardAt(t, { ...BOARD_D, ...p, title: p.title === null ? null : { ...BOARD_D.title, ...(p.title || {}) }, push: { ...BOARD_D.push, ...(p.push || {}) } }, size), sfx: ['sfx/foley/stamp', 'per pin; sfx/paper/rustle under the strings, sfx/foley/tape_tear on the title'] } };
export function mountBoard(root, params = {}, { W = 1920, H = 1080, images = null } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' }); root.appendChild(cv);
  const g = cv.getContext('2d'); let last = 0; const imgs = images ? loadImages(images, () => api.render(last)) : placeholderCards(params.images || BOARD_D.images, (params.seed || BOARD_D.seed) + 40);
  const api = { canvas: cv, images: imgs, render(t) { last = t; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); drawBoard(g, t, params, { W, H }, imgs); return this; } };
  if (document.fonts && document.fonts.load) document.fonts.load(`800 40px Manrope`).then(() => api.render(last), () => {});
  return api;
}
