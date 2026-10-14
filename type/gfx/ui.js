/* motion-pack / type / gfx / ui.js: the UI kit (2026-10-14). Seven generic product-UI pieces for "AI at work" and product films, same contract as every gfx
   component (core.js): svg(L, p, ctx) -> SVG markup, a pure function of t. Motion runs on the closed-form springs in ../ease.js (springTrack), so any frame
   renders the same in any seek order. Everything is OUR OWN generic layout: no product's trade dress, logos or copy. Demo copy is placeholder for a fictional "Acme".
     ui.agentActivity  vertical list of agent steps (verb + object chip) scrolling up; active row full opacity + spinner; optional dark map card with points + counters
     ui.promptBar      chat input: text typed with a caret, cursor glides to send and clicks (press + ripple); optional suggestion chip
     ui.checklist      steps tick one by one (spinner -> check) over a progress bar
     ui.nodeGraph      trigger / action / condition cards, elbow connectors drawing on, yes/no branches, built-in camera pan (nodeGraphCam for a DOM wrapper)
     ui.scanOverlay    corner brackets lock onto a subject box, a coloured sweep fills a supplied mask path (or a rounded-rect fallback), "Scanning… -> Done"
     ui.isometricTilt  a flat panel (or any other gfx item via `inner`) tilts into an isometric plane and back, with a floor shadow; isoTiltCss for DOM panels
     ui.stateMorph     ONE container morphs size, radius, colour and content through a list of states, driven by a cursor path with real clicks; loops when last = first
   Round 3 (same contract, same KIT): ui-data.js (liveTranscript, wordRegenerate, receiptCompare, failoverRoute, fileChip), ui-nav.js (pageFlythrough, tabPillNav, windowWall, optionPicker).
   Size: `scale` multiplies the size unit (see the loop under UI). Sound: uiCues(id, params) -> [{ t, id: 'sfx/<cat>/<name>', why }] in the item's local time (add the item's `at`); index.js exposes it with the at applied. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, INK, PAPER, esc, f2, text, textW, dash, hashf } from './core.js';
import { springTrack, spring } from '../ease.js';

/* ---------- shared pieces ---------- */
const THEME = { light: { panel: '#FFFFFF', bg: '#F4F2EE', ink: '#16151B', muted: '#85828F', faint: '#C8C5CE', line: '#E3E0E7', chip: '#F0EEF4', sh: 'rgba(22,20,34,0.10)' },
  dark: { panel: '#17161D', bg: '#0E0D12', ink: '#F4F3F8', muted: '#8E8C9B', faint: '#4B4957', line: '#2B2934', chip: '#25232E', sh: 'rgba(0,0,0,0.5)' } };
const th = (p) => THEME[p.theme] || THEME.light;
const GREEN = '#17A865', AMBER = '#E39A12', SPOT = '#FF6A2B';
const bx = (b, c) => [b[0] * c.W, b[1] * c.H, b[2] * c.W, b[3] * c.H];
const uid = (tag, ...k) => tag + Math.floor(hashf(...k) * 1e7);
const op = (v) => (v >= 0.999 ? '' : ` opacity="${f2(clamp(v))}"`);
const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, w))}" height="${f2(Math.max(0, h))}" rx="${f2(Math.max(0, Math.min(r, w / 2, h / 2)))}" fill="${fill}" ${extra}/>`;
const shadowDef = (id, s) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="${f2(14 * s)}"/></filter>`;
const softShadow = (id, x, y, w, h, r, s, a = 1, col = 'rgba(22,20,34,0.16)') => (a <= 0.001 ? '' : `<g opacity="${f2(a)}" filter="url(#${id})">${rect(x, y + 10 * s, w, h, r, col)}</g>`);
const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const rgb = (hex) => { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
/* owned line icons on a 24-unit grid */
const ICON = { doc: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6', search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M15.5 15.5L20 20', pen: 'M4 20l4-1L19 8l-3-3L5 16z M14 7l3 3',
  bolt: 'M13 3L5 14h6l-1 7l8-11h-6z', check: 'M5 12.5l4.5 4.5L19 7.5', clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3 2', mail: 'M3 6h18v12H3z M3 7l9 6l9-6',
  branch: 'M12 21v-7 M12 14L6 8 M12 14l6-6 M6 8V3 M18 8V3', box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5l8-4.5 M12 12v9', db: 'M5 6c0-3 14-3 14 0v12c0 3-14 3-14 0z M5 6c0 3 14 3 14 0 M5 12c0 3 14 3 14 0',
  play: 'M8 5l11 7l-11 7z', chart: 'M4 20V4 M4 20h16 M8 16l4-5l3 3l5-7', send: 'M12 19V5 M6 11l6-6l6 6', user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21c1-5 15-5 16 0', spark: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M6 6l3 3 M15 15l3 3 M18 6l-3 3 M9 15l-3 3' };
const icon = (name, x, y, size, color, sw = 2) => `<path transform="translate(${f2(x)} ${f2(y)}) scale(${f2(size / 24)})" d="${ICON[name] || ICON.doc}" fill="none" stroke="${color}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
/* spinner: a 270-degree arc turning 1.15 turns/s (pure function of local time u) */
const spinner = (cx, cy, r, u, color, sw) => { const a = u * 414, C = TAU * r; return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" fill="none" stroke="${color}" stroke-opacity="0.18" stroke-width="${f2(sw)}"/><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" fill="none" stroke="${color}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-dasharray="${f2(C * 0.28)} ${f2(C)}" transform="rotate(${f2(a % 360)} ${f2(cx)} ${f2(cy)})"/>`; };
/* check badge: disc pops on the headline spring, tick draws on */
const checkBadge = (cx, cy, r, u, color, tick = '#FFFFFF') => { if (u < 0) return ''; const k = spring(u, 'headline'), d = clamp((u - 0.05) / 0.22), L = 2.1 * r;
  return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, k))})"><circle r="${f2(r)}" fill="${color}"/><path d="M${f2(-r * 0.45)} ${f2(r * 0.02)} L${f2(-r * 0.1)} ${f2(r * 0.36)} L${f2(r * 0.48)} ${f2(-r * 0.32)}" fill="none" stroke="${tick}" stroke-width="${f2(r * 0.22)}" stroke-linecap="round" stroke-linejoin="round" ${dash(L, d)}/></g>`; };
