/* TEMPLATE hardware-reveal: the AI-hardware / device launch film, 45-75 s, 16:9 master + a 9:16 RE-LAYOUT (its own cameras, text positions and card boxes).
   dark cold open (edge-light silhouette) -> a light sweep across the material -> THE REVEAL on the drop (every light on, the LED band ignites, a turntable turn, the
   name) -> an exploded view with spec callouts on leader lines -> a scale reference on a desk -> a ports / IO tour -> "inside": x-ray, the cooling lifts away, the
   chip's lid lifts and the die lights -> a spec sheet card -> an availability / price card (price labelled indicative or placeholder) -> the end card.
   The craft is learned from how device keynote reveals and hardware launch films are built (darkness tease, light sweep, macro materials, exploded views, spec
   reveals; docs/evidence notes stay out of this file), never their shots, copy, music or designs.
   Engines: a three.js plate (objects/lib/hwplate.js, rendered once per aspect by tools/render.mjs on the GPU) under a HyperFrames page (type presets, the hw.*
   overlay parts tracked onto the device, layers). Sound: music/reveal.py composes a dark -> reveal score FITTED to these sections (the drop is the reveal bar)
   and the hardware_launch sfx bundle; music/mixer.py masters it to -14 LUFS.
   HONESTY: every number on screen is a claim with a source (lint.proof fails the build without one); the demo device is FICTIONAL ("Acme Node", a pack render)
   and the frame says "render · demo specs" the whole time; a price always prints its note (indicative / placeholder) and its source.
   Edit the CONFIG block only:  node make.mjs [--set aspect=9:16] [--set length=short|full|long|<seconds>] [--set media.model.src=/abs/device.glb] ...
   then  npx -y hyperframes@0.8.142 render . -o out/hardware-reveal.mp4 --crf 23   (9:16: cd tall && ... -o ../out/hardware-reveal-tall.mp4) */
import { layoutBars, aspectOf, safePx, S1080, calloutItem, dimItem, glintItem, textBox, specClaims, frameT, visibleWindow } from '../_hw/hwplan.mjs';
import { director, SHOT_MOVES } from '../../objects/lib/hwshots.js';
import { nodeLayout, PORT_KINDS } from '../../objects/lib/hwdata.js';
import { explodeCues } from '../../objects/lib/explode.js';
import { TX_SFX, PLATFORMS } from '../_shared/plan.mjs';

