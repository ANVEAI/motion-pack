/* XP round 8 chips (type/gfx/chips.js): caption.soundOnPill and ui.stateChip. Node only (CI runs this): node type/tests/chips.test.mjs
   Both ids: registered; the same t twice gives the same string; shuffled seeks equal in-order seeks; the same frames in a second node process; '' before `at` and after the end;
   finite numbers over [-1, 10] s; renders at 16:9, 9:16, 1:1; stays inside the platform safe rect; its cues resolve in sfx/manifest.json; HOSTILE params (NaN, Infinity, megabyte strings,
   a million states, negative times) are clamped and every frame comes back in < 50 ms.
   soundOnPill: outline-only before solidAt (no fill element, outline drawn on frame 0), a frosted fill after it, gone at outAt (also a moved outAt with no `dur`), one pop cue on solidAt;
                text contrast >= 4.5:1 on its own fill composited over black and over white video, both themes (WCAG computed here, not taken from the module).
   stateChip:   on the frame before / on / after every flip the label and tone are the planned state; stateChipFlips matches the planned flip times; one cue per flip; the width morphs
                between the two label widths; the tick draws on after a flip into 'done'; text contrast >= 4.5:1 for every tone (defaults and a caller ink that would fail). */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { GFX, GFX_IDS, renderSVG, gfxCues, sfxFor, stateChipFlips, stateChipAt } from '../gfx/index.js';
