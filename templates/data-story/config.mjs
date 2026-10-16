/* TEMPLATE data-story: a data-journalism short, 45-90 s, 16:9 master + a 9:16 re-layout (lane explainer, 2026-10-16).
   Shape (patterns/structures.json `data-story`, craft notes in README.md): HOOK (the question on frame 0 over a chart already drawing) -> CONTEXT (the baseline chart, built in
   steps, one annotation leader on the datum that matters) -> EVIDENCE ("the number that matters" counted up, then the honest comparison) -> DETAIL (a scrolly breakdown:
   the text column steps while the chart beside it highlights; then the map) -> TAKEAWAY (one line on a held end card with every source).
   HONESTY IS THE BUILD (templates/_explain/honesty.mjs): every dataset needs a `source` AND a `method` that say something, every chart needs a unit, bars and areas start at zero,
   a truncated line axis needs its label in frame, and the source footer is on every chart frame. A miss stops make.mjs with exit 2, naming the field. Every number on screen
   is read from the dataset files (never typed into copy) and becomes a claim with that dataset's source, so lint.proof checks it too.
   Numbers print in the dataset's locale: `locale: 'in'` gives 12,34,567 and 14.2 lakh / 3.1 crore; 'intl' gives 1,234,567 and 1.4M.
   DEMO: Orbit City libraries, a FICTIONAL city with invented numbers (DEMO DATA in frame, and the source line says so). Replace data/*.csv|json, the source and the method. */
import { aspectOf, safeBox, fixSets, loadVoiceWords, beatTime, captionsOf, finish, r3, tagOf, inSafe, HERE_OF } from '../_explain/core.mjs';
import { loadDataset, aggregate } from '../_explain/dataset.mjs';
import { storyProblems, HonestyError } from '../_explain/honesty.mjs';
import { fmtNumber } from '../../type/gfx/numfmt.js';
const HERE = HERE_OF(import.meta.url);
const DEMO_SRC = 'Fictional demo data (Orbit City is not a real place)', DEMO_METHOD = 'Invented to show the charts; measures nothing';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit Data Desk', accent: '#4A18ED', ink: '#16151B', paper: '#F5F2EA', logo: null, url: 'orbit.example', cta: 'Data and method at orbit.example', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],
  text: {
    hook: 'Are people borrowing books again?',
    takeawayKicker: 'THE TAKEAWAY', takeaway: 'The smallest branches drove the comeback.',
  },
  media: {},   // a data story draws its own pictures; add a photo / clip slot in your copy if a beat needs one (null renders a labelled placeholder)
  voice: { words: null, audio: null, placeholder: 'guide', chain: false },
  locale: 'in',   // 'in' (lakh / crore, 12,34,567) | 'intl' (1,234,567, K / M) | 'eu' | 'si'
  /* every dataset: file (CSV or JSON, relative to this folder) + source + method (both required) + unit; demo: true prints DEMO DATA in every frame that shows it */
  data: {
    monthly: { file: 'data/loans-monthly.csv', source: DEMO_SRC, method: DEMO_METHOD, unit: 'books', demo: true },
    branches: { file: 'data/branches.csv', source: DEMO_SRC, method: DEMO_METHOD, unit: 'books', demo: true },
    zones: { file: 'data/zones.json', unit: '%', demo: true },   // source + method come from the JSON file itself
  },
  /* the beats: t in seconds (or word: a voice word when voice.words is set); sec = hook | context | evidence | detail | takeaway */
  beats: [
    { t: 0, sec: 'hook', kind: 'hook', dur: 5.2 },
    { t: 0, sec: 'hook', kind: 'chart', until: 19.8, chart: { data: 'monthly', kind: 'line', x: 'month', y: ['this_year', 'last_year'], names: { this_year: 'This year', last_year: 'Last year' }, compare: 1,
        title: 'Books borrowed each month', yLabel: 'Books borrowed per month', unit: '', show: [[0, 3], [2.8, 6], [6.2, 9], [9.0, 12]], hl: [[13.4, 0], [17.2, -1]] },
      callouts: [{ t: 11.2, datum: [6, 0], label: 'July: the summer peak', sub: 'a reading drive month', dx: -0.16, dy: 0.12, dur: 3.6 }, { t: 17.4, datum: [11, 0], label: 'December: the highest month', dx: -0.2, dy: 0.08, dur: 2.2 }] },
    { t: 5.6, sec: 'context', kind: 'caption', text: 'Month by month, this year ran ahead of last year.', dur: 5.0 },
    { t: 15.0, sec: 'context', kind: 'caption', text: 'The gap grew wider after the summer.', dur: 4.4 },
    { t: 20.0, sec: 'evidence', kind: 'hero', data: 'monthly', column: 'this_year', agg: 'sum', label: 'books borrowed this year', compact: 'long', dec: 1, dur: 5.0 },
    { t: 25.2, sec: 'evidence', kind: 'chart', until: 33.0, chart: { data: 'monthly', kind: 'bar', agg: 'sum', y: ['last_year', 'this_year'], names: { last_year: 'Last year', this_year: 'This year' },
        title: 'Books borrowed in the year', yLabel: 'Books borrowed', unit: '', compact: 'long', hl: [[1.4, 1]] },
      callouts: [{ t: 29.8, datum: [1, 0], label: 'This year', sub: 'the higher total', dx: 0.08, dy: -0.06, dur: 3.0 }] },
    { t: 27.6, sec: 'evidence', kind: 'caption', text: 'Both bars start at zero, so the gap is the real gap.', dur: 5.0 },
    { t: 33.2, sec: 'detail', kind: 'scrolly', until: 45.6, chart: { data: 'branches', kind: 'bar', x: 'branch', y: ['last_year', 'this_year'], names: { last_year: 'Last year', this_year: 'This year' }, title: 'Books borrowed by branch', yLabel: 'Books borrowed', unit: '' },
      steps: [{ t: 33.6, text: 'Central lent the most, as every year.', hl: 'Central' }, { t: 36.6, text: 'Most branches grew a little.', hl: -1 },
        { t: 39.6, text: 'Old Town and Lakeview grew fastest.', hl: 'Old Town' }, { t: 42.6, text: 'Lakeview grew the most of all.', hl: 'Lakeview' }] },
    { t: 45.8, sec: 'detail', kind: 'map', until: 54.2, data: 'zones', title: 'Residents with a library card, by zone', unit: '%', legendTitle: 'Share of residents with a card', hls: [[48.4, ['z7']], [51.0, ['z7', 'z11']]] },
    { t: 49.0, sec: 'detail', kind: 'caption', text: 'Old Town and Lakeview have the fewest library cards.', dur: 4.8 },
    { t: 54.2, sec: 'takeaway', kind: 'takeaway' },
  ],
  claims: [],   // every number on screen is read from data/* and claimed with that dataset's source automatically; add claims for any number you type into text
  captions: { style: { '16:9': 'minimal', '9:16': 'karaoke' } },
  music: 'music/bed_documentary_marimba_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0, tailS: 7.2,
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.hook', 'text.hook': 'text.hook', 'text.takeaway': 'text.takeaway', 'voice.words': 'voice.words', 'voice.audio': 'voice.audio', music: 'music', claims: 'claims', aspects: 'aspects' };
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'relayout', tag: 'tall' } };

