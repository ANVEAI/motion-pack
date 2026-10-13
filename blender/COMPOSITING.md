# Compositing Blender plates in HyperFrames 0.8.142

Blender plates are rendered offline, so a composition never runs Blender. It plays the plate as media and puts the pack's type, layers and transitions on top.

## Choose the engine first

| need | use | why |
|---|---|---|
| A photoreal product (materials, soft shadows, real reflections), a macro, key art, a chrome title, or an abstract art loop | **Blender plate** (this module) | Real light transport, physical DOF and motion blur, procedural micro-detail. It costs about 2.5 s per 1080p frame in EEVEE (measured below) and minutes per Cycles still. |
| Anything that must seek live, change per viewer, follow data or text, or re-time after review: UI cards, counters, the worker character, devices with live screens | **three.js objects** (`objects/`, `templates/_shared/render3d.sh`) | It renders from `t` in the browser, re-renders in seconds, and its type, cameras and ids match the rest of the pack. It is stylised and not photoreal at macro distance (see `objects/README.md` "Polish verdict"). |
| Both | Blender for the hero shots, three.js for the explainer beats | Match the cameras by name (`lib/camera.py` mirrors `camera/cam3d.js`: orbit, pushIn, crane, dollyZoom, whip, truck), and keep the brand violet `#4A18ED` and amber band in both. |

Rule of thumb: **use Blender when the shot is the hero and the camera is decided; use three.js when the shot is still changing or must stay interactive.** A Blender change means a re-render: about 6 to 8 min per 6 s 1080p plate here, or a 480p smoke in seconds.

## Path A: opaque plate as a video layer (default)

Render without `--alpha`. The MP4 proxy (`<slug>.mp4`, H.264 yuv420p, CRF 18, bt709 tags) is the layer at the bottom of the stack. Type and overlays go above it.

```html
<div id="root" data-composition-id="launch" data-width="1920" data-height="1080" data-duration="6">
  <!-- track 0: the plate (timing on the video only, never also on a wrapper) -->
  <video id="plate" class="clip" src="assets/plates/turntable-1920x1080-matte-copper.mp4" muted playsinline
         data-start="0" data-duration="6" data-track-index="0"></video>
  <!-- track 1+: pack type and layers on top (transparent backgrounds) -->
  <div id="title" class="clip" data-start="0.8" data-duration="5.2" data-track-index="1">...</div>
</div>
```

Rules this follows (from the hyperframes-core contract):

- `muted` (plates are silent; music comes from `music/`) and `playsinline`.
- No `crossorigin`.
- Never also give a timed wrapper a `data-start`: time the `<video>` itself.
- Render decodes the video through FFmpeg, so every frame is exact. HyperFrames owns playback, so never call `play()`.
- Keep the plate at the composition's fps (30). A plate's frame F is composition time `start + F / 30`.

### Finishing: do not double it

- `--post lens` bakes an amber-tinted bloom and a vignette into the MP4 proxy only. The PNG masters stay clean. If the MP4 carries `--post lens`, do not add `layers` bloom or vignette again; add grain only (the pack's grain stocks).
- Without `--post`, finish in the pack (`layers` recipe `launch-studio`, or the Finisher for bloom and halation).

## Path B: image sequence under type and overlays

Use this when you need the exact PNG master (no H.264 loss), or an RGBA plate from `--alpha`. For example, the device over a brand gradient made in DOM, or a title over a live UI.

- EEVEE `--alpha` hides the sweep. The device and its lights render over transparency, with no floor reflection or contact shadow, because EEVEE has no shadow catcher.
- Cycles `--alpha` turns the sweep into a shadow catcher, so the shadows and the floor reflection survive in the alpha.

HyperFrames' render path pre-extracts video frames with FFmpeg. An alpha video (VP9 or ProRes 4444) is **untested** in 0.8.142, so drive a canvas from preloaded PNG frames instead. The timeline registers only after every frame has decoded, so each seek draws synchronously and stays deterministic:

```html
<canvas id="seq" class="clip" width="1920" height="1080" data-start="0" data-duration="4" data-track-index="0"></canvas>
<script>
(async () => {
  const N = 120, fps = 30, cv = document.getElementById('seq'), cx = cv.getContext('2d');
  const frames = await Promise.all([...Array(N).keys()].map(i => new Promise((ok, err) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = err;
    im.src = `assets/plates/title/frames/f${String(i).padStart(4, '0')}.png`; })));
  const tl = gsap.timeline({ paused: true });
  const st = { f: 0 };
  tl.to(st, { f: N - 1, duration: (N - 1) / fps, ease: 'none', onUpdate: () => {
    cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(frames[Math.round(st.f)], 0, 0); } }, 0);
  window.__timelines['launch'] = tl;
})();
</script>
```

- **Memory:** about 8 MB per decoded 1080p RGBA frame (about 1 GB for 4 s). For longer pieces, render alpha only for the short overlay beats, or split the plate.
- **Untested here:** this snippet has not been run inside a HyperFrames 0.8.142 render. Before relying on it, do a `snapshot` at three times and compare them with the PNGs.

## Loops

The art loops (`art.*`) and a 360-degree `turntable` are seamless: frame N renders identically to frame 0. `--loop-check` renders frame N and compares it with frame 0, and the result goes into `render.json` `loop_check`.

- **Looping a plate:** set the `<video>` `data-duration` to a multiple of the plate length and enable `loop`, or lay two copies end to end. Do not cross-fade a seamless loop.
- **Voxel wave with `--beats`:** it is seamless only when the plate length is a whole number of the bed's beats. `render.json` `recipe_report.beats.seamless` says whether it is.
  - Match the plate length to the bed: for example, 4 s = 8 beats of `music/bed_tech_pulse_loop8` at 120 BPM (15 f per beat).
  - Then put the bed's kick frames and the plate's frames on the same grid. A cue for frame F lands its anchor sample on (F + 1) x 48000 / 30.

## Re-layout, not crop

Every recipe frames by fitting the subject (`lib/camera.fit_dist`). A 9:16 render is a new camera distance and fill, not a crop of the 16:9:

- The title splits at the hyphen ("motion-" / "pack").
- The turntable fills 78 % of the width.

Render each aspect with `--size`.

## Colour and levels

- All plates are AgX "Medium High Contrast", 8-bit sRGB PNG, and bt709 in the MP4.
- The dark sweep lands near 3/255. Do not lift it in the grade, or the H.264 blacks band. Use `--depth 16` if a grade will push the shadows.
- The brand violet that reads right through AgX is linear (0.20, 0.011, 1.0), the AgX-lifted `#4A18ED` (`lib/materials.VIOLET_AGX`). In DOM, use `#4A18ED` itself.
