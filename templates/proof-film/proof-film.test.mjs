/* templates/proof-film/proof-film.test.mjs: the proof film's gates, plan and camera (node only: no browser, no GPU, no gitignored file; CI runs it).
   run: node templates/proof-film/proof-film.test.mjs
   HONESTY GATE: the demo passes for every builder; a number without a `source`, or without a `method` (missing, '', whitespace or filler such as "n/a" and ".") fails with a message that
   names the field, in buildPlan, in `cues.mjs` and in `node make.mjs` (exit 2, nothing written); per-row overrides inherit; a claim over 6 words, with no accent word or with two fails;
   a number in prose fails in ANY script (fullwidth, Arabic-Indic, Devanagari, superscript, vulgar fraction, circled), as a number word, in the brand name, the URL, an axis unit, a table
   bar title and in the VOICE transcript; a wrong-shaped CONFIG fails with a message, never a stack trace; three stat cards, a known builder (trace is refused on 9:16), a known unit,
   `illustrative: false` next to a placeholder source and a hard cut without its Murch reason all fail.
   PLAN: every builder x format builds; stages start on whole frames and (no VO) on the bed's beats; EVERY variant runs 36-60 s (timing.minS lengthens a short one); the music, sfx and gfx
   ids resolve (0 unresolved); exactly one soft hit on the number reveal; no sound on the end card but a tick and the room tone under the quiet hold; plan.audio.quiet declares the open
   (<= 2 s) and the hold (3-9 s) and the bed automation reaches its quiet level; claims carry sources (lint.proof); the committed out/plan.json and plan-tall.json are the current plans;
   one root composition per HyperFrames folder (hyperframes lint).
   CAMERA: at rest the stage in view projects to the frame centre (mapCell), no frame moves further than the eased leg allows, the zoom stays inside [1 - dip, 1 + push], a cut
   boundary is a jump, the picture moves by frame 6 and a frame is identical in any seek order.
   IN FRAME: every number's source and method print on its panel; the ILLUSTRATIVE pill is DRAWN on every number panel (builder, head-to-head, method card, numbers, cards, end) at the
   same spot, at least 28 px on 16:9 and 30 px on 9:16, visible before the first big number is, and gone when `illustrative` is false; the fine print is fully visible 1.2 s after a panel
   starts; every text sits inside the platform safe zone after the camera push; no two texts overlap.
   VO: with words.example.json every stage change falls in a speech gap (never inside a word), cues under a line sit under the voice, the guide signal builds; too few gaps is refused. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { CONFIG, buildPlan, gateProblems, STAGE_KINDS } from './config.mjs';
import { problems, HonestyError, numberFields, claimWords, isIllustrative, numberIn, weak } from './honesty.mjs';
import { cameraFor, mapCell, stage, layout, cellVisible, PILL_LABEL, pillPx } from './panels.mjs';
import { GFX } from '../../type/gfx/index.js'; import { measure, MONO } from '../../type/gfx/core.js'; import { safeRect } from '../../type/safezones.js'; import { lintClaims } from '../_shared/plan.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), PY = process.env.PYTHON || 'python3';
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const clone = (o) => structuredClone(o), W = (f, k) => { const C = clone(CONFIG); C.format = f; if (k) C.builder.kind = k; return C; };
const fps = 30, near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id)), okSfx = (id) => SFX.has('snd.' + id.split('/').slice(1).join('.'));
const MUSIC = JSON.parse(fs.readFileSync(path.join(ROOT, 'music/manifest.json'), 'utf8')).items;
const run = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: here, encoding: 'utf8', ...opts });
const tmp = path.join(os.tmpdir(), 'proof-film-test-' + process.pid); fs.mkdirSync(tmp, { recursive: true });
const WORDS = path.join(here, 'words.example.json');
const voice = (words) => { const f = path.join(tmp, `words-${Math.abs(JSON.stringify(words).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}.json`); fs.writeFileSync(f, JSON.stringify({ words })); return f; };

/* ---------- 1. the honesty gate ---------- */
for (const k of ['scatter', 'trace', 'table']) check(`the demo passes the gate with builder ${k}`, problems(W('wide', k)).length === 0, problems(W('wide', k)).join(' | '));
for (const k of ['scatter', 'table']) check(`the demo passes the gate on 9:16 with builder ${k}`, problems(W('tall', k)).length === 0, problems(W('tall', k)).join(' | '));
const demo = numberFields(CONFIG);
check(`the demo lists ${demo.length} number fields and every one has a source and a method`, demo.length >= 30 && demo.every((n) => n.source && n.method && n.source.trim() && n.method.trim()));
check('the demo is labelled illustrative (a placeholder source, a fictional brand)', isIllustrative(CONFIG) && demo.every((n) => /illustrative placeholder/.test(n.source)) && CONFIG.brand.name === 'Acme Reader');
const OWNERS = [['setting.numbers[1]', (C) => C.setting.numbers[1], 'setting.numbers[1]'], ['builder.scatter (container)', (C) => C.builder.scatter, 'builder.scatter.points[0]'], ['h2h (container)', (C) => C.h2h, 'h2h.rows[0]'],
  ['numbers.items[1]', (C) => C.numbers.items[1], 'numbers.items[1]'], ['cards[2]', (C) => C.cards[2], 'cards[2]'], ['builder.table (container)', (C) => C.builder.table, 'builder.table.rows[0]']];
for (const [name, get, pathHint] of OWNERS) for (const key of ['source', 'method']) for (const blankV of [undefined, '', '   ']) {
  const C = W('wide', name.startsWith('builder.table') ? 'table' : 'scatter'); const o = get(C); if (blankV === undefined) delete o[key]; else o[key] = blankV;
  const p = problems(C), hit = p.filter((m) => m.includes('`' + key + '`') && m.includes(pathHint));
  check(`no ${key} on ${name} (${blankV === undefined ? 'missing' : JSON.stringify(blankV)}) fails and names ${pathHint}...`, hit.length > 0, p.join(' | ').slice(0, 200));
  let threw = null; try { buildPlan(C); } catch (e) { threw = e; }
  check(`  buildPlan throws a HonestyError carrying the same message`, threw instanceof HonestyError && threw.problems.length === p.length && /honesty gate/.test(threw.message));
}
{ const C = W('wide'); C.h2h.rows[1].source = 'run 4 of the placeholder set'; delete C.h2h.source; const p = problems(C);   // a row with its own source and the container's method: rows 0 and 2 fail, row 1 passes
  check('a per-row source overrides the container: only the rows without one fail', p.some((m) => m.includes('h2h.rows[0]') && m.includes('`source`')) && p.some((m) => m.includes('h2h.rows[2]')) && !p.some((m) => m.includes('h2h.rows[1]'))); }
{ const C = W('wide'); C.builder.scatter.hero.source = 'own source'; C.builder.scatter.hero.method = ''; const p = problems(C);
  check('the starred point needs its own method when it sets one (a blank override counts as missing)', p.some((m) => m.includes('builder.scatter.hero.x') && m.includes('`method`'))); }
{ const C = W('wide'); C.cards[0].value = 'a lot'; C.numbers.items[0].value = NaN; const p = problems(C);
  check('a non-numeric value fails', p.some((m) => m.includes('cards[0]') && m.includes('finite number')) && p.some((m) => m.includes('numbers.items[0]') && m.includes('finite number'))); }
