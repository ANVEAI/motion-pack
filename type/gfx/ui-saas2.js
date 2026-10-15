/* motion-pack / type / gfx / ui-saas2.js: the SaaS launch / product-demo kit, part 2 (2026-10-16, lane xp-saas). Same contract as ui-saas.js (pure functions of t, closed-form springs).
     ui.pricingCards       one to four plan cards rise in a stagger, the featured one lifts with an accent border and a badge; prices and limits print `source` (default 'placeholder data')
     ui.integrationGrid    "works with": a hub and NEUTRAL generic glyph tiles (cloud, database, chat, calendar, ...: our own line icons, never a real product's mark) on a ring or a grid;
                           connectors draw on in a stagger and a dot travels each one; the frame says "placeholder marks" until you set `note`
     ui.beforeAfterSplit   two screens (HTML, image or the built-in placeholder) behind one divider that sweeps through keyframes, with Before / After pills and a handle
     ui.notifyStack        toasts arrive one by one and push the older ones down; past `max` they recede and fade behind the stack
     ui.dashboardAssemble  dashboard cards fly in from a seeded scatter and snap into a grid, then their charts draw on and the KPIs count up; prints "demo data" + `source`
     device.mock           device.laptop / device.phone (social.js, reused as the frame) with a SCREEN INSERT under the bezel: a screenshot, an HTML screen or the placeholder, ken-burns + zoom
   (layout.beforeAfter is the DOM-shot version of a before/after wipe; ui.beforeAfterSplit draws its own two screens inside one SVG.) Sound: SAAS2_CUES[id](p) -> [{ t, id, why }]. */
import { E, clamp, lerp, seg, TAU, BRAND, INK, f2, text, measure, mulberry32, srcOf } from './core.js';
import { KIT } from './ui.js';
import { SOCIAL } from './social.js';
import { springTrack, spring } from '../ease.js';
import { unit, screenMap, screenMarkup, labelPill } from './ui-saas.js';
const { THEME, rect, shadowDef, softShadow, icon, checkBadge } = KIT;
const th = (p) => THEME[p.theme] || THEME.light;
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const box4 = (b, c) => [num(b?.[0]) * c.W, num(b?.[1]) * c.H, Math.max(1, num(b?.[2], 0.5) * c.W), Math.max(1, num(b?.[3], 0.5) * c.H)];
const op = (v) => (v >= 0.999 ? '' : ` opacity="${f2(clamp(v))}"`);
const list = (v, n = 64) => (Array.isArray(v) ? v.slice(0, n) : []);
const fit = (str, size, maxW, weight = 700) => { let s = String(str ?? ''); while (s.length > 1 && measure(s, size, { weight }) > maxW) s = s.slice(0, -2) + '…'; return s; };

/* ---------- owned generic glyphs (24-unit grid, line style): categories, never marks ---------- */
export const GLYPHS = { cloud: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z', db: 'M5 6c0-3 14-3 14 0v12c0 3-14 3-14 0z M5 6c0 3 14 3 14 0 M5 12c0 3 14 3 14 0',
  chat: 'M4 5h16v11H10l-5 4v-4H4z M8 9.5h8 M8 12.5h5', calendar: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h3', doc: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6', mail: 'M3 6h18v12H3z M3 7l9 6l9-6',
  chart: 'M4 20V4 M4 20h16 M8 16l4-5l3 3l5-7', code: 'M8 7l-5 5l5 5 M16 7l5 5l-5 5 M14 4l-4 16', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0', folder: 'M3 6h6l2 2h10v11H3z',
  key: 'M8 14a4 4 0 1 1 3.4-6 M11 10h10 M17 10v3 M20 10v4', cart: 'M3 4h3l2.5 11h10L21 7H7 M9.5 20a1 1 0 1 0 .1 0 M17.5 20a1 1 0 1 0 .1 0', phone: 'M8 3h8v18H8z M11 18h2', sheet: 'M4 4h16v16H4z M4 9h16 M4 14h16 M10 4v16',
  card: 'M3 6h18v12H3z M3 10h18 M6 15h4', lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3', globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18' };
