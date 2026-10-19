# LANE_NOTES: xp-hardware (lane 2, 16 Oct 2026)

Branch `xp-hardware`, from `main` bbd7da9 (v0.3.0).

## What this lane adds

| area | new files | ids |
|---|---|---|
| templates | `templates/hardware-reveal/`, `templates/hardware-teaser/`, `templates/spec-sheet/` (config.mjs + buildPlan + PROJECT_MAP + make.mjs + plate.html + out/plan.json + out/plan-tall.json), shared `templates/_hw/` (hwplan.mjs pure helpers, makehw.mjs pipeline + page writer, hw.test.mjs) | `templates/hardware-reveal`, `templates/hardware-teaser`, `templates/spec-sheet` |
| three.js props | `objects/lib/hardware.js` (enclosure, vent grille, ports, cable, the assembled node), `objects/lib/hwboard.js` (PCB, chip + die, heatsink, fan, GPU-like card), `objects/lib/xray.js`, `objects/lib/studio-hw.js` (dark studio, rim / top / sweep / edge rig), `objects/lib/hwmedia.js` (your GLB / glTF / OBJ, a photo as a 2.5D plate), `objects/lib/hwdata.js` (pure layout + anchors + die table), `objects/lib/explode.js` (pure exploded-view choreographer), `objects/lib/hwshots.js` (pure shot director), `objects/lib/hwplate.js` (the plate page), `objects/kit/project.js` (pure kit camera projection), `objects/hw-gallery.html` | `objects/enclosure`, `objects/vent-grille`, `objects/ports`, `objects/cable`, `objects/hw-node`, `objects/pcb`, `objects/chip-die`, `objects/heatsink`, `objects/fan`, `objects/gpu-card`, `objects/xray`, `objects/hw-studio`, `objects/model`, `objects/photo-25d` |
| overlay parts | `type/gfx/hw.js`, `type/tests/hw-sheet.mjs` | gfx `hw.specCallout`, `hw.dimensionLine`, `hw.chipDie`, `hw.edgeGlint`, `hw.dateCard`, `hw.specCard` |
| sound | `sfx/recipes/hardware.py` (15 sounds), `sfx/tests/test_hardware.py`, bundle `hardware_launch` | `sfx/hw/sub_hit`, `sub_pulse`, `chime_metal`, `chime_reveal`, `click_latch`, `click_detent`, `port_insert`, `fan_spinup`, `hum_loop`, `power_on`, `power_off`, `led_on`, `parts_separate`, `parts_seat`, `light_sweep` |
| music | `music/reveal.py` (the dark > reveal score composed per cut; NOT a library bed), `music/tests/test_reveal.py` | (generator, no library id) |
| blender | `blender/lib/model.py`, `blender/tests/export_device_glb.py`, `blender/tests/model.sh`; `--param model=/abs/your.glb` (+ `model_size`, `model_axis`, `model_yaw`) on `blender/turntable`, `blender/macroSweep`, `blender/explode` | (params on existing recipes) |

## Shared-file edits made on this branch (all additive) and what the merge must do

| file | edit | merge |
|---|---|---|
| `sfx/recipes/__init__.py` | `MODULES` gains `"hardware"` (last item) | union |
| `sfx/build_library.py` | `OVER_BED` gains `"hw": 4.0`; `BED_LOOPS` gains `"hw"` (the hum loop sits under the bed) | union |
| `sfx/qa.py` | `CENTROID` gains `"hw": (30, 9000)` | union |
| `sfx/bundles.py` | `BUNDLES["hardware_launch"] = {...}` appended after the dict (not inlined) | union, then `python3 sfx/bundles.py` |
| `sfx/manifest.json`, `sfx/bundles.json`, `sfx/qa_report.json` | regenerated | take ours, regenerate: `python3 sfx/build_library.py && python3 sfx/bundles.py && python3 sfx/qa.py` |
| `type/gfx/index.js` | import `{ HW_GFX, HW_CUES } from './hw.js'`; `...HW_GFX` at the end of `GFX`; `export { fmtNum, pointAt as hwPointAt, dieBlocks } from './hw.js'`; `GFX_SFX` gains `hw`, `hw.dateCard`, `hw.edgeGlint`, `hw.chipDie`; `ACTION_CUES` gains `...HW_CUES` | union (the union script of the merge procedure) |
| `layers/tests/make-manifests.mjs` | `GFX_FAM`: `id.startsWith('hw.') ? 'hw' :` as the first test | union, then `node layers/tests/make-manifests.mjs` |
| `type/manifest.json` | regenerated | take ours, regenerate |
| `objects/index.js` | 7 imports (HW, HWB, HWX, HWS, HWM, HWD, HWE), the `O` spread, 14 `REGISTRY` rows before `};` | union |
| `templates/_shared/audio.py` | plan `musicFile` (a bed composed for the cut, relative to the plan; wins over `plan.music`); cue `untilT` (seconds) -> mixer `until_frame` (a loop cue stops there) | union |
| `blender/recipes/_common.py`, `turntable.py`, `macro_sweep.py`, `explode.py` | `MODEL_PARAMS` + `device_from` model branch + `set_band` guard + `look_point` model branch; recipes spread `**C.MODEL_PARAMS` and call `C.set_band` | union; `python3 blender/tools/make_manifest.py --blender <Blender 5.2>` |
| `blender/manifest.json` | regenerated (60 added lines: the model params) | regenerate |
| `.gitignore` | 8 lines for the hardware templates' plates, sigs, media links and `tall/assets/` | union |

