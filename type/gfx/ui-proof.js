/* motion-pack / type / gfx / ui-proof.js: proof-film parts, round 4+5 (2026-10-14). Same contract as ui.js (svg(L, p, ctx) -> SVG, a pure function of t,
   closed-form springs from ../ease.js, `scale` / `theme` / `accent` on every item, one sound per action through gfxCues / uiCues). Generic layouts of our own:
   no reference brand, logo, product name, layout or copy is reproduced. HONESTY: every number these parts print is ILLUSTRATIVE by default and the frame says so;
   chart.scatterFrontier refuses to draw a point without its own `source`, ui.dataTable and ui.costTicker refuse to draw numbers without `source`
   (a red "needs a source" card renders instead, so the mistake is visible on the contact sheet and in the film; a blank or whitespace-only source counts as none, and
   type.paramReadout falls back to its default label, so a number is never drawn unlabelled). The two dense parts (scatter, table) size their type
   from the shorter frame side, so a 9:16 frame keeps the 16:9 type size; ui.dataTable also picks its own box and scale per frame shape (a phone layout on 9:16, unless you pass
   `box` / `scale`); the finding and the footnote wrap inside the panel. Nested params merge over the defaults (x: {max: 20}, zero: {value: '0'}, dock: {to: [.7, .3]} never leave a hole).
     chart.scatterFrontier  cost (x) vs score (y) scatter: axes + ticks draw on, points drop in one by one with labels, a Pareto frontier draws through the best
                            points (stroke-dashoffset on a precomputed polyline), the hero point lands last with a star and a two-line callout; optional `better` quadrant
     ui.dataTable           table that builds: header slides in, rows stagger, numeric cells count up with units formatted by the part (K / M / % / dur / s / ms / $),
                            one cell or column pulses; optional one-line finding and a bar chart wired to one row of the same data
     ui.costTicker          usage chip pinned to a point in footage (static or tracked): two counters run together from piecewise-linear keys, colour shifts past a
                            threshold; `mode: 'zero'` prints an honest "$0 per query" in place of the money counter
     type.paramReadout      HUD line under a figure: math-italic names, '=' and values that roll or step inside fixed-width slots, so the line never shifts */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, f2, text, measure, polylineLen, dash } from './core.js';
import { springTrack, spring } from '../ease.js';
import { KIT, rr, TICKS, POPS } from './ui.js';
import { mixHex } from './swap.js';
import { homography, applyH, cornersAt } from './cornerpin.js';
import { wrapWords } from './ui-data.js';
const { th, GREEN, AMBER, bx, uid, op, rect, shadowDef, softShadow } = KIT;
const RED = '#E5484D';
const fade = (L) => op(clamp(L.in * 1.5) * (1 - L.out));
const TAB = 'font-variant-numeric="tabular-nums"';
/* units are formatted by the part, never typed: K, M, %, dur (seconds -> "7m 14s"), s, ms, $ (commas), '' (commas) */
const commas = (v, dec) => { const s = Math.abs(v).toFixed(dec).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (v < 0 ? '-' : '') + s.join('.'); };
export function fmtUnit(v, unit = '', dec) {
  if (unit === 'K') return (v / 1e3).toFixed(dec ?? 1) + 'K'; if (unit === 'M') return (v / 1e6).toFixed(dec ?? 2) + 'M'; if (unit === '%') return v.toFixed(dec ?? 1) + '%';
  if (unit === 'dur') { const t = Math.max(0, Math.round(v)), m = Math.floor(t / 60); return m ? `${m}m ${String(t % 60).padStart(2, '0')}s` : `${t % 60}s`; }
  if (unit === 's') return v.toFixed(dec ?? 2) + ' s'; if (unit === 'ms') return Math.round(v) + ' ms'; if (unit === '$') return '$' + commas(v, dec ?? 2); return commas(v, dec ?? 0);
}
/* value of piecewise-linear keys [[t, v], ...] at local time u (held before the first and after the last key); `ease` shapes each segment */
export function keysAt(keys, u, ease = (x) => x) { if (!keys.length) return 0; if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, ease(seg(u, t0, t1))); } return keys.at(-1)[1]; }
/* a source counts only if it has a visible character: '' and '   ' are no source */
export const noSrc = (v) => !String(v ?? '').trim();
/* anchor in footage, frame fractions as a function of time. Three forms:
   [x, y]                         a static point
   [[t, x, y], ...]               a track (per-frame tracking data or a few keys), linear between keys, t in seconds LOCAL to the part's `at`
   {corners | keys, units, uv}    the SAME data that drives layout.cornerPin (a quad [TL, TR, BR, BL] or keys [{t, q, ease}], units 'px' (default) | 'frac'; a bare keys
                                  array [{t, q}] works too): the anchor is the point `uv` ([0.5, 0.5] = the quad's centre, perspective-correct) and t is COMPOSITION time
                                  (the pinned layer and the chip then follow the same track). `c` (ctx) gives the frame size for px units; `t` is the absolute time. */
