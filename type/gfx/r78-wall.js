/* motion-pack / type / gfx / r78-wall.js (xp-r78, 2026-10-16): three round-8 parts. Same gfx contract as every part (core.js): { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure
   function of t (no module state, no clock, no Math.random: seeded hashes only).
     layout.textWall    a dense wall of paragraph cards that tiles, scrolls and multiplies, to show an over-long answer: cols x rows cards of lorem lines (monospace, so a line holds a fixed number of
                        characters and the markup is the same in node and in a browser), an endless wall (rows are numbered from the scroll offset and seeded by their absolute number), cards that pop in
                        on `multiply: [t0, t1]` in a seeded order, and ONE highlighted line (`highlight: { at, card, line }`: the card is an absolute card number, so the mark scrolls with the wall)
                        that a bar wipes across. wallLine(p, card, line) is the string of any line. The text is lorem placeholder and the frame says so (`note`).
     layout.pillWall    a wall of pill chips in many scripts: rows of label pills that scroll sideways (alternate rows opposite ways, each row at its own speed), one pill lit white at the
                        centre whose text swaps and re-sizes the pill (`lit: { at, texts, steps, resize }`; the lit width is the MEASURED text width plus padding at every step, litState(p, u)),
                        the wall pills under it dimmed. pillWallLint(p) lists the characters the bundled font (Manrope) has no glyph for (r78-glyphs.js: Latin, Greek, Cyrillic, Vietnamese yes;
                        Devanagari, Arabic, CJK no), so a label that would fall back to a system font is found before a render.
     device.lockScreen  a phone (drawn at `aspect` = width / height inside `box`, centred) that slides up, wakes from black (`wake`), shows a clock (a PARAMETER, `time`: the part never reads the system time), a notification stack (newest on top,
                        stable order: sorted by `at` then index, each push eased) and hands off into a message thread at `openAt` (the lock layer slides up, the thread's first bubble is the
                        first notification's text, `thread` bubbles pop on their own times). The clock digits are an example time: the frame prints `label` ("placeholder UI").
   HONESTY (type/tests/honesty-defaults.test.mjs): every default frame that prints a digit also prints a placeholder label; no number, price or quote is invented.
   Guards: every numeric param is clamped (num), counts and lists are capped (cols 8, rows 8, lines 16, labels 64, rows of pills 12, notifications 6), colours are #hex only, text is capped. */
import { E, clamp, lerp, seg, f2, text, esc, measure, MONO, hashf } from './core.js';
import { num, str, list, hex, obj, sc, boxPx, rrPath, alive, mixHex } from './r78-util.js';
import { missingGlyphs } from './r78-glyphs.js';

const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');

