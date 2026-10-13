# Lane B (2D motion libraries): RESULTS

13 Oct 2026. Shot: "On the record", 1080x1920, 30 fps, 120 frames (`SPEC.md`; executable reference `b6-baseline/anim.js`). Harness: `skills/motion-stack/scripts/seekcheck.mjs` (12 samples, 4 cold pages, stills at 15/36/60/78/96/117, preview video). G4 = real HyperFrames 0.8.142 render (`render <dir> -o out.mp4 --video-bitrate 26M -w 2 --quiet`) after its own `lint` (0 errors, 0 warnings for all four DOM variants).

B1, B2, B3 and B6 were built and measured by me. B4 (Motion Canvas) and B5 (Remotion, plus the six Remotion skills) were built by two sub-workers working from `SPEC.md` and the same brief; I re-checked their stills, PSNR numbers and skill claims (quality scores below are mine, from the 100% stills and the all-frame comparison). Raw rows from the workers: `b4-motion-canvas/row.json`, `b5-remotion/row.json`, `b5-remotion/gates.json`.

## Recommendation

1. **Standardise 2D authoring on HyperFrames 0.8.142 + GSAP 3.15.0** (`gsap`, `SplitText`, `MorphSVGPlugin`, `MotionPathPlugin`, `CustomEase`; vendored copies, no CDN). The whole shot is 33 lines, the adapter is native, and it passes G1 to G4. Two settings make the gates bit-exact: `gsap.config({ force3D: false })` and a warm pass `tl.seek(tl.duration()).seek(0)` before registering the timeline (without them the mismatches are 1-LSB noise, 85 dB and above, but the gate reports them).
2. **Keep the pack's pure-function code (B6) as the component layer and as the correctness reference.** It is bit-exact with zero dependencies. Every other engine was judged against its stills.
3. **Allowed niches:** Anime.js 4.5.0 (MIT) for small DOM/SVG flourishes through `window.__hfAnime`, under four rules (below). The free `motion` package can generate CSS `linear()` springs offline at dev time (tested, below); it is not shipped into compositions.
4. **Not adopted:** Motion 13.4.5 (and 14.x) as a pipeline engine, Motion Canvas 3.17.2, Remotion 4.0.529. All three are deterministic once handled (Motion only after bypassing most of its API), none beats HyperFrames + GSAP on cost or integration.
5. **Skills:** adopt `gsap-core`, `gsap-timeline`, `gsap-plugins`, `gsap-utils` plus a short render-safe addendum (below). Do not adopt the six Remotion skills (wrong or outdated advice found) or the Motion AI Kit (hosted MCP, Motion+ paywall, UI-oriented advice that hurts offline capture).

Job to engine, in one place:

| Job | Use |
|---|---|
| Author a HyperFrames 2D composition (reveals, counters, shapes, icons, springs) | GSAP 3.15.0 |
| Shared components (type presets, captions, gfx) and reference stills | pack pure functions through `hf-seek` |
| Morph between different path structures | GSAP MorphSVG (or author matched structures: exact) |
| Small MIT-only flourish | Anime.js 4.5.0 through `window.__hfAnime` |
| CSS-only spring overlay | `motion` package `createGeneratorEasing` + `generateLinearEasing`, at dev time |
| React / Studio authoring, Lambda-scale batch renders | none adopted (Remotion would be the only candidate; paid licence above 3 employees) |
| Maths / diagram explainers | existing manimgx (Motion Canvas adds nothing) |

## Results table

