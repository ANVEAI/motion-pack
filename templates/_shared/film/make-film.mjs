/* motion-pack / templates / _shared / film / make-film.mjs: the build every film template's make.mjs runs (2026-10-16, film lane).
     makeFilm(DIR, name, argv)   CONFIG (+ --set k=v, --set aspect=9:16, --set length=30) -> the plan (cues.mjs: the lint gates exit 2 before anything is built)
                                 -> projects/<cut>-<aspect>/ (its own HyperFrames project: fonts, layers, type, plates, footage) -> the score + mix (score.py) -> index.html
   The default plan (CONFIG as shipped) is out/plan.json (the CI plan test compares it); every other cut / aspect writes out/plan-<cut>-<aspect>.json.
   Render: npx -y hyperframes@0.8.142 render projects/<tag> -o out/<name>-<tag>.mp4 --crf 23 (make.mjs prints it). */
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { pathToFileURL } from 'node:url';
import { runPlan } from '../compose.mjs'; import { stageFilm, filmPage } from './page.mjs';
const SH = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export function setArgs(C, argv) {
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--set') { const arg = argv[++i], j = arg.indexOf('='), k = arg.slice(0, j), v = arg.slice(j + 1); let o = C; const ks = k.split('.');
    try { for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v === 'null' ? null : v !== '' && !isNaN(+v) && !/^\d+:\d+$/.test(v) ? +v : v; } catch (e) { console.error(`make.mjs: cannot --set ${arg}: ${k} is not a field of CONFIG`); process.exit(2); } }
  return C;
}
export async function makeFilm(DIR, name, argv = process.argv.slice(2)) {
  const { CONFIG } = await import(pathToFileURL(path.join(DIR, 'config.mjs')).href), C = setArgs(structuredClone(CONFIG), argv);
  const asp = String(C.aspect || '16:9'), cut = String(C.length ?? 'full'), isDefault = JSON.stringify(C) === JSON.stringify(CONFIG), tag = `${cut}-${asp.replace(':', 'x')}`;
  const planName = isDefault ? 'plan' : 'plan-' + tag, PROJ = path.join(DIR, 'projects', tag), PY = process.env.PYTHON || 'python3';
  runPlan(DIR, [...argv.filter((a) => a !== '--allow-lint'), ...(argv.includes('--allow-lint') ? ['--allow-lint'] : []), '--name', planName]);
  const planFile = path.join(DIR, 'out', planName + '.json'), plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  fs.mkdirSync(PROJ, { recursive: true }); const st = stageFilm(PROJ, plan);
  const r = spawnSync(PY, [path.join(SH, 'film', 'score.py'), planFile, path.join(PROJ, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  fs.writeFileSync(path.join(PROJ, 'index.html'), filmPage(plan, { title: `motion-pack ${name}: ${plan.title || (C.film && C.film.title) || name} (${tag})` }));
  const mp4 = path.join('out', `${name}-${tag}.mp4`);
  console.log(`${PROJ}/index.html  ${plan.shots.length} shots, ${plan.gfx.length} type items, ${plan.cues.length} cues, ${plan.seconds} s, ${plan.W}x${plan.H}  todo: ${st.todo.join(' | ') || 'none'}`);
  console.log(`render: (cd ${path.relative(process.cwd(), DIR) || '.'} && npx -y hyperframes@0.8.142 render projects/${tag} -o ${mp4} --crf 23)`);
  return { plan, PROJ, tag, mp4 };
}
