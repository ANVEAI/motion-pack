/* templates/trailer/make.mjs: CONFIG -> plan (lint gates) -> projects/<cut>-<aspect>/ (the score for this exact cut, the mix, the page).
     node make.mjs                                   the full trailer, 16:9 letterboxed  -> projects/full-16x9
     node make.mjs --set length=30                   the 30 s cut-down (same plan rules)   -> projects/30-16x9
     node make.mjs --set length=15 --set aspect=9:16 the 15 s cut, re-laid out for 9:16   -> projects/15-9x16
     node make.mjs --set genre=scifi --set media.coast.src=/abs/your-shot.mp4
   then the render command it prints (npx -y hyperframes@0.8.142 render projects/<tag> -o out/trailer-<tag>.mp4 --crf 23). */
import path from 'node:path'; import { runPlan } from '../_shared/compose.mjs'; import { filmJob, buildFilm } from '../_shared/film/make-film.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), job = await filmJob(DIR, 'trailer');
runPlan(DIR, job.planArgs);   // the plan + the lint gates (lint.proof, lint.tx): exit 2 before anything is staged, mixed or written
buildFilm(job);               // projects/<tag>/: stage, the score and the mix (_shared/film/score.py -> music/mixer.py), index.html
