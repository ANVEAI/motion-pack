/* templates/demo-r45-ui/make.mjs: a 19.5 s 16:9 proof film built from the round 4+5 proof parts (type/gfx/ui-proof.js, ui-trace.js), as a working example of each.
   Pattern: storyboard shape I from the round 4+5 study (proof film: one builder at a time, a claim held in a line, the numbers each with a source label), cut on a
   120 BPM grid (15 f per beat): a cost-vs-score scatter whose frontier draws through the best points and ends on a starred point, a decision diagram whose wrong
   step turns red and carries the red to the result, a table that builds under a one-line finding with a tie-in bar chart, then a speech bubble that fills word by word
   beside a speaker with a usage chip pinned to the scene. Craft only: nothing from a reference is copied.
     node make.mjs            -> out/plan.json (scenes + cue sheet), assets/ (fonts, pack modules), assets/media/mix.wav (music/mixer.py, -14 LUFS), index.html
     npx -y hyperframes@0.8.142 render . -o out/demo-r45-ui.mp4 --crf 23
     python3 ../_shared/sheet.py out/demo-r45-ui.mp4 out/sheet.jpg <times>
   Not a genre template (no config.mjs, so tools/count.py does not count it). HONESTY: every number on screen is ILLUSTRATIVE and each part prints that in frame
   (scatter footnote, table source line, "illustrative run", ticker source line); the "footage" in the last scene is the pack's own procedural placeholder plate
   (a generic silhouette, labelled in frame) and nobody is quoted. No third-party brand, logo, product name or footage. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, head, write } from '../_shared/compose.mjs';
import { gfxCues } from '../../type/gfx/index.js';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..');

/* the placeholder speaker: head position as a pure function of the scene's local time; the bubble's anchor track is sampled from the same function every 0.25 s,
   the way a tracking JSON from real footage would be */
export const headAt = (u) => [0.345 + 0.0045 * Math.sin(2 * Math.PI * 0.2 * u), 0.43 + 0.004 * Math.sin(2 * Math.PI * 0.3 * u + 1)];
const track = (n) => Array.from({ length: n + 1 }, (_, i) => { const u = i * 0.25, [x, y] = headAt(u); return [u, +x.toFixed(5), +y.toFixed(5)]; });

export const CONFIG = {
  fps: 30, W: 1920, H: 1080, seconds: 19.5, music: 'music/bed_corporate_bright_loop8', musicGainDb: 0, ceilingDb: -2.5, fadeInMs: 40,   // 120 BPM: every cut on the 0.5 s grid
  colors: { paper: '#F4F2EE', night: '#121118', brand: '#4A18ED', ink: '#16151B' },
  layers: [{ kind: 'grain', params: { stock: 'digital-soft' } }],
  scenes: [
    { id: 'frontier', start: 0, end: 4.5, bg: 'paper', why: 'claim by chart: points drop in, the frontier draws through the best, the starred point lands last (axes already drawing on frame 0)',
      items: [{ id: 'chart.scatterFrontier', at: -0.2, params: { box: [0.06, 0.07, 0.88, 0.86] } }] },
    { id: 'trace', start: 4.5, end: 9.5, bg: 'paper', why: 'method: three checks run side by side; one wrong pick turns red and the red runs down the line to the result',
      items: [{ id: 'ui.branchTrace', at: 4.5, params: { box: [0.04, 0.06, 0.92, 0.86] } }] },
    { id: 'table', start: 9.5, end: 13.5, bg: 'paper', why: 'numbers: a table builds under its finding, the bars share its data, one cell pulses',
      items: [{ id: 'ui.dataTable', at: 9.5, params: { box: [0.08, 0.05, 0.84, 0.9], bars: { row: 0, title: 'Calls handled per week', h: 0.26 } } }] },
    { id: 'speaker', start: 13.5, end: 18.0, bg: 'night', plate: true, why: 'live voice: the words fill a bubble beside the speaker on their own timestamps, tick Captured, and dock into a list; a usage chip is pinned to the scene',
      items: [{ id: 'caption.sceneBubble', at: 13.5, params: { anchor: track(18), side: 'right', offset: [64, -170], scale: 1.5, speaker: 'Speaker', dock: { at: 3.35, to: [0.64, 0.17], scale: 0.62, title: 'Reminders' } } },
        { id: 'ui.costTicker', at: 13.5, params: { anchor: [0.62, 0.62], offset: [10, 90], scale: 1.45, mode: 'zero', counters: [{ label: 'tokens', keys: [[0.5, 0], [2.9, 1240]], dec: 0 }, { label: 'cost', keys: [[0.5, 0], [2.9, 0]], prefix: '$', dec: 2 }] } }] },
    { id: 'name', start: 18.0, end: 19.5, bg: 'brand', why: 'end card: the name and one line, held quiet', card: { name: 'motion-pack', line: 'Proof parts. Data on screen is illustrative.' }, items: [] },
  ],
  sfx: { cut: ['sfx/whoosh/swish_xs', 'sfx/tx/cut_tick'], logo: 'sfx/logo/ascend_land' },
};

