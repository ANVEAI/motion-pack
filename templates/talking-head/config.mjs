/* TEMPLATE talking-head: a human/talking-head edit from an INPUT MP4 + its word transcript (docs/research/edit.md 7.2):
   1 cut silences > 0.5 s (th.autocut, keep a breath)  2 captions 2-4 words, active word highlighted (cap.chunk / cap.impact)
   3 B-roll slots (35-50% coverage, picture leads the line by 150 ms, first B-roll >= 2 s in)  4 punch-ins 1.12 on emphasis words,
   max 1 per 4 s, alternate framing 1.0 / 1.15 / 1.0 / 1.25 on each jump cut (disguises the cut)  5 lower third  6 SFX  (layer order fixed).
   Transcript: words.json [{w, s, e, emph?}] from whisper (video-use / talking-head-recut do the analysis; this template does the edit).
   DEMO: the input is our own film-scene render (no speech: the transcript is hand-timed placeholder text), so this proves mechanics only. */
import fs from 'node:fs';
import { autocut, remap, chunkCaptions, PLATFORMS, SIZES } from '../_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  input: '../film-scene/out/film-scene-wide.mp4',   // any MP4 (relative to this folder or absolute); its own audio is kept
  words: 'words.json',
  platform: 'reels.organic', fps: 30,                // 9:16 by default; 'yt.ad.15' etc. for 16:9
  autocut: { silenceMin: 0.5, padBefore: 0.06, padAfter: 0.09 },
  framing: { ladder: [1.0, 1.15, 1.0, 1.25], anchor: [0.5, 0.38] },
  punch: { scale: 1.12, inMs: 140, minGap: 4.0 },
  broll: [ { word: 'phone', dur: 1.3, src: '../_shared/media/plate-devices.mp4', mediaStart: 2.0 } ],   // anchored to a word (output time from the edit)
  lowerThird: { name: 'The Worker', title: 'Desk resident since v10', at: 0.4, dur: 2.6 },
  captions: { maxWords: 3, maxChars: 15, accent: '#4a18ed', y: 0.56 },
  type: { caption: null, lowerThird: 'type/wipe' },   // caption: null = the built-in karaoke highlight (type module captions.js is canvas/DOM-mount based: TODO adapter)
  layers: [ { kind: 'vignette', params: {} }, { kind: 'grain', params: { stock: 'digital-soft' } } ],
  sfx: { emph: 'sfx/ui/pop', punch: 'sfx/tx/scale_punch', broll: 'sfx/whoosh/swish_s', lowerThird: 'sfx/ui/slide' },   // stem gains (dB) are absolute: SFX sit under the voice
};
/* ============================================================================== */

export function buildPlan(C, dir = '.') {
  const T = JSON.parse(fs.readFileSync(new URL('./' + C.words, import.meta.url), 'utf8')).words, P = PLATFORMS[C.platform], fps = C.fps;
  const keep = autocut(T, C.autocut), q = (x) => Math.round(x * fps) / fps;
  let o = 0; const segs = keep.map(([a, b], i) => { const s = { id: 'seg' + i, src: a, start: q(o), dur: q(b - a), scale: C.framing.ladder[i % C.framing.ladder.length] }; o = q(o) + q(b - a); return s; });
  const seconds = +o.toFixed(4), words = T.map((w) => ({ ...w, os: +remap(keep, w.s).toFixed(3), oe: +remap(keep, w.e).toFixed(3) }));
  const caps = chunkCaptions(words.map((w) => ({ w: w.w, s: w.os, e: w.oe, emph: w.emph })), C.captions).map((c, i) => ({ id: 'cap' + i, ...c, start: q(c.start), end: q(c.end) }));
  // punch-ins on emphasis words, at most one per minGap seconds
  const punches = []; for (const w of words.filter((x) => x.emph)) if (!punches.length || w.os - punches.at(-1).t >= C.punch.minGap) punches.push({ t: q(w.os), word: w.w });
  const broll = C.broll.map((b, i) => { const w = words.find((x) => x.w.toLowerCase().startsWith(b.word)); const t = q(Math.max(2.0, (w ? w.os : 2) - 0.15)); return { id: 'broll' + i, ...b, start: t, dur: q(Math.min(b.dur, seconds - t)) }; });
  const cues = [ ...punches.map((p) => ({ id: C.sfx.punch, t: p.t, gainDb: -14, why: 'punch-in on "' + p.word + '"' })),
    ...words.filter((w) => w.emph).map((w) => ({ id: C.sfx.emph, t: q(w.os), gainDb: -20, why: 'emphasis "' + w.w + '"' })),
    ...broll.map((b) => ({ id: C.sfx.broll, t: b.start, gainDb: -14, why: 'B-roll in' })),
    { id: C.sfx.lowerThird, t: C.lowerThird.at, gainDb: -18, why: 'lower third' } ];
  const shots = segs.map((s) => ({ id: s.id, start: s.start, dur: s.dur }));
  return { template: 'talking-head', fps, seconds, size: SIZES[P.aspect], safe: P.safe, keep, segs, captions: caps, punches, broll, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [],
    coverage: +(broll.reduce((a, b) => a + b.dur, 0) / seconds).toFixed(2), paceRule: { aslMax: 4, longMax: 6 } };
}
