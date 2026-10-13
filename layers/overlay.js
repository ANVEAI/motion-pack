/* motion-pack / layers / overlay.js: procedural finishing layers as transparent WebGL canvases for HyperFrames DOM compositions (and any HTML page).
   One layer = one <canvas> with a CSS mix-blend-mode. Pure function of (t, frame): seek-safe. No source texture needed.
     stack = mountStack(rootEl, [{kind:'leaks', params:{...}}, {kind:'vignette'}, {kind:'grain', params:{stock:'film35'}}], {width:1920, height:1080, fps:30, seed:3});
     bindHF(stack)                      // renders on every 'hf-seek' (HyperFrames three adapter contract) and once at load
     stack.render(t, {frame})           // or drive it yourself
   Blend contract (what makes the overlay equal the Finisher as closely as DOM allows):
     grain     overlay        (mid-grey canvas; behaves like midBias 1: quiet in shadows and highlights; for exact kit grain use the Finisher)
     vignette  normal         (colour with alpha)               leaks / bokeh / glow  screen (gamma-space screen: intensities already compensated ~25% lower)
     dust      normal         (marks with alpha)                paper   multiply        scanlines / bars  normal (black with alpha)
   Stacking order (bottom -> top) follows the pack rule: leaks/bokeh/glow, [grade via SVG filter on the plate wrapper], paper, vignette, scanlines, [story type], dust, grain, [brand], bars.
   Dither and the lens-physical effects (bloom of the plate, halation, chromatic aberration, lens) need the plate pixels: use Finisher.                                               */
import { getGL, Prog, draw } from './lib/gl.js';
import { VERT } from './lib/glsl-common.js';
import { FRAG_OVERLAY } from './lib/glsl-passes.js';
import { STOCKS } from './presets/stocks.js';
import { deepMerge, FINISH_DEFAULTS } from './finisher.js';
import { windowEnv } from './ease.js';
import { hexRGB, dec, pad, leakParams, leakIntensity } from './lib/fx-params.js';
import { Fx2Layer, FX2_KINDS } from './fx2.js';
import { Canvas2DLayer, K2D } from './canvas2d.js';
/* every mountable kind: the 9 core kinds below + fx2.js (GL procedural) + canvas2d.js (particles, HUD frames, audio-reactive) */
export const ALL_KINDS = () => ({ ...KINDS, ...FX2_KINDS, ...K2D });
const makeLayer = (c, kind, params, o) => (KINDS[kind] ? new OverlayLayer(c, kind, params, o) : FX2_KINDS[kind] ? new Fx2Layer(c, kind, params, o) : K2D[kind] ? new Canvas2DLayer(c, kind, params, o) : (() => { throw new Error('unknown overlay kind ' + kind); })());