const GLYPH_NAMES = { cloud: 'Storage', db: 'Database', chat: 'Chat', calendar: 'Calendar', doc: 'Docs', mail: 'Email', chart: 'Analytics', code: 'Code', bell: 'Alerts', folder: 'Files', key: 'Auth', cart: 'Store', phone: 'SMS', sheet: 'Sheets', card: 'Billing', lock: 'Security', globe: 'Web' };
const TINTS = ['#E9E6F7', '#E3EEF0', '#F3E9E1', '#E6EFE4', '#EFE4EE', '#E8EAF0'];
const glyph = (name, x, y, size, color, sw = 2) => `<path transform="translate(${f2(x)} ${f2(y)}) scale(${f2(size / 24)})" d="${GLYPHS[name] || GLYPHS.doc}" fill="none" stroke="${color}" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;

/* ---------- 1. pricing cards ---------- */
const PRICE_D = { box: [0.1, 0.16, 0.8, 0.68], start: 0.2, stagger: 0.14, featuredAt: 1.0, theme: 'light', accent: BRAND, badge: 'Featured', source: 'placeholder data', title: '',
  plans: [{ name: 'Starter', price: '$0', per: '/ month', blurb: 'For trying it out', features: ['Up to 3 flows', 'Email support'], cta: 'Start free' },
    { name: 'Team', price: '$10', per: '/ seat / month', blurb: 'For a whole team', features: ['Unlimited flows', 'Shared inbox', 'Run history'], cta: 'Start trial', featured: true },
    { name: 'Business', price: '$24', per: '/ seat / month', blurb: 'For many teams', features: ['Everything in Team', 'Roles and audit log', 'Priority support'], cta: 'Talk to us' }] };
export const pricingTimes = (p) => ({ start: num(p.start, 0.2), stagger: Math.max(0, num(p.stagger, 0.14)), featuredAt: num(p.featuredAt, 1.0) });
const pricingCards = { tags: ['ui', 'pricing', 'plans', 'cards', 'availability', 'offer', 'saas', 'launch'], dur: 4, inF: 10, outF: 8, d: PRICE_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c), u = L.u, [x, y, w, h] = box4(p.box, c), plans = list(p.plans, 4), n = Math.max(1, plans.length), tm = pricingTimes(p), tall = c.H > c.W;
    const gap = 28 * s, cols = tall ? 1 : n, rows = tall ? n : 1, cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1) - 40 * s) / rows, id = 'pc';
    let out = `<defs>${shadowDef(id + 's', s * 1.5)}</defs>`;
    plans.forEach((pl, i) => { const col = tall ? 0 : i, row = tall ? i : 0, cx = x + col * (cw + gap), cy = y + row * (ch + gap), k = spring(u - tm.start - i * tm.stagger, 'panel'); if (k <= 0) return;
      const feat = !!pl.featured, fk = feat ? spring(u - tm.featuredAt, 'headline') : 0, lift = (1 - k) * 80 * s + fk * 22 * s, sc = 1 + 0.02 * clamp(fk);
      const pad = 34 * s, nm = 30 * s, pr = (tall ? 64 : 76) * s, fs = 24 * s, gx = cx + cw / 2, gy = cy + ch / 2;
      let inner = softShadow(id + 's', cx, cy, cw, ch, 24 * s, s, 0.6 + 0.6 * clamp(fk)) + rect(cx, cy, cw, ch, 24 * s, T.panel, `stroke="${feat && fk > 0.02 ? p.accent : T.line}" stroke-width="${f2((feat ? 1.2 + 2.6 * clamp(fk) : 1.2) * s)}"`);
      inner += text(pl.name, cx + pad, cy + pad + nm * 0.8, { size: nm, weight: 800, fill: T.ink }) + (pl.blurb ? text(pl.blurb, cx + pad, cy + pad + nm * 0.8 + 36 * s, { size: 21 * s, weight: 500, fill: T.muted }) : '');
      const py = tall ? cy + pad + nm * 0.8 + 6 * s : cy + pad + nm + 70 * s + pr * 0.8, px = tall ? cx + cw - pad - measure(pl.per || '', 20 * s, { weight: 600 }) - 10 * s : cx + pad;
      inner += tall ? text(pl.price, px, py + pr * 0.2, { size: pr * 0.62, weight: 800, fill: feat ? p.accent : T.ink, anchor: 'end' }) + text(pl.per || '', cx + cw - pad, py + pr * 0.2, { size: 20 * s, weight: 600, fill: T.muted, anchor: 'end' })
        : text(pl.price, px, py, { size: pr, weight: 800, fill: feat ? p.accent : T.ink, ls: -2 * s }) + text(pl.per || '', px + measure(pl.price, pr, { weight: 800 }) + 12 * s, py, { size: 22 * s, weight: 600, fill: T.muted });
      const fy0 = tall ? cy + pad + nm + 60 * s : py + 44 * s; list(pl.features, 6).forEach((ft, j) => { const fy = fy0 + j * (tall ? 38 : 46) * s; if (fy > cy + ch - 110 * s) return; const fk2 = clamp((u - tm.start - i * tm.stagger - 0.3 - j * 0.06) / 0.2);
        inner += `<g${op(fk2)}>${checkBadge(cx + pad + 12 * s, fy - 8 * s, 12 * s, u - tm.start - i * tm.stagger - 0.3 - j * 0.06, feat ? p.accent : '#17A865')}${text(fit(ft, fs, cw - 2 * pad - 40 * s, 600), cx + pad + 36 * s, fy, { size: fs, weight: 600, fill: T.ink })}</g>`; });
      if (pl.cta) { const bh = 58 * s, by = cy + ch - pad - bh; inner += rect(cx + pad, by, cw - 2 * pad, bh, bh / 2, feat ? p.accent : T.chip) + text(pl.cta, cx + cw / 2, by + bh / 2 + 8.5 * s, { size: 24 * s, weight: 700, fill: feat ? '#FFFFFF' : T.ink, anchor: 'middle' }); }
      if (feat && fk > 0.01 && p.badge) { const bw = measure(p.badge, 19 * s, { weight: 800 }) + 30 * s, bh = 36 * s, bk = Math.max(0.001, fk); inner += `<g transform="translate(${f2(cx + cw - pad - bw / 2)} ${f2(cy - bh / 2 + 2 * s)}) scale(${f2(bk)})">${rect(-bw / 2, -bh / 2, bw, bh, bh / 2, p.accent)}${text(p.badge, 0, 7 * s, { size: 19 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}</g>`; }
      out += `<g${op(clamp(k * 1.8) * (1 - L.out))} transform="translate(${f2(gx)} ${f2(gy - lift)}) scale(${f2(sc)}) translate(${f2(-gx)} ${f2(-gy)})">${inner}</g>`; });
    out += text((p.title ? p.title + '  ·  ' : '') + 'Prices: ' + srcOf(p), x + w / 2, y + h - 4 * s, { size: 22 * s, weight: 600, fill: T.muted, anchor: 'middle', op: clamp((u - tm.start) / 0.3) * (1 - L.out) });
    return out; } };

/* ---------- 2. integration grid ---------- */
const INT_D = { box: [0.12, 0.12, 0.76, 0.76], layout: 'ring', hub: 'A', hubLabel: 'Acme Flow', glyphs: ['mail', 'chat', 'calendar', 'db', 'doc', 'sheet', 'cloud', 'bell', 'code', 'card'], labels: true, cols: 5,
  start: 0.2, stagger: 0.07, connectAt: 0.55, theme: 'light', accent: BRAND, note: 'placeholder marks · generic categories' };
export const intTimes = (p, n) => { const st = num(p.start, 0.2), sg = Math.max(0, num(p.stagger, 0.07)), ca = num(p.connectAt, 0.55); return { tile: (i) => st + i * sg, line: (i) => st + ca + i * sg * 0.8, n }; };
function intLayout(p, c, n) {
  const [x, y, w, h] = box4(p.box, c), cx = x + w / 2, cy = y + h / 2, out = [];
  if (p.layout === 'grid') { const cols = clamp(Math.round(num(p.cols, 5)), 1, 12), rows = Math.ceil(n / cols); for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), q = i % cols, inRow = Math.min(cols, n - r * cols); out.push([cx + (q - (inRow - 1) / 2) * (w / cols), y + h * 0.42 + (r + 0.5) * ((h * 0.58) / rows)]); } return { hub: [cx, y + h * 0.18], pts: out }; }
  const R = Math.min(w, h) * 0.4, ry = c.H > c.W ? R * 1.25 : R * 0.92; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * TAU; out.push([cx + Math.cos(a) * R * (c.H > c.W ? 1 : 1.25), cy + Math.sin(a) * ry]); } return { hub: [cx, cy], pts: out };
}
const integrationGrid = { tags: ['ui', 'integrations', 'works-with', 'hub', 'connectors', 'icons', 'placeholder', 'saas', 'launch'], dur: 4, inF: 10, outF: 8, d: INT_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c), u = L.u, names = list(p.glyphs, 24).map(String), n = names.length, G = intLayout(p, c, n), tm = intTimes(p, n), ts = 104 * s, id = 'ig';
    let lines = '', tiles = '';
    G.pts.forEach(([tx, ty], i) => { const d = E.enter(seg(u, tm.line(i), tm.line(i) + 0.4)), len = Math.hypot(tx - G.hub[0], ty - G.hub[1]); if (d > 0) {
      lines += `<path d="M${f2(G.hub[0])} ${f2(G.hub[1])} L${f2(tx)} ${f2(ty)}" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="${f2(3 * s)}" stroke-dasharray="${f2(len * d)} ${f2(len)}" stroke-linecap="round"/>`;
      if (d >= 1) { const ph = ((u - tm.line(i) - 0.4) * 0.7 + i * 0.13) % 1, q = E.move(ph); lines += `<circle cx="${f2(lerp(tx, G.hub[0], q))}" cy="${f2(lerp(ty, G.hub[1], q))}" r="${f2(6 * s)}" fill="${p.accent}" opacity="${f2(Math.sin(Math.PI * ph))}"/>`; } }
      const k = spring(u - tm.tile(i), 'headline'); if (k <= 0) return; const sz = ts * Math.max(0.001, k);
      tiles += `<g transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(Math.max(0.001, k))})">${rect(-ts / 2, -ts / 2, ts, ts, 26 * s, TINTS[i % TINTS.length], `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}${glyph(names[i], -24 * s, -24 * s, 48 * s, '#3B3946', 2.2)}</g>`;
      if (p.labels && GLYPH_NAMES[names[i]]) tiles += text(GLYPH_NAMES[names[i]], tx, ty + ts / 2 + 32 * s, { size: 22 * s, weight: 700, fill: T.muted, anchor: 'middle', op: clamp(k) }); void sz; });
    const hk = spring(u, 'headline'), hr = 84 * s, hub = `<g transform="translate(${f2(G.hub[0])} ${f2(G.hub[1])}) scale(${f2(Math.max(0.001, hk))})"><defs>${shadowDef(id + 's', s)}</defs>${softShadow(id + 's', -hr, -hr, 2 * hr, 2 * hr, hr, s, 0.8)}<circle r="${f2(hr)}" fill="${p.accent}"/>${text(String(p.hub).slice(0, 2), 0, 22 * s, { size: 64 * s, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}</g>`;
    const [bx, by, bw, bh] = box4(p.box, c), note = p.note ? text(p.note, bx + bw / 2, by + bh + 34 * s, { size: 22 * s, weight: 600, fill: T.muted, anchor: 'middle', op: clamp(u / 0.3) }) : '';
    return `<g${op(1 - L.out)}>${lines}${tiles}${hub}${note}</g>`; } };

