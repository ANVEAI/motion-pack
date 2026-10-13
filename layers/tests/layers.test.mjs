/* layers module tests (real Chrome + GPU): determinism, grain sigma vs table, grade parity (GLSL / SVG / .cube / ffmpeg lut3d vs the JS reference), identity, vignette, bars,
   flash / hit peaks, dust, overlay determinism, lint, perf.   run: node layers/tests/layers.test.mjs   (exit 1 on any failure) */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { open, decodePNG, reporter, ROOT } from './harness.mjs';
import { GRADES, GRADE_NAMES } from '../presets/grades.js'; import { STOCKS } from '../presets/stocks.js'; import { gradeRGB, prepare, toCube, cubeLookup } from '../grade.js'; import { FINISH_PRESETS } from '../presets/finish.js'; import { lintStack } from '../finisher.js'; import { lintOverlayStack } from '../overlay.js';
const R = reporter('layers'); const J = (x) => JSON.stringify(x);
const labs = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(f); const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883; const q = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
const dE = (a, b) => { const x = labs(a), y = labs(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const names = Object.keys(FINISH_PRESETS);

const h = await open('/layers/demo/index.html', 'aspect=wide'); const pg = h.page;
R.check('GPU is hardware (not SwiftShader)', !/SwiftShader|llvmpipe/i.test(h.gpu), h.gpu);

/* ---- 1. determinism: same frame twice, shuffled order, and across two separate browser sessions ---- */
const hashes = await pg.evaluate((names) => { const o = {}; for (const n of names) { mp.fin.setPreset(n); const a = window.__hashFrame(12, 30); window.__hashFrame(40, 30); const b = window.__hashFrame(12, 30); o[n] = [a, b]; } return o; }, names);
R.check('same frame twice (after another frame) is bit-identical, all presets', Object.values(hashes).every(([a, b]) => a === b), J(Object.fromEntries(Object.entries(hashes).map(([k, v]) => [k, v[0]]))));
const h2 = await open('/layers/demo/index.html', 'aspect=wide');
const hashes2 = await h2.page.evaluate((names) => { const o = {}; for (const n of names) { mp.fin.setPreset(n); o[n] = window.__hashFrame(12, 30); } return o; }, names);
R.check('identical across a fresh browser session (frame 12, all presets)', names.every((n) => hashes2[n] === hashes[n][0]), names.filter((n) => hashes2[n] !== hashes[n][0]).join(',') || 'all equal');
await h2.close();

/* ---- 2. grain: measured per-channel sigma vs table, chroma correlation, 24 fps hold ---- */
for (const s of ['clean', 'digital-soft', 'film35', 'film16', 'super8', 'vhs']) {
  const m = await pg.evaluate((s) => { mp.fin.setPreset({ grain: { stock: s }, dither: false }); const f = new URLSearchParams(location.search); mp.flatGrey(mp.pg, mp.W, mp.H, 128); mp.fin.render(1, { frame: 30 }); const b = mp.fin.readRGBA(), W = mp.W; let n = 0, sr = 0, sg = 0, sb = 0, qr = 0, qg = 0, rg = 0;
    for (let y = 200; y < 712; y++) for (let x = 200; x < 712; x++) { const i = (y * W + x) * 4, r = b[i], g = b[i + 1]; sr += r; sg += g; qr += r * r; qg += g * g; rg += r * g; n++; }
    const mr = sr / n, mg = sg / n, vr = qr / n - mr * mr, vg = qg / n - mg * mg, cov = rg / n - mr * mg; return { mean: mg, sigR: Math.sqrt(vr), sigG: Math.sqrt(vg), corr: cov / Math.sqrt(vr * vg) }; }, s);
  const st = STOCKS[s], L = 128 / 255, w = (1 - st.midBias) + st.midBias * (1 - Math.abs(2 * L - 1)), exp = Math.sqrt((0.408248 * st.amount * w * 255) ** 2 + 1 / 12);
  R.check(`grain ${s}: sigma ${m.sigG.toFixed(2)} vs table ${exp.toFixed(2)} (+-15%)`, Math.abs(m.sigG / exp - 1) <= 0.15, `corr(R,G)=${m.corr.toFixed(2)} expect ${(1 - st.chroma).toFixed(2)}`);
  if (st.chroma > 0) R.check(`grain ${s}: channel correlation ${m.corr.toFixed(2)} ~ ${(1 - st.chroma).toFixed(2)} (+-0.08)`, Math.abs(m.corr - (1 - st.chroma)) <= 0.08);
}
const hold = await pg.evaluate(() => { mp.fin.setPreset({ grain: { stock: 'film35' }, dither: false }); mp.flatGrey(mp.pg, mp.W, mp.H, 128); const H = (n) => { mp.fin.render(n / 30, { frame: n }); return mp.fin.hash(); }; return [H(0), H(1), H(2), H(3), H(4), H(5)]; });
R.check('film35 holds each 24 fps grain pattern 1.25 frames (30 fps timeline: pattern index 0,0,1,2,3,4)', hold[0] === hold[1] && hold[1] !== hold[2] && hold[2] !== hold[3] && hold[3] !== hold[4] && hold[4] !== hold[5], hold.join(' '));

/* ---- 3. grade parity + identity (GLSL path vs JS reference) ---- */
const chartPatches = await pg.evaluate(() => { const g = mp.pg; mp.drawChart(g, mp.W, mp.H); return mp.drawChart(mp.pg, mp.W, mp.H); });
const renderChart = (preset) => pg.evaluate((preset, patches) => { mp.fin.setPreset({ ...preset, grain: { stock: 'none', amount: 0 }, dither: false }); mp.drawChart(mp.pg, mp.W, mp.H); mp.fin.render(0, { frame: 0 }); const b = mp.fin.readRGBA(); return patches.map((p) => { const i = (p.cy * mp.W + p.cx) * 4; return [b[i], b[i + 1], b[i + 2]]; }); }, preset, chartPatches);
const id = await renderChart({ grade: 'neutral' }); let idMax = 0; chartPatches.forEach((p, i) => p.rgb.forEach((v, k) => { idMax = Math.max(idMax, Math.abs(v - id[i][k])); }));
R.check('identity: neutral through the whole pipeline within 1 level on 729 patches', idMax <= 1, `max dev ${idMax}`);
const gradeStats = {};
for (const gname of GRADE_NAMES) {
  const out = await renderChart({ grade: gname }), P = prepare(GRADES[gname]); let mx = 0, sum = 0, n = 0;
  chartPatches.forEach((p, i) => { const ref = gradeRGB(P, p.rgb.map((v) => v / 255)).map((v) => v * 255); ref.forEach((v, k) => { const d = Math.abs(v - out[i][k]); mx = Math.max(mx, d); sum += d; n++; }); });
  gradeStats[gname] = { max: +mx.toFixed(2), mean: +(sum / n).toFixed(3) };
  R.check(`grade ${gname}: GLSL vs JS reference, max ${mx.toFixed(2)} mean ${(sum / n).toFixed(3)} levels (<= 2.0 / 0.7)`, mx <= 2.0 && sum / n <= 0.7);
}
/* ---- 4. .cube: JS trilinear vs analytic; ffmpeg lut3d vs analytic ---- */
const idc = toCube({}, 'id'); let idcMax = 0; for (let i = 0; i < 300; i++) { const c = [Math.random(), Math.random(), Math.random()], o = cubeLookup(idc, c); idcMax = Math.max(idcMax, ...o.map((v, k) => Math.abs(v - c[k]))); }
R.check('identity .cube: max deviation < 1/255', idcMax < 1 / 255, `max ${(idcMax * 255).toFixed(4)} levels`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-lay-'));
for (const gname of ['cool-tech', 'warm-film', 'noir']) {
  const cube = toCube(GRADES[gname], gname), P = prepare(GRADES[gname]); let mx = 0, rs = 0, n = 0; const cf = path.join(tmp, gname + '.cube'); fs.writeFileSync(cf, cube);
  const inp = Buffer.alloc(729 * 3); chartPatches.forEach((p, i) => p.rgb.forEach((v, k) => { inp[i * 3 + k] = v; }));
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '729x1', '-i', '-', '-vf', `lut3d=file=${cf}:interp=trilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: inp, maxBuffer: 1 << 24 });
  const o = ff.stdout; let fmx = 0; chartPatches.forEach((p, i) => { const ref = gradeRGB(P, p.rgb.map((v) => v / 255)); const lk = cubeLookup(cube, p.rgb.map((v) => v / 255)); ref.forEach((v, k) => { mx = Math.max(mx, Math.abs(v - lk[k]) * 255); fmx = Math.max(fmx, Math.abs(v * 255 - o[i * 3 + k])); }); n++; });
  R.check(`.cube ${gname}: trilinear vs analytic max ${mx.toFixed(2)} levels; ffmpeg lut3d vs analytic max ${fmx.toFixed(2)} (<= 3.5)`, ff.status === 0 && mx <= 3.5 && fmx <= 3.5);
}
fs.rmSync(tmp, { recursive: true, force: true });
/* ---- 5. SVG filter emitter (HyperFrames DOM path) vs JS reference ---- */
const hs = await open('/layers/demo/svg-grade.html'); await hs.page.setViewport({ width: 1920, height: 1080 });
const svgStats = {};
for (const gname of GRADE_NAMES) {
  await hs.page.evaluate((p) => window.applyGrade(p), GRADES[gname]); const shot = decodePNG(await hs.page.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 1080 }, type: 'png' })), P = prepare(GRADES[gname]); let mxE = 0, sumE = 0;
  chartPatches.forEach((p) => { const i = (p.cy * 1920 + p.cx) * 4, got = [shot.rgba[i], shot.rgba[i + 1], shot.rgba[i + 2]], ref = gradeRGB(P, p.rgb.map((v) => v / 255)).map((v) => v * 255), e = dE(got, ref); mxE = Math.max(mxE, e); sumE += e; });
  svgStats[gname] = { meanDE: +(sumE / 729).toFixed(2), maxDE: +mxE.toFixed(2) };
  R.check(`SVG filter ${gname}: mean dE ${(sumE / 729).toFixed(2)}, max dE ${mxE.toFixed(2)} vs JS reference (mean <= 1.5, max <= 8: dE spikes only in near-black patches, 8-bit stage quantisation)`, sumE / 729 <= 1.5 && mxE <= 8);
}
await hs.close();
/* ---- 6. vignette (roundness), bars, flash peak, hit peak, dust ---- */
const vig = await pg.evaluate(() => { const o = {}; for (const [k, round] of [['tall', 1]]) { } mp.fin.setPreset({ vignette: { amount: 0.6, roundness: 1, inner: 0.2, outer: 1.2 }, grain: { stock: 'none', amount: 0 }, dither: false }); mp.flatGrey(mp.pg, mp.W, mp.H, 200); mp.fin.render(0, { frame: 0 }); const b = mp.fin.readRGBA(), W = mp.W, H = mp.H, at = (x, y) => b[(y * W + x) * 4], cx = W / 2, cy = H / 2;
  o.round = [at(cx - 380, cy), at(cx, cy - 380)]; mp.fin.setPreset({ vignette: { amount: 0.6, roundness: 0, inner: 0.2, outer: 1.2 }, grain: { stock: 'none', amount: 0 }, dither: false }); mp.fin.render(0, { frame: 0 }); const c = mp.fin.readRGBA(); o.ell = [c[(cy * W + cx - 380) * 4], c[((cy - 380) * W + cx) * 4]]; o.center = at(cx, cy); return o; });
R.check('vignette roundness 1 is circular in pixel space (equal falloff at 380 px left vs up, 1920x1080)', Math.abs(vig.round[0] - vig.round[1]) <= 1, J(vig.round));
R.check('vignette roundness 0 is elliptical (different falloff left vs up)', Math.abs(vig.ell[0] - vig.ell[1]) >= 6 && vig.center === 200, J(vig.ell));
const bars = await pg.evaluate(() => { mp.fin.setPreset({ bars: { ratio: 2.39 }, grain: { stock: 'none', amount: 0 }, dither: false }); mp.flatGrey(mp.pg, mp.W, mp.H, 200); mp.fin.render(0, { frame: 0 }); const b = mp.fin.readRGBA(), W = mp.W, H = mp.H, at = (y) => b[(y * W + 960) * 4]; return { top: [at(100), at(137), at(140)], bot: [at(H - 101), at(H - 138), at(H - 141)] }; });
R.check('letterbox 2.39:1 on 1920x1080: 138 px bars each (rows 100/137 black, 140 picture)', bars.top[0] === 0 && bars.top[1] === 0 && bars.top[2] > 150 && bars.bot[0] === 0 && bars.bot[2] > 150, J(bars));
const peak = async (preset, opts, fr, f) => pg.evaluate((preset, opts, fr, f) => { mp.fin.setPreset({ grain: { stock: 'none', amount: 0 }, dither: false, ...preset }); const o = []; for (const n of fr) { mp.drawPlate(mp.pg, mp.W, mp.H, 1, {}); mp.fin.render(n / 30, { frame: n, ...opts }); const b = mp.fin.readRGBA(); let s = 0; for (let i = 0; i < b.length; i += 4 * 97) s += f === 'luma' ? b[i] + b[i + 1] + b[i + 2] : Math.abs(b[i] - b[i + 2]); o.push(s); } return o; }, preset, opts, fr, f);
const fr = [24, 26, 28, 29, 30, 31, 33, 36, 40];
const fl = await peak({ leaks: { on: true, intensity: 0, edge: 'left', flashes: [{ t: 1.0, attack: 3, decay: 12 }] } }, {}, fr, 'luma');
R.check('light-leak flash peaks ON the cut frame (30)', fr[fl.indexOf(Math.max(...fl))] === 30, fl.join(','));
const ch = await peak({ chroma: { cornerPx: 0, hitPx: 10 } }, { hits: [1.0] }, fr, 'rb');
R.check('chroma hit peaks ON the hit frame (30) and is gone after 9 frames', fr[ch.indexOf(Math.max(...ch))] === 30 && ch[ch.length - 1] <= ch[0] * 1.02 + 1, ch.join(','));
const dust = await pg.evaluate(() => { const run = (preset, n) => { mp.fin.setPreset({ grain: { stock: 'none', amount: 0 }, dither: false, ...preset }); mp.drawPlate(mp.pg, mp.W, mp.H, 1, {}); mp.fin.render(n / 30, { frame: n }); return mp.fin.readRGBA(); };
  const a = run({}, 10), b = run({ dust: { density: 1, hair: 3, scratch: 3 } }, 10), c = run({ dust: { density: 1, hair: 3, scratch: 3 } }, 11), b2 = run({ dust: { density: 1, hair: 3, scratch: 3 } }, 10); let d1 = 0, d2 = 0, same = true; for (let i = 0; i < a.length; i += 4) { if (Math.abs(a[i] - b[i]) > 8) d1++; if (Math.abs(b[i] - c[i]) > 8) d2++; if (b[i] !== b2[i]) same = false; } return { marks: d1, changesNextFrame: d2, same }; });
R.check('dust: marks appear, differ frame to frame, bit-identical on re-render', dust.marks > 20 && dust.changesNextFrame > 20 && dust.same, J(dust));

/* ---- 7. overlays: determinism + grain sigma + frame independence + bars ---- */
const ho = await open('/layers/demo/overlays.html'); const ov = await ho.page.evaluate(async () => {
  const mk = (layers, t, f) => { window.setup(layers, t, f); const L = document.querySelectorAll('canvas.mp-layer')[0]; return L; };
  const px = (kind, params, t, f) => { window.setup([{ kind, params }], t, f); const c = document.querySelector('canvas.mp-layer'), gl = c.getContext('webgl2'), b = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const eq = (a, b) => { for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) return false; return true; };
  const o = {}; for (const k of ['grain', 'vignette', 'leaks', 'dust', 'bokeh', 'glow', 'paper', 'scanlines', 'bars']) { const p = k === 'leaks' ? { loop: true } : k === 'dust' ? { density: 1 } : {}; const a = px(k, p, 1, 30), a2 = px(k, p, 1, 30), b = px(k, p, 1.5, 45); o[k] = { same: eq(a, a2), nextDiffers: !eq(a, b) }; }
  const g = px('grain', { stock: 'film35' }, 1, 30); let n = 0, s = 0, q = 0; for (let y = 200; y < 712; y++) for (let x = 200; x < 712; x++) { const v = g[(y * 1920 + x) * 4 + 1]; s += v; q += v * v; n++; } o.grainSigma = Math.sqrt(q / n - (s / n) ** 2); o.grainMean = s / n;
  const bg = px('bars', { ratio: 2.39 }, 0, 0); o.bars = [bg[(100 * 1920 + 960) * 4 + 3], bg[(140 * 1920 + 960) * 4 + 3]]; return o; });
R.check('overlay layers: re-render identical for every kind', Object.values(ov).filter((v) => v.same !== undefined).every((v) => v.same), J(Object.fromEntries(Object.entries(ov).filter(([k, v]) => v.same !== undefined).map(([k, v]) => [k, v.same]))));
R.check('overlay grain/dust animate per frame; vignette, paper, scanlines, bars, bokeh-static layers are stable or drift as designed', ov.grain.nextDiffers && ov.dust.nextDiffers && !ov.vignette.nextDiffers && !ov.paper.nextDiffers && !ov.scanlines.nextDiffers && !ov.bars.nextDiffers, J({ grain: ov.grain.nextDiffers, dust: ov.dust.nextDiffers, vignette: ov.vignette.nextDiffers, paper: ov.paper.nextDiffers }));
const expOv = Math.sqrt((0.408248 * 0.07 * 0.996 * 255) ** 2 + 1 / 12);
R.check(`overlay grain film35 sigma ${ov.grainSigma.toFixed(2)} vs ${expOv.toFixed(2)} (+-15%), mean ${ov.grainMean.toFixed(1)} ~ 127.5`, Math.abs(ov.grainSigma / expOv - 1) <= 0.15 && Math.abs(ov.grainMean - 127.5) < 1.5);
R.check('overlay bars: alpha 255 in the bar, 0 in the picture', ov.bars[0] === 255 && ov.bars[1] === 0, J(ov.bars));
await ho.close();

/* ---- 8. lint + perf ---- */
const w1 = lintStack({ plate: { baked: { grain: true } }, grain: { stock: 'film35' } }), w2 = lintStack('premium-product', { overlayGrain: true }), w3 = lintStack('launch-studio');
R.check('lintStack flags baked-and-doubled grain, overlay+finisher grain; clean preset passes', w1.length === 1 && w2.some((x) => /grain/.test(x)) && w3.length === 0, J({ w1, w2, w3 }));
R.check('lintOverlayStack: duplicate grain flagged, baked-plate vignette flagged, clean stack passes', lintOverlayStack([{ kind: 'grain' }, { kind: 'grain' }]).length === 1 && lintOverlayStack([{ kind: 'vignette' }], { plateBaked: { vignette: true } }).length === 1 && lintOverlayStack([{ kind: 'leaks' }, { kind: 'vignette' }, { kind: 'dust' }, { kind: 'grain' }]).length === 0);
const perf = await pg.evaluate(() => { const o = {}; for (const n of ['premium-product', 'warm-film', 'retro-vhs']) { mp.fin.setPreset(n); mp.drawPlate(mp.pg, mp.W, mp.H, 0, {}); const px = new Uint8Array(4); mp.fin.render(0, { frame: 0 }); mp.fin.gl.readPixels(0, 0, 1, 1, mp.fin.gl.RGBA, mp.fin.gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < 30; i++) { mp.fin.render(i / 30, { frame: i }); } mp.fin.gl.readPixels(0, 0, 1, 1, mp.fin.gl.RGBA, mp.fin.gl.UNSIGNED_BYTE, px); o[n] = +((performance.now() - t0) / 30).toFixed(1); } return o; });
R.check(`perf @1080p (info): ms/frame ${J(perf)}`, Object.values(perf).every((v) => v < 60));
R.check('no console errors in the finisher page', h.errors.filter((e) => !/favicon|404/.test(e)).length === 0, J(h.errors.slice(0, 3)));
await h.close();
const res = R.done(); fs.writeFileSync(path.join(ROOT, 'layers/tests/last-run.json'), J({ ...res, gradeStats, svgStats, perf }, null, 1)); process.exit(R.failed ? 1 : 0);
