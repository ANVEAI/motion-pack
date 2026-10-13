/* motion-pack / transitions / lib / xfade.js
   ffmpeg finisher path: every built-in mode of ffmpeg's xfade filter (58, checked against `ffmpeg -h filter=xfade`, ffmpeg 8.0.1)
   plus `custom` (expression mode) as pack ids  transitions/xfade-<mode>.
   Each id also names the NEAREST pack transition (key + params), so the same id works in DOM / GL templates.
   xfadeFilter(id, {duration, offset}) -> the filter string for ffmpeg -filter_complex  "[0:v][1:v]xfade=...[v]".
   Pure data + string building; ffmpeg is the renderer. */
const W = (angle, softness = 0.02) => ({ key: 'lumaWipe', params: { matte: 'linear', angle, softness } });
const P = (dir, parallax = 0.15) => ({ key: 'push', params: { dir, parallax } });
const D = (dir) => ({ key: 'directionalWarp', params: { dir } });
const WI = (dir) => ({ key: 'wind', params: { dir } });
const SL = (vertical) => ({ key: 'windowSlice', params: { vertical } });
export const XFADE = {
  custom: { key: 'dissolve', params: {}, doc: 'expression mode: pass expr (uses P, X, Y, W, H, A, B, a0(x,y)...)' },
  fade: { key: 'dissolve', params: {} }, fadefast: { key: 'dissolve', params: {} }, fadeslow: { key: 'dissolve', params: {} }, dissolve: { key: 'dissolve', params: {} },
  distance: { key: 'dissolve', params: {} }, fadegrays: { key: 'dissolve', params: { mode: 'film' } },
  fadeblack: { key: 'dip', params: { color: '#000000' } }, fadewhite: { key: 'dip', params: { color: '#ffffff' } },
  wipeleft: W(180), wiperight: W(0), wipeup: W(-90), wipedown: W(90),
  wipetl: D([-1, -1]), wipetr: D([1, -1]), wipebl: D([-1, 1]), wipebr: D([1, 1]),
  smoothleft: W(180, 0.4), smoothright: W(0, 0.4), smoothup: W(-90, 0.4), smoothdown: W(90, 0.4),
  slideleft: P([1, 0]), slideright: P([-1, 0]), slideup: P([0, 1]), slidedown: P([0, -1]),
  coverleft: P([1, 0], 1), coverright: P([-1, 0], 1), coverup: P([0, 1], 1), coverdown: P([0, -1], 1),
  revealleft: P([1, 0], 0), revealright: P([-1, 0], 0), revealup: P([0, 1], 0), revealdown: P([0, -1], 0),
  circlecrop: { key: 'iris', params: { throughBlack: true } }, rectcrop: { key: 'iris', params: { shape: 'roundRect', throughBlack: true } },
  circleopen: { key: 'iris', params: {} }, circleclose: { key: 'iris', params: { softness: 0.02 } },
  vertopen: { key: 'doorway', params: {} }, horzopen: { key: 'doorway', params: {} }, vertclose: { key: 'iris', params: { shape: 'roundRect' } }, horzclose: { key: 'iris', params: { shape: 'roundRect' } },
  radial: { key: 'radial', params: {} }, pixelize: { key: 'hexagonalize', params: {} }, hblur: { key: 'linearBlur', params: {} }, zoomin: { key: 'zoomThrough', params: {} },
  diagtl: D([-1, -1]), diagtr: D([1, -1]), diagbl: D([-1, 1]), diagbr: D([1, 1]),
  hlslice: SL(false), hrslice: SL(false), vuslice: SL(true), vdslice: SL(true),
  squeezeh: { key: 'squeeze', params: { vertical: true } }, squeezev: { key: 'squeeze', params: {} },
  hlwind: WI([-1, 0]), hrwind: WI([1, 0]), vuwind: WI([0, -1]), vdwind: WI([0, 1]),
};
export const XFADE_MODES = Object.keys(XFADE).filter(m => m !== 'custom');   // 58 built-ins
/* pack key -> best ffmpeg mode for a quick ffmpeg-only finish (proxy edits, server renders) */
export const PACK_TO_XFADE = { dissolve: 'fade', dip: 'fadeblack', lumaWipe: 'wipeleft', iris: 'circleopen', push: 'slideleft', whip: 'slideleft', swipeUp: 'slideup',
  zoomThrough: 'zoomin', radial: 'radial', hexagonalize: 'pixelize', linearBlur: 'hblur', squeeze: 'squeezev', windowSlice: 'hlslice', wind: 'hlwind',
  directionalWarp: 'diagbr', blurCross: 'hblur', flash: 'fadewhite', overexposure: 'fadewhite', doorway: 'horzopen', blinds: 'hlslice', crossWarp: 'smoothleft' };
export const xfadeId = m => ['transitions', 'xfade-' + m].join('/');
/** ffmpeg xfade filter string. id: 'transitions/xfade-<mode>' | '<mode>' | a pack key (mapped via PACK_TO_XFADE). */
export function xfadeFilter(id, { duration = 0.5, offset = 0, expr = null, inA = '0:v', inB = '1:v', out = 'v' } = {}) {
  let m = String(id).replace(/^transitions\//, '').replace(/^xfade-/, '');
  if (!XFADE[m]) m = PACK_TO_XFADE[m]; if (!m) throw new Error(`no xfade mode for ${id}`);
  if (m === 'custom' && !expr) throw new Error('xfade custom needs expr');
  const ex = m === 'custom' ? `:expr='${expr.replace(/'/g, "\\'")}'` : '';
  return `[${inA}][${inB}]xfade=transition=${m}:duration=${(+duration).toFixed(4)}:offset=${(+offset).toFixed(4)}${ex}[${out}]`;
}
