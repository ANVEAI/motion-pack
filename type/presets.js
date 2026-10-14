/* motion-pack / type / presets.js: kinetic typography as PURE functions of time. No DOM, no canvas, no clock: state = f(preset, params, unit index, t).
   A preset animates "units" (word | char | line | block). For unit i of n at time t (seconds, from the spec's `at`):
       enter progress  p = seg(t - at - delay_i, 0, dur),  e = ease(p)            -> enter(e)
       exit  progress  q = seg(t - out - delayOut_i, 0, dur * 0.7),  eo = E.exit(q) -> exit(eo)       (exits are 30% faster than entrances and accelerate)
   and the result is a unit state { x, y (em), scale, rot, rotX (deg), opacity, clip (0..1, left to right), track (em), wght, blur (px @1080), glyph, rgb (px split), shake [px,px],
   fill (0..1 glyph fill opacity, null = solid) , stroke (outline width in em, null = none) }.
   Renderers: type/render-canvas.js (2D canvas, three.js overlay), type/dom.js (DOM spans baked to a GSAP timeline or driven from hf-seek). Same numbers in both.
   Numbers (frames at 30 fps) come from the pack research (visual.md section 4); every preset has tone + tags for the planner.                                                  */
import { E, clamp, lerp, seg, TAU, mulberry32, sines } from './ease.js';

const F = 1 / 30;
export const SHOWN = Object.freeze({ x: 0, y: 0, scale: 1, rot: 0, rotX: 0, opacity: 1, clip: 1, track: 0, wght: null, blur: 0, glyph: null, rgb: 0, shake: [0, 0], fill: null, stroke: null });
export const mergeState = (a) => ({ ...SHOWN, shake: [0, 0], ...a });
/* closed-form damped spring residual (kit util): 1 at tau=0, -> 0, overshoots below 0 when zeta < 1 */
const springU = (tau, zeta, hz) => { if (tau <= 0) return 1; const w = TAU * hz, wd = w * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta)); return Math.exp(-zeta * w * tau) * (Math.cos(wd * tau) + ((zeta * w) / wd) * Math.sin(wd * tau)); };
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/?';

