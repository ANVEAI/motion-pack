# layers: looks, finishing, grade

Deterministic finishing layers. Every effect is a pure function of (pixel, frame, seed, t): same frame, same bits, in any render order. Owned code, no assets, no downloads.

| Piece | File | What | Tags |
|---|---|---|---|
| Finisher | `finisher.js` | WebGL2 pipeline over any plate (canvas / video / still): weave, flicker, lens, glitch, VHS tracking, chroma, bloom, halation, diffusion, sharpen, leaks, bokeh, glow, grade, paper, vignette, scan/mask, **story type slot**, dust, grain, **brand slot**, letterbox bars, TPDF dither | premium, film, retro |
| Overlay layers | `overlay.js` | Procedural layers on transparent canvases with CSS blend for HyperFrames DOM: `grain` (overlay), `vignette`, `leaks` (screen), `dust` (hair, scratch, specks), `bokeh` (circle / hex), `glow`, `paper` (multiply), `scanlines`, `bars` | hyperframes |
| Grade | `grade.js`, `presets/grades.js` | One closed-form grade (gain/WB, logistic contrast, ASC CDL, saturation, split-tone, fade) with four emitters: JS, GLSL, SVG filter, `.cube` | |
| 8 genre grades | `presets/grades.js` | `premium-product`, `warm-film`, `cool-tech`, `retro-vhs`, `nostalgic-print`, `bright-playful`, `noir`, `documentary` (+ `neutral`) | see `GRADE_TAGS` |
| Grain stocks | `presets/stocks.js` | `clean` (= ANVE kit), `digital-soft`, `film35`, `film16`, `super8`, `vhs`, `upload-safe` | |
| Finish recipes | `presets/finish.js` | One preset per genre + `launch-studio` (plate bakes bloom, vignette, grain) | see `FINISH_TAGS` |
| Lint | `finisher.js lintStack`, `overlay.js lintOverlayStack` | one of each; plate already bakes it; both Finisher and overlay grain | |

## Expansion (2026-10-13): 41 more overlay kinds, 45 looks, log cubes

All mount through the same `mountStack(root, [{kind, params}])` (overlay.js routes unknown kinds to the new files), same blend contract.

| Piece | File | Kinds | Demo |
|---|---|---|---|
| Lens + atmosphere (WebGL2) | `fx2.js` | `flareStreak` (anamorphic), `flareGhosts`, `starburst`, `lensDirt`, `rainGlass`, `fog`, `godRays`, `burnEdge` (film-burn edge, 5 edges), `vhs` (tracking band, head switch, chroma lines) | `demo/out/fx2-lens.jpg` |
| Comic + texture plates (WebGL2) | `fx2.js` | `halftone`, `speedLines`, `noiseMap` (luma matte / displacement source), `paperFold`, `crumple`, `cardboard`, `canvas`, `cloth`, `concrete`, `brushedMetal`, `tornEdge` | `demo/out/fx2-comic.jpg` |
| Particles (Canvas2D, closed form) | `canvas2d.js` | `sparks`, `embers`, `smoke`, `confetti`, `snow`, `motes`; `burstAt` turns sparks / confetti into a one-shot burst | `demo/out/fx2-particles.jpg` |
| Film artefact + HUD frames | `canvas2d.js` | `recHUD`, `timecode` (vhs / crt / film), `sprocket`, `gateEdge`, `polaroid`, `instax`, `impactFrame` (manga, `at` + `frames`) | `demo/out/fx2-frames.jpg` |
| Edit punctuation + end card (2026-10-14) | `canvas2d.js` | `invertFlash` (1-3 frame negative through `difference` blend; `at: [s...]`; `safeFlashes` / `lintFlashes` keep it at <= 3 onsets per second), `brandField` (full-bleed brand colour, logo slot (`logo`: image or URL) or the owned placeholder mark + `name`, one `line`, reveal `cut` / `iris` / `wipe`, soft scale settle from `scaleFrom`) | `demo/out/fx2-edit.jpg` |
| Audio-reactive | `canvas2d.js` | `arBars`, `arRing`, `arWave`, `arSpectrum`: driven by `env` (values per frame, optionally per band) or `beats` (seconds) via `envAt()` | `demo/out/fx2-frames.jpg` |
| 45 looks | `presets/looks.js` -> `looks/look.<name>.cube` (17^3) | bleach bypass, cross-process, day-for-night, teal-orange, two-strip, cyanotype, sepia, selenium, 8 B&W filter looks, faded 90s, matte cool / warm, golden / blue hour, overcast, neon night, pastel, high-key beauty, tobacco wash, sodium street, monsoon green, festive gold, ... (neutral names; emits GLSL / SVG / .cube via grade.js) | `demo/out/looks-sheet.jpg` |
| Log to Rec.709 | `tools/log_cubes.py` -> `looks/log.{logc3,slog3,vlog}-to-709.cube`, `looks/neutral.rolloff-709.cube` | published log curves + gamut matrices + Khronos PBR Neutral roll-off; 18% grey lands at 0.441 for all three | asserted in the script |

