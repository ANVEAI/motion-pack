/* templates/saas-launch/make.mjs: CONFIG -> plan (lint gates) -> mix -> one-director HyperFrames page (templates/_shared/saas/make.mjs does the work).
     node make.mjs [--set length=45|60|75] [--set aspect=9:16] [--set brand.name=...] [--set media.tour.src=/abs/recording.mp4]
   then the render command it prints, e.g.  npx -y hyperframes@0.8.142 render . -o out/saas-launch-60.mp4 --crf 23   (9:16: from tall/) */
import path from 'node:path'; import { makeSaas } from '../_shared/saas/make.mjs';
await makeSaas(path.dirname(new URL(import.meta.url).pathname));
