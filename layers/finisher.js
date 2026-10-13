/* motion-pack / layers / finisher.js: the full finishing stack for ANY plate (3D kit canvas, video, still), WebGL2, deterministic from (t, frame).
   Stack (bottom -> top): F1 weave/flicker/lens/glitch/VHS tracking, F2 chroma, F3 bloom, F4 halation, F5 diffusion, F6 leaks (+bokeh/glow), F7 grade,
   paper, F8 vignette, scan/CRT mask, T1 story type, F10 dust, F11 grain, brand, F12 bars, F13 dither.
   One of each: if the plate already bakes bloom / vignette / grain (the ANVE studio kit does) set preset.plate.baked and the stage is skipped (lintStack warns otherwise).
   usage:  const fin = new Finisher(canvas, 'warm-film', {width:1920, height:1080, fps:30});  fin.setSource(plateCanvas);  fin.render(t, {hits:[...]});  */
import { getGL, Prog, makeRT, makeTex, bindTex, draw, mulberry32 } from './lib/gl.js';
import { VERT } from './lib/glsl-common.js';
import { FRAG_PRE, FRAG_DOWN, FRAG_UP, FRAG_COMPOSITE } from './lib/glsl-passes.js';
import { gradeUniforms } from './grade.js';
import { GRADES } from './presets/grades.js';
import { FINISH_PRESETS } from './presets/finish.js';
import { STOCKS } from './presets/stocks.js';
import { env, windowEnv, sines, clamp } from './ease.js';
import { hexRGB, dec, pad, leakParams, leakIntensity } from './lib/fx-params.js';

export const FINISH_DEFAULTS = {
  name: 'none', seed: 1,
  plate: { baked: { bloom: false, vignette: false, grain: false } },
  lens: { k1: 0, k2: 0 }, chroma: { cornerPx: 0, hitPx: 0 }, glitch: { on: false },
  bloom: { amount: 0, threshold: 0.85, knee: 0.15, levels: 5, tint: [1, 1, 1] },
  halation: { amount: 0, threshold: 0.82, knee: 0.1, tint: [1.0, 0.30, 0.10], core: 0, levels: 5 },
  diffusion: { amount: 0, lift: 0 },
  sharpen: { amount: 0, px: 0.8 },
  leaks: { on: false, seed: 7, count: 3, colors: ['#FF6A1A', '#FFB347', '#E8336D'], edge: 'any', intensity: 0.6, envelope: { start: 0, in: 0.5, hold: 1.0, out: 1.0 }, loop: false, flashes: [] },
  bokeh: { on: false, count: 18, radius: [0.02, 0.09], intensity: 0.5, soft: 0.25, hex: 0, drift: 0.04, colors: ['#FFD9A0', '#FFB070', '#9FD0FF'] },
  glow: { on: false, pools: [] },
  grade: 'neutral',
  paper: { amount: 0, scale: 1, fiber: 1, angle: 0.4, tint: [0.97, 0.94, 0.86] },
  vignette: { amount: 0, inner: 0.35, outer: 1.414, roundness: 0.6, color: [0, 0, 0] },
  retro: { scanPitch: 3, scanDepth: 0, mask: 0, vhsChroma: 0, vhsLift: 0, vhsSat: 1, vhsTrack: 0, vhsHead: 0 },
  weave: { on: false, amountPct: 0.15, scale: 1.012 }, flicker: { amount: 0 },
  dust: { density: 0, hair: 0, scratch: 0 },
  grain: { stock: 'none', amount: null, sizePx: null, chroma: null, midBias: null, fps: null, protect: 1 },
  bars: { ratio: 0, reveal: null },
  dither: true,
};
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function deepMerge(a, b) { const o = { ...a }; for (const k in b) o[k] = isObj(b[k]) && isObj(a[k]) ? deepMerge(a[k], b[k]) : b[k]; return o; }
export function resolvePreset(p) { const base = typeof p === 'string' ? FINISH_PRESETS[p] : p; if (!base) throw new Error('unknown finish preset ' + p); return deepMerge(FINISH_DEFAULTS, base); }

