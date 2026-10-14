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
| `det/report.txt` | only with a composition directory: two `png-sequence` renders, frame hashes compared; the first differing frame's PSNR |
| `critic.json`, `review.md` | the numbers in one place, and the rubric to fill in |

Determinism renders the composition twice, so it is slow; run it once per review round, not per tweak. Identical hashes are the goal. A differing frame at 60 dB or more is GPU blur noise; below that it is a seek bug (see motion-stack `seekcheck.mjs`).

## 2. Score it (1-10 each)

| criterion | 8 or more means | evidence |
|---|---|---|
| **Hook in 2 s** | frame 0 is in motion; the problem or the broken expectation is clear by 2 s; at most 7 words; no logo bumper, no black | sheet tiles 0-4, `phone/phone_000.00s.png`, `phone_001.00s.png`, `phone_002.00s.png` |
| **Phone readability** | every word reads at 360 px; at most 2 caption lines; text inside the 9:16 safe zone; contrast holds over motion | `phone/` |
| **Motion** | eases have intent (snap, settle, glide, land), no linear drift, no pops or smears in the strip, nothing everything-fades-in | `motion_strip.jpg`, `loop2x.mp4` |
| **Variety** | something visibly changes every 2-4 s; no three same-scale shots in a row; the interrupt ladder holds | `sheet_2fps.jpg` |
| **Sound sync** | at least 60% of cuts within 2 frames of an onset; hits on F + 1; the loudness is −14 ± 0.5 LUFS-I and no clipping; the audio has shape on its own (the blindfold test) | `critic.json` `sound_sync`, `loudness`; `refstudy/timeline.png` |
| **Brand accuracy** | the real logo, palette, type and product UI; real numbers with a source; placeholders labelled | sheet, end card, `phone/` |

Write the score and the evidence (file and timestamp) for every row of `review.md`. A score without evidence does not count.

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
| cuts off the music | `cuts/cutgen.py snap --study reviews/rN/refstudy/study.json` with your cut list |
| everything fades in | give each element one entrance verb (mask, slide, scale) and let some arrive by cut |
| a loop that jumps | make the last state equal the first (`loop2x.mp4`, `seam.jpg`) |
| clipping, or quiet | remaster through `music/mixer.py`; never gain by hand |
| invented UI or numbers | replace them with the real asset, or label the placeholder |