/* ---------- 3. before / after split ---------- */
const BA_D = { box: [0.08, 0.12, 0.84, 0.76], before: { src: null, html: null, label: 'Before' }, after: { src: null, html: null, label: 'After' }, screen: { w: 1440, h: 900, anchor: [0.5, 0] },
  keys: [[0.3, 1], [1.2, 0.1], [2.0, 0.5]], theme: 'light', accent: BRAND, radius: 18, label: 'placeholder UI · demo data' };
const messy = (T) => { let o = rect(0, 0, 1440, 900, 0, '#F1EEE8'); const r = mulberry32(11); for (let i = 0; i < 26; i++) { const x = r() * 1240, y = r() * 760, w = 160 + r() * 220, h = 70 + r() * 70; o += rect(x, y, w, h, 12, i % 4 ? '#FFFFFF' : '#FDE7E2', `stroke="#D8D2CC" transform="rotate(${f2((r() - 0.5) * 8)} ${f2(x + w / 2)} ${f2(y + h / 2)})"`) + rect(x + 16, y + 18, w * 0.6, 14, 7, '#C9C2BC') + rect(x + 16, y + 44, w * 0.4, 12, 6, '#E0DAD3'); } return o; };
const tidy = (T, accent) => rect(0, 0, 1440, 900, 0, '#F6F5FA') + [0, 1, 2, 3, 4, 5].map((i) => rect(120, 110 + i * 120, 1200, 92, 16, '#FFFFFF', 'stroke="#E3E0E7"') + `<circle cx="180" cy="${156 + i * 120}" r="18" fill="${i < 4 ? '#17A865' : accent}"/>` + rect(230, 140 + i * 120, 420, 16, 8, '#C8C5CE') + rect(230, 166 + i * 120, 260, 12, 6, '#E3E0E7') + rect(1130, 142 + i * 120, 150, 30, 15, i < 4 ? '#E3F5EC' : '#ECE7FD')).join('');
const beforeAfterSplit = { tags: ['ui', 'before-after', 'comparison', 'split', 'wipe', 'screens', 'saas', 'changelog'], dur: 3.6, inF: 10, outF: 8, d: BA_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c), u = L.u, [x, y, w, h] = box4(p.box, c), r = num(p.radius, 18) * s, k = spring(u, 'panel'), id = 'ba', scr = { ...BA_D.screen, ...(p.screen || {}) };
    const keys = list(p.keys, 16).filter((q) => Array.isArray(q) && Number.isFinite(+q[0])).map((q) => [num(q[0]), clamp(num(q[1], 0.5))]), v = clamp(keys.length ? springTrack(u, [[0, keys[0][1]], ...keys], 'panel') : 0.5);
    const cr = [x, y, w, h], M = screenMap(cr, scr, u, [], [1, 1]), pane = (side, which) => { const sd = { ...scr, ...(which || {}) }; if (!sd.src && !sd.html) { const inner = side === 'b' ? messy(T) : tidy(T, p.accent);
      return `<clipPath id="${id + side}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(r)}"/></clipPath><g clip-path="url(#${id + side})"><g transform="matrix(${f2(M.A)} 0 0 ${f2(M.A)} ${f2(M.X)} ${f2(M.Y)})">${inner}</g></g>`; }
      return screenMarkup(id + side, cr, sd, M, T, p.accent, r); };
    const sx = x + w * v, before = `<clipPath id="${id}v"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(Math.max(0, sx - x))}" height="${f2(h)}"/></clipPath><g clip-path="url(#${id}v)">${pane('b', p.before)}</g>`;
    const fs = 24 * s, pill = (str, px, py, anc, a) => { if (!str || a <= 0.02) return ''; const pw = measure(str, fs, { weight: 800 }) + 36 * s, ph = 46 * s, x0 = anc === 'end' ? px - pw : px; return `<g${op(a)}>${rect(x0, py, pw, ph, ph / 2, anc === 'end' ? p.accent : 'rgba(14,13,20,0.8)')}${text(str, x0 + pw / 2, py + ph / 2 + 8.5 * s, { size: fs, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}</g>`; };
    const hy = y + h / 2, knob = `<rect x="${f2(sx - 2 * s)}" y="${f2(y)}" width="${f2(4 * s)}" height="${f2(h)}" fill="#FFFFFF"/><circle cx="${f2(sx)}" cy="${f2(hy)}" r="${f2(30 * s)}" fill="#FFFFFF" stroke="${T.line}" stroke-width="${f2(1.5 * s)}"/>` +
      `<path d="M${f2(sx - 8 * s)} ${f2(hy - 9 * s)} l${f2(-9 * s)} ${f2(9 * s)} l${f2(9 * s)} ${f2(9 * s)} M${f2(sx + 8 * s)} ${f2(hy - 9 * s)} l${f2(9 * s)} ${f2(9 * s)} l${f2(-9 * s)} ${f2(9 * s)}" fill="none" stroke="${INK}" stroke-width="${f2(3 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const lab = p.label ? labelPill(p.label, x + 20 * s, y + h - 20 * s, 21 * s) : '';
    return `<g${op(clamp(k * 1.8) * (1 - L.out))} transform="translate(0 ${f2((1 - k) * 60 * s)})"><defs>${shadowDef(id + 's', s * 1.6)}</defs>${softShadow(id + 's', x, y, w, h, r, s, 0.9)}${pane('a', p.after)}${before}${knob}` +
      pill(p.before?.label ?? 'Before', x + 22 * s, y + 22 * s, 'start', clamp((v - 0.12) / 0.15)) + pill(p.after?.label ?? 'After', x + w - 22 * s, y + 22 * s, 'end', clamp((0.88 - v) / 0.15)) + lab + '</g>'; } };

/* ---------- 4. notification stack ---------- */
const NS_D = { pos: 'tr', width: 0.3, max: 3, gap: 14, theme: 'light', accent: BRAND, app: 'Acme Flow',
  items: [{ at: 0.2, title: 'Request routed', body: 'Billing question → Billing team', icon: 'branch' }, { at: 0.8, title: 'Request routed', body: 'Bug report → Support', icon: 'branch' }, { at: 1.4, title: 'Reply sent', body: 'Customer told who has it', icon: 'mail' }, { at: 2.0, title: 'All caught up', body: 'Nothing waiting in the inbox', icon: 'check' }] };
const notifyStack = { tags: ['ui', 'notification', 'toast', 'stack', 'alerts', 'activity', 'saas', 'product-demo'], dur: 3.8, inF: 6, outF: 8, d: NS_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c), u = L.u, items = list(p.items, 24).filter((q) => q && Number.isFinite(+q.at)).sort((a, b) => a.at - b.at), W = clamp(num(p.width, 0.3), 0.1, 1) * c.W, hh = 112 * s, gap = num(p.gap, 14) * s, mx = Math.max(1, Math.round(clamp(num(p.max, 3), 1, 12)));
    const S = c.safe, right = p.pos === 'tl' || p.pos === 'bl' ? false : true, x0 = Array.isArray(p.pos) ? num(p.pos[0]) * c.W : right ? S.x1 - W : S.x0, y0 = Array.isArray(p.pos) ? num(p.pos[1]) * c.H : S.y0 + 6 * s, id = 'ns';
    let out = `<defs>${shadowDef(id + 's', s * 1.2)}</defs>`;
    for (let i = 0; i < items.length; i++) { const q = items[i], ka = spring(u - q.at, 'ui'); if (ka <= 0) continue;   /* oldest first: a newer toast is drawn over the ones it pushes down */
      const newer = springTrack(u, items.slice(i + 1).map((z, j) => [z.at, j + 1]).length ? [[0, 0], ...items.slice(i + 1).map((z, j) => [z.at, j + 1])] : [[0, 0]], 'ui'), depth = Math.max(0, newer - (mx - 1));
      const yy = y0 + Math.min(newer, mx - 1) * (hh + gap) + depth * 14 * s, sc = 1 - 0.06 * clamp(depth, 0, 3), a = clamp(ka * 2) * clamp(1 - depth * 0.55), dx = (1 - ka) * (right ? 1 : -1) * 60 * s;
      if (a <= 0.01) continue; const cx = x0 + W / 2, cy = yy + hh / 2;
      out += `<g${op(a * (1 - L.out))} transform="translate(${f2(cx + dx)} ${f2(cy)}) scale(${f2(sc)}) translate(${f2(-cx)} ${f2(-cy)})">${softShadow(id + 's', x0, yy, W, hh, 24 * s, s, 0.9)}${rect(x0, yy, W, hh, 24 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}` +
        rect(x0 + 22 * s, yy + 22 * s, 52 * s, 52 * s, 14 * s, p.accent) + icon(q.icon || 'bolt', x0 + 34 * s, yy + 34 * s, 28 * s, '#FFFFFF', 2.4) + text(String(q.app ?? p.app).toUpperCase(), x0 + 92 * s, yy + 40 * s, { size: 17 * s, weight: 800, fill: T.muted, ls: 1.5 * s }) +
        text(q.time ?? 'now', x0 + W - 22 * s, yy + 40 * s, { size: 17 * s, weight: 600, fill: T.muted, anchor: 'end' }) + text(fit(q.title, 25 * s, W - 120 * s, 800), x0 + 92 * s, yy + 70 * s, { size: 25 * s, weight: 800, fill: T.ink }) +
        text(fit(q.body, 21 * s, W - 120 * s, 500), x0 + 92 * s, yy + 97 * s, { size: 21 * s, weight: 500, fill: T.muted }) + '</g>'; }
    return out; } };

/* ---------- 5. dashboard assemble ---------- */
const DB_D = { box: [0.08, 0.12, 0.84, 0.76], cols: 4, rows: 3, start: 0.15, stagger: 0.08, fly: 0.55, drawAt: 1.0, seed: 3, theme: 'light', accent: BRAND, title: 'Overview', source: 'placeholder data',
  cards: [{ kind: 'kpi', label: 'Requests routed', value: 1284, span: [0, 0, 1, 1] }, { kind: 'kpi', label: 'Median first reply', value: 42, suffix: ' min', span: [1, 0, 1, 1] }, { kind: 'kpi', label: 'Open right now', value: 7, span: [2, 0, 1, 1] },
    { kind: 'donut', label: 'By team', value: 0.64, span: [3, 0, 1, 2] }, { kind: 'line', label: 'Routed per day', span: [0, 1, 3, 1] }, { kind: 'bar', label: 'By topic', span: [0, 2, 2, 1] }, { kind: 'list', label: 'Latest runs', span: [2, 2, 2, 1] }] };
export const dashTimes = (p, i) => { const st = num(p.start, 0.15), sg = Math.max(0, num(p.stagger, 0.08)); return { land: st + i * sg, draw: num(p.drawAt, 1.0) + i * sg * 0.6 }; };
const fmtN = (v, dec = 0) => Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
function cardBody(cd, x, y, w, h, s, T, accent, k, u) {
  const fs = 20 * s, pad = 24 * s; let o = text(cd.label ?? '', x + pad, y + pad + fs * 0.8, { size: fs, weight: 700, fill: T.muted });
  if (cd.kind === 'kpi') { const v = num(cd.value) * E.enter(k); o += text(fmtN(v, num(cd.dec, 0)) + (cd.suffix ?? ''), x + pad, y + h - pad - 6 * s, { size: Math.min(64 * s, h * 0.42), weight: 800, fill: T.ink, ls: -1.5 * s }); }
  else if (cd.kind === 'line') { const n = 14, r = mulberry32(5), pts = Array.from({ length: n }, (_, i) => [x + pad + (i / (n - 1)) * (w - 2 * pad), y + h - pad - (0.18 + 0.62 * (0.5 + 0.35 * Math.sin(i * 0.7) + 0.15 * r())) * (h - 2 * pad - 30 * s)]);
    const d = pts.map(([px, py], i) => (i ? 'L' : 'M') + f2(px) + ' ' + f2(py)).join(' '), len = (w - 2 * pad) * 1.6; o += `<path d="${d}" fill="none" stroke="${accent}" stroke-width="${f2(4 * s)}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${f2(len * E.move(k))} ${f2(len)}"/>`; }
  else if (cd.kind === 'bar') { const vs = [0.5, 0.82, 0.38, 0.66, 0.9, 0.44], bw = (w - 2 * pad) / vs.length; vs.forEach((v, i) => { const bh = v * (h - 2 * pad - 34 * s) * E.enter(clamp(k * 1.4 - i * 0.07)); o += rect(x + pad + i * bw + 6 * s, y + h - pad - bh, bw - 12 * s, bh, 6 * s, i === 4 ? accent : T.faint); }); }
  else if (cd.kind === 'donut') { const R = Math.min(w, h) * 0.3, cx = x + w / 2, cy = y + h / 2 + 18 * s, C = TAU * R, v = clamp(num(cd.value, 0.6)) * E.enter(k);
    o += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="${T.chip}" stroke-width="${f2(R * 0.32)}"/><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(R)}" fill="none" stroke="${accent}" stroke-width="${f2(R * 0.32)}" stroke-dasharray="${f2(C * v)} ${f2(C)}" transform="rotate(-90 ${f2(cx)} ${f2(cy)})"/>`; }
  else if (cd.kind === 'list') { for (let i = 0; i < 3; i++) { const a = clamp(k * 3 - i * 0.5), ry = y + pad + 44 * s + i * 40 * s; if (ry > y + h - 30 * s) break; o += `<g${op(a)}><circle cx="${f2(x + pad + 9 * s)}" cy="${f2(ry)}" r="${f2(9 * s)}" fill="#17A865"/>${rect(x + pad + 30 * s, ry - 7 * s, (w - 2 * pad - 30 * s) * (0.7 - i * 0.12), 14 * s, 7 * s, T.faint)}</g>`; } }
  void u; return o;
}
const dashboardAssemble = { tags: ['ui', 'dashboard', 'cards', 'assemble', 'kpi', 'charts', 'grid', 'saas', 'product-demo'], dur: 4.2, inF: 8, outF: 8, d: DB_D,
  svg(L, p, c) {
    const T = th(p), s = unit(c), u = L.u, [x, y, w, h] = box4(p.box, c), cols = clamp(Math.round(num(p.cols, 4)), 1, 8), rows = clamp(Math.round(num(p.rows, 3)), 1, 8), gap = 20 * s, head = p.title ? 64 * s : 0;
    const cw = (w - gap * (cols - 1)) / cols, ch = (h - head - gap * (rows - 1) - 34 * s) / rows, r = mulberry32(Math.round(num(p.seed, 3)) * 97 + 1), id = 'db', fly = Math.max(0.05, num(p.fly, 0.55));
    let out = `<defs>${shadowDef(id + 's', s)}</defs>` + (p.title ? text(p.title, x, y + 42 * s, { size: 36 * s, weight: 800, fill: T.ink, op: clamp(u / 0.25) }) : '');
    list(p.cards, 16).forEach((cd, i) => { const sp = Array.isArray(cd.span) ? cd.span : [i % cols, Math.floor(i / cols), 1, 1], q = [clamp(Math.round(num(sp[0])), 0, cols - 1), clamp(Math.round(num(sp[1])), 0, rows - 1), clamp(Math.round(num(sp[2], 1)), 1, cols), clamp(Math.round(num(sp[3], 1)), 1, rows)];
      const cx = x + q[0] * (cw + gap), cy = y + head + q[1] * (ch + gap), ww = q[2] * cw + (q[2] - 1) * gap, hh = q[3] * ch + (q[3] - 1) * gap, tm = dashTimes(p, i), dx = (r() - 0.5) * c.W * 0.6, dy = (r() - 0.5) * c.H * 0.7 + c.H * 0.25, rot = (r() - 0.5) * 18;
      const k = clamp(springTrack(u, [[0, 0], [tm.land, 1]], 'panel') , 0, 1.1); if (u < tm.land - 0.02) return; const a = clamp((u - tm.land) / (fly * 0.4)), g = 1 - clamp(k), gx = cx + ww / 2, gy = cy + hh / 2;
      out += `<g${op(a * (1 - L.out))} transform="translate(${f2(dx * g)} ${f2(dy * g)}) rotate(${f2(rot * g)} ${f2(gx)} ${f2(gy)}) translate(${f2(gx)} ${f2(gy)}) scale(${f2(lerp(1, 0.86, g))}) translate(${f2(-gx)} ${f2(-gy)})">${softShadow(id + 's', cx, cy, ww, hh, 18 * s, s, 0.7)}${rect(cx, cy, ww, hh, 18 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`)}` +
        cardBody(cd, cx, cy, ww, hh, s, T, p.accent, clamp((u - tm.draw) / 0.9), u) + '</g>'; });
    out += text('demo data · ' + srcOf(p), x + w, y + h - 4 * s, { size: 21 * s, weight: 600, fill: T.muted, anchor: 'end', op: clamp((u - num(p.start, 0.15)) / 0.3) * (1 - L.out) });
    return out; } };

/* ---------- 6. device mock with a screen insert (device.laptop / device.phone are the frames) ---------- */
const DM_D = { kind: 'laptop', box: null, screen: { src: null, html: null, w: 1440, h: 900, anchor: [0.5, 0] }, zoom: [], kb: [1, 1], theme: 'light', accent: BRAND, label: 'placeholder UI · demo data', color: null };
export function deviceScreenGeo(p, c, L) {
  const ph = p.kind === 'phone', d = SOCIAL[ph ? 'device.phone' : 'device.laptop'].d, b4 = Array.isArray(p.box) && p.box.length === 4 ? p.box : d.box, [x, y, w, h] = [num(b4[0]) * c.W, num(b4[1]) * c.H, Math.max(2, num(b4[2]) * c.W), Math.max(2, num(b4[3]) * c.H)];
  if (ph) { const b = w * 0.045, r = w * 0.16, dy = (1 - E.hero(L.in)) * c.H * 0.4 + E.exit(L.out) * c.H * 0.4; return { cr: [x + b, y + b, w - 2 * b, h - 2 * b], r: r * 0.8, dy, o: 1, box: b4 }; }
  const b = h * 0.035; return { cr: [x + b, y + b, w - 2 * b, h - 2 * b], r: 0, dy: (1 - E.hero(L.in)) * 60 * c.s, o: clamp(L.in * 2) * (1 - L.out), box: b4 };
}
const deviceMock = { tags: ['device', 'laptop', 'phone', 'mockup', 'screen', 'screenshot', 'insert', 'saas', 'product-demo'], dur: 6, inF: 14, outF: 10, d: DM_D,
  svg(L, p, c) {
    const ph = p.kind === 'phone', G = deviceScreenGeo(p, c, L), T = th(p), scr = { ...(ph ? { w: 390, h: 844, anchor: [0.5, 0] } : DM_D.screen), ...(p.screen || {}) }, s = unit(c), id = 'dm';
    const M = screenMap(G.cr, scr, L.u, p.zoom, p.kb, L.total), inner = screenMarkup(id + 'c', G.cr, scr, M, T, p.accent, G.r);
    const fp = { ...SOCIAL[ph ? 'device.phone' : 'device.laptop'].d, box: G.box, ...(p.color ? { color: p.color } : {}), ...(ph ? { taps: [], scroll: [] } : { path: [{ at: 1e6, x: 0.5, y: 0.5 }] }) };
    const frame = SOCIAL[ph ? 'device.phone' : 'device.laptop'].svg(L, fp, c), lab = p.label ? labelPill(p.label, G.cr[0] + 16 * s, G.cr[1] + G.cr[3] - 16 * s, (ph ? 17 : 19) * s) : '';
    return `<g${op(G.o)}><g transform="translate(0 ${f2(G.dy)})">${inner}${lab}</g></g>${frame}`; } };

/* ---------- registry + sound ---------- */
export const SAAS2 = { 'ui.pricingCards': pricingCards, 'ui.integrationGrid': integrationGrid, 'ui.beforeAfterSplit': beforeAfterSplit, 'ui.notifyStack': notifyStack, 'ui.dashboardAssemble': dashboardAssemble, 'device.mock': deviceMock };
export const SAAS2_CUES = {
  'ui.pricingCards': (p) => { const tm = pricingTimes(p), n = Math.min(4, list(p.plans).length); return [...Array.from({ length: n }, (_, i) => ({ t: tm.start + i * tm.stagger, id: 'sfx/ui/pop', why: 'plan card ' + (i + 1) })),
    ...(list(p.plans).some((q) => q && q.featured) ? [{ t: tm.featuredAt, id: 'sfx/ui/price_reveal', why: 'featured plan lifts' }] : [])]; },
  'ui.integrationGrid': (p) => { const n = Math.min(24, list(p.glyphs).length), tm = intTimes(p, n), out = [{ t: 0, id: 'sfx/ui/pop', why: 'hub lands' }]; for (let i = 0; i < n; i += 2) out.push({ t: tm.tile(i), id: 'sfx/ui/tick', why: 'tile ' + (i + 1) }); out.push({ t: tm.line(0), id: 'sfx/ui/connect', why: 'connectors draw on' }); return out; },
  'ui.beforeAfterSplit': (p) => list(p.keys, 16).filter((q) => Array.isArray(q) && Number.isFinite(+q[0])).map((q, i) => ({ t: num(q[0]), id: i ? 'sfx/whoosh/swish_xs' : 'sfx/whoosh/swish_s', why: 'divider moves' })),
  'ui.notifyStack': (p) => list(p.items, 24).filter((q) => q && Number.isFinite(+q.at)).map((q) => ({ t: num(q.at), id: 'sfx/ui/toast_in', why: 'toast: ' + String(q.title ?? '').slice(0, 30) })),
  'ui.dashboardAssemble': (p) => { const n = Math.min(16, list(p.cards).length), out = []; for (let i = 0; i < n; i++) out.push({ t: dashTimes(p, i).land, id: i % 2 ? 'sfx/whoosh/swish_xs' : 'sfx/ui/drop_snap', why: 'card ' + (i + 1) + ' snaps in' });
    out.push({ t: dashTimes(p, 0).draw, id: 'sfx/ui/count_run', why: 'numbers count up' }); return out; },
  'device.mock': (p) => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'device lands' }],
};
for (const g of Object.values(SAAS2)) { const f = g.svg; g.file = 'type/gfx/ui-saas2.js'; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale, s0: c.s } : c); }
