/* HONESTY OF DEFAULTS (node only, no browser, no GPU: CI runs this).
   run: node type/tests/honesty-defaults.test.mjs

   The pack's rule (SKILL.md rule 6): no invented stats, and a number a viewer could mistake for a finding carries a label. A part that ships with a
   default number, price, percentage or sample quote is a stat the maintainers invented, and the catalog thumbnail, a template or an agent that renders
   it with defaults would publish it. So every registered part, rendered with its DEFAULT params, must print a placeholder / illustrative label in the
   same frame as any digit it draws.

   The sweep: for EVERY id in GFX (type/gfx/index.js, 120 parts) and EVERY layers kind that draws text (layers/canvas2d*.js, through a recording 2D
   context), at 16:9 and 9:16, at every 0.3 s from the end of the entrance to the end of the hold (counters change while they run, so one hero frame is
   not enough): collect the visible <text> (opacity > 0.3). If any of it holds a digit, some other visible text in that frame must match DISCLOSURE.
   "source: <anything>" alone does not count: the old statCard default said "source: internal benchmark", which satisfied the old lint and was made up.

   WHAT IS ALLOWED WITHOUT A LABEL (ALLOW below, each with its reason, and each entry must still be needed: a stale entry fails): digits that are the
   part's own mechanics or a measurement of what it draws, never a claim about the world: a timecode, a countdown, a numbered card, the weight or hex
   code of the thing on screen. Everything else (counters, prices, percentages, sample notifications and chat lines, UI progress and file sizes, a map
   distance) must carry the label. To pass this test with a new part, give it a `source` param that defaults to 'placeholder data' and print it, or ship
   digit-free defaults. Do not widen ALLOW for a number a viewer could read as a result.

   Also here: counter.statCard / counter.countUp specifically (the audited findings): the default frame carries the label, a caller who passes only
   their own number still gets the label (they must name a real source to remove it), a real source replaces it, a blank source falls back to it, the
   old made-up 487 ms / -38% / "internal benchmark" are gone from the part and from type/manifest.json, and templates/_shared/plan.mjs lintClaims refuses
   generic sources ("internal benchmark", "n/a", "x"). */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GFX, GFX_IDS, renderSVG } from '../gfx/index.js';
import { ALL_KINDS } from '../../layers/overlay.js'; import '../../layers/canvas2d.js';
import { lintClaims } from '../../templates/_shared/plan.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..');
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };

/* the label: an explicit statement in frame that the figures are not real. "source:" alone never counts. */
const DISCLOSURE = /\b(placeholder|illustrative|sample data|example data|demo data|mock data|fictional|dummy|not real)\b/i;
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const TXT = /<text\b([^>]*)>([^<]*)<\/text>/g;
const texts = (svg) => [...svg.matchAll(TXT)].map(([, a, s]) => ({ s: dec(s), op: +(/opacity="([\d.]+)"/.exec(a)?.[1] ?? 1), size: +(/font-size="([\d.]+)"/.exec(a)?.[1] ?? 0) })).filter((x) => x.op > 0.3);

/* digits that are mechanics or measurements, not claims. id -> why. */
const ALLOW = {
  'title.timecodeHUD': 'a frame counter and timecode computed from t (the part\'s own clock)',
  'title.countdown321': 'counts down the part\'s own seconds',
  'title.slate': 'clapperboard fields (scene, take, roll) of the fictional Orbit production: labels on a prop, not statistics',
  'title.chapterCard': 'an ordinal ("Chapter 02") that numbers the card',
  'layout.scatterCollage': 'the numbered dots (1 to 4) are decorative ordinals of the collage',
  'layout.orbitRing': 'the day number drawn on the calendar icon (icon artwork, not data)',
  'caption.subtitleSpeedGag': 'the playback-speed multipliers of the gag itself',
  'callout.selectionBox': 'prints the width x height of the box it draws (measured from its own geometry)',
  'layout.paletteColumns': 'the hex codes of the colours it draws',
  'layout.typeSpecimen': 'the weight of the specimen line it renders ("Bold 700")',
  'ui.checklist': 'a progress counter n / total computed from the part\'s own step list',
  /* layers kinds (canvas text), keyed 'layers.<kind>' */
  'layers.recHUD': 'a running timecode computed from t',
  'layers.timecode': 'a running timecode computed from t; the camcorder date stamp is part of the look',
  'layers.epicycleDraw': 'N and the mean error are computed from the curve it draws, and the line under them says how',
};
check('every ALLOW entry carries a reason of at least 20 characters', Object.values(ALLOW).every((r) => r.length >= 20));
const needed = new Set();

