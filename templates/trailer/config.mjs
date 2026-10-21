/* TEMPLATE trailer: a film trailer from ONE plan, with 30 s and 15 s cut-downs and a 9:16 re-layout (2026-10-16, film lane). HyperFrames.
   Shape (craft from how trailers are built, docs/evidence/film-trailer-craft.md; nothing copied from any trailer):
     cold open (a strong image already moving, a line of dialogue) -> YOUR production card (original design, your company name) -> the world -> the inciting beat ->
     act 2 montage (cut rate doubles, braam stabs, interstitial cards) -> act 3 wall (cuts on every beat then every 8th note, a braam on every bar) ->
     the silence before the hit -> the TITLE on the hit -> a button (one more beat and a sting) -> the credit block -> the release card.
   The music is the clock: the genre trailer score (music/trailer_styles.py) is rendered for exactly this cut (whole bars per act), and every section starts on its markers.
   Edit the CONFIG block only. `node make.mjs [--set length=30] [--set aspect=9:16] [--set genre=scifi]`, then render (make.mjs prints the command).
   DEMO: "THE LAST SIGNAL" is a FICTIONAL film by the fictional "ORBIT PICTURES"; every shot is a labelled procedural placeholder plate, every name a placeholder, the quote is a
   labelled placeholder with a placeholder source, the date is a labelled placeholder. Put your footage in CONFIG.media.<slot>.src and your words in CONFIG.text. */