/* a source and a method must SAY something: empty, filler, too short and identical text are refused (a made-up sentence still passes: the gate checks form, not truth) */
for (const [kind, val] of [['source', '.'], ['source', 'n/a'], ['source', 'N/A'], ['source', 'xxxx'], ['source', 'TBD'], ['source', '-'], ['source', '??'], ['method', '.'], ['method', 'n/a'], ['method', 'tbd'], ['method', 'x'], ['method', 'see above'], ['method', 'measured']]) {
  const C = W('wide'); C.cards[2][kind] = val; const p = problems(C), hit = p.filter((m) => m.startsWith(`cards[2].${kind}:`));
  check(`${kind} "${val}" on cards[2] is refused, naming cards[2].${kind}`, hit.length === 1 && /filler|too short/.test(hit[0]), p.join(' | ').slice(0, 160)); }
{ const C = W('wide'); C.builder.scatter.source = 'n/a'; for (const pt of C.builder.scatter.points) delete pt.source; const p = problems(C).filter((m) => m.startsWith('builder.scatter.source'));
  check('a filler source on a container is ONE problem naming the container, not one per number', p.length === 1 && /filler/.test(p[0])); }
{ const C = W('wide'); C.cards[1].method = C.cards[1].source = 'OECD survey'; check('a method that repeats the source is refused', problems(C).some((m) => m.startsWith('cards[1].method:') && /repeats the source/.test(m)));
  const D = W('wide'); D.cards[1].source = 'UN'; D.cards[1].method = 'mean of the graded runs'; check('a short real source ("UN") passes', problems(D).length === 0); }
{ const C = W('wide'); C.illustrative = 'false'; check('illustrative must be true or false', problems(C).some((m) => m.startsWith('illustrative:'))); }
check('weak() accepts real text and refuses filler', weak('source', 'internal run 4') === '' && weak('method', 'mean of three graded runs') === '' && weak('source', '...') !== '' && weak('method', 'ok') !== '');
/* claim */
const claimCase = (text) => { const C = W('wide'); C.claim = text; return problems(C).filter((m) => m.startsWith('claim')); };
check('a claim of 6 words with one accent word is fine', claimCase('One box, *fewer* tabs, more room.').length === 0);
check('a claim of 7 words fails and says how many', claimCase('Better answers at a *lower* cost, always.').some((m) => /7 words, at most 6/.test(m)));
check('a claim with no accent word fails', claimCase('Better answers, lower cost.').some((m) => /no accent word/.test(m)));
check('a claim with two accent words fails', claimCase('*Better* answers, *lower* cost.').some((m) => /2 accent words/.test(m)));
check('claimWords finds the accent index', JSON.stringify(claimWords('Better answers, *lower* cost.')) === JSON.stringify({ words: ['Better', 'answers,', 'lower', 'cost.'], accent: [2], marks: 1 }));
/* a number in prose: every way to write one */
for (const [label, c] of [['ASCII digits', 'Cost down *60%* fast'], ['fullwidth digits and percent', 'Cost down *６０％* fast'], ['Arabic-Indic digits', 'Cost down *٦٠* fast'], ['Devanagari digits', 'Cost down *६०* fast'], ['superscript', 'Cost down *x²* fast'],
  ['a vulgar fraction', 'Cost down *½* fast'], ['a circled digit', 'Cost down *①* fast'], ['a Roman numeral sign', 'Cost down *Ⅷ* fast'], ['a currency sign', 'Cost down *$* fast'], ['the rupee sign', 'Cost down *₹* fast'], ['an Arabic percent sign', 'Cost down *٪* fast'],
  ['a number word', 'Cost down *sixty* fast'], ['a hyphenated number word', 'Cost down *ten-times* fast'], ['"percent"', 'Cost *down* percent'], ['"tenfold"', 'Cost *tenfold* lower'], ['"twenty-five"', 'Cost down *twenty-five* fast'], ['"twice"', 'Costs *twice* less'], ['"half"', '*Half* the cost'], ['"zero"', '*Zero* setup cost']]) {
  const p = claimCase(c).filter((m) => /number in prose/.test(m)); check(`a claim with ${label} fails ("${c}")`, p.length === 1 && p[0].startsWith('claim:'), problems(W('wide')).length + ' ' + p.join(' | ')); }
check('"one" is not a number word (a pronoun: "One box", "no one"), nor are ordinals', claimCase('One box, *fewer* tabs.').length === 0 && claimCase('The first answer, *cheaper*.').length === 0 && numberIn('One box. The second try, the third party.') === '');
check('numberIn finds the fragment, and lets a unit sign through when asked', numberIn('over 120 tasks') === '1' && numberIn('twenty-five tasks') === 'twenty' && numberIn('$', { symbols: false }) === '' && numberIn('2', { symbols: false }) === '2');
const proseCase = (set, hint, expectOk = false) => { const C = W('wide', 'scatter'); set(C); const p = problems(C).filter((m) => m.startsWith(hint)); return expectOk ? p.length === 0 : p.length > 0; };
check('a digit in the brand name fails and names brand.name ("Acme 10x Reader")', proseCase((C) => { C.brand.name = 'Acme 10x Reader'; }, 'brand.name'));
check('a number word in the brand name fails', proseCase((C) => { C.brand.name = 'Acme Ten Reader'; }, 'brand.name'));
check('a digit in the URL fails and names brand.url; brand.urlHasNumber: true lets a domain name keep its digit', proseCase((C) => { C.brand.url = 'reader2.example'; }, 'brand.url') && proseCase((C) => { C.brand.url = 'reader2.example'; C.brand.urlHasNumber = true; }, 'brand.url', true) && proseCase((C) => { C.brand.url = 'reader2.example'; C.brand.urlHasNumber = 'yes'; }, 'brand.url'));
check('a blank brand name or URL fails', proseCase((C) => { C.brand.name = ' '; }, 'brand.name') && proseCase((C) => { delete C.brand.url; }, 'brand.url'));
check('a digit in an axis prefix or suffix fails ("10x "), a currency sign or "x" does not', proseCase((C) => { C.builder.scatter.x.prefix = '10x '; }, 'builder.scatter.x.prefix') && proseCase((C) => { C.builder.scatter.x.suffix = ' 2'; }, 'builder.scatter.x.suffix') && proseCase((C) => { C.builder.scatter.y.prefix = '١'; }, 'builder.scatter.y.prefix')
  && proseCase((C) => { C.builder.scatter.x.prefix = '$'; C.builder.scatter.x.suffix = 'x'; }, 'builder.scatter.x', true));
