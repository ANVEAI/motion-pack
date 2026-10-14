# Gotchas (full list, from the module builders and earlier ANVE video work)

## HyperFrames (0.8.142)

- **Timed clips vanish outside their window.** A clip is hidden outside `[data-start, data-start + data-duration]`. A two-layer transition needs the outgoing clip to run past the cut and the incoming clip to start before it. `templates/_shared/txplan.mjs` does this with `txPlan()` + `span()`, clamped to half of each neighbouring shot. When you add a new template, pass every timed element through `span()`.
- **Never tween a timed `.clip` or `<video>` directly.** Animate an untimed wrapper (`#w-<id>`).
- **`z-index` on the overlay container breaks blending.** It creates a stacking context and isolates `mix-blend-mode` (grain and vignette stop blending), so set z on the canvases.
- **Lint warnings do not block a render.** Use `--strict` to make errors block.
- **Default quality `looks` is CRF 16.** That gives about 18 Mb/s, 34 MB for a 15 s 1080p file. Pass `--crf 23` for demos and reviews, and use the default only for masters.
- **Pin the version:** `npx --yes hyperframes@0.8.142 ...`. Everything in this file was measured on 0.8.142.
- **The whole track drops if the AAC is too hot.** If the encoded AAC true peak is over -1 dBTP, HyperFrames lowers the entire track, and it logs this only with `--debug`. The 30 s ad lost 1 dB this way. The mixer's AAC probes catch it, so keep the WAV at -1.5 dBTP.
- **GL in HyperFrames is proven with canvas sources only.** A `<video>` used as a WebGL texture during a render is untested, so draw video frames into a canvas or use the DOM back-end.
- **UI clicks overshoot HyperFrames' own AAC more than the mixer's probe predicts.** The UI-kit demo's master sat at -1.5 dBTP with mixer AAC probes at -1.1 / -1.2, yet HyperFrames logged `Audio lowered by 2.2 dB` and the delivered file measured -16.4 LUFS. Set `ceilingDb: -2.5` in the plan (read by `templates/_shared/audio.py`) for click-dense UI mixes; the re-render delivered -14.1 LUFS / -1.5 dBTP with nothing lowered. Always grep the render log for `lowered`.
- **A mix that starts on a hit can make HyperFrames lower the whole track by 4–5 dB.** HyperFrames re-encodes its AAC mix (AAC to AAC) before muxing; a full-level transient in the first ~15 ms overshoots by several dB in the second encode even when the WAV sits at −2 dBTP, and the whole track is then lowered (the demo-type-layout render dropped to −18.9 LUFS). Fade the first 40 ms in (`plan.fadeInMs: 40` in `templates/_shared/audio.py`) and set `plan.ceilingDb: -2.0` when UI clicks are dense; then check `Audio lowered by` in the render log.
- **The GSAP binding is one paused proxy tween per transition window, driving `p` linearly.** The easing lives inside `applyDom`, so do not add an ease on the proxy.

## Transitions

- **DOM gaps.** The DOM back-end covers 13 of 23 transitions. Its limits:
  - spin shows the background instead of mirrored edges.
  - whip has no RGB fringe.
  - lumaWipe supports only linear and radial.
  - iris star and roundRect are approximations.
  - match has no guides.
- **GL-only keys hard-cut in DOM templates.** These are glitch, ink, filmBurn, lightLeak, morph, zoomThrough, pagePeel, pixelSort and maskReveal. Each is logged as `transitions todo`.
- **Two transitions are approximations.** pixelSort is a max-luma streak, not a true sort. morph is a luma-gradient warp dissolve, not optical flow.
- **The three.js pass is parity-tested against r185** (`transitions/tools/three-parity.sh`, with `THREE_BUILD` pointing at a local three.js build). The kit (`objects/kit/`) loads r160 from CDN, so do a first-use check inside a kit scene before a hero use.
- **Flash and photosensitivity.** Use `peak: 0.7` and no more than 3 flashes per second for anything broadcast-adjacent. Check WCAG flash thresholds.

## Sound

