/* the shared project file (templates/_shared/project.mjs + project.schema.json) and every genre template's PROJECT_MAP (node only, no browser). run: node tools/tests/project.test.mjs
   1 the loader: schema errors name the field and suggest the fix (unknown key, wrong type, bad colour, missing src), honesty (a digit on screen needs a sourced claim; a generic
     source is refused), missing files, typos of a mapped key, unsupported aspects, required slots, --set (unknown key, list-item fields, aspect through the map), SRT and words.json
   2 every template's PROJECT_MAP sends every field to a real CONFIG path (a full project applies without a template bug), and the example project validates
   3 THE REGRESSION: for each genre template, the plan built from CONFIG, from CONFIG + an empty project, from CONFIG + {version, template} and from --aspect <its default>
     is byte-identical, and equals the committed out/plan.json (the retrofit changed no default output) */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { reporter } from '../../layers/tests/harness.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), R = reporter('project file');
const P = await import(pathToFileURL(path.join(ROOT, 'templates/_shared/project.mjs')).href);
const { PLATFORMS, lintClaims, lintTransitions, lintPace } = await import(pathToFileURL(path.join(ROOT, 'templates/_shared/plan.mjs')).href);
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mp-project-'));
const GENRE = ['ad', 'beat-edit', 'character-spot', 'film-scene', 'multi-voice-doc', 'proof-film', 'talking-head'];
const tpl = async (id) => import(pathToFileURL(path.join(ROOT, 'templates', id, 'config.mjs')).href);
const problems = (fn) => { try { fn(); return []; } catch (e) { if (!(e instanceof P.ProjectError)) throw e; return e.problems; } };
const has = (ps, re) => ps.some((p) => re.test(p));
const parse = (o) => problems(() => P.parseProject(JSON.stringify(o)));
const write = (name, o) => { const f = path.join(TMP, name); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };

