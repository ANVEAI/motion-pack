/* TEMPLATE demo-type-layout: a sentence-led product film (16:9, 17.5 s) built only from the 2026-10-14 type + layout parts, as a working example of each.
   Pattern: a sentence-led product film (craft learned from public launch films, nothing copied): small type on paper carries the story, every beat lands on the
   120 BPM grid (15 f per beat), hard cuts between beats, UI sounds on every state change, a brand colour field with the mark at the end.
   Copy is neutral placeholder text; media are the pack's own placeholder art; logos are not used. */
import { beatGrid, sequence, PLATFORMS, SIZES } from '../_shared/plan.mjs';

const F = 1 / 30;
/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  fps: 30, bpm: 120, platform: 'x.video', music: 'music/bed_corporate_bright_loop8',
  paper: '#F3F1EC', ink: '#0E0E14', brand: '#4A18ED',
  scenes: [   // beats (0.5 s each); part = a type/<name> id (SVG kinetic piece via the type adapter) or a gfx id (layout.* / callout.*)
    { id: 'collage', beats: 6, part: 'layout.scatterCollage', params: { text: 'Your team dreams big', size: 70, explodeAt: 0.9 } },
    { id: 'wheel', beats: 4, part: 'type/wordWheel', params: { words: ['Plans', 'Docs', 'Sites', 'Build it all.', 'Design', 'Data', 'Automations'], steps: [[0, 0], [0.3, 1], [0.6, 2], [0.9, 3]], move: 0.26, size: 92 } },
    { id: 'inline', beats: 5, part: 'type/inlineMedia', params: { text: 'Every [stack] idea, in [photo] *one* place', size: 80 } },
    { id: 'mosaic', beats: 3, part: 'layout.mosaicBurst', params: { fly: 0.7, spread: 0.45 } },
    { id: 'orbit', beats: 5, part: 'layout.orbitRing', params: { text: 'Every task, connected.', size: 58, iconStart: 0.35 } },
    { id: 'marquee', beats: 3, part: 'type/marquee', bg: 'ink', params: { text: 'all in one place ·', accent: 'one', accentStyle: 'pixel', size: 0.4, speed: 0.55 } },
    { id: 'connect', beats: 3, part: 'callout.connectorLabel', params: { items: [{ label: 'From the first idea', at: [0.3, 0.36], tint: '#FFD8C2', ink: '#3A1E10' }, { label: 'to the final launch', at: [0.5, 0.6], tint: '#D9D2FF', ink: '#1C1050' }], origin: [0.2, 0.14], step: 0.55, draw: 0.38, size: 46 } },
    { id: 'end', beats: 6, part: 'type/glyphMorphCursor', bg: 'brand', hold: true, params: { text: 'Build it all', size: 92, charRate: 2 * F, blink: 0.25, shapes: ['circle', 'square'], morph: 0.18, hold: 0.08, color: '#FFFFFF', accent: '#FFFFFF', glyph: 1.1 } },
  ],
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],   // no vignette: it greys the paper corners
  sfx: { key: ['sfx/ui/type_key', 'sfx/device/keyboard_mech_soft'], tick: ['sfx/ui/tick', 'sfx/ui/count_tick'], pop: 'sfx/ui/pop', blip: 'sfx/ui/blip', whoosh: 'sfx/whoosh/whoosh_m', big: 'sfx/whoosh/whoosh_l', swish: 'sfx/whoosh/swish_s', whip: 'sfx/whoosh/swish_xs',   // whip_pan's broadband transient overshot the delivered AAC by 1.7 dB (-0.98 dBTP)
   
    card: 'sfx/device/card_flip', slide: 'sfx/ui/slide', typing: 'sfx/ui/typing_burst', logo: 'sfx/logo/two_note' },
};
/* ============================================================================== */

export function buildPlan(C) {
  const G = beatGrid(C.bpm, C.fps, 60), spb = G.beatSec, S = C.sfx;
  const { shots, seconds } = sequence(C.scenes.map((s) => ({ id: s.id, part: s.part, params: s.params, bg: s.bg || 'paper', hold: !!s.hold, dur: s.beats * spb, tx: 'transitions/cut' })), C.fps);
  const at = (id) => shots.find((s) => s.id === id).start, cues = [], cue = (id, t, why) => cues.push({ id, t: +t.toFixed(6), gainDb: 0, why });
  const P = (id) => C.scenes.find((s) => s.id === id).params;
  // collage: a tick per word as the sentence builds (stagger 5 f), the explosion whoosh, pops as the field lands
  P('collage').text.split(' ').forEach((_, i) => cue(S.key[i % 2], at('collage') + i * 5 * F, 'collage word ' + (i + 1)));
  cue(S.whoosh, at('collage') + P('collage').explodeAt, 'collage explodes'); cue(S.pop, at('collage') + P('collage').explodeAt + 0.3, 'collage field lands');
  // word wheel: one tick per step (on the steps), a blip on the landing word
  P('wheel').steps.forEach(([t], i) => cue(i ? S.tick[i % 2] : S.swish, at('wheel') + t, i ? 'wheel step ' + i : 'cut to the wheel'));
  cue(S.blip, at('wheel') + 0.9 + P('wheel').move, 'wheel lands on the key line');
  // inline media: pops when the two slots open, card flips on the riffles
  cue(S.pop, at('inline') + 5 * F, 'stack slot opens'); cue(S.pop, at('inline') + 4 * 5 * F, 'photo slot opens');
  for (let k = 1; k <= 3; k++) cue(S.card, at('inline') + 5 * F + 14 * F + k * 0.5 - 0.19, 'stack riffle ' + k);
  cue(S.big, at('mosaic'), 'mosaic bursts on the cut');
  cue(S.swish, at('orbit'), 'rings draw'); [0, 2, 4].forEach((i) => cue(S.blip, at('orbit') + P('orbit').iconStart + i * 4 * F, 'icon ' + (i + 1) + ' enters'));
  cue(S.whip, at('marquee'), 'cut to the marquee');
  [0, 1].forEach((i) => { cue(S.slide, at('connect') + i * P('connect').step, 'connector ' + (i + 1) + ' draws'); cue(S.pop, at('connect') + i * P('connect').step + P('connect').draw * 0.85, 'tag ' + (i + 1) + ' lands'); });
  const e = P('end'), n = e.text.length, mStart = n * e.charRate + e.blink, per = e.morph + e.hold;
  cue(S.typing, at('end'), 'typing'); e.shapes.forEach((_, i) => cue(S.blip, at('end') + mStart + i * per, 'caret morphs ' + (i + 1)));
  cue(S.logo, at('end') + mStart + e.shapes.length * per, 'the mark lands');
  const Pl = PLATFORMS[C.platform];
  return { template: 'demo-type-layout', fps: C.fps, seconds, music: C.music, size: SIZES[Pl.aspect], bpm: G.bpm, beatSec: spb, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [], ceilingDb: -2.0, fadeInMs: 40, paceRule: { aslMax: 2.5, longMax: 3.1 } };
}
