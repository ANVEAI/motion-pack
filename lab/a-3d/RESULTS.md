# Lane A (3D plates): post chain, React layer, physics

13 Oct 2026. Machine: M3 Pro, Chrome 154 headless (ANGLE Metal), Node 25.9. Everything is under `lab/a-3d/`.
Work split: the post-chain comparison (A1) is mine; the React layer (A2) and physics (A3) were run by two sub-workers whose full reports are `react/RESULTS-A2.md` and `physics/RESULTS-A3.md`. I read their reports and contact sheets and re-ran their key gates myself (`qa/recheck/`: P1 on the real kit page, and the A2 vanilla and R3F pages, all PASS; V1 vs V2 stills 106.07 / 106.53 dB, as they reported).
Time: about 1 h 45 min wall-clock (13:35 to 15:20) with the two sub-workers running in parallel; one GPU job at a time through `tools/gpu-run.py`. Wiring a new post chain into the real set took under 30 minutes, so the standalone-scene fallback was not needed.
Machine-readable rows: `results.json` (BRIEF schema, 22 rows: my A1 rows + `react/results-A2.json` + `physics/results-A3.json`).

## 1. Verdicts (read this first)

| question | answer |
|---|---|
| Which post chain should the kit use? | **Keep the kit's own chain (`kit/core.js`).** pmndrs `postprocessing` only matches the kit's look after two custom effects and per-camera re-tuning, and costs about 20-37 % more per frame; three's own addons match it numerically (41-43 dB) at about 55 % more per frame with soft near-field silhouettes; a single sample with SMAA (and MSAA 4) keeps edges clean but loses the soft key-light shadow and the shutter blur that the 4-subframe jitter provides. |
| Any use for pmndrs `postprocessing`? | **ADOPT-FOR a per-spot tail stage (A4):** one `EffectPass` (LUT3DEffect, a tone-map, any single-pass effect) after the kit's comp and before the accumulation. 16 added lines, bit-identical to the kit when idle (PSNR inf), seek-safe, 0.6 MB ESM, no bundler. |
| Bump three? | **No. Stay on 0.160.0.** 0.186.1 renders every lit surface about 7/255 darker (PSNR 32.8 dB vs the kit; 38.3 dB after a +7.3 % exposure trim, still under the 40 dB bar), the kit's shadow patch silently stops applying (r186 ships its own Vogel-disk PCF), and pmndrs 6.36.7 supports three < 0.174 only (6.39.5 needs >= 0.168 and changed its DoF units). Nothing in r186 improves our plates. |
| Rapier baking worth adding? | **Yes, as a build-time baker only** (`bake.mjs` 143 lines + `table-player.js` 63 lines + a 12-line timeline adapter). The baked table passes G1-G4 bit-exactly on the real kit page (I re-ran it); live `@react-three/rapier` fails G2 (13.6 dB) and the seekable variant needs 114 MB of tooling and a bundler. Details in section 5. |
| React layer (R3F, Drei, @react-three/postprocessing)? | **No, for offline plates.** The same shot built in vanilla three + pmndrs and in R3F is pixel-identical (103.8-106.5 dB between them) with the same gate results and the same GPU time (about 11 ms), at 6x the installed dependencies (215 MB vs 35 MB), a bundler and 2.4x the variant code. Two Drei pieces are worth porting as vanilla code (SoftShadows PCSS, MeshReflectorMaterial). Details in section 4. |

**Recommended combination, exact versions:** three 0.160.0 (kit, jsDelivr, MIT) + the kit's own post chain, unchanged. Optional per spot: `postprocessing@6.36.7` (Zlib) for the tail stage. Build time only: `@dimforge/rapier3d-compat@0.21.0` (Apache-2.0) for baked physics. Do not adopt: three 0.186.1, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `@react-three/rapier` for plate rendering.

## 2. Results table (all rows; `results.json` has the full fields and evidence paths)

Columns: gates G1 same_twice / G2 order_independent / G3 cold_equals_warm / G4 production path (`-` = not run). A G3 flagged "noise only" by the harness (a single 1-LSB pixel, 113-116 dB) counts as pass, per the BRIEF (above 60 dB is GPU noise); it also occurs on A0 itself. ms/frame = full production frame (4 jittered subframes, 1080x1920) of the kit page, best of 3 interleaved rounds, median of frames 150/305/330; the GPU is shared with other lanes so read ratios, not absolutes (`qa/bench.json`, `qa/bench-summary.json`). The A2 and A3 rows were measured by the sub-workers on their own scenes (their ms/frame is the harness figure, not comparable with the kit rows). PSNR is against A0 over my 5 key frames (`qa/psnr.json`).

