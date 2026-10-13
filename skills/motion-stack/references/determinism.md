# Frame-exact rendering: the contract, the adapters, the test

Video renderers that drive a browser (HyperFrames, a puppeteer frame stepper, Remotion) do not play your animation. They **seek** it: frame 0, frame 1, ... and sometimes frame 90 before frame 12, or one frame per worker in parallel. Anything that depends on wall-clock time or on what happened in earlier frames renders differently from the preview. It can stutter, jump, or differ between two renders of the same file.

## The one rule

**Every pixel at time `t` is a pure function of `t`.** Given the same `t`, it is the same frame, no matter what was rendered before.

That gives three testable gates (this is what `scripts/seekcheck.mjs` checks):

| gate | meaning | typical cause when it fails |
|---|---|---|
| **G1 same_twice** | seek(t), then seek(t) again: identical pixels | a lazy load, a font swapping in, a promise still pending, a canvas not redrawn |
| **G2 order_independent** | forward, reverse and shuffled seek orders give identical pixels per frame | state that integrates over time: live physics, particle systems, springs stepped per frame, `+=` in a render loop, a CSS transition |
| **G3 cold_equals_warm** | a fresh page seeked straight to frame N equals the forward pass | init-order bugs, caches warmed by earlier frames, assets loaded only after the first seek |

A mismatch above about 60 dB PSNR is GPU noise (rare). A real state bug usually measures 15–40 dB.

**Repeatable is not the same as right.** The gates prove a frame is a pure function of t, not that it is the *correct* frame. In our tests, a `<video>` seeked with `currentTime = N/fps` showed the previous frame on 11 of 24 samples and still passed G1–G3. For anything with a source timeline (video, Lottie, sprite sheets, baked tables), add an identity check: burn a frame-index barcode or counter into the source, and read it back at sampled frames.

## Test any library in 2 minutes

1. Write a test page that sets `window.__ready = true` when it has booted, and exposes `window.__seek = (t) => {...}`, which draws time `t` and may return a promise.
2. Run the harness:
   `node scripts/seekcheck.mjs page.html --w 1080 --h 1920 --fps 30 --frames 120 --stills 0,60,119 [--video preview.mp4]`
3. Read `seekcheck/<label>/report.json`:
   - `pass`, `gates`, `worst_psnr_db`;
   - `ms_per_frame`;
   - `console` (errors and failed requests);
   - mismatch PNG pairs.
4. A library that passes all three gates is safe to seek. Then prove it in the real renderer (G4): render the composition and look at the stills.

## How each runtime becomes seekable (HyperFrames 0.8.x adapters)

| runtime | how the renderer drives it | your job |
|---|---|---|
| GSAP | `window.__timelines["<composition-id>"] = tl`, where `tl = gsap.timeline({ paused: true })`; the renderer calls `tl.seek(t)` | Register the timeline once, after the build finishes (fonts ready). Never `play()`. One timeline per property per element. |
| Anime.js v4 | `window.__hfAnime.push(instance)`; the renderer calls `.seek(ms)` | Set `autoplay: false`. Register explicitly (no auto-discovery). v4 has no `anime()` function: use `anime.animate` and `anime.createTimeline`, `ease:` not `easing:`. |
| WAAPI / CSS animations | the renderer sets every `document.getAnimations()` `currentTime` to `t` in ms, then pauses | Use finite durations and `fill: "both"`. CSS *transitions* are not seekable; use keyframe animations. |
| Lottie | `window.__hfLottie.push(player)`; lottie-web gets `goToAndStop(ms, false)`, dotLottie gets frame/percent APIs | Set `autoplay: false`. Always set `loop` explicitly (lottie-web treats a missing `loop` as true). Keep assets local. |
| three.js / WebGL | `window.addEventListener('hf-seek', e => renderAt(e.detail.time))`; `window.__hfThreeTime` holds the current time | Set root `data-duration` (it is mandatory). Load everything before the first seek. Never use `setAnimationLoop` as the source of truth. |
| anything else | listen to `hf-seek`, or expose `__seek(t)` to your own stepper | Make `renderAt(t)` pure. Bake anything simulated (see below). |

## Things that break the rule, and the fix

- **`Date.now()`, `performance.now()`, `requestAnimationFrame` deltas, `setTimeout` choreography.** Derive everything from `t`.
- **Unseeded `Math.random()`.** Use a seeded PRNG (mulberry32 or sfc32), seeded once at boot, and index it by particle id, never by frame order.
- **Simulation** (physics, cloth, fluids, particles with velocity, springs integrated per frame). **Bake it:** simulate once at a fixed step (1/60 s) into a table of per-frame transforms, save it as JSON, and have `renderAt(t)` read the table (interpolating between steps). Re-simulating from 0 on every seek also works, but it costs O(t) per frame.
- **Springs:** use the closed-form solution (or a library's analytic spring that maps `t` to a value). Do not step one.
- **Assets loaded lazily:**
  - Preload fonts (`document.fonts.ready`), images, models and HDRIs before setting `__ready`.
  - Never fetch at seek time.
- **`<video>` layers:** HTML video seeking is not frame-exact in every browser. Let the renderer own media (HyperFrames does), or decode exact frames yourself.
- **Audio played live** (Howler, Web Audio, `<audio>.play()`) is not captured by a frame renderer. Declare audio on the timeline (HyperFrames `<audio data-start>`), or mix offline with ffmpeg.
- **Two timelines animating the same property.** GSAP's overwrite order can flip between renders. Give each property one owner.
- **Layout that depends on measured text before fonts load.** Wait for `document.fonts.ready`, then build.
- **Responsive breakpoints and `devicePixelRatio`.** Render at a fixed pixel size with `deviceScaleFactor: 1`, and set `renderer.setPixelRatio(1)` in three.js.
- **A page that runs its own preview loop.** A `requestAnimationFrame` player that keeps calling `renderFrame(n)` for live preview will repaint the canvas between your seek and the capture, and the gates then fail with 8–23 dB mismatches. Give the page a test switch (for example `?norun=1`) that stops the loop, and pass it to the harness with `--query`. Frame renderers usually add such a flag themselves.
- **Async setup the renderer does not await.** If a timeline loads data in a callback that boot never waits for, early seeks can render without the data. Load it with top-level `await` in the module, or before setting `__ready`.
