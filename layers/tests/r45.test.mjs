/* layers round-4/5 parts (2026-10-14): layers.embeddingCloud, layers.epicycleDraw, layers.hexMosaic, layers.convergeToDot (layers/canvas2d-r45.js, merged into K2D).
   Node only by default, so CI runs it (no browser, no GPU): every draw is recorded on a recording 2D context and compared as text.
     defaults, params (each variant changes the draw and stays finite), shuffled-seek identity at 16:9 and 9:16, nothing visible before the start cue,
     loop seams exact (embeddingCloud loop, epicycleDraw loop, hexMosaic loop with and without a panel, for loops that are and are not multiples of 4 s), images (stable per point, cached, placeholder until decoded), and the maths: nearest neighbours vs brute force, lift = the lift parameter,
     collapse lands on the mark outline, DFT passes through its samples, Hausdorff < 1 px at 1080p for N = full, fidelity rises with N, hex lattice + wave
     onset = distance / speed, outside-in delays, converge ends on the centre, lines are recomputed from the node positions (no stored state).
   --chrome (local, real Chrome): mounts every kind through overlay.js mountStack, bit-identical pixels after another t and in shuffled order, real images through
     stack.ready() (the image is drawn from the first frame, the same pixels on every seek, one Image object per source), render-time budgets (hexMosaic at 4K,
     embeddingCloud at 1080p), no console errors; writes layers/demo/out/r45-sheet.png + tests/last-run-r45.json.
   run: node layers/tests/r45.test.mjs [--chrome] */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { K2D, Canvas2DLayer } from '../canvas2d.js'; import { K2D_R3 } from '../canvas2d-r3.js'; import { ALL_KINDS } from '../overlay.js';
