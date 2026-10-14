/* motion-pack / type / gfx / r6.js: round 6 parts from two public launch films (2026-10-15). Same gfx contract as every part (core.js): { tags, dur, inF, outF, d, svg(L, p, c) }
   -> SVG markup, a pure function of t (seek-safe: no module-level state, no caches; any frame renders the same in any seek order and in any process).
   Craft learned (techniques only): NO third-party brand, product, OS look-alike, logo, mascot or wording; original geometry, owned placeholder icons and
   placeholder names ("Service A", "App A") only.
     chart.hoverTooltip     a cursor glides along a bar / line chart; the hovered bar lifts (or a marker scrubs the line); a tooltip chip follows (closed-form springs) with
                            label, value and an up / down delta pill. Reads the geometry of chart.bar, chart.line or ui.dataTable's bars (same params), so it can sit over
                            the real chart or draw it. HONESTY: every number the chip prints carries its `source` (required; blank = a red "needs a source" card) and its
                            `method` in the chip itself, and the default data says "illustrative data" in frame.
     ui.dockLaunch          a generic bottom dock of placeholder icons; the icons magnify with a cosine falloff as the cursor nears; a click expands the icon into an app window
                            (shared element: the window grows out of the icon's own rect) and the dock fades. Frame label: "illustrative".
     title.verbCard         chapter cards for a feature tour: one giant word settles by scale + move into a smaller line that completes the phrase; N chapters with a
                            gradient sweep between; text fitted to the safe rect (16:9, 9:16, 1:1).
     ui.connectRows         rows of placeholder services, each with a Connect button the cursor clicks; the button flips to Connected with a tick; rows stack with a small
                            shift; optional Thinking line under them.
     layout.degradingDiagram  N boxes with original face glyphs and connectors whose state worsens per caption beat (calm, worried, cracked, broken) then recovers into tidy
                            arrangements (ticks and crosses, 4 and 6 boxes); captions swap by a blur-through. Per-beat state is data; every move is a closed-form spring.
     type.commandPill       an outlined pill that draws on around monospace text typed with a cursor; the width follows the typed text (owned face: IBM Plex Mono).
   Guards (every numeric param): NaN / non-numbers fall back to the default, out-of-range numbers clamp, lists are capped (rows 12, bars 48, beats 24, chapters 12, text 120 chars),
   so no param can hang a render or allocate an unbounded array. Colours are accepted only as #hex tokens (anything else falls back). SVG ids are unique per item
   (hash of the params + the item's start + its index in the host + the frame size), so two instances in one host never share a clipPath / gradient / filter id. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, f2, text, measure, esc, hashf, blurDef, blurAttr, life } from './core.js';
import { springTrack, spring, sstep } from '../ease.js';
import { KIT, rr, TICKS, POPS } from './ui.js';
import { mixHex } from './swap.js';
import { SOCIAL } from './social.js';
import { PROOF, fmtUnit, noSrc } from './ui-proof.js';
const { th, GREEN, rect, cursorSvg, pressAt, ripple, ICON, icon } = KIT;
const RED = '#E5484D';

/* ---------- guards + small shared helpers ---------- */
export const num = (v, d, lo = -1e9, hi = 1e9) => { const x = v == null || v === '' || typeof v === 'boolean' ? NaN : +v; return Number.isFinite(x) ? clamp(x, lo, hi) : d; };
export const str = (v, d = '', max = 120) => (v == null ? d : String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max));
export const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);   // never o['__proto__'] / o['constructor']
const hexOk = (v, d) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? (v.length === 4 ? '#' + [...v.slice(1)].map((x) => x + x).join('') : v) : d);
const box4 = (v, d) => { const b = Array.isArray(v) && v.length >= 4 ? v.slice(0, 4).map((x, i) => num(x, d[i], -2, 3)) : d.slice(); b[2] = Math.max(0.05, b[2]); b[3] = Math.max(0.05, b[3]); return b; };
const sc = (c) => (c.H > c.W ? c.W / 1080 : c.s);   // type scale from the SHORTER frame side
/* a bounded structural signature of the params (strings: length + first 48 chars; lists: length + first 24 entries; objects: first 40 keys), so hashing never walks a hostile 100,000-entry param */
const sigOf = (v, d = 0) => { if (v == null) return 'n'; const t = typeof v; if (t === 'number') return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'x'; if (t === 'string') return v.length + ':' + v.slice(0, 48); if (t === 'boolean') return v ? 'T' : 'F'; if (d > 4) return '~';
  if (Array.isArray(v)) return '[' + v.length + ':' + v.slice(0, 24).map((q) => sigOf(q, d + 1)).join(',') + ']'; if (t === 'object') return '{' + Object.keys(v).slice(0, 40).sort().map((q) => q + '=' + sigOf(v[q], d + 1)).join(',') + '}'; return '?'; };
export const rid = (name, L, p, c) => { const s = [name, L.at, c.item ?? 0, c.W, c.H, sigOf(p)].join('|'); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return name + h.toString(36); };
const fadeIO = (L) => clamp(L.in * 1.5) * (1 - L.out);
const refuse = (c, x, y, w, msg) => { const s = sc(c), h = 120 * s; return rect(x, y, w, h, 18 * s, '#FFFFFF', `stroke="${RED}" stroke-width="${f2(3 * s)}"`) +
  text('needs a source', x + 28 * s, y + 48 * s, { size: 28 * s, weight: 800, fill: RED }) + text(msg, x + 28 * s, y + 88 * s, { size: 20 * s, weight: 600, fill: '#16151B' }); };
/* cursor path: keys [[t, x, y], ...] (frame fractions, local seconds); each segment eased with E.soft, held before the first and after the last key */
export function pathAt(keys, u) { if (u <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const k = E.soft(seg(u, keys[i - 1][0], keys[i][0])); return [lerp(keys[i - 1][1], keys[i][1], k), lerp(keys[i - 1][2], keys[i][2], k)]; } return [keys.at(-1)[1], keys.at(-1)[2]]; }
const cleanPath = (v) => { const k = list(v, 256).filter((q) => Array.isArray(q) && q.length >= 3 && [q[0], q[1], q[2]].every((x) => Number.isFinite(+x) && x !== null && x !== '' && typeof x !== 'boolean')).map((q) => [clamp(+q[0], 0, 1e4), clamp(+q[1], -2, 3), clamp(+q[2], -2, 3)]).sort((a, b) => a[0] - b[0]); return k.length ? k : null; };
const nearest = (slots, x) => { let bi = 0, bd = Infinity; for (let i = 0; i < slots.length; i++) { const d = Math.abs(slots[i].cx - x); if (d < bd) { bd = d; bi = i; } } return bi; };
const MAXN = 48;

