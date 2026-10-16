/* motion-pack / type / gfx / explain-data.js: data-journalism parts with HONEST AXES (lane explainer, 2026-10-16). Pure functions of t (seek-safe), plain SVG strings.
     chart.story        bar | line | area | scatter, animated; zero baseline for bars and areas (always), a truncated line / scatter axis draws an axis break and a label in frame,
                        units on the axis, the source footer on EVERY frame the chart is up, locale number formatting (numfmt.js), progressive reveal (`show`) and highlight changes (`hl`)
     callout.datum      a leader from a label to ONE datum of a chart.story (pass the same chart params: the dot lands on the exact bar top / point), or to a frame point
     map.hexTile        a hex-tile choropleth built in code (axial q, r), one-hue sequential ramp, binned legend, units, source footer; no GeoJSON, nothing fetched
     counter.hero       "the number that matters": one big number counting up in its locale (12,34,56,789 or 1.2 crore / 12.3M), its unit, one context line and its source
     chart.sourceFooter the source + method + DEMO DATA line, alone (every chart part already draws it)
   Honesty: every part that prints a number prints its source (srcOf: 'placeholder data' until a real source is passed) and, with demo: true (the default), a DEMO DATA pill.
   The template gate (templates/_explain/honesty.mjs) refuses a dataset without source + method, a bar / area baseline that is not zero and a truncated axis without its label;
   the part itself can never hide the break or the footer. */
import { E, clamp, seg, lerp, f2, text, measure, srcOf, inkOn, BRAND, PLACEHOLDER } from './core.js';
import { mixHex } from './swap.js';
import { fmtNumber, fmtAxis } from './numfmt.js';
export const PAPER_INK = '#16151B', MUTED = '#8C8796', SOFT = '#C9C3B8', WARN = '#B3261E';
const bx = (b, c) => [b[0] * c.W, b[1] * c.H, b[2] * c.W, b[3] * c.H];
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
/* a nice domain covering [lo, hi] with about n ticks (lo / hi land ON ticks) */
export function niceDomain(lo, hi, n = 5) {
  lo = num(lo); hi = num(hi); if (!(hi > lo)) hi = lo + (Math.abs(lo) || 1);
  const raw = (hi - lo) / Math.max(1, Math.min(12, n)), m = 10 ** Math.floor(Math.log10(raw)), f = raw / m, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * m;
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, ticks = [];
  for (let i = 0, v = a; v <= b + step * 1e-6 && i < 40; i++, v = a + i * step) ticks.push(+v.toFixed(10));
  return { lo: a, hi: b, step, ticks };
}
/* the footer: Source + Method + a DEMO DATA pill, inside the safe rect */
export function footerSVG(p, c, x, y, w, op = 1) {
  const s = c.s * num(p.size, 1), sz = Math.max(24 * c.s, 24 * s), src = 'Source: ' + srcOf(p), meth = String(p.method ?? '').trim();
  const pill = p.demo !== false ? 'DEMO DATA' : '', pw = pill ? measure(pill, sz, { weight: 800 }) + 28 * c.s : 0, line = src + (meth ? '  ·  Method: ' + meth : '');
  let fs = sz; const room = w - pw - 20 * c.s; if (measure(line, fs, { weight: 600 }) > room) fs = Math.max(18 * c.s, fs * room / measure(line, fs, { weight: 600 }));
  return `<g opacity="${f2(op)}">${pill ? `<rect x="${f2(x)}" y="${f2(y - sz * 0.95)}" width="${f2(pw)}" height="${f2(sz * 1.35)}" rx="${f2(6 * c.s)}" fill="${p.ink || PAPER_INK}"/>` + text(pill, x + 14 * c.s, y, { size: sz, weight: 800, fill: p.paper || '#FFFFFF', ls: 1 * c.s }) : ''}`
    + text(line, x + pw + (pill ? 14 * c.s : 0), y, { size: fs, weight: 600, fill: p.ink || PAPER_INK, op: 0.78 }) + '</g>';
}
const footY = (c, y1) => Math.min(c.safe.y1 - 6 * c.s, y1);

