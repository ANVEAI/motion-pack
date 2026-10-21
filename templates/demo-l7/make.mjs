/* templates/demo-l7/make.mjs: a 14.8 s, 16:9 metaphor-manifesto demo (launch-playbook archetype L7) that uses the six L7 parts:
     layers  look.duotone, look.threshold1bit (layers/stylize.js), background.gridTunnel, background.dotGrid (layers/backgrounds.js)
     type    type/outlineFill          transitions  transitions/ditherDissolve
   Techniques learned from docs/evidence/reference-stan-launchpad-2026-10.md; the content is original and neutral (no third-party footage,
   brands or wording). Pictures are the pack's own renders (templates/_shared/media, blender/previews). Not a genre template: no config.mjs,
   so tools/count.py does not list it; the CONFIG block below is the editable part.
     node make.mjs     then     npx -y hyperframes@0.8.142 render . -o out/demo-l7.mp4 --crf 23                                                */
import fs from 'node:fs'; import path from 'node:path';
import { stage, head, esc, write, mix, lintPlan, lintStop } from '../_shared/compose.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs';
import { sequence, lintPace } from '../_shared/plan.mjs';
import { REGISTRY } from '../../transitions/lib/registry.js';
import { lintType, lintPiece } from '../../type/presets.js';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..');

/* ============================== CONFIG (edit me) ============================== */
const ACCENT = '#4A18ED', PAPER = '#F5F2EA', INK = '#111111';
const CONFIG = {
  fps: 30, size: [1920, 1080], music: 'music/bed_anthem_build_loop8',   // 120 BPM: a beat is 15 frames, every cut below sits on a beat
  shots: [   // kind: line (type over a background) | still (image) | clip (video); look: a layers look on the picture; bg: a layers background
    { id: 's1', kind: 'line', dur: 2.5, bg: { kind: 'gridTunnel', params: { color: ACCENT, bg: PAPER, lines: 8, depth: 12, drift: 0.6, zoom: 0.03 } },
      text: 'Every tool started as a sketch.', type: 'type/maskRise', size: 88, color: INK },
    { id: 's2a', kind: 'still', dur: 0.5, src: 'blender/previews/03-explode-16x9.jpg', look: ['duotone', { dark: ACCENT, light: PAPER, contrast: 2.4, pivot: 0.22 }], tx: 'transitions/cut' },
    { id: 's2b', kind: 'still', dur: 0.5, src: 'blender/previews/01-turntable-16x9.jpg', look: ['duotone', { dark: PAPER, light: ACCENT, contrast: 2.0, pivot: 0.2 }], tx: 'transitions/cut' },
    { id: 's2c', kind: 'still', dur: 0.5, src: 'blender/previews/02-macro-16x9.jpg', look: ['duotone', { dark: ACCENT, light: PAPER, contrast: 1.8, pivot: 0.3 }], tx: 'transitions/cut' },
    { id: 's3', kind: 'line', dur: 2.5, bg: { kind: 'dotGrid', params: { color: ACCENT, bg: PAPER, spacing: 34, radius: 3, hole: 0.3, glow: 0.55, fade: 0.6 } },
      text: 'It looked <em>impossible.</em>', type: 'type/weightMorph', size: 150, color: INK },
    { id: 's4a', kind: 'clip', dur: 0.5, src: 'templates/_shared/media/plate-devices.mp4', mediaStart: 1.2, look: ['threshold1bit', { dither: 'bayer8', cell: 3, threshold: 0.62, dark: INK, light: PAPER }], tx: 'transitions/cut' },
    { id: 's4b', kind: 'still', dur: 0.5, src: 'blender/previews/05-liquid-16x9.jpg', look: ['threshold1bit', { dither: 'bayer4', cell: 4, threshold: 0.32, dark: ACCENT, light: PAPER }], tx: 'transitions/cut' },
    { id: 's5', kind: 'line', dur: 3.0, bg: null, text: 'Until it <em>shipped.</em>', type: 'type/outlineFill', size: 250, color: INK, noOut: true },
    { id: 's6', kind: 'clip', dur: 1.5, src: 'templates/_shared/media/plate-cast.mp4', mediaStart: 0.6,
      tx: 'transitions/ditherDissolve', txReason: 'CONTRAST: the claim breaks into accent blocks and clears onto the people it was for', txParams: { cell: 30, sweep: 0.3 } },
    { id: 's7', kind: 'end', dur: 2.8, hold: true, title: 'Your launch', sub: '· 2026', type: 'type/trackingCollapse', subType: 'type/blurIn' },
  ],
  sfx: { archive: 'sfx/tx/cut_tick', line: 'sfx/whoosh/swish_s', slam: 'sfx/hit/low_thump', logo: 'sfx/logo/ascend_land' },
  layers: [{ kind: 'vignette', params: { amount: 0.12 } }, { kind: 'grain', params: { stock: 'digital-soft' } }],
};
/* ============================================================================== */

