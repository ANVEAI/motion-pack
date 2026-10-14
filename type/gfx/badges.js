/* motion-pack / type / gfx / badges.js: round-3 call-outs, counters, caption and title cards (2026-10-14). Same contract as every gfx item (core.js); pure functions of t.
     callout.selectionBox  design-tool bounding box with 4 corner handles (+ optional bezier handle), a size chip and a cursor that lands on a corner;
                           the box springs to the new size when the text changes (texts), and can zoom-lock onto it (zoomAt; selectionZoomCss for the DOM under it)
     counter.scoreIterate  a score that steps (7.2 -> 7.7 -> 7.8) with a reason pill highlighted per step: an agent checking its own work; prints its source line
     counter.stepPill      a number in a pill badge beside a phrase, stepping (33+ -> 93+ -> 100+) with a blur-roll and a badge that resizes
     caption.speakerTag    captions with a speaker label chip ("AI voice", "TTS") that stays on for the whole item: the honesty label lives in the caption itself
     title.timeCard        full-frame comedic time-skip card ("A LITTLE LATER...") in a loud cartoon style: sunburst, outlined bouncing words
   Craft learned from public launch films (round-3 study, October 2026): techniques only; no brand, footage, wording or sequence is reproduced. Owned code. */
import { E, clamp, lerp, seg, TAU, FONT, MONO, INK, PAPER, f2, esc, text, measure, uidOf, blurDef, blurAttr } from './core.js';
import { spring, springTrack } from '../ease.js';
import { stepAt } from './swap.js';

