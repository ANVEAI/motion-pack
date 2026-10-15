# Lane C results: dotLottie Web vs lottie-web, Rive Web, SVGO (13 Oct 2026)

Lane folder: `lab/c-vector/`. Data: `results.json` (14 rows), `sheets/` (19 contact sheets), evidence paths inside each row.
Machine: Apple M3 Pro, Node 25.9.0, harness Chrome 154 (ANGLE-Metal), HyperFrames 0.8.142 (its own HeadlessChrome 152). Other lanes shared the GPU: ms/frame is the best of 4 to 9 alternating runs and is screenshot-bound (about 80 ms of every harness frame is the PNG), so it separates nothing at 1080.

## 1. Recommendation

| Job | Decision | Exact versions |
|---|---|---|
| Lottie in HyperFrames (default) | **ADOPT lottie-web, SVG renderer, through HyperFrames' native adapter** (3 script lines; root needs `data-duration` and `data-no-timeline`) | `lottie-web@5.13.0` (MIT, `build/player/lottie.min.js`), HyperFrames 0.8.142 |
| Lottie, named niches | **ADOPT-FOR dotlottie-web** when the file is a `.lottie` bundle, uses effects (drop shadow, fill), or you need byte-identical renders across worker counts. Needs a 7-line `hf-seek` bridge: the native adapter renders a BLANK video for it | `@lottiefiles/dotlottie-web@0.80.0` (MIT; ThorVG inside) |
| Rive | **No.** It seeks deterministically and renders in HyperFrames, but we cannot author `.riv` (Rive editor + account), the runtime is 2.0 MB, and state machines only replay at a fixed step | tested `@rive-app/canvas` + `@rive-app/canvas-advanced@2.43.1` (MIT) |
| SVGO | **ADOPT with `c-vector/svgo.config.mjs`, run ONCE per icon set when it is imported into the pack** (not at render time). Default preset is rejected: it merges strokes (draw-on stagger dies) and moves Fluent outlines | `svgo@4.1.0` (MIT) |

Summary:
1. lottie-web SVG passes G1/G3 and G4, and G2 only at noise level (worst 84.9 dB: 1 to 3 pixels of a 22 %-alpha hairline at frames 6, 10, 11). dotlottie-web (ThorVG, software raster) passes all gates with zero differing pixels.
2. The two engines agree to about 50 dB on shapes, strokes and gradients. They differ on Trim Paths placed BEFORE a Repeater (lottie-web draws shorter ticks, ThorVG matches the keyframe maths), on effects (ThorVG blurs a drop shadow, lottie-web SVG draws a hard clipped box, lottie-web canvas ignores effects) and on rotated raster images (clean at 1:1 to 3x in both; ThorVG shows a corner artefact only when an 8x8 PNG is magnified 17x). Merge Paths is unsupported by all three.
3. HyperFrames' Lottie adapter does not drive dotlottie-web 0.80 (silent blank video), and a Lottie-only composition needs `data-no-timeline` (else a 45 s dead wait and a lint error) and a root `data-duration` (else "Composition duration is 0").
4. Rive: linear animations seek bit-stably (4 recipes pass); state machines are history dependent and even a fixed replay changes with the step size (30 fps vs 60 fps: 32 to 39 dB).
5. SVGO config: `mergePaths` off, `convertShapeToPath` off, `convertPathData.makeArcs` off, `prefixIds` on: -30.7 % raw (-25.2 % gzip) over 498 icons, 0 drawable elements lost, draw-on frames bit-identical to the originals, worst raster PSNR 42.8 dB.

## 2. Versions, and one deviation that needs your call

The lane brief named `dotlottie-web@0.81.0` and `@rive-app/canvas@2.44.2`. BRIEF rule 3 says install only versions published at least 14 days ago, and the two rules conflict:

| package | named in lane brief | published | tested instead | why |
|---|---|---|---|---|
| `@lottiefiles/dotlottie-web` | 0.81.0 | 2026-10-06 (7 days) | **0.80.0** (2026-08-28) | newest release older than 14 days |
| `@rive-app/canvas`, `-advanced` | 2.44.2 | 2026-10-10 (3 days) | **2.43.1** (2026-09-23) | newest older than 14 days (2.44.0 is 13 days) |
| `lottie-web` | 5.13.0 | 2025-05-21 | 5.13.0 | ok |
| `svgo` | 4.1.0 | 2026-08-24 | 4.1.0 | ok |
| `hyperframes` | 0.8.142 | 2026-10-08 | 0.8.142 | mandated by BRIEF; already in the npx cache |

