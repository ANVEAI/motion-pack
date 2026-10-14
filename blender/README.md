# motion-pack / blender

This module renders photoreal plates in Blender 5.2: a procedural product device in a dark photo studio, macro light sweeps, an exploded view, a 3D chrome title, three seamless abstract loops, and (round 3, 14 Oct 2026) a pipeline-reveal set on a 21-part procedural model: render passes, knolling, a cloud-sea flight, plus stylised low-poly diorama loops. Round 4/5 (14 Oct 2026) adds one practical-metaphor plate: a tangle of cables feeding warm bulbs, where pulling one cable puts the bulbs out in sequence (or lights them as it untangles).

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
bash blender/tests/cable_tangle.sh                            # cableTangle: bulb timing measured in the PNGs against the plan, schedule, CPU hash check (~3 min at 480p)
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
        [--denoise-gpu] [--no-denoise] [--device gpu|cpu] [--list]
```

- Frames are keyed from -1 to N, so motion blur is right at both ends and frame N is the loop seam.
- `--frames` renders a subset, and existing frames are skipped unless you pass `--force`. A partial render writes no MP4.
- **Samples.** EEVEE defaults to 32 TAA samples. Cycles defaults to 1024 adaptive samples at threshold 0.006, with OIDN on the CPU.
- **Device.** `--device cpu` renders Cycles on the CPU: slower (cableTangle at 480p on a loaded M3 Pro: about 3.8 s/f on the CPU at 16 samples, against about 1.8 s/f on the GPU at 24 samples), but the same PNG file hash in two separate processes (measured on cableTangle only; `DETERMINISM.md`). The default `gpu` is visually, not bit, identical.
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
| `blender/passReveal` | the kit model as wireframe -> x-ray -> clay -> full material, each step a soft left-to-right wipe from one keyed stage value; `pass=` wire, xray, clay or full holds one pass per plate (same camera, so four plates register for a wipe in HyperFrames) | no | 6 s | about 0.6-1.0 s/f at 480p, 8 samples (smoke only) |
| `blender/knolling` | the model separates, every part flies to an overhead flat-lay grid (laid flat, largest first, twins side by side) while the camera cranes to top-down; hold; reassembly in reverse | no | 6 s | about 0.35 s/f at 480p (smoke only) |
| `blender/cloudFlight` | sunset cloud sea (displaced cloud tops), Principled Volume haze, sun disc + halo, an additive anamorphic streak, chase camera on the flying, banking model with a spinning prop | no | 6 s | about 0.5-0.7 s/f at 480p (smoke only) |
| `blender/diorama` | low-poly vignette loop, `scene=` lighthouse, campfire or island: one prop, mood light, sky; the subject sits inside the inscribed circle (`fill`), so it masks cleanly to a disc for montage windows | yes | 6 s, 1080x1080 | about 0.3 s/f at 480x480; seam bit-exact |
| `blender/cableTangle` | a dark tabletop: a seeded tangle of bevelled cables feeding 2-9 warm filament bulbs on bakelite sockets (clear glass, so each light really lights the set). One red cable is pulled: `mode=off` slides it out of the knot and the bulbs go out in sequence (a 2-frame flicker, an orange afterglow); `mode=on` lifts and untangles it and they light. The change frames come from `schedule=f1,f2,...`, a `--beats` sidecar (each bulb on a hit) or `pull_start + lag + k * stagger`, in `order` ltr, rtl, out, in or seeded; they are keyed on whole frames and written to `render.json` `recipe_report` (`plan.change_frames`, and each bulb's screen position per frame in `bulb_px`) | no | 5 s | about 1.8 s/f at 480p, 24 samples, Cycles GPU (loaded machine; smoke and test only, 1080p not timed) |

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
| `kit.py` | The procedural "flyer": 21 primitive parts (fuselage, cowling, spinner, 3 blades, wings, ailerons, tailplanes, fin, rudder, canopy, struts, wheels, tail skid), each mesh axis-aligned on its own centre so rotation is pose and extents are size. Render-pass materials (`pass_group` = one keyed `stage` value and a world-X wipe; `pass_material`, `wire_material`, `add_wires`) and the knolling layout (`knolling_layout`, `flat_rotation`). Generic on purpose: no real aircraft, livery or markings. |
| `env.py` | Outdoor and stylised worlds: `sky_world` (gradient + sun disc/halo + Voronoi stars), `sun`, `point`, `haze_volume` + `eevee_volumes`, `cloud_sea` (two seeded noise displacements), `flare_card` + `face_card`, and the low-poly kit (`flat_mat`, `ico`, `frustum`). |
| `diorama.py` | The three vignettes; each returns its framing and an `anim(K, P)` on integer harmonics of the loop. |
| `ease.py` | The pack easing set (`enter`, `hero`, `exit`, `move`, `soft`, `cam`, `pop`, `lin`, `sine`, `expoOut`, `quint`, plus `glide`), ported bit for bit from `camera/ease.js`. |

## Determinism

`bash blender/tests/determinism.sh` renders the same frame in two separate Blender processes. It also renders it twice inside one process, with another frame rendered in between. Measured on Blender 5.2.2 on an M3 Pro (Metal); details in [`DETERMINISM.md`](DETERMINISM.md):

- **Bit-exact:** EEVEE turntable and voxel wave, and the liquid-chrome and voxel loop seams (voxel seam within 1/255 on one pixel).
- **EEVEE title:** not bit-exact, max 3/255 on 0.5 % of pixels, PSNR about 71 dB. It is not caused by the halo card, and the cause is not isolated.
- **Cycles GPU:** not bit-exact even without a denoiser (1 pixel, 111 dB). With CPU OIDN, 96 dB; with GPU OIDN, 71 dB.
- **Cycles CPU (`--device cpu`), cableTangle frame 48 at 854x480, 16 samples, OIDN on the CPU:** the same PNG file hash in two separate processes, and pixel-equal with the same hash inside one process (after a frame rendered in between). Cycles also writes its timings (`cycles.ViewLayer.*_time`) into every PNG, which made equal pixels hash differently; `run.py` strips those chunks after each render (`lib/util.py` `strip_png_timing`). Other recipes on the CPU are not measured.

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
- **cableTangle (round 4/5)** was rendered at 480p only (Cycles, 12-24 samples) and judged on stills and measurements; there is no 1080p timing and no showcase plate. `bash blender/tests/cable_tangle.sh` measured the first frame from which each bulb stays dimmer (`mode=off`) or brighter (`mode=on`) in the PNGs: all 5 bulbs in both modes matched the plan frames exactly. The set is a metaphor, not wiring advice: the cables are bevelled curves over a flat tabletop with a deterministic over-under lift (cables rest on each other; there is no contact or gravity simulation) and the knot is a seeded pile. The bulbs are generic (no brand, no real socket standard). The red feed's plug rides the cable end and is not articulated. Bulb light is a point light at the filament, so the soft glow on the table is the real light and not a bloom pass; add `layers` bloom in the finish if you want a halo.
- **Round-3 recipes (passReveal, knolling, cloudFlight, diorama)** were smoke-tested at 480p and judged on stills only; they are not in the 8-plate showcase and have no 1080p timing yet.
  - The x-ray pass is dithered coverage (EEVEE drops the emission of a fully transparent add-shader), so it needs the full 32 TAA samples to lose its grain.
  - The cloud sea is one 140 m tile with no wind; plates longer than ~10 s at the default speed fly off its far edge. The look reads stylised, not photographic.
  - The streak is an in-scene card, not a lens model; bloom and ghosts come from the pack's `layers` (`flareStreak`, `flareGhosts`).
  - The kit model is concept geometry. Label it as a concept render wherever a viewer could take it for a real product.
- **Open look notes** from the showcase review:
  - The exploded lid top reads as a pale slab.
  - In the 9:16 title, line 2 is darker than line 1 (its chrome mirrors the near floor).
  - The 2-fold symmetric `matte-copper` box makes a 360-degree turn read as two half-turns.
