/* motion-pack / camera / bake.js: attach a 2D camera function to a DOM wrapper in a HyperFrames composition. Two interchangeable paths, both seek-safe:
   bakeGSAP(tl, target, cam, opts)  one tl.set per frame (exact, needs nothing but the composition's own GSAP timeline; the timeline stays the single source of truth)
   driveSeek(target, cam, opts)     applies the transform directly from the 'hf-seek' event (no per-frame timeline cost; HyperFrames dispatches it on every seek)
   Both call the SAME pure function, so the two paths give identical transforms (test: camera.test.mjs).                                                           */
import { toGSAP, toCSS, blurStd } from './cam2d.js';
export function bakeGSAP(tl, target, cam, { t0 = 0, dur, fps = 30, W = 1920, H = 1080, cover = false, blurNode = null } = {}) {
  const n = Math.round(dur * fps);
  for (let i = 0; i <= n; i++) {
    const t = i / fps, st = cam(t0 + t), v = toGSAP(st, { W, H, cover });
    /* a set() exactly at the timeline origin reverts on a backward seek to that time; fromTo holds frame 0 */
    if (i === 0) tl.fromTo(target, v, { ...v, duration: 1 / fps / 2, ease: 'none', immediateRender: true }, t0); else tl.set(target, v, t0 + t);
    if (blurNode) { const b = { attr: { stdDeviation: blurStd(st, H) } }; if (i === 0) tl.fromTo(blurNode, b, { ...b, duration: 1 / fps / 2, ease: 'none', immediateRender: true }, t0); else tl.set(blurNode, b, t0 + t); }
  }
  return tl;
}
export function driveSeek(target, cam, { t0 = 0, W = 1920, H = 1080, cover = false, blurNode = null } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target, f = (t) => { const st = cam(t - t0), c = toCSS(st, { W, H, cover }); el.style.transform = c.transform; el.style.transformOrigin = c.transformOrigin; if (blurNode) blurNode.setAttribute('stdDeviation', blurStd(st, H)); return st; };
  window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f;
}
