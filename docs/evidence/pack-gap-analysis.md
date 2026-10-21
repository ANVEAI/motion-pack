# Gap analysis: commercial template packs and video tools vs motion-pack

Lane 5 of the expansion round, 16 Oct 2026. This file asks one question: what would make motion-pack the strongest open-source video pack? It compares **feature categories only**. Nothing here copies a product's description, design or asset. Vendor features come from each vendor's own page, read on 2026-10-16, unless a row says otherwise. Pages that blocked our fetcher are listed under "Not covered"; their features are not guessed.

## Sources read (vendor pages unless marked)

- **Template packs and plugins:**
  - [AEJuice App Promo](https://aejuice.com/product/app-promo/)
  - [MotionVFX mPlugins](https://www.motionvfx.com/mplugins)
  - Motion Array app-promo listings ([1](https://motionarray.com/after-effects-templates/app-promo-clean-presentation-opener-935839/), [2](https://motionarray.com/after-effects-templates/app-promo-stories-416145/)); search-result summaries only, because the pages returned 403
  - [a multi-device mockup product](https://erdpme.gumroad.com/l/multi-device-video-mockup)
- **AI video tools:** [Submagic](https://www.submagic.co/), [HeyGen](https://www.heygen.com/), [Synthesia](https://www.synthesia.io/), [InVideo](https://invideo.io/), [Descript](https://www.descript.com/), OpusClip ([vendor blog](https://www.opus.pro/blog/best-video-clipping-tools))
- **Motion and code tools:** [Jitter](https://jitter.video/), [LottieFiles](https://lottiefiles.com/), [Remotion templates](https://www.remotion.dev/templates)
- **Music:** [Artlist stems](https://artlist.io/blog/new-music-stems/), [Audio Network stems](https://us.audionetwork.com/support/stems)
- **Complaints (practitioner, anecdotal):**
  - [a Creative Cow forum thread](https://creativecow.net/?p=231978)
  - [a MotionElements article](https://www.motionelements.com/blog/articles/what-are-after-effects-templates)
  - [a resize feature request on another editor's tracker](https://reactvideoeditor.featurebase.app/p/allow-repositioning-of-video-content-after-resizing-like-canvas-drag)
  - [a third-party review of Envato's terms](https://terms.law/ToS-Watchdog/stock-media/envato/)
  - [Envato's DMCA help page](https://help.elements.envato.com/hc/en-us/articles/360000629566)

**Not covered** (blocked or out of budget): Envato Elements and VideoHive listings, Storyblocks, the Artlist home page, Canva video, CapCut templates (HTTP 451), Adobe Express, the Premiere MOGRT help, Animoto, Pictory, Rive, Motion Canvas, Cavalry and Keynote-style packs. No source counts how often a feature appears across marketplaces, so "table stakes" below means "on every page we read", not a measured share.

## What the market sells, in three layers

**1. Template packs** (After Effects, Premiere and Final Cut) sell editable slots and visual polish:
- text, media and logo placeholders (one app-promo pack advertises 12 scenes and 26 image placeholders);
- colour versions and global colour controls;
- titles, lower thirds and call-outs;
- transitions, LUTs and film looks, flares and overlays;
- animated device mockups with screen replacement;
- HD to 4K output;
- genre collections (reels, documentary, music video).

Several things are usually *not* in the box:
- **Sound:** the app-promo pack we verified says it ships no sound effects and no music.
- **Aspect re-layout:** the same pack is "not auto-resizable", and vertical versions of app promos appear as separate products.
- **Licence after cancelling:** a review of one marketplace's terms says new projects need an active subscription.

**2. AI video tools** sell automation:
- animated auto-captions (vendors claim 90-175 languages);
- subject-tracking reframe to 9:16;
- auto B-roll, zooms and sound effects;
- silence removal;
- avatars and voice cloning;
- translation with lip-sync;
- brand kits;
- prompt-to-video and natural-language editing agents;
- a 0-100 "virality score", which the vendor calls a prediction;
- APIs and an MCP server;
- credit-based plans with a free tier.

**3. Motion and code tools** sell programmability and reuse:
- Jitter: batch export to video, GIF and Lottie, plus one-click resize per channel.
- LottieFiles: themed variants inside one file.
- Remotion: data-driven templates and a render server, including a repo-stars film and word-by-word TikTok captions.

**Music libraries** sell stems, alternate mixes and cut-downs, often on paid plans only.

**Complaints we could find** (anecdotal):
- templates harder to customise than starting from scratch;
- a template fighting the brand's colours;
- resizing that crops important content;
- no sound in the box;
- licences tied to a live subscription, item takedowns and account suspensions.

## The comparison

**Columns:**
- **Packs:** template marketplaces.
- **AI:** AI tools.
- **Today:** motion-pack `main` at v0.3.0 (counts from `tools/count.py`).
- **After:** this round's lanes (1 SaaS, 2 hardware, 3 film, 4 human / tutorial / personal, 5 research, 6 editable project file) *if they land as briefed*. At the time of writing nothing from the other lanes was merged, so read the After column as the brief, not a result.

**Symbols:** ● = strong, ◐ = partial, ○ = absent.

| category | Packs | AI | Today | After | note on motion-pack |
|---|---|---|---|---|---|
| Transitions | ● | ◐ | ● | ● | 50 transitions, each with a motivating reason and a paired sweetener |
| Kinetic type, titles, lower thirds, call-outs | ● | ◐ | ● | ● | 217 type presets incl. captions, call-outs and lower thirds |
| Film looks, LUTs, grain, overlays | ● | ○ | ● | ● | 139 finishing layers, 45 looks, 49 `.cube` LUTs |
| Sound effects shipped and synced to frames | ○ | ◐ | ● | ● | 301 synthesised sounds, a cue on frame F + 1, ears checks sync. Packs leave sound to separate libraries |
| Music with fitted cuts and markers | ○ (separate libraries) | ◐ | ● | ● | 41 beds, length-fitted cuts, a trailer bed with a marked gap; no separate stems yet |
| Mastering to platform loudness | ○ | ○ | ● | ● | mixer to -14 LUFS-I, delivered TP <= -1 dBTP, measured from the MP4 |
| Device mockups with screen replacement | ● | ○ | ◐ | ◐ | `device.phone` / `device.laptop`, 3D laptop and phone objects, corner pin; lane 2 adds hardware parts |
| 3D logo and product reveals | ● | ○ | ● | ● | `objects/logo-extrude`, Blender turntable, macro sweep, explode, title3d |
| Genre templates | ● (hundreds) | ● | ◐ (7 genres) | ◐→● | SaaS, hardware, film and human lanes target the genres research ranks highest |
| Editable slots and one brand file | ● (placeholders) | ● (brand kits) | ◐ (CONFIG per template) | ● | lane 6: one project file mapped onto every template's CONFIG (`PROJECT_MAP`) |
| Aspect versions by re-layout, not crop | ○ (separate SKUs) | ◐ (reframe = crop or track) | ◐ (proof-film, talking-head; ad is 16:9) | ● | the editable contract requires 16:9 and 9:16 as a re-layout for every new template |
| Cut-downs (6 / 15 / 30 / 60 s) from one master | ○ | ○ | ◐ (`--set length=30` on ad) | ◐ | no source showed automatic cut-downs; a gap nobody fills |
| Hook variants on one body | ○ | ◐ (a hook generator, a predicted score) | ◐ (story-script writes three, `hook.archetype`) | ◐ | `patterns/hooks.json` gives 13 archetypes with frame-0 rules |
| Structure, retention and text-density lint | ○ | ◐ (a predicted virality score) | ◐ (pace lint, eyes, ears, storyboard checks) | ● | `tools/structure_check.py` scores a plan against 18 sourced beat sheets and prints fixes |
| Honesty gates (sources for numbers, labelled placeholders) | ○ | ○ | ● | ● | `lint.proof`, the proof-film honesty gate, `check_names`; no product we read has one |
| Deterministic, seek-safe render | ○ | ○ | ● | ● | every part a pure function of t; measured |
| Automated QA of the delivered file (picture and sound) | ○ | ○ | ● | ● | eyes (9 checks) and ears (10 checks) with fixes and timestamps |
| Storyboard and animatic before the build | ○ | ○ | ● | ● | `storyboard/board.py` |
| Auto-captions from audio | ◐ (plugin) | ● | ◐ (word timings in, from a transcriber you run) | ◐ | captions render well; transcription stays external (whisper) |
| Subject-tracking reframe of real footage | ○ | ● | ○ | ○ | no tracker; `type/behindSubject` and corner pin need a supplied matte or track |
| Silence removal / jump-cut autocut | ○ | ● | ● | ● | the talking-head autocut |
| Auto B-roll, zooms, emphasis SFX | ○ | ● | ◐ (rules in the talking-head recipe) | ◐ | lane 4 extends the human edit |
| Stock footage library | ● | ● | ○ (by design) | ○ | no third-party media is vendored; slots render labelled placeholders |
| Avatars, voice cloning, lip-sync translation | ○ | ● | ○ / ◐ (optional cloud TTS) | ○ / ◐ | out of scope by design: no generated people presented as real |
| Localisation (one film, many languages) | ◐ (captions) | ● | ○ | ○ | text lives in CONFIG.text, so a per-language copy deck is cheap to add |
| Data-driven / batch render | ○ | ◐ (APIs) | ◐ (`--set`, CLI) | ◐ | lane 6 `--project` makes a batch a loop over project files |
| Natural-language agent editing | ○ | ● | ● (the six skills drive the pack) | ● | the agent edits code and config, then checks the result |
| Interactive or branching video | ○ | ◐ | ○ | ○ | out of scope (MP4 delivery) |
| Licence | per-item or subscription | subscription / credits | MIT code, CC0 media | same | answers the "licence after cancel" and takedown complaints |
| Publishing copy, disclosure, upload copies | ○ | ◐ (scheduling) | ● (social-video skill) | ● | drafts only; the user publishes |

## Ranked: what would make motion-pack the strongest open-source video pack

Scored on three things:
- what the research says moves results (`launch-video-patterns.md`);
- how big the gap is against the market;
- how well it fits a code-first, honest, deterministic pack.

The first three build on what is already unique.

1. **Genre templates for the high-view formats, each scored against its beat sheet.** These are the 14 structures in `patterns/structures.json`: SaaS launch, feature drop, explainer, hardware reveal, teaser, trailer, title sequence, tutorial, vlog, podcast clip, founder story, short film, ad 15 and ad 30. Lanes 1-4 build several this round; every one should pass `structure_check` and ship 16:9 + 9:16 re-layouts. *Why first:* it is what the founder asked for, and it is the pack's largest gap against marketplaces.
2. **Cut-downs and aspects from one plan.** One CONFIG should render 6, 15, 30 and 60 s, and 16:9, 9:16 and 1:1, by re-timing sections against the beat sheet and re-laying out per aspect. No commercial product we read does this, and launch practitioners ask for 30, 15 and 6 s cut-downs of every film. `structures.json` now lists, per structure, the sections a 6, 15, 30 or 45 s cut keeps (`cutdowns`; the lists are our inference from the practitioner advice to fold the problem into the hook and drop the proof in a 30-45 s social cut). The renderer that re-times them is the gap.
3. **Hook variants with a measurement loop.** Render three hook variants on one body (story-script already writes them) as a batch, then log the 3 s hold and average view duration per variant (social-video's `log.md`). This replaces a *predicted* virality score with the user's *measured* one. Platform guidance supports it: TikTok advises 3-5 creatives per ad group, and YouTube's thumbnail tests are judged on watch-time share.
4. **The editable project file (lane 6).** One brand, text and media file drives every template. It is the open answer to brand kits and placeholder counts. Pair it with a typed slot schema an agent can fill and validate, plus a labelled placeholder for every empty slot.
5. **Real-footage helpers that stay honest.** A local transcription step that writes `words.json` (whisper, run by the user), plus a subject-aware 9:16 reframe from a supplied track or matte, never a generated person. This is the human-blended edit the founder asked for, and the largest AI-tool gap that fits the pack.
6. **Device and screen mockups for real recordings.** Phone, laptop and tablet frames in 2D and 3D, where the user's screen recording goes under the frame and is corner-pinned. This is table stakes in marketplaces; the pack has the pieces, and lane 2 extends them.
7. **Trailer and title-sequence card systems.** Date, pedigree and copy cards, a credit cascade timed one card per musical bar, a title on the final resolution, and the button. The beds and cut shapes already exist (`bed_trailer_arc`, `cuts/story/trailerArc`).
8. **Stems for the music beds.** Export drums, bass, pads and lead per bed so the mixer can drop a layer under a voice or make a planned gap without a new bed. Music libraries put stems behind paid plans; the pack can ship them CC0.
9. **Localised copy decks.** A per-language `text` block, with the text-density lint re-run per language: a German line is longer than its English source, and the 17 cps ceiling catches that. Captions in many languages are table stakes for AI tools.
10. **Batch and data-driven renders.** A loop over project files or a CSV of rows, with one plan, one render and one sheet per row. The pack has the CLI pieces; it needs a runner and a report.
11. **A cover and thumbnail module checked like the film.** One subject, at most 4 words, readable at 120 px. Score the cover and the first 30 s as one unit, because YouTube's intro checkpoint judges whether the opening matched the cover. frame-design already has the rules.
12. **Pace-shape checks.** Add Cutting's within-film shape to `structure_check`: long opening shots, shortening through the setup, the shortest in the climax, a longer end. A flat cut rate would raise a warning, never a failure.

**Out of scope on purpose:** stock libraries, avatars and voice cloning, lip-sync translation of real people, and interactive video. Each conflicts with the licence (no vendored third-party media) or the honesty rules (no generated people presented as real).

## What this round adds from lane 5

- `docs/research/launch-video-patterns.md` (the evidence)
- `patterns/` (structures, hooks, CTAs, lengths)
- `tools/structure_check.py` with tests and a mutation spec

Together they cover item 1's scoring and part of items 2, 3 and 12. The others are proposals for the next round's hunt queue.
