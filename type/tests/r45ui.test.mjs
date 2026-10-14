/* round 4+5 proof parts (type/gfx/ui-proof.js, ui-trace.js, ui.promptBar attach): node only, no browser, no GPU (CI runs this).
   run: node type/tests/r45ui.test.mjs
   Every id (and its variants): non-empty at its hero time, empty before `at`, identical SVG in shuffled seek order, finite numbers over [-1, 9] s,
   the honesty label prints in frame, every cue and the sfxFor default resolve in sfx/manifest.json. Behaviour: the frontier is monotone and the same for
   unsorted input; a point / table / ticker without a source is refused (red card); branchTrace caption text matches the plan at every step time, red never
   outruns the run, the lint catches an unknown fork id; the table keeps its units and passes the readability floor; scene-bubble words follow their own
   timestamps without reflow and stay inside the 9:16 safe zone; the ticker is piecewise linear and stays inside the safe zone; the readout line never shifts
   (100 sampled frames); the personal tag's second tier arrives 0.3 s after the name and leaves first, inside the 9:16 safe zone and readable at 360 px; the attachment chip
   lands on its frame. Phone checks (1080 x 1920 -> 360 px wide): the DEFAULT table's number cells >= 12 px with every text inside the panel and no overlaps (the part picks a phone
   layout on a tall frame), the scatter's axis label and footnote never collide, the docked list card of the scene bubble is clamped inside the safe zone.
   Robustness: every frame of every default and variant is well-formed XML (no duplicate attribute, balanced tags, escaped &); a partial attach object, a LIST of attachments, partial nested
   overrides (x / y / better / quadrant, zero / counters, dock / words, input / outcome / decision, fields) and blank sources never throw, never print NaN / undefined and keep their cues
   finite; ui.costTicker and caption.sceneBubble follow layout.cornerPin data (a quad or keys, px or frac, composition time). */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, gfxCues, uiCues, sfxFor, frontierOf, keysAt, fmtUnit, lintBranchTrace, traceTimes, traceCaptions, captionAt, bubbleGeo, attachList, niceTicks, noSrc, trackAt } from '../gfx/index.js';
import { ctxFor, measure, BRAND } from '../gfx/core.js';
import { homography, applyH, cornersAt } from '../gfx/cornerpin.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const rng = (() => { let a = 45; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const num = (s, re) => [...s.matchAll(re)].map((m) => +m[1]);
/* every <text> in an SVG string with an estimated box (core.js measure(): canvas metrics in a browser, an estimate in node), and the largest rect (the panel) */
const TXT = /<text x="([\d.-]+)" y="([\d.-]+)" font-family="[^"]*" font-size="([\d.]+)" font-weight="(\d+)" fill="[^"]*" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g;
const boxes = (svg) => [...svg.matchAll(TXT)].map(([, x, y, sz, wt, an, str]) => { const w = measure(str.replace(/&amp;/g, '&'), +sz, { weight: +wt }), l = an === 'end' ? +x - w : an === 'middle' ? +x - w / 2 : +x; return { str, size: +sz, l, r: l + w, t: +y - 0.8 * +sz, b: +y + 0.25 * +sz }; });
const panelOf = (svg) => [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number)).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
/* strict well-formedness for the SVG strings (what a data-URI <img>, resvg or an XML parser would demand; browsers' innerHTML forgives all of it): tags balance, no attribute twice on one tag, attributes quoted, & escaped */
const wellFormed = (svg) => { const errs = [], stack = []; for (const m of svg.matchAll(/<[^>]*>|[^<]+/g)) { const t = m[0];
    if (t[0] !== '<') { if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(t)) errs.push('unescaped & in text'); continue; }
    if (!/^<\/?[\w:.-]+(\s+[\w:.-]+\s*=\s*"[^"<]*")*\s*\/?>$/.test(t)) { errs.push('bad tag ' + t.slice(0, 80)); continue; }
    const name = /^<\/?([\w:.-]+)/.exec(t)[1]; if (t[1] === '/') { if (stack.pop() !== name) errs.push('unbalanced </' + name + '>'); continue; }
    const names = [...t.matchAll(/\s([\w:.-]+)\s*=\s*"[^"]*"/g)].map((q) => q[1]); const dup = names.find((n, i) => names.indexOf(n) !== i); if (dup) errs.push(`duplicate attribute ${dup} in ${t.slice(0, 60)}`);
    for (const q of t.matchAll(/="([^"]*)"/g)) if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(q[1])) errs.push('unescaped & in attribute ' + q[1].slice(0, 40));
    if (!/\/>$/.test(t)) stack.push(name); }
  if (stack.length) errs.push('unclosed ' + stack.join(',')); return [...new Set(errs)]; };
const overlaps = (bs) => { const out = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) out.push(`"${a.str}" x "${b.str}"`); } return out; };

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
  const xml = fwd.map((sv) => (sv ? wellFormed(sv) : [])).findIndex((e) => e.length); check(`${tag}: every frame over [-1, 9] s is well-formed XML`, xml < 0, xml >= 0 ? 't=' + ts[xml].toFixed(2) + ' ' + wellFormed(fwd[xml]).slice(0, 2).join('; ') : '');
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

