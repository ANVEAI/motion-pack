/* motion-pack / type / gfx / chips.js: two small persistent-feed chips (2026-10-16; XP round 8 / Mirelo study 2026-10-16, craft only: timings and
   construction were measured from public launch films, no brand, wording, glyph or look-alike is copied; the speaker glyph and every icon here are owned geometry).
   Same contract as core.js: { tags, dur, inF, outF, d, svg(L, p, ctx) } -> SVG markup, a PURE FUNCTION OF TIME t (no clock, no unseeded random, no state between frames,
   no caches: any frame renders the same in any seek order and in any process). Scale: sizes from the SHORTER frame side (S = min(W, H) / 1080 * scale), so a 9:16 frame
   gets the same chip as a 16:9 one. Placement: inside the safe rect of `p.platform` (type/safezones.js) when given, else the renderSVG platform (ctx.safe).
     caption.soundOnPill  a frosted-glass "Sound on" pill for muted-autoplay feeds. Frame 0: an outline that draws on around the text (and an owned speaker glyph whose
                          waves pulse); at `solidAt` (0.5 s) it turns into a solid frosted pill (semi-opaque fill, a soft drop blur, a subtle top highlight) with a small pop;
                          a soft exit ends exactly at `outAt` (1.5 s), after which the part renders ''. The item's lifetime follows outAt (durOf), so moving outAt needs no `dur`.
                          The text keeps WCAG >= 4.5:1 against its own fill composited over black AND white (soundPillContrast; the fill is opaque enough for that).
                          Sound: one soft UI pop on solidAt at low gain (CHIPS_CUES, gain_db -8).
     ui.stateChip         a persistent corner chip that survives cuts (place it once for the whole film, `dur` = the film) and flips state on planned frames:
                          states = [{ t, label, tone: 'before' | 'done' | 'neutral', icon?: 'dot' | 'tick' | 'lock' | 'eq' }]; the chip shows the LAST state whose t <= local time
                          (the first state before that). On each flip: a short colour flash (`flash` frames) and a ring, the width morphs between the two label widths (measure()
                          from core.js), the new label swaps in ON the flip frame and rises into place, and the tick (tone 'done''s default icon) draws on. stateChipFlips(params) gives the flip times (local s) for sound sync;
                          CHIPS_CUES gives one tick per flip (sfx/ui/toggle_on into 'done', sfx/ui/tick otherwise). Default tone colours: before = amber #B45309 on #FFF7ED,
                          done = white on violet #4A18ED, neutral = grey; a caller's ink that falls under 4.5:1 on its fill is replaced by black or white, whichever reads.
   Guards: every number is clamped (num), strings are cut BEFORE any regex (40 / 32 chars), lists are capped (states 64) before sorting, colours are #hex only,
   so NaN, Infinity, negative times, megabyte strings or a million states cannot hang a render or grow its output. */
import { E, clamp, lerp, seg, TAU, FONT, BRAND, esc, f2, measure, lum, inkOn } from './core.js';
import { safeRect, SAFE } from '../safezones.js';
import { mixHex } from './swap.js';

/* ---------- guards ---------- */
const num = (v, d, lo, hi) => { const x = v == null || v === '' || typeof v === 'boolean' ? NaN : +v; return Number.isFinite(x) ? clamp(x, lo, hi) : d; };
const str = (v, d = '', max = 40) => (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v).slice(0, max).replace(/[\u0000-\u001f]/g, ' ') : d);
const hexOk = (v, d) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? (v.length === 4 ? '#' + [...v.slice(1)].map((x) => x + x).join('') : v).toUpperCase() : d);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const SZ = (c, p) => (Math.min(c.W, c.H) / 1080) * p.scale;
const safeOf = (c, p) => (p.platform && own(SAFE, p.platform) ? safeRect(p.platform, c.W, c.H) : c.safe);
const rrect = (x, y, w, h, extra = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, w))}" height="${f2(Math.max(0, h))}" rx="${f2(Math.max(0, h) / 2)}" ${extra}/>`;
/* WCAG 2 contrast ratio of two #hex colours, and a #hex colour composited at `a` over a #hex background */
export const contrastRatio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
export const over = (fg, a, bg) => mixHex(bg, fg, clamp(a));

