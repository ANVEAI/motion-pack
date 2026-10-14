/* gfx def ids: two items in one host never share a def (node, no browser). run: node type/tests/ids.test.mjs
   mountGfx draws every item into ONE <svg>, and ids (clipPath, linearGradient, filter, mask ...) are document-wide: url(#lc) resolves to the FIRST element called lc. chart.line named its defs 'lc' and 'lg' by
   hand, so a second chart.line was clipped with the first chart's progress and filled with the first chart's gradient (a pixel diff of 220 708 of 1 036 800 in the right half, measured in Chrome); ui.stateMorph,
   ui.tabPillNav, type.wordSplitMedia and type.behindSubject built their ids from a hash that leaves out the item's `at` and most params, so same-parameter items that overlap in time collided too.
   renderInner now namespaces every id with a hash of the item's own markup, so the same id always means the same defs. This test draws TWO items of every registered id into one host (different `at`, so
   different progress) and fails on any id defined twice with different markup, and on any url(#id) that points nowhere. */
import { GFX, GFX_IDS, renderInner } from '../gfx/index.js'; import { ctxFor } from '../gfx/core.js';
import { reporter } from '../../layers/tests/harness.mjs';
const R = reporter('gfx ids'), ctx = ctxFor(1920, 1080, null, 1);
const DEFS = /<(clipPath|linearGradient|radialGradient|filter|mask|pattern|symbol|marker)\b[^>]*?\bid="([^"]+)"[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g, REFS = /url\(#([^)\s"']+)\)/g;
/* every id defined in a markup string, with its definition; a clash = one id, two different definitions */
const defsOf = (svg) => { const m = new Map(); for (const x of svg.matchAll(DEFS)) { if (!m.has(x[2])) m.set(x[2], new Set()); m.get(x[2]).add(x[0]); } return m; };
const host = (items, t) => items.map((it) => renderInner(it.id, t, it, ctx)).join('');
const clashes = (svg) => [...defsOf(svg)].filter(([, v]) => v.size > 1).map(([k]) => k), dangling = (svg) => { const have = new Set([...svg.matchAll(/(?<![\w-])id="([^"]+)"/g)].map((m) => m[1])); return [...new Set([...svg.matchAll(REFS)].map((m) => m[1]).filter((i) => !have.has(i)))]; };

/* 1. the reported case: two chart.line items, side by side, different start and colour */
{ const A = { id: 'chart.line', at: 0.2, params: { box: [0.05, 0.2, 0.4, 0.5] } }, B = { id: 'chart.line', at: 1.2, params: { box: [0.55, 0.2, 0.4, 0.5], accent: '#FF3B30' } }, svg = host([A, B], 2.0), d = defsOf(svg);
  R.check(`two chart.line items in one host: ${d.size} distinct def ids (4 expected: a clipPath and a gradient each), none defined twice with different markup, every url(#) resolves`, d.size === 4 && clashes(svg).length === 0 && dangling(svg).length === 0 && !/id="(lc|lg)"/.test(svg), [...d.keys()].join(' ')); }
/* 2. the four uid-based parts, same params at different times (the old hash left `at` out) */
for (const id of ['ui.stateMorph', 'ui.tabPillNav', 'type.wordSplitMedia', 'type.behindSubject']) {
  let bad = 0, split = 0, frames = 0; for (let t = 0.6; t <= 3.0001; t += 0.1) { const svg = host([{ id, at: 0.5 }, { id, at: 1.3 }], t); if (!svg) continue; frames++; if (clashes(svg).length || dangling(svg).length) bad++; if (defsOf(svg).size >= 2 && new Set([...defsOf(svg).keys()].map((k) => k.replace(/-k[a-z0-9]+$/, ''))).size < defsOf(svg).size) split++; }
  R.check(`${id}: two same-parameter items at 0.5 s and 1.3 s over ${frames} frames: no clash, nothing dangling; ${split} frames where the two items have different progress and therefore different defs (they used to share one id)`, bad === 0 && split > 0); }
/* 3. two items of EVERY id, drawn together at several times */
{ let bad = [], withDefs = 0, items = 0; const T = [0.6, 1.5, 2.4, 3.6];
  for (const id of GFX_IDS) { let any = false; for (const t of T) { const svg = host([{ id, at: 0.3 }, { id, at: 1.1 }], t); if (!svg) continue; items++; const c = clashes(svg), d = dangling(svg); if (defsOf(svg).size) any = true; if (c.length || d.length) bad.push(`${id}@${t}: ${c.length ? 'clash ' + c.join(',') : ''}${d.length ? ' dangling ' + d.join(',') : ''}`); } if (any) withDefs++; }
  R.check(`two items of each of the ${GFX_IDS.length} registered ids in one host at 4 times (${items} hosts, ${withDefs} ids that define defs): no id defined twice with different markup, no url(#) that points nowhere`, bad.length === 0 && withDefs > 40, bad.slice(0, 4).join(' | ')); }
/* 4. the same item draws the same markup alone and next to another (a picture never depends on the other item), and equal params in any spelling give the same string */
{ const A = { id: 'chart.line', at: 0.2, params: { box: [0.05, 0.2, 0.4, 0.5] } }, B = { id: 'chart.line', at: 1.2, params: { box: [0.55, 0.2, 0.4, 0.5] } }, a = renderInner(A.id, 2.0, A, ctx), b = renderInner(B.id, 2.0, B, ctx);
  R.check('a chart.line draws the same markup alone and next to another one; the host is the concatenation of its items', host([A, B], 2.0) === a + b && renderInner(B.id, 2.0, { ...B, params: { ...B.params } }, ctx) === b && a !== b); }
/* 5. ids survive nesting (ui.isometricTilt wraps another part) */
{ const svg = host([{ id: 'ui.isometricTilt', at: 0.2, params: { inner: { id: 'chart.line', at: 0, params: {} } } }, { id: 'chart.line', at: 1.0 }], 2.4);
  R.check('a part wrapped by ui.isometricTilt and a free chart.line in one host: no clash, nothing dangling', defsOf(svg).size >= 3 && clashes(svg).length === 0 && dangling(svg).length === 0); }

const res = R.done(); process.exit(R.failed ? 1 : 0);
