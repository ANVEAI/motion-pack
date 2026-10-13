/* adapter: registers every TRANSITIONS-module id ('transitions/<key | kebab | alias>', see transitions/lib/ids.js) with MP for the
   HyperFrames DOM templates. It uses the module's own DOM back-end (transitions/lib/tx-dom.js applyDom: styles set from p alone).
   The template stretches the clips around each cut first (_shared/txplan.mjs span()), so both shots are on screen for the window.
   One paused GSAP proxy tween per window drives p linearly from start to end; the swap lands on ctx.cut (exact frame).
   cut / smash: registered as deliberate hard cuts. GL-only keys are not registered here: MP logs them as TODO and hard-cuts. */
import { MP } from '../pack.mjs';
import { applyDom } from '../transitions/lib/tx-dom.js';
import { ALIASES, resolveTx } from '../transitions/lib/ids.js';
const els = (s) => [].concat(s || []).flatMap((x) => (typeof x === 'string' ? [...document.querySelectorAll(x)] : [x])).filter(Boolean);
for (const name of Object.keys(ALIASES)) {
  const r = resolveTx(name);
  if (r.kind === 'cut' || r.kind === 'smash') { MP.register(r.id, () => {}); continue; }
  if (r.kind !== 'dom') continue;
  MP.register(r.id, (tl, ctx) => {
    const A = els(ctx.out), B = els(ctx.in), root = document.querySelector(ctx.root || '#root');
    if (!A.length || !B.length || !(ctx.end > ctx.start)) return MP._miss(r.id + ' @' + ctx.cut, 'hard cut (no overlap window)');
    const params = { ...r.params, ...(ctx.params || {}) }, cut = (ctx.cut - ctx.start) / (ctx.end - ctx.start), o = { p: 0 };
    const draw = () => { for (const a of A) for (const b of B) applyDom(r.key, o.p, { a, b, root, params, cut }); };
    tl.fromTo(o, { p: 0 }, { p: 1, duration: ctx.end - ctx.start, ease: 'none', immediateRender: false, onUpdate: draw }, ctx.start);
  });
}
