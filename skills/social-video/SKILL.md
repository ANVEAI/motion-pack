---
name: social-video
description: Publish and grow finished videos on YouTube (Shorts and long-form), Instagram Reels, X, LinkedIn and TikTok - per-platform specs, titles, descriptions, captions, first comments with UTM links, hashtags, covers, AI-content disclosure, upload copies under a size cap, scheduling, and measurement that fixes the hook before scaling volume. Use this skill whenever the user wants to post, schedule, cross-post, caption, title or describe a video, write a first comment or pinned comment, choose hashtags, set the YouTube altered-or-synthetic or Instagram AI label, make a browser upload copy, plan a release, or work out why videos get no views or engagement, even if they only say post this or why is nobody watching. It reads the rendered MP4 plus script.md, shotlist.json and design.json and writes a post/ folder (copy per platform, covers, upload copies, checklist, log). It drafts first; the user posts or approves every post, and no number is invented.
license: MIT
compatibility: Writing and checklist skill. scripts/upload_copy.py needs Python 3.8+ and ffmpeg/ffprobe with libx264 on PATH. Posting itself happens in the platforms' own apps or schedulers, by the user or with their explicit approval. Works in Claude Code and in any agent that reads Agent Skills.
metadata:
  version: 1.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# social-video: get a finished video seen, honestly

A finished video is not distribution. Each platform gives a new post a small test with strangers and keeps showing it only if they stay, replay and share. This skill prepares everything a post needs, per platform, keeps the disclosures honest, and reads the numbers in a way that tells you what to fix next. It drafts; the user publishes.

## Where this sits in the pipeline

```
brief.md ─▶ story-script ─▶ script.md + shotlist.json ─▶ frame-design ─▶ design.json
        ─▶ motion-pack (+ spec-to-loop, Blender plates) ─▶ plan.json ─▶ MP4 ─▶ social-video ─▶ post/
```

- **Reads:** the delivered MP4s (one master per aspect), `script.md` (logline, stake, send line, honesty table), `shotlist.json` (hooks, posters, claims with sources, labels) and `design.json` (`frames.cover`, palette and type for covers).
- **Writes:** `post/`:

```
post/
  checklist.md            pre-flight, per platform, ticked before anything is published
  copy/youtube.md         Short title, long-form title, description, pinned comment, hashtags, AI answer
  copy/instagram.md       caption (stake in the first 125 characters), first comment, hashtags, AI label, cover note
  copy/x.md               post text, first reply with the link
  copy/linkedin.md        post text, first comment with the link
  copy/tiktok.md          caption, hashtags, AI-generated content setting
  covers/                 cover-9x16.jpg, thumb-16x9.jpg (built to frame-design's rules)
  upload/                 <name>-upload.mp4 copies under a tool's size cap (only when needed)
  log.md                  every post: platform, time, ID or URL, settings, the numbers at 24 h / 72 h / 7 d
```

- **Hands back:** what the numbers say goes to story-script (hooks, stakes) and frame-design (covers) for the next video.

## When to use, and when not

- **Use it** to post or schedule, to write titles, descriptions, captions and first comments, to set disclosure labels, to make an upload copy, to plan a release across platforms, and to diagnose low reach.
- **Do not use it** to write the script (story-script), design the cover (frame-design rules; this skill applies them) or edit the video (motion-pack).

## Hard rules

1. **Draft-first; the user publishes or approves.** Prepare `post/` and say what is ready. Publish, schedule, comment, or change account settings only with the user's explicit approval for that specific action. If the user says "post", confirm whether they mean every platform now or a staggered plan, then follow what they said.
2. **No invented numbers.** Every figure in copy has a source the user can show. Platform behaviour you describe is labelled as published by the platform, as practitioner belief, or as your own measurement.
3. **Disclose AI honestly, per platform** (table below). Over-disclosing costs little; under-disclosing costs trust and can cost the post.
4. **Upload the master for each aspect**, never a copy downloaded from another platform with its watermark.
5. **Product claims live in captions and descriptions**, with their status ("runs today", "in development", "demo data"), not added into the video.
6. **No automated engagement:** no bots liking, following or commenting, no engagement pods, no bought views, no templated mass DMs.

## Platform specs (verify the current limits; they change)

