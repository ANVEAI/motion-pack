/* TEMPLATE ad: hook -> problem -> product -> proof -> CTA (docs/evidence/edit.md 4, ABCD-mapped), 15 s or 30 s, HyperFrames.
   Edit the CONFIG block only; `node make.mjs [--set length=30]` writes index.html + the SFX mix; then `hyperframes render`.
   DEMO CONTENT: "Orbit" is a FICTIONAL placeholder brand, and every line is placeholder copy. Proof lines carry no numbers on purpose:
   any claim with a digit must carry `source` or lint.proof fails the build (node make.mjs exits 2; `--allow-lint` waives it and the plan records the waiver). */
import { sequence, PLATFORMS } from '../_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 15,                      // 10 | 15 | 30 (section budgets from edit.md 4; 10 s is the short cut a style demo uses)
  aspect: '16:9',                  // '16:9' (the master) | '9:16' | '1:1' | '4:5': each a RE-LAYOUT inside that aspect's safe zone (_shared/relayout.mjs), never a crop
  platform: 'yt.ad.15',            // plan.mjs PLATFORMS: safe zones + brand-cue deadline (ABCD: brand within 5 s)
  fps: 30,
  brand: { name: 'Orbit', accent: '#4a18ed', ink: '#111111', paper: '#f5f2ea', url: 'orbit.example', cta: 'Try it on your desk', logo: null,
    muted: '#5d5850', font: { display: 'Manrope', text: 'Manrope' } },   // logo: path to YOUR mark (SVG/PNG) for the end card, or null; muted = the URL line; font: Manrope, IBM Plex Mono or STIX Two Text (bundled)
  hook: { archetype: 'payoff-first', line: 'Your desk, *handled*.', media: 'plate-devices.mp4', mediaStart: 2.2, label: 'your product in use', kicker: 'Placeholder brand' },   // kicker: with plates false, a label tab in the accent, on screen from frame 0 (frame 0 is never an empty card)   // media: a _shared/media plate name or an absolute path; null = a labelled placeholder
  problem: { lines: ['Five tabs.', 'Five *bills*.'], media: 'plate-film.mp4', mediaStart: 0.4, label: 'the problem, filmed' },
  product: { name: 'Orbit', line: 'One box does the *busywork*.', media: 'plate-film.mp4', mediaStart: 1.2, label: 'the product reveal' },
  proof: [ { text: 'Works with the tools you already use.' }, { text: 'Your files stay on your desk.' }, { text: 'Set up in one *afternoon*.' }, { text: 'Quiet. No new tabs.' } ],   // a digit needs { source }
  proofCount: { 10: 1, 15: 2, 30: 4 },    // how many proof lines each length uses (>= 1.5 s per line to read)
  textCase: 'as-written',          // 'as-written' | 'upper': upper-case headlines, cards and the end-card name (a style's type.case)
  plates: true,                    // false: the hook, problem and reveal shots are type cards on the paper (no plate footage): an all-type film, as the style demos use
  plateAsl: 2.2,                   // plate shots longer than this are split into coverage cuts (new frames of the same plate)
  transitions: {                   // boundary between sections: id + the REASON (lint refuses unmotivated transitions: make.mjs exits 2)
    'hook>problem': ['transitions/smash', 'EMOTION: payoff -> pain'],
    'problem>product': ['transitions/whip', 'ENERGY: tension released into the reveal'],
    'product>proof': ['transitions/push', 'STORY: reveal -> evidence'],
    'proof>cta': ['transitions/dip-to-black', 'RHYTHM: settle before the ask'],
  },
  type: { headline: 'type/scaleSlam', card: 'type/maskRise', end: 'type/elasticPop', sub: 'type/blurIn' },   // type module presets (motion-pack/type/presets.js)
  layers: [ { kind: 'vignette', params: {} }, { kind: 'grain', params: { stock: 'digital-soft' } } ],   // layers module overlay kinds
  sfx: { firstFrame: 'sfx/hit/punch', card: 'sfx/ui/pop', riser: 'sfx/riser/noise_1bar', reveal: 'sfx/hit/cinema', sting: 'sfx/logo/two_note', bed: 'sfx/amb/studio_air' },   // bed = used only when music is null
  music: 'music/bed_tech_pulse_loop8',   // music module bed id (music/manifest.json); null = SFX-only mix. The mixer solves cue levels over it
};
/* ============================================================================== */

