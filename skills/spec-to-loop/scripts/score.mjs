#!/usr/bin/env node
/* spec-to-loop score renderer: runs the page's CONFIG.SCORE through templates/lib/score-engine.js (Web Audio
   OfflineAudioContext, 48 kHz stereo) in headless Chrome and writes the stems for measure_audio.py.

   usage: node score.mjs <page.html> <out_dir> [--rounds N] [--engine path/to/score-engine.js] [--keep-trims] [--chrome PATH]
     writes <out_dir>/audio/{bed.f32, hits.f32, iso.f32, own.f32, meta.json}   (f32 = interleaved float32 stereo, exactly one loop)
     --rounds N : N correction rounds (render -> measure_audio.py --tune -> render), then measure_audio.py --write.
                  Without --keep-trims the first round starts from no trims (trims.json is reset to {}).
   The page is NOT opened: only its <script id="config"> block is evaluated, so the score never needs the GPU.
   needs: puppeteer-core and Chrome (found the same way as render.mjs), python3 with numpy + scipy (or PYTHON=/path/to/python).
   Exit status: 0 = the final measurement passes (or no rounds were asked for), 3 = a measured FAIL, 1 = a crash, 65 = a missing tool. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2), flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; flags[k] = v; } else pos.push(argv[i]); }
if (pos.length < 2) { console.error('usage: node score.mjs <page.html> <out_dir> [--rounds N]'); process.exit(64); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(pos[0]), OUTD = path.resolve(pos[1]), AUD = path.join(OUTD, 'audio');
const ENGINE = path.resolve(flags.engine || path.join(HERE, '..', 'templates', 'lib', 'score-engine.js'));
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
fs.mkdirSync(AUD, { recursive: true });
const html = fs.readFileSync(HTML, 'utf8'), m = html.match(/<script id="config">([\s\S]*?)<\/script>/);
if (!m) { console.error('no <script id="config"> block in', HTML); process.exit(65); }
const trimsPath = path.join(AUD, 'trims.json');
if (flags.rounds && !flags['keep-trims']) fs.writeFileSync(trimsPath, '{}\n');          // a fresh solve starts from no trims

/* ---- puppeteer-core and Chrome: same search order as render.mjs ---- */
async function loadPuppeteer(bases) {
  for (const name of ['puppeteer-core', 'puppeteer']) {
    try { const mod = await import(name); return mod.default || mod; } catch {}
    for (const b of bases) { try { const mod = createRequire(path.join(b, 'noop.js'))(name); return mod.default || mod; } catch {} }
  }
  const caches = [process.env.npm_config_cache, path.join(os.homedir(), '.npm'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache')];
  let best = null;
  for (const base of caches.filter(Boolean).map(c => path.join(c, '_npx'))) for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const pj = path.join(base, d, 'node_modules', 'puppeteer-core', 'package.json'); if (!fs.existsSync(pj)) continue;
    const v = JSON.parse(fs.readFileSync(pj, 'utf8')).version.split('.').map(Number), s = v[0] * 1e6 + v[1] * 1e3 + v[2];
    if (!best || s > best.s) best = { dir: path.join(base, d, 'node_modules'), s };
  }
  if (best) { const mod = createRequire(best.dir + path.sep)('puppeteer-core'); return mod.default || mod; }
  console.error(`puppeteer-core not found. Install it once: cd "${HERE}" && npm i puppeteer-core   (or in the project folder, or set NODE_PATH)`);
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
  const cft = path.join(home, '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(cft)) for (const d of fs.readdirSync(cft).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })))
    for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-win64/chrome.exe']) list.push(path.join(cft, d, rel));
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  for (const [src, p] of [['--chrome', flags.chrome], ['CHROME_PATH', env.CHROME_PATH], ['PUPPETEER_EXECUTABLE_PATH', env.PUPPETEER_EXECUTABLE_PATH]])
    if (typeof p === 'string' && p) { if (isFile(p)) return p; console.error(`${src} does not name a file: ${p}`); process.exit(65); }
  const hit = list.find(isFile); if (hit) return hit;
  try { const p = lib && typeof lib.executablePath === 'function' ? await lib.executablePath() : null; if (typeof p === 'string' && isFile(p)) return p; } catch {}   // the full puppeteer package's own Chrome
  return null;
}
const puppeteer = await loadPuppeteer([process.cwd(), path.dirname(HTML)]);
const CHROME = await findChrome(puppeteer);
if (!CHROME) { console.error('no Chrome or Chromium found: pass --chrome PATH or set CHROME_PATH'); process.exit(65); }
const UDD = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-to-loop-score-'));
let browser = null;
const cleanup = async () => { try { if (browser) await browser.close(); } catch {} try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {} };   // its own temp profile only
const errors = [];
let status = 0;
try { status = await main(); } catch (e) { console.error(e && e.stack || e); status = 1; }
if (errors.length) console.log('console errors/warnings:', errors.join('\n'));
await cleanup();
process.exit(status || (errors.length ? 1 : 0));

async function main() {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: UDD, protocolTimeout: 900000, args: ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('console', x => { if (x.type() === 'error' || x.type().startsWith('warn')) errors.push(`${x.type()}: ${x.text()}`); }); page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setContent(`<!doctype html><meta charset="utf-8"><script>${m[1]}<\/script><script>${fs.readFileSync(ENGINE, 'utf8')}<\/script>`, { waitUntil: 'load' });
  if (!(await page.evaluate('!!(window.CONFIG && window.CONFIG.SCORE && window.ScoreEngine)'))) { console.error('CONFIG.SCORE or ScoreEngine missing', errors); return 65; }

  async function renderOnce() {
    const trims = fs.existsSync(trimsPath) ? JSON.parse(fs.readFileSync(trimsPath, 'utf8')) : {};
    const t0 = Date.now();
    const r = await page.evaluate(async trims => {
      const out = await ScoreEngine.render(CONFIG.SCORE, trims);
      const b64 = a => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.slice(fr.result.indexOf(',') + 1)); fr.readAsDataURL(new Blob([a.buffer])); });
      out.meta.name = CONFIG.name || 'loop';
      return { meta: out.meta, bed: await b64(out.bed), hits: await b64(out.hits), iso: await b64(out.iso), own: await b64(out.own) };
    }, trims);
    for (const k of ['bed', 'hits', 'iso', 'own']) fs.writeFileSync(path.join(AUD, k + '.f32'), Buffer.from(r[k], 'base64'));
    fs.writeFileSync(path.join(AUD, 'meta.json'), JSON.stringify(r.meta, null, 1));
    console.log(`score rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${r.meta.groups.length} groups, ${r.meta.iso.length} isolated parts, loop ${r.meta.N} samples`);
  }
  const py = args => { const p = spawnSync(PY, [path.join(HERE, 'measure_audio.py'), OUTD, ...args], { stdio: 'inherit' }); if (p.error) console.error(PY + ': ' + p.error.message); return p.status; };
  await renderOnce();
  const rounds = Number(flags.rounds || 0);
  for (let k = 1; k <= rounds; k++) { console.log(`\n=== correction round ${k}/${rounds}`); const st = py(['--tune', '--quiet']); if (st !== 0 && st !== 3) throw new Error('measure_audio.py crashed (exit ' + st + ')'); await renderOnce(); }
  if (rounds) { console.log('\n=== final measurement'); const st = py(['--write']); if (st !== 0 && st !== 3) throw new Error('measure_audio.py crashed (exit ' + st + ')'); return st; }
  return 0;
}
