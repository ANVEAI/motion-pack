/* motion-pack / type / gfx / human.js: parts for PERSONAL, TUTORIAL and HUMAN-BLENDED videos (2026-10-16, lane "human").
   Same contract as core.js: { tags, dur, inF, outF, d, svg(L, p, ctx) } -> SVG markup, a pure function of t (no clock, no unseeded random, no DOM state).
   Scale: every part sizes from the SHORTER frame side (S = min(W, H) / 1080 * size), so a 9:16 frame gets the same type size as a 16:9 one, not 1.78x.
   Positions: p.pos = 'bl' | 'br' | 'tl' | 'tr' | 'bc' | 'tc' | 'c' (inside the platform safe rect) or [x, y] frame fractions; boxes are [x, y, w, h] frame fractions.
   Parts:
     ui.keyCombo          keyboard-shortcut overlay: keycaps press in turn, the action label under them
     callout.highlightBox  a box that draws on around a region of the screen, with an optional tag
     ui.codeCallout       a code panel: line numbers, light token colours, highlighted line ranges that step in; other lines dim
     ui.stepCounter       "STEP n / total" pill with dots; steps change on plan times
     ui.cursorTrack       an arrow cursor that follows a [[t, x, y, click?], ...] track (local seconds, host fractions) with click ripples
     ui.waveform          bars around the playhead from a per-frame envelope (0..1) measured from the mix; flat line when no envelope is given
     title.locationCard   a place + date card (vlog): pin, the place, the date in mono
     title.yearTimeline   years on a line; the active year steps on plan times (founder story)
     caption.pullQuote    a pull-out of the speaker's OWN words (templates check the quote is verbatim in the transcript), with attribution
     ui.quizCard          a question, options, a pause ring, then the answer lights up (course lesson)
     title.recapCard      recap bullets that tick in turn
     title.hookCard       a title hook that is visible and moving on frame 0 (podcast clip)
     title.endScreen      end screen with labelled NEXT-VIDEO SLOTS (the platform's own end-screen elements go there) + a subscribe pill
     callout.resultReveal a "result" tab and a sweep line across a region (the page swaps the before / after picture on the same times)
   Honesty: no default here prints a number that could read as a finding; ordinals the part computes itself (step n of total, code line numbers) are
   mechanics (type/tests/honesty-defaults.test.mjs ALLOW); the year timeline's default years print 'example years · placeholder data'. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, MONO, BRAND, INK, PAPER, esc, f2, text, anchor, inkOn, dash } from './core.js';
import { wrapWords } from './ui-data.js';

const SZ = (c, p) => (Math.min(c.W, c.H) / 1080) * (Number.isFinite(+p.size) && +p.size > 0 ? Math.min(4, +p.size) : 1);
const BOX = (c, b, d = [0.3, 0.3, 0.4, 0.3]) => { const v = Array.isArray(b) && b.length >= 4 ? b.map(Number) : d; return [v[0] * c.W, v[1] * c.H, Math.max(1, v[2] * c.W), Math.max(1, v[3] * c.H)]; };
const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, w))}" height="${f2(Math.max(0, h))}" rx="${f2(Math.max(0, r))}" fill="${fill}" ${extra}/>`;
const op = (k) => f2(clamp(k));
const list = (v, n = 64) => (Array.isArray(v) ? v.slice(0, n) : []);
const str = (v) => String(v ?? '');
/* cumulative step index at local time u from a sorted list of change times */
const stepAt = (times, u) => { let i = -1; for (const tt of times) { if (u >= tt) i++; else break; } return i; };

/* ---------- ui.keyCombo ---------- */
function keyCombo(L, p, c) {
  const S = SZ(c, p), keys = list(p.keys, 8).map(str), ks = 46 * S, padX = 26 * S, kh = 96 * S, gap = 18 * S, plus = 34 * S;
  const kw = keys.map((k) => Math.max(kh, k.length * ks * 0.62 + padX * 2)), rowW = kw.reduce((a, b) => a + b, 0) + Math.max(0, keys.length - 1) * (gap * 2 + plus * 0.6);
  const lab = str(p.label), ls = 34 * S, w = Math.max(rowW, lab.length * ls * 0.52) + 64 * S, h = kh + (lab ? ls + 40 * S : 0) + 56 * S, [x, y] = anchor(p.pos, c, w, h);
  const k = E.enter(L.in) * (1 - E.exit(L.out)), lift = (1 - E.enter(L.in)) * 30 * S + E.exit(L.out) * 20 * S;
  let g = `<g opacity="${op(k)}" transform="translate(0 ${f2(lift)})">` + rr(x, y, w, h, 28 * S, 'rgba(14,14,20,0.86)', `stroke="rgba(255,255,255,0.14)" stroke-width="${f2(2 * S)}"`);
  let kx = x + (w - rowW) / 2; const ky = y + 28 * S;
  keys.forEach((key, i) => {
    const t0 = (+p.pressAt || 0.15) + i * (+p.stagger || 0.16), down = seg(L.u, t0, t0 + 0.06) * (1 - seg(L.u, (+p.releaseAt || 1.2), (+p.releaseAt || 1.2) + 0.12)), dy = down * 8 * S;
    g += rr(kx, ky + 10 * S, kw[i], kh, 18 * S, '#5B5B66') + rr(kx, ky + dy, kw[i], kh, 18 * S, down > 0.5 ? p.accent : '#F4F2EE', `stroke="rgba(0,0,0,0.25)" stroke-width="${f2(2 * S)}"`);
    g += text(key, kx + kw[i] / 2, ky + dy + kh / 2 + ks * 0.36, { size: ks, weight: 800, fill: down > 0.5 ? inkOn(p.accent) : INK, anchor: 'middle' });
    kx += kw[i];
    if (i < keys.length - 1) { g += text('+', kx + gap + plus * 0.3, ky + kh / 2 + plus * 0.36, { size: plus, weight: 800, fill: 'rgba(255,255,255,0.7)', anchor: 'middle' }); kx += gap * 2 + plus * 0.6; }
  });
  if (lab) g += text(lab, x + w / 2, y + 28 * S + kh + 22 * S + ls * 0.9, { size: ls, weight: 700, fill: PAPER, anchor: 'middle', op: seg(L.u, 0.2, 0.45) });
  return g + '</g>';
}