/* ---------- chart.story: the geometry is a function the callout reuses ---------- */
const STORY_D = { kind: 'bar', title: '', subtitle: '', labels: ['North', 'South', 'East', 'West', 'Central'], series: [{ name: 'Demo series', values: [42, 35, 28, 19, 12] }], points: null,
  unit: '', yLabel: '', xLabel: '', xUnit: '', yMin: null, yMax: null, xMin: null, xMax: null, truncated: '', locale: 'intl', dec: 0, highlight: -1, hl: [], compare: -1, show: [],
  box: [0.1, 0.2, 0.8, 0.56], accent: BRAND, ink: PAPER_INK, muted: SOFT, paper: '#FFFFFF', grow: 0.9, stagger: 0.09, valueLabels: true, legend: true,
  source: PLACEHOLDER, method: '', demo: true, size: 1 };
export const ZERO_KINDS = ['bar', 'area'];   // these encode magnitude by length or area: the baseline is zero, always
export function chartGeom(p0, c) {
  const p = { ...STORY_D, ...p0 }, s = c.s * num(p.size, 1), [X, Y, Wb, Hb] = bx(p.box, c), kind = ['bar', 'line', 'area', 'scatter'].includes(p.kind) ? p.kind : 'bar';
  const series = [].concat(p.series || []).slice(0, 8).map((q, i) => ({ name: String(q?.name ?? 'Series ' + (i + 1)), values: [].concat(q?.values || []).slice(0, 60).map((v) => num(v, NaN)), color: q?.color }));
  const pts = kind === 'scatter' ? [].concat(p.points || []).slice(0, 400).map((q) => ({ x: num(q?.[0] ?? q?.x, NaN), y: num(q?.[1] ?? q?.y, NaN), label: q?.[2] ?? q?.label ?? '' })).filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) : [];
  const ys = kind === 'scatter' ? pts.map((q) => q.y) : series.flatMap((q) => q.values.filter(Number.isFinite)), vmin = ys.length ? Math.min(...ys) : 0, vmax = ys.length ? Math.max(...ys) : 1;
  const wantLo = ZERO_KINDS.includes(kind) ? Math.min(0, vmin) : p.yMin != null && Number.isFinite(+p.yMin) ? Math.min(+p.yMin, vmin) : Math.min(0, vmin);
  const dom = niceDomain(wantLo, p.yMax != null && Number.isFinite(+p.yMax) ? Math.max(+p.yMax, vmax) : Math.max(0, vmax), 5);
  if (!ZERO_KINDS.includes(kind) && p.yMin != null && Number.isFinite(+p.yMin) && +p.yMin > 0 && +p.yMin <= vmin) { dom.lo = +p.yMin; dom.ticks = [dom.lo, ...dom.ticks.filter((t) => t > dom.lo + dom.step * 0.4)]; }
  const truncated = dom.lo > 0 || (dom.hi < 0);
  const tickW = Math.max(...dom.ticks.map((t) => measure(fmtAxis(t, { locale: p.locale, dec: p.dec }), 24 * s, { weight: 600 })), 30 * s);
  const top = (p.title ? 70 * s : 0) + (p.subtitle ? 40 * s : 0) + (p.yLabel || p.unit ? 44 * s : 10 * s), left = tickW + 22 * s, bottom = (kind === 'scatter' ? 78 : 64) * s + (p.xLabel ? 36 * s : 0);
  const x = X + left, y = Y + top, w = Math.max(10, Wb - left - 10 * s), h = Math.max(10, Hb - top - bottom);
  const sy = (v) => y + h - (h * (v - dom.lo)) / (dom.hi - dom.lo || 1);
  let sx, xdom = null; const n = Math.max(1, kind === 'scatter' ? pts.length : Math.max(p.labels?.length || 0, ...series.map((q) => q.values.length)));
  if (kind === 'scatter') { const xs = pts.map((q) => q.x); xdom = niceDomain(p.xMin ?? (xs.length ? Math.min(...xs) : 0), p.xMax ?? (xs.length ? Math.max(...xs) : 1), 5); sx = (v) => x + (w * (v - xdom.lo)) / (xdom.hi - xdom.lo || 1); }
  else if (kind === 'bar') sx = (i) => x + ((i + 0.5) * w) / n; else sx = (i) => x + (n > 1 ? (i * w) / (n - 1) : w / 2);
  return { p, s, kind, series, pts, dom, xdom, truncated, x, y, w, h, X, Y, Wb, Hb, sx, sy, n, base: sy(Math.max(dom.lo, Math.min(dom.hi, 0))) };
}
/* the datum's pixel: [category index, series index] for bar / line / area, [x, y] (data units) or a point index for scatter */
export function datumXY(G, datum = [0, 0]) {
  const [a, b] = [].concat(datum); if (G.kind === 'scatter') { if (b == null && G.pts[a]) return [G.sx(G.pts[a].x), G.sy(G.pts[a].y)]; return [G.sx(num(a)), G.sy(num(b))]; }
  const si = Math.max(0, Math.min(G.series.length - 1, Math.trunc(num(b)))), i = Math.max(0, Math.min(G.n - 1, Math.trunc(num(a)))), v = G.series[si]?.values[i];
  if (G.kind === 'bar') { const k = G.series.length, bw = Math.min((G.w / G.n) * 0.66, 160 * G.s), sub = bw / k; return [G.sx(i) - bw / 2 + sub * (si + 0.5), G.sy(num(v))]; }
  return [G.sx(i), G.sy(num(v))];
}
const startOf = (p, i) => { const show = [].concat(p.show || []).filter((q) => Array.isArray(q)); if (!show.length) return i * num(p.stagger, 0.09);
  let prevN = 0; for (const [t, nn] of show) { if (nn > i) return num(t) + (i - prevN) * num(p.stagger, 0.09); prevN = Math.max(prevN, num(nn)); } return Infinity; };
