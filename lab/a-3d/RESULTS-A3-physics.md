# A3 physics: Rapier baked or live? (lane A, 13 Oct 2026)

All paths are under `lab/a-3d/physics/`. Machine: M3 Pro, Chrome 154 headless (ANGLE Metal), Node 25.9 for tools. Scene: 24 paper cards (0.46 x 0.008 x 0.30) fall and settle on the desk, the product box drops in at t = 2.0 s and bounces (restitution 0.2); 4 s, 30 fps, physics step 1/60, seed 20261013 (kit mulberry32). One spec, `scene-spec.json`, read by both P1 and P2.

## Answer

- **Yes, add Rapier to the kit, as a build-time baker and not as a runtime engine.** `bake.mjs` (143 lines) writes a 387 KB table (97 KB gzipped) in about 0.13 s warm; `table-player.js` (63 lines, no dependencies) plays it as a pure function of t; the timeline adapter is about 12 lines. The page ships no WASM, no engine and no bundler.
- **It passes every gate on the real kit page.** G1, G2, G3 are bit-exact (no mismatching pixel in 12 sample frames x 4 passes: forward, repeat, reverse, shuffled, plus 4 cold pages), G4 (render.mjs) is clean, and the production path (4 or 8 jittered subframes per frame) hashes identically in forward, repeat, reverse, shuffled and cold-page order.
- **Live R3F + Rapier does not.** Naive `__seek`: G1 pass, **G2 fail (13.6 dB)**, G3 pass by accident. A seekable variant exists (P2b: remount + replay, bit-identical, 116-121 ms per cold seek) but it duplicates the table at 114 MB of node_modules and 3.3 MB of JS.
- **The engine version matters more than the wrapper.** `@react-three/rapier@2.2.0` pins rapier3d-compat 0.19.2 and forces two tolerances: the same spec gives a box that topples (57.8 deg, never settles) instead of landing flat (0.8 deg). A baked table is an asset you approve once; a live scene silently changes with the dependency.
- **Before it lands in a kit:** where `physics/` lives, the dev dependency, three small kit changes (see "Not run (outside the test rules)").

## Variants

| variant | what | G1 / G2 / G3 / G4 | worst PSNR | ms/frame | quality | verdict |
|---|---|---|---|---|---|---|
| **A3-P1-bake** | `@dimforge/rapier3d-compat@0.21.0` (Apache-2.0) baked in Node, played on the real kit page (`kit-p1/`, `?tl=drop&aspect=tall&norun=1`) | pass / pass / pass / pass | no mismatch at all | 501 (seekcheck, better of 2; run 2 = 972 with other lanes on the GPU); production render 407 | 4 | ADOPT-FOR multi-body physical motion, baked at build time |
| A3-P2 | `@react-three/rapier@2.2.0` + fiber 9.8.1 + react 19.3.0 + three 0.160.0, live, naive `__seek` (timeStep 1/360, P1-matched) | pass / **fail** / pass / not run | 13.6 dB | 79.5 | 2 | REJECT |
| A3-P2-default60 | same, `<Physics timeStep={1/60}>` ("as people normally use it") | pass / fail / pass / not run | 13.9 dB | 84.3 | 1 | REJECT |
| A3-P2b-seekable | P2 + `<Physics paused>` + manual stepping + remount-and-replay on rewind (V2) | pass / pass / pass / not run | no mismatch | 83.6 | 3 | REJECT for the render path (ADOPT-FOR only an interactive R3F page that must also be scrubbed; none today) |

ms/frame is seek + 2 rAF + PNG screenshot. P1 is the full kit post chain (shadows, 6-level bloom, DOF, 1080 x 1920); P2 is a bare R3F scene, so the two columns are not comparable. G4 was not run for P2/P2b (not the winner). The machine-readable rows are in `results-A3.json` (built by `tools/make-results.py` from the harness reports).

