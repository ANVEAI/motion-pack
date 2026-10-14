---
name: motion-pack
description: Make finished, platform-ready videos with an AI agent from motion-pack, an open-source kit of deterministic, seek-safe parts rendered with HyperFrames - transitions, kinetic type and captions, synthesised sound effects and music, overlays and film looks, 2D and 3D camera moves, three.js objects, Blender hero plates and genre templates. Use this skill whenever the user wants to make or edit a video of any kind - an ad, launch film, product promo, explainer, reel, short or TikTok, animated short film, wordless character spot, talking-head edit with captions and B-roll, music or beat-synced edit, kinetic title, lower third or sonic logo - even if they never mention motion-pack. It plans the edit, picks parts by id, syncs sound to frames, masters to platform loudness and checks the delivered file. For choosing or wiring outside libraries (GSAP, three.js, Lottie, Rapier, Remotion and others), load the motion-stack skill alongside.
license: MIT
compatibility: Node 22+ with npx (HyperFrames 0.8.142 renders the compositions), ffmpeg, Python 3.10+ with numpy, scipy, soundfile and Pillow for sound and QA, Chrome or Chromium; Blender 5.2 only for photoreal plates. Works in Claude Code and in any agent that reads Agent Skills.
metadata:
  version: 2.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# motion-pack: make every kind of video from owned, seek-safe parts

Every component in the pack is code: HTML/CSS/JS, GLSL, Python, or bpy. Each one is a pure function of time `t`, so a frame renders the same way no matter which frame came before. That is what makes agent-made video reliable: HyperFrames (and any frame-stepping renderer) seeks frames out of order, and nothing drifts.

## Find the pack

This skill ships inside the motion-pack repository at `skills/motion-pack/`.
- **Pack root:** the repository root, two folders above this skill's base directory. Installed as a Claude Code plugin, that is the plugin root.
- **If the skill was copied somewhere on its own:** look for a folder that contains `catalog/index.html` and `transitions/`. Otherwise ask the user, or clone https://github.com/ANVEAI/motion-pack.

Every path below is relative to the pack root.

**Read first:**
- `README.md`: module table, id conventions, licences.
- `catalog/index.html`: an offline gallery of every component. Rebuild it with `python3 catalog/build.py`.

**Detail lives in `references/`:**
- `launch-playbook.md`: launch-film archetypes, beat sheets and rules from 15 recent launches (evidence in `docs/research/launch-films-2026.md`).
- `apis.md`: per-module API cheat sheet.
- `platforms.md`: platform lengths, safe zones, loudness.
- `virality.md`: the hook and retention checklist with evidence grades.
- `gotchas.md`: the full list.
- `success-patterns.md`: hooks, storyboard shapes, motion vocabulary, sound and endings that recur in studied launch and motion films.
- `reference-intake.md`: how to learn from a shared reference (`tools/refstudy.py`, the study template, building gaps as parts).
- `critic.md`: the evidence pack (`tools/critic_pack.sh`), the 1-10 rubric and the fix-the-worst-three loop.

**Library and tool questions** (GSAP vs Anime.js, Lottie players, physics, post effects, Remotion, encoders, covers) are tested and answered in the **motion-stack** skill.

## When to use

- **Use it** for any request to produce or edit video.
  - Load `hyperframes` alongside it if available; it holds the composition contract and render CLI.
  - This skill decides *what to make and with which parts*. The renderer decides *how the page becomes frames*.
- **Do not use it** for still images or thumbnails alone, or for pure diagram explainers. Those go to a diagram/math animation tool; then come back here for sound, type and the finish.
- **Paid generation** (text-to-video models, avatar services, stock libraries) is never needed for a pack video. Use it only when the user explicitly asks and has seen the cost.

## Hard rules (every video)

1. **Ids, not copies.**
   - Reference parts as `transitions/<name>`, `sfx/<cat>/<name>`, `music/<id>`, `type/<preset>`, `layers/<kind>`, `objects/<name>`, `blender/<recipe>`, `cam2d.*` / `cam3d.*` and `cuts/<group>/<name>`.
   - Run `python3 tools/check_ids.py` before rendering; it must report 0 unresolved.
2. **Plan first.**
   - One `plan.json` drives the picture, the sound and the checks: shots, transitions with reasons, the cue sheet, and lint.
   - Start from the closest template in `templates/`. Its `CONFIG` block covers the stock structure. For another aspect (the ad template is 16:9), story-specific sound cues or new scenes, copy its `make.mjs` next to your CONFIG and extend it, keeping every reference an id.
   - Build inside your clone of the pack, for example in `templates/<your-video>/`. Templates find the pack two folders up, and `tools/check_ids.py` only scans the pack it sits in. On macOS, `cp -c -R` makes an instant copy-on-write clone of the whole pack for a scratch build.
