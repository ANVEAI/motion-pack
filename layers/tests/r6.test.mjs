/* layers round-6 part (2026-10-15): background.auroraRibbon (layers/backgrounds-r6.js, merged into BG).
   Node only by default, so CI runs it (no browser, no GPU): every draw is recorded on a recording 2D context and compared as text.
     registration + manifest, defaults, every parameter changes the draw (and stays finite), shuffled-seek identity at 16:9 / 9:16 / 1:1, the SAME hash in two separate node
     processes (pure function of t, no module-level state), nothing of the ribbon before riseAt, the rise (monotonic, 0 -> 1, off-frame at 0 by a property test over random
     parameters), the closed-form centre line (flat at crest 0, bounded by crest, drift < 1.2 px per frame), colour weights, the pivot flash, loop seams (exact, for loops that
     are and are not multiples of anything), grain (seeded, re-seeded at grainFps, none at 0, capped), unique per item (no shared ids, two interleaved layers do not touch each
     other), parameter guards (0, negative, NaN, huge, infinite: clamped or a clear error, bounded call count, no hang), the pivot cue (lead, loop = none, id resolves).
   Every check can fail: layers/tests/r6.mutants.json lists the mutations tools/mutation_check.py applies to backgrounds-r6.js; each must make this file fail (CI runs it).
   --chrome (local, real Chrome): mounts through overlay.js mountStack, bit-identical pixels after another t and in shuffled order, black before riseAt, the ribbon lit in the bottom
     third and the top third still black, loop seam pixel-identical, render-time budget; writes layers/demo/out/r6-sheet.png + tests/last-run-r6.json.
   run: node layers/tests/r6.test.mjs [--chrome] */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { BG, BackgroundLayer } from '../backgrounds.js'; import { ALL_KINDS } from '../overlay.js';
import { BG_R6, AURORA_DEFAULTS, auroraParams, auroraRise, auroraKick, auroraCentre, auroraWeight, auroraGrainIndex, cuesR6, CUES_R6 } from '../backgrounds-r6.js';
import { reporter, ROOT } from './harness.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), CHROME = process.argv.includes('--chrome'), HASH = process.argv.includes('--hash'), W = 1920, H = 1080, KIND = 'auroraRibbon', HERO = 2.0;
const recorder = () => { const log = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? (...a) => { log.push(String(k) + a.map((v) => v.toFixed(3))); return { addColorStop: (s, c) => log.push(`stop${s.toFixed(4)}${c}`) }; } : (...a) => { log.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { width: 0 }; })), set: (o, k, v) => { log.push(`${String(k)}=${typeof v === 'object' ? 'obj' : v}`); o[k] = v; return true; } }); return { g, log }; };
const rec = (t, p = {}, w = W, h = H) => { const { g, log } = recorder(); BG[KIND].draw(g, w, h, t, { ...BG[KIND].d, ...p }); return log; };
const recS = (t, p, w, h) => rec(t, p, w, h).join('|'), finite = (s) => !/NaN|undefined|Infinity/.test(s), near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const rng = (seed) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* the determinism fingerprint: a fixed list of (t, params, size) -> one hash. The same value must come out of every process. */
const FP = () => { const sets = [[0.1, {}, W, H], [0.9, {}, W, H], [1.4, { riseAt: 1, rise: 1 }, 1080, 1920], [3.3, { loop: 6 }, 1080, 1080], [7.7, { seed: 9, grain: 1 }, W, H], [12.5, { colors: ['#123456', '#abcdef'], bg: null }, 960, 540]];
  return sha(sets.map(([t, p, w, h]) => recS(t, p, w, h)).join('\n')); };
if (HASH) { console.log(FP()); process.exit(0); }

