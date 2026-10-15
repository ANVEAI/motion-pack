# eyes: automated looking and critique for a video's picture

An agent cannot see a delivered file the way a careful viewer with a ruler does. `eyes` is the visual twin of `ears`. It does what a ruler can:
- it decodes the MP4 with ffmpeg;
- it runs nine checks against the pack's own rules (`SKILL.md` hard rules and QA checklist, `references/platforms.md`, frame-design, `type/safezones.js`) or a stated house default;
- for every check it reports a measured value, pass / warn / fail, and a concrete fix with timestamps;
- it ends with the top 3 things a viewer would notice and a 1–10 score per category and per `references/critic.md` row (8 or more passes).

It measures. It does not replace one human look at a 360 px wide still and one on a phone.

numpy and scipy only (plus ffmpeg to decode; Pillow only in the tests). No model, no download, no clock: the same file and plan give the same report.

| file | what |
|---|---|
| `look.py` | the CLI and `analyze(path, plan=..., platform=..., fmt=..., draft=...)` for library use |
| `core.py` | probing, decoding (one analysis pass at 256 px long side, native-resolution frames on demand), cut detection, the platform safe rectangle, the plan's texts, holds and dips |
| `checks_frames.py` | frame 0, black / empty / frozen frames and stalls, flashes, banding |
| `checks_text.py` | safe zones (plan boxes, or text-like edges), text readability |
| `checks_edit.py` | pacing, composition (hero, bars, aspect, resolution), encode |
| `report.py` | scores, the ranked viewer summary, Markdown |
| `manifest.json` | the checks, their sources, and every threshold (`spec`): the single place to tune a house default |
| `tests/` | `python3 -m pytest -q eyes/tests`: synthetic clips for every check, and `*.mutants.json`, the mutation proof (CI runs both) |

## Use it

```bash
python3 eyes/look.py out/film-9x16.mp4 \
    --plan templates/<your-video>/out/plan.json \
    --platform tiktok.organic \
    --json reviews/r1/eyes.json --md reviews/r1/eyes.md
```

