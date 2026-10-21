#!/usr/bin/env node
/* motion-pack / tools / mp.mjs: the `mp` CLI. Make a video from any template by editing ONE file (project.json), with no code. Shim: tools/mp.
     mp list [template] [--json]                      templates, the aspects each can build, and the project fields each one uses (its PROJECT_MAP)
     mp new <template>[,<template>] <dir> [--project p.json]   a project folder OUTSIDE the pack: project.json + build/ (a copy-on-write copy of the template; the rest of the pack linked)
     mp set <key> <value> [--dir D]                   edit project.json: brand.accent '#4a18ed', text.headline 'Your desk, *handled*.', aspects 16:9,9:16, config.ad.length 30
     mp build [--aspect A] [--template T] [--dir D]   plan + page (+ the mix) for each template of the project
     mp render [--aspect all|A,B] [--template T] [--workers N] [--dir D]   build and render every aspect -> renders/<template>-<WxH>.mp4 (+ plan + sheet + loudness)
                                                      MP_RENDER_PREFIX="<lock script>" runs every render, eyes and ears pass through a shared lock
                                                      the audio is the template's own master, remuxed under the picture (tools/mp-audio.mjs; --keep-renderer-audio skips it)
     mp check [--dir D]                               ids (check_ids), honesty (project + plan lint + banned demo words + name denylist), eyes, ears, contact sheet per render
     mp brand <logo.svg|png> [--dir D] [--write]      palette candidates from your logo, contrast-checked (frame-design contrast.py), a suggested accent / ink / paper
     mp doctor                                        node, python + venv, ffmpeg, Chrome on the GPU, puppeteer-core, sound libraries, disk
     mp init [<version>] [--force]                    download the tagged release into ~/.motion-pack/<version>, checked against its SHA256SUMS (the pack for an
                                                      agent working outside a clone; mp finds it: MOTION_PACK_HOME, this copy, ~/.motion-pack/<version>)
   The playbook (playbook/: the learnings as graded rules and formats; every one takes --playbook DIR):
     mp formats [--json]                              the formats, one line each (playbook/formats)
     mp styles [<id>] [--json] [--zh]                 the named visual styles (playbook/styles); with an id: its copy-ready prompt, palette, type, sound and parts
     mp brief <brief.md|"idea"> [--goal G] [--platform P] [--format F] [--style S] [--length N] [--out D]   pick the format, write research-pack.md/.json, then mp plan
     mp plan <format> [--style S] [--template T] [--length N] [--aspect A] [--platform P] [--research R] [--out plan.json] [--project-out project.json]   a plan.json skeleton with the defaults and TODOs; --style lays a style over it
     mp lint <plan.json|render.mp4> [--format F] [--json] [--all-checks]   every enforceable rule: PASS / WARN / FAIL with value and fix, a score; exit 1 on a FAIL
     mp study <video.mp4|x-url|study.json> [--format F] [--ours|--reference] [--slug S]   refstudy + lint: our render's gaps vs the exemplars, or candidate rules in playbook/inbox
     mp rules [--area A] [--status S] [--gaps] [--format F] · mp rules promote <inbox.json> [--id C] [--as area.name] [--grade G]   browse the rules, publish candidates
   Every command exits 0 when fine, 1 when a check fails, 2 on a usage or project error (the message names the field and the fix). */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawnSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolvePack, packVersion, init as packInit } from './pack_home.mjs';

/* where the pack is (tools/pack_home.mjs): MOTION_PACK_HOME, else this copy when it is a whole pack, else ~/.motion-pack/<version>, else `mp init`.
   When the pack is another folder, this mp hands the command to that pack's own tools/mp.mjs, so templates and paths always come from one pack. */
const SELF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
{ const [c0, ...a0] = process.argv.slice(2);
  if (c0 === 'init') {
    const v = a0.find((x) => /^\d+\.\d+\.\d+/.test(x)) || packVersion(SELF);
    try { const r = await packInit({ version: v, force: a0.includes('--force') }); console.log(`PACK=${r.pack}\nnext: export MOTION_PACK_HOME="${r.pack}"   ·   "${r.pack}/tools/mp" doctor   ·   build the sound libraries: python3 "${r.pack}/sfx/build_library.py" && python3 "${r.pack}/music/build_music.py"`); process.exit(0); }
    catch (e) { console.error('mp init: ' + e.message); process.exit(1); } }
  const R = resolvePack({ self: SELF });
  if (!R.pack && process.env.MOTION_PACK_HOME) { console.error(`mp: ${R.how}: point it at a clone or an mp init folder, or unset it`); process.exit(2); }
  if (!R.pack) { console.error(`mp: no motion-pack found (${R.how}). Run \`mp init\` to download release ${packVersion(SELF) || '<version>'} into ${R.want || '~/.motion-pack/<version>'} (checksum-verified), or set MOTION_PACK_HOME to a clone.`); process.exit(2); }
  if (fs.realpathSync(R.pack) !== fs.realpathSync(SELF)) process.exit(spawnSync('node', [path.join(R.pack, 'tools', 'mp.mjs'), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, MOTION_PACK_HOME: R.pack } }).status ?? 2); }
