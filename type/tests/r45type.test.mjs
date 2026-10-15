/* round-4/5 type parts (type/gfx/r45-type.js, r45-glyph.js, pathsample.js). Node only by default (CI runs this): run: node type/tests/r45type.test.mjs
   Every id: registered, non-empty at its hero time, empty before `at`, identical SVG in shuffled seek order, NaN-free over [-1, 8] s, its cues and default sound
   resolve in sfx/manifest.json. Behaviour: partner marks get equal ink area (16:9 row and 9:16 stack) and an unlicensed asset is refused; icon fills land on
   the planned hit frames and the name holds at the end; the mosaic at hold matches its image (SSIM on the cell grid); text-on-path spacing stays even on a
   tight curve; flank words never cover the subject box; the electric crackle is frame-deterministic; behindSubject composites plate -> type -> matted plate.
   Partner balance is measured from an independently rasterised alpha mask of each owned mark (not from the layout formula); the mosaic is read back from the EMITTED
   SVG (glyph position and colour per cell) and compared with the image by SSIM, with a flipped and a shifted copy as negative controls; 9:16, 4:5 and 1:1 frames keep
   flankWords / behindSubject / iconMergeLockup / electricOutline / textOnPath / the mosaic line inside the safe rect; degenerate params never throw.
   --chrome (local, real Chrome): behindSubject with a synthetic gradient matte occludes the type exactly where the matte is >= 0.5 (hard edge) AND with a matte made from a
   real video alpha by tools/alpha_frames.py; the owned partner marks' SVG area equals their `area` and `markFromImage` agrees; the rendered mosaic (ramp and the default
   text mode) correlates with its image in pixels, and the RAMP_INK table equals the glyph coverage measured in the font; the electric halo pool lands on the numerals. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, gfxCues, sfxFor, partnerLockupLayout, lintPartnerMarks, inkFromMask, PARTNER_MARKS, iconMergeFit, iconMergeState, asciiMosaicGrid, LUM_PLATES, RAMP, RAMP_INK, textOnPathState, flankState, flankFitK, lintFlank, flankShots, electricGeo, electricGlowPools, ELECTRIC_SOUND, ELECTRIC_ARC, flattenPath, arcTable } from '../gfx/index.js';
import { ctxFor, measure } from '../gfx/core.js';
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
/* asciiMosaic: what the EMITTED SVG draws, read back per cell (glyph position -> cell, fill colour and glyph -> brightness), against the IMAGE (the plate function, 3 x 3 sub-samples per cell:
   not the grid's own quantised level). SSIM is near 1 only if every glyph sits in its cell and carries its cell's tone; a flipped and a shifted copy are the negative controls. */
