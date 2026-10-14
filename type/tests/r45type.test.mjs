/* round-4/5 type parts (type/gfx/r45-type.js, r45-glyph.js, pathsample.js). Node only by default (CI runs this): run: node type/tests/r45type.test.mjs
   Every id: registered, non-empty at its hero time, empty before `at`, identical SVG in shuffled seek order, NaN-free over [-1, 8] s, its cues and default sound
   resolve in sfx/manifest.json. Behaviour: partner marks get equal ink area (16:9 row and 9:16 stack) and an unlicensed asset is refused; icon fills land on
   the planned hit frames and the name holds at the end; the mosaic at hold matches its image (SSIM on the cell grid); text-on-path spacing stays even on a
   tight curve; flank words never cover the subject box; the electric crackle is frame-deterministic; behindSubject composites plate -> type -> matted plate.
   --chrome (local, real Chrome): behindSubject with a synthetic gradient matte occludes the type exactly where the matte is >= 0.5 (hard edge), and the
   rendered mosaic correlates with its image in pixels. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, gfxCues, sfxFor, partnerLockupLayout, lintPartnerMarks, iconMergeState, asciiMosaicGrid, textOnPathState, flankState, flankShots, flattenPath, arcTable } from '../gfx/index.js';
import { ctxFor } from '../gfx/core.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  | ' + info : ''}`); };
const rng = (() => { let a = 45; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const IDS = ['title.partnerLockup', 'layout.iconMergeLockup', 'type.asciiMosaic', 'type.textOnPath', 'type.flankWords', 'type.electricOutline', 'type.behindSubject'];
const ts = Array.from({ length: 90 }, (_, i) => -1 + i * 0.1);
for (const id of IDS) {
  check(`${id}: registered`, !!GFX[id]); if (!GFX[id]) continue;
  const opts = { at: 0.5, params: {} }, fwd = ts.map((t) => renderSVG(id, t, opts)), shuf = new Map(shuffle(ts.map((_, i) => i)).map((i) => [i, renderSVG(id, ts[i], opts)]));
  check(`${id}: identical SVG in forward and shuffled seek order (${ts.length} seeks)`, fwd.every((s, i) => s === shuf.get(i)));
  check(`${id}: empty before at`, renderSVG(id, 0.49, opts) === '' && renderSVG(id, -1, opts) === '');
  check(`${id}: non-empty at at + 1 s`, renderSVG(id, 1.5, opts).length > 200);
  const bad = fwd.findIndex((s) => /NaN|undefined|Infinity/.test(s)); check(`${id}: finite numbers over [-1, 8] s`, bad < 0, bad >= 0 ? 't=' + ts[bad].toFixed(2) : '');
  const tall = renderSVG(id, 2.0, { at: 0 }, { W: 1080, H: 1920 }); check(`${id}: renders at 9:16 too`, tall.length > 200 && !/NaN|undefined|Infinity/.test(tall));
  const cues = gfxCues(id, { at: 2, params: {} }), d = sfxFor(id);
  check(`${id}: ${cues.length} action cues + default '${d && d.id}' resolve in sfx/`, cues.length > 0 && cues.every((c) => okSfx(c.id) && c.t >= 2) && !!d && okSfx(d.id), JSON.stringify(cues.filter((c) => !okSfx(c.id))));
}
const P = (id, extra = {}) => ({ ...GFX[id].d, ...extra }), wide = ctxFor(1920, 1080, null, 1), tallC = ctxFor(1080, 1920, null, 1);
/* partnerLockup */
for (const [c, name] of [[wide, '16:9 row'], [tallC, '9:16 stack']]) { const L = partnerLockupLayout(P('title.partnerLockup'), c), [a, b] = L.boxes, r = a.ink / b.ink, inside = L.boxes.every((x) => x.x >= c.safe.x0 - 0.5 && x.x + x.w <= c.safe.x1 + 0.5 && x.y >= c.safe.y0 - 0.5 && x.y + x.h <= c.safe.y1 + 0.5);
  check(`partnerLockup ${name}: ring (1:1) and bars (3:1) get equal ink area (ratio ${r.toFixed(3)}), heights differ (${a.h.toFixed(0)} vs ${b.h.toFixed(0)} px), inside the safe area`, Math.abs(r - 1) <= 0.1 && Math.abs(a.h - b.h) > 5 && inside && L.stack === (name !== '16:9 row')); }
{ const L = partnerLockupLayout(P('title.partnerLockup', { marks: ['tri', 'pill'] }), wide), g1 = L.divider.x - (L.boxes[0].x + L.boxes[0].w), g2 = L.boxes[1].x - L.divider.x;
  check(`partnerLockup: the divider sits mid-gap (equal gaps ${g1.toFixed(1)} / ${g2.toFixed(1)} px)`, Math.abs(g1 - g2) < 0.01); }
{ const bad = { href: 'theirs.png', w: 400, h: 100, ink: 0.4 }, ok = { href: 'ours.png', w: 400, h: 100, ink: 0.4, licensed: true };
  const sBad = renderSVG('title.partnerLockup', 2, { params: { marks: ['ring', bad] } }), sOk = renderSVG('title.partnerLockup', 2, { params: { marks: ['ring', ok] } });
  check('partnerLockup: a supplied mark without licensed: true is refused (dashed placeholder, no <image>) and the lint says why; with the flag it renders',
    sBad.includes('unlicensed mark') && !sBad.includes('theirs.png') && lintPartnerMarks({ marks: ['ring', bad] }).length === 1 && sOk.includes('href="ours.png"') && lintPartnerMarks({ marks: ['ring', ok] }).length === 0); }
