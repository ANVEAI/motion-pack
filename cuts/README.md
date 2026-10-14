# motion-pack / cuts

Cut-pattern library as data (`patterns.json`) plus `cutgen.py`, which turns a BPM and a pattern into frame-exact cut
points (stdlib Python, deterministic, JSON out). Numbers are house starting values from `../docs/research/edit.md`
(2.3 J/L, 2.5 smash, 3.3 interrupt ladder, 6.1 pace, 7.2 talking head) and `../docs/research/sound.md` (4.10, short-film
bundle). They are tunable heuristics, not platform facts.

## What is in `patterns.json`

| block | entries | tags |
|---|---|---|
| `beat` | every_beat, every_2, every_bar, every_2bars, eighths, offbeat, backbeat, push_and, tresillo_332, son_clave_32, downbeat_hits | beat-edit, music, montage |
| `sections` | build_accelerate (hero cut on the next downbeat), drop_doubletime, hook_3s, verse_chorus, breath_out | structure, build, hook, cta |
| `split` | J (audio leads 400 ms), L (audio lingers 600 ms), film_J (12-24 frames), broll_lead (picture leads VO by 150 ms) | jcut, lcut, dialogue, film, talking-head |
| `talking_head` | autocut numbers, reframe_alternate 1.0/1.15/1.0/1.25 on the eyes, punch_in 1.12 max 1 per 4 s, slow_push, beat_hold, cut_tick | talking-head, retention, jump-cut |
| `smash` | 200 ms pre-silence, 12 dB / 0.4 luma contrast minimums, impact at cut + 1 frame | smash, comedy, mime |
| `interrupts` | minor 2.5 s / medium 5 s / major 9 s, 25% jitter, majors >= 6 s apart | retention, short-form |
| `story` | interruptOpen (cliche setup, stop sound + 300 ms freeze, new format), verbLadder (one verb per beat, the last holds 2 beats), mockumentaryReaction (0.3-0.5 s reaction inserts, silence before and a 1.2 s deadpan hold after the payoff line), sentenceLed (word-by-word build at <= 3.5 words/s, hold, result on the next downbeat) | story, hook, comedy, launch |
| `onset_snap` | cuts within +-2 frames of a sound onset; target share 60% (studied films: 45-80%) | sync, lint |
| `pace` | ASL and shots-per-30 s per format (hype ad, beat edit, talking head, mime-style spot, short film) | lint |

## `cutgen.py`

```
python3 cutgen.py beats --bpm 128 --fps 30 --pattern every_2 --bars 8 [--offset 0.12] [--snap] [--tx whip]
python3 cutgen.py section --bpm 120 --fps 30 --plan build_accelerate
python3 cutgen.py split --mode J --cut-frame 120 --fps 30 [--ms 400] [--sr 48000]
python3 cutgen.py talking --cuts 0,72,150,260 --fps 30 --end-frame 330 --claims 150
python3 cutgen.py smash --cut-frame 120 --fps 30
python3 cutgen.py interrupts --duration 30 --fps 30 --seed 1
python3 cutgen.py interrupt-open --fps 30 [--setup 3.0] [--freeze-ms 300]
python3 cutgen.py verbs --verbs "Build it all.,Expand.,Automate.,Multiply." --bpm 120 --fps 30 [--snap]
python3 cutgen.py mockumentary --lines 0:75,90:160,200:260 --fps 30 [--payoff -1]
python3 cutgen.py sentence --words "Your clients dream big" --bpm 120 --fps 30 [--snap]
python3 cutgen.py snap --cuts 0,44,91 --fps 30 (--onsets 1.5,3.0 | --study study.json [--use onsets|beats|hits_top10pct]) [--tol 2]
```

- **Frame-exact:** each cut is `round((offset + beat * 60 / bpm) * fps)` computed from the beat index, never by
  accumulating intervals, so error stays under half a frame forever (`err_ms` per cut, `max_abs_err_ms` overall).
  `--snap` uses the nearest tempo whose beat is a whole number of frames (128 BPM at 30 fps becomes 128.571, 14 frames
  per beat), so the error is 0 and `tempo_drift_pct` reports the cost. 120, 100 and 90 BPM are already exact at 30 fps.
- **`--tx <key>`** attaches the transition window from `../transitions/catalog.json` with the swap ON the beat (same
  math as `transitions/lib/tx-core.js txWindow`) and lists each sound cue's anchor frame (`sfx/<category>/<name>`).
  The first cue is the default; cues with a `note` are alternates or optional. Overlapping windows produce a warning.
- **`split`** gives the picture cut frame, the audio edit time/sample and the crossfade sample range (J leads, L trails).
- **`talking`** assigns the alternating reframe ladder per jump-cut segment, schedules punch-ins on claim frames while
  enforcing the 4 s minimum gap, adds a slow push to static shots longer than 4 s, and lists cut-tick cues.
- **`smash`** gives the pre-silence start sample, the ramp length and the impact anchor (cut + 1 frame).
- **`interrupts`** produces a seeded, jittered ladder (a higher level absorbs a lower one within 0.6 s).

- **Story shapes** (`interrupt-open`, `verbs`, `mockumentary`, `sentence`) return contiguous shots and sound cues for the
  storyboard shapes in `../skills/motion-pack/references/success-patterns.md`. Cue rows carry `visual_frame` (pass it to
  `music/mixer.py add_cue`) and `anchor_frame` (= visual frame + 1, where the anchor sample lands). Each prints `warnings`
  when the input breaks the pattern (a setup longer than 8 s, verbs too fast to read, a reaction running into the payoff).
- **`snap`** moves each cut to the nearest sound onset within +-2 frames and reports `share_snapped` against the 60% target.
  Onsets come from a list or from a `tools/refstudy.py` `study.json` (`audio.onsets`, `audio.beats` or `audio.hits_top10pct`);
  a snap that would collide with or cross a neighbouring cut is refused. Library use: `cutgen.snap_cuts_to_onsets(cuts, onsets_s, fps)`.

Analysis of real footage (silence detection, filler words) belongs to the `talking-head-recut` and `video-use` skills;
this module only holds the numbers and the frame math.

## Retime (`retime.json`, `retime.py`, 2026-10-13)

Presets `rampIn`, `rampOut`, `heroRamp`, `bulletTime`, `reverseFlash`, `freezeStamp`, each with a sound bundle by id.
```
python3 retime.py plan   --preset heroRamp --anchor 2.0 --dur 6          # segments, exact output frame count, SFX cue frames
python3 retime.py ffmpeg --preset heroRamp --anchor 2.0 --dur 6 --input in.mp4 --out out.mp4 [--no-audio] [--run]
```
The rate curve is integrated exactly; each 2-frame piece gets its exact source interval, so source position never drifts. Video: trim -> setpts -> fps -> clone-pad -> trim to exactly K frames; freeze pieces loop one frame; reverse uses the reverse filter. Audio: atempo chains (0.5..2 per stage), silence under freeze / reverse (lay the preset SFX there). `test_retime.py` renders three presets with local ffmpeg and asserts the frame count equals the plan.

## Tests

`python3 -m unittest test_cutgen` (17 tests: exact grids, half-frame bound over 400 bars, snapping, patterns, section
hero on the downbeat, transition windows on the beat with overlap warnings, J/L/B-roll splits, talking-head ladder and
punch-in gap, smash anchors, seeded interrupts, the four story shapes, onset snapping incl. collisions and a study.json, CLI).
