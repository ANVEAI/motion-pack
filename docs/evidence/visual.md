# Visual research: finishing layers, camera, type, objects, characters, stacking rules, inventory, gaps

Date: 2026-10-13. Scope: what the pack must build for the VISUAL side, with component names,
parameters and default values; plus a precise inventory of what we already own.

Tags used on numbers:
- `[kit]` = read directly from our working code (verified in this run, file named).
- `[tune]` = a researched starting value (physics, practice or arithmetic shown). The builder must confirm it with the
  component's demo and the measurement named in section 11. Nothing tagged `[tune]` has been rendered yet.
- Sources (section 12) are cited from knowledge; no web page was fetched in this run.

---------------------------------------------------------------------------------------------------------------------

## 0. The ten decisions this research makes

1. **Two renderers, one preset.** Every finishing effect is specified once as a JSON preset and implemented three ways
   with parity tests: (a) GLSL chunks for the three.js studio kit and any WebGL page, (b) a transparent-canvas/SVG
   overlay layer for HyperFrames DOM compositions, (c) an ffmpeg filtergraph builder (`finish.py`) that finishes any
   rendered MP4. The ffmpeg finisher is the default for "premium" output because HyperFrames DOM cannot read its own
   pixels (halation, bloom threshold, chromatic aberration and a 3D LUT all need the frame).
2. **Render clean plates, finish in post.** This is what ANVE's launch film already does (`notype=1` plates, type overlaid
   later). The pack makes it the standard: `plate` (picture only) + `type` (alpha) + `brand` (alpha, exact colour)
   -> finisher -> encode.
3. **Colour grade = ASC CDL + split-tone + fade**, one closed-form function. It is emitted as a 33^3 `.cube` (ffmpeg
   `lut3d`), as GLSL (three.js) and as an SVG `feComponentTransfer` filter (HyperFrames DOM). Genre grades are 14 JSON
   presets (section 3.13).
4. **One bloom, one vignette, one grain per frame, always.** The kit already bakes bloom (emissive-only) and a vignette
   and grain. The finisher must know what the plate already contains (`plate.baked = {bloom, vignette, grain}`).
5. **All pixel quantities are in PX units** (`PX = min(W,H)/1080`, as the kit does) so 1080p, 4K and 9:16 match.
6. **Determinism is a hard requirement.** Every random thing is `hash(seed, frameIndex, i)` (PCG, as in the kit's `rnd`),
   never `Math.random`, never wall clock. Camera shake is a closed-form sum of sines of `t`.
7. **Stylised characters read premium** with: volume-preserving squash, one sharp feature at most, big glossy eyes with
   two catchlights, wrap-lit soft skin, bevelled everything, 7% overshoot, 3 to 5 frame anticipation, and a "moving
   hold" (never a dead pose). The pack builds an original procedural 3D character (`Pip`), not a lookalike of any
   existing mascot (commercial mascots are protected designs: build the pantomime grammar, not the design).
8. **Camera presets are functions of t** returning the kit's camera contract plus `roll` and `shake`; the same names exist
   for 2D (matrix3d for HyperFrames DOM).
9. **Retention is a visual scheduler**, not an effect: punch-in cadence, pattern-interrupt cadence, safe-zone overlay,
   loopable endings (section 9). Numbers are practitioner heuristics (`[tune]`), to be checked against real retention curves.
10. **Owned vector sticker/scribble pack** replaces emoji and registry social cards (Apple Color Emoji is OS-licensed;
    registry items are remote and we may not vendor them).

---------------------------------------------------------------------------------------------------------------------

## 1. INVENTORY (precise)

### 1.1 Toolchain facts (checked in this run)

| fact | value |
|---|---|
| Machine | Apple M3 Pro, ANGLE Metal, Chrome 154 `[kit README]` |
| Node | v22.23.2 |
| ffmpeg | 8.0.1. Encoders: libx264, libx265, hevc_videotoolbox, prores, prores_ks, prores_videotoolbox, aac, aac_at. **No libass, no drawtext** (known) |
| ffmpeg filters present | lut3d, haldclut, haldclutsrc, curves, colorchannelmixer, colorbalance, colorlevels, colorcorrect, colorcontrast, colortemperature, vibrance, eq, hue, lutrgb, lutyuv, geq, rgbashift, chromashift, lenscorrection, vignette, noise, gblur, avgblur, boxblur, unsharp, convolution, blend, overlay, premultiply, unpremultiply, tmix, tblend, minterpolate, zoompan, perspective, rotate, shear, scale2ref, pad, crop, deflicker, tonemap, colorkey, chromakey, tpad, format, fps |
| ffmpeg filters absent | vulkan/opencl filters (count 0), so no GPU filtergraph: the finisher is CPU (estimate 8 to 15 fps at 1080p for ~12 filters, **to be measured**) |
| Python that has everything | **Python 3.11.7 with numpy, scipy, PIL, numba** (the reference interpreter). A second interpreter (3.14.6) had numpy+PIL only, no scipy/numba: check which `python3` is first on PATH |
| Blender | **not installed**. The photoreal-box scripts (section 1.3) cannot run without it, so the pack does NOT depend on Blender; the box plates already rendered stay as assets |
| Not installed in any Python | cv2, imageio, moderngl, torch, skimage, colour: do not plan on them |
| HyperFrames | 0.8.142. Runtime adapters: GSAP (default), Lottie, three (`hf-seek`, `window.__hfThreeTime`, root `data-duration` mandatory), Anime.js, CSS, WAAPI, TypeGPU. Engine option `motionBlur`. HTML-in-canvas (`drawElementImage`) is auto-enabled in the renderer only |
| Fonts we own/ship | Manrope variable, IBM Plex Mono 500/600 (kit `fonts/`) |

### 1.2 Skills (read headers; REUSE, do not duplicate)

| skill | covers | what the pack takes from it | limit / gap |
|---|---|---|---|
| `hyperframes` (+`-core`,`-cli`) | entry point, composition contract (`data-*`, one paused GSAP timeline per composition, `window.__timelines`), `check`/`snapshot`/`render` loop, determinism bans | contract for every DOM component | no finishing stack; no grading |
| `hyperframes-animation` | 47 atomic `rules/` (spring-pop-entrance, kinetic-beat-slam, chromatic-glitch, depth-of-field-blur, motion-blur-streak, particle-burst, 3d-camera-flight, ambient-glow-bloom, svg-path-draw ...), 22 `blueprints/`, 13 CSS transition families (`transitions/css-*.md`), 7 adapters, `references/motion-blur.md` | reuse the rule names as the type/camera vocabulary; call, do not rewrite | rules are DOM/GSAP recipes (docs), not importable code; no shaders owned by us |
| `hyperframes-creative` | design.md/frame.md, 9 palettes, ~13+ frame-presets, 8 visual styles (Swiss Pulse, Velvet Standard, Deconstructed, Maximalist Type, Data Drift, Soft Signal, Folk Frequency, Shadow Cut), `contrast-report.mjs`, `audio-reactive.md`, `beat-direction.md` | style -> grade/finish-preset mapping (section 8); contrast checker for text legibility | no finishing look attached to any style |
| `hyperframes-registry` | remote catalogue (~400 items): `grain-overlay`, `shimmer-sweep`, `vignette`, `light-leak` + 13 other shader transitions, 17 `caption-*`, social cards, liquid glass | **knowledge of what exists** only | **remote, not ours: do not vendor.** The pack ships owned equivalents of grain, vignette, light leak, shimmer, motion-blur component |

### 1.3 Working pipelines and code (ANVE's launch-film kit: v9 studio / v10 set)

| path | what it is | reuse as | known limits |
|---|---|---|---|
| v9 studio `kit/` (`core.js` 203 lines, `props.js` 319, `util.js` 68, `type.js` 37, `presets.js` 32, `studio.js` 16, `fonts/`, `README.md`) | three.js miniature-studio kit. **Post chain [kit core.js:41-78]:** HDR scene RT (MSAA 4) -> depth-aware 36-tap golden-angle DOF (`dofK 60`, `dofMax 3.5`) -> 6-level dual-filter bloom **sourced from emissive-only pass** (`bloom 0.85`) -> comp: white balance + exposure + C1 shoulder (`shoulder 0.90`) + elliptical vignette (`vignette 0.10`, smoothstep 0.35..1.414 in NDC) -> 4 jittered subframes averaged in linear light -> sRGB encode -> grain (PCG, triangular, `grain 0.02`, luma weight 0.55..1.0) -> TPDF dither (+-1/255) -> type overlay. Contract: `runScene({build, update, camera, focus, preRender, drawType, subframes})`; probes `__project/__mean/__bbox/__layout/__hashFrame`. Props: studio env, slab set, off-frame lights that click on, the product box, liquid-chrome blob (MarchingCubes SDF, 96^3), paper sheets, engraved readout, drum counter. Utilities: v8 eases `E.enter/exit/move/soft/cam/pop`, springs, flicker, Kelvin, smooth-min, seeded RNG | **vendor-copy into `studio3d/` once with a provenance header, then it is the pack's** (the film's kit stays frozen) | no halation, no chromatic aberration, no LUT/grade, no light leaks, no dust, no lens distortion, no letterbox; vignette is elliptical (stretches in 9:16); no characters; no generic props (phone, laptop, coin ...); camera has no roll/shake |
| v10 set (`set.html`, `kit/` copy, `src/{box,camera,clock,desk,logos,tl}.js`, `src/zones/{files,bill,tabs,wall,offices}.js`, `timelines/*.js`, `scripts/{probe.mjs,stills.sh}`) | **shared set + timeline-module system**: `?tl=<id>` loads a timeline (events in seconds, tracks with named eases `soft/cam/move/enter/exit/lin/step/pop`, camera key shots, room-light tracks `tension/solution/clicks`). 5 zones, the box with moves `place/drop/glide/travel` | the **timeline-module pattern** (declarative events -> closed-form state) is the template for every pack scene/character act | there is **no "character worker"** in the v10 set: grep for character/worker/human finds nothing. The only character is a raster one (below) |
| v9 `scripts/` | `sfx9.py` (primitives: tone, noise_burst, click, sparkle, bloom, low_body, svf, make_ir, convolve_st), `voices9.py` (component library of hit voices), `score8.py` (120 BPM A-minor->major score), `mix9.py` (masters), `make-tall.py` (16:9 -> 9:16 generator), `cutdown.py` (30 s/15 s edits), `verify9.py` (ffprobe, loudness, contact sheet, plate-frame PSNR) | input to `docs/research/sound.md`; `verify9.py` + `cutdown.py` patterns for delivery QA | audio side only here |
| launch-film `shared/` (`motion.js` 170, `box3d.js` 733, `film3d.js` 496, `teardown3d.js` 683, `ui-kit.css`) | v3-v8 motion library (cubic-bezier eases enter `.16,1,.3,1`, exit `.7,0,.84,0`, move `.65,0,.35,1`, hero `.22,1,.36,1`, pop `.34,1.56,.64,1`; `win()` in/out windows; shared cut grid `M.T`) | easing table is the canonical house easing set | DOM-era code, superseded by the studio kit for 3D |
| launch-film `blender/` (box model script, `hero8*.py`, `plate_*.py`, `render_plate.py`, `export_motion.mjs`, hero notes: no props, box + dark studio sweep) | Cycles photoreal box + plate exporter, motion JSON | **assets only** (the rendered plates) | cannot run: Blender not installed |
| an office-comedy series generator (internal, not included) | JSON script -> HyperFrames chat composition (sound hit per bubble, music hard-cut on punchline); thumbnail generator (PIL) | the **JSON-script -> composition generator** pattern for episodic content | |
| an office-comedy series character (internal, not included) | the only character: **raster** (image-model turnaround sheet: big head = 1/3 height, huge glossy eyes, round body) | style reference for "soft 3D-feature look" | not rigged, not ownable procedurally; cannot act. The pack's `Pip` is the owned, animatable alternative |

