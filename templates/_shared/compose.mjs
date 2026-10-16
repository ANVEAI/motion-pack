/* motion-pack/templates/_shared/compose.mjs: stage + write a HyperFrames project from a template plan (node).
   stage(dir, { media: [abs paths], layers: true }) hard-links into <dir>/assets/ (HyperFrames serves only the project dir):
     fonts (Manrope, IBM Plex Mono), mp/pack.mjs + mp/plan.mjs, the named media, and OTHER MODULES when they exist:
       motion-pack/layers/{overlay.js, ease.js, finisher.js, lib/*, presets/*}  -> assets/mp/layers/   (finishing overlays, by kind)
       motion-pack/transitions/lib/{registry,tx-core,tx-dom,ids}.js -> assets/mp/transitions/lib/, motion-pack/type/*.js + type/gfx/*.js -> assets/mp/type/,
       plus _shared/adapters/{type,transitions}.mjs -> assets/mp/adapters/ (they register ids with MP.register)
     Missing modules are listed in the returned `todo` (the template still renders: hard cuts, plain fades, no layers).
   head({ W, H, title, bg }) -> the <head> with GSAP 3.14.2, @font-face for the shared fonts and the base clip CSS. */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { lintClaims, lintTransitions, lintFailures } from './plan.mjs';
const SH = path.dirname(new URL(import.meta.url).pathname), PACK = path.resolve(SH, '..', '..');
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
const jsUnder = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((f) => /\.(m?js)$/.test(f)).map((f) => path.join(d, f)) : []);

/* runPlan(dir, args): run _shared/cues.mjs (plan export + the lint gates) for a make.mjs. When it fails, this process exits with ITS code
   (2 = lint.proof / lint.tx, see templates/README.md) and no Node stack trace; nothing after it (stage, mix, page) runs. */
