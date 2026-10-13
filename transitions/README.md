# motion-pack / transitions

47 owned, deterministic transitions for every kind of video we make (ads, launch films, mime-style spots,
beat edits, talking heads, short films): the original 23 plus 24 added on 2026-10-13 (ripple, swirl, crossWarp, directionalWarp,
cube, doorway, kaleido, hexagonalize, windowSlice, blinds, squeeze, polkaDots, tvStatic, burnOut, dreamyZoom, linearBlur, gridFlip,
bookFlip, pinwheel, radial, waterDrop, wind, luminanceMelt, overexposure). Since 2026-10-13 every visual transition also plays in DOM
templates: 23 have a real DOM back-end and the other 23 GL-only looks run a DOM approximation (`lib/tx-dom-x.js` APPROX, `dom~` below),
so DOM templates no longer hard-cut on them. All 58 ffmpeg xfade modes + `custom` are pack ids too (`transitions/xfade-<mode>`, `lib/xfade.js`). Every one renders from `p` (or `t`) alone, so it is seek-safe in
HyperFrames 0.8.142, in the three.js studio kit and in the spec-to-loop renderer. All GLSL and JS here is ours;
gl-transitions (gl-transitions.com, MIT) was read for vocabulary; the 2026-10-13 shaders are our own GLSL for effects that collection named, and each entry's `credit` field names the original idea's author. Nothing vendored. No media files are used.

## Layout

| path | what |
|---|---|
| `lib/registry.js` | **source of truth**: params + defaults, beat-grid timing, sound pairing, edit grammar, tags |
| `lib/tx-shaders.js` | the GLSL (ES 1.00; also valid in three `ShaderMaterial`): prelude + 22 shaders; `lib/tx-shaders-x.js` adds 24 (merged) |
| `lib/registry-x.js` | registry entries for the 24 added transitions (merged into REGISTRY; `credit` = idea source) |
| `lib/tx-dom-x.js` | 10 more real DOM back-ends (cube in CSS 3D, clip-path slices/blinds, conic masks, ...) + `APPROX`: a DOM look for every GL-only key |
| `lib/xfade.js` | ffmpeg xfade map: 58 modes + custom as `transitions/xfade-<mode>`, nearest pack key per mode, `xfadeFilter(id, {duration, offset})` |
| `lib/tx-gl.js` | raw WebGL runner `createTxRenderer(canvas).render({key, from, to, p, params})` + text-mask/anchor solver |
| `lib/tx-dom.js` | DOM/CSS back-end `applyDom(key, p, {a, b, root, params})`: 23 real back-ends + 23 approximations (shots are DOM layers) |
| `lib/tx-three.js` | `makeTransitionPass(THREE, key, params)` for the three.js kit (parity-tested against tx-gl) |
| `lib/tx-hf.js` | `hfBind(renderAt, {compositionId, duration})`: drives any renderAt(t) from HyperFrames seeks |
| `lib/sequence.js` | edit list on a beat grid -> what is on screen at t (`planEdits`, `stateAt`, `lintPlan`) |
| `lib/tx-core.js` | eases (incl. CSS cubic-bezier), beat grid (`snapBpm`, `txWindow`), `speedRamp` curves, match-cut solver |
| `lib/testcard.js` | two procedural test shots (period 2 s) used by the demos |
| `catalog.json` | GENERATED from the registry (`node tools/build.mjs`) for Python (`../cuts/cutgen.py --tx`) |
| `demo.html` | one-transition demo page (spec-to-loop render contract) |
| `examples/hf-gl`, `examples/hf-dom` | HyperFrames compositions (GL 16:9 and DOM 9:16), lint-clean, rendered offline |
| `renders/` | 2 s demos (`<key>.mp4`, 9:16 for whip / swipeUp / maskReveal), stills, QA json, `contact.jpg`, hashes |
| `tools/` | `demos.sh` (render + QA), `build.mjs`, `lint.mjs`, `hashes.sh`, `contact.py`, `three-parity.sh` |
| `tests/` | `core.test.mjs` (pure functions), `three-parity.html`, `dom-sheet.mjs` (real Chrome: every DOM back-end and approximation; writes `renders/contact_dom.jpg`) |

## Use it

**HyperFrames, shots on canvases (GL, every effect):** see `examples/hf-gl/index.html`.
```js
import { createTxRenderer } from './lib/tx-gl.js'; import { planEdits, stateAt } from './lib/sequence.js'; import { hfBind } from './lib/tx-hf.js';
const tx = createTxRenderer(canvas); tx.compileAll();
const plan = planEdits([{ cut_s: 1.0, key: 'whip' }, { cut_s: 2.0, key: 'glitch' }], { bpm: 120 });   // swap lands ON each cut_s
hfBind(t => { const s = stateAt(t, plan); /* paint shots at t, then */ tx.render({ key: s.key, from, to, p: s.p, params: s.params, dur_s: s.dur }); },
       { compositionId: 'main', duration: 6 });
```
Root needs `data-duration` and `data-no-timeline` (no GSAP needed; HyperFrames dispatches `hf-seek`). With GSAP loaded,
`hfBind` also registers a paused timeline on `window.__timelines[id]`. Link the lib with a relative path or a symlink
(`examples/*/lib -> ../../lib`); both examples render offline in about 10 s each.

**ffmpeg finisher (proxy / server renders):** `xfadeFilter('transitions/xfade-circleopen', { duration: 0.5, offset: 2.25 })` returns
`[0:v][1:v]xfade=transition=circleopen:duration=0.5000:offset=2.2500[v]`; a pack key also works (`xfadeFilter('whip', ...)` uses PACK_TO_XFADE).
All 59 strings were run through local ffmpeg 8.0.1 on a lavfi test source.

**HyperFrames, shots are DOM layers (all 46 visual effects; 23 exact, 23 approximated):** `applyDom(key, p, { a, b, root, params })`, see `examples/hf-dom`.
Put `a`/`b` inside clips, never tween `.clip` itself. DOM gives no mirrored edges (spin shows the background), no
chroma fringe on whip and only linear/radial luma mattes; use the GL path when that matters.

**three.js kit:** render shot A and B into render targets, then `makeTransitionPass(THREE, 'whip').set({ from: rtA.texture, to: rtB.texture, p, width, height })` and render `pass.scene` with `pass.camera`.

