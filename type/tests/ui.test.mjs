/* UI kit + closed-form springs tests (node only, no browser, no GPU: CI runs this).
   run: node type/tests/ui.test.mjs
   1. springTrack: same value in any evaluation order (seek-safe), settles to the last target, continuous through every retarget, overshoot per motion class.
   2. ui.* gfx: render non-empty at a hero time, empty before `at`, identical strings in shuffled seek order, finite numbers for t in [-1, 12],
      `scale` grows the item, uiCues resolve to real sfx ids, nodeGraphCam is pure, isoTiltCss returns flat after backAt, stateMorph loops (last frame = first frame). */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { springTrack, spring, springSettle, SPRING } from '../ease.js';
import { GFX, renderSVG, uiCues, nodeGraphCam, isoTiltCss } from '../gfx/index.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const rng = (() => { let a = 7; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- 1. springs ---------- */
const CH = [{ t: 0, v: 0 }, { t: 0.4, v: 100 }, { t: 0.55, v: 40 }, { t: 1.3, v: 250 }, { t: 2.0, v: -30 }];
const ts = Array.from({ length: 400 }, (_, i) => -0.5 + i * 0.0137);
for (const cls of Object.keys(SPRING)) {
  const fwd = ts.map((t) => springTrack(t, CH, cls)), back = new Map(shuffle(ts.map((t, i) => i)).map((i) => [i, springTrack(ts[i], CH, cls)]));
  check(`springTrack '${cls}': identical value in forward and shuffled order (${ts.length} seeks)`, fwd.every((v, i) => Object.is(v, back.get(i))));
  const st = springSettle(cls, 1e-3), last = CH.at(-1); let settled = true; for (let t = last.t + st; t < last.t + st + 3; t += 0.01) if (Math.abs(springTrack(t, CH, cls) - last.v) > 1e-3 * 280) settled = false;
  check(`springTrack '${cls}': settles to the last target within ${st.toFixed(3)} s (0.1% of the span) and stays there`, settled);
  let cont = true; for (const c of CH.slice(1)) if (Math.abs(springTrack(c.t + 1e-7, CH, cls) - springTrack(c.t - 1e-7, CH, cls)) > 1e-3) cont = false;
  check(`springTrack '${cls}': continuous through every retarget (no jump at t_i)`, cont);
}
const over = (cls) => { let m = 0; for (let i = 0; i < 6000; i++) m = Math.max(m, spring(i / 1000, cls)); return m - 1; };
const ov = Object.fromEntries(Object.keys(SPRING).map((k) => [k, over(k)]));
check(`overshoot per class: ui ${(ov.ui * 100).toFixed(2)}% (< 2), panel ${(ov.panel * 100).toFixed(2)}% (< 0.5), camera ${(ov.camera * 100).toFixed(3)}% (none), headline ${(ov.headline * 100).toFixed(1)}% (5-15), mascot ${(ov.mascot * 100).toFixed(1)}% (20-40)`,
  ov.ui > 0 && ov.ui < 0.02 && ov.panel < 0.005 && ov.camera <= 1e-12 && ov.headline > 0.05 && ov.headline < 0.15 && ov.mascot > 0.2 && ov.mascot < 0.4);
let mono = true; for (let i = 1; i < 3000; i++) if (spring(i / 1000, 'camera') < spring((i - 1) / 1000, 'camera') - 1e-15) mono = false;
check('camera class never moves backwards on a step (critically damped glide)', mono);
check('spring is 0 before release, 0 at release, and 1 long after; custom {zeta, f} works', spring(-1) === 0 && spring(0) === 0 && Math.abs(spring(10, 'mascot') - 1) < 1e-9 && Math.abs(spring(5, { zeta: 0.5, f: 2 }) - 1) < 1e-6);
const av = springTrack(0.7, [[0, [0, 10]], [0.2, [100, -10]], [0.5, [50, 0]]], 'ui'), a0 = springTrack(0.7, [[0, 0], [0.2, 100], [0.5, 50]], 'ui'), a1 = springTrack(0.7, [[0, 10], [0.2, -10], [0.5, 0]], 'ui');
check('springTrack works element-wise on arrays ([x, y] positions, RGB)', Math.abs(av[0] - a0) < 1e-12 && Math.abs(av[1] - a1) < 1e-12);

