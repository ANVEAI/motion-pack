# Vector: Lottie players, Rive, SVGO

These results were measured on 13 Oct 2026, with HyperFrames 0.8.142 and Chrome 154.

**Test assets:**
- **Lottie:** a hand-authored badge (1080², 60 frames, 5.9 KB) using gradient fill, overshoot scale, Trim Paths, Repeater ticks and a ring burst.
- **Rive:** a public sample `.riv`.
- **Icons:** 498 icons from Lucide, Phosphor and Fluent flat.

## Lottie: lottie-web (SVG renderer) through HyperFrames' native adapter (ADOPT); dotLottie for named niches

| player | gates | notes |
|---|---|---|
| **lottie-web 5.13 SVG** | G1, G3 and G4 pass. G2 shows noise only (84.9 dB, 1–3 px of a 22%-alpha hairline) | 3 script lines; 242–312 KB; crisp at 4K |
| lottie-web canvas | all pass | blank in HyperFrames unless its container has an explicit pixel size; ignores effects |
| **dotLottie web (ThorVG)** | all pass, zero differing pixels | 1.4 MB with wasm. Renders blurred drop shadows properly. Byte-identical across render workers. Needs a 7-line bridge (below) |

**Use lottie-web by default. Use dotLottie when:**
- you have `.lottie` bundles;
- you need effects (drop shadow, fill);
- you need byte-identical output across workers.

**The engines disagree, so check in the player that ships.** ThorVG and lottie-web agree to about 50 dB on shapes, strokes and gradients, except:
- **Trim Paths before a Repeater** (the order After Effects exports): lottie-web draws the ticks shorter than the keyframes say, and ThorVG follows them. Put the Repeater before the Trim and both agree.
- **Effects:** lottie-web SVG draws a hard, box-clipped shadow, and canvas draws none.
- **Merge Paths:** works in no engine (all draw the union).
- **A third engine:** some Lottie-authoring tools verify in Skia Skottie, which differs from both. Re-check any generated Lottie in your shipping player.

### lottie-web, native adapter (default)

```html
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1080" data-duration="2" data-no-timeline>
  <div id="badge" class="clip" data-start="0" data-duration="2"></div>
</div>
<script src="lib/lottie.min.js"></script>     <!-- local copy of lottie-web@5.13.0 build/player/lottie.min.js -->
<script src="assets/badge.js"></script>       <!-- window.BADGE = {...}: inline data, no async fetch -->
<script>
  const anim = lottie.loadAnimation({ container: document.getElementById('badge'), renderer: 'svg', loop: false, autoplay: false, animationData: window.BADGE });
  (window.__hfLottie = window.__hfLottie || []).push(anim);
</script>
```

- **The root needs `data-duration`.** Without it, the render failed with "Composition duration is 0" and the CLI lingered. The root also needs `data-no-timeline`; without it, lint errors and the render waits 45 s for a GSAP timeline.
- **Set `loop` explicitly.** lottie-web defaults to `true`.
- **A Lottie plays against root time.** A plain clip with `data-start="1"` does not delay it. To start it later, mount it in a sub-composition host with its own `data-start`, or author the delay into the file.

### dotLottie through an `hf-seek` bridge

HyperFrames' Lottie adapter seeks with `setCurrentRawFrameValue` or `seek(percent)`. dotLottie-web 0.80 has neither (it has `setFrame`), so registering it on `window.__hfLottie` renders a **blank video with no warning**. The package also has no browser global, so `<script src=".../dotlottie-web">` then `new DotLottie` cannot work. Bridge it instead:

