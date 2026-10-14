/* templates/demo-ui-kit/make.mjs: a 17 s 16:9 product film for a FICTIONAL product ("Acme") built from the type/gfx UI kit (ui.*), to show the kit cut together.
     node make.mjs            -> out/plan.json (scenes + cue sheet), assets/ (fonts, pack modules), assets/media/mix.wav (music/mixer.py, -14 LUFS), index.html
     npx -y hyperframes@0.8.142 render . -o out/demo-ui-kit.mp4 --crf 23
     python3 ../_shared/sheet.py out/demo-ui-kit.mp4 out/sheet.jpg <times>
   Not a genre template (no config.mjs, so tools/count.py does not count it): the CONFIG block below is the whole edit. Every part is referenced by id; every frame is a
   pure function of t (the page re-renders the SVG on each hf-seek). All copy is placeholder for a fictional product; the map card's numbers are labelled illustrative. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, head, write } from '../_shared/compose.mjs';
import { uiCues } from '../../type/gfx/index.js';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..');

export const CONFIG = {
  fps: 30, W: 1920, H: 1080, seconds: 17, music: 'music/bed_tech_pulse_loop8', musicGainDb: 0, ceilingDb: -2.5,   // -2.5: the UI clicks overshoot in HyperFrames' own AAC (it lowered a -1.5 master by 2.2 dB)
    // 120 BPM: every cut sits on a beat (0.5 s grid)
  paper: '#F4F2EE', ink: '#16151B', accent: '#4A18ED', night: '#121118',
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
  scenes: [
    { id: 'ask', start: 0, end: 2.5, bg: 'paper', why: 'hook: the typed prompt is the action beat (frame 0 already moving)',
      items: [{ id: 'ui.promptBar', at: -0.2, params: { text: "Plan next week's restock", title: 'What should Acme do today?', typeAt: 0.25, cps: 26, sendAt: 1.95, chip: 'Suggested: restock plan', box: [0.15, 0.42, 0.7, 0.15], scale: 1.45 } }] },
    { id: 'work', start: 2.5, end: 5.5, bg: 'paper', why: 'AI at work: verbs on objects, the data card beside it',
      items: [{ id: 'ui.agentActivity', at: 2.5, params: { box: [0.04, 0.14, 0.44, 0.72], scale: 1.4, start: 0.25, step: 0.5, steps: [{ verb: 'Checking', obj: 'Inventory' }, { verb: 'Reading', obj: 'Supplier notes' }, { verb: 'Comparing', obj: 'Prices' }, { verb: 'Drafting', obj: 'Order' }, { verb: 'Writing', obj: 'Team update' }],
        card: { box: [0.5, 0.15, 0.46, 0.7], title: 'Suppliers', source: 'illustrative data', at: 0.1, pointStep: 0.38, points: [[0.26, 0.4], [0.5, 0.28], [0.72, 0.52], [0.42, 0.66], [0.84, 0.3]], counters: [{ label: 'notes read', to: 128 }, { label: 'suppliers compared', to: 9 }] } } }] },
    { id: 'flow', start: 5.5, end: 8.0, bg: 'paper', why: 'the rule it follows, drawn as a workflow; the camera glides down the graph',
      items: [{ id: 'ui.nodeGraph', at: 5.5, params: { start: 0.12, stagger: 0.4, zoom: 1.55 } }] },
    { id: 'build', start: 8.0, end: 10.5, bg: 'paper', why: 'building: the checklist tilts into an isometric plane while it works, then settles flat',
      items: [{ id: 'ui.isometricTilt', at: 8.0, params: { box: [0.26, 0.14, 0.48, 0.72], tiltAt: 0.25, backAt: 1.75, inner: { id: 'ui.checklist', params: { box: [0.26, 0.14, 0.48, 0.72], scale: 1.35, title: 'Preparing the order', start: 0.25, step: 0.36, steps: ['Building order…', 'Connecting to supplier', 'Checking budget', 'Preparing summary'] } } } }] },
    { id: 'scan', start: 10.5, end: 12.5, bg: 'night', why: 'proof in the world: the delivery is scanned and verified', parcel: [0.4, 0.2, 0.2, 0.36],
      items: [{ id: 'ui.scanOverlay', at: 10.5, params: { box: [0.4, 0.2, 0.2, 0.36], from: [0.22, 0.08, 0.56, 0.72], lockAt: 0.1, sweepAt: 0.45, sweepDur: 0.9, label: 'Checking delivery…', done: 'Delivery verified', scale: 1.3, mask: 'M0.5 0 L1 0.25 L1 0.75 L0.5 1 L0 0.75 L0 0.25 Z' } }] },
    { id: 'close', start: 12.5, end: 17, bg: 'paper', why: 'one container carries the close: approve -> working -> done -> notified -> the name; ends on its first state', promise: { text: 'Restock, handled.', at: 2.55 },
      items: [{ id: 'ui.stateMorph', at: 12.5, params: { center: [0.5, 0.44], scale: 1.6, cls: 'panel', states: [
        { at: 0, kind: 'pill', w: 250, h: 84, r: 42, fill: '#16151B', label: 'Acme' }, { at: 0.35, kind: 'button', w: 420, h: 100, r: 50, fill: '#4A18ED', label: 'Approve order' },
        { at: 1.0, kind: 'loader', w: 128, h: 128, r: 64, fill: '#4A18ED' }, { at: 1.6, kind: 'check', w: 128, h: 128, r: 64, fill: '#17A865' },
        { at: 2.0, kind: 'toast', w: 520, h: 104, r: 52, fill: '#16151B', label: 'Team notified' }, { at: 2.45, kind: 'pill', w: 250, h: 84, r: 42, fill: '#16151B', label: 'Acme' }],
        path: [{ at: 0.1, x: 0.7, y: 0.8 }, { at: 0.95, x: 0.505, y: 0.47, click: true }, { at: 1.7, x: 0.8, y: 0.92 }] } }] },
  ],
  sfx: { cut: 'sfx/whoosh/swish_xs', logo: 'sfx/logo/two_note' },
};

const C = CONFIG, F = C.fps, T = C.seconds;
/* ---------- plan + cue sheet (the same plan drives picture and sound) ---------- */
const cues = [];
for (const sc of C.scenes) { for (const it of sc.items) for (const q of uiCues(it.id, it)) if (q.t >= sc.start && q.t < sc.end - 1 / F) cues.push({ ...q, scene: sc.id });
  const inner = sc.items[0].params?.inner; if (inner) for (const q of uiCues(inner.id, { at: sc.start, params: inner.params })) cues.push({ ...q, scene: sc.id });
  if (sc.start > 0) cues.push({ t: sc.start, id: C.sfx.cut, why: 'cut: whoosh peaks on the cut', scene: sc.id }); }
