# Spec anatomy: the worked example, clause by clause

`example-spec.md` is a complete spec that was built and measured with this skill. This file says what each of its clauses BUYS: what it
removes from the builder's guesswork, what it makes measurable, and what went wrong where a number was missing. Use it to read a spec
someone hands you, and to write one from a brief.

## The pattern in one line

Format -> determinism contract -> set / hero -> materials -> lights -> timeline (frames + physical verbs) -> camera -> post -> sound keyed
to frames -> numbered correction rounds. Every clause is a number that a script or a still can check.

## Video

| clause (abridged) | what it buys |
|---|---|
| "6 s seamless loop, 60 fps (360 frames), 1080x1080" | fixes NF = 360 and every period: breathing (90 frames) divides 360; the orbit and the noise cycle are one loop long. The seam test becomes "frame 360 == frame 0". |
| "one HTML file, three.js 0.160.0 via jsDelivr importmap only" | reproducibility: no build step, a pinned version whose quirks are known (r160 TextGeometry reads `height`, not `depth`). |
| "Manrope ExtraBold, wght pinned to 800 ... baked to a typeface JSON ... the same outlines TextGeometry extrudes" | the brand font becomes data next to the page; the SDF bake and the mesh use one set of outlines, so the later SDF-to-mesh cross-fade cannot pop. |
| "`window.renderAt(t)` sets everything from t ... periodic in 6 s ... seeded random only ... with `?t=` never start requestAnimationFrame ... `__ready` after the font, the bake and warm-up" | the determinism contract: any frame on demand, in any order, and a driver that knows when to start. Without it supersampling and QA are impossible. |
| "Quarter-pixel camera jitter, 4 offsets from frac(t*60), averaged in linear HDR before bloom" | anti-aliasing and a 360-degree shutter that are themselves deterministic: the subframe time picks the offset, so frame n always gets the same 4 samples; bloom comes from the true average. |
| "white floor (albedo 0.86, 6% mirror) ... beyond z = 4.0 the floor and its reflection fall to black, so the camera side of every glossy face reads as a dark panel" | the classic chrome-type look is a lighting design. The "so" clause states the intent once, which survives any implementation change. |
| studio in numbers: "overhead softbox 2.4, upper-left softbox 3.0 (az -55, el 38, 28x22 deg), black panel 86x57 deg, black flags at az +-75" | chrome is only what it reflects, so the environment IS the look. Azimuth / elevation from the camera make every light placeable without a scene file. |
| "blob radius 0.70, +-3% breathing over 90 frames, simplex 0.05 at 1.15 per unit, domain travelling a circle once per loop" | amplitudes are binding; the circle in the noise domain makes the noise periodic, so frame 360 can equal frame 0. |
| "each droplet a disc of its glyph's area, scaled so parted neighbours keep k/2 apart" | droplet sizes follow the letters, and the smooth-min neck cannot re-form between parted drops. |
| "1.0 em (cap height 0.72), depth 0.23, bevel 0.055 (10 segments), y = 0.30, tracking -0.02 em" | the letterform is fully specified; no "make it look nice" guess. |
| "chrome F0 0.92, 3 bounces, roughness 0.04 modelled as a 1.1 deg soft edge" | the material in physical terms, plus the implementation reading of "roughness" stated once, so the next build reads it the same way. Bounces cap the cost and decide whether letters reflect each other. |
| "rim strip #4A18ED, az 149, el 24, 12x44 deg, intensity 1.3 ... must probe at about (74, 24, 237)" | a colour target a pixel probe can check. Follow-up 1 shows what the number protects against: a saturated emissive clipping into the wrong hue. |
| "glint strip 2 deg, tilted 40 deg, intensity 6, sweeping az -35 to +25 over frames 198-246" | the one moving light gives the hold life without moving the letters, and its frames are fixed for the sound (the ting on 200). |
| "squash 10% (volume kept)", "stretch to 2.0x", "7% overshoot, vertical on a 1.3x faster clock", "bevel puffy 0.12 springs flat at 1.6 Hz, decay 6/s" | animation principles as numbers: anticipation, stretch, overshoot, arcs (the faster vertical clock curves the path), follow-through. A reader can compute the pose on any frame. |
| "smooth-min k falls 0.35 -> 0.10 around each break; each gap is exactly k/2 on its break frame, then grows at 0.9 units/s" | a quadratic smooth-min neck exists while the gap is under k/2, so scheduling the gap to cross k/2 ON the frame makes the neck break on the frame the sound expects; the part speed keeps it from re-joining. |
| "necks break 110, 116, 122; launches 112, 124, 136, 148; letters form 126, 138, 150, 162" | one table row per event, in frames: the picture and the score read the same numbers. |
| "blob takes over ... relaxes to the wobble start; runs through frame 0" and "the previous loop's landing wobble tapers to 0 by frame 60" | the loop is designed, not cut: the last motion continues across the seam. |
| "Camera: fov 30, elevation 6, orbit +-7 deg (centre frame 231), dolly keys by frame ... back to 5.6 at 354 (periodic)" | framing on every frame is computable, and the camera returns to its frame-0 value. |
| "Post: bloom threshold 1.0, strength 0.30; tone linear to 0.9 then a soft shoulder; vignette 7%; grain 1.5% seeded by frame index" | a reproducible grade; "seeded by frame index" keeps the grain deterministic and periodic. The 0.9 knee is also what follow-up 1 ran into. |

