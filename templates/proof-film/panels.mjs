/* templates/proof-film/panels.mjs: the panels of the proof film and its ONE camera (pure: node + browser, no DOM, no clock, no Math.random).
   Every panel is a full-frame SVG string drawn in its own cell of a continuous world: stage(plan, st, t) -> inner SVG of that cell at composition time t.
   The builder (chart.scatterFrontier | ui.branchTrace | ui.dataTable) and the head-to-head table are the pack's own gfx parts (type/gfx/ui-proof.js, ui-trace.js: they print
   their own source / method / illustrative notes); the claim, name, method card, big numbers, stat cards and end card are drawn here. Every number printed here prints its
   `source` and `method` beside it, and the ILLUSTRATIVE pill (the honesty label: mono, at least 28 px on 16:9 and 30 px on 9:16, frame-design frames.md section 5) sits at the SAME place on every number panel:
   the bottom-left of the safe rect, fading in with the panel (honesty.mjs refuses a number without source and method).
   Sizes are in 1080-unit px from the SHORTER frame side, so 16:9 and 9:16 share one type size; the content sits in the platform safe rect (type/safezones.js).
   cameraFor(plan) -> { zoom(t), pan(t) }: two nested cam2d state functions. `pan` (the world wrapper) is one cam2d pan2d leg per stage change; `zoom` (a frame-sized wrapper
   around it, scaled about the frame centre = the focus) dips while the camera travels and pushes in slowly while it dwells, so the cell of the stage in view always projects to
   the frame centre when the camera rests (mapCell is the test of that). The same module runs in the page (assets/mp/templates/proof-film/) and in node: it only imports pack
   modules by relative paths that exist in both layouts. */
import { E, clamp, seg, FONT, MONO, f2, text, measure, ctxFor } from '../../type/gfx/core.js';
import { safeRect } from '../../type/safezones.js';
import { spring } from '../../type/ease.js';
import { KIT } from '../../type/gfx/ui.js';
import { renderInner, fmtUnit } from '../../type/gfx/index.js';
import { ID2, c2, pan2d } from '../../camera/cam2d.js';
import { E as CE } from '../../camera/ease.js';
const { rect, softShadow, shadowDef, op } = KIT;

/* ---------- layout + palette ---------- */
/* the platform safe rect, pulled in by the camera's dwell push: a point at x lands at W/2 + s * (x - W/2) after a push of s, so the content may only use the part of the safe rect that still fits then */
export function safeInset(zone, W, H, push = 0) {
  const S = safeRect(zone, W, H), s = 1 + push, x0 = W / 2 + (S.x0 - W / 2) / s, x1 = W / 2 + (S.x1 - W / 2) / s, y0 = H / 2 + (S.y0 - H / 2) / s, y1 = H / 2 + (S.y1 - H / 2) / s;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, scale: S.scale };
}
export function layout(plan) {
  const { W, H } = plan, S = safeInset(plan.safeZone, W, H, plan.camera.push), ctx = { ...ctxFor(W, H, plan.safeZone, 1), safe: S }, u = Math.min(W, H) / 1080, B = plan.brand;
  const T = { ink: B.ink, muted: B.muted, accent: B.accent, paper: B.paper, panel: '#FFFFFF', line: '#E3E0E7', faint: '#C8C5CE', chip: '#F0EEF4' };
  return { W, H, u, ctx, S, T, tall: H > W, plan, cx: (S.x0 + S.x1) / 2, cy: (S.y0 + S.y1) / 2 };
}
const distinct = (a) => [...new Set(a.map((v) => String(v ?? '').trim()).filter(Boolean))];
const fade = (k) => op(clamp(k));
/* greedy wrap by measured width (the kit's wrapWords measures the sans face only: mono needs its own font) */
function wrapLines(str, size, weight, maxW, font = FONT, ls = 0) {
  const out = []; let cur = '';
  for (const w of String(str).split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, size, { weight, font, ls }) > maxW) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
