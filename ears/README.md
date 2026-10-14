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
| `checks_shape.py` | structure (sections, drop, the breath before the final sting, loop seam), repetition fatigue, comparison with reference studies |
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
- `--cuts cuts.json` takes a cut list instead of the plan's shots: seconds, cutgen output, a `cutgen snap` result or a refstudy `study.json`.
- `--loop` judges the loop seam.
- `--target-lufs -16` sets another integrated target (`hero.web`).
- `--fps 25` overrides the frame rate (default: the plan, then the video, then 30).

A `.wav`, `.flac` or `.aif` input is judged as a master (true peak ≤ −1.5 dBTP, a digitally silent tail); anything else as a delivered file (≤ −1.0 dBTP, near-silent tail).

`tools/critic_pack.sh` runs `ears` on every review and puts its report in `ears/ears.md`, its scores in `critic.json`, and its top issues in `review.md`.

## The checks

| check | measures | verdict (spec in `manifest.json`) |
|---|---|---|
| `ears/loudness` | integrated LUFS (BS.1770-4), short-term curve (3 s, every 0.5 s), momentary max, LRA (EBU Tech 3342), sample and 4x true peak, PLR, playback offset per platform, the last 0.15 s | −14 ± 0.5 LU pass, ± 1.5 warn; TP ≤ −1.0 delivered / −1.5 master; LRA ≤ 10 LU; tail digital zero |
| `ears/clipping` | flat-topped runs (≥ 3 samples at full scale or at the file's own peak), decoded samples over 0 dBFS, intersample overs with times, crest factor, PLR | any clipped run or over fails; PLR < 8 LU warns (squashed), < 5 fails |
| `ears/tone` | per-octave energy of sub (< 60), low (60–250), mud (250–500), mid (500–2 k), presence (2–5 k), sibilance (5–10 k), air (> 10 k) relative to the mid band, overall and per second | mud, boomy, thin, harsh, sibilant, dull against a house curve, with the time ranges where each happens; within 2 dB of a range is a note |
| `ears/speech` | speech regions (a detector, or a transcript), ducking depth of the music under each line, speech-to-music ratio in 300 Hz–3.4 kHz, words per minute | ducking ≥ 9 dB (mixer R5), speech ≥ 10 dB over the music, 110–175 wpm. **Verdicts only with a transcript** (see limits) |
| `ears/sync` | tempo + confidence, beat grid, onsets and hits, the first audible frame, cuts within 2 frames of an onset or beat, each plan cue's anchor against `(F + 1) × 48000 / fps` (risers: F) | an event by frame 3 (R10); ≥ 60% of cuts on an onset; ≥ 80% of measurable cues within half a frame |
| `ears/structure` | energy and novelty curves, sections labelled intro / build / drop / body / outro, drop time as a share of the runtime, LRA and the spread of half-second levels, the breath before the final sting, the loop seam | late drop (after 75% with nothing as loud before) warns; flat (no drop, LRA < 2 LU, levels within 2 dB: the critic's blindfold test) warns; the breath is a suggestion; the seam is judged with `--loop` |
| `ears/repetition` | onsets clustered by spectral shape and level; clusters on the music's 16th-note grid count as music; repeated plan cue ids | the same non-musical sound more than 3 times in 10 s warns; a plan id more than 6 times in 10 s warns (the mixer round-robins takes, so fewer is a note) |
| `ears/stereo` | L/R correlation overall and per half second, loudness lost when summed to mono, side vs mid width | anti-phase stretches and mono loss > 1.5 dB warn, > 3 dB fails |
| `ears/compare` | with `--ref`: our loudness curve, band shares (< 150 Hz / mid / > 4 kHz, as refstudy measures them), tempo, brightness and cuts on onsets against the references | information only: "inside / above / below the reference range" per measure |

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
