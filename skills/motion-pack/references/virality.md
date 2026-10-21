# Virality: the expanded checklist, with evidence grades

The sources are `docs/evidence/edit.md` sections 1, 3, 4, 6, 8 and 14, and `docs/evidence/visual.md` section 9.

**Grades:**

| grade | meaning |
|---|---|
| [S] | Credible source (platform or primary, sometimes second-hand). |
| [P] | Practitioner rule of thumb. |
| [U] | Single vendor, no method. |
| [H] | House default. Tune it by eye and by our own analytics. |

**Bottom line:** platforms publish no hook-rate or retention thresholds. Commit to the mechanisms and treat every number as a lint parameter. Your own analytics are the only ground truth.

## Three jobs

Virality is three separate jobs: survive the first second, hold to the end and invite a replay, and get sent to someone [P].

## 1. Hook (0-3 s)

**This table is the one statement of the hook rule.** `story-script`, `frame-design` and `social-video` link here instead of restating it; `critic.md`, the mixer's R10 lint and `ears` apply it.

**Rules:**

| rule | value | grade |
|---|---|---|
| Frame 0 and first motion | A strong image that is already in motion: the first visible change lands by frame 6 (frame 0 is the first frame of a move, not a held still). Not black, not a logo, not a fade. A small product-name super over moving footage inside 2 s is allowed: it is not a logo bumper (round 4/5: 7 of 29 did it, tier A among them; 0 of 29 opened on a static logo) | [P] |
| First sound | On frames 0-3, **or** 1-2 s later on the first meaningful visual event over a moving frame 0 (a planned quiet open: 13 of 28 round 4/5 references, tier A among them). Mark it in `plan.audio.quiet` so `ears` treats it as intended | [P] |
| Hook text | On screen by 0.3 s, at most 7 words; at most 4 words on the poster frame | [H] |
| Layered hook | Picture, text and VO say one idea | [P] |
| Moves in the first 1.0 s | At most 1 camera or layout move | [H] |
| Paid YouTube, first 5 s | Multiple shots, tight framing, people early, brand inside 5 s (`brandCueBy`) | ABCD [S, second-hand] |
| Organic TikTok / Reels | Brand cue after the hook but before 7 s | Conflict resolved as house default [H] |

**Seven archetypes** (`hook.archetype` in the ad template):

| id | 0-3 s plan |
|---|---|
| `payoff-first` | Result close-up for 1.2 s, then a flash or speed-ramp rewind into the setup |
| `pattern-break` | An odd or impossible frame, 3 shots in 3 s |
| `claim-or-question` | Kinetic text word by word on the beat (`type/scaleSlam`), at most 7 words |
| `in-medias-res` | Start at the moment of failure, then whip into the setup |
| `curiosity-gap` | Blurred or partial reveal: blur 24 to 0 px over 2.5 s, or `transitions/maskReveal` |
| `social-proof` | Real number or quote with a 900 ms counter. It needs `source`. |
| `problem-agitate` | 3-cut escalation, last cut `transitions/smash` to the product |

Make three variants per brief that differ only in the hook [P].

Six more archetypes, each with its frame-0 rule and generic example lines, are in `patterns/hooks.json`: `live-demo` (AI products: the work already running on frame 0), `cold-open` (trailers), `light-from-dark` (hardware), `provocative-line` (podcast clips), `promise` (tutorials), `founder-to-camera`. Evidence: `docs/evidence/launch-video-patterns.md` §2. Beat sheets per genre (as % of runtime) are in `patterns/structures.json`; score a plan with `tools/structure_check.py`.

## 2. Hold

**The interrupt ladder** (`cuts/patterns.json` `interrupts`) [H], reconciling [P] "every 3-5 s" and [U] "every 2-4 s":

| level | cadence | examples |
|---|---|---|
| L1 | About every 2.5 s | Punch-in 1.12, caption emphasis, new angle, small scalePunch |
| L2 | About every 5 s | B-roll, text card, whip, zoom-out reveal, new colour field |
| L3 | About every 9 s, at least 6 s apart | Smash, glitch, flash plus a music drop, a format switch |

