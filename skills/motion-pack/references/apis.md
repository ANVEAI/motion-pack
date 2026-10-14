# API cheat sheet (per module)

All paths are relative to the repository root. Each module README holds the full contract and the measured results.

## Templates (start here)

```bash
cd templates/<ad|beat-edit|talking-head|multi-voice-doc|proof-film>  && node make.mjs [--set key=value ...]   # plan.json + mix.wav + index.html (+ out/tx.json windows)
npx --yes hyperframes@0.8.142 render . -o out/<name>.mp4 --crf 23
bash templates/_shared/render3d.sh templates/<film-scene|character-spot> scene.html <wide|tall> [crf]   # three.js: plan, GPU render, mix, mux, sheet
node templates/_shared/cues.mjs <dir> [--set k=v]       # export the plan only (no browser)
python3 templates/_shared/audio.py <plan.json> <out.wav> [--stem]   # plan -> mix (music mixer when a bed is set)
python3 templates/_shared/sheet.py <mp4> <sheet.jpg> t1,t2,...       # contact sheet from the DELIVERED file + LUFS-I / TP
```

- **`templates/_shared/plan.mjs`** (pure):
  - `PLATFORMS` and `SIZES`.
  - `beatGrid(bpm, fps, seconds)`: BPM snapped to whole frames per beat.
  - `sequence` (frame-exact) and `TX_SFX`.
  - `chunkCaptions`, `autocut`, `remap`.
- **`templates/proof-film`** (the proof film, 16:9 + 9:16): `node make.mjs [--set format=tall] [--set builder.kind=scatter|trace|table] [--set vo.words=/abs/words.json]` (`trace` is landscape-only: the gate refuses it with `format=tall`); the 9:16 page is its own HyperFrames project, `tall/index.html`: `(cd tall && hyperframes render . -o ../out/proof-film-tall.mp4)`.
  - `honesty.mjs` (pure): `problems(CONFIG, { voWords })` -> messages that name the field, `assertHonest` (throws `HonestyError`), `numberFields`, `claimWords`, `numberIn(text)` (a digit in any script, a currency or percent sign, or a number word: the gate's idea of "a number in prose"), `weak('source'|'method', text)` (filler, too short); `config.mjs gateProblems(CONFIG)` adds the VO transcript; make.mjs exits 2 and `cues.mjs` fails on any of them.
  - `panels.mjs` (pure, node + browser): `stage(plan, st, t)` draws one cell, `cameraFor(plan)` -> `{ pan, zoom }` (two nested cam2d state functions), `mapCell`, `safeInset(zone, W, H, push)`; `config.mjs` `buildPlan(CONFIG)` -> `plan.stages`, `plan.camera`, `plan.honesty`, `plan.audio` (`quiet` open + hold, `events`, `role` proof).
  - plan cue `overVoDb` (negative dB, read by `templates/_shared/audio.py`) puts a cue relative to the VOICE; without it a cue sits over the un-ducked bed. Plan cue `overBedDb` (dB, negative = under the bed) sets a LOOP cue's level against the un-dipped bed (the mixer's loop default is -10 dB): the proof film's `sfx/amb/room_tone` under the quiet hold sits at -26.
- **`templates/_shared/txplan.mjs`**:
  - `txPlan(shots, fps, {bpm})` gives `{wins, todo}`.
  - `span(P, {sel, start, dur, mediaStart})` stretches clips around each window.
  - `txCalls(P, {W, H})` emits the GSAP lines that bind each window.
- **`templates/_shared/pack.mjs` (browser):** `MP.transition(tl, id, ctx)`, `MP.type(tl, id, sel, opts)`, `MP.register(id, fn)`. Missing ids are logged and fall back to a hard cut or a plain fade.

## Transitions (`transitions/lib`)

