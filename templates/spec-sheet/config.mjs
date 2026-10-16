/* TEMPLATE spec-sheet: the 20-30 s animated spec comparison for a device, 16:9 + a 9:16 re-layout. intro (the device turns, the name) -> the COMPARISON TABLE
   (ui.dataTable, dark theme: rows land one by one, every value counts up, the new device's column highlights) -> ONE hero spec on the device itself (a spec
   callout on its part, on the drop) -> the end card. Craft from spec-reveal segments of hardware launches (one number at a time, the hero number last, the
   product on screen while the numbers land), never their layouts or numbers.
   HONESTY GATE: every number is a claim; the table prints its `source` under it and the frame says "demo specs" while the numbers are placeholders. A comparison
   against a real competitor's product needs that product's own published figure as the source (and its name only if you have the right to use it); the demo
   compares against a FICTIONAL "previous model" of the same fictional brand.
   Edit the CONFIG block only:  node make.mjs [--set aspect=9:16] [--set length=20|24|30]  then  npx -y hyperframes@0.8.142 render . -o out/spec-sheet.mp4 --crf 23 */
import { layoutBars, aspectOf, safePx, S1080, calloutItem, textBox, frameT } from '../_hw/hwplan.mjs';
import { director, SHOT_MOVES } from '../../objects/lib/hwshots.js';
import { PLATFORMS } from '../_shared/plan.mjs';

const SRC = 'placeholder data';
/* ============================== CONFIG (edit me) ============================== */
export const CONFIG = {
  length: 24,                                      // 20 | 24 | 30 (seconds; the nearest cut)
  aspect: '16:9', platform: null, fps: 30,
  brand: { name: 'Acme', accent: '#5CC8FF', ink: '#F4F6FA', paper: '#07080A', muted: '#9AA3B2', logo: null, url: 'acme.example', cta: 'Compare every spec', font: { display: 'Manrope', text: 'Manrope' } },   // FICTIONAL
  product: { name: 'Acme Node' },
  text: { title: 'Acme Node', sub: 'Specifications', finding: 'More compute, less power, same desk.', hero: 'AI compute', end: 'Acme Node', label: 'render · demo specs' },
  device: { material: 'anodised', color: '#8e939b', band: { color: '#5cc8ff' }, top: { kind: 'glass' } },
  media: { model: { src: null, size: null, axis: 'w', yaw: 0, label: 'your 3D model (GLB / glTF / OBJ)' }, photo: { src: null, depth: null, label: 'your product photo (2.5D parallax)' } },
  table: {                                         // the comparison: columns + rows; every value is a number with the row's unit; `source` applies to the table (printed under it)
    columns: [{ label: 'Spec' }, { label: 'Previous model' }, { label: 'Acme Node' }], highlight: { col: 2 }, source: SRC,
    rows: [{ label: 'AI compute', unit: '', dec: 0, values: [40, 120] }, { label: 'Memory (GB)', unit: '', dec: 0, values: [64, 128] }, { label: 'Power draw (W)', unit: '', dec: 0, values: [320, 240] }, { label: 'Weight (kg)', unit: '', dec: 1, values: [3.4, 2.1] }],
  },
  hero: { label: 'AI compute', value: 120, unit: 'TOPS', source: SRC, part: 'card' },   // the one number that lands ON the device (a spec callout on its part)
  transitions: { 'table>hero': ['transitions/push', 'STORY: from the table to the thing it describes'] },
  type: { title: 'type/charRise', sub: 'type/blurIn', end: 'type/maskRise' },
  layers: [{ kind: 'grain', params: { stock: 'upload-safe' } }],
  sfx: { intro: 'sfx/hw/led_on', row: 'sfx/hw/click_detent', hero: 'sfx/hw/sub_hit', chime: 'sfx/hw/chime_metal', logo: 'sfx/logo/hybrid' },
  music: { seed: 7, bpm: 120, gainDb: -1.5, ceilingDb: -2.5 },
};
/* ============================================================================== */
export const PROJECT_MAP = {
  'brand.name': 'brand.name', 'brand.accent': 'brand.accent', 'brand.ink': 'brand.ink', 'brand.paper': 'brand.paper', 'brand.logo': 'brand.logo', 'brand.url': 'brand.url', 'brand.cta': 'brand.cta',
  'brand.font.display': 'brand.font.display', 'brand.font.text': 'brand.font.text', 'text.headline': 'text.title', 'text.sub': 'text.sub', 'text.hook': 'text.finding', 'text.end': 'text.end',
  'media.model': 'media.model.src', 'media.photo': 'media.photo.src', 'product.name': 'product.name', 'aspects': 'aspect', 'music': 'music.seed',
};
export const CUTS = { 20: { intro: 2, table: 5, hero: 2, end: 1 }, 24: { intro: 2, table: 6, hero: 2, end: 2 }, 30: { intro: 3, table: 6, hero: 3, end: 2 } };
export const cutOf = (len) => { const s = +len; return !Number.isFinite(s) ? 24 : s < 22 ? 20 : s < 27 ? 24 : 30; };

