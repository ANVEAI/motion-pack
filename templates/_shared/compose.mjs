/* motion-pack/templates/_shared/compose.mjs: stage + write a HyperFrames project from a template plan (node).
   stage(dir, { media: [abs paths], layers: true }) hard-links into <dir>/assets/ (HyperFrames serves only the project dir):
     fonts (Manrope, IBM Plex Mono), mp/pack.mjs + mp/plan.mjs, the named media, and OTHER MODULES when they exist:
       motion-pack/layers/{overlay.js, ease.js, finisher.js, lib/*, presets/*}  -> assets/mp/layers/   (finishing overlays, by kind)
       motion-pack/transitions/lib/{registry,tx-core,tx-dom,ids}.js -> assets/mp/transitions/lib/, motion-pack/type/*.js + type/gfx/*.js -> assets/mp/type/,
       plus _shared/adapters/{type,transitions}.mjs -> assets/mp/adapters/ (they register ids with MP.register)
     Missing modules are listed in the returned `todo` (the template still renders: hard cuts, plain fades, no layers).
   head({ W, H, title, bg }) -> the <head> with GSAP 3.14.2, @font-face for the shared fonts and the base clip CSS. */
import fs from 'node:fs'; import path from 'node:path';
const SH = path.dirname(new URL(import.meta.url).pathname), PACK = path.resolve(SH, '..', '..');
const link = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); try { fs.rmSync(dst, { force: true }); fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); } };
const jsUnder = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((f) => /\.(m?js)$/.test(f)).map((f) => path.join(d, f)) : []);

export function stage(dir, { media = [], layers = false } = {}) {
  const A = path.join(dir, 'assets'), todo = [], adapters = [];
  fs.mkdirSync(path.join(A, 'media'), { recursive: true });   // always: the mix (audio.py) is written to assets/media/mix.wav even when a template links no media (media: [])
  for (const f of ['Manrope-Variable.ttf', 'IBMPlexMono-SemiBold.ttf']) link(path.join(SH, 'fonts', f), path.join(A, 'fonts', f));
  for (const f of ['pack.mjs', 'plan.mjs']) link(path.join(SH, f), path.join(A, 'mp', f));
  for (const m of media) link(m, path.join(A, 'media', path.basename(m)));
  if (layers) { const L = path.join(PACK, 'layers'); if (fs.existsSync(path.join(L, 'overlay.js'))) for (const f of jsUnder(L).filter((f) => !/\/(demo|tests)\//.test(f))) link(f, path.join(A, 'mp', 'layers', path.relative(L, f))); else todo.push('layers/overlay.js (layers module) not found: finishing layers skipped'); }
  // TYPE module: its DOM back-end (type/dom.js) + our thin adapter that registers 'type/<preset>' ids with MP
  const TY = path.join(PACK, 'type');
  if (fs.existsSync(path.join(TY, 'dom.js'))) { for (const f of fs.readdirSync(TY).filter((f) => /\.js$/.test(f))) link(path.join(TY, f), path.join(A, 'mp', 'type', f)); for (const f of fs.readdirSync(path.join(TY, 'gfx')).filter((f) => /\.js$/.test(f))) link(path.join(TY, 'gfx', f), path.join(A, 'mp', 'type', 'gfx', f)); link(path.join(SH, 'adapters', 'type.mjs'), path.join(A, 'mp', 'adapters', 'type.mjs')); adapters.push('assets/mp/adapters/type.mjs'); }
  else todo.push('type/dom.js (type module) not found: plain fades used');
  // TRANSITIONS module: lib/{registry,tx-core,tx-dom,ids}.js + our adapter that registers 'transitions/<id>' with MP. The template
  // stretches clips around each windowed cut (txplan.mjs span) so both shots are present; GL-only keys stay hard cuts (logged).
  const TX = path.join(PACK, 'transitions', 'lib');
  if (fs.existsSync(path.join(TX, 'tx-dom.js'))) { for (const f of fs.readdirSync(TX).filter((f) => f.endsWith('.js'))) link(path.join(TX, f), path.join(A, 'mp', 'transitions', 'lib', f)); link(path.join(SH, 'adapters', 'transitions.mjs'), path.join(A, 'mp', 'adapters', 'transitions.mjs')); adapters.push('assets/mp/adapters/transitions.mjs'); }
  else todo.push('transitions/lib/tx-dom.js (transitions module) not found: hard cuts used');
  return { todo, adapters };
}
export const head = ({ W, H, title, bg = '#f5f2ea', css = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: "Manrope"; src: url("assets/fonts/Manrope-Variable.ttf") format("truetype"); font-weight: 200 800; }
@font-face { font-family: "IBM Plex Mono"; src: url("assets/fonts/IBMPlexMono-SemiBold.ttf") format("truetype"); font-weight: 600; }
html, body { margin: 0; background: ${bg}; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${bg}; font-family: "Manrope", sans-serif; color: #111; }
.clip { position: absolute; inset: 0; }
.fill { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
${css}
</style>
</head>`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function write(dir, html) { fs.writeFileSync(path.join(dir, 'index.html'), html); return path.join(dir, 'index.html'); }
