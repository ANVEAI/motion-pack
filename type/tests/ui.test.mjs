/* UI kit + closed-form springs tests (node only, no browser, no GPU: CI runs this).
   run: node type/tests/ui.test.mjs
   1. springTrack: same value in any evaluation order (seek-safe), settles to the last target, continuous through every retarget, overshoot per motion class.
   2. ui.* gfx: render non-empty at a hero time, empty before `at`, identical strings in shuffled seek order, finite numbers for t in [-1, 12],
      `scale` grows the item, uiCues resolve to real sfx ids, nodeGraphCam is pure, isoTiltCss returns flat after backAt, stateMorph loops (last frame = first frame).
   3. round 3 (ui-data.js, ui-nav.js): transcript streaming + latency badges, word replace, receipt totals, failover routing, file chip states, pageFlyCam, tab pill, window loops, picker lock. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { springTrack, spring, springSettle, SPRING } from '../ease.js';
import { GFX, renderSVG, uiCues, nodeGraphCam, isoTiltCss, pageFlyCam } from '../gfx/index.js';
import { transcriptLayout, regenTimes, packet, routeGeo, cardTotal } from '../gfx/ui-data.js'; import { tabGeo } from '../gfx/ui-nav.js';
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
/* the round 4+5 ui.* parts (ui-proof.js, ui-trace.js, ui.promptBar.attach) are covered by tests/r45ui.test.mjs; the round-6 ones (ui.dockLaunch, ui.connectRows) by tests/r6.test.mjs */
/* the lane-human ui.* parts (type/gfx/human.js: ui.keyCombo, ui.codeCallout, ui.stepCounter, ui.cursorTrack, ui.waveform, ui.quizCard) size from the frame, not a `scale` param, and cue
   through gfxCues; templates/_shared/human/human.test.mjs holds every human part to the same seek contract (empty before at, shuffled order, finite, cues resolve) */
const SAASUI = Object.keys(GFX).filter((k) => /ui-saas2?\.js$|type\/gfx\/(glass|review)\.js$/.test(GFX[k].file || ''));   // xp-saas parts: tested in type/tests/saas.test.mjs; xp-r78 parts (glass.js, review.js): type/tests/r78.test.mjs
const R45UI = ['ui.branchTrace', 'ui.dataTable', 'ui.costTicker', 'ui.promptBar.attach', 'ui.dockLaunch', 'ui.connectRows', ...SAASUI], UIIDS = Object.keys(GFX).filter((k) => k.startsWith('ui.') && !R45UI.includes(k) && GFX[k].file !== 'type/gfx/human.js');
const HERO = { 'ui.agentActivity': 1.75, 'ui.promptBar': 1.95, 'ui.checklist': 1.75, 'ui.nodeGraph': 2.9, 'ui.scanOverlay': 1.1, 'ui.isometricTilt': 1.4, 'ui.stateMorph': 6.1,
  'ui.liveTranscript': 4.9, 'ui.wordRegenerate': 3.1, 'ui.receiptCompare': 2.9, 'ui.failoverRoute': 2.75, 'ui.fileChip': 1.5, 'ui.pageFlythrough': 2.3, 'ui.tabPillNav': 2.1, 'ui.windowWall': 2.6, 'ui.optionPicker': 2.2 };