check('a digit in the scatter title, a point label, the hero callout fails and names the field', proseCase((C) => { C.builder.scatter.title = 'Score in 2024'; }, 'builder.scatter.title') && proseCase((C) => { C.builder.scatter.points[2].label = 'System 9'; }, 'builder.scatter.points[2].label') && proseCase((C) => { C.builder.scatter.hero.callout = ['Highest score', '60% cheaper']; }, 'builder.scatter.hero.callout[1]'));
check('a number in a table bar title fails (builder.table.bars.title)', (() => { const C = W('wide', 'table'); C.builder.table.bars = { row: 0, title: 'Up 60%' }; return problems(C).some((m) => m.startsWith('builder.table.bars.title')); })());
check('a number in the setting rows, end line, end chips, name promise fails', proseCase((C) => { C.setting.rows[1].text = 'Over 120 tasks'; }, 'setting.rows[1].text') && proseCase((C) => { C.end.line = 'Save sixty percent'; }, 'end.line') && proseCase((C) => { C.end.chips = ['No fee', '24/7']; }, 'end.chips[1]') && proseCase((C) => { C.name.promise = 'Made in 2026'; }, 'name.promise'));
check('prose that is not text fails ("name.promise: 60")', proseCase((C) => { C.name.promise = 60; }, 'name.promise'));
{ const C = W('wide'); C.setting.rows[0].text = 'Answer score over 120 tasks'; C.claim = 'Cost down *60%* fast'; C.cards[0].line = 'score in 2 runs'; const p = problems(C);
  check('a digit in prose fails and names the field (setting row, claim, card line)', p.some((m) => m.startsWith('setting.rows[0].text')) && p.some((m) => m.startsWith('claim')) && p.some((m) => m.startsWith('cards[0].line'))); }
{ const C = W('wide', 'trace'); C.builder.trace.lanes[0].steps[0].label = 'Step 3'; check('a digit in diagram text fails and names the field', problems(C).some((m) => m.startsWith('builder.trace.lanes[0].steps[0].label'))); }
/* a wrong-shaped CONFIG is a message, never a stack trace */
{ const C = W('wide'); C.builder.scatter.hero.callout = 'Highest score'; let p, threw = null; try { p = problems(C); } catch (e) { threw = e; }
  check('hero.callout as a string is a message that names the field (not a TypeError)', !threw && p.some((m) => m.startsWith('builder.scatter.hero.callout') && /must be a list/.test(m)), String(threw)); }
{ const C = W('wide'); C.cards[1] = null; C.setting.rows = 'what'; let p, threw = null; try { p = problems(C); } catch (e) { threw = e; }
  check('a null card and a string where a list belongs fail with a message, not a throw', !threw && p.length > 0 && p.some((m) => /must be a list|wrong shape/.test(m)), String(threw)); }
{ const C = W('wide'); let threw = null; try { buildPlan({ ...C, cards: 'x' }); } catch (e) { threw = e; } check('buildPlan on a wrong-shaped CONFIG throws the HonestyError (exit 2 path), not a TypeError', threw instanceof HonestyError, String(threw)); }
{ const C = W('wide'); C.cards.pop(); check('two stat cards fail (exactly three)', problems(C).some((m) => /stat cards, exactly 3/.test(m))); }
{ const C = W('wide', 'pie'); check('an unknown builder fails (ONE builder of a known kind)', problems(C).some((m) => m.startsWith('builder.kind'))); }
{ const C = W('square'); check('an unknown format fails', problems(C).some((m) => m.startsWith('format'))); }
{ const C = W('tall', 'trace'); const p = problems(C).filter((m) => m.startsWith('builder.kind')); check('builder trace on 9:16 is refused with the reason and the way out (landscape-only, 7 px type)', p.length === 1 && /landscape/.test(p[0]) && /scatter/.test(p[0]) && /table/.test(p[0]), p.join(' | ')); }
{ const C = W('wide'); C.numbers.items[0].unit = 'kg'; check('a unit the part cannot format fails', problems(C).some((m) => m.includes('numbers.items[0].unit'))); }
{ const C = W('wide'); C.illustrative = false; check('illustrative: false next to a placeholder source fails', problems(C).some((m) => /illustrative is false/.test(m))); }
{ const mk = (why) => { const C = W('wide'); C.cut = { 'builder>h2h': why }; return problems(C).filter((m) => m.startsWith('cut.builder>h2h')); };
  const C3 = W('wide'); C3.cut = { 'claim>cards': 'EMOTION: the failure lands' };
  check('a hard cut needs a real Murch reason with a why: "", "XXX", "EMOTION", "EMOTION: x", "FOO: ..." are refused; a real one passes', ['', 'XXX', 'EMOTION', 'EMOTION:', 'EMOTION: x', 'EMOTION: ...', 'FOO: the failure lands', 'emotion: the failure lands'].every((w) => mk(w).length === 1) && mk('EMOTION: the failure lands').length === 0 && mk('RHYTHM: lands on the beat').length === 0, ['', 'XXX', 'EMOTION', 'EMOTION: x'].map((w) => mk(w).length).join(','));
  check('a cut between non-neighbouring stages fails', problems(C3).some((m) => m.startsWith('cut.claim>cards'))); }