/* balanced wrap: the greedy line count, at the narrowest width that keeps it (no one-word orphan line) */
function balanced(str, size, weight, maxW, ls = 0) {
  const g = wrapLines(str, size, weight, maxW, FONT, ls), n = g.length; if (n < 2) return g;
  for (let w = maxW * 0.5; w < maxW; w += size * 0.25) { const t = wrapLines(str, size, weight, w, FONT, ls); if (t.length === n) return t; } return g;
}
const fmtN = (n, v) => fmtUnit(v, n.unit ?? '', n.dec ?? (Number.isInteger(n.value) ? 0 : 1));
const cardBox = (L, id, x, y, w, h, r, k = 1) => softShadow(id, x, y, w, h, r, L.u, 0.8 * clamp(k)) + rect(x, y, w, h, r, L.T.panel, `stroke="${L.T.line}" stroke-width="${f2(1.5 * L.u)}"`);
const TAB = 'font-variant-numeric="tabular-nums"';
/* a block taller than its room is scaled down about its top centre (never up), then centred in the room: draw it with its top at y = 0 and wrap it with put() */
const fit = (R, h) => { const k = Math.min(1, (R.bottom - R.top) / h); return { k, y: Math.max(R.top, (R.top + R.bottom) / 2 - (k * h) / 2) }; };
const put = (F, cx, g) => `<g transform="translate(${f2(cx)} ${f2(F.y)}) scale(${f2(F.k)}) translate(${f2(-cx)} 0)">${g}</g>`;

/* ---------- the honesty label + footer: the ILLUSTRATIVE pill at a fixed spot (bottom-left of the safe rect) and, above it, the source and method of the numbers on the panel ---------- */
export const PILL_LABEL = 'ILLUSTRATIVE · PLACEHOLDER DATA';
export const pillPx = (tall) => (tall ? 30 : 28);                                   // the pack's honesty-label floor (frames.md section 5): 28 px on 16:9, 30 px on 9:16, mono
export const pillH = (tall, u = 1) => pillPx(tall) * 1.75 * u;
const finePx = (L) => (L.tall ? 30 : 24) * L.u;                                       // the source / method fine print drawn here (the pack's own parts print theirs at 17-19 px)
function pill(L, x, y, k) {
  const s = L.u, ps = pillPx(L.tall) * s, h = pillH(L.tall, s), tw = measure(PILL_LABEL, ps, { weight: 600, font: MONO, ls: 2 }) + 1.3 * ps;
  return `<g${fade(k)}>${rect(x, y, tw, h, h / 2, 'none', `stroke="${L.T.accent}" stroke-width="${f2(2 * s)}"`)}${text(PILL_LABEL, x + 0.65 * ps, y + h / 2 + 0.34 * ps, { size: ps, weight: 600, fill: L.T.accent, font: MONO, ls: 2 })}</g>`;
}
/* the honesty label arrives with its panel: it is fully in 0.05 s after the content starts, i.e. before the first number is on screen (the camera is still settling then) */
const LABEL_IN = (u) => seg(u, -0.17, 0.05);
const pillAtBottom = (L, k) => (L.plan.illustrative ? pill(L, L.S.x0, L.S.y1 - pillH(L.tall, L.u), k) : '');
function strip(L, x, y, w, nums, k, { source = true, method = true, pill: withPill = true } = {}) {
  const s = L.u, T = L.T, size = finePx(L), lh = 1.35 * size, srcs = distinct(nums.map((n) => n.source)), meths = distinct(nums.map((n) => n.method)); let o = '', yy = y;
  const line = (label, str) => wrapLines(label + ': ' + str, size, 600, w, MONO).forEach((l) => { o += text(l, x, yy + 0.8 * size, { size, weight: 600, fill: T.muted, font: MONO }); yy += lh; });
  if (source && srcs.length) line('source', srcs.join(' · '));
  if (method && meths.length) { const groups = new Map(); nums.forEach((n) => { const m = String(n.method ?? '').trim(); if (m) groups.set(m, [...(groups.get(m) || []), n.label]); });
    line('method', meths.length === 1 ? meths[0] : [...groups].map(([m, labs]) => `${[...new Set(labs)].join(', ')}: ${m}`).join(' · ')); }
  if (withPill && L.plan.illustrative) { if (yy > y) yy += 12 * s; o += pill(L, x, yy, 1); yy += pillH(L.tall, s); }   // the pill closes the strip: pinned to the bottom, it always lands on the same spot
  return { svg: `<g${fade(k)}>${o}</g>`, h: yy - y };
}
const footH = (L, nums, o) => strip(L, 0, 0, L.S.w, nums, 1, o).h;
const footer = (L, nums, k, o) => strip(L, L.S.x0, L.S.y1 - footH(L, nums, o), L.S.w, nums, k, o).svg;
const room = (L, nums, o) => ({ top: L.S.y0, bottom: L.S.y1 - footH(L, nums, o) - 28 * L.u });   // the content region above the footer