I followed the safety rule and recorded this under "needs approval" (section 9). Re-running on the newer builds is one `npm i --save-exact` plus `tools/gates.sh`: 0.81.0 becomes eligible on 20 Oct, 2.44.2 on 24 Oct.

## 3. Results table (all rows in `results.json`)

Q = quality 1 to 5 judged from 100 % stills. "n/a" = not run for that variant. G2 "FAIL (noise)" = every mismatch is above 60 dB.

| variant | package@version | G1 | G2 | G3 | G4 | worst dB | ms/frame | Q | verdict |
|---|---|---|---|---|---|---|---|---|---|
| C1-lottie-web-svg | lottie-web@5.13.0 | pass | FAIL (noise) | pass | pass (native adapter) | 84.9 | 87.0 | 4 | **ADOPT** |
| C1-lottie-web-canvas | lottie-web@5.13.0 | pass | pass | pass | pass (needs explicit px container) | - | 89.0 | 3 | REJECT |
| C1-dotlottie-web | dotlottie-web@0.80.0 | pass | pass | pass | pass (hf-seek bridge or shim) | - | 83.7 | 4 | **ADOPT-FOR** |
| C1-dotlottie-web-hf-native-adapter-only | dotlottie-web@0.80.0 | n/a | n/a | n/a | **FAIL (blank video)** | - | - | 1 | REJECT |
| C1-dotlottie-web-webgl | dotlottie-web@0.80.0 (dist/webgl) | pass | pass | pass | n/a | - | 80.7 | 4 | REJECT |
| C2-rive-advanced-linear-persist | @rive-app/canvas-advanced@2.43.1 | pass | pass | pass | pass (hf-seek bridge) | - | 83.1 | 4 | REJECT |
| C2-rive-advanced-linear-fresh | same | pass | pass | pass | n/a | - | 82.0 | 4 | REJECT |
| C2-rive-advanced-linear-settime | same | pass | pass | pass | n/a | - | 88.8 | 2 | REJECT |
| C2-rive-advanced-sm-replay | same | pass | pass | pass | n/a | - | 81.1 | 3 | REJECT |
| C2-rive-advanced-sm-incremental | same | pass | **FAIL** | **FAIL** | n/a | 20.2 | 84.1 | 1 | REJECT |
| C2-rive-highlevel-scrub | @rive-app/canvas@2.43.1 | pass | pass | pass | n/a | - | 82.0 | 4 | REJECT |
| C3-svgo-default-preset | svgo@4.1.0 | pass | pass | pass | pass | - | - | 1 | REJECT |
| C3-svgo-mergePaths-off-only | svgo@4.1.0 | n/a | n/a | n/a | n/a | - | - | 3 | REJECT |
| C3-svgo-recommended | svgo@4.1.0 | pass | pass | pass | pass | - | - | 5 | **ADOPT** |

Gate coverage: the all-frame Lottie run samples every one of the 60 frames (forward, repeat, reverse, shuffled) plus 6 cold pages; the same variants were also run with 12 samples at 1080 (2 runs), at 2160 and at 60 fps (120 frames, half-frame times). The verdict of each gate never changed between those runs. SVGO rows run the pack's draw-on engine on 6 icons x 90 frames through the harness (G1 to G3 pass for the original icons too: the engine is pure).

## 4. C1: Lottie

### 4.1 The test asset
`lottie/badge.json` (5,870 B), hand-authored by `lottie/gen-badge.mjs` (no downloads): 1080x1080, 60 frames at 30 fps. Gradient-filled badge scaling 0 -> 112 -> 100 (two eased segments), round-capped check drawn by Trim Paths, hairline ring, ring burst (stroke ring with animated width, scale and opacity) plus 12 radial ticks made with Repeater + Trim Paths. `badge.lottie` (dotLottie zip) is 1,506 B and loads with bit-identical frames.

