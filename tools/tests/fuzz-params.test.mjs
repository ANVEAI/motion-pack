/* fuzz: no registered part can hang or exhaust memory on a degenerate numeric parameter (node, no browser, no GPU). run: node tools/tests/fuzz-params.test.mjs [--only id,id] [--limit-ms N] [--quick]
   Every type/gfx id (120) and every Canvas2D layer kind (K2D, 25) and background (BG, 3) is rendered with each of its numeric default parameters, one at a time, set to 0, -1, NaN, Infinity,
   1e9 and 1e-6, and with all of them set at once, at three times. A render must come back inside LIMIT_MS (a hang or a runaway string/array is cut off by a worker watchdog and a memory
   limit, so one bad part cannot take the test down), within a size cap (SVG characters; recorded canvas calls), and must not die of a RangeError (Invalid string length / array length / stack) or any other error.
   A part must also not throw (a refused value is clamped by type/gfx/limits.js / layers/limits.js, never an exception); NaN or Infinity in the drawn output is counted and printed but not asserted. GL-only kinds (layers/overlay.js
   KINDS, fx2.js) need a WebGL context and are covered by the browser suites, not here. */
import os from 'node:os'; import path from 'node:path'; import { fork } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { reporter } from '../../layers/tests/harness.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT_MS = +arg('--limit-ms', 4000), SVG_CAP = 6e6, CALL_CAP = 400000, MEM_MB = 640, VALUES = [0, -1, NaN, Infinity, 1e9, 1e-6], TIMES = [0.05, 0.15, 0.5, 1.4, 3.0, 9.0], ONLY = arg('--only', '') ? arg('--only').split(',') : null, QUICK = process.argv.includes('--quick');
const R = reporter('fuzz params');
const [{ GFX, GFX_IDS }, { K2D }, { BG }, { GFX_LIM }] = await Promise.all([import(path.join(ROOT, 'type/gfx/index.js')), import(path.join(ROOT, 'layers/canvas2d.js')), import(path.join(ROOT, 'layers/backgrounds.js')), import(path.join(ROOT, 'type/gfx/limits.js'))]);
/* every numeric leaf of the defaults (numbers, inside arrays and plain objects; capped so a long table cannot blow up the matrix) */
function leaves(v, p = [], out = []) { if (out.length > 40) return out; if (typeof v === 'number') out.push(p); else if (Array.isArray(v)) v.slice(0, 6).forEach((x, i) => leaves(x, [...p, i], out)); else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) for (const k of Object.keys(v).slice(0, 24)) leaves(v[k], [...p, k], out); return out; }
const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const setAt = (root, p, val) => { let o = root; for (const k of p.slice(0, -1)) o = o[k]; o[p.at(-1)] = val; };
function variants(d) { const out = [], L = leaves(d), tops = [...new Set(L.map((p) => p[0]))];
  for (const p of L) for (const val of VALUES) { const o = { [p[0]]: clone(d[p[0]]) }; if (p.length === 1) o[p[0]] = val; else setAt(o, p, val); out.push({ params: o, why: `${p.join('.')}=${val}` }); }
  for (const val of VALUES) { const o = {}; for (const p of L) { o[p[0]] ??= clone(d[p[0]]); if (p.length === 1) o[p[0]] = val; else setAt(o, p, val); } out.push({ params: o, why: `all numeric=${val}`, W: 1080, H: 1920 }); }
  return out; }
