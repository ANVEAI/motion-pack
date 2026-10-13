/* motion-pack / tools / chrome.mjs: find puppeteer-core and a Chrome binary for the GPU tests and the render driver.
   Lookup order (first hit wins):
     puppeteer-core: PUPPETEER_CORE_DIR env (a node_modules folder) -> the repo's own node_modules (npm i --no-save puppeteer-core)
                     -> the npx cache (~/.npm/_npx/<hash>/node_modules, newest version)
     Chrome:         --chrome flag -> CHROME_PATH / PUPPETEER_EXECUTABLE_PATH env -> the usual install paths on macOS, Linux and Windows
   Nothing here downloads anything. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function versionKey(dir) {
  try { const v = JSON.parse(fs.readFileSync(path.join(dir, 'puppeteer-core', 'package.json'), 'utf8')).version.split('.').map(Number); return v[0] * 1e6 + v[1] * 1e3 + v[2]; } catch { return -1; }
}

export function findPuppeteer() {
  const candidates = [];
  if (process.env.PUPPETEER_CORE_DIR) candidates.push(process.env.PUPPETEER_CORE_DIR);
  candidates.push(path.join(REPO, 'node_modules'));
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) {
    const found = fs.readdirSync(npx).map((d) => path.join(npx, d, 'node_modules')).filter((d) => versionKey(d) >= 0).sort((a, b) => versionKey(b) - versionKey(a));
    candidates.push(...found);
  }
  for (const dir of candidates) if (versionKey(dir) >= 0) return createRequire(path.join(dir, 'noop.js'))('puppeteer-core');
  throw new Error('puppeteer-core not found: run `npm i --no-save puppeteer-core` in the repo root, or set PUPPETEER_CORE_DIR to a node_modules folder that has it');
}

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export function findChrome(flag) {
  const list = [flag, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, ...CHROME_PATHS].filter(Boolean);
  const hit = list.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('no Chrome found: install Google Chrome or set CHROME_PATH');
  return hit;
}

/* GPU-friendly flags. On macOS WebGL runs through ANGLE Metal; elsewhere Chrome picks its default backend.
   Pages report their WebGL renderer in window.__gpu, and the callers refuse software GL unless asked. */
export function chromeArgs(extra = []) {
  const a = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
  if (process.platform === 'darwin') a.unshift('--use-angle=metal');
  return [...a, ...extra];
}

export const isSoftwareGL = (gpu) => /SwiftShader|llvmpipe|software|Basic Render/i.test(gpu || '');