3. **Default to the hard cut and motivate everything else.** Every non-cut transition carries a reason (`EMOTION`, `STORY`, `RHYTHM`, `ENERGY`, `REVEAL`, `PLACE`, ...). Lint refuses unmotivated transitions.
4. **Sound is half the cut.**
   - A cue for visual frame F puts its anchor sample on `(F + 1) x 48000 / fps`.
   - A whoosh peaks on the cut. A riser ends one frame before the hit.
   - Every transition has a paired sweetener (`transitions/catalog.json` `sfx`, `sfx/sweeteners.json`).
5. **Master spec:**
   - −14 LUFS-I, and true peak ≤ −1.5 dBTP on the WAV master. Use −2.0 if clicky transients push the AAC probe over.
   - The delivered MP4 decodes to ≤ −1.0 dBTP. HyperFrames lowers the whole track if its AAC goes over −1, so check the probe, not just the WAV.
   - The last 0.15 s is digital zero.
   - Use `music/mixer.py`. Never gain SFX by hand; the library is normalised to −6 dBFS peak.
6. **Honesty.**
   - No invented stats, quotes, reviews or logos. A claim containing a digit needs a `source` (`lint.proof`).
   - Label placeholders and concept renders where a viewer could mistake them for real.
   - Use original characters only. References are craft to learn from, never designs to copy.
7. **Measure the delivered file, not dev stills.**
   - `templates/_shared/sheet.py` gives a contact sheet plus LUFS and TP decoded from the MP4.
   - Look at the stills before you call anything done.
8. **Render somewhere safe.**
   - Work outside cloud-synced folders (iCloud, OneDrive, Dropbox): sync daemons can stall file reads mid-render.
   - Check free disk space before renders and stop under 10 GiB.
   - Render demos at `--crf 23`.

## Production gates (pass them in order; long or unattended runs stop at each for approval)

1. **References and assets approved.** Real logo, UI, type, colours and audio are in hand; each reference has a study (`references/reference-intake.md`). A missing asset means stop and ask, never fake it.
2. **Style guide and shot list approved.** Palette, type, shot lengths, transitions, camera and grain (frame-design), plus the shot list (story-script). Both before any code.
3. **Stills per shot, critiqued.** One still per shot at final layout, read at 360 px.
4. **960x540 animatic.** Timing, cuts and placeholder audio; check the hook and the cut rhythm here, while changes are cheap.
5. **Full pass.** Polish, the mixed sound, then the critic loop (`references/critic.md`) until every score is 8 or more.
6. **Formats, loop, poster, README.** 16:9 / 9:16 / 1:1 by re-layout, the loop check, a poster frame, and a README with the ids used and the measured loudness.

## Banned defaults (each needs a written reason in `plan.json` to appear)

- A centred title on a gradient.
- Everything fading in. Give each element one entrance verb, and let some arrive by cut.
- Corner labels and decorative captions nobody reads.
- Glow on UI.
- A logo bumper first. The logo belongs at the end.
- A black frame 0. Frame 0 is in motion.
- Invented UI or numbers. Use real screens and sourced numbers, or label the placeholder.
- Clipping. Master through `music/mixer.py` (−14 LUFS-I, ≤ −1.5 dBTP WAV, ≤ −1.0 dBTP delivered).

## Decision tree (pick the path in this order)

```
What is the deliverable?
├─ Talking head / interview / podcast / screen-record with a human voice ──> RECIPE H (human edit)
├─ Music drives it (lyric, montage, beat promo, dance, loop to a track) ──> RECIPE B (beat edit)
├─ Wordless character comedy, one gag + one feature ──> RECIPE Z (character spot)
├─ Story with a turn (cold open -> want -> obstacle -> turn -> button) ──> RECIPE F (short film / scene)
├─ Sell a product in 6 / 15 / 30 / 45 s (hook, problem, product, proof, CTA) ──> RECIPE A (ad)
│     launch / reveal / sizzle with a hero product? -> RECIPE L (launch film)
├─ Photoreal product, 3D title or abstract 3D art ──> RECIPE P (Blender plates), then composite here
├─ Terminal or ASCII look, a flock, a word a flock writes ──> terminal/ (baked plate as a <video> layer; set real titles with type/)
├─ Diagram / "how it works" / data / math ──> a diagram animation tool for the plates, then type, layers and sound here
└─ Anything else in HTML ──> a HyperFrames composition built from pack parts
Then: aspect set (16:9 master + re-layout 9:16 / 1:1, not a crop) -> VIRALITY checklist -> QA checklist.
```

**Engine choice:**