### 4.2 Gates (harness, `lottie/gates*`)
- dotlottie-web (software ThorVG): all gates pass over all 60 frames, no mismatching pixel in any pass.
- dotlottie-web WebGL build: all gates pass too (ANGLE-Metal), median 47.8 dB from the software build, only frame 37 differs strongly.
- lottie-web canvas: all gates pass.
- lottie-web SVG: G2 fails at frames 6, 10, 11 (87.8, 84.9, 90.5 dB): 1 to 3 pixels, at most 13/255, all on the 22 %-alpha hairline ring. Forward = cold = repeat, reverse = shuffled. Using `ip: 14` instead of an opacity-0 hold on the burst layer does not change it. It is Chrome raster state on a thin translucent stroke, not lottie-web state: the badge transform matrices are identical across arrival paths.

### 4.3 Fidelity: ThorVG vs lottie-web (`sheets/c1-fidelity-1080.jpg`, `c1-worst-frames.jpg`, `c1-repeater-trim-isolation.jpg`)
Per-frame PSNR over 60 frames (`lottie/fidelity-1080/fidelity.json`):

| pair | median | worst | where the worst is |
|---|---|---|---|
| ThorVG vs lottie-web SVG | 43.8 dB | 26.8 dB (frame 26) | tick trim (below) |
| lottie-web SVG vs canvas | 65.2 dB | 29.2 dB (frame 37) | sliver dots (below) |
| frames with no ticks (12, 59) | 50.9 / 49.4 dB | | AA and gradient only |

Differences found, in order of importance:
1. **Trim Paths before Repeater** (JSON order `[path, stroke, trim, repeater]`, which is the order After Effects exports): ThorVG draws the ticks exactly as the keyframes say (within 1 px of the maths at every frame, identical to the same group with no repeater). lottie-web SVG and canvas draw them visibly shorter (tick spans y 15..62 vs 15..85 px at frame 26). Putting the Repeater before the Trim makes both engines agree. A Repeater with 1 copy triggers it too; `m: 2` (individually) makes lottie-web draw nothing from frame 24.
2. **Sliver trim segments** (frame 37, trim start 99 % end 100 %): lottie-web SVG and ThorVG draw a round-cap dot, lottie-web canvas draws nothing.
3. **Effects** (feature probe cell 11 and 12): ThorVG blurs a drop shadow correctly; lottie-web SVG draws a hard, box-clipped shadow; lottie-web canvas draws none. Fill effect works in ThorVG and lottie-web SVG, ignored by canvas.
4. **Rotated embedded raster image**: at extreme magnification (cell 14, an 8x8 PNG scaled 17x) ThorVG is blurry, has a detached corner tile and an 11 % smaller footprint; lottie-web is clean. A follow-up with a 128 px PNG at 1:1, 3x, 0.5x and a static 30 degree layer (`lottie/probe-image`, `sheets/c1-image-probe-f20.jpg`, `c1-image-probe-corner.jpg`) shows NO artefact: ThorVG's image edges are anti-aliased and its footprint 1 to 1.5 % smaller, while lottie-web's edges are hard and aliased; interior detail differs by resampling (PSNR 26 dB at 1:1, 18 dB at 3x on a 1-px grid). Only absurd upscales hit the artefact.
5. **lottie-web canvas only**: animated gradient-stroke width ignored, group opacity applied per item (cell 15, 18).
6. **Baseline**: shapes, strokes, gradients, masks, mattes, parenting, multiply blend, precomp + time remap, expression `time*90`, skew, trim m=2, joins: geometry agrees within 0.17 px and 2 % area (`lottie/probe-analysis/probe-geometry.json`); the curved position path (spatial tangents) is within 0.75 px. Merge Paths (subtract) is unsupported by all three players (all draw the union).
7. Half-frame times (60 fps): ThorVG and lottie-web statistics identical to 30 fps; `useFrameInterpolation` has no effect through `setFrame` (identical on 120 frames).

### 4.4 Sharpness at 2160 px
Harness at 2160x2160, final frame (`lottie/sharpness/sharpness.json`, `sheets/c1-sharpness-crops-2160.jpg`): edge spread ThorVG 2.01 px, lottie-web SVG 2.15, canvas 2.13; hairline contrast 43.2 / 44.2 / 44.0. All crisp: they re-rasterise the vector at the target size.
Through HyperFrames `--resolution square-4k` (DPR 2, `sheets/c1-hf-4k-sharpness.jpg`): lottie-web SVG 2.25 px, dotlottie-web following devicePixelRatio 2.9 px, **dotlottie-web with `devicePixelRatio: 1` pinned 4.39 px (visibly soft: the 1080 bitmap is upscaled)**. So never pin DPR for the canvas players.

