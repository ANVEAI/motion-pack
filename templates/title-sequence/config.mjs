/* TEMPLATE title-sequence: kinetic opening titles, 30-60 s, names over textures or your footage, genre presets (2026-10-16, film lane). HyperFrames.
   Shape (craft of opening-title sequences, docs/evidence/film-trailer-craft.md; nothing copied): the picture moves from frame 0 (a texture or footage), a small role over a
   large name lands on a bar of the bed, the names move around the safe frame (never two at once), the texture changes on a downbeat every few names, the main title
   arrives on the last section with its own hit, "directed by" closes it, and the picture holds a beat before the film would start.
   Edit the CONFIG block only. `node make.mjs [--set length=45] [--set aspect=9:16] [--set genre=noir]`, then the render command it prints.
   DEMO: every name is a labelled placeholder ("PLACEHOLDER NAME"), the film "THE LAST SIGNAL" is fictional, the textures are procedural placeholder plates, labelled. */
import { FRAME, fpbOf, textBox, slotOf } from '../_shared/film/plan-film.mjs';
import { FILM_GENRES } from '../../layers/presets/film-looks.js';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'ORBIT PICTURES', accent: '#FF9A3C', ink: '#F2F2F2', paper: '#000000', logo: null, url: 'orbit.example', cta: '', font: { display: 'Manrope', text: 'Manrope' } },
  platform: null, fps: 30, length: 40, aspect: '16:9',
  genre: 'thriller',               // FILM_GENRES; the name style, bed and finish follow it unless set below
  letterbox: undefined,            // 16:9: 2.39 | 2.0 | 1.85 | null; undefined = the genre's
  style: null,                     // title.namesOver style: drift | type | slam | split | flicker | glow (null = the genre's)
  film: { title: 'THE LAST SIGNAL', titleStyle: null },
  text: {
    label: 'placeholder footage · fictional film · placeholder names',
    names: [['', 'ORBIT PICTURES', 'presents'], ['a film by', 'PLACEHOLDER NAME'], ['starring', 'PLACEHOLDER NAME'], ['', 'PLACEHOLDER NAME'], ['', 'PLACEHOLDER NAME'],
      ['music by', 'PLACEHOLDER NAME'], ['edited by', 'PLACEHOLDER NAME'], ['director of photography', 'PLACEHOLDER NAME'], ['production design', 'PLACEHOLDER NAME'],
      ['written by', 'PLACEHOLDER NAME'], ['produced by', 'PLACEHOLDER NAME']],
    directedBy: ['directed by', 'PLACEHOLDER NAME'],
  },
  media: { t1: { src: null, start: 0, plate: 'smoke', label: 'smoke texture' }, t2: { src: null, start: 0, plate: 'beams', label: 'light beams' }, t3: { src: null, start: 0, plate: 'coast', label: 'coast at night' },
    t4: { src: null, start: 0, plate: 'ink', label: 'ink texture' }, t5: { src: null, start: 0, plate: 'signal', label: 'the signal' } },
  textures: ['t1', 't2', 't3', 't4', 't5'],   // the order the texture slots play in; one per `perTexture` names
  perTexture: 3,
  positions: ['bl', 'tr', 'c', 'br', 'tl', 'c'],   // where the names sit, in turn (inside the platform safe rect)
  secondsPerName: 3.0,             // each name holds about this long, snapped to whole beats of the bed (it lands on a beat)
  music: null,                     // null = the genre's bed below; or any music/<bed id>
  beds: { thriller: 'music/bed_suspense_pulse_loop8', scifi: 'music/bed_ambient_pad_loop8', horror: 'music/bed_cinematic_drone_loop8', drama: 'music/bed_orchestral_synth_epic_loop8',
    documentary: 'music/bed_documentary_marimba_loop8', noir: 'music/bed_jazz_walk_loop8', period: 'music/bed_acoustic_folk_pluck_loop8', 'anime-ink': 'music/bed_synthwave_loop8' },
  styles: { thriller: 'split', scifi: 'drift', horror: 'flicker', drama: 'glow', documentary: 'type', noir: 'drift', period: 'type', 'anime-ink': 'slam' },
  transitions: { texture: ['transitions/dissolve', 'PLACE: a new texture, the same sequence'] },
  sfx: { name: 'sfx/hit/soft', type: 'sfx/foley/typewriter', title: 'sfx/trailer/braam_low', last: 'sfx/trailer/sub_drop_long' },
  claims: [], layers: {},
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'text.names.0.1', 'brand.accent': 'brand.accent', 'text.title': 'film.title', 'text.headline': 'film.title', 'text.lines': 'text.names', 'text.label': 'text.label',
  'media.hero': 'media.t3', 'media.broll': 'media.t1', 'music': 'music', 'aspects': 'aspect' };
