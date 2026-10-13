/* motion-pack / transitions / lib / sequence.js
   An edit list -> "what is on screen at time t". Shared by the GL and DOM back-ends and by HyperFrames compositions.
   edits: [{ cut_s, key, params?, dur_s? | beats? }], sorted by cut_s; shot i is on screen between edit i-1 and edit i.
   With bpm, dur_s = beats * 60 / bpm (registry default beats). The swap of edit i lands exactly on cut_s (the beat).
   Pure: state(t) depends only on t and the list, so any frame renders from t alone. */
import { REGISTRY } from './registry.js';

export function planEdits(edits, { bpm = null } = {}) {
  return edits.map((ed, i) => {
    const entry = REGISTRY[ed.key]; if (!entry && ed.key !== 'cut') throw new Error(`edit ${i}: unknown transition '${ed.key}'`);
    if (ed.key === 'cut') return { ...ed, i, start: ed.cut_s, end: ed.cut_s, dur: 0 };
    const dur = ed.dur_s ?? (bpm ? (ed.beats ?? entry.timing.beats) * 60 / bpm : entry.timing.ms / 1000), c = ed.cut ?? entry.timing.cut;
    return { ...ed, i, dur, start: ed.cut_s - c * dur, end: ed.cut_s - c * dur + dur };
  });
}
/** {shot} when one shot is on screen, or {from, to, key, p, params, dur} inside a transition window. */
export function stateAt(t, plan) {
  for (const ed of plan) {
    if (t < ed.start) return { shot: ed.i };
    if (t < ed.end) return { from: ed.i, to: ed.i + 1, key: ed.key, p: (t - ed.start) / ed.dur, params: ed.params || {}, dur: ed.dur };
  }
  return { shot: plan.length };
}
/** Overlap check: two windows must not overlap and each window must sit between its neighbours' cuts. */
export function lintPlan(plan) {
  const errs = [];
  for (let i = 1; i < plan.length; i++) if (plan[i].start < plan[i - 1].end) errs.push(`edits ${i - 1} and ${i} overlap (${plan[i - 1].end.toFixed(3)} > ${plan[i].start.toFixed(3)} s)`);
  return errs;
}
