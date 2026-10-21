# Edit Grammar and Virality: research for the motion-pack

Date: 2026-10-13. Scope: transition taxonomy, short-form retention and virality patterns, ad structure, short-film grammar, mime-style/character-spot grammar, talking-head/human-edit grammar. Every recommendation names a component to build, its parameters and defaults.

## 0. How to read this document

Confidence tags used on every claim that came from outside:

- **[S] sourced, credible**: from a primary or well-established craft source (Walter Murch via multiple summaries; YouTube's ABCD playbook via a trade write-up; the section 10 character-spot campaign via trade press).
- **[P] practitioner rule of thumb**: blogs, agencies, freelancer pages. Plausible, widely repeated, not measured. Treat as a default to A/B, not a law.
- **[U] unverified**: a number or claim from a single vendor blog, with no method or primary source. Used only where it is the best available anchor, always flagged.
- **[H] house default**: our own engineering choice (frames, ms, px). Not from any source. Tune by eye. All "default" values in the component tables are [H] unless tagged otherwise.

Important honesty note: the 2026 short-form virality literature is almost entirely vendor blogs. Platforms do not publish hook-rate thresholds, and the numbers conflict between sources (3-second retention "must be" 60%, 65% or 70% depending on the blog). So this document commits to **mechanisms and structure** (which are consistent across sources) and treats **thresholds as tunable lint parameters** (the pack should ship a linter whose thresholds are config, not constants).

Fixed conventions for all components below:

- Primary timebase 30 fps (also run at 24 and 60). Durations are given in ms; frames shown at 30 fps. All components are pure functions of `t` (seek-safe, deterministic): any randomness comes from a seeded hash of `(seed, t_quantised)`, never `Math.random()`.
- Transition contract (our own, written from scratch; the *idea* of "two inputs plus progress 0..1" is the common pattern in GL Transitions, which we only read about, not vendor): `transition(from, to, p, params, ctx) -> color`, with `p` in [0,1] already eased by the host, `ctx = {res, ratio, seed, t}`.
- Namespacing used below: `cut.*`, `tx.*` (transitions), `sfx.*`, `cap.*` (captions), `cam.*` (punch-ins/pushes), `plan.*` (edit-plan data), `lint.*`, `tpl.*` (templates).

---

## 1. Governing principles (apply to every video type)

1. **Default to the hard cut. Motivate everything else.** Every source on cuts and transitions agrees: use a straight cut unless a transition adds meaning (a link between scenes, energy, jolting contrast, or an audio bridge) [P: Filmdaft, CapCut and VideoProc guides, see sources]. Component consequence: `plan.motivate()` in the planner refuses to place a `tx.*` unless the plan row carries a `reason` from the enum in section 2.
2. **Rank cut reasons the way Murch does.** Murch's Rule of Six, in priority order: emotion, story, rhythm, eye trace, 2D screen plane, 3D space of action. If you cannot satisfy all, sacrifice from the bottom; audiences forgive lower-order errors if the emotion is right [S: StudioBinder, NoFilmSchool, Musicbed summaries; primary is *In the Blink of an Eye*, not read directly]. Component consequence: the edit-plan row has fields `emotion, story, rhythm` (required), `eyeTrace` (optional anchor point), and `lint.eyeTrace` warns if the next shot's focal point is farther than 0.35 of frame diagonal from the previous focal point without a transition ([H] 0.35).
3. **Virality is three separate jobs**: (a) survive the first second (hook), (b) hold to the end and invite replay (retention, loop), (c) get sent to someone (share). Platform ranking summaries converge on: watch time and completion, early-retention, and for Instagram specifically "sends per reach" for reaching non-followers [P/U, see section 9]. Design a deliberate **send-worthy beat** in every piece (a "this is so you" or "show this to your team" moment), not just a hook.
4. **The edit is a rhythm of attention, not a clock.** Sources give "change something every 2-5 seconds" [P], but the stronger practitioner advice is to change the visual *at predictable attention-loss moments* (after a long sentence, at a topic switch, at a shot that has held 3+ s), and to ration interruptions because "when every sentence brings a zoom, flash, meme and whoosh, the interruptions become the pattern" [P: faceless.so, viberoll]. Component: an **interrupt budget** in `lint.pace` (section 6).
5. **Sound is half the cut.** Whoosh peaks on the cut frame, risers end on the hit, impact transients land on the highest-energy visual frame, tails clear the next line [P: Epidemic Sound guidance, Sonilo, ReelMind]. Every transition component ships with a paired SFX recipe. "SFX on every cut" is encoded as a lint rule, with an explicit exemption list (dialogue cuts, J/L cuts).
6. **Design for sound-off and sound-on.** Sound-on is dominant on YouTube (the ABCD write-up states 95% sound-on, [S] but second-hand) and reportedly on Reels ([U] ">80%"); TikTok write-ups say 88% consider sound vital ([U], vendor adaptation of TikTok material). So: full meaning must survive on mute (captions plus visual action), and be better with sound. Lint rule `audioOffTest`.
7. **Native beats polished for organic; polish wins for brand/launch.** TikTok's Creative Codes push creator-style, platform-native content (vertical, captions, voiceover, trends) [P: third-party write-ups of TikTok guidance]. Instagram reportedly favours original, human-made content and demotes reposts/aggregators in 2026 [U: one vendor, "40-60% less distribution", no method]. Rule: never ship the same file to three platforms with the other platform's watermark; export per-platform (section 8).

---

## 2. Transition taxonomy (when each serves the story, and what to build)

Format: **Story job** (when to use) / **Avoid when** / **Component + parameters + defaults** / **Paired SFX** / **Tags**.

Common params on all `tx.*`: `duration_ms`, `ease` (cubic-bezier), `seed`, `cutPoint` (progress at which the underlying shot swaps; the swap is hidden at the visually busiest frame of the effect), `hold_in_ms` / `hold_out_ms` (freeze padding so the shots do not move during the transition when set > 0).

Reason enum for `plan.motivate()`: `LINK` (match/graphic), `ENERGY` (whip, glitch, zoom-through), `CONTRAST` (smash), `TIME` (dissolve, dip, burn), `PLACE` (wipe, push), `BRIDGE_AUDIO` (J/L), `REVEAL` (mask, iris, light leak into product), `EMPHASIS` (flash, ramp, punch), `BEAT` (music hit).

### 2.1 Hard cut (the default)
- Story job: continuity, authority, speed. 90%+ of all cuts in an ad or documentary should be this. Cut on action (mid-motion), match direction and screen position [P].
- Avoid: when the two shots are near-identical framing of the same subject (that is a jump cut; fine in talking-head, jarring elsewhere).
- Component `cut.hard`: params `snapToBeat: true`, `beatGrid: bpm/offset`, `snapWindow_ms: 60`, `preRollFrames: 0`. Plan field `onAction: true` shifts the cut to the frame of max optical-flow magnitude within `±4` frames ([H]).
- SFX: none by default (`sfx.tick` optional 6 dB under music for logo/hit cuts). Tags: `cut, default, continuity`.

### 2.2 Match cut (graphic / action / concept)
- Story job: link two ideas by shape, motion or position; the visual rhyme *is* the meaning (a wheel into a clock, a hand reaching into a hand) [P: CapCut/Filmdaft]. Strongest for ads ("problem to product") and for short films (scene bridges).
- Avoid: when the match is accidental and the rhyme says nothing; do not use more than one per 15 s.
- Component `tx.match`: it is a *camera-solve helper*, not a shader. Inputs: `anchorA {x,y,scale,rot}`, `anchorB {x,y,scale,rot}` (normalised, from plan or auto-detected). It pre-moves the outgoing shot over the final `lead_ms=300` and post-moves the incoming over `settle_ms=300` so anchors coincide at the cut frame (similarity transform, ease `outCubic` in, `inCubic` out); optional `matchBlur: true` adds identical motion blur on both sides (6 subsamples, 180 degree shutter).
- SFX: shared sustained tone/hit across the cut (sound bridge), `sfx.impactSoft` on frame of cut at -6 dB vs music. Tags: `match, link, concept, camera`.

### 2.3 J-cut and L-cut
- Story job: smooth scene bridges; J (next audio leads) builds anticipation, L (previous audio lingers) lets a reaction/dialogue overlap new picture [P/S: multiple]. Primary tool for short film, interviews, talking-head with B-roll, and anywhere a visual hard cut should not feel abrupt.
- Avoid: in 6-15 s ads where audio is a single music bed; it adds nothing.
- Component `cut.split` (`mode: 'J'|'L'`): `audioLead_ms: 400` (range 200-800), `audioTail_ms: 600` for L, `crossfade_ms: 80` on the audio edge to avoid clicks, `ambienceBridge: true` (carry a room-tone loop 1.5 s across). Implemented as per-track in/out offsets in `plan` (picture and audio cut times are separate columns).
- SFX: none, it is a dialogue/ambience technique. Tags: `jcut, lcut, audio-bridge, dialogue, film`.

### 2.4 Whip pan
- Story job: kinetic scene/location change; energy. Ideal in montage, travel, "from chaos to order", feature-to-feature in a product demo [P].
- Avoid: serious/slow tone; more than 3 in a row in a premium piece.
- Component `tx.whip`: `duration_ms: 300` (9 f), `direction: 'left'|'right'|'up'|'down'` (alternate by default so consecutive whips alternate), `blurMax: 0.08` (fraction of frame width, directional box/gaussian with 12 samples, peak at p=0.5), `ease: cubic-bezier(.7,0,.3,1)`, `cutPoint: 0.5`, `chroma_px: 2`, `overshoot: 0` (premium), `0.02` (playful). Both shots translate by 1.0 frame width; seam mapped to the blur peak. Match the whip direction to the incoming action vector when `plan.exitDir`/`entryDir` are provided.
- SFX: `sfx.whoosh` 300 ms, noise bandpass sweep 250 Hz to 6 kHz, peak aligned to the cut frame (see 5.2). Tags: `whip, energy, montage, directional-blur`.

### 2.5 Smash cut
- Story job: comedy, shock, irony: abrupt hard cut between sharply contrasting scenes (loud/quiet, chaos/calm) [P: Filmdaft]. Also the "problem to solved" snap in ads and the punchline in mime-style spots.
- Avoid: when contrast is weak (it just looks like a cut).
- Component `cut.smash`: `preSilence_ms: 200` (music and ambience duck to -inf before cut, 4 ms ramp), `contrastLoudness_dB: 12` minimum jump, `contrastLuma: 0.4` minimum mean-luma delta (lint enforces), `postImpact: true`. Hold last frame of outgoing shot for `holdA_ms: 0-100`, no easing.
- SFX: silence then `sfx.impactHard` (sine drop 120 to 40 Hz in 180 ms plus 60 ms noise burst) or comedic `sfx.sting`. Tags: `smash, comedy, contrast, hard`.

### 2.6 Morph / shape-to-shape
- Story job: transform one object into another (logo to UI, face to icon, product A to B). A "this becomes that" idea.
- Avoid: when objects have no shared silhouette; use mask reveal.
- Component `tx.morph`: SDF/displacement based, `duration_ms: 600`, `warpStrength: 0.35`, `ease: inOutCubic`, `featherPx: 6`, `useAlphaA/B: true` (works on alpha-matted objects, not full frames), `holdMid_ms: 0`. Implementation note: displace both layers along the gradient of the *other* layer's alpha for a cheap, deterministic morph; no optical flow needed.
- SFX: `sfx.morphWarble` (sine FM 300 to 900 Hz, index 6 to 1) plus `sfx.pop` at p=0.9. Tags: `morph, logo, object, alpha`.

### 2.7 Luma wipe and shape wipes (iris, circle, diamond, star)
- Story job: graphic punctuation, scene change inside designed motion graphics; iris-in on a subject for a reveal or on a detail for a "look closer" (iris also historically signals playfulness).
- Avoid: over-use; reads dated unless the shape means something.
- Component `tx.lumaWipe`: `duration_ms: 500`, `matte: 'linear'|'radial'|'noise'|'text'|'image'` (matte is procedural by default), `softness: 0.15`, `direction_deg: 0`, `invert: false`, `ease: inOutQuad`. Component `tx.iris`: `duration_ms: 450`, `shape: 'circle'|'diamond'|'star'|'rounded-rect'`, `center: [0.5,0.5]` (set to the subject), `softness: 0.02`, `overscan: 1.2`.
- SFX: `sfx.swish` (shorter, higher than whoosh, 3 to 9 kHz sweep, 200 ms). Tags: `wipe, luma, iris, graphic, matte`.

### 2.8 Light leak
- Story job: warm, nostalgic, "film" feel; also a cheap high-gloss hide-the-cut for lifestyle/brand pieces and lyric/music edits.
- Avoid: tech/clinical products; cold brand palettes.
- Component `tx.lightLeak`: `duration_ms: 700` (21 f), `palette: ['#ff7a1a','#ff2d6f','#ffd27a']`, `blobs: 3`, `intensity: 0.9`, `blend: 'screen'`, `peak: 0.5`, `cutPoint: 0.5` (swap at peak where frame is near-white), `drift_px_s: 160`, `grain: 0.08`. All blobs are soft radial gradients with animated centres from `seed`.
- SFX: `sfx.airSwell` (filtered noise swell, 700 ms, lowpass 800 Hz to 5 kHz) with soft `sfx.shimmer`. Tags: `leak, warm, nostalgia, screen-blend`.

### 2.9 Film burn
- Story job: time passing, memory, "reel ends/begins", analog rawness; strong in short films and music pieces; also reads as "rewind to the past".
- Avoid: modern UI/SaaS demos unless the concept is retro.
- Component `tx.filmBurn`: `duration_ms: 800` (24 f), `edge: 'noise-threshold'` (burn front advancing across frame, threshold from fbm), `core: '#fff4d6'`, `rim: '#ff5a00'`, `char: '#2a0d00'`, `gateFlicker_hz: 24`, `grain: 0.12`, `cutPoint: 0.5`, `sprocketWeave_px: 3`.
- SFX: `sfx.projectorSnap` (short click plus 24 Hz flutter), `sfx.crackle`. Tags: `burn, analog, film, time, grain`.

### 2.10 Glitch
- Story job: tech/cyber, disruption, "something broke", pattern interrupt for hooks; also a comedic stutter.
- Avoid: calm premium pieces; do not stack on every cut.
- Component `tx.glitch`: `duration_ms: 250` (8 f), `rgbSplit: 0.02` (fraction of width, peak at p=0.5), `slices: 8`, `sliceShift: 0.06`, `scanlines: 0.2`, `stutterFrames: 2` (repeat the same source frame twice), `seed: 1`, `quantiseFps: 12` (glitch parameters update at 12 Hz so it looks stuttery and is deterministic).
- SFX: `sfx.glitch` (bit-crushed noise bursts, 4-bit, 8 kHz sample-rate-reduction, 3 bursts in 250 ms). Tags: `glitch, rgb-split, cyber, interrupt`.

### 2.11 Zoom-through
- Story job: travelling "into" something (a screen, an eye, a doorway, a letter "O"); product-in-UI walkthroughs; "dive in" metaphors.
- Avoid: when neither shot has a natural aperture/dark centre: the cut will look like a plain scale.
- Component `tx.zoomThrough`: `duration_ms: 500`, `scaleOut: 3.5` (outgoing, `inExpo`), `scaleIn: 0.35` (incoming, `outExpo`), `radialBlur: 0.5`, `center: [0.5,0.5]` (set to the aperture), `cutPoint: 0.48`, `crossfadeBand: [0.45,0.55]`, `shake: 0.004`.
- SFX: `sfx.sweepUp` (pitch rises 120 to 800 Hz) then `sfx.thud` at cut. Tags: `zoom, dive, aperture, radial-blur`.

### 2.12 Shutter / flash
- Story job: emphasis beat, camera-click "capture" moment, a hard visual comma on the music hit. Works as a pattern interrupt.
- Avoid: photosensitivity: cap flashes. Rule: no more than 3 full-frame flashes per second, ever, and `maxLumaStep` below 0.7 of frame for prolonged sequences ([H], WCAG-style caution; verify against guidelines before relying on it).
- Component `tx.flash`: `duration_ms: 120` (4 f), `attack_f: 1`, `peak: 1.0` (or `0.7` safe mode), `decay_f: 3`, `color: '#ffffff'`, `cutPoint: 0.25`.
- SFX: `sfx.shutter` (two clicks, 12 ms apart, plus 40 ms lowpass thump) or `sfx.pop`. Tags: `flash, shutter, beat, emphasis`.

### 2.13 Ink / liquid
- Story job: organic, premium, beverage/beauty/ceramics; "spill" reveal of the next scene; also artistic title reveals.
- Avoid: hard-tech products.
- Component `tx.ink`: `duration_ms: 900`, `source: 'point'|'edge'|'noise'`, `viscosity: 0.6`, `flow` from an advected threshold field (fbm domain-warped, 4 octaves, `warp: 0.4`), `edgeSoft: 0.05`, `edgeTint: brand color` at 12% on the leading edge, `ease: inOutCubic`.
- SFX: `sfx.liquidSwell` (resonant bandpass noise 400 Hz to 1.2 kHz, plus bubble clicks, 6 per second decaying). Tags: `ink, liquid, organic, premium`.

### 2.14 Mask reveal (text/shape/object mask)
- Story job: reveal the next shot *through* an element: title card knockout, a logo, a foreground object (person walking in front of lens, the "occluder" or "object wipe"). One of the most reliable invisible-cut techniques in ad work.
- Component `tx.maskReveal`: `duration_ms: 600`, `mask: 'text'|'shape'|'alpha-layer'`, `scaleFrom: 1.0`, `scaleTo: 40` (mask scales up to flood the frame; ease `inExpo`), `anchor: [0.5,0.5]`, `invert: false`, `trailBlur: 0.01`.
- SFX: `sfx.whoosh` short plus `sfx.thud` on swap. Tags: `mask, reveal, text-knockout, occluder, object-wipe`.

### 2.15 Speed ramp
- Story job: put weight on a hit, anticipate a reveal, or carry action; the slowest frame lands on the beat [P].
- Component `cam.speedRamp` (retime): keyframes `[{t:-250ms, rate:1}, {t:0, rate:0.3}, {t:+150ms, rate:0.3}, {t:+250ms, rate:1.5}, {t:+550ms, rate:1.0}]` ([H] default, eased `inOutCubic` between keys). Deterministic motion blur via sub-frame accumulation: `subsamples: 6`, `shutter: 180` degrees, `frameBlend: 'optical-flow-lite'|'blend'` (blend is default for owned-code simplicity). Output `timeMap(t)` monotonic, with `reverse: false`.
- SFX: ramp-in pitch-down of the music bed (`playbackRate` follows rate for 250 ms with a `lowpass 800 Hz`) plus `sfx.impactHard` on the slowest frame. Tags: `ramp, retime, slowmo, impact`.

### 2.16 Supporting transitions to include (small, cheap, frequently needed)
- `tx.dissolve` (`duration_ms: 400`; for time passing `1000`; ease inOutQuad); `tx.dipToBlack` (`out 300 + hold 100 + in 300`); `tx.push/slide` (`duration_ms: 350`, `ease: cubic-bezier(.2,.8,.2,1)`, `parallax: 0.15`); `tx.freezeHold` (`hold_ms: 400`, last frame desaturates 30% and vignettes: "beat of stillness" before a CTA); `tx.scalePunch` (cut with 1.0 to 1.08 scale-in over 5 f on the incoming shot: the cheapest energy cut); `tx.blurCross` (gaussian blur up to 24 px at mid, `duration_ms: 350`: soft hide of cut inside UI demos).

### 2.17 Choosing a transition: decision table (encode as `plan.suggestTransition(prev, next, ctx)`)

| Situation | Pick | Never |
|---|---|---|
| Same scene, same subject, different angle | `cut.hard` | any transition |
| Two things share a shape/motion/position | `tx.match` | whip |
| Dialogue or VO continues across a visual change | `cut.split` | dissolve |
| Montage, place change, high energy music | `tx.whip` / `tx.scalePunch` | light leak |
| Comedy beat or tonal whiplash | `cut.smash` | any soft transition |
| Time passing / memory | `tx.dissolve` long, `tx.filmBurn`, `tx.lightLeak` | glitch |
| "This becomes that" | `tx.morph` | wipe |
| Into a screen / eye / hole | `tx.zoomThrough` | whip |
| Music hit, emphasis | `tx.flash`, `cam.speedRamp`, `cut.hard` on beat | long dissolve |
| Brand/lifestyle sensuality | `tx.ink`, `tx.lightLeak` | glitch |
| Tech, disruption, hook interrupt | `tx.glitch`, `tx.whip` | ink |
| Reveal from a foreground element | `tx.maskReveal` | none |

---

## 3. Short-form virality and retention: the edit patterns

### 3.1 What is solid vs what is guesswork
- Solid across sources [P]: the opening 1-3 seconds decide whether the viewer stays; open loops (promise a payoff that has not yet arrived) work; lead with payoff not preamble; remove logo bumpers and slow intros; layer the hook (visual, spoken and on-screen text say the same thing); change something visually every ~3-5 s, targeted at attention-loss points; captions for mute; test hook variants on the same content.
- Conflicting numbers [U]: viewers decide in about 1.2 s (one vendor, Reels), 2 s (Shorts), 3 s (TikTok/Reels); 3-second retention thresholds of 60%/65%/70%; 50-60% of drop-offs occur in the first 3 s ("data from thousands of Shorts", no method); captions give 15-25% higher retention (no method); hook rate = 3-second views / impressions with 30-35% cited as healthy (no official thresholds). None are platform-confirmed.
- Platform facts that *are* well-supported: since 2025-03-31 YouTube Shorts counts a view on start or replay with no minimum watch; "engaged views" (the old stricter number) still drives monetisation [S: MediaPost, Brandwatch, Pixability, RouteNote]. Implication: the first-frame hook and loopability now affect *view count* directly on Shorts.

Component implication: the pack ships `lint.retention` with thresholds in `config/platform-presets.json`, and a `hook-rate` worksheet template for logging results per hook variant (your own analytics are the only real source of truth).

### 3.2 The hook: seven archetypes as components
Each is a template `tpl.hook.<name>` with timing for 0-3 s. Common hard rules (lint-enforced): frame 0 is not black or a logo; first visible motion by frame 6 (200 ms); on-screen hook text appears by frame 9 (300 ms) and is at most 7 words ([H]); hook text, VO and picture say the same idea (layered hook [P]); no more than 1 camera/layout move in the first 1.0 s.

| id | Pattern | 0-3 s shot plan | Params (defaults) |
|---|---|---|---|
| `payoff-first` | show the end result first, then rewind | 0-1.2 s result close-up, 1.2-1.5 s `tx.flash` or `cam.speedRamp` rewind, then setup | `rewindFx: 'flash'`, `resultHold_ms: 1000` |
| `pattern-break` | visually odd/absurd frame | extreme close-up or impossible scale; 3 shots in 3 s | `shots: 3`, `ASL_s: 1.0` |
| `claim-or-question` | bold on-screen text plus VO | kinetic text word-by-word on the beat | `textStyle: 'cap.impact'`, `maxWords: 7` |
| `in-medias-res` | start mid-action/mid-problem | cut-in at the moment of failure; whip into setup | `tx: 'whip'` |
| `curiosity-gap` | hide the key object, tease | blurred/partial reveal, crop-in, bar of progress | `blurTo_px: 24 -> 0 over 2.5 s` or `maskReveal` |
| `social-proof` | number or quote on-screen | number counter plus face/UI | `counter_ms: 900` |
| `problem-agitate` | pain, exaggerated | quick 3-cut escalation, last cut `cut.smash` to the product | `cuts: 3`, `escalate: true` |

For paid YouTube specifically, the ABCD playbook (developed with Ipsos, reviewed by Nielsen Neuro and Kantar; second-hand through ppc.land) says [S, second-hand]: use multiple shots within the first five seconds, tight framing, surprising visuals, feature people early, introduce brand or logo within five seconds (ideally said aloud by on-screen people, or woven into the product), build tension then release, and use specific CTA phrases ("Buy now", "Visit site"). Stated lift: +30% short-term sales likelihood, +17% long-term brand contribution (as claimed by the playbook; we have not verified the underlying study). **Conflict to resolve by test**: TikTok-oriented agencies advise "minimal branding in the first 5 s" [P]. Pack default: organic TikTok/Reels = brand cue after the hook (>3 s) but before 7 s; paid YouTube = brand cue inside 5 s; expose as `brandCueBy_s` in presets.

### 3.3 Pattern interrupts: the interrupt ladder (component `plan.interrupts`)
Ranking by intensity so we can ration them (lint fails if two level-3 interrupts occur within 1.5 s, or if the average interrupt level rises for 4 consecutive windows, i.e. fatigue):

- Level 1 (minor, every 1.5-3 s): `cam.punchIn` 1.0 to 1.12, caption emphasis, cut to a new angle, small `tx.scalePunch`.
- Level 2 (medium, every ~4-6 s): B-roll insert, text card, `tx.whip`, zoom-out reveal, a new colour field.
- Level 3 (major, every ~8-12 s, max 1 per 6 s): `cut.smash`, `tx.glitch`, `tx.flash` plus music drop, format switch (screen-record to character).
Defaults ([H], reconciling the "every 2-4 s" [U] and "3-5 s" [P] claims): `minorEvery_s: 2.5`, `mediumEvery_s: 5`, `majorEvery_s: 9`, `jitter: 0.25` (so intervals are not metronomic).

### 3.4 Retention structure of a 20-35 s short (template `tpl.short.retention`)
- 0-3 s hook (section 3.2). 3-6 s "why stay" promise (open loop: "wait for the third one"). Middle: 2-4 beats, each with a micro-payoff, each beat introduced by an interrupt of level >= 2. Final 20% = best payoff (so retention stays high into the end). Last 1-2 s = loop seam or CTA (see 3.5, 3.6).
- Length per platform, with the honesty caveat (these are [U]/[P], from vendor posts): Shorts: 15-35 s sweet spot claimed ([U], "80%+ retention" with no method), lengths up to 3 min reported supported but unverified; Reels: up to 3 min reported ([U]); TikTok: write-ups say short is safer; ad close-to-final structure hook/body/close ([P] from TikTok Creative Codes summary). Default: organic hero 20-35 s, ad 15-30 s, with always a 6 s bumper cutdown and a 9:16 / 1:1 / 16:9 export set. Rule from the Shorts retention advice: if the retention graph shows a dip at the very end, trim the last 1-2 s [P].

### 3.5 Loops
- Replays count as views on Shorts since March 2025 [S]. A seamless loop is therefore directly worth more there. Loop failure points are: subject position, camera angle, motion direction, lighting, background and audio [P: CapCut guide]; audio is the commonest killer (hard-cut music, VO that stops).
- Three loop designs as templates:
  1. **State-return loop** (`tpl.loop.state`): last frame == first frame (same pose/position). Cheap with generated scenes because everything is a function of `t`: `scene(t) = scene(t mod T)`.
  2. **Reveal-to-hook loop** (`tpl.loop.reveal`): the last line completes the sentence that the first line starts ("...and that is why" / starts "I stopped using paper"). Needs VO design, not just picture.
  3. **Ping-pong** (`tpl.loop.pingpong`): forward-reverse-forward, for cyclical motion; fallback when you cannot match.
- Component `lint.loop`: `ssimFirstLast >= 0.92` ([H]), audio RMS delta at the seam < 3 dB, spectral flux of the last 200 ms vs first 200 ms below a threshold, and `seamCrossfade_ms: 120` on audio only.

### 3.6 CTA placement
- Structure: hook, body, close with strong CTA (TikTok Creative Codes summary [P]); ABCD "Direct" says use clear text cards/animation/VO with specific phrases and urgency [S]. Do not burn the CTA where platform UI will cover it: keep CTAs in the centre band, and rely on the platform's CTA button for the actual link [P: confect, benly].
- Safe zones for 9:16 (sources conflict [U]; use the union of the most conservative values as default): top 14%, bottom 35%, sides 6% (so on 1080x1920: top 269 px, bottom 672 px, sides 65 px). Text and CTAs live in `y in [270, 1248]`, `x in [65, 1015]` by this source alone; the pack's `conservative` union in `type/safezones.js` also takes the other source's 120 px right margin, giving `x in [65, 960]`.
- Defaults (`tpl.cta.*`): **soft CTA** at 60-70% of the runtime (verbal/lower-third, "follow for part 2" / "try it free"), **hard CTA** end card in the last 2.5 s (`endCardHold_ms: 1800` after the last motion settles; 15 s ad: last 2.0 s). On a loop, replace the end card with an unobtrusive "tag" (logo watermark `opacity: 0.8`, bottom-right outside the bottom 35% zone) so the loop is preserved.
- Send-worthy beat: place one deliberate "share moment" in the final third that names an audience ("send this to your co-founder who still uses spreadsheets"). Instagram write-ups say sends-per-reach is the key non-follower distribution signal ("3-5x the weight of likes", vendor claim [U]); the *direction* is consistent across sources, the multiplier is not verified.

---

## 4. Ad structure: hook, problem, product, proof, CTA

Component: `tpl.ad.hppp` (hook, problem, product, proof, CTA). Follows the common launch-film arc (hook, tease, reveal, montage, end card) and maps to ABCD (Attract, Brand, Connect, Direct). Section shares are [H], derived from that launch arc and ABCD.

| Block | Job | ABCD | 15 s | 30 s | 45 s | Typical cuts | Required elements |
|---|---|---|---|---|---|---|---|
| Hook | stop the scroll | Attract | 0-2.5 | 0-3 | 0-3 | 2-3 | archetype from 3.2; frame 0 is a strong image |
| Problem | create tension/relatable pain | Connect | 2.5-5 | 3-8 | 3-11 | 2-4 | person or character; one pain, not three |
| Product | the reveal and the "how" | Brand | 5-9 | 8-16 | 11-24 | 4-7 | product visible within 5 s (YouTube) or by 7 s (organic); one benefit per shot |
| Proof | demonstrate it works | Connect | 9-12.5 | 16-25 | 24-37 | 3-6 | real number, real UI, real testimonial; no invented stats |
| CTA | tell them what to do | Direct | 12.5-15 | 25-30 | 37-45 | 1-2 | specific phrase, end card, URL/button, urgency only if true |

Rules ([H] on defaults; [S] where from ABCD):
- ASL (average shot length): 1.2-2.0 s for 15 s; 1.5-2.5 s for 30 s; allow one 3-4 s "hero shot" for the product reveal (the reveal needs a hold).
- Shot budget: 15 s => 8-10 shots; 30 s => 14-20; 45 s => 20-28.
- Music: lock the music first, cut to it; the reveal lands on the drop. Use `plan.snapToBeat`.
- Proof must be real. `lint.proof` rejects numeric claims that do not carry a `source` field in the plan row (no fabricated stats, quotes or reviews).
- Three variants per brief (`tpl.ad.variants`): vary only the hook (3 archetypes), keep body identical, so tests are clean [P: "test several hooks on the same core content"].
- Bumper (6 s): `hook+product+logo`: 0-2 hook, 2-4.5 product, 4.5-6 end card.
- Objective variants from ABCD [S]: awareness adds music, SFX, repeated brand touchpoints, people; consideration adds beauty shots, use-in-context, urgent CTA; action makes the product the hero throughout, specific benefits, offers. Expose as `objective: 'awareness'|'consideration'|'action'` which toggles `brandTouches: 3|2|4`, `beautyShots: true|true|false`, `offerCard: false|false|true`.

---

## 5. Sound grammar for edits (what every cut needs)

### 5.1 SFX on every cut: the rule and its exceptions
- Rule: every cut that carries a `tx.*`, a `cam.punchIn` or a `plan.reason in {EMPHASIS, BEAT, CONTRAST, ENERGY}` has a paired cue. Exempt: dialogue cuts, `cut.split` (J/L), hard cuts that sit on a music beat (the beat is the sound), and the first/last 300 ms of a loop (loop seam). `lint.sfxCoverage` target: >= 80% of non-exempt cuts have a cue ([H]).
- Reserve the largest/longest cue for the largest movement; level-match variants before comparing, since louder sounds "better" [P: Sonilo].

### 5.2 Placement math (component `sfx.place`)
- Whoosh: peak on the cut frame, so `startTime = cutTime - peakOffset` where `peakOffset` is the cue's measured peak time (sfx files in the pack ship `peak_ms` metadata). Default `peakOffset_ms` for the 300 ms whoosh = 150.
- Riser: ends on the hit; `startTime = hitTime - riserLength`; the hit is an impact placed on the frame of the visual change (not before). Default riser lengths: 0.5, 1, 2, 4 s.
- Impact: transient aligned with the highest-energy visual frame; allow `+0 to +1 frame` late (sound may trail picture by one frame; never lead picture for impacts).
- Tail: `release_ms` so the tail is below -40 dB by the next line's first syllable; auto-duck: `duckMusic: -4 dB for cue duration + 100 ms` when a cue exceeds -18 dBFS.
- Sync rule: "a transition that lands a frame late reads as a mistake" [P]; ship `lint.sfxSync` that cross-correlates the cue's transient with the picture event frame and flags offsets above 1 frame at the working fps.

### 5.3 Synthesised SFX recipes (all ours, numpy or Web Audio; no samples)
Each cue is a function `render(sr, seed, params) -> Float32Array` with measured LUFS and true peak recorded in `sfx/manifest.json`.

| id | Recipe | Defaults |
|---|---|---|
| `sfx.whoosh` | white noise to bandpass (Q 0.9) sweeping 250 to 6000 Hz exponentially; amplitude envelope attack 40% / release 60% | `len_ms: 300`, `peak_ms: 150`, `stereo: pan -0.6 to +0.6` |
| `sfx.swish` | as whoosh but 3 to 9 kHz, shorter | `len_ms: 200` |
| `sfx.impactHard` | sine drop 120 to 40 Hz in 180 ms plus 60 ms noise burst lowpass 2 kHz, plus soft clip | `len_ms: 700`, `tail: lowpass 300 Hz` |
| `sfx.impactSoft` | same, -6 dB, no noise burst | `len_ms: 500` |
| `sfx.riser` | saw/noise sum, lowpass cutoff 200 Hz to 8 kHz exp, pitch up 1 octave, amplitude up | `len_ms: 1000 (0.5/2/4 variants)` |
| `sfx.glitch` | bit-crushed noise bursts (4-bit, sample-rate reduction to 8 kHz), 3 bursts | `len_ms: 250` |
| `sfx.shutter` | two clicks 12 ms apart (5 ms noise, bandpass 3 kHz), plus 40 ms lowpass thump | `len_ms: 120` |
| `sfx.pop` | sine 600 to 200 Hz in 60 ms, fast decay | `len_ms: 120` |
| `sfx.projectorSnap` | click plus 24 Hz amplitude flutter 300 ms | `len_ms: 400` |
| `sfx.airSwell` | filtered noise swell, lowpass 800 Hz to 5 kHz | `len_ms: 700` |
| `sfx.sting` | comedic 3-note brass-like FM stab | `len_ms: 500` |
| `sfx.typing` | 5 ms noise ticks at jittered 12/s | for caption pops |

Mix defaults ([H], ties to existing house practice of -14 LUFS and the HyperFrames true-peak guard): dialogue/VO at -16 LUFS short-term, music bed -24 to -20 LUFS under VO, SFX peak -12 to -18 dBFS under VO and up to -6 dBFS in music-only passages; master -14 LUFS integrated, true peak <= -1 dBTP. Reuse one shared loudness/true-peak meter and the `mix.py` oversampled limiter pattern; do not rewrite.

---

## 6. Pace, rhythm and the linter

### 6.1 Pace targets by format ([H], informed by [P] ranges)
| Format | ASL (s) | Shots per 30 s | Interrupt cadence |
|---|---|---|---|
| Hype ad / launch film | 1.2-2.0 | 15-24 | minor 1.5 s, medium 4 s, major 9 s |
| Music/beat edit | 1 beat to 2 beats (0.4-1.0 s at 120-150 BPM), 4 beats in verses | 30-60 | on the grid |
| Talking head (retention edit) | 2.5-5 s, cut per sentence/clause | 6-12 | punch-in per sentence, B-roll per idea |
| Mime-style spot | 2-3 s with 1.5 s reaction holds | 8-12 | one gag build, one payoff |
| Short film | 4-8 s, longer holds for emotion | 4-8 | none (emotion-motivated) |

### 6.2 Component `lint.pace` / `lint.retention` rules (all thresholds in config)
R1 frame 0 not black/logo. R2 first on-screen text by 0.3 s (when format needs text). R3 >= 3 shots or 3 distinct visual states in the first 5 s for ads (ABCD). R4 max static interval (no visual change and no audio accent) <= 3.5 s for short-form. R5 SFX coverage >= 80% (5.1). R6 captions within safe zone. R7 caption density: <= 4 words visible, <= 3.3 words/s average. R8 CTA present in last 3 s and inside safe zone. R9 loudness -14 +/- 1 LUFS, TP <= -1 dBTP. R10 loop seam (3.5). R11 duration within preset. R12 `brandCueBy_s` honoured. R13 interrupt fatigue (3.3). R14 `audioOffTest`: every VO sentence has a caption. R15 flash safety (2.12). R16 every claim in `proof` has `source`. R17 `eyeTrace` focal-jump (section 1). R18 duplicate-shot guard (same asset used > 2 times in 15 s unless `intentional`).

---

## 7. Captions, punch-ins and the human-edit toolkit

Separate captioning and talking-head tools (not included in this pack) cover the heavy parts; the pack only adds **deterministic components and defaults**, and wires them to the lint rules.

### 7.1 Captions (`cap.*`)
- Chunking [P]: 2-4 words visible at once; the active word highlighted; captions double as a pacing guide because the timestamped transcript exposes every gap and long line.
- `cap.chunk` params: `maxWords: 4`, `maxChars: 22`, `minHold_ms: 350`, `leadFrames: 2` (caption appears 2 frames before the word is spoken), `breakOn: ['.', ',', '?', 'pause>250ms']`.
- `cap.impact` (the default 9:16 style): font weight 800-900, `size: 6.5%` of frame height (about 125 px on 1920), `strokeWidth: 8%` of size, `maxLines: 2`, `lineHeight: 1.05`, `align: center`, `y: 56%` of frame height (centre band; above the bottom 35% zone, below the top 14%), `popIn: scale 0.85 to 1.06 to 1.0 over 140 ms (outBack)`, `activeColor: brand accent`, `inactiveColor: #ffffff`, `shadow: 0 4px 0 rgba(0,0,0,.35)`.
- `cap.emph`: emphasis words get 1.15x scale, accent colour and a `sfx.pop` at -18 dBFS; max 1 per sentence.
- `cap.karaoke` (music lyric edits): word fill left-to-right on the beat, `fillEase: linear`.

### 7.2 Talking-head and human edit grammar
Mostly [P]; all numbers are starting points to test with retention graphs.
- **Jump-cut hygiene**: cut silences > 0.5 s between sentences; > ~2 s inside a sentence (the second is looser) [P: Jupitrr, Viberoll, faceless.so]. Component `th.autocut`: `silenceMin_ms: 500`, `breathKeep_ms: 120` (keep a short breath so speech does not sound clipped), `fillerList: ['um','uh','like','you know']`, `padBefore_ms: 60`, `padAfter_ms: 90`, `crossfade_ms: 6` (audio edge). Output an EDL/JSON `plan`; rendering is by the host.
- **Alternating framing to disguise jump cuts** [G: widespread editor practice, not from the cited sources]: `cam.reframeAlternate` toggles `scale: 1.0 / 1.15 / 1.0 / 1.25` on each jump cut, anchored on the eyes (`anchor: [0.5, 0.38]`), so cuts look intentional. Avoid cutting between very different framings without B-roll [P].
- **Punch-ins** (`cam.punchIn`): `scaleTo: 1.12`, `inDuration_ms: 140` (outBack/outCubic), `holdUntil: nextCut`, `max: 1 per 4 s`, reserved for key claims and predictable dips [P]. Slow push for static shots held > 4 s: `cam.push` `1.00 to 1.06` over the shot, `ease: linear`.
- **B-roll cadence**: heavy talking-head edits use B-roll for roughly half the runtime [P]; ours: `broll.coverage: 0.35-0.5`, insert at each idea change, `insertLength_s: 1.2-3.0`, `lead_ms: 150` (B-roll picture begins slightly before the VO line it illustrates: a micro J-cut), first B-roll no earlier than 2.0 s (let the face establish trust), prefer *specific* B-roll over generic (close-up of the exact action described) [P]. In our no-stock world, B-roll = generated or screen-recorded UI, kinetic text cards, diagram cards, and three.js product shots from the kit.
- **Silence is a weapon**: hold 400-600 ms after a punchline with the face still (reaction), then cut. Component `th.beatHold` `hold_ms: 450`.
- **Layering order** [P: "punch-ins are one of the last layers"]: 1 cut silences, 2 captions, 3 B-roll, 4 punch-ins, 5 music, 6 SFX, 7 grade. `plan.pipeline` enforces the order so that later layers do not drift when earlier ones change.

---

## 8. Platform presets (`config/platform-presets.json`; every number tunable)

| Preset | Aspect | Length target | Safe zone (top/bottom/side %) | Hook text by | `brandCueBy_s` | Loudness | Notes |
|---|---|---|---|---|---|---|---|
| `tiktok.organic` | 9:16 | 15-35 s | 14 / 35 / 6 | 0.3 s | 5 | -14 LUFS | native, captions, trend-friendly; loop welcome |
| `reels.organic` | 9:16 | 15-35 s (3 min reported [U]) | 14 / 35 / 6 | 0.3 s | 6 | -14 LUFS | sends-per-reach beat; original content only [U] |
| `shorts.organic` | 9:16 | 15-35 s (up to 3 min reported [U]) | 14 / 35 / 6 | 0.3 s | 6 | -14 LUFS | replay counts as view [S]; loop design |
| `yt.ad.15` / `yt.bumper.6` | 16:9 or 9:16 | 15 s / 6 s | n/a / 9:16 as above | 0.5 s | **5** (ABCD) | -14 LUFS | multiple shots in first 5 s [S] |
| `meta.ad.9x16` | 9:16 | 15-30 s | 14 / 35 / 6 | 0.3 s | 5 | -14 LUFS | CTA via platform button, not burned |
| `x.video` | 16:9 / 1:1 | 20-45 s | n/a | 0.5 s | 7 | -14 LUFS | house brand colour |
| `linkedin.video` | 1:1 / 4:5 | 30-60 s | n/a | captions mandatory | 7 | -14 LUFS | mute-first |
| `hero.web` | 16:9 | 20-45 s | n/a | n/a | n/a | -16 LUFS | loop-able, autoplay muted |

Export rule: render the master 16:9 and re-layout (not just crop) for 9:16 and 1:1 using per-aspect safe-area maps.

---

## 9. Short-film grammar (`tpl.film.*`)

Sources are weak here (blogs and lecture notes, [P]); the structure below is craft convention plus the Murch hierarchy.

- **One idea, one throughline.** Under ~10 min there is room for one major shift; under 5 min, essentially one beat of change [P]. Page-to-minute heuristic: 1 script page is about 1 minute [P]. Four fitting shapes: moment of change, ironic reveal/reversal, poetic metaphor, build-up [P]. Ironic reversal needs the misdirection planted fast.
- **Template `tpl.film.3min`** (percent of runtime; [H]): 0-8% cold open image (a question, not exposition); 8-25% world and want; 25-50% pressure (one obstacle only); 50-60% turn (the reveal/reversal); 60-85% consequence; 85-95% resolution image; 95-100% credit tag (<= 6 s, never a long end-roll). 60 s variant: collapse to hook, want, turn, button.
- **Shot-scale ladder** (`plan.scaleLadder`): establish (wide), connect (medium), feel (close-up), detail (insert). Move from wide to tight as emotion rises; break the pattern on the turn (sudden wide or sudden detail). Lint: no more than 3 same-scale shots in a row unless `intentional`.
- **Transitions**: default hard cut; dissolve (1000 ms) for time; J/L cuts for scene bridges (`audioLead_ms: 600`); `tx.filmBurn` or `tx.lightLeak` only for memory or a tonal break; no glitch or whip unless the story is about that energy. Pacing is emotion-led: hold shots until the emotion lands, then 6-12 frames longer.
- **Sound-first**: ambience bed under every scene (`room-tone` synthesised: filtered noise 120-900 Hz, -48 LUFS), score entering on emotion not on action, silence before the turn (`cut.smash` pre-silence 200-400 ms).
- **Images carry the story**: dialogue-light; every scene has one visual idea (a prop, a colour, a shape) that repeats at the end transformed (match-cut bookend).

---

## 10. Mime-style / character-spot grammar (`tpl.character.spot`)

What the sources establish [S-ish, trade press and Wikipedia; Wikipedia production details uncited]: for Vodafone India's ZooZoo campaign, Ogilvy (creative lead named as Rajiv Rao in trade press) built characters that were deliberately *simple to an extreme degree*, with a limited emotion set, no dialogue (gibberish), emoticon-like expressions and neutral backgrounds; performers in suits shot to read as animation; each spot is one situation, the humour comes from physical comedy and a relatable everyday problem, and the product message arrives with the punchline via on-screen text ("Chhota Credit": phone-a-friend lifeline, no balance, then the top-up message) [afaqs, FoneArena, SocialSamosa, Wikipedia].

Legal and brand rule: those characters are Vodafone/Ogilvy IP. We borrow the **grammar** (simplicity, one gag, wordless), never the designs, names or character likeness. Our characters must be original.

### 10.1 The rules ("one gag, one feature")
1. **One gag, one product feature.** A spot has exactly one situation and one benefit. If the idea needs two setups, it is two spots.
2. **Wordless.** Meaning travels in action, expression, props and one on-screen text line. Gibberish voice only for texture.
3. **Emotion vocabulary capped at 6**: neutral, happy, sad, surprised, angry, scheming (default set; extendable to 8). Faces are shape swaps, not morphs, to keep reads instant.
4. **Familiar format as a frame** (quiz show, queue, elevator, office): the audience gets the joke setup for free because the format is known.
5. **Neutral stage**: flat colour or soft gradient background, one hero prop, high contrast, so a thumbnail-size frame reads.
6. **The payoff is a reversal of expectation** delivered with a `cut.smash` or a held reaction, then text.

### 10.2 Structure and timing (`tpl.character.spot`, 30 s; also 15 s and 6 s)
| Beat | 30 s | 15 s | Shot grammar | Components |
|---|---|---|---|---|
| Hook (gag premise visible) | 0-3 | 0-2 | wide, character already in the situation | `tpl.hook.in-medias-res` |
| Setup (format + want) | 3-9 | 2-5 | medium, 2-3 cuts, clear screen direction | `cut.hard` on action |
| Escalation | 9-18 | 5-9 | alternate wide/close, one beat of "it's going wrong" | `tx.scalePunch`, rising music |
| Twist (the reversal) | 18-22 | 9-11 | smash to the reaction | `cut.smash`, `sfx.sting` |
| Reaction hold | 22-24 | 11-12 | close-up held 1.5 s (the face does the work) | `th.beatHold` 1500 |
| Message + brand | 24-30 | 12-15 | clean text card, product feature in one line, logo | `cap.impact` styles, end card |

### 10.3 Components to build
- `char.rig2d` (SVG/Canvas, deterministic): body = rounded primitive; face = swappable sprite set of 6 emotions; params `blinkEvery_s: 3.2` (jittered), `squashStretch: 0.12`, `bounce_hz: 2.2`, `anticipation_ms: 120`, `settle_ms: 220`.
- `char.babble` (voice texture): formant-synth syllable generator: `syllable_ms: 90-160`, `f0: 220 +/- 40 Hz`, formants for /a e i o u/ interpolated, `emotionContour` (rising for question, falling for sad). Outputs a mono clip with measured LUFS. (Synthesised in code; no recordings.)
- `char.reactionShot`: `hold_ms: 1500`, `pushIn: 1.0 to 1.05`, `blink: at +400 ms`.
- `stage.neutral`: `bg: solid | gradient`, `floorShadow: true`, `vignette: 0.15`.
- `tpl.character.spot` wires the beat table above and the SFX (`sfx.pop`, `sfx.sting`, `sfx.typing` for the message text).

---

## 11. The edit plan: one data shape for everything (`plan.*`)

All templates compile to one JSON that HyperFrames compositions and the three.js kit both consume. Rows are shots; transitions and audio are attributes of the boundary, so lint and SFX placement are automatic.

```json
{
  "fps": 30, "preset": "reels.organic", "bpm": 128, "seed": 7,
  "shots": [
    { "id": "s1", "src": "hook.scene", "in": 0.0, "out": 1.4,
      "role": "hook", "emotion": "curiosity", "story": "promise payoff", "rhythm": "beat1",
      "focal": [0.5, 0.42], "text": "I deleted my spreadsheet.",
      "boundaryOut": { "kind": "tx.whip", "reason": "ENERGY", "params": { "direction": "left" },
                       "sfx": "sfx.whoosh", "audioLead_ms": 0 } },
    { "id": "s2", "src": "problem.scene", "in": 0.0, "out": 1.8, "role": "problem",
      "interrupt": 2,
      "boundaryOut": { "kind": "cut.hard", "reason": "BEAT", "snapToBeat": true } }
  ],
  "captions": { "style": "cap.impact", "chunk": { "maxWords": 4 } },
  "audio": { "music": "score.v1", "duckUnderVO_dB": -8, "target_LUFS": -14, "maxTP_dBTP": -1 },
  "cta": { "soft_at": 0.65, "end_card_ms": 1800, "phrase": "Try it free" },
  "claims": [ { "text": "...", "source": "..." } ]
}
```

`plan.compile()` produces: (a) the timeline for HyperFrames (`data-*` timing), (b) the SFX cue sheet, (c) the lint report. Only the plan is authored; everything else is generated.

---

## 12. Build list for the edit layer (priority order)

| Pri | Component | Why it matters | Reuses |
|---|---|---|---|
| P0 | `plan.compile` + JSON schema + `lint.*` (R1-R18) | makes the whole pack consistent and checkable | |
| P0 | `tx.whip`, `tx.flash`, `tx.glitch`, `tx.scalePunch`, `tx.dissolve`, `tx.dipToBlack`, `cut.smash`, `cut.split` | covers ~90% of short-form needs; cheap shaders | three.js kit, HyperFrames |
| P0 | `sfx.*` synthesis (12 cues, section 5.3) + `sfx.place` + manifest with LUFS/TP/peak_ms | "SFX on every cut" is the highest-leverage polish | `sfx9.py`, `mix9.py` patterns |
| P0 | `cap.chunk`, `cap.impact`, `cap.emph` | captions are in every format | |
| P1 | `tx.lightLeak`, `tx.filmBurn`, `tx.zoomThrough`, `tx.maskReveal`, `tx.iris`, `tx.lumaWipe`, `tx.push`, `tx.blurCross` | premium/film/brand looks | |
| P1 | `cam.punchIn`, `cam.push`, `cam.reframeAlternate`, `cam.speedRamp` | human-edit/retention toolkit | |
| P1 | `tpl.ad.hppp`, `tpl.hook.*` (7), `tpl.short.retention`, `tpl.cta.*`, platform presets | fast ad production | |
| P1 | `tpl.character.spot`, `char.rig2d`, `char.babble`, `stage.neutral` | mime-style spots; the v10 set already has a character worker | v10 set (ANVE launch-film kit) |
| P2 | `tx.match`, `tx.morph`, `tx.ink` | harder shaders / needs anchors | |
| P2 | `tpl.film.3min`, `plan.scaleLadder`, `th.autocut`, `th.beatHold`, `broll.*` | short film and talking-head templates | |
| P2 | `tpl.loop.*` + `lint.loop` | replay value | |

Each component must ship: README entry (3-5 lines), tag list (tags are given above), a 2-4 s demo render (small, 540p), and for media (`sfx.*`, `char.babble`) the measured LUFS, true peak and `peak_ms`. Demo renders keep disk use trivial.

---

## 13. Existing assets to reuse (inventory, not duplicated)

- Audio mix with oversampled limiter and AAC true-peak probe: the v9 scripts of ANVE's launch-film kit (`mix9.py`, `sfx9.py`, `score8.py`, `voices9.py`).

---

## 14. Unverified or contested claims (do not rely on without testing)

1. All numeric retention thresholds (60/65/70% at 3 s; 50-60% of drop-offs in first 3 s; captions +15-25% retention; 30-35% hook rate): vendor blogs, no methods.
2. "Over 80% of Reels watched with sound on", "88% of TikTok users consider sound vital", "74% increase in attention" (TikTok write-up): second-hand.
3. Reels: "sends per reach 3-5x likes", "reposts get 40-60% less distribution", "aggregators lost 60-80% reach", "10+ reposts in 30 days excluded": single-vendor claims. Mosseri quotes not traced to a primary source.
4. Ideal Shorts length 15-35 s; Shorts/Reels 3-minute eligibility: unconfirmed against platform help pages.
5. Safe-zone percentages: sources conflict (top 14%/bottom 35%/sides 6% vs a 65-70% centre band). Verify against current platform templates before final export.
6. ABCD lift numbers (+30% short-term, +17% long-term): from a trade write-up of YouTube's playbook; underlying study not read.
7. "TikTok Creative Codes = ABCD": false; ABCD is YouTube's framework. TikTok's six Creative Codes are TikTok-first mindset, trends as templates, production principles, video structure (hook in the first six seconds / body / close), editing techniques and power of sound, per a third-party summary.
8. Photosensitivity limits (flash rate, luminance step): [H] caution; check WCAG flash thresholds before shipping `tx.flash` to broadcast-adjacent contexts.
9. gl-transitions licensing: each transition has its own `license` field and the README does not state terms, so we did not and will not vendor any file; we only borrow the *interface concept* (two textures plus progress).
10. Production details of the section 10 campaign beyond trade press (suit fabric, frame rates, rubber faces) come from uncited Wikipedia text.

---

## 15. Sources (with how they were used)

- Murch Rule of Six: StudioBinder https://www.studiobinder.com/blog/walter-murch-rule-of-six/ ; NoFilmSchool https://nofilmschool.com/2016/11/6-rules-good-cutting-according-oscar-winning-editor-walter-murch ; Musicbed https://wpengine.fm.co/musicbed/filmmaking/editing/rule-of-six/ (secondary summaries; primary book not read).
- Transition types: Filmdaft https://filmdaft.com/?p=24604 ; CapCut https://capcut.com/resource/types-of-filmmaking-transitions ; VideoProc https://www.videoproc.com/it/video-editing-software/guide-free-win/cuts-and-transitions-101.htm
- GL Transitions (idea only; nothing vendored): https://gl-transitions.com/ ; https://github.com/gl-transitions/gl-transitions ; README https://cdn.jsdelivr.net/npm/gl-transitions@1.67.0/README.md
- Hooks and retention (vendor blogs, [P]/[U]): https://tlinky.com/3-second-hook/ ; https://jellymarketing.ca/blog/stop-the-scroll-in-3-seconds-secrets-to-high-performing-short-form-video-hooks/ ; https://www.socialync.io/blog/tiktok-viral-retention-rate-2026 ; https://eliro.pro/blog/short-form-video-hooks-script-guide-2026 ; https://posteverywhere.ai/social-media-terms/hook-rate ; https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention (fetched; every figure flagged unverified, vendor sells OpusClip).
- YouTube Shorts view-counting change (March 2025): https://www.mediapost.com/publications/article/404562/youtube-changes-how-it-counts-shorts-views.html ; https://www.pixability.com/uncategorized/whats-changing-with-shorts-organic-views/ ; https://social-media-management-help.brandwatch.com/hc/en-us/articles/26214254055709-YouTube-Changes-to-Views-Counts-on-Shorts ; https://routenote.com/blog/how-are-views-counted-shorts-tiktok-reels/
- YouTube ABCD (via trade write-up): https://ppc.land/mastering-youtube-advertising-with-the-abcd-framework/
- TikTok Creative Codes (third-party summary): https://nonsensical.agency/?p=3896 ; https://corkboardconcepts.com/?p=11038 ; https://stackmatix.com/blog/tiktok-creative-best-practices-2026
- Reels ranking and originality (vendor blogs): https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers ; https://posteverywhere.ai/blog/how-the-instagram-algorithm-works ; https://www.socialpilot.co/de/blog/instagram-reels-algorithm
- Reels safe zones and sound: https://confect.io/ad-glossary/safe-zones ; https://www.pepperit.com.au/why-social-media-safe-zones-for-videos-matter/ ; https://benly.ai/learn/ad-creative/meta-ads-creative-specs-2026 ; https://www.websitebuilderexpert.com/news/meta-updates-reels-ads-guide/
- SFX placement: https://www.epidemicsound.com/sound-effects/categories/designed/riser/ ; https://sonilo.com/ai-music/whoosh-sound-effect-guide ; https://reelmind.ai/blog/transition-sound-effects-perfecting-audio-video-sync-with-free-assets
- Loops: https://www.capcut.com/create/seamless-loop-videos-continuity-techniques
- Short-film structure: https://ltx.studio/blog/how-to-write-a-short-film-script ; https://www.adobe.com/creativecloud/video/discover/short-film-ideas ; https://mhadimedia.notion.site/Short-Stories-Lecture-1-2639240bd7998090be9fc0a246c81749
- ZooZoo: https://en.wikipedia.org/wiki/ZooZoo ; https://www.fonearena.com/blog/3830/making-of-the-vodafone-zoozoos.html/amp ; https://www.socialsamosa.com/2019/12/brand-saga-vodafone-marketing-strategy-part-2 ; https://afaqs.com/news/advertising/23893_zoozoo-the-new-brand-endorser-for-vodafone ; https://www.afaqs.com/news/marketing/40628_Vodafone-Zoozoos-At-it-again
- Talking-head editing: https://jupitrr.com/how-to/edit-talking-head-videos ; https://viberoll.questera.ai/learn/talking-head-video-editing-checklist/ ; https://faceless.so/blog/video-retention-editing-9-techniques-that-work ; https://www.capcut.com/create/video-transitions-crossfade-hard-cut-jump-cut

[G] items (no cited source): alternating-scale framing on jump cuts; ranges in section 2 for durations/blur/sweeps; all numeric defaults tagged [H] are engineering starting points to tune by eye and by retention data.
