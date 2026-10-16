/* motion-pack / templates / _shared / film / page.mjs: the HyperFrames page for the film templates (trailer, title-sequence, short-film), node side (2026-10-16, film lane).
     stageFilm(PROJ, plan)  -> { todo }   compose.stage() + the film fonts (STIX Two Text), the plate module, and every footage file the plan uses (hard links into assets/)
     filmPage(plan, opts)   -> html       ONE director draw(t) on every hf-seek: the picture (placeholder plates on two canvases, or YOUR footage as native HyperFrames <video>
                                          clips), the genre finish on the picture wrapper only (grade + halation (+ ink) SVG filters, gate weave, flicker: layers/film.js), overlay
                                          canvases under the type (vignette, anamorphic flares) and over it (film burns, dust, grain), the gfx type items, the letterbox bars and the
                                          honesty labels (a persistent "placeholder footage · fictional film" pill + the slot label on every placeholder shot).
   The plan shape (what a template's buildPlan returns): { W, H, fps, seconds, genre, finish: { over }, bars: px | 0, shots: [{ id, start, dur, kind: 'plate'|'media'|'black'|'card', plate, plateParams,
     mediaStart, src, focus, label, tx, txDur }], gfx: [{ id, at, dur, params }], burns: [{ at, dur, from, ... }], flares: [{ at, dur, ... }], flashes: [t], labels: { film, slots: bool }, layers: { grain, dust, vignette } }.
   Transitions the director plays itself (exact, DOM): cut, dissolve (crossfade of txDur centred on the cut), dip-to-black (out over the first half, in over the second), flash (a white
   frame peaking on the cut, <= 3 per second), filmBurn (a crossfade hidden under the canvas burn, whose coverage peaks ON the cut). Their sounds are plan cues (sfx ids). */
