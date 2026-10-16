/* motion-pack / type / gfx / r78-util.js (xp-r78, 2026-10-16): the small guards every r78 part shares (glass.js, review.js, r78-type.js, r78-wall.js).
   The same idiom as hw.js: every numeric param is clamped (num), every list is capped (list), colours are #hex only (hex), text is capped (str), so no param can hang a
   render or print a NaN. Pure, no state. */
import { clamp, lerp, seg, E, f2 } from './core.js';

export const num = (v, d, lo = -1e9, hi = 1e9) => { const x = v == null || v === '' || typeof v === 'boolean' ? NaN : +v; return Number.isFinite(x) ? clamp(x, lo, hi) : d; };
export const str = (v, d = '', max = 80) => (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : d);
export const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
export const hex = (v, d) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : d);
export const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
/* type scale from the shorter side (9:16 keeps phone-readable sizes) */
export const sc = (c) => (c.H > c.W ? c.W / 1080 : c.s);
export const rgbOf = (h) => { const s = String(h).replace('#', ''), n = parseInt(s.length === 3 ? [...s].map((x) => x + x).join('') : s.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const toHex = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mixHex = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b); return toHex(A.map((v, i) => lerp(v, B[i], clamp(k)))); };
/* a [x, y, w, h] box in frame fractions -> px (fixed length, each clamped) */
export const boxPx = (b, d, c) => { const q = Array.isArray(b) && b.length >= 4 ? b : d; return [num(q[0], d[0], -2, 3) * c.W, num(q[1], d[1], -2, 3) * c.H, Math.max(1, num(q[2], d[2], 0, 4) * c.W), Math.max(1, num(q[3], d[3], 0, 4) * c.H)]; };
/* a rounded-rect path (radius clamped to half the shorter side) */
export function rrPath(x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${f2(x + q)} ${f2(y)}H${f2(x + w - q)}A${f2(q)} ${f2(q)} 0 0 1 ${f2(x + w)} ${f2(y + q)}V${f2(y + h - q)}A${f2(q)} ${f2(q)} 0 0 1 ${f2(x + w - q)} ${f2(y + h)}H${f2(x + q)}A${f2(q)} ${f2(q)} 0 0 1 ${f2(x)} ${f2(y + h - q)}V${f2(y + q)}A${f2(q)} ${f2(q)} 0 0 1 ${f2(x + q)} ${f2(y)}Z`;
}
/* the item's own lifecycle value for 'fade out at the end' (1 = fully on) */
export const alive = (L) => 1 - E.exit(L.out);
export { seg };
