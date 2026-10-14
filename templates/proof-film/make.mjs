/* templates/proof-film/make.mjs: CONFIG -> honesty gate -> plan -> (optional VO) -> mix -> one continuous-camera HyperFrames page.
     node make.mjs [--set format=tall] [--set builder.kind=table] [--set vo.words=/abs/words.json ...]
   then   npx -y hyperframes@0.8.142 render . -o out/proof-film.mp4 --crf 23                                  (16:9: index.html)
          (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/proof-film-tall.mp4 --crf 23)             (9:16: node make.mjs --set format=tall first; its own project folder tall/, so `hyperframes lint` sees one root composition per folder)
          python3 ../_shared/sheet.py out/proof-film.mp4 out/sheet.jpg 0.5,1.5,3,5,7,9,12,14,17,20,24,27,31,34,38,41
          python3 ../../ears/listen.py out/proof-film.mp4 --plan out/plan.json
   Steps: the HONESTY GATE (honesty.mjs: every number needs a source and a method, no number sits in prose or in the voice, or this exits 2 naming the field) -> plan (config.mjs, via _shared/cues.mjs: lint.proof) -> the voice track
   when `vo` is set (vo.py) -> the mix (_shared/audio.py -> music/mixer.py: bed, a planned quiet open and quiet hold, -14 LUFS) -> the page. The page is ONE director draw(t) on every hf-seek:
   two nested wrappers carry the cam2d camera (#cam scales about the frame centre, #world pans), the cells inside the world are drawn by panels.mjs; nothing in it reads a clock. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, runPlan, head, write, mix } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..'), OUT = path.join(DIR, 'out'), PY = process.env.PYTHON || 'python3';
const { CONFIG, gateProblems } = await import('./config.mjs'); const C = structuredClone(CONFIG);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--set') { const arg = process.argv[++i], [k, ...rest] = arg.split('='), v = rest.join('='); let o = C; const ks = k.split('.');
  try { for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; } catch (e) { console.error(`make.mjs: cannot --set ${arg}: ${k} is not a field of CONFIG (${e.message})`); process.exit(2); } }

/* 0. the honesty gate: nothing is staged, mixed or written until every number has its source and its method */
const bad = gateProblems(C);
if (bad.length) { console.error(`\nproof-film honesty gate: ${bad.length} problem${bad.length === 1 ? '' : 's'}, nothing built\n  - ${bad.join('\n  - ')}\n\nEvery number field needs a source AND a method that say something; a number in prose or in the voice has no source line. Fix the CONFIG block in config.mjs (or the words.json).\n`); process.exit(2); }

/* 1. plan */
const tall = C.format === 'tall', tag = tall ? '-tall' : '', planName = 'plan' + tag, PROJ = tall ? path.join(DIR, 'tall') : DIR;   // 9:16 is its own HyperFrames project (tall/): two root compositions in one folder fail hyperframes lint
runPlan(DIR, [...process.argv.slice(2), '--name', planName]);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(OUT, planName + '.json'), 'utf8')), F = plan.fps, W = plan.W, H = plan.H, T = plan.seconds, B = plan.brand;
if (plan.lint === undefined || plan.lint.claimsWithoutSource.length) { console.error('lint.proof failed'); process.exit(2); }
for (const w of plan.warnings) console.log('warning:', w);

/* 2. stage: fonts, layers, type + gfx, the camera and this template's panels (mirrored under assets/mp so the same relative imports work in the page and in node) */
const st = stage(PROJ, { layers: (C.layers || []).length > 0 }); fs.mkdirSync(path.join(PROJ, 'assets', 'media'), { recursive: true });
const lnk = (src, dst) => { const d = path.join(PROJ, 'assets', 'mp', dst); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); fs.linkSync(path.join(PACK, src), d); };
lnk('camera/cam2d.js', 'camera/cam2d.js'); lnk('camera/ease.js', 'camera/ease.js'); lnk('templates/proof-film/panels.mjs', 'templates/proof-film/panels.mjs');