const cursorSvg = (x, y, s, press = 0) => `<g transform="translate(${f2(x)} ${f2(y)}) scale(${f2(s * (1 - 0.14 * press))})"><path d="M0 0 L0 30 L8 23 L13.5 35 L19 32.5 L13.5 21 L24 21 Z" fill="#111" stroke="#FFF" stroke-width="2.2" stroke-linejoin="round"/></g>`;
const ripple = (x, y, u, s, col) => (u < 0 || u > 0.45 ? '' : `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(s * (10 + 54 * E.enter(u / 0.45)))}" fill="${col}" opacity="${f2(0.35 * (1 - u / 0.45))}"/>`);
/* a press: 0 -> 1 on the click, back to 0 70 ms later, on the ui spring (tiny overshoot, settles in ~0.3 s) */
const pressAt = (u, at) => clamp(springTrack(u, [[0, 0], [at - 0.02, 1], [at + 0.07, 0]], 'ui'), 0, 1.2);
const caret = (u, typing, col) => `<tspan fill="${col}" font-weight="300" opacity="${typing || Math.floor(u * 2) % 2 === 0 ? 1 : 0}">|</tspan>`;
const typed = (s, u, at, cps) => String(s).slice(0, Math.max(0, Math.floor((u - at) * cps + 1e-9)));

/* shared kit for the round-3 ui files (ui-data.js, ui-nav.js): same look, same springs, same sounds */
export const KIT = { THEME, th, GREEN, AMBER, SPOT, bx, uid, op, rect, shadowDef, softShadow, lum, rgb, hex, ICON, icon, spinner, checkBadge, cursorSvg, ripple, pressAt, caret, typed };

/* ---------- 1. agent activity ---------- */
const AGENT_STEPS = [{ verb: 'Checking', obj: 'Inbox' }, { verb: 'Reading', obj: 'Supplier notes' }, { verb: 'Comparing', obj: 'Prices' }, { verb: 'Writing', obj: 'Follow-up' }, { verb: 'Planning', obj: 'Schedule' }];
const agentState = (u, p) => { const n = p.steps.length, a = u < p.start ? -1 : Math.min(n - 1, Math.floor((u - p.start) / p.step)), done = u >= p.start + n * p.step;
  const s = springTrack(u, p.steps.map((_, i) => ({ t: p.start + i * p.step, v: i })), 'panel'); return { n, a, s, done }; };
function mapCard(L, p, c, card) {
  const T = THEME.dark, [x, y, w, h] = bx(card.box, c), s = c.s, u = L.u, k = spring(u - (card.at ?? p.start - 0.15), 'ui'), id = uid('mc', x, y, w);
  if (k <= 0) return ''; const pad = 26 * s, gx = x + pad, gy = y + 70 * s, gw = w - 2 * pad, gh = h - 70 * s - (card.counters?.length ? 120 * s : pad), sp = 15 * s;
  const land = (fx, fy) => { let v = 0; for (const [bx_, by_, r] of [[0.28, 0.42, 0.24], [0.52, 0.3, 0.2], [0.7, 0.55, 0.22], [0.42, 0.7, 0.16], [0.85, 0.32, 0.12]]) v += Math.exp(-((fx - bx_) ** 2 + ((fy - by_) * 0.8) ** 2) / (r * r)); return v; };
  let dots = ''; for (let yy = gy + sp / 2; yy < gy + gh; yy += sp) for (let xx = gx + sp / 2; xx < gx + gw; xx += sp) { const v = land((xx - gx) / gw, (yy - gy) / gh); if (v > 0.55) dots += `<circle cx="${f2(xx)}" cy="${f2(yy)}" r="${f2(2.1 * s)}" fill="#5A5868" opacity="${f2(clamp(0.35 + 0.4 * (v - 0.55)))}"/>`; }
  let pts = ''; (card.points || []).forEach(([px, py], i) => { const at = (card.at ?? p.start) + 0.25 + i * (card.pointStep ?? p.step * 0.7), q = spring(u - at, 'headline'); if (q <= 0) return; const X = gx + px * gw, Y = gy + py * gh, ring = (u - at) % 1.4;
    pts += `<circle cx="${f2(X)}" cy="${f2(Y)}" r="${f2((9 + 26 * E.enter(ring / 1.4)) * s)}" fill="none" stroke="${card.color || SPOT}" stroke-width="${f2(2 * s)}" opacity="${f2(0.6 * (1 - ring / 1.4))}"/>` + rect(X - 8 * s * q, Y - 8 * s * q, 16 * s * q, 16 * s * q, 3 * s, card.color || SPOT); });
  let cnt = ''; (card.counters || []).forEach((m, i) => { const at = (card.at ?? p.start) + 0.2 + i * 0.25, v = lerp(m.from ?? 0, m.to, E.expoOut(seg(u, at, at + (m.dur ?? 2.2)))), cx = x + pad + i * (w - 2 * pad) / card.counters.length;
    cnt += text(Math.round(v).toLocaleString('en-US') + (m.suffix || ''), cx, y + h - 62 * s, { size: 44 * s, weight: 800, fill: T.ink, extra: 'font-variant-numeric="tabular-nums"', op: seg(u, at - 0.1, at + 0.1) }) + text(m.label, cx, y + h - 30 * s, { size: 19 * s, weight: 600, fill: T.muted }); });
  const cx0 = x + w / 2, cy0 = y + h / 2, sc = lerp(0.94, 1, k);
  return `<defs>${shadowDef(id + 's', s)}</defs><g transform="translate(${f2(cx0)} ${f2(cy0)}) scale(${f2(sc)}) translate(${f2(-cx0)} ${f2(-cy0)})"${op(clamp(k * 1.6) * (1 - L.out))}>${softShadow(id + 's', x, y, w, h, 22 * s, s, 1, 'rgba(0,0,0,0.35)')}` +
    rect(x, y, w, h, 22 * s, T.panel) + text(card.title || 'Sources', x + pad, y + 44 * s, { size: 22 * s, weight: 700, fill: T.muted, ls: 0.5 }) + dots + pts + cnt +
    (card.source ? text(card.source, x + w - pad, y + 44 * s, { size: 16 * s, weight: 600, fill: T.faint, anchor: 'end' }) : '') + '</g>';
}
/* ---------- 2. prompt bar ---------- */
const promptTimes = (p) => { const typeEnd = p.typeAt + String(p.text).length / p.cps, sendAt = p.sendAt ?? typeEnd + 0.45; return { typeEnd, sendAt, moveAt: sendAt - 0.75 }; };
/* ---------- 4. node graph geometry ---------- */
const NG = { w: 400, h: 112 };
const KIND = { trigger: { label: 'TRIGGER', icon: 'play', col: (p) => p.accent }, action: { label: 'ACTION', icon: 'bolt', col: () => GREEN }, condition: { label: 'CONDITION', icon: 'branch', col: () => AMBER } };
function graphTimes(p) { const at = {}; p.nodes.forEach((n, i) => { at[n.id] = n.at ?? p.start + i * p.stagger; }); return at; }
function graphFocus(u, p, c) { const s = c.s * (p.zoom ?? 1), at = graphTimes(p), [, , vw, vh] = bx(p.box, c), xs = p.nodes.map((n) => n.x * s), ys = p.nodes.map((n) => n.y * s), pad = 90 * s;
  const minX = Math.min(...xs) - NG.w * s / 2 - pad, maxX = Math.max(...xs) + NG.w * s / 2 + pad, minY = Math.min(...ys) - NG.h * s / 2 - pad, maxY = Math.max(...ys) + NG.h * s / 2 + pad;
  const fit = (v, lo, hi, view) => (hi - lo <= view ? (lo + hi) / 2 : clamp(v, lo + view / 2, hi - view / 2));
  const keys = [...p.nodes].sort((a, b) => at[a.id] - at[b.id]).map((n) => ({ t: at[n.id], v: [fit(n.x * s, minX, maxX, vw), fit(n.y * s, minY, maxY, vh)] }));
  return p.cam ? springTrack(u, keys, 'camera') : [fit((minX + maxX) / 2, minX, maxX, vw), fit((minY + maxY) / 2, minY, maxY, vh)]; }