/* iconMergeLockup */
{ const p = P('layout.iconMergeLockup'), F = p.fillF / 30; let ok = true; const info = [];
  p.hits.forEach((h, i) => { const before = iconMergeState(h - 1 / 30, p, wide).tiles[i].fill, at = iconMergeState(h + F, p, wide).tiles[i].fill; if (before !== 0 || Math.abs(at - 1) > 1e-9) ok = false; info.push(`${before.toFixed(2)}->${at.toFixed(2)}`); });
  const cues = gfxCues('layout.iconMergeLockup', { at: 0, params: {} }).filter((c) => c.id === 'sfx/hit/soft').map((c) => Math.round(c.t * 30)), plan = p.hits.map((h) => Math.round(h * 30));
  check(`iconMergeLockup: each tile is outline before its hit and solid ${p.fillF} frames after (${info.join(', ')}); hit cues on the plan frames ${plan.join(',')}`, ok && JSON.stringify(cues) === JSON.stringify(plan));
  const end = iconMergeState(4.3, p, wide); check('iconMergeLockup: at the end every icon has merged away and every letter of the name is on', end.tiles.every((t) => t.op === 0) && end.letters.every((l) => l.op === 1)); }
/* asciiMosaic: SSIM between the source luminance and the rendered level per cell, at hold */
const ssim = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let va = 0, vb = 0, cv = 0; for (let i = 0; i < n; i++) { va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; cv += (a[i] - ma) * (b[i] - mb); } va /= n - 1; vb /= n - 1; cv /= n - 1; const C1 = 0.01 ** 2, C2 = 0.03 ** 2; return ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); };
for (const image of ['bust', 'orb', 'spark']) { const p = P('type.asciiMosaic', { image }), G = asciiMosaicGrid(p, wide), s = ssim(G.cells.map((c) => c.lum), G.cells.map((c) => c.q / (p.levels - 1)));
  check(`asciiMosaic '${image}': ${G.cols} x ${G.rows} cells; at hold the glyph levels match the image (SSIM ${s.toFixed(4)} on the cell grid)`, s > 0.95 && G.rows > 10); }
{ const s = renderSVG('type.asciiMosaic', 3.2, { params: {} }), n = (s.match(/<text /g) || []).length, s0 = renderSVG('type.asciiMosaic', 0.2, { params: {} }), n0 = (s0.match(/<text /g) || []).length;
  const G = asciiMosaicGrid(P('type.asciiMosaic'), wide), lit = G.cells.filter((c) => c.lum >= 0.04).length;
  check(`asciiMosaic: the opening shows the text as one line (${n0} glyphs), the hold shows the mosaic (${n} glyphs = cells above the dark cutoff ${lit})`, n0 === [...P('type.asciiMosaic').text].length && n === lit); }
{ const p = { dissolveAt: 3.4 }, s = renderSVG('type.asciiMosaic', 4.6 + 0.2, { params: p }), s1 = renderSVG('type.asciiMosaic', 4.6, { params: p });
  check('asciiMosaic: dissolve returns the copies to the text line (only the text glyphs remain visible)', (s1.match(/<text /g) || []).length <= [...P('type.asciiMosaic').text].length + 5 || s === ''); }
