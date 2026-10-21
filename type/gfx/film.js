/* motion-pack / type / gfx / film.js: film, trailer and title-sequence type (2026-10-16, film lane). Same gfx contract as every part (core.js):
   { tags, dur, inF, outF, d, svg(L, p, c) } -> SVG markup, a pure function of t (no module state, no caches; any frame in any seek order).
   Craft learned from how trailers and title sequences are built (docs/evidence/film-trailer-craft.md): original layouts only, NO studio logo, rating-board mark,
   real title, real billing, real review or copied design. Every default name is a labelled placeholder.
     title.trailerSlab        slab metallic: heavy caps in a steel gradient with an edge bevel and one specular sweep; arrives BY CUT (no fade), leaves on a fade
     title.trailerThin        thin-wide tracking: weight 200 caps whose tracking keeps opening through the hold, hairline rules either side, blur-in
     title.trailerDistressed  distressed print: seeded turbulence erodes and displaces the letters, re-seeded 12 times a second (the print "boils"), a gate jitter
     title.trailerGlow        glow-through: the letters are windows onto a light that rises behind them, a bloom bleeds out, an outline holds the shapes
     title.trailerCut         cut in half: two halves clipped along a tilted slice line slide together and lock with a seam flash (or part on the way out)
     credits.billingBlock     the condensed billing block: role words small, names tall, each line justified to one width (SVG textLength squeezes the glyphs:
                              Manrope compressed, i.e. a SYNTHETIC condensed face; pass font: a real condensed OFL family if you have one); placeholder names, labelled
     credits.roll             end-credits roll: section heads + role / name pairs scrolling at a constant speed, edge fades, two columns about a centre gutter
     card.fromTheMakers       "from the makers of" + a work: the work is YOUR claim, so the default prints a placeholder label until you name a real one (placeholder: false)
     card.releaseDate         the date card: a big line (a date or "COMING SOON"), a small line above, the url below; placeholder: true prints "placeholder date"
     card.quote               a pull quote ONLY with a source: a blank source renders a red "needs a source" card instead of the quote (no invented reviews; no stars)
     card.production          a generic production card for YOUR company name: an original six-blade aperture mark that opens, the name, "presents", a light sweep
     card.scene               a scene slug ("INT. RELAY STATION - NIGHT") typed on in mono with a cursor, an optional title under it
     caption.filmSubtitle     dialogue subtitles: one or two lines, white with a dark outline and shadow, bottom of the picture, a 3-frame fade; speaker tag optional
     title.filmChapter        a chapter title: a spaced kicker, a serif title (STIX Two Text), a hairline, soft rise
     title.namesOver          opening-title names over picture: a small role over a large name, `style` drift | type | slam | split | flicker | glow, `pos` anywhere in the safe rect
   Sizes come from the SHORTER frame side (16:9 and 9:16 read the same), every line is fitted to the safe width, every numeric param is clamped. */
import { E, clamp, lerp, seg, f2, esc, measure, FONT, MONO, PAPER, hashf } from './core.js';

const SERIF = "'STIX Two Text', 'Times New Roman', Times, serif";
const RED = '#E5484D';
const sc = (c) => Math.min(c.W, c.H) / 1080;
const num = (v, d, lo = -1e6, hi = 1e6) => { const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? +v : NaN; return Number.isFinite(x) ? clamp(x, lo, hi) : d; };
const str = (v, d = '', max = 160) => (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : d);
const hex = (v, d) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : d);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const POS = (c, pos, w, h, padY = 0) => { const S0 = c.safe, py = num(padY, 0, 0, c.H / 3), S = { x0: S0.x0, x1: S0.x1, y0: Math.max(S0.y0, py), y1: Math.min(S0.y1, c.H - py) }; if (Array.isArray(pos)) return [num(pos[0], 0.5, -1, 2) * c.W - w / 2, num(pos[1], 0.5, -1, 2) * c.H - h / 2];
  const x = pos.includes('l') ? S.x0 : pos.includes('r') ? S.x1 - w : (S.x0 + S.x1 - w) / 2, y = pos.startsWith('t') ? S.y0 : pos.startsWith('b') ? S.y1 - h : (S.y0 + S.y1 - h) / 2; return [x, y]; };
const fade = (L) => E.soft(L.in) * (1 - E.exit(L.out));
/* fit a single line: the largest size <= want (px) whose measured width (plus tracking in em) fits maxW */
function fit(s, want, maxW, { weight = 800, font = FONT, ls = 0 } = {}) { const w1 = measure(s, 100, { weight, font }) / 100 + ls * Math.max(0, s.length - 1); return Math.max(8, Math.min(want, maxW / Math.max(0.05, w1))); }
const tx = (s, x, y, size, { weight = 800, fill = PAPER, anchor = 'middle', font = FONT, ls = 0, op = 1, extra = '' } = {}) =>
  `<text x="${f2(x)}" y="${f2(y)}" font-family="${esc(font)}" font-size="${f2(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${f2(ls)}"${op < 1 ? ` opacity="${f2(Math.max(0, op))}"` : ''} ${extra}>${esc(s)}</text>`;
const label = (c, s, txt, y = null) => tx(txt, c.W / 2, y ?? c.safe.y1 - 8 * s, Math.max(24, (c.tall ? 30 : 28) * s), { weight: 600, font: MONO, fill: 'rgba(255,255,255,0.7)', ls: 1.5 * s });   // honesty labels: 28 px on 16:9, 30 px on 9:16 (frame-design)
const refuse = (c, s, msg) => { const w = 760 * s, h = 150 * s, x = c.W / 2 - w / 2, y = c.H / 2 - h / 2;
  return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(16 * s)}" fill="#FFFFFF" stroke="${RED}" stroke-width="${f2(3 * s)}"/>` +
    tx('needs a source', c.W / 2, y + 62 * s, 40 * s, { fill: RED }) + tx(msg, c.W / 2, y + 108 * s, 24 * s, { weight: 600, fill: '#16151B' }); };
