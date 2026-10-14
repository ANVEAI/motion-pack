/* usage: node camera/tests/sheet-r3.mjs -> camera/demo/out/cam2d-r3.png (scaleDive + pullbackToScreen on camera/demo/r3.html, real Chrome) */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { open, ROOT, pageErrors } from '../../layers/tests/harness.mjs';
const h = await open('/camera/demo/r3.html'); await h.page.setViewport({ width: 1920, height: 1080 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-c2r3-')), files = [];
const ROWS = [['scaleDive', [0.2, 1.0, 1.55, 1.75, 2.4, 3.1, 3.4, 3.9]], ['pullbackToScreen', [0.2, 0.6, 0.9, 1.2, 1.6, 2.0, 2.5, 3.0]]];
for (const [n, ts] of ROWS) for (const t of ts) { const s = await h.page.evaluate((n, t) => { window.setCam(n); return JSON.stringify(window.at(t)); }, n, t); const f = path.join(dir, files.length + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); files.push([`${n} t=${t}`, f]); }
const errs = pageErrors(h.errors); await h.close(); if (errs.length) { console.log('page errors', errs); process.exit(1); }
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 4; tw = 480; th = 270; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 200, y + 15), fill=(0, 0, 0)); d.text((x + 4, y + 2), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'camera/demo/out/cam2d-r3.png'), JSON.stringify(files)]).toString().trim()); fs.rmSync(dir, { recursive: true, force: true });
