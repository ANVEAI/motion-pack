/* round 4+5 proof parts (type/gfx/ui-proof.js, ui-trace.js, ui.promptBar attach): node only, no browser, no GPU (CI runs this).
   run: node type/tests/r45ui.test.mjs
   Every id (and its variants): non-empty at its hero time, empty before `at`, identical SVG in shuffled seek order, finite numbers over [-1, 9] s,
   the honesty label prints in frame, every cue and the sfxFor default resolve in sfx/manifest.json. Behaviour: the frontier is monotone and the same for
   unsorted input; a point / table / ticker without a source is refused (red card); branchTrace caption text matches the plan at every step time, red never
   outruns the run, the lint catches an unknown fork id; the table keeps its units and passes the readability floor; scene-bubble words follow their own
   timestamps without reflow and stay inside the 9:16 safe zone; the ticker is piecewise linear and stays inside the safe zone; the readout line never shifts
   (100 sampled frames); the personal tag's second tier arrives 0.3 s after the name and leaves first, inside the 9:16 safe zone; the attachment chip lands on its frame. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, gfxCues, uiCues, sfxFor, frontierOf, keysAt, fmtUnit, lintBranchTrace, traceTimes, traceCaptions, captionAt, bubbleGeo } from '../gfx/index.js';
import { ctxFor } from '../gfx/core.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const rng = (() => { let a = 45; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const num = (s, re) => [...s.matchAll(re)].map((m) => +m[1]);

/* ---------- 1. every id: defaults + variants ---------- */
const CASES = [['chart.scatterFrontier', 4.0, {}, 'illustrative data'], ['ui.branchTrace', 4.6, {}, 'illustrative run'], ['ui.branchTrace', 4.6, { run: [] }, 'illustrative run'],
  ['ui.dataTable', 3.0, {}, 'source: illustrative data'], ['ui.dataTable', 3.0, { bars: { row: 0 } }, 'source: illustrative data'], ['caption.sceneBubble', 3.2, {}, 'Speaker'], ['caption.sceneBubble', 1.6, { ai: true, speaker: 'Assistant' }, 'AI voice'],
  ['caption.sceneBubble', 3.2, { dock: { at: 3.0, to: [0.7, 0.3], scale: 0.6, title: 'Reminders' }, anchor: [[0, 0.35, 0.3], [4, 0.45, 0.32]] }, 'Reminders'],
  ['ui.costTicker', 2.2, {}, 'source: illustrative values'], ['ui.costTicker', 2.2, { mode: 'zero' }, 'source: illustrative values'], ['type.paramReadout', 1.3, {}, 'illustrative values'],
  ['lowerThird.personalTag', 1.2, {}, 'Off duty: restores old radios'], ['ui.promptBar.attach', 0.85, {}, 'What should we make?']];
