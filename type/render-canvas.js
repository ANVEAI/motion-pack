/* motion-pack / type / render-canvas.js: 2D-canvas renderer for the kinetic presets and the caption engine (three.js overlay canvas, demos, tests, ffmpeg-less preview).
   Everything is a pure function of (spec, t): call drawType / drawCaptions for any t in any order. Text is drawn in display space (sRGB), above the grade, below dust and grain.
   spec = { text | lines:[...], preset, at, out, stagger, dur, params, font:{family,size,weight,tracking,lineHeight}, color, accent, anchor:{x,y} (fractions), align:'left'|'center', maxWidth (fraction of W), highlight:[word idx], bar:'#hex' }
   size = px at 1080 (scaled by H/1080 so 9:16 and 16:9 share numbers).                                                                                                         */
import { PRESETS, unitStates, holdTime } from './presets.js';
import { captionFrame } from './captions.js';
import { drawIcon } from './icons.js';
import { E, seg, lerp, clamp } from './ease.js';
import { captionBox } from './safezones.js';

export const DEFAULT_FONT = { family: 'Manrope, "Helvetica Neue", Helvetica, Arial, sans-serif', size: 124, weight: 800, tracking: -0.035, lineHeight: 1.0 };
const fontStr = (f, px, weight = f.weight) => `${weight} ${px}px ${f.family}`;
/* greedy word wrap -> lines of words with measured x offsets */
export function layout(g, text, font, fontPx, maxW, { align = 'left', lines: forced = null } = {}) {
  g.font = fontStr(font, fontPx); g.letterSpacing = (font.tracking * fontPx).toFixed(2) + 'px'; const sp = g.measureText(' ').width, L = [];
  const src = forced ? forced : [String(text)]; const words = [];
  src.forEach((ln, li) => ln.split(/\s+/).filter(Boolean).forEach((w) => words.push({ w, hard: li })));
  let cur = [], cw = 0, lastHard = words.length ? words[0].hard : 0;
  const push = () => { if (cur.length) L.push({ words: cur, w: cw }); cur = []; cw = 0; };
  for (const wd of words) { const w = g.measureText(wd.w).width; if (cur.length && (cw + sp + w > maxW || (forced && wd.hard !== lastHard))) push(); lastHard = wd.hard; cur.push({ text: wd.w, w, x: cw + (cur.length ? sp : 0) }); cw += (cur.length > 1 ? sp : 0) + w; }
  push(); L.forEach((l) => { const off = align === 'center' ? -l.w / 2 : 0; l.words.forEach((w) => { w.x += off; }); l.x0 = off; }); return L;
}
/* flatten lines into animation units: word | char | line */
function toUnits(g, lines, unit, font, fontPx) {
  const U = []; lines.forEach((l, li) => {
    if (unit === 'line') { U.push({ text: l.words.map((w) => w.text).join(' '), x: l.x0, w: l.w, line: li, wordIndex: null }); return; }
    l.words.forEach((w, wi) => { if (unit === 'word') U.push({ text: w.text, x: w.x, w: w.w, line: li, wordIndex: U.filter((u) => u.line >= 0).length }); else { g.font = fontStr(font, fontPx); g.letterSpacing = (font.tracking * fontPx).toFixed(2) + 'px'; for (let c = 0; c < w.text.length; c++) { const pre = g.measureText(w.text.slice(0, c)).width, cw = g.measureText(w.text[c]).width; U.push({ text: w.text[c], x: w.x + pre, w: cw, line: li, wordIndex: wi }); } } });
  }); return U;
}
export function drawType(g, spec, t, { W, H }) {
  const def = PRESETS[spec.preset], S = H / 1080, font = { ...DEFAULT_FONT, ...(spec.font || {}) }, fontPx = font.size * S, maxW = (spec.maxWidth ?? 0.78) * W, align = spec.align || 'left';
  const anchor = spec.anchor || { x: 0.1, y: 0.25 }, ax = anchor.x * W, ay = anchor.y * H, lh = font.lineHeight * fontPx;
  const lines = layout(g, spec.text, font, fontPx, maxW, { align, lines: spec.lines || null }), units = toUnits(g, lines, spec.unit || def.unit, font, fontPx);
  const R = unitStates({ ...spec, unitCount: units.length }, units.map((u) => u.text), t); g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const rowTop = (li) => ay + li * lh * 1.1;   // .v8-hd line pitch: 0.98 + 0.12 em
  /* highlighter bars sit behind everything */
  if (spec.highlight) for (const wi of spec.highlight) { const ws = units.filter((u) => u.wordIndex === wi || (def.unit === 'word' && units.indexOf(u) === wi)); if (!ws.length) continue; const u0 = ws[0], u1 = ws[ws.length - 1], i0 = units.indexOf(u0), k = E.move(seg(t, (spec.barAt ?? (spec.at || 0) + 0.25) + wi * 0.1, (spec.barAt ?? (spec.at || 0) + 0.25) + wi * 0.1 + 10 / 30)), vis = R.states[i0].opacity > 0 || true;
    const x0 = ax + u0.x - 0.08 * fontPx, w = (u1.x + u1.w - u0.x) + 0.16 * fontPx, y = rowTop(u0.line) + 0.12 * fontPx; g.fillStyle = spec.bar || '#FFD400'; g.globalAlpha = 1; g.fillRect(x0, y + 0.42 * fontPx, w * k, 0.46 * fontPx); }
  units.forEach((u, i) => { const s = R.states[i]; if (s.opacity <= 0.002) return;
    const bx = ax + u.x, by = rowTop(u.line) + fontPx * 0.98, cx = bx + u.w / 2, cy = by - fontPx * 0.36; g.save();
    if (def.mask === 'line') { g.beginPath(); g.rect(bx - fontPx * 0.2, rowTop(u.line), (spec.unit || def.unit) === 'char' ? u.w + fontPx * 0.4 : u.w + fontPx * 0.4, fontPx * 1.12); g.clip(); }
    if (s.clip < 1) { g.beginPath(); g.rect(bx - fontPx * 0.2, rowTop(u.line) - fontPx * 0.2, (u.w + fontPx * 0.4) * s.clip, fontPx * 1.6); g.clip(); }
    g.translate(cx + s.x * fontPx + s.shake[0] * S, cy + s.y * fontPx + s.shake[1] * S); if (s.rot) g.rotate((s.rot * Math.PI) / 180);
    const cosx = Math.cos((s.rotX * Math.PI) / 180); g.scale(s.scale, s.scale * (Math.abs(cosx) < 0.02 ? 0.02 : Math.abs(cosx)));
    g.globalAlpha = clamp(s.opacity); if (s.blur > 0.3) g.filter = `blur(${(s.blur * S).toFixed(2)}px)`;
    const wght = s.wght ?? font.weight; g.font = fontStr(font, fontPx, Math.round(wght)); g.letterSpacing = ((font.tracking + s.track) * fontPx).toFixed(2) + 'px';
    const txt = s.glyph ?? u.text, ox = -u.w / 2; if (s.glyph) { const gw = g.measureText(txt).width; if (gw > u.w * 1.02) g.scale(u.w / gw, 1); }
    if (s.rgb > 0.1) { const d = s.rgb * S; g.globalCompositeOperation = 'lighter'; for (const [c, dx] of [['#ff0040', -d], ['#00ff90', 0], ['#2060ff', d]]) { g.fillStyle = c; g.fillText(txt, ox + dx, fontPx * 0.36); } }
    else if (s.fill != null) { const col = (spec.colors && spec.colors[u.wordIndex]) || spec.color || '#111111', a = g.globalAlpha;   // outline presets: stroke (centred, like -webkit-text-stroke) + partial fill
      if (s.fill > 0.002) { g.globalAlpha = a * clamp(s.fill); g.fillStyle = col; g.fillText(txt, ox, fontPx * 0.36); g.globalAlpha = a; }
      if (s.stroke > 0.0005) { g.lineWidth = s.stroke * fontPx; g.lineJoin = 'round'; g.strokeStyle = col; g.strokeText(txt, ox, fontPx * 0.36); } }
    else { g.fillStyle = (spec.colors && spec.colors[u.wordIndex]) || spec.color || '#111111'; g.fillText(txt, ox, fontPx * 0.36); }
    g.restore(); });
  if (R.caret && R.caret.on) { const vis = R.states.map((s, i) => (s.opacity > 0.5 ? i : -1)).filter((i) => i >= 0), last = vis.length ? units[vis[vis.length - 1]] : null, u = last || units[0], x = last ? ax + u.x + u.w + fontPx * 0.04 : ax, y = rowTop(u.line); g.globalAlpha = 1; g.fillStyle = spec.color || '#111'; g.fillRect(x, y + fontPx * 0.08, fontPx * 0.07, fontPx * 0.82); }
  g.restore(); return { units, lines, R };
}
/* captions: lay out the chunk's words once (stable), then draw per-word states. box = safe-zone caption box (see safezones.captionBox) */
export function drawCaptions(g, chunks, t, style, { W, H, platform = 'conservative', box = null, font = 'Manrope, "Helvetica Neue", Helvetica, Arial, sans-serif', icons = true, iconMap = {} } = {}) {
  const F = captionFrame(chunks, t, style, { icons, iconMap }); if (!F) return null; const S = (H > W ? W : H) / 1080, fontPx = style.size * S, b = box || captionBox(platform, W, H, { lines: 2, fontPx });
  const text = F.words.map((w) => (style.upper ? w.text.toUpperCase() : w.text)).join(' '), fnt = { family: font, weight: style.weight, tracking: -0.01 };
  g.save(); g.font = fontStr(fnt, fontPx); g.letterSpacing = '0px'; const sp = g.measureText(' ').width + (style.stroke || 0) * fontPx * 2 + (style.pill ? fontPx * 0.3 : 0), lines = []; let cur = [], cw = 0;
  F.words.forEach((w, i) => { const tx = style.upper ? w.text.toUpperCase() : w.text, wd = g.measureText(tx).width; if (cur.length && cw + sp + wd > b.w) { lines.push({ cur, cw }); cur = []; cw = 0; } cur.push({ w, tx, wd, x: cw + (cur.length ? sp : 0) }); cw += (cur.length > 1 ? sp : 0) + wd; }); if (cur.length) lines.push({ cur, cw });
  const lh = fontPx * 1.18, y1 = b.y1; let top = y1 - lines.length * lh; const pos = [];
  if (style.mode === 'single') { top = y1 - lh; lines.length = 0; lines.push({ cur: [], cw: 0 }); F.words.forEach((w) => { const tx = style.upper ? w.text.toUpperCase() : w.text, wd = g.measureText(tx).width; pos[w.i] = { x: b.cx - wd / 2, y: top + fontPx * 0.92, w: wd, tx }; lines[0].cw = Math.max(lines[0].cw, wd); }); }
  else lines.forEach((l, li) => { const x0 = b.cx - l.cw / 2; l.cur.forEach((e) => { pos[e.w.i] = { x: x0 + e.x, y: top + li * lh + fontPx * 0.92, w: e.wd, tx: e.tx }; }); });
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
  /* pills first */
  if (style.pill) F.words.forEach((w) => { if (w.bg > 0.01) { const p = pos[w.i], pad = fontPx * 0.22; g.globalAlpha = w.opacity; g.fillStyle = style.accent; g.beginPath(); g.roundRect(p.x - pad, p.y - fontPx * 0.86, p.w + pad * 2, fontPx * 1.08, fontPx * 0.3); g.fill(); } });
  F.words.forEach((w) => { const p = pos[w.i]; if (w.opacity <= 0.003) return; g.save(); g.globalAlpha = clamp(w.opacity); const cx = p.x + p.w / 2, cy = p.y - fontPx * 0.3; g.translate(cx, cy + w.y * fontPx); g.scale(w.scale, w.scale); g.font = fontStr(fnt, fontPx); g.letterSpacing = '0px';
    if (style.shadow) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = style.shadow * fontPx * 1.2; g.shadowOffsetY = style.shadow * fontPx * 0.35; }
    if (style.stroke) { g.lineWidth = style.stroke * fontPx * 2; g.strokeStyle = 'rgba(8,8,16,.92)'; g.strokeText(p.tx, -p.w / 2, fontPx * 0.3); g.shadowColor = 'transparent'; } g.fillStyle = w.color; g.fillText(p.tx, -p.w / 2, fontPx * 0.3); g.restore(); });
  if (icons) F.icons.forEach((ic) => { const p = pos[ic.wordIndex]; if (!p) return; const sz = fontPx * 1.15; drawIcon(g, ic.id, p.x + p.w / 2, p.y - fontPx * 1.35, sz, { color: style.accent === '#FFFFFF' ? '#FFD400' : style.accent, progress: ic.progress, t, seed: ic.seed, rot: -8 + (ic.seed % 3) * 8 }); });
  g.restore(); return { frame: F, rect: { x0: Math.min(...lines.map((l) => b.cx - l.cw / 2)), x1: Math.max(...lines.map((l) => b.cx + l.cw / 2)), y0: top - fontPx * 0.12, y1: y1 }, lines: lines.length };
}
