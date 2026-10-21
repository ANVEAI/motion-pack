# Delivery and accessibility

Most open-source video kits stop at "here is an MP4". This part of the pack covers what happens next:
- captions to a broadcast and streaming standard;
- an audio-description script;
- an accessibility lint;
- delivery profiles per platform;
- a Lottie export for apps and websites.

Every tool is plain Python (plus one Node sampler for Lottie). None of them reads the clock or the network, except the one pinned schema fetch. Each says where its numbers come from: `tools/a11y/standards.py` holds every limit with its grade (platform, study, practitioner or house).

| job | tool | input | output |
|---|---|---|---|
| captions (SRT, WebVTT, TTML/IMSC1.1, burned in) | `tools/captions/export.py` | `plan.json` (transcript, cues, music, texts) or `words.json` | `captions.<lang>.{srt,vtt,ttml}`, events JSON, validator report, captioned MP4 |
| caption validator | `tools/captions/validate.py` | any SRT / VTT / TTML / events JSON | violations with timestamps; exit 1 on a fail |
| audio description | `tools/describe/export.py` | `plan.json` (+ `shotlist.json`, `words.json`) | script `.txt`, WebVTT descriptions track, extended-AD track and the ffmpeg arguments for the paused picture |
| accessibility lint | `tools/a11y_check.py` | `plan.json`, `design.json`, the caption events, the MP4 | pass / warn / fail per check, JSON and Markdown |
| delivery profiles | `tools/deliver.py` | the master MP4 (or an alpha source) | the platform file, measured and verified |
| Lottie export | `tools/lottie/export.py` | a small JSON spec of type / draw-on / shape layers | Lottie JSON, validated against the pinned spec schema |

## 1. Captions

```bash
python3 tools/captions/export.py --plan templates/tutorial/out/plan.json --out out/captions
python3 tools/captions/export.py --plan out/plan.json --sdh                      # speaker IDs + [sound] tags
python3 tools/captions/export.py --words words.json --frame 1080x1920 --platform reels --audience kids
python3 tools/captions/export.py --plan out/plan.json --burn out/film.mp4         # also a burned-in MP4
python3 tools/captions/validate.py out/captions/captions.en.vtt --frame 1920x1080
```

**The rules.** Sources are in `docs/evidence/launch-video-patterns.md` (reading-speed table):

| rule | value | grade |
|---|---|---|
| characters per line | 42 | platform (a streaming timed-text guide) |
| lines per event | 2 | platform |
| reading speed | 20 characters/s adults, 17 children (`--audience kids`) | platform |
| event duration | at least 5/6 s, at most 7 s | platform |
| gap between events | at least 2 frames; a gap under 0.5 s is closed to exactly 2 frames ("chaining") | practitioner / house |
| line breaks | one line whenever it fits; prefer a break after punctuation; never end a line on a word that binds to the next (articles, prepositions, auxiliaries, pronoun subjects); bottom-heavy or even shape | house, modelled on published guides |
| position | the bottom of the platform safe rectangle (read from `type/safezones.js` and the `templates/_shared/plan.mjs` presets, never copied); raised to the top while a `plan.texts` box sits at the bottom | house |

**How events are cut.** A dynamic programme partitions the words. An event:
- fits 2 x 42 characters;
- keeps one speaker;
- holds no pause over 1.5 s;
- lasts at most 7 s of speech.

Boundaries after a sentence end cost least. Boundaries after a binding word cost most. An event that could not stay up for 5/6 s before the next speech is pushed to join a neighbour.

Timing then extends each event to max(last word, start + 5/6 s, start + characters / cps) without crossing the 2-frame gap. Times snap to the frame grid.

**Fast speech is reported, not hidden.** When people talk faster than 20 cps and there is no gap to extend into, the validator says so at those timestamps. The fix is an edit (condense the wording) that only a person can make.

**SDH (`--sdh`).**
- **Speaker IDs** (`ANA:` or `[Ana]`) go on the first event of each turn, only when there is more than one speaker. Names come from:
  - `plan.supers` (clip to name);
  - `plan.speakers`;
  - the voice segments;
  - `--speaker id=Name`.
- **Sound tags** come from the plan's SFX cues, using the head of each sound's `sfx/manifest.json` description (`[phone buzz]`, `[applause]`).
  - At level `key` (the default) only sounds that carry story are tagged: devices, foley, cartoon, crowd, hits, logos and stingers. UI ticks, transitions, whooshes, risers and ambience are never tagged.
  - A cue's own `"sdh": "door slams"` wins over the automatic tag. `"sdh": false` drops it.
