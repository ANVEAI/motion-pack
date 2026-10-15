/* motion-pack / templates/_shared/human/kit.mjs: what every human template's buildPlan shares (node; pure given the same files).
     loadWords(dir, file)        words.json (whisper style) or an .srt / .vtt converted on the fly (core.subsToWords; est: true marks spread timings)
     emphasize(words, list)      mark emphasis words by text (CONFIG.captions.emph), so captions and punch-ins can find them
     cuesFor(items, opts)        one sound cue per gfx action (type/gfx gfxCues), placed under the voice (overVoDb), near-duplicates dropped
     voiceFrom(...)              plan.voice for templates/_shared/human/voice.py: your recording through the keep ranges, or a labelled guide signal
     audioFields(C, tag, extra)  the mixer fields (music bed ducked under the voice; no bed = the quietest pack bed at -60 dB so the voice still masters through music/mixer.py)
     lintHuman(plan)             the human templates' own checks: every placeholder slot is labelled, captions lint, quotes verbatim, digits sourced (lint.proof covers claims) */
import fs from 'node:fs'; import path from 'node:path';
import { normWords, subsToWords, bare } from './core.mjs';
import { gfxCues } from '../../../type/gfx/index.js';

export function loadWords(dir, file) {
  if (!file) return []; const p = path.isAbsolute(file) ? file : path.resolve(dir, file); if (!fs.existsSync(p)) throw new Error(`transcript not found: ${p} (set voice.words to a words.json, .srt or .vtt)`);
  const txt = fs.readFileSync(p, 'utf8'); return /\.(srt|vtt)$/i.test(p) ? normWords(subsToWords(txt)) : normWords(JSON.parse(txt));
}
export function emphasize(words, list = []) { const L = new Set(list.map(bare)); return words.map((w) => (L.has(bare(w.w)) ? { ...w, emph: true } : w)); }
export function cuesFor(items, { overVoDb = -14, minGap = 0.07, skip = [] } = {}) {
  const out = []; for (const it of items) { if (skip.includes(it.id)) continue; for (const c of gfxCues(it.id, { at: it.at, params: it.params || {}, dur: it.dur })) out.push({ id: c.id, t: +(+c.t).toFixed(4), why: `${it.id}: ${c.why}`, overVoDb: it.overVoDb ?? overVoDb }); }
  out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); return out.filter((c, i) => !out.slice(0, i).some((d) => d.id === c.id && Math.abs(d.t - c.t) < minGap));
}
/* segs from core.segments (src_in/src_out in source time, start on the output timeline); words in source time */
export function voiceFrom({ source, src, chain = true, segs, words, speaker = 'A', placeholder = 'guide', fps }) {
  return { fps, sources: { [source]: { src: src || null, chain: !!chain } }, placeholder,
    segments: segs.map((g) => ({ source, src_in: g.src_in, src_out: g.src_out, start: g.start, speaker, words: words.filter((w) => w.e > g.src_in && w.s < g.src_out && !w.cut).map((w) => [w.s, w.e]) })) };
}
export function audioFields(C, tag, { quiet = [], role = 'explainer', bedAutomation = null } = {}) {
  return { music: C.music || 'music/bed_ambient_pad_loop8', musicGainDb: C.music ? (C.musicGainDb || 0) : -60, duckDb: C.duckDb ?? 12, ceilingDb: C.ceilingDb ?? -2.0, vo: `vo${tag}.wav`,
    ...(bedAutomation ? { bedAutomation } : {}), audio: { mode: 'vo', role, quiet } };
}
export function lintHuman(plan) {
  const out = [];
  for (const s of plan.scene.slots) if (!s.src && !(s.kind === 'slide')) { const lab = JSON.stringify(s.ph || {}); if (!/placeholder|YOUR|HERE/i.test(lab) && !['speaker', 'screen'].includes(s.kind)) out.push(`slot ${s.id} renders a placeholder without a label`); }
  return out;
}
export const tagOf = (aspect, def) => (aspect === def ? '' : '-' + { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'portrait' }[aspect]);
export const projOf = (aspect, def) => (aspect === def ? '.' : { '16:9': 'wide', '9:16': 'tall', '1:1': 'square', '4:5': 'portrait' }[aspect]);
