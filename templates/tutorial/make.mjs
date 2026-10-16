/* templates/tutorial/make.mjs: CONFIG -> lint gate -> plan -> voice stem -> mix -> HyperFrames page (16:9 at this folder, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set media.screen.src=/abs/rec.mp4 --set media.webcam.src=/abs/cam.mp4 --set voice.words=/abs/words.json]
   then   npx -y hyperframes@0.8.142 render . -o out/tutorial.mp4 --crf 23                        (16:9)
          (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/tutorial-tall.mp4 --crf 23)   (9:16: node make.mjs --set aspect=9:16 first)
          python3 ../_shared/sheet.py out/tutorial.mp4 out/sheet.jpg 0,1.5,4,6.6,9.5,12.2,14.6,18.4,20.4,22.6,24,27
          python3 ../../ears/listen.py out/tutorial.mp4 --plan out/plan.json --transcript out/transcript.json ; python3 ../../eyes/look.py out/tutorial.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { aspectArgs, makeHuman } from '../_shared/human/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG } = await import('./config.mjs');
const run = aspectArgs(CONFIG, process.argv.slice(2), '16:9');
runPlan(DIR, [...process.argv.slice(2), '--name', run.planName]);   // plan + lint gates first: exits 2 on lint.proof / lint.tx before anything is staged or mixed
makeHuman(DIR, { ...run, title: 'motion-pack tutorial' });
