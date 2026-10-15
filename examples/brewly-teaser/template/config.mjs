/* TEMPLATE ad: hook -> problem -> product -> proof -> CTA (docs/research/edit.md 4, ABCD-mapped), 15 s or 30 s, HyperFrames.
   Edit the CONFIG block only; `node make.mjs [--set length=30]` writes index.html + the SFX mix; then `hyperframes render`.
   DEMO CONTENT: "Orbit" is a FICTIONAL placeholder brand, and every line is placeholder copy. Proof lines carry no numbers on purpose:
   any claim with a digit must carry `source` or lint.proof fails the build (node make.mjs exits 2; `--allow-lint` waives it and the plan records the waiver). */
import { sequence, PLATFORMS } from '../_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 15,                      // 15 | 30 (section budgets from edit.md 4)
  platform: 'reels.organic',       // design.json safe.platform (tall; brand cue by 6 s)
  fps: 30,
  aspect: '9:16',                  // BREWLY: added key, read by this copy's make.mjs (the stock ad template is 16:9 only)
  // design.json palette.accent / ink / paper, frames.end_card.line. Brewly is a FICTIONAL brand (labelled in frame and in the post).
  brand: { name: 'Brewly', accent: '#B4410F', ink: '#1E1410', paper: '#F6EFE6', url: 'brewly.example', cta: 'Coming soon' },
  hook: { archetype: 'problem-agitate', line: 'Out of beans. *Again.*', media: null, mediaStart: 0 },   // shotlist s01 (hook A)
  problem: { lines: ['7:02 AM.', 'Empty *mug*.'], media: null, mediaStart: 0 },                          // s02 (in-world clock), s03
  product: { name: 'Brewly', line: 'Coffee that *never runs out*.', media: null, mediaStart: 0 },        // s04 reveal, s05 benefit
  proof: [ { text: 'Ships your next bag *before you run out*.' } ],   // s06: the one feature (fictional; no digits, no time claim)
  proofCount: { 15: 1, 30: 1 },    // how many proof lines each length uses (>= 1.5 s per line to read)
  plateAsl: 3,                     // 3 > the 2.5 s hook: no coverage cuts (the shot list has one shot per beat)
  transitions: {                   // boundary between sections: id + the REASON (lint refuses unmotivated transitions: make.mjs exits 2)
    'hook>problem': ['transitions/cut', null],   // was smash: subtracted after mixer LINT R4 (hero hits closer than 3 s)
    'problem>product': ['transitions/whip', 'ENERGY: the tension releases into the reveal'],
    'product>proof': ['transitions/push', 'STORY: from the promise to how it works'],
    'proof>cta': ['transitions/iris', 'REVEAL: the full mug opens out of the app screen'],
  },
  type: { headline: 'type/elasticPop', card: 'type/maskRise', end: 'type/elasticPop', sub: 'type/blurIn' },   // design.json motion.type_presets
  layers: [ { kind: 'vignette', params: { amount: 0.12 } }, { kind: 'grain', params: { stock: 'upload-safe' } } ],   // design.json look
  sfx: { firstFrame: 'sfx/hit/punch', card: 'sfx/ui/pop', riser: 'sfx/riser/noise_1bar', reveal: 'sfx/hit/cinema', sting: 'sfx/logo/hybrid', bed: 'sfx/amb/studio_air' },   // bed = used only when music is null
  // BREWLY: added key (no CONFIG slot existed for story foley): shotlist sound intents resolved to ids, t = visual time in s
  extraCues: [
    { id: 'sfx/paper/rustle', t: 0.03, why: 's01 dry paper shake of the upside-down bag' },
    { id: 'sfx/glass/tap', t: 0.30, why: 's01 bean 1 lands in the mug' },
    { id: 'sfx/glass/tap', t: 0.63, why: 's01 bean 2 lands in the mug' },
    { id: 'sfx/glass/tap', t: 0.97, why: 's01 bean 3 lands in the mug' },
    { id: 'sfx/paper/rustle', t: 1.50, why: 's01 the bag shakes empty' },
    { id: 'sfx/ui/count_tick', t: 3.10, why: 's02 one clock tick' },
    { id: 'sfx/ceramic/clink', t: 3.80, why: 's03 hollow clink of the empty mug' },
    { id: 'sfx/device/phone_buzz', t: 5.10, why: 's04 the phone lights up' },
    { id: 'sfx/device/notify_soft', t: 5.50, why: 's04 the Brewly notification drops in' },
    { id: 'sfx/device/progress_fill', t: 9.50, why: 's06 the bean gauge drains' },
    { id: 'sfx/ui/success', t: 10.90, why: 's06 the gauge flips to Next bag shipped' },
    { id: 'sfx/liquid/pour', t: 12.55, why: 's07 the full mug: the stake resolved' },
  ],
  music: 'music/bed_uplift_corporate_loop8',   // warm + optimistic, use:ad/launch, 112.5 BPM (16 frames per beat at 30 fps)
};
/* ============================================================================== */

