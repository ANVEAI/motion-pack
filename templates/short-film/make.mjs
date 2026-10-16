/* templates/short-film/make.mjs: CONFIG -> plan (lint gates) -> projects/<length>-<aspect>/ (the bed, the J/L scene sound, the mix, the page).
     node make.mjs                                   the demo short, 16:9 letterboxed      -> projects/full-16x9 (length null = the sum of the shots)
     node make.mjs --set aspect=9:16                 re-laid out for 9:16                  -> projects/full-9x16
     node make.mjs --set media.stage.src=$PWD/../film-scene/out/film-scene-wide.mp4 --set lines=/abs/lines.json --set voice.src=/abs/dialogue.wav
   then the render command it prints (npx -y hyperframes@0.8.142 render projects/<tag> -o out/short-film-<tag>.mp4 --crf 23). */
import path from 'node:path'; import { runPlan } from '../_shared/compose.mjs'; import { filmJob, buildFilm } from '../_shared/film/make-film.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), job = await filmJob(DIR, 'short-film');
runPlan(DIR, job.planArgs);   // the plan + the lint gates (lint.proof, lint.tx): exit 2 before anything is staged, mixed or written
buildFilm(job);               // projects/<tag>/: stage, the score and the mix (_shared/film/score.py -> music/mixer.py), index.html
