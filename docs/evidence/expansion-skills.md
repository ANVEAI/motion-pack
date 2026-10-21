# Expansion research: skills, editors and gap analysis (13 Oct 2026)

Scope: agent skills (Claude Code skills) and MCP servers for video, motion and audio, plus a gap analysis of the current pack (418 components).
Method: only web pages were read and the pack's own files listed. Licence statements below come from the source page where I could read it, otherwise they are marked UNVERIFIED. Third-party directory pages (skillselion, claudemarketplaces, mcpservers.org) are used only as pointers, never as the licence source.

Confidence tags: [V] read on the primary source page this run, [S] only seen on a search-result summary or directory page, [U] unclear or not stated.

## 1. Baseline (skills assumed available, so not proposed again)

The survey does not propose duplicates of these public skill families:

- HyperFrames family: `hyperframes` (router), `hyperframes-core`, `-animation`, `-audio`, `-cli`, `-creative`, `-keyframes`, `-registry`, `-studio`.
- Remotion: `remotion-best-practices` (router, version 4.0.534), `remotion-create`, `remotion-markup`, `remotion-render`, `remotion-video`.
- GSAP: `gsap-*` (8). Anthropic creative skills: `slack-gif-creator`, `canvas-design`, `algorithmic-art`.

Important finding: the `hyperframes-cli` skill description already lists `transcribe`, `tts`, `remove-background`, `beats`, `keyframes`, `catalog`, `add`, `snapshot`, `grade-compare`. So word-level captions, beat detection and cutouts need no new skill; they need to be wired into the pack's templates.

## 2. Candidate skills, MCP servers and engines

None of these is part of this repo.

### 2.1 HyperFrames registry (the biggest win, and it is the editor we already use)

- Repo: https://github.com/heygen-com/hyperframes . Licence Apache-2.0, "no per-render fees or commercial-use thresholds" [V]. About 62k stars [V]. Catalog: https://hyperframes.heygen.com/catalog .
- I read about 80 percent of the catalog page (characters 0-200k and 250-463k of 463,785; two 50k slices unread). What exists there that our pack lacks:
  - Captions and text: Emoji Pop, Pill Karaoke, Highlight, Kinetic Slam, Editorial Emphasis, Parallax Layers (caption behind subject), Particle Burst, Neon Glow, Camera Follow Captions, Texture, Weight Shift, Word-Sweep Highlight, Marker Highlight, Strikethrough Replace, Text Along a Path, Split-Flap Board, Matrix Decode, handwritten write-on titles.
  - Lower thirds: BILD style, Accent Underline, Bold Block, Clean Bar, Neon Border, plus an 8-variant family (Color Block, Dark Card, Kicker Name, Mask Reveal, Side Rule, Soft Pill, Stack Bars). News Ticker.
  - Transitions (shader blocks, HyperFrames-native): Chromatic Radial Split, Cinematic Zoom, Cross Warp Morph, Domain Warp Dissolve, Flash Through White, Glitch, Gravitational Lens, Light Leak, Ridged Burn, Ripple Waves, SDF Iris, Swirl Vortex, Thermal Distortion, Whip Pan, Beat Freeze Cut (speed ramp + freeze + hard cut), Scribble Transition, Text Clone Wall, Halftone Dissolve, Grid Pixelate Wipe, Chromatic Aberration Wipe, Cut the Curve.
  - Call-outs: Scribble Callout Circle, Hand-Drawn Arrow, Squiggle Marks, Speech Bubble, Hand-Drawn Flowchart.
  - Split screen: Before After Wipe, Comparison Split, Split Tilt Cards.
  - Counters and charts: Number Wheel, Number Pop In, Count-Up Stat Card, Conic Progress Ring, Bar Chart Race, Data Chart, Decline Chart, Chart Story, Star Rating Fill.
  - Maps: World Map, US Map, US Flow Map, Bubble Map, Hex Grid, NYC Paris Flight route.
  - Social and UI: Social Proof Card, Testimonial Proof Card, Trust Strip, Native Notification Pop, Typing Indicator, Badge Pop, Success Check, instagram-follow.
  - Effects and overlays: Confetti, Echo Trail, Grain Overlay, Snow, Starfield, Cinemagraph, Filmed Screen, Anamorphic Streak Flare (experimental), Rack Focus (experimental), ~40 WebGL/WebGPU shader backgrounds labelled as the Shaders library (MIT).