import fs from 'node:fs'; import path from 'node:path';
import { stage, head, esc } from '../compose.mjs';
const SH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), PACK = path.resolve(SH, '..', '..');
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
export const mediaName = (src) => 'm-' + path.basename(src).replace(/[^A-Za-z0-9._-]/g, '_');
export function stageFilm(PROJ, plan) {
  const st = stage(PROJ, { layers: true });
  for (const f of ['STIXTwoText.ttf', 'STIXTwoText-Italic.ttf']) link(path.join(SH, 'fonts', f), path.join(PROJ, 'assets', 'fonts', f));
  link(path.join(SH, 'film', 'plates.js'), path.join(PROJ, 'assets', 'mp', 'film', 'plates.js'));
  for (const s of plan.shots) if (s.kind === 'media') { if (!fs.existsSync(s.src)) throw new Error(`media ${s.id}: ${s.src} does not exist`); link(s.src, path.join(PROJ, 'assets', 'media', mediaName(s.src))); }
  return st;
}
const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
export function filmPage(plan, { title = 'motion-pack film' } = {}) {
  const { W, H, fps: F, seconds: T } = plan, bars = plan.bars || 0, L = plan.labels || {}, tall = H > W;
  const media = plan.shots.filter((s) => s.kind === 'media').map((s) => { const pre = s.pre || 0, post = s.post || 0, a = Math.max(0, s.start - pre), d = Math.min(T, s.start + s.dur + post) - a;
    return `<div class="w" id="w-${s.id}" style="opacity:0"><video id="v-${s.id}" class="clip fill" src="assets/media/${mediaName(s.src)}" muted playsinline data-start="${f3(a)}" data-duration="${f3(d)}" data-media-start="${f3(Math.max(0, (s.mediaStart || 0) - (s.start - a)))}" data-track-index="0" style="object-position:${Math.round((s.focus ?? 0.5) * 100)}% 50%"></video></div>`; }).join('\n');
  const css = `
#root { width: ${W}px; height: ${H}px; background: #000; }
#pic { position: absolute; inset: 0; overflow: hidden; background: #000; } #pic canvas, #pic .w { position: absolute; inset: 0; width: 100%; height: 100%; }
#fxLo, #fxHi { position: absolute; inset: 0; pointer-events: none; } #type { position: absolute; inset: 0; pointer-events: none; }
#flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.bar { position: absolute; left: 0; width: 100%; background: #000; height: ${bars}px; } #barT { top: 0; } #barB { bottom: 0; }
.pill { position: absolute; font: 600 ${Math.round((tall ? 30 : 28) * Math.min(W, H) / 1080)}px "IBM Plex Mono", monospace; color: rgba(255,255,255,0.78); letter-spacing: 0.06em; white-space: nowrap; }
#lab { ${bars >= 60 ? `left: 50%; transform: translateX(-50%); bottom: ${Math.round(bars / 2 - 16 * Math.min(W, H) / 1080)}px;` : tall ? `left: 65px; top: 284px;` : `left: 96px; bottom: 58px;`} }
#slot { ${bars >= 60 ? `left: 96px; top: ${bars + 22}px;` : tall ? `left: 65px; top: 330px;` : `left: 96px; top: 64px;`} color: rgba(255,255,255,0.72); font-size: ${Math.round((tall ? 30 : 28) * Math.min(W, H) / 1080)}px; opacity: 0; }`;
  const fontCss = `@font-face { font-family: "STIX Two Text"; src: url("assets/fonts/STIXTwoText.ttf") format("truetype"); font-style: normal; } @font-face { font-family: "STIX Two Text"; src: url("assets/fonts/STIXTwoText-Italic.ttf") format("truetype"); font-style: italic; }`;
  const LAY = plan.layers || {}, lo = [{ kind: 'vignette', params: { amount: LAY.vignette ?? 0.22 } }, ...(plan.flares || []).map((p) => ({ kind: 'anamorphicFlare', params: p }))];
  const hi = [...(plan.burns || []).map((p) => ({ kind: 'filmBurn', params: p })), ...(LAY.dust ? [{ kind: 'dust', params: { density: LAY.dust } }] : []), ...(LAY.grain && LAY.grain !== 'none' ? [{ kind: 'grain', params: { stock: LAY.grain } }] : [])];
  return `${head({ W, H, title: esc(title), bg: '#000', css: fontCss + css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="1"><div id="pic"><canvas id="pa" width="${W}" height="${H}"></canvas><canvas id="pb" width="${W}" height="${H}"></canvas>
${media}
</div><div id="fxLo"></div><div id="type"></div><div id="fxHi"></div><div id="flash"></div><div class="bar" id="barT"></div><div class="bar" id="barB"></div>
<div class="pill" id="slot"></div><div class="pill" id="lab">${esc(L.film || '')}</div></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { drawPlate } from './assets/mp/film/plates.js';
import { mountFilmFinish } from './assets/mp/layers/film.js';
import { mountStack } from './assets/mp/layers/overlay.js';
import { mountGfx } from './assets/mp/type/gfx/index.js';
const PLAN = ${JSON.stringify({ W, H, fps: F, seconds: T, genre: plan.genre, over: (plan.finish || {}).over || {}, shots: plan.shots.map(({ src, ...s }) => s), gfx: plan.gfx || [], flashes: plan.flashes || [], slots: L.slots !== false })};
const W = PLAN.W, H = PLAN.H, F = PLAN.fps, cv = [document.getElementById('pa'), document.getElementById('pb')], gx = cv.map((c) => c.getContext('2d'));
const pic = document.getElementById('pic'), flash = document.getElementById('flash'), slot = document.getElementById('slot');
const fin = mountFilmFinish(pic, PLAN.genre, { W, H, fps: F, seed: 7, over: PLAN.over });
const lo = mountStack(document.getElementById('fxLo'), ${JSON.stringify(lo)}, { width: W, height: H, fps: F, seed: 5 });
const hi = mountStack(document.getElementById('fxHi'), ${JSON.stringify(hi)}, { width: W, height: H, fps: F, seed: 9 });
const gfx = mountGfx(document.getElementById('type'), PLAN.gfx, { W, H, seed: 3 });
const wraps = Object.fromEntries(PLAN.shots.filter((s) => s.kind === 'media').map((s) => [s.id, document.getElementById('w-' + s.id)]));
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/* a shot's visibility at t: 1 inside it; across a soft boundary (dissolve, filmBurn) the incoming shot rises over the window centred on its start; a dip goes through black */
function alphaOf(i, t) {
  const s = PLAN.shots[i], n = PLAN.shots[i + 1], e = s.start + s.dur;
  const soft = (x) => x && (x.txKind === 'dissolve' || x.txKind === 'filmBurn'), dip = (x) => x && x.txKind === 'dip';
  let a = t >= s.start && t < e ? 1 : 0;
  if (soft(s)) { const h = s.txDur / 2; if (t >= s.start - h && t < s.start + h) a = sm((t - (s.start - h)) / s.txDur); }
  if (soft(n)) { const h = n.txDur / 2; if (t >= e - h && t < e + h) a = 1; }
  if (dip(s)) { const h = s.txDur / 2; if (t >= s.start && t < s.start + h) a = sm((t - s.start) / h); }
  if (dip(n)) { const h = n.txDur / 2; if (t >= e - h && t < e) a = 1 - sm((t - (e - h)) / h); }
  return a;
}
let lastSlot = '';
function draw(t) {
  const act = []; for (let i = 0; i < PLAN.shots.length; i++) { const a = alphaOf(i, t); if (a > 0.001) act.push([i, a]); }
  const used = [false, false];
  for (const [i, a] of act) { const s = PLAN.shots[i];
    if (s.kind === 'plate') { const k = i % 2; used[k] = true; drawPlate(gx[k], s.plate, W, H, t - s.start + (s.mediaStart || 0), s.plateParams); cv[k].style.opacity = String(a); cv[k].style.zIndex = String(i); }
    if (s.kind === 'media') { wraps[s.id].style.opacity = String(a); wraps[s.id].style.zIndex = String(i); } }
  for (let k = 0; k < 2; k++) if (!used[k]) cv[k].style.opacity = '0';
  for (const s of PLAN.shots) if (s.kind === 'media' && !act.some(([i]) => PLAN.shots[i].id === s.id)) wraps[s.id].style.opacity = '0';
  let fl = 0; for (const c of PLAN.flashes) { const d = (t - c) * F; if (d > -2 && d < 4) fl = Math.max(fl, d <= 0 ? (d + 2) / 2 : 1 - d / 4); } flash.style.opacity = String(Math.min(0.85, fl));
  const top = act.length ? PLAN.shots[(act.filter((x) => x[1] >= 0.5).pop() || act[act.length - 1])[0]] : null, lab = PLAN.slots && top && top.kind === 'plate' && top.label ? 'PLACEHOLDER · ' + top.label : '';
  if (lab !== lastSlot) { slot.textContent = lab; slot.style.opacity = lab ? '1' : '0'; lastSlot = lab; }
  fin.render(t); lo.render(t, { frame: Math.round(t * F) }); hi.render(t, { frame: Math.round(t * F) }); gfx.render(t);
}
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => draw((last = e.detail.time))); draw(last); window.__seek = (t) => draw((last = t));
Promise.all(['200', '300', '400', '600', '700', '800'].map((w) => document.fonts.load(w + ' 40px Manrope')).concat([document.fonts.load('600 20px "IBM Plex Mono"'), document.fonts.load('400 40px "STIX Two Text"')])).then(() => { draw(last); window.__ready = true; });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T}); window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
}
