# Changelog

Each release's notes are also on the [Releases page](https://github.com/ANVEAI/motion-pack/releases). The counts below come from `python3 tools/count.py` at each tag.

## v0.6.0 (unreleased, branch v06): styles, any-folder install, prompt gallery

A format says what happens when; a **style** now says what it looks and sounds like. The catalog grows to **<!--n:catalog_total-->1156<!--/n-->** components (10 styles and 14 format films join it).

### New: the STYLE layer (`playbook/styles/`)

- **<!--n:playbook_styles-->10<!--/n--> named styles built only from existing parts:** editorial-print, swiss-grid, neon-night, paper-cut, chrome-product, documentary-grain, blueprint, retro-crt, soft-clay, kinetic-poster. Each one has:
  - a copy-ready prompt of 150-250 characters (and a Chinese one);
  - a palette measured by `skills/frame-design/scripts/contrast.py`, type and presets, a motion personality and camera grammar;
  - one transition per REASON plus banned ones, an overlay stack, a bed and role sounds;
  - 4-8 signature features, each a `mp lint` check or a review item; formats; recipes whose ids resolve; a demo.
- **Commands:** `mp styles [<id>] [--zh]`; `mp plan <format> --style <id>` (and `mp brief --style`) writes `plan.style` and lays the style into `project.json`; `mp lint` runs `lint.style.palette`, `.type`, `.transitions` and `.sound` and lists the review features.
- **Demos:** one 10 s, 16:9 film per style (the `ad` format on a placeholder subject, rendered through the render lock at CRF 18, 0 FAIL in `mp lint`). All ten are rendered. The small previews are in `media/styles/`; the full demos go to the release assets (`motion-pack-style-<id>-v0.6.0.mp4`).
- **`templates/ad`:** a 10 s cut, an all-type mode (`plates: false`, a kicker tab on frame 0), fonts, muted and on-accent colours, upper case, and a reveal name fitted to one line. Default builds are unchanged.

### New: works from any folder

- `skills/motion-pack/scripts/find-pack.sh` finds the pack: `MOTION_PACK_HOME`, the clone the skill sits in, `~/.motion-pack/<version>`, else `mp init`.
- `mp init` downloads the tagged release tarball (`motion-pack-v<version>.tar.gz`) and `SHA256SUMS`, checks the sha256 and unpacks into `~/.motion-pack/<version>`. **Release step:** `scripts/release-tarball.sh v0.6.0` makes the tarball and its SHA256SUMS line; attach both to the release.

### New: prompt gallery and catalog tabs

- `docs/prompts.md`: <!--n:gallery_prompts-->25<!--/n--> format × style prompts (generated from `playbook/prompts.json`; CI checks that `mp brief` routes each to its format and that `mp plan --style` builds it).
- The catalog opens on **Styles** and **Films** tabs, each item with its preview and a copy button for its prompt.
- `README.md` now opens with moving films and a "copy this prompt" quick start; `README.zh-CN.md` translates the top and summarises the rest.

### Fixes found by the v14 film

