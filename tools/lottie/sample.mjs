/* motion-pack / tools / lottie / sample.mjs: sample the pack's OWN pure functions of t at a frame rate, for the Lottie exporter (tools/lottie/export.py).
   Nothing is re-implemented here: kinetic type comes from type/presets.js unitStates, draw-on progress from type/ease.js E + seg (the maths of
   type/gfx/drawon.js drawOnAt), spring tracks from type/ease.js springTrack. Reads a JSON request on stdin, writes JSON on stdout.
     request  { fps, frames, items: [ {kind:'type', preset, at, out?, stagger?, dur?, params?, units:[str]}
                                     | {kind:'drawon', n, at, dur, stagger, ease, mode, fillAfter}
                                     | {kind:'track', props: {name: [[t, v], ...]}, cls}
                                     | {kind:'eased', props: {name: [{t, v, ease?}, ...]}} ] }
     response { items: [ {states: [[unitState per unit] per frame]} | {k: [[k per path] per frame], fill: [...]} | {props: {name: [v per frame]}} ] } */
import { unitStates, PRESETS } from '../../type/presets.js';
import { E, seg, clamp, springTrack } from '../../type/ease.js';

const KEEP = ['x', 'y', 'scale', 'rot', 'rotX', 'opacity', 'clip', 'track', 'wght', 'blur', 'glyph', 'rgb', 'shake', 'fill', 'stroke'];

function sampleType(it, fps, frames) {
  if (!PRESETS[it.preset]) throw new Error('unknown type preset ' + it.preset);
  const spec = { preset: it.preset, at: it.at ?? 0, params: it.params || {} };
  for (const k of ['out', 'stagger', 'dur', 'ease', 'noExit', 'outReverse']) if (it[k] !== undefined) spec[k] = it[k];
  const out = []; let win = null;
  for (let f = 0; f < frames; f++) {
    const r = unitStates(spec, it.units, f / fps);
    out.push(r.states.map((s) => Object.fromEntries(KEEP.map((k) => [k, s[k]]))));
    win = [spec.at, r.outDone];
  }
  /* window: the clip window a composition gives the text (from `at` to the end of its exit); the Lottie layer in / out points */
  return { states: out, unit: PRESETS[it.preset].unit, mask: PRESETS[it.preset].mask || null, window: win };
}

function sampleDrawOn(it, fps, frames) {
  const ez = E[it.ease || 'soft'] || E.soft, at = it.at ?? 0, dur = it.dur ?? 1, st = it.stagger ?? 0.05, fa = it.fillAfter ?? 0;
  const k = [], fill = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps, row = [], frow = [];
    for (let i = 0; i < it.n; i++) {
      let v = ez(seg(t, at + i * st, at + i * st + dur)); if (it.mode === 'erase') v = 1 - v;
      row.push(v); frow.push(fa > 0 ? clamp((v - 1 + fa) / fa) : 1);
    }
    k.push(row); fill.push(frow);
  }
  return { k, fill };
}

function sampleTrack(it, fps, frames) {
  const props = {};
  for (const [name, changes] of Object.entries(it.props || {})) { props[name] = []; for (let f = 0; f < frames; f++) props[name].push(springTrack(f / fps, changes, it.cls || 'ui')); }
  return { props };
}

/* piecewise eased keys: between key i and i+1 the value moves with E[key(i+1).ease || 'soft'] */
function sampleEased(it, fps, frames) {
  const props = {};
  for (const [name, keys] of Object.entries(it.props || {})) {
    props[name] = [];
    for (let f = 0; f < frames; f++) {
      const t = f / fps; let v = keys[0].v;
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1], b = keys[i]; if (t <= a.t) break;
        const e = (E[b.ease || 'soft'] || E.soft)(seg(t, a.t, b.t)); v = Array.isArray(a.v) ? a.v.map((x, j) => x + (b.v[j] - x) * e) : a.v + (b.v - a.v) * e;
      }
      props[name].push(v);
    }
  }
  return { props };
}

const chunks = []; for await (const c of process.stdin) chunks.push(c);
const req = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const fps = req.fps, frames = req.frames;
const items = req.items.map((it) => (it.kind === 'type' ? sampleType(it, fps, frames) : it.kind === 'drawon' ? sampleDrawOn(it, fps, frames) : it.kind === 'track' ? sampleTrack(it, fps, frames) : sampleEased(it, fps, frames)));
process.stdout.write(JSON.stringify({ items }));