/* textOnPath: even spacing on a tight curve (arc-length parameterisation) vs naive equal-t spacing */
{ const circle = 'M960 340 C1070 340 1160 430 1160 540 C1160 650 1070 740 960 740 C850 740 760 650 760 540 C760 430 850 340 960 340 Z', p = P('type.textOnPath', { path: circle, closed: true, mode: 'travel', speed: 0, start: 0, text: 'MMMMMMMMMMMMMMMMMMMM', font: "'IBM Plex Mono', monospace", size: 40 });
  const g = textOnPathState(1, p, wide).glyphs, ds = g.slice(1).map((q, i) => Math.hypot(q.x - g[i].x, q.y - g[i].y)), m = ds.reduce((a, b) => a + b, 0) / ds.length, cv = Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / ds.length) / m;
  const skew = 'M300 800 C300 200 320 190 1600 300', pts = flattenPath(skew, { seg: 400 }), naive = Array.from({ length: 20 }, (_, i) => pts[i * 20]), dn = naive.slice(1).map((q, i) => Math.hypot(q[0] - naive[i][0], q[1] - naive[i][1])), mn = dn.reduce((a, b) => a + b, 0) / dn.length, cvn = Math.sqrt(dn.reduce((a, b) => a + (b - mn) ** 2, 0) / dn.length) / mn;
  const gs = textOnPathState(1, { ...p, path: skew, closed: false }, wide).glyphs, d2 = gs.slice(1).map((q, i) => Math.hypot(q.x - gs[i].x, q.y - gs[i].y)), m2 = d2.reduce((a, b) => a + b, 0) / d2.length, cv2 = Math.sqrt(d2.reduce((a, b) => a + (b - m2) ** 2, 0) / d2.length) / m2;
  check(`textOnPath: glyph spacing CV ${(100 * cv).toFixed(2)}% on a 200 px circle and ${(100 * cv2).toFixed(2)}% on a skewed cubic (equal-t spacing on that cubic: ${(100 * cvn).toFixed(0)}%)`, cv < 0.01 && cv2 < 0.02 && cvn > 0.2); }
{ const p = P('type.textOnPath'), a = textOnPathState(p.delay + 0.5, p, wide), b = textOnPathState(p.delay + 1.5, p, wide), last = (st) => st.glyphs.at(-1).s;
  check('textOnPath trail: the text rides behind the leader (its last glyph stays gap + half a glyph behind) and moves with it', a.lead && b.lead.s > a.lead.s && Math.abs((b.lead.s - last(b)) - (a.lead.s - last(a))) < 1e-6 && last(b) < b.lead.s); }
/* flankWords */
{ let worst = Infinity; const keyed = { subject: { keys: [[0, [0.45, 0.3, 0.1, 0.4]], [1.2, [0.35, 0.2, 0.3, 0.6]], [2.0, [0.4, 0.15, 0.2, 0.7]]] } };
  for (const params of [{}, keyed, { words: ['Built', 'for', 'long', 'days'], subject: { box: [0.3, 0.1, 0.25, 0.8], arriveAt: 0.3, arrive: 0.8 } }]) for (let t = 0; t <= 2.6; t += 1 / 30) {
    const st = flankState(t, P('type.flankWords', params), wide), B = st.box; for (const w of st.words) { const gap = w.side === 'left' ? B.x - (w.x + w.w) : w.x - (B.x + B.w); worst = Math.min(worst, gap); } }
  const shots = flankShots('Made for long days and late nights', [[0, 3], [3, 7]], { size: 80, color: '#111111' });
  check(`flankWords: over static, growing and keyframed subjects the words never overlap the box (closest ${worst.toFixed(1)} px); flankShots carries one sentence across 2 shots in one style`,
    worst >= 0 && shots.map((s) => s.words.join(' ')).join(' ') === 'Made for long days and late nights' && shots.every((s) => s.size === 80 && s.color === '#111111')); }
/* electricOutline */
{ const a = renderSVG('type.electricOutline', 1.0, { params: {} }), b = renderSVG('type.electricOutline', 1.0, { params: {} }), c = renderSVG('type.electricOutline', 1.01, { params: {} }), d = renderSVG('type.electricOutline', 1.0 + 2 / 30, { params: {} });
  const h = (s) => { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); };
  check(`electricOutline: two renders hash the same (${h(a)}), the same frame is identical, the next crackle frame differs (seeded per frame, not Math.random)`, h(a) === h(b) && a === c && a !== d);
  const s0 = renderSVG('type.electricOutline', 0.05, { params: {} }), s1 = renderSVG('type.electricOutline', 1.5, { params: {} }), off = (s) => [...s.matchAll(/stroke-dashoffset="([\d.]+)"/g)].map((m) => +m[1]);
  check('electricOutline: strokes draw on (dash offset falls from near 100 to 0)', Math.max(...off(s0)) > 50 && Math.max(...off(s1)) === 0); }
/* behindSubject */
{ const s = renderSVG('type.behindSubject', 1, { params: { plate: { href: 'plate.png' }, matte: { href: 'matte.png' }, edge: 'hard' } }), i1 = s.indexOf('href="plate.png"'), it = s.indexOf('class="mp-type"'), im = s.indexOf('mask="url(#'), i2 = s.lastIndexOf('href="plate.png"');
  check('behindSubject: plate -> type -> plate masked by the matte; a hard edge thresholds the matte alpha at 0.5 (discrete 0 1)', i1 > 0 && it > i1 && im > it && i2 > im && s.includes('tableValues="0 1"') && s.includes('mask-type:alpha'));
  const v = renderSVG('type.behindSubject', 1, { params: { matte: { frames: 'm/f_%04d.png', fps: 30, count: 90 } } });
  check('behindSubject: without a plate the type is masked by the INVERTED matte (the video underneath shows the subject); frame sequences pick frame floor(u * fps) + 1',
    v.includes('tableValues="1 0"') && v.includes('m/f_0031.png') && !v.includes('class="mp-type"')); }

