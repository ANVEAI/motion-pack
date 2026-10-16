/* motion-pack / type / gfx / explain.js: "how it works" parts (lane explainer, 2026-10-16). Pure functions of t (seek-safe), plain SVG strings.
     diagram.graph      a node / edge / group diagram (JSON or the DSL of graph.js) laid out by the deterministic layered layout, built step by step (`steps`), with
                        highlight + dim (`focus`), flowing edges (`flow`), a camera that moves between regions (`cam`), notes pinned to nodes and timed to the voice (`notes`),
                        and a zoom INTO one node that opens its own sub-diagram (`zoom`): the camera dives until the node fills the frame, then the inside builds
     diagram.flow       one edge with a flow animation (draw on, then dashes and dots run along it); diagram.graph uses the same drawing
     layout.scrolly     the scrollytelling text column: step cards scroll past a focus line on their times, the active one lit, a progress rail; the sticky graphic is any other item
     title.takeaway     the takeaway card: a kicker, then one line word by word
     process.steps      numbered steps with owned icons on a timeline: the progress line fills, done steps tick
     process.beforeAfter  two cards: before, then after wipes in beside (16:9) or under (9:16) it
   Times inside params are LOCAL to the item's `at` (the template converts voice-word times). Every list is capped (limits.js clamps the counts) so no value can hang a frame. */
import { E, clamp, seg, lerp, f2, text, measure, inkOn, esc, FONT, BRAND } from './core.js';
import { mixHex } from './swap.js';
import { layoutGraph, parseGraph, boundsOf, pathAt, edgeKey } from './graph.js';
import { iconSVG } from './explain-icons.js';
import { PAPER_INK, MUTED } from './explain-data.js';
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const bx = (b, c) => [num(b?.[0]) * c.W, num(b?.[1]) * c.H, num(b?.[2], 1) * c.W, num(b?.[3], 1) * c.H];
const list = (v, n = 64) => (Array.isArray(v) ? v.slice(0, n) : []);
/* word wrap with measured widths, at most `max` lines (the last one ends in an ellipsis when cut) */
export function wrap(str, width, size, { weight = 700, max = 3 } = {}) {
  const words = String(str ?? '').split(/\s+/).filter(Boolean), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, size, { weight }) > width) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); if (out.length > max) { const keep = out.slice(0, max); keep[max - 1] = keep[max - 1].replace(/\s*\S*$/, '') + '\u2026'; return keep; } return out;
}
const lines = (ls, x, y, size, lh, o) => ls.map((l, i) => text(l, x, y + i * lh, { size, ...o })).join('');
/* a tiny memo for layouts (pure input -> pure output; the key is the input itself) */
const MEMO = new Map(); const memo = (key, fn) => { if (MEMO.has(key)) return MEMO.get(key); const v = fn(); MEMO.set(key, v); if (MEMO.size > 32) MEMO.delete(MEMO.keys().next().value); return v; };
export const graphOf = (spec, dir, box) => memo(JSON.stringify([spec, dir, box.map((v) => Math.round(v * 100) / 100)]), () => layoutGraph(typeof spec === 'string' ? parseGraph(spec) : spec, { dir, box }));

/* ---------- flow drawing (shared) ---------- */
export function flowSVG(segs, d, u, { color, width, rate = 0.6, dots = 2, op = 1, s = 1 }) {
  if (op <= 0.001 || !segs?.length) return ''; let g = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f2(width)}" stroke-linecap="round" pathLength="100" stroke-dasharray="4 8" stroke-dashoffset="${f2(-((u * rate * 60) % 12))}" opacity="${f2(op)}"/>`;
  const n = Math.max(0, Math.min(8, Math.trunc(num(dots, 2)))); for (let i = 0; i < n; i++) { const f = (((u * rate + i / n) % 1) + 1) % 1, [x, y] = pathAt(segs, f); g += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(width * 1.3)}" fill="${color}" opacity="${f2(op * Math.min(1, f * 8, (1 - f) * 8))}"/>`; }
  return g;
}
const arrowHead = (seg4, size, color, op) => { const [, , c2, p3] = seg4, a = Math.atan2(p3[1] - c2[1], p3[0] - c2[0]) || 0, l = size, w = size * 0.6;
  const p = [[p3[0], p3[1]], [p3[0] - l * Math.cos(a) + w * Math.sin(a), p3[1] - l * Math.sin(a) - w * Math.cos(a)], [p3[0] - l * Math.cos(a) - w * Math.sin(a), p3[1] - l * Math.sin(a) + w * Math.cos(a)]];
  return `<polygon points="${p.map((q) => q.map(f2).join(',')).join(' ')}" fill="${color}" opacity="${f2(op)}"/>`; };

/* ---------- diagram.graph ---------- */
const DIAG_SPEC = { nodes: [{ id: 'ask', label: 'A question', kind: 'io' }, { id: 'find', label: 'Find sources' }, { id: 'notes', label: 'Notes', kind: 'store' }, { id: 'check', label: 'Check the facts', kind: 'decision' }, { id: 'write', label: 'Write the answer', kind: 'io' }],
  edges: [{ from: 'ask', to: 'find' }, { from: 'find', to: 'check' }, { from: 'find', to: 'notes' }, { from: 'notes', to: 'check' }, { from: 'check', to: 'write', label: 'confirmed' }] };
