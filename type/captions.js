/* motion-pack / type / captions.js: talking-head caption engine. Pure: transcript words in, per-frame word states out. Renderers: render-canvas.js (2D), dom.js (DOM spans -> GSAP / hf-seek).
   words: [{ w|word|text, s|start, e|end, emph? }] seconds (Whisper-style transcript.json words work as is).
   Rules from the pack research: 2-4 words per chunk, the active word highlighted, pop-in 4-6 f, never caption across a >0.6 s gap or a sentence end, <= 2 lines of <= 18 chars (9:16),
   caption lead 0 (a caption never fires BEFORE the voice; the pack's rule is word timings within 80 ms of the transcript), emphasis words get colour + a 1.12 pop. */
import { E, seg, lerp, clamp } from './ease.js';
import { iconFor } from './icons.js';

export function normalizeWords(words) {
  const out = []; for (const x of words || []) { const w = String(x.w ?? x.word ?? x.text ?? '').trim(), s = Number(x.s ?? x.start), e = Number(x.e ?? x.end); if (!w || !Number.isFinite(s) || !Number.isFinite(e)) continue; out.push({ w, s, e: Math.max(e, s + 0.05), emph: !!x.emph }); }
  out.sort((a, b) => a.s - b.s); for (let i = 1; i < out.length; i++) if (out[i].s < out[i - 1].e) out[i - 1].e = Math.max(out[i - 1].s + 0.04, out[i].s); return out;
}
/* chunker: new chunk when maxWords reached, the line budget (maxChars * lines) would overflow, the gap > maxGap, or the previous word ended a sentence (. ? !) */
export function chunkWords(words, { maxWords = 3, maxChars = 18, lines = 2, maxGap = 0.6, breakOn = /[.?!]$/, breakOnComma = false, tail = 0.06 } = {}) {
  const ws = normalizeWords(words), chunks = []; let cur = [];
  const flush = () => { if (cur.length) { chunks.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e, text: cur.map((x) => x.w).join(' ') }); cur = []; } };
  for (const w of ws) { const prev = cur[cur.length - 1], len = cur.reduce((a, x) => a + x.w.length + 1, 0) + w.w.length;
    if (prev && (cur.length >= maxWords || len > maxChars * lines || w.s - prev.e > maxGap || breakOn.test(prev.w) || (breakOnComma && /,$/.test(prev.w)))) flush(); cur.push(w); }
  flush(); chunks.forEach((c, i) => { const next = chunks[i + 1]; c.e = Math.min(c.e + tail, next ? next.s : Infinity); c.index = i; }); return chunks;
}
const F = 1 / 30;
/* caption styles. size is px at 1080 wide (9:16) / 1080 high (16:9). colours are display sRGB hex. */
export const CAPTION_STYLES = {
  /* word-by-word karaoke: active word accent + scale 1.00 -> 1.12 in 4 f, inactive 0.55 */
  karaoke: { id: 'karaoke', size: 72, weight: 800, upper: false, color: '#FFFFFF', accent: '#FFD400', inactive: 0.55, activeScale: 1.12, popFrames: 4, stroke: 0.06, shadow: 0.10, mode: 'chunk', popIn: 6 * F, tags: ['talking-head', 'retention', 'social'] },
  /* impact: ONE word at a time, uppercase, slam 1.25 -> 1 in 4 f */
  impact: { id: 'impact', size: 120, weight: 900, upper: true, color: '#FFFFFF', accent: '#FFD400', stroke: 0.07, shadow: 0.12, mode: 'single', slam: 1.25, tags: ['hype', 'beat', 'hook'] },
  /* emphasis: all words visible, flagged words coloured + popped 1.12 */
  emphasis: { id: 'emphasis', size: 72, weight: 800, upper: false, color: '#FFFFFF', accent: '#FF3B6B', inactive: 1, activeScale: 1.0, emphScale: 1.12, popFrames: 5, stroke: 0.06, shadow: 0.10, mode: 'chunk', popIn: 6 * F, tags: ['explainer', 'story'] },
  /* pill: highlighter pill behind the active word (dark text on accent) */
  pill: { id: 'pill', size: 70, weight: 800, upper: false, color: '#FFFFFF', accent: '#4A18ED', pillText: '#FFFFFF', inactive: 0.9, activeScale: 1.04, popFrames: 4, stroke: 0, shadow: 0.14, mode: 'chunk', popIn: 6 * F, pill: true, tags: ['clean', 'founder', 'brand'] },
  /* clean: documentary lower caption, no animation but a 5 f fade */
  clean: { id: 'clean', size: 54, weight: 600, upper: false, color: '#FFFFFF', accent: '#FFFFFF', inactive: 1, activeScale: 1, stroke: 0.03, shadow: 0.2, mode: 'chunk', popIn: 5 * F, fade: true, tags: ['documentary', 'interview'] },
};
/* pure per-frame state. returns null when no chunk is live. chunk-level pop-in + per-word states; icons: emoji pops (own vector pack) anchored to the keyword word. */
export function captionFrame(chunks, t, style = CAPTION_STYLES.karaoke, { icons = true, iconMap = {}, popIconFrames = 8 } = {}) {
  let c = null; for (const k of chunks) if (t >= k.s && t < k.e) { c = k; break; } if (!c) return null;
  const tc = t - c.s, st = style, pop = st.popIn ? seg(tc, 0, st.popIn) : 1, chunkOp = st.fade ? E.soft(pop) : clamp(pop * 3), chunkScale = st.fade ? 1 : lerp(0.88, 1, E.pop(pop)), words = [], ic = [];
  c.words.forEach((w, i) => {
    const active = t >= w.s && t < w.e, spoken = t >= w.s, ta = t - w.s; let op = 1, sc = 1, color = st.color, y = 0, bg = 0;
    if (st.mode === 'single') { op = active ? 1 : 0; const k = seg(ta, 0, 4 * F); sc = active ? lerp(st.slam, 1, E.enter(k)) : 1; color = w.emph ? st.accent : st.color; }
    else {
      const k = seg(ta, 0, (st.popFrames || 4) * F); op = spoken || st.inactive >= 1 ? 1 : 1; if (st.inactive < 1) op = active ? 1 : (spoken ? Math.max(st.inactive, 0.78) : st.inactive);
      if (st.id === 'karaoke') { sc = active ? lerp(1, st.activeScale, E.enter(k)) : 1; color = active ? st.accent : st.color; }
      else if (st.id === 'emphasis') { const em = w.emph; sc = em && spoken ? lerp(1, st.emphScale, E.pop(k)) : 1; color = em && spoken ? st.accent : st.color; op = spoken || true ? 1 : 1; }
      else if (st.pill) { sc = active ? lerp(1, st.activeScale, E.enter(k)) : 1; bg = active ? E.enter(k) : 0; color = active ? st.pillText : st.color; }
    }
    words.push({ i, text: w.w, active, spoken, opacity: op * chunkOp, scale: sc * chunkScale, color, y, bg, emph: w.emph, s: w.s, e: w.e });
    if (icons) { const id = iconFor(w.w, iconMap); if (id && spoken) { const p = seg(ta, 0, popIconFrames * F); if (t < c.e) ic.push({ id, wordIndex: i, progress: p, seed: i + c.index * 7 }); } }
  });
  return { chunk: c, index: c.index, words, icons: ic, style: st };
}
/* lint a caption track: timing coverage, chunk size, line budget, overlapping chunks, words per second */
export function lintCaptions(chunks, style, { maxWords = 4, maxCharsPerLine = 18, lines = 2, maxWps = 5 } = {}) {
  const o = []; chunks.forEach((c, i) => { if (c.words.length > maxWords) o.push(`chunk ${i}: ${c.words.length} words > ${maxWords}`); if (c.text.length > maxCharsPerLine * lines) o.push(`chunk ${i}: ${c.text.length} chars > ${maxCharsPerLine * lines}`); const dur = c.e - c.s; if (dur < 0.25 && c.words.length > 1) o.push(`chunk ${i}: ${dur.toFixed(2)} s too short to read`); if (c.words.length / dur > maxWps) o.push(`chunk ${i}: ${(c.words.length / dur).toFixed(1)} words/s`); if (chunks[i + 1] && c.e > chunks[i + 1].s + 1e-9) o.push(`chunk ${i}: overlaps next`); }); return o;
}