/* the title's own frame size: text, sub line, the fitted size, its baseline at the frame's optical centre (slightly above the middle) */
function titleGeo(p, c, { weight = 800, font = FONT, ls = 0 } = {}) {
  const s = sc(c), S = c.safe, maxW = (S.x1 - S.x0) * num(p.width, 0.9, 0.2, 1), t = str(p.text, 'TITLE').toUpperCase(), fs = fit(t, num(p.size, 190, 20, 600) * s, maxW, { weight, font, ls: ls });
  return { s, t, fs, cx: c.W / 2, cy: c.H * num(p.y, 0.5, 0, 1) + fs * 0.34, maxW };
}
const subLine = (p, g, op = 1, fill = 'rgba(255,255,255,0.86)') => (str(p.sub) ? tx(str(p.sub).toUpperCase(), g.cx, g.cy - g.fs * 1.02, Math.max(18, g.fs * 0.17), { weight: 600, fill, ls: g.fs * 0.06, op }) : '');

/* ============================================================== titles ============================================================== */
const SLAB_D = { text: 'THE LAST SIGNAL', sub: '', size: 190, width: 0.9, y: 0.5, steel: ['#2A2E35', '#E8ECF1', '#8A919B', '#22262C', '#C8CDD5'], edge: '#FFFFFF', sweepAt: 0.25, sweepDur: 1.2, shadow: 0.6 };
const TITLES = {
  'title.trailerSlab': { tags: ['title', 'trailer', 'metallic', 'slab', 'film'], dur: 3, inF: 2, outF: 12, d: SLAB_D,
    svg(L, p, c) { const g = titleGeo(p, c, { weight: 800, ls: 0.04 }), k = 1 - E.exit(L.out), sc0 = lerp(1.045, 1, E.enter(seg(L.u, 0, 0.35))), st = list(p.steel, 5).map((v, i) => hex(v, SLAB_D.steel[i]));
      const y0 = g.cy - g.fs * 0.76, y1 = g.cy + g.fs * 0.06, sw = seg(L.u, num(p.sweepAt, 0.25, 0, 30), num(p.sweepAt, 0.25, 0, 30) + num(p.sweepDur, 1.2, 0.05, 30)), half = g.maxW * 0.62, sx = lerp(g.cx - half - g.fs, g.cx + half + g.fs, E.move(sw));
      const ls = g.fs * 0.04, T = (fill, extra = '') => tx(g.t, g.cx, g.cy, g.fs, { weight: 800, fill, ls, extra });
      return `<defs><linearGradient id="m" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(y0)}" x2="0" y2="${f2(y1)}">${st.map((v, i) => `<stop offset="${[0, 0.38, 0.52, 0.64, 1][i]}" stop-color="${v}"/>`).join('')}</linearGradient>` +
        `<linearGradient id="e" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(y0)}" x2="0" y2="${f2(y1)}"><stop offset="0" stop-color="${hex(p.edge, '#FFFFFF')}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${hex(p.edge, '#FFFFFF')}" stop-opacity="0.15"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></linearGradient>` +
        `<linearGradient id="w" gradientUnits="userSpaceOnUse" x1="${f2(sx - g.fs * 0.9)}" y1="0" x2="${f2(sx + g.fs * 0.9)}" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="${sw > 0 && sw < 1 ? 0.85 : 0}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>` +
        `<filter id="d" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="${f2(g.fs * 0.05)}"/><feOffset dy="${f2(g.fs * 0.03)}" result="b"/><feFlood flood-color="#000000" flood-opacity="${f2(num(p.shadow, 0.6, 0, 1))}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
        `<g opacity="${f2(k)}" transform="translate(${f2(g.cx)} ${f2(g.cy - g.fs * 0.35)}) scale(${sc0.toFixed(4)}) translate(${f2(-g.cx)} ${f2(-(g.cy - g.fs * 0.35))})">` + subLine(p, g) +
        `<g filter="url(#d)">${T('url(#m)', `stroke="url(#e)" stroke-width="${f2(Math.max(1, g.fs * 0.012))}" paint-order="stroke"`)}</g>${T('url(#w)')}</g>`; } },
  'title.trailerThin': { tags: ['title', 'trailer', 'thin', 'tracking', 'scifi', 'elegant'], dur: 3.5, inF: 18, outF: 14, d: { text: 'THE LAST SIGNAL', sub: '', size: 120, width: 0.92, y: 0.5, color: '#F2F4F7', track: [0.32, 0.5], rules: true },
    svg(L, p, c) { const tr = list(p.track, 2), t0 = num(tr[0], 0.32, 0, 3), t1 = num(tr[1], 0.5, 0, 3), u = clamp(L.u / Math.max(0.1, L.total)), ls = lerp(t0, t1, E.sine(u));
      const g = titleGeo(p, c, { weight: 200, ls: t1 }), k = fade(L), blur = (1 - E.enter(L.in)) * g.fs * 0.06, col = hex(p.color, '#F2F4F7'), w = measure(g.t, g.fs, { weight: 200 }) + ls * g.fs * (g.t.length - 1);
      const rl = p.rules !== false ? [-1, 1].map((sd) => `<rect x="${f2(sd < 0 ? g.cx - w / 2 - g.fs * 0.35 - g.fs * 1.2 * E.enter(L.in) : g.cx + w / 2 + g.fs * 0.35)}" y="${f2(g.cy - g.fs * 0.36)}" width="${f2(g.fs * 1.2 * E.enter(L.in))}" height="${f2(Math.max(1, g.fs * 0.012))}" fill="${col}" opacity="${f2(k * 0.7)}"/>`).join('') : '';
      return `<defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${f2(blur)}"/></filter></defs>` + subLine(p, g, k) + rl +
        `<g${blur > 0.05 ? ' filter="url(#b)"' : ''}>${tx(g.t, g.cx + ls * g.fs * 0.5, g.cy, g.fs, { weight: 200, fill: col, ls: ls * g.fs, op: k })}</g>`; } },
  'title.trailerDistressed': { tags: ['title', 'trailer', 'distressed', 'horror', 'grunge', 'print'], dur: 3, inF: 6, outF: 10, d: { text: 'THE LAST SIGNAL', sub: '', size: 180, width: 0.9, y: 0.5, color: '#E9E2D2', wear: 0.5, boil: 12, jitter: 1.2, seed: 7 },
    svg(L, p, c) { const g = titleGeo(p, c, { weight: 800, ls: 0.02 }), k = fade(L), fr = Math.floor(L.u * num(p.boil, 12, 0, 30)), sd = (Math.round(num(p.seed, 7, 0, 1e6)) + fr * 7) % 9973, wear = num(p.wear, 0.5, 0, 1);
      const jx = (hashf(fr, 1) - 0.5) * 2 * num(p.jitter, 1.2, 0, 20) * g.s, jy = (hashf(fr, 2) - 0.5) * 2 * num(p.jitter, 1.2, 0, 20) * g.s, fl = 0.86 + 0.14 * hashf(fr, 3);
      const bf = (0.9 / g.fs).toFixed(5), thr = (0.38 + 0.3 * wear).toFixed(3);
      return `<defs><filter id="r" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="${bf} ${bf}" numOctaves="3" seed="${sd}" result="n"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="n" scale="${f2(g.fs * 0.03)}" xChannelSelector="R" yChannelSelector="G" result="dis"/>` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(4 / g.fs).toFixed(5)}" numOctaves="2" seed="${sd + 1}" result="n2"/>` +
        `<feColorMatrix in="n2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 ${f2(9 * (+thr) + 1)}" result="m"/>` +
        `<feComposite in="dis" in2="m" operator="in"/></filter></defs>` + subLine(p, g, k * fl) +
        `<g filter="url(#r)" transform="translate(${f2(jx)} ${f2(jy)})">${tx(g.t, g.cx, g.cy, g.fs, { weight: 800, fill: hex(p.color, '#E9E2D2'), ls: g.fs * 0.02, op: k * fl })}</g>`; } },
  'title.trailerGlow': { tags: ['title', 'trailer', 'glow', 'light', 'drama', 'epic'], dur: 3.5, inF: 20, outF: 14, d: { text: 'THE LAST SIGNAL', sub: '', size: 170, width: 0.9, y: 0.5, light: '#FFF2D6', glow: '#FF9A3C', rise: 1.4, bloom: 0.7, outline: 0.35 },
    svg(L, p, c) { const g = titleGeo(p, c, { weight: 800, ls: 0.03 }), k = fade(L), r = E.hero(seg(L.u, 0, num(p.rise, 1.4, 0.1, 20))), ly = lerp(g.cy + g.fs * 1.6, g.cy - g.fs * 0.35, r), rad = lerp(g.fs * 0.8, g.maxW * 0.7, r);
      const T = (fill, extra = '') => tx(g.t, g.cx, g.cy, g.fs, { weight: 800, fill, ls: g.fs * 0.03, extra }), gl = hex(p.glow, '#FF9A3C'), li = hex(p.light, '#FFF2D6');
      return `<defs><radialGradient id="lg" gradientUnits="userSpaceOnUse" cx="${f2(g.cx)}" cy="${f2(ly)}" r="${f2(rad)}"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="${li}"/><stop offset="0.75" stop-color="${gl}"/><stop offset="1" stop-color="${gl}" stop-opacity="0.08"/></radialGradient>` +
        `<mask id="tm" maskUnits="userSpaceOnUse" x="0" y="0" width="${c.W}" height="${c.H}">${T('#FFFFFF')}</mask><filter id="gb" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${f2(g.fs * 0.16)}"/></filter></defs>` +
        `<g opacity="${f2(k)}">` + subLine(p, g) + `<g filter="url(#gb)" opacity="${f2(num(p.bloom, 0.7, 0, 1) * r)}">${T(gl)}</g>` +
        `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="url(#lg)" mask="url(#tm)"/>${T('none', `stroke="#FFFFFF" stroke-opacity="${f2(num(p.outline, 0.35, 0, 1))}" stroke-width="${f2(Math.max(1, g.fs * 0.008))}"`)}</g>`; } },
  'title.trailerCut': { tags: ['title', 'trailer', 'cut', 'split', 'slice', 'action', 'noir'], dur: 3, inF: 14, outF: 12, d: { text: 'THE LAST SIGNAL', sub: '', size: 190, width: 0.9, y: 0.5, color: '#F4F4F4', angle: -7, gap: 0.5, seam: '#FFFFFF', open: false },
    svg(L, p, c) { const g = titleGeo(p, c, { weight: 800, ls: 0.03 }), k = fade(L), a = num(p.angle, -7, -45, 45) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), mid = g.cy - g.fs * 0.36;
      const close = E.hero(L.in), part = p.open ? E.exit(L.out) : 0, off = (1 - close + part) * g.fs * num(p.gap, 0.5, 0, 4), dx = ca * off, dy = sa * off, R = c.W * 2;
      const poly = (sd) => { const nx = -sa * sd, ny = ca * sd; return `${f2(g.cx - ca * R)},${f2(mid - sa * R)} ${f2(g.cx + ca * R)},${f2(mid + sa * R)} ${f2(g.cx + ca * R + nx * R)},${f2(mid + sa * R + ny * R)} ${f2(g.cx - ca * R + nx * R)},${f2(mid - sa * R + ny * R)}`; };
      const T = tx(g.t, g.cx, g.cy, g.fs, { weight: 800, fill: hex(p.color, '#F4F4F4'), ls: g.fs * 0.03 }), flash = seg(L.u, 10 / 30, 14 / 30) * (1 - seg(L.u, 14 / 30, 24 / 30));   // the seam flashes as the halves lock
      return `<defs><clipPath id="up"><polygon points="${poly(-1)}"/></clipPath><clipPath id="dn"><polygon points="${poly(1)}"/></clipPath></defs><g opacity="${f2(k)}">` + subLine(p, g) +
        `<g clip-path="url(#up)"><g transform="translate(${f2(-dx)} ${f2(-dy)})">${T}</g></g><g clip-path="url(#dn)"><g transform="translate(${f2(dx)} ${f2(dy)})">${T}</g></g>` +
        `<line x1="${f2(g.cx - ca * g.maxW * 0.55)}" y1="${f2(mid - sa * g.maxW * 0.55)}" x2="${f2(g.cx + ca * g.maxW * 0.55)}" y2="${f2(mid + sa * g.maxW * 0.55)}" stroke="${hex(p.seam, '#FFFFFF')}" stroke-width="${f2(Math.max(1, g.fs * 0.02))}" opacity="${f2(flash)}"/></g>`; } },
};

