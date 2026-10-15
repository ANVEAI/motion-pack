/* templates/spec-sheet/make.mjs: CONFIG -> plan (lint gates) -> the three.js plate (GPU, cached by hash) -> the fitted score -> the mix -> the HyperFrames page.
     node make.mjs [--set aspect=9:16] [--set media.model.src=/abs/device.glb] [--plates] [--allow-lint]
   then  npx -y hyperframes@0.8.142 render . -o out/spec-sheet.mp4 --crf 23                  (16:9)
         (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/spec-sheet-tall.mp4 --crf 23)   (9:16: make.mjs --set aspect=9:16 first)
   The pipeline is shared with hardware-teaser and spec-sheet: templates/_hw/makehw.mjs. */
import path from 'node:path';
import { makeHw } from '../_hw/makehw.mjs';
await makeHw(path.dirname(new URL(import.meta.url).pathname));
