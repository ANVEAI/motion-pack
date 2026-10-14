/* round-3 type + layout parts (type/gfx/swap.js, badges.js, brand.js): node only, no browser, no GPU (CI runs this).
   run: node type/tests/r3.test.mjs
   Every id: non-empty at its hero time, empty before `at`, identical SVG in shuffled seek order, no NaN / undefined / Infinity for t in [-1, 8],
   every gfxCues() id and its sfxFor default resolve in sfx/manifest.json; plus behaviour checks: the accent swap reflows the line width, the selection box
   follows a text change and settles, the score shows the last value, LED cells flip to the new value, the speaker label is on when no line plays,
   the palette ends as stripes, the logo morph ends on the target mark, the backdrop flips ink for contrast, selectionZoomCss is pure. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, gfxCues, sfxFor, selectionZoomCss, stepAt } from '../gfx/index.js';
import { inkOn } from '../gfx/core.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const rng = (() => { let a = 11; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
const okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));

const IDS = ['type.accentSwap', 'type.wordSplitMedia', 'type.imageFill', 'type.strikeOut', 'type.glowWord', 'type.ledDigits', 'callout.selectionBox', 'counter.scoreIterate', 'counter.stepPill', 'caption.speakerTag', 'title.timeCard',
  'layout.paletteColumns', 'layout.logoConstruction', 'layout.mockupInContext', 'layout.typeSpecimen', 'layout.backdropSwap', 'layout.lineup'];
const ts = Array.from({ length: 90 }, (_, i) => -1 + i * 0.1);
for (const id of IDS) {
  check(`${id}: registered`, !!GFX[id]); if (!GFX[id]) continue;
  const opts = { at: 0.5, params: {} }, fwd = ts.map((t) => renderSVG(id, t, opts)), shuf = new Map(shuffle(ts.map((_, i) => i)).map((i) => [i, renderSVG(id, ts[i], opts)]));
  check(`${id}: identical SVG in forward and shuffled seek order (${ts.length} seeks)`, fwd.every((s, i) => s === shuf.get(i)));
  check(`${id}: empty before at`, renderSVG(id, 0.49, opts) === '' && renderSVG(id, -1, opts) === '');
  check(`${id}: non-empty at at + 1 s`, renderSVG(id, 1.5, opts).length > 200);
  const bad = fwd.findIndex((s) => /NaN|undefined|Infinity/.test(s)); check(`${id}: finite numbers over [-1, 8] s`, bad < 0, bad >= 0 ? 't=' + ts[bad].toFixed(2) : '');
  const cues = gfxCues(id, { at: 2, params: {} }), d = sfxFor(id);
  check(`${id}: ${cues.length} action cues + default '${d && d.id}' resolve in sfx/`, cues.length > 0 && cues.every((c) => okSfx(c.id) && c.t >= 2) && !!d && okSfx(d.id), JSON.stringify(cues.filter((c) => !okSfx(c.id))));
}
/* behaviour */
const num = (s, re) => [...s.matchAll(re)].map((m) => +m[1]);
{ const a = renderSVG('type.accentSwap', 0.5, { params: { words: ['go', 'a much longer word'], steps: [[0, 0], [0.2, 1]], align: 'left', at: [0.1, 0.5] } }), b = renderSVG('type.accentSwap', 2.0, { params: { words: ['go', 'a much longer word'], steps: [[0, 0], [0.2, 1]], align: 'left', at: [0.1, 0.5] } });
  check('accentSwap: the swapped word is the only accent word once settled', b.includes('a much longer word') && !b.includes('>go<') && a.length > 0); }
{ const p = { text: 'short', texts: [[0.6, 'a much longer line of text']] }, w0 = num(renderSVG('callout.selectionBox', 0.5, { params: p }), /H([\d.]+) V/g)[0], w1 = num(renderSVG('callout.selectionBox', 3.0, { params: p }), /H([\d.]+) V/g)[0];
  check('selectionBox: box grows to the new text (right edge moves out) and settles', w1 > w0 + 200, `${w0} -> ${w1}`); }
{ const s = renderSVG('counter.scoreIterate', 3.0, { params: {} }); check('scoreIterate: shows the last value 7.8 and a source line', s.includes('>7.8<') && s.includes('source: illustrative values')); }
{ const p = { text: '10', steps: [[1, '88']] }, a = renderSVG('type.ledDigits', 0.8, { params: p }), b = renderSVG('type.ledDigits', 2.5, { params: p });
  const lit = (s) => (s.split('<g fill="#FFB23A">')[1] || '').split('</g>')[0].match(/<circle/g)?.length || 0;
  check('ledDigits: lit cells change after the step ("10" -> "88" lights more cells)', a !== b && lit(b) > lit(a), `${lit(a)} -> ${lit(b)}`); }
{ const s = renderSVG('caption.speakerTag', 1.8, { params: {} }); check('speakerTag: the speaker label is on between lines', s.includes('AI voice') && s.includes('TTS')); }
{ const s = renderSVG('layout.paletteColumns', 3.0, { params: {} }), ys = num(s, /<rect x="[\d.]+" y="([\d.]+)" width="([\d.]+)"/g); check('paletteColumns: ends as stripes (6 distinct y positions)', new Set(ys).size >= 6, ys.join(',')); }
{ const a = renderSVG('layout.logoConstruction', 3.0, { params: {} }); check('logoConstruction: the mark is filled at the end', /fill-opacity="1"/.test(a)); }
check('backdropSwap: ink flips for contrast (dark on paper, white on violet and ink)', inkOn('#F3F1EC') === '#0E0E14' && inkOn('#4A18ED') === '#FFFFFF' && inkOn('#0E0E14') === '#FFFFFF' && inkOn('#FFD23A') === '#0E0E14');
{ const p = { zoomAt: 0.5 }, a = selectionZoomCss(1.0, { params: p }), b = selectionZoomCss(3.0, { params: p }), c = selectionZoomCss(1.0, { params: p });
  check('selectionZoomCss: pure, flat before zoomAt, at full zoom after', a === c && selectionZoomCss(0.2, { params: p }).endsWith('scale(1.0000)') && b.includes('scale(1.5000)')); }
{ const st = stepAt([[0, 'a'], [1, 'b'], [2, 'c']], 1.1, 0.4); check('stepAt: current, previous and progress', st.cur === 'b' && st.prev === 'a' && Math.abs(st.k - 0.25) < 1e-9); }
console.log(`\nr3: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
