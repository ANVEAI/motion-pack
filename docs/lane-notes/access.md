# Lane 8 "access" (branch xp-access): notes for the merge

This lane makes the pack professional-grade for delivery and accessibility. It covers captions to a broadcast and streaming standard, audio description, an accessibility lint, delivery profiles and a Lottie export.

It was **code-only**: the disk was nearly full. No template was rendered. Every encode ran on a 1-second synthetic clip in pytest's temp folder. The full guide is `docs/DELIVERY-AND-ACCESSIBILITY.md`.

## What shipped (new files only; no existing file was edited)

| file | job |
|---|---|
| `tools/a11y/standards.py` | every limit with its grade and source (captions, reading, flash, CVD, AD pace) |
| `tools/a11y/safezones.py` | the safe rectangles PARSED from `type/safezones.js` and the `templates/_shared/plan.mjs` presets (no copy) |
| `tools/a11y/cvd.py` | Machado 2009 protan / deutan / tritan simulation, CIEDE2000 (Sharma test pairs to 1e-4), WCAG ratio |
| `tools/captions/{core,formats,validate,burn,export}.py` | segmentation (DP), line breaks, timing, SDH, placement; SRT / positioned WebVTT / IMSC1.1 TTML writers and parsers; the validator; the PNG burn-in pass; the CLI |
| `tools/describe/{core,export}.py` | the AD script: author lines, then shot-list actions, then DRAFT lines from the plan; standard AD in speech gaps; extended AD with pauses and the ffmpeg freeze / silence graph. No TTS |
| `tools/a11y_check.py` | planned flashes (plus measured ones through `eyes/look.py analyze(only=['flashes'])`), caption contrast against decoded frames, text size, reading time, colour-blind collapse, colour-only meaning |
| `tools/deliver.py` | 14 presets as pure functions to ffmpeg arguments; loudness policies with sources; two-pass linear loudnorm only when needed; file verification (codec, BT.709 tags, faststart, alpha, limits, LUFS / TP) |
| `tools/lottie/{sample.mjs,geom.py,export.py,validate.py,playcheck.mjs}` + `examples/{title.json,check.svg}` | Lottie export of kinetic type (glyph outlines), draw-on icons (trim paths) and spring shapes; schema validation against lottie-spec 1.0.1, fetched from a pinned URL and verified by SHA-256 (not vendored); a lottie-web still check |
| `tools/tests/test_{captions,describe,a11y_check,deliver,lottie}.py` | 70 tests. CI already runs `tools/tests`, so no `ci.yml` change is needed |
| `docs/DELIVERY-AND-ACCESSIBILITY.md` | the guide |

## Shared-file edits NEEDED at integration (exact text; none made on this branch)

1. **`requirements.txt`**: append these two lines. fontTools is already present transitively through matplotlib; without jsonschema, `tools/tests/test_lottie.py::test_schema_validation_with_the_pinned_file` skips.
   ```
   fonttools==4.66.1      # tools/lottie glyph outlines (already a matplotlib dependency; pinned here because tools/lottie imports it directly)
   jsonschema==4.25.1     # tools/lottie/validate.py: the pinned lottie-spec schema (Draft 2020-12)
   ```
2. **`README.md`**, module table: append one row.
   ```
   | delivery + accessibility | `tools/captions/`, `tools/describe/`, `tools/a11y_check.py`, `tools/deliver.py`, `tools/lottie/` | captions (SRT / WebVTT / IMSC1.1 TTML / burned in, SDH) to 42 chars, 2 lines, 20 cps (17 kids); audio-description script (standard + extended, no TTS); accessibility lint (flash, caption contrast, size, reading time, colour-blind, colour-only); platform delivery presets with BT.709 tags, faststart and loudness by source; Lottie export of kinetic type and draw-on icons. Guide: `docs/DELIVERY-AND-ACCESSIBILITY.md` |
   ```
3. **`skills/motion-pack/SKILL.md`**: three edits.

   **(a)** In "Reach for X when", append these rows.
   ```
   | captions a viewer can switch on (SRT, WebVTT, TTML), SDH, or burned in | `python3 tools/captions/export.py --plan out/plan.json [--sdh] [--burn out/film.mp4]`; check any track with `tools/captions/validate.py` | 42 chars a line, 2 lines, 20 cps adults / 17 kids, 5/6-7 s, 2-frame gaps, inside the safe zone and off the plan's on-screen text; fast speech is reported, condense it by hand |
   | an audio-description script | `python3 tools/describe/export.py --plan out/plan.json [--shotlist shotlist.json]` | lines in speech gaps, the rest as extended-AD pauses; DRAFT lines come from the plan and need a human check; no voice is synthesised |
   | an accessibility check before and after the render | `python3 tools/a11y_check.py --plan out/plan.json --design design.json --captions <events.json> [--mp4 out/film.mp4]` | planned + measured flashes, caption contrast on real frames, size, reading time, colour-blind collapse, colour-only meaning |
   | the platform file (YouTube, Shorts, Reels, TikTok, X, LinkedIn, broadcast ProRes 422 HQ, web H.264 / HEVC / AV1, GIF, ProRes 4444 / VP9 alpha) | `python3 tools/deliver.py out/film.mp4 --preset <id> --out dist/` (`--list`) | BT.709 tags, faststart, loudness per platform with its source, delivered TP <= -1 dBTP; the file is verified after the encode |
   | the same title or icon animation in an app or website | `python3 tools/lottie/export.py spec.json --validate` (`--matrix` lists what exports) | kinetic type (6 presets exact, the rest lossy and refused without `--allow-lossy`), draw-on icons, spring shapes; type/gfx SVG parts, blur and 3D do not export |
   ```

   **(b)** In the QA checklist, after "Flash safety", add:
   ```
   - [ ] **Accessibility:** `tools/a11y_check.py` has no fail; captions exported and validated (`tools/captions/validate.py` no fail, or every cps warning condensed by hand); for a public release, an AD script reviewed by a person.
   - [ ] **Delivery:** each platform file comes from `tools/deliver.py` and its verification lines are all `ok`.
   ```

   **(c)** In "Where things are", add:
   ```
   | Captions, audio description, accessibility lint, delivery presets, Lottie export | `tools/captions/`, `tools/describe/`, `tools/a11y_check.py`, `tools/deliver.py`, `tools/lottie/`, `docs/DELIVERY-AND-ACCESSIBILITY.md` |
   ```