const DIAG_D = { spec: DIAG_SPEC, dir: 'LR', box: [0.06, 0.22, 0.88, 0.58], steps: [], focus: [], flow: [], cam: [], notes: [], zoom: null, reveal: 0.3,
  accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', node: '#FFFFFF', line: MUTED, zoomFill: '#EFEAFD', dim: 0.22, size: 1 };
const inIds = (ids, id) => ids === 'all' || (Array.isArray(ids) && ids.includes(id));
export function appearTimes(lay, p) {
  const st = list(p.steps), out = {}, rv = num(p.reveal, 0.3);
  for (const id of Object.keys(lay.nodes)) { if (!st.length) { out[id] = lay.nodes[id].layer * rv; continue; } let t = Infinity; for (const s of st) if (inIds(s.show, id)) { t = Math.min(t, num(s.at) + (s.stagger ? lay.nodes[id].layer * num(s.stagger) : 0)); } out[id] = t; }
  return out;
}
const stateAt = (entries, u, fn) => { const es = list(entries).filter((e) => e && Number.isFinite(+e.at)).sort((a, b) => a.at - b.at); let cur = null, prev = null; for (const e of es) if (u >= e.at) { prev = cur; cur = e; } return { cur, prev, fn }; };
/* a view = the world point at the centre of the diagram box + a scale; the overview (ids 'all' or none) is the identity. A region view fits its nodes into the box, never zooms out past the overview */
function viewOf(lay, e, c) { const [bx0, by0, bw, bh] = lay.box, home = { cx: bx0 + bw / 2, cy: by0 + bh / 2, k: 1 }; if (!e || !e.ids || e.ids === 'all') return home; const [x, y, w, h] = boundsOf(lay, e.ids), pad = clamp(num(e.pad, 0.08), 0, 0.4);
  return { cx: x + w / 2, cy: y + h / 2, k: clamp(Math.min((bw * (1 - 2 * pad)) / Math.max(1, w), (bh * (1 - 2 * pad)) / Math.max(1, h)), 1, num(e.max, 1.8)) }; }
const mixView = (a, b, k) => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), k)) });
export function camAt(lay, p, u, c) {
  const es = list(p.cam).filter((e) => e && Number.isFinite(+e.at)).sort((a, b) => a.at - b.at); let v = viewOf(lay, null, c);
  for (const e of es) { if (u < e.at) break; v = mixView(v, viewOf(lay, e, c), E.move(seg(u, e.at, e.at + num(e.dur, 0.9)))); }
  const z = p.zoom; let kz = 0;
  if (z && lay.nodes[z.node]) { const n = lay.nodes[z.node], dur = num(z.dur, 1.1), out = num(z.out, Infinity); kz = E.move(seg(u, num(z.at), num(z.at) + dur)) * (1 - E.move(seg(u, out, out + dur)));
    if (kz > 0) { v = mixView(v, { cx: n.cx, cy: n.cy, k: Math.max(c.W / Math.max(1, n.w), c.H / Math.max(1, n.h)) * 1.6 }, kz); } }
  return { ...v, kz };
}
function nodeShape(n, kind, fill, stroke, sw) {
  const { x, y, w, h } = n;
  if (kind === 'io') return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${f2(sw)}"/>`;
  if (kind === 'decision') { const d = h * 0.3; return `<polygon points="${[[x + d, y], [x + w - d, y], [x + w, y + h / 2], [x + w - d, y + h], [x + d, y + h], [x, y + h / 2]].map((q) => q.map(f2).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${f2(sw)}"/>`; }
  if (kind === 'store') { const e = h * 0.14; return `<path d="M${f2(x)} ${f2(y + e)} A${f2(w / 2)} ${f2(e)} 0 0 1 ${f2(x + w)} ${f2(y + e)} V${f2(y + h - e)} A${f2(w / 2)} ${f2(e)} 0 0 1 ${f2(x)} ${f2(y + h - e)} Z" fill="${fill}" stroke="${stroke}" stroke-width="${f2(sw)}"/><path d="M${f2(x)} ${f2(y + e)} A${f2(w / 2)} ${f2(e)} 0 0 0 ${f2(x + w)} ${f2(y + e)}" fill="none" stroke="${stroke}" stroke-width="${f2(sw)}"/>`; }
  return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(Math.min(18, h * 0.18))}" fill="${fill}" stroke="${stroke}" stroke-width="${f2(sw)}"/>`;
}
/* the diagram body (groups, edges, nodes, notes) of one layout at local time u; used for the main diagram and the zoomed sub-diagram */
function drawGraph(lay, p, u, s, { appear, emph = () => 1, ring = () => 0, flowOn = () => 0, fillOf = () => p.node, labelOp = () => 1, notes = [] }) {
  let g = ''; const nh = lay.nodeH || 80, fs = Math.min(nh * (lay.dir === 'TB' ? 0.36 : 0.32), 44 * s), sw = 2.5 * s;
  for (const gr of Object.values(lay.groups)) { const t0 = Math.min(...gr.members.map((m) => appear[m])); if (!(u >= t0)) continue; const a = E.soft(seg(u, t0, t0 + 0.4)), e = Math.max(...gr.members.map(emph));
    g += `<g opacity="${f2(a * e)}"><rect x="${f2(gr.x)}" y="${f2(gr.y)}" width="${f2(gr.w)}" height="${f2(gr.h)}" rx="${f2(16 * s)}" fill="${p.accent}" fill-opacity="0.05" stroke="${p.accent}" stroke-opacity="0.45" stroke-width="${f2(2 * s)}" stroke-dasharray="${f2(10 * s)} ${f2(8 * s)}"/>` + text(gr.label || gr.id, gr.x + 16 * s, gr.y + fs * 1.05, { size: fs * 0.72, weight: 800, fill: p.accent, ls: 0.5 * s }) + '</g>'; }
  for (const e of lay.edges) { const t0 = Math.max(appear[e.from], appear[e.to]) + 0.12; if (!(u >= t0)) continue; const k = E.soft(seg(u, t0, t0 + 0.5)), em = Math.min(emph(e.from), emph(e.to)), col = mixHex(p.line, p.accent, Math.min(ring(e.from), ring(e.to)));
    g += `<g opacity="${f2(em)}"><path d="${e.d}" fill="none" stroke="${col}" stroke-width="${f2(3 * s)}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - k))}"${e.back ? ` stroke-opacity="0.7"` : ''}/>` + arrowHead(e.segs.at(-1), 16 * s, col, seg(k, 0.85, 1));
    const fo = flowOn(e); if (fo > 0) g += flowSVG(e.segs, e.d, u, { color: p.accent, width: 4 * s, op: fo, s });
    if (e.label) { const lw = measure(e.label, fs * 0.66, { weight: 700 }) + 20 * s; g += `<g opacity="${f2(seg(k, 0.6, 1))}"><rect x="${f2(e.mid[0] - lw / 2)}" y="${f2(e.mid[1] - fs * 0.62)}" width="${f2(lw)}" height="${f2(fs * 1.1)}" rx="${f2(fs * 0.55)}" fill="${p.paper}" stroke="${col}" stroke-width="${f2(1.5 * s)}"/>` + text(e.label, e.mid[0], e.mid[1] + fs * 0.22, { size: fs * 0.66, weight: 700, fill: p.ink, anchor: 'middle' }) + '</g>'; }
    g += '</g>'; }
  for (const n of Object.values(lay.nodes)) { const t0 = appear[n.id]; if (!(u >= t0)) continue; const a = E.hero(seg(u, t0, t0 + 0.4)), sc = 0.86 + 0.14 * a, r = ring(n.id), fill = fillOf(n.id);
    const ic = n.icon ? Math.min(nh * 0.42, n.w * 0.16) : 0, tx = n.cx + (ic ? ic * 0.55 : 0), ls = wrap(n.label, n.w * 0.84 - ic * 1.2, fs, { max: 2 }), lh = fs * 1.15, ty = n.cy - ((ls.length - 1) * lh) / 2 + fs * 0.35, ink = inkOn(fill, p.ink, '#FFFFFF');
    g += `<g opacity="${f2(a * emph(n.id))}" transform="translate(${f2(n.cx)} ${f2(n.cy)}) scale(${sc.toFixed(4)}) translate(${f2(-n.cx)} ${f2(-n.cy)})">` + nodeShape(n, n.kind, fill, mixHex(p.line, p.accent, r), sw + r * 2 * s)
      + (ic ? iconSVG(n.icon, n.x + Math.max(ic * 0.9, n.w * 0.12), n.cy, ic, p.accent, 1, 2.2) : '') + `<g opacity="${f2(labelOp(n.id))}">` + lines(ls, tx, ty, fs, lh, { weight: 700, fill: ink, anchor: 'middle' }) + '</g></g>'; }
  for (const q of notes) { const n = lay.nodes[q.node]; if (!n) continue; const a = num(q.at), b = a + num(q.dur, 2.4); if (u < a || u > b + 0.3) continue; const k = E.hero(seg(u, a, a + 0.3)) * (1 - seg(u, b, b + 0.3)), ns = fs * 0.78, w = measure(q.text, ns, { weight: 700 }) + 30 * s, x = n.cx - w / 2, y = n.y - ns * 2.1 - 6 * s * (1 - k);
    g += `<g opacity="${f2(k)}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(ns * 1.6)}" rx="${f2(ns * 0.8)}" fill="${p.accent}"/>` + text(q.text, n.cx, y + ns * 1.12, { size: ns, weight: 700, fill: inkOn(p.accent), anchor: 'middle' }) + '</g>'; }
  return g;
}
function graphSVG(L, p, c) {
  const s = c.s * num(p.size, 1), u = L.u, box = bx(p.box, c), lay = graphOf(p.spec, p.dir, box), appear = appearTimes(lay, p);
  const F = stateAt(p.focus, u), tg = (e, id) => (!e || !e.ids || e.ids === 'all' ? 1 : inIds(e.ids, id) ? 1 : num(p.dim, 0.22)), rg = (e, id) => (!e || !e.ids || e.ids === 'all' ? 0 : inIds(e.ids, id) ? 1 : 0), fk = F.cur ? E.soft(seg(u, F.cur.at, F.cur.at + 0.35)) : 1;
  const emph = (id) => lerp(tg(F.prev, id), tg(F.cur, id), fk), ring = (id) => lerp(rg(F.prev, id), rg(F.cur, id), fk);
  const flows = list(p.flow), flowOn = (e) => { let o = 0; for (const f of flows) { if (!(f.edges === 'all' || inIds(f.edges, e.id))) continue; const a = num(f.at), b = num(f.until, Infinity); o = Math.max(o, seg(u, a, a + 0.3) * (1 - seg(u, b, b + 0.3))); } return o; };
  const V = camAt(lay, p, u, c), z = p.zoom && lay.nodes[p.zoom.node] ? p.zoom : null, kz = V.kz;
  const fillOf = (id) => (z && id === z.node ? mixHex(p.node, p.zoomFill, seg(kz, 0.1, 0.7)) : p.node), labelOp = (id) => (z && id === z.node ? 1 - seg(kz, 0.2, 0.6) : 1);
  const [bx0, by0, bw, bh] = lay.box, ax = lerp(bx0 + bw / 2, c.W / 2, kz), ay = lerp(by0 + bh / 2, c.H / 2, kz), tf = `translate(${f2(ax)} ${f2(ay)}) scale(${V.k.toFixed(5)}) translate(${f2(-V.cx)} ${f2(-V.cy)})`;
  let g = `<g transform="${tf}">${drawGraph(lay, p, u, s, { appear, emph, ring, flowOn, fillOf, labelOp, notes: list(p.notes) })}</g>`;
  if (z && kz > 0.75) { const zat = num(z.at) + num(z.dur, 1.1), out = num(z.out, Infinity), op = seg(u, zat - 0.15, zat + 0.35) * (1 - seg(u, out - 0.35, out));
    g += `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="${p.zoomFill}" opacity="${f2(seg(kz, 0.75, 0.98))}"/>`;
    if (op > 0) { const sb = bx(z.box || p.box, c), sl = graphOf(z.spec || DIAG_SPEC, z.dir || p.dir, sb), sa = Object.fromEntries(Object.entries(sl.nodes).map(([id, n]) => [id, zat + n.layer * num(z.reveal, 0.32)]));
      const sub = { ...p, node: '#FFFFFF' }, title = z.title ?? 'Inside: ' + (lay.nodes[z.node].label || z.node);
      g += `<g opacity="${f2(op)}">` + text(title, sb[0], Math.max(c.safe.y0 + 44 * s, sb[1] - 30 * s), { size: 44 * s, weight: 800, fill: p.ink }) + drawGraph(sl, sub, u, s, { appear: sa, flowOn: (e) => seg(u, zat + 1.2, zat + 1.5) * (1 - seg(u, out - 0.4, out)), notes: list(z.notes) }) + '</g>'; } }
  return `<g opacity="${f2((1 - L.out) * Math.max(0.0001, E.soft(L.in)))}">${g}</g>`;
}
export function diagramTimes(p0, c = { W: 1920, H: 1080, s: 1 }) {
  const p = { ...DIAG_D, ...p0 }, lay = graphOf(p.spec, p.dir, bx(p.box, c)), ap = appearTimes(lay, p), ids = Object.keys(lay.nodes).filter((id) => Number.isFinite(ap[id])).sort((a, b) => ap[a] - ap[b] || a.localeCompare(b));
  return { nodes: ids.map((id) => [id, ap[id]]), cam: list(p.cam).filter((e) => e && Number.isFinite(+e.at)).map((e) => +e.at), zoom: p.zoom ? [num(p.zoom.at), num(p.zoom.out, NaN)].filter(Number.isFinite) : [],
    flow: list(p.flow).map((f) => num(f.at)), notes: [...list(p.notes), ...list(p.zoom?.notes)].map((q) => num(q.at)), problems: (typeof p.spec === 'string' ? parseGraph(p.spec) : parseGraph(p.spec)).problems };
}