const close = C.scenes.at(-1); cues.push({ t: close.start + close.items[0].params.states.at(-1).at, id: C.sfx.logo, why: 'sonic logo on the name', scene: close.id });
cues.sort((a, b) => a.t - b.t);
const shots = C.scenes.map((s) => ({ id: s.id, start: s.start, dur: +(s.end - s.start).toFixed(4), parts: s.items.map((i) => i.id).concat(s.items[0].params?.inner ? [s.items[0].params.inner.id] : []), transition: 'transitions/cut', why: s.why }));
const plan = { template: 'demo-ui-kit', fps: F, seconds: T, W: C.W, H: C.H, music: C.music, musicGainDb: C.musicGainDb, ceilingDb: C.ceilingDb, shots, cues, honesty: 'fictional product (Acme); placeholder copy; map-card numbers labelled "illustrative data"',
  lint: { cutsOnBeat: shots.every((s) => Math.abs(s.start * 2 - Math.round(s.start * 2)) < 1e-9), partsUsed: [...new Set(shots.flatMap((s) => s.parts))] } };
fs.mkdirSync(path.join(DIR, 'out'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'out', 'plan.json'), JSON.stringify(plan, null, 1));
console.log(`plan: ${shots.length} shots, ${cues.length} cues, parts ${plan.lint.partsUsed.length} (${plan.lint.partsUsed.join(', ')}), cuts on beat: ${plan.lint.cutsOnBeat}`);