{ for (const [name, W, H, params] of [['16:9', 1920, 1080, {}], ['9:16', 1080, 1920, { box: [0.04, 0.2, 0.92, 0.6] }]]) { const sv = renderSVG('chart.scatterFrontier', 4.6, { params }, { W, H }), bs = boxes(sv), pn = panelOf(sv), axis = bs.filter((q) => q.str.startsWith('Cost per task')), ov = overlaps(bs.filter((q) => !/^Model |^Acme$/.test(q.str)));
    check(`scatterFrontier ${name}: axis label, footnote and every text inside the panel with no text overlapping the axis label or footnote`, axis.length === 1 && bs.every((q) => q.l >= pn[0] - 1 && q.r <= pn[0] + pn[2] + 1 && q.b <= pn[1] + pn[3] + 1) && ov.length === 0, ov.slice(0, 3).join('; ')); } }

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
  check(`dataTable 16:9 desktop / TV floor: cells ${minCell} px, all text >= ${Math.min(...sizes)} px at 1080p. A 6-row table on a 16:9 frame shown 360 px wide is ${(minCell * 360 / 1920).toFixed(1)} px: 12 px needs 64 px numerals (scale 2), which fits only a short table (the 16:9 phone path below) or the 9:16 layout`, minCell >= 30 && Math.min(...sizes) >= 24);
  { const s9 = renderSVG('ui.dataTable', 4.0, {}, { W: 1080, H: 1920 }), bs = boxes(s9), pn = panelOf(s9), cells = bs.filter((q) => /^[\d$]/.test(q.str)), min9 = Math.min(...cells.map((q) => q.size));
    check(`dataTable 360 px check (the DEFAULT 6 x 4 table on a 9:16 frame, 1080 x 1920, no params: the part picks the phone layout): ${cells.length} number cells are >= ${min9.toFixed(1)} px = ${(min9 * 360 / 1080).toFixed(1)} px on a 360 px wide phone (floor 12 px); every text, the wrapped finding included, sits inside the panel and none overlap`,
      cells.length >= 18 && min9 * 360 / 1080 >= 12 && bs.every((q) => q.l >= pn[0] - 1 && q.r <= pn[0] + pn[2] + 1) && overlaps(bs).length === 0, overlaps(bs).slice(0, 3).join('; '));
    const o9 = renderSVG('ui.dataTable', 4.0, { params: { box: [0.1, 0.1, 0.8, 0.8], scale: 1 } }, { W: 1080, H: 1920 }), m9 = Math.min(...boxes(o9).filter((q) => /^[\d$]/.test(q.str)).map((q) => q.size));
    check('dataTable: an explicit box / scale overrides the per-frame defaults (box [0.1, 0.1, 0.8, 0.8], scale 1 on 9:16 gives 32 px numerals = 10.7 px on a phone)', m9 === 32 && Math.abs(min9 - 36.8) < 0.05);
    const p4 = { rows: GFX['ui.dataTable'].d.rows.slice(0, 4), finding: '', scale: 2, box: [0.02, 0.02, 0.96, 0.96] }, s4 = renderSVG('ui.dataTable', 4.0, { params: p4 }), b4 = boxes(s4), pn4 = panelOf(s4), c4 = b4.filter((q) => /^[\d$]/.test(q.str)), m4 = Math.min(...c4.map((q) => q.size));
    check(`dataTable 16:9 phone path: 4 rows, no finding, scale 2, box [0.02, 0.02, 0.96, 0.96] -> numerals ${m4} px = ${(m4 * 360 / 1920).toFixed(1)} px on a 360 px wide 16:9 frame (floor 12 px); every text inside the panel, none overlap`, c4.length >= 12 && m4 * 360 / 1920 >= 12 - 1e-9 && b4.every((q) => q.l >= pn4[0] - 1 && q.r <= pn4[0] + pn4[2] + 1 && q.t >= pn4[1] - 1 && q.b <= pn4[1] + pn4[3] + 1) && overlaps(b4).length === 0, overlaps(b4).slice(0, 3).join('; ')); }
  const mid = renderSVG('ui.dataTable', 0.5 + 0.55, {}), early = renderSVG('ui.dataTable', 0.3, {}); check('dataTable: rows stagger in and count up (row 6 absent early, values below final mid-count)', !early.includes('Median reply time') && !mid.includes('>18.1K<'));
  const r = renderSVG('ui.dataTable', 3, { params: { source: '' } }); check('dataTable: no source -> refused (red card, no numbers)', r.includes('needs a source') && !r.includes('12.4K')); }

