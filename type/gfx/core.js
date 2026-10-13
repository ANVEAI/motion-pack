/* motion-pack / type / gfx / core.js: shared helpers for the editor-staple graphics (2026-10-13).
   CONTRACT for every gfx component: { tags, dur (default hold, s), inF / outF (entrance / exit frames @30), d (default params),
     svg(L, p, ctx) -> SVG markup (no outer <svg>) }   where L = lifecycle at local time u = t - at:
     L = { u, in (0..1 entrance), out (0..1 exit), on (in && !out visible), k (in * (1 - out)), hold (u - inDur) }
   ctx = { W, H, s (= H / 1080 scale), safe (safeRect of p.platform or wideTitle), seed }. Everything is a pure function of t: seek-safe.
   Output is plain SVG strings: HyperFrames DOM (innerHTML on hf-seek), canvas (Image from an SVG blob) or a static .svg. Owned code. */
import { E, clamp, lerp, seg, TAU, mulberry32 } from '../ease.js';
import { safeRect } from '../safezones.js';
export { E, clamp, lerp, seg, TAU, mulberry32 };
export const FONT = "Manrope, 'Helvetica Neue', Arial, sans-serif", MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
export const BRAND = '#4A18ED', INK = '#0E0E14', PAPER = '#FFFFFF';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const f2 = (v) => (Math.round(v * 100) / 100).toString();
export const hashf = (...k) => { let h = 2166136261 >>> 0; for (const v of k) { h ^= (Math.round(v * 1000) * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; };
export const tf = (x, y, s = 1, r = 0) => `translate(${f2(x)} ${f2(y)})${r ? ` rotate(${f2(r)})` : ''}${s !== 1 ? ` scale(${Math.max(0.0001, s).toFixed(4)})` : ''}`;
export const text = (str, x, y, { size = 48, weight = 700, fill = PAPER, anchor = 'start', font = FONT, ls = 0, op = 1, extra = '' } = {}) =>
  `<text x="${f2(x)}" y="${f2(y)}" font-family="${esc(font)}" font-size="${f2(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${f2(ls)}"${op < 1 ? ` opacity="${f2(op)}"` : ''} ${extra}>${esc(str)}</text>`;
/* approximate advance width (Manrope-ish metrics) so boxes can size to text without DOM measurement; 0.56 em average for bold sans */
export const textW = (str, size, k = 0.56) => String(str ?? '').length * size * k;
/* clip-reveal helper: a rect clipPath id for left-to-right wipes */
export const clipRect = (id, x, y, w, h) => `<clipPath id="${id}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, w))}" height="${f2(Math.max(0, h))}"/></clipPath>`;
/* stroke draw-on for a path of known length */
export const dash = (len, k) => `stroke-dasharray="${f2(len)} ${f2(len + 1)}" stroke-dashoffset="${f2(len * (1 - clamp(k)))}"`;
/* seeded wobbly path through points (hand-drawn feel) */
export function wobblePath(pts, seed = 1, amp = 3) { const r = mulberry32(seed * 7919 + 3); return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f2(x + (r() - 0.5) * amp)} ${f2(y + (r() - 0.5) * amp)}`).join(' '); }
export const polylineLen = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
/* lifecycle of a component placed at `at` with hold `dur` */
export function life(t, at, dur, inF = 12, outF = 9, fps = 30) {
  const u = t - at, ti = inF / fps, to = outF / fps, holdEnd = ti + dur;
  return { u, in: seg(u, 0, ti), out: seg(u, holdEnd, holdEnd + to), on: u >= 0 && u < holdEnd + to, hold: u - ti, total: holdEnd + to, k: seg(u, 0, ti) * (1 - seg(u, holdEnd, holdEnd + to)) };
}
export function ctxFor(W, H, platform, seed = 1) { const plat = platform || (W >= H ? 'wideTitle' : 'reels'); return { W, H, s: H / 1080, safe: safeRect(plat, W, H), seed, tall: H > W }; }
/* anchor: p.pos = 'bl' | 'br' | 'tl' | 'tr' | 'bc' | 'tc' | 'c' | [x, y] (fractions) -> px inside the safe rect */
export function anchor(pos, ctx, w = 0, h = 0) {
  const S = ctx.safe; if (Array.isArray(pos)) return [pos[0] * ctx.W, pos[1] * ctx.H];
  const x = pos.includes('l') ? S.x0 : pos.includes('r') ? S.x1 - w : (S.x0 + S.x1 - w) / 2, y = pos.startsWith('t') ? S.y0 : pos.startsWith('b') ? S.y1 - h : (S.y0 + S.y1 - h) / 2;
  return [x, y];
}