const jobs = []; const add = (kind, id, d) => { if (ONLY && !ONLY.includes(id)) return; for (const v of variants(d || {})) for (const t of (QUICK ? [1.4] : TIMES)) jobs.push({ kind, id, params: v.params, why: v.why, t, W: v.W || (kind === 'gfx' ? 1920 : 960), H: v.H || (kind === 'gfx' ? 1080 : 540) }); };
for (const id of GFX_IDS) add('gfx', id, GFX[id].d); for (const k of Object.keys(K2D)) add('k2d', k, K2D[k].d); for (const k of Object.keys(BG)) add('bg', k, BG[k].d);
/* run: one worker per slice of ids; a hang, an out-of-memory kill or a crash is attributed to the job the worker had started, then a fresh worker resumes after it */
const ids = [...new Set(jobs.map((j) => j.kind + ':' + j.id))], P = Math.max(1, Math.min(4, os.availableParallelism() - 1)), slices = Array.from({ length: P }, () => []);
ids.forEach((k, i) => slices[i % P].push(k)); const results = new Array(jobs.length), retried = new Set();
async function runSlice(keys) {
  const mine = jobs.map((j, i) => [j, i]).filter(([j]) => keys.includes(j.kind + ':' + j.id)), sub = mine.map(([j]) => j); let from = 0;
  while (from < sub.length) {
    await new Promise((resolve) => {
      const w = fork(path.join(here, 'fuzz-worker.mjs'), [], { execArgv: [`--max-old-space-size=${MEM_MB}`], serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); let cur = -1, started = 0, settled = false;
      const end = (res, finished) => { if (settled) return; settled = true; clearInterval(tm); if (cur >= 0 && res) results[mine[cur][1]] = res; try { w.kill('SIGKILL'); } catch {} from = finished ? sub.length : cur >= 0 && res ? cur + 1 : sub.length; resolve(); };
      const tm = setInterval(() => { if (cur >= 0 && performance.now() - started > LIMIT_MS) { if (!retried.has(mine[cur][1])) { retried.add(mine[cur][1]); const k = cur; settled = true; clearInterval(tm); try { w.kill('SIGKILL'); } catch {} from = k; resolve(); } else end({ hang: true, ms: LIMIT_MS }); } }, 50);   /* a real hang repeats in a fresh process; a stall on a busy machine does not */
      w.on('message', (m) => { if (m.start != null) { cur = m.start; started = performance.now(); } else if (m.done != null) { results[mine[m.done][1]] = m; cur = -1; } else if (m.finished) end(null, true); });
      w.on('error', (e) => end({ crash: String(e && e.message).slice(0, 120) }));
      w.on('exit', (code, sig) => setTimeout(() => end(cur >= 0 ? { oom: code === 134 || sig === 'SIGABRT', crash: `child exited ${sig || code}` } : null), 250));   /* 'exit' can overtake the child's last IPC messages */
      w.send({ jobs: sub, from, budget: CALL_CAP });
    });
  }
}
const t0 = performance.now(); await Promise.all(slices.map(runSlice));
/* verdicts per part */
const by = new Map(); jobs.forEach((j, i) => { const r = results[i] || { crash: 'no result' }, key = j.kind + ':' + j.id; if (!by.has(key)) by.set(key, { n: 0, bad: [], threw: 0, ms: 0, big: 0, nan: 0 }); const s = by.get(key); s.n++; s.ms = Math.max(s.ms, r.ms || 0);
  const why = `${j.why} @t=${j.t}`;
  if (r.hang) s.bad.push(`HANG >${LIMIT_MS} ms (${why})`); else if (r.oom || r.crash) s.bad.push(`${r.oom ? 'OUT OF MEMORY' : 'CRASH ' + r.crash} (${why})`);
  else if (r.err) { if (/budget|Invalid (string|array|typed array) length|call stack|allocation/i.test(r.err)) s.bad.push(`RUNAWAY ${r.type}: ${r.err} (${why})`); else { s.threw++; s.bad.push(`THREW ${r.type}: ${r.err} (${why})`); } }
  else if ((r.len || 0) > SVG_CAP) s.bad.push(`SVG ${(r.len / 1e6).toFixed(1)} M chars > cap (${why})`); else if ((r.calls || 0) > CALL_CAP) s.bad.push(`${r.calls} canvas calls > cap (${why})`);
  if (r.nan) s.nan++; });
let bad = 0, threw = 0, runs = 0, nans = 0; const parts = [...by.entries()];
if (arg('--dump', '')) (await import('node:fs')).writeFileSync(arg('--dump'), JSON.stringify(Object.fromEntries(parts.map(([k, s]) => [k, s.bad])), null, 1));
for (const [key, s] of parts) { runs += s.n; threw += s.threw; nans += s.nan; if (s.bad.length) { bad++; R.check(`${key}: survives ${s.n} degenerate renders (0, -1, NaN, Infinity, 1e9, 1e-6 on every numeric default)`, false, `${s.bad.length} bad, first: ${s.bad[0]}`); } }
R.check(`every part survives degenerate numeric params: ${parts.length} parts (${GFX_IDS.length} gfx ids, ${Object.keys(K2D).length} Canvas2D layer kinds, ${Object.keys(BG).length} backgrounds), ${runs} renders in ${((performance.now() - t0) / 1000).toFixed(0)} s, none hung (> ${LIMIT_MS} ms), ran out of memory (> ${MEM_MB} MB), built more than ${SVG_CAP / 1e6} M SVG characters / ${CALL_CAP / 1000}k canvas calls or threw; ${nans} renders drew a NaN or Infinity coordinate (not asserted)`, bad === 0 && (ONLY || parts.length >= 140));
/* the three reported runaways by name, in-process (safe now that the fuzz found none to hang on): each returns at once, and a clamped value draws exactly what the limit itself draws */
if (!bad && !ONLY) {
  const { renderSVG } = await import(path.join(ROOT, 'type/gfx/index.js')), { hexState } = await import(path.join(ROOT, 'layers/canvas2d-r45.js')), tm = (f) => { const a = performance.now(), v = f(); return [v, performance.now() - a]; };
  const [h0, m0] = tm(() => hexState(0.5, { radius: 0 }, { W: 480, H: 270 })), [h1] = tm(() => hexState(0.5, { radius: K2D.hexMosaic.lim.radius[0] }, { W: 480, H: 270 })), [hn] = tm(() => hexState(0.5, { radius: NaN }, { W: 480, H: 270 })), [hd] = tm(() => hexState(0.5, {}, { W: 480, H: 270 }));
  R.check(`layers.hexMosaic radius 0 (rows = H / 0 = Infinity, never returned) draws the radius-${K2D.hexMosaic.lim.radius[0]} lattice in ${m0.toFixed(0)} ms (${h0.length} tiles); radius NaN draws the default lattice`, m0 < 1500 && h0.length === h1.length && hn.length === hd.length);
  const [c0, mc] = tm(() => renderSVG('callout.connectorLabel', 1.4, { params: { gridStep: 0 } })), [c1] = tm(() => renderSVG('callout.connectorLabel', 1.4, { params: { gridStep: GFX_LIM['callout.connectorLabel'].gridStep[0] } }));
  R.check(`callout.connectorLabel gridStep 0 (3 GB string, 'Invalid string length') draws the minimum-step grid in ${mc.toFixed(0)} ms`, mc < 1500 && c0 === c1 && c0.length > 500);
  const [f0, mf] = tm(() => renderSVG('ui.failoverRoute', 1.4, { params: { rate: 0 } })), [f1] = tm(() => renderSVG('ui.failoverRoute', 1.4, { params: { rate: GFX_LIM['ui.failoverRoute'].rate[0] } }));
  R.check(`ui.failoverRoute rate 0 (3 GB string) draws the minimum-rate frame in ${mf.toFixed(0)} ms`, mf < 1500 && f0 === f1 && f0.length > 500);
  R.check('a NaN count draws the default count; a count of 1e9 draws the maximum', renderSVG('fx.emotion.heartBurst', 0.6, { params: { count: NaN } }) === renderSVG('fx.emotion.heartBurst', 0.6, {}) && renderSVG('fx.emotion.heartBurst', 0.6, { params: { count: 1e9 } }) === renderSVG('fx.emotion.heartBurst', 0.6, { params: { count: GFX_LIM['fx.emotion.heartBurst'].count[1] } }));
  /* a NaN / Infinity in a TEXT param takes the default text (safe.js fix): it used to become the number 0, which a part printed as its "source" ("0") */
  const { saneParams } = await import(path.join(ROOT, 'type/gfx/safe.js'));
  const sp = saneParams({ source: NaN, label: Infinity, n: NaN, t: [NaN], o: { k: -Infinity }, free: NaN }, { source: 'illustrative data', label: 'Slot', n: 5, t: ['a'], o: { k: 'x' }, fmt: null });
  R.check('saneParams: a NaN / Infinity takes the default of its own type at the same path (a default text stays text, a number stays a number), 0 only when there is no default', sp.source === 'illustrative data' && sp.label === 'Slot' && sp.n === 5 && sp.t[0] === 'a' && sp.o.k === 'x' && sp.free === 0, JSON.stringify(sp));
  R.check('chart.hoverTooltip with source NaN draws the default (labelled) frame, not a source of "0"', renderSVG('chart.hoverTooltip', 3.4, { params: { source: NaN } }) === renderSVG('chart.hoverTooltip', 3.4, {}) && !/source: 0/.test(renderSVG('chart.hoverTooltip', 3.4, { params: { source: NaN } })));
}
process.exit(R.done() && R.failed ? 1 : 0);
