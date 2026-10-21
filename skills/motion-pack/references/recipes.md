# Decision tree, engine choice, Reach for X and the recipes

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (the per-genre recipes for work without a playbook format, and the detail behind each format template). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Decision tree (pick the path in this order)

```
What is the deliverable?
├─ Talking head / interview / podcast / screen-record with a human voice ──> RECIPE H (human edit)
│     several speakers, a documentary / customer-story launch? -> RECIPE H step 5 (`templates/multi-voice-doc`)
│     a screen tutorial, a vlog, a podcast clip, a founder story or a course lesson (YOUR footage)? -> RECIPE U (`templates/tutorial`, `vlog-personal`, `podcast-clip`, `founder-story`, `course-lesson`)
├─ Music drives it (lyric, montage, beat promo, dance, loop to a track) ──> RECIPE B (beat edit)
├─ Wordless character comedy, one gag + one feature ──> RECIPE Z (character spot)
├─ Story with a turn (cold open -> want -> obstacle -> turn -> button) ──> RECIPE F (short film / scene)
│     a film trailer, a teaser, an opening title sequence or a short film from your footage? -> RECIPE T (`templates/trailer`, `title-sequence`, `short-film`)
├─ Sell a product in 6 / 15 / 30 / 45 s (hook, problem, product, proof, CTA) ──> RECIPE A (ad)
│     launch / reveal / sizzle with a hero product? -> RECIPE L (launch film)
│     software / SaaS launch, feature drop or explainer with a cursor through the product? -> RECIPE S (`templates/saas-launch`, `saas-feature-drop`, `saas-explainer`)
│     an AI-hardware / device launch, teaser or spec sheet? -> RECIPE HW (`templates/hardware-reveal`, `hardware-teaser`, `spec-sheet`)
│     a measured result (benchmark, cost, a failure the method catches) for builders? -> RECIPE I (proof film, `templates/proof-film`)
├─ Photoreal product, 3D title or abstract 3D art ──> RECIPE P (Blender plates), then composite here
├─ Terminal or ASCII look, a flock, a word a flock writes ──> terminal/ (baked plate as a <video> layer; set real titles with type/)
├─ "How it works" / process diagram, a data story, a numbered how-to ──> RECIPE E (`templates/explainer-diagram`, `data-story`, `process-howto`); math animation ──> a math tool (manimgx) for the plates
├─ The user wants to change copy, colours or footage themselves, or an agent should not edit template code ──> `tools/mp new` + project.json ("Edit without code" below)
└─ Anything else in HTML ──> a HyperFrames composition built from pack parts
Then: aspect set (16:9 master + re-layout 9:16 / 1:1, not a crop) -> VIRALITY checklist -> QA checklist -> RECIPE D (captions, audio description, delivery) for every public video.
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
| a number to land | `counter.countUp` / `.statCard` (needs `source`), `.ring` (percent), `.wheel` (year / odometer), `.priceSlash` (offer) | digits need a source: every counter prints `source: placeholder data` until you pass the real `source` (a blank one falls back to it), so a default can never pass for a finding |
| point at something | `callout.scribbleCircle`, `.handArrow`, `.underline`, `.bracket`, `.pinLeader`, `.spotlight` | sound: `sfxFor(id)` |
| a comedy beat | `fx.emotion.*` (sweat, vein, heartBurst, question, exclaim, dizzy, sparkle, zzz, bulb), `fx.impact.*` (onomatopoeia, speedLines, dustPoof, star, smear) | one mark per gag |
| reels furniture | `social.*` (follow, reply bubble, notification, typing, chat), `caption.meme` / `.replyCard` / `.oneWordSlam`, `sticker.place` / `reaction.place` / `reaction.burst` | for real emoji, fetch Fluent Emoji (see Outside assets) |
| show a product on a device | `device.phone` (taps, scroll), `device.laptop` (cursor path + clicks) | the screen recording goes UNDER the frame |
| AI at work / product UI without real screens | `ui.agentActivity`, `ui.promptBar`, `ui.checklist`, `ui.nodeGraph`, `ui.scanOverlay`, `ui.isometricTilt`, `ui.stateMorph` (`type/gfx/ui.js`); `uiCues(id, {at, params})` gives one sound per UI action | generic layout, labelled placeholder data; set `scale` 1.3-1.6 on 16:9; demo `templates/demo-ui-kit` |
| Voice / data / navigation UI (live call transcript, word regenerate, fee receipts, failover routing, file download, landing-page flythrough, tab tour, parallel browser windows, option picker) | `ui.liveTranscript`, `ui.wordRegenerate`, `ui.receiptCompare`, `ui.failoverRoute`, `ui.fileChip` (`type/gfx/ui-data.js`), `ui.pageFlythrough` (+ `pageFlyCam` for a DOM page), `ui.tabPillNav`, `ui.windowWall`, `ui.optionPicker` (`type/gfx/ui-nav.js`); same `uiCues` | every number printed is illustrative and carries a `source` / `note` label in frame; load fonts before the first frame (text is measured); demo `templates/demo-r3-ui` |
| a proof film: a chart or table that builds under a one-line finding, a decision diagram with a failure path, a HUD line under a figure | `chart.scatterFrontier` (cost vs score, Pareto frontier, starred hero; every point needs its own `source`), `ui.dataTable` (rows stagger, numbers count up, units formatted by the part, optional tie-in bars; needs `source`), `ui.branchTrace` (parallel checks, `run` = the chosen fork ids: one wrong pick turns red and the red runs to the result), `type.paramReadout` (math-italic fields in fixed slots) (`type/gfx/ui-proof.js`, `ui-trace.js`; `gfxCues(id, {at, params})` for sound) | numbers are illustrative by default and the frame says so; a missing `source` renders a red "needs a source" card; the table and scatter size type from the shorter frame side and the table picks a phone layout on 9:16 by itself (a 16:9 table on a phone: 4 rows at `scale: 2`); `ui.branchTrace` is a landscape diagram; demo `templates/demo-r45-ui`; the whole film: `templates/proof-film` |
| live words beside a person in footage, a usage chip on the scene, a name super with one personal detail, a sketch dragged into a prompt bar | `caption.sceneBubble` (words on their own timestamps from words.json, "Captured" tick, dock into a list; `ai: true` adds the AI-voice badge), `ui.costTicker` (two counters pinned to a tracked point; `mode: 'zero'` for an honest "$0 per query"), `lowerThird.personalTag` (name + role, then one personal line 0.3 s later), `ui.promptBar.attach` (`attach: {kind, name, from, dropAt}` or a list) | anchors are `[x, y]` frame fractions, a `[[t, x, y], ...]` track in the part's local time, or `layout.cornerPin` data in composition time (words.json times are local to `at` too); real recordings only for a voice demo (the demo's plate is a labelled placeholder); `source` required on the ticker; demo `templates/demo-r45-ui` |
| tutorial / personal furniture: a key combo, a box around a region, code with highlighted lines, a step counter, a pointer on a track, a waveform, a place + date card, years on a line, a pull quote, a quiz, a recap, a frame-0 hook card, end-screen slots, a result sweep, a step card | `ui.keyCombo`, `callout.highlightBox`, `ui.codeCallout`, `ui.stepCounter`, `ui.cursorTrack`, `ui.waveform`, `title.locationCard`, `title.yearTimeline`, `caption.pullQuote`, `ui.quizCard`, `title.recapCard`, `title.hookCard`, `title.endScreen`, `callout.resultReveal`, `title.stepCard` (`type/gfx/human.js`; `gfxCues` gives one sound per action) | sized from the SHORTER frame side, so 9:16 reads like 16:9; a pull quote is the speaker's own words (`founder-story` gates it); the year timeline prints its source label; end-screen slots are placeholders for the platform's own elements |
| motion that settles like a spring but stays seekable | `springTrack(t, changes, cls)` in `type/ease.js` (same copy in `layers/`, `camera/`): classes `ui`, `panel`, `camera`, `headline`, `mascot` | one class per kind of thing; never a live spring simulation |
| a feature-tour or product film: a chart you hover, a dock that opens a window, services that connect, a process that degrades then recovers, chapter cards, a typed command | `chart.hoverTooltip` (cursor over `chart.bar` / `chart.line` / `ui.dataTable` bars; tooltip chip with value + delta pill; needs `source`, prints it and `method` in frame), `ui.dockLaunch` (cosine-magnified placeholder dock; the clicked icon grows into a window), `title.verbCard` (one giant word settles into the line that completes the phrase; N chapters, gradient sweep), `ui.connectRows` (Connect -> Connected with a tick, optional Thinking line), `layout.degradingDiagram` (faces and connectors: calm, worried, cracked, broken, then tidy; blur-through captions), `type.commandPill` (outline draws on around typed monospace) (`type/gfx/r6.js`; `gfxCues` / `uiCues` for sound) | all names and icons are placeholders ("Service A", "App A"), the frame says "illustrative", and a number needs `source` + `method`; every numeric param is clamped, so a hostile value cannot hang a render; demo `templates/demo-r6-type` |
| a muted-autoplay feed opener: a "Sound on" prompt that reads on frame 0 and is gone in a second and a half | `caption.soundOnPill` (outline draws on from frame 0, solid frosted pill at `solidAt` 0.5 s, soft exit ending at `outAt` 1.5 s; `text`, `x` / `y` frame fractions, `icon` speaker \| none, `theme` dark \| light, `accent`, `scale`) (`type/gfx/chips.js`; `gfxCues` gives one quiet `sfx/ui/pop` on `solidAt`) | its lifetime follows `outAt` (no `dur` needed); the text keeps >= 4.5:1 on its own fill over black or white video; placed inside the platform safe rect |
| a status that survives cuts and flips on planned frames (draft -> checked, before -> done) | `ui.stateChip` (`states: [{ t, label, tone: before \| done \| neutral, icon?: dot \| tick \| lock \| eq }]`, `corner` tl \| tr \| bl \| br, `colors` per tone, `flash` frames, `scale`; `stateChipFlips(params)` gives the flip times) (`type/gfx/chips.js`; `gfxCues` gives one tick per flip, `sfx/ui/toggle_on` into done) | place ONE item for the whole film (`dur` = the film) so it survives every cut; the label on the flip frame is already the new state; a caller ink under 4.5:1 is replaced by black or white |
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
| a soft gradient backdrop that drifts (the default SaaS field) | layers `meshGradient` (`palette` peach / lilac / sky / dusk / mint / ink, `loop` for an exact repeat, grain on) | one field per scene; keep type contrast checked over the brightest blob |
| many loose things becoming one (method, "200+ -> 20", a word from dots) | `layers.dotCondense` (`to` fewer / line / word) | pair with `sfx/sparkle/letter_assemble` on the cue |
| a film with zero hard cuts (the title becomes the card header, the icon the tile) | `transitions/sharedElement` (`data-share` keys in shot A and B) | hold shared elements still inside the window (the clones are snapshots) |
| an idea becoming the real thing | `transitions/sketchToRender` (line art draws on, clay tone, colour) | needs edges in the next shot; about 1.5 s to read |
| a colour reveal (archive -> today, map -> photo) | layers `look.gradeIn` (gradient map resolves to natural colour over `dur`) | one look per piece still applies |
| a narrator character in a flat world | `objects/mascot2d` (SVG / canvas / three plane; poses idle point read cheer dive wave think, hops with squash and stretch) | original character only |
| a projected window or globe from a character or device | layers `hologramBeam` (`mode` window / globe) | dark or mid plates (screen blend) |
| the brand mark in 3D | `objects/logo-extrude` (SVG path, bevel, presets chrome / glass / iridescent / satin, sliced beat) | your own mark only; the default is a placeholder |
| a powers-of-ten dive, or ending the film on a screen in a room | `cam2d.scaleDive` (hidden swaps between nested levels), `cam2d.pullbackToScreen` (comp lands on a screen quad, with `layout.cornerPin`) | design each inner level as the region of the one above |
| a doc-parody or comedy title beat | `layout.evidenceBoard`, `lowerThird.docSuper`, `caption.subtitleSpeedGag`, layers `invertFlash` | at most 3 flash onsets per second (enforced) |
| a brand-system tour, an accent-word hook, a self-check score | `layout.logoConstruction`, `.paletteColumns`, `.typeSpecimen`, `.mockupInContext` (billboard / stage / CRT with occluders), `.backdropSwap`, `.lineup`; `callout.selectionBox`, `type/accentSwap`, `type/wordSplitMedia`, `type/imageFill`, `type/strikeOut`, `type/glowWord`, `type/ledDigits`, `counter.scoreIterate`, `.stepPill`, `title.timeCard` | `gfxCues(id, {at, params, dur})` gives one sound per action; demo `templates/demo-r3-type` |
| search by meaning, a vector space, retrieval ("the nearest things light up") | layers `embeddingCloud` (query chip, `k` nearest lift with lines, optional collapse into your icon path via `mark`; `thumbs` capped at 48) | `cuesR45(kind, params)` gives the sounds; placeholder thumbnails until you pass `images` (then `await stack.ready()` before the first frame) |
| a drawing that gains fidelity (N circles), or any SVG path traced by pure maths | layers `epicycleDraw` (`steps: [[t, N \| 'full']]`, inset of the circles, glow, trail) | the readout prints N and the error (distance from the input path) with a `source` note that cannot be blanked; open paths go there and back |
| a brand-texture backdrop whose tiles flip in waves, with a panel floating above | layers `hexMosaic` (`faces`, `waves`, `loop` for an exact repeat, `panel`) | tiles are flat colour, an owned engraving, or your images |
| many tools -> one box (or one dot blooming into a network) | layers `convergeToDot` (`reverse`, `order`) | pair with overlay `paper` grain and `sfx/hit/soft` on the landing |
| a co-brand "A x B" lockup held on a quiet tail | `title.partnerLockup` (marks balanced by ink area measured from the alpha mask, row at 16:9, stack at 9:16) | placeholder marks only; a supplied mark needs `licensed: true` or it is refused, and an ink measure (`python3 tools/mark_ink.py logo.png` or `markFromImage`) or it falls back to matched height |
| a bundle reveal: icons draw on, fill on hits, line up, merge into one name | `layout.iconMergeLockup` | fills land on the `hits` frames; pair `sfx/hit/soft` (the plan adds the F + 1 anchor) |
| text as a picture (a prompt that becomes a portrait) | `type/asciiMosaic` (`image` bust / orb / spark or your `{ lum }` grid via `lumGrid`) | 72 columns at 1080p (27 px glyphs); raise `cols` for detail and judge the hold frame at phone width |
| text riding a curve behind a flying icon | `type/textOnPath` (`mode` trail / reveal / travel, SVG `path`, arc-length spacing) | load the fonts first (it measures glyphs) |
| a phrase that parts around a subject and carries on the next shot | `type/flankWords` + `flankShots(sentence, ranges, style, ctx)` | set the subject box from the real frame; type shrinks to fit narrow frames (`lintFlank` warns), one size across the shots with a ctx |
| numbered chapter marks crackling around a speaker | `type/electricOutline` (+ overlay `glow` with `electricGlowPools()` for the halo) | its sound is `ELECTRIC_SOUND` = `sfx/elec/arc` (add `sfx/elec/crackle_loop` under a sign that stays lit); keep flashes under 3 per second |
| giant type behind a person or product (labels, a marquee name) | `type/behindSubject` with a SUPPLIED matte (PNG alpha, frame sequence, SVG; a video alpha -> `python3 tools/alpha_frames.py subject.webm out/matte`) | the pack makes no mattes; `edge: 'hard'` cuts at alpha 0.5 |
| synthetic speech on screen | `caption.speakerTag` (speaker chip + `TTS` badge stays on the whole time) | the disclosure is part of the caption, not a corner label |
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
| a VO-led, documentary, explainer or trailer shape (word timings in, a plan out) | `cuts/story/*` round 4/5, all `cutgen.py` subcommands: `diagramWalkthrough` (`walkthrough`: the diagram advances only in speech gaps), `queryLadder` (`query-ladder`: one UI, 4-6 harder inputs), `fidelityLadder` (`fidelity-ladder`: a step per bar, a dropout, a new dimension), `voicesColdOpen` (`voices-open`), `commandRapidFire` (`command-burst`), `anaphoraCut` (`anaphora`), `trailerArc` (`trailer`), `styleLadder` (`style-ladder`); `templates/multi-voice-doc` runs the documentary one | VO shapes never cut inside a word; they emit `bed_automation` (dropouts, a near-silent question, a quiet hold) that `music/mixer.py` applies; `vo.duck_db` deepens the duck |
| a story shape | `cuts/story/*`: `interruptOpen`, `verbLadder`, `mockumentaryReaction`, `sentenceLed` (`cutgen.py interrupt-open / verbs / mockumentary / sentence`); bundle `mockumentary` for doc-parody comedy | `cutgen.py snap` puts cuts on onsets (target 60% within 2 frames: for music-led cut pieces only; VO-led and continuous films are scored differently, `references/critic.md`) |
| a trailer: a build, a planned valley, a crescendo, one title hit | `music/bed_trailer_arc` (act 1 drone, act 2 ostinato, act 3 wall, a 3 s sub-only gap, a 2-bar crescendo, a hard-stop hit, a quiet hold; every marker in its sidecar in frames) | NOT a loop: fit a cut with `trailer.render_trailer(act_bars=...)`, never by trimming past `gap_start`; cut the picture to black on `visual_cut_frame` (hit - 1); mark the gap and the hold in `plan.audio.quiet` |
| a problem -> pivot -> value -> ask film with no cuts (a typed sentence with an accent word, a 3-beat problem ladder, a 1.5-2 s audio gap, the pivot where colour, bass and the brand line arrive together, a 3-beat value ladder, a typed command CTA, a quiet hold) | `cuts/story/problemPivot` (`cutgen.py problem-pivot`: every frame, the `plan.audio.quiet` gap and hold, the bed automation and one cue per motion event; `check_problem_pivot` re-derives the rules), layers `background.auroraRibbon` (the "solution" ground: rises on `riseAt`, `cuesR6` puts the bass `lead` s before it), `type/typewriter`, `type/blurIn`, `type.accentSwap`; demo `templates/demo-r6-pivot` | zero cuts: sync it by motion events (`plan.audio.events`, `ears --mode continuous`); `plan.audio.role: "brand_launch"` (bass 50-60%: `music/bed_tech_pulse_loop8` is 60%); the gap is the shape, mark it `kind: gap`, never fill it with a riser; the bed must be back ON the pivot frame; the ribbon fades for the hold (the host tweens its container); craft only, no copy of the studied film's wording |
| an electric / neon outline, a power-on or a light dying | bundle `neon_power_on`: `sfx/elec/arc` (zap, `rr:4`), `sfx/elec/crackle_loop` (4 s loop under the lit sign, end it with `until_frame`), `sfx/elec/zap_off` (power-down, anchor on the frame the light dies) | arc on the frame the stroke strikes; the zap-off anchor is its opening snap, so put it on the frame the light dies; synthesised, never auditioned by a human: listen once before a hero use |
| a quiet open, a mid-film reset dip or a quiet end-card hold | `plan.audio.quiet` `[{t: [a, b], kind, why}]` with kind open, dip, gap or hold (open <= 2 s, dip / gap <= 4 s, hold <= 9 s), and `plan.audio.mode` music, vo or continuous for what the critic scores | `ears` then reads the quiet as shape; it still warns on unplanned dead air and on a region over its maximum |
| a tempo build into a drop | `music/bed_anthem_ramp16` (100 → 128 BPM; real beat frames in its sidecar) and `music/tempo_maps.json` | cut from the sidecar, not from a constant BPM |
| a photoreal product shot or 3D title | `blender/turntable`, `blender/macroSweep`, `blender/explode`, `blender/title3d`; art loops `blender/art.*` | EEVEE for motion plates, Cycles for key-art stills |
| an "everything is connected" problem beat (one dependency pulled, the system goes dark; or the fix) | `blender/cableTangle` (`mode=off`: the bulbs go out in sequence on plan frames; `mode=on`: it untangles and they light; `--beats` puts the changes on sound hits) then an abstract untangle diagram | a metaphor, not wiring advice; needs >= 3 s of air; Cycles, so a 1080p plate is slow (about 1.8 s/frame at 480p, 12 samples); `--device cpu` for a hash-level repeat |
| a beat sheet for a genre (SaaS launch, feature drop, explainer, data story, how-to, hardware reveal, teaser, trailer, title sequence, tutorial, vlog, podcast clip, founder story, short film, ad 15/30) | `patterns/structures.json`; hooks `patterns/hooks.json`; CTAs `patterns/ctas.json`; lengths `patterns/lengths.json`; check with `tools/structure_check.py` | every number is graded; beat percentages are practitioner or inference, never platform rules (`docs/evidence/launch-video-patterns.md`) |
| a SaaS product demo: a window you zoom into, a cursor that clicks / hovers / drags, a command palette, an AI answer that streams, a shortcut, pricing, "works with", before / after, toasts, a dashboard that assembles, a device with your screen | `ui.appWindow`, `ui.cursorJourney`, `callout.uiHighlight`, `callout.arrowLabel`, `ui.commandBar`, `ui.aiAnswer`, `ui.shortcutChip`, `ui.pricingCards`, `ui.integrationGrid`, `ui.beforeAfterSplit`, `ui.notifyStack`, `ui.dashboardAssemble`, `device.mock` (`type/gfx/ui-saas*.js`); bundle `saas_ui` | screens are YOUR screenshots / recordings or the labelled placeholder screens of `templates/_shared/saas/screens.mjs` (fictional Acme Flow), never image-model UI; glyphs are categories, never marks |
| a device / hardware hero in 3D: an enclosure with an LED band, an exploded view, a chip that opens, a GPU-like card, ports, a cable | `objects/hw-node` (or `objects/enclosure`, `pcb`, `chip-die`, `heatsink`, `fan`, `gpu-card`, `ports`, `cable`) on `objects/hw-studio`; `objects/xray`; your own `objects/model` (GLB / OBJ) or `objects/photo-25d` | generic, no brand marks; `objects/lib/explode.js` choreographs any part list; `objects/lib/hwshots.js` gives the cameras per shot kind |
| a spec number ON a part of a 3D object, a dimension line, an edge glint, a die diagram, a date / price card, a spec card | `hw.specCallout`, `hw.dimensionLine`, `hw.edgeGlint`, `hw.chipDie`, `hw.dateCard` (`dateAt`: the date lands after the name), `hw.specCard` (`type/gfx/hw.js`) | pass a `track` (per-frame projection of a 3D anchor, `hwshots.js` `track()`) so the line stays on the part; every number prints its source |
| a film trailer and its 30 / 15 s cut-downs | `templates/trailer`, `music/trailer_styles.py`, bundle `trailer`, `cuts/trailer_plan.py` | never double the score's braams and title hit with sfx |
| a trailer title, a billing block, end credits, film cards and subtitles | `title.trailerSlab` / `Thin` / `Distressed` / `Glow` / `Cut`, `credits.billingBlock`, `credits.roll`, `card.releaseDate`, `card.quote` (source required), `caption.filmSubtitle`, `title.filmChapter`, `title.namesOver` (`type/gfx/film.js`) | no studio logos, rating marks or real titles |
| a film look on footage, a film burn, an anamorphic flare | `layers/film.js` `mountFilmFinish(el, genre)` (grade + halation + weave + flicker), `layers/filmBurn` (peaks ON the cut), `layers/anamorphicFlare`, looks `look.film-<genre>` | 9:16 is re-laid out, never letterboxed |
| a "how it works" diagram | `diagram.graph` (steps, focus, flow, cam, notes, zoom into a node), `diagram.flow` | JSON or DSL spec; `type/gfx/graph.js` `layoutGraph` is deterministic |
| an honest chart for a data story | `chart.story` (bar / line / area / scatter; show, hl, compare), `callout.datum`, `counter.hero`, `map.hexTile`, `chart.sourceFooter`, `layout.scrolly` | source + method required; zero baselines; `numfmt.js` for lakh / crore |
| a numbered how-to | `process.steps`, `process.beforeAfter`, `title.takeaway` | icons from `type/gfx/explain-icons.js` |
| captions a viewer can switch on (SRT, WebVTT, TTML), SDH, or burned in | `python3 tools/captions/export.py --plan out/plan.json [--sdh] [--burn out/film.mp4]`; check with `tools/captions/validate.py` | 42 chars a line, 2 lines, 20 cps adults / 17 kids; fast speech is reported, condense it by hand |
| an audio-description script | `python3 tools/describe/export.py --plan out/plan.json [--shotlist shotlist.json]` | DRAFT lines need a human check; no voice is synthesised |
| an accessibility check before and after the render | `python3 tools/a11y_check.py --plan out/plan.json --design design.json --captions <events.json> [--mp4 out/film.mp4]` | flashes, caption contrast on real frames, text size (48 px read floor on 16:9, 56 px on 9:16), reading time, colour-blind collapse |
| the platform file (YouTube, Shorts, Reels, TikTok, X, LinkedIn, broadcast ProRes, web H.264 / HEVC / AV1, GIF, alpha) | `python3 tools/deliver.py out/film.mp4 --preset <id> --out dist/` (`--list`) | BT.709 tags, faststart, loudness per platform with its source; the file is verified after the encode |
| the same title or icon animation in an app or website | `python3 tools/lottie/export.py spec.json --validate` (`--matrix` lists what exports) | kinetic type, draw-on icons, spring shapes; SVG gfx parts, blur and 3D do not export |
| a glass card / a frosted panel over the picture | `ui.glassPanel` (`blurIn: [t0, t1]`; `mode: 'backdrop'` needs a DOM host, `mode: 'plate'` works anywhere, a canvas or a still SVG included) | fade the glass by its own blur and tint, never by a wrapper's opacity |
| a lit window edge, a light running round a card | `ui.rimLight` (`turns`, corner, one stroke width at every t; `rimContrast(p)` >= 4.5) | reads on a dark field |
| a review layer (comment flags, pins, a record clock) or an approval gate | `ui.reviewLayer`, `ui.approvalSlider` (`approvalTimes(p).approvedAt` is the flip frame: `sfx/ui/success_chime` on it) | names and comments are placeholders, labelled |
| one sentence carried across several shots, a word per cut | `type.sentenceAcrossShots` (the word changes ON the cut frame, fixed slot; `sentenceLint` flags short shots) + `cutgen.py sentence` | |
| a wall of text, a wall of language pills, a phone lock screen | `layout.textWall`, `layout.pillWall` (`pillWallLint(p)`: the bundled Manrope covers Latin, Greek, Cyrillic, Vietnamese), `device.lockScreen` (the clock is a parameter) | |
| a sky or dunes plate that loops exactly | `background.skyClouds` (presets `clouds`, `dunes`; loop L = whole periods) | seeded, band-limited |
| a before / after audio swap (the same picture, the new sound) | `cutgen.py ab-replay` (modes `replay`, `flip`; switch on the flip frame, stems level-matched by LUFS) + `ears/ab_replay` (level within 1 dB, the swap on the flip frame), `cutgen.py verify-picture` | a clear spectral difference between the stems is needed for the detector |

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
   For a SaaS, AI, hardware, founder or trailer-shaped launch, start from the matching structure in `patterns/structures.json` and run `tools/structure_check.py` on the plan before rendering.
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

### RECIPE S: SaaS films, templates `templates/saas-launch` (45 / 60 / 75 s), `saas-feature-drop` (15 / 20 / 30 s), `saas-explainer` (60 / 70 / 90 s)

1. **Pick the film:** a launch (pain -> reveal -> one-window UI tour -> three features -> works with -> before / after payoff -> one sourced number -> pricing -> CTA), a feature drop (payoff first, before, after with the shortcut, compare, the keys, where it is live), or an explainer (question, wrong model, reframe, three steps, result; captions always, VO optional).
2. **Edit only CONFIG:** `brand`, `text` (no digits: numbers go to `claims` with a source), `media` (screenshots fill the window's screen slot; recordings become a zoomed video layer), `claims`, `pricing`, `integrations`, `transitions` (with reasons), `music`. `--set aspect=9:16` builds the vertical re-layout in `tall/`.
3. **Screen hot spots** (`scenes.mjs` SPOT, measured on the 1440 x 900 placeholder screen) drive the cursor, the highlight and the zoom rects; re-measure them on your own screenshot.
4. **Explainer VO:** `--set voice.words=/abs/words.json`; scene changes land in the breaths, the bed ducks, the captions light the spoken word.
5. **Build** `node make.mjs`, look at stills through `index.html?t=<s>`, render, then `sheet.py`, ears and eyes on the delivered MP4. Tests: `node type/tests/saas.test.mjs`, `node templates/_shared/saas/saas-templates.test.mjs`.
6. **Approval gate as the hero beat:** `ui.approvalSlider`, the sound on `approvalTimes(p).approvedAt`; label it prototype.

### RECIPE HW: AI-hardware / device launch, templates `templates/hardware-reveal`, `hardware-teaser`, `spec-sheet`

1. **Pick the length.** A teaser (6 / 10 / 15 s) promises: the silhouette alone, the tease line and one detail, the hit with the name, then the date; the product is never whole. The launch film (46 / 56 / 70 s) pays off. The spec sheet (20 / 24 / 30 s) is for the numbers.
2. **Edit the CONFIG only:** `brand`, `product`, `text` (no digits in copy), `device` (dimensions, chamfer, material, LED band colour, ports), `specs` (every number with its `source`; a missing or generic source stops the build), `price` (`value: null` for none; a price always prints its note and source), `media.model.src` (YOUR GLB / glTF / OBJ) or `media.photo.src` (a 2.5D plate).
3. **The music is composed to the cut:** `music/reveal.py` builds the dark > reveal score from the template's sections, so the drop lands on the reveal bar at any length. Do not swap in a loop bed.
4. **Sound:** bundle `hardware_launch`. ONE `sfx/hw/sub_hit` on the reveal frame; the `sfx/hw/hum_loop` under the dark open stops on it (`untilT`); `sfx/hw/light_sweep` peaks on the glint; a detent per callout and spec row, never a chime per row.
5. **Build and render:** `node make.mjs` (renders the 3D plate once per aspect, cached by hash), then the HyperFrames render; 9:16: `node make.mjs --set aspect=9:16`, then render from `tall/`.
6. **Check:** `node templates/_hw/hw.test.mjs`, `templates/_shared/sheet.py`, `eyes/look.py --plan out/plan.json`, `ears/listen.py --plan out/plan.json`. Photoreal hero: `blender/turntable`, `macroSweep`, `explode` take `--param model=/abs/your.glb`.

### RECIPE I: proof film, template `templates/proof-film`

1. **Only with measured numbers.** Every number field needs a `source` AND a `method` that say something (not "n/a", not the same text twice), and a number never sits in prose, the brand, an axis unit or the voice transcript (a digit in any script, a currency sign, a number word): `node make.mjs` exits 2 naming the field (`honesty.mjs`). No numbers yet: stop and measure. The demo is a labelled placeholder ("Acme Reader", fictional); never borrow a real brand's numbers.
2. **Edit the CONFIG of `templates/proof-film/config.mjs`:** the claim (at most 6 words, one `*accent*` word), the method card, ONE builder (`builder.kind` `scatter` = `chart.scatterFrontier`, `trace` = `ui.branchTrace` with one wrong fork turning red, `table` = `ui.dataTable`), the head-to-head rows, 1-3 big numbers, exactly three stat cards, the URL.
3. **A camera, not cuts.** One cam2d world carries every panel; a hard cut needs its reason (`CONFIG.cut`). Sound: a proof bed (20-36% bass share), a tick per state change, ONE soft hit on the number reveal, a planned quiet open and a quiet hold on the end card, no stinger (`plan.audio.quiet`).
4. **Aspects:** `node make.mjs --set format=tall` re-lays the panels for 9:16 inside the conservative safe zone and writes its own project, `tall/index.html`; `ui.branchTrace` is landscape-only, so the gate refuses `trace` on 9:16 (use scatter or table). Render it with `(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/proof-film-tall.mp4 --crf 23)`; run `node make.mjs` for that format right before each render (the page renders the copy staged under `assets/mp/`, not your edit).
5. **Sparse VO (optional):** `--set vo.words=/abs/words.json` (+ `vo.audio`) puts every stage change in a speech gap (`cutgen.py walkthrough`) and the cues under the voice. Run `ears` with `--transcript out/transcript.json`.
6. **Check:** `node templates/proof-film/proof-film.test.mjs`, `templates/_shared/sheet.py`, `ears/listen.py out/proof-film.mp4 --plan out/plan.json`.

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
   - Room tone under every scene (`sfx/amb/*`), set in the plan, not by hand. `sfx/amb/room_tone` ships at −18.1 LUFS-I (peak −6 dBFS); its old "−48 dBFS floor" label was a design target, not the file. Under a bed use a plan cue with `overBedDb`: the loop default is −10 dB under the bed, and measured under `bed_cinematic_drone_loop8` the room-tone stem reads −23.5 LUFS at the default, −33.1 at −20, −39.0 at −26 and −43.0 at −30. The solver trims a cue by at most −30 dB, so with this bed about −33 dB under is the floor: −38 asked gave −32.7, and the mixer prints a `WARN` line and marks the cue `trim_clipped_from_db` in the report when that happens. With no bed (a score-less film, `templates/film-scene`) put `gainDb: -20` on the cue.
   - The score enters on emotion, not on action.
   - 200–400 ms of silence before the turn.
   - Bundle `short_film`, or `office_comedy` for workplace comedy.
5. **Look.**
   - Grade `warm-film` (or `noir`), grain `film35`, and optionally a 2.39 letterbox on 16:9.
   - `cam3d.handheld` level `doc`; use `cam3d.dollyZoom` at most once.
6. **Character.** Use `objects/worker` with `characters/poses.js` `ACTS` and `EMOTIONS`. Hold reactions for 1.5 s.
7. **Render** with `bash templates/_shared/render3d.sh templates/film-scene scene.html wide 23`.

### RECIPE T: film trailer, title sequence, short film, templates `templates/trailer`, `title-sequence`, `short-film`

1. **Pick the genre** (`layers/presets/film-looks.js` FILM_GENRES: thriller, scifi, horror, drama, documentary, noir, period, anime-ink). It sets the look (`look.film-<genre>`), halation, gate weave, grain, dust, the letterbox (2.39 / 2.0 / 1.85 on 16:9; 9:16 is re-laid out, never letterboxed), the title style and the trailer score.
2. **Trailer** (`node make.mjs [--set length=30|15] [--set aspect=9:16]`): cold open -> your production card (never first) -> the world -> the inciting beat -> act 2 (shots fall from 4 to 2 beats, a braam every other bar downbeat) -> act 3 (shots fall from 2 beats to 1 beat to 8th notes, a braam and a cut on every bar downbeat; `cuts/patterns.json` `trailer.accelerate3Act`, about 2 cuts/s at 120 BPM, 4 at the end) -> the silence before the hit (1-3 s, `plan.audio.quiet` gap) -> the title ON the hit -> a button -> the billing block -> the release card. The score (`music/trailer_styles.py`) is rendered for the exact cut; never double its braams and title hit with sfx.
3. **Title sequence** (30-60 s): one name at a time on a beat, over textures or footage; the title late; "directed by" last.
4. **Short film:** scenes of shots (your footage, the three.js stage render, or labelled plates), chapter cards, typed slugs, subtitles from a lines or words JSON (no generated voice), the J / L builder for each scene's sound, the score entering on emotion, a dip into the credits roll. Give every shot its `beat` (coldopen, want, obstacle, turn, consequence, resolution) so the plan carries `plan.structure`.
5. **Honesty:** no studio logos, rating marks or real titles; `card.quote` needs a source; "from the makers of" and the date card print placeholder labels until they are real; the film pill "placeholder footage · fictional film" stays on with placeholder footage.
6. **Check:** `node <template>.test.mjs`, `tools/structure_check.py`, then render, `sheet.py`, `eyes/look.py --plan ...` (the plan asks for the letterbox in `plan.eyes`), `ears/listen.py --plan ...` (role trailer).

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
5. **Several speakers (documentary launch, customer story), template `templates/multi-voice-doc`:**
   - Input: `clips.json` (`[{id, src, words, name, role, tag, lead?}]`, your interview MP4s with whisper word timings in each clip's own time). With `src: null` a clip renders as a labelled "your interview clip here" card over a guide signal, never a generated person.
   - Shape: `voicesColdOpen` (`cutgen.py voices-open`: 4-6 faces in 0.5-1.3 s, each mid-sentence, audio leads every cut) -> the lead's line with a name super at 5-6 s -> 3 chapters (a speaker, a flat 2D insert, B-roll) -> proof -> availability -> the lead closes -> a quiet hold.
   - Cuts: speaker changes sit in the breath between lines and never inside a word; B-roll and inserts cut inside sentences on purpose (the VO is the continuity).
   - Sound: the voices are one `vo.wav`, the bed is ducked 12 dB under it (`plan.duckDb`), the end card keeps the bed up for 1.8 s and then holds at -30 dB (`bedAutomation`). Run `ears` with `--transcript out/transcript.json`.
   - Name supers are `lowerThird.docSuper`, one personal `tag` each after the lead; swap in `lowerThird.personalTag` in `CONFIG.supers.part` once it lands.
   - Build: `node make.mjs [--set clips=/abs/clips.json]`, then `hyperframes render`.

### RECIPE U: personal, tutorial and human-blended videos (your own footage), templates `tutorial`, `vlog-personal`, `podcast-clip`, `founder-story`, `course-lesson`

1. **Footage first (`docs/bring-your-footage.md`).**
   - `python3 tools/human/conform.py probe` every clip; convert VFR with `conform.py cfr`; sync a separate mic with `conform.py sync`.
   - Transcript: whisper words.json, or `node tools/human/human.mjs words talk.srt` (VTT word times kept; SRT spread by length, `est: true`). Speaker tags from VTT `<v Name>` or ALL-CAPS `NAME:`.
   - `human.mjs fillers` lists um / uh (hard) and you know / I mean (soft); cut only by choice (`fillers.cut: 'hard'`). `tools/human/breaths.py` finds breaths the autocut then keeps.
   - Never fake a person, a voice or a recording: with `src: null` every slot is a LABELLED placeholder (silhouette, fictional desktop, "YOUR B-ROLL HERE") and the voice a guide signal.
2. **Pick the template:**

   | video | template | default aspect | what it does |
   |---|---|---|---|
   | screen tutorial | `tutorial` | 16:9 | result first, step cards + counter, zoom-follow-cursor, PiP auto-hide, key combos, highlight / spotlight, code callout, result reveal, end-screen slots |
   | vlog | `vlog-personal` | 9:16 | breath-keeping autocut, alternating framing + punch-ins, location card, keyword B-roll slots with J / L, map route, sticker reactions, emphasis captions, follow CTA |
   | podcast clip | `podcast-clip` | 9:16 | hook card on frame 0, stack / split / active layouts, active-speaker emphasis from speaker tags (L-cut lag, minimum shot), speaker lower thirds, waveform, karaoke |
   | founder / personal brand | `founder-story` | 16:9 | photos with Ken Burns, a timeline of years (each a sourced claim), ONE pull quote that must be verbatim (gate: exit 2), brand field CTA |
   | course lesson | `course-lesson` | 16:9 | presenter / slide + PiP / split sections cut on words, quiz card with a kept pause, recap card, lesson progress bar |

3. **Edit CONFIG only.** Every event is a word of the transcript (`{ word, nth, offset }`) or seconds, so a new take re-times the edit. `--set aspect=9:16` (or `16:9`) builds the re-layout in its own project folder (`tall/` / `wide/`), never a crop.
4. **Sound.** The voice stem is your recording through the tone chain (HPF 80 Hz, de-ess, 3:1; `tools/human/voice_chain.py` alone masters a voice to -14 LUFS-I / <= -1.5 dBTP); the bed is ducked 12-14 dB under it by `music/mixer.py`; one cue per gfx action (`gfxCues`) under the voice. Run `ears` with `--transcript out/transcript.json`.
5. **Green screen:** `python3 tools/human/chroma.py key fg.mp4 out.mp4 --bg plate.png` (chromakey + despill, deterministic). No ML background blur is shipped (no pinned open model): see the guide.
6. **Check:** `node templates/_shared/human/human.test.mjs`, `python3 -m pytest -q tools/tests/test_human_tools.py`, then sheet, `ears` and `eyes` on the delivered MP4.

### RECIPE E: explainer, data story, how-to, templates `templates/explainer-diagram`, `data-story`, `process-howto`

1. **One canvas, no hard cuts:** every change is a camera beat, a node landing or a highlight (`plan.audio.events`; no gap over 3.5 s outside a planned hold).
2. **Explainer:** the question on frame 0 over a diagram already drawing -> the wrong model -> the mechanism built node by node (`diagram.graph` steps / cam / focus / flow / notes) -> zoom INTO the hardest node -> trace one item -> recap -> takeaway. Diagrams are JSON or the graph DSL; the layout is deterministic (LR on 16:9, TB on 9:16).
3. **Data story:** every dataset needs `source` AND `method` (make.mjs exits 2 otherwise); bars and areas start at zero; a truncated line axis needs its label; every chart frame prints the source footer (and DEMO DATA for demo data). Numbers come from the data files, never from copy; `locale: 'in'` prints 12,34,567 and lakh / crore.
4. **How-to:** 2-8 steps (<= 5 words each) with owned icons, a tip card per step, before / after with your photos (null = labelled placeholder), a checklist end card held >= 3 s.
5. **Optional VO:** `voice.words` (+ `voice.audio`); beats with `word` land on the word, captions follow the voice, the bed ducks 12 dB.
6. **Check:** `node templates/_explain/explain.test.mjs`, `python3 tools/structure_check.py templates/<t>/out/plan.json`, then `sheet.py`, ears and eyes on the render.

### RECIPE D: delivery and accessibility (every public video)

1. **Captions:** `python3 tools/captions/export.py --plan out/plan.json --out out/captions` (`--sdh` for speaker IDs and [sound] tags; `--audience kids` for 17 cps). A cps fail means the speech is faster than people read: condense those events by hand and re-check with `tools/captions/validate.py`.
2. **Burned-in copy** for feeds that play muted (X, LinkedIn): `--burn out/film.mp4` (the burned track re-breaks to the safe width).
3. **Audio description:** `python3 tools/describe/export.py --plan out/plan.json [--shotlist shotlist.json] --out out/ad`. Rewrite every DRAFT line against the picture; a describer records the script (the pack synthesises no voice), or ship `ad.en.vtt` as a descriptions track; offer the extended-AD cut (`--extend-video`) if lines did not fit.
4. **Lint:** `python3 tools/a11y_check.py --plan out/plan.json --design design.json --captions out/captions/captions.en.events.json --mp4 out/film.mp4 --md out/a11y.md`. No fail before delivery.
5. **Deliver:** `python3 tools/deliver.py out/film.mp4 --preset youtube --preset reels --out dist/`. Every verification line reads `ok`; broadcast uses `--preset broadcast-prores --region ebu|atsc`. Guide: `docs/DELIVERY-AND-ACCESSIBILITY.md`.
6. **App or website loop** of the title or icon: `python3 tools/lottie/export.py spec.json --validate`; check the stills with `tools/lottie/playcheck.mjs`.

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
