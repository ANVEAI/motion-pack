/* templates/demo-cards-objects/make.mjs: the 16 s demo of the card systems, corner pin, evidence board, doc supers, invert flash, brand field,
   glass dome, icon orbit and clay worker (2026-10-14). Neutral original content; "Orbit" is the pack's fictional placeholder brand.
     node make.mjs            stills from the pack's own renders, 3D plate + corner track (only when missing), plan + mix, index.html
     node make.mjs --plate    force the 3D plate render and the corner track again
   then:  npx -y hyperframes@0.8.142 render . -o out/demo-cards-objects.mp4 --crf 23
          python3 ../_shared/sheet.py out/demo-cards-objects.mp4 out/sheet.jpg 0.2,1.2,2.4,3.6,4.8,6.03,7.4,8.6,9.6,10.4,11.6,12.8,13.4,15.5
   Shots (hard cuts on the 120 BPM grid of music/bed_corporate_bright_loop8):
     s1 0-3    "Ideas [card stack riffles] everywhere."                         layout.cardStack (inline in the sentence)
     s2 3-6    "Saved... somewhere." still in the gap of two diagonal rivers   layout.cardRiver (keep-out rect, 6-sample motion blur)
     s3 6-10   invert flash on the cut, the evidence board pushes in           layers invertFlash, layout.evidenceBoard, lowerThird.docSuper, caption.subtitleSpeedGag
     s4 10-13  the glass dome, clay worker, icon orbit; a UI card corner-pinned objects/glass-dome, objects/icon-orbit, objects/clay (worker), layout.cornerPin
               onto the floating panel with the corners exported from the 3D scene per frame
     s5 13-16  full-bleed brand field end card                                  layers brandField
   Placeholder pictures: stills grabbed from the pack's own renders (templates/_shared/media, other templates' outputs) + procedural cards. */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { stage, head, esc, write } from '../_shared/compose.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname), SH = path.join(DIR, '..', '_shared'), PACK = path.resolve(DIR, '..', '..'), OUT = path.join(DIR, 'out');
const W = 1920, H = 1080, F = 30, T = 16, FORCE = process.argv.includes('--plate'); fs.mkdirSync(OUT, { recursive: true });

/* 1. placeholder stills from the pack's own media (never third-party photos) */
const SRC = [['_shared/media/plate-devices.mp4', [0.8, 2.2, 3.6]], ['_shared/media/plate-film.mp4', [0.9, 2.4, 3.6]], ['_shared/media/plate-cast.mp4', [2.0]],
  ['character-spot/out/character-spot-wide.mp4', [1.5, 4.0, 6.5, 10.5]], ['film-scene/out/film-scene-wide.mp4', [1.0, 4.2, 7.0]]];
