# ears: automated listening and critique for a video's sound

An agent cannot hear. `ears` lets it judge a delivered video's sound the way a careful listener with a meter would:
- it decodes the MP4 (or a WAV master);
- it runs ten checks (the tenth, mood labels, is optional) against the pack's own rules (`SKILL.md` hard rules, `music/mixer.py` rules) or a stated house default;
- for every check it reports a measured value, pass / warn / fail, and a concrete fix with timestamps;
- it ends with the top 3 things a listener would notice and a 1–10 score per category on the `references/critic.md` scale (8 or more passes).

It measures. It does not replace one human listen at phone size and on headphones.

numpy and scipy only (plus ffmpeg to decode). It reuses the pack's one loudness meter (`sfx/mpaudio/meter.py`) and, for cue placement, renders the exact takes the mixer placed from the sound registry. Nothing is downloaded.

| file | what |
|---|---|
| `listen.py` | the CLI and `analyze(x, fps, plan=..., cuts=..., transcript=..., refs=...)` for library use |
| `core.py` | decoding, side inputs (plan, cuts, transcript, reference studies), STFT, onsets, tempo, short-term loudness, LRA, true-peak envelope, the mixer's cue takes |
| `checks_level.py` | loudness, clipping / distortion, tonal balance, stereo |
| `checks_time.py` | speech (detector, ducking, masking, words per minute), rhythm and sync |
| `checks_shape.py` | structure (sections, drop, the breath before the final sting, planned and unplanned quiet, the ending shape, loop seam), repetition fatigue, comparison with reference studies and role ranges |
| `report.py` | scores, the ranked listener summary, Markdown |
| `mood.py` | the optional local CLAP hook |
| `manifest.json` | the checks and every threshold (`spec`): the single place to tune a house default |
| `tests/` | `python3 -m pytest -q ears/tests`: synthetic signals for every detector (CI runs it) |

## Use it

```bash
python3 ears/listen.py out/film-9x16.mp4 \
    --plan templates/<your-video>/out/plan.json \     # cuts from the shots, cue anchors from the cues
    --transcript refs/<name>/study.json \             # or a Whisper JSON, or the talking-head words.json
    --ref refs/a/study.json refs/b/study.json \       # tools/refstudy.py studies to compare against
    --json reviews/r1/ears.json --md reviews/r1/ears.md
```

Other flags:
- `--mode auto|music|vo|continuous` sets what the edit is scored on (below); `--events study.json` gives the motion events for `continuous` (a refstudy `study.json`, or a JSON list of seconds, `{t}` or `{frame}`); `--role proof|explainer|hype|trailer|vo_doc|brand_launch` names the bed's role for the bass-share note.
- `--cuts cuts.json` takes a cut list instead of the plan's shots: seconds, cutgen output, a `cutgen snap` result or a refstudy `study.json`.
- `--loop` judges the loop seam.
- `--target-lufs -16` sets another integrated target (`hero.web`).
- `--fps 25` overrides the frame rate (default: the plan, then the video, then 30).

### What the plan can tell ears (all optional)

`out/plan.json` may carry the sound intent, so `ears` judges a planned shape as intended instead of as a fault. The fields live under `audio` (the top-level names `audioMode`, `quiet`, `motionEvents` and `audioRole` are read too):

```json
{"fps": 30, "audio": {
  "mode": "music",
  "quiet": [{"t": [0, 1.5], "kind": "open", "why": "sound enters on the first visual event"},
            {"t": [24.0, 27.0], "kind": "gap", "why": "valley before the crescendo"},
            {"t": [32.5, 36.0], "kind": "hold", "why": "end card on near-silence"}],
  "events": [1.0, 2.5, 4.0],
  "role": "trailer"}}
```

| field | meaning |
|---|---|
| `audio.mode` | `music` (the default: music-led, cut-driven; >= 60% of cuts within 2 frames of an onset), `vo` (VO-led: cuts under the voice, none inside a word; cut sync is information only; needs word timings from a talking-head `words.json` or a Whisper JSON with word timestamps), `continuous` (few or no cuts: >= 60% of the motion events within 2 frames of an onset; events from `audio.events`, `--events`, or measured from the video by `tools/refstudy.py`) |
| `audio.quiet` | planned quiet regions `[{t: [a, b], kind, why}]`, `kind` open (<= 2 s: the sound enters 1-2 s after a moving frame 0), dip or gap (<= 4 s: a mid-film reset or a trailer valley), hold (<= 9 s: the end card on near-silence). Judged as shape: no dead-air or first-audible-sound warning, left out of the loudness range, reported with its `why`. A planned region over its maximum (plus half a second) still warns. A bare `[a, b]` pair is accepted and its kind inferred |
| `audio.events` | the picture's motion events in seconds, `{t}` or `{frame}` (for `continuous`) |
| `audio.role` | `proof`, `explainer`, `hype`, `trailer`, `vo_doc` or `brand_launch`: the bed's bass share (< 150 Hz) is reported against the studied range for that role (20-36, 20-36, 50-61, 50-61, 15-34 and, from two round 6 brand-launch films, 50-60%); information, not a verdict |