Needed but NOT made here (shared docs / registries; exact text below):

1. `.github/workflows/ci.yml`, after the proof-film step:
   ```yaml
      - name: "hardware templates (hardware-reveal, hardware-teaser, spec-sheet: plans pure, bar grid, drop on the reveal, tracks in frame, text in the safe rect, claims sourced, lint gate; explode, projection, die table; node, no browser)"
        run: node templates/_hw/hw.test.mjs
   ```
   (`sfx/tests/test_hardware.py` and `music/tests/test_reveal.py` already run inside the existing pytest step.)
2. `catalog/build.py` `TPL`, three rows (after the renders exist):
   `'hardware-reveal': ('AI-hardware / device launch film 46-70 s: dark tease, light sweep, reveal on the drop, exploded view, scale, ports, inside, specs, price, end', 'out/hardware-reveal.mp4', 'out/sheet.jpg')`,
   `'hardware-teaser': ('Device teaser 6-15 s: silhouette, one detail, the date', 'out/hardware-teaser.mp4', 'out/sheet.jpg')`,
   `'spec-sheet': ('Spec comparison 20-30 s: the device turns, a dark comparison table, one hero spec on the device', 'out/spec-sheet.mp4', 'out/sheet.jpg')`.
   Then `python3 catalog/build.py && python3 tools/count.py --write && python3 tools/count.py --check`.
3. `templates/README.md` genre table, three rows (text in "Template README rows" below).
4. `objects/README.md` components table, the 14 new rows (text in "Objects README rows").
5. `skills/motion-pack/SKILL.md`: the recipe below (RECIPE HW) and two "Reach for X" rows.
6. `skills/motion-pack/references/apis.md`: the API block below.

## RECIPE HW (for skills/motion-pack/SKILL.md, after RECIPE L)

### RECIPE HW: AI-hardware / device launch, templates `templates/hardware-reveal`, `templates/hardware-teaser`, `templates/spec-sheet`

1. **Pick the length.** A teaser (6 / 10 / 15 s) promises: silhouette, one detail, the date; the product is never whole. The launch film (46 / 56 / 70 s) pays off. The spec sheet (20 / 24 / 30 s) is for the numbers.
2. **Edit the CONFIG only:** `brand`, `product`, `text` (no digits in copy), `device` (the generic device: dimensions, chamfer, material anodised / matteBlack / glass, LED band colour, ports), `specs` (every number with its `source`; a missing or generic source stops the build), `price` (`value: null` for no price; a price always prints "indicative price · placeholder" or your note, and its source), `media.model.src` (YOUR GLB / glTF / OBJ) or `media.photo.src` (one still as a 2.5D plate).
3. **The music is composed to the cut:** `music/reveal.py` builds the dark > reveal score from the template's own sections, so the drop lands on the reveal bar at any length. Do not swap in a loop bed: the dark open and the drop are the shape.
4. **Sound:** bundle `hardware_launch`. ONE `sfx/hw/sub_hit` on the reveal frame; the `sfx/hw/hum_loop` under the dark open stops on it (`untilT`); `sfx/hw/light_sweep` peaks on the glint; a detent per callout and per spec row, never a chime per row.
5. **Build and render:** `node make.mjs` (renders the 3D plate on the GPU once per aspect, cached by hash), then `npx -y hyperframes@0.8.142 render . -o out/<id>.mp4 --crf 23 -w 1`; 9:16: `node make.mjs --set aspect=9:16`, then render from `tall/`.
6. **Check:** `node templates/_hw/hw.test.mjs`, `templates/_shared/sheet.py`, `eyes/look.py --plan out/plan.json`, `ears/listen.py --plan out/plan.json`.
7. **Photoreal hero:** `blender/turntable`, `blender/macroSweep`, `blender/explode` take `--param model=/abs/your.glb`; composite the plate.