/* ====================================================================== caption.soundOnPill ====================================================================== */
export const SOUND_PILL_THEMES = {
  dark: { fill: '#16161C', fillOp: 0.84, ink: '#FFFFFF', hi: 0.16, hair: '#FFFFFF', accent: '#A99BFF' },
  light: { fill: '#FFFFFF', fillOp: 0.86, ink: '#0E0E14', hi: 0.6, hair: '#0E0E14', accent: BRAND },
};
const PILL_D = { text: 'Sound on', x: 0.5, y: null, solidAt: 0.5, outAt: 1.5, icon: 'speaker', theme: 'dark', accent: null, scale: 1, platform: null };
export function soundPillP(raw = {}) {
  const p = { ...PILL_D, ...(isObj(raw) ? raw : {}) }, out = {};
  out.text = str(p.text, '', 40).trim() || 'Sound on'; out.theme = p.theme === 'light' ? 'light' : 'dark'; const T = SOUND_PILL_THEMES[out.theme];
  out.outAt = num(p.outAt, 1.5, 0.1, 600); out.solidAt = num(p.solidAt, 0.5, 0, out.outAt); out.icon = p.icon === 'none' || p.icon === false || p.icon === null ? 'none' : 'speaker';
  out.accent = hexOk(p.accent, T.accent); out.scale = num(p.scale, 1, 0.2, 4); out.x = num(p.x, 0.5, 0, 1); out.y = p.y == null || p.y === '' ? null : num(p.y, null, 0, 1); out.platform = typeof p.platform === 'string' ? p.platform : null;
  return out;
}
/* the worst-case WCAG ratio of the pill text on its solid fill: the semi-opaque fill (plus the top highlight) composited over pure black and pure white video */
export function soundPillContrast(theme = 'dark') { const T = SOUND_PILL_THEMES[theme === 'light' ? 'light' : 'dark'];
  return Math.min(...['#000000', '#FFFFFF'].flatMap((bg) => { const base = over(T.fill, T.fillOp, bg); return [base, over('#FFFFFF', T.hi, base)].map((f) => contrastRatio(T.ink, f)); })); }
/* timings (local s): outline draws on 0 -> drawEnd, solid from solidAt over 4 frames, exit from exitAt to outAt */
export function soundPillTimes(raw = {}) { const p = soundPillP(raw), exitDur = Math.min(0.3, Math.max(0.05, (p.outAt - p.solidAt) * 0.5)); return { drawEnd: Math.max(0.12, Math.min(0.4, p.solidAt * 0.8)), solidAt: p.solidAt, solidEnd: p.solidAt + 4 / 30, exitAt: Math.max(0, p.outAt - exitDur), outAt: p.outAt }; }
export function soundPillGeo(p, c) {
  const S = SZ(c, p), sr = safeOf(c, p); let fs = 30 * S, h = fs * 2, padX = h * 0.42, iconW = p.icon === 'speaker' ? fs * 1.2 : 0, gap = iconW ? fs * 0.42 : 0, tw = measure(p.text, fs, { weight: 700 }), w = padX * 2 + iconW + gap + tw;
  const fit = Math.min(1, (sr.w * 0.96) / w); if (fit < 1) { fs *= fit; h *= fit; padX *= fit; iconW *= fit; gap *= fit; tw *= fit; w *= fit; }
  const cx = clamp(p.x * c.W, sr.x0 + w / 2, Math.max(sr.x0 + w / 2, sr.x1 - w / 2)), cy0 = p.y == null ? sr.y0 + h / 2 + 16 * S : p.y * c.H, cy = clamp(cy0, sr.y0 + h / 2, Math.max(sr.y0 + h / 2, sr.y1 - h / 2));
  return { S, fs, h, w, x: cx - w / 2, y: cy - h / 2, cx, cy, padX, iconW, gap, tw, safe: sr };
}
const speaker = (x, cy, ib, ink, accent, u) => { const bx = x + ib * 0.06;
  let g = `<path data-role="speaker" d="M${f2(bx)} ${f2(cy - ib * 0.17)} h${f2(ib * 0.2)} l${f2(ib * 0.24)} ${f2(-ib * 0.22)} v${f2(ib * 0.78)} l${f2(-ib * 0.24)} ${f2(-ib * 0.22)} h${f2(-ib * 0.2)} Z" fill="${ink}" stroke="${ink}" stroke-width="${f2(ib * 0.05)}" stroke-linejoin="round"/>`;
  const ox = bx + ib * 0.5; [0.2, 0.38].forEach((r0, i) => { const r = r0 * ib, a = Math.PI / 4, op = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * u * 1.4 - i * 1.2));
    g += `<path data-role="wave" d="M${f2(ox + r * Math.cos(-a))} ${f2(cy + r * Math.sin(-a))} A${f2(r)} ${f2(r)} 0 0 1 ${f2(ox + r * Math.cos(a))} ${f2(cy + r * Math.sin(a))}" fill="none" stroke="${accent}" stroke-width="${f2(ib * 0.09)}" stroke-linecap="round" opacity="${f2(op)}"/>`; });
  return g; };