/* the commands: node make.mjs and cues.mjs exit non-zero, name the field, write nothing */
{ const planPath = path.join(here, 'out', 'plan.json'), before = fs.readFileSync(planPath, 'utf8'), mt = fs.statSync(planPath).mtimeMs, htmlPath = path.join(here, 'index.html'), hb = fs.readFileSync(htmlPath, 'utf8');
  const writes = (r, hint) => r.status === 2 && r.stderr.includes('honesty gate') && r.stderr.includes(hint) && fs.readFileSync(planPath, 'utf8') === before && fs.statSync(planPath).mtimeMs === mt && fs.readFileSync(htmlPath, 'utf8') === hb;
  for (const [setArg, hint] of [['cards.1.method=', 'cards[1]'], ['builder.scatter.hero.source=', 'builder.scatter'], ['h2h.method=', 'h2h.rows[0]'], ['numbers.items.0.source=  ', 'numbers.items[0]'], ['setting.numbers.2.method=', 'setting.numbers[2]'],
    ['cards.0.source=n/a', 'cards[0].source'], ['brand.name=Acme 10x Reader', 'brand.name'], ['claim=Cost down *６０％* fast', 'claim'], ['builder.scatter.x.prefix=10x ', 'builder.scatter.x.prefix']]) {
    const r = run(['make.mjs', '--set', setArg]); check(`node make.mjs --set ${setArg.trim()} exits 2, names ${hint} and writes nothing`, writes(r, hint), `status ${r.status} ${r.stderr.slice(0, 160)}`); }
  const rv = run(['make.mjs', '--set', 'vo.words=' + voice([{ w: 'Sixty', s: 0.4, e: 0.8 }, { w: 'percent', s: 0.85, e: 1.2 }])]); check('node make.mjs with a transcript that says "Sixty percent" exits 2 and names vo.words[0]', writes(rv, 'vo.words[0]'), `status ${rv.status} ${rv.stderr.slice(0, 200)}`);
  const rt = run(['make.mjs', '--set', 'format=tall', '--set', 'builder.kind=trace']); check('node make.mjs --set format=tall --set builder.kind=trace exits 2 (landscape-only) and writes nothing', writes(rt, 'builder.kind') && /landscape/.test(rt.stderr), `status ${rt.status} ${rt.stderr.slice(0, 160)}`);
  const rs = run(['make.mjs', '--set', 'no.such.field=1']); check('node make.mjs --set on a field that does not exist exits 2 with a message, not a stack trace', rs.status === 2 && /cannot --set/.test(rs.stderr) && !/at .*\.mjs:\d+/.test(rs.stderr), `status ${rs.status} ${rs.stderr.slice(0, 200)}`);
  const r = run([path.join(ROOT, 'templates/_shared/cues.mjs'), here, '--set', 'cards.0.source=', '--name', 'plan-gate-test']);
  check('node templates/_shared/cues.mjs fails the same way (non-zero, the field named)', r.status !== 0 && /cards\[0\]/.test(r.stderr) && !fs.existsSync(path.join(here, 'out', 'plan-gate-test.json')), `status ${r.status}`); }
/* the VO transcript: a number the voice says needs a number field like any other */
{ const base = JSON.parse(fs.readFileSync(WORDS, 'utf8')).words, withWord = (i, w) => base.map((x, k) => (k === i ? { ...x, w } : x)), vp = (words) => { const C = clone(CONFIG); C.vo = { words: voice(words), audio: null }; return gateProblems(C); };
  check('the example transcript passes the gate (it says no number: "These numbers matter", "One chart", "First")', gateProblems((() => { const C = clone(CONFIG); C.vo = { words: WORDS, audio: null }; return C; })()).length === 0);
  for (const w of ['60%', 'ten-times', 'sixty', 'Two', 'twice', 'tenfold', 'double', '٦٠', '６０', '$4', 'twenty-five', 'half', 'percent', 'zero']) { const p = vp(withWord(1, w)); check(`a transcript that says "${w}" fails and names vo.words[1] with its time`, p.length === 1 && p[0].startsWith('vo.words[1] ("' + w + '" at ') && /number/.test(p[0]), p.join(' | ').slice(0, 200)); }
  const p2 = (() => { const C = clone(CONFIG); C.vo = { words: path.join(tmp, 'missing.json'), audio: null }; return gateProblems(C); })(); check('an unreadable transcript is a message naming vo.words', p2.length === 1 && p2[0].startsWith('vo.words:'));
  let threw = null; try { const C = clone(CONFIG); C.vo = { words: voice(withWord(1, '60%')), audio: null }; buildPlan(C); } catch (e) { threw = e; } check('buildPlan refuses a transcript with a number (HonestyError)', threw instanceof HonestyError && /vo\.words\[1\]/.test(threw.message)); }