import { K2D_R45, CUES_R45, cuesR45, cloudPlan, embeddingState, epicycleDFT, epicycleTip, epicycleCurve, epicycleState, hexState, convergeState, preloadImages, errText } from '../canvas2d-r45.js';
import { flattenPath, PATHS } from '../../type/gfx/pathsample.js'; import { DEFAULT_MARK } from '../../type/gfx/media.js';
import { reporter, ROOT } from './harness.mjs';
const R = reporter('layers round 4/5'), here = path.dirname(fileURLToPath(import.meta.url)), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e, CHROME = process.argv.includes('--chrome');
const KINDS = ['embeddingCloud', 'epicycleDraw', 'hexMosaic', 'convergeToDot'], HERO = { embeddingCloud: 2.2, epicycleDraw: 2.0, hexMosaic: 0.8, convergeToDot: 1.2 }, W = 1920, H = 1080;
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? (...a) => { log.push(String(k) + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s}${c}`) }; } : (...a) => { log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { width: 0 }; })), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (kind, t, p = {}, w = W, h = H) => { const { g, log } = recorder(); K2D[kind].draw(g, w, h, t, { ...K2D[kind].d, ...p }, 3); return log; };
const recS = (kind, t, p, w, h) => rec(kind, t, p, w, h).join('|'), finite = (s) => !/NaN|undefined|Infinity/.test(s);
const rng = (() => { let a = 451; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* 1. registration: ids, defaults, doc, manifest */
R.check('the four kinds are merged into K2D (same objects as K2D_R45), reachable through overlay.js ALL_KINDS, and the round-3 kinds are still there',
  KINDS.every((k) => K2D[k] === K2D_R45[k] && ALL_KINDS()[k] && typeof K2D[k].draw === 'function' && K2D[k].tags.length >= 5 && typeof K2D[k].doc === 'string' && K2D[k].doc.length > 80 && typeof K2D[k].order === 'number') && Object.keys(K2D_R3).every((k) => K2D[k]));
{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers/manifest.json'), 'utf8')).components, ids = KINDS.map((k) => 'layers.' + k), rows = ids.map((i) => man.find((c) => c.id === i));
  R.check('layers/manifest.json lists layers.embeddingCloud, .epicycleDraw, .hexMosaic, .convergeToDot with file, tags, params, doc and this test (node make-manifests.mjs rewrites it)',
    rows.every((r, i) => r && r.file === 'layers/canvas2d-r45.js' && r.tags.length >= 5 && r.params && r.doc && r.test === 'layers/tests/r45.test.mjs' && r.params.seed === K2D[KINDS[i]].d.seed)); }
{ const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), ok = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.')), bad = [];
  const sets = [['embeddingCloud', {}], ['embeddingCloud', { queryAt: null, collapseAt: 3 }], ['epicycleDraw', {}], ['epicycleDraw', { steps: [[0, 4], [1, 16], [2, 'full']] }], ['hexMosaic', {}], ['hexMosaic', { loop: 6 }], ['convergeToDot', {}], ['convergeToDot', { reverse: true }]];
  for (const [k, p] of sets) for (const c of cuesR45(k, p)) if (!ok(c.id) || !(c.t >= 0) || !c.why) bad.push(k + ':' + c.id);
  R.check(`cuesR45: every cue of the four layers resolves in sfx/manifest.json, has a time >= 0 and a reason (${sets.map(([k, p]) => cuesR45(k, p).length).join(', ')} cues over ${sets.length} param sets)`, !bad.length && Object.keys(CUES_R45).length === 4, bad.join(' ')); }
for (const k of KINDS) { const log = rec(k, HERO[k]), s = log.join('|');
  R.check(`${k}: defaults draw at ${HERO[k]} s (${log.length} canvas calls, finite numbers)`, log.length > 20 && /fill|stroke/.test(s) && finite(s)); }

/* 2. params: every variant is read (the draw changes) and stays finite */
const VARIANTS = {
  embeddingCloud: [{ seed: 9 }, { n: 80, thumbs: 0 }, { clusters: 3 }, { color: '#FF5030' }, { k: 3 }, { lines: false }, { loop: 6 }, { queryAt: null }, { query: 'a song for the road' }, { collapseAt: 2.0 }, { collapseAt: 1.0, mark: 'M10 10 L90 10 L50 90 Z' }, { thumbs: 999 }, { tilt: 0.6 }, { radius: 0.3 }],
  epicycleDraw: [{ path: 'wave' }, { path: 'swoop', closed: false }, { terms: 8 }, { terms: 'full' }, { trail: 0.3 }, { inset: [0.7, 0.05, 0.25, 0.3] }, { circles: false }, { arms: false }, { readout: false }, { color: '#FF5030' }, { path: [[400, 300], [1500, 360], [900, 800]], closed: true }, { steps: [[0, 4], [1, 32]] }, { glow: 0 }],
  hexMosaic: [{ radius: 40 }, { faces: ['engrave', 'color'] }, { palette: ['#FF0000', '#00FF00'] }, { loop: 6 }, { panel: { rect: [0.3, 0.3, 0.4, 0.4] } }, { waves: [{ at: 0.1, from: [1, 0.5] }] }, { bg: '#101010' }, { faces: ['engrave'] }, { seed: 9 }],
  convergeToDot: [{ nodes: 40 }, { reverse: true }, { order: 'inside-out' }, { bg: '#FFFFFF' }, { seed: 9 }, { links: 3 }, { dotColor: '#FF5030' }, { hub: 30 }, { at: 0.2 }, { field: 0.2 }, { wobble: 0 }],
};
for (const k of KINDS) { const base = recS(k, HERO[k]); let same = [], bad = [];
  for (const v of VARIANTS[k]) { const s = recS(k, HERO[k], v); if (s === base) same.push(JSON.stringify(v)); if (!finite(s) || s.length < 10) bad.push(JSON.stringify(v)); }
  R.check(`${k}: ${VARIANTS[k].length} param variants all change the draw and stay finite`, !same.length && !bad.length, (same.length ? 'unchanged: ' + same.join(' ') : '') + (bad.length ? ' bad: ' + bad.join(' ') : '')); }

/* 3. shuffled seek: the same t draws the same calls in any order, at 16:9 and 9:16 */
const ts = Array.from({ length: 70 }, (_, i) => -0.5 + i * 0.13);
for (const k of KINDS) for (const [w, h, name] of [[W, H, '16:9'], [1080, 1920, '9:16']]) {
  const fwd = ts.map((t) => recS(k, t, {}, w, h)), order = shuffle(ts.map((_, i) => i)), shuf = new Map(order.map((i) => [i, recS(k, ts[i], {}, w, h)]));
  R.check(`${k} ${name}: identical draw calls in forward and shuffled order (${ts.length} seeks over [-0.5, 8.6] s, finite)`, fwd.every((s, i) => s === shuf.get(i) && finite(s))); }

/* 4. not visible before the start cue */
{ const at = 0.5; R.check('epicycleDraw: nothing is drawn before at (t -1 and at - 1 frame make no canvas call); it draws from at', rec('epicycleDraw', -1, { at }).length === 0 && rec('epicycleDraw', at - 1 / 30, { at }).length === 0 && rec('epicycleDraw', at + 0.2, { at }).length > 20); }
{ const q = 1.0, a = recS('embeddingCloud', q - 0.1), b = recS('embeddingCloud', q - 0.1, { queryAt: null }), c = recS('embeddingCloud', q + 0.5);
  R.check('embeddingCloud: before queryAt the frame is exactly the cloud without a query (no chip text, no neighbour lines, no lit points); 0.5 s after it the chip and lines are there', a === b && !/fillText/.test(a) && /fillText/.test(c) && c !== a); }
{ const s0 = hexState(0.1, K2D.hexMosaic.d, { W, H }); R.check(`hexMosaic: before the first wave (0.3 s) all ${s0.length} tiles show face 0, full width, no flip in progress`, s0.every((t) => t.face === 0 && t.sx === 1 && t.k === 1 || t.face === 0 && t.sx === 1)); }
{ const p = K2D.convergeToDot.d, c = convergeState(p.at - 0.05, p, { W, H }), home = convergeState(0, p, { W, H });
  R.check('convergeToDot: before at every node is home (k = 0, only the slow wobble moves it) and the dot has its start radius', c.nodes.every((n) => n.k === 0) && near(c.hub, p.hub, 1e-9) && c.nodes.every((n, i) => Math.hypot(n.x - home.nodes[i].x, n.y - home.nodes[i].y) < 2 * p.wobble + 1e-6)); }

/* 5. loop seams */
const PANEL = { rect: [0.3, 0.3, 0.4, 0.4] };
const LOOPS = [['embeddingCloud', { loop: 6, queryAt: null, collapseAt: null }, 6], ['epicycleDraw', { loop: true, period: 4, steps: null, terms: 32, at: 0 }, 4], ['hexMosaic', { loop: 6, waves: [] }, 6],
  ...[4, 5, 6, 7, 10].map((L) => ['hexMosaic', { loop: L, waves: [], panel: PANEL }, L])];
for (const [k, p, L] of LOOPS) { let ok = true; for (const t of [0, 0.4, 1.3, 2.9, 4.1]) if (recS(k, t, p) !== recS(k, t + L, p)) ok = false; const moves = recS(k, 0.7, p) !== recS(k, 0.7 + L / 3, p);
  R.check(`${k} loop ${L}${p.panel ? ' with a panel' : ''}: frame t and t + ${L} s are identical (5 times); a third of a loop later it is a different frame`, ok && moves); }
{ const a = recS('embeddingCloud', 1.3, { loop: 0, queryAt: null }), b = recS('embeddingCloud', 7.3, { loop: 0, queryAt: null }); R.check('embeddingCloud without loop: it keeps rotating (frame t and t + 6 s differ)', a !== b); }

/* 5b. images: stable per point, cached, placeholder until decoded (node: fake decoded images) */
const fake = (tag) => ({ naturalWidth: 64, naturalHeight: 48, toString: () => 'IMG' + tag }), IMGS = [fake('A'), fake('B'), fake('C')];
{ const drawn = (log) => log.filter((x) => x.startsWith('drawImage')).map((x) => x.split(',')[0].replace('drawImage', '')), tally = (a) => { const m = {}; for (const k of a) m[k] = (m[k] || 0) + 1; return JSON.stringify(Object.entries(m).sort()); };
  const ta = tally(drawn(rec('embeddingCloud', 0.4, { images: IMGS, queryAt: null }))), tb = tally(drawn(rec('embeddingCloud', 3.7, { images: IMGS, queryAt: null }))), n = drawn(rec('embeddingCloud', 0.4, { images: IMGS, queryAt: null })).length;
  const a = embeddingState(0.4, { ...K2D.embeddingCloud.d, queryAt: null }, { W, H }), b = embeddingState(3.7, { ...K2D.embeddingCloud.d, queryAt: null }, { W, H }), same = a.pts.every((q, i) => q.ti === b.pts[i].ti && q.thumb === b.pts[i].thumb);
  R.check(`embeddingCloud images: each thumbnail keeps its own image while the cloud turns (the same ${n} draws, tally ${ta}, at 0.4 s and 3.7 s; the index is a property of the point, not of where it is on screen)`, n === K2D.embeddingCloud.d.thumbs && ta === tb && same && /A/.test(ta) && /B/.test(ta) && /C/.test(ta));
  const noImg = recS('embeddingCloud', 1.3), strImg = recS('embeddingCloud', 1.3, { images: ['not-decoded.png'] });
  R.check('embeddingCloud images: a string source that is not decoded (no Image in node, or not loaded yet) draws the placeholder tile, exactly the frame without images', noImg === strImg && !/drawImage/.test(strImg));
  const hx = (t) => recS('hexMosaic', t, { faces: ['image'], images: IMGS, waves: [] }), hv = hx(1.1);
  R.check('hexMosaic image faces: every tile draws an image (hundreds of drawImage calls), each tile always the same one, and the frame is identical on a repeat render', /drawImage/.test(hv) && hv === hx(1.1) && drawn(rec('hexMosaic', 1.1, { faces: ['image'], images: IMGS, waves: [] })).length > 100);
  const sh = shuffle(ts.map((_, i) => i)), want = ts.map((t) => recS('embeddingCloud', t, { images: IMGS })), got = new Map(sh.map((i) => [i, recS('embeddingCloud', ts[i], { images: IMGS })]));
  R.check('embeddingCloud with images: identical draw calls in forward and shuffled seek order (70 seeks)', want.every((x, i) => x === got.get(i)));
  R.check('preloadImages: resolves at once with nothing to load, with objects and with strings when there is no Image (node); K2D kinds list their sources in assets()', (await preloadImages([])).length === 0 && (await preloadImages(IMGS)).length === 0 && (await preloadImages(['x.png'])).length === 1 && K2D.embeddingCloud.assets({ images: ['a'] })[0] === 'a' && K2D.hexMosaic.assets({ faces: ['color'], images: ['a'] }).length === 0 && K2D.hexMosaic.assets({ faces: ['image'], images: ['a'] }).length === 1); }
/* 5b2. brandField with a URL `logo`: stack.ready() resolves once it is decoded, so the FIRST frame already draws it and no frame depends on load timing (it used to draw the placeholder mark on frame 0
   and the logo from the next frame on, because the kind had no assets() and loaded the image inside draw()). A fake async Image stands in for the browser's: onload fires 15 ms after src is set. */
{ const had = 'Image' in globalThis, saved = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; setTimeout(() => { if (/broken/.test(v)) { this.onerror && this.onerror(); return; } this.naturalWidth = 80; this.naturalHeight = 40; this.complete = true; this.onload && this.onload(); }, 15); } get src() { return this._src; } decode() { return Promise.resolve(); } };
  const mk = (logo) => { const { g, log } = recorder(); return { layer: new Canvas2DLayer({ getContext: () => g, style: {}, dataset: {} }, 'brandField', { logo, at: 0 }, { width: W, height: H }), log }; }, nDraw = (log) => log.filter((x) => x.startsWith('drawImage')).length, frame = (o, t) => { o.log.length = 0; o.layer.render(t); return o.log.join('|'); };
  let firstOk = 0, stable = 0; const N = 6;
  for (let i = 0; i < N; i++) { const o = mk('race-logo-' + i + '.png'); await o.layer.ready(); const f0 = frame(o, 1.5); if (nDraw(o.log) === 1) firstOk++; await new Promise((r) => setTimeout(r, 40)); if (frame(o, 1.5) === f0) stable++; }
  R.check(`brandField URL logo: after stack.ready() the first frame already draws the logo (${firstOk} of ${N} fresh logos) and the same frame is identical once any late load would have landed (${stable} of ${N}); the kind lists the source in assets()`, firstOk === N && stable === N && K2D.brandField.assets({ logo: 'a.png' })[0] === 'a.png' && K2D.brandField.assets({ logo: null }).length === 0 && K2D.brandField.assets({ logo: IMGS[0] }).length === 0);
  { const o = mk('broken-logo.png'); await o.layer.ready(); const a = frame(o, 1.5); await new Promise((r) => setTimeout(r, 40)); const b = frame(o, 1.5);
    R.check('brandField URL logo that fails to load: ready() still resolves, the placeholder mark is drawn, and it stays the same frame (never a half state)', a === b && nDraw(o.log) === 0 && /fillText/.test(a)); }
  { const o = mk(fake('L')); await o.layer.ready(); frame(o, 1.5); R.check('brandField with an already decoded logo object draws it on the first frame', nDraw(o.log) === 1); }
  if (had) globalThis.Image = saved; else delete globalThis.Image; }
/* 5c. epicycle readout: legible type, a note that cannot be blanked, movable */
{ const fonts = (log) => log.filter((x) => x.startsWith('font=')).map((x) => parseFloat(/([\d.]+)px/.exec(x)[1])), texts = (log) => log.filter((x) => x.startsWith('fillText')).map((x) => x.slice(8).split(',')[0]);
  const log = rec('epicycleDraw', 2.0), f = fonts(log), tx = texts(log), blank = recS('epicycleDraw', 2.0, { source: '' }), nul = recS('epicycleDraw', 2.0, { source: null }), base = recS('epicycleDraw', 2.0), custom = recS('epicycleDraw', 2.0, { source: 'my own note' });
  const tall = fonts(rec('epicycleDraw', 2.0, {}, 1080, 1920)), tt = texts(rec('epicycleDraw', 2.0, {}, 1080, 1920));
  R.check(`epicycleDraw readout: three lines (${tx.join(' | ')}), type ${Math.min(...f)}..${Math.max(...f)} px at 1080p (note >= 22, never the 14 px of before), the same px on a 1080 x 1920 frame (shorter side); an empty or null source falls back to the default note (a printed number is never unlabelled); a custom source replaces it; readout: false prints nothing`,
    tx.length === 3 && /^N = \d+/.test(tx[0]) && Math.min(...f) >= 22 && Math.max(...f) >= 36 && JSON.stringify(f) === JSON.stringify(tall) && tt.length === 3 && blank === base && nul === base && custom !== base && texts(rec('epicycleDraw', 2.0, { readout: false })).length === 0);
  const up = rec('epicycleDraw', 2.0, { readoutAt: [0.5, 0.7] }).filter((x) => x.startsWith('fillText') && /N = /.test(x))[0], lo = log.filter((x) => x.startsWith('fillText') && /N = /.test(x))[0], ay = (x) => +x.split(',')[2];
  R.check(`epicycleDraw readoutAt moves the readout (N line at y ${ay(lo).toFixed(0)} by default, ${ay(up).toFixed(0)} at readoutAt y 0.7, so it can sit inside a 9:16 safe zone)`, ay(up) < ay(lo) - 150); }

/* 6. embeddingCloud maths */
{ const p = { ...K2D.embeddingCloud.d }, P = cloudPlan(p, W, H), d = (pt) => Math.hypot(pt.pos[0] - P.q[0], pt.pos[1] - P.q[1], pt.pos[2] - P.q[2]);
  const brute = P.pts.map((pt, i) => [d(pt), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, p.k).map(([, i]) => i);
  R.check(`embeddingCloud: the ${p.k} lit points are exactly the ${p.k} nearest to the query vector (brute-force check on ${P.pts.length} points), computed once in the plan`, JSON.stringify(P.nn) === JSON.stringify(brute) && P.nn.length === p.k && P.pts.length === p.n + p.thumbs);
  const nT = (cloudPlan({ ...p, thumbs: 999 }, W, H).pts.filter((x) => x.thumb).length); R.check('embeddingCloud: the thumbnail count is capped at 48 (render time), however many are asked for', nT === 48);
  const tl = p.queryAt + p.queryDur * 0.6 + p.liftDur + 0.2, a = embeddingState(tl, p, { W, H }), b = embeddingState(tl, { ...p, queryAt: null }, { W, H });
  const dz = a.pts.map((q, i) => q.z - b.pts[i].z); R.check(`embeddingCloud: after the lift every neighbour sits exactly lift (${p.lift}) closer to the camera than before and every other point is unchanged`, a.pts.every((q, i) => (q.nb >= 0 ? near(dz[i], p.lift, 1e-9) : near(dz[i], 0, 1e-12))));
  const ms = (p.markSize * H) / 100, outline = (d) => flattenPath(d, { seg: 16 }).map(([x, y]) => [p.center[0] * W + (x - 50) * ms, p.center[1] * H + (y - 50) * ms]);
  const dist = (mt, x, y) => { let m = Infinity; for (let i = 0; i < mt.length; i++) { const a0 = mt[i], b0 = mt[(i + 1) % mt.length], dx = b0[0] - a0[0], dy = b0[1] - a0[1], l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((x - a0[0]) * dx + (y - a0[1]) * dy) / l2)); m = Math.min(m, Math.hypot(x - a0[0] - k * dx, y - a0[1] - k * dy)); } return m; };
  const TRI = 'M10 10 L90 10 L50 90 Z', c = embeddingState(6, { ...p, collapseAt: 1.5 }, { W, H }), c2 = embeddingState(6, { ...p, collapseAt: 1.5, mark: TRI }, { W, H }), m1 = outline(DEFAULT_MARK), m2 = outline(TRI);
  const worst = Math.max(...c.pts.map((q) => dist(m1, q.x, q.y))), worst2 = Math.max(...c2.pts.map((q) => dist(m2, q.x, q.y)));
  R.check(`embeddingCloud collapse: after collapseAt + spread + collapse every one of the ${c.pts.length} points lies on the mark outline (worst ${worst.toExponential(1)} px off); with mark: your own SVG path (a triangle) they land on that outline instead (${worst2.toExponential(1)} px)`, worst < 1e-6 && worst2 < 1e-6 && c.pts.every((q) => q.kc === 1) && c2.pts.every((q) => q.kc === 1) && dist(m1, c2.pts[0].x, c2.pts[0].y) > 1); }

/* 7. epicycleDraw maths */
const distSeg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)); return Math.hypot(px - a[0] - k * dx, py - a[1] - k * dy); };
const toPx = (name, p) => { const [bw, bh] = p.pathBox, s = Math.min(W / bw, H / bh) * p.scale, ox = p.center[0] * W - (bw * s) / 2, oy = p.center[1] * H - (bh * s) / 2; const raw = flattenPath(PATHS[name], { seg: 48 }).map(([x, y]) => [ox + x * s, oy + y * s]); return raw; };
const hausdorff = (name, closed) => { const p = { ...K2D.epicycleDraw.d, path: name, closed }, D = epicycleDFT(p, W, H), raw = toPx(name, p); if (closed && Math.hypot(raw[0][0] - raw.at(-1)[0], raw[0][1] - raw.at(-1)[1]) > 1e-9) raw.push(raw[0]);
  const Rn = 3000, curve = Array.from({ length: Rn }, (_, i) => epicycleTip(D, D.coef.length, i / Rn)); let h1 = 0, h2 = 0;
  for (const q of curve) { let m = Infinity; for (let i = 0; i < raw.length - 1; i++) m = Math.min(m, distSeg(q[0], q[1], raw[i], raw[i + 1])); h1 = Math.max(h1, m); }
  for (const r of raw) { let m = Infinity; for (const q of curve) m = Math.min(m, Math.hypot(q[0] - r[0], q[1] - r[1])); h2 = Math.max(h2, m); } return Math.max(h1, h2); };
{ const p = { ...K2D.epicycleDraw.d }, D = epicycleDFT(p, W, H); let worst = 0; for (let k = 0; k < D.M; k += 37) { const q = epicycleTip(D, D.coef.length, k / D.M); worst = Math.max(worst, Math.hypot(q[0] - D.pts[k][0], q[1] - D.pts[k][1])); }
  R.check(`epicycleDraw: with all ${D.coef.length} terms the chain tip passes through its ${D.M} path samples (worst ${worst.toExponential(1)} px); the coefficients are computed once and cached`, worst < 1e-6 && epicycleDFT(p, W, H) === D); }
{ const hs = [['bird', 'auto'], ['wave', false], ['spiral', false], ['swoop', false]].map(([n, c]) => [n, hausdorff(n, c === 'auto' ? true : c)]);
  R.check(`epicycleDraw N = full: the trace matches the input path at 1080p, Hausdorff ${hs.map(([n, v]) => n + ' ' + v.toFixed(2)).join(', ')} px (< 1; closed outline sampled once, open paths traced there and back)`, hs.every(([, v]) => v < 1)); }
{ const p = { ...K2D.epicycleDraw.d }, D = epicycleDFT(p, W, H), e = [4, 16, 64, 'full'].map((n) => epicycleCurve(D, n === 'full' ? D.coef.length : n).err);
  R.check(`epicycleDraw: the mean error (distance of the drawn curve from the INPUT path, not from the DFT's own samples) falls as terms are added (N = 4, 16, 64, full: ${e.map((v) => v.toFixed(2) + '%').join(', ')} of the figure size); at full it is small but not a computed 0 (${e[3].toExponential(1)}%, printed as ${errText(e[3])})`, e[0] > e[1] && e[1] > e[2] && e[2] > e[3] && e[3] < 0.01 && e[3] > 0 && e[0] > 2 && errText(e[3]) === '<0.01' && errText(0.5) === '0.50');
  const steps = [[0, 4], [3, 16], [6, 64]], pp = { ...p, steps, at: 0.5, period: 3 }, s1 = epicycleState(0.5 + 1.5, pp, { W, H }), s2 = epicycleState(0.5 + 3.0, pp, { W, H }), s3 = epicycleState(0.5 + 6.9, pp, { W, H });
  R.check('epicycleDraw steps: the term count follows the step table and every step re-traces from phase 0 (N 4 -> 16 -> 64)', s1.N === 4 && near(s1.phi, 0.5) && s2.N === 16 && near(s2.phi, 0) && s3.N === 64 && near(s3.phi, 0.3, 1e-9));
  const c1 = rec('epicycleDraw', 0.2 + 0.5 * 4, { at: 0.2, steps: null, terms: 32 }).filter((x) => x.startsWith('lineTo')).length, c2 = rec('epicycleDraw', 0.2 + 1.5 * 4, { at: 0.2, steps: null, terms: 32 }).filter((x) => x.startsWith('lineTo')).length;
  const tr1 = rec('epicycleDraw', 0.2 + 1.5 * 4, { at: 0.2, steps: null, terms: 32, trail: 0.15 }).filter((x) => x.startsWith('lineTo')).length;
  R.check(`epicycleDraw trail: the first trace is drawn only up to the tip (${c1} segments at half a trace, ${c2} once it closed); a short trail keeps ${tr1} segments, read from the analytic curve`, c1 < c2 * 0.7 && tr1 < c2 * 0.4); }

/* 8. hexMosaic maths */
{ const p = { ...K2D.hexMosaic.d }, T = hexState(0, p, { W, H }), r = p.radius * (H / 1080), w = Math.sqrt(3) * r; let lattice = true;
  for (const t of T) { const row = Math.round(t.y / (1.5 * r)), q = t.x / w - (row & 1 ? 0.5 : 0); if (!near(q, Math.round(q), 1e-9) || !near(t.y, row * 1.5 * r, 1e-9)) lattice = false; }
  let worst = 0; for (let i = 0; i < 300; i++) { const x = rng() * W, y = rng() * H; let m = Infinity; for (const t of T) m = Math.min(m, Math.hypot(t.x - x, t.y - y)); worst = Math.max(worst, m); }
  R.check(`hexMosaic: ${T.length} tiles on an axial hex lattice (row step 1.5 r, column step sqrt(3) r, odd rows offset half a column) and the field covers the frame (farthest of 300 random points is ${worst.toFixed(1)} px from a centre, r = ${r})`, lattice && worst <= r + 1e-6); }
{ const p = { ...K2D.hexMosaic.d, waves: [{ at: 0.3, from: [0, 0.5], speed: 1500 }] }, T0 = hexState(0, p, { W, H }), S = H / 1080, dt = 1 / 240; let ok = true, mx = 0, mn = 1e9, n = 0;
  const onset = new Map(); for (let t = 0; t < 3; t += dt) hexState(t, p, { W, H }).forEach((s, i) => { if (!onset.has(i) && s.k > 0 && s.k < 1) onset.set(i, t); });
  for (const [i, t] of onset) { const d = Math.hypot(T0[i].x - 0, T0[i].y - 0.5 * H) / (1500 * S), lag = t - 0.3 - d; mx = Math.max(mx, lag); mn = Math.min(mn, lag); n++; if (lag < -dt || lag > 0.08 + 2 * dt) ok = false; }
  R.check(`hexMosaic: each tile starts to flip at wave time + distance / speed (+ at most 0.08 s of seeded jitter): ${n} tiles, lag ${mn.toFixed(3)}..${mx.toFixed(3)} s`, ok && n > 150);
  const mid = hexState(0.5, p, { W, H }), band = mid.filter((s) => s.k > 0 && s.k < 1).length, done = hexState(3, p, { W, H });
  R.check(`hexMosaic: a wave front is a band (${band} of ${mid.length} tiles mid-flip at 0.5 s) and after it every tile shows face 1 at full width`, band > 5 && band < mid.length * 0.5 && done.every((s) => s.face === 1 && s.sx === 1));
  const a = hexState(0.62, p, { W, H }); R.check('hexMosaic flip: the face changes exactly at the narrowest point of the flip (sx near 0, face switches at k 0.5)', a.filter((s) => s.k > 0.45 && s.k < 0.55).every((s) => s.sx < 0.16) && a.filter((s) => s.k < 0.5 && s.k > 0).every((s) => s.face === 0) && a.filter((s) => s.k >= 0.5 && s.k < 1).every((s) => s.face === 1)); }

/* 9. convergeToDot maths */
{ const p = { ...K2D.convergeToDot.d }, end = p.at + p.stagger + p.dur + 0.05, c = convergeState(end, p, { W, H }), cx = p.center[0] * W, cy = p.center[1] * H, S = H / 1080;
  R.check(`convergeToDot: after at + stagger + dur all ${c.nodes.length} nodes sit on the centre (${Math.max(...c.nodes.map((n) => Math.hypot(n.x - cx, n.y - cy))).toExponential(1)} px off) and the dot has grown to ${p.dot} px`, c.nodes.every((n) => near(n.x, cx, 1e-9) && near(n.y, cy, 1e-9)) && c.nodes.slice(1).every((n) => n.k === 1) && near(c.hub, p.dot * S, 1e-9));
  const t1 = p.at + 0.15, a = convergeState(t1, p, { W, H }), b = convergeState(t1, { ...p, order: 'inside-out' }, { W, H }), home = convergeState(0, { ...p, wobble: 0 }, { W, H }), dist = home.nodes.map((n) => Math.hypot(n.x - cx, n.y - cy)), idx = dist.map((d, i) => [d, i]).filter(([, i]) => i > 0).sort((x, y) => x[0] - y[0]), nearI = idx[0][1], farI = idx.at(-1)[1];
  R.check(`convergeToDot order: outside-in leaves the farthest node first (k ${a.nodes[farI].k.toFixed(2)} vs nearest ${a.nodes[nearI].k.toFixed(2)} at 0.15 s); inside-out reverses it (${b.nodes[nearI].k.toFixed(2)} vs ${b.nodes[farI].k.toFixed(2)})`, a.nodes[farI].k > 0 && a.nodes[nearI].k === 0 && b.nodes[nearI].k > 0 && b.nodes[farI].k === 0);
  const t2 = p.at + 1.3, st = convergeState(t2, p, { W, H }), log = rec('convergeToDot', t2).filter((x) => /^(moveTo|lineTo)/.test(x)), pts = new Set(st.nodes.map((n) => n.x.toFixed(3) + ',' + n.y.toFixed(3))), got = log.map((x) => x.replace(/^(moveTo|lineTo)/, ''));
  const live = st.edges.filter(([i, j]) => Math.max(st.nodes[i].k, st.nodes[j].k) <= 0.985).length;
  R.check(`convergeToDot: the ${live} drawn lines have both ends on the node positions of that same frame (recomputed every frame, no stored state), lines whose end reached the dot are dropped`, got.length === live * 2 && got.every((q) => pts.has(q)) && live < st.edges.length);
  const r0 = convergeState(p.at - 0.1, { ...p, reverse: true }, { W, H }), r1 = convergeState(p.at + p.stagger + p.dur + 0.05, { ...p, reverse: true, wobble: 0 }, { W, H }), h0 = convergeState(0, { ...p, wobble: 0 }, { W, H });
  R.check('convergeToDot reverse (one dot blooming into a network): before at only the solid dot is on screen (1 arc), after at + stagger + dur every node is back home', r0.nodes.slice(1).every((n) => n.k === 1) && rec('convergeToDot', p.at - 0.1, { reverse: true }).filter((x) => x.startsWith('arc')).length === 1 && r1.nodes.every((n, i) => near(n.x, h0.nodes[i].x, 1e-9) && near(n.y, h0.nodes[i].y, 1e-9) && n.k === 0)); }

/* 10. Chrome (hardware GPU not needed for Canvas2D, but the harness refuses software GL): mounts, pixels, budgets */
if (CHROME) {
  const { open, decodePNG, png } = await import('./harness.mjs'); const h = await open('/layers/demo/r45.html'); await h.page.setViewport({ width: 960, height: 540 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-r45-')), tiles = [];
  const shot = async (name) => { const f = path.join(dir, name + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); return f; };
  const STACKS = [
    ['embeddingCloud: query + neighbours', [{ kind: 'embeddingCloud', params: {} }], 2.4, '#0B1210'], ['embeddingCloud: collapsed into the mark', [{ kind: 'embeddingCloud', params: { collapseAt: 3.0 } }], 5.4, '#0B1210'],
    ['epicycleDraw: N = 4', [{ kind: 'epicycleDraw', params: { steps: [[0, 4], [3, 16], [6, 64], [9, 'full']], period: 3 } }], 2.2, '#07121C'], ['epicycleDraw: N = 64', [{ kind: 'epicycleDraw', params: { steps: [[0, 4], [3, 16], [6, 64], [9, 'full']], period: 3 } }], 8.6, '#07121C'],
    ['epicycleDraw: full + inset', [{ kind: 'epicycleDraw', params: { steps: [[0, 'full']], period: 3, inset: [0.7, 0.06, 0.26, 0.3] } }], 4.2, '#07121C'], ['hexMosaic: wave front + panel', [{ kind: 'hexMosaic', params: { panel: { rect: [0.3, 0.28, 0.4, 0.44] } } }], 0.6, '#F3F1EC'],
    ['hexMosaic: engraved', [{ kind: 'hexMosaic', params: {} }], 2.0, '#F3F1EC'], ['convergeToDot: network', [{ kind: 'convergeToDot', params: { bg: '#F3F1EC', nodes: 34 } }], 0.4, '#F3F1EC'], ['convergeToDot: contracting', [{ kind: 'convergeToDot', params: { bg: '#F3F1EC', nodes: 34 } }], 1.3, '#F3F1EC'],
  ];
  for (const [label, layers, t, plate] of STACKS) {
    const kinds = await h.page.evaluate((l, t, pl) => window.stack(l, t, 960, 540, pl), layers, t, plate), a = await h.page.evaluate(() => window.pixels());
    await h.page.evaluate(() => window.again(0.37)); await h.page.evaluate((t) => window.again(t), t); const b = await h.page.evaluate(() => window.pixels());
    R.check(`${label}: mounted via mountStack (${kinds.join(' + ')}), bit-identical at t ${t} after rendering t 0.37`, kinds.length === layers.length && a === b); tiles.push([`${label} t=${t}`, await shot('s' + tiles.length)]);
  }
  for (const k of KINDS) { const L = [{ kind: k, params: {} }]; await h.page.evaluate((l) => window.stack(l, 1, 960, 540, '#000'), L); const order = [0.5, 3.1, 1.2, 7.7, 2.2, 5.0], ref = [];
    for (const t of order) { await h.page.evaluate((t) => window.again(t), t); ref.push(await h.page.evaluate(() => window.pixels())); }
    let ok = true; for (const i of shuffle(order.map((_, i) => i))) { await h.page.evaluate((t) => window.again(t), order[i]); if ((await h.page.evaluate(() => window.pixels())) !== ref[i]) ok = false; }
    R.check(`${k}: pixels identical when the same 6 times are rendered again in shuffled order`, ok); }
  /* real images: three solid-colour PNG data URLs through stack.ready(). Before the images decode a tile is a placeholder; after it every frame draws the image, the same pixels on every
     repeat and in any seek order, and the page makes ONE Image object per source however many frames and tiles there are. */
  { const solid = (r, g, b) => { const bf = Buffer.alloc(64 * 48 * 4); for (let i = 0; i < bf.length; i += 4) { bf[i] = r; bf[i + 1] = g; bf[i + 2] = b; bf[i + 3] = 255; } return 'data:image/png;base64,' + png(64, 48, bf).toString('base64'); };
    const SETS = [[[255, 0, 255], [0, 255, 255], [255, 255, 0]], [[255, 128, 0], [0, 128, 255], [128, 255, 0]]];
    for (const [label, mk, hero, plate, rgbs] of [['hexMosaic image faces', (U) => ({ kind: 'hexMosaic', params: { faces: ['image'], images: U, waves: [] } }), 1.0, '#101010', SETS[0]], ['embeddingCloud thumbnails', (U) => ({ kind: 'embeddingCloud', params: { images: U, thumbs: 40, queryAt: null } }), 1.0, '#0B1210', SETS[1]]]) {
      const URLS = rgbs.map(([r, g, b]) => solid(r, g, b)), layer = mk(URLS);
      await h.page.evaluate(() => { window.__imgs = 0; if (!window.__Image) { window.__Image = window.Image; window.Image = class extends window.__Image { constructor(...a) { super(...a); window.__imgs++; } }; } });
      await h.page.evaluate((l, t, pl) => window.stack([l], t, 960, 540, pl), layer, hero, plate); const before = await h.page.evaluate((rg) => rg.reduce((a, [r, g, b]) => a + window.countColor(r, g, b), 0), rgbs);
      await h.page.evaluate(() => window.ready()); await h.page.evaluate((t) => window.again(t), hero); const first = await h.page.evaluate(() => window.pixels()), after = await h.page.evaluate((rg) => rg.reduce((a, [r, g, b]) => a + window.countColor(r, g, b), 0), rgbs);
      let same = true; for (const t of [0.3, 2.2, hero, 5.1, hero, 0.7, hero]) { await h.page.evaluate((t) => window.again(t), t); if (t === hero && (await h.page.evaluate(() => window.pixels())) !== first) same = false; }
      const n = await h.page.evaluate(() => window.__imgs);
      R.check(`${label} (real images): placeholders before the images decode (${before} image-coloured pixels), the images drawn once they have (${after}), identical pixels at t ${hero} on every repeat and after other times, ${n} Image objects for ${URLS.length} sources over 10 frames`,
        before === 0 && after > 800 && same && n === URLS.length); } }
  await h.page.evaluate((l) => window.stack(l, 1, 3840, 2160, '#000'), [{ kind: 'hexMosaic', params: { waves: [{ at: 0.2, from: [0, 0.5] }], panel: { rect: [0.3, 0.28, 0.4, 0.44] } } }]); await h.page.evaluate(() => window.timeIt(0.2, 4));
  const ms4k = await h.page.evaluate(() => window.timeIt(0.2, 24)); R.check(`hexMosaic at 4K (3840 x 2160, wave + panel): ${ms4k.toFixed(1)} ms per frame (budget 120 ms)`, ms4k < 120);
  await h.page.evaluate((l) => window.stack(l, 1, 1920, 1080, '#000'), [{ kind: 'embeddingCloud', params: { n: 420, thumbs: 48 } }]); await h.page.evaluate(() => window.timeIt(2, 4));
  const msC = await h.page.evaluate(() => window.timeIt(2, 24)); R.check(`embeddingCloud at 1080p (420 dots + 48 thumbnails): ${msC.toFixed(1)} ms per frame (budget 40 ms)`, msC < 40);
  await h.page.evaluate((l) => window.stack(l, 1, 1920, 1080, '#000'), [{ kind: 'epicycleDraw', params: { steps: [[0, 'full']], inset: [0.7, 0.06, 0.26, 0.3] } }]); await h.page.evaluate(() => window.timeIt(2, 4));
  const msE = await h.page.evaluate(() => window.timeIt(2, 24)); R.check(`epicycleDraw at 1080p (all terms, inset): ${msE.toFixed(1)} ms per frame (budget 40 ms)`, msE < 40);
  const errs = h.errors.filter((e) => !/favicon|404|willReadFrequently/.test(e)); R.check('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
  const out = path.join(ROOT, 'layers/demo/out/r45-sheet.png');
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
  console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(tiles)]).toString().trim());
  const res = R.done(); fs.writeFileSync(path.join(here, 'last-run-r45.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
} else { R.done(); process.exit(R.failed ? 1 : 0); }