/* ---------- 5. scan overlay ---------- */
const scanTimes = (p) => ({ doneAt: p.sweepAt + p.sweepDur });
/* ---------- 6. isometric tilt ---------- */
export const hooks = { renderInner: null };   // set by index.js (lets ui.isometricTilt wrap any registered gfx id without a circular import)
const tiltK = (u, p) => clamp(springTrack(u, p.backAt == null ? [[0, 0], [p.tiltAt, 1]] : [[0, 0], [p.tiltAt, 1], [p.backAt, 0]], 'panel'), 0, 1.05);
/* CSS for a DOM panel (true perspective): apply to the panel element; k from the same spring as the SVG version */
export function isoTiltCss(u, params = {}) { const p = { ...UI['ui.isometricTilt'].d, ...params }, k = tiltK(u, p);
  return { k, transform: `perspective(2400px) translateY(${f2(-p.lift * k)}px) rotateX(${f2(54.7356 * k)}deg) rotateZ(${f2(-p.angle * k)}deg) scale(${f2(lerp(1, p.shrink, k))})`, boxShadow: `0 ${f2(30 + 60 * k)}px ${f2(60 + 60 * k)}px rgba(20,18,30,${f2(0.12 + 0.14 * k)})` }; }
/* ---------- 7. state morph ---------- */
const MORPH_STATES = [
  { at: 0, kind: 'pill', w: 250, h: 84, r: 42, fill: '#16151B', label: 'Acme' },
  { at: 0.7, kind: 'button', w: 360, h: 96, r: 48, fill: BRAND, label: 'Get started' },
  { at: 1.6, kind: 'input', w: 640, h: 104, r: 22, fill: '#FFFFFF', label: 'you@acme.example', placeholder: 'Email' },
  { at: 2.95, kind: 'loader', w: 128, h: 128, r: 64, fill: BRAND },
  { at: 3.75, kind: 'check', w: 128, h: 128, r: 64, fill: GREEN },
  { at: 4.45, kind: 'card', w: 620, h: 360, r: 30, fill: '#FFFFFF', label: 'This week' },
  { at: 5.5, kind: 'chart', w: 760, h: 430, r: 30, fill: '#FFFFFF', label: 'Orders (illustrative)', series: [0.2, 0.28, 0.24, 0.42, 0.38, 0.6, 0.72, 0.9] },
  { at: 6.9, kind: 'toast', w: 600, h: 104, r: 52, fill: '#16151B', label: 'Order sent to supplier' },
  { at: 8.0, kind: 'pill', w: 250, h: 84, r: 42, fill: '#16151B', label: 'Acme' } ];
const MORPH_PATH = [{ at: 0.25, x: 0.66, y: 0.78 }, { at: 1.5, x: 0.52, y: 0.51, click: true }, { at: 2.85, x: 0.645, y: 0.515, click: true }, { at: 5.35, x: 0.56, y: 0.47, click: true }, { at: 6.2, x: 0.74, y: 0.86 }];
function morphAt(u, p) { const S = p.states, ks = (f) => S.map((s) => ({ t: s.at, v: f(s) })), cls = p.cls;
  const w = springTrack(u, ks((s) => s.w), cls), h = springTrack(u, ks((s) => s.h), cls), r = springTrack(u, ks((s) => Math.min(s.r, s.w / 2, s.h / 2)), cls), col = springTrack(u, ks((s) => rgb(s.fill)), 'ui');
  let i = 0; for (let j = 0; j < S.length; j++) if (u >= S[j].at) i = j; return { w, h, r, col, i }; }
