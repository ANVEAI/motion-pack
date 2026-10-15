/* templates/_shared/saas/kit.mjs: the pure scene kit shared by the SaaS templates (saas-launch, saas-feature-drop, saas-explainer), node + browser, no DOM, no clock (2026-10-16, lane xp-saas).
   A scene is data: { id, start, end, bg, heads: [head], items: [{ id: '<gfx id>', at, dur, params, screen?: {name, keys}, screens?: {before, after} }], mark?, card? (the end card) }.
   sceneSVG(scene, t, env) draws it at composition time t: background, gfx items (type/gfx renderInner; an item's `screen` is resolved to HTML from screens.mjs at every frame), kinetic headlines
   (words rise out of their line mask in a stagger, *accent* words in the brand accent), the brand mark and the end card. env = { W, H, B (brand), renderInner, ctx, screenHTML, stateAt, measure }.
   headBox(head, W, H, measure) gives the text box in px for plan.texts (eyes reads it); node measures with the textW estimate, the browser with canvas metrics once the fonts are loaded. */
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bez = (p1x, p1y, p2x, p2y) => (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 28; i++) { t = (lo + hi) / 2; const bx = 3 * (1 - t) ** 2 * t * p1x + 3 * (1 - t) * t * t * p2x + t ** 3; if (bx < x) lo = t; else hi = t; } return 3 * (1 - t) ** 2 * t * p1y + 3 * (1 - t) * t * t * p2y + t ** 3; };
export const EASE = { enter: bez(0.16, 1, 0.3, 1), exit: bez(0.7, 0, 0.84, 0), pop: bez(0.34, 1.56, 0.64, 1), move: bez(0.65, 0, 0.35, 1) };
const FONT = "Manrope, 'Helvetica Neue', Arial, sans-serif", MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

/* ---------- headlines ---------- */
/* words of a line with *accent* spans: [{ w, runs: [{ s, accent }], accent }]. The accent toggles on '*' anywhere, so '*everywhere*.' keeps its full stop on the word (no space before it) */
export function words(str) { const out = []; let acc = false; for (const raw of String(str ?? '').split(/\s+/).filter(Boolean)) { const runs = []; let cur = '';
  for (const ch of raw) { if (ch === '*') { if (cur) runs.push({ s: cur, accent: acc }); cur = ''; acc = !acc; continue; } cur += ch; } if (cur) runs.push({ s: cur, accent: acc });
  if (runs.length) out.push({ w: runs.map((r) => r.s).join(''), runs, accent: runs.some((r) => r.accent) }); } return out; }
