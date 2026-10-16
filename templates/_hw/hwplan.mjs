/* motion-pack/templates/_hw/hwplan.mjs (xp-hardware, 2026-10-16): PURE plan helpers shared by the three hardware templates (hardware-reveal, hardware-teaser,
   spec-sheet). No DOM, no clock: config.mjs buildPlan() calls them, so the plan (and every overlay track in it) is a pure function of the CONFIG.
     ASPECTS              per aspect: frame size, platform preset, safe zone (16:9 wideTitle, 9:16 the conservative union)
     layoutBars(...)      sections in whole bars on the snapped beat grid -> t0 / dur in seconds (every section starts on a bar line: the cut is on the beat)
     calloutItem(...)     a hw.specCallout whose anchor TRACKS a device anchor through the 3D camera (objects/lib/hwshots.js director: the same maths as the plate)
     dimItem(...)         a hw.dimensionLine between two tracked device-local points
     glintItem(...)       a hw.edgeGlint along a tracked edge
     textBox(...)         the px box of a line of text (for eyes' plan.texts: size, time on screen, contrast, safe zone)
     specClaims(...)      every number on screen as a claim { text, source } for lint.proof (a digit with no source fails the build) */
import { beatGrid } from '../_shared/plan.mjs';
import { safeRect } from '../../type/safezones.js';
import { measure } from '../../type/gfx/core.js';

export const ASPECTS = {
  '16:9': { key: 'wide', W: 1920, H: 1080, tall: false, platform: 'x.video', zone: 'wideTitle' },
  '9:16': { key: 'tall', W: 1080, H: 1920, tall: true, platform: 'reels.organic', zone: 'conservative' },
};
export const aspectOf = (a) => ASPECTS[a] || ASPECTS[a === 'tall' ? '9:16' : '16:9'];
export const safePx = (A) => safeRect(A.zone, A.W, A.H);
export const S1080 = (A) => (A.tall ? A.W / 1080 : A.H / 1080);   // type scale (shorter side)

/* sections [{ id, bars, ... }] -> the same with t0, dur, f0 (frames) on the bar grid of `bpm` snapped to whole frames per beat */
export function layoutBars(sections, bpm, fps) {
  const g = beatGrid(bpm, fps, 1), fpbar = g.framesPerBeat * 4; let f = 0;
  const out = sections.map((s) => { const bars = Math.max(1, Math.round(s.bars)), r = { ...s, bars, f0: f, t0: +(f / fps).toFixed(4), dur: +((bars * fpbar) / fps).toFixed(4) }; f += bars * fpbar; return r; });
  return { sections: out, bpm: g.bpm, framesPerBeat: g.framesPerBeat, framesPerBar: fpbar, seconds: +(f / fps).toFixed(4), beat: g.framesPerBeat / fps };
}

/* a value-bearing spec -> its claim (lint.proof: a digit needs a source) */
export const specText = (s) => `${s.label}: ${s.prefix || ''}${s.value}${s.unit ? ' ' + s.unit : ''}`;
export function specClaims(specs) { return (specs || []).filter((s) => s && s.value != null && s.value !== '').map((s) => ({ text: specText(s), source: s.source })); }

/* a spec callout following a device anchor (name in hwdata anchors, or a device-local point) through [at, at + dur + 0.4] */
export function calloutItem(D, A, { name = null, point = null, at, dur, spec = {}, off = null, side = 'auto', accent, fps = 30, size = 1 }) {
  const track = D.track(name, at, at + dur + 0.45, fps, point);
  if (!track.length) return null;
  const s = S1080(A), o = off || (A.tall ? [110, -150] : [150, -120]);
  return { id: 'hw.specCallout', at: +at.toFixed(4), dur: +dur.toFixed(4), params: { track, off: o, side, label: spec.label ?? '', value: spec.value ?? null, unit: spec.unit ?? '', dec: spec.dec ?? 0, prefix: spec.prefix ?? '',
    source: spec.source ?? '', accent, size: size * (A.tall ? 1.0 : 1.0), draw: 0.45, count: 1.0 } };
}
/* the longest run of frames in [t0, t1] where a device anchor sits inside the frame with a margin (x in [m, 1 - m], y in [m, 1 - m]): [a, b] seconds or null.
   A callout on a part the camera moves past (the ports tour) starts when the part is in view and leaves before the part does. */
export function visibleWindow(D, name, t0, t1, fps = 30, m = 0.12, point = null) {
  let best = null, cur = null;
  for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) { const t = f / fps, q = point ? D.pxPoint(point, t) : D.px(name, t), inside = q && q[0] >= m && q[0] <= 1 - m && q[1] >= m && q[1] <= 1 - m;
    if (inside) { cur = cur ? [cur[0], t] : [t, t]; if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur.slice(); } else cur = null; }
  return best;
}
/* label-only callouts (no value): hw.specCallout prints the label without a number line (value null) */
export function dimItem(D, A, { a, b, at, dur, value, unit = 'mm', dec = 0, source, off = 60, accent, fps = 30 }) {
  const ta = D.track(null, at, at + dur + 0.35, fps, a), tb = D.track(null, at, at + dur + 0.35, fps, b);
  if (!ta.length || !tb.length) return null;
  return { id: 'hw.dimensionLine', at: +at.toFixed(4), dur: +dur.toFixed(4), params: { a: ta, b: tb, value, unit, dec, source, off, accent } };
}
export function glintItem(D, A, { a, b, at, dur, sweep, from = 0.05, to = 0.95, color = '#DDEBFF', fps = 30 }) {
  const ta = D.track(null, at, at + dur + 0.2, fps, a), tb = D.track(null, at, at + dur + 0.2, fps, b);
  if (!ta.length || !tb.length) return null;
  return { id: 'hw.edgeGlint', at: +at.toFixed(4), dur: +dur.toFixed(4), params: { a: ta, b: tb, sweep: sweep ?? dur, from, to, color } };
}

/* box of one line of text in px: anchor 'start' | 'middle' | 'end' at x, baseline y (the box is for eyes: [x0, y0, x1, y1]) */
export function textBox(text, x, y, fontPx, anchor = 'start', weight = 800) {
  const w = measure(String(text), fontPx, { weight }), x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return [Math.round(x0), Math.round(y - fontPx * 0.82), Math.round(x0 + w), Math.round(y + fontPx * 0.24)];
}
/* the same for a block element positioned by its top-left (CSS) with a known font size and line count */
export function blockBox(x, y, w, fontPx, lines = 1, lh = 1.08) { return [Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + fontPx * lh * lines)]; }

/* frame-accurate cue time: whole frames (the mixer places a cue on round(t * fps)) */
export const frameT = (t, fps = 30) => +(Math.floor(t * fps + 0.5 + 1e-9) / fps).toFixed(4);
