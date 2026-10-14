/* motion-pack / type / gfx / ui-nav.js: UI kit round 3 (2026-10-14), navigation and camera pieces. Same contract and KIT as ui.js / ui-data.js. Own generic layouts;
   demo copy is for a fictional "Acme Voice"; the procedural landing page uses bars for body copy and no third-party logos.
     ui.pageFlythrough  a whole landing page (procedural, or your screenshot via `href`) laid flat on a tilted plane; the camera glides down section by section with a
                        depth-of-field band, then pulls out to the whole page. pageFlyCam(u, params) gives the same camera for a DOM page (true CSS perspective)
     ui.tabPillNav      panel with a tab row; the active pill slides tab to tab on the ui spring (white label revealed under the pill) while the body cross-swaps its list
     ui.windowWall      a wall of browser windows, each running its own looping mini task (typing, cart, chart, list, form, call), the camera tracking across them
     ui.optionPicker    "picks a ...:" slot: option pills spin on a vertical drum and lock on the target (mode 'arc'), or quiz chips get a cursor click (mode 'chips') */
import { E, clamp, lerp, seg, TAU, BRAND, f2, text, hashf, measure } from './core.js';
import { springTrack, spring } from '../ease.js';
import { KIT, rr, TICKS, POPS } from './ui.js'; import { clampIndex } from './safe.js';
const { th, GREEN, AMBER, SPOT, bx, uid, op, rect, shadowDef, softShadow, icon, spinner, checkBadge, cursorSvg, ripple, pressAt } = KIT;
const fade = (L) => op(clamp(L.in * 1.5) * (1 - L.out));
const pill = (x, y, w, h, fill, extra = '') => rect(x, y, w, h, h / 2, fill, extra);
const bar = (x, y, w, h, fill, o = 1) => rect(x, y, w, h, h / 2, fill, o < 1 ? `opacity="${f2(o)}"` : '');

/* ---------- 1. page flythrough ---------- */
const PAGE_W = 1200;
const SECTIONS = [{ kind: 'hero', h: 760 }, { kind: 'features', h: 560 }, { kind: 'integrations', h: 520 }, { kind: 'pricing', h: 640 }, { kind: 'quotes', h: 460 }, { kind: 'footer', h: 260 }];
const pageH = (p) => (p.href ? PAGE_W * p.aspect : p.sections.reduce((a, q) => a + q.h, 0));
/* procedural page in page units (PAGE_W wide): generic Acme Voice landing page, bars for body copy */
function pageSvg(p, T) { const A = p.accent, W = PAGE_W, ink = T.ink, mu = T.faint; let y = 0, o = rect(0, 0, W, pageH(p), 28, T.panel);
  for (const sc of p.sections) { const h = sc.h, cx = W / 2;
    if (sc.kind === 'hero') { o += bar(60, 40, 150, 28, ink) + [0, 1, 2].map((j) => bar(720 + j * 110, 46, 80, 16, mu)).join('') + pill(1030, 30, 120, 48, A);
      o += text(p.headline, cx, 250, { size: 92, weight: 800, fill: ink, anchor: 'middle', ls: -2 }) + bar(cx - 300, 300, 600, 22, mu) + bar(cx - 220, 338, 440, 22, mu) + pill(cx - 210, 400, 200, 64, A) + pill(cx + 10, 400, 200, 64, T.chip);
      o += rect(140, 510, 920, 220, 24, T.bg) + [0, 1, 2, 3].map((j) => rect(180 + j * 220, 550, 190, 140, 18, j === 1 ? A : T.chip, j === 1 ? 'opacity="0.85"' : '')).join(''); }
    if (sc.kind === 'features') { o += text('Built for every call', cx, y + 110, { size: 54, weight: 800, fill: ink, anchor: 'middle' });
      ['spark', 'clock', 'chart', 'user', 'bolt', 'check'].forEach((ic, j) => { const fx = 120 + (j % 3) * 330, fy = y + 170 + Math.floor(j / 3) * 180; o += rect(fx, fy, 300, 150, 22, T.bg) + rect(fx + 26, fy + 26, 66, 66, 18, j % 2 ? T.chip : A, 'opacity="0.95"') + icon(ic, fx + 40, fy + 40, 38, j % 2 ? A : '#FFFFFF', 2.6) + bar(fx + 112, fy + 40, 150, 18, ink, 0.8) + bar(fx + 112, fy + 74, 120, 14, mu); }); }
    if (sc.kind === 'integrations') { o += text('Works with your stack', cx, y + 100, { size: 54, weight: 800, fill: ink, anchor: 'middle' });
      for (let j = 0; j < 18; j++) { const gx = 150 + (j % 6) * 180, gy = y + 170 + Math.floor(j / 6) * 110, ic = ['db', 'mail', 'doc', 'chart', 'box', 'branch'][j % 6]; o += `<circle cx="${gx}" cy="${gy + 40}" r="40" fill="${T.bg}"/>` + icon(ic, gx - 18, gy + 22, 36, j % 4 === 0 ? A : T.muted, 2.4); } }
    if (sc.kind === 'pricing') { o += text('Plans', cx, y + 100, { size: 54, weight: 800, fill: ink, anchor: 'middle' });
      ['Starter', 'Team', 'Scale'].forEach((nm, j) => { const px = 110 + j * 340, py = y + 150, hot = j === 1; o += rect(px, py, 300, 420, 26, hot ? A : T.bg) + text(nm, px + 32, py + 64, { size: 34, weight: 800, fill: hot ? '#FFFFFF' : ink }) + bar(px + 32, py + 100, 140, 40, hot ? '#FFFFFF' : ink, 0.85);
        for (let r = 0; r < 4; r++) o += bar(px + 32, py + 180 + r * 42, 200 - r * 18, 14, hot ? '#FFFFFF' : mu, hot ? 0.6 : 1); o += pill(px + 32, py + 340, 236, 54, hot ? '#FFFFFF' : T.panel); }); }
    if (sc.kind === 'quotes') [0, 1, 2].forEach((j) => { const qx = 90 + j * 350, qy = y + 80; o += rect(qx, qy, 320, 300, 24, T.bg) + text('“', qx + 30, qy + 90, { size: 90, weight: 800, fill: A }) + [0, 1, 2, 3].map((r) => bar(qx + 30, qy + 120 + r * 34, 250 - r * 30, 14, mu)).join('') + `<circle cx="${qx + 56}" cy="${qy + 250}" r="24" fill="${T.chip}"/>` + bar(qx + 96, qy + 240, 120, 16, ink, 0.7); });
    if (sc.kind === 'footer') { o += rect(0, y, W, h, 0, T.bg) + bar(60, y + 60, 150, 26, ink) + [0, 1, 2, 3].map((j) => [0, 1, 2].map((r) => bar(420 + j * 190, y + 60 + r * 40, 120, 14, mu)).join('')).join(''); }
    y += h; } return o; }
