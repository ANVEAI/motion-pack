/* TEMPLATE style-scene: one tiny wordless story told as a FILM in a named style's own language (the hero styles of playbook/styles).
   The story (the same in every world, so styles compare fairly): a night reading room; a sleepy figure at a desk reaches up and switches
   on a lamp; warm light; a book falls open and its pages run; delight; the title. Beats follow the character-spot format
   (hook, setup, escalation, twist, reaction, message). Three.js studio kit (objects/), deterministic renderAt(t), rendered by render3d.sh.
   WORLD (objects/lib/night.js WORLDS): clay | doc | neon | paper. CRAFT: the style's film language as numbers the plan records (plan.scene)
   so `mp lint` can check them against the style's signature (lint.style.craft):
     stepFps        animate on 2s (15 at 30 fps): every pose, prop and camera move is sampled at stepTime(t); 0 = continuous (motion blur on)
     squash         peak squash of a tap or a landing (volume kept), 0 = rigid
     handheld       handheld drift amplitude (1 = a steady operator), 0 = locked off
     rackFocus      pull focus lamp -> book -> figure across the escalation (the kit's depth of field)
     push           slow push-in per shot, a fraction of the camera distance (0.12 = 12 % closer by the end of each shot)
     rain, streaks  rain on the glass between the camera and the room in the first two shots; passing light streaks reflected in it
     paperLayers    cut-paper layers behind the window (parallax), boilPx their boil at 12 per second
   The cut treatments come from each cut's transition id (CONFIG.transitions, which a style rewrites by REASON): transitions/cut (a hard cut),
   transitions/dip-to-black (a dip toward black over 4 frames), transitions/lightLeak (a magenta-violet flare), transitions/pagePeel (a paper
   page unrolls over the frame and peels off; the cut happens under it). Any other id renders as a hard cut and the plan says so (scene.cuts).
     grain, bloom, vignette, dof, gate   the kit grade; gate = film-gate corner radius (fraction of the frame height), 0 = none
     lowerThird, archival   documentary graphics: a mono lower third over the setup, a typed archival card cut in at the twist
   Edit CONFIG; scene.html reads it; cues.mjs exports the cue sheet and the mix. */
import { sequence } from './_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  name: 'style-scene', fps: 30,
  world: 'clay',
  colors: {},                                   // any field of the world (night.js WORLDS) to override
  craft: { stepFps: 0, squash: 0, handheld: 0, rackFocus: false, push: 0, rain: false, streaks: 0, paperLayers: 0, boilPx: 0,
           grain: 0.02, bloom: 0.85, vignette: 0.1, dof: 60, gate: 0, lowerThird: false, archival: false },
  brand: { name: 'Night Library', line: 'Read after *dark*.', accent: '#6a4bd6', ink: '#2b2340', paper: '#f1ecf7', font: 'Manrope' },   // a neutral placeholder subject
  copy: { lowerThird: 'The reading room · 11:40 pm', archival: ['READING ROOM', 'Open after dark.', 'card 03 · placeholder'] },
  beats: [   // seconds; cam per beat for wide (16:9); tall (9:16) overrides; the transition into each beat comes from CONFIG.transitions
    { id: 'hook', dur: 1.8, cam: { fov: 22, elev: [12, 11], az: [-16, -12], dist: [7.6, 7.2], target: [-0.1, 0.9, 0.0], tall: { dist: [13.5, 13] } } },
    { id: 'setup', dur: 2.6, cam: { fov: 22, elev: [14, 14], az: [-8, -4], dist: [4.6, 4.3], target: [-0.75, 0.82, 0.05], tall: { dist: [8.2, 7.8] } } },
    { id: 'escalation', dur: 3.6, cam: { fov: 22, elev: [34, 36], az: [6, 10], dist: [3.2, 2.9], target: [-0.05, 0.62, 0.05], tall: { dist: [5.6, 5.2] } } },
    { id: 'twist', dur: 1.8, cam: { fov: 22, elev: [9, 9], az: [24, 20], dist: [4.2, 4.0], target: [-0.75, 0.85, 0.2], tall: { dist: [7.2, 6.9] } } },
    { id: 'reaction', dur: 1.1, cam: { fov: 22, elev: [6, 6], az: [34, 32], dist: [2.7, 2.6], target: [-1.05, 0.95, 0.3], tall: { dist: [4.8, 4.6] } } },
    { id: 'message', dur: 2.6, cam: { fov: 22, elev: [14, 16], az: [-6, -2], dist: [9.8, 10.6], target: [0.1, 0.9, 0.0], tall: { dist: [16, 17] } } },
  ],
  transitions: { setup: ['transitions/cut', 'STORY: establishing -> the reach'], escalation: ['transitions/cut', 'STORY: the light lands on the book'],   // the cut INTO each beat: [id, REASON]
                 twist: ['transitions/cut', 'EMOTION: the delight'], reaction: ['transitions/cut', 'EMOTION: the face'], message: ['transitions/cut', 'RHYTHM: settle on the title'] },
  layout: { worker: [-1.1, 0.3], lamp: [-0.5, -0.2], book: [0.12, 0.06], mug: [0.82, -0.22] },
  events: { wake: 1.4, reach: 2.75, tap: 3.05, on: 3.12, open: [4.6, 5.5], lean: 5.6, flip: [6.0, 7.6], delight: 8.2, hop: [8.55, 8.9], cheer: 9.9 },
  music: 'music/bed_lofi_warm_loop8',
  sfx: { bed: 'sfx/amb/room_tone', wake: 'sfx/lift/inhale', tap: 'sfx/ui/pop', on: 'sfx/hw/power_on', open: 'sfx/paper/flip', flutter: 'sfx/paper/rustle', delight: 'sfx/cartoon/boing', sting: 'sfx/logo/fifth_lift' },
};
/* ============================================================================== */

