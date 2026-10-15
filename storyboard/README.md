# storyboard: see the story before it is built

Today a story is only seen after a full render. `storyboard` draws it first, from the files the pipeline already has:
- a **storyboard sheet** (PNG, HTML, PDF), one panel per shot, to read and approve;
- an **animatic MP4**: the panels timed to the shot durations, the sound intent as real pack sounds over a bed, mastered to the pack spec, with the timecode and shot id burnt in.

Approve both before the full render (`skills/motion-pack/SKILL.md`, production gate "storyboard approved"). A bad cut, a line nobody can read in time, a caption under a platform button or a missing honesty label is a one-line edit here and a re-render later.

Python, Pillow, numpy and the pack's own mixer; ffmpeg encodes. Nothing is downloaded, no model draws anything, and the same inputs give the same sheet and the same plan.

## Use it

```bash
python3 storyboard/board.py skills/story-script/assets/shotlist.example.json \
    --design skills/frame-design/assets/design.example.json \
    --out storyboard-out
```

Reads `shotlist.json` (story-script) and, optionally, `design.json` (frame-design). Writes into `--out`:

| file | what |
|---|---|
| `storyboard.png` | the sheet: a header and one card per shot |
| `storyboard.html` | the same cards with live text; the panel PNGs sit in `panels/` |
| `storyboard.pdf` | print-friendly: letter pages, two cards across, a card never split |
| `panels/<shot id>.png` | the board frame of each shot |
| `animatic.mp4`, `animatic.wav` | the animatic and its mix |
| `animatic.plan.json` | what is on which frame and which sound goes where: a pure function of the inputs (no clock, no paths), safe to commit |
| `report.json` | lint result and waiver, per-panel checks, fonts used, notes, and the measurements of the delivered MP4 |

Every flag except the shot list is optional:

```bash
python3 storyboard/board.py shotlist.json --design design.json --plan templates/<name>/out/plan.json \
    --music music/bed_tech_pulse_loop8 --out storyboard-out
python3 storyboard/board.py shotlist.json --bpm 96 --no-pdf --out storyboard-out
python3 storyboard/board.py shotlist.json --no-animatic --out storyboard-out
```