const R = reporter('layers round 6');
/* 1. registration: ids, defaults, doc, manifest, sound id */
R.check('auroraRibbon is merged into BG (same object as BG_R6), reachable through overlay.js ALL_KINDS, with tags, doc and order, and the other backgrounds are still there',
  BG[KIND] === BG_R6[KIND] && ALL_KINDS()[KIND] && typeof BG[KIND].draw === 'function' && BG[KIND].tags.length >= 5 && BG[KIND].doc.length > 80 && BG[KIND].order === 1 && ['gridTunnel', 'dotGrid', 'meshGradient'].every((k) => BG[k]) && BG[KIND].d === AURORA_DEFAULTS);
{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers/manifest.json'), 'utf8')).components, row = man.find((c) => c.id === 'background.' + KIND);
  R.check('layers/manifest.json lists background.auroraRibbon with file layers/backgrounds-r6.js, tags, params, doc and this test (node make-manifests.mjs rewrites it)', row && row.file === 'layers/backgrounds-r6.js' && row.tags.length >= 5 && row.params && row.params.seed === AURORA_DEFAULTS.seed && row.doc && row.test === 'layers/tests/r6.test.mjs' && row.kind === 'background'); }
{ const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), cs = cuesR6(KIND, {});
  R.check(`cuesR6: the pivot cue resolves in sfx/manifest.json (${cs.map((c) => c.id).join(', ')}), has a time >= 0 and a reason`, cs.length === 1 && SFX.has('snd.' + cs[0].id.split('/').slice(1).join('.')) && cs[0].t >= 0 && cs[0].why.length > 10 && Object.keys(CUES_R6).length === 1); }
{ const log = rec(HERO), s = log.join('|'); R.check(`defaults draw at ${HERO} s (${log.length} canvas calls, finite numbers, additive blend set and restored)`, log.length > 500 && /fillRect/.test(s) && finite(s) && s.includes('globalCompositeOperation=lighter') && log.lastIndexOf('globalCompositeOperation=source-over') > log.indexOf('globalCompositeOperation=lighter')); }

/* 2. params: every variant is read (the draw changes) and stays finite */
const VARIANTS = [{ colors: ['#FF0000', '#00FF00', '#0000FF'] }, { colors: ['#112233', '#445566'] }, { colors: ['#112233', '#445566', '#778899', '#AABBCC', '#DDEEFF'] }, { bg: '#101820' }, { bg: null }, { riseAt: 1.2 }, { rise: 3 }, { height: 0.4 }, { crest: 0.25 }, { waves: 5 }, { waves: 1 },
  { spread: 0.2 }, { core: 0 }, { core: 1.5 }, { halo: 0 }, { speed: 0.3 }, { loop: 6 }, { grain: 0 }, { grain: 1 }, { grainFps: 2 }, { res: 48 }, { intensity: 0.5 }, { seed: 9 }];
{ const base = recS(HERO); let same = [], bad = [];
  for (const v of VARIANTS) { const s = recS(HERO, v); if (s === base) same.push(JSON.stringify(v)); if (!finite(s) || s.length < 10) bad.push(JSON.stringify(v)); }
  R.check(`auroraRibbon: ${VARIANTS.length} param variants all change the draw and stay finite`, !same.length && !bad.length, (same.length ? 'unchanged: ' + same.join(' ') : '') + (bad.length ? ' bad: ' + bad.join(' ') : '')); }
{ const ra = 1.0, t = ra + 0.08, a = recS(t, { riseAt: ra }), b = recS(t, { riseAt: ra, kick: 0 }), c = recS(t, { riseAt: ra, kickDur: 2 }), tl = ra + 3, d = recS(tl, { riseAt: ra }), e = recS(tl, { riseAt: ra, kick: 0 });
  R.check('kick / kickDur are read right after riseAt and have no effect once the flash has decayed (the same frame 3 s later with and without kick)', a !== b && a !== c && d === e); }

/* 3. shuffled seek and the same hash in separate processes */
const ts = Array.from({ length: 70 }, (_, i) => -0.5 + i * 0.13);
for (const [w, h, name] of [[W, H, '16:9'], [1080, 1920, '9:16'], [1080, 1080, '1:1']]) {
  const fwd = ts.map((t) => recS(t, { riseAt: 1.5 }, w, h)), order = shuffle(ts.map((_, i) => i), rng(451)), shuf = new Map(order.map((i) => [i, recS(ts[i], { riseAt: 1.5 }, w, h)]));
  R.check(`auroraRibbon ${name}: identical draw calls in forward and shuffled order (${ts.length} seeks over [-0.5, 8.6] s, finite)`, fwd.every((s, i) => s === shuf.get(i) && finite(s))); }
{ const mine = FP(), a = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--hash']).toString().trim(), b = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--hash']).toString().trim();
  R.check(`pure function of t across processes: six frames (three sizes, loop, seed, transparent bg) hash to the same value here and in two fresh node processes (${mine.slice(0, 12)})`, mine === a && a === b && /^[0-9a-f]{64}$/.test(mine)); }
{ const A = recS(HERO), B = recS(1.1, { colors: ['#aa0000', '#00aa00'], seed: 2 }), A2 = recS(HERO), B2 = recS(1.1, { colors: ['#aa0000', '#00aa00'], seed: 2 });
  R.check('no state between draws: A, B, A, B in turn give the same A and the same B', A === A2 && B === B2 && A !== B); }

