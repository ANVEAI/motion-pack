/* The xp-r78 gfx parts (type/gfx/glass.js, review.js, r78-type.js; lane xp-r78, 2026-10-16). Node only (CI runs this): node type/tests/r78.test.mjs
   Every id: registered with its file, non-empty at its hero time at 16:9 and 9:16, empty before `at`, the same SVG twice and in forward and shuffled seek order, no NaN over [-1, 8] s,
   every url(#id) resolves, its cues and default sound resolve in sfx/manifest.json, and hostile params neither throw nor grow the output without bound. Behaviour:
     glassPanel          blur / tint / edge are the closed-form state (glassState) and the markup carries exactly that blur; blurIn 0 -> full; the exit fades it; mode follows `plate`;
                         no opacity group wraps the backdrop element; the grain seed is a function of floor(t * grainFps); an unsafe plate href is never written
     rimLight            the head angle is turns * 2 pi * ease(...) from the chosen corner; the stroke widths do not change while the angle does; the perimeter walk is continuous;
                         the hot core clears 4.5:1 on the field (and a too-dark colour is flagged); the rim stays lit once the sweep is done
     reviewLayer         the record clock is floor(t - at) in any order, frozen at dur; flag cursors sit on their track; pins appear on their own frame; the placeholder note is on whenever
                         anything is
     approvalSlider      the state machine pending > sliding > approving > approved flips on exactly approvedAt; data-state in the markup is the state; the thumb never moves back
     sentenceAcrossShots the word changes on exactly the cut frame; the slot does not move; carry keeps earlier words where they were; cuts are cleaned; short shots are linted */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { GFX, renderSVG, renderInner, gfxCues, sfxFor, glassState, rimState, rimIntensity, rimContrast, perimeterAt, perimeterLen, recordClock, approvalState, approvalTimes, sentenceState, sentenceCuts, sentenceEnd, sentenceLint } from '../gfx/index.js';
