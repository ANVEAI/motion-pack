/* motion-pack / type / gfx / kinetic.js: sentence-led kinetic type pieces (2026-10-14). Same contract as every gfx item (core.js):
   { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure function of t (seek-safe). Positions are frame fractions, sizes px @1080 (scaled by c.s).
   Word widths come from measure() (canvas measureText in the browser, an estimate in node), so reflow and letter positions follow the real font.
     type.wordWheel         vertical list scrolls; the active word is bold and opaque, neighbours fade by distance; steps = [[t, index], ...]
     type.inlineMedia       a sentence with image / card-stack slots that open and reflow the words around them; words build one by one
     type.letterAssemble    letters scattered with small coloured dots converge into a word; the dots line up beside it, then vanish
     type.glyphMorphCursor  monospace typing; the caret morphs caret -> circle -> square -> triangle -> your mark (SVG path slot)
     type.marquee           giant monospace full-bleed horizontal scroll; one word in an accent colour or a 5x7 pixel face
     type.bleedWord         an oversized word cropped by the frame edges, sliding
   Craft learned from public launch films (sentence-first layouts, word wheels, scattered-letter openers, cursor-to-mark morphs, monospace marquees,
   cropped brand type); no reference wording, brand, footage or sequence is reproduced. Owned code. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, MONO, BRAND, INK, PAPER, f2, esc, text, measure } from './core.js';
import { slotMedia, DEFAULT_MARK } from './media.js';

const F = 1 / 30;
const op = (L) => clamp(L.in * 1.5) * (1 - L.out);
/* point set of a closed polygon, sampled evenly along its perimeter (start = first vertex, clockwise) */
function polyPts(v, n) {
  const segs = v.map((p, i) => [p, v[(i + 1) % v.length]]), lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1])), tot = lens.reduce((a, b) => a + b, 0), out = [];
  for (let k = 0; k < n; k++) { let d = (k / n) * tot, j = 0; while (j < lens.length - 1 && d > lens[j]) { d -= lens[j]; j++; } const [a, b] = segs[j], q = lens[j] ? d / lens[j] : 0; out.push([lerp(a[0], b[0], q), lerp(a[1], b[1], q)]); }
  return out;
}
const NPTS = 72;
const FAN = [-6, 5, -11], fanRot = (pos) => { const i = Math.min(1, Math.floor(pos)); return lerp(FAN[i], FAN[i + 1], clamp(pos - i)); };
export const SHAPES = {
  caret: polyPts([[0, -1], [0.09, -1], [0.09, 1], [-0.09, 1], [-0.09, -1]], NPTS),
  circle: Array.from({ length: NPTS }, (_, k) => [Math.sin((k / NPTS) * TAU), -Math.cos((k / NPTS) * TAU)]),
  square: polyPts([[0, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82], [-0.82, -0.82]], NPTS),
  triangle: polyPts([[0, -1], [0.95, 0.78], [-0.95, 0.78]], NPTS),
  diamond: polyPts([[0, -1], [1, 0], [0, 1], [-1, 0]], NPTS),
};
const ptsPath = (pts, cx, cy, r) => 'M' + pts.map(([x, y]) => `${f2(cx + x * r)} ${f2(cy + y * r)}`).join(' L') + ' Z';
/* 5x7 pixel face (owned), rows top to bottom, 5 bits each */
export const PIXEL5x7 = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '-': [0, 0, 0, 31, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '·': [0, 0, 0, 12, 12, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
  '%': [24, 25, 2, 4, 8, 19, 3], '+': [0, 4, 4, 31, 4, 4, 0], ':': [0, 12, 12, 0, 12, 12, 0], '/': [1, 1, 2, 4, 8, 16, 16], '$': [4, 15, 20, 14, 5, 30, 4], '#': [10, 10, 31, 10, 31, 10, 10] };
/* one pixel glyph: advance `adv`, cap height `cap`, baseline y */
export function pixelGlyph(ch, x, base, adv, cap, fill) {
  const rows = PIXEL5x7[ch.toUpperCase()] || PIXEL5x7['?'], cell = cap / 7, ox = x + (adv - cell * 5) / 2; let o = '';
  rows.forEach((bits, ry) => { for (let cx = 0; cx < 5; cx++) if (bits & (16 >> cx)) o += `<rect x="${f2(ox + cx * cell)}" y="${f2(base - cap + ry * cell)}" width="${f2(cell + 0.6)}" height="${f2(cell + 0.6)}"/>`; });
  return `<g fill="${fill}">${o}</g>`;
}
/* inlineMedia tokenizer: '[photo]' '[stack]' (slots, optional ':seed'), '*word*' (accent pill), '|' (line break) */
export function tokenize(str) {
  return String(str).split(/\s+/).filter(Boolean).map((w) => { const m = w.match(/^\[(photo|stack)(?::(\d+))?\]$/); if (m) return { slot: m[1], seed: m[2] ? +m[2] : null };
    if (w === '|') return { br: true }; const pm = w.match(/^\*(.+)\*([.,!?]?)$/); return pm ? { w: pm[1] + pm[2], pill: true } : { w }; });
}

export const KINETIC = {
  'type.wordWheel': { tags: ['type', 'list', 'wheel', 'slot', 'agent-at-work', 'feature-list'], dur: 3, inF: 10, outF: 8,
    d: { words: ['Plans', 'Docs', 'Sites', 'Build it all', 'Design', 'Data', 'Automations'], steps: [[0, 0], [0.45, 1], [0.9, 2], [1.35, 3]], move: 0.32, at: [0.5, 0.5], size: 84, gap: 1.18,
      prefix: '', align: 'center', color: INK, falloff: 0.3, dim: 0.3, rows: 3, wActive: 800, wIdle: 500, font: FONT },
    svg(L, p, c) {
      const steps = p.steps.length ? p.steps : [[0, 0]], u = L.u; let a = steps[0][1]; for (let j = 1; j < steps.length; j++) a += (steps[j][1] - steps[j - 1][1]) * E.move(seg(u, steps[j][0], steps[j][0] + p.move));
      const S = p.size * c.s, cx = p.at[0] * c.W, cy = p.at[1] * c.H, rise = (1 - E.hero(L.in)) * S * 0.4, o = op(L), anc = p.align === 'left' || p.prefix ? 'start' : 'middle', x = p.prefix ? cx + S * 0.18 : cx;
      let out = p.prefix ? text(p.prefix, cx - S * 0.18, cy + S * 0.35 + rise, { size: S, weight: p.wActive, fill: p.color, anchor: 'end', font: p.font, ls: -0.02 * S }) : '';
      p.words.forEach((w, i) => { const d = i - a, ad = Math.abs(d); if (ad > p.rows + 0.5) return; const k = clamp(1 - ad), edge = clamp(p.rows + 0.5 - ad), alpha = lerp(Math.max(0.06, p.dim - (ad - 1) * p.falloff * p.dim), 1, k) * edge;
        out += text(w, x, cy + d * S * p.gap + S * 0.35 + rise, { size: S, weight: Math.round(lerp(p.wIdle, p.wActive, k)), fill: p.color, anchor: anc, font: p.font, ls: -0.02 * S, op: alpha }); });
      return `<g opacity="${f2(o)}">${out}</g>`; } },

  'type.inlineMedia': { tags: ['type', 'sentence', 'inline-media', 'card-stack', 'editorial', 'hook'], dur: 3.5, inF: 1, outF: 8,
    d: { text: 'Every [stack] idea, in [photo] *one* place', size: 72, at: [0.5, 0.5], stagger: 5 * F, wordDur: 10 * F, slotDur: 14 * F, slotW: 1.7, slotH: 1.5, riffle: 0.5, media: [], seed: 4,
      color: INK, accent: BRAND, pillInk: PAPER, font: FONT, weight: 700, lineGap: 1.6, reflow: true },
    svg(L, p, c) {
      const S = p.size * c.s, toks = tokenize(p.text), u = L.u, sp = measure(' ', S, { weight: p.weight, font: p.font }); let si = 0, j = 0;
      const items = toks.map((tk) => { if (tk.br) return tk; const t0 = j++ * p.stagger, g = E.hero(seg(u, t0, t0 + (tk.slot ? p.slotDur : p.wordDur)));
        if (tk.slot) { const m = p.media[si] || null, it = { ...tk, t0, g, m, i: si++, full: p.slotW * S }; it.wd = (p.reflow ? g : 1) * it.full; return it; }
        const full = measure(tk.w, S, { weight: p.weight, font: p.font }) + (tk.pill ? S * 0.5 : 0); return { ...tk, t0, g, full, wd: (p.reflow ? g : 1) * full }; });
      const lines = [[]]; items.forEach((it) => (it.br ? lines.push([]) : lines.at(-1).push(it))); let out = '';
      lines.forEach((ln, li) => { const gaps = ln.map((it, k) => (k ? (it.slot || ln[k - 1].slot ? S * 0.28 : sp) * (p.reflow ? Math.min(it.g * 1.5, 1) : 1) : 0)), tot = ln.reduce((a, it, k) => a + it.wd + gaps[k], 0);
        let x = p.at[0] * c.W - tot / 2; const base = p.at[1] * c.H + (li - (lines.length - 1) / 2) * S * p.lineGap + S * 0.35;
        ln.forEach((it, k) => { x += gaps[k];
          if (it.slot) { const w = it.full, h = p.slotH * S, cx = x + it.wd / 2, cy = base - S * 0.35, sc = Math.max(0.0001, it.g);
            let inner = '';
            if (it.slot === 'photo') inner = slotMedia(it.m, -w / 2, -h / 2, w, h, p.seed * 31 + it.i * 7, { radius: S * 0.12, border: S * 0.05 });
            else { const v = Math.max(0, u - it.t0 - p.slotDur), idx = Math.floor(v / p.riffle), q = E.move(seg((v / p.riffle) % 1, 0.62, 1)), base0 = (it.m?.seed ?? p.seed * 13 + it.i * 5) + idx;
              for (let dd = 2; dd >= 0; dd--) { const pos = dd === 0 ? 0 : dd - q, isTop = dd === 0, ty = isTop ? -q * h * 0.9 : -pos * h * 0.06, rot = isTop ? -6 + q * 14 : fanRot(pos), al = isTop ? 1 - q : 1;
                inner += `<g transform="translate(${f2(pos * S * 0.1)} ${f2(ty)}) rotate(${f2(rot)})" opacity="${f2(al)}">${slotMedia(Array.isArray(it.m?.cards) ? it.m.cards[(idx + dd) % it.m.cards.length] : null, -w / 2, -h / 2, w, h, base0 + dd, { radius: S * 0.1, border: S * 0.05, shadow: true })}</g>`; } }
            out += `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${sc.toFixed(4)})">${inner}</g>`; }
          else { const o = E.enter(seg(u, it.t0, it.t0 + p.wordDur)), dy = (1 - o) * S * 0.3;
            if (it.pill) out += `<g opacity="${f2(o)}"><rect x="${f2(x)}" y="${f2(base - S * 0.86 + dy)}" width="${f2(it.full)}" height="${f2(S * 1.12)}" rx="${f2(S * 0.22)}" fill="${p.accent}"/>${text(it.w, x + S * 0.25, base + dy, { size: S, weight: p.weight, fill: p.pillInk, font: p.font })}</g>`;
            else out += text(it.w, x, base + dy, { size: S, weight: p.weight, fill: p.color, font: p.font, op: o }); }
          x += it.wd; }); });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.letterAssemble': { tags: ['type', 'opener', 'letters', 'assemble', 'dots', 'hook', 'logo-reveal'], dur: 2.6, inF: 1, outF: 8,
    d: { text: 'Meet', size: 140, at: [0.5, 0.5], spread: [0.34, 0.3], hold0: 0.4, fly: 0.85, stagger: 3 * F, dots: 8, dotColors: ['#FF5A36', '#2BD9A0', '#5AB0FF', '#FFCF3A', '#B57BFF'], seed: 5, color: PAPER, weight: 700, font: FONT },
    svg(L, p, c) {
      const S = p.size * c.s, cx = p.at[0] * c.W, cy = p.at[1] * c.H, chars = [...p.text], tot = measure(p.text, S, { weight: p.weight, font: p.font }), x0 = cx - tot / 2, base = cy + S * 0.35, u = L.u, r = mulberry32(p.seed * 4241 + 7);
      let out = '', end = 0;
      chars.forEach((ch, i) => { const sx = cx + (r() - 0.5) * 2 * p.spread[0] * c.W, sy = cy + (r() - 0.5) * 2 * p.spread[1] * c.H, rot = (r() - 0.5) * 40, t1 = p.hold0 + i * p.stagger, k = E.hero(seg(u, t1, t1 + p.fly)), pop = E.enter(seg(u, i * 2 * F, i * 2 * F + 8 * F)); end = Math.max(end, t1 + p.fly);
        if (ch === ' ') return; const fx = x0 + measure(p.text.slice(0, i), S, { weight: p.weight, font: p.font }), x = lerp(sx, fx, k), y = lerp(sy, base, k);
        out += `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(rot * (1 - k))}) scale(${f2(lerp(0.8, 1, pop))})" opacity="${f2(pop)}">${text(ch, 0, 0, { size: S, weight: p.weight, fill: p.color, font: p.font })}</g>`; });
      for (let j = 0; j < p.dots; j++) { const sx = cx + (r() - 0.5) * 2 * p.spread[0] * c.W * 1.1, sy = cy + (r() - 0.5) * 2 * p.spread[1] * c.H * 1.1, side = j % 2 ? 1 : -1, n = Math.floor(j / 2),
          fx = side > 0 ? x0 + tot + S * (0.3 + n * 0.22) : x0 - S * (0.3 + n * 0.22), fy = cy, t1 = p.hold0 + (j % chars.length) * p.stagger, k = E.hero(seg(u, t1, t1 + p.fly)), gone = E.exit(seg(u, end + 0.25 + n * 2 * F, end + 0.55 + n * 2 * F)), pop = E.pop(seg(u, j * F, j * F + 8 * F));
        const rr = S * 0.055 * pop * (1 - gone); if (rr > 0.05) out += `<circle cx="${f2(lerp(sx, fx, k))}" cy="${f2(lerp(sy, fy, k))}" r="${f2(rr)}" fill="${p.dotColors[j % p.dotColors.length]}"/>`; }
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.glyphMorphCursor': { tags: ['type', 'typing', 'cursor', 'morph', 'logo-reveal', 'mark', 'tech'], dur: 3.4, inF: 1, outF: 8,
    d: { text: 'Build your', size: 64, at: [0.5, 0.5], charRate: 3 * F, blink: 0.5, shapes: ['circle', 'square', 'triangle'], morph: 0.2, hold: 0.1, mark: DEFAULT_MARK, markViewBox: 100, glyph: 0.9,
      color: INK, accent: BRAND, font: MONO, weight: 600 },
    svg(L, p, c) {
      const S = p.size * c.s, adv = measure('M', S, { weight: p.weight, font: p.font }), n = [...p.text].length, gs = p.glyph * S, gap = S * 0.45, tot = n * adv + gap + gs, x0 = p.at[0] * c.W - tot / 2, base = p.at[1] * c.H + S * 0.35, gy = base - S * 0.36, u = L.u;
      const typed = Math.min(n, Math.floor(u / p.charRate) + 1), tDone = n * p.charRate, mStart = tDone + p.blink, gx = x0 + n * adv + gap + gs / 2;
      let out = text(p.text.slice(0, typed), x0, base, { size: S, weight: p.weight, fill: p.color, font: p.font });
      const seq = ['caret', ...p.shapes], per = p.morph + p.hold, v = u - mStart;
      if (v < 0) { const on = u < tDone || Math.floor((u - tDone) / 0.25) % 2 === 0; if (on) out += `<rect x="${f2(x0 + typed * adv + S * 0.06)}" y="${f2(base - S * 0.82)}" width="${f2(S * 0.09)}" height="${f2(S)}" fill="${p.color}"/>`; }
      else { const steps = seq.length - 1, idx = Math.min(steps, Math.floor(v / per)), q = idx >= steps ? 1 : E.move(seg(v - idx * per, 0, p.morph)), A = SHAPES[seq[Math.min(idx, steps)]], B = SHAPES[seq[Math.min(idx + 1, steps)]] || A;
        const mv = E.move(seg(v, 0, p.morph)), cx = lerp(x0 + n * adv + S * 0.105, gx, mv), rad = lerp(S * 0.5, gs / 2, mv), pts = A.map((a, k) => [lerp(a[0], B[k][0], q), lerp(a[1], B[k][1], q)]);
        const mEnd = steps * per, mk = E.pop(seg(v, mEnd, mEnd + 0.35)), shrink = E.exit(seg(v, mEnd, mEnd + 0.18)), col = idx === 0 && q < 0.5 ? p.color : p.accent;
        if (shrink < 1) out += `<path d="${ptsPath(pts, cx, gy, rad * (1 - shrink))}" fill="${col}"/>`;
        if (mk > 0) { const sc = (gs / p.markViewBox) * mk; out += `<g transform="translate(${f2(gx - (p.markViewBox / 2) * sc)} ${f2(gy - (p.markViewBox / 2) * sc)}) scale(${Math.max(0.0001, sc).toFixed(4)})"><path d="${esc(p.mark)}" fill="${p.accent}"/></g>`; } }
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'type.marquee': { tags: ['type', 'marquee', 'monospace', 'full-bleed', 'ticker', 'pixel', 'manifesto'], dur: 3, inF: 1, outF: 6,
    d: { text: 'all in one workspace ·', accent: 'one', accentStyle: 'color', size: 0.36, speed: 0.42, dir: -1, y: 0.5, color: PAPER, accentColor: BRAND, bg: null, font: MONO, weight: 600, phase: 0 },
    svg(L, p, c) {
      const S = p.size * c.H, adv = measure('M', S, { weight: p.weight, font: p.font }), phrase = p.text.endsWith(' ') ? p.text : p.text + ' ', period = [...phrase].length * adv, base = p.y * c.H + S * 0.35;
      const off = ((p.phase * c.W + L.u * p.speed * c.W) % period + period) % period, x0 = p.dir < 0 ? -off : off - period, words = phrase.split(' ');
      let out = p.bg ? `<rect width="${c.W}" height="${c.H}" fill="${p.bg}"/>` : '';
      for (let X = x0 - period; X < c.W + period; X += period) { let ci = 0;
        words.forEach((w) => { const x = X + ci * adv; ci += [...w].length + 1; if (!w || x > c.W || x + w.length * adv < 0) return; const isA = p.accent && w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() === String(p.accent).toLowerCase();
          if (isA && p.accentStyle === 'pixel') [...w].forEach((ch, k) => { out += pixelGlyph(ch, x + k * adv, base, adv, S * 0.7, p.accentColor); });
          else out += text(w, x, base, { size: S, weight: p.weight, fill: isA ? p.accentColor : p.color, font: p.font }); }); }
      return `<g opacity="${f2(clamp(L.in * 2) * (1 - L.out))}">${out}</g>`; } },

  'type.bleedWord': { tags: ['type', 'oversized', 'cropped', 'bleed', 'brand-system', 'editorial'], dur: 2.2, inF: 8, outF: 6,
    d: { text: 'OPEN', size: 0.9, from: [0.06, 1.08], to: [-0.2, 1.08], color: BRAND, weight: 800, font: FONT, ls: -0.05, slideIn: 0.08 },
    svg(L, p, c) {
      const S = p.size * c.H, k = E.soft(clamp(L.u / Math.max(0.01, L.total))), kin = 1 - E.enter(L.in), x = lerp(p.from[0], p.to[0], k) * c.W + kin * p.slideIn * c.W, y = lerp(p.from[1], p.to[1], k) * c.H;
      return text(p.text, x, y, { size: S, weight: p.weight, fill: p.color, font: p.font, ls: p.ls * S, op: clamp(L.in * 3) * (1 - L.out) }); } },
};