/* ---------- callout.highlightBox ---------- */
function highlightBox(L, p, c) {
  const S = SZ(c, p), [bx, by, bw, bh] = BOX(c, p.box), pad = (+p.pad || 0) * Math.min(c.W, c.H), x = bx - pad, y = by - pad, w = bw + 2 * pad, h = bh + 2 * pad, r = (+p.radius || 0) * Math.min(c.W, c.H);
  const per = 2 * (w + h), draw = E.hero(L.in), fade = 1 - E.exit(L.out), sw = (+p.width || 6) * S;
  let g = `<g opacity="${op(fade)}">`;
  if (p.fill) g += rr(x, y, w, h, r, p.color, `opacity="${f2(0.14 * draw)}"`);
  g += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(r)}" fill="none" stroke="${p.color}" stroke-width="${f2(sw)}" stroke-linejoin="round" ${dash(per, draw)}/>`;
  const lab = str(p.label);
  if (lab) { const ls = 30 * S, lw = lab.length * ls * 0.56 + 36 * S, lh = ls + 22 * S, top = p.labelPos !== 'bottom', ly = top ? y - lh - 10 * S : y + h + 10 * S, k = seg(L.u, 0.25, 0.45);
    g += `<g opacity="${op(k)}">` + rr(x, ly, lw, lh, 10 * S, p.color) + text(lab, x + 18 * S, ly + lh / 2 + ls * 0.36, { size: ls, weight: 800, fill: inkOn(p.color) }) + '</g>'; }
  return g + '</g>';
}