/* each preset: unit, dur (s), stagger (s per unit), ease, mask ('line' clips the unit to its line box), tone (motion-art-direction cell), tags, enter(e,ctx), exit(e,ctx), optional timeOf(i,n,ctx) */
export const PRESETS = {
  maskRise: { unit: 'word', dur: 14 * F, stagger: 4 * F, ease: E.hero, mask: 'line', tone: 'calm-sharp', tags: ['headline', 'premium', 'ad', 'title'],
    enter: (e) => ({ y: 0.6 * (1 - e) }), exit: (e) => ({ y: -0.6 * e }) },
  charRise: { unit: 'char', dur: 12 * F, stagger: 2 * F, ease: E.hero, mask: 'line', tone: 'calm-sharp', tags: ['headline', 'short-title', 'premium'],
    enter: (e) => ({ y: 0.7 * (1 - e) }), exit: (e) => ({ y: -0.7 * e }) },
  wordStagger: { unit: 'word', dur: 16 * F, stagger: 3 * F, ease: E.enter, tone: 'neutral', tags: ['subhead', 'body', 'explainer'],
    enter: (e) => ({ opacity: e, y: 0.25 * (1 - e), blur: 6 * (1 - e) }), exit: (e) => ({ opacity: 1 - e, y: -0.12 * e }) },
  charStagger: { unit: 'char', dur: 12 * F, stagger: 1.5 * F, ease: E.enter, tone: 'kinetic-soft', tags: ['title', 'playful', 'social'],
    enter: (e) => ({ opacity: e, y: 0.3 * (1 - e), scale: 0.92 + 0.08 * e }), exit: (e) => ({ opacity: 1 - e }) },
  blurIn: { unit: 'line', dur: 18 * F, stagger: 5 * F, ease: E.hero, tone: 'calm-soft', tags: ['title', 'cinematic', 'film', 'end-card'],
    enter: (e) => ({ opacity: e, blur: 24 * (1 - e), scale: 1.04 - 0.04 * e }), exit: (e) => ({ opacity: 1 - e, blur: 14 * e }) },
  /* slam: 1.35 -> 1.00 in 6 f, 8 px screen shake decaying over 4 f, motion blur on the first 2 f, one word per beat (stagger = 15 f = 120 BPM). hold >= 9 f. */
  scaleSlam: { unit: 'word', dur: 6 * F, stagger: 15 * F, ease: E.enter, tone: 'kinetic-sharp', tags: ['hype', 'beat', 'hook', 'cta', 'ad'],
    enter: (e, c) => { const ts = c.tIn, k = ts < 0 ? 0 : Math.exp(-ts / (4 * F) * 3), sh = sines(c.i * 7 + 3, [23, 31], [1, 0.7]); return { scale: 1 + 0.35 * (1 - e), opacity: clamp(c.p * 6), blur: c.tIn < 2 * F ? 10 * (1 - c.tIn / (2 * F)) : 0, shake: ts < 0 ? [0, 0] : [8 * k * clamp(sh(ts), -1, 1), 8 * k * clamp(sh(ts + 0.37), -1, 1)] }; },
    exit: (e) => ({ opacity: 1 - e, scale: 1 - 0.08 * e }) },
  /* typewriter: 2 f per char, +6 f pause after . , ? ; caret blinks with a 15 f half period */
  typewriter: { unit: 'char', dur: 1 * F, stagger: 2 * F, ease: E.lin, tone: 'neutral', tags: ['terminal', 'tech', 'ui', 'subhead'], caret: { blink: 15 * F },
    timeOf: (i, chars) => { let t = 0; for (let k = 0; k < i; k++) t += 2 * F + (/[.,?!]/.test(chars[k]) ? 6 * F : 0); return t; },
    enter: (e) => ({ opacity: e >= 1 ? 1 : 0 }), exit: (e) => ({ opacity: 1 - e }) },
  trackingCollapse: { unit: 'line', dur: 20 * F, stagger: 6 * F, ease: E.expoOut, tone: 'calm-soft', tags: ['title-card', 'premium', 'brand', 'end-card'],
    enter: (e) => ({ track: 0.35 * (1 - e), opacity: clamp(e * 1.6) }), exit: (e) => ({ opacity: 1 - e, track: 0.1 * e }) },
  weightMorph: { unit: 'word', dur: 18 * F, stagger: 3 * F, ease: E.hero, tone: 'calm-sharp', tags: ['emphasis', 'variable-font', 'headline'],
    enter: (e) => ({ wght: lerp(300, 800, e), opacity: clamp(e * 3), track: -0.01 * e }), exit: (e) => ({ opacity: 1 - e, wght: lerp(800, 500, e) }) },
  wipe: { unit: 'line', dur: 12 * F, stagger: 4 * F, ease: E.move, tone: 'neutral', tags: ['subhead', 'broadcast', 'explainer'],
    enter: (e) => ({ clip: e }), exit: (e) => ({ clip: 1 - e, x: 0 }) },
  flipSplit: { unit: 'line', dur: 16 * F, stagger: 3 * F, ease: E.enter, tone: 'kinetic-sharp', tags: ['tech', 'hype', 'title'],
    enter: (e) => ({ rotX: -90 * (1 - e), opacity: clamp(e * 4) }), exit: (e) => ({ rotX: 90 * e, opacity: 1 - e }) },
  /* elastic pop: spring 2.6 Hz, zeta 0.38 (~24% overshoot) for playful work; house style = zeta 0.7 (`calm` param) caps overshoot near 7% */
  elasticPop: { unit: 'word', dur: 0.6, stagger: 3 * F, ease: E.lin, tone: 'kinetic-soft', tags: ['playful', 'mime', 'kids', 'social', 'sticker'],
    enter: (e, c) => ({ scale: Math.max(0, 1 - springU(c.tIn, c.params.zeta ?? 0.38, 2.6)), opacity: c.tIn > 0 ? 1 : 0 }), exit: (e) => ({ scale: 1 - e, opacity: 1 - e }) },
  /* scramble: glyph swaps for 8 f, resolving left to right at 1.2 f per char */
  scramble: { unit: 'char', dur: 1 * F, stagger: 0, ease: E.lin, tone: 'techy', tags: ['tech', 'decode', 'cyber', 'hook'],
    timeOf: () => 0,
    enter: (e, c) => { const t = c.tIn, resolve = 8 * F + c.i * 1.2 * F; if (t < 0) return { opacity: 0 }; if (t >= resolve) return { opacity: 1 }; const fr = Math.floor(t / F), r = mulberry32(fr * 131 + c.i * 7919 + 17)(); return { opacity: 1, glyph: GLYPHS[Math.floor(r * GLYPHS.length)] }; },
    exit: (e) => ({ opacity: 1 - e }) },
  /* RGB glitch split on a hit: offset +-8 px, 6 f; trigger with params.hits (seconds); idle otherwise */
  glitchSplit: { unit: 'line', dur: 8 * F, stagger: 0, ease: E.lin, tone: 'deconstructed', tags: ['glitch', 'hype', 'cyber', 'retro'],
    enter: (e, c) => { const h = c.params.hits || [], d = h.map((x) => c.tAbs - x).filter((x) => x >= 0 && x <= 6 * F)[0]; return { opacity: c.p > 0 ? 1 : 0, rgb: d == null ? 0 : 8 * (1 - d / (6 * F)), x: d == null ? 0 : 0.01 * Math.sin(d * 120) }; }, exit: (e) => ({ opacity: 1 - e }) },
  /* outline -> fill (2026-10-14): each unit fades in as an OUTLINE (stroke only, 0.022 em) over 7 f, holds as an outline to f 15, then fills solid
     (f 15 -> 27, E.move) while the stroke thins away (f 24 -> 30), so the settled state is the plain solid glyph. Word by default; spec.unit 'line' for per line.
     params.stroke (em) overrides the outline width. Exit runs it backwards: fill drains, then the outline fades. */
  outlineFill: { unit: 'word', dur: 30 * F, stagger: 5 * F, ease: E.lin, tone: 'calm-sharp', tags: ['headline', 'reveal', 'outline', 'manifesto', 'launch', 'title'], outline: true,
    enter: (e, c) => { const w = c.params.stroke ?? 0.022, o = E.enter(seg(e, 0, 7 / 30)); return { opacity: o, y: 0.06 * (1 - o), fill: E.move(seg(e, 15 / 30, 27 / 30)), stroke: w * (1 - seg(e, 24 / 30, 1)) }; },
    exit: (e, c) => { const w = c.params.stroke ?? 0.022; return { fill: 1 - seg(e, 0, 0.55), stroke: w * seg(e, 0, 0.15), opacity: 1 - seg(e, 0.55, 1) }; } },
};
export const PRESET_IDS = Object.keys(PRESETS);