/* ---------- 5. caption.sceneBubble ---------- */
{ const words = [{ w: 'Hello', s: 0.5, e: 0.8 }, { w: 'there,', s: 0.9, e: 1.2 }, { w: 'world', s: 1.6, e: 1.9 }], p = { words }, c = ctxFor(1920, 1080), a = renderSVG('caption.sceneBubble', 1.2, { params: p }), b = renderSVG('caption.sceneBubble', 1.7, { params: p });
  check('sceneBubble: words appear on their own timestamps (words.json shape {w, s, e})', a.includes('>Hello<') && a.includes('>there,<') && !a.includes('>world<') && b.includes('>world<'));
  const g1 = bubbleGeo({ ...GFX['caption.sceneBubble'].d, ...p }, c, 1.2), g2 = bubbleGeo({ ...GFX['caption.sceneBubble'].d, ...p }, c, 1.9); check('sceneBubble: width fixed from the final text (no reflow while words arrive)', g1.bw === g2.bw && g1.bh === g2.bh);
  const cues = gfxCues('caption.sceneBubble', { at: 2, params: p }), cap = cues.find((q) => q.why === 'captured'); check('sceneBubble: "captured" cue is sfx/ui/success at the last word end + 0.3 s', cap && cap.id === 'sfx/ui/success' && Math.abs(cap.t - (2 + 1.9 + 0.3)) < 1e-6);
  const d = GFX['caption.sceneBubble'].d, tall = ctxFor(1080, 1920); let inside = true; for (const an of [[0.4, 0.3], [0.95, 0.04], [0.02, 0.97], [[0, 0.1, 0.1], [3, 0.9, 0.9]]]) for (const u of [1, 2.5, 4]) { const G = bubbleGeo({ ...d, anchor: an }, tall, u), S = tall.safe; if (G.x < S.x0 - 0.5 || G.x + G.bw > S.x1 + 0.5 || G.y < S.y0 - 0.5 || G.y + G.bh > S.y1 + 0.5) inside = false; }
  check('sceneBubble: the bubble stays inside the 9:16 safe zone for any anchor (corners and a moving track)', inside);
  const dk = { dock: { at: 1.5, to: [0.5, 0.5], scale: 0.6 } }; let dockIn = true; for (const to of [[0.99, 0.01], [0.01, 0.99], [0.5, 0.5]]) for (const u of [0, 2.5, 4]) { const G = bubbleGeo({ ...d, dock: { ...dk.dock, to } }, tall, u), S = tall.safe;
    if (G.dx - 24 * G.S / d.size < S.x0 - 0.5 || G.dx - 24 * G.S / d.size + G.dw > S.x1 + 0.5 || G.dy - 74 * G.S / d.size < S.y0 - 0.5 || G.dy - 74 * G.S / d.size + G.dh > S.y1 + 0.5) dockIn = false; }
  check('sceneBubble: the docked list card is clamped inside the 9:16 safe zone for any dock target (corners included)', dockIn);
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
  const fs9 = Math.min(...[d.d.name, d.d.role, d.d.personal].map((w) => +(new RegExp(`font-size="([\\d.]+)"[^>]*>${w}<`).exec(s) || [0, 0])[1])); check(`personalTag 360 px check: name, role and personal line are >= ${fs9.toFixed(1)} px on a 1080 px wide 9:16 frame = ${(fs9 * 360 / 1080).toFixed(1)} px on a 360 px wide phone (floor 12 px; the avatar initials are decoration)`, fs9 * 360 / 1080 >= 12);
  check(`personalTag: both tiers inside the 9:16 safe zone (${rs.length} panels)`, rs.length === 2 && rs.every(([x, y, w, h]) => x >= S.x0 - 0.5 && x + w <= S.x1 + 0.5 && y >= S.y0 - 0.5 && y + h <= S.y1 + 0.5)); }

