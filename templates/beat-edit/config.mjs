/* TEMPLATE beat-edit: a music/beat edit whose cuts come from a BPM (docs/research/sound.md: BPM snapped so a beat is a whole number of
   frames; docs/research/edit.md 3.3: an energy ladder, cut density rises section by section; flash/punch only on designated hits).
   Sections: intro (cut every 4 beats) -> build (every 2, riser into the drop) -> drop (every beat, flash + punch on downbeats) -> out.
   Music: a music-module bed at the same BPM (music/manifest.json), mixed by music/mixer.py; or drums: true for a bare sfx/drum grid. Clips are any MP4s; the demo uses the pack's own renders. */
import { beatGrid, sequence, PLATFORMS, SIZES } from '../_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  bpm: 120, fps: 30, platform: 'x.video', offset: 0,
  sections: [ { id: 'intro', beats: 4, every: 4 }, { id: 'build', beats: 8, every: 2 }, { id: 'drop', beats: 8, every: 1, flash: true }, { id: 'out', beats: 4, every: 4 } ],
  clips: [   // pool, used round-robin; mediaStart advances so repeats show new frames
    { src: '../_shared/media/plate-devices.mp4', len: 4 }, { src: '../film-scene/out/film-scene-wide.mp4', len: 8.2 },
    { src: '../_shared/media/plate-film.mp4', len: 4 }, { src: '../character-spot/out/character-spot-wide.mp4', len: 16 }, { src: '../_shared/media/plate-cast.mp4', len: 4 } ],
  words: { at: 'drop', list: ['CUT', 'TO', 'THE', 'BEAT'], every: 2 },   // kinetic words on beats in a section (type module id below)
  music: 'music/bed_tech_pulse_loop8',            // music module bed at the SAME BPM (120): its downbeat is t = 0, so cuts land on its beats
  drums: false,                                    // true = a bare sfx/drum grid instead (set music: null)
  type: { word: 'type/scaleSlam', title: 'type/maskRise' },
  tx: { section: ['transitions/flash', 'RHYTHM: section change on the downbeat'], drop: ['transitions/scale-punch', 'RHYTHM: every drop cut lands on the beat'] },
  layers: [ { kind: 'vignette', params: {} }, { kind: 'grain', params: { stock: 'digital-soft' } } ],
  sfx: { kick: 'sfx/drum/kick_punch', snare: 'sfx/drum/snare', hat: 'sfx/drum/hat_closed', crash: 'sfx/drum/crash', riser: 'sfx/riser/noise_2bar', hit: 'sfx/hit/punch' },
};
/* ============================================================================== */

export function buildPlan(C) {
  const totalBeats = C.sections.reduce((a, s) => a + s.beats, 0), G0 = beatGrid(C.bpm, C.fps, 1e3, C.offset), spb = G0.beatSec;
  const seconds = +(totalBeats * spb).toFixed(6), G = { ...G0, beats: G0.beats.slice(0, totalBeats) };
  const list = []; let b = 0, k = 0, used = C.clips.map(() => 0);
  for (const s of C.sections) {
    for (let i = 0; i < s.beats; i += s.every) {
      const ci = k % C.clips.length, clip = C.clips[ci], d = Math.min(s.every, s.beats - i) * spb, ms = +((used[ci] * 1.3) % Math.max(0.1, clip.len - d)).toFixed(3); used[ci]++;
      const first = i === 0 && b > 0, tx = first ? C.tx.section : s.flash ? C.tx.drop : null;
      list.push({ id: `c${k}`, sec: s.id, beat: b + i, media: clip.src, mediaStart: ms, dur: d, flash: !!s.flash, ...(tx ? { tx: tx[0], txReason: tx[1] } : { tx: 'transitions/cut' }) }); k++;
    }
    b += s.beats;
  }
  const { shots, cues } = sequence(list, C.fps);
  if (C.drums) G.beats.forEach((t, i) => { cues.push({ id: i % 2 ? C.sfx.snare : C.sfx.kick, t, gainDb: i % 2 ? -6 : -3, why: 'beat ' + (i + 1) }); cues.push({ id: C.sfx.hat, t: t + spb / 2, gainDb: -16, why: 'off-beat hat' }); });
  const sec0 = (id) => { let x = 0; for (const s of C.sections) { if (s.id === id) return x * spb; x += s.beats; } return 0; };
  const drop = sec0('drop'); cues.push({ id: C.sfx.riser, t: drop, gainDb: -8, why: 'riser ends on the drop downbeat' }, { id: C.sfx.crash, t: drop, gainDb: -6, why: 'drop' }, { id: C.sfx.hit, t: drop, gainDb: -4, why: 'drop hit' });
  const W = C.words, w0 = sec0(W.at), words = W.list.map((w, i) => ({ text: w, t: +(w0 + i * W.every * spb).toFixed(6), dur: +(W.every * spb).toFixed(6) }));
  const P = PLATFORMS[C.platform];
  return { template: 'beat-edit', fps: C.fps, seconds, music: C.music, size: SIZES[P.aspect], safe: P.safe, bpm: G.bpm, bpmAsked: C.bpm, framesPerBeat: G.framesPerBeat, beatSec: spb, beats: G.beats, shots, words, cues: cues.sort((a, b) => a.t - b.t), claims: [], paceRule: { aslMax: 2.5, longMax: 2.1 } };
}
