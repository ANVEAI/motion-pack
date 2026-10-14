/* motion-pack / type / gfx / brand.js: round-3 brand-system layouts (2026-10-14). Same contract as every gfx item (core.js); pure functions of t, plain SVG.
     layout.paletteColumns    brand palette as vertical swatch columns with name + hex labels that rise in, then re-flow into horizontal stripes
     layout.logoConstruction  a mark built on a construction grid: guides and circles draw on, a primitive's bezier handles pull it into the mark, guides fade, the mark fills
     layout.mockupInContext   a comp (any gfx id, an image, or a placeholder poster) placed on a surface in an owned procedural plate (billboard, stage, CRT),
                              with occluders in front of it (a passer-by, audience heads) and an optional real matte image on top
     layout.typeSpecimen      the same name stacked at stepping weights with a scrolling highlight row, then collapsing to one weight with its label
     layout.backdropSwap      one lockup held still while the backdrop swaps on the beat (grid paper, colour, black, photo), the ink flipping for contrast;
                              loop: false stops on the last backdrop (an end card)
     layout.lineup            N products or colourways slide into an even row with labels under each, a centred title and an availability line
   Every mark, product and plate here is owned procedural art: never a third-party logo, product or photo. Craft learned from public brand films (round-3 study,
   October 2026): techniques only, no brand, footage, wording or sequence is reproduced. Owned code. */
import { E, clamp, lerp, seg, TAU, mulberry32, FONT, MONO, BRAND, INK, PAPER, f2, esc, text, measure, uidOf, blurDef, blurAttr, inkOn, lum, ctxFor } from './core.js';
import { slotMedia, photoTile, DEFAULT_MARK } from './media.js';
import { hooks } from './ui.js';