const ssim = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let va = 0, vb = 0, cv = 0; for (let i = 0; i < n; i++) { va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; cv += (a[i] - ma) * (b[i] - mb); } va /= n - 1; vb /= n - 1; cv /= n - 1; const C1 = 0.01 ** 2, C2 = 0.03 ** 2; return ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); };
const lumHex = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const refLum = (image, G) => { const fn = LUM_PLATES[image], a = G.area[2] / G.area[3]; return G.cells.map((c) => { let t = 0; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) t += fn((c.k + (i + 0.5) / 3) / G.cols, (c.r + (j + 0.5) / 3) / G.rows, a); return t / 9; }); };
function renderedCells(svg, G, p) {
  const B = new Float64Array(G.cells.length), seen = new Float64Array(G.cells.length), lo = lumHex(p.dim), hi = lumHex(p.ink); let worstPos = 0, n = 0;
  for (const gm of svg.matchAll(/<g fill="(#[0-9a-f]{6})" font-size="([\d.]+)" text-anchor="middle"(?: opacity="([\d.]+)")?>(.*?)<\/g>/g)) {
    const tone = (lumHex(gm[1]) - lo) / (hi - lo), op = gm[3] === undefined ? 1 : +gm[3];
    for (const t of gm[4].matchAll(/<text x="([\d.\-]+)" y="([\d.\-]+)">(.*?)<\/text>/g)) {
      const x = +t[1], y = +t[2], k = Math.round((x - G.area[0]) / G.cw - 0.5), r = Math.round((y - G.area[1]) / G.fs - 0.78), cell = G.cells[r * G.cols + k]; n++; if (!cell) { worstPos = 1e9; continue; }
      worstPos = Math.max(worstPos, Math.abs(x - cell.x), Math.abs(y - cell.y)); seen[cell.i]++; const ch = t[3].replace('&amp;', '&'), ink = p.mode === 'ramp' ? RAMP_INK[Math.max(0, RAMP.indexOf(ch))] : 1; B[cell.i] = tone * op * ink; } }
  return { B, seen, worstPos, n };
}
const pearson = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let cv = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { cv += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return cv / Math.sqrt(va * vb); };
const SS = {};
for (const image of ['bust', 'orb', 'spark']) { const p = P('type.asciiMosaic', { image }), G = asciiMosaicGrid(p, wide), ref = refLum(image, G), R = renderedCells(renderSVG('type.asciiMosaic', 3.2, { params: { image } }), G, p), s = ssim(ref, [...R.B]);
  const flip = G.cells.map((c) => (image === 'spark' ? 1 - R.B[c.i] : R.B[(G.rows - 1 - c.r) * G.cols + c.k])), /* spark is symmetric both ways: its control is the inverted tone (a colour map the wrong way round) */ shift = G.cells.map((c) => R.B[c.r * G.cols + ((c.k + 3) % G.cols)]), sf = ssim(ref, flip), sh = ssim(ref, shift); SS[image] = [s, sf, sh];
  const lit = G.cells.filter((c) => c.lum >= 0.04).length, once = G.cells.every((c) => (c.lum >= 0.04 ? R.seen[c.i] === 1 : R.seen[c.i] === 0));
  check(`asciiMosaic '${image}' (text mode): ${G.cols} x ${G.rows} cells; the emitted SVG puts one glyph in each of the ${lit} lit cells (worst offset ${R.worstPos.toExponential(1)} px) and its tone matches the image: SSIM ${s.toFixed(4)} (controls: ${image === 'spark' ? 'inverted' : 'flipped'} ${sf.toFixed(2)}, shifted 3 columns ${sh.toFixed(2)})`,
    s > 0.95 && G.rows > 10 && R.worstPos < 0.02 && once && sf < s - 0.05 && sh < s - 0.05, JSON.stringify({ sf, sh })); }
{ const p = P('type.asciiMosaic', { image: 'orb', mode: 'ramp' }), G = asciiMosaicGrid(p, wide), ref = refLum('orb', G), R = renderedCells(renderSVG('type.asciiMosaic', 3.2, { params: { image: 'orb', mode: 'ramp' } }), G, p), r = pearson(ref, [...R.B]);
  check(`asciiMosaic 'orb' (ramp mode): tone = glyph ink x colour read back from the SVG correlates with the image, r = ${r.toFixed(3)}; RAMP is ordered by ink (RAMP_INK rises: ${RAMP_INK.every((v, i) => !i || v > RAMP_INK[i - 1])})`, r > 0.9 && R.worstPos < 0.02 && RAMP_INK.every((v, i) => !i || v > RAMP_INK[i - 1]) && RAMP.length === RAMP_INK.length); }
{ const s = renderSVG('type.asciiMosaic', 3.2, { params: {} }), n = (s.match(/<text /g) || []).length, s0 = renderSVG('type.asciiMosaic', 0.2, { params: {} }), n0 = (s0.match(/<text /g) || []).length;
  const G = asciiMosaicGrid(P('type.asciiMosaic'), wide), lit = G.cells.filter((c) => c.lum >= 0.04).length;
  check(`asciiMosaic: the opening shows the text as one line (${n0} glyphs), the hold shows the mosaic (${n} glyphs = cells above the dark cutoff ${lit})`, n0 === [...P('type.asciiMosaic').text].length && n === lit); }
{ const p = { dissolveAt: 3.4 }, s = renderSVG('type.asciiMosaic', 4.6 + 0.2, { params: p }), s1 = renderSVG('type.asciiMosaic', 4.6, { params: p });
  check('asciiMosaic: dissolve returns the copies to the text line (only the text glyphs remain visible)', (s1.match(/<text /g) || []).length <= [...P('type.asciiMosaic').text].length + 5 || s === ''); }
/* textOnPath direction and rotation (travel mode; trail mode's direction is checked below): on a straight path the tangent is exact, so each glyph's angle must be 0 deg going right, 90 going
   down, -90 going up and 45 on the diagonal, and the drawn <text> must carry that same rotate(); every glyph moves FORWARD along the path by the same arc length (speed x 1 s), and later glyphs sit
   further along it (the text reads in the direction it travels). A flipped angle sign or a reversed travel direction fails here. */
{ const base = P('type.textOnPath', { mode: 'travel', start: 0.1, speed: 260, text: 'ABCD', fade: 0.01 }), G = (path, u) => textOnPathState(u, { ...base, path }, wide).glyphs;
  const paths = { right: ['M100 540 L1800 540', 0], down: ['M960 60 L960 1020', 90], up: ['M960 1020 L960 60', -90], diagonal: ['M300 100 L1100 900', 45] };
  const angErr = Math.max(...Object.values(paths).flatMap(([d, want]) => G(d, 0.8).map((q) => Math.abs(q.a - want))));
  const drawn = Object.values(paths).map(([d, want]) => [...renderSVG('type.textOnPath', 0.8, { at: 0, params: { ...base, path: d } }).matchAll(/<text transform="translate\([^)]*\) rotate\(([-\d.]+)\)"/g)].map((m) => +m[1] - want));
  const a0 = G(paths.right[0], 0.5), a1 = G(paths.right[0], 1.5), ds = a1.map((q, i) => q.s - a0[i].s);
  check(`textOnPath travel: glyph angles follow the tangent (0 / 90 / -90 / 45 deg on straight paths, max error ${angErr.toExponential(1)} deg; the drawn rotate() matches), the text moves forward ${ds[0].toFixed(1)} px of arc in 1 s and reads in its direction of travel`,
    angErr < 0.01 && drawn.every((r) => r.length === 4 && r.every((e) => Math.abs(e) < 0.02)) && ds.every((d) => d > 100 && Math.abs(d - ds[0]) < 1e-6) && a1.every((q, i) => q.x > a0[i].x && (i === 0 || q.s > a1[i - 1].s && q.x > a1[i - 1].x))); }
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

