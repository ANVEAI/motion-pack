# Changelog

Each release's notes are also on the [Releases page](https://github.com/ANVEAI/motion-pack/releases). The counts below come from `python3 tools/count.py` at each tag.

## v0.4.0 (19 Oct 2026): genre templates, an editable project file, delivery and accessibility

The catalog grows from 954 to **1132** components. Genre templates go from 7 to **24**, plus 12 part demos. Every number in this section comes from `tools/count.py` or from a test or check named next to it.

### New: eight lanes of work

- **SaaS:** three templates (`saas-launch`, `saas-feature-drop`, `saas-explainer`), each with a 16:9 cut and a 9:16 re-layout. They come with 13 SaaS kit parts (an app window, a cursor journey, a command bar, an AI answer, pricing cards and more) and 12 synthesised UI sounds in a new `saas_ui` bundle. The demo screens show a fictional product with labelled placeholder data.
- **Hardware:** three templates (`hardware-reveal`, `hardware-teaser`, `spec-sheet`). They add 14 three.js hardware objects, an exploded-view choreographer, the `hw.*` overlay parts, 15 hardware sounds plus a `hardware_launch` bundle, and Blender recipes that take your own GLB.
- **Film:** three templates (`trailer`, `title-sequence`, `short-film`). They add 28 trailer sounds and a `trailer` bundle, genre trailer scores (thriller, sci-fi, horror, drama), a trailer cut planner, 8 film looks with LUTs, and 15 film overlay parts.
- **Human:** five templates for footage you record yourself (`tutorial`, `vlog-personal`, `podcast-clip`, `founder-story`, `course-lesson`), with 15 overlay parts. No person, voice or recording is ever generated. A missing input renders as a labelled placeholder, and a pull quote must be a verbatim run of the transcript or the build stops.
- **Research and structure:** `patterns/` holds 20 beat sheets (section timing as a share of runtime, average shot length, text ceilings, the CTA window) and 13 hook archetypes with frame-0 rules. `tools/structure_check.py` scores a plan against them (26 tests, 15 mutants). The sourced, graded evidence is in `docs/research/`.
- **Editable projects and the `mp` CLI:** one project file (`templates/_shared/project.schema.json`) sets brand, text, media, voice, music, length, platforms and aspects for every genre template. `tools/mp` does `list`, `new`, `set`, `build`, `render`, `check`, `brand` and `doctor`. `docs/EDIT-WITHOUT-CODE.md` walks a non-coder through it.
- **Delivery and accessibility:** captions (SRT, WebVTT, IMSC1.1 TTML or burned in, with SDH), audio-description scripts, an accessibility lint (`tools/a11y_check.py`: flashes, caption contrast, size, reading time, colour-blind safety), 14 platform delivery presets (`tools/deliver.py`) and a Lottie export of kinetic type and draw-on icons. Guide: `docs/DELIVERY-AND-ACCESSIBILITY.md`.
- **Explainer and data:** three templates (`explainer-diagram`, `data-story`, `process-howto`). They add 11 diagram, chart, map and process parts, a number formatter (international, Indian lakh / crore, European, SI), a deterministic graph layout, and data honesty gates: a dataset with no source, a chart with no unit or a bar chart that does not start at zero stops the build. The gates check the form of the evidence, not its truth.

### New parts from the reference rounds (r78 and round 8)

- `ui.glassPanel`, `ui.rimLight`, `ui.reviewLayer`, `ui.approvalSlider`, `type.sentenceAcrossShots`, `layout.textWall`, `layout.pillWall`, `device.lockScreen` and `background.skyClouds`. The same round adds an `ab-replay` before / after audio-swap story shape, an `ears/ab_replay` check, and the `demo-r78` part demo.
- `caption.soundOnPill`, a frosted "Sound on" pill for muted autoplay, and `ui.stateChip`, a persistent corner chip that flips on planned frames. Each comes with its sound cues (68 checks in `type/tests/chips.test.mjs`).

### Fixed: every aspect renders at its own size

- In the 16-17 Oct test renders, four templates wrote a 1920x1080 file named `-9x16`, and `vlog-personal` wrote a 1080x1920 file named `-16x9`. Every genre template now builds the aspect `mp` asks for, whether through a project file or `--aspect`. `tools/tests/aspect-builds.test.mjs` runs 100 checks over every template and aspect.
- **The wrong-size guard:** `mp render` now ffprobes every file. A file whose size does not match its aspect fails, and is kept as `.WRONG-SIZE.mp4`. `mp check` runs the same test on every file in `renders/`.

### Counts at this tag (`tools/count.py`)