check(`16 ui ids registered in GFX (${UIIDS.join(', ')})`, UIIDS.length === 16 && Object.keys(HERO).every((k) => UIIDS.includes(k)));
const sfx = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
for (const id of UIIDS) {
  const times = Array.from({ length: 60 }, (_, i) => -1 + i * 0.22), a = times.map((t) => renderSVG(id, t, { at: 0 })), order = shuffle(times.map((_, i) => i)), b = []; for (const i of order) b[i] = renderSVG(id, times[i], { at: 0 });
  const bad = a.find((s) => /NaN|undefined|Infinity|\[object/.test(s));
  check(`${id}: non-empty at hero ${HERO[id]} s, empty before at, same SVG in shuffled seek order, no NaN/undefined over [-1, 12] s`, renderSVG(id, HERO[id], { at: 0 }).length > 500 && renderSVG(id, -0.3, { at: 0 }) === '' && a.every((s, i) => s === b[i]) && !bad, bad ? bad.slice(0, 120) : '');
  const big = renderSVG(id, HERO[id], { at: 0, params: { scale: 1.5 } });
  /* two parts carry no font-size of their own: ui.isometricTilt's placeholder panel has no text (its size unit shows in the title-bar dot radius, 8 * s) and ui.pageFlythrough scales the page
     through its camera transform (`rotate(..) scale(z)`, z = zoom * s); for them the check measures that unit instead, so it fails when `scale` stops reaching the drawing */
  const UNIT = { 'ui.isometricTilt': ['title-bar dot radius', /<circle [^>]*?r="([\d.]+)"/g], 'ui.pageFlythrough': ['page zoom', /rotate\([-\d.]+\) scale\(([\d.]+)\)/g] }, [what, re] = UNIT[id] || ['type', /font-size="([\d.]+)"/g];
  const sz = (s) => Math.max(...[...s.matchAll(re)].map((m) => +m[1]), 0), s0 = sz(renderSVG(id, HERO[id], { at: 0 })), s1 = sz(big);
  check(`${id}: scale 1.5 grows the ${what} (${s0} -> ${s1}${UNIT[id] ? '' : ' px'})`, s0 > 0 && s1 > s0 * 1.4 && s1 < s0 * 1.6);
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


/* ---------- 3. UI kit round 3 (ui-data.js, ui-nav.js) ---------- */
const R = (id, t, params = {}) => renderSVG(id, t, { at: 0, dur: 30, params }), D = (id) => GFX[id].d;
{ const d = D('ui.liveTranscript'), t2 = d.turns[1], lay = transcriptLayout(d, 1, 1920 * d.box[2] - 64);
  const words = (t) => (R('ui.liveTranscript', t).match(/<text /g) || []).length, w0 = words(t2.at + 0.05), w1 = words(t2.at + 0.6), w2 = words(lay[1].end + 0.2);
  check(`ui.liveTranscript: latency badge "${t2.latency.toFixed(2)} s" absent before its turn, present after; words stream in (${w0} -> ${w1} -> ${w2} text nodes); source label printed; last turn on screen at the end`,
    !R('ui.liveTranscript', t2.at - 0.05).includes(t2.latency.toFixed(2) + ' s') && R('ui.liveTranscript', t2.at + 0.3).includes(t2.latency.toFixed(2) + ' s') && w0 < w1 && w1 < w2 && R('ui.liveTranscript', 3).includes(d.source) && R('ui.liveTranscript', 6.1).includes('Done.')); }
{ const d = D('ui.wordRegenerate'), { typeEnd } = regenTimes(d), old = d.words.split(/\s+/)[d.target];
  check(`ui.wordRegenerate: "${old}" until replaceAt, "${d.replacement}" (accent) after the re-type at ${typeEnd.toFixed(2)} s, old word gone`, R('ui.wordRegenerate', d.replaceAt - 0.05).includes('>' + old + '<') && !R('ui.wordRegenerate', d.replaceAt - 0.05).includes(d.replacement) &&
    R('ui.wordRegenerate', typeEnd + 0.3).includes(`fill="${d.accent}" text-anchor="start" letter-spacing="0" >${d.replacement}<`) && !R('ui.wordRegenerate', typeEnd + 0.3).includes('>' + old + '<')); }
{ const d = D('ui.receiptCompare'), B = d.cards[1], want = B.lines.reduce((a, l) => a + l.amount, 0), end = R('ui.receiptCompare', 3.6);
  check(`ui.receiptCompare: fee total settles to the sum (${want.toFixed(2)}), flat card stays $240.00 at every t, error chip only after its at, source printed`, Math.abs(cardTotal(B, 9) - want) < 1e-6 && end.includes('$' + want.toFixed(2)) &&
    [0.5, 1.5, 2.5, 3.5].every((t) => R('ui.receiptCompare', t).includes('$240.00')) && !R('ui.receiptCompare', B.error.at - 0.05).includes(B.error.text) && end.includes(B.error.text) && end.includes(d.source)); }
{ const d = D('ui.failoverRoute'), G = routeGeo(d, { W: 1920, H: 1080, s: 1 }), at = (t) => Array.from({ length: 60 }, (_, k) => packet(k, t, d, G)).filter(Boolean);
  const dest = (q) => (q.x < G.hub[0] + G.hw + 60 ? -1 : G.prov.map((pv, i) => [Math.abs(q.y - pv[1]) + Math.abs(q.x - pv[0]) * 0.2, i]).sort((a, b) => a[0] - b[0])[0][1]), nx = (d.active + 1) % d.providers.length;
  const before = at(d.failAt - 0.05), mid = at((d.failAt + d.rerouteAt) / 2), after = at(d.rerouteAt + d.travel + 0.4), late = after.filter((q) => q.state === 'on' && q.x > G.hub[0] + 300);
  check(`ui.failoverRoute: before failAt packets head to provider ${d.active} (${before.filter((q) => dest(q) === d.active).length}), packets hold at the hub while it is down (${mid.filter((q) => q.state === 'hold').length}), after the re-route every live packet past the hub heads to provider ${nx} (${late.length})`,
    before.some((q) => dest(q) === d.active && q.state === 'on') && mid.some((q) => q.state === 'hold') && late.length > 0 && late.every((q) => dest(q) === nx) && R('ui.failoverRoute', 3).includes(d.note)); }
{ const d = D('ui.fileChip'), done = d.clickAt + d.dlDur;
  check('ui.fileChip: Download before the click, a progress readout while downloading, "Open" + "Downloaded" after', R('ui.fileChip', d.clickAt - 0.1).includes('>Download<') && /\d\.\d \/ 4\.8 MB/.test(R('ui.fileChip', d.clickAt + 0.5)) && R('ui.fileChip', done + 0.3).includes('>Open<') && R('ui.fileChip', done + 0.3).includes('Downloaded')); }
{ const d = D('ui.pageFlythrough'), ts2 = Array.from({ length: 120 }, (_, i) => i * 0.05), a = ts2.map((t) => JSON.stringify(pageFlyCam(t))), b = []; for (const i of shuffle(ts2.map((_, i) => i))) b[i] = JSON.stringify(pageFlyCam(ts2[i]));
  let mx = 0; for (let f = 1; f < 180; f++) mx = Math.max(mx, Math.abs(pageFlyCam(f / 30).focus - pageFlyCam((f - 1) / 30).focus)); const end = pageFlyCam(d.pullAt + 4);
  check(`pageFlyCam: pure in shuffled order, focus glides (max ${(mx * 100).toFixed(2)}% of the page per frame), pulls out to fit (zoom ${end.zoom.toFixed(3)} -> ${d.fit}) with the blur gone (${end.blur.toFixed(4)})`, a.every((s, i) => s === b[i]) && mx < 0.02 && Math.abs(end.zoom - d.fit) < 1e-3 && end.blur < 0.01 && /rotateX/.test(end.transform)); }
{ const d = D('ui.tabPillNav'), G = tabGeo(d, 1, 1920 * d.box[0] + 42), px = (t) => +/<clipPath id="tp\d+p-[a-z0-9]+"><rect x="([\d.]+)"/.exec(R('ui.tabPillNav', t))[1], last = d.steps.at(-1);
  check(`ui.tabPillNav: pill starts on tab ${d.first} (x ${px(0.5)}), is between tabs mid-slide, settles on tab ${last[1]} (x ${px(last[0] + 1)} vs ${G[last[1]].x.toFixed(2)}); the active list swaps`, Math.abs(px(0.5) - G[d.first].x) < 0.5 && Math.abs(px(last[0] + 1) - G[last[1]].x) < 0.5 &&
    px(d.steps[0][0] + 0.06) > G[d.first].x + 1 && px(d.steps[0][0] + 0.06) < G[d.steps[0][1]].x - 1 && R('ui.tabPillNav', last[0] + 1).includes(d.tabs[last[1]].items[0][0]) && !R('ui.tabPillNav', last[0] + 1).includes(d.tabs[0].items[0][0])); }
{ const d = D('ui.windowWall'), t0 = d.panAt + d.panDur + 0.6; check(`ui.windowWall: every window loops (frame at ${t0.toFixed(1)} s = frame one period ${d.period} s later once the camera has stopped)`, R('ui.windowWall', t0) === R('ui.windowWall', t0 + d.period) && R('ui.windowWall', t0) !== R('ui.windowWall', t0 + d.period / 3)); }
{ const d = D('ui.optionPicker'), cues = uiCues('ui.optionPicker'), fin = R('ui.optionPicker', d.lockAt + 0.5);
  check(`ui.optionPicker: ${cues.length - 1} ticks as options pass the slot (rapid passes merged, >= 60 ms apart), the drum lands exactly on its target and locks on "${d.options[d.target]}" in the accent; chips mode clicks and locks the same option`, cues.length - 1 >= 4 && cues.slice(1, -1).every((q, i) => q.t - cues[i].t >= 0.06 - 1e-9) &&
    new RegExp(`fill="${d.accent}"[^>]*/><text[^>]*>${d.options[d.target]}<`).test(fin) && new RegExp(`fill="${d.accent}"[^>]*/><text[^>]*>${d.options[d.target]}<`).test(R('ui.optionPicker', d.lockAt + 0.5, { mode: 'chips' }))); }
console.log(`\nui: ${pass} passed, ${fail} failed`); fs.writeFileSync(path.join(here, 'last-run-ui.json'), JSON.stringify({ pass, fail }, null, 1) + '\n'); process.exit(fail ? 1 : 0);