/* ---------- diagram.flow ---------- */
function flowPart(L, p, c) {
  const s = c.s * num(p.size, 1), a = [num(p.from?.[0], 0.2) * c.W, num(p.from?.[1], 0.5) * c.H], b = [num(p.to?.[0], 0.8) * c.W, num(p.to?.[1], 0.5) * c.H], dx = b[0] - a[0], dy = b[1] - a[1], bend = num(p.bend, 0.2);
  const n = [-dy * bend, dx * bend], seg4 = [a, [a[0] + dx / 3 + n[0], a[1] + dy / 3 + n[1]], [a[0] + (2 * dx) / 3 + n[0], a[1] + (2 * dy) / 3 + n[1]], b], d = `M${f2(a[0])} ${f2(a[1])} C${seg4.slice(1).map((q) => q.map(f2).join(' ')).join(' ')}`;
  const k = E.soft(seg(L.u, 0, num(p.draw, 0.6))), fo = seg(L.u, num(p.draw, 0.6), num(p.draw, 0.6) + 0.3), w = num(p.width, 5) * s;
  let g = `<path d="${d}" fill="none" stroke="${p.line}" stroke-width="${f2(w)}" stroke-linecap="round" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - k))}"/>` + arrowHead(seg4, 18 * s, p.line, seg(k, 0.85, 1));
  g += flowSVG([seg4], d, L.u, { color: p.color, width: w * 0.8, rate: num(p.rate, 0.6), dots: p.dots, op: fo, s });
  if (p.label) { const mid = pathAt([seg4], 0.5); g += text(p.label, mid[0], mid[1] - 22 * s, { size: 30 * s, weight: 700, fill: p.ink, anchor: 'middle', op: fo }); }
  return `<g opacity="${f2(1 - L.out)}">${g}</g>`;
}