```js
import { REGISTRY } from './transitions/lib/registry.js';              // params with defaults, timing, sfx pairings, reasons, use/avoid
import { resolveTx, ALIASES } from './transitions/lib/ids.js';          // 'transitions/dip-to-black' -> { key:'dip', params:{color:'#000000'}, kind:'dom' }
import { createTxRenderer } from './transitions/lib/tx-gl.js';           // WebGL: tx.compileAll(); tx.render({ key, from, to, p, params })
import { applyDom, DOM_KEYS } from './transitions/lib/tx-dom.js';         // DOM: applyDom(key, p, { a, b, root, params, cut })  (styles set from p alone)
import { makeTransitionPass } from './transitions/lib/tx-three.js';       // three: pass.set({ from: rtA.texture, to: rtB.texture, p, width, height })
import { hfBind } from './transitions/lib/tx-hf.js';                      // HyperFrames: hfBind(t => paint(t), { compositionId, duration })
import { planEdits, stateAt, lintPlan } from './transitions/lib/sequence.js';   // edit list on a beat grid; swap lands on cut_s
import { txWindow, snapBpm, speedRamp } from './transitions/lib/tx-core.js';    // integer-frame windows, eases (incl. CSS cubic-bezier), retime maps
```

- **Python:** `cuts/cutgen.py beats --bpm 128 --pattern every_2 --tx whip --snap` gives the same windows plus sound-cue anchor frames.
- **Kinds:** cut, smash (hard cut with the smash sound), dom (23 exact keys, plus `approx: true` for the 23 GL looks run through `transitions/lib/tx-dom-x.js` APPROX), gl (GL-only, canvas sources).
- **2026-10-14 round 3:** `sharedElement` (DOM: `[data-share="key"]` in both shots; params `bounce`, `stagger`, `shadow`; GL: `rectA` / `rectB` vec4) and `sketchToRender` (`paper`, `ink`, `line`, `threshold`, `draw`, `tone`, `dir`), both GL + DOM; `springStep(x, bounce)` and `shareProgress` in `tx-dom-x.js`.
- **2026-10-13 additions:** `transitions/lib/registry-x.js` + `transitions/lib/tx-shaders-x.js` (24 GL transitions: ripple, swirl, crossWarp, directionalWarp, cube, doorway, kaleido, hexagonalize, windowSlice, blinds, squeeze, polkaDots, tvStatic, burnOut, dreamyZoom, linearBlur, gridFlip, bookFlip, pinwheel, radial, waterDrop, wind, luminanceMelt, overexposure); `transitions/lib/xfade.js` `xfadeFilter('transitions/xfade-<mode>', { duration, offset })` for ffmpeg-only finishes.

## Retime

```bash
python3 cuts/retime.py ffmpeg --preset heroRamp|rampIn|rampOut|bulletTime|freezeStamp|reverseFlash ...   # frame-exact setpts/atempo chain + SFX cues (cuts/retime.json)
```

## Cuts

```bash
python3 cuts/cutgen.py beats   --bpm 128 --fps 30 --pattern every_2 --bars 8 [--snap] [--tx whip]
python3 cuts/cutgen.py section --bpm 120 --fps 30 --plan build_accelerate
python3 cuts/cutgen.py split   --mode J --cut-frame 120 --fps 30
python3 cuts/cutgen.py talking | smash | interrupts ...      # see cuts/README.md
python3 cuts/cutgen.py walkthrough --words words.json [--steps N]        # round 4/5 story shapes (cuts/story45.py): words.json = [{w, s, e}] in seconds
python3 cuts/cutgen.py query-ladder --dur 45 --rungs "video:1,pdf:3" [--bpm 120] [--words words.json]
python3 cuts/cutgen.py fidelity-ladder --bpm 99 --params 3,10,36,1024 [--dropout-s 3]
python3 cuts/cutgen.py voices-open --clips clips.json                # [{id, src, words, name, role, tag, lead?}]
python3 cuts/cutgen.py command-burst --words words.json | anaphora --words words.json --token here
python3 cuts/cutgen.py trailer --dur 60 [--dialogue lines.json] | style-ladder --looks live,look.pastel --bpm 120
```