const op = (L) => clamp(L.in * 1.5) * (1 - L.out);
const THEME = { light: { panel: '#FFFFFF', ink: INK, muted: '#6B6B76', line: '#E3E3EA', shadow: 0.12 }, dark: { panel: '#17171D', ink: '#F4F4F6', muted: '#9A9AA6', line: '#2C2C36', shadow: 0.4 } };
const CURSOR = 'M0 0 L0 25 L6.4 19.2 L10.8 28.6 L14.6 26.9 L10.3 17.7 L18.4 17.7 Z';   // owned pointer outline (28 px tall at scale 1)
const check = (cx, cy, r, fill, ink = '#FFFFFF') => `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" fill="${fill}"/><path d="M${f2(cx - r * 0.45)} ${f2(cy + r * 0.02)} L${f2(cx - r * 0.1)} ${f2(cy + r * 0.36)} L${f2(cx + r * 0.48)} ${f2(cy - r * 0.32)}" fill="none" stroke="${ink}" stroke-width="${f2(r * 0.26)}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* the zoom-lock of callout.selectionBox as numbers: scale s about the frame origin plus a translate, so the box centre moves to the frame centre.
   selectionZoomCss(t, { at, params, W, H }) -> 'translate(..px, ..px) scale(..)' for a DOM wrapper under the box (transform-origin: 0 0). */
export function selectionZoom(u, p, W, H) {
  if (p.zoomAt == null) return { s: 1, tx: 0, ty: 0 };
  const k = E.cam(seg(u, p.zoomAt, p.zoomAt + p.zoomDur)), s = lerp(1, p.zoom, k), bx = p.at[0] * W, by = p.at[1] * H;
  return { s, tx: k * (W / 2 - s * bx), ty: k * (H / 2 - s * by) };
}
export function selectionZoomCss(t, { at = 0, params = {}, W = 1920, H = 1080 } = {}) { const z = selectionZoom(t - at, { ...BADGES['callout.selectionBox'].d, ...params }, W, H); return `translate(${f2(z.tx)}px, ${f2(z.ty)}px) scale(${z.s.toFixed(4)})`; }

export const BADGES = {
  'callout.selectionBox': { file: 'type/gfx/badges.js', tags: ['callout', 'selection', 'bounding-box', 'handles', 'design-tool', 'cursor', 'hook', 'resize'], dur: 3, inF: 6, outF: 8,
    d: { text: 'Great videos take weeks', texts: [], size: 76, weight: 800, color: INK, at: [0.5, 0.5], box: null, pad: 0.34, accent: '#2F80FF', handle: 13, sw: 2.5, draw: 0.4, handlesAt: 0.3,
      cursor: true, cursorAt: 0.8, cursorFrom: [0.8, 0.88], cursorColor: '#FFFFFF', bezier: false, label: true, zoomAt: null, zoom: 1.5, zoomDur: 0.8, font: FONT, mono: MONO },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, s = c.s, cx = p.at[0] * c.W, cy = p.at[1] * c.H, seq = [[0, p.text], ...p.texts], st = stepAt(seq, u, 0.18), fo = { weight: p.weight, font: p.font };
      const boxOf = (str) => { const w = measure(str, S, fo) + 2 * p.pad * S, h = S * (1 + 1.4 * p.pad); return [cx - w / 2, cy - h / 2, w, h]; };
      const [x, y, w, h] = p.box ? [p.box[0] * c.W, p.box[1] * c.H, p.box[2] * c.W, p.box[3] * c.H] : springTrack(u, seq.map(([t, str]) => [t, boxOf(str)]), 'panel');
      let out = '';
      const tx = (str, a) => (a > 0.002 && str ? `<g opacity="${f2(a)}">${text(str, x + w / 2, y + h / 2 + S * 0.35, { size: S, weight: p.weight, fill: p.color, anchor: 'middle', font: p.font })}</g>` : '');
      if (st.k < 1) out += tx(st.prev, 1 - st.k) + tx(st.cur, st.k); else out += tx(st.cur, 1);
      const per = 2 * (w + h), kd = E.soft(seg(u, 0, p.draw));
      out += `<path d="M${f2(x)} ${f2(y)} H${f2(x + w)} V${f2(y + h)} H${f2(x)} Z" fill="none" stroke="${p.accent}" stroke-width="${f2(p.sw * s)}" stroke-dasharray="${f2(per)} ${f2(per + 1)}" stroke-dashoffset="${f2(per * (1 - kd))}"/>`;
      const hs = p.handle * s;
      [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([hx, hy], i) => { const k = E.pop(seg(u, p.handlesAt + i * 0.05, p.handlesAt + i * 0.05 + 0.22)) * 1; if (k <= 0) return; const q = hs * k;
        out += `<rect x="${f2(hx - q / 2)}" y="${f2(hy - q / 2)}" width="${f2(q)}" height="${f2(q)}" fill="#FFFFFF" stroke="${p.accent}" stroke-width="${f2(p.sw * s)}"/>`; });
      if (p.bezier) { const kb = E.hero(seg(u, p.handlesAt + 0.2, p.handlesAt + 0.5)), ax = x + w / 2, ay = y, len = w * 0.16 * kb, a = (8 * Math.sin(TAU * 0.5 * u) * Math.PI) / 180, dx = Math.cos(a) * len, dy = Math.sin(a) * len;
        if (kb > 0) out += `<path d="M${f2(ax - dx)} ${f2(ay - dy)} L${f2(ax + dx)} ${f2(ay + dy)}" stroke="${p.accent}" stroke-width="${f2(1.6 * s)}"/><circle cx="${f2(ax - dx)}" cy="${f2(ay - dy)}" r="${f2(5 * s)}" fill="${p.accent}"/><circle cx="${f2(ax + dx)}" cy="${f2(ay + dy)}" r="${f2(5 * s)}" fill="${p.accent}"/>` +
          `<rect x="${f2(ax - 5 * s)}" y="${f2(ay - 5 * s)}" width="${f2(10 * s)}" height="${f2(10 * s)}" transform="rotate(45 ${f2(ax)} ${f2(ay)})" fill="#FFFFFF" stroke="${p.accent}" stroke-width="${f2(1.6 * s)}"/>`; }
      if (p.label) { const kl = E.hero(seg(u, p.handlesAt + 0.25, p.handlesAt + 0.5)), str = `${Math.round(w / s)} × ${Math.round(h / s)}`, lw = measure(str, 19 * s, { font: p.mono, weight: 600 }) + 18 * s;
        if (kl > 0) out += `<g opacity="${f2(kl)}"><rect x="${f2(x + w / 2 - lw / 2)}" y="${f2(y + h + 12 * s)}" width="${f2(lw)}" height="${f2(28 * s)}" rx="${f2(5 * s)}" fill="${p.accent}"/>${text(str, x + w / 2, y + h + 32 * s, { size: 19 * s, weight: 600, fill: '#FFFFFF', anchor: 'middle', font: p.mono })}</g>`; }
      if (p.cursor && u >= p.cursorAt - 0.55) { const kc = E.cam(seg(u, p.cursorAt - 0.55, p.cursorAt)), fx = p.cursorFrom[0] * c.W, fy = p.cursorFrom[1] * c.H, px = lerp(fx, x + w + 2 * s, kc), py = lerp(fy, y + h + 2 * s, kc), kr = seg(u, p.cursorAt, p.cursorAt + 0.3);
        if (kr > 0 && kr < 1) out += `<circle cx="${f2(x + w)}" cy="${f2(y + h)}" r="${f2(8 * s + 26 * s * E.enter(kr))}" fill="none" stroke="${p.accent}" stroke-width="${f2(2 * s)}" opacity="${f2(1 - kr)}"/>`;
        out += `<g transform="translate(${f2(px)} ${f2(py)}) scale(${(1.25 * s).toFixed(4)})"><path d="${CURSOR}" fill="${p.cursorColor}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g>`; }
      const z = selectionZoom(u, p, c.W, c.H);
      return `<g opacity="${f2(op(L))}"${z.s !== 1 || z.tx ? ` transform="translate(${f2(z.tx)} ${f2(z.ty)}) scale(${z.s.toFixed(4)})"` : ''}>${out}</g>`; } },

  'counter.scoreIterate': { file: 'type/gfx/badges.js', tags: ['counter', 'score', 'self-check', 'agent-at-work', 'proof', 'reasons', 'iterate'], dur: 3.4, inF: 10, outF: 8,
    d: { label: 'Design score', steps: [{ v: 7.2, reason: 'first pass' }, { v: 7.7, reason: 'tighter spacing' }, { v: 7.8, reason: 'clearer hierarchy' }], start: 0.55, every: 0.85, roll: 0.3, decimals: 1, max: 10,
      scale: 1, at: [0.5, 0.5], theme: 'light', accent: '#18A058', source: 'illustrative values', font: FONT, mono: MONO, blur: 8 },
    svg(L, p, c) {
      const s = c.s * p.scale, u = L.u, id = uidOf('scoreIterate', p), T = THEME[p.theme] || THEME.light, n = p.steps.length, tOf = (i) => (i ? p.start + (i - 1) * p.every : 0);
      let idx = 0; for (let i = 1; i < n; i++) if (u >= tOf(i)) idx = i;
      const k = idx ? E.move(seg(u, tOf(idx), tOf(idx) + p.roll)) : 1, fmt = (v) => (+v).toFixed(p.decimals), cw = 900 * s, ch = Math.max(380, 150 + n * 66) * s, kin = E.hero(L.in);
      const x = p.at[0] * c.W - cw / 2, y = p.at[1] * c.H - ch / 2 + (1 - kin) * 30 * s, SS = 150 * s, sx = x + 56 * s, base = y + 236 * s;
      let out = `<rect x="${f2(x + 6 * s)}" y="${f2(y + 14 * s)}" width="${f2(cw)}" height="${f2(ch)}" rx="${f2(28 * s)}" fill="#000" opacity="${T.shadow}"/><rect x="${f2(x)}" y="${f2(y)}" width="${f2(cw)}" height="${f2(ch)}" rx="${f2(28 * s)}" fill="${T.panel}" stroke="${T.line}" stroke-width="${f2(1.5 * s)}"/>`;
      out += text(p.label.toUpperCase(), sx, y + 84 * s, { size: 24 * s, weight: 800, fill: T.muted, font: p.font, ls: 2.4 * s });
      const cur = fmt(p.steps[idx].v), prev = fmt(p.steps[Math.max(0, idx - 1)].v), fo = { weight: 800, font: p.font }, nw = lerp(measure(prev, SS, fo), measure(cur, SS, fo), k);
      out += `<defs><clipPath id="${id}c"><rect x="${f2(sx - 10 * s)}" y="${f2(base - SS * 0.86)}" width="${f2(nw + 30 * s)}" height="${f2(SS * 1.0)}"/></clipPath>${blurDef(id + 'o', p.blur * s * k)}${blurDef(id + 'i', p.blur * s * (1 - k))}</defs><g clip-path="url(#${id}c)">`;
      if (k < 1) out += `<g${blurAttr(id + 'o', p.blur * s * k)} opacity="${f2(1 - k)}">${text(prev, sx, base - SS * 0.7 * k, { size: SS, weight: 800, fill: T.ink, font: p.font })}</g><g${blurAttr(id + 'i', p.blur * s * (1 - k))} opacity="${f2(k)}">${text(cur, sx, base + SS * 0.7 * (1 - k), { size: SS, weight: 800, fill: T.ink, font: p.font })}</g>`;
      else out += text(cur, sx, base, { size: SS, weight: 800, fill: T.ink, font: p.font });
      out += `</g>${text('/' + p.max, sx + nw + 14 * s, base, { size: 46 * s, weight: 700, fill: T.muted, font: p.font })}`;
      if (idx) { const d = p.steps[idx].v - p.steps[idx - 1].v, str = (d >= 0 ? '+' : '') + d.toFixed(p.decimals), kp = E.pop(seg(u, tOf(idx), tOf(idx) + 0.3)), dw = measure(str, 26 * s, fo) + 26 * s;
        out += `<g transform="translate(${f2(sx + dw / 2)} ${f2(y + 286 * s)}) scale(${Math.max(0.0001, kp).toFixed(4)})"><rect x="${f2(-dw / 2)}" y="${f2(-20 * s)}" width="${f2(dw)}" height="${f2(40 * s)}" rx="${f2(20 * s)}" fill="${p.accent}" opacity="0.16"/>${text(str, 0, 9 * s, { size: 26 * s, weight: 800, fill: p.accent, anchor: 'middle', font: p.font })}</g>`; }
      const bv = lerp(p.steps[Math.max(0, idx - 1)].v, p.steps[idx].v, k) / p.max, bw = 330 * s;
      out += `<rect x="${f2(sx)}" y="${f2(y + 320 * s)}" width="${f2(bw)}" height="${f2(10 * s)}" rx="${f2(5 * s)}" fill="${T.line}"/><rect x="${f2(sx)}" y="${f2(y + 320 * s)}" width="${f2(bw * clamp(bv) * kin)}" height="${f2(10 * s)}" rx="${f2(5 * s)}" fill="${p.accent}"/>`;
      const x2 = x + 470 * s; out += text('CHECKS', x2, y + 84 * s, { size: 22 * s, weight: 800, fill: T.muted, font: p.font, ls: 2.2 * s });
      p.steps.forEach((st, i) => { if (i > idx) return; const ki = E.hero(seg(u, tOf(i), tOf(i) + 0.35)), act = i === idx, yy = y + 112 * s + i * 66 * s, pw = Math.min(measure(st.reason, 26 * s, { weight: act ? 800 : 600, font: p.font }) + 86 * s, cw - (x2 - x) - 40 * s);
        out += `<g opacity="${f2(ki * (act ? 1 : 0.85))}" transform="translate(${f2((1 - ki) * 24 * s)} 0)"><rect x="${f2(x2)}" y="${f2(yy)}" width="${f2(pw)}" height="${f2(50 * s)}" rx="${f2(25 * s)}" fill="${act ? p.accent : 'none'}" fill-opacity="${act ? 0.14 : 0}" stroke="${act ? p.accent : T.line}" stroke-width="${f2(1.6 * s)}"/>` +
          check(x2 + 27 * s, yy + 25 * s, 13 * s, act ? p.accent : T.muted) + text(st.reason, x2 + 52 * s, yy + 34 * s, { size: 26 * s, weight: act ? 800 : 600, fill: act ? T.ink : T.muted, font: p.font }) + '</g>'; });
      out += text('source: ' + (p.source || 'none given - add one before real use'), sx, y + ch - 26 * s, { size: 18 * s, weight: 500, fill: T.muted, font: p.mono });
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'counter.stepPill': { file: 'type/gfx/badges.js', tags: ['counter', 'pill', 'badge', 'feature-count', 'step', 'odometer', 'cross-scene'], dur: 3, inF: 10, outF: 8,
    d: { steps: [[0, 33], [0.9, 93], [1.8, 100]], prefix: '', suffix: '+', phrase: 'ways to start', size: 72, at: [0.5, 0.5], pill: '#FF5A1F', pillInk: '#FFFFFF', color: INK, roll: 0.3, layout: 'row',
      weight: 800, phraseWeight: 700, font: FONT, gap: 0.32, pulse: 0.08, blur: 8, source: null },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, id = uidOf('stepPill', p), st = stepAt(p.steps, u, p.roll), k = E.move(st.k), str = (v) => `${p.prefix}${v}${p.suffix}`, fo = { weight: p.weight, font: p.font };
      const padX = S * 0.42, pw = lerp(measure(str(st.prev), S, fo), measure(str(st.cur), S, fo), k) + 2 * padX, ph = S * 1.3, phw = measure(p.phrase, S, { weight: p.phraseWeight, font: p.font });
      const cx = p.at[0] * c.W, cy = p.at[1] * c.H, row = p.layout !== 'stack', px = row ? cx - (pw + p.gap * S + phw) / 2 : cx - pw / 2, py = row ? cy - ph / 2 : cy - ph - S * 0.12, pcx = px + pw / 2, pcy = py + ph / 2;
      const kin = E.pop(L.in), pulse = st.j ? 1 + p.pulse * Math.sin(Math.PI * seg(u, p.steps[st.j][0], p.steps[st.j][0] + 0.32)) : 1, sc = Math.max(0.0001, kin * pulse);
      const num = (v, dy, a, bl, fid) => (a <= 0.002 ? '' : `${blurDef(fid, bl)}<g${blurAttr(fid, bl)} opacity="${f2(a)}">${text(str(v), pcx, pcy + S * 0.36 + dy, { size: S, weight: p.weight, fill: p.pillInk, anchor: 'middle', font: p.font })}</g>`);
      let inner = `<rect x="${f2(px)}" y="${f2(py)}" width="${f2(pw)}" height="${f2(ph)}" rx="${f2(ph / 2)}" fill="${p.pill}"/><defs><clipPath id="${id}c"><rect x="${f2(px)}" y="${f2(py)}" width="${f2(pw)}" height="${f2(ph)}" rx="${f2(ph / 2)}"/></clipPath></defs><g clip-path="url(#${id}c)">`;
      inner += st.k < 1 ? num(st.prev, -ph * 0.8 * k, 1 - k, p.blur * c.s * k, id + 'o') + num(st.cur, ph * 0.8 * (1 - k), k, p.blur * c.s * (1 - k), id + 'i') : num(st.cur, 0, 1, 0, id + 'i');
      let out = `<g transform="translate(${f2(pcx)} ${f2(pcy)}) scale(${sc.toFixed(4)}) translate(${f2(-pcx)} ${f2(-pcy)})">${inner}</g></g>`;
      const kp = E.hero(seg(L.u, 0.08, 0.5)), tx = row ? px + pw + p.gap * S : cx - phw / 2, ty = row ? cy + S * 0.35 : cy + S * 1.0;
      out += `<g opacity="${f2(kp)}">${text(p.phrase, tx + (1 - kp) * S * 0.3, ty, { size: S, weight: p.phraseWeight, fill: p.color, font: p.font })}</g>`;
      if (p.source) out += text('source: ' + p.source, cx, Math.max(py + ph, ty) + S * 0.75, { size: S * 0.28, weight: 500, fill: p.color, anchor: 'middle', font: MONO, op: 0.6 });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },

  'caption.speakerTag': { file: 'type/gfx/badges.js', tags: ['caption', 'speaker', 'label', 'tts', 'ai-voice', 'honesty', 'disclosure'], dur: 3.6, inF: 4, outF: 6,
    d: { speaker: 'AI voice', badge: 'TTS', lines: [{ t: 0.1, e: 1.7, text: 'This voice is synthetic.' }, { t: 1.9, e: 3.4, text: 'The label stays on while it speaks.' }], size: 48, pos: [0.5, 0.86], maxChars: 34,
      color: '#FFFFFF', scrim: '#000000', scrimOp: 0.55, accent: '#7A5CFF', wave: true, font: FONT, mono: MONO },
    svg(L, p, c) {
      const S = p.size * c.s, u = L.u, ln = p.lines.find((l) => u >= l.t && u < l.e), kl = ln ? clamp((u - ln.t) / 0.12) * clamp((ln.e - u) / 0.1) : 0;
      const wrap = (str) => { const out = ['']; for (const w of String(str).split(/\s+/)) { if ((out.at(-1) + ' ' + w).trim().length > p.maxChars && out.at(-1)) out.push(w); else out[out.length - 1] = (out.at(-1) + ' ' + w).trim(); } return out.length > 2 ? [out[0], out.slice(1).join(' ').slice(0, p.maxChars - 1) + '…'] : out; };
      const rows = ln ? wrap(ln.text) : [], tf = { weight: 600, font: p.font }, cs = S * 0.62, wvW = p.wave ? S * 0.62 : 0, spW = measure(p.speaker, cs, { weight: 800, font: p.font }), bW = p.badge ? measure(p.badge, S * 0.42, { weight: 600, font: p.mono }) + S * 0.34 : 0;
      const chipW = S * 0.36 + wvW + (wvW ? S * 0.2 : 0) + spW + (bW ? S * 0.22 + bW : 0) + S * 0.36, chipH = S * 1.02, gapX = S * 0.3, lh = S * 1.28;
      const w1 = rows[0] ? measure(rows[0], S, tf) : 0, w2 = rows[1] ? measure(rows[1], S, tf) : 0, line1 = chipW + (w1 ? gapX + w1 : 0), bw = Math.max(line1, w2) + S * 0.7, bh = lh * Math.max(1, rows.length) + S * 0.4;
      const Sf = c.safe, cx = clamp(p.pos[0] * c.W, Sf.x0 + bw / 2, Sf.x1 - bw / 2), bot = Math.min(p.pos[1] * c.H, Sf.y1), top = bot - bh, x1 = cx - line1 / 2, y1 = top + S * 0.2 + lh / 2;
      let out = `<rect x="${f2(cx - bw / 2)}" y="${f2(top)}" width="${f2(bw)}" height="${f2(bh)}" rx="${f2(S * 0.3)}" fill="${p.scrim}" opacity="${f2(p.scrimOp * kl)}"/>`;
      let chip = `<rect x="${f2(x1)}" y="${f2(y1 - chipH / 2)}" width="${f2(chipW)}" height="${f2(chipH)}" rx="${f2(chipH / 2)}" fill="${p.accent}"/>`, cxp = x1 + S * 0.36;
      if (wvW) { for (let i = 0; i < 5; i++) { const amp = ln ? 0.3 + 0.7 * Math.abs(Math.sin(TAU * (2.3 + i * 0.7) * u + i)) : 0.22, bh2 = chipH * 0.56 * amp, bx = cxp + i * (wvW / 5) + wvW / 10;
        chip += `<rect x="${f2(bx - S * 0.035)}" y="${f2(y1 - bh2 / 2)}" width="${f2(S * 0.07)}" height="${f2(bh2)}" rx="${f2(S * 0.035)}" fill="#FFFFFF"/>`; } cxp += wvW + S * 0.2; }
      chip += text(p.speaker, cxp, y1 + cs * 0.36, { size: cs, weight: 800, fill: '#FFFFFF', font: p.font }); cxp += spW + S * 0.22;
      if (bW) chip += `<rect x="${f2(cxp)}" y="${f2(y1 - S * 0.27)}" width="${f2(bW)}" height="${f2(S * 0.54)}" rx="${f2(S * 0.1)}" fill="none" stroke="#FFFFFF" stroke-width="${f2(S * 0.04)}"/>` + text(p.badge, cxp + bW / 2, y1 + S * 0.15, { size: S * 0.42, weight: 600, fill: '#FFFFFF', anchor: 'middle', font: p.mono });
      out += chip;
      if (rows[0]) out += `<g opacity="${f2(kl)}">${text(rows[0], x1 + chipW + gapX, y1 + S * 0.36, { size: S, weight: 600, fill: p.color, font: p.font })}${rows[1] ? text(rows[1], cx, y1 + lh + S * 0.36, { size: S, weight: 600, fill: p.color, anchor: 'middle', font: p.font }) : ''}</g>`;
      return `<g opacity="${f2(op(L))}">${out}</g>`; } },

  'title.timeCard': { file: 'type/gfx/badges.js', tags: ['title', 'time-skip', 'comedy', 'cartoon', 'card', 'sting', 'full-frame'], dur: 1.8, inF: 1, outF: 5,
    d: { text: 'A LITTLE LATER...', colors: ['#FFD23A', '#FF8A1F'], ink: '#FFFFFF', outline: '#1A1022', size: 150, rays: 16, spin: 14, wobble: 2, font: FONT, weight: 800, stroke: 0.14, maxW: 0.84 },
    svg(L, p, c) {
      const u = L.u, id = uidOf('timeCard', p), cx = c.W / 2, cy = c.H / 2, R = Math.hypot(c.W, c.H), fo = { weight: p.weight, font: p.font, ls: 0 }, lines = String(p.text).split('|');
      let S = p.size * c.s; const widest = Math.max(...lines.map((l) => measure(l, S, fo))); if (widest > p.maxW * c.W) S *= (p.maxW * c.W) / widest;
      let out = `<defs><radialGradient id="${id}v" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="${p.outline}" stop-opacity="0"/><stop offset="100%" stop-color="${p.outline}" stop-opacity="0.45"/></radialGradient></defs><rect width="${c.W}" height="${c.H}" fill="${p.colors[1]}"/>`;
      for (let i = 0; i < p.rays; i++) { const a0 = ((i / p.rays) * 360 + p.spin * u) * (Math.PI / 180), a1 = a0 + Math.PI / p.rays;
        out += `<path d="M${f2(cx)} ${f2(cy)} L${f2(cx + Math.cos(a0) * R)} ${f2(cy + Math.sin(a0) * R)} L${f2(cx + Math.cos(a1) * R)} ${f2(cy + Math.sin(a1) * R)} Z" fill="${p.colors[0]}"/>`; }
      out += `<rect width="${c.W}" height="${c.H}" fill="url(#${id}v)"/>`; let wi = 0;
      lines.forEach((ln, li) => { const words = ln.split(' ').filter(Boolean), sp = measure(' ', S, fo), ws = words.map((w) => measure(w, S, fo)), tot = ws.reduce((a, b) => a + b, 0) + (sp + p.stroke * S * 0.5) * (words.length - 1);
        let x = cx - tot / 2; const base = cy + (li - (lines.length - 1) / 2) * S * 1.08 + S * 0.35;
        words.forEach((w, i) => { const sc = spring(u - 0.03 - wi * 0.07, 'mascot'), rot = p.wobble * Math.sin(TAU * 1.4 * u + wi), mx = x + ws[i] / 2, my = base - S * 0.35; wi++;
          if (sc > 0.001) { const st = `stroke="${p.outline}" stroke-width="${f2(p.stroke * S)}" stroke-linejoin="round" paint-order="stroke"`;
            out += `<g transform="translate(${f2(mx)} ${f2(my)}) rotate(${f2(rot)}) scale(${sc.toFixed(4)}) translate(${f2(-mx)} ${f2(-my)})">${text(w, x + S * 0.05, base + S * 0.07, { size: S, weight: p.weight, fill: p.outline, font: p.font, extra: st })}${text(w, x, base, { size: S, weight: p.weight, fill: p.ink, font: p.font, extra: st })}</g>`; }
          x += ws[i] + sp + p.stroke * S * 0.5; }); });
      return `<g opacity="${f2(1 - L.out)}">${out}</g>`; } },
};
export const BADGE_CUES = {
  'callout.selectionBox': (p) => [{ t: 0, id: 'sfx/ui/slide', why: 'box draws' }, { t: p.handlesAt, id: 'sfx/ui/pop', why: 'handles pop' }, ...(p.cursor ? [{ t: p.cursorAt, id: 'sfx/ui/click', why: 'cursor clicks the corner' }] : []),
    ...p.texts.map(([t]) => ({ t, id: 'sfx/ui/tick', why: 'content changes, box resizes' })), ...(p.zoomAt != null ? [{ t: p.zoomAt, id: 'sfx/whoosh/whoosh_in_m', why: 'zoom locks on' }] : [])],
  'counter.scoreIterate': (p) => [...p.steps.slice(1).map((_, i) => ({ t: p.start + i * p.every, id: i % 2 ? 'sfx/ui/tick' : 'sfx/ui/count_tick', why: 'score steps' })), { t: p.start + (p.steps.length - 2) * p.every + 0.32, id: 'sfx/ui/success', why: 'final score' }],
  'counter.stepPill': (p) => p.steps.slice(1).map(([t], i) => ({ t, id: i % 2 ? 'sfx/ui/tick' : 'sfx/ui/count_tick', why: 'pill steps' })),
  'caption.speakerTag': () => [{ t: 0, id: 'sfx/ui/mic_on', why: 'speaker label on' }],
  'title.timeCard': () => [{ t: 0, id: 'sfx/cartoon/surprise_sting', why: 'time card sting' }],
};
