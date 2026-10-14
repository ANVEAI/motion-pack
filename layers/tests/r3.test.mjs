/* layers round-3 parts (2026-10-14): background.meshGradient (backgrounds.js), look.gradeIn (stylize.js), layers.dotCondense + overlay.hologramBeam (canvas2d-r3.js).
   Node: closed-form maths (weights, gradient map, cube, dot arrival, loop period), determinism on a recording 2D context.
   Chrome (hardware GPU): the gradeIn SVG filter matches the JS reference at three weights, every kind mounts through mountStack and re-renders
   bit-identically after another t, no console errors; writes the preview sheet layers/demo/out/r3-sheet.png.   run: node layers/tests/r3.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { gradeInWeight, gradeInPixel, gradientMap, gradeInSVG, gradeInCube, GRADE_IN, hexRGB } from '../stylize.js'; import { cubeLookup } from '../grade.js';
import { BG, meshBlob } from '../backgrounds.js'; import { K2D } from '../canvas2d.js'; import { dotCondenseState, hologramState } from '../canvas2d-r3.js'; import { ALL_KINDS } from '../overlay.js';
import { open, reporter, decodePNG, ROOT } from './harness.mjs';
const R = reporter('layers round 3'), here = path.dirname(fileURLToPath(import.meta.url)), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
/* 1. node */
R.check('gradeIn weight: 1 before at, 0 after at + dur, 0.5 at the midpoint (soft ease); reverse mirrors it; amount scales it',
  gradeInWeight(-1) === 1 && gradeInWeight(5) === 0 && near(gradeInWeight(0.6), 0.5) && gradeInWeight(-1, { reverse: true }) === 0 && gradeInWeight(5, { reverse: true }) === 1 && near(gradeInWeight(-1, { amount: 0.4 }), 0.4));
const st3 = GRADE_IN.d.stops.map(hexRGB);
R.check('gradient map: black -> first stop, white -> last stop, mid grey -> the middle stop (3 stops), any t after the window returns the source exactly',
  gradientMap(0, GRADE_IN.d.stops).every((v, i) => near(v, st3[0][i])) && gradientMap(1, GRADE_IN.d.stops).every((v, i) => near(v, st3[2][i])) && gradientMap(0.5, GRADE_IN.d.stops).every((v, i) => near(v, st3[1][i])) &&
  JSON.stringify(gradeInPixel(0.3, 0.6, 0.1, 9)) === JSON.stringify([0.3, 0.6, 0.1]));