Tools: `node tools/emit-looks.mjs` (cubes + `looks/looks.json`), `python3 tools/looks_sheet.py` (ffmpeg lut3d applies every cube to `demo/out/plate-test.png`, so it also proves each file parses), `node tests/overlay2-sheet.mjs` (mounts every new kind in real Chrome, fails on errors or a tile identical to the bare plate).
Honest limits of the expansion: heat haze, halation and true chromatic effects need plate pixels (use `finisher.js`); the log cubes use formulae as published and were checked for 18% grey and gamut-row sums only, not against vendor reference images; looks were judged on the test plate, not on real footage; the particle layers are Canvas2D and cost ~1-3 ms per 1080p frame each (not profiled per kind).

## L7 parts (2026-10-14): two look filters, two backgrounds

Techniques studied in `docs/research/reference-stan-launchpad-2026-10.md` (craft only, nothing copied). One accent colour does the work: the archive, the line art, the field behind the type.

| Id | File | What | Params (defaults) | Demo |
|---|---|---|---|---|
| `look.duotone` | `stylize.js` | luminance -> two colours (shadow -> `dark`, highlight -> `light`), linear contrast about `pivot`. Archival photos on one accent; **white line art on an accent field = swap the colours** (dark: paper, light: accent) | `dark` #4A18ED, `light` #F5F2EA, `contrast` 1, `pivot` 0.5 | `demo/out/l7-sheet.jpg` |
| `look.threshold1bit` | `stylize.js` | 1-bit two-colour threshold, optional ordered dither (Bayer 4x4 / 8x8) | `threshold` 0.5, `dither` none \| bayer4 \| bayer8, `dark` #111111, `light` #F5F2EA, `cell` 2 (px @1080), `spread` 1 | `demo/out/l7-sheet.jpg` |
| `background.gridTunnel` | `backgrounds.js` | perspective wireframe tunnel to a vanishing point: wall lines + rings drifting towards the camera, optional zoom, fog at the vanishing point | `color`, `bg`, `lines` 8, `depth` 12, `drift` 0.5 rings/s, `zoom` 0, `vp` [0.5, 0.5], `width` 2, `fade` 0.9 | `demo/out/l7-sheet.jpg` |
| `background.dotGrid` | `backgrounds.js` | dot lattice through the frame centre, optional drift, edge fade, a clear `hole` behind type, radial glow under the dots | `color`, `bg`, `spacing` 36, `radius` 3, `drift` [0, 0], `fade` 0.5, `hole` 0, `glow` 0.5, `glowColor`, `glowAt`, `glowRadius` 0.55 | `demo/out/l7-sheet.jpg` |

```js
import { mountLook } from './layers/stylize.js';            // HyperFrames DOM: SVG filter on a wrapper of <img> / <video> / a canvas
mountLook(document.getElementById('w-archive'), 'duotone', { dark: '#F5F2EA', light: '#4A18ED', contrast: 1.6 }, { H: 1080 });
mountStack(document.getElementById('bg-1'), [{ kind: 'gridTunnel', params: { drift: 0.4 } }], { width: 1920, height: 1080, fps: 30 });   // backgrounds mount like any layer
// canvas: stylizeImageData(imageData, 'threshold1bit', { dither: 'bayer8' }); ffmpeg: fs.writeFileSync('duo.cube', toCube('duotone', {...}))
```

