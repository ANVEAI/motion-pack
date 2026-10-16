/* TEMPLATE course-lesson: one lesson of a course, 16:9 (the course page, YouTube) with a 9:16 re-layout for a lesson teaser.
   Sections, each with its own layout, cut on the words that start them: 'presenter' (you, full frame), 'slide' (the slide, you in a PiP), 'split' (slide and you side by side;
   stacked on 9:16), 'quiz' (a quiz card: the question, a PAUSE the viewer answers in, then the answer lights up), 'recap' (recap card). A lesson progress bar runs across the top
   with a tick at every section; slides are drawn from YOUR text (CONFIG.text.slides) or are your own images (media.slides[i].src).
   INPUT (yours): media.presenter.src = your recording, voice.words = its transcript, text.slides = the slide copy, text.quiz = the question, options and answer.
   DEMO (no footage, no people): a labelled silhouette presenter, a guide signal at the hand-timed words of transcript.example.srt, example lesson copy (fictional). */
import path from 'node:path';
import { aspectOf, atOf, fixSets, bare } from '../_shared/human/core.mjs';
import { pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { loadWords, emphasize, cuesFor, audioFields, tagOf, talkTrack, talkSlots, structureOf, textOf } from '../_shared/human/kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit Academy', accent: '#0F7A6B', ink: '#16151B', paper: '#FBFAF7', logo: null, url: 'orbit.example/learn', cta: 'Next lesson', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],
  text: {
    title: 'Where your files really live', kicker: 'Example lesson',
    slides: [ { title: 'On your laptop', bullets: ['One place', 'You can see it', 'You can lose it'], at: [{ word: 'place.' }, { word: 'see' }, { word: 'lose' }] },
              { title: 'In the cloud', bullets: ["Someone else's computer", 'Copied for safety'], at: [{ word: 'someone' }, { word: 'copied' }] } ],
    quiz: { q: 'Which one keeps the file only on your desk?', options: ['The cloud', 'Your laptop', 'Both of them'], answer: 1 },
    recap: { title: 'Recap', items: ['Local: one place', 'Cloud: many copies', 'You choose the trade'] },
  },
  /* beat = the section's name in the explainer pattern (patterns/structures.json: question, wrong model, reframe, proof, so-what; a lesson has no pattern of its own yet):
     the two models are the set-up, the difference is the reframe, the quiz is the worked example, the recap is the takeaway */
  sections: [ { kind: 'presenter', at: 0, title: 'Intro', beat: 'question' },
              { kind: 'slide', slide: 0, at: { word: 'On', offset: -0.15 }, title: 'Laptop', beat: 'setup' },
              { kind: 'split', slide: 1, at: { word: 'In', offset: -0.15 }, title: 'Cloud', beat: 'context' },
              { kind: 'presenter', at: { word: 'So', offset: -0.15 }, title: 'The difference', beat: 'reframe' },
              { kind: 'quiz', at: { word: 'Quick', offset: -0.1 }, reveal: { word: 'Right:' }, pause: 2.3, title: 'Quick check', beat: 'example' },
              { kind: 'recap', at: { word: 'Recap:', offset: -0.1 }, title: 'Recap', beat: 'takeaway' } ],
  media: { presenter: { src: null, start: 0, label: 'presenter camera', name: 'Teacher' }, slides: [ { src: null }, { src: null } ] },   // a slide src (image) replaces the drawn slide
  voice: { words: 'words.json', chain: true, placeholder: 'guide' },
  autocut: { on: true, silenceMin: 0.55, padBefore: 0.06, padAfter: 0.09, breath: 0.12, beatHold: 0.45 },
  fillers: { cut: 'hard' },
  captions: { style: { '16:9': 'doc', '9:16': 'karaoke' }, emph: ['laptop,', 'cloud,', 'control,', 'rent.'] },
  end: { holdS: 3.0 },                           // the recap card reads at <= 2 words/s
  claims: [],
  music: 'music/bed_corporate_bright_loop8', musicGainDb: -3, duckDb: 12, ceilingDb: -2.0,
  layers: [ { kind: 'vignette', params: { amount: 0.04 } }, { kind: 'grain', params: { stock: 'upload-safe' } } ],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.title', 'text.kicker': 'text.kicker', 'text.slides': 'text.slides', 'media.speaker': 'media.presenter', 'media.presenter': 'media.presenter', 'media.slides': 'media.slides', 'voice.words': 'voice.words', music: 'music', aspects: 'aspects' };