/* ---------- ui.codeCallout ---------- */
const KW = /^(const|let|var|function|return|if|else|for|while|import|from|export|class|new|true|false|null|await|async|def|in|of)$/;
function codeTokens(line, base, kw, strc, com) {
  const out = []; const re = /(\/\/.*$|#.*$)|("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_][\w$]*)|(\s+)|(.)/g; let m;
  while ((m = re.exec(line))) { if (m[1]) out.push([m[1], com]); else if (m[2]) out.push([m[2], strc]); else if (m[3]) out.push([m[3], KW.test(m[3]) ? kw : base]); else out.push([m[0], base]); }
  return out;
}
function codeCallout(L, p, c) {
  const S = SZ(c, p), [x, y, w, h] = BOX(c, p.box, [0.1, 0.14, 0.8, 0.72]), lines = list(p.lines, 60).map(str), dark = p.theme !== 'light';
  const bg = dark ? '#16161D' : '#FBFAF7', base = dark ? '#E7E5E0' : '#1B1A22', kw = dark ? '#B9A6FF' : '#4A18ED', strc = dark ? '#8FE3B0' : '#0F7A45', com = dark ? '#8C8A93' : '#8C8A93', gutter = dark ? '#5E5C66' : '#A9A59C';
  const head = 64 * S, maxLen = Math.max(20, ...lines.map((l) => l.length)), fsW = (w - (p.numbers === false ? 54 : 116) * S) / (maxLen * 0.6), fs = Math.max(10 * S, Math.min(34 * S, fsW, (h - head - 40 * S) / Math.max(8, lines.length) / 1.5)), lh = fs * 1.5, k = E.enter(L.in) * (1 - E.exit(L.out));
  const hl = list(p.highlight, 24).map((r) => ({ from: Math.max(1, Math.round(+r.from || 1)), to: Math.max(1, Math.round(+(r.to ?? r.from) || 1)), at: +r.at || 0 }));
  const act = hl.filter((r) => L.u >= r.at), cur = act.length ? act[act.length - 1] : null, ka = cur ? E.enter(seg(L.u, cur.at, cur.at + 0.3)) : 0;
  let g = `<g opacity="${op(k)}" transform="translate(0 ${f2((1 - E.enter(L.in)) * 24 * S)})">` + rr(x, y, w, h, 22 * S, bg, `stroke="${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}" stroke-width="${f2(2 * S)}"`);
  g += rr(x, y, w, head, 22 * S, dark ? '#202029' : '#EFECE5') + rr(x, y + head - 22 * S, w, 22 * S, 0, dark ? '#202029' : '#EFECE5');
  for (let i = 0; i < 3; i++) g += `<rect x="${f2(x + (26 + i * 30) * S)}" y="${f2(y + head / 2 - 8 * S)}" width="${f2(16 * S)}" height="${f2(16 * S)}" rx="${f2(4 * S)}" fill="${gutter}"/>`;   // generic window controls (squares: no OS look)
  g += text(str(p.title), x + 130 * S, y + head / 2 + 11 * S, { size: 28 * S, weight: 600, fill: gutter, font: MONO });
  const gx = x + 30 * S, tx = x + (p.numbers === false ? 34 : 96) * S, y0 = y + head + 26 * S, cid = 'cc' + Math.round(x * 7 + y * 3 + w);
  g += `<defs><clipPath id="${cid}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w - 10 * S)}" height="${f2(h)}"/></clipPath></defs><g clip-path="url(#${cid})">`;
  if (cur) { const a = Math.min(cur.from, lines.length), b = Math.min(Math.max(cur.to, cur.from), lines.length); if (a >= 1) g += rr(x + 8 * S, y0 + (a - 1) * lh - fs * 0.2, (w - 16 * S) * ka, (b - a + 1) * lh, 8 * S, p.accent, `opacity="${f2(0.28)}"`) + rr(x + 8 * S, y0 + (a - 1) * lh - fs * 0.2, 6 * S, (b - a + 1) * lh * ka, 3 * S, p.accent); }
  lines.forEach((ln, i) => {
    const n = i + 1, on = !cur || (n >= cur.from && n <= cur.to), dim = cur ? lerp(1, on ? 1 : 0.42, ka) : 1, ly = y0 + i * lh + fs * 0.9;
    if (ly > y + h - 10 * S) return;
    if (p.numbers !== false) g += text(String(n), gx + 40 * S, ly, { size: fs * 0.86, weight: 600, fill: gutter, anchor: 'end', font: MONO, op: dim });
    let cx = tx; const cw = fs * 0.6, tok = codeTokens(ln, base, kw, strc, com); let s = `<text x="${f2(tx)}" y="${f2(ly)}" font-family="${esc(MONO)}" font-size="${f2(fs)}" font-weight="600" opacity="${f2(dim)}" xml:space="preserve">`;
    for (const [tt, col] of tok) { s += `<tspan x="${f2(cx)}" fill="${col}">${esc(tt)}</tspan>`; cx += tt.length * cw; }
    g += s + '</text>';
  });
  return g + '</g></g>';
}

/* ---------- ui.stepCounter ---------- */
function stepCounter(L, p, c) {
  const S = SZ(c, p), steps = list(p.steps, 40).map((s) => [+s[0] || 0, Math.round(+s[1] || 1), str(s[2])]), i = stepAt(steps.map((s) => s[0]), L.u);
  const n = i >= 0 ? steps[i][1] : Math.round(+p.step || 1), total = Math.max(1, Math.round(+p.total || 1)), title = i >= 0 && steps[i][2] ? steps[i][2] : str(p.title);
  const fs = 30 * S, lab = `${str(p.label || 'STEP').toUpperCase()} ${Math.min(n, total)} / ${total}`, tw = lab.length * fs * 0.62, dots = Math.min(total, 12), dw = dots * 22 * S, titW = title ? title.length * fs * 0.55 + 28 * S : 0;
  const w = tw + dw + titW + 80 * S, h = 66 * S, [x, y] = anchor(p.pos, c, w, h), k = E.enter(L.in) * (1 - E.exit(L.out)), chg = i >= 0 ? E.pop(seg(L.u, steps[i][0], steps[i][0] + 0.3)) : 1;
  let g = `<g opacity="${op(k)}">` + rr(x, y, w, h, h / 2, 'rgba(14,14,20,0.82)') + text(lab, x + 30 * S, y + h / 2 + fs * 0.36, { size: fs, weight: 800, fill: PAPER, font: MONO });
  for (let d = 0; d < dots; d++) { const on = d < n, cx = x + 30 * S + tw + 24 * S + d * 22 * S, r = (on && d === n - 1 ? lerp(4, 8, chg) : on ? 7 : 5) * S; g += `<circle cx="${f2(cx)}" cy="${f2(y + h / 2)}" r="${f2(r)}" fill="${on ? p.accent : 'rgba(255,255,255,0.32)'}"/>`; }
  if (title) g += text(title, x + 30 * S + tw + dw + 40 * S, y + h / 2 + fs * 0.34, { size: fs * 0.92, weight: 700, fill: PAPER, op: 0.92 });
  return g + '</g>';
}

/* ---------- ui.cursorTrack ---------- */
export function cursorPos(track, u) {
  const T = list(track, 4096); if (!T.length) return null; if (u <= +T[0][0]) return [+T[0][1], +T[0][2]];
  let lo = 0, hi = T.length - 1; if (u >= +T[hi][0]) return [+T[hi][1], +T[hi][2]];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (+T[m][0] <= u) lo = m; else hi = m; }
  const a = T[lo], b = T[hi], k = (u - a[0]) / Math.max(1e-6, b[0] - a[0]); return [lerp(+a[1], +b[1], k), lerp(+a[2], +b[2], k)];
}
function cursorTrack(L, p, c) {
  const S = SZ(c, p) * 1.0, pos = cursorPos(p.track, L.u); if (!pos) return '';
  const x = pos[0] * c.W, y = pos[1] * c.H, k = clamp(L.in * 2) * (1 - L.out); let g = `<g opacity="${op(k)}">`;
  for (const q of list(p.track, 4096)) { if (!q[3]) continue; const d = L.u - +q[0]; if (d < 0 || d > 0.5) continue; const e = E.enter(d / 0.5);
    g += `<circle cx="${f2(+q[1] * c.W)}" cy="${f2(+q[2] * c.H)}" r="${f2(lerp(10, 64, e) * S)}" fill="${p.ripple}" opacity="${f2(0.45 * (1 - e))}"/><circle cx="${f2(+q[1] * c.W)}" cy="${f2(+q[2] * c.H)}" r="${f2(lerp(8, 46, e) * S)}" fill="none" stroke="${p.ripple}" stroke-width="${f2(4 * S)}" opacity="${f2(1 - e)}"/>`; }
  const press = list(p.track, 4096).some((q) => q[3] && L.u - +q[0] >= -0.05 && L.u - +q[0] < 0.1) ? 0.88 : 1, sc = (+p.scale || 1.6) * S * press;
  g += `<g transform="translate(${f2(x)} ${f2(y)}) scale(${sc.toFixed(4)})"><path d="M0 0 L0 30 L8 23 L13.5 35 L18.5 33 L13 21.5 L23 21.5 Z" fill="${p.color}" stroke="${inkOn(p.color) === INK ? '#0E0E14' : '#FFFFFF'}" stroke-width="2" stroke-linejoin="round"/></g>`;
  return g + '</g>';
}

/* ---------- ui.waveform ---------- */
function waveform(L, p, c) {
  const [x, y, w, h] = BOX(c, p.box, [0.1, 0.4, 0.8, 0.12]), env = Array.isArray(p.env) ? p.env : [], fps = Math.max(1, +p.fps || 30), bars = Math.max(4, Math.min(160, Math.round(+p.bars || 48))), win = Math.max(0.2, Math.min(20, +p.window || 1.6));
  const k = clamp(L.in * 2) * (1 - L.out), bw = w / bars, cy = y + h / 2, t = (+p.offset || 0) + L.u; let g = `<g opacity="${op(k)}">`;
  for (let i = 0; i < bars; i++) {
    const tt = t + (i / (bars - 1) - 0.5) * win, fi = Math.round(tt * fps), v = env.length && fi >= 0 && fi < env.length ? clamp(+env[fi] || 0) : 0, past = tt <= t;
    const bh = Math.max(3, v * h * 0.95), col = past ? p.accent : p.color;
    g += rr(x + i * bw + bw * 0.18, p.mirror === false ? y + h - bh : cy - bh / 2, bw * 0.64, bh, bw * 0.32, col, past ? '' : 'opacity="0.55"');
  }
  return g + '</g>';
}

