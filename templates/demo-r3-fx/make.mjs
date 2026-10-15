/* templates/demo-r3-fx/make.mjs: the 15 s demo of the round-3 parts (2026-10-14). Neutral original content; "Orbit" is the pack's fictional
   placeholder mark (the orbit ring + dot), never a real brand.
     node make.mjs            plates (only when missing), screen quad, plan + mix, staged assets, index.html
     node make.mjs --plates   force both 3D plates (logo clip + environment still) and the quad again
   then:  npx -y hyperframes@0.8.142 render . -o out/demo-r3-fx.mp4 --crf 23
          python3 ../_shared/sheet.py out/demo-r3-fx.mp4 out/sheet.jpg 0.2,1.2,2.2,2.9,3.4,4.6,6.0,6.7,7.2,7.7,8.9,9.8,10.7,11.4,12.2,14.5
   Shots (one continuous film; no hard cut until the pull-back):
     s1 0-3.0     mesh-gradient field; 300 loose dots condense into the words "one idea"; the 2D mascot hops in and points   background.meshGradient, layers.dotCondense, objects/mascot2d
     t  3.0-3.8   magic move: the pill becomes the card title, the mascot flies to its new spot                            transitions/sharedElement
     s2 3.8-6.4   the idea becomes a short plan on a card; the mascot reads                                              background.meshGradient (lilac)
     t  6.4-8.0   the next shot draws on as line art over paper, takes a clay tone, then colour                           transitions/sketchToRender
     s3 8.0-10.4  the 3D mark (iridescent extrude, one sliced beat); the mascot projects a hologram window                objects/logo-extrude, overlay.hologramBeam
     s4 10.4-15   the whole film pulls back onto a laptop screen in a room that grades in from a gradient map         cam2d.pullbackToScreen (+ layout.cornerPin), look.gradeIn
   Rule kept for the magic move: the DOM clones are snapshots taken when the window is entered, so each shared element is held still inside the
   window (the mascots draw at min(t, 3.0) and max(t, 3.8)) and any seek order gives the same frame. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, head, write, mix, lintPlan, lintStop } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..'), OUT = path.join(DIR, 'out');
const W = 1920, H = 1080, F = 30, T = 15, FORCE = process.argv.includes('--plates'); fs.mkdirSync(OUT, { recursive: true });
const R = path.join(PACK, 'tools/render.mjs');

/* 1. plates: the logo clip (8.7 s, shot 3 + the screen in shot 4) and the environment still; then the laptop screen quad */
const logo = path.join(OUT, 'plate-logo.mp4'), envDir = path.join(OUT, 'env'), envPng = path.join(envDir, 'f0000.png'), env = path.join(OUT, 'plate-env.jpg'), quadF = path.join(OUT, 'screen-quad.json');
if (FORCE || !fs.existsSync(logo)) { const raw = path.join(OUT, 'plate-logo-raw.mp4'); execFileSync('node', [R, path.join(DIR, 'plate-logo.html'), raw, '8.7', String(F), '--crf', '17', '--min-free-gib', '10'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'libx264', '-crf', '17', '-r', String(F), '-g', String(F), '-keyint_min', String(F), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', logo]); fs.rmSync(raw); }   // 1 s GOP: HyperFrames seeks a plate with sparse keyframes badly
if (FORCE || !fs.existsSync(env)) { execFileSync('node', [R, path.join(DIR, 'plate-env.html'), path.join(envDir, 'x.mp4'), '0', '0', '--stills-only', '--stills', '0', '--stills-dir', envDir, '--min-free-gib', '10'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', envPng, '-q:v', '2', env]); }
if (FORCE || !fs.existsSync(quadF)) { const { open } = await import(path.join(PACK, 'layers/tests/harness.mjs')); const h = await open('/templates/demo-r3-fx/plate-env.html', 't=0&norun=1');
  const q = await h.page.evaluate(() => window.__screenQuad(0)); await h.close(); fs.writeFileSync(quadF, JSON.stringify(q)); console.log('screen quad', JSON.stringify(q)); }
const quadPx = JSON.parse(fs.readFileSync(quadF, 'utf8')), inset = 0.012, cx = quadPx.reduce((a, p) => a + p[0], 0) / 4, cy = quadPx.reduce((a, p) => a + p[1], 0) / 4;
const QUAD = quadPx.map(([x, y]) => [(x + (cx - x) * inset) / W, (y + (cy - y) * inset) / H].map((v) => +v.toFixed(5)));   // a hair inside the bezel

/* 2. plan: the shots + the sound cue sheet (anchor on frame + 1; audio.py hands it to music/mixer.py, which solves the levels over the bed) */
const shots = [{ id: 's1', start: 0, dur: 3.0, tx: 'transitions/sharedElement', txReason: 'LINK: the idea becomes the plan; nothing cuts away' },
  { id: 's2', start: 3.0, dur: 3.4, tx: 'transitions/sketchToRender', txReason: 'REVEAL: the plan turns into the made thing, sketch first' },
  { id: 's3', start: 6.4, dur: 4.0, tx: 'transitions/cut', txReason: 'the pull-back is a camera move, not a transition' },
  { id: 's4', start: 10.4, dur: 4.6, hold: true }];
const cues = [
  { id: 'sfx/ui/pop', t: 0, why: 'frame 0: the mascot pops in' }, { id: 'sfx/voice/chirp', t: 0.4, why: 'the hop' },
  { id: 'sfx/sparkle/letter_assemble', t: 0.9, why: 'dots start to condense' }, { id: 'sfx/ui/blip', t: 2.05, why: 'the words land' }, { id: 'sfx/ui/pop', t: 2.4, why: 'the pill forms' },
  { id: 'sfx/ui/slide', t: 3.0, why: 'magic move starts (registry pairing)' }, { id: 'sfx/tx/match_link', t: 3.8, why: 'elements land (registry pairing)' },
  { id: 'sfx/paper/flip', t: 4.0, why: 'the book opens' }, { id: 'sfx/ui/tick', t: 4.3, why: 'row 1' }, { id: 'sfx/ui/tick', t: 4.65, why: 'row 2' }, { id: 'sfx/ui/success', t: 5.0, why: 'row 3' },
  { id: 'sfx/paper/rustle', t: +(6.4 + 2 / 30).toFixed(4), why: 'line art starts (registry pairing)' }, { id: 'sfx/tx/mask_reveal', t: 6.88, why: 'sketch peak (registry pairing)' },
  { id: 'sfx/ui/pop', t: 8.3, why: 'mascot pops in' }, { id: 'sfx/voice/chirp', t: 8.45, why: 'mascot hops' }, { id: 'sfx/ui/scan_sweep', t: 8.7, why: 'hologram beam powers on' },
  { id: 'sfx/whoosh/reverse', t: 10.4, why: 'pull back to the screen' }, { id: 'sfx/logo/ascend_land', t: 12.4, why: 'end line lands' },
  { id: 'sfx/ui/pop', t: 12.9, why: 'mascot peeks in' }, { id: 'sfx/voice/chirp', t: 13.05, why: 'mascot waves' },
];
const plan = { template: 'demo-r3-fx', fps: F, seconds: T, size: [W, H], music: 'music/bed_playful_bounce_loop8', musicGainDb: -3, ceilingDb: -2.2, fadeInMs: 40, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [],
  parts: ['background.meshGradient', 'layers.dotCondense', 'objects/mascot2d', 'transitions/sharedElement', 'transitions/sketchToRender', 'objects/logo-extrude', 'overlay.hologramBeam', 'cam2d.pullbackToScreen', 'layout.cornerPin', 'look.gradeIn'],
  screenQuad: QUAD };
const fails = lintPlan(plan);   // lint.proof + lint.tx: the gate cues.mjs runs for the genre templates (compose.mjs)
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 1));
lintStop(fails, 'demo-r3-fx');

/* 3. stage (fonts, layers, type + gfx, transitions lib, plates) + the camera and mascot modules the comp imports, then the mix */
const st = stage(DIR, { media: [logo, env], layers: true });
const lnk = (src, dst) => { const d = path.join(DIR, 'assets', 'mp', dst); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); fs.linkSync(path.join(PACK, src), d); };
lnk('camera/cam2d.js', 'camera/cam2d.js'); lnk('camera/ease.js', 'camera/ease.js'); lnk('objects/characters/mascot2d.js', 'objects/mascot2d.js');
mix(path.join(OUT, 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace

/* 4. the composition: one director draw(t) on every hf-seek (scenes are untimed wrappers inside one clip; the logo clip is framework-owned media) */
const css = `
.sc { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
.cv { position: absolute; inset: 0; }
.box { position: absolute; }
#pill { position: absolute; left: ${W / 2 - 330}px; top: ${H * 0.47 - 78}px; width: 660px; height: 156px; border-radius: 78px; background: #FFFFFF; color: #4A18ED; font-weight: 800; font-size: 104px; letter-spacing: -0.035em; display: flex; align-items: center; justify-content: center; box-shadow: 0 18px 50px rgba(74,24,237,0.16); }
#card { position: absolute; left: 330px; top: 230px; width: 820px; height: 580px; border-radius: 40px; background: #FFFFFF; box-shadow: 0 30px 80px rgba(40,20,90,0.16); }
#cardTitle { position: absolute; left: 56px; top: 48px; height: 96px; padding: 0 34px; border-radius: 48px; background: #4A18ED; color: #FFFFFF; font-weight: 800; font-size: 60px; letter-spacing: -0.03em; display: flex; align-items: center; }
.row { position: absolute; left: 56px; width: 708px; height: 92px; border-top: 2px solid #EFEAF7; display: flex; align-items: center; gap: 26px; font-weight: 700; font-size: 46px; color: #1E1B26; }
.row i { width: 46px; height: 46px; border-radius: 50%; border: 5px solid #CFC6EA; box-sizing: border-box; display: block; position: relative; }
.row i b { position: absolute; inset: -5px; border-radius: 50%; background: #2FA866; transform: scale(0); }
#holo { position: absolute; left: ${0.56 * W}px; top: ${0.2 * H}px; width: ${0.36 * W}px; height: ${0.34 * H}px; display: flex; flex-direction: column; justify-content: center; padding: 0 56px; box-sizing: border-box; color: #CFF8FF; font-weight: 700; font-size: 58px; line-height: 1.12; letter-spacing: -0.02em; text-shadow: 0 0 18px rgba(127,231,255,0.6); }
#holo small { font: 600 26px "IBM Plex Mono", monospace; letter-spacing: 0.04em; color: #7FE7FF; margin-bottom: 18px; }
#endline { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font-weight: 800; font-size: 92px; letter-spacing: -0.035em; color: #1E1B26; }
#endsub { position: absolute; left: 0; right: 0; top: 182px; text-align: center; font-weight: 600; font-size: 34px; color: #5D5470; }
#world { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
#world img { position: absolute; inset: 0; width: 100%; height: 100%; }
#s3 { transform-origin: 0 0; }
`;
const rows = ['Sketch it', 'Shape it', 'Ship it'].map((r, i) => `<div class="row" id="r${i}" style="top:${190 + i * 112}px"><i><b></b></i>${r}</div>`).join('');
const html = `${head({ W, H, title: 'motion-pack demo: round-3 parts', bg: '#efe8dc', css })}
<body>
<div id="root" style="width:${W}px;height:${H}px" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="0">
  <div class="sc" id="s4"><div id="world"><div id="envlook" class="cv"><img src="assets/media/plate-env.jpg" alt=""></div></div><div id="endline">Made of parts.</div><div id="endsub">Every frame, a function of time.</div><div class="box" id="m4" style="left:1500px;top:520px;width:340px;height:400px"></div></div>
  <div class="sc" id="s1"><div class="cv" id="bg1"></div><div id="pill" data-share="title">one idea</div><div class="box" id="m1" data-share="mascot" style="left:150px;top:600px;width:360px;height:400px"></div></div>
  <div class="sc" id="s2"><div class="cv" id="bg2"></div><div id="card"><div id="cardTitle" data-share="title">one idea</div>${rows}</div><div class="box" id="m2" data-share="mascot" style="left:1260px;top:420px;width:300px;height:333px"></div></div>
  <div class="sc" id="s3"><video class="clip fill" id="logo" src="assets/media/plate-logo.mp4" muted playsinline data-start="6.4" data-duration="8.6" data-media-start="0" data-track-index="1"></video><div class="cv" id="fx3"></div>
    <div id="holo"><small>HOLOGRAM WINDOW</small>Every frame,<br>a function of time.</div><div class="box" id="m3" style="left:150px;top:610px;width:300px;height:340px"></div></div>
</div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { mountStack } from './assets/mp/layers/overlay.js';
import { mountGradeIn } from './assets/mp/layers/stylize.js';
import { hologramState } from './assets/mp/layers/canvas2d-r3.js';
import { applyDom } from './assets/mp/transitions/lib/tx-dom.js';
import { pullbackToScreen, toCSS, ID2 } from './assets/mp/camera/cam2d.js';
import { matrix3d } from './assets/mp/type/gfx/cornerpin.js';
import { mascotSVG } from './assets/mp/objects/mascot2d.js';
const W = ${W}, H = ${H}, $ = (id) => document.getElementById(id), sc = [$('s1'), $('s2'), $('s3'), $('s4')], root = $('stage');
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const st1 = mountStack($('bg1'), [{ kind: 'meshGradient', params: { palette: 'peach', speed: 0.06, seed: 7 } },
  { kind: 'dotCondense', params: { to: 'word', text: 'one idea', n: 300, size: 0.2, weight: 800, center: [0.5, 0.47], at: 0.85, dur: 1.15, stagger: 0.35, radius: 3.6, color: '#3A2F55', toColor: '#4A18ED', field: [0.06, 0.08, 0.88, 0.84], drift: 14, seed: 11 } }], { width: W, height: H, fps: 30, seed: 4 });
const st2 = mountStack($('bg2'), [{ kind: 'meshGradient', params: { palette: 'lilac', speed: 0.06, seed: 5 } }], { width: W, height: H, fps: 30, seed: 5 });
const HOLO = { from: [0.221, 0.69], rect: [0.56, 0.2, 0.36, 0.34], at: 8.7, on: 0.6, color: '#7FE7FF', intensity: 0.9 };
const st3 = mountStack($('fx3'), [{ kind: 'hologramBeam', params: HOLO }, { kind: 'vignette', params: { amount: 0.12 } }], { width: W, height: H, fps: 30, seed: 6 });
const grade = mountGradeIn($('envlook'), { stops: ['#2A1E5C', '#E0457B', '#FFE2C2'], at: 10.7, dur: 1.5, ease: 'soft' });
const CAM = pullbackToScreen(ID2, { at: 10.4, dur: 2.2, quad: ${JSON.stringify(QUAD)}, lock: 0.3, ease: 'cam' });
/* mascots: each box draws the rig in its own 1080-unit space (k = box height / 1080); the shared ones hold still inside the magic-move window */
const M = (id, w, h, size, spec) => ({ el: $(id), w, h, spec: { size, path: [[0, [w / 2 * 1080 / h, (h - 12) * 1080 / h]]], ...spec } });
const m1 = M('m1', 360, 400, 3.9, { keys: [[0, 'idle'], [0.2, 'cheer'], [1.1, 'point'], [2.55, 'dive']], scale: [[0, 0.2], [0.02, 1]], hops: [0.35], blinks: [0.95, 2.1], aim: [2100, -260] });
const m2 = M('m2', 300, 333, 3.9, { keys: [[0, 'read']], blinks: [4.9, 5.9], talk: [] });
const m3 = M('m3', 300, 340, 3.9, { keys: [[0, 'idle'], [8.3, 'cheer'], [8.62, 'wave']], scale: [[0, 0.001], [8.28, 0.001], [8.3, 1]], hops: [8.42], blinks: [9.6] });
const m4 = M('m4', 340, 400, 3.9, { keys: [[0, 'idle'], [12.9, 'cheer'], [13.15, 'wave']], scale: [[0, 0.001], [12.88, 0.001], [12.9, 1]], hops: [13.0], blinks: [14.2], talk: [[13.3, 13.9]] });
const drawM = (m, t) => { m.el.innerHTML = mascotSVG(t, m.spec, { W: m.w, H: m.h }); };
const WINS = [{ key: 'sharedElement', a: 0, b: 1, t0: 3.0, t1: 3.8, params: { bounce: 0.35, stagger: 0.12, shadow: 0.4 } }, { key: 'sketchToRender', a: 1, b: 2, t0: 6.4, t1: 8.0, params: { paper: '#F4F1EA', ink: '#241E33', threshold: 0.11, line: 1.6 } }];
function draw(t) {
  /* scene content (always drawn; cheap) */
  st1.render(t, { frame: Math.round(t * 30) }); st1.layers[1].canvas.style.opacity = (1 - sm(2.3, 2.6, t)).toFixed(4);
  $('pill').style.opacity = sm(2.3, 2.6, t).toFixed(4); $('pill').style.transform = 'scale(' + (0.9 + 0.1 * sm(2.3, 2.7, t)).toFixed(4) + ')';
  st2.render(t, { frame: Math.round(t * 30) }); st3.render(t, { frame: Math.round(t * 30) });
  [4.3, 4.65, 5.0].forEach((a, i) => { const k = sm(a, a + 0.18, t); $('r' + i).querySelector('b').style.transform = 'scale(' + k.toFixed(4) + ')'; });
  drawM(m1, Math.min(t, 3.0)); drawM(m2, Math.max(t, 3.8)); drawM(m3, t); drawM(m4, t);
  const hs = hologramState(t, HOLO); $('holo').style.opacity = (t >= HOLO.at ? hs.win * hs.flick : 0).toFixed(4); $('holo').style.transform = 'scaleY(' + Math.max(0.02, hs.win).toFixed(4) + ')';
  /* edit: transition windows, else one scene (s3 stays on top of s4 from 10.4 and rides the camera onto the screen) */
  const w = WINS.find((x) => t >= x.t0 && t < x.t1);
  for (const x of WINS) applyDom(x.key, 1, { a: sc[x.a], b: sc[x.b], root });   // reset every window's styles first (endpoint = shot B, no overlay)
  sc.forEach((s) => { s.style.opacity = '0'; s.style.transform = ''; s.style.zIndex = ''; });
  if (w) { applyDom(w.key, (t - w.t0) / (w.t1 - w.t0), { a: sc[w.a], b: sc[w.b], root, params: w.params }); }
  else { const cur = t < 3.0 ? 0 : t < 6.4 ? 1 : 2; sc[cur].style.opacity = '1'; sc[cur].style.zIndex = '2'; }
  if (t >= 10.4) { const s = CAM(t), c = toCSS(s, { W, H }); sc[3].style.opacity = '1'; sc[3].style.zIndex = '1'; $('world').style.transform = c.transform; $('world').style.transformOrigin = c.transformOrigin;
    sc[2].style.opacity = '1'; sc[2].style.zIndex = '2'; sc[2].style.transform = matrix3d(W, H, s.pin.corners.map(([x, y]) => [x * W, y * H])); }
  grade.render(t);
  const e = sm(12.4, 12.95, t); $('endline').style.opacity = e.toFixed(4); $('endline').style.transform = 'translateY(' + ((1 - e) * 28).toFixed(2) + 'px)';
  const e2 = sm(12.6, 13.15, t); $('endsub').style.opacity = e2.toFixed(4); $('endsub').style.transform = 'translateY(' + ((1 - e2) * 20).toFixed(2) + 'px)';
}
window.addEventListener('hf-seek', (e) => draw(e.detail.time)); draw(window.__hfThreeTime || 0);
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T}); window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl; window.__ready = true;   // __ready: dev previews through layers/tests/harness.mjs
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${cues.length} cues, quad ${JSON.stringify(QUAD)}`, 'todo:', st.todo.join(' | ') || 'none');