| flag | meaning |
|---|---|
| `--design design.json` | fonts (`type.display`, `.text`, `.mono`), px sizes (`type.sizes_px_at_1080`), palette, words per line, the safe zone (`safe.zones_9x16`, `safe.zones_16x9`), the hero third, `frames.labels.min_on_screen_s`. Without it: the pack's bundled OFL fonts and the defaults in `manifest.json` |
| `--plan out/plan.json` | with a built composition and Chrome, REAL key frames (below); its `cues` are the animatic's sounds; its `music` is the bed; `bpm` the click tempo |
| `--music music/<bed>` | the locked bed; its sidecar's beat frames are reported against your cuts (needs `python3 music/build_music.py` once) |
| `--bpm N` | with no bed, a click track at N BPM (default: the plan's, then 120) |
| `--safe <zone>` | a zone of `type/safezones.js` (default: the design's, then `conservative` for tall frames and `wideTitle` otherwise) |
| `--real auto\|always\|never` | real key frames: `auto` falls back to the schematic and says so, `always` fails (exit 2) when they are unavailable |
| `--project DIR`, `--hero-frac F` | the composition folder (default: next to the plan) and how far into each shot the key frame is taken (0.6) |
| `--allow-lint` | draw even when the shot list fails the story-script linter; the waiver is recorded in `report.json` |
| `--no-animatic`, `--no-pdf`, `--cut-ticks` | skip the MP4, skip the PDF, give hard cuts the pack's tick |

Exit codes: 0 drawn (warnings are in the report), 1 refused by the linter, 2 unreadable input.

## What it does, in order

1. **Lint first.** `skills/story-script/scripts/lint_shotlist.py` runs; on a FAIL nothing is drawn (exit 1) unless `--allow-lint`.
2. **One panel per shot.** The frame is laid out on the real canvas (1920 x 1080, 1080 x 1920, 1080 x 1080, 1080 x 1350) with the design's font at the design's px size and then scaled to 960 x 540 (and the like), so text is as big in the panel as it will be in the film.
   - **Schematic frame**: a subject block sized by the shot scale (`EWS` to `ECU`, `INSERT`, `SCREEN`, `OTS`, `2S`, `CARD`), the camera move as an arrow from the shot's `camera` field (push or pull as a start-to-end framing, pan, tilt, track, orbit, handheld, whip, a lock for a locked-off shot), the shot's text, the honesty label bottom-left, and the platform safe zone (shaded margins, dashed safe rect). A chip says `SCHEMATIC`: it is a drawing of the shot, not the picture.
   - **Real key frame** (`--plan`): `npx hyperframes@0.8.142 snapshot` at each shot's hero time replaces the drawing; the chip says `COMPOSITION <t> s`. The hero time is `--hero-frac` of the way into the shot, on the plan's own clock (its shot timing when it has the shotlist's shot ids or the same number of shots, else the shotlist's). With no composition, no browser or a failed snapshot, the schematic is drawn and `report.json` notes why.
   - Under the frame: shot id, beat, scale, time range (seconds and frames), action, sound intent, the text with its size and font, transition and reason, camera, honesty label, and that panel's warnings.
3. **Checks per panel** (thresholds from the linter's own `DEFAULTS` and `manifest.json`, never copied):
   - reading speed: words per second of the on-screen line against the shot's duration, at most 3.5, and the hold the words need (`0.35 + 0.28 x words`, at least 0.5 s);
   - text outside the safe zone: the laid-out text block and the honesty label against the `type/safezones.js` rect, with the side and the px;
   - an honesty label on screen for at least `frames.labels.min_on_screen_s` (2 s) in a row, counting consecutive shots with the same label.
4. **The animatic.**
   - Frames: shot boundaries are `round(cumulative seconds x fps)`, so the file has `round(total seconds x fps)` frames exactly and the audio is that long to the sample.
   - Cuts are hard. A `dissolve` or similar shows as a fade and a `whip` or `push` as a push over the first frames of the incoming shot (never longer than half of it), so a transition never changes the length. It shows the kind, not the final look: the real transition comes from `transitions/` at the full render.
   - Sound: with `--plan`, the plan's cue sheet. Without, each shot's `sound` line is split at `;` and "then", and each clause goes through `storyboard/sound_intents.json` to a pack sound; clause k of n lands n-ways across the shot, the first on its first frame. A clause no rule matches is listed in `animatic.plan.json` as `intent_only`: no sound is invented. Every non-cut transition gets its paired sweetener (`sfx/mpaudio/sweeteners.py`).
   - Bed: `--music` (or `plan.music`), else a click track plus a steady tone at the tempo. A placeholder pulse, not music.
   - Master: `music/mixer.py` (-14 LUFS-I, true-peak limiter, AAC probes), then the MP4 is decoded again and measured: -14 +/- 0.5 LUFS-I and at most -1.0 dBTP, lowering the mix until it is. Mixer warnings (a cue that needed more trim than the mixer allows) and the mixer's own sound lint (R4 and the like) are printed and kept in `report.json`.
   - Burnt in: timecode, shot id, beat and shot number, top left.

## Real key frames

```bash
python3 storyboard/board.py shotlist.json --design design.json --plan templates/<name>/out/plan.json --real always --out storyboard-out
```

Needs the composition built (`node make.mjs` in the template) and Chrome. `--describe false` is always passed to HyperFrames: it sends frames to a cloud vision model by default whenever `GEMINI_API_KEY` is set, and a storyboard must never do that by accident. `STORYBOARD_SNAPSHOT_CMD` replaces the `npx` command (the tests point it at a stub).

## Library use

```python
from storyboard.board import build
code, report = build('shotlist.json', 'design.json', out='storyboard-out', make_animatic=False)
```

## Worked example

`storyboard/examples/every-draft/` is this module run on `skills/story-script/assets/shotlist.example.json` with `skills/frame-design/assets/design.example.json`: the sheet `storyboard.png`, `report.json` (one warning: the honesty label of the 1.5 s shot s05 is on screen for less than 2 s, a real finding in the example) and `animatic.plan.json`. The MP4 is not in git (`.gitignore`); the command above rebuilds it in about 25 s. 480 frames at 30 fps, -14.1 LUFS-I and -2.6 dBTP decoded from the MP4.

## Honest limits

- A schematic panel is a drawing. It shows scale, the move, the words and where they sit; it does not show the picture, the colour or the character. Say "storyboard" to the person approving it, not "the film".
- The platform safe zones are the pack's working estimates (`type/safezones.js`, `verify: true`); the sheet says so. Re-check before a paid campaign.
- The camera arrow is read from words in the `camera` field (push, pull, pan, tilt, track, orbit, handheld, whip, locked). A field it cannot read draws nothing.
- Sound intent maps by keyword (about 45 rules). It places sounds on the shot's frames, not on the action inside the shot: use a plan's cue sheet for exact placement.
- The click track is a placeholder. A locked bed from `music/` is better; `ears` listens to the delivered animatic like any other MP4.
- The animatic MP4 is not byte-identical between machines (x264); the plan, the panels and the sheet are, with the pinned Pillow. The PNG hash is compared on one machine in two processes, not across operating systems.

## Tests

`python3 -m pytest -q storyboard/tests` (CI runs it). Every test is proved to fail on a mutation: `python3 tools/mutation_check.py storyboard/tests/<name>.mutants.json` for `core`, `checks`, `board`, `draw`, `animatic`, `real`, `intents` and `loudness` (CI runs all eight).

| file | what |
|---|---|
| `board.py` | the CLI and `build()` |
| `core.py` | inputs, the frame timeline, the safe rects (read from `type/safezones.js`), the linter's thresholds |
| `draw.py` | text layout at real size, the schematic frame |
| `checks.py` | reading speed, safe zone, label hold |
| `sheet.py` | the sheet as PNG, HTML and PDF |
| `real.py` | HyperFrames snapshot key frames |
| `animatic.py` | the plan, the picture, the mix, the mux and the measurement |
| `sound_intents.json` | the keyword rules from a sound line to `sfx/` ids |
| `manifest.json` | the checks and every threshold |