function morphContent(s, u, w, h, sc, p, T, id) {   // content in container-local coords (0,0 = centre) for state s, local time u since the state began
  const onDark = lum(s.fill) < 0.5, fg = onDark ? '#FFFFFF' : T.ink, m = onDark ? 'rgba(255,255,255,0.65)' : T.muted;
  if (s.kind === 'pill' || s.kind === 'button') return text(s.label, 0, 13 * sc * (s.kind === 'pill' ? 1.05 : 1), { size: (s.kind === 'pill' ? 40 : 36) * sc, weight: 800, fill: fg, anchor: 'middle', ls: s.kind === 'pill' ? -0.5 : 0 });
  if (s.kind === 'toast') return checkBadge(-w / 2 + 52 * sc, 0, 20 * sc, u - 0.1, GREEN) + text(s.label, -w / 2 + 92 * sc, 11 * sc, { size: 30 * sc, weight: 700, fill: fg });
  if (s.kind === 'input') { const ty = typed(s.label, u, 0.15, s.cps ?? 16), typing = u >= 0.15 && ty.length < String(s.label).length;
    return `<text x="${f2(-w / 2 + 34 * sc)}" y="${f2(12 * sc)}" font-family="${esc(FONT)}" font-size="${f2(32 * sc)}" font-weight="600" fill="${ty ? fg : m}">${esc(ty || s.placeholder || '')}${caret(u, typing, p.accent)}</text>` +
      rect(w / 2 - 84 * sc, -32 * sc, 64 * sc, 64 * sc, 32 * sc, ty.length === String(s.label).length ? p.accent : T.chip) + icon('send', w / 2 - 70 * sc, -14 * sc, 28 * sc, ty.length === String(s.label).length ? '#FFF' : T.muted, 2.6 * sc); }
  if (s.kind === 'loader') return spinner(0, 0, 30 * sc, u, '#FFFFFF', 7 * sc);
  if (s.kind === 'check') return checkBadge(0, 0, 38 * sc, u, 'rgba(255,255,255,0.0)', '#FFFFFF');
  if (s.kind === 'card') { let o = text(s.label, -w / 2 + 40 * sc, -h / 2 + 64 * sc, { size: 30 * sc, weight: 800, fill: fg });
    [0.78, 0.6, 0.7].forEach((f, j) => { const yy = -h / 2 + 118 * sc + j * 74 * sc, k = spring(u - 0.12 - j * 0.09, 'ui'); o += `<g${op(k)}>` + `<circle cx="${f2(-w / 2 + 62 * sc)}" cy="${f2(yy + 18 * sc)}" r="${f2(20 * sc)}" fill="${[p.accent, GREEN, AMBER][j]}" opacity="0.9"/>` + rect(-w / 2 + 100 * sc, yy + 4 * sc, (w - 150 * sc) * f * k, 14 * sc, 7 * sc, T.ink, 'opacity="0.85"') + rect(-w / 2 + 100 * sc, yy + 26 * sc, (w - 150 * sc) * f * 0.55 * k, 11 * sc, 6 * sc, T.faint) + '</g>'; });
    return o; }
  if (s.kind === 'chart') { const S = s.series, cw = w - 100 * sc, ch = h - 150 * sc, x0 = -w / 2 + 50 * sc, y0 = h / 2 - 50 * sc, pts = S.map((v, j) => [x0 + cw * j / (S.length - 1), y0 - ch * v]), d = clamp((u - 0.15) / 0.9), Lp = pts.reduce((a, q, j) => (j ? a + Math.hypot(q[0] - pts[j - 1][0], q[1] - pts[j - 1][1]) : 0), 0);
    const line = pts.map((q, j) => `${j ? 'L' : 'M'}${f2(q[0])} ${f2(q[1])}`).join(' '), nShown = d * (S.length - 1), last = Math.floor(nShown), fr = nShown - last, tip = last >= S.length - 1 ? pts.at(-1) : [lerp(pts[last][0], pts[last + 1][0], fr), lerp(pts[last][1], pts[last + 1][1], fr)];
    let grid = ''; for (let j = 0; j <= 3; j++) grid += `<line x1="${f2(x0)}" x2="${f2(x0 + cw)}" y1="${f2(y0 - ch * j / 3)}" y2="${f2(y0 - ch * j / 3)}" stroke="${T.line}" stroke-width="${f2(1.5 * sc)}"/>`;
    const area = `<path d="${line} L${f2(tip[0])} ${f2(y0)} L${f2(x0)} ${f2(y0)} Z" fill="${p.accent}" opacity="0.10"/>`;
    return text(s.label, x0, -h / 2 + 60 * sc, { size: 28 * sc, weight: 800, fill: fg }) + grid + `<g opacity="${f2(clamp(d * 3))}"><clipPath id="${id}a"><rect x="${f2(x0 - 4)}" y="${f2(-h / 2)}" width="${f2(tip[0] - x0 + 4)}" height="${f2(h)}"/></clipPath><g clip-path="url(#${id}a)">${area}</g></g>` +
      `<path d="${line}" fill="none" stroke="${p.accent}" stroke-width="${f2(5 * sc)}" stroke-linecap="round" stroke-linejoin="round" ${dash(Lp, d)}/>` + (d > 0 ? `<circle cx="${f2(tip[0])}" cy="${f2(tip[1])}" r="${f2(9 * sc)}" fill="#FFF" stroke="${p.accent}" stroke-width="${f2(4 * sc)}"/>` : ''); }
  return ''; }

