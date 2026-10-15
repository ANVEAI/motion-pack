/* motion-pack / templates/_shared/human/core.mjs: PURE helpers for personal, tutorial and human-blended templates (node + browser; no DOM, no clock).
   Words: the transcript is [{ w, s, e, emph?, speaker?, filler? }] in SOURCE seconds (whisper words.json, or an SRT / VTT converted by subsToWords).
   Never fake a person: these helpers plan cuts, captions and overlays for footage the user supplies; with no footage the templates draw LABELLED placeholders.
     ASPECTS, aspectOf(C)              the four delivery aspects with their own size, safe platform and folder tag (16:9 at the root, 9:16 in tall/, ...)
     getPath / setPath / applySets      the --set key=value contract (dotted paths; JSON values; --set aspect=9:16)
     applyProject(C, project, MAP)      copy shared-project fields (lane 6 project.schema.json) onto CONFIG paths through a template's PROJECT_MAP
     normWords, subsToWords             word lists from whisper JSON or from SRT / VTT (cue time spread over the words by length when the file has no word times; est: true)
     FILLERS, markFillers               the filler-word marker: flags hard fillers (um, uh) and soft ones (you know, I mean); nothing is cut unless the user says so
     autocutKeep                        silence autocut that KEEPS BREATHS (extends plan.mjs autocut): a detected breath in a gap is kept whole, otherwise 120 ms of air;
                                        cut fillers on request; a punchline keeps a 450 ms beat hold before the cut
     segments, remapWords               keep ranges -> frame-exact segments on the output timeline, and the words moved onto it
     atOf                               an event time from seconds or { word, nth, offset } (output time)
     quoteCheck                         the speaker's-own-words gate: a pull quote must be a verbatim run of the transcript */
import { autocut as autocutBase, remap } from '../plan.mjs';
export { remap };

export const ASPECTS = {
  '16:9': { W: 1920, H: 1080, tag: 'wide', safe: 'wideTitle', platform: 'x.video' },
  '9:16': { W: 1080, H: 1920, tag: 'tall', safe: 'conservative', platform: 'reels.organic' },
  '1:1': { W: 1080, H: 1080, tag: 'square', safe: 'wideTitle', platform: 'linkedin.video' },
  '4:5': { W: 1080, H: 1350, tag: 'portrait', safe: 'wideTitle', platform: 'linkedin.video' },
};
export function aspectOf(C) { const a = ASPECTS[C.aspect]; if (!a) throw new Error(`aspect "${C.aspect}" is not one of ${Object.keys(ASPECTS).join(', ')}`); return { id: C.aspect, ...a }; }
/* safe rect in px (same numbers as type/safezones.js SAFE.conservative / wideTitle), so a plan can be checked in node */
export function safeBox(aspect) { const a = ASPECTS[aspect], tall = a.H > a.W, s = tall ? a.H / 1920 : a.H / 1080;
  return tall ? { x0: 65 * s, y0: 269 * s, x1: a.W - 120 * s, y1: a.H - 672 * s } : { x0: 96 * s, y0: 54 * s, x1: a.W - 96 * s, y1: a.H - 54 * s }; }