/* ---------- 1 the loader ---------- */
const schema = P.readSchema();
R.check('schema platforms are exactly plan.mjs PLATFORMS', JSON.stringify([...schema.properties.platforms.items.enum].sort()) === JSON.stringify(Object.keys(PLATFORMS).sort()));
R.check('schema aspects are the four the loader sizes', JSON.stringify(schema.properties.aspects.items.enum) === JSON.stringify(Object.keys(P.ASPECT_SIZES)));
R.check('the example project validates (comments, files, honesty)', problems(() => P.loadProject(path.join(ROOT, 'examples/project.example.json'))).length === 0, problems(() => P.loadProject(path.join(ROOT, 'examples/project.example.json'))).join(' | '));
let e = parse({ brand: { colour: '#fff' } }); R.check('unknown key names the field and the known keys', has(e, /^brand\.colour: unknown key.*known: name, accent/), e.join(' | '));
e = parse({ brnad: {} }); R.check('a misspelt top-level key suggests the right one', has(e, /brnad: unknown key \(did you mean brand\?\)/), e.join(' | '));
e = parse({ brand: { accent: 'teal' } }); R.check('a colour that is not #hex is refused', has(e, /brand\.accent: "teal" does not match/), e.join(' | '));
e = parse({ media: { hook: { start: 1 } } }); R.check('a media slot without src says src is required (null = placeholder)', has(e, /media\.hook\.src: is required \(src: null renders a labelled placeholder\)/), e.join(' | '));
e = parse({ aspects: ['3:2'] }); R.check('an unknown aspect lists the allowed ones', has(e, /aspects\[0\]: "3:2" is not allowed; allowed: 16:9, 9:16, 1:1, 4:5/), e.join(' | '));
e = parse({ platforms: ['reels.organc'] }); R.check('a misspelt platform suggests the preset', has(e, /did you mean "reels\.organic"/), e.join(' | '));
e = parse({ music: 'bed_tech_pulse_loop8' }); R.check('a music id must be music/<id>', has(e, /^music: /), e.join(' | '));
e = problems(() => P.parseProject('{"brand": {"name": "A",}}')); R.check('broken JSON says how to write a comment', has(e, /not valid JSON.*\/\//), e.join(' | '));
R.check('// keys are comments at every level', parse({ '//': 'x', brand: { '//': 'y', name: 'A' }, text: { '//': 'z' }, media: { '//': 'w', a: { '//': 'v', src: null } }, claims: [{ '//': 'u', text: 'ok' }] }).length === 0);
const hon = (o) => P.honesty(P.stripComments(o));
R.check('a digit in on-screen copy with no claim is refused, naming the key and the fix', has(hon({ text: { headline: 'Saves 40% of your time' } }), /^text\.headline: "Saves 40% of your time" shows a digit.*add \{"text"/));
R.check('a digit in a list line is checked too (text.problem[1])', has(hon({ text: { problem: ['Many tabs.', '12 bills.'] } }), /text\.problem: "12 bills\."/));
R.check('a digit in brand.cta needs a sourced claim', has(hon({ brand: { cta: 'Free for 14 days' } }), /brand\.cta/));
R.check('a keyed claim with a real source backs the copy', hon({ text: { headline: 'Saves 40% of your time' }, claims: [{ text: 'Saves 40% of your time', source: 'our 12-user diary study, March 2026, docs/study.pdf', key: 'text.headline' }] }).length === 0);
R.check('a generic source ("internal benchmark") is refused', has(hon({ claims: [{ text: '3x faster', source: 'Internal-Benchmark' }] }), /a source that says nothing/));
R.check('a claim with a digit and no source is refused', has(hon({ claims: [{ text: '3x faster' }] }), /has a digit and no source/));
R.check('copy with no digit needs no claim', hon({ text: { headline: 'Every note, *found*.' } }).length === 0);
e = problems(() => P.loadProject(write('missing.json', { media: { hook: { src: 'nope.mp4' } } }))); R.check('a missing media file is named with its resolved path', has(e, /media\.hook\.src: file not found: .*nope\.mp4/), e.join(' | '));
e = problems(() => P.loadProject(path.join(TMP, 'no-such-project.json'))); R.check('a missing project file says so', has(e, /project file not found/));

const ad = await tpl('ad'), pf = await tpl('proof-film'), th = await tpl('talking-head'), be = await tpl('beat-edit');
const apply = (m, project, o = {}) => problems(() => P.applyProject(m.CONFIG, m.PROJECT_MAP, project, { template: o.template || 'x', ASPECTS: m.ASPECTS, ...o }));
e = apply(ad, { text: { hedline: 'Hi' } }, { template: 'ad' }); R.check('a typo of a mapped key is an error with the suggestion', has(e, /text\.hedline: ad has no such field \(did you mean text\.headline\?\)/), e.join(' | '));
let r = P.applyProject(ad.CONFIG, ad.PROJECT_MAP, { text: { intro: 'Introducing' } }, { template: 'ad' }); R.check("another template's field is reported as ignored, not an error", r.ignored.includes('text.intro') && !r.applied.length);
r = P.applyProject(ad.CONFIG, ad.PROJECT_MAP, { brand: { name: 'Fernwick' }, text: { problem: 'One line.' } }, { template: 'ad' });
R.check('brand.name fans out (brand.name + product.name) and a list field wraps a single string', r.config.brand.name === 'Fernwick' && r.config.product.name === 'Fernwick' && JSON.stringify(r.config.problem.lines) === '["One line."]');
R.check('applyProject never mutates the template CONFIG', ad.CONFIG.brand.name === 'Orbit');
e = apply(pf, {}, { template: 'proof-film', aspect: '1:1' }); R.check('an aspect a template lays out by hand only is refused with the reason', has(e, /aspect 1:1: proof-film needs a MANUAL re-layout.*build 16:9 \/ 9:16 instead/), e.join(' | '));
r = P.applyProject(pf.CONFIG, pf.PROJECT_MAP, {}, { template: 'proof-film', aspect: '9:16', ASPECTS: pf.ASPECTS }); R.check('aspect 9:16 maps to proof-film format tall', r.config.format === 'tall');
e = apply(th, { media: { input: { src: null } } }, { template: 'talking-head' }); R.check('a required slot set to null is refused (no placeholder for a person)', has(e, /media\.input\.src: talking-head needs a real file here/), e.join(' | '));
e = problems(() => P.applyProject({ input: null }, { 'media.input.src': { to: 'input', required: true } }, {}, { template: 'fixture' })); R.check('a required slot the project omits, with no default, is refused', has(e, /media\.input\.src: fixture needs it \(required slot\)/), e.join(' | '));
e = problems(() => P.applyProject(ad.CONFIG, { 'text.headline': 'hook.lyne' }, { text: { headline: 'x' } }, { template: 'ad' })); R.check('a PROJECT_MAP that points at no CONFIG field is reported as a template bug', has(e, /PROJECT_MAP of ad sends it to "hook\.lyne" is not a CONFIG field/), e.join(' | '));
e = problems(() => P.applyProject(ad.CONFIG, ad.PROJECT_MAP, { overrides: { ad: { lenght: 30 } } }, { template: 'ad' })); R.check('an unknown override path suggests the CONFIG field', has(e, /overrides\.ad\.lenght: .*did you mean length\?/), e.join(' | '));
r = P.applyProject(be.CONFIG, be.PROJECT_MAP, { music: 'music/bed_lofi_warm_loop8' }, { template: 'beat-edit' }); R.check('a music id sets bpm from the manifest (beat-edit stays on the beat)', r.config.music === 'music/bed_lofi_warm_loop8' && r.config.bpm === 75, `bpm ${r.config.bpm}`);
const sets = (m, s) => problems(() => P.applySets(structuredClone(m.CONFIG), s, { MAP: m.PROJECT_MAP, template: 'ad', ASPECTS: m.ASPECTS }));
e = sets(ad, ['lenght=30']); R.check('--set on an unknown key exits with a suggestion', has(e, /cannot --set lenght=30: lenght is not a CONFIG field of ad \(did you mean length\?\)/), e.join(' | '));
R.check('--set may add an optional field to a list item (proof.0.source)', P.applySets(structuredClone(ad.CONFIG), ['proof.0.source=our March study, docs/study.pdf'], { MAP: ad.PROJECT_MAP }).config.proof[0].source === 'our March study, docs/study.pdf');
R.check('--set aspect=9:16 on proof-film goes through the map (format tall)', P.applySets(structuredClone(pf.CONFIG), ['aspect=9:16'], { MAP: pf.PROJECT_MAP, ASPECTS: pf.ASPECTS }).config.format === 'tall');
R.check('--set keeps its old value rules (number, string, key=a=b) and adds true/false/null/JSON', P.coerce('30') === 30 && P.coerce('9:16') === '9:16' && P.coerce('null') === null && P.coerce('[1,2]')[1] === 2 && P.applySets({ a: '' }, ['a=x=y']).config.a === 'x=y');
const srt = P.parseSrt('1\n00:00:01,000 --> 00:00:02,000\nHello there\n\n2\n00:00:02,500 --> 00:00:03,100\n<i>Bye</i>\n');
R.check('SRT: words spread evenly over each cue, tags stripped', JSON.stringify(srt) === JSON.stringify([{ w: 'Hello', s: 1, e: 1.5 }, { w: 'there', s: 1.5, e: 2 }, { w: 'Bye', s: 2.5, e: 3.1 }]), JSON.stringify(srt));
R.check('words.json as a list or {words} reads the same', JSON.stringify(P.readWords(write('w1.json', [{ w: 'a', s: 0, e: 0.2 }])).words) === JSON.stringify(P.readWords(write('w2.json', { words: [{ w: 'a', s: 0, e: 0.2 }] })).words));
e = problems(() => P.readWords(write('w3.json', [{ word: 'a', s: 0, e: 1 }]))); R.check('a words.json entry of the wrong shape is named', has(e, /voice\.words\[0\]/), e.join(' | '));

/* ---------- 2 every PROJECT_MAP points at real CONFIG paths ---------- */
const PLATE = path.join(ROOT, 'templates/_shared/media/plate-devices.mp4');
function sample(key, m) {
  if (/^brand\.(accent|ink|paper|muted)$/.test(key)) return '#335577'; if (key === 'brand.logo') return path.join(ROOT, 'examples/project-assets/fernwick-mark.svg');
  if (key === 'music') return 'music/bed_playful_bounce_loop8'; if (key === 'claims') return [{ text: 'Plain claim.' }]; if (key === 'length') return 15;
  if (key === 'voice.words') return path.join(ROOT, 'templates/proof-film/words.example.json'); if (key === 'voice.audio') return PLATE;
  if (key === 'media.clips.src') return path.join(ROOT, 'templates/multi-voice-doc/clips.json');
  if (/^media\.[^.]+\.src$/.test(key)) return PLATE; if (/\.start$/.test(key)) return 0.5; if (key === 'aspect') return Object.keys(m.ASPECTS).find((a) => m.ASPECTS[a].how !== 'manual');
  if (key === 'platform') return 'x.video'; const d = m.PROJECT_MAP[key]; return d && (d.list || d.split) ? ['Word', 'Two'] : 'Sample line';
}
for (const id of GENRE) {
  const m = await tpl(id), map = m.PROJECT_MAP || {}, project = {}; let aspect = null, platform = null;
  for (const k of Object.keys(map)) { const v = sample(k, m); if (k === 'aspect') { aspect = v; continue; } if (k === 'platform') { platform = v; continue; } let o = project; const ks = k.split('.'); for (const q of ks.slice(0, -1)) o = o[q] ??= {}; o[ks.at(-1)] = v; }
  let err = []; try { const res = P.applyProject(m.CONFIG, map, project, { template: id, aspect, platform, ASPECTS: m.ASPECTS }); err = res.ignored.filter((k) => !['aspect', 'platform'].includes(k)); } catch (x) { err = x.problems || [x.message]; }
  R.check(`${id}: every PROJECT_MAP field (${Object.keys(map).length}) lands on a real CONFIG path`, !err.length, err.join(' | '));
  R.check(`${id}: exports ASPECTS with 16:9 and 9:16 (or marks 9:16 manual with a reason)`, m.ASPECTS && m.ASPECTS['16:9'] && m.ASPECTS['9:16'] && (m.ASPECTS['9:16'].how !== 'manual' || !!m.ASPECTS['9:16'].note));
}

/* ---------- 3 the regression: an empty project changes nothing ---------- */
const lint = (plan) => { plan.lint = { claimsWithoutSource: lintClaims(plan.claims).map((c) => c.text), unmotivatedTransitions: lintTransitions(plan.shots || []), pace: plan.shots && plan.shots.length ? lintPace(plan.shots, plan.paceRule || {}) : null }; return JSON.stringify(plan, null, 1); };
const EMPTY = write('empty.json', {});
for (const id of GENRE) {
  const dir = path.join(ROOT, 'templates', id), m = await tpl(id), base = lint(m.buildPlan(structuredClone(m.CONFIG)));
  const viaEmpty = lint(m.buildPlan((await P.resolve(dir, { project: EMPTY, sets: [] })).C));
  const viaMin = lint(m.buildPlan((await P.resolve(dir, { project: write(`min-${id}.json`, { version: 1, template: id }), sets: [] })).C));
  const am = m.PROJECT_MAP && m.PROJECT_MAP.aspect && P.normEntry(m.PROJECT_MAP.aspect), own = am && am.values ? Object.keys(am.values).find((a) => am.values[a] === P.getPath(m.CONFIG, am.to[0])) : '16:9';   // the template's own default aspect (talking-head is 9:16)
  const viaAspect = lint(m.buildPlan((await P.resolve(dir, { project: EMPTY, aspect: own, sets: [] })).C));
  const committed = fs.readFileSync(path.join(dir, 'out', 'plan.json'), 'utf8');
  R.check(`${id}: plan without a project = with {} = with {version, template} = with --aspect ${own}`, base === viaEmpty && base === viaMin && base === viaAspect, [base === viaEmpty ? '' : 'empty differs', base === viaMin ? '' : 'min differs', base === viaAspect ? '' : 'aspect differs'].filter(Boolean).join(', '));
  R.check(`${id}: and it is the committed out/plan.json (default output unchanged)`, base === committed);
}
const tall = lint(pf.buildPlan((await P.resolve(path.join(ROOT, 'templates/proof-film'), { project: EMPTY, aspect: '9:16', sets: [] })).C));
R.check('proof-film --aspect 9:16 builds exactly the committed out/plan-tall.json', tall === fs.readFileSync(path.join(ROOT, 'templates/proof-film/out/plan-tall.json'), 'utf8'));
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(R.done() && R.failed ? 1 : 0);