- eyes reads two-colour lines (plan `fgAlt`); ears keeps a planned quiet before the final sting (merged from `film-v14`).
- The turn-window check no longer divides the percent range by 100 twice.
- `mp lint` no longer reuses eyes / ears reports of an older render at the same path (keyed on the render's sha256).
- `mp brief` ignores negated phrases and meta lines, weights the goal and audience over words like film or hype, and counts a named format; a brand-free copy of the v14 brief is a regression fixture (launch-film, not trailer).
- `tools/count.py --write` no longer undoes the README table when README.md also carries inline markers.

## v0.5.0 (21 Oct 2026): the playbook

Everything the pack has learned from studied films and its own renders is now one machine-readable **playbook**, and the `mp` CLI uses it from the brief to the final check. The catalog stays at **1132** components and **24** genre templates (`tools/count.py`).

### New: the playbook (`playbook/`)

- **338 graded, atomic rules** in `playbook/rules/`.
  - By how they are kept: 119 enforced by 64 `mp lint` checks, 22 written into the plan by `mp plan`, 63 carried by a pack part, and 134 still prose-only.
  - By grade: 54 measured-A, 67 measured, 79 craft, 128 house, 10 inferred.
- **14 formats** in `playbook/formats/`: launch-film, proof-clip, saas-feature-drop, hardware-teaser, trailer, beat-edit, explainer, chat-skit, screen-life, character-spot, talking-head, short-film, documentary and ad. Each one has:
  - beats as fractions of the runtime;
  - a sound shape: quiet open, bass entry, silence under the name, tail;
  - hooks, end shapes and a post plan;
  - the recommended parts per beat;
  - 2-5 brand-free measured exemplars.
- **`tools/playbook_build.py`** validates the rules and formats against their schemas and generates `playbook/README.md`. CI runs it with `--check`.
- **The evidence moved:** the research notes are now in `docs/evidence/` (with `INDEX.md`: the rules that cite each note). `docs/research/README.md` redirects there.
- **The skill is a router:** `skills/motion-pack/SKILL.md` is now a 139-line router through the playbook, with the detail in its references.

### How to use it

```bash
mp formats                                      # the 14 formats, one line each
mp brief "one-line idea" --goal launch          # picks the format, writes research-pack.md, then the plan
mp plan launch-film --length 35 --aspect 16:9   # a plan.json skeleton with the format's defaults and TODOs
mp new saas-launch ~/Movies/film --project project.json   # a project folder outside the pack, with the playbook block
mp render --aspect 16:9                         # (in the project folder) renders, then remuxes the master (see Fixed)
mp lint renders/saas-launch-16x9.mp4       # which rules the film kept and which it broke (eyes + ears measured)
mp study renders/saas-launch-16x9.mp4 --ours   # gaps against the format's closest exemplar, with the direction to move
mp rules --gaps                                 # the prose-only rules: the backlog
```

In `mp lint`, a failed house or measured-A rule is a FAIL, a failed measured or craft rule is a WARN, and an inferred rule is information only. The `playbook` block that `mp plan` writes into `project.json` is applied by `templates/_shared/playbook.mjs` (from `cues.mjs`). It plans the quiet open, the bass entry on the reveal, the silence under the name, the tail, the end hold and the first sound, and lists every change in `plan.playbook.applied`.

### Fixed: quiet renders (the v0.4.0 weak spot)

- **The cause was not the true-peak guard.** v0.4.0 blamed HyperFrames' true-peak guard for `data-story` and `explainer-diagram` rendering 7.4 and 8.7 dB under their -14 LUFS mixes. That was wrong: their AAC probes read -5.3 and -2.0 dBTP, under the -1 dBTP guard. HyperFrames' own audio stage, which assembles the track during the render, lowered it.
- **The fix:** `mp render` now remuxes the template's own master under the rendered picture (`tools/mp-audio.mjs`). It does this only when the page plays one master and every video is muted. The old `explainer-diagram` render, remuxed, reads -14.1 LUFS-I.
- **The limiter:** every master now ends in a 4x-oversampled true-peak limiter (`music/mixer.py` `master_for_delivery`). Its ceiling is lowered until the AAC probes read ≤ -1.1 dBTP. `film-scene`, whose mix stopped at -17.49 LUFS on the peak ceiling, re-mixes at -14.02 LUFS-I / -1.50 dBTP.
- **The checks:** `lint.sound.master_limiter` and `lint.sound.renderer_lowering` enforce both. The tests are `music/tests/test_master_delivery.py` and `tools/tests/test_mp_audio.py`.

### Three proof films, scored by `mp lint` before and after

Each film was rendered at 16:9 from a neutral `mp brief` with fictional placeholder brands, then linted with eyes and ears measured.

| format (template) | before | after | delivered loudness after |
|---|---|---|---|
| launch-film (`saas-launch`, 35 s) | 77.7, 11 FAIL (the v0.4.0 template) | **90.3, 0 FAIL** | -14.09 LUFS-I / -2.06 dBTP |
| proof-clip (`proof-film`, clip cut) | no v0.4.0 render exists; the stock plan scored 100 on the plan alone | **97.2, 0 FAIL** | -14.05 / -2.86 |
| explainer (`explainer-diagram`) | 82.3, 7 FAIL (the v0.4.0 template, rendered at -22.75 LUFS) | **93.9, 0 FAIL** | -14.06 / -1.04 |

The three films are attached to the v0.5.0 release.

### Known gaps

- **134 of the 338 rules are prose-only:** no check, plan default or part keeps them yet (`mp rules --gaps`).
- **Bass entry is checked from the plan only** (`plan.audio.bass_entry_s`). Ears has no low-band curve over time yet, so a render that moves the bass is not caught.
- **`refstudy` counts 0 cuts across soft transitions.** A film whose scenes change through dissolves or slides reads 0 cuts per minute, as the launch-film proof did.
- **5 of 24 templates read `plan.playbook`:** `saas-launch`, `proof-film` and `explainer-diagram` are tested against it (`tools/tests/playbook-apply.test.mjs`) and proved by the films above. `data-story` and `process-howto` build through the same explainer path. The other 19 have not been tuned or tested against a playbook block yet.
- **Unchanged since v0.4.0:** the eyes and ears weak spots listed under v0.4.0, other than the quiet renders.

## v0.4.0 (19 Oct 2026): genre templates, an editable project file, delivery and accessibility

The catalog grows from 954 to **1132** components. Genre templates go from 7 to **24**, plus 12 part demos. Every number in this section comes from `tools/count.py` or from a test or check named next to it.

### New: eight lanes of work

- **SaaS:** three templates (`saas-launch`, `saas-feature-drop`, `saas-explainer`), each with a 16:9 cut and a 9:16 re-layout. They come with 13 SaaS kit parts (an app window, a cursor journey, a command bar, an AI answer, pricing cards and more) and 12 synthesised UI sounds in a new `saas_ui` bundle. The demo screens show a fictional product with labelled placeholder data.
- **Hardware:** three templates (`hardware-reveal`, `hardware-teaser`, `spec-sheet`). They add 14 three.js hardware objects, an exploded-view choreographer, the `hw.*` overlay parts, 15 hardware sounds plus a `hardware_launch` bundle, and Blender recipes that take your own GLB.
- **Film:** three templates (`trailer`, `title-sequence`, `short-film`). They add 28 trailer sounds and a `trailer` bundle, genre trailer scores (thriller, sci-fi, horror, drama), a trailer cut planner, 8 film looks with LUTs, and 15 film overlay parts.
- **Human:** five templates for footage you record yourself (`tutorial`, `vlog-personal`, `podcast-clip`, `founder-story`, `course-lesson`), with 15 overlay parts. No person, voice or recording is ever generated. A missing input renders as a labelled placeholder, and a pull quote must be a verbatim run of the transcript or the build stops.
- **Research and structure:** `patterns/` holds 20 beat sheets (section timing as a share of runtime, average shot length, text ceilings, the CTA window) and 13 hook archetypes with frame-0 rules. `tools/structure_check.py` scores a plan against them (26 tests, 15 mutants). The sourced, graded evidence is in `docs/evidence/`.
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