### 1.4 Remote registry (exists, NOT ours): what the owned pack replaces

`grain-overlay`, `vignette`, `shimmer-sweep`, `texture-mask-text`, 14 shader transitions (`light-leak`, `glitch`, `whip-pan`,
`cinematic-zoom`, `sdf-iris`, `domain-warp-dissolve`, `flash-through-white`, `ripple-waves`, `swirl-vortex`, `thermal-distortion`,
`gravitational-lens`, `cross-warp-morph`, `ridged-burn`, `chromatic-radial-split`), 17 `caption-*`, 7 social overlays, liquid glass (WebGPU,
needs canary Chrome), VFX shells. We may READ their names for vocabulary. Rule: write our own shader per name we need; cite
gl-transitions (gl-transitions.com, open-source GLSL transition collection) for IDEAS only; vendor nothing.

### 1.5 GAPS the pack must fill (visual side), mapped to components

| gap (nothing owned today) | component (section) | priority |
|---|---|---|
| Colour grade / LUT / genre looks | `fx/grade` (3.13) | P0 |
| Film grain with stock presets, size, chroma, temporal | `fx/grain` (3.6) | P0 |
| Aspect-aware vignette + natural falloff | `fx/vignette` (3.4) | P0 |
| Halation | `fx/halation` (3.2) | P0 |
| Threshold bloom for non-3D plates + diffusion | `fx/bloom`, `fx/diffusion` (3.1, 3.3) | P0 |
| Lateral chromatic aberration (static + hit envelope) | `fx/chroma` (3.5) | P0 |
| Light leaks | `fx/leaks` (3.8) | P1 |
| Dust, hair, scratches | `fx/dust` (3.7) | P1 |
| Gate weave + exposure flicker | `fx/weave` (3.9) | P1 |
| Lens distortion | `fx/lens` (3.10) | P2 |
| Letterbox / format masks | `fx/format` (3.11) | P0 (cheap) |
| CRT / VHS / glitch looks | `fx/retro`, `fx/glitch` (3.12) | P1 |
| ffmpeg finisher from preset | `finish.py` (2) | P0 |
| Camera presets incl. roll, shake, dolly zoom, whip | `cam/presets` (5) | P0 |
| Named kinetic-type presets, seek-safe | `type/presets` (4) | P0 |
| Generic premium props + materials | `obj/props`, `obj/materials` (6) | P1 |
| Owned animatable character + acts | `char/pip`, `char/acts` (6.3) | P1 |
| Layer-stack contract + lint | `comp/stack` (7) | P0 |
| Retention helpers (punch-in, interrupts, safe zones, Ken Burns) | `retention/*` (9) | P0 |
| Owned scribble/sticker/icon vectors | `icons/*` (4.3) | P1 |
| Box plates cannot be re-rendered (no Blender) | accept; pack stays Blender-free | note |

---------------------------------------------------------------------------------------------------------------------

## 2. Architecture of the finishing layer

```
plate.mp4  (clean picture; any source)            type.mov  (ProRes 4444 alpha, story type/captions)
   |                                                  |            brand.mov (alpha; exact-colour logo/CTA/legal)
   v                                                  v                |
 finish.py --preset <name>.finish.json --plate-baked bloom,vignette,grain? --aspect wide|tall
   F1 lens  F2 chroma  F3 bloom  F4 halation  F5 diffusion  F6 leaks  F7 grade  F8 vignette  F9 sharpen/weave/flicker
   -> composite type -> F10 dust -> F11 grain -> composite brand -> F12 format bars -> F13 dither -> encode
```

**Preset file** (`finish-presets/<name>.finish.json`), one schema for all three back-ends. Defaults are the "ad-clean" preset:

```json
{ "name": "ad-clean", "seed": 1, "px": "H/1080",
  "plate": { "baked": { "bloom": false, "vignette": false, "grain": false } },
  "lens":      { "on": false, "k1": 0.0, "k2": 0.0 },
  "chroma":    { "on": true,  "cornerPx": 1.0, "taps": 3, "hit": null },
  "bloom":     { "on": true,  "threshold": 0.85, "knee": 0.15, "levels": 5, "amount": 0.18 },
  "halation":  { "on": false, "threshold": 0.82, "sigmaPct": 1.8, "tint": [1.0, 0.30, 0.10], "amount": 0.35, "core": 0.15 },
  "diffusion": { "on": false, "sigmaPct": 0.8, "amount": 0.18, "lift": 0.01 },
  "leaks":     { "on": false },
  "grade":     { "look": "neutral-clean" },
  "vignette":  { "on": true, "amount": 0.10, "inner": 0.35, "outer": 1.0, "roundness": 0.6, "shape": "smooth" },
  "sharpen":   { "on": false, "px": 0.8, "amount": 0.35 },
  "weave":     { "on": false }, "flicker": { "on": false },
  "dust":      { "on": false },
  "grain":     { "on": true, "stock": "clean", "amount": 0.02, "sizePx": 1.0, "chroma": 0.0, "midBias": 0.45, "fps": 30 },
  "format":    { "bars": null },
  "dither":    { "on": true } }
```