export const plain = (str) => String(str ?? '').replace(/\*/g, '');
/* break into lines that fit head.w (px); head.size px; returns { lines: [{ ws: [{w, accent, x, width}], y }], box: [x0, y0, x1, y1], lh } */
export function headLayout(h, measure) {
  const size = h.size, lh = size * (h.lh ?? 1.06), sp = measure(' ', size, { weight: h.weight ?? 800 }), maxW = h.w, lines = [[]]; let cur = 0;
  for (const wd of words(h.text)) { const wv = measure(wd.w, size, { weight: h.weight ?? 800, ls: -0.03 * size }); if (lines.at(-1).length && cur + sp + wv > maxW) { lines.push([]); cur = 0; } const L = lines.at(-1); L.push({ ...wd, width: wv }); cur += (L.length > 1 ? sp : 0) + wv; }
  const out = lines.map((L, i) => { const tw = L.reduce((a, w) => a + w.width, 0) + sp * Math.max(0, L.length - 1); let x = h.align === 'center' ? h.x + (maxW - tw) / 2 : h.align === 'right' ? h.x + maxW - tw : h.x;
    const ws = L.map((w) => { const o = { ...w, x }; x += w.width + sp; return o; }); return { ws, y: h.y + lh * i + size * 0.8, tw }; });
  const x0 = Math.min(...out.map((l) => l.ws[0]?.x ?? h.x)), x1 = Math.max(...out.map((l) => (l.ws.at(-1)?.x ?? h.x) + (l.ws.at(-1)?.width ?? 0)));
  return { lines: out, lh, box: [x0, h.y, x1, h.y + lh * (out.length - 1) + size * 1.02] };
}
export const headBox = (h, measure) => headLayout(h, measure).box.map((v) => Math.round(v));
/* draw one headline at time t: each word rises out of its line's mask (EASE.enter, 0.42 s, stagger 0.055 s); out: [t, dur] lifts the words away again */
export function headSVG(h, t, env) {
  const u = t - h.at; if (u < 0) return ''; const lay = headLayout(h, env.measure), size = h.size, ink = h.color ?? env.B.ink, acc = h.accentColor ?? env.B.accent, st = h.stagger ?? 0.055, dur = h.riseS ?? 0.42;
  const outK = h.out ? EASE.exit(cl((t - h.out) / (h.outS ?? 0.25))) : 0; if (outK >= 1) return '';
  let i = 0, o = '';
  lay.lines.forEach((ln, li) => { const cid = `hm${Math.abs(Math.round(h.x * 7 + h.y * 13 + li * 101 + size))}`, top = ln.y - size * 0.86, hh = lay.lh * 1.02;
    let g = ''; for (const w of ln.ws) { const k = h.cut ? 1 : EASE.enter(cl((u - i * st) / dur)), dy = (1 - k) * size * 0.95 - outK * size * 0.95; i++;
      g += `<text x="${f2(w.x)}" y="${f2(ln.y + dy)}" font-family="${esc(FONT)}" font-size="${f2(size)}" font-weight="${h.weight ?? 800}" letter-spacing="${f2(-0.03 * size)}" fill="${ink}">${w.runs.map((r) => (r.accent ? `<tspan fill="${acc}">${esc(r.s)}</tspan>` : esc(r.s))).join('')}</text>`; }
    o += `<clipPath id="${cid}"><rect x="${f2(h.x - size)}" y="${f2(top - size * 0.12)}" width="${f2(h.w + 2 * size)}" height="${f2(size * 1.36)}"/></clipPath><g clip-path="url(#${cid})">${g}</g>`; });
  return h.opacity != null && h.opacity < 1 ? `<g opacity="${f2(h.opacity)}">${o}</g>` : o;
}
/* a small kicker pill above a headline ("NEW", "Step 1", "How it works") */
export function kickerSVG(k, t, env) {
  const u = t - k.at; if (u < 0) return ''; const s = k.size ?? 30, w = env.measure(k.text, s, { weight: 800, ls: 0.08 * s }) + s * 1.4, hh = s * 1.8, kk = EASE.pop(cl(u / 0.35)), x = k.align === 'center' ? k.x - w / 2 : k.x;
  return `<g transform="translate(${f2(x + w / 2)} ${f2(k.y + hh / 2)}) scale(${f2(Math.max(0.001, kk))}) translate(${f2(-w / 2)} ${f2(-hh / 2)})"><rect width="${f2(w)}" height="${f2(hh)}" rx="${f2(hh / 2)}" fill="${k.bg ?? env.B.accent}"/>` +
    `<text x="${f2(s * 0.7)}" y="${f2(hh / 2 + s * 0.36)}" font-family="${esc(FONT)}" font-size="${f2(s)}" font-weight="800" letter-spacing="${f2(0.08 * s)}" fill="${k.color ?? '#FFFFFF'}">${esc(String(k.text).toUpperCase())}</text></g>`;
}

