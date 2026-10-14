/* motion-pack / layers / limits.js: the safe range of every loop-driving numeric parameter of the Canvas2D layer kinds (K2D) and the backgrounds (BG) (2026-10-15), and the guard that applies it.
   guardKinds(table, lims) wraps every kind's draw(g, W, H, t, p, ...) so p goes through type/gfx/safe.js saneParams first: NaN / Infinity become the default, and each limited parameter is clamped into
   [lo, hi] (a count above its maximum draws the maximum, a step or radius below its minimum uses the minimum), so radius 0, count 1e9 or n NaN can neither hang a tab nor exhaust memory. The maxima are
   well above any shot (about 5x to 10x the default) and low enough that every limit at its maximum at once still draws within the fuzz test's call budget. The state functions that parse their own
   params (hexState, embeddingState, convergeState, epicycleState, dotCondense, hologramState) call saneParams with the same limits, so a direct call is guarded too.
   tools/tests/fuzz-params.test.mjs draws every kind with 0, -1, NaN, Infinity, 1e9 and 1e-6 on every numeric default and fails on a hang, a runaway or an out-of-memory: add the parameter here when it does. */
import { saneParams } from '../type/gfx/safe.js';
export const K2D_LIM = {
  sparks: { count: [0, 1500] }, embers: { count: [0, 1500] }, smoke: { count: [0, 400] }, confetti: { count: [0, 1500] }, snow: { count: [0, 2000] }, motes: { count: [0, 1500] },
  sprocket: { holes: [0, 60] }, impactFrame: { spikes: [0, 400] }, arBars: { bars: [1, 256] }, arRing: { rings: [1, 24] }, arSpectrum: { bands: [1, 256] },
  dotCondense: { n: [1, 2000] }, hologramBeam: { 'rect.*': [-1, 2], rings: [0, 40] },
  embeddingCloud: { n: [1, 1500], clusters: [1, 24] }, epicycleDraw: { samples: [16, 2048], trail: [0, 4] }, hexMosaic: { radius: [8, 400] }, convergeToDot: { nodes: [2, 400], links: [0, 12] },
};
export const BG_LIM = { gridTunnel: { lines: [1, 64], depth: [1, 64] }, dotGrid: { fade: [0, 1] } };
export function guardKinds(table, lims = {}) {
  for (const [k, def] of Object.entries(table)) {
    if (def.guarded || typeof def.draw !== 'function') continue; const raw = def.draw, lim = lims[k] || null;
    def.draw = function (g, W, H, t, p, ...rest) { return raw.call(this, g, W, H, t, saneParams(p, def.d, lim), ...rest); }; def.guarded = true; if (lim) def.lim = lim;
  }
  return table;
}