Back-end capability matrix (what each one can do honestly):

| effect | GLSL (three.js kit) | HyperFrames overlay (DOM) | ffmpeg `finish.py` |
|---|---|---|---|
| bloom threshold / halation / diffusion | yes (reads frame) | no (needs frame): only via HTML-in-canvas, flagged | yes (split + gblur + blend) |
| chromatic aberration (radial) | yes | no | yes (per-plane `scale`+`crop`, `mergeplanes`) |
| grade | yes (closed form) | **yes: SVG filter on a wrapper div** (`feComponentTransfer` gamma = CDL slope/offset/power; `feColorMatrix saturate`) | yes (`lut3d`) |
| vignette, grain, dust, leaks, scratches, bars | yes | **yes** (transparent canvas + `mix-blend-mode` multiply/screen/soft-light) | yes (plate overlays + `blend`) |
| lens distortion | yes | CSS 3D only (approximate) | yes (`lenscorrection`) |

Rule: HyperFrames overlay back-end is the FAST PREVIEW and the path for simple pieces (grade + vignette + grain + leaks + dust);
anything "premium" or lens-physical goes through `finish.py`. Parity test: mean luma of the 5 reference frames differs by <= 2/255
between back-ends for the same preset (section 11).

ffmpeg graph mechanics (so the builder does not rediscover them):
- Work in `format=gbrp16le` (or `gbrp12le` if a filter refuses 16-bit); final `format=yuv420p10le` for HEVC or `yuv420p` for x264 after dither.
- Pre-rendered **plates** generated by numpy with the seeded PCG hash, written once to `build/plates/` (never committed): grain
  (1080p, 48 frames, FFV1 gray, ~1.6 MB/frame so ~77 MB each: regenerate on demand), dust, leaks. Loop with `-stream_loop -1`.
  Use `crop` with an expression offset `x='mod(n*37,iw-W)'` so the 48-frame loop does not repeat visibly.
- Overlay-type blend: grain via `blend=all_mode=overlay` on a 128-centred plate at `all_opacity` = amount * 3 `[tune]`; leaks via
  `blend=all_mode=screen`; vignette via a pre-rendered radial plate with `blend=all_mode=multiply`.
- Halation / bloom: `split=2[a][b]; [b]lutrgb=r='if(gt(val,T),val,0)':...,gblur=sigma=S:steps=3,colorchannelmixer=...[g]; [a][g]blend=all_mode=screen:all_opacity=A`.

---------------------------------------------------------------------------------------------------------------------

## 3. Finishing layers (component by component)

Order = the order in section 7. Pixel units are PX (`H/1080`). "kit" = value in the studio kit's code.

### 3.1 `fx/bloom` (threshold bloom; for non-3D plates) and kit emissive bloom

- Kit (3D): dual-filter pyramid, 6 levels, source = emissive-only pass, weight `0.85`, up-sample mix `uW 0.5` `[kit]`. Keep for 3D scenes; set `plate.baked.bloom = true`.
- Pack (any plate): luma threshold `0.85` display (soft knee `0.15`), 5 levels, `amount`: subtle 0.18 / dreamy 0.45 / neon 0.70 `[tune]`.
  Two-radius sum is what reads "real": 0.65 * (sigma 0.6% H) + 0.35 * (sigma 3% H) `[tune]`.
- Tint: bloom inherits the source hue; add `tint` [1,1,1] default, warm [1.0,0.92,0.80] for golden-hour look.
- Never bloom type or UI (they are composited after F3 anyway). Pitfall: bloom on near-white UI cards makes a grey fog: clamp bloom
  input to `min(luma-T, 0.4)` for white cards (`flat white` guard `[tune]`).

### 3.2 `fx/halation`

Physics: light passing the film base reflects off the pressure plate and re-exposes the emulsion, giving a warm red-orange fringe
around bright highlights (stronger in the red-sensitive layer). Implementation:

| param | default | range | note |
|---|---|---|---|
| `threshold` | 0.82 (display luma) | 0.7 to 0.95 | soft knee 0.10 |
| `sigmaPct` | 1.8 (% of H, = 19.4 px at 1080p) | 1.0 to 3.5 | large lobe |
| `core` | 0.15 | 0 to 0.3 | second lobe sigma 0.4% H (4.3 px), weight 0.3 vs 0.7 for the large lobe |
| `tint` | [1.0, 0.30, 0.10] | | pink variant [1.0,0.25,0.35] for cyber-night |
| `amount` | 0.35 (subtle 0.2, heavy 0.6) | 0 to 0.8 | add/screen before grade |

ffmpeg: luma-times-tint via `colorchannelmixer=rr=.30:rg=.59:rb=.11:gr=.09:gg=.177:gb=.033:br=.03:bg=.059:bb=.011` (luma * [1,.30,.10]),
then `gblur=sigma=19:steps=3`, then `blend=all_mode=screen:all_opacity=0.35`.

### 3.3 `fx/diffusion` (Pro-Mist style softness)

`mist = gblur(plate, sigma 0.8% H)`; `out = plate + amount * max(mist - plate*0.5, 0)` highlight-weighted; `amount 0.18`; lift blacks by
`0.01`. Use for beauty/lifestyle/pastel grades. Off for UI-heavy ads (soft text = legibility loss).

### 3.4 `fx/vignette` (+ `lensFalloff`)

- Kit: `c *= 1 - 0.10 * smoothstep(0.35, 1.4142, length(ndc))` `[kit]`. **Elliptical**: in 9:16 the shape stretches. Pack fixes with
  `roundness` r in 0..1: `p = ndc * mix(vec2(1.0), vec2(aspect, 1.0) / max(aspect, 1.0), r)` (for 9:16 `aspect < 1` use `vec2(1.0, 1.0/aspect)/max(1.0, 1.0/aspect)`), then `length(p)` is normalised so the corner stays 1.4142; default `r = 0.6` (blend between ellipse and circle).
- Presets: `subtle` 0.10 (kit) / `cinema` 0.22 / `heavy` 0.38 / `spotlight` 0.55 with `inner 0.20` `[tune]`.
- `shape: 'cos4'`: natural lens falloff `cos^4(theta)`, `tan(theta) = r * tan(hfov/2)`; it is negligible at the kit's 18 deg fov (corner
  factor ~0.99) and 0.43 at 60 deg, so apply only when the camera fov is wide `[tune]`, derived arithmetic.
- Colour: vignette multiplies in linear before grade for `lensFalloff`, after grade for the artistic one. Never pure black corners on
  bright brand backgrounds: floor `1 - amount >= 0.55`.

### 3.5 `fx/chroma` (lateral chromatic aberration)

- Model: R scaled by `(1 + e)`, B by `(1 - e)` about the frame centre; `e = cornerPx / halfDiag` (`halfDiag = 1101 px` at 1080p 16:9). Defaults: `cornerPx 1.0` (ad-clean), `2.0` (cinema; `e = 0.00182`), `4.0` (dream/lo-fi) `[tune]`.
- Spectral taps: 3 taps up to 2 px, 7 taps beyond (spectral weights, avoids 3-ghost banding). Keep G sharp, always.
- **Hit envelope** `chroma.hit = { frame, peakPx: 10, attack: 1, decay: 8 }` (px at the corner, exponential decay `exp(-k/ (decay/3))`)
  for beat hits, cuts and whips. This is the single most-used "energy" effect in music edits: keep it to the hit frames only.
- Radial only. Glitch-style horizontal RGB split belongs to `fx/glitch` (3.12).
- ffmpeg: `extractplanes=r+g+b`, `scale` R to `iw*(1+2e)`, G to `iw*(1+e)`, B unchanged, centre-`crop` each to WxH, `mergeplanes`. (`rgbashift` is uniform shift, not radial: use only for the glitch look.)

### 3.6 `fx/grain`

Kit grain: `g = rnd(px,seed) + rnd(px,seed+7919) - 1` (triangular, sigma 0.408), `c += g * 0.02 * (0.55 + 0.45*(1 - |2L - 1|))`, new seed per frame, 1 px,
mono, in sRGB-encoded space `[kit core.js:73]`. So the kit's sigma at mid-grey is about 0.0082 (about 2.1/255).

Pack presets (amount in kit units: peak amplitude; sigma ~ 0.41 * amount * weight):

