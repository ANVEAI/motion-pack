/* TEMPLATE podcast-clip: a two-person podcast excerpt for Shorts / Reels (9:16 FIRST) and a 16:9 re-layout.
   Frame 0: a title hook card already moving over both faces (the claim of the clip, in at most 7 words). Then: both speakers stacked (9:16) or side by side (16:9), or
   layout 'active' = one full-frame speaker at a time; ACTIVE-SPEAKER EMPHASIS from the speaker tags in words.json (the talker is full brightness with an accent ring, the listener dims;
   the picture follows the voice with a 220 ms L-cut lag and holds each shot at least 1.4 s, so it never flickers); a lower third for each speaker the first time they talk
   (tied to the speaker tag, never guessed from a face); a waveform from the mix; karaoke captions; a "full episode" end card.
   INPUT (yours): media.host.src / media.guest.src = the two camera angles (synced: same timeline), media.mix.src = the episode audio (or null to use host / guest audio),
   clip.from / clip.to = the excerpt in source seconds, voice.words = the transcript with speaker tags (VTT <v Name>, whisper diarisation, or "NAME:" lines in an SRT).
   DEMO (no footage, no people): two labelled silhouettes, a guide signal per speaker at the hand-timed words of transcript.example.vtt, placeholder names ("Host name", "Guest name"). */
import path from 'node:path';
import { aspectOf, atOf, fixSets, safeBox } from '../_shared/human/core.mjs';
import { speakerTurns, activeCuts, activeAt, speakerLowerThirds, pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { loadWords, emphasize, cuesFor, audioFields, tagOf, talkTrack, talkSlots } from '../_shared/human/kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  brand: { name: 'Your show', accent: '#FFB020', ink: '#111111', paper: '#FFFFFF', logo: null, url: 'yourshow.example', cta: 'Full episode: link in bio', font: { display: 'Manrope', text: 'Manrope' } },
  platform: 'shorts', fps: 30, length: 'auto', aspect: '9:16', aspects: ['9:16', '16:9'],
  text: { hook: 'Stop posting every day?', kicker: 'From the episode', end: 'Full episode: link in bio', endKicker: 'Your show' },
  speakers: { Host: { name: 'Host name', role: 'Host · placeholder', slot: 'host' }, Guest: { name: 'Guest name', role: 'Guest · placeholder', slot: 'guest' } },
  media: { host: { src: null, start: 0, label: 'host camera' }, guest: { src: null, start: 0, label: 'guest camera' }, mix: { src: null, start: 0, label: 'episode audio' } },
  clip: { from: null, to: null },               // source seconds of the excerpt (null = the whole transcript)
  voice: { words: 'words.json', audio: 'mix', chain: true, placeholder: 'guide' },   // audio: 'mix' (one episode track) | 'speaker' (each speaker's own camera audio)
  layout: { '9:16': 'stack', '16:9': 'split' },  // 'stack' | 'split' | 'active'
  active: { lagMs: 220, minShot: 1.4, dim: 0.5, ring: 8, grow: 0.0 },
  autocut: { on: true, silenceMin: 0.55, padBefore: 0.06, padAfter: 0.09, breath: 0.12, beatHold: 0.45 },
  fillers: { cut: 'hard' },
  captions: { style: 'karaoke', emph: ['finishing', 'finished', 'stayed', 'watched.'] },
  waveform: { bars: 40, window: 1.8 },
  end: { holdS: 2.2 },
  claims: [],
  music: 'music/bed_ambient_pad_loop8', musicGainDb: -8, duckDb: 14, ceilingDb: -2.0,   // a podcast clip barely needs music: a quiet pad, ducked deep
  layers: [ { kind: 'vignette', params: { amount: 0.06 } }, { kind: 'grain', params: { stock: 'upload-safe' } } ],
};
/* ============================================================================== */
export const PROJECT_MAP = { 'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta', 'brand.font': 'brand.font',
  'text.headline': 'text.hook', 'text.kicker': 'text.kicker', 'text.cta': 'text.end', 'media.speaker': 'media.host', 'media.host': 'media.host', 'media.guest': 'media.guest', 'media.audio': 'media.mix', 'voice.words': 'voice.words', music: 'music', aspects: 'aspects' };

const LAYOUT = {
  '9:16': { stack: { host: [0, 0, 1080, 960], guest: [0, 960, 1080, 960] }, full: [0, 0, 1080, 1920], lt: { host: [0.05, 0.55], guest: [0.05, 0.12] }, wave: [0.52, 0.575, 0.42, 0.06], hookPos: 'tc', capBox: { x0: 65, x1: 960, y0: 875, y1: 1045 } },
  '16:9': { split: { host: [0, 0, 960, 1080], guest: [960, 0, 960, 1080] }, full: [0, 0, 1920, 1080], lt: { host: [0.08, 0.7], guest: [0.08, 0.7] }, wave: [0.38, 0.06, 0.24, 0.07], hookPos: 'tc', capBox: null },
};

