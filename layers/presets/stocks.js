/* motion-pack / layers / presets / stocks.js: film-grain stocks. amount = peak amplitude in display units (kit units: sigma at mid-grey = 0.408 * amount),
   sizePx at 1080p, chroma 0..1 (variance-preserving mix of mono and per-channel noise), midBias 0..1 (0 = flat across tones, kit = 0.45), fps = pattern rate. */
export const STOCKS = {
  none:           { amount: 0,     sizePx: 1.0, chroma: 0,    midBias: 0.45, fps: 30 },
  clean:          { amount: 0.020, sizePx: 1.0, chroma: 0,    midBias: 0.45, fps: 30 },   // = ANVE kit grain
  'digital-soft': { amount: 0.035, sizePx: 1.2, chroma: 0.10, midBias: 0.40, fps: 30 },
  film35:         { amount: 0.070, sizePx: 1.4, chroma: 0.35, midBias: 0.55, fps: 24 },
  film16:         { amount: 0.110, sizePx: 1.8, chroma: 0.45, midBias: 0.60, fps: 24 },
  super8:         { amount: 0.160, sizePx: 2.4, chroma: 0.55, midBias: 0.65, fps: 18 },
  vhs:            { amount: 0.090, sizePx: 1.6, chroma: 0.80, midBias: 0.30, fps: 30 },
  /* platform re-encodes smear 1 px grain: use for uploads of a "clean" look (x1.5 amount, >= 1.4 px) */
  'upload-safe':  { amount: 0.030, sizePx: 1.5, chroma: 0,    midBias: 0.45, fps: 30 },
};
