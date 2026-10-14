/* layers L7 parts (2026-10-14): look.duotone, look.threshold1bit (layers/stylize.js), background.gridTunnel, background.dotGrid (layers/backgrounds.js).
   Node: Bayer matrices, the JS reference maths, the .cube emitter, background determinism on a recording 2D context.
   Chrome (hardware GPU): the SVG filters on a DOM wrapper match the JS reference, the backgrounds mount through mountStack and re-render bit-identically
   after another t; writes the preview sheet layers/demo/out/l7-sheet.png.   run: node layers/tests/l7.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { bayer, stylizePixel, toCube, toSVGFilter, ditherAt, STYLIZE } from '../stylize.js'; import { cubeLookup } from '../grade.js'; import { BG } from '../backgrounds.js'; import { ALL_KINDS } from '../overlay.js';
import { open, reporter, decodePNG, ROOT } from './harness.mjs';
const R = reporter('layers L7'), here = path.dirname(fileURLToPath(import.meta.url)), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
/* 1. node: maths */
const m4 = bayer(4), m8 = bayer(8);
R.check('bayer(4) is the classic ordered-dither matrix; bayer(8) holds 0..63 once each', JSON.stringify(m4) === JSON.stringify([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) && new Set(m8.flat()).size === 64 && Math.max(...m8.flat()) === 63);
const P = STYLIZE.duotone.d, hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
R.check('duotone: black -> dark, white -> light, mid grey -> the midpoint; contrast 3 clamps a 0.3 grey to dark', stylizePixel('duotone', 0, 0, 0).every((v, i) => near(v, hex(P.dark)[i])) && stylizePixel('duotone', 1, 1, 1).every((v, i) => near(v, hex(P.light)[i])) &&
  stylizePixel('duotone', 0.5, 0.5, 0.5).every((v, i) => near(v, (hex(P.dark)[i] + hex(P.light)[i]) / 2)) && stylizePixel('duotone', 0.3, 0.3, 0.3, 0, 0, { contrast: 3 }).every((v, i) => near(v, hex(P.dark)[i])));
const cube = toCube('duotone', { dark: '#F5F2EA', light: '#4A18ED' }); let cmax = 0; for (const c of [[0.1, 0.4, 0.8], [0.9, 0.2, 0.1], [0.5, 0.5, 0.5], [0.33, 0.66, 0.2]]) { const a = cubeLookup(cube, c), b = stylizePixel('duotone', ...c, 0, 0, { dark: '#F5F2EA', light: '#4A18ED' }); cmax = Math.max(cmax, ...a.map((v, i) => Math.abs(v - b[i]))); }
R.check(`duotone .cube (33^3) matches the JS reference within ${(cmax * 255).toFixed(2)} levels (swapped colours = white line art on accent)`, cmax * 255 < 0.6);
const cover = (L, dither, n) => { let on = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) on += stylizePixel('threshold1bit', L, L, L, x, y, { dither, cell: 1 })[0] > 0.5 ? 1 : 0; return on / (n * n); };
R.check('threshold1bit: dither none is a hard step at the threshold; bayer4 / bayer8 cover a flat grey with exactly its level (0.25 -> 4/16, 0.5 -> 32/64)', cover(0.49, 'none', 4) === 0 && cover(0.51, 'none', 4) === 1 && cover(0.25, 'bayer4', 4) === 0.25 && cover(0.5, 'bayer8', 8) === 0.5 && cover(0.75, 'bayer8', 8) === 0.75);
R.check('dither cell scales with H (cell 2 @1080 = 1 px @540) and the SVG filter is synchronous (feFlood + feTile, no feImage / href)', ditherAt({ dither: 'bayer4', cell: 2 }, 1, 0, 540) !== ditherAt({ dither: 'bayer4', cell: 2 }, 0, 0, 540) && !/feImage|href/.test(toSVGFilter('threshold1bit', { dither: 'bayer8' })) && /feTile/.test(toSVGFilter('threshold1bit', { dither: 'bayer8' })));
let threw = 0; try { toSVGFilter('threshold1bit', { dither: 'bayer3' }); } catch { threw++; } try { toCube('threshold1bit'); } catch { threw++; } R.check('bad dither and a threshold .cube are refused', threw === 2);
/* backgrounds: a 2D context that records every call; the record at t must not depend on what was drawn before */
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' ? (...a) => { log.push('grad' + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s}${c}`) }; } : (...a) => log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')))), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (kind, t, p = {}) => { const { g, log } = recorder(); BG[kind].draw(g, 1920, 1080, t, { ...BG[kind].d, ...p }); return log.join('|'); };
let detOk = true; for (const kind of Object.keys(BG)) { const ts = [0.3, 2.7, 1.1, 0.3, 5.0, 2.7], first = {}; for (const t of ts) { const r = rec(kind, t, { drift: kind === 'dotGrid' ? [12, -6] : 0.5 }); if (first[t] && first[t] !== r) detOk = false; first[t] = r; } }
R.check('gridTunnel + dotGrid: the same t draws the same calls in any order (no history, no clock)', detOk);
R.check('gridTunnel drift moves the rings (t 0.3 != 0.7) and repeats after one ring period (t 0 == t 1/drift); drift 0 is still', rec('gridTunnel', 0.3) !== rec('gridTunnel', 0.7) && rec('gridTunnel', 0) === rec('gridTunnel', 2) && rec('gridTunnel', 0.3, { drift: 0 }) === rec('gridTunnel', 4.1, { drift: 0 }));
R.check('dotGrid is static without drift, moves with drift; both kinds mount through overlay.js (ALL_KINDS)', rec('dotGrid', 0.2) === rec('dotGrid', 3.9) && rec('dotGrid', 0.2, { drift: [20, 0] }) !== rec('dotGrid', 0.9, { drift: [20, 0] }) && ALL_KINDS().gridTunnel && ALL_KINDS().dotGrid);
/* 2. Chrome: SVG filters vs the JS reference, backgrounds in the DOM, preview sheet */
const h = await open('/layers/demo/l7.html'); await h.page.setViewport({ width: 960, height: 540 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-l7-')), tiles = [];
const shot = async (name) => { const f = path.join(dir, name + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); return f; };
await h.page.evaluate(() => window.look(null)); tiles.push(['plate (no look)', await shot('plate')]);
const LOOKS = [['duotone', {}, 'duotone accent -> paper'], ['duotone', { dark: '#F5F2EA', light: '#4A18ED', contrast: 1.6 }, 'duotone swapped: light lines on accent'], ['threshold1bit', { dither: 'none' }, 'threshold1bit dither none'], ['threshold1bit', { dither: 'bayer4', cell: 2 }, 'threshold1bit bayer4'], ['threshold1bit', { dither: 'bayer8', cell: 4, dark: '#4A18ED' }, 'threshold1bit bayer8 cell 4 on accent']];
for (const [kind, params, label] of LOOKS) {
  await h.page.evaluate((k, p) => window.look(k, p), kind, params); const f = await shot(kind + tiles.length), got = decodePNG(fs.readFileSync(f)).rgba, ref = Buffer.from(await h.page.evaluate((k, p) => window.ref(k, p), kind, params), 'base64');
  let sum = 0, bad = 0; const n = 960 * 540; for (let i = 0; i < n; i++) { const d = Math.max(...[0, 1, 2].map((c) => Math.abs(got[i * 4 + c] - ref[i * 4 + c]))); sum += d; if (d > 24) bad++; }
  const mean = sum / n, frac = bad / n;
  R.check(`${label}: SVG filter (DOM) vs JS reference: mean ${mean.toFixed(2)} levels, ${(frac * 100).toFixed(2)}% pixels off by > 24`, kind === 'duotone' ? mean < 1.5 && frac < 0.001 : frac < 0.02, '');
  tiles.push([label, f]);
}
let emptyOk = true; const plateRGBA = decodePNG(fs.readFileSync(tiles[0][1])).rgba;
for (const [kind, params] of [['duotone', {}], ['threshold1bit', { dither: 'none' }], ['threshold1bit', { dither: 'bayer8', cell: 4 }]]) { await h.page.evaluate((k, p) => window.lookEmpty(k, p), kind, params); const g = decodePNG(fs.readFileSync(await shot('empty-' + kind + (params.dither || '')))).rgba; if (Buffer.compare(Buffer.from(g), Buffer.from(plateRGBA)) !== 0) emptyOk = false; }
R.check('a look on an empty (transparent or hidden) layer paints nothing: the Bayer tile never leaks outside the source coverage', emptyOk);
await h.page.evaluate(() => window.clearAll());
for (const [kind, params, label] of [['gridTunnel', {}, 'gridTunnel (accent on paper)'], ['gridTunnel', { color: '#F5F2EA', bg: '#4A18ED', vp: [0.62, 0.45], lines: 10, zoom: 0.05 }, 'gridTunnel reversed, off-centre vp'], ['dotGrid', { hole: 0.22, glow: 0.7 }, 'dotGrid glow + clear hole'], ['dotGrid', { color: '#F5F2EA', bg: '#4A18ED', spacing: 28, radius: 2.2, fade: 0.8, glow: 0.5, glowColor: '#8E6BFF' }, 'dotGrid reversed']]) {
  const kinds = await h.page.evaluate((k, p) => window.bg(k, p, 1.3), kind, params); const a = await h.page.evaluate(() => window.bgPixels());
  await h.page.evaluate(() => window.bgAgain(3.7)); await h.page.evaluate(() => window.bgAgain(1.3)); const b = await h.page.evaluate(() => window.bgPixels());
  R.check(`${label}: mounted via mountStack (${kinds}), bit-identical at t 1.3 after rendering t 3.7`, kinds[0] === kind && a === b);
  tiles.push([label, await shot(kind + tiles.length)]);
}
const errs = h.errors.filter((e) => !/favicon|404/.test(e)); R.check('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
const out = path.join(ROOT, 'layers/demo/out/l7-sheet.png');
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(tiles)]).toString().trim());
const res = R.done(); fs.writeFileSync(path.join(here, 'last-run-l7.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