### 4.5 Init time, speed, payload (`lottie/init-timing.json`, median of 9 fresh pages)

| | init to first frame | JS per seek 1080 / 2160 | harness ms/frame 1080 / 2160 | shipped bytes raw / gzip |
|---|---|---|---|---|
| dotlottie-web | 34 ms (player ready after 19 ms) | 2.2 / 7.6 ms (CPU raster in wasm) | 83.7 / 110.3 | 1,409,037 / 530,448 (wasm 1.24 MB) |
| lottie-web SVG | 26 ms | 0.1 / 0.1 ms (raster deferred to Skia) | 87.0 / 161.9 | 311,574 / 77,282 (full build; svg-only 242,630 / 62,385) |
| lottie-web canvas | 32 ms | 0.1 / 0.1 ms | 89.0 / 169.5 | same file |

HyperFrames wall time for 60 frames: 1080p lottie-web SVG 4.75 s, dotlottie bridge 4.6 s; `square-4k` 6.1 s vs 5.4 s (best of 2). Nothing to choose on speed. At 2160 the harness shows ThorVG 32 % cheaper per frame, which does not show up in HyperFrames' own capture.

### 4.6 G4: HyperFrames 0.8.142 (`hf/*/index.html`, `hf/renders/*.mp4`, `sheets/c1-g4-*.jpg`)
Command as in the BRIEF (`render <dir> -o out.mp4 --video-bitrate 26M -w 2 --quiet`). Decoded mp4 frames vs harness frames: median 39.6 dB for lottie-web SVG, 39.8 dB dotlottie bridge and shim (codec loss only; the only "misaligned" frames are the static tail). 60 fps renders (120 frames, half-frame times) also match (39.6 / 39.7 dB).
How the adapter works (read from the 0.8.142 runtime): it reads `window.__hfLottie` (and auto-discovers `window.lottie.getRegisteredAnimations()`); an object with `goToAndStop` is treated as lottie-web and seeked with `goToAndStop(timeMs, false)` (loops: `goToAndStop(frame % total, true)`, after the end: `goToAndStop(total - 1, true)`); an object with `pause` plus `totalFrames` or `duration` is treated as dotLottie and seeked with `setCurrentRawFrameValue(frame)` if it exists, else `seek(percent)`. **`DotLottie` in dotlottie-web 0.80 has neither (it has `setFrame`), so the adapter does nothing and the video is blank, with no warning** (`hf/renders/dl-native.mp4`, PSNR 10.9 to 11.8 dB, `sheets/c1-hf-dl-native-adapter-probe.jpg`).

## 5. C2: Rive

Sample asset: `https://cdn.rive.app/animations/vehicles.riv`, 58,792 bytes, sha256 `46bb250cde0b0223a15faddac33d08fa00d4b6acebc2e4e827391ae0113768a3`, stored in `rive/dl-vehicles/` (outside the pack, test only, licence not stated, not redistributed). Because its licence is not stated, no render of it is committed either: the probe contact sheet `sheets/c2-probe-linear-fresh.jpg` was removed from the repository (audit H3); the numbers below stand on their own. Contents: artboard Truck 1920x1080 (animations idle, curves, bounce; state machine `bumpy` with trigger `bump`) and Jeep 1000x1000 (8 animations; state machine `weather`, bool `Raining`).

Can Rive seek deterministically? **Yes for linear animations, only conditionally for state machines.** (`rive/probe/*`)

