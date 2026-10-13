# Worked example: ANVE Liquid Chrome

Worked example: the maker's own wordmark loop (ANVE Liquid Chrome, built with this skill on 12 Oct 2026). The measurements are from
that build. It is the spec as it stood after its three correction rounds (the final state after the follow-ups is the spec).

**What the build changed in the template.** It edited CONFIG only: `text: 'ANVE'`, a brand font baked with
`scripts/ttf2typeface.py`, the rim colour and size, `timeline.launch` so the letters land one after another, layout and blob sizes.
It also rewrote the sound part of the DERIVED block: four bell notes (a sonic logo) replace the template's pour notes, with a
key-specific bed. The template's stock score is a different event list; the engine itself needed no change.

```js
// CONFIG changes against templates/liquid-chrome.html
text: 'ANVE',
font: { url: 'assets/manrope-800.typeface.json', size: 1.0, height: 0.23, bevel: 0.055, bevelSegments: 10, curveSegments: 24, trackingEm: -0.02, opticalCenter: '' },
layout: { floorY: -0.9, textY: 0.30, blobY: -0.12, camTargetY: 0.10 },
studio.rim: { hex: '#4A18ED', az: 149, el: 24, w: 12, h: 44, i: 1.3 },
blob: { radius: 0.70, stretch: 2.0 /* rest as the template */ },
timeline: { pinch: [110, 116, 122], launch: [112, 124, 136, 148], form: { start: 126, stagger: 12, dur: 24, puffy: 0.12 }, soften: [294, 312, 0.07] /* rest as the template */ },
```

Brief: "A chrome blob breathes, squashes, stretches and pinches into four droplets that arc into the chrome letters A N V E, holds
with a glint sweep, then drains and merges back into the blob through frame 0."

---

## Video

**ANVE Liquid Chrome: 6 s seamless loop, 60 fps (360 frames), 1080x1080, one HTML file (page.html), three.js 0.160.0 via jsDelivr importmap only**
Font: Manrope ExtraBold (wght pinned to 800 by the fontTools instancer from Manrope-Variable.ttf, baked to a typeface JSON of the four
outlines, served next to the page as assets/manrope-800.typeface.json; the glyph outlines are the same ones TextGeometry extrudes).

`window.renderAt(t)` sets everything from t in seconds; all motion and noise periodic in 6 s; seeded random only; with `?t=` never
start requestAnimationFrame; `window.__ready` after the font, the GPU SDF bake and shader warm-up. Frame 360 equals frame 0.
Quarter-pixel camera jitter, 4 offsets from frac(t*60), averaged in linear HDR before bloom.

**Set**: white floor (albedo 0.86, 6% mirror reflection) at y = -0.90; beyond z = 4.0 the floor and its reflection fall to black, so the
camera side of every glossy face reads as a dark panel. Studio: overhead softbox 2.4, upper-left softbox 3.0 (az -55, el 38, 28x22 deg),
black camera-side panel 86x57 deg centred on the camera, black flags at az +-75 (14 deg wide), bright back wall.
**Hero**: one chrome blob, radius 0.70 (+-3% breathing, period 90 frames, simplex 0.05 amplitude at 1.15 per unit, domain travelling a
circle once per loop), hovering 0.08 above the floor (centre y = -0.12, floor y = -0.90). It becomes 4 droplets (A N V E: each a disc of
its glyph's area, scaled so parted neighbours keep k/2 apart), then 4 extruded letters: Manrope ExtraBold 1.0 em (cap height 0.72),
depth 0.23, bevel 0.055 (10 segments), letters centred on x = 0, floating at y = 0.30, tracking -0.02 em.
**Materials**: chrome F0 0.92, 3 bounces, roughness 0.04 modelled as a 1.1 deg soft edge on every analytic light; floor as above.
**Lights / environment**: rim strip in the brand violet #4A18ED: az 149, el 24, 12x44 deg, intensity 1.3 (after follow-up 1: its brightest
reflection must probe at about (74, 24, 237), not clipped toward magenta); glint strip 2 deg wide, tilted 40 deg, intensity 6, sweeping
az -35 to +25 over frames 198-246 (3-frame fade in and out at both ends); so the rim is the only colour in the frame: chrome stays neutral
white-grey-black, the single accent is the brand violet.

