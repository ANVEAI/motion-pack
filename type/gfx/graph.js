/* motion-pack / type / gfx / graph.js: a deterministic layered (Sugiyama-style) layout for "how it works" diagrams (lane explainer, 2026-10-16). Pure, no DOM, no randomness.
     parseGraph(src)            a tiny text DSL or an object -> { nodes, edges, groups }   (DSL below; JSON passes through, validated)
     layoutGraph(spec, opts)    -> { nodes: { id: { x, y, w, h, cx, cy, layer, order, label, ... } }, edges: [{ id, from, to, back, d, pts, mid }], groups: { id: { x, y, w, h, label } }, box, dir, layers }
     edgeKey(e) = 'from>to'     the id templates use for flows and highlights
   THE SAME INPUT ALWAYS GIVES THE SAME PICTURE (a render seeks frames in any order and in several workers, so the layout must never depend on a clock, a hash order or a
   random tie-break): (1) cycles are broken by a depth-first walk in input order (the back edges are kept, drawn as a return arc under the row); (2) a node's layer is its
   longest path from a source (or its own `layer`); (3) order inside a layer starts in input order and runs a fixed number of median/barycentre sweeps, ties broken by the
   previous position then the input index; (4) coordinates are spread evenly in the box and rounded to 0.01 px. Limits (type/gfx/limits.js idea): at most 200 nodes and 600 edges
   are laid out; the rest are reported in `dropped`, never silently drawn wrong.

   DSL (one statement per line; # comments):
     Input -> Parse -> Answer          a chain (nodes are created on first use; the id is the label without spaces)
     Parse -> Check : "if unsure"      an edge label
     node Check "Check the facts" kind=decision group=core layer=2
     group core "The core loop"
     dir TB                            LR (default) or TB */
export const GRAPH_LIM = { nodes: 200, edges: 600, sweeps: 8 };
const idOf = (s) => String(s).trim().replace(/^"|"$/g, '').replace(/\s+/g, '_');
const unq = (s) => String(s ?? '').trim().replace(/^"(.*)"$/, '$1');
export const edgeKey = (e) => `${e.from}>${e.to}`;