/* ---------- 9. ui.promptBar.attach ---------- */
{ const d = GFX['ui.promptBar.attach'].d, f = 1 / 30, before = renderSVG('ui.promptBar.attach', d.attach.dropAt - f, {}), after = renderSVG('ui.promptBar.attach', d.attach.dropAt + f, {});
  check(`promptBar.attach: the chip docks on the planned frame (dropAt ${d.attach.dropAt} s = frame ${Math.round(d.attach.dropAt * 30)})`, !before.includes('>banner-sketch.png<') && after.includes('>banner-sketch.png<'));
  const cues = uiCues('ui.promptBar.attach', {}); check('promptBar.attach: grab, drag and dock cues (click, swish, pop at dropAt)', cues.some((c) => c.id === 'sfx/ui/pop' && c.t === d.attach.dropAt) && cues.some((c) => c.id === 'sfx/device/mouse_click'));
  const typing = renderSVG('ui.promptBar.attach', d.typeAt + 0.4, {}); check('promptBar.attach: the request is typed after the chip docks, right of the chip', !renderSVG('ui.promptBar.attach', d.typeAt - 0.05, {}).includes('>Turn') && />Turn thi/.test(typing) && +(/x="([\d.]+)"[^>]*>Turn/.exec(typing) || [0, 0])[1] > +(/x="([\d.]+)"[^>]*>banner-sketch/.exec(typing) || [0, 1e9])[1]);
  check('ui.promptBar without attach is unchanged (no chip, no thumbnail)', !renderSVG('ui.promptBar', 1.95, {}).includes('<image') && !renderSVG('ui.promptBar', 1.95, {}).includes('banner-sketch')); }
{ /* a PARTIAL attach object falls back to ATTACH key by key (the documented example omits size and dragDur); the cue times stay numbers */
  const bad = (id, params) => { const out = []; for (let t = -1; t < 6; t += 0.1) { const sv = renderSVG(id, t, { params }); if (/NaN|undefined|Infinity/.test(sv)) out.push(t.toFixed(1)); } return out; };
  const doc = { attach: { kind: 'sketch', name: 'banner-sketch.png', from: [0.3, 0.17], dropAt: 1.15 } };
  for (const [id, params] of [['ui.promptBar.attach', doc], ['ui.promptBar', doc], ['ui.promptBar.attach', { attach: { name: 'brief.pdf' } }], ['ui.promptBar', { attach: { name: 'brief.pdf', kind: 'file' } }], ['ui.promptBar', { attach: true }], ['ui.promptBar.attach', { attach: { kind: 'image', dropAt: 0.5, dragDur: 2 } }]]) {
    const cues = uiCues(id, { params }), nb = bad(id, params); check(`${id} ${JSON.stringify(params.attach).slice(0, 56)}: no NaN / undefined over [-1, 6] s and every cue time is a finite number (${cues.length} cues)`, nb.length === 0 && cues.every((q) => Number.isFinite(q.t)), nb.slice(0, 3).join(','));
    const x = Array.from({ length: 70 }, (_, i) => wellFormed(renderSVG(id, i * 0.1, { params }))).find((e) => e.length); check(`${id} ${JSON.stringify(params.attach).slice(0, 56)}: well-formed XML`, !x, x && x.join('; ')); }
  const al = attachList({ attach: { name: 'a' } })[0]; check('attachList fills every missing key from ATTACH and drops undefined / null values', al.size === 200 && al.dragDur === 0.85 && al.dropAt === 1.15 && attachList({ attach: { size: undefined, dropAt: null } })[0].size === 200 && attachList({ attach: null }).length === 0 && attachList({}).length === 0); }
{ /* a LIST of attachments: chips dock left to right in dropAt order, the text starts after the last chip, every grab / drag / dock has its cue */
  const list = [{ kind: 'image', name: 'photo.jpg', dropAt: 1.0 }, { kind: 'file', name: 'brief.pdf', dropAt: 2.3 }], p = { attach: list }, f = 1 / 30, name = (sv, n) => +(new RegExp(`x="([\\d.]+)"[^>]*>${n.replace('.', '\\.')}<`).exec(sv) || [0, 0])[1];
  const mid = renderSVG('ui.promptBar', 1.6, { params: p }), end = renderSVG('ui.promptBar', 3.3, { params: p }), cues = uiCues('ui.promptBar', { params: p }), ts = promptTypeAt(p);
  check('promptBar attach list: chip 1 docks at its dropAt, chip 2 only at its own (not before); the chips sit left to right', !renderSVG('ui.promptBar', 1.0 - f, { params: p }).includes('>photo.jpg<') && renderSVG('ui.promptBar', 1.0 + f, { params: p }).includes('>photo.jpg<') && mid.includes('>photo.jpg<') && !mid.includes('>brief.pdf<') && !renderSVG('ui.promptBar', 2.3 - f, { params: p }).includes('>brief.pdf<') && renderSVG('ui.promptBar', 2.3 + f, { params: p }).includes('>brief.pdf<') && name(end, 'photo.jpg') < name(end, 'brief.pdf'));
  check('promptBar attach list: typing starts after the last chip (0.1 s later at the earliest) and the text sits right of both chips; 3 cues per attachment', ts >= 2.4 - 1e-9 && cues.filter((q) => q.why === 'thumbnail grabbed').length === 2 && cues.filter((q) => q.why === 'attachment docks').map((q) => q.t).join() === '1,2.3' && /x="([\d.]+)"[^>]*>Plan next/.test(renderSVG('ui.promptBar', 3.0, { params: p })) && +(/x="([\d.]+)"[^>]*>Plan next/.exec(renderSVG('ui.promptBar', 3.0, { params: p })) || [0, 0])[1] > name(end, 'brief.pdf'));
  const out = renderSVG('ui.promptBar', 2.6, { params: p }); check('promptBar attach list: the unsorted list is ordered by dropAt; frames are NaN-free and well-formed', renderSVG('ui.promptBar', 3.3, { params: { attach: [...list].reverse() } }) === end && !/NaN|undefined/.test(out) && wellFormed(out).length === 0); }