| module | v0.3.0 | v0.4.0 |
|---|---|---|
| catalog components | 954 | 1132 |
| genre templates (+ part demos) | 7 (+ 11) | 24 (+ 12) |
| sound effects (families, bundles) | 301 (26, 15) | 356 (28, 18) |
| music beds / style presets | 41 / 33 | 45 / 37 |
| layers (looks, LUTs) | 139 (45, 49) | 159 (53, 57) |
| type parts | 217 | 287 |
| three.js objects | 30 | 44 |
| cut patterns | 48 | 49 |
| ears checks | 10 | 11 |

### Best demos

Three renders from the 19 Oct run pass loudness and frame size and read well on their contact sheets. They are attached to the v0.4.0 release (not committed):
- `ad-9x16.mp4` (1080x1920, 15 s): the `ad` template driven by `examples/project.example.json`. Eyes and ears report no fails.
- `character-spot-16x9.mp4` (1920x1080, 16 s): the wordless `character-spot`. Eyes and ears report no fails.
- `short-film-16x9.mp4` (1920x1080, 53.6 s): `short-film`, with the `film-scene` three.js plate in its stage slot. It passes loudness and ears; eyes flag black frames, banding and readability on its dark placeholder plates.

### Known weak spots (read before you rely on a template)

On 19 Oct every genre template was rendered through `mp render` at both aspects, 44 files in all, and checked with `mp check` (eyes, ears, loudness and frame size). The renders use the templates' own placeholder plates. Every file is the right size. 38 of the 44 pass loudness (-14 LUFS ± 0.5, true peak ≤ -1 dBTP).

- **Quiet renders, not fixed in this release.** `data-story` comes out at -21.46 LUFS, `explainer-diagram` at -22.75 and `film-scene` at -17.55, at both aspects.
  - In `data-story` and `explainer-diagram` the mix WAV is at -14.0 LUFS. The HyperFrames render then lowers the whole track by 7.3 and 8.6 dB, because its true-peak guard reads the encoded audio as over -1 dBTP (its log says "Audio lowered by ... dB").
  - The `film-scene` mix itself stops at -17.49 LUFS, because the mixer reaches its -2.0 dBTP ceiling first and has no limiter.
  - Neither is a gain or target setting, so this release leaves them alone. A workaround: limit the master at 4x oversampling, keep the rendered picture and remux the audio yourself, then measure the MP4 with `ffmpeg -af ebur128`, not the WAV.
- **ears:** `founder-story` fails the sync check at both aspects. Its caption row also overlaps the "Founder name" lower third and the speaker tag. `film-scene` fails ears sync as well as loudness.
- **eyes, banding:** nearly every dark template fails the banding check. Add grain or lower the CRF.
- **eyes, frame 0:** `hardware-teaser`, `saas-feature-drop` 16:9, `title-sequence`, `hardware-reveal`, `process-howto`, `data-story` and `explainer-diagram`.
- **Label collisions seen on the sheets:**
  - `spec-sheet` 9:16: the "AI COMPUTE" label sits under "120 TOPS" at 19.2 s.
  - `hardware-reveal`: "Machined from one block" sits over the watermark at 9.2 s, and the port labels overlap at 34.8 s.
  - `character-spot` 9:16: the end title touches the left edge at 15.4 s.
  - `data-story`: the footer repeats its demo-data line at 60 s.
- **eyes, readability and safe zones:** `saas-feature-drop` headlines sit at 76-92 px, under the 96 px floor for wide frames. Placeholder tags, captions or titles sit outside the safe area in 20 of the 44 renders, among them `vlog-personal`, `tutorial`, `founder-story`, the trailers and the 16:9 `ad`.
- **Structure scores:** `hardware-reveal` scores 72, because its 6-8 s shots run long against the 1.5-3.5 s pattern. `short-film` reads 0 on pace, because its placeholder plates have no motion events. `title-sequence` at `length=60` holds after 34 s with the 10 demo names.
- **Not heard by a person:** the new sounds were measured by `sfx/qa.py` and `music/qa.py` (0 fails), not auditioned.

### On `main` after the v0.4.0 tag

- MP3 previews for the 55 new sounds and 4 genre trailer beds, and the catalog now points at them. Without them the Pages build of the catalog failed, because the WAV masters are not in git.
- This changelog section: the 19 Oct render results, the best demos and the weak spots above.

## v0.3.0 (15 Oct 2026)

Storyboard before the build (`storyboard/`), eyes after it (`eyes/`), with mutation proofs in CI. See the [v0.3.0 release](https://github.com/ANVEAI/motion-pack/releases/tag/v0.3.0).

## v0.2.0 and v0.1.0 (13-15 Oct 2026)

See the [Releases page](https://github.com/ANVEAI/motion-pack/releases).
