# Platforms: aspect, length, safe zones, brand cue, loudness

The code source is `templates/_shared/plan.mjs PLATFORMS` and `type/safezones.js`. The research is in `docs/evidence/edit.md` section 8 and `docs/evidence/sound.md` sections 5.2 and 5.3.

| preset | aspect | length target | safe zone (top / bottom / side) | hook text by | brandCueBy (s) | loudness | notes |
|---|---|---|---|---|---|---|---|
| `tiktok.organic` | 9:16 | 15-35 s | 14% / 35% / 6% | 0.3 s | 5 | -14 LUFS | Native, captions, loop welcome. |
| `reels.organic` | 9:16 | 15-35 s | 14 / 35 / 6 | 0.3 s | 6 | -14 | Needs a send-worthy beat; original content only [U]. |
| `shorts.organic` | 9:16 | 15-35 s | 14 / 35 / 6 | 0.3 s | 6 | -14 | Replays count as views [S]; design a loop. |
| `yt.ad.15` / `yt.bumper.6` | 16:9 (or 9:16) | 15 s / 6 s | 5 / 8 / 5 | 0.5 s | **5** (ABCD) | -14 | Multiple shots in the first 5 s. |
| `meta.ad.9x16` | 9:16 | 15-30 s | 14 / 35 / 6 | 0.3 s | 5 | -14 | CTA through the platform button, not burned in. |
| `x.video` | 16:9 / 1:1 | 20-45 s | 5 / 8 / 5 | 0.5 s | 7 | -14 | Autoplays muted: captions are mandatory. House violet #4A18ED. |
| `linkedin.video` | 1:1 / 4:5 | 30-60 s | 6 / 10 / 6 | captions mandatory | 7 | -14, LRA <= 7 LU | Office listening: dialog-first, soft transients. |
| `hero.web` | 16:9 | 20-45 s | 5 / 5 / 5 | n/a | n/a | -16 | Autoplays muted, should loop. |
| Festival / broadcast | per spec | | | | | **-23 LUFS / -1 dBTP** (EBU R128) | Keep a separate -14 social master. |

Machine-readable limits and CTA windows with their sources: `patterns/lengths.json` and `patterns/ctas.json` (in the pack). A YouTube or Instagram "view" now counts every start or replay; judge a hook by the 3 s hold and average view duration, not by views.

## 9:16 safe rectangle (1080x1920, conservative union)

The safe rectangle is `x 65..960`, `y 269..1248`. That means top 269 px, bottom 672 px and right 120 px are reserved. `type/safezones.js` uses `conservative`, and every platform row there is flagged `verify: true`.

`docs/evidence/visual.md` section 9 gives a looser alternative: x 60..960, y 220..1500. Sources conflict, so check the current platform UI before final export.

## Loudness facts

| platform | what is known | grade |
|---|---|---|
| YouTube | Normalises toward about -14 and turns loud content down. It does not boost quiet content. | B |
| Spotify | -14 LUFS (documented). Listener modes are -11 / -14 / -19 LUFS. | A |
| Instagram, TikTok, X, LinkedIn | No published spec. | D |

The house master is -14 LUFS-I, TP <= -1.5 dBTP on the WAV, and AAC probes <= -1.0. HyperFrames lowers the whole track if the AAC is over -1 dBTP.

Not yet tested empirically: upload a -14 and a -10 clip privately and compare the in-app level (`docs/evidence/sound.md` section 5.3).

## Pace per format (`cuts/patterns.json pace`) [H]

| format | ASL | shots per 30 s | interrupts |
|---|---|---|---|
| Hype ad / launch | 1.2-2.0 s | 15-24 | 1.5 / 4 / 9 s |
| Beat edit | 1-2 beats (4 beats in verses) | 30-60 | On the grid |
| Talking head | 2.5-5 s | 6-12 | Punch-in per sentence, B-roll per idea |
| Mime-style spot | 2-3 s, 1.5 s reaction holds | 8-12 | One gag build, one payoff |
| Short film | 4-8 s, longer for emotion | 4-8 | None (emotion-led) |

## Export set

Author 16:9 and **re-layout** it to 9:16 (the 3D kit pages read `aspect=tall` from the query string, which `templates/_shared/render3d.sh <dir> <page> tall` passes). Add 1:1 on request. Always cut a 6 s bumper for ads.