/* ---------- title.locationCard ---------- */
function locationCard(L, p, c) {
  const S = SZ(c, p), ps = 64 * S, ds = 30 * S, place = str(p.place), date = str(p.date), kick = str(p.kicker), w = Math.max(place.length * ps * 0.56, date.length * ds * 0.62, kick.length * ds * 0.6) + 140 * S, h = ps + ds + (kick ? ds + 16 * S : 0) + 70 * S;
  const [x, y] = anchor(p.pos, c, w, h), wi = E.hero(L.in) * (1 - E.exit(L.out)), id = 'lc' + Math.round(x + y);
  let g = `<defs><clipPath id="${id}"><rect x="${f2(x)}" y="${f2(y - 4)}" width="${f2(w * wi)}" height="${f2(h + 8)}"/></clipPath></defs><g clip-path="url(#${id})">`;
  g += rr(x, y, w, h, 18 * S, 'rgba(14,14,20,0.78)') + rr(x, y, 10 * S, h, 4 * S, p.accent);
  const px = x + 54 * S, py = y + 36 * S + (kick ? ds + 16 * S : 0);
  if (kick) g += text(kick.toUpperCase(), x + 36 * S, y + 30 * S + ds * 0.8, { size: ds * 0.9, weight: 700, fill: p.accent, font: MONO, ls: 2 * S });
  g += `<g transform="translate(${f2(px)} ${f2(py + ps * 0.62)}) scale(${(S * 1.1).toFixed(4)})"><path d="M0 0 C-14 -18 -16 -32 0 -38 C16 -32 14 -18 0 0 Z" fill="${p.accent}"/><circle cy="-25" r="5" fill="${PAPER}"/></g>`;
  g += text(place, px + 34 * S, py + ps * 0.8, { size: ps, weight: 800, fill: PAPER });
  g += text(date, px + 34 * S, py + ps + 16 * S + ds * 0.8, { size: ds, weight: 600, fill: PAPER, font: MONO, op: seg(L.u, 0.3, 0.55) * 0.85 });
  return g + '</g>';
}

/* ---------- title.yearTimeline ---------- */
function yearTimeline(L, p, c) {
  const S = SZ(c, p), Y = list(p.years, 12).map((q) => ({ y: str(q.y ?? q.year ?? q), label: str(q.label) })), n = Y.length; if (!n) return '';
  const [x, y, w, h] = BOX(c, p.box, c.H > c.W ? [0.1, 0.42, 0.8, 0.22] : [0.08, 0.6, 0.84, 0.26]), steps = list(p.steps, 12).map(Number), i = Math.max(0, stepAt(steps, L.u)), k = E.enter(L.in) * (1 - E.exit(L.out));
  const ly = y + h * 0.42, gap = n > 1 ? w / (n - 1) : 0, ys = 52 * S, ls = 28 * S, prog = n > 1 ? (Math.max(0, i - 1) + (i > 0 ? E.move(seg(L.u, steps[i] ?? 0, (steps[i] ?? 0) + 0.5)) : 0)) / (n - 1) : 1;
  let g = `<g opacity="${op(k)}">` + rr(x - 40 * S, y - 30 * S, w + 80 * S, h + 60 * S, 24 * S, 'rgba(14,14,20,0.7)');
  g += `<line x1="${f2(x)}" y1="${f2(ly)}" x2="${f2(x + w)}" y2="${f2(ly)}" stroke="rgba(255,255,255,0.3)" stroke-width="${f2(4 * S)}"/><line x1="${f2(x)}" y1="${f2(ly)}" x2="${f2(x + w * clamp(prog))}" y2="${f2(ly)}" stroke="${p.accent}" stroke-width="${f2(6 * S)}"/>`;
  Y.forEach((q, j) => {
    const cx = n > 1 ? x + j * gap : x + w / 2, on = j <= i, cur = j === i, pop = cur ? E.pop(seg(L.u, steps[j] ?? 0, (steps[j] ?? 0) + 0.35)) : 1, r = (cur ? lerp(9, 18, pop) : on ? 11 : 8) * S;
    g += `<circle cx="${f2(cx)}" cy="${f2(ly)}" r="${f2(r)}" fill="${on ? p.accent : '#3A3A44'}" stroke="${PAPER}" stroke-width="${f2((cur ? 4 : 2) * S)}"/>`;
    const anc = j === 0 && n > 1 ? 'start' : j === n - 1 && n > 1 ? 'end' : 'middle';
    g += text(q.y, cx, ly - 30 * S, { size: cur ? ys : ys * 0.7, weight: 800, fill: PAPER, anchor: anc, op: cur ? 1 : on ? 0.7 : 0.45 });
    if (q.label && cur) g += text(q.label, cx, ly + 30 * S + ls, { size: ls, weight: 600, fill: PAPER, anchor: anc, op: seg(L.u, (steps[j] ?? 0) + 0.1, (steps[j] ?? 0) + 0.4) });
  });
  if (str(p.note)) g += text(str(p.note), x + w, y + h + 18 * S, { size: 22 * S, weight: 600, fill: PAPER, anchor: 'end', font: MONO, op: 0.75 });
  return g + '</g>';
}

