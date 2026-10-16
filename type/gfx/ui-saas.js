/* motion-pack / type / gfx / ui-saas.js: the SaaS launch / product-demo kit, part 1 (2026-10-16, lane xp-saas). Same contract as every gfx part (core.js): svg(L, p, ctx) -> SVG markup,
   a pure function of t; motion on the closed-form springs of ../ease.js and the bezier eases of E, so any frame renders the same in any seek order. Generic layout of our own: no product's
   trade dress (the window chrome has three NEUTRAL grey dots, never coloured ones), no logos, no real app names. Demo copy is for the fictional "Acme Flow".
     ui.appWindow        an app / browser window frame, light or dark chrome, with a screen slot: a screenshot (`screen.src`), an HTML screen (`screen.html`, drawn through foreignObject at its
                         native size) or the built-in placeholder screen; ken-burns drift (`kb`) and zoom-to-region from a keyframed rect list (`zoom: [{t, rect: [x, y, w, h]}]`, screen fractions).
                         appWindowGeo(p, ctx, u) gives the window, its content rect and map(sx, sy) -> frame px, so a cursor, a callout or a DOM <video> can follow the zoom.
     ui.cursorJourney    a cursor driven by a JSON path [{t, x, y, click?, hover?: [x, y, w, h], down?, up?, carry?: 'label', hand?}]: eased arcs between keys, click press + ripple, hover
                         highlight, drag (pressed cursor, a carried chip); `win: {at, params}` puts the path in a ui.appWindow's SCREEN coordinates (it follows the zoom on every frame)
     callout.uiHighlight  a rounded ring that draws on around a rect, a soft fill, one pulse and a label pill (frame or `win` screen coordinates)
     callout.arrowLabel  a clean arrow from a label pill to a point, drawn on, with a head (the hand-drawn one is callout.handArrow)
     ui.commandBar       a command palette: query typed, the result list filters as you type, the selection moves, enter flashes the row and closes the panel
     ui.aiAnswer         a typed prompt, a thinking beat, a streaming answer (word by word, with a caret) and an optional Apply button that gets clicked; labelled as a demo answer
     ui.shortcutChip     keycaps (owned glyph paths for the modifier keys) that press in sequence, with a label
   Sound: SAAS_CUES[id](p) -> [{ t (local s), id: 'sfx/<cat>/<name>', why }]; index.js exposes them through uiCues / gfxCues with the item's `at` applied. Part 2: ui-saas2.js. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, INK, esc, f2, text, measure, PLACEHOLDER, srcOf } from './core.js';
import { KIT } from './ui.js';
import { springTrack, spring } from '../ease.js';
const { THEME, rect, shadowDef, softShadow, icon, pressAt, typed, ripple } = KIT;
export { PLACEHOLDER, srcOf };

/* the size unit: 1 at 1080 on the SHORT side of the frame (a 9:16 frame is not drawn 1.78x larger), times the part's `scale` (applied to c.s by the loop at the bottom) */
export const unit = (c) => c.s * Math.min(1, c.W / c.H);
const th = (p) => THEME[p.theme] || THEME.light;
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const box4 = (b, c) => [num(b?.[0]) * c.W, num(b?.[1]) * c.H, Math.max(1, num(b?.[2], 0.5) * c.W), Math.max(1, num(b?.[3], 0.5) * c.H)];
const op = (v) => (v >= 0.999 ? '' : ` opacity="${f2(clamp(v))}"`);
const list = (v) => (Array.isArray(v) ? v.slice(0, 64) : []);
const sorted = (v) => list(v).filter((k) => k && Number.isFinite(+k.t)).slice().sort((a, b) => a.t - b.t);
export const WIN_D = { box: [0.12, 0.1, 0.76, 0.8], theme: 'light', chrome: 'browser', title: 'Acme Flow', url: 'flow.example', accent: BRAND, screen: { src: null, html: null, w: 1440, h: 900, anchor: [0.5, 0] },
  zoom: [], move: [], kb: [1, 1], radius: 16, enter: 'rise', label: 'placeholder UI · demo data', labelSize: 22, shadow: true };

