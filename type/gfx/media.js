/* motion-pack / type / gfx / media.js: OWNED placeholder media for the collage, mosaic, inline-media, logo-wall and orbit pieces (2026-10-14).
   Every slot accepts real media instead: { href } (an <image>; preload it, or hand HyperFrames a promise through hf-seek waitUntil) or { svg } (inline markup
   in the slot's own box). The placeholders are abstract seeded art (sky / sun / hills, shape blocks, a UI card) and generic geometric marks: never a
   third-party logo, never a real person. Pure functions of their inputs. */
import { mulberry32, f2, esc, FONT, INK, PAPER, text } from './core.js';
export const PALETTES = [['#F7D9B5', '#FF7A3D', '#3E7C59', '#24533C'], ['#CFE6FF', '#FFD23A', '#5A8DEE', '#2B4BA8'], ['#FFE3EC', '#FF4F7B', '#B57BFF', '#5B2EA6'],
  ['#E8F5E1', '#2BD9A0', '#5FA36A', '#2F6B3E'], ['#FFF1C9', '#FF9F1C', '#C9573A', '#7A2E1E'], ['#E7E4F7', '#4A18ED', '#8E7BFF', '#2A1C7A'], ['#DFF6F4', '#00B3A4', '#3A86FF', '#1F3A93']];
/* a placeholder "photo" in the box (x, y, w, h): kind 0 landscape, 1 shape blocks, 2 UI card; seeded. border = white print edge in px */
export function photoTile(x, y, w, h, seed = 1, { kind = null, border = 0, radius = 0, shadow = false } = {}) {
  const r = mulberry32(seed * 7907 + 11), P = PALETTES[Math.floor(r() * PALETTES.length)], k = kind ?? Math.floor(r() * 3), b = border, iw = w - 2 * b, ih = h - 2 * b;
  let inner = '';
  if (k === 0) { const sy = ih * (0.25 + r() * 0.2), sx = iw * (0.2 + r() * 0.6), h1 = ih * (0.55 + r() * 0.15), h2 = ih * (0.7 + r() * 0.12);
    inner = `<rect width="${f2(iw)}" height="${f2(ih)}" fill="${P[0]}"/><circle cx="${f2(sx)}" cy="${f2(sy)}" r="${f2(Math.min(iw, ih) * 0.13)}" fill="${P[1]}"/>` +
      `<path d="M0 ${f2(h1)} Q${f2(iw * 0.3)} ${f2(h1 - ih * 0.18)} ${f2(iw * 0.6)} ${f2(h1)} T${f2(iw)} ${f2(h1 - ih * 0.05)} V${f2(ih)} H0 Z" fill="${P[2]}"/>` +
      `<path d="M0 ${f2(h2)} Q${f2(iw * 0.45)} ${f2(h2 - ih * 0.12)} ${f2(iw)} ${f2(h2 + ih * 0.02)} V${f2(ih)} H0 Z" fill="${P[3]}"/>`; }
  else if (k === 1) { inner = `<rect width="${f2(iw)}" height="${f2(ih)}" fill="${P[0]}"/><rect x="${f2(iw * 0.12)}" y="${f2(ih * 0.5)}" width="${f2(iw * 0.4)}" height="${f2(ih * 0.4)}" fill="${P[2]}"/>` +
      `<circle cx="${f2(iw * 0.66)}" cy="${f2(ih * 0.38)}" r="${f2(Math.min(iw, ih) * 0.24)}" fill="${P[1]}"/><path d="M${f2(iw * 0.5)} ${f2(ih * 0.9)} L${f2(iw * 0.88)} ${f2(ih * 0.9)} L${f2(iw * 0.69)} ${f2(ih * 0.55)} Z" fill="${P[3]}"/>`; }
  else { const lw = iw * 0.7; inner = `<rect width="${f2(iw)}" height="${f2(ih)}" fill="#FFFFFF"/><rect x="${f2(iw * 0.1)}" y="${f2(ih * 0.12)}" width="${f2(iw * 0.22)}" height="${f2(iw * 0.22)}" rx="${f2(iw * 0.05)}" fill="${P[1]}"/>` +
      [0.5, 0.64, 0.78].map((yy, i) => `<rect x="${f2(iw * 0.1)}" y="${f2(ih * yy)}" width="${f2(lw * (1 - i * 0.22))}" height="${f2(Math.max(2, ih * 0.06))}" rx="${f2(ih * 0.03)}" fill="${i ? '#E3E3EA' : P[2]}"/>`).join(''); }
  const frame = b || radius ? `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(radius)}" fill="#FFFFFF"/>` : '';
  const sh = shadow ? `<rect x="${f2(x + w * 0.03)}" y="${f2(y + h * 0.05)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(radius)}" fill="#000" opacity="0.14"/>` : '';
  return `${sh}${frame}<svg x="${f2(x + b)}" y="${f2(y + b)}" width="${f2(iw)}" height="${f2(ih)}" viewBox="0 0 ${f2(iw)} ${f2(ih)}">${inner}</svg>`;
}
/* a slot: real media when given, else the placeholder */
export function slotMedia(m, x, y, w, h, seed, opts = {}) {
  if (m && m.href) return `<image href="${esc(m.href)}" x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" preserveAspectRatio="xMidYMid slice"/>`;
  if (m && m.svg) return `<svg x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" viewBox="${m.viewBox || '0 0 100 100'}">${m.svg}</svg>`;
  return photoTile(x, y, w, h, m?.seed ?? seed, opts);
}
/* generic geometric placeholder marks (100 x 100 box), never a real brand */
export const MARKS = [
  (c) => `<circle cx="50" cy="50" r="34" fill="${c}"/>`, (c) => `<rect x="18" y="18" width="64" height="64" rx="10" fill="${c}"/>`, (c) => `<path d="M50 14 L86 80 H14 Z" fill="${c}"/>`,
  (c) => `<circle cx="50" cy="50" r="30" fill="none" stroke="${c}" stroke-width="14"/>`, (c) => `<rect x="16" y="24" width="68" height="18" rx="9" fill="${c}"/><rect x="16" y="58" width="44" height="18" rx="9" fill="${c}"/>`,
  (c) => `<path d="M50 10 L90 50 L50 90 L10 50 Z" fill="${c}"/>`, (c) => `<path d="M20 80 V20 L50 52 L80 20 V80" fill="none" stroke="${c}" stroke-width="14" stroke-linejoin="round"/>`,
  (c) => `<circle cx="36" cy="50" r="24" fill="${c}"/><circle cx="64" cy="50" r="24" fill="${c}" opacity="0.55"/>`];
/* placeholder logo lockup in a box: mark + "LOGO nn" (monochrome) */
export function placeholderLogo(x, y, w, h, i, color = '#8A8A94', font = FONT) {
  const s = h * 0.78, mx = x + w / 2 - (s + h * 2.1) / 2;
  return `<g transform="translate(${f2(mx)} ${f2(y + (h - s) / 2)}) scale(${(s / 100).toFixed(4)})">${MARKS[i % MARKS.length](color)}</g>` +
    text(`LOGO ${String(i + 1).padStart(2, '0')}`, mx + s + h * 0.2, y + h * 0.66, { size: h * 0.42, weight: 800, fill: color, font, ls: h * 0.01 });
}
/* the pack's own default mark for glyphMorphCursor: a four-point spark (100 box) */
export const DEFAULT_MARK = 'M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4 Z';