/* ---------- layout.scrolly ---------- */
export function scrollyGeom(p, c) {
  const s = c.s * num(p.size, 1), [X, Y, Wb, Hb] = bx(p.box, c), fs = 34 * s, lh = fs * 1.3, pad = 28 * s, gap = 26 * s; let y = 0;
  const cards = list(p.steps, 24).map((st) => { const ls = wrap(st?.text ?? '', Wb - 2 * pad - 10 * s, fs, { weight: 700, max: 5 }), h = ls.length * lh + 2 * pad, cd = { at: num(st?.at), ls, y, h }; y += h + gap; return cd; });
  return { s, X, Y, Wb, Hb, fs, lh, pad, cards, focusY: Hb * clamp(num(p.focus, 0.4), 0.1, 0.9) };
}
function scrollySVG(L, p, c) {
  const G = scrollyGeom(p, c), { s, X, Y, Wb, Hb, cards } = G, u = L.u; if (!cards.length) return '';
  const tgt = (i) => cards[i].y + cards[i].h / 2 - G.focusY; let off = tgt(0) - Hb * 0.6, act = -1;
  cards.forEach((cd, i) => { if (u >= cd.at) { off = lerp(off, tgt(i), E.move(seg(u, cd.at, cd.at + 0.7))); act = i; } });
  const clip = `sc${Math.round(X)}x${Math.round(Y)}`; let g = `<defs><clipPath id="${clip}"><rect x="${f2(X - 12 * s)}" y="${f2(Y)}" width="${f2(Wb + 24 * s)}" height="${f2(Hb)}"/></clipPath></defs><g clip-path="url(#${clip})">`;
  cards.forEach((cd, i) => { const y = Y + cd.y - off; if (y > Y + Hb || y + cd.h < Y) return; const on = i === act ? E.soft(seg(u, cd.at, cd.at + 0.35)) : i === act - 1 ? 1 - E.soft(seg(u, cards[act].at, cards[act].at + 0.35)) : 0, o = 0.32 + 0.68 * on;
    g += `<g opacity="${f2(o)}">${p.card ? `<rect x="${f2(X)}" y="${f2(y)}" width="${f2(Wb)}" height="${f2(cd.h)}" rx="${f2(14 * s)}" fill="${p.paper}" stroke="${p.ink}" stroke-opacity="0.12" stroke-width="${f2(2 * s)}"/>` : ''}`
      + `<rect x="${f2(X)}" y="${f2(y)}" width="${f2(8 * s)}" height="${f2(cd.h)}" rx="${f2(4 * s)}" fill="${p.accent}" opacity="${f2(on)}"/>` + lines(cd.ls, X + G.pad + 10 * s, y + G.pad + G.fs * 0.9, G.fs, G.lh, { weight: 700, fill: p.ink }) + '</g>'; });
  g += '</g>';
  const rx = X - 30 * s, n = cards.length, rh = Math.min(Hb * 0.5, n * 40 * s), ry = Y + G.focusY - rh / 2;
  g += `<line x1="${f2(rx)}" x2="${f2(rx)}" y1="${f2(ry)}" y2="${f2(ry + rh)}" stroke="${p.ink}" stroke-opacity="0.15" stroke-width="${f2(3 * s)}"/>`;
  for (let i = 0; i < n; i++) { const yy = ry + (n > 1 ? (i * rh) / (n - 1) : rh / 2); g += `<circle cx="${f2(rx)}" cy="${f2(yy)}" r="${f2((i === act ? 9 : 6) * s)}" fill="${i <= act ? p.accent : p.paper}" stroke="${i <= act ? p.accent : p.ink}" stroke-opacity="${i <= act ? 1 : 0.3}" stroke-width="${f2(2 * s)}"/>`; }
  return `<g opacity="${f2(L.k)}">${g}</g>`;
}

