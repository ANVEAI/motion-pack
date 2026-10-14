# Lab: 21 repos, tested for frame-exact rendering

An agent makes video by rendering web pages frame by frame. The renderer seeks: it asks for frame 0, then frame 1, or sometimes frame 90 first, or one chunk per worker. A library built for live playback (clocks, animation loops, integrating simulations, sound played into the speakers) can look perfect in a browser and still drift, jitter or go silent in a render.

On 13 Oct 2026 we took a widely shared list of 20 GitHub repos "for an AI motion-design stack", installed every one, built the same shots with each, and measured them. On 14 Oct 2026 we added a fifth lane for one more repo, cbirds (terminal and ASCII looks), which brings the lab to 21 repos. **75 variants in 5 lanes:**

| lane | repos | write-up |
|---|---|---|
| 3D, post effects, physics | three.js, React Three Fiber, Drei, React Postprocessing (and pmndrs `postprocessing`), React Three Rapier (and Rapier) | [`a-3d/RESULTS.md`](a-3d/RESULTS.md) + the [React](a-3d/RESULTS-A2-react.md) and [physics](a-3d/RESULTS-A3-physics.md) sub-reports |
| 2D engines and skill packs | GSAP, GSAP Skills, Anime.js, Motion, Motion AI Kit, Motion Canvas, Remotion, Remotion Skills | [`b-2d/RESULTS.md`](b-2d/RESULTS.md) |
| Lottie, Rive, SVG | dotLottie Web (vs lottie-web), Rive Web, SVGO | [`c-vector/RESULTS.md`](c-vector/RESULTS.md) |
| Covers, encoding, video, audio | Satori, Mediabunny, Howler.js, FFmpeg | [`d-output/RESULTS.md`](d-output/RESULTS.md) |
| Terminal and ASCII | cbirds (live terminal vs headless recorder vs baked plate) | [`e-terminal/RESULTS.md`](e-terminal/RESULTS.md) |

The verdicts for all 75 variants are in [`results.json`](results.json), and as a readable table in [`../skills/motion-stack/references/verdicts.md`](../skills/motion-stack/references/verdicts.md).

**Licence of the sheets.** The images in `*/sheets/` are measurement evidence, and some render third-party artwork (Lucide, Phosphor and Fluent Emoji icons; test inputs for the other lanes). They are not CC0: see [`../THIRD_PARTY.md`](../THIRD_PARTY.md) section 1b and [`../licenses/`](../licenses/README.md).

## How every variant was judged

- **G1 same twice:** seek to t twice and get identical pixels.
- **G2 order independent:** forward, reverse and shuffled seek orders give identical pixels per frame.
- **G3 cold = warm:** a fresh page seeked straight to frame N matches.
- **G4 production path:** the winner renders through the real pipeline (HyperFrames 0.8.142, or a GPU-supersampled three.js renderer) with no errors, and someone looks at the stills.
- **Also scored:**
  - quality at 100% crops;
  - identity checks where content has a source timeline (frame-index barcodes for video);
  - cost per frame;
  - lines of code;
  - dependency size;
  - licence.

The harness is [`skills/motion-stack/scripts/seekcheck.mjs`](../skills/motion-stack/scripts/seekcheck.mjs). It runs on any page that exposes `window.__ready` and `window.__seek(t)`. The brief every lane followed is [`BRIEF.md`](BRIEF.md).

## What we found

**Verdict counts:**

| verdict | variants |
|---|---|
| ADOPT | 7 |
| ADOPT-FOR a named niche | 20 |
| KEEP-CURRENT (what we had already won) | 10 |
| REJECT | 38 |

1. **GSAP is the default 2D engine.** It is bit-exact after two settings (`force3D: false` and one warm pass), has a native HyperFrames adapter, and needed 33 lines for the test shot. Plain pure functions of t matched it bit for bit with zero dependencies.
2. **`power2` is cubic and `power3` is quartic.** A widely used Remotion-to-HyperFrames guide maps cubic to `power3`; we reported it upstream ([heygen-com/hyperframes#5538](https://github.com/heygen-com/hyperframes/issues/5538)).
3. **Live physics fails, baked physics passes.** `@react-three/rapier` failed the order gate (13.6 dB). Rapier baked at build time into a table gave one SHA-256 across Node 21/22/25 and Chrome, and passed every gate on a real set.
4. **The React layer adds weight, not pixels.** The same 3D shot in React Three Fiber was pixel-identical to vanilla three.js at the same GPU time, with 6x the dependencies and a bundler.
5. **A hand-tuned post chain beat both drop-in chains.** pmndrs `postprocessing` and three's addons matched our look only after re-tuning, and cost 20–55% more per frame. pmndrs earns a place as a single tail pass (a LUT grade).
6. **Don't upgrade three.js mid-project.** r160 → r186 darkened every lit surface by about 7/255 and silently disabled a shadow patch.
7. **Repeatable is not the same as right.** `<video>.currentTime = N/fps` showed the previous frame on 11 of 24 samples and still passed all three gates. HyperFrames' own video handling was 300/300 exact.
8. **Sound played live never reaches the file.** Howler's audio was absent from the render. Declared audio was sample-accurate.
9. **Lottie:** lottie-web is the default through the native adapter. dotLottie renders a *blank* video through that adapter, so it needs a 7-line bridge. ThorVG and lottie-web disagree on Trim-before-Repeater and on effects.
10. **SVGO's default preset breaks draw-on animation.** It fused strokes in 70 of 111 icons. A draw-on-safe config saved 30.7% with bit-identical draw-on frames.
11. **Encoding:** ffmpeg x264 two-pass beat WebCodecs H.264 by 1–3 dB at equal size. WebCodecs was about 14x faster, which suits drafts.
12. **Covers:** HTML plus a Chrome screenshot is the fidelity reference. Satori silently ignored or threw on 22 of 50 CSS features (in the version tested).
13. **A live simulation is fine if you bake it.** cbirds' terminal mode steps on the wall clock (3 runs, 3 frames); its headless recorder steps on its own clock, so a baked plate is byte-identical bake to bake and frame-exact in HyperFrames. Builds fly different flocks (x86_64 vs arm64 diverge at frame 50), so keep the MP4.

## Honest limits

- **One machine** (Apple M3 Pro, Chrome 154, ANGLE Metal), with four lanes sharing the GPU. Read ms/frame within a lane only.
- **The version rule:** where a release was younger than 14 days at test time, we tested the newest version at least 14 days old (supply-chain caution). Each lane write-up says which. The one exception is cbirds (lane `e-terminal`): we tested a commit that was 2 days old, because its 3D mode is newer than any commit that was 14 days old. The maintainers approved that exception on 14 Oct 2026, after a source review of the pinned commit (no network or system calls; writes only to the output path).
- **Content:** encoding results come from CG content, and the 2D shot is one design. Your content may rank differently, so run the harness on it.
- **Not tested:**
  - Linux and Windows GPUs;
  - Rive authoring (it needs the Rive editor);
  - paid add-ons (Motion+, Remotion Company License features).
- **Contact sheets** in each lane's `sheets/` folder are the evidence behind the quality scores. The full-size stills and renders stayed on the test machine.