| Variant | Package, version | Licence | G1 | G2 | G3 | G4 | worst PSNR | ms/frame | seek-only ms | PSNR vs B6 (min/mean) | Quality | LOC | deps MB | Bundler | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1-gsap | gsap 3.15.0 | GSAP standard no-charge | yes | yes | yes | yes | none | 168.9 | 0.02 | 35.7/73.09 | 4 | 33 | 6.3 | no | ADOPT |
| B2-animejs | animejs 4.5.0 | MIT | yes | yes | yes | yes | none | 152.6 | 0.27 | 34.92/71.43 | 4 | 32 | 2.6 | no | ADOPT-FOR flourishes |
| B3-motion | motion 13.4.5 | MIT (Motion+ parts paid) | yes | yes | yes | yes | none | 184 | 16.66 | 42.36/87.67 | 5 | 40 | 12.8 | no | REJECT |
| B4-motion-canvas | @motion-canvas/* 3.17.2 | MIT | yes | yes | yes | n/a | none | 232.0 | 33.3 | 51.39/54.47 | 5 | 254 | 106.1 | yes | KEEP-CURRENT |
| B5-remotion | remotion 4.0.529 + react 19.3.0 | Remotion License (paid above 3 employees) | yes | yes | yes | n/a | none | 31.7 (CLI) | n/a | 36.5/52.5 | 3 | 100 | 224 | yes | KEEP-CURRENT |
| B6-baseline | pack ease.js + presets.js | owned | yes | yes | yes | yes | none | 168.1 | 0.04 | 999.0/999.0 | 5 | 53 | 0.0 | no | KEEP-CURRENT |

Gates out of the box versus final (the table above is the final state; this is what each engine needed to get there):

| Variant | First harness run, written the way the brief and the skills describe it | What fixed it | Final |
|---|---|---|---|
| B1 GSAP | `__seek = (t) => tl.seek(t)` hangs the harness (thenable); default `force3D`: G1, G2, G3 all false at 85 to 108 dB; then G2 false at 84.9 dB (MorphSVG re-serialises the start path) | braces around the seek call, `force3D: false`, warm pass | all true |
| B2 Anime.js | bare `seek(ms)`: G2 false, real (17 to 30 dB: no initial states, stale gaps between chained tweens); then G2 false at frame 32 only, 41 dB and then 68 dB (`morphTo` rewrites `d` while the timeline is built) | `tl.set(..., 0)` initial states, rewind-then-seek, `accessible: false`, warm pass, synchronous build for HyperFrames | all true |
| B3 Motion | `animate()` with `d`, `opacity`, `offsetDistance`: no morph, flaky stills (WAAPI), G2 false at 29 to 41 dB (function segments hold stale values, and run late) | JS-only values through full-span function segments, initial state by hand, `frame.postRender` flush, `hf-seek` + `buildReady` for HyperFrames | all true |
| B6 pack | all true on the first run | none | all true |

Notes on the columns:
- **Gates** are the harness gates for the final page of each variant (both final runs). B4 and B5 are frame-based renderers: G1 to G3 were measured on their own pipelines (B4 through the player page in the shared harness, B5 by comparing CLI renders), G4 is "n/a" and their mp4 was pushed through HyperFrames as a `<video>` clip instead.
- **ms/frame** is the harness forward pass (seek + 2 rAF + 1080x1920 PNG screenshot), best of all post-final runs. The PNG screenshot is about 160 ms of it, so it barely separates the DOM engines; the machine was shared with the 3D lane and swung by up to 2x between runs. **Seek-only** is the engine cost with no screenshot (seek + forced layout). B5's 31.7 ms is the whole `npx remotion render` CLI (bundle, capture, x264) divided by 120: a different pipeline, not comparable.
- **PSNR vs B6** is over all 120 frames against the B6 harness stills. B6 compares at 999 dB with itself; the three DOM engines differ from it only where a library legitimately computes something differently (see "What the variants taught us").
- **deps** is installed `node_modules` for the engine; shipped bytes to the page are far smaller (B1 128 kB for five files, B2 115 kB, B3 143 kB, B6 13 kB).

Visual judgement (contact sheets at 100%, preview filmstrips, probe curves): the six variants are indistinguishable in text rendering, kerning, colour, counter, band line, chip and spring. They differ only in two places: the in-betweens of the circle-to-box morph (B6, B3, B4 exact; B1 and B2 lean; B5 turns faceted) and the document's route (B1 and B2 follow arc length, B3, B4, B5 and B6 follow the spec's Bezier-t; up to 12 px apart mid-flight). Scores: 5 = indistinguishable from B6 at 100% on all 120 frames, 4 = one smooth, visible in-between deviation, 3 = one visible artefact.

Measured motion curves (`tools/probe.mjs` seeks every frame and records geometry; `probe-compare.txt`; maximum absolute deviation from B6 over 120 frames, only where the element is visible):

| Channel | B1 GSAP | B2 Anime.js | B3 Motion |
|---|---|---|---|
| Word / char rise (y, px) | 0.15 | 0.01 | 0.08 |
| Highlight bar width (px) | 0.35 | 0.00 | 0.15 |
| Counter text (frames that differ) | 0 | 0 | 0 |
| Shape bounding box (px) | 0.03 | 0.01 | 0.02 |
| Band line draw-on | 0.35 | 0.00 | 0.00 |
| Document position (px) | 11.6 | 11.9 | 0.2 |
| Document angle (degrees) | 2.1 | 2.1 | 0.04 |
| Chip scale (spring) | 0.000 | 0.000 | 0.003 |
| Glow centre (px) | 0.01 | 0.01 | 0.01 |

B4 and B5 are not DOM-probeable (canvas, and a bundled player), so they were compared by pixels only (51.4 / 36.5 dB minimum over all frames).

G4 in detail (HyperFrames 0.8.142, screenshot mode, its own HeadlessChrome 152, hardware GPU, 2 workers; `hf-out/`, `hf-check.json`, `hf-allframes-vs-b6.json`):
- All four DOM variants render with exit 0 to 1080x1920 yuv420p, 30 fps, 120 frames, about 8.3 MB at 26 Mb/s (wall 7.1 s B6, 8.4 s B1, 8.3 s B2, 7.1 s B3 on a quiet machine; the earlier renders under load took 10 to 31 s). Lint is 0 errors and 0 warnings for all four; `hyperframes check` passes for all four (warnings and info items are the intended mask-reveal overflow; see `hf-out/*-check.log`).
- Frame by frame against B6's HyperFrames output (same pipeline, so encoder noise cancels): B1 min 35.7 dB (frames 68-72, the arc-length path), B2 min 35.0 dB (frames 43-47, the morph), B3 min 41.4 dB (frames 105-107, the sampled spring). Their worst frames are the same ones as in the harness, so the pipeline reproduces the harness result.
- Against the lossless harness stills the H.264 outputs score 29.7 to 34.2 dB for every variant, identically (26 Mb/s, 4:2:0, BT.709 limited range on dark gradients): that is the encoder, not the engine.
- Repeatability: rendering B1 and B6 a second time gave 120/120 identical decoded frames and byte-identical mp4 files.
- B3 needed two fixes to pass: with an async build and a rAF-based warm pass and no hold, HyperFrames captured the first frames of each worker (0, 1, 60, 61) mid-warm-pass (14 to 22 dB, the end state or the blank start state in the picture); and a `__hf.buildReady` promise that itself awaited Motion's rAF flush stalled HyperFrames' init until its retry. The final page registers its `hf-seek` listener first, uses `__hf.buildReady` for a build that needs no frame ticks, and sets the initial shape path by hand instead of a warm pass.

Contact sheets (same frames, six variants side by side): `sheets/frame-015.jpg`, `frame-036.jpg`, `frame-060.jpg`, `frame-078.jpg`, `frame-096.jpg`, `frame-117.jpg`; `sheets/overview.jpg`; 100% crops `sheets/crop-headline-f117.jpg`, `crop-counter-chip-f96.jpg`, `crop-shape-icon-f78.jpg`; morph in-betweens `sheets/morph-mid-frames.jpg`; filmstrips of every preview video `sheets/filmstrip-*.png`.

## What the variants taught us

**B1 GSAP 3.15.0.** Closest to a drop-in. `SplitText` with `mask: 'lines'` did the masked word/char reveals with no CSS mask of our own; `CustomEase.create('x', '0.16,1,0.3,1')` reproduced the house curves to 0.15 px; the counter is one `innerText` tween with a `modifiers` formatter, so nothing depends on `onUpdate` (which `tl.seek()` suppresses by default). HyperFrames `check` passes (lint 0/0, contrast 83/83; six info-level `text_box_overflow` notes that are the intended mask reveals). Findings: the default `force3D: 'auto'` gave 1-LSB raster noise between passes (mismatches at 85 to 108 dB) and MorphSVG re-serialises the start path on its first render (84.9 dB at frame 32, order gate); `force3D: false` plus one warm pass makes G1 to G3 bit-exact. MorphSVG on natural paths (circle from four cubics, rounded rects from lines and arcs) leans mid-morph: 4.9 % of the shape area off the symmetric lerp, 2.7 % with `smooth: 'auto'`, 0 % when the circle is authored in the same structure as the rects. `MotionPath` is arc-length parameterised, so the document is up to 11.6 px / 2 degrees from the spec's Bezier-t path.

**B2 Anime.js 4.5.0.** Compact and complete (`splitText`, `svg.morphTo`, `svg.createMotionPath`, `spring`). It needed four things we did not expect: explicit initial states (`tl.set(..., 0)`: v4 timeline children do not apply their from-values before they start), a rewind before seeking (a bare backward `seek` leaves stale values in the gaps between chained tweens: real G2 failures at 17 to 30 dB), a warm pass (`svg.morphTo()` rewrites the target's `d` while the timeline is being built), and `accessible: false` (the default injects a hidden duplicate of the whole line, including a second `.bar`). `createSpring()` is deprecated in 4.5.0 (console warning; use `spring()`, which also sets the tween duration to its settling time). `morphTo` resamples both paths to polylines (about 0.33 points per px) and leans like MorphSVG (worst frame 34.9 dB); `createMotionPath` is arc-length too (11.9 px). HyperFrames lint needs `data-no-timeline` on the root (no GSAP timeline to register).

**B3 Motion 13.4.5 (vanilla).** Built for realtime UI, hard to bend to seek-driven capture. `animate(path, { d })` silently does nothing (no morph; `mix(a, b)` only works for identical command structure); `animate({ opacity })` is always promoted to a native WAAPI animation, and a paused WAAPI animation whose `currentTime` was set programmatically was missing from the harness screenshot (the document icon at frame 60) in most runs while `getComputedStyle` said opacity 1; CSS `offset-path` + `offsetDistance` showed the same flake; function segments only run inside their own span; values are written on Motion's next frame, not inside the `time` setter. The working version drives opacity, morph, path and counter through full-span function segments (about 40 lines that reimplement what B6 does), waits on `frame.postRender`, and gives HyperFrames an `hf-seek` listener with `waitUntil`. Its native spring (sampled `linear()`) is within 0.003 scale of the closed form. 14.x was not installed (see "Not tested").

**B4 Motion Canvas 3.17.2 (worker).** The only canvas renderer: matches the DOM baseline to 51.4 to 56.0 dB over all 120 frames (mean 54.5), text laid out by the browser and filled with `fillText`. Headless works two ways: the `<motion-canvas-player>` element in a page that implements the harness contract (G1 to G3 true), and the editor's `?render` URL flag, which runs the real exporter with no clicks (122 PNG frames over the HMR websocket; two renders bit-identical). Costs: Vite 5.4.21 pin (the plugin's peer range stops at 5), 106 MB of deps, 220 scene lines against 53, hand-written cubic-bezier easings and closed-form spring (the native `spring()` is up to 12.8 px off the spec), `Txt` has no splitter, duration arithmetic off by one frame (`range: [0, 3.95]`), and the last upstream code commit is 16 Feb 2025.

**B5 Remotion 4.0.529 (worker).** Deterministic and fast (CLI render of the 4 s shot: 3.8 s), G1 to G3 bit-exact across repeats, 1/4/6 tabs and cold sub-ranges. The shape morph is the defect: `@remotion/paths` `interpolatePath` is a d3-interpolate-path port (not flubber), so natural paths twist into a faceted polygon for about 0.33 s (frames 37 to 46, down to 36.5 dB; `sheets/morph-mid-frames.jpg`); a structure-matched shape is exact. Costs: 224 MB of deps, a 93.5 MB download (193 MB on disk) for Chrome Headless Shell 149.0.7790.0, a webpack bundle step, no HyperFrames adapter (the mp4 goes into HyperFrames as a lossy clip: 37.3 dB and a 2 to 4 level red/blue shift), and a licence that needs a paid Company License for companies with more than 3 employees.

**B6 baseline.** Pure functions of t from the pack (`ease.js`, `presets.js` `unitStates`), 53 lines on top of 92 shared pack lines. Bit-exact in every gate on the first run. It lacks a path morph between different structures (we author matched structures), a motion-path helper (closed-form Bezier) and a splitter (8 lines), and it is invisible to HyperFrames Studio's timeline view.

## Skill packs

**GSAP Skills (8 skills, 93 kB): adopt four, with an addendum.** Used as the reference while writing B1.
- Worked: the licence section is correct and valuable (every plugin is free and ships in the public `gsap` package; no `.npmrc` token), `SplitText` `mask`/`linesClass`/font-load guidance worked first time, the MorphSVG option table is accurate, `CustomEase.create` with a cubic-bezier string is exact.
- Missing or misleading for a seek-driven pipeline: no mention that `tl.seek()` suppresses callbacks and returns a thenable timeline (returning it from `__seek` hangs the harness); the easing table does not say that `power2` is cubic and `power3` is quartic (I made the same mistake: the counter ran ahead until I fixed it; the `remotion-to-hyperframes` skill has the same error); the performance skill's `will-change`/`force3D` advice is neutral for realtime and harmful for bit-exact capture; its MorphSVG tip to set `shapeIndex` made the morph worse (auto was already the best of 14 values I tried; `smooth: 'auto'` helped). About 60 % of the text (ScrollTrigger, React, frameworks, Flip, Draggable, matchMedia) never applies to video.
- Verdict: yes for `gsap-core`, `gsap-timeline`, `gsap-plugins`, `gsap-utils`; skip the other four for video work. Add a 20-line "render-safe GSAP" addendum: `force3D: false`; never `return tl.seek(t)`; `power2` = cubic; counters through `innerText` + `modifiers`; warm pass; `immediateRender: false` on repeated `fromTo` (HyperFrames lint `gsap_repeated_fromto_without_baseline`); no negative `z-index` (lint `negative_z_index`).

**Remotion Skills (6): do not adopt (worker verdict, spot-checked).** Wrong or outdated: `local-fonts.md` uses a top-level `await` that does not bundle on 4.0.529; `remotion-to-hyperframes/references/timing.md` maps `Easing.out(Easing.cubic)` to `power3.out` "exactly" (it is quartic; verified in the file, lines 92 and 144) and the skill's SSIM gate did not catch the 0.27 s counter lead; `fonts.md` calls `Font.loadFont`, which the worker could not find in `remotion` 4.0.529 (the API is `loadFont` from `@remotion/fonts`); `remotion-markup` advises `output: 'perceptual-scale'`, which changes the scale curve; `remotion-video` points at scripts that are not in the folder. `remotion-best-practices` nests copies of three other skills. Nothing teaches determinism for our pipeline. Keep at most `remotion-render` and the `remotion-markup` timing pages after fixing those errors; use `remotion-to-hyperframes` only for an explicit port request after fixing its easing table.

**Motion AI Kit (cloned `--depth 1`, 25 kB of skill text): do not adopt.** What is free: best-practices text (self-contained), docs search and `generate-css-easing` (both on a hosted MCP server at `mcp.motion.dev`, so they need network). What needs paid Motion+: MotionScore audit methodology, example/UI source search, the transition editor, and the components `splitText`, `AnimateNumber`, `Typewriter`, `ScrambleText`, `Carousel`, `Ticker`, `Cursor` (`motion-plus` package; the kit's own SKILL.md says so). The advice targets interactive UI (hover/press, gestures, layout, `AnimatePresence`, WAAPI and `will-change`); it has nothing on `animate` sequences with `at`, the `time` setter, or offline capture, and "prefer `transform` so it runs via WAAPI" is exactly what flaked in B3. `npx motion-ai` rewrites agent configuration; not run. The CSS spring generator does work offline without the kit: in the free package `createGeneratorEasing({type:'spring', ...}, 100, spring)` plus `generateLinearEasing(ease, ms, 10)` produced a 90-point `linear()` for the spec spring (stiffness 227.4, damping 13.87) whose maximum error against the closed form is 2.7e-3 of full scale (about 1 px on the chip). Use it as a dev-time tool for CSS-only layers.

## Recommended combination and adapter snippets

Exact versions: HyperFrames 0.8.142; gsap 3.15.0 (published 2026-04-13) with `dist/gsap.min.js`, `SplitText.min.js`, `MorphSVGPlugin.min.js`, `MotionPathPlugin.min.js`, `CustomEase.min.js` copied into the project; Node 25.9.0 for installs. Optional niche: animejs 4.5.0 (2026-06-22).

**GSAP in HyperFrames (adopted).** Smallest seek-safe form (full working file: `b1-gsap/index.html`):

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="4" data-width="1080" data-height="1920"> ... </div>
<script src="vendor/gsap.min.js"></script><script src="vendor/CustomEase.min.js"></script><script src="vendor/SplitText.min.js"></script><script src="vendor/MorphSVGPlugin.min.js"></script>
<script>
  gsap.registerPlugin(SplitText, MorphSVGPlugin, CustomEase);
  CustomEase.create('enter', '0.16,1,0.3,1');            // the house curves are cubic-beziers: CustomEase reproduces them to 0.15 px
  gsap.config({ force3D: false });                       // no translate3d promotion: bit-exact rasters
  Promise.all([document.fonts.load('800 136px Manrope'), document.fonts.ready]).then(() => {
    const tl = gsap.timeline({ paused: true });
    const s = SplitText.create('#l1', { type: 'lines,words', mask: 'lines' });
    tl.from(s.words, { yPercent: 120, duration: 0.5, stagger: 0.07, ease: 'enter' }, 0);
    tl.fromTo('#counter span', { innerText: 0 }, { innerText: 38400, duration: 2.6, ease: 'power2.out',   // power2 = cubic
      modifiers: { innerText: (v) => '₹' + Math.round(v).toLocaleString('en-IN') } }, 1.0);
    tl.seek(tl.duration()).seek(0);                      // warm pass (MorphSVG re-serialises its start path on first render)
    window.__timelines = window.__timelines || {};       // HyperFrames creates it; a standalone page does not
    window.__timelines['main'] = tl;                     // register only after the build; key = data-composition-id
    window.__seek = (t) => { tl.seek(t); };              // standalone harness only; never `=> tl.seek(t)` (thenable)
    window.__ready = true;
  });
</script>
```

**Pure-function layer (kept).** Any renderer that is a function of t, with no library (`b6-baseline/index.html`):

```html
<div id="root" data-composition-id="main" data-no-timeline data-start="0" data-duration="4" data-width="1080" data-height="1920"> ... </div>
<script type="module">
  import { E, seg } from './pack/ease.js';   import { PRESETS, unitStates } from './pack/presets.js';
  function draw(t) { /* set every property of every element from t; remember nothing */ }
  const ready = init();                                   // fonts + DOM split
  window.__hf = window.__hf || {}; window.__hf.buildReady = { b6: ready };   // hold the first frame until ready
  window.addEventListener('hf-seek', (e) => draw(e.detail.time));            // HyperFrames drives time through this event
  ready.then(() => { window.__seek = draw; window.__ready = true; });
