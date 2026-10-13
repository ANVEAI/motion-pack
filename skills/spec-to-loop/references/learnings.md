# Learnings: architecture, decisions and gotchas from the builds behind this skill

Every number here was measured on a real build. Builds are named by what they were: "liquid template, text LOOP (skill test)" is the
template rendering a 4-letter word from stock settings; "the maker's brand-word build" is the worked example in `example-spec.md`;
"public-edition smoke test" is the check run on this edition's scripts; "a dense-hit test score" is a 35-group score used to harden the
engine. Measured on an Apple M3 Pro (ANGLE Metal) with desktop Chrome, puppeteer-core 25, ffmpeg (libx264, aac_at), Python 3.11 with
numpy / scipy / Pillow. Expect other render times on other GPUs; the timing, level and seam numbers should not move.

## Contents
1. What "done" measured like
2. Architecture that worked
3. Decisions catalogue
4. Gotchas
5. The recipe

## 1. What "done" measured like

| build | picture | sound | delivery |
|---|---|---|---|
| liquid template, text LOOP (skill test), 1080 | 360 f in 34.9 s; seam 2.074 vs 2.042..2.078 (raw), 0.825 vs 0.767..0.799 (decoded); page QA PASS; 0 console errors | 15 groups, all timed parts 0 samples (texture onset 0.9 ms); +3.94..+5.22 dB over the bed; limiter 0; -14.00 LUFS, -1.41 dBTP; 5 rounds | 6.016 vs 6.000 s; A/V lag 0 |
| the maker's brand-word build, 1080 (and 9:16) | 360 f in 47.3 s, 1080x1920 in 76.0 s; seam 2.052 vs 2.038..2.062 (raw), 0.811 vs 0.752..0.787 (decoded); page QA PASS | 22 groups, tonal parts 0 samples, noise -2.0 ms (the lead, by design); +3.54..+5.13 dB; limiter 0; -14.0 LUFS, -2.62 dBTP; PASS in 5 rounds | 6.016 vs 6.000 s; x2 12.011 vs 12.000 s; lag 0 |
| public-edition smoke test: liquid template, text LOOP, 540 px | 360 f in 15.2 s; seam 2.049 vs 2.037..2.052 (raw), 1.229 vs 1.073..1.139 (decoded, 270 px); page QA PASS at 1080 | 15 hit groups, tonal 0.000 ms, noise -2.000 ms, texture +0.896 ms; +3.93..+5.23 dB; limiter 0; -14.0 LUFS, -1.42 dBTP; PASS after 2 rounds | aac_at: 6.016 / 12.011 s audio vs 6.000 / 12.000 s video; ffmpeg aac: 6.000 / 12.000 s; lag 0 with both |
| a dense-hit test score | | 35 groups, 39 timed parts: tonal 0 samples, noise -2.0 ms or 0; +3.36..+5.11 dB in the mix, own level -6.0..+4.52 dB; limiter <= 1.32 dB on any hit; -14.00 LUFS, -1.20 dBTP; 5 rounds | 8.000 vs 8.000 s (no AAC padding); lag 0 |

## 2. Architecture that worked (keep it)

- One pure `state(t)` / `updateScene(t, slot)`; everything else is an immutable table built once (springs integrated at 960 Hz over two
  loops, the second kept). The frame index is wrapped mod the loop before it becomes a time.
- A probe API on day one: `__project` (world -> pixel, unjittered), `__mean` (box mean of the last frame), `__propCheck` (fixture bboxes vs a
  forbidden rectangle), `__layout`, `__state`. Calibrate with numbers, then look. The liquid template ships `__state`, `__layout` and `__probeSdf`.
- Liquid template: one SDF (blob, droplets, glyphs) raymarched in a full-screen shader; the glyph SDF is baked on the GPU from the exact
  outlines TextGeometry uses (`font.generateShapes` + `extractPoints(curveSegments)`), even glyphs in R and odd in G, each clipped by a slab
  halfway to its same-channel neighbour; cubic B-spline lookup; rounded-box extrusion = TextGeometry(height, bevel). The mesh pass includes
  the same scene GLSL and calls the same `chromeShade()`; a depth prepass + `EqualDepth` alpha blend so overlapping faces do not double-blend.