/* ============================================================== credits ============================================================== */
const BILL_D = { lines: [[['', 'ORBIT PICTURES'], ['presents', ''], ['a', 'PLACEHOLDER'], ['production', '']], [['', 'LEAD ONE'], ['', 'LEAD TWO'], ['', 'LEAD THREE'], ['', 'LEAD FOUR']],
  [['', '"THE LAST SIGNAL"'], ['music by', 'COMPOSER NAME'], ['edited by', 'EDITOR NAME']], [['director of photography', 'DP NAME'], ['production designer', 'DESIGNER NAME']],
  [['written by', 'WRITER NAME'], ['produced by', 'PRODUCER NAME'], ['directed by', 'DIRECTOR NAME']]],
  width: 0.62, y: 0.62, color: '#DADDE2', squeeze: 0.56, big: 58, small: 0.42, font: null, note: 'placeholder credits · fictional names' };
function billLine(row, x, y, w, big, small, squeeze, col, font) {
  const toks = row.flatMap(([r, n]) => [r ? [r.toUpperCase(), big * small, 400] : null, n ? [n.toUpperCase(), big, 600] : null].filter(Boolean));
  const nat = toks.reduce((a, [s, sz, wt]) => a + measure(s + ' ', sz, { weight: wt, font }), 0), tl = Math.min(w, nat * squeeze * 1.0001) > 0 ? w : nat;
  return `<text x="${f2(x)}" y="${f2(y)}" font-family="${esc(font)}" fill="${col}" textLength="${f2(tl)}" lengthAdjust="spacingAndGlyphs">${toks.map(([s, sz, wt]) => `<tspan font-size="${f2(sz)}" font-weight="${wt}">${esc(s)} </tspan>`).join('')}</text>`;
}
const CREDITS = {
  'credits.billingBlock': { tags: ['credits', 'billing', 'trailer', 'poster', 'condensed'], dur: 4, inF: 10, outF: 10, d: BILL_D,
    svg(L, p, c) { const s = sc(c), S = c.safe, w = (S.x1 - S.x0) * num(p.width, 0.62, 0.2, 1) * (c.tall ? 1.35 : 1), x = c.W / 2 - Math.min(w, S.x1 - S.x0) / 2, ww = Math.min(w, S.x1 - S.x0), k = fade(L);
      const rows = list(p.lines, 12).map((r) => list(r, 8).map((q) => [str(Array.isArray(q) ? q[0] : '', '', 40), str(Array.isArray(q) ? q[1] : '', '', 60)])), big = num(p.big, 52, 8, 200) * s, sm = num(p.small, 0.42, 0.2, 1);
      const font = str(p.font) || FONT, col = hex(p.color, '#DADDE2'), lh = big * 1.08, y0 = c.H * num(p.y, 0.62, 0, 1) - (rows.length * lh) / 2 + big * 0.8;
      return `<g opacity="${f2(k)}">${rows.map((r, i) => billLine(r, x, y0 + i * lh, ww, big, sm, num(p.squeeze, 0.56, 0.2, 1), col, font)).join('')}` +
        (str(p.note) ? label(c, s, str(p.note), y0 + rows.length * lh + big * 0.6) : '') + '</g>'; } },
  'credits.roll': { tags: ['credits', 'roll', 'end-credits', 'film', 'short-film'], dur: 8, inF: 6, outF: 12, d: { items: [{ head: 'CAST' }, ['The operator', 'PLACEHOLDER NAME'], ['The voice', 'PLACEHOLDER NAME'], { head: 'CREW' }, ['Written and directed by', 'PLACEHOLDER NAME'], ['Music', 'motion-pack (synthesised)'], ['Picture', 'motion-pack placeholder plates'], { head: '' }, ['A fictional film', 'placeholder credits']],
      speed: 70, size: 34, color: '#E8E8EC', head: '#9AA3AE', gap: 1.9, startY: 1.0, edge: 0.12 },
    svg(L, p, c) { const s = sc(c), sz = num(p.size, 34, 8, 120) * s, lh = sz * num(p.gap, 1.9, 1, 4), y0 = c.H * num(p.startY, 1.0, -2, 3) - num(p.speed, 70, 0, 2000) * s * Math.max(0, L.u), k = fade(L), it = list(p.items, 200), cx = c.W / 2, g = sz * 0.6;
      const e = num(p.edge, 0.12, 0, 0.45), parts = []; let y = y0;
      for (const q of it) { if (y > c.H + lh) break; if (y > -lh) { if (q && !Array.isArray(q) && typeof q === 'object') { if (str(q.head)) parts.push(tx(str(q.head).toUpperCase(), cx, y, sz * 0.8, { weight: 700, fill: hex(p.head, '#9AA3AE'), ls: sz * 0.25 })); }
          else if (Array.isArray(q)) { parts.push(tx(str(q[0]), cx - g, y, sz * 0.82, { weight: 400, fill: hex(p.head, '#9AA3AE'), anchor: 'end' }), tx(str(q[1]), cx + g, y, sz, { weight: 700, fill: hex(p.color, '#E8E8EC'), anchor: 'start' })); } }
        y += q && !Array.isArray(q) && typeof q === 'object' ? lh * 1.5 : lh; }
      return `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF" stop-opacity="0"/><stop offset="${f2(e)}" stop-color="#FFF"/><stop offset="${f2(1 - e)}" stop-color="#FFF"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/></linearGradient>` +
        `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${c.W}" height="${c.H}"><rect width="${c.W}" height="${c.H}" fill="url(#f)"/></mask></defs><g mask="url(#m)" opacity="${f2(k)}">${parts.join('')}</g>`; } },
};