- **Library:** `import story45; story45.walkthrough(words, fps, steps, regions)`, `query_ladder`, `fidelity_ladder`, `voices_open`, `command_burst`, `anaphora`, `trailer`, `style_ladder` return plain dicts (a `warnings` list, `sfx` cue rows with `visual_frame` / `anchor_frame`, and `bed_automation` where the shape has a dropout or a quiet hold); `story45.inside_word(t, words)` is the no-cut-inside-a-word test.
- **Bed automation and duck depth (mixer cue sheet):** `"bed": {"automation": [{"frame": f, "gain_db": g}]}` (linear in dB, held outside) and `"vo": {"file": ..., "duck_db": 12}`; `templates/_shared/audio.py` passes `plan.bedAutomation`, `plan.vo` (a WAV relative to the plan) and `plan.duckDb`.

## Sound (`sfx/`, `music/`)

```python
import sys; sys.path.insert(0, 'music'); import mixer   # run from the repository root
m = mixer.Mix(fps=30, length_s=15)
m.add_bed(bed)                                   # or a pack bed via the Library; loops/sidecar from music/library/beds/*.json
m.add_vo(vo)                                     # ducks the bed 9 dB + carves
m.add_cue('snd.hit.cinema', frame=150)           # anchor lands on (150 + 1) x 1600 samples
m.add_transition('whip', frame=120, duration_frames=9, energy=0.6)   # sweetener table -> cues
rep = m.render('out_dir')                        # master.wav -14 LUFS / -1.5 dBTP, stems, AAC probes, phone check, lint
```

- **CLI:** `python3 music/mixer.py cuesheet.json --out DIR` (the JSON cue sheet format is in `music/README.md`).
- **Ids:** `sfx/<cat>/<name>` maps to `snd.<cat>.<name>` (`sfx/manifest.json`: anchor, LUFS, centroid, `phone_safe`, `pairs_with`).
- **Bundles:** `sfx/bundles.json` maps roles to ids for `launch_film`, `mime_spot`, `beat_edit`, `talking_head`, `short_film`, `product_ad`, `kinetic_type`, `loop_short`, `india_festive`, `voice_agent_demo` and `office_comedy`.
- **SFX families (301):** cartoon 30, indian 26, ambience 24, transition 24, ui 23, foley 20, impact 18, drum 17, device 16, riser 16, whoosh 15, voice 12, and smaller liquid / logo / stinger / glass / wood / cloth / crowd / metal / paper / plastic / sparkle / camera / cash / elec. Ids tagged `rr:4` have four round-robin takes (seeds s..s+3).
- **Electric (round 4/5):** `sfx/elec/arc` (`snd.elec.arc`, a 0.4 s zap, anchor = the crack, `rr:4` four strikes), `sfx/elec/crackle_loop` (4.0 s seamless loop on a seeded random-walk envelope, sit it under the bed with `Mix.add_cue(..., until_frame=F)`) and `sfx/elec/zap_off` (1.2 s power-down, anchor = the snap: put it on the frame the light dies). The buzz is tuned to A2 (110 Hz). Bundle `neon_power_on`. Pairs with electric / neon outline type and `blender/cableTangle` bulb-out frames.
- **Sweeteners:** `sfx/sweeteners.json` has a row for every transition kind (incl. the formerly pending shutter, swipeUp, spin, pagePeel, pixelSort); new visual transitions fall back to their `transitions/catalog.json` sfx list.
- **Music:**
  - `music/compose.py` + `music/presets.py`: 27 presets (the original 10 plus indian_fusion, bhangra_hype, raga_calm, festive_dhol, lofi_jazz, synthwave, deep_house, dnb_170, ambient_pad, chiptune_8bit, acoustic_folk_pluck, documentary_marimba, orchestral_synth_epic, jazz_walk, comedy_pizzicato, corporate_bright, suspense_pulse). Indian presets use `tuning="ji"` and raga scales.
  - `music/theka.py`: `render_theka('teental'|'keherwa'|'dadra', fps, cycles, seed)`, `render_bhangra(fps, bars, seed)`; sidecars carry sam / khali frames.
  - `music/grid.py`: `snap_bpm`, `cut_map`, `tempo_ramp_map` (`music/tempo_maps.json`: 11 tempos x 24/30/60 fps + ramps).
  - `music/logo.py`: `motif_from_name(name)`; sitar variants `logo_sitar_*`.
  - `music/stingers.py`.
  - `music/trailer.py`: `render_trailer('trailer_arc', fps, seed, act_bars=(4, 4, 4))` -> `{stems, mix, events, meta, markers}`: act 1 drone, act 2 rising ostinato, act 3 wall, a planned sub-only gap, a crescendo, a hard-stop title hit, a quiet hold. NOT a loop; every marker is a whole frame (`markers(name, fps, act_bars)`); the pack bed is `music/bed_trailer_arc` and its sidecar `bed_trailer_arc.json` has `markers`, `visual_cut_frame` (hit - 1) and the length rule. Mark the gap and the hold in `plan.audio.quiet`.
  - `Mix.add_bed(loop=True)` now tiles stereo beds correctly (fixed 2026-10-13).