- A mesh-and-lights scene (when you write one): shadow map + HDR scene (MSAA 4) -> depth pass -> emissive-only pass (every mesh swapped to
  its emissive material or black, so occluders still hide sources) -> DOF -> normalised bloom -> composite (white balance to the key,
  exposure, a C1 shoulder, vignette) -> 4 subframes averaged in linear light -> sRGB, grain, dither.
- Kelvin -> linear sRGB via the Planckian locus, luminance-normalised; white-balance the picture to the key light so neutral reads
  neutral; emissives multiplied by the key colour and divided by the exposure so they read their design hex.
- Frames out: `readRenderTargetPixels` -> base64 through CDP -> ffmpeg stdin. About 0.13 s per 4-subframe 1080 frame on the liquid
  template (47.3 s for 360 frames).

## 3. Decisions catalogue (readings that worked; reuse them, write new ones the same way)

Picture
1. "Quarter-pixel jitter, 4 offsets from frac(t*fps)": subframe k at n/fps + k/(4 fps), slot floor(frac(t*fps)*4) = k; rotated grid
   (-.375,-.125) (.125,-.375) (.375,.125) (-.125,.375) px; the same offset in the raymarch and in projectionMatrix[8,9].
2. Supersample average in linear light: liquid in HDR before bloom (bloom comes from the true average); a lit-mesh scene after its
   per-subframe grade, before the sRGB encode. Write down which.
3. "Smooth-min k falling as droplets part": per-neck k; each gap scheduled as g = k/2 + v (u - t_pinch), so the neck breaks exactly on its
   frame; part speed high enough (0.9 units/s) that no pair re-joins (check numerically).
4. "Droplets sized by glyph area": a disc of equal area, scaled so parted neighbours keep > k/2 apart (not volume-conserving; reads as beads).
5. "Overshoots N%": a back-out ease with its constant solved numerically for a 1 + N peak; the vertical on a faster clock so the path curves.
6. "Bevels start puffy and spring flat": r(t) = flat + (puffy - flat) e^{-decay t} cos(2 pi f t) on the same core.
7. "An N-bounce wobble (amplitude A, damping d)": y-scale 1 - A d^(2 f t) cos(2 pi f t), f = the sound's wobble frequency; on wrapped time so
   it runs through frame 0; tapered to 0 before the next action.
8. "Black beyond z so faces reflect dark": albedo -> 0 across a 0.3-unit band at that z, the floor reflection with it.
9. Geometry the spec leaves open (softbox sizes, flag widths): choose, list in DECISIONS, keep the named numbers literal.
10. A squash written "AxB" is horizontal x vertical (x and z share the horizontal). A bare "damping N" is a damping ratio at the spring's
    stated (or chosen and recorded) frequency.
11. "Limbs lag N frames": the driver is the body's motion delayed by N frames, fed through a spring.
12. A light flicker is quantised to the output frame, so the 4 subframes do not smear it.
13. "Grade so X reads #RRGGBB": white balance to the key + one exposure, calibrated by pixel probes of the real frame, not by eye.
14. "Lights-off near N%": the display brightness ratio lights-off / lit, measured by probe.
15. "An N-degree pool at M cd": N is the full cone angle; keep the spec's number literal and scale the other lights instead.
16. When a ruler, a constant speed and landing frames are all given, derive the implied constant (units per frame) before building.
17. States that switch on during the loop (labels, lights) snap back to their frame-0 state before the seam: the loop closes on frame 0.
Sound
18. "Each hit lands 1 frame after its visual event" = the designated peak on (F + 1) x SR/fps, F = the VISUAL frame. Bed events too (one rule).
    If a sound list names frames that differ from the picture's, keep both literally and record it.
19. "3 to 6 dB over the bed, K-weighted, first 60 ms" = hits stem vs bed stem, BS.1770 K filter (48 kHz coefficients), sum of channel mean
    squares over [target, target + 2880). The group's own isolated level is reported beside it and must stay >= -6 dB (audible alone).