/* ---------- the brand mark (your logo file, or a lettermark on the accent) ---------- */
export function markSVG(B, cx, cy, size, k = 1) {
  const r = size * 0.24, s = Math.max(0.001, k), body = B.logo ? `<image href="${esc(B.logo)}" x="${f2(-size / 2)}" y="${f2(-size / 2)}" width="${f2(size)}" height="${f2(size)}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${f2(-size / 2)}" y="${f2(-size / 2)}" width="${f2(size)}" height="${f2(size)}" rx="${f2(r)}" fill="${B.accent}"/><path d="M${f2(-size * 0.22)} ${f2(size * 0.2)} L0 ${f2(-size * 0.24)} L${f2(size * 0.22)} ${f2(size * 0.2)} M${f2(-size * 0.12)} ${f2(size * 0.02)} H${f2(size * 0.12)}" fill="none" stroke="#FFFFFF" stroke-width="${f2(size * 0.1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(s)})">${body}</g>`;
}
/* the reveal: the mark pops, the name rises letter by letter, the line follows (scene.mark = { at, cx, cy, size, name: { size, y }, line: head }) */
export function revealSVG(m, t, env) {
  const u = t - m.at; if (u < 0) return ''; const k = EASE.pop(cl(u / 0.5)), ns = m.nameSize, name = env.B.name, nw = env.measure(name, ns, { weight: 800, ls: -0.04 * ns });
  const lay = m.row ? { mx: m.cx - (m.size + ns * 0.35 + nw) / 2 + m.size / 2, my: m.cy, nx: m.cx - (m.size + ns * 0.35 + nw) / 2 + m.size + ns * 0.35, ny: m.cy + ns * 0.36 } : { mx: m.cx, my: m.cy - ns * 0.6, nx: m.cx - nw / 2, ny: m.cy + m.size * 0.5 + ns * 0.55 };
  let o = markSVG(env.B, lay.mx, lay.my, m.size, k), x = lay.nx; const chars = [...name];
  const cid = `rv${Math.round(m.cx + m.cy)}`; let g = '';
  chars.forEach((ch, i) => { const kk = EASE.enter(cl((u - 0.18 - i * 0.03) / 0.4)), cw = env.measure(ch, ns, { weight: 800 }) - 0.04 * ns; g += `<text x="${f2(x)}" y="${f2(lay.ny + (1 - kk) * ns)}" font-family="${esc(FONT)}" font-size="${f2(ns)}" font-weight="800" fill="${m.color ?? env.B.ink}">${esc(ch)}</text>`; x += cw; });
  o += `<clipPath id="${cid}"><rect x="${f2(lay.nx - ns)}" y="${f2(lay.ny - ns * 0.95)}" width="${f2(nw + 2 * ns)}" height="${f2(ns * 1.25)}"/></clipPath><g clip-path="url(#${cid})">${g}</g>`;
  return o;
}
/* the end card: mark + name, the CTA pill, the URL (mono), an optional fine-print line; everything settles inside 0.9 s, then holds */
export function endSVG(e, t, env) {
  const u = t - e.at; if (u < 0) return ''; const B = env.B, s = e.unit ?? 1, ns = 96 * s, k = EASE.pop(cl(u / 0.5)), cx = env.W / 2, cy = e.cy ?? env.H * 0.42;
  let o = revealSVG({ at: e.at, cx, cy, size: 132 * s, nameSize: ns, row: !e.stack }, t, env);
  const ka = EASE.enter(cl((u - 0.45) / 0.4)), cs = 44 * s, cw = env.measure(B.cta, cs, { weight: 700 }) + 100 * s, chh = 96 * s, cyy = cy + (e.stack ? 250 : 130) * s;
  o += `<g opacity="${f2(ka)}" transform="translate(0 ${f2((1 - ka) * 30 * s)})"><rect x="${f2(cx - cw / 2)}" y="${f2(cyy)}" width="${f2(cw)}" height="${f2(chh)}" rx="${f2(chh / 2)}" fill="${B.accent}"/>` +
    `<text x="${f2(cx)}" y="${f2(cyy + chh / 2 + cs * 0.36)}" font-family="${esc(FONT)}" font-size="${f2(cs)}" font-weight="700" fill="#FFFFFF" text-anchor="middle">${esc(B.cta)}</text></g>`;
  const ku = EASE.enter(cl((u - 0.6) / 0.4)), us = 36 * s;
  o += `<text x="${f2(cx)}" y="${f2(cyy + chh + 74 * s)}" font-family="${esc(MONO)}" font-size="${f2(us)}" font-weight="600" fill="${e.urlColor ?? '#5D5A66'}" text-anchor="middle" opacity="${f2(ku)}" letter-spacing="${f2(0.04 * us)}">${esc(B.url)}</text>`;
  if (e.fine) o += `<text x="${f2(cx)}" y="${f2(env.H - (e.fineY ?? 70) * s)}" font-family="${esc(FONT)}" font-size="${f2(28 * s)}" font-weight="600" fill="${e.urlColor ?? '#5D5A66'}" text-anchor="middle" opacity="${f2(ku)}">${esc(e.fine)}</text>`;
  void k; return o;
}

