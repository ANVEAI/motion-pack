/* usage: node camera/tests/sheet3d.mjs <out.png> <moves comma> <times comma> [w h] */
import fs from 'node:fs'; import { open, pageErrors } from '../../layers/tests/harness.mjs';
const [out, moves, times, w = '320', h = '180'] = process.argv.slice(2);
const hh = await open('/camera/demo/three.html', `w=${w}&h=${h}`);
const url = await hh.page.evaluate((m, t) => window.sheet(m, t), moves.split(','), times.split(',').map(Number));
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out, pageErrors(hh.errors)); await hh.close();