20. "Peak sample vs its target" is measured on each group's isolated tonal part (the mix window contains neighbours' tails and onsets).
21. Hits on the same frame are one group; the tonal crest owns the sample; noise peaks 2 ms earlier (default `noiseLeadMs`).
22. "Pitch follows the squash": instantaneous pitch = root x the squash trajectory itself.
23. "Offbeat shaker only where no hit plays": offbeats = beat + 15 frames, dropped inside any hit's active window.
24. Master: a look-ahead true-peak limiter run circularly (3 tiled loops, keep the middle), gain by bisection on integrated LUFS.
25. 2 ms fades only on the single-loop MP4's audio; the master WAV and the two-loop file have none.

## 4. Gotchas (each cost a round)

Picture / pipeline
1. three r160 TextGeometry: `height`, not `depth`.
2. Headless Chrome can fall back to a software renderer (SwiftShader): verify `WEBGL_debug_renderer_info` before rendering (the scripts refuse).
3. A favicon 404 is a console error: `<link rel="icon" href="data:,">`.
4. A single whole-string glyph SDF cannot drive per-glyph morphs: alternate channels + per-glyph slabs.
5. Bilinear SDF = faceted chrome: cubic B-spline lookup; normal step 0.0011.
6. `extractPoints` repeats the closing point: drop segments shorter than 1e-7 (0/0 in the distance shader).
7. Mesh reflection rays started inside the SDF letters (bicubic vs polygon differ ~0.002): escape the shell first.
8. Necks re-joined 2 ms after the break at a part speed of 0.6 units/s (velocity stretch): 0.9 units/s and a numeric check.
9. Simplex amplitude 0.05 at frequency 1.7 read as a lumpy potato in chrome: keep the amplitude (binding), lower the frequency (1.15).
10. Float frame index: add 1e-6 before every floor, or the jitter slot / grain seed is wrong and frame N != frame 0.
11. Bit-exact periodicity: wrap the frame index mod the loop BEFORE converting to time.
12. Across browser launches 1 pixel in 1.17 M has differed by 1 LSB: compare launches by pixel diff, same-page renders by hash. (The
    public-edition smoke test found two launches bit-identical at 540 px.)
13. "Washed out" is calibration: probe the hero's pixel, set the exposure; let white props clip, darken textures under them for headroom.
14. An unnormalised bloom pyramid blows up (~4x): `mix(high, tent(low), 0.5)`; mask the halo inside emissive silhouettes.
15. A dielectric "emissive" face gets white specular: an unlit material, pre-multiplied emissive.
16. A coloured point light tints the hero: keep it weak.
17. Four jittered key positions = four stacked hard shadows: a 32-tap Vogel-disc PCF patched into `ShaderChunk.shadowmap_pars_fragment`
    before the first compile.
18. Flat text on a horizontal surface foreshortens at a low camera: pre-stretch the glyphs along the view axis (1.75x at 30 degrees).
19. White-on-white emissives do not read: a dark frame, a dark off-state and a tinted emission, so the click is a step.
20. "Keep props out of the label area" is measurable: project fixture bboxes over many frames against the rectangle (a first pass failed on 37 of 120 frames).
21. `function foo` at the top level of a classic script is `window.foo`: `window.foo = () => foo()` recurses forever.
22. Shared GPU: 60 frames that took 12 s on a free GPU took 700 s while a 3D app rendered. One job at a time, timeouts, never a retry loop.
23. Agent shells may reset the working directory between calls: always use absolute paths.
24. Check free disk before every render (the scripts stop under 6 GiB by default); stream frames, never a PNG sequence.
25. A saturated rim emissive must be calibrated by pixel probe: at intensity 10 #4A18ED clipped blue and read magenta; 1.3 probed (80, 26, 251).
26. A 9:16 reframe needs the camera pulled back (x1.75 for a 2.65-unit-wide word) and the black camera-side floor moved back with it,
    or a slanted black band shows at the bottom (`?dolly=` does both in the liquid template).
27. ffmpeg 8 tags the stream's colour from the frames and ignored `-color_primaries` / `-color_trc` (the files said "unknown"): render.mjs
    adds `setparams=...bt709` to the filter chain. Check the tags with ffprobe after any ffmpeg upgrade.
28. A comment inserted in the middle of an argument array can silently drop the arguments after it: the smoke test caught an encode
    that had fallen back to ffmpeg's default CRF (25 KB instead of 1.2 MB per second at 540 px). Compare file sizes against the last good run.
