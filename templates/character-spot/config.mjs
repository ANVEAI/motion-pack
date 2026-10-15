/* TEMPLATE character-spot: a mime-style wordless character spot, 15-20 s (docs/research/edit.md 10: one gag, one feature, wordless,
   capped emotions, neutral white stage, payoff = expectation reversal, then one text line + a sonic sting). We borrow the GRAMMAR only:
   the character is our own worker (objects/characters), never a likeness of an existing campaign character.
   Demo gag (placeholder brand "Orbit", fictional): the worker reaches for coffee, tips it, the spill kills the laptop; despair; the
   screen comes back on its own with the draft restored; cheer. Feature line: "Every draft, saved." */
import { sequence } from './_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  name: 'character-spot', fps: 30,
  world: { mode: 'white', paper: '#f3f2ef' },        // stage.neutral: seamless white cyc, no slab
  brand: { name: 'Orbit', line: 'Every draft, *saved*.', accent: '#4a18ed', mint: '#34d399' },
  beats: [   // the beat table (edit.md 10.2, 15 s column stretched to 16): id, dur, camera; tx = boundary + reason
    { id: 'hook', dur: 2.5, cam: { elev: [15, 14], az: [-12, -8], dist: [8.6, 8.1], target: [-0.25, 0.5, 0.05] } },
    { id: 'setup', dur: 2.5, cam: { elev: [12, 12], az: [-24, -20], dist: [6.4, 6.0], target: [-0.6, 0.55, 0.2] }, tx: 'transitions/cut' },
    { id: 'escalation', dur: 3.0, cam: { elev: [20, 21], az: [-6, -2], dist: [9.2, 8.8], target: [0.0, 0.35, 0.05] }, tx: 'transitions/cut' },
    { id: 'despair', dur: 2.0, cam: { elev: [8, 8], az: [22, 20], dist: [4.9, 4.6], target: [-0.95, 0.72, 0.3] }, tx: 'transitions/smash', txReason: 'EMOTION: the loss lands (smash to the face)' },
    { id: 'twist', dur: 1.5, cam: { elev: [10, 10], az: [-4, -3], dist: [4.4, 4.2], target: [0.35, 0.52, -0.25] }, tx: 'transitions/smash', txReason: 'STORY: the reversal (screen wakes)' },
    { id: 'reaction', dur: 1.5, cam: { elev: [10, 10], az: [18, 16], dist: [6.0, 5.7], target: [-0.9, 0.6, 0.3] }, tx: 'transitions/cut' },
    { id: 'message', dur: 3.0, cam: { elev: [16, 18], az: [-6, -4], dist: [12.5, 13.5], target: [-0.2, 0.9, 0.0] }, tx: 'transitions/cut' },
  ],
  layout: { worker: [-0.95, 0.3], mug: [-0.42, 0.42], laptop: [0.35, -0.25], color: '#8d84d4' },
  events: { stretch: 2.6, reach: 5.2, knock: 5.6, spill: [5.82, 6.7], dark: 6.7, freeze: 6.85, restore: 10.0, cheer: 12.2 },
  music: 'music/bed_playful_bounce_loop8',   // music module bed id; null = SFX + air only
  type: { endLine: 'type/end-line' },               // type module id (fallback: the minimal canvas line drawn by scene.html)
  sfx: { bed: 'sfx/amb/studio_air', typing: 'sfx/ui/typing_burst', babble: 'sfx/voice/mumble', stretch: 'sfx/lift/inhale', knock: 'sfx/ceramic/clink',
         spill: 'sfx/liquid/splash', pour: 'sfx/liquid/pour', dark: 'sfx/tx/tape_stop', gasp: 'sfx/voice/gasp', sad: 'sfx/cartoon/sad_brass',
         restore: 'sfx/stinger/win', wow: 'sfx/voice/wow', cheer: 'sfx/cartoon/tada', sting: 'sfx/logo/two_note' },
};
/* ============================================================================== */

/* the shared project file -> this CONFIG (`mp list character-spot`). The aspect is a render argument (render3d.sh wide|tall), not a CONFIG field */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.paper': 'world.paper', 'brand.line': 'brand.line', 'text.end': 'brand.line', 'music': 'music',
};
export const ASPECTS = { '16:9': { how: 'native', tag: 'wide' }, '9:16': { how: 'native', tag: 'tall' }, '1:1': { how: 'manual', note: 'the stage camera is framed for wide and tall only' }, '4:5': { how: 'manual', note: 'the stage camera is framed for wide and tall only' } };

export function buildPlan(C) {
  const { shots, cues: txCues, seconds } = sequence(C.beats, C.fps), E = C.events, S = C.sfx, at = (id) => shots.find((s) => s.id === id).start;
  const cues = [ ...txCues,
    { id: S.bed, t: 0, gainDb: -24, loopTo: seconds, why: 'air under the white world' },
    { id: S.typing, t: 0.2, gainDb: -10, why: 'typing' }, { id: S.typing, t: 1.2, gainDb: -11, why: 'typing' }, { id: S.babble, t: 1.9, gainDb: -10, why: 'pleased hum (wordless)' },
    { id: S.stretch, t: E.stretch, gainDb: -9, why: 'stretch' }, { id: S.knock, t: E.knock, gainDb: -3, why: 'hand hits the mug' },
    { id: S.spill, t: E.spill[0] + 0.15, gainDb: -6, why: 'coffee lands' }, { id: S.pour, t: E.spill[0] + 0.25, gainDb: -12, why: 'spreading' },
    { id: S.dark, t: E.dark, gainDb: -4, why: 'laptop dies' }, { id: S.gasp, t: E.freeze + 0.15, gainDb: -6, why: 'gasp' },
    { id: S.sad, t: at('despair') + 0.2, gainDb: -6, why: 'despair' }, { id: S.restore, t: E.restore, gainDb: -3, why: 'the reversal' },
    { id: S.wow, t: at('reaction') + 0.1, gainDb: -5, why: 'wow' }, { id: S.cheer, t: E.cheer, gainDb: -6, why: 'cheer' },
    { id: S.sting, t: at('message') + 0.4, gainDb: -2, why: 'sonic sting on the end line' } ];
  return { template: 'character-spot', fps: C.fps, seconds, music: C.music, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [], paceRule: { aslMax: 3.2, longMax: 3.5 } };
}
