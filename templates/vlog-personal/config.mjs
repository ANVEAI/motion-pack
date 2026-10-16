/* TEMPLATE vlog-personal: a talking head + B-roll inserts for a personal vlog, 9:16 first (Shorts / Reels) and re-laid out for 16:9.
   Layer order (fixed): 1 silence autocut that keeps breaths + the fillers you chose to cut  2 the punch-in planner (framing alternates on every jump cut, punch-ins on emphasis words)
   3 a location / date card at the open  4 B-roll inserts from keywords (slots you fill) with J / L split edits on their own sound  5 a map route insert  6 sticker reactions on trigger words
   7 captions with emphasis words  8 a music bed ducked under the voice  9 a follow CTA.
   9:16: every insert is a full-frame cutaway. 16:9: inserts alternate a cutaway with a SPLIT-SCREEN REACTION layout (the clip on the right, you on the left), a re-layout, not a crop.
   INPUT (yours): media.talk.src = your talking-head clip (its audio is the voice), media.broll.<keyword>.src = your B-roll clips, voice.words = the transcript (words.json / .srt / .vtt).
   DEMO (no footage, no people): a labelled silhouette, labelled B-roll cards ("YOUR B-ROLL HERE: coffee"), a guide signal at the hand-timed words of transcript.example.srt,
   pack ambience as the placeholder sound of each insert, a fictional place ("Placeholder Harbour"); the map distance prints "source: placeholder data". */
