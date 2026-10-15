/* motion-pack / layers / film.js: the film finish for HyperFrames DOM pages (2026-10-16, film lane). Owned code, no assets. Every value is a pure function of t.
   It acts on a PICTURE wrapper (the element that holds the footage <video>, the plate canvas or a still): grade, halation and the anime-ink pass are SVG filters
   (filters read the element's own pixels, so unlike the overlay canvases they work on real footage), gate weave and exposure flicker are a transform and a
   brightness() per film frame. Type and the brand sit OUTSIDE the wrapper, so they never weave, flicker or halate (the pack's stack rule).
     weaveAt(t, { amp, rot, fps, seed })          -> { x, y, r }   gate weave: a seeded smooth wander held per film frame (24 fps: every 1.25 video frames at 30)
     flickerAt(t, { amount, fps, seed })          -> brightness multiplier per film frame (1 +- amount)
     halationSVG(id, { amount, threshold, radius, tint }, H)  -> <filter>: luma above threshold -> blur -> tint -> added back (red fringe around highlights)
     inkSVG(id, { levels, edge, color }, H)       -> <filter>: posterise to `levels` + dark edge lines from a luminance edge kernel (the anime-ink look)
     filmDefs(genre, { id, H, look })             -> { defs, filter } the SVG <defs> markup and the CSS filter value for a genre of presets/film-looks.js
     barsPx(W, H, ratio)                          -> the letterbox bar height in px (2.39 on 1080p = 138 px; 0 when the frame is already that wide)
     mountFilmFinish(el, genre, { W, H, fps, seed, over }) -> { render(t), defs }: installs the filters on el and drives weave + flicker on every render(t)
   The letterbox itself is the overlay `bars` kind (overlay.js, ratio + reveal) and grain / vignette / dust are overlay kinds too: see FILM_GENRES for the values. */
