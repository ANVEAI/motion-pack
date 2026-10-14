/* motion-pack / type / gfx / editorial.js: lower thirds (6), counters (5), titles and HUD (7). See core.js for the contract.
   Lower thirds sit inside the platform safe rect (p.platform, default wideTitle / reels) so nothing lands under platform UI. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, BRAND, INK, PAPER, esc, f2, tf, text, textW, clipRect, dash, anchor, srcOf } from './core.js';

const LT = (d) => ({ name: 'Maya Rao', role: 'Founder, Orbit', pos: 'bl', accent: BRAND, ...d });
const nameSz = (c) => 54 * c.s, roleSz = (c) => 30 * c.s;
const fmt = (v, dec = 0, sep = ',') => { const s = Math.abs(v).toFixed(dec).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep); return (v < 0 ? '-' : '') + s.join('.'); };

export const EDITORIAL = {
  'lowerThird.cleanBar': { tags: ['lower-third', 'name', 'interview', 'clean', 'talking-head'], dur: 3, inF: 14, outF: 10, d: LT({}),
    svg(L, p, c) { const ns = nameSz(c), rs = roleSz(c), w = Math.max(textW(p.name, ns), textW(p.role, rs, 0.52)) + 64 * c.s, h = ns + rs + 52 * c.s, [x, y] = anchor(p.pos, c, w, h);
      const wi = E.hero(L.in) * (1 - E.exit(L.out)), id = 'lt' + Math.round(x);
      return `<defs>${clipRect(id, x, y, w * wi, h)}</defs><g clip-path="url(#${id})"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(6 * c.s)}" fill="${PAPER}"/>` +
        `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(8 * c.s)}" height="${f2(h)}" fill="${p.accent}"/>` + text(p.name, x + 32 * c.s, y + 20 * c.s + ns * 0.9, { size: ns, weight: 800, fill: INK }) +
        text(p.role, x + 32 * c.s, y + 30 * c.s + ns + rs * 0.85, { size: rs, weight: 600, fill: p.accent, op: seg(L.u, 0.25, 0.5) }) + '</g>'; } },
  'lowerThird.boldBlock': { tags: ['lower-third', 'name', 'bold', 'ad', 'social'], dur: 3, inF: 16, outF: 10, d: LT({}),
    svg(L, p, c) { const ns = nameSz(c) * 1.1, rs = roleSz(c), w1 = textW(p.name.toUpperCase(), ns, 0.7) + 48 * c.s, w2 = textW(p.role, rs, 0.55) + 40 * c.s, h1 = ns * 1.35, h2 = rs * 1.6, [x, y] = anchor(p.pos, c, Math.max(w1, w2), h1 + h2);
      const a = E.hero(seg(L.u, 0, 0.4)) * (1 - E.exit(L.out)), b = E.hero(seg(L.u, 0.15, 0.55)) * (1 - E.exit(L.out)), id = 'bb' + Math.round(x);
      return `<defs>${clipRect(id + 'a', x, y, w1, h1)}${clipRect(id + 'b', x, y + h1, w2, h2)}</defs>` +
        `<g clip-path="url(#${id}a)"><g transform="translate(0 ${f2(h1 * (1 - a))})"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w1)}" height="${f2(h1)}" fill="${p.accent}"/>${text(p.name.toUpperCase(), x + 24 * c.s, y + h1 * 0.74, { size: ns, weight: 800 })}</g></g>` +
        `<g clip-path="url(#${id}b)"><g transform="translate(0 ${f2(-h2 * (1 - b))})"><rect x="${f2(x)}" y="${f2(y + h1)}" width="${f2(w2)}" height="${f2(h2)}" fill="${INK}"/>${text(p.role, x + 20 * c.s, y + h1 + h2 * 0.7, { size: rs, weight: 600 })}</g></g>`; } },
  'lowerThird.accentRule': { tags: ['lower-third', 'name', 'minimal', 'premium', 'documentary'], dur: 3, inF: 18, outF: 10, d: LT({ color: PAPER }),
    svg(L, p, c) { const ns = nameSz(c), rs = roleSz(c), h = ns + rs + 30 * c.s, w = Math.max(textW(p.name, ns), textW(p.role, rs)) + 40 * c.s, [x, y] = anchor(p.pos, c, w, h);
      const r = E.hero(seg(L.u, 0, 0.35)) * (1 - E.exit(L.out)), tx = E.hero(seg(L.u, 0.2, 0.65)) * (1 - E.exit(L.out)), id = 'ar' + Math.round(x);
      return `<defs>${clipRect(id, x + 6 * c.s, y - 10, w + 40 * c.s, h + 20)}</defs><rect x="${f2(x)}" y="${f2(y + h * (1 - r) / 2)}" width="${f2(5 * c.s)}" height="${f2(h * r)}" fill="${p.accent}"/>` +
        `<g clip-path="url(#${id})" transform="translate(${f2(-w * (1 - tx))} 0)">${text(p.name, x + 26 * c.s, y + ns * 0.85, { size: ns, weight: 700, fill: p.color, extra: 'style="paint-order:stroke" stroke="rgba(0,0,0,0.35)" stroke-width="1"' })}` +
        `${text(p.role, x + 26 * c.s, y + ns + 18 * c.s + rs * 0.8, { size: rs, weight: 500, fill: p.color, op: 0.8 })}</g>`; } },
  'lowerThird.softPill': { tags: ['lower-third', 'name', 'friendly', 'social', 'creator'], dur: 3, inF: 12, outF: 9, d: LT({ initials: 'MR' }),
    svg(L, p, c) { const ns = nameSz(c) * 0.8, rs = roleSz(c) * 0.9, hh = 104 * c.s, w = hh + Math.max(textW(p.name, ns), textW(p.role, rs)) + 56 * c.s, [x, y] = anchor(p.pos, c, w, hh);
      const k = E.pop(L.in) * (1 - E.exit(L.out)), cx = x + w / 2, cy = y + hh / 2, r = hh / 2 - 10 * c.s;
      return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${Math.max(0.001, k).toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})" opacity="${f2(clamp(L.in * 3) * (1 - L.out))}">` +
        `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(hh)}" rx="${f2(hh / 2)}" fill="rgba(255,255,255,0.92)"/><circle cx="${f2(x + hh / 2)}" cy="${f2(cy)}" r="${f2(r)}" fill="${p.accent}"/>` +
        text(p.initials, x + hh / 2, cy + r * 0.32, { size: r * 0.9, weight: 800, anchor: 'middle' }) + text(p.name, x + hh + 8 * c.s, cy - 4 * c.s, { size: ns, weight: 800, fill: INK }) +
        text(p.role, x + hh + 8 * c.s, cy + rs * 1.05, { size: rs, weight: 500, fill: '#555566' }) + '</g>'; } },
  'lowerThird.newsBar': { tags: ['lower-third', 'news', 'ticker', 'breaking', 'comedy'], dur: 4, inF: 12, outF: 9, d: LT({ tag: 'LIVE', ticker: 'Orbit ships today  •  Notes that stay on your desk  •  ', accent: '#E3122E', speed: 160 }),
    svg(L, p, c) { const S = c.safe, H1 = 86 * c.s, H2 = 46 * c.s, y = S.y1 - H1 - H2, k = E.hero(L.in) * (1 - E.exit(L.out)), x0 = c.W * (1 - k) * -1, tagW = textW(p.tag, 34 * c.s) + 40 * c.s, id = 'nb';
      const tick = (p.ticker || '').repeat(4), off = ((L.u * p.speed * c.s) % (textW(p.ticker, 26 * c.s, 0.52) || 1));
      return `<g transform="translate(${f2(x0)} 0)"><rect x="0" y="${f2(y)}" width="${c.W}" height="${f2(H1)}" fill="${PAPER}"/><rect x="${f2(S.x0)}" y="${f2(y + 16 * c.s)}" width="${f2(tagW)}" height="${f2(H1 - 32 * c.s)}" fill="${p.accent}"/>` +
        text(p.tag, S.x0 + tagW / 2, y + H1 / 2 + 12 * c.s, { size: 34 * c.s, weight: 800, anchor: 'middle' }) + text(p.name.toUpperCase() + ' — ' + p.role, S.x0 + tagW + 24 * c.s, y + H1 / 2 + 14 * c.s, { size: 40 * c.s, weight: 800, fill: INK }) +
        `<defs>${clipRect(id, 0, y + H1, c.W, H2)}</defs><rect x="0" y="${f2(y + H1)}" width="${c.W}" height="${f2(H2)}" fill="${INK}"/><g clip-path="url(#${id})">${text(tick, S.x0 - off, y + H1 + H2 * 0.7, { size: 26 * c.s, weight: 600, font: MONO })}</g></g>`; } },
  'lowerThird.neonBorder': { tags: ['lower-third', 'name', 'neon', 'gaming', 'night'], dur: 3, inF: 18, outF: 9, d: LT({ accent: '#7CF7FF' }),
    svg(L, p, c) { const ns = nameSz(c), rs = roleSz(c), w = Math.max(textW(p.name, ns), textW(p.role, rs)) + 72 * c.s, h = ns + rs + 56 * c.s, [x, y] = anchor(p.pos, c, w, h), per = 2 * (w + h);
      const d = E.soft(seg(L.u, 0, 0.5)), tk = seg(L.u, 0.3, 0.6) * (1 - L.out), fl = 0.85 + 0.15 * Math.sin(L.u * 37) * Math.sin(L.u * 13);
      return `<defs><filter id="neon" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${f2(6 * c.s)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
        `<g opacity="${f2(1 - L.out)}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(14 * c.s)}" fill="rgba(5,5,16,0.78)"/>` +
        `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(14 * c.s)}" fill="none" stroke="${p.accent}" stroke-width="${f2(4 * c.s)}" filter="url(#neon)" ${dash(per, d)} opacity="${f2(fl)}"/>` +
        text(p.name, x + 36 * c.s, y + 26 * c.s + ns * 0.8, { size: ns, weight: 800, fill: PAPER, op: tk }) + text(p.role, x + 36 * c.s, y + 36 * c.s + ns + rs * 0.8, { size: rs, weight: 600, fill: p.accent, op: tk }) + '</g>'; } },

  'counter.countUp': { tags: ['counter', 'number', 'stat', 'kpi', 'explainer'], dur: 2.5, inF: 30, outF: 9, d: { from: 0, to: 12500, dec: 0, prefix: '', suffix: '+', label: 'happy teams', pos: 'c', size: 180, color: PAPER, accent: BRAND, source: 'placeholder data' },   // source prints under the number (blank = the placeholder label)
    svg(L, p, c) { const v = lerp(p.from, p.to, E.expoOut(L.in)), sz = p.size * c.s, str = p.prefix + fmt(v, p.dec) + p.suffix, w = textW(p.prefix + fmt(p.to, p.dec) + p.suffix, sz, 0.6), [x, y] = anchor(p.pos, c, w, sz * 1.5), o = 1 - L.out;
      return `<g opacity="${f2(o)}">` + text(str, x + w / 2, y + sz, { size: sz, weight: 800, fill: p.color, anchor: 'middle', extra: 'font-variant-numeric="tabular-nums"' }) + text(p.label, x + w / 2, y + sz * 1.42, { size: sz * 0.22, weight: 600, fill: p.accent === BRAND ? p.color : p.accent, anchor: 'middle', op: seg(L.u, 0.4, 0.8) }) +
        text(srcOf(p), x + w / 2, y + sz * 1.62, { size: Math.max(sz * 0.1, 16 * c.s), weight: 500, fill: p.color, anchor: 'middle', op: 0.7 }) + '</g>'; } },
  'counter.wheel': { tags: ['counter', 'odometer', 'number', 'rolling', 'retro'], dur: 2.5, inF: 36, outF: 9, d: { to: 2026, digits: 4, pos: 'c', size: 200, color: PAPER, bg: 'rgba(0,0,0,0.55)', stagger: 4, source: 'placeholder data' },
    svg(L, p, c) { const sz = p.size * c.s, cw = sz * 0.68, n = p.digits, W = cw * n, [x, y] = anchor(p.pos, c, W, sz * 1.2), ds = String(Math.round(p.to)).padStart(n, '0'); let out = `<defs>${clipRect('odo', x, y, W, sz * 1.2)}</defs><rect x="${f2(x)}" y="${f2(y)}" width="${f2(W)}" height="${f2(sz * 1.2)}" rx="${f2(sz * 0.1)}" fill="${p.bg}"/><g clip-path="url(#odo)">`;
      for (let i = 0; i < n; i++) { const tgt = +ds[i] + 10 * (n - i), k = E.hero(seg(L.u, i * p.stagger / 30, i * p.stagger / 30 + 1.0)), pos = tgt * k, dy = (pos % 10);
        for (const dd of [0, 1]) { const dig = (Math.floor(pos) + dd) % 10; out += text(String(dig), x + cw * (i + 0.5), y + sz * 0.98 - (dy - Math.floor(dy) - dd) * sz * 1.2 + 0 * dd, { size: sz, weight: 800, fill: p.color, anchor: 'middle', extra: 'font-variant-numeric="tabular-nums"' }); } }
      return `<g opacity="${f2(1 - L.out)}">${out}</g></g>` + `<g opacity="${f2(0.8 * (1 - L.out))}">` + text('source: ' + srcOf(p), x + W / 2, y + sz * 1.2 + 30 * c.s, { size: Math.max(sz * 0.1, 16 * c.s), weight: 500, fill: p.color, anchor: 'middle', font: MONO }) + '</g>'; } },
  'counter.statCard': { tags: ['counter', 'stat', 'card', 'kpi', 'saas'], dur: 3, inF: 24, outF: 9, d: { to: 1234, suffix: '', label: 'Your metric', delta: '+12%', good: true, pos: 'c', accent: BRAND, source: 'placeholder data' },   // neutral on purpose: the old defaults (487 ms, -38%, 'internal benchmark') read as a real measurement
    svg(L, p, c) { const w = 560 * c.s, h = 300 * c.s, [x, y] = anchor(p.pos, c, w, h), k = E.pop(seg(L.u, 0, 0.35)) * (1 - E.exit(L.out)), v = Math.round(p.to * E.expoOut(seg(L.u, 0.15, 0.9))), cx = x + w / 2, cy = y + h / 2, col = p.good ? '#14B86A' : '#E3122E';
      return `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${Math.max(0.001, k).toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(28 * c.s)}" fill="${PAPER}"/>` +
        `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(10 * c.s)}" rx="${f2(5 * c.s)}" fill="${p.accent}"/>` + text(p.label, x + 40 * c.s, y + 70 * c.s, { size: 30 * c.s, weight: 600, fill: '#555566' }) +
        text(fmt(v) + p.suffix, x + 40 * c.s, y + 190 * c.s, { size: 110 * c.s, weight: 800, fill: INK }) + `<rect x="${f2(x + 40 * c.s)}" y="${f2(y + 218 * c.s)}" width="${f2(textW(p.delta, 30 * c.s) + 30 * c.s)}" height="${f2(46 * c.s)}" rx="${f2(23 * c.s)}" fill="${col}" opacity="${f2(seg(L.u, 0.7, 0.9))}"/>` +
        text(p.delta, x + 55 * c.s, y + 252 * c.s, { size: 30 * c.s, weight: 800, op: seg(L.u, 0.7, 0.9) }) + text('source: ' + srcOf(p), x + w - 30 * c.s, y + h - 24 * c.s, { size: 18 * c.s, weight: 600, fill: '#6B6B7B', anchor: 'end' }) + '</g>'; } },
  'counter.ring': { tags: ['counter', 'ring', 'progress', 'percent', 'dashboard'], dur: 2.5, inF: 36, outF: 9, d: { value: 92, suffix: '%', label: 'accuracy', pos: 'c', radius: 150, accent: BRAND, track: 'rgba(255,255,255,0.18)', color: PAPER, source: 'placeholder data' },
    svg(L, p, c) { const R = p.radius * c.s, [x, y] = anchor(p.pos, c, 2 * R, 2 * R), cx = x + R, cy = y + R, k = E.hero(L.in), per = TAU * R, o = 1 - L.out;
      return `<g opacity="${f2(o)}"><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="${p.track}" stroke-width="${f2(R * 0.14)}"/>` +
        `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="${p.accent}" stroke-width="${f2(R * 0.14)}" stroke-linecap="round" transform="rotate(-90 ${f2(cx)} ${f2(cy)})" ${dash(per, k * p.value / 100)}/>` +
        text(Math.round(p.value * k) + p.suffix, cx, cy + R * 0.18, { size: R * 0.55, weight: 800, fill: p.color, anchor: 'middle' }) + text(p.label, cx, cy + R * 0.5, { size: R * 0.16, weight: 600, fill: p.color, anchor: 'middle', op: 0.75 }) +
        text('source: ' + srcOf(p), cx, cy + R * 1.0 + Math.max(R * 0.2, 24 * c.s), { size: Math.max(R * 0.11, 16 * c.s), weight: 500, fill: p.color, anchor: 'middle', font: MONO, op: 0.75 }) + '</g>'; } },
  'counter.priceSlash': { tags: ['price', 'sale', 'offer', 'ad', 'cta'], dur: 3, inF: 30, outF: 9, d: { was: '₹4,999', now: '₹2,499', label: 'launch price', pos: 'c', accent: '#FFC83D', color: PAPER, source: 'placeholder data' },
    svg(L, p, c) { const s1 = 90 * c.s, s2 = 170 * c.s, w = Math.max(textW(p.was, s1), textW(p.now, s2)), [x, y] = anchor(p.pos, c, w, s1 + s2 + 40 * c.s), cx = x + w / 2, ww = textW(p.was, s1), o = 1 - L.out;
      const sl = E.soft(seg(L.u, 0.35, 0.6)), pop = E.pop(seg(L.u, 0.6, 0.9)), ny = y + s1 + s2 * 0.95;
      return `<g opacity="${f2(o)}">` + text(p.was, cx, y + s1 * 0.85, { size: s1, weight: 700, fill: p.color, anchor: 'middle', op: 1 - 0.45 * sl }) +
        `<line x1="${f2(cx - ww / 2 - 10)}" y1="${f2(y + s1 * 0.55)}" x2="${f2(cx - ww / 2 - 10 + (ww + 20) * sl)}" y2="${f2(y + s1 * 0.4)}" stroke="#E3122E" stroke-width="${f2(10 * c.s)}" stroke-linecap="round"/>` +
        `<g transform="translate(${f2(cx)} ${f2(ny - s2 * 0.35)}) scale(${Math.max(0.001, pop).toFixed(4)}) translate(${f2(-cx)} ${f2(-(ny - s2 * 0.35))})">${text(p.now, cx, ny, { size: s2, weight: 800, fill: p.accent, anchor: 'middle' })}` +
        text(p.label.toUpperCase(), cx, ny + 50 * c.s, { size: 34 * c.s, weight: 700, fill: p.color, anchor: 'middle', ls: 4 * c.s }) + '</g>' +
        text('source: ' + srcOf(p), cx, ny + 106 * c.s, { size: 20 * c.s, weight: 500, fill: p.color, anchor: 'middle', font: MONO, op: 0.75 }) + '</g>'; } },

  'title.chapterCard': { tags: ['title', 'chapter', 'section', 'film', 'explainer'], dur: 2, inF: 18, outF: 12, d: { kicker: 'Chapter 02', title: 'The night before the audit', bg: 'rgba(8,8,12,0.92)', accent: BRAND },
    svg(L, p, c) { const k = E.soft(L.in) * (1 - E.exit(L.out)), cy = c.H / 2, ts = (c.tall ? 72 : 96) * c.s, r = E.hero(seg(L.u, 0.15, 0.6));
      return `<rect width="${c.W}" height="${c.H}" fill="${p.bg}" opacity="${f2(k)}"/>` + text(p.kicker.toUpperCase(), c.W / 2, cy - ts * 0.9, { size: 30 * c.s, weight: 600, fill: PAPER, anchor: 'middle', font: MONO, ls: 6 * c.s, op: k }) +
        `<rect x="${f2(c.W / 2 - 120 * c.s * r)}" y="${f2(cy - ts * 0.62)}" width="${f2(240 * c.s * r)}" height="${f2(4 * c.s)}" fill="${p.accent}" opacity="${f2(k)}"/>` +
        text(p.title, c.W / 2, cy + ts * 0.45 + 20 * c.s * (1 - E.hero(L.in)), { size: ts, weight: 800, fill: PAPER, anchor: 'middle', op: k }); } },
  'title.slate': { tags: ['slate', 'clapper', 'behind-the-scenes', 'film', 'take'], dur: 1.6, inF: 6, outF: 6, d: { prod: 'ORBIT', scene: '12A', take: '3', roll: 'A004', director: 'M. Rao', clapAt: 0.6 },
    svg(L, p, c) { const w = 760 * c.s, h = 520 * c.s, x = (c.W - w) / 2, y = (c.H - h) / 2 + 40 * c.s, arm = 1 - E.quint(seg(L.u, p.clapAt - 0.25, p.clapAt)), ang = -28 * arm, hb = 90 * c.s, o = 1 - L.out, cells = [['PROD', p.prod], ['SCENE', p.scene], ['TAKE', p.take], ['ROLL', p.roll], ['DIRECTOR', p.director]];
      const stripes = (yy) => Array.from({ length: 8 }, (_, i) => `<polygon points="${f2(x + i * w / 8)},${f2(yy)} ${f2(x + i * w / 8 + w / 16)},${f2(yy)} ${f2(x + i * w / 8 + w / 8 - w / 16)},${f2(yy + hb)} ${f2(x + i * w / 8 - w / 16 + 0)},${f2(yy + hb)}" fill="${i % 2 ? '#111' : '#F4F4F4'}"/>`).join('');
      let g = `<g opacity="${f2(o * clamp(L.in * 2))}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(10 * c.s)}" fill="#141414"/>${stripes(y)}`;
      cells.forEach(([k, v], i) => { const cx = x + 30 * c.s + (i % 2) * w / 2, cy = y + hb + 70 * c.s + Math.floor(i / 2) * 120 * c.s; g += text(k, cx, cy, { size: 22 * c.s, weight: 600, fill: '#9A9AA8', font: MONO }) + text(v, cx, cy + 56 * c.s, { size: 52 * c.s, weight: 800, fill: '#F4F4F4' }); });
      g += `<g transform="rotate(${f2(ang)} ${f2(x)} ${f2(y)})"><rect x="${f2(x)}" y="${f2(y - hb - 4 * c.s)}" width="${f2(w)}" height="${f2(hb)}" fill="#141414"/>${stripes(y - hb - 4 * c.s)}</g></g>`; return g; } },
  'title.timecodeHUD': { tags: ['timecode', 'hud', 'frame-count', 'review', 'behind-the-scenes'], dur: 9999, inF: 1, outF: 1, d: { fps: 30, start: 0, label: 'REVIEW', pos: 'tr' },
    svg(L, p, c) { const f = Math.max(0, Math.floor((L.u + p.start) * p.fps + 1e-6)), s = Math.floor(f / p.fps), tcs = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f % p.fps].map((v) => String(v).padStart(2, '0')).join(':'), sz = 30 * c.s, w = 330 * c.s, h = 84 * c.s, [x, y] = anchor(p.pos, c, w, h);
      return `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(8 * c.s)}" fill="rgba(0,0,0,0.6)"/>` + text(p.label + '  F' + f, x + 16 * c.s, y + 30 * c.s, { size: sz * 0.62, weight: 500, fill: '#B8B8C8', font: MONO }) + text(tcs, x + 16 * c.s, y + 70 * c.s, { size: sz * 1.15, weight: 600, fill: PAPER, font: MONO }); } },
  'title.letterboxRamp': { tags: ['letterbox', 'cinematic', 'bars', 'flashback', 'drama'], dur: 3, inF: 18, outF: 18, d: { ratio: 2.39, color: '#000000' },
    svg(L, p, c) { const tgt = Math.max(0, (c.H - c.W / p.ratio) / 2), b = tgt * E.move(L.in) * (1 - E.move(L.out)); return `<rect x="0" y="0" width="${c.W}" height="${f2(b)}" fill="${p.color}"/><rect x="0" y="${f2(c.H - b)}" width="${c.W}" height="${f2(b)}" fill="${p.color}"/>`; } },
  'title.progressBar': { tags: ['progress', 'retention', 'chapters', 'explainer', 'shorts'], dur: 30, inF: 6, outF: 6, d: { total: 30, chapters: [], edge: 'top', height: 8, accent: BRAND, track: 'rgba(255,255,255,0.25)' },
    svg(L, p, c) { const k = clamp(L.u / p.total), h = p.height * c.s, y = p.edge === 'top' ? 0 : c.H - h; let g = `<rect x="0" y="${f2(y)}" width="${c.W}" height="${f2(h)}" fill="${p.track}"/><rect x="0" y="${f2(y)}" width="${f2(c.W * k)}" height="${f2(h)}" fill="${p.accent}"/>`;
      for (const ch of p.chapters) g += `<rect x="${f2(c.W * ch / p.total - 2 * c.s)}" y="${f2(y)}" width="${f2(4 * c.s)}" height="${f2(h)}" fill="#000" opacity="0.6"/>`; return g; } },
  'title.countdown321': { tags: ['countdown', 'timer', 'intro', 'launch', 'game'], dur: 3, inF: 1, outF: 6, d: { from: 3, color: PAPER, accent: BRAND, size: 360 },
    svg(L, p, c) { if (L.u < 0 || L.u >= p.from) return ''; const n = p.from - Math.floor(L.u), fr = L.u - Math.floor(L.u), R = p.size * c.s * 0.75, cx = c.W / 2, cy = c.H / 2, pop = E.pop(seg(fr, 0, 0.25)), per = TAU * R;
      return `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="${f2(14 * c.s)}"/><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="${p.accent}" stroke-width="${f2(14 * c.s)}" transform="rotate(-90 ${f2(cx)} ${f2(cy)})" ${dash(per, 1 - fr)}/>` +
        `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${Math.max(0.001, pop).toFixed(4)})">${text(String(n), 0, p.size * c.s * 0.35, { size: p.size * c.s, weight: 800, fill: p.color, anchor: 'middle' })}</g>`; } },
  'title.recDot': { tags: ['rec', 'live', 'camera', 'vlog', 'hud'], dur: 9999, inF: 1, outF: 1, d: { label: 'REC', pos: 'tl', blink: 1 },
    svg(L, p, c) { const [x, y] = anchor(p.pos, c, 200 * c.s, 60 * c.s), on = Math.floor(L.u * 2 * p.blink) % 2 === 0;
      return (on ? `<circle cx="${f2(x + 24 * c.s)}" cy="${f2(y + 30 * c.s)}" r="${f2(16 * c.s)}" fill="#FF2A2A"/>` : '') + text(p.label, x + 54 * c.s, y + 44 * c.s, { size: 40 * c.s, weight: 700, fill: PAPER, font: MONO }); } },
};