/* 4. before riseAt: the field only; no ribbon, no additive blend, whatever the colours */
{ const ra = 1.5, pre = rec(ra - 1 / 30, { riseAt: ra }), s = pre.join('|'), alt = recS(ra - 1 / 30, { riseAt: ra, colors: ['#FF0000', '#00FF00'], height: 0.5, halo: 1 }), at = rec(ra, { riseAt: ra }).join('|'), post = rec(ra + 0.3, { riseAt: ra }).join('|');
  R.check('before riseAt (t = riseAt - 1 frame, and t < 0): no gradient, no additive blend, the same calls whatever the colours, height and halo are; at riseAt (k = 0) it is still the bare field; 0.3 s later the ribbon is there',
    !/createLinearGradient|lighter/.test(s) && s === alt && !/createLinearGradient|lighter/.test(at) && /createLinearGradient/.test(post) && !/createLinearGradient/.test(rec(-3, { riseAt: ra }).join('|'))); }
{ const calls = rec(0.2, { riseAt: 5, grain: 0 }); R.check('bare field with grain 0 = one background fill and nothing else (a transparent field = nothing)', calls.length === 2 && calls[1].startsWith('fillRect') && rec(0.2, { riseAt: 5, grain: 0, bg: null }).length === 0); }

/* 5. the rise */
{ const p = { ...AURORA_DEFAULTS, riseAt: 1, rise: 2 }, ks = Array.from({ length: 81 }, (_, i) => auroraRise(0.5 + i * 0.05, p));
  R.check('auroraRise: 0 up to riseAt, 1 from riseAt + rise, monotonic non-decreasing in between, never outside [0, 1]', ks[0] === 0 && auroraRise(1, p) === 0 && auroraRise(3, p) === 1 && auroraRise(60, p) === 1 && ks.every((k, i) => k >= 0 && k <= 1 && (!i || k >= ks[i - 1])) && ks.some((k) => k > 0.2 && k < 0.8)); }
{ const r = rng(77); let bad = 0, worst = Infinity, badTop = 0;
  for (let q = 0; q < 300; q++) { const p = { ...AURORA_DEFAULTS, waves: 1 + Math.floor(r() * 5), crest: r() * 0.5, spread: 0.01 + r() * 0.49, height: 0.02 + r() * 0.88, seed: Math.floor(r() * 1e6), speed: r() * 2, loop: r() < 0.3 ? 1 + Math.floor(r() * 9) : 0 }, n = 2 + Math.floor(r() * 4), t = r() * 50;
    for (let i = 0; i < n; i++) for (let x = 0; x <= 16; x++) { const yc = auroraCentre(t, p, i, x / 16, { H, k: 0 }), yOff = (i - (n - 1) / 2) * 0.014 * H, edge = yc + yOff - 3.2 * p.spread * H - H; worst = Math.min(worst, edge); if (edge < -1e-6) bad++;
      const y1 = auroraCentre(t, p, i, x / 16, { H, k: 1 }); if (Math.abs(y1 - (H - p.height * H)) > p.crest * H + 1e-6) badTop++; } }
  R.check(`property test (300 random parameter sets): at k = 0 the whole glow of every strand (3.2 sigma, strand offset included) is below the frame bottom (worst margin ${worst.toFixed(1)} px, 0 = touching); at k = 1 the centre line stays within crest * H of the rest height`, bad === 0 && badTop === 0 && worst >= -1e-6); }
{ const p = { ...AURORA_DEFAULTS, crest: 0 }; let ok = true; for (const t of [0, 1.3, 9.9]) for (const x of [0, 0.37, 1]) if (!near(auroraCentre(t, p, 1, x, { H, k: 1 }), H - p.height * H, 1e-9)) ok = false;
  const q = { ...AURORA_DEFAULTS, riseAt: 1, rise: 1 }; R.check('closed form: with crest 0 the centre line is exactly H - height * H at every x and t; at k = 0 it is below the frame bottom, halfway through the rise it is between', ok && auroraCentre(0, q, 0, 0.5, { H }) > H && near(auroraCentre(5, q, 0, 0.5, { H }) , auroraCentre(5, q, 0, 0.5, { H, k: 1 }), 1e-9) && auroraCentre(1.5, q, 0, 0.5, { H }) < auroraCentre(0, q, 0, 0.5, { H }) && auroraCentre(1.5, q, 0, 0.5, { H }) > auroraCentre(5, q, 0, 0.5, { H }) - 0.45 * H); }
{ const p = { ...AURORA_DEFAULTS }; let worst = 0, mean = 0, nn = 0;
  for (const i of [0, 1, 2]) for (let x = 0; x <= 8; x++) for (let f = 0; f < 600; f++) { const d = Math.abs(auroraCentre((f + 1) / 30, p, i, x / 8, { H, k: 1 }) - auroraCentre(f / 30, p, i, x / 8, { H, k: 1 })); worst = Math.max(worst, d); mean += d; nn++; }
  R.check(`drift is slow: the centre line moves at most ${worst.toFixed(2)} px per frame at 1080p (mean ${(mean / nn).toFixed(2)}) with the defaults (limit 1.2)`, worst <= 1.2 && worst > 0.05); }
{ let ok = true; for (let i = 0; i < 3; i++) for (let x = 0; x <= 10; x++) for (const t of [0, 3.3, 9]) { const w = auroraWeight(t, AURORA_DEFAULTS, i, x / 10); if (!(w >= 0.22 - 1e-9 && w <= 1 + 1e-9)) ok = false; }
  const moves = auroraWeight(0, AURORA_DEFAULTS, 0, 0.3) !== auroraWeight(10, AURORA_DEFAULTS, 0, 0.3), dif = auroraWeight(1, AURORA_DEFAULTS, 0, 0.1) !== auroraWeight(1, AURORA_DEFAULTS, 1, 0.1);
  R.check('colour weights stay in [0.22, 1], move with t, and differ between strands (the colour mix travels along the ribbon)', ok && moves && dif); }
{ const p = { ...AURORA_DEFAULTS, riseAt: 2, kick: 0.5, kickDur: 0.4 };
  R.check('pivot flash: 0 before riseAt, kick at riseAt, decaying monotonically to 0 by riseAt + kickDur, 0 after; a loop has none', auroraKick(1.99, p) === 0 && near(auroraKick(2, p), 0.5, 1e-9) && auroraKick(2.1, p) < auroraKick(2, p) && auroraKick(2.2, p) < auroraKick(2.1, p) && auroraKick(2.4, p) === 0 && auroraKick(9, p) === 0 && auroraKick(2.1, { ...p, loop: 4 }) === 0); }
{ const ra = 1, a = rec(ra + 0.05, { riseAt: ra, kick: 0.5 }).join('|'), b = rec(ra + 0.05, { riseAt: ra, kick: 0 }).join('|'), up = (s) => Math.max(...[...s.matchAll(/stop0\.5000rgba\((\d+),(\d+),(\d+),([\d.]+)\)/g)].map((m) => +m[4]));
  R.check(`the flash is drawn: the brightest gradient stop at riseAt + 0.05 s is higher with kick 0.5 than with kick 0 (${up(a).toFixed(3)} vs ${up(b).toFixed(3)})`, up(a) > up(b) && up(b) > 0); }


