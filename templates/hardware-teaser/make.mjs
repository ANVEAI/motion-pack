/* templates/hardware-teaser/make.mjs: CONFIG -> plan (lint gates) -> the three.js plate (GPU, cached by hash) -> the fitted score -> the mix -> the HyperFrames page.
     node make.mjs [--set aspect=9:16] [--set media.model.src=/abs/device.glb] [--plates] [--allow-lint]
   then  npx -y hyperframes@0.8.142 render . -o out/hardware-teaser.mp4 --crf 23                  (16:9)
         (cd tall && npx -y hyperframes@0.8.142 render . -o ../out/hardware-teaser-tall.mp4 --crf 23)   (9:16: make.mjs --set aspect=9:16 first)
   The pipeline is shared with hardware-teaser and spec-sheet: templates/_hw/makehw.mjs. */
import path from 'node:path';
import { runPlan } from '../_shared/compose.mjs';
import { makeHw, planArgs } from '../_hw/makehw.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
runPlan(DIR, planArgs());   // THE LINT GATE first (cues.mjs: exit 2 on a number without a source or an unmotivated transition); nothing is rendered, staged or mixed before it
await makeHw(DIR, { planned: true });