const hlAt = (p, u) => { let h = p.highlight, from = p.highlight, t0 = -1; for (const q of [].concat(p.hl || [])) if (Array.isArray(q) && u >= num(q[0])) { from = h; h = q[1]; t0 = num(q[0]); } return { h, from, k: t0 < 0 ? 1 : E.soft(seg(u, t0, t0 + 0.35)) }; };
/* rounded data-end (4 px) on the value side, square on the baseline */
const barPath = (x, y0, w, y1, r) => { const up = y1 < y0, rr = Math.min(r, Math.abs(y0 - y1) / 2, w / 2); if (Math.abs(y0 - y1) < 0.5) return '';
  return up ? `M${f2(x)} ${f2(y0)} V${f2(y1 + rr)} Q${f2(x)} ${f2(y1)} ${f2(x + rr)} ${f2(y1)} H${f2(x + w - rr)} Q${f2(x + w)} ${f2(y1)} ${f2(x + w)} ${f2(y1 + rr)} V${f2(y0)} Z`
    : `M${f2(x)} ${f2(y0)} V${f2(y1 - rr)} Q${f2(x)} ${f2(y1)} ${f2(x + rr)} ${f2(y1)} H${f2(x + w - rr)} Q${f2(x + w)} ${f2(y1)} ${f2(x + w)} ${f2(y1 - rr)} V${f2(y0)} Z`; };