/* ================================================================ layout.textWall ================================================================ */
const WALL_D = { box: [0.04, 0.06, 0.92, 0.88], cols: 4, rows: 4, lines: 9, density: 0.88, size: 17, gap: 18, scroll: 70, multiply: [0.0, 1.6], highlight: { at: 3.0, card: 6, line: 4 }, seed: 3, page: '#F2F0EB', paper: '#FFFFFF', ink: '#4A4F5C', accent: '#FFC23D', note: 'placeholder text', noteAt: 0 };
/* the characters of a line fit the card: monospace advance 0.6 em, so the count is exact in every renderer */
const lineChars = (cardW, size, pad) => Math.max(8, Math.floor((cardW - 2 * pad) / (0.6 * size)));
/* one line of the wall: the same string for the same (seed, card, line, width) in any order. A line is lorem words up to `density` of the full width (the last line of a card is shorter). */
export function wallLine(pIn, card, line, chars = 44) {
  const p = obj(pIn), seed = num(p.seed, 3, 0, 1e9), den = clamp(num(p.density, 0.88, 0.1, 1)), lines = Math.round(num(p.lines, 9, 1, 16)), last = line === lines - 1;
  const target = Math.max(6, Math.round(chars * (last ? den * (0.25 + 0.5 * hashf(seed, card, line, 9)) : den * (0.86 + 0.14 * hashf(seed, card, line, 8))))); let s = '', k = 0;
  while (s.length < target && k < 40) { const w = LOREM[Math.floor(hashf(seed, card, line, k, 1) * LOREM.length)]; s += (s ? ' ' : '') + w; k++; }
  return (s.length > chars ? s.slice(0, chars).replace(/\s+\S*$/, '') : s) + (last ? '.' : '');
}
const WALL = { tags: ['layout', 'wall', 'text', 'paragraphs', 'scroll', 'answer', 'over-long', 'highlight', 'placeholder'], dur: 5.0, inF: 8, outF: 9, d: WALL_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, o = alive(L), [bx, by, bw, bh] = boxPx(p.box, WALL_D.box, c), cols = Math.round(num(p.cols, 4, 1, 8)), rows = Math.round(num(p.rows, 4, 1, 8)), lines = Math.round(num(p.lines, 9, 1, 16)), size = num(p.size, 17, 6, 80) * s, gap = num(p.gap, 18, 0, 200) * s;
    const cw = (bw - gap * (cols + 1)) / cols, pad = 14 * s, lh = size * 1.5, ch = lines * lh + 2 * pad, rowH = (bh - gap * (rows + 1)) / rows, step = Math.max(ch, rowH) + gap, chars = lineChars(cw, size, pad), scr = num(p.scroll, 70, -3000, 3000) * s * u;
    const ink = hex(p.ink, WALL_D.ink), paper = hex(p.paper, WALL_D.paper), acc = hex(p.accent, WALL_D.accent), page = hex(p.page, WALL_D.page), mu = list(p.multiply, 2), m0 = num(mu[0], 0, 0, 1e3), m1 = Math.max(m0 + 0.05, num(mu[1], 1.6, 0, 1e3)), hl = obj(p.highlight), hAt = num(hl.at, 3, 0, 1e4), hCard = Math.round(num(hl.card, 6, 0, 1e6)), hLine = Math.round(num(hl.line, 4, 0, 15));
    const r0 = Math.floor(scr / step), off = scr - r0 * step, nrows = Math.ceil(bh / step) + 2;
    let out = `<defs><clipPath id="tw"><rect x="${f2(bx)}" y="${f2(by)}" width="${f2(bw)}" height="${f2(bh)}"/></clipPath></defs><g opacity="${f2(o)}"><rect x="${f2(bx)}" y="${f2(by)}" width="${f2(bw)}" height="${f2(bh)}" fill="${page}"/><g clip-path="url(#tw)">`;
    for (let r = -1; r < nrows; r++) { const rowAbs = r0 + r, y = by + gap + r * step - off;
      for (let cI = 0; cI < cols; cI++) { const card = rowAbs * cols + cI, cardId = ((card % 100000) + 100000) % 100000, tr = m0 + (m1 - m0) * hashf(num(p.seed, 3, 0, 1e9), cardId, 77), k = E.pop(seg(u, tr, tr + 0.38)); if (k <= 0.001) continue;
        const x = bx + gap + cI * (cw + gap), cx = x + cw / 2, cy = y + ch / 2, kk = clamp(k, 0, 1.12), isH = card === hCard;
        out += `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${f2(kk)}) translate(${f2(-cx)} ${f2(-cy)})"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(cw)}" height="${f2(ch)}" rx="${f2(10 * s)}" fill="${paper}" stroke="${isH ? acc : '#000000'}" stroke-opacity="${isH ? 0.9 : 0.08}" stroke-width="${f2(isH ? 2.5 * s : 1.2 * s)}"/>`;
        for (let li = 0; li < lines; li++) { const ly = y + pad + li * lh + size, str_ = wallLine(p, card, li, chars), hot = isH && li === hLine, kh = hot ? E.move(seg(u, hAt, hAt + 0.45)) : 0;
          if (hot && kh > 0) out += `<rect x="${f2(x + pad - 4 * s)}" y="${f2(ly - size * 1.05)}" width="${f2((cw - 2 * pad + 8 * s) * kh)}" height="${f2(lh * 0.98)}" rx="${f2(4 * s)}" fill="${acc}"/>`;
          out += text(str_, x + pad, ly, { size, weight: hot && kh > 0.4 ? 700 : 500, fill: hot && kh > 0.4 ? '#1B1B22' : ink, font: MONO, op: hot ? 1 : 0.82 }); }
        out += '</g>'; } }
    out += '</g>';
    const nt = str(p.note, '', 60); if (nt) out += `<rect x="${f2(bx + bw / 2 - 110 * s)}" y="${f2(by + bh - 46 * s)}" width="${f2(220 * s)}" height="${f2(32 * s)}" rx="${f2(16 * s)}" fill="#14161D" fill-opacity="0.82"/>` + text(nt, bx + bw / 2, by + bh - 24 * s, { size: 19 * s, weight: 700, fill: '#FFFFFF', anchor: 'middle' });
    return out + '</g>';
  } };

