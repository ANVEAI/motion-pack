/* usage: node layers/tests/sheet.mjs <out.png> <aspect wide|tall> <t> <cols> <cellW> <mood> name1 name2 ...   ('@plate' = raw plate) */
import fs from 'node:fs'; import { open } from './harness.mjs';
const [out, aspect = 'wide', t = '1', cols = '3', cw = '640', mood = 'day', ...names] = process.argv.slice(2);
const h = await open('/layers/demo/index.html', `aspect=${aspect}&mood=${mood}`);
const url = await h.page.evaluate((names, t, cols, cw) => window.sheet(names, +t, Math.round(+t * 30), +cols, +cw), names, t, cols, cw);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out, 'errors:', h.errors.filter(e => !/favicon|404/.test(e))); await h.close();
