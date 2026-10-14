/* motion-pack / type / gfx / r45-type.js: round 4/5 lockups and layout type (2026-10-14). Same contract as every gfx item (core.js): { tags, dur, inF, outF, d, svg(L, p, c) }
   -> SVG markup, a pure function of t (seek-safe). Positions are frame fractions, sizes px @1080 (scaled by c.s).
     title.partnerLockup    "A x B": two marks balanced for optical weight (equal ink area, or matched height), a divider (x, +, rule), equal gaps; enters as
                            one unit and holds on a quiet tail. Ships with owned placeholder marks only; a supplied mark without licensed: true is refused
                            (drawn as a dashed "unlicensed mark" box) and lintPartnerMarks() says why.
     layout.iconMergeLockup outlined icon tiles draw on down a diagonal staircase, fill outline -> solid on planned hits, line up in a row, then collapse into
                            one product name (each icon flies into its letter position as the name types)
     type.flankWords        a short phrase splits left and right of a subject box (static or keyframed): the words ride the box edges, so they never cover
                            it; flankShots() carries one sentence across several shots in the same style
     type.behindSubject     giant type placed behind a subject using a SUPPLIED alpha matte (image, frame sequence or inline SVG): plate -> type -> plate
                            masked by the matte. No segmentation model, no downloads; without a plate it uses an owned procedural figure.
   Craft learned from public launch films (round 4/5 study, October 2026): techniques only, never a brand, logo, footage, wording or sequence. Owned code. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, INK, PAPER, f2, esc, text, measure, hashf, uidOf, blurDef, blurAttr } from './core.js';
import { stepAt, mixHex } from './swap.js';

const op = (L) => clamp(L.in * 1.5) * (1 - L.out);
const FR = 30, frameOf = (u) => Math.floor(u * FR + 1e-6);

/* ---------------- partnerLockup ---------------- */
/* owned placeholder marks: box w x h (h = 100) and the EXACT ink area of the shape (for optical balancing) */
const rr = (x, y, w, h, r) => ({ svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`, area: w * h - (4 - Math.PI) * r * r });
const bars = [rr(0, 22, 40, 56, 12), rr(52, 8, 22, 84, 11), rr(86, 22, 52, 56, 12), rr(150, 36, 40, 42, 12), rr(202, 22, 98, 56, 14)];
export const PARTNER_MARKS = {
  ring: { w: 100, h: 100, svg: '<path fill-rule="evenodd" d="M50 4 A46 46 0 1 1 49.99 4 Z M50 26 A24 24 0 1 0 50.01 26 Z"/>', area: Math.PI * (46 * 46 - 24 * 24), placeholder: true },
  bars: { w: 300, h: 100, svg: bars.map((b) => b.svg).join(''), area: bars.reduce((a, b) => a + b.area, 0), placeholder: true },
  tri: { w: 110, h: 100, svg: '<path d="M55 4 L106 96 H4 Z"/>', area: 0.5 * 102 * 92, placeholder: true },
  pill: { w: 220, h: 100, svg: '<rect x="4" y="22" width="212" height="56" rx="28"/>', area: 212 * 56 - (4 - Math.PI) * 28 * 28, placeholder: true },
};
const markOf = (m) => (typeof m === 'string' ? { ...PARTNER_MARKS[m] || PARTNER_MARKS.ring, name: m } : m || PARTNER_MARKS.ring);
/* problems with the marks: a supplied asset needs licensed: true (you hold the right to use it in this video) and its ink fraction `area` */
export function lintPartnerMarks(p) {
  const out = []; (p.marks || []).forEach((m0, i) => { const m = markOf(m0); if (m.placeholder) return;
    if (m.licensed !== true) out.push(`mark ${i + 1}: refused, no licensed: true flag (supply only marks you have the right to use)`);
    if (!(m.area > 0) && !(m.ink > 0)) out.push(`mark ${i + 1}: no ink fraction (ink: 0..1 of its box); balanced as 0.5`); }); return out;
}
/* layout at full entrance: per mark { x, y, w, h, ink (px^2) }, the divider centre, and the unit's box. Pure. */
export function partnerLockupLayout(p, c) {
  const S = c.s, stack = p.layout === 'stack' || (p.layout === 'auto' && c.tall), M = p.marks.map(markOf), gap = p.gap * p.size * S;
  const frac = (m) => (m.placeholder || (m.licensed === true && m.area > 0) ? m.area / (m.w * m.h) : m.ink > 0 ? m.ink : 0.5), asp = (m) => m.w / m.h;
  const T = (p.size * S) ** 2 * 0.42; let hs = M.map((m, i) => (p.balance === 'height' ? p.size * S * 0.8 : Math.sqrt(T / (frac(m) * asp(m) * (p.weights?.[i] ?? 1)))));
  const dv = p.divider === 'rule' ? 2 * S : p.dividerSize * p.size * S, ws = M.map((m, i) => hs[i] * asp(m)), maxW = (c.safe.x1 - c.safe.x0) * 0.9, maxH = (c.safe.y1 - c.safe.y0) * 0.8;
  const span = stack ? hs[0] + hs[1] + 2 * gap + dv : ws[0] + ws[1] + 2 * gap + dv, lim = stack ? Math.min(maxH / span, maxW / Math.max(...ws)) : maxW / span, k = Math.min(1, lim);
  hs = hs.map((h) => h * k); const W2 = ws.map((w) => w * k), G = gap * k, D = dv * (p.divider === 'rule' ? 1 : k), cx = p.at[0] * c.W, cy = p.at[1] * c.H;
  let boxes;
  if (stack) { const tot = hs[0] + hs[1] + 2 * G + D, y0 = cy - tot / 2; boxes = [{ x: cx - W2[0] / 2, y: y0, w: W2[0], h: hs[0] }, { x: cx - W2[1] / 2, y: y0 + hs[0] + 2 * G + D, w: W2[1], h: hs[1] }]; }
  else { const tot = W2[0] + W2[1] + 2 * G + D, x0 = cx - tot / 2; boxes = [{ x: x0, y: cy - hs[0] / 2, w: W2[0], h: hs[0] }, { x: x0 + W2[0] + 2 * G + D, y: cy - hs[1] / 2, w: W2[1], h: hs[1] }]; }
  boxes.forEach((b, i) => { b.ink = frac(M[i]) * b.w * b.h; b.mark = M[i]; });
  const dc = stack ? [cx, boxes[0].y + boxes[0].h + G + D / 2] : [boxes[0].x + boxes[0].w + G + D / 2, cy];
  return { stack, boxes, divider: { x: dc[0], y: dc[1], size: D }, gap: G };
}
function drawMark(b, color, font, s, id) {
  const m = b.mark, licensed = m.placeholder || m.licensed === true;
  if (!licensed) return `<rect x="${f2(b.x)}" y="${f2(b.y)}" width="${f2(b.w)}" height="${f2(b.h)}" fill="none" stroke="#9A9AA4" stroke-width="${f2(2 * s)}" stroke-dasharray="${f2(8 * s)} ${f2(6 * s)}"/>` +
    text('unlicensed mark', b.x + b.w / 2, b.y + b.h / 2 + 8 * s, { size: 22 * s, weight: 700, fill: '#9A9AA4', anchor: 'middle', font: MONO });
  if (m.href) return `<image href="${esc(m.href)}" x="${f2(b.x)}" y="${f2(b.y)}" width="${f2(b.w)}" height="${f2(b.h)}" preserveAspectRatio="xMidYMid meet"/>`;
  return `<svg x="${f2(b.x)}" y="${f2(b.y)}" width="${f2(b.w)}" height="${f2(b.h)}" viewBox="${m.viewBox || `0 0 ${m.w} ${m.h}`}" fill="${color}">${String(m.svg).replaceAll('currentColor', color)}</svg>`;
}

/* ---------------- iconMergeLockup ---------------- */
/* owned generic icons (100 box): an outline silhouette `d` (filled solid on its hit) + optional inner strokes */
export const MERGE_ICONS = {
  play: { d: 'M34 24 Q34 16 41 20 L76 44 Q82 50 76 56 L41 80 Q34 84 34 76 Z' },
  bolt: { d: 'M56 10 L26 56 H48 L42 90 L74 42 H52 Z' },
  chat: { d: 'M18 24 H82 Q88 24 88 30 V64 Q88 70 82 70 H46 L30 84 V70 H18 Q12 70 12 64 V30 Q12 24 18 24 Z', inner: 'M30 42 H70 M30 54 H58' },
  disc: { d: 'M50 12 A38 38 0 1 1 49.99 12 Z', inner: 'M50 50 L50 12 M50 50 L83 69' },
  cube: { d: 'M50 10 L86 30 V70 L50 90 L14 70 V30 Z', inner: 'M14 30 L50 50 L86 30 M50 50 V90' },
  note: { d: 'M30 14 H62 L76 28 V86 H30 Z', inner: 'M40 44 H66 M40 56 H66 M40 68 H56' },
};
/* tile states at local time u: [{ x, y, size, fill (0..1), frame (0..1 tile-frame opacity), draw (0..1), op }] + letters [{ ch, x, op }] */
export function iconMergeState(u, p, c) {
  const S = c.s, n = p.icons.length, T = p.tile * S, step = p.step * T, cx = p.at[0] * c.W, cy = p.at[1] * c.H, NS = p.nameSize * S;
  const chars = [...String(p.name)], adv = chars.map((ch) => measure(ch, NS, { weight: p.weight, font: p.font }) + p.ls * NS), tot = adv.reduce((a, b) => a + b, 0);
  let acc = cx - tot / 2; const lx = adv.map((w) => { const x = acc + w / 2; acc += w; return x; });
  const kl = E.move(seg(u, p.lineAt, p.lineAt + p.line)), km = p.mergeAt == null ? 0 : seg(u, p.mergeAt, p.mergeAt + p.merge), rowT = T * p.rowScale, rowGap = rowT * 0.35, rowW = n * rowT + (n - 1) * rowGap;
  const tiles = p.icons.map((_, i) => {
    const sx = cx + ((n - 1) / 2 - i) * step, sy = cy + (i - (n - 1) / 2) * step, rx = cx - rowW / 2 + rowT / 2 + i * (rowT + rowGap), ry = cy;
    const kd = E.soft(seg(u, p.drawAt + i * p.stagger, p.drawAt + i * p.stagger + p.draw)), hit = p.hits[i] ?? p.hits.at(-1), kf = E.soft(seg(u, hit, hit + p.fillF / FR)), pop = 1 + 0.07 * Math.sin(Math.PI * kf);
    const li = Math.min(chars.length - 1, Math.max(0, Math.round(((i + 0.5) * chars.length) / n - 0.5))), d = 0.07 * i, kk = E.cam(seg(km, d, d + 0.6 * (1 - 0.07 * (n - 1)) + 0.25));
    const x = lerp(lerp(sx, rx, kl), lx[li], kk), y = lerp(lerp(sy, ry, kl), cy, kk), size = lerp(lerp(T, rowT, kl), NS * 0.7, kk) * pop;
    return { x, y, size, fill: kf, frame: kd * (1 - kl), draw: kd, op: (1 - clamp(kk * 1.25 - 0.2)) * (kd > 0 ? 1 : 0), letter: li };
  });
  const letters = chars.map((ch, j) => { const tj = p.mergeAt == null ? 1e9 : p.mergeAt + p.merge * (0.35 + (0.55 * j) / Math.max(1, chars.length - 1)); return { ch, x: lx[j], op: E.soft(seg(u, tj, tj + 0.18)) }; });
  return { tiles, letters, base: cy + NS * 0.35, NS };
}

/* ---------------- flankWords ---------------- */
/* the subject box at local time u (px): static box growing in from its centre over [arriveAt, arriveAt + arrive], or keyframes [[t, [x, y, w, h]], ...] (fractions) */
export function flankBox(u, p, c) {
  const sb = p.subject || {}; let b, e = 1;
  if (sb.keys && sb.keys.length) { const K = sb.keys; let j = 0; while (j < K.length - 1 && u >= K[j + 1][0]) j++; const a = K[j], z = K[Math.min(K.length - 1, j + 1)], k = z === a ? 1 : E.move(seg(u, a[0], z[0]));
    b = a[1].map((v, i) => lerp(v, z[1][i], k)); }
  else { b = sb.box || [0.4, 0.22, 0.2, 0.56]; e = sb.arriveAt == null ? 1 : E.hero(seg(u, sb.arriveAt, sb.arriveAt + (sb.arrive ?? 0.6))); }
  const [x, y, w, h] = [b[0] * c.W, b[1] * c.H, b[2] * c.W, b[3] * c.H], we = w * e; return { x: x + (w - we) / 2, y, w: we, h, e };
}
/* words of shot `shot` of a sentence split by ranges: [{ words, split }] params for each shot, same style token */
export function flankShots(sentence, ranges, style = {}) { const ws = String(sentence).split(/\s+/); return ranges.map(([a, b], i) => ({ ...style, words: ws.slice(a, b), shot: i })); }
/* word boxes at u: [{ word, x, y, w, h, side }] (px). Pure. */
export function flankState(u, p, c) {
  const S = p.size * c.s, B = flankBox(u, p, c), m = p.margin * c.s, words = p.words, sp = Math.min(Math.max(1, p.split ?? Math.ceil(words.length / 2)), words.length), fo = { weight: p.weight, font: p.font, ls: p.ls * S };
  const yb = (p.row == null ? B.y + B.h / 2 : p.row * c.H) + S * 0.35, out = [], space = measure(' ', S, fo);
  let x = B.x - m; for (let i = sp - 1; i >= 0; i--) { const w = measure(words[i], S, fo); x -= w; out.unshift({ word: words[i], x, y: yb - S * 0.74, w, h: S * 0.96, side: 'left', i }); x -= space; }
  x = B.x + B.w + m; for (let i = sp; i < words.length; i++) { const w = measure(words[i], S, fo); out.push({ word: words[i], x, y: yb - S * 0.74, w, h: S * 0.96, side: 'right', i }); x += w + space; }
  return { box: B, words: out, base: yb };
}

/* ---------------- behindSubject ---------------- */
/* a source at local time u: { href } | { frames: 'dir/f_%04d.png', fps, count, first = 1, offset = 0 } | { svg, viewBox } -> markup filling the frame */
export function srcAt(src, u, c) {
  if (!src) return '';
  if (src.frames) { const n = Math.max(1, src.count || 1), i = Math.min(n - 1, Math.max(0, Math.floor((u + (src.offset || 0)) * (src.fps || FR) + 1e-6))), idx = i + (src.first ?? 1);
    const href = src.frames.replace(/%0(\d)d/, (_, k) => String(idx).padStart(+k, '0')).replace('%d', String(idx)); return `<image href="${esc(href)}" x="0" y="0" width="${c.W}" height="${c.H}" preserveAspectRatio="xMidYMid slice"/>`; }
  if (src.href) return `<image href="${esc(src.href)}" x="0" y="0" width="${c.W}" height="${c.H}" preserveAspectRatio="xMidYMid slice"/>`;
  if (src.svg) return `<svg x="0" y="0" width="${c.W}" height="${c.H}" viewBox="${src.viewBox || `0 0 ${c.W} ${c.H}`}" preserveAspectRatio="xMidYMid slice">${src.svg}</svg>`;
  return '';
}
/* owned procedural subject: a faceless figure (head, neck, shoulders) on a backdrop; its matte is the same figure in white. Pure function of u (slow sway). */
export function figurePlate(u, c, { bg = ['#3A322B', '#6B5A4A'], skin = ['#5A4638', '#17120F'], cloth = '#120F0E', rim = '#F2C79A', sway = 1 } = {}) {
  const s = c.s, x = c.W * 0.5 + Math.sin(TAU * 0.18 * u) * 6 * s * sway, hy = c.H * 0.37, hr = c.H * 0.17, id = 'fp' + c.W + 'x' + c.H;
  const fig = (fill1, fill2, fill3) => `<ellipse cx="${f2(x)}" cy="${f2(hy)}" rx="${f2(hr * 0.84)}" ry="${f2(hr)}" fill="${fill1}"/><rect x="${f2(x - hr * 0.32)}" y="${f2(hy + hr * 0.6)}" width="${f2(hr * 0.64)}" height="${f2(hr * 0.9)}" fill="${fill2}"/>` +
    `<path d="M${f2(x - hr * 2.6)} ${c.H} C${f2(x - hr * 2.4)} ${f2(c.H * 0.76)} ${f2(x - hr * 1.2)} ${f2(c.H * 0.68)} ${f2(x)} ${f2(c.H * 0.68)} C${f2(x + hr * 1.2)} ${f2(c.H * 0.68)} ${f2(x + hr * 2.4)} ${f2(c.H * 0.76)} ${f2(x + hr * 2.6)} ${c.H} Z" fill="${fill3}"/>`;
  return { defs: `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient><radialGradient id="${id}s" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${skin[0]}"/><stop offset="1" stop-color="${skin[1]}"/></radialGradient>`,
    plate: `<rect width="${c.W}" height="${c.H}" fill="url(#${id}b)"/>` + fig(`url(#${id}s)`, skin[1], cloth) +
      `<path d="M${f2(x - hr * 0.8)} ${f2(hy - hr * 0.35)} A${f2(hr * 0.84)} ${f2(hr)} 0 0 1 ${f2(x - hr * 0.1)} ${f2(hy - hr * 0.99)}" fill="none" stroke="${rim}" stroke-width="${f2(5 * s)}" stroke-linecap="round" opacity="0.7"/>`, matte: fig('#FFFFFF', '#FFFFFF', '#FFFFFF') };
}

