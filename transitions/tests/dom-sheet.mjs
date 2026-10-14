/* usage: node transitions/tests/dom-sheet.mjs -> transitions/renders/contact_dom.png
   Real Chrome check of every DOM back-end AND every DOM approximation of a GL-only key (tx-dom-x.js APPROX):
   endpoints are exact (p=0 shows only A, p=1 only B: the screenshot at p = 0 equals shot A alone and the one at p = 1 equals shot B alone, pixel for pixel, so a leftover
   transform, filter, clip or overlay at an endpoint fails; it used to check only the opacity text of the inline styles), mid-progress changes the styles, the same p gives the same
   styles twice (seek-safe), no page errors. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT, pageErrors, decodePNG } from '../../layers/tests/harness.mjs';
const h = await open('/transitions/tests/dom-check.html'); await h.page.setViewport({ width: 960, height: 540 });
const shot = async () => decodePNG(Buffer.from(await h.page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 960, height: 540 } })));
/* pixels that differ by more than 2 levels in any channel, and the largest difference */
const diff = (x, y) => { let n = 0, mx = 0; for (let i = 0; i < x.rgba.length; i += 4) { const d = Math.max(Math.abs(x.rgba[i] - y.rgba[i]), Math.abs(x.rgba[i + 1] - y.rgba[i + 1]), Math.abs(x.rgba[i + 2] - y.rgba[i + 2])); if (d > 2) n++; if (d > mx) mx = d; } return { n, mx }; };
await h.page.evaluate("window.alone('a')"); const refA = await shot(); await h.page.evaluate("window.alone('b')"); const refB = await shot(); await h.page.evaluate('window.reset()');
const K = await h.page.evaluate('window.KEYS'), keys = [...K.dom.map((k) => [k, 'dom']), ...K.approx.map((k) => [k, 'approx'])], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-txdom-')), files = []; let fail = 0, ends = 0;
for (const [k, kind] of keys) {
  const s0 = await h.page.evaluate((k) => window.at(k, 0), k), s1 = await h.page.evaluate((k) => window.at(k, 1), k);
  await h.page.evaluate((k) => window.at(k, 0), k); const d0 = diff(await shot(), refA); await h.page.evaluate((k) => window.at(k, 1), k); const d1 = diff(await shot(), refB);
  if (d0.n || d1.n) { console.log(`FAIL endpoints ${k}: p=0 vs A alone ${d0.n} px differ (max ${d0.mx}), p=1 vs B alone ${d1.n} px differ (max ${d1.mx})`, s0.slice(0, 160), '||', s1.slice(0, 160)); fail++; } else ends++;
  const shots = [];
  for (const p of [0.3, 0.5, 0.7]) { let m1, m2; try { m1 = await h.page.evaluate((k, p) => window.at(k, p), k, p); m2 = await h.page.evaluate((k, p) => window.at(k, p), k, p); } catch (e) { console.log('FAIL throw', k, p, e.message.slice(0, 160)); fail++; continue; }
    if (m1 !== m2) { console.log('FAIL not seek-stable', k, p); fail++; } if (m1 === s0) { console.log('FAIL no change at', k, p); fail++; }
    const f = path.join(dir, `${k}-${p}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); shots.push(f); }
  files.push([`${k} (${kind})`, shots]);
}
const errs = pageErrors(h.errors); if (errs.length) { console.log('page errors', errs.slice(0, 4)); fail++; } await h.close();
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
console.log(fail ? `FAIL ${fail}` : `tx dom: ${K.dom.length} DOM back-ends + ${K.approx.length} approximations pass (endpoints pixel-exact against A alone / B alone: ${ends} of ${keys.length}; seek-stable, visible change)`); process.exit(fail || ends !== keys.length ? 1 : 0);