/* the shared project file -> this CONFIG (`mp list style-scene`). A wordless scene: the title and end line are the only copy */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.fonts.display': 'brand.font', 'text.end': 'brand.line', 'music': 'music',
};
export const ASPECTS = { '16:9': { how: 'native', tag: 'wide' }, '9:16': { how: 'native', tag: 'tall' }, '1:1': { how: 'manual', note: 'the scene cameras are framed for wide and tall only' }, '4:5': { how: 'manual', note: 'the scene cameras are framed for wide and tall only' } };
export const WORLD_IDS = ['clay', 'doc', 'neon', 'paper'];
export const CUT_DRAWN = ['transitions/cut', 'transitions/dip-to-black', 'transitions/lightLeak', 'transitions/pagePeel'];   // the cut treatments scene.html draws

export function buildPlan(C) {
  if (!WORLD_IDS.includes(C.world)) throw new Error(`style-scene: world ${C.world} is not one of ${WORLD_IDS.join(', ')}`);
  const tx = (id) => (C.transitions[id] || [])[0], why = (id) => (C.transitions[id] || [])[1];
  const { shots, cues: txCues, seconds } = sequence(C.beats.map((b, i) => ({ ...b, sec: b.id, ...(i ? { tx: tx(b.id), txReason: why(b.id) } : {}) })), C.fps);
  const E = C.events, S = C.sfx, at = (id) => shots.find((s) => s.id === id).start, K = C.craft;
  const cues = [...txCues,
    { id: S.bed, t: 0, gainDb: -22, loopTo: seconds, why: 'the room under the scene (sound first)' },
    { id: S.wake, t: E.wake, gainDb: -10, why: 'the figure wakes' },
    { id: S.tap, t: E.tap, gainDb: -4, why: 'the tap on the lamp' }, { id: S.on, t: E.on, gainDb: -4, why: 'the lamp comes on (the turn)' },
    { id: S.open, t: E.open[0] + 0.25, gainDb: -6, why: 'the book falls open' },
    ...[0, 0.55, 1.1].map((d) => ({ id: S.flutter, t: E.flip[0] + d, gainDb: -10, why: 'pages run' })),
    { id: S.delight, t: E.hop[1], gainDb: -6, why: 'delight (the landing)' },
    { id: S.sting, t: at('message') + 0.35, gainDb: -2, why: 'the sting on the title' }];
  const title = at('message') + 0.3, texts = [{ id: 'title', text: C.brand.name, t: [+(title).toFixed(3), seconds], role: 'headline', fontPx: 120 }, { id: 'line', text: C.brand.line.replace(/\*/g, ''), t: [+(title + 0.25).toFixed(3), seconds], role: 'line', fontPx: 62 }];
  if (K.lowerThird) texts.push({ id: 'lower-third', text: C.copy.lowerThird, t: [+(at('setup') + 0.3).toFixed(3), +(at('escalation') - 0.1).toFixed(3)], role: 'label', fontPx: 58 });
  return { template: 'style-scene', fps: C.fps, seconds, music: C.music, shots: shots.map((s, i) => (i === shots.length - 1 ? { ...s, hold: true } : s)), cues: cues.sort((a, b) => a.t - b.t), texts, claims: [],
    scene: { world: C.world, craft: { ...K }, cuts: shots.slice(1).map((s) => ({ at: s.start, tx: s.tx, drawn: CUT_DRAWN.includes(s.tx) ? s.tx : 'transitions/cut' })) }, paceRule: { aslMax: 3.8, longMax: 3.8 } };
}