Quality notes (100% stills): P1 cards tumble with motion blur, flop, slide and settle by 1.83 s; the box enters from above the frame, lands at 2.98 s at 9.5 u/s, rebounds 0.059 u and rests on the pile (base y 0.016, tilt 0.8 deg) with cards visible under and around it and no visible crush-through. Not a 5: rigid slabs have no paper flutter, one card balances on its edge for about 0.4 s, the bounce is subtle (about 20 px), cards are already mid-air on frame 0. P2/P2b show the same fall and settle, then the box lands on an edge and topples (57.8 deg, still moving at 4 s); P2-default60 crumples the cards into the desk and throws the box off the desk.

## Recommended combination (exact versions)

- **Build time only:** `@dimforge/rapier3d-compat@0.21.0` (Apache-2.0), `npm i --save-exact`, run under Node 25 (the table is byte-identical on Node 21.7.3, 22.22.2, 22.23.2, 25.9.0). Files to add to the kit: `bake.mjs`, `analyze.mjs`, `table-player.js`.
- **Ships to the page:** the table JSON (387 KB, 97 KB gzipped for 25 bodies x 4 s at 60 Hz, about 16 KB per body-second) and `table-player.js` (4.7 KB). three stays 0.160.0 from jsDelivr, nothing else changes.

| cost | measured |
|---|---|
| bake time | 0.13 s warm in-process (1440 engine steps: 6 substeps x 240); 0.14 s warm / 0.21-0.23 s cold page in Chrome (WASM init 16-20 ms); 0.9-1.7 s for the whole CLI call from a cold process on a loaded machine |
| table | 386,822 bytes, gzip-9 96,573; 25 bodies, 241 rows, 68 contact events |
| dependency | 15 MB node_modules, a 3.1 MB wasm inlined in a 4.3 MB module; build-time only, 0 bytes in the page |
| licence | Rapier Apache-2.0 (patent grant, keep LICENSE/NOTICE if the engine itself is ever redistributed); three MIT; we redistribute only data the engine computed |
| runtime | 14.4 M poses/s, 1.7 us for one 25-body `apply`; render 0.41 s/frame (120 frames in 48.9 s) against the kit README's 0.37 s/frame |
| authoring | chaotic: any parameter change reshuffles the pile, so bake, run `analyze.mjs`, look at stills, commit the table like an asset (2-5 bakes per scene expected) |

What a baked table gives that springs cannot: real multi-body collisions, stacking, friction slides and tumbling, and exact contact times with impact speeds. `cues-from-table.mjs` turns the 68 recorded events into 37 kit sound cues (36 card landings with gains from impact speed, the box thud at frame 90): `evidence/p1-sound-cues.json`.

## The adapter (exact code, run as `kit-p1/timelines/drop-min.js`)

```js
import { createTablePlayer } from './table-player.js';                              // the 63-line player, copied next to the table
import { springKick } from '../kit/util.js';
const TABLE = await (await fetch(new URL('./drop.table.json', import.meta.url))).json();   // top-level await: set-FT.html awaits the import, so onBuild stays synchronous
const P = createTablePlayer(TABLE);

export default {
  id: 'drop-min', seconds: 4, layout: { span: [-2.4, 2.4] },
  camera: [{ t: 0, shot: 'wide', fov: 18, elev: 28, az: -10, dist: 17.5, target: [0, 1.2, 0], screen: [540, 1010], dofK: 20 }],   // the tall framing used here; set-FT.html's own camera keys
  box: { moves: [{ do: 'absent', t: -1 }] },                                         // the kit's own box path stays out of the way
  dip: (t) => -0.02 * springKick(t - P.firstContact('box'), 0.35, 2.2),              // optional: the desk bobs when the box lands
  fast: (n) => P.motion(n / 30) > 1.2,                                               // optional: 8 subframes while anything moves fast
  onBuild({ ctx, st, THREE, FTP }) {
    st.bodies = TABLE.meta.bodies.slice(0, -1).map((b) => ctx.add(st.desk.deskG, new THREE.Mesh(new THREE.BoxGeometry(...b.size), FTP.paperM('#fbfaf7')), { cast: true, recv: true }));
    st.bodies.push(st.box.group);                                                    // body i drives object i; the last body is the kit's real box (table origin = base centre = kit mesh pivot)
  },
  onUpdate(t, n, { st }) { P.apply(t, st.bodies); },                                 // runs after the kit's own box pose in update(), so it overrides it
};
```