/* ---------- 2. UI kit ---------- */
const UIIDS = Object.keys(GFX).filter((k) => k.startsWith('ui.'));
const HERO = { 'ui.agentActivity': 1.75, 'ui.promptBar': 1.95, 'ui.checklist': 1.75, 'ui.nodeGraph': 2.9, 'ui.scanOverlay': 1.1, 'ui.isometricTilt': 1.4, 'ui.stateMorph': 6.1 };
check(`7 ui ids registered in GFX (${UIIDS.join(', ')})`, UIIDS.length === 7 && Object.keys(HERO).every((k) => UIIDS.includes(k)));
const sfx = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
for (const id of UIIDS) {
  const times = Array.from({ length: 60 }, (_, i) => -1 + i * 0.22), a = times.map((t) => renderSVG(id, t, { at: 0 })), order = shuffle(times.map((_, i) => i)), b = []; for (const i of order) b[i] = renderSVG(id, times[i], { at: 0 });
  const bad = a.find((s) => /NaN|undefined|Infinity|\[object/.test(s));
  check(`${id}: non-empty at hero ${HERO[id]} s, empty before at, same SVG in shuffled seek order, no NaN/undefined over [-1, 12] s`, renderSVG(id, HERO[id], { at: 0 }).length > 500 && renderSVG(id, -0.3, { at: 0 }) === '' && a.every((s, i) => s === b[i]) && !bad, bad ? bad.slice(0, 120) : '');
  const big = renderSVG(id, HERO[id], { at: 0, params: { scale: 1.5 } }), sz = (s) => Math.max(...[...s.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1]), 0);
  check(`${id}: scale 1.5 grows the type (${sz(renderSVG(id, HERO[id], { at: 0 }))} -> ${sz(big)} px)`, sz(big) > sz(renderSVG(id, HERO[id], { at: 0 })) * 1.4 || id === 'ui.isometricTilt' && big !== renderSVG(id, HERO[id], { at: 0 }));
  const cues = uiCues(id, { at: 2 }), miss = cues.filter((c) => !sfx.has('snd.' + c.id.split('/').slice(1).join('.')));
  check(`${id}: uiCues gives ${cues.length} cues, all sfx ids resolve, all after the item's at`, cues.length > 0 && !miss.length && cues.every((c) => c.t >= 2 - 1e-9 && c.why), miss.map((c) => c.id).join(' '));
}
const cam = nodeGraphCam(), c1 = [0, 1, 2, 3, 4].map((t) => JSON.stringify(cam(t))), c2 = [4, 2, 0, 3, 1].map((t) => [t, JSON.stringify(cam(t))]); let camOk = c2.every(([t, s]) => s === c1[t]), maxStep = 0;
for (let f = 1; f < 150; f++) maxStep = Math.max(maxStep, Math.abs(cam(f / 30).y - cam((f - 1) / 30).y) * 1080);
check(`nodeGraphCam: pure, cam2d-shaped, glides (max ${maxStep.toFixed(1)} px per frame, no jumps) and pans down the graph (y ${cam(0).y.toFixed(3)} -> ${cam(5).y.toFixed(3)} H)`, camOk && 'blurAngle' in cam(1) && maxStep < 25 && cam(5).y < cam(0).y - 0.05);
const iso = (t) => isoTiltCss(t, { tiltAt: 0.3, backAt: 1.5 });
check(`isoTiltCss: flat before tiltAt (k ${iso(0.2).k}), tilted between (k ${iso(1.2).k.toFixed(3)}), flat again after backAt + settle (k ${iso(2.6).k.toFixed(4)})`, iso(0.2).k === 0 && iso(1.2).k > 0.95 && iso(2.6).k < 0.01 && /rotateX/.test(iso(1).transform));
const lp = { loop: true, cursor: false }, first = renderSVG('ui.stateMorph', 0, { at: 0, dur: 20, params: lp }), lastS = renderSVG('ui.stateMorph', 10.5, { at: 0, dur: 20, params: lp });
check('ui.stateMorph loop: the frame after the last state settles equals frame 0 (last state = first state)', first.length > 0 && first === lastS, `${first.length} vs ${lastS.length}`);
const states = GFX['ui.stateMorph'].d.states; let distinct = new Set(); for (const s of states) distinct.add(renderSVG('ui.stateMorph', s.at + 0.5, { at: 0, dur: 20, params: lp }));
check(`ui.stateMorph: ${states.length} states give ${distinct.size} distinct frames (one container, many states)`, distinct.size >= states.length - 1);

console.log(`\nui: ${pass} passed, ${fail} failed`); fs.writeFileSync(path.join(here, 'last-run-ui.json'), JSON.stringify({ pass, fail }, null, 1) + '\n'); process.exit(fail ? 1 : 0);
