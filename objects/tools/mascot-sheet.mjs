/* objects/mascot2d checks + pose sheet: node objects/tools/mascot-sheet.mjs
   node: the SVG for a t is identical in any order (seek-safe), every pose differs, hops squash and stretch, blinks close the eyes, the canvas back-end draws.
   Chrome: renders every pose (and a hop / dive strip) as SVG -> objects/qa/mascot2d/poses.png. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
import { mascotSVG, mascotState, MASCOT_POSES } from '../characters/mascot2d.js'; import { open, reporter, ROOT } from '../../layers/tests/harness.mjs';
const R = reporter('objects/mascot2d');
const spec = { keys: [[0, 'idle'], [0.5, 'cheer'], [1.6, 'point'], [2.6, 'dive']], path: [[0, [500, 900]], [2.6, [1400, 700]]], scale: [[0, 1], [2.6, 0.4]], hops: [0.7, 1.15], blinks: [0.3, 2.0], talk: [[1.7, 2.4]], aim: [1500, 300] };
const ts = [0.1, 2.2, 0.9, 3.4, 0.1, 1.3, 2.2], seen = {}; let det = true; for (const t of ts) { const s = mascotSVG(t, spec); if (seen[t] && seen[t] !== s) det = false; seen[t] = s; }
R.check('mascotSVG: the same t gives the same SVG in any order (closed-form springs, no state)', det);
const svgs = Object.keys(MASCOT_POSES).map((p) => mascotSVG(3, { keys: [[0, p]] })); R.check(`all ${svgs.length} poses draw differently`, new Set(svgs).size === svgs.length);
const hop = (t) => mascotState(t, { hops: [1] }); R.check('hop: anticipation squash before take-off, lift in the air, landing squash after, still before and long after', hop(0.95).sy < 0.99 && hop(1.225).hopY < -50 && hop(1.5).sy < 0.99 && hop(0.5).sy === 1 && hop(3).sy === 1 && hop(3).hopY === 0);
R.check('blink closes the eyes for 0.14 s; dive stretches the body and leans it forward', mascotState(1.07, { blinks: [1] }).eye < 0.2 && mascotState(1.5, { blinks: [1] }).eye === 1 && mascotState(4, { keys: [[0, 'dive']] }).sy > 1.15 && mascotState(4, { keys: [[0, 'dive']] }).lean > 55);
const h = await open('/objects/tools/mascot-page.html'); await h.page.setViewport({ width: 1920, height: 1080 });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-mascot-')), files = [];
for (const p of Object.keys(MASCOT_POSES)) { await h.page.evaluate((p) => window.show({ keys: [[0, 'idle'], [0.2, p]], path: [[0, [960, 860]]], size: 2.4, talk: p === 'point' ? [[1.0, 1.4]] : [] }, 1.2), p); const f = path.join(dir, p + '.png'); await h.page.screenshot({ path: f, clip: { x: 360, y: 60, width: 1200, height: 900 } }); files.push([p, f]); }
for (const t of [0.66, 0.85, 1.2]) { await h.page.evaluate((t) => window.show({ keys: [[0, 'cheer']], path: [[0, [960, 860]]], size: 2.4, hops: [0.7] }, t), t); const f = path.join(dir, 'hop' + t + '.png'); await h.page.screenshot({ path: f, clip: { x: 360, y: 60, width: 1200, height: 900 } }); files.push(['cheer hop t=' + t, f]); }
const canvasOk = await h.page.evaluate(() => window.canvasDraws()); R.check('canvas back-end (drawMascot2d) paints the same rig', canvasOk);
R.check('no console errors', h.errors.filter((e) => !/favicon|404/.test(e)).length === 0, JSON.stringify(h.errors.slice(0, 3))); await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 5; tw = 400; th = 300; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (240, 236, 228))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.text((x + 8, y + 6), n, fill=(30, 27, 38))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'objects/qa/mascot2d/poses.png'), JSON.stringify(files)]).toString().trim());
const res = R.done(); fs.writeFileSync(path.join(ROOT, 'objects/qa/mascot2d/last-run.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