const LAYOUT = {
  '16:9': { presenter: { you: [0, 0, 1920, 1080] }, slide: { slide: [0, 0, 1920, 1080], you: [1556, 686, 300, 300], youCircle: true }, split: { slide: [0, 0, 1180, 1080], you: [1180, 0, 740, 1080] },
            quiz: { bg: [0, 0, 1920, 1080] }, capBox: null, capBand: 'lower', titlePos: 'tl' },
  '9:16': { presenter: { you: [0, 0, 1080, 1920] }, slide: { slide: [0, 0, 1080, 1180], you: [0, 1180, 1080, 740] }, split: { slide: [0, 0, 1080, 960], you: [0, 960, 1080, 960] },
            quiz: { bg: [0, 0, 1080, 1920] }, capBox: null, capBand: 'mid', titlePos: 'c' },
};

export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), r3 = (x) => +(+x).toFixed(3), warnings = [];
  let raw = emphasize(loadWords(HERE, C.voice.words), C.captions.emph);
  /* the quiz pause survives the autocut: the last word before the reveal holds `pause` s */
  const qz = C.sections.find((s) => s.kind === 'quiz'); if (qz) { const rv = bare(qz.reveal.word), i = raw.findIndex((w) => bare(w.w) === rv); if (i > 0) raw[i - 1] = { ...raw[i - 1], hold: qz.pause }; else warnings.push('quiz reveal word not found: ' + qz.reveal.word); }
  const tr = talkTrack(raw, { fps, autocut: C.autocut, fillers: C.fillers }), words = tr.words, talkEnd = tr.seconds, T = +(talkEnd + C.end.holdS).toFixed(4), at = (s) => r3(atOf(s, words));
  const sec = C.sections.map((s, i) => ({ ...s, t0: i ? at(s.at) : 0 })); sec.forEach((s, i) => { s.t1 = i + 1 < sec.length ? sec[i + 1].t0 : talkEnd; });
  const youPh = { label: 'PRESENTER PLACEHOLDER', slot: 'presenter', name: C.media.presenter.name, tint: '#2E3B4E', seed: 13, chipPos: 'tl' };
  const slots = [], gfx = [], top = [];
  sec.forEach((s, k) => {
    const lay = L[s.kind] || L.presenter, win = [s.t0, s.t1];
    if (lay.you) slots.push(...talkSlots(tr.segs, { id: `you-s${k}`, src: C.media.presenter.src, srcStart: C.media.presenter.start, rect: lay.you, ph: { ...youPh, chipPos: lay.you[2] < 560 || lay.you[1] > 0 ? 'tl' : C.aspect === '9:16' ? 'bl' : 'tl' }, z: 5, window: win,
      extra: lay.youCircle ? { circle: true, shadow: true, border: { width: 6, color: '#FFFFFF' } } : {} }));
    if (lay.slide) { const sl = C.text.slides[s.slide] || { title: '', bullets: [] }, m = (C.media.slides || [])[s.slide] || {};
      slots.push({ id: `slide-s${k}`, kind: 'slide', src: m.src || null, mediaStart: 0, start: s.t0, end: s.t1, rect: lay.slide, z: 2, bg: C.brand.paper,
        ph: { title: sl.title, bullets: sl.bullets, at: (sl.at || []).map((a) => r3(at(a) - s.t0)), kicker: C.text.kicker, accent: C.brand.accent, paper: C.brand.paper, ink: C.brand.ink } }); }
    if (s.kind === 'quiz') { slots.push({ id: `quizbg-s${k}`, kind: 'slide', src: null, start: s.t0, end: s.t1, rect: lay.bg, z: 2, bg: C.brand.paper, ph: { title: '', bullets: [], paper: '#E9E6DF', accent: C.brand.accent } });
      top.push({ id: 'ui.quizCard', at: s.t0, dur: r3(s.t1 - s.t0 - 0.6), params: { q: C.text.quiz.q, options: C.text.quiz.options, answer: C.text.quiz.answer, revealAt: r3(at(s.reveal) - s.t0), pos: 'c', accent: C.brand.accent } }); }
    if (s.kind === 'recap') { slots.push({ id: `recapbg-s${k}`, kind: 'slide', src: null, start: s.t0, end: T, rect: L.quiz.bg, z: 2, bg: C.brand.paper, ph: { title: '', bullets: [], paper: '#E9E6DF', accent: C.brand.accent } });
      top.push({ id: 'title.recapCard', at: s.t0, dur: r3(T - s.t0 - 0.4), params: { title: C.text.recap.title, items: C.text.recap.items, stagger: 0.9, pos: 'c', accent: C.brand.accent } }); }
  });
  top.unshift({ id: 'title.hookCard', at: 0, dur: Math.max(1.6, r3(sec[1].t0 - 0.5)), params: { line: C.text.title, kicker: C.text.kicker, pos: L.titlePos, accent: C.brand.accent } });
  gfx.push({ id: 'title.progressBar', at: 0, dur: T, params: { total: T, chapters: sec.slice(1).map((s) => s.t0), edge: 'top', height: 10, accent: C.brand.accent, track: 'rgba(120,120,120,0.35)' } });
  const pick = pickCaption(C.captions.style[C.aspect] || 'doc', { aspect: C.aspect, brand: C.brand, band: L.capBand });
  const capWords = words.filter((w) => !sec.some((s) => (s.kind === 'quiz' || s.kind === 'recap') && w.os >= s.t0 && w.os < s.t1 + 9));   // the quiz and recap cards carry their own text
  const cap = captionTrack(capWords, pick); for (const x of [...pick.lint, ...cap.lint]) warnings.push('captions: ' + x);
  const cues = [ ...cuesFor([...top], { overVoDb: -12 }), ...sec.slice(1).map((s) => ({ id: 'sfx/whoosh/swish_s', t: s.t0, why: `section: ${s.title} (${s.kind})`, overVoDb: -16 })) ].sort((a, b) => a.t - b.t);
  const voice = { fps, placeholder: C.voice.placeholder, sources: { presenter: { src: C.media.presenter.src, chain: C.voice.chain } },
    segments: tr.segs.map((g) => ({ source: 'presenter', src_in: +(C.media.presenter.start + g.src_in).toFixed(4), src_out: +(C.media.presenter.start + g.src_out).toFixed(4), start: g.start, speaker: 'A', words: tr.srcWords.filter((w) => !w.cut && w.e > g.src_in && w.s < g.src_out).map((w) => [w.s + C.media.presenter.start, w.e + C.media.presenter.start]) })) };
  const marks = [...new Set([0, ...tr.segs.map((g) => g.start), ...sec.map((s) => s.t0), talkEnd, T])].sort((a, b) => a - b);
  const shots = marks.slice(0, -1).map((a, i) => ({ id: 'shot' + i, start: r3(a), dur: r3(marks[i + 1] - a), section: (sec.filter((s) => s.t0 <= a + 1e-6).at(-1) || sec[0]).kind, ...(a >= (sec.find((s) => s.kind === 'quiz')?.t0 ?? 1e9) ? { hold: true } : {}) })).filter((s) => s.dur > 0.001);
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: C.brand.paper, platform: A.safe, slots, gfx, gfxTop: top, captions: { chunks: cap.chunks, style: pick.style, box: pick.box },
    speaking: Object.fromEntries(slots.filter((s) => s.kind === 'speaker').map((s) => [s.id, words.map((w) => [w.os, w.oe])])) };
  const structure = structureOf(sec.map((s) => [s.beat || s.kind, s.t0]), T);
  const qz2 = sec.find((s) => s.kind === 'quiz'), rc = sec.find((s) => s.kind === 'recap');
  const texts = [textOf(C.text.title, 0, top[0].dur, 'hook'), ...(qz2 ? [textOf(C.text.quiz.q, qz2.t0 + 0.33, r3(qz2.t1 - qz2.t0 - 0.6), 'card')] : []), ...(rc ? [textOf([C.text.recap.title, ...C.text.recap.items].join(' '), rc.t0 + 0.33, r3(T - rc.t0 - 0.4), 'card')] : [])];
  return { template: 'course-lesson', aspect: C.aspect, structure, texts, fps, seconds: T, size: [A.W, A.H], scene, voice, cues, shots, claims: C.claims, transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe })),
    sections: sec.map((s) => ({ kind: s.kind, title: s.title, t0: s.t0, t1: s.t1 })), edit: { cuts: tr.cuts, fillers: tr.fillers }, captionStyle: pick.name,
    ...audioFields(C, tag, { role: 'explainer' }), paceRule: { aslMax: 4.5, longMax: 7 }, warnings };
}