**Timeline** (frames at 60 fps; every beat has a number)

| frames | seconds | beat | numbers |
|---|---|---|---|
| 0 - 72 | 0 - 1.2 | breathe | radius +-3%, 90-frame period; the previous loop's landing wobble (14%, damping 0.25, 2.4 Hz) tapers to 0 by frame 60 |
| 72 - 84 | 1.2 - 1.4 | squash | 10% (volume kept: x and z grow by 1/sqrt(0.9)) |
| 84 - 105 | 1.4 - 1.75 | stretch | to 2.0x wide (ease in-out), height 1/sqrt(2.0) |
| 96 - 123 | 1.6 - 2.05 | bead chain | the stretched blob cross-fades (95-108) to 4 beads in a chain whose width = the stretch; beads relax from the chain size to equal-area discs |
| 110, 116, 122 | 1.83, 1.93, 2.03 | necks break, left to right | smooth-min k falls 0.35 -> 0.10 around each break; each gap is exactly k/2 on its break frame, then grows at 0.9 units/s so no neck re-joins |
| 112, 124, 136, 148 | | droplets launch A, N, V, E | each arcs 16 frames to its letter slot, 7% overshoot, vertical on a 1.3x faster clock, stretched along its velocity (<= 1.5x) |
| 126, 138, 150, 162 | 2.10, 2.30, 2.50, 2.70 | droplet becomes its letter A, N, V, E | 12 frames apart; 24-frame ease-in-out morph from disc to extruded glyph; bevel starts puffy (0.12) and springs flat at 1.6 Hz, decay 6/s |
| 198 - 282 | 3.3 - 4.7 | mesh cross-fade | the raymarched SDF letters hand over to the real TextGeometry meshes (in 198-216, out 264-282) |
| 198 - 246 | 3.3 - 4.1 | glint sweep | strip crosses the letters left to right |
| 288 - 309 | 4.8 - 5.15 | swell | 6-frame swell to 3.5% scale, relaxed by 309 |
| 299 - 318 | | letters unform to droplets | 19-frame ease; slump 12% of the height by frame 308 (edge softening 0.07) |
| 297 - 337 | 4.95 - 5.62 | drain | droplets fall to the blob axis (ease in), then the necks merge: centre neck first |
| 318, 321, 324 | | necks merge | k rises from 0 to 0.10 over 6 frames each |
| 325 - 337 | | blob takes over | x1.8 wide, 0.55 high, relaxes to the wobble start; runs through frame 0 |

**Camera**: fov 30, elevation 6, orbit +-7 deg (centre frame 231), dolly 5.6 -> 7.2 (frames 0 -> 156), held 7.2 to 174, 6.95 at 288, back to
5.6 at 354 (periodic).
**Post**: bloom threshold 1.0, strength 0.30 (5-level normalised pyramid); tone linear to 0.9 then a soft shoulder; vignette 7%; triangular
grain 1.5% seeded by frame index.

---

## Sound

Score this seamless 6 s loop (360 frames, 60 fps). Synthesize everything in code with the Web Audio API (OfflineAudioContext, 48 kHz
stereo), no samples. Each hit lands 1 frame after its visual event, on sample (F + 1) x 800.

