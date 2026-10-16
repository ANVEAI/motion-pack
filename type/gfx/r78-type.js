/* motion-pack / type / gfx / r78-type.js (xp-r78, 2026-10-16): the "sentence across shots" part. Same gfx contract as every part (core.js).
     type.sentenceAcrossShots  ONE word per shot, carried across the cuts: the word of shot i comes up ON the first frame of shot i (a hard cut with the picture, no entrance
                               fade) and sits in a FIXED slot, so the plate changes under a word that does not move; the reader assembles the sentence from the cuts.
                               `cuts` = the start of each shot in local seconds (cuts[0] is the first word; the shot ends where the next begins; the last word holds `hold` s).
                               Take them from the cut list (`cutgen.py sentence`, or the plan's shots) so the word flips on the same frame as the picture.
                               carry 0 (default, the studied pattern): only the current word is on screen, centred in the slot.
                               carry > 0: the sentence is laid out once, centred, and the words already said stay in their places at that opacity; the next word lands beside them.
                               Because the words never move, a still of any frame is a readable crop of the sentence so far.
   Legibility over changing plates: `scrim` (0..1) puts a soft dark radial behind the slot, `outline` strokes the word with a dark edge (paint-order stroke). Neither depends on
   the plate; check the real frames with tools/a11y_check.py. A word that is on screen for fewer than `minWord` seconds is reported by sentenceLint (a reading floor, not a rule).
   The default frame is a generic sentence with no number or claim. */
import { E, clamp, lerp, seg, f2, text, esc, measure } from './core.js';
import { num, str, list, hex, obj, sc } from './r78-util.js';

const SENT_D = { words: ['Your', 'ideas', 'deserve', 'better.'], cuts: [0, 0.6, 1.2, 1.8], hold: 1.4, pos: [0.5, 0.5], size: 168, weight: 800, fill: '#FFFFFF', accent: '#FFD84A', accentIndex: 3, carry: 0, pop: 0.12, scrim: 0.3, outline: 0.35, ls: -0.02, minWord: 0.25, dur: 3.2 };
/* the cuts, cleaned: finite, >= 0, strictly increasing (a repeat or a step back is dropped), at most one per word */
export function sentenceCuts(pIn) {
  const p = obj(pIn), n = list(p.words, 24).length, out = []; for (const v of list(p.cuts, 24)) { const x = num(v, NaN, 0, 1e5); if (Number.isFinite(x) && (!out.length || x > out[out.length - 1] + 1e-6)) out.push(x); }
  return out.slice(0, n);
}
/* the word on screen at local time u: index (-1 before the first cut), the word, when its shot began, and the frame fraction since the cut */
export function sentenceState(pIn, u) {
  const p = obj(pIn), words = list(p.words, 24).map((w) => str(w, '', 40)), cuts = sentenceCuts(p); let i = -1; for (let k = 0; k < cuts.length; k++) if (u >= cuts[k] - 1e-9) i = k;
  return { i, word: i >= 0 ? words[i] : '', since: i >= 0 ? u - cuts[i] : -1, cuts, words };
}
export const sentenceEnd = (pIn) => { const c = sentenceCuts(pIn); return (c.length ? c[c.length - 1] : 0) + num(obj(pIn).hold, 1.4, 0.1, 600); };
/* lint: shots that are shorter than the reading floor, and words with no cut */
export function sentenceLint(pIn) {
  const p = obj(pIn), cuts = sentenceCuts(p), words = list(p.words, 24), min = num(p.minWord, 0.25, 0, 10), out = [];
  for (let k = 0; k < cuts.length; k++) { const len = (k + 1 < cuts.length ? cuts[k + 1] : sentenceEnd(p)) - cuts[k]; if (len < min) out.push({ word: str(words[k], '', 40), seconds: +len.toFixed(3), why: `on screen ${len.toFixed(2)} s, under the ${min} s reading floor` }); }
  if (words.length > cuts.length) out.push({ word: str(words[cuts.length], '', 40), seconds: 0, why: 'no cut for this word: it never appears' });
  return out;
}
const SENT = { tags: ['type', 'sentence', 'word-per-shot', 'cuts', 'hook', 'kinetic', 'fixed-slot', 'across-shots'], dur: 4.0, inF: 0, outF: 0, d: SENT_D,
  svg(L, p, c) {
    const s = sc(c), u = L.u, S = sentenceState(p, u); if (S.i < 0) return '';
    const size = num(p.size, 168, 20, 600) * s * (c.H > c.W ? 0.62 : 1), weight = Math.round(num(p.weight, 800, 200, 800)), fill = hex(p.fill, SENT_D.fill), acc = hex(p.accent, SENT_D.accent), ai = Math.round(num(p.accentIndex, -1, -1, 24)), carry = num(p.carry, 0, 0, 1), ls = num(p.ls, -0.02, -0.2, 0.5) * size;
    const [px, py] = Array.isArray(p.pos) ? [num(p.pos[0], 0.5, -1, 2) * c.W, num(p.pos[1], 0.5, -1, 2) * c.H] : [c.W / 2, c.H / 2], pop = num(p.pop, 0.12, 0, 2), kp = pop > 0 ? E.enter(seg(S.since, 0, pop)) : 1, punch = 1 + 0.07 * (1 - kp);
    const sc0 = num(p.scrim, 0.3, 0, 1), ol = num(p.outline, 0.35, 0, 1), edge = ol > 0 ? ` stroke="#000000" stroke-opacity="${f2(ol)}" stroke-width="${f2(size * 0.05)}" stroke-linejoin="round" paint-order="stroke"` : '';
    const wTxt = (w, i, x, anchor, a, k = 1) => `<g opacity="${f2(a)}" transform="translate(${f2(x)} ${f2(py)}) scale(${f2(k)}) translate(${f2(-x)} ${f2(-py)})">` + text(w, x, py + size * 0.34, { size, weight, fill: i === ai ? acc : fill, anchor, ls, extra: edge.trim() }) + '</g>';
    let out = '';
    if (sc0 > 0) { out += `<defs><radialGradient id="ss" cx="${f2(px)}" cy="${f2(py)}" r="${f2(Math.max(c.W, c.H) * 0.42)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000000" stop-opacity="${f2(sc0)}"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient></defs><rect x="0" y="0" width="${f2(c.W)}" height="${f2(c.H)}" fill="url(#ss)"/>`; }
    if (carry <= 0) out += wTxt(S.word, S.i, px, 'middle', 1, punch);
    else { const gap = size * 0.28, ws = S.words.slice(0, S.cuts.length).map((w) => measure(w, size, { weight }) + ls * w.length), total = ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, ws.length - 1); let x = px - total / 2;
      ws.forEach((wd, i) => { if (i <= S.i) out += wTxt(S.words[i], i, x, 'start', i === S.i ? 1 : carry, i === S.i ? punch : 1); x += wd + gap; }); }
    return out;
  } };

export const R78_TYPE_GFX = { 'type.sentenceAcrossShots': SENT };
for (const g of Object.values(R78_TYPE_GFX)) g.file = 'type/gfx/r78-type.js';
/* per-action sounds (gfxCues): one tick per cut, on the cut's own frame (the mixer anchors the sample one frame after, gotchas.md) */
export const R78_TYPE_CUES = {
  'type.sentenceAcrossShots': (p) => sentenceCuts(p).map((t, i) => ({ t, id: 'sfx/tx/cut_tick', why: `word ${i + 1} lands on its cut` })),
};