export const KINDS = {
  grain:     { id: 0, blend: 'overlay',  order: 70, tags: ['grain', 'film', 'texture'] },
  vignette:  { id: 1, blend: 'normal',   order: 40, tags: ['vignette', 'lens', 'focus'] },
  leaks:     { id: 2, blend: 'screen',   order: 10, tags: ['light-leak', 'film', 'warm', 'transition'] },
  dust:      { id: 3, blend: 'normal',   order: 60, tags: ['dust', 'scratch', 'hair', 'film', 'nostalgia'] },
  bokeh:     { id: 4, blend: 'screen',   order: 11, tags: ['bokeh', 'lights', 'depth', 'premium'] },
  glow:      { id: 5, blend: 'screen',   order: 12, tags: ['glow', 'rim', 'light'] },
  paper:     { id: 6, blend: 'multiply', order: 30, tags: ['paper', 'texture', 'print', 'nostalgia'] },
  scanlines: { id: 7, blend: 'normal',   order: 50, tags: ['scanlines', 'crt', 'retro', 'vhs'] },
  bars:      { id: 8, blend: 'normal',   order: 90, tags: ['letterbox', 'cinema', 'bars'] },
};
const D = FINISH_DEFAULTS;
export class OverlayLayer {
  constructor(canvas, kind, params = {}, { width = 1920, height = 1080, fps = 30, seed = 1 } = {}) {
    if (!KINDS[kind]) throw new Error('unknown overlay kind ' + kind);
    this.kind = kind; this.canvas = canvas; this.W = canvas.width = width; this.H = canvas.height = height; this.fps = fps; this.seed = seed;
    const gl = this.gl = getGL(canvas, { alpha: true, premultipliedAlpha: true });
    this.prog = new Prog(gl, VERT, FRAG_OVERLAY, 'overlay'); gl.bindVertexArray(gl.createVertexArray()); this.setParams(params);
    canvas.style.mixBlendMode = KINDS[kind].blend; canvas.dataset.mpKind = kind;
  }
  setParams(p) {
    const k = this.kind, o = this.p = { ...p };
    if (k === 'grain') this.p = { stock: 'film35', ...p };
    else if (k === 'vignette') this.p = deepMerge(D.vignette, { amount: 0.2, ...p });
    else if (k === 'leaks') this.p = deepMerge(D.leaks, { on: true, ...p });
    else if (k === 'dust') this.p = { density: 0.6, hair: 1, scratch: 0.7, under: 0.35, ...p };
    else if (k === 'bokeh') this.p = deepMerge(D.bokeh, { on: true, ...p });
    else if (k === 'glow') this.p = { pools: [{ x: 0.1, y: 0.9, r: 0.45, color: '#FF9A3C', intensity: 0.5 }], ...p };
    else if (k === 'paper') this.p = deepMerge(D.paper, { amount: 0.5, ...p });
    else if (k === 'scanlines') this.p = { pitch: 3, depth: 0.18, mask: 0, ...p };
    else if (k === 'bars') this.p = { ratio: 2.39, reveal: null, ...p };
    return this;
  }
  render(t, { frame, cuts = [] } = {}) {
    const gl = this.gl, W = this.W, H = this.H, n = frame ?? Math.round(t * this.fps), P = this.prog.use(), p = this.p, k = this.kind, A = W / H;
    P.setAll({ uRes: [W, H], uAspect: A, uPX: H / 1080, uFrame: n, uTime: t, uFps: this.fps, uSeed: (p.seed ?? this.seed) >>> 0, uKind: KINDS[k].id, uUnder: p.under ?? 0.35 });
    if (k === 'grain') { const st = STOCKS[p.stock] || STOCKS.clean, fps = p.fps ?? st.fps; P.setAll({ uGrainAmt: p.amount ?? st.amount, uGrainSize: p.sizePx ?? st.sizePx, uGrainChroma: p.chroma ?? st.chroma, uGrainMid: 1, uGrainProtect: 0, uGrainFrame: Math.floor(n * fps / this.fps + 1e-6) }); }
    if (k === 'vignette') P.setAll({ uVigAmt: p.amount, uVigIn: p.inner, uVigOut: p.outer, uVigRound: p.roundness, uVigColor: p.color });
    if (k === 'leaks') { const lp = leakParams(p, A); P.setAll({ uLeakN: lp.n, uLeakP: lp.P, uLeakM: lp.M, uLeakC: lp.C, uLeakI: leakIntensity(p, t, this.fps, cuts) * 0.78 }); }
    if (k === 'dust') P.setAll({ uDustDen: p.density, uDustHair: p.hair, uDustScr: p.scratch });
    if (k === 'bokeh') { const c = p.colors.map((h) => hexRGB(h).map((v) => dec(v) ** 0.7)); P.setAll({ uBokN: Math.min(32, p.count), uBokR: p.radius, uBokI: p.intensity * 0.8, uBokSoft: p.soft, uBokHex: p.hex, uBokDrift: p.drift, uBokC0: c[0], uBokC1: c[1] || c[0], uBokC2: c[2] || c[0] }); }
    if (k === 'glow') { const g3 = p.pools; P.setAll({ uGlowN: Math.min(3, g3.length), uGlowP: pad(g3.map((q) => [q.x, q.y, q.r, (q.intensity ?? 1) * 0.8]).flat(), 12), uGlowC: pad(g3.map((q) => hexRGB(q.color).map(dec)).flat(), 9) }); }
    if (k === 'paper') P.setAll({ uPaperAmt: p.amount, uPaperScale: p.scale, uPaperFiber: p.fiber, uPaperAngle: p.angle, uPaperTint: p.tint });
    if (k === 'scanlines') P.setAll({ uScanPitch: p.pitch, uScanDepth: p.depth, uMaskAmt: p.mask });
    if (k === 'bars') P.setAll({ uBarsRatio: p.ratio, uBarsK: p.reveal ? windowEnv(t, p.reveal.at, p.reveal.dur, 1e9, 1) : 1 });
    gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); draw(gl, null, W, H); return this;
  }
}
export function mountStack(root, layers, { width = 1920, height = 1080, fps = 30, seed = 1 } = {}) {
  const AK = ALL_KINDS(), items = layers.map((l, i) => ({ ...l, order: l.order ?? (AK[l.kind] || { order: 50 }).order + i * 0.001 })).sort((a, b) => a.order - b.order), out = [];
  for (const l of items) {
    const c = document.createElement('canvas'); c.className = 'mp-layer'; Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    if (l.blend) c.style.mixBlendMode = l.blend; if (l.opacity != null) c.style.opacity = String(l.opacity);
    root.appendChild(c); const layer = makeLayer(c, l.kind, l.params || {}, { width, height, fps, seed: (l.params && l.params.seed) ?? seed }); if (l.blend) c.style.mixBlendMode = l.blend; out.push(layer);
  }
  return { layers: out, render(t, o = {}) { for (const L of out) L.render(t, o); return this; }, dispose() { for (const L of out) { L.canvas.remove(); L.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } } };
}
/* lint a layer list: one of each (grain, vignette, paper, scanlines, bars), warn when a plate bakes the same thing (plateBaked: {grain, vignette, bloom}) */
export function lintOverlayStack(layers, { plateBaked = {} } = {}) {
  const w = [], count = {}; for (const l of layers) count[l.kind] = (count[l.kind] || 0) + 1;
  for (const k of ['grain', 'vignette', 'paper', 'scanlines', 'bars']) if (count[k] > 1) w.push(`${k}: ${count[k]} layers (one of each)`);
  if (plateBaked.grain && count.grain) w.push('grain: the plate already bakes grain'); if (plateBaked.vignette && count.vignette) w.push('vignette: the plate already bakes a vignette');
  if (count.dust && count.paper && layers.findIndex((l) => l.kind === 'dust') < layers.findIndex((l) => l.kind === 'paper') && layers.every((l) => l.order == null)) { /* order is fixed by KINDS.order: nothing to warn */ }
  return w;
}
/* HyperFrames: re-render on every seek (the documented hf-seek / __hfThreeTime contract). t0 = the clip's data-start if the stack lives inside a timed clip. */
export function bindHF(stack, { t0 = 0, fps = 30 } = {}) {
  const f = (t) => stack.render(t - t0, { frame: Math.round((t - t0) * fps) });
  window.addEventListener('hf-seek', (e) => f(e.detail.time)); f(window.__hfThreeTime || 0); return f;
}
