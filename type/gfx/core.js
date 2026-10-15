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
/* honesty of defaults (2026-10-15, type/tests/honesty-defaults.test.mjs): a part whose default content shows a number, price or quote has a `source` param that
   DEFAULTS to 'placeholder data' and prints it, so a default frame can never be read as a finding. srcOf is the caller's source, or the label when it is missing or
   blank (digits never print unlabelled; naming a real source is how you remove the label). The chart.* parts follow the same idiom. */
export const PLACEHOLDER = 'placeholder data';
export const srcOf = (p, fallback = PLACEHOLDER) => String(p.source ?? '').trim() || fallback;
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
/* measured advance width (2026-10-14): canvas measureText in a browser (exact for the loaded font; deterministic once fonts are ready),
   the textW estimate in node. weight 200..800 (variable Manrope), ls = letter-spacing in px added per char. */
let _mctx = null;
export function measure(str, size, { weight = 700, font = FONT, ls = 0 } = {}) {
  const s = String(str ?? '');
  if (typeof document !== 'undefined') { _mctx ||= document.createElement('canvas').getContext('2d'); _mctx.font = `${weight} ${size}px ${font}`; return _mctx.measureText(s).width + ls * s.length; }
  return textW(s, size, font === MONO ? 0.6 : weight >= 700 ? 0.56 : 0.52) + ls * s.length;
}
/* round-3 helpers (2026-10-14): a stable per-item id for <defs> (filters, clips, gradients) so two items in one host never share a def,
   a blur filter def (empty below 0.05 px so settled frames carry no filter), and the readable ink (dark or light) on a background colour. */
export function uidOf(name, p) { const s = name + JSON.stringify([p.text, p.words, p.word, p.items, p.seed, p.at, p.size, p.uid]); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'q' + h.toString(36); }
export const blurDef = (id, sd) => (sd > 0.05 ? `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${f2(sd)}"/></filter>` : '');
export const blurAttr = (id, sd) => (sd > 0.05 ? ` filter="url(#${id})"` : '');
export function lum(hex) { const h = String(hex).replace('#', ''), v = h.length === 3 ? h.split('').map((x) => parseInt(x + x, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const l = v.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; }
/* the ink with the higher WCAG contrast on bg: dark '#0E0E14' or light '#FFFFFF' */
export const inkOn = (bg, dark = INK, light = PAPER) => { const L = lum(bg), cd = (L + 0.05) / (lum(dark) + 0.05), cl = (lum(light) + 0.05) / (L + 0.05); return cd >= cl ? dark : light; };