function soundPill(L, p0, c) {
  const p = soundPillP(p0), u = L.u; if (u < 0 || u >= p.outAt) return '';
  const T = SOUND_PILL_THEMES[p.theme], G = soundPillGeo(p, c), Tm = soundPillTimes(p), S = G.S, solid = u >= p.solidAt ? E.enter(seg(u, Tm.solidAt, Tm.solidEnd)) : 0, xk = E.soft(seg(u, Tm.exitAt, p.outAt));
  const draw = 0.2 + 0.8 * E.enter(seg(u, 0, Tm.drawEnd)), pop = 1 + 0.05 * Math.sin(Math.PI * seg(u, p.solidAt, p.solidAt + 0.2)) * (u >= p.solidAt ? 1 : 0), sc = pop * (1 - 0.06 * xk), dy = -8 * S * xk, op = clamp((0.6 + 0.4 * seg(u, 0, 0.1)) * (1 - xk));
  const { x, y, w, h, cy } = G, sw = lerp(2.6, 1.2, solid) * S, so = lerp(0.92, 0.28, solid); let o = '', defs = '';
  if (solid > 0.001) { defs += `<filter id="pshadow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${f2(12 * S)}"/></filter><linearGradient id="phi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="${f2(T.hi)}"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;
    o += rrect(x, y + 6 * S, w, h, `fill="#000000" opacity="${f2(0.28 * solid)}" filter="url(#pshadow)"`) + rrect(x, y, w, h, `data-role="fill" fill="${T.fill}" fill-opacity="${f2(T.fillOp * solid)}"`) + rrect(x, y, w, h, `fill="url(#phi)" opacity="${f2(solid)}"`); }
  o += rrect(x, y, w, h, `data-role="pill" fill="none" stroke="${T.hair}" stroke-opacity="${f2(so)}" stroke-width="${f2(sw)}" pathLength="100" stroke-dasharray="${f2(100 * draw)} 100" stroke-linecap="round"`);
  if (G.iconW) o += speaker(x + G.padX, cy, G.iconW, T.ink, p.accent, u);
  o += `<text data-role="label" x="${f2(x + G.padX + G.iconW + G.gap)}" y="${f2(cy + G.fs * 0.36)}" font-family="${esc(FONT)}" font-size="${f2(G.fs)}" font-weight="700" fill="${T.ink}">${esc(p.text)}</text>`;
  return `${defs ? `<defs>${defs}</defs>` : ''}<g data-role="sound-pill" data-solid="${solid > 0.001 ? 1 : 0}" opacity="${f2(op)}" transform="translate(${f2(G.cx)} ${f2(cy + dy)}) scale(${sc.toFixed(4)}) translate(${f2(-G.cx)} ${f2(-cy)})">${o}</g>`;
}

/* ====================================================================== ui.stateChip ====================================================================== */
export const CHIP_TONES = { before: { fill: '#FFF7ED', ink: '#B45309', line: '#B45309' }, done: { fill: '#4A18ED', ink: '#FFFFFF', line: '#4A18ED' }, neutral: { fill: '#F1F1F4', ink: '#3F3F46', line: '#A1A1AA' } };
const TONE_ICON = { before: 'dot', done: 'tick', neutral: 'dot' }, ICONS = new Set(['dot', 'tick', 'lock', 'eq']), CORNERS = new Set(['tl', 'tr', 'bl', 'br']);
const CHIP_D = { states: [{ t: 0, label: 'Draft', tone: 'before', icon: 'dot' }, { t: 1.5, label: 'Checked', tone: 'done', icon: 'tick' }], corner: 'tr', colors: null, flash: 6, scale: 1, platform: null };
export function chipP(raw = {}) {
  const p = { ...CHIP_D, ...(isObj(raw) ? raw : {}) }, out = { corner: CORNERS.has(p.corner) ? p.corner : 'tr', flash: num(p.flash, 6, 0, 60), scale: num(p.scale, 1, 0.2, 4), platform: typeof p.platform === 'string' ? p.platform : null, colors: {} };
  const src = Array.isArray(p.states) ? p.states.slice(0, 64) : [];
  out.states = src.filter(isObj).map((s) => { const tone = own(CHIP_TONES, s.tone) ? s.tone : 'neutral'; return { t: num(s.t, 0, -1e6, 1e6), label: str(s.label, '', 32), tone, icon: ICONS.has(s.icon) ? s.icon : TONE_ICON[tone] }; }).sort((a, b) => a.t - b.t);
  const cc = isObj(p.colors) ? p.colors : {};
  for (const k of Object.keys(CHIP_TONES)) { const d = CHIP_TONES[k], q = isObj(cc[k]) ? cc[k] : {}, fill = hexOk(q.fill, d.fill), line = hexOk(q.line, own(q, 'fill') ? fill : d.line); let ink = hexOk(q.ink, d.ink);
    if (contrastRatio(ink, fill) < 4.5) ink = inkOn(fill, '#000000', '#FFFFFF'); out.colors[k] = { fill, ink, line }; }
  return out;
}
const idxAt = (st, u) => { let i = 0; for (let k = 0; k < st.length; k++) { if (st[k].t <= u + 1e-9) i = k; else break; } return i; };
/* flip times (local s, sorted, unique): every later state's start that falls after the chip's start (a state at or before 0 is the opening state, no flash, no tick) */
export function stateChipFlips(raw = {}) { const st = chipP(raw).states, out = []; for (let i = 1; i < st.length; i++) { const t = st[i].t; if (t > 0 && (!out.length || t > out.at(-1) + 1e-9)) out.push(+t.toFixed(4)); } return out; }
/* the state on screen at local time u: { index, label, tone, icon } */
export function stateChipAt(raw = {}, u = 0) { const st = chipP(raw).states; if (!st.length) return null; const i = idxAt(st, u); return { index: i, ...st[i] }; }
export function chipGeo(p, c) { const S = SZ(c, p), sr = safeOf(c, p), fs = 26 * S, h = 54 * S, padX = 20 * S, iconW = 20 * S, gap = 10 * S;
  const widthOf = (label) => Math.min(sr.w, padX * 2 + iconW + (label ? gap + measure(label, fs, { weight: 700 }) : 0)); return { S, fs, h, padX, iconW, gap, safe: sr, widthOf, right: p.corner[1] === 'r', bottom: p.corner[0] === 'b' }; }
const chipIcon = (kind, x, cy, s, ink, u, tick) => {
  if (kind === 'tick') return `<path data-role="tick" d="M${f2(x + s * 0.1)} ${f2(cy + s * 0.04)} L${f2(x + s * 0.4)} ${f2(cy + s * 0.32)} L${f2(x + s * 0.92)} ${f2(cy - s * 0.3)}" fill="none" stroke="${ink}" stroke-width="${f2(s * 0.16)}" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="${f2(100 * tick)} 100"/>`;
  if (kind === 'lock') return `<path d="M${f2(x + s * 0.26)} ${f2(cy - s * 0.06)} v${f2(-s * 0.14)} a${f2(s * 0.24)} ${f2(s * 0.24)} 0 0 1 ${f2(s * 0.48)} 0 v${f2(s * 0.14)}" fill="none" stroke="${ink}" stroke-width="${f2(s * 0.12)}"/>` + `<rect data-role="lock" x="${f2(x + s * 0.12)}" y="${f2(cy - s * 0.08)}" width="${f2(s * 0.76)}" height="${f2(s * 0.46)}" rx="${f2(s * 0.08)}" fill="${ink}"/>`;
  if (kind === 'eq') return [0, 1, 2].map((j) => { const bh = s * (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(TAU * u * 2.2 + j * 1.9))); return `<rect x="${f2(x + s * (0.1 + j * 0.3))}" y="${f2(cy + s * 0.4 - bh)}" width="${f2(s * 0.2)}" height="${f2(bh)}" rx="${f2(s * 0.05)}" fill="${ink}"/>`; }).join('');
  return `<circle data-role="dot" cx="${f2(x + s * 0.5)}" cy="${f2(cy)}" r="${f2(s * 0.26 * (1 + 0.08 * Math.sin(TAU * u * 1.2)))}" fill="${ink}"/>`;
};
const MORPH = 0.28, TINT = 3 / 30;
/* a flip: the new state's label and icon are on screen ON the flip frame (hard content swap; the label rises 8 px into place and is clipped by the chip while the width
   morphs from the old label's width to the new one's), fill / ink / outline tint from the old tone to the new one over 3 frames, a white flash + ring over `flash` frames,
   and for an icon 'tick' the tick draws on. A settled frame draws only the current state. */
function stateChip(L, p0, c) {
  const p = chipP(p0), st = p.states; if (!st.length) return ''; const u = L.u, G = chipGeo(p, c), S = G.S, sr = G.safe, i = idxAt(st, u), cur = st[i];
  const F = i > 0 && cur.t > 0 ? cur.t : null, prev = F === null ? cur : st[idxAt(st, F - 1e-6)], m = F === null ? 1 : E.enter(seg(u, F, F + MORPH)), tk = F === null ? 1 : seg(u, F, F + TINT), fk = F === null || p.flash <= 0 ? 0 : Math.sin(Math.PI * seg(u, F, F + p.flash / 30));
  const C = p.colors[cur.tone], Cp = p.colors[prev.tone], w = lerp(G.widthOf(prev.label), G.widthOf(cur.label), m), h = G.h, ent = E.enter(L.in) * (1 - E.exit(L.out)), slide = (1 - E.enter(L.in)) * 16 * S * (G.bottom ? 1 : -1);
  const mix = (a, b) => (tk < 1 ? mixHex(a, b, tk) : b), x = G.right ? sr.x1 - w : sr.x0, y = G.bottom ? sr.y1 - h : sr.y0, cy = y + h / 2, fill = mix(Cp.fill, C.fill), line = mix(Cp.line, C.line), ink = mix(Cp.ink, C.ink), ix = x + G.padX, tx = ix + G.iconW + G.gap;
  let o = rrect(x, y, w, h, `data-role="chip-fill" fill="${fill}" stroke="${line}" stroke-opacity="0.35" stroke-width="${f2(1.5 * S)}"`);
  if (fk > 0.001) { const g = seg(u, F, F + p.flash / 30); o += rrect(x, y, w, h, `data-role="flash" fill="#FFFFFF" opacity="${f2(0.22 * fk)}"`) + rrect(x - 8 * S * g, y - 8 * S * g, w + 16 * S * g, h + 16 * S * g, `fill="none" stroke="${C.line}" stroke-width="${f2(2 * S)}" opacity="${f2(0.6 * (1 - g))}"`); }
  const tick = cur.icon === 'tick' ? (F === null ? 1 : E.enter(seg(u, F + 0.04, F + 0.34))) : 1, rise = (1 - m) * 8 * S;
  o += `<clipPath id="chipclip"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(h / 2)}"/></clipPath><g clip-path="url(#chipclip)">` + chipIcon(cur.icon, ix, cy, G.iconW, ink, u, tick);
  if (cur.label) o += `<text data-role="label" x="${f2(tx)}" y="${f2(cy + G.fs * 0.36 + rise)}" font-family="${esc(FONT)}" font-size="${f2(G.fs)}" font-weight="700" fill="${ink}">${esc(cur.label)}</text>`;
  return `<g data-role="state-chip" data-state="${i}" data-tone="${cur.tone}"${ent < 0.999 ? ` opacity="${f2(ent)}"` : ''}${Math.abs(slide) > 0.01 ? ` transform="translate(0 ${f2(slide)})"` : ''}>${o}</g></g>`;
}

/* ====================================================================== the parts ====================================================================== */
export const CHIPS = {
  'caption.soundOnPill': { file: 'type/gfx/chips.js', tags: ['caption', 'sound-on', 'muted-autoplay', 'pill', 'frosted', 'feed', 'social', 'hook', 'frame-0'], dur: 1.5 - 2 / 30, inF: 1, outF: 1, d: PILL_D,
    durOf: (p) => Math.max(0, soundPillP(p).outAt - 2 / 30), svg: soundPill },
  'ui.stateChip': { file: 'type/gfx/chips.js', tags: ['ui', 'state', 'chip', 'status', 'persistent', 'corner', 'before-after', 'tick', 'badge'], dur: 6, inF: 8, outF: 8, d: CHIP_D,
    durOf: (p) => Math.min(3600, Math.max(6, ...chipP(p).states.map((s) => s.t + 1.5))), svg: stateChip },
};
/* one cue per action (local s; gfxCues adds the item's at). gain_db is a hint over the bed: the pill pop is deliberately quiet */
export const CHIPS_CUES = {
  'caption.soundOnPill': (p0) => [{ t: +soundPillP(p0).solidAt.toFixed(4), id: 'sfx/ui/pop', why: 'sound-on pill turns solid', gain_db: -8 }],
  'ui.stateChip': (p0) => { const p = chipP(p0); return stateChipFlips(p0).map((t) => { const s = p.states[idxAt(p.states, t)]; return { t, id: s.tone === 'done' ? 'sfx/ui/toggle_on' : 'sfx/ui/tick', why: 'state chip flips to "' + s.label + '"', gain_db: -6 }; }); },
};
export const CHIPS_IDS = Object.keys(CHIPS);
export const CHIPS_LIM = { 'caption.soundOnPill': { solidAt: [0, 600], outAt: [0.1, 600], scale: [0.2, 4], x: [0, 1], y: [0, 1] }, 'ui.stateChip': { flash: [0, 60], scale: [0.2, 4], 'states.*.t': [-1e6, 1e6] } };