/* ---------- 1. claim: at most 6 words, one accent word; the words spring in from frame 0, the accent word is underlined ---------- */
function claim(L, d, u) {
  const s = L.u, T = L.T, sz = (L.tall ? 128 : 190) * s, ls = -0.035 * sz, maxW = L.S.w * (L.tall ? 1 : 0.92), lh = 1.1 * sz, sp = measure(' ', sz, { weight: 800 }) + ls;
  const lines = []; let at = 0; for (const text0 of balanced(d.words.join(' '), sz, 800, maxW, ls)) { const ws = text0.split(' ').map((w, k) => ({ w, i: at + k, ww: measure(w, sz, { weight: 800, ls }) })); at += ws.length; lines.push(ws); }
  const x0 = L.S.x0 + (L.tall ? 0 : 0.04 * L.W), top = L.cy - (lines.length * lh) / 2 + sz * 0.82; let o = '', under = '';
  lines.forEach((ln, r) => { let x = x0; ln.forEach((q) => { const k = spring(u + 0.04 - 0.11 * q.i, 'headline'), y = top + r * lh, acc = d.accent.includes(q.i);   // the first word is already moving on frame 0
    if (k > 0) o += `<g${fade(k * 2.2)} transform="translate(0 ${f2(sz * 0.32 * (1 - k))})">${text(q.w, x, y, { size: sz, weight: 800, fill: acc ? T.accent : T.ink, ls })}</g>`;
    if (acc) { const uk = E.enter(seg(u, d.accentAt, d.accentAt + 0.55)); if (uk > 0) under += `<path d="M${f2(x)} ${f2(y + sz * 0.16)} L${f2(x + q.ww)} ${f2(y + sz * 0.16)}" stroke="${T.accent}" stroke-width="${f2(9 * s)}" stroke-linecap="round" fill="none" stroke-dasharray="${f2(q.ww)} ${f2(q.ww + 1)}" stroke-dashoffset="${f2(q.ww * (1 - uk))}"/>`; }
    x += q.ww + sp; }); });
  return o + under;
}

/* ---------- 2. name: the placeholder mark, "Introducing", the name, the promise ---------- */
const mark = (cx, cy, r, T, k) => `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, k))})"><circle r="${f2(r * 0.78)}" fill="none" stroke="${T.accent}" stroke-width="${f2(r * 0.34)}"/><circle r="${f2(r * 0.2)}" fill="${T.ink}"/></g>`;
function nameP(L, d, u) {
  const s = L.u, T = L.T, mr = 62 * s, nsz = (L.tall ? 156 : 200) * s, ls = -0.04 * nsz, isz = 54 * s, psz = 38 * s, x0 = L.S.x0 + (L.tall ? 0 : 0.04 * L.W), lh = 1.04 * nsz;
  const mk = spring(u, 'headline'), ik = spring(u - 0.06, 'ui'), nk = spring(u - 0.16, 'headline'), pk = spring(u - 0.75, 'panel');
  const nameW = L.S.w - (L.tall ? 0 : 2 * mr + 44 * s), nl = wrapLines(d.brand, nsz, 800, nameW, FONT, ls), pl = wrapLines(d.promise, psz, 600, L.S.w * (L.tall ? 1 : 0.8)), markRow = L.tall ? 2 * mr + 26 * s : 0;
  const total = markRow + isz * 1.1 + 22 * s + nl.length * lh + 30 * s + pl.length * 52 * s; let y = L.cy - total / 2; let o = '';
  if (L.tall) { o += mark(x0 + mr, y + mr, mr, T, mk); y += markRow; }
  y += isz; o += `<g${fade(ik * 1.6)} transform="translate(0 ${f2(24 * s * (1 - ik))})">${text(d.intro, x0, y, { size: isz, weight: 600, fill: T.muted })}</g>`;
  y += 22 * s + nsz * 0.84; const nx = x0 + (L.tall ? 0 : 2 * mr + 44 * s); if (!L.tall) o += mark(x0 + mr, y - nsz * 0.33, mr, T, mk);
  nl.forEach((l, i) => { o += `<g${fade(nk * 2)} transform="translate(0 ${f2(nsz * 0.28 * (1 - nk))})">${text(l, nx, y + i * lh, { size: nsz, weight: 800, fill: T.ink, ls })}</g>`; });
  y += (nl.length - 1) * lh + 30 * s + psz; pl.forEach((l, i) => { o += `<g${fade(pk * 1.6)} transform="translate(0 ${f2(16 * s * (1 - pk))})">${text(l, x0, y + i * 52 * s, { size: psz, weight: 600, fill: T.muted })}</g>`; });
  return o;
}