function promptTypeAt(p) { return uiCues('ui.promptBar', { params: p }).find((q) => q.why === 'typing')?.t ?? 0; }

/* ---------- 10. partial nested overrides, blank sources, strict XML ---------- */
{ const Q = [[600, 300], [1300, 340], [1290, 760], [610, 740]], ok = (id, params, ts = [0.3, 1.2, 2.5, 3.5, 5.2]) => { let why = ''; try { for (const t of ts) { const sv = renderSVG(id, t, { params }); if (/NaN|undefined|Infinity|\[object/.test(sv)) why = 'bad number at ' + t; const e = wellFormed(sv); if (e.length) why = e[0]; }
      const cs = gfxCues(id, { params }); if (cs.some((q) => !Number.isFinite(q.t) || !okSfx(q.id))) why = 'cue ' + JSON.stringify(cs.find((q) => !Number.isFinite(q.t) || !okSfx(q.id))); } catch (e) { why = 'threw ' + e.message; } return why; };
  const V = [['chart.scatterFrontier', { y: { min: 0, max: 100 } }], ['chart.scatterFrontier', { x: { invert: false } }], ['chart.scatterFrontier', { x: { max: 20 } }], ['chart.scatterFrontier', { better: { x: 'high' } }], ['chart.scatterFrontier', { quadrant: { label: 'q' } }],
    ['ui.costTicker', { mode: 'zero', zero: { value: '0' } }], ['ui.costTicker', { mode: 'zero', zero: { label: 'per call' } }], ['ui.costTicker', { counters: [] }], ['ui.costTicker', { mode: 'zero', counters: [] }], ['ui.costTicker', { counters: [{ keys: [] }, { label: 'x', keys: [[0, 0], [2, 5]] }] }], ['ui.costTicker', { counters: [{ keys: [[0.2, 0], [2, 9]] }] }],
    ['caption.sceneBubble', { words: [] }], ['caption.sceneBubble', { dock: { to: [0.6, 0.4] } }], ['caption.sceneBubble', { dock: { at: 2 } }], ['caption.sceneBubble', { dock: {} }], ['caption.sceneBubble', { dock: { at: 2.2, to: [0.5, 0.5] }, anchor: { corners: Q } }],
    ['ui.branchTrace', { input: { title: 'Ask' } }], ['ui.branchTrace', { outcome: { pass: 'OK' } }], ['ui.branchTrace', { outcome: { fail: 'Stop' } }], ['ui.branchTrace', { decision: { forks: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correct: 'a' }, run: [] }], ['ui.branchTrace', { caption: false }], ['ui.branchTrace', { lanes: [] }], ['ui.branchTrace', { decision: undefined }],
    ['type.paramReadout', { source: '' }], ['type.paramReadout', { source: '   ' }], ['type.paramReadout', { fields: [{ name: 'a' }] }], ['type.paramReadout', { fields: [{ keys: [[0, 3]] }] }],
    ['lowerThird.personalTag', { chip: { href: 'a.png?x=1&y=2' } }], ['lowerThird.personalTag', { chip: { href: 'say "hi".png' } }], ['ui.dataTable', { source: '  ' }], ['chart.scatterFrontier', { hero: null }], ['chart.scatterFrontier', { points: [], hero: { label: 'h', x: 3, y: 50, source: 's' } }]];
  for (const [id, params] of V) { const why = ok(id, params); check(`${id} ${JSON.stringify(params).slice(0, 70)}: no throw, no NaN / undefined, well-formed XML, finite cues`, !why, why); }
  const lab = (id, params, t, txt) => renderSVG(id, t, { params }).includes(txt);
  check('blank sources (\'\' and whitespace) are no source: table, ticker and every scatter point are refused, with one error cue', ['  ', '', '\t'].every((v) => lab('ui.dataTable', { source: v }, 3, 'needs a source') && lab('ui.costTicker', { source: v }, 2, 'needs a source') && lab('chart.scatterFrontier', { hero: { ...GFX['chart.scatterFrontier'].d.hero, source: v } }, 4, 'needs a source')
    && gfxCues('ui.dataTable', { params: { source: v } })[0].id === 'sfx/ui/error' && gfxCues('ui.costTicker', { params: { source: v } })[0].id === 'sfx/ui/error') && noSrc('  ') && noSrc(undefined) && !noSrc('run 12') && !noSrc(0));
  check('type.paramReadout: a blank source falls back to the default label, so the numbers are never unlabelled; a real source replaces it', ['', '   ', null].every((v) => lab('type.paramReadout', { source: v }, 1.3, 'illustrative values')) && lab('type.paramReadout', { source: 'run 12' }, 1.3, 'run 12') && !lab('type.paramReadout', { source: 'run 12' }, 1.3, 'illustrative values'));
  check('ui.branchTrace: the in-frame "illustrative run" label prints with the caption bar off too (the diagram prints no numbers, but the frame still says so)', lab('ui.branchTrace', { caption: false }, 5.5, 'illustrative run') && lab('ui.branchTrace', {}, 5.5, 'illustrative run') && !lab('ui.branchTrace', { caption: false, note: '' }, 5.5, 'illustrative run'));
  { const a = renderSVG('chart.scatterFrontier', 4.6, { params: { y: { min: 0, max: 100 } } }), t = niceTicks(0, 100), t2 = niceTicks(0, 14), t3 = niceTicks(0.3, 0.9);
    check('scatterFrontier: x / y overrides merge over the defaults (a y range without ticks gets round ticks of its own)', JSON.stringify(t) === '[0,20,40,60,80,100]' && JSON.stringify(t2) === '[0,2,4,6,8,10,12,14]' && t3.every((v) => v >= 0.3 && v <= 0.9) && a.includes('>100<') && a.includes('>80<') && a.includes('Cost per task')); }
  { const d = { ...GFX['caption.sceneBubble'].d, dock: { to: [0.6, 0.4] } }, cues = gfxCues('caption.sceneBubble', { params: { dock: { to: [0.6, 0.4] } } }), cap = cues.find((q) => q.why === 'captured'), dk = cues.find((q) => q.why.includes('docks'));
    check('sceneBubble: a partial dock merges over its defaults (scale 0.6, title "Notes", `at` 0.4 s after the captured tick)', dk && Math.abs(dk.t - (cap.t + 0.4)) < 1e-6 && lab('caption.sceneBubble', { dock: { to: [0.6, 0.4] } }, 4.2, 'Notes') && d.dock.to[0] === 0.6); }
  { const a = renderSVG('ui.costTicker', 2, { params: { mode: 'zero', counters: [] } }), cs = gfxCues('ui.costTicker', { params: { mode: 'zero', counters: [] } });
    check("costTicker: mode 'zero' with no counters shows the honest zero cell alone; with count mode and no counters nothing is drawn and no cue has a null time", a.includes('>$0<') && !a.includes('TOKENS') && renderSVG('ui.costTicker', 2, { params: { counters: [] } }) === '' && gfxCues('ui.costTicker', { params: { counters: [] } }).every((q) => q.t != null) && cs.length >= 1); }
  { const at = 2, p = { words: [{ w: 'Hello', s: 0.5, e: 0.8 }, { w: 'there', s: 0.9, e: 1.2 }] }, A = (t) => renderSVG('caption.sceneBubble', t, { at, params: p });
    check('sceneBubble: word times are LOCAL to the part (a word with s = 0.5 appears at at + 0.5, not at 0.5): a words.json from a take at 2 s must be offset by the part\'s `at`', !A(2.4).includes('>Hello<') && A(2.6).includes('>Hello<') && !A(2.6).includes('>there<') && A(3.0).includes('>there<')); } }

/* ---------- 11. anchors from layout.cornerPin data ---------- */
{ const Q0 = [[600, 300], [1300, 340], [1290, 760], [610, 740]], Q1 = [[700, 320], [1400, 330], [1380, 780], [720, 760]], W = 1920, H = 1080, c = ctxFor(W, H), at = 1, keys = [{ t: 0, q: Q0 }, { t: 5, q: Q1 }];
  const centre = (q, uv = [0.5, 0.5]) => applyH(homography([[0, 0], [1, 0], [1, 1], [0, 1]], q), uv), dot = (sv) => { const m = new RegExp(`<circle cx="([\\d.]+)" cy="([\\d.]+)" r="[\\d.]+" fill="${BRAND}"`, 'i').exec(sv); return m ? [+m[1], +m[2]] : null; };
  const near = (a, b, tol = 0.6) => a && Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
  const stat = dot(renderSVG('ui.costTicker', 2, { params: { anchor: { corners: Q0 } } })); check('costTicker: a static quad anchors at the quad centre (perspective-correct homography, px units): the lead dot sits on it', near(stat, centre(Q0)), JSON.stringify(stat) + ' vs ' + centre(Q0));
  { const t = 3.4, e = cornersAt(t, keys), d = dot(renderSVG('ui.costTicker', t, { at, params: { anchor: { keys } } })), loc = cornersAt(t - at, keys), dl = dot(renderSVG('ui.costTicker', t, { at, params: { anchor: keys } }));
    check('costTicker: keys [{t, q}] (the layout.cornerPin keys) follow COMPOSITION time, not the part\'s local time (a bare keys array works too)', near(d, centre(e)) && near(dl, centre(e)) && !near(d, centre(loc), 3), JSON.stringify(d) + ' vs ' + centre(e)); }
  { const uv = [0.25, 0.75], d = dot(renderSVG('ui.costTicker', 2, { params: { anchor: { corners: Q0, uv } } })); check('costTicker: `uv` picks another point inside the quad ([0.25, 0.75]); units "frac" takes fractions of the frame', near(d, centre(Q0, uv)) && near(dot(renderSVG('ui.costTicker', 2, { params: { anchor: { corners: Q0.map(([x, y]) => [x / W, y / H]), units: 'frac' } } })), centre(Q0))); }
  { const t = 3.4, pb = { ...GFX['caption.sceneBubble'].d, anchor: { keys } }, G = bubbleGeo(pb, c, t - at, t), e = centre(cornersAt(t, keys)); check('sceneBubble: anchors follow layout.cornerPin keys in composition time too (bubbleGeo ax, ay on the quad centre)', Math.abs(G.ax - e[0]) < 0.6 && Math.abs(G.ay - e[1]) < 0.6); }
  check('trackAt: [x, y] and [[t, x, y]] are unchanged (local time), the corner form needs ctx for px units', JSON.stringify(trackAt([0.4, 0.5], 1)) === '[0.4,0.5]' && Math.abs(trackAt([[0, 0.2, 0.2], [2, 0.6, 0.4]], 1)[0] - 0.4) < 1e-9 && Math.abs(trackAt({ corners: [[0, 0], [100, 0], [100, 50], [0, 50]] }, 0, { W: 200, H: 100 })[0] - 0.25) < 1e-9);
  const t0 = renderSVG('ui.costTicker', 2.9, { at, params: { anchor: { keys } } }), t1 = renderSVG('ui.costTicker', 3.9, { at, params: { anchor: { keys } } }); check('costTicker: the chip moves with the quad (frames differ) and stays inside the 9:16 safe zone', t0 !== t1 && (() => { const tall = ctxFor(1080, 1920), sv = renderSVG('ui.costTicker', 3, { params: { anchor: { corners: Q0.map(([x, y]) => [x * 0.5625, y * 1.7778]) } } }, { W: 1080, H: 1920 }), m = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="rgba\(14,13,20,0.84\)"/.exec(sv), S = tall.safe; return m && +m[1] >= S.x0 - 0.5 && +m[1] + +m[3] <= S.x1 + 0.5 && +m[2] >= S.y0 - 0.5 && +m[2] + +m[4] <= S.y1 + 0.5; })()); }
console.log(`\nr45ui: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