/* the shared project file (templates/_shared/project.schema.json) -> this CONFIG. `mp list ad` prints it; `node make.mjs --project p.json [--aspect 9:16]` applies it */
export const PROJECT_MAP = {
  'brand.name': ['brand.name', 'product.name'], 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper',
  'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.logo': 'brand.logo', 'brand.muted': 'brand.muted', 'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text',
  'text.headline': 'hook.line', 'text.kicker': 'hook.kicker', 'text.problem': { to: 'problem.lines', list: true }, 'text.product': 'product.line',
  'media.hook.src': 'hook.media', 'media.hook.start': 'hook.mediaStart', 'media.hook.label': 'hook.label',
  'media.problem.src': 'problem.media', 'media.problem.start': 'problem.mediaStart', 'media.problem.label': 'problem.label',
  'media.product.src': 'product.media', 'media.product.start': 'product.mediaStart', 'media.product.label': 'product.label',
  // claims without a `key` are the proof lines (a digit needs its source, lint.proof); claims with a key back other copy and are not shown twice
  'claims': { to: 'proof', fn: (cs, ctx) => { const p = cs.filter((c) => !c.key).map((c) => (c.source ? { text: c.text, source: c.source } : { text: c.text })); if (!p.length) { ctx.warn('claims: no un-keyed claim, so the ad keeps its placeholder proof lines'); return undefined; } return p; } },
  'music': 'music', 'length': 'length', 'platform': 'platform', 'aspect': 'aspect',
};
/* aspects: 16:9 is the master; the others are the generic card re-layout (_shared/relayout.mjs: type refit into the aspect's safe rect, plates re-framed by object-position) */
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'relayout' }, '1:1': { how: 'relayout' }, '4:5': { how: 'relayout' } };
const ASPECT_PLATFORM = { '16:9': 'yt.ad.15', '9:16': 'meta.ad.9x16', '1:1': 'linkedin.video', '4:5': 'linkedin.video' }, SHAPE = { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'square' };   // 4:5 has no preset of its own: it takes linkedin.video's safe fractions (eyes: linkedin.video takes 1:1, 4:5, 16:9)
const SIZE = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

const BUDGET = { 10: { hook: 2.0, problem: 2.0, product: 3.0, proof: 1.4, cta: 1.8 }, 15: { hook: 2.5, problem: 2.5, product: 4.0, proof: 3.5, cta: 2.5 }, 30: { hook: 3, problem: 5, product: 8, proof: 9, cta: 5 } };
export function buildPlan(C) {
  const aspect = C.aspect || '16:9', platform = PLATFORMS[C.platform] && PLATFORMS[C.platform].aspect === SHAPE[aspect] ? C.platform : ASPECT_PLATFORM[aspect];   // a 16:9 platform preset never sets a 9:16 safe zone
  if (!SHAPE[aspect]) throw new Error(`ad: aspect ${aspect} is not one of ${Object.keys(SHAPE).join(', ')}`);
  const B = BUDGET[C.length] || BUDGET[15], P = PLATFORMS[platform] || PLATFORMS['yt.ad.15'], list = [];
  const ph = (sec) => (C[sec].media == null ? { placeholder: C[sec].label || 'your footage' } : {});   // a null media slot renders a labelled placeholder card
  const typeOnly = C.plates === false;   // an all-type film: plate and reveal shots become cards on the paper (make.mjs draws them as cards)
  const tx = (k) => (C.transitions[k] || [])[0], why = (k) => (C.transitions[k] || [])[1];
  // HOOK: a strong image on frame 0 + the payoff line (multiple shots in the first 5 s: ABCD)
  list.push(typeOnly ? { id: 'hook', sec: 'hook', kind: 'card', text: C.hook.line, type: C.type.headline, dur: B.hook }
    : { id: 'hook', sec: 'hook', kind: 'plate', media: C.hook.media, mediaStart: C.hook.mediaStart, text: C.hook.line, type: C.type.headline, dur: B.hook, ...ph('hook') });
  const proof = C.proof.slice(0, (C.proofCount || {})[C.length] || C.proof.length);
  // PROBLEM: one pain, split over cards (one line per shot, ASL ~1.2 s)
  C.problem.lines.forEach((l, i) => list.push({ id: 'problem' + i, sec: 'problem', kind: i % 2 && !typeOnly ? 'plate' : 'card', ...(typeOnly ? {} : { media: C.problem.media, mediaStart: C.problem.mediaStart + i }), text: l, type: C.type.card, dur: B.problem / C.problem.lines.length, ...(i % 2 && !typeOnly ? ph('problem') : {}), ...(i === 0 ? { tx: tx('hook>problem'), txReason: why('hook>problem') } : {}) }));
  // PRODUCT: the reveal holds (hero shot), then the benefit line
  list.push({ id: 'reveal', sec: 'product', kind: 'reveal', hold: true, ...(typeOnly ? {} : { media: C.product.media, mediaStart: C.product.mediaStart, ...ph('product') }), text: C.product.name, type: C.type.headline, dur: B.product * 0.55, tx: tx('problem>product'), txReason: why('problem>product') });
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
  const brandAt = shots.find((s) => s.kind === 'reveal').start;
  return { template: 'ad', fps: C.fps, seconds, platform, safe: P.safe, ...(aspect !== '16:9' ? { aspect, size: SIZE[aspect] } : {}), brandCueAt: brandAt, brandCueOk: brandAt <= P.brandCueBy, shots, cues: cues.sort((a, b) => a.t - b.t), claims: proof, music: C.music, paceRule: { aslMax: 2.5, longMax: 4.5 } };
}
