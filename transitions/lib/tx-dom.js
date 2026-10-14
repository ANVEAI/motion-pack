/* motion-pack / transitions / lib / tx-dom.js
   DOM/CSS back-end: for HyperFrames compositions whose shots are DOM layers (text cards, UI, <video>, <img>).
   applyDom(key, p, {a, b, root, params}) sets every style it owns from p alone (seek-safe, no tweens, no state
   besides one lazily created overlay per root). GSAP is optional: drive it from hf-seek or a proxy tween (tx-hf.js).
   a / b: two full-frame, absolutely positioned layers (NOT the .clip element itself: put them inside a clip).
   Covers 13 of the 23 transitions; GL-only effects (glitch, ink, film burn, ...) need tx-gl.js on canvas sources. */
import { REGISTRY } from './registry.js';
import { ease, resolveParams, matchPose, poseToCss, bell } from './tx-core.js';
import { DOM_X, APPROX, APPROX_KEYS } from './tx-dom-x.js';

const LAYER_PROPS = ['transform', 'transformOrigin', 'filter', 'opacity', 'clipPath', 'webkitMaskImage', 'maskImage', 'borderRadius', 'boxShadow', 'zIndex',
  'webkitMaskSize', 'maskSize', 'webkitMaskPosition', 'maskPosition', 'webkitMaskRepeat', 'maskRepeat', 'backfaceVisibility', 'mixBlendMode'];
function resetLayer(el) { for (const k of LAYER_PROPS) el.style[k] = ''; }
const show = (el, on) => { el.style.opacity = on ? '1' : '0'; };

let uid = 0;
function overlay(root) {
  let ov = root.querySelector(':scope > .mptx-ov');
  if (!ov) {
    const id = 'mptx' + (++uid);
    ov = document.createElement('div'); ov.className = 'mptx-ov'; ov.dataset.uid = id;
    ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:hidden';
    ov.innerHTML = `<div class="mptx-fill" style="position:absolute;inset:0;opacity:0"></div><div class="mptx-bars" style="position:absolute;inset:0"></div>` +
      `<svg width="0" height="0" style="position:absolute"><filter id="${id}-dblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>`;
    root.appendChild(ov);
  }
  return ov;
}
function clearOverlay(ov) { const sh = ov.querySelector(':scope > .mptx-share'); if (sh) sh.style.display = 'none';   // sharedElement clones (tx-dom-x.js)
  for (const el of (ov.parentNode || ov).querySelectorAll('[data-mptx-hide]')) { el.style.visibility = el.dataset.mptxHide === '-' ? '' : el.dataset.mptxHide; el.removeAttribute('data-mptx-hide'); }
  const f = ov.querySelector('.mptx-fill'); f.style.opacity = '0'; f.style.background = ''; f.style.mixBlendMode = ''; f.style.clipPath = ''; ov.querySelector('.mptx-bars').innerHTML = ''; }

const W = el => el.clientWidth || el.getBoundingClientRect().width, H = el => el.clientHeight || el.getBoundingClientRect().height;
const pct = v => (v * 100).toFixed(4) + '%';
function polyStar(cx, cy, R, n, inner = 0.45) { const pts = []; for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? R * inner : R; pts.push(`${(cx + Math.cos(a) * r).toFixed(2)}px ${(cy + Math.sin(a) * r).toFixed(2)}px`); } return `polygon(${pts.join(',')})`; }