/* camera: focus (page-height fraction) glides through the stops on the camera spring; at pullAt it pulls out to the whole page and the depth of field opens */
export function pageFlyCam(u, params = {}) { const p = { ...UI3['ui.pageFlythrough'].d, ...params }, stops = [{ t: 0, v: p.stops[0][1] }, ...p.stops.map(([t, v]) => ({ t, v })), { t: p.pullAt, v: 0.5 }];
  const focus = springTrack(u, stops, 'camera'), pull = clamp(springTrack(u, [[0, 0], [p.pullAt, 1]], 'camera'), 0, 1), zoom = lerp(p.zoom, p.fit, pull);
  return { focus, zoom, pull, blur: p.blur * (1 - pull), transform: `perspective(2000px) rotateX(${f2(p.tiltX * (1 - 0.4 * pull))}deg) rotateZ(${f2(-p.tilt)}deg) scale(${f2(zoom)}) translateY(${f2(-(focus - 0.5) * 100)}%)` }; }
/* ---------- 2. tab pill nav ---------- */
const TABS = [{ label: 'Calls', icon: 'play', items: [['Reschedule delivery', 'Resolved · 1 min'], ['Order status', 'Resolved'], ['Refund question', 'Sent to team']] },
  { label: 'Voices', icon: 'user', items: [['Warm', 'Default for support'], ['Calm', 'Night shift'], ['Upbeat', 'Sales line']] },
  { label: 'Flows', icon: 'branch', items: [['Booking', '4 steps'], ['Returns', '6 steps'], ['After hours', '3 steps']] },
  { label: 'Insights', icon: 'chart', items: [['Busiest hour', 'Shown in the weekly report'], ['Top intents', 'Booking, status, refunds'], ['Handoffs', 'Reasons, by week']] }];