</script>
```

**Anime.js (niche).** Four rules: explicit initial states with `tl.set(targets, props, 0)`, `accessible: false` on `splitText`, one warm pass, never return the timeline from a seek callback. HyperFrames needs the explicit registry and `data-no-timeline` on the root:

```js
const tl = anime.createTimeline({ autoplay: false });
tl.set(words, { y: '120%' }, 0).add(words, { y: ['120%', '0%'], duration: 500, delay: anime.stagger(70), ease: anime.cubicBezier(0.16, 1, 0.3, 1) }, 0);
tl.seek(4000); tl.seek(0);                                // warm pass
(window.__hfAnime = window.__hfAnime || []).push(tl);     // v4 has no auto-discovery
window.__seek = (t) => { tl.seek(0); tl.seek(t * 1000); }; // standalone harness only: rewind first
```

## Gotchas

Harness and page contract
- A GSAP timeline, an Anime timeline and Motion playback controls all have a `then` method (verified). `window.__seek = (t) => tl.seek(t)` returns the thenable, the harness awaits it, and the run hangs (the harness's protocol timeout is 30 minutes). Wrap in braces.
- Stills for frames that are not in the sampled set are drawn after all passes, so they show the state after a history of seeks. That is what exposed Anime's stale gaps and Motion's missing element; the gates alone did not.

GSAP
- `power2` is cubic, `power3` is quartic. `ease: 'power3.out'` on a counter ran up to 0.27 s ahead of the spec.
- `tl.seek(t)` suppresses callbacks by default; anything driven by `onUpdate` (counter text, glow position) does not update. Use property tweens (`innerText` + `modifiers`) or `tl.seek(t, false)`.
- Default `force3D: 'auto'`: 1-LSB raster differences between passes. `gsap.config({ force3D: false })`.
- MorphSVG re-serialises the start path at progress 0 on first render (frame 32 mismatch, 84.9 dB): one warm pass.
- HyperFrames lint: `gsap_repeated_fromto_without_baseline` (two `fromTo` on one element: `immediateRender: false` on the later one), `negative_z_index` (use `isolation: isolate` plus positive z-index on the letters instead of `z-index: -1` on a bar).
- MotionPath and Anime's motion path are arc-length parameterised; a spec that says Bezier-t needs a closed-form function.
- Natural-structure morphs lean; author morph targets in the same command structure (0 % error) or use `smooth: 'auto'`.

Anime.js 4.5.0
- Timeline children do not apply from-values before they start: explicit initial state needed. Bare backward seeks leave stale values in gaps between chained tweens. `svg.morphTo` mutates `d` at build time. `splitText` accessible copy duplicates the subtree (and any id or class inside). `createSpring` is deprecated. `timeline.seek` returns a thenable.

Motion 13.4.5
- `animate(path, { d })` does nothing. `animate({ opacity })` is always WAAPI. Function segments only run inside their span (give each a full span with held keyframes and set the initial state by hand or in CSS). Writes land on Motion's next frame (`frame.postRender`; in HyperFrames `e.detail.waitUntil(...)`). `splitText`, `AnimateNumber` are paid Motion+.

Shared layout hazard found by `hyperframes check`
- `check` raised a `text_occluded` error on B3 only: the period after "record" was painted under the highlight bar's 14 px overhang (the bar covered 2 px of the dot; pixel scan: 19 px of dot in B6, 17 px in B3). The stacking order had been decided by accident: after a tween GSAP and Anime leave an identity `transform` matrix on the unit (which makes it paint in the positioned layer, above the bar), Motion writes `transform: none` (it paints below). Fixed in the shared CSS (`.rec ~ * { position: relative; z-index: 1 }`), after which all four variants agree and `check` passes. Lesson: never let paint order depend on what an engine leaves on a node; say it in CSS.

HyperFrames contract
- Non-GSAP compositions need `data-no-timeline` on the root (lint `missing_timeline_registry` is an error otherwise; without the attribute the producer polls 45 s per render).
- The `three` adapter's `hf-seek` event fires for any library, with `detail.waitUntil(promise)` (call it synchronously inside the listener). `window.__hf.buildReady.<key> = promise` holds the first frame for async setup, but the promise must not wait for animation frames (Motion's `frame.postRender` is rAF-based and stalled the init).
- The Anime.js adapter contract says to build synchronously, not after async asset loads: B2 builds at script run and only the `__ready` flag waits for fonts.
- `.clip`/timeline rules from the skill held: root `data-duration` is the render length; local fonts are embedded as data URIs by the compiler.

Motion Canvas 3.17.2 and Remotion 4.0.529 (from the workers)
- Motion Canvas: duration accumulates to 3.9999999999999956 so a 4.0 s scene is 122 frames (`shared.range: [0, 3.95]`); fonts are not awaited; flex children ignore their own x/y; the player overlay must be hidden; the real export only runs under the Vite dev server.
- Remotion: `loadFont` at module top level with `await` fails to bundle; scoping the CSS reset as `#stage *` outranked `.ln` padding (use `:where(#stage) *`); default JPEG frames give `yuvj420p` (use `--image-format=png --color-space=bt709`); the mp4 clip in HyperFrames needs `data-no-timeline` and a BT.709-tagged, GOP <= 30 encode.

