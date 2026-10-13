/* objects probe (from v10 scripts/probe.mjs): node tools/probe.mjs <page.html> "<query>" [js-expression] -> errors, __ready, evaluated result */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { findPuppeteer, findChrome, chromeArgs } from '../../tools/chrome.mjs';
const PAGE = path.resolve(process.argv[2]), ROOT = path.dirname(PAGE), q = process.argv[3] || '', expr = process.argv[4];
const puppeteer = findPuppeteer();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const UDD = path.join(os.tmpdir(), 'mp-probe-' + process.pid);
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, userDataDir: UDD, args: chromeArgs() });
const page = await browser.newPage(); const msgs = [];
page.on('console', (m) => { if (m.type() !== 'log' || /error/i.test(m.text())) msgs.push(m.type() + ': ' + m.text()); else msgs.push('log: ' + m.text()); }); page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message)); page.on('requestfailed', (r) => msgs.push('requestfailed: ' + r.url()));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/${path.basename(PAGE)}?t=0&norun=1&${q}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 }).catch(() => msgs.push('TIMEOUT waiting for __ready'));
  console.log(JSON.stringify({ error: await page.evaluate('window.__error || null'), gpu: await page.evaluate('window.__gpu || null') }));
  if (expr) console.log(JSON.stringify(await page.evaluate(expr), null, 0));
} catch (e) { msgs.push('probe: ' + e.message); }
console.log(msgs.slice(0, 30).join('\n'));
await browser.close(); server.close(); fs.rmSync(UDD, { recursive: true, force: true });