/* ---------- the screen slot: cover-fit, anchor, zoom keys, ken-burns, clamped so the screen always covers the content rect ---------- */
/* zoom key state: rect [x, y, w, h] in screen fractions fills the content rect (contain) about its centre; rect null = the base fit */
function zoomState(cr, base, sw, sh, rect_) {
  if (!Array.isArray(rect_)) return { S: 1, tx: 0, ty: 0 };
  const [rx, ry, rw, rh] = [num(rect_[0]), num(rect_[1]), clamp(num(rect_[2], 1), 0.02, 1), clamp(num(rect_[3], 1), 0.02, 1)];
  const S = clamp(Math.min(cr[2] / (rw * sw * base.f), cr[3] / (rh * sh * base.f)), 1, 12), px = base.ox + base.f * (rx + rw / 2) * sw, py = base.oy + base.f * (ry + rh / 2) * sh;
  return { S, tx: cr[0] + cr[2] / 2 - S * px, ty: cr[1] + cr[3] / 2 - S * py };
}
export function screenMap(cr, scr, u, zoom, kb, dur = 4) {
  const sw = Math.max(16, num(scr?.w, 1440)), sh = Math.max(16, num(scr?.h, 900)), an = scr?.anchor || [0.5, 0], f = Math.max(cr[2] / sw, cr[3] / sh);
  const base = { f, ox: cr[0] + (cr[2] - f * sw) * clamp(num(an[0], 0.5)), oy: cr[1] + (cr[3] - f * sh) * clamp(num(an[1], 0)) };
  const keys = sorted(zoom); let z = { S: 1, tx: 0, ty: 0 };
  if (keys.length) { const st = keys.map((k) => zoomState(cr, base, sw, sh, k.rect)), ch = [[0, [0, 0, 0]], ...keys.map((k, i) => [k.t, [Math.log(st[i].S), st[i].tx, st[i].ty]])];
    const v = springTrack(u, ch, 'camera'); z = { S: Math.exp(v[0]), tx: v[1], ty: v[2] }; }
  const k0 = num(kb?.[0], 1), k1 = num(kb?.[1], 1), kbs = clamp(lerp(k0, k1, clamp(u / Math.max(0.1, dur))), 0.5, 3), cx = cr[0] + cr[2] / 2, cy = cr[1] + cr[3] / 2;
  let A = Math.max(1, z.S * kbs) * f, X = kbs * (z.S * base.ox + z.tx - cx) + cx, Y = kbs * (z.S * base.oy + z.ty - cy) + cy;   // screen px p -> (X + A * px, Y + A * py)
  X = clamp(X, cr[0] + cr[2] - A * sw, cr[0]); Y = clamp(Y, cr[1] + cr[3] - A * sh, cr[1]);
  return { A, X, Y, sw, sh, map: (sx, sy) => [X + A * sx * sw, Y + A * sy * sh] };
}
/* the built-in placeholder screen (no src, no html): a generic dashboard drawn in screen px, labelled by the caller */
function placeholderScreen(sw, sh, T, accent) {
  const bars = [0.42, 0.66, 0.5, 0.82, 0.58, 0.74, 0.9].map((v, i) => rect(560 + i * 92, 690 - v * 230, 54, v * 230, 8, i === 6 ? accent : T.faint)).join('');
  return rect(0, 0, sw, sh, 0, T.bg) + rect(0, 0, 260, sh, 0, T.panel) + [0, 1, 2, 3, 4, 5].map((i) => rect(32, 110 + i * 58, i ? 150 : 180, 22, 11, i === 1 ? accent : T.chip)).join('') +
    rect(300, 40, 420, 34, 10, T.ink) + [0, 1, 2].map((i) => rect(300 + i * 370, 110, 340, 150, 18, T.panel) + rect(330 + i * 370, 140, 120, 18, 9, T.faint) + rect(330 + i * 370, 180, 190, 46, 12, i ? T.chip : accent)).join('') +
    rect(300, 300, 1100, 420, 18, T.panel) + bars + [0, 1, 2].map((i) => rect(300, 760 + i * 44, 1100, 30, 8, i % 2 ? T.chip : T.panel)).join('');
}
/* draw a screen (image, HTML through foreignObject, or the placeholder) into the content rect cr, clipped with corner radius r */
export function screenMarkup(id, cr, scr, M, T, accent, r) {
  const sw = M.sw, sh = M.sh, tr = `matrix(${f2(M.A)} 0 0 ${f2(M.A)} ${f2(M.X)} ${f2(M.Y)})`;
  const inner = scr && scr.src ? `<image href="${esc(scr.src)}" x="0" y="0" width="${f2(sw)}" height="${f2(sh)}" preserveAspectRatio="none"/>`
    : scr && scr.html ? `<foreignObject x="0" y="0" width="${f2(sw)}" height="${f2(sh)}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${f2(sw)}px;height:${f2(sh)}px;overflow:hidden">${scr.html}</div></foreignObject>`
    : placeholderScreen(sw, sh, T, accent);
  return `<clipPath id="${id}"><rect x="${f2(cr[0])}" y="${f2(cr[1])}" width="${f2(cr[2])}" height="${f2(cr[3])}" rx="${f2(r)}"/></clipPath><g clip-path="url(#${id})">${rect(cr[0], cr[1], cr[2], cr[3], 0, T.bg)}<g transform="${tr}">${inner}</g></g>`;
}
/* a small dark label pill (honesty labels: "placeholder UI · demo data") */
export function labelPill(str, x, y, size, anchor = 'start', fg = '#FFFFFF', bg = 'rgba(14,13,20,0.78)') {
  if (!str) return ''; const w = measure(str, size, { weight: 700 }) + size * 1.2, h = size * 1.75, x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return rect(x0, y - h, w, h, h / 2, bg) + text(str, x0 + size * 0.6, y - h * 0.32, { size, weight: 700, fill: fg });
}

