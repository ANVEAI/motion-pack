# Ears report: proof-film.mp4

Measured by `ears/listen.py` (motion-pack). It measures; it does not replace one human listen at phone size and on headphones.

39.32 s, 48000 Hz, 2 channel(s), 30 fps.

## What a listener would notice

Nothing measurable stands out. Still listen once on a phone speaker and on headphones.

## Sound scores (1-10; 8 or more passes, `references/critic.md`)

| category | score |
|---|---|
| loudness | 10 |
| cleanliness | 10 |
| tone | 10 |
| speech | 10 |
| sync | 10 |
| structure | 10 |
| variety | 10 |
| stereo | 10 |
| **critic "Sound sync" row** (min of loudness, cleanliness, sync, structure) | **10** |

## Checks

| check | status | measured | target |
|---|---|---|---|
| `ears/loudness` | pass | integrated lufs -14.22; true peak dbtp -1.27; lra lu 2.6; tail peak dbfs digital zero | -14 +- 0.5 LUFS-I, TP <= -1.0 dBTP, LRA <= 10 LU, last 0.15 s silent |
| `ears/clipping` | pass | clipped runs 0; intersample over samples 0; crest factor db 16.0; plr lu 13.0 | no flat-topped runs, no samples or true peaks over 0 dBFS, PLR >= 8 LU |
| `ears/tone` | pass | db per octave vs mid sub 4.1, low -0.9, mud -4.1, mid 0.0, presence -0.3, sibilance -7.3, air -7.3 | per-octave energy vs 500 Hz-2 kHz inside sub -24..12, low -10..10, mud -8..6, presence -16..2, sibilance -26..-3, air -38..-4 dB |
| `ears/speech` | pass | source vad; speech s 22.4; smr db median 31.7 | ducking >= 9 dB, speech-to-music >= 10 dB in 300 Hz-3.4 kHz, 110-175 wpm |
| `ears/sync` | pass | tempo bpm 120.0; tempo confidence 0.91; first audible frame 36; cuts on onset 1.0; cuts on beat 1.0; cues on anchor 0.85 | >= 60% of motion events within 2 frames of an onset, cue anchors on F + 1, risers end on F, an event by frame 3 (or a planned quiet open) |
| `ears/structure` | pass | drop s 2.0; drop share 0.05 | drop <= 75% of runtime, a 0.2-5 s breath before the final sting, no unplanned dead air >= 2 s |
| `ears/repetition` | pass | onset clusters 22; rhythm elements 22 | the same non-rhythmic sound <= 3 times per 10 s |
| `ears/stereo` | pass | correlation 0.97; mono loss db 0.12; width db -17.8 | correlation > 0, mono loss <= 1.5 dB, side <= -3 dB vs mid |
| `ears/compare` | info | - | bass share inside the role range |

### ears/loudness (pass)

- note: loudness range 2.6 LU over the whole file, 2.2 LU without the planned quiet regions (plan.audio.quiet): the range is judged on the latter
- note: platform playback offsets (negative = turned down): youtube +0.0 dB, spotify +0.2 dB, tiktok / reels / shorts / x / linkedin (house) +0.0 dB, hero.web -1.8 dB, broadcast (EBU R128) -8.8 dB

### ears/tone (pass)

- note: locally harsh at 0.6 s, 14.6 s, 15.1 s, 15.6 s

### ears/speech (pass)

- note: ducking not measurable: no music-only stretch of 0.5 s next to the line (gaps that move like speech are skipped), or no music at all; the music is louder during the line than around it (it changes there). Judge it by ear, or check the stems (music/mixer.py writes stem_music.wav)
- note: speech found by the energy + spectral detector (it misses some lines, so the gaps it compares against may hold speech): ducking and masking are measured but not judged. Pass --transcript (refstudy study.json, Whisper JSON or a words.json) for a verdict.

### ears/sync (pass)

- note: planned quiet open 0.0-1.2 s (the picture moves from frame 0; the sound enters on the first visual event (the accent word)): the sound enters at frame 36 (1.21 s), as planned; the picture must move from frame 0
- note: tempo can read as half or double time; 120.0 BPM also fits 60.0 / 240.0
- note: mode continuous: cuts on onsets 100% is information only (the >= 60% rule applies to music-led, cut-driven pieces; references/critic.md)
- note: chance level: 64% of the timeline is inside the onset windows, so 75% of motion events on an onset is about what luck gives (z 1.6); it is not evidence of sync

### ears/structure (pass)

- note: ending: decay (the last 2 s -30 dB against the body)

### ears/repetition (pass)

- note: plan repeats id sfx/ui/blip 4x in 10 s (the mixer varies the take, so this is a note up to 6)
- note: plan repeats id sfx/ui/pop 3x in 10 s (the mixer varies the take, so this is a note up to 6)
- note: plan repeats id sfx/ui/slide 4x in 10 s (the mixer varies the take, so this is a note up to 6)
- note: plan repeats id sfx/ui/tick 3x in 10 s (the mixer varies the take, so this is a note up to 6)

### ears/compare (info)

- note: bass share (<150 Hz) 32% vs 20-36% for a proof bed (round 4/5 references): inside the range

### Sections

| from (s) | to (s) | RMS dBFS | label |
|---|---|---|---|
| 0.0 | 2.0 | -29.3 | intro |
| 2.0 | 34.5 | -16.6 | drop |
| 34.5 | 39.0 | -30.4 | outro |

### Mood

mood: not available (no local model)
