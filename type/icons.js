/* motion-pack / type / icons.js: OWNED vector sticker pack (path data authored for this pack; no emoji fonts, no registry assets). 100 x 100 box.
   fill icons pop with E.pop (8 f); stroke icons draw on (dashoffset over 10..16 f) and wobble (seeded, 1.5 px @ 4 Hz) so stickers feel hand-placed.
   iconPath(id) -> SVG path 'd';  drawIcon(g, id, cx, cy, size, {color, progress, rot, t, seed});  iconSVG(id, {color, size});  iconFor(word) -> id | null (emoji-pop keyword map). */
import { E, mulberry32, seg, TAU } from './ease.js';

const poly = (n, ro, ri, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`; }).map((p, i) => (i ? 'L' : 'M') + p).join(' ') + ' Z';
export const ICONS = {
  burst8: { d: poly(8, 48, 34), tags: ['emphasis', 'sale', 'pop'] }, burst12: { d: poly(12, 48, 38), tags: ['emphasis', 'sale', 'pop'] }, star: { d: poly(5, 48, 20), tags: ['rating', 'quality', 'favorite'] },
  spark: { d: 'M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z', tags: ['magic', 'new', 'ai', 'shine'] },
  heart: { d: 'M50 88 C12 60 6 36 22 22 C34 12 46 18 50 30 C54 18 66 12 78 22 C94 36 88 60 50 88 Z', tags: ['love', 'like', 'favorite'] },
  flame: { d: 'M50 6 C58 24 78 36 78 60 C78 78 66 94 50 94 C34 94 22 80 22 62 C22 50 30 42 36 34 C38 44 44 46 46 44 C44 30 44 18 50 6 Z', tags: ['hot', 'trending', 'fire'] },
  bolt: { d: 'M58 4 L22 54 H46 L38 96 L80 40 H54 L58 4 Z', tags: ['fast', 'power', 'speed', 'energy'] },
  thumb: { d: 'M10 44 H30 V90 H10 Z M36 90 V46 L52 8 C62 8 68 18 64 30 L60 42 H86 C93 42 97 49 95 55 L89 82 C87 88 83 90 77 90 Z', tags: ['like', 'approve', 'yes'] },
  play: { d: 'M30 12 L90 50 L30 88 Z', tags: ['video', 'play', 'demo'] },
  speech: { d: 'M10 12 H90 V68 H46 L24 90 V68 H10 Z', tags: ['say', 'talk', 'voice', 'chat'] },
  tag: { d: 'M8 8 H52 L92 48 L52 92 L8 48 Z M28 28 a7 7 0 1 0 0.01 0 Z', rule: 'evenodd', tags: ['price', 'sale', 'offer'] },
  check: { d: 'M16 54 L40 78 L86 24', stroke: true, tags: ['done', 'yes', 'correct'] }, cross: { d: 'M20 20 L80 80 M80 20 L20 80', stroke: true, tags: ['no', 'wrong', 'stop'] },
  arrow: { d: 'M8 74 C26 18 62 14 88 44 M88 44 L64 38 M88 44 L84 68', stroke: true, tags: ['point', 'look', 'next'] },
  wave: { d: 'M4 56 Q19 36 34 56 T64 56 T96 56', stroke: true, tags: ['underline', 'emphasis'] },
  zigzag: { d: 'M4 62 L20 38 L36 62 L52 38 L68 62 L84 38 L96 56', stroke: true, tags: ['underline', 'playful'] },
  bracket: { d: 'M34 8 H16 V92 H34 M66 8 H84 V92 H66', stroke: true, tags: ['frame', 'focus'] },
};
export const iconPath = (id) => ICONS[id].d;
/* seeded hand-drawn ellipse (circle-the-word) and underline paths, in box units; w,h = box */
export function scribbleCircle(seed = 1, w = 100, h = 60) { const r = mulberry32(seed * 977 + 5), n = 14, pts = []; for (let i = 0; i <= n + 2; i++) { const a = (i / n) * TAU + 0.6, k = 1 + (r() - 0.5) * 0.10 + i * 0.006; pts.push([w / 2 + (w / 2 - 3) * k * Math.cos(a), h / 2 + (h / 2 - 3) * k * Math.sin(a)]); } return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); }
export function scribbleUnderline(seed = 1, w = 100) { const r = mulberry32(seed * 313 + 9); let d = `M2 ${(6 + r() * 3).toFixed(1)}`; for (let x = 18; x < w; x += 18) d += ` Q${(x - 9).toFixed(1)} ${(2 + r() * 8).toFixed(1)} ${x.toFixed(1)} ${(6 + r() * 4).toFixed(1)}`; return d; }
/* canvas: pop (fill) or draw-on (stroke). progress 0..1 over the icon's entrance (callers pass seg(t, at, at + 8/30)); wobble is closed form in t. */
export function drawIcon(g, id, cx, cy, size, { color = '#FFD400', progress = 1, rot = 0, t = 0, seed = 1, lineW = 0.09 } = {}) {
  const ic = ICONS[id]; if (!ic || progress <= 0) return; const wob = (Math.sin(TAU * 4 * t + seed) * 1.5) / 100, s = size / 100;
  g.save(); g.translate(cx, cy); g.rotate(((rot + Math.sin(TAU * 2 * t + seed * 2) * 1.5) * Math.PI) / 180); const sc = ic.stroke ? 1 : Math.max(0.0001, E.pop(Math.min(1, progress))); g.scale(s * sc, s * sc); g.translate(-50 + wob * 100, -50);
  const p = new Path2D(ic.d); g.globalAlpha = Math.min(1, progress * 4);
  if (ic.stroke) { g.strokeStyle = color; g.lineWidth = lineW * 100; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([400, 400]); g.lineDashOffset = 400 * (1 - E.enter(progress)); g.stroke(p); } else { g.fillStyle = color; g.fill(p, ic.rule || 'nonzero'); }
  g.restore();
}
export const iconSVG = (id, { color = '#FFD400', size = 100, lineW = 9 } = {}) => { const ic = ICONS[id]; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` + (ic.stroke ? `<path d="${ic.d}" fill="none" stroke="${color}" stroke-width="${lineW}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="${ic.d}" fill="${color}" fill-rule="${ic.rule || 'nonzero'}"/>`) + '</svg>'; };
/* emoji-pop keyword map (own list; extend per brand). Matching is case-insensitive on the bare word. */
export const KEYWORDS = { fire: 'flame', hot: 'flame', trending: 'flame', viral: 'flame', love: 'heart', loved: 'heart', favorite: 'heart', like: 'thumb', great: 'thumb', yes: 'check', done: 'check', correct: 'check', free: 'burst12', sale: 'tag', price: 'tag', cheap: 'tag', discount: 'tag', deal: 'tag',
  fast: 'bolt', instant: 'bolt', power: 'bolt', speed: 'bolt', new: 'spark', magic: 'spark', ai: 'spark', smart: 'spark', best: 'star', top: 'star', quality: 'star', five: 'star', no: 'cross', never: 'cross', stop: 'cross', wrong: 'cross', watch: 'play', demo: 'play', video: 'play', say: 'speech', talk: 'speech', voice: 'speech', ask: 'speech' };
export const iconFor = (word, extra = {}) => { const w = String(word).toLowerCase().replace(/[^a-z0-9]/g, ''); return extra[w] ?? KEYWORDS[w] ?? null; };
