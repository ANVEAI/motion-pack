/* cross-process determinism gate (node, no browser, no GPU). run: node tools/tests/xproc-hash.test.mjs [--child forward|scrambled]
   The in-process "identical in shuffled seek order" checks cannot see nondeterminism that a module-level cache hides: a plan built ONCE with a random number (or from a call counter) gives
   the same answer to every seek in that process, so forward and shuffled order agree, yet a second render worker (another Chrome page, another process) builds a different plan and its
   frames disagree. Mutation N3 (Math.random inside the cached hexMosaic plan) passed every node suite this way.
   This gate renders the same set in TWO fresh node processes with different call histories and compares a SHA-256 per (part, t):
     forward    each part once, in registry order;
     scrambled  first a warm-up that renders every part at other times and with other params (so caches fill in a different order), then the whole set 8 times in reverse (so every
                call counter ends at about 9x where the forward process ends), then the set itself in a seeded shuffled order.
   Proof (2026-10-15): N3 (Math.random inside the cached hexMosaic plan) passes layers/tests/r45.test.mjs 59/59 and fails here; a call-counter mutant (keysAt returns 0.5 after its
   100th call) fails here too. A counter is caught only when its threshold falls inside what the two processes call (here up to about 9x the set's own calls), so this is a net
   for cache- and history-hidden state, not a proof that none exists.
   The set: every registered gfx id (type/gfx, SVG strings) at 4 times; every Canvas2D layer kind (K2D) and background (BG) on a recording 2D context at 3 times, 16:9 and 9:16;
   every 3D and 2D camera preset (PRESETS_3D / PRESETS_2D) at 6 times; every kinetic type preset (unitStates) and caption style (captionFrame) at 5 times.
   GL-only overlay kinds (layers/overlay.js KINDS), three.js objects, transitions' DOM / GL back-ends and Blender need a browser or a GPU and are not covered here (see docs/testing.md). */
import { spawn } from 'node:child_process'; import crypto from 'node:crypto'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), imp = (p) => import(path.join(ROOT, p)), mode = process.argv.includes('--child') ? process.argv[process.argv.indexOf('--child') + 1] : null;

