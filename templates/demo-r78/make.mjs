/* templates/demo-r78/make.mjs: the xp-r78 parts in one tiny page (960 x 540, 11 s, no sound, no plan): type.sentenceAcrossShots over four plates that cut on the words, ui.glassPanel (backdrop mode: a real
   CSS backdrop-filter over a moving plate) beside ui.rimLight, then ui.approvalSlider. Every plate and part is a pure function of t, drawn on hf-seek; nothing is hand-timed apart from the scene starts below.
   Placeholder content only (generic words, fictional request), no brand, no number.
     node make.mjs   then   ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/demo-r78.mp4 --crf 24 -w 1     (ffprobe the WxH after) */
import fs from 'node:fs'; import path from 'node:path';
import { stage, head, write } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), { CONFIG } = await import('./config.mjs'), { W, H, T } = CONFIG;
stage(DIR, { layers: true });
const D = { W, H, T, items: CONFIG.items };
const css = `#plate, #gfx { position: absolute; inset: 0; } #plate { background-size: 200% 200%; }`;
const html = `${head({ W, H, title: 'motion-pack demo: xp-r78 parts', bg: '#0A0B10', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<div id="plate" class="clip" data-start="0" data-duration="${T}" data-track-index="1"></div>
<div id="gfx" class="clip" data-start="0" data-duration="${T}" data-track-index="2"></div>
</div>
<script type="module">
import { mountGfx, bindHF } from './assets/mp/type/gfx/index.js';
const D = ${JSON.stringify(D)}, plate = document.getElementById('plate');
const SHOTS = ['linear-gradient(135deg,#ff8a3d,#ff3d7a)', 'linear-gradient(135deg,#2bd9a0,#1a6cff)', 'linear-gradient(135deg,#ffd23a,#ff6a1a)', 'linear-gradient(135deg,#8e6bff,#3a1fb0)'], CUTS = [0, 0.6, 1.2, 1.8];
const STRIPES = 'repeating-linear-gradient(115deg,#ff5f6d 0 60px,#ffc371 60px 120px,#2b86c5 120px 190px,#1a1a2e 190px 260px)';
const paint = (t) => { if (t < 3.2) { let i = 0; CUTS.forEach((c, k) => { if (t >= c - 1e-9) i = k; }); plate.style.background = SHOTS[i]; }
  else if (t < 7.2) { plate.style.background = STRIPES; plate.style.backgroundPosition = ((t - 3.2) * 90) + 'px 0'; plate.style.backgroundSize = 'auto'; }
  else { plate.style.background = '#0A0B10'; } };
window.addEventListener('hf-seek', (e) => paint(e.detail.time)); paint(window.__hfThreeTime || 0);
const { W, H, T } = D, tl = gsap.timeline({ paused: true });
bindHF(mountGfx(document.getElementById('gfx'), D.items, { W, H }));
tl.set({}, {}, T); window.__timelines = window.__timelines || {}; window.__timelines['main'] = tl;
let last = window.__hfThreeTime || 0; window.addEventListener('hf-seek', (e) => { last = e.detail.time; });
Promise.all([...['500', '700', '800'].map((w) => document.fonts.load(w + ' 30px Manrope'))]).then(() => window.dispatchEvent(new CustomEvent('hf-seek', { detail: { time: last } })));
</script>
</body></html>`;
write(DIR, html); console.log('wrote', path.join(DIR, 'index.html'));