/* 3. the voice (optional): your recording placed at 0, or a labelled guide signal for a dry run; then the mix */
if (plan.voice) {
  fs.writeFileSync(path.join(OUT, 'transcript.json'), JSON.stringify({ source: 'vo.words of CONFIG (the words.json you gave)', words: plan.voice.words }));
  execFileSync(PY, [path.join(DIR, 'vo.py'), path.join(OUT, planName + '.json'), path.join(OUT, 'vo.wav'), ...(plan.voice.audio ? ['--audio', path.resolve(DIR, plan.voice.audio)] : [])], { stdio: 'inherit' });
}
const mixName = 'mix.wav';
mix(path.join(OUT, planName + '.json'), path.join(PROJ, 'assets', 'media', mixName), PY);   // audio.py: a failure ends the build with its own message, no stack trace

/* 4. the page */
const [px, py] = plan.camera.pitch, N = plan.stages.length, padX = W, padY = H, worldW = (px ? N * px : W) + 2 * padX, worldH = (py ? N * py : H) + 2 * padY;
const css = `
#root { width: ${W}px; height: ${H}px; }
#stage { z-index: 0; overflow: hidden; } #fx { pointer-events: none; } #fx canvas { z-index: 5; }   /* z on the canvases, NOT on #fx (a stacking context on #fx would isolate mix-blend-mode) */
#cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
#world { position: absolute; left: ${-padX}px; top: ${-padY}px; width: ${worldW}px; height: ${worldH}px; background-color: ${B.paper}; background-image: radial-gradient(circle, rgba(22,21,27,0.12) 1.7px, transparent 2.3px); background-size: 58px 58px; }
.cell { position: absolute; width: ${W}px; height: ${H}px; }`;
const cells = plan.stages.map((s, i) => `<div class="cell" id="c${i}" style="left:${padX + i * px}px;top:${padY + i * py}px"></div>`).join('\n');
const html = `${head({ W, H, title: 'motion-pack proof film' + (tall ? ' (9:16)' : '') + ': ' + B.name, bg: B.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="0"><div id="cam"><div id="world">
${cells}
</div></div></div>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/${mixName}" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { cameraFor, cellSVG, cellVisible, layout } from './assets/mp/templates/proof-film/panels.mjs';
import { toCSS } from './assets/mp/camera/cam2d.js';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : ''}
const PLAN = ${JSON.stringify(plan)}, L = layout(PLAN), CAM = cameraFor(PLAN), cam = document.getElementById('cam'), world = document.getElementById('world');
const cells = PLAN.stages.map((s, i) => document.getElementById('c' + i)), shown = [];
/* one director: the camera, then the cells that are on screen (a cell off screen is emptied once; nothing depends on the order frames are asked for) */
function draw(t) {
  const z = toCSS(CAM.zoom(t), { W: ${W}, H: ${H} }), p = toCSS(CAM.pan(t), { W: ${W}, H: ${H} });
  cam.style.transform = z.transform; cam.style.transformOrigin = z.transformOrigin; world.style.transform = p.transform; world.style.transformOrigin = '0 0';
  PLAN.stages.forEach((s, i) => { if (cellVisible(PLAN, s, t)) { cells[i].innerHTML = cellSVG(PLAN, s, t, L); shown[i] = true; } else if (shown[i] !== false) { cells[i].innerHTML = ''; shown[i] = false; } });
}
/* measure() reads canvas text metrics: load every face the panels use up front, then repaint the current frame (the same wrap on every frame) */
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => draw((last = e.detail.time))); draw(last); window.__seek = (t) => draw((last = t));
Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope')).concat([document.fonts.load('600 20px "IBM Plex Mono"')])).then(() => { draw(last); window.__ready = true; });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
const file = path.join(PROJ, 'index.html'); fs.writeFileSync(file, html);
console.log(file, `${plan.stages.length} stages, ${plan.cues.length} cues, ${T} s, ${plan.honesty.numbers.length} numbers all with source + method${plan.illustrative ? ' (ILLUSTRATIVE: placeholder data)' : ''}`, 'todo:', st.todo.join(' | ') || 'none');
