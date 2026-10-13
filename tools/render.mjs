#!/usr/bin/env node
/* motion-pack render driver (tools/render.mjs): headless Chrome on the real GPU -> 4-subframe supersampled frames -> raw RGBA streamed to ffmpeg.
   Never writes a PNG sequence (only the stills you name).

   usage:
     node render.mjs <page.html> <out.mp4> [seconds] [fps] [size] [--start F] [--stills 0,84,112] [--stills-dir DIR] [--crf 12]
     node render.mjs <page.html> --qa <qa.json>          determinism + seam + console check, no video
     node render.mjs <page.html> <any.mp4> 0 0 [size] --stills-only --stills 84,112 [--stills-dir DIR]   PNG stills only (fps 0 or omitted = the page CONFIG.fps)
   options: --query "w=1080&h=1920&dolly=1.75" (extra page URL params), --chrome PATH, --allow-software (skip the GPU refusal; for debugging only), --min-free-gib 6

   Page contract (both templates implement it): window.CONFIG {fps, loopFrames, width, height, qaFrames}, window.__ready,
   window.__error, window.__gpu, window.renderAt(t), window.renderFrame(n, fps), window.captureFrame(n, fps) -> base64 RGBA
   (top row first), window.__hashFrame(n, fps), window.__hashAt(t). The page is opened with ?t=0&norun=1&size=S. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import os from 'node:os';
import { spawn, execSync } from 'node:child_process'; import { findPuppeteer, findChrome, chromeArgs } from './chrome.mjs';

const argv = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; flags[k] = v; } else pos.push(argv[i]); }
if (!pos[0]) { console.error('usage: node render.mjs <page.html> <out.mp4> [seconds] [fps] [size] [--stills a,b] [--start F] | <page.html> --qa qa.json'); process.exit(64); }
const HTML = path.resolve(pos[0]), QA = flags.qa ? path.resolve(flags.qa) : null, OUT = QA ? null : path.resolve(pos[1] || 'out/video.mp4');
const PROJ = path.dirname(QA || OUT);

let CHROME; try { CHROME = findChrome(flags.chrome); } catch (e) { console.error(e.message); process.exit(65); }

/* ---- disk guard: stop before a render fills the disk ---- */
function freeGiB() { try { const l = execSync('df -k .').toString().trim().split('\n').pop().split(/\s+/); return Number(l[3]) / 1048576; } catch { return -1; } }
const minFree = Number(flags['min-free-gib'] || 6), free = freeGiB();
console.log(`disk free ${free.toFixed(1)} GiB`);
if (free >= 0 && free < minFree) { console.error(`under ${minFree} GiB free: stopping before render`); process.exit(3); }

/* ---- static server rooted at the page's folder ---- */
const ROOT = path.dirname(HTML), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

/* ---- Chrome: fresh profile under the project's tmp/, headless, hardware WebGL (ANGLE Metal on macOS) ---- */
const puppeteer = findPuppeteer(), UDD = path.join(PROJ, 'tmp', `chrome-${process.pid}`); fs.mkdirSync(UDD, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: UDD, protocolTimeout: 1800000,
  args: chromeArgs() });