/* ---------- caption.pullQuote ---------- */
function pullQuote(L, p, c) {
  const S = SZ(c, p), qs = 66 * S, maxW = Math.min(c.W * 0.8, (c.safe.x1 - c.safe.x0) - 120 * S), lines = wrapWords(str(p.quote), qs, 800, maxW).slice(0, 6), lh = qs * 1.16, as = 30 * S;
  const w = Math.min(maxW, Math.max(...lines.map((l) => l.join(' ').length * qs * 0.54), 200 * S)) + 120 * S, h = lines.length * lh + as + 130 * S, [x, y] = anchor(p.pos, c, w, h), k = clamp(L.in * 1.5) * (1 - E.exit(L.out));
  let g = `<g opacity="${op(k)}">` + rr(x, y, w, h, 26 * S, p.bg || 'rgba(14,14,20,0.82)');
  g += text('“', x + 36 * S, y + 120 * S, { size: 160 * S, weight: 800, fill: p.accent });
  lines.forEach((ln, i) => { const kk = E.enter(seg(L.u, 0.12 + i * 0.12, 0.42 + i * 0.12)), id = `pq${i}`;
    g += `<g opacity="${op(kk)}" transform="translate(0 ${f2((1 - kk) * 20 * S)})">` + text(ln.join(' '), x + 90 * S, y + 60 * S + (i + 1) * lh - qs * 0.2, { size: qs, weight: 800, fill: PAPER }) + '</g>'; });
  const att = str(p.speaker) ? '— ' + str(p.speaker) + (p.ownWords === false ? '' : ', in their own words') : '';
  if (att) g += text(att, x + 90 * S, y + 80 * S + lines.length * lh + as * 0.6, { size: as, weight: 600, fill: PAPER, font: MONO, op: seg(L.u, 0.5, 0.8) * 0.85 });
  return g + '</g>';
}

/* ---------- ui.quizCard ---------- */
function quizCard(L, p, c) {
  const S = SZ(c, p), opts = list(p.options, 6).map(str), ans = Math.round(+p.answer || 0), rv = +p.revealAt || 2, qsz = 54 * S, os = 40 * S;
  const maxW = Math.min(c.W * 0.82, 1500 * S), ql = wrapWords(str(p.q), qsz, 800, maxW - 120 * S).slice(0, 3), oh = 86 * S, w = maxW, h = 90 * S + ql.length * qsz * 1.2 + opts.length * (oh + 18 * S) + 60 * S;
  const [x, y] = anchor(p.pos, c, w, h), k = E.enter(L.in) * (1 - E.exit(L.out)), rk = E.enter(seg(L.u, rv, rv + 0.35));
  let g = `<g opacity="${op(k)}" transform="translate(0 ${f2((1 - E.enter(L.in)) * 26 * S)})">` + rr(x, y, w, h, 28 * S, '#FBFAF7');
  g += text(str(p.kicker || 'QUICK CHECK').toUpperCase(), x + 56 * S, y + 64 * S, { size: 26 * S, weight: 700, fill: p.accent, font: MONO, ls: 2 * S });
  /* the pause ring: empties until the reveal (no digits) */
  const rc = [x + w - 70 * S, y + 56 * S], R = 24 * S, per = TAU * R, left = 1 - seg(L.u, 0.4, rv);
  if (L.u < rv + 0.2) g += `<circle cx="${f2(rc[0])}" cy="${f2(rc[1])}" r="${f2(R)}" fill="none" stroke="#E2DED5" stroke-width="${f2(7 * S)}"/><circle cx="${f2(rc[0])}" cy="${f2(rc[1])}" r="${f2(R)}" fill="none" stroke="${p.accent}" stroke-width="${f2(7 * S)}" transform="rotate(-90 ${f2(rc[0])} ${f2(rc[1])})" ${dash(per, left)}/>`;
  ql.forEach((l, i) => { g += text(l.join(' '), x + 56 * S, y + 90 * S + (i + 1) * qsz * 1.2 - qsz * 0.15, { size: qsz, weight: 800, fill: INK }); });
  const oy0 = y + 90 * S + ql.length * qsz * 1.2 + 40 * S;
  opts.forEach((o, i) => { const kk = E.enter(seg(L.u, 0.25 + i * 0.12, 0.55 + i * 0.12)), oy = oy0 + i * (oh + 18 * S), right = i === ans, fill = rk > 0.01 ? (right ? lerp(0, 1, rk) : 0) : 0;
    const col = right && rk > 0.5 ? '#0F7A45' : '#FFFFFF', dim = !right ? lerp(1, 0.45, rk) : 1;
    g += `<g opacity="${op(kk * dim)}" transform="translate(${f2((1 - kk) * 40 * S)} 0)">` + rr(x + 56 * S, oy, w - 112 * S, oh, 18 * S, col, `stroke="${right && rk > 0.5 ? '#0F7A45' : '#D8D3C8'}" stroke-width="${f2(3 * S)}"`);
    g += text(String.fromCharCode(65 + i), x + 100 * S, oy + oh / 2 + os * 0.36, { size: os, weight: 800, fill: right && rk > 0.5 ? PAPER : p.accent, anchor: 'middle' });
    g += text(o, x + 150 * S, oy + oh / 2 + os * 0.36, { size: os, weight: 700, fill: right && rk > 0.5 ? PAPER : INK });
    if (right && fill > 0.01) g += `<path d="M${f2(x + w - 130 * S)} ${f2(oy + oh / 2)} l${f2(18 * S)} ${f2(18 * S)} l${f2(34 * S)} ${f2(-36 * S)}" fill="none" stroke="${PAPER}" stroke-width="${f2(8 * S)}" stroke-linecap="round" stroke-linejoin="round" ${dash(80 * S, fill)}/>`;
    g += '</g>'; });
  return g + '</g>';
}

