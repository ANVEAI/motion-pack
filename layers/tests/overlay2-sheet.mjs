/* usage: node layers/tests/overlay2-sheet.mjs   -> layers/demo/out/fx2-<group>.png (one tile per expansion kind over the demo plate, real DOM blend)
   Also a smoke test: exit 1 on any page error, any kind that fails to mount, or a tile identical to the bare plate. */
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { open, ROOT } from './harness.mjs';
const T = 1.4, GROUPS = {
  lens: [['flareStreak', {}], ['flareGhosts', {}], ['starburst', {}], ['lensDirt', {}], ['rainGlass', {}], ['fog', {}], ['godRays', {}], ['burnEdge', {}], ['vhs', {}]],
  comic: [['halftone', {}], ['speedLines', {}], ['impactFrame', { at: T }], ['noiseMap', {}], ['paperFold', {}], ['crumple', {}], ['cardboard', {}], ['canvas', {}], ['cloth', {}], ['concrete', {}], ['brushedMetal', {}], ['tornEdge', {}]],
  particles: [['sparks', { burstAt: 1.0 }], ['sparks', {}], ['embers', {}], ['smoke', {}], ['confetti', { burstAt: 0.8 }], ['confetti', {}], ['snow', {}], ['motes', {}]],
  frames: [['recHUD', {}], ['timecode', { style: 'vhs' }], ['timecode', { style: 'crt' }], ['timecode', { style: 'film' }], ['sprocket', {}], ['gateEdge', {}], ['polaroid', { caption: 'Diwali 2026' }], ['instax', { caption: 'first demo!' }],
    ['arBars', { beats: [1.3] }], ['arRing', { beats: [1.35] }], ['arWave', { beats: [1.3] }], ['arSpectrum', { beats: [1.3] }]],
};
const h = await open('/layers/demo/overlays.html'); await h.page.setViewport({ width: 1920, height: 1080 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-ov2-'));
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); let fail = 0;
await h.page.evaluate((t) => window.setup([], t, Math.round(t * 30)), T); const base = path.join(dir, 'plate.png'); await h.page.screenshot({ path: base, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
for (const [g, sets] of Object.entries(GROUPS)) {
  const files = [];
  for (const [kind, params] of sets) {
    try { await h.page.evaluate((l, t) => window.setup(l, t, Math.round(t * 30)), [{ kind, params }], T); } catch (e) { console.log('FAIL mount', kind, e.message.slice(0, 200)); fail++; continue; }
    const f = path.join(dir, `${g}-${files.length}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (md5(f) === md5(base)) { console.log('FAIL no visible change', kind); fail++; }
    files.push([kind + (Object.keys(params).length ? ' ' + JSON.stringify(params).slice(0, 28) : ''), f]);
  }
  const out = path.join(ROOT, `layers/demo/out/fx2-${g}.png`);
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 300, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
  console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(files)]).toString().trim());
}
/* same filter as layers.test.mjs (the plate's font probe 404s) */
const errs = h.errors.filter((e) => !/favicon|404/.test(e)); if (errs.length) { console.log('page errors:', errs.slice(0, 5)); fail++; }
await h.close(); console.log(fail ? `FAIL ${fail}` : 'overlay2: all kinds mounted, rendered and visible'); process.exit(fail ? 1 : 0);