- What it adds to us: it closes the "GL-only transitions hard-cut in DOM templates" limit in the pack README, because these transitions are already HyperFrames blocks. It also covers most of the gap list in section 3 for a fast first pass.
- Install path: `npx hyperframes add <name>` (per item, text files) or the marketplace `claude plugin marketplace add heygen-com/hyperframes`. Both fetch from the network, so they count as downloads: name the items and read each `registry-item.json` first.
- Security: HyperFrames CLI has telemetry commands (`hyperframes telemetry` is listed in the CLI skill) [U on defaults]; the `skills update` command self-updates skills; the repo mentions about 240 MB of Git LFS golden test baselines, skip with `GIT_LFS_SKIP_SMUDGE=1` [V]. Items run JS in a headless browser at render time only.
- Risks: per-item licences are not shown on the catalog page. Each item has a `registry-item.json`; read it before adopting. Several items are labelled experimental or WebGPU (not deterministic across GPUs). Items are HyperFrames-native, so they do not share our `plan.json` id contract; wrap each in a manifest entry (see section 4).
- Sources: https://github.com/heygen-com/hyperframes , https://hyperframes.heygen.com/catalog , https://skills.cat/skills/heygen-com/hyperframes/hyperframes-registry

### 2.2 Remotion skills (idea source only; do not install)

- Repo: https://github.com/remotion-dev/skills (also under `packages/skills` in remotion-dev/remotion). 12 skills: best-practices, create, markup, studio, render, maps, captions, saas, interactivity, docs, upgrade, multimedia [V, via https://www.remotion.dev/docs/ai/skills and the repo page]. About 5.1k stars.
- New versus what we have: `remotion-maps` (animated routes, markers, 3D flyovers, Mapbox/MapLibre/GeoJSON), `remotion-captions` (captions guide), `remotion-multimedia` (Mediabunny metadata).
- Licence: the skills repo page shows no licence [U]. Remotion itself is free only for individuals, non-profits and for-profit orgs with up to 3 employees; others need a Company License (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) [V]. Whether a team needs that licence depends on its headcount, and HyperFrames (Apache-2.0) is our editor. Verdict: do not install. Read the public docs for technique only (maps and caption pagination).
- Security: render skills drive a local Chromium and npm packages; no telemetry statement seen [U].

### 2.3 claude-video (agricidaniel) - mine the recipes, do not install

- https://github.com/agricidaniel/claude-video . MIT [V]. 30 stars, 8 commits [V]: immature.
- Adds: ffmpeg recipes for stabilisation, picture-in-picture, green-screen removal, privacy blur, LUT grading, speed changes; Whisper-based ASS karaoke captions (5 styles); promo pipeline.
- Security: 19 scripts; optional keys for Pixabay, Gemini TTS, Google Veo, FLUX / Stable Diffusion; yt-dlp and Playwright; has a PRIVACY.md I could not read [V for list, U for data flows].
- Verdict: overlaps `video-use`, `hyperframes` and our ffmpeg tools. Use only as a reading list for ffmpeg filter graphs (stabilise, PiP) when we write our own scripts. Sources: the repo page above and https://skillselion.com/skills/agricidaniel/claude-video/claude-video-caption (pointer only).

### 2.4 Other video skills and MCPs (assessed, not recommended)

| item | licence | what | verdict |
|---|---|---|---|
| video-creator/ffmpeg-mcp https://github.com/video-creator/ffmpeg-mcp | MIT [V], 153 stars | 8 thin tools (clip, concat, overlay, scale, frames); macOS only | Skip: ffmpeg via Bash already does this |
| browser-use/video-use https://github.com/browser-use/video-use | MIT [V], ~28.8k stars | transcript-driven edit | Needs an ElevenLabs key; `hyperframes transcribe` is the local alternative |
| heygen-com/skills https://github.com/heygen-com/skills | MIT [V], 476 stars | 3 skills (avatar, video, translate) | Needs a HeyGen API key or a paid plan. Only `heygen-translate` (dubbing) might matter later. A directory listing claims a raw-ffmpeg `video-edit` skill exists there; the repo page shows only 3 skills, so that claim is [S, conflicting] |
| calesthio/OpenMontage https://github.com/calesthio/OpenMontage | **AGPL-3.0** [V], ~67.7k stars | 11-12 agent video pipelines, 700+ knowledge files | Refuse to vendor (AGPL is not on the allowed list). Reading it for ideas is fine |
| erichowens/some_claude_skills https://github.com/erichowens/some_claude_skills | MIT [V], 245 stars | sound-engineer, voice-audio-engineer (ElevenLabs), others | No video skill; scripts not inspectable from the page. Skip |
| ComposioHQ/awesome-claude-skills https://github.com/ComposioHQ/awesome-claude-skills | Apache-2.0 repo, per-skill licences vary [V] | curated list | No audio, music or caption skills in it. Video Downloader (YouTube) is a copyright risk: do not use |
| anthropics/skills https://github.com/anthropics/skills | mixed: many Apache-2.0, document skills source-available [V] | art, music-named examples, docs | Nothing new for video beyond the creative skills listed in section 1 |
| Pixelbin-Media-Generation (listed on the Composio page) | [U] | cloud image/video generation | Skip: hosted service, licence unknown |
| nira-video-mcp (55 FFmpeg tools) https://claudemarketplaces.com/mcp/pachote/nira-video-mcp | [U] | MCP | Skip: licence unseen, directory page only |