/* ---------- 2. the plan ---------- */
const CASES = [['wide', 'scatter'], ['wide', 'trace'], ['wide', 'table'], ['tall', 'scatter'], ['tall', 'table']].map(([f, k]) => [f, k, buildPlan(W(f, k))]);
const plan = CASES[0][2], planTall = CASES[3][2];
for (const [f, k, P] of CASES) {
  const kinds = STAGE_KINDS(W(f, k)), st = P.stages, fpb = P.framesPerBeat, tag = `${f}/${k}`;
  check(`${tag}: ${kinds.length} stages in order (${kinds.join(' > ')}), t0 rising, content after t0`, st.length === kinds.length && st.every((s, i) => s.kind === kinds[i] && (!i || s.t0 > st[i - 1].t0) && s.at >= s.t0) && near(st[0].t0, 0) && near(st[0].at, 0));
  check(`${tag}: every stage starts on a whole frame and on a beat of the bed (${fpb} frames)`, st.every((s) => near(s.t0 * fps, Math.round(s.t0 * fps), 3e-3) && Math.round(s.t0 * fps) % fpb === 0 && near(s.at * fps, Math.round(s.at * fps), 3e-3)));   // times are stored to 4 decimals: 125 frames print as 4.1667 s
  check(`${tag}: ${P.seconds} s is a whole number of tenths of a second, inside the 36-60 s window, no warning`, near(P.seconds * 10, Math.round(P.seconds * 10), 1e-6) && st.at(-1).until === P.seconds && P.seconds >= 36 && P.seconds <= 60 && P.warnings.length === 0, P.warnings.join(' | '));
  check(`${tag}: every builder part id is a registered gfx and the stage lengths hold the part's own build`, st.filter((s) => s.part).every((s) => GFX[s.part.id] && (s.until - s.at) >= 3.0));
  check(`${tag}: cues sorted, inside the film, every sfx id resolves (0 unresolved), music id resolves`, P.cues.every((c, i) => c.t >= 0 && c.t < P.seconds && okSfx(c.id) && (!i || c.t >= P.cues[i - 1].t)) && MUSIC.some((m) => m.id === 'music.' + P.music.split('/')[1]));
  check(`${tag}: the bed's tempo is the manifest tempo`, near(MUSIC.find((m) => m.id === 'music.' + P.music.split('/')[1]).bpm, P.bpm, 0.01));
  const hits = P.cues.filter((c) => c.id === CONFIG.sfx.numbers), end = st.at(-1);
  check(`${tag}: exactly one soft hit on the number reveal, on the numbers stage`, hits.length === 1 && hits[0].t >= st.find((s) => s.kind === 'numbers').at && hits[0].t < st.find((s) => s.kind === 'numbers').until);
  const onEnd = P.cues.filter((c) => c.t >= end.t0), room = onEnd.filter((c) => c.id === CONFIG.sfx.hold);
  check(`${tag}: on the end card only the camera's slide, a tick and ONE room tone under the hold (no stinger, no logo, no hit)`, onEnd.filter((c) => c.id !== CONFIG.sfx.hold).every((c) => (c.id === CONFIG.sfx.arrive || CONFIG.sfx.travel.includes(c.id)) && c.t < end.at + 0.2) && room.length === 1 && room[0].overBedDb <= -20 && room[0].t >= end.at && !P.cues.some((c) => /sfx\/(logo|stinger|hit)\//.test(c.id) && c.t >= end.t0));
  const q = P.audio.quiet, open = q.find((x) => x.kind === 'open'), hold = q.find((x) => x.kind === 'hold'), ba = P.bedAutomation;
  check(`${tag}: plan.audio.quiet declares the open (<= 2 s) and the hold (3-9 s); mode continuous, role proof`, open && open.t[1] - open.t[0] <= 2 && hold && hold.t[1] - hold.t[0] >= 3 && hold.t[1] - hold.t[0] <= 9 && near(hold.t[1], P.seconds) && P.audio.mode === 'continuous' && P.audio.role === 'proof' && q.every((x) => x.why));
  check(`${tag}: the bed starts quiet, comes up, and reaches the quiet level by the hold; the room tone starts as it falls and sits well above the bed there`, ba.every((b, i) => !i || b.frame > ba[i - 1].frame) && ba[0].gain_db <= -30 && ba.some((b) => b.gain_db === 0) && ba.at(-1).gain_db === CONFIG.tail.bedDb && near(ba.at(-1).frame / fps, hold.t[0], 0.04) && room[0].t <= hold.t[0] && room[0].overBedDb - CONFIG.tail.bedDb >= 10);
  check(`${tag}: the first sound waits for the first visual event (the accent word, after the open)`, P.cues[0].t >= open.t[1] - 0.25 && P.cues[0].id === CONFIG.sfx.claim);
  check(`${tag}: claims carry sources (lint.proof) and the record lists every number`, lintClaims(P.claims).length === 0 && P.honesty.numbers.length === numberFields(W(f, k)).length && P.claims.length === P.honesty.numbers.length && P.honesty.gate === 'passed');
  check(`${tag}: motion events sit inside the film`, P.audio.events.length > 10 && P.audio.events.every((t) => t >= 0 && t <= P.seconds));
}
check('the default (wide, scatter) runs 36-60 s and the 9:16 re-layout has the identical timeline', plan.seconds >= 36 && plan.seconds <= 60 && JSON.stringify(plan.stages.map((s) => [s.kind, s.t0, s.at, s.until])) === JSON.stringify(planTall.stages.map((s) => [s.kind, s.t0, s.at, s.until])) && plan.seconds === planTall.seconds);
check('a table builder is the head-to-head: that stage is skipped', CASES[2][2].stages.every((s) => s.kind !== 'h2h') && CASES[2][2].stages.length === 7);
{ const T = clone(W('wide', 'table')); T.timing.minS = 0; const short = buildPlan(T), long = CASES[2][2], tallLong = CASES[4][2];
  check(`the table builder is short without timing.minS (${short.seconds} s) and timing.minS lengthens it to ${long.seconds} s, on both aspects with the identical timeline`, short.seconds < 36 && long.seconds >= 36 && long.seconds - 36 < 3 && JSON.stringify(long.stages.map((s) => [s.kind, s.t0])) === JSON.stringify(tallLong.stages.map((s) => [s.kind, s.t0]))); }
{ const C = W('wide'); C.timing.maxS = 30; check('a film longer than timing.maxS says so in the plan warnings', buildPlan(C).warnings.some((w) => /outside the 36-30 s window/.test(w))); }
{ const committed = (n) => { const j = JSON.parse(fs.readFileSync(path.join(here, 'out', n), 'utf8')); delete j.lint; return JSON.stringify(j); };
  check('the committed out/plan.json and out/plan-tall.json are the current plans (rebuild: node make.mjs; node make.mjs --set format=tall)', committed('plan.json') === JSON.stringify(plan) && committed('plan-tall.json') === JSON.stringify(planTall)); }
{ const roots = (d) => fs.readdirSync(d).filter((f) => f.endsWith('.html') && /data-composition-id/.test(fs.readFileSync(path.join(d, f), 'utf8')));
  check('one root composition per HyperFrames folder (index.html here, tall/index.html for 9:16): hyperframes lint refuses two in one folder', roots(here).join() === 'index.html' && roots(path.join(here, 'tall')).join() === 'index.html' && /1080/.test(fs.readFileSync(path.join(here, 'tall', 'index.html'), 'utf8').match(/data-width="(\d+)"/)[1])); }
{ const C = W('wide'); C.cut = { 'builder>h2h': 'EMOTION: the failure lands, so the next idea starts clean' }; const P = buildPlan(C), s = P.stages.find((x) => x.kind === 'h2h'), leg = P.camera.legs.find((l) => l.to === s.i);
  check('a motivated hard cut: a zero-length leg, the content starts on the cut, its reason is in the plan and it gets a cut tick', s.cut === true && leg.dur === 0 && near(s.at, s.t0) && /^EMOTION/.test(s.why) && P.cues.some((c) => c.id === CONFIG.sfx.cut && near(c.t, s.t0))); }

/* ---------- 3. the camera ---------- */
for (const [f, k, P] of CASES.filter((c) => c[1] === 'scatter')) {
  const cam = cameraFor(P), L = P.camera, [px, py] = L.pitch, rest = P.stages.map((s, i) => (i + 1 < P.stages.length ? P.stages[i + 1].t0 : P.seconds) - 1e-3);
  const err = P.stages.map((s, i) => { const [x, y] = mapCell(P, i, rest[i], cam); return Math.hypot(x - P.W / 2, y - P.H / 2); });
  check(`${f}: at rest the stage in view projects to the frame centre (max error ${Math.max(...err).toFixed(3)} px over ${err.length} stages)`, Math.max(...err) < 0.5);
  const T = Array.from({ length: Math.round(P.seconds * fps) + 1 }, (_, i) => i / fps); let maxStep = 0, zmin = 9, zmax = 0;
  const pos = T.map((t) => { const [x, y] = mapCell(P, 0, t, cam); return [x, y, cam.zoom(t).scale]; });
  for (let i = 1; i < T.length; i++) { const d = Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1]); maxStep = Math.max(maxStep, d); zmin = Math.min(zmin, pos[i][2]); zmax = Math.max(zmax, pos[i][2]); }
  const pitch = Math.hypot(px, py);
  check(`${f}: the world never moves more than ${(0.1 * pitch).toFixed(0)} px a frame (peak ${maxStep.toFixed(0)} px of a ${pitch} px leg): a glide, not a jump`, maxStep < 0.1 * pitch);
  check(`${f}: the zoom stays inside [${(1 - L.dip).toFixed(2)}, ${(1 + L.push).toFixed(3)}] (min ${zmin.toFixed(3)}, max ${zmax.toFixed(3)}) and dips while the camera travels`, zmin >= 1 - L.dip - 1e-9 && zmax <= 1 + L.push + 1e-9 && zmin < 1 - 0.7 * L.dip && zmax > 1 + 0.8 * L.push);
  check(`${f}: the picture moves by frame 6 (the claim's words spring in from frame 0)`, stage(P, P.stages[0], 0) !== stage(P, P.stages[0], 6 / fps) && stage(P, P.stages[0], 0).length > 100);
  const order = T.map((_, i) => i).sort((p, q) => ((p * 7919) % 211) - ((q * 7919) % 211)), fwd = T.map((t) => JSON.stringify([cam.pan(t), cam.zoom(t)])), shuf = new Map(order.map((i) => [i, JSON.stringify([cam.pan(T[i]), cam.zoom(T[i])])]));
  check(`${f}: the camera is identical in forward and shuffled seek order (${T.length} frames)`, fwd.every((s, i) => s === shuf.get(i)));
  const Lyt = layout(P), times = Array.from({ length: 90 }, (_, i) => (i * 0.47) % P.seconds), fw = times.map((t) => P.stages.map((s) => (cellVisible(P, s, t) ? stage(P, s, t, Lyt) : '')).join('|'));
  const idx = times.map((_, i) => i).sort((p, q) => ((p * 31) % 17) - ((q * 31) % 17)), second = new Map(idx.map((i) => [i, P.stages.map((s) => (cellVisible(P, s, times[i]) ? stage(P, s, times[i], Lyt) : '')).join('|')]));
  check(`${f}: every panel renders identically in forward and shuffled seek order (${times.length} times, ${P.stages.length} cells)`, fw.every((s, i) => s === second.get(i)));
  check(`${f}: a cell is drawn only while it can be on screen, and the cell in view is always drawn`, P.stages.every((s, i) => cellVisible(P, s, (s.t0 + (s.until ?? P.seconds)) / 2) && (i === 0 || !cellVisible(P, s, s.t0 - 0.5)) && (i === P.stages.length - 1 || !cellVisible(P, s, s.until + P.camera.travelS + 0.3))));
}