4. **`skills/social-video` `SKILL.md`** (and `references/platforms.md`), under "Upload copies under a size cap": add
   ```
   Make the platform master itself with `python3 tools/deliver.py out/film.mp4 --preset youtube|shorts|reels|tiktok|x|linkedin` (BT.709 tags, faststart, loudness checked, the file verified); `upload_copy.py` then makes a capped copy of that master when a tool needs one. Post the SRT or VTT from `tools/captions/export.py` as the platform caption file where the platform takes one (YouTube), and burn captions in (`--burn`) for X and LinkedIn.
   ```
5. **`skills/frame-design` `SKILL.md`**, under QA: add
   ```
   - [ ] `python3 tools/a11y_check.py --design design.json` shows no colour-blind collapse between roles that must read apart, and every state colour has a non-colour cue in `design.json` `a11y.cues`.
   ```
6. **`skills/motion-pack/references/gotchas.md`**: append
   ```
   - ffmpeg 7+ takes a stream's colour tags from the frames: `-color_primaries bt709` alone left primaries and transfer unset after a `scale` filter. Add `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv` to the filter chain (tools/deliver.py does).
   - lottie-web ignores `masksProperties` unless the layer has `hasMask: true`, and draws nothing when a mask has no `x` (expansion) property. tools/lottie/export.py writes both.
   - The native VP9 decoder drops the alpha plane of a WebM; decode with `-c:v libvpx-vp9` before `-i` (tools/deliver.py `--alpha-src`).
   ```
7. **`tools/count.py`**: no component counts change (no new type/gfx/sfx/layers ids).

## Findings for other lanes (from running the tools on the committed plans)

- **`a11y_check` fails on `hardware-reveal` and `spec-sheet`.** Several `role: read` texts are 44 px on 16:9, under the 48 px read floor of frame-design / eyes ("Your models. Your desk.", "Built in layers", "Specifications", the spec labels). Either raise them to 48 px or give them a role whose floor fits (`label`, 28 px).
- **The `maskRise` / `charRise` line mask shows the top 0.26 em of the glyphs BEFORE the entrance.** This happens in both renderers. The mask is 1.12 em tall and the rise starts 0.6 em down, while the Manrope cap top sits at about 0.86 em. Compositions hide it because the clip starts at `at`. The Lottie export does the same: the layer in point is `at`. A text shown before its `at` (no clip window) would show the sliver. Not changed here: it is shared type code.
- **`multi-voice-doc` captions fail on reading speed in the voices cold open** (31-41 cps, 0.8 s per voice). That is honest: the shape is faster than any caption standard. The fix is condensed caption text for that section, by hand.
- **Pre-existing test failures at the base 18056bf** are untouched: `test_docs_truth::test_apis_lists_every_sfx_bundle`, `test_structure_check::test_every_genre_template_passes_or_is_reported_with_a_reason` and `test_suites_listed` (`templates/_hw/hw.test.mjs` not in CI). They come from the hardware merge and are listed in LOOP-STATE.

## Skill recipe text (for `skills/motion-pack/SKILL.md`, after RECIPE H)

```
### RECIPE D: delivery and accessibility (every public video)

1. Captions: `python3 tools/captions/export.py --plan out/plan.json --out out/captions` (add `--sdh` for speaker IDs and [sound] tags; `--audience kids` for 17 cps). Read the report: a cps fail means the speech is faster than people can read, so condense those events by hand in the .srt / .vtt and re-check with `tools/captions/validate.py`.
2. Burned-in copy for feeds that play muted (X, LinkedIn): `--burn out/film.mp4`. The burned track re-breaks to the safe width (23 characters on 9:16 at 64 px).
3. Audio description: `python3 tools/describe/export.py --plan out/plan.json [--shotlist shotlist.json] --out out/ad`. Rewrite every DRAFT line against the picture. A describer records the script (the pack synthesises no voice), or ship `ad.en.vtt` as a `<track kind="descriptions">`. If lines did not fit, offer the extended-AD cut (`--extend-video`).
4. Lint: `python3 tools/a11y_check.py --plan out/plan.json --design design.json --captions out/captions/captions.en.events.json --mp4 out/film.mp4 --md out/a11y.md`. No fail before delivery.
5. Deliver: `python3 tools/deliver.py out/film.mp4 --preset youtube --preset reels --out dist/`. Every verification line must read `ok`; broadcast uses `--preset broadcast-prores --region ebu|atsc`.
6. App or website loop of the title or icon: `python3 tools/lottie/export.py spec.json --validate`. Check the stills with `tools/lottie/playcheck.mjs` (point LOTTIE_WEB at your lottie-web).
```
