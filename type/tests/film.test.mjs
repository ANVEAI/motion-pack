/* film-lane type parts (type/gfx/film.js, 2026-10-16), node only (CI runs it): run  node type/tests/film.test.mjs
   Every part is registered with a default sound that exists, renders nothing before its start, draws at 16:9 and 9:16, gives the same markup in any seek order, survives
   hostile params; and the behaviours the trailer depends on: the slab title arrives by cut, the thin title opens its tracking, the distressed print re-seeds per boil frame,
   the cut-in-half title locks, the billing block justifies every line to one width, the credits roll at a constant speed, a quote without a source renders the refusal,
   "from the makers of" and the date card carry their placeholder labels, subtitles wrap to two lines, every opening-names style draws. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, sfxFor, gfxCues } from '../gfx/index.js';
import { FILM_GFX, FILM_IDS } from '../gfx/film.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok || !info ? '' : '  ' + info}`); };
const R = (id, t, params = {}, W = 1920, H = 1080, at = 0, dur) => renderSVG(id, t, { at, dur, params }, { W, H });

check(`all ${FILM_IDS.length} film parts are in the gfx registry with file type/gfx/film.js`, FILM_IDS.length === 15 && FILM_IDS.every((id) => GFX[id] === FILM_GFX[id] && GFX[id].file === 'type/gfx/film.js'));
check('every film part has a default sound that exists in the library', FILM_IDS.every((id) => { const d = sfxFor(id); return d && SFX.has('snd.' + d.id.split('/').slice(1).join('.')); }), FILM_IDS.filter((id) => !SFX.has('snd.' + (sfxFor(id)?.id || '').split('/').slice(1).join('.'))).join(' '));
check('gfxCues gives a cue at the item start for every film part', FILM_IDS.every((id) => { const c = gfxCues(id, { at: 2 }); return c.length && c[0].t >= 2; }));
for (const id of FILM_IDS) {
  const g = GFX[id], inD = (g.inF ?? 12) / 30, ts = [inD + 0.05, inD + 0.6, inD + 1.2, inD + (g.dur ?? 2) * 0.9], dims = [[1920, 1080], [1080, 1920]];
  const ok = dims.every(([W, H]) => { const a = ts.map((t) => R(id, t, {}, W, H)), b = [...ts].reverse().map((t) => R(id, t, {}, W, H)).reverse(); return a.every((s, i) => s && s === b[i] && !/NaN|undefined|Infinity/.test(s)); });
  check(`${id}: draws at 16:9 and 9:16, same markup in any seek order, nothing before its start`, ok && R(id, 0.9, {}, 1920, 1080, 1) === '');
  let hostile = true; for (const v of [NaN, Infinity, -1, 1e9, 0, '']) { try { const t0 = Date.now(), s = R(id, inD + 0.5, { size: v, speed: v, cps: v, width: v, y: v, big: v, angle: v, gap: v, boil: v, jitter: v }); hostile &&= typeof s === 'string' && Date.now() - t0 < 500 && !/NaN|Infinity/.test(s); } catch (e) { hostile = false; } }
  check(`${id}: hostile numbers (NaN, Infinity, -1, 1e9, 0, '') render fast and finite`, hostile);
}
const op = (s) => +(/<g opacity="([\d.]+)"/.exec(s)?.[1] ?? 1);
check('title.trailerSlab arrives by cut: full opacity on its first frame', op(R('title.trailerSlab', 0.0)) === 1);
const ls = (s) => +(/letter-spacing="([\d.]+)"[^>]*>THE LAST SIGNAL/.exec(s)?.[1] ?? NaN);
check('title.trailerThin keeps opening its tracking through the hold', ls(R('title.trailerThin', 2.5)) > ls(R('title.trailerThin', 1.0)));
const seed = (s) => /seed="(\d+)"/.exec(s)?.[1];
check('title.trailerDistressed re-seeds per boil frame (12 / s) and holds inside one', seed(R('title.trailerDistressed', 1.0)) === seed(R('title.trailerDistressed', 1.05)) && seed(R('title.trailerDistressed', 1.0)) !== seed(R('title.trailerDistressed', 1.1)));
const tr = (s) => [...s.matchAll(/translate\(([-\d.]+) ([-\d.]+)\)/g)].map((m) => +m[1]);
check('title.trailerCut: the halves are apart on entry and locked once in', Math.abs(tr(R('title.trailerCut', 0.05))[0]) > 20 && tr(R('title.trailerCut', 1.0)).every((x) => Math.abs(x) < 1e-6));
{ const s = R('credits.billingBlock', 1.0), L = [...s.matchAll(/textLength="([\d.]+)"/g)].map((m) => +m[1]);
  check(`credits.billingBlock justifies all ${L.length} lines to one width (textLength + spacingAndGlyphs) and labels the names placeholder`, L.length >= 4 && L.every((v) => v === L[0]) && /lengthAdjust="spacingAndGlyphs"/.test(s) && /placeholder credits/.test(s)); }
{ const y = (t) => +(/<text x="[\d.]+" y="([-\d.]+)"/.exec(R('credits.roll', t, { startY: 0.6 }))[1]);
  check('credits.roll scrolls at its constant speed (70 px/s at 1080)', Math.abs((y(1.5) - y(2.5)) - 70) < 0.05 && Math.abs((y(2.5) - y(3.5)) - 70) < 0.05); }
{ const s = R('card.quote', 1, { quote: 'A REAL LINE', source: '' });
  check('card.quote with a blank source renders the refusal, not the quote', /needs a source/.test(s) && !/A REAL LINE/.test(s));
  const t = R('card.quote', 1, { quote: 'A REAL LINE', source: 'Some Review, 2026' });
  check('card.quote with a source prints the quote and the source', /A REAL LINE/.test(t) && /SOME REVIEW/.test(t)); }
check('card.fromTheMakers prints its placeholder label by default and not once a real work is named', /placeholder/.test(R('card.fromTheMakers', 1)) && !/placeholder/.test(R('card.fromTheMakers', 1, { work: 'A REAL FILM', placeholder: false })));
check('card.releaseDate prints "placeholder date" when asked and has no digits by default', /placeholder date/.test(R('card.releaseDate', 1, { date: 'DECEMBER 12', placeholder: true })) && !/\d/.test(R('card.releaseDate', 1).replace(/<[^>]+>/g, '')));
{ const n = (W, H) => (R('caption.filmSubtitle', 0.5, { text: 'This line is long enough that it has to wrap onto two lines' }, W, H).match(/<text /g) || []).length;
  const fs16 = +/font-size="([\d.]+)"/.exec(R('caption.filmSubtitle', 0.5))[1], fs9 = +/font-size="([\d.]+)"/.exec(R('caption.filmSubtitle', 0.5, {}, 1080, 1920))[1];
  check('caption.filmSubtitle wraps a long line to two lines and sets 9:16 larger (frame-design: captions 64-80 px on 9:16)', n(1920, 1080) === 2 && fs9 > fs16 && fs9 >= 56); }
check('title.namesOver draws every style', ['drift', 'type', 'slam', 'split', 'flicker', 'glow'].every((st) => R('title.namesOver', 1.0, { style: st }).length > 100));
{ const a = R('title.namesOver', 0.3, { style: 'type' }), b = R('title.namesOver', 0.8, { style: 'type' }), txt = (s) => [...s.matchAll(/>([^<]*)<\/text>/g)].map((m) => m[1]).pop();
  check('title.namesOver type style types the name on', txt(a).length < txt(b).length); }
console.log(`\nfilm type: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
