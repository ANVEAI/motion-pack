/* card systems + corner pin + evidence board + doc supers + invert flash / brand field: pure maths in node, then a Chrome pass that renders every
   canvas system, proves seek stability (t, other t, t again = same pixels), and writes type/demo/out/cards.png (one tile per system).
   run: node type/tests/cards.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
import { cardsAt, stackFlipTimes, CARDS } from '../gfx/cards.js'; import { homography, applyH, matrix3d, cornersAt, lintQuad, PIN_LAYOUTS } from '../gfx/cornerpin.js';
import { boardAt, BOARD_D, qsplit } from '../gfx/board.js'; import { renderSVG, sfxFor, GFX } from '../gfx/index.js'; import { safeFlashes, lintFlashes, K2D } from '../../layers/canvas2d.js';
import { open, reporter, ROOT } from '../../layers/tests/harness.mjs';
const R = reporter('cards'), S = { W: 1920, H: 1080 }, J = (x) => JSON.stringify(x), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

/* 1. determinism: same state for the same t in any order, for both card systems and the board */
const rng = (() => { let a = 7; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
for (const id of Object.keys(CARDS)) { const ts = Array.from({ length: 80 }, () => rng() * 6), a = ts.map((t) => J(cardsAt(id, t, {}, S))), b = [...ts].reverse().map((t) => J(cardsAt(id, t, {}, S))).reverse();
  R.check(`${id}: same cards for the same t in any order (80 random seeks), finite`, a.every((v, i) => v === b[i]) && !a.some((v) => /NaN|null|Infinity/.test(v))); }
const bts = [0.1, 0.7, 1.3, 2.2, 3.9], ba = bts.map((t) => J(boardAt(t, BOARD_D, S))), bb = [...bts].reverse().map((t) => J(boardAt(t, BOARD_D, S))).reverse();
R.check('evidenceBoard: same state for the same t in any order', ba.every((v, i) => v === bb[i]));

/* 2. cardStack: riffle contract */
const P = { riffleAt: 0.5, every: 0.14, flipDur: 0.22, n: 6, count: 9, images: 12 }, st = (t) => cardsAt('layout.cardStack', t, P, S);
const top = (t) => st(t).at(-1), fl = stackFlipTimes(P);
R.check('cardStack: all backs before the riffle; flip k lands on top with image k; a card shows its back until mid-flip', st(0.49).every((c) => c.face === 'back') && top(fl[3].t + 0.12).img === 3 && top(fl[3].t + 0.12).face === 'front' && (() => { const c = st(fl[0].t + 0.05).find((x) => x.z === 6); return c.face === 'back' && c.sx < 1 && c.lift > 0; })());
R.check('cardStack: flips beyond n re-flip cards (front -> front with the next image); flip times are riffleAt + k * every', fl.length === 9 && near(fl[8].t, 0.5 + 8 * 0.14, 1e-6) && top(fl[8].t + 0.3).img === 8 && st(fl[8].t + 0.05).some((c) => c.z === 6 + 8 && c.face === 'front' && c.img === 2));
R.check('cardStack: inline placement (x, y) moves the stack centre; cards pop in from enterAt', (() => { const c = cardsAt('layout.cardStack', 2, { x: 0.25, y: 0.3 }, S); const mx = c.reduce((a, q) => a + q.x, 0) / c.length; return Math.abs(mx - 480) < 40 && cardsAt('layout.cardStack', -0.01, {}, S).length === 0; })());

/* 3. cardRiver: lanes stream along the angle, keep-out rects stay clear, the layout is seeded */
const RV = { keepOut: [{ x: 0.5, y: 0.5, w: 0.5, h: 0.14 }], speed: 600 };
let clear = true; for (let t = 0; t < 4; t += 0.1) for (const c of cardsAt('layout.cardRiver', t, RV, S)) { const r = Math.hypot(c.w, c.h) / 2 * 0.62; if (c.x + r > 960 - 480 && c.x - r < 960 + 480 && c.y + r > 540 - 76 && c.y - r < 540 + 76) clear = false; }
R.check('cardRiver: no card centre-disc enters the keep-out rect (40 frames x every card): words sit still in the gap', clear);
const r0 = cardsAt('layout.cardRiver', 1, { lanes: [0] }, S), r1 = cardsAt('layout.cardRiver', 1 + 1 / 30, { lanes: [0] }, S), mv = r0.map((c, i) => [r1[i].x - c.x, r1[i].y - c.y]).filter(([dx, dy]) => Math.hypot(dx, dy) < 100);
R.check('cardRiver: cards travel along the lane angle at speed (px/frame = speed / fps)', mv.length > 3 && mv.every(([dx, dy]) => near(Math.atan2(dy, dx), -28 * Math.PI / 180, 0.01) && near(Math.hypot(dx, dy), 520 / 30, 0.05)), J(mv.slice(0, 2)));
R.check('cardRiver: seed changes the layout, same seed reproduces it', J(cardsAt('layout.cardRiver', 1, { seed: 3 }, S)) !== J(cardsAt('layout.cardRiver', 1, { seed: 4 }, S)) && J(cardsAt('layout.cardRiver', 1, { seed: 3 }, S)) === J(cardsAt('layout.cardRiver', 1, { seed: 3 }, S)));

/* 4. corner pin maths */
const q = [[612, 233], [1388, 300], [1351, 829], [520, 761]], Hm = homography([[0, 0], [600, 0], [600, 380], [0, 380]], q);
R.check('homography maps the 4 source corners onto the quad (< 1e-6 px)', [[0, 0], [600, 0], [600, 380], [0, 380]].every((p, i) => Math.hypot(applyH(Hm, p)[0] - q[i][0], applyH(Hm, p)[1] - q[i][1]) < 1e-6));
const m = matrix3d(600, 380, q).slice(9, -1).split(',').map(Number), cssMap = ([x, y]) => { const w = m[3] * x + m[7] * y + m[15]; return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w]; };
R.check('matrix3d (CSS column-major) lands each element corner on its quad corner', [[0, 0], [600, 0], [600, 380], [0, 380]].every((p, i) => Math.hypot(cssMap(p)[0] - q[i][0], cssMap(p)[1] - q[i][1]) < 1e-3));
const keys = [{ t: 0, q }, { t: 1, q: q.map(([x, y]) => [x + 100, y - 50]) }];
R.check('cornersAt: static quads pass through, keys interpolate (linear by default), clamp outside the key range', J(cornersAt(5, q)) === J(q) && near(cornersAt(0.5, keys)[2][0], 1401, 1e-9) && J(cornersAt(-1, keys)) === J(q) && near(cornersAt(9, keys)[0][1], 183, 1e-9));
R.check('lintQuad flags a crossed (wrong corner order) quad, passes a convex one', lintQuad(q).length === 0 && lintQuad([q[0], q[2], q[1], q[3]]).length === 1);
const pl = PIN_LAYOUTS['layout.cornerPin'], ps = pl.at(0.05, { ...pl.d, at: 0.0, fadeIn: 0.1 }, S).slots[0];
R.check('layout.cornerPin slot: transform-origin 0 0, a matrix3d, opacity follows fadeIn', ps.transformOrigin === '0 0' && /^matrix3d\(/.test(ps.transform) && near(+ps.opacity, 0.5, 1e-3));

/* 5. evidence board */
const b1 = boardAt(0.5, BOARD_D, S), b9 = boardAt(9, BOARD_D, S);
R.check('evidenceBoard: slots pin on in stagger order, strings draw on after, the title slaps on at title.at', b1.slots.filter((s) => s.k).length === 5 && b1.strings.every((s) => s.k === 0) && b9.strings.every((s) => near(s.k, 1)) && boardAt(BOARD_D.title.at - 0.01, BOARD_D, S).title.k === 0 && b9.title.k === 1);
R.check('evidenceBoard: the push eases from push.from to push.to', J(Object.values(boardAt(0, BOARD_D, S).cam)) === J(BOARD_D.push.from) && Object.values(b9.cam).every((v, i) => near(v, BOARD_D.push.to[i], 1e-9)));
const [A0, , E0] = qsplit([0, 0], [5, 10], [10, 0], 1), [, , Eh] = qsplit([0, 0], [5, 10], [10, 0], 0.5);
R.check('string draw-on: the de Casteljau split ends on B at k = 1 and on the curve midpoint at k = 0.5', J(E0) === J([10, 0]) && near(Eh[0], 5) && near(Eh[1], 5) && J(A0) === J([0, 0]));

/* 6. doc supers, flash budget, brand field registry */
const ds = renderSVG('lowerThird.docSuper', 0.6, { at: 0, params: { name: 'The idea' } }), sg0 = renderSVG('caption.subtitleSpeedGag', 0.3, { at: 0 }), sg1 = renderSVG('caption.subtitleSpeedGag', 1.2, { at: 0 }), sg2 = renderSVG('caption.subtitleSpeedGag', 1.7, { at: 0 });
R.check('docSuper: the name is set in caps, condensed (scale x < 1), hidden before its start', ds.includes('THE IDEA') && /scale\(0\.8\d* 1\)/.test(ds) && renderSVG('lowerThird.docSuper', -0.1, { at: 0 }) === '');
R.check('subtitleSpeedGag: subtitle only, then the menu with 0.25 / 0.5 / 0.75 / Normal, then the pick (check mark + new line)', !sg0.includes('0.75') && ['0.25', '0.5', '0.75', 'Normal'].every((o) => sg1.includes('>' + o + '<')) && sg2.includes('✓') && sg2.includes(GFX['caption.subtitleSpeedGag'].d.after.replace(/\[|\]/g, '').split(' ')[0]));
R.check('new ids carry a default sound (sfxFor)', ['lowerThird.docSuper', 'caption.subtitleSpeedGag', 'layout.cardStack', 'layout.cardRiver', 'layout.cornerPin', 'layout.evidenceBoard'].every((id) => sfxFor(id) && /^sfx\//.test(sfxFor(id).id)));
R.check('invertFlash: at most 3 flash onsets in any second (extras dropped + linted), frames capped at 3', J(safeFlashes([0, 0.1, 0.2, 0.3, 1.25])) === J([0, 0.1, 0.2, 1.25]) && lintFlashes([0, 0.1, 0.2, 0.3]).length === 1 && lintFlashes([0, 2], { frames: 5 }).length === 1 && K2D.invertFlash.blend === 'difference');
R.check('brandField registered as a normal-blend canvas layer above the grain (order 97)', K2D.brandField && K2D.brandField.blend === 'normal' && K2D.brandField.order > 70);

/* 7. browser: render every canvas system, seek stability, and the contact sheet */
const h = await open('/type/demo/cards.html'); await h.page.setViewport({ width: 1920, height: 1080 });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-cards-')), tiles = [];
const CASES = [['layout.cardStack', {}, 0.2, 'stack before riffle', ''], ['layout.cardStack', { count: 12 }, 1.0, 'stack mid-riffle', ''],
  ['layout.cardStack', { x: 0.5, y: 0.5, cardH: 230, count: 10 }, 2.4, 'stack inline in a sentence', '<div class="word" style="right:1140px;top:490px">Ideas</div><div class="word" style="left:1140px;top:490px">everywhere.</div>'],
  ['layout.cardRiver', { samples: 1 }, 1.0, 'river, no blur', ''], ['layout.cardRiver', { keepOut: [{ x: 0.5, y: 0.5, w: 0.56, h: 0.14 }], samples: 6, speed: 720 }, 1.0, 'river, keep-out + 6-sample blur', '<div class="word" style="left:0;right:0;text-align:center;top:490px">Saved… somewhere.</div>'],
  ['layout.evidenceBoard', {}, 3.0, 'evidence board', '']];
for (const [id, params, t, label, words] of CASES) {
  await h.page.evaluate((i, p, w) => window.setup(i, p, { words: w }), id, params, words); await h.page.evaluate((tt) => window.at(tt), t); const a = await h.page.evaluate(() => window.hash());
  await h.page.evaluate((tt) => window.at(tt + 0.77), t); await h.page.evaluate((tt) => window.at(tt), t); const b = await h.page.evaluate(() => window.hash());
  R.check(`${label}: draws (${(100 * a.ink).toFixed(1)}% of pixels) and is seek-stable (t, t + 0.77, t -> identical pixels)`, a.ink > 0.01 && a.h === b.h);
  const f = path.join(dir, tiles.length + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } }); tiles.push([`${id} t=${t} ${label}`, f]);
}
R.check('no page errors', h.errors.filter((e) => !/favicon|404|willReadFrequently/.test(e)).length === 0, J(h.errors.slice(0, 3))); await h.close();
const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
console.log(execFileSync('python3', ['-I', '-c', py, path.join(ROOT, 'type/demo/out/cards.png'), JSON.stringify(tiles)]).toString().trim());
const res = R.done(); fs.writeFileSync(path.join(ROOT, 'type/tests/cards-last-run.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
