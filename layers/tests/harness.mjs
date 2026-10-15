/* motion-pack test harness: opens a demo page in headless Chrome (puppeteer-core + Chrome located by tools/chrome.mjs, hardware WebGL),
   serves the motion-pack root over http so pages can import ES modules by absolute path (/layers/..., /type/..., /camera/...).
   No installs, no downloads. Used by layers/, type/, camera/ tests. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url'; import { findPuppeteer, findChrome, chromeArgs } from '../../tools/chrome.mjs';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.glsl': 'text/plain' };
/* external read-only mounts (never copied into the pack): /ext/three/ -> a three.js build (THREE_DIR env, else node_modules/three in the repo root: npm i --no-save three@0.160.0),
   /ext/gsap.min.js -> GSAP_JS env, else node_modules/gsap (npm i --no-save gsap@3.14.2), /ext/kitfonts/ -> objects/kit/fonts */
function threeDir() { if (process.env.THREE_DIR) return process.env.THREE_DIR; const p = path.join(ROOT, 'node_modules/three'); return fs.existsSync(path.join(p, 'build/three.module.js')) ? p : null; }
function gsapFile() { if (process.env.GSAP_JS) return process.env.GSAP_JS; const f = path.join(ROOT, 'node_modules/gsap/dist/gsap.min.js'); return fs.existsSync(f) ? f : null; }
export async function open(pagePath, query = '', { allowSoftware = false } = {}) {
  const missing = new Set();   // optional dependencies the page asked for and the harness could not find (a clear error instead of 'gsap is not defined' or a 120 s timeout)
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname); let p;
    if (url.startsWith('/ext/kitfonts/')) { p = path.join(ROOT, 'objects/kit/fonts', path.basename(url)); } else if (url === '/ext/gsap.min.js') { const f = gsapFile(); p = f || '/nonexistent'; } else if (url.startsWith('/ext/three/')) { const td = threeDir(); p = td ? path.join(td, url.slice('/ext/three/'.length)) : '/nonexistent'; if (td && !p.startsWith(td)) p = '/nonexistent'; } else { p = path.join(ROOT, url); if (!p.startsWith(ROOT)) p = '/nonexistent'; }
    if (url === '/ext/gsap.min.js' && !gsapFile()) missing.add('gsap: npm i --no-save gsap@3.14.2 in the repo root, or set GSAP_JS to a gsap.min.js');
    if (url.startsWith('/ext/three/') && !threeDir()) missing.add('three: npm i --no-save three@0.160.0 in the repo root, or set THREE_DIR to a three.js package folder');
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-chrome-'));
  const browser = await findPuppeteer().launch({ executablePath: findChrome(), headless: true, userDataDir: udd, protocolTimeout: 600000,
    args: chromeArgs() });
  const page = await browser.newPage(); const errors = [];
  /* errors: console errors / warnings, page exceptions, and every failed request WITH its path ('http 404: /layers/x.png', 'request failed: /x (net::...)'). Chrome's own
     'Failed to load resource' console line carries no URL, so it is dropped in favour of the response record: a test can then allow one known path (pageErrors) instead of every 404. */
  page.on('console', (m) => { if (['error', 'warn', 'warning'].includes(m.type()) && !/^Failed to load resource/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const where = (u) => { try { return new URL(u).pathname; } catch { return String(u); } };
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${where(r.url())}`); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${where(r.url())} (${(r.failure() && r.failure().errorText) || '?'})`));
  const needs = () => { if (missing.size) throw new Error(`${pagePath} needs ${[...missing].join('; ')}`); };
  await page.goto(`http://127.0.0.1:${server.address().port}${pagePath}${query ? '?' + query : ''}`, { waitUntil: 'load', timeout: 120000 });
  try { needs(); await page.waitForFunction('window.__ready === true || window.__error', { timeout: 120000, polling: 200 }); } catch (e) { const c = async () => { try { await browser.close(); } catch {} server.close(); }; await c(); needs(); throw e; }
  const err = await page.evaluate('window.__error || null'); if (err) throw new Error('page error: ' + err);
  const gpu = await page.evaluate('window.__gpu || ""');
  if (!allowSoftware && /SwiftShader|llvmpipe|Basic Render/i.test(gpu)) throw new Error('software GL: ' + gpu);
  const close = async () => { try { await browser.close(); } catch {} server.close(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch {} };
  return { page, errors, gpu, close };
}
/* the errors a test must fail on: everything open() recorded except the browser's own favicon request and the paths / messages a test allows by name
   (e.g. pageErrors(h.errors, [/willReadFrequently/])). A missing module, texture or font is an 'http 404: /path' row and fails unless allowed explicitly. */
export const pageErrors = (errors, allow = []) => errors.filter((e) => !/^http 404: \/favicon\.ico$/.test(e) && !allow.some((re) => re.test(e)));
/* RGBA (top row first) -> PNG (RGB) */
export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1), s = y * w * 4; for (let x = 0; x < w; x++) { raw[o + 1 + x * 3] = rgba[s + x * 4]; raw[o + 2 + x * 3] = rgba[s + x * 4 + 1]; raw[o + 3 + x * 3] = rgba[s + x * 4 + 2]; } }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
/* PNG decoder for 8-bit RGB / RGBA, non-interlaced (puppeteer / Chrome screenshots, ffmpeg output). returns {w,h,rgba} */
export function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 2; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported PNG'); } else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 0; if (!bpp) throw new Error('unsupported colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, img = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], o = y * stride, s = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? img[o + x - bpp] : 0, b = y ? img[o - stride + x] : 0, c = x >= bpp && y ? img[o - stride + x - bpp] : 0; let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } img[o + x] = v & 255; } }
  const rgba = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { if (bpp === 1) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = img[i]; rgba[i * 4 + 3] = 255; } else { rgba[i * 4] = img[i * bpp]; rgba[i * 4 + 1] = img[i * bpp + 1]; rgba[i * 4 + 2] = img[i * bpp + 2]; rgba[i * 4 + 3] = bpp === 4 ? img[i * 4 + 3] : 255; } }
  return { w, h, rgba };
}
export function reporter(name) {
  const rows = []; let fail = 0;
  return { check(label, pass, detail = '') { rows.push({ label, pass: !!pass, detail }); if (!pass) fail++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  | ' + detail : ''}`); },
    done() { console.log(`\n${name}: ${rows.length - fail}/${rows.length} passed`); return { name, total: rows.length, failed: fail, rows }; }, get failed() { return fail; } };
}
