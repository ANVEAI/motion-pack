# Lane D results: Satori + resvg, Mediabunny, Howler.js, FFmpeg (13 Oct 2026)

Machine: M3 Pro, Node 25.9.0, headless `/Applications/Google Chrome` 154.0.8037.98 (harness flags), ffmpeg 8.0.1 (Homebrew 8.0.1_4), HyperFrames 0.8.142.
Files: `results.json` (24 rows, BRIEF schema), `evidence/` (copies of every number's source), scripts in `d1/ d2/ d3/ d4/ d5/`, `build_results.py` (regenerates results.json from the measurement files).
All paths below are relative to `lab/d-output/`.

## 0. Read first

**Version rule.** BRIEF rule 3 says "published at least 14 days ago". The pins in the lane message break it: `satori@0.52.0` was published 13 Oct 03:29 UTC and `mediabunny@1.61.4` on 12 Oct 19:16 UTC (satori shipped 0.34 to 0.52 in 11 days, via GitHub Actions OIDC with SLSA provenance, so it looks legitimate, but the rule is the rule). I followed the rule and installed the newest eligible versions with `npm i --before=2026-09-29T08:00:00Z --ignore-scripts` (the `--before` flag enforces the 14 days over the whole dependency tree):
`satori@0.33.5` (22 Sep), `@resvg/resvg-js@2.6.2` (2024), `mediabunny@1.60.0` (25 Sep), `howler@2.2.4` (2023). Every D1(a) and Mediabunny number below is for those versions. (npm metadata: satori 0.52.0 is 21 MB unpacked with a new layout wasm and harfbuzz, 0.33.5 is 5.8 MB.)
Why it matters: satori's release notes for 0.46 to 0.52 name `fontKerning`/`fontVariant` (0.46), `background-blend-mode` (0.47), `direction: rtl` (0.48), "letter spacing after every character, matching browsers" (0.49.1, this is the biggest D1 difference), `<style>` elements (0.50/0.51). A re-run on 0.52.0 would very likely close the tracking gap and 3 more of the 17 ignored CSS features (blend mode, rtl, `<style>`). To re-run after approval: `npm i --save-exact satori@0.52.0 mediabunny@1.61.4` in this folder, then `node d1/render_satori.mjs --runs 10`, `node d1/css_run.mjs && python3 -I d1/css_compare.py && python3 -I d1/css_final.py`, `node d2/run_mb.mjs ...`, `node d3/run_d3.mjs`. All scripts are version-agnostic. (`mediabunny@1.61.0` becomes eligible 13 Oct 10:22 UTC, 1.61.4 on 26 Oct, satori 0.52.0 on 27 Oct.)

**Also needs approval, only if wanted:** `brew install ffmpeg-full` (keg-only, 47 dependencies, GPL-3.0-or-later) for libass. I did not install it; recommendation below is not to.

## 1. Recommended combination per job

| job | winner | exact versions | niche / what not to use |
|---|---|---|---|
| Covers and thumbnails | HTML + headless Chrome screenshot (puppeteer-core from the npx cache, harness flags). Add `--disable-gpu` for byte-identical stills. Same HTML also runs as a HyperFrames comp. | puppeteer-core 25.13.0, Chrome 154.0.8037.98, Manrope-Variable.ttf (OFL) via `@font-face`, Fluent 3D PNG as `<img>` | Satori+resvg only where no Chrome exists (provisional until 0.52.0 re-test); PIL only for pixel compositing, never for layout |
| Encoding (upload copies, finals) | ffmpeg x264 two-pass `-preset slow -tune animation` (unchanged) | ffmpeg 8.0.1, x264 core 165 r3222 | Mediabunny avc/av1 only for in-browser drafts and web AV1 renditions |
| Video layers inside comps | HyperFrames native `<video>` (300/300 frames exact, offsets exact, byte-identical re-render) | hyperframes 0.8.142 | Mediabunny `CanvasSink` only in custom canvas/WebGL pages (kit plates via `render.mjs`), never inside a HyperFrames comp |
| Audio | HyperFrames `<audio id data-start>` for simple cues, `mixer.py` offline master for finishing | hyperframes 0.8.142, mixer.py (read-only), ffmpeg 8.0.1 | Howler.js: its sound never reaches the MP4 |
| FFmpeg | keep 8.0.1; do not add libass or libvmaf | n/a | VMAF already works through the installed standalone `vmaf` 3.0.0 CLI |

## 2. Results table (full rows with notes and evidence paths: `results.json`)

Gates: Y/N/-, `-` = not applicable or not run. `ms` = ms per image (D1, 1280x720, median of 10 warm runs, better of 2 passes), ms per frame encoded (D2, 1080x1920, 3966 kbps), ms per seek+draw (D3), ms per rendered frame (D3a). Q = quality 1-5.

| variant | what | G1 G2 G3 G4 | ms | Q | LOC | verdict |
|---|---|---|---|---|---|---|
| D1a-satori-resvg | satori 0.33.5 + resvg-js 2.6.2 | Y Y Y - | 319 | 4 | 87 | ADOPT-FOR browserless runtimes (provisional) |
| D1b-html-chrome-screenshot | puppeteer-core 25.13.0 + Chrome 154 | Y Y Y Y | 202 | 5 | 98 | **ADOPT** |
| D1c-pil | Pillow 10.1.0 + numpy + fontTools | Y Y Y - | 549 | 4 | 273 | KEEP-CURRENT (pixel compositing only) |
| D2a-x264-2pass-slow-animation | ffmpeg 8.0.1 / x264 r3222 | - - - Y | 71 | 5 | 12 | KEEP-CURRENT |
| D2b-x264-1pass-veryfast | same, fast preset | - - - - | 10 | 3 | 4 | REJECT |
| D2c-ffmpeg-h264_videotoolbox | hardware via ffmpeg | - - - - | 7 | 3 | 4 | REJECT |
| D2d-mediabunny-avc-hw | mediabunny 1.60.0, Chrome WebCodecs | - - - - | 5 | 3 | 25 | ADOPT-FOR in-browser drafts |
| D2e-mediabunny-avc-sw | same, OpenH264 software | - - - - | 14 | 3 | 25 | ADOPT-FOR same niche, no hardware |
| D2f-mediabunny-vp9 | same | - - - - | 8 | 4 | 25 | REJECT |
| D2g-mediabunny-av1 | same | - - - - | 8 | 4 | 25 | ADOPT-FOR web AV1 renditions |
| D2h-ffmpeg-svtav1 | ffmpeg libsvtav1 preset 6 | - - - - | 45 | 5 | 4 | ADOPT-FOR AV1 finals if ever needed |
| D2i-ffmpeg-vp9 | ffmpeg libvpx-vp9 | - - - - | 96 | 4 | 4 | REJECT |
| D3a-hyperframes-native-video | HyperFrames `<video>` | Y - - Y | 65 | 5 | 6 | **ADOPT** |
| D3b-video-element-currentTime-exact | `<video>` + N/fps | Y Y Y - | 30 | 1 | 25 | REJECT (wrong frame 11 of 24, gates still pass) |
| D3c-video-element-half-frame | `<video>` + (N+0.5)/fps | Y Y Y - | 30 | 4 | 25 | REJECT |
| D3d-video-element-rvfc | `<video>` + rVFC | - - - - | 182 | 4 | 28 | REJECT |
| D3e-mediabunny-canvassink | mediabunny CanvasSink | Y Y Y Y | 22 | 5 | 15 | ADOPT-FOR WebGL/canvas plates |
| D3f-mediabunny-videosamplesink | mediabunny VideoSampleSink | Y Y Y - | 24 | 5 | 15 | ADOPT-FOR same niche |
| D4a-howler-in-hyperframes | howler 2.2.4 | - - - N | - | 1 | 6 | REJECT |
| D4b-hf-audio-tag | `<audio id data-start>` | - - - Y | - | 5 | 1 | ADOPT |
| D4c-offline-mixer-master | mixer.py master + comp/mux | - - - Y | - | 5 | 8 | ADOPT |
| D5a-ffmpeg-8.0.1-current | Homebrew ffmpeg 8.0.1_4 | - - - Y | - | 5 | 0 | KEEP-CURRENT |
| D5b-ffmpeg-full-libass-libvmaf | ffmpeg-full 9.0.2, not installed | - - - - | - | - | 0 | REJECT (not worth adding) |
| D5c-standalone-vmaf-cli | vmaf 3.0.0 CLI | - - - - | - | 5 | 15 | ADOPT-FOR encode QC |

## 3. D1 Covers and thumbnails

Two templates (1280x720 thumbnail, 1080x1920 cover), one shared `d1/spec.json` of coordinates, the same ingredients: dark 135/160 degree gradient plus radial glow, 2-line Manrope 800 headline at -0.04em with a gradient-filled second line and a soft text shadow, rounded chip with a dot, a 3-line wrapped subtitle, a rounded card with two soft box-shadows holding the real frame (ffmpeg, t=13 s of the 16x9 spot, 1920x1080 PNG, `object-fit: cover`), the Fluent 3D `ledger.png` rotated -8/+9 degrees with a soft drop shadow, and on the cover a second chip in IBM Plex Mono. Outputs: `d1/out/{chrome,satori,pil}-{thumb,cover}.png`, sheets `d1/out/sheet-*-all.jpg`.

**Fidelity vs Chrome (Chrome = what the CSS means), PSNR dB, thumb / cover** (`d1/out/compare-final.json`; PSNR is harsh on text, read with the ink widths below):

| region | satori | pil |
|---|---|---|
| headline | 12.9 / 11.7 | 25.7 / 23.1 |
| chip | 16.9 / 16.0 | 25.2 / 24.0 |
| subtitle | 22.9 / 24.1 | 18.1 / 21.7 |
| card (real frame, radius, shadow) | 32.2 / 32.2 | 31.4 / 33.5 |
| emoji + rotation + shadow | 24.0 / 29.0 | 26.9 / 33.0 |
| whole image | 16.3 / 19.3 | 25.4 / 27.4 |

- **Kerning and tracking, measured** (`d1/kern_probe.py`, Manrope 800 at 110 px, width difference to Chrome in px): satori applies GPOS kerning (0 and -1 px at 0 tracking). With `-0.04em` it is +8 and +22 px wider because 0.33.5 does not add letter-spacing after spaces (2 and 5 spaces in those lines; the headline ink ends 12 px late: 981 vs 969 on the thumb). The chip text shows it plainly: "ON-DEVICE· NO CLOUD". Fixed upstream in 0.49.1. PIL without raqm has no GPOS kerning at all: +52 and +38 px wider; after about 50 lines of fontTools GPOS pair-kerning code it matches Chrome within 1 px.
- **Gradients**: Chrome dithers, satori and PIL band (residual noise std 0.31 vs 0.04 on the dark thumb strip, 0.47 vs 0.11 and 0.08 on the cover; 56 vs 34 and 35 distinct colours).
- **Shadows**: box-shadows match (card shadow strip within 1-2 levels, 49 dB). Satori `filter: drop-shadow()` on the emoji is emitted but clipped to the img box, so the alpha-shaped soft shadow is invisible; I used a rotated transparent box with `box-shadow` behind the image (an approximation). Satori also rounds rotate() to a 2-decimal matrix while computing the translation exactly, which displaces a 380 px emoji 4-6 px (18.7 dB until I put the exact cos/sin back: 29.0 dB).
- **Emoji**: the 3D PNG as `<img>` works in all three. Emoji characters inside text: Chrome draws Apple Color Emoji; satori draws a tofu box unless `loadAdditionalAsset` returns an image, and with a local Fluent PNG data URI it works offline (probe `emoji-text-loader`); PIL needs Apple Color Emoji at bitmap size 160 plus a downscale, and no ZWJ sequences without raqm.
- **Text wrapping**: the 3-line subtitle breaks identically in all three. `text-wrap: balance` and plain wrap give the same lines in satori and Chrome (probe).
- **Speed per image, median of 10 warm runs, better of 2 passes (thumb / cover, ms)**: Chrome 202 / 283 (cold with a new browser and profile each image 545 / 662); satori+resvg 319 / 699 (satori itself 9 ms, resvg 310 / 690; a tuned variant with a pre-scaled JPEG and tight filter regions gets 215 / 677); PIL 549 / 898. First call in a fresh process: satori 386 / 660, PIL 540 / 517. resvg-js by default loads system fonts, about 1.2 s on the first render; pass `font: { loadSystemFonts: false }`.
- **Determinism (same bytes twice)**: satori and PIL: identical SHA-256 over 11 in-process renders and a fresh process, both templates. Chrome with GPU raster (the harness flags): the thumb produced 2 distinct byte patterns in 20 renders (98.4 dB apart, a few pixels off by one level), the cover 1 of 20; the harness reports G2 (and on the cover G3) FAIL, noise only (98 and 111 dB). Chrome with `--disable-gpu`: 20 of 20 identical for both templates and the harness passes G1-G3 (`lib/chrome-nogpu.sh` is a wrapper you pass with `--chrome`).
- **Effort**: HTML route 98 lines (51 for the HTML builder, 47 for the runner), zero workarounds. Satori 87 lines plus 5 workarounds. PIL 273 lines plus 3 (hand kerning, supersampled masks, a shadow hole bug I caused and found with a numeric profile check).
- **G4 (production path)**: the cover HTML as a 1 s HyperFrames comp (`d1/hf-cover/index.html`, needs `data-no-timeline` on the root) lints clean and renders in 2.3 s; the still is visually identical (`d1/out/sheet-g4-cover.jpg`, 29.5 dB through H.264). `hyperframes snapshot --at 0.5` writes a 1080x1920 PNG whose card and emoji regions are bit-identical to the puppeteer shot and whose text differs only in anti-aliasing (headline 24 dB; 1% of pixels off by more than 8 levels): because HyperFrames drives its own `chrome-headless-shell` 152.0.7977.30 (`~/.cache/hyperframes/chrome/`), not `/Applications/Google Chrome` 154 with the harness flags.
- **Internal thumbnail script note**: despite the "PIL" label it renders an HTML page with Playwright (and loads Montserrat from Google Fonts over the network at render time) and only uses PIL for the crop and JPEG save, so it is variant (b) in spirit, with a network dependency that makes it non-deterministic offline. Variant (c) here is a pure PIL implementation.

**CSS Satori cannot do (50 one-feature cards, 360x200, `d1/out/css/`; full table `d1/out/css/css-compat-table.md`, sheets `sheet-css-{1,2,3}.jpg`).** 27 match, 1 close, 17 silently ignored (no error, wrong picture), 5 throw:
- Throws: `display: grid`, `display: inline-block`, `conic-gradient`, `perspective()`/3D transforms, `text-decoration: underline wavy #color`.
- Ignored: `z-index` (paint order = DOM order), `calc()`, `clamp()/min()/max()` (the element collapses to zero width), `aspect-ratio`, `outline`, `backdrop-filter`, `mix-blend-mode`, `background-blend-mode` (0.47+), `-webkit-text-stroke` (with transparent fill the text vanishes), `clip-path: polygon()`, individual `rotate:` property, `rgb(r g b / a)`/`oklch()`/`color-mix()` (paint black; `hsl()` is fine), `direction: rtl` (0.48+), `<style>` and classes (CSS text is drawn as content; 0.51+), `filter: drop-shadow()` (clipped to the box), tracking after spaces (0.49.1), emoji without a loader.
- Works: flex/gap/wrap, `var()`, `background-clip: text`, `mask-image`, `object-fit/position`, repeating/radial/linear gradients with positions, multi-layer and inset `box-shadow`, `filter: blur/brightness/saturate`, skew/scale/rotate, `text-wrap: balance`, line-clamp with `-webkit-box`, ellipsis (block), `pre-wrap`, elliptical radii, overflow clipping, inline `<svg>`, multi `text-shadow`, `font-feature-settings` (tnum), em/rem/vw/vh.

## 4. D2 Encoding

Source: 10.0 s of the 9x16 master (t = 6 to 16 s: book opening, call-log reveal, "On the record."), cut once to `d2/src10.mp4` (x264 crf 6, GOP 30, 1080x1920, 30 fps, bt709 tags) so both pipelines read identical bytes; all PSNR/SSIM/VMAF are against it. Bitrates: **3966 kbps** is what `make_upload_copy.sh` computes for the real 18.006 s spot (97% of 9.5 MB minus 128k audio); **1100 kbps** is the long-short rate and the stress case; the script's own cap for a 10 s clip would be 6000. Video only, `-movflags +faststart`/`fastStart: 'in-memory'`, keyframes every 8 s. Mediabunny runs in the harness Chrome through `Conversion` with `forceTranscode: true` (by default it copies packets when it can).

**Encoders headless Chrome 154 offers** (`d2/out/probe-encoders.json`): AVC hardware (VideoToolbox) and software (OpenH264) at every level up to 5.1; HEVC hardware only (gone with `--disable-gpu`); VP8, VP9 (profile 0 and 2) and AV1 (main 8-bit) software only, no hardware; AAC-LC and Opus encoders; no FLAC, MP3 or Vorbis encoder; AV1 10-bit unsupported. Mediabunny's `getEncodableVideoCodecs()` returns avc, hevc, vp9, av1, vp8 (without hevc under `--disable-gpu`).

**At 3966 kbps** (size in MB, PSNR dB, SSIM, VMAF 0.6.1, encode seconds for 300 frames):

| encoder | MB | PSNR | SSIM | VMAF | s |
|---|---|---|---|---|---|
| x264 two-pass slow animation (our recipe) | 4.62 | 48.96 | 0.9907 | 97.47 | 21.4 |
| x264 one-pass slow animation | 4.75 | 48.99 | 0.9908 | - | 14.4 |
| x264 one-pass veryfast | 4.73 | 47.28 | 0.9892 | - | 3.1 |
| ffmpeg h264_videotoolbox | 5.15 | 47.66 | 0.9908 | 95.97 | 2.0 |
| Mediabunny avc hardware | 5.00 | 47.95 | 0.9908 | 96.11 | 1.56 |
| Mediabunny avc software | 4.92 | 48.03 | 0.9898 | 96.95 | 4.07 |
| Mediabunny hevc hardware | 4.50 | 48.64 | 0.9901 | - | 2.45 |
| Mediabunny vp9 | 4.84 | 48.68 | 0.9902 | 97.53 | 2.31 |
| Mediabunny av1 | 3.89 | 48.73 | 0.9906 | 97.43 | 2.31 |
| ffmpeg vp9 good cpu2 | 5.04 | 49.69 | 0.9917 | 97.91 | 28.7 |
| ffmpeg svtav1 p6 | 3.91 | 49.59 | 0.9915 | 97.91 | 13.5 |

**At 1100 kbps:** x264 two-pass 1.34 MB, 48.16, 0.9897, 96.96, 15.8 s; x264 one-pass slow 1.10 MB, 47.39; veryfast 1.23 MB, 45.32; videotoolbox 1.49 MB, 45.03; Mediabunny avc hardware 1.39 MB, 45.70, VMAF 93.56, 1.6 s; avc software 1.36 MB, 45.13, 93.70, 2.2 s; vp9 1.45 MB, 46.63, 95.77, 1.7 s; av1 1.13 MB, 47.18, 96.16, 1.7 s; ffmpeg vp9 1.62 MB, 48.26; svtav1 1.03 MB, 48.83.

**Matched size** (Mediabunny re-run at a bitrate that lands on x264's bytes): at 4.6 MB x264 48.96 dB / VMAF 97.47 vs Mediabunny hardware 47.80 / 95.99 and software 47.92 / 96.84; at 1.34 MB x264 48.16 / 96.96 vs 45.63 / 93.47 and 45.13 / 93.76. So for H.264 x264 slow wins by 1.0-1.2 dB at upload size and 2.5-3.0 dB at the stress rate. Mediabunny is about 14x faster (hardware) and its AV1 gets x264's VMAF in 16% fewer bytes in 2.3 s. At 100% crops the 1100 kbps encodes differ only in softer text and dark gradients (`d2/out/sheet-d2-crops-1100.jpg`).

**Validity**: every output decodes without errors, has 300 frames, `moov` before `mdat`, and keeps tv/bt709/bt709/bt709 colour tags; Mediabunny avc is High L4.0. Mediabunny AAC works (container 10.069 s because of audio padding). Requested size is not hit exactly: x264 two-pass lands 7% under, videotoolbox 4-9% over, Mediabunny hardware +1%. Mediabunny hardware ignores `bitrateMode` (constant and variable are byte-identical).
**Reproducibility**: Mediabunny/WebCodecs payloads are identical run to run (decoded PSNR inf for avc hw/sw, vp9, av1); only 6-7 header bytes differ (wall-clock creation time). Multi-threaded x264 is not reproducible: two runs of the veryfast recipe differ (decoded PSNR 50.5 dB between runs), two runs of the two-pass slow recipe too (51.7 dB); `-threads 1` gives identical bytes.
**G4**: the winning recipe applied to a real HyperFrames render (`d3/out/hf-video.mp4`): 4.85 MB, 48.87 dB, High, bt709, 300 frames, faststart.

## 5. D3 Frame-exact decode inside HTML comps

Clip: the real 10 s Ledger clip with a 10-bit frame-index barcode burned in (ffmpeg `drawbox`), x264 crf 14, GOP 60, 2 B-frames (`d3/ledger-code30.mp4`). 24 sampled frames (0, 1, 2, 29-31, 59-62, 89, 90, 119-121, 150, 179-181, 239, 240, 269, 298, 299), drawn on a 1080x1920 canvas, barcode read back, PSNR vs the ffmpeg-extracted frame at that index (`d3/refs/`). Ascending and shuffled order both run.

| path | right frame (asc / random) | PSNR vs ffmpeg ref | seek+draw median asc / random | first seek |
|---|---|---|---|---|
| `<video>` currentTime = N/fps | **13/24** / 13/24 (wrong: 2, 29, 59, 61, 62, 89, 119, 179, 239, 269, 299, each one frame early) | 41.19 on the right ones | 30 / 33 ms | 281 ms |
| `<video>` currentTime = (N+0.5)/fps | 24/24 / 24/24 | 41.14 | 30 / 33 ms | 75 ms |
| `<video>` + requestVideoFrameCallback | 24/24 / 24/24 | 41.14 | 182 / 177 ms | 204 ms |
| Mediabunny `CanvasSink` exact N/fps | 24/24 / 24/24 | 41.14 | 22 / 22 ms | 40 ms |
| Mediabunny `VideoSampleSink` exact N/fps | 24/24 / 24/24 | 41.14 | 24 / 24 ms | 48 ms |
| Mediabunny, software decode | 24/24 / 24/24 | 41.14 | 161 / 127 ms | 96 ms |
| HyperFrames native `<video>`, all 300 output frames | **300/300**, no skip or duplicate | 39.5 avg, 38.9 min (after the 26 Mbps re-encode) | render 19.5 s total | n/a |
| HyperFrames, `data-start=0.5 data-media-start=1` | 90/90 visible frames, source index = k+15 as predicted | | | |

- All Chrome paths that show the right frame are **bit-identical to each other** (max abs diff 0), and 0/24 are bit-exact to the ffmpeg PNGs: Chrome's YUV to RGB and chroma upsampling differ from swscale (about 41 dB). "Exact match" therefore means exact frame, not exact bytes.
- **The harness gates cannot see this bug**: the `currentTime = N/fps` page passes G1, G2, G3 (a deterministic off-by-one is still a pure function of t). Add an index check (barcode) next to G1-G3.
- Harness gates (300 frames, 12 samples, 4 cold): `video-half`, `video-exact`, `mb-canvas-exact`, `mb-sample-exact` all PASS G1-G3.
- **How HyperFrames handles `<video>`** (`hyperframes-core/references/variables-and-media.md`, render log): the framework owns playback, composition code must not call play/pause/seek, the render pre-extracts frames with ffmpeg (`extract 1.1 s`, "video injection active") and injects them, so seeking never goes through a media element. Measured: frame-exact, deterministic (two renders have the same SHA-256 and the same 300 frame md5s). **HyperFrames is already frame-exact, so Mediabunny adds nothing inside a HyperFrames comp** (and its decode is async, which a synchronous seek hook cannot await).
- **Where Mediabunny does help (niche)**: pages that draw video themselves, i.e. WebGL/canvas plates through `render.mjs`. `d3/kit-page/video-plate.html` implements the kit page contract with a `CanvasSink` frame uploaded as a texture; the real driver awaited the async `captureFrame` and produced **90/90 right frames** at 540x960 in 5.9 s (G4, still `evidence/d3/kit-video-plate-f0030.png`, barcode reads 30).

## 6. D4 Audio

Comps (4 s, 540x960): Howler 2.2.4 loaded and playing a 440 Hz tone (autoplay on `load` and a 500 ms timer); native `<audio id data-start=0.5>` 880 Hz; Howler plus the native tag; a `<audio>` carrying the offline master (6 s). Rendered with the BRIEF command; checked with ffprobe, ebur128 and FFT.

| comp | audio stream in MP4 | content |
|---|---|---|
| Howler only | **none** (render trace `hasAudio:false`, 21 KB) | silent |
| native `<audio>` | AAC 48 kHz stereo | 880 Hz from 500.04 ms to 2499.98 ms, peak -18.0 dBFS in and out, -21.9 LUFS |
| Howler + native tag | AAC | 880 Hz only; Howler's 440 Hz never appears |
| `mixer.py` master via `<audio>` | AAC | -14.1 LUFS, -1.3 dBTP (master -14.04 / -1.50), lag 0 samples |
| same master, ffmpeg `aac` 256k mux | AAC | -14.1 LUFS, -1.4 dBTP, lag 0 samples |

Verdict: sound played through Howler does not end up in the rendered MP4 (WebAudio and HTMLAudio output is not captured by a frame-seek renderer; Howler also runs on the wall clock, so it is not a pure function of t). HyperFrames' own `<audio>` is sample-accurate and does not change the level; every `<audio>` needs an `id` (lint `media_missing_id`, an id-less tag is silent). The offline mix (`mixer.py`, run read-only with `NUMBA_CACHE_DIR` and `PYTHONDONTWRITEBYTECODE` pointed into this lane so the pack was not touched) keeps -14 LUFS through the HyperFrames AAC encode within 0.1 LU and 0.2 dB true peak. Not tested: Howler during HyperFrames Studio preview.

## 7. D5 FFmpeg

- Version: 8.0.1 (Homebrew 8.0.1_4, Apple clang 17), GPL-3.0-or-later (`--enable-gpl --enable-version3`).
- Settings that won: libx264 two-pass `-preset slow -tune animation -b:v <budget> -maxrate 1.8x -bufsize 2.5x -profile:v high -pix_fmt yuv420p -movflags +faststart`, AAC 128k; HyperFrames at `--video-bitrate 26M` (`-w` is the worker count, not the width). Nothing else in this lane beat it for H.264 finals; SVT-AV1 preset 6 is the best AV1 (49.59 dB, VMAF 97.91 at 3.91 MB, 13.5 s) if AV1 is ever required.
- Our build lacks: libass (`ass`, `subtitles`), libfreetype (`drawtext`), the `libvmaf` filter, libzimg (`zscale`), libplacebo, rubberband, libaom/librav1e, libfdk_aac, `scale_videotoolbox`. It has `xpsnr`, `psnr`, `ssim`, `msad`, `ebur128`, `loudnorm`, videotoolbox H.264/HEVC/ProRes, `aac_at`, SVT-AV1, libvpx, x265, opus (`d5/ffmpeg-capabilities.txt`).
- libvmaf: not worth a rebuild. `/opt/homebrew/bin/vmaf` 3.0.0 is installed and gave every VMAF above through y4m files (roughly 30 s per file including the y4m write; the y4m pair is 1.8 GB for 10 s of 1080x1920, move them out afterwards). The current Homebrew `ffmpeg` formula (9.0.2) depends on libvmaf, so a future `brew upgrade` would add the filter, but that is an ffmpeg 8 to 9 jump for the whole pipeline and needs its own verification.
- libass: not worth adding. Captions are DOM clips in HyperFrames (or the existing PIL alpha track for raw footage). If a flow ever needs ASS/SRT burn-in, the cleanest source is Homebrew's keg-only `ffmpeg-full` (9.0.2, GPL-3.0-or-later, libass 0.17.5 ISC, libvmaf 3.2.1 BSD-2-Clause-Plus-Patent, plus zimg, rubberband, libplacebo, aom, rav1e; 47 dependencies; sits beside the pipeline ffmpeg without replacing it). The licence does not change (our build is already GPL v3; internal use). Third-party static macOS builds are not recommended. Not installed.

## 8. Adapter snippets (smallest seek-safe forms)

HyperFrames cover/title still (the same HTML as the harness page, root needs `data-no-timeline` when there is no GSAP timeline, otherwise lint errors and the producer waits 45 s):
```html
<div id="c" data-composition-id="cover" data-start="0" data-width="1080" data-height="1920" data-duration="1" data-no-timeline> ...absolute-positioned cover elements... </div>
```
HyperFrames audio (id is mandatory):
```html
<audio id="master" src="assets/master.wav" data-start="0" data-duration="6" data-track-index="1" data-volume="1"></audio>
```
Mediabunny frame source for a kit/`render.mjs` WebGL page (async is fine, the driver awaits `captureFrame`; Blob source because the kit's server has no Range support):
```js
const blob = await (await fetch('./clip.mp4')).blob();
const track = await new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS }).getPrimaryVideoTrack();
const sink = new MB.CanvasSink(track, { width: W, height: H, fit: 'fill', poolSize: 2 });
window.renderFrame = async (n, fps) => { const r = await sink.getCanvas(n / fps);   // exact boundary is safe, no +0.5 frame
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, r.canvas); gl.drawArrays(gl.TRIANGLES, 0, 3); };
```
Byte-identical Chrome stills: pass `--chrome lib/chrome-nogpu.sh` to the harness, or add `--disable-gpu` to the launch args.

## 9. Gotchas hit

1. satori 0.33.5 throws on `Manrope-Variable.ttf` (`Cannot read properties of undefined (reading '256')` in opentype.js `parseFvarAxis`): make static instances with `fontTools.varLib.instancer` (`d1/make_instances.py`, OFL font).
2. resvg-js 2.6.2 **aborts the whole Node process** (SIGABRT, `Option::unwrap()` on None, uncatchable) on a satori SVG with a large `box-shadow` blur: satori sizes the shadow's `<filter>` region as sigma squared pixels (blur 90 gives a 4626x4374 region), and a 576x324 card with blur 80 or more kills the process. Workaround in `d1/render_satori.mjs`: rewrite oversized `satori_s-*` filters to a fixed user-space region. Reproducer: `evidence/d1/resvg-abort-thumb-card-blur90.svg` (exit 134).
3. satori rounds rotate() to a 2-decimal matrix with an exact translation; fix by writing cos/sin back (`fixMatrix`).
4. resvg-js loads system fonts by default (about 1.2 s on the first render).
5. Chrome GPU raster is not byte-reproducible (98-111 dB variants); `--disable-gpu` is.
6. HyperFrames: a comp without a GSAP timeline needs `data-no-timeline` on the root; `-w` means workers; every `<audio>` needs an `id`.
7. `<video>.currentTime = N/fps` is one frame early for 11 of 24 frames, G1-G3 still pass.
8. Mediabunny `Conversion` copies packets when it can; set `forceTranscode: true` to measure an encoder. `UrlSource` cancels range requests, which the harness counts as 29-40 `requestfailed ERR_ABORTED` console lines (harmless; use a Blob source to silence them).
9. ffmpeg `psnr`/`ssim`: warn about mismatched timebases between files from different muxers; use `settb=1/30,setpts=N` on both inputs so frames pair by index. ssim prints `Y:0.98 (18.1) ...` without "dB".
10. `ffmpeg -y` is required when a script overwrites a temp PNG in a loop (without it ffmpeg silently keeps the stale file; my first HyperFrames PSNR read 19 dB because of it).
11. `HOMEBREW_NO_INSTALL_FROM_API=0` counts as set and clones homebrew-core (see section 0).
12. HyperFrames renders and snapshots with its own `chrome-headless-shell` 152.0.7977.30, while the harness uses `/Applications/Google Chrome` 154; text anti-aliasing differs slightly (card/emoji regions are bit-identical), so do not diff the two at pixel level.

## 10. Not tested, and why

Housekeeping: HyperFrames' extracted-frame cache in `$TMPDIR/hyperframes-extract-cache-501` is 1.9 GB (shared with other lanes' renders, so I left it; it is safe to purge when no render is running). Chrome profiles were moved to `~/.Trash`, not deleted.

- satori 0.52.0 and mediabunny 1.61.4 (younger than 14 days): needs approval; re-run recipe in section 0.
- ffmpeg-full / libass / the libvmaf filter: not installed (needs approval); the VMAF numbers came from the standalone CLI instead.
- HyperFrames Studio preview with Howler, Safari/Firefox WebCodecs, other Chrome versions, other machines (determinism was checked on this Mac only).
- Mediabunny `quantizer` (CRF-like) mode, `CanvasSource` encoding from a frame sequence, AAC quality at other bitrates, AV1/VP9 MP4 acceptance on X, LinkedIn and Instagram.
- An async Mediabunny draw inside a HyperFrames comp (reasoned, not run: the seek hook is synchronous).
- Satori under Cloudflare Workers/WASM (the only runtime where it would earn its place).
- Content variety: the encoder numbers come from one clip type (clay CG with small text); live-action footage could rank the encoders differently.
- The kit's real three.js page with a `CanvasTexture`/`VideoTexture` fed by Mediabunny: the render.mjs check used a raw WebGL2 quad (same texture upload, none of the kit's post chain).