/* ---------- 1. every gfx id, 16:9 and 9:16, across its whole hold ---------- */
const bad = []; let frames = 0, withDigits = 0;
check(`the registry is swept in full (GFX_IDS: ${GFX_IDS.length} parts)`, GFX_IDS.length >= 118 && GFX_IDS.every((id) => GFX[id]));
for (const id of GFX_IDS) {
  const g = GFX[id], inD = (g.inF ?? 12) / 30, dur = Math.min(g.dur ?? 3, 12);
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) for (let u = inD + 0.3; u <= inD + dur + 1e-9; u += 0.3) {
    const svg = renderSVG(id, u, { at: 0 }, { W, H }); frames++; const ts = texts(svg), dig = ts.filter((x) => /\d/.test(x.s));
    if (!dig.length) continue; withDigits++; needed.add(id);
    const lab = ts.find((x) => DISCLOSURE.test(x.s));
    if (lab) { if (lab.size < 12 * Math.min(W, H) / 1080) bad.push(`${id} ${W}x${H} t=${u.toFixed(1)}: label "${lab.s}" is only ${lab.size}px`); continue; }
    if (!ALLOW[id]) bad.push(`${id} ${W}x${H} t=${u.toFixed(1)}: ${JSON.stringify(dig.slice(0, 3).map((x) => x.s))} with no placeholder / illustrative label`);
  }
}
const uniq = [...new Set(bad.map((b) => b.replace(/ \d+x\d+ t=[\d.]+/, '')))];
check(`GFX: ${frames} frames of ${GFX_IDS.length} parts at default params (${withDigits} with digits): every digit sits beside a placeholder / illustrative label (or is an allowed mechanic)`, !bad.length, `${uniq.length} part(s) fail: ` + uniq.slice(0, 12).join(' | '));

/* digit-bearing DEFAULT STRINGS that are not drawn as <text> (glyph systems, hidden until a time we did not sample) must not hide an unlabelled stat either:
   a default string with a digit means the part is in `needed` (it drew digits somewhere) or is a non-claim (id, colour, path, unit). */