"Reach for X" rows:

| you need | reach for | notes |
|---|---|---|
| a device / hardware hero in 3D: an enclosure with an LED band, an exploded view, a chip that opens, a GPU-like card, ports, a cable | `objects/hw-node` (or `objects/enclosure`, `objects/pcb`, `objects/chip-die`, `objects/heatsink`, `objects/fan`, `objects/gpu-card`, `objects/ports`, `objects/cable`) on `objects/hw-studio`; `objects/xray` for wireframe-to-solid; your own `objects/model` (GLB / OBJ) or `objects/photo-25d` | generic, no brand marks; `objects/lib/explode.js` choreographs any part list; `objects/lib/hwshots.js` gives the cameras and the device state per shot kind |
| a spec number ON a part of a 3D object, a dimension line on its edges, an edge glint, a die diagram, an availability / price card, a spec card | `hw.specCallout`, `hw.dimensionLine`, `hw.edgeGlint`, `hw.chipDie`, `hw.dateCard`, `hw.specCard` (`type/gfx/hw.js`) | pass a `track` (per-frame projection of a 3D anchor: `objects/lib/hwshots.js` `track()`), so the line stays on the part; every number prints its source |

## apis.md block

```
templates/_hw/hwplan.mjs   layoutBars(sections, bpm, fps) | calloutItem(D, A, {name|point, at, dur, spec, off}) | dimItem(D, A, {a, b, at, dur, value, unit, source}) | glintItem(D, A, {a, b, at, dur}) | visibleWindow(D, name, t0, t1)
objects/lib/hwshots.js     director(plan) -> { cameraAt(t), stateAt(t), px(anchor, t), pxPoint(local, t), track(anchor, t0, t1, fps, local) }; SHOT_KINDS silhouette sweep hero explode scale ports inside spin card end
objects/lib/explode.js     explodePlan(parts, {at, dur, stagger, overshoot, hold, back, breathe}) -> explodeAt(X, t) -> {id: {k, off, rot}}; explodeCues(X)
objects/kit/project.js     project(cam, point, W, H) -> [px, py, depth] (the kit rig as pure maths); poseApply(pose, local)
objects/lib/hwdata.js      nodeLayout(spec) -> {spec, ports, anchors, anchorPart, explode, dims (mm)}; anchorAt(L, name, offs); dieLayout({cores})
music/reveal.py            render_reveal(sections, fps, bpm, seed, tail_s) / CLI --sections --out score.wav (+ score.json markers, drops)
templates/_shared/audio.py plan.musicFile (a composed bed next to the plan) | cue.untilT (a loop cue stops there)
```

## Template README rows (for templates/README.md)

