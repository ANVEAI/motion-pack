/* TEMPLATE short-film: a narrative scaffold for a short film (60-180 s) on your footage, the pack's three.js stage, or labelled placeholder plates (2026-10-16, film lane).
   Beyond templates/film-scene (one three.js scene), this lays out a whole short: an opening title over the first shot, chapter titles, scene slugs typed on, dialogue
   subtitles from a lines (or words) JSON, a J / L cut builder for each scene's sound, the genre finish, and an end-credits roll after a dip to black.
   Story shape (story-script short-film grammar): cold open image -> the world and the want -> one obstacle -> the turn (50-60%) -> consequence -> resolution image -> credits.
   Edit the CONFIG block only. `node make.mjs [--set aspect=9:16] [--set lines=/abs/lines.json] [--set media.stage.src=/abs/film-scene-wide.mp4]`, then the render command it prints.
   Footage: CONFIG.media.<slot>.src = an MP4 (your shot, or the three.js stage render: `bash templates/_shared/render3d.sh templates/film-scene scene.html wide 23` writes
   templates/film-scene/out/film-scene-wide.mp4). src null = a labelled procedural placeholder plate.
   DEMO: "THE LAST SIGNAL" is a fictional short; the lines are placeholder dialogue shown as subtitles only (no voice is generated or faked), names are placeholders. */
import { FRAME, textBox, slotOf, jlCut, readS } from '../_shared/film/plan-film.mjs';
import { FILM_GENRES } from '../../layers/presets/film-looks.js';
import { readFileSync } from 'node:fs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'ORBIT PICTURES', accent: '#C9A46A', ink: '#F4EFE6', paper: '#000000', logo: null, url: 'orbit.example', cta: '', font: { display: 'STIX Two Text', text: 'Manrope' } },
  platform: null, fps: 30, length: null, aspect: '16:9',   // length: null = the sum of the shots; the scaffold does not stretch a story
  genre: 'drama', letterbox: undefined,
  film: { title: 'THE LAST SIGNAL', sub: 'a short film', titleStyle: 'title.trailerThin', titleAt: 1.2, titleDur: 4.2 },
  text: { label: 'placeholder footage · fictional film' },
  scenes: [
    { id: 's1', slug: 'INT. RELAY STATION - NIGHT', sound: 'sfx/amb/room_tone', shots: [{ slot: 'lamp', dur: 6 }, { slot: 'radio', dur: 6 }, { slot: 'window', dur: 5 }] },
    { id: 's2', chapter: { kicker: 'CHAPTER TWO', title: 'The answer' }, slug: 'EXT. CLIFF - NIGHT', sound: 'sfx/amb/wind', tx: ['transitions/dissolve', 'TIME: night has moved on, the answer is outside'],
      shots: [{ slot: 'coast', dur: 6 }, { slot: 'stage', dur: 6 }, { slot: 'ship', dur: 6 }] },
    { id: 's3', slug: 'INT. RELAY STATION - LATER', sound: 'sfx/amb/room_tone', tx: ['transitions/dissolve', 'TIME: back inside, after it'], shots: [{ slot: 'radio', dur: 6, sfx: [{ id: 'sfx/trailer/sting_button', at: 4.0 }] }] },
  ],
  lines: [                         // or a path: '/abs/lines.json' ([{ text, s, e, speaker?, scene? }]) or a whisper words.json ([{ w, s, e }]); s / e are scene-relative when `scene` is set
    { scene: 's1', s: 6.6, e: 8.8, text: 'Relay North. Do you copy?', speaker: 'radio' }, { scene: 's1', s: 9.4, e: 11.0, text: 'Who is this?' },
    { scene: 's1', s: 12.6, e: 15.4, text: 'Nobody has called this station in years.' }, { scene: 's2', s: 7.2, e: 9.6, text: 'Are you still there?', speaker: 'radio' },
    { scene: 's3', s: 1.2, e: 3.2, text: 'I am still here.' },
  ],
  media: { lamp: { src: null, plate: 'lamp', label: 'swinging lamp' }, radio: { src: null, plate: 'radio', label: 'radio close-up' }, window: { src: null, plate: 'window', label: 'rain window' },
    coast: { src: null, plate: 'coast', label: 'coast at night' }, ship: { src: null, plate: 'ship', label: 'ship in fog' },
    stage: { src: null, plate: 'corridor', label: 'three.js stage slot (render templates/film-scene)' } },
  jl: { j: 0.6, l: 0.4 },          // the J / L cut builder: each scene's sound leads its picture by j s; the previous one lingers l s where there is no J
  chapterDur: 2.6, slugDelay: 0.5,
  credits: { dur: 10, items: null },   // null = credits.roll's placeholder items
  voice: { src: null },            // your dialogue / VO recording (decoded from 0 s): the bed ducks under it; without it the lines are subtitles only
  music: 'music/bed_cinematic_drone_loop8', scoreIn: 's2', bedDb: { open: -30, in: -8, credits: -4 },   // the score enters on emotion (scene `scoreIn`), not on action
  sfx: { chapter: 'sfx/hit/soft', slug: 'sfx/foley/typewriter', title: 'sfx/trailer/sub_drop_long', toBlack: 'sfx/stinger/cut_to_black' },
  claims: [], layers: {},
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'text.title': 'film.title', 'text.headline': 'film.title', 'text.label': 'text.label', 'voice.words': 'lines',
  'media.hero': 'media.coast', 'media.screen': 'media.radio', 'media.broll': 'media.lamp', 'music': 'music', 'aspects': 'aspect' };