export function trackAt(a, u, c = { W: 1920, H: 1080 }, t = u) {
  if (!Array.isArray(a) || (a[0] && !Array.isArray(a[0]) && typeof a[0] === 'object')) { const d = Array.isArray(a) ? { keys: a } : a, q = cornersAt(t, d.keys || d.corners), [x, y] = applyH(homography([[0, 0], [1, 0], [1, 1], [0, 1]], q), d.uv || [0.5, 0.5]); return d.units === 'frac' ? [x, y] : [x / c.W, y / c.H]; }
  if (!Array.isArray(a[0])) return a; if (u <= a[0][0]) return [a[0][1], a[0][2]];
  for (let i = 1; i < a.length; i++) if (u < a[i][0]) { const k = seg(u, a[i - 1][0], a[i][0]); return [lerp(a[i - 1][1], a[i][1], k), lerp(a[i - 1][2], a[i][2], k)]; } return [a.at(-1)[1], a.at(-1)[2]]; }
/* round tick values for an axis whose min / max were overridden without `ticks` */
export function niceTicks(lo, hi, n = 5) { const span = hi - lo; if (!(span > 0)) return [lo]; const raw = span / n, m = 10 ** Math.floor(Math.log10(raw)), f = raw / m, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * m, out = [];
  for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + 1e-9; i++) out.push(+(i * step).toFixed(10)); return out; }
/* the honesty refusal: a red card in place of the numbers */
const refuse = (c, x, y, w, msg) => { const s = c.s, h = 120 * s; return rect(x, y, w, h, 18 * s, '#FFFFFF', `stroke="${RED}" stroke-width="${f2(3 * s)}"`) +
  text('needs a source', x + 28 * s, y + 48 * s, { size: 28 * s, weight: 800, fill: RED }) + text(msg, x + 28 * s, y + 88 * s, { size: 20 * s, weight: 600, fill: '#16151B' }); };

/* ---------- 1. scatter + frontier ---------- */
const PTS = [['Model A', 11.8, 58.2], ['Model B', 9.4, 55.0], ['Model C', 6.1, 49.5], ['Model D', 3.2, 41.0], ['Model E', 2.1, 33.8], ['Model F', 8.0, 44.2], ['Model G', 4.6, 36.0]]
  .map(([label, x, y]) => ({ label, x, y, source: 'illustrative' }));
/* Pareto frontier: the points no other point beats on both axes (better.x 'low' = cheaper wins, better.y 'high' = higher score wins), sorted by x; input order does not matter */
export function frontierOf(points, better = { x: 'low', y: 'high' }) {
  const sx = better.x === 'low' ? 1 : -1, sy = better.y === 'high' ? 1 : -1, q = [...points].sort((a, b) => sx * (a.x - b.x) || sy * (b.y - a.y)); let best = -Infinity; const out = [];
  for (const pt of q) if (sy * pt.y > best) { best = sy * pt.y; out.push(pt); } return out.sort((a, b) => a.x - b.x); }
export function scatterTimes(p) { const n = p.points.length, pointsAt = p.pointsAt, frontierAt = p.frontierAt ?? pointsAt + n * p.stagger + 0.15, heroAt = p.heroAt ?? frontierAt + p.frontierDur + 0.2;
  return { pointsAt, frontierAt, heroAt, calloutAt: heroAt + 0.3, pointAt: (i) => pointsAt + i * p.stagger }; }
const starPath = (cx, cy, R) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R; d += (i ? 'L' : 'M') + f2(cx + r * Math.cos(a)) + ' ' + f2(cy + r * Math.sin(a)); } return d + 'Z'; };
/* ---------- 2. data table ---------- */
const TABLE = { columns: [{ label: 'Metric' }, { label: 'Week 1' }, { label: 'Week 2' }, { label: 'Week 3' }],
  rows: [{ label: 'Calls handled', unit: 'K', values: [12400, 15800, 18100] }, { label: 'Resolved in the call', unit: '%', values: [71.2, 76.5, 81.9] }, { label: 'Average handle time', unit: 'dur', values: [434, 398, 371] },
    { label: 'Passed to a person', unit: '%', values: [18.4, 14.1, 11.6] }, { label: 'Cost per call', unit: '$', values: [0.42, 0.38, 0.35] }, { label: 'Median reply time', unit: 'ms', values: [590, 530, 505] }] };
export function tableTimes(p) { const n = p.rows.length, rowsAt = p.rowsAt, countEnd = rowsAt + (n - 1) * p.stagger + p.countDur; return { rowsAt, countEnd, barsAt: p.barsAt ?? rowsAt, hlAt: p.hlAt ?? countEnd + 0.2, rowAt: (i) => rowsAt + i * p.stagger }; }
/* ---------- 3. cost ticker ---------- */
const TICK_ZERO = { value: '$0', label: 'per query · on device' };
/* the chip's cells: the counters that have keys; in zero mode the last one is replaced by the honest zero cell (null), which stands alone when there are no counters */
const tickerCells = (p) => { const cts = (p.counters || []).filter((ct) => ct && ct.keys && ct.keys.length); return p.mode === 'zero' ? [...cts.slice(0, -1), null] : cts; };
/* ---------- 4. param readout ---------- */
export const MATH = "'STIX Two Text', 'STIX Two Math', 'Cambria Math', 'Latin Modern Math', 'Times New Roman', Times, serif";
const READ = [{ name: 'N', label: 'terms', keys: [[0.2, 0], [1.6, 1024]], dec: 0 }, { name: 'error', label: 'residual', keys: [[0.2, 2.1], [1.8, 0.33]], dec: 2, unit: '%' },
  { name: 'θ', label: 'angle', keys: [[0.2, 0], [0.9, 22.5], [1.6, 37.5]], dec: 1, unit: '°', mode: 'step' }];