const walk = (o, p, out) => { if (typeof o === 'string') { if (/\d/.test(o) && !/^#|^sfx\/|^[Mm][\d .-]|^[\d.]+(px|%|s|ms|deg)?$|^rgba?\(|^[a-z]+\(|^\d+(?:\.\d+)?x?$|^[\w.-]+\.(png|jpg|svg|mp4|json)$|^https?:|^[a-z0-9_.-]+\/[a-z0-9_./-]+$|^M[\d. ,LCZVHSQTAmlczvhsqta-]+$/.test(o)) out.push(p + '=' + o.slice(0, 50)); } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, p + '[' + i + ']', out)); else if (o && typeof o === 'object') for (const k in o) walk(o[k], p ? p + '.' + k : k, out); };
{ const hidden = []; for (const id of GFX_IDS) { const out = []; walk(GFX[id].d, '', out); if (out.length && !needed.has(id) && !ALLOW[id]) hidden.push(id + ' ' + out.slice(0, 2).join(' ; ')); }
  check('no part hides a digit-bearing default string that the frame sweep never saw (drawn as glyphs, or shown only at a time we did not sample)', !hidden.length, hidden.slice(0, 6).join(' | ')); }

/* ---------- 2. every layers kind that draws text ---------- */
const recorder = () => { const texts = []; const g = new Proxy({}, { get: (o, k) => { if (k in o) return o[k]; if (k === 'fillText' || k === 'strokeText') return (s) => { texts.push(String(s)); }; if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
  if (['createRadialGradient', 'createLinearGradient', 'createConicGradient', 'createPattern'].includes(k)) return () => ({ addColorStop() {} }); if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }); return () => ({ width: 0 }); }, set: (o, k, v) => { o[k] = v; return true; } }); return { g, texts }; };
{ const AK = ALL_KINDS(), kinds = Object.entries(AK).filter(([, k]) => typeof k.draw === 'function'), lbad = []; let drew = 0;
  for (const [name, kind] of kinds) for (const [W, H] of [[1920, 1080], [1080, 1920]]) for (let t = 0.5; t <= 6.01; t += 0.5) {
    const { g, texts: tx } = recorder(); try { kind.draw(g, W, H, t, { ...kind.d }, 3); } catch (e) { lbad.push(`${name}: draw threw ${e.message.slice(0, 60)}`); continue; } drew++;
    if (tx.some((s) => /\d/.test(s))) { needed.add('layers.' + name); if (!tx.some((s) => DISCLOSURE.test(s)) && !ALLOW['layers.' + name]) lbad.push(`${name} ${W}x${H} t=${t}: ${JSON.stringify(tx.filter((s) => /\d/.test(s)).slice(0, 3))} with no label`); } }
  check(`layers: ${kinds.length} kinds with a draw() swept at default params (${drew} draws, 16:9 and 9:16): no digit without a label (or an allowed mechanic)`, !lbad.length && kinds.length >= 25, [...new Set(lbad)].slice(0, 6).join(' | '));
}
const stale = Object.keys(ALLOW).filter((k) => !needed.has(k));
check('every ALLOW entry is still needed (the part still draws digits): a stale entry would hide a future regression', !stale.length, stale.join(', '));

/* ---------- 3. the audited parts, specifically ---------- */
const hero = (id) => (GFX[id].inF ?? 12) / 30 + Math.min(GFX[id].dur ?? 3, 3) * 0.5;
const T = (id, params = {}, t = 2.2, size = [1920, 1080]) => texts(renderSVG(id, t, { at: 0, params }, { W: size[0], H: size[1] })).map((x) => x.s);
{ const d = T('counter.statCard'), all = d.join(' | ');
  check('counter.statCard default: a "source: placeholder data" line is in frame', d.includes('source: placeholder data'), all);
  check('counter.statCard default: the made-up 487 ms / P50 voice latency / -38% / "internal benchmark" are gone', !/487|P50|voice latency|-38|internal benchmark/i.test(all), all);
  const mine = T('counter.statCard', { to: 99, suffix: '%', label: 'Uptime' }).join(' | ');
  check('counter.statCard: a caller who passes only their own number still gets the label (they must name a real source to remove it)', /99%/.test(mine) && /source: placeholder data/.test(mine), mine);
  const real = T('counter.statCard', { to: 99, suffix: '%', label: 'Uptime', delta: '+1%', source: 'status page, Oct 2026' }).join(' | ');
  check('counter.statCard: a real source replaces the label', /source: status page, Oct 2026/.test(real) && !/placeholder/i.test(real), real);
  const blank = T('counter.statCard', { to: 99, source: '   ' }).join(' | ');
  check('counter.statCard: a blank source falls back to the label (digits never print unlabelled)', /source: placeholder data/.test(blank), blank); }
{ const d = T('counter.countUp').join(' | ');
  check('counter.countUp default: a placeholder line is in frame', /placeholder data/.test(d), d);
  check('counter.countUp: a real source replaces the label; blank falls back', /Q3 survey/.test(T('counter.countUp', { to: 40, source: 'Q3 survey' }).join(' ')) && !/placeholder/.test(T('counter.countUp', { to: 40, source: 'Q3 survey' }).join(' ')) && /placeholder data/.test(T('counter.countUp', { to: 40, source: '' }).join(' '))); }
for (const id of ['counter.ring', 'counter.wheel', 'counter.priceSlash', 'counter.stepPill', 'map.route', 'ui.fileChip', 'ui.tabPillNav', 'ui.windowWall']) {
  const sizes = [[1920, 1080], [1080, 1920]]; check(`${id}: the default frame carries the label at 16:9 and 9:16, and a caller's own source replaces it`,
    sizes.every((sz) => DISCLOSURE.test(T(id, {}, hero(id), sz).join(' | '))) && T(id, { source: 'Acme audit, Oct 2026' }, hero(id), [1920, 1080]).join(' | ').includes('Acme audit, Oct 2026')); }
for (const id of ['social.notification', 'social.chatBubbles', 'caption.meme', 'ui.wordRegenerate']) check(`${id}: default copy is digit-free (sample copy needs no label when it states no number)`, !/\d/.test(T(id, {}, 3).join(' ')) && !/\d/.test(T(id, {}, 1.6).join(' ')));
{ const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'type/manifest.json'), 'utf8')), ids = JSON.stringify(man);
  check('type/manifest.json (generated from the parts) no longer lists "internal benchmark", "P50 voice latency" or the invented -38% delta', !/internal benchmark|P50 voice latency|"-38%"/.test(ids)); }
{ const p = (src) => lintClaims([{ text: '487 ms P50 latency, -38%', source: src }]).length;
  check('lintClaims: refuses a claim with a digit and no source, a blank source and a generic one ("internal benchmark", "n/a", "x", "trust me")', [undefined, '', '   ', 'internal benchmark', 'Internal Benchmark.', 'n/a', 'x', 'trust me', 'our data', 'tbd'].every((s) => p(s) === 1));
  // verifier: separators and near-synonyms slipped through ("internal-benchmark", "in-house benchmark", "trust me bro", "self-reported", "me")
  check('lintClaims: a generic source is refused in any spelling (hyphen, underscore, case, a "source:" prefix, in-house, self-reported, me)', ['internal-benchmark', 'in-house benchmark', 'In_House  Data', 'trust me bro', 'self-reported', 'me', 'source: our data', 'Our own numbers.', 'N/A'].every((s) => p(s) === 1));
  check('lintClaims: accepts a source that names where the number comes from, and a claim with no digit needs none', p('run 4 of the placeholder set, 2026-10-14') === 0 && p('illustrative data, printed in the chart footnote') === 0 && lintClaims([{ text: 'it is fast' }]).length === 0); }

console.log(`\nhonesty-defaults: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
