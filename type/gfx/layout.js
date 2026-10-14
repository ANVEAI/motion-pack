/* motion-pack / type / gfx / layout.js: multi-shot layouts for HyperFrames DOM shots (video / img / div layers, full-frame, absolutely positioned).
   layoutAt(id, t, params, {W, H}) -> { slots: [css per shot], svg: overlay markup (dividers, handle, labels), hold?: true }; applyLayout(els, state, overlayEl) sets the styles; put the overlay ABOVE the shots (z-index > 4), slots use z-index 1..4.
   Each slot shows the CENTRE of its shot (clip in the shot's own space + a translate), so nothing is squashed. Pure functions of t (seek-safe).
   layout.splitScreen (vertical | horizontal | diagonal | 3up | grid), layout.pip (corner snap, rounded, slide-in), layout.beforeAfter (wipe + handle), layout.freezeFrame (stroke card), layout.cornerPin (4-point warp, cornerpin.js). */
import { E, clamp, lerp, seg } from '../ease.js';
import { PIN_LAYOUTS } from './cornerpin.js';
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const slotCss = ([x, y, w, h], W, H, r = 0) => { const sx = x + w / 2 - W / 2, sy = y + h / 2 - H / 2; return { clipPath: `inset(${f2(y - sy)}px ${f2(W - (x - sx) - w)}px ${f2(H - (y - sy) - h)}px ${f2(x - sx)}px${r ? ` round ${f2(r)}px` : ''})`, transform: `translate(${f2(sx)}px, ${f2(sy)}px)` }; };
export const LAYOUTS = {
  'layout.splitScreen': { tags: ['layout', 'split-screen', 'comparison', 'duet', 'reaction'], d: { mode: 'vertical', gap: 8, at: 0, dur: 0.5, line: '#FFFFFF' },
    at(t, p, { W, H }) { const k = E.hero(seg(t, p.at, p.at + p.dur)), g = p.gap * H / 1080, m = p.mode; let rects = [], svg = '';
      if (m === 'vertical') { const x = lerp(W, W / 2, k); rects = [[0, 0, x - g / 2, H], [x + g / 2, 0, W - x - g / 2, H]]; svg = `<rect x="${f2(x - g / 2)}" y="0" width="${f2(g)}" height="${H}" fill="${p.line}"/>`; }
      else if (m === 'horizontal') { const y = lerp(H, H / 2, k); rects = [[0, 0, W, y - g / 2], [0, y + g / 2, W, H - y - g / 2]]; svg = `<rect x="0" y="${f2(y - g / 2)}" width="${W}" height="${f2(g)}" fill="${p.line}"/>`; }
      else if (m === '3up') { const w3 = (W - 2 * g) / 3; rects = [0, 1, 2].map((i) => [i * (w3 + g), H * (1 - k) * (i % 2 ? -1 : 1), w3, H]); }
      else if (m === 'grid') { const w2 = (W - g) / 2, h2 = (H - g) / 2; rects = [[0, 0, w2, h2], [w2 + g, 0, w2, h2], [0, h2 + g, w2, h2], [w2 + g, h2 + g, w2, h2]].map((r, i) => (i ? [r[0], r[1] + (1 - k) * H, r[2], r[3]] : r)); }
      if (m === 'diagonal') { const o = lerp(W * 1.2, W * 0.5, k), sk = 0.18 * W, sh = 0.22 * W * k;   // left slot shifted -sh, right +sh (each shows its shot's centre); clips are in the shot's own space
        return { slots: [{ clipPath: `polygon(${f2(sh)}px 0, ${f2(o + sk - g + sh)}px 0, ${f2(o - sk - g + sh)}px ${H}px, ${f2(sh)}px ${H}px)`, transform: `translate(${f2(-sh)}px, 0)`, zIndex: '1' },
          { clipPath: `polygon(${f2(o + sk + g - sh)}px 0, ${f2(W - sh)}px 0, ${f2(W - sh)}px ${H}px, ${f2(o - sk + g - sh)}px ${H}px)`, transform: `translate(${f2(sh)}px, 0)`, zIndex: '2' }],
          svg: `<line x1="${f2(o + sk)}" y1="0" x2="${f2(o - sk)}" y2="${H}" stroke="${p.line}" stroke-width="${f2(g)}"/>` }; }
      return { slots: rects.map((r, i) => ({ ...slotCss(r, W, H), zIndex: String(i + 1) })), svg }; } },
  'layout.pip': { tags: ['layout', 'pip', 'picture-in-picture', 'reaction', 'tutorial'], d: { corner: 'br', size: 0.3, margin: 0.04, radius: 0.025, at: 0, dur: 0.45, border: '#FFFFFF', borderW: 4 },
    at(t, p, { W, H }) { const k = E.hero(seg(t, p.at, p.at + p.dur)), w = W * p.size, h = H * p.size, m = Math.min(W, H) * p.margin, R = p.radius * H;
      const x = p.corner.includes('r') ? W - w - m : m, y = p.corner.includes('b') ? H - h - m : m, off = (p.corner.includes('r') ? 1 : -1) * (w + m + 20) * (1 - k), s = p.size;
      return { slots: [{ zIndex: '1' }, { transformOrigin: '0 0', transform: `translate(${f2(x + off)}px, ${f2(y)}px) scale(${s})`, borderRadius: `${f2(R / s)}px`, overflow: 'hidden', boxShadow: `0 0 0 ${f2(p.borderW / s)}px ${p.border}, 0 ${f2(20 / s)}px ${f2(50 / s)}px rgba(0,0,0,0.45)`, zIndex: '2' }], svg: '' }; } },
  'layout.beforeAfter': { tags: ['layout', 'before-after', 'comparison', 'wipe', 'transformation'], d: { from: 0.0, to: 0.5, at: 0, dur: 1.0, sweep: true, labels: ['BEFORE', 'AFTER'], line: '#FFFFFF' },
    at(t, p, { W, H }) { let x = lerp(p.from, p.to, E.move(seg(t, p.at, p.at + p.dur))); if (p.sweep && t > p.at + p.dur) x = clamp(p.to + 0.12 * Math.sin((t - p.at - p.dur) * 1.6), 0.05, 0.95); const X = x * W, hs = 34 * H / 1080;
      return { slots: [{ zIndex: '1' }, { clipPath: `inset(0 0 0 ${f2(X)}px)`, zIndex: '2' }],
        svg: `<rect x="${f2(X - 3)}" y="0" width="6" height="${H}" fill="${p.line}"/><circle cx="${f2(X)}" cy="${f2(H / 2)}" r="${f2(hs)}" fill="${p.line}"/><path d="M${f2(X - hs * 0.5)} ${f2(H / 2)} l${f2(hs * 0.3)} ${f2(-hs * 0.3)} v${f2(hs * 0.6)} Z M${f2(X + hs * 0.5)} ${f2(H / 2)} l${f2(-hs * 0.3)} ${f2(-hs * 0.3)} v${f2(hs * 0.6)} Z" fill="#111"/>` +
          p.labels.map((l, i) => `<text x="${f2(i ? W - 40 : 40)}" y="${f2(70 * H / 1080)}" text-anchor="${i ? 'end' : 'start'}" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="${f2(40 * H / 1080)}" fill="#fff" stroke="rgba(0,0,0,0.5)" stroke-width="3" paint-order="stroke">${l}</text>`).join('') }; } },
  'layout.freezeFrame': { tags: ['freeze-frame', 'record-scratch', 'intro', 'comedy', 'stroke'], d: { at: 0, dur: 0.25, scale: 0.84, rot: -3, stroke: '#FFFFFF', strokeW: 14, label: '' },
    at(t, p, { W, H }) { const k = E.pop(seg(t, p.at, p.at + p.dur)), on = t >= p.at, s = lerp(1, p.scale, k), sw = p.strokeW * H / 1080;
      return { hold: on, slots: [{ transform: `rotate(${f2(p.rot * k)}deg) scale(${f2(s)})`, boxShadow: on ? `0 0 0 ${f2(sw / s)}px ${p.stroke}, 0 30px 80px rgba(0,0,0,0.5)` : '', zIndex: '2' }],
        svg: on && p.label ? `<text x="${f2(W / 2)}" y="${f2(H * 0.9)}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="${f2(72 * H / 1080)}" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke" opacity="${f2(seg(t, p.at + 0.1, p.at + 0.3))}">${p.label}</text>` : '' }; } },
};
Object.assign(LAYOUTS, PIN_LAYOUTS);   // layout.cornerPin (cornerpin.js): one slot, a matrix3d that lands the element on a quad
const PROPS = ['clipPath', 'transform', 'transformOrigin', 'zIndex', 'borderRadius', 'overflow', 'boxShadow', 'opacity'];
export function layoutAt(id, t, params = {}, size = { W: 1920, H: 1080 }) { const L = LAYOUTS[id]; if (!L) throw new Error('unknown layout ' + id); return L.at(t, { ...L.d, ...params }, size); }
export function applyLayout(els, state, overlay = null) { els.forEach((el, i) => { const s = state.slots[i] || {}; for (const k of PROPS) el.style[k] = s[k] ?? ''; }); if (overlay) overlay.innerHTML = state.svg || ''; return state; }