| recipe | G1 G2 G3 | notes |
|---|---|---|
| advanced API, `inst.time = 0; inst.advance(t); inst.apply(1); artboard.advance(0)` on one persistent artboard (`persist`) | pass | the recipe in the bridge below |
| new artboard + animation per seek, `advance(t)` once (`fresh`) | pass | equal to `persist` to 79 dB |
| new artboard per seek, n steps of 1/fps (`fresh-step`) | pass | equal to `persist` to 48 dB (float accumulation) |
| `inst.time = t` without advance (`settime`) | pass | wrong for loops: no wrap, 27 dB off after the first loop. Do not use |
| high level `rive.scrub('idle', t)` | pass | bit-identical to `persist` on 90 frames; deprecated in 2.43 (as is the `animations` parameter) |
| state machine, fresh instance per seek, n fixed steps of 1/fps, input fired at a fixed step (`sm-replay`) | pass | **step dependent**: same t at 30 fps vs 60 fps steps differs 31.7 to 38.8 dB; n small steps vs one big `advance(t)` differs 19.9 to 24.8 dB; cost grows with t |
| state machine, persistent instance, advance by delta (`incremental`, how a live player works) | **FAIL G2, G3** | 25 mismatching frames, worst 20.2 dB: real state error |

Cost: init 46 to 55 ms with a warm wasm cache (about 180 ms on a cold Chrome: it compiles 1.95 MB of wasm); JS per seek 0.1 ms (persist) to 1.4 ms (SM replay, up to 90 steps); payload 2.0 MB raw / 829 KB gzip (advanced), 2.4 MB raw (high level). Vector, crisp at 3840x2160 with a DPR-sized canvas (`sheets/c2-rive-4k-crop.jpg`). HyperFrames render through the `hf-seek` bridge passes (90 frames, 38.6 dB vs harness, no misalignment, byte-identical mp4 for `-w 1` and `-w 2`).
Authoring: the Rive editor (rive.app account) is the only supported authoring route; we cannot use it, so every `.riv` would have to arrive from a designer, with its own licence. Verdict: no.

## 6. C3: SVGO

Inputs (read-only, checksums verified after the run): 111 Lucide, 108 Phosphor, 279 Fluent Emoji flat SVGs. `npx svgo@4.1.0` outputs: `optimized/<set>/` (recommended config) and `optimized/_a-default-preset/<set>/` (config a).
Measured in Chrome: raster PSNR at 256 px on white and on black, and the pack's own `drawon.js` selector (`path,line,polyline,polygon,circle,ellipse,rect` with `getTotalLength`): per element tag, screen-space length, start and end point.

| config | lucide raw | phosphor raw | fluent raw | all raw / gzip | drawables (lucide) | icons whose count changed | min PSNR |
|---|---|---|---|---|---|---|---|
| a: default `preset-default` | -14.4 % | -2.5 % | -46.2 % | -40.9 % / -33.2 % | 380 -> 195 | 70 of 111 lucide, 170 of 279 fluent | 32.9 dB (20 emoji < 40) |
| b0: `mergePaths` off only | -9.3 % | -2.5 % | -43.7 % | -38.4 % / -32.9 % | 380 -> 380 | 0 | 32.9 dB (20 emoji < 40), 6 lengths + 1 end point changed |
| **REC: `svgo.config.mjs`** | **-8.9 %** | **-2.5 %** | **-34.8 %** | **-30.7 % / -25.2 %** | 380 -> 380 | **0** | **42.8 dB** (fluent), 52.0 (lucide), 54.9 (phosphor); 198 of 498 pixel-identical |
| REC + `floatPrecision 4` | -8.8 % | -2.0 % | -27.0 % | -23.9 % / -19.0 % | 380 -> 380 | 0 | 41.8 dB (fluent), 69.7 (lucide) |
| REC + multipass | -8.9 % | -2.6 % | -34.8 % | -30.7 % | | 1 | the second pass deletes an element of `fluent/folded-hands` |

Ablation (`svgo/results/ablation.json`, each of the 33 preset plugins switched off one at a time from b0): `mergePaths` is the only plugin that changes the drawable count; `convertShapeToPath` is the only one that changes tags (10 icons, costs 209 B over 498 icons to keep off); **`convertPathData` is the only plugin that moves pixels and lengths**, and the sweep (`sweep-pathdata*.json`) pins it on `makeArcs` (arc fitting, tolerance 0.5 % of the radius: the outline of `fluent/disguised-face` moves by up to 0.089 units of 32, i.e. 0.7 px at 256 px, versus 0.001 units with it off). Turning `makeArcs` off lifts the worst PSNR from 32.9 to 42.8 dB and removes every length change, for 8.9 points of Fluent savings. The remaining ~42 dB floor is on three faces and is raster antialiasing of identical geometry (maximum path deviation 0.0000 measured on `upside-down-face`), not a shape change.