import { toSVGFilter } from './grade.js';
import { lookParams } from './presets/looks.js';
import { FILM_GENRES } from './presets/film-looks.js';
const TAU = Math.PI * 2;
const f4 = (v) => (Math.round(v * 1e4) / 1e4).toString();
function hash(...k) { let h = 2166136261 >>> 0; for (const v of k) { h ^= (Math.round(v * 1000) * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
/* smooth 1-D value noise in -1..1 (cosine-interpolated hashed lattice), a pure function of x */
export function vnoise(x, seed = 1) { const i = Math.floor(x), f = x - i, a = hash(i, seed) * 2 - 1, b = hash(i + 1, seed) * 2 - 1, k = (1 - Math.cos(f * Math.PI)) / 2; return a + (b - a) * k; }

export function weaveAt(t, { amp = 1, rot = 0.03, fps = 24, seed = 7, H = 1080 } = {}) {
  if (!(amp > 0) && !(rot > 0)) return { x: 0, y: 0, r: 0 };
  const n = Math.floor(t * fps + 1e-6), s = H / 1080;   // hold per film frame: the gate moves between frames, never inside one
  const x = (vnoise(n * 0.21, seed) * 0.7 + vnoise(n * 0.9, seed + 3) * 0.3) * amp * s, y = (vnoise(n * 0.17, seed + 11) * 0.6 + vnoise(n * 1.3, seed + 5) * 0.4) * amp * 1.4 * s;
  return { x, y, r: vnoise(n * 0.13, seed + 19) * rot };
}
export function flickerAt(t, { amount = 0.01, fps = 24, seed = 3 } = {}) {
  if (!(amount > 0)) return 1; const n = Math.floor(t * fps + 1e-6);
  return 1 + amount * (0.65 * (hash(n, seed) * 2 - 1) + 0.35 * vnoise(n * 0.3, seed + 1));
}
/* halation: luminance -> a soft threshold ramp (table) -> gaussian blur (radius scaled to the frame) -> tinted -> added to the source (arithmetic k2 = k3 = 1) */
export function halationSVG(id, { amount = 0.3, threshold = 0.78, radius = 9, tint = [1, 0.35, 0.12] } = {}, H = 1080) {
  const n = 32, tbl = Array.from({ length: n }, (_, i) => { const x = i / (n - 1), k = Math.max(0, Math.min(1, (x - threshold) / Math.max(1e-3, 1 - threshold))); return f4(k * k); }).join(' ');
  const a = Math.max(0, Math.min(1.5, amount)), sd = Math.max(0.5, radius * H / 1080);
  return `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" result="l"/>` +
    `<feComponentTransfer in="l" result="m"><feFuncR type="table" tableValues="${tbl}"/><feFuncG type="table" tableValues="${tbl}"/><feFuncB type="table" tableValues="${tbl}"/></feComponentTransfer>` +
    `<feGaussianBlur in="m" stdDeviation="${f4(sd)}" edgeMode="duplicate" result="b"/>` +
    `<feColorMatrix in="b" type="matrix" values="${f4(tint[0] * a)} 0 0 0 0 0 ${f4(tint[1] * a)} 0 0 0 0 0 ${f4(tint[2] * a)} 0 0 0 0 0 0 1" result="h"/>` +
    `<feComposite in="SourceGraphic" in2="h" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter>`;
}
/* anime ink: posterise each channel to `levels` (discrete tables), then darken along luminance edges (a 3x3 Laplacian-like kernel on luma, thresholded) */
export function inkSVG(id, { levels = 6, edge = 0.55, color = '#1A1428' } = {}, H = 1080) {
  const L = Math.max(2, Math.min(16, Math.round(levels))), steps = Array.from({ length: L }, (_, i) => f4(i / (L - 1))).join(' ');
  const c = parseInt(String(color).replace('#', ''), 16), cr = ((c >> 16) & 255) / 255, cg = ((c >> 8) & 255) / 255, cb = (c & 255) / 255, e = Math.max(0, Math.min(1, edge)), r = Math.max(1, Math.round(H / 1080));
  return `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">` +
    `<feComponentTransfer in="SourceGraphic" result="p"><feFuncR type="discrete" tableValues="${steps}"/><feFuncG type="discrete" tableValues="${steps}"/><feFuncB type="discrete" tableValues="${steps}"/></feComponentTransfer>` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" result="l"/>` +
    (r > 1 ? `<feMorphology in="l" operator="erode" radius="${r - 1}" result="l2"/>` : '') +
    `<feConvolveMatrix in="${r > 1 ? 'l2' : 'l'}" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="1" bias="0" preserveAlpha="true" result="e"/>` +
    `<feComponentTransfer in="e" result="m"><feFuncR type="linear" slope="${f4(6 * e)}" intercept="${f4(-0.25)}"/><feFuncG type="linear" slope="0"/><feFuncB type="linear" slope="0"/></feComponentTransfer>` +
    `<feColorMatrix in="m" type="matrix" values="0 0 0 0 ${f4(cr)} 0 0 0 0 ${f4(cg)} 0 0 0 0 ${f4(cb)} ${f4(e)} 0 0 0 0" result="ink"/>` +
    `<feComposite in="ink" in2="p" operator="over"/></filter>`;
}
export const barsPx = (W, H, ratio) => (!ratio || W / H >= ratio - 1e-6 ? 0 : Math.round((H - W / ratio) / 2));
export function filmDefs(genre, { id = 'mp-film', H = 1080, look = null } = {}) {
  const G = FILM_GENRES[genre]; if (!G) throw new Error('unknown film genre ' + genre + ' (layers/presets/film-looks.js FILM_GENRES)');
  const ids = [], parts = [], lk = look || G.look;
  if (lk) { parts.push(toSVGFilter(lookParams(lk), id + '-grade')); ids.push(id + '-grade'); }
  if (G.ink) { parts.push(inkSVG(id + '-ink', G.ink, H)); ids.push(id + '-ink'); }
  if (G.halation && G.halation.amount > 0) { parts.push(halationSVG(id + '-halo', G.halation, H)); ids.push(id + '-halo'); }
  return { defs: parts.join(''), filter: ids.map((i) => `url(#${i})`).join(' '), ids };
}
/* install on a picture wrapper: the SVG defs go into one hidden <svg> next to it; the transform and brightness are set on every render(t).
   over: { weave, flicker, halation, look } overrides the genre's values (weave: { amp: 0 } turns it off). */
export function mountFilmFinish(el, genre, { W = 1920, H = 1080, fps = 30, seed = 7, over = {} } = {}) {
  const G = { ...FILM_GENRES[genre], ...over }, id = 'mpf' + Math.floor(hash(seed, W, H, genre.length) * 1e9).toString(36);
  const d = filmDefs(genre, { id, H, look: over.look || null }), host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.setAttribute('width', '0'); host.setAttribute('height', '0'); host.style.position = 'absolute'; host.innerHTML = `<defs>${d.defs}</defs>`; el.parentNode.insertBefore(host, el);
  el.style.transformOrigin = '50% 50%';
  return { defs: d.defs, filter: d.filter, render(t) { const w = weaveAt(t, { ...G.weave, seed, H }), b = flickerAt(t, { amount: G.flicker, fps: (G.weave && G.weave.fps) || 24, seed: seed + 1 });
    el.style.transform = `translate(${f4(w.x)}px, ${f4(w.y)}px) rotate(${f4(w.r)}deg) scale(${f4(1 + 2.4 * Math.max(G.weave?.amp || 0, 0) / H)})`;   // a hair of overscan hides the moving edge
    el.style.filter = `${d.filter} brightness(${f4(b)})`.trim(); return this; } };
}
export { FILM_GENRES };
