# motion-pack / objects

Reusable three.js props, set pieces and one character, extracted from the ANVE launch film kits (v9 studio, v10 set, story B) into a library with one small API, plus three new generic props. Every component is procedural code we own. None of them uses `Date` or `Math.random`, so any frame renders from `t` alone and seeking is safe.

- **One import:** `import { O, REGISTRY, create } from './index.js'`.
- **Calling a builder:** call `O.makeX(ctx, parent, params)` directly, or call `create(ctx, parent, 'objects/<name>', params)`.
- **What `ctx` is:** the context from `kit/core.js runScene`. It is the spec-to-loop render contract: `window.renderAt(t)`, `__hashFrame`, `__layout` probes, 4 to 16 GPU-supersampled subframes.
- **Stage scaffold:** `stage.js` gives `stageConfig()`, `makeStage(ctx, {mode: 'slab'|'white'})`, and `shot()` / `cutShots()` cameras. Every demo and 3D template starts from it.
- **Kit:** `kit/` is a vendored copy of the v9 studio kit harness: `core.js`, `util.js`, `presets.js`, the v10 `tl.js` and the fonts. It is unchanged apart from provenance headers. The film's own kit stays frozen.
- **Fonts:** Manrope and IBM Plex Mono, both SIL OFL.
- **three.js:** the pages load three.js 0.160.0 from jsDelivr through an importmap. This is the same setup as the film kit.

## Components (id, tags, API, state)

| id | tags | builder / state | from |
|---|---|---|---|
| objects/studio-env | set light ibl | `makeStudioEnv(ctx, o)`: warm studio sphere baked to IBL + calm chrome env | v9 props.js |
| objects/slab | set stage miniature | `makeSet(ctx, o)` -> `{slabG, setDip(y)}` floating white slab | v9 |
| objects/desk | set stage long | `makeDesk(ctx, o)`: slab extended along x for multi-zone sets | v10 desk.js |
| objects/slab-fx | decal ring glow | `makeSlabFx`: `u.uRing / uEdge / uGlow` (alpha lines, additive spill) | v9 |
| objects/blob-shadow | decal shadow | `makeBlobShadow(ctx, p, w, d)`: contact occlusion only | v9 |
| objects/studio-lights | light click fixture-free | `makeStudioLights(...).update(n, slot, dip, glint)` 3-frame click flicker | v9 |
| objects/room-rig | light mood tension | `makeRig(ctx, L).update(n, slot, {at, spread, tension, solution, ...})` | v10 desk.js |
| objects/product-box | product hero | `makeAnveBox(ctx, B)`: `pose(p, sx, sy, yaw)`, `setBand`, `setLeds` | v9 |
| objects/box-path | motion drop hop glide | `makeBoxPath(spec, spotOf)`: `pose(t)` for place / drop / glide / travel, `dip(t)` (works for any base-pivoted prop) | v10 box.js |
| objects/chrome-blob | liquid chrome sdf cloud | `makeChromeBlob(ctx, o, env)`: `update(centre, prims, k)` (smooth-min SDF, MarchingCubes) | v9 |
| objects/sheet | paper document curl | `makeSheet`: `bend(far, near)`, `set(p, euler, s)` (inextensible curl) | v9 |
| objects/paper-block | paper stack | `makePaperBlock` | v9 |
| objects/readout | counter number engraved | `makeReadout`: `set(value, hex)` rolling drum + mono label | v9 |
| objects/counter | counter stand legacy | `makeCounter`: `set(value, hex)` | v9 |
| objects/clock | clock time engraved | `makeClock`: `set(minutes)` odometer HH:MM | v10 clock.js |
| objects/meter | gauge dial needle cost | `makeMeter(ctx, p, {label, vmax, red, ...})`: `setValue(v)`, `setZone(level)`; `needleSpring(o, F, steps)` closed-form needle | v10 bill.js (generalised) |
| objects/window | ui app tab card | `makeWindow(ctx, p, {name, tag, tagHex})`: `set(p, {hinge, yaw, lean, scale})` | v10 tabs.js |
| objects/tile | icon block feature | `makeTile(ctx, p, {icon})`: 10 owned line icons (`ICON_KINDS`) | v10 tabs.js |
| objects/stand-card | card sign audience | `makeStandCard(ctx, p, {name, icon})`: engraved icon (`PATH_ICONS`) + name | v10 offices.js |
| objects/puck | status flip lock check | `makePuck(ctx, p, {front, back})`: `set(p, ry, sxy, sz, rx)` (flip = state change) | v10 offices.js |
| objects/plug | integration connector led | `makePlug(ctx, p, {label, icon})`: `set(p, {rock, sz, led})` | v10 wall.js (**logos removed**) |
| objects/laptop | device computer screen **new** | `makeLaptop(ctx, p, o)`: `set({open 0..1, screen 0..1, ui})`, `pose(p, yaw)`; instanced bevelled keys, hinged lid, live canvas screen (`uiDashboard`) | new |
| objects/phone | device mobile screen **new** | `makePhone(ctx, p, o)`: `set({screen, ui})`, `pose(p, euler)`; bevelled anodised frame, glass, camera island, live screen (`uiChat`) | new |
| objects/mug | prop coffee ceramic **new** | `makeMug(ctx, p, o)`: `set({fill, slosh, tilt})`; `mugSlosh(tau)` closed-form slosh | new |
| objects/worker | character mascot pantomime original | `makeWorker(ctx, p, spec, zoneX?, rimLight?)`: `update(t)` from `{keys, path, blinks}`; rig, hops, follow-through (head 2 f, arms 3 f), breathing, blinks | v10 story B worker.js |