{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'type/manifest.json'), 'utf8')).components, rows = IDS.map((i) => man.find((c) => c.id === i));
  check('type/manifest.json lists all 7 ids with file, tags, params, a default sound and the r45type sheet (node layers/tests/make-manifests.mjs rewrites it)',
    rows.every((r, i) => r && /type\/gfx\/r45-(type|glyph)\.js$/.test(r.file) && r.tags.length >= 5 && r.params && r.sfx && r.demo === 'type/demo/out/gfx-r45type.png' && r.test === 'type/tests/gfx-sheet.mjs')); }
if (process.argv.includes('--chrome')) {
  const { open, png, decodePNG } = await import('../../layers/tests/harness.mjs'); const h = await open('/type/demo/gfx.html'); await h.page.setViewport({ width: 1920, height: 1080 });
  const W = 1920, H = 1080, grad = Buffer.alloc(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round((x / (W - 1)) * 255), i = (y * W + x) * 4; grad[i] = grad[i + 1] = grad[i + 2] = v; grad[i + 3] = 255; }
  const black = Buffer.alloc(W * H * 4); for (let i = 3; i < black.length; i += 4) black[i] = 255;
  const url = (b) => 'data:image/png;base64,' + png(W, H, b).toString('base64'), plate = { svg: `<rect width="${W}" height="${H}" fill="#0000FF"/>`, viewBox: `0 0 ${W} ${H}` };
  const shot = async (matte) => { await h.page.evaluate((p) => { Object.assign(document.getElementById('root').style, { width: '1920px', height: '1080px' }); document.getElementById('bg').style.background = '#000'; document.getElementById('ov').innerHTML = window.__r(p); }, { plate, matte: { href: matte }, matteMode: 'luminance', edge: 'hard', color: '#FF0000', steps: [[0, 'WWWWWW']], size: 520 });
    await new Promise((r) => setTimeout(r, 500));   // the matte is a data-URL <image>: let it decode before the screenshot
    return decodePNG(await h.page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })).rgba; };
  await h.page.evaluate(async () => { const m = await import('/type/gfx/index.js'); window.__r = (params) => m.renderSVG('type.behindSubject', 1, { params }, { W: 1920, H: 1080 }); });
  const A = await shot(url(grad)), C = await shot(url(black)); let bad = 0, n = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4, typeHere = C[i] > 200 && C[i + 2] < 60, solid = typeHere && (C[i] > 250); if (!solid) continue; const v = Math.round((x / (W - 1)) * 255);
    if (Math.abs(v - 127.5) < 2) continue; n++; const occluded = A[i + 2] > 200 && A[i] < 60, want = v >= 128; if (occluded !== want) bad++; }
  check(`chrome behindSubject: gradient matte, hard edge: type occluded exactly where matte >= 0.5 (${bad} of ${n} solid type pixels wrong)`, n > 10000 && bad === 0);
  await h.page.evaluate(() => { window.show('type.asciiMosaic', 3.2, { image: 'orb', mode: 'ramp' }, 1920, 1080, { light: false }); document.getElementById('bg').style.background = '#000'; });
  const M = decodePNG(await h.page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })).rgba, G = asciiMosaicGrid(P('type.asciiMosaic', { image: 'orb', mode: 'ramp' }), wide), a = [], b = [];
  for (const c of G.cells) { let s = 0, k = 0; for (let dy = -Math.floor(G.fs * 0.6); dy < G.fs * 0.2; dy += 2) for (let dx = -Math.floor(G.cw / 2); dx < G.cw / 2; dx += 2) { const x = Math.round(c.x + dx), y = Math.round(c.y + dy); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4; s += (M[i] + M[i + 1] + M[i + 2]) / 765; k++; } a.push(c.lum); b.push(k ? s / k : 0); }
  const r = (() => { const n2 = a.length, ma = a.reduce((x, y) => x + y) / n2, mb = b.reduce((x, y) => x + y) / n2; let cv = 0, va = 0, vb = 0; for (let i = 0; i < n2; i++) { cv += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return cv / Math.sqrt(va * vb); })();
  check(`chrome asciiMosaic (orb, ramp): rendered pixel brightness per cell correlates with the image (r = ${r.toFixed(3)})`, r > 0.85);
  const errs = h.errors.filter((e) => !/favicon|404/.test(e)); check('chrome: no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
}
console.log(`\nr45 type: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
