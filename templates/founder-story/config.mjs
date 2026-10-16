/* TEMPLATE founder-story: a personal-brand story told by the founder, 16:9 (YouTube, LinkedIn, the site) with a 9:16 re-layout.
   Shape: the talking head carries it (breath-keeping autocut, alternating framing); your own PHOTOS come in as Ken Burns inserts on the words that name them; a timeline of
   YEARS steps with the story; ONE quote pull-out of the speaker's OWN words (the build fails if the quote is not a verbatim run of the transcript: no paraphrase, no invented
   line); the end is a brand field with the call to action.
   INPUT (yours): media.talk.src = your talking-head clip, media.photos[i].src = your photos (any aspect; Ken Burns pans inside them), voice.words = the transcript,
   text.years = your own dates (each one is a claim: give its source, e.g. "company registration record").
   DEMO (no footage, no people): a labelled silhouette, labelled photo cards ("YOUR PHOTO HERE: the spare room"), a guide signal at the hand-timed words of transcript.example.srt,
   example years printed with "example years · placeholder data", a fictional brand ("Orbit"). */
import path from 'node:path';
import { aspectOf, atOf, fixSets, quoteCheck } from '../_shared/human/core.mjs';
import { punchPlan, pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { loadWords, emphasize, cuesFor, audioFields, tagOf, talkTrack, talkSlots, structureOf, textOf } from '../_shared/human/kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit', accent: '#4A18ED', ink: '#FFFFFF', paper: '#F5F2EA', logo: null, url: 'orbit.example', cta: 'Come and see', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],
  text: {
    name: 'Founder name', role: 'Founder, Orbit · placeholder',
    years: [ { y: '2019', label: 'a spare room' }, { y: '2021', label: 'rebuilt, twice' }, { y: '2024', label: 'a small team' } ], yearsAt: [ { word: 'started' }, { word: 'rebuilt' }, { word: 'Today' } ], yearsNote: 'example years · placeholder data',
    quote: 'it still starts with listening', cta: 'Come and see',   // the end card echoes the spoken ask; at most 4 words with the brand (it must read at <= 1.5 words/s)
  },
  media: {
    talk: { src: null, start: 0, label: 'founder talking head' },
    photos: [ { src: null, label: 'the spare room', at: { word: 'room,' }, dur: 2.0, from: [1.0, 0.4, 0.5], to: [1.14, 0.6, 0.45] },
              { src: null, label: 'the first version on a laptop', at: { word: 'version?' }, dur: 2.0, from: [1.12, 0.6, 0.5], to: [1.0, 0.45, 0.5] },
              { src: null, label: 'the team at work', at: { word: 'watched' }, dur: 2.2, from: [1.0, 0.5, 0.6], to: [1.16, 0.5, 0.4] } ],
  },
  voice: { words: 'words.json', chain: true, placeholder: 'guide', breaths: null },
  autocut: { on: true, silenceMin: 0.5, padBefore: 0.06, padAfter: 0.09, breath: 0.12, beatHold: 0.45 },
  fillers: { cut: 'hard' },
  framing: { ladder: { '16:9': [1.0, 1.1, 1.0, 1.16], '9:16': [1.0, 1.12, 1.0, 1.2] }, anchor: { '16:9': [0.5, 0.38], '9:16': [0.5, 0.34] }, punch: 1.07, minGap: 4.5 },
  lowerThird: { part: 'lowerThird.accentRule', at: 0.5, dur: 2.6 },
  timeline: { dur: 1.4 },                        // seconds each year holds before the next step (the part spans all steps)
  quoteAt: { word: 'listening.', nth: 1, offset: 0.25 }, quoteDur: 2.6,
  captions: { style: 'brand', emph: ['spare', 'twice.', 'listening.', 'team,'] },
  end: { holdS: 3.2 },
  /* the story beats on the words that start them (patterns/structures.json founder-story): the opening line, the why, the problem, the chapter that changed it, the ask */
  beats: [ ['hook', 0], ['why', { word: 'with' }], ['problem', { word: 'The' }], ['chapter', { word: 'What' }], ['ask', { word: 'If' }] ],
  claims: [ { text: '2019', source: 'placeholder data: replace with your own date and where it is recorded' }, { text: '2021', source: 'placeholder data: replace with your own date and where it is recorded' },
            { text: '2024', source: 'placeholder data: replace with your own date and where it is recorded' } ],
  music: 'music/bed_documentary_marimba_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0,
  layers: [ { kind: 'vignette', params: { amount: 0.07 } }, { kind: 'grain', params: { stock: 'film35', amount: 0.5 } } ],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.name': 'text.name', 'text.role': 'text.role', 'text.quote': 'text.quote', 'text.cta': 'text.cta', 'media.speaker': 'media.talk', 'media.talk': 'media.talk', 'media.photos': 'media.photos', 'voice.words': 'voice.words', music: 'music', aspects: 'aspects' };

