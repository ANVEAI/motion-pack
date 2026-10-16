/* node type/tests/r78-sheet.mjs (xp-r78, 2026-10-16): contact sheet of the r78 gfx parts at a hero time over a busy plate (stripes, dots and a bright block, so a blur is visible),
   16:9 and 9:16 tiles -> type/demo/out/gfx-r78.png + .jpg (the committed preview). Also a smoke test in a real browser: every part is non-empty at its hero time, empty before its
   start, and the same markup twice (seek-stable). ui.glassPanel is drawn in BOTH modes: the backdrop mode (CSS backdrop-filter in a foreignObject) must blur the plate (the pixels
   inside the panel are measurably smoother than the plate), and the plate mode must agree with it within a tolerance on the same picture.
   Needs puppeteer-core + Chrome (tools/chrome.mjs). Software GL is allowed here: nothing in these parts uses WebGL. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { open, ROOT, pageErrors, decodePNG } from '../../layers/tests/harness.mjs';
const HERO = { 'ui.glassPanel': 1.6, 'ui.rimLight': 1.0, 'ui.reviewLayer': 3.6, 'ui.approvalSlider': 3.4, 'type.sentenceAcrossShots': 1.9, 'layout.textWall': 3.6, 'layout.pillWall': 2.2, 'device.lockScreen': 3.6 };
const PLATES = { 'ui.rimLight': '#07080C', 'layout.textWall': '#14161D', 'layout.pillWall': '#14161D' };
const PLATE = 'repeating-linear-gradient(115deg,#ff5f6d 0 60px,#ffc371 60px 120px,#2b86c5 120px 190px,#1a1a2e 190px 260px)';
const h = await open('/type/demo/gfx.html', '', { allowSoftware: true }); let fail = 0; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-r78-')), tiles = [];
const show = (id, t, W, H, params = {}, plate = PLATE) => h.page.evaluate((i, tt, w, hh, pp, pl) => { const on = window.show(i, tt, pp, w, hh, { light: false }); document.getElementById('bg').style.background = pl; return on; }, id, t, W, H, params, plate);
for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
  await h.page.setViewport({ width: W, height: H });
  for (const [id, t] of Object.entries(HERO)) {
    const on = await show(id, t, W, H, {}, PLATES[id] || PLATE); const a = await h.page.evaluate(() => document.getElementById('ov').innerHTML); await show(id, t, W, H, {}, PLATES[id] || PLATE); const b = await h.page.evaluate(() => document.getElementById('ov').innerHTML);
    const pre = await show(id, -0.5, W, H, {}, PLATES[id] || PLATE); await show(id, t, W, H, {}, PLATES[id] || PLATE);
    if (!on) { console.log('FAIL empty at hero time', id, W, H); fail++; } if (a !== b) { console.log('FAIL not seek-stable', id); fail++; } if (pre) { console.log('FAIL visible before start', id); fail++; }
    const f = path.join(dir, `${id}-${W}.png`); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: W, height: H } }); tiles.push([`${id} ${W}x${H}`, f]);
  }
}
/* glass: the blur is real, and the two modes agree */
await h.page.setViewport({ width: 1920, height: 1080 });
const shot = async (params, plate) => { await show('ui.glassPanel', 2.5, 1920, 1080, params, plate); const f = path.join(dir, 'g.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); return decodePNG(fs.readFileSync(f)); };
const roughness = (im, x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y += 2) for (let x = x0 + 1; x < x1; x += 1) { const i = (y * im.w + x) * 4, j = i - 4; s += Math.abs(im.rgba[i] - im.rgba[j]) + Math.abs(im.rgba[i + 1] - im.rgba[j + 1]) + Math.abs(im.rgba[i + 2] - im.rgba[j + 2]) > 90 ? 1 : 0; n++; } return (1000 * s) / n; };   // sharp horizontal steps per 1000 px
const box = { x0: 700, y0: 330, x1: 1220, y1: 760 };   // inside the default box [0.3, 0.24, 0.4, 0.5] at 1920x1080, clear of the skeleton bars
const off = await shot({ blur: 0, saturate: 1, tintAlpha: 0, grain: 0, skeleton: 0, edgeAlpha: 0, shadow: 0 }), on = await shot({ blur: 24, skeleton: 0, grain: 0 }), pl = await shot({ blur: 24, skeleton: 0, grain: 0, plate: { colors: ['#ff5f6d', '#ffc371', '#2b86c5', '#1a1a2e'], angle: 115 } });
const r0 = roughness(off, box.x0, box.y0, box.x1, box.y1), r1 = roughness(on, box.x0, box.y0, box.x1, box.y1), r2 = roughness(pl, box.x0, box.y0, box.x1, box.y1);
if (!(r1 < r0 * 0.25)) { console.log(`FAIL backdrop mode does not blur: roughness ${r1.toFixed(2)} vs unblurred ${r0.toFixed(2)}`); fail++; } else console.log(`backdrop mode blurs: roughness ${r0.toFixed(1)} -> ${r1.toFixed(1)}`);
if (!(r2 < r0 * 0.6)) { console.log(`FAIL plate mode does not blur: roughness ${r2.toFixed(2)} vs unblurred ${r0.toFixed(2)}`); fail++; } else console.log(`plate mode blurs: roughness ${r0.toFixed(1)} -> ${r2.toFixed(1)}`);

/* the two modes agree: on a horizontal 4-colour gradient the blurred backdrop and the plate-mode copy of it give the same colours across the panel (mean abs difference per channel, 0..255) */
{ const G4 = ['#ff5f6d', '#ffc371', '#2b86c5', '#1a1a2e'], css = `linear-gradient(90deg,${G4.join(',')})`, a = await shot({ blur: 24, skeleton: 0, grain: 0, shadow: 0, edgeAlpha: 0 }, css), b = await shot({ blur: 24, skeleton: 0, grain: 0, shadow: 0, edgeAlpha: 0, plate: { colors: G4, angle: 0 } }, css);
  let d = 0, n = 0; for (let y = 400; y < 700; y += 20) for (let x = 740; x < 1180; x += 10) { const i = (y * a.w + x) * 4; d += Math.abs(a.rgba[i] - b.rgba[i]) + Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) + Math.abs(a.rgba[i + 2] - b.rgba[i + 2]); n += 3; }
  const md = d / n; if (!(md < 10)) { console.log(`FAIL backdrop and plate modes disagree: mean abs diff ${md.toFixed(2)} / 255`); fail++; } else console.log(`backdrop and plate modes agree: mean abs diff ${md.toFixed(2)} / 255`); }
