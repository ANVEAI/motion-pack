#!/usr/bin/env node
/* motion-stack / scripts / seekcheck.mjs
   Test any animation library, page or composition for frame-exact rendering. The question: is the picture a pure function of t?

   needs: Node 18+, ffmpeg on PATH, puppeteer-core (`npm i -D puppeteer-core` in your project, or any copy under ~/.npm/_npx),
          and a Chrome/Chromium (found automatically, or pass --chrome PATH / set CHROME_PATH).

   usage:
     node seekcheck.mjs <page.html> [--root DIR] [--query "a=1&b=2"] [--w 1080] [--h 1920] [--fps 30] [--frames 120]
                        [--samples 12] [--cold 4] [--stills 0,30,60,119] [--out DIR] [--label NAME]
                        [--video out.mp4] [--settle-ms 0] [--chrome PATH] [--software] [--timeout-ms 300000] [--coi]

   Page contract (everything a test page must implement):
     window.__ready === true once the page has booted (set window.__error = 'message' instead if boot failed)
     window.__seek(t)  draws the state at t seconds and may return a promise. It must not depend on earlier seeks.
   The page gets ?w=&h=&fps=&frames= plus --query in its URL. --root is the folder served over HTTP (default: the page's folder),
   so a page can import from a node_modules folder above it. --coi adds COOP/COEP headers (SharedArrayBuffer), off by default.

   Gates written to <out>/report.json:
     same_twice         seek(t) twice in a row gives identical pixels
     order_independent  forward, reverse and shuffled sample orders give identical pixels for every sampled frame
     cold_equals_warm   a fresh page seeked straight to frame N matches the forward pass
   Mismatching frames are saved as PNG pairs with their PSNR from ffmpeg, so GPU noise (above 60 dB) can be told apart from state errors.
   ms_per_frame is seek + 2 rAF + a PNG screenshot, forward pass: compare variants on the same machine only.
   Chrome runs headless with its own temp profile and the real GPU (ANGLE Metal on macOS); --software forces SwiftShader (CI without a GPU). */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';

const argv = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true; flags[k] = v; } else pos.push(argv[i]);
}
if (!pos[0]) { console.error('usage: node seekcheck.mjs <page.html> [--root DIR] [--query q] [--w W --h H --fps F --frames N] [--samples S --cold C] [--stills a,b] [--out DIR] [--label L] [--video out.mp4]'); process.exit(64); }
const PAGE = path.resolve(pos[0]), ROOT = path.resolve(flags.root || path.dirname(PAGE));
if (!PAGE.startsWith(ROOT + path.sep)) { console.error('the page must sit inside --root'); process.exit(64); }
const W = +flags.w || 1080, H = +flags.h || 1920, FPS = +flags.fps || 30, F = +flags.frames || 120;
const S = Math.min(F, +flags.samples || 12), LABEL = flags.label || path.basename(PAGE, '.html');
const OUT = path.resolve(flags.out || path.join(path.dirname(PAGE), 'seekcheck', LABEL)); fs.mkdirSync(OUT, { recursive: true });
const STILLS = String(flags.stills || '').split(',').filter((s) => s !== '').map(Number).filter((n) => n >= 0 && n < F);
const SETTLE = +flags['settle-ms'] || 0, TIMEOUT = +flags['timeout-ms'] || 300000;

