/* motion-pack / templates/_shared/human/edit.mjs: PURE edit planners for human-led videos (node + browser, no DOM, no clock). Words here are on the OUTPUT timeline (os / oe, from core.remapWords).
     punchPlan(segs, words, opts)        the punch-in planner: framing ALTERNATES on every jump cut (a ladder such as 1.0 / 1.12 / 1.0 / 1.2 hides the cut), punch-ins on emphasis words at most one per minGap s
     frameAt(plan, t)                    the framing scale at t (segment scale x the eased punch)
     brollSlots(words, opts)             the auto B-roll slot planner: keyword -> slot list for the user to FILL (label + src: null), leading the word by 150 ms, 1.2-3 s each, no overlaps,
                                         coverage capped; auto mode picks the longest content words when no keywords are given
     speakerTurns(words)                 runs of one speaker (speaker tags in words.json)
     activeSpeaker(turns, t, opts)       who is talking at t, with a minimum hold so the picture never flickers between speakers, and the L-cut lag (the new voice leads the picture)
     speakerLowerThirds(turns, people)   one lower third per speaker the first time they talk (tied to the speaker tag, never guessed from a face)
     reactionsFromWords(words, rules)    on-screen sticker / emoji reactions timed to the words that trigger them (one per minGap s)
     jlWindows(inserts, opts)            J / L split edits: an insert's own sound starts jMs before its picture (J) and runs lMs after it (L)
     pickCaption(name, opts)             the caption style picker shared by every template: a named look -> the type/captions.js style + its box in the safe zone + its lint */