/* ---------- 3. method / setting card: what was measured, on what, against whom, and the counts ---------- */
function setting(L, d, u) {
  const s = L.u, T = L.T, id = 'ps' + L.W, pad = 52 * s, cw = L.tall ? L.S.w : Math.min(L.S.w, 1640 * s), x = L.S.x0 + (L.S.w - cw) / 2, k = spring(u, 'panel'), nums = d.numbers;
  const labW = L.tall ? 0 : 220 * s, tsz = (L.tall ? 38 : 46) * s, txtW = cw - 2 * pad - labW, rows = d.rows.map((r) => ({ ...r, lines: wrapLines(r.text, tsz, 600, txtW) })), chipH = 176 * s;
  const rowH = (r) => (L.tall ? 38 * s : 0) + r.lines.length * 56 * s + 34 * s, bodyH = rows.reduce((a, r) => a + rowH(r), 0), head = 58 * s + 30 * s, h = pad + head + bodyH + 20 * s + chipH + pad * 0.6, R = room(L, nums), F = fit(R, h), y = 0;
  let o = `<defs>${shadowDef(id, s)}</defs><g${fade(k * 1.5)} transform="translate(0 ${f2(24 * s * (1 - k))})">${cardBox(L, id, x, y, cw, h, 28 * s)}`;
  o += text(d.title, x + pad, y + pad + 46 * s, { size: 58 * s, weight: 800, fill: T.ink }) + rect(x + pad, y + pad + 66 * s, 72 * s, 7 * s, 3.5 * s, T.accent);
  let yy = y + pad + head;
  rows.forEach((r, i) => { const rk = spring(u - 0.25 - 0.15 * i, 'ui'), ry = yy; yy += rowH(r);
    o += `<g${fade(rk * 1.5)} transform="translate(0 ${f2(14 * s * (1 - rk))})"><line x1="${f2(x + pad)}" x2="${f2(x + cw - pad)}" y1="${f2(ry + 6 * s)}" y2="${f2(ry + 6 * s)}" stroke="${T.line}" stroke-width="${f2(1.5 * s)}"/>`
      + text(r.label.toUpperCase(), x + pad, ry + 46 * s, { size: 22 * s, weight: 600, fill: T.muted, font: MONO, ls: 2 })
      + r.lines.map((l, j) => text(l, x + pad + labW, ry + (L.tall ? 46 * s + 40 * s : 48 * s) + j * 56 * s, { size: tsz, weight: 600, fill: T.ink })).join('') + '</g>'; });
  const cwid = (cw - 2 * pad) / nums.length, cy0 = yy + 8 * s;
  nums.forEach((n, i) => { const ck = spring(u - 1.0 - 0.14 * i, 'ui'), v = n.value * E.expoOut(seg(u, 1.05 + 0.14 * i, 1.85 + 0.14 * i)), cx = x + pad + i * cwid;
    o += `<g${fade(ck * 1.5)}><line x1="${f2(cx)}" x2="${f2(cx)}" y1="${f2(cy0 + 8 * s)}" y2="${f2(cy0 + chipH - 18 * s)}" stroke="${T.accent}" stroke-width="${f2(5 * s)}"/>`
      + text(fmtN(n, v), cx + 26 * s, cy0 + 94 * s, { size: 96 * s, weight: 800, fill: T.ink, extra: TAB }) + text(n.label, cx + 28 * s, cy0 + 140 * s, { size: 32 * s, weight: 600, fill: T.muted }) + '</g>'; });
  return put(F, x + cw / 2, o + '</g>') + footer(L, nums, LABEL_IN(u));   // the label and the sources arrive WITH the card, before the counts start
}

