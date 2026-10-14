/* TEMPLATE demo-r3-type: a brand-system tour (16:9, 17.5 s) built from the round-3 type + layout parts (2026-10-14), as a working example of each.
   Pattern: storyboard shape E from the round-3 study (construction grid -> mark -> palette -> type specimen -> mark in use -> lockup), opened by a sentence-led hook
   (selection box, accent swap). Craft only: nothing from a reference is copied. Hard cuts on the 120 BPM grid (15 f per beat), one sound per action from gfxCues(),
   a lockup end card that settles and holds. Copy is neutral; the only number on screen (17 new parts) is counted from type/gfx/index.js and carries its source.
   The mark is the pack's own spark (media.js DEFAULT_MARK); the plate, passer-by and swatches are owned procedural art. */
import { beatGrid, sequence, PLATFORMS, SIZES } from '../_shared/plan.mjs';
import { gfxCues } from '../../type/gfx/index.js';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  fps: 30, bpm: 120, platform: 'x.video', music: 'music/bed_deep_house_loop8',
  paper: '#F3F1EC', ink: '#0E0E14', brand: '#4A18ED',
  scenes: [   // beats (0.5 s each); part = a type/<name> id (through the type adapter) or a gfx id (mountGfx); params are the part's own
    { id: 'select', beats: 4, part: 'callout.selectionBox', params: { text: 'Start with one line', texts: [[1.05, 'then make it move']], size: 96, draw: 0.35, handlesAt: 0.2, cursorAt: 0.75, bezier: true } },
    { id: 'swap', beats: 4, part: 'type/accentSwap', params: { prefix: 'Parts you can', words: ['design', 'edit', 'ship'], steps: [[0, 0], [0.5, 1], [1.0, 2]], size: 108 } },
    { id: 'mark', beats: 4, part: 'layout.logoConstruction', bg: 'ink', params: { grid: 0.45, shapeAt: 0.3, morphAt: 0.6, morph: 0.6, guidesOutAt: 1.25, fillAt: 1.3 } },
    { id: 'palette', beats: 4, part: 'layout.paletteColumns', params: { stretchAt: 1.1, stretch: 0.45, stagger: 0.06 } },
    { id: 'specimen', beats: 4, part: 'layout.typeSpecimen', params: { text: 'Manrope', start: 0.2, every: 0.16, collapseAt: 1.3, collapse: 0.45, size: 92 } },
    { id: 'split', beats: 3, part: 'type/wordSplitMedia', params: { word: 'introducing', split: 5, openAt: 0.2, open: 0.45, closeAt: null, size: 150 } },
    { id: 'billboard', beats: 4, part: 'layout.mockupInContext', params: { scene: 'billboard', walkerAt: 0.35, walkSpeed: 0.45, inner: { id: 'layout.backdropSwap', params: { text: 'wordmark', every: 0.5, size: 150 } } } },
    { id: 'count', beats: 3, part: 'counter.stepPill', params: { steps: [[0, 6], [0.5, 11], [1.0, 17]], suffix: '', phrase: 'new parts this round', size: 84, source: 'motion-pack round 3: 11 type + 6 layout ids' } },
    { id: 'end', beats: 5, part: 'layout.backdropSwap', hold: true, params: { text: 'motion-pack', loop: false, every: 0.35, size: 130, backs: [{ kind: 'grid', bg: '#F3F1EC' }, { kind: 'solid', bg: '#0E0E14' }, { kind: 'solid', bg: '#4A18ED' }] } },
  ],
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
  logo: 'sfx/logo/two_note',
};
/* ============================================================================== */

export function buildPlan(C) {
  const G = beatGrid(C.bpm, C.fps, 60), spb = G.beatSec;
  const { shots, seconds } = sequence(C.scenes.map((s) => ({ id: s.id, part: s.part, params: s.params, bg: s.bg || 'paper', hold: !!s.hold, dur: s.beats * spb, tx: 'transitions/cut' })), C.fps);
  const cues = [], gid = (part) => part.replace(/^type\//, 'type.');
  for (const s of shots) {
    for (const c of gfxCues(gid(s.part), { at: s.start, params: s.params, dur: s.dur })) if (c.t < s.start + s.dur - 0.05) cues.push({ id: c.id, t: c.t, gainDb: 0, why: `${s.id}: ${c.why}` });
    const inner = s.params.inner; if (inner) for (const c of gfxCues(inner.id, { at: s.start + (inner.at ?? 0), params: inner.params, dur: s.dur })) if (c.t < s.start + s.dur - 0.05) cues.push({ id: c.id, t: c.t, gainDb: -3, why: `${s.id} screen: ${c.why}` });
  }
  const end = shots.find((s) => s.id === 'end'), ep = end.params; cues.push({ id: C.logo, t: +(end.start + ep.every * (ep.backs.length - 1)).toFixed(4), gainDb: 0, why: 'lockup settles on the brand colour' });
  // one sound per moment: drop a cue that lands within 2 frames of an earlier kept cue
  cues.sort((a, b) => a.t - b.t); const kept = []; for (const c of cues) if (!kept.length || c.t - kept.at(-1).t > 2 / C.fps) kept.push({ ...c, t: +c.t.toFixed(6) });
  const Pl = PLATFORMS[C.platform];
  return { template: 'demo-r3-type', fps: C.fps, seconds, music: C.music, size: SIZES[Pl.aspect], bpm: G.bpm, beatSec: spb, shots, cues: kept,
    claims: [{ text: '17 new parts this round', source: 'type/gfx/index.js: 11 type ids (swap.js, badges.js) + 6 layout ids (brand.js), this commit' }], ceilingDb: -2.0, fadeInMs: 40, paceRule: { aslMax: 2.5, longMax: 3.1 } };
}