function storySVG(L, p, c) {
  const G = chartGeom(p, c), { s, x, y, w, h, dom, kind } = G, u = L.u, ink = p.ink, o = 1 - L.out, fmtV = (v) => fmtNumber(v, { locale: p.locale, dec: p.dec, unit: p.unit });
  const H = hlAt(p, u), colOf = (i, si) => { const isH = (j) => j === i || (typeof j === 'string' && (p.labels?.[i] === j || G.series[si]?.name === j));
    const base = G.series[si]?.color || (si === num(p.compare, -1) ? p.muted : G.series.length > 1 && si > 0 ? mixHex(p.accent, p.paper, 0.45) : p.highlight < 0 && !(p.hl || []).length ? p.accent : p.muted);
    const was = isH(H.from) ? p.accent : base, now = isH(H.h) ? p.accent : base; return mixHex(was, now, H.k); };
  let g = '';
  if (p.title) g += text(p.title, G.X, G.Y + 44 * s, { size: 44 * s, weight: 800, fill: ink });
  if (p.subtitle) g += text(p.subtitle, G.X, G.Y + (p.title ? 88 : 36) * s, { size: 28 * s, weight: 600, fill: ink, op: 0.72 });
  if (p.yLabel || p.unit) g += text(p.yLabel || p.unit, G.X, y - 18 * s, { size: 26 * s, weight: 700, fill: ink, op: 0.8 });
  /* grid + ticks (recessive), the zero line (strong) */
  for (const t of dom.ticks) { const yy = G.sy(t); if (yy < y - 1 || yy > y + h + 1) continue; g += `<line x1="${f2(x)}" x2="${f2(x + w)}" y1="${f2(yy)}" y2="${f2(yy)}" stroke="${ink}" stroke-opacity="${t === 0 ? 0.7 : 0.12}" stroke-width="${f2((t === 0 ? 2.5 : 1.5) * s)}"/>` + text(fmtAxis(t, { locale: p.locale, dec: p.dec }), x - 14 * s, yy + 8 * s, { size: 24 * s, weight: 600, fill: ink, anchor: 'end', op: 0.7 }); }
  if (G.truncated) { const yb = y + h, zz = `M${f2(x - 12 * s)} ${f2(yb - 6 * s)} l${f2(8 * s)} ${f2(-8 * s)} l${f2(8 * s)} ${f2(8 * s)} l${f2(8 * s)} ${f2(-8 * s)}`;
    g += `<path d="${zz}" fill="none" stroke="${WARN}" stroke-width="${f2(3 * s)}"/><path d="${zz.replace(/^M(\S+) (\S+)/, (m0, a, b) => `M${a} ${f2(+b + 10 * s)}`)}" fill="none" stroke="${WARN}" stroke-width="${f2(3 * s)}"/>`
      + text(String(p.truncated || '').trim() || `Axis starts at ${fmtAxis(dom.lo, { locale: p.locale, dec: p.dec })}, not zero`, x + 14 * s, yb - 14 * s, { size: 26 * s, weight: 800, fill: WARN }); }
  if (kind === 'bar') {
    const k = G.series.length, bw = Math.min((w / G.n) * 0.66, 160 * s), sub = bw / Math.max(1, k), gap = k > 1 ? 2 * s : 0;
    for (let i = 0; i < G.n; i++) { const st = startOf(p, i); if (u < st) continue; const e = E.hero(seg(u, st, st + num(p.grow, 0.9)));
      G.series.forEach((q, si) => { const v = q.values[i]; if (!Number.isFinite(v)) return; const x0 = G.sx(i) - bw / 2 + sub * si + gap / 2, y1 = lerp(G.base, G.sy(v), e);
        g += `<path d="${barPath(x0, G.base, sub - gap, y1, 4 * s)}" fill="${colOf(i, si)}"/>`;
        if (p.valueLabels && k <= 2) g += text(fmtV(v * e), x0 + (sub - gap) / 2, v >= 0 ? y1 - 12 * s : y1 + 32 * s, { size: (k > 1 ? 24 : 30) * s, weight: 800, fill: ink, anchor: 'middle', op: seg(e, 0.2, 0.6) }); });
      g += text(String(p.labels?.[i] ?? ''), G.sx(i), y + h + 40 * s, { size: 26 * s, weight: 600, fill: ink, anchor: 'middle', op: E.soft(seg(u, st, st + 0.3)) * 0.85 }); }
  } else if (kind === 'line' || kind === 'area') {
    for (let i = 0; i < G.n; i++) { const st = startOf(p, i); if (u >= st - 0.2 && (i % Math.ceil(G.n / 8) === 0 || i === G.n - 1)) g += text(String(p.labels?.[i] ?? ''), G.sx(i), y + h + 40 * s, { size: 24 * s, weight: 600, fill: ink, anchor: 'middle', op: 0.8 }); }
    G.series.forEach((q, si) => { const col = colOf(-1, si), vis = []; q.values.forEach((v, i) => { if (!Number.isFinite(v)) return; const st = startOf(p, i), e = seg(u, st, st + num(p.grow, 0.9) * 0.5); if (e > 0) vis.push([G.sx(i), G.sy(v), e, v]); });
      if (!vis.length) return; const last = vis.at(-1), tail = last[2] < 1 && vis.length > 1 ? [lerp(vis.at(-2)[0], last[0], last[2]), lerp(vis.at(-2)[1], last[1], last[2])] : [last[0], last[1]];
      const ptsD = [...vis.slice(0, -1).map((q2) => [q2[0], q2[1]]), tail], d = ptsD.map((q2, i) => `${i ? 'L' : 'M'}${f2(q2[0])} ${f2(q2[1])}`).join(' ');
      if (kind === 'area') g += `<path d="${d} L${f2(tail[0])} ${f2(G.base)} L${f2(ptsD[0][0])} ${f2(G.base)} Z" fill="${col}" fill-opacity="${si === num(p.compare, -1) ? 0.12 : 0.22}"/>`;
      g += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f2((si === num(p.compare, -1) ? 3 : 5) * s)}" stroke-linecap="round" stroke-linejoin="round"${si === num(p.compare, -1) ? ` stroke-dasharray="${f2(10 * s)} ${f2(8 * s)}"` : ''}/>`;
      for (const q2 of vis.slice(0, last[2] < 1 ? -1 : undefined)) g += `<circle cx="${f2(q2[0])}" cy="${f2(q2[1])}" r="${f2(5 * s)}" fill="${col}" stroke="${p.paper}" stroke-width="${f2(2 * s)}"/>`;
      if (G.series.length <= 4 && last[2] >= 1 && vis.length === q.values.filter(Number.isFinite).length) g += text(q.name, Math.min(last[0] + 14 * s, x + w - 4 * s), last[1] - 14 * s, { size: 24 * s, weight: 700, fill: ink, anchor: last[0] + 200 * s > x + w ? 'end' : 'start' }); });
  } else {
    const xt = G.xdom.ticks; for (const t of xt) { const xx = G.sx(t); g += `<line x1="${f2(xx)}" x2="${f2(xx)}" y1="${f2(y)}" y2="${f2(y + h)}" stroke="${ink}" stroke-opacity="0.08" stroke-width="${f2(1.5 * s)}"/>` + text(fmtAxis(t, { locale: p.locale, dec: p.dec }) + (p.xUnit && t === xt.at(-1) ? ' ' + p.xUnit : ''), xx, y + h + 38 * s, { size: 24 * s, weight: 600, fill: ink, anchor: 'middle', op: 0.7 }); }
    const order = G.pts.map((q, i) => [q.x, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    order.forEach(([, i], r) => { const q = G.pts[i], st = startOf(p, r) * 0.4, e = E.hero(seg(u, st, st + 0.35)); if (e <= 0) return; const isH = H.h === i || H.h === q.label;
      g += `<circle cx="${f2(G.sx(q.x))}" cy="${f2(G.sy(q.y))}" r="${f2((isH ? 12 : 9) * s * e)}" fill="${isH ? p.accent : p.muted}" fill-opacity="${isH ? 1 : 0.85}" stroke="${p.paper}" stroke-width="${f2(2 * s)}"/>`; });
  }
  if (p.xLabel) g += text(p.xLabel, x + w, y + h + (kind === 'scatter' ? 74 : 76) * s, { size: 24 * s, weight: 700, fill: ink, anchor: 'end', op: 0.75 });
  if (p.legend && G.series.length >= 2 && kind !== 'scatter') G.series.forEach((q, si) => { const lx = x + w - (G.series.length - si) * 260 * s; g += `<rect x="${f2(lx)}" y="${f2(y - 40 * s)}" width="${f2(22 * s)}" height="${f2(22 * s)}" rx="${f2(4 * s)}" fill="${colOf(-1, si)}"/>` + text(q.name, lx + 32 * s, y - 21 * s, { size: 24 * s, weight: 700, fill: ink }); });
  g += footerSVG(p, c, G.X, footY(c, G.Y + G.Hb + 40 * s), G.Wb, 1);
  return `<g opacity="${f2(o * Math.max(0.0001, E.soft(L.in)))}">${g}</g>`;
}

/* ---------- callout.datum ---------- */
function datumSVG(L, p, c) {
  const s = c.s * num(p.size, 1), u = L.u, o = 1 - L.out; let px, py;
  if (p.chart) { const G = chartGeom({ ...p.chart, size: p.chart.size ?? p.size }, c); [px, py] = datumXY(G, p.datum || [0, 0]); } else { px = num(p.point?.[0], 0.5) * c.W; py = num(p.point?.[1], 0.5) * c.H; }
  const lines = [String(p.label ?? '')].concat(p.sub ? [String(p.sub)] : []), sz = 30 * s, tw = Math.max(...lines.map((l, i) => measure(l, i ? sz * 0.8 : sz, { weight: i ? 600 : 800 }))), bw = tw + 40 * s, bh = (lines.length > 1 ? 96 : 62) * s;
  let lx = px + num(p.dx, 0.1) * c.W, ly = py + num(p.dy, -0.12) * c.H; const S = c.safe;
  lx = clamp(lx - (num(p.dx, 0.1) < 0 ? bw : 0), S.x0, S.x1 - bw); ly = clamp(ly - bh / 2, S.y0, S.y1 - bh);
  const ex = lx + (lx > px ? 0 : bw), ey = ly + bh / 2, ring = E.hero(seg(u, 0, 0.3)), draw = E.soft(seg(u, 0.12, 0.55)), box = E.hero(seg(u, 0.4, 0.75));
  const mx = px + (ex - px) * 0.35, len = Math.hypot(mx - px, ey - py) + Math.abs(ex - mx);
  let g = `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(14 * s * ring)}" fill="none" stroke="${p.accent}" stroke-width="${f2(4 * s)}"/><circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(5 * s * ring)}" fill="${p.accent}"/>`;
  g += `<path d="M${f2(px)} ${f2(py)} L${f2(mx)} ${f2(ey)} L${f2(ex)} ${f2(ey)}" fill="none" stroke="${p.ink}" stroke-width="${f2(2.5 * s)}" stroke-dasharray="${f2(len)} ${f2(len + 1)}" stroke-dashoffset="${f2(len * (1 - draw))}"/>`;
  g += `<g opacity="${f2(box)}" transform="translate(0 ${f2(10 * s * (1 - box))})"><rect x="${f2(lx)}" y="${f2(ly)}" width="${f2(bw)}" height="${f2(bh)}" rx="${f2(10 * s)}" fill="${p.paper}" stroke="${p.ink}" stroke-opacity="0.18" stroke-width="${f2(2 * s)}"/>`
    + lines.map((l, i) => text(l, lx + 20 * s, ly + (i ? 80 : 42) * s, { size: i ? sz * 0.8 : sz, weight: i ? 600 : 800, fill: p.ink, op: i ? 0.75 : 1 })).join('') + '</g>';
  return `<g opacity="${f2(o)}">${g}</g>`;
}

/* ---------- map.hexTile: axial pointy-top hexes ---------- */
const DEMO_TILES = [['A', 0, 0, 62], ['B', 1, 0, 48], ['C', 2, 0, 35], ['D', -1, 1, 71], ['E', 0, 1, 55], ['F', 1, 1, 40], ['G', 2, 1, 22], ['H', -1, 2, 66], ['I', 0, 2, 51], ['J', 1, 2, 30], ['K', 0, 3, 44], ['L', 1, 3, null]]
  .map(([k, q, r, v]) => ({ id: 'zone' + k, q, r, label: 'Zone ' + k, short: k, value: v }));
export function hexLayout(tiles, box) {
  const T = [].concat(tiles || []).slice(0, 400).filter((t) => t && Number.isFinite(+t.q) && Number.isFinite(+t.r)), R3 = Math.sqrt(3);
  if (!T.length) return { tiles: [], size: 0 };
  const ux = T.map((t) => R3 * (+t.q + +t.r / 2)), uy = T.map((t) => 1.5 * +t.r), x0 = Math.min(...ux) - R3 / 2, x1 = Math.max(...ux) + R3 / 2, y0 = Math.min(...uy) - 1, y1 = Math.max(...uy) + 1;
  const size = Math.min(box[2] / (x1 - x0), box[3] / (y1 - y0)), ox = box[0] + (box[2] - (x1 - x0) * size) / 2 - x0 * size, oy = box[1] + (box[3] - (y1 - y0) * size) / 2 - y0 * size;
  return { size, tiles: T.map((t, i) => ({ ...t, cx: ox + ux[i] * size, cy: oy + uy[i] * size })) };
}
export function binsOf(values, n = 5) { const v = values.filter(Number.isFinite); if (!v.length) return [0]; const D = niceDomain(Math.min(...v), Math.max(...v), Math.max(1, Math.min(9, n))); return D.ticks.slice(0, -1); }
function hexSVG(L, p, c) {
  const s = c.s * num(p.size, 1), u = L.u, [X, Y, Wb, Hb] = bx(p.box, c), legendH = 120 * s, top = p.title ? 70 * s : 0, H = hexLayout(p.tiles, [X, Y + top, Wb, Hb - top - legendH]);
  const vals = H.tiles.map((t) => num(t.value, NaN)), edges = binsOf(vals, num(p.bins, 5)), nb = edges.length, binOf = (v) => { let b = 0; for (let i = 0; i < nb; i++) if (v >= edges[i]) b = i; return b; };
  const colOf = (v) => (Number.isFinite(v) ? mixHex(p.ramp[0], p.ramp[1], nb > 1 ? binOf(v) / (nb - 1) : 1) : p.missing), hl = new Set([].concat(p.highlight || []));
  let g = p.title ? text(p.title, X, Y + 44 * s, { size: 44 * s, weight: 800, fill: p.ink }) : '';
  H.tiles.forEach((t, i) => { const st = (t.r * 0.5 + t.q * 0.25 + 1.5) * num(p.stagger, 0.12), e = E.hero(seg(u, st, st + 0.45)); if (e <= 0) return;
    const r = H.size * 0.94 * (0.82 + 0.18 * e), pts = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 180) * (60 * k - 30); return `${f2(t.cx + r * Math.cos(a))},${f2(t.cy + r * Math.sin(a))}`; }).join(' ');
    const v = vals[i], fill = colOf(v), ink = inkOn(fill, PAPER_INK, '#FFFFFF');
    g += `<polygon points="${pts}" fill="${fill}" opacity="${f2(e)}" stroke="${hl.has(t.id) ? p.accent : p.paper}" stroke-width="${f2((hl.has(t.id) ? 6 : 3) * s)}"/>`;
    if (!Number.isFinite(v)) g += `<path d="M${f2(t.cx - r * 0.4)} ${f2(t.cy - r * 0.4)} L${f2(t.cx + r * 0.4)} ${f2(t.cy + r * 0.4)}" stroke="${PAPER_INK}" stroke-opacity="0.35" stroke-width="${f2(3 * s)}"/>`;
    const fz = Math.min(30 * s, H.size * 0.34); g += text(String(t.short ?? t.label ?? ''), t.cx, t.cy - fz * 0.15, { size: fz, weight: 800, fill: ink, anchor: 'middle', op: e });
    g += text(Number.isFinite(v) ? fmtNumber(v, { locale: p.locale, dec: p.dec, compact: Math.abs(v) >= 1e4 ? 'short' : false, unit: p.unit }) : 'no data', t.cx, t.cy + fz * 0.95, { size: fz * 0.8, weight: 600, fill: ink, anchor: 'middle', op: e * 0.9 }); });
  /* legend: one swatch per bin, the lower bound printed (with the unit) */
  const ly = Y + Hb - legendH + 40 * s, sw = Math.min(140 * s, (Wb * 0.7) / Math.max(1, nb)), lo = E.soft(seg(u, 0.3, 0.8));
  g += `<g opacity="${f2(lo)}">` + text(p.legendTitle || p.unit || 'Value', X, ly - 8 * s, { size: 24 * s, weight: 700, fill: p.ink, op: 0.8 });
  edges.forEach((ev, i) => { g += `<rect x="${f2(X + i * sw)}" y="${f2(ly + 4 * s)}" width="${f2(sw - 2 * s)}" height="${f2(22 * s)}" fill="${mixHex(p.ramp[0], p.ramp[1], nb > 1 ? i / (nb - 1) : 1)}"/>` + text('≥ ' + fmtAxis(ev, { locale: p.locale, dec: p.dec }), X + i * sw, ly + 56 * s, { size: 22 * s, weight: 600, fill: p.ink, op: 0.75 }); });
  if (vals.some((v) => !Number.isFinite(v))) g += `<rect x="${f2(X + nb * sw + 20 * s)}" y="${f2(ly + 4 * s)}" width="${f2(22 * s)}" height="${f2(22 * s)}" fill="${p.missing}"/>` + text('no data', X + nb * sw + 50 * s, ly + 22 * s, { size: 22 * s, weight: 600, fill: p.ink, op: 0.75 });
  g += '</g>' + footerSVG(p, c, X, footY(c, Y + Hb + 30 * s), Wb, 1);
  return `<g opacity="${f2((1 - L.out) * Math.max(0.0001, E.soft(L.in)))}">${g}</g>`;
}