const LAYOUT = {
  '16:9': { full: [0, 0, 1920, 1080], photo: [0, 0, 1920, 1080], photoInner: [1920, 1440], ltPos: 'bl', timeline: [0.1, 0.62, 0.8, 0.2], quotePos: 'c', capBand: 'lower' },
  '9:16': { full: [0, 0, 1080, 1920], photo: [0, 0, 1080, 1920], photoInner: [1440, 1920], ltPos: [0.06, 0.52], timeline: [0.12, 0.4, 0.76, 0.16], quotePos: 'c', capBand: 'mid' },
};

/* the speaker's-own-words gate, run by make.mjs BEFORE anything is built (exit 2 naming the problem); buildPlan throws on the same problem */
export function gateProblems(C0) { const C = fixSets(structuredClone(C0)); try { const raw = loadWords(HERE, C.voice.words), tr = talkTrack(raw, { fps: C.fps, autocut: C.autocut, fillers: C.fillers }), q = quoteCheck(C.text.quote, tr.words); return q.ok ? [] : ['text.quote: ' + q.why]; } catch (e) { return [e.message]; } }
export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), r3 = (x) => +(+x).toFixed(3), warnings = [];
  const raw = emphasize(loadWords(HERE, C.voice.words), C.captions.emph);
  const tr = talkTrack(raw, { fps, autocut: C.autocut, fillers: C.fillers, breaths: C.voice.breaths || [] }), words = tr.words, talkEnd = tr.seconds, T = +(talkEnd + C.end.holdS).toFixed(4), at = (s) => atOf(s, words);
  /* THE QUOTE GATE: the speaker's own words only */
  const qc = quoteCheck(C.text.quote, words); if (!qc.ok) throw new Error('founder-story quote gate: ' + qc.why);
  const P = punchPlan(tr.segs, words, { ladder: C.framing.ladder[C.aspect], scale: C.framing.punch, minGap: C.framing.minGap });
  const cam = { kind: 'frame', plan: P, anchor: C.framing.anchor[C.aspect] }, talkPh = { label: 'SPEAKER PLACEHOLDER', slot: 'talk', name: C.text.name, tint: '#33302B', seed: 9, chipPos: C.aspect === '9:16' ? 'bl' : 'tr' };
  const slots = talkSlots(tr.segs, { src: C.media.talk.src, srcStart: C.media.talk.start, rect: L.full, cam, ph: talkPh });
  slots.push({ id: 'talk-end', kind: 'speaker', src: C.media.talk.src, mediaStart: +(C.media.talk.start + tr.segs.at(-1).src_out - 0.04).toFixed(4), start: talkEnd, end: T, rect: L.full, ph: talkPh });
  /* photos with Ken Burns: [scale, focus x, focus y] from -> to over the insert */
  const photos = C.media.photos.map((p, i) => { const a = r3(Math.max(0.6, at(p.at) - 0.15)), b = r3(Math.min(talkEnd - 0.3, a + p.dur)); return { ...p, a, b, i }; });
  photos.forEach((p, k) => { if (k && p.a < photos[k - 1].b + 0.6) warnings.push(`photo ${k} starts ${r3(p.a - photos[k - 1].b)} s after the previous one: give the face a beat between inserts`); });
  for (const p of photos) slots.push({ id: 'photo' + p.i, kind: 'photo', src: p.src, mediaStart: 0, start: p.a, end: p.b, rect: L.photo, inner: L.photoInner, fit: 'cover', z: 10 + p.i,
    cam: { kind: 'ken', from: p.from, to: p.to, t0: p.a, t1: p.b }, vis: { kind: 'fade', in: 0.12, out: 0.12 }, phLabel: ['YOUR PHOTO HERE', p.label], phLabelPos: C.aspect === '9:16' ? 'tl' : 'tl',
    ph: { chip: false, label: 'YOUR PHOTO HERE', what: p.label, slot: `photos.${p.i}`, seed: 21 + p.i, tint: ['#C9B79C', '#A9B7C2', '#B9C4A8'][p.i % 3] } });
  if (C.aspect === '9:16') for (const s of slots) if (s.phLabel) s.phLabelPos = 'tl';
  /* gfx: the name super, the year timeline, the quote pull-out */
  const gfx = [ { id: C.lowerThird.part, at: C.lowerThird.at, dur: C.lowerThird.dur, params: { name: C.text.name, role: C.text.role, pos: L.ltPos, accent: C.brand.accent } } ];
  const yAt = C.text.yearsAt.map((s) => r3(at(s))), y0 = yAt[0];
  const top = [ { id: 'title.yearTimeline', at: y0, dur: r3(yAt.at(-1) - y0 + C.timeline.dur), params: { years: C.text.years, steps: yAt.map((t) => r3(t - y0)), note: C.text.yearsNote, box: L.timeline, accent: C.brand.accent } } ];
  const qa = r3(at(C.quoteAt)); top.push({ id: 'caption.pullQuote', at: qa, dur: C.quoteDur, params: { quote: C.text.quote, speaker: C.text.name, pos: L.quotePos, accent: C.brand.accent } });
  const layers = [ ...C.layers, { kind: 'brandField', params: { at: r3(talkEnd + 0.15), color: C.brand.accent, ink: C.brand.ink, name: C.brand.name, line: C.text.cta, mark: 'orbit', reveal: 'wipe' } } ];
  const pick = pickCaption(C.captions.style, { aspect: C.aspect, brand: C.brand, band: L.capBand }), cap = captionTrack(words.filter((w) => !(w.os >= qa && w.os < qa + C.quoteDur)), pick);   // no captions under the quote card: it IS the caption
  for (const x of [...pick.lint, ...cap.lint]) warnings.push('captions: ' + x);
  const cues = [ ...cuesFor([...gfx, ...top], { overVoDb: -14 }), ...P.punches.map((p) => ({ id: 'sfx/tx/scale_punch', t: p.t, why: `punch-in on "${p.word}"`, overVoDb: -18 })),
    ...photos.map((p) => ({ id: 'sfx/camera/shutter', t: p.a, why: 'photo insert: ' + p.label, overVoDb: -16 })), { id: 'sfx/logo/two_note', t: r3(talkEnd + 0.15), why: 'brand field end card' } ].sort((a, b) => a.t - b.t);
  const voice = { fps, placeholder: C.voice.placeholder, sources: { talk: { src: C.media.talk.src, chain: C.voice.chain } },
    segments: tr.segs.map((g) => ({ source: 'talk', src_in: +(C.media.talk.start + g.src_in).toFixed(4), src_out: +(C.media.talk.start + g.src_out).toFixed(4), start: g.start, speaker: 'A', words: tr.srcWords.filter((w) => !w.cut && w.e > g.src_in && w.s < g.src_out).map((w) => [w.s + C.media.talk.start, w.e + C.media.talk.start]) })) };
  const marks = [...new Set([0, ...tr.segs.map((g) => g.start), ...photos.flatMap((p) => [p.a, p.b]), talkEnd, T])].sort((a, b) => a - b);
  const shots = marks.slice(0, -1).map((a, i) => ({ id: 'shot' + i, start: r3(a), dur: r3(marks[i + 1] - a), ...(a >= talkEnd ? { hold: true } : {}) })).filter((s) => s.dur > 0.001);
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: '#0B0D12', platform: A.safe, slots, gfx, gfxTop: top, captions: { chunks: cap.chunks, style: pick.style, box: pick.box },
    speaking: Object.fromEntries(slots.filter((s) => s.kind === 'speaker').map((s) => [s.id, words.map((w) => [w.os, w.oe])])) };
  const structure = structureOf(C.beats.map(([n, w]) => [n, typeof w === 'number' ? w : r3(Math.max(0, at(w) - 0.06))]), T);
  const texts = [textOf(C.text.name + ' ' + C.text.role, C.lowerThird.at + 0.6, C.lowerThird.dur, 'lowerthird'), textOf(C.text.quote, qa, C.quoteDur, 'quote'), textOf(C.brand.name + ' ' + C.text.cta, r3(talkEnd + 0.15), r3(T - talkEnd - 0.15), 'cta')];
  return { template: 'founder-story', aspect: C.aspect, structure, texts, fps, seconds: T, size: [A.W, A.H], scene, voice, cues, shots, claims: C.claims, transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe })),
    quote: { text: C.text.quote, verbatim: true, words: [qc.i0, qc.i1], s: qc.s, e: qc.e }, edit: { cuts: tr.cuts, fillers: tr.fillers, punches: P.punches, photos: photos.map((p) => ({ label: p.label, a: p.a, b: p.b })) },
    layers, captionStyle: pick.name, ...audioFields(C, tag, { role: 'vo_doc', quiet: [] }), paceRule: { aslMax: 3.5, longMax: 5 }, warnings };
}
