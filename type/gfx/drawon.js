/* motion-pack / type / gfx / drawon.js: seek-safe SVG path draw-on / trim engine (stroke-dasharray + stroke-dashoffset) for HyperFrames DOM.
   Works on any inline SVG, including icon sets you are licensed to use (Lucide ISC, Phosphor MIT, Fluent System Icons MIT: check ORIGIN.txt first).
     const items = prepareDrawOn(svgEl);                                  // measures every stroke once (getTotalLength)
     drawOnAt(items, t, { at: 0.5, dur: 0.8, stagger: 0.06, ease: 'soft', fillAfter: 0.25 });   // pure function of t
     trimAt(items, start, end)                                           // After-Effects style trim paths (0..1)
     bindDrawOn(svgEl, opts)                                             // re-renders on every 'hf-seek'
   No GSAP plugin (DrawSVG) needed. */
import { E, clamp, seg } from '../ease.js';
const SEL = 'path,line,polyline,polygon,circle,ellipse,rect';
export function prepareDrawOn(svg, { selector = SEL } = {}) {
  return [...svg.querySelectorAll(selector)].filter((el) => typeof el.getTotalLength === 'function').map((el) => {
    const len = el.getTotalLength() || 1, fill = el.getAttribute('fill');
    el.style.strokeDasharray = `${len} ${len + 1}`; el.style.strokeDashoffset = String(len); return { el, len, hasFill: fill && fill !== 'none' };
  });
}
export function drawOnAt(items, t, { at = 0, dur = 1, stagger = 0.05, ease = 'soft', mode = 'draw', fillAfter = 0 } = {}) {
  const ez = typeof ease === 'function' ? ease : E[ease] || E.soft;
  items.forEach(({ el, len, hasFill }, i) => { let k = ez(seg(t, at + i * stagger, at + i * stagger + dur)); if (mode === 'erase') k = 1 - k;
    el.style.strokeDashoffset = String(len * (1 - k)); if (hasFill && fillAfter > 0) el.style.fillOpacity = String(clamp((k - 1 + fillAfter) / fillAfter)); });
}
export function trimAt(items, start, end, offset = 0) {
  for (const { el, len } of items) { const a = clamp(Math.min(start, end)) * len, b = clamp(Math.max(start, end)) * len; el.style.strokeDasharray = `0 ${a} ${b - a} ${len}`; el.style.strokeDashoffset = String(-offset * len); }
}
/* pure-math version for SVG strings (no DOM): attributes for a path of known length */
export const drawAttrs = (len, k) => `stroke-dasharray="${len.toFixed(2)} ${(len + 1).toFixed(2)}" stroke-dashoffset="${(len * (1 - clamp(k))).toFixed(2)}"`;
export function bindDrawOn(svg, opts = {}) { const items = prepareDrawOn(svg, opts); const f = (t) => drawOnAt(items, t, opts); window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f; }
