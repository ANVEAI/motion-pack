/* TEMPLATE process-howto: a numbered how-to, 30-60 s, 16:9 master + a 9:16 re-layout (lane explainer, 2026-10-16).
   Shape (patterns/structures.json `process-howto`, craft notes in README.md): HOOK (the promise on frame 0 while the numbered steps draw on their timeline) -> STEPS (one step
   at a time: the timeline fills, the step's icon lights, a tip card under it; done steps tick) -> RESULT (before / after: your two photos in the cards, the after wipes in) ->
   CHECKLIST (what you need, ticked one by one, held as the end card).
   One canvas, no hard cuts: the pace is read from the motion events (steps, ticks, the wipe). Steps are a list in CONFIG; icons come from the pack's owned icon set
   (type/gfx/explain-icons.js: gear drop timer cup check search upload download edit lock chart leaf sun plug doc person dot).
   MEDIA: media.before / media.after are your photos (null renders a labelled PLACEHOLDER plate inside the card). OPTIONAL VOICE: voice.words + voice.audio, as explainer-diagram.
   DEMO: repotting a houseplant, general practice with no numbers or claims. Fictional brand "Orbit How-To". */
import { aspectOf, safeBox, fixSets, loadVoiceWords, beatTime, captionsOf, finish, r3, tagOf, inSafe, HERE_OF } from '../_explain/core.mjs';
import { baGeom } from '../../type/gfx/explain.js';
import { ctxFor } from '../../type/gfx/core.js';
import { ICONS } from '../../type/gfx/explain-icons.js';
const HERE = HERE_OF(import.meta.url);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit How-To', accent: '#2F6B3A', ink: '#16151B', paper: '#F4F1E8', logo: null, url: 'orbit.example', cta: 'Save this for repotting day', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],
  text: {
    hook: 'Repot a plant in four steps',
    stepKicker: 'Step',
    before: { label: 'Before', title: 'Roots circling the pot', lines: ['Water runs straight through', 'Soil dries out fast'] },
    after: { label: 'After', title: 'Room to grow', lines: ['Fresh soil holds water', 'Roots spread outwards'] },
    checklistTitle: 'You need', checklist: ['A pot one size up', 'Fresh potting mix', 'A watering can', 'Old newspaper'],
  },
  media: {
    before: { src: null, start: 0, label: 'before photo' },
    after: { src: null, start: 0, label: 'after photo' },
  },
  voice: { words: null, audio: null, placeholder: 'guide', chain: false },
  /* the steps: title (<= 4 words), icon (an explain-icons name), tip (one line under the timeline); t = when it becomes the active step (or word: a voice word) */
  steps: [
    { t: 4.4, title: 'Water the plant', icon: 'drop', tip: 'Water a day before, so the roots slide out.' },
    { t: 10.2, title: 'Loosen the roots', icon: 'leaf', tip: 'Tease circling roots apart with your fingers.' },
    { t: 16.0, title: 'Add fresh soil', icon: 'upload', tip: 'Set the plant at the same depth as before.' },
    { t: 21.8, title: 'Settle and water', icon: 'check', tip: 'Water slowly until it drains from the bottom.' },
  ],
  allDoneAt: 27.6,               // all steps ticked (the timeline is full)
  result: { t: 29.2, swap: 1.6, until: 35.4 },
  checklist: { t: 35.6, step: 0.7 },
  tailS: 7.6,
  claims: [],
  captions: { style: { '16:9': 'minimal', '9:16': 'karaoke' } },
  music: 'music/bed_acoustic_folk_pluck_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0,
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.hook', 'text.hook': 'text.hook', 'media.before': 'media.before', 'media.after': 'media.after', 'voice.words': 'voice.words', 'voice.audio': 'voice.audio', music: 'music', claims: 'claims', aspects: 'aspects' };
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'relayout', tag: 'tall' } };