/* ---------- title.recapCard ---------- */
function recapCard(L, p, c) {
  const S = SZ(c, p), items = list(p.items, 8).map(str), ts = 60 * S, is = 42 * S, maxW = Math.min(c.W * 0.8, 1400 * S), w = maxW, ih = is * 1.9, h = 120 * S + ts + items.length * ih + 40 * S;
  const [x, y] = anchor(p.pos, c, w, h), k = E.enter(L.in) * (1 - E.exit(L.out)), st = Math.max(0.05, +p.stagger || 0.4);
  let g = `<g opacity="${op(k)}">` + rr(x, y, w, h, 28 * S, p.bg || '#FBFAF7') + text(str(p.title), x + 60 * S, y + 60 * S + ts * 0.8, { size: ts, weight: 800, fill: INK });
  items.forEach((it, i) => { const t0 = 0.35 + i * st, kk = E.enter(seg(L.u, t0, t0 + 0.3)), tk = seg(L.u, t0 + 0.15, t0 + 0.45), iy = y + 100 * S + ts + i * ih;
    g += `<g opacity="${op(kk)}" transform="translate(${f2((1 - kk) * 30 * S)} 0)"><circle cx="${f2(x + 84 * S)}" cy="${f2(iy + ih / 2 - 6 * S)}" r="${f2(24 * S)}" fill="${tk > 0.5 ? p.accent : 'none'}" stroke="${p.accent}" stroke-width="${f2(4 * S)}"/>`;
    g += `<path d="M${f2(x + 72 * S)} ${f2(iy + ih / 2 - 6 * S)} l${f2(9 * S)} ${f2(9 * S)} l${f2(16 * S)} ${f2(-18 * S)}" fill="none" stroke="${PAPER}" stroke-width="${f2(5 * S)}" stroke-linecap="round" stroke-linejoin="round" ${dash(40 * S, tk)}/>`;
    g += text(it, x + 132 * S, iy + ih / 2 + is * 0.3, { size: is, weight: 700, fill: INK }) + '</g>'; });
  return g + '</g>';
}

/* ---------- title.hookCard: visible on frame 0 (in 1 frame), already moving ---------- */
function hookCard(L, p, c) {
  const S = SZ(c, p), hs = 76 * S, maxW = Math.min(c.W * 0.86, (c.safe.x1 - c.safe.x0) - 40 * S), lines = wrapWords(str(p.line), hs, 800, maxW - 80 * S).slice(0, 3), lh = hs * 1.1, ks = 28 * S, kick = str(p.kicker);
  const w = Math.min(maxW, Math.max(...lines.map((l) => l.join(' ').length * hs * 0.55), 300 * S) + 90 * S), h = lines.length * lh + (kick ? ks + 26 * S : 0) + 70 * S, [x, y] = anchor(p.pos, c, w, h);
  const settle = 1 + 0.06 * (1 - E.enter(seg(L.u, 0, 0.6))), out = E.exit(L.out), cx = x + w / 2, cy = y + h / 2;
  let g = `<g opacity="${op(1 - out)}" transform="translate(${f2(cx)} ${f2(cy - out * 40 * S)}) scale(${settle.toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})">` + rr(x, y, w, h, 24 * S, p.bg || PAPER);
  if (kick) g += text(kick.toUpperCase(), x + 44 * S, y + 34 * S + ks * 0.8, { size: ks, weight: 700, fill: p.accent, font: MONO, ls: 2 * S });
  lines.forEach((l, i) => { g += text(l.join(' '), x + 44 * S, y + 34 * S + (kick ? ks + 26 * S : 0) + (i + 1) * lh - hs * 0.2, { size: hs, weight: 800, fill: p.bg ? inkOn(p.bg) : INK }); });
  g += rr(x + 44 * S, y + h - 22 * S, (w - 88 * S) * E.enter(seg(L.u, 0, 1.2)), 8 * S, 4 * S, p.accent);
  return g + '</g>';
}

/* ---------- title.endScreen ---------- */
function endScreen(L, p, c) {
  const S = SZ(c, p), slots = list(p.slots, 4), tall = c.H > c.W, k = E.enter(L.in) * (1 - E.exit(L.out)), ts = 64 * S, R = c.safe;
  let g = `<g opacity="${op(k)}">` + `<rect width="${c.W}" height="${c.H}" fill="${p.bg}"/>`;
  g += text(str(p.title), (R.x0 + R.x1) / 2, R.y0 + 40 * S + ts, { size: ts, weight: 800, fill: inkOn(p.bg), anchor: 'middle' });
  const sw = tall ? (R.x1 - R.x0) * 0.86 : (R.x1 - R.x0) * 0.36, sh = sw * 9 / 16, gap = 50 * S, n = Math.max(1, slots.length);
  const totalW = tall ? sw : n * sw + (n - 1) * gap, totalH = tall ? n * sh + (n - 1) * gap : sh, x0 = (R.x0 + R.x1 - totalW) / 2, y0 = R.y0 + ts + 120 * S + (tall ? 0 : ((R.y1 - R.y0) - ts - 120 * S - sh - 200 * S) / 2);
  slots.forEach((s, i) => { const kk = E.enter(seg(L.u, 0.2 + i * 0.15, 0.55 + i * 0.15)), sx = tall ? x0 : x0 + i * (sw + gap), sy = tall ? y0 + i * (sh + gap) : y0, ink = inkOn(p.bg);
    g += `<g opacity="${op(kk)}" transform="translate(0 ${f2((1 - kk) * 30 * S)})">` + rr(sx, sy, sw, sh, 20 * S, ink === INK ? 'rgba(14,14,20,0.06)' : 'rgba(255,255,255,0.08)', `stroke="${ink}" stroke-opacity="0.5" stroke-width="${f2(3 * S)}" stroke-dasharray="${f2(14 * S)} ${f2(10 * S)}"`);
    const cx = sx + sw / 2, cy = sy + sh / 2 - 24 * S;
    if ((s.kind || 'video') === 'playlist') for (let j = 0; j < 3; j++) g += rr(cx - 60 * S, cy - 40 * S + j * 30 * S, 120 * S, 16 * S, 8 * S, p.accent);
    else g += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(46 * S)}" fill="${p.accent}"/><path d="M${f2(cx - 14 * S)} ${f2(cy - 22 * S)} L${f2(cx + 24 * S)} ${f2(cy)} L${f2(cx - 14 * S)} ${f2(cy + 22 * S)} Z" fill="${inkOn(p.accent)}"/>`;
    g += text(str(s.label || 'Next video'), cx, sy + sh - 74 * S, { size: 38 * S, weight: 800, fill: ink, anchor: 'middle' });
    g += text(str(p.slotNote), cx, sy + sh - 34 * S, { size: 22 * S, weight: 600, fill: ink, anchor: 'middle', font: MONO, op: 0.7 }) + '</g>'; });
  if (str(p.subscribe)) { const ss = 36 * S, sw2 = str(p.subscribe).length * ss * 0.6 + 80 * S, sh2 = 76 * S, sx = (R.x0 + R.x1 - sw2) / 2, sy = (tall ? y0 + totalH + 60 * S : y0 + totalH + 70 * S), kk = E.pop(seg(L.u, 0.6, 0.95));
    g += `<g opacity="${op(kk)}">` + rr(sx, sy, sw2, sh2, sh2 / 2, p.accent) + text(str(p.subscribe), sx + sw2 / 2, sy + sh2 / 2 + ss * 0.36, { size: ss, weight: 800, fill: inkOn(p.accent), anchor: 'middle' });
    if (str(p.handle)) g += text(str(p.handle), sx + sw2 / 2, sy + sh2 + 50 * S, { size: 30 * S, weight: 600, fill: inkOn(p.bg), anchor: 'middle', font: MONO, op: 0.8 }); g += '</g>'; }
  return g + '</g>';
}