export function buildPlan(C0) {
  const C = fixSets(C0), A = aspectOf(C), L = LAYOUT[C.aspect] || LAYOUT['9:16'], fps = C.fps, tag = tagOf(C.aspect, '9:16'), r3 = (x) => +(+x).toFixed(3), warnings = [];
  let raw = emphasize(loadWords(HERE, C.voice.words), C.captions.emph);
  if (C.clip.from != null || C.clip.to != null) raw = raw.filter((w) => w.s >= (C.clip.from ?? -1) && w.e <= (C.clip.to ?? 1e9));
  const names = Object.keys(C.speakers); for (const w of raw) if (!w.speaker) w.speaker = names[0];
  const unknown = [...new Set(raw.map((w) => w.speaker))].filter((s) => !C.speakers[s]); if (unknown.length) warnings.push('speaker tags with no entry in CONFIG.speakers: ' + unknown.join(', '));
  const tr = talkTrack(raw, { fps, autocut: C.autocut, fillers: C.fillers }), words = tr.words, talkEnd = tr.seconds, T = +(talkEnd + C.end.holdS).toFixed(4);
  const turns = speakerTurns(words), cuts = activeCuts(turns, { lagMs: C.active.lagMs, minShot: C.active.minShot }), mode = C.layout[C.aspect] || 'stack';
  /* picture */
  const slots = [], screenGfx = {};
  const ph = (spk, i) => ({ label: 'SPEAKER PLACEHOLDER', slot: C.speakers[spk].slot, name: C.speakers[spk].name, tint: ['#2E3B4E', '#4A3A2E'][i % 2], seed: 3 + i * 4, chipPos: C.aspect === '9:16' && i === 0 ? 'bl' : 'tl' });
  names.forEach((spk, i) => {
    const sl = C.speakers[spk].slot, m = C.media[sl];
    if (mode === 'active') { cuts.forEach((c, k) => { if (c.speaker !== spk) return; const w = [c.t, k + 1 < cuts.length ? cuts[k + 1].t : talkEnd];
      slots.push(...talkSlots(tr.segs, { id: `${sl}-c${k}`, src: m.src, srcStart: m.start, rect: L.full, ph: ph(spk, i), window: w, z: 1 })); }); }
    else { const rect = (mode === 'split' ? L.split : L.stack || L.split)[sl]; slots.push(...talkSlots(tr.segs, { id: sl, src: m.src, srcStart: m.start, rect, ph: ph(spk, i), z: 1 + i,
      extra: { vis: { kind: 'active', speaker: spk, cuts, dim: C.active.dim, ring: C.active.ring, color: C.brand.accent, grow: C.active.grow } } })); }
  });
  /* the end card holds over both faces: a still continuation (placeholder plates keep drifting; your clips hold their last kept frame) */
  names.forEach((spk, i) => { const sl = C.speakers[spk].slot, m = C.media[sl], rect = mode === 'active' ? L.full : (mode === 'split' ? L.split : L.stack)[sl];
    if (mode !== 'active' || i === 0) slots.push({ id: sl + '-end', kind: 'speaker', src: m.src, mediaStart: +(m.start + tr.segs.at(-1).src_out - 0.04).toFixed(4), start: talkEnd, end: T, rect, z: 1 + i, ph: ph(spk, i) }); });
  /* lower thirds tied to speaker tags: in the speaker's own panel (sized to it), or full frame in the 'active' layout */
  const LT = speakerLowerThirds(turns, Object.fromEntries(names.map((n) => [n, { name: C.speakers[n].name, role: C.speakers[n].role }])), { part: 'lowerThird.softPill', params: { accent: C.brand.accent } });
  const gfx = [], top = [];
  for (const it of LT) { const sl = C.speakers[it.speaker].slot, item = { ...it, params: { ...it.params, pos: L.lt[sl], initials: C.speakers[it.speaker].name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase() } };
    if (mode === 'active') gfx.push({ ...item, params: { ...item.params, pos: 'bl' } }); else { const seg = slots.find((s) => s.id.startsWith(sl + '-') && it.at >= s.start && it.at < s.end); if (seg) (screenGfx[seg.id] ||= []).push(item); else gfx.push(item); } }
  gfx.push({ id: 'ui.waveform', at: 0, dur: r3(talkEnd - 0.2), params: { env: '$env', fps, box: L.wave, bars: C.waveform.bars, window: C.waveform.window, accent: C.brand.accent, color: '#FFFFFF' } });
  top.push({ id: 'title.hookCard', at: 0, dur: Math.max(1.6, r3((turns[0]?.e ?? 2) - 0.2)), params: { line: C.text.hook, kicker: C.text.kicker, pos: L.hookPos, accent: C.brand.accent } });
  top.push({ id: 'title.hookCard', at: r3(talkEnd + 0.1), dur: r3(C.end.holdS - 0.5), params: { line: C.text.end, kicker: C.text.endKicker, pos: 'c', accent: C.brand.accent } });
  /* captions */
  const pick = pickCaption(C.captions.style, { aspect: C.aspect, brand: { ...C.brand, captionAccent: C.brand.accent }, box: L.capBox ? { ...L.capBox, w: L.capBox.x1 - L.capBox.x0, h: L.capBox.y1 - L.capBox.y0 } : null }), cap = captionTrack(words, pick);
  for (const x of [...pick.lint, ...cap.lint]) warnings.push('captions: ' + x);
  const sg = Object.values(screenGfx).flat();
  const cues = cuesFor([...gfx.filter((g) => g.id !== 'ui.waveform'), ...sg, ...top], { overVoDb: -14 });
  /* voice: the episode mix (or each speaker's own camera audio), through the keep ranges */
  const sources = { mix: { src: C.media.mix.src, chain: C.voice.chain }, ...Object.fromEntries(names.map((n) => [C.speakers[n].slot, { src: C.media[C.speakers[n].slot].src, chain: C.voice.chain }])) };
  const segments = [], mixReal = C.voice.audio === 'mix' && !!C.media.mix.src;
  for (const g of tr.segs) {
    const inSeg = (spk) => tr.srcWords.filter((w) => !w.cut && (spk == null || w.speaker === spk) && w.e > g.src_in && w.s < g.src_out);
    if (mixReal) { const ws = inSeg(null), b0 = C.media.mix.start || 0; segments.push({ source: 'mix', src_in: +(b0 + g.src_in).toFixed(4), src_out: +(b0 + g.src_out).toFixed(4), start: g.start, speaker: ws[0]?.speaker || names[0], words: ws.map((w) => [w.s + b0, w.e + b0]) }); continue; }
    for (const spk of names) { const ws = inSeg(spk); if (!ws.length) continue; const sl = C.speakers[spk].slot, own = C.voice.audio === 'speaker' && C.media[sl].src, b0 = own ? C.media[sl].start || 0 : 0;
      /* each speaker's own mic only across their own words (no bleed from the other camera); the placeholder guide uses the whole segment, one band per speaker */
      const a = own ? Math.max(g.src_in, ws[0].s - 0.1) : g.src_in, z = own ? Math.min(g.src_out, ws.at(-1).e + 0.15) : g.src_out;
      segments.push({ source: own ? sl : 'mix', src_in: +(b0 + a).toFixed(4), src_out: +(b0 + z).toFixed(4), start: +(g.start + (a - g.src_in)).toFixed(4), speaker: spk, words: ws.map((w) => [w.s + b0, w.e + b0]) }); }
  }
  const voice = { fps, placeholder: C.voice.placeholder, sources, segments };
  const marks = [...new Set([0, ...tr.segs.map((g) => g.start), ...cuts.map((c) => c.t), talkEnd, T])].sort((a, b) => a - b);
  const shots = marks.slice(0, -1).map((a, i) => ({ id: 'shot' + i, start: r3(a), dur: r3(marks[i + 1] - a), speaker: activeAt(cuts, a + 1e-3), ...(a >= talkEnd ? { hold: true } : {}) })).filter((s) => s.dur > 0.001);
  const scene = { W: A.W, H: A.H, fps, seconds: T, bg: '#0B0D12', platform: A.safe, slots, gfx, gfxTop: top, screenGfx, captions: { chunks: cap.chunks, style: pick.style, box: pick.box },
    speaking: Object.fromEntries(slots.filter((s) => s.kind === 'speaker').map((s) => { const spk = names.find((n) => s.id.startsWith(C.speakers[n].slot)); return [s.id, words.filter((w) => w.speaker === spk).map((w) => [w.os, w.oe])]; })) };
  return { template: 'podcast-clip', aspect: C.aspect, fps, seconds: T, size: [A.W, A.H], scene, voice, cues, shots, claims: C.claims, transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe, speaker: w.speaker })),
    edit: { layout: mode, turns, cuts, keep: tr.segs.map((g) => [g.src_in, g.src_out]), fillers: tr.fillers, lowerThirds: LT.map((x) => ({ speaker: x.speaker, at: x.at })) }, captionStyle: pick.name,
    ...audioFields(C, tag, { role: 'vo_doc' }), paceRule: { aslMax: 4.5, longMax: 6 }, warnings };
}