function findPuppeteer() {
  for (const from of [path.join(process.cwd(), 'x.js'), path.join(ROOT, 'x.js'), import.meta.url]) { try { return createRequire(from)('puppeteer-core'); } catch {} }
  const base = path.join(os.homedir(), '.npm/_npx'); let best = null;
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const pj = path.join(base, d, 'node_modules/puppeteer-core/package.json');
    if (fs.existsSync(pj)) { const v = JSON.parse(fs.readFileSync(pj, 'utf8')).version.split('.').map(Number); const s = v[0] * 1e6 + v[1] * 1e3 + v[2]; if (!best || s > best.s) best = { dir: path.join(base, d, 'node_modules'), s }; }
  }
  if (!best) { console.error('puppeteer-core not found: run `npm i -D puppeteer-core` in your project (or next to the page)'); process.exit(65); }
  return createRequire(best.dir + '/')('puppeteer-core');
}
function findChrome() {
  const cands = [flags.chrome, process.env.CHROME_PATH];
  if (process.platform === 'darwin') cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  else if (process.platform === 'win32') cands.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  else cands.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
  const cache = path.join(os.homedir(), '.cache/puppeteer/chrome');   // Chrome for Testing installed by `npx puppeteer browsers install chrome`
  if (fs.existsSync(cache)) for (const v of fs.readdirSync(cache).sort().reverse()) for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-win64/chrome.exe']) cands.push(path.join(cache, v, rel));
  return cands.filter(Boolean).find((p) => fs.existsSync(p));
}
const CHROME = findChrome();
if (!CHROME) { console.error('no Chrome/Chromium found: pass --chrome PATH or set CHROME_PATH'); process.exit(65); }
const GPU_ARGS = flags.software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'darwin' ? ['--use-angle=metal'] : [];

