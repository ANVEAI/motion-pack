/* motion-pack / templates / _shared / film / plan-film.mjs: pure plan helpers shared by the film templates (trailer, title-sequence, short-film). Node and browser, no DOM.
     FRAME             per-aspect frame sizes (16:9 1920x1080, 9:16 1080x1920, 1:1 1080x1080, 4:5 1080x1350)
     SCORES / scoreMarkers(style, fps, actBars, buttonBeats, tailBeats)   the JS mirror of music/trailer_styles.py styled_markers (the trailer test checks they agree)
     montage(f0, f1, fpb, act)          the JS mirror of cuts/trailer_plan.py montage(): accelerating cut points on the half-beat grid (patterns.json trailer.accelerate3Act)
     textBox(text, { W, H, fontPx, y, anchor, weight })   an estimated box for plan.texts (eyes reads it for the safe-zone, size, time and contrast checks)
     subLines(lines, { at, gap, minHold, wps })            dialogue lines -> subtitle items with reading-time holds (0.35 s + 0.28 s per word, at most 3.5 words / s)
     jlCut(scenes, { j, l })                               the J / L cut builder: a scene's sound (room tone, ambience, dialogue) leads its picture by j s (J) or lingers after it by l s (L)
     slotOf(C, name, k)                                    a footage slot -> { kind: 'plate' | 'media', plate, src, mediaStart, label, focus } (null src = the labelled placeholder plate) */