/* partnerLockup: balance from a MEASURED alpha mask. Each owned mark is rasterised here from its geometry (4 x 4 supersampling, not the layout's analytic `area`), passed as a supplied licensed
   mark with only that mask, and the lockup must (1) measure the same ink as the analytic area, (2) end with equal ink area in its boxes, (3) size them like the placeholders. */
const rrIn = (x, y, X, Y, W, H, r) => { if (x < X || x > X + W || y < Y || y > Y + H) return false; const cx = Math.min(Math.max(x, X + r), X + W - r), cy = Math.min(Math.max(y, Y + r), Y + H - r); return Math.hypot(x - cx, y - cy) <= r; };
const inTri = (x, y, [ax, ay], [bx, by], [cx, cy]) => { const d = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry), d1 = d(x, y, ax, ay, bx, by), d2 = d(x, y, bx, by, cx, cy), d3 = d(x, y, cx, cy, ax, ay); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const SHAPES = { ring: (x, y) => { const d = Math.hypot(x - 50, y - 50); return d <= 46 && d >= 24; }, pill: (x, y) => rrIn(x, y, 4, 22, 212, 56, 28), tri: (x, y) => inTri(x, y, [55, 4], [106, 96], [4, 96]),
  bars: (x, y) => [[0, 22, 40, 56, 12], [52, 8, 22, 84, 11], [86, 22, 52, 56, 12], [150, 36, 40, 42, 12], [202, 22, 98, 56, 14]].some(([X, Y, W2, H2, r]) => rrIn(x, y, X, Y, W2, H2, r)) };
const rasterMark = (name, S = 4, ss = 3) => { const m = PARTNER_MARKS[name], w = m.w * S, h = m.h * S, data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let n = 0; for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) if (SHAPES[name]((x + (sx + 0.5) / ss) / S, (y + (sy + 0.5) / ss) / S)) n++; data[(y * w + x) * 4 + 3] = Math.round((255 * n) / (ss * ss)); } return { data, width: w, height: h }; };
{ const masks = Object.fromEntries(Object.keys(SHAPES).map((n) => [n, rasterMark(n)])), rel = Object.keys(SHAPES).map((n) => [n, inkFromMask(masks[n]) / (PARTNER_MARKS[n].area / (PARTNER_MARKS[n].w * PARTNER_MARKS[n].h))]);
  check(`inkFromMask: the ink measured from a rasterised mask equals each owned mark's analytic area (${rel.map(([n, v]) => n + ' ' + v.toFixed(4)).join(', ')})`, rel.every(([, v]) => Math.abs(v - 1) < 0.01));
  const supplied = (n) => ({ href: n + '.png', w: PARTNER_MARKS[n].w, h: PARTNER_MARKS[n].h, licensed: true, mask: masks[n] });
  for (const [a, b, c, name] of [['ring', 'bars', wide, '16:9 row'], ['ring', 'bars', tallC, '9:16 stack'], ['tri', 'pill', wide, 'tri + pill']]) {
    const L = partnerLockupLayout(P('title.partnerLockup', { marks: [supplied(a), supplied(b)] }), c), R = partnerLockupLayout(P('title.partnerLockup', { marks: [a, b] }), c), area = (box, n) => (PARTNER_MARKS[n].area * box.w * box.h) / (PARTNER_MARKS[n].w * PARTNER_MARKS[n].h), ratio = area(L.boxes[0], a) / area(L.boxes[1], b);
    check(`partnerLockup ${name}: marks with only a mask (no ink, no area) are balanced from it: ink area ratio ${ratio.toFixed(3)} (analytic areas, scaled boxes), boxes within 1.5% of the placeholder layout, lint clean`,
      L.balance === 'area' && Math.abs(ratio - 1) < 0.03 && L.boxes.every((bx, i) => Math.abs(bx.w / R.boxes[i].w - 1) < 0.015 && Math.abs(bx.h / R.boxes[i].h - 1) < 0.015) && lintPartnerMarks({ marks: [supplied(a), supplied(b)] }).length === 0); }
  const none = { href: 'x.png', w: 200, h: 100, licensed: true }, F = partnerLockupLayout(P('title.partnerLockup', { marks: ['ring', none] }), wide), msg = lintPartnerMarks({ marks: ['ring', none] });
  check('partnerLockup: a licensed mark with no ink measure is never silently treated as half its box: the lockup says balance "height" (equal heights) and the lint names the fix', F.balance === 'height' && Math.abs(F.boxes[0].h - F.boxes[1].h) < 1e-9 && msg.length === 1 && /markFromImage|mark_ink/.test(msg[0]));
  const opaque = { data: new Uint8ClampedArray(40 * 40 * 4).fill(255), width: 40, height: 40 }; for (let y = 0; y < 40; y++) for (let x = 0; x < 8; x++) { const i = (y * 40 + x) * 4; opaque.data[i] = opaque.data[i + 1] = opaque.data[i + 2] = 0; }
  check('inkFromMask channels: alpha counts coverage; luma reads the dark ink on an opaque white ground (20% of the image is black: 0.2) and luma-light the light part (0.8; an asymmetric fixture, so swapping the two channels fails); an empty or missing mask is 0', Math.abs(inkFromMask(opaque, { channel: 'luma' }) - 0.2) < 1e-9 && Math.abs(inkFromMask(opaque, { channel: 'luma-light' }) - 0.8) < 1e-9 && inkFromMask(opaque) === 1 && inkFromMask(null) === 0 && inkFromMask({ data: [], width: 0, height: 0 }) === 0); }
