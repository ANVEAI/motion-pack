/* camera 2D DOM tests (real Chrome + local GSAP served read-only): bakeGSAP under random-access seeks, DOM matrix == pure function, driveSeek parity. run: node camera/tests/camera2d.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { open, reporter } from '../../layers/tests/harness.mjs';
const R = reporter('camera2d'), here = path.dirname(fileURLToPath(import.meta.url)); const h = await open('/camera/demo/dom2d.html'); const pg = h.page;
const r = await pg.evaluate(() => { const o = {}, close = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  for (const name of ['push2d', 'whip', 'handheld', 'punchCadence', 'shake', 'dutch']) { const dur = 2.5; window.bake(name, dur); const ts = Array.from({ length: 40 }, (_, i) => (i * 37 % 75) / 30); let mx = 0; for (const t of ts) { const got = window.seek(t), want = window.expect(Math.round(t * 30) / 30); mx = Math.max(mx, close(got, want)); } o[name] = mx; }
  /* pure-function path (no timeline): DOM matrix from toCSS vs expected */
  window.setCam('handheld'); let mx2 = 0; for (const t of [0.1, 0.77, 1.9, 0.77]) mx2 = Math.max(mx2, close(window.matrixAt(t), window.expect(t))); o.direct = mx2; return o; });
R.check('bakeGSAP: 40 random-access seeks on 6 cameras reproduce the pure function (max matrix deviation ' + Math.max(...['push2d', 'whip', 'handheld', 'punchCadence', 'shake', 'dutch'].map((k) => r[k])).toExponential(1) + ')', ['push2d', 'whip', 'handheld', 'punchCadence', 'shake', 'dutch'].every((k) => r[k] < 2e-3), JSON.stringify(r));
R.check('direct CSS path (toCSS) matches the same matrices (dev ' + r.direct.toExponential(1) + ')', r.direct < 2e-3);
R.check('no console errors', h.errors.filter((e) => !/favicon|404/.test(e)).length === 0, JSON.stringify(h.errors.slice(0, 2)));
await h.close(); const res = R.done(); fs.writeFileSync(path.join(here, 'last-run2d.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