import { ctxFor } from '../gfx/core.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? '  | ' + info : ''}`); };
const IDS = ['ui.glassPanel', 'ui.rimLight', 'ui.reviewLayer', 'ui.approvalSlider', 'type.sentenceAcrossShots'];
const HERO = { 'ui.glassPanel': 1.6, 'ui.rimLight': 1.0, 'ui.reviewLayer': 3.6, 'ui.approvalSlider': 3.4, 'type.sentenceAcrossShots': 1.9 };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), sndOk = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const rng = (() => { let a = 78; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const texts = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e, TAU = Math.PI * 2, c16 = ctxFor(1920, 1080, null, 1);

/* ---------- every id: contract ---------- */
for (const id of IDS) {
  const g = GFX[id]; if (!g) { check(`${id}: registered`, false); continue; }
  check(`${id}: registered from its file`, /type\/gfx\/(glass|review|r78-type)\.js$/.test(g.file || ''), g.file);
  const wide = renderSVG(id, HERO[id], { at: 0 }, { W: 1920, H: 1080 }), tall = renderSVG(id, HERO[id], { at: 0 }, { W: 1080, H: 1920 });
  check(`${id}: draws at 16:9 and 9:16 at its hero time`, wide.length > 300 && tall.length > 300, `${wide.length} / ${tall.length}`);
  check(`${id}: empty before at`, renderSVG(id, 0.5, { at: 2 }, { W: 1920, H: 1080 }) === '');
  const ts = Array.from({ length: 37 }, (_, i) => -1 + i * 0.25), fwd = ts.map((t) => renderSVG(id, t, { at: 0 })), shf = new Map(shuffle(ts).map((t) => [t, renderSVG(id, t, { at: 0 })]));
  check(`${id}: same SVG in forward and shuffled seek order, and twice`, ts.every((t, i) => fwd[i] === shf.get(t)) && renderSVG(id, HERO[id], { at: 0 }) === renderSVG(id, HERO[id], { at: 0 }));
  check(`${id}: no NaN or Infinity over [-1, 8] s`, fwd.every((s) => !/NaN|Infinity|undefined/.test(s)));
  const ids = new Set([...wide.matchAll(/(?<![\w-])id="([^"]+)"/g)].map((m) => m[1])), refs = [...wide.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  check(`${id}: every url(#id) resolves`, refs.every((r) => ids.has(r)), refs.filter((r) => !ids.has(r)).join(' '));
  const cues = gfxCues(id, { at: 0 }), def = sfxFor(id);
  check(`${id}: cues and the default sound resolve in sfx/manifest.json`, cues.length > 0 && cues.every((q) => sndOk(q.id) && Number.isFinite(q.t) && q.t >= 0) && def && sndOk(def.id), cues.filter((q) => !sndOk(q.id)).map((q) => q.id).join(' '));
  let threw = '', big = 0; for (const hostile of [{ box: [NaN, -1, 1e9, 0] }, { size: 0 }, { size: -3 }, { radius: 1e9 }, { words: Array(5000).fill('w'), cuts: Array(5000).fill(1), flags: Array(5000).fill({ name: 'x'.repeat(1e5) }), pins: Array(5000).fill({ text: 'y'.repeat(1e5) }), items: Array(5000).fill('z') }, { blur: 1e9, segments: 1e9, skeleton: 1e9, sweep: [NaN, Infinity, 1e9], slideDur: -5, workDur: 1e9, plate: { href: 'javascript:alert(1)', colors: Array(1000).fill('#fff') } }, { label: null, source: {}, track: 'x', record: 5, slider: 'q' }]) {
    try { for (const t of [0.1, 1, 3, 9]) big = Math.max(big, renderSVG(id, t, { at: 0, params: hostile }).length); } catch (e) { threw = e.message; } }
  check(`${id}: hostile params neither throw nor blow up the output`, !threw && big < 3e6, threw || `${big} chars`);
}

/* ---------- glassPanel ---------- */
{ const bl = (svg) => { const m = /backdrop-filter:blur\(([\d.]+)px\)/.exec(svg); return m ? +m[1] : 0; }, P = { blurIn: [0.5, 1.5], blur: 20 };
  const st = [0.4, 0.5, 1.0, 1.5, 2.0].map((u) => glassState(P, u));
  check('glassPanel: blurIn [0.5, 1.5] resolves the blur from 0 (at 0.5 s) to the full radius (at 1.5 s), monotonically', st[0].blur === 0 && st[1].blur === 0 && near(st[3].blur, 20, 1e-6) && st[2].blur > 0 && st[2].blur < 20 && st[4].blur === st[3].blur);
  check('glassPanel: the backdrop-filter blur in the markup is the closed-form blur (times the type scale) at every sampled t', [0.7, 1.0, 1.3, 2.2, 2.6].every((u) => Math.abs(bl(renderSVG('ui.glassPanel', u, { at: 0, params: P })) - glassState(P, u).blur) < 0.02), [0.7, 1.0, 1.3].map((u) => bl(renderSVG('ui.glassPanel', u, { at: 0, params: P }))).join(' '));
  check('glassPanel: the tint alpha follows the same ramp (more tint as the glass resolves)', glassState(P, 0.5).tintA < glassState(P, 1.0).tintA && glassState(P, 1.0).tintA < glassState(P, 1.5).tintA);
  const en = glassState(P, 2.0, 1), e0 = glassState(P, 2.0, 0); check('glassPanel: the exit takes blur, tint, edge and grain to 0 (no group opacity: the backdrop must stay visible to the filter)', en.blur === 0 && en.tintA === 0 && en.edgeA === 0 && e0.blur > 0);
  const svg = renderSVG('ui.glassPanel', 1.6, { at: 0 }); const fo = svg.indexOf('<foreignObject'); const opened = (svg.slice(0, fo).match(/<g\b[^>]*opacity=/g) || []).length - (svg.slice(0, fo).match(/<\/g>/g) || []).length;
  check('glassPanel: the foreignObject (the backdrop element) sits under no opacity group', fo > 0 && opened <= 0 && !/<g[^>]*(filter|opacity|mix-blend-mode)[^>]*><foreignObject/.test(svg));
  check('glassPanel: mode follows `plate` (auto), and an explicit mode wins', /<foreignObject/.test(svg) && !/<foreignObject/.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { plate: { colors: ['#112233', '#445566'] } } })) && /<foreignObject/.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { plate: { colors: ['#112233', '#445566'] }, mode: 'backdrop' } })) && !/<foreignObject/.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { mode: 'plate' } })));
  const seed = (u, p) => /feTurbulence[^>]*seed="(\d+)"/.exec(renderSVG('ui.glassPanel', u, { at: 0, params: p }))?.[1];
  check('glassPanel: the grain seed is a function of floor(t * grainFps): equal inside a grain frame, different across, fixed at grainFps 0', seed(2.0, { grainFps: 8 }) === seed(2.1, { grainFps: 8 }) && seed(2.0, { grainFps: 8 }) !== seed(2.2, { grainFps: 8 }) && seed(2.0, { grainFps: 0 }) === seed(2.9, { grainFps: 0 }));
  check('glassPanel: a javascript: / script plate href is never written; a data:image or a relative image path is', !/javascript:/i.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { plate: { href: 'javascript:alert(1)' } } })) && /<image href="data:image\/png;base64,AAAA"/.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { plate: { href: 'data:image/png;base64,AAAA' } } })) && /<image href="plates\/a\.jpg"/.test(renderSVG('ui.glassPanel', 1.6, { at: 0, params: { plate: { href: 'plates/a.jpg' } } })));
  check('glassPanel: the default frame prints no digit and no text (skeleton bars are shapes)', texts(renderSVG('ui.glassPanel', 2, { at: 0 })).length === 0);
}

