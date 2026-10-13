/* camera 3D tests in a real browser with real three.js (local build served read-only): the kit rig math in applyToThree + determinism of rendered frames.
   run: node camera/tests/camera3d.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { open, reporter } from '../../layers/tests/harness.mjs';
const R = reporter('camera3d'), here = path.dirname(fileURLToPath(import.meta.url));
const h = await open('/camera/demo/three.html', 'w=640&h=360'), pg = h.page;
R.check('three.js page ready on a hardware GPU', !/SwiftShader|llvmpipe/i.test(h.gpu), h.gpu);
const r = await pg.evaluate(async () => {
  const C = await import('/camera/cam3d.js'), o = {};
  const S = { ...C.KIT.wide, fov: 24, dist: 11, target: [0.3, -0.9, 0.2], screen: [1200, 400], roll: 0, shake: [0, 0] };
  /* 1. the look-at point lands exactly on `screen` (1080p px -> output px) for any az/elev/dist/fov */
  o.lookat = [{ az: -12, elev: 25 }, { az: 40, elev: 10 }, { az: -70, elev: 55 }, { az: 5, elev: 25, fov: 40, dist: 7 }].map((d) => { const s = { ...S, ...d }, p = window.projectState(s, s.target); return Math.hypot(p[0] - s.screen[0] / 3, p[1] - s.screen[1] / 3); });
  /* 2. roll rotates the image about the screen point by exactly `roll` degrees (angle of a world offset around the look-at screen point) */
  const ang = (s, w) => { const c = window.projectState(s, s.target), p = window.projectState(s, w); return Math.atan2(p[1] - c[1], p[0] - c[0]) * 180 / Math.PI; };
  const w = [S.target[0] + 0.6, S.target[1], S.target[2] + 0.1]; o.rollDeltas = [4, 10, -7].map((d) => { let a = ang({ ...S, roll: d }, w) - ang(S, w); a = ((a + 540) % 360) - 180; return a - d; });
  /* 3. dolly zoom: hero (1 unit wide, on the look-at plane) keeps its projected width */
  const dz = C.dollyZoom({ ...S, fov: 20, dist: 12, target: [0, -0.71, 0], screen: [960, 540] }, { at: 0, dur: 2, fovTo: 55 }); const ws = []; for (let i = 0; i <= 20; i++) { const s = dz(i / 10), a = window.projectState(s, [-0.5, -0.71, 0]), b = window.projectState(s, [0.5, -0.71, 0]); ws.push(Math.hypot(b[0] - a[0], b[1] - a[1])); }
  o.dollyW = [Math.min(...ws), Math.max(...ws)]; o.dollyNear = dz(2).near;
  /* 4. shake px moves the image by exactly shake px (1080p -> output scale) */
  const p0 = window.projectState(S, S.target), p1 = window.projectState({ ...S, shake: [30, -12] }, S.target); o.shake = [p1[0] - p0[0], p1[1] - p0[1]];
  /* 5. rendered frame determinism incl. 8-subframe blur accumulation */
  o.h1 = window.hashAt('pushIn', 0.9); window.hashAt('orbit', 1.3); o.h2 = window.hashAt('pushIn', 0.9); o.b1 = window.hashAt('whipOut', 0.6, 0.5 / 30); o.b2 = window.hashAt('whipOut', 0.6, 0.5 / 30); o.sharp = window.hashAt('whipOut', 0.6, 0); return o; });
R.check(`look-at point lands on the screen px for 4 camera setups (max err ${Math.max(...r.lookat).toFixed(3)} px)`, Math.max(...r.lookat) < 0.5);
R.check(`positive roll rotates the picture clockwise (like CSS rotate) by exactly roll degrees about the look-at screen point (err ${r.rollDeltas.map((v) => v.toFixed(3)).join(' ')} deg)`, r.rollDeltas.every((v) => Math.abs(v) < 0.3));
R.check(`dolly zoom in real three: subject width ${r.dollyW[0].toFixed(2)}..${r.dollyW[1].toFixed(2)} px (spread ${(100 * (r.dollyW[1] / r.dollyW[0] - 1)).toFixed(2)}%), near plane pulled in to ${r.dollyNear.toFixed(2)}`, r.dollyW[1] / r.dollyW[0] - 1 < 0.01 && r.dollyNear < 4.1 * 0.5 + 0.5);
R.check(`shake px shifts the image by exactly that many output px (${r.shake.map((v) => v.toFixed(2))}: expect 10.00,-4.00)`, Math.abs(r.shake[0] - 10) < 0.05 && Math.abs(r.shake[1] + 4) < 0.05);
R.check('rendered frame identical after another frame in between; blurred whip identical; blur actually differs from the sharp frame', r.h1 === r.h2 && r.b1 === r.b2 && r.b1 !== r.sharp, JSON.stringify([r.h1, r.b1, r.sharp]));
R.check('no console errors', h.errors.filter((e) => !/favicon|404/.test(e)).length === 0, JSON.stringify(h.errors.slice(0, 2)));
await h.close(); const res = R.done(); fs.writeFileSync(path.join(here, 'last-run3d.json'), JSON.stringify(res, null, 1)); process.exit(R.failed ? 1 : 0);
