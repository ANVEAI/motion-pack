/* motion-pack/templates/_shared/plan.mjs: PURE helpers shared by every template's config.mjs (node + browser, no DOM, no clock).
   Ids follow the pack convention: transitions/<name>, sfx/<category>/<name>, layers/<name>, type/<name>, objects/<name>. */

/* platform presets (docs/evidence/edit.md 8): safe zones as fractions; brand cue deadline; loudness target */
export const PLATFORMS = {
  'tiktok.organic': { aspect: 'tall', safe: { top: 0.14, bottom: 0.35, side: 0.06 }, brandCueBy: 5, lufs: -14 },
  'reels.organic': { aspect: 'tall', safe: { top: 0.14, bottom: 0.35, side: 0.06 }, brandCueBy: 6, lufs: -14 },
  'shorts.organic': { aspect: 'tall', safe: { top: 0.14, bottom: 0.35, side: 0.06 }, brandCueBy: 6, lufs: -14 },
  'yt.ad.15': { aspect: 'wide', safe: { top: 0.05, bottom: 0.08, side: 0.05 }, brandCueBy: 5, lufs: -14 },
  'yt.bumper.6': { aspect: 'wide', safe: { top: 0.05, bottom: 0.08, side: 0.05 }, brandCueBy: 5, lufs: -14 },
  'meta.ad.9x16': { aspect: 'tall', safe: { top: 0.14, bottom: 0.35, side: 0.06 }, brandCueBy: 5, lufs: -14 },
  'x.video': { aspect: 'wide', safe: { top: 0.05, bottom: 0.08, side: 0.05 }, brandCueBy: 7, lufs: -14 },
  'linkedin.video': { aspect: 'square', safe: { top: 0.06, bottom: 0.1, side: 0.06 }, brandCueBy: 7, lufs: -14 },
  'hero.web': { aspect: 'wide', safe: { top: 0.05, bottom: 0.05, side: 0.05 }, brandCueBy: 99, lufs: -16 },
};
export const SIZES = { wide: [1920, 1080], tall: [1080, 1920], square: [1080, 1080] };

/* beat grid: BPM snapped so one beat is a whole number of frames (sound.md: BPM_snap = fps*60/round(fps*60/BPM)) */
export function beatGrid(bpm, fps, seconds, offset = 0) {
  const fpb = Math.round((fps * 60) / bpm), snap = (fps * 60) / fpb, beats = [];
  for (let f = Math.round(offset * fps); f / fps < seconds - 1e-9; f += fpb) beats.push(+(f / fps).toFixed(6));
  return { bpm: +snap.toFixed(4), framesPerBeat: fpb, beatSec: fpb / fps, beats };
}
/* lint.proof (edit.md 4): every claim containing a digit needs a source that SAYS where the number comes from. Missing, blank, filler ("n/a", "x", "tbd", "trust me") and generic
   ("internal benchmark", "in-house data", "our data", "self-reported", "me", "research") sources are refused. Before matching, the source is lower-cased, hyphens, underscores
   and dashes become spaces, runs of space collapse and a leading "source:" is dropped, so "Internal-Benchmark", "in_house  benchmark" and "source: our data" are the same
   string. Limit, stated: this checks the form of a source, not its truth: a made-up sentence still passes. */
const GENERIC_OWNER = '(?:internal|in house|inhouse|our|our own|own|company|team|self|private|proprietary)';
const GENERIC_THING = '(?:benchmarks?|data|numbers|study|studies|testing|tests?|research|metrics?|analytics|figures|estimates?|measurements?|survey|reports?)';
export const GENERIC_SOURCE = new RegExp('^(?:' + GENERIC_OWNER + '(?: ' + GENERIC_THING + ')?|' + GENERIC_THING + '|a study|surveys?|statistics|stats?|source|self reported|anecdotal|'
  + 'n ?a|none|nil|tbd|tba|todo|unknown|various|misc|trust me(?: bro)?|believe me|me|myself|us|we|i|see above|same|x+|test(?:ing)?|asdf+|foo|bar|[-.?!_*#/\\ ]+)$', 'i');
export const normSource = (s) => String(s ?? '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').toLowerCase().replace(/[-_\u2010-\u2015]+/g, ' ')
  .replace(/\s+/g, ' ').trim().replace(/^(?:source|src)\s*:\s*/, '').replace(/[.\s]+$/, '').trim();