/* ---------- 4. in frame: sources, methods, the ILLUSTRATIVE pill, type floors, the safe zone ---------- */
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const TXT = /<text x="([\d.-]+)" y="([\d.-]+)" font-family="([^"]*)" font-size="([\d.]+)" font-weight="(\d+)" fill="[^"]*" text-anchor="(\w+)" letter-spacing="(-?[\d.]+)"([^>]*)>([^<]*)<\/text>/g;
const textsOf = (svg) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => unesc(m[1]));
const flat = (svg) => textsOf(svg).join(' ').replace(/\s+/g, ' ');
/* text boxes in frame px (a tiny affine stack for the translate / scale wrappers, uniform scale only) and each text's effective opacity (the product of the opacity of every group around it and its own) */
function boxes(svg) {
  const out = [], st = [[1, 0, 0, 1]]; const cmp = (p, c) => [p[0] * c[0], p[0] * c[1] + p[1], p[0] * c[2] + p[2], p[3] * c[3]];
  for (const m of svg.matchAll(/<g\b[^>]*?(\/?)>|<\/g>|<text\b[^>]*>[^<]*<\/text>/g)) { const t = m[0];
    if (t === '</g>') { st.pop(); continue; }
    if (t.startsWith('<g')) { if (t.endsWith('/>')) continue; const tr = /transform="([^"]*)"/.exec(t), oq = / opacity="([\d.]+)"/.exec(t); let k = 1, tx = 0, ty = 0;
      if (tr) for (const f of tr[1].matchAll(/(translate|scale)\(([^)]*)\)/g)) { const v = f[2].trim().split(/[\s,]+/).map(Number); if (f[1] === 'scale') k *= v[0]; else { tx += k * v[0]; ty += k * (v[1] ?? 0); } }
      st.push(cmp(st.at(-1), [k, tx, ty, oq ? +oq[1] : 1])); continue; }
    const mm = [...t.matchAll(TXT)][0]; if (!mm) continue; const [, x, y, ff, sz, wt, an, ls, rest, str] = mm, mono = /Mono/.test(ff), A = st.at(-1), size = +sz, own = / opacity="([\d.]+)"/.exec(rest);
    const w = measure(unesc(str), size, { weight: +wt, font: mono ? MONO : undefined, ls: +ls }), l = an === 'end' ? +x - w : an === 'middle' ? +x - w / 2 : +x;
    out.push({ str: unesc(str), mono, l: A[0] * l + A[1], r: A[0] * (l + w) + A[1], t: A[0] * (+y - size * 0.74) + A[2], b: A[0] * (+y + size * 0.12) + A[2], size: A[0] * size, op: A[3] * (own ? +own[1] : 1) }); }
  return out;
}
const stageNums = (P, s) => P.honesty.numbers.filter((n) => ({ setting: n.path.startsWith('setting.'), builder: n.path.startsWith('builder.'), h2h: n.path.startsWith('h2h.'), numbers: n.path.startsWith('numbers.'), cards: n.path.startsWith('cards.') })[s.kind]);
const PANELS = ['setting', 'builder', 'h2h', 'numbers', 'cards', 'end'];   // the panels that carry the ILLUSTRATIVE pill: every one with a number, the builder (whatever it is) and the end card
const pillOf = (svg) => boxes(svg).filter((b) => b.str === PILL_LABEL);
for (const [f, k, P] of CASES) {
  const Lyt = layout(P), zone = safeRect(P.safeZone, P.W, P.H), s = 1 + P.camera.push, ox = P.W / 2, oy = P.H / 2, tall = f === 'tall'; let bad = [], missing = [], pillBad = [], fineMin = 99, rest = 99; const spots = [];
  for (const st of P.stages) { const t = Math.min((st.until ?? P.seconds) - 0.15, st.at + 4.8), svg = stage(P, st, t, Lyt), text = flat(svg), bs = boxes(svg);
    for (const n of stageNums(P, st)) { if (!text.includes(n.source.replace(/\s+/g, ' '))) missing.push(`${st.kind}: source of ${n.path}`); if (!text.includes(n.method.replace(/\s+/g, ' '))) missing.push(`${st.kind}: method of ${n.path}`); }
    const pills = pillOf(svg); if (PANELS.includes(st.kind)) { if (pills.length !== 1) pillBad.push(`${st.kind}: ${pills.length} pills`); else { spots.push([pills[0].l, pills[0].t]); if (pills[0].size < pillPx(tall) - 1e-6) pillBad.push(`${st.kind}: pill ${pills[0].size.toFixed(1)} px < ${pillPx(tall)}`); } } else if (pills.length) pillBad.push(`${st.kind}: a pill on a panel without numbers`);
    for (const b of bs) { if (b.str.trim().length < 2) continue; if (b.str === PILL_LABEL) continue; if (b.mono && /^(source|method):/.test(b.str)) fineMin = Math.min(fineMin, b.size); else rest = Math.min(rest, b.size);
      const L = ox + s * (b.l - ox), R = ox + s * (b.r - ox), Tt = oy + s * (b.t - oy), B = oy + s * (b.b - oy), tol = 2;   // px: the zone is a hard limit, 2 px for rounding
      if (L < zone.x0 - tol || R > zone.x1 + tol || Tt < zone.y0 - tol || B > zone.y1 + tol) bad.push(`${st.kind} "${b.str.slice(0, 28)}" ${[L, Tt, R, B].map(Math.round)} vs ${[zone.x0, zone.y0, zone.x1, zone.y1].map(Math.round)}`); } }
  const spotOk = spots.length > 0 && spots.every((q) => Math.abs(q[0] - spots[0][0]) < 1 && Math.abs(q[1] - spots[0][1]) < 1);
  check(`${f}/${k}: every number's source and method print on its panel`, missing.length === 0, missing.slice(0, 4).join(' | '));
  check(`${f}/${k}: the ILLUSTRATIVE pill is drawn once on each of ${PANELS.filter((x) => P.stages.some((q) => q.kind === x)).join(', ')} (not on the claim or name), at least ${pillPx(tall)} px, ${pillBad.join(' | ')}`, pillBad.length === 0, pillBad.join(' | '));
  check(`${f}/${k}: the pill sits at the same spot on every panel (the eye learns where to look)`, spotOk, JSON.stringify(spots));
  const floorRest = k === 'trace' ? 15 : 17;   // ui.branchTrace's own labels are 15 px at 1080 (the pack's part): fine on a TV, small on a phone, which is why 9:16 refuses it
  check(`${f}/${k}: type floors at 1080: fine print drawn here ${fineMin === 99 ? 'n/a' : fineMin.toFixed(1)} px (>= ${tall ? 24 : 20}), everything else ${rest.toFixed(1)} px (>= ${floorRest}, the parts' own footnotes and labels)`, (fineMin === 99 || fineMin >= (tall ? 24 : 20)) && rest >= floorRest - 1e-6);
  check(`${f}/${k}: every text sits inside the ${P.safeZone} safe zone after the camera push`, bad.length === 0, bad.slice(0, 3).join(' | '));
}
/* the pill is TIED to the flag: with real sources and illustrative false it is nowhere (mutation guard for "the pill is drawn") */
{ const C = W('wide'); const real = 'Acme Reader benchmark run, March', how = 'mean graded answer over the full task set'; C.illustrative = false; C.brand.name = 'Acme Reader';
  const fix = (o) => { if (o && typeof o === 'object') { if ('source' in o) o.source = real; if ('method' in o) o.method = how; Object.values(o).forEach(fix); } }; fix(C.setting); fix(C.builder); fix(C.h2h); fix(C.numbers); fix(C.cards);
  const probs = problems(C); const P = buildPlan(C), Lyt = layout(P), all = P.stages.map((st) => pillOf(stage(P, st, Math.min((st.until ?? P.seconds) - 0.15, st.at + 4.8), Lyt)).length);
  check('with real sources and illustrative: false the film is not labelled and no panel draws the pill', probs.length === 0 && P.illustrative === false && all.every((n) => n === 0) && !P.stages.some((st) => /illustrative/i.test(JSON.stringify(st.part?.params?.note ?? ''))), probs.join(' | ') + ' ' + all.join(',')); }
