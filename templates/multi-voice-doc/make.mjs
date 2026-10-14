/* templates/multi-voice-doc/make.mjs: clips.json (your interview clips + word timings) -> the documentary launch film (HyperFrames).
     PYTHON=python3 node make.mjs [--set placeholderVoice=none --set tail.holdS=5]
   then   npx -y hyperframes@0.8.142 render . -o out/multi-voice-doc.mp4 --crf 23
          python3 ../_shared/sheet.py out/multi-voice-doc.mp4 out/sheet.jpg 0.5,1.5,2.5,3.5,6.4,8.6,10.6,11.8,14.6,18.8,21.0,22.4,24.0,25.6,27.0,29.0
          python3 ../../ears/listen.py out/multi-voice-doc.mp4 --plan out/plan.json --transcript out/transcript.json
   Steps: plan (config.mjs, the cold open from cuts/cutgen.py voices-open) -> the voice track (vo.py: your clips' audio, or a labelled guide signal)
   -> the mix (templates/_shared/audio.py -> music/mixer.py: bed ducked 9 dB under the voice, bed automation for the quiet hold, -14 LUFS master)
   -> index.html. Picture: your clips muted (their sound is in the mix), or labelled placeholder cards; flat 2D inserts drawn here (SVG + GSAP). */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, head, esc, write } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..'), OUT = path.join(DIR, 'out'), PY = process.env.PYTHON || 'python3';
execFileSync('node', [path.join(SH, 'cues.mjs'), DIR, ...process.argv.slice(2)], { stdio: 'inherit' });
const plan = JSON.parse(fs.readFileSync(path.join(OUT, 'plan.json'), 'utf8'));
const { CONFIG } = await import('./config.mjs'); const C = structuredClone(CONFIG);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--set') { const [k, v] = process.argv[++i].split('='); let o = C; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v !== '' && !isNaN(+v) ? +v : v; }
const abs = (p) => (path.isAbsolute(p) ? p : path.resolve(DIR, p)), F = plan.fps, [W, H] = plan.size, T = plan.seconds, f = (x) => (+x).toFixed(4), s = (fr) => fr / F;

/* 1. stage: fonts, type, layers, the gfx registry (name supers), your clips + B-roll as hard links */
const st = stage(DIR, { media: [], layers: (C.layers || []).length > 0 }); fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
for (const g of fs.readdirSync(path.join(PACK, 'type', 'gfx'))) if (g.endsWith('.js')) { const d = path.join(DIR, 'assets', 'mp', 'type', 'gfx', g); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); fs.linkSync(path.join(PACK, 'type', 'gfx', g), d); }
const media = (src, name) => { const p = abs(src); if (!fs.existsSync(p)) { console.error('clip not found: ' + p); process.exit(2); } const d = path.join(DIR, 'assets', 'media', name); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); fs.linkSync(p, d); return 'assets/media/' + name; };
const clipUrl = {}; for (const a of plan.audio) if (a.src && !clipUrl[a.clip]) clipUrl[a.clip] = media(a.src, `clip-${a.clip}.mp4`);
plan.overlays.forEach((o, k) => { if (o.kind === 'broll' && o.src) o.url = media(o.src, `broll-${k}.mp4`); });