/* ================================================================ layout.pillWall ================================================================ */
const PILL_LABELS = ['Hello', 'Привет', 'Γειά σου', 'Xin chào', 'Merhaba', 'Hola', 'Bonjour', 'Olá', 'Здравствуйте', 'Ciao', 'Hej', 'Salut', 'Dobrý den', 'Καλημέρα', 'Cześć', 'Hallo', 'Terve', 'Bună ziua', 'Selam', 'Chào bạn', 'Buenas', 'Servus', 'Здраво', 'Aloha'];
const PILL_D = { box: [0, 0, 1, 1], labels: PILL_LABELS, rows: 7, size: 34, gap: 14, scroll: 60, lit: { at: 0.6, texts: ['Say it once', 'Say it your way', 'Say it in any language'], steps: [0, 1.4, 2.8], resize: 0.32 }, center: [0.5, 0.5], bg: ['#FF9A4D', '#F05A1A'], pill: '#FFFFFF', pillAlpha: 0.2, ink: '#FFFFFF', litFill: '#FFFFFF', litInk: '#1B1B22', seed: 2, note: 'placeholder labels' };
const padX = (size) => size * 0.9, pillH = (size) => size * 1.9;
/* the width of a pill for a text: the measured text width + the padding (the lit pill re-sizes to exactly this) */
export const pillWidth = (txt, size) => measure(str(txt, '', 60), size, { weight: 700 }) + 2 * padX(size);
/* the lit pill at local time u: the step it is on, the text, its width (re-sized with an ease over `resize` s after each step), the previous text and the swap progress */
export function litState(pIn, u, size = 34) {
  const p = obj(pIn), lit = obj(p.lit), at = num(lit.at, 0.6, 0, 1e4), texts = list(lit.texts, 12).map((t) => str(t, '', 60)), steps = list(lit.steps, 12).map((v, i) => num(v, i * 1.4, 0, 1e4)), rs = num(lit.resize, 0.32, 0.02, 5);
  if (!texts.length) return { i: -1, text: '', prev: '', width: pillH(size), k: 0, swap: 1 };
  const uu = u - at; let i = -1; for (let k = 0; k < texts.length; k++) if (uu >= (steps[k] ?? k * 1.4) - 1e-9) i = k;
  if (i < 0) return { i: -1, text: '', prev: '', width: pillH(size), k: 0, swap: 0 };
  const t0 = steps[i] ?? i * 1.4, swap = E.enter(seg(uu, t0, t0 + rs)), w1 = pillWidth(texts[i], size), w0 = i === 0 ? pillH(size) : pillWidth(texts[i - 1], size);
  return { i, text: texts[i], prev: i > 0 ? texts[i - 1] : '', width: lerp(w0, w1, swap), target: w1, k: i === 0 ? E.pop(seg(uu, t0, t0 + rs * 1.2)) : 1, swap };
}
/* the labels (of the wall and the lit pill) with characters the bundled font cannot draw: [{ label, missing: [codepoints] }] */
export function pillWallLint(pIn) {
  const p = obj(pIn), labs = [...list(p.labels, 64), ...list(obj(p.lit).texts, 12)].map((l) => str(l, '', 60)); return labs.map((label) => ({ label, missing: missingGlyphs(label) })).filter((q) => q.missing.length);
}
const PILL = { tags: ['layout', 'wall', 'pills', 'chips', 'scripts', 'languages', 'marquee', 'swap', 'resize', 'placeholder'], dur: 5.0, inF: 10, outF: 9, d: PILL_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, o = alive(L), [bx, by, bw, bh] = boxPx(p.box, PILL_D.box, c), size = num(p.size, 34, 8, 120) * s, gap = num(p.gap, 14, 2, 100) * s, nrows = Math.round(num(p.rows, 7, 1, 12)), labs = list(p.labels, 64).map((l) => str(l, '', 40)).filter(Boolean), seed = num(p.seed, 2, 0, 1e9), scr = num(p.scroll, 60, -3000, 3000) * s * u;
    const ph = pillH(size), rowStep = bh / nrows, ink = hex(p.ink, PILL_D.ink), pf = hex(p.pill, PILL_D.pill), pa = num(p.pillAlpha, 0.2, 0, 1), bg = list(p.bg, 2).map((q) => hex(q, '')).filter(Boolean), cc = Array.isArray(p.center) ? [num(p.center[0], 0.5, 0, 1) * c.W, num(p.center[1], 0.5, 0, 1) * c.H] : [c.W / 2, c.H / 2];
    const st = litState(p, u, size), litW = st.i >= 0 ? st.width : 0, lx0 = cc[0] - litW / 2 - 26 * s, lx1 = cc[0] + litW / 2 + 26 * s, ly0 = cc[1] - ph / 2 - 14 * s, ly1 = cc[1] + ph / 2 + 14 * s;
    let out = `<defs><clipPath id="pw"><rect x="${f2(bx)}" y="${f2(by)}" width="${f2(bw)}" height="${f2(bh)}"/></clipPath>${bg.length >= 2 ? `<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>` : ''}</defs><g opacity="${f2(o)}">`;
    if (bg.length >= 2) out += `<rect x="${f2(bx)}" y="${f2(by)}" width="${f2(bw)}" height="${f2(bh)}" fill="url(#pg)"/>`;
    out += '<g clip-path="url(#pw)">';
    if (labs.length) for (let r = 0; r < nrows; r++) {
      const order = labs.map((l, i) => [hashf(seed, r, i, 5), i, l]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((q) => q[2]), ws = order.map((l) => pillWidth(l, size));
      const total = ws.reduce((a, b) => a + b + gap, 0), dir = r % 2 ? 1 : -1, sp = 0.7 + 0.6 * hashf(seed, r, 6), off = (((scr * dir * sp) % total) + total) % total, cy = by + rowStep * (r + 0.5);
      let x = bx - off - total, n = 0; while (x < bx + bw && n < 200) { for (let i = 0; i < order.length && x < bx + bw; i++) { const w = ws[i]; if (x + w > bx) { const cover = st.i >= 0 && x + w > lx0 && x < lx1 && cy + ph / 2 > ly0 && cy - ph / 2 < ly1;
            out += `<g opacity="${cover ? 0.1 : 1}"><rect x="${f2(x)}" y="${f2(cy - ph / 2)}" width="${f2(w)}" height="${f2(ph)}" rx="${f2(ph / 2)}" fill="${pf}" fill-opacity="${f2(pa)}"/>` + text(order[i], x + w / 2, cy + size * 0.35, { size, weight: 700, fill: ink, anchor: 'middle', op: 0.95 }) + '</g>'; } x += w + gap; n++; } }
    }
    out += '</g>';
    if (st.i >= 0) { const w = st.width, h = ph * (0.7 + 0.3 * clamp(st.k, 0, 1.2)), x = cc[0] - w / 2, y = cc[1] - h / 2, a1 = 1 - E.exit(seg(st.swap, 0, 0.45)), a2 = E.enter(seg(st.swap, 0.35, 0.85));
      out += `<g><rect x="${f2(x - 8 * s)}" y="${f2(y - 8 * s)}" width="${f2(w + 16 * s)}" height="${f2(h + 16 * s)}" rx="${f2((h + 16 * s) / 2)}" fill="#000000" fill-opacity="0.12"/><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(h / 2)}" fill="${hex(p.litFill, PILL_D.litFill)}"/>`;
      const li = hex(p.litInk, PILL_D.litInk); if (st.prev && a1 > 0.02 && st.swap < 0.6) out += text(st.prev, cc[0], cc[1] + size * 0.35, { size, weight: 700, fill: li, anchor: 'middle', op: clamp(a1) * (1 - st.swap) });
      if (st.i === 0 || a2 > 0.02) out += text(st.text, cc[0], cc[1] + size * 0.35, { size, weight: 700, fill: li, anchor: 'middle', op: st.i === 0 ? clamp(st.k) : clamp(a2) }); out += '</g>'; }
    const nt = str(p.note, '', 60); if (nt) out += text(nt, bx + bw / 2, by + bh - 22 * s, { size: 21 * s, weight: 700, fill: '#FFFFFF', anchor: 'middle', op: 0.95 });
    return out + '</g>';
  } };

