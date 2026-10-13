# Spec template: video + sound (fill top to bottom, then show it to the user before building)

Rules while filling: every adjective gets a number; sync-relevant times are FRAMES (give seconds too where feel matters);
state intent once with "so ..."; the last motion must run through frame 0. Delete the hints in [brackets].
A filled, built and measured example is `example-spec.md`; `spec-anatomy.md` explains what each clause buys.

---

## Video

**<Title>: <D> s seamless loop, <FPS> fps (<NF> frames), <W>x<H>, one HTML file, three.js 0.160.0 via jsDelivr importmap only**
[Prefer D where D x 48000 is a multiple of 1024 (8 s, 16 s) so AAC adds no padding. Brand font: name it and the weight to pin; it is
baked with `scripts/ttf2typeface.py`. Text drawn in 2D: name the web font and where it loads from.]

`window.renderAt(t)` sets everything from t in seconds; all motion and noise periodic in <D> s; seeded random only; with `?t=` never
start requestAnimationFrame; `window.__ready` after <fonts / textures / bakes>. Frame <NF> equals frame 0.
Quarter-pixel camera jitter, 4 offsets from frac(t*<FPS>), averaged in linear light.

**Set**: <floor / backdrop: colour hex, position y>, <props with sizes in scene units>, <what the background reads as>.
**Hero**: <object: dimensions or counts (voxels, radius, glyph size)>, <how it is built: SDF / mesh / instanced>.
**Materials**: <hero: F0 or base colour hex, roughness, clearcoat / metalness, bounces>; <floor: albedo, reflection %>.
**Lights / environment**: <for each: type, Kelvin or hex, intensity (cd / nits / relative), azimuth and elevation from the camera,
size in degrees or units, switch-on frame and behaviour (e.g. a 3-frame flicker)>. <Intent: "so ...">.
[Saturated accent colours: add the pixel value a probe must read, e.g. "the brightest rim pixel within 10 of (42, 165, 151)".]

**Timeline** [a table first; then one line per beat with a physical verb and a number]

| frames | seconds | beat | numbers |
|---|---|---|---|
| 0 - <f1> | 0 - <s1> | <idle / breathe> | <amplitude %, period> |
| <f1> - <f2> | | <anticipation> | <squash %, frames> |
| <f2> - <f3> | | <action> | <stretch x, arc height, overshoot %, stagger frames> |
| <f3> - <f4> | | <hold> | <what still moves: glint, orbit> |
| <f4> - <NF> | | <return through frame 0> | <settle: amplitude %, damping, Hz> |

**Camera**: <fov or lens>, <distance keyframes by frame>, <orbit degrees and centre frame>, <elevation>, <push / punch % and frames>.
**Post**: bloom <threshold, strength or "on emissives">; tone curve <linear to x, shoulder>; vignette <%>; grain <%> seeded by frame index;
<DOF focus target>; <dither for flat backdrops>.

---

## Sound

Score this seamless <D> s loop (<NF> frames, <FPS> fps). Synthesize everything in code with the Web Audio API, no samples, no downloads.
Each hit lands 1 frame after its visual event.

**Bed**: <BPM>, <meter>, <bars of N frames starting on frames a, b, c ...>; <key / chords per bar>; <instruments and where each rests>;
<voices that follow picture events, e.g. a pad voice per light following its flicker>.

**Events** (VISUAL frames; one line per family):
- <family>: <frames> : <character: pitch / scale / filter / pan rule, how it follows the picture's physics>
- ...

48 kHz stereo WAV, about -14 LUFS, peak -1 dBTP, every hit (or pair on one frame) 3 to 6 dB over the bed (K-weighted, first 60 ms),
look-ahead limiter at most 1.5 dB on any hit, no click at the seam. Mux into the MP4 (single loop with 2 ms raised-cosine fades on the
first and last 96 samples; a two-loop file from the seamless master).
[These are the house defaults the scripts check; change them in `CONFIG.SCORE.master` if a platform asks for others.]

---

## Follow-up (correction round) format

Number them. One paragraph each. Symptom measured on the render or the stems, cause, physical fix with numbers, acceptance criterion,
and the number measured after the fix.

> 1. <What is wrong, measured: "the rim accent probes (120, 200, 190), not #2AA597 = (42, 165, 151)"; "the kick peaks 9 ms late">. <Cause>.
>    <Fix with numbers: "rim intensity 1.4 -> 0.9", "every harmonic in cosine phase", "decay x0.18 on the passing notes">. <Acceptance:
>    "within 10 of the target", "0 samples off (F+1) x 800">. <Measured after.>

## DECISIONS (in the project's LEARNINGS.md)

| # | clause (quoted) | reading chosen | why |
|---|---|---|---|
| 1 | | | |
