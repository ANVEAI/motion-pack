/* templates/ad/make.mjs: CONFIG -> plan -> SFX mix (sfx module) -> static HyperFrames index.html.
     node make.mjs [--set length=30 --set brand.name=Acme]   then   hyperframes render . -o out/ad.mp4
   Static clips only (HyperFrames reads media and timing from the HTML), the GSAP timeline is built from the same plan. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, runPlan, head, esc, write } from '../_shared/compose.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG } = await import('./config.mjs'); const C = structuredClone(CONFIG);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--set') { const [k, v] = process.argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const media = [...new Set(plan.shots.filter((s) => s.media).map((s) => path.join(SH, 'media', s.media)))];
const st = stage(DIR, { media, layers: (C.layers || []).length > 0 });
execFileSync('python3', [path.join(SH, 'audio.py'), path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });
const W = 1920, H = 1080, B = C.brand, F = plan.fps, T = plan.seconds;
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const css = `
.card { background: ${B.paper}; display: flex; align-items: center; padding: 0 ${Math.round(W * 0.09)}px; }
.hl { font-weight: 800; font-size: 118px; line-height: 1.02; letter-spacing: -0.035em; max-width: 1500px; }
.hl em { font-style: normal; color: ${B.accent}; }
.over { display: flex; align-items: flex-start; padding: ${Math.round(H * 0.1)}px ${Math.round(W * 0.07)}px 0; }   /* plates keep their subject low: type sits in the clear top band */
.over .hl { font-size: 104px; color: #111; text-shadow: 0 2px 24px rgba(245,242,234,0.85); }
.proof { background: ${B.paper}; display: flex; align-items: center; gap: 48px; padding: 0 ${Math.round(W * 0.09)}px; }
.proof .tick { width: 120px; height: 120px; border-radius: 60px; background: ${B.accent}; flex: none; display: grid; place-items: center; }
.proof .tick svg { width: 64px; height: 64px; }
.proof .hl { font-size: 92px; }
.end { background: ${B.paper}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
.end .name { font-weight: 800; font-size: 200px; letter-spacing: -0.05em; color: ${B.ink}; }
.end .name i { font-style: normal; color: ${B.accent}; }
.end .cta { font-weight: 700; font-size: 64px; background: ${B.accent}; color: #fff; padding: 22px 54px; border-radius: 60px; }
.end .url { font-family: "IBM Plex Mono"; font-weight: 600; font-size: 34px; color: #5d5850; letter-spacing: 0.04em; }
.reveal .hl { font-size: 220px; letter-spacing: -0.05em; }
#fx { pointer-events: none; } #fx canvas { z-index: 5; }   /* layers over picture + type; z on the canvases, NOT on #fx (a stacking context on #fx would isolate mix-blend-mode) */
video.clip { z-index: 0; } .card, .proof, .end { z-index: 1; } .over { z-index: 3; }   /* a later coverage cut must never cover the line */`;
let body = '', tl = '';
const P = txPlan(plan.shots, F);   // transition overlap windows (transitions module registry); clips are stretched through span()
const sp = (sel, start, dur, mediaStart) => { const o = span(P, { sel, start, dur, mediaStart }); return `data-start="${o.start.toFixed(4)}" data-duration="${o.dur.toFixed(4)}"` + (mediaStart != null ? ` data-media-start="${o.mediaStart}"` : ''); };
for (const s of plan.shots) {
  const at = s.start.toFixed(4), d = s.dur.toFixed(4), tid = 't-' + s.id, ts = () => sp('#' + s.id, s.start, s.dur);
  if (s.kind === 'plate' || s.kind === 'reveal') {
    const v = `<video id="v-${s.id}" class="clip fill" src="assets/media/${s.media}" muted playsinline ${sp('#v-' + s.id, s.start, s.dur, s.mediaStart)} data-track-index="0"></video>`;
    body += s.kind === 'reveal' ? `\n<div class="clip" id="w-${s.id}">${v}</div>` : '\n' + v;   // untimed wrapper: animate it, never the timed <video>
    if (s.text) body += `\n<section id="${s.id}" class="clip over ${s.kind}" ${sp('#' + s.id, s.start, s.textDur ?? s.dur)} data-track-index="2"><div class="hl" id="${tid}">${rich(s.text)}</div></section>`;   // text spans its coverage cuts
  } else if (s.kind === 'card') body += `\n<section id="${s.id}" class="clip card" ${ts()} data-track-index="1"><div class="hl" id="${tid}">${rich(s.text)}</div></section>`;
  else if (s.kind === 'proof') body += `\n<section id="${s.id}" class="clip proof" ${ts()} data-track-index="1"><div class="tick"><svg viewBox="0 0 64 64"><path d="M14 33 L27 46 L51 19" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="hl" id="${tid}">${rich(s.text)}</div></section>`;
  else if (s.kind === 'end') body += `\n<section id="${s.id}" class="clip end" ${ts()} data-track-index="1"><div class="name" id="${tid}">${esc(B.name)}<i>.</i></div><div class="cta" id="${tid}-cta">${esc(s.text)}</div><div class="url" id="${tid}-url">${esc(B.url)}</div></section>`;
  if (s.text) tl += `\n  MP.type(tl, ${JSON.stringify(s.type)}, '#${tid}', { at: ${at}, dur: ${(s.textDur ?? s.dur).toFixed(4)}, fps: ${F}, kind: ${JSON.stringify(s.kind)} });`;
  if (s.kind === 'end') tl += `\n  MP.type(tl, ${JSON.stringify(C.type.sub)}, '#${tid}-cta', { at: ${(s.start + 0.25).toFixed(4)}, dur: ${(s.dur - 0.25).toFixed(4)}, fps: ${F} });\n  MP.type(tl, ${JSON.stringify(C.type.sub)}, '#${tid}-url', { at: ${(s.start + 0.4).toFixed(4)}, dur: ${(s.dur - 0.4).toFixed(4)}, fps: ${F} });`;
  if (s.kind === 'reveal') tl += `\n  tl.fromTo('#w-${s.id}', { scale: 1.0 }, { scale: 1.06, duration: ${d}, ease: 'none' }, ${at});   // slow push on the hero hold (cam.push)`;
}
tl += txCalls(P, { W, H });
if (P.todo.length) console.log('transitions todo:', P.todo.join(' | '));
fs.writeFileSync(path.join(DIR, 'out', 'tx.json'), JSON.stringify(P.wins, null, 1));
const layers = JSON.stringify(C.layers || []);
const html = `${head({ W, H, title: 'motion-pack ad template: ' + B.name, bg: B.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${layers}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : `MP._miss('layers/*', 'no finishing layers');`}
const tl = gsap.timeline({ paused: true });${tl}
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), 'todo:', st.todo.join(' | ') || 'none');
