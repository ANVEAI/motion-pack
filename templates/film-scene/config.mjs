/* TEMPLATE film-scene: one animated short-film SCENE in four beats: ESTABLISHING -> ACTION -> REACTION -> PAYOFF
   (docs/research/edit.md 9: one idea per scene, wide -> tight as emotion rises, break the pattern on the turn, hold until the emotion lands).
   Three.js studio kit (objects/), deterministic renderAt(t). Edit CONFIG; scene.html reads it; cues.mjs exports the SFX cue sheet.
   Demo story (wordless): the worker types; the phone keeps buzzing; double-take; the worker flips the phone face-down and smiles. */
import { sequence } from './_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  name: 'film-scene', fps: 30,
  beats: [   // seconds; camera per beat (hard cuts between beats; each shot eases within itself). tall = 9:16 overrides
    { id: 'establishing', dur: 2.0, cam: { fov: 18, elev: [22, 20], az: [-18, -12], dist: [10.8, 10.2], target: [-0.1, 0.45, 0.0], tall: { dist: [19, 18] } } },
    { id: 'action', dur: 2.0, cam: { fov: 18, elev: [34, 32], az: [8, 12], dist: [5.4, 5.0], target: [0.85, 0.05, 0.4], tall: { dist: [9.5, 9] } }, tx: 'transitions/cut' },
    { id: 'reaction', dur: 1.6, cam: { fov: 18, elev: [9, 8], az: [26, 24], dist: [5.6, 5.2], target: [-1.0, 0.8, 0.35], tall: { dist: [8.5, 8] } }, tx: 'transitions/cut' },
    { id: 'payoff', dur: 2.6, cam: { fov: 18, elev: [20, 19], az: [-8, -4], dist: [10.6, 10.2], target: [0.0, 0.45, 0.2], tall: { dist: [18, 17.5] } }, tx: 'transitions/cut' },
  ],
  layout: { worker: [-1.05, 0.35], laptop: [0, -0.2], phone: [0.9, 0.45], mug: [1.0, -0.45], workerColor: '#8d84d4' },
  events: { buzz: [2.25, 2.75, 3.25], take: 4.0, hop: [5.75, 6.25], flip: [6.5, 6.8], smile: 7.2 },
  stage: { slab: [3.8, 0.64, 2.2], grade: { vignette: 0.12 } },
  sfx: { bed: 'sfx/amb/room_tone', typing: 'sfx/ui/typing_burst', buzz: 'sfx/ui/notify', take: 'sfx/voice/huh', hop: 'sfx/cartoon/walk_bounce', flip: 'sfx/wood/tap', sigh: 'sfx/voice/sigh' },
  layers: ['layers/grain', 'layers/vignette'],   // TODO hook: finish the plate with the layers module Finisher (layers/finisher.js) in post
  type: null,                                    // a film scene carries no type; titles come from type/<preset> in the edit
};
/* ============================================================================== */

/* the shared project file -> this CONFIG (`mp list film-scene`). A wordless scene: no brand or copy slots; change beats, layout or events through overrides['film-scene'] */
export const PROJECT_MAP = {};
export const ASPECTS = { '16:9': { how: 'native', tag: 'wide' }, '9:16': { how: 'native', tag: 'tall' }, '1:1': { how: 'manual', note: 'beats carry wide and tall camera distances only' }, '4:5': { how: 'manual', note: 'beats carry wide and tall camera distances only' } };

export function buildPlan(C) {
  const { shots, seconds } = sequence(C.beats.map((b) => ({ ...b, txReason: b.tx ? 'STORY: beat change (hard cut)' : undefined })), C.fps);
  const E = C.events, cues = [
    { id: C.sfx.bed, t: 0, gainDb: -20, loopTo: seconds, why: 'room tone under the scene (sound-first)' },
    { id: C.sfx.typing, t: 0.15, gainDb: -12, why: 'typing' }, { id: C.sfx.typing, t: 1.1, gainDb: -13, why: 'typing' },
    ...E.buzz.map((t) => ({ id: C.sfx.buzz, t, gainDb: -6, why: 'phone buzz (visual on the same frame)' })),
    { id: C.sfx.take, t: E.take + 16 / C.fps, gainDb: -4, why: 'double-take snap' },
    { id: C.sfx.hop, t: E.hop[0], gainDb: -9, why: 'hop' }, { id: C.sfx.flip, t: E.flip[1], gainDb: -5, why: 'phone lands face-down' },
    { id: C.sfx.sigh, t: E.smile, gainDb: -8, why: 'relief' },
  ];
  return { template: 'film-scene', fps: C.fps, seconds, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [], layers: C.layers, paceRule: { aslMax: 3, longMax: 4 } };
}
