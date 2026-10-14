/* templates/demo-r3-ui/make.mjs: a 17.5 s 16:9 product film for a FICTIONAL product ("Acme Voice") cut from the round-3 UI kit parts (type/gfx/ui-data.js, ui-nav.js).
     node make.mjs            -> out/plan.json (scenes + cue sheet), assets/ (fonts, pack modules), assets/media/mix.wav (music/mixer.py, -14 LUFS), index.html
     npx -y hyperframes@0.8.142 render . -o out/demo-r3-ui.mp4 --crf 23
     python3 ../_shared/sheet.py out/demo-r3-ui.mp4 out/sheet.jpg <times>
   Not a genre template (no config.mjs, so tools/count.py does not count it): the CONFIG block is the whole edit. Every part is referenced by id; every frame is a pure
   function of t (the page re-renders the SVG on each hf-seek). Copy is placeholder for a fictional product; latency and timing numbers are labelled illustrative in frame. */
import fs from 'node:fs'; import path from 'node:path';
import { stage, head, write, mix, lintPlan, lintStop } from '../_shared/compose.mjs';
import { uiCues } from '../../type/gfx/index.js';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..');

export const CONFIG = {
  fps: 30, W: 1920, H: 1080, seconds: 17.5, music: 'music/bed_corporate_bright_loop8', musicGainDb: 0, ceilingDb: -2.5, fadeInMs: 40,   // 120 BPM: every cut on the 0.5 s grid; -2.5 for click-dense UI mixes
  colors: { paper: '#F4F2EE', night: '#121118', lilac: '#E9E6F2', brand: '#4A18ED', ink: '#16151B' },
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
  scenes: [
    { id: 'call', start: 0, end: 3.0, bg: 'night', why: 'hook: a live call is already streaming on frame 0; the latency badge is the proof beat',
      items: [{ id: 'ui.liveTranscript', at: -0.45, params: { box: [0.2, 0.14, 0.6, 0.72], scale: 1.5, wps: 4.2, source: 'latency values illustrative', turns: [
        { speaker: 'Caller', text: 'Hi, can I move my table to Saturday?', at: 0.35 },
        { speaker: 'Acme Voice', ai: true, text: 'Of course. Saturday at eight works.', at: 1.45, latency: 0.34, tags: ['Booking'] },
        { speaker: 'Caller', text: 'Perfect, thanks!', at: 2.6 }] } }] },
    { id: 'fix', start: 3.0, end: 5.5, bg: 'paper', why: 'control: fix one word of the script and regenerate only that word',
      items: [{ id: 'ui.wordRegenerate', at: 3.0, params: { box: [0.08, 0.28, 0.84, 0.44], scale: 1.3, selectAt: 0.25, clickAt: 0.75, replaceAt: 1.0, cps: 15, playDur: 0.9 } }] },
    { id: 'tone', start: 5.5, end: 7.5, bg: 'paper', why: 'choice: the voice picks a tone and locks',
      items: [{ id: 'ui.optionPicker', at: 5.5, params: { scale: 1.25, spinAt: 0.15, lockAt: 1.25, turns: 2, target: 0 } }] },
    { id: 'route', start: 7.5, end: 10.0, bg: 'night', why: 'reliability: a provider fails mid-call and traffic re-routes',
      items: [{ id: 'ui.failoverRoute', at: 7.5, params: { scale: 1.15, start: 0.0, rate: 0.14, travel: 0.7, failAt: 0.95, rerouteAt: 1.3, status: ['Routing calls', 'Provider A down', 'Rerouted to Provider B'] } }] },
    { id: 'tour', start: 10.0, end: 12.0, bg: 'paper', why: 'breadth: the dashboard tour as sliding tabs',
      items: [{ id: 'ui.tabPillNav', at: 10.0, params: { box: [0.17, 0.17, 0.66, 0.66], scale: 1.3, steps: [[0.5, 1], [1.0, 2], [1.5, 3]] } }] },
    { id: 'export', start: 12.0, end: 13.5, bg: 'paper', why: 'output: the call log is yours to take',
      items: [{ id: 'ui.fileChip', at: 12.0, params: { scale: 1.45, clickAt: 0.45, dlDur: 0.6 } }] },
    { id: 'site', start: 13.5, end: 16.0, bg: 'lilac', why: 'the world: glide down the product page, then pull out to all of it',
      items: [{ id: 'ui.pageFlythrough', at: 13.5, params: { stops: [[0.05, 0.1], [0.6, 0.33], [1.1, 0.56]], pullAt: 1.55, zoom: 1.3, fit: 0.38 } }] },
    { id: 'name', start: 16.0, end: 17.5, bg: 'brand', why: 'end card: the name and one promise', card: { name: 'Acme Voice', line: 'Every call, answered.' }, items: [] },
  ],
  sfx: { cut: ['sfx/whoosh/swish_xs', 'sfx/tx/cut_tick'], logo: 'sfx/logo/ascend_land' },
};

