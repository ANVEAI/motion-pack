/* templates/podcast-clip/make.mjs: CONFIG -> lint gate -> plan -> voice stem -> mix -> HyperFrames page (9:16 at this folder, 16:9 in wide/).
     node make.mjs [--set aspect=16:9] [--set media.host.src=/abs/host.mp4 --set media.guest.src=/abs/guest.mp4 --set media.mix.src=/abs/episode.wav --set voice.words=/abs/words.json]
   then   npx -y hyperframes@0.8.142 render . -o out/podcast-clip.mp4 --crf 23                     (9:16)
          (cd wide && npx -y hyperframes@0.8.142 render . -o ../out/podcast-clip-wide.mp4 --crf 23)   (16:9: node make.mjs --set aspect=16:9 first)
          python3 ../_shared/sheet.py out/podcast-clip.mp4 out/sheet.jpg 0,0.5,1.5,3,4,5.2,6.5,8,9.5,10.5,12,13.4,15,16.2,17.2,18.4
          python3 ../../ears/listen.py out/podcast-clip.mp4 --plan out/plan.json --transcript out/transcript.json ; python3 ../../eyes/look.py out/podcast-clip.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { aspectArgs, makeHuman } from '../_shared/human/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG } = await import('./config.mjs');
const run = aspectArgs(CONFIG, process.argv.slice(2), '9:16');
runPlan(DIR, [...process.argv.slice(2), '--name', run.planName]);   // plan + lint gates first: exits 2 on lint.proof / lint.tx before anything is staged or mixed
makeHuman(DIR, { ...run, title: 'motion-pack podcast-clip' });