const fieldStr = (f, v) => (f.prefix || '') + commas(v, f.dec ?? 0) + (f.unit || '');
const fieldVal = (f, u) => (f.mode === 'step' ? keysAt(f.keys, u, (x) => (x >= 1 ? 1 : 0)) : keysAt(f.keys, u, E.soft));
/* a field without keys holds 0; a field without a name prints none */
const fieldsOf = (p) => (p.fields || []).map((fl) => ({ ...fl, name: String(fl.name ?? ''), keys: fl.keys && fl.keys.length ? fl.keys : [[0, 0]] }));
/* fixed slot geometry, computed once from the widest value any key can print: the same for every frame (no layout shift) */
export function readoutGeo(p, c) { const S = p.size * c.s, gap = 0.4 * S, fg = 1.6 * S; let x = 0;
  const f = fieldsOf(p).map((fl) => { const nw = measure(fl.name, S, { weight: 500, font: MATH }), ew = measure(' = ', S, { weight: 400, font: MATH }), vals = fl.keys.map((k) => k[1]);
    const vw = Math.max(...[...vals, Math.min(...vals), Math.max(...vals)].map((v) => measure(fieldStr(fl, v), S * 0.92, { weight: 600 }))) + 0.1 * S, g = { x, nw, ew, vw, w: nw + ew + vw }; x += g.w + fg; return g; });
  const W = x - fg, [cx, cy] = [p.center[0] * c.W, p.center[1] * c.H]; return { S, gap, x0: cx - W / 2, y: cy, W, f }; }

