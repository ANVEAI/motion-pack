/* the SaaS launch / product-demo kit (type/gfx/ui-saas.js, ui-saas2.js; lane xp-saas, 2026-10-16). Node only (CI runs this): node type/tests/saas.test.mjs
   Every id: registered with its file, non-empty at its hero time at 16:9 and 9:16, empty before `at`, the same SVG twice and in forward and shuffled seek order, no NaN over [-1, 8] s,
   well-formed defs (every url(#id) resolves), its cues and default sound resolve in sfx/manifest.json, and hostile params (NaN, 0, negative, 1e9, strings, null, huge arrays) neither throw nor
   grow the output without bound. Behaviour:
     appWindow     the screen always covers the content rect (cover fit, any zoom key, any ken-burns); a zoom rect's centre lands on the content centre when nothing clamps; map() follows the
                   window's own entrance; `move` keys move the box on the panel spring; the default frame prints the placeholder label
     cursorJourney the cursor sits on each key at its time; a click presses; a drag holds the press and carries the chip; a screen element eased with cursorLeg + the 'cam' curve
                   (templates/_shared/saas/screens.mjs stateAt) stays exactly under a straight drag; `win` puts the path in the window's screen space through its zoom
     commandBar    the list filters to the typed query; the selection row moves; the panel closes after enter
     aiAnswer      the answer streams word by word (more words later, never fewer) and the Apply button turns into Applied after its click
     shortcutChip  keys press in sequence (the pressed key takes the accent fill)
     honesty       prices print "placeholder data", dashboard figures print "demo data", the integration grid prints "placeholder marks", no glyph is a real product mark */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, renderSVG, renderInner, gfxCues, sfxFor, appWindowGeo, cursorAt, cursorLeg, answerTimes, GLYPHS } from '../gfx/index.js';
import { ctxFor } from '../gfx/core.js';
import { stateAt } from '../../templates/_shared/saas/screens.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? '  | ' + info : ''}`); };
const IDS = ['ui.appWindow', 'ui.cursorJourney', 'callout.highlightBox', 'callout.arrowLabel', 'ui.commandBar', 'ui.aiAnswer', 'ui.shortcutChip', 'ui.pricingCards', 'ui.integrationGrid', 'ui.beforeAfterSplit', 'ui.notifyStack', 'ui.dashboardAssemble', 'device.mock'];
const HERO = { 'ui.appWindow': 1.5, 'ui.cursorJourney': 1.2, 'callout.highlightBox': 1, 'callout.arrowLabel': 1, 'ui.commandBar': 1.2, 'ui.aiAnswer': 4.5, 'ui.shortcutChip': 0.7, 'ui.pricingCards': 1.8, 'ui.integrationGrid': 2, 'ui.beforeAfterSplit': 1.5, 'ui.notifyStack': 2, 'ui.dashboardAssemble': 2.5, 'device.mock': 2 };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), sndOk = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const rng = (() => { let a = 16; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const texts = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));

