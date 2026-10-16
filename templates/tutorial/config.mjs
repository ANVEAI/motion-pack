/* TEMPLATE tutorial: a screen recording + a webcam PiP, cut and dressed for YouTube (16:9) and re-laid out for Shorts / Reels (9:16).
   Shape (craft notes in templates/tutorial/README.md): the RESULT first (frame 0 shows the finished state + a hook card), then numbered steps, each opened by a chapter card,
   a step counter that stays up, zoom-follow-cursor on every click, a keyboard-shortcut overlay, a highlight box / spotlight on what to look at, a code callout with line
   highlighting, the result reveal, and an end screen with labelled next-video slots.
   INPUT (yours): media.screen.src = your screen recording, media.webcam.src = your webcam clip (or null), voice.words = its transcript (words.json, .srt or .vtt),
   cursor.track = a recorded cursor track [[t, x, y, click?], ...] (screen fractions) or cursor.clicks = click times -> an ESTIMATED track (tools/human/human.mjs cursor).
   DEMO (no footage, no people): the screen is a FICTIONAL app drawn in SVG ("Orbit Notes", labelled PLACEHOLDER RECORDING) whose state replays `screenEvents`, the webcam is a
   labelled silhouette, and the voice is a guide signal at the hand-timed words of transcript.example.srt. Nothing here is a real product, person or recording. */
import path from 'node:path';
import { aspectOf, atOf, fixSets, safeBox } from '../_shared/human/core.mjs';
import { cursorFromClicks, zoomKeys } from '../_shared/human/screen.mjs';
import { pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { loadWords, emphasize, cuesFor, audioFields, tagOf, structureOf, textOf } from '../_shared/human/kit.mjs';
import { DESKTOP_TARGETS, DESKTOP_BOXES } from '../_shared/human/plates.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Orbit', accent: '#4A18ED', ink: '#111111', paper: '#F5F2EA', logo: null, url: 'orbit.example', cta: 'Subscribe for the next one', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'youtube', fps: 30, length: 'auto', aspect: '16:9', aspects: ['16:9', '9:16'],   // 'auto' = the transcript decides; aspect = this build ('16:9' at the root, '9:16' in tall/); aspects = the set you deliver
  text: {
    hook: 'Dark mode in three steps', kicker: 'Tutorial',
    chapters: [ { at: { word: 'First,', offset: -0.68 }, kicker: 'Step 1', title: 'Open the settings file', short: 'Open settings' },
                { at: { word: 'Next,', offset: -0.8 }, kicker: 'Step 2', title: 'Add the toggle', short: 'Add the toggle' },
                { at: { word: 'Finally,', offset: -1.4 }, kicker: 'Step 3', title: 'Run it', short: 'Run it' } ],
    endTitle: 'Watch next', endSlots: [ { label: 'Next video', kind: 'video' }, { label: 'The full series', kind: 'playlist' } ], handle: '@yourchannel', resultLabel: 'Result',
  },
  media: {
    screen: { src: null, start: 0, label: 'screen recording', size: [1920, 1080] },   // your recording; size = its pixel size (the zoom maths and the cursor live in it)
    webcam: { src: null, start: 0, label: 'webcam', name: 'Presenter' },
  },
  voice: { words: 'words.json', audio: 'webcam', chain: true, placeholder: 'guide' },   // audio: which slot's sound is the voice ('webcam' | 'screen'); chain: tools/human/voice_chain.py tone chain
  cursor: { track: null, clicks: [   // click times anchored to the words; target = a DESKTOP_TARGETS name (placeholder) or [x, y]
      { at: { word: 'sidebar.', offset: 0.1 }, target: 'file:settings.js' }, { at: { word: 'Type' }, target: 'line:4' }, { at: { word: 'lines,' }, target: 'line:5', press: false },
      { at: { word: 'run,' }, target: 'run' }, { at: { word: 'toggle.', nth: 1 }, target: 'toggle' } ], draw: 'auto' },   // draw: 'auto' = draw our cursor only on the placeholder (a real recording has its own)
  zoom: { scale: { '16:9': 1.8, '9:16': 1.35 }, lead: 0.55, ramp: 0.45, hold: 1.1, merge: 1.6, follow: 0.5 },
  pip: { corner: 'br', shape: 'circle', size: 300, autoHide: ['cursor'], hideOnCards: true },   // 16:9 only: 9:16 stacks the webcam above the screen instead (a re-layout, not a crop)
  shortcuts: [ { at: { word: 'control', offset: -0.15 }, keys: ['Ctrl', 'S'], label: 'Save' } ],
  highlights: [ { at: { word: 'sidebar.', offset: 0.25 }, dur: 1.2, target: 'file:settings.js', label: 'settings.js', kind: 'box' },
                { at: { word: 'click', offset: 0.45 }, dur: 0.8, target: 'toggle', kind: 'spotlight' } ],
  code: { at: { word: 'Look', offset: -0.2 }, until: { word: 'it.', nth: 1, offset: 0.4 }, title: 'settings.js · placeholder code',
    highlight: [ { from: 5, to: 5, at: { word: 'five:' } }, { from: 6, to: 6, at: { word: 'remembers' } } ] },
  result: { at: { word: 'toggle.', nth: 1, offset: 0.25 }, dur: 2.4, target: 'preview' },
  end: { holdS: 5.4, gapS: 0.4 },               // the end screen holds >= 5 s (the platform end-screen elements need 5-20 s)
  /* the placeholder screen's story (ignored once media.screen.src is set) */
  screenEvents: { base: { file: 'index.js', dark: true, lines: ["import { theme } from './theme';", "import { save } from './store';", ''] },
    events: [ { at: { word: 'you.' , offset: 0.25 }, kind: 'toggle', on: false }, { at: { word: 'sidebar.', offset: 0.12 }, kind: 'file', file: 'settings.js' },
      { at: { word: 'Type', offset: 0.2 }, kind: 'type', line: 4, text: 'export function toggle(state) {', cps: 50 },
      { at: { word: 'Type', offset: 0.85 }, kind: 'type', line: 5, text: "  const next = state === 'dark' ? 'light' : 'dark';", cps: 50 },
      { at: { word: 'Type', offset: 1.9 }, kind: 'type', line: 6, text: "  theme.set(next); save('theme', next);", cps: 50 },
      { at: { word: 'Type', offset: 2.7 }, kind: 'type', line: 7, text: '}', cps: 50 },
      { at: { word: 'S.', offset: 0.1 }, kind: 'term', text: '> saved settings.js' },
      { at: { word: 'run,', offset: 0.3 }, kind: 'term', text: '> preview reloaded' },
      { at: { word: 'toggle.', nth: 1, offset: 0.05 }, kind: 'toggle', on: true } ] },
  captions: { style: { '16:9': 'minimal', '9:16': 'karaoke' }, emph: ['three', 'settings', 'toggle.', 'five:', 'run,', 'Done.'] },
  claims: [],                                   // any on-screen digit that is a claim needs { text, source } (the step numbers are the tutorial's own ordinals)
  music: 'music/bed_lofi_warm_loop8', musicGainDb: 0, duckDb: 12, ceilingDb: -2.0,
  layers: [ { kind: 'vignette', params: { amount: 0.05 } }, { kind: 'grain', params: { stock: 'upload-safe' } } ],
};
/* ============================================================================== */
/* the shared project file (templates/_shared/project.schema.json, lane 6) -> this CONFIG */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.hook', 'text.kicker': 'text.kicker', 'text.chapters': 'text.chapters', 'text.endTitle': 'text.endTitle', 'media.screen': 'media.screen', 'media.webcam': 'media.webcam', 'media.speaker': 'media.webcam',
  'voice.words': 'voice.words', music: 'music', aspects: 'aspects' };