/* a closed shape as 4+ cubic segments in a 100 box: seg = [ax, ay, c1x, c1y, c2x, c2y]; the next segment's anchor ends this one */
const K = 46 * 0.5523;
export const CIRCLE4 = [[50, 4, 50 + K, 4, 96, 50 - K], [96, 50, 96, 50 + K, 50 + K, 96], [50, 96, 50 - K, 96, 4, 50 + K], [4, 50, 4, 50 - K, 50 - K, 4]];
export const SPARK4 = [[50, 4, 54, 34, 66, 46], [96, 50, 66, 54, 54, 66], [50, 96, 46, 66, 34, 54], [4, 50, 34, 46, 46, 34]];   // = media.js DEFAULT_MARK
const segPath = (sg, X, Y) => 'M' + `${f2(X(sg[0][0]))} ${f2(Y(sg[0][1]))}` + sg.map((s, i) => { const n = sg[(i + 1) % sg.length]; return ` C${f2(X(s[2]))} ${f2(Y(s[3]))} ${f2(X(s[4]))} ${f2(Y(s[5]))} ${f2(X(n[0]))} ${f2(Y(n[1]))}`; }).join('') + ' Z';
const rrPath = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f2(x + r)} ${f2(y)} H${f2(x + w - r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w)} ${f2(y + r)} V${f2(y + h - r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w - r)} ${f2(y + h)} H${f2(x + r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x)} ${f2(y + h - r)} V${f2(y + r)} A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + r)} ${f2(y)} Z`; };
const WEIGHT_NAMES = { 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
const PEN = 'M0 0 L8 22 L0 17 L-8 22 Z';

/* procedural plates for layout.mockupInContext: { back(u, c, p) -> markup under the surface, scr: [x, y, w, h] fractions, rx (fraction of H), front(u, c, p) -> occluders } */
function walker(u, c, p) {
  if (!p.walker || u < p.walkerAt) return ''; const hh = 0.66 * c.H, x = -0.12 * c.W + p.walkSpeed * c.W * (u - p.walkerAt); if (x > 1.12 * c.W) return '';
  const ph = TAU * 1.7 * (u - p.walkerAt), fy = 0.95 * c.H - Math.abs(Math.sin(ph)) * 0.012 * hh, sw = Math.sin(ph), limb = (ox, oy, len, wd, deg) => `<rect x="${f2(-wd / 2)}" y="0" width="${f2(wd)}" height="${f2(len)}" rx="${f2(wd / 2)}" transform="translate(${f2(ox)} ${f2(oy)}) rotate(${f2(deg)})"/>`;
  return `<ellipse cx="${f2(x)}" cy="${f2(0.955 * c.H)}" rx="${f2(0.12 * hh)}" ry="${f2(0.018 * hh)}" fill="#000" opacity="0.25"/><g fill="#16161B" transform="translate(${f2(x)} ${f2(fy)})">` +
    limb(0, -0.46 * hh, 0.45 * hh, 0.075 * hh, 24 * sw) + limb(0, -0.46 * hh, 0.45 * hh, 0.075 * hh, -24 * sw) + `<rect x="${f2(-0.11 * hh)}" y="${f2(-0.85 * hh)}" width="${f2(0.22 * hh)}" height="${f2(0.44 * hh)}" rx="${f2(0.07 * hh)}"/>` +
    limb(-0.07 * hh, -0.8 * hh, 0.38 * hh, 0.06 * hh, -20 * sw) + limb(0.07 * hh, -0.8 * hh, 0.38 * hh, 0.06 * hh, 20 * sw) + `<circle cx="0" cy="${f2(-0.93 * hh)}" r="${f2(0.068 * hh)}"/></g>`;
}
export const PLATES = {
  billboard: { scr: [0.18, 0.158, 0.64, 0.524], rx: 0.004,
    back(u, c) { let o = `<rect width="${c.W}" height="${c.H}" fill="#CFC9BF"/>`; for (let y = 0.06; y < 0.86; y += 0.06) o += `<rect x="0" y="${f2(y * c.H)}" width="${c.W}" height="${f2(1.5 * c.s)}" fill="#BDB6AA"/>`;
      for (let x = 0.045; x < 1; x += 0.09) o += `<rect x="${f2(x * c.W)}" y="0" width="${f2(1.5 * c.s)}" height="${f2(0.86 * c.H)}" fill="#BDB6AA"/>`;
      return o + `<rect y="${f2(0.86 * c.H)}" width="${c.W}" height="${f2(0.14 * c.H)}" fill="#7F7A72"/><rect y="${f2(0.86 * c.H)}" width="${c.W}" height="${f2(4 * c.s)}" fill="#5F5A53"/><rect x="${f2(0.17 * c.W)}" y="${f2(0.14 * c.H)}" width="${f2(0.66 * c.W)}" height="${f2(0.56 * c.H)}" rx="${f2(8 * c.s)}" fill="#1C1C20"/>`; },
    front: walker },
  stage: { scr: [0.15, 0.1, 0.7, 0.5], rx: 0.006,
    back(u, c, p, id) { return `<rect width="${c.W}" height="${c.H}" fill="#08080C"/><path d="M0 ${f2(0.7 * c.H)} L${c.W} ${f2(0.7 * c.H)} L${c.W} ${c.H} L0 ${c.H} Z" fill="#17171F"/>${blurDef(id + 'g', 70 * c.s)}` +
      `<rect x="${f2(0.15 * c.W)}" y="${f2(0.1 * c.H)}" width="${f2(0.7 * c.W)}" height="${f2(0.5 * c.H)}" fill="${p.glow}" opacity="0.35"${blurAttr(id + 'g', 70 * c.s)}/>`; },
    front(u, c, p) { let o = ''; for (const [row, y, r, col] of [[0, 0.83, 0.06, '#0C0C12'], [1, 0.93, 0.075, '#040406']]) for (let i = 0; i < 10; i++) {
      const x = (i + (row ? 0.15 : 0.65)) / 10 * c.W + Math.sin(TAU * 0.3 * u + i * 1.7 + row) * 3 * c.s, hy = (y + (mulberry32(i * 13 + row)() - 0.5) * 0.02) * c.H;
      o += `<g fill="${col}"><circle cx="${f2(x)}" cy="${f2(hy)}" r="${f2(r * c.H)}"/><ellipse cx="${f2(x)}" cy="${f2(hy + r * c.H * 1.9)}" rx="${f2(r * c.H * 1.9)}" ry="${f2(r * c.H * 1.2)}"/></g>`; } return o; } },
  crt: { scr: [0.285, 0.165, 0.34, 0.52], rx: 0.05,
    back(u, c) { return `<rect width="${c.W}" height="${c.H}" fill="#2B2622"/><rect y="${f2(0.8 * c.H)}" width="${c.W}" height="${f2(0.2 * c.H)}" fill="#5A4636"/><rect x="${f2(0.255 * c.W)}" y="${f2(0.12 * c.H)}" width="${f2(0.49 * c.W)}" height="${f2(0.68 * c.H)}" rx="${f2(30 * c.s)}" fill="#C9C1B2"/>` +
      `<circle cx="${f2(0.685 * c.W)}" cy="${f2(0.3 * c.H)}" r="${f2(0.035 * c.H)}" fill="#7A7266"/><circle cx="${f2(0.685 * c.W)}" cy="${f2(0.43 * c.H)}" r="${f2(0.035 * c.H)}" fill="#7A7266"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${f2(0.655 * c.W)}" y="${f2((0.54 + i * 0.03) * c.H)}" width="${f2(0.06 * c.W)}" height="${f2(5 * c.s)}" rx="${f2(2.5 * c.s)}" fill="#8E8576"/>`).join(''); },
    front(u, c, p, id, scr) { const [x, y, w, h] = scr; return `<defs><pattern id="${id}sl" width="4" height="${f2(4 * c.s)}" patternUnits="userSpaceOnUse"><rect width="4" height="${f2(1.6 * c.s)}" fill="#000" opacity="0.22"/></pattern>` +
      `<radialGradient id="${id}vg" cx="50%" cy="50%" r="65%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs>` +
      `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(0.05 * c.H)}" fill="url(#${id}sl)"/><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(0.05 * c.H)}" fill="url(#${id}vg)"/>` +
      `<ellipse cx="${f2(x + w * 0.32)}" cy="${f2(y + h * 0.22)}" rx="${f2(w * 0.3)}" ry="${f2(h * 0.12)}" fill="#FFFFFF" opacity="0.07"/>`; } },
};