/* ================================================================ device.lockScreen ================================================================ */
const LOCK_D = { box: [0.2, 0.06, 0.6, 0.88], aspect: 0.46, time: '9:30', date: 'Tuesday', wake: 0.7, openAt: 4.6, rise: 0.7, notifs: [{ at: 1.5, app: 'Chat', text: 'Your order is ready for pickup' }, { at: 2.2, app: 'Tasks', text: 'Review is due today' }, { at: 2.9, app: 'Mail', text: 'New message from Maya Rao' }],
  thread: [{ at: 5.4, from: 'me', text: 'On my way.' }, { at: 6.4, from: 'them', text: 'See you soon.' }], threadTitle: 'Maya Rao', accent: '#3B82F6', bezel: '#0B0C10', label: 'placeholder UI' };
/* the notification stack at local time u: stable order (by `at`, then index), newest on top; y offsets in card heights (each older card is pushed down by every newer one that has arrived) */
export function lockStack(pIn, u) {
  const n = list(obj(pIn).notifs, 6).filter((q) => q && typeof q === 'object').map((q, i) => ({ i, at: num(q.at, 1 + i * 0.7, 0, 1e4), app: str(q.app, 'App', 20), text: str(q.text, '', 60) })).sort((a, b) => a.at - b.at || a.i - b.i);
  return n.filter((q) => u >= q.at).map((q) => { const k = E.pop(seg(u, q.at, q.at + 0.45)); let push = 0; for (const o of n) if (o.at > q.at || (o.at === q.at && o.i > q.i)) push += E.enter(seg(u, o.at, o.at + 0.4)); return { ...q, k, slot: push }; }).sort((a, b) => a.slot - b.slot || b.at - a.at);
}
/* the phone's rectangle in px: `aspect` = width / height, as large as `box` allows, centred in it (both ways) */
export function lockGeo(pIn, c) { const p = obj(pIn), [qx, qy, qw, qh] = boxPx(p.box, LOCK_D.box, c), a = num(p.aspect, 0.46, 0.2, 1.2), w = Math.min(qw, qh * a), h = w / a; return { x: qx + (qw - w) / 2, y: qy + (qh - h) / 2, w, h }; }
const LOCK = { tags: ['device', 'phone', 'lock-screen', 'notifications', 'clock', 'wake', 'message', 'handoff', 'placeholder'], dur: 8.0, inF: 6, outF: 9, d: LOCK_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, o = alive(L), { x: bx, y: by0, w: bw, h: bh } = lockGeo(p, c), rise = num(p.rise, 0.7, 0.05, 10), kr = E.enter(seg(u, 0, rise)), by = by0 + (1 - kr) * (c.H - by0 + 20 * s), R = bw * 0.15, ins = bw * 0.035, sx = bx + ins, sy = by + ins, sw = bw - 2 * ins, sh = bh - 2 * ins, sR = R - ins * 0.6;
    const wake = num(p.wake, 0.7, 0, 1e4), kw = E.move(seg(u, wake, wake + 0.4)), open = num(p.openAt, 4.6, 0, 1e4), ko = E.move(seg(u, open, open + 0.5)), acc = hex(p.accent, LOCK_D.accent), bez = hex(p.bezel, LOCK_D.bezel);
    let out = `<defs><clipPath id="ls"><path d="${rrPath(sx, sy, sw, sh, sR)}"/></clipPath><linearGradient id="lw" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${mixHex(acc, '#0A0B12', 0.55)}"/><stop offset="1" stop-color="#0A0B12"/></linearGradient></defs><g opacity="${f2(o)}">`;
    out += `<path d="${rrPath(bx - 3 * s, by - 3 * s, bw + 6 * s, bh + 6 * s, R + 3 * s)}" fill="#2A2C34"/><path d="${rrPath(bx, by, bw, bh, R)}" fill="${bez}"/><path d="${rrPath(sx, sy, sw, sh, sR)}" fill="#000000"/><g clip-path="url(#ls)">`;
    if (kw > 0.001) {
      out += `<rect x="${f2(sx)}" y="${f2(sy)}" width="${f2(sw)}" height="${f2(sh)}" fill="url(#lw)" opacity="${f2(kw)}"/>`;
      const lockA = (1 - ko) * kw, dy = -ko * sh * 0.22;
      if (lockA > 0.01) { out += `<g opacity="${f2(lockA)}" transform="translate(0 ${f2(dy)})">` + text(str(p.date, '', 24), sx + sw / 2, sy + sh * 0.13, { size: sw * 0.075, weight: 600, fill: '#FFFFFF', anchor: 'middle', op: 0.85 }) + text(str(p.time, '9:30', 8), sx + sw / 2, sy + sh * 0.245, { size: sw * 0.27, weight: 800, fill: '#FFFFFF', anchor: 'middle', extra: 'font-variant-numeric="tabular-nums"' });
        const nh = sh * 0.095, ng = sh * 0.013, top = sy + sh * 0.31; for (const q of lockStack(p, u)) { const y = top + q.slot * (nh + ng) + (1 - clamp(q.k, 0, 1)) * -28 * s, kk = clamp(q.k, 0, 1), icc = mixHex(acc, '#FFFFFF', (hashf(num(p.seed, 1, 0, 1e6), q.i, 3) - 0.5) * 0.6 + 0.2);
          out += `<g opacity="${f2(kk)}"><rect x="${f2(sx + sw * 0.05)}" y="${f2(y)}" width="${f2(sw * 0.9)}" height="${f2(nh)}" rx="${f2(sw * 0.07)}" fill="#FFFFFF" fill-opacity="0.2"/><rect x="${f2(sx + sw * 0.085)}" y="${f2(y + nh * 0.2)}" width="${f2(nh * 0.6)}" height="${f2(nh * 0.6)}" rx="${f2(nh * 0.16)}" fill="${icc}"/>` +
            text((q.app || 'A').charAt(0).toUpperCase(), sx + sw * 0.085 + nh * 0.3, y + nh * 0.6, { size: nh * 0.34, weight: 800, fill: '#FFFFFF', anchor: 'middle' }) + text(q.app, sx + sw * 0.085 + nh * 0.78, y + nh * 0.38, { size: nh * 0.22, weight: 700, fill: '#FFFFFF', op: 0.75 }) +
            text(q.text, sx + sw * 0.085 + nh * 0.78, y + nh * 0.72, { size: nh * 0.215, weight: 600, fill: '#FFFFFF' }) + '</g>'; }
        out += '</g>'; }
      if (ko > 0.01) { const th = list(p.thread, 6).filter((q) => q && typeof q === 'object'), first = lockStack(p, 1e9).sort((a, b) => a.at - b.at || a.i - b.i)[0], hy = sy + sh * 0.02, fs = sw * 0.06;
        out += `<g opacity="${f2(ko)}" transform="translate(0 ${f2((1 - ko) * sh * 0.1)})"><rect x="${f2(sx)}" y="${f2(sy)}" width="${f2(sw)}" height="${f2(sh)}" fill="#12141C"/><rect x="${f2(sx)}" y="${f2(hy)}" width="${f2(sw)}" height="${f2(sh * 0.12)}" fill="#1B1E29"/>` +
          `<circle cx="${f2(sx + sw * 0.5)}" cy="${f2(hy + sh * 0.045)}" r="${f2(sw * 0.045)}" fill="${acc}"/>` + text(str(p.threadTitle, 'Chat', 30), sx + sw / 2, hy + sh * 0.105, { size: fs, weight: 700, fill: '#FFFFFF', anchor: 'middle' });
        let yy = sy + sh * 0.2; const bub = (txt, mine, k) => { const ww = Math.min(sw * 0.74, measure(txt, fs, { weight: 600 }) + fs * 1.6), hh = fs * 2.1, x = mine ? sx + sw * 0.94 - ww : sx + sw * 0.06, cy = yy + hh / 2, kk = clamp(k, 0, 1.1);
          const g = `<g opacity="${f2(clamp(k * 2))}" transform="translate(${f2(x + ww / 2)} ${f2(cy)}) scale(${f2(kk)}) translate(${f2(-(x + ww / 2))} ${f2(-cy)})"><rect x="${f2(x)}" y="${f2(yy)}" width="${f2(ww)}" height="${f2(hh)}" rx="${f2(hh * 0.45)}" fill="${mine ? acc : '#2B2F3D'}"/>` + text(txt, x + ww / 2, yy + hh * 0.64, { size: fs, weight: 600, fill: '#FFFFFF', anchor: 'middle' }) + '</g>'; yy += hh + fs * 0.6; return g; };
        if (first) out += bub(first.text, false, E.pop(seg(u, open + 0.3, open + 0.75)));
        for (const q of th) { const t = num(q.at, open + 1, 0, 1e4), k = E.pop(seg(u, t, t + 0.4)); if (k > 0.001) out += bub(str(q.text, '', 60), q.from !== 'them', k); }
        out += '</g>'; }
    }
    out += `</g><rect x="${f2(bx + bw * 0.36)}" y="${f2(by + ins * 1.1)}" width="${f2(bw * 0.28)}" height="${f2(ins * 1.3)}" rx="${f2(ins * 0.65)}" fill="${bez}"/>`;
    const lb = str(p.label, '', 40); if (lb) out += text(lb, bx + bw / 2, by + bh + 34 * s, { size: 21 * s, weight: 600, fill: '#9AA3B2', anchor: 'middle', op: 0.95 * clamp(kr) });
    return out + '</g>';
  } };

