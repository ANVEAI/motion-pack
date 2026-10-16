/* xp-r78 layer (2026-10-16): background.skyClouds (layers/backgrounds-r78.js, merged into BG; presets 'clouds' and 'dunes').
   Node only by default, so CI runs it (no browser, no GPU): every draw is recorded on a recording 2D context and compared as text, and the closed-form field is read directly.
     registration + manifest, defaults (both presets), every parameter changes the draw and stays finite, shuffled-seek identity at 16:9 / 9:16 / 1:1, the SAME hash in two separate node
     processes, the field (cover is monotone, 0 = clear sky, seeds differ, a drift of 0 freezes it), loop seams (exact, both presets, the field and the draw), the band limit (the finest
     octave is never under 3 samples, the largest change of density per frame at 60 fps is small), the dunes (continuous crests inside the frame, near ridges lower than far ones, relief 0 =
     flat, the light face flips with the sun side), unique per item, parameter guards (0, negative, NaN, huge, infinite, strings, null, objects: sanitised or clamped, never thrown, bounded
     call count; bad colours, t and frame size throw a clear error).
   --chrome (local, real Chrome): mounts through overlay.js mountStack, bit-identical pixels after another t and in shuffled order, the sky is lighter at the horizon than at the top, the loop
     seam is pixel-identical, a render-time budget; writes layers/demo/out/r78-sheet.png + .jpg and tests/last-run-r78.json.
   run: node layers/tests/r78.test.mjs [--chrome] */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { BG, BackgroundLayer } from '../backgrounds.js'; import { ALL_KINDS } from '../overlay.js';