const stillDir = path.join(DIR, 'assets', 'media', 'stills'); fs.mkdirSync(stillDir, { recursive: true }); const stills = [];
for (const [src, ts] of SRC) { const f = path.join(PACK, 'templates', src); if (!fs.existsSync(f)) { console.log('skip (not rendered):', src); continue; }
  for (const t of ts) { const o = path.join(stillDir, `${path.basename(src, '.mp4')}-${t}.jpg`); if (!fs.existsSync(o)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-nostdin', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'crop=ih*0.9:ih:(iw-ih*0.9)/2:0,scale=480:-2', '-q:v', '4', o]); stills.push('assets/media/stills/' + path.basename(o)); } }

/* 2. the 3D plate (objects kit, GPU-supersampled) + the panel's corners per frame for layout.cornerPin */
const plate = path.join(OUT, 'plate-dome.mp4'), track = path.join(OUT, 'pin-track.json');
if (FORCE || !fs.existsSync(plate)) execFileSync('node', [path.join(PACK, 'tools/render.mjs'), path.join(DIR, 'scene.html'), plate, '3', String(F), '--crf', '16', '--min-free-gib', '10'], { stdio: 'inherit' });
if (FORCE || !fs.existsSync(track)) {
  const { open } = await import(path.join(PACK, 'layers/tests/harness.mjs')); const h = await open('/templates/demo-cards-objects/scene.html', 't=0&norun=1');
  const keys = await h.page.evaluate((n, fps) => Array.from({ length: n + 1 }, (_, i) => ({ t: i / fps, q: window.__pinQuad(i / fps) })), 3 * F, F); await h.close();
  fs.writeFileSync(track, JSON.stringify(keys)); console.log('pin track', keys.length, 'keys');
}
const pinKeys = JSON.parse(fs.readFileSync(track, 'utf8')).map((k) => ({ t: +(k.t + 10).toFixed(6), q: k.q }));

/* 3. plan: shots + the sound cue sheet (anchor on frame + 1; audio.py / music/mixer.py solve the levels over the bed) */
const STACK = { x: 0.5, y: 0.5, n: 6, cardH: 300, riffleAt: 0.35, every: 0.13, flipDur: 0.2, count: 12, fan: 5, spread: 12, seed: 4, enterAt: 0, enterStagger: 0.03, back: '#4A18ED' };
const RIVER = { angle: -28, lanes: [-0.31, 0.31], spacing: 250, cardH: 200, speed: 720, keepOut: [{ x: 0.5, y: 0.5, w: 0.62, h: 0.15 }], samples: 6, seed: 9, t0: 0 };
const BOARD = { seed: 6, title: { text: 'WHERE DID IT GO?', sub: 'a documentary', at: 1.05 }, push: { from: [0.5, 0.5, 0.86], to: [0.49, 0.47, 1.14], at: 0, dur: 4 } };
const shots = [{ id: 's1', start: 0, dur: 3 }, { id: 's2', start: 3, dur: 3 }, { id: 's3', start: 6, dur: 4 }, { id: 's4', start: 10, dur: 3 }, { id: 's5', start: 13, dur: 3, hold: true }].map((s) => ({ ...s, tx: 'transitions/cut' }));
const cues = [
  { id: 'sfx/ui/pop', t: 0, why: 'frame 0: the stack pops in' },
  ...Array.from({ length: STACK.count }, (_, k) => ({ id: 'sfx/paper/flip', t: +(STACK.riffleAt + k * STACK.every).toFixed(4), why: 'card flip ' + (k + 1) })),
  { id: 'sfx/ui/blip', t: 0.45, why: '"everywhere." lands' },
  { id: 'sfx/whoosh/whoosh_m', t: 3, why: 'cut into the river: whoosh peaks on the cut' }, { id: 'sfx/ui/pop', t: 3.3, why: '"Saved... somewhere." lands still' },
  { id: 'sfx/riser/noise_1bar', t: 6, why: 'riser ends one frame before the flash' }, { id: 'sfx/tx/shutter_flash', t: 6, why: 'invert flash on the cut (2 frames)' },
  ...Array.from({ length: 6 }, (_, i) => ({ id: 'sfx/wood/tap', t: +(6 + i * 0.12 + 6 / 30).toFixed(4), why: 'pin ' + (i + 1) })),
  { id: 'sfx/paper/rustle', t: 6.55, why: 'red string draws on' }, { id: 'sfx/hit/soft', t: 7.05, why: 'sticky-note title slaps on' },
  { id: 'sfx/tx/cut_tick', t: 7.6, why: 'doc super cuts on' }, { id: 'sfx/ui/pop_down', t: 8.6, why: 'speed menu pops up' }, { id: 'sfx/ui/click', t: 9.4, why: 'picks 0.25' },
  { id: 'sfx/whoosh/swish_s', t: 10, why: 'cut to the dome' }, { id: 'sfx/sparkle/shimmer', t: 10.2, why: 'icon tiles pop on' }, { id: 'sfx/ui/success', t: 10.6, why: 'the pinned card lands' },
  { id: 'sfx/whoosh/swish_s', t: 13, why: 'cut to the end card' }, { id: 'sfx/logo/ascend_land', t: 13.05, why: 'sonic logo on the brand field' },
];
const plan = { template: 'demo-cards-objects', fps: F, seconds: T, size: [W, H], music: 'music/bed_corporate_bright_loop8', musicGainDb: -2, masterCeilingDb: -2.0, shots, cues: cues.sort((a, b) => a.t - b.t), claims: [],
  parts: ['layout.cardStack', 'layout.cardRiver', 'layout.evidenceBoard', 'layout.cornerPin', 'lowerThird.docSuper', 'caption.subtitleSpeedGag', 'layers/invertFlash', 'layers/brandField', 'objects/glass-dome', 'objects/icon-orbit', 'objects/clay', 'type/maskRise'] };
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 1));

/* 4. stage the project (fonts, type, layers, plate) + the gfx files the comp imports, then the mix */
const st = stage(DIR, { media: [plate], layers: true });
for (const f of fs.readdirSync(path.join(PACK, 'type', 'gfx'))) if (f.endsWith('.js')) { const d = path.join(DIR, 'assets', 'mp', 'type', 'gfx', f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.rmSync(d, { force: true }); fs.linkSync(path.join(PACK, 'type', 'gfx', f), d); }
execFileSync('python3', [path.join(SH, 'audio.py'), path.join(OUT, 'plan.json'), path.join(DIR, 'assets', 'media', 'mix.wav')], { stdio: 'inherit' });

/* 5. the composition */
const css = `
.bg { position: absolute; inset: 0; background: #F4F1EA; }
.word { position: absolute; font-weight: 800; font-size: 104px; letter-spacing: -0.035em; color: #141218; line-height: 1; white-space: nowrap; }
.cv { position: absolute; inset: 0; }
#pincard { background: #FFFFFF; border-radius: 26px; box-shadow: inset 0 0 0 2px rgba(20,18,24,0.06); font-family: Manrope; color: #141218; padding: 34px 38px; box-sizing: border-box; }
#pincard .h { display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 44px; letter-spacing: -0.02em; margin-bottom: 22px; }
#pincard .h i { width: 34px; height: 34px; border-radius: 50%; border: 7px solid #4A18ED; box-sizing: border-box; }
#pincard .h b { margin-left: auto; font-size: 22px; font-weight: 700; color: #fff; background: #4A18ED; border-radius: 99px; padding: 8px 18px; }
#pincard .r { display: flex; align-items: center; gap: 18px; height: 72px; border-top: 2px solid #EEEBE6; font-size: 30px; font-weight: 600; }
#pincard .r s { width: 44px; height: 44px; border-radius: 12px; display: block; }
#pincard .r em { margin-left: auto; font-style: normal; color: #2BB673; font-weight: 800; }
`;
const rows = [['Moodboard', '#FF6F91'], ['Trip notes', '#2BD9A0'], ['Pitch idea', '#FFB547']].map(([n, c]) => `<div class="r"><s style="background:${c}"></s>${n}<em>✓</em></div>`).join('');
const imgs = (n, off) => JSON.stringify(Array.from({ length: n }, (_, i) => (i % 3 === 2 || !stills.length ? { ph: off + i } : stills[(off + i) % stills.length])));
const html = `${head({ W, H, title: 'motion-pack demo: cards, pins, board, dome', bg: '#F4F1EA', css })}
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
<section class="clip" id="s1" data-start="0" data-duration="3" data-track-index="0"><div class="bg"></div><div class="cv" id="c1"></div>
  <div class="word" id="w1a" style="right:${W / 2 + 175}px;top:${H / 2 - 52}px">Ideas</div><div class="word" id="w1b" style="left:${W / 2 + 175}px;top:${H / 2 - 52}px">everywhere.</div></section>
<section class="clip" id="s2" data-start="3" data-duration="3" data-track-index="0"><div class="bg"></div><div class="cv" id="c2"></div>
  <div class="word" id="w2" style="left:0;right:0;text-align:center;top:${H / 2 - 52}px">Saved… somewhere.</div></section>
<section class="clip" id="s3" data-start="6" data-duration="4" data-track-index="0"><div class="bg" style="background:#2a1d12"></div><div class="cv" id="c3"></div><div class="cv" id="g3"></div></section>
<video class="clip fill" id="v4" src="assets/media/plate-dome.mp4" muted playsinline data-start="10" data-duration="3" data-media-start="0" data-track-index="0"></video>
<section class="clip" id="s4" data-start="10" data-duration="3" data-track-index="1"><div id="pincard"><div class="h"><i></i>Ideas<b>Saved</b></div>${rows}</div>
  <div class="word" id="w4" style="left:120px;bottom:96px;font-size:84px">One calm place.</div></section>
<div id="fx" class="clip" data-start="0" data-duration="${T}" data-track-index="5"></div>
<audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="${T}" data-track-index="9" data-volume="1"></audio>
</div>
${st.adapters.map((a) => `<script type="module" src="${a}"></script>`).join('\n')}
<script type="module">
import { MP } from './assets/mp/pack.mjs';
import { mountStack } from './assets/mp/layers/overlay.js';
import { mountCards, mountBoard, mountGfx, mountPin, placeholderCard } from './assets/mp/type/gfx/index.js';
const SIZE = { W: ${W}, H: ${H} }, pic = (list) => list.map((x) => (typeof x === 'string' ? x : placeholderCard(x.ph, { w: 480, h: 600 })));
const stack = mountCards(document.getElementById('c1'), 'layout.cardStack', ${JSON.stringify(STACK)}, { ...SIZE, images: pic(${imgs(12, 0)}) });
const river = mountCards(document.getElementById('c2'), 'layout.cardRiver', ${JSON.stringify(RIVER)}, { ...SIZE, images: pic(${imgs(12, 5)}) });
const board = mountBoard(document.getElementById('c3'), ${JSON.stringify(BOARD)}, { ...SIZE, images: pic(${JSON.stringify(stills.length ? [stills[4], stills[8], stills[1], stills[10]] : [{ ph: 1 }, { ph: 2 }, { ph: 3 }, { ph: 4 }])}) });
const gfx = mountGfx(document.getElementById('g3'), [
  { id: 'lowerThird.docSuper', at: 7.6, dur: 1.9, params: { name: 'The idea', role: 'Missing since Tuesday', pos: 'tl' } },
  { id: 'caption.subtitleSpeedGag', at: 8.0, dur: 1.75, params: { line: '[narrator, slowly] Where… did… it… go…', after: '[narrator, even more slowly]', menuAt: 0.6, pickAt: 1.4, closeAt: 1.62 } }], SIZE);
const pin = mountPin(document.getElementById('pincard'), { w: 600, h: 380, keys: ${JSON.stringify(pinKeys)}, at: 10.45, fadeIn: 0.2 }, SIZE);
const fx = mountStack(document.getElementById('fx'), [{ kind: 'vignette', params: { amount: 0.07 } }, { kind: 'grain', params: { stock: 'digital-soft' } },
  { kind: 'invertFlash', params: { at: [6.0], frames: 2 } }, { kind: 'brandField', params: { at: 13, name: 'Orbit', line: 'Every idea, in one place.', reveal: 'iris', revealDur: 0.3 } }], { width: ${W}, height: ${H}, fps: ${F}, seed: 5 });
const draw = (t) => { stack.render(t); river.render(t - 3); board.render(t - 6); gfx.render(t); pin.render(t); fx.render(t, { frame: Math.round(t * ${F}) }); };
window.addEventListener('hf-seek', (e) => draw(e.detail.time)); draw(window.__hfThreeTime || 0);
const tl = gsap.timeline({ paused: true });
tl.fromTo('#w1b', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.45);
MP.type(tl, 'type/maskRise', '#w2', { at: 3.25, dur: 2.75, fps: ${F} });
MP.type(tl, 'type/maskRise', '#w4', { at: 11.0, dur: 2.0, fps: ${F} });
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
console.log(write(DIR, html), `${stills.length} stills, ${pinKeys.length} pin keys, ${cues.length} cues`, 'todo:', st.todo.join(' | ') || 'none');