export const BRAND_LAYOUTS = {
  'layout.paletteColumns': { file: 'type/gfx/brand.js', tags: ['layout', 'palette', 'colour', 'swatch', 'brand-system', 'hex', 'stripes'], dur: 3.2, inF: 1, outF: 8,
    d: { swatches: [{ hex: '#4A18ED', name: 'Violet' }, { hex: '#FF5A1F', name: 'Ember' }, { hex: '#FFD23A', name: 'Sun' }, { hex: '#18A058', name: 'Leaf' }, { hex: '#0E0E14', name: 'Ink' }, { hex: '#F3F1EC', name: 'Paper' }],
      area: [0.06, 0.1, 0.88, 0.8], stagger: 0.07, rise: 1.0, stretchAt: 1.7, stretch: 0.6, gap: 0, radius: 0, labels: true, font: FONT, mono: MONO },
    svg(L, p, c) {
      const u = L.u, id = uidOf('paletteColumns', p), n = p.swatches.length, [ax, ay, aw, ah] = [p.area[0] * c.W, p.area[1] * c.H, p.area[2] * c.W, p.area[3] * c.H], cw = aw / n, sh = ah / n, g = p.gap * c.s, s = c.s; let out = '';
      p.swatches.forEach((sw, i) => {
        const kin = E.hero(seg(u, i * p.stagger, i * p.stagger + 0.55)), ki = p.stretchAt == null ? 0 : E.move(seg(u, p.stretchAt + i * p.stagger * 0.6, p.stretchAt + i * p.stagger * 0.6 + p.stretch));
        const x = lerp(ax + i * cw, ax, ki), y = lerp(ay, ay + i * sh, ki) + (1 - kin) * ah * p.rise, w = lerp(cw - g, aw, ki), h = lerp(ah, sh - g, ki), ink = inkOn(sw.hex);
        out += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(p.radius * s)}" fill="${sw.hex}"${ink === INK && lum(sw.hex) > 0.75 ? ` stroke="#000" stroke-opacity="0.12" stroke-width="${f2(1.5 * s)}"` : ''}/>`;
        const la = kin * (1 - Math.sin(Math.PI * ki)); if (!p.labels || la < 0.01) return; const lx = x + 22 * s, ly = ki > 0.5 ? y + h / 2 - 4 * s : y + 46 * s;
        out += `<g opacity="${f2(la)}">${text(sw.name, lx, ly, { size: 28 * s, weight: 700, fill: ink, font: p.font })}${text(sw.hex.toUpperCase(), lx, ly + 30 * s, { size: 20 * s, weight: 500, fill: ink, font: p.mono, op: 0.8 })}</g>`; });
      return `<defs><clipPath id="${id}c"><rect x="${f2(ax)}" y="${f2(ay)}" width="${f2(aw)}" height="${f2(ah)}"/></clipPath></defs><g clip-path="url(#${id}c)" opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.logoConstruction': { file: 'type/gfx/brand.js', tags: ['layout', 'logo', 'construction-grid', 'bezier', 'pen-tool', 'mark', 'brand-system'], dur: 3.2, inF: 1, outF: 8,
    d: { from: CIRCLE4, to: SPARK4, size: 0.6, at: [0.5, 0.5], guide: 'rgba(255,255,255,0.3)', ink: '#FFFFFF', accent: '#FFD23A', fill: '#FFFFFF', grid: 0.6, shapeAt: 0.45, morphAt: 1.0, morph: 0.9,
      guidesOutAt: 2.0, fillAt: 2.1, cursor: true },
    svg(L, p, c) {
      const u = L.u, s = c.s, sz = p.size * c.H, cx = p.at[0] * c.W, cy = p.at[1] * c.H, X = (v) => cx + ((v - 50) / 100) * sz, Y = (v) => cy + ((v - 50) / 100) * sz, km = E.move(seg(u, p.morphAt, p.morphAt + p.morph));
      const sg = p.from.map((a, i) => a.map((v, j) => lerp(v, p.to[i][j], km))), gk = 1 - seg(u, p.guidesOutAt, p.guidesOutAt + 0.4), fk = E.soft(seg(u, p.fillAt, p.fillAt + 0.35)), hk = (1 - seg(u, p.fillAt, p.fillAt + 0.3)) * seg(u, p.shapeAt, p.shapeAt + 0.2);
      let out = '';
      if (gk > 0) { let g = ''; const lines = [4, 50, 96]; lines.forEach((v, i) => { const k1 = E.soft(seg(u, i * 0.08, i * 0.08 + p.grid)), k2 = E.soft(seg(u, 0.04 + i * 0.08, 0.04 + i * 0.08 + p.grid));
          g += `<path d="M0 ${f2(Y(v))} H${c.W}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - k1))}"/><path d="M${f2(X(v))} 0 V${c.H}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - k2))}"/>`; });
        [[50, 50, 46], [4, 4, 46], [96, 4, 46], [96, 96, 46], [4, 96, 46], [50, 50, 16]].forEach(([a, b, r], i) => { const k = E.soft(seg(u, 0.25 + i * 0.06, 0.25 + i * 0.06 + p.grid));
          g += `<circle cx="${f2(X(a))}" cy="${f2(Y(b))}" r="${f2((r / 100) * sz)}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - k))}"/>`; });
        out += `<g fill="none" stroke="${p.guide}" stroke-width="${f2(1.4 * s)}" opacity="${f2(gk)}">${g}</g>`; }
      const ks = E.soft(seg(u, p.shapeAt, p.shapeAt + 0.45)), d = segPath(sg, X, Y), pk = 1 + 0.035 * Math.sin(Math.PI * fk);
      if (ks > 0) out += `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${pk.toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})"><path d="${d}" fill="${p.fill}" fill-opacity="${f2(fk)}" stroke="${p.ink}" stroke-width="${f2(2.2 * s)}" stroke-opacity="${f2(1 - fk * 0.8)}" pathLength="100" stroke-dasharray="100 101" stroke-dashoffset="${f2(100 * (1 - ks))}"/></g>`;
      if (hk > 0) { let h = ''; sg.forEach((a, i) => { const n = sg[(i + 1) % sg.length];
          h += `<path d="M${f2(X(a[0]))} ${f2(Y(a[1]))} L${f2(X(a[2]))} ${f2(Y(a[3]))} M${f2(X(a[4]))} ${f2(Y(a[5]))} L${f2(X(n[0]))} ${f2(Y(n[1]))}" stroke="${p.accent}" stroke-width="${f2(1.4 * s)}" fill="none"/>` +
            `<circle cx="${f2(X(a[2]))}" cy="${f2(Y(a[3]))}" r="${f2(5 * s)}" fill="${p.accent}"/><circle cx="${f2(X(a[4]))}" cy="${f2(Y(a[5]))}" r="${f2(5 * s)}" fill="${p.accent}"/>` +
            `<rect x="${f2(X(a[0]) - 6 * s)}" y="${f2(Y(a[1]) - 6 * s)}" width="${f2(12 * s)}" height="${f2(12 * s)}" fill="#111" stroke="${p.accent}" stroke-width="${f2(2 * s)}"/>`; });
        out += `<g opacity="${f2(hk)}">${h}</g>`; }
      if (p.cursor && u > p.morphAt - 0.4 && u < p.fillAt) { const kc = E.cam(seg(u, p.morphAt - 0.4, p.morphAt)), tx = X(sg[0][4]), ty = Y(sg[0][5]), px = lerp(tx + 0.25 * sz, tx, kc), py = lerp(ty + 0.2 * sz, ty, kc);
        out += `<g transform="translate(${f2(px + 4 * s)} ${f2(py + 4 * s)}) rotate(-28) scale(${(1.3 * s).toFixed(4)})" opacity="${f2(1 - seg(u, p.fillAt - 0.2, p.fillAt))}"><path d="${PEN}" fill="${p.accent}" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></g>`; }
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.mockupInContext': { file: 'type/gfx/brand.js', tags: ['layout', 'mockup', 'billboard', 'stage', 'crt', 'occlusion', 'in-context', 'brand-system'], dur: 3.4, inF: 1, outF: 8,
    d: { scene: 'billboard', inner: null, media: null, screenBg: BRAND, screenText: 'Your poster here', screenInk: '#FFFFFF', push: 0.05, walker: true, walkerAt: 0.5, walkSpeed: 0.34, glow: '#5B7CFF', occluder: null, font: FONT },
    svg(L, p, c) {
      const u = L.u, id = uidOf('mockupInContext', p), P = PLATES[p.scene] || PLATES.billboard, scr = [P.scr[0] * c.W, P.scr[1] * c.H, P.scr[2] * c.W, P.scr[3] * c.H], [x, y, w, h] = scr, rx = P.rx * c.H;
      let content = `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${p.screenBg}"/>`;
      if (p.inner && hooks.renderInner) content += `<svg x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">${hooks.renderInner(p.inner.id, u, { at: p.inner.at ?? 0, dur: p.inner.dur ?? 1e6, params: p.inner.params || {} }, ctxFor(1920, 1080, null, 1))}</svg>`;
      else if (p.media) content += slotMedia(p.media, x, y, w, h, 3);
      else { const S = h * 0.14; content += text(p.screenText, x + w / 2, y + h / 2 + S * 0.35, { size: S, weight: 800, fill: p.screenInk, anchor: 'middle', font: p.font, ls: -0.02 * S }); }
      const sheen = `<linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.14"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`;
      const z = 1 + p.push * E.sine(clamp(u / (L.total || 3))), ccx = c.W / 2, ccy = c.H / 2;
      const body = P.back(u, c, p, id) + `<defs>${sheen}<clipPath id="${id}c"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" rx="${f2(rx)}"/></clipPath></defs><g clip-path="url(#${id}c)">${content}<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="url(#${id}sh)"/></g>` +
        P.front(u, c, p, id, scr) + (p.occluder && p.occluder.href ? `<image href="${esc(p.occluder.href)}" x="0" y="0" width="${c.W}" height="${c.H}" preserveAspectRatio="xMidYMid slice"/>` : '');
      return `<g opacity="${f2(1 - L.out)}"><g transform="translate(${f2(ccx)} ${f2(ccy)}) scale(${z.toFixed(4)}) translate(${f2(-ccx)} ${f2(-ccy)})">${body}</g></g>`; } },

  'layout.typeSpecimen': { file: 'type/gfx/brand.js', tags: ['layout', 'type-specimen', 'weights', 'font', 'brand-system', 'variable-font'], dur: 3.4, inF: 1, outF: 8,
    d: { text: 'Manrope', weights: [200, 300, 400, 500, 600, 700, 800], size: 96, at: [0.5, 0.5], color: INK, dim: 0.2, start: 0.35, every: 0.26, collapseAt: 2.3, collapse: 0.55, final: 800,
      lineGap: 1.08, labels: true, accent: BRAND, font: FONT, mono: MONO },
    svg(L, p, c) {
      const u = L.u, S = p.size * c.s, n = p.weights.length, cx = p.at[0] * c.W, cy = p.at[1] * c.H, fi = Math.max(0, p.weights.indexOf(p.final)), kc = p.collapseAt == null ? 0 : E.move(seg(u, p.collapseAt, p.collapseAt + p.collapse));
      const xq = (u - p.start) / p.every, i0 = Math.floor(xq), a = clamp(xq < 0 ? 0 : i0 + E.move(clamp((xq - i0) / 0.6)), 0, n - 1), act = lerp(a, fi, kc);
      const wMax = Math.max(...p.weights.map((wt) => measure(p.text, S, { weight: wt, font: p.font }))), lx = cx - wMax / 2 - 36 * c.s; let out = '';
      p.weights.forEach((wt, i) => { const kin = E.hero(seg(u, i * 0.05, i * 0.05 + 0.45)), d = Math.abs(i - act), hi = clamp(1 - d), y0 = cy + (i - (n - 1) / 2) * S * p.lineGap, yy = lerp(y0, cy, kc) + (1 - kin) * S * 0.3;
        const alpha = kin * lerp(p.dim, 1, hi) * (i === fi ? 1 : 1 - clamp(kc * 1.6)); if (alpha < 0.005) return;
        out += text(p.text, cx - wMax / 2, yy + S * 0.35, { size: S, weight: wt, fill: p.color, font: p.font, op: alpha });
        if (p.labels && hi > 0.02) out += text(`${WEIGHT_NAMES[wt] || ''} ${wt}`.trim(), lx, yy + S * 0.12, { size: 24 * c.s, weight: 600, fill: p.accent, anchor: 'end', font: p.mono, op: hi * kin * (i === fi ? 1 : 1 - kc) }); });
      if (kc > 0) out += text(`${WEIGHT_NAMES[p.final] || ''} ${p.final}`.toUpperCase(), cx, cy + S * 1.05, { size: 22 * c.s, weight: 700, fill: p.accent, anchor: 'middle', font: p.mono, ls: 2 * c.s, op: kc });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'layout.backdropSwap': { file: 'type/gfx/brand.js', tags: ['layout', 'lockup', 'backdrop', 'beat', 'brand-system', 'contrast', 'swap'], dur: 3, inF: 4, outF: 6,
    d: { text: 'wordmark', mark: DEFAULT_MARK, backs: [{ kind: 'grid', bg: '#F3F1EC' }, { kind: 'solid', bg: BRAND }, { kind: 'solid', bg: '#0E0E14' }, { kind: 'photo', seed: 5 }, { kind: 'solid', bg: '#FFD23A' }],
      every: 0.5, start: 0, loop: true, size: 120, at: [0.5, 0.5], ink: 'auto', gridStep: 48, weight: 800, font: FONT, ls: -0.03 },
    svg(L, p, c) {
      const u = L.u, S = p.size * c.s, n = p.backs.length, st = Math.floor(Math.max(0, u - p.start) / p.every), i = p.loop ? st % n : Math.min(n - 1, st), b = p.backs[i]; let bg = '', ink;
      if (b.kind === 'photo') { bg = photoTile(0, 0, c.W, c.H, b.seed ?? 5, { kind: 0 }) + `<rect width="${c.W}" height="${c.H}" fill="#000" opacity="0.28"/>`; ink = '#FFFFFF'; }
      else { bg = `<rect width="${c.W}" height="${c.H}" fill="${b.bg}"/>`; ink = inkOn(b.bg);
        if (b.kind === 'grid') { const st = p.gridStep * c.s; let gl = ''; for (let x = (c.W / 2) % st; x < c.W; x += st) gl += `<rect x="${f2(x)}" y="0" width="${f2(c.s)}" height="${c.H}"/>`; for (let y = (c.H / 2) % st; y < c.H; y += st) gl += `<rect x="0" y="${f2(y)}" width="${c.W}" height="${f2(c.s)}"/>`; bg += `<g fill="${ink}" opacity="0.1">${gl}</g>`; } }
      if (p.ink !== 'auto') ink = p.ink;
      const tw = measure(p.text, S, { weight: p.weight, font: p.font, ls: p.ls * S }), ms = S * 1.05, gap = S * 0.28, tot = ms + gap + tw, x0 = p.at[0] * c.W - tot / 2, cy = p.at[1] * c.H, k = clamp(L.in * 1.5);
      return `<g opacity="${f2(1 - L.out)}">${bg}<g opacity="${f2(k)}"><g transform="translate(${f2(x0)} ${f2(cy - ms / 2)}) scale(${(ms / 100).toFixed(4)})"><path d="${p.mark}" fill="${ink}"/></g>` +
        text(p.text, x0 + ms + gap, cy + S * 0.35, { size: S, weight: p.weight, fill: ink, font: p.font, ls: p.ls * S }) + '</g></g>'; } },

  'layout.lineup': { file: 'type/gfx/brand.js', tags: ['layout', 'lineup', 'colourway', 'product', 'row', 'availability', 'end-card'], dur: 3.4, inF: 1, outF: 8,
    d: { items: [{ color: '#4A18ED', label: 'Violet' }, { color: '#FF5A1F', label: 'Ember' }, { color: '#18A058', label: 'Leaf' }, { color: '#E9E4DA', label: 'Chalk' }, { color: '#1A1A22', label: 'Ink' }],
      shape: 'capsule', title: 'One shape, every finish', sub: 'Available in every colour', area: [0.1, 0.27, 0.8, 0.48], stagger: 0.09, slide: 0.6, titleAt: 0.85, color: INK, muted: '#6B6B76', font: FONT },
    svg(L, p, c) {
      const u = L.u, s = c.s, id = uidOf('lineup', p), n = p.items.length, [ax, ay, aw, ah] = [p.area[0] * c.W, p.area[1] * c.H, p.area[2] * c.W, p.area[3] * c.H], cw = aw / n, ih = ah * 0.78;
      let out = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.38"/><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/></linearGradient></defs>`;
      const shapeD = (x, y) => { if (p.shape === 'bottle') { const w = ih * 0.36; return rrPath(x - w / 2, y + ih * 0.3, w, ih * 0.7, w * 0.22) + rrPath(x - w * 0.18, y, w * 0.36, ih * 0.34, w * 0.08); }
        if (p.shape === 'puck') { const w = Math.min(cw * 0.8, ih * 0.9); return rrPath(x - w / 2, y + ih * 0.55, w, ih * 0.45, ih * 0.22); }
        const w = ih * 0.42; return rrPath(x - w / 2, y, w, ih, w / 2) + `M${f2(x - w / 2)} ${f2(y + ih * 0.2)} H${f2(x + w / 2)}`; };
      p.items.forEach((it, i) => { const k = E.hero(seg(u, i * p.stagger, i * p.stagger + p.slide)), x = ax + (i + 0.5) * cw + (1 - k) * c.W * 0.6, y = ay + (ah - ih) / 2, kl = E.hero(seg(u, i * p.stagger + p.slide * 0.7, i * p.stagger + p.slide + 0.3));
        out += `<g opacity="${f2(clamp(k * 1.4))}"><ellipse cx="${f2(x)}" cy="${f2(y + ih + 10 * s)}" rx="${f2(cw * 0.32)}" ry="${f2(9 * s)}" fill="#000" opacity="0.13"/>` +
          (p.shape && p.shape.svg ? `<svg x="${f2(x - cw * 0.4)}" y="${f2(y)}" width="${f2(cw * 0.8)}" height="${f2(ih)}" viewBox="${p.shape.viewBox || '0 0 100 100'}">${p.shape.svg.replaceAll('currentColor', it.color)}</svg>` :
            `<path d="${shapeD(x, y)}" fill="${it.color}" stroke="#000" stroke-opacity="0.12" stroke-width="${f2(1.5 * s)}"/><path d="${shapeD(x, y)}" fill="url(#${id}g)"/>`) + '</g>';
        if (it.label) out += text(it.label, ax + (i + 0.5) * cw, ay + ah + 44 * s, { size: 26 * s, weight: 700, fill: p.muted, anchor: 'middle', font: p.font, op: kl }); });
      const kt = E.hero(seg(u, p.titleAt, p.titleAt + 0.5)), ks = E.hero(seg(u, p.titleAt + 0.25, p.titleAt + 0.75));
      if (p.title) out += text(p.title, c.W / 2, ay - 40 * s + (1 - kt) * 20 * s, { size: 64 * s, weight: 800, fill: p.color, anchor: 'middle', font: p.font, ls: -1.2 * s, op: kt });
      if (p.sub) out += text(p.sub, c.W / 2, ay + ah + 120 * s, { size: 30 * s, weight: 600, fill: p.muted, anchor: 'middle', font: p.font, op: ks });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },
};
export const BRAND_CUES = {
  'layout.paletteColumns': (p) => [{ t: 0, id: 'sfx/whoosh/swish_s', why: 'columns rise' }, ...(p.stretchAt == null ? [] : [{ t: p.stretchAt, id: 'sfx/whoosh/whoosh_m', why: 'columns re-flow into stripes' }])],
  'layout.logoConstruction': (p) => [{ t: 0, id: 'sfx/whoosh/swish_xs', why: 'guides draw on' }, { t: p.shapeAt, id: 'sfx/ui/pop', why: 'primitive appears' }, { t: p.morphAt, id: 'sfx/sparkle/letter_assemble', why: 'handles pull the shape' }, { t: p.fillAt, id: 'sfx/hit/soft', why: 'mark fills' }],
  'layout.mockupInContext': () => [{ t: 0, id: 'sfx/whoosh/whoosh_in_m', why: 'cut to the plate' }],
  'layout.typeSpecimen': (p) => [...p.weights.slice(1).map((_, i) => ({ t: p.start + (i + 1) * p.every, id: i % 2 ? 'sfx/ui/count_tick' : 'sfx/ui/tick', why: 'highlight row steps' })).filter((_, i) => i % 2 === 0),
    ...(p.collapseAt == null ? [] : [{ t: p.collapseAt, id: 'sfx/whoosh/swish_s', why: 'rows collapse' }])],
  'layout.backdropSwap': (p) => Array.from({ length: Math.max(0, p.loop ? Math.floor((p.dur ?? 3) / p.every) : Math.min(p.backs.length - 1, Math.floor((p.dur ?? 3) / p.every))) }, (_, i) => ({ t: p.start + (i + 1) * p.every, id: i % 2 ? 'sfx/ui/tick' : 'sfx/tx/cut_tick', why: 'backdrop swaps' })),
  'layout.lineup': (p) => [...p.items.map((_, i) => ({ t: i * p.stagger, id: 'sfx/whoosh/swish_xs', why: 'item slides in' })).filter((_, i) => i % 2 === 0), { t: p.titleAt, id: 'sfx/ui/pop', why: 'title lands' }],
};