/* ---------- stage: fonts, layers + type modules (compose.mjs), plus type/gfx (the UI kit lives there) ---------- */
const st = stage(DIR, { layers: C.layers.length > 0 });
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
for (const f of fs.readdirSync(path.join(PACK, 'type', 'gfx')).filter((f) => f.endsWith('.js'))) link(path.join(PACK, 'type', 'gfx', f), path.join(DIR, 'assets', 'mp', 'type', 'gfx', f));
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
execFileSync('python3', [path.join(SH, 'audio.py'), path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });

/* ---------- page ---------- */
const css = `#bg { z-index: 0; } #stage { z-index: 2; } #fx { pointer-events: none; } #fx canvas { z-index: 5; }`;
const html = `${head({ W: C.W, H: C.H, title: 'motion-pack demo: UI kit (fictional product Acme)', bg: C.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${C.W}" data-height="${C.H}" data-duration="${T}">
<div id="bg" class="clip" data-start="0" data-duration="${T}" data-track-index="0"></div>
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="1"></div>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { renderInner } from './assets/mp/type/gfx/index.js';
import { ctxFor, text, f2 } from './assets/mp/type/gfx/core.js';
import { spring } from './assets/mp/type/ease.js';
import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
const C = ${JSON.stringify({ W: C.W, H: C.H, scenes: C.scenes, paper: C.paper, night: C.night, ink: C.ink })};
const ctx = ctxFor(C.W, C.H, null, 1), bg = document.getElementById('bg'), stage = document.getElementById('stage');
/* an original illustrated parcel (iso cube, box-local 0..1 coords, same silhouette as the scan mask) */
const parcel = ([bx, by, bw, bh], u) => { const x = bx * C.W, y = by * C.H, w = bw * C.W, h = bh * C.H, k = spring(u, 'panel'), P = (pts) => pts.map(([a, b]) => f2(x + a * w) + ',' + f2(y + b * h + 24 * (1 - k))).join(' ');
  return '<ellipse cx="' + f2(x + w / 2) + '" cy="' + f2(y + h * 1.04) + '" rx="' + f2(w * 0.55) + '" ry="' + f2(h * 0.07) + '" fill="#000" opacity="0.35"/>' +
    '<polygon points="' + P([[0.5, 0], [1, 0.25], [0.5, 0.5], [0, 0.25]]) + '" fill="#DDAA70"/><polygon points="' + P([[0, 0.25], [0.5, 0.5], [0.5, 1], [0, 0.75]]) + '" fill="#B27A45"/><polygon points="' + P([[0.5, 0.5], [1, 0.25], [1, 0.75], [0.5, 1]]) + '" fill="#C78C52"/>' +
    '<polygon points="' + P([[0.22, 0.11], [0.3, 0.07], [0.8, 0.32], [0.72, 0.36]]) + '" fill="#EFE3CC" opacity="0.9"/><polygon points="' + P([[0.6, 0.62], [0.88, 0.48], [0.88, 0.6], [0.6, 0.74]]) + '" fill="#F4F0E6"/>'; };
function frame(t) {
  const sc = C.scenes.find((s) => t >= s.start && t < s.end) || C.scenes.at(-1); bg.style.background = sc.bg === 'night' ? C.night : C.paper;
  let svg = sc.parcel ? parcel(sc.parcel, t - sc.start) : '';
  for (const it of sc.items) svg += renderInner(it.id, t, { at: it.at, dur: 1e6, params: it.params }, ctx);
  if (sc.promise) { const u = t - sc.start - sc.promise.at, k = spring(u, 'headline'); if (u > 0) svg += '<g opacity="' + f2(Math.min(1, u / 0.12)) + '" transform="translate(0 ' + f2(26 * (1 - k)) + ')">' + text(sc.promise.text, C.W / 2, C.H * 0.44 + 190, { size: 76, weight: 800, fill: C.ink, anchor: 'middle', ls: -1 }) + '</g>'; }
  stage.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + C.W + ' ' + C.H + '" width="' + C.W + '" height="' + C.H + '" style="position:absolute;inset:0">' + svg + '</svg>';
}
window.addEventListener('hf-seek', (e) => frame(e.detail.time)); frame(window.__hfThreeTime || 0);
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${C.W}, height: ${C.H}, fps: ${F}, seed: 7 }), { fps: ${F} });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), 'todo:', st.todo.join(' | ') || 'none');