/* per-aspect boxes as fractions of the SAFE rect (inSafe), so every chart, label and footer stays inside it */
const LAYOUT = {
  '16:9': { chart: [0, 0.2, 1, 0.84], hero: 'c', scrollyText: [0.03, 0.06, 0.34, 0.94], scrollyChart: [0.4, 0.04, 1, 0.84], map: [0.2, 0.0, 0.8, 0.86], hookPos: 'tc', capPos: 'bc', capSize: 0.6, hookSize: 0.85, size: 1, mapSize: 1, heroSize: 220 },
  '9:16': { chart: [0, 0.19, 1, 0.8], hero: 'c', scrollyText: [0.06, 0.64, 1, 1], scrollyChart: [0, 0.0, 1, 0.5], map: [0.04, 0.02, 0.96, 0.82], hookPos: 'tc', capPos: 'bc', capSize: 0.7, hookSize: 0.78, size: 0.62, mapSize: 0.7, heroSize: 150 },
};
export function datasets(C) { const out = {}; for (const [id, d] of Object.entries(C.data || {})) out[id] = loadDataset(HERE, d, id); return out; }
export function dataStoryProblems(C) { return storyProblems(C, datasets(C)); }
/* chart.story params from a chart spec + its dataset */
function chartParams(ch, ds, C, L, box) {
  const d = ds[ch.data], names = ch.names || {}, ys = [].concat(ch.y || []), meta = { source: d.source, method: d.method, demo: d.demo, locale: C.locale, accent: C.brand.accent, ink: C.brand.ink, size: L.size, box };
  if (ch.agg) { const vals = ys.map((y) => aggregate(d, y, ch.agg)); return { ...meta, kind: 'bar', labels: ys.map((y) => names[y] || y), series: [{ name: ch.yLabel || 'Total', values: vals }], title: ch.title || '', yLabel: ch.yLabel || '', unit: ch.unit || '', dec: ch.dec ?? 0, highlight: -1, hl: ch.hl || [], compare: -1 }; }
  return { ...meta, kind: ch.kind || 'bar', labels: d.rows.map((r) => String(r[ch.x])), series: ys.map((y) => ({ name: names[y] || y, values: d.rows.map((r) => +r[y]) })), title: ch.title || '', yLabel: ch.yLabel || '', unit: ch.unit || '',
    dec: ch.dec ?? 0, compare: ch.compare ?? -1, yMin: ch.yMin ?? null, truncated: ch.truncated || '', show: ch.show || [], hl: ch.hl || [], highlight: ch.highlight ?? -1 };
}
const claimOf = (label, values, d, C, unit = '') => ({ text: `${label}: ${values.map((v) => fmtNumber(v, { locale: C.locale })).join(', ')}${unit ? ' ' + unit : ''}`, source: `${d.source}; method: ${d.method}` });

