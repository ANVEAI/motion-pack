/* motion-pack / camera / bake.js: attach a 2D camera function to a DOM wrapper in a HyperFrames composition. Two interchangeable paths, both seek-safe:
   bakeGSAP(tl, target, cam, opts)  one tl.set per frame (exact, needs nothing but the composition's own GSAP timeline; the timeline stays the single source of truth)
   driveSeek(target, cam, opts)     applies the transform directly from the 'hf-seek' event (no per-frame timeline cost; HyperFrames dispatches it on every seek)
   Both call the SAME pure function, so the two paths give identical transforms (test: camera.test.mjs, any t0).
   t0 = where the window starts on the COMPOSITION timeline (s). cam is a function of composition time, like every other part of the pack (its own `at` is composition time), so cam(T) is the picture at
   timeline position T whatever t0 is. bakeGSAP writes frames T = t0 + i/fps; before t0 the target holds the T = t0 picture and after t0 + dur the last sample. driveSeek does the same: pass dur to hold
   the end too (it is optional because a drive has no frame count).                                                                                                                       */
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
export function driveSeek(target, cam, { t0 = 0, dur = Infinity, W = 1920, H = 1080, cover = false, blurNode = null } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target, f = (T) => { const st = cam(Math.min(Math.max(T, t0), t0 + dur)), c = toCSS(st, { W, H, cover }); el.style.transform = c.transform; el.style.transformOrigin = c.transformOrigin; if (blurNode) blurNode.setAttribute('stdDeviation', blurStd(st, H)); return st; };
  window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f;
}
