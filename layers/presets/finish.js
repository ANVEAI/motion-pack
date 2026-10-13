/* motion-pack / layers / presets / finish.js: full finishing recipes by genre. Each is a partial of FINISH_DEFAULTS (finisher.js).
   Rules baked in: ONE grade, one bloom, one vignette, one grain; story type is never under bloom/halation/chroma (the stack puts type above them). */
export const FINISH_PRESETS = {
  'none-clean': { name: 'none-clean', grain: { stock: 'none', amount: 0 } },
  /* clean ad / product / UI: crisp, almost invisible finish */
  'premium-product': { name: 'premium-product', grade: 'premium-product', chroma: { cornerPx: 1.0 }, bloom: { amount: 0.18, threshold: 0.85, knee: 0.15 }, vignette: { amount: 0.10 }, grain: { stock: 'clean' }, sharpen: { amount: 0.15, px: 0.8 } },
  /* short film / cinema: halation, bloom, cinema vignette, 35 mm grain, dust, gate weave */
  'warm-film': { name: 'warm-film', grade: 'warm-film', chroma: { cornerPx: 1.2 }, bloom: { amount: 0.20, threshold: 0.88, knee: 0.2 }, halation: { amount: 0.26, threshold: 0.86, tint: [1.0, 0.30, 0.10], core: 0.08 },
    vignette: { amount: 0.22, roundness: 0.5 }, grain: { stock: 'film35' }, dust: { density: 0.4, hair: 1, scratch: 0.5 }, weave: { on: true }, flicker: { amount: 0.012 }, lens: { k1: 0.02 } },
  /* tech / AI / night: crisp cyan-magenta, chroma on the hits, pink halation */
  'cool-tech': { name: 'cool-tech', grade: 'cool-tech', chroma: { cornerPx: 2.0, hitPx: 8 }, bloom: { amount: 0.20, threshold: 0.86, knee: 0.2, tint: [0.9, 0.97, 1.05] }, halation: { amount: 0.14, threshold: 0.88, tint: [1.0, 0.25, 0.65] },
    vignette: { amount: 0.16 }, grain: { stock: 'clean' }, glitch: { on: true }, sharpen: { amount: 0.2 } },
  /* 90s camcorder: scanlines, chroma bleed, tracking noise, head-switch, barrel */
  'retro-vhs': { name: 'retro-vhs', grade: 'retro-vhs', chroma: { cornerPx: 3.0 }, lens: { k1: 0.06 }, bloom: { amount: 0.30, threshold: 0.75, knee: 0.2 },
    retro: { scanPitch: 3, scanDepth: 0.18, mask: 0.08, vhsChroma: 4, vhsLift: 0.04, vhsSat: 0.9, vhsTrack: 1, vhsHead: 1 }, vignette: { amount: 0.20 }, grain: { stock: 'vhs' }, flicker: { amount: 0.02 } },
  /* faded family print / flashback: paper tooth, milky blacks, warm leak, heavy dust */
  'nostalgic-print': { name: 'nostalgic-print', grade: 'nostalgic-print', diffusion: { amount: 0.12, lift: 0.010 }, bloom: { amount: 0.18, threshold: 0.84, knee: 0.25 }, halation: { amount: 0.18, tint: [1.0, 0.45, 0.15] },
    leaks: { on: true, loop: true, intensity: 0.35, count: 3, edge: 'left', colors: ['#FF8A3A', '#FFC070', '#E8506B'] }, paper: { amount: 0.5, scale: 1 }, vignette: { amount: 0.26, roundness: 0.4 },
    grain: { stock: 'film16' }, dust: { density: 1.0, hair: 1, scratch: 1 }, weave: { on: true }, flicker: { amount: 0.015 } },
  /* cartoon / mime-style spot / kids / comedy: clean, saturated, NO grain, no dust */
  'bright-playful': { name: 'bright-playful', grade: 'bright-playful', bloom: { amount: 0.15, threshold: 0.88, knee: 0.15 }, vignette: { amount: 0.06 }, grain: { stock: 'none', amount: 0 } },
  /* black and white thriller / noir short */
  noir: { name: 'noir', grade: 'noir', bloom: { amount: 0.20, threshold: 0.80, knee: 0.2 }, halation: { amount: 0.22, tint: [1.0, 1.0, 1.0] }, vignette: { amount: 0.36, roundness: 0.5 }, grain: { stock: 'film16' },
    dust: { density: 0.3, hair: 0.5, scratch: 0.5 }, weave: { on: true }, bars: { ratio: 2.0, reveal: null } },
  /* talking head / interview / founder video */
  documentary: { name: 'documentary', grade: 'documentary', sharpen: { amount: 0.30, px: 0.8 }, bloom: { amount: 0.10, threshold: 0.88, knee: 0.15 }, vignette: { amount: 0.12 }, grain: { stock: 'digital-soft' } },
  /* the ANVE three.js studio kit already bakes bloom, vignette and grain: finish adds only the grade and a hit-only chroma */
  'launch-studio': { name: 'launch-studio', plate: { baked: { bloom: true, vignette: true, grain: true } }, chroma: { cornerPx: 0, hitPx: 6 },
    grade: { contrast: 0.06, slope: [1.01, 1.0, 0.985], power: 0.98, sat: 0.98 } },
};
export const FINISH_TAGS = {
  'premium-product': ['ad', 'product', 'ui', 'saas', 'clean', 'launch'], 'warm-film': ['short-film', 'drama', 'cinema', 'film'], 'cool-tech': ['tech', 'ai', 'hype', 'night', 'cyber', 'beat-edit'],
  'retro-vhs': ['retro', 'vhs', 'lofi', 'glitch', 'meme'], 'nostalgic-print': ['flashback', 'nostalgia', 'memory', 'montage'], 'bright-playful': ['mime', 'cartoon', 'kids', 'comedy', 'social'],
  noir: ['noir', 'thriller', 'bw'], documentary: ['talking-head', 'interview', 'founder', 'vlog', 'retention'], 'launch-studio': ['3d', 'studio-kit'],
};
