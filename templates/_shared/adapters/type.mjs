/* adapter: registers every preset of the TYPE module (motion-pack/type/presets.js) as MP id 'type/<presetId>' for HyperFrames templates.
   Uses the module's own DOM back-end (type/dom.js mountType + bakeType: one tl.set per changed frame, seek-safe). Nothing re-implemented.
   Accent words (<em> in the template markup) keep their colour: they are re-coloured on the mounted units after the split. */
import { MP } from '../pack.mjs';
import { PRESET_IDS } from '../type/presets.js';
import { mountType, bakeType } from '../type/dom.js';
const strip = (s) => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
for (const id of PRESET_IDS) {
  if (id === 'scramble') continue;   // the type module says scramble needs driveType (glyph swaps are not timeline-safe)
  MP.register('type/' + id, (tl, ctx) => {
    const el = typeof ctx.el === 'string' ? document.querySelector(ctx.el) : ctx.el; if (!el) return;
    const cs = getComputedStyle(el), fontPx = parseFloat(cs.fontSize), ems = [...el.querySelectorAll('em')].map((e) => [strip(e.textContent), getComputedStyle(e).color]);
    const text = el.textContent; el.textContent = '';
    // out: 1e9 instead of noExit: type/presets.js unitStates sets opacity 0 once q >= 1 even when noExit is set (reported to the type module)
    const spec = { preset: id, text, at: ctx.at, out: ctx.out ? ctx.at + ctx.dur - 0.25 : 1e9 };
    const m = mountType(el, spec, { fontPx, H: ctx.H || 1080, font: { weight: +cs.fontWeight || 800, family: cs.fontFamily, tracking: -0.035, lineHeight: 1.02 } });
    if (ems.length) m.units.forEach((u) => { const k = ems.find(([w]) => w && strip(u.text) && w.includes(strip(u.text))); if (k) u.el.style.color = k[1]; });
    bakeType(tl, m, spec, { t0: ctx.at, dur: ctx.dur, fps: ctx.fps || 30 });
  });
}