import path from 'node:path';
import { aspectOf, atOf, fixSets, safeBox } from '../_shared/human/core.mjs';
import { punchPlan, brollSlots, reactionsFromWords, jlWindows, pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { loadWords, emphasize, cuesFor, audioFields, tagOf, talkTrack, talkSlots, structureOf, textOf } from '../_shared/human/kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Your name', accent: '#FF4F7B', ink: '#111111', paper: '#FFFFFF', logo: null, url: '@yourhandle', cta: 'Follow', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'reels', fps: 30, length: 'auto', aspect: '9:16', aspects: ['9:16', '16:9'],
  text: { place: 'Placeholder Harbour', date: 'Sunday, early', kicker: 'Day one', route: { from: 'Bridge cart', to: 'Market', km: 1.2, source: 'placeholder data' }, follow: 'Follow', following: 'Following' },
  media: {
    talk: { src: null, start: 0, label: 'talking head', name: 'You' },
    broll: { coffee: { src: null, start: 0, label: 'coffee cart close-up', nat: true, amb: 'sfx/amb/city' },
             boats: { src: null, start: 0, label: 'boats at the quay', nat: true, amb: 'sfx/amb/crowd_murmur' } },
  },
  voice: { words: 'words.json', chain: true, placeholder: 'guide', breaths: null },   // breaths: a breaths.json from tools/human/breaths.py (kept whole by the autocut)
  autocut: { on: true, silenceMin: 0.5, padBefore: 0.06, padAfter: 0.09, breath: 0.12, beatHold: 0.45 },
  fillers: { cut: 'hard' },                      // 'none' | 'hard' (um, uh) | 'all' (also you know, I mean): node tools/human/human.mjs fillers words.json lists them first
  framing: { ladder: { '9:16': [1.0, 1.12, 1.0, 1.2], '16:9': [1.0, 1.1, 1.0, 1.16] }, anchor: { '9:16': [0.5, 0.34], '16:9': [0.5, 0.4] }, punch: 1.08, minGap: 4.0 },
  broll: { keywords: [ { word: 'coffee', key: 'coffee', dur: 1.8 }, { word: 'boats', key: 'boats', dur: 2.2 } ], auto: false, coverage: 0.4, lead: 0.15,
           layout16: ['cutaway', 'split'] },   // 16:9 only: per insert, 'cutaway' (full frame) or 'split' (the reaction layout)
  jl: { jMs: 300, lMs: 450, gainDb: -16 },       // J: the insert's sound starts 300 ms before its picture; L: it runs 450 ms after
  map: { at: { word: 'walked', offset: -0.25 }, dur: 1.3, draw: 0.85 },   // the walk to the market IS the map insert
  reactions: [ { match: 'coffee', sticker: 'chai' }, { match: 'loud', sticker: 'megaphone' }, { match: 'favourite', sticker: 'heart' } ],
  captions: { style: 'emphasis', override: { emphScale: 1.05 }, emph: ['asleep.', 'coffee', 'loud,', 'favourite'] },
  end: { holdS: 3.2 },                           // the sign-off (last line + follow card) holds >= 5 s
  /* the story beats, on the words that start them (patterns/structures.json vlog): cold open, setup, journey, the peak, the change, the sign-off */
  beats: [ ['coldopen', 0], ['setup', { word: 'First' }], ['journey', { word: 'Then' }], ['cost', { word: 'and', nth: 1 }], ['change', { word: 'This' }], ['signoff', { word: 'Same' }] ],
  claims: [ { text: '1.2 km', source: 'placeholder data: measure your own route and name the map or app it came from' } ],
  music: 'music/bed_acoustic_folk_pluck_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0,
  layers: [ { kind: 'vignette', params: { amount: 0.08 } }, { kind: 'grain', params: { stock: 'upload-safe' } } ],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.place': 'text.place', 'text.date': 'text.date', 'text.kicker': 'text.kicker', 'media.speaker': 'media.talk', 'media.talk': 'media.talk', 'media.broll': 'media.broll', 'voice.words': 'voice.words', music: 'music', aspects: 'aspects' };

const LAYOUT = {
  '9:16': { full: [0, 0, 1080, 1920], split: null, cardPos: 'tl', capBand: 'mid', stickerAt: [0.66, 0.24], followPos: 'bc' },
  '16:9': { full: [0, 0, 1920, 1080], split: { you: [0, 0, 960, 1080], clip: [960, 0, 960, 1080] }, cardPos: 'tl', capBand: 'lower', stickerAt: [0.74, 0.18], followPos: 'bc' },
};

export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['9:16'], fps = C.fps, tag = tagOf(C.aspect, '9:16'), r3 = (x) => +(+x).toFixed(3), warnings = [];
  const raw = emphasize(loadWords(HERE, C.voice.words), C.captions.emph), breaths = C.voice.breaths ? JSON.parse(JSON.stringify(C.voice.breaths)) : [];
  const tr = talkTrack(raw, { fps, autocut: C.autocut, fillers: C.fillers, breaths }), words = tr.words, talkEnd = tr.seconds, T = +(talkEnd + C.end.holdS).toFixed(4);
  const at = (spec) => atOf(spec, words);
  /* framing: alternate on every jump cut, punch on emphasis */
  const P = punchPlan(tr.segs, words, { ladder: C.framing.ladder[C.aspect], scale: C.framing.punch, minGap: C.framing.minGap });
  const cam = { kind: 'frame', plan: P, anchor: C.framing.anchor[C.aspect] }, talkPh = { label: 'SPEAKER PLACEHOLDER', slot: 'talk', name: C.media.talk.name, tint: '#3A3328', seed: 5, chipPos: C.aspect === '9:16' ? 'bl' : 'tr' };
  const slots = talkSlots(tr.segs, { src: C.media.talk.src, srcStart: C.media.talk.start, rect: L.full, cam, ph: talkPh });
  /* the end hold: the last frame of you, still (a freeze would need the real picture; the placeholder plate simply continues) */
  slots.push({ id: 'talk-end', kind: 'speaker', src: C.media.talk.src, mediaStart: +(C.media.talk.start + tr.segs.at(-1).src_out - 0.04).toFixed(4), start: talkEnd, end: T, rect: L.full, cam: { kind: 'frame', plan: { frames: [{ t0: 0, t1: 9999, scale: 1 }], punches: [] }, anchor: cam.anchor }, ph: talkPh });
  /* B-roll slots from keywords (you fill them); J / L split edits on their own sound */
  const B = brollSlots(words, { keywords: C.broll.keywords.map((k) => ({ ...k, src: C.media.broll[k.key]?.src ?? null, label: C.media.broll[k.key]?.label, nat: C.media.broll[k.key]?.nat, mediaStart: C.media.broll[k.key]?.start || 0 })), auto: C.broll.auto, coverage: C.broll.coverage, lead: C.broll.lead, seconds: talkEnd, firstAt: 1.6 });
  B.slots.forEach((b, i) => { const key = C.broll.keywords.find((k) => b.word.toLowerCase().startsWith(k.word.replace(/[.,]$/, '').toLowerCase()))?.key; b.key = key; });
  const layout16 = C.broll.layout16 || [];
  B.slots.forEach((b, i) => {
    const split = C.aspect === '16:9' && layout16[i] === 'split' && L.split, m = C.media.broll[b.key] || {};
    slots.push({ id: b.id, kind: 'broll', src: b.src, mediaStart: m.start || 0, start: b.at, end: r3(b.at + b.dur), rect: split ? L.split.clip : L.full, z: 10 + i, vis: { kind: 'fade', in: 0.08, out: 0.08 },
      ph: { label: 'YOUR B-ROLL HERE', what: m.label || b.label, slot: 'broll.' + b.key, seed: 11 + i, tint: ['#3E4A3C', '#4A3C3C', '#3C444A'][i % 3] } });
    if (split) slots.push(...talkSlots(tr.segs, { id: 'you-' + b.id, src: C.media.talk.src, srcStart: C.media.talk.start, rect: L.split.you, cam: { ...cam, anchor: [0.5, 0.38] }, ph: { ...talkPh, chipPos: 'bl' }, z: 10 + i, window: [b.at, b.at + b.dur], extra: { vis: { kind: 'fade', in: 0.08, out: 0.08 } } }));
  });
  const jl = jlWindows(B.slots, { jMs: C.jl.jMs, lMs: C.jl.lMs, seconds: talkEnd });
  /* gfx: location card, map insert, stickers, follow CTA */
  const gfx = [ { id: 'title.locationCard', at: 0.25, dur: 2.4, params: { place: C.text.place, date: C.text.date, kicker: C.text.kicker, pos: L.cardPos, accent: C.brand.accent } } ];
  const mapAt = r3(at(C.map.at)), top = [ { id: 'map.route', at: mapAt, dur: C.map.dur, params: { from: C.text.route.from, to: C.text.route.to, km: C.text.route.km, source: C.text.route.source, accent: C.brand.accent, dur: C.map.draw } } ];
  if (B.slots.some((b) => b.at < mapAt + C.map.dur + 0.62 && b.at + b.dur > mapAt)) warnings.push('the map insert overlaps a B-roll insert: move map.at');
  const stickers = reactionsFromWords(words, C.reactions, { minGap: 1.4 }).map((s) => ({ ...s, params: { ...s.params, at: L.stickerAt, size: 1.1 } }));
  top.push(...stickers, { id: 'social.followButton', at: r3(talkEnd + 0.1), dur: r3(C.end.holdS - 0.6), params: { label: C.text.follow, done: C.text.following, pos: L.followPos, accent: C.brand.accent, clickAt: 0.9 } });
  /* captions */
  const pick = pickCaption(C.captions.style, { aspect: C.aspect, brand: { ...C.brand, captionAccent: C.brand.accent }, band: L.capBand, style: C.captions.override || {} }), cap = captionTrack(words, pick);
  for (const x of [...pick.lint, ...cap.lint]) warnings.push('captions: ' + x);
  /* sound */
  const cues = [ ...cuesFor([...gfx, ...top], { overVoDb: -14 }), ...P.punches.map((p) => ({ id: 'sfx/tx/scale_punch', t: p.t, why: `punch-in on "${p.word}"`, overVoDb: -18 })),
    ...B.slots.map((b) => ({ id: 'sfx/whoosh/swish_xs', t: b.at, why: 'B-roll in: ' + b.word, overVoDb: -18 })) ].sort((a, b) => a.t - b.t);
  const nat = jl.map((w) => { const b = B.slots.find((x) => x.id === w.id), m = C.media.broll[b.key] || {}; return { source: 'broll.' + b.key, amb: m.amb, mediaStart: m.start || 0, audioIn: w.audioIn, audioOut: w.audioOut, pictureIn: w.pictureIn, gainDb: C.jl.gainDb }; });
  const sources = { talk: { src: C.media.talk.src, chain: C.voice.chain }, ...Object.fromEntries(Object.entries(C.media.broll).map(([k, v]) => ['broll.' + k, { src: v.src, chain: false }])) };
  const voice = { fps, placeholder: C.voice.placeholder, sources, nat,
    segments: tr.segs.map((g) => ({ source: 'talk', src_in: +(C.media.talk.start + g.src_in).toFixed(4), src_out: +(C.media.talk.start + g.src_out).toFixed(4), start: g.start, speaker: 'A', words: tr.srcWords.filter((w) => !w.cut && w.e > g.src_in && w.s < g.src_out).map((w) => [w.s + C.media.talk.start, w.e + C.media.talk.start]) })) };
  const marks = [...new Set([0, ...tr.segs.map((g) => g.start), ...B.slots.flatMap((b) => [b.at, r3(b.at + b.dur)]), mapAt, r3(mapAt + C.map.dur + 0.7), talkEnd, T])].filter((x) => x <= T).sort((a, b) => a - b);
  const shots = marks.slice(0, -1).map((a, i) => ({ id: 'cut' + i, start: a, dur: r3(marks[i + 1] - a), ...(a >= talkEnd ? { hold: true } : {}) })).filter((s) => s.dur > 0);
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: '#0B0D12', platform: A.safe, slots, gfx, gfxTop: top, captions: { chunks: cap.chunks, style: pick.style, box: pick.box },
    speaking: Object.fromEntries(slots.filter((s) => s.kind === 'speaker').map((s) => [s.id, words.map((w) => [w.os, w.oe])])) };
  const structure = structureOf(C.beats.map(([n, w]) => [n, typeof w === 'number' ? w : r3(Math.max(0, at(w) - 0.06))]), T);
  const texts = [textOf(C.text.place + ' ' + C.text.date, 0.25 + 16 / 30, 2.4, 'card'), textOf(C.text.follow, r3(talkEnd + 0.1), r3(C.end.holdS - 0.6), 'cta')];
  return { template: 'vlog-personal', aspect: C.aspect, structure, texts, fps, seconds: T, size: [A.W, A.H], scene, voice, cues, shots, claims: C.claims, transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe })),
    edit: { keep: tr.segs.map((g) => [g.src_in, g.src_out]), cuts: tr.cuts, fillers: tr.fillers, punches: P.punches, framing: P.rule, broll: B, jl }, captionStyle: pick.name,
    ...audioFields(C, tag, { role: 'vo_doc' }), paceRule: { aslMax: 3.5, longMax: 5.5 }, warnings };
}