**Beat grid:** `txWindow(REGISTRY.whip, { fps: 30, bpm: 128, cutFrame: 96 })` gives integer `{start, cut, end}` with the
swap on the cut frame; `../cuts/cutgen.py beats --bpm 128 --pattern every_2 --tx whip --snap` does the same in Python
and lists every sound cue's anchor frame.

**Speed ramps:** `speedRamp(RAMP_PRESETS.hit, { anchor: cut_s }).map(tOut) -> tSource` (monotonic, closed-form per
segment). Feed `tSource` to the shot renderer; accumulate 6 sub-frames at 180 degrees for motion blur.

## House rules

1. The swap (`timing.cut`) sits on the beat or the cut frame; the transition straddles it.
2. Endpoints are exact: `p <= 0` is shot A, `p >= 1` is shot B (passthrough), so a transition never "pops".
3. Every transition has a sound pairing by id `sfx/<category>/<name>` (= `snd.<category>.<name>` in `../sfx`), anchored
   at `at + offset_f` frames (house rule: picture first, sound one frame later). Ids marked *pending* do not exist in the
   sound module yet; `tools/lint.mjs` reports which ones are present.
4. Default to a hard cut. Every transition here needs a reason code (LINK, ENERGY, CONTRAST, TIME, PLACE, REVEAL,
   EMPHASIS, BEAT); see each entry's use/avoid lines and `../docs/research/edit.md` 2.17 for the decision table.
5. Flash safety: max 3 full-frame flashes per second; `flash.peak = 0.7` is the safe mode.

## Decision table (from docs/research/edit.md 2.17)

| situation | pick | never |
|---|---|---|
| same scene, new angle | hard cut | any transition |
| shared shape / motion / position | `match` | `whip` |
| montage, place change, energy | `whip`, `scalePunch`, `push` | `lightLeak` |
| comedy / tonal whiplash | smash cut (`../cuts`), `iris` throughBlack for cartoon | soft transitions |
| time passing, memory | `dissolve` (1 s), `filmBurn`, `lightLeak`, `dip` | `glitch` |
| "this becomes that" | `morph` | wipes |
| into a screen / eye / hole | `zoomThrough` | `whip` |
| music hit, emphasis | `flash`, `scalePunch`, speed ramp | long dissolve |
| brand / lifestyle sensuality | `ink`, `lightLeak` | `glitch` |
| tech, disruption, hook interrupt | `glitch`, `pixelSort`, `whip` | `ink` |
| reveal through a word or logo | `maskReveal` | - |
| 9:16 feed "next" | `swipeUp` | `pagePeel` |
| branded chapter marker | `shutter`, `dip` brand | in short films |

## Tests

```
node tests/core.test.mjs                       # eases, beat windows, ramps, match solver, sequencer
node tests/dom-sheet.mjs                       # (from the pack root) every DOM back-end + approximation in real Chrome
node tools/lint.mjs                            # registry/shader/DOM/README/catalog/QA/hash consistency + sound pairing report
tools/demos.sh [keys]                          # 2 s demos + stills + QA (determinism, seam, console) via spec-to-loop render.mjs
tools/hashes.sh                                # same frame hashed in two separate Chrome launches -> renders/hashes.json
THREE_BUILD=<local three/build> tools/three-parity.sh   # tx-three vs tx-gl pixel parity
python3 tools/contact.py renders/contact.jpg   # look at the stills
```

## Catalog (generated)