/* ---------- callout.resultReveal ---------- */
function resultReveal(L, p, c) {
  const S = SZ(c, p), [x, y, w, h] = BOX(c, p.box, [0.1, 0.1, 0.8, 0.8]), sw = Math.max(0.1, +p.sweep || 0.6), k = 1 - E.exit(L.out), sx = x + w * E.move(seg(L.u, 0, sw));
  let g = `<g opacity="${op(k)}">`;
  if (L.u < sw + 0.05) g += `<rect x="${f2(sx - 3 * S)}" y="${f2(y)}" width="${f2(6 * S)}" height="${f2(h)}" fill="${p.color}"/><rect x="${f2(sx - 40 * S)}" y="${f2(y)}" width="${f2(40 * S)}" height="${f2(h)}" fill="${p.color}" opacity="0.18"/>`;
  const pk = E.pop(seg(L.u, sw - 0.05, sw + 0.3)), lab = str(p.label || 'RESULT').toUpperCase(), ls = 34 * S, lw = lab.length * ls * 0.64 + 56 * S, lh = ls + 30 * S;
  g += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="none" stroke="${p.color}" stroke-width="${f2(6 * S)}" opacity="${f2(clamp(pk))}"/>`;
  g += `<g transform="translate(${f2(x + 24 * S)} ${f2(y + 24 * S)}) scale(${Math.max(0.001, pk).toFixed(4)})">` + rr(0, 0, lw, lh, lh / 2, p.color) + text(lab, lw / 2, lh / 2 + ls * 0.36, { size: ls, weight: 800, fill: inkOn(p.color), anchor: 'middle', font: MONO, ls: 2 * S }) + '</g>';
  return g + '</g>';
}

export const HUMAN = {
  'ui.keyCombo': { file: 'type/gfx/human.js', tags: ['tutorial', 'keyboard', 'shortcut', 'overlay', 'screen-recording'], dur: 1.8, inF: 6, outF: 8, d: { keys: ['Ctrl', 'Shift', 'P'], label: 'Open the command palette', pos: 'bc', pressAt: 0.15, stagger: 0.16, releaseAt: 1.2, accent: BRAND, size: 1 }, svg: keyCombo },
  'callout.highlightBox': { file: 'type/gfx/human.js', tags: ['tutorial', 'highlight', 'box', 'callout', 'screen-recording'], dur: 2, inF: 14, outF: 8, d: { box: [0.36, 0.38, 0.28, 0.16], pad: 0.006, radius: 0.012, color: '#FFD400', width: 6, label: '', labelPos: 'top', fill: true, size: 1 }, svg: highlightBox },
  'ui.codeCallout': { file: 'type/gfx/human.js', tags: ['tutorial', 'code', 'line-highlight', 'developer', 'course'], dur: 4, inF: 10, outF: 8,
    d: { title: 'example.js · placeholder code', lines: ['// example code: replace with yours', "import { theme } from './theme';", '', 'export function toggle(state) {', "  const next = state === 'dark' ? 'light' : 'dark';", '  theme.set(next);', '  return next;', '}'], highlight: [{ from: 4, to: 7, at: 0.6 }, { from: 5, to: 5, at: 1.8 }], box: [0.1, 0.14, 0.8, 0.72], numbers: true, theme: 'dark', accent: BRAND, size: 1 }, svg: codeCallout },
  'ui.stepCounter': { file: 'type/gfx/human.js', tags: ['tutorial', 'steps', 'progress', 'pill', 'course'], dur: 10, inF: 8, outF: 8, d: { step: 1, total: 3, label: 'Step', title: '', steps: [], pos: 'tl', accent: BRAND, size: 1 }, svg: stepCounter },
  'ui.cursorTrack': { file: 'type/gfx/human.js', tags: ['tutorial', 'cursor', 'click', 'screen-recording', 'pointer'], dur: 4, inF: 3, outF: 6, d: { track: [[0, 0.3, 0.6], [0.8, 0.52, 0.44, 1], [1.8, 0.66, 0.6], [2.4, 0.7, 0.62, 1]], color: '#FFFFFF', ripple: '#FFD400', scale: 1.6, size: 1 }, svg: cursorTrack },
  'ui.waveform': { file: 'type/gfx/human.js', tags: ['podcast', 'waveform', 'audio', 'visualiser', 'clip'], dur: 6, inF: 6, outF: 6, d: { env: [], fps: 30, box: [0.1, 0.44, 0.8, 0.12], bars: 48, window: 1.6, offset: 0, color: '#FFFFFF', accent: BRAND, mirror: true }, svg: waveform },
  'title.locationCard': { file: 'type/gfx/human.js', tags: ['vlog', 'location', 'date', 'travel', 'card'], dur: 2.6, inF: 16, outF: 10, d: { place: 'Placeholder Street', date: 'Day one', kicker: '', pos: 'tl', accent: '#FF4F7B', size: 1 }, svg: locationCard },
  'title.yearTimeline': { file: 'type/gfx/human.js', tags: ['founder', 'timeline', 'years', 'story', 'personal-brand'], dur: 4, inF: 12, outF: 10,
    d: { years: [{ y: '2019', label: 'first idea' }, { y: '2021', label: 'first users' }, { y: '2024', label: 'today' }], steps: [0, 1.2, 2.4], note: 'example years · placeholder data', box: null, accent: BRAND, size: 1 }, svg: yearTimeline },
  'caption.pullQuote': { file: 'type/gfx/human.js', tags: ['quote', 'pull-out', 'founder', 'interview', 'own-words'], dur: 3.2, inF: 8, outF: 10, d: { quote: 'Placeholder quote: the speaker’s own words go here', speaker: 'Speaker name', ownWords: true, pos: 'c', accent: BRAND, bg: '', size: 1 }, svg: pullQuote },
  'ui.quizCard': { file: 'type/gfx/human.js', tags: ['course', 'quiz', 'question', 'lesson', 'check'], dur: 4.2, inF: 10, outF: 10, d: { kicker: 'Quick check', q: 'Placeholder question: which option is right?', options: ['Option A text', 'Option B text', 'Option C text'], answer: 1, revealAt: 2.4, pos: 'c', accent: BRAND, size: 1 }, svg: quizCard },
  'title.recapCard': { file: 'type/gfx/human.js', tags: ['course', 'recap', 'summary', 'checklist', 'lesson'], dur: 3.6, inF: 10, outF: 10, d: { title: 'Recap', items: ['First takeaway', 'Second takeaway', 'Third takeaway'], stagger: 0.4, pos: 'c', accent: BRAND, bg: '', size: 1 }, svg: recapCard },
  'title.hookCard': { file: 'type/gfx/human.js', tags: ['hook', 'title', 'frame-0', 'podcast', 'shorts'], dur: 2.6, inF: 1, outF: 9, d: { line: 'Placeholder hook line', kicker: '', pos: 'tc', accent: BRAND, bg: '', size: 1 }, svg: hookCard },
  'title.endScreen': { file: 'type/gfx/human.js', tags: ['end-screen', 'next-video', 'subscribe', 'youtube', 'tutorial'], dur: 5, inF: 12, outF: 6,
    d: { title: 'Watch next', slots: [{ label: 'Next video', kind: 'video' }, { label: 'Playlist', kind: 'playlist' }], slotNote: 'slot: add the platform end-screen element here', subscribe: 'Subscribe', handle: '@yourchannel', bg: '#0E0E14', accent: BRAND, size: 1 }, svg: endScreen },
  'callout.resultReveal': { file: 'type/gfx/human.js', tags: ['tutorial', 'result', 'reveal', 'before-after', 'sweep'], dur: 2.4, inF: 1, outF: 10, d: { box: [0.1, 0.1, 0.8, 0.8], sweep: 0.6, label: 'Result', color: '#FFD400', size: 1 }, svg: resultReveal },
};
/* one cue per action (absolute times added by gfxCues): [{ t (local s), id, why }] */
export const HUMAN_CUES = {
  'ui.keyCombo': (p) => list(p.keys, 8).map((k, i) => ({ t: +((+p.pressAt || 0.15) + i * (+p.stagger || 0.16)).toFixed(4), id: i % 2 ? 'sfx/device/keyboard_mech_soft' : 'sfx/device/keyboard_mech_clack', why: 'key ' + str(k) })),
  'callout.highlightBox': () => [{ t: 0, id: 'sfx/ui/slide', why: 'highlight box draws on' }],
  'ui.codeCallout': (p) => [{ t: 0, id: 'sfx/whoosh/swish_xs', why: 'code panel in' }, ...list(p.highlight, 24).map((r) => ({ t: +(+r.at || 0).toFixed(4), id: 'sfx/ui/tick', why: 'lines ' + r.from + '-' + (r.to ?? r.from) })) ],
  'ui.stepCounter': (p) => list(p.steps, 40).filter((s, i) => i > 0 || +s[0] > 0).map((s) => ({ t: +(+s[0] || 0).toFixed(4), id: 'sfx/ui/count_tick', why: 'step ' + s[1] })),
  'ui.cursorTrack': (p) => list(p.track, 4096).filter((q) => q[3]).map((q) => ({ t: +(+q[0]).toFixed(4), id: 'sfx/device/mouse_click', why: 'click' })),
  'title.locationCard': () => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'location card wipes in' }],
  'title.yearTimeline': (p) => list(p.steps, 12).map((t, i) => ({ t: +(+t || 0).toFixed(4), id: i ? 'sfx/ui/tick' : 'sfx/ui/slide', why: 'year ' + (i + 1) })),
  'caption.pullQuote': () => [{ t: 0.1, id: 'sfx/paper/flip', why: 'quote pull-out' }],
  'ui.quizCard': (p) => [{ t: 0, id: 'sfx/ui/pop', why: 'quiz card' }, { t: +(+p.revealAt || 2).toFixed(4), id: 'sfx/ui/success', why: 'answer revealed' }],
  'title.recapCard': (p) => list(p.items, 8).map((_, i) => ({ t: +(0.5 + i * Math.max(0.05, +p.stagger || 0.4)).toFixed(4), id: 'sfx/ui/pop', why: 'recap item ' + (i + 1) })),
  'title.hookCard': () => [{ t: 0, id: 'sfx/hit/soft', why: 'hook card on frame 0' }],
  'title.endScreen': () => [{ t: 0, id: 'sfx/whoosh/whoosh_in_m', why: 'end screen' }],
  'callout.resultReveal': (p) => [{ t: 0, id: 'sfx/tx/mask_reveal', why: 'result sweep' }, { t: +Math.max(0.1, +p.sweep || 0.6).toFixed(4), id: 'sfx/sparkle/shimmer', why: 'result tab' }],
};
export const HUMAN_IDS = Object.keys(HUMAN);
export const HUMAN_LIM = { 'ui.waveform': { bars: [4, 160], window: [0.2, 20], fps: [1, 120] }, 'ui.stepCounter': { total: [1, 99], step: [0, 99] }, 'ui.cursorTrack': { scale: [0.1, 8] }, 'ui.quizCard': { revealAt: [0, 60], answer: [0, 5] }, 'title.recapCard': { stagger: [0.05, 5] }, 'callout.resultReveal': { sweep: [0.1, 10] }, 'ui.keyCombo': { stagger: [0, 2], pressAt: [0, 10], releaseAt: [0, 30] } };
