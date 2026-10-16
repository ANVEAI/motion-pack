/* type/dom.js: the baked (bakeType, bakeCaptions) and driven (driveType, driveCaptions) paths are the same picture for any t0 (node, no browser). run: node type/tests/dom-t0.test.mjs
   t0 is the start of the window on the COMPOSITION timeline and spec.at / spec.out / chunk times are composition time (the same spec works in drawType and in the canvas renderer), so
   bake at t0 and drive at t0 must agree at every timeline position T. Until 2026-10-15 they used opposite signs of t0 (bake: states at t0 + t; drive: states at T - t0), which only showed for t0 != 0
   and which every test and demo missed because they all used t0 = 0. The elements are stand-ins that record what bake writes (a fake timeline) and what drive sets (a style object). */
import { mountType, bakeType, driveType, bakeCaptions, driveCaptions } from '../dom.js';
import { PRESETS } from '../presets.js'; import { chunkWords, CAPTION_STYLES, popScale } from '../captions.js';
import { reporter } from '../../layers/tests/harness.mjs';
const R = reporter('type dom t0');
const el = () => ({ style: { setProperty(k, v) { this[k] = v; } }, textContent: '' });
/* the last value written to `target` at or before timeline position T (fromTo writes its `from` values at the window start and, being immediateRender, holds them before it) */
const timeline = () => { const log = new Map(), add = (tg, t, v) => { if (!log.has(tg)) log.set(tg, []); log.get(tg).push([t, v]); };
  const tl = { set: (tg, v, t) => (add(tg, t, v), tl), fromTo: (tg, v, to, t) => (add(tg, t, v), tl) };
  tl.at = (tg, T) => { const L = (log.get(tg) || []).sort((a, b) => a[0] - b[0]); let v = L.length ? { ...L[0][1] } : undefined; for (const [t, x] of L) if (t <= T + 1e-9) v = { ...v, ...x }; return v; }; return tl; };   /* before the window: the immediateRender frame */
const num = (s, re) => { const m = String(s).match(re); return m ? +m[1] : 0; };
const live = (g) => { const saved = globalThis.window; globalThis.window = { addEventListener() {} }; try { return g(); } finally { globalThis.window = saved; } };
const T0S = [0, 0.4, 2, 3.5, 7.25], FPS = 30, DUR = 2.4;