export const tabGeo = (p, s, x0) => { let x = x0; return p.tabs.map((tb) => { const w = measure(tb.label, 24 * s, { weight: 700 }) + 74 * s, g = { x, w }; x += w + 8 * s; return g; }); };
/* ---------- 3. window wall ---------- */
const SPIN3 = 3 * 360 / 414;   // spinner time for exactly 3 turns, so a spinner driven by a loop phase 0..1 loops seamlessly
const KINDS = ['typing', 'cart', 'chart', 'list', 'form', 'call'];
function winContent(kind, x, y, w, h, k, s, T, A, seed) { let o = ''; const pad = 26 * s;
  if (kind === 'typing') for (let r = 0; r < 5; r++) { const full = (0.55 + 0.4 * hashf(seed, r)) * (w - 2 * pad), part = clamp(k * 5 - r); if (part > 0) o += bar(x + pad, y + pad + r * 40 * s, full * part, 16 * s, r ? T.faint : T.ink, r ? 1 : 0.8); }
  if (kind === 'cart') { for (let r = 0; r < 3; r++) { const a = clamp((k - r * 0.22) / 0.12); if (a <= 0) continue; const ry = y + pad + r * 66 * s; o += `<g${op(a)}>${rect(x + pad, ry, 48 * s, 48 * s, 10 * s, [A, AMBER, GREEN][r], 'opacity="0.85"')}${bar(x + pad + 64 * s, ry + 8 * s, 150 * s, 14 * s, T.ink, 0.8)}${bar(x + pad + 64 * s, ry + 30 * s, 90 * s, 12 * s, T.faint)}</g>`; }
    o += pill(x + w - pad - 150 * s, y + h - pad - 50 * s, 150 * s, 50 * s, k > 0.75 ? GREEN : A) + (k > 0.75 ? icon('check', x + w - pad - 90 * s, y + h - pad - 39 * s, 28 * s, '#FFF', 2.6 * s) : bar(x + w - pad - 115 * s, y + h - pad - 31 * s, 80 * s, 12 * s, '#FFFFFF', 0.85)); }
  if (kind === 'chart') { const n = 6, bw = (w - 2 * pad) / n; for (let j = 0; j < n; j++) { const v = (0.3 + 0.65 * hashf(seed, j)) * E.enter(clamp(k * 1.6 - j * 0.1)), bh = (h - 2 * pad) * v; o += rect(x + pad + j * bw + bw * 0.18, y + h - pad - bh, bw * 0.64, bh, 6 * s, j === n - 2 ? A : T.faint); } }
  if (kind === 'list') for (let r = 0; r < 4; r++) { const ry = y + pad + 18 * s + r * 52 * s, dn = k > (r + 1) * 0.2; o += (dn ? `<circle cx="${f2(x + pad + 14 * s)}" cy="${f2(ry)}" r="${f2(14 * s)}" fill="${GREEN}"/>` + icon('check', x + pad + 3 * s, ry - 11 * s, 22 * s, '#FFF', 2.8 * s) : `<circle cx="${f2(x + pad + 14 * s)}" cy="${f2(ry)}" r="${f2(12 * s)}" fill="none" stroke="${T.faint}" stroke-width="${f2(2.4 * s)}"/>`) + bar(x + pad + 42 * s, ry - 8 * s, (150 + 60 * hashf(seed, r)) * s, 16 * s, dn ? T.ink : T.faint, dn ? 0.75 : 1); }
  if (kind === 'form') { for (let r = 0; r < 3; r++) { const ry = y + pad + r * 70 * s, f = clamp((k - r * 0.2) / 0.18); o += bar(x + pad, ry, 70 * s, 10 * s, T.faint) + rect(x + pad, ry + 18 * s, w - 2 * pad, 38 * s, 9 * s, T.bg, `stroke="${T.line}" stroke-width="${f2(1.2 * s)}"`) + (f > 0 ? bar(x + pad + 12 * s, ry + 31 * s, (w - 2 * pad - 60 * s) * (0.4 + 0.5 * hashf(seed, r)) * f, 12 * s, T.ink, 0.75) : ''); }
    const pr = k > 0.72 && k < 0.8 ? 1 : 0; o += pill(x + pad, y + h - pad - 44 * s, 140 * s * (1 - 0.06 * pr), 44 * s, k > 0.8 ? GREEN : A); }
  if (kind === 'call') { const n = 22, bw = (w - 2 * pad) / n, env = Math.sin(Math.PI * clamp(k)); for (let j = 0; j < n; j++) { const a = 0.15 + 0.85 * env * (0.5 + 0.5 * Math.sin(TAU * (1.3 + 2 * hashf(seed, j)) * k * 3 + TAU * hashf(j, seed))), bh = Math.max(6 * s, (h - 2 * pad - 60 * s) * a);
      o += rect(x + pad + j * bw + bw * 0.25, y + (h - 40 * s) / 2 - bh / 2, bw * 0.5, bh, bw * 0.25, j % 5 === 0 ? A : T.faint); } o += bar(x + pad, y + h - pad - 22 * s, 120 * s, 16 * s, T.ink, 0.7); }
  return o; }