| genre | folder | engine | run | demo |
|---|---|---|---|---|
| AI-hardware / device launch film 46-70 s, 16:9 + 9:16 re-layout (dark cold open with an edge-light silhouette, a light sweep with an edge glint, the reveal on the music's drop, an exploded view with spec callouts on leader lines that track the parts, a scale reference on a desk, a ports tour, "inside": x-ray + chip lid + die, a spec card, an availability / price card labelled indicative, the end card; fictional "Acme Node", "render · demo specs" in frame) | `hardware-reveal/` | three.js plate + HyperFrames | `node make.mjs [--set aspect=9:16] [--set length=short\|full\|long]` then `npx -y hyperframes@0.8.142 render . -o out/hardware-reveal.mp4 --crf 23 -w 1` | see "Measured" below |
| Device teaser 6 / 10 / 15 s (silhouette, one detail, the date card) | `hardware-teaser/` | three.js plate + HyperFrames | same | see "Measured" |
| Spec comparison 20 / 24 / 30 s (the device turns, a dark `ui.dataTable` lands row by row, one hero spec on the device) | `spec-sheet/` | three.js plate + HyperFrames | same | see "Measured" |

## Objects README rows (for objects/README.md)

| id | tags | builder / state | from |
|---|---|---|---|
| objects/enclosure | hardware device enclosure chamfer led **new** | `makeEnclosure(ctx, p, spec)`: `setBand(level, hex, sweep)`, `pose(p, yaw, s)`; parts `shell top base` | new 2026-10-16 |
| objects/vent-grille | hardware vent slots hex **new** | `makeVentGrille(ctx, p, {w, h, kind, rows, cols})` (instanced) | new |
| objects/ports | hardware ports io **new** | `makePorts(ctx, p, {ports: [{kind, x, y}]})` generic power / network / display out / data / wide / audio | new |
| objects/cable | hardware cable plug **new** | `makeCable(ctx, p, {from, to, dir, plug})`: `set({insert})` | new |
| objects/hw-node | hardware device explode hero **new** | `makeNode(ctx, p, spec)`: `set({band, bandSweep, explode, die, dieGlow, fanSpin, cardGlow})`, layout from `lib/hwdata.js` | new |
| objects/pcb | hardware pcb board **new** | `makePCB(ctx, p, {w, d, chips, soc})` seeded traces, chip, memory, chokes, MLCC, gold fingers | new |
| objects/chip-die | hardware chip die reveal **new** | `makeChip(ctx, p, o)`: `set({open, glow, accent})` the lid lifts, the die blocks light one by one | new |
| objects/heatsink | hardware heatsink fins **new** | `makeHeatsink(ctx, p, {w, d, h, fins})` | new |
| objects/fan | hardware fan **new** | `makeFan(ctx, p, {r, blades})`: `set({spin})` | new |
| objects/gpu-card | hardware gpu card **new** | `makeGPUCard(ctx, p, {w, d, t, fans})`: `set({spin, glow})` | new |
| objects/xray | hardware xray wireframe **new** | `makeXray(ctx, root, {axis, color})`: `set(k)` 0 wire .. 1 solid | new |
| objects/hw-studio | hardware studio rim sweep dark **new** | `makeDarkStudio(ctx)` + `makeHwRig(ctx).update(n, slot, {rim, top, key, edge, sweep})` | new |
| objects/model | hardware your-product glb obj **new** | `await loadModel(ctx, p, url, {size, axis, yaw})`: `applyExplode(offs)`, `pose()` | new |
| objects/photo-25d | hardware photo parallax **new** | `await makePhotoParallax(ctx, p, {src, depth, w})` | new |

## Honesty notes

- Demo brand "Acme" / device "Acme Node" are fictional; every demo number is `placeholder data` and the frame says `render · demo specs` (teaser: `render · demo`).
- The scale shot's dimensions are the demo model's own size (source "demo model dimensions (the render, not a measured product)").
- Port names are generic descriptions (Power, Network, Display out, Data); no trademarked connector names or logos anywhere.
- No named real launch, keynote or device appears in any shipped file.

## Measured

NOTHING IS RENDERED YET. The data volume sat at 4-9 GiB free for the whole run (other lanes, then iCloud sync), so `render-lock.sh` refused, and the
coordinator put the lane in code-only mode at 05:30 IST. What IS measured: the 15 hardware sounds (sfx QA: 316 sounds, 0 fails; `sfx/tests/test_hardware.py` 11/11),
the reveal score (ears on the bare score: tone, clipping, sync, structure, repetition, stereo pass; loudness "fails" by design, it is a bed at -18.8 LUFS that the mixer
masters; dark open about 12 dB under the drop), the hardware-reveal mix (-14.03 LUFS-I / -2.5 dBTP, 28 cues, built before the disk ran out), plans and tests
(`templates/_hw/hw.test.mjs` 256/256), the three.js props on three dev renders that were made before the disk ran out (`objects/qa/hw-node/`, `objects/qa/hw-explode/sheet.jpg`:
the node reads as a premium dark product; the explode cascade works; one fix came from it: the device now rises before the shell and base drop, so they no longer pass
through the floor). The rest of the 3D (board, card, x-ray, sweep, silhouette, cable, the tall framings) and every overlay alignment are unseen.

### Renders still pending (run in this order, each through the lock; stop if the lock refuses)

```bash
L=$MP_RENDER_PREFIX; R=.
# 0. prop stills (GPU, small): look at them before the films
cd $R && for s in silhouette sweep explode xray board card cable; do $L node tools/render.mjs objects/hw-gallery.html out-unused.mp4 0 0 --stills-only --stills 45,95 --query "shot=$s" --stills-dir objects/qa/hw-$s --min-free-gib 10; done
cd $R && $L node type/tests/hw-sheet.mjs                                  # type/demo/out/gfx-hw.jpg (the catalog thumbnail of the hw.* parts) + its smoke test
# 1. the films: plate (GPU, cached) + score + mix + page, then HyperFrames, both aspects
for T in hardware-reveal hardware-teaser spec-sheet; do
  cd $R/templates/$T && $L node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/$T.mp4 --crf 23 -w 1
  cd $R/templates/$T && $L node make.mjs --set aspect=9:16 && (cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/$T-tall.mp4 --crf 23 -w 1)
done
# 2. measure every delivered MP4 (contact sheet + LUFS/TP), then eyes and ears
cd $R/templates/hardware-reveal && python3 ../_shared/sheet.py out/hardware-reveal.mp4 out/sheet.jpg 0.5,3,7,10.6,13,17,21,25,27,29.5,32,35,37,41,45,49,53,56 && python3 ../_shared/sheet.py out/hardware-reveal-tall.mp4 out/sheet-tall.jpg 0.5,3,7,10.6,13,17,21,25,27,29.5,32,35,37,41,45,49,53,56
cd $R/templates/hardware-teaser && python3 ../_shared/sheet.py out/hardware-teaser.mp4 out/sheet.jpg 0.3,1.5,3,4.5,5.5,7,8.5,10.3 && python3 ../_shared/sheet.py out/hardware-teaser-tall.mp4 out/sheet-tall.jpg 0.3,1.5,3,4.5,5.5,7,8.5,10.3
cd $R/templates/spec-sheet && python3 ../_shared/sheet.py out/spec-sheet.mp4 out/sheet.jpg 0.5,2.5,5,8,11,14,16.5,18,20,22,24.5 && python3 ../_shared/sheet.py out/spec-sheet-tall.mp4 out/sheet-tall.jpg 0.5,2.5,5,8,11,14,16.5,18,20,22,24.5
for T in hardware-reveal hardware-teaser spec-sheet; do cd $R/templates/$T
  $L python3 ../../eyes/look.py out/$T.mp4 --plan out/plan.json --md out/eyes.md;  $L python3 ../../ears/listen.py out/$T.mp4 --plan out/plan.json --md out/ears.md
  $L python3 ../../eyes/look.py out/$T-tall.mp4 --plan out/plan-tall.json --platform reels.organic --md out/eyes-tall.md; $L python3 ../../ears/listen.py out/$T-tall.mp4 --plan out/plan-tall.json --md out/ears-tall.md; done
# 3. Blender: your-model round trip (export the pack's own device as a GLB, then turntable / macroSweep / explode on it, 3 frames at 480p EEVEE)
cd $R && $L bash blender/tests/model.sh --blender /path/to/Blender
# 4. catalog: add the three TPL rows (above), then
cd $R && python3 catalog/build.py && python3 tools/count.py --write && python3 tools/count.py --check
```

Between steps move intermediates to the Trash: `mv templates/*/out/plate-*-raw.mp4 ~/.Trash/ 2>/dev/null` (make.mjs deletes them itself on success).
What to look at first on the sheets: the callout dots sit ON their parts (the node-side projection `objects/kit/project.js` mirrors the kit rig but has not been
compared with the page's own `window.__project` yet), frame 0 of the dark open is a visible moving silhouette (eyes/frame0), the 9:16 framings (every tall camera
is a starting value), the x-ray and the die reveal, and the end-card hold.

## Render findings (16-17 Oct, RENDER-QUEUE.md L1) and what was fixed

- **9:16 wrote a 1920x1080 file:** fixed in the integration (templates/_shared/project.mjs + `aspectFlag` in templates/_hw/makehw.mjs; `mp render` now fails a file at the wrong size). Re-render L1.
- **eyes, hardware-teaser 16:9:** safezones (the "Lit from within" detail line sat 14 px under the bottom safe edge, on the frame label at 7.2 s): moved up 40 px on 16:9 (not yet re-rendered). frame0 (nothing moves in the first 1.0 s: the dark silhouette) and banding (12/12 frames, dark gradients) are open: they need a brighter edge light from frame 0 and grain / a lower CRF on the plate; judge on the re-render.