export const DOM = {
  flash(p, c) { const { a, b, P, cut, ov } = c, f = ov.querySelector('.mptx-fill');
    const env = (p < cut ? (p / cut) ** 2 : (1 - (p - cut) / (1 - cut)) ** 2.2) * P.peak;
    show(a, p < cut); show(b, p >= cut); (p < cut ? a : b).style.filter = `brightness(${1 + P.bloom * env * 2})`;
    f.style.background = P.color; f.style.opacity = env.toFixed(4); },
  dip(p, c) { const { a, b, P, ov } = c, f = ov.querySelector('.mptx-fill'), a0 = (1 - P.hold) / 2, ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    show(a, p < 0.5); show(b, p >= 0.5); f.style.background = P.color; f.style.opacity = (p < 0.5 ? ss(0, a0, p) : 1 - ss(a0 + P.hold, 1, p)).toFixed(4); },
  dissolve(p, c) { const { a, b, e } = c; show(a, true); b.style.opacity = e.toFixed(4); b.style.zIndex = '2'; },
  push(p, c) { const { a, b, P, e } = c, [dx, dy] = P.dir, k = 1 - P.parallax;
    a.style.transform = `translate(${pct(-dx * e * k)},${pct(-dy * e * k)})`; a.style.filter = `brightness(${1 - 0.45 * e * Math.min(P.parallax * 4, 1)})`;
    b.style.transform = `translate(${pct(dx * (1 - e))},${pct(dy * (1 - e))})`; b.style.zIndex = '2';
    b.style.boxShadow = `${-dx * 40}px ${-dy * 40}px 60px rgba(0,0,0,${P.shadow})`; show(a, true); show(b, true); },
  swipeUp(p, c) { const { a, b, P, e, root } = c, h = H(root), ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const sB = P.scaleB + (1 - P.scaleB) * ss(0.35, 1, e), sA = 1 + (P.scaleA - 1) * e;
    a.style.transform = `translateY(${pct(-0.06 * e)}) scale(${sA})`; a.style.filter = `brightness(${1 - P.dim * e})`; a.style.borderRadius = `${P.radius * h * ss(0, 0.3, e)}px`;
    b.style.transform = `translateY(${pct(1.04 * (1 - e))}) scale(${sB})`; b.style.borderRadius = `${P.radius * h * (1 - ss(0.75, 1, e))}px`;
    b.style.boxShadow = '0 -20px 60px rgba(0,0,0,0.55)'; b.style.zIndex = '2'; show(a, true); show(b, true); root.style.background = '#050505'; },
  spin(p, c) { const { a, b, P, e, cut } = c, full = 360 * P.turns * (P.ccw ? -1 : 1), z = 1 + (P.zoom - 1) * Math.sin(Math.PI * p), blur = P.blur * Math.sin(Math.PI * p) * 10 * P.turns;
    const on = p < cut ? a : b, ang = p < cut ? full * e : full * (e - 1);
    show(a, p < cut); show(b, p >= cut); on.style.transformOrigin = `${pct(P.center[0])} ${pct(P.center[1])}`;
    on.style.transform = `rotate(${ang}deg) scale(${z})`; on.style.filter = `blur(${blur.toFixed(2)}px)`; },
  scalePunch(p, c) { const { a, b, P, cut, ov } = c, f = ov.querySelector('.mptx-fill'), o = `${pct(P.center[0])} ${pct(P.center[1])}`;
    show(a, p < cut); show(b, p >= cut); a.style.transformOrigin = o; b.style.transformOrigin = o;
    if (p < cut) { const pa = p / cut; a.style.transform = `scale(${1 + (P.anticip - 1) * pa * pa})`; f.style.opacity = '0'; }
    else { const pb = (p - cut) / (1 - cut); b.style.transform = `scale(${P.from + (1 - P.from) * ease('outCubic', pb)})`; f.style.background = '#fff'; f.style.opacity = (P.flash * (1 - pb) ** 3).toFixed(4); } },
  iris(p, c) { const { a, b, P, e, cut, root, ov } = c, w = W(root), h = H(root), cx = P.center[0] * w, cy = P.center[1] * h;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy)) * P.overscan;
    const clip = r => P.shape === 'diamond' ? `polygon(${cx}px ${cy - r * 1.42}px,${cx + r * 1.42}px ${cy}px,${cx}px ${cy + r * 1.42}px,${cx - r * 1.42}px ${cy}px)`
      : P.shape === 'star' ? polyStar(cx, cy, r * 1.9, Math.round(P.points)) : P.shape === 'roundRect' ? `inset(${Math.max(0, cy - r * 0.75)}px ${Math.max(0, w - cx - r * 0.75 * w / h)}px ${Math.max(0, h - cy - r * 0.75)}px ${Math.max(0, cx - r * 0.75 * w / h)}px round ${r * 0.2}px)` : `circle(${r}px at ${cx}px ${cy}px)`;
    if (P.throughBlack) { const f = ov.querySelector('.mptx-fill'); const pa = Math.min(1, p / cut), pb = Math.max(0, (p - cut) / (1 - cut)), sm = x => x * x * (3 - 2 * x);
      const r = (p < cut ? 1 - sm(pa) : sm(pb)) * far, on = p < cut ? a : b; show(a, p < cut); show(b, p >= cut);
      f.style.background = P.color; f.style.opacity = '1'; f.style.zIndex = '-1'; root.style.background = P.color; on.style.clipPath = clip(r); on.style.zIndex = '2'; return; }
    show(a, true); show(b, true); b.style.zIndex = '2'; b.style.clipPath = clip(e * far); },
  lumaWipe(p, c) { const { a, b, P, e } = c, s = P.softness, lo = (e * (1 + s) - s) * 100, hi = e * (1 + s) * 100;
    let m;
    if (P.matte === 'radial') m = `radial-gradient(circle farthest-corner at ${pct(P.center[0])} ${pct(P.center[1])}, #000 ${lo}%, transparent ${hi}%)`;
    else if (P.matte === 'linear') m = `linear-gradient(${90 - P.angle}deg, #000 ${lo}%, transparent ${hi}%)`;
    else throw new Error(`lumaWipe matte '${P.matte}' is GL-only (DOM supports linear, radial)`);
    if (P.invert) m = m.replace('#000', 'TMP').replace('transparent', '#000').replace('TMP', 'transparent');
    show(a, true); show(b, true); b.style.zIndex = '2'; b.style.webkitMaskImage = m; b.style.maskImage = m; },
  shutter(p, c) { const { a, b, P, cut, ov } = c, n = Math.round(P.bars), box = ov.querySelector('.mptx-bars'), sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    if (box.children.length !== n) { box.innerHTML = ''; for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute'; box.appendChild(d); } }
    show(a, p < cut); show(b, p >= cut);
    for (let i = 0; i < n; i++) { const d = (i / Math.max(n - 1, 1)) * P.stagger, cl = sm((p / cut - d) / (1 - P.stagger)), op = sm(((p - cut) / (1 - cut) - d) / (1 - P.stagger));
      const fromLeft = i % 2 === 0, x0 = p < cut ? 0 : op, x1 = p < cut ? cl : 1, L = fromLeft ? x0 : 1 - x1, Wd = Math.max(0, x1 - x0), el = box.children[i];
      const pos = P.vertical ? { left: pct(i / n), width: pct(1 / n + 0.001), top: pct(L), height: pct(Wd) } : { top: pct(i / n), height: pct(1 / n + 0.001), left: pct(L), width: pct(Wd) };
      Object.assign(el.style, pos, { background: P.color, boxShadow: `0 0 ${24 * P.edge}px rgba(255,255,255,${0.5 * P.edge})` }); } },
  whip(p, c) { const { a, b, P, e, root, ov } = c, [dx, dy] = P.dir, v = Math.sin(Math.PI * p) ** 2, blurPx = P.blurMax * v * (dx ? W(root) : H(root)) * 0.35;
    const fe = ov.querySelector('feGaussianBlur'); fe.setAttribute('stdDeviation', dx ? `${blurPx.toFixed(2)} 0` : `0 ${blurPx.toFixed(2)}`);
    const url = `url(#${ov.dataset.uid}-dblur)`;
    a.style.transform = `translate(${pct(-dx * e)},${pct(-dy * e)})`; b.style.transform = `translate(${pct(dx * (1 - e))},${pct(dy * (1 - e))})`;
    a.style.filter = url; b.style.filter = url; show(a, true); show(b, true); },
  blurCross(p, c) { const { a, b, P, e, root } = c, r = P.radius * H(root) * Math.sin(Math.PI * p) * 0.5, ss = (x) => { const t = Math.min(1, Math.max(0, (x - 0.3) / 0.4)); return t * t * (3 - 2 * t); };
    a.style.filter = `blur(${r.toFixed(2)}px)`; b.style.filter = `blur(${r.toFixed(2)}px)`; show(a, true); b.style.opacity = ss(e).toFixed(4); b.style.zIndex = '2'; },
  match(p, c) { const { a, b, P, cut, root } = c, w = W(root), h = H(root);
    const A_ = { x: P.anchorA[0], y: P.anchorA[1], scale: P.anchorA[2], rot: P.anchorA[3] }, B_ = { x: P.anchorB[0], y: P.anchorB[1], scale: P.anchorB[2], rot: P.anchorB[3] };
    const pose = matchPose(A_, B_, p, { cut, lead: P.lead, settle: P.settle, meet: P.meet }), on = pose.shot === 'A' ? a : b;
    show(a, pose.shot === 'A'); show(b, pose.shot === 'B'); on.style.transformOrigin = '0 0'; on.style.transform = poseToCss(pose, w, h); },
};

