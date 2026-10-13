/* usage: node transitions/tests/dom-sheet.mjs -> transitions/renders/contact_dom.png
   Real Chrome check of every DOM back-end AND every DOM approximation of a GL-only key (tx-dom-x.js APPROX):
   endpoints are exact (p=0 shows only A, p=1 only B), mid-progress changes the styles, the same p gives the same styles twice (seek-safe), no page errors. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT } from '../../layers/tests/harness.mjs';
const h = await open('/transitions/tests/dom-check.html'); await h.page.setViewport({ width: 960, height: 540 });
const K = await h.page.evaluate('window.KEYS'), keys = [...K.dom.map((k) => [k, 'dom']), ...K.approx.map((k) => [k, 'approx'])], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-txdom-')), files = []; let fail = 0;
for (const [k, kind] of keys) {
  const s0 = await h.page.evaluate((k) => window.at(k, 0), k), s1 = await h.page.evaluate((k) => window.at(k, 1), k);
  if (!/opacity: 1/.test(s0.split('|')[0]) || !/opacity: 0/.test(s0.split('|')[1]) || !/opacity: 0/.test(s1.split('|')[0]) || !/opacity: 1/.test(s1.split('|')[1])) { console.log('FAIL endpoints', k, s0, s1); fail++; }
  const shots = [];
  for (const p of [0.3, 0.5, 0.7]) { let m1, m2; try { m1 = await h.page.evaluate((k, p) => window.at(k, p), k, p); m2 = await h.page.evaluate((k, p) => window.at(k, p), k, p); } catch (e) { console.log('FAIL throw', k, p, e.message.slice(0, 160)); fail++; continue; }
    if (m1 !== m2) { console.log('FAIL not seek-stable', k, p); fail++; } if (m1 === s0) { console.log('FAIL no change at', k, p); fail++; }
    const f = path.join(dir, `${k}-${p}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); shots.push(f); }
  files.push([`${k} (${kind})`, shots]);
}
const errs = h.errors.filter((e) => !/favicon|404/.test(e)); if (errs.length) { console.log('page errors', errs.slice(0, 4)); fail++; } await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
rows = json.loads(sys.argv[2]); tw, th, lw = 240, 135, 190
S = Image.new('RGB', (lw + tw * 3, th * len(rows)), (24, 24, 24)); d = ImageDraw.Draw(S)
for r, (n, fs) in enumerate(rows):
    d.text((6, r * th + th // 2 - 6), n, fill=(255, 255, 255))
    for c, f in enumerate(fs): S.paste(Image.open(f).convert('RGB').resize((tw, th)), (lw + c * tw, r * th))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'transitions/renders/contact_dom.png'), JSON.stringify(files)]).toString().trim());
console.log(fail ? `FAIL ${fail}` : `tx dom: ${K.dom.length} DOM back-ends + ${K.approx.length} approximations pass (endpoints exact, seek-stable, visible change)`); process.exit(fail ? 1 : 0);
