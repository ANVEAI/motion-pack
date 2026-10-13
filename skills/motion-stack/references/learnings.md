# Production learnings (what actually broke, and the fix)

These are collected from shipping real spots, films and promos with agents, Oct 2026. Each line was observed, not theorised.

## Audio

- **HyperFrames lowers the whole soundtrack if its AAC encode goes over −1 dBTP.** You only see it with `--debug`. A WAV mastered to −1.5 dBTP still tripped it on one promo; mastering to **−2.0 dBTP** gave −1.64 dBTP on the decoded MP4. Probe the decoded AAC, not the WAV.
- **ffmpeg `alimiter` auto-levels by default.** It pushed a −15 LUFS master to −13.5 LUFS and +0.3 dBTP (clipping). Use `alimiter=limit=...:level=disabled`.
- **Loudness targets:** −14 LUFS-I for social, −23 LUFS for broadcast or festival masters. Measure the delivered file.
- **The last 0.15 s should be digital zero,** or some players click on loop.
- **A cue for visual frame F lands its anchor sample on (F+1) × sample_rate / fps:** one frame after the picture. Risers end one frame before the hit. Whooshes peak on the cut.

## Rendering

- **Renderers get killed near a full disk.** Check free space before renders and stop under 10 GiB. A near-full disk shows up as random exit-143 kills, not as a clear error.
- **Cloud-synced folders (iCloud, Dropbox, OneDrive) can stall file reads mid-render.** Evicted files look present but block on read. Render from a local, unsynced folder.
- **A hidden browser tab throttles timers and animation** (`document.hidden`). Counters and reveals "look broken" in a preview pane that is behind other windows. Check `document.visibilityState` before you debug the code.
- **Some bundlers (esbuild) deadlocked under one Node version in a sandboxed agent shell and ran fine under another.** If a build hangs at 0% CPU, try a different Node before you debug the project.
- **Chrome's GPU raster is not byte-reproducible** (98–111 dB noise variants). Use `--disable-gpu` when stills must be identical byte for byte; keep the GPU for WebGL.
- **Multi-threaded x264 is not byte-reproducible between runs.** Use `-threads 1` if you need identical files (for example, for content hashes).

## Delivery to platforms (browser-automation era)

- **Some browser-automation tools cap a file upload at about 10 MB per call.** Make a two-pass x264 copy at `(9.5 MB × 8e6 × 0.97 / duration) − audio` kbps. For CG this held about 49–52 dB PSNR, so it is visually lossless. Don't try to chunk-inject files through the page.
- **A tab in the background stalls typing and video processing on some sites.** Bring the window to the front.
- **YouTube Studio:**
  - Publishing before "Checks complete" triggers a "still checking" warning. Go back, wait, then publish.
  - Set "altered or synthetic content" honestly: No for stylised CG nobody would mistake for real, Yes for photoreal renders of people, places or products.
- **Instagram's "AI info" label defaults OFF on web uploads.** Switch it on when needed, and verify the checkbox state before sharing.
- **LinkedIn company-page comments** default the commenting identity to your personal profile on every post. Switch the identity to the page each time, and check the placeholder reads "Comment as <page>".
- **X:** after clicking into a reply box, verify that the focused element really is the reply textarea before typing. A misplaced click once typed into the search box.
- **Post everywhere at once,** not drip-fed, when the goal is a launch moment. A drip is for a series cadence.
- **Volume without reach does nothing.** Fix the hook (first second), the cover and the format on a few posts before scaling output or ads.

## Honesty that survives editing

- **Label illustrations and concept renders in frame** ("illustration", "demo data", "in development"). Labels work without killing the story; the story is what earns the label space.
- **Any number on screen needs a source in your plan.** Lint for digits without a source.
- **Never let an image model redraw UI, logos or text.** It garbles them. Composite the real screenshot instead.
- **References are craft to learn from, not designs to copy.** Rebuilding someone's prompt or look literally is a different job from making your own film better.