export const R78_WALL_GFX = { 'layout.textWall': WALL, 'layout.pillWall': PILL, 'device.lockScreen': LOCK };
for (const g of Object.values(R78_WALL_GFX)) g.file = 'type/gfx/r78-wall.js';
export const R78_WALL_CUES = {
  'layout.textWall': (p) => { const mu = list(p.multiply, 2), hl = obj(p.highlight); return [{ t: num(mu[0], 0, 0, 1e3), id: 'sfx/ui/pop', why: 'the cards start to multiply' }, { t: num(hl.at, 3, 0, 1e4), id: 'sfx/ui/highlight_draw', why: 'the highlight bar wipes across its line' }]; },
  'layout.pillWall': (p) => { const lit = obj(p.lit), at = num(lit.at, 0.6, 0, 1e4); return list(lit.steps, 12).map((v, i) => ({ t: +(at + num(v, i * 1.4, 0, 1e4)).toFixed(4), id: i === 0 ? 'sfx/ui/pop' : 'sfx/ui/tick', why: i === 0 ? 'the lit pill grows from a dot' : `the lit pill swaps its text and re-sizes (step ${i + 1})` })); },
  'device.lockScreen': (p) => [{ t: num(p.wake, 0.7, 0, 1e4), id: 'sfx/device/unlock', why: 'the screen wakes' }, ...list(p.notifs, 6).filter((q) => q && typeof q === 'object').map((q, i) => ({ t: num(q.at, 1 + i * 0.7, 0, 1e4), id: 'sfx/device/notify_soft', why: `notification ${i + 1} arrives` })),
    { t: num(p.openAt, 4.6, 0, 1e4), id: 'sfx/ui/slide', why: 'the lock layer slides up into the thread' }, ...list(p.thread, 6).filter((q) => q && typeof q === 'object').map((q, i) => ({ t: num(q.at, 5 + i, 0, 1e4), id: q.from === 'them' ? 'sfx/device/message_received' : 'sfx/device/message_sent', why: `thread message ${i + 1}` }))],
};
