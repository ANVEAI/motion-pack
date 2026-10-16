/* motion-pack / type / gfx / limits.js: the safe range of every loop-driving numeric parameter of the gfx parts (2026-10-15), by id. renderInner clamps these through safe.js saneParams before a part runs:
   a count above its maximum draws the maximum, a step below its minimum uses the minimum (so radius 0, gridStep 0, rate 0 and count 1e9 can neither hang nor exhaust memory). The maxima are well above
   anything a shot needs (about 5x to 10x the default) and low enough that every limit at its maximum at once still renders in milliseconds. Keys: a param name, 'a.b' for a nested one,
   'tiles.*' for every element of an array. tools/tests/fuzz-params.test.mjs renders every id with 0, -1, NaN, Infinity, 1e9 and 1e-6 on every numeric default and fails when a part still runs away:
   add the parameter here when it does. */
export const GFX_LIM = {
  'counter.wheel': { digits: [0, 16] }, 'fx.impact.speedLines': { lines: [0, 400] }, 'fx.impact.dustPoof': { count: [0, 120] }, 'fx.impact.star': { points: [2, 64] }, 'fx.impact.smear': { count: [0, 40] }, 'layout.backdropSwap': { gridStep: [4, 1000], every: [0.04, 60] }, 'type.wordWheel': { move: [0.04, 5] }, 'type.glyphMorphCursor': { morph: [0.04, 10], hold: [0, 30] },
  /* number formatting: toFixed() takes 0..100 digits */ 'counter.countUp': { dec: [0, 8] }, 'counter.scoreIterate': { decimals: [0, 8] }, 'ui.costTicker': { 'counters.*.dec': [0, 8] }, 'type.paramReadout': { 'fields.*.dec': [0, 8] },
  'fx.emotion.heartBurst': { count: [0, 60] }, 'fx.emotion.question': { count: [0, 12] }, 'fx.emotion.dizzy': { count: [0, 24] }, 'fx.emotion.sparkle': { count: [0, 40] },
  'social.testimonial': { stars: [0, 10] }, 'reaction.burst': { count: [0, 120] },
  'ui.failoverRoute': { rate: [0.02, 5] }, 'ui.windowWall': { count: [1, 60] }, 'ui.optionPicker': { target: [0, 100], turns: [0, 50] },
  'type.letterAssemble': { dots: [0, 80] }, 'type.marquee': { size: [0.02, 2] }, 'type.electricOutline': { bolts: [0, 12] },
  'layout.scatterCollage': { photos: [0, 40], dots: [0, 40], cols: [1, 24], rows: [1, 24] }, 'layout.mosaicBurst': { cols: [1, 40], rows: [1, 24] }, 'layout.logoWall': { cols: [1, 20], rows: [1, 12] },
  'callout.connectorLabel': { gridStep: [0.004, 0.5] }, 'type.imageFill': { 'tiles.*': [1, 24], drift: [-4, 4] }, 'title.timeCard': { rays: [0, 200] },
  'type.asciiMosaic': { cols: [4, 240], 'area.2': [0.02, 1], 'area.3': [0.02, 1] },
  /* xp-r78 (2026-10-16) */ 'layout.textWall': { cols: [1, 8], rows: [1, 8], lines: [1, 16], size: [6, 80], 'multiply.*': [0, 1000] }, 'layout.pillWall': { rows: [1, 12], size: [8, 120], gap: [2, 100] }, 'ui.rimLight': { segments: [24, 480] }, 'ui.glassPanel': { skeleton: [0, 8] },
};
