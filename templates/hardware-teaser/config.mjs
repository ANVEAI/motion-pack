/* TEMPLATE hardware-teaser: the 6-15 s device teaser, 16:9 + a 9:16 re-layout. Three beats and nothing else: the SILHOUETTE (edge light in the dark), ONE DETAIL
   (a light sweep across one edge of the material, a glint riding it), the DATE CARD (the band ignites behind it on the hit). The product is never shown whole:
   the teaser promises, the launch film (templates/hardware-reveal) pays off. Craft from device teasers (darkness, one detail, a date), never their shots.
   Same engines and honesty rules as hardware-reveal (shared pipeline templates/_hw/makehw.mjs): FICTIONAL demo device, "render" label in frame, no digit without a
   source (the date is copy, a price is optional and always carries its note and source).
   Edit the CONFIG block only:  node make.mjs [--set aspect=9:16] [--set length=6|10|15]  then  npx -y hyperframes@0.8.142 render . -o out/hardware-teaser.mp4 --crf 23 */
import { layoutBars, aspectOf, safePx, S1080, glintItem, textBox, frameT } from '../_hw/hwplan.mjs';
import { director, SHOT_MOVES } from '../../objects/lib/hwshots.js';
import { nodeLayout } from '../../objects/lib/hwdata.js';
import { PLATFORMS } from '../_shared/plan.mjs';

/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 10,                                      // 6 | 10 | 15 (seconds; the nearest cut)
  aspect: '16:9', platform: null, fps: 30,
  brand: { name: 'Acme', accent: '#5CC8FF', ink: '#F4F6FA', paper: '#07080A', muted: '#9AA3B2', logo: null, url: 'acme.example', cta: '', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL
  product: { name: 'Acme Node' },
  text: { tease: 'Something new is coming', detail: 'Lit from within', kicker: 'Coming', date: 'Spring 2027', label: 'render · demo' },
  device: { material: 'anodised', color: '#8e939b', band: { color: '#5cc8ff' }, top: { kind: 'glass' } },
  media: { model: { src: null, size: null, axis: 'w', yaw: 0, label: 'your 3D model (GLB / glTF / OBJ)' }, photo: { src: null, depth: null, label: 'your product photo (2.5D parallax)' } },
  price: { value: null, currency: '$', label: 'From', note: 'indicative price · placeholder', source: '' },   // a teaser usually has no price: null
  transitions: {},                                 // all hard cuts on the bar lines by default
  type: { tease: 'type/trackingCollapse', detail: 'type/maskRise' },
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
  sfx: { hum: 'sfx/hw/hum_loop', sweep: 'sfx/hw/light_sweep', hit: 'sfx/hw/sub_hit', led: 'sfx/hw/led_on', glint: 'sfx/hw/chime_metal' },   // bundle hardware_launch
  music: { seed: 5, bpm: 120, gainDb: -1.0, ceilingDb: -2.5 },
};
/* ============================================================================== */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text', 'text.hook': 'text.tease', 'text.headline': 'text.detail', 'text.date': 'text.date',
  'media.model': 'media.model.src', 'media.photo': 'media.photo.src', 'product.name': 'product.name', 'aspects': 'aspect', 'music': 'music.seed',
};
export const CUTS = { 6: { dark: 1, detail: 1, date: 1 }, 10: { dark: 2, detail: 1, date: 2 }, 15: { dark: 3, detail: 2, date: 2 } };
export const cutOf = (len) => { const s = +len; return !Number.isFinite(s) ? 10 : s < 8 ? 6 : s < 12.5 ? 10 : 15; };