async function child(order) {
  const [{ GFX, GFX_IDS, renderSVG }, { K2D, Canvas2DLayer }, { BG, BackgroundLayer }, C3, C2, { PRESETS, PRESET_IDS, unitStates }, { CAPTION_STYLES, captionFrame, chunkWords }, { recorder }] = await Promise.all([
    imp('type/gfx/index.js'), imp('layers/canvas2d.js'), imp('layers/backgrounds.js'), imp('camera/cam3d.js'), imp('camera/cam2d.js'), imp('type/presets.js'), imp('type/captions.js'), imp('tools/tests/recorder.mjs')]);
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16), jobs = [];
  const layer = (Layer, kind, params, t, W, H) => { const rec = recorder(2e6); new Layer(rec.canvas(), kind, params, { width: W, height: H, fps: 30 }).render(t, { frame: Math.round(t * 30) }); return rec.log.join('\n'); };
  const camOpts = { at: 0.5, dur: 2, hits: [1, 2.5], boundaries: [1.2, 3.1], returnAt: 2 }, num = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(9) : typeof v === 'function' ? undefined : v));
  const words = [['Voice', 0.2, 0.5], ['that', 0.5, 0.8], ['sells', 0.8, 1.3], ['every', 1.5, 1.8], ['single', 1.8, 2.2], ['day', 2.2, 2.6]].map(([w, s, e]) => ({ w, s, e })), chunks = chunkWords(words);
  /* job = [key, () => string]; `p` lets the warm-up use other params through the same code path */
  const add = (key, f) => jobs.push([key, f]);
  const gfx = (id, t, p = {}) => renderSVG(id, t, { at: 0, params: p });
  const k2d = (k, t, W, H, p = {}) => layer(Canvas2DLayer, k, p, t, W, H), bg = (k, t, W, H, p = {}) => layer(BackgroundLayer, k, p, t, W, H);
  const cam = (P, base, k, t, o = camOpts) => num(P[k](base, o)(t));
  const typ = (id, t, text = 'Voice that sells') => { const def = PRESETS[id], texts = def.unit === 'char' ? [...text.replace(/\s/g, '')] : def.unit === 'line' ? [text] : text.split(' '); return num(unitStates({ preset: id, text, at: 0.2, out: 2.4 }, texts, t)); };
  const cap = (name, t) => num(captionFrame(chunks, t, CAPTION_STYLES[name]));
  for (const id of GFX_IDS) for (const t of [0.35, 1.2, 2.4, 3.6]) add(`gfx ${id} @${t}`, () => gfx(id, t));
  for (const k of Object.keys(K2D)) for (const t of [0.4, 1.4, 3.0]) for (const [W, H] of [[480, 270], [270, 480]]) add(`k2d ${k} @${t} ${W}x${H}`, () => k2d(k, t, W, H));
  for (const k of Object.keys(BG)) for (const t of [0.4, 1.4, 3.0]) for (const [W, H] of [[480, 270], [270, 480]]) add(`bg ${k} @${t} ${W}x${H}`, () => bg(k, t, W, H));
  for (const k of Object.keys(C3.PRESETS_3D)) for (const t of [0, 0.6, 1.1, 2.0, 3.3, 7.5]) add(`cam3d ${k} @${t}`, () => cam(C3.PRESETS_3D, C3.KIT.wide, k, t));
  for (const k of Object.keys(C2.PRESETS_2D)) for (const t of [0, 0.6, 1.1, 2.0, 3.3, 7.5]) add(`cam2d ${k} @${t}`, () => cam(C2.PRESETS_2D, C2.ID2, k, t));
  for (const id of PRESET_IDS) for (const t of [0.1, 0.4, 0.9, 2.0, 2.7]) add(`type ${id} @${t}`, () => typ(id, t));
  for (const name of Object.keys(CAPTION_STYLES)) for (const t of [0.1, 0.6, 1.0, 1.9, 2.5]) add(`caption ${name} @${t}`, () => cap(name, t));
  if (order === 'scrambled') {
    /* warm-up: other times, other params, other sizes, through the same code paths (fills every cache in a different order and moves every call counter) */
    for (const id of [...GFX_IDS].reverse()) for (const t of [5.1, 0.05, 1.77]) { gfx(id, t); gfx(id, t, { seed: 7, scale: 1.3 }); }
    for (const k of Object.keys(K2D).reverse()) for (const t of [2.2, 0.1]) { k2d(k, t, 320, 320); k2d(k, t, 480, 270, { seed: 5 }); }
    for (const k of Object.keys(BG).reverse()) { bg(k, 2.2, 320, 320); bg(k, 0.1, 480, 270, { seed: 5 }); }
    for (const k of Object.keys(C3.PRESETS_3D)) { cam(C3.PRESETS_3D, C3.KIT.wide, k, 4.4); cam(C3.PRESETS_3D, C3.KIT.wide, k, 1.5, { ...camOpts, at: 1.1, seed: 9 }); }
    for (const k of Object.keys(C2.PRESETS_2D)) { cam(C2.PRESETS_2D, C2.ID2, k, 4.4); cam(C2.PRESETS_2D, C2.ID2, k, 1.5, { ...camOpts, at: 1.1, seed: 9 }); }
    for (const id of PRESET_IDS) { typ(id, 1.3, 'Another line of words'); typ(id, 0.3); }
    for (const name of Object.keys(CAPTION_STYLES)) cap(name, 1.4);
    /* and the whole set 8 more times, in reverse: a part that changes once a call counter passes N differs between the two processes for any N up to 9x the set's own call count */
    for (let r = 0; r < 8; r++) for (const [, f] of [...jobs].reverse()) { try { f(); } catch {} }
    let a = 977; const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
  }
  const out = {}; for (const [key, f] of jobs) { try { const s = String(f()); out[key] = sha(s) + (s ? '' : ':empty'); } catch (e) { out[key] = 'THREW ' + String(e && e.message).slice(0, 80); } }
  process.stdout.write(JSON.stringify(out));
}

if (mode) await child(mode);
else {
  const { reporter } = await imp('layers/tests/harness.mjs'), R = reporter('cross-process hashes');
  const run = (order) => new Promise((res, rej) => { const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child', order], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }); let s = '';
    p.stdout.on('data', (d) => (s += d)); p.on('error', rej); p.on('exit', (code) => (code === 0 ? res(JSON.parse(s)) : rej(new Error(`${order} child exited ${code}`)))); });
  const t0 = performance.now(), [A, B] = await Promise.all([run('forward'), run('scrambled')]), keys = Object.keys(A), groups = {};
  for (const k of keys) { const g = k.split(' ')[0]; groups[g] ||= { n: 0, parts: new Set(), bad: [] }; groups[g].n++; groups[g].parts.add(k.split(' ')[1]); if (A[k] !== B[k]) groups[g].bad.push(k); }
  const missing = keys.filter((k) => !(k in B)).concat(Object.keys(B).filter((k) => !(k in A))), threw = keys.filter((k) => /^THREW/.test(A[k]));
  for (const [g, s] of Object.entries(groups)) R.check(`${g}: ${s.parts.size} parts, ${s.n} (part, t) renders hash the same in a fresh forward process and in a fresh process with a scrambled call history`, s.bad.length === 0, s.bad.length ? `${s.bad.length} differ, first: ${s.bad.slice(0, 4).join(' | ')}` : '');
  const empty = keys.filter((k) => A[k].endsWith(':empty')).length;
  R.check(`the set is complete and not vacuous: ${keys.length} renders in ${((performance.now() - t0) / 1000).toFixed(1)} s, both processes rendered the same keys, ${empty} empty frames (off-screen times), none threw`,
    missing.length === 0 && threw.length === 0 && keys.length > 900 && empty < keys.length / 3 && Object.keys(groups).length === 7, missing.slice(0, 3).join(' '));
  process.exit(R.done() && R.failed ? 1 : 0);
}