export const PROOF = {
  'chart.scatterFrontier': { file: 'type/gfx/ui-proof.js', tags: ['chart', 'scatter', 'frontier', 'pareto', 'benchmark', 'cost', 'proof', 'data'], dur: 5.2, inF: 8, outF: 9,
    d: { box: [0.07, 0.08, 0.86, 0.82], title: 'Score against cost per task', points: PTS, hero: { label: 'Acme', x: 3.9, y: 62.4, source: 'illustrative', callout: ['Highest score', 'under $4 a task'] },
      x: { min: 0, max: 14, ticks: [0, 2, 4, 6, 8, 10, 12, 14], prefix: '$', label: 'Cost per task  ·  cheaper →', invert: true }, y: { min: 30, max: 70, ticks: [30, 40, 50, 60, 70], label: 'Score' },
      better: { x: 'low', y: 'high' }, quadrant: { x: 6, y: 52, label: 'better' }, frontier: true, axesAt: 0.05, axesDur: 0.6, pointsAt: 0.55, stagger: 0.16, frontierAt: null, frontierDur: 0.8, heroAt: null,
      calloutOffset: [-200, 110], note: 'illustrative data', method: 'frontier: no other point is both cheaper and higher scoring', panel: true, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), id = uid('sf', x, y, w, h), all = [...p.points, ...(p.hero ? [p.hero] : [])], miss = all.filter((q) => noSrc(q.source));
      const D = PROOF['chart.scatterFrontier'].d, axis = (a, d) => { const m = { ...d, ...a }; if (!(a && a.ticks)) m.ticks = niceTicks(m.min, m.max); return m; }, xa = axis(p.x, D.x), ya = axis(p.y, D.y), better = { ...D.better, ...p.better }, quad = p.quadrant ? { ...D.quadrant, ...p.quadrant } : null;   // partial x / y / better / quadrant merge over the defaults
      if (miss.length) return `<g${fade(L)}>${refuse(c, x, y, Math.min(w, 980 * s), `chart.scatterFrontier: ${miss.length} point(s) without a source (${miss.slice(0, 3).map((q) => q.label).join(', ')})`)}</g>`;
      const srcs = [...new Set(all.map((q) => q.source))], foot = [p.note, 'sources: ' + srcs.join(', '), p.method].filter(Boolean).join('  ·  '), fl = wrapWords(foot, 17 * s, 600, w - 80 * s).map((l) => l.join(' '));   // the footnote wraps (phone-width frames) and the plot makes room for it
      const tm = scatterTimes(p), px0 = x + 96 * s, py0 = y + 116 * s, pw = w - 96 * s - 44 * s, ph = h - 116 * s - 122 * s - (fl.length - 1) * 24 * s, X = (v) => px0 + pw * (xa.invert ? (xa.max - v) : (v - xa.min)) / (xa.max - xa.min), Y = (v) => py0 + ph * (1 - (v - ya.min) / (ya.max - ya.min));
      const ak = E.enter(seg(u, p.axesAt, p.axesAt + p.axesDur)); let o = '';
      if (quad) { const qx = X(quad.x), bxE = X(better.x === 'low' ? xa.min : xa.max), qy = Y(quad.y), by = Y(better.y === 'high' ? ya.max : ya.min), qk = seg(u, p.axesAt + 0.3, p.axesAt + 0.9);
        o += rect(Math.min(qx, bxE), Math.min(qy, by), Math.abs(bxE - qx), Math.abs(by - qy), 0, p.accent, `opacity="${f2(0.07 * qk)}"`) + (quad.label ? text(quad.label + ' ↗', Math.max(qx, bxE) - 14 * s, Math.min(qy, by) + 30 * s, { size: 19 * s, weight: 700, fill: p.accent, anchor: 'end', op: 0.75 * qk }) : ''); }
      ya.ticks.forEach((v, i) => { const yy = Y(v), k = seg(ak, i * 0.08, i * 0.08 + 0.6); o += `<line x1="${f2(px0)}" x2="${f2(px0 + pw * k)}" y1="${f2(yy)}" y2="${f2(yy)}" stroke="${T.line}" stroke-width="${f2(1.2 * s)}"/>` + text(String(v), px0 - 16 * s, yy + 7 * s, { size: 19 * s, weight: 600, fill: T.muted, anchor: 'end', op: k, extra: TAB }); });
      xa.ticks.forEach((v, i) => { const xx = X(v), k = seg(ak, 0.2 + i * 0.05, 0.6 + i * 0.05); o += `<line x1="${f2(xx)}" x2="${f2(xx)}" y1="${f2(py0 + ph)}" y2="${f2(py0 + ph + 10 * s * k)}" stroke="${T.muted}" stroke-width="${f2(1.5 * s)}"/>` + text((xa.prefix || '') + v, xx, py0 + ph + 38 * s, { size: 19 * s, weight: 600, fill: T.muted, anchor: 'middle', op: k, extra: TAB }); });
      o += `<line x1="${f2(px0)}" x2="${f2(px0 + pw * ak)}" y1="${f2(py0 + ph)}" y2="${f2(py0 + ph)}" stroke="${T.ink}" stroke-width="${f2(2 * s)}" opacity="0.6"/><line x1="${f2(px0)}" x2="${f2(px0)}" y1="${f2(py0 + ph)}" y2="${f2(py0 + ph - ph * ak)}" stroke="${T.ink}" stroke-width="${f2(2 * s)}" opacity="0.6"/>` +
        text(xa.label, px0 + pw, py0 + ph + 72 * s, { size: 20 * s, weight: 700, fill: T.muted, anchor: 'end', op: ak }) + text(ya.label, px0 - 16 * s, py0 - 22 * s, { size: 20 * s, weight: 700, fill: T.muted, op: ak });
      if (p.frontier) { const fr = frontierOf(p.points, better).map((q) => [X(q.x), Y(q.y)]).sort((a, b) => a[0] - b[0]), len = polylineLen(fr), fk = E.soft(seg(u, tm.frontierAt, tm.frontierAt + p.frontierDur));
        if (fk > 0 && fr.length > 1) o += `<path d="${fr.map((q, i) => (i ? 'L' : 'M') + f2(q[0]) + ' ' + f2(q[1])).join(' ')}" fill="none" stroke="${T.ink}" stroke-width="${f2(2.6 * s)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.55" ${dash(len, fk)}/>`; }
      p.points.forEach((q, i) => { const k = spring(u - tm.pointAt(i), 'ui'); if (k <= 0) return; const cx = X(q.x), cy = Y(q.y), right = cx < px0 + pw - 170 * s;
        o += `<g${op(clamp(k * 1.5))}><circle cx="${f2(cx)}" cy="${f2(cy - 26 * s * (1 - k))}" r="${f2(8 * s)}" fill="${T.ink}" opacity="0.8"/>` + text(q.label, cx + (right ? 16 : -16) * s, cy - 12 * s, { size: 18 * s, weight: 600, fill: T.muted, anchor: right ? 'start' : 'end', op: seg(u, tm.pointAt(i) + 0.1, tm.pointAt(i) + 0.3) }) + '</g>'; });
      if (p.hero) { const q = p.hero, cx = X(q.x), cy = Y(q.y), k = spring(u - tm.heroAt, 'headline'), ring = u - tm.heroAt;
        if (k > 0) { o += (ring < 1.2 ? `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2((18 + 60 * E.enter(ring / 1.2)) * s)}" fill="none" stroke="${p.accent}" stroke-width="${f2(2.5 * s)}" opacity="${f2(0.6 * (1 - ring / 1.2))}"/>` : '') +
          `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, k))}) translate(${f2(-cx)} ${f2(-cy)})"><path d="${starPath(cx, cy, 22 * s)}" fill="${p.accent}"/></g>` + text(q.label, cx + 30 * s, cy - 18 * s, { size: 22 * s, weight: 800, fill: p.accent, op: clamp(k) });
          const ck = spring(u - tm.calloutAt, 'panel'), lines = q.callout || []; if (ck > 0 && lines.length) { const ox = cx + p.calloutOffset[0] * s, oy = cy + p.calloutOffset[1] * s, lw = Math.max(...lines.map((l) => measure(l, 34 * s, { weight: 700 })));
            o += `<g${op(clamp(ck * 1.4))}><path d="M${f2(cx - 10 * s)} ${f2(cy + 14 * s)} L${f2(ox + lw + 12 * s)} ${f2(oy - 26 * s)}" stroke="${p.accent}" stroke-width="${f2(2 * s)}" fill="none" ${dash(Math.hypot(ox + lw - cx, oy - cy) + 40 * s, ck)}/>` +
              lines.map((l, j) => text(l, ox, oy + j * 44 * s + 10 * s * (1 - ck), { size: 34 * s, weight: 700, fill: T.ink })).join('') + '</g>'; } } }
      const panel = p.panel ? softShadow(id + 's', x, y, w, h, 26 * s, s, 0.8) + rect(x, y, w, h, 26 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) : '';
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)}>${panel}${text(p.title, x + 40 * s, y + 52 * s, { size: 26 * s, weight: 800, fill: T.ink, op: ak })}${o}${fl.map((l, i) => text(l, x + 40 * s, y + h - 24 * s - (fl.length - 1 - i) * 24 * s, { size: 17 * s, weight: 600, fill: T.muted, op: ak })).join('')}</g>`; } },

  'ui.dataTable': { file: 'type/gfx/ui-proof.js', tags: ['ui', 'table', 'data', 'finding', 'count-up', 'benchmark', 'proof', 'product-film'], dur: 4.6, inF: 8, outF: 8,
    d: { box: null, finding: 'Week 3 resolved more calls in the call, at a lower cost per call.', columns: TABLE.columns, rows: TABLE.rows, highlight: { row: 1, col: 3 },
      headerAt: 0.25, rowsAt: 0.5, stagger: 0.14, countDur: 0.9, hlAt: null, bars: null, barsAt: null, source: 'illustrative data', theme: 'light', accent: BRAND },   // box / scale null = chosen per frame shape (FRAME_DEFAULTS below)
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, id = uid('dt', ...bx(p.box, c)), pad = 44 * s, k = spring(u, 'panel'); let [x, y, w, h] = bx(p.box, c);
      let panel = softShadow(id + 's', x, y, w, h, 26 * s, s, 0.8) + rect(x, y, w, h, 26 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`);
      if (noSrc(p.source)) return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)}>${panel}${refuse(c, x + pad, y + pad, w - 2 * pad, 'ui.dataTable: set `source` (where the numbers come from)')}</g>`;
      const fl = p.finding ? wrapWords(p.finding, 34 * s, 700, w - 2 * pad).map((l) => l.join(' ')) : [], nr0 = p.rows.length, fit = (p.finding ? 74 * s + (fl.length - 1) * 42 * s : 0) + (p.bars ? (p.bars.h ?? 0.3) * h + 18 * s : 0) + 60 * s + nr0 * 70 * s + 46 * s + 2 * pad;   // content height at full row size
      if (fit < h) { const y0 = y; h = fit; y = y0 + (bx(p.box, c)[3] - fit) / 2; }   // shrink the panel to its content, centred in the box
      panel = softShadow(id + 's', x, y, w, h, 26 * s, s, 0.8) + rect(x, y, w, h, 26 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`);
      const tm = tableTimes(p), nc = p.columns.length, nr = p.rows.length, fs = 32 * s, hs = 26 * s, lw = Math.max(...p.rows.map((r) => measure(r.label, fs, { weight: 600 })), measure(p.columns[0].label, hs, { weight: 700 })) + 48 * s;
      const cw = (w - 2 * pad - lw) / Math.max(1, nc - 1), colX = (j) => x + pad + lw + cw * j, fy = y + pad + 34 * s, fk = seg(u, 0.1, 0.45);
      let o = fl.map((l, i) => text(l, x + pad, fy + i * 42 * s + 8 * s * (1 - fk), { size: 34 * s, weight: 700, fill: T.ink, op: fk })).join(''), top = p.finding ? fy + 40 * s + (fl.length - 1) * 42 * s : y + pad;   // the finding wraps inside the panel
      if (p.bars) { const r = p.rows[p.bars.row ?? 0], vals = r.values, mx = Math.max(...vals) || 1, bh = (p.bars.h ?? 0.3) * h, by = top + bh, bw = Math.min(140 * s, cw * 0.5);
        o += text(p.bars.title || r.label, x + pad, top + 30 * s, { size: 22 * s, weight: 700, fill: T.muted, op: fk });
        vals.forEach((v, j) => { const g = E.expoOut(seg(u, tm.barsAt + j * 0.12, tm.barsAt + j * 0.12 + p.countDur)), hh = (bh - 96 * s) * v / mx * g, bx0 = colX(j) + cw / 2 - bw / 2, hi = p.highlight && (p.highlight.col ?? -1) === j + 1;
          if (c.geo) (c.geo.bars ||= []).push({ x: bx0, w: bw, top: by - 30 * s - (bh - 96 * s) * v / mx, base: by - 30 * s, value: v, unit: r.unit, dec: r.dec, label: p.columns[j + 1].label });   // geometry side channel (chart.hoverTooltip reads the bars it hovers from here)
          o += rect(bx0, by - 30 * s - hh, bw, hh, 8 * s, hi ? p.accent : T.faint) + (g > 0 ? text(fmtUnit(v * g, r.unit, r.dec), bx0 + bw / 2, by - 42 * s - hh, { size: 22 * s, weight: 700, fill: hi ? p.accent : T.ink, anchor: 'middle', extra: TAB }) : '') +
            text(p.columns[j + 1].label, bx0 + bw / 2, by - 4 * s, { size: 19 * s, weight: 600, fill: T.muted, anchor: 'middle', op: fk }); });
        top = by + 18 * s; }
      const foot = 46 * s, hh = 60 * s, rh = Math.min(70 * s, (y + h - foot - top - hh) / nr), hk = spring(u - p.headerAt, 'ui');
      if (hk > 0) o += `<g${op(clamp(hk * 1.4))} transform="translate(${f2(-24 * s * (1 - hk))} 0)">` + p.columns.map((col, j) => text(col.label, j ? colX(j) - 14 * s : x + pad, top + 38 * s, { size: hs, weight: 700, fill: T.muted, anchor: j ? 'end' : 'start' })).join('') +
        `<line x1="${f2(x + pad)}" x2="${f2(x + pad + (w - 2 * pad) * hk)}" y1="${f2(top + hh - 6 * s)}" y2="${f2(top + hh - 6 * s)}" stroke="${T.line}" stroke-width="${f2(2 * s)}"/></g>`;
      const H = p.highlight, pulse = u >= tm.hlAt ? 0.5 - 0.5 * Math.cos(TAU * 1.1 * (u - tm.hlAt)) : 0, hlk = seg(u, tm.hlAt, tm.hlAt + 0.25);
      if (H && hlk > 0) { const j = H.col ?? null, i = H.row ?? null, rx = j != null ? colX(j - 1) + 10 * s : x + pad - 12 * s, rw = j != null ? cw - 6 * s : w - 2 * pad + 24 * s, ry = i != null ? top + hh + i * rh + 4 * s : top + 4 * s, rhh = i != null ? rh - 8 * s : hh + nr * rh - 8 * s;
        o += rect(rx, ry, rw, rhh, 10 * s, p.accent, `opacity="${f2(hlk * (0.08 + 0.1 * pulse))}"`) + rect(rx, ry, rw, rhh, 10 * s, 'none', `stroke="${p.accent}" stroke-width="${f2(2 * s)}" opacity="${f2(hlk)}"`); }
      p.rows.forEach((r, i) => { const t0 = tm.rowAt(i), rk = spring(u - t0, 'ui'); if (rk <= 0) return; const ry = top + hh + i * rh, ty = ry + rh / 2 + 11 * s, ck = E.expoOut(seg(u, t0, t0 + p.countDur));
        let row = (i ? `<line x1="${f2(x + pad)}" x2="${f2(x + w - pad)}" y1="${f2(ry)}" y2="${f2(ry)}" stroke="${T.line}" stroke-width="${f2(1.2 * s)}"/>` : '') + text(r.label, x + pad, ty, { size: fs, weight: 600, fill: T.ink });
        r.values.forEach((v, j) => { const hi = H && (H.row == null || H.row === i) && (H.col == null || H.col === j + 1) && u >= tm.hlAt; row += text(fmtUnit(v * ck, r.unit ?? p.columns[j + 1]?.unit, r.dec), colX(j + 1) - 14 * s, ty, { size: fs, weight: hi ? 800 : 600, fill: hi ? p.accent : T.ink, anchor: 'end', extra: TAB }); });
        o += `<g${op(clamp(rk * 1.5))} transform="translate(0 ${f2(14 * s * (1 - rk))})">${row}</g>`; });
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)} transform="translate(0 ${f2(18 * s * (1 - k))})">${panel}${o}${text('source: ' + String(p.source).trim(), x + pad, y + h - 20 * s, { size: 19 * s, weight: 600, fill: T.muted, op: fk })}</g>`; } },

  'ui.costTicker': { file: 'type/gfx/ui-proof.js', tags: ['ui', 'cost', 'tokens', 'ticker', 'usage', 'counter', 'tracked', 'footage', 'proof'], dur: 3.8, inF: 6, outF: 8,
    d: { anchor: [0.56, 0.62], offset: [44, -190], counters: [{ label: 'tokens', keys: [[0.35, 0], [3.1, 48200]], dec: 0 }, { label: 'cost', keys: [[0.35, 0], [3.1, 0.97]], prefix: '$', dec: 2, warn: 0.5 }],
      mode: 'count', zero: { value: '$0', label: 'per query · on device' }, source: 'illustrative values', dot: true, accent: BRAND, warnColor: AMBER },
    svg(L, p, c) { const s = c.s, u = L.u, [fx, fy] = trackAt(p.anchor, u, c, L.t), ax = fx * c.W, ay = fy * c.H, S = c.safe, k = spring(u, 'ui'), ns = 40 * s, ls = 16 * s, pad = 24 * s, zero = { ...TICK_ZERO, ...p.zero };
      const cells = tickerCells(p).map((ct) => { if (ct === null) return { label: zero.label, str: zero.value, w: Math.max(measure(zero.value, ns, { weight: 800 }), measure(zero.label.toUpperCase(), ls, { weight: 700, ls: 1.2 })), col: '#4BE08F' };
        const lab = String(ct.label ?? ''), v = keysAt(ct.keys, u), vals = ct.keys.map((q) => q[1]), wmax = Math.max(...vals.map((q) => measure((ct.prefix || '') + commas(q, ct.dec ?? 0) + (ct.suffix || ''), ns, { weight: 800 })), measure(lab.toUpperCase(), ls, { weight: 700, ls: 1.2 }));
        const warnK = ct.warn != null ? clamp((v - ct.warn) / (Math.abs(ct.warn) * 0.08 || 1)) : 0; return { label: lab, str: (ct.prefix || '') + commas(v, ct.dec ?? 0) + (ct.suffix || ''), w: wmax, col: mixHex('#FFFFFF', p.warnColor, warnK) }; });
      if (!cells.length) return '';
      const cw = cells.reduce((a, q) => a + q.w, 0) + pad * 2 * cells.length, ch = 96 * s, cx = clamp(ax + p.offset[0] * s, S.x0, S.x1 - cw), cy = clamp(ay + p.offset[1] * s, S.y0, S.y1 - ch - 34 * s);
      if (noSrc(p.source)) return `<g${fade(L)}>${refuse(c, cx, cy, 760 * s, 'ui.costTicker: set `source` for the numbers')}</g>`;
      let o = '', xx = cx; cells.forEach((q, i) => { if (i) o += `<line x1="${f2(xx)}" x2="${f2(xx)}" y1="${f2(cy + 18 * s)}" y2="${f2(cy + ch - 18 * s)}" stroke="rgba(255,255,255,0.18)" stroke-width="${f2(1.5 * s)}"/>`;
        o += text(q.label.toUpperCase(), xx + pad, cy + 32 * s, { size: ls, weight: 700, fill: 'rgba(255,255,255,0.62)', ls: 1.2 }) + text(q.str, xx + pad + q.w, cy + 76 * s, { size: ns, weight: 800, fill: q.col, anchor: 'end', extra: TAB }); xx += q.w + pad * 2; });
      const lead = p.dot ? `<line x1="${f2(ax)}" y1="${f2(ay)}" x2="${f2(clamp(ax, cx + 20 * s, cx + cw - 20 * s))}" y2="${f2(ay < cy ? cy : cy + ch)}" stroke="#FFFFFF" stroke-width="${f2(2 * s)}" opacity="0.7" ${dash(Math.hypot(cx - ax, cy - ay) + ch, k)}/>` +
        `<circle cx="${f2(ax)}" cy="${f2(ay)}" r="${f2(7 * s)}" fill="${p.accent}" stroke="#FFFFFF" stroke-width="${f2(2.5 * s)}"/><circle cx="${f2(ax)}" cy="${f2(ay)}" r="${f2((12 + 16 * ((u * 0.8) % 1)) * s)}" fill="none" stroke="#FFFFFF" stroke-width="${f2(1.5 * s)}" opacity="${f2(0.5 * (1 - (u * 0.8) % 1))}"/>` : '';
      const gx = cx + cw / 2, gy = cy + ch / 2;
      return `<g${fade(L)}>${lead}<g transform="translate(${f2(gx)} ${f2(gy)}) scale(${f2(Math.max(0.001, lerp(0.85, 1, k)))}) translate(${f2(-gx)} ${f2(-gy)})">${rect(cx, cy, cw, ch, 22 * s, 'rgba(14,13,20,0.84)', `stroke="rgba(255,255,255,0.14)" stroke-width="${f2(1.5 * s)}"`)}${o}</g>` +
        text('source: ' + String(p.source).trim(), cx + cw - 6 * s, cy + ch + 28 * s, { size: 17 * s, weight: 600, fill: '#FFFFFF', op: 0.75, anchor: 'end', extra: 'style="paint-order:stroke" stroke="rgba(0,0,0,0.5)" stroke-width="3"' }) + '</g>'; } },

  'type.paramReadout': { file: 'type/gfx/ui-proof.js', tags: ['type', 'hud', 'readout', 'math', 'parameters', 'numbers', 'figure', 'proof'], dur: 3.2, inF: 8, outF: 8,
    d: { center: [0.5, 0.86], size: 44, fields: READ, color: '#FFFFFF', labelColor: 'rgba(255,255,255,0.6)', plate: false, slide: 0.18, source: 'illustrative values', font: MATH },
    svg(L, p, c) { const G = readoutGeo(p, c), S = G.S, u = L.u, id = uid('pr', G.x0, G.y, G.W), sh = p.plate ? '' : 'style="paint-order:stroke" stroke="rgba(0,0,0,0.45)" stroke-width="2"', src = String(p.source ?? '').trim() || 'illustrative values'; let o = '', clips = '';   // a blank source falls back to the default label
      fieldsOf(p).forEach((fl, i) => { const g = G.f[i], x = G.x0 + g.x, k = spring(u - 0.06 * i, 'ui'), vx = x + g.nw + g.ew, base = G.y;
        if (fl.label) o += text(fl.label, x, base - S * 1.02, { size: S * 0.42, weight: 700, fill: p.labelColor, ls: 1.2, op: k, extra: 'font-variant="small-caps"' });
        o += `<text x="${f2(x)}" y="${f2(base)}" font-family="${p.font.replace(/"/g, "'")}" font-size="${f2(S)}" font-style="italic" fill="${p.color}" opacity="${f2(clamp(k))}" ${sh}>${fl.name.replace(/[&<>]/g, '')}<tspan font-style="normal"> = </tspan></text>`;
        clips += `<clipPath id="${id}c${i}"><rect x="${f2(vx - 4)}" y="${f2(base - S * 1.05)}" width="${f2(g.vw + 8)}" height="${f2(S * 1.35)}"/></clipPath>`;
        let v; if (fl.mode === 'step') { let j = 0; for (let q = 0; q < fl.keys.length; q++) if (u >= fl.keys[q][0]) j = q; const sk = j ? E.enter(seg(u, fl.keys[j][0], fl.keys[j][0] + p.slide)) : 1;
          v = (j && sk < 1 ? text(fieldStr(fl, fl.keys[j - 1][1]), vx, base - S * sk, { size: S * 0.92, weight: 600, fill: p.color, op: 1 - sk, extra: TAB }) : '') + text(fieldStr(fl, fl.keys[j][1]), vx, base + S * (1 - sk), { size: S * 0.92, weight: 600, fill: p.color, op: sk, extra: TAB });
        } else v = text(fieldStr(fl, fieldVal(fl, u)), vx, base, { size: S * 0.92, weight: 600, fill: p.color, extra: TAB });
        o += `<g clip-path="url(#${id}c${i})"${op(clamp(k))}>${v}</g>`; });
      const plate = p.plate ? rect(G.x0 - S * 0.6, G.y - S * 1.6, G.W + S * 1.2, S * 2.5, S * 0.3, 'rgba(10,10,14,0.62)') : '';
      return `<defs>${clips}</defs><g${fade(L)}>${plate}${o}${text(src, G.x0 + G.W, G.y + S * 0.85, { size: Math.max(16 * c.s, S * 0.36), weight: 600, fill: p.labelColor, anchor: 'end', extra: sh })}</g>`; } },
};
/* the two dense parts (scatter, table) size their type from the SHORTER side of the frame (ctx.s is H / 1080, which blows type up 1.78x on a 1080 x 1920 frame): same type size in 16:9 and 9:16, `scale` enlarges it.
   ui.dataTable also picks box + scale for the frame shape when you pass none: 16:9 = the desktop / TV box at scale 1; 9:16 = a phone layout (wide box, scale 1.15 -> numerals 12.3 px on a 360 px wide phone). */