/* the label is never later than the number: sampled every 0.1 s, the pill is at least as visible as the biggest number on the panel, and the fine print is fully visible by 1.2 s */
for (const [f, k, P] of CASES.filter((c) => c[1] !== 'trace')) {
  const Lyt = layout(P), late = [], fine = []; const NUM = /[0-9]/;
  for (const st of P.stages.filter((x) => ['setting', 'builder', 'h2h', 'numbers', 'cards'].includes(x.kind))) {
    for (let u = 0; u <= 1.5; u += 0.1) { const bs = boxes(stage(P, st, st.at + u, Lyt)), big = bs.filter((b) => NUM.test(b.str) && b.size >= 40), pill = bs.find((b) => b.str === PILL_LABEL), nOp = Math.max(0, ...big.map((b) => b.op)), pOp = pill ? pill.op : 0;
      if (nOp > 0.05 && pOp < nOp - 0.05) late.push(`${st.kind}@${u.toFixed(1)} number ${nOp.toFixed(2)} pill ${pOp.toFixed(2)}`); }
    const bs = boxes(stage(P, st, st.at + 1.2, Lyt)), fp = bs.filter((b) => /^(sources?|method):/.test(b.str)); if (st.kind !== 'builder' || k === 'table') if (!fp.length || fp.some((b) => b.op < 0.95)) fine.push(`${st.kind}: ${fp.map((b) => b.op.toFixed(2)).join(',') || 'no fine print'}`); }
  check(`${f}/${k}: the pill is never less visible than the big numbers (0-1.5 s of every number panel, step 0.1 s)`, late.length === 0, late.slice(0, 4).join(' | '));
  check(`${f}/${k}: the source and method lines are fully visible 1.2 s after a panel starts (not 1.4-2.0 s)`, fine.length === 0, fine.join(' | ')); }