<!-- BEGIN CATALOG -->
| key | id | ms | beats | cut | back-ends | sound (first) | tags |
|---|---|---|---|---|---|---|---|
| `flash` | tx.flash | 120 | 0.25 | 0.25 | gl + dom | `sfx/camera/shutter` | flash, shutter, beat, emphasis |
| `shutter` | tx.shutter | 400 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_s` | shutter, bars, brand, graphic |
| `lumaWipe` | tx.lumaWipe | 500 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_s` | wipe, luma, matte, graphic |
| `iris` | tx.iris | 450 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_s` | iris, wipe, circle, star |
| `whip` | tx.whip | 300 | 0.5 | 0.5 | gl + dom | `sfx/whoosh/whip_pan` | whip, pan, energy, montage |
| `zoomThrough` | tx.zoomThrough | 500 | 1 | 0.48 | gl + dom~ | `sfx/lift/inhale` | zoom, dive, aperture, radial-blur |
| `match` | tx.match | 600 | 1 | 0.5 | gl + dom | `sfx/hit/soft` | match, link, concept, camera |
| `morph` | tx.morph | 600 | 1 | 0.5 | gl + dom~ | `sfx/tx/morph_warble` | morph, dissolve, warp, object |
| `lightLeak` | tx.lightLeak | 700 | 1.5 | 0.5 | gl + dom~ | `sfx/sparkle/shimmer` | leak, warm, nostalgia, screen-blend |
| `filmBurn` | tx.filmBurn | 800 | 2 | 0.5 | gl + dom~ | `sfx/sizzle/grain` | burn, analog, film, time |
| `glitch` | tx.glitch | 250 | 0.5 | 0.5 | gl + dom~ | `sfx/tx/glitch_stutter` | glitch, rgb-split, cyber, interrupt |
| `ink` | tx.ink | 900 | 2 | 0.5 | gl + dom~ | `sfx/liquid/pour` | ink, liquid, organic, premium |
| `maskReveal` | tx.maskReveal | 900 | 2 | 0.6 | gl + dom~ | `sfx/whoosh/whoosh_in_m` | mask, reveal, text-knockout, title |
| `push` | tx.push | 350 | 0.5 | 0.5 | gl + dom | `sfx/whoosh/swish_s` | push, slide, ui, carousel |
| `swipeUp` | tx.swipeUp | 450 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_xs` | swipe, social, feed, card |
| `spin` | tx.spin | 450 | 1 | 0.5 | gl + dom | `sfx/whoosh/whoosh_m` | spin, rotate, energy, beat-edit |
| `pagePeel` | tx.pagePeel | 800 | 2 | 0.5 | gl + dom~ | `sfx/paper/flip` | page, peel, curl, paper |
| `pixelSort` | tx.pixelSort | 500 | 1 | 0.5 | gl + dom~ | `sfx/tx/glitch_stutter` | pixel-sort, glitch, datamosh, art |
| `dip` | tx.dip | 700 | 1.5 | 0.5 | gl + dom | `sfx/lift/down` | dip, fade, black, white |
| `dissolve` | tx.dissolve | 400 | 1 | 0.5 | gl + dom | `sfx/tx/dissolve_pad` | dissolve, crossfade, time, soft |
| `blurCross` | tx.blurCross | 350 | 0.5 | 0.5 | gl + dom | `sfx/whoosh/swish_xs` | blur, soft, ui, demo |
| `scalePunch` | tx.scalePunch | 230 | 0.5 | 0.3 | gl + dom | `sfx/whoosh/zip` | punch, scale, energy, beat |
| `speedRamp` | cam.speedRamp | 800 | 2 | 0.3125 | curve | `sfx/whoosh/reverse` | ramp, retime, slowmo, impact |
| `ripple` | tx.ripple | 700 | 1.5 | 0.5 | gl + dom~ | `sfx/liquid/drip` | ripple, water, dream, memory |
| `swirl` | tx.swirl | 700 | 1.5 | 0.5 | gl + dom~ | `sfx/whoosh/whoosh_m` | swirl, vortex, magic, cartoon |
| `crossWarp` | tx.crossWarp | 500 | 1 | 0.5 | gl + dom~ | `sfx/whoosh/swish_s` | warp, stretch, sweep, montage |
| `directionalWarp` | tx.directionalWarp | 500 | 1 | 0.5 | gl + dom~ | `sfx/whoosh/swish_s` | warp, diagonal, sweep, wipe |
| `cube` | tx.cube | 650 | 1 | 0.5 | gl + dom | `sfx/whoosh/whoosh_m` | cube, 3d, rotate, ui |
| `doorway` | tx.doorway | 800 | 2 | 0.5 | gl + dom~ | `sfx/wood/creak` | door, reveal, open, launch |
| `kaleido` | tx.kaleido | 700 | 1.5 | 0.5 | gl + dom~ | `sfx/sparkle/shimmer` | kaleidoscope, psychedelic, music, festive |
| `hexagonalize` | tx.hexagonalize | 600 | 1 | 0.5 | gl + dom~ | `sfx/tx/glitch_stutter` | hex, pixelate, tech, data |
| `windowSlice` | tx.windowSlice | 500 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_s` | slice, stripes, wipe, graphic |
| `blinds` | tx.blinds | 600 | 1 | 0.5 | gl + dom | `sfx/paper/flip` | blinds, slats, retro, noir |
| `squeeze` | tx.squeeze | 450 | 1 | 0.5 | gl + dom | `sfx/tx/tape_stop` | squeeze, crt, tv-off, retro |
| `polkaDots` | tx.polkaDots | 700 | 1.5 | 0.5 | gl + dom | `sfx/ui/pop` | dots, pop, playful, kids |
| `tvStatic` | tx.tvStatic | 500 | 1 | 0.5 | gl + dom~ | `sfx/tx/glitch_stutter` | static, tv, noise, retro |
| `burnOut` | tx.burnOut | 900 | 2 | 0.5 | gl + dom~ | `sfx/tx/film_burn` | burn, fire, film, analog |
| `dreamyZoom` | tx.dreamyZoom | 800 | 2 | 0.5 | gl + dom | `sfx/lift/inhale` | dream, zoom, soft, wedding |
| `linearBlur` | tx.linearBlur | 400 | 1 | 0.5 | gl + dom | `sfx/whoosh/swish_xs` | blur, motion, speed, soft |
| `gridFlip` | tx.gridFlip | 900 | 2 | 0.5 | gl + dom~ | `sfx/paper/flip` | grid, tiles, flip, mosaic |
| `bookFlip` | tx.bookFlip | 900 | 2 | 0.5 | gl + dom~ | `sfx/paper/flip` | book, page, story, chapter |
| `pinwheel` | tx.pinwheel | 600 | 1 | 0.5 | gl + dom | `sfx/whoosh/whoosh_m` | pinwheel, wipe, retro, playful |
| `radial` | tx.radial | 600 | 1 | 0.5 | gl + dom | `sfx/ui/tick` | clock, radial, wipe, time |
| `waterDrop` | tx.waterDrop | 800 | 2 | 0.5 | gl + dom~ | `sfx/liquid/drip` | water, drop, liquid, calm |
| `wind` | tx.wind | 600 | 1 | 0.5 | gl + dom~ | `sfx/amb/wind` | wind, streak, wipe, travel |
| `luminanceMelt` | tx.luminanceMelt | 1000 | 2 | 0.5 | gl + dom~ | `sfx/liquid/glug` | melt, drip, surreal, art |
| `overexposure` | tx.overexposure | 700 | 1.5 | 0.5 | gl + dom | `sfx/tx/flash_swell` | exposure, white, heaven, memory |

### `flash` (tx.flash): Hard-cut flash

- **Use:** Music hit, camera-capture moment, a hard visual comma; the frame is white ON the cut so the swap is invisible.
- **Avoid:** More than 3 full-frame flashes per second (photosensitivity); calm premium pieces; never on every cut.
- **Reasons:** EMPHASIS, BEAT. **Tags:** flash, shutter, beat, emphasis, interrupt, cheap
- **Timing:** 120 ms free-time (4 f @30), 0.25 beat(s) on a grid (4 f @120 BPM), swap at p=0.25, ease `linear`
- **Params:** `color`="#ffffff", `peak`=1, `bloom`=0.6
- **Sound:** `sfx/camera/shutter` at cut+1 f, +3 dB; `sfx/hit/punch` at cut+1 f, +3 dB (alt for music hits)
- **Demo:** [16:9](renders/flash.mp4) / [stills](renders/stills/flash)

### `shutter` (tx.shutter): Brand shutter (violet bars)

- **Use:** Branded section change in launch films and ads; doubles as a chapter marker. Bars fully closed on the beat.
- **Avoid:** Short films and talking heads (too designed); more than once per 10 s.
- **Reasons:** EMPHASIS, PLACE, BEAT. **Tags:** shutter, bars, brand, graphic, wipe, launch
- **Timing:** 400 ms free-time (12 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `color`="#4A18ED", `bars`=6, `stagger`=0.35, `vertical`=false, `edge`=0.5
- **Sound:** `sfx/whoosh/swish_s` at start+0 f, +1 dB; `sfx/camera/shutter` at cut+1 f, +3 dB
- **Demo:** [16:9](renders/shutter.mp4) / [stills](renders/stills/shutter)

### `lumaWipe` (tx.lumaWipe): Luma wipe (shape mattes)

- **Use:** Graphic punctuation inside designed motion pieces; clock wipe for "time", radial for focus, noise for organic.
- **Avoid:** Overuse; reads dated unless the shape means something. Never in a short film scene change.
- **Reasons:** PLACE, REVEAL. **Tags:** wipe, luma, matte, graphic, shape, clock, blinds
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `matte`="linear" (linear|radial|noise|clock|diamond|blinds), `angle`=0, `softness`=0.15, `invert`=false, `center`=[0.5,0.5], `blinds`=8, `edgeColor`="#ffffff", `edgeGlow`=0
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB
- **Demo:** [16:9](renders/lumaWipe.mp4) / [stills](renders/stills/lumaWipe)

### `iris` (tx.iris): Iris (circle/diamond/star/rounded)

- **Use:** Reveal on a subject ("look closer"), cartoon/mime-style endings (throughBlack), playful product reveals.
- **Avoid:** Serious tone; centre that is not on the subject (it then reads as a template).
- **Reasons:** REVEAL, PLACE. **Tags:** iris, wipe, circle, star, cartoon, reveal, mime
- **Timing:** 450 ms free-time (14 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `shape`="circle" (circle|diamond|star|roundRect), `center`=[0.5,0.5], `softness`=0.01, `overscan`=1.05, `throughBlack`=false, `color`="#000000", `ring`=0, `points`=5
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB; `sfx/ui/pop` at cut+1 f, +2 dB (throughBlack close (cartoon))
- **Demo:** [16:9](renders/iris.mp4) / [stills](renders/stills/iris)

### `whip` (tx.whip): Whip pan (directional blur)

- **Use:** Kinetic location or feature change; montage; alternate the direction on consecutive whips.
- **Avoid:** Serious or slow tone; more than 3 in a row in a premium piece. Match dir to the incoming action vector.
- **Reasons:** ENERGY, PLACE. **Tags:** whip, pan, energy, montage, directional-blur, motion
- **Timing:** 300 ms free-time (9 f @30), 0.5 beat(s) on a grid (8 f @120 BPM), swap at p=0.5, ease `whip`
- **Params:** `dir`=[1,0], `blurMax`=0.08, `chroma`=2
- **Sound:** `sfx/whoosh/whip_pan` at cut+1 f, +2 dB; `sfx/whoosh/whoosh_m` at cut+1 f, +2 dB (longer whips (>= 400 ms))
- **Demo:** [16:9](renders/whip.mp4) / [9:16](renders/whip_9x16.mp4) / [stills](renders/stills/whip)

### `zoomThrough` (tx.zoomThrough): Zoom-through (radial blur)

- **Use:** Travelling into something (a screen, an eye, a doorway); product-in-UI walkthroughs; "dive in".
- **Avoid:** Shots with no aperture/dark centre (it reads as a plain scale); calm pieces.
- **Reasons:** ENERGY, REVEAL. **Tags:** zoom, dive, aperture, radial-blur, into-screen
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.48, ease `linear`
- **Params:** `center`=[0.5,0.5], `scaleOut`=3.5, `scaleIn`=0.5, `radialBlur`=0.5, `band`=0.1, `shake`=0.004
- **Sound:** `sfx/lift/inhale` at cut+0 f, +2 dB (ends on the cut); `sfx/hit/thud` at cut+1 f, +3 dB
- **Demo:** [16:9](renders/zoomThrough.mp4) / [stills](renders/stills/zoomThrough)

### `match` (tx.match): Match-cut helper (anchor solve + guides)

- **Use:** Link two ideas by shape/position (wheel to clock, problem to product). The rhyme IS the meaning.
- **Avoid:** Accidental matches that say nothing; more than one per 15 s. Lint: matchDistance() > 0.5 needs this helper.
- **Reasons:** LINK. **Tags:** match, link, concept, camera, graphic-match, guides
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `anchorA`=[0.36,0.55,0.32,0], `anchorB`=[0.64,0.45,0.4,0], `meet`="mid" (mid|A|B), `lead`=1, `settle`=1, `blur`=1, `guides`=false
- **Sound:** `sfx/hit/soft` at cut+1 f, -6 dB (a sound bridge across the cut; no whoosh)
- **Demo:** [16:9](renders/match.mp4) / [stills](renders/stills/match)

### `morph` (tx.morph): Morph cross-dissolve (luma-gradient warp)

- **Use:** "This becomes that": logo to UI, product A to B, face to icon. Best on alpha-matted objects with shared silhouettes.
- **Avoid:** Objects with no shared silhouette (use maskReveal); fast edits (it needs 0.5 s+).
- **Reasons:** LINK, TIME. **Tags:** morph, dissolve, warp, object, logo, liquid
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `warp`=0.35, `spread`=6
- **Sound:** `sfx/tx/morph_warble` at start+0 f, +0 dB; `sfx/ui/pop` at end-3 f, +1 dB
- **Demo:** [16:9](renders/morph.mp4) / [stills](renders/stills/morph)

### `lightLeak` (tx.lightLeak): Light leak

- **Use:** Warm, nostalgic, lifestyle/brand and lyric edits; a glossy hide-the-cut.
- **Avoid:** Tech/clinical products and cold palettes (recolour c1..c3 to brand first).
- **Reasons:** TIME, REVEAL. **Tags:** leak, warm, nostalgia, screen-blend, film, lifestyle
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `c1`="#ff7a1a", `c2`="#ff2d6f", `c3`="#ffd27a", `intensity`=0.9, `drift`=1, `grain`=0.08, `band`=0.12
- **Sound:** `sfx/sparkle/shimmer` at cut+1 f, +1 dB; `sfx/whoosh/reverse` at cut+0 f, +1 dB (swell into the peak)
- **Demo:** [16:9](renders/lightLeak.mp4) / [stills](renders/stills/lightLeak)

### `filmBurn` (tx.filmBurn): Film burn

- **Use:** Time passing, memory, "reel ends"; short films and music pieces; a retro hook.
- **Avoid:** Modern UI/SaaS demos unless the concept is retro.
- **Reasons:** TIME. **Tags:** burn, analog, film, time, grain, retro, memory
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `from`="left" (left|right|center|noise), `core`="#fff4d6", `rim`="#ff5a00", `char`="#2a0d00", `flicker`=24, `grain`=0.12, `weave`=3
- **Sound:** `sfx/sizzle/grain` at start+0 f, +0 dB; `sfx/tx/film_burn` at cut+1 f, +2 dB (projector-snap role: the sound module ships it as tx/film_burn)
- **Demo:** [16:9](renders/filmBurn.mp4) / [stills](renders/stills/filmBurn)

### `glitch` (tx.glitch): Glitch (RGB split + slices)

- **Use:** Tech/cyber, "something broke", a pattern interrupt in hooks, comedic stutter.
- **Avoid:** Calm premium pieces; stacking on every cut (max 1 per 2 s).
- **Reasons:** ENERGY, EMPHASIS. **Tags:** glitch, rgb-split, cyber, interrupt, hook, tech
- **Timing:** 250 ms free-time (8 f @30), 0.5 beat(s) on a grid (8 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `rgbSplit`=0.02, `slices`=8, `sliceShift`=0.06, `scanlines`=0.2, `quantFps`=12, `blocks`=0.3
- **Sound:** `sfx/tx/glitch_stutter` at start+1 f, +3 dB; `sfx/ui/tick` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/glitch.mp4) / [stills](renders/stills/glitch)

### `ink` (tx.ink): Ink / liquid reveal

- **Use:** Organic, premium: beverage, beauty, ceramics; spill reveal of the next scene; artistic title reveals.
- **Avoid:** Hard-tech products; fast cuts (needs 0.7 s+).
- **Reasons:** REVEAL, TIME. **Tags:** ink, liquid, organic, premium, beauty, beverage
- **Timing:** 900 ms free-time (27 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `source`="point" (point|edge|noise), `center`=[0.5,0.55], `viscosity`=0.6, `warp`=0.4, `softness`=0.05, `edgeTint`="#4A18ED", `tintAmt`=0.12
- **Sound:** `sfx/liquid/pour` at start+0 f, +0 dB; `sfx/liquid/bubbles_run` at cut+1 f, -2 dB
- **Demo:** [16:9](renders/ink.mp4) / [stills](renders/stills/ink)

### `maskReveal` (tx.maskReveal): Mask reveal by text

- **Use:** Reveal the next shot through a word or logo: title card knockout; brand-word to scene. Very reliable in ads.
- **Avoid:** Thin fonts (the zoom anchor needs a thick stroke); long words at 9:16 (lower fill).
- **Reasons:** REVEAL. **Tags:** mask, reveal, text-knockout, title, logo, occluder
- **Timing:** 900 ms free-time (27 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.6, ease `linear`
- **Params:** `text`="ORBIT", `weight`=900, `fill`=0.8, `hold`=0.3, `scaleTo`=40, `anchor`=[-1,-1], `shadow`=0.35
- **Sound:** `sfx/whoosh/whoosh_in_m` at cut+0 f, +2 dB; `sfx/hit/thud` at end+1 f, +3 dB
- **Demo:** [16:9](renders/maskReveal.mp4) / [9:16](renders/maskReveal_9x16.mp4) / [stills](renders/stills/maskReveal)

### `push` (tx.push): Push / slide

- **Use:** Next item in a list/carousel; feature to feature in UI demos; a "next" beat in explainers.
- **Avoid:** Story scene changes (it reads as UI); mixing directions within one sequence.
- **Reasons:** PLACE. **Tags:** push, slide, ui, carousel, graphic, cheap
- **Timing:** 350 ms free-time (11 f @30), 0.5 beat(s) on a grid (8 f @120 BPM), swap at p=0.5, ease `push`
- **Params:** `dir`=[1,0], `parallax`=0.15, `shadow`=0.35
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB; `sfx/ui/slide` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/push.mp4) / [stills](renders/stills/push)

### `swipeUp` (tx.swipeUp): Swipe-up (social card)

- **Use:** Native-feeling "next" in 9:16 feeds; story-style listicles; mime-style vertical spots.
- **Avoid:** 16:9 film (reads as an app); more than every 3 s.
- **Reasons:** PLACE, ENERGY. **Tags:** swipe, social, feed, card, 9x16, reels, tiktok
- **Timing:** 450 ms free-time (14 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `swipe`
- **Params:** `radius`=0.05, `scaleA`=0.9, `scaleB`=0.92, `dim`=0.5
- **Sound:** `sfx/whoosh/swish_xs` at cut+1 f, +1 dB; `sfx/ui/swipe_ding` at end+0 f, +0 dB (optional)
- **Demo:** [16:9](renders/swipeUp.mp4) / [9:16](renders/swipeUp_9x16.mp4) / [stills](renders/stills/swipeUp)

### `spin` (tx.spin): Spin (rotational blur)

- **Use:** Beat edits and playful montages; "turning the tables" gags.
- **Avoid:** Premium/serious tone; consecutive spins in the same direction.
- **Reasons:** ENERGY. **Tags:** spin, rotate, energy, beat-edit, playful
- **Timing:** 450 ms free-time (14 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `turns`=0.5, `zoom`=1.3, `blur`=0.6, `center`=[0.5,0.5], `ccw`=false
- **Sound:** `sfx/whoosh/whoosh_m` at cut+1 f, +2 dB
- **Demo:** [16:9](renders/spin.mp4) / [stills](renders/stills/spin)

### `pagePeel` (tx.pagePeel): Page peel (cylinder curl)

- **Use:** Storybook chapters, explainers, "next page" of a story, retro/kids content.
- **Avoid:** Tech launches (dated); fast edits.
- **Reasons:** PLACE, TIME. **Tags:** page, peel, curl, paper, storybook, retro, explainer
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `from`="bottomRight" (bottomRight|bottomLeft|topRight|topLeft|right|left), `radius`=0.08, `backTint`=0.75, `shadow`=0.5
- **Sound:** `sfx/paper/flip` at cut+0 f, +1 dB
- **Demo:** [16:9](renders/pagePeel.mp4) / [stills](renders/stills/pagePeel)

### `pixelSort` (tx.pixelSort): Pixel sort (approximate)

- **Use:** Music videos and art pieces; a stylised interrupt with more texture than a glitch.
- **Avoid:** Brand-clean ads; dark low-contrast shots (nothing crosses the threshold).
- **Reasons:** ENERGY. **Tags:** pixel-sort, glitch, datamosh, art, music-video
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `dir`=[0,-1], `length`=0.35, `threshold`=0.55, `jitter`=0.6
- **Sound:** `sfx/tx/glitch_stutter` at start+1 f, +2 dB; `sfx/sizzle/grain` at start+0 f, -2 dB
- **Demo:** [16:9](renders/pixelSort.mp4) / [stills](renders/stills/pixelSort)

### `dip` (tx.dip): Dip to black / white / brand

- **Use:** Black: time/chapter break, end of act. White: memory, dream, heaven. Brand: end-card lead-in.
- **Avoid:** Inside a fast montage; dips longer than 1 s in short-form (retention drop).
- **Reasons:** TIME. **Tags:** dip, fade, black, white, brand, chapter, film
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `color`="#000000", `hold`=0.14
- **Sound:** `sfx/lift/down` at start+0 f, -2 dB (black); `sfx/sparkle/shimmer` at cut+1 f, +0 dB (white)
- **Demo:** [16:9](renders/dip.mp4) / [stills](renders/stills/dip)

### `dissolve` (tx.dissolve): Cross-dissolve (linear / film / additive)

- **Use:** Time passing (1 s), soft montage; additive for dreamy music pieces.
- **Avoid:** Dialogue continuing across the change (use a J/L cut); energetic ads.
- **Reasons:** TIME. **Tags:** dissolve, crossfade, time, soft, film
- **Timing:** 400 ms free-time (12 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `mode`="film" (linear|film|additive)
- **Sound:** `sfx/tx/dissolve_pad` at cut+0 f, -4 dB (optional)
- **Demo:** [16:9](renders/dissolve.mp4) / [stills](renders/stills/dissolve)

### `blurCross` (tx.blurCross): Blur cross

- **Use:** Soft hide of a cut inside UI demos and explainers; focus pull feel.
- **Avoid:** When the edit should be felt (use a hard cut).
- **Reasons:** PLACE, TIME. **Tags:** blur, soft, ui, demo, focus
- **Timing:** 350 ms free-time (11 f @30), 0.5 beat(s) on a grid (8 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `radius`=0.022
- **Sound:** `sfx/whoosh/swish_xs` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/blurCross.mp4) / [stills](renders/stills/blurCross)

### `scalePunch` (tx.scalePunch): Scale punch cut

- **Use:** The cheapest energy cut: beat edits, ads, retention edits on a key claim.
- **Avoid:** Every cut (fatigue rule); short films.
- **Reasons:** ENERGY, EMPHASIS, BEAT. **Tags:** punch, scale, energy, beat, cheap, talking-head
- **Timing:** 230 ms free-time (7 f @30), 0.5 beat(s) on a grid (8 f @120 BPM), swap at p=0.3, ease `linear`
- **Params:** `from`=1.1, `anticip`=1.03, `flash`=0.15, `center`=[0.5,0.5]
- **Sound:** `sfx/whoosh/zip` at cut+0 f, +2 dB (ends on the cut); `sfx/hit/punch` at cut+1 f, +3 dB
- **Demo:** [16:9](renders/scalePunch.mp4) / [stills](renders/stills/scalePunch)

### `speedRamp` (cam.speedRamp): Speed-ramp curves (retime)

- **Use:** Weight on a hit; the slowest frame lands ON the beat (cut = anchor). Bullet time for hero reveals.
- **Avoid:** Footage without motion (nothing to see); dialogue (pitch).
- **Reasons:** EMPHASIS, BEAT. **Tags:** ramp, retime, slowmo, impact, speed, curve
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.3125, ease `inOutCubic`
- **Params:** `preset`="hit" (hit|bulletTime|rushIn|stutterStop|rampIn|rampOut|heroRamp|freezeStamp), `subsamples`=6, `shutter`=180
- **Sound:** `sfx/whoosh/reverse` at cut+0 f, +1 dB (into the slowest frame); `sfx/hit/deep_impact` at cut+1 f, +4 dB
- **Demo:** [16:9](renders/speedRamp.mp4) / [stills](renders/stills/speedRamp)

### `ripple` (tx.ripple): Ripple (water rings)

- **Use:** Dream, memory or "imagine if" beats; touch-a-screen moments (centre on the finger).
- **Avoid:** Fast montages and serious B2B pieces; more than once a minute.
- **Reasons:** TIME, LINK. **Tags:** ripple, water, dream, memory, soft
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `amp`=0.03, `freq`=40, `center`=[0.5,0.5]
- **Sound:** `sfx/liquid/drip` at start+0 f, +0 dB; `sfx/tx/dissolve_pad` at cut+0 f, -4 dB (optional bed)
- **Demo:** [16:9](renders/ripple.mp4) / [stills](renders/stills/ripple)

### `swirl` (tx.swirl): Swirl (vortex)

- **Use:** Magic, flashback, cartoon "whirl away"; mime-style spots.
- **Avoid:** Premium product pieces (reads cheap); talking heads.
- **Reasons:** TIME, ENERGY. **Tags:** swirl, vortex, magic, cartoon, mime
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `radius`=1, `turns`=0.75, `center`=[0.5,0.5]
- **Sound:** `sfx/whoosh/whoosh_m` at start+0 f, +1 dB; `sfx/sparkle/shimmer` at cut+1 f, -2 dB
- **Demo:** [16:9](renders/swirl.mp4) / [stills](renders/stills/swirl)

### `crossWarp` (tx.crossWarp): Cross warp (stretch past)

- **Use:** Montage place changes when a whip is too violent.
- **Avoid:** Text-heavy frames (text smears).
- **Reasons:** PLACE, ENERGY. **Tags:** warp, stretch, sweep, montage
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `dir`=[1,0]
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB
- **Demo:** [16:9](renders/crossWarp.mp4) / [stills](renders/stills/crossWarp)

### `directionalWarp` (tx.directionalWarp): Directional warp

- **Use:** Diagonal energy between product shots; pairs with diagonal compositions.
- **Avoid:** Dialogue scenes.
- **Reasons:** PLACE, ENERGY. **Tags:** warp, diagonal, sweep, wipe
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `dir`=[-1,1], `soft`=0.5
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB
- **Demo:** [16:9](renders/directionalWarp.mp4) / [stills](renders/stills/directionalWarp)

### `cube` (tx.cube): Cube turn (3D)

- **Use:** Feature-to-feature turns in product explainers; "other side" reveals (before/after).
- **Avoid:** Film scenes; more than twice in 30 s.
- **Reasons:** PLACE, EMPHASIS. **Tags:** cube, 3d, rotate, ui, carousel, feature
- **Timing:** 650 ms free-time (20 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `persp`=1.6, `zoom`=0.25, `bg`="#050505", `shade`=0.6
- **Sound:** `sfx/whoosh/whoosh_m` at start+0 f, +1 dB; `sfx/plastic/click` at end+0 f, -2 dB (face lands)
- **Demo:** [16:9](renders/cube.mp4) / [stills](renders/stills/cube)

### `doorway` (tx.doorway): Doorway (doors open)

- **Use:** Reveal a new world, product launch "doors open", chapter starts.
- **Avoid:** Inside a montage (too long).
- **Reasons:** REVEAL, PLACE. **Tags:** door, reveal, open, launch, welcome
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `depth`=0.7, `bg`="#000000"
- **Sound:** `sfx/wood/creak` at start+0 f, -2 dB; `sfx/whoosh/whoosh_in_m` at cut+0 f, +0 dB
- **Demo:** [16:9](renders/doorway.mp4) / [stills](renders/stills/doorway)

### `kaleido` (tx.kaleido): Kaleidoscope

- **Use:** Music edits, Holi / festival reels, trippy dream beats.
- **Avoid:** Brand pieces that must read as calm; faces at the peak.
- **Reasons:** ENERGY, TIME. **Tags:** kaleidoscope, psychedelic, music, festive
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `segments`=6, `spin`=0.5
- **Sound:** `sfx/sparkle/shimmer` at start+0 f, +0 dB; `sfx/tx/morph_warble` at cut+0 f, -2 dB
- **Demo:** [16:9](renders/kaleido.mp4) / [stills](renders/stills/kaleido)

### `hexagonalize` (tx.hexagonalize): Hexagonalize (hex pixelate)

- **Use:** Tech / data / AI explainers ("the data changes shape").
- **Avoid:** Nostalgic or human pieces.
- **Reasons:** PLACE, CONTRAST. **Tags:** hex, pixelate, tech, data, ai
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `size`=0.08
- **Sound:** `sfx/tx/glitch_stutter` at cut+0 f, -3 dB; `sfx/ui/blip` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/hexagonalize.mp4) / [stills](renders/stills/hexagonalize)

### `windowSlice` (tx.windowSlice): Window slice (stripe sweep)

- **Use:** Designed motion pieces, list-to-list UI changes, beat edits on a fill.
- **Avoid:** Film scenes.
- **Reasons:** PLACE, BEAT. **Tags:** slice, stripes, wipe, graphic, ui
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `count`=10, `soft`=0.5, `vertical`=false
- **Sound:** `sfx/whoosh/swish_s` at cut+1 f, +1 dB; `sfx/tx/luma_wipe` at start+0 f, -2 dB (alt)
- **Demo:** [16:9](renders/windowSlice.mp4) / [stills](renders/stills/windowSlice)

### `blinds` (tx.blinds): Venetian blinds

- **Use:** Noir / retro beats, office-humour sketches, time-of-day change.
- **Avoid:** Fast beat edits (too long).
- **Reasons:** PLACE, TIME. **Tags:** blinds, slats, retro, noir, graphic
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `count`=9, `vertical`=false, `gap`="#0A0A0A", `shade`=0.6
- **Sound:** `sfx/paper/flip` at start+0 f, -2 dB; `sfx/plastic/click` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/blinds.mp4) / [stills](renders/stills/blinds)

### `squeeze` (tx.squeeze): Squeeze (CRT collapse)

- **Use:** TV switch-off gag, retro channel change, comedic "nope".
- **Avoid:** Premium product and film scenes.
- **Reasons:** CONTRAST, PLACE. **Tags:** squeeze, crt, tv-off, retro, comedy
- **Timing:** 450 ms free-time (14 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `split`=0.012, `vertical`=false
- **Sound:** `sfx/tx/tape_stop` at start+0 f, -1 dB; `sfx/ui/blip` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/squeeze.mp4) / [stills](renders/stills/squeeze)

### `polkaDots` (tx.polkaDots): Polka-dot curtain

- **Use:** Playful reveals, kids / festive / mime-style spots.
- **Avoid:** Serious tone.
- **Reasons:** PLACE, REVEAL. **Tags:** dots, pop, playful, kids, mime
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `dots`=14, `center`=[0.5,0.5], `soft`=0.02
- **Sound:** `sfx/ui/pop` at start+0 f, +0 dB; `sfx/cartoon/boing_hi` at cut+1 f, -3 dB (playful alt)
- **Demo:** [16:9](renders/polkaDots.mp4) / [stills](renders/stills/polkaDots)

### `tvStatic` (tx.tvStatic): TV static

- **Use:** Channel-change gag, "meanwhile" cutaways, horror and retro beats.
- **Avoid:** Photosensitive audiences (keep it under 0.5 s); calm pieces.
- **Reasons:** CONTRAST, TIME. **Tags:** static, tv, noise, retro, interrupt
- **Timing:** 500 ms free-time (15 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `hold`=0.5, `roll`=1
- **Sound:** `sfx/tx/glitch_stutter` at start+0 f, -2 dB; `sfx/sizzle/grain` at start+0 f, -4 dB (static bed)
- **Demo:** [16:9](renders/tvStatic.mp4) / [stills](renders/stills/tvStatic)

### `burnOut` (tx.burnOut): Undulating burn-out

- **Use:** Memory endings, "this changes everything" drama, festival fire looks.
- **Avoid:** UI demos; bright white plates (rim disappears).
- **Reasons:** TIME, EMPHASIS. **Tags:** burn, fire, film, analog, drama
- **Timing:** 900 ms free-time (27 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `center`=[0.5,0.5], `color`="#FF6A1A", `wave`=0.35, `glow`=1
- **Sound:** `sfx/tx/film_burn` at start+0 f, +0 dB; `sfx/sizzle/grain` at start+0 f, -4 dB
- **Demo:** [16:9](renders/burnOut.mp4) / [stills](renders/stills/burnOut)

### `dreamyZoom` (tx.dreamyZoom): Dreamy zoom

- **Use:** Lifestyle, wedding and travel reels; dream sequence entries.
- **Avoid:** Hard-sell ads and explainers.
- **Reasons:** TIME, LINK. **Tags:** dream, zoom, soft, wedding, lifestyle
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `rot`=6, `scale`=1.25, `glow`=0.35
- **Sound:** `sfx/lift/inhale` at start+0 f, -2 dB; `sfx/sparkle/shimmer` at cut+0 f, -2 dB
- **Demo:** [16:9](renders/dreamyZoom.mp4) / [stills](renders/stills/dreamyZoom)

### `linearBlur` (tx.linearBlur): Linear (directional) blur

- **Use:** A gentler whip that keeps the frame in place; vertical angle for 9:16 feeds.
- **Avoid:** When the cut should be felt.
- **Reasons:** PLACE, ENERGY. **Tags:** blur, motion, speed, soft
- **Timing:** 400 ms free-time (12 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `amount`=0.12, `angle`=0
- **Sound:** `sfx/whoosh/swish_xs` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/linearBlur.mp4) / [stills](renders/stills/linearBlur)

### `gridFlip` (tx.gridFlip): Grid flip (tiles)

- **Use:** Portfolio and catalogue reels, "many becomes one" reveals.
- **Avoid:** Short windows (needs >= 20 frames to read).
- **Reasons:** PLACE, REVEAL. **Tags:** grid, tiles, flip, mosaic, ui
- **Timing:** 900 ms free-time (27 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `grid`=[6,4], `rand`=0.4, `gap`=0.06, `bg`="#0A0A0A"
- **Sound:** `sfx/paper/flip` at start+0 f, -1 dB; `sfx/ui/tick` at cut+0 f, -4 dB (optional ticks)
- **Demo:** [16:9](renders/gridFlip.mp4) / [stills](renders/stills/gridFlip)

### `bookFlip` (tx.bookFlip): Book page flip

- **Use:** Storybook chapters, "next chapter", explainers framed as a book.
- **Avoid:** Fast edits; 9:16 (the spine splits the subject).
- **Reasons:** TIME, PLACE. **Tags:** book, page, story, chapter, paper
- **Timing:** 900 ms free-time (27 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutCubic`
- **Params:** `bend`=0.18, `shadow`=0.45
- **Sound:** `sfx/paper/flip` at start+0 f, +1 dB
- **Demo:** [16:9](renders/bookFlip.mp4) / [stills](renders/stills/bookFlip)