/* ---------- 1. app window ---------- */
export function appWindowGeo(p0, c, u, dur = 4) {
  const p = { ...WIN_D, ...p0, screen: { ...WIN_D.screen, ...(p0?.screen || {}) } }, s = unit(c), mv = sorted(p.move).filter((k) => Array.isArray(k.box) && k.box.length === 4), [x, y, w, h] = box4(mv.length ? springTrack(u, [[0, list(p.box).length === 4 ? p.box : WIN_D.box], ...mv.map((k) => [k.t, k.box])], 'panel') : p.box, c), bar = p.chrome === 'none' ? 0 : (p.chrome === 'app' ? 40 : 48) * s;
  const k = p.enter === 'none' ? 1 : spring(u, 'panel'), lift = p.enter === 'none' ? 0 : (1 - k) * 70 * s, sc = p.enter === 'scale' ? lerp(0.92, 1, k) : lerp(0.975, 1, k);
  const cr = [x, y + bar, w, h - bar], M = screenMap(cr, p.screen, u, p.zoom, p.kb, dur), cx = x + w / 2, cy = y + h / 2;
  const toFrame = (X, Y) => [cx + (X - cx) * sc, cy + (Y - cy) * sc + lift];   // the window's own entrance transform
  return { p, s, box: [x, y, w, h], bar, content: cr, M, k, lift, sc, map: (sx, sy) => toFrame(...M.map(sx, sy)), toFrame, transform: `translate(${f2(cx)} ${f2(cy + lift)}) scale(${f2(sc)}) translate(${f2(-cx)} ${f2(-cy)})` };
}
function chromeBar(G, T, p) {
  const [x, y, w] = G.box, s = G.s, b = G.bar, r = num(p.radius, 16) * s; if (!b) return '';
  const dots = [0, 1, 2].map((i) => `<circle cx="${f2(x + 24 * s + i * 20 * s)}" cy="${f2(y + b / 2)}" r="${f2(6 * s)}" fill="${T.faint}"/>`).join('');
  const head = `<path d="M${f2(x)} ${f2(y + b)} V${f2(y + r)} Q${f2(x)} ${f2(y)} ${f2(x + r)} ${f2(y)} H${f2(x + w - r)} Q${f2(x + w)} ${f2(y)} ${f2(x + w)} ${f2(y + r)} V${f2(y + b)} Z" fill="${T.chip}"/>`;
  if (p.chrome === 'app') return head + dots + text(p.title, x + w / 2, y + b / 2 + 7 * s, { size: 19 * s, weight: 700, fill: T.muted, anchor: 'middle' });
  const tw = Math.min(w * 0.3, measure(p.title, 17 * s, { weight: 700 }) + 64 * s), tab = rect(x + 92 * s, y + 8 * s, tw, b - 8 * s, 10 * s, T.panel) + text(p.title, x + 92 * s + 18 * s, y + b / 2 + 9 * s, { size: 17 * s, weight: 700, fill: T.ink });
  const uw = Math.min(w * 0.36, 460 * s), ux = x + w / 2 - uw / 2 + tw * 0.25;
  const url = w > 700 * s ? rect(ux, y + 10 * s, uw, b - 20 * s, (b - 20 * s) / 2, T.panel) + text(p.url, ux + uw / 2, y + b / 2 + 6 * s, { size: 16 * s, weight: 600, fill: T.muted, anchor: 'middle', font: MONO }) : '';
  return head + dots + tab + url;
}
const appWindow = { tags: ['ui', 'window', 'browser', 'app', 'screenshot', 'screen-recording', 'zoom', 'ken-burns', 'saas', 'product-demo'], dur: 6, inF: 12, outF: 9, d: WIN_D,
  svg(L, p, c) {
    const G = appWindowGeo(p, c, L.u, L.total), T = th(G.p), s = G.s, [x, y, w, h] = G.box, r = num(G.p.radius, 16) * s, id = 'aw';
    const body = rect(x, y, w, h, r, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`), cr = G.content;
    const scr = screenMarkup(id + 'c', cr, G.p.screen, G.M, T, G.p.accent, Math.min(r, 6 * s)), lab = G.p.label ? labelPill(G.p.label, cr[0] + 18 * s, cr[1] + cr[3] - 18 * s, num(G.p.labelSize, 22) * s) : '';
    const sh = G.p.shadow ? `<defs>${shadowDef(id + 's', s * 1.6)}</defs>${softShadow(id + 's', x, y + 10 * s, w, h, r, s, 0.9 * G.k)}` : '';
    return `<g${op(clamp(G.k * 1.8) * (1 - L.out))} transform="${G.transform}">${sh}${body}${scr}${chromeBar(G, T, G.p)}${lab}</g>`; } };

/* ---------- coordinates: frame fractions, or the SCREEN of a ui.appWindow (win: { at, params }) followed through its zoom on every frame ---------- */
export function spaceOf(p, L, c) {
  if (!p.win || typeof p.win !== 'object') return { pt: (x, y) => [num(x) * c.W, num(y) * c.H], scale: 1, win: false };
  const wp = p.win.params || {}, c0 = { ...c, s: (c.s0 ?? c.s) * (num(wp.scale, 1) || 1) }, G = appWindowGeo(wp, c0, num(L.t, L.u) - num(p.win.at), num(p.win.dur, 6));
  return { pt: (x, y) => G.map(num(x), num(y)), scale: (G.M.A * G.M.sw * G.sc) / Math.max(1, c.W), win: true, G };
}
const rectIn = (sp, b) => { const [x0, y0] = sp.pt(b[0], b[1]), [x1, y1] = sp.pt(num(b[0]) + num(b[2]), num(b[1]) + num(b[3])); return [x0, y0, x1 - x0, y1 - y0]; };

/* ---------- 2. cursor journey ---------- */
const CUR_D = { path: [{ t: 0.1, x: 0.72, y: 0.78 }, { t: 0.9, x: 0.42, y: 0.44, click: true }, { t: 1.8, x: 0.6, y: 0.56, hover: [0.53, 0.52, 0.14, 0.08] }, { t: 2.5, x: 0.6, y: 0.56, down: true, carry: 'Step' }, { t: 3.4, x: 0.34, y: 0.68, up: true }],
  arc: 0.16, win: null, size: 1, color: '#111111', outline: '#FFFFFF', ring: BRAND, hover: 'rgba(74,24,237,0.10)', shadow: true };
const CHIP = (x, y, s, label, T, accent) => { const fs = 20 * s, w = measure(label, fs, { weight: 700 }) + 40 * s, h = 46 * s;
  return `<g transform="translate(${f2(x + 14 * s)} ${f2(y + 18 * s)}) rotate(-3)">${rect(3 * s, 8 * s, w, h, 12 * s, 'rgba(20,18,34,0.18)')}${rect(0, 0, w, h, 12 * s, T.panel, `stroke="${accent}" stroke-width="${f2(2 * s)}"`)}${text(label, 20 * s, h / 2 + 7 * s, { size: fs, weight: 700, fill: T.ink })}</g>`; };
/* the move window of the segment that ARRIVES at key i: [t0, t1] (a screen element that follows a drag eases with E.cam over the same window) */
export function cursorLeg(p, i) { const P = sorted(p.path), a = P[i - 1], b = P[i]; if (!a || !b) return null; const d = Math.hypot(num(b.x) - num(a.x), num(b.y) - num(a.y)), dwell = a.click || a.down || a.up ? 0.14 : 0.04; return [Math.max(a.t + dwell, b.t - (0.32 + 0.55 * Math.min(1, d))), b.t]; }
/* where the cursor is at local time u: { x, y (in the path's space), press 0..1, drag (key | null), hover (key | null), hand } */
export function cursorAt(p, u) {
  const P = sorted(p.path); if (!P.length) return null;
  let x = num(P[0].x), y = num(P[0].y), seg_ = -1;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], d = Math.hypot(num(b.x) - num(a.x), num(b.y) - num(a.y)), dwell = a.click || a.down || a.up ? 0.14 : 0.04;
    const t1 = b.t, t0 = Math.max(a.t + dwell, t1 - (0.32 + 0.55 * Math.min(1, d))); if (u < t0) break;
    const k = E.cam(seg(u, t0, t1)), side = i % 2 ? 1 : -1, arc = num(b.arc ?? p.arc, 0.16), mx = (num(a.x) + num(b.x)) / 2 - side * arc * (num(b.y) - num(a.y)), my = (num(a.y) + num(b.y)) / 2 + side * arc * (num(b.x) - num(a.x));   // b.arc: a per-key arc (0 = straight, e.g. a drag that a screen element follows)
    x = (1 - k) ** 2 * num(a.x) + 2 * (1 - k) * k * mx + k * k * num(b.x); y = (1 - k) ** 2 * num(a.y) + 2 * (1 - k) * k * my + k * k * num(b.y); seg_ = i; }
  let press = 0, drag = null, hover = null, hand = false;
  for (const q of P) if (q.click) press = Math.max(press, pressAt(u, q.t + 0.04));
  for (let i = 0; i < P.length; i++) { const q = P[i]; if (q.down && u >= q.t) { const up = P.slice(i + 1).find((z) => z.up); if (!up || u < up.t + 0.06) { drag = q; press = Math.max(press, clamp((u - q.t) / 0.06)); } } }
  for (let i = 0; i < P.length; i++) { const q = P[i], nx = P[i + 1]; if (q.hover && u >= q.t - 0.05 && (!nx || u < nx.t - 0.25)) hover = q; if (u >= q.t - 0.1) hand = !!q.hand; }
  return { x, y, press: clamp(press, 0, 1.2), drag, hover, hand, seg: seg_, P };
}
const arrowPath = 'M0 0 L0 30 L8 23 L13.5 35 L19 32.5 L13.5 21 L24 21 Z', handPath = 'M8 14 V3.5 a2.5 2.5 0 0 1 5 0 V12 a2.4 2.4 0 0 1 4.8 0 V13 a2.4 2.4 0 0 1 4.8 0 V14.5 a2.4 2.4 0 0 1 4.8 0 V24 c0 6 -4 10 -10 10 h-2 c-4 0 -6.5 -2 -8.5 -5 L1.5 21.5 a2.6 2.6 0 0 1 4 -3.2 L8 21 Z';
const cursorJourney = { tags: ['ui', 'cursor', 'click', 'drag', 'hover', 'path', 'json', 'tour', 'saas', 'product-demo'], dur: 4.2, inF: 6, outF: 6, d: CUR_D,
  svg(L, p, c) {
    const st = cursorAt(p, L.u); if (!st || L.u < st.P[0].t - 0.3) return ''; const sp = spaceOf(p, L, c), s = unit(c) * num(p.size, 1), T = THEME.light;
    let fx = '';
    if (st.hover && Array.isArray(st.hover.hover)) { const [hx, hy, hw, hh] = rectIn(sp, st.hover.hover), k = clamp((L.u - st.hover.t + 0.05) / 0.15); fx += rect(hx, hy, hw, hh, 10 * s, p.hover, `opacity="${f2(k)}"`); }
    for (const q of st.P) if (q.click || q.up) { const [qx, qy] = sp.pt(q.x, q.y); fx += ripple(qx, qy, L.u - q.t - 0.04, s * 1.1, p.ring) + ripple(qx, qy, L.u - q.t - 0.12, s * 0.7, p.ring); }
    const [X, Y] = sp.pt(st.x, st.y), carry = st.drag && st.drag.carry ? CHIP(X, Y, s, String(st.drag.carry), T, p.ring) : '', k = clamp((L.u - st.P[0].t + 0.3) / 0.2) * (1 - L.out);
    const sc = s * 1.35 * (1 - 0.12 * st.press), shp = st.hand ? handPath : arrowPath, ox = st.hand ? -12 : 0;
    const shadow = p.shadow ? `<path d="${shp}" transform="translate(${f2(X + 3 * s)} ${f2(Y + 5 * s)}) scale(${f2(sc)}) translate(${ox} 0)" fill="rgba(0,0,0,0.22)"/>` : '';
    return `<g${op(k)}>${fx}${carry}${shadow}<path d="${shp}" transform="translate(${f2(X)} ${f2(Y)}) scale(${f2(sc)}) translate(${ox} 0)" fill="${p.color}" stroke="${p.outline}" stroke-width="2.2" stroke-linejoin="round"/></g>`; } };

/* ---------- 3. callouts ---------- */
const HB_D = { box: [0.38, 0.4, 0.24, 0.12], win: null, color: BRAND, width: 4, radius: 14, pad: 10, label: 'Rules you can read', labelPos: 'top', fill: 0.07, pulse: true, size: 1 };
const highlightBox = { tags: ['callout', 'highlight', 'box', 'focus', 'ui', 'label', 'saas', 'tutorial'], dur: 2.5, inF: 10, outF: 8, d: HB_D,
  svg(L, p, c) {
    const sp = spaceOf(p, L, c), s = unit(c) * num(p.size, 1), pad = num(p.pad, 10) * s, [bx, by, bw, bh] = rectIn(sp, list(p.box).length === 4 ? p.box : HB_D.box), x = bx - pad, y = by - pad, w = bw + 2 * pad, h = bh + 2 * pad;
    const r = Math.min(num(p.radius, 14) * s, w / 2, h / 2), per = 2 * (w + h) - (8 - 2 * Math.PI) * r, d = E.enter(seg(L.u, 0, 0.42)), o = 1 - L.out;
    const ring = `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(r)}" fill="${p.color}" fill-opacity="${f2(num(p.fill, 0.07) * d)}" stroke="${p.color}" stroke-width="${f2(num(p.width, 4) * s)}" stroke-dasharray="${f2(per * d)} ${f2(per)}" stroke-linecap="round"/>`;
    const pu = seg(L.u, 0.42, 1.1), pulse = p.pulse && pu > 0 && pu < 1 ? `<rect x="${f2(x - 14 * s * E.enter(pu))}" y="${f2(y - 14 * s * E.enter(pu))}" width="${f2(w + 28 * s * E.enter(pu))}" height="${f2(h + 28 * s * E.enter(pu))}" rx="${f2(r + 14 * s * E.enter(pu))}" fill="none" stroke="${p.color}" stroke-width="${f2(2 * s)}" opacity="${f2(0.5 * (1 - pu))}"/>` : '';
    let lab = ''; if (p.label) { const fs = 24 * s, lw = measure(p.label, fs, { weight: 700 }) + 34 * s, lh = 46 * s, top = p.labelPos !== 'bottom', lx = clamp(x, 8 * s, c.W - lw - 8 * s), ly = top ? y - lh - 12 * s : y + h + 12 * s, k = spring(L.u - 0.28, 'headline');
      if (k > 0) lab = `<g transform="translate(${f2(lx)} ${f2(ly + lh)}) scale(${f2(Math.max(0.001, k))}) translate(0 ${f2(-lh)})">${rect(0, 0, lw, lh, lh / 2, p.color)}${text(p.label, 17 * s, lh / 2 + 8.5 * s, { size: fs, weight: 700, fill: '#FFFFFF' })}</g>`; }
    return `<g${op(o)}>${pulse}${ring}${lab}</g>`; } };