import { safeRect } from '../safezones.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  | ' + info : ''}`); };
const rng = (() => { let a = 8; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const IDS = ['caption.soundOnPill', 'ui.stateChip'], FRAMES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] }, F1 = 1 / 30;
/* WCAG 2.x, independent of the module */
const rgb = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); }, hex = (v) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const L = (h) => { const v = rgb(h).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const A = L(a), B = L(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); }, comp = (fg, a, bg) => hex(rgb(fg).map((x, i) => x * a + rgb(bg)[i] * (1 - a)));
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
const tagOf = (svg, role) => { const m = svg.match(new RegExp(`<[a-z]+ [^>]*data-role="${role}"[^>]*>`)); return m ? attrs(m[0]) : null; };
const labelOf = (svg) => (svg.match(/<text data-role="label"[^>]*>([^<]*)<\/text>/) || [])[1] ?? null;

/* ============================ generic, both ids ============================ */
const ts = Array.from({ length: 111 }, (_, i) => -1 + i * 0.1), opts = { at: 0.5, params: {} };
for (const id of IDS) {
  check(`${id}: registered (GFX, GFX_IDS, file type/gfx/chips.js, default sound ${sfxFor(id)?.id})`, !!GFX[id] && GFX_IDS.includes(id) && GFX[id].file === 'type/gfx/chips.js' && okSfx(sfxFor(id).id));
  const a = renderSVG(id, 1.7, opts), b = renderSVG(id, 1.7, opts); check(`${id}: the same t twice gives the identical string`, a === b && a.length > 300);
  const fwd = ts.map((t) => renderSVG(id, t, opts)), shuf = new Map(shuffle(ts.map((_, i) => i)).map((i) => [i, renderSVG(id, ts[i], opts)]));
  check(`${id}: shuffled seek order equals in-order (${ts.length} frames)`, fwd.every((s, i) => s === shuf.get(i)));
  const h = crypto.createHash('sha256'); fwd.forEach((s) => h.update(s)); const mine = h.digest('hex');
  const child = execFileSync(process.execPath, ['--input-type=module', '-e', `import crypto from 'node:crypto'; import { renderSVG } from ${JSON.stringify(path.join(ROOT, 'type/gfx/index.js'))}; const h = crypto.createHash('sha256'); for (const t of ${JSON.stringify(ts)}) h.update(renderSVG(${JSON.stringify(id)}, t, { at: 0.5, params: {} })); process.stdout.write(h.digest('hex'));`]).toString();
  check(`${id}: the same frames in a second node process`, child === mine, mine.slice(0, 10));
  const bad = fwd.findIndex((s) => /NaN|undefined|Infinity|\[object/.test(s)); check(`${id}: finite numbers over [-1, 10] s`, bad < 0, bad >= 0 ? 't=' + ts[bad].toFixed(1) : '');
  check(`${id}: '' before at`, renderSVG(id, 0.49, opts) === '' && renderSVG(id, -1, opts) === '' && renderSVG(id, 0.5, opts) !== '');
  for (const [name, [W, H]] of Object.entries(FRAMES)) for (const platform of [null, 'reels', 'tiktok']) {
    const S = safeRect(platform || (W >= H ? 'wideTitle' : 'reels'), W, H), svg = renderSVG(id, 1.2, { at: 0 }, { W, H, platform }), r = tagOf(svg, id === 'ui.stateChip' ? 'chip-fill' : 'pill');
    const ok = r && +r.x >= S.x0 - 0.5 && +r.y >= S.y0 - 0.5 && +r.x + +r.width <= S.x1 + 0.5 && +r.y + +r.height <= S.y1 + 0.5;
    check(`${id}: ${name} ${platform || 'default'}: inside the safe rect`, !!ok, r ? `${r.x},${r.y} ${r.width}x${r.height} vs ${S.x0.toFixed(0)},${S.y0.toFixed(0)}..${S.x1.toFixed(0)},${S.y1.toFixed(0)}` : 'no rect'); }
  const s1 = +tagOf(renderSVG(id, 1.2, { at: 0 }, { W: 1080, H: 1920 }), 'label')['font-size'], s2 = +tagOf(renderSVG(id, 1.2, { at: 0 }, { W: 1920, H: 1080 }), 'label')['font-size'], s3 = +tagOf(renderSVG(id, 1.2, { at: 0, params: { scale: 1.5 } }), 'label')['font-size'];
  check(`${id}: sized from the shorter side (9:16 and 16:9 type ${s1} = ${s2} px); scale 1.5 -> ${s3} px`, s1 === s2 && Math.abs(s3 - s2 * 1.5) < 0.05);
}

/* ============================ caption.soundOnPill ============================ */
{ const id = 'caption.soundOnPill', P = (t, params = {}, f = {}) => renderSVG(id, t, { at: 0, params }, f);
  for (const solidAt of [0.5, 0.8]) { const before = [0, F1, solidAt / 2, solidAt - F1].map((t) => P(t, { solidAt })), after = [solidAt + F1, solidAt + 0.3, 1.2].map((t) => P(t, { solidAt }));
    check(`pill (solidAt ${solidAt}): outline only before solidAt (no fill element, outline fill="none", data-solid 0)`, before.every((s) => s && !/data-role="fill"/.test(s) && tagOf(s, 'pill').fill === 'none' && tagOf(s, 'sound-pill')['data-solid'] === '0'));
    check(`pill (solidAt ${solidAt}): frosted fill after solidAt (fill-opacity > 0.2 one frame later, the full 0.84 by 0.3 s, drop blur filter)`, after.every((s) => s && /data-role="fill"/.test(s) && /feGaussianBlur/.test(s)) && +tagOf(after[0], 'fill')['fill-opacity'] > 0.2 && Math.abs(+tagOf(after[1], 'fill')['fill-opacity'] - 0.84) < 1e-9); }
  const d0 = +tagOf(P(0), 'pill')['stroke-dasharray'].split(' ')[0], d1 = +tagOf(P(0.45), 'pill')['stroke-dasharray'].split(' ')[0];
  check(`pill: outline visible on frame 0 and drawing on (${d0}% -> ${d1}% of the perimeter)`, d0 > 0 && d1 > d0 && d1 === 100 && labelOf(P(0)) === 'Sound on');
  check('pill: gone at outAt (1.5 s): visible at 1.5 - 1 frame (fading), \'\' at 1.5 and after', P(1.5 - F1) !== '' && +tagOf(P(1.5 - F1), 'sound-pill').opacity < 0.5 && P(1.5) === '' && P(2) === '' && +tagOf(P(1.0), 'sound-pill').opacity === 1);
  check('pill: a later outAt (3.2 s) extends its life with no `dur` (durOf)', P(3.0, { outAt: 3.2 }) !== '' && P(3.2, { outAt: 3.2 }) === '' && renderSVG(id, 3.5, { at: 0.5, params: { outAt: 3.2 } }) !== '' && renderSVG(id, 3.7, { at: 0.5, params: { outAt: 3.2 } }) === '');
  check('pill: icon none drops the speaker; custom text prints', !/data-role="speaker"/.test(P(1, { icon: 'none' })) && /data-role="speaker"/.test(P(1)) && labelOf(P(1, { text: 'Turn sound on' })) === 'Turn sound on');
  const w0 = P(1, {}), w1 = P(1.2, {}); check('pill: the speaker waves pulse (pure of t)', [...w0.matchAll(/data-role="wave"[^>]*opacity="([\d.]+)"/g)].map((m) => m[1]).join() !== [...w1.matchAll(/data-role="wave"[^>]*opacity="([\d.]+)"/g)].map((m) => m[1]).join());
  const cues = gfxCues(id, { at: 2 }); check(`pill: one soft pop cue on solidAt (${JSON.stringify(cues)})`, cues.length === 1 && cues[0].t === 2.5 && cues[0].id === 'sfx/ui/pop' && cues[0].gain_db <= -6 && okSfx(cues[0].id) && gfxCues(id, { at: 0, params: { solidAt: 0.8 } })[0].t === 0.8);
  check('pill: y = 0.8 places it low, x = 0 clamps it inside the safe rect', +tagOf(P(1, { y: 0.8 }), 'pill').y > 700 && +tagOf(P(1, { x: 0 }), 'pill').x >= 96 - 0.5);
  for (const theme of ['dark', 'light']) { const s = P(1.0, { theme }), f = tagOf(s, 'fill'), ink = tagOf(s, 'label').fill, hi = +(s.match(/<stop offset="0" stop-color="#FFFFFF" stop-opacity="([\d.]+)"/) || [])[1];
    const rs = ['#000000', '#FFFFFF', '#808080'].flatMap((bg) => { const base = comp(f.fill, +f['fill-opacity'], bg); return [base, comp('#FFFFFF', hi, base)].map((x) => ratio(ink, x)); }), worst = Math.min(...rs);
    check(`pill ${theme}: text ${ink} on its own fill ${f.fill} @ ${f['fill-opacity']} (+ highlight ${hi}) over black / white / grey video: worst WCAG ${worst.toFixed(2)}:1 >= 4.5`, worst >= 4.5); }
}

/* ============================ ui.stateChip ============================ */
{ const id = 'ui.stateChip', PLAN = [{ t: 0, label: 'Draft', tone: 'before' }, { t: 1.2, label: 'Reviewing', tone: 'neutral', icon: 'eq' }, { t: 2.4, label: 'Checked', tone: 'done' }, { t: 3.6, label: 'Locked', tone: 'neutral', icon: 'lock' }];
  const at = 0.7, C = (u, params = { states: PLAN }) => renderSVG(id, at + u, { at, params });
  check(`stateChipFlips = the planned flips (${JSON.stringify(stateChipFlips({ states: PLAN }))}); unsorted input gives the same; default ${JSON.stringify(stateChipFlips({}))}`, JSON.stringify(stateChipFlips({ states: PLAN })) === '[1.2,2.4,3.6]' && JSON.stringify(stateChipFlips({ states: shuffle(PLAN) })) === '[1.2,2.4,3.6]' && JSON.stringify(stateChipFlips({})) === '[1.5]');
  const st = (s) => [tagOf(s, 'state-chip')?.['data-state'], tagOf(s, 'state-chip')?.['data-tone'], labelOf(s)];
  let bnd = []; PLAN.forEach((q, i) => { if (!i) return; const p = PLAN[i - 1], b = st(C(q.t - F1)), o = st(C(q.t)), a = st(C(q.t + F1)), g = stateChipAt({ states: PLAN }, q.t), g0 = stateChipAt({ states: PLAN }, q.t - F1);
    if (b.join() !== [i - 1, p.tone, p.label].join() || o.join() !== [i, q.tone, q.label].join() || a.join() !== [i, q.tone, q.label].join() || g.label !== q.label || g0.label !== p.label) bnd.push(`${q.t}: ${b} / ${o} / ${a}`); });
  check('stateChip: the frame before each flip shows the old state, the flip frame and the one after show the new state (label, tone, data-state, stateChipAt)', bnd.length === 0, bnd.join(' | '));
  check('stateChip: before the first state\'s t the chip shows the first state; a negative t is the opening state', labelOf(renderSVG(id, 1, { at: 0, params: { states: [{ t: 2, label: 'Later', tone: 'done' }, { t: 3, label: 'Last' }] } })) === 'Later' && labelOf(renderSVG(id, 0.2, { at: 0, params: { states: [{ t: -5, label: 'Open', tone: 'before' }, { t: 1, label: 'Shut' }] } })) === 'Open' && JSON.stringify(stateChipFlips({ states: [{ t: -5, label: 'Open' }, { t: 0, label: 'Zero' }, { t: 1, label: 'Shut' }] })) === '[1]');
  const wOf = (u) => +tagOf(C(u), 'chip-fill').width, wa = wOf(1.1), wm = wOf(1.2 + 0.08), wb = wOf(1.2 + 0.5);
  check(`stateChip: the width morphs between label widths (${wa.toFixed(1)} -> ${wm.toFixed(1)} -> ${wb.toFixed(1)}), the right edge stays on the safe rect`, wb > wa && wm > wa && wm < wb && Math.abs(+tagOf(C(1.25), 'chip-fill').x + +tagOf(C(1.25), 'chip-fill').width - 1824) < 0.01);
  const dash = (u) => +(tagOf(C(u), 'tick')?.['stroke-dasharray'] || '0').split(' ')[0];
  check(`stateChip: the tick draws on after the flip into done (${dash(2.4)} -> ${dash(2.55).toFixed(1)} -> ${dash(2.9)})`, dash(2.4) === 0 && dash(2.55) > 0 && dash(2.55) < 100 && dash(2.9) === 100);
  const fl = (u, params) => /data-role="flash"/.test(renderSVG(id, at + u, { at, params }));
  check('stateChip: a flash on each flip (not before it, gone after `flash` frames; flash 0 disables it)', fl(1.2 + F1, { states: PLAN }) && !fl(1.2 - F1, { states: PLAN }) && !fl(1.2 + 7 * F1, { states: PLAN }) && fl(1.2 + 9 * F1, { states: PLAN, flash: 12 }) && !fl(1.2 + F1, { states: PLAN, flash: 0 }));
  const cues = gfxCues(id, { at: 10, params: { states: PLAN } }); check(`stateChip: one cue per flip at at + flip (${cues.map((c) => c.t + ' ' + c.id).join(', ')}), toggle_on into done, all resolve`, cues.length === 3 && cues.map((c) => c.t).join() === '11.2,12.4,13.6' && cues[1].id === 'sfx/ui/toggle_on' && cues[0].id === 'sfx/ui/tick' && cues.every((c) => okSfx(c.id)));
  for (const corner of ['tl', 'tr', 'bl', 'br']) { const r = tagOf(renderSVG(id, 2, { at: 0, params: { corner } }, { W: 1080, H: 1920, platform: 'reels' }), 'chip-fill'), S = safeRect('reels', 1080, 1920);
    check(`stateChip ${corner} at 9:16 reels: in the ${corner} corner of the safe rect`, Math.abs((corner[1] === 'l' ? +r.x : +r.x + +r.width) - (corner[1] === 'l' ? S.x0 : S.x1)) < 0.01 && Math.abs((corner[0] === 't' ? +r.y : +r.y + +r.height) - (corner[0] === 't' ? S.y0 : S.y1)) < 0.01); }
  const end = 0.5 + 6 + 16 / 30; check(`stateChip: '' after its end (${end.toFixed(3)} s for the default), visible just before; a later last state extends it`, renderSVG(id, end - 0.01, { at: 0.5 }) !== '' && renderSVG(id, end + 0.001, { at: 0.5 }) === '' && renderSVG(id, 9.5, { at: 0, params: { states: [{ t: 0, label: 'A' }, { t: 8.5, label: 'B' }] } }) !== '');
  /* contrast: every tone, settled, defaults and a caller ink that would fail (white on cream) */
  const TONES = [['before', {}], ['done', {}], ['neutral', {}], ['before', { colors: { before: { ink: '#FFFFFF' } } }], ['done', { colors: { done: { fill: '#FFD400', ink: '#FFFFFF' } } }], ['neutral', { colors: { neutral: { fill: '#777777' } } }]];
  for (const [tone, extra] of TONES) { const s = renderSVG(id, 1, { at: 0, params: { states: [{ t: 0, label: 'Label', tone }], ...extra } }), f = tagOf(s, 'chip-fill').fill, ink = tagOf(s, 'label').fill, r = ratio(ink, f);
    check(`stateChip ${tone}${Object.keys(extra).length ? ' ' + JSON.stringify(extra.colors) : ''}: text ${ink} on ${f} = ${r.toFixed(2)}:1 >= 4.5`, r >= 4.5); }
  const s0 = renderSVG(id, 1, { at: 0, params: { states: [{ t: 0, label: 'Draft', tone: 'before' }] } }); check('stateChip: default tone colours (before amber #B45309 on #FFF7ED, done white on #4A18ED)', tagOf(s0, 'chip-fill').fill === '#FFF7ED' && tagOf(s0, 'label').fill === '#B45309' && tagOf(renderSVG(id, 3, { at: 0 }), 'chip-fill').fill === '#4A18ED' && tagOf(renderSVG(id, 3, { at: 0 }), 'label').fill === '#FFFFFF');
}

/* ============================ hostile params: clamped, fast ============================ */
{ const X = 'x'.repeat(1e6), big = Array.from({ length: 1e6 }, (_, i) => ({ t: (i * 7919) % 1000 - 500, label: i % 3 ? X : 'S' + i, tone: ['before', 'done', 'neutral', '__proto__'][i % 4], icon: ['tick', 'lock', 'eq', 'constructor'][i % 4] })), junk = [NaN, Infinity, -Infinity, -1, 0, 1e300, null, 'q', {}, [], true];
  const CASES = [['caption.soundOnPill', { text: X, solidAt: NaN, outAt: Infinity, x: NaN, y: Infinity, scale: 1e300, theme: {}, accent: 'red', icon: X }], ['caption.soundOnPill', { solidAt: -5, outAt: -5 }], ['caption.soundOnPill', { solidAt: 1e9, outAt: 1e9 }], ['caption.soundOnPill', { solidAt: 2, outAt: 1, text: '', scale: -1 }], ['caption.soundOnPill', { text: {}, platform: '__proto__' }],
    ['ui.stateChip', { states: big, flash: Infinity, scale: NaN, corner: X }], ['ui.stateChip', { states: junk }], ['ui.stateChip', { states: [] }], ['ui.stateChip', { states: X }], ['ui.stateChip', { states: junk.map((t) => ({ t, label: t, tone: t })), colors: { done: { fill: NaN, ink: X }, before: X }, flash: -9 }],
    ['ui.stateChip', { states: [{ t: -1e300, label: 'A' }, { t: 1e300, label: 'B' }], platform: 'nope' }]];
  const probs = []; let worst = 0, n = 0;
  for (const [id, params] of CASES) for (const t of [-1, 0, 0.3, 0.6, 1.4, 3.1, 30, 1e7]) { const t0 = performance.now(); let out = '', err = null; try { out = renderSVG(id, t, { at: 0, params }, { W: 1080, H: 1920 }); if (t === 0.6) gfxCues(id, { at: 0, params }); } catch (e) { err = e.message; } const ms = performance.now() - t0; worst = Math.max(worst, ms); n++;
    if (err || ms > 50 || out.length > 2e4 || /NaN|undefined|Infinity|\[object/.test(out)) probs.push(`${id} ${Object.keys(params)}@${t}: ${err || (ms > 50 ? ms.toFixed(1) + ' ms' : out.length > 2e4 ? out.length + ' B' : 'NaN in output')}`); }
  check(`hostile params: ${n} renders (NaN, Infinity, 1 MB strings, 1,000,000 states, negative times) neither throw nor exceed 50 ms (worst ${worst.toFixed(1)} ms) nor grow the output`, probs.length === 0, probs.slice(0, 3).join(' | '));
  const lab = labelOf(renderSVG('caption.soundOnPill', 1, { at: 0, params: { text: X } })); check(`hostile: a 1 MB text is cut to 40 chars (${lab?.length})`, lab && lab.length === 40);
  check('hostile: a million states keep at most 64 (stateChipFlips <= 63 flips)', stateChipFlips({ states: big }).length <= 63);
}

/* ============================ ids resolve (tools/check_ids.py on chips.js) ============================ */
{ const py = path.join(process.env.HOME || '', 'Developer/.venvs/motion-pack311/bin/python'), exe = fs.existsSync(py) ? py : 'python3';
  let out = '', ok = false; try { out = execFileSync(exe, [path.join(ROOT, 'tools/check_ids.py'), path.join(ROOT, 'type/gfx/chips.js')], { cwd: ROOT }).toString(); ok = /unresolved: 0/.test(out); } catch (e) { out = String(e.stdout || e.message); }
  check('every sfx id in chips.js resolves (tools/check_ids.py type/gfx/chips.js)', ok, out.trim().split('\n').at(-1)); }

console.log(`\nchips: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