/* ---------- rimLight ---------- */
{ const P = { box: [0.3, 0.26, 0.4, 0.48], sweep: [0.5, 2.5, 2], corner: 'tr' }, w = 768, h = 518.4, a0 = Math.atan2(-h, w);
  const s0 = rimState(P, 0.5, { w, h }), s1 = rimState(P, 2.5, { w, h }), sm = rimState(P, 1.5, { w, h });
  check('rimLight: the head starts at the chosen corner (angle of the top-right corner) and ends turns * 2 pi later', near(s0.head, a0, 1e-9) && near(s1.head - s0.head, 2 * TAU, 1e-9));
  check('rimLight: halfway through the sweep the eased angle is half the travel (symmetric ease)', near(sm.head - s0.head, TAU, 1e-6), String(sm.head - s0.head));
  const heads = Array.from({ length: 41 }, (_, i) => rimState(P, 0.5 + i * 0.05, { w, h }).head); check('rimLight: the head only ever moves forward (clockwise)', heads.every((v, i) => !i || v >= heads[i - 1] - 1e-12));
  const widthsAt = (t) => new Set([...renderSVG('ui.rimLight', t, { at: 0, params: P }).matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]));
  const W0 = widthsAt(0.9), allSame = [0.7, 1.1, 1.6, 2.2, 2.9, 3.3].every((t) => { const W = widthsAt(t); return [...W].every((x) => W0.has(x)); });
  check('rimLight: the stroke widths are the same set at every t (the rim width in px is constant while the angle changes)', allSame && W0.size <= 3, [...W0].join(' '));
  const wide = [...renderSVG('ui.rimLight', 1.6, { at: 0, params: { ...P, width: 6 } }).matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]).sort((a, b) => a - b), thin = [...renderSVG('ui.rimLight', 1.6, { at: 0, params: { ...P, width: 3 } }).matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]).sort((a, b) => a - b);
  check('rimLight: `width` is the rim width in px (doubling it doubles every stroke)', near(wide.at(-1), 2 * thin.at(-1), 0.02) && near(wide[0], 2 * thin[0], 0.02));
  { const x = 100, y = 100, W = 400, H = 260, r = 50, per = perimeterLen(W, H, r), N = 400, pts = Array.from({ length: N + 1 }, (_, i) => perimeterAt(x, y, W, H, r, (i / N) * per)); let maxStep = 0, len = 0; for (let i = 1; i <= N; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); maxStep = Math.max(maxStep, d); len += d; }
    check('rimLight: the perimeter walk is continuous, closes on itself and its length is the measured one (to the chord error of 400 steps)', maxStep <= (per / N) * 1.0001 && near(pts[0][0], pts[N][0], 1e-6) && near(pts[0][1], pts[N][1], 1e-6) && Math.abs(len - per) / per < 5e-4, `${maxStep} ${per / N} ${len} ${per}`); }
  check('rimLight: the intensity peaks on the head, falls behind it and is 0 well ahead of it', rimIntensity(1, 1, 0.3) === 1 && rimIntensity(0.5, 1, 0.3) < 1 && rimIntensity(0.5, 1, 0.3) > 0 && rimIntensity(1 + 1, 1, 0.3) === 0 && rimIntensity(1 - 0.3 * TAU - 0.01, 1, 0.3) === 0);
  check('rimLight: the default hot core is at least 4.5:1 on the dark field (WCAG), and a light field is reported below it', rimContrast({}) >= 4.5 && rimContrast({ field: '#F5F5F5' }) < 4.5 && rimContrast({ field: '#F5F5F5' }) < rimContrast({}), `${rimContrast({}).toFixed(2)} / ${rimContrast({ field: '#F5F5F5' }).toFixed(2)}`);
  const before = renderSVG('ui.rimLight', 0.1, { at: 0, params: P }), after = renderSVG('ui.rimLight', 3.3, { at: 0, params: P }), rimPaths = (s) => (s.match(/<path d="M[^"]*L[^"]*" fill="none" stroke=/g) || []).length;
  check('rimLight: before the sweep only the window body shows (no rim runs); after it the resting rim stays lit all round at the resting alpha (one run, stroke-opacity = rest)', rimPaths(before) === 0 && rimPaths(after) === 1 && /stroke-opacity="0.4"/.test(after));
}