/* 5b. geometry of the draw itself: the sheared gradients follow the centre line, and the ribbon fades in from nothing (no pop) */
{ const raw = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { raw.push([String(k), a]); return { addColorStop() {} }; }), set: (o, k, v) => { o[k] = v; return true; } });
  const p = { ...AURORA_DEFAULTS, riseAt: 0.2, grain: 0, halo: 0, res: 24, bg: null }; BG[KIND].draw(g, W, H, 3.0, p);
  const tr = raw.filter(([n]) => n === 'transform').map(([, a]) => a), fr = raw.filter(([n]) => n === 'fillRect').map(([, a]) => a), cols = p.res, n3 = 3;
  let worst = 0, cont = 0, edges = 0;
  for (let s = 0; s < n3; s++) for (let c = 0; c < cols; c++) { const T = tr[s * cols + c], F = fr[s * cols + c], xa = F[0], xb = F[0] + F[2], yOff = (s - (n3 - 1) / 2) * 0.014 * H;
    const ya = T[1] * xa + T[5], yb = T[1] * xb + T[5]; worst = Math.max(worst, Math.abs(ya - (auroraCentre(3.0, p, s, xa / W, { H }) + yOff)), Math.abs(yb - (auroraCentre(3.0, p, s, xb / W, { H }) + yOff)));
    if (c) { const Tp = tr[s * cols + c - 1]; cont = Math.max(cont, Math.abs(Tp[1] * xa + Tp[5] - ya)); edges++; } }
  R.check(`geometry: ${tr.length} sheared gradient columns (3 strands x ${cols}) tile the frame width exactly, every column's bright line starts and ends ON the centre line (worst ${worst.toExponential(1)} px) and meets its neighbour (worst jump ${cont.toExponential(1)} px over ${edges} joins)`,
    tr.length === n3 * cols && fr.length === n3 * cols && worst < 1e-6 && cont < 1e-6 && fr[0][0] === 0 && fr[cols - 1][0] + fr[cols - 1][2] === W && fr.slice(0, cols).every((f, c, a) => !c || f[0] === a[c - 1][0] + a[c - 1][2])); }
{ const ra = 1, top = (t, p) => { const s = rec(t, { riseAt: ra, kick: 0, halo: 0, grain: 0, bg: null, ...p }).join('|'); return Math.max(0, ...[...s.matchAll(/rgba\(\d+,\d+,\d+,([\d.]+)\)/g)].map((m) => +m[1])); };
  const a = Array.from({ length: 30 }, (_, i) => top(ra + i / 30, {})), risen = top(ra + 6, {});
  R.check(`no pop: the strongest gradient stop is 0 at riseAt (${a[0].toFixed(3)}), under a tenth of the risen value one frame later (${a[1].toFixed(3)} vs ${risen.toFixed(3)}), and never falls during the first second of the rise`, a[0] < 0.03 && a[1] < 0.1 * risen && risen > 0.2 && a.every((v, i) => !i || v >= a[i - 1] - 1e-9)); }
{ const ra = 1, halo = (t) => { const s = rec(t, { riseAt: ra, kick: 0, grain: 0, bg: null }), i = s.findIndex((q) => q.startsWith('createLinearGradient')); return +/,([\d.]+)\)$/.exec(s[i + 1])[1]; }, h1 = halo(ra + 1 / 30), h6 = halo(ra + 6);
  R.check(`the bottom-edge halo rises with the ribbon: its first stop is ${h1.toFixed(3)} one frame after riseAt and ${h6.toFixed(3)} once risen`, h1 < 0.2 * h6 && h6 > 0.1); }
{ const p = { ...AURORA_DEFAULTS }; let sep = 0, n = 0; for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const t of [2, 5, 9]) { const y = [0, 1, 2].map((i) => auroraCentre(t, p, i, x, { H, k: 1 })); sep += Math.abs(y[0] - y[1]) + Math.abs(y[1] - y[2]); n += 2; }
  R.check(`strands fan out: the three centre lines are ${(sep / n).toFixed(1)} px apart on average at 1080p (they are not one line drawn three times); strand seeds differ`, sep / n > 4 && auroraCentre(3, p, 0, 0.4, { H, k: 1 }) !== auroraCentre(3, { ...p, seed: 7 }, 0, 0.4, { H, k: 1 })); }