export const UI = {
  'ui.agentActivity': { tags: ['ui', 'agent', 'ai-at-work', 'list', 'product-film'], dur: 4.4, inF: 10, outF: 8,
    d: { box: [0.08, 0.2, 0.4, 0.6], steps: AGENT_STEPS, start: 0.35, step: 0.6, rowH: 66, theme: 'light', accent: BRAND, card: null },
    svg(L, p, c) { const T = th(p), s = c.s, [x, y, w, h] = bx(p.box, c), { a, s: sp, done } = agentState(L.u, p), rh = p.rowH * s, cy = y + h / 2, id = uid('ag', x, y, w, h);
      let rows = ''; p.steps.forEach((st, i) => { const yy = cy + (i - sp) * rh; if (yy < y - rh || yy > y + h + rh) return; const d = Math.abs(i - sp), act = i === a && !done, past = i < a || (done && i === a);
        const o = act || (done && i === a) ? 1 : Math.max(0.16, 0.62 - 0.16 * d), vs = 30 * s, vw = textW(st.verb, vs, 0.55), cs = 22 * s, cw = textW(st.obj, cs, 0.56) + 28 * s, ix = x + 18 * s;
        const ic = act ? spinner(ix + 14 * s, yy, 11 * s, L.u - p.start - i * p.step, p.accent, 3.2 * s) : past ? icon('check', ix + 1 * s, yy - 13 * s, 26 * s, i === a ? GREEN : T.muted, 2.4 * s) : icon('doc', ix + 1 * s, yy - 13 * s, 26 * s, T.muted, 2 * s);
        rows += `<g${op(o)}>${act ? rect(x, yy - rh * 0.42, vw + cw + 110 * s, rh * 0.84, 14 * s, p.accent, 'opacity="0.07"') : ''}${ic}` + text(st.verb, ix + 44 * s, yy + 10 * s, { size: vs, weight: act ? 700 : 500, fill: T.ink }) +
          rect(ix + 56 * s + vw, yy - 19 * s, cw, 38 * s, 9 * s, act ? T.chip : 'none', act ? '' : `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) + text(st.obj, ix + 70 * s + vw, yy + 8 * s, { size: cs, weight: 600, fill: act ? T.ink : T.muted }) + '</g>'; });
      const fade = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.22" stop-color="#fff"/><stop offset="0.78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m" maskUnits="userSpaceOnUse" x="${f2(x - 20)}" y="${f2(y)}" width="${f2(w + 40)}" height="${f2(h)}"><rect x="${f2(x - 20)}" y="${f2(y)}" width="${f2(w + 40)}" height="${f2(h)}" fill="url(#${id}g)"/></mask>`;
      return `<defs>${fade}</defs><g${op(clamp(L.in * 1.5) * (1 - L.out))}><g mask="url(#${id}m)" transform="translate(0 ${f2(14 * s * (1 - spring(L.u, 'ui')))})">${rows}</g></g>` + (p.card ? mapCard(L, p, c, p.card) : ''); } },

  'ui.promptBar': { tags: ['ui', 'prompt', 'chat', 'input', 'cursor', 'click'], dur: 3.2, inF: 10, outF: 8,
    d: { box: [0.2, 0.45, 0.6, 0.11], text: "Plan next week's restock", placeholder: 'Ask Acme anything…', typeAt: 0.45, cps: 22, sendAt: null, title: 'What should we work on?', chip: 'Suggested: restock plan', theme: 'light', accent: BRAND, cursor: true },
    svg(L, p, c) { const T = th(p), s = c.s, [x, y, w, h] = bx(p.box, c), u = L.u, { sendAt, moveAt } = promptTimes(p), ty = typed(p.text, u, p.typeAt, p.cps), full = ty.length >= String(p.text).length, sent = u >= sendAt, id = uid('pb', x, y, w);
      const k = spring(u, 'panel'), bs = h * 0.62, bx_ = x + w - h * 0.19 - bs, by_ = y + (h - bs) / 2, bcx = bx_ + bs / 2, bcy = by_ + bs / 2, pr = pressAt(u, sendAt), fs = 34 * s;
      const cur = p.cursor ? (() => { const [qx, qy] = springTrack(u, [[0, [bcx + 330 * s, bcy + 230 * s]], [moveAt, [bcx + 4 * s, bcy + 6 * s]]], 'panel'); return u > moveAt - 0.4 ? cursorSvg(qx, qy, 1.5 * s, pr) : ''; })() : '';
      const btn = `<g transform="translate(${f2(bcx)} ${f2(bcy)}) scale(${f2(1 - 0.12 * pr)}) translate(${f2(-bcx)} ${f2(-bcy)})">${rect(bx_, by_, bs, bs, bs / 2, full || sent ? p.accent : T.chip)}` +
        (sent ? spinner(bcx, bcy, bs * 0.22, u - sendAt, '#FFFFFF', 3.4 * s) : icon('send', bcx - bs * 0.24, bcy - bs * 0.24, bs * 0.48, full ? '#FFFFFF' : T.muted, 2.8 * s)) + '</g>';
      const tx = `<text x="${f2(x + 40 * s)}" y="${f2(y + h / 2 + fs * 0.35)}" font-family="${esc(FONT)}" font-size="${f2(fs)}" font-weight="600" fill="${ty ? T.ink : T.muted}"${sent ? ` opacity="${f2(1 - 0.5 * seg(u, sendAt, sendAt + 0.3))}"` : ''}>${esc(ty || p.placeholder)}${sent ? '' : caret(u, u >= p.typeAt && !full, p.accent)}</text>`;
      const chip = p.chip ? (() => { const cs = 24 * s, cw = textW(p.chip, cs, 0.55) + 56 * s, cx = x + 30 * s, cy = y + h + 26 * s, kk = spring(u - 0.2, 'ui') * (1 - seg(u, sendAt, sendAt + 0.25)); return kk <= 0.001 ? '' : `<g${op(kk)} transform="translate(0 ${f2(10 * s * (1 - kk))})">${rect(cx, cy, cw, 50 * s, 25 * s, T.chip)}${icon('spark', cx + 14 * s, cy + 13 * s, 24 * s, p.accent, 2.2 * s)}${text(p.chip, cx + 46 * s, cy + 33 * s, { size: cs, weight: 600, fill: T.ink })}</g>`; })() : '';
      const title = p.title ? text(p.title, x + w / 2, y - 56 * s, { size: 40 * s, weight: 700, fill: T.ink, anchor: 'middle', op: clamp(k * 1.4) }) : '';
      return `<defs>${shadowDef(id, s)}</defs><g${op(clamp(L.in * 1.5) * (1 - L.out))} transform="translate(0 ${f2(16 * s * (1 - k))})">${title}${softShadow(id, x, y, w, h, h / 2, s)}${rect(x, y, w, h, Math.min(h / 2, 28 * s), T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`)}${tx}${btn}${ripple(bcx, bcy, u - sendAt, s, p.accent)}${chip}</g>` + `<g${op(1 - L.out)}>${cur}</g>`; } },

  'ui.checklist': { tags: ['ui', 'checklist', 'progress', 'ai-at-work', 'building'], dur: 3.8, inF: 10, outF: 8,
    d: { box: [0.3, 0.24, 0.4, 0.52], title: 'Acme is working', steps: ['Building…', 'Connecting to database', 'Syncing assets', 'Preparing preview'], start: 0.35, step: 0.62, progress: true, theme: 'light', accent: BRAND, card: true },
    svg(L, p, c) { const T = th(p), s = c.s, [x, y, w, h] = bx(p.box, c), u = L.u, n = p.steps.length, end = p.start + n * p.step, id = uid('ck', x, y, w), pad = 40 * s, rh = Math.min(70 * s, (h - 190 * s) / n);
      let rows = ''; p.steps.forEach((st, i) => { const t0 = p.start + i * p.step, t1 = t0 + p.step, yy = y + 118 * s + i * rh, kin = spring(u - 0.1 - i * 0.07, 'ui'), act = u >= t0 && u < t1, dn = u >= t1;
        rows += `<g${op(kin * (act || dn ? 1 : 0.45))} transform="translate(${f2(14 * s * (1 - kin))} 0)">` + (dn ? checkBadge(x + pad + 15 * s, yy, 15 * s, u - t1, p.accent) : act ? spinner(x + pad + 15 * s, yy, 12 * s, u - t0, p.accent, 3.4 * s) : `<circle cx="${f2(x + pad + 15 * s)}" cy="${f2(yy)}" r="${f2(12 * s)}" fill="none" stroke="${T.faint}" stroke-width="${f2(2.5 * s)}"/>`) +
          text(st, x + pad + 50 * s, yy + 10 * s, { size: 29 * s, weight: act ? 700 : 600, fill: act || dn ? T.ink : T.muted }) + '</g>'; });
      const prog = p.progress ? (() => { const v = clamp(springTrack(u, [[0, 0], ...p.steps.map((_, i) => [p.start + (i + 1) * p.step, (i + 1) / n])], 'panel'), 0, 1), by = y + h - 64 * s, bw = w - 2 * pad, dn = Math.min(n, Math.max(0, Math.floor((u - p.start) / p.step)));
        return rect(x + pad, by, bw, 14 * s, 7 * s, T.chip) + rect(x + pad, by, bw * v, 14 * s, 7 * s, p.accent) + text(`${dn} / ${n}`, x + w - pad, by - 16 * s, { size: 22 * s, weight: 700, fill: T.muted, anchor: 'end', extra: 'font-variant-numeric="tabular-nums"' }) + text(u >= end ? 'Ready' : 'In progress', x + pad, by - 16 * s, { size: 22 * s, weight: 700, fill: u >= end ? GREEN : T.muted }); })() : '';
      const head = text(p.title, x + pad, y + 62 * s, { size: 34 * s, weight: 800, fill: T.ink }) + (u >= end ? checkBadge(x + w - pad - 18 * s, y + 52 * s, 18 * s, u - end, GREEN) : spinner(x + w - pad - 18 * s, y + 52 * s, 14 * s, u, p.accent, 3.6 * s));
      const k = spring(u, 'panel');
      return `<defs>${shadowDef(id, s)}</defs><g${op(clamp(L.in * 1.5) * (1 - L.out))} transform="translate(0 ${f2(20 * s * (1 - k))})">${p.card ? softShadow(id, x, y, w, h, 28 * s, s) + rect(x, y, w, h, 28 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) : ''}${head}${rows}${prog}</g>`; } },

  'ui.nodeGraph': { tags: ['ui', 'workflow', 'node-graph', 'automation', 'diagram'], dur: 4.2, inF: 8, outF: 8,
    d: { box: [0, 0, 1, 1], start: 0.3, stagger: 0.6, cam: true, zoom: 1.3, theme: 'light', accent: BRAND,
      nodes: [{ id: 't', kind: 'trigger', title: 'Every morning', sub: 'Scheduled run', x: 0, y: 0 }, { id: 'a', kind: 'action', title: 'Read new orders', sub: 'From the shop inbox', x: 0, y: 210 },
        { id: 'c', kind: 'condition', title: 'Stock running low?', sub: 'Checked per item', x: 0, y: 420 }, { id: 'y', kind: 'action', title: 'Draft a reorder', sub: 'Sent for approval', x: -290, y: 660 }, { id: 'n', kind: 'action', title: 'Log and wait', sub: 'Check again tomorrow', x: 290, y: 660 }],
      edges: [{ from: 't', to: 'a' }, { from: 'a', to: 'c' }, { from: 'c', to: 'y', label: 'Yes' }, { from: 'c', to: 'n', label: 'No' }] },
    svg(L, p, c) { const T = th(p), s = c.s * p.zoom, u = L.u, [vx, vy, vw, vh] = bx(p.box, c), at = graphTimes(p), [fx, fy] = graphFocus(u, p, c), ox = vx + vw / 2 - fx, oy = vy + vh / 2 - fy, id = uid('ng', vx, vy, vw, vh);
      const byId = Object.fromEntries(p.nodes.map((n) => [n.id, n])), nw = NG.w * s, nh = NG.h * s;
      let edges = '', labels = ''; for (const e of p.edges) { const A = byId[e.from], B = byId[e.to]; if (!A || !B) continue; const t1 = at[B.id], t0 = Math.max(at[A.id] + 0.2, t1 - 0.38), d = E.move(seg(u, t0, t1)); if (d <= 0) continue;
        const ax = A.x * s, ay = A.y * s + nh / 2, bx2 = B.x * s, by2 = B.y * s - nh / 2 - 34 * s, my = (ay + by2) / 2, len = Math.abs(my - ay) + Math.abs(bx2 - ax) + Math.abs(by2 - my), rr = Math.min(16 * s, Math.abs(bx2 - ax) / 2);
        const dx = Math.sign(bx2 - ax), path = Math.abs(bx2 - ax) < 1 ? `M${f2(ax)} ${f2(ay)} V${f2(by2)}` : `M${f2(ax)} ${f2(ay)} V${f2(my - rr)} Q${f2(ax)} ${f2(my)} ${f2(ax + dx * rr)} ${f2(my)} H${f2(bx2 - dx * rr)} Q${f2(bx2)} ${f2(my)} ${f2(bx2)} ${f2(my + rr)} V${f2(by2)}`;
        edges += `<path d="${path}" fill="none" stroke="${T.muted}" stroke-opacity="0.7" stroke-width="${f2(2.4 * s)}" stroke-linecap="round" ${dash(len, d)}/>`;
        if (e.label) { const lk = spring(u - (t0 + 0.55 * (t1 - t0)), 'ui'), lw = textW(e.label, 20 * s, 0.6) + 26 * s, lc = /^y/i.test(e.label) ? GREEN : /^n/i.test(e.label) ? '#D9473F' : T.muted; if (lk > 0) labels += `<g${op(lk)} transform="translate(${f2(bx2)} ${f2(my)}) scale(${f2(Math.max(0.001, lk))})">${rect(-lw / 2, -17 * s, lw, 34 * s, 17 * s, T.panel, `stroke="${lc}" stroke-width="${f2(1.6 * s)}"`)}${text(e.label, 0, 7 * s, { size: 20 * s, weight: 700, fill: lc, anchor: 'middle' })}</g>`; } }
      let cards = ''; for (const n of p.nodes) { const kk = spring(u - at[n.id], 'ui'); if (kk <= 0) continue; const K = KIND[n.kind] || KIND.action, col = K.col(p), cx = n.x * s - nw / 2, cy = n.y * s - nh / 2 + 18 * s * (1 - kk);
        cards += `<g${op(clamp(kk * 1.4))}>` + text(K.label, cx + 4 * s, cy - 12 * s, { size: 16 * s, weight: 600, fill: T.muted, font: MONO, ls: 1.5 }) + softShadow(id + 's', cx, cy, nw, nh, 16 * s, s, 0.8) + rect(cx, cy, nw, nh, 16 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) +
          rect(cx, cy + 14 * s, 5 * s, nh - 28 * s, 2.5 * s, col) + rect(cx + 24 * s, cy + nh / 2 - 26 * s, 52 * s, 52 * s, 13 * s, T.chip) + icon(K.icon, cx + 36 * s, cy + nh / 2 - 14 * s, 28 * s, col, 2.4 * s) +
          text(n.title, cx + 96 * s, cy + nh / 2 - 4 * s, { size: 27 * s, weight: 700, fill: T.ink }) + text(n.sub || '', cx + 96 * s, cy + nh / 2 + 28 * s, { size: 20 * s, weight: 500, fill: T.muted }) + '</g>'; }
      return `<defs>${shadowDef(id + 's', s)}<clipPath id="${id}c"><rect x="${f2(vx)}" y="${f2(vy)}" width="${f2(vw)}" height="${f2(vh)}"/></clipPath></defs><g clip-path="url(#${id}c)"${op(clamp(L.in * 1.5) * (1 - L.out))}><g transform="translate(${f2(ox)} ${f2(oy)})">${edges}${cards}${labels}</g></g>`; } },

  'ui.scanOverlay': { tags: ['ui', 'scan', 'brackets', 'segmentation', 'ai-at-work', 'status'], dur: 3.2, inF: 6, outF: 8,
    d: { box: [0.38, 0.2, 0.24, 0.56], from: [0.12, 0.08, 0.76, 0.84], mask: null, lockAt: 0.1, sweepAt: 0.55, sweepDur: 1.1, color: '#2FD47A', bracket: '#FFFFFF', label: 'Scanning…', done: 'Done', theme: 'light', accent: BRAND, status: true },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), [qx, qy, qw, qh] = springTrack(u, [[0, bx(p.from, c)], [p.lockAt, [x, y, w, h]]], 'ui'), { doneAt } = scanTimes(p), id = uid('sc', x, y, w, h);
      const cl = Math.min(qw, qh) * 0.16, sw = 6 * s, pad = 14 * s, X0 = qx - pad, Y0 = qy - pad, X1 = qx + qw + pad, Y1 = qy + qh + pad, lk = seg(u, p.lockAt + 0.15, p.lockAt + 0.35);
      const corners = [[X0, Y0, 1, 1], [X1, Y0, -1, 1], [X0, Y1, 1, -1], [X1, Y1, -1, -1]].map(([cx, cy, dx, dy]) => `M${f2(cx)} ${f2(cy + dy * cl)} V${f2(cy + dy * 8 * s)} Q${f2(cx)} ${f2(cy)} ${f2(cx + dx * 8 * s)} ${f2(cy)} H${f2(cx + dx * cl)}`).join(' ');
      const k = E.move(seg(u, p.sweepAt, doneAt)), shape = p.mask ? `<path d="${p.mask}" transform="translate(${f2(x)} ${f2(y)}) scale(${f2(w)} ${f2(h)})"/>` : `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(Math.min(w, h) * 0.12)}"/>`;
      const fillA = u < doneAt ? 0.55 : lerp(0.55, 0.36, E.soft(seg(u, doneAt, doneAt + 0.5))), edgeY = y + h * (1 - k);
      const sweep = k <= 0 ? '' : `<clipPath id="${id}m">${shape}</clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.color}" stop-opacity="0.95"/><stop offset="1" stop-color="${p.color}" stop-opacity="0"/></linearGradient>` +
        `<g clip-path="url(#${id}m)"><rect x="${f2(x)}" y="${f2(edgeY)}" width="${f2(w)}" height="${f2(h * k + 1)}" fill="${p.color}" opacity="${f2(fillA)}"/>${u < doneAt ? `<rect x="${f2(x)}" y="${f2(edgeY)}" width="${f2(w)}" height="${f2(60 * s)}" fill="url(#${id}g)" opacity="0.8"/>` : ''}</g>` +
        (u < doneAt ? `<rect x="${f2(x - 10 * s)}" y="${f2(edgeY - 2 * s)}" width="${f2(w + 20 * s)}" height="${f2(4 * s)}" rx="${f2(2 * s)}" fill="${p.color}"/>` : '');
      const status = !p.status || u < p.lockAt ? '' : (() => { const dn = u >= doneAt, lab = dn ? p.done : p.label, fs = 28 * s, lw = textW(lab, fs, 0.56) + 96 * s, sx = x + w / 2 - lw / 2, sy = Y1 + 34 * s, kk = spring(u - p.lockAt - 0.1, 'ui');
        return `<g${op(clamp(kk * 1.5))} transform="translate(0 ${f2(10 * s * (1 - kk))})">${rect(sx, sy, lw, 60 * s, 30 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`)}${dn ? checkBadge(sx + 34 * s, sy + 30 * s, 14 * s, u - doneAt, GREEN) : spinner(sx + 34 * s, sy + 30 * s, 11 * s, u, p.accent, 3.2 * s)}${text(lab, sx + 62 * s, sy + 40 * s, { size: fs, weight: 700, fill: dn ? GREEN : T.ink })}</g>`; })();
      const bo = clamp(L.in * 2) * (1 - L.out);
      return `<g${op(bo)}>${sweep}<path d="${corners}" fill="none" stroke="${u >= doneAt ? p.color : p.bracket}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f2(0.75 + 0.25 * lk)}"/>${status}</g>`; } },

  'ui.isometricTilt': { tags: ['ui', 'isometric', 'tilt', 'perspective', 'panel', 'camera'], dur: 3.4, inF: 8, outF: 8,
    d: { box: [0.3, 0.22, 0.4, 0.56], inner: null, tiltAt: 0.35, backAt: 2.4, angle: 45, squash: 0.57735, lift: 46, shrink: 0.86, shadow: true, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), k = tiltK(u, p), cx = x + w / 2, cy = y + h / 2, id = uid('it', x, y, w, h), sc = lerp(1, p.shrink, k), sy = lerp(1, p.squash, k), lift = p.lift * s * k;
      const M = (dy) => `translate(${f2(cx)} ${f2(cy + dy)}) scale(${f2(sc)}) scale(1 ${f2(sy)}) rotate(${f2(-p.angle * k)}) translate(${f2(-cx)} ${f2(-cy)})`;
      const inner = p.inner && hooks.renderInner ? hooks.renderInner(p.inner.id, u, { at: p.inner.at ?? 0, dur: p.inner.dur ?? 1e6, params: p.inner.params || {} }, c) :
        (() => { let o = `<defs>${shadowDef(id + 'p', s)}</defs>` + softShadow(id + 'p', x, y, w, h, 26 * s, s, 1 - k) + rect(x, y, w, h, 26 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`) + rect(x, y, w, 70 * s, 26 * s, T.chip) + rect(x, y + 44 * s, w, 26 * s, 0, T.chip) +
          [0, 1, 2].map((j) => `<circle cx="${f2(x + (30 + 26 * j) * s)}" cy="${f2(y + 35 * s)}" r="${f2(8 * s)}" fill="${T.faint}"/>`).join('');
          [0.7, 0.45, 0.9, 0.6, 0.8].forEach((v, j) => { const bw = (w - 120 * s) / 5; o += rect(x + 60 * s + j * bw + bw * 0.15, y + h - 60 * s - (h - 220 * s) * v, bw * 0.7, (h - 220 * s) * v, 8 * s, j === 2 ? p.accent : T.faint); });
          return o + rect(x + 40 * s, y + 104 * s, w * 0.45, 22 * s, 11 * s, T.ink, 'opacity="0.85"'); })();
      const shadow = p.shadow && k > 0.01 ? `<g transform="${M(18 * s)}" opacity="${f2(0.32 * clamp(k))}" filter="url(#${id}f)">${rect(x, y, w, h, 26 * s, 'rgba(20,18,30,0.9)')}</g>` : '';
      return `<defs><filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f2(22 * s)}"/></filter></defs><g${op(clamp(L.in * 1.5) * (1 - L.out))}>${shadow}<g transform="${M(-lift)}">${inner}</g></g>`; } },

  'ui.stateMorph': { tags: ['ui', 'morph', 'state', 'container', 'cursor', 'loop', 'product-film'], dur: 8.6, inF: 6, outF: 6,
    d: { center: [0.5, 0.5], states: MORPH_STATES, path: MORPH_PATH, cls: 'panel', loop: false, theme: 'light', accent: BRAND, cursor: true },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, cx = p.center[0] * c.W, cy = p.center[1] * c.H, id = uid('sm', cx, cy, p.states.length), m = morphAt(u, p), w = m.w * s, h = m.h * s, r = m.r * s, fill = hex(m.col);
      const clicks = (p.path || []).filter((q) => q.click), pr = clicks.reduce((a, q) => Math.max(a, pressAt(u, q.at)), 0), sc = (1 - 0.05 * pr) * (p.loop ? 1 : spring(u, 'ui') * (1 - 0.15 * E.exit(L.out)));
      const S = p.states, cur = S[m.i], prev = m.i > 0 ? S[m.i - 1] : null, uc = u - cur.at, inK = p.loop && m.i === 0 ? 1 : seg(uc, 0.05, 0.22), outK = 1 - seg(uc, 0, 0.08), white = lum(fill), border = white > 0.85 ? `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"` : '';
      const content = `<g clip-path="url(#${id}c)">` + (prev && outK > 0 ? `<g${op(outK)}>${morphContent(prev, u - prev.at, w, h, s, p, T, id + 'p')}</g>` : '') + `<g${op(inK)}>${morphContent(cur, uc, w, h, s, p, T, id + 'q')}</g></g>`;
      const pos = (p.path || []).length ? springTrack(u, [{ t: 0, v: [p.path[0].x, p.path[0].y] }, ...p.path.map((q) => ({ t: q.at - 0.55, v: [q.x, q.y] }))], 'panel') : null;
      const lastAt = (p.path || []).length ? p.path.at(-1).at : 0, cOp = p.cursor && pos ? clamp(seg(u, p.path[0].at - 0.3, p.path[0].at)) * (1 - seg(u, lastAt - 0.1, lastAt + 0.2)) : 0;
      const rip = clicks.map((q) => ripple(q.x * c.W, q.y * c.H, u - q.at, s, p.accent)).join('');
      return `<defs>${shadowDef(id + 's', s)}<clipPath id="${id}c"><rect x="${f2(-w / 2)}" y="${f2(-h / 2)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(r)}"/></clipPath></defs>` +
        `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(Math.max(0.001, sc))})"${p.loop ? '' : op(clamp(L.in * 2) * (1 - L.out))}>${softShadow(id + 's', -w / 2, -h / 2, w, h, r, s, 0.9)}${rect(-w / 2, -h / 2, w, h, r, fill, border)}${content}</g>${rip}` +
        (cOp > 0.001 ? `<g${op(cOp)}>${cursorSvg(pos[0] * c.W, pos[1] * c.H, 1.55 * s, pr)}</g>` : ''); } },
};