### 2.5 Lottie and Rive

- lottiefiles/dotlottie-web https://github.com/lottiefiles/dotlottie-web : MIT [V], 901 stars, a root `SKILL.md` exists but I could not read it [U]. Playing Lottie inside HyperFrames needs a seekable player (`goToAndStop(frame)`); this is untested in the pack. Low priority.
- stevysmith/rive-skills https://github.com/stevysmith/rive-skills : MIT [V], 13 stars, 3 commits. `rive-generator` pulls an npm package and writes `.riv` files without the editor. Rive is a real-time state-machine runtime, which does not fit our "render from `t` alone" contract. Skip.
- LottieFiles free animations are under the Lottie Simple License: commercial use allowed, attribution optional, derivatives must stay under that licence, no compiling a competing library [V, https://lottiefiles.com/page/license]. It is a custom licence, not on our list. Decide per file; never bulk-bundle.

### 2.6 Music generation

- ACE-Step 1.5 https://github.com/ace-step/ACE-Step-1.5 and https://huggingface.co/ACE-Step/Ace-Step1.5 : code MIT [V]; the model card says licence MIT and "commercial-ready", training data described as licensed, royalty-free / public-domain and synthetic MIDI audio [V]. A ComfyUI wiki page instead says Apache-2.0 [S, conflicting], which is also allowed; either is acceptable, but record which file we read. Local: Gradio on :7860, REST on :8001, no telemetry statement seen [U]. Weights are about 4.7 GB (2B DiT) to about 9 GB (XL 4B) and download on first run [V]. VRAM from under 4 GB up to 24 GB depending on variant [V]; Apple Silicon support not confirmed [U].
- What it adds: real songs and beds with vocals-free mood variety, which the procedural composer cannot make ("competent generic beds", music README honest limits).
- Risks: the provenance claim is the vendor's own; keep the prompt, seed, version and licence text in a generation ledger per track. No human listening pass exists for any pack audio yet; a model output still needs a listen and a loudness master through `music/mixer.py`.
- Cloud music skills (Suno MCP, MiniMax, Skywork, Mureka, ElevenLabs music) need API keys or paid plans and have their own output terms [S]: not assessed further. Pointer: https://claudemarketplaces.com/skills/agentspace-so/runcomfy-agent-skills/ai-music

### 2.7 Emoji and sticker sources (overlaps `docs/research/expansion-visual.md` section 3)

| set | licence | verdict |
|---|---|---|
| Noto Color Emoji https://github.com/googlefonts/noto-emoji | fonts SIL OFL 1.1, tools and most images Apache-2.0, flags public domain [V] | Allowed. PNG and SVG available; repo size not shown. Download selected glyphs only |
| Microsoft Fluent Emoji https://github.com/microsoft/fluentui-emoji | repo LICENSE is MIT (Microsoft) [V] | Allowed on the LICENSE text, but I could not confirm the asset folder carries the same licence; check before use |
| Twemoji (jdecked fork) https://github.com/jdecked/twemoji | code MIT, graphics **CC-BY 4.0** [V] | Attribution needed: flag. The project accepts a README / About / footer mention |
| OpenMoji https://openmoji.org/about/ | **CC BY-SA 4.0** [V] | Refuse (share-alike) |
| Apple Color Emoji | Apple licence | Not licensed for our videos |

## 3. Gap analysis: what a top editor reaches for that the pack lacks

Evidence for "missing": I grepped the pack sources (excluding catalog and node_modules). There is no split-screen, call-out, countdown, cursor/click or audio-reactive component. Counters appear only inside the 3D readouts object. Charts: effectively none. Lower thirds exist only inline in the talking-head template. `speedRamp` exists only as a transition, not as a footage retime. The type module has 15 owned icons and 5 caption styles. See also the CapCut-class feature list (auto captions, beat-synced templates, velocity edits, glitch transitions, background removal, auto reframe): https://www.capcut.com/help/latest-capcut-editing-trends and https://www.miracamp.com/learn/capcut/the-ultimate-guide-to-autocut (vendor and review pages, so "popular" means "promoted", not measured).

### By video type

| video type | what exists | what a top editor would reach for and we lack |
|---|---|---|
| Ads (15/30 s) | transitions, ad template, type presets, SFX bundle | stat counters and price strikethrough; call-out pins with leader lines; device frame with cursor and click ripple; before/after and comparison split; feature checklist; sale badge and burst; social-proof, testimonial and trust-strip cards; end-card CTA with URL; countdown and urgency timer; simple charts |
| Short films | film-scene template, camera, grades, grain | letterbox and aspect ramps; chapter and title cards; slate; cinematic subtitle style (serif, fade) and bilingual subtitles; location super and map pin; timecode / REC HUD; 2D rack-focus; day-for-night grade |
| Mime-style spots | worker character with 51 poses, 6 emotions, smash cut | comic emotion marks (sweat drops, anger vein, heart burst, question and exclamation marks, dizzy spiral, sparkle, zzz, light bulb); speech and thought bubbles with pictograms; onomatopoeia text (BOING, POW); speed lines; dust poof; impact star; squash-stretch smear frames |
| Reels / shorts | punch cadence, flash, kinetic type, 15 icons | emoji / sticker reactions; meme top-bottom captions; reply-to-comment bubble; follow / subscribe prompt; progress bar; "wait for it" timer; hook pointers (arrows, circles); freeze-frame stamp; velocity (speed-ramp) presets on footage; green-screen cutout with outline |
| Talking head | cuts ladder, captions, punch-ins, J/L | voice chain (high-pass, de-noise, de-ess, compression, EQ, loudness) is missing; speaker-name cards in several styles; keyword call-outs; B-roll picture-in-picture; chapter markers; waveform |
| Explainers | ManimGX engine (outside engine, `engines/manimgx.md`) | route and map animations; bar / line / donut / race charts; flowchart draw-on; step list; timeline; code typing (CodeVideoModel, an outside engine, is not set up) |
| Beat edits / lyric videos | cutgen, beat template, flash | audio-reactive visuals (bars, ring pulse, waveform, spectrum) driven by the beat grid; lyric karaoke template; strobe-safe beat flash; beat-matched shake; speed-ramp curves; mirrored and kaleidoscope layers |

### Cross-cutting gaps

- Footage retime tool (speed ramps with eased curves, reverse flash, freeze-and-hold) as an ffmpeg `setpts` generator with frame-exact output; today only a transition exists.
- A manifest entry type for HyperFrames registry items, so the catalog, `check_ids.py` and plans can reference them by id.
- The five SFX pairings still pending, and sweeteners for every new component.
- No human listening pass. Platform loudness for Instagram, TikTok, X and LinkedIn is unverified.

## 4. Build in-house now (concrete components)

All are code or synthesised, deterministic from `t`, documented in the owning module manifest, with SFX pairings by id. Suggested ids:

1. `type/lowerThird.cleanBar`, `.boldBlock`, `.accentRule`, `.softPill`, `.newsBar`, `.neonBorder` (6 variants, safe-zone aware, name + role).
2. `type/counter.wheel`, `.countUp`, `.statCard`, `.ring`, `.priceSlash` (digits tick per frame, no layout shift, tabular numerals).
3. `fx/emotionMarks.*` (sweat, vein, heartBurst, question, exclaim, dizzy, sparkle, zzz, bulb): 9 vector marks with pop and wiggle, for the mime-spot template and reels.
4. `fx/impact.*` (onomatopoeia text, radial speed lines, dust poof, impact star, smear frame).
5. `stickers/*`: 40 owned vector reaction stickers (thumbs, fire, hundred, clap, eyes, mind-blown, tick, cross, party), with `popBounce`, `wiggle`, `float`. No third-party marks.
6. `callout.*`: scribble circle, hand arrow, underline, bracket, pin with leader line, spotlight box that dims the rest.
7. `layout.splitScreen` (vertical, horizontal, diagonal, 3-up, grid), `layout.pip` (corner snap, rounded, shadow, slide-in), `layout.beforeAfter`.
8. `cuts/retime.*`: `rampIn`, `rampOut`, `heroRamp`, `bulletTime`, `reverseFlash`, `freezeStamp`, plus `retime.py` that emits ffmpeg `setpts` / `atempo` chains with frame-exact boundaries, and an SFX bundle for ramps.
9. `layers/audioReactive.*`: bars, ring pulse, waveform line, spectrum, driven by the music beat grid or an envelope file (no WebAudio at render time).
10. `type/caption.meme` (top and bottom, OFL condensed face), `type/caption.replyCard`, `type/caption.cinematic`, `type/caption.bilingual`, `type/caption.oneWordSlam`.
11. `chart.*`: bar, line draw, donut, ring, race (SVG, data in, frame out).
12. `map.route`: stylised abstract map with route draw-on, pin drop and distance counter, with no external tiles or map data (avoids data licences).
13. `social.*`: follow button, reply-comment bubble, testimonial, notification pop, typing indicator, generic chat bubbles.
14. `device.*`: 2D phone and laptop frame with cursor, click ripple and scroll, generic styling.
15. `title.*`: chapter card, slate, timecode HUD, letterbox ramp, progress bar, 3-2-1 countdown, REC dot.
16. `talking-head/voice-chain.sh` (or `.py`): high-pass 80 Hz, de-noise, de-ess, compression, presence EQ, loudness to the house master, with measured before / after LUFS and TP, so the talking-head template gets a master pass.
17. `transitions/shapeMask.*` (circle, heart, star, text-mask) and `transitions/scribble` as owned DOM versions, and a wrapper that registers HyperFrames registry shader blocks so the nine GL-only transitions stop hard-cutting in DOM templates.
18. `camera/cam2d`: `crashZoom`, `doubleTake`, `dollySnap`, `rackFocus2D`.
19. `tools/catalog-wrap.mjs`: reads a registry item's `registry-item.json`, checks its licence against the allowed list, and emits a pack manifest entry. This is the gate for section 2.1.
20. `skill` update: add the new component sections and a "reach for X when" table to `skills/motion-pack/SKILL.md`.

Sequencing: do 1, 2, 6, 7, 8, 16 first (highest reach per hour, mostly pure functions), then 3-5 and 15 (mime spots and reels), then 9-14, then 17-20.

## 5. Open questions

1. HyperFrames registry items (Apache-2.0 repo; per-item licence in each `registry-item.json`) are small text files fetched by name. A suggested first batch: Emoji Pop, Pill Karaoke, Lower Thirds family, Scribble Callout Circle, Hand-Drawn Arrow, Before After Wipe, Comparison Split, Number Wheel, Count-Up Stat Card, Beat Freeze Cut, Confetti, News Ticker. None is fetched by this repo.
2. ACE-Step 1.5: weights are about 4.7 to 9 GB and need a machine that can run them; keep the generation ledger (section 2.6).
3. Remotion: check the Company License headcount terms before installing `remotion-dev/skills`; until then, docs reading only.
4. Lottie free animations and Twemoji (CC-BY) need an attribution policy before use.

## 6. Sources (all read this run unless marked pointer)

- https://github.com/heygen-com/hyperframes
- https://hyperframes.heygen.com/catalog
- https://skills.cat/skills/heygen-com/hyperframes/hyperframes-registry (pointer)
- https://github.com/remotion-dev/skills
- https://www.remotion.dev/docs/ai/skills
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- https://www.remotion.dev/docs/captions/
- https://github.com/agricidaniel/claude-video
- https://github.com/heygen-com/skills
- https://github.com/video-creator/ffmpeg-mcp
- https://github.com/browser-use/video-use
- https://github.com/calesthio/OpenMontage
- https://github.com/erichowens/some_claude_skills
- https://github.com/ComposioHQ/awesome-claude-skills
- https://github.com/anthropics/skills
- https://github.com/sundial-org/awesome-openclaw-skills (licence section not visible; unread)
- https://github.com/stevysmith/rive-skills
- https://github.com/lottiefiles/dotlottie-web
- https://lottiefiles.com/page/license
- https://github.com/ace-step/ACE-Step-1.5
- https://huggingface.co/ACE-Step/Ace-Step1.5
- https://github.com/googlefonts/noto-emoji
- https://github.com/microsoft/fluentui-emoji and https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE
- https://github.com/jdecked/twemoji
- https://openmoji.org/about/
- https://www.capcut.com/help/latest-capcut-editing-trends (vendor page)
- https://www.miracamp.com/learn/capcut/the-ultimate-guide-to-autocut (review page)
- Pointers from search results only: https://medium.com/@umair349hassan/how-to-use-claude-code-for-video-editing-4-github-tools-with-install-steps-72cf6be7f04e , https://claudemarketplaces.com/skills/agentspace-so/runcomfy-agent-skills/ai-music , https://claudemarketplaces.com/mcp/pachote/nira-video-mcp , https://claudemarketplaces.com/skills/heygen-com/skills/video-edit