/* ---------- 4. big numbers: each with its own source and method on screen ---------- */
function numbersP(L, d, u) {
  const s = L.u, T = L.T, items = d.items, n = items.length, gap = 56 * s, cwid = (L.S.w - gap * (n - 1)) / n, R = room(L, items, { source: false, method: false });
  const colBlock = (it, i, x, y, w, size) => { const t0 = 0.04 + 0.26 * i, k = spring(u - t0, 'headline'), v = it.value * E.expoOut(seg(u, t0, t0 + 1.15)), full = fmtN(it, it.value);
    const fs = Math.min(size, size * w / Math.max(w * 0.4, measure(full, size, { weight: 800, ls: -0.04 * size }))), ls = -0.04 * fs, lk = seg(u, t0 + 0.25, t0 + 0.6), sk = seg(u, t0 + 0.2, t0 + 0.55);   // the label and the source / method lines come in while the number counts, not after it
    const fp = finePx(L), lab = wrapLines(it.label, 46 * s, 700, w), sm = wrapLines('source: ' + it.source, fp, 600, w, MONO), me = wrapLines('method: ' + it.method, fp, 600, w, MONO); let yy = y + fs * 0.8;
    let g = `<g${fade(k * 2)} transform="translate(0 ${f2(fs * 0.2 * (1 - k))})">${text(fmtN(it, v), x, yy, { size: fs, weight: 800, fill: T.ink, ls, extra: TAB })}</g>`; yy += 30 * s;
    g += rect(x, yy, 64 * s * lk, 7 * s, 3.5 * s, T.accent); yy += 34 * s + 46 * s; lab.forEach((l, j) => { g += text(l, x, yy + j * 54 * s, { size: 46 * s, weight: 700, fill: T.ink, op: clamp(lk * 1.4) }); }); yy += lab.length * 54 * s - 20 * s;
    sm.concat(me).forEach((l, j) => { g += text(l, x, yy + fp + j * 1.35 * fp, { size: fp, weight: 600, fill: T.muted, font: MONO, op: clamp(sk) }); }); yy += (sm.length + me.length) * 1.35 * fp + 24 * s; return { g, h: yy - y }; };
  let o = '', h;
  if (!L.tall) { const size = (n === 1 ? 340 : n === 2 ? 290 : 230) * s, bl = items.map((it, i) => colBlock(it, i, L.S.x0 + i * (cwid + gap), 0, cwid, size)); h = Math.max(...bl.map((b) => b.h)); o = bl.map((b) => b.g).join(''); }
  else { const size = (n === 1 ? 260 : n === 2 ? 196 : 142) * s, gp = 26 * s; let y = 0; items.forEach((it, i) => { const b = colBlock(it, i, L.S.x0, y, L.S.w, size); o += b.g; y += b.h + gp; }); h = y - gp; }
  return put(fit(R, h), L.cx, o) + footer(L, items, LABEL_IN(u), { source: false, method: false });
}