/* ---------- every id: contract ---------- */
for (const id of IDS) {
  const g = GFX[id]; if (!g) { check(`${id}: registered`, false); continue; }
  check(`${id}: registered from its file`, /ui-saas2?\.js$/.test(g.file || ''), g.file);
  const wide = renderSVG(id, HERO[id], { at: 0 }, { W: 1920, H: 1080 }), tall = renderSVG(id, HERO[id], { at: 0 }, { W: 1080, H: 1920 });
  check(`${id}: draws at 16:9 and 9:16 at its hero time`, wide.length > 400 && tall.length > 400, `${wide.length} / ${tall.length}`);
  check(`${id}: empty before at`, renderSVG(id, 0.5, { at: 2 }, { W: 1920, H: 1080 }) === '');
  const ts = Array.from({ length: 37 }, (_, i) => -1 + i * 0.25), fwd = ts.map((t) => renderSVG(id, t, { at: 0 })), shf = new Map(shuffle(ts).map((t) => [t, renderSVG(id, t, { at: 0 })]));
  check(`${id}: same SVG in forward and shuffled seek order, and twice`, ts.every((t, i) => fwd[i] === shf.get(t)) && renderSVG(id, HERO[id], { at: 0 }) === renderSVG(id, HERO[id], { at: 0 }));
  check(`${id}: no NaN or Infinity over [-1, 8] s`, fwd.every((s) => !/NaN|Infinity/.test(s)));
  const ids = new Set([...wide.matchAll(/(?<![\w-])id="([^"]+)"/g)].map((m) => m[1])), refs = [...wide.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  check(`${id}: every url(#id) resolves`, refs.every((r) => ids.has(r)), refs.filter((r) => !ids.has(r)).join(' '));
  const cues = gfxCues(id, { at: 0 }), def = sfxFor(id);
  check(`${id}: cues and the default sound resolve in sfx/manifest.json`, cues.length > 0 && cues.every((c) => sndOk(c.id) && Number.isFinite(c.t)) && def && sndOk(def.id), cues.filter((c) => !sndOk(c.id)).map((c) => c.id).join(' '));
  let threw = '', big = 0; for (const hostile of [{ box: [NaN, -1, 1e9, 0] }, { scale: 0 }, { scale: -3 }, { path: 'x', items: null, plans: 7, glyphs: Array(5000).fill('cloud'), cards: Array(5000).fill({ kind: 'kpi' }), keys: Array(500).fill('K'), zoom: Array(5000).fill({ t: 1, rect: [0, 0, 0, 0] }) }, { text: 'x'.repeat(5000), prompt: 'y '.repeat(3000), answer: ['z '.repeat(3000)], cps: Infinity, wps: 0 }])
    try { for (const t of [0.1, 1, 3, 9]) big = Math.max(big, renderSVG(id, t, { at: 0, params: hostile }).length); } catch (e) { threw = e.message; }
  check(`${id}: hostile params neither throw nor blow up the output`, !threw && big < 3e6, threw || `${big} chars`);
}

/* ---------- appWindow geometry ---------- */
const c = ctxFor(1920, 1080, 'wideTitle', 1), cT = ctxFor(1080, 1920, 'conservative', 1), covers = (G) => { const [x, y, w, h] = G.content, M = G.M; return M.X <= x + 1e-6 && M.Y <= y + 1e-6 && M.X + M.A * M.sw >= x + w - 1e-6 && M.Y + M.A * M.sh >= y + h - 1e-6; };
{ let ok = true; for (const [cc, box] of [[c, [0.1, 0.1, 0.8, 0.8]], [cT, [0.03, 0.3, 0.94, 0.5]], [c, [0.5, 0.2, 0.2, 0.6]]]) for (const zoom of [[], [{ t: 0.5, rect: [0, 0, 0.2, 0.2] }], [{ t: 0.2, rect: [0.9, 0.9, 0.5, 0.5] }, { t: 1, rect: null }]]) for (const kb of [[1, 1], [0.6, 1.4]]) for (const u of [0, 0.3, 0.8, 2, 5]) if (!covers(appWindowGeo({ box, zoom, kb }, cc, u, 4))) ok = false;
  check('appWindow: the screen covers the content rect for every box, zoom key, ken-burns and time', ok); }
{ const G = appWindowGeo({ box: [0.1, 0.1, 0.8, 0.8], zoom: [{ t: 0, rect: [0.3, 0.3, 0.3, 0.3] }], enter: 'none' }, c, 30, 40), [x, y, w, h] = G.content, [mx, my] = G.M.map(0.45, 0.45);
  check('appWindow: a zoom rect lands centred in the content rect (after the camera spring settles)', Math.abs(mx - (x + w / 2)) < 0.5 && Math.abs(my - (y + h / 2)) < 0.5, `${mx} ${my} vs ${x + w / 2} ${y + h / 2}`); }
{ const G0 = appWindowGeo({ box: [0.1, 0.1, 0.8, 0.8] }, c, 0.05), G1 = appWindowGeo({ box: [0.1, 0.1, 0.8, 0.8] }, c, 3), a = G0.map(0, 0), b = G1.map(0, 0);
  check('appWindow: map() follows the entrance (lower and smaller at the start, settled later)', a[1] > b[1] + 5, `${a} vs ${b}`); }
{ const p = { box: [0.1, 0.1, 0.4, 0.4], move: [{ t: 1, box: [0.5, 0.5, 0.4, 0.4] }], enter: 'none' }, b0 = appWindowGeo(p, c, 0.5).box, b1 = appWindowGeo(p, c, 9).box;
  check('appWindow: move keys move the box (before the key: box; long after: the key box)', Math.abs(b0[0] - 192) < 1e-6 && Math.abs(b1[0] - 960) < 0.5, `${b0} ${b1}`); }
check('appWindow: the default frame prints the placeholder label', texts(renderSVG('ui.appWindow', 1.5, { at: 0 })).some((s) => /placeholder UI/.test(s)));

/* ---------- cursor journey ---------- */
{ const p = { ...GFX['ui.cursorJourney'].d }, P = p.path; let ok = true; for (const k of P) { const s = cursorAt(p, k.t); if (Math.abs(s.x - k.x) > 1e-9 || Math.abs(s.y - k.y) > 1e-9) ok = false; }
  check('cursor: sits on each key at its time', ok);
  check('cursor: a click presses (press > 0.3 just after the click, 0 long before)', Math.max(...[0.02, 0.05, 0.08, 0.11, 0.14].map((d) => cursorAt(p, P[1].t + d).press)) > 0.3 && cursorAt(p, 0.05).press < 1e-6);
  const dn = P.find((k) => k.down); check('cursor: a drag holds the press and carries the chip', cursorAt(p, dn.t + 0.4).drag === dn && renderSVG('ui.cursorJourney', dn.t + 0.4, { at: 0 }).includes('>Step<')); }
{ const path_ = [{ t: 0.2, x: 0.6, y: 0.57 }, { t: 0.5, x: 0.6, y: 0.57, down: true }, { t: 1.5, x: 0.3, y: 0.7, up: true, arc: 0 }], p = { path: path_ }, lg = cursorLeg(p, 2), keys = [[0, { swap: 0 }], [lg[0], { swap: 1 }, lg[1] - lg[0], 'cam']];
  let worst = 0; for (let u = lg[0]; u <= lg[1]; u += 0.01) { const cu = cursorAt(p, u), k = (cu.x - 0.6) / (0.3 - 0.6), sw = stateAt(keys, u).swap; worst = Math.max(worst, Math.abs(k - sw)); }
  check('cursor: a screen element eased with cursorLeg + the cam curve stays under a straight drag (|dk| < 1e-6)', worst < 1e-6, String(worst)); }
{ const win = { at: 0, params: { box: [0.1, 0.1, 0.8, 0.8], zoom: [{ t: 0, rect: [0, 0, 0.5, 0.5] }], enter: 'none' } }, G = appWindowGeo(win.params, c, 40, 6), [ex, ey] = G.map(0.25, 0.25);
  const svg = renderInner('ui.cursorJourney', 40, { at: 0, dur: 100, params: { path: [{ t: 0, x: 0.25, y: 0.25 }], win } }, c), m = /translate\(([\d.]+) ([\d.]+)\) scale\([\d.]+\) translate\(0 0\)" fill="#111111"/.exec(svg);
  check('cursor: win puts the path in the window screen space through its zoom', m && Math.abs(+m[1] - ex) < 0.02 && Math.abs(+m[2] - ey) < 0.02, m ? `${m[1]},${m[2]} vs ${ex},${ey}` : 'no cursor'); }

/* ---------- command bar, ai answer, shortcut chip ---------- */
{ const d = GFX['ui.commandBar'].d, all = texts(renderSVG('ui.commandBar', 0.3, { at: 0 })), typed = texts(renderSVG('ui.commandBar', 1.5, { at: 0 }));
  check('commandBar: the list filters to the typed query', all.includes('Create a flow') && !typed.includes('Create a flow') && typed.includes('Route new requests') && typed.includes('Route by topic'));
  check('commandBar: the panel closes after enter (nothing drawn once it has closed)', renderSVG('ui.commandBar', 2.5, { at: 0 }) === '' && renderSVG('ui.commandBar', 1.8, { at: 0 }) !== '', String(d.query)); }
{ const n = (t) => texts(renderSVG('ui.aiAnswer', t, { at: 0 })).join(' ').split(/\s+/).length; let mono = true; let prev = 0; for (let t = 3; t < 6; t += 0.2) { const v = n(t); if (v < prev) mono = false; prev = v; }
  check('aiAnswer: the answer streams word by word (never fewer words later)', mono && n(5.6) > n(3.4) + 8);
  const tm = answerTimes(GFX['ui.aiAnswer'].d); check('aiAnswer: Apply turns into Applied after its click', texts(renderSVG('ui.aiAnswer', tm.applyAt + 0.2, { at: 0, dur: 12 })).includes('Applied') && !texts(renderSVG('ui.aiAnswer', tm.applyAt - 0.1, { at: 0, dur: 12 })).includes('Applied'), JSON.stringify(tm)); }
{ const before = renderSVG('ui.shortcutChip', 0.3, { at: 0 }), during = renderSVG('ui.shortcutChip', 0.75, { at: 0 }), A = GFX['ui.shortcutChip'].d.accent;
  check('shortcutChip: keys press in sequence (the accent fill appears on the press)', !before.includes(`fill="${A}"`) && during.includes(`fill="${A}"`)); }

/* ---------- honesty ---------- */
check('pricingCards: prices print "placeholder data"', texts(renderSVG('ui.pricingCards', 2, { at: 0 })).some((s) => /placeholder data/.test(s)));
check('dashboardAssemble: figures print "demo data"', texts(renderSVG('ui.dashboardAssemble', 3, { at: 0 })).some((s) => /demo data/.test(s)));
check('integrationGrid: prints "placeholder marks"', texts(renderSVG('ui.integrationGrid', 2, { at: 0 })).some((s) => /placeholder marks/.test(s)));
check('integrationGrid: glyphs are generic categories (no product names)', Object.keys(GLYPHS).every((k) => /^(cloud|db|chat|calendar|doc|mail|chart|code|bell|folder|key|cart|phone|sheet|card|lock|globe)$/.test(k)));
console.log(`\nsaas kit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