const IDS = [...new Set(CASES.map((c) => c[0]))];
check(`8 round 4+5 ids registered in GFX (${IDS.join(', ')})`, IDS.length === 8 && IDS.every((id) => GFX[id]));
const ts = Array.from({ length: 100 }, (_, i) => -1 + i * 0.1);
for (const [id, hero, params, label] of CASES) {
  const tag = id + (Object.keys(params).length ? ' ' + JSON.stringify(params).slice(0, 40) : ''), opts = { at: 0.5, params }, fwd = ts.map((t) => renderSVG(id, t, opts)), shuf = new Map(shuffle(ts.map((_, i) => i)).map((i) => [i, renderSVG(id, ts[i], opts)]));
  check(`${tag}: identical SVG in forward and shuffled seek order (${ts.length} seeks)`, fwd.every((s, i) => s === shuf.get(i)));
  check(`${tag}: empty before at`, renderSVG(id, 0.49, opts) === '' && renderSVG(id, -1, opts) === '');
  const h = renderSVG(id, hero + 0.5, opts); check(`${tag}: non-empty at hero ${hero} s and the label "${label}" is in frame`, h.length > 500 && h.includes(label));
  const bad = fwd.findIndex((s) => /NaN|undefined|Infinity|\[object/.test(s)); check(`${tag}: finite numbers over [-1, 9] s`, bad < 0, bad >= 0 ? 't=' + ts[bad].toFixed(2) + ' ' + fwd[bad].match(/.{60}(NaN|undefined|Infinity|\[object).{20}/)?.[0] : '');
  const cues = gfxCues(id, { at: 2, params }), d = sfxFor(id);
  check(`${tag}: ${cues.length} action cues + default '${d && d.id}' resolve in sfx/, all after at`, cues.length > 0 && cues.every((c) => okSfx(c.id) && c.t >= 2 - 1e-9 && c.why) && !!d && okSfx(d.id), JSON.stringify(cues.filter((c) => !okSfx(c.id))));
  const big = renderSVG(id, hero, { at: 0, params: { ...params, scale: 1.5 } }), sz = (s) => Math.max(0, ...num(s, /font-size="([\d.]+)"/g)); check(`${tag}: scale 1.5 grows the type`, sz(big) > sz(renderSVG(id, hero, { at: 0, params })) * 1.4);
}
check('ui.* r45 ids are in the UI kit (uiCues), the others answer through gfxCues', uiCues('ui.dataTable', { at: 1 }).length > 0 && uiCues('ui.promptBar.attach', { at: 1 }).length > 0 && uiCues('chart.scatterFrontier', { at: 1 }).length === 0 && gfxCues('chart.scatterFrontier', { at: 1 }).length > 0);

/* ---------- 2. chart.scatterFrontier ---------- */
const P = GFX['chart.scatterFrontier'].d.points, fr = frontierOf(P), fr2 = frontierOf(shuffle(P)), fr3 = frontierOf([...P].reverse());
check(`scatterFrontier: frontier ${fr.map((q) => q.label).join(' > ')} is monotone (x and y rise together) and identical for unsorted input`, fr.length >= 3 && fr.every((q, i) => !i || (q.x > fr[i - 1].x && q.y > fr[i - 1].y)) && JSON.stringify(fr) === JSON.stringify(fr2) && JSON.stringify(fr) === JSON.stringify(fr3));
check('scatterFrontier: no point off the frontier beats a frontier point on both axes', P.every((q) => fr.includes(q) || fr.some((f) => f.x <= q.x && f.y >= q.y)));
{ const pts = P.map((q, i) => (i === 2 ? { ...q, source: '' } : q)), s = renderSVG('chart.scatterFrontier', 4, { params: { points: pts } });
  check('scatterFrontier: a point without its own source is refused (red "needs a source" card, no points drawn)', s.includes('needs a source') && s.includes('Model C') && !s.includes('Model A') && gfxCues('chart.scatterFrontier', { params: { points: pts } })[0].id === 'sfx/ui/error'); }
{ const p = GFX['chart.scatterFrontier'].d, a = renderSVG('chart.scatterFrontier', 0.6, { params: p }), b = renderSVG('chart.scatterFrontier', 4.0, { params: p });
  check('scatterFrontier: the hero star and callout land last (absent at 0.6 s, present at 4 s)', !a.includes('Highest score') && b.includes('Highest score') && b.includes('Acme')); }

/* ---------- 3. ui.branchTrace ---------- */
const BT = GFX['ui.branchTrace'].d;
for (const [name, run] of [['fail', BT.run], ['pass', []]]) { const p = { ...BT, run }, caps = traceCaptions(p); let ok = true, why = '';
  for (const [t, txt] of caps) { const st = captionAt(p, t + 0.3), svg = renderSVG('ui.branchTrace', t + 0.3, { params: p }); if (st.cur !== txt || !svg.includes(txt.replace(/"/g, '&quot;'))) { ok = false; why = `${t}: ${txt}`; } }
  check(`branchTrace ${name}: the caption bar shows each planned line at its step time (${caps.length} lines)`, ok, why);
  const end = renderSVG('ui.branchTrace', 6, { params: p }); check(`branchTrace ${name}: the outcome badge says ${name === 'fail' ? 'Fail' : 'Pass'}`, end.includes(name === 'fail' ? '>Fail<' : '>Pass<') && !end.includes(name === 'fail' ? '>Pass<' : '>Fail<')); }
{ const tm = traceTimes(BT); let ok = !!tm.fail; for (let k = 1; k <= 2; k++) { const st = tm.edgeStart(tm.fail.lane, k), r = tm.red(tm.fail.lane, k, st); if (r == null || r < st || r < tm.fail.t + (k - tm.fail.k) * BT.delay - 1e-9) ok = false; }
  check(`branchTrace: the first wrong pick (lane ${tm.fail.lane}, step ${tm.fail.k}, t ${tm.fail.t.toFixed(2)} s) spreads red downstream, never before the run reaches an edge`, ok && tm.red(0, 1, 2) == null);
  const a = renderSVG('ui.branchTrace', tm.fail.t - 0.05, { params: BT }), b = renderSVG('ui.branchTrace', tm.fail.t + 0.4, { params: BT });
  check('branchTrace: the wrong fork turns red only from its step time', !/stroke="#E5484D" stroke-width="[\d.]+"\/><text[^>]*>Name only/.test(a) && b.includes('#E5484D') && (b.match(/#E5484D/g) || []).length > (a.match(/#E5484D/g) || []).length); }
{ const errs = lintBranchTrace({ ...BT, run: ['id-nope'] }), errs2 = lintBranchTrace({ ...BT, run: ['id-name', 'id-code'] }), s = renderSVG('ui.branchTrace', 3, { params: { ...BT, run: ['id-nope'] } });
  check('branchTrace lint: an unknown fork id and two picks for one step both fail; the part shows the error instead of a wrong diagram', errs.length === 1 && errs2.length === 1 && lintBranchTrace(BT).length === 0 && s.includes('does not match')); }

/* ---------- 4. ui.dataTable ---------- */
{ const s = renderSVG('ui.dataTable', 4.0, {}), d = GFX['ui.dataTable'].d;
  check('dataTable: units are formatted by the part (K, %, m s, $, ms) and counts end on the data', ['12.4K', '81.9%', '7m 14s', '$0.35', '505 ms'].every((v) => s.includes('>' + v + '<')) && fmtUnit(2.5e6, 'M') === '2.50M' && fmtUnit(65, 'dur') === '1m 05s');
  check('dataTable: numerals are tabular (columns do not jitter while counting)', (s.match(/tabular-nums/g) || []).length >= d.rows.length * 3);
  const sizes = num(s.replace(/<text[^>]*>source:[^<]*<\/text>/, ''), /font-size="([\d.]+)"/g), minCell = Math.min(...num(s, /font-size="([\d.]+)"[^>]*text-anchor="end"[^>]*font-variant-numeric/g));
  check(`dataTable 360 px check: cells ${minCell} px, all text >= ${Math.min(...sizes)} px at 1080p (cells >= 30 px = ${(minCell * 360 / 1920).toFixed(1)} px on a 360 px wide phone)`, minCell >= 30 && Math.min(...sizes) >= 24);
  const mid = renderSVG('ui.dataTable', 0.5 + 0.55, {}), early = renderSVG('ui.dataTable', 0.3, {}); check('dataTable: rows stagger in and count up (row 6 absent early, values below final mid-count)', !early.includes('Median reply time') && !mid.includes('>18.1K<'));
  const r = renderSVG('ui.dataTable', 3, { params: { source: '' } }); check('dataTable: no source -> refused (red card, no numbers)', r.includes('needs a source') && !r.includes('12.4K')); }

/* ---------- 5. caption.sceneBubble ---------- */
{ const words = [{ w: 'Hello', s: 0.5, e: 0.8 }, { w: 'there,', s: 0.9, e: 1.2 }, { w: 'world', s: 1.6, e: 1.9 }], p = { words }, c = ctxFor(1920, 1080), a = renderSVG('caption.sceneBubble', 1.2, { params: p }), b = renderSVG('caption.sceneBubble', 1.7, { params: p });
  check('sceneBubble: words appear on their own timestamps (words.json shape {w, s, e})', a.includes('>Hello<') && a.includes('>there,<') && !a.includes('>world<') && b.includes('>world<'));
  const g1 = bubbleGeo({ ...GFX['caption.sceneBubble'].d, ...p }, c, 1.2), g2 = bubbleGeo({ ...GFX['caption.sceneBubble'].d, ...p }, c, 1.9); check('sceneBubble: width fixed from the final text (no reflow while words arrive)', g1.bw === g2.bw && g1.bh === g2.bh);
  const cues = gfxCues('caption.sceneBubble', { at: 2, params: p }), cap = cues.find((q) => q.why === 'captured'); check('sceneBubble: "captured" cue is sfx/ui/success at the last word end + 0.3 s', cap && cap.id === 'sfx/ui/success' && Math.abs(cap.t - (2 + 1.9 + 0.3)) < 1e-6);
  const d = GFX['caption.sceneBubble'].d, tall = ctxFor(1080, 1920); let inside = true; for (const an of [[0.4, 0.3], [0.95, 0.04], [0.02, 0.97], [[0, 0.1, 0.1], [3, 0.9, 0.9]]]) for (const u of [1, 2.5, 4]) { const G = bubbleGeo({ ...d, anchor: an }, tall, u), S = tall.safe; if (G.x < S.x0 - 0.5 || G.x + G.bw > S.x1 + 0.5 || G.y < S.y0 - 0.5 || G.y + G.bh > S.y1 + 0.5) inside = false; }
  check('sceneBubble: the bubble stays inside the 9:16 safe zone for any anchor (corners and a moving track)', inside);
  const t2 = renderSVG('caption.sceneBubble', 3.3, { params: { anchor: [[0, 0.3, 0.3], [4, 0.6, 0.5]] } }), t3 = renderSVG('caption.sceneBubble', 3.6, { params: { anchor: [[0, 0.3, 0.3], [4, 0.6, 0.5]] } }); check('sceneBubble: a tracked anchor moves the bubble with time', t2 !== t3); }

/* ---------- 6. ui.costTicker ---------- */
{ check('costTicker: keys are piecewise linear (held before / after, linear between)', keysAt([[1, 0], [3, 100], [4, 40]], 2) === 50 && keysAt([[1, 0], [3, 100], [4, 40]], 3.5) === 70 && keysAt([[1, 0], [3, 100]], 0) === 0 && keysAt([[1, 0], [3, 100]], 9) === 100);
  const a = renderSVG('ui.costTicker', 0.3, {}), b = renderSVG('ui.costTicker', 3.5, {}); check('costTicker: counters reach the last key; cost turns the warn colour past its threshold', b.includes('>48,200<') && b.includes('>$0.97<') && /fill="#e39a12"[^>]*>\$0\.97/i.test(b) && /fill="#ffffff"[^>]*>\$0\.00/i.test(a));
  const tall = ctxFor(1080, 1920); let inside = true; for (const an of [[0.5, 0.5], [0.98, 0.02], [0.02, 0.98]]) { const s = renderSVG('ui.costTicker', 2, { params: { anchor: an } }, { W: 1080, H: 1920 }), m = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="rgba\(14,13,20,0.84\)"/.exec(s), S = tall.safe;
    if (!m || +m[1] < S.x0 - 0.5 || +m[1] + +m[3] > S.x1 + 0.5 || +m[2] < S.y0 - 0.5 || +m[2] + +m[4] > S.y1 + 0.5) inside = false; }
  check('costTicker: the chip stays inside the 9:16 safe zone for any anchor', inside);
  const z = renderSVG('ui.costTicker', 2, { params: { mode: 'zero' } }), r = renderSVG('ui.costTicker', 2, { params: { source: '' } }); check("costTicker: mode 'zero' prints $0 per query; no source -> refused", z.includes('>$0<') && z.includes('PER QUERY') && r.includes('needs a source') && !r.includes('TOKENS')); }

/* ---------- 7. type.paramReadout ---------- */
{ const geo = (s) => [...num(s, /<clipPath id="[^"]+"><rect x="([\d.]+)"/g), ...num(s, /<text x="([\d.]+)"[^>]*font-style="italic"/g)].join(','); const ref = geo(renderSVG('type.paramReadout', 1.0, {})); let same = true, vals = new Set();
  for (let i = 0; i < 100; i++) { const t = 0.5 + i * 0.03, s = renderSVG('type.paramReadout', t, {}); if (geo(s) !== ref) same = false; vals.add(s); }
  check(`type.paramReadout: no layout shift across 100 sampled frames (slot and name x identical; ${vals.size} distinct frames)`, same && ref.split(',').length === 6 && vals.size > 20);
  const end = renderSVG('type.paramReadout', 3.0, {}); check('type.paramReadout: ends on the last keys (N = 1,024, error 0.33%, θ 37.5°) in a math-italic face', end.includes('>1,024<') && end.includes('>0.33%<') && end.includes('>37.5°<') && end.includes('font-style="italic"')); }

/* ---------- 8. lowerThird.personalTag ---------- */
{ const d = GFX['lowerThird.personalTag'], at = 0.5, tot = (d.inF + d.outF) / 30 + d.dur, has = (t) => renderSVG('lowerThird.personalTag', t, { at }).includes(d.d.personal);
  check('personalTag: tier 2 arrives 0.3 s after the name and leaves before it', renderSVG('lowerThird.personalTag', at + 0.2, { at }).includes(d.d.name) && !has(at + 0.29) && has(at + 0.4) && has(at + tot - d.outF / 30 - 0.4) && !has(at + tot - d.outF / 30 + 0.02) && renderSVG('lowerThird.personalTag', at + tot - d.outF / 30 + 0.02, { at }).includes(d.d.name));
  const s = renderSVG('lowerThird.personalTag', 1.5, {}, { W: 1080, H: 1920 }), S = ctxFor(1080, 1920).safe, rs = [...s.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="rgba\(12,12,18,0.74\)"/g)].map((m) => m.slice(1).map(Number));
  check(`personalTag: both tiers inside the 9:16 safe zone (${rs.length} panels)`, rs.length === 2 && rs.every(([x, y, w, h]) => x >= S.x0 - 0.5 && x + w <= S.x1 + 0.5 && y >= S.y0 - 0.5 && y + h <= S.y1 + 0.5)); }

/* ---------- 9. ui.promptBar.attach ---------- */
{ const d = GFX['ui.promptBar.attach'].d, f = 1 / 30, before = renderSVG('ui.promptBar.attach', d.attach.dropAt - f, {}), after = renderSVG('ui.promptBar.attach', d.attach.dropAt + f, {});
  check(`promptBar.attach: the chip docks on the planned frame (dropAt ${d.attach.dropAt} s = frame ${Math.round(d.attach.dropAt * 30)})`, !before.includes('>banner-sketch.png<') && after.includes('>banner-sketch.png<'));
  const cues = uiCues('ui.promptBar.attach', {}); check('promptBar.attach: grab, drag and dock cues (click, swish, pop at dropAt)', cues.some((c) => c.id === 'sfx/ui/pop' && c.t === d.attach.dropAt) && cues.some((c) => c.id === 'sfx/device/mouse_click'));
  const typing = renderSVG('ui.promptBar.attach', d.typeAt + 0.4, {}); check('promptBar.attach: the request is typed after the chip docks, right of the chip', !renderSVG('ui.promptBar.attach', d.typeAt - 0.05, {}).includes('>Turn') && />Turn thi/.test(typing) && +(/x="([\d.]+)"[^>]*>Turn/.exec(typing) || [0, 0])[1] > +(/x="([\d.]+)"[^>]*>banner-sketch/.exec(typing) || [0, 1e9])[1]);
  check('ui.promptBar without attach is unchanged (no chip, no thumbnail)', !renderSVG('ui.promptBar', 1.95, {}).includes('<image') && !renderSVG('ui.promptBar', 1.95, {}).includes('banner-sketch')); }
console.log(`\nr45ui: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