const SRC = 'placeholder data';                    // the source every demo number carries (replace with yours: a datasheet, a lab report, a measured run)
/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 'full',                                  // 'short' (46 s) | 'full' (56 s) | 'long' (70 s) | seconds (the nearest cut)
  aspect: '16:9',                                  // '16:9' | '9:16' (a re-layout, not a crop)
  platform: null,                                  // null = x.video for 16:9, reels.organic for 9:16 (templates/_shared/plan.mjs PLATFORMS)
  fps: 30,
  brand: { name: 'Acme', accent: '#5CC8FF', ink: '#F4F6FA', paper: '#07080A', muted: '#9AA3B2', logo: null, url: 'acme.example', cta: 'Reserve yours', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL placeholder brand
  product: { name: 'Acme Node' },
  text: {                                          // ALL on-screen copy (no digits here: numbers live in specs / price with their source)
    tease: 'Something new is coming', sweep: 'Machined from one block', reveal: 'Acme Node', revealSub: 'Your models. Your desk.',
    explode: 'Built in layers', scale: 'Fits beside your laptop', ports: 'Every port on the back', inside: 'The chip inside', insideLabel: 'Neural engine', coolingLabel: 'Fin-stack cooling',
    specsTitle: 'Specifications', kicker: 'Available', date: 'Spring 2027', end: 'Acme Node', endSub: 'Run it locally.', label: 'render · demo specs',
  },
  device: { material: 'anodised', color: '#8e939b', band: { color: '#5cc8ff' }, top: { kind: 'glass' } },   // objects/lib/hwdata.js nodeSpec: w h d chamfer r material top band vents ports
  media: {                                         // every slot nullable: null = the pack's generic device / nothing, labelled in frame
    model: { src: null, size: null, axis: 'w', yaw: 0, label: 'your 3D model (GLB / glTF / OBJ)' },   // YOUR product: replaces the generic device in the turntable shots
    photo: { src: null, depth: null, label: 'your product photo (2.5D parallax)' },                    // ONE still: a 2.5D plate in the hero / spec / price / end shots
  },
  specs: [                                         // every number on screen: label, value, unit, source. `part` = where its callout points in the exploded view
    { id: 'compute', label: 'AI compute', value: 120, unit: 'TOPS', source: SRC, part: 'card' },
    { id: 'memory', label: 'Unified memory', value: 128, unit: 'GB', source: SRC, part: 'memory' },
    { id: 'storage', label: 'Storage', value: 4, unit: 'TB', source: SRC },
    { id: 'power', label: 'Power draw', value: 240, unit: 'W', source: SRC },
    { id: 'weight', label: 'Weight', value: 2.1, dec: 1, unit: 'kg', source: SRC },
  ],
  dims: { source: 'demo model dimensions (the render, not a measured product)' },   // the scale shot measures the device model itself (hwdata dims in mm)
  price: { value: 999, currency: '$', label: 'From', note: 'indicative price · placeholder', source: SRC },   // value null = no price line (the date only)
  ports: [1, 3, 5],                                // which back ports get a callout (indices into the device's port row)
  transitions: {                                   // section boundary -> [id, REASON] (a hard cut needs none; lint refuses an unmotivated transition)
    'explode>scale': ['transitions/whip', 'ENERGY: from the parts in the air to the box on a desk'],
    'ports>inside': ['transitions/zoom-through', 'PLACE: from the outside into the box'],
    'specs>price': ['transitions/dip-to-black', 'RHYTHM: settle before the ask'],
  },
  type: { tease: 'type/trackingCollapse', title: 'type/charRise', line: 'type/maskRise', sub: 'type/blurIn', end: 'type/maskRise' },
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],   // the plate already bakes bloom, vignette and fine grain (do not stack them twice)
  sfx: { hum: 'sfx/hw/hum_loop', sweep: 'sfx/hw/light_sweep', reveal: 'sfx/hw/sub_hit', led: 'sfx/hw/led_on', name: 'sfx/hw/chime_reveal', release: 'sfx/hw/parts_separate', seat: 'sfx/hw/parts_seat',
    spec: 'sfx/hw/click_detent', port: 'sfx/hw/port_insert', scan: 'sfx/ui/scan_sweep', die: 'sfx/hw/chime_metal', dim: 'sfx/ui/slide', date: 'sfx/hit/soft', logo: 'sfx/logo/hybrid', fan: 'sfx/hw/fan_spinup' },   // bundle hardware_launch
  music: { seed: 3, bpm: 120, gainDb: -1.0, ceilingDb: -2.5 },   // music/reveal.py: the dark -> reveal score composed for these sections (drop = the reveal bar)
};
/* ============================================================================== */

/* the field map onto the shared project file (templates/_shared/project.schema.json, lane 6): project path -> CONFIG path */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text', 'text.hook': 'text.tease', 'text.headline': 'text.reveal', 'text.sub': 'text.revealSub', 'text.cta': 'brand.cta',
  'text.end': 'text.endSub', 'media.model': 'media.model.src', 'media.photo': 'media.photo.src', 'media.hero': 'media.photo.src', 'product.name': 'product.name', 'aspects': 'aspect', 'music': 'music.seed',
};