/* ---------- --set and the shared project ---------- */
export function getPath(o, p) { let x = o; for (const k of String(p).split('.')) { if (x == null || typeof x !== 'object' || !(k in x)) return undefined; x = x[k]; } return x; }
export function setPath(o, p, v) { const ks = String(p).split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') throw new Error(`cannot set ${p}: ${k} is not an object in CONFIG`); x = x[k]; } x[ks.at(-1)] = v; return o; }
export const parseValue = (v) => { if (v === 'null') return null; if (v === 'true') return true; if (v === 'false') return false; if (/^[[{]/.test(v)) { try { return JSON.parse(v); } catch { return v; } } return v !== '' && !isNaN(+v) ? +v : v; };
export function applySets(C, argv) { for (let i = 0; i < argv.length; i++) if (argv[i] === '--set') { const arg = argv[++i] || '', j = arg.indexOf('='); if (j < 1) throw new Error(`--set needs key=value, got "${arg}"`); setPath(C, arg.slice(0, j), parseValue(arg.slice(j + 1))); } return C; }
export function applyProject(C, project, MAP) { const used = []; for (const [from, to] of Object.entries(MAP || {})) { const v = getPath(project, from); if (v !== undefined) { setPath(C, to, structuredClone(v)); used.push(from); } } return used; }
/* every PROJECT_MAP target must be a real CONFIG path (tests call this) */
export const projectMapProblems = (C, MAP) => Object.entries(MAP || {}).filter(([, to]) => getPath(C, to) === undefined && !hasParent(C, to)).map(([f, to]) => `${f} -> ${to}`);
const hasParent = (C, p) => { const ks = p.split('.'); const par = ks.length > 1 ? getPath(C, ks.slice(0, -1).join('.')) : C; return par != null && typeof par === 'object' && ks.at(-1) in par; };

/* ---------- words ---------- */
export function normWords(x) {
  const arr = Array.isArray(x) ? x : (x && (x.words || x.segments?.flatMap((s) => s.words || []))) || [], out = [];
  for (const q of arr) { const w = String(q.w ?? q.word ?? q.text ?? '').trim(), s = Number(q.s ?? q.start), e = Number(q.e ?? q.end); if (!w || !Number.isFinite(s) || !Number.isFinite(e)) continue;
    const o = { w, s: +s.toFixed(3), e: +Math.max(e, s + 0.04).toFixed(3) }; if (q.emph) o.emph = true; if (q.speaker != null) o.speaker = String(q.speaker); if (q.filler) o.filler = q.filler; if (q.cut) o.cut = true; if (q.est) o.est = true; out.push(o); }
  return out.sort((a, b) => a.s - b.s || a.e - b.e);
}
const ts = (h) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(h.trim()); if (!m) return NaN; return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000; };
/* SRT or WebVTT text -> words. VTT inline word times (<00:00:01.200>) are used when present; otherwise each cue's time is spread over its words by length (est: true).
   Speakers: VTT <v Name>, or a leading ALL-CAPS "NAME:"; the speaker sticks until the next marker. */
/* a speaker prefix is an ALL-CAPS name of 1-3 words ("ANNA:", "DR. RAO:"); "Look at line five:" is speech, not a speaker */
const SPK = /^\s*(?:-\s*)?([A-Z][A-Z.'-]*(?:\s+[A-Z][A-Z.'-]*){0,2}):\s+/;
export function subsToWords(text, { speaker = null } = {}) {
  const blocks = String(text).replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/), words = []; let spk = speaker;
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== ''); const ti = lines.findIndex((l) => l.includes('-->')); if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->').map((x) => x.trim().split(/\s+/)[0]), s0 = ts(a), e0 = ts(z); if (!Number.isFinite(s0) || !Number.isFinite(e0) || e0 <= s0) continue;
    let body = lines.slice(ti + 1).join(' ');
    const v = /<v(?:\.[^ >]*)?\s+([^>]+)>/.exec(body); if (v) spk = v[1].trim();
    const turn = SPK.exec(body.replace(/<[^>]+>/g, '')); if (turn && !v) spk = turn[1].trim();
    const timed = [...body.matchAll(/<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})>/g)];
    body = body.replace(/<v[^>]*>|<\/v>/g, '');
    if (timed.length) {   /* word-timed VTT: "<t1>word <t2>word" */
      const parts = body.split(/<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})>/); let cur = s0;
      const seq = []; for (let i = 0; i < parts.length; i++) { if (i % 2) { const t = ts(parts[i].length <= 9 ? '00:' + parts[i] : parts[i]); if (Number.isFinite(t)) cur = t; } else for (const w of parts[i].replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean)) seq.push({ w, s: cur }); }
      seq.forEach((q, i) => { const e = i + 1 < seq.length && seq[i + 1].s > q.s ? seq[i + 1].s : e0; words.push({ w: q.w, s: +q.s.toFixed(3), e: +Math.max(q.s + 0.04, e - 0.01).toFixed(3), ...(spk ? { speaker: spk } : {}) }); });
      continue;
    }
    const clean = body.replace(/<[^>]+>/g, '').replace(SPK, '').replace(/\s+-\s+/g, ' ').trim(), ws = clean.split(/\s+/).filter(Boolean); if (!ws.length) continue;
    const weight = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1), tot = weight.reduce((p, q) => p + q, 0), dur = e0 - s0; let acc = 0;
    ws.forEach((w, i) => { const s = s0 + (acc / tot) * dur; acc += weight[i]; const e = s0 + (acc / tot) * dur; words.push({ w, s: +s.toFixed(3), e: +Math.max(s + 0.04, e - Math.min(0.03, (e - s) * 0.15)).toFixed(3), est: true, ...(spk ? { speaker: spk } : {}) }); });
  }
  return words;
}