let cmax = 0; const cube = gradeInCube({}, 0.5); for (const c of [[0.1, 0.4, 0.8], [0.9, 0.2, 0.1], [0.5, 0.5, 0.5]]) { const a = cubeLookup(cube, c), b = gradeInPixel(...c, 0, {}, 0.5); cmax = Math.max(cmax, ...a.map((v, i) => Math.abs(v - b[i]))); }
R.check(`gradeIn .cube at weight 0.5 matches the JS reference within ${(cmax * 255).toFixed(2)} levels; the SVG uses a table transfer and an arithmetic mix`, cmax * 255 < 1.5 && /type="table"/.test(gradeInSVG()) && /operator="arithmetic"/.test(gradeInSVG()));
let threw = 0; try { gradeInWeight(0, { stops: ['#000000'] }); } catch { threw++; } try { gradeInWeight(0, { ease: 'bouncy' }); } catch { threw++; } R.check('gradeIn refuses one stop and an unknown ease', threw === 2);
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? (...a) => { log.push(String(k) + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s}${c}`) }; } : (...a) => log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')))), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (draw, d, t, p = {}) => { const { g, log } = recorder(); draw(g, 1920, 1080, t, { ...d, ...p }); return log.join('|'); };
let det = true; for (const [name, k] of [['meshGradient', BG.meshGradient], ['dotCondense', K2D.dotCondense], ['hologramBeam', K2D.hologramBeam]]) { const seen = {}; for (const t of [0.4, 2.9, 1.3, 0.4, 6, 2.9]) { const r = rec(k.draw, k.d, t, name === 'dotCondense' ? { toColor: '#4A18ED' } : {}); if (seen[t] && seen[t] !== r) det = false; seen[t] = r; } }
R.check('meshGradient, dotCondense, hologramBeam: the same t draws the same calls in any order (no history, no clock)', det);
const md = { ...BG.meshGradient.d, loop: 8 }; let loopOk = true; for (let i = 0; i < 5; i++) for (const t of [0, 1.7, 3.3]) { const a = meshBlob(i, t, md), b = meshBlob(i, t + 8, md); if (!near(a.x, b.x, 1e-9) || !near(a.y, b.y, 1e-9) || !near(a.r, b.r, 1e-9)) loopOk = false; }
R.check('meshGradient loop 8: every blob repeats exactly after 8 s; without loop the field moves (t 0 != t 3)', loopOk && rec(BG.meshGradient.draw, BG.meshGradient.d, 0) !== rec(BG.meshGradient.draw, BG.meshGradient.d, 3));
const pre = dotCondenseState(0.5, { to: 'fewer', n: 220, count: 20 }), post = dotCondenseState(4, { to: 'fewer', n: 220, count: 20 }), uniq = new Set(post.map((d) => d.x.toFixed(3) + ',' + d.y.toFixed(3)));
const area = (s) => s.reduce((a, d) => a + d.r * d.r, 0), areaUniq = [...uniq].reduce((a, key) => a + post.find((d) => d.x.toFixed(3) + ',' + d.y.toFixed(3) === key).r ** 2, 0);
R.check(`dotCondense fewer: 220 dots before the cue, ${uniq.size} after; merged dots keep the total ink area (${(areaUniq / area(pre)).toFixed(3)} of the start)`, new Set(pre.map((d) => d.x.toFixed(3))).size === 220 && uniq.size === 20 && near(areaUniq / area(pre), 1, 1e-6) && pre.every((d) => d.k === 0) && post.every((d) => d.k === 1));
const line = dotCondenseState(4, { to: 'line', n: 120, count: 24, line: [0.2, 0.5, 0.8, 0.5] });
R.check('dotCondense line: every dot lands on the line between its ends; nothing mid-flight after at + stagger + dur', line.every((d) => near(d.y, 540, 1e-9) && d.x >= 384 - 1e-9 && d.x <= 1536 + 1e-9 && d.k === 1));
const hs0 = hologramState(-1, { at: 0 }), hs1 = hologramState(5, { at: 0 });
R.check('hologramBeam: off before at, beam and window fully on after at + on; all kinds mount through overlay.js', hs0.beam === 0 && hs0.win === 0 && hs1.beam === 1 && hs1.win === 1 && ['meshGradient', 'dotCondense', 'hologramBeam'].every((k) => ALL_KINDS()[k]));
/* 2. Chrome */
const h = await open('/layers/demo/r3.html'); await h.page.setViewport({ width: 960, height: 540 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-r3-')), tiles = [];
const shot = async (name) => { const f = path.join(dir, name + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); return f; };
await h.page.evaluate(() => window.clearAll()); tiles.push(['plate (no look)', await shot('plate')]);
for (const t of [-0.5, 0.6, 1.0]) {
  const w = await h.page.evaluate((t) => window.grade({ at: 0, dur: 1.2 }, t), t), f = await shot('grade' + t), got = decodePNG(fs.readFileSync(f)).rgba, ref = Buffer.from(await h.page.evaluate((t) => window.gradeRef({ at: 0, dur: 1.2 }, t), t), 'base64');
  let sum = 0, bad = 0; const n = 960 * 540; for (let i = 0; i < n; i++) { const d = Math.max(...[0, 1, 2].map((c) => Math.abs(got[i * 4 + c] - ref[i * 4 + c]))); sum += d; if (d > 12) bad++; }
  R.check(`gradeIn at t ${t} (map weight ${w.toFixed(2)}): SVG filter vs JS reference mean ${(sum / n).toFixed(2)} levels, ${(100 * bad / n).toFixed(3)}% pixels off by > 12`, sum / n < 1.5 && bad / n < 0.002);
  tiles.push([`look.gradeIn t=${t} (w ${w.toFixed(2)})`, f]);
}
const STACKS = [
  ['meshGradient peach + grain', [{ kind: 'meshGradient', params: {} }], 2.0],
  ['meshGradient dusk', [{ kind: 'meshGradient', params: { palette: 'dusk', blobs: 6 } }], 4.0],
  ['meshGradient sky (vertical base)', [{ kind: 'meshGradient', params: { palette: 'sky' } }], 1.0],
  ['dotCondense fewer, mid-flight', [{ kind: 'meshGradient', params: { palette: 'mint', grain: 0 } }, { kind: 'dotCondense', params: { to: 'fewer', count: 20, at: 0.2, toColor: '#4A18ED' } }], 1.15],
  ['dotCondense word, landed', [{ kind: 'meshGradient', params: { palette: 'lilac', grain: 0 } }, { kind: 'dotCondense', params: { to: 'word', text: 'one idea', n: 320, radius: 3.2, at: 0.2, toColor: '#4A18ED' } }], 3.0],
  ['hologramBeam window', [{ kind: 'meshGradient', params: { palette: 'ink', grain: 0 } }, { kind: 'hologramBeam', params: {} }], 1.4],
  ['hologramBeam globe', [{ kind: 'meshGradient', params: { palette: 'ink', grain: 0 } }, { kind: 'hologramBeam', params: { mode: 'globe', rect: [0.5, 0.12, 0.36, 0.64], color: '#9DFFB0' } }], 2.2],
];
for (const [label, layers, t] of STACKS) {
  const kinds = await h.page.evaluate((l, t) => window.stack(l, t), layers, t), a = await h.page.evaluate(() => window.pixels());
  await h.page.evaluate(() => window.again(0.37)); await h.page.evaluate((t) => window.again(t), t); const b = await h.page.evaluate(() => window.pixels());
  R.check(`${label}: mounted via mountStack (${kinds.join(' + ')}), bit-identical at t ${t} after rendering t 0.37`, kinds.length === layers.length && a === b);
  tiles.push([label + ` t=${t}`, await shot('s' + tiles.length)]);
}
const errs = h.errors.filter((e) => !/favicon|404/.test(e)); R.check('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
const out = path.join(ROOT, 'layers/demo/out/r3-sheet.png');
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(tiles)]).toString().trim());
const res = R.done(); fs.writeFileSync(path.join(here, 'last-run-r3.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
