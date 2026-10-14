/* templates/demo-r6-pivot/pivot.test.mjs: the problem-pivot demo's plan (node only: no browser, no GPU, no gitignored file; CI runs it).
   run: node templates/demo-r6-pivot/pivot.test.mjs
   PLAN: the story (cuts/story6.py, called by config.mjs) passes every one of its own checks; the film is exactly CONFIG.seconds on whole frames; plan.audio declares the gap (1.5-2 s, kind gap)
   then the hold (>= 2 s, kind hold) and mode continuous / role brand_launch; the bed automation is silent the frame before the pivot and back at 0 dB ON it; the one bass hit is on the pivot frame
   and is the SAME cue as layers/backgrounds-r6.js cuesR6 (a ribbon whose lead disagrees with the story's refuses to build); no cue lies inside the gap or the hold; every sfx and music id
   resolves; there are no shots (zero cuts) and no number in any caption (so no claim needs a source); the committed out/plan.json is the current plan; the plan is the same bytes in two
   separate node processes and in a changed key order of the CONFIG.
   IN FRAME: the placeholder note is part of the film and names the placeholder brand; no third-party name appears in the config, the build script or the committed page. */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { CONFIG, buildPlan } from './config.mjs';
import { cuesR6 } from '../../layers/backgrounds-r6.js';
const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../..'), fps = CONFIG.fps;
let pass = 0, fail = 0; const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !info ? '' : '  ' + info}`); };
const clone = (o) => structuredClone(o), throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e.message)); } };
const SFX = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'sfx/manifest.json'), 'utf8')).sounds.map((s) => s.id));
const MUSIC = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'music/manifest.json'), 'utf8')).items.map((i) => i.id));
const plan = buildPlan(clone(CONFIG)), S = plan.story, P = S.pivot, sec = (f) => f / fps;

check('the story passes all of its own checks and has no warnings', S.checks.every((c) => c.ok) && S.checks.length >= 15 && S.warnings.length === 0, JSON.stringify(S.checks.filter((c) => !c.ok)));
check('the film is CONFIG.seconds long on whole frames', plan.seconds === CONFIG.seconds && S.frames === CONFIG.seconds * fps && Number.isInteger(S.frames), `${plan.seconds} s, ${S.frames} f`);
check('square size 1080 x 1080', plan.size[0] === 1080 && plan.size[1] === 1080);
check('zero cuts: no shots, one continuous film', Array.isArray(plan.shots) && plan.shots.length === 0 && plan.audio.mode === 'continuous');
const q = plan.audio.quiet;
check('plan.audio.quiet = the gap (kind gap, 1.5-2 s) then the hold (kind hold, >= 2 s)', q.length === 2 && q[0].kind === 'gap' && q[1].kind === 'hold' && q[0].t[1] - q[0].t[0] >= 1.5 - 1e-3 && q[0].t[1] - q[0].t[0] <= 2.0 + 1e-3 && q[1].t[1] - q[1].t[0] >= 2.0 && Math.abs(q[1].t[1] - plan.seconds) < 1e-3, JSON.stringify(q));
check('role brand_launch (the bass-share row of ears)', plan.audio.role === 'brand_launch');
const bed = (f) => { const pts = plan.bedAutomation; let g = pts[0].gain_db; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (f >= a.frame && f <= b.frame) g = b.frame === a.frame ? a.gain_db : a.gain_db + (b.gain_db - a.gain_db) * (f - a.frame) / (b.frame - a.frame); } if (f > pts.at(-1).frame) g = pts.at(-1).gain_db; return g; };
check('the bed is silent the frame before the pivot and back at 0 dB ON it', bed(P.frame - 1) <= -60 + 1e-9 && Math.abs(bed(P.frame)) < 1e-9, `${bed(P.frame - 1)} / ${bed(P.frame)}`);
const bass = plan.cues.filter((c) => c.id === 'sfx/hit/sub_drop');
check('one bass hit, on the pivot frame', bass.length === 1 && Math.round(bass[0].t * fps) === P.frame, JSON.stringify(bass));
const ribbonCue = cuesR6('auroraRibbon', plan.ribbon);
check('the ribbon is the same pivot: its own cue is the story bass hit and it rises on the colour frame', ribbonCue.length === 1 && Math.round(ribbonCue[0].t * fps) === P.frame && Math.abs(plan.ribbon.riseAt - sec(P.visual_frame)) < 1e-4, JSON.stringify([ribbonCue, plan.ribbon.riseAt]));
const cfg2 = clone(CONFIG); cfg2.aurora.lead = 0.3;
check('a ribbon lead that disagrees with the story refuses to build, naming the cue', throwsWith(() => buildPlan(cfg2), /ribbon cue/));
const cfg3 = clone(CONFIG); cfg3.story.gapS = 3.5;
check('a gap outside 1.5-2 s refuses to build (the story check is not skipped)', throwsWith(() => buildPlan(cfg3), /gap/));
const cfg4 = clone(CONFIG); cfg4.seconds = 20;
check('a film shorter than its beats refuses to build (no silent overrun)', throwsWith(() => buildPlan(cfg4), /duration|frames/));
const qf = q.map((x) => x.t.map((t) => Math.round(t * fps))), cf = (c) => Math.round(c.t * fps);   /* the quiet times are rounded to 4 decimals: compare whole frames; a cue ON the pivot frame is the bass, not inside the silence */
check('no cue inside the gap (before the pivot frame) or the hold', plan.cues.every((c) => !(cf(c) >= qf[0][0] && cf(c) < qf[0][1]) && !(cf(c) >= qf[1][0])), JSON.stringify(plan.cues.map(cf)));
check('every cue is on a whole frame', plan.cues.every((c) => Math.abs(c.t * fps - Math.round(c.t * fps)) < 1e-3));
check('every sfx id and the music bed resolve', plan.cues.every((c) => SFX.has('snd.' + c.id.split('/').slice(1).join('.'))) && MUSIC.has('music.' + plan.music.split('/')[1]), plan.cues.filter((c) => !SFX.has('snd.' + c.id.split('/').slice(1).join('.'))).map((c) => c.id).join(','));
check('no number in any caption, so nothing needs a source (claims empty)', S.captions.every((c) => !/\d/.test(c.text)) && plan.claims.length === 0);
check('the in-frame placeholder note names the placeholder brand', /placeholder/i.test(CONFIG.placeholderNote) && CONFIG.placeholderNote.includes('Brand A'));
check('the ceiling leaves headroom for the render re-encode (gotchas.md)', plan.ceilingDb <= -2.5, String(plan.ceilingDb));
const committed = JSON.parse(fs.readFileSync(path.join(here, 'out', 'plan.json'), 'utf8')), fresh = JSON.parse(JSON.stringify(plan)); delete committed.lint;
check('the committed out/plan.json is the current plan', JSON.stringify(committed) === JSON.stringify(fresh));
const runPlan = (reverse) => spawnSync(process.execPath, ['--input-type=module', '-e', `import { CONFIG, buildPlan } from '${path.join(here, 'config.mjs')}'; const C = structuredClone(CONFIG); ${reverse ? 'for (const k of Object.keys(C.story).reverse()) { const v = C.story[k]; delete C.story[k]; C.story[k] = v; }' : ''} process.stdout.write(JSON.stringify(buildPlan(C)));`], { encoding: 'utf8' });
const a = runPlan(false), b = runPlan(true);
check('the plan is the same bytes in two separate processes and with the CONFIG keys in another order', a.status === 0 && b.status === 0 && a.stdout === b.stdout && a.stdout === JSON.stringify(plan), (a.stderr + b.stderr).slice(0, 200));
const bad = /walrus|lovable|amnesia|taco|memory layer|\/\/start building/i;
const files = ['config.mjs', 'make.mjs', 'index.html'].map((f) => [f, fs.readFileSync(path.join(here, f), 'utf8')]);
check('no third-party or real account name in the shipped files of this demo', files.every(([, t]) => !bad.test(t)), files.filter(([, t]) => bad.test(t)).map(([f]) => f).join(','));
check('the committed page has no shots and one ribbon (no cut sections)', !/class="clip scene"/.test(files[2][1]) && (files[2][1].match(/kind: 'auroraRibbon'/g) || []).length === 1);

console.log(`\ndemo-r6-pivot: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