/* every ui.* item takes `scale` (default 1): it multiplies the size unit ctx.s (type, radii, strokes, rows), while `box` / `center` stay frame fractions.
   Real product UI is small on a 16:9 frame; 1.3-1.6 keeps it legible on a phone (check the 360 px test). */
for (const g of Object.values(UI)) { const f = g.svg; g.file = 'type/gfx/ui.js'; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale } : c); }

/* ---------- sound cue hook (local times; the item's `at` is added by index.js uiCues) ---------- */
/* round-robin over sibling sounds so a run of identical UI events never repeats one sample 3+ times in 8 events (music/mixer.py lint R9) */
export const rr = (list, i) => list[i % list.length];
export const TICKS = ['sfx/ui/tick', 'sfx/ui/count_tick', 'sfx/device/loading_tick'], POPS = ['sfx/ui/pop', 'sfx/device/card_flip', 'sfx/ui/blip'];
export const UI_CUES = {
  'ui.agentActivity': (p) => [...p.steps.map((_, i) => ({ t: p.start + i * p.step, id: rr(TICKS, i), why: 'step ' + (i + 1) + ' becomes active' })), { t: p.start + p.steps.length * p.step, id: 'sfx/ui/success', why: 'last step done' },
    ...(p.card ? (p.card.points || []).map((_, i) => ({ t: (p.card.at ?? p.start) + 0.25 + i * (p.card.pointStep ?? p.step * 0.7), id: 'sfx/ui/blip', why: 'map point' })).filter((_, i) => i % 2 === 0) : [])],
  'ui.promptBar': (p) => { const { sendAt, typeEnd } = promptTimes(p), out = [{ t: 0, id: 'sfx/ui/slide', why: 'bar lands' }]; for (let t = p.typeAt; t < typeEnd - 0.1; t += 1.0) out.push({ t, id: 'sfx/ui/typing_burst', why: 'typing' });
    return [...out, { t: sendAt, id: 'sfx/ui/click', why: 'send click' }, { t: sendAt + 0.08, id: 'sfx/device/message_sent', why: 'prompt sent' }]; },
  'ui.checklist': (p) => [...p.steps.map((_, i) => ({ t: p.start + (i + 1) * p.step, id: rr(POPS, i), why: 'step ' + (i + 1) + ' ticked' })), { t: p.start + p.steps.length * p.step + 0.05, id: 'sfx/ui/success', why: 'all done' }],
  'ui.nodeGraph': (p) => { const at = graphTimes(p); return p.nodes.map((n, i) => ({ t: at[n.id], id: n.kind === 'condition' ? 'sfx/ui/toggle_on' : rr(POPS, i), why: n.kind + ' card lands' })); },
  'ui.scanOverlay': (p) => [{ t: p.lockAt, id: 'sfx/ui/camera_ping', why: 'brackets lock' }, { t: p.sweepAt, id: 'sfx/device/progress_fill', why: 'sweep starts' }, { t: p.sweepAt + p.sweepDur, id: 'sfx/ui/success', why: 'scan done' }],
  'ui.isometricTilt': (p) => [{ t: p.tiltAt, id: 'sfx/whoosh/swish_xs', why: 'panel tilts' }, ...(p.backAt != null ? [{ t: p.backAt, id: 'sfx/whoosh/swish_xs', why: 'panel returns' }] : [])],
  'ui.stateMorph': (p) => { const out = (p.path || []).filter((q) => q.click).map((q) => ({ t: q.at, id: 'sfx/ui/click', why: 'cursor click' }));
    const snd = { button: 'sfx/ui/pop', input: 'sfx/ui/slide', loader: 'sfx/ui/ai_think_pulse', check: 'sfx/ui/success', card: 'sfx/device/card_flip', chart: 'sfx/device/progress_fill', toast: 'sfx/ui/notify', pill: 'sfx/ui/pop_down' };
    p.states.slice(1).forEach((s) => { if (snd[s.kind]) out.push({ t: s.at + 0.03, id: snd[s.kind], why: 'morph to ' + s.kind }); if (s.kind === 'input') out.push({ t: s.at + 0.15, id: 'sfx/ui/typing_burst', why: 'typing' }); });
    return out.sort((a, b) => a.t - b.t); },
};
/* camera helper for a DOM wrapper that holds the graph (cam2d-compatible state; x, y in frame-height units): pans along the nodes on the camera spring */
export function nodeGraphCam(params = {}, { W = 1920, H = 1080 } = {}) { const p = { ...UI['ui.nodeGraph'].d, ...params, cam: true }, c = { W, H, s: H / 1080 * (p.scale || 1) };
  const [x0, y0] = graphFocus(-1, p, c); return (u) => { const [fx, fy] = graphFocus(u, p, c); return { x: -(fx - x0) / H, y: -(fy - y0) / H, scale: 1, rot: 0, blur: 0, blurAngle: 0, origin: [0.5, 0.5] }; }; }