import { FRAME, SCORES, fpbOf, scoreMarkers, montage, montageIn, textBox, subLines, slotOf, readS } from '../_shared/film/plan-film.mjs';
import { FILM_GENRES } from '../../layers/presets/film-looks.js';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'ORBIT PICTURES', accent: '#9FD3FF', ink: '#F2F4F7', paper: '#000000', logo: null, url: 'orbit.example', cta: 'COMING SOON', font: { display: 'Manrope', text: 'Manrope' } },
  platform: null,                  // null = by aspect ('x.video' for 16:9, 'reels.organic' for 9:16); any templates/_shared/plan.mjs PLATFORMS key
  fps: 30,
  length: 'full',                  // 'full' (about 60-75 s, by the score's tempo) | 30 | 15: the cut-downs come from this same plan
  aspect: '16:9',                  // '16:9' (letterboxed) | '9:16' (re-laid out full frame, no bars)
  genre: 'thriller',               // layers/presets/film-looks.js FILM_GENRES: thriller | scifi | horror | drama | documentary | noir | period | anime-ink
  letterbox: 2.39,                 // 16:9 only: 2.39 | 2.0 | 1.85 | null (the genre default when undefined)
  film: { title: 'THE LAST SIGNAL', titleStyle: null, titleSub: '' },   // titleStyle null = the genre's (title.trailerSlab | trailerThin | trailerDistressed | trailerGlow | trailerCut)
  text: {
    label: 'placeholder footage · fictional film',   // the honesty pill, on screen the whole time (remove it only with real footage of a real film)
    production: 'PRESENTS',
    cold: [{ text: 'Relay North. Do you copy?', speaker: 'radio' }, { text: 'Who is this?' }],
    world: 'ON THE EDGE OF THE MAP',
    incite: [{ text: 'That ship went down before you were born.' }, { text: 'Then who is calling?' }],
    cards: ['THIS WINTER', 'ONE SIGNAL', 'WILL CROSS', 'THE DARK'],
    makers: { kicker: 'FROM THE MAKERS OF', work: 'YOUR PREVIOUS FILM', placeholder: true },   // null to drop; placeholder: false once `work` is real
    quote: { quote: 'PLACEHOLDER QUOTE: REPLACE WITH A REAL, ATTRIBUTED LINE', source: 'placeholder source' },   // null to drop; a quote with no source renders a red card
    silence: 'Are you still there?',
    button: 'Hello?',
    credits: null,                 // null = credits.billingBlock's placeholder block; or [[[role, NAME], ...], ...] lines
    dateTop: 'THIS WINTER', date: 'DECEMBER 12', datePlaceholder: true, url: 'orbit.example',
  },
  media: {                         // every footage slot; src null = a labelled placeholder plate (templates/_shared/film/plates.js); start = in-point (s); step = how far each re-use moves the in-point
    radio: { src: null, start: 0, plate: 'radio', label: 'radio close-up' }, window: { src: null, start: 0, plate: 'window', label: 'rain window' },
    coast: { src: null, start: 0, plate: 'coast', label: 'coast at night' }, corridor: { src: null, start: 0, plate: 'corridor', label: 'corridor' },
    signal: { src: null, start: 0, plate: 'signal', label: 'the signal' }, ship: { src: null, start: 0, plate: 'ship', label: 'ship in fog' },
    lamp: { src: null, start: 0, plate: 'lamp', label: 'swinging lamp' }, road: { src: null, start: 0, plate: 'road', label: 'night road' },
    storm: { src: null, start: 0, plate: 'storm', label: 'storm' }, sky: { src: null, start: 0, plate: 'sky', label: 'night sky' },
  },
  shots: { cold: ['radio', 'window'], world: ['coast', 'corridor'], incite: ['signal', 'ship'], montage: ['lamp', 'road', 'corridor', 'storm', 'sky', 'window', 'ship', 'coast', 'radio', 'signal'], button: 'radio' },
  claims: [],                      // any on-screen digit needs { text, source } (lint.proof); this trailer shows none
  cuts: {                          // target seconds per section and cut; make.mjs rounds them to whole bars of the score (the music is the clock)
    full: { cold: 8, production: 4, world: 8, incite: 8, act2: 12, act3: 12, button: 4, tail: 8 },
    30: { cold: 4, production: 2, world: 0, incite: 4, act2: 4, act3: 6, button: 2, tail: 4 },
    15: { cold: 2, production: 0, world: 0, incite: 0, act2: 2, act3: 4, button: 0, tail: 2 },
  },
  score: { style: null, seed: 1 }, // null = the genre's score (music/trailer_styles.py: thriller | scifi | horror | drama)
  transitions: {                   // [id, Murch reason]: lint refuses an unmotivated transition
    'cold>production': ['transitions/dip-to-black', 'RHYTHM: the cold open lands, the frame breathes before the card'],
    'world>incite': ['transitions/film-burn', 'EMOTION: the calm world burns away when the signal arrives'],
    'production>world': ['transitions/dissolve', 'PLACE: out of the card into the world'],
  },
  flashEvery: 2,                   // act 3: a white flash frame on every 2nd bar downbeat (WCAG: far under 3 a second)
  sfx: { room: 'sfx/amb/room_tone', radio: 'sfx/trailer/radio_static_loop', card: 'sfx/trailer/metal_hit', pass: 'sfx/trailer/whoosh_by', incite: 'sfx/trailer/boom_hit', production: 'sfx/trailer/sub_drop_long',
    stop: 'sfx/trailer/whoosh_suck', into: 'sfx/trailer/reverse_braam', button: 'sfx/trailer/sting_button', flash: 'sfx/tx/flash_swell', quote: 'sfx/trailer/boom_metal' },
  layers: {},                      // overrides of the genre finish: { grain, dust, vignette }
};
/* ============================================================================== */

/* the shared project file (lane 6: templates/_shared/project.schema.json) -> this CONFIG */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.url': 'brand.url', 'brand.cta': 'text.date', 'brand.logo': 'brand.logo', 'brand.font.display': 'brand.font.display',
  'text.headline': 'film.title', 'text.title': 'film.title', 'text.hook': 'text.cold.0.text', 'text.lines': 'text.cards', 'text.cta': 'text.date', 'text.label': 'text.label',
  'media.hero': 'media.coast', 'media.screen': 'media.radio', 'media.broll': 'media.lamp', 'music': 'score.style', 'aspects': 'aspect' };