import { BG_R78, SKY_DEFAULTS, SKY_RANGE, skyParams, cloudAt, cloudDensity, cloudGrid, cloudOctaves, cloudRates, cloudS0, cloudPeriod, duneProfile, duneWind } from '../backgrounds-r78.js';
import { reporter, ROOT } from './harness.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), CHROME = process.argv.includes('--chrome'), HASH = process.argv.includes('--hash'), W = 1920, H = 1080, KIND = 'skyClouds', HERO = 2.0;
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? (...a) => { log.push(String(k) + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s.toFixed(4)}${c}`) }; } : (...a) => { log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { width: 0 }; })), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (t, p = {}, w = W, h = H) => { const { g, log } = recorder(); BG[KIND].draw(g, w, h, t, { ...BG[KIND].d, ...p }); return log; };
const recS = (t, p, w, h) => rec(t, p, w, h).join('|'), finite = (s) => !/NaN|undefined|Infinity/.test(s), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const rng = (seed) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex'), D = { preset: 'dunes' };

/* the determinism fingerprint: a fixed list of (t, params, size) -> one hash. The same value must come out of every process. */
const FP = () => { const sets = [[0.1, {}, W, H], [0.9, D, W, H], [1.4, { cover: 0.8, scale: 2 }, 1080, 1920], [3.3, { loop: 6 }, 1080, 1080], [7.7, { seed: 9, grain: 1 }, W, H], [12.5, { ...D, loop: 5, ridges: 3, grain: 0.5 }, 960, 540], [20, { sky: ['#123456', '#abcdef', '#fedcba'] }, 960, 540]];
  return sha(sets.map(([t, p, w, h]) => recS(t, p, w, h)).join('\n') + JSON.stringify([cloudAt(0.3, 0.4, 5, {}), cloudDensity(0.7, 0.2, 11, { seed: 3 }), duneProfile(4, D, 2, 0.37)])); };
if (HASH) { console.log(FP()); process.exit(0); }

const R = reporter('layers xp-r78');
/* 1. registration */
R.check('skyClouds is merged into BG (same object as BG_R78), reachable through overlay.js ALL_KINDS, with tags, doc and order, and the other backgrounds are still there',
  BG[KIND] === BG_R78[KIND] && ALL_KINDS()[KIND] && typeof BG[KIND].draw === 'function' && BG[KIND].tags.length >= 8 && BG[KIND].doc.length > 200 && BG[KIND].order === 1 && ['gridTunnel', 'dotGrid', 'meshGradient', 'auroraRibbon'].every((k) => BG[k]) && BG[KIND].d === SKY_DEFAULTS);
{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers/manifest.json'), 'utf8')).components, row = man.find((c) => c.id === 'background.' + KIND);
  R.check('layers/manifest.json lists background.skyClouds with file layers/backgrounds-r78.js, tags, params, doc and this test (node make-manifests.mjs rewrites it)', row && row.file === 'layers/backgrounds-r78.js' && row.tags.length >= 8 && row.params && row.doc && /r78\.test\.mjs/.test(row.test) && /r78-sheet/.test(row.demo), JSON.stringify(row && { f: row.file, t: row.test, d: row.demo })); }
for (const [name, p] of [['clouds', {}], ['dunes', D]]) { const log = rec(HERO, p), s = log.join('|'); R.check(`defaults draw the ${name} preset at ${HERO} s (${log.length} canvas calls, finite numbers, a sky gradient first${name === 'dunes' ? ', one clipped ridge per layer' : ''})`,
  log.length > 100 && /^createLinearGradient/.test(log[0]) && /fillRect/.test(s) && finite(s) && (name === 'clouds' || log.filter((x) => x === 'clip').length === 5)); }

/* 2. params: every variant is read (the draw changes) and stays finite */
const VARIANTS = [{ sky: ['#112233', '#445566'] }, { sky: ['#112233', '#445566', '#778899'] }, { cover: 0.2 }, { cover: 0.95 }, { scale: 2 }, { scale: 0.5 }, { drift: 200 }, { drift: -80 }, { softness: 0 }, { softness: 1 }, { haze: 0 }, { haze: 1 }, { octaves: 2 }, { cells: 64 },
  { sun: [0.2, 0.4] }, { sun: false }, { sunGlow: 0 }, { sunGlow: 1.6 }, { sunSize: 0.8 }, { cloud: '#FFEEDD' }, { shade: '#334455' }, { loop: 6 }, { grain: 0.7 }, { seed: 9 }, { intensity: 0.4 }, { preset: 'dunes' }];
const DVARIANTS = [{ sand: ['#FFFFFF', '#CCCCCC', '#333333'] }, { ridges: 2 }, { ridges: 6 }, { height: 0.7 }, { relief: 0.2 }, { wind: 300 }, { loop: 4 }, { haze: 0 }, { seed: 9 }, { sun: [0.85, 0.3] }, { sun: false }, { cover: 0.7 }];
{ const base = recS(HERO), same = [], bad = []; for (const v of VARIANTS) { const s = recS(HERO, v); if (s === base) same.push(JSON.stringify(v)); if (!finite(s) || s.length < 10) bad.push(JSON.stringify(v)); }
  const dbase = recS(HERO, D), dsame = [], dbad = []; for (const v of DVARIANTS) { const s = recS(HERO, { ...D, ...v }); if (s === dbase) dsame.push(JSON.stringify(v)); if (!finite(s) || s.length < 10) dbad.push(JSON.stringify(v)); }
  R.check(`skyClouds: ${VARIANTS.length} cloud-preset and ${DVARIANTS.length} dunes-preset param variants all change the draw and stay finite`, !same.length && !bad.length && !dsame.length && !dbad.length, [same.length ? 'unchanged: ' + same.join(' ') : '', dsame.length ? 'dunes unchanged: ' + dsame.join(' ') : '', bad.concat(dbad).join(' ')].filter(Boolean).join(' | ')); }

/* 3. shuffled seek and the same hash in separate processes */
const ts = Array.from({ length: 60 }, (_, i) => -0.5 + i * 0.37);
for (const [w, h, name] of [[W, H, '16:9'], [1080, 1920, '9:16'], [1080, 1080, '1:1']]) for (const [pn, p] of [['clouds', {}], ['dunes', D]]) {
  const fwd = ts.map((t) => recS(t, p, w, h)), shf = new Map(shuffle(ts, rng(5)).map((t) => [t, recS(t, p, w, h)])); R.check(`${pn} ${name}: ${ts.length} times drawn forward and in shuffled order give identical draws, and twice in a row`, ts.every((t, i) => fwd[i] === shf.get(t)) && recS(HERO, p, w, h) === recS(HERO, p, w, h)); }
{ const h1 = FP(), run = () => execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--hash'], { encoding: 'utf8' }).trim(), a = run(), b = run();
  R.check('the same fingerprint (7 draws + field values) in this process and in two fresh processes: a pure function of t, no module state', h1 === a && a === b && a.length === 64, `${h1.slice(0, 12)} ${a.slice(0, 12)} ${b.slice(0, 12)}`); }

/* 4. the field */
{ const mean = (cv) => { const G = cloudGrid(HERO, { cover: cv }, 48, 27); return G.reduce((a, c) => a + c.cov, 0) / G.length; }, m = [0, 0.25, 0.5, 0.75, 1].map(mean);
  R.check(`cover is monotone: mean coverage ${m.map((v) => v.toFixed(2)).join(' < ')} for cover 0 .. 1; 0 is clear (< 0.02) and 1 is mostly covered (> 0.75)`, m.every((v, i) => !i || v > m[i - 1]) && m[0] < 0.02 && m[4] > 0.75, m.join(',')); }
{ const clear = rec(HERO, { cover: 0 }).join('|'), some = rec(HERO, { cover: 0.5 }).join('|'); R.check('cover 0 draws no cloud (the sky and the sun only); cover > 0 draws them', !/fillRect[^|]*\|fillStyle=rgba\(2(55|5[0-4]),/.test(clear.slice(clear.indexOf('fillRect') + 200)) && clear.length < some.length); }
{ const a = cloudAt(0.3, 0.4, 5, {}), b = (cloudAt(0.9, 0.9, 1, {}), cloudAt(0.3, 0.4, 5, {})), c = cloudAt(0.3, 0.4, 5, { seed: 8 }); R.check('cloudAt: the same point twice (with other points between) is the same, another seed is another field; cov and lit stay in 0..1', JSON.stringify(a) === JSON.stringify(b) && a.f !== c.f && cloudGrid(3, {}, 24, 14).every((q) => q.cov >= 0 && q.cov <= 1 && q.lit >= 0 && q.lit <= 1)); }
{ const f0 = cloudGrid(1, { drift: 0 }, 32, 18), f1 = cloudGrid(81, { drift: 0 }, 32, 18); R.check('drift 0 freezes the clouds (the field at t = 1 and t = 81 is the same)', f0.every((q, i) => q.cov === f1[i].cov && q.lit === f1[i].lit) && recS(1, { drift: 0 }) === recS(81, { drift: 0 })); }
{ const r = cloudRates({ drift: 108, scale: 1 }), r2 = cloudRates({ drift: -108 }); R.check('the drift is px per second at 1080: 108 px/s at scale 1 (three cells across the height) is 0.3 cells per second on the near layer and 0.55 x that on the far one; negative runs the other way', near(r.near, 0.3, 1e-9) && near(r.far, 0.165, 1e-9) && r2.near === -r.near && cloudS0({ scale: 1 }) === 3 && near(cloudS0({ scale: 2 }), 1.5, 1e-12)); }
{ const p = { drift: 54 }, a = cloudDensity(0.5, 0.5, 0, p), moved = cloudDensity(0.5, 0.5, 20, p); R.check('the clouds move: the density at one point changes over 20 s of drift, and lies in 0..1 over a grid', a !== moved && cloudGrid(2, p, 24, 14).every((q) => q.f >= 0 && q.f <= 1)); }

/* 5. loop seams */
for (const L of [2, 3, 5, 6, 7.3, 10]) { let ok = true, fld = true; const p = { loop: L, grain: 0.5 };
  for (const [pn, pp] of [['clouds', p], ['dunes', { ...D, ...p }]]) for (const t of [0, 0.4, 1.3, 2.9, 4.1, 1 / 30]) { if (recS(t, pp) !== recS(t + L, pp)) ok = false; }
  for (const t of [0, 0.7, 2.2]) for (const [x, y] of [[0.1, 0.2], [0.55, 0.6], [0.9, 0.9]]) { if (!near(cloudDensity(x, y, t, p), cloudDensity(x, y, t + L, p), 1e-9)) fld = false; for (const i of [0, 2, 4]) if (!near(duneProfile(t, { ...D, loop: L }, i, x), duneProfile(t + L, { ...D, loop: L }, i, x), 1e-6)) fld = false; }
  const moves = recS(0.7, p) !== recS(0.7 + L / 3, p) && recS(0.7, { ...D, loop: L }) !== recS(0.7 + L / 3, { ...D, loop: L });
  R.check(`loop ${L}: frame t and t + ${L} s are identical for both presets (6 times, grain included), the density and the dune crests match to 1e-9 / 1e-6, and a third of a loop later it is a different frame`, ok && fld && moves); }
{ R.check('without loop: frame t and t + 6 s differ (the drift keeps going)', recS(1.3, {}) !== recS(7.3, {}) && recS(1.3, D) !== recS(7.3, D)); }
{ const r = cloudRates({ drift: 36, loop: 7 }), P = cloudPeriod({ scale: 1 }); R.check('loop: each layer drifts a whole number of lattice periods per loop (near and far), at least one', Number.isInteger(+(r.near * 7 / P).toFixed(9)) && Number.isInteger(+(r.far * 7 / P).toFixed(9)) && Math.abs(r.near * 7 / P) >= 1 && Math.abs(r.far * 7 / P) >= 1, `${r.near * 7 / P} ${r.far * 7 / P}`); }

/* 6. the band limit */
{ let worst = 99, bad = []; for (const nx of [24, 48, 96, 160, 256]) for (const scale of [0.2, 0.5, 1, 2, 5]) for (const asp of [16 / 9, 1, 9 / 16]) { const p = { scale, octaves: 5 }, o = cloudOctaves(p, nx, asp), spc = nx / (Math.max(1, asp) * cloudS0(skyParams(p))), wave = spc / 2 ** (o - 1); if (o > 1 && wave < 3 - 1e-9) bad.push(`nx ${nx} scale ${scale}: ${wave.toFixed(2)}`); worst = Math.min(worst, o > 1 ? wave : 99); }
  R.check(`band limit: the finest kept octave has a wavelength of at least 3 samples for every grid size (24-256), scale (0.2-5) and aspect (the smallest is ${worst.toFixed(2)} samples)`, !bad.length, bad.slice(0, 3).join(' ; ')); }
{ const p = { drift: 36 }, A = 16 / 9, step = 1 / 60; let dmax = 0; for (const t of [0, 3.3, 9.1]) for (let j = 0; j < 36; j++) for (let i = 0; i < 64; i++) { const x = (i + 0.5) / 64, y = (j + 0.5) / 36; dmax = Math.max(dmax, Math.abs(cloudDensity(x, y, t + step, p, A) - cloudDensity(x, y, t, p, A))); }
  const q = { drift: 400 }; let fast = 0; for (const t of [0, 3.3]) for (let j = 0; j < 36; j += 3) for (let i = 0; i < 64; i += 3) { const x = (i + 0.5) / 64, y = (j + 0.5) / 36; fast = Math.max(fast, Math.abs(cloudDensity(x, y, t + step, q, A) - cloudDensity(x, y, t, q, A))); }
  R.check(`no shimmer: the largest change of density between two frames at 60 fps is ${dmax.toFixed(4)} at the default drift (limit 0.005) and ${fast.toFixed(4)} at 400 px/s (limit 0.03), over a 64 x 36 grid`, dmax < 0.005 && fast < 0.03); }

/* 7. the dunes */
{ const p = { ...D, ridges: 5 }; let ok = true, inside = true, prev = []; for (const i of [0, 1, 2, 3, 4]) { const ys = Array.from({ length: 201 }, (_, c) => duneProfile(3, p, i, c / 200)); if (ys.some((y) => !Number.isFinite(y) || y < 0 || y > H)) inside = false;
    const jump = Math.max(...ys.slice(1).map((y, c) => Math.abs(y - ys[c]))); if (jump > 20) ok = false; prev.push(ys.reduce((a, b) => a + b, 0) / ys.length); }
  R.check(`dunes: every crest line is continuous (no step over 20 px between 200 columns at 1080p) and inside the frame; the mean crest height falls from far (${prev[0].toFixed(0)} px) to near (${prev[4].toFixed(0)} px): the near dunes are lower in the frame`, ok && inside && prev.every((v, i) => !i || v > prev[i - 1])); }
{ const flat = Array.from({ length: 21 }, (_, c) => duneProfile(2, { ...D, relief: 0 }, 2, c / 20)); R.check('relief 0 flattens the crest lines (a constant y)', flat.every((y) => near(y, flat[0], 1e-9)));
  const a = duneProfile(0, { ...D, wind: 0 }, 3, 0.3), b = duneProfile(50, { ...D, wind: 0 }, 3, 0.3); R.check('wind 0 freezes the dunes; the wind is faster on the near ridges (parallax)', a === b && Math.abs(duneWind({ ...D, wind: 90 }, 4)) > Math.abs(duneWind({ ...D, wind: 90 }, 0)) && duneWind({ ...D, wind: 90 }, 0) !== 0); }
{ const L = recS(HERO, { ...D, sun: [0.15, 0.3] }), Rr = recS(HERO, { ...D, sun: [0.85, 0.3] }); R.check('the light face follows the sun side (sun left and sun right shade the dunes differently)', L !== Rr); }
{ const n = (r) => rec(HERO, { ...D, ridges: r }).filter((x) => x === 'clip').length; R.check('ridges draws that many clipped layers (1, 3, 6)', n(1) === 1 && n(3) === 3 && n(6) === 6); }

/* 8. unique per item: nothing global, no ids */
{ const s = recS(HERO, D), noId = !/url\(#|clipPath|id=|filter=/.test(s);
  const mk = () => { const calls = []; const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { calls.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { addColorStop: (s2, c) => calls.push('stop' + c) }; }), set: (o, k, v) => { calls.push(k + '=' + v); o[k] = v; return true; } });
    const canvas = { width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx }; return { canvas, calls }; };
  const a = mk(), b = mk(), la = new BackgroundLayer(a.canvas, KIND, { seed: 2 }, { width: 640, height: 360 }), lb = new BackgroundLayer(b.canvas, KIND, { preset: 'dunes', seed: 3 }, { width: 640, height: 360 });
  la.render(1.2); const A1 = a.calls.join('|'); a.calls.length = 0; lb.render(1.2); lb.render(0.4); la.render(1.2); const A2 = a.calls.join('|');
  R.check('unique per item: the draw emits no ids (no url(#...), clipPath, filter), and two layers of the same kind on one page (clouds and dunes, rendered in turn) draw exactly what each would alone', noId && A1 === A2 && A1.length > 100 && b.calls.join('|') !== A1); }

/* 9. guards */
{ const NUM = Object.keys(SKY_RANGE), bad = [], slow = []; let maxCalls = 0;
  for (const k of NUM) for (const v of [0, -1, -1e9, 1e9, 1e15, Infinity, -Infinity, 0.5]) for (const pre of [{}, D]) { const t0 = Date.now(); let log; try { log = rec(HERO, { ...pre, [k]: v }); } catch (e) { bad.push(`${k}=${v}: threw ${e.message}`); continue; } if (Date.now() - t0 > 4000) slow.push(`${k}=${v}`); maxCalls = Math.max(maxCalls, log.length); const s = log.join('|'); if (!finite(s)) bad.push(`${k}=${v}: not finite`); }
  R.check(`guards: ${NUM.length} numeric parameters x 8 hostile values x both presets never throw, never hang (< 4 s each), stay finite, and draw at most ${maxCalls} canvas calls (cap 40000: cells <= 256, ridges <= 6)`, !bad.length && !slow.length && maxCalls > 0 && maxCalls < 40000, bad.concat(slow).slice(0, 4).join(' ; ')); }
{ const NUM = Object.keys(SKY_RANGE), threw = [], notDefault = [], strBad = []; for (const pre of [{}, D]) { const base = recS(HERO, pre);
    for (const k of NUM) { for (const v of [NaN, Infinity, -Infinity, 'abc', '', ' ', null, undefined, {}, [], true]) { let s; try { s = recS(HERO, { ...pre, [k]: v }); } catch (e) { threw.push(`${k}=${String(v)}: ${e.message}`); continue; } if (s !== base) notDefault.push(`${pre.preset || 'clouds'} ${k}=${String(v)}`); }
      const dv = SKY_DEFAULTS[k] ?? 0.5, q = dv + 0.25 > SKY_RANGE[k][1] ? dv - 0.25 : dv + 0.25 < SKY_RANGE[k][0] ? SKY_RANGE[k][0] : dv + 0.25;
      try { if (recS(HERO, { ...pre, [k]: String(q) }) !== recS(HERO, { ...pre, [k]: q })) strBad.push(`${k}='${q}'`); } catch (e) { strBad.push(`${k}='${q}': ${e.message}`); } } }
  R.check(`guards: NaN, +-Infinity, a non-numeric string, '', null, undefined, an object, an array or a boolean for any of the ${NUM.length} numeric parameters throws nothing and draws exactly the default (the pack-wide sanitising policy)`, !threw.length && !notDefault.length, threw.concat(notDefault).slice(0, 4).join(' ; '));
  R.check('guards: a numeric string is read as the number (every numeric parameter)', !strBad.length, strBad.slice(0, 4).join(' ; ')); }
{ const throwsWith = (p, m) => { try { rec(HERO, p); return false; } catch (e) { return e.message.includes(m) && e.message.includes('skyClouds'); } };
  R.check('guards: a colour that is not #RGB / #RRGGBB, a sky with fewer than 2 colours, a bad sand or sun colour throws a clear error naming skyClouds; #RGB shorthand is accepted; more than 3 sky colours use the first 3',
    throwsWith({ sky: ['#7A3CFF', 'blue'] }, 'sky[1]') && throwsWith({ sky: ['#7A3CFF'] }, 'sky') && throwsWith({ sky: 'red' }, 'sky') && throwsWith({ cloud: 'white' }, 'cloud') && throwsWith({ shade: 7 }, 'shade') && throwsWith({ ...D, sand: ['#fff', '#eee', 'x'] }, 'sand[2]') && throwsWith({ sunColor: 'gold' }, 'sunColor') && !throwsWith({ sky: ['#abc', '#DEF'] }, 'x')
    && recS(HERO, { sky: ['#111111', '#222222', '#333333'] }) === recS(HERO, { sky: ['#111111', '#222222', '#333333', '#444444', '#555555'] })); }
{ const throwsWith = (f, m) => { try { f(); return false; } catch (e) { return e.message.includes(m); } };
  R.check('guards: t that is NaN or infinite throws; a zero, negative or NaN frame size throws; t = 1e9 and t = -1e9 draw finite numbers',
    throwsWith(() => rec(NaN), 'finite') && throwsWith(() => rec(Infinity), 'finite') && throwsWith(() => rec(1, {}, 0, 100), 'size') && throwsWith(() => rec(1, {}, 100, -5), 'size') && throwsWith(() => rec(1, {}, NaN, 100), 'size') && finite(recS(1e9)) && finite(recS(-1e9)) && finite(recS(1e9, D))); }
{ const q = skyParams({ cells: 1e9, ridges: 99, grain: 5, height: 9, cover: 7 }), base = skyParams({}), dn = skyParams(D);
  R.check('skyParams clamps: cells 1e9 -> 256, ridges 99 -> 6, grain 5 -> 1, height 9 -> 0.9, cover 7 -> 1; the defaults come back unchanged; the preset sets cover and sun when cover is -1 / sun is null (clouds 0.55, dunes 0.16); colours become RGB triples', q.cells === 256 && q.ridges === 6 && q.grain === 1 && q.height === 0.9 && q.cover === 1 && base.cells === SKY_DEFAULTS.cells && base.cover === 0.55 && dn.cover === 0.16 && base.skyRGB.length === 2 && base.skyRGB[0].length === 3 && Array.isArray(dn.sunAt) && skyParams({ sun: false }).sunAt === null); }

/* 10. Chrome */
if (CHROME) {
  const { open } = await import('./harness.mjs'); const h = await open('/layers/demo/r6.html'); await h.page.setViewport({ width: 960, height: 540 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-r78-')), tiles = [];
  const shot = async (name) => { const f = path.join(dir, name + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); return f; };
  const luma = (rows) => h.page.evaluate((r) => window.lumaRows(r), rows);
  const STACKS = [['clouds', {}, 1.0], ['clouds, later in the drift', {}, 9.0], ['overcast (cover 0.9, softness 0.8)', { cover: 0.9, softness: 0.8 }, 3.0], ['clear (cover 0.1)', { cover: 0.1 }, 3.0], ['dusk sky, big clouds', { sky: ['#2B3A67', '#F2A27A'], scale: 2, cloud: '#FFE9D6', shade: '#6C5B8F', sun: [0.3, 0.7] }, 3.0], ['dunes', { preset: 'dunes' }, 1.0], ['dunes, later in the wind', { preset: 'dunes' }, 9.0], ['dunes, sun on the right', { preset: 'dunes', sun: [0.82, 0.25] }, 1.0], ['dunes, loop 6 at t = 6', { preset: 'dunes', loop: 6 }, 6.0]];
  for (const [label, params, t] of STACKS) { const kinds = await h.page.evaluate((l, tt) => window.stack(l, tt, 960, 540, '#000'), [{ kind: KIND, params }], t), a = await h.page.evaluate(() => window.pixels());
    await h.page.evaluate(() => window.again(0.37)); await h.page.evaluate((tt) => window.again(tt), t); const b = await h.page.evaluate(() => window.pixels());
    R.check(`${label}: mounted via mountStack (${kinds.join(' + ')}), bit-identical at t ${t} after rendering t 0.37`, kinds.length === 1 && kinds[0] === KIND && a === b); tiles.push([`${label} t=${t}`, await shot('s' + tiles.length)]); }
  await h.page.evaluate((l) => window.stack(l, 3, 960, 540, '#000'), [{ kind: KIND, params: { cover: 0 } }]); const [top, , bot] = await luma([[0, 180], [180, 360], [360, 540]]);
  R.check(`pixels, clear sky: the horizon band (mean luma ${bot.toFixed(1)}) is lighter than the top band (${top.toFixed(1)}): the gradient runs top to horizon`, bot > top + 15);
  { const order = [0.5, 3.1, 1.2, 7.7, 2.2, 5.0], ref = []; await h.page.evaluate((l) => window.stack(l, 1, 960, 540, '#000'), [{ kind: KIND, params: { preset: 'dunes', cover: 0.4 } }]);
    for (const t of order) { await h.page.evaluate((t) => window.again(t), t); ref.push(await h.page.evaluate(() => window.pixels())); } let ok = true;
    for (const i of shuffle(order.map((_, i) => i), rng(5))) { await h.page.evaluate((t) => window.again(t), order[i]); if ((await h.page.evaluate(() => window.pixels())) !== ref[i]) ok = false; }
    R.check('skyClouds (dunes + clouds): pixels identical when the same 6 times are rendered again in shuffled order', ok); }
  for (const pre of [{}, D]) { await h.page.evaluate((l) => window.stack(l, 1, 960, 540, '#000'), [{ kind: KIND, params: { ...pre, loop: 6 } }]); let ok = true; for (const t of [0, 0.4, 1.3, 2.9, 4.1]) { await h.page.evaluate((t) => window.again(t), t); const a = await h.page.evaluate(() => window.pixels()); await h.page.evaluate((t) => window.again(t), t + 6); if ((await h.page.evaluate(() => window.pixels())) !== a) ok = false; }
    R.check(`skyClouds ${pre.preset || 'clouds'} loop 6: real pixels at t and t + 6 s are identical (5 times)`, ok); }
  await h.page.evaluate((l) => window.stack(l, 1, 1920, 1080, '#000'), [{ kind: KIND, params: { preset: 'dunes' } }]); await h.page.evaluate(() => window.timeIt(2, 4));
  const ms = await h.page.evaluate(() => window.timeIt(2, 24)); R.check(`skyClouds (dunes + clouds) at 1080p (includes the 1 px read-back): ${ms.toFixed(1)} ms per frame (budget 400 ms)`, ms < 400);
  const errs = h.errors.filter((e) => !/favicon|404|willReadFrequently/.test(e)); R.check('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
  const out = path.join(ROOT, 'layers/demo/out/r78-sheet.png');
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); S.save(sys.argv[1][:-4] + '.jpg', quality=84); print('sheet', sys.argv[1], S.size)`;
  console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(tiles)]).toString().trim());
  const res = R.done(); fs.writeFileSync(path.join(here, 'last-run-r78.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
} else { R.done(); process.exit(R.failed ? 1 : 0); }