/** Apply transition `key` at linear progress p to layers a -> b inside root. Endpoints are exact (A only / B only). */
export function applyDom(key, p, { a, b, root, params = {}, easeName = null, cut = null }) {
  const entry = REGISTRY[key]; if (!entry) throw new Error(`unknown transition '${key}'`);
  const ap = !DOM[key] && APPROX[key];   // GL-only key: DOM approximation (tx-dom-x.js), same timing and swap frame
  if (!DOM[key] && !ap) throw new Error(`'${key}' has no DOM back-end (use tx-gl.js); DOM keys: ${Object.keys(DOM).join(', ')}`);
  const ov = overlay(root); resetLayer(a); resetLayer(b); clearOverlay(ov); root.style.background = ''; root.style.perspective = '';
  const pc = Math.min(1, Math.max(0, p));
  if (pc <= 0 || pc >= 1) { show(a, pc <= 0); show(b, pc >= 1); return; }
  const P = resolveParams(entry, params), e = ease(easeName || entry.timing.ease, pc), cp = cut ?? entry.timing.cut;
  if (!ap || ap.fn) return (ap ? ap.fn : DOM[key])(pc, { a, b, root, ov, P, e, cut: cp });
  const via = REGISTRY[ap.via];
  DOM[ap.via](pc, { a, b, root, ov, P: resolveParams(via, ap.params(P)), e: ease(via.timing.ease, pc), cut: cp });
}
Object.assign(DOM, DOM_X);   // 2026-10-13 expansion: real DOM back-ends (tx-dom-x.js)
export const DOM_KEYS = Object.keys(DOM);
export { APPROX_KEYS };   // GL-only keys with a DOM approximation (kind 'dom', approx: true in ids.js)
export { bell };