/* ============================================================== cards ============================================================== */
function aperture(cx, cy, r, open, rot, col, sw) {   // six blades around a ring; open 0 = closed iris, 1 = wide open
  const n = 6, ri = r * lerp(0.08, 0.62, clamp(open)), out = [];
  for (let i = 0; i < n; i++) { const a0 = rot + (i / n) * Math.PI * 2, a1 = a0 + Math.PI * 2 / n, p0 = [cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri], p1 = [cx + Math.cos(a0 + 0.9) * r, cy + Math.sin(a0 + 0.9) * r], p2 = [cx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri];
    out.push(`<path d="M${f2(p0[0])} ${f2(p0[1])} L${f2(p1[0])} ${f2(p1[1])} L${f2(p2[0])} ${f2(p2[1])}" fill="none" stroke="${col}" stroke-width="${f2(sw)}" stroke-linejoin="round"/>`); }
  return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" fill="none" stroke="${col}" stroke-width="${f2(sw)}"/>` + out.join('');
}
const CARDS = {
  'card.fromTheMakers': { tags: ['card', 'trailer', 'makers', 'pedigree'], dur: 2.6, inF: 12, outF: 10, d: { kicker: 'FROM THE MAKERS OF', work: 'YOUR PREVIOUS FILM', placeholder: true, color: '#EDEFF2', size: 96 },
    svg(L, p, c) { const s = sc(c), S = c.safe, k = fade(L), wk = str(p.work, 'YOUR PREVIOUS FILM').toUpperCase(), fs = fit(wk, num(p.size, 96, 10, 400) * s, (S.x1 - S.x0) * 0.86, { weight: 800, ls: 0.03 }), cy = c.H / 2;
      return `<g opacity="${f2(k)}">` + tx(str(p.kicker, 'FROM THE MAKERS OF').toUpperCase(), c.W / 2, cy - fs * 0.85, Math.max(18, fs * 0.3), { weight: 300, fill: hex(p.color, '#EDEFF2'), ls: fs * 0.12 }) +
        tx(wk, c.W / 2, cy + fs * 0.35 + (1 - E.enter(L.in)) * 14 * s, fs, { weight: 800, fill: hex(p.color, '#EDEFF2'), ls: fs * 0.03 }) +
        (p.placeholder !== false ? label(c, s, 'placeholder · name a work you really made', cy + fs * 1.3) : '') + '</g>'; } },
  'card.releaseDate': { tags: ['card', 'trailer', 'date', 'release', 'end-card'], dur: 3, inF: 4, outF: 12, d: { top: '', date: 'COMING SOON', url: '', placeholder: false, color: '#F3F4F6', accent: '#FFFFFF', size: 150 },
    svg(L, p, c) { const s = sc(c), S = c.safe, k = 1 - E.exit(L.out), dt = str(p.date, 'COMING SOON').toUpperCase(), fs = fit(dt, num(p.size, 150, 10, 500) * s, (S.x1 - S.x0) * 0.9, { weight: 800, ls: 0.06 }), cy = c.H / 2 + fs * 0.32;
      const sw = seg(L.u, 0.1, 1.1), x = lerp(c.W * 0.2, c.W * 0.8, E.move(sw));
      return `<defs><linearGradient id="s" gradientUnits="userSpaceOnUse" x1="${f2(x - fs)}" y1="0" x2="${f2(x + fs)}" y2="0"><stop offset="0" stop-color="${hex(p.color, '#F3F4F6')}"/><stop offset="0.5" stop-color="${hex(p.accent, '#FFFFFF')}"/><stop offset="1" stop-color="${hex(p.color, '#F3F4F6')}"/></linearGradient></defs><g opacity="${f2(k)}">` +
        (str(p.top) ? tx(str(p.top).toUpperCase(), c.W / 2, cy - fs * 1.05, Math.max(18, fs * 0.22), { weight: 300, fill: hex(p.color, '#F3F4F6'), ls: fs * 0.1 }) : '') +
        tx(dt, c.W / 2, cy, fs, { weight: 800, fill: 'url(#s)', ls: fs * 0.06 }) + (str(p.url) ? tx(str(p.url), c.W / 2, cy + fs * 0.62, Math.max(18, fs * 0.2), { weight: 600, font: MONO, fill: 'rgba(255,255,255,0.8)', ls: 1.5 * s }) : '') +
        (p.placeholder ? label(c, s, 'placeholder date', cy + fs * (str(p.url) ? 1.0 : 0.7)) : '') + '</g>'; } },
  'card.quote': { tags: ['card', 'trailer', 'quote', 'press', 'source-required'], dur: 2.8, inF: 10, outF: 10, d: { quote: 'PLACEHOLDER QUOTE: REPLACE WITH A REAL, ATTRIBUTED LINE', source: 'placeholder source', color: '#F1F1F1', size: 72 },
    svg(L, p, c) { const s = sc(c), S = c.safe, k = fade(L), src = str(p.source).trim(); if (!src) return `<g opacity="${f2(k)}">${refuse(c, s, 'card.quote prints a quote only beside its source')}</g>`;
      const q = str(p.quote, '', 220).toUpperCase(), words = q.split(/\s+/), maxW = (S.x1 - S.x0) * 0.8, fs0 = num(p.size, 72, 10, 300) * s, lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (measure(t2, fs0, { weight: 700 }) > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; } if (cur) lines.push(cur);
      const ls = lines.slice(0, 4), fs = Math.min(fs0, ...ls.map((l) => fit(l, fs0, maxW, { weight: 700 }))), y0 = c.H / 2 - (ls.length - 1) * fs * 0.6;
      return `<g opacity="${f2(k)}">${ls.map((l, i) => tx((i === 0 ? '“' : '') + l + (i === ls.length - 1 ? '”' : ''), c.W / 2, y0 + i * fs * 1.2, fs, { weight: 700, fill: hex(p.color, '#F1F1F1') })).join('')}` +
        tx('— ' + src.toUpperCase(), c.W / 2, y0 + ls.length * fs * 1.2 + fs * 0.25, Math.max(20, fs * 0.36), { weight: 600, font: MONO, fill: 'rgba(255,255,255,0.75)', ls: 2 * s }) + '</g>'; } },
  'card.production': { tags: ['card', 'production', 'company', 'presents', 'trailer'], dur: 3, inF: 18, outF: 12, d: { name: 'ORBIT PICTURES', line: 'PRESENTS', color: '#ECEEF2', accent: '#9FD3FF', size: 74, mark: true },
    svg(L, p, c) { const s = sc(c), S = c.safe, k = fade(L), nm = str(p.name, 'ORBIT PICTURES').toUpperCase(), fs = fit(nm, num(p.size, 74, 10, 300) * s, (S.x1 - S.x0) * 0.8, { weight: 300, ls: 0.3 }), cy = c.H / 2, col = hex(p.color, '#ECEEF2');
      const op = E.hero(seg(L.u, 0.1, 1.3)), r = fs * 0.95, my = cy - fs * 1.15, sw = seg(L.u, 0.6, 1.8), sx = lerp(c.W / 2 - fs * 6, c.W / 2 + fs * 6, E.move(sw)), ls = fs * lerp(0.42, 0.3, E.enter(L.in));
      return `<defs><linearGradient id="s" gradientUnits="userSpaceOnUse" x1="${f2(sx - fs * 2)}" y1="0" x2="${f2(sx + fs * 2)}" y2="0"><stop offset="0" stop-color="${col}"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="${col}"/></linearGradient></defs><g opacity="${f2(k)}">` +
        (p.mark !== false ? aperture(c.W / 2, my, r, op, -op * 0.9, hex(p.accent, '#9FD3FF'), Math.max(1.5, fs * 0.035)) : '') +
        tx(nm, c.W / 2 + ls * 0.5, cy + fs * 0.62, fs, { weight: 300, fill: 'url(#s)', ls }) + (str(p.line) ? tx(str(p.line).toUpperCase(), c.W / 2, cy + fs * 1.55, Math.max(16, fs * 0.3), { weight: 600, fill: col, ls: fs * 0.18, op: seg(L.u, 0.7, 1.2) }) : '') + '</g>'; } },
  'card.scene': { tags: ['card', 'scene', 'slug', 'short-film', 'screenplay'], dur: 2.6, inF: 2, outF: 10, d: { slug: 'INT. RELAY STATION - NIGHT', title: '', cps: 28, pos: 'bl', color: '#F2F2F2', size: 40, padY: 0 },
    svg(L, p, c) { const s = sc(c), k = 1 - E.exit(L.out), sl = str(p.slug, 'INT. ROOM - NIGHT', 80).toUpperCase(), n = Math.min(sl.length, Math.floor(Math.max(0, L.u) * num(p.cps, 28, 1, 400))), fs = fit(sl, num(p.size, 40, 8, 160) * s, (c.safe.x1 - c.safe.x0) * 0.9, { weight: 600, font: MONO, ls: 0.06 });
      const w = measure(sl, fs, { weight: 600, font: MONO }) + fs * 0.06 * sl.length, ti = str(p.title), h = fs * (ti ? 2.6 : 1.2), [x, y] = POS(c, typeof p.pos === 'string' ? p.pos : Array.isArray(p.pos) ? p.pos : 'bl', w, h, p.padY), cur = Math.floor(L.u * 2.5) % 2 === 0 && n < sl.length + 4;
      const shown = sl.slice(0, n), cw = measure(shown, fs, { weight: 600, font: MONO }) + fs * 0.06 * shown.length;
      return `<g opacity="${f2(k)}">${tx(shown, x, y + fs, fs, { weight: 600, font: MONO, fill: hex(p.color, '#F2F2F2'), anchor: 'start', ls: fs * 0.06 })}` +
        (cur ? `<rect x="${f2(x + cw + fs * 0.1)}" y="${f2(y + fs * 0.12)}" width="${f2(fs * 0.55)}" height="${f2(fs * 1.0)}" fill="${hex(p.color, '#F2F2F2')}" opacity="0.85"/>` : '') +
        (ti ? tx(ti, x, y + fs * 2.4, fs * 1.1, { weight: 700, fill: hex(p.color, '#F2F2F2'), anchor: 'start', op: seg(L.u, sl.length / num(p.cps, 28, 1, 400), sl.length / num(p.cps, 28, 1, 400) + 0.4) }) : '') + '</g>'; } },
};

