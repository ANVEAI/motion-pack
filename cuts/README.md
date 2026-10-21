# motion-pack / cuts

Cut-pattern library as data (`patterns.json`) plus `cutgen.py`, which turns a BPM and a pattern into frame-exact cut
points (stdlib Python, deterministic, JSON out). Numbers are house starting values from `../docs/evidence/edit.md`
(2.3 J/L, 2.5 smash, 3.3 interrupt ladder, 6.1 pace, 7.2 talking head) and `../docs/evidence/sound.md` (4.10, short-film
bundle). They are tunable heuristics, not platform facts.

## What is in `patterns.json`

| block | entries | tags |
|---|---|---|
| `beat` | every_beat, every_2, every_bar, every_2bars, eighths, offbeat, backbeat, push_and, tresillo_332, son_clave_32, downbeat_hits | beat-edit, music, montage |
| `sections` | build_accelerate (hero cut on the next downbeat), drop_doubletime, hook_3s, verse_chorus, breath_out | structure, build, hook, cta |
| `split` | J (audio leads 400 ms), L (audio lingers 600 ms), film_J (12-24 frames), broll_lead (picture leads VO by 150 ms) | jcut, lcut, dialogue, film, talking-head |
| `talking_head` | autocut numbers, reframe_alternate 1.0/1.15/1.0/1.25 on the eyes, punch_in 1.12 max 1 per 4 s, slow_push, beat_hold, cut_tick | talking-head, retention, jump-cut |
| `smash` | 200 ms pre-silence, 12 dB / 0.4 luma contrast minimums, impact at cut + 1 frame | smash, comedy, mime |
| `interrupts` | minor 2.5 s / medium 5 s / major 9 s, 25% jitter, majors >= 6 s apart; lint: two L3s within 1.5 s, 4 rising 5 s windows | retention, short-form |
| `story` | problemPivot (round 6, `story6.py`: a continuous typographic film: a typed sentence with an accent punchline, a 3-beat problem ladder, a 1.5-2 s audio gap into the pivot frame, a 3-beat value ladder, a typed command CTA, a quiet hold >= 2 s), interruptOpen (cliche setup, stop sound + 300 ms freeze, new format), verbLadder (one verb per beat, the last holds 2 beats), mockumentaryReaction (0.3-0.5 s reaction inserts, silence before and a 1.2 s deadpan hold after the payoff line), sentenceLed (word-by-word build at <= 3.5 words/s, hold, result on the next downbeat); round 3: lateDrop (problem on UI ticks + texture for 10-60% of the runtime, optional 0.5-1 s speech gap, the beat drops on the turn line), preStingSilence (lockup, bed out, 1-3 s near-silence, one final sting), voiceHandoff (presenter starts the line, the consented synthetic voice finishes it; caption tag flips, honesty label on every synthetic frame), pipelineReveal (prompt -> plan -> passes -> teardown -> file chip -> product in the world -> title, breakdown before the world shot); round 4/5: diagramWalkthrough (the diagram advances only in the speech gaps), queryLadder (one UI, 4-6 rungs of harder input, pull back to where it runs), fidelityLadder (same output at rising quality, one step per bar, dropout, new dimension), voicesColdOpen (4-6 faces mid-sentence with J audio, the lead's line, a name super), commandRapidFire (a response on the frame after each command's last word), anaphoraCut (a cut on every repeat of a word), trailerArc (dialogue, title cards, build, wall, one question over near-silence, crescendo, title, stop, date, sting), styleLadder (one composition, the look swaps on hits) | story, hook, comedy, launch, end, sound, documentary, explainer, trailer |
| `onset_snap` | cuts within +-2 frames of a sound onset; target share 60% for music-led, cut-driven pieces only (studied films: 45-80%; VO-led and continuous films: `critic.md`) | sync, lint |
| `pace` | ASL and shots-per-30 s per format (hype ad, beat edit, talking head, mime-style spot, short film) | lint |

## `cutgen.py`