export function buildPlan(C) {
  const A = aspectOf(C.aspect), fps = C.fps, cut = cutOf(C.length), B = C.brand, T = C.text, acc = B.accent, s = S1080(A), S = safePx(A), W = A.W, H = A.H;
  const order = ['intro', 'table', 'hero', 'end'], G = layoutBars(order.map((id) => ({ id, bars: CUTS[cut][id] })), C.music.bpm, fps), sec = Object.fromEntries(G.sections.map((x) => [x.id, x]));
  const tail = 1.0, seconds = +(G.seconds + tail).toFixed(4);
  const KIND = { intro: 'spin', table: 'card', hero: 'explode', end: 'end' };
  const shots3d = G.sections.map((x) => ({ id: x.id, kind: KIND[x.id], t0: x.t0, dur: x.id === 'end' ? x.dur + tail : x.dur, p: x.id === 'intro' ? { cam: A.tall ? {} : { target: [0, 0.17, 0] } } : x.id === 'hero' ? { at: 0.25, stagger: 0.07, backTail: 0.9 } : {} }));
  const D = director({ aspect: A.key, W, H, device: C.device, shots3d });
  const overlays = [], titles = [], cues = [], texts = [];
  const cue = (id, t, why, extra = {}) => { if (id) cues.push({ id, t: frameT(t, fps), why, ...extra }); };
  const title = (id, text, at, dur, preset, pos, role = 'read') => { titles.push({ id, text, at: +at.toFixed(4), dur: +dur.toFixed(4), type: preset, ...pos }); texts.push({ id, text, t: [+at.toFixed(3), +(at + dur).toFixed(3)], box: textBox(text, pos.x, pos.y, pos.size, pos.anchor || 'start'), fontPx: Math.round(pos.size), role, fg: pos.color || B.ink }); };
  const it = sec.intro, tb = sec.table, he = sec.hero, en = sec.end;
  const nameY = A.tall ? S.y0 + 165 * s : S.y0 + 150 * s;
  title('title', T.title, it.t0 + 0.3, it.dur - 0.5, C.type.title, { x: W / 2, y: nameY, size: (A.tall ? 112 : 120) * s, anchor: 'middle', color: B.ink, weight: 800 }, 'headline');
  title('sub', T.sub, it.t0 + 0.9, it.dur - 1.1, C.type.sub, { x: W / 2, y: nameY + 76 * s, size: (A.tall ? 56 : 48) * s, anchor: 'middle', color: B.muted, weight: 600 });
  cue(C.sfx.intro, it.t0 + 0.05, 'the band lights on the first frame');
  /* the table: ui.dataTable (dark), every row lands with a detent; its source prints under it */
  const tbl = C.table, rowsAt = 0.6, stagger = Math.min(0.5, (tb.dur - 3.2) / Math.max(1, tbl.rows.length));
  const box = A.tall ? [S.x0 / W, (S.y0 + 20 * s) / H, S.w / W, 0.62 * S.h / H] : [0.08, 0.1, 0.84, 0.8];
  overlays.push({ id: 'ui.dataTable', at: tb.t0 + 0.1, dur: tb.dur - 0.4, params: { box, scale: A.tall ? 1.05 : 1.25, finding: T.finding, columns: tbl.columns, rows: tbl.rows, highlight: tbl.highlight, source: tbl.source, theme: 'dark', accent: acc, headerAt: 0.25, rowsAt, stagger, countDur: 0.9, hlAt: rowsAt + stagger * tbl.rows.length + 0.4 } });
  tbl.rows.forEach((_, i) => cue(C.sfx.row, tb.t0 + 0.1 + rowsAt + i * stagger, `table row ${i + 1} lands`));
  /* the hero spec ON the device: the parts open a little and the callout lands on its part, on the drop */
  cue(C.sfx.hero, he.t0, 'the hero spec: one sub hit on the drop');
  const X = D.explodePlans.hero, at = he.t0 + Math.min(he.dur - 1.6, X.outEnd + 0.1), hc = calloutItem(D, A, { name: C.hero.part || 'card', at, dur: he.t0 + X.backAt - at - 0.05, spec: C.hero, off: A.tall ? [-110, -200] : [-200, -130], accent: acc, fps, size: 1.15 });
  if (hc) { overlays.push(hc); cue(C.sfx.chime, hc.at + 0.43, 'hero callout lands'); }
  title('hero', T.hero, he.t0 + 0.2, he.dur - 0.4, C.type.sub, { x: S.x0, y: A.tall ? S.y0 + 70 * s : S.y0 + 80 * s, size: (A.tall ? 56 : 48) * s, anchor: 'start', color: B.muted, weight: 700 });
  const endY = A.tall ? S.y0 + 0.36 * S.h : H * 0.4;
  title('end', T.end, en.t0 + 0.15, en.dur + tail - 0.3, C.type.end, { x: W / 2, y: endY, size: (A.tall ? 104 : 112) * s, anchor: 'middle', color: B.ink, weight: 800 }, 'endcard');
  title('url', B.url, en.t0 + 0.5, en.dur + tail - 0.6, C.type.sub, { x: W / 2, y: endY + 90 * s, size: 38 * s, anchor: 'middle', color: acc, weight: 700 }, 'endcard');
  cue(C.sfx.logo, en.t0 + 0.15, 'sonic logo on the end card');
  const shots = G.sections.map((x, i) => { const key = i ? `${order[i - 1]}>${x.id}` : null, tx = key && C.transitions[key]; return { id: x.id, kind: 'plate', start: x.t0, dur: x.id === 'end' ? +(x.dur + tail).toFixed(4) : x.dur, mediaStart: x.t0, move: SHOT_MOVES[KIND[x.id]], shot3d: KIND[x.id], ...(tx ? { tx: tx[0], txReason: tx[1] } : {}), ...(x.id === 'table' || x.id === 'end' ? { hold: true } : {}) }; });
  for (const sh of shots) if (sh.tx === 'transitions/push') cue('sfx/tx/push', sh.start, 'transition push');
  cues.sort((a, b) => a.t - b.t);
  const energy = { intro: 0.45, table: [0.55, 0.65], hero: 1.0, end: 0.3 };
  const score = { sections: G.sections.map((x) => ({ name: x.id === 'end' ? 'tail' : x.id, bars: x.bars, energy: energy[x.id] })), bpm: C.music.bpm, seed: C.music.seed, tail };
  const claims = [...tbl.rows.flatMap((r) => r.values.map((v, j) => ({ text: `${r.label} (${tbl.columns[j + 1]?.label ?? 'column ' + (j + 1)}): ${v}`, source: tbl.source }))), { text: `${C.hero.label}: ${C.hero.value} ${C.hero.unit}`, source: C.hero.source }];
  const platform = C.platform || A.platform;
  return { template: 'spec-sheet', fps, seconds, aspect: C.aspect, size: [W, H], W, H, cut, platform, safe: PLATFORMS[platform]?.safe, safeZone: A.zone, bpm: G.bpm, framesPerBeat: G.framesPerBeat,
    brand: B, product: C.product, label: T.label, accent: acc, paper: B.paper, device: C.device, media: C.media, sections: G.sections, shots3d, shots, overlays, titles, cues, texts, claims,
    musicFile: 'score' + (A.tall ? '-tall' : '') + '.wav', music: null, score, musicGainDb: C.music.gainDb, ceilingDb: C.music.ceilingDb, fadeInMs: 30, layers: C.layers,
    audio: { mode: 'music', quiet: [] }, paceRule: { aslMax: 8, longMax: 13 }, plate: { name: 'spec-sheet-' + A.key, aspect: A.key, seconds, fps, paper: B.paper, accent: acc, device: C.device, shots3d, media: C.media } };
}
