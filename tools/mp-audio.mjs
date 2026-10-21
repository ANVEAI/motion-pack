/* motion-pack / tools / mp-audio.mjs: the delivered audio of a HyperFrames render is the template's own master (`mp render` runs it after every render).
     remuxMaster(projDir, mp4)   -> { remuxed: src } when the master WAV replaced the rendered audio, else { kept: why }
   CLI: node tools/mp-audio.mjs <project dir with index.html> <render.mp4>   (exit 0 remuxed, 1 kept, 2 usage)
   rule sound.no_renderer_lowering: the delivered audio is the template's own master. HyperFrames' assemble stage re-mixes the page's audio and can lower the WHOLE track
   (v0.4.0: data-story and explainer-diagram mixed to -14.0 LUFS-I came out at -21.5 and -22.8, flat by 7.4 and 8.7 dB, although their AAC probes read -5.3 and -2.0 dBTP).
   When the page plays one master (one <audio> at volume 1 from 0, every <video> muted), its WAV (music/mixer.py: 4x-oversampled limiter, AAC-probed) is remuxed under the
   rendered picture (video copied, AAC 256k). Any other page is left as rendered and says why. */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';

export function remuxMaster(projDir, mp4) {
  const html = fs.readFileSync(path.join(projDir, 'index.html'), 'utf8'), attr = (tag, k) => (new RegExp(`\\b${k}="([^"]*)"`).exec(tag) || [])[1];
  const auds = [...html.matchAll(/<audio\b[^>]*>/g)].map((m) => m[0]), vids = [...html.matchAll(/<video\b[^>]*>/g)].map((m) => m[0]);
  if (auds.length !== 1) return { kept: `the page has ${auds.length} audio elements` };
  if (vids.some((v) => !/\bmuted\b/.test(v) || attr(v, 'data-has-audio') === 'true')) return { kept: 'a <video> on the page carries sound' };
  const src = attr(auds[0], 'src'); if (!src || +(attr(auds[0], 'data-volume') ?? 1) !== 1 || +(attr(auds[0], 'data-start') ?? 0) !== 0) return { kept: 'the master is not one track at volume 1 from 0' };
  const wav = path.resolve(projDir, src), tmp = mp4.replace(/\.mp4$/, '.remux.mp4'); if (!fs.existsSync(wav)) return { kept: `no master at ${src}` };
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp)) return { kept: 'ffmpeg remux failed: ' + (r.stderr || '').trim().split('\n').pop() };
  fs.renameSync(tmp, mp4); return { remuxed: src };
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const [dir, mp4] = process.argv.slice(2); if (!dir || !mp4) { console.error('usage: node tools/mp-audio.mjs <project dir> <render.mp4>'); process.exit(2); }
  const m = remuxMaster(dir, mp4); console.log(m.remuxed ? `remuxed the master ${m.remuxed} into ${mp4}` : `kept the rendered audio: ${m.kept}`); process.exit(m.remuxed ? 0 : 1);
}
