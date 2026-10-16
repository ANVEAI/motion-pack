/* templates/saas-feature-drop/make.mjs: CONFIG -> plan (lint gates) -> mix -> one-director HyperFrames page (templates/_shared/saas/make.mjs does the work).
     node make.mjs [--set length=15|20|30] [--set aspect=9:16] [--set media.after.src=/abs/screen.png]
   then the render command it prints, e.g.  npx -y hyperframes@0.8.142 render . -o out/saas-feature-drop-20.mp4 --crf 23   (9:16: from tall/) */
import path from 'node:path'; import { makeSaas } from '../_shared/saas/make.mjs';
await makeSaas(path.dirname(new URL(import.meta.url).pathname));