## Not tested, and why

- **Motion 14.x.** 14.0.0 (2026-10-02) and 14.1.0 (2026-10-09) are younger than 14 days, so the brief's rule required 13.4.5 (13.4.6 was five hours short). The 14.0.0 and 14.1.0 changelog entries (read on GitHub, not installed) list no change to `animate`, sequences, the `time` setter, `spring` or `mix`; 14.0.0 only removes internal APIs. Re-test from 2026-10-16 (14.0.0) and 2026-10-23 (14.1.0).
- **Remotion 4.0.530 to 4.0.535**, same rule; B5 uses 4.0.529 for every `@remotion/*` package.
- **Motion+ components** (`splitText`, `AnimateNumber`, ...), the Motion AI Kit hosted MCP servers and `npx motion-ai`: paid, network, account sign-in or a change to agent configuration; none attempted.
- **Anime.js 5.0.0-beta.x** (published August 2026): beta.
- **HyperFrames Studio** (preview/editing of each engine's timeline): not opened.
- Other-lane GPU load made absolute ms/frame noisy (seen from 167 to 891 ms for the same page); only within-batch comparisons and the seek-only column are meaningful.

## Not run (outside the test rules)
- Installing Motion 14.x (younger than the 14-day rule) to confirm the 13.4.5 results.
- `flubber` (the worker's suggestion for a fair morph test in Remotion), the Remotion `create-video` scaffold (pulls an unpinned version), and starting the TencentDB memory hub (down; not started).
- Web pages read for facts (read-only, nothing saved): gsap.com/standard-license, the Motion CHANGELOG on GitHub.

## Files

`SPEC.md`, `shared/` (CSS and body shared by the DOM variants), `tools/` (build, probe, compare, sheets, lock scripts), `b1-gsap/`, `b2-animejs/`, `b3-motion/`, `b4-motion-canvas/`, `b5-remotion/`, `b6-baseline/` (each with `anim.js` or its source, `index.html`, `seekcheck/` with stills and `report.json`, `preview.mp4`), `hf/` and `hf-out/` (HyperFrames projects, G4 renders, check logs, `hf-check.json`), `timing/` (interleaved timing rounds, seek-only costs), `libs/` (installed gsap, animejs, motion), `ai-kit/` (clone), `history/` and `scratch/` (superseded runs and one-off experiments), `probe-compare.txt`, `allframes-psnr.json`, `compare-vs-b6.json`, `sheets/`, `results.json`.
