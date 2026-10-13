# motion-pack / blender

This module renders photoreal plates in Blender 5.2: a procedural product device in a dark photo studio, macro light sweeps, an exploded view, a 3D chrome title, and three seamless abstract loops.

- **Headless and scripted.** It runs on `blender -b --factory-startup` with no GUI, no `.blend` assets and no downloads.
- **Deterministic.** Every moving value is a function of the frame number, and every random choice is seeded.
- **Source.** It generalises ANVE's launch-film Blender pipeline. The calibrated materials, the hero light rig and the render presets come from that pipeline, but no brand scene is copied.
- **Integration.** Plates drop into HyperFrames 0.8.142 compositions as a video layer or as an image sequence; see [`COMPOSITING.md`](COMPOSITING.md).

## Quick start

```bash
B=${BLENDER:-blender}                                         # any Blender 5.2.x (macOS: /Applications/Blender.app/Contents/MacOS/Blender)
$B -b --factory-startup -P blender/run.py -- --list           # recipes + params as JSON
$B -b --factory-startup -P blender/run.py -- --recipe blender/turntable --preset matte-copper \
   --size 1920x1080 --fps 30 --seconds 6 --engine eevee --out out/turntable --post lens
bash blender/tests/smoke.sh                                   # py_compile + 3 frames at 480p per recipe (~1 min)
bash blender/tests/determinism.sh                             # same frame twice, two processes + one process
bash blender/tests/showcase.sh showcase                       # the 8-plate showcase set (~45 min on an M3 Pro)
```

Renders are not committed. `blender/previews/` holds small JPEG previews of the 8-plate showcase (a middle frame and the contact sheet per plate, plus a 480p smoke still for `art.particleSwirl`); the catalog uses them.

Each render writes these files to `--out DIR`:

| file | what |
|---|---|
| `frames/f0000.png ...` | PNG master, RGBA with `--alpha` |
| `<slug>.mp4` | H.264 proxy (alpha flattened on black; `--post lens` bakes bloom and vignette into it) |
| `sheet.jpg` | contact sheet |
| `render.json` | Blender build, engine and device, every setting applied or missing, seed, params, per-frame render times, file hashes, and the determinism and loop checks |

## CLI (one entry point)

```
blender -b --factory-startup -P blender/run.py -- --recipe <id> [--preset NAME] --size WxH --fps 30 --seconds S
        --engine eevee|cycles [--samples N] --out DIR [--alpha] [--beats sidecar.json] [--param k=v ...]
        [--frames 0:90 | 0,45,89 | smoke] [--seed N] [--exposure EV] [--depth 8|16] [--motion-blur auto|on|off]
        [--post none|lens] [--crf 18] [--force] [--no-mp4] [--determinism F] [--loop-check] [--save-blend PATH]
        [--denoise-gpu] [--list]
```

- Frames are keyed from -1 to N, so motion blur is right at both ends and frame N is the loop seam.
- `--frames` renders a subset, and existing frames are skipped unless you pass `--force`. A partial render writes no MP4.
- **Samples.** EEVEE defaults to 32 TAA samples. Cycles defaults to 1024 adaptive samples at threshold 0.006, with OIDN on the CPU.
- **Motion blur.** `auto` turns it on for product recipes (180 degrees, centred) and off for the art loops: metaballs change topology, and the particle streaks already encode their speed.

## Recipes

| id | what | loop | default | measured: mean render s/frame, 1080p EEVEE, 32 samples, M3 Pro (shared machine) |
|---|---|---|---|---|
| `blender/turntable` | device spins 360 degrees under fixed photographer lights; band breathes | yes | 6 s | 2.64 s/f (16:9), 1.84 s/f (9:16) |
| `blender/macroSweep` | macro on the band corner; the feathered key travels 1.6 m (glint sweeps the chamfers); macro slide | no | 4 s | 2.28 s/f |
| `blender/explode` | sealed, then the cascade (lid first out), a breathing hold with a crane, the mirrored reassembly, then a band flare on the seal | no | 5 s | 3.35 s/f (exact booleans re-evaluate while parts move) |
| `blender/title3d` | per-letter extruded title (pack Manrope 800); flip-up stagger, chrome glint, violet halo, push; 9:16 splits at the hyphen | no | 4 s | 2.46 s/f (16:9), 2.20 s/f (9:16, first pass) |
| `blender/art.liquidChrome` | metaball cluster on integer-harmonic orbits, chrome in a camera-dark softbox dome | yes | 4 s | 0.49 s/f; seam bit-exact |
| `blender/art.voxelWave` | Geometry Nodes bars under travelling waves; height-coloured tops; `--beats` kicks pump and ring | yes | 4 s | 1.55 s/f; seam within 1/255 on one pixel |
| `blender/art.particleSwirl` | Geometry Nodes vortex of streaks on integer-revolution orbits | yes | 6 s | about 0.2 s/f at 480p (smoke only) |

Every recipe also lists its parameters, use and avoid lines in `manifest.json`; regenerate it with `python3 blender/tools/make_manifest.py`.

## Library (`lib/`)

