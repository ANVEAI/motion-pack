/* templates/talking-head/make.mjs: input MP4 + words.json -> jump-cut edit with captions, B-roll, punch-ins, lower third (HyperFrames).
     node make.mjs [--set input=/abs/talk.mp4 --set platform=yt.ad.15]   then   hyperframes render . -o out/talking-head.mp4
   The input's own audio rides on each kept segment (data-has-audio); the SFX mix is a separate <audio>. */
import fs from 'node:fs'; import path from 'node:path';
import { stage, runPlan, head, esc, write, mix } from '../_shared/compose.mjs'; import { loadConfig } from '../_shared/project.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const C = await loadConfig(DIR);   // CONFIG + --project (PROJECT_MAP) + --aspect + --set, exactly what cues.mjs built the plan from (_shared/project.mjs)
const abs = (p) => (path.isAbsolute(p) ? p : path.resolve(DIR, p));
const input = abs(C.input); if (!fs.existsSync(input)) { console.error('input MP4 not found: ' + input); process.exit(2); }
const st = stage(DIR, { media: [...new Set(plan.broll.map((b) => abs(b.src)))], layers: (C.layers || []).length > 0 });
fs.rmSync(path.join(DIR, 'assets', 'media', 'input.mp4'), { force: true }); fs.linkSync(input, path.join(DIR, 'assets', 'media', 'input.mp4'));
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'), '--stem');   // audio.py: a failure ends the build with its own message, no stack trace   // a stem under the dialogue: never normalised on its own
const [W, H] = plan.size, F = plan.fps, T = plan.seconds, A = C.framing.anchor, acc = C.captions.accent, f = (x) => (+x).toFixed(4);
const css = `
.frame { position: absolute; inset: 0; transform-origin: ${A[0] * 100}% ${A[1] * 100}%; }
.frame video { object-position: 50% ${A[1] * 100}%; }
.cap { display: flex; justify-content: center; align-items: flex-start; padding-top: ${Math.round(H * C.captions.y)}px; }
.capi { font-weight: 800; font-size: ${Math.round(H * 0.052)}px; line-height: 1.05; text-align: center; max-width: ${Math.round(W * 0.84)}px; color: #fff;
  -webkit-text-stroke: ${Math.round(H * 0.052 * 0.08)}px #111; paint-order: stroke fill; text-shadow: 0 4px 0 rgba(0,0,0,.35); letter-spacing: -0.02em; text-transform: none; }
.capi span { display: inline-block; margin: 0 0.18em; }
.lt { display: flex; align-items: flex-start; padding: ${Math.round(H * (plan.safe.top + 0.02))}px 0 0 ${Math.round(W * (plan.safe.side + 0.02))}px; }   /* below the top UI zone, clear of the caption band */
.lt .box { background: #fff; border-radius: 18px; padding: 18px 28px 20px; box-shadow: 0 10px 30px rgba(0,0,0,.12); border-left: 10px solid ${acc}; }
.lt .n { font-weight: 800; font-size: ${Math.round(H * 0.026)}px; color: #111; } .lt .t { font-family: "IBM Plex Mono"; font-weight: 600; font-size: ${Math.round(H * 0.016)}px; color: #5d5850; margin-top: 6px; }
.broll { border-radius: 0; }`;
let body = '', tl = '';
plan.segs.forEach((s, i) => {
  tl += `\n  tl.set('#fr-${i}', { scale: ${s.scale} }, 0);   // cam.reframeAlternate`;
  body += `\n<div class="frame" id="fr-${i}"><video id="${s.id}" class="clip fill" src="assets/media/input.mp4" playsinline data-has-audio="true" data-start="${f(s.start)}" data-duration="${f(s.dur)}" data-media-start="${f(s.src)}" data-track-index="0" data-volume="1"></video></div>`;
});
for (const p of plan.punches) { const i = plan.segs.findIndex((s) => p.t >= s.start - 1e-6 && p.t < s.start + s.dur); if (i < 0) continue; const b = plan.segs[i].scale;
  tl += `\n  tl.fromTo('#fr-${i}', { scale: ${b} }, { scale: ${(b * C.punch.scale).toFixed(4)}, duration: ${(C.punch.inMs / 1000).toFixed(3)}, ease: 'back.out(1.6)' }, ${f(p.t)});   // cam.punchIn "${p.word}"`; }
plan.broll.forEach((b) => { body += `\n<video id="${b.id}" class="clip fill broll" src="assets/media/${path.basename(b.src)}" muted playsinline data-start="${f(b.start)}" data-duration="${f(b.dur)}" data-media-start="${b.mediaStart}" data-track-index="1"></video>`; });
plan.captions.forEach((c, k) => {
  body += `\n<div class="clip cap" id="${c.id}" data-start="${f(c.start)}" data-duration="${f(c.end - c.start)}" data-track-index="3"><div class="capi" id="ci-${k}">${c.words.map((w, j) => `<span id="w-${k}-${j}">${esc(w.w)}</span>`).join('')}</div></div>`;
  if (C.type.caption) tl += `\n  if (MP.REG[${JSON.stringify(C.type.caption)}]) MP.type(tl, ${JSON.stringify(C.type.caption)}, '#ci-${k}', { at: ${f(c.start)}, dur: ${f(c.end - c.start)}, fps: ${F}, words: ${JSON.stringify(c.words)} }); else {`;
  tl += `\n  tl.fromTo('#ci-${k}', { scale: 0.85 }, { scale: 1.06, duration: 0.07, ease: 'power2.out' }, ${f(c.start)}).to('#ci-${k}', { scale: 1, duration: 0.07, ease: 'power2.in' }, ${f(c.start + 0.07)});`;
  c.words.forEach((w, j) => { tl += `\n  tl.set('#w-${k}-${j}', { color: '${acc}', scale: ${w.emph ? 1.15 : 1} }, ${f(Math.max(c.start, w.s))}); tl.set('#w-${k}-${j}', { color: '#ffffff', scale: 1 }, ${f(c.words[j + 1] ? c.words[j + 1].s : c.end)});`; });
  tl += C.type.caption ? `\n  }` : '';
});
const LT = C.lowerThird; body += `\n<section class="clip lt" id="lt" data-start="${LT.at}" data-duration="${LT.dur}" data-track-index="4"><div class="box" id="lt-box"><div class="n">${esc(LT.name)}</div><div class="t">${esc(LT.title)}</div></div></section>`;
tl += `\n  MP.type(tl, ${JSON.stringify(C.type.lowerThird)}, '#lt-box', { at: ${LT.at}, dur: ${LT.dur}, fps: ${F}, out: true });`;
const html = `${head({ W, H, title: 'motion-pack talking-head template', bg: '#111', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 11 }), { fps: ${F} });` : ''}
const tl = gsap.timeline({ paused: true });${tl}
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), `keep ${plan.keep.length} segs, ${plan.captions.length} captions, ${plan.punches.length} punch-ins, B-roll coverage ${plan.coverage}`, 'todo:', st.todo.join(' | ') || 'none');