| platform | lead aspect | length to aim for | hard limits worth knowing | links |
|---|---|---|---|---|
| YouTube Shorts | 9:16 (1080 x 1920) | 15-35 s for most hooks; up to 3 min allowed | Shorts can run up to 3 minutes; a replay counts as a view | description and pinned comment; "Related video" can point a Short at its long cut |
| YouTube long-form | 16:9 (1920 x 1080) | as long as the story needs; pay off the Short's promise in the first 5-10 s | custom thumbnail 1280 x 720 | description, pinned comment |
| Instagram Reels | 9:16 (1080 x 1920) | 15-35 s; Reels up to about 3 min are recommended | AI label toggle defaults off; hashtags capped per post | bio only (caption links are not clickable) |
| TikTok | 9:16 (1080 x 1920) | 15-35 s | AI-generated content setting in post options | bio |
| X | 9:16 or 16:9 | 20-45 s | standard accounts: 2 min 20 s and 512 MB per video | first reply |
| LinkedIn | 16:9 or 1:1 (4:5 also fine) | 30-60 s | MP4 with H.264 and AAC is the safe container | first comment |

Masters for every platform: H.264 High, yuv420p, AAC, `+faststart`, about -14 LUFS integrated, true peak -1.5 dBTP on the WAV master and at or below -1.0 dBTP decoded from the delivered file (motion-pack's master spec). Only YouTube publishes its normalisation (it turns loud content down toward about -14 LUFS); the others publish nothing, so one -14 master is the safe choice. Full table with sources and safe-zone notes: `references/platforms.md`.

## AI-content disclosure

| platform | setting | the rule this pack follows |
|---|---|---|
| YouTube | "Altered or synthetic content" (Yes/No) at upload | **No** for stylised CG, animation and motion graphics that nobody could mistake for real footage. **Yes** for any photoreal render or generated footage that could pass as real (a photoreal product that does not exist yet, a generated person, a realistic scene). YouTube says disclosure does not limit the audience |
| Instagram | "AI info" / "Add AI label" toggle at share | **ON** for every video this pipeline makes (an AI agent wrote the script, the code or the sound). It defaults **OFF**: verify it reads ON (the switch is checked) before Share, every time |
| TikTok | "AI-generated content" in post settings | ON whenever generated imagery, voices or photoreal renders appear; when unsure, ON |
| X, LinkedIn | no reliable per-post switch | say it in the text: "3D animation rendered in code", "AI-assisted illustrations, demo figures" |

Keep the same honesty labels in the video's fine print and in the description. Details: `references/platforms.md`.

## Copy per platform

Full templates and worked patterns: `references/copy.md`.

- **Title (about 50 characters or fewer):** the stake or the payoff first, in searchable words, and promise only what the video delivers. Shorts and Reels feeds play the video, so the title matters most for search, the channel page and suggested videos.
- **Description and caption:** line 1 repeats the stake (Instagram shows about the first 125 characters before "more"); then one plain sentence of what the viewer saw; the product and its honest status; the disclosure line; the link where the platform makes it clickable; then hashtags.
- **First comment or reply:** YouTube pin a question that starts replies; LinkedIn and X put the link in the first comment or reply (practitioners widely report reduced reach for posts with links in the body; treat that as belief, not a published rule); Instagram adds context ("how it was made"), never a link.
- **Hashtags, sparingly:** Instagram 3 (the platform caps the number per post); YouTube up to 3 in the description; LinkedIn 3-5; TikTok 3-5; X none or one. Hashtags are labels, not the reach lever for short video.
- **UTM convention** on every link you post off-site: `utm_source=<platform>` (`youtube`, `instagram`, `x`, `linkedin`, `tiktok`), `utm_medium=<surface>` (`shorts`, `longform`, `reels`, `post`, `first_comment`, `bio`), `utm_campaign=<series or release>`, `utm_content=<video slug or hook variant>`. Lowercase, hyphenated, the same spelling every time. Keep a separate `utm_source` value for referrals from AI assistants so social and AI traffic never merge, and never put UTMs on links inside your own site.
- **One caption per platform.** Pasting one caption everywhere reads as spam and misses each platform's format.
- **Send line:** end the caption or the video on "send this to ..." naming a person; never ask for a keyword comment.

## Covers and thumbnails

Build them with frame-design's rules (one subject, at most 4 words, readable at 120 px wide, real type, no image-model text) and save them in `post/covers/`. Upload a custom thumbnail for every YouTube video: Shorts-feed views do not depend on it, but search, the channel grid and suggested videos do. For Reels, pick a cover whose words and subject sit in the centre, because the profile grid crops it.

## Upload copies under a size cap

Make the platform master itself with `python3 tools/deliver.py out/film.mp4 --preset youtube|shorts|reels|tiktok|x|linkedin` (BT.709 tags, faststart, loudness checked, the file verified); `upload_copy.py` then makes a capped copy of that master when a tool needs one. Post the SRT or VTT from `tools/captions/export.py` as the platform caption file where the platform takes one (YouTube), and burn captions in (`--burn`) for X and LinkedIn.

Some browser-automation upload tools cap a single file at about 10 MB, while a 1080p master can be several times larger. Make a copy with:

```bash
python3 scripts/upload_copy.py out/film-9x16.mp4 --out post/upload        # default cap 9.5 MB, two-pass x264, AAC copied
python3 scripts/upload_copy.py footage.mp4 --tune film --max-mb 9.5        # camera footage
```

It keeps resolution and frame rate, copies the master's AAC audio untouched (so loudness and true peak stay as measured), retries until the file is under the cap, and prints PSNR against the master. Below the house default of 44 dB, look at a frame; if it is soft, have the user upload the master by hand. In this pack's tests a 16 s 1080p CG spot fitted 1.2 MB at 54.6 dB, and a 15 s ad fitted 0.6 MB at 47.7 dB. Never work around a cap by injecting a file input or uploading in chunks through page scripts: use the platform's own file picker with a copy that fits. Browser-posting gotchas: `references/posting.md`.

## Scheduling vs posting everywhere at once

- **Posting everywhere at once** suits a launch moment or a user who asks for it. It only helps if someone can answer comments on every platform in the first hour.
- **Staggering** suits a series: one fixed daily slot per platform, at least 2 hours between two posts on the same platform, at most 2 new posts per platform per day during a release, never two in the same hour. Stacked posts compete for the same small test audience.
- **Native schedulers** (YouTube Studio, the platform's business suite, LinkedIn's page scheduler) do not depend on a browser being open at post time. X is better posted live by a person who stays to reply.
- **Schedule for the audience's waking hours**, even when the user says "immediately" at 3 AM; say so and pick the next sensible slot.

## Measure, then fix the right thing

Read the numbers at 24 hours and 72 hours (and 7 days for long-form), never at one hour. Full metric map and the experiment log: `references/measure.md`.

| what to read | where | what it tells you |
|---|---|---|
| Hook rate | 3-second views / impressions where shown; YouTube Shorts "viewed vs swiped away"; Instagram skip rate | whether frame 0 and the first two seconds work |
| Stayed to watch, average view duration, retention curve | YouTube Studio, Instagram and TikTok insights | where the story loses people |
| Replays and loops | platform insights | whether the ending feeds the start |
| Sends and shares | Instagram sends, share counts | whether someone had a reason to pass it on |
| Clicks on the UTM links | your analytics, by `utm_content` | whether the video moved anyone to act |

- **Volume without reach does nothing.** An account that publishes hundreds of automated videos into silence can sit at single-digit views per post; more posts will not fix it. Check views per post on the last ten before adding volume, and fix the hook and the format first.
- **Fix in this order:** the first two seconds (the stake in motion on frame 0, the first sound on frames 0-3 or planned 1-2 s later, no title card; the rule is in motion-pack `references/virality.md` §1), then the format and length, then the topic, then covers and copy. Thumbnails and hashtags are not the lever for Shorts and Reels feeds.
- **One change per test**, logged before and after; keep the body identical when you test hooks (story-script writes three).
- **Never repost a flop as new**; re-cut its opening instead.
- **People behind the first hour** beat any scheduling trick: reply to every comment, and share it personally with a few people who would care (one personal message each, no request to like or share).

## Honesty in copy

- Status words match the product's reality: "runs today", "in build", "planned", "in development", "demo data", "illustration".
- No "free", "100%", "guaranteed" or security superlatives unless they are literally true and approved; keep a banned-word list per brand in `post/checklist.md`.
- No real people, brands or logos the user has no right to use; no fake testimonials or reviews.

## Works well with

The **social-media-skills** pack by Charlie Hills (MIT), https://github.com/charlie947/social-media-skills: `hook-generator`, `post-writer`, `reels-scripting`, `youtube-thumbnail`, `pinned-comment`, `post-scorer` and others. Use them for platform-native writing styles and scoring; this skill supplies the video-specific specs, disclosure rules, upload copies and the measurement loop. Credit goes to its author; nothing from it is copied here.

## Files in this skill

| path | what |
|---|---|
| `references/platforms.md` | specs, safe zones, loudness, disclosure details, link and hashtag placement, with the basis for each |
| `references/copy.md` | title, description, caption, first-comment and pinned-comment templates per platform; UTM builder; checklist and log templates |
| `references/measure.md` | metrics per platform, reading windows, the diagnosis ladder, the experiment log |
| `references/posting.md` | browser and scheduler gotchas: hidden tabs, upload caps, drafts that publish themselves, processing checks |
| `scripts/upload_copy.py` | two-pass x264 upload copy under a size cap, AAC copied, PSNR against the master |