for (const [f, k, P] of CASES.filter((c) => c[1] === 'scatter')) {   // the panels drawn here: no two text boxes overlap, at the settled frame and while the content builds
  const Lyt = layout(P), bad = [];
  for (const st of P.stages.filter((x) => !x.part)) for (const dt of [0.5, 1.4, 2.2, 4.0]) { const bs = boxes(stage(P, st, Math.min(st.until - 0.15, st.at + dt), Lyt)).filter((b) => b.str.trim().length > 1 && b.op > 0.3);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (a.l < b.r - 3 && b.l < a.r - 3 && a.t < b.b - 3 && b.t < a.b - 3) bad.push(`${st.kind}@${dt} "${a.str.slice(0, 24)}" x "${b.str.slice(0, 24)}"`); } }
  check(`${f}: no two texts overlap on the panels drawn here (claim, name, method card, numbers, cards, end)`, bad.length === 0, [...new Set(bad)].slice(0, 4).join(' | ')); }
{ const Lyt = layout(plan), none = plan.stages.filter((s) => !s.part && ['claim', 'name', 'end'].includes(s.kind)).map((s) => flat(stage(plan, s, s.at + 3, Lyt)).replace(PILL_LABEL, ''));
  check('claim, name and end panels print no number', none.every((t) => !/[0-9]/.test(t.replace(/reader\.example/g, '')))); }
check('the claim panel prints the claim words in order, the accent word in the accent colour', (() => { const svg = stage(plan, plan.stages[0], 3.2); return flat(svg) === plan.claim.words.join(' ') && new RegExp(`fill="${plan.brand.accent}"[^>]*>${plan.claim.words[plan.claim.accent[0]]}<`).test(svg); })());
check('the end panel prints the url and holds still (identical frames 3 s apart)', (() => { const e = plan.stages.at(-1); return flat(stage(plan, e, e.at + 2)).includes(plan.brand.url) && stage(plan, e, e.at + 3) === stage(plan, e, plan.seconds - 0.3); })());

/* ---------- 5. VO ---------- */
{ const C = clone(CONFIG); C.vo = { words: WORDS, audio: null }; const P = buildPlan(C), words = JSON.parse(fs.readFileSync(WORDS, 'utf8')).words, inside = (t) => words.find((w) => w.s + 1e-6 < t && t < w.e - 1e-6);
  check('VO: the example words are placeholders, labelled as such, at about 160 wpm', /PLACEHOLDER/.test(JSON.parse(fs.readFileSync(WORDS, 'utf8')).source) && (() => { const n = words.length, span = words.at(-1).e - words[0].s; return n / span * 60 > 110 && n / span * 60 < 175; })());
  check('VO: every stage change (each camera leg start) falls in a speech gap, never inside a word', P.camera.legs.length === 7 && P.camera.legs.every((l) => !inside(l.t0) && !inside(l.t0 + 0.05)));
  check('VO: the camera leaves for the end card only after the last word', P.stages.at(-1).t0 > words.at(-1).e);
  check('VO: mode vo, vo.wav, duck depth, a transcript for ears, no planned open (the voice leads)', P.audio.mode === 'vo' && P.vo === 'vo.wav' && P.duckDb === CONFIG.duckDb && P.voice.words.length === words.length && !P.audio.quiet.some((q) => q.kind === 'open') && P.audio.quiet.some((q) => q.kind === 'hold'));
  check('VO: every cue under a word sits under the voice (overVoDb), the ones in a breath do not', P.cues.every((c) => (c.overVoDb !== undefined) === !!words.some((w) => c.t >= w.s - 0.1 && c.t <= w.e + 0.15)) && P.cues.some((c) => c.overVoDb !== undefined));
  check('VO: each stage gets the speech its build needs (no warning for the example)', !P.warnings.some((w) => /^vo:/.test(w)), P.warnings.join(' | '));
  fs.mkdirSync(path.join(tmp, 'vo'), { recursive: true }); fs.writeFileSync(path.join(tmp, 'vo', 'plan.json'), JSON.stringify(P));
  const r = spawnSync(PY, [path.join(here, 'vo.py'), path.join(tmp, 'vo', 'plan.json'), path.join(tmp, 'vo', 'vo.wav')], { encoding: 'utf8' });
  check('VO: vo.py builds the labelled guide signal for a dry run (no recording, no speech service)', r.status === 0 && /guide \(placeholder, not a voice\)/.test(r.stdout) && fs.statSync(path.join(tmp, 'vo', 'vo.wav')).size > 48000 * 8 * (P.seconds - 1), `${r.stderr.slice(-200)}`);
  const few = path.join(tmp, 'few.json'); fs.writeFileSync(few, JSON.stringify({ words: [{ w: 'One', s: 0.2, e: 0.5 }, { w: 'long', s: 0.55, e: 0.9 }, { w: 'sentence.', s: 0.95, e: 1.4 }] })); const C2 = clone(CONFIG); C2.vo = { words: few, audio: null };
  let msg = ''; try { buildPlan(C2); } catch (e) { msg = e.message; }
  check('VO: too few speech gaps for the stages is refused with a way to fix it', /stage changes fit the speech gaps/.test(msg) && /one sentence per stage/.test(msg), msg.slice(0, 120)); }

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