- **Music** gets one `[mood music]` tag where the bed starts, after a planned quiet open.
- **Where a tag goes:** a tag sits in its own event in a speech gap. If there is no gap, it goes on a free line of the speech event, but only while that event stays under the reading speed. Otherwise it moves to the next gap (within 2 s, or 10 s for music) with a note in the events file.

**Formats.**
- **SRT** is plain and carries no position. `an8=True` in `formats.srt` adds the `{\an8}` top tag, which some players honour and others print.
- **WebVTT** cues carry `line:<pct>%[,end] position:<pct>% size:<pct>% align:center` from the placed box. With `--sdh` speech is wrapped in `<v Name>` spans.
- **TTML** is TTML2 in the IMSC1.1 Text profile:
  - media time base and clock times;
  - one region per position (bottom, top), in percent;
  - `<br/>` between lines and a background span style.

  It is checked as XML and round-tripped by the tests. It has NOT been run through a third-party IMSC conformance validator.

**Burn-in.**
- Each event becomes a transparent PNG: bundled OFL Manrope, white on a 76% black box (64 px at 1080 wide on 9:16, 48 px at 1080 high on 16:9).
- ffmpeg overlays the PNGs with `enable` windows. Audio is copied untouched, so the measured loudness stays.
- The burned-in track is cut again with the line length that fits the safe width at that size: 23 characters on 9:16, not 42.
- No libass is needed.

## 2. Audio description

```bash
python3 tools/describe/export.py --plan out/plan.json --out out/ad
python3 tools/describe/export.py --plan out/plan.json --shotlist shotlist.json --out out/ad --extend-video out/film.mp4
```

**No voice is synthesised.** The pack makes no TTS voice for description. The output is a script for a human describer, plus a WebVTT track that a player or screen reader can voice. Load it with `<track kind="descriptions" srclang="en" src="ad.en.vtt">`; the kind comes from the `<track>` element, not the file.

**What gets said**, in this order of trust:
1. `shot.ad` (or `shot.describe`) in the plan, written by the author.
2. The story-script shot list's `action` for that shot id.
3. A draft built from the plan: the shot's on-screen text and `plan.texts`, plus the overlays live in the shot (`lowerThird` becomes "a name caption: <name>", `chart.*` becomes "a chart"). Long-lived HUD parts (over 8 s) are skipped. Every such line is marked DRAFT: a plan says what was planned, not what a viewer sees, so a person checks each line against the picture.

**Standard AD.**
- A line goes in the first speech gap that opens near its shot. It starts 0.15 s after the speech before it and ends 0.2 s before the next.
- It is read at 2.6 words/s, a house default; set `--wps` to your describer's pace.
- If the full line does not fit, its short form is tried.
- Lines never overlap speech or each other (tested).

**Extended AD.**
- A line that fits no gap becomes a pause in the picture at a word boundary, never inside a word, for the time the line needs.
- Later cues shift by the pauses before them. `ad-extended.<lang>.vtt` is on the extended timeline.
- `core.ffmpeg_extended` builds the paused picture: `tpad` clones the frame and `apad` inserts silence per segment, then everything is concatenated. A real 1 s clip with a 0.5 s pause measures 1.5 s in the tests.

## 3. Accessibility lint

```bash
python3 tools/a11y_check.py --plan out/plan.json --design design.json --captions out/captions/captions.en.events.json --mp4 out/film.mp4 --md a11y.md
```

| check | what it measures | thresholds |
|---|---|---|
| `a11y/flash-plan` | Flash transitions, shots marked `flash`, and impact / invert / strobe items, counted in any 1 s window before a render. With `--mp4` it runs `eyes/flashes` (general and red flash, measured) and adds its result. Nothing is duplicated from eyes. | more than 3 per second fails, 3 warns (WCAG 2.3.1) |
| `a11y/caption-contrast` | Each caption box against the real decoded frame behind it: the caption colour over the scrim blended onto the picture, the worse of the background's 5th and 95th luminance percentiles. Style `burn` (the scrim) or `plain` (no box: a stroke and shadow do not count in WCAG). | 4.5:1 passes, under 3:1 fails (eyes readability thresholds) |
| `a11y/text-size` | `plan.texts` `fontPx` per role against the frame-design floors for the aspect (`eyes/manifest.json` `readability.floors_px_1080`) | the floor table |
| `a11y/reading-time` | `plan.texts` time on screen vs max(0.5, 0.35 + 0.28 s per word) and 3.5 words/s; caption events vs the caption validator's cps and duration rules | as listed |
| `a11y/colour-blind` | `design.json` palette under protan / deutan / tritan simulation (Machado, Oliveira & Fernandes 2009, severity 1.0, linear RGB). Role pairs at least 15 apart in CIEDE2000 for typical vision that fall under 10 in a simulation are flagged; so are text pairs whose WCAG ratio drops under 4.5. Extra pairs: `design.json` `a11y.distinguish`. | house thresholds; CIEDE2000 matches the published test pairs to 1e-4 |
| `a11y/colour-only` | WCAG 1.4.1. A state colour (success, warning, error...) needs a declared non-colour cue in `design.json` `a11y.cues`. A plan part that colour-codes several items (a `colors` list) needs `labels` of the same length. | warn |