/* 2. the voice track, the transcript for ears, then the mix */
fs.writeFileSync(path.join(OUT, 'transcript.json'), JSON.stringify({ source: 'timeline words of out/plan.json (placeholder text until clips.json holds real transcripts)', words: plan.transcript }));
execFileSync(PY, [path.join(DIR, 'vo.py'), path.join(OUT, 'plan.json'), path.join(OUT, 'vo.wav'), '--placeholder', C.placeholderVoice], { stdio: 'inherit' });
execFileSync(PY, [path.join(SH, 'audio.py'), path.join(OUT, 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });

/* 3. the composition */
const PAPER = '#F3EFE6', INK = '#1D1B19', ACC = '#4A18ED', TINT = ['#2B2622', '#22282B', '#2A2430', '#24291F', '#2E2620', '#1F2630', '#2B2228', '#262626'];
const tint = Object.fromEntries([...new Set(plan.audio.map((a) => a.clip))].map((c, i) => [c, TINT[i % TINT.length]]));
const css = `
.ph { display: flex; align-items: center; justify-content: center; }
.ph .box { position: absolute; inset: 7% 8%; border: 3px dashed rgba(243,239,230,.32); border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
.ph .t { font-weight: 800; font-size: 74px; letter-spacing: -0.025em; color: ${PAPER}; }
.ph .m { font-family: "IBM Plex Mono"; font-size: 26px; color: rgba(243,239,230,.66); }
.ph .q { font-size: 34px; font-weight: 500; color: rgba(243,239,230,.85); max-width: 70%; text-align: center; }
.ph.light .box { border-color: rgba(29,27,25,.28); } .ph.light .t { color: ${INK}; } .ph.light .m { color: rgba(29,27,25,.6); }
.paper { background: ${PAPER}; }
.ins svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.ins .cap { position: absolute; left: ${Math.round(W * 0.07)}px; bottom: ${Math.round(H * 0.09)}px; font-family: "IBM Plex Mono"; font-size: 28px; color: rgba(29,27,25,.7); }
.card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
.card .big { font-weight: 800; font-size: 92px; letter-spacing: -0.035em; color: ${INK}; text-align: center; max-width: 80%; line-height: 1.04; }
.card .src { font-family: "IBM Plex Mono"; font-size: 24px; color: rgba(29,27,25,.55); }
.card .sub { font-family: "IBM Plex Mono"; font-size: 34px; color: ${ACC}; }
.end .mark { display: flex; align-items: center; gap: 26px; font-weight: 800; font-size: 128px; letter-spacing: -0.04em; color: ${INK}; }
.end .mark i { width: 96px; height: 96px; border-radius: 50%; border: 22px solid ${ACC}; box-sizing: border-box; }
`;
/* seeded layout helpers for the flat inserts (deterministic) */
const lcg = (seed) => { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
function insertSVG(o, k) {
  const r = lcg(97 + k * 31), id = `in${k}`, t0 = s(o.start), d = s(o.end - o.start); let svg = '', tl = '';
  if (o.insert === 'network') {   // many notes -> one dot
    const cx = W / 2, cy = H * 0.48, N = 11;
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.4, R = 230 + r() * 210, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.78, rr = 9 + Math.round(r() * 14), ring = r() < 0.45, L = Math.hypot(x - cx, y - cy);
      svg += `<line id="${id}l${i}" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${INK}" stroke-width="3" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${L.toFixed(1)}"/>`;
      svg += `<circle id="${id}n${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0" fill="${ring ? 'none' : '#8F8A80'}" stroke="${INK}" stroke-width="${ring ? 3 : 0}"/>`;
      tl += `\n  tl.to('#${id}l${i}', { attr: { 'stroke-dashoffset': 0 }, duration: 0.3, ease: 'power2.out' }, ${f(t0 + 0.04 * i)});`;
      tl += `\n  tl.to('#${id}n${i}', { attr: { r: ${rr} }, duration: 0.22, ease: 'back.out(2)' }, ${f(t0 + 0.12 + 0.04 * i)});`;
      tl += `\n  tl.to('#${id}n${i}', { attr: { cx: ${cx}, cy: ${cy}, r: 4 }, duration: 0.42, ease: 'power3.inOut' }, ${f(t0 + d * 0.48)});`;
      tl += `\n  tl.to('#${id}l${i}', { attr: { x2: ${cx}, y2: ${cy} }, duration: 0.42, ease: 'power3.inOut' }, ${f(t0 + d * 0.48)});`; }
    svg += `<circle id="${id}c" cx="${cx}" cy="${cy}" r="20" fill="${ACC}"/>`;
    tl += `\n  tl.to('#${id}c', { attr: { r: 118 }, duration: 0.38, ease: 'back.out(1.6)' }, ${f(t0 + d * 0.48 + 0.36)});`;
  } else if (o.insert === 'tiles') {   // documents fly in and tile into a wall
    const cols = 5, rows = 3, pw = 230, ph = 160, gap = 24, ox = (W - (cols * pw + (cols - 1) * gap)) / 2, oy = (H - (rows * ph + (rows - 1) * gap)) / 2 - 20;
    for (let i = 0; i < cols * rows; i++) { const x = ox + (i % cols) * (pw + gap), y = oy + Math.floor(i / cols) * (ph + gap), hasAcc = r() < 0.35;
      svg += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g id="${id}p${i}"><rect width="${pw}" height="${ph}" rx="8" fill="#FFFFFF" stroke="#D8D2C6" stroke-width="2"/>`
        + `<rect x="22" y="24" width="${Math.round(90 + r() * 90)}" height="12" rx="6" fill="#8F8A80"/><rect x="22" y="52" width="${Math.round(120 + r() * 60)}" height="9" rx="4.5" fill="#C9C2B4"/>`
        + `<rect x="22" y="72" width="${Math.round(100 + r() * 80)}" height="9" rx="4.5" fill="#C9C2B4"/>${hasAcc ? `<rect x="22" y="${ph - 52}" width="64" height="30" rx="6" fill="${ACC}"/>` : `<circle cx="${pw - 46}" cy="${ph - 40}" r="18" fill="none" stroke="${INK}" stroke-width="3"/>`}</g></g>`;
      tl += `\n  tl.fromTo('#${id}p${i}', { x: ${Math.round((r() - 0.5) * 2600)}, y: ${Math.round((r() < 0.5 ? -1 : 1) * (700 + r() * 300))}, rotation: ${Math.round((r() - 0.5) * 70)}, svgOrigin: '${pw / 2} ${ph / 2}' }, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: 'power3.out' }, ${f(t0 + 0.045 * i)});`; }
  } else {   // flat blocks slide across
    const cols = [ACC, INK, '#8F8A80', '#C9C2B4'];
    for (let i = 0; i < 9; i++) { const w = 120 + Math.round(r() * 260), h = 90 + Math.round(r() * 330), y = Math.round(r() * (H - h)), c = cols[i % cols.length], x0 = W + 80 + i * 150;
      svg += `<g id="${id}b${i}">${i % 4 === 3 ? `<circle cx="${x0 + w / 2}" cy="${y + h / 2}" r="${Math.round(Math.min(w, h) / 2.4)}" fill="none" stroke="${INK}" stroke-width="5"/>` : `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`}</g>`;
      tl += `\n  tl.fromTo('#${id}b${i}', { x: 0 }, { x: -3500, duration: 1.4583, ease: 'none' }, ${f(t0 - 0.3)});`; }   // one conveyor speed (2400 px/s): the stream is still full when the insert ends
  }
  return { svg: `<svg viewBox="0 0 ${W} ${H}">${svg}</svg>`, tl };
}
let body = '', tl = '';
plan.base.forEach((b, i) => {
  const a = plan.audio[i], at = `data-start="${f(s(b.start))}" data-duration="${f(s(b.end - b.start))}" data-track-index="0"`;
  if (b.role === 'end') {
    body += `\n<section class="clip paper card end" id="end" ${at}><div class="mark" id="end-m"><i></i>${esc(C.tail.wordmark)}</div><div class="sub" id="end-u">${esc(C.tail.url)}</div></section>`;
    tl += `\n  MP.type(tl, 'type/blurIn', '#end-m', { at: ${f(s(b.start) + 0.1)}, dur: ${f(s(b.end - b.start) - 0.1)}, fps: ${F} });`;
  } else if (clipUrl[b.clip]) {
    body += `\n<video id="v${i}" class="clip fill" src="${clipUrl[b.clip]}" muted playsinline data-media-start="${f(b.mediaStart)}" ${at}></video>`;
  } else {
    const who = b.clip;
    body += `\n<section class="clip ph" id="ph${i}" style="background:${tint[b.clip] || TINT[0]}" ${at}><div class="box"><div class="t">your interview clip here</div>`
      + `<div class="q">“${esc((a && a.text) || '')}”</div><div class="m">clip ${esc(who)} · ${esc(b.role)} · source ${(+b.mediaStart).toFixed(2)} s · set src in clips.json</div></div></section>`;
  }
});
plan.overlays.forEach((o, k) => {
  const at = `data-start="${f(s(o.start))}" data-duration="${f(s(o.end - o.start))}" data-track-index="1"`;
  if (o.kind === 'insert') { const g = insertSVG(o, k); body += `\n<section class="clip paper ins" id="ov${k}" ${at}>${g.svg}<div class="cap" id="ovc${k}">${esc(o.line || '')}</div></section>`; tl += g.tl + `\n  tl.fromTo('#ovc${k}', { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${f(s(o.start) + 0.2)});`; }
  else if (o.kind === 'broll' && o.url) body += `\n<video id="ov${k}" class="clip fill" src="${o.url}" muted playsinline data-media-start="${f(o.mediaStart)}" ${at}></video>`;
  else if (o.kind === 'broll') body += `\n<section class="clip ph light" id="ov${k}" style="background:#D8D2C6" ${at}><div class="box"><div class="t">your B-roll here</div><div class="m">${esc(o.label || '')} · chapter ${o.chapter}</div></div></section>`;
  else if (o.kind === 'card') { body += `\n<section class="clip paper card" id="ov${k}" ${at}><div class="big" id="ovt${k}">${esc(o.text)}</div><div class="src">source: ${esc(o.source || 'MISSING')}</div></section>`; tl += `\n  MP.type(tl, 'type/maskRise', '#ovt${k}', { at: ${f(s(o.start))}, dur: ${f(s(o.end - o.start))}, fps: ${F} });`; }
  else if (o.kind === 'availability') { body += `\n<section class="clip paper card" id="ov${k}" ${at}><div class="big" id="ovt${k}">${esc(o.line)}</div><div class="sub">${esc(o.sub || '')}</div></section>`; tl += `\n  MP.type(tl, 'type/maskRise', '#ovt${k}', { at: ${f(s(o.start))}, dur: ${f(s(o.end - o.start))}, fps: ${F} });`; }
});
/* gfx dur = the hold: the part also spends its inF + outF frames (docSuper 4 + 6) around it, so subtract them (CONFIG.supers.edgeF) or the super fades out over the next shot */
const supers = plan.supers.map((x) => ({ id: C.supers.part, at: +s(x.at).toFixed(4), dur: +Math.max(0.2, s(x.dur) - C.supers.edgeF / F).toFixed(4), params: { ...C.supers.params, name: x.name, role: [x.role, x.tag].filter(Boolean).join(' · '), pos: C.supers.pos } }));
const html = `${head({ W, H, title: 'motion-pack multi-voice documentary', bg: '#111', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">${body}
<div id="g" class="clip" data-start="0" data-duration="${T}" data-track-index="4"></div>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountGfx } from './assets/mp/type/gfx/index.js';
${(C.layers || []).length && !st.todo.some((x) => x.startsWith('layers')) ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: 7 }), { fps: ${F} });` : ''}
const gfx = mountGfx(document.getElementById('g'), ${JSON.stringify(supers)}, { W: ${W}, H: ${H} });   // name supers: ${C.supers.part} (swap in lowerThird.personalTag in CONFIG once it lands)
window.addEventListener('hf-seek', (e) => gfx.render(e.detail.time)); gfx.render(window.__hfThreeTime || 0);
const tl = gsap.timeline({ paused: true });${tl}
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${plan.audio.length} voice segments (${plan.open.faces} faces in ${plan.open.seconds} s), ${plan.overlays.length} overlays, ${plan.supers.length} supers, ${T} s`,
  `placeholders: ${plan.placeholders} (labelled cards; set src in clips.json)`, plan.lint_vo.length ? 'VO LINT: ' + plan.lint_vo.join(' | ') : 'vo ok', 'todo:', st.todo.join(' | ') || 'none');