/* ---------- 4. option picker ---------- */
const drumIdx = (u, p) => p.target - p.turns * p.options.length * (1 - E.expoOut(seg(u, p.spinAt, p.lockAt)));

export const UI3 = {
  'ui.pageFlythrough': { file: 'type/gfx/ui-nav.js', tags: ['ui', 'landing-page', 'website', 'camera', 'flythrough', 'depth-of-field', 'perspective', 'product-film'], dur: 5.6, inF: 8, outF: 8,
    d: { box: [0, 0, 1, 1], sections: SECTIONS, headline: 'Acme Voice', href: null, aspect: 2.8, stops: [[0.15, 0.12], [1.15, 0.32], [2.15, 0.52], [3.15, 0.73]], pullAt: 4.2, zoom: 1.25, fit: 0.32,
      tilt: 14, squash: 0.62, tiltX: 48, band: 0.36, blur: 7, bg: null, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [vx, vy, vw, vh] = bx(p.box, c), id = uid('pf', vx, vy, vw, vh), PH = pageH(p), cam = pageFlyCam(u, p), cx = vx + vw / 2, cy = vy + vh / 2, z = cam.zoom * s * (vw / c.W);
      const M = `translate(${f2(cx)} ${f2(cy)}) scale(1 ${f2(lerp(p.squash, 1 - (1 - p.squash) * 0.5, cam.pull))}) rotate(${f2(-p.tilt)}) scale(${f2(z)}) translate(${f2(-PAGE_W / 2)} ${f2(-cam.focus * PH)})`;
      const page = p.href ? `<image href="${p.href}" x="0" y="0" width="${PAGE_W}" height="${f2(PH)}" preserveAspectRatio="xMidYMin slice"/>` : pageSvg(p, T);
      const shadow = `<g transform="${M}" opacity="0.28" filter="url(#${id}sh)">${rect(-10, 40, PAGE_W + 20, PH, 28, '#1A1726')}</g>`, bl = cam.blur * s;
      const band = p.band * vh * (1 + 2 * cam.pull), feather = 0.18 * vh, mask = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(cy - band / 2 - feather)}" x2="0" y2="${f2(cy + band / 2 + feather)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${f2(feather / (band + 2 * feather))}" stop-color="#fff"/><stop offset="${f2(1 - feather / (band + 2 * feather))}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m" maskUnits="userSpaceOnUse" x="${f2(vx)}" y="${f2(vy)}" width="${f2(vw)}" height="${f2(vh)}"><rect x="${f2(vx)}" y="${f2(vy)}" width="${f2(vw)}" height="${f2(vh)}" fill="url(#${id}g)"/></mask>`;
      const body = bl > 0.25 ? `<g filter="url(#${id}b)"><g transform="${M}">${page}</g></g><g mask="url(#${id}m)"><g transform="${M}">${page}</g></g>` : `<g transform="${M}">${page}</g>`;
      return `<defs><filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f2(bl)}"/></filter><filter id="${id}sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f2(30 * s)}"/></filter>${mask}<clipPath id="${id}c"><rect x="${f2(vx)}" y="${f2(vy)}" width="${f2(vw)}" height="${f2(vh)}"/></clipPath></defs>` +
        `<g clip-path="url(#${id}c)"${fade(L)}>${p.bg ? rect(vx, vy, vw, vh, 0, p.bg) : ''}${shadow}${body}</g>`; } },

  'ui.tabPillNav': { file: 'type/gfx/ui-nav.js', tags: ['ui', 'tabs', 'navigation', 'feature-tour', 'pill', 'panel', 'cursor', 'product-film'], dur: 4.6, inF: 8, outF: 8,
    d: { box: [0.2, 0.15, 0.6, 0.7], title: 'Acme Voice', tabs: TABS, steps: [[1.0, 1], [1.9, 2], [2.8, 3]], first: 0, cursor: true, theme: 'light', accent: BRAND },
    svg(L, p0, c) { const nT = p0.tabs.length, p = { ...p0, first: clampIndex(p0.first, nT), steps: p0.steps.map(([t, i]) => [t, clampIndex(i, nT)]) }; const T = th(p), s = c.s, u = L.u, [x, y, w, h] = bx(p.box, c), id = uid('tp', x, y, w, h), pad = 34 * s, k = spring(u, 'panel'), ty = y + 92 * s, th2 = 56 * s, G = tabGeo(p, s, x + pad + 8 * s);
      const ch = [{ t: 0, v: p.first }, ...p.steps.map(([t, i]) => ({ t, v: i }))], track = (f) => springTrack(u, ch.map((q) => ({ t: q.t, v: f(G[q.v]) })), 'ui'), px = track((g) => g.x), pw = track((g) => g.w);
      let ai = p.first, ti = 0; p.steps.forEach(([t, i], j) => { if (u >= t) { ai = i; ti = j + 1; } }); const prevI = ti > 0 ? (ti > 1 ? p.steps[ti - 2][1] : p.first) : null, uc = ti > 0 ? u - p.steps[ti - 1][0] : u, dir = prevI == null ? 1 : Math.sign(ai - prevI) || 1;
      const labels = (fill) => p.tabs.map((tb, i) => icon(tb.icon || 'doc', G[i].x + 18 * s, ty + th2 / 2 - 11 * s, 22 * s, fill === 'act' ? '#FFFFFF' : T.muted, 2.2 * s) + text(tb.label, G[i].x + 48 * s, ty + th2 / 2 + 8 * s, { size: 24 * s, weight: 700, fill: fill === 'act' ? '#FFFFFF' : T.muted })).join('');
      const tabRow = rect(x + pad, ty - 6 * s, G.at(-1).x + G.at(-1).w - x - pad + 14 * s, th2 + 12 * s, (th2 + 12 * s) / 2, T.chip) + labels('m') + `<clipPath id="${id}p"><rect x="${f2(px)}" y="${f2(ty)}" width="${f2(pw)}" height="${f2(th2)}" rx="${f2(th2 / 2)}"/></clipPath>` + pill(px, ty, pw, th2, p.accent) + `<g clip-path="url(#${id}p)">${labels('act')}</g>`;
      const list = (tab, uu, sign, leaving) => { const items = p.tabs[tab].items || []; let o = ''; items.forEach((it, r) => { const ry = ty + th2 + 44 * s + r * 92 * s, kk = leaving ? 1 - seg(uu, 0, 0.14) : spring(uu - 0.1 - r * 0.06, 'ui'); if (kk <= 0) return;
        const dx = leaving ? -sign * 50 * s * seg(uu, 0, 0.14) : sign * 60 * s * (1 - kk); o += `<g${op(kk)} transform="translate(${f2(dx)} 0)">` + rect(x + pad, ry, w - 2 * pad, 76 * s, 16 * s, T.bg) + rect(x + pad + 16 * s, ry + 14 * s, 48 * s, 48 * s, 12 * s, [p.accent, GREEN, AMBER, SPOT][r % 4], 'opacity="0.9"') +
          icon(p.tabs[tab].icon || 'doc', x + pad + 28 * s, ry + 26 * s, 24 * s, '#FFFFFF', 2.4 * s) + text(it[0], x + pad + 84 * s, ry + 34 * s, { size: 25 * s, weight: 700, fill: T.ink }) + text(it[1] || '', x + pad + 84 * s, ry + 61 * s, { size: 19 * s, weight: 600, fill: T.muted }) + '</g>'; }); return o; };
      const body = (prevI != null && uc < 0.15 ? list(prevI, uc, dir, true) : '') + list(ai, ti > 0 ? uc : u - 0.2, dir, false);
      const tg = (i) => [G[i].x + G[i].w / 2, ty + th2 / 2 + 4 * s], cur = p.cursor && p.steps.length ? (() => { const keys = [{ t: 0, v: [x + w * 0.8, y + h * 0.9] }, ...p.steps.map(([t, i]) => ({ t: t - 0.5, v: tg(i) }))], [qx, qy] = springTrack(u, keys, 'panel');
        const pr = p.steps.reduce((a, [t]) => Math.max(a, pressAt(u, t)), 0), co = seg(u, 0.2, 0.45) * (1 - seg(u, p.steps.at(-1)[0] + 0.4, p.steps.at(-1)[0] + 0.7)); return co > 0 ? `<g${op(co)}>${cursorSvg(qx, qy, 1.4 * s, pr)}</g>` : ''; })() : '';
      const rip = p.steps.map(([t, i]) => ripple(tg(i)[0], tg(i)[1], u - t, s, p.accent)).join('');
      return `<defs>${shadowDef(id + 's', s)}<clipPath id="${id}b"><rect x="${f2(x)}" y="${f2(ty + th2 + 20 * s)}" width="${f2(w)}" height="${f2(y + h - ty - th2 - 20 * s)}"/></clipPath></defs><g${fade(L)} transform="translate(0 ${f2(20 * s * (1 - k))})">${softShadow(id + 's', x, y, w, h, 28 * s, s)}${rect(x, y, w, h, 28 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.5 * s)}"`)}` +
        [0, 1, 2].map((j) => `<circle cx="${f2(x + (32 + 24 * j) * s)}" cy="${f2(y + 40 * s)}" r="${f2(7 * s)}" fill="${T.faint}"/>`).join('') + text(p.title, x + w / 2, y + 48 * s, { size: 22 * s, weight: 700, fill: T.muted, anchor: 'middle' }) + tabRow + `<g clip-path="url(#${id}b)">${body}</g>${rip}</g><g${op(1 - L.out)}>${cur}</g>`; } },

  'ui.windowWall': { file: 'type/gfx/ui-nav.js', tags: ['ui', 'browser', 'agents', 'parallel', 'wall', 'camera', 'ai-at-work', 'product-film'], dur: 5.4, inF: 8, outF: 8,
    d: { box: [0, 0.14, 1, 0.72], count: 9, kinds: KINDS, winW: 560, winH: 380, gap: 44, period: 2.2, panAt: 0.2, panDur: 4.6, label: '9 tasks running in parallel', url: 'acme.example', theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, [vx, vy, vw, vh] = bx(p.box, c), id = uid('ww', vx, vy, vw, vh), ww = p.winW * s, wh = p.winH * s, gap = p.gap * s, total = p.count * ww + (p.count - 1) * gap;
      const pan = E.cam(seg(u, p.panAt, p.panAt + p.panDur)), x0 = vx + (vw - ww) / 2 - lerp(0, Math.max(0, total - ww), pan) + lerp(vw * 0.18, 0, E.enter(seg(u, 0, 0.8))), cy = vy + vh / 2 + 20 * s;
      let o = ''; for (let i = 0; i < p.count; i++) { const wx = x0 + i * (ww + gap), wy = cy - wh / 2 + (i % 2 ? 26 : -26) * s; if (wx > vx + vw + 40 * s || wx + ww < vx - 40 * s) continue; const kk = spring(u - 0.05 - i * 0.07, 'ui'); if (kk <= 0) continue;
        const ph = u < 0.25 ? -1 : (u - 0.25) / p.period + hashf(i, 3) * 0.8, lk = ph < 0 ? 0 : ph - Math.floor(ph), rst = ph < 0 ? 1 : 1 - seg(lk, 0.9, 1), kind = p.kinds[i % p.kinds.length], dn = lk > 0.82 && ph >= 0;
        o += `<g${op(clamp(kk * 1.4))} transform="translate(0 ${f2(30 * s * (1 - kk))})">${softShadow(id + 's', wx, wy, ww, wh, 18 * s, s, 0.8)}${rect(wx, wy, ww, wh, 18 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.4 * s)}"`)}` +
          rect(wx, wy, ww, 48 * s, 18 * s, T.chip) + rect(wx, wy + 30 * s, ww, 18 * s, 0, T.chip) + [0, 1, 2].map((j) => `<circle cx="${f2(wx + (22 + 18 * j) * s)}" cy="${f2(wy + 24 * s)}" r="${f2(5.5 * s)}" fill="${T.faint}"/>`).join('') +
          pill(wx + 86 * s, wy + 11 * s, ww - 150 * s, 26 * s, T.panel) + text(`${p.url}/${kind}`, wx + 102 * s, wy + 29 * s, { size: 16 * s, weight: 600, fill: T.muted }) +
          (dn ? checkBadge(wx + ww - 32 * s, wy + 24 * s, 11 * s, (lk - 0.82) * p.period, GREEN) : spinner(wx + ww - 32 * s, wy + 24 * s, 9 * s, lk * SPIN3, p.accent, 2.6 * s)) +
          `<g${op(rst)}>${winContent(kind, wx, wy + 48 * s, ww, wh - 48 * s, ph < 0 ? 0 : lk / 0.85, s, T, p.accent, i + 1)}</g></g>`; }
      const lk2 = spring(u - 0.3, 'ui'), lw = p.label ? measure(p.label, 24 * s, { weight: 700 }) + 70 * s : 0, lx = vx + vw / 2 - lw / 2;
      const lab = p.label ? `<g${op(lk2)}>${pill(lx, vy - 10 * s, lw, 50 * s, T.panel, `stroke="${T.line}" stroke-width="${f2(1.4 * s)}"`)}${spinner(lx + 27 * s, vy + 15 * s, 9 * s, (((u / p.period) % 1) + 1) % 1 * SPIN3, p.accent, 2.8 * s)}${text(p.label, lx + 50 * s, vy + 23 * s, { size: 24 * s, weight: 700, fill: T.ink })}</g>` : '';
      return `<defs>${shadowDef(id + 's', s)}</defs><g${fade(L)}>${o}${lab}</g>`; } },

  'ui.optionPicker': { file: 'type/gfx/ui-nav.js', tags: ['ui', 'picker', 'options', 'choice', 'quiz', 'chips', 'slot', 'cursor', 'product-film'], dur: 3.4, inF: 8, outF: 8,
    d: { center: [0.5, 0.5], prompt: 'Acme Voice picks a tone:', options: ['Warm', 'Calm', 'Upbeat', 'Formal', 'Playful', 'Concise'], target: 1, mode: 'arc', spinAt: 0.35, lockAt: 1.75, turns: 2, cursor: true, theme: 'light', accent: BRAND },
    svg(L, p, c) { const T = th(p), s = c.s, u = L.u, cx = p.center[0] * c.W, cy = p.center[1] * c.H, id = uid('op', cx, cy, p.options.length), n = p.options.length, fs = 40 * s, lockK = spring(u - p.lockAt, 'headline'), locked = u >= p.lockAt;
      const pw = Math.max(...p.options.map((q) => measure(q, fs, { weight: 800 }))) + 80 * s, ph = 76 * s, k = spring(u, 'panel');
      if (p.mode === 'chips') { const cols = Math.min(3, n), gw = 280 * s, gh = 92 * s, gx0 = cx - (cols * gw) / 2, gy0 = cy - 10 * s, tgt = [gx0 + (p.target % cols) * gw + gw / 2, gy0 + Math.floor(p.target / cols) * gh + gh / 2];
        let o = text(p.prompt, cx, gy0 - 50 * s, { size: 44 * s, weight: 800, fill: T.ink, anchor: 'middle' }); p.options.forEach((q, i) => { const bx2 = gx0 + (i % cols) * gw + 10 * s, by2 = gy0 + Math.floor(i / cols) * gh + 10 * s, kk = spring(u - 0.1 - i * 0.05, 'ui'), sel = locked && i === p.target, dim = locked && !sel;
          if (kk > 0) o += `<g${op(kk * (dim ? 1 - 0.55 * seg(u, p.lockAt, p.lockAt + 0.3) : 1))}>${pill(bx2, by2, gw - 20 * s, gh - 20 * s, sel ? p.accent : T.panel, sel ? '' : `stroke="${T.line}" stroke-width="${f2(1.6 * s)}"`)}${text(q, bx2 + (gw - 20 * s) / 2 + (sel ? 14 * s : 0), by2 + (gh - 20 * s) / 2 + 10 * s, { size: 28 * s, weight: 700, fill: sel ? '#FFFFFF' : T.ink, anchor: 'middle' })}${sel ? checkBadge(bx2 + 34 * s, by2 + (gh - 20 * s) / 2, 13 * s, u - p.lockAt, '#FFFFFF', p.accent) : ''}</g>`; });
        const pr = pressAt(u, p.lockAt), [qx, qy] = springTrack(u, [[0, [cx + 420 * s, cy + 300 * s]], [p.spinAt, [tgt[0] - 160 * s, tgt[1] + 120 * s]], [p.lockAt - 0.55, [tgt[0] + 6 * s, tgt[1] + 8 * s]]], 'panel'), co = p.cursor ? seg(u, 0.2, 0.4) * (1 - seg(u, p.lockAt + 0.5, p.lockAt + 0.8)) : 0;
        return `<g${fade(L)} transform="translate(0 ${f2(16 * s * (1 - k))})">${o}${ripple(tgt[0], tgt[1], u - p.lockAt, s, p.accent)}</g>` + (co > 0 ? `<g${op(co * (1 - L.out))}>${cursorSvg(qx, qy, 1.4 * s, pr)}</g>` : ''); }
      const idx = drumIdx(u, p), R = 210 * s, step = 0.5, pwid = measure(p.prompt, 50 * s, { weight: 800 }), gapX = 30 * s, tot = pwid + gapX + pw, px0 = cx - tot / 2, sx = px0 + pwid + gapX;
      let o = text(p.prompt, px0, cy + 17 * s, { size: 50 * s, weight: 800, fill: T.ink }); const f0 = Math.floor(idx);
      for (let j = f0 - 3; j <= f0 + 4; j++) { const th3 = (j - idx) * step; if (Math.abs(th3) > 1.35) continue; const q = p.options[((j % n) + n) % n], cs = Math.cos(th3), yy = cy + R * Math.sin(th3), sc = 0.55 + 0.45 * cs, isT = Math.abs(j - idx) < 1e-6 && locked, a = cs * cs * (locked && !isT ? 1 - 0.75 * seg(u, p.lockAt, p.lockAt + 0.3) : 1);
        const g = `<g transform="translate(${f2(sx + pw / 2 + 40 * s * (1 - cs))} ${f2(yy)}) scale(${f2(sc * (isT ? 1 + 0.06 * Math.sin(Math.PI * clamp(lockK)) : 1))})"${op(a)}>${pill(-pw / 2, -ph / 2, pw, ph, isT ? p.accent : T.panel, isT ? '' : `stroke="${T.line}" stroke-width="${f2(1.6 * s)}"`)}${text(q, 0, fs * 0.36, { size: fs, weight: 800, fill: isT ? '#FFFFFF' : T.ink, anchor: 'middle' })}</g>`; o += g; }
      o += rect(sx - 10 * s, cy - ph / 2 - 10 * s, pw + 20 * s, ph + 20 * s, (ph + 20 * s) / 2, 'none', `stroke="${locked ? p.accent : T.faint}" stroke-width="${f2(2.5 * s)}" opacity="${f2(locked ? 0.9 : 0.6)}"`) + (locked ? checkBadge(sx + pw + 34 * s, cy, 18 * s, u - p.lockAt, GREEN) : '');
      const fadeMask = `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(cy - R * 1.1)}" x2="0" y2="${f2(cy + R * 1.1)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff"/><stop offset="0.65" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
      return `<defs>${fadeMask}<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="${f2(cy - R * 1.2)}" width="${c.W}" height="${f2(R * 2.4)}"><rect x="0" y="${f2(cy - R * 1.2)}" width="${c.W}" height="${f2(R * 2.4)}" fill="url(#${id}g)"/><rect x="0" y="${f2(cy - 40 * s)}" width="${f2(sx - 20 * s)}" height="${f2(80 * s)}" fill="#fff"/></mask></defs><g${fade(L)} transform="translate(0 ${f2(16 * s * (1 - k))})"><g mask="url(#${id}m)">${o}</g></g>`; } },
};
for (const g of Object.values(UI3)) { const f = g.svg; g.d.scale = 1; g.svg = (L, p, c) => f(L, p, p.scale && p.scale !== 1 ? { ...c, s: c.s * p.scale } : c); }

export const UI3_CUES = {
  'ui.pageFlythrough': (p) => [...p.stops.slice(1).map(([t], i) => ({ t, id: rr(['sfx/whoosh/swish_xs', 'sfx/whoosh/swish_s'], i), why: 'camera glides to the next section' })), { t: p.pullAt, id: 'sfx/whoosh/whoosh_m', why: 'pull out to the whole page' }],
  'ui.tabPillNav': (p) => p.steps.flatMap(([t], i) => [{ t, id: p.cursor ? rr(['sfx/ui/click', 'sfx/device/mouse_click'], i) : rr(TICKS, i), why: 'tab ' + (i + 2) + ' picked' }, { t: t + 0.04, id: rr(['sfx/ui/slide', 'sfx/whoosh/swish_xs'], i), why: 'pill slides, list swaps' }]),
  'ui.windowWall': (p) => [...Array.from({ length: Math.min(p.count, 6) }, (_, i) => ({ t: 0.05 + i * 0.07, id: rr(POPS, i), why: 'window ' + (i + 1) + ' lands' })).filter((_, i) => i % 2 === 0), { t: p.panAt, id: 'sfx/whoosh/whoosh_l', why: 'camera tracks across the wall' }],
  'ui.optionPicker': (p) => { if (p.mode === 'chips') return [{ t: p.lockAt, id: 'sfx/ui/click', why: 'chip clicked' }, { t: p.lockAt + 0.05, id: 'sfx/ui/success', why: 'choice locked' }];
    const out = []; let last = Math.floor(drumIdx(p.spinAt, p)), i = 0; for (let t = p.spinAt; t < p.lockAt; t += 1 / 60) { const v = Math.floor(drumIdx(t, p) + 1e-9); if (v !== last && (!out.length || t - out.at(-1).t > 0.06)) out.push({ t: +t.toFixed(4), id: rr(TICKS, i++), why: 'option passes the slot' }); last = v; }
    return [...out, { t: p.lockAt, id: 'sfx/ui/success', why: 'option locks' }]; },
};