const cleanup = async () => { try { await browser.close(); } catch {} server.close(); try { fs.rmSync(UDD, { recursive: true, force: true }); fs.rmdirSync(path.join(PROJ, 'tmp')); } catch {} };   // rmdir only succeeds if tmp/ is empty
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + ((r.failure() && r.failure().errorText) || '')));
const sizeQ = (pos[4] ? `&size=${pos[4]}` : '') + (flags.query ? '&' + flags.query : '');     // --query "w=1080&h=1920&dolly=1.75": template URL params (a 9:16 reframe)
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(HTML))}?t=0&norun=1${sizeQ}`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__ready === true', { timeout: 900000, polling: 250 });
const err = await page.evaluate('window.__error || null');
if (err) { console.error('page error:', err); await cleanup(); process.exit(4); }
const gpu = await page.evaluate('window.__gpu'), cfg = await page.evaluate('({fps: CONFIG.fps, loopFrames: CONFIG.loopFrames, width: CONFIG.width, height: CONFIG.height, qaFrames: CONFIG.qaFrames || [], name: CONFIG.name})');
console.log(`GPU: ${gpu} | ready in ${((Date.now() - t0) / 1000).toFixed(1)} s | ${cfg.width}x${cfg.height} ${cfg.fps} fps loop ${cfg.loopFrames} frames`);
const software = /SwiftShader|llvmpipe|software|Basic Render/i.test(gpu) || !/Apple|Metal|NVIDIA|AMD|Radeon|Intel/i.test(gpu);
if (software && !flags['allow-software']) { console.error('WebGL is NOT on the hardware GPU (renderer string above): refusing to render. Check the GPU flags in tools/chrome.mjs, or pass --allow-software for a debug render.'); await cleanup(); process.exit(2); }

const W = cfg.width, H = cfg.height;
const fps = Number(pos[3]) > 0 ? Number(pos[3]) : cfg.fps, NF = Math.round(cfg.loopFrames / cfg.fps * fps);
const grab = async n => Buffer.from(await page.evaluate((n, fps) => window.captureFrame(n, fps), n, fps), 'base64');
function mad(a, b) { let s = 0, c = 0; for (let i = 0; i < a.length; i += 28) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); c += 3; } return s / c; }
function png(w, h, rgba) {          // top-down RGBA -> RGB PNG (QA stills only)
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1), s = y * w * 4; for (let x = 0; x < w; x++) { raw[o + 1 + x * 3] = rgba[s + x * 4]; raw[o + 2 + x * 3] = rgba[s + x * 4 + 1]; raw[o + 3 + x * 3] = rgba[s + x * 4 + 2]; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

let exitCode = 0;
if (QA) {
  /* determinism, periodicity, seam, console */
  const mid = Math.floor(NF / 2) + 7, r = {};
  r.gpu = gpu; r.config = cfg;
  const h1 = await page.evaluate((n, f) => window.__hashFrame(n, f), mid, fps), h2 = await page.evaluate((n, f) => window.__hashFrame(n, f), mid, fps);
  r.same_frame_twice = { frame: mid, a: h1.slice(0, 16), b: h2.slice(0, 16), pass: h1 === h2 };
  const L = cfg.loopFrames / cfg.fps, a0 = await page.evaluate(t => window.__hashAt(t), 0), aL = await page.evaluate(t => window.__hashAt(t), L);
  r.renderAt_0_vs_loop = { a: a0.slice(0, 16), b: aL.slice(0, 16), pass: a0 === aL };
  const tq = 1.2345, q1 = await page.evaluate(t => window.__hashAt(t), tq), q2 = await page.evaluate(t => window.__hashAt(t), tq + 3 * L);
  r.renderAt_t_vs_t_plus_3loops = { t: tq, pass: q1 === q2 };
  const f0 = await page.evaluate((n, f) => window.__hashFrame(n, f), 0, fps), fN = await page.evaluate((n, f) => window.__hashFrame(n, f), NF, fps);
  r.frame0_vs_frameN = { a: f0.slice(0, 16), b: fN.slice(0, 16), pass: f0 === fN };
  const fr = {}; for (const n of [NF - 3, NF - 2, NF - 1, 0, 1, 2]) fr[n] = await grab(n);
  const d = { [`${NF - 3}->${NF - 2}`]: mad(fr[NF - 3], fr[NF - 2]), [`${NF - 2}->${NF - 1}`]: mad(fr[NF - 2], fr[NF - 1]), [`${NF - 1}->0 (seam)`]: mad(fr[NF - 1], fr[0]), '0->1': mad(fr[0], fr[1]), '1->2': mad(fr[1], fr[2]) };
  const nb = Object.entries(d).filter(([k]) => !k.includes('seam')).map(([, v]) => v), seam = d[`${NF - 1}->0 (seam)`];
  r.seam_mean_abs_diff = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, +v.toFixed(3)]));
  r.seam_pass = seam <= 1.5 * Math.max(...nb) + 0.05;
  r.console = errors; r.console_pass = errors.length === 0;
  r.pass = r.same_frame_twice.pass && r.renderAt_0_vs_loop.pass && r.renderAt_t_vs_t_plus_3loops.pass && r.frame0_vs_frameN.pass && r.seam_pass && r.console_pass;
  fs.mkdirSync(path.dirname(QA), { recursive: true }); fs.writeFileSync(QA, JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1)); exitCode = r.pass ? 0 : 1;
} else if (flags['stills-only']) {
  /* QA stills only: render the named frames (4-subframe average, exactly as in the video) to PNG, no encode */
  const list = String(flags.stills || '').split(',').filter(Boolean).map(Number), sdir = path.resolve(flags['stills-dir'] || path.join(PROJ, 'qa'));
  if (!list.length || list.length > 60) { console.error('--stills-only needs 1..60 frames in --stills'); await cleanup(); process.exit(64); }
  fs.mkdirSync(sdir, { recursive: true });
  for (const n of list) { const ts = Date.now(), b = await grab(n); fs.writeFileSync(path.join(sdir, `f${String(n).padStart(4, '0')}.png`), png(W, H, b)); console.log(`still ${n} ${((Date.now() - ts) / 1000).toFixed(2)} s`); }
  console.log('console errors/warnings:', errors.length ? errors.join('\n') : 'none'); exitCode = errors.length ? 1 : 0;
} else {
  const seconds = Number(pos[2] || cfg.loopFrames / cfg.fps), count = Math.round(seconds * fps), start = Number(flags.start || 0);
  const stills = new Set(String(flags.stills || '').split(',').filter(Boolean).map(Number)), sdir = path.resolve(flags['stills-dir'] || path.join(PROJ, 'qa'));
  if (stills.size > 60) { console.error('more than 60 stills requested: use a contact sheet instead'); await cleanup(); process.exit(64); }
  if (stills.size) fs.mkdirSync(sdir, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(flags.crf || 12),
    '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-r', String(fps), '-frames:v', String(count), '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r)); let ffErr = null; ff.stdin.on('error', e => { ffErr = e; });
  const diffs = []; let prev = null, first = null; const ts = Date.now();
  for (let i = 0; i < count; i++) {
    const n = start + i, b = await grab(n);
    if (b.length !== W * H * 4) throw new Error(`frame ${n}: got ${b.length} bytes, want ${W * H * 4}`);
    if (prev) diffs.push(+mad(prev, b).toFixed(4)); else first = b;
    if (stills.has(n)) fs.writeFileSync(path.join(sdir, `f${String(n).padStart(4, '0')}.png`), png(W, H, b));
    if (ffErr) throw ffErr;
    if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
    prev = b;
    if (i % 30 === 0) console.log(`frame ${n}  ${((Date.now() - ts) / 1000).toFixed(1)} s`);
  }
  ff.stdin.end(); const code = await done;
  const fullLoop = start === 0 && count === NF, seam = fullLoop ? +mad(prev, first).toFixed(4) : null, sorted = [...diffs].sort((a, b) => a - b);
  const rep = { out: OUT, frames: count, start, fps, width: W, height: H, gpu, seconds_render: (Date.now() - ts) / 1000, median_diff: sorted[sorted.length >> 1] ?? null, seam_last_to_first: seam,
    neighbours: fullLoop ? [diffs[NF - 3], diffs[NF - 2], diffs[0], diffs[1]] : null, diffs, console: errors, ffmpeg_exit: code };
  fs.writeFileSync(OUT.replace(/\.mp4$/, '') + '.frames.json', JSON.stringify(rep));
  console.log(`encoded ${count} frames in ${rep.seconds_render.toFixed(1)} s -> ${OUT} (ffmpeg exit ${code})` + (fullLoop ? ` | seam diff ${seam} vs neighbours ${rep.neighbours.join(' / ')} (median ${rep.median_diff})` : ''));
  console.log('console errors/warnings:', errors.length ? errors.join('\n') : 'none');
  exitCode = code === 0 && errors.length === 0 ? 0 : 1;
}
await cleanup();
process.exit(exitCode);
