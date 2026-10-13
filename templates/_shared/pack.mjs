/* motion-pack/templates/_shared/pack.mjs: browser runtime glue for HyperFrames templates: call other pack modules BY ID.
     import { MP } from './mp/pack.mjs';   MP.transition(tl, 'transitions/whip', { out, in, at, dur, params })
   Adapters register themselves: MP.register('transitions/whip', (tl, ctx) => {...}). A template loads adapter files that exist
   (compose.mjs copies motion-pack/<module>/dom/*.js into assets when the module ships them). Unfilled ids fall back (and are logged
   once in MP.todo + console.info):  transitions -> HARD CUT (edit.md 2.1 default);  type -> plain 6-frame fade-up;  layers -> none.
   Deterministic: no clock, no Math.random. */
export const MP = {
  REG: {}, todo: [], _seen: new Set(),
  register(id, fn) { this.REG[id] = fn; },
  _miss(id, what) { if (this._seen.has(id)) return; this._seen.add(id); this.todo.push(id + ' -> ' + what); console.info('[motion-pack] TODO hook: ' + id + ' not loaded, using ' + what); },
  transition(tl, id, ctx) { if (!id || id === 'transitions/cut') return; if (this.REG[id]) return this.REG[id](tl, ctx); this._miss(id, 'hard cut'); },
  type(tl, id, el, ctx) { if (this.REG[id]) return this.REG[id](tl, { el, ...ctx }); this._miss(id, 'plain fade');
    const f = 6 / (ctx.fps || 30); tl.fromTo(el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.5 * f, ease: 'power2.out' }, ctx.at);
    if (ctx.out) tl.to(el, { opacity: 0, duration: f, ease: 'power1.in' }, ctx.at + ctx.dur - f); },
  layer(id) { if (this.REG[id]) return this.REG[id]; this._miss(id, 'no layer'); return null; },
};
window.MP = MP;
