/* motion-pack / tools / mp-size.mjs: the size check `mp render` runs after every render (the render-aspect rule: ffprobe WxH after every render).
     videoSize(mp4)              -> [W, H] of the first video stream (ffprobe), or null when ffprobe cannot read it
     sizeProblem(mp4, aspect)    -> null when the file is the size its aspect needs (templates/_shared/project.mjs ASPECT_SIZES), else a message
   16 Oct: `mp render` wrote 1920x1080 files named -9x16 and a 1080x1920 file named -16x9 because some builders ignored --aspect; a render that comes out at the
   wrong size is now a failed render, never a mislabelled file. CLI: node tools/mp-size.mjs <mp4> <aspect>  (exit 0 ok, 1 wrong size, 2 unreadable) */
import { spawnSync } from 'node:child_process'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ASPECT_SIZES } = await import(pathToFileURL(path.join(HERE, '..', 'templates', '_shared', 'project.mjs')).href);

export function videoSize(mp4) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', mp4], { encoding: 'utf8' });
  const m = r.status === 0 && /^(\d+)x(\d+)/.exec((r.stdout || '').trim());
  return m ? [+m[1], +m[2]] : null;
}
export function sizeProblem(mp4, aspect) {
  const want = ASPECT_SIZES[aspect]; if (!want) return `unknown aspect ${aspect} (known: ${Object.keys(ASPECT_SIZES).join(', ')})`;
  const got = videoSize(mp4); if (!got) return `ffprobe could not read the size of ${mp4}`;
  const [W, H] = Array.isArray(want) ? want : [want.W ?? want.w, want.H ?? want.h];
  return got[0] === W && got[1] === H ? null : `${path.basename(mp4)} is ${got[0]}x${got[1]}, but ${aspect} needs ${W}x${H}: the build ignored the aspect (wrong size, not just a wrong name)`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:fs')).realpathSync(process.argv[1])) {
  const [mp4, aspect] = process.argv.slice(2), p = sizeProblem(mp4, aspect); console.log(p || `${path.basename(mp4)}: ${videoSize(mp4).join('x')} = ${aspect} ok`); process.exit(p ? (/could not read|unknown/.test(p) ? 2 : 1) : 0);
}
