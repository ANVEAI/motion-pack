/* templates/founder-story/make.mjs: CONFIG -> the quote gate -> lint gate -> plan -> voice stem -> mix -> HyperFrames page (16:9 at this folder, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set media.talk.src=/abs/talk.mp4 --set voice.words=/abs/words.json --set text.quote="words they really said"]
   then   npx -y hyperframes@0.8.142 render . -o out/founder-story.mp4 --crf 23                        (16:9)
          (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/founder-story-tall.mp4 --crf 23)   (9:16: node make.mjs --set aspect=9:16 first)
          python3 ../_shared/sheet.py out/founder-story.mp4 out/sheet.jpg 0,0.8,1.6,2.8,4.2,5.2,6.4,7.6,8.8,10.4,11.6,12.8,14,15.6,17.4,18.6
   THE QUOTE GATE: text.quote must be a verbatim run of the transcript (the speaker's own words); otherwise this exits 2 before anything is built. */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { aspectArgs, makeHuman } from '../_shared/human/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG, gateProblems } = await import('./config.mjs');
const run = aspectArgs(CONFIG, process.argv.slice(2), '16:9');
const bad = gateProblems(run.C); if (bad.length) { console.error(`\nfounder-story quote gate: nothing built\n  - ${bad.join('\n  - ')}\n\nA pull quote is the speaker's own words, copied from the transcript. Fix text.quote (or the words.json).\n`); process.exit(2); }
runPlan(DIR, [...process.argv.slice(2), '--name', run.planName]);   // plan + lint gates first: exits 2 on lint.proof / lint.tx before anything is staged or mixed
makeHuman(DIR, { ...run, title: 'motion-pack founder-story' });