const LAYOUT = {
  '16:9': { screen: [0, 0, 1920, 1080], fit: 'contain', webcam: null, code: [0.16, 0.13, 0.68, 0.66], keyPos: 'tc', stepPos: 'tl', hookPos: 'tl', labelPos: 'tr', capBox: (sb) => ({ x0: sb.x0, x1: 1460, y0: sb.y1 - 120, y1: sb.y1 - 12, w: 1460 - sb.x0, h: 108 }) },
  '9:16': { screen: [0, 640, 1080, 1000], fit: 'cover', webcam: [0, 0, 1080, 640], code: [0.04, 0.345, 0.92, 0.3], keyPos: 'tc', stepPos: 'tl', hookPos: 'c', labelPos: 'tr', capBox: null },
};
const TGT = (t) => (Array.isArray(t) ? t : String(t).startsWith('line:') ? DESKTOP_TARGETS.line(+t.split(':')[1]) : DESKTOP_TARGETS[t]);
const BOXOF = DESKTOP_BOXES;

export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['16:9'], fps = C.fps, tag = tagOf(C.aspect, '16:9'), r3 = (x) => +(+x).toFixed(3), qf = (x) => Math.round(x * fps) / fps;
  const words0 = emphasize(loadWords(HERE, C.voice.words), C.captions.emph), words = words0.map((w) => ({ ...w, os: w.s, oe: w.e }));   // a tutorial keeps the recording's timeline: no autocut (it would desync the screen)
  const at = (spec) => qf(atOf(spec, words)), lastWord = words.length ? words.at(-1).oe : 10;
  const endAt = r3(qf(lastWord + C.end.gapS)), T = +(typeof C.length === 'number' ? C.length : qf(endAt + C.end.holdS)).toFixed(4);
  const ph = !C.media.screen.src, SW = C.media.screen.size[0], SH = C.media.screen.size[1], warnings = [];
  /* cursor: recorded track, or estimated from the click times */
  const clicks = C.cursor.clicks.map((c) => { const [x, y] = TGT(c.target) || [0.5, 0.5]; return { t: at(c.at), x, y, press: c.press !== false }; });
  const cur = C.cursor.track ? { track: C.cursor.track, estimated: false } : cursorFromClicks(clicks, { fps, end: T, start: [0.52, 0.6] });
  const track = cur.track.map((q) => (q[3] && !clicks.find((c) => Math.abs(c.t - q[0]) < 0.5 / fps && c.press) ? q.slice(0, 3) : q));
  if (cur.estimated) warnings.push('cursor track ESTIMATED from click times (tools/human/human.mjs cursor); record the real track with your screen recorder when you can');
  const zscale = C.zoom.scale[C.aspect] ?? C.zoom.scale['16:9'], keys = zoomKeys(clicks, { ...C.zoom, scale: zscale });
  /* chapter cards, code callout, end screen: windows the PiP hides under */
  const chap = C.text.chapters.map((c) => ({ ...c, t: at(c.at) })), cardDur = 1.0, cardSpan = cardDur + (10 + 10) / 30;   // the step title reads at <= 3 words/s
  const code0 = at(C.code.at), code1 = at(C.code.until), hides = [...chap.map((c) => [c.t, c.t + cardSpan]), [code0, code1 + 0.3], [endAt, T]];
  /* slots */
  const slots = [], scr = { id: 'screen', kind: 'screen', src: C.media.screen.src, mediaStart: C.media.screen.start || 0, start: 0, end: endAt, rect: L.screen, inner: [SW, SH], fit: L.fit,
    cam: { kind: 'zoom', keys, track, follow: C.zoom.follow }, z: 1, bg: '#0E0E14',
    phLabel: ['PLACEHOLDER RECORDING', 'fictional app · set media.screen.src'], phLabelPos: L.labelPos, ph: { chip: false, label: 'PLACEHOLDER RECORDING', slot: 'screen', accent: C.brand.accent, base: C.screenEvents.base, events: C.screenEvents.events.map((e) => ({ ...e, t: at(e.at) })).sort((a, b) => a.t - b.t) } };
  slots.push(scr);
  const camSpeak = words.map((w) => [w.os, w.oe]);
  if (L.webcam) slots.push({ id: 'webcam', kind: 'speaker', src: C.media.webcam.src, mediaStart: C.media.webcam.start || 0, start: 0, end: endAt, rect: L.webcam, z: 2, ph: { label: 'WEBCAM PLACEHOLDER', slot: 'webcam', name: C.media.webcam.name, tint: '#2E3B4E', seed: 3, chipPos: 'bl' } });
  else { const sb = safeBox(C.aspect), s = C.pip.size; slots.push({ id: 'webcam', kind: 'speaker', src: C.media.webcam.src, mediaStart: C.media.webcam.start || 0, start: 0, end: endAt,
    rect: [C.pip.corner.includes('l') ? sb.x0 : A.W - 96 - s, C.pip.corner.startsWith('t') ? sb.y0 : A.H - 54 - s - 40, s, s], circle: C.pip.shape === 'circle', radius: C.pip.shape === 'rounded' ? 28 : 0, z: 5, shadow: true,
    border: { width: 6, color: '#FFFFFF' }, origin: [0.5, 0.5], vis: { kind: 'pip', corner: C.pip.corner, autoHide: C.pip.autoHide, hide: C.pip.hideOnCards ? hides : [], keys, track },
    ph: { label: 'WEBCAM PLACEHOLDER', slot: 'webcam', name: C.media.webcam.name, tint: '#2E3B4E', seed: 3 } }); }
  /* screen-space gfx: they zoom with the recording */
  const sgfx = [];
  if (C.cursor.draw === true || (C.cursor.draw === 'auto' && ph)) sgfx.push({ id: 'ui.cursorTrack', at: 0, dur: endAt, params: { track, color: '#FFFFFF', ripple: '#FFD400', scale: 1.5 } });
  for (const h of C.highlights) { const t0 = at(h.at), box = BOXOF[h.target] || h.box; if (!box) { warnings.push('highlight target ' + h.target + ' has no box'); continue; }
    sgfx.push(h.kind === 'spotlight' ? { id: 'callout.spotlight', at: t0, dur: h.dur, params: { box, dim: 0.6, radius: 0.012 } } : { id: 'callout.highlightBox', at: t0, dur: h.dur, params: { box, label: h.label || '', color: '#FFD400', width: 5 } }); }
  const rv = at(C.result.at); sgfx.push({ id: 'callout.resultReveal', at: rv, dur: C.result.dur, params: { box: BOXOF[C.result.target] || C.result.box, label: C.text.resultLabel, color: '#FFD400', sweep: 0.6 } });
  /* frame-space gfx */
  const gfx = [ { id: 'title.hookCard', at: 0, dur: Math.max(1.2, at({ word: 'you.' }) - 0.5), params: { line: C.text.hook, kicker: C.text.kicker, pos: L.hookPos, accent: C.brand.accent } } ];
  const steps = chap.map((c, i) => [r3(c.t - chap[0].t), i + 1, c.short || c.title]);
  gfx.push({ id: 'ui.stepCounter', at: chap[0].t, dur: r3(endAt - chap[0].t - 0.3), params: { total: chap.length, steps, label: 'Step', pos: L.stepPos, accent: C.brand.accent } });
  for (const k of C.shortcuts) gfx.push({ id: 'ui.keyCombo', at: at(k.at), dur: 1.3, params: { keys: k.keys, label: k.label, pos: L.keyPos, accent: C.brand.accent, releaseAt: 0.9 } });
  const codeLines = [...C.screenEvents.base.lines]; for (const e of C.screenEvents.events) if (e.kind === 'type') { while (codeLines.length < e.line) codeLines.push(''); codeLines[e.line - 1] = e.text; }
  gfx.push({ id: 'ui.codeCallout', at: code0, dur: r3(code1 - code0), params: { title: C.code.title, lines: codeLines, box: L.code, accent: C.brand.accent, highlight: C.code.highlight.map((h) => ({ from: h.from, to: h.to, at: r3(at(h.at) - code0) })) } });
  const top = chap.map((c) => ({ id: 'title.stepCard', at: c.t, dur: cardDur, params: { kicker: c.kicker, title: c.title, accent: C.brand.accent } }));
  top.push({ id: 'title.endScreen', at: endAt, dur: r3(T - endAt - 0.2), params: { title: C.text.endTitle, slots: C.text.endSlots, subscribe: 'Subscribe', handle: C.text.handle, accent: C.brand.accent, bg: '#0E0E14' } });
  /* captions */
  const pick = pickCaption(C.captions.style[C.aspect] || 'doc', { aspect: C.aspect, brand: C.brand, box: L.capBox ? L.capBox(safeBox(C.aspect)) : null }), cap = captionTrack(words, pick);
  for (const x of [...pick.lint, ...cap.lint]) warnings.push('captions: ' + x);
  /* sound: one cue per gfx action, under the voice */
  const cues = cuesFor([...gfx, ...top.map((x) => ({ ...x, overVoDb: -10 })), ...sgfx], { overVoDb: -16 });
  const shots = [{ id: 'hook', start: 0, dur: r3(chap[0].t) }, ...chap.map((c, i) => ({ id: 'step' + (i + 1), start: c.t, dur: r3((chap[i + 1] ? chap[i + 1].t : endAt) - c.t), tx: 'transitions/cut' })), { id: 'end', start: endAt, dur: r3(T - endAt), hold: true }];
  const voice = { fps, placeholder: C.voice.placeholder, sources: { cam: { src: C.media[C.voice.audio]?.src || null, chain: C.voice.chain } },
    segments: [{ source: 'cam', src_in: (C.media[C.voice.audio]?.start || 0), src_out: (C.media[C.voice.audio]?.start || 0) + endAt, start: 0, speaker: 'A', words: words.map((w) => [w.s + (C.media[C.voice.audio]?.start || 0), w.e + (C.media[C.voice.audio]?.start || 0)]) }] };
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: '#0E0E14', platform: A.safe, slots, gfx, gfxTop: top, screenGfx: { screen: sgfx }, captions: { chunks: cap.chunks, style: pick.style, box: pick.box }, speaking: { webcam: camSpeak } };
  /* the beats the structure checker reads (patterns/structures.json tutorial): the result first, the steps, the end screen */
  const structure = structureOf([['hook', 0], ...chap.map((c) => ['steps', c.t]), ['endscreen', endAt]], T);
  const texts = [textOf(C.text.hook, 0, gfx[0].dur, 'hook'), ...chap.map((c) => textOf(c.title, c.t, cardDur + 10 / 30, 'card')), ...C.shortcuts.map((k) => textOf(k.label, at(k.at), 1.3, 'label')), textOf(C.text.endTitle, endAt, T - endAt, 'card')];
  return { template: 'tutorial', aspect: C.aspect, structure, texts, fps, seconds: T, size: [A.W, A.H], scene, voice, cues, shots, claims: C.claims, transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe })),
    cursor: { source: cur.estimated ? 'estimated from click times' : 'recorded track', clicks: clicks.length }, zoom: keys, captionStyle: pick.name,
    ...audioFields(C, tag, { role: 'explainer' }),
    paceRule: { aslMax: 8, longMax: 11 }, warnings };
}