### `pinwheel` (tx.pinwheel): Pinwheel wipe

- **Use:** Retro / cartoon scene changes, kids content.
- **Avoid:** Serious tone.
- **Reasons:** PLACE, ENERGY. **Tags:** pinwheel, wipe, retro, playful, cartoon
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `blades`=6, `center`=[0.5,0.5], `soft`=0.02
- **Sound:** `sfx/whoosh/whoosh_m` at start+0 f, +0 dB; `sfx/cartoon/zip_run` at cut+0 f, -3 dB (cartoon alt)
- **Demo:** [16:9](renders/pinwheel.mp4) / [stills](renders/stills/pinwheel)

### `radial` (tx.radial): Radial (clock) wipe

- **Use:** "Later that day", countdowns, deadline beats.
- **Avoid:** More than once per piece.
- **Reasons:** TIME, PLACE. **Tags:** clock, radial, wipe, time, countdown
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `center`=[0.5,0.5], `start`=0, `soft`=0.02, `ccw`=false
- **Sound:** `sfx/ui/tick` at start+0 f, -2 dB; `sfx/whoosh/swish_s` at cut+1 f, +0 dB
- **Demo:** [16:9](renders/radial.mp4) / [stills](renders/stills/radial)

### `waterDrop` (tx.waterDrop): Water drop

