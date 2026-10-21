/* templates/ad/make.mjs: CONFIG -> plan -> SFX mix (sfx module) -> static HyperFrames index.html.
     node make.mjs [--set length=30 --set brand.name=Acme]   then   hyperframes render . -o out/ad.mp4
   Static clips only (HyperFrames reads media and timing from the HTML), the GSAP timeline is built from the same plan. */
import fs from 'node:fs'; import path from 'node:path';
import { stage, runPlan, head, esc, write, mix } from '../_shared/compose.mjs'; import { loadConfig } from '../_shared/project.mjs';
import { txPlan, span, txCalls } from '../_shared/txplan.mjs'; import { layoutFor, cardCss, roleSize, wrapLines, textEm } from '../_shared/relayout.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared');
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const C = await loadConfig(DIR); const B0 = C.brand;   // CONFIG + --project (PROJECT_MAP) + --aspect + --set, exactly what cues.mjs built the plan from (_shared/project.mjs)
const mediaPath = (m) => (path.isAbsolute(m) ? m : path.join(SH, 'media', m)), base = (m) => path.basename(m);   // a _shared/media plate name, or YOUR file (absolute, from the project file)
const media = [...new Set(plan.shots.filter((s) => s.media).map((s) => mediaPath(s.media)))];
if (B0.logo) media.push(B0.logo);
const missing = media.filter((m) => !fs.existsSync(m)); if (missing.length) { console.error('media not found:\n  ' + missing.join('\n  ')); process.exit(2); }
const st = stage(DIR, { media, layers: (C.layers || []).length > 0 });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace
const AS = plan.aspect || '16:9', L = layoutFor(AS, plan.safe), W = L.W, H = L.H, B = C.brand, F = plan.fps, T = plan.seconds, RL = AS !== '16:9';   // RL: the generic re-layout (_shared/relayout.mjs); 16:9 is the hand-set master below
const fsz = (role, text) => (RL ? ` style="font-size: ${roleSize(L, role, text)}px"` : '');   // per-line font size fitted to the safe rect (none at 16:9: the master CSS sets it)
const texts = [];   // plan.texts for eyes (box, size, time) on a re-laid aspect
const note = (s, text, role) => { if (!RL || !text) return; const px = roleSize(L, role, text), lines = wrapLines(text, px, L.S.w), h = Math.round(lines.length * px * 1.06), w = Math.round(Math.max(...lines.map((l) => textEm(l))) * px);
  const top = role === 'over' || role === 'reveal' ? Math.round(L.S.y0 + 24 * L.u) : role === 'name' ? Math.round((L.S.y0 + L.S.y1) / 2 - h - 40 * L.u) : role === 'cta' ? Math.round((L.S.y0 + L.S.y1) / 2) : Math.round((L.S.y0 + L.S.y1 - h) / 2);   // where cardCss puts it: top band, or centred
  const x0 = role === 'name' || role === 'cta' ? Math.round((L.W - w) / 2) : L.S.x0, x0p = role === 'proof' && !L.tall ? x0 + Math.round(152 * L.u) : x0;
  texts.push({ text: text.replace(/\*/g, ''), t: [s.start, +(s.start + (s.textDur ?? s.dur)).toFixed(4)], fontPx: px, role: role === 'name' || role === 'reveal' ? 'title' : 'line', box: [x0p, top, Math.min(L.S.x1, x0p + w), top + h] }); };
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
video.clip { z-index: 0; } .card, .proof, .end { z-index: 1; } .over { z-index: 3; }   /* a later coverage cut must never cover the line */`
  + (plan.shots.some((s) => s.placeholder) ? `\n.ph { background: repeating-linear-gradient(135deg, #e6e2d8 0 22px, #ddd8cc 22px 44px); display: flex; align-items: flex-end; padding: 0 0 70px 110px; z-index: 0; } .ph .tag { font-family: "IBM Plex Mono"; font-weight: 600; font-size: 34px; color: #3d3a34; background: rgba(245,242,234,.92); padding: 12px 20px; border-radius: 8px; }` : '')
  + (B.logo ? `\n.end .logo { max-width: 520px; max-height: 150px; }` : '');
/* the brand's type and colours beyond accent / paper (a style or a project sets them): emitted only when they differ from the defaults, so a default build is unchanged */
const FONT_FILE = { 'Manrope': null, 'IBM Plex Mono': null, 'STIX Two Text': 'STIXTwoText.ttf' }, FONT = B.font || {}, disp = FONT.display || 'Manrope', txt = FONT.text || disp;
for (const f of [disp, txt]) if (!(f in FONT_FILE)) { console.error(`ad: brand.font ${JSON.stringify(f)} is not a bundled family (${Object.keys(FONT_FILE).join(', ')})`); process.exit(2); }
const lum = (h) => { const c = h.replace('#', '').match(/../g).map((x) => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const onAccent = ['#fff', B.ink, B.paper].reduce((a, c) => (ratio(c.length === 4 ? '#ffffff' : c, B.accent) > ratio(a.length === 4 ? '#ffffff' : a, B.accent) ? c : a));   // the CTA and tick ink: white, else the brand ink or paper, whichever reads best on the accent
const styleCss = [
  disp !== 'Manrope' || txt !== 'Manrope' ? `${Object.entries(FONT_FILE).filter(([f, file]) => file && [disp, txt].includes(f)).map(([f, file]) => `@font-face { font-family: "${f}"; src: url("assets/fonts/${file}") format("truetype"); font-weight: 400 700; }`).join('\n')}\n#root { font-family: "${txt}", sans-serif; } .hl, .end .name, .end .cta { font-family: "${disp}", sans-serif; }${disp !== 'Manrope' ? ' .hl, .end .name { letter-spacing: -0.01em; }' : ''}` : '',
  B.ink.toLowerCase() !== '#111111' ? `#root { color: ${B.ink}; }` : '',
  B.muted && B.muted.toLowerCase() !== '#5d5850' ? `.end .url { color: ${B.muted}; }` : '',
  C.plates === false && !RL ? (() => { const name = String((plan.shots.find((x) => x.kind === 'reveal') || {}).text || '').replace(/\*/g, ''), k = disp === 'IBM Plex Mono' ? 0.6 : C.textCase === 'upper' ? 0.68 : disp === 'STIX Two Text' ? 0.5 : 0.54;
    const px = Math.min(220, Math.floor((W * 0.82) / Math.max(1, name.length * k)));   // the type-only reveal card holds the name on ONE line: a char-unit preset splits letters, so a wrap could break inside the word
    return `.card.reveal .hl { white-space: nowrap; max-width: none; font-size: ${px}px; }`; })() : '',
  C.plates === false ? `.kick { position: absolute; left: ${RL ? L.S.x0 : Math.round(W * 0.09)}px; top: ${RL ? Math.round(L.S.y0 + 40 * L.u) : Math.round(H * 0.2)}px; font-family: "IBM Plex Mono"; font-weight: 600; font-size: ${RL ? Math.round(40 * L.u) : 40}px; letter-spacing: 0.08em; text-transform: uppercase; background: ${B.accent}; color: ${onAccent}; padding: 18px 28px; border-radius: 6px; }` : '',   // a solid tab: frame 0 has a readable subject (eyes/frame0 needs 3:1 in a 9% window)
  C.textCase === 'upper' ? '.hl, .end .name, .end .cta { text-transform: uppercase; }' : '',
  onAccent !== '#fff' ? `.end .cta { color: ${onAccent}; } .proof .tick path { stroke: ${onAccent}; }` : '',
].filter(Boolean).join('\n');
for (const f of [disp, txt]) if (FONT_FILE[f]) { fs.mkdirSync(path.join(DIR, 'assets', 'fonts'), { recursive: true }); fs.copyFileSync(path.join(SH, 'fonts', FONT_FILE[f]), path.join(DIR, 'assets', 'fonts', FONT_FILE[f])); }
const cssOut = (RL ? cardCss(L, B) + `\n#fx { pointer-events: none; } #fx canvas { z-index: 5; }\nvideo.clip, .ph { z-index: 0; } .card, .proof, .end { z-index: 1; } .over { z-index: 3; }` : css) + (styleCss ? '\n' + styleCss : '');
let body = '', tl = '';
const P = txPlan(plan.shots, F);   // transition overlap windows (transitions module registry); clips are stretched through span()
const sp = (sel, start, dur, mediaStart) => { const o = span(P, { sel, start, dur, mediaStart }); return `data-start="${o.start.toFixed(4)}" data-duration="${o.dur.toFixed(4)}"` + (mediaStart != null ? ` data-media-start="${o.mediaStart}"` : ''); };
for (const s of plan.shots) {
  const at = s.start.toFixed(4), d = s.dur.toFixed(4), tid = 't-' + s.id, ts = () => sp('#' + s.id, s.start, s.dur);
  if ((s.kind === 'plate' || s.kind === 'reveal') && (s.media || s.placeholder)) {
    const v = s.placeholder ? `<section id="v-${s.id}" class="clip ph" ${sp('#v-' + s.id, s.start, s.dur)} data-track-index="0"><div class="tag">placeholder: ${esc(s.placeholder)}</div></section>`   // null media: a labelled pack placeholder, never a fake shot
      : `<video id="v-${s.id}" class="clip fill" src="assets/media/${base(s.media)}" muted playsinline ${sp('#v-' + s.id, s.start, s.dur, s.mediaStart)} data-track-index="0"></video>`;
    body += s.kind === 'reveal' ? `\n<div class="clip" id="w-${s.id}">${v}</div>` : '\n' + v;   // untimed wrapper: animate it, never the timed <video>
    if (s.text) { body += `\n<section id="${s.id}" class="clip over ${s.kind}" ${sp('#' + s.id, s.start, s.textDur ?? s.dur)} data-track-index="2"><div class="hl" id="${tid}"${fsz(s.kind === 'reveal' ? 'reveal' : 'over', s.text)}>${rich(s.text)}</div></section>`; note(s, s.text, s.kind === 'reveal' ? 'reveal' : 'over'); }   // text spans its coverage cuts
  } else if (s.kind === 'card' || s.kind === 'reveal') { const kick = C.plates === false && s.id === 'hook' && s.start === 0 && C.hook.kicker ? `<div class="kick">${esc(C.hook.kicker)}</div>` : '';   // the type-only hook: a kicker tab in the accent, still from frame 0
    body += `\n<section id="${s.id}" class="clip card${s.kind === 'reveal' ? ' reveal' : ''}" ${ts()} data-track-index="1">${kick}<div class="hl" id="${tid}"${fsz('card', s.text)}>${rich(s.text)}</div></section>`; note(s, s.text, 'card'); }   // a reveal with no plate (plates: false) is a type card
  else if (s.kind === 'proof') body += `\n<section id="${s.id}" class="clip proof" ${ts()} data-track-index="1"><div class="tick"><svg viewBox="0 0 64 64"><path d="M14 33 L27 46 L51 19" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="hl" id="${tid}"${fsz('proof', s.text)}>${rich(s.text)}</div></section>`, note(s, s.text, 'proof');
  else if (s.kind === 'end') { body += `\n<section id="${s.id}" class="clip end" ${ts()} data-track-index="1">${B.logo ? `<img class="logo" src="assets/media/${base(B.logo)}" alt="">` : ''}<div class="name" id="${tid}"${fsz('name', B.name + '.')}>${esc(B.name)}<i>.</i></div><div class="cta" id="${tid}-cta"${fsz('cta', s.text)}>${esc(s.text)}</div><div class="url" id="${tid}-url">${esc(B.url)}</div></section>`; note(s, B.name, 'name'); note(s, s.text, 'cta'); }
  if (s.text) tl += `\n  MP.type(tl, ${JSON.stringify(s.type)}, '#${tid}', { at: ${at}, dur: ${(s.textDur ?? s.dur).toFixed(4)}, fps: ${F}, kind: ${JSON.stringify(s.kind)} });`;
  if (s.kind === 'end') tl += `\n  MP.type(tl, ${JSON.stringify(C.type.sub)}, '#${tid}-cta', { at: ${(s.start + 0.25).toFixed(4)}, dur: ${(s.dur - 0.25).toFixed(4)}, fps: ${F} });\n  MP.type(tl, ${JSON.stringify(C.type.sub)}, '#${tid}-url', { at: ${(s.start + 0.4).toFixed(4)}, dur: ${(s.dur - 0.4).toFixed(4)}, fps: ${F} });`;
  if (s.kind === 'reveal' && (s.media || s.placeholder)) tl += `\n  tl.fromTo('#w-${s.id}', { scale: 1.0 }, { scale: 1.06, duration: ${d}, ease: 'none' }, ${at});   // slow push on the hero hold (cam.push)`;
}
tl += txCalls(P, { W, H });
if (P.todo.length) console.log('transitions todo:', P.todo.join(' | '));
fs.writeFileSync(path.join(DIR, 'out', 'tx.json'), JSON.stringify(P.wins, null, 1));
const layers = JSON.stringify(C.layers || []);
if (RL) { plan.texts = texts; plan.relayout = { how: 'generic card re-layout (_shared/relayout.mjs)', safe: L.S }; fs.writeFileSync(path.join(DIR, 'out', 'plan.json'), JSON.stringify(plan, null, 1)); }   // eyes reads the boxes
const html = `${head({ W, H, title: 'motion-pack ad template: ' + B.name, bg: B.paper, css: cssOut })}
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
