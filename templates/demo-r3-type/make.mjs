/* templates/demo-r3-type/make.mjs: plan -> mix (music mixer) -> HyperFrames index.html. Each scene is one timed clip (hard cuts on the beat grid)
   holding one part: type/<name> ids go through the type adapter (MP.type), gfx ids (layout.*, callout.*) mount with type/gfx mountGfx; both re-render on hf-seek.
     node make.mjs   then   npx -y hyperframes@0.8.142 render . -o out/demo-r3-type.mp4 --crf 23 */
import fs from 'node:fs'; import path from 'node:path';
import { stage, runPlan, head, write, mix } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG: C } = await import('./config.mjs');
const st = stage(DIR, { layers: (C.layers || []).length > 0 });
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace
const [W, H] = plan.size, F = plan.fps, T = plan.seconds, f = (x) => (+x).toFixed(4), BG = { paper: C.paper, ink: C.ink, brand: C.brand };
const css = `.scene { overflow: hidden; } .part { position: absolute; inset: 0; }`;
let body = '', js = '';
plan.shots.forEach((s) => {
  body += `\n<section class="clip scene" id="s-${s.id}" data-start="${f(s.start)}" data-duration="${f(s.dur)}" data-track-index="1" style="background:${BG[s.bg]}"><div class="part" id="p-${s.id}"></div></section>`;
  if (s.part.startsWith('type/')) js += `\nMP.type(tl, '${s.part}', '#p-${s.id}', { at: ${f(s.start)}, dur: ${f(s.dur)}, fps: ${F}, W: ${W}, H: ${H}, params: ${JSON.stringify(s.params)} });`;
  else js += `\nhf(mountGfx(document.getElementById('p-${s.id}'), [{ id: '${s.part}', at: ${f(s.start)}, dur: ${f(s.dur)}, params: ${JSON.stringify(s.params)} }], { W: ${W}, H: ${H} }));`;
});
const html = `${head({ W, H, title: 'motion-pack demo: round-3 type + layout parts', bg: C.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountGfx } from './assets/mp/type/gfx/index.js';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 3 }), { fps: ${F} });` : ''}
const hf = (stack) => { const r = (t) => stack.render(t); window.addEventListener('hf-seek', (e) => r(e.detail.time)); r(window.__hfThreeTime || 0); };
const tl = gsap.timeline({ paused: true });${js}
tl.set({}, {}, ${f(T)});
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${plan.shots.length} scenes, ${T}s at ${plan.bpm} BPM`, 'todo:', st.todo.join(' | ') || 'none');