import { CAPTION_STYLES, chunkWords, lintCaptions } from '../../../type/captions.js';
import { safeBox, ASPECTS, bare } from './core.mjs';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), r3 = (x) => +(+x).toFixed(3);
const easeOutBack = (x) => { x = clamp(x); const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

export function punchPlan(segs, words, { ladder = [1.0, 1.12, 1.0, 1.2], scale = 1.08, minGap = 4.0, inMs = 140, firstAt = 1.0 } = {}) {
  const frames = segs.map((s, i) => ({ id: s.id, t0: s.start, t1: r3(s.start + s.dur), scale: ladder[i % ladder.length] })), punches = [];
  for (const w of words.filter((x) => x.emph)) { const t = w.os; if (t < firstAt) continue; if (punches.length && t - punches.at(-1).t < minGap) continue;
    const f = frames.find((x) => t >= x.t0 && t < x.t1); if (!f) continue; punches.push({ t: r3(t), until: f.t1, word: w.w, scale, inMs }); }
  return { frames, punches, rule: { ladder, minGap, scale } };
}
export function frameAt(P, t) { const f = P.frames.find((x) => t >= x.t0 && t < x.t1) || P.frames.at(-1); if (!f) return 1; let k = f.scale;
  for (const p of P.punches) if (t >= p.t && t < p.until) k *= 1 + (p.scale - 1) * easeOutBack((t - p.t) / (p.inMs / 1000)); return +k.toFixed(5); }

const STOP = new Set('the a an and or but so then that this these those it its it\'s is are was were be been am i you we they he she my your our their me us them of to in on at for with from by as just really very about into out up down over what when where which who how why can could would should will do does did have has had not no yes there here one some all more most also than too only even get got make made like'.split(' '));
export function brollSlots(words, { keywords = [], lead = 0.15, minDur = 1.2, maxDur = 3.0, coverage = 0.45, firstAt = 2.0, tailFree = 1.5, minGap = 0.8, seconds = null, auto = true } = {}) {
  const T = seconds ?? (words.length ? words.at(-1).oe : 0), cap = coverage * T, slots = []; let used = 0;
  const fits = (a, d) => a >= firstAt && a + d <= T - tailFree && slots.every((s) => a + d + minGap <= s.at || a >= s.at + s.dur + minGap);
  const place = (w, label, src = null, dur = null, extra = {}) => { const a = r3(Math.max(firstAt, w.os - lead)), d0 = dur ?? clamp(w.oe - w.os + 1.4, minDur, maxDur), d = r3(clamp(d0, minDur, maxDur));
    if (used + d > cap + 1e-6 || !fits(a, d)) return false; slots.push({ id: 'broll' + slots.length, at: a, dur: d, word: w.w, label, src, ...extra }); used += d; return true; };
  for (const k of keywords) { const tgt = bare(k.word || k.match || ''); const hits = words.filter((w) => bare(w.w).startsWith(tgt)); for (const w of hits.slice(0, k.max || 1)) place(w, k.label || `B-roll: ${k.word}`, k.src ?? null, k.dur ?? null, { mediaStart: k.mediaStart || 0, nat: !!k.nat }); }
  if (auto) { const cands = words.filter((w) => !STOP.has(bare(w.w)) && bare(w.w).length >= 5 && !w.filler).sort((a, b) => bare(b.w).length - bare(a.w).length || a.os - b.os);
    for (const w of cands) { if (used >= cap * 0.98) break; place(w, `B-roll: ${bare(w.w)}`, null, null, { auto: true }); } }
  slots.sort((a, b) => a.at - b.at).forEach((s, i) => { s.id = 'broll' + i; });
  return { slots, coverage: r3(used / Math.max(1e-9, T)), rule: { lead, minDur, maxDur, coverage, firstAt } };
}

export function speakerTurns(words, { gap = 0.9 } = {}) {
  const out = []; for (const w of words) { const sp = w.speaker ?? 'A', s = w.os ?? w.s, e = w.oe ?? w.e, cur = out.at(-1);
    if (cur && cur.speaker === sp && s - cur.e <= gap) { cur.e = e; cur.n++; } else out.push({ speaker: sp, s, e, n: 1 }); }
  return out.map((t) => ({ ...t, s: r3(t.s), e: r3(t.e) }));
}
/* picture follows the voice with a lag (L-cut: the new voice is heard over the old face for lagMs) and every shot holds at least minShot s */
export function activeCuts(turns, { lagMs = 220, minShot = 1.4 } = {}) {
  const cuts = []; for (const tr of turns) { const t = r3(tr.s + lagMs / 1000), last = cuts.at(-1);
    if (last && last.speaker === tr.speaker) continue; if (last && t - last.t < minShot) { if (cuts.length > 1 && cuts.at(-2).speaker === tr.speaker) { cuts.pop(); } else continue; }
    cuts.push({ t: cuts.length ? t : 0, speaker: tr.speaker }); }
  return cuts;
}
export const activeAt = (cuts, t) => { let sp = cuts.length ? cuts[0].speaker : null; for (const c of cuts) { if (t >= c.t) sp = c.speaker; else break; } return sp; };
/* soft emphasis weight 0..1 for a speaker at t (eases over 0.25 s at each cut: pure) */
export function emphasisAt(cuts, speaker, t, ramp = 0.25) { let v = cuts.length && cuts[0].speaker === speaker ? 1 : 0; for (const c of cuts) { if (t < c.t) break; const k = clamp((t - c.t) / ramp); v = c.speaker === speaker ? Math.max(v * (1 - k), k) : v * (1 - k); } return +v.toFixed(4); }

export function speakerLowerThirds(turns, people = {}, { delay = 0.3, dur = 2.6, part = 'lowerThird.softPill', params = {}, minTurn = 1.0 } = {}) {
  const seen = new Set(), out = []; for (const tr of turns) { const p = people[tr.speaker]; if (!p || seen.has(tr.speaker) || tr.e - tr.s < minTurn) continue; seen.add(tr.speaker);
    out.push({ id: part, at: r3(tr.s + delay), dur: r3(Math.min(dur, tr.e - tr.s - delay)), speaker: tr.speaker, params: { ...params, name: p.name, role: p.role || '', ...(p.initials ? { initials: p.initials } : {}), ...(p.pos ? { pos: p.pos } : {}) } }); }
  return out;
}
export function reactionsFromWords(words, rules = [], { minGap = 2.5, dur = 1.4, part = 'sticker.place' } = {}) {
  const out = []; for (const w of words) { const b = bare(w.w); const r = rules.find((x) => (x.match instanceof RegExp ? x.match.test(b) : b.startsWith(bare(x.match || x.word || '')))); if (!r) continue;
    if (out.length && w.os - out.at(-1).at < minGap) continue; out.push({ id: r.part || part, at: r3(Math.max(0, w.os - 0.05)), dur: r.dur || dur, word: w.w, params: { name: r.sticker || r.name, motion: r.motion || 'popBounce', at: r.at || [0.78, 0.3], size: r.size ?? 1, rot: r.rot ?? -6, seed: out.length + 1 } }); }
  return out;
}
export function jlWindows(inserts, { jMs = 300, lMs = 400, seconds = Infinity } = {}) {
  return inserts.filter((x) => x.nat).map((x) => ({ id: x.id, kind: 'JL', audioIn: r3(Math.max(0, x.at - jMs / 1000)), pictureIn: x.at, pictureOut: r3(x.at + x.dur), audioOut: r3(Math.min(seconds, x.at + x.dur + lMs / 1000)), jMs, lMs }));
}

/* ---------- the caption style picker ---------- */
export const CAPTION_PICKS = {
  karaoke: { base: 'karaoke', why: 'word-by-word highlight: talking heads, podcasts, shorts' },
  bold: { base: 'impact', why: 'one word at a time, uppercase: hooks and hype' },
  emphasis: { base: 'emphasis', why: 'all words visible, emphasis words coloured: vlogs and stories' },
  brand: { base: 'pill', accent: 'brand', why: 'a pill behind the active word in the brand colour: founder and personal brand' },
  doc: { base: 'clean', why: 'quiet documentary subtitle: tutorials, lessons, interviews' },
  minimal: { base: 'clean', size: 46, why: 'small clean line for 16:9 tutorials over busy screens' },
};
export const BANDS = { lower: 'bottom of the safe zone', mid: 'just under the middle (a 9:16 talking head: clear of the chin and of the bottom UI)', upper: 'top of the safe zone' };
export function pickCaption(name, { aspect = '16:9', brand = {}, band = 'lower', maxWords = 3, box = null } = {}) {
  const pk = CAPTION_PICKS[name]; if (!pk) throw new Error(`caption style "${name}" is not one of ${Object.keys(CAPTION_PICKS).join(', ')}`);
  const A = ASPECTS[aspect], st = { ...CAPTION_STYLES[pk.base] }; if (pk.size) st.size = pk.size; if (pk.accent === 'brand' && brand.accent) st.accent = brand.accent; else if (brand.captionAccent) st.accent = brand.captionAccent;
  const S = Math.min(A.W, A.H) / 1080, fontPx = st.size * S, sb = safeBox(aspect), h = 2 * 1.18 * fontPx, gap = 24 * S;
  const y1 = band === 'upper' ? sb.y0 + h + gap : band === 'mid' ? Math.min(sb.y1 - gap, A.H * 0.62) : sb.y1 - gap;
  const b = box || { x0: sb.x0, x1: sb.x1, y0: +(y1 - h).toFixed(1), y1: +y1.toFixed(1), w: +(sb.x1 - sb.x0).toFixed(1), h: +h.toFixed(1) };
  const tall = A.H > A.W, maxChars = tall ? 18 : 26, lint = [];
  const f1080 = fontPx * (tall ? 1080 / A.W : 1080 / A.H); if (tall && st.mode !== 'single' && (f1080 < 64 || f1080 > 80)) lint.push(`9:16 caption ${f1080.toFixed(0)} px outside 64..80`); if (!tall && f1080 < 40) lint.push(`16:9 caption ${f1080.toFixed(0)} px under 40`);
  return { name, base: pk.base, style: st, box: b, fontPx: +fontPx.toFixed(1), chunk: { maxWords: st.mode === 'single' ? 1 : maxWords, maxChars, lines: 2 }, lint, why: pk.why };
}
/* output-time words -> caption chunks (type/captions.js chunker) + its lint */
export function captionTrack(words, pick) { const ws = words.filter((w) => !w.cut).map((w) => ({ w: w.w, s: w.os, e: w.oe, emph: !!w.emph })), chunks = chunkWords(ws, pick.chunk);
  return { chunks, lint: lintCaptions(chunks, pick.style, { maxWords: Math.max(4, pick.chunk.maxWords), maxCharsPerLine: pick.chunk.maxChars, lines: 2, maxWps: 6 }) }; }