export const sourceOk = (s) => { const t = normSource(s); return t !== '' && !GENERIC_SOURCE.test(t) && !GENERIC_SOURCE.test(t.replace(/\//g, '')); };
export const lintClaims = (claims) => (claims || []).filter((c) => /\d/.test(c.text) && !sourceOk(c.source));
/* lint.pace: average shot length + longest shot */
export function lintPace(shots, { aslMax = 2.5, longMax = 4.5 } = {}) {   // shots marked hold: true (hero reveal, end card) are exempt from longMax
  const d = shots.map((s) => s.dur), asl = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length), lg = Math.max(0, ...shots.filter((s) => !s.hold).map((s) => s.dur));
  return { shots: d.length, asl: +asl.toFixed(2), longest: +lg.toFixed(3), pass: asl <= aslMax && lg <= longMax };
}
/* every non-hard-cut boundary must carry a reason (edit.md: the planner refuses unmotivated transitions) */
export const lintTransitions = (shots) => shots.filter((s) => { const tx = s.tx ?? s.transition; return tx && tx !== 'transitions/cut' && !s.txReason; }).map((s) => s.id);   // shot.tx, or shot.transition (the part demos' spelling)
/* the lint as a gate: what stops a build. An unsourced digit claim and an unmotivated transition are failures (cues.mjs exits 2 unless --allow-lint); lint.pace is reported, never enforced */
export const lintFailures = (L) => [...((L && L.claimsWithoutSource) || []).map((t) => `lint.proof: "${t}" has a digit and no source (add { source } to the claim, or take the number out)`),
  ...((L && L.unmotivatedTransitions) || []).map((id) => `lint.tx: the transition into shot "${id}" has no reason (set a Murch reason such as EMOTION, STORY, RHYTHM, ENERGY, REVEAL, PLACE, or make it a hard cut)`)];

/* words demo copy must not use (mp check, mp lint): say placeholder, demo data, render or example instead */
export const BANNED_DEMO_WORDS = ['in development', 'planned', 'illustration'];

/* SFX for a transition id (edit.md 2: each transition has a paired synthesised sound). Ids exist in sfx/mpaudio (snd.<cat>.<name>). */
export const TX_SFX = {
  'transitions/cut': null, 'transitions/whip': 'sfx/whoosh/whip_pan', 'transitions/smash': 'sfx/tx/smash_cut', 'transitions/flash': 'sfx/tx/shutter_flash',
  'transitions/glitch': 'sfx/tx/glitch_stutter', 'transitions/zoom-through': 'sfx/tx/zoom_through', 'transitions/scale-punch': 'sfx/tx/scale_punch',
  'transitions/push': 'sfx/tx/push', 'transitions/dissolve': 'sfx/tx/dissolve_pad', 'transitions/dip-to-black': 'sfx/tx/dip_to_black',
  'transitions/light-leak': 'sfx/tx/light_leak', 'transitions/film-burn': 'sfx/tx/film_burn', 'transitions/iris': 'sfx/tx/iris_open',
  'transitions/luma-wipe': 'sfx/tx/luma_wipe', 'transitions/mask-reveal': 'sfx/tx/mask_reveal', 'transitions/ink': 'sfx/tx/ink_bloom',
  'transitions/match': 'sfx/tx/match_link', 'transitions/morph': 'sfx/tx/morph_warble', 'transitions/blur-cross': 'sfx/tx/blur_cross',
};
/* lay shots end to end from {id, dur, ...} and add boundary cues: transition SFX on the cut frame (the sound's own anchor = its peak) */
export function sequence(list, fps = 30) {
  let f = 0, acc = 0; const shots = [], cues = [];
  for (const s of list) { acc += s.dur; const f1 = Math.round(acc * fps), start = +(f / fps).toFixed(6), dur = +((f1 - f) / fps).toFixed(6); shots.push({ ...s, start, dur }); f = f1; }   // cumulative frame rounding: no drift
  const t = f / fps;
  shots.forEach((s, i) => { if (i && s.tx && TX_SFX[s.tx]) cues.push({ id: TX_SFX[s.tx], t: s.start, gainDb: s.txGain ?? -4, why: 'tx ' + s.tx }); });
  return { shots, cues, seconds: +t.toFixed(6) };
}
/* captions (edit.md 7.1 cap.chunk): words [{w, s, e}] -> chunks of <= maxWords / maxChars, break on punctuation or a pause */
export function chunkCaptions(words, { maxWords = 4, maxChars = 22, pause = 0.25, lead = 2 / 30, minHold = 0.35 } = {}) {
  const out = []; let cur = [];
  const flush = () => { if (!cur.length) return; out.push({ words: cur, start: Math.max(0, cur[0].s - lead), end: Math.max(cur.at(-1).e, cur[0].s - lead + minHold) }); cur = []; };
  words.forEach((w, i) => { const next = words[i + 1], len = cur.map((x) => x.w).join(' ').length + w.w.length + 1;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) flush(); cur.push(w);
    if (/[.,?!]$/.test(w.w) || (next && next.s - w.e > pause)) flush(); });
  flush(); for (let i = 0; i < out.length - 1; i++) out[i].end = Math.min(out[i].end, out[i + 1].start); return out;
}
/* jump-cut keep ranges from words: cut silences longer than silenceMin (th.autocut), keep a breath, pad edges */
export function autocut(words, { silenceMin = 0.5, padBefore = 0.06, padAfter = 0.09 } = {}) {
  const keep = []; let a = Math.max(0, words[0].s - padBefore), b = words[0].e + padAfter;
  for (let i = 1; i < words.length; i++) { const w = words[i]; if (w.s - words[i - 1].e > silenceMin) { keep.push([a, b]); a = Math.max(0, w.s - padBefore); } b = w.e + padAfter; }
  keep.push([a, b]); return keep.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
}
/* map source time -> output time through keep ranges (for captions after jump cuts) */
export function remap(keep, t) { let o = 0; for (const [a, b] of keep) { if (t < a) return o; if (t <= b) return o + (t - a); o += b - a; } return o; }
