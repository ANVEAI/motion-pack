/* motion-pack / templates/_shared/human/build.mjs: the build steps every human template's make.mjs runs AFTER its lint gate (runPlan) passed (node):
     plan (out/plan<tag>.json, written by cues.mjs) -> stage the project (fonts, modules, your media) -> the voice stem (voice.py) -> env.json -> the mix (compose.mix -> music/mixer.py)
     -> out/transcript<tag>.json for ears -> the page (page.mjs) in the aspect's own project folder (the template's default aspect at the root, others in tall/ wide/ square/ portrait/).
   aspectArgs(DIR, CONFIG, argv) tells make.mjs which plan name and folder this run writes, so it can hand cues.mjs `--name` before anything is staged. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { mix } from '../compose.mjs';
import { applySets } from './core.mjs';
import { stageHuman, pageHTML } from './page.mjs';
import { tagOf, projOf } from './kit.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);

export function aspectArgs(CONFIG, argv, def) { const C = applySets(structuredClone(CONFIG), argv), tag = tagOf(C.aspect, def); return { C, tag, planName: 'plan' + tag, proj: projOf(C.aspect, def) }; }

export function makeHuman(DIR, { planName, proj, C, title }) {
  const PY = process.env.PYTHON || 'python3', OUT = path.join(DIR, 'out'), PROJ = path.resolve(DIR, proj), planPath = path.join(OUT, planName + '.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')), S = plan.scene; fs.mkdirSync(PROJ, { recursive: true });
  for (const w of plan.warnings || []) console.log('warning:', w);
  const st = stageHuman(PROJ, S, { layers: (plan.layers || C.layers || []).length > 0 });
  /* voice stem + level envelope, then the mix */
  execFileSync(PY, [path.join(HERE, 'voice.py'), planPath, path.join(OUT, plan.vo)], { stdio: 'inherit' });
  const env = JSON.parse(fs.readFileSync(path.join(OUT, 'env.json'), 'utf8'));
  for (const it of [...(S.gfx || []), ...(S.gfxTop || [])]) if (it.params && typeof it.params.env === 'string' && it.params.env.startsWith('$env')) { const k = it.params.env.split(':')[1]; it.params.env = k ? env.by[k] || [] : env.all; }
  fs.writeFileSync(path.join(OUT, 'transcript' + planName.slice(4) + '.json'), JSON.stringify({ source: 'output-time words of ' + planName + '.json (placeholder text until voice.words holds your transcript)', words: plan.transcript || [] }));
  mix(planPath, path.join(PROJ, 'assets', 'media', 'mix.wav'), PY);
  const html = pageHTML(S, { title: title + (proj === '.' ? '' : ' (' + C.aspect + ')'), layers: plan.layers || C.layers || [], adapters: st.adapters, layersOk: !st.todo.some((x) => x.startsWith('layers')) });
  const file = path.join(PROJ, 'index.html'); fs.writeFileSync(file, html);
  const ph = S.slots.filter((s) => !s.src && s.kind !== 'slide').map((s) => s.id);
  console.log(file, `${plan.seconds} s, ${C.aspect}, ${S.slots.length} slots (${ph.length ? 'labelled placeholders: ' + ph.join(' ') : 'all your media'}), ${(S.gfx || []).length + (S.gfxTop || []).length} gfx, ${plan.cues.length} cues`, 'todo:', st.todo.join(' | ') || 'none');
  console.log(`render: ${proj === '.' ? '' : `(cd ${proj} && `}npx -y hyperframes@0.8.142 render . -o ${proj === '.' ? 'out' : '../out'}/${plan.template}${planName.slice(4)}.mp4 --crf 23${proj === '.' ? '' : ')'}`);
  return { plan, file };
}