export function buildPlan(C) {
  const A = aspectOf(C.aspect), fps = C.fps, cut = cutOf(C.length), B = C.brand, T = C.text, acc = B.accent, s = S1080(A), S = safePx(A), W = A.W, H = A.H;
  const order = ['dark', 'detail', 'date'], G = layoutBars(order.map((id) => ({ id, bars: CUTS[cut][id] })), C.music.bpm, fps), sec = Object.fromEntries(G.sections.map((x) => [x.id, x]));
  const tail = cut === 6 ? 0.0 : 0.8, seconds = +(G.seconds + tail).toFixed(4);
  const KIND = { dark: 'silhouette', detail: 'sweep', date: 'card' };
  const shots3d = G.sections.map((x) => ({ id: x.id, kind: KIND[x.id], t0: x.t0, dur: x.id === 'date' ? x.dur + tail : x.dur, p: {} }));
  const D = director({ aspect: A.key, W, H, device: C.device, shots3d }), L = nodeLayout(C.device), { w, h, d } = L.spec, foot = L.foot;
  const overlays = [], titles = [], cues = [], texts = [];
  const cue = (id, t, why, extra = {}) => { if (id) cues.push({ id, t: frameT(t, fps), why, ...extra }); };
  const title = (id, text, at, dur, preset, pos, role = 'read') => { titles.push({ id, text, at: +at.toFixed(4), dur: +dur.toFixed(4), type: preset, ...pos }); texts.push({ id, text, t: [+at.toFixed(3), +(at + dur).toFixed(3)], box: textBox(text, pos.x, pos.y, pos.size, pos.anchor || 'start'), fontPx: Math.round(pos.size), role, fg: pos.color || B.ink }); };
  const dk = sec.dark, dt = sec.detail, da = sec.date;
  cue(C.sfx.hum, 0, 'electric hum under the dark (stops on the date hit)', { overBedDb: -12, untilT: da.t0 });
  if (dk.dur >= 3.9) title('tease', T.tease, dk.t0 + 0.8, dk.dur - 1.0, C.type.tease, { x: W / 2, y: A.tall ? S.y0 + 0.62 * S.h : H * 0.82, size: (A.tall ? 60 : 56) * s, anchor: 'middle', color: B.ink, weight: 700 });
  title('detail', T.detail, dt.t0 + 0.35, dt.dur - 0.5, C.type.detail, { x: S.x0, y: A.tall ? S.y1 - 40 * s : S.y1 - 30 * s, size: 50 * s, anchor: 'start', color: B.ink });
  const gl = glintItem(D, A, { a: [-w / 2 + 0.05, h + foot, d / 2], b: [w / 2 - 0.02, h + foot, d / 2], at: dt.t0 + 0.2, dur: dt.dur - 0.3, sweep: (dt.dur - 0.3) * 0.9 }); if (gl) overlays.push(gl);
  cue(C.sfx.sweep, dt.t0 + 0.2 + (dt.dur - 0.3) * 0.45, 'the glint at its brightest');
  cue(C.sfx.hit, da.t0, 'the date hit: one deep sub hit on the drop'); cue(C.sfx.led, da.t0 + 0.08, 'the band ignites behind the date');
  const hasPrice = C.price && C.price.value != null;
  overlays.push({ id: 'hw.dateCard', at: da.t0 + 0.1, dur: da.dur + tail - 0.25, params: { kicker: T.kicker, name: C.product.name, date: T.date, price: hasPrice ? C.price.value : null, priceLabel: C.price.label, currency: C.price.currency, note: hasPrice ? C.price.note : T.label, source: C.price.source,
    accent: acc, ink: B.ink, muted: B.muted, cta: B.cta, box: A.tall ? [S.x0 / W, (S.y0 + 0.08 * S.h) / H, S.w / W, 0.5 * S.h / H] : [0.12, 0.06, 0.76, 0.6] } });
  const shots = G.sections.map((x, i) => { const key = i ? `${order[i - 1]}>${x.id}` : null, tx = key && C.transitions[key]; return { id: x.id, kind: 'plate', start: x.t0, dur: x.id === 'date' ? +(x.dur + tail).toFixed(4) : x.dur, mediaStart: x.t0, move: SHOT_MOVES[KIND[x.id]], shot3d: KIND[x.id], ...(tx ? { tx: tx[0], txReason: tx[1] } : {}), ...(x.id === 'date' ? { hold: true } : {}) }; });
  cues.sort((a, b) => a.t - b.t);
  const energy = { dark: 0.08, detail: [0.3, 0.55], date: 0.95 };
  const score = { sections: G.sections.map((x) => ({ name: x.id === 'date' ? 'reveal' : x.id, bars: x.bars, energy: energy[x.id] })).concat(tail ? [] : []), bpm: C.music.bpm, seed: C.music.seed, tail: Math.max(0.6, tail + 0.4) };
  const claims = hasPrice ? [{ text: `price: ${C.price.currency}${C.price.value}`, source: C.price.source }] : [];
  const platform = C.platform || A.platform;
  return { template: 'hardware-teaser', fps, seconds, aspect: C.aspect, size: [W, H], W, H, cut, platform, safe: PLATFORMS[platform]?.safe, safeZone: A.zone, bpm: G.bpm, framesPerBeat: G.framesPerBeat,
    brand: B, product: C.product, label: T.label, accent: acc, paper: B.paper, device: C.device, media: C.media, sections: G.sections, shots3d, shots, overlays, titles, cues, texts, claims,
    musicFile: 'score' + (A.tall ? '-tall' : '') + '.wav', music: null, score, musicGainDb: C.music.gainDb, ceilingDb: C.music.ceilingDb, fadeInMs: 30, layers: C.layers,
    audio: { mode: 'music', quiet: [] }, paceRule: { aslMax: 6, longMax: 7 }, plate: { name: 'hardware-teaser-' + A.key, aspect: A.key, seconds, fps, paper: B.paper, accent: acc, device: C.device, shots3d, media: C.media } };
}