/* sound pairing: one constant, and a guard that makes the swap compulsory once the electric-arc sound is in the library */
{ const arc = okSfx(ELECTRIC_ARC), cue = gfxCues('type.electricOutline', { at: 0, params: {} })[0];
  check(`electricOutline sound: ELECTRIC_SOUND '${ELECTRIC_SOUND}' is what sfxFor and the cue table return (one place to change); ${arc ? ELECTRIC_ARC + ' is in the library, so it MUST be the pairing (set ELECTRIC_SOUND in type/gfx/r45-glyph.js)' : ELECTRIC_ARC + ' is not in this library yet, the stand-in stays until it merges'}`,
    sfxFor('type.electricOutline').id === ELECTRIC_SOUND && cue.id === ELECTRIC_SOUND && okSfx(ELECTRIC_SOUND) && (!arc || ELECTRIC_SOUND === ELECTRIC_ARC)); }
/* electricOutline halo: pools for the existing overlay `glow`, centred on the numerals; glow: 0 drops the SVG blur */
{ for (const [c, name] of [[wide, '16:9'], [tallC, '9:16']]) { const p = P('type.electricOutline', { text: '24' }), g = electricGeo(p, c), [pool] = electricGlowPools(p, c);
    check(`electricOutline ${name}: the overlay glow pool sits on the numerals (x ${(pool.x * c.W).toFixed(0)} vs ${g.cx.toFixed(0)}, y from the bottom ${(c.H * (1 - pool.y)).toFixed(0)} vs ${g.cy.toFixed(0)}), radius ${(pool.r * c.H).toFixed(0)} px, intensity ${pool.intensity}, colour = the neon colour; the text fits the safe width (${g.tw.toFixed(0)} <= ${(c.safe.x1 - c.safe.x0).toFixed(0)})`,
      Math.abs(pool.x * c.W - g.cx) < 0.1 && Math.abs(c.H * (1 - pool.y) - g.cy) < 0.1 && pool.r > 0 && pool.intensity === p.halo && pool.color === p.color && g.tw <= c.safe.x1 - c.safe.x0 && g.cx - g.tw / 2 >= c.safe.x0 - 0.5 && g.cx + g.tw / 2 <= c.safe.x1 + 0.5); }
  const withBlur = renderSVG('type.electricOutline', 1.2, { params: {} }), noBlur = renderSVG('type.electricOutline', 1.2, { params: { glow: 0 } });
  check('electricOutline glow: 0 draws no SVG blur filter (the overlay glow carries the halo) and keeps the neon strokes; the default keeps the tight SVG glow', /filter=/.test(withBlur) && !/filter=/.test(noBlur) && noBlur.length > 500); }
