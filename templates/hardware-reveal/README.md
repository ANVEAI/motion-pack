# hardware-reveal: the AI-hardware / device launch film

A 45-75 s launch film for a physical product, 16:9 plus a 9:16 re-layout. It is the editable, deterministic version of the craft of device keynote reveals and
hardware launch films: a dark tease, a light sweep across the material, the reveal on the music's drop, an exploded view with spec callouts, a scale reference,
a ports tour, the chip inside, a spec card, an availability card and an end card. No shot, copy, music or design of any real launch is reproduced.

Sister templates (same engines, same pipeline `templates/_hw/makehw.mjs`):
- `templates/hardware-teaser`: 6 / 10 / 15 s. The silhouette, one detail, the date card. The product is never shown whole.
- `templates/spec-sheet`: 20 / 24 / 30 s. The device turns, a dark comparison table (`ui.dataTable`) lands row by row, one hero spec lands on the device itself.

## Run

```bash
cd templates/hardware-reveal
node make.mjs                                   # plan (lint gates) -> 3D plate (GPU, cached) -> fitted score -> mix -> index.html
npx -y hyperframes@0.8.142 render . -o out/hardware-reveal.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16                 # the 9:16 re-layout: its own project folder tall/
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/hardware-reveal-tall.mp4 --crf 23 -w 1)
python3 ../_shared/sheet.py out/hardware-reveal.mp4 out/sheet.jpg 0.5,3,7,10.6,14,19,23,27,31,34,38,41,45,49,53,56
```

- `--set length=short|full|long` (46 / 56 / 70 s, or a number in seconds: the nearest cut). Every section is a whole number of bars at 120 BPM, so every cut sits on a beat.
- `--plates` re-renders the 3D plate. It is otherwise reused while `out/plate-<aspect>.mp4.sig` matches the plate spec.
- `--no-plate` writes the page with labelled placeholder cards where the plate goes (layout work without a GPU).

## What it is made of

| layer | parts |
|---|---|
| 3D plate | `objects/hw-node` (the generic device: enclosure + board + `objects/chip-die` + `objects/heatsink` + `objects/fan` + `objects/gpu-card`), `objects/hw-studio` (dark cyc, rim + top + sweep rig, edge lights), `objects/xray`, `objects/cable`, `objects/laptop` + `objects/mug` (scale), the shot director `objects/lib/hwshots.js` (camera moves `cam3d.pushSlow`, `cam3d.truck`, `cam3d.pushIn`, `cam3d.crane`, `cam3d.hold`), the explode choreographer `objects/lib/explode.js` |
| overlays (HyperFrames) | `hw.edgeGlint` on the chamfer, `hw.specCallout` on the exploded parts, the ports and the die, `hw.dimensionLine` on the device's own edges, `hw.specCard`, `hw.dateCard`; titles `type/trackingCollapse`, `type/charRise`, `type/maskRise`, `type/blurIn`; `layers/grain` (upload-safe) |
| transitions | hard cuts on the bar lines; `transitions/whip` (explode > scale, ENERGY), `transitions/zoom-through` (ports > inside, PLACE), `transitions/dip-to-black` (specs > price, RHYTHM) |
| sound | `music/reveal.py` composes the dark > reveal score to the film's own sections (the drop is the reveal bar); bundle `hardware_launch`: `sfx/hw/hum_loop` under the dark open (stopped on the reveal), `sfx/hw/light_sweep` on the glint, ONE `sfx/hw/sub_hit` on the reveal frame, `sfx/hw/led_on`, `sfx/hw/chime_reveal` on the name, `sfx/hw/parts_separate` / `sfx/hw/parts_seat`, `sfx/hw/click_detent` per callout and spec row, `sfx/hw/port_insert`, `sfx/ui/scan_sweep`, `sfx/hw/chime_metal` on the die, `sfx/hit/soft` on the date, `sfx/logo/hybrid` on the end card |

The overlays are ON the device: node computes, for every frame, where a device anchor (the heatsink, a port, the die, a corner) lands in the rendered plate, with the
same pure camera maths the plate uses (`objects/kit/project.js`, `objects/lib/hwshots.js`). A callout's line therefore stays on its part while the camera cranes and the
part floats. A port callout only exists while its port is in view (`visibleWindow`).

## Make it yours (the CONFIG block)

- `brand`, `product`, `text` (all copy, no digits), `device` (the generic device: `w h d chamfer r material top band ports`; `objects/lib/hwdata.js`).
- `specs` (label, value, unit, source, `part` for its exploded-view callout), `price` (`value: null` = date only), `dims.source`, `ports` (which back ports get a callout).
- `media.model.src`: YOUR model (GLB / glTF / OBJ). It replaces the generic device in the hero, scale, spec, price and end shots; the explode, ports and inside shots keep the
  generic device (their callouts need its known geometry), and the frame label says "render".
- `media.photo.src` (+ optional `depth` map): ONE product photo as a 2.5D plate in the hero / spec / price / end shots. A still cannot show its sides: keep the orbit small.
- `PROJECT_MAP` maps the shared project file's fields (`brand.*`, `text.hook`, `text.headline`, `media.model`, `media.photo`, `aspects`) onto these paths.

## Honesty

- The demo device is fictional ("Acme Node", a pack render) and the frame says `render · demo specs` for the whole film.
- Every number on screen is a claim with a source: the specs, the dimensions (the demo model's own size), the price. A missing or generic source fails `lint.proof` and
  `node make.mjs` exits 2. The parts print `source: placeholder data` beside every default number.
- A price always prints its note ("indicative price · placeholder" by default) and its source.
- The die pattern is decorative; the 2D die part (`hw.chipDie`) says so in frame.

## Checks

`node templates/_hw/hw.test.mjs` (all three templates, both aspects, every cut: purity, bar grid, the drop on the reveal bar, one sub hit, tracks in frame, text in the
safe rect, claims sourced, the lint gate stops an unsourced spec, the committed plans are current; plus the explode choreographer, the projection and the die table).

## Measured (delivered files)

See `LANE_NOTES.md` at the clone root for the renders of this round, their loudness and their eyes / ears scores.

## Limits (honest)

- The generic device is a clean stylised render, not photoreal at macro distance; for a photoreal hero use `blender/turntable`, `blender/macroSweep` or `blender/explode`
  (now with `--param model=/abs/your.glb`) and composite the plate.
- With your GLB, the exploded-view callouts still point at the generic layout's anchors: pass your own points if you explode your model (the plate explodes its top-level parts).
- The scale shot compares against the pack's own laptop and mug, not a measured hand.
