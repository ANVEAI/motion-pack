/* templates/_shared/saas/make.mjs: the build every SaaS template's make.mjs runs (2026-10-16, lane xp-saas).
     makeSaas(DIR): --set key=value ... (aspect=9:16 builds its own project in DIR/tall/, so `hyperframes lint` sees one root composition per folder)
       1. plan + lint gates (_shared/cues.mjs: lint.proof, lint.tx; exit 2 stops everything)   2. stage fonts + the type, transitions, layers modules + this kit + CONFIG.media
       3. the mix (_shared/audio.py -> music/mixer.py, -14 LUFS)   4. index.html: ONE director draw(t) on every hf-seek: each scene is its own full-frame layer (an <svg> redrawn
          from the scene data), the transition windows from _shared/txplan.mjs run the transitions module's DOM back-end (applyDom, styles from p alone), nothing reads a clock. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, runPlan, head, mix, aspectFlag } from '../compose.mjs';
import { txPlan } from '../txplan.mjs';
import { SCREEN_CSS } from './screens.mjs';
aspectFlag();   // --aspect A (tools/mp) -> --set aspect=A, so this builder's own --set parse sees the aspect being built
const SH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), PACK = path.resolve(SH, '..', '..');

export function parseSets(argv, C) {
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--set') { const arg = argv[++i], [k, ...rest] = arg.split('='), v = rest.join('='); let o = C; const ks = k.split('.');
    try { for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v === 'null' ? null : v !== '' && !isNaN(+v) ? +v : v; } catch (e) { console.error(`make.mjs: cannot --set ${arg}: ${k} is not a field of CONFIG (${e.message})`); process.exit(2); } }
  return C;
}
export async function makeSaas(DIR, { title = 'SaaS film' } = {}) {
  const argv = process.argv.slice(2).filter((a) => a !== '--no-mix'), allArgs = process.argv.slice(2), { CONFIG } = await import(path.join(DIR, 'config.mjs')), C = parseSets(argv, structuredClone(CONFIG));
  const tall = C.aspect === '9:16', planName = tall ? 'plan-tall' : 'plan', PROJ = tall ? path.join(DIR, 'tall') : DIR, OUT = path.join(DIR, 'out');
  runPlan(DIR, [...argv, '--name', planName]);
  const plan = JSON.parse(fs.readFileSync(path.join(OUT, planName + '.json'), 'utf8')), F = plan.fps, W = plan.W, H = plan.H, T = plan.seconds, B = plan.brand;
  /* media: every CONFIG.media src and the brand logo, linked into assets/media (HyperFrames serves the project folder only) */
  const media = Object.values(C.media || {}).filter((m) => m && m.src).map((m) => path.resolve(m.src)); if (B.logo) media.push(path.resolve(B.logo));
  for (const m of media) if (!fs.existsSync(m)) { console.error(`make.mjs: media file not found: ${m}`); process.exit(2); }
  const st = stage(PROJ, { media, layers: (plan.layers || []).length > 0 });
  const lnk = (src, dst) => { const d = path.join(PROJ, 'assets', 'mp', dst); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); try { fs.linkSync(src, d); } catch { fs.copyFileSync(src, d); } };
  for (const f of ['kit.mjs', 'screens.mjs']) lnk(path.join(SH, 'saas', f), path.join('saas', f));
  const brand = { ...B, logo: B.logo ? 'assets/media/' + path.basename(B.logo) : null };
  if (plan.voice && !allArgs.includes('--no-mix')) {   /* the optional VO: your recording placed at 0, or a labelled guide signal (proof-film/vo.py, reused); audio.py hands it to the mixer as plan.vo */
    fs.writeFileSync(path.join(OUT, 'transcript.json'), JSON.stringify({ source: 'voice.words of CONFIG', words: plan.voice.words }));
    execFileSync(process.env.PYTHON || 'python3', [path.join(SH, '..', 'proof-film', 'vo.py'), path.join(OUT, planName + '.json'), path.join(OUT, 'vo.wav'), ...(plan.voice.audio ? ['--audio', path.resolve(plan.voice.audio)] : [])], { stdio: 'inherit' }); }
  const wav = path.join(PROJ, 'assets', 'media', 'mix.wav'); if (allArgs.includes('--no-mix')) console.log(fs.existsSync(wav) ? 'mix: kept ' + wav + ' (--no-mix: picture-only rebuild)' : 'mix: PENDING (--no-mix and no mix.wav yet: run node make.mjs without --no-mix before rendering)'); else mix(path.join(OUT, planName + '.json'), wav);
  /* transition windows: plan shots -> txPlan (kind dom: the module's DOM back-end; cut / smash: none) */
  const P = txPlan(plan.shots, F), wins = P.wins.map((w) => ({ i: w.i, key: w.key, id: w.id, params: w.params, startF: w.startF, endF: w.endF, cutF: w.cutF, start: w.start, end: w.end, cut: w.cut }));
  if (P.todo.length) console.log('transitions todo:', P.todo.join(' | '));
  fs.writeFileSync(path.join(OUT, (tall ? 'tx-tall' : 'tx') + '.json'), JSON.stringify(wins, null, 1));
  /* the page */
  const layers = plan.scenes.map((s, i) => { const vids = plan.videos.filter((v) => v.scene === s.id).map((v, j) => `<div class="vw" id="vw${i}_${j}"><div class="vi" id="vi${i}_${j}"><video class="clip" src="${v.src}" muted playsinline data-start="${Math.max(0, v.at).toFixed(4)}" data-duration="${(Math.min(T, v.at + v.dur) - Math.max(0, v.at)).toFixed(4)}" data-media-start="${v.start}" data-track-index="${2 + j}"></video></div></div>`).join('');
    return `<div class="scene" id="S${i}"><div class="host" id="h${i}"></div>${vids}</div>`; }).join('\n');
  const css = `#root { width: ${W}px; height: ${H}px; } #stage { z-index: 0; overflow: hidden; } .scene { position: absolute; inset: 0; visibility: hidden; overflow: hidden; } .host { position: absolute; inset: 0; } .host svg { position: absolute; inset: 0; }
.vw { position: absolute; overflow: hidden; display: none; } .vi { position: absolute; left: 0; top: 0; transform-origin: 0 0; } .vi video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
#fx { pointer-events: none; } #fx canvas { z-index: 5; }
${SCREEN_CSS(brand)}`;
  const html = `${head({ W, H, title: `motion-pack ${plan.template} (${plan.aspect}): ${B.name}`, bg: B.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="0">
${layers}
</div>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { renderInner, appWindowGeo, deviceScreenGeo } from './assets/mp/type/gfx/index.js';
import { ctxFor, measure } from './assets/mp/type/gfx/core.js';
import { applyDom } from './assets/mp/transitions/lib/tx-dom.js';
import { sceneSVG } from './assets/mp/saas/kit.mjs';
import { screenHTML, stateAt } from './assets/mp/saas/screens.mjs';
${(plan.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(plan.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : ''}
const PLAN = ${JSON.stringify({ scenes: plan.scenes, videos: plan.videos, fps: F, W, H })}, WINS = ${JSON.stringify(wins)}, B = ${JSON.stringify(brand)};
const root = document.getElementById('root'), S = PLAN.scenes.map((_, i) => document.getElementById('S' + i)), HOST = PLAN.scenes.map((_, i) => document.getElementById('h' + i));
const env = { W: ${W}, H: ${H}, B, renderInner, ctx: ctxFor(${W}, ${H}, ${JSON.stringify(plan.zone || null)}, 1), screenHTML, stateAt, measure };
const PROPS = ['transform', 'transformOrigin', 'filter', 'opacity', 'clipPath', 'webkitMaskImage', 'maskImage', 'borderRadius', 'boxShadow', 'zIndex', 'webkitMaskSize', 'maskSize', 'webkitMaskPosition', 'maskPosition', 'webkitMaskRepeat', 'maskRepeat', 'backfaceVisibility', 'mixBlendMode'];
const reset = (el) => { for (const k of PROPS) el.style[k] = ''; };
const clearOv = () => { const ov = root.querySelector(':scope > .mptx-ov'); if (!ov) return; const f = ov.querySelector('.mptx-fill'); if (f) { f.style.opacity = '0'; f.style.background = ''; f.style.mixBlendMode = ''; f.style.clipPath = ''; } const b = ov.querySelector('.mptx-bars'); if (b) b.innerHTML = '';
  const sh = ov.querySelector(':scope > .mptx-share'); if (sh) sh.style.display = 'none'; for (const el of root.querySelectorAll('[data-mptx-hide]')) { el.style.visibility = el.dataset.mptxHide === '-' ? '' : el.dataset.mptxHide; el.removeAttribute('data-mptx-hide'); } };
const sceneAt = (t) => { let k = 0; PLAN.scenes.forEach((s, i) => { if (t >= s.start - 1e-6) k = i; }); return k; };
/* a screen recording sits in its window's content rect (or a device's screen), scaled and zoomed with the same pure maths as the SVG frame */
function placeVideos(i, t) { PLAN.videos.filter((v) => v.scene === PLAN.scenes[i].id).forEach((v, j) => { const wrap = document.getElementById('vw' + i + '_' + j), inner = document.getElementById('vi' + i + '_' + j);
  const it = [...PLAN.scenes[i].under, ...PLAN.scenes[i].items].find((x) => (x.key || x.id) === v.item); if (!it || t < it.at || t > it.at + it.dur + 0.4) { wrap.style.display = 'none'; return; }
  const G = appWindowGeo(it.params, env.ctx, t - it.at, it.dur), [cx, cy, cw, ch] = G.content, [p0x, p0y] = G.toFrame(cx, cy), [p1x, p1y] = G.toFrame(cx + cw, cy + ch), M = G.M;
  wrap.style.display = 'block'; wrap.style.left = p0x + 'px'; wrap.style.top = p0y + 'px'; wrap.style.width = (p1x - p0x) + 'px'; wrap.style.height = (p1y - p0y) + 'px'; wrap.style.opacity = String(Math.min(1, G.k * 1.8));
  inner.style.width = M.sw + 'px'; inner.style.height = M.sh + 'px'; inner.style.transform = 'translate(' + ((M.X - cx) * G.sc) + 'px,' + ((M.Y - cy) * G.sc) + 'px) scale(' + (M.A * G.sc) + ')'; }); }
const shown = PLAN.scenes.map(() => false);
function frame(t) {
  const f = Math.round(t * PLAN.fps), w = WINS.find((x) => f >= x.startF && f < x.endF), on = new Set(w ? [w.i - 1, w.i] : [sceneAt(t)]);
  PLAN.scenes.forEach((sc, i) => { reset(S[i]);
    if (!on.has(i)) { if (shown[i]) { HOST[i].innerHTML = ''; S[i].style.visibility = 'hidden'; shown[i] = false; } return; }
    S[i].style.visibility = 'visible'; shown[i] = true; HOST[i].innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">' + sceneSVG(sc, t, env) + '</svg>'; placeVideos(i, t); });
  clearOv(); if (w) applyDom(w.key, Math.min(1, Math.max(0, (t - w.start) / (w.end - w.start))), { a: S[w.i - 1], b: S[w.i], root, params: w.params, cut: (w.cut - w.start) / (w.end - w.start) });
}
const qt = new URLSearchParams(location.search).get('t'); let last = qt != null && Number.isFinite(+qt) ? +qt : window.__hfThreeTime || 0;   /* ?t=12.5 opens the page on that time (stills without a render) */ window.addEventListener('hf-seek', (e) => frame((last = e.detail.time))); frame(last); window.__seek = (t) => frame((last = t));
Promise.all(['500', '600', '700', '800'].map((wt) => document.fonts.load(wt + ' 30px Manrope')).concat([document.fonts.load('600 20px "IBM Plex Mono"')])).then(() => { frame(last); window.__ready = true; });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(PROJ, 'index.html'), html);
  const rel = path.relative(PACK, DIR), mp4 = `out/${plan.template}${tall ? '-tall' : ''}-${plan.length ?? Math.round(T)}.mp4`;
  console.log(path.join(PROJ, 'index.html'), `${plan.scenes.length} scenes, ${plan.cues.length} cues, ${T} s, ${plan.aspect}`, 'todo:', st.todo.join(' | ') || 'none');
  console.log(`render: ${tall ? `(cd ${rel}/tall && npx -y hyperframes@0.8.142 render . -o ../${mp4} --crf 23)` : `(cd ${rel} && npx -y hyperframes@0.8.142 render . -o ${mp4} --crf 23)`}`);
  return { plan, PROJ, mp4: path.join(DIR, mp4) };
}
