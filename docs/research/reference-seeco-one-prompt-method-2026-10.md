# Reference study: "Opus 5.5 Motion Design: what the viral 'one-prompt' videos are hiding" (article)

**Source.** An X article by @seeconvm, 2 Oct 2026 ([post](https://x.com/seeconvm/status/2106096193235259564)). At study time it had 204K views and 735 bookmarks. This is a method write-up, not a video.

**Use.** Process and craft ideas, paraphrased and mapped to the pack. The article's claims about other creators' results are its own reporting and unverified by us.

## The method, in short

1. **Frame function.** The model writes a program in which `seek(t)` paints exactly frame t; a headless browser captures frames and ffmpeg encodes. There are no timers, and noise is seeded. This is the pack's core contract already.
2. **The rig.** It needs an agent with a shell that can render, listen to and look at its own output, plus a project CLAUDE.md with house rules. Those rules cover:
   - the render contract;
   - banned defaults: centred title on a gradient, everything fading in, corner labels, glow on UI;
   - one display face, one UI face, one accent;
   - something new on screen every 2–4 s;
   - synthesised sound at −14 LUFS;
   - a contact-sheet review before showing anything.
3. **The brief, not a vibe.** A production document has five parts:
   - **FILM:** the one sentence the viewer keeps, the audience, duration and formats.
   - **ASSETS:** the real logo, UI, type, colours and audio.
   - **VISUAL:** what to keep from the reference and which clichés to avoid.
   - **HARD LINE:** never invent product screens or metrics.
   - **DELIVER:** storyboard, contact sheet, video, poster, source.

   A vague one-liner leaves every blank to defaults, so everyone's film looks the same ("brief contagion"). Keep one session per brand so the pipeline carries over.
4. **A reference supplies the visual grammar.** Extract a frame every 0.5 s, write `style_guide.md` (hex palette, type, shot lengths, transitions, camera, grain) and `shotlist.md`, and take the grammar, never the subjects, logos or copy. Approve both before any code. If an asset is missing, stop and ask; never fake it.
5. **State lists.** Write what the viewer knows at each second:
   - hook (0–2 s);
   - problem (2–5 s);
   - reveal through a real interaction (5–9 s);
   - proof (9–13 s);
   - close with a readable CTA (13–16 s).

   The "UI morph" form uses **one container that morphs size, radius and colour from state to state**, driven by a cursor making real clicks. The final frame matches the first, so it loops. Example chain: logo → CTA button → typed email → loader → success check → dashboard → chart draws → tooltip → command palette → toast → logo. Every beat has an entry state, an exit state and a reason.
6. **Springs and sound.**
   - Use closed-form springs, stacked one per target change: `v(t) = v0 + Σ (v_i − v_{i−1}) · spring(t − t_i)`. This stays seekable.
   - Motion classes: small UI snaps with minimal overshoot; panels settle; the camera glides; headlines land hard and hold; mascots bounce.
   - Sound runs on the same clock. Measure a supplied track for beats, downbeats and hits; put state changes on beats, big moments on downbeats, and clicks and whooshes on hits.
   - The blindfold test: does the audio have shape on its own?
7. **The critic.** Build evidence with ffmpeg:
   - a contact sheet at 2 fps, 6 across;
   - a strip of 12 consecutive frames around the fastest move;
   - 360 px phone-test frames;
   - the clip looped twice;
   - frame 300 rendered twice with matching hashes.

   Score 1–10 on hook in 2 s, phone readability, motion, variety, sound sync and brand accuracy. List the 3 worst defects with timestamps, fix them locally, and repeat until every score is 8 or more.
8. **The skill and gates.** The studio folder holds brief.md, style_guide.md, shotlist.md, assets/, src/, reviews/ and out/. Overnight runs pass six gates:
   1. references and assets approved;
   2. style guide and shot list approved;
   3. stills for every shot, critiqued;
   4. a 960×540 animatic with placeholder audio;
   5. full polish and sound;
   6. formats, loop check, poster frame and README.

   Every aspect comes from one timeline, never a crop: vertical gets bigger type and fewer elements, square gets tighter holds, wide gets more spatial context.

## Pack coverage

| idea | pack | status |
|---|---|---|
| `seek(t)`, seeded noise, contact sheet, determinism hash | core contract, `templates/_shared/sheet.py`, motion-stack `seekcheck.mjs` | exists |
| Brief, script, shotlist, design pipeline | story-script → frame-design → motion-pack | exists |
| Sound on the same clock, hits on F+1 | `music/mixer.py`, cue rules | exists |
| Reference → style guide → shot list | `tools/refstudy.py` + `skills/motion-pack/references/reference-intake.md` | added 2026-10-14 |
| **Closed-form stacked springs** with motion classes | none | gap: `type/ease.js` → `springTrack(t, changes, cls)` with classes `ui`, `panel`, `camera`, `headline`, `mascot` |
| **State-list morph container** (one shape through the whole story, cursor-driven, loops) | none | gap: `layout.stateMorph` plus a `cursor.path` driver |
| **Critic rubric and fix-the-worst-3 loop** | `skills/motion-pack/references/critic.md` + `tools/critic_pack.sh` (contact sheet, 12-frame motion strip, 360 px phone frames, loop check, hash) | added 2026-10-14 |
| **Six production gates** | motion-pack skill, "Production gates" | added 2026-10-14 |
| **Banned defaults list** | motion-pack skill, "Banned defaults" (plus frame-design anti-slop) | added 2026-10-14 |