**What it found on the shipped plans (16 Oct, code-only).** `hardware-reveal` and `spec-sheet` set several read lines at 44 px on 16:9, under the 48 px read floor; it fails them. Every other template plan passes. The frame-design example `design.json` warns: its accent text pair drops to 3.98:1 under deuteranopia simulation, and its `success` colour declares no non-colour cue.

## 4. Delivery profiles

```bash
python3 tools/deliver.py --list
python3 tools/deliver.py out/film.mp4 --preset youtube --preset reels --out dist/
python3 tools/deliver.py out/film.mp4 --preset broadcast-prores --region atsc --dry-run
python3 tools/deliver.py out/overlay.webm --alpha-src --preset alpha-prores4444
```

Each preset is a pure function, `build(preset, src, out, fps, measured, ...)`, that returns the ffmpeg argument list. The tests check the lists field by field.

**What every video preset writes:**
- **BT.709 colour tags:** primaries, transfer, matrix, limited range. They are set on the frames (`setparams`) as well as the encoder; ffmpeg 7+ takes the stream tags from the frames, and the encoder flags alone left primaries and transfer unset in our test.
- **`+faststart`** on MP4 and MOV. The verifier reads the atom order.

| preset | video | audio | loudness target (source) |
|---|---|---|---|
| `youtube`, `shorts` | H.264 High, CRF 18, closed GOP of half the frame rate, 2 B-frames | AAC 384k 48 kHz | -14 LUFS, -1 dBTP (YouTube publishes none; about -14 is reported by audio-tool makers; the pack master is -14) |
| `reels`, `tiktok`, `x`, `linkedin` | H.264 High, CRF 19-20, 2 s GOP | AAC 192-256k | -14 / -1 (house: these platforms publish no target). `x` also checks 2 min 20 s and 512 MB |
| `broadcast-prores` | ProRes 422 HQ (`prores_ks` profile 3), 10-bit 4:2:2, MOV | 24-bit PCM 48 kHz | EBU R128 -23 LUFS / -1 dBTP, or `--region atsc`: ATSC A/85 -24 LKFS / -2 dBTP. Check the broadcaster's own sheet |
| `web-h264`, `web-hevc` (`hvc1` tag), `web-av1` (SVT-AV1) | CRF 23 / 26 / 35 | AAC 128k | -16 (house, `plan.mjs` `hero.web`) |
| `gif` | two-pass palette, 15 fps, 480 px, loops | none | n/a |
| `webp` | `libwebp_anim` q75, loops | none | n/a. This machine's ffmpeg has no libwebp: arguments tested, encode skipped |
| `alpha-prores4444` | ProRes 4444, `yuva444p10le`, 16-bit alpha | 24-bit PCM | -14 |
| `alpha-webm` | VP9 `yuva420p`, alt-ref off | Opus | -16 |

**Loudness, step by step:**
1. Pass 1 measures the source with `loudnorm`.
2. A master within 0.5 LU of the target and under the true-peak ceiling keeps its audio. An AAC source is copied into an AAC preset: no second lossy generation.
3. Anything else gets two-pass linear `loudnorm` (one gain, dynamics kept), then resampling back to 48 kHz.
4. Lossy outputs aim 0.5 dB under the ceiling, because an AAC decode overshoots. The rule on the delivered file is still at most -1 dBTP; the verifier measures it with `ebur128=peak=true`.
5. When the gain would push the peaks over the ceiling, ffmpeg's `loudnorm` drops out of linear mode into dynamic mode. Read the verifier's numbers.

**Alpha sources.** A VP9 WebM keeps its alpha only when it is decoded with libvpx (`--alpha-src`): the native decoder drops the plane. The verifier decodes the first frame to RGBA and reports the smallest alpha value.

