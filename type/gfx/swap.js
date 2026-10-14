/* motion-pack / type / gfx / swap.js: round-3 type pieces (2026-10-14). Same contract as every gfx item (core.js): { tags, dur, inF, outF, d, svg(L, p, c) }
   -> SVG markup, a pure function of t (seek-safe). Positions are frame fractions, sizes px @1080 (scaled by c.s). Word widths come from measure().
     type.accentSwap      a fixed sentence whose accent word swaps in place (out up + blur, in from below), the line reflowing to the new width
     type.wordSplitMedia  one word splits open at a syllable, a media slot slides in between the halves, then it closes again
     type.imageFill       a heavy word used as a mask over a drifting photo mosaic (or one image / video poster you pass)
     type.strikeOut       words or placeholder marks struck through one by one (straight, hand-drawn or X), the struck item greys out
     type.glowWord        a word on a soft multicolour blurred halo that slowly breathes
     type.ledDigits       LED / pixel-cell numerals and short words with lit and unlit cells, a flicker-in and per-cell flips between values
   Craft learned from public launch and motion films (round-3 study, October 2026): techniques only, never a brand, footage, wording or sequence. Owned code. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, BRAND, INK, PAPER, f2, esc, text, measure, hashf, polylineLen, dash, uidOf, blurDef, blurAttr } from './core.js';
import { slotMedia, photoTile, placeholderLogo } from './media.js';
import { PIXEL5x7 } from './kinetic.js';

const op = (L) => clamp(L.in * 1.5) * (1 - L.out);
/* value timeline: steps = [[t, v], ...] (local s). Returns the current and previous value and the progress k (0..1) of the latest change. */
export function stepAt(steps, u, dur) {
  let cur = steps[0][1], prev = cur, k = 1, j = 0;
  for (let i = 1; i < steps.length; i++) if (u >= steps[i][0]) { prev = cur; cur = steps[i][1]; j = i; k = seg(u, steps[i][0], steps[i][0] + dur); }
  return { cur, prev, k, j };
}
const hex = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
export const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };

export const SWAP = {
  'type.accentSwap': { file: 'type/gfx/swap.js', tags: ['type', 'sentence', 'accent', 'swap', 'reflow', 'feature-list', 'hook'], dur: 3.2, inF: 10, outF: 8,
    d: { prefix: 'Make videos you can', words: ['design', 'edit', 'ship'], steps: [[0, 0], [1.0, 1], [2.0, 2]], suffix: '', swap: 0.34, size: 84, at: [0.5, 0.5], color: INK, accent: '#FF5A1F',
      italic: true, weight: 800, accentWeight: 800, font: FONT, ls: -0.02, blur: 9, rise: 0.42, align: 'center', stack: false, lineGap: 1.15, underline: false },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, id = uidOf('accentSwap', p), st = stepAt(p.steps, u, p.swap), k = E.move(st.k), ls = p.ls * S;
      const fw = { weight: p.weight, font: p.font, ls }, aw = { weight: p.accentWeight, font: p.font, ls }, wOf = (i) => measure(p.words[i] ?? '', S, aw) * (p.italic ? 1.03 : 1);
      const pw = measure(p.prefix, S, fw), sp = p.prefix ? measure(' ', S, fw) : 0, sw = p.suffix ? measure(p.suffix, S, fw) : 0, wcur = lerp(wOf(st.prev), wOf(st.cur), k);
      const rise = (1 - E.hero(L.in)) * S * 0.3, cx = p.at[0] * c.W, cy = p.at[1] * c.H + rise; let out = '', wx, wb, anc;
      if (p.stack) { out += text(p.prefix, cx, cy - S * p.lineGap * 0.5 + S * 0.35, { size: S, weight: p.weight, fill: p.color, anchor: 'middle', font: p.font, ls }); wx = cx; wb = cy + S * p.lineGap * 0.5 + S * 0.35; anc = 'middle'; }
      else { const lw = pw + sp + wcur + sw, x0 = p.align === 'left' ? cx : cx - lw / 2; out += text(p.prefix, x0, cy + S * 0.35, { size: S, weight: p.weight, fill: p.color, font: p.font, ls }); wx = x0 + pw + sp; wb = cy + S * 0.35; anc = 'start';
        if (p.suffix) out += text(p.suffix, wx + wcur, wb, { size: S, weight: p.weight, fill: p.color, font: p.font, ls }); }
      const word = (i, dy, a, bl, fid) => (a <= 0.002 ? '' : `${blurDef(fid, bl)}<g${blurAttr(fid, bl)} opacity="${f2(a)}">${text(p.words[i] ?? '', wx, wb + dy, { size: S, weight: p.accentWeight, fill: p.accent, anchor: anc, font: p.font, ls, extra: p.italic ? 'font-style="italic"' : '' })}</g>`);
      if (st.k < 1) out += word(st.prev, -p.rise * S * k, 1 - k, p.blur * c.s * k, id + 'o') + word(st.cur, p.rise * S * (1 - k), k, p.blur * c.s * (1 - k), id + 'i');
      else out += word(st.cur, 0, 1, 0, id + 'i');
      if (p.underline) out += `<rect x="${f2(anc === 'middle' ? wx - wcur / 2 : wx)}" y="${f2(wb + S * 0.14)}" width="${f2(wcur)}" height="${f2(S * 0.06)}" rx="${f2(S * 0.03)}" fill="${p.accent}"/>`;
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'type.wordSplitMedia': { file: 'type/gfx/swap.js', tags: ['type', 'word', 'split', 'inline-media', 'reveal', 'hook', 'intro'], dur: 3, inF: 8, outF: 8,
    d: { word: 'introducing', split: 5, openAt: 0.35, open: 0.5, closeAt: 2.2, close: 0.4, size: 132, at: [0.5, 0.5], slotW: 2.3, slotH: 0.98, pad: 0.12, radius: 0.16, media: null, kind: null, seed: 3,
      color: INK, weight: 800, font: FONT, ls: -0.03 },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, id = uidOf('wordSplitMedia', p), w = String(p.word), sp = Math.max(1, Math.min(w.length - 1, p.split)), a = w.slice(0, sp), b = w.slice(sp), ls = p.ls * S, fo = { weight: p.weight, font: p.font, ls };
      const wa = measure(a, S, fo), wb = measure(b, S, fo), ko = E.hero(seg(u, p.openAt, p.openAt + p.open)), kc = p.closeAt == null ? 0 : E.move(seg(u, p.closeAt, p.closeAt + p.close)), g = ko * (1 - kc);
      const full = p.slotW * S, gap = g * (full + 2 * S * p.pad), x0 = p.at[0] * c.W - (wa + gap + wb) / 2, rise = (1 - E.hero(L.in)) * S * 0.3, base = p.at[1] * c.H + S * 0.35 + rise, cy = base - S * 0.36;
      let out = text(a, x0, base, { size: S, weight: p.weight, fill: p.color, font: p.font, ls }) + text(b, x0 + wa + gap, base, { size: S, weight: p.weight, fill: p.color, font: p.font, ls });
      const sw = Math.max(0, gap - 2 * S * p.pad * g), h = p.slotH * S * (0.55 + 0.45 * g), mid = x0 + wa + gap / 2;
      if (sw > 0.5) { const fh = p.slotH * S, z = 1.1 - 0.1 * g;
        out += `<defs><clipPath id="${id}c"><rect x="${f2(mid - sw / 2)}" y="${f2(cy - h / 2)}" width="${f2(sw)}" height="${f2(h)}" rx="${f2(Math.min(p.radius * S, sw / 2))}"/></clipPath></defs>` +
          `<g clip-path="url(#${id}c)"><g transform="translate(${f2(mid)} ${f2(cy)}) scale(${z.toFixed(4)}) translate(${f2(-mid)} ${f2(-cy)})">${slotMedia(p.media, mid - full / 2, cy - fh / 2, full, fh, p.seed, { kind: p.kind })}</g></g>`; }
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'type.imageFill': { file: 'type/gfx/swap.js', tags: ['type', 'mask', 'image-fill', 'photo', 'mosaic', 'headline', 'texture'], dur: 3, inF: 14, outF: 9,
    d: { text: 'MOMENTS', size: 300, at: [0.5, 0.5], weight: 800, font: FONT, ls: -0.04, media: null, tiles: [6, 3], gap: 4, gapColor: '#FFFFFF', drift: 0.16, zoom: 0.12, seed: 2,
      outline: null, outlineW: 0.006, shadow: true },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, id = uidOf('imageFill', p), ls = p.ls * S, tw = measure(p.text, S, { weight: p.weight, font: p.font, ls }), cx = p.at[0] * c.W, kin = E.hero(L.in);
      const base = p.at[1] * c.H + S * 0.36 + (1 - kin) * S * 0.16, top = base - S * 0.82, hh = S * 1.0, x0 = cx - tw / 2, margin = S * 0.25, drift = u * p.drift * S, maxD = (L.total || 4) * p.drift * S;
      const z = 1 + p.zoom * (1 - E.cam(clamp(u / 1.0))), mcx = cx, mcy = top + hh / 2; let tiles = '';
      if (p.media && (p.media.href || p.media.svg)) tiles = slotMedia(p.media, x0 - margin - maxD / 2, top - margin, tw + 2 * margin + maxD, hh + 2 * margin, p.seed);
      else { const [cols, rows] = p.tiles, tW = (tw + 2 * margin) / cols, tH = (hh + 2 * margin) / rows, n = Math.ceil((tw + 2 * margin + maxD) / tW) + 1;
        tiles = `<rect x="${f2(x0 - margin)}" y="${f2(top - margin)}" width="${f2(n * tW)}" height="${f2(rows * tH)}" fill="${p.gapColor}"/>`;
        for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) tiles += photoTile(x0 - margin + i * tW + p.gap / 2, top - margin + j * tH + p.gap / 2, tW - p.gap, tH - p.gap, p.seed * 97 + i * 7 + j * 31, { kind: (i + j) % 2 }); }
      const tAttr = { size: S, weight: p.weight, fill: '#000', anchor: 'middle', font: p.font, ls };
      let out = `<defs><clipPath id="${id}c">${text(p.text, cx, base, tAttr)}</clipPath>${p.shadow ? blurDef(id + 's', 18 * c.s) : ''}</defs>`;
      if (p.shadow) out += `<g${blurAttr(id + 's', 18 * c.s)} opacity="0.22">${text(p.text, cx, base + S * 0.03, tAttr)}</g>`;
      out += `<g clip-path="url(#${id}c)"><g transform="translate(${f2(mcx)} ${f2(mcy)}) scale(${z.toFixed(4)}) translate(${f2(-mcx - drift)} ${f2(-mcy)})">${tiles}</g></g>`;
      if (p.outline) out += text(p.text, cx, base, { ...tAttr, fill: 'none', extra: `stroke="${p.outline}" stroke-width="${f2(p.outlineW * S)}"` });
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'type.strikeOut': { file: 'type/gfx/swap.js', tags: ['type', 'strike', 'cross-out', 'versus', 'before-after', 'comparison', 'draw-on'], dur: 2.6, inF: 8, outF: 8,
    d: { items: ['Slow renders', 'Manual edits', 'Guesswork'], strikes: [0.7, 1.1, 1.5], style: 'hand', layout: 'column', size: 68, at: [0.5, 0.5], color: INK, strike: '#E5322D', grey: '#9A9AA4',
      dim: 0.6, draw: 0.26, stagger: 0.08, gap: 0.8, lineGap: 1.5, seed: 5, weight: 700, font: FONT, sw: 0.085, markColor: '#6B6B76' },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, r = mulberry32(p.seed * 4111 + 7), cx = p.at[0] * c.W, cy = p.at[1] * c.H, n = p.items.length;
      const ws = p.items.map((it) => (typeof it === 'object' ? S * 3.2 : measure(it, S, { weight: p.weight, font: p.font })));
      const rowW = ws.reduce((a, b) => a + b, 0) + S * p.gap * (n - 1); let rx = cx - rowW / 2, out = '';
      p.items.forEach((it, i) => {
        const w = ws[i], x = p.layout === 'row' ? rx : cx - w / 2, base = p.layout === 'row' ? cy + S * 0.35 : cy + (i - (n - 1) / 2) * S * p.lineGap + S * 0.35; rx += w + S * p.gap;
        const kin = E.hero(seg(u, i * p.stagger, i * p.stagger + 0.4)), s0 = p.strikes[i], ks = s0 == null ? 0 : seg(u, s0, s0 + p.draw), kd = E.soft(seg(u, s0 ?? 1e9, (s0 ?? 1e9) + p.draw + 0.15));
        const a = kin * (1 - kd * (1 - p.dim)), dy = (1 - kin) * S * 0.25;
        out += `<g opacity="${f2(a)}" transform="translate(0 ${f2(dy)})">` + (typeof it === 'object' ? placeholderLogo(x, base - S * 0.78, w, S * 0.9, it.mark ?? i, mixHex(p.markColor, p.grey, kd), p.font) :
          text(it, x, base, { size: S, weight: p.weight, fill: mixHex(p.color, p.grey, kd), font: p.font })) + '</g>';
        if (ks <= 0) return; const ym = base - S * 0.32 + dy, j = () => (r() - 0.5) * S * 0.07; let pts;
        if (p.style === 'x') { const t1 = base - S * 0.78, b1 = base + S * 0.08, k1 = clamp(ks * 2), k2 = clamp(ks * 2 - 1), l1 = [[x - w * 0.03, t1], [x + w * 1.03, b1]], l2 = [[x + w * 1.03, t1], [x - w * 0.03, b1]];
          for (const [ln, k] of [[l1, k1], [l2, k2]]) if (k > 0) { const len = polylineLen(ln); out += `<path d="M${f2(ln[0][0])} ${f2(ln[0][1])} L${f2(ln[1][0])} ${f2(ln[1][1])}" fill="none" stroke="${p.strike}" stroke-width="${f2(p.sw * S)}" stroke-linecap="round" ${dash(len, E.soft(k))}/>`; }
          return; }
        pts = p.style === 'hand' ? Array.from({ length: 7 }, (_, q) => [x - w * 0.05 + (w * 1.1 * q) / 6, ym - S * 0.05 * (q / 6) + j()]) : [[x - w * 0.05, ym], [x + w * 1.05, ym - S * 0.04]];
        const len = polylineLen(pts) * 1.02;
        out += `<path d="${pts.map(([px, py], q) => `${q ? 'L' : 'M'}${f2(px)} ${f2(py)}`).join(' ')}" fill="none" stroke="${p.strike}" stroke-width="${f2(p.sw * S)}" stroke-linecap="round" stroke-linejoin="round" ${dash(len, E.soft(ks))}/>`;
      });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.glowWord': { file: 'type/gfx/swap.js', tags: ['type', 'glow', 'halo', 'gradient', 'keynote', 'ai-feature', 'title'], dur: 3, inF: 18, outF: 10,
    d: { text: 'Intelligence', size: 150, at: [0.5, 0.5], weight: 800, font: FONT, ls: -0.03, color: '#FFFFFF', colors: ['#7A5CFF', '#FF4FA3', '#FFB23F', '#2BD9C9'], halo: 1, haloOp: 0.85,
      blur: 64, breathe: 0.35, amp: 0.07, drift: 0.12 },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, id = uidOf('glowWord', p), tw = measure(p.text, S, { weight: p.weight, font: p.font, ls: p.ls * S }), cx = p.at[0] * c.W, cy = p.at[1] * c.H, kin = E.enter(L.in), o = 1 - L.out;
      const br = 1 + p.amp * Math.sin(TAU * p.breathe * u), hk = E.soft(clamp(u / 0.9)); let halo = '';
      p.colors.forEach((col, i) => { const a = (i / p.colors.length) * TAU + TAU * p.drift * u, hx = cx + Math.cos(a) * tw * 0.2, hy = cy + Math.sin(a) * S * 0.16;
        halo += `<ellipse cx="${f2(hx)}" cy="${f2(hy)}" rx="${f2(tw * 0.32 * p.halo * br)}" ry="${f2(S * 0.6 * p.halo * br)}" fill="${col}"/>`; });
      const tb = (1 - kin) * 16 * c.s, ls = p.ls * S + (1 - kin) * 0.06 * S;
      return `<defs>${blurDef(id + 'h', p.blur * c.s)}${blurDef(id + 't', tb)}</defs><g${blurAttr(id + 'h', p.blur * c.s)} opacity="${f2(p.haloOp * hk * o)}">${halo}</g>` +
        `<g${blurAttr(id + 't', tb)} opacity="${f2(clamp(L.in * 1.4) * o)}">${text(p.text, cx, cy + S * 0.35, { size: S, weight: p.weight, fill: p.color, anchor: 'middle', font: p.font, ls })}</g>`; } },

  'type.ledDigits': { file: 'type/gfx/swap.js', tags: ['type', 'led', 'pixel', 'numerals', 'scoreboard', 'retro', 'counter'], dur: 3, inF: 6, outF: 8,
    d: { text: '0%', steps: [], size: 220, at: [0.5, 0.5], lit: '#FFB23A', unlit: 'rgba(255,255,255,0.07)', cell: 'dot', fill: 0.78, panel: '#141210', pad: 1.2, flicker: 0.5, flip: 0.22, glow: true, seed: 9 },
    svg(L, p, c) {
      const cap = p.size * c.s, cs = cap / 7, u = L.u, id = uidOf('ledDigits', p), seq = [[0, String(p.text)], ...p.steps.map(([t, s]) => [t, String(s)])], n = Math.max(...seq.map(([, s]) => s.length));
      const padS = (s) => { const d = n - s.length, l = Math.floor(d / 2); return ' '.repeat(l) + s + ' '.repeat(d - l); }, strs = seq.map(([, s]) => padS(s));
      const cols = n * 6 - 1, Wd = cols * cs, x0 = p.at[0] * c.W - Wd / 2, y0 = p.at[1] * c.H - cap / 2;
      const bit = (s, col, row) => { const ch = s[Math.floor(col / 6)], q = col % 6; if (q === 5 || !ch || ch === ' ') return false; const rows = PIXEL5x7[ch.toUpperCase()] || PIXEL5x7['?']; return !!(rows[row] & (16 >> q)); };
      let un = '', lit = ''; const rr = (cs * p.fill) / 2;
      const cell = (col, row) => (p.cell === 'square' ? `<rect x="${f2(x0 + col * cs + cs / 2 - rr)}" y="${f2(y0 + row * cs + cs / 2 - rr)}" width="${f2(rr * 2)}" height="${f2(rr * 2)}" rx="${f2(rr * 0.2)}"/>` : `<circle cx="${f2(x0 + col * cs + cs / 2)}" cy="${f2(y0 + row * cs + cs / 2)}" r="${f2(rr)}"/>`);
      for (let col = 0; col < cols; col++) for (let row = 0; row < 7; row++) {
        const tOn = hashf(col, row, p.seed) * p.flicker, blink = hashf(row, col, p.seed + 1) < 0.4 && u > tOn + 0.05 && u < tOn + 0.09;
        let on = u >= tOn && !blink && bit(strs[0], col, row);
        for (let j = 1; j < seq.length; j++) if (u >= seq[j][0] + hashf(col, row, j, p.seed) * p.flip) on = bit(strs[j], col, row);
        const cm = cell(col, row); if (on) lit += cm; else un += cm; }
      const pd = p.pad * cs, glow = p.glow ? `${blurDef(id + 'g', cs * 0.45)}` : '';
      return `<defs>${glow}</defs><g opacity="${f2(op(L))}"><rect x="${f2(x0 - pd)}" y="${f2(y0 - pd)}" width="${f2(Wd + 2 * pd)}" height="${f2(cap + 2 * pd)}" rx="${f2(cs * 0.7)}" fill="${p.panel}"/>` +
        `<g fill="${p.unlit}">${un}</g>${p.glow ? `<g fill="${p.lit}"${blurAttr(id + 'g', cs * 0.45)} opacity="0.85">${lit}</g>` : ''}<g fill="${p.lit}">${lit}</g></g>`; } },
};
/* per-action sound cues (local s; index.js gfxCues adds `at`). Every id resolves in sfx/ (tools/check_ids.py). */
export const SWAP_CUES = {
  'type.accentSwap': (p) => p.steps.slice(1).map(([t], i) => ({ t, id: i % 2 ? 'sfx/whoosh/swish_s' : 'sfx/whoosh/swish_xs', why: 'accent word swaps' })),
  'type.wordSplitMedia': (p) => [{ t: p.openAt, id: 'sfx/ui/slide', why: 'word splits open' }, ...(p.closeAt == null ? [] : [{ t: p.closeAt, id: 'sfx/ui/pop_down', why: 'word closes' }])],
  'type.imageFill': () => [{ t: 0, id: 'sfx/tx/mask_reveal', why: 'masked word rises' }],
  'type.strikeOut': (p) => p.strikes.filter((s) => s != null).map((t, i) => ({ t, id: i % 2 ? 'sfx/whoosh/swish_xs' : 'sfx/whoosh/zip', why: 'strike ' + (i + 1) })),
  'type.glowWord': () => [{ t: 0, id: 'sfx/sparkle/shimmer', why: 'halo blooms' }],
  'type.ledDigits': (p) => [{ t: 0, id: 'sfx/device/loading_tick', why: 'cells flicker on' }, ...p.steps.map(([t]) => ({ t, id: 'sfx/ui/count_tick', why: 'value flips' }))],
};
