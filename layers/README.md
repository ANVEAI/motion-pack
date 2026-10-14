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

## Round 3 parts (2026-10-14): mesh gradient, animated grade, dot condense, hologram beam

Techniques from the round-3 reference studies (craft only, nothing copied). All four are pure functions of t and mount like every other kind.

| Id | File | What | Params (defaults) | Demo |
|---|---|---|---|---|
| `background.meshGradient` | `backgrounds.js` | soft mesh / aurora field: 3-8 colour blobs with a smooth radial falloff on closed-form Lissajous paths; `loop: L` makes every frequency a multiple of 1/L (exact repeat); optional vertical sky base; seeded grain (a 256 px noise tile re-offset per grain frame) | `palette` peach \| lilac \| sky \| dusk \| mint \| ink (or `colors` + `bg`), `blobs` 5, `size` 0.62, `travel` 0.16, `speed` 0.05 Hz, `loop` 0, `grain` 0.04, `grainFps` 24, `seed` | `demo/out/r3-sheet.jpg` |
| `look.gradeIn` | `stylize.js` | animated look: a gradient map (luminance -> N stops; 2 = duotone) resolves to natural colour over `dur` from `at` (or the reverse). Out = w(t) map + (1 - w(t)) source. SVG filter (table transfer + arithmetic mix: only two weights change per frame), canvas, `.cube` per weight | `stops` ['#1B1340', '#E0457B', '#FFD9A8'], `at` 0, `dur` 1.2, `ease` lin \| soft \| hero \| sine \| expoOut, `reverse`, `amount` 1, `contrast`, `pivot` | `demo/out/r3-sheet.jpg` |
| `layers.dotCondense` | `canvas2d-r3.js` | N dots drift in a field, then converge on cue into FEWER dots (merged dots grow by the square root of how many landed: ink area kept), a LINE, or a WORD (text sampled to points once, cached). Dots and targets are paired left to right so the flow reads as one motion | `n` 220, `to` fewer \| line \| word, `count`, `gap` 46, `text`, `size` 0.26, `at` 1, `dur` 1.2, `stagger` 0.45, `radius` 4, `drift` 10, `color`, `toColor`, `field` | `demo/out/r3-sheet.jpg` |
| `overlay.hologramBeam` | `canvas2d-r3.js` | projector cone from a point (a character, a device) to a floating window or a wireframe globe: shimmer rings travelling out, a source glow, hashed flicker, the window materialising (scale, scanlines, sweep band). Screen blend: for dark or mid plates | `from` [0.2, 0.8], `rect` [0.48, 0.16, 0.4, 0.5], `mode` window \| globe, `color` #7FE7FF, `at`, `on` 0.6, `rings` 7, `scan` 140, `flicker` 0.12, `spin` (globe) | `demo/out/r3-sheet.jpg` |

```js
mountStack(el, [{ kind: 'meshGradient', params: { palette: 'peach', loop: 8 } }, { kind: 'dotCondense', params: { to: 'word', text: 'one idea', n: 300 } }], { width: 1920, height: 1080, fps: 30 });
const g = mountGradeIn(document.getElementById('w-plate'), { stops: ['#2A1E5C', '#E0457B', '#FFE2C2'], at: 2, dur: 1.5 }); g.render(t);   // on every hf-seek
hologramState(t, params)   // { beam, win, flick }: DOM text inside the window can follow the materialisation
```

Measured (`tests/r3.test.mjs`, 20 checks, real GPU): the gradeIn SVG filter matches the JS reference within 0.11-0.81 levels mean at map weights 1, 0.5 and 0.07 (0% of pixels off by more than 12); the gradeIn `.cube` matches within 0.00 levels; the three canvas kinds draw the same calls for the same t in any order and re-render bit-identically after another t; meshGradient with `loop: 8` repeats exactly; dotCondense keeps the total ink area exactly when 220 dots merge into 20, and every dot of a line lands on the line.
Honest limits: meshGradient is radial gradients in sRGB (no perceptual mixing; banding is hidden by the grain, so keep `grain` above 0.02 for slow fields); the grain tile repeats every 256 px (fine at 1080p, visible as a pattern if you scale the layer up); dotCondense's word mode samples the text on a 1/4-resolution canvas (very thin fonts lose strokes; use weight 700+); the hologram is screen-blended, so it nearly vanishes on white plates; gradeIn is display-referred like duotone and needs an opaque source.

## Round 4/5 parts (2026-10-14): embedding cloud, epicycle drawing, hex mosaic, converge to a dot

Techniques from the round-4/5 reference studies (29 public films; craft only, nothing copied). Four Canvas2D kinds in `canvas2d-r45.js`, merged into `K2D` like the round-3 ones, so they mount through `mountStack` and appear in the catalog as `layers.<name>`. Pure functions of t: no clock, no `Math.random`, no history; seeded hashes only. The maths is exported (`embeddingState`, `epicycleState`, `hexState`, `convergeState`, `cloudPlan`, `epicycleDFT`) for tests and for DOM elements that must follow a point, and `cuesR45(kind, params)` gives one sound per action.

