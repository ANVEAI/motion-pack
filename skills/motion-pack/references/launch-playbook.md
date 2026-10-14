# Launch-film playbook

How to plan, build and ship a product launch film that travels. Derived from 15 launch films from 2023–2026 (Ghost, Hark, Gemini "Argon", Pine, Tavus, Oki, Rabbit, Humane, Friend, Daylight, Limitless, Mac mini, Nothing, Cursor, Linear, Notion, Figma, Comet, ElevenLabs, Dia). The evidence and every source is in `docs/research/launch-films-2026.md`.

Numbers here are tunable defaults drawn from those films, not laws. RECIPE L in `SKILL.md` builds what this page plans.

## 1. Pick the archetype first

| id | archetype | length | use when | evidence |
|---|---|---|---|---|
| **L1** | Founder keynote | 1:30–2:30 (up to 8 min for a full keynote) | A new category from a small company; the founder is credible on camera | Ghost 2:24, Oki 1:31, Pine 1:43, Hark 8:20, Limitless 9:39 |
| **L2** | Hero sizzle | 30–60 s | Hardware or a physical product; wordless, music-led | Rabbit 57 s, Limitless 42 s, Mac mini 43 s |
| **L3** | Product UI film | 45–90 s | Software; the product's own screens carry it | Cursor 64 s, Linear 55 s, Notion 90 s, Comet 72 s |
| **L4** | Output montage | 45–60 s | A model or platform whose outputs are visual | Gemini "Argon" 51 s |
| **L5** | Teaser | 6–15 s, 1:1 or 9:16 | The day before; announce a premiere time | Hark "premiering at 9am" 6 s; Comet 7 s at 1:1 |
| **L6** | Build-in-public clip | 15–30 s, 9:16 | Pre-launch weeks, to build anticipation honestly | (pack practice) |
| **L7** | Metaphor manifesto | 20–30 s | A brand, programme or cohort with no single product shot. An archival metaphor in three lines, then real people, then the title | Stan "Launchpad" 22 s: craft reference only, reception unproven; see `docs/research/reference-stan-launchpad-2026-10.md` |
| **L8** | Proof film | 16–80 s, usually 0–4 cuts | You have a measured result (a benchmark, a cost, a caught failure) and a builder audience. One chart or diagram that builds carries the argument | Round 4/5: tier A on reach and saves (a benchmark scatter at 8.5× followers and 1.23% saves; a diagram explainer at 3.3× and 1.0%; a data-table post at 1.31% saves). The best-saved shape of the batch. `docs/research/reference-round45-2026-10.md` |
| **L9** | Multi-voice documentary | 1:45–3:00 | A team, a customer base or a launch with real people who can speak to it | Round 4/5: three tier-A pieces at 107–185 s (a frontier-model launch, a finance workspace, a wearable). Long works when it is people talking |

**Pair them.** A long film converts believers; a short one travels:
- Rabbit: a 25:30 keynote plus a 57 s spot.
- Limitless: 9:39 plus 42 s.

Default package: **L5 the day before → L1 or L3 on launch day → L2 cut-down → the sales number as a second wave**. With a measured result, **L8** is the strongest launch-day film for a builder audience; **L9** follows once real customers can speak.

## 2. Beat sheets

Times are for the stated length; scale them proportionally.

### L1 founder keynote (~2:00)

| t | beat | notes |
|---|---|---|
| 0:00–0:05 | **Hook:** the object or the thesis | Hardware: the product is in frame 0 (Ghost's lit monolith, Oki's card sliding in). Software: one provocative sentence (Hark "I don't want to use a computer anymore", Pine "fundamentally flawed") |
| 0:05–0:15 | Founder intro, name super | On camera, beside the product |
| 0:15–0:40 | Thesis and problem | One idea. The post copy carries the full argument |
| 0:35–0:45 | **Reveal or naming** (software) | Hark at 0:35, Pine at 0:40 |
| 0:40–1:45 | 3 demos, **mundane and specific** | A GPU by Friday, lost keys, a trip plan. Real UI composited into the scene |
| ~1:30 | **One hard-number proof** | It must survive scrutiny: every number in this wave drew pushback |
| 1:45–2:00 | Vision line, pull-back | Ghost reveals the set is a stage with an audience |
| last 3–6 s | **End card:** wordmark + URL + one verb | "Pre-order at …", "Join the waitlist" |

### L2 hero sizzle (~45 s)