/* ---------- title.takeaway ---------- */
function takeawaySVG(L, p, c) {
  const S = c.safe, s = c.s * num(p.size, 1), u = L.u, w = (S.x1 - S.x0) * 0.84, fs = (c.tall ? 76 : 72) * s, ls = wrap(p.line, w, fs, { weight: 800, max: 4 }), lh = fs * 1.15, hTot = ls.length * lh + 90 * s;
  const x = S.x0 + (S.x1 - S.x0 - w) / 2, y0 = p.pos === 't' ? S.y0 + 40 * s : (S.y0 + S.y1) / 2 - hTot / 2, rule = E.hero(seg(u, 0, 0.5));
  let g = p.paper ? `<rect x="${f2(x - 50 * s)}" y="${f2(y0 - 60 * s)}" width="${f2(w + 100 * s)}" height="${f2(hTot + 120 * s)}" rx="${f2(22 * s)}" fill="${p.paper}"/>` : '';
  g += `<rect x="${f2(x)}" y="${f2(y0)}" width="${f2(120 * s * rule)}" height="${f2(8 * s)}" rx="${f2(4 * s)}" fill="${p.accent}"/>` + text(p.kicker, x, y0 + 52 * s, { size: 30 * s, weight: 800, fill: p.accent, ls: 2 * s, op: rule });
  /* one <text> per line, one <tspan> per word: the browser spaces the words (no estimated advances), each word fades in on its own time and its line rises once */
  let wi = 0; ls.forEach((l, li) => { const ws = l.split(' '), k0 = E.hero(seg(u, 0.25 + wi * 0.07, 0.6 + wi * 0.07)), sp = ws.map((w, j) => `<tspan fill-opacity="${f2(E.hero(seg(u, 0.25 + (wi + j) * 0.07, 0.6 + (wi + j) * 0.07)))}">${esc(w)}${j < ws.length - 1 ? ' ' : ''}</tspan>`).join('');
    g += `<text x="${f2(x)}" y="${f2(y0 + 90 * s + (li + 0.8) * lh + 18 * s * (1 - k0))}" font-family="${esc(FONT)}" font-size="${f2(fs)}" font-weight="800" fill="${p.ink}" xml:space="preserve">${sp}</text>`; wi += ws.length; });
  return `<g opacity="${f2(1 - L.out)}">${g}</g>`;
}