/* ---------- 5. three stat cards: better / leaner / cheaper ---------- */
function cardsP(L, d, u) {
  const s = L.u, T = L.T, id = 'pc' + L.W, n = d.length, gap = 34 * s, pad = 30 * s, R = room(L, d, { source: false, method: false }); let o = `<defs>${shadowDef(id, s)}</defs>`;
  const cw = L.tall ? L.S.w : (L.S.w - gap * (n - 1)) / n, shMax = Math.max(...d.map((it) => strip(L, 0, 0, cw - 2 * pad, [it], 1, { pill: false }).h)), ch = Math.max(L.tall ? 292 * s : 640 * s, (L.tall ? 196 : 446) * s + shMax + pad), h = L.tall ? n * ch + gap * (n - 1) : ch, ours = L.plan.brand.name, F = fit(R, h);   // the card is as tall as its content: the bars and value above, the fine print below, whatever the length of the method
  d.forEach((it, i) => { const t0 = 0.04 + 0.26 * i, k = spring(u - t0, 'panel'), x = L.tall ? L.S.x0 : L.S.x0 + i * (cw + gap), y = L.tall ? i * (ch + gap) : 0;
    const v = it.value * E.expoOut(seg(u, t0 + 0.1, t0 + 1.1)), vs = (L.tall ? 100 : 150) * s, mx = Math.max(it.value, it.alt ?? 0) || 1, bk = E.expoOut(seg(u, t0 + 0.7, t0 + 1.4)), bw = L.tall ? 270 * s : cw - 2 * pad - 130 * s, bh = (L.tall ? 24 : 28) * s;
    let g = `<g${fade(k * 1.6)} transform="translate(0 ${f2(50 * s * (1 - k))})">${cardBox(L, id, x, y, cw, ch, 24 * s)}${rect(x, y, cw, 10 * s, 5 * s, T.accent)}`;
    g += text(it.label, x + pad, y + pad + 40 * s, { size: 42 * s, weight: 800, fill: T.accent });
    if (L.tall) g += text(it.line, x + pad + measure(it.label, 42 * s, { weight: 800 }) + 18 * s, y + pad + 40 * s, { size: 30 * s, weight: 600, fill: T.muted });
    const vy = L.tall ? y + pad + 40 * s + 22 * s + vs * 0.86 : y + pad + 42 * s + 20 * s + vs * 0.86;
    g += text(fmtN(it, v), x + pad, vy, { size: vs, weight: 800, fill: T.ink, ls: -0.03 * vs, extra: TAB }) + (L.tall ? '' : text(it.line, x + pad + 2 * s, vy + 42 * s, { size: 32 * s, weight: 600, fill: T.muted }));
    const bx = L.tall ? x + cw - pad - bw - 100 * s : x + pad, by = L.tall ? y + pad + 48 * s : vy + 86 * s;
    const bar = (yy, lab, val, col, str) => text(lab, bx, yy - 9 * s, { size: 21 * s, weight: 600, fill: T.muted, font: MONO }) + rect(bx, yy, bw, bh, bh / 2, T.chip) + rect(bx, yy, Math.max(bh, bw * (val / mx) * bk), bh, bh / 2, col) + text(str, bx + bw + 14 * s, yy + bh - 2 * s, { size: 28 * s, weight: 700, fill: T.ink, extra: TAB });
    if (it.alt !== undefined) g += bar(by + 22 * s, ours, it.value, T.accent, fmtN(it, it.value)) + bar(by + 22 * s + (L.tall ? 56 : 80) * s, it.altLabel || 'alternative', it.alt, T.faint, fmtN(it, it.alt));
    const sh = strip(L, 0, 0, cw - 2 * pad, [it], 1, { pill: false }).h;
    g += strip(L, x + pad, y + ch - pad - sh + 6 * s, cw - 2 * pad, [it], clamp((u - t0 - 0.1) / 0.4), { pill: false }).svg + '</g>'; o += g; });
  return put(F, L.cx, o) + footer(L, d, LABEL_IN(u), { source: false, method: false });
}

/* ---------- 6. end card: the name, the URL, one line; it holds still (a quiet hold, no stinger) ---------- */
function endP(L, d, u) {
  const s = L.u, T = L.T, mr = 50 * s, nsz = (L.tall ? 112 : 132) * s, ls = -0.04 * nsz, mk = spring(u - 0.05, 'headline'), nk = spring(u - 0.12, 'headline'), uk = spring(u - 0.55, 'panel'), lk = spring(u - 0.9, 'panel');
  const nw = measure(d.brand, nsz, { weight: 800, ls }), rowW = 2 * mr + 36 * s + nw, x0 = L.cx - rowW / 2, cy = L.cy - 40 * s, usz = 52 * s; let o = '';
  o += mark(x0 + mr, cy, mr, T, mk) + `<g${fade(nk * 2)} transform="translate(0 ${f2(nsz * 0.25 * (1 - nk))})">${text(d.brand, x0 + 2 * mr + 36 * s, cy + nsz * 0.34, { size: nsz, weight: 800, fill: T.ink, ls })}</g>`;
  o += `<g${fade(uk * 1.6)} transform="translate(0 ${f2(18 * s * (1 - uk))})">${text(d.url, L.cx, cy + nsz * 0.34 + 96 * s, { size: usz, weight: 600, fill: T.accent, font: MONO, anchor: 'middle' })}</g>`;
  let yy = cy + nsz * 0.34 + 96 * s + 78 * s; wrapLines(d.line, 36 * s, 600, L.S.w * 0.9).forEach((l) => { o += `<g${fade(lk * 1.6)}>${text(l, L.cx, yy, { size: 36 * s, weight: 600, fill: T.muted, anchor: 'middle' })}</g>`; yy += 48 * s; });
  if (d.chips && d.chips.length) { const csz = 28 * s, ws = d.chips.map((c) => measure(c, csz, { weight: 700 }) + 44 * s), tot = ws.reduce((a, b) => a + b, 0) + 16 * s * (ws.length - 1); let x = L.cx - tot / 2;
    d.chips.forEach((c, i) => { o += `<g${fade(lk * 1.6)}>${rect(x, yy + 8 * s, ws[i], 56 * s, 28 * s, T.chip)}${text(c, x + ws[i] / 2, yy + 8 * s + 38 * s, { size: csz, weight: 700, fill: T.ink, anchor: 'middle' })}</g>`; x += ws[i] + 16 * s; }); }
  o += pillAtBottom(L, LABEL_IN(u));
  return o;
}