**Verified on real encodes** (1 s, 128x72 synthetic clip): `youtube`, `reels`, `broadcast-prores`, `web-h264`, `web-hevc`, `web-av1`, `gif`, `alpha-prores4444`, `alpha-webm`. For each the tests checked the codec, the BT.709 tags, faststart, the alpha plane and the true peak. Loudness targets on real programmes were not measured in this round; a 1 s clip has no meaningful integrated loudness.

## 5. Lottie export

```bash
python3 tools/lottie/export.py tools/lottie/examples/title.json -o out/title.lottie.json --validate
python3 tools/lottie/export.py --matrix
LOTTIE_WEB=/path/to/lottie-web/build/player/lottie.min.js node tools/lottie/playcheck.mjs out/title.lottie.json --frames 0,30,60
```

**How it works.**
- `tools/lottie/sample.mjs` samples the pack's own pure functions at the frame rate: `type/presets.js` `unitStates`, the `drawOnAt` maths of `type/gfx/drawon.js`, and `type/ease.js` `springTrack` and eases. Nothing is re-implemented.
- `export.py` turns the samples into linear keyframes. A key is dropped only when a straight line from the last kept key reproduces the frames in between within a tolerance:
  - 0.05 px for position;
  - 0.05% for scale;
  - 0.1% for opacity.

  A test evaluates the Lottie keys at every frame and compares them with the sampled state.
- **Text** becomes glyph outlines from the bundled OFL Manrope (fontTools; variable weight instanced; advance widths; no kerning). Every player draws outlines, and the Lottie spec has no text layer.
  - Each animation unit is a shape layer, laid out like `type/render-canvas.js`.
  - `mask: 'line'` presets get a static line-box layer mask; `clip` wipes get an animated mask.
  - The layer's in point is the text's `at`, the same timed clip a composition gives it.
- **Draw-on icons** become trim paths (`tm`, sequential), one per SVG element. Path, line, polyline, polygon, circle, ellipse and rect are supported; arcs are converted to cubics. Run icons through the motion-stack SVGO config first, because element transforms are not applied.
- **Shapes** (rect, ellipse, path) move by `springTrack` classes or eased keys.

**What exports, measured by `--matrix`** (it samples every preset; nothing here is a claim):

| exact | lossy (dropped property) |
|---|---|
| `maskRise`, `charRise`, `charStagger`, `typewriter` (no caret), `wipe`, `elasticPop` | `wordStagger`, `blurIn`, `scaleSlam` (blur); `trackingCollapse` (letter-spacing); `weightMorph` (weight, letter-spacing); `flipSplit` (3D rotation); `scramble` (glyph swaps); `glitchSplit` (RGB split); `outlineFill` (outline to fill) |

A lossy preset is refused unless `--allow-lossy`, and the report lists what was dropped.

**Why the rest cannot export:**
- Blur, the RGB split and other effects are outside the Lottie spec.
- 3D flips need 3D layers.
- Weight animation and glyph scrambles change the outline every frame.
- The `type/gfx` parts draw full SVG frames with their own layout per frame (charts, UI kit, lower thirds, counters). They are not position / scale / opacity / path keyframes, so they are not exported. Bake them as video instead.
- Canvas and WebGL parts (layers, objects, cards) are not exportable for the same reason.

**Sub-frame playback.** Keys are linear between frame samples. A player that renders between frames (lottie-web does by default) shows linear in-betweens of the pack's curve. `setSubframe(false)` gives exactly the sampled frames.

**Validation.**
- `tools/lottie/validate.py` fetches the Lottie Animation Community schema (lottie-spec 1.0.1) from a pinned URL. It refuses the file unless its SHA-256 matches, and caches it in `~/.cache/motion-pack` (`$MP_CACHE`). The schema is not vendored.
- It validates with `jsonschema` (Draft 2020-12; pin `jsonschema==4.25.1`, not in `requirements.txt` yet). Structural checks always run.
- The example exports valid against the schema.
- **lottie-web 5.13.0** (SVG renderer, headless Chrome, `playcheck.mjs`) drew the title, the draw-on check mark and the spring card as expected. Two player requirements came out of that run and are now built in: a layer needs `hasMask: true`, and every mask needs an `x` expansion property, or lottie-web ignores the masks or draws nothing.
- **Not tested:** dotLottie / ThorVG and the mobile players.

## Not done in this round

- No render of a full template through the burn-in or extended-AD paths: the disk was nearly full, so this round was code-only. Everything ran on 1 s fixtures and on the committed template plans.
- No IMSC conformance tool run.
- No human listen of an AD script, and no human review of the draft descriptions.
- The audio-description and caption tools read `plan.json`. Templates that keep their transcript elsewhere need `--words`.
