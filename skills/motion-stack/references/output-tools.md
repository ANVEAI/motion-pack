# Output tools: covers, encoding, video layers, audio, ffmpeg

These results were measured on 13 Oct 2026 (Apple M3 Pro, Chrome 154, ffmpeg 8.0.1, HyperFrames 0.8.142), on one real CG spot (1080x1920, 30 fps). Treat the numbers as a guide for similar content; the rankings held at both bitrates tested.

## Covers and thumbnails: HTML + headless Chrome screenshot (ADOPT)

| route | fidelity | speed (1280x720, warm) | same bytes twice | effort |
|---|---|---|---|---|
| **HTML + Chrome screenshot** | the reference: it is what the CSS means | 202 ms | yes with `--disable-gpu`; GPU raster gives 98–111 dB noise variants | 98 lines, no workarounds |
| Satori + resvg-js (tested 0.33.5 / 2.6.2) | close on layout; text tracking and many CSS features differ | 319 ms | yes | 87 lines + 5 workarounds |
| PIL | good only after hand-written kerning | 549 ms | yes | 273 lines + 3 workarounds |

- **Default:** build the cover as HTML (fonts via `@font-face`, emoji/3D art as `<img>`) and screenshot it. The same HTML also renders as a 1 s HyperFrames comp, so the poster frame and the video share one source.
- **Satori is only for runtimes with no Chrome** (edge functions). In the tested 0.33.5:
  - **Silently ignores** (no error, wrong picture): `z-index`, `calc()`, `clamp()/min()/max()`, `aspect-ratio`, `outline`, `backdrop-filter`, blend modes, `-webkit-text-stroke`, `clip-path: polygon()`, the individual `rotate:` property, `rgb(r g b / a)` / `oklch()` / `color-mix()`, `direction: rtl`, `<style>`/classes, `filter: drop-shadow()` (clipped to the box), and letter-spacing after spaces.
  - **Throws:** `display: grid`, `inline-block`, `conic-gradient`, 3D transforms, wavy underlines.
  - Later releases (0.47–0.51) list fixes for blend modes, rtl, `<style>` and tracking. Re-test before relying on them.
- **resvg-js traps:**
  - It aborts the whole Node process (uncatchable) on a large `box-shadow` blur (filter region about sigma²). Clamp the filter regions.
  - It loads system fonts by default (about 1.2 s): pass `font: { loadSystemFonts: false }`.
  - Satori 0.33.5 cannot parse some variable fonts. Make static instances with fontTools `varLib.instancer`.
- **PIL is for pixel compositing, never layout.** Without raqm it has no GPOS kerning (a headline ran 38–52 px wide).

## Encoding: ffmpeg x264, two-pass, slow, tune animation (KEEP)

The recipe for finals and upload copies:

`ffmpeg -i in.mp4 -c:v libx264 -preset slow -tune animation -b:v <budget> -maxrate 1.8x -bufsize 2.5x -profile:v high -pix_fmt yuv420p -pass 1|2 -movflags +faststart -c:a aac -b:a 128k`

where `budget = (target_MB × 8e6 × 0.97 / seconds) − audio`. It lands about 7% under the target size, which is safe for 10 MB caps. `-tune animation` suits CG and motion graphics; use `-tune film` for camera footage.

**Results at matched size, 10 s of 1080x1920 CG:**

| encoder | PSNR | VMAF | encode time |
|---|---|---|---|
| **x264 two-pass slow** (4.6 MB) | 48.96 dB | 97.47 | 21 s |
| Mediabunny/WebCodecs H.264 hardware (same size) | 47.80 dB | 95.99 | 1.6 s |
| Mediabunny AV1 (3.9 MB) | 48.73 dB | 97.43 | 2.3 s |
| ffmpeg SVT-AV1 preset 6 (3.9 MB) | 49.59 dB | 97.91 | 13.5 s |

At the 1100 kbps stress rate, x264 led H.264 WebCodecs by 2.5–3 dB.
- **Mediabunny is for in-browser drafts** (about 14× faster) **and web AV1 renditions**, not for finals.
- **Hardware `h264_videotoolbox`** was fast but lower quality and overshot the size by 4–9%. Reject it for capped uploads.
- **Reproducible bytes:** multi-threaded x264 is not byte-reproducible between runs (decoded PSNR about 51 dB between runs). Add `-threads 1` when you need identical files. WebCodecs payloads were identical run to run.
- **Always check:** `ffprobe` (frame count, `moov` before `mdat`, bt709 tags) plus a decoded loudness read.

## Video layers inside a composition: let the renderer own the video (ADOPT HyperFrames native `<video>`)

- **HyperFrames pre-extracts frames with ffmpeg and injects them.** Measured: 300/300 output frames carried the right source frame, offsets (`data-media-start`) were exact, and two renders were byte-identical. Never seek, play or pause the element yourself.
- **Plain `<video>` with `currentTime = N / fps` is one frame early on 11 of 24 sampled frames.** It still passes all three determinism gates, because a deterministic off-by-one is still a pure function of t. Repeatable is not the same as right.
  - If you must drive a `<video>` yourself, seek to `(N + 0.5) / fps`. Or wait for `requestVideoFrameCallback` (accurate, but about 180 ms per frame).
  - **Test with a frame-index barcode burned into the source,** not with the gates alone.
- **Mediabunny (`CanvasSink` / `VideoSampleSink`) decodes the exact frame** (24/24) in about 22 ms. Use it only in pages that draw video themselves: WebGL/canvas plates rendered by an awaiting frame driver. Inside HyperFrames it adds nothing, and its async decode cannot run in a synchronous seek hook.

## Audio: declare it, or mix it offline (ADOPT); never play it live (REJECT Howler)

- **Howler.js (and any WebAudio or `<audio>.play()` sound) never reaches the rendered MP4.** The render had no audio stream at all. Frame renderers capture pixels, not the page's audio output, and live playback runs on the wall clock anyway.
- **HyperFrames `<audio id data-start>`** placed a tone at 500.04 ms for a 500 ms cue and kept the level.
  - Every `<audio>` needs an `id`; an id-less tag renders silent.
  - Use it for simple cues.
- **Mix offline for finishing** (a mixer that writes the master WAV at −14 LUFS, then the comp carries it as one `<audio>`). The master held −14.1 LUFS through the AAC encode, within 0.1 LU, with zero sample lag.

## ffmpeg build notes

- **The common Homebrew 8.0.1 build lacks** libass (`subtitles=`), libfreetype (`drawtext`), the `libvmaf` filter, `zscale` and libplacebo. It **has** psnr, ssim, xpsnr, ebur128, loudnorm, SVT-AV1, libvpx and x265.
- **Workarounds instead of a rebuild:**
  - Burn captions in as DOM/canvas layers in the composition, or as an alpha PNG track.
  - Measure VMAF with the standalone `vmaf` CLI via y4m files.
- **When comparing files from different muxers** with `psnr`/`ssim`, add `settb=1/30,setpts=N` to both inputs so frames pair by index.
- **`-y` matters in loops.** Without it ffmpeg can silently keep a stale output file.

## HyperFrames notes from these runs

- **A composition with no GSAP timeline needs `data-no-timeline` on its root.** Otherwise lint errors and the producer waits.
- **`-w` is the worker count, not the width.**
- **HyperFrames renders with its own `chrome-headless-shell`.** Don't pixel-diff its output against a different Chrome build: text anti-aliasing differs slightly, while images are bit-identical.