`kit-p1/timelines/drop.js` is the full version (textured cards with ANVE accent bands, band and LEDs lit 0.1 s after the landing, the contact-shadow blob following the physics box). `table-player.js` API: `poseAt(t, i, out)`, `aliveAt(t, i)`, `apply(t, objects)`, `motion(t)`, `firstContact(id)`, `events`; positions lerp, quaternions slerp (shortest arc), t clamped to the table.

## Build step for a spot

```bash
# once per spot and whenever its physics changes; the table is committed like any other asset
cd (a private studio kit, not included)
node <kit>/physics/bake.mjs    --spec physics/scene.json --out stage/timelines/<id>.table.json    # prints sha256, bytes, gzip, ms
node <kit>/physics/analyze.mjs --spec physics/scene.json --table stage/timelines/<id>.table.json  # penetration, settle, bounce, jitter: read it, then look at stills
cp <kit>/physics/table-player.js stage/timelines/                                                # or symlink, like kit/ and ft/
```

`bake.mjs` is now generic: `scene.json` lists `statics` and `bodies` (cuboid, ball, capsule, cylinder; per-body density, friction, restitution and combine rule, damping, gravityScale, born step, events flag, collider offset). It still accepts the first A3 schema (desk + cards + box) and produces the same bytes (checked). Tested on a second scene with balls, a capsule, a ramp and a late-born crate (`examples/generic-scene.json`). `analyze.mjs` and `variants.mjs` are written for the cards-and-box scene only (QA tooling, not general). `gen-spec.mjs` shows how a spot can generate its spec from the kit's seeded PRNG.

## What makes the bake trustworthy (P1 numbers)

Timeline from `analysis-final.json`: cards settled (all under 0.05 u/s and 0.3 rad/s) at 1.83 s, last card touches the desk at 1.72 s; box first contact 2.983 s at 9.5 u/s; rebound apex 0.059 above rest; box settled 3.417 s; rest base y 0.016 (it rests on two card layers), tilt 0.775 deg; no card leaves the desk. Penetration is measured on the visual cards by my own OBB separating-axis test, independent of Rapier: card-card max 0.0088 (5 steps over the 0.008 thickness), card corner below the desk max 0.0074, box-card max 0.0087 (one card, one 1/60 step), 0.0046 at rest. Jitter (max second difference of position, last 0.5 s): cards 1.6e-4, box 5.3e-5 units, below the 5e-4 that would show as 0.2 px.

**Determinism.** One sha256, `3a78401346970dad...`, from 8 CLI bakes in separate processes on 4 Node versions, 3 bakes in Chrome 154 (WASM in V8), and the committed table (`evidence/p1-determinism.json`, `evidence/bake-browser.json`; the browser JSON is byte-identical, `cmp` clean). The sub-worker's independent 0.21.0 re-bake through its own wrapper also matched byte for byte.

**Thin cards: what actually prevents tunnelling.** A flat card dropped on a flat card at 3, 8 and 16 u/s does not tunnel at 1/60, with or without CCD (`ccd-test.mjs`, `evidence/p1-ccd-test.txt`). What breaks is the box landing at 9.5 u/s on a 0.008-thick layer. All rows below are the final scene; depth and "below desk" in scene units (card thickness 0.008), measured on the visual cards.