Character data lives in `characters/poses.js`:

- **`POSES`:** 45 film poses plus 6 generic ones (`front`, `pointR`, `waveR`, `shrug`, `facepalm`, `armsCrossed`).
- **`EMOTIONS`:** 6 emotions (neutral, happy, sad, surprised, angry, scheming), applied with `emote(pose, emotion)`.
- **`ACTS`:** timed acts that return pose keys at 30 fps: `doubleTake`, `shrug`, `wave`, `point`, `cheer`, `facepalm`, `slowBurn`, `slump`, `jumpScare`, `danceBob(beats)`.
- **Helpers:** `keysOf(...)` merges keys and `blinkTimes(t0, t1, seed)` seeds the blinks.

Materials are in `lib/mat.js`. `MAT` holds clay, satin, ceramic, anodised, darkMetal, glass, blackGlass, rubber, paper, ink and liquid. The helpers are `slabGeo` (bevelled), `faceGeo`, `latheGeo`, `grainTex` (seeded roughness imperfection) and `radialTex`. Metals and the ceramic glaze reflect `ctx.metalEnv`, the calm soft-panel environment that `makeStage` sets up. Without it they read dark and plain.

## Demos and QA

- `gallery.html?shot=devices|film|cast` is a 4 s scene per shot. Add `&cam={...}` to override the camera for close-ups.
  - **devices:** laptop, phone, mug and the worker's wave act.
  - **film:** every extracted set piece.
  - **cast:** the 6 emotions.
- **Plates:** `templates/_shared/media/plate-{devices,film,cast}.mp4`, 1080p, about 0.5 MB each. Hero stills are in `qa/hero-{laptop,phone,mug}/f0100.jpg`.
- **Stills:** `./stills.sh <page> <outdir> "<frames>" "<query>"`.
- **Probe:** `node tools/probe.mjs <page> "<query>" "<js expr>"`.
- **Determinism:** run `render.mjs --qa`. Results are in `qa/hash/*.json`, and all of these pass:
  - `same_frame_twice` on gallery devices, film and cast, and on templates film-scene and character-spot.
  - `renderAt(t) == renderAt(t + 3 loops)`, which proves seek-safety after other frames have rendered.
  - The console check (zero errors).
  - The seam check is expected to fail because these scenes are not loops.

## Polish verdict (looked at the 1080p hero stills)

- **Phone:** reads premium. It has bevelled frame highlights, a glass front, a camera island and a crisp UI.
- **Laptop:** clean, stylised product render at medium and close distance. The aluminium reads slightly flat grey because there is no anisotropic brushing, and the keycaps are uniform black. It is not photoreal at macro distance.
- **Mug:** clean thrown-ceramic read, with a rounded rim, a real wall, a crema ring and a glaze that catches the panels. It is perfectly symmetric with no glaze variation, so it stays stylised and is not photoreal in an extreme close-up.
- **None** of them looks toy-cheap at the distances the templates use, but none is a photoreal hero at macro distance. Use the Blender path for that.
- **Not built:** desk (the slab and the desk cover it) and chair (no time to reach the bar, so we did not ship a weak one).

## Rules kept

- **No third-party marks:** the v10 wall plugs drew Google, Outlook, Zoho, SAP and others. They print our own label or icon here. If you pass your own `faceTex` with a real logo, the type layer must carry the trademark line.
- **Worker:** an original character. the mime-style genre borrows an edit grammar only (docs/research/edit.md section 10), never a look.
- **Decals:** used only for contact occlusion. Real shadows come from the lights.