| t | beat | notes |
|---|---|---|
| 0–2 s | **Light from darkness:** an edge or band sweep | Limitless hits +11.6 dB at 1 s; Rabbit lights edges in black |
| 2–14 s | Tease: macros of material, ports, the light | `blender/macroSweep`, one hero light effect |
| ~4–14 s | **Reveal on a music hit** | Rabbit's full product lands with +8 dB at 13 s. Give a silent beat before it (Daylight: a 5 s dropout, then +20 dB) |
| 14–35 s | Transform or personify | Explode, morph or colorway (Limitless); a personified box (Mac mini). Best for a sealed box with no screen |
| 35–40 s | The product doing the job | Never lifestyle without the job (Humane's failure) |
| last 3–5 s | End card: name + URL (+ price if stable) | Music falls to silence under it (Mac mini) |

### L3 product UI film (~60 s)

| t | beat | notes |
|---|---|---|
| 0–3 s | Brand or promise | Cursor's claim by 3 s; Notion's headline by 2 s |
| 3–8 s | **Proof early** (optional) | Cursor's benchmark chart at 5 s |
| 5–16 s | **First real UI** | Linear at 0, Notion at 5, Cursor at 12, Comet at 16 |
| then ×3 | **Feature = a one-line card + 5–15 s of real UI** | The typed prompt is the action beat for AI products |
| late | Zoom-out or recap | Notion zooms out to a grid of agents; Linear pulls back to the full app |
| last 3–10 s | Logo (+ URL) | Linear holds the wordmark 10 s |

### L4 output montage (~50 s)
- **Opening:** the prompt is typed by 1.5 s.
- **Body:** input → output split screens (sketch → simulation, part → CAD) at about 40 changes/min.
- **Ending:** a closing title on an accelerating cut. Music only.
- **Use it only when** the outputs are genuinely striking.

Its two strongest forms (round 4/5, both tier A):
- **Query ladder** (60 s; 1.66% saves, the best in the batch): the concept as a space (0–5 s) → the name → **one UI, five escalating inputs**, each 4–7 s with one VO line (a video moment → a podcast minute → a document clause → another language → code; about 99 wpm, the sparsest VO in tier A) → pull back to where it runs, with benefit chips → the repo. Planned part: `cuts.story.queryLadder` (round 4/5).
- **Fidelity ladder** (~60 s): a crude first attempt with a live readout (error %, N) → **one parameter step per bar** (2.4 s at 99 BPM) → a 2–3 s dropout (a planned quiet dip) → the same thing in a **new dimension** (2D → 3D) → a title. A variant puts three model generations side by side on one prompt. Planned part: `cuts.story.fidelityLadder` (round 4/5).

### L5 teaser (6–15 s)
- The hero object or the most surprising output, plus a date or premiere time. No explanation.
- Square or vertical. Post it from the founder's account the day before.

### L7 metaphor manifesto (~22 s)
- **0–2 s:** an archival or metaphor image in motion. Never black on frame 0.
- **2–9 s:** three short lines, each on its own container (grid, frame, circle, dot field). Change scale between lines, and put one texture verb on each: scramble, weight jump, outline→fill, dither dissolve.
- **9–15 s:** the payoff on real people from the brand's world, at ~0.5 s per shot, with one hard-cut brand glyph as punctuation.
- **15–20 s:** title cards: tiny line, then wide bold name, then light date.
- **Last 2 s:** the logo.
- **Colour:** one accent colour across duotone archive, type and wardrobe.

### L8 proof film (~40 s; 16–80 s)

| t (40 s) | beat | notes |
|---|---|---|
| 0–2 s | **Claim** in at most 6 words, one accent word | Frame 0 moves; the sound may enter 1–2 s later (planned quiet open) |
| 2–4 s | The name | A small product-name super is fine |
| 4–8 s | **Method or setting card** | What was measured, on what, against whom. Without it the numbers are claims |
| 8–22 s | **One chart or diagram that builds** | A cost-vs-score scatter whose frontier line draws through the field and a starred hero point; or a decision diagram where a wrong fork turns red and the red propagates downstream (the strongest honest climax: a failure the method catches). Advance it in VO gaps (a 0.3–0.5 s gap every ~4 s) |
| 22–30 s | **Head-to-head rows** against the alternative | A table whose rows and counters build under a one-line finding |
| 30–35 s | Big numbers, **each with its source on screen** | `counter.statCard` needs `source` |
| 35–37 s | Three stat cards (better / leaner / cheaper) | |
| 37–40 s + | URL or repo on the end card, **quiet hold** | No spoken CTA in any tier-A explainer |

- **Cuts:** usually none. The camera moves between slides or the diagram grows, so score sync by motion events (`plan.audio.mode: "continuous"`, or `"vo"` with a voice; `references/critic.md`).
- **Bed:** a proof or explainer bed at 20–36% bass share, so numbers and VO sit on top; −14 LUFS master.
- **Parts:** `templates/proof-film` builds this archetype (one continuous cam2d camera, an honesty gate that refuses a number without its source and method, 16:9 and a 9:16 re-layout, optional sparse VO); its parts are `chart.scatterFrontier`, `ui.dataTable`, `ui.branchTrace` and `cuts.story.diagramWalkthrough` (the VO path).
- **Honesty:** measured numbers only, each with its source and method. If the numbers do not exist yet, stop and measure; never borrow them.

### L9 multi-voice documentary (~2:30; 1:45–3:00)

| t (2:30) | beat | notes |
|---|---|---|
| 0–5 s | **Five faces in five seconds**, each mid-sentence (J-cut audio), before any name | People first; curiosity about who they are |
| 5–25 s | **The lead's thesis** | Name super plus **one personal detail** ("built the first X at Y") |
| 25–1:50 | **Voices in turn**, 3 chapters | Each voice gets a name super with one personal detail. **Flat 2D inserts** for the abstract ideas (networks collapsing to one dot, documents tiling a wall). B-roll cuts land mid-sentence: the voice is the continuity |
| 1:50–2:15 | **Customer proof** | Real customers on camera, or nothing. Never stage a testimonial |
| 2:15–2:30 | Availability, then the end card on a quiet hold | Partner lockup "A · B" if it is a partnership |

- **Sound:** VO at 175–193 wpm. The references sat at −16 to −19 LUFS integrated; keep the pack master at −14 LUFS-I / ≤ −1 dBTP. A VO-documentary bed at 15–34% bass share, ducked 9 dB under every line.
- **Sync:** score it in `vo` mode: cuts under the voice (61–89% of cuts in the reference documentaries fell inside a line), no cut inside a word.
- **Parts:** `templates/multi-voice-doc` and `cuts.story.voicesColdOpen` (round 4/5, planned in parallel); today `templates/talking-head`, `lowerThird.accentRule`, `type/gfx` flat inserts.
- **Honesty:** only real people who agreed to speak. For ANVE this waits until real pilot customers exist.

### L6 build-in-public (15–30 s)
- **Opening:** one real screen or one concept render, with a ≤7-word hook on frame 0.
- **Body:** 2–3 beats, each with one honest label ("Real screen · development build", "Concept render · unit in design").
- **Ending:** a waitlist end card. No prices, no demo asks.

## 3. Rules that held across the winners

1. **The first frame is the product or the thesis, never a logo bumper.** 90% of ad-recall impact lands in the first 6 s (TikTok Creative Codes).
2. **Hardware: show it by 0–4 s.** The exception is a light reveal that is itself the hook (Rabbit).
3. **Software: show real UI by 5–16 s**, and film the real product. Never let an image model redraw the UI (`frame-design`). Lago's agent pipeline enforces "cannot invent UI".
4. **Demos are mundane and specific.** Everyday tasks beat capability claims (Ghost, Hark).
5. **One defensible number.** Every proof number in the October 2026 wave drew pushback. Put the method in the post or the description.
6. **Each film gets one visual constant, and the art direction comes from the product itself.**
   - Hark: the app's own sky background.
   - Ghost: a 2001-style monolith for a "retro-future" brand.
   - Oki: the data card you hold.
   - Nothing: the back-panel LEDs.
7. **The product's own light is a story device.** A band, LED or glow that switches on is a reveal for a sealed box (Nothing, Limitless, Rabbit).
8. **Text-only by default.** 79% of feed video is watched sound-off (LinkedIn). Use VO only for audio products (ElevenLabs) or the founder (L1). Never layer VO over busy music.
9. **Personality gets remembered.** Notion's cowboy agent was named in comments. Figma chose 15 fps over slick 60 fps to feel handmade.
10. **The end card is minimal:** wordmark, URL and one verb, held 3–10 s. Keep the **price in the post copy** if it may change (Oki's moved from $1,799 to $2,299).
11. **The post does real work.**
    - The film carries the demo; the copy carries the argument (Pine).
    - A demo thread multiplies saves (Tavus: 6 replies, 27K bookmarks).
    - A behind-the-scenes post follows (Ghost).
12. **Master 16:9 for the launch post** (every film in the October wave was 16:9 on X). Re-layout to 9:16 and 1:1 for cut-downs; never crop.
13. **Drop the beat late, on the turn line.** Run the problem on UI ticks and texture only (no kick, no bass) for 10-60% of the runtime, then land the beat exactly on the first frame of the turn line or the product name. An optional 0.5-1 s speech gap before it replaces the riser; with no gap, a riser ends one frame before the hit. Proven in round 3 (lexnlin 3.8% bookmarks, kaif9998 1.55x reach; 6 of 25 pieces). Plan it with `cuts/cutgen.py late-drop` (`cuts/story/lateDrop`).
14. **Leave 1-3 s of near-silence before the final sting.** After the lockup, fade the bed out, hold the picture still on room tone at most (never digital zero mid-film), then cut to one sting on a giant cropped mark or the end card. It is an ending device, not the 200 ms smash gag. Seen in motionbyleo (3.0 s, 2.8% bookmarks), fishaudio-2 and kevin-t-ngo (1 s dip). Plan it with `cuts/cutgen.py pre-sting` (`cuts/story/preStingSilence`).
15. **Pick the end shape on purpose.** There are four first-class endings; choose one per film and plan it:

    | end shape | what you hear | use for | evidence |
    |---|---|---|---|
    | **Quiet hold** | the bed decays, then the end card holds on near-silence (room tone at most) for **3–9 s**; the last 0.15 s is digital zero | explainers, proof films, partnership posts, documentaries | round 4/5: 17 of 28 end at least 10 dB under the body; a tier-A diagram explainer holds 9 s of silence under its end card, others 4–5 s |
    | **Pre-sting silence** | 1–3 s of near-silence, then one sting on the mark | brand tours, motion pieces (rule 14) | round 3 |
    | **Sustained sub** | the logo sits on a held low note, not a hit | music-led, moody | round 3 |
    | **Slam** | a hard stop on the last hit, then black | trailers (after the crescendo), hype cuts | round 4/5 trailer arc |

    Mark a quiet hold in `plan.audio.quiet` (`{"t": [a, b], "kind": "hold", "why": "end card"}`) so `ears` reads it as intended, not as dead air; ears reports the measured ending shape. The loudness is still measured on the whole file (−14 LUFS-I).

## 4. Anti-patterns (each one sank or dented a launch)

- **Unchecked AI answers on screen.** Humane's wrong eclipse and almond answers became the story. Verify every on-screen output.
- **Demos that promise more than ships.** Rabbit's "large action model", then "it's an Android app". Show only what runs.
- **Lifestyle footage where the product never visibly does the job** (Humane's spot).
- **A tone that reads as dystopian.** Friend drew 26.6M views, a 29% reply-to-like rate and no disclosed sales. That is controversy, not demand.
- **Long logo stings before value.**
- **Raw view counts as success.** Linear Agent had 6.25M views but 1.7K likes; read ratios instead (§6).

## 5. Craft → pack parts

| beat | pack ids |
|---|---|
| Light from darkness, edge sweep | `blender/macroSweep`, `layers` (`flareStreak`, one hero light), `cam3d.pushIn` |
| Hero orbit / turntable | `blender/turntable`, `cam3d.orbit`, `objects/product-box` (swap in your model) |
| Explode / teardown | `blender/explode`, or layered renders animated as a pure function of `t` |
| Reveal on the hit | `transitions/maskReveal` or `transitions/shutter`; a 1-bar riser ending one frame before; `sfx/logo/*` or a cinema hit |
| Silence before the payoff | duck the bed for 0.2–5 s in `music/mixer.py`; return with a hit |
| Late drop on the turn line | `cuts/story/lateDrop` (`cutgen.py late-drop`): `sfx/ui/agent_working` + `sfx/ui/tick` before, `sfx/hit/sub_drop` on the drop; bed enters on the drop downbeat |
| Silence, then the final sting | `cuts/story/preStingSilence` (`cutgen.py pre-sting`): bed out, `sfx/amb/room_tone` at most, `sfx/stinger/cut_to_black` |
| Quiet-hold ending | bed fades under the URL card; `sfx/amb/room_tone` at most; `plan.audio.quiet` kind `hold` (3–9 s) |
| Trailer valley then crescendo | `music/bed_trailer_arc`: act 1 drone, act 2 ostinato, act 3 wall, a planned gap, crescendo, hit, quiet hold; marker frames in its sidecar. Mark the gap in `plan.audio.quiet` (kind `gap`) |
| Proof film (L8) | `chart.scatterFrontier`, `ui.dataTable`, `ui.branchTrace`, `cuts.story.diagramWalkthrough` (round 4/5); `counter.statCard`, `chart.bar` |
| Multi-voice documentary (L9) | `templates/multi-voice-doc`, `cuts.story.voicesColdOpen` (round 4/5); `templates/talking-head`, `lowerThird.accentRule` |
| "Everything is connected" problem beat | `blender/cableTangle`: a seeded cable tangle feeding warm bulbs that go out in sequence (or light as it untangles) on plan frames; follow it with an abstract untangle diagram |
| How it is made (AI-builder launch) | `cuts/story/pipelineReveal`: `blender/passReveal` (wire -> x-ray -> clay -> full), `blender/knolling`, then `blender/cloudFlight` (the product in the world) after a music breakdown |
| Archive opening | `sfx/amb/projector` under the footage, `sfx/foley/typewriter` on all-caps credit cards (bundle `archive_open`) |
| Feature card + UI | `type/maskRise` card, `device.laptop` / `device.phone` with the real recording under the frame, `callout.spotlight` |
| Typed prompt | `type/typewriter`, `sfx/device/*` keys |
| Proof number | `counter.statCard` (needs `source`), `chart.bar` |
| Founder super | `type/gfx` `lowerThird.accentRule` (premium) or `.cleanBar` |
| Montage drive | `cuts/sections/build_accelerate` into the drop; `music/bed_anthem_ramp16` (real beat frames in its sidecar) |
| End card | `type/elasticPop` or `type/blurIn`; `transitions/dip-to-black`; sonic logo |
| Finish | layers recipe `launch-studio` (do not double-stack bloom, vignette or grain) |

**Sound levels.**
- VO-led founder films in the wave sat at about −18 to −25 LUFS; music-led films were louder (Argon about −15).
- The pack master stays at −14 LUFS / ≤ −1 dBTP decoded. Within it, keep dialogue clear: duck the bed at least 9 dB under voice.
- **Late drop and pre-sting silence** (round 3, `references/success-patterns.md` section 8): the quiet opening and the quiet ending are part of the master, not exceptions to it. Measure loudness on the whole file; the drop and the sting should feel louder because the sections around them are sparse, never because they clip.
- **Bed bass share by role** (round 4/5, the energy share under 150 Hz as `tools/refstudy.py` measures it): **proof and explainer beds 20–36%** (numbers and VO sit on top), **hype and trailer beds 50–61%**, **VO documentaries 15–34%**. Round 3's 52–87% was the hype case, not a default. `ears/listen.py --role <role>` reports where your bed sits.

## 6. Measure what matters

Read the post at 24 h and 72 h:
- **Bookmark rate** (saves ÷ views, and saves ÷ likes) means "considering buying". Ghost was 1.6× the directory median; Oki's saves were 65% of its likes.
- **Like rate** below about 0.1% of views usually means paid impressions; compare like-for-like.
- **Quote/reply rate** far above the norm means controversy (Friend, Tavus). Check the sentiment before celebrating.
- **The outcome:** orders, waitlist sign-ups by UTM, the raise. Post the number as a second wave (Rabbit "10,000 day 1", Limitless "10,000 orders").

## 7. Launch-film checklist

- [ ] Archetype chosen, plus its pair (long + short) and the teaser.
- [ ] Frame 0 is the product or the thesis; first UI or reveal inside the beat-sheet window.
- [ ] 3 demos, mundane and specific, all running for real; every on-screen AI answer verified.
- [ ] Exactly one hard number, with its method published.
- [ ] One visual constant taken from the product; honest labels on renders.
- [ ] Wordless or captioned; VO never fights the music.
- [ ] Sound shape planned: where the beat drops (late, on the turn line?), whether the sound enters 1–2 s after a moving frame 0, and the end shape (quiet hold, pre-sting silence, sustained sub or slam). Planned quiet regions are in `plan.audio.quiet`.
- [ ] The edit's sync mode is set (`plan.audio.mode`: music, vo or continuous) so the critic scores the right rule.
- [ ] End card: wordmark, URL, one verb. The price lives in the post copy unless it is final.
- [ ] 16:9 master; 9:16 and 1:1 re-layouts; the 6 s teaser.
- [ ] Post copy carries the argument; demo thread ready; BTS scheduled; second-wave number planned.
- [ ] RECIPE L QA passed (ids, stills, loudness decoded from the MP4, sync, flash safety).