/* the cuts: bars per section at 120 BPM (one bar = 2 s); the music is composed to the same bars */
export const CUTS = {
  short: { dark: 2, sweep: 2, reveal: 3, explode: 3, scale: 2, ports: 2, inside: 2, specs: 3, price: 2, end: 2 },
  full: { dark: 3, sweep: 2, reveal: 4, explode: 4, scale: 2, ports: 3, inside: 3, specs: 3, price: 2, end: 2 },
  long: { dark: 3, sweep: 3, reveal: 5, explode: 5, scale: 3, ports: 4, inside: 4, specs: 4, price: 2, end: 2 },
};
const KIND = { dark: 'silhouette', sweep: 'sweep', reveal: 'hero', explode: 'explode', scale: 'scale', ports: 'ports', inside: 'inside', specs: 'spin', price: 'card', end: 'end' };
const ENERGY = { dark: 0.08, sweep: [0.25, 0.5], reveal: 1.0, explode: 0.85, scale: 0.7, ports: 0.8, inside: 0.6, specs: 0.85, price: 0.5, end: 0.3 };
export const cutOf = (len) => { if (CUTS[len]) return len; const s = +len; if (!Number.isFinite(s)) return 'full'; return s < 51 ? 'short' : s < 63 ? 'full' : 'long'; };

