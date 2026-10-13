/* motion-pack / transitions / lib / tx-hf.js
   HyperFrames binding. HyperFrames 0.8.142 publishes the frame time two ways: the GSAP timeline registered on
   window.__timelines[id] (seeked by the runtime) and the `hf-seek` event + window.__hfThreeTime (three adapter).
   hfBind() listens to both, so a composition renders from t alone whether or not GSAP is loaded.

   import { hfBind } from './lib/tx-hf.js';
   hfBind(t => renderAt(t), { compositionId: 'main', duration: 6 });   // root needs data-duration="6"        */
export function hfBind(renderAt, { compositionId = null, duration = null, gsap = (typeof window !== 'undefined' && window.gsap) || null } = {}) {
  let last = null;
  const draw = t => { t = Math.max(0, +t || 0); if (t === last) return; last = t; renderAt(t); };
  window.addEventListener('hf-seek', e => draw(e.detail && e.detail.time));
  if (gsap && compositionId && duration) {
    const tl = gsap.timeline({ paused: true }), o = { t: 0 };
    tl.fromTo(o, { t: 0 }, { t: duration, duration, ease: 'none', immediateRender: false, onUpdate: () => draw(o.t) }, 0);
    window.__timelines = window.__timelines || {}; window.__timelines[compositionId] = tl;
  }
  draw(window.__hfThreeTime || 0);
  return { draw };
}