/* 6. loop seams */
for (const L of [2, 4, 5, 6, 7, 7.3, 10]) { let ok = true, num = true; const p = { loop: L, grain: 0.6 };
  for (const t of [0, 0.4, 1.3, 2.9, 4.1, 1 / 30, 17 / 30]) { if (recS(t, p) !== recS(t + L, p)) ok = false; for (const i of [0, 1, 2]) for (const x of [0, 0.31, 0.9]) if (!near(auroraCentre(t, p, i, x, { H }), auroraCentre(t + L, p, i, x, { H }), 1e-6)) num = false; }
  const moves = recS(0.7, p) !== recS(0.7 + L / 3, p), up = rec(0, p).join('|');
  R.check(`loop ${L}: frame t and t + ${L} s are identical (7 times, centre lines within 1e-6 px, grain included); a third of a loop later it is a different frame; the ribbon is already up at t = 0`, ok && num && moves && /createLinearGradient/.test(up) && auroraGrainIndex(0.5, p) === auroraGrainIndex(0.5 + L, p)); }
{ const a = recS(1.3, { loop: 0 }), b = recS(7.3, { loop: 0 }); R.check('without loop: frame t and t + 6 s differ (the drift keeps going)', a !== b); }
{ const p = { loop: 4, fps: 30, grainFps: 24 }, idx = Array.from({ length: 120 }, (_, f) => auroraGrainIndex(f / 30, p)), o = { loop: 0, fps: 30, grainFps: 24 };
  R.check('grain index: counts up at grainFps (24 per s at 30 fps: 4 new specks sets per 5 frames), wraps with the loop, and never goes negative', idx.every((v, i) => v >= 0 && (!i || v >= idx[i - 1])) && idx[119] === Math.floor((119 * 24) / 30) && auroraGrainIndex(4, p) === 0 && auroraGrainIndex(2, o) === 48 && auroraGrainIndex(-1, p) >= 0); }