- **Hit contract.** The anchor sample lands at `(F + 1) x SR / fps`: one frame after the visual (the rule from ANVE's v9 launch film). Risers end one frame **before** the hit.
- **The library is normalised to -6 dBFS peak.** Real levels come from the mixer's over-bed solver (hero +4.5, whoosh +2, ui +4, logo +5 dB over the bed). Never gain by hand.
- **Sub-heavy cues are not phone-safe.** `phone_safe=false` means the cue drops more than 6 dB on a phone speaker. Pair it with a mid-range cue (lint R12).
- **Sound ids use the registry segment, not the manifest category.** The transition sounds are `sfx/tx/*` and the impacts `sfx/hit/*` (category names `transition` and `impact` are not ids). The music-mixer path of `templates/_shared/audio.py` skips an unknown id silently, so run `python3 tools/check_ids.py` before every mix and compare the cue count it prints.
- **A dense SFX cue sheet can still trip the AAC probe.** The 16 s cards demo decoded 0.9 LU quiet at a -1.5 dBTP WAV ceiling (HyperFrames lowered the whole track); `plan.masterCeilingDb: -2.0` fixed it (-14.2 LUFS / -1.6 dBTP decoded).
- **No human listening pass yet.** Everything was verified by measurement and spectrograms. The glass, bell, metal and bubble tables are research grade C, and the babble, boing and formant voices need one ear pass before a hero use.
- **Loudness targets.**
  - IG, TikTok, X and LinkedIn publish no loudness spec (grade D).
  - The house master is -14 LUFS-I with TP <= -1.5.
  - Festival and broadcast is -23 LUFS / -1 dBTP as a separate master.
- **HyperFrames sound integration is mode A only:** one baked `mix.wav` at 0. Per-clip `<audio>` with `data-start = (F + 1)/fps` is not built yet.
- **Talking-head demo.** The SFX stem sits under the input's own audio, so its LUFS is low on purpose (around -37 for the stem alone).

## Type and captions

- **UI-kit text widths are estimated.** `ui.*` sizes chips and pills from `textW` (no DOM measurement), so a long label can overrun its chip; check the sheet. The prompt caret is a `<tspan>` after the typed text, so it always sits right after the glyphs.
- **Real UI is small on a 16:9 frame.** At `scale: 1` the kit uses true UI sizes (30-34 px body); for video use `scale` 1.3-1.6 and check a 360 px wide still.

- **`scramble` swaps glyph text.** Use the canvas renderer or `driveType`, not `bakeType`.
- **`flipSplit` on canvas is a vertical squash.** The DOM version uses a real rotateX.
- **Safe zones conflict across sources.** `conservative` is the union, flagged `verify: true`.
- **Mask-rise type is clipped while it rises.** A frame grabbed mid-reveal shows clipped lines, which is correct. Judge legibility after the reveal settles: check the hold frame, not the first 14 frames.
- **Emphasis scale can collide.** At 1.15x, an emphasised word can overlap its neighbour ("So I flipped" in the talking-head demo). Add tracking or lower the emphasis scale for long words.
- **Some ffmpeg builds have no libass** (the one the pack was built with does not). Burn captions through the type module or PNG overlays, not the `subtitles` filter.

- **Canvas card systems load pictures once.** `mountCards` / `mountBoard` start URL images at mount; mount at module run so the page load waits for them, or pass decoded images or canvases. A picture that is not decoded yet draws the card back (a dark slot on the board), never a crash.
- **Corner pin sits on top of the plate.** A 3D object passing in front of the pinned plane is not occluded by it: keep foreground props out of the pinned quad (the cards demo moves its panel outside the icon orbit for this reason).

## Layers and camera

- **Overlay grain behaves like midBias 1.** It is quiet in shadows and highlights. For exact kit grain use the Finisher.
- **Plate-based effects need plate pixels.** Bloom, halation, chroma, lens and diffusion only run in the Finisher, so a DOM-only composition cannot do them.
- **No double finishing.** The `launch-studio` plate already bakes bloom, vignette and grain. `lintStack` and `lintOverlayStack` warn when you stack them twice.
- **Grades are starting values** judged on synthetic stills. Re-judge them on real footage.
- **Whip blur needs subframe sampling** in the render loop (8 or 16 subframes). A 2D whip alone exposes black.

## 3D objects and kit

- **Seek-safe objects.** No `Date` or `Math.random` anywhere; everything renders from `t`.
- **Determinism QA.** Run the frame renderer's `--qa` mode (determinism, seam and console checks). A failing seam check is expected for non-loops.
- **Prop polish varies by distance.** The laptop aluminium reads slightly flat and the mug is perfectly symmetric. Both are fine at template distances but not photoreal at macro distance; use a Blender render (not part of this repo) for a photoreal hero.
- **No third-party logos on props.** If you pass a real logo texture, the type layer must carry the trademark line.
- **Run the 3D templates before `beat-edit` and `talking-head`,** which use their renders as footage.

## Environment and process

- **Leave disk headroom for renders.** `templates/_shared/render3d.sh` prints free space first and asks the renderer to stop under 10 GiB free. On macOS a render killed with exit code 143 often means the disk filled up.
- **A hidden browser pane throttles animations.** `document.hidden` freezes counters and reveals, so check `visibilityState` before debugging. A hidden Chrome also stalls X and LinkedIn video uploads.
- **Image models garble UI.** Never let one redraw UI or text. Generate the room and composite the real screenshot.
- **References are craft, not copy.** Learn the method from reference work and never build a literal replica.
- **Write it down the same day.** Every new gotcha goes into this file and the module README.