/* ---- static server rooted at --root, with Range support (video / wasm streaming) ---- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.riv': 'application/octet-stream', '.lottie': 'application/zip', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.cube': 'text/plain' };
const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/favicon.ico') { res.writeHead(204); return res.end(); }   // keeps the console list for real errors
  const p = path.join(ROOT, rel);
  if (!(p === ROOT || p.startsWith(ROOT + path.sep)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(p).size, head = { 'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
  if (flags.coi) Object.assign(head, { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'cross-origin' });
  const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (m && (m[1] !== '' || m[2] !== '')) {
    const a = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]), b = m[1] !== '' && m[2] !== '' ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (a > b || a >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { ...head, 'content-length': size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const relUrl = path.relative(ROOT, PAGE).split(path.sep).map(encodeURIComponent).join('/');
const QUERY = `w=${W}&h=${H}&fps=${FPS}&frames=${F}` + (flags.query ? '&' + flags.query : '');
const URL_ = `http://127.0.0.1:${server.address().port}/${relUrl}?${QUERY}`;

const puppeteer = findPuppeteer(), UDD = fs.mkdtempSync(path.join(os.tmpdir(), 'seekcheck-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: UDD, protocolTimeout: 1800000,
  args: [...GPU_ARGS, '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required',
    '--force-color-profile=srgb', '--font-render-hinting=none'] });
const cleanup = async () => { try { await browser.close(); } catch {} server.close(); try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {} };   // our own temp profile only

async function openPage() {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warn' || t === 'warning') errors.push(`${t}: ${m.text()}`.slice(0, 400)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 400)));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + ((r.failure() && r.failure().errorText) || '')));
  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForFunction('window.__ready === true || !!window.__error', { timeout: TIMEOUT, polling: 100 });
  const err = await page.evaluate(() => window.__error || null);
  return { page, errors, bootMs: Date.now() - t0, err };
}
async function draw(page, n) {
  const a = process.hrtime.bigint();
  await page.evaluate(async (t) => {
    const r = window.__seek(t); if (r && typeof r.then === 'function') await r;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  }, n / FPS);
  if (SETTLE) await new Promise((r) => setTimeout(r, SETTLE));
  const png = Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } }));
  return { png, hash: crypto.createHash('sha256').update(png).digest('hex').slice(0, 16), ms: Number(process.hrtime.bigint() - a) / 1e6 };
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1) : null; };
function psnr(a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:([\d.]+|inf)/.exec(r.stderr || ''); return m ? (m[1] === 'inf' ? 999 : +m[1]) : null;
}

const report = { label: LABEL, page: path.relative(ROOT, PAGE), query: QUERY, w: W, h: H, fps: FPS, frames: F, chrome: CHROME };
try {
  const main = await openPage(); report.boot_ms = main.bootMs; report.boot_error = main.err;
  report.gpu = await main.page.evaluate(() => { try { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g ? 'webgl (masked)' : 'no webgl'; } catch { return 'n/a'; } });
  if (main.err) throw new Error('page boot error: ' + main.err);
  const samples = [...new Set(Array.from({ length: S }, (_, i) => Math.round((i * (F - 1)) / Math.max(1, S - 1))))];
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const shuffled = [...samples]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const fwd = {}, rep = {}, rev = {}, shuf = {}, cold = {}, times = [], coldErrors = [];
  for (const n of samples) { fwd[n] = await draw(main.page, n); times.push(fwd[n].ms); rep[n] = await draw(main.page, n); }
  for (const n of [...samples].reverse()) rev[n] = await draw(main.page, n);
  for (const n of shuffled) shuf[n] = await draw(main.page, n);
  const C = Math.min(samples.length, flags.cold === undefined ? 4 : +flags.cold);
  const coldList = [...new Set(Array.from({ length: C }, (_, i) => samples[Math.round(((i + 1) * (samples.length - 1)) / (C + 1))]))];
  for (const n of coldList) { const c = await openPage(); if (c.err) coldErrors.push('cold boot error: ' + c.err); else cold[n] = await draw(c.page, n); coldErrors.push(...c.errors); await c.page.close(); }
  for (const n of STILLS) { const r = fwd[n] || (await draw(main.page, n)); fs.writeFileSync(path.join(OUT, `f${String(n).padStart(4, '0')}.png`), r.png); }

  const mism = [];
  for (const n of samples) for (const [name, set] of [['repeat', rep], ['reverse', rev], ['shuffled', shuf], ['cold', cold]]) if (set[n] && set[n].hash !== fwd[n].hash) mism.push({ frame: n, pass: name, b: set[n] });
  for (const [i, m] of mism.entries()) {
    if (i >= 8) break;
    const fa = path.join(OUT, `mismatch-f${m.frame}-forward.png`), fb = path.join(OUT, `mismatch-f${m.frame}-${m.pass}.png`);
    fs.writeFileSync(fa, fwd[m.frame].png); fs.writeFileSync(fb, m.b.png); m.psnr = psnr(fa, fb); m.files = [path.basename(fa), path.basename(fb)];
  }
  const worst = (passes) => { const v = mism.filter((m) => passes.includes(m.pass) && m.psnr != null).map((m) => m.psnr); return v.length ? Math.min(...v) : null; };
  report.samples = samples; report.cold_frames = coldList;
  report.gates = { same_twice: !mism.some((m) => m.pass === 'repeat'), order_independent: !mism.some((m) => m.pass === 'reverse' || m.pass === 'shuffled'), cold_equals_warm: !mism.some((m) => m.pass === 'cold') };
  report.worst_psnr_db = { repeat: worst(['repeat']), order: worst(['reverse', 'shuffled']), cold: worst(['cold']) };
  report.noise_only = mism.length > 0 && mism.every((m) => m.psnr == null || m.psnr >= 60);
  report.pass = report.gates.same_twice && report.gates.order_independent && report.gates.cold_equals_warm;
  report.mismatches = mism.map((m) => ({ frame: m.frame, pass: m.pass, psnr: m.psnr ?? null, files: m.files ?? null }));
  report.ms_per_frame = { median: median(times), p90: pct(times, 0.9), note: 'seek + 2 rAF + PNG screenshot, forward pass; compare within a lane only' };
  report.console = [...main.errors, ...coldErrors].slice(0, 60);
  if (flags.video) {
    const vout = path.resolve(flags.video), vt = [];
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', vout], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let n = 0; n < F; n++) { const r = await draw(main.page, n); vt.push(r.ms); if (!ff.stdin.write(r.png)) await new Promise((res) => ff.stdin.once('drain', res)); }
    ff.stdin.end(); const code = await new Promise((res) => ff.on('close', res));
    report.video = { path: vout, ms_per_frame_median: median(vt), ffmpeg_exit: code };
  }
} catch (e) { report.error = String((e && e.stack) || e).slice(0, 2000); report.pass = false; }
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await cleanup();
const g = report.gates || {};
console.log(`${LABEL}: ${report.error ? 'ERROR ' + report.error.split('\n')[0] : report.pass ? 'PASS' : report.noise_only ? 'FAIL (noise only, >= 60 dB)' : 'FAIL'}`
  + (report.gates ? ` | same_twice=${g.same_twice} order_independent=${g.order_independent} cold_equals_warm=${g.cold_equals_warm} | ${report.ms_per_frame.median} ms/frame | console ${report.console.length}` : '') + ` | ${OUT}/report.json`);
process.exit(report.error ? 1 : 0);
