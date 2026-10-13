#!/usr/bin/env node
/* spec-to-loop render driver: headless Chrome on the real GPU -> 4-subframe supersampled frames -> raw RGBA streamed to ffmpeg.
   Never writes a PNG sequence (only the stills you name).

   usage:
     node render.mjs <page.html> <out.mp4> [seconds] [fps] [size] [--start F] [--stills 0,84,112] [--stills-dir DIR] [--crf 12]
     node render.mjs <page.html> --qa <qa.json>          determinism + seam + console check, no video
     node render.mjs <page.html> <any.mp4> 0 0 [size] --stills-only --stills 84,112 [--stills-dir DIR]   PNG stills only (fps 0 or omitted = the page CONFIG.fps)
   options: --query "w=1080&h=1920&dolly=1.75" (extra page URL params), --chrome PATH, --angle metal|d3d11|vulkan|gl|default
            (ANGLE backend; default metal on macOS, d3d11 on Windows, Chrome's own choice on Linux), --allow-software (skip the GPU
            refusal; debugging only), --min-free-gib 6 (stop when the output volume has less free space)
   needs:   puppeteer-core (this folder's node_modules, the project's, NODE_PATH, the full puppeteer package, or the npx cache),
            Chrome or Chromium (--chrome, CHROME_PATH / PUPPETEER_EXECUTABLE_PATH, or a standard install), ffmpeg with libx264
            (on PATH, or FFMPEG=/path/to/ffmpeg).

   Page contract (the template implements it; every new template must): window.CONFIG {fps, loopFrames, width, height, qaFrames, name},
   window.__ready, window.__error, window.__gpu, window.renderAt(t), window.renderFrame(n, fps), window.captureFrame(n, fps) -> base64
   RGBA (top row first), window.__hashFrame(n, fps), window.__hashAt(t). The page is opened with ?t=0&norun=1&size=S.
   Exit status: 0 = every check passed, 1 = a check failed (console errors, ffmpeg, QA), 2 = software renderer, 3 = low disk,
   4 = page error, 64 = usage, 65 = a tool is missing. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import os from 'node:os';
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; flags[k] = v; } else pos.push(argv[i]); }
if (!pos[0]) { console.error('usage: node render.mjs <page.html> <out.mp4> [seconds] [fps] [size] [--stills a,b] [--start F] | <page.html> --qa qa.json'); process.exit(64); }
const HTML = path.resolve(pos[0]), QA = flags.qa ? path.resolve(flags.qa) : null, OUT = QA ? null : path.resolve(pos[1] || 'out/video.mp4');
const PROJ = path.dirname(QA || OUT), ROOT = path.dirname(HTML);
if (!fs.existsSync(HTML)) { console.error('no such page: ' + HTML); process.exit(64); }

/* ---- disk guard: renders and stills land next to the output; stop before the volume fills ---- */
function freeGiB(dir) {
  let d = path.resolve(dir); while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  try { const s = fs.statfsSync(d); return Number(s.bavail) * Number(s.bsize) / 2 ** 30; } catch { return -1; }
}
const minFree = Number(flags['min-free-gib'] ?? 6), free = freeGiB(PROJ);
console.log(`disk free ${free.toFixed(1)} GiB`);
if (free >= 0 && free < minFree) { console.error(`under ${minFree} GiB free: stopping before render (--min-free-gib changes the limit)`); process.exit(3); }