- **Use:** Beverage, skincare and wellness pieces; calm reveals.
- **Avoid:** Hype edits.
- **Reasons:** REVEAL, LINK. **Tags:** water, drop, liquid, calm, wellness
- **Timing:** 800 ms free-time (24 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `outQuad`
- **Params:** `amp`=30, `speed`=30, `center`=[0.5,0.5]
- **Sound:** `sfx/liquid/drip` at start+0 f, +1 dB; `sfx/liquid/splash` at start+2 f, -4 dB (big drop alt)
- **Demo:** [16:9](renders/waterDrop.mp4) / [stills](renders/stills/waterDrop)

### `wind` (tx.wind): Wind (streaked wipe)

- **Use:** Season and travel changes; "blown away" beats.
- **Avoid:** Text frames.
- **Reasons:** PLACE, TIME. **Tags:** wind, streak, wipe, travel, season
- **Timing:** 600 ms free-time (18 f @30), 1 beat(s) on a grid (15 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `size`=0.2, `rows`=160, `dir`=[1,0]
- **Sound:** `sfx/amb/wind` at start+0 f, -6 dB; `sfx/whoosh/whoosh_l` at cut+0 f, -1 dB
- **Demo:** [16:9](renders/wind.mp4) / [stills](renders/stills/wind)

### `luminanceMelt` (tx.luminanceMelt): Luminance melt

- **Use:** Music videos, surreal art beats, "the old way melts away".
- **Avoid:** Explainers and UI.
- **Reasons:** TIME, CONTRAST. **Tags:** melt, drip, surreal, art, music
- **Timing:** 1000 ms free-time (30 f @30), 2 beat(s) on a grid (30 f @120 BPM), swap at p=0.5, ease `inOutQuad`
- **Params:** `drip`=0.4, `dark`=false
- **Sound:** `sfx/liquid/glug` at start+0 f, -2 dB; `sfx/tx/morph_warble` at cut+0 f, -3 dB
- **Demo:** [16:9](renders/luminanceMelt.mp4) / [stills](renders/stills/luminanceMelt)

### `overexposure` (tx.overexposure): Overexposure blow-out

- **Use:** Memory, revelation, sunlit lifestyle; a softer dip-to-white.
- **Avoid:** Stacking with flash; more than one per 10 s.
- **Reasons:** TIME, EMPHASIS. **Tags:** exposure, white, heaven, memory, bright
- **Timing:** 700 ms free-time (21 f @30), 1.5 beat(s) on a grid (23 f @120 BPM), swap at p=0.5, ease `linear`
- **Params:** `strength`=0.85, `tint`="#FFF6E8"
- **Sound:** `sfx/tx/flash_swell` at start+0 f, +0 dB; `sfx/sparkle/shimmer` at cut+0 f, -2 dB
- **Demo:** [16:9](renders/overexposure.mp4) / [stills](renders/stills/overexposure)

<!-- END CATALOG -->
