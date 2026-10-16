/* templates/explainer-diagram/make.mjs: CONFIG -> honesty + diagram gate -> plan (+ the shared lint gate) -> voice stem (only with voice.words) -> mix -> HyperFrames page
   (16:9 in this folder, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set voice.words=/abs/words.json --set voice.audio=/abs/vo.wav] [--project project.json] [--no-audio]
   then   ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/explainer-diagram.mp4 --crf 23 -w 1                     (16:9)
          (cd tall && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/explainer-diagram-tall.mp4 --crf 23 -w 1)  (9:16)
          python3 ../_shared/sheet.py out/explainer-diagram.mp4 out/sheet.jpg 0,3,8,12,18,23,29,33,39,47,53,59,64,72
          python3 ../../ears/listen.py out/explainer-diagram.mp4 --plan out/plan.json ; python3 ../../eyes/look.py out/explainer-diagram.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { gate, runArgs, makeExplain } from '../_explain/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG, explainerProblems } = await import('./config.mjs'), argv = process.argv.slice(2);
await gate(DIR, argv, (C) => explainerProblems(C));
const run = runArgs(CONFIG, argv, '16:9');
runPlan(DIR, [...argv.filter((a) => a !== '--no-audio'), '--name', run.planName]);   // plan + the lint gates (lint.proof, lint.tx): exit 2 before anything is staged
makeExplain(DIR, { ...run, title: 'motion-pack explainer-diagram' });