/* ---------- counter.hero ---------- */
function heroSVG(L, p, c) {
  const S = c.safe, s = c.s, u = L.u, k = E.enter(seg(u, 0, num(p.count, 1.4))), v = lerp(num(p.from), num(p.value), k), o = 1 - L.out;
  const str = fmtNumber(v, { locale: p.locale, dec: p.dec, compact: p.compact, prefix: p.prefix, unit: p.unit }), final = fmtNumber(num(p.value), { locale: p.locale, dec: p.dec, compact: p.compact, prefix: p.prefix, unit: p.unit });
  let sz = num(p.size, 200) * s; const room = (S.x1 - S.x0) * 0.92; if (measure(final, sz, { weight: 800 }) > room) sz = sz * room / measure(final, sz, { weight: 800 });
  const cy = p.pos === 't' ? S.y0 + sz : (S.y0 + S.y1) / 2 + sz * 0.25, cx = (S.x0 + S.x1) / 2;
  let g = text(str, cx, cy, { size: sz, weight: 800, fill: p.ink, anchor: 'middle', ls: -sz * 0.02 });
  const lw = measure(final, sz, { weight: 800 }) * E.hero(seg(u, num(p.count, 1.4) - 0.1, num(p.count, 1.4) + 0.4));
  g += `<rect x="${f2(cx - lw / 2)}" y="${f2(cy + sz * 0.16)}" width="${f2(lw)}" height="${f2(Math.max(6 * s, sz * 0.05))}" rx="${f2(4 * s)}" fill="${p.accent}"/>`;
  if (p.label) g += text(p.label, cx, cy + sz * 0.16 + 70 * s, { size: 40 * s, weight: 700, fill: p.ink, anchor: 'middle', op: E.soft(seg(u, 0.3, 0.8)) });
  const fw = Math.min(room, 1400 * s); g += footerSVG(p, c, cx - fw / 2, footY(c, cy + sz * 0.16 + 150 * s), fw, 1);
  return `<g opacity="${f2(o * Math.max(0.0001, E.soft(L.in)))}">${g}</g>`;
}

