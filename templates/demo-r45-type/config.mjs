/* TEMPLATE demo-r45-type: a "many things -> one place" film (16:9, 20 s) built from the round-4/5 type + layers parts (2026-10-14), as a working example of each.
   Pattern: a vector space (embeddingCloud) -> a phrase riding a curve (textOnPath) -> a network that contracts into one dot (convergeToDot) -> icons that merge into one
   name (iconMergeLockup) -> a sentence that parts around a subject (flankWords) -> text that becomes a picture (asciiMosaic) -> a drawing that gains fidelity
   (epicycleDraw) -> a brand-texture wave (hexMosaic) -> chapter marks 1-2-3 over a figure with labels behind it (electricOutline + behindSubject) -> a partner lockup that holds.
   Craft only: nothing from a reference is copied. Hard cuts on the 120 BPM grid (15 f per beat), one sound per action (gfxCues / cuesR45), a quiet end tail.
   Copy is neutral. The only numbers on screen are the epicycle readout (N circles, mean error), computed from the drawn path and labelled so in frame.
   Every mark, icon, figure and plate is owned procedural art or the pack's own placeholder (Brand A / Brand B); the figure is faceless and its matte is the same
   shape in white (behindSubject takes a SUPPLIED matte; the pack makes none). electricOutline's sound is sfx/tx/glitch_stutter until the electric-arc sound lands. */
import { beatGrid, sequence, PLATFORMS, SIZES } from '../_shared/plan.mjs';
import { gfxCues } from '../../type/gfx/index.js';
import { cuesR45 } from '../../layers/canvas2d-r45.js';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  fps: 30, bpm: 120, platform: 'x.video', music: 'music/bed_tech_pulse_loop8',
  bgs: { paper: '#F3F1EC', white: '#FFFFFF', dark: '#0B1210', warm: '#17120F', navy: '#07121C', ink: '#0E0E14' },
  scenes: [   // beats (0.5 s each); items = gfx ids (mountGfx, { part, at (s, local), dur, params }); layers = Canvas2D kinds mounted through overlay.js mountStack
    { id: 'cloud', beats: 4, bg: 'dark', layers: [{ kind: 'embeddingCloud', params: { query: 'photos from the trip', queryAt: 0.2, queryDur: 0.45, liftDur: 0.4, collapseAt: 0.95, collapse: 0.4, spin: 0.06, radius: 0.68, dot: 3.4, thumbSize: 40 } }] },
    { id: 'path', beats: 3, bg: 'paper', items: [{ part: 'type.textOnPath', params: { text: 'search everything you saved', path: 'swoop', delay: 0.05, travel: 1.05, size: 70 } }] },
    { id: 'many', beats: 4, bg: 'paper', layers: [{ kind: 'convergeToDot', params: { nodes: 36, field: 0.4, at: 0.5, dur: 0.7, stagger: 0.3 } }] },
    { id: 'bundle', beats: 6, bg: 'white', items: [{ part: 'layout.iconMergeLockup', params: { name: 'The Bundle', tile: 230, drawAt: 0, draw: 0.45, stagger: 0.12, hits: [0.75, 0.95, 1.15, 1.35], lineAt: 1.55, line: 0.4, mergeAt: 1.95, merge: 0.55, nameSize: 110, rowScale: 0.7 } }] },
    { id: 'flank', beats: 2, bg: 'paper', items: [{ part: 'type.flankWords', params: { words: ['Made for', 'long days'], split: 1, subject: { box: [0.43, 0.2, 0.14, 0.6], arriveAt: 0, arrive: 0.35 }, size: 110, margin: 54, drawSubject: true, stagger: 0.04 } }] },
    { id: 'ascii', beats: 4, bg: 'warm', items: [{ part: 'type.asciiMosaic', params: { scatterAt: 0.1, scatter: 0.4, settleAt: 0.35, settle: 0.7, spread: 0.4 } }] },
    { id: 'draw', beats: 5, bg: 'navy', layers: [{ kind: 'epicycleDraw', params: { steps: [[0, 4], [0.8, 16], [1.6, 'full']], period: 0.8, width: 3.4, glow: 14, source: 'computed from the path drawn here' } }] },
    { id: 'hex', beats: 2, bg: 'paper', layers: [{ kind: 'hexMosaic', params: { waves: [{ at: 0.05, from: [0, 0.5], speed: 3200 }], flip: 0.25, panel: { rect: [0.3, 0.28, 0.4, 0.44] } } }] },
    { id: 'chapters', beats: 4, bg: 'ink', items: [
      { part: 'type.behindSubject', params: { steps: [[0, 'STILL'], [0.6, 'CLIP'], [1.2, 'SONG']], size: 420, swap: 0.14 } },
      { part: 'type.electricOutline', at: 0.1, dur: 0.35, params: { text: '1', draw: 0.3, size: 360 } }, { part: 'type.electricOutline', at: 0.75, dur: 0.35, params: { text: '2', draw: 0.3, size: 360 } }, { part: 'type.electricOutline', at: 1.4, dur: 0.35, params: { text: '3', draw: 0.3, size: 360 } }] },
    { id: 'end', beats: 6, bg: 'paper', hold: true, items: [{ part: 'title.partnerLockup', params: { labels: ['Brand A', 'Brand B'] } }] },
  ],
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
};
/* ============================================================================== */

export function buildPlan(C) {
  const G = beatGrid(C.bpm, C.fps, 60), spb = G.beatSec;
  const { shots, seconds } = sequence(C.scenes.map((s) => ({ id: s.id, items: s.items || [], layers: s.layers || [], bg: s.bg, hold: !!s.hold, dur: s.beats * spb, tx: 'transitions/cut' })), C.fps);
  const cues = [], keep = (s, c, why, gainDb = 0) => { if (c.t < s.start + s.dur - 0.05) cues.push({ id: c.id, t: c.t, gainDb, why: `${s.id}: ${why}` }); };
  for (const s of shots) {
    for (const it of s.items) { const at = s.start + (it.at || 0); for (const c of gfxCues(it.part, { at, params: it.params, dur: it.dur ?? s.dur - (it.at || 0) })) keep(s, c, c.why); }
    for (const l of s.layers) for (const c of cuesR45(l.kind, l.params)) keep(s, { ...c, t: +(c.t + s.start).toFixed(4) }, c.why);
  }
  // one sound per moment: drop a cue that lands within 2 frames of an earlier kept cue
  cues.sort((a, b) => a.t - b.t); const kept = []; for (const c of cues) if (!kept.length || c.t - kept.at(-1).t > 2 / C.fps) kept.push({ ...c, t: +c.t.toFixed(6) });
  const Pl = PLATFORMS[C.platform];
  return { template: 'demo-r45-type', fps: C.fps, seconds, music: C.music, size: SIZES[Pl.aspect], bpm: G.bpm, beatSec: spb, shots, cues: kept,
    claims: [{ text: 'N circles and a mean error on the drawing scene', source: 'computed live from the drawn path (layers/canvas2d-r45.js epicycleCurve); the readout carries the same label in frame' }], ceilingDb: -2.0, fadeInMs: 40, paceRule: { aslMax: 2.5, longMax: 3.1 } };
}
