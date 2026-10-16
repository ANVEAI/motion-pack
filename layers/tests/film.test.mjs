/* film-lane layers (2026-10-16), node only (no browser, no GPU: CI runs it): run  node layers/tests/film.test.mjs
   canvas2d-film.js (filmBurn, anamorphicFlare) on a recording 2D context: the same t draws the same calls in forward and shuffled order, nothing is drawn outside the
   window, the burn's coverage peaks ON `at` and is symmetric in time around it, the flare follows its path; layers/film.js: the gate weave and the flicker are held per
   film frame and bounded, the halation / ink / grade SVG filters are well-formed for every genre, the letterbox maths; presets/film-looks.js: every genre's look exists,
   is in LOOKS, and its generated .cube (layers/looks/look.film-<genre>.cube) matches the JS reference grade. */
import fs from 'node:fs'; import path from 'node:path';
import { reporter, ROOT } from './harness.mjs';
import { K2D_FILM, burnState, flareState, cuesFilm, fbm } from '../canvas2d-film.js';
import { K2D } from '../canvas2d.js';
import { weaveAt, flickerAt, halationSVG, inkSVG, filmDefs, barsPx } from '../film.js';
import { FILM_GENRES, FILM_LOOKS, FILM_GENRE_NAMES } from '../presets/film-looks.js';
import { LOOKS, lookParams } from '../presets/looks.js';
import { gradeRGB, prepare, cubeLookup } from '../grade.js';
const R = reporter('film layers');
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? (...a) => { log.push(String(k) + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s.toFixed(4)}${c}`) }; } : (...a) => { log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { width: 0 }; })), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (kind, t, p = {}, W = 1920, H = 1080) => { const { g, log } = recorder(); K2D[kind].draw(g, W, H, t, { ...K2D[kind].d, ...p }, 3); return log.join('|'); };

R.check('both kinds are merged into K2D (mountStack can mount them) and carry docs and tags', ['filmBurn', 'anamorphicFlare'].every((k) => K2D[k] && K2D[k] === K2D_FILM[k] && K2D[k].doc && K2D[k].tags.length));
for (const kind of ['filmBurn', 'anamorphicFlare']) {
  const p = kind === 'filmBurn' ? { at: 2, dur: 1.2 } : { at: 1, dur: 2 }, ts = [0.5, 1.4, 1.8, 2.0, 2.3, 2.9, 3.4], a = ts.map((t) => rec(kind, t, p)), sh = [3, 0, 6, 2, 5, 1, 4].map((i) => [i, rec(kind, ts[i], p)]);
  R.check(`${kind}: same t, same calls, in forward and shuffled order (16:9)`, sh.every(([i, s]) => s === a[i]));
  const b = ts.map((t) => rec(kind, t, p, 1080, 1920)), b2 = ts.slice().reverse().map((t) => rec(kind, t, p, 1080, 1920)).reverse();
  R.check(`${kind}: same in reverse order at 9:16`, b.every((s, i) => s === b2[i]));
  R.check(`${kind}: no NaN / undefined / Infinity in any call`, [...a, ...b].every((s) => !/NaN|undefined|Infinity/.test(s)));
}
R.check('filmBurn draws nothing outside [at - dur/2, at + dur/2]', rec('filmBurn', 1.39, { at: 2, dur: 1.2 }) === '' && rec('filmBurn', 2.61, { at: 2, dur: 1.2 }) === '');
{ const c = (t) => burnState(t, { at: 2, dur: 1.2 }).cover, peak = c(2), ok = [1.5, 1.7, 1.9, 2.1, 2.3, 2.5].every((t) => c(t) < peak);
  R.check(`filmBurn coverage peaks ON at (${peak.toFixed(3)} = peak param) and is lower on both sides`, Math.abs(peak - K2D.filmBurn.d.peak) < 1e-9 && ok, [1.5, 1.9, 2, 2.1, 2.5].map((t) => c(t).toFixed(3)).join(' ')); }
R.check('filmBurn: its sound swell is cued ON the peak', cuesFilm('filmBurn', { at: 2.5 })[0].t === 2.5 && cuesFilm('filmBurn', { at: 2.5 })[0].id === 'sfx/tx/film_burn');
R.check('fbm is a pure function in 0..1', [[0.1, 0.2], [3.3, 9.1], [17, 2]].every(([x, y]) => fbm(x, y, 5) === fbm(x, y, 5) && fbm(x, y, 5) >= 0 && fbm(x, y, 5) <= 1));
{ const f = (t) => flareState(t, { at: 1, dur: 2, path: [[0, 0.1, 0.5], [2, 0.9, 0.4]] });
  R.check('anamorphicFlare follows its path and is off outside its window', !f(0.99).on && !f(3.01).on && Math.abs(f(1).x - 0.1) < 1e-9 && Math.abs(f(3).x - 0.9) < 1e-9 && f(2).x > 0.45 && f(2).x < 0.55); }
/* layers/film.js */
{ const w = [0, 0.01, 0.02, 0.03].map((t) => weaveAt(t, { amp: 1, fps: 24 })), w2 = weaveAt(1 / 24 + 1e-4, { amp: 1, fps: 24 });
  R.check('gate weave is held inside a film frame and moves between frames', JSON.stringify(w[0]) === JSON.stringify(w[1]) && JSON.stringify(w2) !== JSON.stringify(w[0]));
  const mx = Math.max(...Array.from({ length: 2400 }, (_, i) => Math.max(Math.abs(weaveAt(i / 24, { amp: 1.4, rot: 0.05 }).x), Math.abs(weaveAt(i / 24, { amp: 1.4, rot: 0.05 }).y) / 1.4)));
  R.check(`gate weave stays within its amplitude (max ${mx.toFixed(3)} px for amp 1.4 at 1080)`, mx <= 1.4 + 1e-9);
  R.check('weave amp 0 = no transform', JSON.stringify(weaveAt(3, { amp: 0, rot: 0 })) === JSON.stringify({ x: 0, y: 0, r: 0 })); }
{ const v = Array.from({ length: 1000 }, (_, i) => flickerAt(i / 24, { amount: 0.03 }));
  R.check('flicker stays within 1 +- amount and is 1 when off', v.every((x) => Math.abs(x - 1) <= 0.03 + 1e-9) && flickerAt(5, { amount: 0 }) === 1); }
const wellFormed = (s) => s.startsWith('<filter') && s.endsWith('</filter>') && !/NaN|undefined|Infinity/.test(s) && (s.match(/<fe/g) || []).length >= 3;
R.check('halationSVG and inkSVG are well-formed filters (and scale the blur with the frame)', wellFormed(halationSVG('h', {}, 1080)) && wellFormed(inkSVG('i', {}, 1080)) && /stdDeviation="18"/.test(halationSVG('h', { radius: 9 }, 2160)));
R.check(`filmDefs works for every genre (${FILM_GENRE_NAMES.length}): grade + halation (+ ink for anime-ink) with matching url() ids`, FILM_GENRE_NAMES.every((g) => { const d = filmDefs(g, { id: 'x' }); return d.ids.every((i) => d.defs.includes(`id="${i}"`) && d.filter.includes(`url(#${i})`)) && d.ids.length >= (FILM_GENRES[g].ink ? 3 : 2); }));
R.check('letterbox maths: 2.39 on 1080p = 138 px bars, 2.0 = 60 px, 1.85 = 21 px, none when the frame is already that wide or no ratio (the templates never letterbox 9:16)', barsPx(1920, 1080, 2.39) === 138 && barsPx(1920, 1080, 2.0) === 60 && barsPx(1920, 1080, 1.85) === 21 && barsPx(2600, 1080, 2.39) === 0 && barsPx(1920, 1080, null) === 0);
/* the looks and their generated cubes */
R.check('every genre names a look that exists, and every film look is merged into LOOKS', FILM_GENRE_NAMES.every((g) => LOOKS[FILM_GENRES[g].look]) && Object.keys(FILM_LOOKS).every((k) => LOOKS[k]));
for (const k of Object.keys(FILM_LOOKS)) {
  const f = path.join(ROOT, 'layers/looks', `look.${k}.cube`), ok = fs.existsSync(f); let err = 0;
  if (ok) { const txt = fs.readFileSync(f, 'utf8'), P = prepare(lookParams(k)); for (const c of [[0.1, 0.2, 0.3], [0.5, 0.5, 0.5], [0.9, 0.4, 0.2], [0.02, 0.02, 0.05], [1, 1, 1]]) { const a = cubeLookup(txt, c), b = gradeRGB(P, c); err = Math.max(err, ...a.map((v, i) => Math.abs(v - b[i]) * 255)); } }
  R.check(`look.${k}.cube is generated (layers/tools/emit-looks.mjs) and matches the JS grade (max ${err.toFixed(2)} levels, trilinear 17^3)`, ok && err < 6);
}
process.exit(R.done() && R.failed ? 1 : 0);
