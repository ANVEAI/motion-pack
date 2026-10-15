/* templates/demo-r6-pivot/make.mjs: plan (cuts/story6.py via config.mjs) -> mix (music mixer, with the story's bed automation) -> HyperFrames index.html (1080 x 1080, 30 s, no cuts).
   One continuous page. Text: type.typewriter (sentence, command) and type.blurIn (accent, problem beats, lead word, brand line) through type/dom.js mountType + bakeType (one tl.set
   per changed frame, seek-safe); the value ladder is type.accentSwap (mountGfx, re-rendered on hf-seek); the ribbon is background.auroraRibbon (layers/overlay.js mountStack).
   Local to this demo (pure functions of t, drawn on hf-seek): the problem diagram (boxes with faces that get worse each beat), the typing caret, the command pill's outline.
   Every caption leaves by a blur-through (a tween of its container); the story's in / out frames are the only timing source. Nothing here is hand-timed.
     node make.mjs   then   npx -y hyperframes@0.8.142 render . -o out/demo-r6-pivot.mp4 --crf 23 */
import fs from 'node:fs'; import path from 'node:path';
import { stage, runPlan, head, write, mix } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
runPlan(DIR);   // plan + lint gates: exits 2 on lint.proof / lint.tx (--allow-lint waives)
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'out', 'plan.json'), 'utf8'));
const { CONFIG: C } = await import('./config.mjs');
const st = stage(DIR, { layers: true });
fs.mkdirSync(path.join(DIR, 'assets', 'media'), { recursive: true });
mix(path.join(DIR, 'out', 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav'));   // audio.py: a failure ends the build with its own message, no stack trace
const [W, H] = plan.size, F = plan.fps, T = plan.seconds, L = C.look;
const data = { story: plan.story, ribbon: plan.ribbon, look: L, note: C.placeholderNote, fps: F, T, W, H };
const css = `
#root { background: ${L.ground}; color: ${L.ink}; }
.cap { position: absolute; margin: 0; white-space: pre-wrap; }
#aur, #diag, #txt, #gfx, #note { position: absolute; inset: 0; }
#diag > div { position: absolute; left: 160px; top: 130px; width: 760px; height: 560px; }
#diag svg { width: 100%; height: 100%; overflow: visible; }
#pill { position: absolute; left: 50%; top: 440px; transform: translateX(-50%); padding: 26px 46px; opacity: 0; font-family: "IBM Plex Mono", monospace; font-weight: 600; }
#pill svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
#pill .cap { position: relative; font-size: 46px; color: ${L.mono}; letter-spacing: 0; }
.caret { position: absolute; width: 4px; background: ${L.accent}; opacity: 0; }`;
const html = `${head({ W, H, title: 'motion-pack demo: round-6 problem pivot', bg: L.ground, css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="aur" class="clip" data-start="0" data-duration="${T}" data-track-index="1"></div>
<div id="diag" class="clip" data-start="0" data-duration="${T}" data-track-index="2"><div id="diagsvg"></div></div>
<div id="txt" class="clip" data-start="0" data-duration="${T}" data-track-index="3">
  <div id="pill"><svg><rect id="pillrect" x="1.5" y="1.5" rx="40" fill="none" stroke="${L.line}" stroke-width="3" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg></div>
</div>
<div id="gfx" class="clip" data-start="0" data-duration="${T}" data-track-index="4"></div>
<div id="note" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
<script type="module">
import { mountType, bakeType } from './assets/mp/type/dom.js';
import { unitStates } from './assets/mp/type/presets.js';
import { mountGfx } from './assets/mp/type/gfx/index.js';
import { mountStack, bindHF } from './assets/mp/layers/overlay.js';
const D = ${JSON.stringify(data)};
const { story: S, look: L, fps: F, T, W, H } = D, cap = Object.fromEntries(S.captions.map((c) => [c.id, c])), sec = (f) => f / F;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k, ss = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); }, seg = (t, a, b) => clamp((t - a) / (b - a));
const tl = gsap.timeline({ paused: true }), txt = document.getElementById('txt'), SWAP = S.captions[0].swap_out_frames / F;
const hf = (fn) => { window.addEventListener('hf-seek', (e) => fn(e.detail.time)); fn(window.__hfThreeTime || 0); };

/* ---- the ribbon: background.auroraRibbon (transparent field: the page is the black ground), fading out for the hold */
bindHF(mountStack(document.getElementById('aur'), [{ kind: 'auroraRibbon', params: { ...D.ribbon, bg: null } }], { width: W, height: H, fps: F, seed: 6 }), { fps: F });
tl.fromTo('#aur', { opacity: 1 }, { opacity: 0, duration: 1.4, ease: 'power1.inOut', immediateRender: false }, sec(cap.url.in) + 0.5);

/* ---- helpers */
const balance = (s, maxCh) => { const w = s.split(' '), n = Math.max(1, Math.ceil(s.length / maxCh)); if (n === 1) return [s]; let best = null;
  const rec = (i, k, acc) => { if (k === 1) { const ln = [...acc, w.slice(i).join(' ')], m = Math.max(...ln.map((x) => x.length)); if (!best || m < best.m) best = { m, ln }; return; } for (let j = i + 1; j <= w.length - k + 1; j++) rec(j, k - 1, [...acc, w.slice(i, j).join(' ')]); };
  rec(0, n, []); return best.ln; };
function box(id, o) { const d = document.createElement('div'); d.id = 'c-' + id; d.className = 'cap'; Object.assign(d.style, { left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', fontSize: o.size + 'px', fontWeight: String(o.weight || 600), color: o.color || L.ink,
  textAlign: o.align || 'left', fontFamily: o.mono ? '"IBM Plex Mono", monospace' : 'Manrope, sans-serif' }); (o.parent || txt).appendChild(d); return d; }
/* one type part: mount + bake; every exit is a blur-through of the container (the story's out frame), not the preset's own exit */
function part(id, o) { const c = cap[id], el = box(id, o), cs = getComputedStyle(el), at = sec(c.in), end = c.out == null ? T : sec(c.out) + SWAP;
  el.textContent = ''; const lines = o.lines || [c.text], spec = { preset: o.preset, text: lines.join(' '), lines, at, out: 1e9, ...(o.unit ? { unit: o.unit } : {}) };
  const m = mountType(el, spec, { fontPx: parseFloat(cs.fontSize), H, font: { weight: +cs.fontWeight, family: cs.fontFamily, tracking: o.tracking ?? -0.03, lineHeight: o.lh || 1.1 } });
  if (o.style) m.units.forEach((u, i) => o.style(u, i));
  bakeType(tl, m, spec, { t0: at, dur: end - at, fps: F });
  if (c.out != null) tl.to(el, { opacity: 0, filter: 'blur(16px)', duration: SWAP, ease: 'power2.in' }, sec(c.out));
  return { c, el, m, spec, at, end }; }
/* the typing caret: after the last shown character (type.typewriter's own caret rule: blink 15 f), pure function of t */
function caret(p, color) { const el = document.createElement('span'); el.className = 'caret'; p.el.appendChild(el); const blink = 15 / F;
  hf((t) => { const R = unitStates(p.spec, p.m.texts, t), vis = R.states.map((s, i) => (s.opacity > 0.5 ? i : -1)).filter((i) => i >= 0), on = t >= p.at - 1e-6 && t < p.end && (!R.caret.done || Math.floor((t - p.at) / blink) % 2 === 0);
    const u = p.m.units[vis.length ? vis[vis.length - 1] : 0], r = u.el.getBoundingClientRect(), q = p.el.getBoundingClientRect();
    Object.assign(el.style, { left: (vis.length ? r.right - q.left : r.left - q.left) + 'px', top: (r.top - q.top) + 'px', height: r.height + 'px', background: color, opacity: on ? 1 : 0 }); }); }
const accentOf = (units, word, color, weight) => units.forEach((u) => { if (u.text.toLowerCase().replace(/[^a-z0-9]/g, '') === word.toLowerCase().replace(/[^a-z0-9]/g, '')) { u.el.style.color = color; if (weight) u.el.style.fontWeight = weight; } });

/* ---- 1. the opening: the sentence typed with a cursor, then the accent word as the punchline */
const sent = part('sentence', { preset: 'typewriter', x: 84, y: 96, w: 912, size: 64, weight: 600, lines: balance(cap.sentence.text, 24), tracking: -0.02, lh: 1.14 }); caret(sent, L.accent);
part('accent', { preset: 'blurIn', x: 84, y: 318, w: 912, size: 118, weight: 700, color: L.accent, lines: [cap.accent.text], tracking: -0.035 });

/* ---- 2. the problem ladder: a diagram that gets worse each beat, the caption swaps by a blur-through */
['problem1', 'problem2', 'problem3'].forEach((id) => part(id, { preset: 'blurIn', x: 90, y: 770, w: 900, size: 80, weight: 600, align: 'center', lines: balance(cap[id].text, 19), lh: 1.08 }));
const dsec = S.sections.find((s) => s.role === 'problem'), starts = dsec.beats.map((b) => sec(b.start)), dEnd = sec(cap.problem3.out);
const ST = L.line, sw = 3.6;
function diagram(w) { const k1 = clamp(w), k2 = clamp(w - 1), xo = clamp((w - 1.35) / 0.5), crack = clamp((w - 1.2) / 0.7);
  const B = [[140, 262, 118], [300, 206, 142], [460, 262, 118]], out = [];
  B.forEach(([cx, cy, s], i) => { const rot = [-5, 4, 11][i] * k2, dx = i === 2 ? 20 * k2 : 0, dy = i === 2 ? 14 * k2 : 0, h = s / 2, ey = cy - s * 0.1, ex = s * 0.19, m = s * 0.2, curve = lerp(11, -13, clamp(w / 1.7)) * s / 118, my = cy + s * 0.2;
    out.push('<g transform="translate(' + (cx + dx) + ' ' + (cy + dy) + ') rotate(' + rot.toFixed(2) + ') translate(' + (-cx) + ' ' + (-cy) + ')" fill="none" stroke="' + ST + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="' + (cx - h) + '" y="' + (cy - h) + '" width="' + s + '" height="' + s + '" rx="14"/><line x1="' + cx + '" y1="' + (cy - h) + '" x2="' + cx + '" y2="' + (cy - h - 24) + '"/><circle cx="' + cx + '" cy="' + (cy - h - 30) + '" r="5"/>' +
      '<g opacity="' + (1 - xo).toFixed(3) + '"><circle cx="' + (cx - ex) + '" cy="' + ey + '" r="' + (s * 0.045).toFixed(1) + '"/><circle cx="' + (cx + ex) + '" cy="' + ey + '" r="' + (s * 0.045).toFixed(1) + '"/></g>' +
      '<g opacity="' + xo.toFixed(3) + '">' + [-1, 1].map((q) => { const x = cx + q * ex, r = s * 0.06; return '<path d="M' + (x - r) + ' ' + (ey - r) + 'L' + (x + r) + ' ' + (ey + r) + 'M' + (x + r) + ' ' + (ey - r) + 'L' + (x - r) + ' ' + (ey + r) + '"/>'; }).join('') + '</g>' +
      '<path d="M' + (cx - m) + ' ' + my.toFixed(1) + 'Q' + cx + ' ' + (my + curve).toFixed(1) + ' ' + (cx + m) + ' ' + my.toFixed(1) + '"/>' +
      (i === 1 ? '<polyline opacity="' + crack.toFixed(3) + '" points="' + (cx + 4) + ',' + (cy - h) + ' ' + (cx - 6) + ',' + (cy - h + 32) + ' ' + (cx + 8) + ',' + (cy - h + 52) + ' ' + (cx - 4) + ',' + (cy - h + 78) + ' ' + (cx + 6) + ',' + (cy - h + 104) + '"/>' : '') + '</g>'); });
  out.push('<g fill="none" stroke="' + ST + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"><path d="M199 262L229 236M371 236L401 262"/>' +
    '<g opacity="' + k1.toFixed(3) + '"><path d="M460 346C460 440 140 440 140 346"/><path d="M130 358L140 344L152 356"/></g></g>');
  return '<svg viewBox="0 0 600 460">' + out.join('') + '</svg>'; }
const diagEl = document.getElementById('diagsvg');
hf((t) => { const w = t < starts[1] ? 0 : t < starts[2] ? ss(seg(t, starts[1], starts[1] + 0.5)) : 1 + ss(seg(t, starts[2], starts[2] + 0.5)), a = ss(seg(t, starts[0], starts[0] + 0.4)) * (1 - ss(seg(t, dEnd, dEnd + SWAP)));
  diagEl.style.opacity = a.toFixed(3); diagEl.style.filter = a > 0 && t > dEnd ? 'blur(' + (16 * seg(t, dEnd, dEnd + SWAP)).toFixed(1) + 'px)' : 'none'; diagEl.innerHTML = a > 0.001 ? diagram(w) : ''; });

/* ---- 3. the pivot: the lead word on the silence, then the brand line (name bold, product word in the accent colour) as the colour arrives */
part('lead', { preset: 'blurIn', x: 90, y: 292, w: 900, size: 56, weight: 300, align: 'center', color: '#D9D5EC', lines: [cap.lead.text], tracking: -0.01 });
const bw = cap.brand.text.split(' '), product = bw[bw.length - 1], bl = [bw.slice(0, -1).join(' '), product];
part('brand', { preset: 'blurIn', unit: 'word', x: 90, y: 376, w: 900, size: 128, weight: 800, align: 'center', lines: bl, lh: 1.04, tracking: -0.04, style: (u) => { if (u.text === product) { u.el.style.color = L.accent; u.el.style.fontWeight = '500'; } } });

/* ---- 4. the value ladder: one sentence whose accent phrase swaps in place (type.accentSwap); the story's value beats are the swap times */
const vs = S.captions.filter((c) => c.role === 'value'), wsplit = vs.map((c) => c.text.split(' ')); let np = 0; while (wsplit.every((w) => w[np] === wsplit[0][np]) && np < wsplit[0].length - 1) np++;
const vstart = sec(vs[0].in), vend = sec(cap.command.in), words = wsplit.map((w) => w.slice(np).join(' ')), prefix = wsplit[0].slice(0, np).join(' ');
/* mountGfx's life() is 10 f in + dur + 8 f out, so dur = the span minus those 18 f (and 0.1 s of air before the command starts) */
const swapStack = mountGfx(document.getElementById('gfx'), [{ id: 'type.accentSwap', at: vstart, dur: vend - vstart - 0.1 - 18 / F, params: { prefix, words, steps: vs.map((c, i) => [sec(c.in) - vstart, i]), swap: 0.34, size: 96, at: [0.5, 0.4], color: L.ink, accent: L.accent, stack: true, lineGap: 1.3, weight: 600, accentWeight: 800, italic: false, rise: 0.4, blur: 12 } }], { W, H }); hf((t) => swapStack.render(t));

/* ---- 5. the ask: the command typed in an outlined pill (the outline draws on), then the address in its place; the pill goes as the address blurs in */
const pill = document.getElementById('pill'), rect = document.getElementById('pillrect'), cmd = part('command', { preset: 'typewriter', parent: pill, x: 0, y: 0, w: 0, size: 46, weight: 600, mono: true, color: L.mono, tracking: 0, lh: 1.2 });
cmd.el.style.position = 'relative'; cmd.el.style.width = 'auto'; cmd.el.style.left = cmd.el.style.top = 'auto'; cmd.el.style.whiteSpace = 'pre'; caret({ ...cmd, end: sec(cap.url.in) }, L.accent);
const pat = sec(cap.command.in); tl.fromTo(pill, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none', immediateRender: false }, pat - 0.12);
tl.fromTo(rect, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, pat - 0.1);
tl.to(pill, { opacity: 0, filter: 'blur(14px)', duration: SWAP, ease: 'power2.in' }, sec(cap.url.in) - 0.12);
hf(() => { const w = pill.offsetWidth, h = pill.offsetHeight; rect.setAttribute('width', Math.max(0, w - 3)); rect.setAttribute('height', Math.max(0, h - 3)); rect.setAttribute('rx', (h - 3) / 2); });
const url = box('url', { x: 90, y: 438, w: 900, size: 72, weight: 800, align: 'center' }), slash = cap.url.text.indexOf('/'), a = slash < 0 ? cap.url.text : cap.url.text.slice(0, slash), b = slash < 0 ? '' : cap.url.text.slice(slash);
url.innerHTML = '<span>' + a + '</span><span style="color:' + L.accent + ';font-weight:500">' + b + '</span>'; url.style.letterSpacing = '-0.03em';
tl.fromTo(url, { opacity: 0, filter: 'blur(24px)', scale: 1.04 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.6, ease: 'power3.out', immediateRender: true }, sec(cap.url.in));

/* ---- 6. the placeholder note, in frame, once the ribbon has gone (the quiet hold) */
const note = document.createElement('div'); note.className = 'cap'; Object.assign(note.style, { left: '0', width: W + 'px', top: '982px', textAlign: 'center', fontFamily: '"IBM Plex Mono", monospace', fontWeight: '600', fontSize: '22px', color: '#8D89A6', opacity: '0' }); note.textContent = D.note; document.getElementById('note').appendChild(note);
tl.fromTo(note, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none', immediateRender: false }, S.hold.start / F + 0.2);

tl.set({}, {}, T);
window.__timelines['main'] = tl;
/* canvas / DOM text measures with the fallback font until a face is in: load the faces up front and repaint the current frame once they land, so frame t is the same in every seek order */
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => { last = e.detail.time; });
Promise.all([...['300', '500', '600', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope')), document.fonts.load('600 24px "IBM Plex Mono"')]).then(() => window.dispatchEvent(new CustomEvent('hf-seek', { detail: { time: last } })));
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${plan.cues.length} cues, ${T}s, ${plan.story.sections.length} sections`, 'todo:', st.todo.join(' | ') || 'none');
