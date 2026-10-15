/* child process for fuzz-params.test.mjs (a process, not a worker thread: a V8 heap-limit abort kills the whole process, so only a child can be allowed to die of it): runs one batch of render jobs
   and reports each one (start, then done), so the parent can attribute a hang, an out-of-memory kill or a crash to the exact job.
   A job is { kind: 'gfx' | 'k2d' | 'bg', id, params, t, W, H }. Nothing here is a test: the verdicts are the parent's. */
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { recorder } from './recorder.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), imp = (p) => import(path.join(ROOT, p));
const order = new Promise((res) => process.once('message', res));   /* listen before the slow imports, then say ready: the parent sends the jobs only after 'ready' */
const [{ renderSVG }, { Canvas2DLayer }, { BackgroundLayer }] = await Promise.all([imp('type/gfx/index.js'), imp('layers/canvas2d.js'), imp('layers/backgrounds.js')]);
process.send({ ready: true });
/* every message waits until it is written: a synchronous loop never lets queued IPC writes drain, and process.exit() drops
   whatever is still queued (Linux's small socket buffer lost every result on GitHub; macOS's larger one hid it) */
const send = (m) => new Promise((res) => process.send(m, () => res()));
const { jobs, from = 0, budget } = await order;
for (let i = from; i < jobs.length; i++) {
  const j = jobs[i]; await send({ start: i }); const t0 = performance.now(); let r;
  try {
    if (j.kind === 'gfx') { const s = renderSVG(j.id, j.t, { at: 0, params: j.params }, { W: j.W, H: j.H }); r = { len: s.length, nan: /NaN|Infinity/.test(s) }; }
    else { const rec = recorder(budget), Layer = j.kind === 'k2d' ? Canvas2DLayer : BackgroundLayer; new Layer(rec.canvas(), j.id, j.params, { width: j.W, height: j.H, fps: 30 }).render(j.t); r = { calls: rec.calls(), nan: rec.log.some((x) => /NaN|Infinity/.test(x)) }; }
  } catch (e) { r = { err: String(e && e.message || e).slice(0, 160), type: e && e.constructor && e.constructor.name }; }
  await send({ done: i, ms: performance.now() - t0, ...r });
}
await send({ finished: true });
process.exit(0);