| bake setting | card-card max (steps > 0.008) | card corner below desk | box-card max | box rest y | settle cards / box (s) | jitter cards / box |
|---|---|---|---|---|---|---|
| naive: one 1/60 step, density 4 / 0.7 (mass ratio 230:1) | 0.0766 (77) | -0.130 | 0.108 | 0.0015: box sinks through the pile | 1.80 / 3.67 | 2.6e-3 / 1.9e-3 |
| naive + CCD on cards and box | identical to the digit (CCD is a no-op here) | | | | | |
| naive + soft CCD 0.2 on the box | 0.0233 (52) | -0.081 | 0.042 | 0.0009 | 1.80 / 3.62 | 6.1e-3 / 3.6e-3 |
| naive + 3x thicker collider | 0.0451 (12) | -0.117 | 0.079 | 0.0456: box floats 4.6 cm above the desk | 1.98 / 3.93 | 5.8e-3 / 3.3e-3 |
| naive + 12 solver iterations | 0.0401 (51) | -0.126 | 0.037 | 0.0008 | 1.83 / 3.62 | 5.3e-3 / 4.0e-3 |
| naive + lengthUnit 0.1 | 0.0486 (72) | -0.137 | 0.031 | 0.0015 | 1.82 / 3.72 | 6.2e-3 / 2.2e-3 |
| mass ratio fixed (30 / 0.35), still 1/60 | 0.0297 (32) | -0.110 | 0.035 | 0.0165 | 1.78 / 3.58 | 3.7e-3 / 2.1e-3 |
| 2 substeps | 0.0172 (16) | -0.036 | 0.023 | box toppled off the desk | 1.93 / never | 4.2e-3 / 3.2e-3 |
| 4 substeps | 0.0112 (6) | -0.031 | 0.014 | 0.0188 | 1.83 / never | 5.9e-3 / 8.8e-3 |
| **shipped: 6 substeps (1/360), mass 30 / 0.35** | **0.0088 (5)** | **-0.0074** | **0.0087** | **0.016** | **1.83 / 3.42** | **1.6e-4 / 5.3e-5** |
| 6 substeps + CCD flags | identical to the shipped row | | | | | |
| 8 substeps | 0.0158 (14) | -0.015 | 0.0055 | 0.0154 | 1.97 / 3.35 | 2e-5 / 1e-5 |
| 6 substeps + 8 solver iterations | 0.0108 (10) | -0.019 | 0.0074 | 0.017 | 1.97 / 3.78 | 7.9e-3 / 4.0e-3 |
| 6 substeps + 3x thicker collider | 0 (0) | -0.0074 | 0.0034 | 0.0753: box floats 7.5 cm up, tilt 2.5 deg | 1.87 / 3.53 | 1.1e-3 / 9.6e-4 |

Reading it: substeps are the lever (6 to 8 times finer than the 1/60 sampling), plus a mild box-to-card mass ratio. CCD flags, soft CCD, more iterations and `lengthUnit` do not fix the box impact; a thicker collider hides the interpenetration by lifting the box visibly off the desk. Results are not monotonic in the settings (2 substeps toppled the box off the desk, 4 substeps jitters, 8 substeps settles later), so treat a bake as a take to review, not a parameter to dial. Why CCD does nothing was not isolated: for the box a plausible reason is that Rapier switches CCD on only when a body's per-step motion exceeds its own thickness (the box is 1.0 thick), but that would not explain the thin, fast cards, so treat it as unexplained. Baking makes the substeps cheap: they cost 0.13 s once, while a live scene would pay 12 engine steps per output frame forever.

## P2 and P2b: what diverges and what it would take

Measured by the sub-worker (`p2-r3f-rapier/`, evidence in `evidence/p2*/`, numbers in `p2-r3f-rapier/p2-summary.json`). I re-read the harness reports and the stills, and re-ran both pages through seekcheck myself: naive P2 again gives G1 pass, G2 fail at exactly 13.612628 dB, G3 pass (`evidence/p2-verify/`), P2b again passes all three (`evidence/p2b-sheet/`). The step-count, snapshot and version diagnostics below are the sub-worker's measurements, not re-run by me.