const C = CONFIG, F = C.fps, [W, H] = C.size, f = (x) => (+x).toFixed(4);
const { shots, seconds } = sequence(C.shots.map((s, i) => ({ ...s, tx: i ? s.tx || 'transitions/cut' : undefined })), F);
const cues = [], at = (id) => shots.find((s) => s.id === id);
for (const id of ['s2a', 's2b', 's2c', 's4a', 's4b']) cues.push({ id: C.sfx.archive, t: at(id).start, gainDb: -6, why: 'archive cut ' + id });
cues.push({ id: C.sfx.line, t: at('s3').start, gainDb: -4, why: 'line 2 lands' }, { id: C.sfx.slam, t: at('s5').start, gainDb: -2, why: 'line 3: the big outline' }, { id: C.sfx.logo, t: at('s7').start, gainDb: 0, why: 'end title' });
const P = txPlan(shots, F, { bpm: 120 });
for (const w of P.wins) for (const s of REGISTRY[w.key].sfx) {   // the transition's paired sweeteners (registry), anchor frame = point + offset_f - 1 (audio.py adds the +1 frame rule)
  const fr = { start: w.startF, cut: w.cutF, end: w.endF, peak: w.cutF }[s.at] + s.offset_f - 1; cues.push({ id: s.id, t: +(fr / F).toFixed(6), gainDb: s.gain_db, why: 'sweetener ' + w.key }); }
const typeSpecs = shots.filter((s) => s.text).map((s) => ({ preset: s.type.split('/')[1], text: s.text.replace(/<[^>]+>/g, ''), at: s.start + 0.1, out: s.noOut ? null : s.start + s.dur - 0.25 }));
const plan = { template: 'demo-l7', fps: F, seconds, music: C.music, size: C.size, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [], paceRule: { aslMax: 2.5, longMax: 3.1 } };
plan.lint = { pace: lintPace(shots, plan.paceRule),
  type: Object.fromEntries(typeSpecs.map((t) => [t.text, lintType({ ...t, out: t.out ?? undefined })])), piece: lintPiece([...typeSpecs, { preset: 'trackingCollapse' }, { preset: 'blurIn' }]) };
const fails = lintPlan(plan);   // lint.proof + lint.tx: the gate cues.mjs runs for the genre templates (compose.mjs)
fs.mkdirSync(path.join(DIR, 'out'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'out', 'plan.json'), JSON.stringify(plan, null, 1));
console.log('plan', `${shots.length} shots, ${seconds} s, ${plan.cues.length} cues`, 'lint', JSON.stringify(plan.lint));
lintStop(fails, 'demo-l7');

const abs = (p) => path.join(PACK, p), media = [...new Set(shots.filter((s) => s.src).map((s) => abs(s.src)))];
const st = stage(DIR, { media, layers: true });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace

const css = `
.w { position: absolute; inset: 0; }
.bgc { position: absolute; inset: 0; }
.line { display: grid; place-items: center; text-align: center; }
.line .tx { position: relative; font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; max-width: 1500px; }
.line em { font-style: normal; color: ${ACCENT}; }
.end { background: ${PAPER}; display: grid; place-items: center; text-align: center; }
.end .ttl { font-weight: 800; font-size: 190px; color: ${ACCENT}; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1; }
.end .sub { font-weight: 300; font-size: 64px; color: ${INK}; margin-top: 28px; letter-spacing: 0.08em; }
.paper { background: ${PAPER}; }`;
let body = '', tl = '', boot = '';
shots.forEach((s, i) => {
  const o = span(P, { sel: '#' + s.id, start: s.start, dur: s.dur, mediaStart: s.mediaStart });
  const timed = `data-start="${f(o.start)}" data-duration="${f(o.dur)}" data-track-index="${i % 2}"`;
  if (s.kind === 'clip') {
    body += `\n<div class="w" id="w-${s.id}"><video id="${s.id}" class="clip fill" src="assets/media/${path.basename(s.src)}" muted playsinline ${timed} data-media-start="${o.mediaStart}"></video></div>`;
    if (s.look) boot += `\nmountLook(document.getElementById('w-${s.id}'), ${JSON.stringify(s.look[0])}, ${JSON.stringify(s.look[1])}, { H: ${H} });`;
  } else if (s.kind === 'still') {
    body += `\n<section class="clip paper" id="${s.id}" ${timed}><img class="fill" src="assets/media/${path.basename(s.src)}" alt=""></section>`;
    if (s.look) boot += `\nmountLook(document.getElementById('${s.id}'), ${JSON.stringify(s.look[0])}, ${JSON.stringify(s.look[1])}, { H: ${H} });`;
  } else if (s.kind === 'line') {
    body += `\n<section class="clip line paper" id="${s.id}" ${timed}>${s.bg ? `<div class="bgc" id="bg-${s.id}"></div>` : ''}<div class="tx" id="t-${s.id}" style="font-size:${s.size}px;color:${s.color}">${s.text}</div></section>`;
    if (s.bg) boot += `\nbindHF(mountStack(document.getElementById('bg-${s.id}'), [${JSON.stringify(s.bg)}], { width: ${W}, height: ${H}, fps: ${F} }), { t0: ${f(s.start)}, fps: ${F} });`;
    tl += `\n  MP.type(tl, ${JSON.stringify(s.type)}, '#t-${s.id}', { at: ${f(s.start + 0.1)}, dur: ${f(s.dur - 0.1)}, fps: ${F}, out: ${!s.noOut} });`;
  } else if (s.kind === 'end') {
    body += `\n<section class="clip end" id="${s.id}" ${timed}><div><div class="ttl" id="t-${s.id}">${esc(s.title)}</div><div class="sub" id="u-${s.id}">${esc(s.sub)}</div></div></section>`;
    tl += `\n  MP.type(tl, ${JSON.stringify(s.type)}, '#t-${s.id}', { at: ${f(s.start + 0.05)}, dur: ${f(s.dur - 0.05)}, fps: ${F}, out: false });`;
    tl += `\n  MP.type(tl, ${JSON.stringify(s.subType)}, '#u-${s.id}', { at: ${f(s.start + 0.45)}, dur: ${f(s.dur - 0.45)}, fps: ${F}, out: false });`;
  }
});
tl += txCalls(P, { W, H });
if (P.todo.length) console.log('transitions todo:', P.todo.join(' | '));
fs.writeFileSync(path.join(DIR, 'out', 'tx.json'), JSON.stringify(P.wins, null, 1));
const html = `${head({ W, H, title: 'motion-pack demo-l7 (six L7 parts)', bg: PAPER, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${seconds}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${seconds}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${seconds}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
import { mountLook } from './assets/mp/layers/stylize.js';
gsap.config({ force3D: false });${boot}
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });
const tl = gsap.timeline({ paused: true });${tl}
tl.seek(tl.duration()).seek(0);   // one warm pass (bit-stable frames, see gotchas)
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), 'todo:', [...st.todo, ...P.todo].join(' | ') || 'none');
