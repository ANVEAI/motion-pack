/* usage: node camera/tests/sheet2d.mjs <out.png> <cam names comma> <times comma> */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { open } from '../../layers/tests/harness.mjs';
const [out, names, times] = process.argv.slice(2); const h = await open('/camera/demo/dom2d.html'); await h.page.setViewport({ width: 1920, height: 1080 });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-c2-')), files = [];
for (const n of names.split(',')) for (const t of times.split(',').map(Number)) { await h.page.evaluate((n, t) => { window.setCam(n); window.at(t); }, n, t); const f = path.join(dir, files.length + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); files.push([`${n} t=${t}`, f]); }
await h.close(); const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = int(sys.argv[3]); tw = 384; th = 216; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 150, y + 15), fill=(0, 0, 0)); d.text((x + 4, y + 2), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(files), String(times.split(',').length)]).toString().trim()); fs.rmSync(dir, { recursive: true, force: true });
