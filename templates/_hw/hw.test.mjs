/* node templates/_hw/hw.test.mjs (xp-hardware, 2026-10-16): the hardware templates and their pure parts, no browser, no GPU.
   hardware-reveal, hardware-teaser, spec-sheet x 16:9 / 9:16 x every cut: the plan is a pure function (same bytes twice, and in a second process), every section
   starts on a bar line, the music drop lands on the reveal bar, lengths sit in the brief's windows, every overlay id is a registered gfx part, every tracked
   callout stays on screen, every planned text box sits in the platform safe rect, every number on screen is a sourced claim (and a missing source fails
   lint.proof), the 9:16 plan is a re-layout (its own cameras and positions), the price prints its note, the frame label is there, PROJECT_MAP paths exist.
   Pure parts: the explode choreographer (cascade order, overshoot, breathe, reverse reassembly, exact zero at rest, hostile numbers), the camera projection
   (the look-at lands on the screen pixel), the die table (objects and type agree), fmtNum, pointAt. Exit 1 on any failure. */
import { execFileSync } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs';
const HERE = path.dirname(new URL(import.meta.url).pathname), TPL = path.resolve(HERE, '..'), PACK = path.resolve(TPL, '..');
const { GFX, fmtNum, hwPointAt, dieBlocks } = await import(path.join(PACK, 'type/gfx/index.js'));
const { lintClaims } = await import(path.join(TPL, '_shared/plan.mjs'));
const { safeRect } = await import(path.join(PACK, 'type/safezones.js'));
const { explodePlan, explodeAt, settle } = await import(path.join(PACK, 'objects/lib/explode.js'));
const { project } = await import(path.join(PACK, 'objects/kit/project.js'));
const { dieLayout, nodeLayout } = await import(path.join(PACK, 'objects/lib/hwdata.js'));
let pass = 0, fail = 0; const ok = (name, cond, msg = '') => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, msg); } };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const T = { 'hardware-reveal': { cuts: ['short', 'full', 'long'], range: [45, 75], drop: 'reveal' }, 'hardware-teaser': { cuts: [6, 10, 15], range: [6, 15], drop: 'date' }, 'spec-sheet': { cuts: [20, 24, 30], range: [20, 30], drop: 'hero' } };
for (const [name, spec] of Object.entries(T)) {
  const M = await import(path.join(TPL, name, 'config.mjs'));
  for (const aspect of ['16:9', '9:16']) for (const length of spec.cuts) {
    const C = { ...structuredClone(M.CONFIG), aspect, length }, P = M.buildPlan(C), P2 = M.buildPlan(structuredClone(C)), tag = `${name} ${aspect} ${length}`;
    ok(`${tag}: plan is a pure function (same JSON twice)`, JSON.stringify(P) === JSON.stringify(P2));
    ok(`${tag}: length ${P.seconds} s inside ${spec.range}`, P.seconds >= spec.range[0] - 1e-6 && P.seconds <= spec.range[1] + 1e-6);
    const fpbar = P.framesPerBeat * 4; ok(`${tag}: every section starts on a bar line`, P.sections.every((s) => s.f0 % fpbar === 0 && Math.abs(s.t0 * P.fps - s.f0) < 1e-6));
    const sc = P.score.sections; let bar = 0, dropBar = null, prev = 0; for (const s of sc) { const e0 = Array.isArray(s.energy) ? s.energy[0] : s.energy; if (bar && e0 - prev >= 0.3 && dropBar == null) dropBar = bar; prev = Array.isArray(s.energy) ? s.energy[1] : s.energy; bar += s.bars; }
    const dropSec = P.sections.find((s) => s.id === spec.drop); ok(`${tag}: the music drop lands on the ${spec.drop} bar`, dropSec && dropBar === dropSec.f0 / fpbar, `drop bar ${dropBar} vs ${dropSec && dropSec.f0 / fpbar}`);
    ok(`${tag}: one deep sub hit, on the drop frame`, P.cues.filter((c) => c.id === 'sfx/hw/sub_hit').length === 1 && P.cues.some((c) => c.id === 'sfx/hw/sub_hit' && Math.abs(c.t - dropSec.t0) < 1e-6));
    ok(`${tag}: every overlay id is a registered gfx part`, P.overlays.every((o) => GFX[o.id]), P.overlays.map((o) => o.id).filter((i) => !GFX[i]).join(','));
    const tracks = P.overlays.filter((o) => o.id !== 'hw.edgeGlint').flatMap((o) => [o.params.track, o.params.a, o.params.b].filter((t) => Array.isArray(t) && Array.isArray(t[0])));
    ok(`${tag}: every callout / dimension track stays in frame (${tracks.length} tracks; a glint may run off the edge of a macro)`, tracks.every((t) => t.every(([, x, y]) => x > -0.02 && x < 1.02 && y > -0.02 && y < 1.02)));
    const R = safeRect(P.safeZone, P.W, P.H); const out = P.texts.filter((x) => x.box[0] < R.x0 - 1 || x.box[2] > R.x1 + 1 || x.box[1] < R.y0 - 1 || x.box[3] > R.y1 + 1);
    ok(`${tag}: every planned text box sits in the ${P.safeZone} safe rect`, !out.length, out.map((x) => `${x.id} ${x.box}`).join(' | '));
    ok(`${tag}: every claim has a source (lint.proof clean)`, lintClaims(P.claims).length === 0 && P.claims.every((c) => /\d/.test(c.text)));
    ok(`${tag}: the frame label is on`, typeof P.label === 'string' && /render/.test(P.label));
    ok(`${tag}: the plate covers the film`, P.shots3d.at(-1).t0 + P.shots3d.at(-1).dur >= P.seconds - 1e-6 && P.shots.reduce((a, s) => a + s.dur, 0) >= P.seconds - 1e-3);
    if (P.structure) ok(`${tag}: plan.structure names its beats end to end (0 -> runtime, no gap; tools/structure_check.py reads it)`, P.structure.sections.length >= 3 && P.structure.sections[0].t[0] === 0 && P.structure.sections.every((x, i, A) => x.t[1] > x.t[0] && (!i || Math.abs(A[i - 1].t[1] - x.t[0]) < 1e-6)) && Math.abs(P.structure.sections.at(-1).t[1] - P.seconds) < 1e-6);
    if (P.audio.events) ok(`${tag}: plan.audio.events are sorted motion times inside the film`, P.audio.events.every((t, i, A) => t >= 0 && t < P.seconds && (!i || t > A[i - 1])));
    ok(`${tag}: every non-cut transition has a reason`, P.shots.every((s) => !s.tx || s.tx === 'transitions/cut' || (s.txReason && s.txReason.length > 10)));
  }
  const W = M.buildPlan({ ...structuredClone(M.CONFIG), aspect: '16:9' }), Tl = M.buildPlan({ ...structuredClone(M.CONFIG), aspect: '9:16' });
  ok(`${name}: 9:16 is a re-layout (own size, own title positions, own tracks)`, Tl.W === 1080 && Tl.H === 1920 && JSON.stringify(Tl.titles.map((t) => [t.x, t.y])) !== JSON.stringify(W.titles.map((t) => [t.x, t.y])) && JSON.stringify(Tl.overlays) !== JSON.stringify(W.overlays));
  ok(`${name}: PROJECT_MAP points at real CONFIG paths`, Object.values(M.PROJECT_MAP).every((p) => get(M.CONFIG, p) !== undefined || p.endsWith('.src') || p.endsWith('logo')), Object.values(M.PROJECT_MAP).filter((p) => get(M.CONFIG, p) === undefined).join(','));
  ok(`${name}: CONFIG has the editable contract (brand, platform, fps, length, aspect, text, media)`, ['brand.name', 'brand.accent', 'brand.ink', 'brand.paper', 'brand.url', 'brand.font.display', 'fps', 'length', 'aspect', 'text', 'media.model', 'media.photo'].every((p) => get(M.CONFIG, p) !== undefined) && 'platform' in M.CONFIG && 'logo' in M.CONFIG.brand);
  const committed = path.join(TPL, name, 'out', 'plan.json');
  if (fs.existsSync(committed)) { const c = JSON.parse(fs.readFileSync(committed, 'utf8')); delete c.lint; ok(`${name}: the committed out/plan.json is current`, JSON.stringify(c) === JSON.stringify(W)); }
}
/* honesty: a spec without a source fails the lint gate (exit 2 from cues.mjs) */
{ const M = await import(path.join(TPL, 'hardware-reveal', 'config.mjs')), C = structuredClone(M.CONFIG); C.specs[0].source = ''; const P = M.buildPlan(C); ok('a spec with no source is caught by lint.proof', lintClaims(P.claims).length === 1);
  C.specs[0].source = 'internal benchmark'; ok('a generic source ("internal benchmark") is refused too', lintClaims(M.buildPlan(C).claims).length === 1);
  let code = 0; try { execFileSync('node', [path.join(TPL, '_shared/cues.mjs'), path.join(TPL, 'hardware-reveal'), '--set', 'specs.0.source=', '--name', 'plan-honesty-test'], { stdio: 'pipe' }); } catch (e) { code = e.status; } fs.rmSync(path.join(TPL, 'hardware-reveal/out/plan-honesty-test.json'), { force: true });
  ok('cues.mjs exits 2 on the unsourced spec (the build stops)', code === 2, 'exit ' + code);
  const P0 = M.buildPlan(structuredClone(M.CONFIG)), dc = P0.overlays.find((o) => o.id === 'hw.dateCard');
  ok('the price card carries its note and its source', dc && /indicative|placeholder/.test(dc.params.note) && dc.params.source); }
