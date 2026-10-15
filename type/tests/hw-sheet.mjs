/* node type/tests/hw-sheet.mjs (xp-hardware, 2026-10-16): contact sheet of the hw.* parts (type/gfx/hw.js) at a hero time, dark background, 16:9 and 9:16 tiles,
   -> type/demo/out/gfx-hw.png + .jpg (the committed preview). Also a smoke test: every part non-empty at its hero time, empty before its start, the same markup twice. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT, pageErrors } from '../../layers/tests/harness.mjs';
const HERO = { 'hw.specCallout': 1.8, 'hw.dimensionLine': 1.4, 'hw.chipDie': 3.4, 'hw.edgeGlint': 0.6, 'hw.dateCard': 2.2, 'hw.specCard': 3.6 };
const h = await open('/type/demo/gfx.html'); let fail = 0; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-hw-')), tiles = [];
for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
  await h.page.setViewport({ width: W, height: H });
  for (const [id, t] of Object.entries(HERO)) {
    const on = await h.page.evaluate((i, tt, w, hh) => window.show(i, tt, {}, w, hh, { light: false }), id, t, W, H); const a = await h.page.evaluate(() => document.getElementById('ov').innerHTML);
    await h.page.evaluate((i, tt, w, hh) => window.show(i, tt, {}, w, hh, { light: false }), id, t, W, H); const b = await h.page.evaluate(() => document.getElementById('ov').innerHTML);
    const pre = await h.page.evaluate((i, w, hh) => window.show(i, -0.5, {}, w, hh, {}), id, W, H); await h.page.evaluate((i, tt, w, hh) => window.show(i, tt, {}, w, hh, { light: false }), id, t, W, H);
    if (!on) { console.log('FAIL empty at hero time', id, W, H); fail++; } if (a !== b) { console.log('FAIL not seek-stable', id); fail++; } if (pre) { console.log('FAIL visible before start', id); fail++; }
    const f = path.join(dir, `${id}-${W}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: W, height: H } }); tiles.push([`${id} ${W}x${H}`, f]);
  }
}
const errs = pageErrors(h.errors); if (errs.length) { console.log('page errors:', errs.slice(0, 5)); fail++; } await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); wide = [x for x in items if '1920x' in x[0]]; tall = [x for x in items if '1080x1920' in x[0]]
tw, th, cols = 640, 360, 3; rows = (len(wide) + cols - 1) // cols; tth = 360 * 2; ttw = 202
S = Image.new('RGB', (tw * cols, th * rows + 405), (20, 20, 22))
for i, (n, f) in enumerate(wide):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 260, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
for i, (n, f) in enumerate(tall):
    im = Image.open(f).convert('RGB').resize((225, 400), Image.LANCZOS); x, y = 10 + i * 318, th * rows + 3; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.text((x + 230, y + 4), n.split(' ')[0], fill=(220, 220, 220))
S.save(sys.argv[1]); S.save(sys.argv[1][:-4] + '.jpg', quality=84); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'type/demo/out/gfx-hw.png'), JSON.stringify(tiles)]).toString().trim());
console.log(fail ? `FAIL ${fail}` : `hw parts: ${Object.keys(HERO).length} ids x 2 aspects rendered, seek-stable, hidden before start`); process.exit(fail ? 1 : 0);
