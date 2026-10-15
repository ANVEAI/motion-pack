/* templates/beat-edit/make.mjs: BPM -> beat grid -> cut list -> HyperFrames index.html (+ drum-grid SFX mix from the sfx module).
     node make.mjs [--set bpm=128 --set platform=reels.organic]   then   hyperframes render . -o out/beat-edit.mp4 */
import fs from 'node:fs'; import path from 'node:path';
import { stage, runPlan, head, esc, write, mix } from '../_shared/compose.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG } = await import('./config.mjs'); const C = structuredClone(CONFIG);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--set') { const [k, v] = process.argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const abs = (p) => (path.isAbsolute(p) ? p : path.resolve(DIR, p));
const missing = [...new Set(plan.shots.map((s) => abs(s.media)))].filter((p) => !fs.existsSync(p)); if (missing.length) { console.error('clips not found (render the other templates first):\n' + missing.join('\n')); process.exit(2); }
const st = stage(DIR, { media: [...new Set(plan.shots.map((s) => abs(s.media)))], layers: (C.layers || []).length > 0 });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace
const [W, H] = plan.size, F = plan.fps, T = plan.seconds, f = (x) => (+x).toFixed(4);
const css = `
.w { position: absolute; inset: 0; }
.word { display: grid; place-items: center; }
.word div { font-weight: 800; font-size: ${Math.round(Math.min(W, H) * 0.26)}px; letter-spacing: -0.05em; color: #111; text-shadow: 0 6px 40px rgba(245,242,234,.9); }
.word.alt div { color: #4a18ed; }`;
let body = '', tl = '';
const P = txPlan(plan.shots, F, { bpm: plan.bpm });   // transition overlap windows on the beat grid (transitions registry)
plan.shots.forEach((s, i) => {
  const o = span(P, { sel: '#' + s.id, start: s.start, dur: s.dur, mediaStart: s.mediaStart });
  body += `\n<div class="w" id="w-${s.id}"><video id="${s.id}" class="clip fill" src="assets/media/${path.basename(s.media)}" muted playsinline data-start="${f(o.start)}" data-duration="${f(o.dur)}" data-media-start="${o.mediaStart}" data-track-index="0"></video></div>`;
  if (s.flash) tl += `\n  tl.fromTo('#w-${s.id}', { scale: 1.08 }, { scale: 1.0, duration: ${f(6 / F)}, ease: 'power3.out' }, ${f(s.start)});   // cam.punch on the beat`;
});
tl += txCalls(P, { W, H });
if (P.todo.length) console.log('transitions todo:', P.todo.join(' | '));
fs.writeFileSync(path.join(DIR, 'out', 'tx.json'), JSON.stringify(P.wins, null, 1));
plan.words.forEach((w, i) => { body += `\n<section class="clip word${i % 2 ? ' alt' : ''}" id="word${i}" data-start="${f(w.t)}" data-duration="${f(w.dur)}" data-track-index="2"><div id="wt${i}">${esc(w.text)}</div></section>`;
  tl += `\n  MP.type(tl, ${JSON.stringify(C.type.word)}, '#wt${i}', { at: ${f(w.t)}, dur: ${f(w.dur)}, fps: ${F}, beat: true });`; });
const html = `${head({ W, H, title: 'motion-pack beat-edit template', bg: '#111', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 5 }), { fps: ${F} });` : ''}
const tl = gsap.timeline({ paused: true });${tl}
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${plan.shots.length} cuts at ${plan.bpm} BPM (asked ${plan.bpmAsked}, ${plan.framesPerBeat} f/beat)`, 'todo:', st.todo.join(' | ') || 'none');