const BUDGET = { 15: { hook: 2.5, problem: 2.5, product: 4.0, proof: 3.5, cta: 2.5 }, 30: { hook: 3, problem: 5, product: 8, proof: 9, cta: 5 } };
export function buildPlan(C) {
  const B = BUDGET[C.length] || BUDGET[15], P = PLATFORMS[C.platform] || PLATFORMS['yt.ad.15'], list = [];
  const tx = (k) => (C.transitions[k] || [])[0], why = (k) => (C.transitions[k] || [])[1];
  // HOOK: a strong image on frame 0 + the payoff line (multiple shots in the first 5 s: ABCD)
  list.push({ id: 'hook', sec: 'hook', kind: 'plate', media: C.hook.media, mediaStart: C.hook.mediaStart, text: C.hook.line, type: C.type.headline, dur: B.hook });
  const proof = C.proof.slice(0, (C.proofCount || {})[C.length] || C.proof.length);
  // PROBLEM: one pain, split over cards (one line per shot, ASL ~1.2 s)
  C.problem.lines.forEach((l, i) => list.push({ id: 'problem' + i, sec: 'problem', kind: i % 2 ? 'plate' : 'card', media: C.problem.media, mediaStart: C.problem.mediaStart + i, text: l, type: C.type.card, dur: B.problem / C.problem.lines.length, ...(i === 0 ? { tx: tx('hook>problem'), txReason: why('hook>problem') } : {}) }));
  // PRODUCT: the reveal holds (hero shot), then the benefit line
  list.push({ id: 'reveal', sec: 'product', kind: 'reveal', hold: true, media: C.product.media, mediaStart: C.product.mediaStart, text: C.product.name, type: C.type.headline, dur: B.product * 0.55, tx: tx('problem>product'), txReason: why('problem>product') });
  list.push({ id: 'benefit', sec: 'product', kind: 'card', text: C.product.line, type: C.type.card, dur: B.product * 0.45 });
  proof.forEach((p, i) => list.push({ id: 'proof' + i, sec: 'proof', kind: 'proof', text: p.text, type: C.type.card, dur: B.proof / proof.length, ...(i === 0 ? { tx: tx('product>proof'), txReason: why('product>proof') } : {}) }));
  list.push({ id: 'cta', sec: 'cta', kind: 'end', hold: true, text: C.brand.cta, type: C.type.end, dur: B.cta, tx: tx('proof>cta'), txReason: why('proof>cta') });
  // coverage cuts: a long plate shot becomes n cuts of the same plate at new frames (the text stays on the first; ASL target from edit.md 4)
  const cut = []; for (const s of list) { const n = s.kind === 'plate' ? Math.ceil(s.dur / C.plateAsl - 1e-9) : 1;
    for (let j = 0; j < n; j++) cut.push(j ? { ...s, id: s.id + '_' + j, text: '', tx: 'transitions/cut', txReason: undefined, mediaStart: +(s.mediaStart - 0.7 * j >= 0 ? s.mediaStart - 0.7 * j : s.mediaStart + 0.7 * j).toFixed(3), dur: s.dur / n } : { ...s, dur: s.dur / n, textDur: s.dur }); }
  const { shots, cues, seconds } = sequence(cut, C.fps);
  // SFX: an audible event in the first 3 frames, a pop on every card line, a riser into the reveal, a hit on it, the sting on the end card
  cues.push({ id: C.sfx.firstFrame, t: 0, gainDb: -2, why: 'first-frame hook' });
  shots.filter((s) => s.kind === 'card' || s.kind === 'proof').forEach((s) => cues.push({ id: C.sfx.card, t: s.start + 2 / C.fps, gainDb: -8, why: 'card line' }));
  const rv = shots.find((s) => s.id === 'reveal'); cues.push({ id: C.sfx.riser, t: rv.start, gainDb: -6, why: 'riser ends on the reveal' }, { id: C.sfx.reveal, t: rv.start, gainDb: -3, why: 'reveal hit' });
  const end = shots.find((s) => s.id === 'cta'); cues.push({ id: C.sfx.sting, t: end.start + 4 / C.fps, gainDb: -3, why: 'sonic sting' });
  if (C.sfx.bed) cues.push({ id: C.sfx.bed, t: 0, gainDb: -22, why: 'air bed (loop)', loopTo: seconds });
  for (const c of C.extraCues || []) cues.push({ gainDb: -6, ...c });   // BREWLY: story foley from CONFIG.extraCues
  const brandAt = shots.find((s) => s.kind === 'reveal').start;
  return { template: 'ad', fps: C.fps, seconds, platform: C.platform, safe: P.safe, brandCueAt: brandAt, brandCueOk: brandAt <= P.brandCueBy, shots, cues: cues.sort((a, b) => a.t - b.t), claims: proof, music: C.music, paceRule: { aslMax: 2.5, longMax: 4.5 } };
}