export class Finisher {
  constructor(canvas, preset = 'none-clean', { width = 1920, height = 1080, fps = 30 } = {}) {
    this.canvas = canvas; this.W = canvas.width = width; this.H = canvas.height = height; this.fps = fps;
    const gl = this.gl = getGL(canvas);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info'); this.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    this.progs = { pre: new Prog(gl, VERT, FRAG_PRE, 'pre'), down: new Prog(gl, VERT, FRAG_DOWN, 'down'), up: new Prog(gl, VERT, FRAG_UP, 'up'), comp: new Prog(gl, VERT, FRAG_COMPOSITE, 'composite') };
    gl.bindVertexArray(gl.createVertexArray());
    this.base = makeRT(gl, width, height); this.pyr = {};
    this.src = makeTex(gl, 1, 1, { float: false }); this.typeTex = makeTex(gl, 1, 1, { float: false }); this.brandTex = makeTex(gl, 1, 1, { float: false }); this.black = makeTex(gl, 1, 1, { float: false });
    this._srcSRGB = null; this.hasType = 0; this.hasBrand = 0; this.setPreset(preset);
  }
  setPreset(p) { this.cfg = resolvePreset(p); return this; }
  _uploadSRGB(tex, el, premult = false) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult);
    gl.texImage2D(gl.TEXTURE_2D, 0, premult ? gl.RGBA8 : gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  setSource(el) { this.source = el; return this; }
  setType(el) { this.typeEl = el; this.hasType = el ? 1 : 0; return this; }       // premultiplied RGBA canvas: story type / captions (above grade, below dust+grain)
  setBrand(el) { this.brandEl = el; this.hasBrand = el ? 1 : 0; return this; }   // premultiplied RGBA canvas: exact-colour logo / CTA (above grain)
  _pyramid(name, input, thr, levels, weights) {
    const gl = this.gl, P = this.progs; let pyr = this.pyr[name];
    if (!pyr || pyr.levels !== levels) { pyr = this.pyr[name] = { levels, down: [], up: [] }; let w = this.W, h = this.H; for (let i = 0; i < levels; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); pyr.down.push(makeRT(gl, w, h)); pyr.up.push(makeRT(gl, w, h)); } }
    let src = input, sw = this.W, sh = this.H;
    P.down.use(); gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < levels; i++) { P.down.set('uTex', 0).set('uPx', [1 / sw, 1 / sh]).set('uThr', i === 0 && thr ? [thr.threshold, thr.knee, 1] : [0, 0.1, 0]); bindTex(gl, 0, src); draw(gl, pyr.down[i]); src = pyr.down[i].tex; sw = pyr.down[i].w; sh = pyr.down[i].h; }
    P.up.use(); let low = pyr.down[levels - 1].tex, lw = pyr.down[levels - 1].w, lh = pyr.down[levels - 1].h;
    for (let i = levels - 2; i >= 0; i--) { P.up.set('uLow', 0).set('uHigh', 1).set('uPx', [1 / lw, 1 / lh]).set('uWHigh', weights[i]).set('uWLow', i === levels - 2 ? weights[levels - 1] : 1); bindTex(gl, 0, low); bindTex(gl, 1, pyr.down[i].tex); draw(gl, pyr.up[i]); low = pyr.up[i].tex; lw = pyr.up[i].w; lh = pyr.up[i].h; }
    return low;
  }
  /* t seconds, opts: {frame, hits:[s], glitch:[s], cuts:[s]} -> draws into the canvas. Everything below is a pure function of (t, frame, preset). */
  render(t, opts = {}) {
    const gl = this.gl, c = this.cfg, W = this.W, H = this.H, fps = this.fps, frame = opts.frame ?? Math.round(t * fps), P = this.progs, PX = H / 1080, A = W / H;
    const g = (this.gUni && this.gKey === JSON.stringify(c.grade)) ? this.gUni : (this.gKey = JSON.stringify(c.grade), this.gUni = gradeUniforms(typeof c.grade === 'string' ? GRADES[c.grade] : c.grade));
    const common = { uRes: [W, H], uAspect: A, uPX: PX, uFrame: frame, uTime: t, uFps: fps, uSeed: c.seed >>> 0 };
    /* ---- dynamic envelopes (all closed form) ---- */
    const hit = env(t, opts.hits, { attack: 1 / fps, decay: 8 / fps }), glitchE = c.glitch.on ? env(t, opts.glitch || opts.hits, { attack: 0.5 / fps, decay: 6 / fps }) : 0;
    let wv = [0, 0], ws = 1, ex = 1;
    if (c.weave.on) { const nx = sines(c.seed + 1, [1.1, 2.3, 2.9], [1, 0.6, 0.3]), ny = sines(c.seed + 2, [1.3, 1.9, 2.7], [1, 0.6, 0.3]), jr = mulberry32(frame * 2654435761 + c.seed); wv = [c.weave.amountPct / 100 * nx(t) + (jr() - 0.5) / W, c.weave.amountPct / 100 * A * ny(t) * 0.6 + (jr() - 0.5) / H]; ws = c.weave.scale; }
    if (c.flicker.amount) ex = 1 + c.flicker.amount * sines(c.seed + 3, [3.7, 7.9, 11.3], [1, 0.7, 0.4])(t);
    const r = c.retro, vhsOn = r.vhsChroma > 0 || r.vhsTrack > 0 || r.vhsHead > 0;
    const trackOn = r.vhsTrack > 0 && mulberry32(Math.floor(frame / 12) * 7919 + c.seed)() < 0.05 * 6;      // ~5% of frames, held 12 frames
    /* ---- source ---- */
    if (this.source) this._uploadSRGB(this.src, this.source);
    if (this.typeEl) this._uploadSRGB(this.typeTex, this.typeEl, true);
    if (this.brandEl) this._uploadSRGB(this.brandTex, this.brandEl, true);
    gl.disable(gl.BLEND);
    /* ---- pre ---- */
    P.pre.use().setAll(common).setAll({ uSrc: 0, uK1: c.lens.k1, uK2: c.lens.k2, uCAcorner: c.chroma.cornerPx * PX, uCAhit: c.chroma.hitPx * PX * hit, uExpo: ex, uWeaveScale: ws, uWeave: wv, uGlitch: glitchE,
      uVhsChroma: r.vhsChroma, uVhsTrackY: ((t * 40 * PX / H) % 1), uVhsTrackH: 18 * PX / H, uVhsTrackAmt: trackOn ? r.vhsTrack * 30 : 0, uVhsHead: r.vhsHead * 20 });
    bindTex(gl, 0, this.src); draw(gl, this.base);
    /* ---- pyramids ---- */
    const bake = c.plate.baked, bOn = c.bloom.amount > 0 && !bake.bloom, hOn = c.halation.amount > 0, dOn = c.diffusion.amount > 0;
    const wB = (L) => Array.from({ length: L }, (_, i) => 1 / (1 + i * 0.35)), wH = (L) => Array.from({ length: L }, (_, i) => (i < 1 ? 0.2 : 0.6 + i * 0.4)), wD = (L) => Array.from({ length: L }, () => 1);
    const bloomT = bOn ? this._pyramid('bloom', this.base.tex, { threshold: c.bloom.threshold, knee: c.bloom.knee }, c.bloom.levels, wB(c.bloom.levels)) : this.black;
    const halaT = hOn ? this._pyramid('hala', this.base.tex, { threshold: c.halation.threshold, knee: c.halation.knee }, c.halation.levels, wH(c.halation.levels)) : this.black;
    const diffT = dOn ? this._pyramid('diff', this.base.tex, null, 5, wD(5)) : this.black;
    /* ---- leaks / bokeh / glow ---- */
    const lk = c.leaks, leakI = leakIntensity(lk, t, fps, opts.cuts);
    const lp = lk.on ? (this._lp && this._lpKey === JSON.stringify([lk.seed, lk.count, lk.colors, lk.edge, A]) ? this._lp : (this._lpKey = JSON.stringify([lk.seed, lk.count, lk.colors, lk.edge, A]), this._lp = leakParams(lk, A))) : { n: 0, P: new Array(20).fill(0), M: new Array(20).fill(0), C: new Array(15).fill(0) };
    const bk = c.bokeh, bcol = bk.colors.map((h) => hexRGB(h).map((v) => dec(v) ** 0.7)), gl3 = c.glow.pools || [];
    /* ---- composite ---- */
    const gr = c.grain, st = STOCKS[gr.stock] || STOCKS.clean, gAmt = gr.amount ?? st.amount, gFps = gr.fps ?? st.fps;
    const grainOn = !bake.grain && (gAmt > 0);
    P.comp.use().setAll(common).setAll(g).setAll({ uBase: 0, uBloom: 1, uHala: 2, uDiff: 3, uType: 4, uBrand: 5,
      uBloomAmt: bOn ? c.bloom.amount : 0, uBloomTint: c.bloom.tint, uHalaAmt: hOn ? c.halation.amount : 0, uHalaTint: c.halation.tint, uHalaCore: hOn ? c.halation.core : 0,
      uDiffAmt: dOn ? c.diffusion.amount : 0, uDiffLift: c.diffusion.lift, uSharpAmt: c.sharpen.amount, uSharpPx: c.sharpen.px,
      uLeakOn: lk.on ? 1 : 0, uLeakN: lp.n, uLeakP: lp.P, uLeakM: lp.M, uLeakC: lp.C, uLeakI: leakI,
      uBokOn: bk.on ? 1 : 0, uBokN: Math.min(32, bk.count), uBokR: bk.radius, uBokI: bk.intensity, uBokSoft: bk.soft, uBokHex: bk.hex, uBokDrift: bk.drift, uBokC0: bcol[0] || [1, 1, 1], uBokC1: bcol[1] || bcol[0] || [1, 1, 1], uBokC2: bcol[2] || bcol[0] || [1, 1, 1],
      uGlowOn: gl3.length ? 1 : 0, uGlowN: Math.min(3, gl3.length), uGlowP: pad(gl3.map((p) => [p.x, p.y, p.r, p.intensity ?? 1]).flat(), 12), uGlowC: pad(gl3.map((p) => hexRGB(p.color).map((v) => dec(v))).flat(), 9),
      uPaperAmt: c.paper.amount, uPaperScale: c.paper.scale, uPaperFiber: c.paper.fiber, uPaperAngle: c.paper.angle, uPaperTint: c.paper.tint,
      uVigAmt: bake.vignette ? 0 : c.vignette.amount, uVigIn: c.vignette.inner, uVigOut: c.vignette.outer, uVigRound: c.vignette.roundness, uVigColor: c.vignette.color,
      uScanPitch: r.scanPitch, uScanDepth: r.scanDepth, uMaskAmt: r.mask, uVhsLift: r.vhsLift, uVhsSat: r.vhsSat,
      uDustDen: c.dust.density, uDustHair: c.dust.hair, uDustScr: c.dust.scratch,
      uGrainAmt: grainOn ? gAmt : 0, uGrainSize: gr.sizePx ?? st.sizePx, uGrainChroma: gr.chroma ?? st.chroma, uGrainMid: gr.midBias ?? st.midBias, uGrainProtect: gr.protect, uGrainFrame: Math.floor(frame * gFps / fps + 1e-6),
      uBarsRatio: c.bars.ratio, uBarsK: c.bars.ratio ? (c.bars.reveal ? windowEnv(t, c.bars.reveal.at, c.bars.reveal.dur, 1e9, 1) : 1) : 0,
      uHasType: this.hasType, uHasBrand: this.hasBrand, uDither: c.dither ? 1 : 0 });
    bindTex(gl, 0, this.base.tex); bindTex(gl, 1, bloomT); bindTex(gl, 2, halaT); bindTex(gl, 3, diffT); bindTex(gl, 4, this.hasType ? this.typeTex : this.black); bindTex(gl, 5, this.hasBrand ? this.brandTex : this.black);
    draw(gl, null, W, H);
    return this;
  }
  /* RGBA8, top row first (GL reads bottom-up, flipped here) */
  readRGBA() { const gl = this.gl, W = this.W, H = this.H, b = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); const o = new Uint8Array(W * H * 4), row = W * 4; for (let y = 0; y < H; y++) o.set(b.subarray((H - 1 - y) * row, (H - y) * row), y * row); return o; }
  hash() { const b = this.readRGBA(); let h = 0x811c9dc5; for (let i = 0; i < b.length; i += 3) { h ^= b[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
  dispose() { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}
/* "one of each" lint over a list of layer ids / finisher presets: warns on duplicate or baked-and-doubled stages */
export function lintStack(cfg, extra = {}) {
  const raw = (typeof cfg === 'string' ? FINISH_PRESETS[cfg] : cfg) || {}, c = resolvePreset(cfg), w = [], stock = (c.grain.amount ?? (STOCKS[c.grain.stock] || {}).amount) || 0;
  if (c.plate.baked.bloom && raw.bloom && raw.bloom.amount > 0) w.push('bloom: plate already bakes bloom (preset bloom.amount ignored)');
  if (c.plate.baked.vignette && raw.vignette && raw.vignette.amount > 0) w.push('vignette: plate already bakes a vignette (ignored)');
  if (c.plate.baked.grain && raw.grain && (raw.grain.amount > 0 || (raw.grain.stock && raw.grain.stock !== 'none'))) w.push('grain: plate already bakes grain (ignored)');
  if (extra.overlayGrain && stock > 0) w.push('grain: both Finisher grain and an overlay grain layer: use one');
  if (extra.overlayVignette && c.vignette.amount > 0) w.push('vignette: both Finisher vignette and an overlay vignette layer: use one');
  if (extra.overlayBloom && c.bloom.amount > 0) w.push('bloom: both Finisher bloom and an overlay bloom: use one');
  if (c.dither === false && stock === 0) w.push('dither: off and no grain; expect banding in smooth gradients');
  return w;
}
