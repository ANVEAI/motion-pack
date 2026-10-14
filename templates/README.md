# motion-pack / templates

There is one starter per genre. Each one has a `config.mjs`, which holds the editable `CONFIG` block plus a pure `buildPlan(C)`, and each has a rendered demo.

A plan is a single JSON file, `out/plan.json`, containing shots, transitions with their reasons, the SFX cue sheet and the lint results. The same plan drives the picture, the sound and the checks.

| genre | folder | engine | run | demo (measured from the delivered file) |
|---|---|---|---|---|
| Ad 15 s / 30 s (hook, problem, product, proof, CTA) | `ad/` | HyperFrames 0.8.142 | `node make.mjs [--set length=30]` then `hyperframes render . -o out/ad-15.mp4` | `out/ad-15.mp4` -14.1 LUFS / -1.9 dBTP with whip, push and dip-to-black through the DOM back-end (re-rendered 2026-10-13, CRF 23, 2.2 MB); `out/ad-30.mp4` -15.0 / -1.7 (older render, hard cuts; HyperFrames lowered the 30 s track 1 dB) |
| Animated short-film scene (establishing, action, reaction, payoff) | `film-scene/` | three.js (objects kit) | `../_shared/render3d.sh film-scene scene.html wide` | `out/film-scene-wide.mp4` 8.2 s, -17.5 LUFS / -2.0 dBTP (room tone + SFX, no score; sound-first) |
| mime-style character spot 16 s (white world, one gag, one feature, end line, sting) | `character-spot/` | three.js (objects kit) | `../_shared/render3d.sh character-spot scene.html wide` | `out/character-spot-wide.mp4` -14.2 LUFS / -1.7 dBTP |
| Talking-head / human edit (input MP4 + words.json: jump cuts, captions, B-roll, punch-ins, lower third) | `talking-head/` | HyperFrames | `node make.mjs [--set input=/abs/talk.mp4]` then render | `out/talking-head.mp4` 9:16, 6.5 s (input audio + SFX stem; no master pass) |
| Music / beat edit (cuts from a BPM) | `beat-edit/` | HyperFrames | `node make.mjs [--set bpm=128]` then render | `out/beat-edit.mp4` 12 s at 120 BPM (15 f/beat), flash on section changes + scalePunch on the drop cuts, -14.8 LUFS / -1.6 dBTP |
| Type + layout parts demo (sentence-led product film: collage, word wheel, inline media, mosaic, orbit, marquee, connector tags, cursor-to-mark end card) | `demo-type-layout/` | HyperFrames | `node make.mjs` then `hyperframes render . -o out/demo-type-layout.mp4 --crf 23` | 17.5 s, 120 BPM, -14.2 LUFS / -1.6 dBTP decoded (rendered 2026-10-14, CRF 23, 1.9 MB; the MP4 is not committed, rebuild it) |

Run the three.js templates before `beat-edit` and `talking-head`, because those two use the 3D renders as their footage.

## How a template wires the other modules (by id only, never copied)

| convention | resolved by | what happens if the module has not shipped it |
|---|---|---|
| `transitions/<name>` (key, kebab form, alias, or grammar id: `cut`, `smash`, `dip-to-black`, `crossfade`, ...) | **wired**: `_shared/txplan.mjs` turns each windowed cut into an overlap window (`txWindow` from `transitions/lib/tx-core.js`, swap on the exact cut frame, clamped to half of each neighbouring shot) and stretches the outgoing/incoming clips with `span()`; `_shared/adapters/transitions.mjs` registers every DOM-capable id and drives `transitions/lib/tx-dom.js applyDom` from one GSAP proxy per window. `out/tx.json` lists the windows. | `cut`/`smash` = deliberate hard cut. GL-only keys (glitch, ink, filmBurn, lightLeak, morph, zoomThrough, pagePeel, pixelSort, maskReveal) hard-cut in DOM templates and are logged as `transitions todo` (use `transitions/lib/tx-gl.js` with canvas sources). Unknown id -> hard cut + `tools/check_ids.py` fails. |
| `type/<presetId>` | **wired**: `_shared/adapters/type.mjs` registers every preset in `type/presets.js` (`scaleSlam`, `maskRise`, `elasticPop`, `blurIn`, `wipe`, ...) through `type/dom.js` mountType + bakeType | unknown id -> plain 6-frame fade-up. Captions still use the built-in karaoke highlight (TODO: `type/captions.js` adapter) |
| `layers/<kind>` | `motion-pack/layers/overlay.js` (`mountStack` + `bindHF`), copied into assets | none (**wired and working**: vignette + grain in every DOM demo) |
| `sfx/<cat>/<name>` | `_shared/audio.py` maps to `snd.<cat>.<name>` in `motion-pack/sfx/mpaudio` (188 sounds) | id listed under `todo` in `mix.wav.json` and never faked |
| `music/<bed id>` | `_shared/audio.py` hands bed + cues to `motion-pack/music/mixer.py` (over-bed levels, TP limiter, AAC probe, -14 LUFS) | SFX-only mix placed by `audio.py` (anchor on frame + 1, TP ceiling) |
| `objects/<name>` | `objects/index.js` `create()` (three.js templates symlink `objects/` and `_shared/`) | n/a |

## Lint (in `cues.mjs`, results written into `plan.json`)

- **`lint.proof`:** every claim that contains a digit needs a `source`. There are no fabricated stats. The ad demo uses copy with no numbers.
- **Transitions:** any transition other than a hard cut needs a `txReason`, written as a Murch reason.
- **`lint.pace`:** checks ASL and the longest shot. Shots marked `hold: true`, such as the hero reveal and the end card, are exempt from the longest-shot check.
- **Ad brand cue:** the ad also reports `brandCueAt` against the platform's `brandCueBy`.

## Shared files

| file | job |
|---|---|
| `_shared/plan.mjs` | pure helpers: `PLATFORMS` (safe zones, brand-cue deadline, loudness), `beatGrid` (BPM snapped to whole frames: 128 -> 128.57, 110 -> 112.5), `sequence` (frame-exact, no drift), `TX_SFX` (transition -> paired sound), `chunkCaptions`, `autocut`, `remap` |
| `_shared/pack.mjs` | browser glue `MP` (register / transition / type / layer, with logged fallbacks) |
| `_shared/compose.mjs` | stage a HyperFrames project: fonts, media and other modules are hard-linked into `assets/` |
| `_shared/cues.mjs` | `node cues.mjs <dir> [--set k=v]` exports the plan without a browser |
| `_shared/audio.py` | plan -> mix (music mixer when a bed is set; `--stem` for a stem that sits under dialogue) |
| `_shared/render3d.sh` | three.js template end to end: plan, GPU render, mix, mux, contact sheet, loudness (`AUDIO_ONLY=1` remuxes sound only) |
| `_shared/sheet.py` | contact sheet decoded from the delivered MP4, plus LUFS and TP of its audio |

## Demo honesty

- **Placeholder content:** "Orbit" is a fictional placeholder brand, and every line of copy is placeholder.
- **Talking-head input:** the demo input is our own film-scene render, and its transcript (`words.json`) is hand-timed placeholder text. It proves the mechanics (autocut, captions, B-roll, punch-in, lower third). It is not a real voice edit.
- **Mime-style spots:** we borrow the edit grammar only (docs/research/edit.md section 10). The character is our original worker.