/* boxes as fractions of the SAFE rect: 16:9 puts the timeline across the middle and the tip card under it; 9:16 stacks the steps as a column and the tip under it */
const LAYOUT = {
  '16:9': { steps: [0.0, 0.2, 1.0, 0.7], layout: 'row', tipPos: 'bc', tipSize: 0.7, hookPos: 'tc', hookSize: 0.9, ba: [0.02, 0.02, 0.98, 0.98], check: [0.22, 0.04, 0.78, 0.96], size: 1.3, baSize: 1.15, checkScale: 1.6 },
  '9:16': { steps: [0.04, 0.27, 0.96, 0.76], layout: 'column', tipPos: 'bc', tipSize: 0.72, hookPos: 'tc', hookSize: 0.8, ba: [0.02, 0.0, 0.98, 1], check: [0.03, 0.08, 0.97, 0.9], size: 0.62, baSize: 0.6, checkScale: 1 },
};
export function processProblems(C) {
  const out = []; if (!Array.isArray(C.steps) || C.steps.length < 2 || C.steps.length > 8) out.push('steps: give 2 to 8 steps');
  for (const [i, s] of (C.steps || []).entries()) { if (!String(s.title || '').trim()) out.push(`steps[${i}]: no title`); if (String(s.title || '').split(/\s+/).length > 5) out.push(`steps[${i}]: "${s.title}" is more than 5 words (it sits on a timeline)`);
    if (s.icon && !ICONS[s.icon]) out.push(`steps[${i}]: icon "${s.icon}" is not one of ${Object.keys(ICONS).join(' ')}`); if (s.t == null && !s.word) out.push(`steps[${i}]: needs a time t (or a voice word)`); }
  for (const k of ['before', 'after']) { const m = C.media?.[k]; if (m && m.src != null && typeof m.src !== 'string') out.push(`media.${k}.src: a file path or null`); }
  const lines = [C.text.hook, ...(C.steps || []).flatMap((s) => [s.title, s.tip]), C.text.before?.title, C.text.after?.title, ...(C.text.before?.lines || []), ...(C.text.after?.lines || []), ...(C.text.checklist || [])];
  for (const l of lines) if (/\d/.test(String(l ?? '')) && !(C.claims || []).some((c) => c.text === l && c.source)) out.push(`"${l}" shows a digit with no sourced claim (put { text, source } in claims, or write the number out of it)`);
  return out;
}
export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), warnings = [], box = (f) => inSafe(C.aspect, f);
  const probs = processProblems(C); if (probs.length) throw new Error('process-howto: ' + probs.join('; '));
  const words = loadVoiceWords(HERE, C), vo = words.length > 0, at = (b) => beatTime(b, words, fps);
  const steps = C.steps.map((s, i) => ({ ...s, i, at: at(s) })), done = at({ t: C.allDoneAt }), res = { at: at(C.result), swap: C.result.swap ?? 1.4, until: at({ t: C.result.until }) }, ck = { at: at(C.checklist), step: C.checklist.step ?? 0.7 };
  const T = +(typeof C.length === 'number' ? C.length : Math.max(ck.at + (C.tailS ?? 7), vo ? words.at(-1).oe + 1.5 : 0)).toFixed(4);
  const items = [], top = [], texts = [], events = [], slots = [];
  /* hook + the persistent timeline */
  top.push({ id: 'title.hookCard', at: 0, dur: Math.max(2.5, steps[0].at - 0.4), params: { line: C.text.hook, kicker: C.brand.name, pos: L.hookPos, accent: C.brand.paper, bg: C.brand.ink, size: L.hookSize } }); texts.push({ text: C.text.hook, a: 0, b: steps[0].at - 0.4, role: 'hook' });
  const active = [...steps.map((s) => [r3(s.at), s.i]), [r3(done), steps.length]];
  items.push({ id: 'process.steps', at: 0, dur: r3(res.at - 0.5), params: { steps: steps.map((s) => ({ title: s.title, icon: s.icon || 'dot' })), active, layout: L.layout, box: box(L.steps), accent: C.brand.accent, ink: C.brand.ink, size: L.size, stagger: 0.5 } });
  events.push(0, ...steps.map((_, i) => i * 0.5), ...active.map((a) => a[0]));
  steps.forEach((s, i) => { const b = i + 1 < steps.length ? steps[i + 1].at : done; texts.push({ text: s.title, a: s.at, b, role: 'label' });
    if (!vo && s.tip) { top.push({ id: 'title.hookCard', at: r3(s.at + 0.35), dur: r3(b - s.at - 0.75), silent: true, params: { line: s.tip, kicker: `${C.text.stepKicker} ${i + 1}`, pos: L.tipPos, accent: C.brand.accent, size: L.tipSize, bg: '#FFFFFF' } });
      texts.push({ text: s.tip, a: s.at + 0.35, b: b - 0.1, role: 'caption-super' }); events.push(s.at + 0.35, s.at + (b - s.at) / 2); } });
  /* before / after with your photos in the cards' windows */
  const baP = { before: C.text.before, after: C.text.after, swap: res.swap, layout: 'auto', box: box(L.ba), media: true, mediaH: C.aspect === '9:16' ? 0.42 : 0.46, accent: C.brand.accent, ink: C.brand.ink, size: L.baSize };
  items.push({ id: 'process.beforeAfter', at: res.at, dur: r3(res.until - res.at), params: baP });
  const geo = baGeom({ ...baP, size: L.baSize }, ctxFor(A.W, A.H, A.safe, 1)), rect = (w) => w.map((v) => Math.round(v));
  for (const [k, win, a0, wipe] of [['before', geo.winA, res.at + 0.15, null], ['after', geo.winB, res.at + res.swap, { t0: r3(res.at + res.swap), t1: r3(res.at + res.swap + 0.7) }]]) { const m = C.media[k] || {};
    slots.push({ id: k, kind: 'photo', src: m.src || null, mediaStart: m.start || 0, start: r3(a0), end: r3(res.until + 0.25), rect: rect(win), fit: 'cover', z: 2, ...(wipe && !geo.col ? { wipe } : {}), vis: { kind: 'fade', in: 0.25, out: 0.25 },
      phLabel: ['PLACEHOLDER PHOTO', `${m.label || k} · set media.${k}.src`], phLabelPos: 'tl', ph: { chip: false, label: 'PLACEHOLDER PHOTO', what: m.label || k, slot: k, seed: k === 'before' ? 5 : 9, tint: k === 'before' ? '#B9AE9A' : '#9FB59A' } }); }
  texts.push({ text: [C.text.before.title, ...C.text.before.lines].join('. '), a: res.at, b: res.until, role: 'card' }, { text: [C.text.after.title, ...C.text.after.lines].join('. '), a: res.at + res.swap, b: res.until, role: 'card' });
  events.push(res.at, res.at + 0.45, res.at + res.swap, res.at + res.swap + 0.7, res.until - 2.2);
  /* the checklist end card */
  const cb = box(L.check), n = C.text.checklist.length;
  top.push({ id: 'ui.checklist', at: ck.at, dur: r3(T - ck.at - 0.4), params: { box: cb, title: C.text.checklistTitle, steps: C.text.checklist, start: 0.5, step: ck.step, progress: true, theme: 'light', accent: C.brand.accent, card: true, scale: L.checkScale } });
  texts.push({ text: C.text.checklist.join('. '), a: ck.at, b: T, role: 'checklist' }); events.push(ck.at, ...C.text.checklist.map((_, i) => ck.at + 0.5 + (i + 1) * ck.step));
  const sections = [{ name: 'hook', t: [0, r3(steps[0].at)] }, { name: 'steps', t: [r3(steps[0].at), r3(res.at)] }, { name: 'result', t: [r3(res.at), r3(ck.at)] }, { name: 'checklist', t: [r3(ck.at), r3(T)] }];
  const shots = sections.map((s) => ({ id: s.name, sec: s.name, start: s.t[0], dur: r3(s.t[1] - s.t[0]), move: 'process camera', ...(s.name === 'checklist' ? { hold: true } : {}) }));
  const cap = captionsOf(words, C); for (const x of cap.lint) warnings.push('captions: ' + x);
  const quiet = [{ t: [r3(Math.max(T - 8.5, ck.at + 0.5 + (n + 1) * ck.step)), r3(T)], kind: 'hold', why: 'the ticked checklist holds as the end card' }];
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: C.brand.paper, platform: A.safe, slots, gfx: items, gfxTop: top, captions: cap.captions, speaking: {} };
  return finish({ template: 'process-howto', C, A, fps, T, words, scene, items, top, sections, shots, claims: C.claims, texts, events, quiet, warnings, tag, extra: { pattern: 'process-howto', layers: C.layers }, role: 'explainer' });
}