const C = CONFIG, F = C.fps, T = C.seconds;
/* ---------- plan + cue sheet (the same plan drives picture and sound) ---------- */
const cues = [];
C.scenes.forEach((sc, i) => { for (const it of sc.items) for (const q of gfxCues(it.id, it)) if (q.t >= sc.start && q.t < sc.end - 1 / F) cues.push({ ...q, scene: sc.id });
  if (sc.start > 0) cues.push({ t: sc.start, id: C.sfx.cut[i % 2], why: 'cut: lands on the cut', scene: sc.id }); });
const name = C.scenes.at(-1); cues.push({ t: name.start + 0.12, id: C.sfx.logo, why: 'sonic logo on the name', scene: name.id });
cues.sort((a, b) => a.t - b.t);
const kept = []; for (const c of cues) { const last = kept.at(-1); if (last && c.t - last.t <= 2 / F && !/logo/.test(c.id)) { if (/cut/.test(last.why)) continue; if (/cut/.test(c.why)) { kept[kept.length - 1] = c; continue; } } kept.push(c); }   // one sound per moment: a cue within 2 frames of the previous one is dropped (a cut sound yields to the part's own)
const shots = C.scenes.map((s) => ({ id: s.id, start: s.start, dur: +(s.end - s.start).toFixed(4), parts: s.items.map((i) => i.id), transition: 'transitions/cut', why: s.why }));
const plan = { template: 'demo-r45-ui', fps: F, seconds: T, W: C.W, H: C.H, music: C.music, musicGainDb: C.musicGainDb, ceilingDb: C.ceilingDb, fadeInMs: C.fadeInMs, shots, cues: kept,
  honesty: 'every number is illustrative and labelled so in frame by the part itself; the speaker plate is a procedural placeholder (labelled in frame); no real recording, no quotes, no third-party marks',
  claims: [{ text: 'Highest score under $4 a task (the starred point)', source: 'illustrative data, printed in the chart footnote' }, { text: 'Week 3 resolved more calls in the call, at a lower cost per call', source: 'illustrative data, printed under the table' }, { text: '$0 per query on device (the usage chip)', source: 'illustrative values, printed under the chip' }],
  lint: { cutsOnBeat: shots.every((s) => Math.abs(s.start * 2 - Math.round(s.start * 2)) < 1e-9), partsUsed: [...new Set(shots.flatMap((s) => s.parts))], everyClaimHasSource: true } };
fs.mkdirSync(path.join(DIR, 'out'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'out', 'plan.json'), JSON.stringify(plan, null, 1));
console.log(`plan: ${shots.length} shots, ${kept.length} cues, parts ${plan.lint.partsUsed.length} (${plan.lint.partsUsed.join(', ')}), cuts on beat: ${plan.lint.cutsOnBeat}`);

/* ---------- stage: fonts, layers + type modules (compose.mjs), plus type/gfx (the proof parts live there) ---------- */
const st = stage(DIR, { layers: C.layers.length > 0 });
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
for (const f of fs.readdirSync(path.join(PACK, 'type', 'gfx')).filter((f) => f.endsWith('.js'))) link(path.join(PACK, 'type', 'gfx', f), path.join(DIR, 'assets', 'mp', 'type', 'gfx', f));
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
execFileSync('python3', [path.join(SH, 'audio.py'), path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });

/* ---------- page ---------- */
const css = `#bg { z-index: 0; } #stage { z-index: 2; } #fx { pointer-events: none; } #fx canvas { z-index: 5; }`;
const html = `${head({ W: C.W, H: C.H, title: 'motion-pack demo: round 4+5 proof parts (illustrative data)', bg: C.colors.paper, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${C.W}" data-height="${C.H}" data-duration="${T}">
<div id="bg" class="clip" data-start="0" data-duration="${T}" data-track-index="0"></div>
<div id="stage" class="clip" data-start="0" data-duration="${T}" data-track-index="1"></div>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { renderInner } from './assets/mp/type/gfx/index.js';
import { ctxFor, text, f2 } from './assets/mp/type/gfx/core.js';
import { KIT } from './assets/mp/type/gfx/ui.js';
import { spring } from './assets/mp/type/ease.js';
import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
const C = ${JSON.stringify({ W: C.W, H: C.H, scenes: C.scenes, colors: C.colors })};
const { rect } = KIT, headAt = ${headAt.toString()};
const ctx = ctxFor(C.W, C.H, null, 1), bg = document.getElementById('bg'), stage = document.getElementById('stage');
/* end card: the name lands on the headline spring, the line follows 0.25 s later */
const card = (cd, u) => { const k1 = spring(u, 'headline'), k2 = spring(u - 0.25, 'panel');
  return '<g opacity="' + f2(Math.min(1, u / 0.1)) + '" transform="translate(0 ' + f2(30 * (1 - k1)) + ')">' + text(cd.name, C.W / 2, C.H * 0.47, { size: 150, weight: 800, fill: '#FFFFFF', anchor: 'middle', ls: -4 }) + '</g>' +
    (u > 0.25 ? '<g opacity="' + f2(Math.min(1, (u - 0.25) / 0.15)) + '" transform="translate(0 ' + f2(20 * (1 - k2)) + ')">' + text(cd.line, C.W / 2, C.H * 0.47 + 110, { size: 52, weight: 600, fill: '#FFFFFF', anchor: 'middle', op: 0.85 }) + '</g>' : ''); };
/* the placeholder plate: a dim room, a window glow, a desk, a laptop and a generic silhouette (head + shoulders) that sways a little; all procedural, all labelled */
const plate = (u) => { const [hx, hy] = headAt(u), X = hx * C.W, Y = hy * C.H, r = 74;
  return '<defs><linearGradient id="pl-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2723"/><stop offset="1" stop-color="#14110F"/></linearGradient><radialGradient id="pl-g" cx="0.78" cy="0.3" r="0.55"><stop offset="0" stop-color="#7FA6D8" stop-opacity="0.45"/><stop offset="1" stop-color="#7FA6D8" stop-opacity="0"/></radialGradient></defs>' +
    rect(0, 0, C.W, C.H, 0, 'url(#pl-w)') + rect(0, 0, C.W, C.H, 0, 'url(#pl-g)') + rect(C.W * 0.74, C.H * 0.1, C.W * 0.2, C.H * 0.3, 8, '#9DBBE0', 'opacity="0.2"') +
    rect(0, C.H * 0.8, C.W, C.H * 0.2, 0, '#1B1715') + rect(0, C.H * 0.8, C.W, 4, 0, '#3A322D') +
    '<path d="M' + f2(X - 300) + ' ' + f2(C.H * 0.82) + ' Q' + f2(X - 300) + ' ' + f2(Y + r + 80) + ' ' + f2(X - 170) + ' ' + f2(Y + r + 56) + ' L' + f2(X - 56) + ' ' + f2(Y + r + 30) + ' L' + f2(X + 56) + ' ' + f2(Y + r + 30) + ' L' + f2(X + 170) + ' ' + f2(Y + r + 56) + ' Q' + f2(X + 300) + ' ' + f2(Y + r + 80) + ' ' + f2(X + 300) + ' ' + f2(C.H * 0.82) + ' Z" fill="#3B3633"/>' +
    rect(X - 30, Y + r - 10, 60, 70, 20, '#4A4440') + '<ellipse cx="' + f2(X) + '" cy="' + f2(Y) + '" rx="' + r * 0.86 + '" ry="' + r + '" fill="#4A4440"/>' +
    '<path d="M' + f2(X + r * 0.5) + ' ' + f2(Y - r * 0.9) + ' A' + r * 0.86 + ' ' + r + ' 0 0 1 ' + f2(X + r * 0.86) + ' ' + f2(Y) + '" fill="none" stroke="#7FA6D8" stroke-width="3" opacity="0.45"/>' +
    '<g transform="translate(' + f2(C.W * 0.62) + ' ' + f2(C.H * 0.58) + ')"><path d="M-170 0 L170 0 L150 -190 L-150 -190 Z" fill="#262321" stroke="#3E3834" stroke-width="3"/><path d="M-150 -170 L150 -170 L136 -20 L-136 -20 Z" fill="#6E8CB8" opacity="0.28"/><path d="M-210 0 L210 0 L196 30 L-196 30 Z" fill="#332E2B"/></g>' +
    text('placeholder plate: a procedural silhouette, not a real recording', 56, C.H - 52, { size: 24, weight: 600, fill: '#FFFFFF', op: 0.6 }); };
function frame(t) {
  const sc = C.scenes.find((s) => t >= s.start && t < s.end) || C.scenes.at(-1); bg.style.background = C.colors[sc.bg];
  let svg = sc.plate ? plate(t - sc.start) : sc.card ? card(sc.card, t - sc.start) : '';
  for (const it of sc.items) svg += renderInner(it.id, t, { at: it.at, dur: 1e6, params: it.params }, ctx);
  stage.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + C.W + ' ' + C.H + '" width="' + C.W + '" height="' + C.H + '" style="position:absolute;inset:0">' + svg + '</svg>';
}
/* measure() reads canvas text metrics, so load the weights the kit uses up front and repaint the current frame once they are in (same wrap on every frame) */
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => frame((last = e.detail.time))); frame(last);
Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope'))).then(() => frame(last));
bindHF(mountStack(document.getElementById('fx'), ${JSON.stringify(C.layers)}, { width: ${C.W}, height: ${C.H}, fps: ${F}, seed: 7 }), { fps: ${F} });
const tl = gsap.timeline({ paused: true }); tl.set({}, {}, ${T});
window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), 'todo:', st.todo.join(' | ') || 'none');
