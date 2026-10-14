/* TEMPLATE demo-r6-type: a "product tour" film (16:9, about 33 s) built from the six round-6 type parts (2026-10-15), as a working example of each.
   Pattern: chapter cards (title.verbCard: one giant word settles into the line that completes the phrase) -> a chart you hover (chart.hoverTooltip over the chart it draws)
   -> a dock of placeholder icons that opens one window (ui.dockLaunch) -> rows that connect one by one (ui.connectRows) -> a diagram that degrades, then recovers into a tidy
   layout (layout.degradingDiagram) -> a command typed into an outlined pill (type.commandPill, the end card).
   Craft only: nothing from a reference is copied. Hard cuts on the 120 BPM grid (15 f per beat), one sound per action (gfxCues), a quiet end tail.
   HONESTY: every number on screen is the chart's own illustrative placeholder data, and the tooltip prints its source ("illustrative data") and method in the chip itself;
   the dock window and the connect rows carry an "illustrative: placeholder ..." label in frame. All names are placeholders (App A, Service A); all icons are the pack's own. */
import { beatGrid, sequence, PLATFORMS, SIZES } from '../_shared/plan.mjs';
import { gfxCues } from '../../type/gfx/index.js';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  fps: 30, bpm: 120, platform: 'x.video', music: 'music/bed_tech_pulse_loop8',
  bgs: { paper: '#F3F1EC', dark: '#0B1210', ink: '#0E0E14', night: '#07060B' },
  scenes: [   // beats (0.5 s each); items = gfx ids (mountGfx, { part, at (s, local), dur, params })
    { id: 'verbs', beats: 10, bg: 'night', items: [{ part: 'title.verbCard', params: { words: [{ big: 'Plan', rest: 'the whole week' }, { big: 'Ship', rest: 'it before lunch' }], chapterDur: 2.4 } }] },
    { id: 'hover', beats: 11, bg: 'paper', items: [{ part: 'chart.hoverTooltip', params: { scale: 1.5, chart: { label: 'Illustrative weekly series' } } }] },
    { id: 'dock', beats: 11, bg: 'ink', items: [{ part: 'ui.dockLaunch', params: { scale: 1.5 } }] },
    { id: 'connect', beats: 14, bg: 'ink', items: [{ part: 'ui.connectRows', params: { scale: 1.5 } }] },
    { id: 'degrade', beats: 18, bg: 'night', items: [{ part: 'layout.degradingDiagram', params: { beats: [
      { at: 0, caption: 'Everything looks fine', layout: 'trio', mood: 'calm', links: 'line' },
      { at: 1.5, caption: 'Steps start to repeat', layout: 'trio', mood: 'worried', links: 'loop' },
      { at: 3.0, caption: 'Cracks begin to spread', layout: 'trio', mood: 'cracked', links: 'loop' },
      { at: 4.5, caption: 'Then it breaks', layout: 'trio', mood: 'broken', links: 'broken' },
      { at: 6.4, caption: 'One tidy layout', layout: 'row4', mood: 'tidy', links: 'line' },
      { at: 7.9, caption: 'Every part checked', layout: 'row4', mood: 'tidy', links: 'line', marks: [1, 1, -1, 1] }] } }] },
    { id: 'end', beats: 8, bg: 'ink', hold: true, items: [{ part: 'type.commandPill', params: { text: 'ship --first-draft', size: 84, dur: 4 } }] },
  ],
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
};
/* ============================================================================== */

export function buildPlan(C) {
  const G = beatGrid(C.bpm, C.fps, 60), spb = G.beatSec;
  const { shots, seconds } = sequence(C.scenes.map((s) => ({ id: s.id, items: s.items || [], layers: s.layers || [], bg: s.bg, hold: !!s.hold, dur: s.beats * spb, tx: 'transitions/cut' })), C.fps);
  const cues = [], keep = (s, c, why, gainDb = 0) => { if (c.t < s.start + s.dur - 0.05) cues.push({ id: c.id, t: c.t, gainDb, why: `${s.id}: ${why}` }); };
  for (const s of shots) for (const it of s.items) { const at = s.start + (it.at || 0); for (const c of gfxCues(it.part, { at, params: it.params, dur: it.dur ?? s.dur - (it.at || 0) })) keep(s, c, c.why); }
  // one sound per moment: drop a cue that lands within 2 frames of an earlier kept cue
  cues.sort((a, b) => a.t - b.t); const kept = []; for (const c of cues) if (!kept.length || c.t - kept.at(-1).t > 2 / C.fps) kept.push({ ...c, t: +c.t.toFixed(6) });
  const Pl = PLATFORMS[C.platform];
  return { template: 'demo-r6-type', fps: C.fps, seconds, music: C.music, size: SIZES[Pl.aspect], bpm: G.bpm, beatSec: spb, shots, cues: kept,
    claims: [{ text: 'the weekly series on the hovered chart (bars, values, change pills)', source: 'illustrative placeholder data defined in the part\'s own defaults (chart.hoverTooltip -> chart.bar); the chip and the chart carry that label in frame' }], ceilingDb: -2.0, fadeInMs: 40, paceRule: { aslMax: 6.5, longMax: 9.5 } };
}