export function runPlan(dir, args = process.argv.slice(2)) {
  const r = spawnSync('node', [path.join(SH, 'cues.mjs'), dir, ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/* THE LINT GATE, shared: cues.mjs uses it, and so does every make.mjs that builds its own plan instead of running cues.mjs (the part demos).
   allowLint(): --allow-lint on the command line or MP_ALLOW_LINT=1 (render3d.sh), the one documented waiver.
   lintPlan(plan): fills plan.lint.claimsWithoutSource (lint.proof: a claim with a digit and no source) and plan.lint.unmotivatedTransitions (lint.tx: a non-cut transition
     with no txReason) from plan.claims and plan.shots, keeps the other lint fields, records the failures in plan.lint.allowed when waived, and returns them.
   lintStop(fails, who): call it after the plan is written (plan.lint shows what failed): prints the failures and exits 2 unless waived, before anything is staged, mixed or rendered. */
export const allowLint = (argv = process.argv) => argv.includes('--allow-lint') || process.env.MP_ALLOW_LINT === '1';
export function lintPlan(plan, waive = allowLint()) {
  const { claimsWithoutSource, unmotivatedTransitions, ...rest } = plan.lint || {};   // the two gate fields first, then whatever else the plan's lint holds (pace, cutsOnBeat, ...)
  plan.lint = { claimsWithoutSource: lintClaims(plan.claims).map((c) => c.text), unmotivatedTransitions: lintTransitions(plan.shots || []), ...rest };
  const fails = lintFailures(plan.lint); if (fails.length && waive) plan.lint.allowed = fails;   // a waived problem stays on the record (ears, the critic and a reviewer can see it)
  return fails;
}
export function lintStop(fails, who, waive = allowLint()) {
  if (!fails.length) return;
  console.error(`\n${who}: ${fails.length} lint problem${fails.length === 1 ? '' : 's'}${waive ? ' (waived by --allow-lint, recorded in plan.lint.allowed)' : ', build stopped (exit 2)'}\n  - ${fails.join('\n  - ')}`);
  if (!waive) { console.error('\nFix the CONFIG block, or pass --allow-lint to build anyway (MP_ALLOW_LINT=1 for render3d.sh). Never waive a stat that has no source.'); process.exit(2); }
}

/* aspectFlag(argv = process.argv): `--aspect A` (what tools/mp passes, and what cues.mjs / project.mjs read) becomes `--set aspect=A` IN PLACE, unless a `--set aspect=`
   is already there. The shared builders that parse their own `--set` (templates/_hw/makehw.mjs, _shared/saas/make.mjs, _shared/human/build.mjs, _shared/film/make-film.mjs)
   call it when they load, so their plan name, project folder and page follow the aspect being built: they used to read only `--set aspect=`, and `mp render` wrote a
   1920x1080 file named -9x16 for hardware-teaser, trailer, saas-feature-drop and founder-story. Returns argv. */
export function aspectFlag(argv = process.argv) {
  const i = argv.findIndex((a) => a === '--aspect' || a.startsWith('--aspect=')); if (i < 0) return argv;
  const v = argv[i] === '--aspect' ? argv[i + 1] : argv[i].slice(9);
  const has = argv.some((a, k) => a === '--set' && /^aspect=/.test(argv[k + 1] || ''));
  argv.splice(i, argv[i] === '--aspect' ? 2 : 1, ...(has || !v ? [] : ['--set', 'aspect=' + v]));
  return argv;
}

/* mix(planJson, wav, py = 'python3', args = []): run _shared/audio.py (music/mixer.py under it) with its flags in `args` (['--stem'] = a stem under dialogue, never normalised).
   Like runPlan, a failure (a missing music bed, a mixer error) ends this process with audio.py's own message and exit code, not a Node stack trace on top of it.
   The third argument is the PYTHON executable: a flag there (the old talking-head call passed '--stem') is refused, because it would be spawned as a program. */
export function mix(planJson, wav, py = 'python3', args = []) {
  if (typeof py !== 'string' || py.startsWith('-')) { console.error(`mix: the third argument is the python executable, got ${JSON.stringify(py)}; pass audio.py flags in the fourth: mix(plan, wav, py, ['--stem'])`); process.exit(2); }
  const r = spawnSync(py, [path.join(SH, 'audio.py'), planJson, wav, ...args], { stdio: 'inherit' });
  if (r.error) { console.error(`mix: could not run ${py} (${r.error.message})`); process.exit(1); }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

export function stage(dir, { media = [], layers = false } = {}) {
  const A = path.join(dir, 'assets'), todo = [], adapters = [];
  fs.mkdirSync(path.join(A, 'media'), { recursive: true });   // always: the mix (audio.py) is written to assets/media/mix.wav even when a template links no media (media: [])
  for (const f of ['Manrope-Variable.ttf', 'IBMPlexMono-SemiBold.ttf']) link(path.join(SH, 'fonts', f), path.join(A, 'fonts', f));
  for (const f of ['pack.mjs', 'plan.mjs']) link(path.join(SH, f), path.join(A, 'mp', f));
  for (const m of media) link(m, path.join(A, 'media', path.basename(m)));
  if (layers) { const L = path.join(PACK, 'layers'); if (fs.existsSync(path.join(L, 'overlay.js'))) for (const f of jsUnder(L).filter((f) => !/\/(demo|tests)\//.test(f))) link(f, path.join(A, 'mp', 'layers', path.relative(L, f))); else todo.push('layers/overlay.js (layers module) not found: finishing layers skipped'); }
  // TYPE module: its DOM back-end (type/dom.js) + our thin adapter that registers 'type/<preset>' ids with MP
  const TY = path.join(PACK, 'type');
  if (fs.existsSync(path.join(TY, 'dom.js'))) { for (const f of fs.readdirSync(TY).filter((f) => /\.js$/.test(f))) link(path.join(TY, f), path.join(A, 'mp', 'type', f)); for (const f of fs.readdirSync(path.join(TY, 'gfx')).filter((f) => /\.js$/.test(f))) link(path.join(TY, 'gfx', f), path.join(A, 'mp', 'type', 'gfx', f)); link(path.join(SH, 'adapters', 'type.mjs'), path.join(A, 'mp', 'adapters', 'type.mjs')); adapters.push('assets/mp/adapters/type.mjs'); }
  else todo.push('type/dom.js (type module) not found: plain fades used');
  // TRANSITIONS module: lib/{registry,tx-core,tx-dom,ids}.js + our adapter that registers 'transitions/<id>' with MP. The template
  // stretches clips around each windowed cut (txplan.mjs span) so both shots are present; the 23 GL-only looks run their DOM approximation (tx-dom-x.js), only speedRamp (timing-only) stays a logged hard cut.
  const TX = path.join(PACK, 'transitions', 'lib');
  if (fs.existsSync(path.join(TX, 'tx-dom.js'))) { for (const f of fs.readdirSync(TX).filter((f) => f.endsWith('.js'))) link(path.join(TX, f), path.join(A, 'mp', 'transitions', 'lib', f)); link(path.join(SH, 'adapters', 'transitions.mjs'), path.join(A, 'mp', 'adapters', 'transitions.mjs')); adapters.push('assets/mp/adapters/transitions.mjs'); }
  else todo.push('transitions/lib/tx-dom.js (transitions module) not found: hard cuts used');
  return { todo, adapters };
}
export const head = ({ W, H, title, bg = '#f5f2ea', css = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: "Manrope"; src: url("assets/fonts/Manrope-Variable.ttf") format("truetype"); font-weight: 200 800; }
@font-face { font-family: "IBM Plex Mono"; src: url("assets/fonts/IBMPlexMono-SemiBold.ttf") format("truetype"); font-weight: 600; }
html, body { margin: 0; background: ${bg}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${bg}; font-family: "Manrope", sans-serif; color: #111; }
.clip { position: absolute; inset: 0; }
.fill { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
${css}
</style>
</head>`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function write(dir, html) { fs.writeFileSync(path.join(dir, 'index.html'), html); return path.join(dir, 'index.html'); }