const PACK = SELF, TPL = path.join(PACK, 'templates');
const P = await import(pathToFileURL(path.join(TPL, '_shared', 'project.mjs')).href);
const { sizeProblem } = await import(pathToFileURL(path.join(PACK, 'tools', 'mp-size.mjs')).href);   // the WxH-vs-aspect check after every render
const { remuxMaster } = await import(pathToFileURL(path.join(PACK, 'tools', 'mp-audio.mjs')).href);   // the delivered audio is the template's own master (rule sound.no_renderer_lowering)
const HF = 'hyperframes@0.8.142', MIN_FREE_GIB = 10, TAG = (a) => a.replace(':', 'x');
const VENV = process.env.MP_VENV || path.join(os.homedir(), 'Developer', '.venvs', 'motion-pack311');
const PY = process.env.PYTHON || (fs.existsSync(path.join(VENV, 'bin', 'python3')) ? path.join(VENV, 'bin', 'python3') : 'python3');
const ENV = { ...process.env, PYTHON: PY, PATH: path.dirname(PY) + path.delimiter + process.env.PATH };   // make.mjs and render3d.sh call `python3`: the same interpreter
const die = (msg, code = 2) => { console.error('mp: ' + msg); process.exit(code); };
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { stdio: o.capture ? 'pipe' : 'inherit', encoding: 'utf8', env: ENV, ...o });
const flag = (argv, k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const real = (p) => fs.realpathSync(p);
/* heavy jobs (renders, eyes, ears) can go through a shared machine lock: MP_RENDER_PREFIX="/path/render-lock.sh" (split on spaces) replaces caffeinate; --workers N is passed to HyperFrames */
const PREFIX = process.env.MP_RENDER_PREFIX ? process.env.MP_RENDER_PREFIX.split(/\s+/).filter(Boolean) : process.platform === 'darwin' ? ['caffeinate', '-dimsu'] : [];
const heavy = (cmd, args, o = {}) => (PREFIX.length ? run(PREFIX[0], [...PREFIX.slice(1), cmd, ...args], o) : run(cmd, args, o));

/* ---------- templates ---------- */
const isTemplate = (d) => fs.existsSync(path.join(TPL, d, 'config.mjs')) && !d.startsWith('demo-') && !d.startsWith('_');
const allTemplates = () => fs.readdirSync(TPL).filter(isTemplate).sort();
async function info(dir) {
  const m = await import(pathToFileURL(path.join(dir, 'config.mjs')).href), id = path.basename(dir);
  const map = Object.fromEntries(Object.entries(m.PROJECT_MAP || {}).map(([k, e]) => [k, P.normEntry(e)]));
  const aspects = m.ASPECTS || (m.CONFIG && m.CONFIG.aspect ? { '16:9': { how: 'native' }, '9:16': { how: 'native' } } : { '16:9': { how: 'native' } });
  const engine = fs.existsSync(path.join(dir, 'make.mjs')) ? 'hyperframes' : fs.existsSync(path.join(dir, 'scene.html')) ? 'three' : 'plan-only';
  return { id, mod: m, map, aspects, engine, hasMap: !!m.PROJECT_MAP };
}
function current(cfg, e) { const v = e.to.map((t) => P.getPath(cfg, t)); return v.length === 1 ? v[0] : v; }

async function cmdList(argv) {
  const only = argv.find((a) => !a.startsWith('--')), out = [];
  for (const id of only ? [only] : allTemplates()) { if (!isTemplate(id)) die(`no template "${id}" (templates: ${allTemplates().join(', ')})`); const t = await info(path.join(TPL, id));
    out.push({ template: id, engine: t.engine, aspects: t.aspects, fields: Object.fromEntries(Object.entries(t.map).map(([k, e]) => [k, { to: e.to, ...(e.required ? { required: true } : {}), ...(e.values ? { values: Object.keys(e.values) } : {}), ...(e.note ? { note: e.note } : {}), default: current(t.mod.CONFIG, e) }])), projectMap: t.hasMap }); }
  if (argv.includes('--json')) return console.log(JSON.stringify(out, null, 1));
  for (const t of out) {
    console.log(`\n${t.template}  (${t.engine})  aspects: ${Object.entries(t.aspects).map(([a, v]) => `${a} ${v.how}`).join(' · ')}${t.projectMap ? '' : '  [no PROJECT_MAP: only overrides apply]'}`);
    for (const [k, f] of Object.entries(t.fields)) console.log(`  ${(k + (f.required ? ' *' : '')).padEnd(22)} -> ${f.to.join(', ').padEnd(34)} ${f.values ? '[' + f.values.join(' | ') + '] ' : ''}now: ${JSON.stringify(f.default)?.slice(0, 60)}${f.note ? '  (' + f.note + ')' : ''}`);
  }
  console.log('\n* = required. Fields are project.json paths (templates/_shared/project.schema.json); a template ignores fields it does not list.');
}

/* ---------- the project folder ---------- */
function findDir(argv) { let d = path.resolve(flag(argv, '--dir') || process.cwd()); for (;;) { if (fs.existsSync(path.join(d, 'mp.json'))) return d; const up = path.dirname(d); if (up === d) die('no project folder here (mp.json not found): run `mp new <template> <dir>` first, or pass --dir'); d = up; } }
const readMeta = (d) => JSON.parse(fs.readFileSync(path.join(d, 'mp.json'), 'utf8'));
const projectFile = (d) => path.join(d, 'project.json');
function cloneTree(src, dst) {   // copy-on-write where the file system can (APFS clonefile, Linux reflink), a plain copy otherwise; symlinks stay symlinks
  const tries = process.platform === 'darwin' ? [['-c', '-R'], ['-R']] : [['-R', '--reflink=auto'], ['-R']];
  for (const a of tries) if (run('cp', [...a, src, dst], { capture: true }).status === 0) return; die(`could not copy ${src}`);
}
function scaffoldBuild(dir, ids) {
  const B = path.join(dir, 'build'), BT = path.join(B, 'templates'); fs.mkdirSync(BT, { recursive: true });
  for (const e of fs.readdirSync(PACK)) if (!['.git', 'templates', 'node_modules', '.pytest_cache'].includes(e) && !fs.existsSync(path.join(B, e))) fs.symlinkSync(path.join(PACK, e), path.join(B, e));   // the templates find the pack two folders up: build/
  for (const e of fs.readdirSync(TPL)) { const dst = path.join(BT, e); if (fs.existsSync(dst) || fs.lstatSync(path.join(TPL, e)).isSymbolicLink()) continue;
    if (ids.includes(e)) cloneTree(path.join(TPL, e), dst); else fs.symlinkSync(path.join(TPL, e), dst); }
  return B;
}
async function cmdNew(argv) {
  const pos = argv.filter((a, i) => !a.startsWith('--') && !['--project', '--dir'].includes(argv[i - 1]));
  const [tl, d] = pos; if (!tl || !d) die('usage: mp new <template>[,<template>] <dir> [--project p.json]');
  const ids = tl.split(','), bad = ids.filter((t) => !isTemplate(t)); if (bad.length) die(`no template ${bad.join(', ')} (templates: ${allTemplates().join(', ')})`);
  const dir = path.resolve(d); if (fs.existsSync(dir) && fs.readdirSync(dir).length) die(`${dir} exists and is not empty: pick a new folder`);
  if ((dir + path.sep).startsWith(real(PACK) + path.sep) || (dir + path.sep).startsWith(PACK + path.sep)) die('make the project folder OUTSIDE the pack (the pack stays clean; your folder holds your files)');
  if (/\/(Documents|Desktop)(\/|$)/.test(dir) && process.platform === 'darwin') console.error('mp: warning: ~/Documents and ~/Desktop are often iCloud-synced, which can stall renders; a folder under ~/Developer or ~/Movies is safer');
  fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
  let project; const src = flag(argv, '--project');
  if (src) { const { project: p } = P.loadProject(src); const raw = JSON.parse(fs.readFileSync(src, 'utf8')); project = raw;   // keep the user's comments; rebase relative paths onto the new folder
    const rebase = (f) => { if (f == null || path.isAbsolute(f)) return f; const a = path.resolve(path.dirname(path.resolve(src)), f), r = path.relative(dir, a); return r.startsWith('..') ? a : r; };   // inside the new folder: relative; elsewhere: absolute
    if (raw.$schema) raw.$schema = path.join(TPL, '_shared', 'project.schema.json');
    if (raw.brand && raw.brand.logo) raw.brand.logo = rebase(raw.brand.logo); for (const s of Object.values(raw.media || {})) if (s && typeof s === 'object' && s.src) s.src = rebase(s.src);
    if (raw.voice) for (const k of ['words', 'audio']) if (raw.voice[k]) raw.voice[k] = rebase(raw.voice[k]);
    if (!p.template) raw.template = ids.length === 1 ? ids[0] : ids; }
  else project = { $schema: path.join(TPL, '_shared', 'project.schema.json'), '//': 'Edit this file, then run: mp render. Fields: mp list. Schema: ' + path.join(TPL, '_shared', 'project.schema.json'), version: 1, template: ids.length === 1 ? ids[0] : ids, aspects: ['16:9', '9:16'], brand: {}, text: {}, media: {}, claims: [] };
  fs.writeFileSync(projectFile(dir), JSON.stringify(project, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'mp.json'), JSON.stringify({ pack: PACK, templates: ids, created: new Date().toISOString().slice(0, 10), note: 'build/ mirrors the pack: build/templates/<template> is your copy; the rest links to the pack' }, null, 1) + '\n');
  scaffoldBuild(dir, ids);
  P.loadProject(projectFile(dir));   // the new folder must validate
  console.log(`project folder ${dir}\n  project.json   edit this (mp set key value)\n  build/         ${ids.map((t) => 'build/templates/' + t).join(', ')} (copy-on-write), the rest of the pack linked\n  renders/       mp render writes MP4s, plans and contact sheets here\nnext: mp list ${ids[0]}   ·   mp set brand.name "Orbit"   ·   mp render`);
}

function cmdSet(argv) {
  const pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir'), [k, ...vs] = pos; if (!k || !vs.length) die('usage: mp set <key> <value>   e.g. mp set brand.accent "#4a18ed" · mp set aspects 16:9,9:16 · mp set config.ad.length 30');
  const dir = findDir(argv), file = projectFile(dir), raw = JSON.parse(fs.readFileSync(file, 'utf8')), v0 = vs.join(' ');
  let v = ['aspects', 'platforms', 'template'].includes(k) && !v0.startsWith('[') ? (v0.includes(',') || k !== 'template' ? v0.split(',').map((x) => x.trim()).filter(Boolean) : v0) : P.coerce(v0);
  if (typeof v === 'number' && /^text\.|^brand\.|^media\.[^.]+\.(src|label)$/.test(k)) v = v0;   // copy stays a string ("2026")
  let target = k;
  if (k.startsWith('config.')) { const [, t, ...rest] = k.split('.'); if (!t || !rest.length) die('config.<template>.<CONFIG path>, e.g. config.ad.length'); target = `overrides.${t}.${rest.join('.')}`;
    raw.overrides ??= {}; raw.overrides[t] ??= {}; raw.overrides[t][rest.join('.')] = v; }
  else { const ks = k.split('.'); let o = raw; for (const q of ks.slice(0, -1)) { o[q] ??= {}; o = o[q]; } if (v === null && ks[0] === 'media' && ks.length === 2) v = { ...(typeof o[ks.at(-1)] === 'object' && o[ks.at(-1)] ? o[ks.at(-1)] : {}), src: null }; o[ks.at(-1)] = v; }   // a media slot set to null keeps its label: a labelled placeholder
  const text = JSON.stringify(raw, null, 2) + '\n';
  try { P.parseProject(text, file); const pr = P.stripComments(JSON.parse(text)); const errs = P.honesty(pr); if (errs.length) throw new P.ProjectError(errs, file); }
  catch (e) { if (e instanceof P.ProjectError) die(`${target} not set:\n  - ${e.problems.join('\n  - ')}`); throw e; }
  fs.writeFileSync(file, text); console.log(`${target} = ${JSON.stringify(v)}`);
}

/* ---------- build / render ---------- */
function targets(argv, dir) { const t = flag(argv, '--template'), meta = readMeta(dir), proj = JSON.parse(fs.readFileSync(projectFile(dir), 'utf8'));
  const ids = t && t !== 'all' ? t.split(',') : [].concat(proj.template || meta.templates); for (const id of ids) if (!fs.existsSync(path.join(dir, 'build', 'templates', id))) scaffoldBuild(dir, [id]); return ids; }
function newest(dir, re, since) { let best = null; for (const f of fs.readdirSync(dir, { recursive: true })) { if (!re.test(f) || /assets\//.test(f)) continue; const p = path.join(dir, f), m = fs.statSync(p).mtimeMs; if (m >= since && (!best || m > best.m)) best = { p, m }; } return best && best.p; }
let STRICT = false;   // --strict on build / render: a project field the template does not use is an error
async function build(dir, id, aspect) {
  const T = path.join(dir, 'build', 'templates', id), t = await info(T), proj = projectFile(dir), t0 = Date.now() - 1000;
  const args = ['--project', proj, ...(aspect ? ['--aspect', aspect] : []), ...(STRICT ? ['--strict'] : [])];
  const r = t.engine === 'hyperframes' ? run('node', [path.join(T, 'make.mjs'), ...args], { cwd: T }) : run('node', [path.join(T, '..', '_shared', 'cues.mjs'), T, ...args], { cwd: T });
  if (r.status !== 0) return { ok: false, status: r.status };
  const plan = newest(path.join(T, 'out'), /^plan[^/]*\.json$/, t0) || path.join(T, 'out', 'plan.json'), page = t.engine === 'hyperframes' ? newest(T, /(^|\/)index\.html$/, t0) : path.join(T, 'scene.html');
  return { ok: true, T, t, plan, project: page && path.dirname(page) };
}
function aspectsFor(argv, dir, t) {
  const a = flag(argv, '--aspect'), proj = P.stripComments(JSON.parse(fs.readFileSync(projectFile(dir), 'utf8'))), auto = Object.entries(t.aspects).filter(([, v]) => v.how !== 'manual').map(([k]) => k);
  const want = !a ? (proj.aspects || ['16:9']) : a === 'all' ? Object.keys(ASP) : a.split(',');
  return { build: want.filter((x) => auto.includes(x)), manual: want.filter((x) => !auto.includes(x)).map((x) => [x, (t.aspects[x] && t.aspects[x].note) || 'not supported by this template']) };
}
const ASP = P.ASPECT_SIZES;
async function cmdBuild(argv) {
  const dir = findDir(argv); let bad = 0;
  for (const id of targets(argv, dir)) { const t = await info(path.join(dir, 'build', 'templates', id)), A = aspectsFor(argv, dir, t);
    for (const [a, why] of A.manual) console.log(`${id} ${a}: skipped, needs a manual re-layout (${why})`);
    for (const a of flag(argv, '--aspect') || A.build.length ? A.build : [null]) { const b = await build(dir, id, a); console.log(`${id}${a ? ' ' + a : ''}: ${b.ok ? 'built ' + path.relative(dir, b.plan) : 'FAILED (exit ' + b.status + ')'}`); if (!b.ok) bad = b.status || 1; } }
  process.exit(bad);
}
const freeGiB = () => { const l = spawnSync('df', ['-k', '.'], { encoding: 'utf8' }).stdout.trim().split('\n').pop().split(/\s+/); return +l[3] / 1048576; };
async function cmdRender(argv) {
  const dir = findDir(argv), R = path.join(dir, 'renders'), crf = flag(argv, '--crf', '23'); fs.mkdirSync(R, { recursive: true }); let bad = 0;
  for (const id of targets(argv, dir)) { const t = await info(path.join(dir, 'build', 'templates', id)), A = aspectsFor(argv, dir, t);
    for (const [a, why] of A.manual) console.log(`${id} ${a}: NOT rendered, this template needs a manual re-layout for it (${why})`);
    for (const a of A.build) {
      const free = freeGiB(); if (free < MIN_FREE_GIB) die(`${free.toFixed(1)} GiB free, under ${MIN_FREE_GIB}: stopping before a render`, 1);
      const out = path.join(R, `${id}-${TAG(a)}.mp4`); let ok;
      if (t.engine === 'hyperframes') { const b = await build(dir, id, a); if (!b.ok) { bad = 1; continue; }
        const w = flag(argv, '--workers'); ok = heavy('npx', ['-y', HF, 'render', b.project, '-o', out, '--crf', crf, ...(w ? ['--workers', w] : [])], { cwd: b.project }).status === 0; if (ok) fs.copyFileSync(b.plan, out.replace(/\.mp4$/, '.plan.json'));
        if (ok && !argv.includes('--keep-renderer-audio')) { const m = remuxMaster(b.project, out); console.log(`${id} ${a}: audio ${m.remuxed ? `remuxed from the master (${m.remuxed}), so the renderer cannot lower it` : `kept as rendered: ${m.kept}`}`); } }
      else if (t.engine === 'three') { const T = path.join(dir, 'build', 'templates', id), tag = (t.aspects[a] && t.aspects[a].tag) || 'wide';
        ok = heavy('bash', [path.join(T, '..', '_shared', 'render3d.sh'), T, 'scene.html', tag, crf], { env: { ...ENV, MP_PROJECT: projectFile(dir) } }).status === 0;
        if (ok) { fs.renameSync(path.join(T, 'out', `${id}-${tag}.mp4`), out); fs.copyFileSync(path.join(T, 'out', 'plan.json'), out.replace(/\.mp4$/, '.plan.json')); } }
      else { console.log(`${id}: no renderer (no make.mjs or scene.html)`); continue; }
      if (!ok) { console.log(`${id} ${a}: render FAILED or refused (a lock refuses under 10 GiB free): stopping here, no retry; re-run mp render when the machine is free`); process.exit(1); }
      /* the size check (tools/mp-size.mjs): a file at the wrong size for its aspect is a failed render; it is renamed .WRONG-SIZE.mp4 (kept, never deleted) so no mislabelled file is left */
      const wrong = sizeProblem(out, a); if (wrong) { const bad = out.replace(/\.mp4$/, '.WRONG-SIZE.mp4'); fs.renameSync(out, bad); console.log(`${id} ${a}: FAILED the size check: ${wrong}; kept as ${path.basename(bad)}`); process.exit(1); }
      sheet(out); }
  }
  process.exit(bad);
}
function sheet(mp4) {   // stills late in each shot (the type has settled), from the delivered file
  const plan = JSON.parse(fs.readFileSync(mp4.replace(/\.mp4$/, '.plan.json'), 'utf8')), T = plan.seconds || 10;
  const ts = (plan.shots || []).length ? plan.shots.slice(0, 16).map((s) => Math.min(T - 0.05, s.start + Math.max(0.1, Math.min(s.dur - 0.12, s.dur * 0.8)))) : [0.3, T * 0.25, T * 0.5, T * 0.75, T - 0.3];
  const r = run(PY, [path.join(PACK, 'templates', '_shared', 'sheet.py'), mp4, mp4.replace(/\.mp4$/, '.sheet.jpg'), ts.map((x) => x.toFixed(2)).join(',')], { capture: true });
  const m = /LUFS-I (-?[\d.]+) TP (-?[\d.]+)/.exec(r.stdout || ''); console.log(`${path.basename(mp4)}: sheet ${path.basename(mp4).replace(/\.mp4$/, '.sheet.jpg')}${m ? `, ${m[1]} LUFS-I, ${m[2]} dBTP decoded` : ''}`); return m ? { lufs: +m[1], tp: +m[2] } : null;
}

/* ---------- check ---------- */
const { BANNED_DEMO_WORDS: BANNED } = await import(pathToFileURL(path.join(TPL, '_shared', 'plan.mjs')).href);   // BRIEF: demo copy says placeholder / demo data / render / example instead
async function cmdCheck(argv) {
  const dir = findDir(argv), file = projectFile(dir), lines = [], fail = (s) => { lines.push('FAIL ' + s); }, ok = (s) => lines.push('ok   ' + s), warn = (s) => lines.push('warn ' + s);
  let project; try { ({ project } = P.loadProject(file)); ok('project.json validates (schema, files, digits have sourced claims)'); } catch (e) { if (!(e instanceof P.ProjectError)) throw e; fail('project.json:\n       ' + e.problems.join('\n       ')); }
  if (project) { const copy = JSON.stringify([project.text, project.brand, project.claims]).toLowerCase(), hit = BANNED.filter((w) => copy.includes(w)); hit.length ? fail(`banned demo words in the copy: ${hit.join(', ')} (say placeholder, demo data, render or example)`) : ok('no banned demo words');
    const nd = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-names-')); fs.copyFileSync(file, path.join(nd, 'project.json'));   // the user's copy only (build/ is the pack's own files)
    const nm = run(PY, [path.join(PACK, 'tools', 'check_names.py'), '--root', nd, '--denylist', path.join(PACK, 'tools', 'name_denylist.txt')], { capture: true }); fs.rmSync(nd, { recursive: true, force: true }); nm.status === 0 ? ok('no studied account or brand name (tools/check_names.py)') : fail('tools/check_names.py: ' + (nm.stdout + nm.stderr).trim().split('\n').slice(-3).join(' | ')); }
  for (const id of targets(argv, dir)) {
    const T = path.join(dir, 'build', 'templates', id), t = await info(T);
    if (project) { try { const r = P.applyProject(t.mod.CONFIG, t.mod.PROJECT_MAP, project, { template: id, ASPECTS: t.aspects }); ok(`${id}: ${r.applied.length} fields applied${r.ignored.length ? `; not used: ${r.ignored.join(', ')}` : ''}`); for (const w of r.warnings) warn(`${id}: ${w}`); } catch (e) { fail(`${id}: ${e.problems.join(' | ')}`); } }
    const ids = run(PY, [path.join(PACK, 'tools', 'check_ids.py'), T], { capture: true }), un = /unresolved: (\d+)/.exec(ids.stdout || '');
    un && +un[1] === 0 ? ok(`${id}: check_ids 0 unresolved`) : fail(`${id}: check_ids ${un ? un[1] + ' unresolved' : 'did not run'} ${(ids.stdout || '').split('\n').filter((l) => /unresolved|->/.test(l)).slice(0, 4).join(' | ')}`);
    for (const f of fs.readdirSync(path.join(dir, 'renders')).filter((f) => f.startsWith(id + '-') && f.endsWith('.mp4')).sort()) {
      const mp4 = path.join(dir, 'renders', f), planF = mp4.replace(/\.mp4$/, '.plan.json'), base = mp4.replace(/\.mp4$/, '');
      if (fs.existsSync(planF)) { const L = JSON.parse(fs.readFileSync(planF, 'utf8')).lint || {}; const n = (L.claimsWithoutSource || []).length + (L.unmotivatedTransitions || []).length; n ? fail(`${f}: plan lint ${n} problem(s)${L.allowed ? ' (waived with --allow-lint)' : ''}`) : ok(`${f}: plan lint (claims have sources, transitions have reasons)`); }
      { const tg = /-(\d+)x(\d+)\.mp4$/.exec(f), asp = tg && tg[1] + ':' + tg[2], pr = asp && sizeProblem(mp4, asp); if (asp) (pr ? fail : ok)(pr || `${f}: the frame size matches ${asp}`); }
      const m = sheet(mp4); if (m) (Math.abs(m.lufs + 14) <= 0.5 && m.tp <= -1.0 ? ok : fail)(`${f}: ${m.lufs} LUFS-I (target -14 +/- 0.5), ${m.tp} dBTP (<= -1.0)`);
      for (const [tool, script] of [['eyes', 'eyes/look.py'], ['ears', 'ears/listen.py']]) {
        const r = heavy(PY, [path.join(PACK, script), mp4, ...(fs.existsSync(planF) ? ['--plan', planF] : []), '--json', `${base}.${tool}.json`, '--md', `${base}.${tool}.md`, '--quiet'], { capture: true });
        let j = null; try { j = JSON.parse(fs.readFileSync(`${base}.${tool}.json`, 'utf8')); } catch { /* no report */ }
        const checks = j ? (j.checks || j.results || []) : [], fails = checks.filter((c) => c.status === 'fail' || c.verdict === 'fail'), score = j && (j.score ?? (j.summary && j.summary.score));
        (r.status === 0 && j && !fails.length ? ok : fail)(`${f}: ${tool} ${j ? `${fails.length} fail${score != null ? ', score ' + JSON.stringify(score) : ''}` : 'no report (exit ' + r.status + ')'}${fails.length ? ' -> ' + fails.map((c) => c.id || c.name).join(', ') : ''} (${path.basename(base)}.${tool}.md)`); }
    }
  }
  const report = lines.join('\n'); fs.writeFileSync(path.join(dir, 'renders', 'check.txt'), report + '\n'); console.log(report + `\n(report: ${path.join(dir, 'renders', 'check.txt')})`);
  process.exit(lines.some((l) => l.startsWith('FAIL')) ? 1 : 0);
}

/* ---------- brand ---------- */
function cmdBrand(argv) {
  const logo = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir'); if (!logo || !fs.existsSync(logo)) die('usage: mp brand <logo.svg|logo.png> [--dir D] [--write]');
  const r = run(PY, [path.join(PACK, 'tools', 'mp_brand.py'), path.resolve(logo), '--contrast', path.join(PACK, 'skills', 'frame-design', 'scripts', 'contrast.py')], { capture: true });
  if (r.status !== 0 && r.status !== 1) die((r.stderr || r.stdout).trim(), r.status || 2);   // 1 = measured and failing: the report still prints
  const s = JSON.parse(r.stdout); console.log(s.report);
  if (argv.includes('--write')) { const dir = findDir(argv), file = projectFile(dir), raw = JSON.parse(fs.readFileSync(file, 'utf8')); raw.brand ??= {};
    Object.assign(raw.brand, { accent: s.suggest.accent, ink: s.suggest.ink, paper: s.suggest.paper, logo: path.relative(dir, path.resolve(logo)) }); fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n'); console.log(`written to ${file}: brand.accent, brand.ink, brand.paper, brand.logo`); }
  process.exit(s.pass ? 0 : 1);
}

/* ---------- doctor ---------- */
async function cmdDoctor() {
  const rows = [], add = (ok, what, detail, fix = '') => rows.push([ok, what, detail, fix]);
  const nv = +process.versions.node.split('.')[0]; add(nv >= 20, 'node', process.version, nv >= 20 ? '' : 'install Node 20 or newer');
  const py = run(PY, ['-c', 'import sys, numpy, PIL; print(sys.version.split()[0])'], { capture: true }); add(py.status === 0, 'python', `${PY} ${(py.stdout || '').trim()}`, py.status === 0 ? '' : `pip install -r ${path.join(PACK, 'requirements.txt')} (venv: ${VENV})`);
  add(fs.existsSync(VENV), 'venv', VENV, fs.existsSync(VENV) ? '' : `python3 -m venv ${VENV} && ${VENV}/bin/pip install -r requirements.txt (or set MP_VENV / PYTHON)`);
  for (const b of ['ffmpeg', 'ffprobe']) { const r = run(b, ['-version'], { capture: true }); add(r.status === 0, b, r.status === 0 ? r.stdout.split('\n')[0].slice(0, 60) : 'not found', r.status === 0 ? '' : 'brew install ffmpeg / apt install ffmpeg'); }
  try { const C = await import(pathToFileURL(path.join(PACK, 'tools', 'chrome.mjs')).href), exe = C.findChrome(); add(true, 'chrome', exe);
    let pup = null; try { pup = C.findPuppeteer(); add(true, 'puppeteer-core', 'found'); } catch (e) { add(false, 'puppeteer-core', e.message.split('\n')[0], `npm i --no-save puppeteer-core (in ${PACK})`); }
    if (pup) { const b = await pup.launch({ executablePath: exe, headless: true, args: C.chromeArgs() }); try { const pg = await b.newPage(); const gpu = await pg.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return g ? (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'no webgl'; });
      add(!C.isSoftwareGL(gpu) && gpu !== 'no webgl', 'chrome GPU', gpu, C.isSoftwareGL(gpu) ? 'WebGL is software: three.js renders refuse it (check tools/chrome.mjs GPU flags)' : ''); } finally { await b.close(); } } }
  catch (e) { add(false, 'chrome', e.message.split('\n')[0], 'install Google Chrome, or set CHROME_PATH'); }
  const sm = JSON.parse(fs.readFileSync(path.join(PACK, 'sfx', 'manifest.json'), 'utf8')).sounds, have = sm.filter((s) => s.file && fs.existsSync(path.join(PACK, 'sfx', s.file))).length;
  add(have === sm.length, 'sound library', `${have}/${sm.length} WAVs`, have === sm.length ? '' : `python3 ${path.join(PACK, 'sfx', 'build_library.py')}`);
  const mm = JSON.parse(fs.readFileSync(path.join(PACK, 'music', 'manifest.json'), 'utf8')).items, mh = mm.filter((i) => fs.existsSync(path.join(PACK, 'music', i.file))).length;
  add(mh === mm.length, 'music library', `${mh}/${mm.length} WAVs`, mh === mm.length ? '' : `python3 ${path.join(PACK, 'music', 'build_music.py')}`);
  const hf = fs.existsSync(path.join(os.homedir(), '.npm', '_npx')) && fs.readdirSync(path.join(os.homedir(), '.npm', '_npx')).some((d) => fs.existsSync(path.join(os.homedir(), '.npm', '_npx', d, 'node_modules', 'hyperframes')));
  add(true, 'hyperframes', hf ? `${HF} (npx cache has hyperframes)` : `${HF} downloads on the first render`);
  const free = freeGiB(); add(free >= MIN_FREE_GIB, 'disk', `${free.toFixed(1)} GiB free`, free >= MIN_FREE_GIB ? '' : `free space: renders stop under ${MIN_FREE_GIB} GiB`);
  if (/\/(Documents|Desktop)(\/|$)/.test(PACK)) add(false, 'pack folder', PACK, 'iCloud-synced folders stall renders: keep the pack under ~/Developer');
  for (const [ok, w, d, fx] of rows) console.log(`${ok ? 'ok  ' : 'FAIL'} ${w.padEnd(15)} ${d}${fx ? '\n     fix: ' + fx : ''}`);
  process.exit(rows.every((r) => r[0]) ? 0 : 1);
}

/* ---------- the playbook: formats, rules, brief, study and lint are python (tools/playbook*.py), plan is node (it reads the template) ---------- */
const pyTool = (script, args) => () => process.exit(run(PY, [path.join(PACK, 'tools', script), ...args]).status ?? 2);
const nodeTool = (script, args) => () => process.exit(run('node', [path.join(PACK, 'tools', script), ...args]).status ?? 2);

const [cmd, ...rest] = process.argv.slice(2);
const CMDS = { list: cmdList, new: cmdNew, set: cmdSet, build: cmdBuild, render: cmdRender, check: cmdCheck, brand: cmdBrand, doctor: cmdDoctor,
  formats: pyTool('playbook.py', ['formats', ...rest]), styles: pyTool('playbook.py', ['styles', ...rest]), style: pyTool('playbook.py', ['styles', ...rest]), rules: pyTool('playbook.py', ['rules', ...rest]), lint: pyTool('playbook_lint.py', rest),
  brief: pyTool('playbook_research.py', ['brief', ...rest]), study: pyTool('playbook_research.py', ['study', ...rest]), plan: nodeTool('playbook_plan.mjs', rest) };
if (!CMDS[cmd]) { const head = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n'); console.log(head.slice(1, head.findIndex((l) => l.includes('*/')) + 1).join('\n').replace(/^\/\* /, '   ').replace(/ \*\/$/, '')); process.exit(cmd && !['help', '--help', '-h'].includes(cmd) ? 2 : 0); }
STRICT = rest.includes('--strict');
try { await CMDS[cmd](rest); } catch (e) { if (e instanceof P.ProjectError) die(e.message); throw e; }