| variant | package @ version | licence | G1 / G2 / G3 / G4 | worst PSNR (gates) | vs A0 (dB) | ms/frame | Q | LOC | deps MB | bundler | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A0-kit-baseline | three 0.160.0 | MIT | pass / pass / pass / pass | 116.1 | - | 44.5 | 4 | 51 | 1.21 | no | KEEP-CURRENT |
| A1-pp | postprocessing 6.36.7 | Zlib | pass / pass / pass / - | - | 27.7-41.9 | 53.6 | 3 | 95 | 1.8 | no | REJECT |
| A1-pp-restore | postprocessing 6.36.7 | Zlib | pass / pass / pass / - | - | 27.7-42.8 | 61.1 | 4 | 95 | 1.8 | no | REJECT |
| A1-pp-nodof | postprocessing 6.36.7 | Zlib | pass / pass / pass / - | - | 30.5-41.3 | - | 3 | 95 | 1.8 | no | REJECT |
| A1-pp-smaa | postprocessing 6.36.7 | Zlib | pass / pass / pass / - | 116.1 | 25.4-31.0 | 14 | 2 | 95 | 1.8 | no | REJECT |
| A1-pp-smaa-msaa4 | postprocessing 6.36.7 | Zlib | - / - / - / - | - | - | - | 3 | 95 | 1.8 | no | REJECT |
| A1-pp-agx | postprocessing 6.36.7 | Zlib | - / - / - / - | - | 19.0-20.5 | - | 2 | 95 | 1.8 | no | REJECT |
| A1-pp-lut | postprocessing 6.36.7 | Zlib | - / - / - / - | - | 26.3-31.5 | - | 3 | 95 | 1.8 | no | REJECT |
| A2-addons | three (examples/jsm/postprocessing) 0.160.0 | MIT | pass / pass / pass / pass | - | 33.7-42.6 | 68.9 | 3 | 71 | 1.31 | no | REJECT |
| A2-addons-smaa | three (examples/jsm/postprocessing) 0.160.0 | MIT | pass / pass / pass / - | 113.1 | 29.3-31.4 | 12.6 | 2 | 71 | 1.31 | no | REJECT |
| A3-three186 | three 0.186.1 | MIT | pass / pass / pass / - | 113.1 | 32.3-39.8 | 42 | 3 | 0 | 2.02 | no | KEEP-CURRENT |
| A3c-three186-trim | three 0.186.1 | MIT | pass / pass / pass / FAIL | 113.1 | 37.7-39.7 | 42 | 4 | 1 | 2.02 | no | KEEP-CURRENT |
| A1b-pp639-three186 | postprocessing 6.39.5 | Zlib | pass / pass / pass / - | 116.1 | 26.9-32.1 | - | 3 | 95 | 2.63 | no | REJECT |
| A4-kit-plus-pp-tail | postprocessing 6.36.7 | Zlib | pass / pass / pass / pass | 116.1 | 31.7-34.4 | 47.6 | 4 | 16 | 1.8 | no | ADOPT-FOR per-spot LUT grade or a one-off tail effect |
| A2-v1-vanilla | three + postprocessing (pmndrs, no Re... three 0.160.0, postprocessing 6.36.7 | MIT | pass / pass / pass / pass | - | - | 124.6 | 4 | 161 | 35.0 | no | ADOPT-FOR single-sample plates and quick previews with pmndrs effects |
| A2-v2-r3f | @react-three/fiber 9.8.1 | MIT | pass / pass / pass / pass | - | - | 120.2 | 4 | 242 | 215.5 | yes | KEEP-CURRENT |
| A2-v2-r3f/drei | @react-three/drei 10.7.9 | MIT | pass / pass / pass / pass | - | - | - | 4 | 1 | 111.9 | yes | ADOPT-FOR cherry-pick (port without React) SoftShadows and MeshReflec... |
| A2-v2-r3f/react-postprocessing | @react-three/postprocessing 3.1.2 | MIT | pass / pass / pass / pass | - | - | - | 4 | 9 | 0.7 | yes | REJECT |
| A3-P1-bake | @dimforge/rapier3d-compat 0.21.0 | Apache-2.0 | pass / pass / pass / pass | - | - | 501.3 | 4 | 251 | 15 | no | ADOPT-FOR multi-body physical motion (scatter, pile, topple, drop ont... |
| A3-P2 | @react-three/rapier 2.2.0 | MIT | pass / FAIL / pass / - | 13.6 | - | 79.5 | 2 | 401 | 114 | yes | REJECT |
| A3-P2b | @react-three/rapier 2.2.0 | MIT | pass / pass / pass / - | - | - | 83.6 | 3 | 401 | 114 | yes | REJECT |
| A3-P2-default60 | @react-three/rapier 2.2.0 | MIT | pass / FAIL / pass / - | 13.9 | - | 84.3 | 1 | 401 | 114 | yes | REJECT |

## 3. A1: the post chain on the real set

### 3.1 What was built

- `kit-copy/` is a self-contained copy of the kit plus The Ledger's stage (`timelines/ledger.js`, `record-prop.js`; the stage symlinks became real files). The original kit is untouched (checked with `find -newer`). `set-FT.html` is variant A0 unchanged; `make-pages.py` generates `set-A0l.html` (three 0.160.0 from local node_modules: pixel-identical to the jsDelivr copy, PSNR inf on all 5 frames), `set-A1.html` (pmndrs 6.36.7), `set-A2.html` (three addons), `set-A3.html` / `set-A3c.html` (three 0.186.1, plain / +1.073 exposure), `set-A1b.html` (three 0.186.1 + pmndrs 6.39.5) and `set-A4.html` (kit chain + pmndrs tail). Each differs only in its import map, its studio module and one line `window.__seek = ...`. Aliased installs (`npm i --save-exact --legacy-peer-deps three-160@npm:three@0.160.0 three-186@npm:three@0.186.1 pp-636@npm:postprocessing@6.36.7 pp-639@npm:postprocessing@6.39.5`; peers skipped on purpose, otherwise pmndrs pulls a third three).
- The A0 copy reproduces the shipped plate: frames 150/305/330 of `the-ledger/plates/ledger-tall.mp4` vs my A0 stills are 40.3 / 39.9 / 40.0 dB (x264 crf 12 loss only).
- `kit/core-pp.js` + `kit/pp-chain.js` (A1): the kit's scene render, jitter, 4-subframe accumulation, grain/dither/type pass and the whole `renderAt/renderFrame/captureFrame` contract are kept; only the depth pass, bloom-source pass, DoF, 6-level bloom and comp are replaced by an `EffectComposer` (MSAA 4, HalfFloat) with `DepthOfFieldEffect`, `SelectiveBloomEffect` (the meshes carrying `userData.bloomMat`), a 12-line custom grade effect (white balance x exposure + the kit's shoulder: pmndrs has no WB), `VignetteEffect` and optionally `ToneMappingEffect`, `SMAAEffect`, `LUT3DEffect`, `NoiseEffect`.
- `kit/core-addons.js` + `kit/addons-chain.js` (A2): `EffectComposer` + `RenderPass` + `BokehPass` + `ShaderPass` (the kit's comp shader) + `OutputPass` (+ `SMAAPass`), `UnrealBloomPass` on the kit's own bloom-source buffer (three's selective-bloom example does the same swap).
- `kit/core-tail.js` (A4): the kit's `core.js` plus one pmndrs `EffectPass` run by hand on `compRT`.
- Key frames (full size 1080x1920, production path = `renderFrame`, 4/8/16 subframes): `band` f305 (copper band glow + ring flare), `ledger` f330 (date page + 2 rows), `wide` f150 (both figures + card), `macroL` f330 and `macroB` f305 (a macro camera I added in `timelines/ledger-macro.js`: page text / band + LED), `hop` f251 (fast action, 8 subframes). Stills: `qa/final/<variant>/*.png`.

### 3.2 Parameter mapping (how the kit's grade was reproduced)

| kit (`core.js`) | pmndrs 6.36.7 (`pp-chain.js`) | three r160 addons (`addons-chain.js`) |
|---|---|---|
| DoF: CoC = K*abs(z-f)/z px, max dofMax px, 36-tap depth-aware gather | `DepthOfFieldEffect`: normalised focusDistance = (f-near)/(far-near), focusRange = 1.25*(dofMax/K)*f/(far-near), bokehScale = 0.85*dofMax*PX (calibrated on the tall camera against the kit: PSNR peak at these values) | `BokehPass`: focus = f, aperture = K/(0.4*W*f), maxblur = dofMax*PX/(0.4*W) |
| bloom: bloomMat render, 6-level dual filter x0.85, added only outside the emitter | `SelectiveBloomEffect` levels 6, radius 0.7, intensity 1.0, SCREEN, decals left out of the selection (calibrated on the halo profile through the band: RMS 6.4 vs the kit) | `UnrealBloomPass` strength 0.2, radius 0.3 on the kit's bloom source + the kit's emitter mask (halo RMS 6.05) |
| WB x exposure, shoulder (knee 0.9) | custom `KitGradeEffect` | the kit's comp shader as `ShaderPass` |
| vignette 0.10*smoothstep(0.35, 1.414, abs(2uv-1)) | `VignetteEffect(offset 0.2478, darkness 0.8836)` at opacity 0.10 (same ramp) | inside the comp shader |
| 4 jittered subframes, 180-degree shutter, grain, sRGB encode | unchanged (kit) | unchanged (kit), `renderer.outputColorSpace` set linear so `OutputPass` does not double-encode |

### 3.3 Findings (evidence: `qa/contact-*.jpg`, `qa/crops/`, `qa/probe/`)

1. **Look parity needs custom work in pmndrs.** The idiomatic A1 chain reaches 40.6-41.9 dB (normal camera) but the band core drifts from the kit's #faa44c to #edb458 (bloom is added on the emitter itself; the kit masks it out with `1 - inside`), the LED glow almost disappears, and the glow decals (desk spill, mint ring) cannot be put into a colour-masked selective bloom without blooming the white desk under them (`bsel=decal` run kept in `qa/cal/`). A 10-line `EmitterRestoreEffect` (A1-restore) brings the band core back to #f9a44c and the halo to within 6.6 RMS of the kit (`qa/probe/restore-compare.png`). The other option the brief names, a non-selective luminance-threshold `BloomEffect` (`bloom=lum`), cannot separate the band from the white desk and paper: at threshold 0.8 the desk and the ledger page bloom into a milky haze, at 1.0 the band no longer blooms (`qa/probe/lum/sheet.jpg`).
2. **pmndrs DoF softens thin dark detail.** Macro page text: 1st-percentile text luminance kit 48.0, pmndrs 58.7, pmndrs without DoF 45.1, three BokehPass 50.1 (higher = lighter/thinner text); the kit keeps in-focus detail crisp because it skips blur below 0.4 px. The calibration does not carry to another camera: on the 1920x1080 frame the whole image is 36.6 dB vs the kit (tall frames 40.6-41.9), and the "11:42 PM" card text softens (1st-percentile luminance kit 50.2, pmndrs 61.3, three BokehPass 58.3, kit + pmndrs tail 50.7; 30.4 dB in the text region for pmndrs); `bokeh=0.6` restores it (49.2) but is then a per-camera number, whereas the kit takes one K per camera and pmndrs ramps a smoothstep over a world-unit range (`qa/contact-wide-aspect.jpg`, `qa/cal/wide_bokeh_*`).
3. **three's BokehPass blurs near-field silhouettes** (soft halo around the heads at the wide frame, `qa/contact-crop-edges2.jpg`), re-renders the scene for depth (about 55 % more time) and its UnrealBloom LED glow is weaker; the band core and halo are right because the kit's comp is reused.
4. **SMAA is not a substitute for the 4-subframe supersampling, but edges are not the reason.** The SMAA variants (one unjittered sample, MSAA 0 as pmndrs advises) are 3.2-3.5x cheaper (14 ms vs 44 ms) and stair-step on the head and desk edges (`qa/contact-crop-edges.jpg`, `macroB`); pmndrs SMAA HIGH leaves fewer stair-steps than three's SMAAPass. Keeping MSAA 4 under SMAA (`aa=smaa&msaa=4`, one sample, `qa/probe/smaa-msaa4-desk-edge.png`) makes the edges as clean as the kit's. What the jitter uniquely provides is the soft key-light shadow (the kit indexes four light offsets by subframe slot, so a single sample casts a hard, dark shadow: `qa/probe/shadow-compare.png`) and the 180-degree shutter blur on fast frames (`qa/probe/hop-compare.png`: the register's moving top edge is blurred in A0/A1/A2 and razor sharp in the SMAA variants). PSNR vs the kit is about 29 dB either way, because of the shadow and lighting difference. The SMAA variants used key-light slot 0, not a centred light; centring needs a kit patch and was not tried.
5. **Native tone mapping fights the kit's grade.** `ToneMappingEffect` AgX gives a flat grey cast (19 dB vs the kit, the palette's design hexes are lost); `LUT3DEffect` works (generated 17^3 .cube) and is the useful part (A1-lut, A4).
6. **Seek-safety.** Every variant passes G1/G2 and G3 (noise-only 1-LSB aside) in both `__seek` modes. The time-driven effect is safe only when driven from t: `NoiseEffect` (`rand(uv*(1+time))`) passes with `EffectPass.fullscreenMaterial.time = t` and `composer.render(0)`; with the library default (wall-clock deltaTime accumulating into `time`) it fails all three gates (`A1-noise-wallclock-at/fr`: G1, G2, G3 all false, at 50.6 and 54.3 dB, i.e. below the 60 dB noise floor: a real state error).
7. **three 0.186.1** (A3): one console.error per page load (`shadow chunk patch failed`: r186's `shadowmap_pars_fragment` is already a Vogel-disk PCF with interleaved-gradient noise and hardware compare), lit surfaces about 7 % darker (wall 227.7 -> 220.3, desk front 142.5 -> 134.2; a +7.3 % exposure trim gives 38.3 dB), `build/three.module.js` imports a second file `three.core.js` (r171+; 2.0 MB total vs 1.2 MB) and the three-addons paths still resolve. pmndrs 6.39.5 on r186 (A1b) rendered a fully blurred frame until the DoF focus was re-mapped: 6.39 changed `focusDistance` / `focusRange` from normalised depth to world units / euclidean distance under the same property names; afterwards it behaves like A1 on r186 (32 dB vs A0, the r186 drift).

### 3.4 Cost (production frame, best of 3 interleaved rounds, GPU shared with other lanes)

| variant | typical calm frame | vs A0 | hop frame (f251, 8 subframes) | one sample |
|---|---|---|---|---|
| A0 kit (reference) | 44.5 ms | 1.00x | 86.5 ms | 12.8 ms |
| A1 pmndrs chain | 53.6 ms | 1.20x | 117.4 ms | 15.2 ms |
| A1 + emitter restore | 61.1 ms | 1.37x | 119.5 ms | 16.9 ms |
| A1 + SMAA, 1 sample | 14.0 ms | 0.31x | 14.2 ms | 13.1 ms |
| A2 three addons | 68.9 ms | 1.55x | 132.7 ms | 19.0 ms |
| A2 + SMAA, 1 sample | 12.6 ms | 0.28x | 10.0 ms | 12.3 ms |
| A3 three 0.186.1 | 42.0 ms | 0.94x | 78.3 ms | 12.6 ms |
| A4 kit + pmndrs tail (LUT) | 47.6 ms | 1.07x | 97.8 ms | 13.3 ms |

At A0's cost a 540-frame plate takes about 24 s on a quiet GPU. Caveat: other lanes share the GPU, and its load moved while I measured (a later 4-round run of A0/A1/A1-restore/A4 ran at about 1.7x slower absolute times, with A1 at 1.28-1.36x and A4 at 1.03-1.12x of A0 in the same run). The A1-restore row's best round was a contended one: in that later run A1-restore cost A1 + 0-3 %, so read it as A1's cost (the restore effect is one extra texture fetch).

### 3.5 Gates and the production path

- seekcheck over all 18 s of The Ledger (`--frames 540 --samples 16 --cold 4`, query `norun=1`), both modes: `-at` = `__seek` wraps `renderAt`, `-fr` = wraps `renderFrame` (the production path). Reports: `qa/seekcheck/<variant>-<mode>/report.json`.
- G4: `render.mjs` 60-frame clip (frames 290-349) for A0, A1, A2, A4 and A3c, no console output except A3c's shadow-patch error: `qa/g4/<variant>/clip.mp4`; A0/A1/A2/A4 `render.mjs --qa`: same-frame-twice, renderAt wrap, t vs t+3 loops, frame 0 vs frame N all pass; the seam check fails on every variant because The Ledger is a one-way film, not a loop (539 -> 0 mean diff 18.75 vs 1.7 for neighbours).
- A decoded frame of the A0 clip looks as expected (`qa/g4/A0/mp4-f305-half.png`); the winner of the comparison is A0 itself, which is the production path already.

## 4. A2: the React layer (summary of `react/RESULTS-A2.md`)

- Same shot twice (the box on the desk, 4 s orbit, copper band pulse, DoF + SelectiveBloom + WB + NEUTRAL tone map + vignette), kit builders copied unmodified (sha256 equal): V1 vanilla three + `postprocessing@6.36.7` (import map, no bundler) and V2 R3F 9.8.1 + Drei 10.7.9 + `@react-three/postprocessing@3.1.2` + React 19.3.0 (Vite 8.3.1 build). Lights proven identical (`evidence/lights-parity.txt`, max difference 0.0); PSNR V1 vs V2 103.8-106.5 dB.
- Both pass G1-G4; GPU time about 11 ms/frame in both; V2 costs 215 MB installed vs 35 MB, a bundler (React 19 ships CJS only), 130 vs 53 variant code lines (the R3F figure includes the 43-line `SeekCanvas`), 0.2-0.4 s slower boot. Seekable R3F needs `frameloop="never"`, `advance(0)` (never `advance(t)`: delta = t minus the previous seek), a store-driven `t`, `dpr={1}`, a composer-built gate before `__ready`, explicit sizes, `preserveDrawingBuffer`.
- Drei review (20 helper rows, lab-measured where it matters, `react/evidence/lab/summary.md`): USE (as vanilla ports) SoftShadows (PCSS) and MeshReflectorMaterial (the material class is React-free); ALREADY-HAVE ContactShadows, Environment, Lightformer, RoundedBox, Text3D, useGLTF/useTexture, Bounds/Center, BakeShadows; SKIP Float (G3 17.9 dB), Sparkles (G3 36.6 dB), AccumulativeShadows (G1-G3 fail), MeshTransmissionMaterial (G3 98.7 dB), Trail, MeshWobble, Html, Stage, CameraControls. Many Drei helpers use `Math.random` or the clock at mount.
- Wrapper traps found: `<SelectiveBloom>` hard-codes ADD, `<DepthOfField>` sets `MULTIPLY_RGB_SET_ALPHA`, `<EffectComposer>` defaults to MSAA 8 and forces NoToneMapping, boolean `shadows` gives PCFSoft, not the kit's PCF + patched chunk; `ToneMappingMode.NEUTRAL` does not link on three r160 (function exists from r162; the sub-worker's 21-line chunk patch or AgX); DoF placed after bloom erases the bloom.
- Verdict rows: A2-v1-vanilla ADOPT-FOR single-sample plates and quick previews (hero plates keep the kit chain; note my A1 finding 4: a single sample loses the soft shadow and shutter blur on the real set), A2-v2-r3f KEEP-CURRENT, Drei ADOPT-FOR niche (two ports), @react-three/postprocessing REJECT.

## 5. A3: physics (summary of `physics/RESULTS-A3.md`)

- Scene: 24 paper cards (0.46 x 0.008 x 0.30) fall and scatter, the product box drops in at t = 2.0 s and bounces; 4 s, 30 fps, step 1/60 (6 engine substeps), seed 20261013, one `scene-spec.json` read by both variants.
- **P1 baked** (`@dimforge/rapier3d-compat@0.21.0`, Apache-2.0): `bake.mjs` writes a 387 KB table (97 KB gzipped) in about 0.13 s warm (I re-baked twice in separate Node 25 processes: 0.25 s each cold incl. 43 ms WASM init, identical sha256 `3a784013...`, equal to the committed table); one sha256 across 8 CLI bakes on Node 21/22/25 and 3 bakes in Chrome 154 (their evidence); `table-player.js` (4.7 KB, no dependencies) is a pure function of t with lerp/slerp; on the real kit page G1/G2/G3/G4 pass with no mismatching pixel, also in the production path; render 0.41 s/frame. The cards need 6 engine substeps per sample and a mild box/card mass ratio (CCD flags do nothing here); card/box penetration 0.009 vs 0.077-0.13 for a naive one-step bake.
- **P2 live R3F + Rapier** (`@react-three/rapier@2.2.0`): naive `__seek` G1 pass, **G2 fail (13.6 dB)**, G3 pass only by accident; the `<Physics>` accumulator runs one engine step off nominal; at its default 1/60 the scene is destroyed at the box impact. The package pins rapier3d-compat **0.19.2**, on which the box topples (57.8 deg) instead of landing flat (0.8 deg on 0.21.0).
- **P2b seekable** (remount + replay, bit-identical, 116-121 ms cold seek): works, but 114 MB node_modules, 3.3 MB of JS and a bundler to duplicate what the 387 KB table does.
- Verdicts: A3-P1-bake ADOPT-FOR multi-body motion (scatter, pile, topple, drop onto things) baked at build time, keep springs for single-object moves; A3-P2 / P2-default60 / P2b REJECT.
- Extras: generic `bake.mjs` (cuboid, ball, capsule, cylinder, static colliders, late-born bodies), contact events to 37 kit sound cues (`cues-from-table.mjs`).

## 6. Adapter code (exact)

### 6.1 Any kit page: the seek hook the harness needs (3 lines) and the query

```js
// set-FT.html, just before runScene({ ... })
window.__seek = (t) => window.renderAt(t);   // one sample at t. Production path instead: window.renderFrame(Math.round(t * 30))
```
Run the harness with `norun=1` in the query (`--query "tl=<id>&aspect=tall&norun=1"`): the page otherwise repaints its own preview loop between `__seek` and the screenshot and G1-G3 fail at 8-23 dB (seen on A3-P1, `physics/evidence/p1-failed-loop/`). `render.mjs` adds `t=0&norun=1` itself.

### 6.2 pmndrs tail stage (A4), the whole change to `kit/core.js` (full diff: `adapters/core-tail.diff`)

```js
import { EffectPass, LUT3DEffect, LUTCubeLoader } from 'postprocessing';      // import map: "postprocessing": ".../postprocessing@6.36.7/build/index.js"
// once, after PM = postMaterials(...) and camera exist (a colourist's .cube, 17-33^3):
const lut = new LUTCubeLoader().parse(await (await fetch('./grades/ledger.cube')).text());
const tail = new EffectPass(camera, new LUT3DEffect(lut, { tetrahedralInterpolation: true }));
tail.initialize(renderer, false, THREE.HalfFloatType); tail.setSize(W, H);
const tailRT = new THREE.WebGLRenderTarget(W, H, rtOpts);
// end of drawSample(), after runPass(PM.comp, target):
tail.fullscreenMaterial.time = t; tail.render(renderer, target, tailRT, 0, false);   // 0 = never a clock; time-based effects are driven from t
// accumulate(): accMat.uniforms.tSrc.value = tailRT.texture;   (was compRT.texture)
```
With an identity effect (`ToneMappingMode.LINEAR`) the output is bit-identical to the kit (`qa/final/A4-id`, PSNR inf).

### 6.3 Baked physics on a kit timeline: `physics/kit-p1/timelines/drop-min.js` verbatim (20 lines; build step, `bake.mjs` and `table-player.js` in `physics/RESULTS-A3.md`)

```js
/* DROP-MIN: the smallest kit timeline that plays a baked physics table (this is the adapter quoted in RESULTS-A3.md, lines marked ADAPTER). Page: ../set-FT.html?tl=drop-min&aspect=tall */
import { createTablePlayer } from './table-player.js';                                              // ADAPTER 1: the 63-line player (copied next to the table)
import { springKick } from '../kit/util.js';

const TABLE = await (await fetch(new URL('./drop.table.json', import.meta.url))).json();            // ADAPTER 2: top-level await, so set-FT.html's import waits for the table
const P = createTablePlayer(TABLE);                                                                  // ADAPTER 3

export default {
  id: 'drop-min', seconds: 4,
  layout: { span: [-2.4, 2.4] },
  box: { moves: [{ do: 'absent', t: -1 }] },                                                         // the kit's own box path stays out of the way
  camera: [{ t: 0, shot: 'wide', fov: 18, elev: 28, az: -10, dist: 17.5, target: [0, 1.2, 0], screen: [540, 1010], dofK: 20 }],
  dip: (t) => -0.02 * springKick(t - P.firstContact('box'), 0.35, 2.2),                              // ADAPTER 4 (optional): the desk bobs on the first box contact
  fast: (n) => P.motion(n / 30) > 1.2,                                                               // ADAPTER 5 (optional): 8 subframes while anything moves fast
  onBuild({ ctx, st, THREE, FTP }) {                                                                 // ADAPTER 6: one mesh per card on the desk group; the last body is the kit's real box
    st.bodies = TABLE.meta.bodies.slice(0, -1).map((b) => ctx.add(st.desk.deskG, new THREE.Mesh(new THREE.BoxGeometry(...b.size), FTP.paperM('#fbfaf7')), { cast: true, recv: true }));
    st.bodies.push(st.box.group);                                                                    // the table's box origin is its base centre = the kit mesh pivot: no conversion
  },
  onUpdate(t, n, { st }) { P.apply(t, st.bodies); },                                                 // ADAPTER 7: runs after the kit's own box pose, so it overrides it
};
```

### 6.4 Seekable R3F (only if a React page ever has to be scrubbed): `react/v2-r3f/app/SeekCanvas.jsx` (43 lines; the store + `advance(0)` pattern is quoted in `react/RESULTS-A2.md` section 4).

## 7. Gotchas

pmndrs `postprocessing` 6.36.7
1. `composer.render()` with no argument advances a wall-clock Timer, and `EffectPass.render` adds `deltaTime` to the `time` uniform: pass `0` and set `fullscreenMaterial.time = t` (negative control above).
2. Camera near/far are copied only at pass creation or `composer.setMainCamera(camera)`; the kit changes near/far per camera key, so call `setMainCamera` per sample.
3. `DepthOfFieldEffect.worldFocusRange` subtracts `near` from a range (viewZToOrthographicDepth): a range below `near` (3 here) collapses to a hard step and blurs the whole frame. Use the normalised `focusRange`. In 6.39 the same property names mean world units. Also, DoF before bloom in the pass (DoF rebuilds colour from its own buffers).
4. `SelectiveBloomEffect` masks by depth equality (DEPTH_EPSILON 1e-4 of normalised depth, about 0.03 world units here) on the final colour: it blooms whatever is under a selected plane (white desk under the glow decals), and it has no emitter exclusion.
5. `SMAAEffect` lookup images decode asynchronously: await its `load` event before `__ready` (three's `SMAAPass` has the same trap with `Image.onload`).
6. `EffectComposer` sets `renderer.autoClear = false`; the kit toggles autoClear itself so it still works, but code relying on an implicit clear breaks.
7. `ToneMappingMode.NEUTRAL` does not link on three r160 (function from r162); the adaptive tone-mapping modes keep luminance history across frames (not seek-safe; source reading, not run).
8. The DoF fill pass thins thin dark detail; parameters do not transfer between cameras.
9. `npm i` pulls a third three through the peer range unless `--legacy-peer-deps`.

three r160 addons
1. `EffectComposer.render()` with no argument reads a Clock: pass `0`. `OutputPass` encodes sRGB when the renderer's output colour space is sRGB: keep it linear when the kit's `fin` pass encodes. `BokehPass` re-renders the scene with a depth material (decals included: wrap its render to hide them), sets a white clear colour and `autoClear = false`. `UnrealBloomPass` adds into its read buffer in place (keep the emitter source in a separate target for the mask).

Kit
1. `set-FT.html`'s `camera()` writes the DoF strength through `ctx.dbg.PM.dof.uniforms.uK.value`: any replacement chain must provide that shim or DoF strength is lost (NaN).
2. The page starts a `requestAnimationFrame` loop unless `norun`/`t` is in the URL. `render.mjs` serves only the page's folder (copy helpers next to the page).
3. Soft shadows, motion blur and the AA all come from the 4-slot jitter; any single-sample path loses the first two.
4. three 0.186: retire `patchShadows()` (r186 has native Vogel PCF) and re-grade (+7.3 % exposure) before shipping anything on it.
5. A harness query with a parameter named `h` collides with seekcheck's own `h=`: a blank scene passes G1-G3 (react sub-worker); always look at a still.

## 8. What could not be tested, and why

- Full 18 s renders per variant (G4 is a 2 s clip; seekcheck samples 16 frames across all 540); HyperFrames (3D plates use `render.mjs`; lane B covers HyperFrames).
- The `aspect=wide` frame only at frames 305 and 330 for A0/A1/A1-restore/A2/A4 (`qa/wide/`).
- GPU memory; ms/frame is noisy because other lanes share the GPU (interleaved rounds, best of 3).
- Root cause of the r186 7 % darkening (not isolated; candidates are the environment/PMREM or light-unit changes); SMAA with a centred light; adaptive tone mapping and other history-dependent pmndrs effects (read from source, not run).
- The sub-workers' own lists: `react/RESULTS-A2.md` section 8 (no-bundler R3F through a CDN, `Environment files|preset`, clock-driven helpers under `advance(t)`), `physics/RESULTS-A3.md` "Not tested" (other engines/CPUs, `rapier3d-deterministic-compat`, soft bodies, large scenes).

## 9. Not run (outside the test rules)
1. Adding `postprocessing@6.36.7` (Zlib, 0.6 MB, import-map entry or vendored copy) as an optional dependency of the kit for the tail stage.
2. Adding the 3-line `window.__seek` hook to `set-FT.html` (I could not edit the kit) and documenting `norun=1`.
3. Physics: where `physics/` lives in the kit and `@dimforge/rapier3d-compat@0.21.0` as a build-time dev dependency (15 MB); three small kit changes (await `TL.onBuild`, let `TL.fast` return 16 subframes, norun docs/default); `@dimforge/rapier3d-deterministic-compat@0.21.0` to check cross-machine bit-identity (outside the 20 repos).
4. A CDN ESM conversion of React (jsDelivr `+esm` / esm.sh) if the no-bundler R3F question is to be settled by test; permission to hit `raw.githack.com` for Drei environment presets.


## 10. File index (all under `a-3d/`)

- `RESULTS.md`, `results.json`, `adapters/core-tail.diff`, `sheets/`:
  - `00-overview.jpg` (5 key frames x A0, A1, A1+restore, A2, A1+SMAA, A4: start here), `frame-<band|ledger|wide|macroL|macroB>.jpg` (full frames, 11 variants each).
  - `crop-<band|text|edges|edges2|macroL|macroB>.jpg` (100 % crops: copper band glow, ledger text, edges, macro text, macro band), `wide-aspect.jpg` (1920x1080), `looks-agx-lut.jpg` (native tone map / LUT looks).
  - `probe-*.png|jpg` (band emitter restore, soft shadow vs single sample, hop motion blur, SMAA + MSAA 4 desk edge, luminance-threshold bloom).
  - `A2-react-v1-vs-v2.jpg` and `A3-physics-P1-P2-P2b.jpg` (the sub-workers' contact sheets).
- `kit-copy/` code: `set-A*.html` (generated by `make-pages.py`), `kit/pp-chain.js`, `kit/core-pp.js`, `kit/addons-chain.js`, `kit/core-addons.js`, `kit/core-tail.js`, `timelines/ledger-macro.js`.
- `qa/final/<variant>/` full-size stills, `qa/crops/`, `qa/contact-*.jpg`, `qa/probe/` (restore / shadow / hop comparisons), `qa/cal/` (calibration sweeps), `qa/seekcheck/`, `qa/g4/`, `qa/bench.json`, `qa/psnr.json`, `qa/summary.json`.
- `tools/`: `gpu-run.py` (lane GPU lock + disk guard), `render-contract.js` (render.mjs page contract for any seekable page), `stills.sh`, `run-variants.sh`, `run-gates.sh` / `run-gates2.sh`, `run-g4.sh`, `run-hop.sh`, `run-wide.sh`, `bench.mjs` + `bench-summary.py`, `make-sheets.py`, `cmp.py`, `profile.py` (halo profile used for the bloom calibration), `eval.mjs` (in-page probes), `build-results.py` + `fill-results.py` + `RESULTS.template.md` (this file and `results.json` are generated from the measured numbers).
- Logs of the queued runs: `logs/`.
- `react/` (A2 sub-worker: `RESULTS-A2.md`, `results-A2.json`, `v1-vanilla/`, `v2-r3f/`, `evidence/`) and `physics/` (A3 sub-worker: `RESULTS-A3.md`, `results-A3.json`, `bake.mjs`, `table-player.js`, `kit-p1/`, `p2-r3f-rapier/`, `evidence/`).
