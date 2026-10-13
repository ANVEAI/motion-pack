# A2: does the React layer buy ANVE anything? (13 Oct 2026, lane A, sub-worker "react")

**Question:** for one small product shot, does React Three Fiber + Drei + @react-three/postprocessing buy ANVE anything over vanilla three + pmndrs `postprocessing`, given the rule that every frame is a pure function of t?

**Answer: no, not for offline plates.** The same shot built twice gives the same pixels (PSNR 103.8 to 106.5 dB between the two, an x8 amplified difference image is black), the same gate results (G1, G2, G3, G4 all pass in both) and the same GPU time (about 11 ms a frame in both). The R3F version costs 6x the installed dependencies (215 MB vs 35 MB), a bundler, 2.4x the variant-specific code, a 0.2 to 0.4 s slower boot, and a list of seek hazards that each needed a workaround. It gains no pixel, no speed and no capability the kit lacks. Recommended: stay on vanilla three (kit) and, where pmndrs effects are wanted, use pmndrs `postprocessing` directly. Drei is worth mining for two ideas only (SoftShadows, MeshReflectorMaterial), as ports without React.

All numbers below were measured on the M3 Pro (Chrome, ANGLE Metal) with the lane harness through `gpu-run.py`. "S" marks a fact read from library source, "M" marks something measured here.

## 1. The shot (identical in both variants)