| stock | amount | sizePx | chroma | midBias | fps | use |
|---|---|---|---|---|---|---|
| `clean` | 0.020 `[kit]` | 1.0 | 0 | 0.45 | 30 | ads, UI, product |
| `digital-soft` | 0.035 | 1.2 | 0.10 | 0.40 | 30 | talking head, lifestyle |
| `film35` | 0.070 | 1.4 | 0.35 | 0.55 | 24 | cinema, short film |
| `film16` | 0.110 | 1.8 | 0.45 | 0.60 | 24 | indie / nostalgia |
| `super8` | 0.160 | 2.4 | 0.55 | 0.65 | 18 | home-movie flashback |
| `vhs` | 0.090 | 1.6 | 0.80 (chroma noise lines) | 0.30 | 30 | retro |

- Size > 1 px: generate white noise at `1/sizePx` resolution, bilinear-upsample, renormalise to unit variance (cheap, no blur kernel).
- `chroma c`: `n_rgb = (1-c) * n_mono + c * (n_r, n_g, n_b)` independent.
- `fps`: seed = `floor(n * grain.fps / videoFps)` so 24-look on a 30 fps deliverable holds each pattern 1.25 frames (use 6-on-5).
- **Compression survival** `[tune]`: x264 at CRF 16 keeps it; platform re-encodes (IG/TikTok/YouTube) smear fine 1 px grain. For uploads use
  `sizePx >= 1.4` and amount x 1.5. Never put grain on flat brand colour fields or gradients in the CRF-heavy delivery (banding/pumping): `midBias` drops weight in
  the top 5% luma already; additionally mask grain by `1 - smoothstep(0.92,1.0,L)`.
- Measure: render a flat 50% grey plate through the preset; sigma of the output luma must equal the table within +-15%.

### 3.7 `fx/dust` (specks, hair, scratches)

All driven by `hash(seed, frame, i)`. Values for 1080p, `density 1.0`:

| element | count / frame | size | alpha | life | notes |
|---|---|---|---|---|---|
| specks | 6 to 14 (`density` scales) | 1 to 4 px, log-normal | 0.25 to 0.8 | 1 frame (90%), 2 frames (10%) | white on dark scenes, dark on bright (choose by local plate luma) |
| hair | 0.3 per second | one quadratic Bezier 40 to 120 px | 0.35 | 4 to 12 frames, wiggles 1 px | rare = realistic |
| vertical scratch | 0 to 2 | 1 px wide, full or partial height | 0.12 to 0.30 | 2 to 8 frames, x stable then jumps | `scratch.rate 0.5/s` |
| gate edge dirt | static | corner blobs | 0.08 | whole clip | optional |

Default `density`: 0.0 (ads), 0.4 (filmic), 1.0 (nostalgia). Dust sits ABOVE story type, BELOW brand layer.

### 3.8 `fx/leaks` (light leaks)

Procedural, closed-form: `leak(x,y,t) = sum_i A_i(t) * G(p - c_i(t), sigma_i) * colour_i`, 3 to 5 anisotropic soft blobs entering from an edge.

| param | default |
|---|---|
| `seed` | 7 |
| `count` | 3 |
| `colors` | `#FF6A1A, #FFB347, #E8336D` (add `#2FB8C8` for cyber) |
| `sigma` | 0.25 to 0.55 of H (blob), stretched 1.8x along the entry edge |
| `drift` | 0.06 frame-widths per second, sinusoidal |
| `edge` | `left` / `right` / `top` / `any` |
| `intensity` | 0.6 (screen blend), 1.0 for transition flashes |
| `envelope` | `{in: 0.5 s, hold: 1.0 s, out: 1.0 s}`, ease `soft` |
| transition use | `flash: {frame: cutFrame, attack: 3, decay: 12}` peak ON the cut frame (hides the cut) |

Screen blend in linear (GLSL) or `mix-blend-mode: screen` (DOM, gamma space: reduce intensity by about 25% `[tune]`). Pairs with `film35` grade and
`halation`; do not combine with `chroma.hit` on the same frame unless it is the designated "hit".

### 3.9 `fx/weave` and `fx/flicker`