```
python3 cutgen.py beats --bpm 128 --fps 30 --pattern every_2 --bars 8 [--offset 0.12] [--snap] [--tx whip]
python3 cutgen.py section --bpm 120 --fps 30 --plan build_accelerate
python3 cutgen.py split --mode J --cut-frame 120 --fps 30 [--ms 400] [--sr 48000]
python3 cutgen.py talking --cuts 0,72,150,260 --fps 30 --end-frame 330 --claims 150
python3 cutgen.py smash --cut-frame 120 --fps 30
python3 cutgen.py interrupts --duration 30 --fps 30 --seed 1
python3 cutgen.py lint-interrupts schedule.json                      # exit 1: two L3s within 1.5 s, or 4 rising windows (fatigue)
python3 cutgen.py interrupt-open --fps 30 [--setup 3.0] [--freeze-ms 300]
python3 cutgen.py verbs --verbs "Build it all.,Expand.,Automate.,Multiply." --bpm 120 --fps 30 [--snap]
python3 cutgen.py mockumentary --lines 0:75,90:160,200:260 --fps 30 [--payoff -1]
python3 cutgen.py sentence --words "Your clients dream big" --bpm 120 --fps 30 [--snap]
python3 cutgen.py late-drop --duration 30 --fps 30 (--turn-frame 240 | --share 0.25 --bpm 120) [--gap-ms 700] [--ticks 30,60] [--riser auto|on|off] [--riser-end F]
python3 cutgen.py pre-sting --lockup-frame 600 --fps 30 [--hold 1.5] [--silence 2.0] [--sting-hold 1.0]
python3 cutgen.py handoff --line 0:75:180 --fps 30 [--exit 1.5] [--consent] [--demo-frame 200]
python3 cutgen.py pipeline --duration 45 --fps 30 [--bpm 120] [--steps prompt,plan,passes,teardown,file,world,title] [--breakdown 3]
python3 cutgen.py snap --cuts 0,44,91 --fps 30 (--onsets 1.5,3.0 | --study study.json [--use onsets|beats|hits_top10pct]) [--tol 2]
# round 4/5 (story45.py): VO-led shapes take word timings, words.json = [{w, s, e}] (seconds) or {"words": [...]}
python3 cutgen.py walkthrough --words words.json [--steps N] [--regions a,b,c] [--end-hold 5] [--min-gap 0.25]
python3 cutgen.py query-ladder --dur 45 [--rungs 5 | --rungs "video:1,podcast:2,pdf:3"] [--bpm 120 | --sidecar bed.json | --downbeats 0,72,144,...] [--words words.json] [--intro 0] [--pullback 3.5] [--end 4]
python3 cutgen.py fidelity-ladder --bpm 99 [--steps 4 | --params 3,10,36,1024] [--bars-per-step 1] [--dropout-s 3] [--reveal-bars 4]
python3 cutgen.py voices-open --clips clips.json [--max-open 6] [--j-ms 130]
python3 cutgen.py command-burst --words words.json [--burst-start S]
python3 cutgen.py anaphora --words words.json [--token here | --phrase "the"]
# round 6 (story6.py): no words needed, a continuous typographic film; every number is a CLI flag
python3 cutgen.py problem-pivot [--duration 30] [--fps 30] [--sentence S --accent W --problem "a|b|c" --brand B --value "a|b|c" --command C --url U] [--rung-s 2.25 --gap-s 1.8 --hold-s 2.5 --value-s 2.2 --lead-s 0.1]
python3 cutgen.py trailer --dur 60 [--dialogue lines.json] [--bpm 120]
python3 cutgen.py ab-replay --clip-s 6 [--mode replay|flip] [--flip-share 0.42] [--kind chip|wipe|slider] [--lufs-a -20.5 --lufs-b -22.1] [--tol-db 1.0] [--xfade-ms 0] [--gap-frames 0]
python3 cutgen.py verify-picture --video plate.mp4 --plan ab.json [--crop w:h:x:y] [--min-psnr 45]
python3 cutgen.py style-ladder --looks live,look.bw-neutral,look.pastel,look.duotone --bpm 120 [--beats-per-style 1]
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
- **`interrupts`** produces a seeded, jittered ladder (a higher level absorbs a lower one within 0.6 s, majors stay `major_min_gap_s` apart) and prints its own `lint`. A fatigue relief pass drops the lowest event from the last window of any climb that would fail it (76 of 2,793 sampled schedules, durations 6-90 s, seeds 1-399, needed it).
- **`lint-interrupts schedule.json [--duration S]`** lints any schedule (the `interrupts` output, or a list of `{level, time_s}`) and exits 1 on a failure: two level-3 events closer than `major_pair_min_gap_s` (1.5 s), or `fatigue_rising_windows` (4) consecutive full windows of `fatigue_window_s` (5 s) whose summed levels (L1 = 1, L2 = 2, L3 = 3) each rise over the one before. All four numbers are in `patterns.json` `interrupts`; they are house heuristics, not platform facts.

- **Story shapes** (`interrupt-open`, `verbs`, `mockumentary`, `sentence`) return contiguous shots and sound cues for the
  storyboard shapes in `../skills/motion-pack/references/success-patterns.md`. Cue rows carry `visual_frame` (pass it to
  `music/mixer.py add_cue`) and `anchor_frame` (= visual frame + 1, where the anchor sample lands). Each prints `warnings`
  when the input breaks the pattern (a setup longer than 8 s, verbs too fast to read, a reaction running into the payoff).
- **Round-3 story shapes** (14 Oct 2026, from `../docs/evidence/reference-round3-2026-10.md`):
  - `late-drop` places the drop on the turn line's first frame (or at `share` x duration, on a bar line with `--bpm`), lists the problem
    section's cues (`sfx/ui/agent_working` until the drop or the gap, your UI ticks), the riser and the drop hit. A riser's end anchor must sit on
    the drop frame, one frame before the hit anchor; `--riser-end` checks your plan against that. With a speech gap the riser is off by default
    (the silence is the tension) and ticks inside the gap are removed. Warns when the drop is outside 10-60% of the runtime or off the bar line.
  - `pre-sting` gives the bed fade (samples), the silence window (frames and samples), the room-tone loop, the sting cue and the digital-zero tail.
    Under 1 s it warns that this is the smash gag, not an ending; over 3 s, that viewers leave.
  - `handoff` splits presenter and synthetic audio with a 30 ms crossfade on the handoff, one room tone under both, caption segments with the
    speaker tag `(AI voice)` from the handoff frame, and the label window. It warns until `--consent` is passed.
  - `pipeline` turns step weights into contiguous shots (bar lines with `--bpm`), one cue per step, and a 3 s breakdown ending on the world shot
    with a riser ending one frame before it. Steps name their parts (`blender/passReveal`, `blender/knolling`, `blender/cloudFlight`, ...).
- **Round-6 story shape** (15 Oct 2026, `story6.py`, from `../docs/evidence/reference-round6-2026-10.md`; one tier-B reference, treated as craft). `problem-pivot` (problemPivot) is a CONTINUOUS typographic film: zero cuts, synced by motion events. A sentence typed with an accent-word punchline; a three-beat problem ladder (2-2.5 s a beat, the diagram worse each beat, captions swap by a blur-through); a **1.5-2 s audio gap** that starts inside the last beat (the bed thins to a hum, then true silence of at least 1 s: `plan.audio.quiet` kind `gap`) and ends ON the **pivot frame**, where the bass hit lands and the bed is back at 0 dB, the colour and the brand line following by `--lead-s` (default 0.1 s: the sound leads the picture; pass it to `layers background.auroraRibbon` as `riseAt`); a three-beat value ladder; a typed command CTA with the address after it; a quiet hold of at least 2 s (kind `hold`, up to 9). It returns every caption's in / out / swap frames, the `plan.audio` block (mode continuous, role `brand_launch`, quiet, events), `bed_automation`, `sfx` cues (visual frame + anchor = visual + 1), the pivot and the hold, and `checks` (`check_problem_pivot(result)` re-derives every rule from the emitted data alone: a hand-edited plan fails it). `--duration` spreads the slack over the value beats, then the brand beat, then the hold; a duration the beats cannot meet is a warning. Every numeric flag is guarded (NaN, infinity, zero, negative, a string or a huge value raises a clear `ValueError`; a caption over 200 characters is refused). Numbers: `patterns.json` `story.problemPivot` (house starting values: tunable, from one reference plus the proof films' quiet open and hold). Demo: `templates/demo-r6-pivot`.
- **Round-4/5 story shapes** (14 Oct 2026, `story45.py`, from `../docs/evidence/reference-round3-2026-10.md` and the round-4/5 reference intake). Pure functions of the input: the same words give the same plan. A time `t` is *inside a word* when `s < t < e`; no cut, step or response lands inside one (warnings name the offender):
  - `walkthrough` (diagramWalkthrough, VO explainer): step 0 at frame 0, every later step (diagram advance + camera re-frame) at **gap start + 2 frames** of a speech gap of at least 0.25 s, sentence ends first, mid-sentence pauses only when `--steps` asks for more advances than there are sentences (then the gaps nearest to N even divisions of the speech win). It returns the caption for each step (the current sentence), the camera re-frame window (inside the gap, settled before the next word), the end card (3-8 s on near-silence) and bed automation to -30 dB. Warns on a sentence over 6 s ("split it"), a pause too short for an advance, and an average step interval outside 3-6 s.
  - `query-ladder` (queryLadder): optional intro, N rungs, a pullback with 2-3 benefit chips (`cam2d.pullbackToScreen`), the URL. Each rung is type (<= 1.2 s) -> resolve from blur (0.4 s) -> the hit (2-4 s) -> one VO slot. Rungs are sorted by declared difficulty (hardest last). With `--bpm` every rung starts on a bar line (checked to within 2 frames); with `--sidecar` (a music bed's `.json`, its real `bar_frames`) or `--downbeats` every rung starts exactly on a real bar line, so a tempo ramp such as `bed_anthem_ramp16` works; with `--words` (one VO sentence per rung, in order) each rung starts in the speech gap before its line, on a downbeat inside the gap when there is one. Sections are contiguous and sum to the duration.
  - `fidelity-ladder` (fidelityLadder): step k on bar k (a hit and a readout update of the parameter and its error), then a dropout of at least `--dropout-s`, the new-dimension reveal on the first bar line after it, then the title. It emits `bed_automation` (a 24 dB dip with a 150 ms fade). The readout values stay empty unless you pass `--params`; fill the error from a measurement, never an invented one.
  - `voices-open` (voicesColdOpen): from `clips.json` ([{id, src, words, name, role, tag, lead?}], `words` inline or a path) each non-lead clip gives one **mid-sentence** window of 0.5-1.3 s (never the first word of a sentence, never ending on its last), audio edit points sit between words with a 30 ms / 50 ms pad, the voices run end to end and **every picture cut lags its audio by the J lead (130 ms)**; then the lead's first full sentence with a name super 0.5 s in (`lowerThird.docSuper`, no names before the lead; later supers add one `tag` each). The opener stops before 6 s. Returns timeline frames and source seconds per segment.
  - `command-burst` (commandRapidFire): commands are sentences (punctuation or a pause of 0.25 s); each response cut is `floor(word_end * fps) + 1`, the frame after the command's last word ends. Hard cuts, no transitions between states. Warns on a command over 1.5 s, on responses that would merge, and on a rate under 0.4 commands/s; lists silent comic beats (0.3-1 s) in the setup and the reaction beat (a real reaction only, never a canned laugh).
  - `anaphora` (anaphoraCut): a cut at (token start - 1 frame) on every repeat of `--token` or `--phrase` (case-insensitive; with neither, the most repeated non-stop word). When that frame still sits inside the previous word it moves to the next whole frame after it, and warns when words touch with no whole frame between them. Each cut names the slot word that follows (for `type/accentSwap`).
  - `trailer` (trailerArc): sections 30 / 25 / 20 / 5 / 10 / 10 % (dialogue, build, wall, question, crescendo, end) scaled to `--dur`, the question clamped to 2-4 s, dialogue lines with 10-frame dips to black, two title-card slots (small line over large line), a wall cut list (1 cut/s, or every 2 beats with `--bpm`), the end split title / hard stop / date / sting, and bed automation that puts the question **32 dB under the wall**.
  - `style-ladder` (styleLadder): a plan only. Look k swaps in on beat `start + k * beats_per_style` (doubled until a style holds 0.5 s, the last holds 2 beats); `look.*` and `grade.*` ids are checked against `layers/manifest.json`, free names such as `live` pass. The renderer holds one composition and swaps its grade layer on the planned frames.
  - **Bed automation** (`bed_automation`: [{frame, gain_db}], linear in dB between breakpoints, held outside): `walkthrough`, `fidelity-ladder` and `trailer` emit it; `music/mixer.py` reads it from the cue sheet (`"bed": {"automation": [...]}`) and `templates/_shared/audio.py` passes `plan.bedAutomation` through. It acts on the bed before the duck. A VO-led mix can also set `"vo": {"duck_db": 12}` (plan `duckDb`); the default is still 9.
- **xp-r78 story shape** (16 Oct 2026, `story78.py`, from a reference study of two tier-A public posts, kept outside this repo, treated as craft). `ab-replay` (abReplay) is the before / after audio swap: one clip heard twice (stem A, then stem B; or one shot that flips at `--flip-share`, about 40-45 % in the studied pieces) with the swap ON the picture's flip frame (`audio.switch_frame` = `flip.frame`, `switch_sample` = round(flip * 48000 / fps), a hard switch unless `--xfade-ms`), the halves level-matched within 1 dB (`--lufs-a` / `--lufs-b` give the gain on stem B, clamped to +-12 dB; unmeasured, the gain is 0 and `warnings` says so), both passes reading the SAME source frames in replay mode, and the flip cue (`sfx/ui/toggle_on`) on the flip frame. It emits `plan_audio` (paste at plan.audio.abReplay: `ears` reads it, `ears/checks_ab.py` measures the level match and the swap on the delivered file) and `checks` re-derived from the data alone. `verify-picture --video v.mp4 --plan ab.json [--crop w:h:x:y]` runs the frame-identical check on a rendered file with ffmpeg (psnr of pass A against pass B).
- **`snap`** moves each cut to the nearest sound onset within +-2 frames and reports `share_snapped` against the 60% target (the target of a music-led, cut-driven piece; a VO-led film keeps its cuts out of words instead).
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

`python3 -m unittest test_cutgen` (23 tests: exact grids, half-frame bound over 400 bars, snapping, patterns, section
hero on the downbeat, transition windows on the beat with overlap warnings, J/L/B-roll splits, talking-head ladder and
punch-in gap, smash anchors, seeded interrupts, the eight story shapes (late drop incl. the riser check and speech gap, pre-sting silence, voice handoff, pipeline reveal), onset snapping incl. collisions and a study.json, CLI).

`python3 -m pytest -q cuts/test_story6.py` (33 tests: the shape's numbers, the pivot landing together, plan.audio.quiet, no sound in the silence or the hold, typing time against the real `type/presets.js` typewriter, every check FAILS on a hand-edited result, every numeric parameter guarded, same bytes in two processes, the CLI) and its mutation proof: `python3 tools/mutation_check.py cuts/test_story6.mutants.json` (17 mutants of the code under test) and `cuts/test_story6.cutgen.mutants.json` (2 of the routing) must all be killed.

`python3 -m pytest -q cuts/test_story78.py` (29 tests: abReplay's numbers in both modes, the gain maths and its clamp, a hand-edited plan fails the matching check, every numeric parameter refused with its name, same bytes in two processes, the CLI, and `verify-picture` on a real FFV1 encode: a clip played twice is bit-equal, a different second pass is not).

`python3 -m pytest -q cuts/test_story45.py` (every round-4/5 shape on synthetic word timings: steps and responses inside gaps and never inside a word, rung sums and downbeats, grid error, mid-sentence windows with J leads, proportions at three durations, determinism, the CLI, bed automation measured on a rendered bed (dropout >= 20 dB, trailer question >= 30 dB under the wall), and the `templates/multi-voice-doc` plan with placeholder clips and with a real MP4 supplied).