const sec = (f, fps) => +(f / fps).toFixed(6);
export function buildPlan(C) {
  const asp = FRAME[C.aspect] ? C.aspect : '16:9', [W, H] = FRAME[asp], tall = H > W, fps = C.fps, G = FILM_GENRES[C.genre] || FILM_GENRES.thriller, style = C.score.style || G.score;
  const P = SCORES[style] ? SCORES[style] : SCORES.thriller, fpb = fpbOf(P.bpm, fps), barS = 4 * fpb / fps, beatS = fpb / fps;
  const cut = C.cuts[String(C.length)] || C.cuts.full, bars = (x) => (x > 0 ? Math.max(1, Math.round(x / barS)) : 0);
  const B = { cold: Math.max(1, bars(cut.cold)), production: bars(cut.production), world: bars(cut.world), incite: bars(cut.incite), act2: bars(cut.act2), act3: Math.max(1, bars(cut.act3)) };
  if (B.incite + B.act2 === 0) B.act2 = 1;
  if (typeof C.length === 'number') {   // a cut-down fits its length: trim whole bars (largest section first) while the cut runs over by more than a beat
    const fixed = (P.gap + 4 * P.cresc + P.ring) * beatS + (cut.button > 0 ? Math.max(2, Math.round(cut.button / beatS)) : 0) * beatS + Math.max(4, Math.round(cut.tail / beatS)) * beatS;
    for (let guard = 0; guard < 40; guard++) { const tot = fixed + (B.cold + B.production + B.world + B.incite + B.act2 + B.act3) * barS; if (tot <= C.length + beatS) break;
      const k = ['act2', 'incite', 'world', 'production', 'act3', 'cold'].filter((x) => B[x] > (x === 'cold' || x === 'act3' ? 1 : 0)).sort((a, b) => B[b] - B[a])[0]; if (!k) break; B[k]--; if (B.incite + B.act2 === 0) { B[k]++; break; } }
  }
  const actBars = [B.cold + B.production + B.world, B.incite + B.act2, B.act3], buttonBeats = cut.button > 0 ? Math.max(2, Math.round(cut.button / beatS)) : 0, tailBeats = Math.max(4, Math.round(cut.tail / beatS));
  const M = scoreMarkers(style, fps, actBars, buttonBeats, tailBeats), Fm = M.frames, bar = 4 * fpb, T = sec(Fm.end, fps);
  const shots = [], gfx = [], cues = [], texts = [], burns = [], flares = [], flashes = [], holds = [], s = Math.min(W, H) / 1080;
  const plat = C.platform || (tall ? 'reels.organic' : 'x.video'), lb = tall ? null : (C.letterbox === undefined ? G.bars : C.letterbox), barPx = lb && W / H < lb ? Math.round((H - W / lb) / 2) : 0;
  const picY0 = barPx, picY1 = H - barPx, subY = tall ? 1180 : picY1 - 46 * s;   // subtitles sit inside the picture (9:16: above the bottom UI band)
  let uses = {}; const slot = (name) => { const k = uses[name] = (uses[name] ?? -1) + 1; return slotOf(C, name, k); };
  const tr = (k) => C.transitions[k] || null;
  const add = (o) => { const sh = { ...o, start: sec(o.f0, fps), dur: sec(o.f1 - o.f0, fps) }; delete sh.f0; delete sh.f1; shots.push(sh); return sh; };
  const shot = (id, sec_, f0, f1, name, extra = {}) => add({ id, sec: sec_, f0, f1, ...slot(name), ...extra });
  const black = (id, sec_, f0, f1, extra = {}) => add({ id, sec: sec_, kind: 'black', f0, f1, ...extra });
  const sub = (lines, t0, t1, sp) => { for (const l of subLines(lines, { at: t0 + 0.3, gap: 0.35 })) { const d = Math.min(l.dur, t1 - 0.15 - l.at); if (d < 0.6) continue;
      gfx.push({ id: 'caption.filmSubtitle', at: l.at, dur: +d.toFixed(4), params: { text: l.text, speaker: l.speaker || sp || '', y: subY / H } });
      texts.push({ text: l.text, t: [l.at, +(l.at + d).toFixed(4)], box: textBox(l.text, { W, H, fontPx: 44 * s * (tall ? 1.35 : 1), y: subY, weight: 600 }), fontPx: Math.round(44 * s * (tall ? 1.35 : 1)), role: 'caption', fg: '#FFFFFF' }); } };
  const card = (txt, t0, d, size = 120) => { gfx.push({ id: 'title.trailerThin', at: t0, dur: d, params: { text: txt, size, y: 0.5, track: [0.3, 0.42] } });
    texts.push({ text: txt, t: [t0, +(t0 + d).toFixed(4)], box: textBox(txt, { W, H, fontPx: Math.min(size * s, W * 0.9 / Math.max(4, txt.length * 0.85)), y: H * 0.5 + 40 * s, weight: 200, ls: 0.4 }), fontPx: Math.round(Math.min(size * s, W * 0.9 / Math.max(4, txt.length * 0.85))), role: 'headline', fg: '#F2F4F7' }); };
  const F = (beats) => beats * fpb;
  /* ---- act 1: cold open -> production card -> the world */
  let f = 0; const coldEnd = F(4 * B.cold), coldShots = C.shots.cold.slice(0, Math.max(1, Math.min(C.shots.cold.length, B.cold)));
  coldShots.forEach((nm, i) => { const a = Math.round(coldEnd * i / coldShots.length / fpb) * fpb, b = Math.round(coldEnd * (i + 1) / coldShots.length / fpb) * fpb; const sh = shot('cold' + i, 'cold', a, b, nm);
    sub(C.text.cold.slice(i, i + 1), sh.start, sh.start + sh.dur, nm === 'radio' ? 'radio' : ''); });
  f = coldEnd;
  if (B.production) { const sh = black('production', 'production', f, f + F(4 * B.production), tr('cold>production') ? { tx: tr('cold>production')[0], txReason: tr('cold>production')[1], txKind: 'dip', txDur: 0.8 } : {});
    gfx.push({ id: 'card.production', at: sh.start + 0.25, dur: Math.max(0.8, sh.dur - 0.9), params: { name: C.brand.name, line: C.text.production, accent: C.brand.accent } });
    texts.push({ text: C.brand.name, t: [sh.start + 0.6, +(sh.start + sh.dur - 0.3).toFixed(4)], box: textBox(C.brand.name, { W, H, fontPx: 74 * s, y: H / 2 + 46 * s, weight: 300, ls: 0.3 }), fontPx: Math.round(74 * s), role: 'headline', fg: '#ECEEF2' });
    cues.push({ id: C.sfx.production, t: sh.start, why: 'the production card lands on a slow sub drop' }); f += F(4 * B.production); }
  if (B.world) { const n = Math.min(C.shots.world.length, B.world), w0 = f; C.shots.world.slice(0, n).forEach((nm, i) => { const a = w0 + Math.round(F(4 * B.world) * i / n / fpb) * fpb, b = w0 + Math.round(F(4 * B.world) * (i + 1) / n / fpb) * fpb;
      const sh = shot('world' + i, 'world', a, b, nm, i === 0 && tr('production>world') && B.production ? { tx: tr('production>world')[0], txReason: tr('production>world')[1], txKind: 'dissolve', txDur: 0.8 } : {});
      if (i === 0 && C.text.world) card(C.text.world, +(sh.start + 0.6).toFixed(4), +Math.min(3.2, sh.dur - 0.9).toFixed(4), 96);
      if (nm === 'coast' || i === 0) flares.push({ at: +(sh.start + 0.4).toFixed(4), dur: +Math.min(3.0, sh.dur - 0.5).toFixed(4), color: G.flare, sweepFrom: [0.85, 0.32], sweepTo: [0.62, 0.36], intensity: 0.55 }); });
    f += F(4 * B.world); }
  /* ---- act 2: the inciting beat -> the montage (cut rate doubles), cards on the braam downbeats */
  const a2 = Fm.act2_start, a3 = Fm.act3_start; f = a2;
  if (B.incite) { const n = Math.min(C.shots.incite.length, B.incite), i0 = f; C.shots.incite.slice(0, n).forEach((nm, i) => { const a = i0 + Math.round(F(4 * B.incite) * i / n / fpb) * fpb, b = i0 + Math.round(F(4 * B.incite) * (i + 1) / n / fpb) * fpb;
      const burnIn = i === 0 && tr('world>incite') && (B.world || B.production);
      const sh = shot('incite' + i, 'incite', a, b, nm, burnIn ? { tx: tr('world>incite')[0], txReason: tr('world>incite')[1], txKind: 'filmBurn', txDur: 0.9 } : {});
      if (burnIn) { burns.push({ at: sh.start, dur: 0.9, from: 'left', colors: G.burn }); cues.push({ id: 'sfx/tx/film_burn', t: +(sh.start - 0.3).toFixed(4), why: 'the burn swells into the cut' }); }
      if (i === 0) cues.push({ id: C.sfx.incite, t: sh.start, why: 'the inciting beat: the signal arrives' });
      sub(C.text.incite.slice(i, i + 1), sh.start, sh.start + sh.dur); });
    f = i0 + F(4 * B.incite); }
  const pool = C.shots.montage; let pk = 0; const next = () => pool[pk++ % pool.length];
  const runMontage = (f0, f1, act, prefix, cards, cardEvery, cardBeats, quote) => {
    const cardAt = new Map(); let ci = 0;
    for (let b = f0, k = 0; b < f1 && ci < cards.length; b += bar * cardEvery, k++) if ((k > 0 || act === 'act3') && b + F(cardBeats) <= f1) cardAt.set(b, cards[ci++]);
    const spans = [], cs = [...cardAt.keys()].sort((x, y) => x - y); let p0 = f0;
    for (const c of cs) { if (c > p0) spans.push([p0, c]); p0 = c + F(cardBeats); } if (p0 < f1) spans.push([p0, f1]);
    let pts = [...cs, ...spans.flatMap(([x, y]) => montageIn(f0, f1, x, y, fpb, act))].sort((x, y) => x - y);
    if (act === 'act3') {   // the wall: every bar downbeat is a cut (the score's braam lands there); montage cuts closer than half a beat to one give way
      const down = []; for (let d = f0; d < f1; d += bar) if (!cs.some((c) => d > c && d < c + F(cardBeats))) down.push(d);
      const keep = new Set([...cs, ...down]), hb = Math.round(fpb / 2); pts = [...new Set([...pts, ...down])].sort((x, y) => x - y).filter((x) => keep.has(x) || ![...keep].some((k) => Math.abs(k - x) < hb)); }
    pts.forEach((a, i) => { const b = i + 1 < pts.length ? pts[i + 1] : f1, c = cardAt.get(a);
      if (c) { const sh = black(`${prefix}card${i}`, prefix, a, b);
        if (c.kind === 'makers') { gfx.push({ id: 'card.fromTheMakers', at: sh.start, dur: Math.max(0.5, sh.dur - 0.3), params: { kicker: c.kicker, work: c.work, placeholder: c.placeholder !== false } }); texts.push({ text: c.work, t: [sh.start + 0.3, +(sh.start + sh.dur).toFixed(4)], box: textBox(c.work, { W, H, fontPx: 96 * s, y: H / 2 + 34 * s }), fontPx: Math.round(96 * s), role: 'headline', fg: '#EDEFF2' }); }
        else if (c.kind === 'quote') { gfx.push({ id: 'card.quote', at: sh.start, dur: Math.max(0.5, sh.dur - 0.3), params: { quote: c.quote, source: c.source } }); cues.push({ id: C.sfx.quote, t: sh.start, why: 'quote card slam' }); }
        else if (act === 'act3') { const st = C.film.titleStyle || G.title, fz = tall ? 120 : 150; gfx.push({ id: st, at: sh.start, dur: Math.max(0.4, +(sh.dur - 0.25).toFixed(4)), params: { text: c.text, size: fz, sweepAt: 0.05, sweepDur: 0.6 } });
          texts.push({ text: c.text, t: [sh.start, +(sh.start + sh.dur).toFixed(4)], box: textBox(c.text, { W, H, fontPx: Math.min(fz * s, W * 0.85 / (c.text.length * 0.62)), y: H / 2 + 40 * s }), fontPx: Math.round(Math.min(fz * s, W * 0.85 / (c.text.length * 0.62))), role: 'headline', fg: '#F2F4F7' }); }   // act 3 escalates: the cards take the title's weight
        else card(c.text, sh.start, Math.max(0.4, +(sh.dur - 0.1).toFixed(4)), tall ? 110 : 130);
        if (c.kind !== 'quote') cues.push({ id: C.sfx.card, t: sh.start, why: 'interstitial card' }); }
      else { const sh = shot(`${prefix}${i}`, prefix, a, b, next()); if (act === 'act2' && i % 2 === 1) cues.push({ id: C.sfx.pass, t: sh.start, why: 'pass-by on the cut' }); } });
  };
  const cards = C.text.cards.map((t) => ({ text: t })), a2cards = [...(C.text.makers && String(C.length) === 'full' ? [{ kind: 'makers', ...C.text.makers }] : []), ...cards.slice(0, 2)];
  if (B.act2) runMontage(f, a3, 'act2', 'm2_', a2cards, 2, 4, false);
  /* ---- act 3: the wall: every bar a braam (in the score), cards and the quote on downbeats, a flash every `flashEvery` bars */
  const a3cards = [...cards.slice(2), ...(C.text.quote && String(C.length) !== '15' ? [{ kind: 'quote', ...C.text.quote }] : [])].slice(0, Math.max(0, B.act3 - 1));
  runMontage(a3, Fm.gap_start, 'act3', 'm3_', a3cards.length && B.act3 >= 2 ? a3cards : [], 2, 3, true);
  for (let b = a3 + bar, k = 1; b < Fm.gap_start; b += bar, k++) if (k % C.flashEvery === 0) { flashes.push(sec(b, fps)); cues.push({ id: C.sfx.flash, t: sec(b, fps), why: 'flash frame on the bar' }); }
  /* ---- the silence before the hit, the (optional) crescendo, the TITLE on the hit */
  const g = black('silence', 'silence', Fm.gap_start, Fm.crescendo_start); holds.push({ t: [g.start, +(g.start + g.dur).toFixed(4)], why: 'the silence before the hit' });
  cues.push({ id: C.sfx.stop, t: sec(Fm.gap_start - 1, fps), why: 'the suck ends on the stop frame' });
  if (C.text.silence) sub([C.text.silence], g.start, g.start + g.dur);
  if (Fm.hit > Fm.crescendo_start) runMontage(Fm.crescendo_start, Fm.hit, 'act3', 'cr_', [], 99, 0, false);
  const titleStyle = C.film.titleStyle || G.title, ti = black('title', 'title', Fm.hit, Fm.button_start, { hold: true });
  gfx.push({ id: titleStyle, at: ti.start, dur: Math.max(0.6, ti.dur - 0.35 + (Fm.tail_start - Fm.button_start === 0 ? 0 : 0)), params: { text: C.film.title, sub: C.film.titleSub || '', size: tall ? 150 : 190 } });
  texts.push({ text: C.film.title, t: [ti.start, +(ti.start + ti.dur).toFixed(4)], box: textBox(C.film.title, { W, H, fontPx: Math.min((tall ? 150 : 190) * s, (W * 0.85) / (C.film.title.length * 0.62)), y: H / 2 + 50 * s, weight: 800 }), fontPx: Math.round(Math.min((tall ? 150 : 190) * s, (W * 0.85) / (C.film.title.length * 0.62))), role: 'headline', fg: '#F2F4F7' });
  flares.push({ at: +(ti.start + 0.05).toFixed(4), dur: +Math.max(0.8, ti.dur).toFixed(4), color: G.flare, sweepFrom: [-0.1, 0.5], sweepTo: [1.1, 0.5], intensity: 0.75 });
  cues.push({ id: C.sfx.into, t: ti.start, why: 'the reverse braam ends on the title hit' });
  /* ---- the button, the credit block, the release card */
  if (Fm.tail_start > Fm.button_start) { const bt = Fm.button_start, be = Fm.tail_start, cutB = be - Math.max(fpb, Math.round(0.4 * fps)), sh = shot('button', 'button', bt, cutB, C.shots.button);
    sub([C.text.button], sh.start, sh.start + sh.dur); black('button_out', 'button', cutB, be); cues.push({ id: C.sfx.button, t: sec(cutB, fps), why: 'the button sting on the cut to black' });
    cues.push({ id: C.sfx.radio, t: sh.start, untilT: sec(cutB, fps), overBedDb: -4, why: 'the radio, alone, in the button' }); }
  const cr = black('credits', 'tail', Fm.tail_start, Fm.final_hit), rd = black('release', 'tail', Fm.final_hit, Fm.end, { hold: true });
  if (cr.dur > 0.5) { gfx.push({ id: 'title.trailerSlab', at: cr.start, dur: Math.max(0.5, cr.dur - 0.4), params: { text: C.film.title, size: tall ? 70 : 64, y: tall ? 0.34 : 0.3, sweepAt: 99 } });
    gfx.push({ id: 'credits.billingBlock', at: cr.start + 0.15, dur: Math.max(0.5, cr.dur - 0.55), params: { y: tall ? 0.56 : 0.6, ...(C.text.credits ? { lines: C.text.credits } : {}) } }); }
  gfx.push({ id: 'card.releaseDate', at: rd.start, dur: Math.max(0.6, rd.dur - 0.4), params: { top: C.text.dateTop, date: C.text.date, url: C.text.url || C.brand.url, placeholder: C.text.datePlaceholder !== false, size: tall ? 120 : 150 } });
  texts.push({ text: C.text.date, t: [rd.start, +(rd.start + rd.dur - 0.4).toFixed(4)], box: textBox(C.text.date, { W, H, fontPx: (tall ? 120 : 150) * s * 0.9, y: H / 2 + 50 * s, weight: 800, ls: 0.06 }), fontPx: Math.round((tall ? 120 : 150) * s * 0.9), role: 'endcard', fg: '#F3F4F6' });
  holds.push({ t: [rd.start, T], why: 'the release card' });
  /* ---- sound under the picture: room tone and radio static in the cold open, the score carries the rest */
  cues.push({ id: C.sfx.room, t: 0, untilT: sec(coldEnd, fps), overBedDb: -18, why: 'room tone under the cold open' });
  shots.filter((x) => x.sec === 'cold' && (x.plate === 'radio' || x.label === 'radio close-up')).forEach((x) => cues.push({ id: C.sfx.radio, t: x.start, untilT: +(x.start + x.dur).toFixed(4), overBedDb: -2, why: 'radio static under the radio shot' }));
  const quiet = [{ t: [sec(Fm.gap_start, fps), sec(Fm.crescendo_start, fps)], kind: 'gap', why: 'the silence before the hit (score gap)' }];
  if (Fm.tail_start > Fm.button_start) quiet.push({ t: [+(sec(Fm.button_start, fps) + 1.5).toFixed(4), sec(Fm.tail_start, fps)], kind: 'dip', why: 'the button: the hit has rung out, only the radio' });
  const layers = { grain: C.layers.grain ?? G.grain, dust: C.layers.dust ?? G.dust, vignette: C.layers.vignette ?? G.vignette };
  /* the beats on the trailer beat sheet (patterns/structures.json `trailer`; tools/structure_check.py reads plan.structure): the production card, the world and the
     inciting beat are act 1; the planned silence is the title's gap (the pattern lists `gap` under title); the billing block and the release card are the date card */
  const BEAT = { cold: 'coldopen', production: 'act1', world: 'act1', incite: 'act1', m2_: 'act2', m3_: 'act3', silence: 'title', title: 'title', button: 'button', tail: 'date' }, beats = [];
  for (const x of shots) { const name = BEAT[x.sec] || x.sec, b = beats.at(-1), end = +(x.start + x.dur).toFixed(4); if (b && b.name === name) b.t[1] = Math.max(b.t[1], end); else beats.push({ name, t: [x.start, end] }); }
  const structure = { pattern: 'trailer', sections: beats };
  return { template: 'trailer', structure, fps, seconds: T, W, H, aspect: asp, cut: String(C.length), platform: plat, genre: C.genre in FILM_GENRES ? C.genre : 'thriller', bars: barPx, letterbox: lb || null,
    score: { style, seed: C.score.seed ?? 1, act_bars: M.act_bars, button_beats: M.button_beats, tail_beats: M.tail_beats, markers: Fm }, bpm: M.bpm, framesPerBeat: fpb,
    shots, gfx, cues: cues.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)), burns, flares, flashes, texts, holds, black: shots.filter((x) => x.kind === 'black' && x.sec === 'silence').map((x) => [x.start, +(x.start + x.dur).toFixed(4)]),
    claims: C.claims, labels: { film: C.text.label, slots: true }, layers, eyes: { letterbox: !!barPx },
    audio: { mode: 'music', role: 'trailer', quiet, events: [sec(Fm.act2_start, fps), sec(Fm.act3_start, fps), sec(Fm.hit, fps), sec(Fm.final_hit, fps)] },
    ceilingDb: -2.5, paceRule: { aslMax: 3.0, longMax: 6.5 } };
}
