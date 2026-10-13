# physics: baked rigid-body motion that seeks like everything else

Live physics breaks frame renderers. A simulation integrates over time, so frame 90 depends on frames 0–89, and a renderer that seeks out of order or splits work across workers gets different pictures. In our tests, live `@react-three/rapier` failed the order-independence gate at 13.6 dB.

This module simulates **once, at build time**, with [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`, Apache-2.0). It writes every body's pose per step to a JSON table. At render time a 63-line, dependency-free player reads the table as a pure function of `t`. The result is real scatter, piles, topples and drops, with frames that render identically in any order.

| file | what |
|---|---|
| `bake.mjs` | runs Rapier at a fixed step from a scene spec and writes `*.table.json` (CLI or importable, Node or browser) |
| `table-player.js` | plays a table: `poseAt(t, i)`, `apply(t, objects3d)`, `aliveAt`, `motion(t)` (for extra motion-blur subframes), `firstContact(id)` |
| `cues.mjs` | turns the table's contact events into `music/mixer.py` cues (paper flips, thuds), so every visible impact is heard on frame + 1 |
| `examples/scatter-drop.spec.json` | 24 paper cards scatter on a desk, then a product box drops in at 2 s and settles (4 s) |
| `examples/generic-scene.spec.json` | a minimal spec showing every collider shape |
| `tests/test-player.mjs` | player unit checks: exact at step times, unit quaternions, pure function of t, smoothness |

## Use it

```bash
cd physics && npm install                    # once: @dimforge/rapier3d-compat 0.21.0 (build time only, never shipped to the page)
node bake.mjs --spec examples/scatter-drop.spec.json --out examples/scatter-drop.table.json
node tests/test-player.mjs                   # ALL PASS
node cues.mjs examples/scatter-drop.table.json --max 24 > cues.json   # optional: impact sounds for the mixer
```

**The scene spec** lists:
- `statics` and `bodies`, with shapes `cuboid`, `ball`, `capsule` or `cylinder`;
- per body: friction, restitution, damping, initial velocity, an optional `born` step for late arrivals, and `events: true` to record contacts;
- the world: gravity, `substeps`, solver iterations;
- a seed and the step: `time.physicsStep`, default 1/60.

Thin bodies such as cards need engine substeps (the example uses 6). See the header of `bake.mjs` for the full schema.

**In a three.js page** (HyperFrames `three` adapter or any `renderAt(t)` page):

```js
import { createTablePlayer } from './physics/table-player.js';
const P = createTablePlayer(await (await fetch('./scatter-drop.table.json')).json());   // load before the first seek
const meshes = P.meta.bodies.map((b) => { const m = makeMeshFor(b); scene.add(m); return m; });  // your mesh per body (b.size, b.kind), in table order
function renderAt(t) { P.apply(t, meshes); renderer.render(scene, camera); }
window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
```

## What was measured (13 Oct 2026)

- **Byte-identical tables:** the same spec and the same engine build gave one SHA-256 across Node 21, 22 and 25 and Chrome 154. Cross-CPU identity is untested; Rapier publishes `rapier3d-deterministic-compat` if you need it.
- **Bake cost:** the example (25 bodies, 4 s) bakes in about 0.25 s cold. The table is 387 KB, or 95 KB gzipped.
- **Seeked renders:** in a supersampled three.js set, the played-back table passed all determinism gates with no mismatching pixel, in both sample order and production order.
- **When not to use it:** for one object moving along a designed path, a spring or a curve is simpler and easier to direct. Bake when several bodies interact.