const r6 = (v) => +v.toFixed(6);
/* lines: [{ text, s, e }] as they are, or whisper words [{ w, s, e }] grouped into lines of <= 42 characters, broken at a pause of 0.6 s or a sentence end */
export function linesOf(raw) {
  const L = Array.isArray(raw) ? raw : raw && Array.isArray(raw.lines) ? raw.lines : raw && Array.isArray(raw.words) ? raw.words : [];
  if (!L.length || L[0].text != null) return L;
  const out = []; let cur = null;
  for (const w of L) { const brk = cur && (w.s - cur.e > 0.6 || /[.?!]$/.test(cur.text) || (cur.text + ' ' + w.w).length > 42);
    if (!cur || brk) { if (cur) out.push(cur); cur = { text: w.w, s: w.s, e: w.e }; } else { cur.text += ' ' + w.w; cur.e = w.e; } }
  if (cur) out.push(cur); return out;
}
export function buildPlan(C) {
  const asp = FRAME[C.aspect] ? C.aspect : '16:9', [W, H] = FRAME[asp], tall = H > W, fps = C.fps, G = FILM_GENRES[C.genre] || FILM_GENRES.drama, s = Math.min(W, H) / 1080;
  const lb = tall ? null : (C.letterbox === undefined ? G.bars : C.letterbox), barPx = lb && W / H < lb ? Math.round((H - W / lb) / 2) : 0, subY = tall ? 1180 : H - barPx - 46 * s;
  const shots = [], gfx = [], cues = [], texts = [], holds = [], sceneSpans = [], F = (t) => Math.round(t * fps), sec = (f) => r6(f / fps);
  let f = 0; const uses = {}; const slot = (n) => { const k = uses[n] = (uses[n] ?? -1) + 1; return slotOf(C, n, k); };
  C.scenes.forEach((sc, si) => {
    if (sc.chapter) { const a = f, b = f + F(C.chapterDur); shots.push({ id: sc.id + '_chapter', sec: 'chapter', kind: 'black', start: sec(a), dur: sec(b - a), hold: true, ...(si ? { tx: 'transitions/dip-to-black', txReason: 'STORY: a new chapter', txKind: 'dip', txDur: 0.8 } : {}) });
      gfx.push({ id: 'title.filmChapter', at: sec(a + F(0.2)), dur: r6(C.chapterDur - 0.7), params: { kicker: sc.chapter.kicker, title: sc.chapter.title, rule: C.brand.accent } });
      texts.push({ text: sc.chapter.title, t: [sec(a + F(0.4)), sec(b - F(0.3))], box: textBox(sc.chapter.title, { W, H, fontPx: 96 * s, y: H / 2 + 40 * s, weight: 400 }), fontPx: Math.round(96 * s), role: 'headline', fg: '#F4EFE6' });
      cues.push({ id: C.sfx.chapter, t: sec(a + F(0.2)), why: 'chapter title' }); f = b; }
    const s0 = f;
    sc.shots.forEach((sh, k) => { const a = f, b = f + F(sh.dur), tx = k === 0 && sc.tx && !sc.chapter ? { tx: sc.tx[0], txReason: sc.tx[1], txKind: /dissolve/.test(sc.tx[0]) ? 'dissolve' : /burn/.test(sc.tx[0]) ? 'filmBurn' : /dip/.test(sc.tx[0]) ? 'dip' : 'cut', txDur: 1.0 } : {};
      shots.push({ id: `${sc.id}_${k}`, sec: sc.id, start: sec(a), dur: sec(b - a), ...slot(sh.slot), ...tx });
      for (const x of sh.sfx || []) cues.push({ id: x.id, t: sec(a + F(x.at)), why: `${sc.id} shot ${k} action` }); f = b; });
    sceneSpans.push({ id: sc.id, start: sec(s0), dur: sec(f - s0), sound: sc.sound });
    if (sc.slug) { const at = sec(s0 + F(C.slugDelay)); gfx.push({ id: 'card.scene', at, dur: 2.4, params: { slug: sc.slug, pos: tall ? 'tl' : 'bl', size: 40, padY: barPx ? barPx + Math.round(36 * s) : 0 } });
      texts.push({ text: sc.slug, t: [r6(at + sc.slug.length / 28), r6(at + 2.4)], box: textBox(sc.slug, { W, H, fontPx: 40 * s, x: tall ? 65 : 96, anchor: 'start', y: tall ? 269 + 40 * s : H - barPx - 36 * s - 4, weight: 600, mono: true }), fontPx: Math.round(40 * s), role: 'label', fg: '#F2F2F2' });
      cues.push({ id: C.sfx.slug, t: at, why: 'the slug types on' }); }
  });
  /* the opening title over the first shot */
  gfx.push({ id: C.film.titleStyle, at: C.film.titleAt, dur: C.film.titleDur, params: { text: C.film.title, sub: C.film.sub, size: tall ? 104 : 120, y: tall ? 0.42 : 0.46 } });
  texts.push({ text: C.film.title, t: [r6(C.film.titleAt + 0.6), r6(C.film.titleAt + C.film.titleDur)], box: textBox(C.film.title, { W, H, fontPx: Math.min((tall ? 104 : 120) * s, W * 0.9 / (C.film.title.length * 0.8)), y: H * (tall ? 0.42 : 0.46) + 40 * s, weight: 200, ls: 0.4 }), fontPx: Math.round(Math.min((tall ? 104 : 120) * s, W * 0.9 / (C.film.title.length * 0.8))), role: 'headline', fg: '#F2F4F7' });
  cues.push({ id: C.sfx.title, t: C.film.titleAt, why: 'the opening title' });
  /* dialogue subtitles (scene-relative times resolved here) */
  const span = Object.fromEntries(sceneSpans.map((x) => [x.id, x]));
  for (const l of linesOf(typeof C.lines === 'string' ? JSON.parse(readFileSync(C.lines, 'utf8')) : C.lines)) { const base = l.scene && span[l.scene] ? span[l.scene].start : 0, at = r6(base + l.s), dur = r6(Math.max(0.6, l.e - l.s));
    gfx.push({ id: 'caption.filmSubtitle', at, dur, params: { text: l.text, speaker: l.speaker || '', y: subY / H } });
    texts.push({ text: l.text, t: [at, r6(at + dur)], box: textBox(l.text, { W, H, fontPx: 44 * s * (tall ? 1.35 : 1), y: subY, weight: 600 }), fontPx: Math.round(44 * s * (tall ? 1.35 : 1)), role: 'caption', fg: '#FFFFFF' }); }
  /* each scene's sound through the J / L builder, then the dip to black and the credits roll */
  for (const x of jlCut(sceneSpans, C.jl)) if (x.sound) cues.push({ id: x.sound, t: x.from, untilT: x.until, overBedDb: x.sound.includes('room_tone') ? -14 : -6, why: x.why });
  const cr0 = f, cr1 = f + F(C.credits.dur);
  shots.push({ id: 'credits', sec: 'credits', kind: 'black', start: sec(cr0), dur: sec(cr1 - cr0), hold: true, tx: 'transitions/dip-to-black', txReason: 'STORY: the film ends, the credits begin', txKind: 'dip', txDur: 1.2 });
  gfx.push({ id: 'credits.roll', at: r6(sec(cr0) + 0.6), dur: r6(C.credits.dur - 1.2), params: { ...(C.credits.items ? { items: C.credits.items } : {}), speed: tall ? 110 : 80, startY: 0.95 } });
  cues.push({ id: C.sfx.toBlack, t: sec(cr0), why: 'the last frame cuts to black' }); holds.push({ t: [sec(cr0), sec(cr1)], why: 'end credits' });
  const T = sec(cr1), sIn = span[C.scoreIn] ? F(span[C.scoreIn].start) : 0, D = C.bedDb;
  const bedAutomation = [{ frame: 0, gain_db: D.open }, { frame: Math.max(1, sIn - F(1.5)), gain_db: D.open }, { frame: sIn + F(2.5), gain_db: D.in }, { frame: cr0, gain_db: D.in }, { frame: cr0 + F(1.0), gain_db: D.credits }];
  const layers = { grain: C.layers.grain ?? G.grain, dust: C.layers.dust ?? G.dust, vignette: C.layers.vignette ?? G.vignette };
  return { template: 'short-film', fps, seconds: T, W, H, aspect: asp, platform: C.platform || (tall ? 'reels.organic' : 'x.video'), genre: C.genre in FILM_GENRES ? C.genre : 'drama', bars: barPx, letterbox: lb || null,
    music: C.music, bedAutomation, ...(C.voice && C.voice.src ? { vo: C.voice.src, duckDb: 12 } : {}), scenes: sceneSpans, shots, gfx, cues: cues.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)), burns: [], flares: [], flashes: [], texts, holds,
    claims: C.claims, labels: { film: C.text.label, slots: true }, layers, eyes: { letterbox: !!barPx },
    audio: { mode: C.voice && C.voice.src ? 'vo' : 'continuous', role: 'vo_doc', quiet: [{ t: [0, 1.5], kind: 'open', why: 'room tone only: the score enters on emotion' }, { t: [sec(cr1) - 3, sec(cr1)], kind: 'hold', why: 'the credits settle' }], events: shots.map((x) => x.start) },
    ceilingDb: -2.5, paceRule: { aslMax: 7.0, longMax: 8.0 } };
}