export function parseGraph(src) {
  if (src && typeof src === 'object') return normGraph(src);
  const nodes = [], edges = [], groups = [], byId = new Map(); let dir = null; const problems = [];
  const touch = (raw) => { const id = idOf(raw); if (!byId.has(id)) { const n = { id, label: unq(raw) }; byId.set(id, n); nodes.push(n); } return byId.get(id); };
  String(src || '').split(/\r?\n/).forEach((line0, li) => {
    const line = line0.replace(/#.*$/, '').trim(); if (!line) return;
    let m;
    if ((m = /^dir\s+(LR|TB)$/i.exec(line))) { dir = m[1].toUpperCase(); return; }
    if ((m = /^group\s+(\S+)\s*(".*")?$/i.exec(line))) { groups.push({ id: idOf(m[1]), label: unq(m[2] ?? m[1]) }); return; }
    if ((m = /^node\s+(\S+)\s*(".*?")?\s*(.*)$/i.exec(line))) { const n = touch(m[1]); if (m[2]) n.label = unq(m[2]);
      for (const kv of (m[3] || '').match(/\w+=("[^"]*"|\S+)/g) || []) { const [k, v] = [kv.slice(0, kv.indexOf('=')), unq(kv.slice(kv.indexOf('=') + 1))]; n[k] = k === 'layer' ? +v : v; } return; }
    if (line.includes('->')) { const [chain, lab] = line.split(/\s:\s/); const parts = chain.split('->').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) { problems.push(`line ${li + 1}: an arrow needs a node on both sides`); return; }
      for (let i = 0; i + 1 < parts.length; i++) { const a = touch(parts[i]), b = touch(parts[i + 1]); edges.push({ from: a.id, to: b.id, ...(lab && i === parts.length - 2 ? { label: unq(lab) } : {}) }); } return; }
    problems.push(`line ${li + 1}: cannot read "${line}"`);
  });
  const g = normGraph({ nodes, edges, groups, ...(dir ? { dir } : {}) }); g.problems = [...problems, ...g.problems]; return g;
}
/* validate + normalise an object graph: ids unique, edges point at nodes, groups exist; problems listed, never thrown (the template turns them into exit 2) */
export function normGraph(g) {
  const problems = [], seen = new Set(), nodes = [];
  for (const n of [].concat(g.nodes || [])) { if (!n || n.id == null) { problems.push('a node has no id'); continue; } const id = String(n.id); if (seen.has(id)) { problems.push(`node "${id}" is defined twice`); continue; } seen.add(id); nodes.push({ ...n, id, label: n.label ?? id }); }
  const edges = []; for (const e of [].concat(g.edges || [])) { if (!e) continue; const from = String(e.from), to = String(e.to); if (!seen.has(from) || !seen.has(to)) { problems.push(`edge ${from} -> ${to} points at a node that does not exist`); continue; } edges.push({ ...e, from, to }); }
  const groups = [].concat(g.groups || []).map((x) => ({ ...x, id: String(x.id) })), gids = new Set(groups.map((x) => x.id));
  for (const n of nodes) if (n.group != null && !gids.has(String(n.group))) { groups.push({ id: String(n.group), label: String(n.group) }); gids.add(String(n.group)); }
  return { ...g, nodes, edges, groups, problems };
}

/* longest-path layering on the acyclic part; back edges found by an iterative DFS in input order */
function layering(nodes, edges) {
  const idx = new Map(nodes.map((n, i) => [n.id, i])), out = nodes.map(() => []), back = new Set();
  edges.forEach((e, k) => { if (e.from !== e.to) out[idx.get(e.from)].push(k); else back.add(k); });
  const state = new Array(nodes.length).fill(0);   // 0 new, 1 on stack, 2 done
  for (let s = 0; s < nodes.length; s++) { if (state[s]) continue; const stack = [[s, 0]]; state[s] = 1;
    while (stack.length) { const top = stack[stack.length - 1], [v, i] = top; if (i >= out[v].length) { state[v] = 2; stack.pop(); continue; } top[1]++;
      const k = out[v][i], w = idx.get(edges[k].to); if (state[w] === 1) back.add(k); else if (state[w] === 0) { state[w] = 1; stack.push([w, 0]); } } }
  /* Kahn order over forward edges, then longest path */
  const indeg = nodes.map(() => 0), fwd = nodes.map(() => []);
  edges.forEach((e, k) => { if (back.has(k)) return; const a = idx.get(e.from), b = idx.get(e.to); fwd[a].push(b); indeg[b]++; });
  const layer = nodes.map((n) => (Number.isFinite(+n.layer) && n.layer !== '' && n.layer != null ? Math.max(0, Math.min(60, Math.trunc(+n.layer))) : 0)), fixed = nodes.map((n) => n.layer != null && n.layer !== '' && Number.isFinite(+n.layer));
  const q = []; indeg.forEach((d, i) => { if (!d) q.push(i); });
  for (let h = 0; h < q.length; h++) { const v = q[h]; for (const w of fwd[v]) { if (!fixed[w]) layer[w] = Math.max(layer[w], layer[v] + 1); if (--indeg[w] === 0) q.push(w); } }
  return { layer, back, idx };
}

export function layoutGraph(spec0, { dir, box = [0, 0, 1920, 1080], nodeW = null, nodeH = null, sweeps = 4, pad = 0.5 } = {}) {
  const spec = spec0 && spec0.nodes ? spec0 : parseGraph(spec0), D = String(dir || spec.dir || 'LR').toUpperCase() === 'TB' ? 'TB' : 'LR';
  const dropped = { nodes: Math.max(0, spec.nodes.length - GRAPH_LIM.nodes), edges: 0 };
  const nodes = spec.nodes.slice(0, GRAPH_LIM.nodes), keep = new Set(nodes.map((n) => n.id));
  const edges0 = spec.edges.filter((e) => keep.has(e.from) && keep.has(e.to)); dropped.edges = Math.max(0, spec.edges.length - Math.min(edges0.length, GRAPH_LIM.edges)); const edges = edges0.slice(0, GRAPH_LIM.edges);
  const [bx, by, bw, bh] = box.map((v) => (Number.isFinite(+v) ? +v : 0));
  if (!nodes.length) return { nodes: {}, edges: [], groups: {}, box: [bx, by, bw, bh], dir: D, layers: [], dropped };
  const { layer, back, idx } = layering(nodes, edges);
  const L = Math.max(...layer) + 1, rows = Array.from({ length: L }, () => []);
  /* vertices = the nodes, then one dummy per layer an edge skips over (so a long edge gets its own slot and never runs through a node); at most 1000 dummies */
  const V = nodes.map((n, i) => ({ node: i, layer: layer[i] })), chain = new Map();
  edges.forEach((e, k) => { if (back.has(k)) return; const a = idx.get(e.from), b = idx.get(e.to); if (layer[b] - layer[a] < 2 || V.length - nodes.length > 1000) return;
    const ids = []; for (let l = layer[a] + 1; l < layer[b]; l++) { ids.push(V.length); V.push({ dummy: k, layer: l }); } chain.set(k, ids); });
  V.forEach((v, i) => rows[v.layer].push(i));
  const up = V.map(() => []), down = V.map(() => []), link = (a, b) => { down[a].push(b); up[b].push(a); };
  edges.forEach((e, k) => { if (back.has(k)) return; const a = idx.get(e.from), b = idx.get(e.to); if (layer[b] <= layer[a]) return; const path = [a, ...(chain.get(k) || []), b]; for (let i = 0; i + 1 < path.length; i++) link(path[i], path[i + 1]); });
  const pos = new Array(V.length).fill(0);
  rows.forEach((r) => r.forEach((v, j) => { pos[v] = j; }));
  const S = Math.max(0, Math.min(GRAPH_LIM.sweeps, Math.trunc(+sweeps || 0)));
  for (let it = 0; it < S; it++) {
    const goDown = it % 2 === 0, order = goDown ? rows.map((_, i) => i).slice(1) : rows.map((_, i) => i).reverse().slice(1);
    for (const li of order) { const nb = goDown ? up : down;
      const key = rows[li].map((v) => { const ns = nb[v]; const bc = ns.length ? ns.reduce((a, w) => a + pos[w], 0) / ns.length : pos[v]; return [bc, pos[v], v]; });
      key.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]); rows[li] = key.map((k) => k[2]); rows[li].forEach((v, j) => { pos[v] = j; }); }
  }
  /* geometry: main axis = layers, cross axis = order (dummies take a thinner slot) */
  const realN = rows.map((r) => r.filter((v) => V[v].node !== undefined).length), dumN = rows.map((r, i) => r.length - realN[i]);
  const along = D === 'LR' ? bw : bh, across = D === 'LR' ? bh : bw, step = along / L, units = Math.max(1, ...rows.map((r, i) => realN[i] + dumN[i] * 0.35)), cell = across / units;
  const nw = nodeW ?? (D === 'LR' ? Math.min(step * 0.7, bw * 0.32) : Math.min(cell * 0.8, bw * 0.3)), nh = nodeH ?? (D === 'LR' ? Math.min(cell * 0.62, nw * 0.46, bh * 0.3) : Math.min(step * 0.56, nw * 0.5));
  const r2 = (v) => Math.round(v * 100) / 100, out = {}, VP = new Array(V.length);
  rows.forEach((r, li) => { const span = (realN[li] + dumN[li] * 0.35) * cell; let c = (across - span) / 2;
    r.forEach((v, j) => { const wdt = (V[v].node !== undefined ? 1 : 0.35) * cell, mid = c + wdt / 2; c += wdt; const a = (li + pad) * step, cx = D === 'LR' ? bx + a : bx + mid, cy = D === 'LR' ? by + mid : by + a; VP[v] = [cx, cy];
      if (V[v].node === undefined) return; const nd = nodes[V[v].node];
      out[nd.id] = { ...nd, x: r2(cx - nw / 2), y: r2(cy - nh / 2), w: r2(nw), h: r2(nh), cx: r2(cx), cy: r2(cy), layer: li, order: j, index: V[v].node }; }); });
  /* edges: cubic segments from the exit side, through each dummy slot, to the entry side; a back edge loops outside the row */
  const E = edges.map((e, k) => { const a = out[e.from], b = out[e.to], isBack = back.has(k); let segs;
    const side = (n, end) => (D === 'LR' ? [end ? n.x : n.x + n.w, n.cy] : [n.cx, end ? n.y : n.y + n.h]);
    if (e.from === e.to) { const p0 = [a.cx - a.w * 0.2, a.y], p3 = [a.cx + a.w * 0.2, a.y]; segs = [[p0, [p0[0] - a.w * 0.2, p0[1] - a.h], [p3[0] + a.w * 0.2, p3[1] - a.h], p3]]; }
    else if (isBack || layer[idx.get(e.to)] <= layer[idx.get(e.from)]) {
      if (D === 'LR') { const p0 = [a.cx, a.y + a.h], p3 = [b.cx, b.y + b.h], dy = Math.max(a.h, b.h) * 1.1 + Math.abs(a.cx - b.cx) * 0.12; segs = [[p0, [p0[0], p0[1] + dy], [p3[0], p3[1] + dy], p3]]; }
      else { const p0 = [a.x + a.w, a.cy], p3 = [b.x + b.w, b.cy], dx = Math.max(a.w, b.w) * 0.6 + Math.abs(a.cy - b.cy) * 0.12; segs = [[p0, [p0[0] + dx, p0[1]], [p3[0] + dx, p3[1]], p3]]; } }
    else { const way = [side(a, false), ...(chain.get(k) || []).map((v) => VP[v]), side(b, true)]; segs = [];
      for (let i = 0; i + 1 < way.length; i++) { const p0 = way[i], p3 = way[i + 1], dm = D === 'LR' ? Math.max(20, (p3[0] - p0[0]) * 0.5) : Math.max(20, (p3[1] - p0[1]) * 0.5);
        segs.push(D === 'LR' ? [p0, [p0[0] + dm, p0[1]], [p3[0] - dm, p3[1]], p3] : [p0, [p0[0], p0[1] + dm], [p3[0], p3[1] - dm], p3]); } }
    segs = segs.map((sg) => sg.map((p) => p.map(r2)));
    const d = segs.map((sg, i) => `${i ? '' : `M${sg[0][0]} ${sg[0][1]} `}C${sg[1][0]} ${sg[1][1]} ${sg[2][0]} ${sg[2][1]} ${sg[3][0]} ${sg[3][1]}`).join(' ');
    return { ...e, id: edgeKey(e), back: isBack, segs, pts: segs[0], d, mid: pathAt(segs, 0.5).map(r2), len: r2(pathLen(segs)) }; });
  /* groups: the members' bounds plus a margin for the label */
  const G = {}; for (const g of spec.groups || []) { const ms = Object.values(out).filter((n) => String(n.group) === g.id); if (!ms.length) continue;
    const m = Math.min(nw, nh) * 0.28, lab = nh * 0.42, x0 = Math.min(...ms.map((n) => n.x)) - m, y0 = Math.min(...ms.map((n) => n.y)) - m - lab, x1 = Math.max(...ms.map((n) => n.x + n.w)) + m, y1 = Math.max(...ms.map((n) => n.y + n.h)) + m;
    G[g.id] = { ...g, x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0), members: ms.map((n) => n.id) }; }
  return { nodes: out, edges: E, groups: G, box: [bx, by, bw, bh], dir: D, layers: rows.map((r) => r.filter((v) => V[v].node !== undefined).map((v) => nodes[V[v].node].id)), dropped, nodeW: r2(nw), nodeH: r2(nh) };
}
/* a point / tangent on a cubic, and an arc-length table for even flow dots */
export function bez(P, t) { const u = 1 - t; return [0, 1].map((k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); }
export function bezLen(P, n = 24) { let L = 0, prev = P[0]; for (let i = 1; i <= n; i++) { const q = bez(P, i / n); L += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; } return L; }
/* a path of cubic segments: total length, and the point at a fraction of the length (segments weighted by their own length; within one, by the curve parameter) */
export const pathLen = (segs) => segs.reduce((a, sg) => a + bezLen(sg, 16), 0);
export function pathAt(segs, f) { if (!segs || !segs.length) return [0, 0]; const ls = segs.map((sg) => bezLen(sg, 16)), T = ls.reduce((a, b) => a + b, 0) || 1; let d = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0)) * T;
  for (let i = 0; i < segs.length; i++) { if (d <= ls[i] || i === segs.length - 1) return bez(segs[i], ls[i] ? Math.min(1, d / ls[i]) : 0); d -= ls[i]; } return segs.at(-1)[3]; }
/* bounds of a set of laid-out nodes (all when ids is empty / 'all') */
export function boundsOf(lay, ids) {
  const list = !ids || ids === 'all' || (Array.isArray(ids) && !ids.length) ? Object.values(lay.nodes) : [].concat(ids).map((i) => lay.nodes[i] || (lay.groups[i])).filter(Boolean);
  if (!list.length) return [lay.box[0], lay.box[1], lay.box[2], lay.box[3]];
  const x0 = Math.min(...list.map((n) => n.x)), y0 = Math.min(...list.map((n) => n.y)), x1 = Math.max(...list.map((n) => n.x + n.w)), y1 = Math.max(...list.map((n) => n.y + n.h));
  return [x0, y0, x1 - x0, y1 - y0];
}