/* ---------- reviewLayer ---------- */
{ const P = { record: { at: 1, dur: 3 } }, rc = (u) => recordClock(P, u);
  check('reviewLayer: the record clock is floor(u - at): 00:00 at the start, 00:01 at +1, 00:02 at +2.99, 00:03 at +3 and frozen at dur after that', rc(1).text === '00:00' && rc(1.999).text === '00:00' && rc(2).text === '00:01' && rc(3.99).text === '00:02' && rc(4).text === '00:03' && rc(4.4).text === '00:03' && !rc(5).on && !rc(0.5).on);
  const ts = [1.2, 2.2, 3.2, 4.2, 1.7, 3.7], a = ts.map((t) => texts(renderSVG('ui.reviewLayer', t, { at: 0, params: P })).filter((s) => /^\d\d:\d\d$/.test(s))[0]), b = shuffle(ts).map((t) => [t, texts(renderSVG('ui.reviewLayer', t, { at: 0, params: P })).filter((s) => /^\d\d:\d\d$/.test(s))[0]]);
  check('reviewLayer: the clock digits for the same t are the same in any seek order', ts.every((t, i) => a[i] === b.find((q) => q[0] === t)[1]) && a.join(',') === '00:00,00:01,00:02,00:03,00:00,00:02', a.join(','));
  const track = [[0, 0.1, 0.2], [2, 0.6, 0.4]], F = { flags: [{ name: 'Maya Rao', track, at: 0 }], pins: [], record: { at: 99, dur: 3 }, slider: { at: 99 } }, cur = (t) => { const m = /<path d="M([\d.]+) ([\d.]+)L/.exec(renderSVG('ui.reviewLayer', t, { at: 0, params: F })); return m ? [+m[1] / 1920, +m[2] / 1080] : null; };
  const c1 = cur(1), c2 = cur(2.5); check('reviewLayer: a flag cursor sits on its track once it has flown in (half-way and at the end key, in frame fractions)', c1 && c2 && near(c1[0], 0.35, 0.01) && near(c1[1], 0.3, 0.01) && near(c2[0], 0.6, 0.01) && near(c2[1], 0.4, 0.01), JSON.stringify([c1, c2]));
  const pinOn = (t, i) => texts(renderSVG('ui.reviewLayer', t, { at: 0 })).some((s) => s === ['Can this button be', 'Love the new spacing', 'Placeholder copy:'][i].slice(0, 12) || s.startsWith(['Can this', 'Love the', 'Placeholder'][i]));
  check('reviewLayer: each pin pops on its own time (absent just before, present just after)', [[0.85, 0.95, 0], [1.45, 1.6, 1], [2.05, 2.2, 2]].every(([b, a, i]) => !pinOn(b, i) && pinOn(a, i)));
  const note = (t) => texts(renderSVG('ui.reviewLayer', t, { at: 0 })).some((s) => /placeholder/i.test(s)); check('reviewLayer: the placeholder note is printed on every visible frame (names and comments are fictional)', [0.2, 1, 2, 3.5, 4.8].every(note) && !texts(renderSVG('ui.reviewLayer', 3, { at: 0, params: { note: '' } })).some((s) => /placeholder names/i.test(s)));
  check('reviewLayer: the slider card prints its prompt and both end labels once it has landed, none before', texts(renderSVG('ui.reviewLayer', 3.6, { at: 0 })).includes('Unclear') && !texts(renderSVG('ui.reviewLayer', 2.9, { at: 0 })).includes('Unclear'));
}

/* ---------- approvalSlider ---------- */
{ const P = { slideAt: 1, slideDur: 1, workDur: 0.8 }, T = approvalTimes(P), st = (u) => approvalState(P, u).state;
  check('approvalSlider: times are slide start, slide end and the flip (= approvedAt)', near(T.slideStart, 1) && near(T.slideEnd, 2) && near(T.approvedAt, 2.8));
  check('approvalSlider: pending before the slide, sliding during it, approving while it works, approved ON approvedAt and after (the flip frame is exact)', st(0) === 'pending' && st(0.999) === 'pending' && st(1.5) === 'sliding' && st(2.2) === 'approving' && st(2.8 - 1e-6) === 'approving' && st(2.8) === 'approved' && st(9) === 'approved');
  check('approvalSlider: outcome declined flips to declined, not approved', approvalState({ ...P, outcome: 'declined' }, 3).state === 'declined' && approvalState({ ...P, outcome: 'declined' }, 3).glow === 0);
  const ts = Array.from({ length: 60 }, (_, i) => i * 0.06), th = ts.map((t) => approvalState(P, t).thumb); check('approvalSlider: the thumb goes 0 -> 1 and never back', th[0] === 0 && th.at(-1) === 1 && th.every((v, i) => !i || v >= th[i - 1] - 1e-12));
  check('approvalSlider: data-state in the markup is the state at every sampled t', ts.every((t) => { const m = /data-state="(\w+)"/.exec(renderSVG('ui.approvalSlider', t, { at: 0, params: P })); return m && m[1] === st(t); }));
  check('approvalSlider: the glow decays after the flip (bright at the flip, much less 2 s later), none before', approvalState(P, 2.8).glow > 0.99 && approvalState(P, 4.8).glow < 0.05 && approvalState(P, 2.5).glow === 0);
  const cs = gfxCues('ui.approvalSlider', { at: 10, params: P }); check('approvalSlider: the cue sheet puts sfx/ui/success_chime on the flip frame (at + approvedAt) and a lift on the grab', cs.some((q) => q.id === 'sfx/ui/success_chime' && near(q.t, 10 + T.approvedAt)) && cs.some((q) => q.id === 'sfx/ui/drag_lift' && near(q.t, 11)));
  check('approvalSlider: the default frame says prototype and describes an example request (no shipping product, no digit)', texts(renderSVG('ui.approvalSlider', 1, { at: 0 })).some((s) => /prototype/i.test(s)) && !texts(renderSVG('ui.approvalSlider', 3.5, { at: 0 })).some((s) => /\d/.test(s)));
}

/* ---------- sentenceAcrossShots ---------- */
{ const P = { words: ['One', 'two', 'three'], cuts: [0, 0.5, 1.0], carry: 0, hold: 1 }, wordsAt = (u, p = P) => texts(renderSVG('type.sentenceAcrossShots', u, { at: 0, dur: 5, params: p }));
  check('sentenceAcrossShots: the word changes on exactly the cut frame (the frame before shows the previous word)', wordsAt(0.4999)[0] === 'One' && wordsAt(0.5)[0] === 'two' && wordsAt(0.9999)[0] === 'two' && wordsAt(1.0)[0] === 'three' && wordsAt(1.9)[0] === 'three');
  const xs = (u, p = P) => [...renderSVG('type.sentenceAcrossShots', u, { at: 0, dur: 5, params: p }).matchAll(/<text x="([\d.]+)"/g)].map((m) => +m[1]);
  check('sentenceAcrossShots: the slot does not move (carry 0: every word is centred on the same x, whatever the plate does)', near(xs(0.2)[0], 960, 0.01) && near(xs(0.7)[0], 960, 0.01) && near(xs(1.2)[0], 960, 0.01));
  { const C = { ...P, carry: 0.5 }; const lay = (u) => { const r = []; for (const m of renderSVG('type.sentenceAcrossShots', u, { at: 0, dur: 5, params: C }).matchAll(/<text x="([\d.]+)"[^>]*>([^<]*)</g)) r.push([m[2], +m[1]]); return r; }; const a = lay(1.2), b = lay(1.9);
    check('sentenceAcrossShots: with carry the words are laid out from the whole sentence, so a word never moves when the next lands (same x at 1.2 s and 1.9 s)', a.length === 3 && a.every(([w, x], i) => b[i][0] === w && near(b[i][1], x, 1e-9))); }
  check('sentenceAcrossShots: a repeat or a step back in `cuts` is dropped, and there is at most one cut per word', JSON.stringify(sentenceCuts({ words: ['a', 'b', 'c'], cuts: [0, 1, 1, 0.5, 2, 3, 4] })) === '[0,1,2]' && sentenceCuts({ words: ['a'], cuts: [0, 1, 2] }).length === 1);
  check('sentenceAcrossShots: lint reports a shot under the reading floor and a word with no cut', sentenceLint({ words: ['a', 'b', 'c'], cuts: [0, 0.1, 1], hold: 1 }).some((q) => q.word === 'a') && sentenceLint({ words: ['a', 'b', 'c'], cuts: [0, 1] }).some((q) => q.word === 'c' && /no cut/.test(q.why)) && sentenceLint(P).length === 0);
  const cu = gfxCues('type.sentenceAcrossShots', { at: 4, params: P }); check('sentenceAcrossShots: one sfx/tx/cut_tick per cut, on the cut frame (at + cut)', cu.length === 3 && cu.every((q, i) => q.id === 'sfx/tx/cut_tick' && near(q.t, 4 + [0, 0.5, 1][i])));
  check('sentenceAcrossShots: the part is on from the first cut to the end (sentenceEnd = last cut + hold) and not before', sentenceEnd(P) === 2 && wordsAt(-0.1).length === 0 && wordsAt(1.99).length === 1 && sentenceState(P, 1.2).i === 2 && sentenceState(P, -1).i === -1);
}

/* ---------- two fresh processes give the same bytes ---------- */
{ const code = `import { renderSVG } from '${path.join(ROOT, 'type/gfx/index.js')}'; import crypto from 'node:crypto'; const ids = ${JSON.stringify(IDS)}, out = []; for (const id of ids) for (const t of [0.3, 1.1, 2.4, 3.7]) out.push(renderSVG(id, t, { at: 0 })); console.log(crypto.createHash('sha256').update(out.join('|')).digest('hex'));`;
  const run = () => execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }).trim(), a = run(), b = run();
  check('all five parts draw the same bytes in two fresh processes', a === b && a.length === 64, `${a} ${b}`); }

console.log(`\nr78 gfx: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