Replace the `<placeholders>`; every flag except the video is optional.
- `--plan`: texts (`plan.texts`), shots (planned holds and dips, `paceRule`, the template's format) and the platform come from it.
- `--platform`: a `templates/_shared/plan.mjs` preset (`tiktok.organic`, `reels.organic`, `shorts.organic`, `yt.ad.15`, `yt.bumper.6`, `meta.ad.9x16`, `x.video`, `linkedin.video`, `hero.web`) or a `type/safezones.js` id (`conservative`, `tiktok`, `reels`, `shorts`, `ytAd`, `metaStory`, `wideTitle`, `wideAction`). Default: the plan's, else by aspect (`conservative` for 9:16, `wideTitle` for 16:9).
- `--json` and `--md`: where the report goes.

Other flags:
- `--format hype_ad|beat_edit|talking_head|mime_spot|short_film` names the `cuts/patterns.json` pace format for the shot-length range (default: the plan's template: ad, beat-edit, talking-head, character-spot, film-scene).
- `--draft` waives the resolution and bit-rate rules for an animatic (production gate 4: 960x540).
- `--fps 25` overrides the frame rate used for frame rules (default: the video's); `--quiet` prints nothing.

`tools/critic_pack.sh` runs `eyes` on every review (it passes the composition's `out/plan.json`; `EYES_PLATFORM`, `EYES_FORMAT` and `EYES_DRAFT=1` set the flags) and puts its report in `eyes/eyes.md`, its scores in `critic.json`, its top issues and the suggested picture scores in `review.md`.

### What the plan can tell eyes (all optional)

Text checks need the plan to say where the text is. The `ad`, `beat-edit` and `talking-head` plans carry timing only (`shots[].text` with `textDur`, `captions[]`); a plan that names boxes gets an exact safe-zone, size and contrast check:

```json
{"fps": 30, "size": [1080, 1920], "platform": "tiktok.organic",
 "texts": [{"id": "hook", "text": "Your desk, handled.", "t": [0, 2.5], "box": [96, 300, 984, 420], "fontPx": 96, "role": "read", "fg": "#FFFFFF"}],
 "holds": [{"t": [12.5, 15], "why": "end card"}],
 "black": [[7.0, 7.4]],
 "eyes": {"letterbox": false}}
```

| field | meaning |
|---|---|
| `texts[]` | `text`, `t: [start, end]` (or `start` + `end` / `dur`), `box: [x0, y0, x1, y1]` in px of the plan's frame, `fontPx`, `role` (`read` the default, `headline`, `caption`, `label`, `endcard`, `lowerthird`, `inworld`), `fg` (the text colour, which makes the contrast measurement exact; without it the colour is estimated and a contrast failure is capped at a warning), `lines`. `type/safezones.js captionBox` computes boxes |
| `size` / `W`, `H` | the plan's frame size; boxes and font sizes are scaled to the delivered frame (an animatic plan against a render) |
| `shots[].hold: true`, `holds`, `audio.quiet` of kind `hold` | planned still pictures: judged as shape, not as a freeze or a static hold |
| `black`, a shot whose `tx` contains `dip` | planned dark stretches (a dip to black is not a fault) |
| `eyes.letterbox`, `layers` / `look` naming bars or letterbox | bars are a look, not a mistake |
| `paceRule {aslMax, longMax}` | the shot-length rule (`templates/_shared/plan.mjs lintPace`); the picture's detected shots are judged against it |
| `platform`, `template`, `format` | the platform preset and the pace format |

Backward compatible: with no plan at all, every check that can run without one does (frame 0, black and frozen runs, flashes, banding, text-like edges in the unsafe bands, pacing's static hold, bars, aspect, encode); the text checks say `n/a`.

## The checks

| check | measures | verdict (spec in `manifest.json`) |
|---|---|---|
| `eyes/frame0` | luma mean and spread of frame 0; the first frame that visibly differs from it; the subject: the WCAG ratio between the 85th and 15th luminance percentile around the strongest centre-surround response | black (mean ≤ 16 and std < 6) or near-uniform (std ≤ 3) fails; std ≤ 12 warns; a subject under 1.5:1 fails, under 3:1 warns; first change after frame 6 warns up to 0.5 s and fails after (SKILL.md: a black frame 0 is banned, the first visible change lands by frame 6) |
| `eyes/frames` | black runs, empty (near-uniform) runs, frozen runs (consecutive frames identical to 0.15 level, no pixel moved by 6 levels), a black tail, timestamp gaps | unplanned black ≥ 3 frames fails (a 2-frame blip does not); a black tail ≥ 0.3 s warns, ≥ 1 s fails; empty ≥ 0.5 s warns, ≥ 1 s fails; frozen ≥ 0.5 s warns, ≥ 2 s fails; a gap over 1.5 frames (and 0.1 s) is a stall and fails. Planned holds and dips are notes; without a plan a freeze that runs to the end and is ≤ 4.5 s is read as an end card |
| `eyes/flashes` | WCAG 2.3.1 general flash (pairs of opposing changes of 10% relative luminance, darker side under 0.80, over 25% of the frame) and red flash (saturated red: R / (R + G + B) in linear light ≥ 0.8 and R − G − B ≥ 16 / 255), counted in any 1 s window | more than 3 fails; exactly 3 is a note |
| `eyes/banding` | on up to 12 native-resolution frames (the middle of each shot): rows and columns where runs of one luma value at least 16 px wide (at 1080) are separated by 1–2 level steps a viewer can see (2% Weber contrast in linear light over level plus 1.5% flare, so roughly luma 25–110), at least twice in the line | a frame with ≥ 4% of its area in staircases warns; the check fails when frames at ≥ 20% are a quarter of the samples. The fix names grain (`upload-safe` stock, `grain` ≥ 0.02), dither and the encode |
| `eyes/safezones` | with `plan.texts` boxes: each against the platform safe rectangle (`lintRect`, 0.5 px tolerance); without: persistent text-like edge blocks (strong edges closing into a line 12–300 px tall at 1080, ≥ 1.8:1, 4–50% edge density, ≥ 4 edge runs on the middle rows, 3:1 luma ratio, repeated at the same place on 2 samples) and how much of each lies outside the rectangle | a box that leaves the rectangle fails; a block ≥ 50% outside fails, ≥ 15% warns |
| `eyes/readability` | per text: size at the 1080 reference (shorter side) and on a 360 px wide phone, time on screen, the hook text start and length, and the WCAG contrast measured from the decoded pixels (text colour against the 5th and 95th percentile of the backdrop, up to 3 frames of its time, the worst taken) | below the frame-design floor (read line 48 / 56 px wide / tall, headline 96, caption 40 / 64–80, label 28 / 30, end card 28 / 30, lower third 44 / 48) fails; under 9 px on a phone fails; shorter than 0.35 s + 0.28 s per word (≥ 0.5 s) fails (a warning from 80% of it, and always a warning for captions, which follow the voice); a label under 2 s fails; contrast ≥ 4.5 passes, 3–4.5 warns, under 3 fails; hook text after 0.3 s (tall) / 0.5 s (wide) warns; hook over 7 words warns |
| `eyes/pacing` | hard cuts (frame difference ≥ 2.5% of full scale and 4× its neighbours) per minute, shots, median and mean shot length, shots per 30 s, the longest stretch that stays within 3 levels of where it began | a static stretch over 3.5 s warns, over 7 s fails (a planned hold is a note); the plan's `paceRule` (average and longest shot) or the format's average shot length (`cuts/patterns.json pace`) warn when missed |
| `eyes/composition` | key frames (shot middles, first, last): saliency blobs and how many match the strongest; persistent black bars on each side; aspect against the platform's accepted shapes; the shorter side | a second blob ≥ 80% as strong as the first on 30% of the key frames warns (a proxy: it does not know what the hero is); bars ≥ 2% warn, ≥ 15% of the area fail unless the plan asks for them; a wrong aspect fails; shorter side 720–1079 warns, under 720 fails (`--draft` waives) |
| `eyes/encode` | codec, profile, pixel format, faststart (moov before mdat), colour tags, longest keyframe gap, bits per pixel per frame, blockiness (the step across 8 and 16 px grid lines over the step elsewhere) | not yuv420p fails; not H.264, moov after mdat, HD with no colour tags, a keyframe gap over 5 s (fails over 10 s), under 0.01 bits per pixel (fails under 0.004), blockiness 1.75 (fails at 2.5) warn |

**Scores** (`report.py`) are ears' rule: each category starts at 10, a fail costs 3, a warn costs 1, one problem counts once however many frames or lines it hits, and any fail caps the category at 7. The critic rows are minima: `critic_hook_2s` = `hook`; `critic_phone_readability` = min(`safezones`, `readability`); `critic_motion` = min(`continuity`, `flashes`); `critic_variety` = min(`pacing`, `composition`). `banding` and `encode` have no rubric row: fix them before delivery.

**Platform geometry.** `eyes/manifest.json` copies `PLATFORMS` and `SIZES` from `templates/_shared/plan.mjs` and `SAFE` from `type/safezones.js`; `eyes/tests` fail when they drift. A 9:16 frame always uses the `conservative` rectangle (x 65–960, y 269–1248 at 1080 × 1920: SKILL.md), other shapes the preset's fractions. A shape the platform does not take falls back to the shape's default and `eyes/composition` says why. Every per-platform safe zone is a working estimate (`verify: true`): look at the current apps before a paid campaign.

## Validation (15 Oct 2026, on real files)

**A real clip: `clip02-9x16.mp4`** (the "inside the box" build-in-public short, 20 s, 1080 x 1920, H.264 yuv420p, 1.38 Mb/s, no plan; `eyes/look.py clip02-9x16.mp4`). What it found:

| check | result | what it means |
|---|---|---|
| `eyes/frame0` | warn | frame 0 moves on frame 4 (pass), but the subject reads at 2.15:1 against its backdrop (needs 3:1): a dark box on a soft grey blur |
| `eyes/frames` | warn | a 1.0 s frozen picture at 6.70-7.70 s (consecutive frames identical); the last 2.33 s is a still end card (a note without a plan) |
| `eyes/flashes` | pass | no general or red flash |
| `eyes/banding` | fail | 7 of 12 sampled frames have 5-68% of the frame in one-step luma staircases (worst 68% at 14.9 s; the blurred grey backdrop of the opening 0.8-2.5 s reads 33%). The fix it prints: grain over the gradient (`upload-safe`), or dither before the encode, CRF 18 or lower |
| `eyes/safezones` | pass | 18 persistent text-like blocks, all inside x 65-960, y 269-1248 (the "Concept render" label and the headline) |
| `eyes/pacing` | pass | 4 shots from 3 hard cuts (9 a minute), median shot 3.9 s, the longest static stretch 2.7 s |
| `eyes/composition` | pass | 9:16, 1080 px, 14% of key frames with a second focal point, no bars |
| `eyes/encode` | warn | the longest keyframe gap is 6.1 s (183 frames; over 5 s warns); blockiness 1.43 (under 1.75); 0.022 bits per pixel |

Scores: hook 9, continuity 9, flashes 10, banding 7, safezones 10, composition 10, encode 9; critic rows hook 9, phone readability 10, motion 9, variety 10. Banding is the one to fix before posting. The text rows are `n/a` because no plan names the text.

**The pack's own committed demos, with their plans** (the `critic_pack` way, `--plan out/plan.json`):

| file | notable findings |
|---|---|
| `templates/ad/out/ad-15.mp4` | the planned dip to black (12.4-12.6 s) and end-card hold (13.7-15 s) are read as planned; three unmarked 0.6-0.8 s still pictures warn; two proof lines are on screen 1.75 s but 7 and 6 words need 2.31 s and 2.03 s (a fail and a warn); the average shot length 3.0 s is over the plan's 2.5 s because only hard cuts are detected (the whip and push are not) |
| `templates/beat-edit/out/beat-edit.mp4` | the first visible change is on frame 11 (0.37 s; the rule is frame 6); a 1.9:1 subject at frame 0; clean flashes, banding and encode |
| `templates/character-spot` and `film-scene` | `moov` after `mdat` (no faststart); the character spot is 0.008 bits per pixel and has three unmarked still stretches (up to 1.2 s) |
| `templates/demo-r6-type/out/demo-r6-type.mp4` | frame 0 is black; 3-16 black frames after each of the cuts at 10.5, 16, 23 and 32 s; a 9 s stretch (23-32 s) that barely changes; banding on 8 of 12 frames (near-black vignette); keyframe gap 8.3 s |
| `templates/talking-head/out/talking-head.mp4` | clean except one banded end frame (97% of the last frame) and ten word-synced caption chunks shorter than 0.35 s + 0.28 s per word (warnings: captions follow the voice) |
| `examples/brewly-teaser/*.mp4` | banding on 9 of 12 frames (soft blurred backdrops); an 8-word read line; blockiness 1.9 (9:16) and 2.3 (16:9); the 16:9 file with the 9:16 plan fails aspect (`--platform yt.ad.15` for it) |

These are findings about files made with the pack's own defaults, not about `eyes`: they are the reason the thresholds above were set where they are. The first cut flagged banding on every demo; it counted 1-level steps on bright backdrops, which sit under 1% of luminance. The visibility rule (2% Weber) keeps the bright demos clean (ad, beat edit, character spot, film scene) and still finds the dark soft ones.

**Synthetic proof** (`eyes/tests`, 61 tests, x264 clips of 1-7 s): a 4 Hz black-and-white strobe fails and 2 Hz and 3 Hz pass; the same strobe over 15% of the frame passes and over 30% fails; a saturated-red flicker of equal luminance fails at 4 Hz and passes at 2 Hz; a 4 Hz flicker under a 10% luminance swing passes; a posterised ramp fails, the same ramp with grain passes, a bright ramp and a flat field are not banding; text in the 9:16 right band (full-size clip) and in the bottom band fails, in the safe area passes; measured contrast of white text on a dark backdrop equals the WCAG ratio (18.4 against a hand-written formula, to 10%); a black frame 0 fails; a 2-frame black blip passes; a 0.5 s timestamp gap is a stall; the same clip gives the same report twice.

**Mutation proof** (`eyes/tests/*.mutants.json`, run by `tools/mutation_check.py`, in CI): 110 one-line changes to `core.py`, `checks_frames.py`, `checks_text.py`, `checks_edit.py` and `report.py` (a threshold off, a branch removed, a side of a rectangle left unchecked, a planned hold ignored); every one makes at least one test fail.

## Limits

- **It measures; it does not look.** It cannot say whether the picture is good, what the hero is, whether the words say the right thing, whether motion has intent, or whether a look is cheap. Look at `phone/` once and lower the score for what you see.
- **Text needs the plan.** Without `plan.texts` the size and contrast rows are not measured, and the safe-zone check is a heuristic on edges: it cannot read, so in-scene text and icons in the unsafe bands count too, and low-contrast or very small text is missed.
- **Flash safety is an approximation of WCAG 2.3.1.** Changes are taken between consecutive frames (a slow multi-frame ramp is not seen), same-direction steps merge, and the area is the share of the whole frame, not a 10-degree field. It does not replace a Harding-style test for broadcast.
- **Banding is luma only, on up to 12 sampled frames, at 8 bit.** It judges steps a viewer can see (roughly luma 25-110); a 10-bit master that the platform re-encodes to 8 bit can band after delivery.
- **Cuts are hard cuts.** Whips, pushes, dissolves and in-shot moves are not counted, so a planned ASL can read longer than the plan. A static stretch is a picture that stays within 3 levels of where it began.
- **The hero check is a saliency proxy.** It counts competing focal points; it does not know which one is the hero, and text is a focal point.
- **Frozen is "identical", not "still".** A hold with grain is not frozen, and a freeze that the plan does not mark (or that is under 2 s) is a warning, because an unmarked text hold looks the same as a stall.
- **Encode numbers are proxies.** Blockiness is a grid-step ratio (a smooth gradient at CRF 14 reads 1.4); bits per pixel depends on the content; an untagged HD file is decoded with the matrix ffmpeg assumes.
- **Platform safe zones are estimates** (`verify: true` in `type/safezones.js`); check the live apps before a paid campaign.