export const EXPLAIN_DATA = {
  'chart.story': { file: 'type/gfx/explain-data.js', tags: ['chart', 'data-story', 'bar', 'line', 'area', 'scatter', 'honest-axes', 'explainer', 'data-journalism'], dur: 6, inF: 9, outF: 9, d: STORY_D, svg: storySVG },
  'callout.datum': { file: 'type/gfx/explain-data.js', tags: ['callout', 'annotation', 'leader', 'datum', 'chart', 'data-story'], dur: 2.6, inF: 6, outF: 8,
    d: { chart: null, datum: [0, 0], point: [0.62, 0.4], label: 'Placeholder note', sub: '', dx: 0.1, dy: -0.12, accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', size: 1 }, svg: datumSVG },
  'map.hexTile': { file: 'type/gfx/explain-data.js', tags: ['map', 'choropleth', 'hex-tile', 'data-story', 'region', 'explainer'], dur: 5, inF: 9, outF: 9,
    d: { tiles: DEMO_TILES, title: '', unit: '', legendTitle: '', locale: 'intl', dec: 0, bins: 5, ramp: ['#E8E1F9', '#3A12B8'], missing: '#E4E0D8', highlight: [], box: [0.2, 0.14, 0.6, 0.72], accent: '#E8590C', ink: PAPER_INK, paper: '#FFFFFF', stagger: 0.12, source: PLACEHOLDER, method: '', demo: true, size: 1 }, svg: hexSVG },
  'counter.hero': { file: 'type/gfx/explain-data.js', tags: ['counter', 'hero-number', 'stat', 'data-story', 'lakh', 'crore', 'locale'], dur: 3.5, inF: 6, outF: 9,
    d: { value: 12500000, from: 0, locale: 'in', compact: 'long', dec: 1, prefix: '', unit: '', label: 'Placeholder context line', pos: 'c', size: 220, count: 1.4, accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', source: PLACEHOLDER, method: '', demo: true }, svg: heroSVG },
  'chart.sourceFooter': { file: 'type/gfx/explain-data.js', tags: ['source', 'footer', 'honesty', 'data-story', 'chart'], dur: 4, inF: 6, outF: 6,
    d: { source: PLACEHOLDER, method: '', demo: true, box: [0.06, 0.9, 0.88, 0.05], ink: PAPER_INK, paper: '#FFFFFF', size: 1 },
    svg: (L, p, c) => { const [X, Y, Wb] = bx(p.box, c); return footerSVG(p, c, Math.max(c.safe.x0, X), footY(c, Y + 30 * c.s), Wb, L.k); } },
};
export const EXPLAIN_DATA_CUES = {
  'chart.story': (p) => { const out = [{ t: 0, id: 'sfx/ui/count_run', why: 'chart builds' }]; for (const q of [].concat(p.hl || [])) if (Array.isArray(q)) out.push({ t: num(q[0]), id: 'sfx/ui/tick', why: 'highlight moves' });
    for (const q of [].concat(p.show || [])) if (Array.isArray(q) && num(q[0]) > 0) out.push({ t: num(q[0]), id: 'sfx/ui/slide', why: 'more data revealed' }); return out; },
  'callout.datum': () => [{ t: 1 / 30, id: 'sfx/ui/pop', why: 'datum ring' }],
  'map.hexTile': (p) => [{ t: 0.1, id: 'sfx/sparkle/shimmer', why: 'tiles fill' }],
  'counter.hero': (p) => [{ t: 0, id: 'sfx/ui/count_run', why: 'number counts' }, { t: num(p.count, 1.4), id: 'sfx/hit/soft', why: 'number lands' }],
  'chart.sourceFooter': () => [],
};
