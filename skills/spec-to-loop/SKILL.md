---
name: spec-to-loop
description: Write a binding, frame-keyed motion-and-sound spec from a one-line brief, then build it as a seamless, deterministic generative 3D loop (three.js, WebGL or raymarched) with a synthesized Web Audio score, GPU-rendered with 4x supersampling and checked by measurement. Use this skill whenever the user wants a seamless loop video, a liquid-chrome or metallic type loop, a logo or wordmark loop, an abstract 3D motion piece or background plate, a motion prompt or motion spec written or built, or a score whose hits land on exact frames, even if they only say make a loop. Covers the spec format, the renderAt(t) page contract, streaming GPU render to MP4, hits on sample (F+1) x (sample rate / fps), measured correction rounds (-14 LUFS, true peak, hits 3 to 6 dB over the bed) and seam QA. For edits of footage, captions or multi-shot ads use motion-pack instead.
license: MIT
compatibility: Node 20.15+ (or 22+) with puppeteer-core, Chrome or Chromium on a hardware GPU (ANGLE Metal, D3D11, Vulkan or GL), ffmpeg with libx264, Python 3.10+ with numpy, scipy and Pillow; fontTools only to bake brand fonts. Works in any agent that reads Agent Skills.
metadata:
  version: 1.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# spec-to-loop: from a one-line brief to a measured, seamless loop

Short generative loops (a few seconds, 60 fps) whose picture is computed on the GPU and whose score is synthesized in code, held to
numbers: every motion has a frame, every hit lands on an exact sample, every claim in the delivery is measured from the delivered file.
The method has two halves. First write a spec where every adjective is a number. Then build it from a template whose page is a pure
function of time, render it on the real GPU, score it, and correct it in measured rounds until the tables pass and the stills look right.

## Where this sits in the pipeline

The suite runs story-script -> frame-design -> motion-pack (+ spec-to-loop, Blender plates) -> motion-stack -> social-video.
- **Inputs**: a `spec.md` written from `brief.md`, or from a shot in `shotlist.json` / `plan.json` that calls for a computed loop.
  `design.json` from frame-design supplies the accent hex (rim and emissive colours, calibrated by pixel probe), the display font (bake it
  with `scripts/ttf2typeface.py`) and the look.
- **Outputs**: `out/<name>.mp4` (single loop), `out/<name>-x2.mp4` (two loops), the master WAV, `qa/` (stills, contact sheets, JSON
  reports) and the project's `LEARNINGS.md`. motion-pack composites the MP4 as a plate, or social-video posts it as a loop.

## When to use (and when not)

- **Use it** for a loop the spec can describe in numbers: a hero object, a studio, a timeline in frames, a camera, post, and a sound track
  keyed to frames. Brand wordmark loops, liquid-metal type, abstract 3D plates and backgrounds all fit. Also use it to WRITE such a spec from
  a brief, even when someone else will build it.
- **Do not use it** for edits of real footage, captioned talking heads, multi-shot ads or slide-like explainers: that is motion-pack (and
  its renderer). Diagram or math explainers belong to a diagram animation tool; photoreal product plates to motion-pack's Blender recipe.
  The test: if the picture is computed and must loop bit-exactly, it is this skill.

## Folder map (paths relative to this skill's folder)

| path | what |
|---|---|
| `templates/liquid-chrome.html` | raymarched chrome blob that breathes, pinches into droplets, and forms extruded letters (any text, any typeface JSON), studio environment, glint sweep, drain and remerge through frame 0; GPU SDF bake + TextGeometry mesh cross-fade; full score in CONFIG |
| `templates/lib/score-engine.js` | the sound engine: voices, cosine-crest tonal buffers, grouping, peak guard, wrap-around OfflineAudioContext render, stems |
| `scripts/render.mjs` | headless Chrome on the hardware GPU: GPU check, 4 jittered subframes per frame, raw RGBA streamed to x264; `--qa` (determinism + seam + console) and `--stills-only` |
| `scripts/score.mjs` | runs the page's `CONFIG.SCORE` through the engine (no GPU needed); `--rounds N` = N measured correction rounds, then the master |
| `scripts/measure_audio.py` | per-hit timing, level over the bed, limiter gain reduction; master LUFS / true peak / seam; `--tune` solves trims; `--write` masters |
| `scripts/mux.sh` | single-loop MP4 (2 ms fades) + two-loop MP4 (seamless), AAC 256k, durations |
| `scripts/check_loop.py` | page QA + decoded-video seam + event stills + 1-fps contact sheet + ffprobe + A/V lag |
| `scripts/ttf2typeface.py` | pin a variable font's weight and bake chosen glyphs to a three.js typeface JSON next to the page |
| `references/spec-template.md` | blank video + sound spec to fill from a brief, plus the correction-round and DECISIONS formats |
| `references/example-spec.md` | a complete worked example (the maker's wordmark loop) with its corrections, decisions and measurements |
| `references/spec-anatomy.md` | that example clause by clause: what each clause buys; the "what makes a spec good" checklist |
| `references/learnings.md` | architecture, a decisions catalogue, 47 gotchas and the measured results of the builds behind the skill |

## Quick start: a new loop in one session

One-time setup: `npm i puppeteer-core` in this skill's `scripts/` folder or in the project (the scripts also find it on NODE_PATH, in the
full `puppeteer` package, or in the npx cache), and `pip install numpy scipy pillow` (+ `fonttools` for brand fonts). Chrome is found via
`--chrome PATH`, `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH`, or the standard install locations on macOS, Windows and Linux.