/* ---- tools: puppeteer-core and a Chrome ---- */
async function loadPuppeteer(bases) {
  for (const name of ['puppeteer-core', 'puppeteer']) {
    try { const m = await import(name); return m.default || m; } catch {}                                        // next to this script
    for (const b of bases) { try { const m = createRequire(path.join(b, 'noop.js'))(name); return m.default || m; } catch {} }   // the project, NODE_PATH
  }
  const caches = [process.env.npm_config_cache, path.join(os.homedir(), '.npm'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache')];
  let best = null;                                                                                                  // fallback: the newest copy in the npx cache
  for (const base of caches.filter(Boolean).map(c => path.join(c, '_npx'))) for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const pj = path.join(base, d, 'node_modules', 'puppeteer-core', 'package.json'); if (!fs.existsSync(pj)) continue;
    const v = JSON.parse(fs.readFileSync(pj, 'utf8')).version.split('.').map(Number), s = v[0] * 1e6 + v[1] * 1e3 + v[2];
    if (!best || s > best.s) best = { dir: path.join(base, d, 'node_modules'), s };
  }
  if (best) { const m = createRequire(best.dir + path.sep)('puppeteer-core'); return m.default || m; }
  console.error('puppeteer-core not found. Install it once, either next to these scripts or in your project:\n' +
    `  cd "${HERE}" && npm i puppeteer-core      (or: npm i puppeteer-core in the project folder)\n` +
    'or point NODE_PATH at a node_modules folder that has it.');
  process.exit(65);
}
async function findChrome(lib) {
  const home = os.homedir(), env = process.env, P = process.platform, list = [];
  if (P === 'darwin') for (const r of ['/Applications', path.join(home, 'Applications')]) list.push(
    path.join(r, 'Google Chrome.app/Contents/MacOS/Google Chrome'), path.join(r, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    path.join(r, 'Chromium.app/Contents/MacOS/Chromium'), path.join(r, 'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'));
  else if (P === 'win32') for (const r of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean)) list.push(
    path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(r, 'Chromium', 'Application', 'chrome.exe'));
  else list.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/google/chrome/chrome');
  const cft = path.join(home, '.cache', 'puppeteer', 'chrome');                                                       // Chrome for Testing fetched by puppeteer
  if (fs.existsSync(cft)) for (const d of fs.readdirSync(cft).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })))
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-win64/chrome.exe']) list.push(path.join(cft, d, rel));
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  for (const [src, p] of [['--chrome', flags.chrome], ['CHROME_PATH', env.CHROME_PATH], ['PUPPETEER_EXECUTABLE_PATH', env.PUPPETEER_EXECUTABLE_PATH]])
    if (typeof p === 'string' && p) { if (isFile(p)) return p; console.error(`${src} does not name a file: ${p}`); process.exit(65); }
  const hit = list.find(isFile); if (hit) return hit;
  try { const p = lib && typeof lib.executablePath === 'function' ? await lib.executablePath() : null; if (typeof p === 'string' && isFile(p)) return p; } catch {}   // the full puppeteer package's own Chrome
  return null;
}
const puppeteer = await loadPuppeteer([process.cwd(), ROOT]);
const CHROME = await findChrome(puppeteer);
if (!CHROME) { console.error('no Chrome or Chromium found: pass --chrome PATH or set CHROME_PATH'); process.exit(65); }
const ANGLE = String(flags.angle || (process.platform === 'darwin' ? 'metal' : process.platform === 'win32' ? 'd3d11' : 'default'));
const GPU_ARGS = [...(ANGLE !== 'default' ? [`--use-angle=${ANGLE}`] : []), '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

/* ---- static server rooted at the page's folder (relative font / asset URLs work) ---- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  let p; try { p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { res.writeHead(400); return res.end(); }
  if ((p !== ROOT && !p.startsWith(ROOT + path.sep)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

/* ---- Chrome: a fresh temporary profile (never the user's), headless, ANGLE on the hardware GPU ---- */
const UDD = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-to-loop-'));
let browser = null;
const cleanup = async () => { try { if (browser) await browser.close(); } catch {} server.close(); try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {} };   // removes only its own temp profile
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: UDD, protocolTimeout: 1800000,
    args: [...GPU_ARGS, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
} catch (e) { console.error('Chrome did not start (' + CHROME + '):', e.message); await cleanup(); process.exit(65); }

const errors = [];
let exitCode = 0;
try { exitCode = await main(); } catch (e) { console.error(e && e.stack || e); exitCode = 1; }
await cleanup();
process.exit(exitCode);

async function main() {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + ((r.failure() && r.failure().errorText) || '')));
  const sizeQ = (pos[4] ? `&size=${pos[4]}` : '') + (flags.query ? '&' + flags.query : '');     // --query "w=1080&h=1920&dolly=1.75": template URL params (a 9:16 reframe)
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(HTML))}?t=0&norun=1${sizeQ}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.__ready === true', { timeout: 900000, polling: 250 });
  const err = await page.evaluate('window.__error || null');
  if (err) { console.error('page error:', err); return 4; }
  const gpu = await page.evaluate('window.__gpu'), cfg = await page.evaluate('({fps: CONFIG.fps, loopFrames: CONFIG.loopFrames, width: CONFIG.width, height: CONFIG.height, qaFrames: CONFIG.qaFrames || [], name: CONFIG.name})');
  console.log(`GPU: ${gpu} | ANGLE ${ANGLE} | ready in ${((Date.now() - t0) / 1000).toFixed(1)} s | ${cfg.width}x${cfg.height} ${cfg.fps} fps loop ${cfg.loopFrames} frames`);
  const software = /SwiftShader|llvmpipe|softpipe|software|Basic Render/i.test(gpu) || !/Apple|Metal|NVIDIA|GeForce|Quadro|AMD|Radeon|Intel|Mali|Adreno|Qualcomm|PowerVR/i.test(gpu);
  if (software && !flags['allow-software']) {
    console.error('WebGL is NOT on a hardware GPU (renderer string above): refusing to render. Try another --angle backend (Linux: vulkan or gl), ' +
      'check that --ignore-gpu-blocklist is honoured, or pass --chrome to a desktop Chrome.'); return 2;
  }

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
    console.log(JSON.stringify(r, null, 1)); return r.pass ? 0 : 1;
  }
  if (flags['stills-only']) {
    /* QA stills only: render the named frames (4-subframe average, exactly as in the video) to PNG, no encode */
    const list = String(flags.stills || '').split(',').filter(Boolean).map(Number), sdir = path.resolve(flags['stills-dir'] || path.join(PROJ, 'qa'));
    if (!list.length || list.length > 60) { console.error('--stills-only needs 1..60 frames in --stills'); return 64; }
    fs.mkdirSync(sdir, { recursive: true });
    for (const n of list) { const ts = Date.now(), b = await grab(n); fs.writeFileSync(path.join(sdir, `f${String(n).padStart(4, '0')}.png`), png(W, H, b)); console.log(`still ${n} ${((Date.now() - ts) / 1000).toFixed(2)} s`); }
    console.log('console errors/warnings:', errors.length ? errors.join('\n') : 'none'); return errors.length ? 1 : 0;
  }
  const seconds = Number(pos[2] || cfg.loopFrames / cfg.fps), count = Math.round(seconds * fps), start = Number(flags.start || 0);
  const stills = new Set(String(flags.stills || '').split(',').filter(Boolean).map(Number)), sdir = path.resolve(flags['stills-dir'] || path.join(PROJ, 'qa'));
  if (stills.size > 60) { console.error('more than 60 stills requested: use a contact sheet instead'); return 64; }
  if (stills.size) fs.mkdirSync(sdir, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // setparams tags the frames bt709: recent ffmpeg (8.x) takes the stream's colour tags from the frames and ignores -color_primaries / -color_trc
  const VF = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', '-',
    '-vf', VF, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(flags.crf || 12),
    '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-r', String(fps), '-frames:v', String(count), '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  let ffErr = null; const done = new Promise(r => { ff.on('close', r); ff.on('error', e => { ffErr = e; r(-1); }); }); ff.stdin.on('error', e => { ffErr = e; });
  const diffs = []; let prev = null, first = null; const ts = Date.now();
  for (let i = 0; i < count; i++) {
    const n = start + i, b = await grab(n);
    if (b.length !== W * H * 4) throw new Error(`frame ${n}: got ${b.length} bytes, want ${W * H * 4}`);
    if (prev) diffs.push(+mad(prev, b).toFixed(4)); else first = b;
    if (stills.has(n)) fs.writeFileSync(path.join(sdir, `f${String(n).padStart(4, '0')}.png`), png(W, H, b));
    if (ffErr) throw new Error('ffmpeg: ' + ffErr.message);
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
  return code === 0 && errors.length === 0 ? 0 : 1;
}