| Id | What | Params (defaults) | Demo |
|---|---|---|---|
| `layers.embeddingCloud` | a 3D point cloud of dots and media thumbnails in seeded clusters, slowly rotating (closed-form projection). A query chip flies in; its `k` nearest neighbours (computed once from the query vector, never per frame) light up and lift toward the camera with thin lines; optionally every point collapses onto the outline of a mark (the pack placeholder, or an SVG path you pass). `loop: L` makes the rotation repeat exactly every L s | `n` 260, `clusters` 6, `spread` 0.13, `thumbs` 22 (capped at 48), `radius` 0.55, `spin` 0.03 turns/s, `loop` 0, `tilt`, `fov`, `query`, `queryAt` 1 (null = no query), `queryDur`, `liftDur`, `k` 6, `lift` 0.45, `lines`, `collapseAt` (null), `collapse`, `mark` (an SVG path `d` in a 100 box; null = the pack placeholder), `markSize`, `images: []` | `demo/out/r45-sheet.jpg` |
| `layers.epicycleDraw` | a Fourier-epicycle drawing of any SVG path: chained rotating circles whose tip traces the path. `steps: [[t, N \| 'full']]` re-traces at higher fidelity at each step; the trail is read from the analytic curve (never accumulated); optional inset of the circles around the tip, glow stroke, and an `N` / mean-error readout with a `source` note | `path` bird (preset wave \| arc \| swoop \| loop \| spiral \| bird, an SVG `d`, or `[[x, y], ...]`), `closed` auto \| true \| false (open = there and back), `samples` 1024, `terms` 64, `steps`, `period` 4 s per trace, `at`, `loop`, `trail` 1, `inset` [x, y, w, h], `insetZoom`, `circles`, `arms`, `glow`, `readout`, `source` | `demo/out/r45-sheet.jpg` |
| `layers.hexMosaic` | a field of hex tiles (flat colours, an owned engraved-line texture, or images you pass) that flip in waves from a point; a product panel can float above. `loop: L` makes the waves repeat exactly (a brand-texture background) | `radius` 64 px @1080, `gap` 5, `faces` ['color', 'engrave'] (color \| engrave \| image), `waves: [{ at, from: [x, y], speed }]`, `speed` 1500 px/s, `flip` 0.32 s, `loop` 0, `loopFrom`, `palette`, `images: []`, `panel: { rect, color, radius }` | `demo/out/r45-sheet.jpg` |
| `layers.convergeToDot` | a flat paper-style network (hollow nodes, small dots, thin lines) that contracts into one solid dot ("many -> one"), or blooms from it (`reverse`). Lines are recomputed from the node positions every frame (stateless); pair with overlay `paper` for grain | `nodes` 24, `field` 0.34, `links` 1, `hub` 12 -> `dot` 56 px, `at` 0.6, `dur` 1.1, `stagger` 0.5, `order` outside-in \| inside-out, `ease`, `reverse`, `wobble` 6, `ink`, `line`, `dotColor`, `bg` (null = transparent) | `demo/out/r45-sheet.jpg` |

```js
mountStack(el, [{ kind: 'embeddingCloud', params: { query: 'photos from the trip', collapseAt: 3 } }], { width: 1920, height: 1080, fps: 30 });
mountStack(el, [{ kind: 'epicycleDraw', params: { steps: [[0, 4], [0.8, 16], [1.6, 'full']], period: 0.8 } }], { width: 1920, height: 1080, fps: 30 });
cuesR45('convergeToDot', { at: 0.5 })   // [{ t, id: 'sfx/whoosh/swish_s', why }, { t, id: 'sfx/hit/soft', why }] (local s: add the layer's start)
```

Measured (`tests/r45.test.mjs`, node only, CI: 44 checks on a recording 2D context; `--chrome` adds 17 real-browser checks): every kind draws the same calls for the same t in forward and shuffled order at 16:9 and 9:16 (70 seeks each), nothing is visible before its start cue, and loop seams are exact (embeddingCloud loop 6, epicycleDraw loop 4, hexMosaic loop 6: t and t + L identical); the 6 lit points are exactly the 6 nearest to the query (brute-force check on 282 points); the lift moves each neighbour exactly `lift` toward the camera; after the collapse every point is on the mark outline (1e-13 px); with all 1024 terms the chain passes through its samples (1e-10 px) and the traced curve matches the input path at 1080p within Hausdorff 0.69 (bird), 0.56 (wave), 0.64 (spiral), 0.56 (swoop) px; the mean error falls 7.55% -> 1.23% -> 0.14% -> 0.00% of the figure size at N = 4, 16, 64, full; the hex lattice is exact (row step 1.5 r, column step sqrt(3) r) and each tile starts flipping at wave time + distance / speed (+ at most 0.08 s of seeded jitter); converge delays run outside-in, every line has both ends on that frame's node positions, and the reverse starts as one dot. In Chrome the stacks are bit-identical after another t and in shuffled order, and a frame costs 16.9 ms for hexMosaic at 4K (3840 x 2160, wave + panel), 1.4 ms for embeddingCloud at 1080p (420 dots + 48 thumbnails) and 1.7 ms for epicycleDraw at 1080p (all terms, inset). Worked example: `templates/demo-r45-type`.
Honest limits: a Fourier series is periodic, so an open path is traced there and back (no chord is drawn) and sharp corners round off by under 1 px at 1024 samples (more samples for a spikier outline; the DFT is O(samples squared), computed once and cached); circles beyond `maxCircles` (80) are not drawn but are still summed into the tip; the cloud's thumbnails are the pack's abstract placeholders until you pass `images`; the mean-error readout is measured at the sampled points and is labelled with its `source`; embeddingCloud and epicycleDraw draw text on the canvas, so load Manrope and IBM Plex Mono before the first frame (canvas text uses the fallback font until the face is in); hexMosaic image faces clip with a path, so a 4K field with images costs more than the flat faces measured above; convergeToDot has no `loop` (it is a one-shot, or run it twice with `reverse`).

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