/* ====================================================================== 1. chart.hoverTooltip ====================================================================== */
const HOVER_DATA = { bar: { labels: ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6', 'Slot 7'], values: [14, 22, 18, 41, 33, 26, 38], highlight: -1 }, line: { values: [14, 22, 18, 41, 33, 26, 38, 52], label: 'Illustrative series' } };   // placeholder numbers, labelled in frame
const HOVER_D = { target: 'bar', draw: true, chart: {}, fmt: null, dec: 0, suffix: null, source: 'illustrative data', method: 'delta: change from the previous slot', path: null, startAt: 1.3, visit: [1, 3, 2], travel: 0.65, dwell: 0.5,
  lift: 12, hot: null, theme: 'light', up: GREEN, down: RED, cursor: true, scale: 1 };
export function hoverP(raw = {}) {
  const p = { ...HOVER_D, ...raw }; if (!['bar', 'line', 'table'].includes(p.target)) p.target = 'bar'; p.chart = p.chart && typeof p.chart === 'object' ? p.chart : {};
  p.dec = Math.round(num(p.dec, 0, 0, 6)); p.lift = num(p.lift, 12, 0, 80); p.scale = num(p.scale, 1, 0.3, 4); p.startAt = num(p.startAt, 1.3, 0, 60); p.travel = num(p.travel, 0.65, 0.05, 10); p.dwell = num(p.dwell, 0.5, 0, 10);
  p.visit = list(p.visit, 24).map((v) => Math.round(num(v, 0, 0, 1e4))); p.source = str(p.source, '', 80); p.method = str(p.method, '', 80); p.fmt = p.fmt == null ? null : str(p.fmt, '', 4); p.suffix = p.suffix == null ? null : str(p.suffix, '', 8);
  p.up = hexOk(p.up, GREEN); p.down = hexOk(p.down, RED); p.hot = p.hot == null ? null : hexOk(p.hot, null); p.theme = p.theme === 'dark' ? 'dark' : 'light'; p.draw = p.draw !== false; p.cursor = p.cursor !== false; p.path = p.path == null ? null : cleanPath(p.path); return p;
}
/* geometry of the hovered chart in output px: the SAME formulas as chart.bar / chart.line (social.js), and ui.dataTable's own bar rects (read from the part through the c.geo side channel) */
export function hoverGeo(p, c) {
  const s = c.s; let slots = [], box = [0, 0, 1, 1], child = null, sufx = '';
  const fv = (v, fmt, dec, suf) => fmtUnit(v, fmt, dec) + suf;
  if (p.target === 'bar') {
    const D = { ...SOCIAL['chart.bar'].d, ...HOVER_DATA.bar }, ch = { ...D, ...p.chart }; let vals = list(ch.values, MAXN).map((v) => num(v, 0, 0, 1e12)); if (!vals.length) vals = D.values.slice();
    const labels = vals.map((_, i) => str(Array.isArray(ch.labels) ? ch.labels[i] : null, 'Slot ' + (i + 1), 40)), b = box4(ch.box, D.box), x = b[0] * c.W, y = b[1] * c.H, w = b[2] * c.W, h = b[3] * c.H, n = vals.length;
    const vv = vals.map((v) => Math.max(v, 1e-9)), mx = Math.max(...vv), bw = w / n * 0.62, bh = Math.max(0, h - 70 * s), unit = str(ch.unit, '', 8); sufx = p.suffix ?? unit;
    slots = vals.map((v, i) => ({ cx: x + (i + 0.5) * w / n, x0: x + (i + 0.5) * w / n - bw / 2, w: bw, top: y + h - bh * vv[i] / mx, base: y + h, value: v, label: labels[i], str: fv(v, p.fmt ?? '', p.dec, sufx) }));
    box = [x, y, w, h]; child = { id: 'chart.bar', params: { ...ch, values: vv, labels, box: b, unit, source: p.source, highlight: ch.highlight } };
  } else if (p.target === 'line') {
    const D = { ...SOCIAL['chart.line'].d, ...HOVER_DATA.line }, ch = { ...D, ...p.chart }; let vals = list(ch.values, MAXN).map((v) => num(v, 0, 0, 1e12)); if (!vals.length) vals = D.values.slice(); while (vals.length < 2) vals.push(vals[0]);
    const labels = vals.map((_, i) => str(Array.isArray(ch.labels) ? ch.labels[i] : null, 'Slot ' + (i + 1), 40)), b = box4(ch.box, D.box), x = b[0] * c.W, y = b[1] * c.H, w = b[2] * c.W, h = b[3] * c.H, n = vals.length;
    const vv = vals.map((v) => Math.max(v, 1e-9)), mx = Math.max(...vv) * 1.1; sufx = p.suffix ?? '';
    slots = vals.map((v, i) => ({ cx: x + w * i / (n - 1), x0: x + w * i / (n - 1) - 4, w: 8, top: y + h - h * vv[i] / mx, base: y + h, value: v, label: labels[i], str: fv(v, p.fmt ?? '', p.dec, sufx) }));
    box = [x, y, w, h]; child = { id: 'chart.line', params: { ...ch, values: vv, box: b, label: str(ch.label, '', 60), source: p.source } };
  } else {
    const g = PROOF['ui.dataTable'], D = g.d, ch = p.chart, rows = list(ch.rows ?? D.rows, 24).map((r) => ({ ...r, label: str(r?.label, '', 40), unit: str(r?.unit, '', 4), values: list(r?.values, 12).map((v) => num(v, 0, -1e12, 1e12)) }));
    const columns = list(ch.columns ?? D.columns, 13).map((q) => ({ ...q, label: str(q?.label, '', 24) })), q = { ...D, ...ch, rows: rows.length ? rows : D.rows, columns: columns.length >= 2 ? columns : D.columns, bars: { row: 0, ...(ch.bars && typeof ch.bars === 'object' ? ch.bars : {}) } };
    q.bars.row = Math.round(num(q.bars.row, 0, 0, q.rows.length - 1)); q.rows = q.rows.map((r) => { const need = q.columns.length - 1; const v = r.values.slice(0, need); while (v.length < need) v.push(0); return { ...r, values: v }; });
    const geo = {}; g.svg({ u: 99, in: 1, out: 0, on: true, k: 1, hold: 99, t: 99, at: 0 }, q, { ...c, geo }); const row = q.rows[q.bars.row];
    slots = (geo.bars || []).map((r, i) => ({ cx: r.x + r.w / 2, x0: r.x, w: r.w, top: r.top, base: r.base, value: r.value, label: r.label, str: fmtUnit(r.value, r.unit ?? row?.unit, r.dec ?? row?.dec) }));
    if (slots.length) { const a = slots[0], z = slots.at(-1); box = [a.x0 - 0.03 * c.W, Math.min(...slots.map((q2) => q2.top)) - 20 * s, z.x0 + z.w - a.x0 + 0.06 * c.W, Math.max(...slots.map((q2) => q2.base)) - Math.min(...slots.map((q2) => q2.top)) + 60 * s]; }
  }
  return { kind: p.target, slots, box, child };
}
export const hoverPath = (p, c, M) => {
  if (p.path) return p.path; const n = M.slots.length, last = M.slots[n - 1], k = sc(c), pos = (i) => { const q = M.slots[clamp(i, 0, n - 1)]; return [q.cx, M.kind === 'line' ? q.top + 30 * k : q.top + Math.min(44 * k, 0.4 * (q.base - q.top))]; };
  const sx = Math.min(0.985 * c.W, last.cx + 0.14 * c.W), sy = Math.min(0.97 * c.H, last.base + 0.16 * c.H), keys = [[p.startAt, sx / c.W, sy / c.H]]; let t = p.startAt;
  p.visit.forEach((i, j) => { t += j ? p.travel * 0.8 : p.travel * 1.4; const [x, y] = pos(i); keys.push([t, x / c.W, y / c.H]); t += p.dwell; keys.push([t, x / c.W, y / c.H]); }); return keys;
};
/* how much the cursor is "over" the chart: 1 inside the (padded) plot box, 0 beyond 56 px, smooth between */
const overAmt = (M, x, y, k) => { const [bx0, by0, bw, bh] = M.box, dx = Math.max(0, bx0 - 0.02 * bw - x, x - (bx0 + bw * 1.02)), dy = Math.max(0, by0 - 80 * k - y, y - (by0 + bh + 70 * k)); return 1 - sstep(8 * k, 56 * k, Math.hypot(dx, dy)); };
/* the slot nearest the cursor, sampled at 60 Hz along the path while the cursor is over the chart: where the chip must glide to (a retarget keeps the spring running) */
export function hoverScan(p, c, M, keys) {
  const T0 = keys[0][0], T1 = Math.min(keys.at(-1)[0], T0 + 60), k = c.s, changes = []; let cur = -1, first = null, i0 = 0;
  for (let t = T0; t <= T1 + 1e-9; t += 1 / 60) { const [fx, fy] = pathAt(keys, t); if (overAmt(M, fx * c.W, fy * c.H, k) < 0.5) continue; const i = nearest(M.slots, fx * c.W);
    if (cur < 0) { cur = i; i0 = i; first = +t.toFixed(4); } else if (i !== cur) { changes.push({ t: +t.toFixed(4), i }); cur = i; } }
  return { first, i0, changes };
}
const fmtDelta = (d) => (d === null ? '' : `${d > 0.5 ? '+' : d < -0.5 ? '−' : ''}${Math.min(999, Math.abs(Math.round(d)))}%`);
const deltaOf = (slots, i) => (i > 0 && slots[i - 1].value !== 0 ? (slots[i].value - slots[i - 1].value) / Math.abs(slots[i - 1].value) * 100 : null);

/* ====================================================================== 2. ui.dockLaunch ====================================================================== */
const DOCK_PAL = ['#7A5CFF', '#E8553D', '#1FA37A', '#E0A21B', '#2F7DE1', '#C94F9B', '#3AA7B8', '#8A6A4B', '#5E6AD2', '#D9663B', '#4C9F3F', '#B14AD9'];
const DOCK_ICONS = ['chart', 'mail', 'doc', 'spark', 'play', 'box'];
const DOCK_D = { icons: DOCK_ICONS.map((ic, i) => ({ name: 'App ' + 'ABCDEF'[i], icon: ic, color: DOCK_PAL[i] })), target: 3, clickAt: 3.2, expandDur: 0.6, path: null, size: 84, magnify: 1.85, radius: 2.3, window: [0.1, 0.1, 0.8, 0.62],
  theme: 'dark', cursor: true, label: 'illustrative: placeholder icons and window', scale: 1 };
export function dockP(raw = {}) {
  const p = { ...DOCK_D, ...raw }; p.icons = list(raw.icons ?? DOCK_D.icons, 12).map((q, i) => ({ name: str(q?.name, 'App ' + (i + 1), 24), icon: own(ICON, q?.icon) ? q.icon : DOCK_ICONS[i % 6], color: hexOk(q?.color, DOCK_PAL[i % 12]) }));
  if (!p.icons.length) p.icons = DOCK_D.icons.slice(0, 1); p.target = Math.round(num(p.target, 3, 0, p.icons.length - 1)); p.clickAt = num(p.clickAt, 3.2, 0.3, 120); p.expandDur = num(p.expandDur, 0.6, 0.1, 5);
  p.size = num(p.size, 84, 24, 300); p.magnify = num(p.magnify, 1.85, 1, 3); p.radius = num(p.radius, 2.3, 0.8, 5); p.scale = num(p.scale, 1, 0.3, 4); p.window = box4(p.window, DOCK_D.window); p.path = p.path == null ? null : cleanPath(p.path);
  p.theme = p.theme === 'light' ? 'light' : 'dark'; p.cursor = p.cursor !== false; p.label = str(p.label, '', 80); return p;
}
const bump = (d) => (d < 1 ? 0.5 * (1 + Math.cos(Math.PI * d)) : 0);   // cosine falloff: 1 at the cursor, 0 at one radius
/* the dock layout: dockGeo(p, c).at(cursorX, near) -> icons (x, y, w, f = magnification weight 0..1) and the panel. Sizes fit the safe rect for EVERY cursor position. */
export function dockGeo(p, c) {
  const S = c.safe, s = sc(c) * p.scale, n = p.icons.length, M = p.magnify, R = p.radius, gapU = 0.2, padU = 0.34, pitch = 1 + gapU, cx0 = (S.x0 + S.x1) / 2;
  const wU = (cu, near) => Array.from({ length: n }, (_, j) => 1 + (M - 1) * near * bump(Math.abs(cu - (j * pitch + 0.5)) / R)), tot = (ws) => ws.reduce((a, b) => a + b, 0) + (n - 1) * gapU;
  let umax = 0; for (let cu = -R - 1; cu <= n * pitch + R + 1; cu += 0.2) umax = Math.max(umax, tot(wU(cu, 1))); umax += 2 * padU;
  const base = Math.max(8, Math.min(p.size * s, S.w * 0.96 / umax)), restW = n * pitch - gapU, left0 = cx0 - restW * base / 2, bottom = S.y1 - 10 * s, panelH = base * (1 + 2 * padU);
  return { base, s, bottom, panelTop: bottom - panelH, panelH, cx0,
    at(cursorX, near = 1) { const cu = (cursorX - left0) / base, ws = wU(cu, near), total = tot(ws), left = cx0 / base - total / 2; let acc = left; const yb = bottom - padU * base;
      const icons = ws.map((w, j) => { const q = { x: acc * base, y: yb - w * base, w: w * base, f: (w - 1) / Math.max(1e-9, M - 1) }; acc += w + gapU; return q; });
      return { icons, panel: { x: (left - padU) * base, y: bottom - panelH, w: (total + 2 * padU) * base, h: panelH } }; },
    near(cy) { return 1 - sstep(24 * s, 150 * s, this.panelTop - cy); } };
}
export function dockPath(p, c, G) {
  if (p.path) return p.path; const t = p.target, cxOf = (x) => { const r = G.at(x, 1).icons[t]; return r.x + r.w / 2; }; let x = G.at(G.cx0, 1).icons[t].x + G.at(G.cx0, 1).icons[t].w / 2;
  for (let i = 0; i < 24; i++) x = 0.5 * x + 0.5 * cxOf(x);   // fixed point: the cursor lands on the MAGNIFIED target icon
  const y = G.bottom - 0.34 * G.base - 0.55 * G.base, first = G.at(G.cx0, 0).icons[0], S = c.safe, Q = p.clickAt, t1 = Math.max(0.9, Q * 0.45), t2 = Math.max(t1 + 0.4, Q - 0.12);
  return [[0.15, clamp((S.x1 - 0.06 * c.W) / c.W, 0, 1), clamp((S.y0 + 0.22 * c.H) / c.H, 0, 1)], [t1, (first.x + first.w * 0.2) / c.W, y / c.H], [t2, x / c.W, y / c.H]];
}
/* the icons the cursor passes: nearest icon (while near the dock), sampled at 60 Hz: ticks for the plan */
export function dockEnters(p, c, G, keys) { const out = []; let cur = -1; for (let t = keys[0][0]; t <= Math.min(p.clickAt, keys[0][0] + 60); t += 1 / 60) { const [fx, fy] = pathAt(keys, t), near = G.near(fy * c.H); if (near < 0.5) continue;
  const ic = G.at(fx * c.W, near).icons; let bi = 0, bd = Infinity; ic.forEach((q, j) => { const d = Math.abs(q.x + q.w / 2 - fx * c.W); if (d < bd) { bd = d; bi = j; } }); if (bi !== cur) { out.push({ t: +t.toFixed(4), i: bi }); cur = bi; } } return out; }

/* ====================================================================== 3. title.verbCard ====================================================================== */
const VERB_D = { words: [{ big: 'Plan', rest: 'the whole week' }, { big: 'Make', rest: 'it look real' }, { big: 'Send', rest: 'it to everyone' }], ground: '#07060B', ink: '#FFFFFF', colors: ['#6F4BFF', '#FF4FA3', '#3E7BFF'],
  chapterDur: 2.4, settleAt: 0.95, settleDur: 0.7, sweepDur: 0.8, bigSize: 420, lineSize: 84, weight: 800, glow: true, scale: 1 };
export function verbP(raw = {}) {
  const p = { ...VERB_D, ...raw }; p.words = list(raw.words ?? VERB_D.words, 12).map((w) => ({ big: str(w?.big, 'Word', 24).replace(/\s+/g, ' '), rest: str(w?.rest, '', 60) })); if (!p.words.length) p.words = VERB_D.words.slice(0, 1);
  p.chapterDur = num(p.chapterDur, 2.4, 0.8, 30); p.settleAt = num(p.settleAt, 0.95, 0.2, p.chapterDur - 0.4); p.settleDur = num(p.settleDur, 0.7, 0.1, 5); p.sweepDur = num(p.sweepDur, 0.8, 0.1, 5); p.bigSize = num(p.bigSize, 420, 40, 1200); p.lineSize = num(p.lineSize, 84, 16, 400);
  p.weight = Math.round(num(p.weight, 800, 200, 800)); p.scale = num(p.scale, 1, 0.3, 4); p.ground = p.ground == null ? null : hexOk(p.ground, VERB_D.ground); p.ink = hexOk(p.ink, '#FFFFFF'); p.glow = p.glow !== false;
  p.colors = list(p.colors, 6).map((q, i) => hexOk(q, VERB_D.colors[i % 3])); if (p.colors.length < 2) p.colors = VERB_D.colors.slice(); return p;
}
export const verbTimes = (p) => ({ start: (i) => i * p.chapterDur, settle: (i) => i * p.chapterDur + p.settleAt, sweep: (i) => i * p.chapterDur - p.sweepDur * 0.6, total: p.words.length * p.chapterDur });
/* one chapter: the giant word fitted to the safe rect, the completed line (wrapped when it is wider than the safe width), and the two poses of the big word */
export function verbLayout(w, p, c) {
  const S = c.safe, s = sc(c) * p.scale, fitW = S.w * 0.94, wt = p.weight, cx = (S.x0 + S.x1) / 2, cy = (S.y0 + S.y1) / 2, m1 = (str1, size) => measure(str1, size, { weight: wt });
  const bigSize = Math.max(8, Math.min(p.bigSize * s, fitW / (m1(w.big, 100) / 100), S.h * 0.5)), tokens = [w.big, ...w.rest.split(/\s+/).filter(Boolean)];
  let lineSize = Math.min(p.lineSize * s, bigSize * 0.5), lines = [];
  for (let tries = 0; tries < 40; tries++) { lines = []; let cur = []; for (const t of tokens) { if (cur.length && m1([...cur, t].join(' '), lineSize) > fitW) { lines.push(cur); cur = [t]; } else cur.push(t); } if (cur.length) lines.push(cur);
    if (lines.length <= 3 && lines.every((l) => m1(l.join(' '), lineSize) <= fitW * 1.001)) break; lineSize *= 0.9; }
  const lh = lineSize * 1.2, blockH = lines.length * lh, top = cy - blockH / 2, ls = lines.map((l, k) => { const str1 = l.join(' '), wd = m1(str1, lineSize); return { str: str1, w: wd, x: cx - wd / 2, y: top + (k + 0.8) * lh, rest: k === 0 ? l.slice(1).join(' ') : null }; });
  const wBig = m1(w.big, bigSize), l0 = ls[0];
  return { bigSize, lineSize, lines: ls, cx, cy, big0: { x: cx - wBig / 2, y: cy + bigSize * 0.34 }, big1: { x: l0.x, y: l0.y }, wBig, restX: l0.x + m1(w.big + ' ', lineSize), k: lineSize / bigSize };
}

/* ====================================================================== 4. ui.connectRows ====================================================================== */
const CONN_PAL = ['#4F6BFF', '#16A37F', '#E8742C', '#B14AD9', '#2F9BD8', '#D9486B'];
const CONN_D = { rows: [{ name: 'Service A', icon: 'chart', color: CONN_PAL[0] }, { name: 'Service B', icon: 'mail', color: CONN_PAL[1] }, { name: 'Service C', icon: 'box', color: CONN_PAL[2] }], rowsAt: 0.25, clickAt: 1.5, clickGap: 1.5,
  reveal: 'sequence', thinking: 'Thinking', thinkAt: null, theme: 'dark', accent: '#5B6BFF', connect: 'Connect', done: 'Connected', note: 'illustrative: placeholder services', cursor: true, scale: 1 };
export function connP(raw = {}) {
  const p = { ...CONN_D, ...raw }; p.rows = list(raw.rows ?? CONN_D.rows, 12).map((r, i) => ({ name: str(r?.name, 'Service ' + (i + 1), 28), icon: own(ICON, r?.icon) ? r.icon : ['chart', 'mail', 'box', 'user', 'db', 'send'][i % 6], color: hexOk(r?.color, CONN_PAL[i % 6]) }));
  if (!p.rows.length) p.rows = CONN_D.rows.slice(0, 1); p.rowsAt = num(p.rowsAt, 0.25, 0, 120); p.clickAt = num(p.clickAt, 1.5, 0.2, 120); p.clickGap = num(p.clickGap, 1.5, 1, 30); p.reveal = p.reveal === 'together' ? 'together' : 'sequence';
  p.thinking = p.thinking == null || p.thinking === false ? null : str(p.thinking, 'Thinking', 40); p.thinkAt = p.thinkAt == null ? null : num(p.thinkAt, null, 0, 300); p.theme = p.theme === 'light' ? 'light' : 'dark'; p.accent = hexOk(p.accent, CONN_D.accent);
  p.connect = str(p.connect, 'Connect', 20); p.done = str(p.done, 'Connected', 20); p.note = str(p.note, '', 80); p.cursor = p.cursor !== false; p.scale = num(p.scale, 1, 0.3, 4); return p;
}
export function connTimes(p) { const n = p.rows.length, click = p.rows.map((_, i) => p.clickAt + i * p.clickGap), appear = p.rows.map((_, i) => (p.reveal === 'together' ? p.rowsAt + i * 0.12 : i ? click[i - 1] + 0.4 : p.rowsAt));
  return { click, appear, think: p.thinking ? p.thinkAt ?? click[n - 1] + 0.75 : null }; }
/* panel + rows at local time u: the panel is centred in the safe rect and grows as rows arrive (springs), so earlier rows shift up a little; each button's rect follows */
export function connLayout(p, c, u) {
  const S = c.safe, T = connTimes(p), n = p.rows.length, R0 = 84, G0 = 14, P0 = 22, K0 = 54, N0 = p.note ? 20 : 0, maxH0 = 2 * P0 + n * (R0 + G0) - G0 + (p.thinking ? K0 : 0) + N0;
  const q = Math.max(0.2, Math.min(sc(c) * p.scale, S.h * 0.94 / maxH0)), rh = R0 * q, gap = G0 * q, pad = P0 * q, thinkH = K0 * q, w = Math.min(S.w * 0.94, 760 * q);
  const v = springTrack(u, [{ t: 0, v: 0 }, ...T.appear.map((t, i) => ({ t, v: i + 1 }))], 'panel'), thinkK = p.thinking ? spring(u - T.think, 'panel') : 0, vv = Math.max(0, v);
  const H = 2 * pad + vv * (rh + gap) - gap * Math.min(1, vv) + thinkK * thinkH + (p.note ? 20 * q : 0), x = (S.x0 + S.x1) / 2 - w / 2, y = (S.y0 + S.y1) / 2 - H / 2, bh = 46 * q;
  const wC = measure(p.connect, 22 * q, { weight: 700 }) + 44 * q, wD = measure(p.done, 22 * q, { weight: 700 }) + 44 * q + 30 * q;
  const rows = p.rows.map((r, i) => { const ak = spring(u - T.appear[i], 'ui'), ck = E.hero(seg(u, T.click[i] + 0.04, T.click[i] + 0.34)), ry = y + pad + i * (rh + gap) + 20 * q * (1 - Math.min(1, ak)), bw = lerp(wC, wD, ck);
    return { x: x + pad, y: ry, w: w - 2 * pad, h: rh, ak, ck, btn: { x: x + w - pad - 14 * q - bw, y: ry + (rh - bh) / 2, w: bw, h: bh } }; });
  return { q, panel: { x, y, w, h: H }, rows, T, wC, wD, thinkK, thinkY: y + pad + vv * (rh + gap) - gap * Math.min(1, vv) + thinkH * 0.5 };
}
/* cursor: start off to the lower right, then toward each Connect button (tracked live, so it arrives on the button even while the panel is still moving) */
export function connCursor(p, c, u) {
  const T = connTimes(p), G0 = connLayout(p, c, T.click[0] - 1), S = c.safe, st = [G0.panel.x + G0.panel.w + 120 * G0.q, Math.min(S.y1, G0.panel.y + G0.panel.h + 200 * G0.q)], ctr = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  const at = (i, uu) => ctr(connLayout(p, c, uu).rows[i].btn); 
  for (let j = 0; j < T.click.length; j++) { const t0 = j ? T.click[j - 1] + 0.45 : T.click[0] - 0.9; if (u < T.click[j] + 1e-9 || j === T.click.length - 1) { const to = at(j, u), k = E.move(seg(u, t0, T.click[j])); const f = j ? at(j - 1, T.click[j - 1]) : st; return [lerp(f[0], to[0], k), lerp(f[1], to[1], k)]; } }
  return st;
}

/* ====================================================================== 5. layout.degradingDiagram ====================================================================== */
const MAXB = 8, BN = 13, LN = 3;
const DLAY = { pair: { pts: [[-1.1, 0], [1.1, 0]], sz: [1, 1], rot: [0, 0] }, trio: { pts: [[-1.9, 0.55], [0, -0.3], [1.9, 0.7]], sz: [1, 1.22, 0.94], rot: [-4, 0, 5] }, row3: { pts: [[-1.8, 0], [0, 0], [1.8, 0]], sz: [1, 1, 1], rot: [0, 0, 0] },
  row4: { pts: [[-2.7, 0], [-0.9, 0], [0.9, 0], [2.7, 0]], sz: [1, 1, 1, 1], rot: [0, 0, 0, 0] }, grid4: { pts: [[-1, -1], [1, -1], [1, 1], [-1, 1]], sz: [1, 1, 1, 1], rot: [0, 0, 0, 0] },
  grid6: { pts: [[-1.8, -1], [0, -1], [1.8, -1], [1.8, 1], [0, 1], [-1.8, 1]], sz: [1, 1, 1, 1, 1, 1], rot: [0, 0, 0, 0, 0, 0] }, row6: { pts: [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5].map((x) => [x, 0]), sz: [1, 1, 1, 1, 1, 1], rot: [0, 0, 0, 0, 0, 0] } };
/* face and damage per mood: [mouth (+ smile, - frown), brow (inner ends up), eyeX (dot -> cross), crack, split, face opacity] */
const MOODS = { calm: [0.45, 0, 0, 0, 0, 1], worried: [-0.35, 0.8, 0, 0, 0, 1], cracked: [-0.7, 1, 0.5, 0.7, 0, 1], broken: [-1, 1, 1, 1, 1, 1], tidy: [0.8, 0, 0, 0, 0, 0], blank: [0, 0, 0, 0, 0, 0] };
const LINKS = { none: [0, 0, 0, 0], line: [1, 0, 0, 0], loop: [1, 0.35, 0, 1], broken: [1, 0.2, 1, 1] };   // [chain op, bend, gap, return-arc op]
const DIAG_BEATS = [
  { at: 0, caption: 'Everything looks fine', layout: 'trio', mood: 'calm', links: 'line' }, { at: 1.8, caption: 'Steps start to repeat', layout: 'trio', mood: 'worried', links: 'loop' },
  { at: 3.6, caption: 'Cracks begin to spread', layout: 'trio', mood: 'cracked', links: 'loop' }, { at: 5.4, caption: 'Then it breaks', layout: 'trio', mood: 'broken', links: 'broken' },
  { at: 7.6, caption: 'One tidy layout', layout: 'row4', mood: 'tidy', links: 'line' }, { at: 9.4, caption: 'Every part checked', layout: 'row4', mood: 'tidy', links: 'line', marks: [1, 1, -1, 1] },
  { at: 11.2, caption: 'Room for more', layout: 'grid6', mood: 'tidy', links: 'line' }];
const DIAG_D = { beats: DIAG_BEATS, cls: 'panel', ink: '#EDEDF2', ok: '#4BE08F', bad: '#FF6B6B', captionSize: 64, maxUnit: 150, swap: 0.5, reduced: false, ret: [2, 0], scale: 1 };
export function diagP(raw = {}) {
  const p = { ...DIAG_D, ...raw }; let prev = { layout: 'trio', mood: 'calm', links: 'line', marks: [], caption: '' };
  const bs = list(raw.beats ?? DIAG_BEATS, 24).map((b, i) => { const o = { at: num(b?.at, i * 1.8, 0, 600), caption: b?.caption == null ? prev.caption : str(b.caption, '', 60), layout: own(DLAY, b?.layout) ? b.layout : prev.layout, mood: own(MOODS, b?.mood) ? b.mood : prev.mood,
    links: own(LINKS, b?.links) ? b.links : prev.links, marks: b?.marks === undefined ? (b?.layout && b.layout !== prev.layout ? [] : prev.marks) : list(b.marks, MAXB).map((m) => (+m > 0 ? 1 : +m < 0 ? -1 : 0)) }; prev = o; return o; }).sort((a, b) => a.at - b.at);
  p.beats = bs.length ? bs : DIAG_BEATS.map((b) => ({ marks: [], ...b })); p.beats[0] = { ...p.beats[0], at: 0 }; p.cls = ['ui', 'panel', 'camera'].includes(p.cls) ? p.cls : 'panel'; p.ink = hexOk(p.ink, '#EDEDF2'); p.ok = hexOk(p.ok, '#4BE08F'); p.bad = hexOk(p.bad, '#FF6B6B');
  p.captionSize = num(p.captionSize, 64, 12, 300); p.maxUnit = num(p.maxUnit, 150, 20, 600); p.swap = num(p.swap, 0.5, 0.05, 5); p.reduced = p.reduced === true; p.scale = num(p.scale, 1, 0.3, 4);
  p.ret = Array.isArray(p.ret) ? p.ret.slice(0, 2).map((v) => Math.round(num(v, 0, 0, MAXB - 1))) : [2, 0]; if (p.ret.length < 2) p.ret = [2, 0]; return p;
}
const beatVec = (b) => { const L = DLAY[b.layout], n = L.pts.length, m = MOODS[b.mood], v = []; const last = L.pts[n - 1];
  for (let k = 0; k < MAXB; k++) { const on = k < n, pt = on ? L.pts[k] : last, mk = b.marks[k] || 0;
    v.push(pt[0], pt[1], on ? L.sz[k] : L.sz[n - 1] * 0.4, on ? L.rot[k] : 0, on ? 1 : 0, ...(on ? m : MOODS.blank), mk > 0 ? 1 : 0, mk < 0 ? 1 : 0); }
  const lk = LINKS[b.links]; for (let j = 0; j < MAXB; j++) v.push(j < MAXB - 1 ? (j < n - 1 ? lk[0] : 0) : lk[3], j < MAXB - 1 ? lk[1] : 1, lk[2]); return v; };
export function diagGeo(p, c) {
  const S = c.safe, s = sc(c) * p.scale, cs = p.captionSize * s, capH = 2.2 * cs * 1.2 + 24 * s; let ex = 1, ey = 1, ret = false;
  for (const b of p.beats) { const L = DLAY[b.layout]; L.pts.forEach(([x, y], k) => { ex = Math.max(ex, Math.abs(x) + L.sz[k] * 0.6); ey = Math.max(ey, Math.abs(y) + L.sz[k] * 0.6); }); if (LINKS[b.links][3]) ret = true; }
  const A = { x: S.x0, y: S.y0, w: S.w, h: Math.max(40, S.h - capH) }, unit = Math.max(8, Math.min(A.w / (2 * ex + 0.3), A.h / (2 * ey + 0.3 + (ret ? 1.2 : 0)), p.maxUnit * s));
  return { unit, cx: A.x + A.w / 2, cy: A.y + A.h / 2 - (ret ? 0.45 * unit : 0), cs, capY: S.y1 - capH * 0.5, S, s };
}
/* the full diagram state at local time u: every number is a closed-form spring over the beat changes (springTrack), a pure function of u */
export function diagramState(p, c, u) {
  const G = diagGeo(p, c), v = springTrack(u, p.beats.map((b, i) => ({ t: i ? b.at : 0, v: beatVec(b) })), p.cls), boxes = [], links = [];
  for (let k = 0; k < MAXB; k++) { const o = k * BN, [x, y, sz, rot, op, mouth, brow, eyeX, crack, split, face, tick, cross] = v.slice(o, o + BN); boxes.push({ x, y, sz, rot, op: clamp(op), mouth, brow, eyeX: clamp(eyeX), crack: clamp(crack), split: clamp(split), face: clamp(face), tick: clamp(tick), cross: clamp(cross) }); }
  for (let j = 0; j < MAXB; j++) { const o = MAXB * BN + j * LN; links.push({ op: clamp(v[o]), bend: v[o + 1], gap: clamp(v[o + 2]) }); }
  let bi = 0; p.beats.forEach((b, i) => { if (u >= b.at) bi = i; }); return { G, boxes, links, beat: bi };
}

/* ====================================================================== 6. type.commandPill ====================================================================== */
const PILL_D = { text: 'ship --first-draft', prompt: '$', typeAt: 0.55, cps: 16, drawAt: 0.15, drawDur: 0.7, size: 46, pos: [0.5, 0.5], ink: '#EDEDF2', accent: '#8E7BFF', stroke: 2.5, scale: 1 };
export function pillP(raw = {}) {
  const p = { ...PILL_D, ...raw }; p.text = str(p.text, '', 120).replace(/ /g, ' '); p.prompt = str(p.prompt, '', 6).replace(/ /g, ' '); p.typeAt = num(p.typeAt, 0.55, 0, 120); p.cps = num(p.cps, 16, 1, 120); p.drawAt = num(p.drawAt, 0.15, 0, 120); p.drawDur = num(p.drawDur, 0.7, 0.05, 20);
  p.size = num(p.size, 46, 8, 400); p.scale = num(p.scale, 1, 0.3, 4); p.stroke = num(p.stroke, 2.5, 0.5, 12); p.ink = hexOk(p.ink, '#EDEDF2'); p.accent = hexOk(p.accent, '#8E7BFF');
  p.pos = Array.isArray(p.pos) && p.pos.length >= 2 ? [num(p.pos[0], 0.5, 0, 1), num(p.pos[1], 0.5, 0, 1)] : [0.5, 0.5]; return p;
}
/* Plex Mono advances exactly 0.6 em, so the pill needs no font measurement: the same in node and in the browser */
export function pillGeo(p, c) {
  const S = c.safe, n = p.text.length, pn = p.prompt.length ? p.prompt.length + 1 : 0, ADV = 0.6, padE = 0.9, finalE = (n + pn + 1) * ADV + padE * 2;
  const fs = Math.max(6, Math.min(p.size * sc(c) * p.scale, S.w * 0.97 / finalE)), h = fs * 2.1, Wf = finalE * fs, cx = clamp(p.pos[0] * c.W, S.x0 + Wf / 2, Math.max(S.x0 + Wf / 2, S.x1 - Wf / 2)), cy = clamp(p.pos[1] * c.H, S.y0 + h / 2, Math.max(S.y0 + h / 2, S.y1 - h / 2));
  return { fs, h, Wf, x: cx - Wf / 2, y: cy - h / 2, cy, pn, adv: ADV * fs, pad: padE * fs,
    width(u) { const tf = clamp((u - p.typeAt) * p.cps, 0, n); return (tf + pn + 1) * ADV * fs + 2 * padE * fs; }, typed(u) { return Math.min(n, Math.max(0, Math.floor((u - p.typeAt) * p.cps + 1e-9))); } };
}
const stadiumPt = (x, y, w, h, k) => { const r = h / 2, a = Math.max(0, w - h), per = 2 * a + TAU * r; let d = ((k % 1) + 1) % 1 * per;   // start top-left, clockwise
  if (d < a) return [x + r + d, y]; d -= a; if (d < Math.PI * r) { const th2 = -Math.PI / 2 + d / r; return [x + w - r + r * Math.cos(th2), y + r + r * Math.sin(th2)]; } d -= Math.PI * r; if (d < a) return [x + w - r - d, y + h]; d -= a;
  const th2 = Math.PI / 2 + d / r; return [x + r + r * Math.cos(th2), y + r + r * Math.sin(th2)]; };

/* ====================================================================== the parts ====================================================================== */
export const R6 = {
  'chart.hoverTooltip': { file: 'type/gfx/r6.js', tags: ['chart', 'tooltip', 'hover', 'cursor', 'bar', 'line', 'delta', 'data', 'proof', 'product-film'], dur: 5.4, inF: 10, outF: 9, d: HOVER_D,
    svg(L, p0, c) { const p = hoverP(p0), s = c.s, k = sc(c) * p.scale, M = hoverGeo(p, c), S = c.safe, u = L.u, dark = p.theme === 'dark', id = rid('ht', L, p, c);
      if (noSrc(p.source)) return `<g${fadeIO(L) < 1 ? ` opacity="${f2(fadeIO(L))}"` : ''}>${refuse(c, S.x0, S.y0 + 40 * s, Math.min(S.w, 980 * k), 'chart.hoverTooltip: set `source` (where the numbers come from)')}</g>`;
      if (!M.slots.length) return ''; let o = '';
      if (p.draw && M.child) { const cd = SOCIAL[M.child.id], holdEnd = L.total - 9 / 30, CL = life(L.t, L.at, Math.max(0.1, holdEnd - cd.inF / 30), cd.inF, cd.outF); CL.t = L.t; CL.at = L.at; o += cd.svg(CL, { ...cd.d, ...M.child.params }, c); }
      const keys = hoverPath(p, c, M), [fx, fy] = pathAt(keys, u), cx = fx * c.W, cy = fy * c.H, over = overAmt(M, cx, cy, s), slots = M.slots, n = slots.length, ii = nearest(slots, cx), hot = p.hot ?? hexOk(p.chart.accent, BRAND), pitch = n > 1 ? Math.abs(slots[1].cx - slots[0].cx) : slots[0].w * 2;
      if (M.kind !== 'line') slots.forEach((q) => { const prox = 1 - sstep(0.25 * pitch, 0.75 * pitch, Math.abs(cx - q.cx)), lift = p.lift * s * prox * over; if (lift > 0.05) o += rect(q.x0, q.top - lift, q.w, q.base - q.top + lift, 8 * s, hot, 'data-role="lift"'); });
      else { const xm = clamp(cx, slots[0].cx, slots[n - 1].cx); let ym = slots[0].top; for (let i = 1; i < n; i++) if (xm <= slots[i].cx + 1e-6) { ym = lerp(slots[i - 1].top, slots[i].top, seg(xm, slots[i - 1].cx, slots[i].cx)); break; } else ym = slots[i].top;
        if (over > 0.01) o += `<g opacity="${f2(over)}"><line x1="${f2(xm)}" x2="${f2(xm)}" y1="${f2(ym)}" y2="${f2(slots[0].base)}" stroke="${hot}" stroke-width="${f2(2 * s)}" stroke-dasharray="${f2(6 * s)} ${f2(6 * s)}" opacity="0.6"/><circle data-role="marker" cx="${f2(xm)}" cy="${f2(ym)}" r="${f2(11 * s)}" fill="${hot}" stroke="#FFFFFF" stroke-width="${f2(4 * s)}"/></g>`; }
      const sc0 = hoverScan(p, c, M, keys);
      if (sc0.first !== null) { const ls = 27 * k, vs = 48 * k, ms = 17 * k, ps = 23 * k, padc = 22 * k, T = th({ theme: p.theme === 'dark' ? 'dark' : 'light' }), deltas = slots.map((_, i) => fmtDelta(deltaOf(slots, i)));
        const labelW = Math.max(...slots.map((q) => measure(q.label, ls, { weight: 600 }))), valW = Math.max(...slots.map((q) => measure(q.str, vs, { weight: 800 }))), pillW = Math.max(...deltas.map((d) => measure(d, ps, { weight: 800 }))) + 22 * k;
        const src = 'source: ' + p.source, srcW = Math.max(measure(src, ms, { weight: 600 }), measure(p.method, ms, { weight: 600 })), chipW = padc * 2 + Math.max(labelW + 14 * k + pillW, valW, srcW), chipH = padc * 2 + 36 * k + 10 * k + 50 * k + 8 * k + (p.method ? 42 * k : 21 * k);
        const posOf = (i) => [clamp(slots[i].cx - chipW / 2, S.x0, Math.max(S.x0, S.x1 - chipW)), Math.max(S.y0, slots[i].top - 22 * k - chipH - (M.kind === 'line' ? 8 * k : 0))];
        const [px, py] = springTrack(u, [{ t: 0, v: posOf(sc0.i0) }, ...sc0.changes.map((q) => ({ t: q.t, v: posOf(q.i) }))], 'ui'), d = deltaOf(slots, ii), dt = fmtDelta(d), q = slots[ii], chipOp = clamp(over * 1.2), gx = px + chipW / 2, gy = py + chipH / 2;
        const pc = d === null ? T.muted : d > 0.5 ? p.up : d < -0.5 ? p.down : T.muted, nx = clamp(q.cx, px + 22 * k, px + chipW - 22 * k);
        if (chipOp > 0.003) o += `<defs><filter id="${id}s" x="-30%" y="-30%" width="160%" height="190%"><feGaussianBlur stdDeviation="${f2(12 * k)}"/></filter></defs><g data-role="chip" opacity="${f2(chipOp)}" transform="translate(${f2(gx)} ${f2(gy)}) scale(${lerp(0.92, 1, over).toFixed(4)}) translate(${f2(-gx)} ${f2(-gy)})">` +
          `<g opacity="0.55" filter="url(#${id}s)">${rect(px, py + 8 * k, chipW, chipH, 16 * k, dark ? 'rgba(0,0,0,0.6)' : 'rgba(22,20,34,0.28)')}</g>` + rect(px, py, chipW, chipH, 16 * k, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * k)}" data-role="chipbox"`) +
          `<path d="M${f2(nx - 9 * k)} ${f2(py + chipH - 0.5)} L${f2(nx)} ${f2(py + chipH + 9 * k)} L${f2(nx + 9 * k)} ${f2(py + chipH - 0.5)} Z" fill="${T.panel}"/>` +
          text(q.label, px + padc, py + padc + 25 * k, { size: ls, weight: 600, fill: T.muted }) + (dt ? rect(px + chipW - padc - pillW, py + padc - 2 * k, pillW, 36 * k, 18 * k, mixHex(T.panel, pc, 0.16)) + text(dt, px + chipW - padc - pillW / 2, py + padc + 23 * k, { size: ps, weight: 800, fill: pc, anchor: 'middle', extra: 'font-variant-numeric="tabular-nums"' }) : '') +
          text(q.str, px + padc, py + padc + 36 * k + 10 * k + 42 * k, { size: vs, weight: 800, fill: T.ink, extra: 'font-variant-numeric="tabular-nums"' }) + text(src, px + padc, py + chipH - padc - (p.method ? 21 * k : 0) + 9 * k, { size: ms, weight: 600, fill: T.muted }) + (p.method ? text(p.method, px + padc, py + chipH - padc + 9 * k, { size: ms, weight: 600, fill: T.muted }) : '') + '</g>'; }
      const cop = p.cursor ? clamp(seg(u, keys[0][0] - 0.25, keys[0][0])) : 0; if (cop > 0.002) o += `<g opacity="${f2(cop)}">${cursorSvg(cx, cy, 1.5 * s)}</g>`;
      return `<g${L.out > 0.001 ? ` opacity="${f2(1 - L.out)}"` : ''}>${o}</g>`; } },

  'ui.dockLaunch': { file: 'type/gfx/r6.js', tags: ['ui', 'dock', 'launch', 'magnify', 'cursor', 'app-window', 'shared-element', 'product-film'], dur: 5.4, inF: 8, outF: 9, d: DOCK_D,
    svg(L, p0, c) { const p = dockP(p0), G = dockGeo(p, c), s = G.s, u = L.u, dk = p.theme === 'dark', T = th({ theme: p.theme }), id = rid('dk', L, p, c), keys = dockPath(p, c, G), [fx, fy] = pathAt(keys, u), cx = fx * c.W, cy = fy * c.H, near = G.near(cy), Q = p.clickAt;
      const lay = G.at(cx, near), pre = u < Q, dockOp = (1 - E.soft(seg(u, Q + 0.1, Q + 0.5))) * clamp(spring(u, 'panel') * 1.3), rise = 46 * s * (1 - spring(u, 'panel')) + 36 * s * E.exit(seg(u, Q + 0.1, Q + 0.5));
      const [qx, qy] = pathAt(keys, Q), R0 = G.at(qx * c.W, G.near(qy * c.H)).icons[p.target], mk = E.hero(seg(u, Q + 0.05, Q + 0.05 + p.expandDur)), ic = (j, r) => { const q = p.icons[j]; return `<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.w)}" rx="${f2(r.w * 0.225)}" fill="url(#${id}g${j})"/>` + icon(q.icon, r.x + r.w * 0.22, r.y + r.w * 0.22, r.w * 0.56, '#FFFFFF', 2.2 * s * Math.max(0.8, r.w / G.base)); };
      let defs = '', o = ''; p.icons.forEach((q, j) => { defs += `<linearGradient id="${id}g${j}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${mixHex(q.color, '#FFFFFF', 0.28)}"/><stop offset="1" stop-color="${mixHex(q.color, '#000000', 0.18)}"/></linearGradient>`; });
      defs += `<filter id="${id}s" x="-20%" y="-40%" width="140%" height="220%"><feGaussianBlur stdDeviation="${f2(14 * s)}"/></filter>`;
      if (dockOp > 0.003) { const P = lay.panel; o += `<g opacity="${f2(dockOp)}" transform="translate(0 ${f2(rise)})"><g opacity="0.5" filter="url(#${id}s)">${rect(P.x, P.y + 8 * s, P.w, P.h, P.h * 0.3, 'rgba(0,0,0,0.5)')}</g>` + rect(P.x, P.y, P.w, P.h, P.h * 0.3, dk ? 'rgba(46,44,58,0.78)' : 'rgba(255,255,255,0.82)', `stroke="${dk ? 'rgba(255,255,255,0.16)' : 'rgba(22,20,34,0.12)'}" stroke-width="${f2(1.5 * s)}" data-role="dock"`);
        lay.icons.forEach((r, j) => { if (!pre && j === p.target) return; o += `<g data-role="icon" data-i="${j}">${ic(j, r)}</g>`; });
        let bj = -1, bf = 0.5; lay.icons.forEach((r, j) => { if (r.f > bf) { bf = r.f; bj = j; } }); if (bj >= 0 && pre) { const r = lay.icons[bj], nm = p.icons[bj].name, w2 = measure(nm, 20 * s, { weight: 700 }) + 28 * s, lx = clamp(r.x + r.w / 2 - w2 / 2, c.safe.x0, c.safe.x1 - w2), ly = r.y - 14 * s - 36 * s;
          o += `<g opacity="${f2(clamp((bf - 0.5) / 0.35))}">${rect(lx, ly, w2, 36 * s, 11 * s, dk ? 'rgba(20,19,26,0.92)' : 'rgba(255,255,255,0.96)', `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}${text(nm, lx + w2 / 2, ly + 25 * s, { size: 20 * s, weight: 700, fill: T.ink, anchor: 'middle' })}</g>`; } o += '</g>'; }
      if (u >= Q + 0.05) { const W0 = p.window, S = c.safe, wx = clamp(W0[0] * c.W, S.x0, S.x1 - 40), wy = clamp(W0[1] * c.H, S.y0, S.y1 - 40), ww = Math.min(W0[2] * c.W, S.x1 - wx), wh = Math.min(W0[3] * c.H, S.y1 - wy), r = { x: lerp(R0.x, wx, mk), y: lerp(R0.y, wy, mk), w: lerp(R0.w, ww, mk), h: lerp(R0.w, wh, mk) }, rad = lerp(R0.w * 0.225, 24 * s, mk), q = p.icons[p.target];
        o += `<g data-role="window"><g opacity="0.45" filter="url(#${id}s)">${rect(r.x, r.y + 12 * s, r.w, r.h, rad, 'rgba(0,0,0,0.55)')}</g><clipPath id="${id}c"><rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" rx="${f2(rad)}"/></clipPath>` +
          `<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" rx="${f2(rad)}" fill="url(#${id}g${p.target})" opacity="${f2(1 - E.soft(seg(mk, 0.1, 0.6)))}"/>` + rect(r.x, r.y, r.w, r.h, rad, T.panel, `opacity="${f2(E.soft(seg(mk, 0.1, 0.6)))}" stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) + icon(q.icon, r.x + r.w / 2 - R0.w * 0.28, r.y + r.h / 2 - R0.w * 0.28, R0.w * 0.56, '#FFFFFF', 2.2 * s).replace('<path', `<path opacity="${f2(1 - seg(mk, 0, 0.35))}"`);
        const ck = seg(mk, 0.6, 1); if (ck > 0.001) { const pad = 34 * s, bars = [0.5, 0.8, 0.62, 0.95, 0.7], bw = (ww - 2 * pad) * 0.58 / (bars.length * 1.6), bh = wh * 0.34;
          o += `<g clip-path="url(#${id}c)" opacity="${f2(ck)}">` + text(q.name, wx + pad, wy + pad + 22 * s, { size: 30 * s, weight: 800, fill: T.ink }) + rect(wx + ww - pad - 160 * s, wy + pad + 4 * s, 160 * s, 12 * s, 6 * s, T.line) + rect(wx + ww - pad - 110 * s, wy + pad + 26 * s, 110 * s, 12 * s, 6 * s, T.line) + `<line x1="${f2(wx + pad)}" x2="${f2(wx + ww - pad)}" y1="${f2(wy + pad + 54 * s)}" y2="${f2(wy + pad + 54 * s)}" stroke="${T.line}" stroke-width="${f2(2 * s)}"/>` +
            bars.map((b, i) => rect(wx + pad + i * bw * 1.6, wy + wh - pad - 60 * s - bh * b * E.expoOut(seg(ck, i * 0.1, 0.6 + i * 0.1)), bw, bh * b * E.expoOut(seg(ck, i * 0.1, 0.6 + i * 0.1)), 8 * s, q.color)).join('') +
            [0, 1, 2].map((i) => rect(wx + pad + (bars.length * bw * 1.6) + 30 * s, wy + pad + 90 * s + i * 34 * s, (ww - 2 * pad - bars.length * bw * 1.6 - 30 * s) * (1 - i * 0.22), 14 * s, 7 * s, T.line)).join('') + '</g>'; } o += '</g>'; }
      if (p.label) o += text(p.label, c.safe.x0 + 4 * s, c.safe.y1 - 2 * s, { size: 15 * s, weight: 600, fill: T.muted, op: 0.85 });
      const pr = pressAt(u, Q), cop = p.cursor ? clamp(seg(u, keys[0][0] - 0.2, keys[0][0] + 0.1)) : 0; if (cop > 0.002) o += `<g opacity="${f2(cop)}">${ripple(cx, cy, u - Q, s, '#FFFFFF')}${cursorSvg(cx, cy, 1.5 * s, pr)}</g>`;
      return `<defs>${defs}</defs><g${L.out > 0.001 ? ` opacity="${f2(1 - L.out)}"` : ''}>${o}</g>`; } },

  'title.verbCard': { file: 'type/gfx/r6.js', tags: ['title', 'chapter', 'verb', 'giant-word', 'feature-tour', 'gradient-sweep', 'typography'], dur: 7.2, inF: 6, outF: 9, d: VERB_D,
    svg(L, p0, c) { const p = verbP(p0), u = L.u, id = rid('vb', L, p, c), s = sc(c), N = p.words.length, T = verbTimes(p), wt = p.weight; let defs = '', o = '';
      if (p.ground) o += `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="${p.ground}"/>`;
      if (p.glow) { defs += `<radialGradient id="${id}r" cx="50%" cy="108%" r="75%"><stop offset="0" stop-color="${p.colors[1]}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${p.colors[0]}" stop-opacity="0.28"/><stop offset="1" stop-color="${p.colors[2 % p.colors.length]}" stop-opacity="0"/></radialGradient>`; o += `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="url(#${id}r)"/>`; }
      for (let i = 1; i < N; i++) { const k = seg(u, T.sweep(i), T.sweep(i) + p.sweepDur); if (k <= 0 || k >= 1) continue; const bw = 0.75 * c.W, xc = lerp(-0.4 * c.W, 1.4 * c.W, E.move(k)), a = Math.sin(Math.PI * k) ** 0.8;
        defs += `<linearGradient id="${id}w${i}" x1="0" x2="1" y1="0" y2="0">${p.colors.map((q, j) => `<stop offset="${f2(j / (p.colors.length - 1))}" stop-color="${q}"/>`).join('')}</linearGradient><linearGradient id="${id}m${i}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
          `<mask id="${id}k${i}"><rect x="${f2(xc - bw / 2)}" y="${f2(-0.5 * c.H)}" width="${f2(bw)}" height="${f2(2 * c.H)}" fill="url(#${id}m${i})"/></mask>` + blurDef(`${id}z${i}`, 30 * s);
        o += `<g transform="rotate(-12 ${f2(c.W / 2)} ${f2(c.H / 2)})" opacity="${f2(0.9 * a)}"><g mask="url(#${id}k${i})"${blurAttr(`${id}z${i}`, 30 * s)}><rect x="${f2(xc - bw / 2)}" y="${f2(-0.5 * c.H)}" width="${f2(bw)}" height="${f2(2 * c.H)}" fill="url(#${id}w${i})"/></g></g>`; }
      p.words.forEach((w, i) => { const lo = u - T.start(i); if (lo < 0 || (i < N - 1 && lo > p.chapterDur + 0.05)) return; const G = verbLayout(w, p, c), inK = E.enter(seg(lo, 0, 0.45)), sk = clamp(spring(lo - p.settleAt, { zeta: 0.9, f: 1.2 / p.settleDur * 0.9 }), 0, 1.02), rk = seg(lo, p.settleAt + 0.2, p.settleAt + 0.55);
        const ex = i < N - 1 ? E.soft(seg(lo, p.chapterDur - 0.35, p.chapterDur)) : 0, bx = lerp(G.big0.x, G.big1.x, sk), by = lerp(G.big0.y, G.big1.y, sk), bs = lerp(1, G.k, sk), sd = (1 - inK) * 22 * s + ex * 14 * s, ox = (1 - ex) * clamp(inK * 1.4);
        defs += blurDef(`${id}b${i}`, sd) + blurDef(`${id}t${i}`, (1 - rk) * 9 * s + ex * 14 * s);
        let g = `<g data-role="big" data-i="${i}" transform="translate(${f2(bx)} ${f2(by)}) scale(${Math.max(0.0001, bs * lerp(1.1, 1, inK)).toFixed(5)})"><text x="0" y="0" font-family="${esc(FONT)}" font-size="${f2(G.bigSize)}" font-weight="${wt}" fill="${p.ink}" letter-spacing="${f2(-0.02 * G.bigSize)}">${esc(w.big)}</text></g>`;
        g = `<g${blurAttr(`${id}b${i}`, sd)}>${g}</g>`;
        const rest = G.lines.map((l, k) => (k === 0 ? (l.rest ? `<g data-role="rest" data-i="${i}" opacity="${f2(rk)}" transform="translate(${f2((1 - rk) * 14 * s)} 0)"><text x="${f2(G.restX)}" y="${f2(l.y)}" font-family="${esc(FONT)}" font-size="${f2(G.lineSize)}" font-weight="${wt}" fill="${p.ink}" letter-spacing="${f2(-0.02 * G.lineSize)}">${esc(l.rest)}</text></g>` : '') :
          `<g data-role="rest" data-i="${i}" opacity="${f2(seg(lo, p.settleAt + 0.2 + 0.1 * k, p.settleAt + 0.55 + 0.1 * k))}"><text x="${f2(l.x)}" y="${f2(l.y)}" font-family="${esc(FONT)}" font-size="${f2(G.lineSize)}" font-weight="${wt}" fill="${p.ink}" letter-spacing="${f2(-0.02 * G.lineSize)}">${esc(l.str)}</text></g>`)).join('');
        o += `<g opacity="${f2(ox)}" transform="translate(0 ${f2(-18 * s * ex)})">${g}<g${blurAttr(`${id}t${i}`, (1 - rk) * 9 * s + ex * 14 * s)}>${rest}</g></g>`; });
      return `<defs>${defs}</defs><g${L.out > 0.001 || L.in < 0.999 ? ` opacity="${f2(clamp(L.in * 2) * (1 - L.out))}"` : ''}>${o}</g>`; } },

  'ui.connectRows': { file: 'type/gfx/r6.js', tags: ['ui', 'connect', 'rows', 'button', 'tick', 'cursor', 'integrations', 'product-film'], dur: 7.0, inF: 8, outF: 9, d: CONN_D,
    svg(L, p0, c) { const p = connP(p0), u = L.u, s = sc(c), T = th({ theme: p.theme }), dk = p.theme === 'dark', id = rid('cn', L, p, c), G = connLayout(p, c, u), q = G.q, P = G.panel; let o = '';
      o += `<defs><filter id="${id}s" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="${f2(16 * q)}"/></filter>${p.rows.map((r, i) => `<linearGradient id="${id}g${i}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${mixHex(r.color, '#FFFFFF', 0.25)}"/><stop offset="1" stop-color="${mixHex(r.color, '#000000', 0.18)}"/></linearGradient>`).join('')}</defs>` +
        `<g opacity="0.5" filter="url(#${id}s)">${rect(P.x, P.y + 10 * q, P.w, P.h, 26 * q, 'rgba(0,0,0,0.45)')}</g>` + rect(P.x, P.y, P.w, P.h, 26 * q, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * q)}" data-role="panel"`);
      p.rows.forEach((r, i) => { const R = G.rows[i], B = R.btn, ak = clamp(R.ak * 1.6), Tm = G.T, fl = u >= Tm.click[i] ? clamp(1 - (u - Tm.click[i]) / 0.28) : 0, press = pressAt(u, Tm.click[i]), dn = R.ck, lx = clamp(seg(u, Tm.click[i] + 0.05, Tm.click[i] + 0.2)), dx = clamp(seg(u, Tm.click[i] + 0.1, Tm.click[i] + 0.28)), bcx = B.x + B.w / 2, bcy = B.y + B.h / 2;
        if (ak <= 0.003) return; const bfill = mixHex(mixHex(p.accent, '#FFFFFF', 0.35 * fl), mixHex(T.panel, GREEN, 0.2), dn);
        o += `<g opacity="${f2(ak)}" data-role="row" data-i="${i}">` + rect(R.x, R.y, R.w, R.h, 18 * q, T.chip, `stroke="${T.line}" stroke-width="${f2(1.2 * q)}"`) +
          `<rect x="${f2(R.x + 16 * q)}" y="${f2(R.y + (R.h - 54 * q) / 2)}" width="${f2(54 * q)}" height="${f2(54 * q)}" rx="${f2(14 * q)}" fill="url(#${id}g${i})"/>` + icon(r.icon, R.x + 16 * q + 13 * q, R.y + (R.h - 54 * q) / 2 + 13 * q, 28 * q, '#FFFFFF', 2.2 * q) +
          text(r.name, R.x + 16 * q + 54 * q + 18 * q, R.y + R.h / 2 + 10 * q, { size: 28 * q, weight: 700, fill: T.ink }) +
          `<g transform="translate(${f2(bcx)} ${f2(bcy)}) scale(${f2(1 - 0.06 * press)}) translate(${f2(-bcx)} ${f2(-bcy)})" data-role="btn" data-i="${i}" data-x="${f2(B.x)}" data-y="${f2(B.y)}" data-w="${f2(B.w)}" data-h="${f2(B.h)}">` +
          (fl > 0 ? `<circle cx="${f2(bcx)}" cy="${f2(bcy)}" r="${f2(B.h * (0.6 + 1.1 * (1 - fl)))}" fill="none" stroke="${p.accent}" stroke-width="${f2(3 * q)}" opacity="${f2(0.6 * fl)}"/>` : '') +
          rect(B.x, B.y, B.w, B.h, B.h / 2, bfill, `stroke="${mixHex(p.accent, GREEN, dn)}" stroke-width="${f2(1.5 * q)}" stroke-opacity="${f2(0.6 * dn)}"`) +
          text(p.connect, bcx, bcy + 8 * q, { size: 22 * q, weight: 700, fill: '#FFFFFF', anchor: 'middle', op: 1 - lx }) +
          (dx > 0 ? `<path d="M${f2(B.x + 20 * q)} ${f2(bcy + 1 * q)} l${f2(6 * q)} ${f2(6 * q)} l${f2(11 * q)} ${f2(-12 * q)}" fill="none" stroke="${GREEN}" stroke-width="${f2(3 * q)}" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="${f2(100 * dx)} 100" opacity="${f2(dx)}"/>` : '') +
          text(p.done, bcx + 14 * q, bcy + 8 * q, { size: 22 * q, weight: 700, fill: GREEN, anchor: 'middle', op: dx }) + '</g></g>'; });
      if (G.thinkK > 0.003) { const ty = G.thinkY, sp = TAU * 0.9 * u; o += `<g opacity="${f2(clamp(G.thinkK))}" data-role="thinking"><g transform="translate(${f2(P.x + 38 * q)} ${f2(ty)}) rotate(${f2(sp * 57.3)})">${icon('spark', -13 * q, -13 * q, 26 * q, p.accent, 2 * q)}</g>` + text(p.thinking, P.x + 66 * q, ty + 8 * q, { size: 24 * q, weight: 700, fill: p.accent }) +
          [0, 1, 2].map((j) => `<circle cx="${f2(P.x + 66 * q + measure(p.thinking, 24 * q, { weight: 700 }) + 14 * q + j * 14 * q)}" cy="${f2(ty + 2 * q)}" r="${f2(3.2 * q)}" fill="${p.accent}" opacity="${f2(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(TAU * 1.2 * u - j * 1.1)))}"/>`).join('') + '</g>'; }
      if (p.note) o += text(p.note, P.x + P.w - 22 * q, P.y + P.h - 8 * q, { size: 14 * q, weight: 600, fill: T.muted, anchor: 'end', op: 0.85 });
      if (p.cursor) { const [cx, cy] = connCursor(p, c, u), T0 = G.T.click[0] - 0.9, cop = clamp(seg(u, T0 - 0.35, T0)), pr = Math.max(...G.T.click.map((t) => pressAt(u, t))); if (cop > 0.003) o += `<g opacity="${f2(cop)}">${G.T.click.map((t) => ripple(cx, cy, u - t, q, '#FFFFFF')).join('')}${cursorSvg(cx, cy, 1.5 * q, clamp(pr, 0, 1))}</g>`; }
      return `<g${L.out > 0.001 ? ` opacity="${f2(1 - L.out)}"` : ''}>${o}</g>`; } },

  'layout.degradingDiagram': { file: 'type/gfx/r6.js', tags: ['layout', 'diagram', 'boxes', 'faces', 'problem-ladder', 'value-ladder', 'captions', 'blur-through', 'explainer'], dur: 13.2, inF: 8, outF: 9, d: DIAG_D,
    svg(L, p0, c) { const p = diagP(p0), u = L.u, id = rid('dg', L, p, c), { G, boxes, links, beat } = diagramState(p, c, u), s = G.s, U = G.unit, sw = Math.max(1.4, 2.4 * s), ink = p.ink; let defs = '', o = '', ll = '';
      const bx = boxes.map((b) => ({ ...b, px: G.cx + b.x * U, py: G.cy + b.y * U, r: b.sz * U })), jit = (k) => (p.reduced ? [0, 0] : [(hashf(k, Math.floor(u * 24)) - 0.5) * 3 * s, (hashf(k + 9, Math.floor(u * 24)) - 0.5) * 3 * s]);
      links.forEach((l, j) => { if (l.op < 0.01) return; let A, B, bend = l.bend, gap = l.gap, Cp1, Cp2, ax, ay, bxx, byy;
        if (j < MAXB - 1) { A = bx[j]; B = bx[j + 1]; if (A.op < 0.02 || B.op < 0.02) return; const dx = B.px - A.px, dy = B.py - A.py, len = Math.hypot(dx, dy); if (len < 1) return; const ux = dx / len, uy = dy / len, ta = A.r * 0.58 + 4 * s, tb = B.r * 0.58 + 6 * s; ax = A.px + ux * ta; ay = A.py + uy * ta; bxx = B.px - ux * tb; byy = B.py - uy * tb;
          const nx = -uy, ny = ux, off = bend * Math.hypot(bxx - ax, byy - ay) * 0.45; Cp1 = [ax + (bxx - ax) * 0.25 + nx * off, ay + (byy - ay) * 0.25 + ny * off]; Cp2 = [ax + (bxx - ax) * 0.75 + nx * off, ay + (byy - ay) * 0.75 + ny * off]; }
        else { A = bx[p.ret[0]]; B = bx[p.ret[1]]; if (A.op < 0.02 || B.op < 0.02) return; ax = A.px; ay = A.py + A.r * 0.58 + 4 * s; bxx = B.px; byy = B.py + B.r * 0.58 + 8 * s; const drop = U * 0.95; Cp1 = [ax, ay + drop]; Cp2 = [bxx, byy + drop]; }
        const a1 = 50 - gap * 14, b1 = gap * 28, d = `M${f2(ax)} ${f2(ay)} C${f2(Cp1[0])} ${f2(Cp1[1])} ${f2(Cp2[0])} ${f2(Cp2[1])} ${f2(bxx)} ${f2(byy)}`, col = mixHex(ink, p.bad, gap * 0.55), tx = bxx - Cp2[0], ty = byy - Cp2[1], tl = Math.hypot(tx, ty) || 1, hx = tx / tl, hy = ty / tl, hs = 11 * s;
        ll += `<g opacity="${f2(l.op * (A.op * B.op) * 0.9)}" data-role="link" data-j="${j}"><path d="${d}" fill="none" stroke="${col}" stroke-width="${f2(sw)}" stroke-linecap="round" pathLength="100" stroke-dasharray="${f2(a1)} ${f2(b1)} ${f2(100 - a1 - b1)} 100"/>` +
          `<path d="M${f2(bxx - hx * hs - hy * hs * 0.6)} ${f2(byy - hy * hs + hx * hs * 0.6)} L${f2(bxx)} ${f2(byy)} L${f2(bxx - hx * hs + hy * hs * 0.6)} ${f2(byy - hy * hs - hx * hs * 0.6)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(1 - gap * 0.8)}"/></g>`; });
      const boxSvg = (b, k) => { const w = sw / Math.max(1, b.r) * 1; let f = `<rect x="-0.5" y="-0.5" width="1" height="1" rx="0.14" fill="${ink}" fill-opacity="0.05" stroke="${ink}" stroke-width="${f2(w)}"/>`;
        if (b.face > 0.01) f += `<g opacity="${f2(b.face)}"><circle cx="-0.2" cy="-0.08" r="0.045" fill="${ink}" opacity="${f2(1 - b.eyeX)}"/><circle cx="0.2" cy="-0.08" r="0.045" fill="${ink}" opacity="${f2(1 - b.eyeX)}"/>` +
          (b.eyeX > 0.01 ? `<path d="M-0.25 -0.13 L-0.15 -0.03 M-0.15 -0.13 L-0.25 -0.03 M0.15 -0.13 L0.25 -0.03 M0.25 -0.13 L0.15 -0.03" stroke="${ink}" stroke-width="${f2(w)}" stroke-linecap="round" opacity="${f2(b.eyeX)}"/>` : '') +
          (b.brow > 0.01 ? `<path d="M-0.34 -0.2 L-0.12 ${f2(-0.2 - 0.11 * b.brow)} M0.34 -0.2 L0.12 ${f2(-0.2 - 0.11 * b.brow)}" stroke="${ink}" stroke-width="${f2(w)}" stroke-linecap="round" fill="none"/>` : '') +
          `<path d="M-0.17 0.2 Q0 ${f2(0.2 + b.mouth * 0.13)} 0.17 0.2" stroke="${ink}" stroke-width="${f2(w)}" stroke-linecap="round" fill="none"/></g>`;
        if (b.crack > 0.01) f += `<path d="M0.5 -0.32 L0.3 -0.2 L0.38 -0.02 L0.14 0.1 L0.22 0.3" fill="none" stroke="${ink}" stroke-width="${f2(w)}" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="${f2(100 * b.crack)} 100"/>`;
        const core = clamp((1 - b.face) * (1 - Math.max(b.tick, b.cross))); if (core > 0.01) f += `<rect x="-0.14" y="-0.14" width="0.28" height="0.28" rx="0.05" fill="none" stroke="${ink}" stroke-width="${f2(w)}" opacity="${f2(core * 0.8)}"/>`;
        if (b.tick > 0.01) f += `<path d="M-0.2 0.02 L-0.06 0.16 L0.2 -0.14" fill="none" stroke="${p.ok}" stroke-width="${f2(w * 1.5)}" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="${f2(100 * b.tick)} 100" opacity="${f2(b.tick)}"/>`;
        if (b.cross > 0.01) f += `<path d="M-0.17 -0.17 L0.17 0.17 M0.17 -0.17 L-0.17 0.17" fill="none" stroke="${p.bad}" stroke-width="${f2(w * 1.5)}" stroke-linecap="round" pathLength="100" stroke-dasharray="${f2(100 * b.cross)} 100" opacity="${f2(b.cross)}"/>`; return f; };
      bx.forEach((b, k) => { if (b.op < 0.01) return; const [jx, jy] = b.split > 0.3 || b.crack > 0.3 ? jit(k) : [0, 0], inner = boxSvg(b, k), T = `translate(${f2(b.px + jx)} ${f2(b.py + jy)}) rotate(${f2(b.rot)}) scale(${f2(Math.max(0.001, b.r))})`;
        if (b.split > 0.004) { const Z = '0,-0.6 0.05,-0.3 -0.12,-0.05 0.08,0.2 -0.04,0.6', sp = b.split; defs += `<clipPath id="${id}L${k}"><polygon points="-0.8,-0.8 ${Z} -0.8,0.8"/></clipPath><clipPath id="${id}R${k}"><polygon points="0.8,-0.8 ${Z} 0.8,0.8"/></clipPath>`;
          o += `<g opacity="${f2(b.op)}" data-role="box" data-k="${k}"><g transform="${T}"><g transform="translate(${f2(-0.07 * sp)} ${f2(-0.04 * sp)}) rotate(${f2(-5 * sp)})"><g clip-path="url(#${id}L${k})">${inner}</g></g><g transform="translate(${f2(0.07 * sp)} ${f2(0.05 * sp)}) rotate(${f2(6 * sp)})"><g clip-path="url(#${id}R${k})">${inner}</g></g></g></g>`; }
        else o += `<g opacity="${f2(b.op)}" data-role="box" data-k="${k}"><g transform="${T}">${inner}</g></g>`; });
      /* captions: blur-through between beats (opacity only when reduced) */
      const cap = (i) => p.beats[i].caption, cur = beat, prev = Math.max(0, beat - 1), k = cur > 0 && cap(cur) !== cap(prev) ? seg(u, p.beats[cur].at, p.beats[cur].at + p.swap) : 1, cs0 = G.cs, S = c.safe;
      const capSvg = (str1, op1, bl, tag) => { if (!str1 || op1 < 0.01) return ''; let size = cs0, lines; for (let t = 0; t < 40; t++) { const toks = str1.split(/\s+/).filter(Boolean); lines = []; let cu = []; for (const w of toks) { if (cu.length && measure([...cu, w].join(' '), size, { weight: 700 }) > S.w * 0.96) { lines.push(cu); cu = [w]; } else cu.push(w); } if (cu.length) lines.push(cu); if (lines.length <= 2 && lines.every((l) => measure(l.join(' '), size, { weight: 700 }) <= S.w * 0.96)) break; size *= 0.92; }
        const fid = `${id}${tag}`, bs = p.reduced ? 0 : bl; defs += blurDef(fid, bs); return `<g opacity="${f2(op1)}"${blurAttr(fid, bs)} data-role="caption">${lines.map((l, j) => text(l.join(' '), G.cx, G.capY + (j - (lines.length - 1) / 2) * size * 1.2 + size * 0.34, { size, weight: 700, fill: ink, anchor: 'middle' })).join('')}</g>`; };
      o = ll + o; if (k < 1) o += capSvg(cap(prev), clamp(1 - k * 2), 12 * s * k, 'a') + capSvg(cap(cur), clamp(k * 2 - 1), 12 * s * (1 - k), 'b'); else o += capSvg(cap(cur), 1, 0, 'b');
      return `<defs>${defs}</defs><g${L.out > 0.001 || L.in < 0.999 ? ` opacity="${f2(clamp(L.in * 1.5) * (1 - L.out))}"` : ''}>${o}</g>`; } },

  'type.commandPill': { file: 'type/gfx/r6.js', tags: ['type', 'terminal', 'command', 'pill', 'cta', 'monospace', 'typing', 'draw-on'], dur: 3.6, inF: 6, outF: 9, d: PILL_D,
    svg(L, p0, c) { const p = pillP(p0), G = pillGeo(p, c), u = L.u, w = G.width(u), n = G.typed(u), dk = clamp(seg(u, p.drawAt, p.drawAt + p.drawDur)), dd = E.move(dk), typing = u >= p.typeAt && u < p.typeAt + p.text.length / p.cps, sw = p.stroke * sc(c);
      const x = G.x, y = G.y, r = G.h / 2, typed = p.text.slice(0, n), tx = x + G.pad, ty = G.cy + G.fs * 0.2, cx = tx + (G.pn + n) * G.adv, blink = typing || u < p.typeAt || Math.floor((u - p.typeAt - p.text.length / p.cps) * 2) % 2 === 0;
      const d = `M${f2(x + r)} ${f2(y)} H${f2(x + w - r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w - r)} ${f2(y + G.h)} H${f2(x + r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + r)} ${f2(y)} Z`, head = dd > 0.001 && dd < 0.999 ? stadiumPt(x, y, w, G.h, dd) : null;
      return `<g${L.out > 0.001 || L.in < 0.999 ? ` opacity="${f2(clamp(L.in * 1.5) * (1 - L.out))}"` : ''}>` + (dd > 0.001 ? `<path data-role="pill" d="${d}" fill="${p.ink}" fill-opacity="${f2(0.04 * dd)}" stroke="${p.ink}" stroke-width="${f2(sw)}" stroke-linecap="round" pathLength="100" stroke-dasharray="${f2(100 * dd)} 100"/>` : '') +
        (head ? `<circle cx="${f2(head[0])}" cy="${f2(head[1])}" r="${f2(sw * 2.2)}" fill="${p.accent}" opacity="${f2(Math.sin(Math.PI * dd))}"/>` : '') +
        `<text data-role="cmd" x="${f2(tx)}" y="${f2(ty)}" font-family="${esc(MONO)}" font-size="${f2(G.fs)}" font-weight="600" xml:space="preserve">${p.prompt ? `<tspan fill="${p.accent}">${esc(p.prompt)} </tspan>` : ''}<tspan fill="${p.ink}">${esc(typed)}</tspan></text>` +
        (blink && u >= p.drawAt ? `<rect data-role="caret" x="${f2(cx + G.adv * 0.08)}" y="${f2(G.cy - G.fs * 0.62)}" width="${f2(G.adv * 0.55)}" height="${f2(G.fs * 1.12)}" rx="${f2(G.fs * 0.04)}" fill="${p.accent}" opacity="${f2(clamp(seg(u, p.drawAt, p.drawAt + 0.2)))}"/>` : '') + '</g>'; } },
};

/* ---------- sound: one cue per action (local times; index.js adds the item's at). Existing sfx ids only. ---------- */
const WIDE = { W: 1920, H: 1080, s: 1, safe: { x0: 96, y0: 54, x1: 1824, y1: 1026, w: 1728, h: 972 }, tall: false };
export const R6_CUES = {
  'chart.hoverTooltip': (p0) => { const p = hoverP(p0), M = hoverGeo(p, WIDE); if (noSrc(p.source)) return [{ t: 0, id: 'sfx/ui/error', why: 'refused: no source' }]; if (!M.slots.length) return [];
    const keys = hoverPath(p, WIDE, M), S = hoverScan(p, WIDE, M, keys); if (S.first === null) return []; const out = [{ t: S.first, id: 'sfx/ui/pop', why: 'tooltip chip appears' }], gap = (t) => out.every((q) => Math.abs(q.t - t) > 0.07);
    S.changes.forEach((q) => { if (gap(q.t)) out.push({ t: q.t, id: 'sfx/ui/tick', why: 'bar ' + (q.i + 1) + ' entered' }); }); return out.sort((a, b) => a.t - b.t); },
  'ui.dockLaunch': (p0) => { const p = dockP(p0), G = dockGeo(p, WIDE), keys = dockPath(p, WIDE, G), out = []; dockEnters(p, WIDE, G, keys).forEach((q, j) => { if (out.length === 0 || q.t - out.at(-1).t > 0.07) out.push({ t: q.t, id: rr(TICKS, j), why: 'icon ' + (q.i + 1) + ' magnifies' }); });
    out.push({ t: p.clickAt, id: 'sfx/device/mouse_click', why: 'click on the icon' }, { t: +(p.clickAt + 0.06).toFixed(4), id: 'sfx/whoosh/swish_s', why: 'icon expands into the window' }, { t: +(p.clickAt + 0.06 + p.expandDur * 0.7).toFixed(4), id: 'sfx/ui/pop', why: 'window content lands' }); return out.sort((a, b) => a.t - b.t); },
  'title.verbCard': (p0) => { const p = verbP(p0), T = verbTimes(p), out = []; p.words.forEach((w, i) => { out.push({ t: +T.start(i).toFixed(4), id: 'sfx/hit/soft', why: 'giant word "' + w.big + '" lands' }, { t: +(T.settle(i) + 0.1).toFixed(4), id: 'sfx/ui/tick', why: 'it settles into the line' }); if (i) out.push({ t: +Math.max(0, T.sweep(i)).toFixed(4), id: 'sfx/whoosh/swish_s', why: 'gradient sweep' }); }); return out.sort((a, b) => a.t - b.t); },
  'ui.connectRows': (p0) => { const p = connP(p0), T = connTimes(p), out = []; p.rows.forEach((r, i) => { out.push({ t: +T.appear[i].toFixed(4), id: 'sfx/ui/pop', why: r.name + ' row arrives' }, { t: +T.click[i].toFixed(4), id: 'sfx/device/mouse_click', why: 'click Connect on ' + r.name }, { t: +(T.click[i] + 0.14).toFixed(4), id: 'sfx/ui/toggle_on', why: r.name + ' connected' }); });
    if (T.think !== null) out.push({ t: +T.think.toFixed(4), id: 'sfx/ui/ai_think_pulse', why: 'thinking line' }); return out.filter((q, i, a) => a.findIndex((z) => Math.abs(z.t - q.t) < 0.05 && z.id === q.id) === i).sort((a, b) => a.t - b.t); },
  'layout.degradingDiagram': (p0) => { const p = diagP(p0), out = []; p.beats.forEach((b, i) => { if (!i) { out.push({ t: 0.1, id: 'sfx/ui/pop', why: 'diagram appears' }); return; } const prev = p.beats[i - 1], worse = Object.keys(MOODS).indexOf(b.mood) > Object.keys(MOODS).indexOf(prev.mood) && b.mood !== 'tidy' && b.mood !== 'blank';
    out.push({ t: +b.at.toFixed(4), id: b.mood === 'broken' ? 'sfx/hit/thud' : worse ? 'sfx/ui/blip' : b.mood === 'tidy' || b.mood === 'blank' ? (b.marks.some((m) => m) ? 'sfx/ui/toggle_on' : 'sfx/ui/pop') : 'sfx/ui/tick', why: 'beat ' + (i + 1) + ': ' + b.mood + (b.caption ? ' / ' + b.caption : '') }); }); return out; },
  'type.commandPill': (p0) => { const p = pillP(p0), out = [{ t: p.drawAt, id: 'sfx/ui/slide', why: 'outline draws on' }]; for (let i = 0; i < p.text.length; i++) { const t = +(p.typeAt + i / p.cps).toFixed(4); if (p.text[i] !== ' ' && (out.length < 2 || t - out.at(-1).t > 0.07)) out.push({ t, id: 'sfx/ui/type_key', why: 'key ' + (i + 1) }); }
    out.push({ t: +(Math.max(p.drawAt + p.drawDur, p.typeAt + p.text.length / p.cps) + 0.05).toFixed(4), id: 'sfx/ui/pop', why: 'command ready' }); return out.sort((a, b) => a.t - b.t).slice(0, 60); },
};
