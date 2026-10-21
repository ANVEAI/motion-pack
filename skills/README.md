# motion-pack skills

Six Agent Skills that take a video from a one-line brief to a published post: the story, the look, the build, the tools and the release. Each skill writes files that the next one reads, so an agent (or a person) can stop at any step, check the work, and carry on. Made by ANVE (anveai.com) and released under the MIT licence with the motion-pack repository.

## The pipeline

```
 brief.md
    │
    ▼
 story-script ──────────▶ script.md + shotlist.json      the four lines, beat sheet, shot list, 3 hooks, review
    │
    ▼
 frame-design ──────────▶ design.json                    tone, palette (WCAG-checked), type, grid, safe zones, look, covers
    │
    ▼
 motion-pack ───────────▶ plan.json ──▶ out/<name>-<aspect>.mp4
    │   ├─ spec-to-loop   computed 3D loops and plates: spec.md ──▶ page.html ──▶ <name>.mp4 + master WAV + qa/
    │   └─ Blender plates photoreal product and 3D type (motion-pack recipes)
    │
    │   motion-stack      libraries, tools and QA, consulted at any step (GSAP, three.js, Lottie, encoders, seek checks)
    ▼
 social-video ──────────▶ post/                          copy per platform, covers, upload copies, checklist, log
```

## Which skill, when

| skill | use it when you want to | reads | writes |
|---|---|---|---|
| `story-script` | write or fix the story, script, hooks or shot list for an ad, launch film, short film, wordless character spot, chat skit, explainer or reel | `brief.md` | `script.md`, `shotlist.json` |
| `frame-design` | decide how every frame looks: tone, palette, type, grid, safe zones, look, title cards, lower thirds, end cards, covers | `shotlist.json`, `brief.md` | `design.json` |
| `motion-pack` | build and render the video from owned, deterministic parts (transitions, type, sound, music, layers, camera, objects, templates) | `shotlist.json`, `design.json` | `plan.json`, the MP4s |
| `spec-to-loop` | write a frame-keyed motion and sound spec and build a seamless generative 3D loop with a synthesized score | `brief.md` or a shot, `design.json` | `spec.md`, the loop MP4s, master WAV, `qa/` |
| `motion-stack` | choose and wire outside libraries and tools, and run determinism and delivery QA | any of the above | notes, configs, QA reports |
| `social-video` | post, schedule, caption, label and measure the finished video on YouTube, Instagram, X, LinkedIn and TikTok | the MP4s, `script.md`, `shotlist.json`, `design.json` | `post/` |

## The files that connect them

| file | written by | read by | what it carries |
|---|---|---|---|
| `brief.md` | the user or story-script | story-script, frame-design | audience, objective, platforms, length, proof you have, product status, banned words |
| `script.md` | story-script | people, social-video | logline, stake, turn, payoff, sound-off sentence, beat sheet, scenes, hooks, honesty table, review |
| `shotlist.json` | story-script | frame-design, motion-pack, social-video | one row per shot: beat, duration, scale, action, sound intent, on-screen text, honesty label, transition with reason; hooks; claims with sources |
| `design.json` | frame-design | motion-pack, spec-to-loop, social-video | tone cell, motion personality, palette and contrast pairs, type, grid, safe zones, look, key frames, cover, and a map onto real template `CONFIG` keys |
| `plan.json` | motion-pack | motion-pack's renderer and lint | shots, transitions with reasons, the SFX cue sheet, lint results |
| `out/*.mp4` | motion-pack, spec-to-loop | social-video | one master per aspect, about -14 LUFS, true peak at or below -1.0 dBTP decoded (the WAV master sits at -1.5) |
| `post/` | social-video | the user | per-platform copy, covers, upload copies, checklist, posting log |

## Install

**Claude Code plugin** (all six skills):

```
/plugin marketplace add ANVEAI/motion-pack
/plugin install motion-pack@anve
```

**One skill by hand:** copy its folder (for example `story-script/`) into `~/.claude/skills/` for every project, or into a project's `.claude/skills/`. In the repository the folders live under `skills/`. Any agent that reads Agent Skills (a folder with a `SKILL.md`) can use them.

**Requirements by skill:** story-script and frame-design need only Python 3 for their checkers; social-video's upload copier needs ffmpeg with libx264; motion-pack needs Node 22+, Chrome with a hardware GPU, ffmpeg and Python 3.11 in a venv with the pack's pinned `requirements.txt` (numpy, scipy, numba, soundfile, Pillow; 3.13 and newer cannot install the pins), plus `puppeteer-core` for its three.js templates; spec-to-loop needs Node, Chrome with a hardware GPU, ffmpeg and Python with numpy, scipy and Pillow (each `SKILL.md` lists its own `compatibility`).

## House rules every skill follows

- **Honesty:** no invented statistics, quotes, reviews, customers or logos. A number on screen or in copy has a source, or it is labelled ("demo figures", "example data", "render"). Where a skill gives a threshold, it says whether it is a published platform rule, practitioner belief or a tunable house default.
- **References are craft, never copies:** learn the method from outside work, then make your own.
- **Draft-first publishing:** social-video prepares everything; the user posts or approves each post.
- **Never let an image model redraw UI or text:** composite real screenshots.
- **Measure the delivered file**, not the preview.

## Works well with

- **social-media-skills** by Charlie Hills (MIT): https://github.com/charlie947/social-media-skills. Its `hook-generator`, `post-writer`, `reels-scripting`, `youtube-thumbnail`, `pinned-comment` and `post-scorer` skills pair well with story-script and social-video for platform-native writing and scoring. It is a separate project with its own licence and author; nothing from it is copied here.

## Licence

MIT. Fonts and third-party assets that motion-pack can fetch keep their own licences, which the repository lists next to each set.