const DENSE = new Set(['chart.scatterFrontier', 'ui.dataTable']);
const FRAME_DEFAULTS = { 'ui.dataTable': { wide: { box: [0.1, 0.1, 0.8, 0.8], scale: 1 }, tall: { box: [0.04, 0.14, 0.92, 0.72], scale: 1.15 } } };
for (const [id, g] of Object.entries(PROOF)) { const f = g.svg, fd = FRAME_DEFAULTS[id]; g.d.scale = fd ? null : 1;
  g.svg = (L, p, c) => { const b = DENSE.has(id) && c.tall ? { ...c, s: c.W / 1080 } : c, q = fd ? { ...p, ...Object.fromEntries(Object.entries(c.tall ? fd.tall : fd.wide).filter(([k]) => p[k] == null)) } : p; return f(L, q, q.scale && q.scale !== 1 ? { ...b, s: b.s * q.scale } : b); }; }

/* ---------- sound: one cue per action (local times; index.js adds the item's at) ---------- */
export const PROOF_CUES = {
  'chart.scatterFrontier': (p) => { const tm = scatterTimes(p); if ([...p.points, ...(p.hero ? [p.hero] : [])].some((q) => noSrc(q.source))) return [{ t: 0, id: 'sfx/ui/error', why: 'refused: a point has no source' }];
    return [{ t: p.axesAt, id: 'sfx/ui/slide', why: 'axes draw on' }, ...p.points.map((_, i) => ({ t: tm.pointAt(i), id: rr(POPS, i), why: 'point ' + (i + 1) + ' drops in' })),
      ...(p.frontier ? [{ t: tm.frontierAt, id: 'sfx/ui/scan_sweep', why: 'frontier draws' }] : []), ...(p.hero ? [{ t: tm.heroAt, id: 'sfx/sparkle/shimmer', why: 'hero point + star' }, { t: tm.calloutAt, id: 'sfx/ui/blip', why: 'callout' }] : [])]; },
  'ui.dataTable': (p) => { const tm = tableTimes(p); if (noSrc(p.source)) return [{ t: 0, id: 'sfx/ui/error', why: 'refused: no source' }];
    return [{ t: p.headerAt, id: 'sfx/ui/slide', why: 'header slides in' }, ...p.rows.map((_, i) => ({ t: tm.rowAt(i), id: rr(TICKS, i), why: 'row ' + (i + 1) })), { t: tm.rowsAt + 0.03, id: 'sfx/ui/count_run', why: 'numbers count up' },
      ...(p.bars ? [{ t: tm.barsAt + 0.05, id: 'sfx/device/progress_fill', why: 'bars grow' }] : []), ...(p.highlight ? [{ t: tm.hlAt, id: 'sfx/ui/blip', why: 'highlight pulses' }] : [])].sort((a, b) => a.t - b.t); },
  'ui.costTicker': (p) => { if (noSrc(p.source)) return [{ t: 0, id: 'sfx/ui/error', why: 'refused: no source' }]; const real = tickerCells(p).filter(Boolean), out = [{ t: 0, id: 'sfx/ui/pop', why: 'chip pins on' }];
    if (real.length) out.push({ t: Math.min(...real.map((ct) => ct.keys[0][0])), id: 'sfx/ui/count_run', why: 'counters run' });
    real.forEach((ct) => { if (ct.warn == null) return; for (let j = 1; j < ct.keys.length; j++) { const [a, va] = ct.keys[j - 1], [b, vb] = ct.keys[j]; if (va < ct.warn && vb >= ct.warn) { out.push({ t: +(a + (b - a) * (ct.warn - va) / (vb - va)).toFixed(4), id: 'sfx/ui/error', why: String(ct.label ?? 'counter') + ' passes the threshold' }); break; } } });
    if (p.mode === 'zero') out.push({ t: 0.25, id: 'sfx/ui/success', why: 'zero cost per query' }); return out.sort((a, b) => a.t - b.t); },
  'type.paramReadout': (p) => { const out = []; let n = 0; fieldsOf(p).forEach((fl) => { if (fl.mode === 'step') fl.keys.slice(1).forEach((q) => out.push({ t: q[0], id: rr(TICKS, n++), why: fl.name + ' steps' })); else out.push({ t: fl.keys[0][0], id: 'sfx/ui/count_run', why: fl.name + ' rolls' }); });
    const seen = []; for (const q of out.sort((a, b) => a.t - b.t)) if (!seen.length || q.t - seen.at(-1).t > 0.06) seen.push(q); return seen; },
};
