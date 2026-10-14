# Reference intake: learning from a video someone shares

A shared reference (a post, a launch film, a breakdown) is **craft to learn from, never a design to copy**. The output of an intake is a written study and, where the pack lacks a technique, new owned parts. It is never a remake.

## 1. Measure it

```bash
python3 tools/refstudy.py <x-status-url | mp4-url | file.mp4> refs/<name> [--whisper base|small|none]
```

- Needs ffmpeg (`FFMPEG` to override), numpy and matplotlib. Speech needs the openai-whisper CLI (`WHISPER_BIN`); use `--whisper none` without it.
- It writes `sheet.jpg` (contact sheet), `timeline.png` (loudness, bands, onsets, beats, cuts, speech on one axis), `study.json` (every number) and `meta.json` (post reach when the source is an X post).
- Keep `refs/` **out of the repository**: stills and transcripts are third-party material. Commit only the written study.

**Read the numbers with care:**
- Cut counts are inflated on glitch, dither and flash pieces. Confirm cuts on the sheet.
- Tempo is an estimate (`tempo_confidence` below about 0.3 means guess). It is often wrong under dialogue.
- Whisper hallucinates on music. Trust `likely_music_hallucination` and drop any repeated line.
- Reach (views, bookmarks) is the poster's claim at study time. Grade it: **proven** (counts you can see), **claimed** (someone says so), **craft-only** (small account). Craft-only references teach technique, not reach.

## 2. Look at it

1. **Sheet first.** Name each beat: what is on screen, what changes, how long it holds.
2. **Then the timeline.** Where are the hits? Do cuts sit on onsets (`audio.sync.share_on_onset`)? Where is the silence? How loud is the master (`loudness`), and does it clip?
3. Watch the original once with sound, at phone size.

## 3. Write the study

Save it as `docs/research/reference-<name>-<yyyy-mm>.md`. Use these sections, in this order (see `docs/research/reference-stan-launchpad-2026-10.md`):

| section | contents |
|---|---|
| **Source** | link to the post, author, date, duration and size; reception at study time with its evidence grade |
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
