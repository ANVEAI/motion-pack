/* motion-pack / templates/_shared/human/page.mjs: stage + write the HyperFrames page for a human-led template (node). Every human template's make.mjs calls these two:
     stageHuman(PROJ, scene, { layers })  hard-links fonts, the type / transitions / layers modules (compose.stage), THIS folder's page modules and the user's media into PROJ/assets/
     pageHTML(scene, opts)                one root composition: the media slots (your footage as HyperFrames <video>, or a labelled placeholder plate), full-frame gfx parts, captions
                                          (type/dom.js), the finishing layers and the mix. ONE director draw(t) runs on every hf-seek: slot visibility, framing (punch-ins, zoom-follow,
                                          Ken Burns), PiP auto-hide, active-speaker emphasis and placeholder plates are all pure functions of t (nothing reads a clock).
   scene = { W, H, fps, seconds, bg, platform, slots: [...], gfx: [...], screenGfx: { slotId: [...] }, captions: { chunks, style, box } | null, speaking: { slotId: [[s, e], ...] } }
   slot  = { id, kind: 'speaker' | 'screen' | 'photo' | 'broll' | 'slide' | 'video', src (abs path) | null, mediaStart, start, end, rect: [x, y, w, h] px, radius, circle, z,
             inner: [w, h] (the screen size for a recording), fit: 'cover' | 'contain', cam: { kind: 'frame' | 'zoom' | 'ken', ... }, vis: { kind: 'pip' | 'active' | 'fade', ... },
             wipe: { t0, t1 } (a left-to-right reveal), ph: { placeholder plate params }, border, shadow } */