/* plan determinism across processes */
{ const a = execFileSync('node', ['-e', `import('${path.join(TPL, 'hardware-reveal/config.mjs')}').then(m=>process.stdout.write(JSON.stringify(m.buildPlan(m.CONFIG))))`]).toString();
  const M = await import(path.join(TPL, 'hardware-reveal', 'config.mjs')); ok('hardware-reveal plan: the same bytes in a fresh process', a === JSON.stringify(M.buildPlan(structuredClone(M.CONFIG)))); }
/* explode choreographer */
{ const X = explodePlan([{ id: 'a', dir: [0, 1, 0], dist: 1 }, { id: 'b', dir: [0, 2, 0], dist: 0.5 }, { id: 'c', dir: [1, 0, 0], dist: 0.3 }], { at: 1, dur: 0.8, stagger: 0.1, hold: 2 });
  const at = (t) => explodeAt(X, t);
  ok('explode: assembled before the cascade (exact zero)', Object.values(at(0.99)).every((p) => p.k === 0 && p.off.every((v) => v === 0)));
  ok('explode: the first part leaves first', at(1.15).a.k > at(1.15).b.k && at(1.15).b.k >= at(1.15).c.k);
  const mx = Math.max(...Array.from({ length: 200 }, (_, i) => settle(i / 199))); ok('explode: one small overshoot (1 < max k < 1.06) then exactly 1', mx > 1 && mx < 1.06 && settle(1) === 1);
  ok('explode: the hold breathes (k moves while held)', Math.abs(at(X.outEnd + 0.9).a.k - at(X.outEnd + 1.6).a.k) > 1e-4);
  const rb = (t) => at(t); ok('explode: the reassembly runs in reverse (the first part out seats last)', rb(X.backAt + 0.5).c.k < rb(X.backAt + 0.5).a.k);
  ok('explode: exactly zero once seated', Object.values(at(X.seatEnd + 0.01)).every((p) => p.k === 0));
  ok('explode: direction normalised (b dist 0.5 along +Y)', Math.abs(at(X.outEnd + 0.01).b.off[1] - 0.5 * at(X.outEnd + 0.01).b.k) < 1e-9);
  const H = explodePlan([{ id: 'x', dir: [NaN, Infinity, 0], dist: NaN }], { at: NaN, dur: -1, stagger: 1e9, hold: Infinity }); ok('explode: hostile numbers give finite offsets', [0, 1, 5, 1e6].every((t) => explodeAt(H, t).x.off.every(Number.isFinite))); }
