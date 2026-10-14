/* motion-pack / type / gfx / doc.js: documentary-parody supers (2026-10-14). Same contract as core.js (svg(L, p, ctx) -> markup), registered in index.js GFX.
     lowerThird.docSuper          documentary name super: NAME in condensed caps over a small role line, cut on with a 4 f settle, top-left by default
                                  (the doc-interview position), soft shadow so it reads over footage. Deadpan by design: no boxes, no swooshes.
     caption.subtitleSpeedGag     a subtitle line, then a generic playback-speed menu (0.25 / 0.5 / 0.75 / Normal) pops up, a cursor picks a speed,
                                  the menu closes and the subtitle re-reads at the new speed. Generic UI: no platform logos, fonts or trade dress.
   docSuper carries a soft elliptical scrim (p.scrim, 0 = off) so white type reads over busy or light footage.
   Condensed caps without a condensed font: Manrope 800 squeezed with a horizontal scale (p.condense, default 0.8) and tight tracking. */
import { E, clamp, lerp, seg, FONT, PAPER, INK, esc, f2, text, textW, anchor } from './core.js';

const squeeze = (x, y, k, inner) => `<g transform="translate(${f2(x)} ${f2(y)}) scale(${k.toFixed(4)} 1) translate(${f2(-x)} ${f2(-y)})">${inner}</g>`;
const SHADOW = 'style="paint-order:stroke" stroke="rgba(0,0,0,0.45)" stroke-width="2"';
export const DOC = {
  'lowerThird.docSuper': { file: 'type/gfx/doc.js', tags: ['lower-third', 'name', 'documentary', 'doc-parody', 'comedy', 'deadpan', 'interview'], dur: 2.6, inF: 4, outF: 6,
    d: { name: 'THE FOLDER', role: 'Missing since Tuesday', pos: 'tl', color: PAPER, roleColor: PAPER, condense: 0.8, size: 84, roleSize: 30, rule: false, accent: '#FFE45C', scrim: 0.55 },
    svg(L, p, c) { const ns = p.size * c.s, rs = p.roleSize * c.s, name = String(p.name).toUpperCase(), w = Math.max(textW(name, ns, 0.66) * p.condense, textW(p.role, rs, 0.5)), h = ns + rs * 1.6, [x, y] = anchor(p.pos, c, w, h);
      const k = E.enter(L.in), o = clamp(L.in * 2) * (1 - L.out), dy = (1 - k) * 8 * c.s, rk = seg(L.u, 3 / 30, 9 / 30);
      const nm = squeeze(x, y, p.condense, text(name, x, y + ns * 0.82 + dy, { size: ns, weight: 800, fill: p.color, ls: -0.01 * ns, extra: SHADOW }));
      const rule = p.rule ? `<rect x="${f2(x)}" y="${f2(y + ns + 6 * c.s)}" width="${f2(w * E.hero(rk))}" height="${f2(3 * c.s)}" fill="${p.accent}"/>` : '';
      const pad = 60 * c.s, scrim = p.scrim > 0 ? `<defs><radialGradient id="dsScrim" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="${f2(p.scrim)}"/><stop offset="0.6" stop-color="#000" stop-opacity="${f2(p.scrim * 0.5)}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect x="${f2(x - pad * 2.2)}" y="${f2(y - pad * 1.6)}" width="${f2(w + pad * 4.4)}" height="${f2(h + pad * 3.2)}" fill="url(#dsScrim)"/>` : '';
      return `<g opacity="${f2(o)}">${scrim}${nm}${rule}${text(p.role, x + 2 * c.s, y + ns + rs * 1.25 + dy, { size: rs, weight: 500, fill: p.roleColor, op: rk, extra: SHADOW })}</g>`; } },
  'caption.subtitleSpeedGag': { file: 'type/gfx/doc.js', tags: ['caption', 'subtitle', 'speed-menu', 'playback', 'comedy', 'doc-parody', 'gag'], dur: 3.2, inF: 3, outF: 6,
    d: { line: '[talks very, very slowly]', after: '[still talking slowly]', options: ['0.25', '0.5', '0.75', 'Normal'], pick: 0, menuAt: 0.6, pickAt: 1.5, closeAt: 1.9, cursor: true, accent: '#FFFFFF', size: 46 },
    svg(L, p, c) { const S = c.safe, ts = p.size * c.s, picked = L.u >= p.pickAt, line = picked && p.after ? p.after : p.line;
      // the subtitle: centred, bottom of the safe rect, white with a dark outline (the usual burned-in subtitle look)
      const sub = text(line, c.W / 2, S.y1 - 24 * c.s, { size: ts, weight: 600, fill: '#FFFFFF', anchor: 'middle', extra: 'style="paint-order:stroke" stroke="rgba(0,0,0,0.85)" stroke-width="' + f2(6 * c.s) + '" stroke-linejoin="round"' });
      const mk = E.pop(seg(L.u, p.menuAt, p.menuAt + 7 / 30)) * (1 - E.exit(seg(L.u, p.closeAt, p.closeAt + 5 / 30)));
      let menu = '';
      if (mk > 0.001 && L.u < p.closeAt + 5 / 30) {
        const n = p.options.length, rh = 66 * c.s, mw = 260 * c.s, mh = rh * n + 40 * c.s, mx = S.x0 + S.w * 0.08, my = S.y1 - mh - 110 * c.s, cx = mx + 40 * c.s, cy = my + mh;
        let rows = ''; p.options.forEach((o, i) => { const ry = my + 20 * c.s + i * rh, hi = (i === p.pick && L.u >= p.pickAt - 0.25), sel = i === p.pick && picked;
          if (hi) rows += `<rect x="${f2(mx + 8 * c.s)}" y="${f2(ry)}" width="${f2(mw - 16 * c.s)}" height="${f2(rh)}" rx="${f2(10 * c.s)}" fill="rgba(255,255,255,${sel ? 0.28 : 0.16})"/>`;
          rows += text(o, mx + 34 * c.s, ry + rh * 0.66, { size: 34 * c.s, weight: sel ? 800 : 500, fill: '#FFFFFF' }) + (sel ? text('✓', mx + mw - 34 * c.s, ry + rh * 0.66, { size: 32 * c.s, weight: 800, fill: p.accent, anchor: 'end' }) : ''); });
        menu = `<g transform="translate(${f2(cx)} ${f2(cy)}) scale(${Math.max(0.001, mk).toFixed(4)}) translate(${f2(-cx)} ${f2(-cy)})"><rect x="${f2(mx)}" y="${f2(my)}" width="${f2(mw)}" height="${f2(mh)}" rx="${f2(16 * c.s)}" fill="rgba(28,28,32,0.92)"/>${rows}</g>`;
        if (p.cursor) { const tgt = [mx + mw * 0.55, my + 20 * c.s + p.pick * rh + rh / 2], k = E.move(seg(L.u, p.menuAt + 0.15, p.pickAt - 0.1)), px = lerp(mx + mw + 160 * c.s, tgt[0], k), py = lerp(my + mh + 40 * c.s, tgt[1], k);
          const press = L.u >= p.pickAt && L.u < p.pickAt + 0.12 ? 0.88 : 1;
          menu += `<path transform="translate(${f2(px)} ${f2(py)}) scale(${f2(1.5 * c.s * press)})" d="M0 0 L0 34 L9 26 L15 40 L21 37 L15 24 L27 24 Z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round" opacity="${f2(mk)}"/>`; }
      }
      return `<g opacity="${f2(1 - L.out)}">${sub}</g>${menu}`; } },
};