/* ---------- process.steps ---------- */
const STEPS_D = { steps: [{ title: 'Gather', icon: 'search' }, { title: 'Prepare', icon: 'gear' }, { title: 'Wait', icon: 'timer' }, { title: 'Serve', icon: 'cup' }], active: [], layout: 'auto', box: [0.08, 0.3, 0.84, 0.44],
  accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', muted: '#B8B2A7', stagger: 0.08, size: 1 };
export const stepActive = (p, u) => { const a = list(p.active).filter((q) => Array.isArray(q)); if (!a.length) { const n = list(p.steps, 12).length; return Math.min(n, Math.max(-1, Math.floor((u - 0.5) / 1.1))); } let k = -1; for (const [t, i] of a) if (u >= num(t)) k = Math.trunc(num(i)); return k; };
function stepsSVG(L, p, c) {
  const s = c.s * num(p.size, 1), u = L.u, st = list(p.steps, 12), n = st.length; if (!n) return ''; const [X, Y, Wb, Hb] = bx(p.box, c), col = p.layout === 'column' || (p.layout === 'auto' && c.tall), act = stepActive(p, u);
  const at = list(p.active).filter((q) => Array.isArray(q)), tOf = (i) => { const q = at.find((x) => Math.trunc(num(x[1])) === i); return q ? num(q[0]) : 0.5 + i * 1.1; };
  const R = col ? Math.min((Hb / n) * 0.26, 56 * s) : Math.min((Wb / n) * 0.17, 70 * s), P = st.map((_, i) => (col ? [X + R + 4 * s, Y + ((i + 0.5) * Hb) / n] : [X + ((i + 0.5) * Wb) / n, Y + Hb * 0.48]));
  let g = ''; const stg = clamp(num(p.stagger, 0.08), 0, 3), ent = (i) => E.hero(seg(u, i * stg, i * stg + 0.45));
  if (n > 1) { const [a, b] = [P[0], P[n - 1]], k = act >= n ? 1 : act <= 0 ? 0 : clamp((act - 1 + E.soft(seg(u, tOf(act), tOf(act) + 0.45))) / (n - 1));
    g += `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke="${p.muted}" stroke-width="${f2(6 * s)}" stroke-linecap="round" opacity="${f2(ent(0))}"/>`;
    if (k > 0) g += `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(lerp(a[0], b[0], k))}" y2="${f2(lerp(a[1], b[1], k))}" stroke="${p.accent}" stroke-width="${f2(6 * s)}" stroke-linecap="round"/>`; }
  st.forEach((q, i) => { const [x, y] = P[i], e = ent(i), done = i < act, on = i === act, ka = on ? E.hero(seg(u, tOf(i), tOf(i) + 0.4)) : done ? 1 : 0, pulse = on ? 1 + 0.08 * Math.sin(Math.PI * seg(u, tOf(i), tOf(i) + 0.5)) : 1;
    g += `<g opacity="${f2(e)}"><circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(R * pulse)}" fill="${done ? p.accent : p.paper}" stroke="${on || done ? p.accent : p.muted}" stroke-width="${f2((on ? 6 : 4) * s)}"/>`;
    g += done ? iconSVG('check', x, y, R * 1.1, inkOn(p.accent), 1, 3) : text(String(i + 1), x, y + R * 0.36, { size: R * 1.0, weight: 800, fill: on ? p.accent : p.ink, anchor: 'middle', op: on ? 1 : 0.6 });
    const ttl = String(q?.title ?? ''), ic = q?.icon || 'dot', tw = col ? Wb - 3.4 * R - 140 * s : Wb / n - 24 * s, fs = (col ? 42 : 36) * s, ls = wrap(ttl, tw, fs, { weight: 800, max: 2 }), tc = mixHex(p.muted, p.ink, Math.max(ka, done ? 1 : 0.25));
    if (col) { g += lines(ls, x + R + 34 * s, y + fs * 0.36 - ((ls.length - 1) * fs * 1.15) / 2, fs, fs * 1.15, { weight: 800, fill: tc }) + iconSVG(ic, X + Wb - 50 * s, y, 64 * s, on || done ? p.accent : p.muted, 0.35 + 0.65 * Math.max(ka, e * 0.6), 2); }
    else { g += iconSVG(ic, x, y - R - 70 * s, 76 * s, on || done ? p.accent : p.muted, 0.35 + 0.65 * Math.max(ka, e * 0.6), 2) + lines(ls, x, y + R + 56 * s, fs, fs * 1.15, { weight: 800, fill: tc, anchor: 'middle' }); }
    if (q?.note && on) g += text(q.note, col ? x + R + 34 * s : x, col ? y + fs * 1.5 : y + R + 56 * s + ls.length * fs * 1.15 + 6 * s, { size: 28 * s, weight: 600, fill: p.ink, anchor: col ? 'start' : 'middle', op: ka * 0.8 });
    g += '</g>'; });
  return `<g opacity="${f2(1 - L.out)}">${g}</g>`;
}

/* ---------- process.beforeAfter ---------- */
/* the geometry a template needs to put real photos in the cards: media: true leaves a window [x, y, w, h] (px) open in each card (the card is drawn around it, never over it) */
export function baGeom(p, c) {
  const s = c.s * num(p.size, 1), [X, Y, Wb, Hb] = bx(p.box, c), col = p.layout === 'column' || (p.layout === 'auto' && c.tall), gap = col ? 0.1 * Hb : 0.08 * Wb;
  const cw = col ? Wb : (Wb - gap) / 2, ch = col ? (Hb - gap) / 2 : Hb, A = [X, Y], B = col ? [X, Y + ch + gap] : [X + cw + gap, Y];
  const win = (o) => (p.media ? [o[0] + 24 * s, o[1] + 88 * s, cw - 48 * s, Math.max(40 * s, ch * num(p.mediaH, 0.5))] : null);
  return { s, col, gap, cw, ch, A, B, winA: win(A), winB: win(B) };
}
function baSVG(L, p, c) {
  const G = baGeom(p, c), { s, col, gap, cw, ch, A, B } = G, u = L.u, sw = num(p.swap, 1.4), kb = E.hero(seg(u, 0, 0.45)), ka = E.move(seg(u, sw, sw + 0.7)), [X, Y] = A;
  const card = (o, pos, k, after, clipK, win) => { const [x, y] = pos, id = `ba${after ? 'a' : 'b'}${Math.round(x)}${Math.round(y)}`, fs = 44 * s, ls = list(o?.lines, 6), chip = String(o?.label ?? (after ? 'After' : 'Before')).toUpperCase(), cwid = measure(chip, 24 * s, { weight: 800, ls: 1.5 * s }) * 1.1 + 34 * s;
    const r = 20 * s, outer = `M${f2(x + r)} ${f2(y)} H${f2(x + cw - r)} Q${f2(x + cw)} ${f2(y)} ${f2(x + cw)} ${f2(y + r)} V${f2(y + ch - r)} Q${f2(x + cw)} ${f2(y + ch)} ${f2(x + cw - r)} ${f2(y + ch)} H${f2(x + r)} Q${f2(x)} ${f2(y + ch)} ${f2(x)} ${f2(y + ch - r)} V${f2(y + r)} Q${f2(x)} ${f2(y)} ${f2(x + r)} ${f2(y)} Z`;
    const hole = win ? ` M${f2(win[0])} ${f2(win[1])} V${f2(win[1] + win[3])} H${f2(win[0] + win[2])} V${f2(win[1])} Z` : '';
    let g = `<defs><clipPath id="${id}"><rect x="${f2(x - 4 * s)}" y="${f2(y - 4 * s)}" width="${f2(col ? cw + 8 * s : (cw + 8 * s) * clipK)}" height="${f2(col ? (ch + 8 * s) * clipK : ch + 8 * s)}"/></clipPath></defs><g clip-path="url(#${id})" opacity="${f2(k)}">`;
    g += `<path d="${outer}${hole}" fill="${p.paper}" fill-rule="evenodd" stroke="${after ? p.accent : p.ink}" stroke-opacity="${after ? 0.9 : 0.15}" stroke-width="${f2((after ? 4 : 2) * s)}"/>`;
    if (win) g += `<rect x="${f2(win[0])}" y="${f2(win[1])}" width="${f2(win[2])}" height="${f2(win[3])}" fill="none" stroke="${p.ink}" stroke-opacity="0.2" stroke-width="${f2(2 * s)}"/>`;
    g += `<rect x="${f2(x + 32 * s)}" y="${f2(y + 30 * s)}" width="${f2(cwid)}" height="${f2(42 * s)}" rx="${f2(21 * s)}" fill="${after ? p.accent : p.muted}"/>` + text(chip, x + 48 * s, y + 59 * s, { size: 24 * s, weight: 800, fill: after ? inkOn(p.accent) : PAPER_INK, ls: 1.5 * s });
    const ty = win ? win[1] + win[3] + 30 * s : y + 100 * s, tl = wrap(o?.title ?? '', cw - 64 * s, fs, { weight: 800, max: 2 }); g += lines(tl, x + 32 * s, ty + fs * 0.8, fs, fs * 1.12, { weight: 800, fill: p.ink });
    let yy = ty + fs * 0.8 + tl.length * fs * 1.12 + 14 * s; for (const l of ls) { if (yy > y + ch - 24 * s) break; g += iconSVG(after ? 'check' : 'dot', x + 50 * s, yy - 10 * s, 30 * s, after ? p.accent : p.muted, 1, after ? 3 : 2) + text(l, x + 80 * s, yy, { size: 30 * s, weight: 600, fill: p.ink, op: 0.85 }); yy += 44 * s; }
    return g + '</g>'; };
  let g = card(p.before, A, kb * (1 - 0.4 * ka), false, 1, G.winA);
  if (u >= sw) { g += card(p.after, B, 1, true, ka, G.winB); const m = col ? [X + cw / 2, Y + ch + gap / 2] : [X + cw + gap / 2, Y + ch / 2], r = 22 * s * E.hero(seg(u, sw, sw + 0.35));
    g += `<circle cx="${f2(m[0])}" cy="${f2(m[1])}" r="${f2(r * 1.6)}" fill="${p.accent}"/>` + `<g transform="translate(${f2(m[0])} ${f2(m[1])}) rotate(${col ? 90 : 0})"><path d="M${f2(-r * 0.7)} 0 H${f2(r * 0.6)} M${f2(r * 0.1)} ${f2(-r * 0.55)} L${f2(r * 0.65)} 0 L${f2(r * 0.1)} ${f2(r * 0.55)}" fill="none" stroke="${inkOn(p.accent)}" stroke-width="${f2(4 * s)}" stroke-linecap="round" stroke-linejoin="round"/></g>`; }
  return `<g opacity="${f2(1 - L.out)}">${g}</g>`;
}

export const EXPLAIN = {
  'diagram.graph': { file: 'type/gfx/explain.js', tags: ['diagram', 'how-it-works', 'explainer', 'flowchart', 'nodes', 'edges', 'camera', 'zoom'], dur: 10, inF: 6, outF: 9, d: DIAG_D, svg: graphSVG },
  'diagram.flow': { file: 'type/gfx/explain.js', tags: ['diagram', 'flow', 'edge', 'arrow', 'process', 'explainer'], dur: 3, inF: 1, outF: 9,
    d: { from: [0.2, 0.5], to: [0.8, 0.5], bend: 0.2, width: 5, draw: 0.6, rate: 0.6, dots: 2, label: '', color: BRAND, line: MUTED, ink: PAPER_INK, size: 1 }, svg: flowPart },
  'layout.scrolly': { file: 'type/gfx/explain.js', tags: ['scrollytelling', 'scrolly', 'data-story', 'text', 'reveal', 'explainer'], dur: 8, inF: 8, outF: 8,
    d: { steps: [{ at: 0.3, text: 'Placeholder first beat of the story' }, { at: 2.6, text: 'Placeholder second beat, where the picture changes' }, { at: 4.9, text: 'Placeholder third beat: the turn' }], box: [0.06, 0.16, 0.34, 0.68], focus: 0.42, card: true, accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', size: 1 }, svg: scrollySVG },
  'title.takeaway': { file: 'type/gfx/explain.js', tags: ['takeaway', 'end-card', 'conclusion', 'explainer', 'data-story'], dur: 3.5, inF: 4, outF: 9,
    d: { kicker: 'THE TAKEAWAY', line: 'Placeholder takeaway line for the end', pos: 'c', accent: BRAND, ink: PAPER_INK, paper: '', size: 1 }, svg: takeawaySVG },
  'process.steps': { file: 'type/gfx/explain.js', tags: ['process', 'steps', 'how-to', 'timeline', 'icons', 'numbered'], dur: 6, inF: 6, outF: 9, d: STEPS_D, svg: stepsSVG },
  'process.beforeAfter': { file: 'type/gfx/explain.js', tags: ['before-after', 'comparison', 'process', 'how-to', 'explainer'], dur: 4, inF: 6, outF: 9,
    d: { before: { label: 'Before', title: 'Placeholder before state', lines: ['Placeholder line one', 'Placeholder line two'] }, after: { label: 'After', title: 'Placeholder after state', lines: ['Placeholder line one', 'Placeholder line two'] },
      swap: 1.4, layout: 'auto', box: [0.08, 0.2, 0.84, 0.6], media: false, mediaH: 0.5, accent: BRAND, ink: PAPER_INK, paper: '#FFFFFF', muted: '#D9D3C7', size: 1 }, svg: baSVG },
};
export const EXPLAIN_CUES = {
  'diagram.graph': (p) => { const T = diagramTimes(p), out = [];
    T.nodes.forEach(([id, t], i) => { if (!out.some((q) => Math.abs(q.t - t) < 0.12)) out.push({ t, id: i % 2 ? 'sfx/ui/tick' : 'sfx/ui/pop', why: `node ${id} lands` }); });
    for (const t of T.cam) out.push({ t, id: 'sfx/whoosh/swish_xs', why: 'camera moves to a region' }); if (T.zoom[0] != null) out.push({ t: T.zoom[0], id: 'sfx/tx/zoom_through', why: 'zoom into the node' }); if (T.zoom[1] != null) out.push({ t: T.zoom[1], id: 'sfx/whoosh/swish_s', why: 'zoom back out' });
    for (const t of T.flow) out.push({ t, id: 'sfx/ui/slide', why: 'flow starts' }); return out.sort((a, b) => a.t - b.t); },
  'diagram.flow': (p) => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'edge draws' }],
  'layout.scrolly': (p) => list(p.steps, 24).map((st, i) => ({ t: num(st?.at), id: 'sfx/ui/slide', why: 'scrolly step ' + (i + 1) })),
  'title.takeaway': () => [{ t: 0, id: 'sfx/hit/soft', why: 'takeaway lands' }],
  'process.steps': (p) => { const a = list(p.active).filter((q) => Array.isArray(q)), n = list(p.steps, 12).length, out = (a.length ? a : Array.from({ length: n }, (_, i) => [0.5 + i * 1.1, i])).map(([t, i]) => ({ t: num(t), id: Math.trunc(num(i)) >= n ? 'sfx/ui/success' : 'sfx/ui/count_tick', why: Math.trunc(num(i)) >= n ? 'all steps done' : 'step ' + (Math.trunc(num(i)) + 1) })); return out; },
  'process.beforeAfter': (p) => [{ t: 0, id: 'sfx/paper/flip', why: 'before card' }, { t: num(p.swap, 1.4), id: 'sfx/tx/mask_reveal', why: 'after wipes in' }],
};