export const TYPE_R45 = {
  'title.partnerLockup': { file: 'type/gfx/r45-type.js', tags: ['title', 'lockup', 'partner', 'co-brand', 'announcement', 'end-card', 'quiet-tail'], dur: 4.2, inF: 14, outF: 12,
    d: { marks: ['ring', 'bars'], labels: ['Brand A', 'Brand B'], balance: 'area', weights: [1, 1], divider: 'x', dividerSize: 0.26, size: 240, gap: 0.3, at: [0.5, 0.5], layout: 'auto',
      color: INK, divColor: '#8A8A94', labelColor: '#8A8A94', rise: 0.06, blur: 10, font: MONO },
    svg(L, p, c) {
      const s = c.s, lay = partnerLockupLayout(p, c), id = uidOf('partnerLockup', p), kin = E.hero(L.in), z = lerp(0.94, 1, kin), bl = (1 - kin) * p.blur * s, cx = p.at[0] * c.W, cy = p.at[1] * c.H;
      let out = lay.boxes.map((b) => drawMark(b, p.color, p.font, s, id)).join(''); const { x, y, size: D } = lay.divider, sw = Math.max(1.5 * s, D * 0.09);
      if (p.divider === 'rule') { const ln = lay.stack ? Math.max(...lay.boxes.map((b) => b.w)) * 0.5 : Math.max(...lay.boxes.map((b) => b.h)) * 1.05;
        out += lay.stack ? `<rect x="${f2(x - ln / 2)}" y="${f2(y - 1 * s)}" width="${f2(ln)}" height="${f2(2 * s)}" fill="${p.divColor}"/>` : `<rect x="${f2(x - 1 * s)}" y="${f2(y - ln / 2)}" width="${f2(2 * s)}" height="${f2(ln)}" fill="${p.divColor}"/>`; }
      else { const h = D / 2, d = p.divider === '+' ? `M${f2(x - h)} ${f2(y)} H${f2(x + h)} M${f2(x)} ${f2(y - h)} V${f2(y + h)}` : `M${f2(x - h)} ${f2(y - h)} L${f2(x + h)} ${f2(y + h)} M${f2(x + h)} ${f2(y - h)} L${f2(x - h)} ${f2(y + h)}`;
        out += `<path d="${d}" stroke="${p.divColor}" stroke-width="${f2(sw)}" stroke-linecap="round" fill="none"/>`; }
      const ly = lay.stack ? null : Math.max(...lay.boxes.map((b) => b.y + b.h)) + 46 * s;
      if (p.labels) lay.boxes.forEach((b, i) => { if (p.labels[i]) out += text(p.labels[i], b.x + b.w / 2, ly ?? b.y + b.h + 40 * s, { size: 22 * s, weight: 600, fill: p.labelColor, anchor: 'middle', font: p.font, ls: 2 * s }); });
      const dy = (1 - kin) * p.rise * c.H;
      return `<defs>${blurDef(id + 'b', bl)}</defs><g opacity="${f2(op(L))}"${blurAttr(id + 'b', bl)}><g transform="translate(${f2(cx)} ${f2(cy + dy)}) scale(${z.toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})">${out}</g></g>`; } },

  'layout.iconMergeLockup': { file: 'type/gfx/r45-type.js', tags: ['layout', 'icons', 'bundle', 'merge', 'draw-on', 'outline-fill', 'lockup', 'announcement'], dur: 4.4, inF: 1, outF: 10,
    d: { icons: ['play', 'bolt', 'chat', 'cube'], name: 'The Bundle', tile: 190, step: 0.62, rowScale: 0.55, at: [0.5, 0.5], drawAt: 0, draw: 0.6, stagger: 0.2, hits: [1.2, 1.45, 1.7, 1.95], fillF: 4,
      lineAt: 2.2, line: 0.45, mergeAt: 2.8, merge: 0.6, nameSize: 84, weight: 700, ls: -0.02, font: FONT, ink: INK, paper: '#FFFFFF', frameColor: 'rgba(14,14,20,0.55)' },
    svg(L, p, c) {
      const s = c.s, st = iconMergeState(L.u, p, c); let out = '';
      st.tiles.forEach((t, i) => { if (t.op <= 0.004) return; const ic = MERGE_ICONS[p.icons[i]] || (typeof p.icons[i] === 'object' ? p.icons[i] : MERGE_ICONS.play), sc = (t.size * 0.62) / 100, sw = (2.4 * s) / sc;
        let g = '';
        if (t.frame > 0.01) g += `<rect x="${f2(t.x - t.size / 2)}" y="${f2(t.y - t.size / 2)}" width="${f2(t.size)}" height="${f2(t.size)}" fill="none" stroke="${p.frameColor}" stroke-width="${f2(1.6 * s)}" opacity="${f2(t.frame)}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - t.draw))}"/>`;
        g += `<g transform="translate(${f2(t.x - t.size * 0.31)} ${f2(t.y - t.size * 0.31)}) scale(${sc.toFixed(4)})"><path d="${ic.d}" fill="${p.ink}" fill-opacity="${f2(t.fill)}" stroke="${p.ink}" stroke-width="${f2(sw)}" stroke-linejoin="round" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - t.draw))}"/>` +
          (ic.inner ? `<path d="${ic.inner}" fill="none" stroke="${mixHex(p.ink, p.paper, t.fill)}" stroke-width="${f2(sw)}" stroke-linecap="round" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - t.draw))}"/>` : '') + '</g>';
        out += `<g opacity="${f2(t.op)}">${g}</g>`; });
      for (const l of st.letters) if (l.op > 0.004) out += text(l.ch, l.x, st.base, { size: st.NS, weight: p.weight, fill: p.ink, anchor: 'middle', font: p.font, op: l.op });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.flankWords': { file: 'type/gfx/r45-type.js', tags: ['type', 'flank', 'product', 'negative-space', 'split', 'sentence-across-cuts', 'feature-super'], dur: 2.4, inF: 8, outF: 8,
    d: { words: ['All-day', 'comfort'], split: null, subject: { box: [0.41, 0.2, 0.18, 0.6], arriveAt: 0, arrive: 0.6 }, margin: 44, size: 92, weight: 700, ls: -0.02, font: FONT, color: INK, row: null,
      stagger: 0.06, rise: 0.25, drawSubject: false, subjectColor: '#E9E4DA', shot: 0 },
    svg(L, p, c) {
      const S = p.size * c.s, st = flankState(L.u, p, c), B = st.box, id = uidOf('flankWords', p); let out = '';
      if (p.drawSubject && B.w > 1) out += `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient></defs>` +
        `<ellipse cx="${f2(B.x + B.w / 2)}" cy="${f2(B.y + B.h + 12 * c.s)}" rx="${f2(B.w * 0.45)}" ry="${f2(10 * c.s)}" fill="#000" opacity="${f2(0.14 * B.e)}"/>` +
        `<rect x="${f2(B.x)}" y="${f2(B.y)}" width="${f2(B.w)}" height="${f2(B.h)}" rx="${f2(Math.min(B.w, B.h) / 2)}" fill="${p.subjectColor}"/><rect x="${f2(B.x)}" y="${f2(B.y)}" width="${f2(B.w)}" height="${f2(B.h)}" rx="${f2(Math.min(B.w, B.h) / 2)}" fill="url(#${id}g)"/>`;
      st.words.forEach((w, k) => { const ki = E.hero(seg(L.u, k * p.stagger, k * p.stagger + 0.45)); if (ki <= 0) return;
        out += text(w.word, w.x, st.base + (1 - ki) * p.rise * S, { size: S, weight: p.weight, fill: p.color, font: p.font, ls: p.ls * S, op: ki }); });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.behindSubject': { file: 'type/gfx/r45-type.js', tags: ['type', 'depth', 'matte', 'behind-subject', 'giant-type', 'marquee', 'label', 'occlusion'], dur: 3, inF: 4, outF: 8,
    d: { mode: 'label', steps: [[0, 'STILL'], [0.8, 'CLIP'], [1.6, 'SONG']], text: 'NEW NAME', sep: '  /  ', speed: 260, loop: null, size: 400, y: 0.56, weight: 800, ls: -0.04, font: FONT, color: '#FF6B4A',
      outline: false, plate: null, matte: null, matteMode: 'alpha', edge: 'soft', swap: 0.16 },
    svg(L, p, c) {
      const u = L.u, S = p.size * c.s, id = uidOf('behindSubject', p), fo = { weight: p.weight, font: p.font, ls: p.ls * S }, base = p.y * c.H + S * 0.36;
      const paint = (str, x, anchor = 'middle', o = 1) => text(str, x, base, { size: S, weight: p.weight, fill: p.outline ? 'none' : p.color, anchor, font: p.font, ls: p.ls * S, op: o, extra: p.outline ? `stroke="${p.color}" stroke-width="${f2(S * 0.012)}"` : '' });
      let type = '';
      if (p.mode === 'marquee') { const unit = p.text + p.sep, uw = measure(unit, S, fo), f = frameOf(u), Fp = p.loop ? Math.round(p.loop * FR) : 0, off = Fp ? ((f % Fp) / Fp) * uw : ((f * p.speed * c.s) / FR) % uw;
        for (let x = -off; x < c.W + uw; x += uw) type += paint(unit, x, 'start'); }
      else { const st = stepAt(p.steps, u, p.swap), k = E.hero(st.k); if (st.k < 1 && st.j > 0) type += `<g transform="translate(0 ${f2(-k * S * 0.18)})">${paint(st.prev, c.W / 2, 'middle', 1 - k)}</g>`;
        type += `<g transform="translate(0 ${f2((1 - k) * S * 0.18)})">${paint(st.cur, c.W / 2, 'middle', st.j > 0 ? k : 1)}</g>`; }
      const own = !p.plate && !p.matte, fp = own ? figurePlate(u, c) : null, plate = own ? fp.plate : srcAt(p.plate, u, c), matte = own ? fp.matte : srcAt(p.matte, u, c), inv = !own && !p.plate;
      const fn = (p.matteMode === 'luminance' ? '<feColorMatrix type="luminanceToAlpha"/>' : '') + (p.edge === 'hard' ? `<feComponentTransfer><feFuncA type="discrete" tableValues="${inv ? '1 0' : '0 1'}"/></feComponentTransfer>` : inv ? '<feComponentTransfer><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>' : '');
      const defs = `<defs>${fp ? fp.defs : ''}<filter id="${id}f" filterUnits="userSpaceOnUse" x="0" y="0" width="${c.W}" height="${c.H}" color-interpolation-filters="sRGB">${fn || '<feOffset/>'}</filter>` +
        `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${c.W}" height="${c.H}" style="mask-type:alpha"><g filter="url(#${id}f)">${matte}</g></mask></defs>`;
      const body = inv ? `<g mask="url(#${id}m)">${type}</g>` : `${plate}<g class="mp-type">${type}</g><g mask="url(#${id}m)">${plate}</g>`;
      return `${defs}<g opacity="${f2(op(L))}">${body}</g>`; } },
};
export const TYPE_R45_CUES = {
  'title.partnerLockup': () => [{ t: 0, id: 'sfx/hit/soft', why: 'lockup lands, then a quiet hold' }],
  'layout.iconMergeLockup': (p) => [{ t: p.drawAt, id: 'sfx/whoosh/swish_xs', why: 'outlines draw on' }, ...p.icons.map((_, i) => ({ t: p.hits[i] ?? p.hits.at(-1), id: 'sfx/hit/soft', why: `tile ${i + 1} fills` })),
    { t: p.lineAt, id: 'sfx/whoosh/swish_s', why: 'tiles line up' }, ...(p.mergeAt == null ? [] : [{ t: p.mergeAt, id: 'sfx/sparkle/letter_assemble', why: 'icons merge into the name' }])],
  'type.flankWords': (p) => [{ t: p.subject?.arriveAt ?? 0, id: 'sfx/whoosh/swish_s', why: 'words part around the subject' }],
  'type.behindSubject': (p) => (p.mode === 'marquee' ? [{ t: 0, id: 'sfx/whoosh/whoosh_in_m', why: 'marquee slides behind the subject' }] : p.steps.map(([t], i) => ({ t, id: i ? 'sfx/tx/cut_tick' : 'sfx/whoosh/whoosh_in_m', why: 'label ' + (i + 1) }))),
};
