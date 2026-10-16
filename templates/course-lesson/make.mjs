/* templates/course-lesson/make.mjs: CONFIG -> lint gate -> plan -> voice stem -> mix -> HyperFrames page (16:9 at this folder, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set media.presenter.src=/abs/lesson.mp4 --set voice.words=/abs/words.json]
   then   npx -y hyperframes@0.8.142 render . -o out/course-lesson.mp4 --crf 23                        (16:9)
          (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/course-lesson-tall.mp4 --crf 23)   (9:16: node make.mjs --set aspect=9:16 first)
          python3 ../_shared/sheet.py out/course-lesson.mp4 out/sheet.jpg 0,1,2.6,4,5.4,6.8,8.2,9.6,11,12.6,14,15.4,17,18.6,20.4,22 */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { aspectArgs, makeHuman } from '../_shared/human/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG } = await import('./config.mjs');
const run = aspectArgs(CONFIG, process.argv.slice(2), '16:9');
runPlan(DIR, [...process.argv.slice(2), '--name', run.planName]);   // plan + lint gates first: exits 2 on lint.proof / lint.tx before anything is staged or mixed
makeHuman(DIR, { ...run, title: 'motion-pack course-lesson' });