const AL_D = { from: [0.72, 0.28], to: [0.52, 0.46], win: null, label: 'Drag to reorder', color: INK, bg: '#FFFFFF', accent: BRAND, bend: 0.22, width: 4, size: 1 };
const arrowLabel = { tags: ['callout', 'arrow', 'label', 'point', 'ui', 'annotation', 'saas', 'tutorial'], dur: 2.5, inF: 12, outF: 8, d: AL_D,
  svg(L, p, c) {
    const sp = spaceOf(p, L, c), s = unit(c) * num(p.size, 1), fs = 26 * s, lw = measure(p.label, fs, { weight: 700 }) + 40 * s, lh = 54 * s, [lx0, ly0] = [num(p.from?.[0], 0.7) * c.W, num(p.from?.[1], 0.3) * c.H], [tx, ty] = sp.pt(p.to?.[0], p.to?.[1]);
    const lx = clamp(lx0 - lw / 2, 8 * s, c.W - lw - 8 * s), ly = clamp(ly0 - lh / 2, 8 * s, c.H - lh - 8 * s), ax = lx + lw / 2, ay = ty > ly + lh ? ly + lh : ty < ly ? ly : ly + lh / 2;
    const dx = tx - ax, dy = ty - ay, D = Math.max(1, Math.hypot(dx, dy)), ex = tx - (dx / D) * 16 * s, ey = ty - (dy / D) * 16 * s, mx = (ax + ex) / 2 - num(p.bend, 0.22) * (ey - ay), my = (ay + ey) / 2 + num(p.bend, 0.22) * (ex - ax);
    const len = D * 1.12, k = spring(L.u, 'headline'), d = E.enter(seg(L.u, 0.18, 0.62)), o = 1 - L.out;
    const ang = Math.atan2(ey - my, ex - mx), hs = 16 * s, head = d >= 0.98 ? `<path d="M${f2(ex - hs * Math.cos(ang - 0.5))} ${f2(ey - hs * Math.sin(ang - 0.5))} L${f2(ex)} ${f2(ey)} L${f2(ex - hs * Math.cos(ang + 0.5))} ${f2(ey - hs * Math.sin(ang + 0.5))}" fill="none" stroke="${p.accent}" stroke-width="${f2(num(p.width, 4) * s)}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    const line = `<path d="M${f2(ax)} ${f2(ay)} Q${f2(mx)} ${f2(my)} ${f2(ex)} ${f2(ey)}" fill="none" stroke="${p.accent}" stroke-width="${f2(num(p.width, 4) * s)}" stroke-linecap="round" stroke-dasharray="${f2(len * d)} ${f2(len)}"/>`;
    const dot = d >= 0.98 ? `<circle cx="${f2(tx)}" cy="${f2(ty)}" r="${f2(7 * s * spring(L.u - 0.62, 'headline'))}" fill="${p.accent}"/>` : '';
    const pill = k > 0 ? `<g transform="translate(${f2(lx + lw / 2)} ${f2(ly + lh / 2)}) scale(${f2(Math.max(0.001, k))}) translate(${f2(-lw / 2)} ${f2(-lh / 2)})">${rect(2 * s, 5 * s, lw, lh, lh / 2, 'rgba(20,18,34,0.16)')}${rect(0, 0, lw, lh, lh / 2, p.bg, `stroke="${p.accent}" stroke-width="${f2(2 * s)}"`)}${text(p.label, 20 * s, lh / 2 + 9 * s, { size: fs, weight: 700, fill: p.color })}</g>` : '';
    return `<g${op(o)}>${line}${head}${dot}${pill}</g>`; } };

/* ---------- 4. command bar ---------- */
const CMD_D = { box: [0.27, 0.2, 0.46, 0.5], query: 'route', placeholder: 'Type a command…', typeAt: 0.45, cps: 12, select: 0, selectAt: null, enterAt: null, close: true, dim: 0.32, theme: 'light', accent: BRAND,
  items: [{ label: 'Route new requests', icon: 'branch', hint: 'Flow' }, { label: 'Create a flow', icon: 'bolt', hint: 'New' }, { label: 'Search runs', icon: 'search', hint: 'Runs' }, { label: 'Invite a teammate', icon: 'user', hint: 'Team' }, { label: 'Open settings', icon: 'pen', hint: 'App' }, { label: 'Route by topic', icon: 'branch', hint: 'Rule' }] };
export function commandTimes(p) { const q = String(p.query ?? ''), cps = Math.max(1, num(p.cps, 12)), typeAt = num(p.typeAt, 0.45), typeEnd = typeAt + q.length / cps, selectAt = p.selectAt == null ? typeEnd + 0.3 : num(p.selectAt), enterAt = p.enterAt == null ? selectAt + 0.55 : num(p.enterAt);
  return { typeAt, typeEnd, selectAt, enterAt }; }
const commandBar = { tags: ['ui', 'command', 'palette', 'search', 'keyboard', 'shortcut', 'filter', 'saas', 'product-demo'], dur: 3.6, inF: 8, outF: 8, d: CMD_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c) * num(p.scale, 1), u = L.u, [x, y, w] = box4(p.box, c), tm = commandTimes(p), q = typed(p.query ?? '', u, tm.typeAt, Math.max(1, num(p.cps, 12))).toLowerCase();
    const all = list(p.items), shown = all.filter((it) => !q || String(it.label).toLowerCase().includes(q)), rowH = 64 * s, inH = 84 * s, n = Math.min(7, shown.length);
    const hk = springTrack(u, [[0, Math.min(7, all.length)], [tm.typeAt + 0.05, n]], 'ui'), H = inH + 16 * s + Math.max(0, hk) * rowH + 14 * s, k = spring(u, 'ui');
    const closing = p.close ? E.exit(seg(u, tm.enterAt + 0.28, tm.enterAt + 0.5)) : 0; if (closing >= 1) return '';   // closed: nothing left to draw
    const sc = lerp(0.96, 1, k) * (1 - 0.04 * closing), o = clamp(k * 1.6) * (1 - closing) * (1 - L.out);
    const sel = clamp(Math.round(num(p.select, 0)), 0, Math.max(0, n - 1)), hl = springTrack(u, [[0, 0], [tm.selectAt, sel]], 'ui'), flash = u >= tm.enterAt ? 1 - seg(u, tm.enterAt, tm.enterAt + 0.3) : 0, id = 'cmd';
    const fsz = 30 * s, typing = u >= tm.typeAt && u < tm.typeEnd + 0.1, input = q ? text(typed(p.query ?? '', u, tm.typeAt, Math.max(1, num(p.cps, 12))), x + 76 * s, y + inH / 2 + 10 * s, { size: fsz, weight: 600, fill: T.ink }) : text(p.placeholder, x + 76 * s, y + inH / 2 + 10 * s, { size: fsz, weight: 500, fill: T.muted });
    const cx = x + 76 * s + (q ? measure(typed(p.query ?? '', u, tm.typeAt, Math.max(1, num(p.cps, 12))), fsz, { weight: 600 }) : 0) + 3 * s, caretOn = typing || Math.floor(u * 2) % 2 === 0;
    let rows = ''; shown.slice(0, n).forEach((it, i) => { const ry = y + inH + 8 * s + i * rowH, a = clamp(hk - i + 0.5); if (a <= 0.01) return;
      rows += `<g${op(a)}>${icon(it.icon || 'doc', x + 28 * s, ry + 18 * s, 28 * s, T.muted, 2)}${text(it.label, x + 76 * s, ry + rowH / 2 + 9 * s, { size: 26 * s, weight: 600, fill: T.ink })}` +
        (it.hint ? text(it.hint, x + w - 28 * s, ry + rowH / 2 + 8 * s, { size: 20 * s, weight: 600, fill: T.muted, anchor: 'end' }) : '') + '</g>'; });
    const hy = y + inH + 8 * s + clamp(hl, 0, Math.max(0, n - 1)) * rowH, hiRow = n ? rect(x + 10 * s, hy, w - 20 * s, rowH, 12 * s, flash > 0 ? p.accent : T.chip, flash > 0 ? `fill-opacity="${f2(0.25 + 0.6 * flash)}"` : '') : '';
    const dim = num(p.dim, 0) > 0 ? `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="#0B0A12" opacity="${f2(num(p.dim, 0) * clamp(k) * (1 - closing) * (1 - L.out))}"/>` : '';
    const cxm = x + w / 2, cym = y + H / 2;
    return `${dim}<g${op(o)} transform="translate(${f2(cxm)} ${f2(cym)}) scale(${f2(sc)}) translate(${f2(-cxm)} ${f2(-cym)})"><defs>${shadowDef(id + 's', s * 1.8)}</defs>${softShadow(id + 's', x, y, w, H, 20 * s, s, 1, 'rgba(10,8,20,0.32)')}` +
      rect(x, y, w, H, 20 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`) + icon('search', x + 28 * s, y + inH / 2 - 14 * s, 28 * s, T.muted, 2.2) + input +
      (caretOn && u >= tm.typeAt - 0.3 ? rect(cx, y + inH / 2 - 18 * s, 3 * s, 36 * s, 1.5 * s, p.accent) : '') + rect(x, y + inH, w, 1.2 * s, 0, T.line) + hiRow + rows + '</g>'; } };