```html
<canvas id="badge" class="clip" data-start="0" data-duration="2" style="width:1080px;height:1080px"></canvas>
<script type="module">
  import { DotLottie } from './lib/dotlottie-web/index.js';               // copy dist/index.js + dist/dotlottie-player.wasm
  DotLottie.setWasmUrl(new URL('./lib/dotlottie-web/dotlottie-player.wasm', import.meta.url).href);
  const FPS = 30;                                                          // the Lottie's own frame rate
  const player = new DotLottie({ canvas: document.getElementById('badge'), data: window.BADGE, autoplay: false, loop: false,
    renderConfig: { autoResize: false, freezeOnOffscreen: false } });      // don't pin devicePixelRatio: 4K output stays sharp
  const loaded = new Promise((res, rej) => { player.addEventListener('load', res); player.addEventListener('loadError', rej); });
  window.addEventListener('hf-seek', (e) => e.detail.waitUntil(loaded.then(() =>
    player.setFrame(Math.min(player.totalFrames - 1, Math.max(0, e.detail.time * FPS))))));
</script>
```

- **`e.detail.time` is composition time.** Subtract the clip's start yourself.
- **Never pin `devicePixelRatio: 1`.** At 4K (DPR 2) the 1080 bitmap gets upscaled (edge spread 4.4 px vs 2.9).

## Rive: deterministic for linear animations, not adopted

| recipe | gates |
|---|---|
| one persistent artboard; on each seek `inst.time = 0; inst.advance(t); inst.apply(1); artboard.advance(0)` | pass |
| `rive.scrub(name, t)` (deprecated in 2.43) | pass, bit-identical to the above |
| `inst.time = t` without `advance` | passes, but is wrong for loops (no wrap; 27 dB off after the first loop) |
| state machine, fresh instance per seek, replaying fixed 1/fps steps | passes, but is **step-size dependent**: the same t at 30 vs 60 fps steps differs by 32–39 dB, and cost grows with t |
| state machine advanced by delta (how a live player works) | **fails G2/G3** (20 dB) |

**Verdict: no** for a code-first pack. Authoring needs the Rive editor, so every `.riv` comes from a designer with its own licence.

If someone hands you a `.riv`:
- render linear animations with the persistent-artboard recipe;
- pass `wasmBinary` yourself, because HyperFrames' server sends the wrong wasm MIME type and Rive logs an error that fails `check`;
- for state machines, replay a fixed canonical step.

## SVGO: run once per icon set at import, with a draw-on-safe config (ADOPT)

**The default preset breaks stroke-by-stroke draw-ons:**
- `mergePaths` fused 380 Lucide drawables into 195, so 70 of 111 icons lost their stagger;
- arc fitting moved Fluent outlines enough to drop some to 32.9 dB.

The tested config (`svgo@4.1.0`; in the motion-pack repository it ships as `scripts/svgo.config.mjs`):

```js
// svgo.config.mjs
export default {
  multipass: false,                      // a 2nd pass deleted a real element in one emoji
  plugins: [
    { name: 'preset-default', params: { floatPrecision: 3, overrides: {
        mergePaths: false,               // keeps one element per stroke: the draw-on stagger survives
        convertShapeToPath: false,       // keeps rect/line/polyline tags agents and engines expect
        convertPathData: { makeArcs: false, floatPrecision: 3 },   // arc fitting moved outlines (the cause of every result under 40 dB)
    } } },
    { name: 'prefixIds', params: { prefixIds: true, prefixClassNames: true, delim: '__' } },  // cleanupIds turns every id into "a": two inlined icons would share a clipPath
  ],
};
```

`npx svgo@4.1.0 --config svgo.config.mjs -r -f <in> -o <out>`

**Results over 498 icons:**
- 30.7% smaller raw, 25.2% gzip;
- zero icons change their drawable count;
- worst raster PSNR 42.8 dB;
- draw-on frames bit-identical to the originals over 90 frames, in the harness and in a HyperFrames render.

**Keep:** `viewBox`, `width`/`height`, `xmlns`, `currentColor`, and root stroke attributes (Lucide inherits them).

**Run SVGO once when a set is imported**, not at render time. Keep the untouched originals next to the licence. SVGO's CLI auto-loads `./svgo.config.mjs` from the working directory, so a "default" run next to your config silently uses yours.