Pack draw-on engine on 6 Lucide icons (sun, wifi, sliders-horizontal, list-checks, server, calculator), 90 frames, as a harness page and as a HyperFrames project (`svgo/results/drawon-pairwise.json`, `drawon-test.json`, `sheets/c3-drawon-before-after.jpg`, `c3-g4-hf-drawon.jpg`):
- recommended: element counts unchanged (9, 4, 9, 5, 4, 10), frames **bit-identical to the originals on all 90 frames** (999 dB); the HyperFrames render equals the harness to 44.5 dB (codec only).
- default preset: counts collapse to 2, 1, 1, 1, 3, 2; mid-draw frames 7 to 13 dB from the original on five of six icons (everything appears at once, `sheets/c3-drawon-before-after.jpg`); over the 90 frames only 34 are identical to the original, worst 16.2 dB.
Other checks: per-element `fill` ownership survives in all but one Fluent icon (`shaking-face`, relevant only to the engine's `fillAfter`). The ids of all 4 Fluent files that carry a `<clipPath>` become `id="a"` under the default preset; their clips are identical 32x32 rects so pixels did not change today (46.4 dB vs 61.3 dB for the recommended config with 4 icons inlined in one document), but `prefixIds` is kept as insurance for gradients or different clip shapes. One end-point artefact remains: `fluent/face-with-spiral-eyes` (dangling `m` after the last drawn segment, pixels unchanged).

**When to run it:** once per icon set at import (next to `ORIGIN.txt`), and on any SVG an agent pastes inline. Keep the untouched originals as the source of truth. Re-run when SVGO's version changes and record the version in `ORIGIN.txt`. Never as a render step. Command (the CLI also auto-loads `./svgo.config.mjs` from the current directory):
`npx svgo@4.1.0 --config c-vector/svgo.config.mjs -r -f <in-dir> -o <out-dir>`

## 7. Adapter snippets (smallest code that makes each winner seek-safe in HyperFrames 0.8.142)

### 7.1 lottie-web SVG, native adapter (the default)
```html
<!-- root: data-duration is required (render fails "Composition duration is 0" without it); data-no-timeline skips the GSAP-timeline checks -->
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1080" data-duration="2" data-no-timeline>
  <div id="badge" class="clip" data-start="0" data-duration="2"></div>
</div>
<script src="lib/lottie.min.js"></script>   <!-- local copy of lottie-web@5.13.0 build/player/lottie.min.js -->
<script src="assets/badge.js"></script>     <!-- window.BADGE = { ...Lottie JSON } : inline data, no async fetch -->
<script>
  const anim = lottie.loadAnimation({ container: document.getElementById("badge"), renderer: "svg", loop: false, autoplay: false, animationData: window.BADGE });
  (window.__hfLottie = window.__hfLottie || []).push(anim);
</script>
```
Rules: set `loop` explicitly (lottie-web defaults to true). A Lottie plays against ROOT composition time: a plain clip with `data-start="1"` does NOT delay it (`hf/lw-svg-offset`, `sheets/c1-hf-lottie-start-offset.jpg`: at t = 1 s it is already at frame 30). To start it at T, mount it in a sub-composition host (`data-composition-src`, `data-start=T`, `data-no-timeline`; the adapter subtracts the sub-composition's start) or author the delay into the file. Do not use the canvas renderer without an explicit pixel size on the container.

### 7.2 dotlottie-web through an `hf-seek` bridge (niches)
```html
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1080" data-duration="2" data-no-timeline>
  <canvas id="badge" class="clip" data-start="0" data-duration="2" style="width:1080px;height:1080px"></canvas>   <!-- explicit CSS px; no width/height attributes -->
</div>
<script src="assets/badge.js"></script>
<script type="module">
  import { DotLottie } from "./lib/dotlottie-web/index.js";               // copy dist/index.js + dist/dotlottie-player.wasm from the package
  DotLottie.setWasmUrl(new URL("./lib/dotlottie-web/dotlottie-player.wasm", import.meta.url).href);
  const FPS = 30;                                                           // the Lottie's own fr
  const player = new DotLottie({ canvas: document.getElementById("badge"), data: window.BADGE, autoplay: false, loop: false,
    renderConfig: { autoResize: false, freezeOnOffscreen: false } });       // no devicePixelRatio override: --resolution square-4k stays sharp
  const loaded = new Promise((res, rej) => { player.addEventListener("load", res); player.addEventListener("loadError", rej); });
  window.addEventListener("hf-seek", (e) => e.detail.waitUntil(loaded.then(() => player.setFrame(Math.min(player.totalFrames - 1, Math.max(0, e.detail.time * FPS))))));
</script>
```
`e.detail.time` is composition time; subtract the clip's start yourself. `data` also accepts a `.lottie` zip as `ArrayBuffer`. A 12-line alternative that keeps the adapter's loop/offset/hold logic: register a lottie-web-shaped shim `{ wrapper: canvas, loop: false, frameRate, totalFrames, pause() {}, goToAndStop(v, isFrame) { player.setFrame(isFrame ? v : v * frameRate / 1000); } }` on `window.__hfLottie` plus `hf-seek` -> `waitUntil(loaded)` (`hf/dl-shim`, identical output).

### 7.3 Rive (not adopted; kept as an escape hatch for a supplied `.riv`)
`hf/rive-bridge/index.html`, 15 script lines: `import RiveCanvas from "./lib/rive/canvas_advanced.mjs"`, fetch the wasm bytes yourself and pass `wasmBinary` (otherwise Rive logs `console.error` for HyperFrames' wrong wasm MIME and `check` fails), size the canvas by `devicePixelRatio`, then on `hf-seek`: `inst.time = 0; inst.advance(t); inst.apply(1); artboard.advance(0); renderer.clear(); renderer.save(); renderer.align(...); artboard.draw(renderer); renderer.restore(); renderer.flush(); rive.resolveAnimationFrame();`. For a state machine, rebuild a fresh instance and replay `n = round(t * fps)` steps of a FIXED canonical step.

### 7.4 SVGO
`npx svgo@4.1.0 --config c-vector/svgo.config.mjs -r -f <in> -o <out>` (see section 6).

## 8. Gotchas hit (all reproduced)

1. **HyperFrames + dotlottie-web: silent blank video** via `window.__hfLottie`. The skill's dotLottie snippet (`<script src="https://unpkg.com/@lottiefiles/dotlottie-web">` then `new DotLottie`) cannot work either: the package ships ESM and CJS only, no browser global. Use the bridge (7.2).
2. **Lottie-only compositions**: `hyperframes lint/check` error `missing_timeline_registry`, and `render` waits 45 s for `window.__timelines["main"]` (warning `sub_timeline_readiness_timeout`). `data-no-timeline` on the root fixes both (49.1 s -> 4.75 s, lint 0 errors, check passes). Also required: root `data-duration`. Without it `render` prints "Composition duration is 0" (tested with the root attribute alone removed; removing it from root and clip also gave no output file) and the CLI process lingers until killed; wrap renders in `timeout -k`. The docs' statement that `data-duration` is optional for Lottie did not hold in 0.8.142 with `data-no-timeline`.
3. **Canvas players need an explicit pixel container**: HyperFrames stamps the root's pixel size after inline scripts ran, so lottie-web's canvas renderer measured 0x0 and rendered a blank video (PSNR 11 dB). SVG renderer, dotlottie (explicit CSS px) and Rive are fine.
4. **DPR**: `--resolution square-4k` renders at devicePixelRatio 2. Pinning `devicePixelRatio: 1` on dotlottie-web upscales a 1080 bitmap (edge spread 4.39 vs 2.9 px).
5. **wasm MIME**: HyperFrames' static server does not send `application/wasm`: ThorVG only warns (`check` still passes); Rive's loader logs `console.error` and `check` FAILS until you pass `wasmBinary`.
6. **Rive packaging**: `canvas-advanced` requests `canvas_advanced.wasm` but ships `rive.wasm` (map it in `locateFile`); the high-level `@rive-app/canvas` fetches wasm from a CDN and falls back to jsDelivr unless you call `RuntimeLoader.setWasmUrl(local)` and `setWasmFallbackUrl(null)` (render-time network access).
7. **Time arrives as floats**: the adapter calls `goToAndStop(733.33333333333326, false)` (milliseconds, converted back to frames by `frameModifier`), so a frame can land a hair off its integer. Observed: in the HyperFrames render of the lottie-web canvas variant, frame 37 (the sliver frame) matches the harness frame only to 28.9 dB while every other frame matches to about 39 dB; the likely cause is that float landing on the other side of lottie-web's sliver threshold (not proven). Nothing else was affected.
8. **Byte reproducibility**: HyperFrames output with inline SVG content differs between `-w 1` and `-w 2` (lottie-web SVG: 59 of 60 frames, 54 to 66 dB between the two mp4s; the SVGO draw-on page: 74 of 90 frames, 73 to 103 dB) but is identical across repeat runs with the same `-w`; canvas-bitmap paths (dotlottie bridge, Rive bridge) are byte-identical for `-w 1` and `-w 2`. Pin `-w 2` as the BRIEF does.
9. **Rive time handling**: never set `instance.time` for looping animations (use `advance`); `scrub()` is deprecated; state machines are step-size dependent.
10. **SVGO CLI**: no `--no-config`; it auto-loads `./svgo.config.mjs` from the cwd, so running "default" next to our config silently uses ours (a separate `svgo/a-default.config.mjs` is used for config a).
11. **lottie-web is not the only reference**: the installed `text-to-lottie` skill verifies in Skia Skottie, a third engine. The three engines tested here already differ on trim/repeater order, effects and rotated images, so re-check any AI-authored Lottie in the player that ships (lottie-web).
12. Order of modifiers matters for portability: `[path, stroke, repeater, trim]` rendered identically in lottie-web and ThorVG (checked at frames 16 to 30); `[path, stroke, trim, repeater]` did not.

## 9. Not tested, and needs approval

Not run (outside the test rules):
- Re-testing `dotlottie-web@0.81.0` and `@rive-app/canvas@2.44.2` (younger than 14 days, see section 2). Eligible 2026-10-20 and 2026-10-24; or approve an exception now.
- Nothing else was downloaded beyond the npm packages, the one `.riv` sample named in the lane brief (URL and size above), and nothing was posted or published.

Not tested (and why):
- Cross-machine bit-stability of ThorVG's software raster (one machine only); only worker-count independence was measured.
- Lottie text layers and glyph fonts, 3D layers, expressions beyond `time*90`, `.lottie` themes and interactive state machines, dotlottie-web's default `autoResize` / `freezeOnOffscreen` (turned off in every page), Windows/Linux Chrome.
- Merge Paths could not be made to work in any engine, so no winner exists for that feature.
- Rive: authoring (needs the editor), text and fonts, view models / data binding, audio, `@rive-app/webgl2` and `canvas-lite`, the Jeep artboard and its `weather` state machine, other licences.
- SVGO on fill-only sets with the draw-on engine (no stroke, so draw-on is not meaningful; only fidelity and element counts were measured), Fluent "color" and "high contrast" sets, `reusePaths`.
- HyperFrames sub-composition lint reports a false `missing_lottie_script` error when the player script is loaded by the host (render is fine).

## 10. Where things are

- `results.json` (rows), `sheets/*.jpg`, `svgo.config.mjs`, `optimized/<set>/` and `optimized/_a-default-preset/<set>/`.
- Lottie: `lottie/` (pages `dl.html`, `lw-svg.html`, `lw-canvas.html`, `dl-webgl.html`; generators `gen-badge.mjs`, `gen-probe.mjs`, `gen-diag*.mjs`; analysis `compare.py`, `sharpness.py`, `probe-*.py`, `measure-init.mjs`; evidence `gates*/`, `probe/`, `diag/`).
- HyperFrames projects: `hf/lw-svg`, `lw-canvas`, `dl-native` (blank), `dl-bridge`, `dl-shim`, `dl-dpr`, `lw-svg-offset`, `rive-bridge`, `svgo-orig|default|rec`; renders in `hf/renders/`.
- Rive: `rive/adv.html`, `rive/hl.html`, `rive/probe/`, `rive/dl-vehicles/vehicles.riv`.
- SVGO: `svgo/` (`lib.mjs`, `harness.mjs`, `metrics.html`, `ablate.mjs`, `sweep-pathdata*.mjs`, `final-compare.mjs`, `run-drawon.mjs`, `results/`).
- Tools: `tools/gates.sh` (2 harness runs), `tools/timing.sh` (best of N), `tools/pairwise.py`, `tools/mp4-vs-stills.py`, `tools/build-results.mjs` (regenerates `results.json` from the reports).