/* ---------- fillers (marked, never cut silently) ---------- */
export const FILLERS = { hard: ['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm', 'mhm'], soft: ['you know', 'i mean', 'kind of', 'sort of', 'like', 'basically', 'actually', 'so yeah'] };
export const bare = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, '').trim();
/* parse a user-editable list: one filler per line, '# comment', a line 'soft:' or 'hard:' switches the class */
export function parseFillerList(txt) { const o = { hard: [], soft: [] }; let cls = 'hard'; for (const raw of String(txt).split('\n')) { const l = raw.replace(/#.*/, '').trim().toLowerCase(); if (!l) continue; if (l === 'soft:' || l === 'hard:') { cls = l.slice(0, -1); continue; } o[cls].push(l); } return o; }
export function markFillers(words, list = FILLERS, { cut = 'none' } = {}) {
  const W = words.map((w) => { const o = { ...w }; delete o.filler; return o; }), found = [];
  const phrases = [...(list.soft || []).map((p) => [p.split(' '), 'soft']), ...(list.hard || []).map((p) => [p.split(' '), 'hard'])].sort((a, b) => b[0].length - a[0].length);
  for (let i = 0; i < W.length; i++) for (const [ph, cls] of phrases) { if (i + ph.length > W.length) continue; if (ph.every((p, k) => bare(W[i + k].w) === p)) {
    for (let k = 0; k < ph.length; k++) { W[i + k].filler = cls; if (cut === 'all' || (cut === 'hard' && cls === 'hard')) W[i + k].cut = true; }
    found.push({ i, n: ph.length, text: ph.join(' '), cls, s: W[i].s, e: W[i + ph.length - 1].e, cut: cut === 'all' || (cut === 'hard' && cls === 'hard') }); i += ph.length - 1; break; } }
  return { words: W, found };
}

/* ---------- autocut that keeps breaths ---------- */
const sentenceEnd = (w) => /[.?!…]['")\]]*$/.test(String(w.w));
export function autocutKeep(words, { silenceMin = 0.5, padBefore = 0.06, padAfter = 0.09, breath = 0.12, breaths = [], maxBreath = 0.45, beatHold = 0.45, cutFillers = false } = {}) {
  const all = normWords(words), W = all.filter((w) => !(w.cut || (cutFillers === 'all' && w.filler) || (cutFillers === 'hard' && w.filler === 'hard') || (cutFillers === true && w.filler === 'hard'))), cuts = [];
  if (!W.length) return { keep: [], cuts, kept: [] };
  if (!breath && !breaths.length && !beatHold && W.length === all.length) return { keep: autocutBase(W, { silenceMin, padBefore, padAfter }), cuts, kept: W };   // the plain rule, unchanged
  const B = (breaths || []).map((b) => (Array.isArray(b) ? [+b[0], +b[1]] : [+b.s, +b.e])).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && y > x);
  const keep = []; let a = Math.max(0, W[0].s - Math.max(padBefore, breath)), b = W[0].e + padAfter;
  for (let i = 1; i < W.length; i++) {
    const p = W[i - 1], w = W[i], gap = w.s - p.e, skipped = all.some((x) => x.s >= p.e - 1e-6 && x.e <= w.s + 1e-6 && !W.includes(x));
    if (gap > silenceMin || skipped) {
      const hold = beatHold && sentenceEnd(p) && p.emph ? beatHold : 0, endA = Math.min(w.s, p.e + Math.max(padAfter, hold));
      const br = B.find(([x, y]) => x < w.s && y > p.e && x >= p.e - 0.02), startB = br ? Math.max(endA, Math.min(w.s - padBefore, Math.max(br[0] - 0.02, w.s - maxBreath))) : Math.max(endA, w.s - Math.max(padBefore, breath));
      if (startB - endA > 1 / 30) { keep.push([a, endA]); cuts.push({ from: +endA.toFixed(3), to: +startB.toFixed(3), why: skipped ? 'filler cut' : `silence ${gap.toFixed(2)} s`, breath: br ? 'detected, kept' : `${Math.round(Math.max(padBefore, breath) * 1000)} ms air kept` }); a = startB; }
    }
    b = w.e + padAfter;
  }
  keep.push([a, b]);
  return { keep: keep.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]).filter(([x, y]) => y - x > 1 / 60), cuts, kept: W };
}
/* keep ranges -> frame-exact segments laid end to end on the output timeline (cumulative frame rounding: no drift) */
export function segments(keep, fps = 30) { let f = 0; return keep.map(([a, b], i) => { const n = Math.max(1, Math.round((b - a) * fps)), s = { id: 'seg' + i, src_in: a, src_out: +(a + n / fps).toFixed(4), f0: f, f1: f + n, start: +(f / fps).toFixed(4), dur: +(n / fps).toFixed(4) }; f += n; return s; }); }
/* source-time words -> output-time words through the segments (a word outside every kept range is dropped) */
export function remapWords(segs, words) { const out = []; for (const w of words) { const sg = segs.find((g) => w.s >= g.src_in - 1e-6 && w.s < g.src_out); if (!sg) continue; const o = { ...w, os: +(sg.start + (w.s - sg.src_in)).toFixed(3) }; o.oe = +Math.min(sg.start + sg.dur, sg.start + (w.e - sg.src_in)).toFixed(3); o.seg = sg.id; out.push(o); } return out; }

/* ---------- event times ---------- */
export function atOf(spec, words, { field = 'os' } = {}) {
  if (typeof spec === 'number') return spec; if (spec == null) return null;
  if (typeof spec === 'object' && 'word' in spec) { const tgt = bare(spec.word), ex = words.filter((w) => bare(w.w) === tgt), hits = ex.length ? ex : words.filter((w) => bare(w.w).startsWith(tgt)), q = hits[spec.nth || 0];   // exact word first ('the' never matches 'theme')
    if (!q) throw new Error(`no word "${spec.word}"${spec.nth ? ' #' + spec.nth : ''} in the transcript (an event is anchored to it)`); return +((q[field] ?? q.s) + (spec.offset || 0)).toFixed(3); }
  if (typeof spec === 'object' && 's' in spec) return +spec.s; throw new Error('cannot read an event time from ' + JSON.stringify(spec));
}
/* the pull-quote gate: the quote must be a contiguous run of the transcript's words (case and punctuation ignored) */
export function quoteCheck(quote, words) {
  const q = String(quote).split(/\s+/).map(bare).filter(Boolean), W = words.map((w) => bare(w.w)); if (!q.length) return { ok: false, why: 'empty quote' };
  for (let i = 0; i + q.length <= W.length; i++) if (q.every((x, k) => W[i + k] === x)) return { ok: true, i0: i, i1: i + q.length - 1, s: words[i].os ?? words[i].s, e: words[i + q.length - 1].oe ?? words[i + q.length - 1].e };
  return { ok: false, why: `"${quote}" is not a verbatim run of the transcript: quote the speaker's own words only` };
}
export const q = (x, fps) => Math.round(x * fps) / fps;
/* cues.mjs (the shared plan exporter) reads --set values as text or numbers only; make every human CONFIG agree with applySets: 'null' / 'true' / 'false' and JSON text become values */
export function fixSets(o) { if (Array.isArray(o)) return o.map(fixSets); if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = fixSets(o[k]); return o; } return typeof o === 'string' ? (['null', 'true', 'false'].includes(o) || /^[[{]/.test(o) ? parseValue(o) : o) : o; }