const BPM = { 'music/bed_suspense_pulse_loop8': 100, 'music/bed_ambient_pad_loop8': 60, 'music/bed_cinematic_drone_loop8': 75, 'music/bed_orchestral_synth_epic_loop8': 90, 'music/bed_documentary_marimba_loop8': 90,
  'music/bed_jazz_walk_loop8': 138.462, 'music/bed_acoustic_folk_pluck_loop8': 100, 'music/bed_synthwave_loop8': 100 };   // music/manifest.json bpm (snapped)
const sec = (f, fps) => +(f / fps).toFixed(6);
export function buildPlan(C) {
  const asp = FRAME[C.aspect] ? C.aspect : '16:9', [W, H] = FRAME[asp], tall = H > W, fps = C.fps, G = FILM_GENRES[C.genre] || FILM_GENRES.thriller, s = Math.min(W, H) / 1080;
  const music = C.music || C.beds[C.genre] || C.beds.thriller, bpm = BPM[music] || 100, fpb = fpbOf(bpm, fps), bar = 4 * fpb;
  const T0 = Math.max(30, Math.min(60, +C.length || 40)), total = Math.round(T0 * fps / fpb) * fpb, style = C.style || C.styles[C.genre] || 'drift';
  const per = Math.max(fpb * 2, Math.round(C.secondsPerName * fps / fpb) * fpb), titleF = Math.max(bar, Math.round(4.5 * fps / fpb) * fpb), endF = Math.max(bar, Math.round(3.5 * fps / fpb) * fpb), lead = 2 * fpb;   // the title about 4.5 s, "directed by" about 3.5 s + the hold
  const fit = Math.max(1, Math.floor((total - lead - titleF - endF) / per)), names = C.text.names.slice(0, fit), shots = [], gfx = [], cues = [], texts = [], holds = [];
  const lb = tall ? null : (C.letterbox === undefined ? G.bars : C.letterbox), barPx = lb && W / H < lb ? Math.round((H - W / lb) / 2) : 0;
  const nTex = Math.max(1, Math.ceil(names.length / C.perTexture)), titleAt = lead + names.length * per, endAt = titleAt + titleF, T = sec(Math.max(total, endAt + endF), fps);
  let uses = {}; const slot = (n) => { const k = uses[n] = (uses[n] ?? -1) + 1; return slotOf(C, n, k); };
  const texAt = (i) => C.textures[i % C.textures.length];
  /* the textures: one per `perTexture` names, the last carries the title and the end; dissolves between them on a downbeat */
  const bounds = [0]; for (let k = 1; k < nTex; k++) bounds.push(lead + k * C.perTexture * per); bounds.push(titleAt, Math.round(T * fps));
  for (let k = 0; k < bounds.length - 1; k++) { const f0 = bounds[k], f1 = bounds[k + 1], tx = k > 0 ? { tx: C.transitions.texture[0], txReason: C.transitions.texture[1], txKind: 'dissolve', txDur: 1.0 } : {};
    shots.push({ id: 'tex' + k, sec: k === bounds.length - 2 ? 'title' : 'names', start: sec(f0, fps), dur: sec(f1 - f0, fps), ...slot(texAt(k)), ...tx, ...(k === bounds.length - 2 ? { hold: true } : {}) }); }
  const pick = (i) => C.positions[i % C.positions.length], role = (p) => (tall ? (p === 'c' ? 'c' : p.startsWith('t') ? 'tc' : 'bc') : p);
  names.forEach(([r, n, after], i) => { const at = sec(lead + i * per, fps), dur = sec(per - 22, fps), pos = role(pick(i)), size = tall ? 74 : 84;
    gfx.push({ id: 'title.namesOver', at, dur, params: { role: r, name: n, style, pos, accent: C.brand.accent, size, padY: barPx ? barPx + Math.round(64 * s) : 0 } });
    if (after) gfx.push({ id: 'title.namesOver', at: +(at + 0.5).toFixed(4), dur: +(dur - 0.5).toFixed(4), params: { role: '', name: after.toUpperCase(), style: 'drift', pos: pos === 'c' ? [0.5, 0.62] : pos, size: 34, padY: barPx ? barPx + Math.round(14 * s) : 0 } });
    const fs = Math.min(size * s, (W * 0.8) / Math.max(4, n.length * 0.6)), pad = barPx ? barPx + 64 * s : 54, y = pos.startsWith('t') ? (tall ? 269 : pad) + fs * 1.55 : pos.startsWith('b') ? (tall ? 1248 : H - pad) - fs * 0.2 : H / 2 + fs * 0.4;
    texts.push({ text: n, t: [at, +(at + dur).toFixed(4)], box: textBox(n, { W, H, fontPx: fs, y, weight: 800 }), fontPx: Math.round(fs), role: 'headline', fg: '#F2F2F2' });
    cues.push({ id: style === 'type' ? C.sfx.type : C.sfx.name, t: at, why: 'a name lands on the bar' }); });
  const tStyle = C.film.titleStyle || G.title, ta = sec(titleAt, fps);
  gfx.push({ id: tStyle, at: ta, dur: sec(titleF - 15, fps), params: { text: C.film.title, size: tall ? 140 : 180 } });
  texts.push({ text: C.film.title, t: [ta, sec(endAt - 15, fps)], box: textBox(C.film.title, { W, H, fontPx: Math.min((tall ? 140 : 180) * s, W * 0.85 / (C.film.title.length * 0.62)), y: H / 2 + 50 * s }), fontPx: Math.round(Math.min((tall ? 140 : 180) * s, W * 0.85 / (C.film.title.length * 0.62))), role: 'headline', fg: '#F2F2F2' });
  cues.push({ id: C.sfx.title, t: ta, why: 'the main title hit' });
  const ea = sec(endAt, fps); gfx.push({ id: 'title.namesOver', at: ea, dur: sec(endF + 12, fps), params: { role: C.text.directedBy[0], name: C.text.directedBy[1], style, pos: 'c', accent: C.brand.accent, size: tall ? 74 : 84, padY: barPx } });
  cues.push({ id: C.sfx.last, t: ea, why: 'the last card' }); holds.push({ t: [sec(endAt + endF, fps), T], why: 'the picture holds before the film starts' });
  const layers = { grain: C.layers.grain ?? G.grain, dust: C.layers.dust ?? G.dust, vignette: C.layers.vignette ?? G.vignette };
  /* the beats on the title-sequence beat sheet (patterns/structures.json `title-sequence`; tools/structure_check.py reads plan.structure): the motif is the texture alone
     plus the "presents" card when the first credit has one; the credits run to the title; the main title and its "directed by" card are one title block (the pattern has no beat
     after the main title, and this template puts "directed by" last on purpose) */
  const motifEnd = names.length && names[0][2] ? sec(lead + per, fps) : sec(lead, fps);
  const structure = { pattern: 'title-sequence', sections: [{ name: 'motif', t: [0, motifEnd] }, { name: 'credits', t: [motifEnd, ta] }, { name: 'maintitle', t: [ta, T] }] };
  return { template: 'title-sequence', structure, fps, seconds: T, W, H, aspect: asp, platform: C.platform || (tall ? 'reels.organic' : 'x.video'), genre: C.genre in FILM_GENRES ? C.genre : 'thriller', bars: barPx, letterbox: lb || null,
    music, bpm: +(fps * 60 / fpb).toFixed(3), framesPerBeat: fpb, shots, gfx, cues, burns: [], flares: [], flashes: [], texts, holds, claims: C.claims, labels: { film: C.text.label, slots: true }, layers,
    eyes: { letterbox: !!barPx }, audio: { mode: 'music', role: 'trailer', events: gfx.map((g) => g.at) }, ceilingDb: -2.5, paceRule: { aslMax: 20, longMax: 60 } };
}
