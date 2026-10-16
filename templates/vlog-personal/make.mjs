/* templates/vlog-personal/make.mjs: CONFIG -> lint gate -> plan -> voice stem -> mix -> HyperFrames page (9:16 at this folder, 16:9 in wide/).
     node make.mjs [--set aspect=16:9] [--set media.talk.src=/abs/talk.mp4 --set media.broll.coffee.src=/abs/coffee.mp4 --set voice.words=/abs/words.json]
   then   npx -y hyperframes@0.8.142 render . -o out/vlog-personal.mp4 --crf 23                     (9:16)
          (cd wide && npx -y hyperframes@0.8.142 render . -o ../out/vlog-personal-wide.mp4 --crf 23)   (16:9: node make.mjs --set aspect=16:9 first)
          python3 ../_shared/sheet.py out/vlog-personal.mp4 out/sheet.jpg 0,1,2.4,3.4,4.6,6,7.4,8.6,10,11.4,12.6,14,15.4,16.6,17.6,18.4
          python3 ../../ears/listen.py out/vlog-personal.mp4 --plan out/plan.json --transcript out/transcript.json ; python3 ../../eyes/look.py out/vlog-personal.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { aspectArgs, makeHuman } from '../_shared/human/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG } = await import('./config.mjs');
const run = aspectArgs(CONFIG, process.argv.slice(2), '9:16');
runPlan(DIR, [...process.argv.slice(2), '--name', run.planName]);   // plan + lint gates first: exits 2 on lint.proof / lint.tx before anything is staged or mixed
makeHuman(DIR, { ...run, title: 'motion-pack vlog-personal' });