| file | what |
|---|---|
| `device.py` + `device_parts.py` | Procedural device: rounded or chamfered box with weighted edge rounds (lid 3.5 mm, shells 2.8 mm, a hairline parting line), a recessed frosted band (hot core, left-to-right ignition, glint), feet, real-size ports cut by exact booleans (`rj45`, `usbc`, `dc`, `led`, `vent`), and internals for the explode (board, SoC, memory, M.2, VRM, MLCC rows, fin stack, heat pipes, fan, PSU). Presets: `matte-copper` (matte black, copper-amber band), `studio-white`, `graphite-teal` and `puck-violet`. API: `spec()`, `build()`, `set_band()`, `explode()`. |
| `studio.py` | Cyclorama sweep; near-black world; `world_reflection` (a procedural softbox dome that only reflections see: Light Path "Is Camera Ray"); feathered strip softboxes; the calibrated hero rig (key strip, high rim, accent rim, specular-free fill, floor-only pool), light-linked so the polished floor never mirrors the strips; the band-spill strips. |
| `materials.py` | `matte_coat` (albedo 0.020, roughness 0.40 to 0.46, IOR level 0.6, sub-mm peel only), `brushed_metal`, `glass`, `ceramic`, `plastic`, `chrome`, `anodised` (optional perforated field), `emissive_band`, `floor_polished` (reflection falls off around the footprint), `emission`, `pure_emission` (additive). |
| `camera.py` | Camera moves named as in `camera/cam3d.js`: `orbit`, `turntable`, `pushIn`, `crane`, `truck`, `macroSlide`, `dollyZoom`, `whip`, `rack`, `breathe`. Uses a 24 mm vertical sensor; `fit_dist` re-lays the frame out for 9:16 and 1:1 instead of cropping. |
| `render.py` | `eevee_plate` and `cycles_keyart` (calibrated settings; anything a build lacks is reported), PNG stamps off, AgX "Medium High Contrast". |
| `title.py` | Per-glyph extruded meshes laid out with Blender's own advances; cap and side materials split; static weight instance cut from the variable font with fontTools. |
| `art.py`, `gn.py`, `beats.py` | The three loops; a small Geometry Nodes builder (5.x modifier inputs are keyed through `properties.inputs.Socket_N.value`); the music-sidecar reader (kick envelope and rings, wrapped for loops, with a seam check). |
| `ease.py` | The pack easing set (`enter`, `hero`, `exit`, `move`, `soft`, `cam`, `pop`, `lin`, `sine`, `expoOut`, `quint`, plus `glide`), ported bit for bit from `camera/ease.js`. |

## Determinism

`bash blender/tests/determinism.sh` renders the same frame in two separate Blender processes. It also renders it twice inside one process, with another frame rendered in between. Measured on Blender 5.2.2 on an M3 Pro (Metal); details in [`DETERMINISM.md`](DETERMINISM.md):

- **Bit-exact:** EEVEE turntable and voxel wave, and the liquid-chrome and voxel loop seams (voxel seam within 1/255 on one pixel).
- **EEVEE title:** not bit-exact, max 3/255 on 0.5 % of pixels, PSNR about 71 dB. It is not caused by the halo card, and the cause is not isolated.
- **Cycles GPU:** not bit-exact even without a denoiser (1 pixel, 111 dB). With CPU OIDN, 96 dB; with GPU OIDN, 71 dB.

Three rules make the renders repeatable:

- PNG metadata stamps are turned off, because Blender writes Date, Time and RenderTime into PNGs and identical pixels would otherwise hash differently.
- Cycles uses a fixed seed with no animated seed and no time limit.
- OIDN runs on the CPU by default; `--denoise-gpu` is faster but not bit-exact.

## Licence

- The scripts (`run.py`, `lib/`, `recipes/`, `tools/`, `tests/`) are MIT, which is GPL-compatible (see `LICENSE`).
- Renders are our media and ship as CC0 1.0 in the pack.
- Fonts are the pack's OFL fonts. A weight instance is cut locally at run time and never redistributed.

## Honest limits

- **Material calibration.** EEVEE plates are the primary path. The Cycles path is smoke-tested at 480p, and its light energies are the EEVEE-calibrated ones, with no separate Cycles calibration pass. Expect the Cycles key art to need an exposure trim.
- **Explode internals.** They are concept geometry: plausible, not a real bill of materials. Label any hardware that is not real as a "planned configuration".
- **Alpha.** EEVEE has no shadow catcher, so `--alpha` in EEVEE drops the floor reflection and shadow. Use Cycles for alpha with shadows.
- **Metaballs.** The liquid-chrome polygonisation changes topology every frame, so it gets no motion blur.
- **Particle swirl.** It was smoke-tested only and is not part of the showcase.
- **Image-sequence path.** The canvas snippet in `COMPOSITING.md` has not been run inside a HyperFrames render.
- **Open look notes** from the showcase review:
  - The exploded lid top reads as a pale slab.
  - In the 9:16 title, line 2 is darker than line 1 (its chrome mirrors the near floor).
  - The 2-fold symmetric `matte-copper` box makes a 360-degree turn read as two half-turns.