/* ---- type presets: x, y, scale, rotation, opacity of every unit ---- */
let worst = 0, n = 0, visible = 0, moving = 0, outsideAt = 0;
for (const id of ['maskRise', 'scaleSlam', 'wordStagger', 'blurIn', 'charStagger', 'elasticPop']) {
  const def = PRESETS[id], text = 'Voice that sells', texts = def.unit === 'char' ? [...text.replace(/\s/g, '')] : def.unit === 'line' ? [text] : text.split(' ');
  const spec = { preset: id, text, at: 2.3, out: 4.4 };
  for (const t0 of T0S) {
    const m = { units: texts.map((t) => ({ el: el(), text: t })), texts, fontPx: 100, H: 1080, spec }, tl = timeline();
    bakeType(tl, m, spec, { t0, dur: DUR, fps: FPS });
    const m2 = { units: texts.map((t) => ({ el: el(), text: t })), texts, fontPx: 100, H: 1080, spec }, drive = live(() => driveType(m2, spec, { t0, dur: DUR }));
    for (let i = -4; i <= Math.round(DUR * FPS) + 4; i++) { const T = t0 + i / FPS; drive(T);
      m.units.forEach((u, k) => { const b = tl.at(u.el, T), d = m2.units[k].el.style, tf = d.transform || '';
        const dx = Math.abs(num(tf, /translate\(([-\d.e]+)px/) - b.x), dy = Math.abs(num(tf, /translate\([-\d.e]+px, ([-\d.e]+)px/) - b.y), ds = Math.abs((tf.includes('scale(') ? num(tf, /scale\(([-\d.e]+)\)/) : 1) - b.scale), dr = Math.abs(num(tf, / rotate\(([-\d.e]+)deg/) - b.rotation), dop = Math.abs(+d.opacity - b.opacity);
        worst = Math.max(worst, dx, dy, ds * 100, dr, dop * 100); n++; if (b.opacity > 0.01) visible++; if (b.opacity > 0.01 && b.opacity < 0.99) moving++; if (!def.mask && T < spec.at - 1e-9 && b.opacity > 0.01) outsideAt++; }); } } }
R.check(`bakeType vs driveType agree at every timeline position, 6 presets x t0 = ${T0S.join(', ')} (${n} unit-frames incl. before and after the window; worst deviation ${worst.toExponential(1)})`, worst < 0.01 && n > 5000);
R.check(`the comparison is not vacuous: ${visible} unit-frames visible, ${moving} mid-transition; no opacity preset shows before spec.at (${outsideAt} that do; maskRise hides behind its line mask instead)`, visible > 500 && moving > 100 && outsideAt === 0);
{ /* a spec with at: 3 starts at timeline 3 s for a window that starts at 2 s (it used to start at 5 s when driven) */
  const spec = { preset: 'scaleSlam', text: 'Voice that sells', at: 3, out: 1e9 }, texts = ['Voice', 'that', 'sells'], m = { units: texts.map((t) => ({ el: el(), text: t })), texts, fontPx: 100, H: 1080, spec }, drive = live(() => driveType(m, spec, { t0: 2, dur: 4 }));
  drive(2.5); const before = +m.units[0].el.style.opacity; drive(3.8); const after = +m.units[0].el.style.opacity;
  R.check(`driveType at t0 = 2 with spec.at = 3: invisible at 2.5 s (${before}), visible at 3.8 s (${after})`, before === 0 && after > 0.99); }

/* ---- captions: chunk opacity, and word opacity / scale / colour / background while a chunk is live ---- */
{ const words = [['Voice', 2.2, 2.5], ['that', 2.5, 2.8], ['sells', 2.8, 3.3], ['every', 3.5, 3.8], ['single', 3.8, 4.2], ['day', 4.2, 4.6]].map(([w, s, e]) => ({ w, s, e })), chunks = chunkWords(words);
  let worstC = 0, nC = 0, liveC = 0;
  for (const style of ['karaoke', 'impact', 'pill']) { if (!CAPTION_STYLES[style]) continue;
    for (const t0 of T0S) {
      const mk = () => ({ els: chunks.map((c) => ({ chunk: c, el: el(), words: c.words.map(() => el()) })), style: CAPTION_STYLES[style], fontPx: 60 }), m = mk(), m2 = mk(), tl = timeline();
      bakeCaptions(tl, m, chunks, { t0, dur: DUR, fps: FPS }); const drive = live(() => driveCaptions(m2, chunks, { t0, dur: DUR }));
      for (let i = -4; i <= Math.round(DUR * FPS) + 4; i++) { const T = t0 + i / FPS; drive(T);
        m.els.forEach((e, ci) => { const b = tl.at(e.el, T), d = m2.els[ci].el.style, bo = b ? b.opacity : 0; worstC = Math.max(worstC, Math.abs(+d.opacity - bo)); nC++;
          if (bo === 1) { liveC++; e.words.forEach((s, k) => { const bw = tl.at(s, T), dw = m2.els[ci].words[k].style; worstC = Math.max(worstC, Math.abs(+dw.opacity - bw.opacity), Math.abs(num(dw.transform, /scale\(([-\d.e]+)\)/) - bw.scale) * 100); if (dw.color !== bw.color || dw.background !== bw.background) worstC = Infinity; }); } }); } } }
  R.check(`bakeCaptions vs driveCaptions agree at every timeline position, t0 = ${T0S.join(', ')} (${nC} chunk-frames, ${liveC} live; worst deviation ${worstC.toExponential(1)})`, worstC < 0.01 && liveC > 100); }

/* ---- the pop room: a word that scales (emphasis pop, karaoke active) gets (scale - 1) / 2 of its width on each side in both layouts, so it keeps its gap ---- */
{ const S = CAPTION_STYLES, e = { emph: true }, p = {};
  R.check('popScale: the emphasis pop reserves 1.12 for flagged words only, karaoke for every word, the one-word impact style none', popScale(S.emphasis, e) === S.emphasis.emphScale && popScale(S.emphasis, p) === 1
    && popScale(S.karaoke, p) === S.karaoke.activeScale && popScale(S.impact, e) === 1 && Object.values(S).every((st) => popScale(st, e) >= 1)); }
const res = R.done(); process.exit(R.failed ? 1 : 0);
