/* templates/data-story/make.mjs: CONFIG -> HONESTY GATE (datasets sourced + method, units, zero baselines, labelled truncation, footers; exit 2) -> plan (+ the shared
   lint gate: every on-screen number is a claim with its dataset's source) -> voice stem (only with voice.words) -> mix -> HyperFrames page (16:9 here, 9:16 in tall/).
     node make.mjs [--set aspect=9:16] [--set locale=intl] [--set data.monthly.file=/abs/your.csv --set data.monthly.source="..." --set data.monthly.method="..."] [--project p.json] [--no-audio]
   then   $MP_RENDER_PREFIX npx -y hyperframes@0.8.142 render . -o out/data-story.mp4 --crf 23 -w 1
          (cd tall && $MP_RENDER_PREFIX npx -y hyperframes@0.8.142 render . -o ../out/data-story-tall.mp4 --crf 23 -w 1)
          python3 ../_shared/sheet.py out/data-story.mp4 out/sheet.jpg 0,3,8,12,17,21,24,28,31,35,39,43,47,51,56,60
          python3 ../../ears/listen.py out/data-story.mp4 --plan out/plan.json ; python3 ../../eyes/look.py out/data-story.mp4 --plan out/plan.json */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { gate, runArgs, makeExplain } from '../_explain/build.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG, dataStoryProblems } = await import('./config.mjs'), argv = process.argv.slice(2);
await gate(DIR, argv, (C) => dataStoryProblems(C));
const run = runArgs(CONFIG, argv, '16:9');
runPlan(DIR, [...argv.filter((a) => a !== '--no-audio'), '--name', run.planName]);
makeExplain(DIR, { ...run, title: 'motion-pack data-story' });
