# The critic: score a render, fix the worst three, repeat

Nobody, person or agent, judges a film well from memory of the code. Build evidence from the **delivered MP4**, score it against a fixed rubric, and fix the worst defects locally. Repeat until every score is 8 or more.

## 1. Build the evidence pack

```bash
bash tools/critic_pack.sh out/film-9x16.mp4 reviews/r1 [templates/<your-video>]
```

| file | what to look at |
|---|---|
| `sheet_2fps.jpg` (+ `sheet_index.txt`) | 2 frames per second, 6 across. Variety, rhythm, dead stretches, the end card |
| `motion_strip.jpg` (+ `motion.txt`) | 12 consecutive frames around the fastest motion (hard cuts excluded). Smears, pops, a frame out of order, text tearing |
| `phone/*.png` | 360 px wide frames: the hook, the quarters and the end. Every word must read at this size |
| `loop2x.mp4`, `seam.jpg` | the clip played twice, and last frame next to first. Does the wrap jump? (`loop_seam_psnr_db` in `critic.json`) |
| `refstudy/timeline.png`, `refstudy/study.json` | loudness, onsets, cuts and the share of cuts within 2 frames of an onset |
| `ears/ears.md` (+ `ears.json`) | the sound, check by check: loudness, clipping, tone, speech and ducking, sync (cue anchors on F + 1), structure, repetition, stereo. The top 3 things a listener would notice, with fixes and timestamps, and a 1-10 score per category (`ears/README.md`) |
| `det/report.txt` | only with a composition directory: two `png-sequence` renders, frame hashes compared; the first differing frame's PSNR |
| `critic.json`, `review.md` | the numbers in one place, and the rubric to fill in |

Determinism renders the composition twice, so it is slow; run it once per review round, not per tweak. Identical hashes are the goal. A differing frame at 60 dB or more is GPU blur noise; below that it is a seek bug (see motion-stack `seekcheck.mjs`).

## 2. Score it (1-10 each)

| criterion | 8 or more means | evidence |
|---|---|---|
| **Hook in 2 s** | frame 0 is in motion; the problem or the broken expectation is clear by 2 s; at most 7 words; no logo bumper, no black. A small product-name super over moving footage is fine, and the sound may enter 1-2 s after a moving frame 0 when that quiet open is planned (`plan.audio.quiet`) | sheet tiles 0-4, `phone/phone_000.00s.png`, `phone_001.00s.png`, `phone_002.00s.png` |
| **Phone readability** | every word reads at 360 px; at most 2 caption lines; text inside the 9:16 safe zone; contrast holds over motion | `phone/` |
| **Motion** | eases have intent (snap, settle, glide, land), no linear drift, no pops or smears in the strip, nothing everything-fades-in | `motion_strip.jpg`, `loop2x.mp4` |
| **Variety** | something visibly changes every 2-4 s; no three same-scale shots in a row; the interrupt ladder holds | `sheet_2fps.jpg` |
| **Sound sync** | the edit's sync rule for its mode (below); hits on F + 1; the loudness is −14 ± 0.5 LUFS-I and no clipping; the audio has shape on its own (the blindfold test); planned quiet (open, dip, end-card hold) is marked in the plan | `ears/ears.md`: start from its suggested score (`critic.json` `ears.scores.critic_sound_sync`, the minimum of its loudness, cleanliness, sync and structure scores); `refstudy/timeline.png` |
| **Brand accuracy** | the real logo, palette, type and product UI; real numbers with a source; placeholders labelled | sheet, end card, `phone/` |

Write the score and the evidence (file and timestamp) for every row of `review.md`. A score without evidence does not count.

**Which sync rule applies** (round 4/5: cut sync did not predict reach; the two 73%-sync pieces were tier C, tier-A VO films sat at 40-59%, and 5 of the 7 continuous pieces were tier A or A−):

| mode (`plan.audio.mode`, or `ears/listen.py --mode`) | the film | 8 or more means |
|---|---|---|
| `music` (the default) | music-led and cut-driven: a montage, a beat edit, a hero sizzle | at least 60% of cuts within 2 frames of an onset |
| `vo` | VO-led: a founder film, an explainer, a documentary | **speech continuity**: cuts sit under the voice (61-89% of cuts in the reference documentaries fell inside a line), no cut inside a word, and a diagram or UI advances in a speech gap. Cut sync is information only. Needs a transcript with word timings (`words.json`) |
| `continuous` | few or no cuts: a camera glide, a diagram that grows, a proof film | at least 60% of the **motion events** (things appearing, flashes, large changes; `tools/refstudy.py` measures them) within 2 frames of an onset |

`ears` scores the mode it is given; `tools/critic_pack.sh` passes the refstudy motion events, and `EARS_MODE=vo|continuous` overrides the plan.

**The sound score uses ears.**
- `ears` measures what a meter can: level, peaks, balance, masking, ducking, placement and shape. Its suggested score is a ceiling, not the score.
- Then listen once at phone size and once on headphones. Lower the score for anything you hear that ears cannot judge: a sound that does not fit the picture, a cheesy bed, an unnatural voice.
- Never score above ears without fixing the measured issue first.
- Without a transcript, ears measures speech but does not judge it. Pass the composition's `words.json` (critic_pack does this when it exists) or a Whisper JSON.

## 3. Fix the worst three, locally

1. List the **3 worst defects** with timestamps: what is wrong, where, and the smallest local fix (one shot, one ease, one cue, one word).
2. Fix only those three. Do not restyle the film between rounds; global changes reset every score.
3. Re-render, rebuild the pack in a new folder (`reviews/r2`), and score again.
4. Stop when **every criterion is 8 or more**. If a score does not move after two rounds, the problem is upstream: go back to the script (story-script) or the design (frame-design), not the pixels.

## Common defects and their local fixes

| defect | fix |
|---|---|
| black or static frame 0 | start mid-motion; move the logo to the end |
| a line unreadable at 360 px | fewer words, bigger type, hold at least 9 frames fully formed |
| cuts off the music (mode `music`) | `cuts/cutgen.py snap --study reviews/rN/refstudy/study.json` with your cut list |
| a cut inside a word (mode `vo`) | move it to the word boundary or the gap between lines; advance the diagram in the gap |
| motion accents between sounds (mode `continuous`) | a cue on each accent frame, or move the accent onto the music |
| "dead air" or "first audible sound" warnings on a quiet you meant | mark it in `plan.audio.quiet` (`kind` open, dip, gap or hold, with `why`); ears then judges it as shape, within the house maxima (open 2 s, dip 4 s, hold 9 s) |
| everything fades in | give each element one entrance verb (mask, slide, scale) and let some arrive by cut |
| a loop that jumps | make the last state equal the first (`loop2x.mp4`, `seam.jpg`) |
| clipping, or quiet | remaster through `music/mixer.py`; never gain by hand |
| a cue off its frame (`ears/sync` cue rows) | place it through `templates/_shared/audio.py` / `music/mixer.py`, which put the anchor on (F + 1) x 48000 / fps |
| voice masked, or the bed not ducked (`ears/speech`) | add the voice as the plan's VO so the mixer ducks 9 dB; carve 1-4 kHz in the bed under the line |
| muddy, harsh or dull (`ears/tone`, with time ranges) | change the bed preset or the brightest sweetener in that range; then re-run ears |
| invented UI or numbers | replace them with the real asset, or label the placeholder |