/* ---------- the parts: the pack's own gfx in this cell (ui.branchTrace is landscape-only: the gate refuses it on 9:16) ---------- */
function partP(L, st, t) {
  const u = t - st.at, hold = (st.until ?? 0) + L.plan.camera.travelS + 0.4 - st.at, item = { at: st.at, dur: hold, params: st.part.params };
  let o = renderInner(st.part.id, t, item, L.ctx);
  if (st.part.id === 'ui.dataTable') { const nums = L.plan.honesty.numbers.filter((n) => n.path.startsWith(st.id === 'h2h' ? 'h2h.' : 'builder.table.')); o += footer(L, nums, LABEL_IN(u), { source: false }); }   // the part prints the source; the method line and the pill are ours
  else o += pillAtBottom(L, LABEL_IN(u));                                                                                                                                                             // scatter / trace: the part prints its own source note; the pill sits where it sits on every panel
  return o;
}

/* ---------- the dispatcher ---------- */
export function stage(plan, st, t, L = layout(plan)) {
  const u = t - st.at;
  if (st.part) return partP(L, st, t);
  const fn = { claim, name: nameP, setting, numbers: numbersP, cards: cardsP, end: endP }[st.kind];
  return u < -0.5 ? '' : fn(L, st.data, u);
}
/* one cell as a whole <svg> (the page sets it with innerHTML) */
export const cellSVG = (plan, st, t, L = layout(plan)) => { const inner = stage(plan, st, t, L); return inner ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.W} ${plan.H}" width="${plan.W}" height="${plan.H}" style="position:absolute;inset:0">${inner}</svg>` : ''; };
/* is the cell on screen (or about to be)? the leg that brings it in starts at t0; the leg that takes it away ends travelS after the next t0 */
export const cellVisible = (plan, st, t) => t >= st.t0 - 0.05 && t < (st.until ?? plan.seconds) + plan.camera.travelS + 0.15;

/* ---------- the camera ---------- */
export function cameraFor(plan) {
  const { H } = plan, cam = plan.camera, [px, py] = cam.pitch, legs = cam.legs, st = plan.stages, A = cam.push, D = cam.dip;
  let pan = ID2; for (const lg of legs) pan = pan2d(pan, { at: lg.t0, dur: lg.dur, dx: -px / H, dy: -py / H, ease: cam.ease });   // dx, dy in frame HEIGHTS: the content moves against the camera
  const ease = CE[cam.ease] || CE.soft, k = (lg, t) => ease(seg(t, lg.t0, lg.t0 + lg.dur)), leg = (i) => legs.find((l) => l.from === i);
  const zoom = (t) => { let push = 0, dip = 0;
    st.forEach((s, i) => { const lg = leg(i); push += CE.sine(seg(t, s.at, lg ? lg.t0 : plan.seconds)) * (lg ? 1 - k(lg, t) : 1); });   // a slow push while a stage dwells, released as the camera leaves
    for (const lg of legs) dip += Math.sin(Math.PI * k(lg, t));                                                                         // a dip while it travels
    return c2({ scale: (1 + A * push) * (1 - D * Math.min(1, dip)) }); };
  return { pan: (t) => c2(pan(t)), zoom };
}
/* where the centre of cell i lands on screen (px) at time t: at rest the stage in view projects to the frame centre */
export function mapCell(plan, i, t, cam = cameraFor(plan)) {
  const { W, H } = plan, [px, py] = plan.camera.pitch, p = cam.pan(t), S = cam.zoom(t).scale, ox = W / 2, oy = H / 2;
  return [ox + S * (ox + i * px + p.x * H - ox), oy + S * (oy + i * py + p.y * H - oy)];
}