export const FRAME = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const SCORES = {   // music/presets.py TRAILERS trailer_<style> (bpm, gap_beats, cresc_bars, ring_beats, button_beats, tail_beats, final_hit_beat)
  thriller: { bpm: 120, gap: 4, cresc: 0, ring: 6, button: 8, tail: 16, final: 8 },
  scifi: { bpm: 100, gap: 4, cresc: 1, ring: 5, button: 8, tail: 16, final: 8 },
  horror: { bpm: 80, gap: 4, cresc: 0, ring: 4, button: 8, tail: 12, final: 6 },
  drama: { bpm: 84, gap: 4, cresc: 1, ring: 4, button: 8, tail: 12, final: 6 },
};
const roundEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 ? r - 1 : r; };   // Python's round(): halves go to the even integer (22.5 -> 22)
export const fpbOf = (bpm, fps) => Math.max(4, roundEven(fps * 60 / bpm));   // music/grid.py snap_bpm: one beat = a whole number of frames
export function scoreMarkers(style, fps, actBars, buttonBeats, tailBeats) {
  const p = SCORES[style]; if (!p) throw new Error('unknown score style ' + style + ' (' + Object.keys(SCORES).join(', ') + ')');
  const a = actBars.map((x) => Math.max(1, Math.round(x))), bb = buttonBeats ?? p.button, tb = Math.max(4, tailBeats ?? p.tail), fpb = fpbOf(p.bpm, fps);
  const b = { act1_start: 0, act2_start: 4 * a[0], act3_start: 4 * (a[0] + a[1]), gap_start: 4 * (a[0] + a[1] + a[2]) };
  b.gap_end = b.crescendo_start = b.gap_start + p.gap; b.hit = b.crescendo_start + 4 * p.cresc; b.button_start = b.hit + p.ring; b.tail_start = b.button_start + bb;
  b.final_hit = b.tail_start + Math.min(tb - 3, p.final); b.end = b.tail_start + tb;
  const frames = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v * fpb])); frames.visual_cut_frame = frames.hit - 1;
  return { style, fps, bpm: +(fps * 60 / fpb).toFixed(4), frames_per_beat: fpb, act_bars: a, button_beats: bb, tail_beats: tb, beats: b, frames };
}
const ACCEL = { act1: [[0, 8], [1, 6]], act2: [[0, 4], [1, 2]], act3: [[0, 2], [0.6, 1], [1, 0.5]] }, QUANTUM = 0.5;   // cuts/patterns.json trailer.accelerate3Act
export function rate(act, u) { const k = ACCEL[act]; u = Math.min(1, Math.max(0, u)); for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, b0] = k[i - 1], [u1, b1] = k[i]; return b0 + (b1 - b0) * (u1 === u0 ? 0 : (u - u0) / (u1 - u0)); } return k[k.length - 1][1]; }
/* the half-beat grid: k half-beats after the act start -> a whole frame (rounded half to even, as Python), so an even k is exactly a beat */
export function montage(f0, f1, fpb, act, act0 = f0, act1 = f1) {
  const hb = fpb * QUANTUM, cuts = [f0]; let k = roundEven((f0 - act0) / hb), last = f0;
  for (;;) { const u = (last - act0) / Math.max(1, act1 - act0), n = Math.max(1, roundEven(rate(act, u) / QUANTUM)); k += n; const f = act0 + roundEven(k * hb); if (f > f1 - hb + 1e-9) break; cuts.push(f); last = f; }
  const tail = Math.max(1, roundEven(rate(act, 1) / QUANTUM)) * hb; if (cuts.length > 1 && f1 - cuts[cuts.length - 1] < 0.5 * tail) cuts.pop();
  return cuts;
}
/* the same acceleration over a SPAN [a, b) inside an act [actF0, actF1) (the gaps between interstitial cards): the rate follows the act's clock, not the span's */
export const montageIn = (actF0, actF1, a, b, fpb, act) => montage(a, b, fpb, act, actF0, actF1);
/* an estimated text box (no DOM): Manrope bold averages about 0.56 em per character (0.6 for mono); good enough for eyes' safe-zone and size checks */
export function textBox(text, { W, H, fontPx, y, anchor = 'middle', x = null, weight = 700, mono = false, ls = 0 }) {
  const n = String(text || '').length, w = Math.min(W, n * fontPx * (mono ? 0.6 : weight >= 700 ? 0.6 : 0.52) + ls * fontPx * Math.max(0, n - 1)), cx = x ?? W / 2;
  const x0 = anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2, y1 = y + fontPx * 0.25, y0 = y - fontPx * 0.85;
  return [Math.round(Math.max(0, x0)), Math.round(Math.max(0, y0)), Math.round(Math.min(W, x0 + w)), Math.round(Math.min(H, y1))];
}
export const readS = (text) => 0.35 + 0.28 * String(text || '').split(/\s+/).filter(Boolean).length;   // frame-design reading time
/* lines [{ text, speaker?, at?, dur? }] placed from `at`: each holds max(its reading time, minHold), `gap` s apart (or at its own `at`) */
export function subLines(lines, { at = 0, gap = 0.25, minHold = 1.2 } = {}) {
  const out = []; let t = at;
  for (const l of lines || []) { const s = typeof l === 'string' ? { text: l } : l; const st = s.at != null ? s.at : t, d = s.dur != null ? s.dur : Math.max(minHold, readS(s.text)); out.push({ text: s.text, speaker: s.speaker || '', at: +st.toFixed(4), dur: +d.toFixed(4) }); t = st + d + gap; }
  return out;
}
/* J / L cut builder. scenes: [{ id, start, dur, sound: sfx id, j?, l? }] in picture time. A J cut starts the NEXT scene's sound `j` s before its picture; an L cut keeps the
   PREVIOUS scene's sound `l` s after its picture ends (the two never both apply to one boundary: J wins when both are asked). Returns [{ id, sound, from, until, why }] for the cue sheet. */
export function jlCut(scenes, { j = 0.5, l = 0 } = {}) {
  return scenes.map((s, i) => { const nj = s.j ?? j, nl = s.l ?? l, isJ = i > 0 && nj > 0, from = Math.max(0, s.start - (isJ ? nj : 0)), next = scenes[i + 1], nextJ = next && (next.j ?? j) > 0;
    const until = s.start + s.dur + (next && !nextJ ? nl : 0); return { id: s.id, sound: s.sound, from: +from.toFixed(4), until: +until.toFixed(4), why: (isJ ? `J cut: the sound of ${s.id} leads its picture by ${nj} s` : `${s.id} sound in on the cut`) + (next && !nextJ && nl > 0 ? `, L cut: lingers ${nl} s` : '') }; });
}
export function slotOf(C, name, k = 0) {
  const m = (C.media || {})[name]; if (!m) throw new Error(`media slot "${name}" is not in CONFIG.media`);
  const ms = +(m.start || 0) + k * (m.step ?? 0.7);
  return m.src ? { kind: 'media', src: m.src, mediaStart: +ms.toFixed(3), label: m.label || name, focus: m.focus ?? 0.5 } : { kind: 'plate', plate: m.plate || name, plateParams: m.params || {}, mediaStart: +ms.toFixed(3), label: m.label || name };
}
