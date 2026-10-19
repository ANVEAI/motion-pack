/* templates/process-howto/make.mjs: CONFIG -> step / digit gate (exit 2) -> plan (+ the shared lint gate) -> voice stem (only with voice.words) -> mix -> HyperFrames page
   (16:9 here, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set media.before.src=/abs/before.jpg --set media.after.src=/abs/after.jpg] [--project p.json] [--no-audio]
   then   $MP_RENDER_PREFIX npx -y hyperframes@0.8.142 render . -o out/process-howto.mp4 --crf 23 -w 1
          (cd tall && $MP_RENDER_PREFIX npx -y hyperframes@0.8.142 render . -o ../out/process-howto-tall.mp4 --crf 23 -w 1)
          python3 ../_shared/sheet.py out/process-howto.mp4 out/sheet.jpg 0,2,5,8,11,14,17,20,23,26,28.5,30,32,34,37,40,42
          python3 ../../ears/listen.py out/process-howto.mp4 --plan out/plan.json ; python3 ../../eyes/look.py out/process-howto.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { gate, runArgs, makeExplain } from '../_explain/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG, processProblems } = await import('./config.mjs'), argv = process.argv.slice(2);
await gate(DIR, argv, (C) => processProblems(C));
const run = runArgs(CONFIG, argv, '16:9');
runPlan(DIR, [...argv.filter((a) => a !== '--no-audio'), '--name', run.planName]);
makeExplain(DIR, { ...run, title: 'motion-pack process-howto' });