- **Naive P2 cannot rewind.** After the forward pass the world sits at engine step 1439; every earlier `__seek(t)` redraws the final state (position error up to 4.34 u at frame 0, 22 of 24 reverse/shuffled comparisons fail, PSNR 13.6 dB). Seekcheck's stills at frames 30/60/90/119 are therefore all the end state; the forward-order stills are in `evidence/p2/forward/`.
- **It is also one engine step off nominal.** `<Physics>` accumulates `delta` and steps while `acc >= timeStep`; the leftover ends an ulp short, so a 1/60 advance runs 5, 6 or 7 steps at 1/360 (counts 2, 237, 1 over 240 advances). 196 of 241 table steps sit exactly one engine step behind; at t = 2.0 s the world has 719 steps, so the box (born at step 720) is not yet created at frame 60. `interpolate` (default on) draws up to one step behind the engine (0.015 u at 1/360, 0.09 u at 1/60).
- **G3 passes by accident.** A cold page replays the identical float sequence of `advance()` calls from zero and lands on the same wrong step counts (360/719/1079/1427 against nominal 360/720/1080/1428). It would break as soon as the caller partitions time differently (not tested).
- **At timeStep 1/60** (the library default) the scene is destroyed at the box impact: card-card depth 0.0575 (7 thicknesses), cards 0.068 below the desk, box flung off the desk (tilt 151 deg).
- **Cheapest seekable form (P2b):** `<Physics paused interpolate={false} timeStep={1/360}>`, step by hand with `useRapier().step`, time as a function of the frame index (count engine steps, never seconds), the box mounted at start, disabled, and enabled at step 720 inside `useBeforePhysicsStep`, a rewind = remount `<Physics key={epoch}>` inside R3F's `flushSync` and replay, draw by lerp/slerp of two engine steps (sub-frame error 9e-7).

| rewind strategy | bit-identical to a never-rewound run | cold seek to frame 119 | forward 1 frame | rewind median (reverse / shuffled) |
|---|---|---|---|---|
| V1 reset bodies in place, replay | no: 120 of 120 frames differ, up to 0.15 u (Rapier keeps broad-phase, island and contact history) | 116 ms | 1.3 ms | 35 / 21 ms |
| **V2 remount a fresh World, replay (used for A3-P2b)** | **yes**: 0 mismatches in forward, reverse, shuffled and 4 cold pages, raw f32 bits | 116-121 ms | 1.2 ms | 36 / 21 ms |
| V3 `takeSnapshot` every 60 steps + `restoreSnapshot` | no on 0.19.2: 1/120 reverse and 34/120 shuffled frames differ (worst 0.056); bit-identical on 0.21.0 in a separate experiment | 122 ms | 1.1 ms | 1.6 / 4 ms |
| V0 cache the rows while simulating | by construction | first play only | table lookup | O(1) | (this is P1 with the table built in the page; not built) |

- **The 0.19.2 vs 0.21.0 mismatch matters here.** Same spec, 1/360: 0.21.0 box rests flat (base y 0.016, tilt 0.775 deg, deepest card corner 0.0074); 0.19.2 box ends toppled (base y 0.457, tilt 57.8 deg, never settles) and cards differ by up to 0.213 u before the box arrives. The wrapper is not the cause: live P2b follows a vanilla 0.19.2 bake to 0.0005 u. `<Physics>` also overwrites two tolerances: 0.21.0's engine defaults are allowed linear error 0.005 and prediction distance 0.02 (the d.ts comment still says 0.001), the wrapper forces 0.001 / 0.002. Forcing 0.21.0 into the wrapper (a vite alias) and passing `allowedLinearError={0.005} predictionDistance={0.02}` reproduces P1's landing (base y 0.0164, tilt 0.99 deg), but rows are still not bit-identical to `drop.table.json` (cards up to 0.16 u off).
- **Weight of P2:** 114 MB node_modules (85 runtime, 29 build tools), one 3,328,129-byte JS file (1,133,606 gzipped; the rapier WASM is inlined), 401 lines of page source, needs a bundler (vite 8.3.1).