/* narrow frames: type sizes come from the shorter side and every part keeps inside the safe rect (the 9:16 frame of before gave 1.78x type) */
const FRAMES = [[1080, 1920, '9:16'], [1080, 1350, '4:5'], [1080, 1080, '1:1']];
for (const [W2, H2, name] of FRAMES) { const c = ctxFor(W2, H2, null, 1), sx0 = c.safe.x0 - 0.5, sx1 = c.safe.x1 + 0.5;
  const longP = { words: ['Built', 'for', 'long', 'days', 'and', 'late', 'nights'] }, keyed = { subject: { keys: [[0, [0.45, 0.3, 0.1, 0.4]], [1.2, [0.3, 0.2, 0.4, 0.6]], [2.0, [0.4, 0.15, 0.2, 0.7]]] } };
  const out = [], inside = (st) => st.words.every((w) => w.x >= sx0 && w.x + w.w <= sx1);
  let ok = true, worst = Infinity, kmin = 1; for (const params of [{}, longP, keyed]) for (let t = 0; t <= 2.6; t += 0.2) { const st = flankState(t, P('type.flankWords', params), c); if (!inside(st)) ok = false; kmin = Math.min(kmin, st.k); for (const w of st.words) worst = Math.min(worst, w.side === 'left' ? st.box.x - (w.x + w.w) : w.x - (st.box.x + st.box.w)); }
  const k0 = flankState(1, P('type.flankWords'), c).k, shots = flankShots('Made for long days and late nights', [[0, 3], [3, 7]], { color: '#111111' }, c), sizes = shots.map((q) => q.size), shotOk = shots.every((q) => flankState(1, P('type.flankWords', q), c).words.every((w) => w.x >= sx0 && w.x + w.w <= sx1));
  check(`flankWords ${name}: the default, a 7-word phrase and a keyframed subject stay inside the safe rect (${c.safe.x0.toFixed(0)}..${c.safe.x1.toFixed(0)}) and never touch the box (closest ${worst.toFixed(1)} px); default fit ${(k0 * 100).toFixed(0)}% of 1080p type; flankShots(…, c) gives every shot the same size (${sizes.join(' / ')}) and fits; a box that leaves no room (80% of the frame) cannot be fixed by shrinking, so lintFlank says so`,
    ok && worst >= 0 && k0 <= 1 && shotOk && (sizes[0] === undefined || sizes.every((v) => v === sizes[0])) && lintFlank(P('type.flankWords', { words: ['A', 'B'], subject: { box: [0.1, 0.2, 0.8, 0.6] } }), c).length === 1);
  const w2 = { ...P('layout.iconMergeLockup'), name: 'The Bundle' }, ext = []; for (const u of [0.1, 1.2, 2.0, 2.4, 4.3]) { const st = iconMergeState(u, w2, c); for (const t of st.tiles) if (t.op > 0.01) ext.push([t.x - t.size / 2, t.x + t.size / 2, t.y - t.size / 2, t.y + t.size / 2]); for (const l of st.letters) if (l.op > 0.01) ext.push([l.x - st.NS * 0.3, l.x + st.NS * 0.3, st.base - st.NS, st.base]); }
  const fit = iconMergeFit(w2, c), exOk = ext.every(([x0, x1, y0, y1]) => x0 >= sx0 && x1 <= sx1 && y0 >= c.safe.y0 - 0.5 && y1 <= c.safe.y1 + 0.5);
  check(`iconMergeLockup ${name}: staircase tiles, the row and the letters of the name all inside the safe rect over 5 times (${ext.length} boxes; tile fit ${(fit.kT * 100).toFixed(0)}%, name fit ${(fit.kN * 100).toFixed(0)}%)`, exOk && fit.kT <= 1 && fit.kN <= 1);
  const dB = P('type.behindSubject'), wb = (str, S) => measure(str, S, { weight: dB.weight, font: dB.font, ls: dB.ls * S }), bs = renderSVG('type.behindSubject', 1.0, { params: {} }, { W: W2, H: H2 }), sizeOf = [...bs.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1]), maxLabel = Math.max(...P('type.behindSubject').steps.map(([, t2]) => wb(t2, Math.max(...sizeOf))));
  const availW = 2 * Math.min(c.W / 2 - c.safe.x0, c.safe.x1 - c.W / 2), long = renderSVG('type.behindSubject', 1.0, { params: { steps: [[0, 'EVERYTHING']] } }, { W: W2, H: H2 }), sz2 = Math.max(...[...long.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1])), wLong = wb('EVERYTHING', sz2);
  check(`behindSubject ${name}: the widest default label (${maxLabel.toFixed(0)} px) fits the safe width (${availW.toFixed(0)} px) at ${Math.max(...sizeOf).toFixed(0)} px type (400 px @1080 on the shorter side); a 10-letter label shrinks the type to ${sz2.toFixed(0)} px so it still fits (${wLong.toFixed(0)} px)`, maxLabel <= availW + 0.5 && Math.max(...sizeOf) <= 400 * (H2 > W2 ? W2 / 1080 : H2 / 1080) + 0.01 && wLong <= availW + 0.5 && sz2 < Math.max(...sizeOf));
  const gt = electricGeo(P('type.electricOutline', { text: '2024', size: 400 }), c), tp = textOnPathState(1.2, P('type.textOnPath'), c), inF = tp.glyphs.filter((q) => q.op > 0.5).every((q) => q.x >= 0 && q.x <= c.W && q.y >= 0 && q.y <= c.H);
  const ml = renderSVG('type.asciiMosaic', 0.1, { params: {} }, { W: W2, H: H2 }), xs = [...ml.matchAll(/<text x="([\d.\-]+)"/g)].map((m) => +m[1]);
  check(`electricOutline / textOnPath / asciiMosaic ${name}: a 4-digit mark fits the safe width (${gt.tw.toFixed(0)} px), the travelling text stays on screen, and the opening text line of the mosaic spans ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)} px inside the safe rect`,
    gt.tw <= c.safe.x1 - c.safe.x0 + 0.5 && inF && Math.min(...xs) >= sx0 && Math.max(...xs) <= sx1); }