export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), warnings = [], box = (f) => inSafe(C.aspect, f);
  const ds = datasets(C), problems = storyProblems(C, ds); if (problems.length) throw new HonestyError(problems);
  const words = loadVoiceWords(HERE, C), vo = words.length > 0, at = (b) => beatTime(b, words, fps);
  const beats = C.beats.map((b, i) => ({ ...b, i, at: at(b) })).sort((a, b) => a.at - b.at || a.i - b.i);
  const tk = beats.find((b) => b.kind === 'takeaway'), T = +(typeof C.length === 'number' ? C.length : Math.max(tk ? tk.at + (C.tailS ?? 7) : 0, vo ? words.at(-1).oe + 1.5 : 0)).toFixed(4);
  const items = [], top = [], texts = [], events = [], claims = [...C.claims], until = (b) => (b.until != null ? at({ t: b.until, word: b.untilWord }) : T);
  for (const b of beats) {
    if (b.kind === 'hook') { top.push({ id: 'title.hookCard', at: b.at, dur: b.dur ?? 4, params: { line: C.text.hook, kicker: C.brand.name, pos: L.hookPos, accent: C.brand.accent, size: L.hookSize } }); texts.push({ text: C.text.hook, a: b.at, b: b.at + (b.dur ?? 4), role: 'hook' }); }
    else if (b.kind === 'chart') { const d = ds[b.chart.data], p = chartParams(b.chart, ds, C, L, box(L.chart)), dur = r3(until(b) - b.at - 0.3), it = { id: 'chart.story', at: b.at, dur, params: p }; items.push(it);
      for (const q of p.show || []) events.push(b.at + q[0]); for (const q of p.hl || []) events.push(b.at + q[0]); events.push(b.at, b.at + 0.9);
      p.series.forEach((s) => claims.push(claimOf(`${p.title} (${s.name})`, s.values, d, C, d.unit)));
      for (const cl of b.callouts || []) { const t0 = at(cl); items.push({ id: 'callout.datum', at: t0, dur: cl.dur ?? 2.6, params: { chart: p, datum: cl.datum, label: cl.label, sub: cl.sub || '', dx: cl.dx ?? 0.1, dy: cl.dy ?? -0.12, accent: C.brand.accent, ink: C.brand.ink, size: L.size } });
        texts.push({ text: [cl.label, cl.sub].filter(Boolean).join(' '), a: t0, b: t0 + (cl.dur ?? 2.6), role: 'label' }); events.push(t0); }
      texts.push({ text: p.title, a: b.at, b: b.at + dur, role: 'title' }); }
    else if (b.kind === 'hero') { const d = ds[b.data], v = aggregate(d, b.column, b.agg || 'sum'), p = { value: v, from: 0, locale: C.locale, compact: b.compact ?? 'long', dec: b.dec ?? 1, unit: b.unit || '', label: b.label, source: d.source, method: d.method, demo: d.demo, accent: C.brand.accent, ink: C.brand.ink, size: L.heroSize, count: 1.4 };
      items.push({ id: 'counter.hero', at: b.at, dur: b.dur ?? 4, params: p }); claims.push(claimOf(b.label, [v], d, C, d.unit)); events.push(b.at, b.at + 1.4, b.at + 2.6);
      texts.push({ text: fmtNumber(v, { locale: C.locale, dec: p.dec, compact: p.compact }) + ' ' + b.label, a: b.at, b: b.at + (b.dur ?? 4), role: 'hero' }); }
    else if (b.kind === 'scrolly') { const d = ds[b.chart.data], p = chartParams(b.chart, ds, C, L, box(L.scrollyChart)), dur = r3(until(b) - b.at - 0.3), steps = b.steps.map((s) => ({ at: r3(at(s) - b.at), text: s.text }));
      p.hl = b.steps.filter((s) => s.hl != null).map((s) => [r3(at(s) - b.at), s.hl]); items.push({ id: 'chart.story', at: b.at, dur, params: p });
      items.push({ id: 'layout.scrolly', at: b.at, dur, params: { steps, box: box(L.scrollyText), accent: C.brand.accent, ink: C.brand.ink, size: L.size * (C.aspect === '9:16' ? 1.2 : 1) } });
      p.series.forEach((s) => claims.push(claimOf(`${p.title} (${s.name})`, s.values, d, C, d.unit))); events.push(b.at, b.at + 0.9, ...steps.map((s) => b.at + s.at));
      b.steps.forEach((s, i) => texts.push({ text: s.text, a: at(s), b: i + 1 < b.steps.length ? at(b.steps[i + 1]) : b.at + dur, role: 'scrolly' })); texts.push({ text: p.title, a: b.at, b: b.at + dur, role: 'title' }); }
    else if (b.kind === 'map') { const d = ds[b.data], tiles = d.rows.map((r) => ({ id: r.id, q: r.q, r: r.r, label: r.label, short: r.short ?? r.label, value: r[b.value || 'value'] })), dur = r3(until(b) - b.at - 0.3);
      items.push({ id: 'map.hexTile', at: b.at, dur, params: { tiles, title: b.title, unit: b.unit, legendTitle: b.legendTitle, locale: C.locale, hls: (b.hls || []).map(([t, ids]) => [r3(at({ t }) - b.at), ids]), source: d.source, method: d.method, demo: d.demo, box: box(L.map), ink: C.brand.ink, accent: '#E8590C', size: L.mapSize } });
      claims.push(claimOf(b.title, tiles.map((t) => t.value), d, C, b.unit)); events.push(b.at, b.at + 0.6, b.at + 1.2, ...(b.hls || []).map(([t]) => at({ t }))); texts.push({ text: b.title, a: b.at, b: b.at + dur, role: 'title' }); }
    else if (b.kind === 'caption') { if (vo) continue; top.push({ id: 'title.hookCard', at: b.at, dur: b.dur ?? 3, silent: true, params: { line: b.text, pos: L.capPos, accent: C.brand.accent, size: L.capSize, bg: '#FFFFFF' } });
      texts.push({ text: b.text, a: b.at, b: b.at + (b.dur ?? 3) + 0.3, role: 'caption-super' }); events.push(b.at); }
    else if (b.kind === 'takeaway') { top.push({ id: 'title.takeaway', at: b.at, dur: r3(T - b.at - 0.3), params: { kicker: C.text.takeawayKicker, line: C.text.takeaway, accent: C.brand.accent, ink: C.brand.ink, pos: 'c', size: C.aspect === '9:16' ? 0.66 : 1 } });
      const src = [...new Set(Object.values(ds).map((d) => d.source))].join(' | '), meth = [...new Set(Object.values(ds).map((d) => d.method))].join(' | ');
      top.push({ id: 'chart.sourceFooter', at: b.at + 0.6, dur: r3(T - b.at - 0.9), params: { source: src, method: meth, demo: Object.values(ds).some((d) => d.demo), box: box([0, 0.9, 1, 0.97]), ink: C.brand.ink } });
      texts.push({ text: C.text.takeaway, a: b.at, b: T, role: 'takeaway' }); events.push(b.at, b.at + 0.6); }
  }
  /* the frame the hero and the takeaway sit on: the hero hides the chart behind it (the chart beat ends before it) */
  const order = ['hook', 'context', 'evidence', 'detail', 'takeaway'], starts = order.map((s) => [s, Math.min(...beats.filter((b) => b.sec === s).map((b) => b.at))]).filter(([, t]) => Number.isFinite(t));
  const sections = starts.map(([name, a], i) => ({ name, t: [r3(a), r3(i + 1 < starts.length ? starts[i + 1][1] : T)] }));
  const shots = sections.map((s) => ({ id: s.name, sec: s.name, start: s.t[0], dur: r3(s.t[1] - s.t[0]), move: 'data camera', ...(s.name === 'takeaway' ? { hold: true } : {}) }));
  const cap = captionsOf(words, C); for (const x of cap.lint) warnings.push('captions: ' + x);
  const quiet = tk ? [{ t: [r3(Math.max(T - 8.5, tk.at + 1.8)), r3(T)], kind: 'hold', why: 'the takeaway and its sources hold on the end card' }] : [];
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: C.brand.paper, platform: A.safe, slots: [], gfx: items, gfxTop: top, captions: cap.captions, speaking: {} };
  return finish({ template: 'data-story', C, A, fps, T, words, scene, items, top, sections, shots, claims, texts, events, quiet, warnings, tag, extra: { pattern: 'data-story', layers: C.layers, datasets: Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, { file: d.file, rows: d.rows.length, source: d.source, method: d.method, demo: d.demo }])) } });
}
