/* motion-pack / tools / lottie / playcheck.mjs: play an exported Lottie in a real player (lottie-web, SVG renderer) in headless Chrome and save
   still frames, so a person can LOOK at what an app or website will show. Schema validity (validate.py) says the file is well formed; this
   says a player draws it.
     LOTTIE_WEB=/path/to/node_modules/lottie-web/build/player/lottie.min.js \
       node tools/lottie/playcheck.mjs out/title.lottie.json --frames 0,15,30,45,60,89 --out out/playcheck
   lottie-web is NOT vendored and not fetched here (motion-stack pins lottie-web 5.13.0): point LOTTIE_WEB at your own install.
   Writes frame-<n>.png and report.json (player version, layers the player built, any page errors). Exit 1 on a page error. */
import fs from 'node:fs'; import path from 'node:path';
import { findPuppeteer, findChrome, chromeArgs } from '../chrome.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const player = process.env.LOTTIE_WEB || opt('--player');
if (!file || !player || !fs.existsSync(player)) { console.error('usage: LOTTIE_WEB=<lottie.min.js> node tools/lottie/playcheck.mjs <file.json> [--frames 0,30] [--out dir]'); process.exit(2); }
const out = opt('--out', 'out/playcheck'); fs.mkdirSync(out, { recursive: true });
const data = JSON.parse(fs.readFileSync(file, 'utf8')), frames = (opt('--frames', '0') || '0').split(',').map(Number);
const puppeteer = findPuppeteer();
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: chromeArgs(['--disable-gpu']) });
const errors = [];
try {
  const page = await browser.newPage(); page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: data.w, height: data.h, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#808080"><div id="a" style="width:${data.w}px;height:${data.h}px"></div></body></html>`);
  await page.addScriptTag({ content: fs.readFileSync(player, 'utf8') });
  const info = await page.evaluate((d) => { window.__anim = lottie.loadAnimation({ container: document.getElementById('a'), renderer: 'svg', loop: false, autoplay: false, animationData: d });
    return { version: lottie.version, layers: window.__anim.renderer.elements.length, frames: window.__anim.totalFrames }; }, data);
  for (const f of frames) {
    await page.evaluate((n) => window.__anim.goToAndStop(n, true), f);
    await page.screenshot({ path: path.join(out, `frame-${String(f).padStart(4, '0')}.png`) });
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ file, ...info, frames, errors }, null, 1));
  console.log(`playcheck: lottie-web ${info.version}, ${info.layers} layers, ${info.frames} frames; ${frames.length} stills -> ${out}${errors.length ? '; PAGE ERRORS: ' + errors.join(' | ') : ''}`);
} finally { await browser.close(); }
process.exit(errors.length ? 1 : 0);
