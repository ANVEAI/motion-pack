/* templates/title-sequence/make.mjs: CONFIG -> plan (lint gates) -> projects/<length>-<aspect>/ (the bed, the mix, the page).
     node make.mjs                                   40 s, 16:9 letterboxed               -> projects/40-16x9
     node make.mjs --set aspect=9:16                 re-laid out for 9:16                 -> projects/40-9x16
     node make.mjs --set length=60 --set genre=noir --set media.t3.src=/abs/your-shot.mp4
   then the render command it prints (npx -y hyperframes@0.8.142 render projects/<tag> -o out/title-sequence-<tag>.mp4 --crf 23). */
import path from 'node:path'; import { makeFilm } from '../_shared/film/make-film.mjs';
await makeFilm(path.dirname(new URL(import.meta.url).pathname), 'title-sequence');