const errs = pageErrors(h.errors); if (errs.length) { console.log('page errors:', errs.slice(0, 5)); fail++; } await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); wide = [x for x in items if '1920x' in x[0]]; tall = [x for x in items if '1080x1920' in x[0]]
tw, th, cols = 640, 360, 3; rows = (len(wide) + cols - 1) // cols; rows2 = (len(tall) + 4) // 5
S = Image.new('RGB', (tw * cols, th * rows + 405 * ((len(tall) + 7) // 8)), (20, 20, 22))
for i, (n, f) in enumerate(wide):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 260, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
for i, (n, f) in enumerate(tall):
    im = Image.open(f).convert('RGB').resize((225, 400), Image.LANCZOS); x, y = 6 + (i % 8) * 238, th * rows + 3 + (i // 8) * 405; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 150, y + 14), fill=(0, 0, 0)); d.text((x + 3, y + 2), n.split(' ')[0], fill=(255, 255, 255))
S.save(sys.argv[1]); S.save(sys.argv[1][:-4] + '.jpg', quality=84); print('sheet', sys.argv[1], S.size)`;
fs.mkdirSync(path.join(ROOT, 'type/demo/out'), { recursive: true });
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'type/demo/out/gfx-r78.png'), JSON.stringify(tiles)]).toString().trim());
console.log(fail ? `FAIL ${fail}` : `r78 parts: ${Object.keys(HERO).length} ids x 2 aspects rendered, seek-stable, hidden before start; glass blurs in both modes`); process.exit(fail ? 1 : 0);