## Sound

| clause | what it buys |
|---|---|
| "Synthesize everything in code with the Web Audio API (OfflineAudioContext, 48 kHz stereo), no samples" | everything regenerates from code: no licences, no files, the same bytes every run. |
| "Each hit lands 1 frame after its visual event, on sample (F + 1) x 800" | the sync rule in one number. Sound slightly after the picture reads as caused by it. |
| "3/4 at 120 BPM; bars of 90 frames start on frames 67, 157, 247, 337: A, D, F#m, E, so the loop resolves E -> A" | the bed is anchored to picture frames, not to t = 0; the phrase starts on the squash and its cadence resolves across the seam. |
| "an offbeat shaker 15 frames after each beat wherever no hit plays" | the bed stays out of the hits' way, which is what lets the hits sit 3 to 6 dB over it. |
| "one bell note as each droplet becomes its letter ... form start + 12 frames, the midpoint of the morph" | the note lands where the silhouette flips from drop to letter; the frame is derived, not guessed (DECISION 3). |
| "partials 1, 2.01, 2.76, 4.17, 5.43 with per-partial decay ... x0.18 on the first three" | a bell character in numbers, and the decay that keeps one note's tail out of the next note's 60 ms window (follow-up 2). |
| "a 2 ms sin^2 attack ending on a cosine crest on the target sample, plus a random-phase chord bloom" | timing at 0 samples (the crest IS the peak) without stacking every partial's crest on one sample for the limiter; the bloom adds K-weighted body with a low crest. |
| the event list, each with its frame (inhale 66-84, glide 84-112, ticks 110/116/122, ting 200, swell 288-303, drips 308, blups 318/321/324, gloop 337) | a foley list mapped to the timeline: every picture event owns a sound and a frame. |
| "gloop with the wobble pitch and amplitude of the picture (2.4 Hz, damping 0.25)" | sound mirrors the picture's physics: the same oscillator constants drive both. |
| "-14 LUFS, true peak <= -1 dBTP (4x), every hit 3 to 6 dB over the bed (K-weighted, first 60 ms), limiter <= 1.5 dB on any hit, no click at the seam; single loop with 2 ms fades, a two-loop file from the master" | acceptance criteria a script measures; delivery is part of the spec, not an afterthought. |

## The correction rounds

| round | what it shows |
|---|---|
| 1 (picture): rim read lilac-magenta at intensity 10; cause: blue clipped past the 0.9 knee; fix: intensity 1.3 and a wider strip; acceptance: within 10 of (74, 24, 237); after: (80, 26, 251) | a correction is data: a measured symptom, a cause, a physical fix with numbers, an acceptance test, and the number after. |
| 2 (sound): logo notes' own level +2.3 / +3.5 / -0.9 dB and a -8.85 dB solver trim; cause: 1.7 s tails inside the next note's window; fix: decay x0.18 on the passing notes; after: own +4.5 / +3.5 / +4.0 / +2.7 dB | a passing table is not the finish: the numbers could have passed with a note trimmed nearly silent. The fix is voicing, not trims. |
| 3 (9:16): a slanted black floor band; cause: the black floor starts at a fixed z while the camera moved back; fix: scale it with the dolly | a reframe changes geometry the original spec took for granted; state the dependency (the black floor follows the camera). |

## What makes a spec good (use it as a checklist when writing one)

1. **Every adjective has a number** ("puffy" = 0.12 bevel; "soft" = a 1.1 deg edge; "brand violet" = a pixel probe within 10 of (74, 24, 237)).
2. **Time is in frames** where sync matters, seconds where feel matters, and both where they meet.
3. **Intent is stated once** ("so the camera side of every glossy face reads as a dark panel"): the numbers can then change without losing the point.
4. **The loop is designed, not cut**: the last motion runs through frame 0; the state at the end equals the start.
5. **Sound mirrors picture**: the same frames, the same physics (the 2.4 Hz wobble in both, a note on each letter's morph midpoint).
6. **Pinned versions and known quirks** are named in parentheses.
7. **Corrections are measured**: symptom with numbers, cause, physical fix, acceptance criterion, the number after. That is also how to
   report a build: tables, not adjectives.