import fs from 'node:fs'; import path from 'node:path';
import { stage, head, esc } from '../compose.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), PACK = path.resolve(HERE, '..', '..', '..');
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.rmSync(dst, { force: true }); try { fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
const IMG = /\.(png|jpe?g|webp|gif|avif)$/i;

export function stageHuman(PROJ, scene, { layers = true } = {}) {
  const st = stage(PROJ, { media: [], layers });
  for (const f of fs.readdirSync(HERE).filter((f) => /\.mjs$/.test(f) && f !== 'page.mjs')) link(path.join(HERE, f), path.join(PROJ, 'assets', 'mp', 'templates', '_shared', 'human', f));
  link(path.join(HERE, '..', 'plan.mjs'), path.join(PROJ, 'assets', 'mp', 'templates', '_shared', 'plan.mjs'));
  for (const s of scene.slots) if (s.src) { const p = path.resolve(s.src); if (!fs.existsSync(p)) { console.error(`media not found for slot ${s.id}: ${p}\n  (set it with --set media.<slot>.src=/abs/file, or null for the labelled placeholder)`); process.exit(2); }
    const name = `${s.id}${path.extname(p).toLowerCase() || '.mp4'}`; link(p, path.join(PROJ, 'assets', 'media', name)); s.url = 'assets/media/' + name; s.isImage = IMG.test(p); }
  return st;
}

export function pageHTML(scene, { title = 'motion-pack human template', layers = [], adapters = [], layersOk = true, mixUrl = 'assets/media/mix.wav', seed = 7 } = {}) {
  const { W, H, fps: F, seconds: T } = scene, f = (x) => (+x).toFixed(4);
  const css = `
#root { width: ${W}px; height: ${H}px; }
.slot { position: absolute; overflow: hidden; display: none; }
.slot .inner { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.slot .inner > video, .slot .inner > img, .slot .inner > .ph { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.slot .inner > .ph svg { display: block; width: 100%; height: 100%; }
.slot .sg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.slot .phl { position: absolute; z-index: 3; padding: 0.45em 0.8em 0.5em; border-radius: 0.5em; background: rgba(10,10,14,0.78); color: #fff; font-weight: 800; letter-spacing: 0.04em; line-height: 1.15; }
.slot .phl small { display: block; font-family: 'IBM Plex Mono'; font-weight: 600; letter-spacing: 0; opacity: 0.8; font-size: 0.72em; }
#fx { pointer-events: none; } #fx canvas { z-index: 50; }`;
  let body = '';
  scene.slots.forEach((s, i) => {
    const [x, y, w, h] = s.rect, iw = (s.inner || [w, h])[0], ih = (s.inner || [w, h])[1], r = s.circle ? '50%' : `${s.radius || 0}px`;
    const deco = [s.border ? `box-shadow: 0 0 0 ${s.border.width}px ${s.border.color}${s.shadow ? ', 0 18px 50px rgba(0,0,0,.35)' : ''}` : s.shadow ? 'box-shadow: 0 18px 50px rgba(0,0,0,.35)' : '', `background:${s.bg || '#0B0D12'}`].filter(Boolean).join('; ');
    let media = '';
    if (s.url && s.isImage) media = `<img src="${s.url}" alt="">`;
    else if (s.url) media = `<video id="v-${s.id}" class="clip" src="${s.url}" muted playsinline data-start="${f(s.start)}" data-duration="${f(s.end - s.start)}" data-media-start="${f(s.mediaStart || 0)}" data-track-index="${1 + i}" style="object-fit:${s.fit === 'contain' ? 'contain' : 'cover'}"></video>`;
    else media = `<div class="ph" id="ph-${s.id}"></div>`;
    const fs = Math.max(22, Math.round(Math.min(W, H) * 0.028)), L = !s.src && s.phLabel ? `<div class="phl" style="font-size:${fs}px;${(s.phLabelPos || 'tr').includes('r') ? 'right' : 'left'}:${Math.round(fs * 0.9)}px;${(s.phLabelPos || 'tr').startsWith('b') ? 'bottom' : 'top'}:${Math.round(fs * 0.9)}px">${esc(s.phLabel[0])}<small>${esc(s.phLabel[1] || '')}</small></div>` : '';
    body += `\n<div class="slot" id="s-${s.id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r};z-index:${s.z ?? i + 1};${deco}"><div class="inner" id="i-${s.id}" style="width:${iw}px;height:${ih}px">${media}<div class="sg" id="sg-${s.id}"></div></div>${L}</div>`;
  });
  const PLAN = { W, H, F, T, slots: scene.slots.map(({ src, ...s }) => s), speaking: scene.speaking || {}, screenGfx: scene.screenGfx || {} };
  return `${head({ W, H, title, bg: scene.bg || '#0B0D12', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${f(T)}">${body}
<div id="g" class="clip" data-start="0" data-duration="${f(T)}" data-track-index="40" style="z-index:30"></div>
<div id="cap" class="clip" data-start="0" data-duration="${f(T)}" data-track-index="41" style="z-index:31"></div>
<div id="g2" class="clip" data-start="0" data-duration="${f(T)}" data-track-index="42" style="z-index:32"></div>
<div id="fx" class="clip" data-start="0" data-duration="${f(T)}" data-track-index="45"></div>
<audio id="mix" src="${mixUrl}" data-start="0" data-duration="${f(T)}" data-track-index="49" data-volume="1"></audio>
</div>
${adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { mountGfx } from './assets/mp/type/gfx/index.js';
import { mountCaptions, driveCaptions } from './assets/mp/type/dom.js';
import { speakerPlate, desktopPlate, photoPlate, brollPlate, slidePlate, speakingLevel } from './assets/mp/templates/_shared/human/plates.mjs';
import { zoomView, viewTransform, pipState } from './assets/mp/templates/_shared/human/screen.mjs';
import { frameAt, emphasisAt } from './assets/mp/templates/_shared/human/edit.mjs';
${layers.length && layersOk ? `import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(layers)}, { width: ${W}, height: ${H}, fps: ${F}, seed: ${seed} }), { fps: ${F} });` : ''}
const P = ${JSON.stringify(PLAN)};
const GFX = ${JSON.stringify(scene.gfx || [])}, GFX2 = ${JSON.stringify(scene.gfxTop || [])};
const gfx = mountGfx(document.getElementById('g'), GFX, { W: P.W, H: P.H, platform: ${JSON.stringify(scene.platform || null)} }), gfx2 = mountGfx(document.getElementById('g2'), GFX2, { W: P.W, H: P.H, platform: ${JSON.stringify(scene.platform || null)} });
const sgs = Object.fromEntries(Object.entries(P.screenGfx).map(([id, items]) => { const s = P.slots.find((x) => x.id === id), [iw, ih] = s.inner || [s.rect[2], s.rect[3]]; return [id, mountGfx(document.getElementById('sg-' + id), items, { W: iw, H: ih })]; }));
${scene.captions ? `const CAP = ${JSON.stringify(scene.captions)}; const cm = mountCaptions(document.getElementById('cap'), CAP.chunks, CAP.style, { W: P.W, H: P.H, box: CAP.box }); driveCaptions(cm, CAP.chunks);` : ''}
const el = Object.fromEntries(P.slots.map((s) => [s.id, { w: document.getElementById('s-' + s.id), i: document.getElementById('i-' + s.id), ph: document.getElementById('ph-' + s.id) }]));
const PLATES = { speaker: speakerPlate, screen: desktopPlate, photo: photoPlate, broll: brollPlate, slide: slidePlate, video: brollPlate };
function draw(t) {
  for (const s of P.slots) {
    const E = el[s.id], on = t >= s.start - 1e-6 && t < s.end - 1e-6; E.w.style.display = on ? 'block' : 'none'; if (!on) continue;
    const [x, y, w, h] = s.rect, [iw, ih] = s.inner || [w, h], lt = t - s.start; let op = 1, sc = 1;
    if (s.vis && s.vis.kind === 'pip') { const v = pipState(s.vis, t, { keys: s.vis.keys || [], track: s.vis.track || [] }); op = v.opacity; sc = v.scale; }
    if (s.vis && s.vis.kind === 'active') { const k = emphasisAt(s.vis.cuts, s.vis.speaker, t); op = s.vis.dim + (1 - s.vis.dim) * k; sc = 1 + (s.vis.grow || 0) * k; E.w.style.boxShadow = k > 0.02 ? '0 0 0 ' + (s.vis.ring * k).toFixed(2) + 'px ' + s.vis.color : 'none'; }
    if (s.vis && s.vis.kind === 'fade') { const a = s.vis.in || 0.2, b = s.vis.out || 0.2; op = Math.min(1, lt / a, (s.end - t) / b); }
    E.w.style.opacity = Math.max(0, op).toFixed(4); E.w.style.transform = sc !== 1 ? 'scale(' + sc.toFixed(4) + ')' : 'none'; E.w.style.transformOrigin = (s.origin || [0.5, 0.5]).map((v) => (v * 100).toFixed(1) + '%').join(' ');
    if (s.wipe) { const k = Math.min(1, Math.max(0, (t - s.wipe.t0) / (s.wipe.t1 - s.wipe.t0))), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; E.w.style.clipPath = 'inset(0 ' + ((1 - e) * 100).toFixed(2) + '% 0 0)'; }
    let tr = '';
    const c = s.cam || {};
    if (c.kind === 'zoom' || (!c.kind && s.inner)) { const v = c.kind === 'zoom' ? zoomView(c.keys, c.track, t, { follow: c.follow || 0.5 }) : { s: 1, cx: 0.5, cy: 0.5 }; const m = viewTransform(v, [iw, ih], [w, h], s.fit || 'contain'); tr = 'translate(' + m.tx + 'px,' + m.ty + 'px) scale(' + m.k + ')'; }
    else if (c.kind === 'frame') { const k = frameAt(c.plan, t), [ax, ay] = c.anchor || [0.5, 0.4]; tr = 'translate(' + (ax * w * (1 - k)).toFixed(2) + 'px,' + (ay * h * (1 - k)).toFixed(2) + 'px) scale(' + k.toFixed(5) + ')'; }
    else if (c.kind === 'ken') { const u = Math.min(1, Math.max(0, (t - (c.t0 ?? s.start)) / Math.max(0.01, (c.t1 ?? s.end) - (c.t0 ?? s.start)))), e = 0.5 - 0.5 * Math.cos(Math.PI * u), k = c.from[0] + (c.to[0] - c.from[0]) * e, fx = c.from[1] + (c.to[1] - c.from[1]) * e, fy = c.from[2] + (c.to[2] - c.from[2]) * e;
      const bk = Math.max(w / iw, h / ih) * k, tx = Math.min(0, Math.max(w - iw * bk, w / 2 - fx * iw * bk)), ty = Math.min(0, Math.max(h - ih * bk, h / 2 - fy * ih * bk)); tr = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + bk.toFixed(5) + ')'; }
    E.i.style.transform = tr;
    if (E.ph) { const fn = PLATES[s.kind] || brollPlate, ph = { w: iw, h: ih, ...(s.ph || {}) }; if (s.kind === 'speaker') ph.level = speakingLevel(P.speaking[s.id] || [], t); E.ph.innerHTML = fn(s.kind === 'slide' ? lt : t, ph); }
    if (sgs[s.id]) sgs[s.id].render(t);
  }
  gfx.render(t); gfx2.render(t);
}
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => draw((last = e.detail.time))); draw(last); window.__seek = (t) => draw((last = t));
Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope')).concat([document.fonts.load('600 20px "IBM Plex Mono"')])).then(() => { draw(last); window.__ready = true; });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${f(T)});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
}
