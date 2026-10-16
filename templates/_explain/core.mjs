/* motion-pack / templates/_explain/core.mjs: what the explainer, data-story and process-howto templates share in buildPlan (node; pure given the same files). Lane explainer, 2026-10-16.
     loadVoiceWords(dir, C)   the optional voice: C.voice.words (words.json, .srt, .vtt) -> output-time words [{ w, s, e, os, oe }] or [] (no voice)
     timeOf(spec, words)      a beat time: a number (seconds) or { word, nth, offset } (a word of the voice; refused without a transcript)
     beatTime(b, words)       b.word (when there is a voice) else b.t
     itemsCues(items)         one cue per gfx action (type/gfx gfxCues), near-duplicates dropped, placed over the bed (overBedDb) or under the voice (overVoDb)
     textsOf(items)           plan.texts for eyes / structure_check: every on-screen line with its time window, box and size
     voicePlan / audioPlan    the plan fields for templates/_shared/human/voice.py and _shared/audio.py (music/mixer.py)
     finish(...)              the plan object every one of the three returns (scene for the page, shots, sections, events, quiet, claims, texts) */
import path from 'node:path';
import { aspectOf, safeBox, atOf, fixSets } from '../_shared/human/core.mjs';
import { loadWords } from '../_shared/human/kit.mjs';
import { pickCaption, captionTrack } from '../_shared/human/edit.mjs';
import { gfxCues } from '../../type/gfx/index.js';
export { aspectOf, safeBox, fixSets };
export const r3 = (x) => +(+x).toFixed(3), qf = (x, fps = 30) => Math.round(x * fps) / fps;

export function loadVoiceWords(dir, C) {
  if (!C.voice || !C.voice.words) return [];
  return loadWords(dir, C.voice.words).map((w) => ({ ...w, os: w.s, oe: w.e }));
}
export function timeOf(spec, words) {
  if (typeof spec === 'number') return spec; if (spec == null) return null;
  if (typeof spec === 'object' && 'word' in spec && !words.length) throw new Error(`a beat is anchored to the word "${spec.word}" but there is no voice transcript (set voice.words, or give the beat a time t)`);
  return atOf(spec, words);
}
export const beatTime = (b, words, fps = 30) => qf(words.length && b.word ? timeOf(typeof b.word === 'string' ? { word: b.word } : b.word, words) : +b.t, fps);
export function itemsCues(items, { over = 'bed', db = -6, minGap = 0.07, skip = [] } = {}) {
  const out = []; for (const it of items) { if (skip.includes(it.id) || it.silent) continue; for (const c of gfxCues(it.id, { at: it.at, params: it.params || {}, dur: it.dur }))
    out.push({ id: c.id, t: r3(c.t), why: `${it.id}: ${c.why}`, ...(over === 'vo' ? { overVoDb: it.cueDb ?? db - 8 } : { overBedDb: it.cueDb ?? db }) }); }
  out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  return out.filter((c, i) => c.t >= 0 && !out.slice(0, i).some((d) => d.id === c.id && Math.abs(d.t - c.t) < minGap));
}
/* on-screen lines for the text checks (structure_check reads plan.texts { text, t: [a, b], role }; eyes reads box + fontPx) */
export function textsOf(list) { return list.filter((x) => x && String(x.text || '').trim()).map((x) => ({ text: String(x.text), t: [r3(x.a), r3(x.b)], role: x.role || 'read', ...(x.box ? { box: x.box.map((v) => Math.round(v)) } : {}), ...(x.fontPx ? { fontPx: Math.round(x.fontPx) } : {}) })); }
export function captionsOf(words, C) {
  if (!words.length) return { captions: null, lint: [] };
  const pick = pickCaption(C.captions?.style?.[C.aspect] || (C.aspect === '9:16' ? 'karaoke' : 'minimal'), { aspect: C.aspect, brand: C.brand }), cap = captionTrack(words, pick);
  return { captions: { chunks: cap.chunks, style: pick.style, box: pick.box }, lint: [...pick.lint, ...cap.lint], chunks: cap.chunks };
}
export function voicePlan(C, words, fps) {
  if (!words.length) return null; const end = r3(words.at(-1).oe + 0.5);
  return { fps, placeholder: C.voice.placeholder || 'guide', sources: { vo: { src: C.voice.audio || null, chain: !!C.voice.chain } },
    segments: [{ source: 'vo', src_in: 0, src_out: end, start: 0, speaker: 'A', words: words.map((w) => [w.s, w.e]) }] };
}
export function audioPlan(C, tag, { words, events = [], quiet = [], role = 'explainer' }) {
  const vo = words.length > 0;
  return { music: C.music || null, musicGainDb: C.musicGainDb ?? 0, duckDb: C.duckDb ?? 12, ceilingDb: C.ceilingDb ?? -2.0, ...(vo ? { vo: `vo${tag}.wav` } : {}),
    audio: { mode: vo ? 'vo' : 'continuous', role, quiet, events: [...new Set(events.map(r3))].sort((a, b) => a - b) } };
}
/* the plan shared by the three templates: shots are camera beats on one canvas (no cuts unless a shot says tx), sections are explicit */
export function finish({ template, C, A, fps, T, words, scene, items, top, sections, shots, claims, texts, events, quiet, warnings, tag, extra = {}, role = 'explainer' }) {
  const cues = itemsCues([...items, ...top], { over: words.length ? 'vo' : 'bed' });
  const ev = [...events, ...cues.map((c) => c.t)].filter((t) => t >= 0 && t < T);
  return { template, aspect: C.aspect, fps, seconds: T, size: [A.W, A.H], scene, voice: voicePlan(C, words, fps), cues, shots, claims, structure: { pattern: extra.pattern || null, sections },
    texts: textsOf(texts), transcript: words.map((w) => ({ w: w.w, s: w.os, e: w.oe })), ...audioPlan(C, tag, { words, events: ev, quiet, role }), paceRule: { aslMax: 30, longMax: 40 }, warnings, ...extra };
}
export const tagOf = (aspect, def) => (aspect === def ? '' : '-' + { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'portrait' }[aspect]);
export const projOf = (aspect, def) => (aspect === def ? '.' : { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'portrait' }[aspect]);
export const HERE_OF = (url) => path.dirname(new URL(url).pathname);
/* frame boxes [x, y, w, h] as frame fractions inside the safe rect: fr(A, [fx0, fy0, fx1, fy1]) maps safe-rect fractions to frame fractions */
export function inSafe(aspect, f) { const A = aspectOf({ aspect }), sb = safeBox(aspect), x0 = sb.x0 + (sb.x1 - sb.x0) * f[0], y0 = sb.y0 + (sb.y1 - sb.y0) * f[1], x1 = sb.x0 + (sb.x1 - sb.x0) * f[2], y1 = sb.y0 + (sb.y1 - sb.y0) * f[3];
  return [+(x0 / A.W).toFixed(4), +(y0 / A.H).toFixed(4), +((x1 - x0) / A.W).toFixed(4), +((y1 - y0) / A.H).toFixed(4)]; }