/* ---------- 5. AI answer: prompt -> thinking -> streaming answer -> apply ---------- */
const ANS_D = { box: [0.2, 0.14, 0.6, 0.72], prompt: 'Send each new request to the right team', typeAt: 0.3, cps: 26, sendAt: null, thinkS: 0.8, wps: 9, title: 'Ask Acme Flow', avatar: 'A', theme: 'light', accent: BRAND,
  answer: ['Done. Here is a flow in three steps:', '• Read each new request as it lands', '• Pick the team from its topic', '• Post it to that team and reply'], apply: 'Apply flow', applyAt: null, label: 'demo answer · placeholder' };
export function answerTimes(p) { const q = String(p.prompt ?? ''), cps = Math.max(1, num(p.cps, 26)), typeAt = num(p.typeAt, 0.3), typeEnd = typeAt + q.length / cps, sendAt = p.sendAt == null ? typeEnd + 0.3 : num(p.sendAt);
  const words = list(p.answer).map((l) => String(l).split(/\s+/).filter(Boolean).length).reduce((a, b) => a + b, 0), streamAt = sendAt + Math.max(0, num(p.thinkS, 0.8)), streamEnd = streamAt + words / Math.max(0.5, num(p.wps, 9));
  return { typeAt, typeEnd, sendAt, streamAt, streamEnd, words, applyAt: p.apply ? (p.applyAt == null ? streamEnd + 0.7 : num(p.applyAt)) : null }; }