export function buildPlan(C) {
  const A = aspectOf(C.aspect), fps = C.fps, cut = cutOf(C.length), B = C.brand, T = C.text, acc = B.accent, s = S1080(A), S = safePx(A), W = A.W, H = A.H;
  const order = ['dark', 'sweep', 'reveal', 'explode', 'scale', 'ports', 'inside', 'specs', 'price', 'end'];
  const G = layoutBars(order.map((id) => ({ id, bars: CUTS[cut][id] })), C.music.bpm, fps), sec = Object.fromEntries(G.sections.map((x) => [x.id, x]));
  const tail = 1.2, seconds = +(G.seconds + tail).toFixed(4);   // the score rings out 1.2 s past the last bar (the end card holds on it)
  const shots3d = G.sections.map((x) => ({ id: x.id, kind: KIND[x.id], t0: x.t0, dur: x.id === 'end' ? x.dur + tail : x.dur, p: x.id === 'explode' ? { at: 0.9, stagger: 0.1, backTail: Math.min(1.8, x.dur * 0.22) } : {} }));
  const P3 = { aspect: A.key, W, H, device: C.device, shots3d }, D = director(P3), L = nodeLayout(C.device), dims = L.dims, { w, h, d } = L.spec, foot = L.foot;
  const specs = (C.specs || []).filter(Boolean), byId = Object.fromEntries(specs.map((x) => [x.id, x]));
  const overlays = [], titles = [], cues = [], texts = [];
  const cue = (id, t, why, extra = {}) => { if (id) cues.push({ id, t: frameT(t, fps), why, ...extra }); };
  const title = (id, text, at, dur, preset, pos, role = 'read') => { titles.push({ id, text, at: +at.toFixed(4), dur: +dur.toFixed(4), type: preset, ...pos }); texts.push({ id, text, t: [+at.toFixed(3), +(at + dur).toFixed(3)], box: textBox(text, pos.x, pos.y, pos.size, pos.anchor || 'start'), fontPx: Math.round(pos.size), role, fg: pos.color || B.ink }); };
  const kick = (sx) => ({ x: A.tall ? S.x0 + 8 * s : S.x0, y: A.tall ? S.y0 + 70 * s : S.y0 + 80 * s, size: (A.tall ? 56 : 48) * s, anchor: 'start', color: B.muted, weight: 700 });
  /* ---- 1. dark cold open: the silhouette is visible and moving on frame 0; the line arrives ~1 s in ---- */
  const dk = sec.dark; title('tease', T.tease, dk.t0 + 1.0, dk.dur - 1.3, C.type.tease, { x: W / 2, y: A.tall ? S.y0 + 0.62 * S.h : H * 0.82, size: (A.tall ? 60 : 56) * s, anchor: 'middle', color: B.ink, weight: 700 });
  cue(C.sfx.hum, 0, 'electric hum under the dark open (stops on the reveal)', { overBedDb: -12, untilT: sec.reveal.t0 });
  /* ---- 2. light sweep: the travelling strip; a glint rides the front top chamfer ---- */
  const sw = sec.sweep; title('sweep', T.sweep, sw.t0 + 0.5, sw.dur - 0.8, C.type.line, { x: S.x0 + (A.tall ? 8 : 0) * s, y: A.tall ? S.y1 - 40 * s : S.y1 - 30 * s, size: (A.tall ? 56 : 50) * s, anchor: 'start', color: B.ink });
  const gl = glintItem(D, A, { a: [-w / 2 + 0.05, h + foot, d / 2], b: [w / 2 - 0.02, h + foot, d / 2], at: sw.t0 + 0.4, dur: sw.dur - 0.7, sweep: (sw.dur - 0.7) * 0.9 }); if (gl) overlays.push(gl);
  cue(C.sfx.sweep, sw.t0 + 0.4 + (sw.dur - 0.7) * 0.45, 'the glint at its brightest (the sweep sound peaks on its anchor)');
  /* ---- 3. THE REVEAL on the drop: the cut IS the light; the band ignites; the name ---- */
  const rv = sec.reveal; cue(C.sfx.reveal, rv.t0, 'REVEAL: one deep sub hit on the drop frame (tier 1)'); cue(C.sfx.led, rv.t0 + 0.1, 'the LED band ignites left to right');
  const nameY = A.tall ? S.y0 + 165 * s : S.y0 + 150 * s, nameS = (A.tall ? 120 : 132) * s;
  title('reveal', T.reveal, rv.t0 + 0.55, rv.dur - 0.8, C.type.title, { x: W / 2, y: nameY, size: nameS, anchor: 'middle', color: B.ink, weight: 800 }, 'headline');
  title('revealSub', T.revealSub, rv.t0 + 1.4, rv.dur - 1.6, C.type.sub, { x: W / 2, y: nameY + 80 * s, size: (A.tall ? 56 : 48) * s, anchor: 'middle', color: B.muted, weight: 600 });
  cue(C.sfx.name, rv.t0 + 0.55, 'the name lands (one chime)');
  /* ---- 4. exploded view: callouts on the parts once they settle; release + seat sounds ---- */
  const ex = sec.explode, X = D.explodePlans.explode, out = ex.t0 + X.outEnd + 0.15, hold = Math.max(1.2, ex.t0 + X.backAt - out - 0.1);
  title('explode', T.explode, ex.t0 + 0.3, ex.dur - 0.6, C.type.line, kick());
  const exCall = [['compute', 'card', A.tall ? [-120, -170] : [-170, -110]], ['memory', 'memory', A.tall ? [120, 150] : [190, 120]], [null, 'heatsink', A.tall ? [120, -170] : [170, -120]]];
  exCall.forEach(([sid, part, off], i) => { const sp = sid ? byId[sid] : { label: T.coolingLabel, value: null }; if (!sp) return; const it = calloutItem(D, A, { name: sp.part || part, at: out + i * 0.35, dur: hold - i * 0.35, spec: sp, off, accent: acc, fps }); if (it) { overlays.push(it); cue(C.sfx.spec, it.at + 0.43, `callout: ${sp.label}`); } });
  { const ec = explodeCues(X, { release: C.sfx.release, seat: C.sfx.seat, maxRelease: 1 }), rel = ec.find((c) => c.id === C.sfx.release), seat = ec.filter((c) => c.id === C.sfx.seat).at(-1);   // one release as the cascade starts, one seat as the last part seats
    if (rel) cue(rel.id, ex.t0 + rel.t, rel.why); if (seat) cue(seat.id, ex.t0 + seat.t, seat.why); }
  /* ---- 5. scale reference: the device on a desk beside the pack's laptop and mug; two dimension lines on its own edges ---- */
  const sc = sec.scale; title('scale', T.scale, sc.t0 + 0.3, sc.dur - 0.5, C.type.line, kick());
  const dW = dimItem(D, A, { a: [-w / 2, foot, d / 2], b: [w / 2, foot, d / 2], at: sc.t0 + 0.45, dur: sc.dur - 0.8, value: dims.w_mm, source: C.dims.source, off: -46, accent: acc, fps });
  const dH = dimItem(D, A, { a: [w / 2, foot, d / 2], b: [w / 2, h + foot, d / 2], at: sc.t0 + 0.75, dur: sc.dur - 1.1, value: dims.h_mm, source: C.dims.source, off: -40, accent: acc, fps });
  for (const it of [dW, dH]) if (it) { overlays.push(it); cue(C.sfx.dim, it.at, 'dimension line draws'); }
  /* ---- 6. ports / IO tour: label callouts as the camera trucks past; a cable clicks home ---- */
  const po = sec.ports; title('ports', T.ports, po.t0 + 0.3, po.dur - 0.6, C.type.line, kick());
  (C.ports || []).slice(0, 4).forEach((pi, i) => { const p = L.ports[pi]; if (!p) return; const win = visibleWindow(D, 'port' + pi, po.t0 + 0.4 + i * 0.3, po.t0 + po.dur - 0.3, fps, A.tall ? 0.14 : 0.1); if (!win || win[1] - win[0] < 1.2) return;   // only while the port is in view
    const it = calloutItem(D, A, { name: 'port' + pi, at: win[0], dur: Math.max(0.8, win[1] - win[0] - 0.45), spec: { label: PORT_KINDS[p.kind].label, value: null }, off: A.tall ? [60, -130 - 40 * i] : [90, -120 - 30 * i], side: 'auto', accent: acc, fps }); if (it) { overlays.push(it); cue(C.sfx.spec, it.at + 0.43, `port callout: ${PORT_KINDS[p.kind].label}`); } });
  cue(C.sfx.port, po.t0 + po.dur * 0.6 - 0.0, 'the cable clicks home (insert ends at 60% of the shot)');
  /* ---- 7. inside: x-ray, the cooling lifts away, a push onto the chip; the lid lifts, the die lights ---- */
  const ins = sec.inside; title('inside', T.inside, ins.t0 + 0.3, ins.dur - 0.6, C.type.line, kick());
  cue(C.sfx.scan, ins.t0 + ins.dur * 0.05, 'the shell turns to x-ray'); cue(C.sfx.die, ins.t0 + ins.dur * 0.7, 'the die lights');
  { const it = calloutItem(D, A, { name: 'die', at: ins.t0 + ins.dur * 0.74, dur: ins.dur * 0.26 - 0.2, spec: { label: T.insideLabel, value: null }, off: A.tall ? [90, -200] : [200, -120], accent: acc, fps }); if (it) overlays.push(it); }
  /* ---- 8. spec sheet card (the device turns beside it) ---- */
  const sp = sec.specs, rows = specs.map((x) => ({ label: x.label, value: x.value, unit: x.unit, dec: x.dec ?? 0 }));
  const cardBox = A.tall ? [S.x0 / W, (S.y0 + 10 * s) / H, S.w / W, (0.46 * S.h) / H] : [0.52, 0.14, 0.4, 0.72];
  const srcs = [...new Set(specs.map((x) => String(x.source || '').trim()).filter(Boolean))].join(' · ');
  overlays.push({ id: 'hw.specCard', at: sp.t0 + 0.25, dur: sp.dur - 0.6, params: { title: T.specsTitle, rows, source: srcs, note: T.label.includes('demo') ? 'demo specs' : '', box: cardBox, step: Math.min(0.42, (sp.dur - 2) / Math.max(1, rows.length)), accent: acc, ink: B.ink, muted: B.muted } });
  rows.forEach((_, i) => cue(C.sfx.spec, sp.t0 + 0.25 + 0.25 + i * Math.min(0.42, (sp.dur - 2) / Math.max(1, rows.length)), `spec row ${i + 1}`));
  /* ---- 9. availability / price ---- */
  const pr = sec.price, hasPrice = C.price && C.price.value != null;
  overlays.push({ id: 'hw.dateCard', at: pr.t0 + 0.2, dur: pr.dur - 0.45, params: { kicker: T.kicker, name: C.product.name, date: T.date, priceLabel: C.price?.label ?? 'From', price: hasPrice ? C.price.value : null, currency: C.price?.currency ?? '$', note: C.price?.note ?? 'indicative price · placeholder', source: C.price?.source ?? '', accent: acc, ink: B.ink, muted: B.muted, box: A.tall ? [S.x0 / W, (S.y0 + 0.12 * S.h) / H, S.w / W, 0.5 * S.h / H] : [0.12, 0.08, 0.76, 0.6] } });
  cue(C.sfx.date, pr.t0 + 0.32, 'the date lands');
  /* ---- 10. end card ---- */
  const en = sec.end, endY = A.tall ? S.y0 + 0.36 * S.h : H * 0.4;
  title('end', T.end, en.t0 + 0.15, en.dur + tail - 0.3, C.type.end, { x: W / 2, y: endY, size: (A.tall ? 104 : 112) * s, anchor: 'middle', color: B.ink, weight: 800 }, 'endcard');
  title('endSub', T.endSub, en.t0 + 0.5, en.dur + tail - 0.6, C.type.sub, { x: W / 2, y: endY + 76 * s, size: (A.tall ? 56 : 48) * s, anchor: 'middle', color: B.muted, weight: 600 }, 'endcard');
  title('url', B.url, en.t0 + 0.7, en.dur + tail - 0.8, C.type.sub, { x: W / 2, y: endY + 150 * s, size: 36 * s, anchor: 'middle', color: acc, weight: 700 }, 'endcard');
  cue(C.sfx.logo, en.t0 + 0.15, 'sonic logo on the end card');
  /* ---- shots (one plate clip per section: the transitions get two layers), the transition sweeteners ---- */
  const shots = G.sections.map((x, i) => { const key = i ? `${order[i - 1]}>${x.id}` : null, tx = key && C.transitions[key]; return { id: x.id, kind: 'plate', start: x.t0, dur: x.id === 'end' ? +(x.dur + tail).toFixed(4) : x.dur, mediaStart: x.t0, move: SHOT_MOVES[KIND[x.id]], shot3d: KIND[x.id], ...(tx ? { tx: tx[0], txReason: tx[1] } : {}), ...(['reveal', 'specs', 'price', 'end'].includes(x.id) ? { hold: true } : {}) }; });
  for (const sh of shots) if (sh.tx && TX_SFX[sh.tx]) cue(TX_SFX[sh.tx], sh.start, `transition ${sh.tx}`);
  cues.sort((a, b) => a.t - b.t);
  /* ---- the score: the same sections in bars; the drop lands on the reveal bar ---- */
  const score = { sections: G.sections.map((x) => ({ name: x.id === 'end' ? 'tail' : x.id, bars: x.bars, energy: ENERGY[x.id] })), bpm: C.music.bpm, seed: C.music.seed, tail };
  const claims = [...specClaims(specs), ...(hasPrice ? [{ text: `price: ${C.price.currency}${C.price.value}`, source: C.price.source }] : []), { text: `width ${dims.w_mm} mm`, source: C.dims.source }, { text: `height ${dims.h_mm} mm`, source: C.dims.source }];
  const platform = C.platform || A.platform;
  return { template: 'hardware-reveal', fps, seconds, aspect: C.aspect, size: [W, H], W, H, cut, platform, safe: PLATFORMS[platform]?.safe, safeZone: A.zone, bpm: G.bpm, framesPerBeat: G.framesPerBeat,
    brand: B, product: C.product, label: T.label, accent: acc, paper: B.paper, device: C.device, media: C.media, sections: G.sections, shots3d, shots, overlays, titles, cues, texts, claims,
    musicFile: 'score' + (A.tall ? '-tall' : '') + '.wav', music: null, score, musicGainDb: C.music.gainDb, ceilingDb: C.music.ceilingDb, fadeInMs: 30, layers: C.layers,
    audio: { mode: 'music', quiet: [] }, paceRule: { aslMax: 8, longMax: 9 }, plate: { name: 'hardware-reveal-' + A.key, aspect: A.key, seconds, fps, paper: B.paper, accent: acc, device: C.device, shots3d, media: C.media } };
}
