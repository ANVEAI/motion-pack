/* `mp plan` (tools/playbook_plan.mjs): the plan skeleton a format writes. Node only, no browser, no render (CI runs this):
     node tools/tests/playbook-plan.test.mjs
   For the fixture format (tools/tests/fixtures/playbook/formats/launch-film.json) at 15, 30 and 45 s and at both aspects: makePlan is pure (same JSON twice) and runs
   exactly --length on whole frames; the beats are contiguous, in order, and start where the format's fractions say (to a frame); the quiet open, the silence under the
   name, the quiet hold and the bass entry land where the sound shape says; every default id is registered; the plan carries plan.playbook (format, rules, defaults,
   research link) and no TODO marker carries a digit; plan.project validates as a project.json, and once its TODOs are filled from the fixture copy it builds
   through the template's OWN path (project.mjs resolve -> buildPlan -> the lint gate) with no failure, at the template length nearest the request. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), FX = path.join(here, 'fixtures', 'playbook');
const { makePlan, templateInfo, DEFAULTS, ruleIds, honesty } = await import(pathToFileURL(path.join(ROOT, 'tools', 'playbook_plan.mjs')).href);
const P = await import(pathToFileURL(path.join(ROOT, 'templates', '_shared', 'project.mjs')).href);
const { lintPlan } = await import(pathToFileURL(path.join(ROOT, 'templates', '_shared', 'compose.mjs')).href);
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info ? '  | ' + info : ''}`); };
const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('//')).map(([k, x]) => [k, strip(x)])) : v;
const fm = strip(JSON.parse(fs.readFileSync(path.join(FX, 'formats', 'launch-film.json'), 'utf8'))), rules = {};
for (const f of fs.readdirSync(path.join(FX, 'rules'))) for (const r of JSON.parse(fs.readFileSync(path.join(FX, 'rules', f), 'utf8'))) rules[r.id] = r;
const FILL = strip(JSON.parse(fs.readFileSync(path.join(FX, 'fill-launch-film.json'), 'utf8')));
const fill = (v) => Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : typeof v === 'string' && v.startsWith('TODO(') ? FILL[/^TODO\(([^)]*)\)/.exec(v)[1]] ?? v : v;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-plan-test-')), tdir = path.join(ROOT, fm.template), fps = 30;

for (const aspect of ['16:9', '9:16']) {
  const tpl = await templateInfo(path.basename(fm.template), aspect);
  check(`${aspect}: the template's lengths are probed (saas-launch builds 35, 45, 60, 75)`, JSON.stringify(tpl.lengths) === '[35,45,60,75]', JSON.stringify(tpl.lengths));
  for (const L of [15, 30, 45]) {
    const tag = `${fm.id} ${aspect} ${L}s`, o = { length: L, aspect, research: 'research-pack.json' };
    const p = makePlan(fm, rules, o, tpl), p2 = makePlan(fm, rules, o, tpl);
    check(`${tag}: pure (same JSON twice)`, JSON.stringify(p) === JSON.stringify(p2));
    check(`${tag}: runs exactly ${L} s, ${aspect} size`, p.seconds === L && p.aspect === aspect && [p.W, p.H].join('x') === P.ASPECT_SIZES[aspect].join('x'), `${p.seconds} ${p.W}x${p.H}`);
    const S = p.shots, frames = (x) => Math.round(x * fps);
    check(`${tag}: beats contiguous, on whole frames, in format order`, S.every((s, i) => Math.abs(s.start * fps - frames(s.start)) < 1e-3 && (i === 0 ? s.start === 0 : frames(S[i - 1].start) + frames(S[i - 1].dur) === frames(s.start))) && frames(S.at(-1).start) + frames(S.at(-1).dur) === L * fps && S.map((s) => s.id).join() === fm.beats.map((b) => b.id).join());
    check(`${tag}: each beat starts at its fraction (to a frame)`, fm.beats.every((b, i) => Math.abs(S[i].start - b.at[0] * L) <= 1 / fps + 1e-6));
    check(`${tag}: structure.sections mirror the beats`, p.structure.sections.length === S.length && p.structure.sections.every((x, i) => x.name === S[i].id && x.t[0] === S[i].start));
    const q = p.audio.quiet, open = q.find((x) => x.kind === 'open'), name = q.find((x) => x.role === 'name'), hold = q.find((x) => x.kind === 'hold'), nm = S.find((s) => s.id === 'name');
    check(`${tag}: quiet open from 0 inside quiet_open_s at a depth inside quiet_open_db`, open && open.t[0] === 0 && open.t[1] <= 2 && open.db <= -7 && open.db >= -11, JSON.stringify(open));
    check(`${tag}: silence under the name starts on the name beat`, name && name.kind === 'gap' && name.t[0] === nm.start && name.t[1] - name.t[0] <= 1.5 + 1e-6, JSON.stringify(name));
    check(`${tag}: quiet hold over the end beat to the last frame`, hold && hold.t[1] === L && hold.t[0] === S.at(-1).start && S.at(-1).hold === true);
    check(`${tag}: bass enters inside 20-35% of the runtime, on a beat start`, p.audio.bass_entry_s >= 0.2 * L - 1e-6 && p.audio.bass_entry_s <= 0.35 * L + 1e-6 && S.some((s) => s.start === p.audio.bass_entry_s), String(p.audio.bass_entry_s));
    check(`${tag}: master -14 LUFS / -1.5 dBTP`, p.audio.master.lufs === -14 && p.audio.master.true_peak_dbtp === -1.5);
    check(`${tag}: plan.playbook records format, rules, registered defaults, research`, p.playbook.format === fm.id && p.playbook.rules.join() === ruleIds(fm).join() && p.playbook.defaults.length >= 8 && p.playbook.defaults.every((d) => d in DEFAULTS) && p.playbook.research === 'research-pack.json');
    const todos = JSON.stringify(p).match(/TODO\([^"]*/g) || [];
    check(`${tag}: TODO markers where the words go, none with a digit`, todos.length >= fm.beats.length && todos.every((t) => !/\d/.test(t)), todos.find((t) => /\d/.test(t)));
    const hk = p.texts[0], fit = Math.floor((hk.t[1] - hk.t[0] - 0.35) / 0.28 + 1e-9);
    check(`${tag}: hook text slot from 0.12 s with the beat word limit, cut to what the slot can be read in`, hk.t[0] === 0.12 && hk.field === 'text.headline' && hk.maxWords === Math.min(6, fit) && (fit < 6) === !!hk.why, `${hk.maxWords} fit ${fit}`);
    check(`${tag}: honesty helper runs (no unsourced digit claim, no banned word)`, (() => { const h = honesty(p); return !h.claimsWithoutSource.length && !h.banned.length; })());
    /* the template's own build */
    const f0 = path.join(tmp, `p-${aspect.replace(':', 'x')}-${L}-raw.json`); fs.writeFileSync(f0, JSON.stringify(p.project));
    let ok0 = true; try { P.loadProject(f0); } catch (e) { ok0 = false; console.log('   ', e.message); }
    check(`${tag}: plan.project validates as a project.json (TODOs and all)`, ok0);
    const filled = fill(p.project); filled.claims = []; const f1 = path.join(tmp, `p-${aspect.replace(':', 'x')}-${L}.json`); fs.writeFileSync(f1, JSON.stringify(filled));
    check(`${tag}: the fixture fills every TODO`, !JSON.stringify(filled).includes('TODO'), JSON.stringify(filled).match(/TODO[^"]*/)?.[0]);
    let built = null, fails = ['did not build'];
    try { const { C, report } = await P.resolve(tdir, { project: f1, aspect, sets: [] }); const { buildPlan } = await import(pathToFileURL(path.join(tdir, 'config.mjs')).href); built = buildPlan(C); fails = lintPlan(built, false); if (report.warnings.length) console.log('    warn:', report.warnings.join(' | ')); }
    catch (e) { fails = [e.message.split('\n').slice(0, 3).join(' ')]; }
    check(`${tag}: the filled project builds through ${path.basename(fm.template)}'s own path with no lint failure`, built && !fails.length, fails.join(' | '));
    check(`${tag}: ... at the template length nearest the request (${p.project.length} s), at ${aspect}`, built && Math.abs(built.seconds - p.project.length) <= 1 && built.aspect === aspect && built.brand.name === 'Orbit', built && `${built.seconds} ${built.aspect}`);
  }
}
/* refusals */
let threw = ''; try { makePlan(fm, rules, { length: 30, aspect: '1:1' }, { id: 'saas-launch', fields: {} }); } catch (e) { threw = e.message; }
check('an aspect the format is not made for is refused with the allowed ones', /16:9, 9:16/.test(threw), threw);
threw = ''; try { makePlan(fm, rules, { length: -3 }, { id: 'saas-launch', fields: {} }); } catch (e) { threw = e.message; }
check('a non-positive length is refused', /positive/.test(threw), threw);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
