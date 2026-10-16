/* motion-pack / templates/_explain/build.mjs: the build steps of the explainer, data-story and process-howto make.mjs (node). Lane explainer, 2026-10-16.
     gate(DIR, argv, check)   resolve CONFIG (project + --set, templates/_shared/project.mjs) and run the template's honesty check FIRST: problems print and the process exits 2
                              before cues.mjs, staging or the mix run
     makeExplain(DIR, run)    after runPlan (cues.mjs: the plan + the shared lint gate): stage the project (fonts, modules, media) -> the voice stem when there is a transcript
                              (templates/_shared/human/voice.py: your recording, or a labelled guide signal) -> the mix (music/mixer.py) -> the page (templates/_shared/human/page.mjs)
                              in the aspect's own folder (the default aspect at the template root, 9:16 in tall/). --no-audio skips the voice and the mix (a page check; never render it). */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { mix } from '../_shared/compose.mjs';
import { loadConfig } from '../_shared/project.mjs';
import { applySets } from '../_shared/human/core.mjs';
import { stageHuman, pageHTML } from '../_shared/human/page.mjs';
import { tagOf, projOf } from './core.mjs';
const HUMAN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '_shared', 'human');

export async function gate(DIR, argv, check) {
  const C = await loadConfig(DIR, argv, { quiet: true, who: 'make.mjs' }), problems = await check(C);
  if (problems.length) { console.error(`\nmake.mjs: honesty gate, ${problems.length} problem${problems.length === 1 ? '' : 's'} (build stopped, exit 2):\n  - ${problems.join('\n  - ')}\n`); process.exit(2); }
  return C;
}
export function runArgs(CONFIG, argv, def) { const C = applySets(structuredClone(CONFIG), argv.filter((a, i) => a !== '--no-audio')), tag = tagOf(C.aspect, def); return { C, tag, planName: 'plan' + tag, proj: projOf(C.aspect, def), audio: !argv.includes('--no-audio') }; }
export function makeExplain(DIR, { planName, proj, C, title, audio = true }) {
  const PY = process.env.PYTHON || 'python3', OUT = path.join(DIR, 'out'), PROJ = path.resolve(DIR, proj), planPath = path.join(OUT, planName + '.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')), S = plan.scene; fs.mkdirSync(PROJ, { recursive: true });
  for (const w of plan.warnings || []) console.log('warning:', w);
  const st = stageHuman(PROJ, S, { layers: (plan.layers || C.layers || []).length > 0 });
  if (audio) {
    if (plan.voice) execFileSync(PY, [path.join(HUMAN, 'voice.py'), planPath, path.join(OUT, plan.vo)], { stdio: 'inherit' });
    fs.writeFileSync(path.join(OUT, 'transcript' + planName.slice(4) + '.json'), JSON.stringify({ source: plan.voice ? 'output-time words of ' + planName + '.json' : 'no voice in this build', words: plan.transcript || [] }));
    mix(planPath, path.join(PROJ, 'assets', 'media', 'mix.wav'), PY);
  } else console.log('--no-audio: voice and mix skipped (the page has no sound; do not render this build)');
  const html = pageHTML(S, { title: title + (proj === '.' ? '' : ' (' + C.aspect + ')'), layers: plan.layers || C.layers || [], adapters: st.adapters, layersOk: !st.todo.some((x) => x.startsWith('layers')) });
  const file = path.join(PROJ, 'index.html'); fs.writeFileSync(file, html);
  const ph = S.slots.filter((s) => !s.src).map((s) => s.id);
  console.log(file, `${plan.seconds} s, ${C.aspect}, ${S.slots.length} slots${ph.length ? ' (labelled placeholders: ' + ph.join(' ') + ')' : ''}, ${(S.gfx || []).length + (S.gfxTop || []).length} gfx, ${plan.cues.length} cues`, 'todo:', st.todo.join(' | ') || 'none');
  console.log(`render: ${proj === '.' ? '' : `(cd ${proj} && `}npx -y hyperframes@0.8.142 render . -o ${proj === '.' ? 'out' : '../out'}/${plan.template}${planName.slice(4)}.mp4 --crf 23${proj === '.' ? '' : ')'}`);
  return { plan, file };
}
