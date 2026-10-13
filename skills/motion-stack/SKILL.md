---
name: motion-stack
description: Pick, wire and prove the right open-source library or tool for AI-made video that renders frame-exact. Encodes a hands-on bake-off of 20 popular motion repos (GSAP, three.js, React Three Fiber, Drei, Rapier, pmndrs postprocessing, Remotion, Motion Canvas, Motion, Anime.js, Rive, dotLottie and lottie-web, SVGO, Satori, Howler, Mediabunny, FFmpeg, plus the GSAP, Remotion and Motion skill packs), with the version to pin, the adapter code, the measured verdicts and the traps. Use it whenever the user asks which animation, 3D, physics, post-effect, Lottie, Rive, icon, cover, encoding or audio library to use for a video; wants a web animation, React scene or Lottie turned into a render; sees jitter, drift, wrong frames or missing sound in rendered output; adds physics, bloom, LUTs, Lottie or emoji to a render; or wants to test a new library before trusting it. Ships a seek-test harness that proves a page is a pure function of time.
license: MIT
compatibility: Node 18+, Chrome or Chromium, puppeteer-core and ffmpeg for the seek test; Python 3 with Pillow for contact sheets. Verdicts were measured with HyperFrames 0.8.142, three r160, Chrome 154 and ffmpeg 8.0.1 on Apple Silicon; the rules apply to any frame-stepping renderer.
metadata:
  version: 1.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# motion-stack: the right tool for frame-exact video, tested

**Agents make video by rendering web pages frame by frame.** The renderer seeks: frame 0, frame 1, sometimes frame 90 before frame 12, sometimes one worker per chunk.

Most web animation libraries assume live playback instead: a clock, a requestAnimationFrame loop, a simulation that integrates, sound played into the speakers. Each of those breaks a seeked render in its own way:
- jitter;
- frames that differ between two renders of the same file;
- a video layer one frame early;
- sound that never reaches the MP4.

On 13 Oct 2026 we installed 20 popular motion repos, built the same shots with each, and measured them:
- **determinism**, with three gates;
- **correctness**, at 100% and with frame-index checks;
- **cost and integration**.

This skill is the result: what to use, at which version, how to wire it, and what bites.

## Where this sits in the pipeline

`story-script` → `frame-design` → `motion-pack` (+ `spec-to-loop`, Blender plates) → **`motion-stack`** → `social-video`

- **Input:** a composition or page you are about to render, or a library question.
- **Output:**
  - the tool choice;
  - the adapter code;
  - a `seekcheck/<label>/report.json` proving the page is seek-safe;
  - the finishing settings (encode, covers, loudness).

## The rule everything follows

**Every pixel at time `t` is a pure function of `t`.** `scripts/seekcheck.mjs` proves it with three gates:
- **G1 same twice:** render the same frame twice; the pixels match.
- **G2 order independent:** forward, reverse and shuffled seek orders give the same pixels.
- **G3 cold equals warm:** a fresh page seeked straight to frame N matches.

Passing the gates proves repeatability, not correctness. Content with a source timeline (video, Lottie, baked tables) also needs an identity check, such as a frame-index barcode read back from the frame. Read `references/determinism.md` before wiring anything new.

## The tested stack (pin these)

| job | use | pin | why (measured) | detail |
|---|---|---|---|---|
| 2D motion in a composition | **GSAP** (SplitText, MorphSVG, MotionPath, CustomEase, all free) in HyperFrames | gsap 3.15.0, HyperFrames 0.8.142 | bit-exact after `force3D: false` + a warm pass; native adapter; 33-line shot | `references/2d.md` |
| Shared components, reference stills | plain pure functions of t through `hf-seek` | none | bit-exact on the first run, zero dependencies | `references/2d.md` |
| Small MIT-only flourish | Anime.js v4 via `window.__hfAnime` | animejs 4.5.0 | passes after four rules | `references/2d.md` |
| CSS-only spring | `motion` package's spring → CSS `linear()` at dev time | motion 13.x | 2.7e-3 max error vs closed form | `references/2d.md` |
| 3D plates | three.js with your own supersampled post chain | three pinned per project (r160 here) | the pmndrs/addons chains cost 20–55% more and needed re-tuning to match | `references/3d.md` |
| One extra grade or effect on 3D | pmndrs `postprocessing` as a single tail `EffectPass` | 6.36.7 (for three < 0.174) | bit-identical when idle, seek-safe if `time = t`, `render(0)` | `references/3d.md` |
| Multi-body physics (scatter, pile, drop) | **Rapier, baked at build time**, then a table player | @dimforge/rapier3d-compat 0.21.0 | one SHA-256 across Node 21/22/25 + Chrome; passes G1–G4 on a real set | `references/3d.md` |
| Lottie in a composition | **lottie-web, SVG renderer**, via HyperFrames' native adapter; dotLottie (ThorVG) through an `hf-seek` bridge for `.lottie`, effects or byte-identical renders across workers | lottie-web 5.13.0; dotlottie-web 0.80+ | 3 script lines; gates pass (one 85 dB hairline aside); HyperFrames' adapter renders dotLottie **blank**, so bridge it | `references/vector.md` |
| Icons and logos for draw-on | SVGO with a draw-on-safe config (`mergePaths`, `convertShapeToPath`, `makeArcs` off; `prefixIds` on), once per set at import | svgo 4.1.0 | −30.7% over 498 icons, draw-on frames bit-identical; the default preset broke the stagger on 70 of 111 icons | `references/vector.md` |
| Covers and thumbnails | HTML + headless Chrome screenshot | puppeteer-core 25, Chrome stable | the fidelity reference, 202 ms, byte-identical with `--disable-gpu` | `references/output-tools.md` |
| Final encodes and upload copies | ffmpeg x264 two-pass, `-preset slow -tune animation` | ffmpeg 8.x | +1–3 dB over WebCodecs H.264 at equal size | `references/output-tools.md` |
| Video inside a composition | the renderer's own `<video>` (HyperFrames pre-extracts frames) | HyperFrames 0.8.142 | 300/300 frames exact; plain `currentTime = N/fps` was wrong on 11/24 | `references/output-tools.md` |
| Sound | declared audio (`<audio id data-start>`) or an offline master mix | — | sample-accurate; live playback never reaches the MP4 | `references/output-tools.md` |