/* ============================================================== subtitles, chapters, names ============================================================== */
function wrap2(s, maxChars) { const w = s.split(/\s+/).filter(Boolean); if (s.length <= maxChars) return [s]; let best = [s], bd = 1e9;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), d = Math.max(a.length, b.length); if (d < bd) { bd = d; best = [a, b]; } } return best; }
const TEXTS = {
  'caption.filmSubtitle': { tags: ['subtitle', 'dialogue', 'caption', 'film', 'short-film', 'trailer'], dur: 2.2, inF: 3, outF: 3, d: { text: 'Relay North, do you copy?', speaker: '', y: 0.86, size: 44, maxChars: 42, color: '#FFFFFF', outline: '#000000', italic: false },
    svg(L, p, c) { const s = sc(c), k = fade(L), fs = num(p.size, 44, 10, 160) * s * (c.tall ? 1.35 : 1), lines = wrap2(str(p.text, '', 140), Math.round(num(p.maxChars, 42, 8, 120) / (c.tall ? 1.6 : 1))), lh = fs * 1.22;
      const yb = Math.min(c.safe.y1 - fs * 0.3, c.H * num(p.y, 0.86, 0, 1)), y0 = yb - (lines.length - 1) * lh, sp = str(p.speaker), ol = hex(p.outline, '#000000');
      const T = (l, y) => tx(l, c.W / 2, y, fs, { weight: 600, fill: hex(p.color, '#FFFFFF'), extra: `stroke="${ol}" stroke-width="${f2(fs * 0.11)}" stroke-linejoin="round" paint-order="stroke"${p.italic ? ' font-style="italic"' : ''}` });
      return `<defs><filter id="sh" x="-5%" y="-30%" width="110%" height="160%"><feDropShadow dx="0" dy="${f2(fs * 0.05)}" stdDeviation="${f2(fs * 0.08)}" flood-color="#000" flood-opacity="0.55"/></filter></defs><g filter="url(#sh)" opacity="${f2(k)}">` +
        (sp ? tx(sp.toUpperCase(), c.W / 2, y0 - lh * 0.8, fs * 0.5, { weight: 700, font: MONO, fill: 'rgba(255,255,255,0.8)', ls: fs * 0.08 }) : '') + lines.map((l, i) => T(l, y0 + i * lh)).join('') + '</g>'; } },
  'title.filmChapter': { tags: ['title', 'chapter', 'short-film', 'serif', 'film'], dur: 2.6, inF: 18, outF: 14, d: { kicker: 'CHAPTER ONE', title: 'The night shift', color: '#F4EFE6', rule: '#C9A46A', size: 96, bg: null },
    svg(L, p, c) { const s = sc(c), k = fade(L), ti = str(p.title, 'Untitled'), fs = fit(ti, num(p.size, 96, 10, 400) * s, (c.safe.x1 - c.safe.x0) * 0.86, { weight: 400, font: SERIF }), cy = c.H / 2, rw = fs * 2.2 * E.hero(seg(L.u, 0.1, 0.8));
      return (hex(p.bg, null) ? `<rect width="${c.W}" height="${c.H}" fill="${hex(p.bg, '#000000')}" opacity="${f2(k)}"/>` : '') + `<g opacity="${f2(k)}">` +
        tx(str(p.kicker, '').toUpperCase(), c.W / 2, cy - fs * 0.9, Math.max(18, fs * 0.24), { weight: 600, fill: hex(p.color, '#F4EFE6'), ls: fs * 0.12 }) +
        `<rect x="${f2(c.W / 2 - rw / 2)}" y="${f2(cy - fs * 0.62)}" width="${f2(rw)}" height="${f2(Math.max(1, fs * 0.02))}" fill="${hex(p.rule, '#C9A46A')}"/>` +
        tx(ti, c.W / 2, cy + fs * 0.42 + (1 - E.enter(L.in)) * 18 * s, fs, { weight: 400, font: SERIF, fill: hex(p.color, '#F4EFE6') }) + '</g>'; } },
  'title.namesOver': { tags: ['title', 'opening-titles', 'names', 'credits', 'title-sequence'], dur: 2.4, inF: 12, outF: 10, d: { role: 'a film by', name: 'PLACEHOLDER NAME', style: 'drift', pos: 'c', color: '#F2F2F2', accent: '#FF9A3C', size: 84, seed: 3, padY: 0 },   // padY: keep the name this far from the top and bottom edges (the letterbox bars + a margin)
    svg(L, p, c) { const s = sc(c), nm = str(p.name, 'PLACEHOLDER NAME', 60).toUpperCase(), rl = str(p.role, '', 60), st = ['drift', 'type', 'slam', 'split', 'flicker', 'glow'].includes(p.style) ? p.style : 'drift', col = hex(p.color, '#F2F2F2');
      const font = st === 'type' ? MONO : FONT, wt = st === 'type' ? 600 : st === 'drift' ? 300 : 800, lsE = st === 'drift' ? 0.22 : st === 'type' ? 0.04 : 0.03, fs = fit(nm, num(p.size, 84, 8, 300) * s, (c.safe.x1 - c.safe.x0) * 0.8, { weight: wt, font, ls: lsE });
      const w = measure(nm, fs, { weight: wt, font }) + lsE * fs * nm.length, h = fs * 1.7, pos = typeof p.pos === 'string' ? p.pos : Array.isArray(p.pos) ? p.pos : 'c', [x0, y0] = POS(c, pos, w, h, p.padY);
      const anchor = pos.includes && pos.includes('l') ? 'start' : pos.includes && pos.includes('r') ? 'end' : 'middle', ax = anchor === 'start' ? x0 : anchor === 'end' ? x0 + w : x0 + w / 2, k = fade(L), yN = y0 + h - fs * 0.2, yR = yN - fs * 1.05;
      const R = rl ? tx(rl.toUpperCase(), ax, yR, Math.max(16, fs * 0.28), { weight: 600, fill: col, anchor, ls: fs * 0.1, op: k * 0.85 }) : '';
      if (st === 'type') { const n = Math.min(nm.length, Math.floor(Math.max(0, L.u - 0.1) * 24)); return R + tx(nm.slice(0, n), ax, yN, fs, { weight: wt, font, fill: col, anchor: anchor === 'middle' ? 'start' : anchor, ls: lsE * fs, op: 1 - E.exit(L.out), extra: anchor === 'middle' ? `dx="${f2(-w / 2)}"` : '' }); }
      if (st === 'slam') { const sc1 = lerp(1.35, 1, E.enter(seg(L.u, 0, 0.18))), cy = yN - fs * 0.35; return R + `<g transform="translate(${f2(ax)} ${f2(cy)}) scale(${sc1.toFixed(4)}) translate(${f2(-ax)} ${f2(-cy)})">${tx(nm, ax, yN, fs, { weight: wt, fill: col, anchor, ls: lsE * fs, op: 1 - E.exit(L.out) })}</g>`; }
      if (st === 'split') { const off = (1 - E.hero(L.in)) * fs * 0.6, mid = yN - fs * 0.36; return R + `<defs><clipPath id="a"><rect x="0" y="0" width="${c.W}" height="${f2(mid)}"/></clipPath><clipPath id="b"><rect x="0" y="${f2(mid)}" width="${c.W}" height="${f2(c.H - mid)}"/></clipPath></defs>` +
        [['a', -off], ['b', off]].map(([id, o]) => `<g clip-path="url(#${id})"><g transform="translate(${f2(o)} 0)">${tx(nm, ax, yN, fs, { weight: wt, fill: col, anchor, ls: lsE * fs, op: k })}</g></g>`).join(''); }
      if (st === 'flicker') { const fr = Math.floor(L.u * 24), on = L.u > 0.4 || hashf(fr, num(p.seed, 3, 0, 1e6)) > 0.45; return R + tx(nm, ax, yN, fs, { weight: wt, fill: col, anchor, ls: lsE * fs, op: on ? k * (0.85 + 0.15 * hashf(fr, 9)) : 0.05 }); }
      if (st === 'glow') return R + `<defs><filter id="g" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${f2(fs * 0.14)}"/></filter></defs><g filter="url(#g)" opacity="${f2(k * 0.8)}">${tx(nm, ax, yN, fs, { weight: wt, fill: hex(p.accent, '#FF9A3C'), anchor, ls: lsE * fs })}</g>` + tx(nm, ax, yN, fs, { weight: wt, fill: col, anchor, ls: lsE * fs, op: k });
      const dr = lerp(-0.012, 0.012, clamp(L.u / Math.max(0.1, L.total))) * c.W;   // drift: a slow lateral drift and opening tracking
      return R + tx(nm, ax + dr, yN, fs, { weight: wt, fill: col, anchor, ls: (lsE + 0.06 * clamp(L.u / Math.max(0.1, L.total))) * fs, op: k }); } },
};

