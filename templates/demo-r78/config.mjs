/* templates/demo-r78/config.mjs: the xp-r78 parts demo's CONFIG: the frame, the length and the part items (ids from type/gfx/index.js, at / dur in seconds, params as the parts document them).
   Placeholder content only: generic words, a fictional request, no brand, no number. */
export const CONFIG = { W: 960, H: 540, T: 11, items: [
  { id: 'type.sentenceAcrossShots', at: 0, dur: 3.2 },
  { id: 'ui.glassPanel', at: 3.2, dur: 3.8, params: { box: [0.08, 0.2, 0.4, 0.6], blurIn: [0.2, 1.0], label: 'Frosted glass', skeleton: 3 } },
  { id: 'ui.rimLight', at: 3.4, dur: 3.6, params: { box: [0.56, 0.24, 0.36, 0.52], sweep: [0.3, 1.9, 1] } },
  { id: 'ui.approvalSlider', at: 7.2, dur: 3.8, params: { box: [0.3, 0.1, 0.4, 0.74], slideAt: 0.8 } },
] };