const C = CONFIG, F = C.fps, T = C.seconds;
/* ---------- plan + cue sheet (the same plan drives picture and sound) ---------- */
const cues = [];
C.scenes.forEach((sc, i) => { for (const it of sc.items) for (const q of uiCues(it.id, it)) if (q.t >= sc.start && q.t < sc.end - 1 / F) cues.push({ ...q, scene: sc.id });
  if (sc.start > 0) cues.push({ t: sc.start, id: C.sfx.cut[i % 2], why: 'cut: lands on the cut', scene: sc.id }); });
const name = C.scenes.at(-1); cues.push({ t: name.start + 0.12, id: C.sfx.logo, why: 'sonic logo on the name', scene: name.id });
cues.sort((a, b) => a.t - b.t);
const shots = C.scenes.map((s) => ({ id: s.id, start: s.start, dur: +(s.end - s.start).toFixed(4), parts: s.items.map((i) => i.id), transition: 'transitions/cut', why: s.why }));
const plan = { template: 'demo-r3-ui', fps: F, seconds: T, W: C.W, H: C.H, music: C.music, musicGainDb: C.musicGainDb, ceilingDb: C.ceilingDb, fadeInMs: C.fadeInMs, shots, cues,
  honesty: 'fictional product (Acme Voice); placeholder copy; latency badges and failover timings labelled illustrative in frame',
  lint: { cutsOnBeat: shots.every((s) => Math.abs(s.start * 2 - Math.round(s.start * 2)) < 1e-9), partsUsed: [...new Set(shots.flatMap((s) => s.parts))] } };
const fails = lintPlan(plan);   // lint.proof + lint.tx: the gate cues.mjs runs for the genre templates (compose.mjs)
fs.mkdirSync(path.join(DIR, 'out'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'out', 'plan.json'), JSON.stringify(plan, null, 1));
lintStop(fails, 'demo-r3-ui');
console.log(`plan: ${shots.length} shots, ${cues.length} cues, parts ${plan.lint.partsUsed.length} (${plan.lint.partsUsed.join(', ')}), cuts on beat: ${plan.lint.cutsOnBeat}`);

/* ---------- stage: fonts, layers + type modules (compose.mjs), plus type/gfx (the UI kit lives there) ---------- */
const st = stage(DIR, { layers: C.layers.length > 0 });
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
for (const f of fs.readdirSync(path.join(PACK, 'type', 'gfx')).filter((f) => f.endsWith('.js'))) link(path.join(PACK, 'type', 'gfx', f), path.join(DIR, 'assets', 'mp', 'type', 'gfx', f));
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace

/* ---------- page ---------- */
const css = `#bg { z-index: 0; } #stage { z-index: 2; } #fx { pointer-events: none; } #fx canvas { z-index: 5; }`;
const html = `${head({ W: C.W, H: C.H, title: 'motion-pack demo: UI kit round 3 (fictional product Acme Voice)', bg: C.colors.paper, css })}
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
const C = ${JSON.stringify({ W: C.W, H: C.H, scenes: C.scenes, colors: C.colors })};
const ctx = ctxFor(C.W, C.H, null, 1), bg = document.getElementById('bg'), stage = document.getElementById('stage');
/* end card: the name lands on the headline spring, the promise follows 0.25 s later */
const card = (cd, u) => { const k1 = spring(u, 'headline'), k2 = spring(u - 0.25, 'panel');
  return '<g opacity="' + f2(Math.min(1, u / 0.1)) + '" transform="translate(0 ' + f2(30 * (1 - k1)) + ')">' + text(cd.name, C.W / 2, C.H * 0.47, { size: 150, weight: 800, fill: '#FFFFFF', anchor: 'middle', ls: -4 }) + '</g>' +
    (u > 0.25 ? '<g opacity="' + f2(Math.min(1, (u - 0.25) / 0.15)) + '" transform="translate(0 ' + f2(20 * (1 - k2)) + ')">' + text(cd.line, C.W / 2, C.H * 0.47 + 110, { size: 56, weight: 600, fill: '#FFFFFF', anchor: 'middle', op: 0.85 }) + '</g>' : ''); };
function frame(t) {
  const sc = C.scenes.find((s) => t >= s.start && t < s.end) || C.scenes.at(-1); bg.style.background = C.colors[sc.bg];
  let svg = sc.card ? card(sc.card, t - sc.start) : '';
  for (const it of sc.items) svg += renderInner(it.id, t, { at: it.at, dur: 1e6, params: it.params }, ctx);
  stage.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + C.W + ' ' + C.H + '" width="' + C.W + '" height="' + C.H + '" style="position:absolute;inset:0">' + svg + '</svg>';
}
/* measure() reads canvas text metrics, so load the weights the kit uses up front and repaint the current frame once they are in (same wrap on every frame) */
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => frame((last = e.detail.time))); frame(last);
Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope'))).then(() => frame(last));
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${C.W}, height: ${C.H}, fps: ${F}, seed: 7 }), { fps: ${F} });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), 'todo:', st.todo.join(' | ') || 'none');
