# Worked example: one prompt → a 15 s teaser and an X post (a real agent run)

This folder is the unedited output of a real run; only local paths were made generic. Claude Code (Opus 5.5) played a first-time user. It had the skills in `skills/` and a fresh clone of the pack, and nothing else.

**The prompt:**
> "Make a 15-second 9:16 launch teaser for Brewly, a fictional coffee-subscription app: a hook, the product reveal, one feature, and an end card with the app name. With music and sound effects. Then draft the X post."

**What the run took:**
- **Time:** 31 minutes wall-clock (15:45:52 → 16:16:51).
- **Work:** 39 logged steps and 66 shell calls.
- **Renders:** about 12–13 s each.
- **Mistakes:** every one, and every fix, is in [`RUNLOG.md`](RUNLOG.md).

| step | skill | file |
|---|---|---|
| brief | `story-script` | [`brief.md`](brief.md) |
| script, hooks ×3, beat sheet | `story-script` | [`script.md`](script.md), [`shotlist.json`](shotlist.json) (lint: 0 fail, 0 warn) |
| look: palette, type, grid, safe zones | `frame-design` | [`design.json`](design.json) (contrast: 12 pairs, 0 fail) |
| plan and build | `motion-pack` | [`plan.json`](plan.json), [`plan-16x9.json`](plan-16x9.json), [`template/`](template/) (`make.mjs` + `config.mjs`) |
| render and QA | `motion-pack`, `motion-stack` | [`brewly-teaser-9x16.mp4`](brewly-teaser-9x16.mp4), [`brewly-teaser-16x9.mp4`](brewly-teaser-16x9.mp4), [`qa/`](qa/) |
| post | `social-video` | [`post/x.md`](post/x.md), [`post/checklist.md`](post/checklist.md), [`post/covers/`](post/covers/) |

**Measured on the delivered files:**
- **Loudness:** −14.3 LUFS-I, −1.3 dBTP decoded, in both aspects.
- **Ids:** `check_ids.py` reports 0 unresolved.
- **Safe zone:** all text sits inside the 9:16 safe rectangle.
- **Repeatability:** two renders compared on PNG frames match at 93.6–113.1 dB, which is anti-aliasing noise only.

**What went wrong, and the fixes (abridged from the log):**
- **The first stills showed five faults:** the "empty" mug read as full, a label stretched full width, the clock wrapped, the beans were too small, and the UI text was small. The agent saw them on the contact sheet and fixed all five before calling it done.
- **The mixer flagged two hero hits too close together.** The agent fixed it by subtraction: one became a hard cut.
- **Comparing two MP4s looked like a determinism failure.** The cause is that multi-threaded x264 differs run to run. Comparing PNG frames showed a pass.
- **Several things the agent hit became skill fixes before release:**
  - build inside your clone;
  - extend `make.mjs` when CONFIG isn't enough;
  - one true-peak rule;
  - the exact repeatability procedure;
  - the GSAP settings.

**Reproduce:** copy `template/` into `templates/brewly/` in your clone, then:

```bash
node make.mjs
npx --yes hyperframes@0.8.142 render . -o out/brewly-9x16.mp4 --crf 23
```

For the wide version, run `node make.mjs --set aspect=16:9 --set platform=x.video`.

Brewly is a fictional brand made for this demo: no users, no numbers, no reviews, no real screens. The film labels it as fictional, and so does the post.