/* default hold of a single card: max(0.5 s, 0.35 + 0.28 s per word), never fewer than 9 fully formed frames */
export const holdTime = (text) => Math.max(0.5, 0.35 + 0.28 * String(text).trim().split(/\s+/).length, 9 * F);

/* spec: { preset, at, out (seconds, absolute; default at + enterTotal + holdTime), stagger?, dur?, params?:{} }.  unitTexts: array of the unit strings (for timeOf / counts). t absolute seconds.
   returns { states:[unitState...], inDone, outStart, outDone, caret } */
export function unitStates(spec, unitTexts, t) {
  const def = PRESETS[spec.preset]; if (!def) throw new Error('unknown type preset ' + spec.preset);
  const n = unitTexts.length, at = spec.at ?? 0, dur = spec.dur ?? def.dur, st = spec.stagger ?? def.stagger, params = spec.params || {}, ease = spec.ease ? (typeof spec.ease === 'function' ? spec.ease : E[spec.ease]) : def.ease;
  const delays = unitTexts.map((_, i) => (def.timeOf ? def.timeOf(i, unitTexts, { ...spec, def }) : i * st));
  const inDone = at + Math.max(...delays) + dur, text = unitTexts.join(' '), outStart = spec.out ?? (inDone + holdTime(text)), outDur = dur * 0.7, outStag = st * 0.7;
  const states = unitTexts.map((_, i) => {
    const tIn = t - at - delays[i], p = seg(tIn, 0, dur), e = ease(p), q = seg(t - outStart - (spec.outReverse ? n - 1 - i : i) * outStag, 0, outDur), eo = E.exit(q);
    const c = { i, n, p, e, tIn, tAbs: t, params, text: unitTexts[i], spec };
    const m = mergeState((spec.out === null || spec.noExit) ? def.enter(e, c) : (q > 0 ? def.exit(eo, c) : def.enter(e, c)));
    if (q >= 1) m.opacity = 0;
    return m;
  });
  const caret = def.caret ? { blink: def.caret.blink, on: Math.floor((t - at) / def.caret.blink) % 2 === 0 || t - at < 0, upto: states.filter((s) => s.opacity > 0).length, done: t - at > delays[n - 1] + F } : null;
  return { states, inDone, outStart, outDone: outStart + outDur + (n - 1) * outStag, caret };
}
/* lint a text spec: hold >= 9 fully formed frames, words per second <= 3.5, min font sizes, one kinetic style per piece (checked by lintPiece) */
export function lintType(spec, { words, fps = 30 } = {}) {
  const w = words ?? String(spec.text || '').trim().split(/\s+/).length, def = PRESETS[spec.preset], issues = [], dur = spec.dur ?? def.dur, st = spec.stagger ?? def.stagger;
  const units = spec.unitCount ?? w, inDone = (spec.at ?? 0) + (units - 1) * st + dur, hold = (spec.out ?? inDone + holdTime(spec.text || '')) - inDone;
  if (hold < 9 / fps - 1e-9) issues.push(`fully formed hold ${(hold * fps).toFixed(0)} f < 9 f`);
  const total = (spec.out ?? inDone + holdTime(spec.text || '')) - (spec.at ?? 0); if (w / total > 3.5) issues.push(`${(w / total).toFixed(1)} words/s > 3.5`);
  const size = spec.font?.size ?? 124; if (size < 96 && spec.role === 'headline') issues.push(`headline ${size}px < 96px at 1080p`); if (size < 40 && spec.role === 'sub') issues.push(`sub ${size}px < 40px`);
  return issues;
}
export const lintPiece = (specs) => { const styles = new Set(specs.map((s) => PRESETS[s.preset].tone)); return styles.size > 2 ? [`${styles.size} kinetic tone families in one piece (max 2): ${[...styles].join(', ')}`] : []; };
for (const [id, d] of Object.entries(PRESETS)) d.id = id;