/* ---------- captions (explainer, no VO or VO): chunks [{ text, start, end, words?: [{w, s, e}] }]; the active word gets the accent ---------- */
export function captionSVG(cap, t, env) {
  const ch = cap.chunks.find((c) => t >= c.start && t < c.end); if (!ch) return ''; const s = cap.size, y = cap.y, ws = ch.words || words(ch.text).map((w) => ({ w: w.w })), sp = env.measure(' ', s, { weight: 800 });
  const widths = ws.map((w) => env.measure(w.w, s, { weight: 800 })), lines = [[]]; let cur = 0; ws.forEach((w, i) => { if (lines.at(-1).length && cur + sp + widths[i] > cap.w) { lines.push([]); cur = 0; } lines.at(-1).push(i); cur += (lines.at(-1).length > 1 ? sp : 0) + widths[i]; });
  const lh = s * 1.2, top = y - lh * (lines.length - 1), pad = s * 0.45; let o = '';
  lines.forEach((L, li) => { const tw = L.reduce((a, i) => a + widths[i], 0) + sp * (L.length - 1), x0 = env.W / 2 - tw / 2, yy = top + li * lh; o += `<rect x="${f2(x0 - pad)}" y="${f2(yy - s * 0.92)}" width="${f2(tw + 2 * pad)}" height="${f2(s * 1.22)}" rx="${f2(s * 0.28)}" fill="${cap.bg ?? 'rgba(14,13,20,0.82)'}"/>`;
    let x = x0; for (const i of L) { const w = ws[i], on = w.s != null && t >= w.s && t < w.e + 0.08; o += `<text x="${f2(x)}" y="${f2(yy)}" font-family="${esc(FONT)}" font-size="${f2(s)}" font-weight="800" fill="${on ? cap.accent ?? env.B.accent2 ?? '#FFD24A' : '#FFFFFF'}">${esc(w.w)}</text>`; x += widths[i] + sp; } });
  return o;
}

/* ---------- a scene at time t ---------- */
const BG = (bg, B) => (bg === 'accent' ? B.accent : bg === 'ink' ? B.ink : bg === 'soft' ? B.soft ?? '#ECEAF7' : B.paper);
export function resolveScreen(it, t, env) {
  const p = it.params || {}, B = env.B, html = (sc) => { const st = env.stateAt(sc.keys, t - it.at, sc.ease ?? 0.45); return env.screenHTML(st._screen || sc.name, st, B); };   // a `_screen` key switches the screen (flows -> builder)
  if (it.screen && !(p.screen && p.screen.src)) return { ...p, screen: { ...(p.screen || {}), html: html(it.screen) } };
  if (it.screens) { const q = { ...p }; for (const side of ['before', 'after']) if (it.screens[side] && !(p[side] && p[side].src)) q[side] = { ...(p[side] || {}), html: html(it.screens[side]) }; return q; }
  return p;
}
export function sceneSVG(sc, t, env) {
  const B = env.B; let o = `<rect x="0" y="0" width="${env.W}" height="${env.H}" fill="${BG(sc.bg, B)}"/>`;
  if (sc.grid) o += `<g opacity="${sc.grid}">${gridDots(env.W, env.H, sc.bg === 'ink' ? '#FFFFFF' : B.ink)}</g>`;
  for (const it of sc.under || []) o += env.renderInner(it.id, t, { at: it.at, dur: it.dur, params: resolveScreen(it, t, env) }, env.ctx);
  for (const h of sc.heads || []) o += headSVG(h, t, env);
  for (const k of sc.kickers || []) o += kickerSVG(k, t, env);
  for (const it of sc.items || []) o += env.renderInner(it.id, t, { at: it.at, dur: it.dur, params: resolveScreen(it, t, env) }, env.ctx);
  if (sc.mark) o += revealSVG(sc.mark, t, env);
  if (sc.card) o += endSVG(sc.card, t, env);
  if (sc.caption) o += captionSVG(sc.caption, t, env);
  for (const l of sc.labels || []) if (t >= l.at) o += `<text x="${f2(l.x)}" y="${f2(l.y)}" font-family="${esc(FONT)}" font-size="${f2(l.size)}" font-weight="600" fill="${l.color ?? '#5D5A66'}" text-anchor="${l.anchor ?? 'start'}">${esc(l.text)}</text>`;
  return o;
}
const gridDots = (W, H, col) => { let d = ''; for (let y = 30; y < H; y += 60) for (let x = 30; x < W; x += 60) d += `M${x} ${y}h0.01`; return `<path d="${d}" stroke="${col}" stroke-opacity="0.12" stroke-width="3.4" stroke-linecap="round"/>`; };
