/* usage: node layers/tests/overlay-sheet.mjs <out.png> [mood]   one tile per overlay kind (strong settings) over the demo plate, screenshots of the real DOM blend */
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import path from 'node:path'; import os from 'node:os'; import { open } from './harness.mjs';
const out = process.argv[2], mood = process.argv[3] || 'day';
const sets = [['@plate', []], ['grain film35', [{ kind: 'grain', params: { stock: 'film35' } }]], ['vignette .35', [{ kind: 'vignette', params: { amount: 0.35 } }]],
  ['leaks warm', [{ kind: 'leaks', params: { intensity: 0.9, edge: 'left', loop: true } }]], ['dust+hair+scratch', [{ kind: 'dust', params: { density: 1, hair: 3, scratch: 2, under: 0.6 } }]],
  ['bokeh hex', [{ kind: 'bokeh', params: { count: 22, hex: 0.7, intensity: 0.7 } }]], ['glow pools', [{ kind: 'glow', params: { pools: [{ x: 0.15, y: 0.85, r: 0.5, color: '#FF8A3A', intensity: 0.7 }, { x: 0.9, y: 0.1, r: 0.4, color: '#5A8CFF', intensity: 0.5 }] } }]],
  ['paper', [{ kind: 'paper', params: { amount: 0.8 } }]], ['scanlines+mask', [{ kind: 'scanlines', params: { depth: 0.3, mask: 0.15 } }]], ['bars 2.39', [{ kind: 'bars', params: { ratio: 2.39 } }]],
  ['stack: leaks+paper+vig+dust+grain', [{ kind: 'leaks', params: { intensity: 0.6, edge: 'left', loop: true } }, { kind: 'paper', params: { amount: 0.4 } }, { kind: 'vignette', params: { amount: 0.25 } }, { kind: 'dust', params: { density: 0.6, under: 0.6 } }, { kind: 'grain', params: { stock: 'film16' } }]]];
const h = await open('/layers/demo/overlays.html'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-ov-')); await h.page.setViewport({ width: 1920, height: 1080 }); const files = [];
for (const [name, layers] of sets) { await h.page.evaluate((l, m) => window.setup(l, 1, 30, m), layers, mood); const f = path.join(dir, files.length + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); files.push([name, f]); }
await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); S.paste(im, ((i % cols) * tw, (i // cols) * th)); d = ImageDraw.Draw(S); d.rectangle(((i % cols) * tw, (i // cols) * th, (i % cols) * tw + 260, (i // cols) * th + 18), fill=(0, 0, 0)); d.text(((i % cols) * tw + 5, (i // cols) * th + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(files)]).toString().trim()); fs.rmSync(dir, { recursive: true, force: true });
