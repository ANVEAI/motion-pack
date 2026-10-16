/* motion-pack / type / gfx / explain-lim.js: safe ranges of the loop-driving and size parameters of the lane explainer parts (merged into GFX_LIM by index.js; safe.js clamps them before a part runs) */
export const EXPLAIN_LIM = {
  'diagram.graph': { reveal: [0, 10], dim: [0, 1], size: [0.1, 4] }, 'diagram.flow': { dots: [0, 8], rate: [0, 20], width: [0.5, 60], draw: [0.02, 20], bend: [-3, 3], size: [0.1, 4] },
  'chart.story': { dec: [0, 8], grow: [0.05, 20], stagger: [0, 5], size: [0.1, 4] }, 'map.hexTile': { bins: [1, 9], dec: [0, 8], stagger: [0, 5], size: [0.1, 4] },
  'counter.hero': { dec: [0, 8], size: [8, 1200], count: [0.05, 30] }, 'callout.datum': { size: [0.1, 4] }, 'chart.sourceFooter': { size: [0.1, 4] },
  'layout.scrolly': { focus: [0.1, 0.9], size: [0.1, 4] }, 'title.takeaway': { size: [0.1, 4] }, 'process.steps': { size: [0.1, 4] }, 'process.beforeAfter': { swap: [0, 60], size: [0.1, 4] },
};
