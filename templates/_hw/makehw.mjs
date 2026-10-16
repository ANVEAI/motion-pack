/* motion-pack/templates/_hw/makehw.mjs (xp-hardware, 2026-10-16): the shared build of the hardware templates (node). A template's make.mjs is two lines:
     import { makeHw } from '../_hw/makehw.mjs'; await makeHw(path.dirname(new URL(import.meta.url).pathname));
   Steps: (1) the plan (cues.mjs: lint.proof + lint.tx are gates, exit 2) -> (2) the three.js PLATE for this aspect (objects/lib/hwplate.js through tools/render.mjs on
   the GPU; skipped when out/plate-<aspect>.mp4 already matches the plate spec's hash; --plates forces it; 1 s GOP re-encode so HyperFrames seeks it cleanly) ->
   (3) the SCORE (music/reveal.py composed to the plan's sections; cached by hash) -> (4) the MIX (_shared/audio.py -> music/mixer.py, -14 LUFS) ->
   (5) stage + write the HyperFrames page (one plate clip per section, transitions, type presets, the hw.* overlays, the honesty label, layers).
   9:16 is its own project folder (tall/), like proof-film: two root compositions in one folder fail hyperframes lint.
   Flags: --set key=value (any CONFIG path; aspect=9:16), --plates (re-render the plate), --no-plate (page only: a placeholder until the plate exists), --allow-lint. */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync, spawnSync } from 'node:child_process';
import { stage, runPlan, head, esc, mix } from '../_shared/compose.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs';
const HW = path.dirname(new URL(import.meta.url).pathname), PACK = path.resolve(HW, '..', '..'), PY = process.env.PYTHON || 'python3';
const sha = (o) => crypto.createHash('sha256').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex').slice(0, 16);
function freeGiB() { try { const l = execFileSync('df', ['-k', PACK]).toString().trim().split('\n').pop().split(/\s+/); return Number(l[3]) / 1048576; } catch { return -1; } }