**Key A major, 3/4 at 120 BPM (a beat is 30 frames); bars of 90 frames start on frames 67, 157, 247, 337: A | D | F#m | E**, so the loop
resolves E -> A as the blob breathes again. Per bar: a sub pad on the root (A2 110, D2 73.4, F#2 92.5, E2 82.4), a three-note pad
(A3 C#4 E4 | D4 F#4 A4 | F#3 A3 C#4 | E3 G#3 B3), a soft kick on bars 0, 2, 3, an offbeat shaker 15 frames after each beat wherever no hit plays.

**The sonic logo**: as each droplet becomes its letter, left to right, one bell note: A -> A4 (440 Hz) on frame 138, N -> E5 (659.26) on
frame 150, V -> B5 (987.77) on frame 162, E -> A5 (880) on frame 174 (each = its form start + 12 frames, the midpoint of the morph).
Bell = partials 1, 2.01, 2.76, 4.17, 5.43 (slightly inharmonic) with per-partial decay 1.7, 0.9, 0.5, 0.28, 0.2 s (x0.18 on A4, E5, B5 so each
bell clears the one before; the last note A5 keeps the full 1.7 s: follow-up 2), a 2 ms sin^2 attack ending on a cosine crest on the target
sample, plus a random-phase chord bloom of the note and its fifth for the K-weighted body. Pan -0.35 -> +0.35 left to right.

**Events** (VISUAL frames):
- inhale: noise riser 66 -> 84, band 500-2400 Hz, ends on frame 84 (the stretch)
- glide: A3 (220) up an octave to A4 (440) over frames 84 -> 112, hand-off to the pinch ticks
- pinch ticks on 110, 116, 122: glass ticks D6->A6, E6->B6, F#6->C#7 (pitch falls to a fifth above: approach), pan -0.35, 0, +0.35
- logo bells: 138, 150, 162, 174 (above)
- ting on 200 (glint start): A6 1760 with partials 1, 2.32, 4.25; shimmer texture on 3520, 3951, 4435, 5274, 5919, 7040 Hz to frame 245, pan -0.85 -> +0.85
- swell: A2 rising a fifth to E3 over frames 288 -> 303, peak on 303 (with low-passed noise)
- drips on 308: B6->F#7 and F#6->C#7, pan -0.2 / +0.25
- blups on the merges 318, 321, 324: drops to E4 329.6, C#4 277.2, A3 220, each starting a fifth above
- slurp (noise) and gloop on 337: gloop E3 164.8 with the wobble pitch and amplitude of the picture (2.4 Hz, damping 0.25)

48 kHz stereo WAV, about -14 LUFS integrated, true peak <= -1 dBTP (4x oversampled), every hit (or pair on one frame) 3 to 6 dB over the bed
(K-weighted, first 60 ms), look-ahead limiter at most 1.5 dB on any hit, no click at the seam. Mux into the MP4 (single loop with 2 ms
raised-cosine fades on the first and last 96 samples; a two-loop file from the seamless master). No voice-over; no text other than ANVE.

---

## Follow-up (correction round) log

> 1. Picture, frame 0 (1080): the rim streak read lilac-magenta, not the brand violet, at intensity 10: blue was driven far past the 0.9 knee
>    and clipped, so red and green rose with the shoulder. The brand violet is #4A18ED = (74, 24, 237). Fix: rim intensity 1.3, strip widened
>    6x32 -> 12x44 deg to keep it visible. Acceptance: brightest violet pixel within 10 of (74, 24, 237). Measured after: (80, 26, 251) on frame 0.
> 2. Sound, first measured table: the logo notes' own level fell to +2.3, +3.5 and -0.9 dB, and the solver had to trim A5 by -8.85 dB, because
>    each bell (1.7 s tau) still rang inside the next note's 60 ms window 200 ms later (hits-stem tails count). Fix: tau of A4, E5, B5 x 0.18 (the
>    held last note A5 keeps 1.7 s; blooms 0.09 s decay on those three). Acceptance: every logo note's own level >= +2 dB and over the bed 3 to
>    6 dB. Measured after: own +4.5, +3.5, +4.0, +2.7 dB; over the bed +4.50 on each.
> 3. 9:16 reframe (1080x1920, dolly x1.75): a black floor band with a slanted edge appeared at the bottom, because the black camera-side floor
>    starts at z = 4 while the camera moved back to z ~ 12. Fix: blackBeyondZ scales with the dolly factor. Acceptance: no black floor in any frame.

## DECISIONS

| # | clause | reading chosen | why |
|---|---|---|---|
| 1 | "helvetiker_bold unless a static bold TTF of the brand font exists" | only Manrope-Variable.ttf exists; pinned wght 800 (axis max, 200..800) with the fontTools instancer, baked the A N V E outlines to a typeface JSON next to the page | the brief allows a variable font if wght 800 can be pinned; the same outlines drive the SDF bake and TextGeometry |
| 2 | "four droplets" | droplets = glyphs (4), necks break left to right (110, 116, 122), launches 112 / 124 / 136 / 148 | the left-to-right landing order is the left-to-right sonic logo |
| 3 | "as each droplet becomes its letter ... play one note" | the note lands on form.start + 12 = the midpoint of the 24-frame disc-to-glyph morph (frames 138, 150, 162, 174) | the morph is the "becoming"; its midpoint is where the silhouette flips from drop to letter |
| 4 | "rim strip in the brand violet #4A18ED" | emission colour #4A18ED at intensity 1.3, so its brightest reflection probes about (80, 26, 251) | a high intensity clips blue and reads magenta (follow-up 1) |
| 5 | "bell with slightly inharmonic partials" | partials 1, 2.01, 2.76, 4.17, 5.43 with per-partial decay, all cosine phase from a 2 ms sin^2 attack ending on the crest; a random-phase bloom (note, fifth, octave) carries the K-weighted body | the cosine crest keeps timing at 0 samples; the bloom avoids stacking partial crests in the limiter |
| 6 | "every hit 3 to 6 dB over the bed" with ringing bells | the first three notes ring short (decay x0.18), the last note A5 is held (1.7 s tau) | earlier bells' tails sit in the next note's 60 ms window and trim it to the floor (follow-up 2) |
| 7 | "the bed's chords around A major" | 3/4 at 120 BPM, 4 bars of 90 frames: A, D, F#m, E, so the loop resolves E -> A across frame 0; the logo notes sit on A (A4, E5) then D (B5, A5) | each logo note is a chord tone or the 6th of D |
| 8 | "no text other than ANVE" | no labels, no captions, no watermark; the only text is the 3-D letters | the brief |
| 9 | "white floor; dark camera-side panel" | the template's stock studio (floor albedo 0.86, 6% reflection, black beyond z 4, 86x57 deg black panel, black flags) | letter faces read dark with bright bevels (verified on frame 222) |
| 10 | supersampling | 4 subframes at n/60 + k/240, jitter slot floor(frac(t*60)*4) (+1e-6), rotated grid, averaged in linear RGBA32F HDR before bloom | the template's decision, unchanged |
| 11 | 9:16 deliverable | the same page with ?w=1080&h=1920&dolly=1.75 (vertical fov kept at 30, camera pulled back so the 2.65-unit-wide word fits the 0.5625 aspect) | the cheapest reframe, same determinism contract |

## Measurements (final)

Picture: GPU ANGLE Metal on an Apple M3 Pro. 1080x1080, 360 frames in 47.3 s (4 subframes); 1080x1920 in 76.0 s. Determinism: the same frame
twice gives an identical hash; renderAt(0) == renderAt(6.0); renderAt(t) == renderAt(t + 18); frame 0 == frame 360; page seam diff 2.052 vs
neighbours 2.039 / 2.038 / 2.057 / 2.062; decoded MP4 seam 0.811 vs 0.756 / 0.752 / 0.787 / 0.777; x2 file frame 0 == frame N; 9:16 render seam
1.941 vs 1.922 / 1.923 / 1.953 / 1.976. Zero console errors in every run after the first dev run (one transient requestfailed on the font JSON
in the very first headless launch, not reproducible in 8 later launches).
Sound: 22 groups, every timed tonal part 0 samples off its (F+1) x 800 target (noise onsets -2.0 ms by design, texture +0.85 ms); over the bed
+3.54 .. +5.13 dB (logo notes +4.50 each, own +4.5 / +3.5 / +4.0 / +2.7); limiter 0.00 dB on every hit; master -14.0 LUFS, true peak -2.62 dBTP,
seam step 0.00026 vs p99.9 0.103; decoded MP4 audio -14.0 LUFS, -2.6 dBFS.
Delivery: audio 6.016 s vs video 6.000 s (+768 samples AAC padding, 16 ms; fades on the single-loop file); x2: 12.011 s vs 12.000 s; decoded
A/V lag 0 samples.

## Honest limits

- The violet is a thin accent (a rim streak on the blob and the bevel edges), not a field of colour; the chrome stays neutral on purpose.
- Frames inside the morph (e.g. N at frame 150) are legitimately mid-transformation; judge them as motion, not as stills.
- The 9:16 floor shows a faint mirrored reflection of the word (6% floor reflection, no longer masked by the black floor). Intentional.