- Portrait 1080x1920, 30 fps, 120 frames, a 4 s orbit: azimuth -14 to +10 degrees (kit ease `E.move`), elevation 17, fov 18, 16.6 from the target (0, 0.5, 0), near 3, far 320.
- product box on the desk, built with the kit's own builders **copied unmodified** (sha256 equal to the originals, see `kit-originals.sha256`, `v1-vanilla/anve-kit.sha256`, `v2-r3f/anve-kit.sha256`): `makeAnveBox`, `makeDesk`, `makeStudioEnv`, `makeSlabFx`, `makeBlobShadow` (from `kit/props.js`, `src/desk.js`) and `makeRig` (V1 only, see below). `patchShadows()` is extracted verbatim from `kit/core.js` lines 27-38 by `setup-kit-copies.sh`.
- Band pulse: the box's own `setBand(level)` with level = 0.58 + 0.42 * (0.5 - 0.5 cos(pi t)), period 2 s, plus the amber spill on the desk (`makeSlabFx`, `uGlowA = 0.55 * level`) and mint LEDs on.
- Post chain (same values in both, `shared/shot-spec.js`): `DepthOfFieldEffect` (worldFocusDistance 16.6, worldFocusRange 1.4, bokehScale 3) then `SelectiveBloomEffect` on the band (intensity 1.4, mipmapBlur, radius 0.9, 7 levels) then a 6-line custom white-balance effect (the kit's 4300 K key WB) then `ToneMappingEffect` NEUTRAL then `VignetteEffect` (offset 0.5, darkness 0.35). MSAA 4, HalfFloat frame buffers.
- What differs on purpose: **V1** uses the kit rig (`makeRig`), an imperative camera, `new EffectComposer`. **V2** uses declarative JSX lights, a Drei `<PerspectiveCamera makeDefault>`, `<EffectComposer>` with the `@react-three/postprocessing` effect components, and mounts the kit objects with `<primitive>`.
- Same shot, proven three ways:
  1. `evidence/lights-parity.txt`: every light of V1 (kit rig) against V2 (JSX): largest numeric difference 0.0 (colour, intensity, position, target, angle, penumbra, shadow map size, bias, normalBias, radius, shadow camera projection). The first attempt had one miss (top light penumbra 0.6 vs JSX default 1), caught by this dump.
  2. PSNR V1 vs V2, `evidence/A2-v1-vanilla/run2` against `evidence/A2-v2-r3f/run2`: frame 0 106.07 dB, frame 40 104.93, frame 80 103.76, frame 119 106.53. `evidence/diff/diff-x8-f*.png` (difference x8) are black.
  3. `evidence/contact-sheet.jpg` (row 1 V1, row 2 V2).
- V1 had to adopt two choices the R3F wrappers hard-code, otherwise the stills would differ: bloom blend `ADD` (vanilla default SCREEN) and DoF `maskFunction = MULTIPLY_RGB_SET_ALPHA` (vanilla default MULTIPLY_RGB). See gotcha 4.

## 2. Results table (BRIEF schema fields; the same rows are in `results-A2.json`)

| variant | repo / package @ version | licence | G1 | G2 | G3 | G4 | ms/frame (harness, better of 2) | quality | loc (code, comments stripped) | deps_mb | needs_bundler | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A2-v1-vanilla | Three.js `three@0.160.0` + pmndrs `postprocessing@6.36.7` | MIT, Zlib | pass | pass | pass | pass | 124.6 (runs 124.6, 164.5) | 4 | 161 non-blank, 142 code (variant 57 / 53 + shared glue 104 / 89) | 35.0 installed, 2.21 served at runtime | false (import map) | ADOPT-FOR single-sample plates and quick previews; hero plates keep the kit chain |
| A2-v2-r3f | React Three Fiber `@react-three/fiber@9.8.1` | MIT | pass | pass | pass | pass | 120.2 (runs 165.4, 120.2) | 4 | 242 non-blank, 219 code (variant 138 / 130 + shared glue 104 / 89) | 215.5 installed, 1.13 MiB bundle (324 kB gzip) | true | KEEP-CURRENT |
| A2-v2-r3f (Drei) | Drei `@react-three/drei@10.7.9` | MIT | pass | pass | pass | pass | n/a (shared with V2) | 4 | 1 line in the shot (`PerspectiveCamera`) | drei + hls.js + three-stdlib + stats-gl + @mediapipe/tasks-vision alone are 111.9 of the 215.5 (none reach the bundle) | true | ADOPT-FOR niche: port SoftShadows + MeshReflectorMaterial, no Drei at runtime |
| A2-v2-r3f (React Postprocessing) | `@react-three/postprocessing@3.1.2` (+ `postprocessing@6.36.7`) | MIT | pass | pass | pass | pass | n/a (shared with V2) | 4 | 7 JSX lines (+2 for the custom-effect wrapper) vs 7 imperative lines | 0.7 (n8ao 0.8 not bundled) | true | REJECT |

Per-variant detail:

| field | A2-v1-vanilla | A2-v2-r3f |
|---|---|---|
| worst_psnr_db (gate mismatches) | null (no mismatch in any pass) | null |
| harness ms/frame median (seek + 2 rAF + PNG), 2 runs back to back | 124.6 / 164.5 | 165.4 / 120.2 |
| in-page cost of `__seek(t)` plus a synchronous 1-pixel readback (90 seeks, random order, GPU included), 2 runs | 11.5 and 11.3 ms median | 11.2 and 11.1 ms median |
| CPU time to submit one seek | 0.6 ms | 0.6 to 0.7 ms (the React commit is invisible) |
| boot to `__ready` (seekcheck `boot_ms`) | 266 to 299 ms | 488 to 653 ms |
| authored code, non-blank lines / code lines | 57 / 53 variant + 104 / 89 shared | 138 / 130 variant + 104 / 89 shared |
| of which the seek adapter | `seek()` 9 lines inside `main.js` | `SeekCanvas.jsx` 43 / 39 lines |
| kit builders (copied, counted separately) | 459 non-blank / 406 code | same files |
| installed `node_modules` | 35.0 MB (three 32.4, postprocessing 2.6) | 215.5 MB |
| determinism stress, 30 sampled frames in 4 orders + 8 cold boots (brief: 12 + 4) | pass (G1-G3) | pass (G1-G3) |
| runtime-needed | 2.21 MB of ES modules served (three.module.js 1.27, postprocessing 0.62, three addons 0.36, app + kit 0.06) | 1.13 MiB single bundle (1,189,343 bytes), 324 kB gzip -9 (tree-shaken: no troika, mediapipe, hls, stats-gl, n8ao; one three, r160) |
| needs_bundler | false: an import map to `./node_modules`, served as static files | true: React 19 ships CJS only (verified below) |
| console warnings or errors in any run | 0 | 0 |
| G4 (`render.mjs`, 60 frames, h264 1080x1920, no console output) | pass | pass (run from the built `dist/`, Vite `base: './'`) |
| quality (1-5) | 4 | 4 (pixel-identical to V1) |

**Quality note (judged from the 100% stills, `evidence/crops/`):** edges are clean with MSAA 4 (lid and box corners, no crawl); the bloom halo is smooth and soft on the black body (body pixels pick up (35,19,6) from the glow, no blockiness); DoF is subtle and clean at the desk edge and the box silhouette (no leaking in this configuration); colour is neutral (desk (214,213,208), wall (222,218,208), band (239,153,64), LEDs (39,192,134)). One point lost for banding: the chain has no dither or grain stage (the kit adds +-1/255 triangular dither and grain), so the vignette and wall gradient show faint rings under a x4 contrast stretch and slightly at 100%, and the frame is single-sample (no 4-subframe supersampling, no 180-degree shutter). pmndrs has `DitheringEffect` and `NoiseEffect`; not used here to keep to the brief's effect list.

**What "needs_bundler" means here (verified):** `react@19.3.0` and `react-dom@19.3.0` are `type: commonjs`, `exports` is `{ "react-server": ..., "default": "./index.js" }`, and `index.js` is `module.exports = require('./cjs/react...')`. There is no ESM entry, so a browser import map cannot load them. `@react-three/fiber` and drei do ship ESM but import about 20 bare packages. A no-bundler R3F page is only possible through a CDN that converts to ESM (jsDelivr `+esm`, esm.sh), which was not tested (see section 8).

## 3. Recommended combination (exact versions)

**Pipeline (vanilla, what to use):**
- `three@0.160.0` (the kit's, from jsDelivr or a local copy) + `postprocessing@6.36.7` (pmndrs, Zlib, peer three >= 0.157 < 0.174) by import map, no bundler.
- Kit builders unmodified. Two shader-chunk patches on one `three` r160: the kit's `patchShadows()` and `patchNeutralToneMapping()` (21 lines, `shared/neutral-patch.js`, needed because pmndrs `ToneMappingMode.NEUTRAL` calls a function three only has from r162; alternatives: AGX, or three >= 0.162 with a retest of the kit's shadow patch).
- Effect order: DepthOfField first, then SelectiveBloom (ADD), custom effects, ToneMapping, Vignette. `composer.render(0)`. MSAA 4, HalfFloat.

**Also installed for V2 only (infrastructure R3F cannot run without, not part of the recommendation):** `react@19.3.0`, `react-dom@19.3.0` (R3F peer range >=19 <19.4), `vite@8.3.1` (rolldown based, built the bundle in 0.25 to 0.95 s on Node 25.9 with no esbuild), `@vitejs/plugin-react@6.1.1`. Transitive of note: `n8ao@2.0.1` (ISC, dependency of `@react-three/postprocessing`; 0.8 MB in node_modules, `dist/N8AO.js` 233 kB, tree-shaken out of the bundle), `maath@0.10.8`, `three-stdlib@2.36.1`, `zustand@5.0.15`.

**postprocessing pin:** `@react-three/postprocessing@3.1.2` peer is `^6.36.0`, so a bare install could take `postprocessing@6.39.5` (needs three >= 0.168). V2 pins it as a direct dependency and adds `"overrides": { "postprocessing": "6.36.7" }`; `npm ls` shows `postprocessing@6.36.7 overridden` and n8ao dedupes onto it and onto three 0.160.0. `@react-three/postprocessing@3.2.0` (2 days old) was not used.

**Versions and ages (cutoff 2026-09-29):** three 0.160.0 (2023-12-22), postprocessing 6.36.7 (2025-02-06), fiber 9.8.1 (2026-09-24), drei 10.7.9 (2026-09-25), @react-three/postprocessing 3.1.2 (2026-09-22), react and react-dom 19.3.0 (2026-09-09), vite 8.3.1 (2026-09-24), @vitejs/plugin-react 6.1.1 (2026-08-28).

**Transitive ages (found late, fixed):** the first full-lockfile check (`npm view <pkg> time` for all 110 packages) found 21 packages younger than 14 days that npm had resolved from open ranges, all in Vite's toolchain plus one bundled helper: `rolldown@1.2.13` and its 16 platform bindings (2026-10-07), `@oxc-project/types@0.153.0`, `postcss@8.5.30` (2026-10-12, one day old), `nanoid@3.3.20`, `source-map-js@1.2.2` (2026-09-30), `@babel/runtime@7.29.10` (2026-10-07, ends up in the bundle). V2 now pins the newest version of the same line older than 14 days through `overrides`: `rolldown 1.2.11` (2026-09-24, which brings `@oxc-project/types 0.151.0`), `postcss 8.5.28`, `nanoid 3.3.19`, `source-map-js 1.2.1`, `@babel/runtime 7.29.7`. The check was re-run after the pins: all 110 packages are older than 14 days (`evidence/transitive-ages.txt`). The gates, G4, perf, parity and stress figures in this file are from the pinned install; the PSNR values V1 vs V2 came out identical to the pre-pin set to the last digit (106.069266, 104.929832, 103.764777, 106.526841 dB), so the toolchain pins changed no pixel. Only the Drei lab (section 7) was run before the pins; it measures Drei helpers, not the toolchain. V1's lockfile (three, postprocessing only) was clean from the start.

**Why not R3F:** gains are JSX readability for the post chain (7 JSX lines vs 7 imperative lines, a wash) and for the camera; the lights are worse (about 19 lines of JSX plus a 16-line helper vs one `makeRig` call, and `Aimed` plus the explicit shadow camera exist only to work around R3F). The costs are in section 2. R3F is worth it only if ANVE ships a React web preview or configurator of the box that should share these scene components; for that niche the V2 files are a working starting point.

## 4. The smallest seek-safe adapters

**R3F (`v2-r3f/app/SeekCanvas.jsx`, the tested file; the boot log and `dumpLights` lines are tooling and can go):**

```jsx
import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { PCFShadowMap } from 'three';
import { installRenderContract } from '../render-contract.js';
import { CONFIG, W, H, FPS, FRAMES } from '../shot-spec.js';

/* the whole time model: ONE external store {t, id}; nothing in the scene reads a clock or a delta */
let cur = { t: 0, id: 0 }; const subs = new Set(), waiters = new Map();
const subscribe = (f) => (subs.add(f), () => subs.delete(f)), get = () => cur;
const requestSeek = (t) => new Promise((res) => { const id = cur.id + 1; waiters.set(id, res); cur = { t, id }; subs.forEach((f) => f()); });

/* the scene calls this once: apply(t) sets imperative bits (kit objects, lookAt); declarative props come from the returned t */
export function useSeekFrame(apply) {
  const s = useSyncExternalStore(subscribe, get), advance = useThree((x) => x.advance);
  useLayoutEffect(() => { apply(s.t); advance(0); waiters.get(s.id)?.(); waiters.delete(s.id); }, [s.t, s.id]);   // advance(0): a constant, so delta is 0 whatever the seek order
  return s.t;
}

/* the scene registers what boot must wait for (R3F builds the EffectComposer over several async React cycles) */
export const pipeline = { composer: null, bloom: null, camera: null, none: false };
const built = () => { const c = pipeline.composer, b = pipeline.bloom; return pipeline.none || !!(c && b && c.passes.length === 2 && c.passes[1].effects.length === 5 && b.selection.size === 1 && b.selection.layer === 10 && (c.passes[0].mainCamera || c.passes[0].camera) === pipeline.camera); };

async function boot(state) {
  try {
    let stable = 0; const t0 = performance.now();
    while (stable < 15) {                                              // built and unchanged for 15 frames
      if (performance.now() - t0 > 20000) throw new Error('the EffectComposer pipeline was not built after 20 s');
      stable = built() && (pipeline.none || state.camera === pipeline.camera) ? stable + 1 : 0; await new Promise((r) => requestAnimationFrame(r));
    }
    installRenderContract({ canvas: state.gl.domElement, fps: FPS, frames: FRAMES, width: W, height: H, name: CONFIG.name, seek: requestSeek });
    await requestSeek(0); window.__ready = true;
  } catch (e) { window.__error = String((e && e.stack) || e); window.__ready = true; console.error(window.__error); }
}

export function SeekCanvas({ children }) {
  return (
    <Canvas style={{ width: W, height: H }} frameloop="never" dpr={1} resize={{ scroll: false, debounce: 0 }} shadows={{ type: PCFShadowMap, autoUpdate: false }}
      gl={{ preserveDrawingBuffer: true, antialias: false, alpha: false, powerPreference: 'high-performance' }} onCreated={boot}>
      {children}
    </Canvas>
  );
}
```

How the scene uses it (`Shot.jsx`): `const t = useSeekFrame((t) => { applyBand(set, t); cam.current.lookAt(...cameraAt(t).target); gl.shadowMap.needsUpdate = true; });` then `<PerspectiveCamera makeDefault position={cameraAt(t).position} .../>`. Why it works: `__seek(t)` changes the store, React renders the scene's props from t, R3F's reconciler applies them in the commit, then the layout effect runs the imperative part and `advance(0)` (a synchronous render of that exact state), then resolves the promise. No timer, no polling after boot, no clock.

**Vanilla (`v1-vanilla/main.js`):**

```js
function seek(t) {
  const c = cameraAt(t);
  camera.position.set(...c.position); camera.lookAt(...c.target); camera.fov = c.fov; camera.updateProjectionMatrix();
  applyBand(set, t);
  renderer.shadowMap.needsUpdate = true;
  composer.render(0);          // an explicit deltaTime: composer.render() with no argument reads a wall-clock Timer
}
installRenderContract({ canvas: renderer.domElement, fps: FPS, frames: FRAMES, width: W, height: H, name: C.name, seek });
seek(0); window.__ready = true;
```

## 5. Non-determinism register (every item the brief named, plus what turned up)

| item | what happens | M or S | mitigation used |
|---|---|---|---|
| frameloop and `advance` | `frameloop="never"` draws only on `advance()`. `advance(ts)` sets `delta = ts - clock.elapsedTime` and passes it to every `useFrame` and to `composer.render(delta)`. `advance(t)` therefore makes delta equal to t minus the previous seek (order dependent). `advance()` with no argument is also 0 in 'never' (clock stopped), but implicit | S | `advance(0)` |
| useFrame delta consumers | pmndrs 6.36.7 classes that read `deltaTime`: `EffectPass` (the built-in `time` uniform, `material.time += deltaTime * timeScale`, so any effect whose GLSL reads `time`), `GlitchEffect`, `OutlineEffect` (pulse), adaptive `ToneMappingEffect` (`AdaptiveLuminancePass`), and R3F `<Autofocus>` (`easing.damp3(..., delta)`). None are in this chain. `ToneMapping adaptive` would never adapt at delta 0 | S (grep) | not used |
| clock-driven Drei helpers | Float, Sparkles, MeshWobbleMaterial and MeshTransmissionMaterial read `state.clock.elapsedTime`; with `advance(0)` they stay frozen at t = 0 | S + M | see Drei table |
| `Math.random` at mount | Float (`offset = Math.random() * 10000`), Sparkles (sizes and positions), AccumulativeShadows/RandomizedLight: a fresh page differs from a warm page | M (lab: Float G3 fails at 17.9 dB, Sparkles G3 at 36.6 dB, AccumulativeShadows G1, G2 and G3 at 40.1 dB) | do not use |
| async EffectComposer build | `onCreated` fires with no composer (tick 0: composer null); by tick 1 passes = 2, effects = 5, selection = 1 (`window.__boot` in the dist). Order: passive effect creates the composer, `setState`, children mount, a layout effect reads the children, `setNodesVersion`, a rebuild layout effect calls `addPass`. A seek before that draws without the effects | M + S | structural gate then 15 stable frames |
| camera swap | `<PerspectiveCamera makeDefault>` replaces R3F's default camera in a layout effect; `EffectComposer` lists `camera` in its creation effect deps, so the composer is destroyed and rebuilt | S | same gate (RenderPass camera must equal the current camera) |
| SelectiveBloom | selection and selection layer are set in passive effects; the `selection` array is an effect dependency (clear then set on every new identity); `lights` is required or it logs `SelectiveBloom requires lights to work.` (the harness counts warnings) | S | `useMemo`'d array, `lights={sel}` |
| ResizeObserver sizing | `Canvas` uses `react-use-measure`: nothing is drawn until a non-zero rect is measured. In 9.8.1 `configure()` is also async (a `ready` promise) | S | explicit px container, `resize={{ scroll: false, debounce: 0 }}`, ready gate |
| dpr | default `[1, 2]` = clamp(devicePixelRatio): a DSF 2 browser renders 2160x3840 and every pixel metric changes | S | `dpr={1}` |
| EffectComposer auto-size | the composer reads `gl.getSize()` every frame and calls `setSize` when it changes: deterministic for a fixed container, fragile if the size changes | S | fixed size |
| Suspense and async loads | `<Canvas>` wraps children in `<Suspense fallback={<Block/>}>`; `useLoader`, `useGLTF`, `useTexture`, `Environment files|preset`, `Text` (`suspend` + troika worker) suspend. `Environment preset` fetches from `raw.githack.com` (third-party network) | S | none used; `__ready` would have to wait |
| Environment (Lightformer children) | `frames = 1` default renders the cube once | M (lab `env`: G1-G3 pass) | OK |
| ContactShadows | `frames = Infinity` default re-renders per `advance`, a pure function of the scene | M (lab `contact`, `contact1`: pass) | OK |
| `composer.render()` without an argument | pmndrs reads a wall-clock `Timer` (`performance.now`) | S | `render(0)` in both |
| autoUpdate shadows | with `shadowMap.autoUpdate = false` every seek must set `needsUpdate = true` | S | done in both |

## 6. Gotchas (things that cost time, in the order they bit)

1. **ToneMappingMode.NEUTRAL fails to link on three 0.160.0 (M).** pmndrs compiles `toneMapping(texel)` to `NeutralToneMapping(texel)`; three has that function from r162. The whole EffectPass program is invalid (console: `useProgram: program not valid`) and the frame is blank paper colour. pmndrs' peer range (>= 0.157) does not warn. Fix: the 21-line chunk patch, AGX (three r159+), or three >= 0.162.
2. **DepthOfField before bloom erases the bloom (M).** `DepthOfFieldEffect` rebuilds the colour from its own bokeh buffers of the composer input where the circle of confusion is above 0, so anything added earlier in the same EffectPass vanishes there. `EffectPass` also sorts effects by attribute bits (stable, so JSX order holds for equal attributes). Bisected with `off=` overrides: bloom invisible with order [bloom, dof], present with [dof, bloom]. The R3F docs' own order is DepthOfField first.
3. **SelectiveBloom with threshold 0 and smoothing 0 works** (checked: `bs=0.1` and MSAA off made no difference; the mask buffer held the band at (1.20, 0.32, 0.04)). The depth-equality mask is fine with MSAA 4.
4. **Wrapper defaults differ from vanilla (S, then M for the effect on pixels).** `<SelectiveBloom>` hard-codes `BlendFunction.ADD` (vanilla SCREEN); `<DepthOfField>` sets `maskFunction = MULTIPLY_RGB_SET_ALPHA` ("restores DOF 6.21.3 behavior, everything since then lets shapes leak through the blur", its comment); `<EffectComposer>` defaults `multisampling = 8` and forces `gl.toneMapping = NoToneMapping`; `shadows` as a boolean gives `PCFSoftShadowMap`, not the kit's `PCFShadowMap` plus patched chunk (use `shadows={{ type: PCFShadowMap, autoUpdate: false }}`). For the same pixels, V1 sets ADD and SET_ALPHA explicitly. This is the main reason a "same settings" R3F scene can silently differ from a vanilla one.
5. **JSX lights (M).** `light.target` must be a scene object (a bare target keeps an identity matrixWorld, so the light aims at the origin): the `Aimed` helper. Pierced `shadow-camera-*` props do not call `updateProjectionMatrix`, so the key light's ortho shadow camera is declared as `<orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.5, 60]} />`; the parity dump confirms the projection equals the kit's. Spot shadow camera near/far work because three re-derives fov on first update.
6. **`h` is taken by the harness (M).** seekcheck always passes `h=1920`; my first lab run read `?h=` and every helper silently mounted nothing, so all nine runs passed (a blank scene passes G1-G3). The param was renamed `helper`. Lesson: check the still, never trust a pass.
7. **Harness ms/frame is dominated by the PNG screenshot and by other lanes' GPU jobs** (V1 124.6 then 164.5 ms, V2 165.4 then 120.2 ms in back-to-back pairs; an earlier pre-pin V2 run hit 258.8 ms while other lanes were rendering). The in-page seek-plus-readback figure (11.1 to 11.5 ms for both, stable across runs) is the honest per-frame cost; `gl.finish()` does not block on this ANGLE Metal path (0.3 ms), a 1-pixel `readPixels` does.
8. **No dithering (M).** Faint rings in the vignette/wall gradient (see quality note).
9. **Install weight (M).** `stats-gl` (a Drei dependency) installs its own `three@0.170.0` (not bundled); `maath` pulls `@types/three@0.186.0` which pulls `@dimforge/rapier3d-compat` (7.3 MB, types only chain); `hls.js` 31.7 MB, `three-stdlib` 28.9 MB, `@mediapipe/tasks-vision` 19.5 MB. All tree-shaken out (`drei` is `sideEffects: false`), so the shipped bundle is small; the install is not.
10. **Drei `PerspectiveCamera` (S)** allocates a 256x256 FBO per mount via `useFBO` even when unused, and calls `updateProjectionMatrix` on every render.

## 7. Drei review

Method: the source of `@react-three/drei@10.7.9` (`core/*.js`, `web/*.js`, `materials/*.js`) was grepped for `Math.random`, clock, `delta`, `frames`, `useLoader`, `suspend`, `fetch`; then the helpers that matter were run through the lab (`v2-r3f/app/lab.jsx`, built separately to `dist-lab/`, one helper per page inside the same seek adapter, seekcheck 60 frames, 6 samples, 3 cold boots). Lab results are in `evidence/lab/summary.md`; the stills (`evidence/lab/sheet-lab.jpg`, `sheet-lab2.jpg`) were checked so that no pass is a blank scene.

| Drei helper | vanilla three/addons equivalent, or what the kit already does | determinism risk | measured (lab) | verdict |
|---|---|---|---|---|
| ContactShadows | `webgl_shadow_contact` example technique (depth camera + `HorizontalBlurShader`/`VerticalBlurShader` from `three/addons/shaders`); kit: `makeBlobShadow`, the desk `under` shadow and real PCF key shadows | `frames = Infinity` re-renders every `advance` (a pure function of the scene); no random, no clock | G1-G3 pass, also with `frames={1}` | ALREADY-HAVE |
| AccumulativeShadows / RandomizedLight | three `ProgressiveLightMap` (`three/addons/misc/ProgressiveLightMap.js`); kit: 4-subframe jittered soft key (`JIT`) | `Math.random` and `randFloatSpread` for light positions, `frames = 40` temporal accumulation = history | G1, G2, G3 all fail (40.1 dB repeat) | SKIP |
| Environment | `RGBELoader`/`EXRLoader` + `PMREMGenerator`, `RoomEnvironment` (`three/addons/environments`); kit: `makeStudioEnv` (analytic studio sphere baked to cube + PMREM) | children (Lightformers): `frames = 1` renders once, deterministic. `files`/`preset`: async via Suspense, `preset` fetches `raw.githack.com` | `frames={1}` with two Lightformers: G1-G3 pass; `files`/`preset` not tested (network, no asset) | ALREADY-HAVE |
| Lightformer | a `Mesh(PlaneGeometry, MeshBasicMaterial)` inside an env scene rendered by a `CubeCamera`; the kit's env shader already has key and back banks | none (no hooks) | used in the Environment case | ALREADY-HAVE |
| Stage | none needed; it is Environment + shadows + lights with presets; kit has `makeRig` | inherits Environment preset (network) and shadow helpers | not run | SKIP |
| MeshTransmissionMaterial | three core `MeshPhysicalMaterial.transmission` + `thickness` (renders its own transmission pass) | `time` from `clock.elapsedTime`, `seed`, extra `useFBO` renders per frame | G1, G2 pass; **G3 fails at 98.7 dB** (noise only, but not bit-identical) | SKIP (use core transmission for a frosted band) |
| MeshReflectorMaterial | `three/addons/objects/Reflector.js` (no roughness blur); kit: none for planar reflections (chrome blob uses cube cameras) | renders the mirrored scene to an FBO per `advance`, blur is a fixed `BlurPass`; no random, no clock | G1-G3 pass; floor visibly mirrored in the still | **USE** (port: `materials/MeshReflectorMaterial.js` is React-free; the 180-line component is only the FBO driver) for a glossy desk |
| Text | `troika-three-text` directly (vanilla package); kit: canvas text (`canvasTex`, `kit/type.js`) | `suspend` on font preload, troika typesets in a worker and the text appears after `sync()` | not run | SKIP (kit canvas text is deterministic; if SDF text is wanted, `await text.sync()` before ready) |
| Text3D | `FontLoader` + `TextGeometry` (`three/addons/geometries`), `scripts/ttf2typeface.py` in the spec-to-loop skill | none (geometry built once from a JSON font) | not run | ALREADY-HAVE |
| RoundedBox | `RoundedBoxGeometry` (`three/addons/geometries/RoundedBoxGeometry.js`), which the kit already uses for the desk, box body, base and lid | none | n/a | ALREADY-HAVE |
| Float | kit: closed-form motion (`springU`, `E.*` in `kit/util.js`) | `offset = Math.random() * 10000` per mount, `clock.elapsedTime` | **G3 fails (17.9 dB)** | SKIP |
| CameraControls / PerspectiveCamera | `camera-controls` (vanilla lib), plain `PerspectiveCamera`; kit: `cameraAt(t)` | CameraControls integrates `delta` (history); PerspectiveCamera is fine but allocates an FBO | PerspectiveCamera used in V2: pass | CameraControls SKIP; PerspectiveCamera ALREADY-HAVE (R3F convenience only) |
| Html | the kit's `drawType` canvas typography, or HyperFrames DOM for text | DOM layer projected per frame, fonts and layout timing; `render.mjs` reads the GL canvas only, so it would be missing from `captureFrame` | not run | SKIP |
| useGLTF / useTexture | `GLTFLoader` + `DRACOLoader`, `TextureLoader`; kit: `canvasTex` | async via Suspense; `useGLTF` pulls the Draco decoder from `gstatic.com` unless `setDecoderPath` is local | not run | ALREADY-HAVE (if used in R3F: preload, local decoder, wait before ready) |
| Bounds / Center | `Box3.getCenter`, `Box3.getSize`, distance = size / (2 tan(fov/2)): 6 lines | Bounds animates with `delta` (history); Center is pure | not run | ALREADY-HAVE |
| SoftShadows | the kit's own `patchShadows()` is the same idea (a `ShaderChunk.shadowmap_pars_fragment` patch, 32-tap Vogel PCF); Drei's adds PCSS (contact-hardening penumbra from a blocker search) | none: a hash of shadow uv, no clock, no random | G1-G3 pass on r160; the shadow edge is visibly softer in the still | **USE** (port: it is a chunk patch plus a material `needsUpdate` pass; replaces or sits beside `patchShadows`; retest the 4096 key map and the jittered key) |
| BakeShadows | kit: `shadowMap.autoUpdate = false` + `needsUpdate = true` per sample | none | n/a | ALREADY-HAVE |
| Sparkles | no particle system in the kit (`mulberry32` in `kit/util.js` for a seeded one); `maath/random` seeded generators | `Math.random` for sizes, `randFloatSpread` for positions, `time = clock.elapsedTime` | **G3 fails (36.6 dB)** | SKIP (a seeded fork is ~40 lines in vanilla) |
| Trail | a path trail as a function of t: sample the path at t - i*dt, draw with `meshline` | keeps a ring buffer of previous world positions: history by construction | not run (cannot pass by design) | SKIP |
| MeshWobbleMaterial | `onBeforeCompile` sine displacement, trivial | `time` accumulates `delta * speed` | G1-G3 pass but frozen at `advance(0)` | SKIP |

**Which Drei pieces work without React (usable in the kit directly):**
- `three-stdlib` is Drei's vanilla addon library; everything the kit needs is already in `three/addons` for r160, so nothing to take.
- `@react-three/drei/materials/*.js` are React-free classes (checked by grep, no `react` or `@react-three/fiber` import): `MeshReflectorMaterial` (256 lines), `MeshRefractionMaterial`, `BlurPass`, `ConvolutionMaterial`, `DiscardMaterial`, `SpotLightMaterial`. `WireframeMaterial` imports React. The package has no `exports` map, so a deep import works, but the right move is to copy the file into the kit (MIT). The Drei component `core/MeshReflectorMaterial.js` is the React driver that creates the reflection FBO each frame (`useFrame`); the port has to replace that driver with a call from the kit's per-seek update.
- Algorithms that live inside a React component but are plain three code: `SoftShadows` (chunk patch), `ContactShadows`, `Center`/`Bounds`, `BakeShadows`, `Lightformer`, `Environment` (CubeCamera into PMREM).
- Plain three libraries Drei depends on: `troika-three-text`, `camera-controls`, `meshline`, `three-mesh-bvh`, `maath` (math, easing, seeded random), `postprocessing` and `n8ao` (an SSAO pass that also works with the pmndrs `EffectComposer` without React; its dist uses `performance.now` x4 and a `frame++` counter, so its noise is history-dependent unless reset per seek).
- Needs React: `Html`, `useGLTF`/`useTexture` (Suspense), `Float`, `Sparkles`, `Trail`, `Bounds`, `CameraControls` wrappers, `PerspectiveCamera` (`makeDefault`), `Environment`/`Stage` components.

## 8. What could not be tested, and why

- **No-bundler R3F page.** It needs ESM builds of `react`, `react-dom` and a dozen small packages; React 19 has none. A CDN `+esm` conversion (jsDelivr/esm.sh) is not an allowed download in the brief (rule 4: npm packages for the given repos and jsDelivr copies of those same packages; react is not in the list). Not tested.
- **`<Environment files>` and `<Environment preset>`.** `preset` downloads from `raw.githack.com` (third party) and no HDR test asset was supplied. Only the Lightformer-children path was measured.
- **Clock-driven helpers under `advance(t)`.** The adapter always uses `advance(0)`, so Float, Sparkles, MeshWobbleMaterial and MeshTransmissionMaterial were measured with a frozen clock. Their behaviour under `advance(t)` is from reading the source.
- **three >= 0.162 with native NEUTRAL.** Not tried: the kit is pinned to r160 and its shadow patch matches r160's chunk text.
- **Other effects.** `Autofocus`, `N8AO`, `Outline`, `TiltShift`, SMAA/FXAA and adaptive tone mapping were not run; their history dependence is from source (`deltaTime`, `performance.now`).
- **The kit's own post chain** (4-subframe supersampling, 180-degree shutter, grain, knee). Neither variant has subframes, so the stills are single-sample plus MSAA 4. Comparing them with the kit chain is the maintainers's post-chain bake-off; this lane only shows both variants are equal.
- **Other browsers, other GPUs, and HyperFrames' own three adapter** (`hf-seek`): Chrome headless on ANGLE Metal / Apple M3 Pro only; the WebGL path was tested through `render.mjs`, not HyperFrames.

## 9. Not run (outside the test rules)
1. A CDN ESM conversion of `react@19.3.0` / `react-dom@19.3.0` (jsDelivr `+esm` or esm.sh) if the maintainers wants the no-bundler R3F question settled by test.
2. A local HDR file (or leave for the maintainers) and permission to hit `raw.githack.com` Drei presets, to measure `<Environment files|preset>` and Suspense timing.
3. Decision, not approval: whether to raise the kit's three from 0.160.0 to >= 0.162 (native NEUTRAL tone map). Not needed while the 21-line patch exists.

## 10. Evidence index and commands

Folder: `lab/a-3d/react/`.

- Pages: `v1-vanilla/index.html` + `main.js` (no build); `v2-r3f/dist/index.html` (built by `cd v2-r3f && npx vite build`, Node 25.9). Shared files (identical, sha256 in `shared.sha256`, synced by `sync-shared.sh`): `shot-spec.js`, `ctx.js`, `build-set.js`, `wb-effect.js`, `neutral-patch.js` (+ `debug-dump.js`, tooling).
- Gate runs: `run-final.sh` (V1 then V2, twice) wrote `evidence/A2-v1-vanilla/run{1,2}/` and `evidence/A2-v2-r3f/run{1,2}/` (stills 0, 40, 80, 119 at 100% + `report.json`). The command was exactly: `python3 .../gpu-run.py -- node .../skills/motion-stack/scripts/seekcheck.mjs <page.html> --root <dir> --w 1080 --h 1920 --fps 30 --frames 120 --samples 12 --cold 4 --stills 0,40,80,119 --label <variant>`.
- G4: `run-g4.sh` -> `evidence/g4/` (`A2-v1-vanilla.mp4`, `A2-v2-r3f.mp4`, PNG stills, decoded mp4 frames `*-mp4-frame30.png`). Command: `render.mjs <page.html> <out.mp4> 2 30 --query "w=1080&h=1920&frames=120"`.
- Parity: `compare-stills.sh` -> `evidence/diff/`; `evidence/lights-parity.txt` (+ `lights-v1.txt`, `lights-v2.txt`); `evidence/contact-sheet.jpg`.
- Quality crops: `make-crops.sh` -> `evidence/crops/` (band + halo, lid edge, desk edge, wall x4 contrast) and `sheet-crops.jpg`.
- Drei lab: `run-lab.sh`, `run-lab-one.sh` -> `evidence/lab/<helper>/report.json`, `summary.md`, `sheet-lab.jpg`, `sheet-lab2.jpg`.
- Sizes and counts: `loc.py` -> `evidence/loc.json`; `evidence/transitive-ages.txt`; in-page seek cost: `scratch/perf-seek.sh` -> `evidence/perf-seek.txt`.
- Determinism stress (30 sampled frames in 4 orders + 8 cold boots, vs the brief's 12 + 4): the last step of `final-lean.sh` -> `evidence/stress/<variant>/report.json`.
- The final (pinned install) verification is `final-lean.sh` (gates x2, G4, perf, lights parity, all inside one `gpu-run.py`); the earlier per-step scripts `run-final.sh` and `run-g4.sh` produced the pre-pin set in `evidence/prepin/`. `make-results-json.py` writes `results-A2.json` from the reports, so the JSON numbers are read from files, not typed.
- `evidence/prepin/`: the first complete evidence set (before the toolchain pins): gate runs of both variants, G4 outputs, the interrupted perf attempt. Final G4 decoded frames are bit-identical to these (PSNR infinite), and the V1-vs-V2 PSNRs are identical to the last digit.
- `scratch/` holds the debugging artefacts (bloom bisect crops in `scratch/tune/`, `evalpage.mjs`, probes, `final-lean.log` = the full log of the final verification). Not part of either variant.

