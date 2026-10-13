/* motion-pack / layers / presets / grades.js: eight genre grades (+ identity). Starting values: each was judged on layers/demo stills
   (skin ramp, saturated primaries, greys, a night-sky gradient) and then frozen. ONE grade per piece (two per scene at most, 12-frame crossfade via mixGrade).
   Fields: see layers/grade.js. temp > 0 warm, tint > 0 magenta, contrast 0..1 (14x logistic gain), sat 1 = unchanged. */
export const GRADES = {
  neutral: { },
  /* premium product: clean, cool-neutral whites, deep clean blacks, restrained colour, glassy highlight roll-off */
  'premium-product': { temp: -0.04, contrast: 0.16, slope: [1.0, 1.0, 1.015], power: [1.03, 1.03, 1.02], sat: 1.05, split: { shadowHue: 225, shadowSat: 0.10, highHue: 45, highSat: 0.05, balance: 0 }, fade: 0 },
  /* warm film: Kodak-flavoured, warm highlights, teal-green shadows, a touch of black lift */
  'warm-film': { temp: 0.12, contrast: 0.20, slope: [1.03, 1.0, 0.96], power: [0.99, 1.0, 1.02], sat: 1.04, split: { shadowHue: 175, shadowSat: 0.10, highHue: 38, highSat: 0.12, balance: 0 }, fade: 0.02 },
  /* cool tech: blue-cyan shadows, magenta-leaning highlights, crisp contrast, a little extra saturation */
  'cool-tech': { temp: -0.20, contrast: 0.28, slope: [0.96, 1.0, 1.07], power: [1.02, 1.0, 0.98], sat: 1.10, split: { shadowHue: 215, shadowSat: 0.30, highHue: 195, highSat: 0.08, balance: -0.05 }, fade: 0.005 },
  /* retro VHS: lifted blacks, desaturated, magenta shadows, yellow-green highlights, soft contrast */
  'retro-vhs': { temp: 0.02, tint: 0.12, contrast: 0.05, slope: [1.02, 0.98, 1.03], power: [0.96, 0.98, 0.94], sat: 0.80, split: { shadowHue: 300, shadowSat: 0.24, highHue: 62, highSat: 0.10, balance: 0 }, fade: 0.08 },
  /* nostalgic print: faded warm photo print, milky blacks, yellowed highlights, cyan-ish shadow cast */
  'nostalgic-print': { temp: 0.16, contrast: 0.06, slope: [1.03, 1.0, 0.92], power: [0.95, 0.96, 0.99], sat: 0.84, split: { shadowHue: 195, shadowSat: 0.16, highHue: 48, highSat: 0.22, balance: 0.05 }, fade: 0.07 },
  /* bright playful: toon-saturated, lifted mids, clean blacks, nothing muddy */
  'bright-playful': { temp: 0.03, contrast: 0.14, slope: [1.02, 1.01, 1.0], power: [0.95, 0.95, 0.96], sat: 1.30, split: { shadowHue: 260, shadowSat: 0.06, highHue: 50, highSat: 0.06, balance: 0 }, fade: 0 },
  /* noir: monochrome through a red filter (skies dark, skin bright), hard contrast, crushed blacks */
  noir: { contrast: 0.40, slope: [1.22, 0.95, 0.72], power: [1.12, 1.12, 1.12], sat: 0, fade: 0.01 },
  /* documentary: honest, slightly warm neutral, mild contrast, restrained saturation, tiny black lift */
  documentary: { temp: 0.05, contrast: 0.10, slope: [1.02, 1.0, 0.985], power: [1.0, 1.0, 1.0], sat: 0.97, split: { shadowHue: 210, shadowSat: 0.03, highHue: 40, highSat: 0.03, balance: 0 }, fade: 0.012 },
};
export const GRADE_TAGS = {
  'premium-product': ['product', 'ad', 'clean', 'tech', 'launch', 'ui'], 'warm-film': ['film', 'short-film', 'drama', 'warm', 'human', 'nostalgia'],
  'cool-tech': ['tech', 'cyber', 'night', 'saas', 'ai', 'hype'], 'retro-vhs': ['retro', 'vhs', 'lofi', '90s', 'glitch'],
  'nostalgic-print': ['nostalgia', 'memory', 'flashback', 'print', 'vintage'], 'bright-playful': ['mime', 'cartoon', 'kids', 'playful', 'social', 'comedy'],
  noir: ['noir', 'thriller', 'bw', 'mono', 'drama'], documentary: ['talking-head', 'interview', 'documentary', 'human', 'founder', 'vlog'],
};
export const GRADE_NAMES = Object.keys(GRADES).filter((k) => k !== 'neutral');
