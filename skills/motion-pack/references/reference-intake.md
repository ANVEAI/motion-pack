# Reference intake: learning from a video someone shares

A shared reference (a post, a launch film, a breakdown) is **craft to learn from, never a design to copy**. The output of an intake is a written study and, where the pack lacks a technique, new owned parts. It is never a remake.

## 1. Measure it

```bash
python3 tools/refstudy.py <x-status-url | mp4-url | file.mp4> refs/<name> [--whisper base|small|none]
```

- Needs ffmpeg (`FFMPEG` to override), numpy and matplotlib. Speech needs the openai-whisper CLI (`WHISPER_BIN`); use `--whisper none` without it.
- It writes `sheet.jpg` (contact sheet), `timeline.png` (loudness, bands, onsets, beats, cuts, motion events, speech on one axis), `study.json` (every number) and `meta.json` (post reach when the source is an X post).
- `study.json` also carries:
  - `motion`: visual events (frame-difference and colour-change peaks, new text via edge-density jumps) from a fixed 30 fps, 96x54 pass, and `motion.sync.share_on_onset`, the share within 2 frames of an audio onset. This is the sync number for **continuous** pieces, where the cut sync is n/a. With a transcript, `share_in_speech_gaps` says whether the picture advances between lines.
  - `quiet`: the quiet open (`open_vs_body_db`, the quieter of the first two seconds) and the quiet tail (`tail_2s_vs_body_db`, also `tail_3s`) against the body median, `quiet_open` (≤ −6 dB), `quiet_tail` (≤ −10 dB), `sound_enters_s` and `end_shape` (slam, quiet hold, decay, level).
  - `evidence`: the reach tier (below).
- Keep `refs/` **out of the repository**: stills and transcripts are third-party material. Commit only the written study.

**Read the numbers with care:**
- Cut counts are inflated on glitch, dither and flash pieces. Confirm cuts on the sheet.
- Tempo is an estimate (`tempo_confidence` below about 0.3 means guess). It is often wrong under dialogue.
- Whisper hallucinates on music. Trust `likely_music_hallucination` and drop any repeated line.
- Reach (views, bookmarks) is the poster's claim at study time. Grade it with the tier below; references without reach data teach technique, not reach.
- Cut sync is not a quality score. Read it as the edit's rhythm: in round 4/5 the two 73%-sync pieces were tier C, tier-A VO films sat at 40–59%, and 5 of the 7 continuous pieces were tier A or A−.

### Grade the evidence

`refstudy.py` grades every new study from `meta.json`, and grades existing folders without re-downloading:

```bash
python3 tools/refstudy.py grade refs/*/ [--write] [--json] [--tiers my_tiers.json]
```

| tier | rule (percentages are of views; v/f = views ÷ followers) | read |
|---|---|---|
| **A** proven organic | v/f ≥ 1.5, or bookmarks ≥ 1.5%, at a like rate ≥ 0.2% | the format travelled |
| **A−** saves-strong | bookmarks ≥ 1.3% with less reach | builders save it |
| **B** boosted-looking (`boosted: true`) | like rate ≤ 0.05%, or v/f ≥ 100 with likes ≤ 0.15%, or reach without likes (< 0.2%) | learn the craft, ignore the reach |
| **B′** solid for a big account | ≥ 1M followers and v/f ≥ 1 | |
| **R** account-size reach | ≥ 500K views at v/f < 1 | millions of views that prove the account, not the format |
| **C** weak or neutral | none of the above | |
| **D** no data | no views or follower count | craft only |

- `claim_driven: true` (shown `A*`) flags an A with v/f ≥ 10 at a like rate under 0.4%: the post text made a provocative claim, so part of the reach is debate.
- The thresholds live in `tools/refstudy_tiers.json`; `--tiers` swaps them, and `--tier X` or `meta.json` `"tier_override": {"tier": "C", "why": "..."}` forces one with a reason. The tier and its reasons go into `study.json` `evidence` and the printed summary.
- On the 29 round 4/5 studies the rules reproduce the hand grades exactly (11 A, 2 A−, 4 B, 1 B′, 4 R, 7 C), and the quiet measures reproduce the hand counts (13 quiet opens, 17 quiet tails of 28 with audio). `tools/tests/test_refstudy.py` holds the numbers.

## 2. Look at it

1. **Sheet first.** Name each beat: what is on screen, what changes, how long it holds.
2. **Then the timeline.** Where are the hits? Do cuts sit on onsets (`audio.sync.share_on_onset`)? Where is the silence? How loud is the master (`loudness`), and does it clip?
3. Watch the original once with sound, at phone size.

## 3. Write the study

Save it as `docs/research/reference-<name>-<yyyy-mm>.md`. Use these sections, in this order (see `docs/research/reference-stan-launchpad-2026-10.md`):

| section | contents |
|---|---|
| **Source** | link to the post, author, date, duration and size; reception at study time with its evidence tier (`refstudy.py grade`) |
| **Use** | one line: craft reference only |
| **Structure** | a table of `t | beat | treatment`, one row per beat, in your own words |
| **What to learn** | 4-6 numbered techniques, each with *why* it works |
| **Not to copy** | the mistakes (clipping, black openings, fake UI, invented numbers) and anything that belongs to the source: footage, characters, brand, copy, music, its exact sequence |
| **Pack coverage** | a table of `technique | pack part | status`: **exists** (name the id), **partial**, or **gap** with a proposed id (`layers.duotone`, `type/outlineFill`, ...) |

Paraphrase. Quote at most a few words, and never reproduce scripts, lyrics or long on-screen copy. Then add any new, general pattern to `success-patterns.md` with the evidence tier.

## 4. Build the gaps as parts

- Every gap becomes an **owned, general part** with an id, a manifest entry, tests and a catalog card: a seek-safe layer, type preset, transition, cut pattern or synthesised sound. Name it by what it does, not by the brand that used it.
- Build the technique, not the reference's instance of it: a `cardStack` that riffles any images, not "the Pinterest stack".
- Sound gaps are synthesised in code like the rest of `sfx/` (no samples); cut gaps go into `cuts/patterns.json` with `cutgen.py` support.
- Update the study's coverage table (`gap` → `added <date>`) when a part lands.

## 5. Licences and honesty

- Never vendor the reference's media. Third-party assets for your own video go through `scripts/fetch-external.sh` and `sfx/tools/check_origin.py` (written licence terms only).
- Fonts: use OFL faces with a similar role, never the reference's licensed face.
- Never invent product UI or metrics to match a reference. If the real asset is missing, stop and ask.
- A film made after an intake must look like **your** brand: your palette, your type, your product, your real numbers.