/* the cues.mjs arguments of this build (the plan's name follows the aspect): a template's make.mjs runs runPlan(DIR, planArgs()) itself, FIRST, so the lint gate is visible in it */
export function planArgs(argv = process.argv.slice(2)) {
  let tall = false; for (let i = 0; i < argv.length; i++) if (argv[i] === '--set' && /^aspect=9:16$/.test(argv[i + 1] || '')) tall = true;
  return [...argv.filter((a) => !['--plates', '--no-plate'].includes(a)), '--name', tall ? 'plan-tall' : 'plan'];
}
export async function makeHw(DIR, { name, planned = false } = {}) {
  const argv = process.argv.slice(2), OUT = path.join(DIR, 'out'), tmpl = name || path.basename(DIR); fs.mkdirSync(OUT, { recursive: true });
  const { CONFIG } = await import(path.join(DIR, 'config.mjs')); const C = structuredClone(CONFIG);
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--set') { const [k, ...r] = argv[++i].split('='), v = r.join('='); let o = C; const ks = k.split('.'); try { for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v === 'null' ? null : v !== '' && !isNaN(+v) ? +v : v; } catch (e) { console.error(`make.mjs: cannot --set ${k}: not a field of CONFIG`); process.exit(2); } }
  const tall = C.aspect === '9:16', tag = tall ? '-tall' : '', planName = 'plan' + tag, PROJ = tall ? path.join(DIR, 'tall') : DIR; fs.mkdirSync(PROJ, { recursive: true });
  /* 1. the plan (the lint gates) */
  if (!planned) runPlan(DIR, planArgs(argv));
  const plan = JSON.parse(fs.readFileSync(path.join(OUT, planName + '.json'), 'utf8')), F = plan.fps, W = plan.W, H = plan.H, T = plan.seconds;
  /* 2. the plate */
  const key = plan.plate.aspect, plateJson = path.join(OUT, `plate-${key}.json`), plateMp4 = path.join(OUT, `plate-${key}.mp4`), plateSig = sha({ p: plan.plate, v: 3 });
  const media = plan.plate.media || {}, served = {};   // your model / photo: hard-linked next to the plate page (tools/render.mjs serves only the page folder)
  for (const k of ['model', 'photo']) { const m = media[k]; if (m && m.src) { const ext = path.extname(m.src); const dst = path.join(OUT, `media-${k}${ext}`); fs.rmSync(dst, { force: true }); try { fs.linkSync(path.resolve(m.src), dst); } catch { fs.copyFileSync(path.resolve(m.src), dst); } served[k] = { ...m, src: `out/media-${k}${ext}` }; if (m.depth) { const de = path.extname(m.depth), dd = path.join(OUT, `media-${k}-depth${de}`); fs.rmSync(dd, { force: true }); fs.copyFileSync(path.resolve(m.depth), dd); served[k].depth = `out/media-${k}-depth${de}`; } } }
  fs.writeFileSync(plateJson, JSON.stringify({ ...plan.plate, media: { ...media, ...served } }));
  const have = fs.existsSync(plateMp4) && fs.existsSync(plateMp4 + '.sig') && fs.readFileSync(plateMp4 + '.sig', 'utf8') === plateSig;
  if (!argv.includes('--no-plate') && (argv.includes('--plates') || !have)) {
    const free = freeGiB(); if (free >= 0 && free < 10) { console.error(`disk: ${free.toFixed(1)} GiB free, under 10 GiB: not rendering the plate (free space, then run make.mjs again)`); process.exit(3); }
    const raw = path.join(OUT, `plate-${key}-raw.mp4`);
    const r = spawnSync('node', [path.join(PACK, 'tools/render.mjs'), path.join(DIR, 'plate.html'), raw, String(T), String(F), '--query', `plan=plate-${key}.json&aspect=${key}`, '--crf', '16', '--min-free-gib', '10'], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('plate render failed (tools/render.mjs exit ' + r.status + ')'); process.exit(r.status || 1); }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-r', String(F), '-g', String(F), '-keyint_min', String(F), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', plateMp4]);
    fs.rmSync(raw, { force: true }); fs.writeFileSync(plateMp4 + '.sig', plateSig);
  }
  /* 3. the score (fitted to the sections) */
  const scoreWav = path.join(OUT, plan.musicFile), scoreSig = sha(plan.score);
  if (!fs.existsSync(scoreWav) || !fs.existsSync(scoreWav + '.sig') || fs.readFileSync(scoreWav + '.sig', 'utf8') !== scoreSig) {
    const secs = path.join(OUT, 'score-sections' + tag + '.json'); fs.writeFileSync(secs, JSON.stringify(plan.score.sections));
    execFileSync(PY, [path.join(PACK, 'music/reveal.py'), '--sections', secs, '--fps', String(F), '--bpm', String(plan.score.bpm), '--seed', String(plan.score.seed), '--tail', String(plan.score.tail), '--out', scoreWav], { stdio: 'inherit' });
    fs.writeFileSync(scoreWav + '.sig', scoreSig);
  }
  /* 4. stage + mix */
  const st = stage(PROJ, { media: fs.existsSync(plateMp4) ? [plateMp4] : [], layers: (plan.layers || []).length > 0 });
  mix(path.join(OUT, planName + '.json'), path.join(PROJ, 'assets', 'media', 'mix.wav'), PY);
  /* 5. the page */
  fs.writeFileSync(path.join(PROJ, 'index.html'), page(plan, st, { plate: fs.existsSync(plateMp4) ? `assets/media/plate-${key}.mp4` : null }));
  console.log(path.join(PROJ, 'index.html'), `${plan.shots.length} shots, ${plan.overlays.length} overlays, ${plan.cues.length} cues, ${T} s, ${plan.claims.length} claims all sourced`, 'todo:', st.todo.join(' | ') || 'none');
  return plan;
}