Add 25% jitter so the cadence is not metronomic. `python3 cuts/cutgen.py lint-interrupts schedule.json` (exit 1) fails on two L3s within 1.5 s, or on four consecutive 5 s windows whose summed levels (L1 = 1, L2 = 2, L3 = 3) each rise over the one before (fatigue: the cadence only ever escalates); `cutgen.py interrupts` prints its own `lint` and is built never to fail it. The plan lint in `templates/` does not run it: a template that wants it calls `lint_interrupts`. "When every sentence brings a zoom, flash, meme and whoosh, the interruptions become the pattern" [P].

**Structure:**

- **Retention structure of a 20-35 s short:** hook (0-3 s), then the why-stay promise or open loop (3-6 s), then 2-4 beats each with a micro-payoff, then the best payoff in the final 20%, then the loop seam or CTA [H].
- **Static limit:** something visible or audible changes at least every 3.5 s (R4) [H].
- **Pace shape:** contemporary films start with longer shots, shorten through the setup, cut fastest in the climax and lengthen at the end (a measured 210-film study; `docs/evidence/launch-video-patterns.md` §3). Set ASL per section (`patterns/structures.json` `asl_s`), not one global rate.
- **Ending:** if the retention graph dips at the very end, trim the last 1-2 s [P]. The exception is a planned **quiet hold**: explainers and partnership posts hold the end card on near-silence for 3-9 s (17 of 28 round 4/5 references end at least 10 dB under the body; `launch-playbook.md` end shapes) [P].

**Mute-proof:**

- Every VO sentence has a caption (R14).
- Sound-on is dominant on YouTube (95%, [S] second-hand). On Reels the figure is ">80%" [U].
- Design for both: full meaning on mute, better with sound.

## 3. Share and replay

- **Send-worthy beat:** in the final third, name an audience ("send this to..."). The direction is consistent across sources; the "sends worth 3-5x likes" multiplier is [U].
- **Shorts replays:** since 2025-03-31, YouTube Shorts counts a view on start or replay with no minimum watch [S: MediaPost, Brandwatch, Pixability]. A seamless loop is therefore worth views directly.
- **Loop designs:**
  - State-return: `scene(t) = scene(t mod T)`. This is cheap because the pack renders from t.
  - Reveal-to-hook: the last line completes the first.
  - Ping-pong.
- **Loop QA:** SSIM of first vs last frame >= 0.92 [H], audio RMS delta at the seam < 3 dB, and a 120 ms audio crossfade on the seam.

## 4. CTA

- **Soft CTA** at 60-70% of the runtime.
- **Hard CTA end card** in the last 2.5 s (2.0 s for a 15 s ad), held 1.8 s after the motion settles [H].
- **Phrasing:** specific phrases ("Try it on your desk"). Use urgency only if it is true [S, ABCD Direct].
- **Placement:** keep the CTA in the centre band and use the platform's CTA button for the link [P].
- **On a loop:** replace the end card with a small tag at 0.8 opacity, outside the bottom 35%.

## 5. Native vs polished

- **Organic:** creator-native wins (TikTok Creative Codes via third-party summaries [P]).
- **Brand and launch:** polish wins.
- **Originality:** Instagram reportedly demotes reposts and aggregators [U]. Export per platform and never carry another platform's watermark.

## 6. Thumbnail and title [H, craft]

- **Poster frame:** one subject, high contrast, at most 4 words, and readable at 120 px wide. Mime-style spots read at thumbnail size because the stage is neutral.
- **Real UI only:** composite real screenshots; never let an image model redraw UI or text, because it garbles them.
- **Title:** front-load the payoff, keep it about 50 characters or less, and promise only what the video delivers. Clickbait that the video does not pay off trains the audience to skip.

## 7. Cadence and distribution (house experience, not research)

- **Slot:** use one fixed daily slot rather than bursts.
- **Reach before volume:** posting more of a format that gets almost no views does not fix reach. Fix the hook and format first.
- **Records:** log per variant the 3 s views / impressions (hook rate), average view duration, completion and sends. Keep the grammar of the winner.
- **Posting:** publishing is the user's action. Prepare drafts and files only.

## Unverified numbers (do not quote as fact)

These come from `docs/evidence/edit.md` section 14:

- 3 s retention thresholds of 60, 65 or 70%.
- "50-60% of drop-offs happen in the first 3 s".
- "Captions give +15-25% retention".
- A hook rate of 30-35%.
- "Sends worth 3-5x likes".
- "Reposts get 40-60% less distribution".
- An ideal Shorts length of 15-35 s.
- Safe-zone percentages.
- ABCD lift figures of +30% / +17%.