/* degenerate params never throw (a throw aborts a whole plan render) and never print NaN */
{ const ODD = { 'title.partnerLockup': [{ marks: [] }, { marks: ['ring'] }, { marks: ['ring', 'bars', 'tri'] }, { marks: ['nope', 'bars'] }, { labels: null }], 'layout.iconMergeLockup': [{ icons: [] }, { name: '' }, { icons: ['play'] }, { hits: [] }, { icons: ['zzz', { d: 'M0 0 L10 10' }] }],
    'type.asciiMosaic': [{ text: '' }, { text: '   ' }, { image: { lum: [[0.5]] } }, { cols: 4 }], 'type.textOnPath': [{ text: '' }, { path: '' }, { path: 'M10 10' }, { mode: 'travel' }, { mode: 'reveal' }],
    'type.flankWords': [{ words: [] }, { words: ['One'] }, { split: 0 }, { subject: { keys: [] } }], 'type.electricOutline': [{ text: '' }, { text: '~~' }, { text: 'ABCDEFGHIJ' }], 'type.behindSubject': [{ steps: [] }, { mode: 'marquee', text: '', sep: '' }, { steps: [[0, '']] }, { mode: 'marquee' }] };
  let bad = [], runs = 0; for (const [id, list] of Object.entries(ODD)) for (const params of list) for (const [W2, H2] of [[1920, 1080], [1080, 1920]]) for (let t = 0; t <= 6; t += 0.5) { runs++; try { const o = renderSVG(id, t, { at: 0, params }, { W: W2, H: H2 }); if (/NaN|undefined|Infinity/.test(o)) bad.push(`${id} ${JSON.stringify(params)} t=${t}: NaN/undefined`); gfxCues(id, { at: 0, params }); } catch (e) { bad.push(`${id} ${JSON.stringify(params)}: ${e.message}`); } }
  check(`degenerate params: ${runs} renders (no marks, one mark, 3 marks, no icons, no name, empty text, no words, no steps, an empty marquee, a 10-letter mark) at 16:9 and 9:16: none throws, none prints NaN`, bad.length === 0, bad.slice(0, 3).join(' | '));
  const one = renderSVG('title.partnerLockup', 2, { params: { marks: ['ring'] } }), none = renderSVG('title.partnerLockup', 2, { params: { marks: [] } }), l3 = lintPartnerMarks({ marks: ['ring', 'bars', 'tri'] }), l0 = lintPartnerMarks({ marks: [] }), lu = lintPartnerMarks({ marks: ['nope', 'ring'] });
  check('partnerLockup with 0 / 1 / 3 marks: none draws nothing, one is centred without a divider, extra marks are ignored; lintPartnerMarks says so (and names an unknown placeholder)', none === '' && one.length > 200 && !one.includes('stroke-linecap="round" fill="none"') && l3.length === 1 && /first two/.test(l3[0]) && l0.length === 1 && lu.length === 1 && /unknown placeholder/.test(lu[0])); }

{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'type/manifest.json'), 'utf8')).components, rows = IDS.map((i) => man.find((c) => c.id === i));
  check('type/manifest.json lists all 7 ids with file, tags, params, a default sound and the r45type sheet (node layers/tests/make-manifests.mjs rewrites it)',
    rows.every((r, i) => r && /type\/gfx\/r45-(type|glyph)\.js$/.test(r.file) && r.tags.length >= 5 && r.params && r.sfx && r.demo === 'type/demo/out/gfx-r45type.png' && r.test === 'type/tests/gfx-sheet.mjs')); }