## The 20 repos at a glance

| repo | verdict | one line |
|---|---|---|
| GSAP / GSAP Skills | **ADOPT** (4 of the 8 skills) | default engine; skills need the render-safe addendum in `2d.md` |
| three.js | **ADOPT**, pinned | upgrading r160 → r186 mid-project darkened every lit surface by about 7/255 |
| FFmpeg | **ADOPT** | x264 two-pass for finals; the standalone `vmaf` CLI covers VMAF |
| Rapier (vanilla) | **ADOPT**, baked | under `React Three Rapier`, the live version fails G2 |
| pmndrs postprocessing | ADOPT-FOR a tail stage | not as a replacement chain |
| Anime.js | ADOPT-FOR flourishes | four rules, explicit registry |
| Drei | ADOPT-FOR two vanilla ports | SoftShadows, MeshReflectorMaterial; several helpers fail G3 |
| Mediabunny | ADOPT-FOR canvas/WebGL video plates and in-browser drafts | not inside HyperFrames; not for finals |
| Satori | ADOPT-FOR browserless covers | ignores or throws on 22 of 50 CSS features (tested 0.33.5) |
| lottie-web / dotLottie Web | **ADOPT** / ADOPT-FOR | lottie-web SVG is the default; dotLottie for `.lottie`, effects, cross-worker byte identity (needs a bridge) |
| Rive Web | REJECT for a code-first pack | linear animations seek deterministically; state machines are step-size dependent; authoring needs the Rive editor |
| SVGO | **ADOPT** with the safe config | the default preset fuses strokes and breaks draw-ons |
| React Three Fiber / React Postprocessing | REJECT for offline plates | identical pixels, 6x the dependencies, a bundler |
| React Three Rapier | REJECT | live stepping fails G2; pins an older Rapier |
| Remotion / Remotion Skills | KEEP-CURRENT / REJECT skills | deterministic but heavier; paid above 3 employees; the skills had wrong advice |
| Motion Canvas | KEEP-CURRENT | renders well, adds a second world; maintenance slowing |
| Motion / Motion AI Kit | REJECT for video | built for live UI; the kit needs a hosted server and paid Motion+ |
| Howler.js | REJECT for video | its sound never reached the render |

The full table, with the numbers behind each verdict, is in `references/verdicts.md`.

## Workflow for any motion library (including ones not listed)

1. **Look it up.** If the job is in the tables above, use the tested answer and its pinned version. Upgrades are their own project: re-run the gates and re-grade.
2. **Wire it with the adapter** from the matching reference (`2d.md`, `3d.md`, `vector.md`, `output-tools.md`). Drive everything from `t`: no clocks, no rAF loops, no unseeded randomness, no live audio.
3. **Prove it.**
   - Expose `window.__ready` and `window.__seek(t)`, then run `node scripts/seekcheck.mjs page.html --w 1080 --h 1920 --fps 30 --frames 120 --stills 0,60,119`.
   - All three gates must pass. Mismatches above 60 dB are GPU noise; below that they are real state errors.
   - For video, Lottie or tables, also check the frame identity.
4. **Render through the real pipeline** (G4) and LOOK at stills from the delivered file. `python3 scripts/sheet.py` makes a contact sheet.
5. **Finish** with the encode, cover and loudness settings in `references/output-tools.md`.

## When the user insists on a non-default tool

| tool | what to do |
|---|---|
| Remotion | Fine for evaluation and small teams (licence: free up to 3 employees). Render with its CLI and bring the MP4 in as a clip: it is lossy and has no HyperFrames adapter. Fix its skills' easing map: cubic is `power2`. |
| React Three Fiber | Make it seekable: `frameloop="never"`, store-driven `t`, `advance(0)` (never `advance(t)`), `dpr={1}`, `preserveDrawingBuffer`. Or port the scene to vanilla three. |
| Live physics | Bake it (`references/3d.md`). |
| Howler or any live audio | Replace it with declared audio or an offline mix; the render cannot hear it. |
| Motion | Use its spring generator only, or wrap every property in full-span function segments (about 40 lines). |
| A CSS transition | Convert it to a keyframe animation (WAAPI/CSS animations are seekable; transitions are not). |

## Bundled scripts

- **`scripts/seekcheck.mjs`:** the determinism harness (G1–G3, PSNR on mismatches, ms per frame, stills, optional preview MP4). It finds Chrome on macOS, Linux and Windows; `--software` runs on CI without a GPU.
- **`scripts/sheet.py`:** contact sheets of stills with captions.

## References

- `references/determinism.md`: the contract, the adapters per runtime, the traps, and how to test any library.
- `references/2d.md`: GSAP, Anime.js, Motion, Motion Canvas, Remotion, pure functions; adapter code and gotchas.
- `references/3d.md`: three.js post chains, version pinning, React Three Fiber, Drei, Rapier baking.
- `references/vector.md`: Lottie players, Rive, SVGO.
- `references/output-tools.md`: covers (Chrome, Satori, PIL), encoding (x264, WebCodecs, AV1), video layers, audio, ffmpeg builds.
- `references/verdicts.md`: every variant measured, with numbers.
- `references/learnings.md`: production lessons beyond the libraries (audio true peak, upload caps, platform traps).
