/* TEMPLATE demo-r6-pivot: a 30 s SQUARE (1080 x 1080) CONTINUOUS typographic film, zero cuts (2026-10-15, round 6): problem -> pivot -> value -> ask, built from the
   round-6 parts as a working example of each.
   Pattern (cuts/story6.py `problem-pivot`, generated at plan time, not hand-timed): a sentence typed with a cursor (type.typewriter) and its one-word punchline in the accent
   colour (type.blurIn) -> a three-beat problem ladder: a small line diagram that gets WORSE each beat under a two-word caption, captions swap by a blur-through (type.blurIn)
   -> a 1.8 s audio GAP (the bed thins to a hum, then true silence; plan.audio.quiet kind gap) that starts inside the last beat and ends ON the pivot frame -> the PIVOT:
   the bass lands, the bed is back, a glowing ribbon rises along the bottom (background.auroraRibbon, riseAt a few frames after the sound) and the brand line blurs in -> a
   three-beat value ladder as one sentence whose accent phrase swaps in place (type.accentSwap) -> a typed command pill (type.typewriter + an outline that draws on) -> the address
   -> a quiet hold of 2.5 s (plan.audio.quiet kind hold): no stinger, the ribbon fades, the address holds.
   Craft only: the SHAPE of one studied reference (docs/evidence/reference-round6-2026-10.md); no wording, mark, mascot or look-alike is reused. "Brand A Notes" is a placeholder
   brand (and says so in frame during the hold); there are no numbers on screen, so nothing needs a source. The diagram is original geometry (boxes with faces), local to this demo.
   Sound: music/bed_tech_pulse_loop8 (60% bass, the brand-launch row of music/README.md) with the story's bed automation; one cue per motion event (cuts/story6.py sfx);
   the pivot bass hit is the SAME cue as layers/backgrounds-r6.js cuesR6('auroraRibbon') (asserted below), so the sound leads the ribbon by `lead` s. */
import { execFileSync } from 'node:child_process';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { SIZES } from '../_shared/plan.mjs';
import { cuesR6, auroraParams } from '../../layers/backgrounds-r6.js';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  fps: 30, seconds: 30, bpm: 120, music: 'music/bed_tech_pulse_loop8',
  /* the copy: placeholder brand, original wording (cuts/patterns.json story.problemPivot.defaults is the same copy) */
  story: { sentence: 'Launch day breaks the same thing:', accent: 'Handoffs.', problem: 'Plans get lost|Notes drift apart|Dates slip', brand: 'Brand A Notes',
    value: 'Your plan stays in one place|Your plan stays yours|Your plan stays open anywhere', command: '//start a plan', url: 'brand-a.example/start', gapS: 1.8, holdS: 2.5, leadS: 0.1 },
  ceilingDb: -3.0,   // the render's own AAC re-encode lowered the first mix by 0.7 dB at -2.15 dBTP (gotchas.md): leave the headroom in the WAV
  look: { ground: '#030206', ink: '#F3F1FA', accent: '#A58BFF', line: '#CFCBE6', mono: '#E9E6F7' },
  aurora: { rise: 1.4, grain: 0.4, height: 0.24 },
  placeholderNote: 'illustrative film: Brand A Notes is a placeholder',
};
/* ============================================================================== */

export function buildPlan(C) {
  const s = C.story, fps = C.fps;
  const args = ['problem-pivot', '--fps', String(fps), '--duration', String(C.seconds), '--sentence', s.sentence, '--accent', s.accent, '--problem', s.problem, '--brand', s.brand,
    '--value', s.value, '--command', s.command, '--url', s.url, '--gap-s', String(s.gapS), '--hold-s', String(s.holdS), '--lead-s', String(s.leadS)];
  const story = JSON.parse(execFileSync('python3', [path.join(PACK, 'cuts', 'cutgen.py'), ...args], { encoding: 'utf8' }));
  const failed = story.checks.filter((c) => !c.ok).map((c) => c.check);
  if (failed.length || story.warnings.length) throw new Error('problem-pivot: ' + failed.concat(story.warnings).join(' | '));
  /* a film that cannot hold its beats in CONFIG.seconds is a story warning ("duration ... asked, ... made"), thrown above: no second check is needed */
  const T = story.frames / fps, sec = (f) => +(f / fps).toFixed(6);
  /* the ribbon rises `visual_frame` (colour + brand line); its own cue (bass `lead` s before) must be the story's pivot cue */
  const riseAt = sec(story.pivot.visual_frame), aur = { riseAt, lead: s.leadS, ...C.aurora };
  const ac = cuesR6('auroraRibbon', aur), pc = story.sfx.find((c) => c.sfx === 'sfx/hit/sub_drop');
  if (ac.length !== 1 || Math.round(ac[0].t * fps) !== pc.visual_frame) throw new Error(`the ribbon cue (${JSON.stringify(ac)}) is not the story's pivot cue (frame ${pc.visual_frame})`);
  const cues = story.sfx.map((c) => ({ id: c.sfx, t: sec(c.visual_frame), gainDb: c.gain_db, why: (c.cap || '') + (c.why ? ': ' + c.why : '') }));
  return { template: 'demo-r6-pivot', fps, seconds: T, music: C.music, size: SIZES.square, bpm: C.bpm, cues, bedAutomation: story.bed_automation, ceilingDb: C.ceilingDb, audio: story.audio,
    ribbon: auroraParams(aur) && aur, story, shots: [], claims: [], paceRule: {} };
}