function wrapTo(str, size, maxW, weight = 500) { const out = []; let cur = ''; for (const wd of String(str).split(/\s+/).filter(Boolean)) { const nx = cur ? cur + ' ' + wd : wd; if (cur && measure(nx, size, { weight }) > maxW) { out.push(cur); cur = wd; } else cur = nx; } if (cur) out.push(cur); return out; }
const aiAnswer = { tags: ['ui', 'ai', 'prompt', 'chat', 'answer', 'streaming', 'typing', 'assistant', 'saas', 'product-demo'], dur: 6, inF: 10, outF: 8, d: ANS_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c) * num(p.scale, 1), u = L.u, [x, y, w, h] = box4(p.box, c), tm = answerTimes(p), k = spring(u, 'panel'), id = 'ans', pad = 34 * s;
    const head = rect(x, y, w, 74 * s, 0, 'none') + `<circle cx="${f2(x + pad + 18 * s)}" cy="${f2(y + 40 * s)}" r="${f2(18 * s)}" fill="${p.accent}"/>` + text(String(p.avatar).slice(0, 2), x + pad + 18 * s, y + 47 * s, { size: 19 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' }) + text(p.title, x + pad + 50 * s, y + 48 * s, { size: 24 * s, weight: 800, fill: T.ink }) + rect(x, y + 78 * s, w, 1.2 * s, 0, T.line);
    /* the input bar at the bottom: typing, then it clears on send */
    const ib = [x + pad, y + h - pad - 80 * s, w - 2 * pad, 80 * s], sent = u >= tm.sendAt, ty = sent ? '' : typed(p.prompt ?? '', u, tm.typeAt, Math.max(1, num(p.cps, 26))), ifs = 26 * s;
    const pr = pressAt(u, tm.sendAt), bs = 54 * s, bxx = ib[0] + ib[2] - bs - 13 * s, byy = ib[1] + 13 * s, typing = u >= tm.typeAt && u < tm.typeEnd + 0.05;
    const inputLine = ty ? wrapTo(ty, ifs, ib[2] - bs - 60 * s).slice(-1)[0] : '', inputTxt = ty ? text(inputLine, ib[0] + 24 * s, ib[1] + ib[3] / 2 + 9 * s, { size: ifs, weight: 600, fill: T.ink }) : text(sent ? 'Ask a follow-up…' : 'Describe what you want…', ib[0] + 24 * s, ib[1] + ib[3] / 2 + 9 * s, { size: ifs, weight: 500, fill: T.muted });
    const caretX = ib[0] + 24 * s + (ty ? measure(inputLine, ifs, { weight: 600 }) : 0) + 3 * s, caret = !sent && (typing || Math.floor(u * 2) % 2 === 0) && u >= tm.typeAt - 0.4 ? rect(caretX, ib[1] + ib[3] / 2 - 16 * s, 3 * s, 32 * s, 1.5, p.accent) : '';
    const input = rect(...ib, ib[3] / 2, T.chip, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`) + inputTxt + caret + `<g transform="translate(${f2(bxx + bs / 2)} ${f2(byy + bs / 2)}) scale(${f2(1 - 0.12 * pr)})">${rect(-bs / 2, -bs / 2, bs, bs, bs / 2, ty.length >= String(p.prompt ?? '').length || sent ? p.accent : T.faint)}${icon('send', -14 * s, -14 * s, 28 * s, '#FFFFFF', 2.6)}</g>`;
    /* the conversation: the user's bubble (right), then the assistant (left) */
    let conv = '', cy = y + 110 * s, bottom = cy; const bfs = 26 * s, bmax = w * 0.62;
    if (sent) { const lines = wrapTo(p.prompt, bfs, bmax - 48 * s, 600), bw = Math.max(...lines.map((l) => measure(l, bfs, { weight: 600 }))) + 48 * s, bh = lines.length * bfs * 1.32 + 30 * s, kb = spring(u - tm.sendAt, 'ui'), bx0 = x + w - pad - bw;
      conv += `<g${op(clamp(kb * 2))} transform="translate(0 ${f2((1 - kb) * 40 * s)})">${rect(bx0, cy, bw, bh, 22 * s, p.accent)}${lines.map((l, i) => text(l, bx0 + 24 * s, cy + 15 * s + bfs * (1.02 + i * 1.32), { size: bfs, weight: 600, fill: '#FFFFFF' })).join('')}</g>`; cy += bh + 26 * s; }
    if (u >= tm.sendAt + 0.15) { const ax = x + pad, av = `<circle cx="${f2(ax + 18 * s)}" cy="${f2(cy + 18 * s)}" r="${f2(18 * s)}" fill="${T.chip}" stroke="${T.line}"/>` + text(String(p.avatar).slice(0, 2), ax + 18 * s, cy + 25 * s, { size: 18 * s, weight: 800, fill: p.accent, anchor: 'middle' });
      conv += av; const tx = ax + 54 * s, afs = 26 * s, maxW = w - 2 * pad - 70 * s;
      if (u < tm.streamAt) { for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin((u * 2.6 - i * 0.2) * TAU)); conv += `<circle cx="${f2(tx + 14 * s + i * 22 * s)}" cy="${f2(cy + 20 * s - b * 6 * s)}" r="${f2(7 * s)}" fill="${T.muted}" opacity="${f2(0.4 + 0.6 * b)}"/>`; } }
      else { let left = Math.floor((u - tm.streamAt) * Math.max(0.5, num(p.wps, 9)) + 1e-9), ly = cy + 26 * s, lastX = tx, lastY = ly;
        for (const para of list(p.answer)) { if (left <= 0) break; const ws = String(para).split(/\s+/).filter(Boolean), take = ws.slice(0, left); left -= take.length;
          const lines = wrapTo(take.join(' '), afs, maxW, 500); lines.forEach((l, i) => { conv += text(l, tx, ly, { size: afs, weight: /^done|^here/i.test(para) && i === 0 ? 700 : 500, fill: T.ink }); lastX = tx + measure(l, afs, { weight: 500 }); lastY = ly; ly += afs * 1.38; }); ly += afs * 0.22; }
        bottom = Math.max(bottom, ly);
        if (u < tm.streamEnd + 0.2) conv += rect(lastX + 6 * s, lastY - afs * 0.78, 12 * s, afs * 0.92, 2 * s, p.accent, `opacity="${Math.floor(u * 4) % 2 ? 0.45 : 1}"`);
        if (tm.applyAt != null && u >= tm.streamEnd + 0.15) { const ka = spring(u - tm.streamEnd - 0.15, 'headline'), pa = pressAt(u, tm.applyAt), lw = measure(p.apply, 24 * s, { weight: 700 }) + 56 * s, bh2 = 54 * s, ay = ly + 8 * s, done = u >= tm.applyAt + 0.1;
          bottom = Math.max(bottom, ay + bh2);
          conv += `<g transform="translate(${f2(tx + lw / 2)} ${f2(ay + bh2 / 2)}) scale(${f2(Math.max(0.001, ka) * (1 - 0.08 * pa))}) translate(${f2(-lw / 2)} ${f2(-bh2 / 2)})">${rect(0, 0, lw, bh2, bh2 / 2, done ? '#06A260' : p.accent)}${text(done ? 'Applied' : p.apply, lw / 2, bh2 / 2 + 8.5 * s, { size: 24 * s, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}</g>`;
          if (p.label) conv += text(p.label, tx + lw + 22 * s, ay + bh2 / 2 + 7 * s, { size: 18 * s, weight: 600, fill: T.muted }); }
        else if (p.label && u >= tm.streamEnd) conv += text(p.label, tx, ly + 10 * s, { size: 18 * s, weight: 600, fill: T.muted }); } }
    const limit = ib[1] - 14 * s, scroll = Math.max(0, bottom - limit), clip = `<clipPath id="${id}v"><rect x="${f2(x)}" y="${f2(y + 80 * s)}" width="${f2(w)}" height="${f2(Math.max(0, limit + 8 * s - y - 80 * s))}"/></clipPath>`;   // a long answer scrolls up like a chat, never under the input bar
    return `<g${op(clamp(k * 1.7) * (1 - L.out))} transform="translate(0 ${f2((1 - k) * 50 * s)})"><defs>${shadowDef(id + 's', s * 1.6)}${clip}</defs>${softShadow(id + 's', x, y, w, h, 24 * s, s, 1)}${rect(x, y, w, h, 24 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}${head}<g clip-path="url(#${id}v)"><g transform="translate(0 ${f2(-scroll)})">${conv}</g></g>${input}</g>`; } };

/* ---------- 6. keyboard shortcut chip ---------- */
const GLYPH = { '⌘': 'M9 9h6v6H9z M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9 M15 9V6.5A2.5 2.5 0 1 1 17.5 9H15 M9 15v2.5A2.5 2.5 0 1 1 6.5 15H9 M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15', '⇧': 'M12 4L4 12h4.5v7h7v-7H20z',
  '⌥': 'M3 6h5l7 12h6 M14 6h7', '⌃': 'M6 14l6-6l6 6', '↵': 'M19 6v6a2 2 0 0 1-2 2H6 M10 10l-4 4l4 4', '⌫': 'M9 5h11v14H9l-6-7z M12 9l5 6 M17 9l-5 6' };
const KEY_D = { keys: ['⌘', 'K'], label: 'Open anywhere', pos: [0.5, 0.5], pressAt: 0.5, stagger: 0.12, hold: 0.55, size: 1, theme: 'light', accent: BRAND, stack: false, plate: false };   // plate: a panel behind the chip (over busy UI)
const shortcutChip = { tags: ['ui', 'keyboard', 'shortcut', 'keycap', 'chip', 'changelog', 'saas', 'tutorial'], dur: 2.6, inF: 8, outF: 8, d: KEY_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c) * num(p.size, 1), u = L.u, keys = list(p.keys).map(String).slice(0, 6), kh = 96 * s, gap = 16 * s, kw = (kk) => Math.max(kh, measure(kk, 44 * s, { weight: 700 }) + 48 * s);
    const ws = keys.map((kk) => (GLYPH[kk] ? kh : kw(kk))), plus = 30 * s, rowW = ws.reduce((a, b) => a + b, 0) + Math.max(0, keys.length - 1) * (gap + plus), fsL = 40 * s, lw = p.label ? measure(p.label, fsL, { weight: 700 }) : 0;
    const totalW = p.stack ? Math.max(rowW, lw) : rowW + (p.label ? 40 * s + lw : 0), totalH = p.stack && p.label ? kh + 30 * s + fsL : kh;
    const cx = num(p.pos?.[0], 0.5) * c.W, cy = num(p.pos?.[1], 0.5) * c.H, x0 = cx - totalW / 2 + (p.stack ? (totalW - rowW) / 2 : 0), y0 = cy - totalH / 2, k = spring(u, 'headline');
    let out = '', kx = x0;
    keys.forEach((kk, i) => { const at = num(p.pressAt, 0.5) + i * num(p.stagger, 0.12), up = num(p.pressAt, 0.5) + (keys.length - 1) * num(p.stagger, 0.12) + num(p.hold, 0.55), pr = clamp(springTrack(u, [[0, 0], [at, 1], [up, 0]], 'ui'), 0, 1.15);
      const w = ws[i], lip = 10 * s * (1 - 0.7 * clamp(pr)), dy = 8 * s * clamp(pr), top = pr > 0.5 ? p.accent : T.panel, ink = pr > 0.5 ? '#FFFFFF' : T.ink;
      out += rect(kx, y0 + 10 * s, w, kh, 18 * s, T.faint) + rect(kx, y0 + dy, w, kh, 18 * s, top, `stroke="${T.line}" stroke-width="${f2(1.4 * s)}"`);
      out += GLYPH[kk] ? `<path transform="translate(${f2(kx + w / 2 - 22 * s)} ${f2(y0 + dy + (kh - lip) / 2 - 22 * s)}) scale(${f2(44 * s / 24)})" d="${GLYPH[kk]}" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>` : text(kk, kx + w / 2, y0 + dy + (kh - lip) / 2 + 15 * s, { size: 44 * s, weight: 700, fill: ink, anchor: 'middle' });
      kx += w; if (i < keys.length - 1) { out += text('+', kx + gap / 2 + plus / 2, y0 + kh / 2 + 12 * s, { size: 34 * s, weight: 600, fill: T.muted, anchor: 'middle' }); kx += gap + plus; } });
    if (p.label) out += p.stack ? text(p.label, cx, y0 + kh + 30 * s + fsL * 0.8, { size: fsL, weight: 700, fill: T.ink, anchor: 'middle' }) : text(p.label, x0 + rowW + 40 * s, y0 + kh / 2 + fsL * 0.36, { size: fsL, weight: 700, fill: T.ink });
    const pl = p.plate ? `<defs>${shadowDef('kcs', s * 1.4)}</defs>${softShadow('kcs', cx - totalW / 2 - 30 * s, y0 - 26 * s, totalW + 60 * s, totalH + 62 * s, 28 * s, s, 1)}${rect(cx - totalW / 2 - 30 * s, y0 - 26 * s, totalW + 60 * s, totalH + 62 * s, 28 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}` : '';
    return `<g${op(clamp(k * 2) * (1 - L.out))} transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, lerp(0.85, 1, clamp(k, 0, 1.2))))}) translate(${f2(-cx)} ${f2(-cy)})">${pl}${out}</g>`; } };

/* ---------- registry + sound ---------- */
export const SAAS = { 'ui.appWindow': appWindow, 'ui.cursorJourney': cursorJourney, 'callout.uiHighlight': highlightBox, 'callout.arrowLabel': arrowLabel, 'ui.commandBar': commandBar, 'ui.aiAnswer': aiAnswer, 'ui.shortcutChip': shortcutChip };
const KEYS = ['sfx/device/keyboard_mech_soft'];
export const SAAS_CUES = {
  'ui.appWindow': (p) => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'window lands' }, ...sorted(p.zoom).filter((k) => Array.isArray(k.rect) || k.t > 0).map((k) => ({ t: k.t, id: 'sfx/ui/zoom_in', why: 'zoom to region' }))],
  'ui.cursorJourney': (p) => { const P = sorted(p.path), out = []; P.forEach((q, i) => { if (q.click) out.push({ t: q.t + 0.04, id: 'sfx/device/mouse_click', why: 'click' }); if (q.down) out.push({ t: q.t, id: 'sfx/ui/drag_lift', why: 'drag starts' });
    if (q.up) out.push({ t: q.t, id: 'sfx/ui/drop_snap', why: 'drop' }); if (q.hover && !q.click) out.push({ t: q.t, id: 'sfx/ui/hover_tick', why: 'hover' }); }); return out; },
  'callout.uiHighlight': () => [{ t: 0.02, id: 'sfx/ui/highlight_draw', why: 'ring draws on' }],
  'callout.arrowLabel': () => [{ t: 0.02, id: 'sfx/ui/pop', why: 'label pops' }, { t: 0.2, id: 'sfx/whoosh/swish_xs', why: 'arrow draws' }],
  'ui.commandBar': (p) => { const tm = commandTimes(p), out = [{ t: 0, id: 'sfx/ui/palette_open', why: 'palette opens' }]; const q = String(p.query ?? ''); for (let i = 0; i < Math.min(q.length, 40); i += 3) out.push({ t: tm.typeAt + i / Math.max(1, num(p.cps, 12)), id: KEYS[0], why: 'keystroke' });
    if (num(p.select, 0) > 0) out.push({ t: tm.selectAt, id: 'sfx/ui/hover_tick', why: 'selection moves' }); out.push({ t: tm.enterAt, id: 'sfx/ui/click', why: 'enter' }); return out; },
  'ui.aiAnswer': (p) => { const tm = answerTimes(p), out = []; for (let t = tm.typeAt, i = 0; t < tm.typeEnd - 0.1 && i < 30; t += 0.9, i++) out.push({ t, id: 'sfx/ui/typing_burst', why: 'typing' });
    out.push({ t: tm.sendAt, id: 'sfx/device/message_sent', why: 'prompt sent' }, { t: tm.sendAt + 0.25, id: 'sfx/ui/ai_think_pulse', why: 'thinking' });
    for (let t = tm.streamAt, i = 0; t < tm.streamEnd - 0.05 && i < 40; t += 0.45, i++) out.push({ t, id: 'sfx/ui/stream_tick', why: 'answer streams' });
    out.push({ t: tm.streamEnd, id: 'sfx/ui/ai_reply', why: 'answer done' }); if (tm.applyAt != null) out.push({ t: tm.applyAt, id: 'sfx/device/mouse_click', why: 'apply click' }, { t: tm.applyAt + 0.1, id: 'sfx/ui/success_chime', why: 'applied' }); return out; },
  'ui.shortcutChip': (p) => { const n = Math.min(6, list(p.keys).length); return [...Array.from({ length: n }, (_, i) => ({ t: num(p.pressAt, 0.5) + i * num(p.stagger, 0.12), id: KEYS[0], why: 'key ' + (i + 1) + ' down' })), { t: num(p.pressAt, 0.5) + (n - 1) * num(p.stagger, 0.12) + 0.06, id: 'sfx/ui/key_chord', why: 'the chord lands' }]; },
};
for (const g of Object.values(SAAS)) { const f = g.svg; g.file = 'type/gfx/ui-saas.js'; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale, s0: c.s } : c); }