if (process.argv.includes('--chrome')) {
  const { open, png, decodePNG, pageErrors } = await import('../../layers/tests/harness.mjs'); const h = await open('/type/demo/gfx.html'); await h.page.setViewport({ width: 1920, height: 1080 });
  const W = 1920, H = 1080, grad = Buffer.alloc(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round((x / (W - 1)) * 255), i = (y * W + x) * 4; grad[i] = grad[i + 1] = grad[i + 2] = v; grad[i + 3] = 255; }
  const black = Buffer.alloc(W * H * 4); for (let i = 3; i < black.length; i += 4) black[i] = 255;
  const url = (b) => 'data:image/png;base64,' + png(W, H, b).toString('base64'), plate = { svg: `<rect width="${W}" height="${H}" fill="#0000FF"/>`, viewBox: `0 0 ${W} ${H}` };
  const shot = async (matte, t = 1, extra = {}) => { await h.page.evaluate((p, t) => { Object.assign(document.getElementById('root').style, { width: '1920px', height: '1080px' }); document.getElementById('bg').style.background = '#000'; document.getElementById('ov').innerHTML = window.__r(p, t); }, { plate, matte: { href: matte }, matteMode: 'luminance', edge: 'hard', color: '#FF0000', steps: [[0, 'WWWWWW']], size: 520, ...extra }, t);
    await new Promise((r) => setTimeout(r, 500));   // the matte is a data-URL <image>: let it decode before the screenshot
    return decodePNG(await h.page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })).rgba; };
  /* measure() reads canvas metrics: a face that is not loaded yet measures as the fallback (gotchas.md), so load the faces before the first frame, as every template does */
  await h.page.evaluate(async () => { await Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope'))); await document.fonts.load('600 24px "IBM Plex Mono"'); });
  await h.page.evaluate(async () => { const m = await import('/type/gfx/index.js'); window.__r = (params, t = 1) => m.renderSVG('type.behindSubject', t, { params }, { W: 1920, H: 1080 }); });
  const A = await shot(url(grad)), C = await shot(url(black)); let bad = 0, n = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4, typeHere = C[i] > 200 && C[i + 2] < 60, solid = typeHere && (C[i] > 250); if (!solid) continue; const v = Math.round((x / (W - 1)) * 255);
    if (Math.abs(v - 127.5) < 2) continue; n++; const occluded = A[i + 2] > 200 && A[i] < 60, want = v >= 128; if (occluded !== want) bad++; }
  check(`chrome behindSubject: gradient matte, hard edge: type occluded exactly where matte >= 0.5 (${bad} of ${n} solid type pixels wrong)`, n > 10000 && bad === 0);
  /* behindSubject with a REAL video alpha: a moving-circle alpha video (ffmpeg) -> tools/alpha_frames.py -> PNG frames -> the part. At three times the type is hidden exactly inside the circle of that frame. */
  { const tmp = path.join(ROOT, 'type/demo/out', 'matte-tmp-' + process.pid), rel = '/type/demo/out/' + path.basename(tmp); fs.mkdirSync(tmp, { recursive: true });
    try { const mov = path.join(tmp, 'subject.mov');
      execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', "color=c=white:s=96x64:r=10:d=1,format=rgba,geq=r=255:g=255:b=255:a='if(lt(hypot(X-(10+60*T)\\,Y-32)\\,12)\\,255\\,0)'", '-c:v', 'qtrle', '-pix_fmt', 'argb', mov]);
      const spec = JSON.parse(execFileSync('python3', ['-I', path.join(ROOT, 'tools/alpha_frames.py'), mov, path.join(tmp, 'm'), '--prefix', rel + '/m'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0]), res = [];
      for (const t of [0.1, 0.5, 0.8]) { const V = await shot('', t, { matte: spec, matteMode: 'alpha', plate }), k = Math.floor(t * spec.fps + 1e-6), cx = (10 + 60 * (k / spec.fps)) * 20, cy = 32 * 20 - 100; let bad2 = 0, nin = 0, nout = 0;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; if (!(C[i] > 250 && C[i + 2] < 60)) continue; const d = Math.hypot(x - cx, y - cy); if (Math.abs(d - 240) < 24) continue; const occ = V[i + 2] > 200 && V[i] < 60, want = d < 240; if (want) nin++; else nout++; if (occ !== want) bad2++; }
        res.push([t, k + 1, Math.round(cx), nin, nout, bad2]); }
      check(`chrome behindSubject with a video alpha (moving circle, ffmpeg -> tools/alpha_frames.py -> ${spec.count} PNG frames): the type is hidden exactly inside that frame's circle at 3 times (${res.map(([t, f, x, ni, no, b2]) => `t ${t}: frame ${f}, centre x ${x}, ${b2} wrong of ${ni + no}`).join('; ')})`, res.every(([, , , ni, no, b2]) => ni > 1500 && no > 1500 && b2 === 0)); }
    finally { fs.rmSync(tmp, { recursive: true, force: true }); } }
  /* the owned placeholder marks: their true SVG area (rendered, counted by alpha) equals the declared `area`, and markFromImage measures the same ink from the rendered image */
  { const rows = await h.page.evaluate(async () => { const m = await import('/type/gfx/index.js'), out = [];
      for (const [name, mk] of Object.entries(m.PARTNER_MARKS)) { const S = 4, svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mk.w * S}" height="${mk.h * S}" viewBox="0 0 ${mk.w} ${mk.h}" fill="#000">${mk.svg}</svg>`, img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const c = document.createElement('canvas'); c.width = mk.w * S; c.height = mk.h * S; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const rendered = m.inkFromMask(g.getImageData(0, 0, c.width, c.height)), viaImg = m.markFromImage(img, { licensed: true, max: 512 });
        out.push([name, rendered, mk.area / (mk.w * mk.h), viaImg.ink, viaImg.w, viaImg.h]); } return out; });
    check(`chrome partner marks: the SVG of each owned mark, rendered and counted by alpha, has the declared area (${rows.map(([n, r, a2]) => `${n} ${(100 * r).toFixed(2)}% vs ${(100 * a2).toFixed(2)}%`).join(', ')}); markFromImage reads the same ink from the image`,
      rows.every(([, r, a2, v]) => Math.abs(r / a2 - 1) < 0.015 && Math.abs(v / a2 - 1) < 0.025)); }
  /* the glyph ramp: coverage of each glyph measured in the font, against RAMP_INK (fails if the table drifts from the font) */
  { const meas = await h.page.evaluate(async (RAMP) => { await document.fonts.load('600 100px "IBM Plex Mono"'); const out = []; for (const ch of RAMP) { const c = document.createElement('canvas'); c.width = 120; c.height = 160; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, 120, 160); g.fillStyle = '#fff'; g.font = '600 100px "IBM Plex Mono"'; g.fillText(ch, 30, 100); const d = g.getImageData(0, 0, 120, 160).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i] / 255; out.push(t); } const mx = Math.max(...out); return out.map((v) => v / mx); }, RAMP);
    check(`chrome RAMP_INK: the table equals the coverage measured in IBM Plex Mono SemiBold (worst ${Math.max(...meas.map((v, i) => Math.abs(v - RAMP_INK[i]))).toFixed(3)}), and the ramp is monotone in the font`, meas.every((v, i) => Math.abs(v - RAMP_INK[i]) < 0.02) && meas.every((v, i) => !i || v > meas[i - 1])); }
  /* the rendered mosaic against its image, in pixels: ramp mode (glyph shape carries the tone) and the default text mode (colour carries the tone) */
  const mosaicR = async (params) => { await h.page.evaluate((p) => { window.show('type.asciiMosaic', 3.2, p, 1920, 1080, { light: false }); document.getElementById('bg').style.background = '#000'; }, params);
    const M = decodePNG(await h.page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })).rgba, G = asciiMosaicGrid(P('type.asciiMosaic', params), wide), a = [], b = [];
    for (const c of G.cells) { let s2 = 0, k = 0; for (let dy = -Math.floor(G.fs * 0.6); dy < G.fs * 0.2; dy += 2) for (let dx = -Math.floor(G.cw / 2); dx < G.cw / 2; dx += 2) { const x = Math.round(c.x + dx), y = Math.round(c.y + dy); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = (y * W + x) * 4; s2 += (M[i] + M[i + 1] + M[i + 2]) / 765; k++; } a.push(refLum(params.image, G)[c.i]); b.push(k ? s2 / k : 0); } return pearson(a, b); };
  const rRamp = await mosaicR({ image: 'orb', mode: 'ramp' }), rText = await mosaicR({ image: 'orb' }), rBust = await mosaicR({ image: 'bust' });
  check(`chrome asciiMosaic: rendered pixel brightness per cell correlates with the image (orb ramp r = ${rRamp.toFixed(3)}; orb text mode r = ${rText.toFixed(3)}; bust text mode r = ${rBust.toFixed(3)})`, rRamp > 0.85 && rText > 0.8 && rBust > 0.8);
  /* the electric halo: the overlay glow with electricGlowPools() puts its light on the numerals */
  { const h2 = await open('/layers/demo/r45.html'); await h2.page.setViewport({ width: 960, height: 540 }); const pe = P('type.electricOutline', { text: '24' }), cw = ctxFor(1920, 1080, null, 1), pools = electricGlowPools(pe, cw), g0 = electricGeo(pe, cw);
    const b64 = await h2.page.evaluate((pl) => { window.stack([{ kind: 'glow', params: { pools: pl } }], 0, 960, 540, '#000'); return window.pixels(); }, pools), d = Buffer.from(b64, 'base64'); let sx = 0, sy = 0, sw = 0; for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) { const v = d[(y * 960 + x) * 4]; sx += x * v; sy += y * v; sw += v; }
    const mx = (sx / sw) * 2, my = (sy / sw) * 2; check(`chrome electric halo: the overlay glow's light centroid (${mx.toFixed(0)}, ${my.toFixed(0)}) is on the numerals (${g0.cx.toFixed(0)}, ${g0.cy.toFixed(0)}) at 1920 x 1080 (y of the pool is measured from the bottom)`, Math.abs(mx - g0.cx) < 20 && Math.abs(my - g0.cy) < 20 && sw > 0);
    const e2 = pageErrors(h2.errors, [/willReadFrequently/]); check('chrome: the glow page has no console errors', e2.length === 0, JSON.stringify(e2.slice(0, 3))); await h2.close(); }
  const errs = pageErrors(h.errors); check('chrome: no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
}
console.log(`\nr45 type: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
