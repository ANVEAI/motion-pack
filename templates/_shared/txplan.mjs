/* motion-pack/templates/_shared/txplan.mjs (node): turn plan boundaries into transition OVERLAP WINDOWS for HyperFrames timed clips.
   HyperFrames hides a timed clip outside [data-start, data-start + data-duration], so a two-layer transition needs the outgoing clips to
   run past the cut and the incoming clips to start before it. txPlan() computes each window from the transitions registry (txWindow:
   integer frames, swap exactly on the cut frame), clamped to half of each neighbouring shot; span() then stretches every element that
   ends / starts on a windowed cut and records it as an `out` / `in` layer of that window (incoming <video> media start moves back too).
   kinds (transitions/lib/ids.js): cut + smash = hard cut (no window); dom = window + adapters/transitions.mjs (GL-only looks run their tx-dom-x.js APPROX version, flagged approx); gl = hard cut + todo
   (GL-only transitions need canvas sources: transitions/lib/tx-gl.js). */
import { REGISTRY } from '../../transitions/lib/registry.js';
import { resolveTx } from '../../transitions/lib/ids.js';
import { txWindow } from '../../transitions/lib/tx-core.js';

export function txPlan(shots, fps, { bpm = null } = {}) {
  const wins = [], todo = [];
  shots.forEach((s, i) => {
    if (!i || !s.tx) return;
    const r = resolveTx(s.tx);
    if (!r) { todo.push(`${s.tx} @${s.start}s: unknown id, hard cut`); return; }
    if (r.kind === 'cut' || r.kind === 'smash') return;
    if (r.kind === 'gl') { todo.push(`${s.tx} @${s.start}s: GL-only (needs canvas sources), hard cut in DOM templates`); return; }
    const cutF = Math.round(s.start * fps), w = txWindow(REGISTRY[r.key], { fps, bpm, cutFrame: cutF });
    const pre = Math.min(w.cut - w.start, Math.floor(shots[i - 1].dur * fps / 2)), post = Math.min(w.end - w.cut, Math.floor(s.dur * fps / 2));
    if (pre + post < 2) { todo.push(`${s.tx} @${s.start}s: shots too short for a window, hard cut`); return; }
    wins.push({ i, id: r.id, key: r.key, params: { ...r.params, ...(s.txParams || {}) }, cutF, startF: cutF - pre, endF: cutF + post,
      cut: cutF / fps, start: (cutF - pre) / fps, end: (cutF + post) / fps, out: [], in: [] });
  });
  return { wins, todo, fps };
}
/* stretch one timed element. el = { sel, start, dur, mediaStart? } in seconds; returns the same shape with the window applied. */
export function span(P, el) {
  const half = 1.01 / P.fps, o = { ...el };   // one-frame tolerance: unrounded text spans (textDur) may end a frame off the cut
  for (const w of P.wins) {
    if (Math.abs(el.start + el.dur - w.cut) < half) { o.dur = +(w.end - o.start).toFixed(6); w.out.push(el.sel); }
    if (Math.abs(el.start - w.cut) < half) { const pre = w.cut - w.start; o.start = +w.start.toFixed(6); o.dur = +(o.dur + pre).toFixed(6);
      if (o.mediaStart != null) o.mediaStart = +Math.max(0, o.mediaStart - pre).toFixed(4); w.in.push(el.sel); }
  }
  return o;
}
/* the GSAP lines that bind each window (call after every element went through span()) */
export const txCalls = (P, { W, H, root = '#root' }) => P.wins.filter((w) => w.out.length && w.in.length).map((w) =>
  `\n  MP.transition(tl, ${JSON.stringify(w.id)}, { out: ${JSON.stringify(w.out)}, in: ${JSON.stringify(w.in)}, root: '${root}', start: ${w.start.toFixed(4)}, cut: ${w.cut.toFixed(4)}, end: ${w.end.toFixed(4)}, W: ${W}, H: ${H}, params: ${JSON.stringify(w.params)} });`).join('');
