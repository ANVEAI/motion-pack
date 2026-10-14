/* templates/demo-r45-type/make.mjs: plan -> mix (music mixer) -> HyperFrames index.html. Each scene is one timed clip (hard cuts on the beat grid) holding gfx items
   (mountGfx, SVG from t) and/or Canvas2D layers of layers/canvas2d-r45.js (mountStack + bindHF with t0 = the scene start); both re-render on hf-seek.
     node make.mjs   then   npx -y hyperframes@0.8.142 render . -o out/demo-r45-type.mp4 --crf 23 */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, runPlan, head, write } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG: C } = await import('./config.mjs');
const st = stage(DIR, { layers: true });
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
execFileSync('python3', [path.join(SH, 'audio.py'), path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });
const [W, H] = plan.size, F = plan.fps, T = plan.seconds, f = (x) => (+x).toFixed(4);
const css = `.scene { overflow: hidden; } .part { position: absolute; inset: 0; }`;
let body = '', js = '';
plan.shots.forEach((s) => {
  body += `\n<section class="clip scene" id="s-${s.id}" data-start="${f(s.start)}" data-duration="${f(s.dur)}" data-track-index="1" style="background:${C.bgs[s.bg]}"><div class="part" id="p-${s.id}"></div></section>`;
  if (s.items.length) js += `\nhf(mountGfx(document.getElementById('p-${s.id}'), ${JSON.stringify(s.items.map((it) => ({ id: it.part, at: +(s.start + (it.at || 0)).toFixed(4), dur: it.dur ?? +(s.dur - (it.at || 0)).toFixed(4), params: it.params })))}, { W: ${W}, H: ${H} }));`;
  if (s.layers.length) js += `\nbindHF(mountStack(document.getElementById('p-${s.id}'), ${JSON.stringify(s.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 3 }), { t0: ${f(s.start)}, fps: ${F} });`;
});
const html = `${head({ W, H, title: 'motion-pack demo: round-4/5 type + layers parts', bg: C.bgs.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountGfx } from './assets/mp/type/gfx/index.js';
import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 3 }), { fps: ${F} });
const hf = (stack) => { const r = (t) => stack.render(t); window.addEventListener('hf-seek', (e) => r(e.detail.time)); r(window.__hfThreeTime || 0); };
const tl = gsap.timeline({ paused: true });${js}
tl.set({}, {}, ${f(T)});
window.__timelines['main'] = tl;
/* canvas text measures and draws with the fallback font until a face is in (measure() reads canvas metrics, the embedding chip and the epicycle readout draw text):
   load the faces up front and repaint the current frame once they land, so frame t is the same on every seek order */
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => { last = e.detail.time; });
Promise.all([...['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope')), document.fonts.load('600 24px "IBM Plex Mono"')]).then(() => window.dispatchEvent(new CustomEvent('hf-seek', { detail: { time: last } })));
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${plan.shots.length} scenes, ${T}s at ${plan.bpm} BPM`, 'todo:', st.todo.join(' | ') || 'none');