Measured (`tests/l7.test.mjs`, 20 checks, real GPU): the SVG filters on a DOM wrapper match the JS reference (duotone mean 0.7-0.9 levels; threshold with Bayer 4 / 8: 0.06% / 0.07% of pixels differ by more than 24 levels, dither none: 0); a flat grey under Bayer 4 / 8 covers exactly its level; the duotone `.cube` matches the reference within 0.01 levels (33^3, trilinear); both backgrounds draw the same calls for the same t in any order and re-render bit-identically after another t; a look on an empty or hidden layer paints nothing (every filter ends with `feComposite in=SourceGraphic`, so the generated Bayer tile cannot leak).
Honest limits: the looks are display-referred maths on sRGB-encoded values (no linear-light option); the SVG path assumes opaque sources (feComposite runs on premultiplied colour); a threshold has no `.cube` (dithering is spatial); there is no Finisher (GLSL) pass for these two looks yet; the Bayer phase is anchored on the filtered element's top-left corner, so a moving wrapper drags its dither with it (keep the filter on a still wrapper and move the content inside, or accept it as part of the look).

## Use

```js
// plate-based (3D kit canvas, video frame, still)
import { Finisher } from './layers/finisher.js';
const fin = new Finisher(outCanvas, 'warm-film', { width: 1920, height: 1080, fps: 30 });
fin.setSource(plateCanvas); fin.setType(typeCanvas /* premultiplied RGBA */);
fin.render(t, { frame, hits: [1.0, 2.5], cuts: [4.0] });   // hits drive chroma + glitch, cuts drive light-leak flashes (peak ON the cut frame)

// HyperFrames DOM: grade by SVG filter + overlay canvases
defs.innerHTML = toSVGFilter(GRADES['warm-film'], 'mp-grade');  world.style.filter = 'url(#mp-grade)';
const stack = mountStack(root, [{ kind: 'vignette' }, { kind: 'dust' }, { kind: 'grain', params: { stock: 'film35' } }], { width: 1920, height: 1080, fps: 30 });
bindHF(stack, { fps: 30 });          // re-renders on every 'hf-seek' (verified in HyperFrames 0.8.142)
// ffmpeg: fs.writeFileSync('look.cube', toCube(GRADES['warm-film']))  ->  -vf lut3d=look.cube
```

## Stack rule (binding)
leaks / bokeh / glow, **grade**, paper, vignette, scanlines, **story type**, dust, grain, **brand**, bars, dither. Light leaks live BELOW the type; grain over everything except brand and bars; one grade per piece (two per scene at most: `mixGrade` crossfade, 12 frames).

## Measured (`tests/layers.test.mjs`, 50 checks, real GPU)
- grain sigma at mid-grey within 1% of `0.408 x amount` for all six stocks; chroma correlation matches `1 - chroma`; film35 holds each 24 fps pattern 1.25 frames
- grade: GLSL vs JS reference max 0.56 levels over 729 colour patches; ffmpeg `lut3d` max 1.34; SVG filter mean dE <= 0.6 (max spikes only in near-black); identity pipeline max 0 levels
- determinism: bit-identical re-render after another frame, and across two fresh browser sessions, all 10 recipes; HyperFrames render of the demo is frame-hash identical across runs
- letterbox 2.39:1 on 1080p = 138 px bars; flash and chroma hit peak ON the hit frame; vignette roundness 1 is circular in 9:16
- perf @1080p (M3 Pro): premium 1.3 ms, warm-film 6 ms, retro-vhs 2.4 ms per frame

## Honest limits
Grades are starting values judged on synthetic stills (skin ramp, primaries, greys): re-judge on real footage. Overlay `grain` behaves like midBias 1 (quiet in shadows and highlights); for exact kit grain use the Finisher. Bloom/halation/chroma/lens/diffusion need plate pixels: DOM-only compositions cannot do them (render the plate to a canvas and use Finisher).
Demos: `demo/out/finisher-wide.jpg`, `finisher-tall.jpg`, `overlays.jpg`, `hf-demo.mp4` (HyperFrames project built by `demo/hf/make.sh <dir> lint|render`). Tests: `tests/run-all.sh`.