/* camera projection: the look-at lands on the screen pixel; a point to the right lands right */
{ const c = { fov: 20, elev: 15, az: -10, dist: 6, target: [0.1, 0.2, 0.05], screen: [900, 600] }, q = project(c, c.target, 1920, 1080), r = project(c, [1, 0.2, 0.05], 1920, 1080);
  ok('project: the look-at lands on c.screen', Math.abs(q[0] - 900) < 1e-6 && Math.abs(q[1] - 600) < 1e-6 && q[2] > 0); ok('project: +x world lands right of the look-at (az -10)', r[0] > q[0]); }
/* the die table: objects/lib/hwdata.js and type/gfx/hw.js draw the same blocks */
ok('die table: the 3D die and the 2D die part agree', JSON.stringify(dieLayout({ cores: 8 })) === JSON.stringify(dieBlocks(8)) && JSON.stringify(dieLayout({ cores: 12 })) === JSON.stringify(dieBlocks(12)));
ok('fmtNum: fixed grouping, no locale', fmtNum(1234567.891, 2) === '1,234,567.89' && fmtNum(-999, 0) === '-999' && fmtNum(NaN, 1) === '0.0');
ok('pointAt: a composition-time track is linear between keys and held at the ends', JSON.stringify(hwPointAt([[1, 0.2, 0.3], [2, 0.4, 0.5]], 1.5)) === JSON.stringify([0.30000000000000004, 0.4]) && hwPointAt([[1, 0.2, 0.3]], 9)[0] === 0.2);
{ const L = nodeLayout({ w: 1.2, ports: ['power', 'net', 'nope'] }); ok('hwdata: unknown port kinds are dropped, dims follow the spec (1 unit = 250 mm)', L.ports.length === 2 && L.dims.w_mm === 300); }
/* the shot director: every kind gives a finite camera and state; the moves do what their names say */
{ const { director, SHOT_KINDS } = await import(path.join(PACK, 'objects/lib/hwshots.js'));
  const shots3d = SHOT_KINDS.map((kind, i) => ({ id: 's' + i, kind, t0: i * 6, dur: 6, p: {} })), D = director({ aspect: 'wide', shots3d }), fin = (v) => Array.isArray(v) ? v.every(fin) : typeof v === 'object' && v ? Object.values(v).every(fin) : typeof v !== 'number' || Number.isFinite(v);
  ok('director: every kind gives a finite camera and state at 5 times', SHOT_KINDS.every((k, i) => [0, 1.5, 3, 4.5, 5.9].every((u) => { const t = i * 6 + u, c = D.cameraAt(t), S = D.stateAt(t); return fin(c) && fin(S.pose) && fin(S.lights) && S.kind === k; })));
  const at = (k, u) => D.stateAt(SHOT_KINDS.indexOf(k) * 6 + u);
  ok('director: silhouette is edge light only (no top, no key)', at('silhouette', 3).lights.top === 0 && at('silhouette', 3).lights.key === 0 && at('silhouette', 3).lights.edge > 1);
  ok('director: the sweep strip travels', at('sweep', 1).lights.sweep < at('sweep', 5).lights.sweep);
  ok('director: the hero turns and its band ignites', at('hero', 5).pose.yaw > at('hero', 0.5).pose.yaw && at('hero', 0.02).bandSweep < 0.1 && at('hero', 1).bandSweep === 1);
  ok('director: the explode lifts the device and opens the parts', at('explode', 3).pose.p[1] > 0.5 && at('explode', 3).explode.top.off[1] > 0.5 && at('explode', 0.05).explode.top.k === 0);
  ok('director: the ports cable goes in, the scale props show', at('ports', 1).cable < at('ports', 5).cable && at('ports', 5).cable === 1 && at('scale', 2).show.laptop && at('ports', 2).show.cable);
  ok('director: inside turns to x-ray, then lifts the cooling and lights the die', at('inside', 0.1).xray < 0.1 && at('inside', 3).xray === 1 && at('inside', 5.5).die === 1 && at('inside', 5.9).dieGlow > 0.8 && at('inside', 5).explode.heatsink.off[1] > 1);
  ok('director: tall gets its own cameras', JSON.stringify(director({ aspect: 'tall', shots3d }).cameraAt(9)) !== JSON.stringify(D.cameraAt(9)));
  ok('director: px() of the band on a hero frame lands in frame', (() => { const q = D.px('band', SHOT_KINDS.indexOf('hero') * 6 + 2); return q && q[0] > 0 && q[0] < 1 && q[1] > 0 && q[1] < 1; })()); }
console.log(`\nhardware templates: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