## Gotchas

1. **Kit page + seekcheck: add `&norun=1`.** The page starts its own `requestAnimationFrame` preview loop (renderFrame(n) forever) unless the URL has `?t=` or `&norun`; that loop repaints the canvas between `__seek(t)` and the screenshot. With the suggested query alone G1/G2/G3 failed with PSNR 8-23 dB and 1581 ms/frame (`evidence/p1-failed-loop/`); with `&norun=1` all pass bit-exactly. `render.mjs` adds `t=0&norun=1` itself. The only edit to the kit copy: `window.__seek = (t) => window.renderAt(t);` in `kit-p1/set-FT.html`.
2. **`TL.onBuild` is not awaited by the kit.** Load async data with top-level `await` in the timeline module (the page awaits the import) or keep onBuild synchronous.
3. **The box path "absent" switches off more than the mesh:** the contact-shadow blob (`st.shadow`), the amber desk glow and `pose.vis`. The player sets visibility; the timeline sets the blob from the physics height; band and LEDs still key off `box.bandOn` / `ledsOn`.
4. **Pivot convention.** The bake offsets the box collider by +0.5 y so the body origin is the base centre, like the kit mesh pivot: the table drives `st.box.group` with no conversion. Cards use their centre.
5. **Subframes.** The kit offers 16 subframes only for box-path contacts and crouches; `TL.fast` gives 8. 8 looked clean at 100% (impact at 9.5 u/s); a `TL.fast` that may return 16 is a one-line kit change.
6. **`ctx.ALL` is snapshotted after `build()`:** create meshes in onBuild, not later.
7. **Rapier 0.21 API:** the step is `world.integrationParameters.dt` (there is no `world.timestep`); substeps are a loop in the baker; the d.ts comment says the default allowed linear error is 0.001 but the engine's value is 0.005 (prediction distance 0.02 is right), and 0.19.2 had 0.001 / 0.002.
8. **Stable JSON text:** round to 1e-6 and never write `-0`; keep meta wall-clock free; one frame row per line. Timing goes in the CLI output only, not in the table.
9. **Spec files are chaotic inputs.** A one-line change (a density, a substep count) gives a different pile. Keep the spec and the table together and re-run `analyze.mjs` plus stills after every bake.
10. **@react-three/rapier 2.2.0:** the npm package declares no licence (the repo LICENSE is MIT, Poimandres; read through jsDelivr's copy); `advance()` takes seconds; `interpolate` defaults on; RigidBody applies pose, density and friction after creation and re-asserts them when props change (teleports: keep props referentially stable); there is no `enabled` prop; rapier 0.19.2 logs one `console.warn` per boot (it shows up in every seekcheck report); vite 8 wants `codeSplitting: false`.
11. **Seekcheck on a page that cannot rewind:** the stills for frames outside the 12 samples are taken after the reverse passes, so they show the final state; PSNR is computed for the first 8 mismatches only.

## Not tested, and why

- Other WASM engines (Firefox, Safari), x86-64, Windows, Linux: only this Mac, Chrome 154 and Node 21-25 (all V8) were available. A re-bake on another machine is not guaranteed bit-identical; commit the table.
- `@dimforge/rapier3d-deterministic-compat@0.21.0` (the enhanced-determinism build; Apache-2.0, published 25 Sep): not installed, outside the 20 repos (BRIEF rule 4).
- Rapier 0.21 soft bodies (`SoftBodyDesc` is in the 0.21 typings): not tried; the only lead I saw for paper that bends.
- Bake time and table size for large scenes (hundreds of bodies, 20 s), the wide aspect framing of `drop.js` (camera numbers for `aspect=wide` are a guess), and the audio mix from the generated cues.
- P2 side: G4, conditional mounting of the box through React state, `updateLoop` independent and `timeStep` vary, other delta partitions for naive seeks, npm `overrides` (a vite alias was used), why V3 restore is inexact on 0.19.2. The sub-worker's last full `run-gates.sh` was stopped at the snapshot step because the GPU queue was long: build, bake, harnesses and the V1/V2/V3 and 1/60 diagnostics were re-run on the final code; the snapshot test, the fidelity runs and the 0.21.0 alias build come from earlier runs of the same page (only default-off flags were added afterwards). I re-ran the P2b harness once more (`evidence/p2b-sheet/`, pass).

## Not run (outside the test rules)
1. **Kit placement and dependency:** `physics/` (bake.mjs, analyze.mjs, table-player.js) inside the kit or beside it, and `@dimforge/rapier3d-compat@0.21.0` as a build-time-only dev dependency of the kit tooling (Apache-2.0, 15 MB). Nothing was installed outside this lane.
2. **Kit changes (none made):** await `TL.onBuild`; let `TL.fast` return 16; optionally make `norun` the default when the harness query parameters are present (or document `&norun=1` in the README); optionally a `physics` prop kind in `ft/props.js` that wraps the adapter.
3. **`@dimforge/rapier3d-deterministic-compat`** for a cross-machine re-bake check.
4. **Only if live physics is ever wanted:** forcing rapier 0.21.0 into `@react-three/rapier` (npm overrides) plus the two `<Physics>` tolerance props.

## Evidence and how to reproduce

- Real kit page: `kit-p1/set-FT.html?tl=drop&aspect=tall&norun=1` (`timelines/drop.js`, `drop-min.js`, `drop.table.json`, `table-player.js`). Gates: `evidence/p1/report.json`, `evidence/p1-run2/report.json`; production render `evidence/p1/g4/drop.mp4` (+ 100% stills, `sheet-g4.jpg`); `render.mjs --qa` `evidence/p1/qa/render-qa.json` (all determinism checks pass; its seam check fails as expected for a one-shot plate); production-path hashes `evidence/p1/prod-hash.json`; a failed run kept as the norun evidence `evidence/p1-failed-loop/`; the minimal adapter's stills `evidence/p1-min/`.
- Contact sheets (4 s): `evidence/A3-P1-contact-4s.jpg`, `A3-P2-contact-4s.jpg`, `A3-P2b-contact-4s.jpg`, `A3-all-contact-4s.jpg` (same frame indexes, three rows).
- Physics numbers: `evidence/p1-analysis.json`, `evidence/p1-variants.json`, `evidence/p1-ccd-test.txt`, `evidence/p1-determinism.json`, `evidence/bake-browser.json` (+ `browser.table.json`), `evidence/p1-sound-cues.json`, `analysis-final.json`; the 14-day pin check `evidence/pins-publish-dates.txt`; the second bake scene `examples/generic-scene.json`.
- P2: `p2-r3f-rapier/` (page, `run-gates.sh`, `p2-summary.json`, `tables/` with the 0.19.2 and 0.21.0 bakes), `evidence/p2/`, `evidence/p2-default60/`, `evidence/p2b/`, `evidence/p2b-sheet/`, `evidence/p2-verify/` (my re-run of naive P2), `evidence/p2-alt0210/`.
- Reproduce P1: `node gen-spec.mjs && node bake.mjs --out drop.table.json && node analyze.mjs && node test-player.mjs`, then copy the table and player into `kit-p1/timelines/` and run `seekcheck.mjs kit-p1/set-FT.html --root kit-p1 ... --query "tl=drop&aspect=tall&norun=1"`; `node variants.mjs` rebuilds the settings table; `python3 -I tools/determinism.py` and `bake-browser.mjs` (under `gpu-run.py`) rebuild the determinism evidence; `python3 -I tools/make-results.py` rebuilds `results-A3.json`.