export const FILM_GFX = { ...TITLES, ...CREDITS, ...CARDS, ...TEXTS };
for (const g of Object.values(FILM_GFX)) g.file = 'type/gfx/film.js';
export const FILM_IDS = Object.keys(FILM_GFX);
/* default sound per part (gfxCues falls back to it): [sfx id, offset frames from `at`, gain dB] */
export const FILM_SFX = {
  'title.trailerSlab': ['sfx/trailer/boom_metal', 0, 0], 'title.trailerThin': ['sfx/trailer/sub_drop_long', 0, -2], 'title.trailerDistressed': ['sfx/trailer/braam_short', 0, 0],
  'title.trailerGlow': ['sfx/trailer/braam_low', 0, 0], 'title.trailerCut': ['sfx/trailer/metal_hit', 14, 0], 'credits.billingBlock': ['sfx/tx/cut_tick', 0, -8], 'credits.roll': ['sfx/tx/cut_tick', 0, -10],
  'card.fromTheMakers': ['sfx/trailer/braam_short', 0, -2], 'card.releaseDate': ['sfx/trailer/boom_hit', 0, 0], 'card.quote': ['sfx/trailer/metal_hit', 0, -3], 'card.production': ['sfx/trailer/reverse_swell_2s', 18, -4],
  'card.scene': ['sfx/foley/typewriter', 0, -6], 'caption.filmSubtitle': ['sfx/tx/cut_tick', 0, -14], 'title.filmChapter': ['sfx/hit/soft', 0, -4], 'title.namesOver': ['sfx/whoosh/swish_s', 0, -6],
};