/* 7. grain */
{ const n = (s) => (s.match(/^rect/gm) || []).length, cnt = (p, w = W, h = H) => rec(HERO, { riseAt: 99, ...p }, w, h).filter((x) => x.startsWith('rect')).length;
  const none = cnt({ grain: 0 }), some = cnt({ grain: 0.4 }), more = cnt({ grain: 1 }), cap = cnt({ grain: 1 }, 7680, 4320), same = recS(HERO, { riseAt: 99 }) === recS(HERO, { riseAt: 99 }), f0 = recS(1.0, { riseAt: 99 }), f1 = recS(1 + 2 / 30, { riseAt: 99 }), f2 = recS(1 + 2 / 30, { riseAt: 99, seed: 7 });
  R.check(`grain: 0 draws no specks, more grain draws more specks (${none} / ${some} / ${more}), the count is capped (${cap} specks at 8K, cap 12000), the same index gives the same specks, the next frame different ones, another seed different ones`, none === 0 && some > 100 && more > some && cap <= 12000 && same && f0 !== f1 && f1 !== f2); }
{ const p = { riseAt: 99, grainFps: 10, fps: 30 }; const a = recS(0.0, p), b = recS(1 / 30, p), c = recS(2 / 30, p), d = recS(3 / 30, p);
  R.check('grainFps 10 at 30 fps: the specks change every third frame (frames 0-2 share them, frame 3 has new ones)', a === b && b === c && c !== d); }