```bash
S=<this skill's folder>; P=<project folder>; mkdir -p "$P"
cp "$S/templates/liquid-chrome.html" "$P/page.html"
# 1. edit ONLY the CONFIG block first: text, font, colours, timings in frames, camera, studio, sound levels
node "$S/scripts/render.mjs" "$P/page.html" "$P/out/x.mp4" 0 60 540 --stills-only --stills 0,84,112,150,222,300,337 --stills-dir "$P/qa/dev"
#    LOOK at the stills; iterate on CONFIG (and on the template code for new ideas)
node "$S/scripts/score.mjs" "$P/page.html" "$P/out" --rounds 5   # stems -> measured correction rounds -> master WAV + fade copies
node "$S/scripts/render.mjs" "$P/page.html" "$P/out/video.mp4"    # the full loop at CONFIG size, 4 subframes, streamed
bash "$S/scripts/mux.sh" "$P/out/video.mp4" "$P/out"
python3 "$S/scripts/check_loop.py" "$P/page.html" "$P/out/<name>.mp4" "$P/qa" --x2 "$P/out/<name>-x2.mp4" --master "$P/out/<name>-master.wav"
```
- Brand font: `python3 "$S/scripts/ttf2typeface.py" MyFont-Variable.ttf "$P/assets/myfont-800.typeface.json" LOOP --wght 800`, then
  `CONFIG.font.url = 'assets/myfont-800.typeface.json'` (relative: render.mjs serves the page's folder). Check the font's licence.
- Letters landing one after another: `timeline.launch: [..]` (frames, one per glyph) plus `timeline.form.stagger`.
- 9:16: `render.mjs page.html out/v916.mp4 --query "w=1080&h=1920&dolly=1.75"` (the dolly factor also moves the black floor back; 1.75
  fitted a 2.65-unit-wide word), then `bash mux.sh out/v916.mp4 out <name>-9x16`.
- Every script exits 0 only when its numbers pass. Read the printed tables; look at `qa/contact_events.png` and `qa/contact_1fps.png`.
- Speed for planning: the worked example rendered 360 frames at 1080 in 47.3 s on an Apple M3 Pro; this edition's smoke test rendered
  360 frames at 540 px in 15.2 s and scored in about 16 s. Other GPUs differ; render one second first and extrapolate.

## THE METHOD

### 1. The spec (read `references/spec-anatomy.md` once, then fill `references/spec-template.md`)

A good motion spec is a list of measurable promises. In order:
1. **Format line**: duration in seconds AND frames, fps, size, "one HTML file", pinned library versions and where they load from.
2. **Determinism contract**: `window.renderAt(t)` sets everything from t; seeded random only; periodic in the loop length; with `?t=` never
   start requestAnimationFrame; `window.__ready` after fonts, textures and GPU bakes; frame N equals frame 0.
3. **Set and hero** in scene units (sizes, counts, positions) and hero proportions (radius, glyph size, depth, bevel).
4. **Materials with physical numbers**: F0, roughness, bounces, hex colours, reflection %, albedo.
5. **Lights in physical terms**: Kelvin or hex, intensity, azimuth / elevation from the camera, sizes, when each switches on.
6. **Timeline in frames with physical verbs**: "squash 10%", "overshoot 7%", "12 frames apart", "breaks on frame 110", "springs flat at
   1.6 Hz". A reader must be able to compute the pose on any frame.
7. **Camera**: lens (fov), distances, orbit degrees, which frame each move starts and ends on; it returns to its frame-0 value.
8. **Post**: bloom threshold / strength, tone curve, vignette %, grain % seeded by frame index.
9. **Sound keyed to frames**: "synthesize in code, no samples", "each hit one frame after its visual event", the bed in bars that start on
   named frames, every event on its frame, the loudness line, "seamless", "mux into the MP4".
10. **Correction rounds**: after looking at renders or measuring stems, write numbered corrections: measured symptom, cause, physical fix,
    acceptance criterion, the number after. The final state after all of them is the spec.

**From a brief**: decide the loop length first (it fixes every period: breathing, orbit, noise cycle; a length whose sample count is a
multiple of 1024, such as 8 s, leaves no AAC padding). Lay the timeline out as a table of frames before any prose, give every motion a verb
and a number, put each sound event on the frame of its visual event, and finish with the loudness line. Show the spec to the user before
building: it is cheaper to change a number than a render.

**Ambiguity**: choose the reading a careful motion designer would mean, write it as a numbered DECISION in the project's `LEARNINGS.md`
(clause, reading, why) and keep going. Never stall on an ambiguity; never silently drop a number.

### 2. Build from the template

- Copy the template and change the CONFIG block first. A new loop should be a config edit plus creative work in the module; the worked
  example (`references/example-spec.md`) changed CONFIG and rewrote only the sound part of DERIVED.
- **The page contract** (the scripts rely on it; any new template must implement it): `window.CONFIG` (`fps`, `loopFrames`, `width`,
  `height`, `qaFrames`, `SCORE`, `name`), `window.__ready`, `window.__error`, `window.__gpu`, `renderAt(t)` (one jittered sample),
  `renderFrame(n, fps)` (4 subframes averaged in linear light), `captureFrame(n, fps)` (base64 RGBA, top row first), `__hashFrame(n, fps)`,
  `__hashAt(t)`; a `<script id="config">` block that defines CONFIG and builds `CONFIG.SCORE` without the GPU. Query: `?t=` one frame and
  no rAF, `?norun`, `?size=`.
- **Determinism rules**: no `Date`, `Math.random` or `performance.now`, no state carried between calls. Things that look stateful (springs,
  follow-through) are immutable tables integrated once from constants over two loops (keep the second). Wrap the frame index mod the loop
  before it becomes a time (`sin(2 pi t / L)` at t = L is not exactly 0). Noise must travel a circle in its domain.
- **Picture and sound share numbers**: CONFIG's DERIVED section builds `C.SCORE` from the same frames as the picture. A sound event's
  `frame` is the VISUAL frame; the engine adds the one-frame delay. That is why a timing change can never desync the two.
- **Build a probe API on day one** (`__state`, `__layout`, pixel probes) and calibrate colour, contrast and framing from numbers, then look.

### 3. Render (`scripts/render.mjs` does all of this; know why)

- Headless Chrome with ANGLE on the hardware GPU (`--use-angle=metal` on macOS, `d3d11` on Windows, Chrome's default on Linux; `--angle`
  overrides) plus `--ignore-gpu-blocklist --enable-gpu-rasterization`, in a fresh temporary profile (never the user's). It reads
  `WEBGL_debug_renderer_info` and **refuses to render** unless the renderer names a hardware GPU: a SwiftShader fallback is far slower and
  does not give the same pixels.
- 4 subframes per output frame at `t = n/fps + k/(4 fps)`; the quarter-pixel jitter slot is `floor(frac(t*fps)*4)` (= k) on a rotated grid
  `(-.375,-.125) (.125,-.375) (.375,.125) (-.125,.375)` px, injected identically into the raymarch and `projectionMatrix[8,9]`. The average is
  4x SSAA plus a 360-degree shutter. Average in linear light (the template accumulates RGBA32F HDR before bloom); record the choice in DECISIONS.
- Raw RGBA streams to ffmpeg stdin (`libx264 -profile:v high -preset slow -crf 12 -pix_fmt yuv420p`, bt709 tags via `setparams`, exact
  `-frames:v`, `+faststart`). Never a PNG sequence: QA stills only (at most 60 per call). Disk is checked first (default: stop under 6 GiB).
- The GPU is often shared: one render at a time, generous timeouts, never a retry loop.

### 4. The score (`templates/lib/score-engine.js`)

- Everything is synthesized: JS-built buffers scheduled through an `OfflineAudioContext(2, 3N, 48000)`; the middle of three loops is kept,
  so tails and pre-rolls wrap across the seam (seamless by construction). Reverb is a ConvolverNode with a seeded, energy-normalised IR and
  `normalize = false`, so the stems stay linear and bed + hits = mix exactly.
- **Placement**: a frame-F event's designated peak lands on sample `(F + 1) x SR / fps` (= (F + 1) x 800 at 48 kHz and 60 fps).
- **Tonal hits**: phase integrated outward from theta = 0 at the anchor, every partial `cos(r * theta)`, a sin^2 attack that ends on that
  crest: the absolute peak is the anchor sample (measured error 0 samples in every build). Envelopes and AM after the crest must be 1 at t = 0.
  **No WaveShaper** (its oversampling adds latency, so peaks land milliseconds late) and **no phase-0 sines** (they peak a quarter cycle late).
- **Groups**: events on the same (bus, frame) are summed with anchors aligned. The tonal crest owns the target sample; a noise peak in the
  same group lands `noiseLeadMs` (default 2 ms) earlier so two peaks never stack on one sample; `scatter` voices (spark tings, a
  random-phase chord bloom) follow the crest and are never timed. Tonal groups get a peak guard on their tonal + scatter parts only (later
  content above 0.76 x the crest within 60 ms is pulled down by a smooth gain, never clipped; noise is never guarded).
- Voices: `tone` (pitch: a number, `{drop}`, `{approach}`, `{glide}`, `{glideIn}`, `{spring}`, `{wobble}` or a function), `noise` (riser or
  burst, filter glide), `texture`, `click`, `creak`, `swish`, `boing`, `sparkle`, `bloom`, `whoosh`; bed: `pad` (per-frame level steps can
  follow a light's flicker), `bass`, `shaker`; or any `function(kit, ev) -> {L, R, anchor, kind}`.
- The master is made in Python: gain by bisection on BS.1770 integrated loudness after a circular look-ahead limiter whose detector is the
  4x-oversampled peak (ceiling -1.2 dBFS, so the true peak stays at or under -1 dBTP).

### 5. Measure and correct (the follow-up loop)

`score.mjs --rounds N` = render -> `measure_audio.py --tune` -> render ... -> `measure_audio.py --write`. The table it prints, with the
house defaults (set in `CONFIG.SCORE.master`):

| metric | how | default pass |
|---|---|---|
| timing, tonal | isolated tonal part of each group, argmax vs `(F+1) x SR/fps` | 0 samples (<= 1) |
| timing, noise / texture | loudest sample / first sample above 1e-4 x max | within 1 frame / 1 ms |
| level over the bed | hits stem vs bed stem, K-weighted, 60 ms from the target (what is heard) | 3 to 6 dB |
| own level | the group alone vs the bed (context; the solver's basis) | >= -6 dB (audible on its own) |
| limiter GR per hit | min gain from target - 5 ms to + 60 ms | <= 1.5 dB |
| master | integrated LUFS; true peak (4x resample_poly); seam step and 2nd difference vs their 99.9th percentile | -14 +- 0.5; <= -1.0 dBTP; <= p99.9 |

The tuner solves instead of nudging groups one by one (nudging oscillates when hits overlap): window w's K-weighted energy is modelled as
the sum of each group's own energy in that window times its trim power, rescaled each round by measured / predicted, then a bounded
least-squares fit puts every window on 4.5 dB, keeps each group's own level in [-6, +6] dB, keeps adjacent dense hits equal, and remembers
a ceiling for groups the limiter has squeezed. The stock template passed in 2 rounds in this edition's smoke test and in 5 rounds in earlier
builds; use 5.

| failure | meaning | fix |
|---|---|---|
| tonal peak late by milliseconds | waveshaper, phase-0 sine, or sine-phase harmonics | cosine-crest buffers, every harmonic in cosine phase |
| level and limiter alternate (hint "crest-stacked") | a peak without 60 ms of energy (noise peak, sub, kick, phase-aligned partials on one sample) | voicing: lower the peaky part, raise the sustained part, random-phase bloom, 2 ms noise lead; trims cannot fix it |
| crest-limited and the stems look innocent | a hard pan: equal loudness, one channel ~2.6 dB hotter at the peak | narrow the pan (width 0.45 worked) |
| hint "dominated by a neighbour" | an earlier tail or the next onsets fill this window | shorten / lower the tail, space the hits (the worked example's correction 2) |
| solver trims a hit toward -30 dB | its window is already full (numbers pass, the design breaks) | the own-level floor exists for this: never relax it to make a table pass |
| every hit below the bed in round 0 | the bed (pad) is too loud | lower the bed first (one move lifts every hit), then solve |
| seam step > p99.9 | something not periodic (an oscillator not reset per loop, a tail not wrapped) | build the bed from buffers or per-loop oscillators; render 3 loops, keep the middle |

### 6. Mux (`scripts/mux.sh`)

Keep the seamless master WAV (24-bit). (a) Single-loop MP4: audio = the master with a 2 ms raised-cosine fade on the first and last 96
samples ONLY: AAC works in 1024-sample frames, so a 6 s loop's audio can run 16 ms past the video and a looping player would otherwise start
and stop on a hard step. (b) Two-loop MP4: the video read twice by stream copy (`-stream_loop 1`) + the master tiled twice, no fades. AAC
256k via `aac_at` when ffmpeg lists it, else ffmpeg's `aac` (`AAC_ENCODER` forces one). Both measured A/V lag 0; aac_at left 16 ms of
padding on a 6 s loop, ffmpeg's aac trimmed it in its edit list. It reports audio vs video duration from ffprobe.

### 7. QA checklist (all scripted; then LOOK)

- [ ] GPU renderer string names the hardware GPU (render.mjs refuses otherwise)
- [ ] determinism: the same frame twice = the same SHA-256; `renderAt(0) == renderAt(L)`; `renderAt(t) == renderAt(t + 3L)`; frame 0 == frame N
- [ ] seam: diff(N-1 -> 0) within 1.5x its neighbours (page frames and the decoded MP4); the x2 file's frame 0 equals frame N
- [ ] stills at every event frame (`CONFIG.qaFrames`) + the 1-fps contact sheet, decoded from the DELIVERED MP4; look at poses, framing, colour
- [ ] colour targets and layout rules as numbers via page probes (an accent within 10 of its target, nothing clipped by the frame edge)
- [ ] zero console errors and warnings (a favicon 404 counts: `<link rel="icon" href="data:,">`)
- [ ] ffprobe: frames, fps, size, H.264 High yuv420p, bt709 tags, durations; A/V lag 0; the audio table PASS
- [ ] DECISIONS and measurements written into the project's `LEARNINGS.md`; QA PNGs kept to what you will look at

### 8. Gotchas (details and numbers in `references/learnings.md`)

1. three r160 `TextGeometry` reads `height`, not `depth` (depth is silently ignored).
2. Software-renderer trap: headless Chrome may fall back to SwiftShader; check the renderer string (the scripts do).
3. Floating-point frame index: `n/60 + k/240` times 60 can land a hair under the integer; add 1e-6 before every floor.
4. Bilinear SDF lookups facet a mirror at texel edges: cubic B-spline lookup (4 bilinear taps). Drop zero-length outline segments.
5. Mesh reflection rays start inside the SDF shell: step out first (`escapeT`), then trace.
6. Unnormalised bloom pyramids blow up (~4x); mask the halo inside emissive silhouettes.
7. Saturated accents clip past the tone knee and change hue: calibrate by pixel probe (the worked example's violet read magenta at
   intensity 10 and probed (80, 26, 251) at 1.3).
8. A dielectric "emissive" face gets white specular: use an unlit material, pre-multiplied to survive the grade.
9. Four jittered shadow casters = four stacked hard shadows: patch the PCF chunk to a Vogel disc before the first compile.
10. A top-level `function foo` in a classic script becomes `window.foo`: never write `window.foo = () => foo()`.
11. AAC padding and priming (above); 8 s loops have no padding (375 x 1024 samples).
12. Partials cresting on one sample overload the limiter: cosine phase for timing, but keep the K-weighted energy in random-phase or later components.
13. A ringing note's tail counts in the next note's 60 ms window: short decays on passing notes, the long ring only on the last.
14. ffmpeg 8 takes colour tags from the frames, not from `-color_primaries` / `-color_trc`: keep the `setparams` in the filter chain.
15. Shared GPU: a render that took 12 s free took 700 s while a 3D app rendered. Patience, timeouts, one job at a time.
16. To find a peak's owner, measure which stem and channel hold the limiter's sample (`bed.f32`, `hits.f32`, `own.f32` in `out/audio/`).
17. Never trust a passing table alone: the level solver once "passed" by trimming three ticks to -30 dB. Look at (and listen to) the thing itself.