- **Outside audio:** nothing third-party is vendored. `scripts/fetch-external.sh` fetches the CC0 subsets (Kenney audio, OwlishMedia SFX) into a folder outside git; then `python3 sfx/tools/check_origin.py DIR` and `python3 sfx/tools/catalog_import.py DIR --category NAME [--dry]` import them into `sfx/library_ext/` (tagged `source:ext`), never `sfx/manifest.json`.

## Layers

```js
import { Finisher } from './layers/finisher.js';            // WebGL2 over a plate: fin.setSource(canvas); fin.render(t, { frame, hits, cuts })
import { mountStack, bindHF } from './layers/overlay.js';    // DOM: mountStack(root, [{kind:'vignette'},{kind:'grain',params:{stock:'film35'}}], {width,height,fps}); bindHF(stack,{fps})
import { toSVGFilter, toCube, mixGrade } from './layers/grade.js'; import { GRADES } from './layers/presets/grades.js';   // premium-product warm-film cool-tech retro-vhs nostalgic-print bright-playful noir documentary neutral
```

- **Stack order:** leaks / bokeh / glow, grade, paper, vignette, scanlines, story type, dust, grain, brand, bars, dither.
- **Grade count:** one grade per piece.
- **Round 3 (2026-10-14):** backgrounds `meshGradient`; `canvas2d-r3.js` `dotCondense` (`dotCondenseState`), `hologramBeam` (`hologramState`); `stylize.js` `mountGradeIn(el, params).render(t)`, `gradeInWeight`, `gradeInSVG`, `gradeInCube(params, w)`.
- **Round 4/5 (2026-10-14):** `canvas2d-r45.js` (merged into `K2D`; ids `layers.embeddingCloud`, `layers.epicycleDraw`, `layers.hexMosaic`, `layers.convergeToDot`): `mountStack(el, [{ kind: 'epicycleDraw', params: { steps: [[0, 4], [0.8, 16], [1.6, 'full']], period: 0.8 } }], { width, height, fps })` (returns `{ layers, ready(), render(t), dispose() }`: `await stack.ready()` resolves when the layers' `images` are decoded; `bindHF` repaints once they are; `preloadImages(srcs)` is the same thing standalone); `cuesR45(kind, params)` -> `[{ t, id, why }]` (local s); the maths for DOM that follows a point: `embeddingState(t, p, { W, H })`, `epicycleState`, `epicycleDFT`, `hexState`, `convergeState`, `cloudPlan`.

## Type

```js
import { drawType, drawCaptions } from './type/render-canvas.js';   // canvas / three overlay
import { mountType, bakeType, mountCaptions, bakeCaptions } from './type/dom.js';   // HyperFrames DOM
import { chunkWords, CAPTION_STYLES } from './type/captions.js';    // karaoke impact emphasis pill clean
import { SAFE, safeRect, captionBox, lintRect } from './type/safezones.js';
```

The 14 presets are maskRise, charRise, wordStagger, charStagger, blurIn, scaleSlam, typewriter, trackingCollapse, weightMorph, wipe, flipSplit, elasticPop, scramble and glitchSplit.

```js
import { renderSVG, mountGfx, bindHF, uiCues, nodeGraphCam, isoTiltCss } from './type/gfx/index.js';   // editor graphics + the ui.* kit
renderSVG('ui.promptBar', t, { at: 0, params: { text: 'Plan the week', sendAt: 1.8, scale: 1.4 } }, { W: 1920, H: 1080 });   // full-frame SVG string ('' off screen)
uiCues('ui.promptBar', { at: 0, params: { text: 'Plan the week', sendAt: 1.8 } });   // [{ t, id: 'sfx/ui/click', why }] -> plan cues
renderSVG('ui.liveTranscript', t, { at: 0, params: { turns: [{ speaker: 'Caller', text: '…', at: 0.2 }, { speaker: 'Acme Voice', ai: true, text: '…', at: 1.2, latency: 0.34 }], source: 'latency values illustrative' } });   // round 3: ui-data.js / ui-nav.js
import { pageFlyCam } from './type/gfx/index.js'; pageFlyCam(t, { stops: [[0.1, 0.1], [1.0, 0.4]], pullAt: 2 });   // { focus, zoom, pull, blur, transform } for a DOM page screenshot (true CSS perspective)
import { springTrack, spring, springSettle, SPRING } from './type/ease.js';   // springTrack(t, [[t0, v0], [t1, v1], ...], 'ui' | 'panel' | 'camera' | 'headline' | 'mascot' | { zeta, f })
```

Round 4/5 (`type/gfx/r45-type.js`, `r45-glyph.js`, `pathsample.js`): `title.partnerLockup` (`marks`, `balance`, `divider`; `partnerLockupLayout`, `lintPartnerMarks`, `inkFromMask({ data, width, height }, { channel })`, browser `markFromImage(img, { licensed })`, CLI `tools/mark_ink.py`), `layout.iconMergeLockup` (`icons`, `hits`, `mergeAt`; `iconMergeState`, `iconMergeFit`), `type.flankWords` (`subject`, `split`; `flankState`, `flankFitK`, `lintFlank`, `flankShots(sentence, ranges, style, ctx)`), `type.behindSubject` (SUPPLIED `plate` / `matte`: `{ href } | { frames: 'dir/f_%04d.png', fps, count, first } | { svg }`; `matteMode`, `edge`; `srcAt`, `figurePlate`; a video alpha -> frames with `python3 tools/alpha_frames.py video out_dir [--mode alpha|luma] [--fps] [--scale] [--prefix]`), `type.asciiMosaic` (`image`: `bust | orb | spark | { lum }`, `mode: 'text' | 'ramp'`; `lumGrid(img, cols, rows)`, `asciiMosaicGrid`), `type.textOnPath` (`path`, `mode: 'trail' | 'reveal' | 'travel'`; `textOnPathState`), `type.electricOutline` (`text`, `jitter`, `crackleFps`, `halo`; `strokeOutline`, `electricGeo`, `electricGlowPools(p, ctx)` -> pools for overlay `glow`, `ELECTRIC_SOUND`). Path maths: `flattenPath(d)`, `arcTable(pts, closed)`, `pointAt(tab, s)`, `resample(tab, n)`, `PATHS`.

SVG kinetic pieces and field layouts (`type/gfx/kinetic.js`, `type/gfx/collage.js`) use the gfx contract: `renderSVG(id, t, { at, dur, params })` or `mountGfx(root, items)` re-rendered on `hf-seek`. The `type.*` ones also resolve as `type/<name>` ids through the template type adapter (`MP.type(tl, 'type/wordWheel', '#el', { at, dur, params, W, H })`).

- `type.wordWheel` (`words`, `steps: [[t, index], ...]`), `type.inlineMedia` (`text` with `[photo]`, `[stack]`, `*pill*`, `|`; `media: [{href} | {svg} | {cards}]`), `type.letterAssemble`, `type.glyphMorphCursor` (`mark`: an SVG path in a 100 box), `type.marquee` (`accent`, `accentStyle: 'color' | 'pixel'`), `type.bleedWord`.
- `layout.scatterCollage`, `layout.mosaicBurst`, `layout.logoWall` (placeholder marks only; `logos: [{svg} | {href}]`; a digit in `headline` needs `source`), `layout.orbitRing` (`icons: [{name | svg | href, label, ring, angle}]`), `callout.connectorLabel` (`items: [{label, at, tint, ink}]`, chained).

Round 3 (`type/gfx/swap.js`, `badges.js`, `brand.js`): `type.accentSwap`, `type.wordSplitMedia`, `type.imageFill`, `type.strikeOut`, `type.glowWord`, `type.ledDigits`, `callout.selectionBox` (+ `selectionZoomCss`), `counter.scoreIterate`, `counter.stepPill`, `caption.speakerTag`, `title.timeCard`, `layout.paletteColumns`, `layout.logoConstruction` (`CIRCLE4`, `SPARK4`), `layout.mockupInContext` (`PLATES`), `layout.typeSpecimen`, `layout.backdropSwap`, `layout.lineup`. Sound per action: `gfxCues(id, { at, params, dur })` -> `[{ t, id, why }]`.

Round 4+5 (`type/gfx/ui-proof.js`, `ui-trace.js`; `ui.promptBar` takes an `attach` param in `ui.js`): `chart.scatterFrontier`, `ui.dataTable`, `ui.branchTrace`, `caption.sceneBubble`, `ui.costTicker`, `type.paramReadout`, `lowerThird.personalTag`, `ui.promptBar.attach`. Numbers are illustrative by default and the frame says so; a point, table or ticker without its `source` (blank counts as none) renders a red "needs a source" card (and one `sfx/ui/error` cue). Params merge over the defaults key by key (`x: { max: 20 }`, `zero: { value: '0' }`, `dock: { to: [0.6, 0.4] }`, `attach: { name: 'brief.pdf' }`); `ui.dataTable` with no `box` / `scale` picks a phone layout on 9:16.

```js
import { renderSVG, gfxCues, frontierOf, fmtUnit, keysAt, trackAt, lintBranchTrace, traceTimes, traceCaptions, bubbleGeo, readoutGeo } from './type/gfx/index.js';
renderSVG('chart.scatterFrontier', t, { at: 0, params: { points: [{ label: 'A', x: 4, y: 41, source: 'run 12' }, { label: 'B', x: 7, y: 47, source: 'run 12' }], hero: { label: 'Ours', x: 3, y: 50, source: 'run 12', callout: ['Highest score', 'under $4'] } } });   // frontierOf(points, { x: 'low', y: 'high' }) is monotone for any input order
renderSVG('ui.dataTable', t, { at: 0, params: { columns: [{ label: 'Metric' }, { label: 'Mon' }, { label: 'Tue' }], rows: [{ label: 'Calls', unit: 'K', values: [12400, 15800] }], finding: 'Tuesday handled more calls.', highlight: { row: 0, col: 2 }, source: 'call log, 2 days' } });   // units: K M % dur s ms $ '' (fmtUnit)
renderSVG('ui.branchTrace', t, { at: 0, params: { run: ['id-name'] } });   // lanes / decision default to a generic booking example; run [] = pass; lintBranchTrace(params) -> [] when every picked id exists
renderSVG('caption.sceneBubble', t, { at: 0, params: { words: [{ w: 'Hello', s: 0.5, e: 0.8 }], anchor: [[0, 0.4, 0.3], [4, 0.45, 0.32]], dock: { at: 3, to: [0.64, 0.17], scale: 0.62, title: 'Reminders' } } });   // words.json shape (s, e local to `at`); anchor = [x, y], a [[t, x, y], ...] track in local time, or layout.cornerPin data { keys: [{ t, q }], units: 'px', uv: [0.5, 0.5] } in composition time
renderSVG('ui.promptBar.attach', t, { at: 0, params: { attach: { kind: 'sketch', name: 'banner-sketch.png', from: [0.3, 0.17], dropAt: 1.15 } } });   // every attach key is optional (filled from ATTACH); `href` swaps in your own thumbnail; attach: [{...}, {...}] docks several chips left to right
renderSVG('ui.costTicker', t, { at: 4, params: { anchor: { keys: pinKeys }, source: 'run 12' } });   // pinKeys = the same [{ t, q }] you give layout.cornerPin (composition time); trackAt(anchor, u, ctx, t) -> frame fractions
gfxCues('caption.sceneBubble', { at: 2, params });   // [{ t, id, why }]: pop on the first word, success on "Captured", swish on the dock
```

## Camera

```js
import * as C3 from './camera/cam3d.js';   // hold pushIn pushSlow pullOut orbit crane truck dollyZoom whipPan handheld beatPunch impactShake dutch breathe rackFocus lock sequence kitDrift; applyToThree(THREE, cam, state, W, H)
import * as C2 from './camera/cam2d.js';   // (round 3: scaleDive + scaleDiveCSS, pullbackToScreen -> state.pin.corners, mapPoint2) push2d pull2d pan2d whip2d handheld2d punchCadence punchIn2d beatPunch2d kenBurns dutch2d breathe2d shake2d coverScale toCSS toGSAP
import { bakeGSAP, driveSeek } from './camera/bake.js';
const cam = C3.handheld(C3.pushIn(C3.hold(KIT.wide), { at: 1, dur: 1.2 }), { level: 'doc', seed: 3 });
```

## Objects (three.js; the pages use three 0.160.0 through an importmap)

```js
import { O, REGISTRY, create } from './objects/index.js';
import { stageConfig, makeStage, shot, cutShots } from './objects/stage.js';   // makeStage(ctx, { mode: 'slab' | 'white' })
import { POSES, EMOTIONS, ACTS, emote, keysOf, blinkTimes } from './objects/characters/poses.js';
const laptop = create(ctx, stage.slabG, 'objects/laptop', {}); laptop.set({ open: 1, screen: 1 });
const worker = create(ctx, parent, 'objects/worker', { spec: { keys: keysOf(ACTS.doubleTake(1.0), [[3.0, emote('front', 'happy')]]), blinks: blinkTimes(0, 8, 3) } });   // keys: [[t, pose, ease]]; worker.update(t)
```

- **Gallery:** `objects/gallery.html?shot=devices|film|cast|dome|r3`.
- **Round 3:** `objects/characters/mascot2d.js` (`mascotSVG(t, spec, {W, H})`, `drawMascot2d`, `mountMascot2d`; no three.js) and `O.makeMascotPlane`; `O.makeLogoExtrude(ctx, parent, { svg, preset: 'chrome' | 'glass' | 'iridescent' | 'satin', slice })`.
- **Stills:** `objects/stills.sh <page> <outdir> "<frames>" "<query>"`.
- **Probe:** `node objects/tools/probe.mjs <page> "<query>" "<expr>"`.

## Blender plates (`blender/`)

```bash
B=${BLENDER:-blender}      # Blender 5.2.x; macOS: /Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup -P blender/run.py -- --list
$B -b --factory-startup -P blender/run.py -- --recipe blender/cableTangle --size 1920x1080 --fps 30 --seconds 5 --out out/tangle \
   [--param mode=off|on --param bulbs=5 --param stagger=12 --param schedule=36,48,60,72,84] [--beats bed.json] [--device gpu|cpu]
```

- **`blender/cableTangle`** (round 4/5): a dark set, a seeded cable tangle feeding warm filament bulbs. `mode=off`: the red feed cable is pulled out and the bulbs go out in sequence; `mode=on`: it untangles and they light. Bulb change frames come from `schedule` > `--beats` sidecar hits > `pull_start + lag + k * stagger` (`order` ltr | rtl | out | in | seeded), are keyed per WHOLE frame, and are written to `render.json` `recipe_report.plan.change_frames` with each bulb's pixel position per frame (`bulb_px`). Cut the sound to those frames: `sfx/elec/zap_off` or a `snd.hit.*` on each bulb frame. Looks (`--preset`): tungsten, amber, daylight. Cycles by default; `--device cpu` for a hash-level repeatable render (GPU is visually, not bit, identical).
- Every recipe: frame-keyed, seeded, PNG masters in `out/frames/`, `render.json` with hashes; `blender/README.md` lists the recipes and their parameters.

## Critic tools (`tools/refstudy.py`, `ears/`)

```bash
python3 tools/refstudy.py <x-status-url | mp4-url | file.mp4> refs/<name> [--whisper none] [--tier A|A-|B|B'|R|C|D] [--tiers my.json]
python3 tools/refstudy.py grade refs/*/ [--write] [--json]            # grade existing study folders from meta.json (no download)
python3 ears/listen.py out/film.mp4 --plan out/plan.json [--mode music|vo|continuous] [--events study.json] [--role proof|explainer|hype|trailer|vo_doc]
```

- **refstudy** writes `study.json` fields `motion` (visual events for continuous pieces, `motion.sync` with `share_on_onset` and its chance level: `chance_share`, `lift`, `z_vs_chance`, `reading`), `quiet` (`open_vs_body_db`, `tail_2s_vs_body_db`, `end_shape`) and `evidence` (`tier` A / A- / B / B' / R / C / D, `boosted`, `claim_driven`, reasons). Thresholds: `tools/refstudy_tiers.json`. Python: `refstudy.motion_events(path, cut_times)`, `motion_sync(motion, onsets, speech, fps_video)`, `video_fps(path)`, `motion` subcommand (`refstudy.py motion <local mp4> <study dir> --write`), `quiet_shape(curve)`, `grade(meta, rules, override)`.
- **ears plan fields** (all optional, in `out/plan.json`): `audio.mode` (`music` default | `vo` | `continuous`), `audio.quiet` `[{t: [a, b], kind: open|dip|gap|hold, why}]` (planned quiet is shape: open <= 2 s, dip / gap <= 4 s, hold <= 9 s; unplanned near-silence of 2 s or more warns as dead air), `audio.events` (motion-event seconds, for `continuous`), `audio.role` (bass-share range note). `ears.listen.analyze(x, fps, plan=..., mode=..., quiet=..., events=..., words=..., role=...)`.

## Checks

```bash
python3 tools/check_ids.py
python3 -m pytest -q cuts/test_cutgen.py cuts/test_retime.py cuts/test_story45.py sfx/tests music/tests tools/tests cloud/tests
python3 -m pytest -q ears/tests
node transitions/tests/core.test.mjs && node transitions/tools/lint.mjs
node camera/tests/camera.test.mjs; node type/tests/type.test.mjs; bash layers/tests/run-all.sh
python3 sfx/qa.py; python3 music/qa.py
python3 catalog/build.py
```