/* 8. unique per item: nothing global, no ids, two interleaved layers do not touch each other */
{ const s = recS(HERO, {}), noId = !/url\(#|clipPath|id=|filter=/.test(s);
  const mk = () => { const calls = []; const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { calls.push(String(k) + a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')); return { addColorStop: (s2, c) => calls.push('stop' + c) }; }), set: (o, k, v) => { calls.push(k + '=' + v); o[k] = v; return true; } });
    const canvas = { width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx }; return { canvas, calls }; };
  const a = mk(), b = mk(), la = new BackgroundLayer(a.canvas, KIND, { riseAt: 0.2 }, { width: 640, height: 360 }), lb = new BackgroundLayer(b.canvas, KIND, { riseAt: 0.2, colors: ['#ff00ff', '#00ffff'], seed: 3 }, { width: 640, height: 360 });
  la.render(1.2); const A1 = a.calls.join('|'); a.calls.length = 0; lb.render(1.2); lb.render(0.4); la.render(1.2); const A2 = a.calls.join('|');
  R.check('unique per item: the draw emits no ids (no url(#...), clipPath, filter), and two layers of the same kind on one page (different colours and seed, rendered in turn) draw exactly what each would alone', noId && A1 === A2 && A1.length > 100 && b.calls.join('|') !== A1); }

/* 9. guards: 0, negative, NaN, huge, infinite: clamped or a clear error, bounded call count, no hang */
{ const NUM = Object.keys(AURORA_DEFAULTS).filter((k) => typeof AURORA_DEFAULTS[k] === 'number'), bad = [], slow = [];
  let maxCalls = 0;
  for (const k of NUM) for (const v of [0, -1, -1e9, 1e9, 1e15, Infinity, -Infinity, 0.5]) { const t0 = Date.now(); let log; try { log = rec(HERO, { [k]: v }); } catch (e) { bad.push(`${k}=${v}: threw ${e.message}`); continue; } if (Date.now() - t0 > 4000) slow.push(`${k}=${v}`); maxCalls = Math.max(maxCalls, log.length); const s = log.join('|'); if (!finite(s) || log.length > 130000) bad.push(`${k}=${v}: ${log.length} calls / non-finite`); }
  R.check(`guards: ${NUM.length} numeric parameters x 8 hostile values (0, negative, +-1e9, 1e15, +-Infinity, 0.5) never throw, never hang (< 4 s each), stay finite, and draw at most ${maxCalls} canvas calls (cap 130000: res <= 1024 columns, <= 5 strands, <= 12000 specks)`, !bad.length && !slow.length && maxCalls > 0, bad.concat(slow).slice(0, 4).join(' ; ')); }
{ const NUM = Object.keys(AURORA_DEFAULTS).filter((k) => typeof AURORA_DEFAULTS[k] === 'number'), notThrown = [], unclear = [];
  for (const k of NUM) for (const v of [NaN, '5', null, undefined, {}]) { try { rec(HERO, { [k]: v }); notThrown.push(`${k}=${String(v)}`); } catch (e) { if (!e.message.includes(k) || !e.message.includes('auroraRibbon')) unclear.push(`${k}: ${e.message}`); } }
  R.check(`guards: NaN, a string, null, undefined or an object for any of the ${NUM.length} numeric parameters throws an error that names auroraRibbon and the parameter`, !notThrown.length && !unclear.length, notThrown.concat(unclear).slice(0, 4).join(' ; ')); }
{ const throwsWith = (p, m) => { try { rec(HERO, p); return false; } catch (e) { return e.message.includes(m); } };
  R.check('guards: a colour that is not #RGB / #RRGGBB, fewer than 2 colours, or colors that is not an array throws a clear error; #RGB shorthand is accepted; more than 5 colours use the first 5',
    throwsWith({ colors: ['#7A3CFF', 'violet'] }, 'colors[1]') && throwsWith({ colors: ['#7A3CFF'] }, 'colors') && throwsWith({ colors: 'red' }, 'colors') && throwsWith({ bg: 'black' }, 'bg') && throwsWith({ colors: ['#7A3CFF', null] }, 'colors[1]') && !throwsWith({ colors: ['#abc', '#DEF'] }, 'x') && rec(HERO, { colors: ['#abc', '#DEF'] }).length > 100
    && recS(HERO, { colors: ['#111111', '#222222', '#333333', '#444444', '#555555'] }) === recS(HERO, { colors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'] })); }
{ const throwsWith = (f, m) => { try { f(); return false; } catch (e) { return e.message.includes(m); } };
  R.check('guards: t that is NaN or infinite throws; a zero, negative or NaN frame size throws; t = 1e9 and t = -1e9 draw finite numbers',
    throwsWith(() => rec(NaN), 'finite') && throwsWith(() => rec(Infinity), 'finite') && throwsWith(() => rec(1, {}, 0, 100), 'size') && throwsWith(() => rec(1, {}, 100, -5), 'size') && throwsWith(() => rec(1, {}, NaN, 100), 'size') && finite(recS(1e9)) && finite(recS(-1e9))); }
{ const base = auroraParams({}), q = auroraParams({ res: 1e9, waves: 99, grain: 5, height: 9 });
  R.check('auroraParams clamps: res 1e9 -> 1024, waves 99 -> 5, grain 5 -> 1, height 9 -> 0.9; the defaults come back unchanged; colours become RGB triples', q.res === 1024 && q.waves === 5 && q.grain === 1 && q.height === 0.9 && base.res === AURORA_DEFAULTS.res && base.rgb.length === 3 && base.rgb[0].length === 3); }

/* 10. the pivot cue */
{ const c0 = cuesR6(KIND, { riseAt: 10.8, lead: 0.1 })[0], c1 = cuesR6(KIND, { riseAt: 10.8, lead: 0.4 })[0], c2 = cuesR6(KIND, { riseAt: 0.05, lead: 0.4 })[0];
  R.check('cuesR6: the sound lands `lead` s BEFORE riseAt (10.8 - 0.1, 10.8 - 0.4), is never before 0, and is absent for a loop', near(c0.t, 10.7, 1e-9) && near(c1.t, 10.4, 1e-9) && c2.t === 0 && cuesR6(KIND, { loop: 4 }).length === 0 && c0.id === 'sfx/hit/sub_drop'); }
{ let threw = false; try { cuesR6('nope', {}); } catch { threw = true; } R.check('cuesR6 of an unknown kind throws', threw); }

/* 11. Chrome (Canvas2D needs no GPU, but the harness refuses software GL): mounts, pixels, loop seam, budget */
if (CHROME) {
  const { open } = await import('./harness.mjs'); const h = await open('/layers/demo/r6.html'); await h.page.setViewport({ width: 960, height: 540 }); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-r6-')), tiles = [];
  const shot = async (name) => { const f = path.join(dir, name + '.png'); await h.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 960, height: 540 } }); return f; };
  const luma = (rows) => h.page.evaluate((r) => window.lumaRows(r), rows);
  const STACKS = [['auroraRibbon: before riseAt', { riseAt: 1 }, 0.5], ['auroraRibbon: rising', { riseAt: 0.5 }, 1.1], ['auroraRibbon: risen', { riseAt: 0.5 }, 3.0], ['auroraRibbon: later in the drift', { riseAt: 0.5 }, 12.0], ['auroraRibbon: two colours', { riseAt: 0.5, colors: ['#FF8A00', '#00C2FF'] }, 3.0], ['auroraRibbon: loop 6', { loop: 6 }, 2.0]];
  for (const [label, params, t] of STACKS) { const kinds = await h.page.evaluate((l, t) => window.stack(l, t, 960, 540, '#000'), [{ kind: KIND, params }], t), a = await h.page.evaluate(() => window.pixels());
    await h.page.evaluate(() => window.again(0.37)); await h.page.evaluate((t) => window.again(t), t); const b = await h.page.evaluate(() => window.pixels());
    R.check(`${label}: mounted via mountStack (${kinds.join(' + ')}), bit-identical at t ${t} after rendering t 0.37`, kinds.length === 1 && kinds[0] === KIND && a === b); tiles.push([`${label} t=${t}`, await shot('s' + tiles.length)]); }
  await h.page.evaluate((l) => window.stack(l, 3, 960, 540, '#000'), [{ kind: KIND, params: { riseAt: 0.5, grain: 0 } }]);
  const [top, mid, bot] = await luma([[0, 180], [180, 360], [360, 540]]); await h.page.evaluate((l) => window.stack(l, 0.2, 960, 540, '#000'), [{ kind: KIND, params: { riseAt: 1, grain: 0 } }]);
  const [t0, m0, b0] = await luma([[0, 180], [180, 360], [360, 540]]);
  R.check(`pixels, risen (grain off): bottom third mean luma ${bot.toFixed(1)}, middle ${mid.toFixed(1)}, top ${top.toFixed(1)}: the ribbon is bottom-anchored (bottom > 4 x top, top < 8); before riseAt all three thirds are the flat field (${t0.toFixed(1)} / ${m0.toFixed(1)} / ${b0.toFixed(1)})`,
    bot > 4 * top && top < 8 && bot > 15 && Math.abs(t0 - b0) < 0.01 && t0 < 4);
  { const order = [0.5, 3.1, 1.2, 7.7, 2.2, 5.0], ref = []; await h.page.evaluate((l) => window.stack(l, 1, 960, 540, '#000'), [{ kind: KIND, params: { riseAt: 0.5 } }]);
    for (const t of order) { await h.page.evaluate((t) => window.again(t), t); ref.push(await h.page.evaluate(() => window.pixels())); } let ok = true;
    for (const i of shuffle(order.map((_, i) => i), rng(5))) { await h.page.evaluate((t) => window.again(t), order[i]); if ((await h.page.evaluate(() => window.pixels())) !== ref[i]) ok = false; }
    R.check('auroraRibbon: pixels identical when the same 6 times are rendered again in shuffled order', ok); }
  { await h.page.evaluate((l) => window.stack(l, 1, 960, 540, '#000'), [{ kind: KIND, params: { loop: 6 } }]); let ok = true; for (const t of [0, 0.4, 1.3, 2.9, 4.1]) { await h.page.evaluate((t) => window.again(t), t); const a = await h.page.evaluate(() => window.pixels()); await h.page.evaluate((t) => window.again(t), t + 6); if (a !== (await h.page.evaluate(() => window.pixels()))) ok = false; }
    R.check('auroraRibbon loop 6: real pixels at t and t + 6 s are identical (5 times)', ok); }
  await h.page.evaluate((l) => window.stack(l, 1, 1920, 1080, '#000'), [{ kind: KIND, params: { riseAt: 0.5 } }]); await h.page.evaluate(() => window.timeIt(2, 4));
  const ms = await h.page.evaluate(() => window.timeIt(2, 24)); R.check(`auroraRibbon at 1080p (3 strands, 96 columns, grain; includes the 1 px read-back): ${ms.toFixed(1)} ms per frame (budget 400 ms)`, ms < 400);
  const errs = h.errors.filter((e) => !/favicon|404|willReadFrequently/.test(e)); R.check('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3))); await h.close();
  const out = path.join(ROOT, 'layers/demo/out/r6-sheet.png');
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[2]); cols = 3; tw = 640; th = 360; rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), (30, 30, 30))
for i, (n, f) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS); x, y = (i % cols) * tw, (i // cols) * th; S.paste(im, (x, y)); d = ImageDraw.Draw(S); d.rectangle((x, y, x + 330, y + 18), fill=(0, 0, 0)); d.text((x + 5, y + 3), n, fill=(255, 255, 255))
S.save(sys.argv[1]); print('sheet', sys.argv[1], S.size)`;
  console.log(execFileSync('python3', ['-I', '-c', py, out, JSON.stringify(tiles)]).toString().trim());
  const res = R.done(); fs.writeFileSync(path.join(here, 'last-run-r6.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
} else { R.done(); process.exit(R.failed ? 1 : 0); }