- Weave: translate `x,y` = low-passed noise, amplitude **0.15% of W** (about 3 px at 1920) at 1 to 3 Hz + per-frame jitter **0.5 px**; rotation `+-0.05 deg`; scale `1.012` to hide edges `[tune]`. Apply to plate only (type stays steady, section 7).
- Flicker: exposure multiplier `1 + 0.012 * n(frame)` band-limited (the kit's own click flicker `[0.95, 0.12, 0.70]` is a narrative effect, not this).
- Default off for ads/launch; on for `filmic` and `nostalgia`.

### 3.10 `fx/lens` (barrel/pincushion)

`r' = r * (1 + k1 r^2 + k2 r^4)`, `k1 = -0.04` (gentle barrel for wide handheld looks), `k2 = 0`. ffmpeg `lenscorrection=k1=-0.04:k2=0`. Crop-scale by `1/(1 + k1*r_corner^2)` to avoid empty corners. Default off; on for `handheld-doc`, GoPro-style POV (k1 -0.18).

### 3.11 `fx/format` (bars and safe masks)

| format | visible height at 1920x1080 | bar each |
|---|---|---|
| 2.39:1 | 804 | 138 px |
| 2.00:1 | 960 | 60 px |
| 1.85:1 | 1038 | 21 px |

Bars are pure black ABOVE grain (outside the image). Animated reveal (bars in from 0 to full over 24 frames, ease `cam`). **Never letterbox 9:16**
(wasted pixels; use a taller, tighter crop). Safe-zone overlay: section 9.

### 3.12 `fx/retro` (CRT, VHS) and `fx/glitch`

- CRT: scanlines pitch `3 px`, depth `0.18`, phosphor bloom `0.30`, barrel `k1 0.06`, RGB mask optional, flicker 0.02.
- VHS: chroma blur 4 px horizontally (U/V only), luma softness 0.6 px, black lift `0.08`, tracking-noise band (height 18 px, scrolls 40 px/s, appears 5% of frames), head-switch noise last 8 lines, sat `0.8`, magenta bias in highlights.
- Glitch: 3 to 5 horizontal slice displacements (+-8 to +-60 px, 2 to 6 frames), RGB split +-6 px (`rgbashift` in ffmpeg or a shader), 10% frame-hold; **trigger on a beat/cut only**, not continuous; duration 4 to 8 frames; max 1 glitch per 2 s.

### 3.13 `fx/grade` (LUT-style grades by genre)

Model (one function, three emitters): `exposure (stops) -> white balance (temp K shift, tint) -> contrast S-curve about pivot 0.46 -> ASC CDL per channel
out = clamp(in*slope + offset)^power -> saturation about Rec.709 luma -> split-tone (shadow hue/sat, highlight hue/sat, balance) -> fade (black lift) -> clamp`.
CDL is the open ASC standard, so every NLE can read the values. Emitters: `grade.py` -> 33^3 `.cube` (identity test: max deviation < 1/255); GLSL `grade()`; SVG filter.

Starting presets (`[tune]`; each must be eyeballed on the 5 reference frames and on skin tones, then frozen):

| look | CDL slope (R,G,B) | power | sat | contrast | split-tone (shadow hue/sat -> highlight hue/sat) | fade | pairs with |
|---|---|---|---|---|---|---|---|
| `neutral-clean` (ads, UI, product) | 1.00,1.00,1.00 | 1.00 | 1.04 | 0.08 | none | 0 | grain clean |
| `studio-warm` (launch film: warm paper, soft shoulder) | 1.01,1.00,0.985 | 0.98 | 0.98 | 0.06 | none | 0 | kit-baked bloom |
| `teal-orange` (blockbuster) | 1.04,1.00,0.96 | 1.00 | 1.08 | 0.22 | 195 deg / 0.22 -> 28 deg / 0.18 | 0.01 | film35, halation |
| `bleach-bypass` (gritty, thriller) | 1.00,1.00,1.00 | 1.04 | 0.55 | 0.35 | none | 0 | film16 (blend 40% of a desaturated, contrast copy) |
| `pastel-dream` (soft lifestyle) | 1.02,1.00,1.02 | 0.92 | 0.90 | -0.05 | none -> 340 deg / 0.08 | 0.06 | diffusion, bloom 0.45 |
| `golden-hour` | 1.06,1.00,0.90 | 0.98 | 1.05 | 0.12 | 25 deg / 0.10 -> 40 deg / 0.15 | 0.01 | leaks left, halation |
| `cyber-night` | 0.96,1.00,1.06 | 1.02 | 1.15 | 0.30 | 215 deg / 0.30 -> 320 deg / 0.25 | 0 | halation pink, chroma 2 px |
| `kodak-warm-35` (stock-flavoured, stylised) | 1.03,1.00,0.94 | 1.00 | 1.08 | 0.20 | 160 deg / 0.06 -> 35 deg / 0.10 | 0.02 | film35, weave, dust 0.4 |
| `fuji-cool-green` | 0.98,1.02,1.00 | 1.00 | 1.02 | 0.18 | 145 deg / 0.10 -> 330 deg / 0.06 | 0.02 | film35 |
| `vhs-90s` | 1.02,0.98,1.02 | 0.96 | 0.80 | 0.05 | 300 deg / 0.08 -> 40 deg / 0.06 | 0.08 | vhs grain, CRT |
| `toon-saturated` (cartoon, mime-style spots) | 1.00,1.00,1.00 | 1.00 | 1.25 | 0.12 | none | 0 | no grain, bloom 0.15 |
| `documentary-neutral` (talking head) | 1.02,1.00,0.98 | 1.00 | 1.00 | 0.10 | none | 0 | digital-soft; protect skin: cap saturation gain on hues 10 to 40 deg at 1.05 |
| `mono-ink` (B/W) | luma 0.30,0.59,0.11 (red-filter variant 0.55,0.35,0.10) | 1.05 | 0 | 0.30 | none | 0.01 | film16 gritty |
| `hype-pop` (shorts/energy) | 1.00,1.00,1.00 | 1.00 | 1.20 | 0.25 | none -> cyan 190 deg / 0.05 | 0 | unsharp 0.4, chroma hit on beats |

Rule: ONE grade per piece (per scene at most 2, with a 12-frame crossfade); grade after leaks and before vignette; footage clips are first
normalised by an automatic grade-correction pass (capped +-8%) so the creative grade starts from matched inputs.

### 3.14 `fx/sharpen`

`unsharp` radius 0.8 px, amount 0.35 (hype/talking head), 0 for 3D plates (the supersampled kit plate is already clean; sharpening adds ringing on type edges). Run BEFORE grain, never after.

### 3.15 Beat-reactive fx envelope helper (`fx/envelope`)

`env(t; hits[], attack=1f, decay=8f, curve='exp')` returns 0..1; used by `chroma.hit`, `leaks.flash`, `bloom.pulse`, camera `punch`, `flicker`. Baseline always low,
hit spikes: one energy spike per beat max; on a 120 BPM grid (15 frames per beat at 30 fps) allow a spike every 2nd beat in verses and every beat only in a drop.

---------------------------------------------------------------------------------------------------------------------

## 4. Kinetic type presets (visual layer) — `type/presets`

Units: frames at 30 fps. Easing names are the house set (`E.enter` .16,1,.3,1; `E.hero` .22,1,.36,1; `E.move` .65,0,.35,1; `E.exit` .7,0,.84,0;
`E.pop` .34,1.56,.64,1 `[kit/shared motion.js]`). Every preset is a pure function `state(t) -> {x,y,scale,rotX,opacity,clip,track,wght,blur}`, seek-safe,
usable from GSAP (`tl.set` per frame via a proxy) and from the three.js overlay canvas. Fonts: Manrope variable (wght 200..800) is already available.

### 4.1 Presets

| id | recipe (defaults) | tone cell | reuse |
|---|---|---|---|
| `slam` | scale 1.35 -> 1.00 in 6 f, `E.enter`; screen shake 8 px decaying over 4 f; motion blur on the first 2 f; hold >= 9 f; one word per beat | Kinetic+Sharp | `rules/kinetic-beat-slam` |
| `rise` | per word: y +0.6 em -> 0 inside a clip mask, 14 f, `E.hero`; stagger 4 f/word (2 f/char for headlines of <= 12 chars) | Calm+Sharp | `rules/waterfall-entry` |
| `wipe` | `clip-path: inset(0 100% 0 0)` -> `inset(0)` 12 f, `E.move`; exit reversed in 8 f | Neutral | |
| `weight-morph` | `wght 300 -> 800` over 18 f `E.hero`, tracking -0.01 em; reads "emphasis" | Calm+Sharp | |
| `tracking-collapse` | letter-spacing 0.35 em -> 0 + opacity 0 -> 1, 20 f, ease-out expo; the premium title card | Calm+Soft | |
| `flip-split` | rotateX -90 -> 0 per line, perspective 900 px, stagger 3 f, `E.enter` | Kinetic+Sharp | `rules/hacker-flip-3d` |
| `elastic-pop` | spring omega = 2 pi * 2.6 Hz, zeta 0.38 (about 24% overshoot) -> use only for playful; for house style cap at the 7% overshoot `[kit]` | Kinetic+Soft | `rules/spring-pop-entrance` |
| `typewriter` | 2 f per char, caret blink 15 f period, +6 f pause after `. , ?` | Neutral | `blueprints/typewriter-reveal` |
| `scramble` | glyph swaps for 8 f (seeded `hash(frame,charIdx)`), resolve left->right at 1.2 f/char | techy | |
| `outline-fill` | stroke draw 18 f (dashoffset), fill fades in 8 f | Calm+Sharp | `rules/svg-path-draw` |
| `extrude3d` | TextGeometry (a TTF-to-typeface converter bakes the font), bevel 3% of cap height, camera orbit 12 deg, depth 0.18 em | hero title | `rules/3d-text-depth-layers` |
| `karaoke` | active word scale 1.00 -> 1.12 in 4 f + accent colour, inactive opacity 0.55; timing from the transcript | captions | the caption theme owns the styling |
| `lower-third` | bar wipe 10 f, name slide 12 f offset 4 f, hold >= 60 f, out in 8 f (exits faster than entrances) | broadcast | |
| `count-up` | ease-out expo to value over 40 f, tabular figures, **no overshoot on quantities** | data | `rules/counting-dynamic-scale` |
| `glitch-split` | RGB offset +-8 px, 3 slice bands, 6 f, trigger on a hit only | Deconstructed | `rules/chromatic-glitch` |

### 4.2 Type rules (numbers)

- Minimum sizes at 1080p: headline font-size >= 96 px, sub >= 40 px, label >= 28 px (16:9) / 30 px (9:16) `[kit FLOORS]`; 9:16 captions 64 to 80 px, max 2 lines, <= 18 characters per line.
- Contrast: text vs measured background >= 4.5:1 after the grade (use `hyperframes-creative/scripts/contrast-report.mjs`). Add a scrim or stroke only when the report fails: stroke = 6% of font-size, or shadow blur 12 px at 60% black `[tune]`.
- Hold time (single card): `max(0.5 s, 0.35 + 0.28 * words)`; never fewer than 9 frames fully formed. Hype edits: <= 3.5 words/s.
- Entrances decelerate, exits accelerate and are 30% faster than the entrance. One kinetic style per piece; two at most.
- Type is NEVER under bloom/halation/chroma unless the type is in-world (a sign); story type is above F9 (section 7), brand type above grain.

### 4.3 Owned vector pack (`icons/*`)

Needed because emoji fonts are OS-licensed and registry items are remote. Draw our own, as path data with a seeded wobble generator:
`scribble-underline`, `scribble-circle`, `scribble-arrow` (3 curvature variants), `burst` (8/12 point), `check`, `cross`, `star`, `heart`, `spark` (4-point), `speech-tail`, `pointer`, `finger-point`, `zigzag`, `bracket`, `underline-wave`, `sticker-circle-badge`, `price-tag`, `play-triangle`, `like-thumb`, `fire-ish flame`. Draw-on = stroke-dashoffset over 10 to 16 f; pop = `E.pop` 8 f; wobble amplitude 1.5 px at 4 Hz (seeded).

---------------------------------------------------------------------------------------------------------------------

## 5. Camera-move presets — `cam/presets`

Contract = the kit's `camera(ctx,t) -> { fov, elev, az, dist, target:[x,y,z], screen:[px,py], punch, near, far }` plus new `roll` (deg) and `shake` (px). Presets are
`(params) => (t) => camState`; they compose by addition (`cam.add(base, handheld)`). 2D twin: same names returning `matrix3d` for DOM wrappers (`#world`).

Kit baseline `[kit presets.js]`: long lens `fov 18`, `elev 25`, `az -12 -> -6`, `dist 12.9 -> 12.3`, `punch 0.010` (a 4.5% push over a scene).

| preset | parameters (defaults) | formula / note |
|---|---|---|
| `hold` | `drift 0.004` | micro orbit +-0.4 deg over 6 s so the plate is never dead |
| `pushIn` | `dist *= 0.88`, `dur 1.2 s`, ease `E.hero` (hero push); `slow`: `*= 0.955`, `dur 6 s`, `sine in-out` | hero push on reveals; slow push as the default under type |
| `pullOut` | `dist *= 1.25`, `dur 1.6 s`, `E.move` | reveal of context; pair with a rack focus |
| `orbit` | `az +40 deg`, `dur 5 s`, `sine in-out`, `elev` fixed, 0.5% parallax | the kit's -12 -> -6 is the "calm" version |
| `whipPan` | `az +-70 deg` over **7 f**, ease in-out quint, 16 subframes (the kit supports 8/16), roll 2 deg, hide the cut at peak velocity (swap target at the middle frame) | pair with `chroma.hit` peak 10 px and a whoosh |
| `dollyZoom` | keep subject width: `dist(t) = D0 * tan(fov0/2) / tan(fov(t)/2)`; example `fov 20 -> 55`, `D0 12` gives `dist 12 -> 4.06` (arithmetic: tan10 deg = 0.1763, tan27.5 deg = 0.5206) | 2.4 s, `sine in-out`; the horror/realisation shot; use once per film |
| `handheld` | amplitudes in **screen px**, converted `deg = px * fov_v / H`: slow position +-5 px @ 0.37/0.83/1.31 Hz (axis multipliers 1, 1.27, 0.79), micro +-0.8 px @ 7.1/9.3 Hz, roll +-0.25 deg slow / +-0.04 deg micro, fov breathing +-0.4% | closed-form sum of sines with seeded phases: deterministic from t alone. Level `doc` = 1.0, `action` = 2.5, `subtle` = 0.4 |
| `crane` | `elev 12 -> 38 deg`, `dist *= 1.1`, `dur 3 s`, `E.move` | |
| `truck` | `target.x +-1.6 units`, `dur 3 s`, near-linear (`cam` ease) | reads parallax in 3D |
| `rackFocus` | `focus` point A -> B in **12 f**, `dofK 60 -> 90 -> 60` `[kit dofK 60]` | on 3D only; on DOM use a blur filter swap on two layers |
| `punchIn` (2D edit) | scale `1.00 -> 1.12` in **6 f**, ease-out expo, optional return at the next cut; alternate 1.00 / 1.08 / 1.15 | talking-head retention; re-centre on the face box |
| `dutch` | roll `0 -> 6 deg` in 20 f | tension |
| `breathe` | scale `1.000 <-> 1.012`, period 4 s (loop-safe) | holds |
| `kenBurns` (stills) | scale `1.00 -> 1.08` over the clip + drift +-2% | B-roll photos |

Rules: never move the camera during a key action (drop, slam, snap): lock for the contact frames `[kit v10 README]`; travel between zones >= 1 s; one signature move
(dolly zoom or whip) per film; handheld and a locked-off studio look never mix in one piece.

---------------------------------------------------------------------------------------------------------------------

## 6. 3D objects and characters

### 6.1 "Premium, not toy" rules (apply to every prop and character)

1. **Bevel everything.** Radius 2 to 4% of the smallest dimension (a bevel must catch a highlight at hero size: >= 1.5 px at 1080p). No razor edges.
2. **Long lens.** Vertical fov 18 deg (miniature/product look) `[kit]`. Wide lenses (> 35 deg) read game/toy unless intentional.
3. **Limited material set** (linear albedo, roughness): `matte-clay` (0.55, 0.70), `satin-plastic` (0.50, 0.35, clearcoat 0.3), `anodised-metal` (metal 1.0, rough 0.28, F0 0.9), `glass` (transmission 0.9, ior 1.45, rough 0.08), `rubber` (0.06, 0.8), `paper` (0.82, 0.9), `emissive` (status only). Never albedo 1.0 or 0.0: whites <= 0.85, blacks >= 0.03.
4. **Colour discipline:** 3 hues + 1 accent; the accent covers <= 10% of area; the kit's accent is violet `#4A18ED` `[kit presets rim]`.
5. **Light:** soft large key (area, 40 to 60 deg), coloured rim with temperature contrast, env fill about 0.25 of key, *real* contact shadows (never a blob under a coloured light) `[kit polish rule 5]`.
6. **Imperfection:** roughness map noise +-0.08, 1 to 2% size jitter in arrays, 0.4 to 0.8% seam gaps on hardware, never perfect symmetry in a crowd.
7. **Motion character:** overshoot 7%, settle in 3 bounces, anticipation 3 to 5 f, secondary delay 2 to 4 f.
8. **Do not:** default grey `MeshStandardMaterial`, saturated primaries on large areas (HSL S > 0.9 and L > 0.5), hard speculars, rainbow gradients, fixtures in frame `[kit polish rule 1]`.

### 6.2 `obj/props` (procedural, owned; all `build(ctx, params) -> {group, pose(), probes}`)

`roundedBox(w,h,d,r,seg)`, `capsule`, `pill`, `ring/torus`, `coin` (cylinder + bevelled rim + embossed face from a canvas), `phone` (slab + bezel + emissive screen quad from CanvasTexture), `laptop` (two hinged rounded boxes, hinge angle param),
`card3d` (thin box + texture), `cube/dice`, `chatBubble3d` (rounded rect + tail), `arrow3d`, `check3d` (extruded path), `gear`, `cloud` (merged spheres; kit chrome blob stays for liquid chrome), `ribbon`
(curve sweep), `svgExtrude(pathData, depth, bevel)` (any icon -> solid; the generic logo/icon-to-3D path), `textExtrude` (type preset `extrude3d`), `conveyor/slab set` (kit `makeSet`), `paperStack` (kit), `readout` (kit). Existing and reused from kit: box, chrome blob, sheets, readout, drum counter, studio env, slab fx, studio lights.

### 6.3 Characters: `char/pip` (original, procedural, rigged) and `char/acts`

**Design spec (original; do not imitate any commercial mascot):**

| part | spec |
|---|---|
| silhouette | superellipsoid body (exponent 2.6), head sphere; head height = 1/3 of total (as on the raster character sheet, section 1.3), body 2.2 head-heights |
| eyes | two spheres, **diameter 26% of head width**, centre-to-centre = 1.15 eye diameters; pupil 55% of eye; **2 catchlights** (main 14% of eye diameter upper-left, small 6% lower-right); clearcoat 1.0; sclera albedo 0.88 (never pure white) |
| mouth | none by default (mute pantomime); optional 6-viseme mouth for talking variants: closed(MBP), open(AH), wide(EE), round(OO), teeth-lip(FV), rest |
| hands | mittens (capsule + thumb sphere); no fingers at v1 |
| skin | satin-plastic/clay with **wrap diffuse 0.3** and a 1 to 2% warm terminator tint (cheap subsurface); micro bump 0.02 |
| accessories | one signature item (hat, scarf), emissive-free |
| palette | body one hue, outfit one accent; contrast head vs background >= 3:1 |

**Rig** (deterministic, all from `t`): hips -> spine(2) -> head; arms 2 bones each with analytic 2-bone IK, legs 2 bones; hand/foot targets from the act timeline.
Secondary: head, arms, accessory on springs `omega = 2 pi * 2.2 Hz, zeta 0.22` (the kit's arm spring) with "limbs lag 4 to 6 frames behind the body's vertical speed" (a learning from earlier loop builds). Squash/stretch volume-preserving: `sy = 1 + s`, `sx = sz = 1/sqrt(1+s)`, pivot at the base; `s` up to +-0.18 on jumps, +-0.08 on steps.

**Eye life (the difference between toy and character):** blink every 2.8 to 5.2 s (seeded), close 3 f / open 5 f, 10% double blinks; pupil saccade micro-jitter +-0.4 deg at 3 to 6 Hz; look-at with +-25 deg limit and 2 f lag; moving hold = scale +-0.5% at 0.25 Hz.

**Acts** (`char/acts`, timeline-module style like v10 `timelines/*.js`; frames at 30 fps; each is an event with parameters):

| act | key beats |
|---|---|
| `double-take` | look away 8 f -> hold 6 f -> anticipation shrink 0.92 (3 f) -> snap back with scale 1.15 (2 f) -> eyes widen 1.35x (3 f) -> settle 7% overshoot |
| `slow-burn` | eyes narrow 12 f, brow-less cue = head tilt 6 deg, body leans 4% forward, hold 20 f |
| `jump-scare` | anticipation 0.9 (3 f) -> burst 1.25 (2 f) -> tremble 8 f at 14 Hz, amplitude 0.01 |
| `shrug` | shoulders up 6 f, hold 8 f, drop 10 f, head tilt 8 deg |
| `proud-strut` | chest forward 5%, step cycle 16 f, bob 12% on every step |
| `sneak` | crouch 0.85, step 24 f, eyes dart left/right every 20 f |
| `trip-recover` | catch toe 3 f, stumble forward 10 f, windmill arms 12 f, recover pose hold 6 f, look-around 14 f |
| `point` / `wave` | arm 10 f out, overshoot 7%, 3 oscillations at 2 Hz for wave |
| `dance-bob` | squash 0.12 on every beat, arms swing on the off-beat, head lag 3 f (beat-locked from the grid) |
| `facepalm` | hand to face 8 f, hold 14 f, slow shake of head 20 f |
| `cheer` | anticipate crouch 4 f, jump with stretch 0.15, arms up, confetti hook (particle burst) |
| `sulk` | slump 0.94, droop head 10 deg, slow exhale scale loop 3 s |

Comedy timing: one idea per shot; reaction shot 8 to 14 f; comic pause 12 to 18 f before the payoff; sound hit lands 1 frame after the visual event `[kit rule]`.
Staging for mime-style spots: plain bright set (`toon-saturated` grade), locked or slow-push camera, no dialogue, one prop, 12 to 20 s, payoff in the last 3 s, loopable end.

Alternate (2D) track: SVG cut-out puppet (parts + GSAP, via the Lottie/GSAP adapter notes in `hyperframes-animation/adapters/lottie.md` -> Characters) as a lighter template for flat-style explainers.

---------------------------------------------------------------------------------------------------------------------

## 7. Layer stacking order and compositing rules (`comp/stack`)

### 7.1 The stack (bottom -> top) for the finisher; HyperFrames DOM uses the same slot ids as `data-track-index` bands

| slot | layer | blend / space | notes |
|---|---|---|---|
| S0 | **plate** (3D render, footage, generated) | base, display or linear | has its own DOF/bloom if 3D; `plate.baked` says which |
| S1 | far BG parallax / backgrounds (2D plates) | normal | each layer own blur for depth: blur px = k * |z - focus| |
| S2 | mid/hero 2D elements | normal | |
| S3 | contact shadows under 2D | multiply | real shadow if 3D |
| S4 | particles / confetti / sparks | normal or add | seeded |
| S5 | atmosphere (haze, light shafts) | screen, intensity <= 0.15 | |
| F1 | lens distortion | geometric | before anything optical |
| F2 | lateral chromatic aberration | per channel | linear |
| F3 | bloom (threshold) | screen/add | skip if `baked.bloom` |
| F4 | halation | screen/add | linear |
| F5 | diffusion | screen | beauty only |
| F6 | leaks / flares | screen | linear; flash peak on cut frame |
| F7 | **grade** | colour function | everything above is graded together |
| F8 | vignette | multiply | skip if `baked.vignette` |
| F9 | sharpen, weave, flicker | | applied to the plate stack only |
| T1 | **story overlay**: type, captions, stickers, B-roll cards | normal, display space | steady (no weave), AFTER grade |
| F10 | dust / hair / scratches | normal | over story type |
| F11 | **grain** | add/overlay | over everything except brand and bars |
| B1 | **brand layer**: logo, CTA, legal, end-card | normal, exact hex | no fx, ever; hex survives to the probe |
| B2 | format bars | normal | pure black |
| F12 | dither (TPDF, +-1 LSB) | | last, before encode |

Why this order: optics (F1 to F6) happen in the lens/film before the print grade (F7); a vignette is mostly a lens/print thing so it follows the grade for control;
type is a graphic added after the image is "printed" so it stays crisp and steady; grain unifies picture + type; the brand layer stays exactly on the brand colours
(the launch film already does this: grain, then the clean v8 type on top `[kit core.js:73-75]`).

### 7.2 Rules (binding)

1. **One of each:** one bloom, one vignette, one grain, one grade. A plate that already has them sets `baked`; the finisher skips them.
2. **Linear for light, display for graphics.** Light-adding fx (bloom, halation, leaks, atmosphere) are composited in linear; type/UI in display. DOM `mix-blend-mode` works in
   encoded space: the DOM back-end carries its own tuned defaults (leaks about 25% lower) `[tune]`.
3. **Deterministic.** Seeds are `hash(preset.seed, frame, i)` (PCG), no wall clock, no `Math.random`; same frame twice = same hash `[kit __hashFrame]`.
4. **Alpha is premultiplied everywhere.** Canvas `premultipliedAlpha: true`; ProRes 4444 for alpha plates; `premultiply/unpremultiply` around any `blend` on keyed layers.
5. **PX units:** all pixel params x `H/1080`.
6. **Effect budget:** at most 2 stylised fx active in a shot; stacked spikes (chroma + leak + flash + shake) only on a designated hit frame (<= 1 per 2 s).
7. **Cut-synchronous fx** peak ON the cut frame (it covers the cut); the next shot starts clean.
8. **Text legibility** measured after the grade (contrast report); never rely on eyeballing.
9. **9:16 is authored, not cropped:** the kit's rule stands: headline zone above y 740, label line y 1689..1728 left, nothing in the platform UI zones (section 9).
10. **Budget:** finisher at 1080p target >= 8 fps on M3 Pro (`[tune]`, measure); GLSL path <= 0.25 s per 4-subframe frame `[kit 0.2 s]`; keep demo renders short (<= 8 s) and small (<= 25 MB each).
11. **No hidden state:** a layer's output must depend only on (preset, frame). Renderers run one GPU job at a time `[kit]`.

### 7.3 Where the GLSL chunks patch into the studio kit (once vendored as `studio3d/`)

- `core.js` comp pass (line ~58-63): add `halation` and `chroma` after DOF and before bloom composite; leaks add to `c` before `c *= uWB * uExp`.
- `fin` pass (line ~66-77): after `enc()` and before grain: `grade()` (display-referred), then `grainStock(stock)`; keep TPDF dither last and the type overlay after (brand-exact). Add a `uBrand` overlay input after grain for the brand layer.
- `camera`: extend the returned object with `roll`, `shake` (applied as an extra view-matrix roll and a pixel offset in the lens-shift stage).
- `vignette`: replace the NDC ellipse with the `roundness` version.

---------------------------------------------------------------------------------------------------------------------

## 8. Recipes: which layers, per video type

| recipe | grade | finish (on) | camera | type | char / props | audio hook |
|---|---|---|---|---|---|---|
| **Ad (clean, 15 to 30 s)** | `neutral-clean` | chroma 1 px, bloom 0.18, vignette 0.10, grain clean | slow push; hero push on the reveal | `rise`, `weight-morph`; one `slam` on the CTA | kit props, the product box | see `docs/research/sound.md` |
| **Launch film (v9 studio)** | `studio-warm` | kit-baked bloom/vignette/grain; add `chroma` 1 px only on drop | kit presets (-12 -> -6 az), one hero push, whip between zones | v8 type overlay, brand layer on top | box, slab set | |
| **Animated short film** | `teal-orange` or `kodak-warm-35` | halation 0.35, bloom 0.30, vignette cinema 0.22, grain film35, dust 0.4, weave on, letterbox 2.39 (16:9 only) | handheld `doc` for drama, dolly zoom once, crane for the end | minimal (titles `tracking-collapse`) | `Pip`-type cast, acts | |
| **Mime-style spot** | `toon-saturated` | bloom 0.15, vignette 0.06, **no grain**, no dust | locked or slow push; one whip for the payoff | none, or one end-card | mute characters, 1 prop, `acts` | foley hits per act |
| **Music / beat edit** | `hype-pop` or `cyber-night` | chroma hit 10 px, leaks flash on cuts, glitch on drops, flicker 0.02 | `punchIn` 1.08 on beats, whip on bars | `slam`, `glitch-split`, `karaoke` | | `fx/envelope` on the beat grid |
| **Human / talking head** | `documentary-neutral` (after the automatic grade-correction pass) | vignette 0.12, sharpen 0.35, grain digital-soft 0.035, bloom 0.1 | `punchIn` cadence (section 9), `kenBurns` on stills | caption theme, `lower-third` | B-roll cards, stickers | |
| **Retro / lo-fi** | `vhs-90s` | CRT + VHS, chroma 4 px, grain vhs | static / handheld action 1.0 | `typewriter`, `scramble` | | |

Tone cell (calm/kinetic x soft/sharp, plus neutral data) -> finish mapping: Calm+Soft = diffusion + pastel + no chroma; Calm+Sharp = ad-clean; Kinetic+Sharp = hype-pop + hits; Kinetic+Soft = toon-saturated; Neutral data = neutral-clean with zero grain.

---------------------------------------------------------------------------------------------------------------------

## 9. Retention and virality (visual side) — `retention/*`

All numbers are practitioner heuristics (`[tune]`); instrument real retention (platform analytics) before treating any as law.

- **Hook (first 1.0 to 1.5 s):** motion from frame 0 (no fade from black); the poster frame (frame 0 and the thumbnail frame) holds a high-contrast subject and <= 4 words; first text lands by frame 6 to 9.
- **Pattern interrupt cadence:** a visible change (cut, punch-in, new graphic, camera move) every **2.5 to 3.5 s**; talking head: `punchIn` alternation 1.00 / 1.08 / 1.15 on sentence boundaries, never two identical framings in a row.
- **Caption/B-roll cadence:** B-roll or sticker every 4 to 6 s; each lasts 0.8 to 2.0 s.
- **Visual payoff pacing:** the strongest visual moment at 60 to 75% of the runtime; end on a held frame >= 12 f.
- **Loopable ending:** last frame equals first frame (state or composition) so replays are seamless; use a first/last-frame seam test. 9:16 first.
- **Safe zones for 1080 x 1920 (conservative union of Reels / TikTok / Shorts UI):** keep text and logos inside x 60..960, y 220..1500 (top 220, bottom 420, right 120 px reserved, left 60) `[tune]`; verify against each platform's current guide before shipping, UI changes. Component `retention/safeZones` draws the overlay and `lint`s a still.
- **Aspect set:** author wide (1920x1080) and tall (1080x1920) from one scene (kit `aspect=wide|tall` + `make-tall.py` pattern); square 1080x1080 only on request.
- **Scheduler:** `retention.schedule({ duration, beats?, sentenceTimes? })` returns a list of `{t, kind: 'punch'|'broll'|'sticker'|'cut'}` events honouring the cadences; it is a plan, the editor/composition applies it.

---------------------------------------------------------------------------------------------------------------------

## 10. Build list (ordered), with file names, API and acceptance

| # | component | files | API (summary) | demo (<= 8 s, <= 25 MB) | acceptance |
|---|---|---|---|---|---|
| 1 | preset schema + `finish.py` | `finish/finish.py`, `finish-presets/*.json` (7 recipes) | `python3 finish.py in.mp4 out.mp4 --preset X [--type t.mov] [--brand b.mov] [--baked bloom,vignette,grain]` | before/after contact sheet | determinism (hash twice), PSNR vs GLSL path |
| 2 | `fx/grade` | `fx/grade.py`, `fx/grade.glsl`, `fx/grade-svg.js`, `grades/*.json` (14) | `.cube`, `grade(vec3)`, `gradeSvg(preset)` | 14-up grid on 3 frames (neutral, skin, saturated) | identity LUT < 1/255; 3 emitters agree (mean dE < 1) |
| 3 | `fx/grain` | `fx/grain.glsl`, `fx/grain.js`, `fx/grain-plate.py` | stock table | flat grey ramp x 6 stocks | measured sigma within 15% of table |
| 4 | `fx/vignette` | glsl + overlay + ffmpeg | amount, inner, roundness, shape | wide + tall | corner luma ratio = 1 - amount (+-0.02) |
| 5 | `fx/halation`, `bloom`, `diffusion` | glsl + ffmpeg | | highlight test card | halation radius within 10% of sigma; no clipping change in mids |
| 6 | `fx/chroma` (+ envelope) | glsl + ffmpeg | `hit` | white-line grid | fringe width = cornerPx (+-0.3 px) on edge test |
| 7 | `fx/format` | ffmpeg + css | bars | | bar heights match table |
| 8 | `cam/presets` | `cam/cam.js` (+ 2D matrix3d) | `cam.pushIn({...})(t)` ... | studio-kit scene orbiting a box: 6 moves x 1 s | dolly zoom subject width constant (+-1%); handheld deterministic |
| 9 | `type/presets` | `type/type.js` + DOM/GSAP adapter | `type.slam(opts).state(t)` | 15 presets in a grid, 1 s each | seek-safe (t random order = same frames) |
| 10 | `comp/stack` | `comp/stack.js`, `comp/lint.mjs` | slot map; lints missing/duplicate bloom/grain/vignette, brand layer under fx | | lint catches a doubled grain |
| 11 | `retention/*` | `retention/schedule.js`, `safezones.js`, `kenburns.js` | | tall demo with overlay | schedule honours cadences |
| 12 | `fx/leaks`, `dust`, `weave`, `flicker`, `retro`, `glitch`, `lens` | glsl + overlay + plates | | | seeded; same frame = same hash |
| 13 | `obj/props`, `obj/materials` | `studio3d/props2.js` | | 16-prop turntable contact sheet | bevel highlight >= 1.5 px; probes exposed |
| 14 | `char/pip` + `acts` | `char/pip.js`, `char/acts/*.js` | `pip.build(ctx,{outfit})`, `acts.doubleTake(t0)` | 12 acts x 1 s sheet + a 10 s mime-style spot | no mouth required; blink schedule seeded; volumes preserved (bbox volume +-3%) |
| 15 | `icons/*` | `icons/*.svg.js` | | sticker sheet | all draw-on seek-safe |

Effort note: items 1 to 7 + 10 + 11 are cheap (shader strings, python, json); 13 and 14 are the heaviest; build 14 last and keep the first version to 4 acts.

---------------------------------------------------------------------------------------------------------------------

## 11. Verification protocol (measured, not eyeballed)

| check | how | pass |
|---|---|---|
| determinism | render frame N, render another frame, render N again; hash compare (`__hashFrame`) | equal |
| seek-safety | random frame order vs sequential | equal |
| grain sigma | flat 50% grey plate through preset; luma sigma of output | table +-15% |
| vignette | probe corner/centre luma ratio | `1 - amount` +-0.02 |
| chroma | edge-test card; measure R/B fringe offset at the corner | `cornerPx` +-0.3 px |
| halation | clipped-highlight card; radial profile vs gaussian sigma | sigma within 10% |
| grade | identity `.cube` round trip; 3 emitters on a ColorChecker-like synthetic chart (own chart, generated) | max dev < 1/255; mean dE < 1 |
| brand colour | probe brand-layer pixels after the whole chain | exact hex (+-1) |
| legibility | `contrast-report.mjs` after grade | >= 4.5:1 |
| safe zones | lint tall stills | nothing outside the rectangle |
| size/time | `ls -l`, `ffprobe`, wall time | demos <= 25 MB, <= 8 s |
| console | zero errors on pages | 0 |
| parity | same preset: GLSL vs ffmpeg vs DOM on 5 reference frames | mean luma delta <= 2/255 |

Known pitfalls to carry forward (from earlier loop-render builds and the kit README): a `*/` inside a block comment kills a module and the headless renderer then waits ~15 min (probe the page first);
the renderer's fps argument must be explicit (`0 30`, not `0`); accumulate subframes with `autoClear` off; cube cameras must refresh shadows or frames depend on history; additive light on white is invisible (use alpha
for design-colour lines); a rim spot grazing white tints the whole top; ffmpeg prints "Truncating packet" on the raw pipe (harmless); Chrome behind other windows stalls platform video uploads (not render).

---------------------------------------------------------------------------------------------------------------------

## 12. Sources (ideas only, from knowledge; not fetched in this run; nothing vendored)

- gl-transitions (open-source GLSL transition collection, gl-transitions.com): vocabulary and parameter shapes for shader transitions.
- ASC CDL (American Society of Cinematographers Color Decision List): slope/offset/power/saturation model for `fx/grade`.
- Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare" (SIGGRAPH 2014): the 13-tap down / tent up sampling our kit's bloom already uses.
- Kawase blur; Iñigo Quílez (SDFs, cosine palettes, smooth-min); McGuire/Narkowicz/Hable tone-curve literature (shoulder/knee design).
- Kodak and Fuji motion-picture stock data sheets (grain, halation characteristics) as qualitative guides for the stock table.
- Thomas and Johnston, "The Illusion of Life" (squash/stretch, anticipation, follow-through); Robert Penner easing equations.
- Platform UI safe zones: Instagram Reels, TikTok, YouTube Shorts creator guides (must be re-verified at build time).
- Provenance (ANVE's launch-film kit): v9 studio `kit/{README.md,core.js,presets.js}`, v10 set `README.md`; HyperFrames registry docs (`hyperframes-registry/references/discovery.md`).