| situation | engine |
|---|---|
| Real footage, text, UI cards or 2D | HyperFrames DOM. Every visual transition plays: exact DOM back-ends, plus DOM approximations of the GL-only looks (`kind: 'dom', approx: true`). |
| The exact GL look of a GL-only transition (glitch, ink, filmBurn, lightLeak, morph, zoomThrough, pagePeel, pixelSort, ...) | Canvas sources via `transitions/lib/tx-gl.js`, or the three.js pass |
| ffmpeg-only finish (proxy, server render, no browser) | `transitions/lib/xfade.js xfadeFilter('transitions/xfade-<mode>')`; retime with `cuts/retime.py ffmpeg` |
| 3D props, sets or the character | The three.js objects kit through `templates/_shared/render3d.sh` (GPU-supersampled, seek-safe) |
| Photoreal hero product, 3D type, sculpted art loops | `blender/` recipes (Blender 5.2, EEVEE plates or Cycles stills), then composite in HyperFrames |

## Reach for X when

| you need | reach for | notes |
|---|---|---|
| a name on screen | `type/gfx` `lowerThird.cleanBar` (interview), `.accentRule` (premium), `.softPill` (creator), `.boldBlock` (ad), `.newsBar` (comedy "breaking"), `.neonBorder` (gaming/night) | sits in the platform safe rect (`params.platform`) |
| a number to land | `counter.countUp` / `.statCard` (needs `source`), `.ring` (percent), `.wheel` (year / odometer), `.priceSlash` (offer) | digits need a source |
| point at something | `callout.scribbleCircle`, `.handArrow`, `.underline`, `.bracket`, `.pinLeader`, `.spotlight` | sound: `sfxFor(id)` |
| a comedy beat | `fx.emotion.*` (sweat, vein, heartBurst, question, exclaim, dizzy, sparkle, zzz, bulb), `fx.impact.*` (onomatopoeia, speedLines, dustPoof, star, smear) | one mark per gag |
| reels furniture | `social.*` (follow, reply bubble, notification, typing, chat), `caption.meme` / `.replyCard` / `.oneWordSlam`, `sticker.place` / `reaction.place` / `reaction.burst` | for real emoji, fetch Fluent Emoji (see Outside assets) |
| show a product on a device | `device.phone` (taps, scroll), `device.laptop` (cursor path + clicks) | the screen recording goes UNDER the frame |
| AI at work / product UI without real screens | `ui.agentActivity`, `ui.promptBar`, `ui.checklist`, `ui.nodeGraph`, `ui.scanOverlay`, `ui.isometricTilt`, `ui.stateMorph` (`type/gfx/ui.js`); `uiCues(id, {at, params})` gives one sound per UI action | generic layout, labelled placeholder data; set `scale` 1.3-1.6 on 16:9; demo `templates/demo-ui-kit` |
| motion that settles like a spring but stays seekable | `springTrack(t, changes, cls)` in `type/ease.js` (same copy in `layers/`, `camera/`): classes `ui`, `panel`, `camera`, `headline`, `mascot` | one class per kind of thing; never a live spring simulation |
| data | `chart.bar`, `.line`, `.donut`, `.race`, `map.route` | placeholder data is labelled; replace it and cite |
| two shots at once | `layout.splitScreen` (vertical / horizontal / diagonal / 3up / grid), `.pip`, `.beforeAfter`, `.freezeFrame` | the overlay sits above the shots |
| a sentence-led product film (small type on paper carries the story) | `type/wordWheel` (feature list, active word bold), `type/inlineMedia` (photos / card stacks inside the line), `type/letterAssemble` or `type/glyphMorphCursor` (opener / mark reveal), `type/marquee` (full-bleed monospace), `type/bleedWord` (cropped giant type); `layout.scatterCollage`, `.mosaicBurst`, `.orbitRing`, `.logoWall`, `callout.connectorLabel` | example: `templates/demo-type-layout`; logo slots ship placeholders only |
| draw an icon or logo outline on | `type/gfx/drawon.js` (`drawOnAt`, `trimAt`) | run SVGs through the motion-stack SVGO config first |
| atmosphere | `layers`: `fog`, `godRays`, `rainGlass`, `motes`, `snow`, `embers`; lens: `flareStreak`, `flareGhosts`, `starburst`, `lensDirt` | one hero light effect per shot |
| film / retro texture | `burnEdge`, `vhs`, `gateEdge`, `sprocket`, `timecode`, `recHUD`, `polaroid`, `instax`, texture plates (`paperFold`, `crumple`, `cardboard`, `canvas`, `cloth`, `concrete`, `brushedMetal`, `tornEdge`) | multiply plates go under type |
| comic / anime energy | `speedLines`, `impactFrame` (2–3 frames), `halftone` | flash rule: max 3 full-frame flashes per second |
| celebrate | `confetti` (`burstAt`), `sparks` (`burstAt`), `reaction.burst` | pair with a win sound |
| music visualiser / podcast | `arBars`, `arRing`, `arWave`, `arSpectrum` (feed `env` from the mix or `beats`) | |
| one accent colour carries archive, line art and type (L7 manifesto) | `layers` `look.duotone` (swap colours for light line art on accent), `look.threshold1bit` (Bayer dither); backgrounds `gridTunnel`, `dotGrid`; `type/outlineFill`; `transitions/ditherDissolve` | `layers/stylize.js` `mountLook` on a still wrapper; demo `templates/demo-l7` |
| photos inside a sentence, a collage that streams past | `layout.cardStack` (inline riffle, cards flip back to front), `layout.cardRiver` (diagonal streams with motion blur, `keepOut` keeps the words still in the gap) | canvas back-end; `placeholderCards` are abstract on purpose |
| a logo on a window, a UI card on footage or a 3D screen | `layout.cornerPin` (static corners or per-frame `keys`; a three.js scene can export its plane's corners per frame) | no tracker built in |
| a doc-parody or comedy title beat | `layout.evidenceBoard`, `lowerThird.docSuper`, `caption.subtitleSpeedGag`, layers `invertFlash` | at most 3 flash onsets per second (enforced) |
| an end card | layers `brandField` (full-bleed colour, logo slot, one line, soft settle) | hold >= 1.8 s after it settles |
| a little world under glass, integrations orbiting | `objects/glass-dome`, `objects/icon-orbit`, `objects/clay` (worker `spec.clay`) | own icons only, never brand logos |
| a look | `layers/looks/look.<name>.cube`; send log footage through `log.<cam>-to-709.cube` first | one look per piece; it replaces the genre grade |
| speed ramp / freeze / rewind gag | `cuts/retime.py` presets `heroRamp`, `rampIn`, `rampOut`, `bulletTime`, `freezeStamp`, `reverseFlash` | the same keys exist in `tx-core RAMP_PRESETS` for canvas shots |
| camera comedy / drama | `cam2d.crashZoom`, `doubleTake`, `dollySnap`, `dutchRoll`, `rackFocus2D`, `parallaxStack` | crash zooms count as punch-ins (max 1 per 4 s) |
| an India-market / festive sound | bundle `india_festive`; `sfx/indian/*` (tabla bols, sitar, shehnai, bansuri, harmonium, dhol, conch, temple bell, ghungroo, shruti drone); beds `music/bed_indian_fusion_loop8`, `bed_festive_dhol_loop8`, `bed_bhangra_hype_loop8`, `bed_raga_calm_loop8`, tabla thekas; sitar sonic logos | conch or temple bell only on the hero moment |
| foley on every contact | bundle `office_comedy`; `sfx/foley/*` (footsteps, doors, drawers, chair creak, keys, coins, cups, pen click, stamp, zipper, scissors, tape, book thud, laptop close) | ids tagged `rr:4` have 4 takes; the mixer varies the seed per repeat |
| product demo / app UI sound | `sfx/device/*` (phone buzz, message sent/received, clicks, keyboard, loading tick, notify, lock/unlock, achievement) and `sfx/ui/*` (mic on/off, listening loop, think pulse, reply) | one device sound per UI action, under the VO |
| a different music genre | `music/bed_*_loop8` (lo-fi jazz, synthwave, deep house, dnb, ambient pad, chiptune, folk pluck, marimba, orchestral epic, jazz walk, comedy pizzicato, corporate bright, suspense pulse) and length-fitted cuts | all are generic library beds; listen once before a hero use |
| a SaaS / AI product film sound | bundle `saas_launch`: `sfx/paper/card_riffle`, `card_shuffle_settle`, `sfx/ui/scan_sweep`, `sfx/ui/agent_working` (4 s loop), `sfx/tx/pixel_dissolve`, `sfx/sparkle/letter_assemble`, `sfx/hit/brand_field_slam` | stop the working loop on the result frame: mixer `add_cue(..., until_frame=F)` |
| a story shape | `cuts/story/*`: `interruptOpen`, `verbLadder`, `mockumentaryReaction`, `sentenceLed` (`cutgen.py interrupt-open / verbs / mockumentary / sentence`); bundle `mockumentary` for doc-parody comedy | `cutgen.py snap` puts cuts on onsets (target 60% within 2 frames) |
| a tempo build into a drop | `music/bed_anthem_ramp16` (100 → 128 BPM; real beat frames in its sidecar) and `music/tempo_maps.json` | cut from the sidecar, not from a constant BPM |
| a photoreal product shot or 3D title | `blender/turntable`, `blender/macroSweep`, `blender/explode`, `blender/title3d`; art loops `blender/art.*` | EEVEE for motion plates, Cycles for key-art stills |

## RECIPES

Every recipe ends with the VIRALITY and QA checklists below.

### RECIPE A: ad (6 / 15 / 30 / 45 s), template `templates/ad`

1. **Brief.**
   - Set the objective (awareness, consideration or action) and the platform preset (`yt.ad.15`, `meta.ad.9x16`, `tiktok.organic`, ...; see `references/platforms.md`).
   - Decide on one pain and one product feature per shot.
2. **Edit `templates/ad/config.mjs` CONFIG:**
   - `hook.archetype`: one of `payoff-first`, `pattern-break`, `claim-or-question`, `in-medias-res`, `curiosity-gap`, `social-proof`, `problem-agitate`.
   - The problem lines, the product line and the proof lines. Real proof only; any digit needs a `source`.
   - The boundary transitions, each with a reason. Defaults: hook>problem `transitions/smash`, problem>product `transitions/whip`, product>proof `transitions/push`, proof>cta `transitions/dip-to-black`.
   - Type: `type/scaleSlam` (hook), `type/maskRise` (cards), `type/elasticPop` (end), `type/blurIn` (subs).
   - Layers `vignette` + `grain` (`digital-soft`), and a music bed that fits the mood.
3. **Sound.** Use the `sfx/bundles.json` palette `product_ad` (or `launch_film`):
   - a punch on frame 0;
   - pops on cards;
   - a 1-bar riser into the reveal;
   - a cinema hit on the reveal;
   - a `sfx/logo/*` sting on the end card.
4. **Build and render.**
   - `node make.mjs [--set length=30]` builds the plan, the mix and `index.html`. It prints `todo: none` when every id resolves.
   - Then `npx -y hyperframes@0.8.142 render . -o out/ad-15.mp4 --crf 23`.
5. **Hold these rules:**
   - Brand cue by `brandCueBy`.
   - At least 3 visual states in the first 5 s.
   - ASL 1.2–2.0 s, with one 3–4 s hero hold on the reveal.
   - The end card holds at least 1.8 s after motion settles.
   - Make three hook variants on an identical body.

### RECIPE L: launch film / product reveal

0. **Plan with `references/launch-playbook.md` first.** Pick the archetype and its pair:
   - L1 founder keynote;
   - L2 hero sizzle;
   - L3 product UI film;
   - L4 output montage;
   - L5 teaser;
   - L6 build-in-public clip;
   - L7 metaphor manifesto.

   Fill its beat sheet. Frame 0 is the product or the thesis. Show real UI or the reveal inside the window. Use 3 mundane demos and one defensible number.
1. **Arc:** hook, tease, reveal, feature montage, end card. Pick one tone and commit to it.
2. **Lock the music first.**
   - Generate with `music/compose.py` presets (`tech_pulse` or `anthem_build`) or use `music/bed_*`.
   - Snap the BPM so a beat is a whole number of frames (`music/grid.py`, `cuts/cutgen.py beats --snap`).
3. **Picture.**
   - Seek-safe 3D comes from the three.js objects: `objects/product-box` (a generic hero product; swap in your own model), `objects/slab`, `objects/studio-lights`, `objects/studio-env`, `objects/laptop`, `objects/phone`, `objects/tile`, `objects/meter`, `objects/chrome-blob`.
   - A photoreal hero comes from RECIPE P.
   - Camera: `cam3d.pushIn` on the reveal, `cam3d.orbit` on the hero, `cam3d.whipPan` between zones.
   - `cuts/sections/build_accelerate` into the drop, with the reveal landing on the drop.
4. **Finish.**
   - Use the `layers` recipe `launch-studio`. Plates may already carry bloom, vignette and grain; do not stack them twice.
   - Use one `transitions/shutter` or `transitions/maskReveal` for the title.
   - Put a stinger on the title and a sonic logo on the end card.
5. **Exports:** 16:9, then re-layout to 9:16 and 1:1, plus a 6 s cut-down.

### RECIPE P: Blender plates (photoreal product, 3D type, art loops)

1. **Pick the recipe:**
   - `blender/turntable` for the hero;
   - `blender/macroSweep` for light raking across materials;
   - `blender/explode` for an exploded view;
   - `blender/title3d` for extruded type;
   - `blender/art.liquidChrome`, `blender/art.voxelWave` (beat-reactive from a music sidecar) and `blender/art.particleSwirl` for visual-art beats.
2. **Render headless:** `blender -b --factory-startup -P blender/run.py -- --recipe <id> --size 1920x1080 --fps 30 --seconds 6 --engine eevee --out out/plates/<id>` (add `--alpha` for compositing).
   - Use EEVEE for motion plates and Cycles for key-art stills.
   - Every recipe is keyed to the frame number and seeded, so frames re-render identically.
3. **Composite in HyperFrames.** The plate is the bottom layer (video or image sequence); type, overlays and transitions go on top. Read `blender/README.md` for alpha and colour notes.
4. **Choose Blender or three.js:**
   - three.js objects are fast and seekable inside the composition.
   - Blender is photoreal but slow, so render it once and reuse the plates.

### RECIPE F: animated short film / scene, template `templates/film-scene`

1. **Structure.** One idea and one turn:
   - a cold open image (0–8%);
   - the world and the want;
   - one obstacle;
   - the turn (50–60%);
   - the consequence;
   - a resolution image;
   - a credit tag of at most 6 s.
2. **Shots.** Use the scale ladder: wide, medium, close, insert as emotion rises. Break the pattern on the turn, and never put more than 3 same-scale shots in a row.
3. **Transitions.**
   - Hard cuts by default.
   - `transitions/dissolve` (about 1000 ms) for time passing.
   - J/L splits (`cuts/split/film_J`) for scene bridges.
   - `filmBurn` / `lightLeak` only for memory or a tonal break.
4. **Sound first.**
   - Room tone under every scene (`sfx/amb/*`, about −48 LUFS).
   - The score enters on emotion, not on action.
   - 200–400 ms of silence before the turn.
   - Bundle `short_film`, or `office_comedy` for workplace comedy.
5. **Look.**
   - Grade `warm-film` (or `noir`), grain `film35`, and optionally a 2.39 letterbox on 16:9.
   - `cam3d.handheld` level `doc`; use `cam3d.dollyZoom` at most once.
6. **Character.** Use `objects/worker` with `characters/poses.js` `ACTS` and `EMOTIONS`. Hold reactions for 1.5 s.
7. **Render** with `bash templates/_shared/render3d.sh templates/film-scene scene.html wide 23`.

### RECIPE Z: wordless mime-style character spot (6 / 15 / 30 s), template `templates/character-spot`

1. **One gag, one feature, no words.** If it needs two setups, it is two spots. Frame the gag with a familiar format (a queue, an office, a quiz).
2. **Beats (15 s):**

   | beat | time |
   |---|---|
   | Hook: the gag premise is visible | 0–2 s |
   | Setup | 2–5 s |
   | Escalation | 5–9 s |
   | Twist via `transitions/smash` | 9–11 s |
   | Reaction hold of 1.5 s | 11–12 s |
   | One line of message + brand | 12–15 s |

3. **Stage.**
   - `makeStage(ctx, {mode: 'white'})`, with one hero prop.
   - High contrast that reads at thumbnail size.
   - Grade `bright-playful`, and at most one whip.
4. **Character.**
   - `objects/worker` with at most 6 emotions; faces are shape swaps.
   - Word-free babble comes from `sfx/voice/*`.
5. **Sound:**
   - bundle `mime_spot`: cartoon sounds per act and foley on contacts;
   - the bed `music/bed_playful_bounce_loop8`;
   - end on a stinger.
6. **Render** with `bash templates/_shared/render3d.sh templates/character-spot scene.html wide 23`.

### RECIPE H: human / talking-head edit, template `templates/talking-head`

1. **Analysis.**
   - Transcribe with word timings.
   - Write `words.json` as `[{w, s, e, emph?}]`.
   - Use real footage only; never fake a speaker.
2. **Layer order, fixed:**
   1. Autocut silences over 0.5 s, keeping a 120 ms breath.
   2. Captions of 2–4 words with the active word highlighted (`type/captions.js`: `karaoke`, `impact`, `emphasis`, `pill`, `clean`), 64–80 px on 9:16, at most 2 lines.
   3. B-roll at 35–50% coverage. Each insert lasts 1.2–3 s and leads the line by 150 ms.
   4. Punch-ins of 1.12 on emphasis, max 1 per 4 s. On every jump cut, alternate the framing anchored on the eyes.
   5. A lower third.
   6. The music bed ducked 9 dB under the voice.
   7. SFX on emphasis, punch-ins, B-roll and the lower third.
   8. Grade `documentary`.
3. **Beat hold:** keep the face still for 450 ms after a punchline, then cut.
4. **Build and render:** `node make.mjs --set input=/abs/talk.mp4`, then `hyperframes render`.

### RECIPE B: music / beat edit, template `templates/beat-edit`

1. **The music is the clock.** Use a pack bed (its sidecar JSON gives beat, kick and drop frames), or detect the beats of a supplied track.
2. **Cuts.**
   - Per section: `cutgen.py section --plan build_accelerate | drop_doubletime | verse_chorus | hook_3s | breath_out`.
   - Per bar: `every_2` (default), `every_beat` (drop), `eighths` (stutter, never sustained), `tresillo_332` or `offbeat` (groove).
3. **Transitions:**
   - `flash` on section changes;
   - `scale-punch` on drop cuts;
   - `whip` on bars;
   - glitch only on drops.
4. **Type and camera:** `type/scaleSlam`, one word per beat; `type/glitchSplit` on hits; `cam2d.beatPunch2d` at 1.08.
5. **Sound:** bundle `beat_edit`. Hits land on the grid, never between beats.
6. **Loop it** if it is a short: the last frame state equals the first.

### Kinetic type, title or sonic-logo only

- **Type:** `type/presets.js` on canvas or DOM.
  - At most two tone families.
  - A fully formed hold of at least 9 frames.
  - At most 3.5 words/s.
- **Sonic logo:** `music/logo.py` `motif_from_name(name)` gives a stable original motif per brand.

## Outside assets (optional, never vendored)

The pack ships only what it generates.
- **Third-party CC0/MIT/ISC sets:**
  - Fluent Emoji (MIT), Lucide (ISC), Phosphor (MIT);
  - Kenney audio (CC0), OwlishMedia foley (CC0).
- **Fetching them:** `scripts/fetch-external.sh` downloads them from pinned URLs, verifies checksums, and writes an `ORIGIN.txt` per set.
- **Imported audio:** pass `python3 sfx/tools/check_origin.py DIR` (licence allow-list; exit 2 = refused), then `python3 sfx/tools/catalog_import.py DIR --category NAME`. It lands in `sfx/library_ext/`, tagged `source:ext`, and never in `sfx/manifest.json`.
- **Avoid:**
  - Apple Color Emoji (not licensed);
  - OpenMoji (CC BY-SA, share-alike);
  - stock-site clips (no redistribution);
  - any pack without written licence terms.

## Cloud audio (optional, paid): `cloud/`

When the user asks for generated music, a voiceover, or "use Lyria / Gemini", use `cloud/` (full notes: `references/cloud-audio.md`). It runs on the user's own Google Cloud project, billed to them. State the cost before generating.

- **Setup:** `MP_GCP_PROJECT` (Vertex AI on, billing on), `gcloud auth login`, `pip install -r requirements-cloud.txt`. Never write a project id or key into the repo or a plan.
- **Music:** `python3 cloud/lyria.py "<parts, BPM, instruments>" --seed N --out bed.wav`. About US$0.06 per 32.8 s take. Describe the instruments and tempo, not just the feeling. Make 2–3 seeds.
- **Judge it:** `python3 cloud/gemini_mood.py bed.wav --brief "..."`. Keep takes with `brief_fit` ≥ 7. Use it for feel only; timing and BPM come from local DSP.
- **Voice:** `python3 cloud/gemini_voice.py lines.json --out vo --voice Charon --verify`. The model is `gemini-live-2.5-flash-native-audio`. `--verify` checks every line word for word with Whisper.
- **Mix:** give `music/mixer.py` the bed and the voice. Never ship raw Lyria (about −24 LUFS with 0 dBFS peaks).
- **Disclose:** AI music and synthetic voices are AI content. Never imitate a real person's voice.

## VIRALITY checklist (the mechanisms are solid; every number is a tunable default)

**Hook (first second)**
- [ ] Frame 0 is a strong image in motion: never black, never a logo bumper, never a fade-in.
- [ ] First motion by frame 6. Hook text on screen by 0.3 s: at most 7 words, and at most 4 on the poster frame.
- [ ] The picture, the on-screen text and the VO all say the same idea.
- [ ] The hook uses one archetype, and you made 3 hook variants on the same body.

**Hold (retention)**
- [ ] Open a loop in 3–6 s.
- [ ] Use the interrupt ladder (`cuts/interrupts`): minor about every 2.5 s, medium about every 5 s, major about every 9 s. Something visible changes at least every 3.5 s.
- [ ] The best payoff is in the final 20%. Trim a dead last 1–2 s.
- [ ] Captions on every spoken sentence: the video must work on mute. Burn them in for LinkedIn and X.

**Share and replay**
- [ ] One send-worthy beat in the final third that names an audience.
- [ ] Shorts loop: state-return, reveal-to-hook, or ping-pong.

**Platform fit** (`references/platforms.md`)
- [ ] Length: organic shorts 15–35 s, ads 15–30 s, plus a 6 s bumper.
- [ ] Export 9:16, 1:1 and 16:9 by re-layout, not by crop.
- [ ] 9:16 safe zone: text and CTAs inside x 65–960 and y 269–1248 on 1080x1920 (the `conservative` union in `type/safezones.js`; verify against the current apps).
- [ ] Soft CTA at 60–70% of the runtime. The hard CTA end card is in the last 2.5 s.

**Thumbnail and title**
- [ ] The poster frame has one high-contrast subject and at most 4 words, and reads at 120 px wide.
- [ ] Never let an image model redraw UI or text; composite the real screenshot instead.
- [ ] Title: front-load the payoff in about 50 characters, and promise only what the video delivers.

**Distribution**
- [ ] Post at a steady slot rather than in bursts. Volume without reach does nothing: fix the hook and format before scaling.
- [ ] Log hook rate and retention per variant.
- [ ] Draft the post, but publishing is the user's call.

## QA checklist (before calling it done)

- [ ] **Ids:** `python3 tools/check_ids.py` shows 0 unresolved, and `make.mjs` prints `todo: none`.
- [ ] **Stills:**
  - Run `python3 templates/_shared/sheet.py <mp4> <sheet.jpg> <t1,t2,...>` on every cut, mid-transition, the hook, the reveal and the end card, then LOOK at the sheet.
  - Check for clipped or overlapping type, words cut by masks, and text outside the safe zones at 9:16.
- [ ] **Loudness:** the delivered MP4 decodes to −14 ± 0.5 LUFS-I and TP ≤ −1.0 dBTP, with the WAV master at ≤ −1.5 (`sheet.py` prints both).
- [ ] **Sync:** hits land on frame F + 1, risers end one frame before the hit, whooshes peak on the cut, and the last 0.15 s is silent.
- [ ] **Legibility:**
  - Captions are at most 18 characters per line and at most 2 lines.
  - The active word is exactly the spoken word.
  - It reads at phone size (360 px wide).
- [ ] **Honesty:** no fabricated numbers, reviews, logos or testimonials. Placeholders and concept renders are labelled.
- [ ] **Flash safety:** no more than 3 full-frame flashes per second.
- [ ] **Determinism:**
  - Render twice with `--format png-sequence` and compare the frames. They should be identical, or above 60 dB where blurs add GPU noise.
  - Don't compare two MP4s: multi-threaded x264 output differs between runs (about 50 dB) even when every frame is the same.
  - A standalone page can use motion-stack's `seekcheck.mjs`, which needs `window.__ready` and `window.__seek(t)`.
- [ ] **Files:** the demo encode is CRF 23, and a 15 s 1080p file is a few MB.

## Gotchas (the full list is in `references/gotchas.md`)

- **HyperFrames hides a timed clip outside `[data-start, data-start + data-duration]`.** Two-layer transitions need overlap windows: `templates/_shared/txplan.mjs` stretches the clips around each cut. Animate an untimed wrapper, never the timed `<video>`.
- **HyperFrames silently lowers the whole track if the AAC is over −1 dBTP.** Use the mixer's AAC probes.
- **GSAP in a composition:** set `gsap.config({ force3D: false })` and do one warm pass (`tl.seek(tl.duration()).seek(0)`) before registering the timeline. Without them, frames carry 1-LSB noise between renders.
- **HyperFrames prints structure warnings** on the stock templates (`timeline_track_too_dense`, `nested_structure_needs_subcomposition`). They are advisory; the render is unaffected.
- **`hyperframes render` defaults to CRF 16** (large files). Pass `--crf 23` for demos.
- **Do not put `z-index` on the `#fx` container.** It kills the overlays' `mix-blend-mode`.
- **DOM transition approximations** keep the timing, the swap frame and the sound, not the exact GL look.
- **The plates already carry bloom, vignette and grain** in `launch-studio`. Do not stack them twice.
- **The sound library is measured, not auditioned.** Listen once before a hero use.
- **Safe zones and per-platform loudness drift over time.** Treat them as defaults and verify against the current apps.
- **No libass in many ffmpeg builds.** Burn captions through the type module (DOM or canvas) or PNG overlays, not `subtitles=`.
- **A hidden browser tab throttles animation** (`document.hidden`). Check `visibilityState` before you debug "broken" motion.

## Where things are

| need | path |
|---|---|
| Templates and the shared plan, compose, audio and sheet helpers | `templates/`, `templates/_shared/` |
| Transition registry, back-ends and id resolver | `transitions/lib/` (`registry*.js`, `tx-*.js`, `ids.js`, `xfade.js`) |
| Cut patterns, the generator and retime | `cuts/patterns.json`, `cuts/cutgen.py`, `cuts/retime.py` |
| SFX, bundles, sweeteners, import gate | `sfx/manifest.json`, `sfx/bundles.json`, `sfx/sweeteners.json`, `sfx/tools/` |
| Music, mixer, thekas, tempo maps | `music/manifest.json`, `music/mixer.py`, `music/presets.py`, `music/theka.py`, `music/tempo_maps.json` |
| Layers, type, camera | `layers/`, `type/` (+ `gfx/`), `camera/` (each with a README, manifest.json and tests) |
| Objects and the character | `objects/index.js`, `objects/characters/poses.js` |
| Blender recipes | `blender/run.py`, `blender/README.md`, `blender/manifest.json` |
| Gallery | `catalog/index.html` |
| Outside assets | `scripts/fetch-external.sh`, `THIRD_PARTY.md` |
| Research behind the defaults | `docs/research/` |