Sound
29. A 4x WaveShaper and phase-0 sines put peaks milliseconds late (the oversampling adds latency): cosine-crest JS buffers, no waveshaper.
30. Sine-phase harmonics move a peak off its target sample: cosine phase everywhere; reduce the crest with fewer or smaller harmonics.
31. All partials + a kick cresting on one sample: the limiter took 2.8 to 3.4 dB in two builds. Lower the sub / kick under it, put sustained
    energy in random-phase components (a chord bloom), use a weaker noise slap.
32. A BiquadFilter AFTER a noise envelope smears its peak 7-13 ms: filter the raw noise, then envelope, and anchor on the loudest sample.
33. Anchoring noise exactly on the target makes it stack with the tonal crest of the same group: give noise a 2 ms lead in mixed groups.
34. Spark tings and blooms are not "late hits": classify them as scatter (level only, never timed), or the timing check fails by 15-80 ms.
35. Dense runs (one hit per frame): each 60 ms window holds ~3.6 hits, so a tick at bed level alone reads ~+5.6 dB in the mix. Per-group
    nudging oscillates; solve all trims at once (bounded least squares on the energy model) with an own-level floor of -6 dB and equal levels
    for adjacent hits. Without the floor the solver "passed" by trimming three ticks to -30 dB.
36. The bed decides whether hits read: if every hit is low in round 0, lower the pad first (one move lifted all hits ~4.5 dB).
37. Reverb with `normalize = true` breaks bed + hits = mix; use an energy-normalised seeded IR and `normalize = false`.
38. Oscillators not reset per loop (329.63 Hz x 8 s is not whole cycles) make loop 2 differ from loop 3: build pads from buffers, or
    start / stop oscillators per loop; render three loops and keep the middle.
39. AAC: aac_at primes 2112 samples (trimmed by its edit list, decoded lag 0) and pads to 1024-sample frames (6 s -> +768 samples, 16 ms;
    8 s -> none, 375 x 1024). ffmpeg's own aac encoder (8.0.1) wrote an edit list that trims the padding too (audio 6.000 s). Fade the
    single-loop file anyway (96 samples each end): a player may ignore edit lists.
40. A noise-only group (click, swish) at a loud spot of the bed can need the limiter: more body (a longer thunk), less burst.
41. The peak guard must touch only tonal + scatter content: guarding a whole group crushed a loud creak sharing a frame with a ping by 11.4 dB.
42. Panning costs headroom: an equal-power pan to 0.9 raises one channel's peak ~2.6 dB at equal K-weighted loudness; two hard-panned
    landings sat at +2.7 dB with the limiter working. Pan width 0.45 fixed it (then +3.36..+5.11, GR <= 1.32).
43. Low bass / kick add peak without K-weighted level; when a group is crest-limited, measure which stem owns the peak sample before
    changing anything (in that case it was the pan, not the bass).
44. A level tuner without memory oscillates on limiter-bound groups: once a group exceeded the limit at trim T, cap it at
    T - (GR - 0.8 maxGr) for the rest of the run (`_ceil` in trims.json).
45. Ringing notes in a melody: hits-stem tails count in the next note's 60 ms window. A 1.7 s bell 200 ms before the next note forced a
    -8.85 dB trim (own level -0.9 dB); a short decay (x0.18) on the passing notes and a long one only on the held last note gave own levels >= +2.7 dB.
46. `du -h` reports allocated blocks (80M for a 70.2 MB file after an overwrite on APFS): report sizes from the byte count (`wc -c`).
47. A passing table is not the finish: the brand-word build's first pass showed a note with own level -0.89 dB; the numbers passed, the
    design did not. Look at (and listen to) the thing itself.

## 5. The recipe (what the skill automates)

1. Spec -> a timeline table in frames (every event, its frame, what changes); derive implied constants first.
2. CONFIG first, DERIVED next (picture and score frames from the same numbers), then the creative code.
3. Stills at event frames at 540 px (fast) -> look -> fix -> repeat; then the probes for colour, contrast, layout.
4. Score: `score.mjs --rounds 5`; read the table; if a hint says crest-stacked or neighbour-dominated, change the voicing, not the trims.
5. Full render (GPU verified) -> mux -> check_loop on the DELIVERED MP4 -> look at the sheets -> write DECISIONS + measurements.