Backward compatible: with none of these fields, mode is `music`, no quiet is planned, and every earlier verdict is unchanged. `audio.mode` and `audio.role` are not case-sensitive (`"VO"` is `vo`); an unknown mode still raises.

**Chance level.** `ears/sync` reports `cuts_on_onset_chance` / `events_on_onset_chance` (the fraction of the timeline inside the 2-frame onset windows) and adds a note when the share is within chance of it (a binomial z under 2, at 4 or more cuts or events). A busy bed at 4 onsets a second puts about half the timeline inside the windows, so 50% "on an onset" is luck. The pass/fail thresholds are unchanged; the note says when a pass is not evidence.

A `.wav`, `.flac` or `.aif` input is judged as a master (true peak ≤ −1.5 dBTP, a digitally silent tail); anything else as a delivered file (≤ −1.0 dBTP, near-silent tail).

`tools/critic_pack.sh` runs `ears` on every review and puts its report in `ears/ears.md`, its scores in `critic.json`, and its top issues in `review.md`.

## The checks

| check | measures | verdict (spec in `manifest.json`) |
|---|---|---|
| `ears/loudness` | integrated LUFS (BS.1770-4), short-term curve (3 s, every 0.5 s), momentary max, LRA (EBU Tech 3342; also without the planned quiet regions), sample and 4x true peak, PLR, playback offset per platform, the last 0.15 s | −14 ± 0.5 LU pass, ± 1.5 warn; TP ≤ −1.0 delivered / −1.5 master (0.01 dB of rounding tolerance: the mixer's limiter sits exactly on −1.5); LRA ≤ 10 LU (judged without `plan.audio.quiet` regions: short-term windows that touch one are left out); tail digital zero |
| `ears/clipping` | flat-topped runs (≥ 3 samples at full scale or at the file's own peak), decoded samples over 0 dBFS, intersample overs with times, crest factor, PLR | any clipped run or over fails; PLR < 8 LU warns (squashed), < 5 fails |
| `ears/tone` | per-octave energy of sub (< 60), low (60–250), mud (250–500), mid (500–2 k), presence (2–5 k), sibilance (5–10 k), air (> 10 k) relative to the mid band, overall and per second | mud, boomy, thin, harsh, sibilant, dull against a house curve, with the time ranges where each happens; within 2 dB of a range is a note |
| `ears/speech` | speech regions (a detector, or a transcript), ducking depth of the music under each line, speech-to-music ratio in 300 Hz–3.4 kHz, words per minute | ducking ≥ 9 dB (mixer R5), speech ≥ 10 dB over the music, 110–175 wpm. **Verdicts only with a transcript** (see limits) |
| `ears/sync` | tempo + confidence, beat grid, onsets and hits, the first audible frame, the edit by mode (cuts within 2 frames of an onset or beat; or speech continuity; or motion events within 2 frames of an onset), each plan cue's anchor against `(F + 1) × 48000 / fps` (risers: F) | an event by frame 3 (R10; waived by a planned quiet open of <= 2 s); mode `music`: ≥ 60% of cuts on an onset; mode `vo`: no cut inside a word; mode `continuous`: ≥ 60% of motion events on an onset; ≥ 80% of measurable cues within half a frame |
| `ears/structure` | energy and novelty curves, sections labelled intro / build / drop / body / outro, drop time as a share of the runtime, LRA and the spread of half-second levels, the breath before the final sting, near-silent stretches (0.5 s blocks >= 20 dB under the programme median) with their planned or unplanned status, the ending shape (slam, sustained sub, quiet hold, decay, level), the loop seam | late drop (after 75% with nothing as loud before) warns; flat (no drop, LRA < 2 LU, levels within 2 dB: the critic's blindfold test) warns; **dead air** (>= 2 s of unplanned near-silence) warns; a planned quiet region over its house maximum warns; the breath is a suggestion; the seam is judged with `--loop` |
| `ears/repetition` | onsets clustered by spectral shape and level; clusters on the music's 16th-note grid count as music; repeated plan cue ids | the same non-musical sound more than 3 times in 10 s warns; a plan id more than 6 times in 10 s warns (the mixer round-robins takes, so fewer is a note) |
| `ears/stereo` | L/R correlation overall and per half second, loudness lost when summed to mono, side vs mid width | anti-phase stretches and mono loss > 1.5 dB warn, > 3 dB fails |
| `ears/compare` | with `--ref`: our loudness curve, band shares (< 150 Hz / mid / > 4 kHz, as refstudy measures them), tempo, brightness, cuts on onsets, quiet open and quiet tail against the references; with `--role`, the bass share against that role's range | information only: "inside / above / below the reference range" per measure |

**Cue anchors use the exact take.**
- `ears` renders the take `music/mixer.py` placed for each cue, including the round-robin seed of a repeated id.
- A waveform matched filter finds that take in the mix to the sample. A pack bed's kick on frame F cannot fool it, even with the cue one frame later.
- When a take cannot be found (another mixer, heavy processing, or masked by the bed), the cue is reported as not detectable, never as off.

**Scores** (`report.py`):
- Each category starts at 10. A fail costs 3, a warn costs 1, and one problem counts once even when it hits several lines.
- Any fail caps the category at 7, so the critic loop has to fix it.
- The critic's "Sound sync" row is the minimum of loudness, cleanliness, sync and structure.

## Mood labels (optional, off by default)

`ears` can add zero-shot mood labels per section (tense, uplifting, corporate, playful, cinematic, cheesy, calm) from a CLAP model, but it never downloads one. To enable it:
1. Put a Hugging Face CLAP checkpoint you already have on disk, e.g. a copy of `laion/clap-htsat-unfused`.
2. `pip install transformers torch` (not in `requirements.txt`).
3. `export EARS_CLAP_MODEL=/path/to/that/checkpoint`

It loads with `local_files_only=True` and `HF_HUB_OFFLINE=1`. Without all three, the report says `mood: not available (no local model)`.

## Validation (14 Oct 2026, on real files)

- **Cue anchors.**
  - The two build-in-public shorts, the L7 demo, the beat edit and the 15 s ad were mixed by `music/mixer.py`. `ears` found all 64 of their plan cues on the anchor sample (0.0 frames off).
  - Synthetic clicks placed one frame early are measured at −1.0 frames; two frames late at +2.0.
- **Ducking.** On the 60 s AnveVoice film it measured 6.4 / 7.8 / 5.2 dB under three lines. Its own `stem_music` measures 5.9 / 7.7 / 4.4 dB under the same lines.
- **Speech detector.**
  - It found no speech in nine music-and-SFX files, including a formant-babble scene.
  - It covered about a third of the film's voice-over (measured against its VO stem), with 99% precision.
- **Loudness.** It agrees with the pack's meter (it is the same meter). It flags the beat-edit demo at −14.8 LUFS, a figure the templates README also reports.
- **Shape.** The shorts, the L7 demo and the 15 s ad hold one level from start to end (LRA 0.7-1.9 LU), so they get the "flat" warning. The showcase film and promo have an arc and pass.

- **Planned quiet and modes (round 4/5, 14 Oct 2026, synthetic signals plus the trailer bed).**
  - A fixture with a planned 6 s end-card hold passes `ears/structure`; the same file without the marker warns of dead air; an 11 s hold warns that it is over the 9 s maximum (`ears/tests`).
  - `music/bed_trailer_arc`, mixed through `music/mixer.py` to −14.03 LUFS-I (true peak −1.5 dBTP): with its gap and hold marked, structure passes; `ears` finds the 3 s valley at 24.0–27.0 s and the crescendo at 27.0 s, the marker times, and reports the ending as a quiet hold. Unmarked, it warns of dead air at 24.0–27.0 s and 32.5–35.5 s. The loudness range stays a warning (15.9 LU whole file, 13.5 LU without the planned regions): the act-1 drone is about 16 LU under the wall by design.
  - The mode `continuous` is tested on lavfi clips with known flashes (events measured by `tools/refstudy.py`, then scored against the clicks). It has not been run on real reference films. On the pack's own local demos the continuous mode's chance level reads 35-64% at 2.7-5 onsets a second (`docs/research/reference-round45-2026-10.md`), which is why it reports it.

## Limits

- **It measures; it does not listen.**
  - It cannot judge taste, emotion, whether a sound fits the picture, or whether a voice sounds natural.
  - Listen once on a phone speaker and on headphones before calling the sound done.
- **Speech without a transcript is numbers only.**
  - The detector favours precision and misses lines. The gaps it compares against may then hold speech.
  - Pass `--transcript` for ducking, masking and words-per-minute verdicts.
- **Ducking is measured against music-only stretches next to each line.** With no such stretch (wall-to-wall VO, music that changes at the line), it says "not measurable".
- **Tempo can lock to half or double time.** Below 0.3 confidence it is a guess (speech, free-time music).
- **The tone curve is a house default**, set from commercial-mix spectra and checked against the pack's demos. Genres differ: a sub-heavy trap bed is meant to read boomy.
- **Repetition.** Repeated sounds that sit on the music's grid are treated as music, so an identical SFX on every beat is only caught through the plan.
- **Structure labels come from energy alone.** A "drop" is the biggest step in level, not a musical analysis.
- **Mode `vo` needs word timings.** With a segment-only transcript (a refstudy `study.json`, plain Whisper) it reports the share of cuts under speech and says it cannot check cuts inside words; pass a talking-head `words.json` or a Whisper JSON run with word timestamps.
- **Planned quiet is trusted, not checked against the picture.** `ears` cannot see that the picture is moving over a quiet open or holding over a quiet end card; it judges the sound and the house maxima (open 2 s, dip / gap 4 s, hold 9 s).
- **Ending shape is the refstudy definition** (the last second within 6 dB of the body is a slam; the last 2 s at least 10 dB under and flat is a quiet hold; otherwise a decay), plus one check `ears` adds because it has the waveform: a **sustained sub** is a last 2 s (before the digital-zero 0.15 s) with at least 85% of its energy under 150 Hz that is still audible (above −60 dBFS). A slow fade that never goes flat reads as a decay. These thresholds are starting values checked on synthetic signals and the trailer bed, not on a set of real films.