/* the HyperFrames page: plate clips (one per section, so transitions have two layers), titles (type presets), the hw.* overlay host, cards, honesty label, layers, mix */
export function page(plan, st, { plate }) {
  const F = plan.fps, W = plan.W, H = plan.H, T = plan.seconds, B = plan.brand, s = H > W ? W / 1080 : H / 1080, P = txPlan(plan.shots, F);
  const sp = (sel, start, dur, mediaStart) => { const o = span(P, { sel, start, dur, mediaStart }); return `data-start="${o.start.toFixed(4)}" data-duration="${o.dur.toFixed(4)}"` + (mediaStart != null ? ` data-media-start="${o.mediaStart}"` : ''); };
  let body = '', tl = '';
  for (const sh of plan.shots) {
    if (plate) body += `\n<video id="v-${sh.id}" class="clip fill" src="${plate}" muted playsinline ${sp('#v-' + sh.id, sh.start, sh.dur, sh.mediaStart)} data-track-index="0"></video>`;
    else body += `\n<section id="v-${sh.id}" class="clip ph" ${sp('#v-' + sh.id, sh.start, sh.dur)} data-track-index="0"><div>plate placeholder: run node make.mjs (renders the 3D plate)</div></section>`;
  }
  for (const ti of plan.titles) {
    const anc = ti.anchor || 'start', left = anc === 'middle' ? 0 : anc === 'end' ? 0 : ti.x, style = anc === 'middle' ? `left:0;right:0;text-align:center;` : anc === 'end' ? `right:${(W - ti.x).toFixed(1)}px;text-align:right;` : `left:${left.toFixed(1)}px;`;
    body += `\n<section id="ti-${ti.id}" class="clip ttl" data-start="${ti.at.toFixed(4)}" data-duration="${ti.dur.toFixed(4)}" data-track-index="2"><div class="hl" id="t-${ti.id}" style="${style}top:${(ti.y - ti.size * 0.92).toFixed(1)}px;font-size:${ti.size.toFixed(1)}px;font-weight:${ti.weight || 800};color:${ti.color || B.ink}">${esc(ti.text)}</div></section>`;
    tl += `\n  MP.type(tl, ${JSON.stringify(ti.type)}, '#t-${ti.id}', { at: ${ti.at.toFixed(4)}, dur: ${ti.dur.toFixed(4)}, fps: ${F}, H: ${H}, out: true });`;
  }
  tl += txCalls(P, { W, H });
  const lab = plan.label ? `<div id="hlabel" class="clip" data-start="0" data-duration="${T}" data-track-index="4"><span>${esc(plan.label)}</span></div>` : '';
  const css = `
#root { width: ${W}px; height: ${H}px; background: ${B.paper}; }
#fx { pointer-events: none; } #fx canvas { z-index: 5; } #gfx { z-index: 3; pointer-events: none; }
video.clip { z-index: 0; } .ttl { z-index: 2; } .hl { position: absolute; white-space: nowrap; letter-spacing: -0.02em; line-height: 1.02; }
.ph { z-index: 0; background: #0b0c0f; display: flex; align-items: center; justify-content: center; } .ph div { color: #9aa3b2; font: 600 ${(28 * s).toFixed(1)}px Manrope; border: 2px dashed #3a3f48; padding: ${(18 * s).toFixed(1)}px ${(28 * s).toFixed(1)}px; border-radius: 14px; }
#hlabel { z-index: 4; pointer-events: none; } #hlabel span { position: absolute; ${H > W ? `right:${(120 * s + 6 * s).toFixed(1)}px; top:${(269 * s + 4 * s).toFixed(1)}px;` : `left:${(96 * s).toFixed(1)}px; bottom:${(54 * s + 6 * s).toFixed(1)}px;`} font: 600 ${(28 * s).toFixed(1)}px Manrope, sans-serif; color: ${B.muted || '#9aa3b2'}; letter-spacing: 0.04em; background: rgba(7,8,10,0.55); padding: ${(6 * s).toFixed(1)}px ${(14 * s).toFixed(1)}px; border-radius: ${(8 * s).toFixed(1)}px; }`;
  const layers = JSON.stringify(plan.layers || []), zone = plan.safeZone;
  return `${head({ W, H, title: 'motion-pack ' + plan.template + (H > W ? ' (9:16)' : '') + ': ' + (plan.product?.name || B.name), bg: B.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="gfx" class="clip" data-start="0" data-duration="${T}" data-track-index="3"></div>
${lab}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountGfx } from './assets/mp/type/gfx/index.js';
${(plan.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${layers}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : ''}
const ITEMS = ${JSON.stringify(plan.overlays)};
const G = mountGfx(document.getElementById('gfx'), ITEMS, { W: ${W}, H: ${H}, platform: ${JSON.stringify(zone)} });
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => G.render((last = e.detail.time))); G.render(last);
Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 40px Manrope'))).then(() => G.render(last));   // the parts measure text: repaint once the face is in
const tl = gsap.timeline({ paused: true });${tl}
tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
}
