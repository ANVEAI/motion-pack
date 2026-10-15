# Testing: what CI covers and what it cannot

CI (`.github/workflows/ci.yml`) runs on a hosted x86-64 Linux runner with Python 3.11, Node 22 and ffmpeg. It has **no GPU, no Chrome session, no Blender and no network installs beyond `requirements.txt`**. Everything below the "local only" line has to be run by hand on a machine with a hardware GPU before a visual change is merged.

## What CI runs

| area | what is checked | step / file |
|---|---|---|
| ids | every cross-module id (`sfx/…`, `music/…`, `transitions/…`, `type/…`, `blender/…`) resolves | `tools/check_ids.py` |
| sound library | all 301 sounds are rebuilt from the recipes; every measured manifest field (anchors, peaks, loudness, durations) must equal the commit; QA on every sound | `sfx/build_library.py`, `tools/check_generated.py --ignore-field sha sfx/manifest.json`, `sfx/qa.py` |
| music library | all 65 beds, stingers and logos are rebuilt; the manifest must equal the commit byte for byte; QA on every item (python vs ffmpeg loudness) | `music/build_music.py`, `tools/check_generated.py music/manifest.json`, `music/qa.py` |
| generated manifests | layers / type / camera manifests equal what `make-manifests.mjs` writes | `tools/check_generated.py` |
| python | cuts, sfx, music, tools, cloud (dry-run paths), the peak anchor under float noise, Blender recipes imported with stand-in `bpy` and compared with `blender/manifest.json` | `pytest` step |
| listening | `ears` on synthetic signals | `ears/tests` |
| storyboard | sheets are deterministic (same PNG hash twice and in two processes), one panel per shot, safe-zone and reading-speed warnings fire, the lint gate refuses, the animatic has exactly the shot-sum frames and samples and decodes to -14 LUFS / <= -1.0 dBTP, honesty labels are drawn; every test is proved on a mutation | `storyboard/tests`, `tools/mutation_check.py storyboard/tests/*.mutants.json` |
| looking | `eyes` on synthetic x264 clips (flash rates and area, red flash, banding with and without grain, safe zones, text size / time / contrast, pacing, bars, encode); every check is proved to fail when its code is broken | `eyes/tests`, `eyes/tests/*.mutants.json` |
| transitions | timing maths, registry schema and shader uniforms (lint), every id and alias resolves to a back-end that can play it, every GL-only id has a DOM approximation | `core.test.mjs`, `tools/lint.mjs`, `tests/backends.test.mjs` |
| camera | all 2D / 3D preset maths; baked and driven paths agree for any `t0` | `camera.test.mjs` |
| type and gfx | every gfx id, UI kit, round-3 / 4+5 parts as SVG strings in node; type presets and captions on a fake timeline; def ids never collide between two items in one host | `type/tests/*.test.mjs` |
| layers | the Canvas2D kinds (round 4/5 and brandField) on a recording 2D context | `layers/tests/r45.test.mjs` |
| robustness | every gfx id, Canvas2D layer kind and background with 0, -1, NaN, Infinity, 1e9 and 1e-6 on every numeric default: no hang, no out-of-memory, no throw | `tools/tests/fuzz-params.test.mjs` |
| determinism | all node-renderable parts (gfx, Canvas2D kinds, backgrounds, camera presets, type presets, caption styles) hash the same in two fresh processes with different call histories; no `Math.random` / `Date.now` / `performance.now` in part code | `tools/tests/xproc-hash.test.mjs`, `tools/tests/test_no_clock.py` |
| templates | every template with a `config.mjs` (10) builds its plan without a browser, passes the claim / transition / pace lints, and equals its committed `out/plan.json`; the proof-film honesty gate | `tools/tests/template-plans.test.mjs`, `proof-film.test.mjs` |
| renders, prerequisites | `render3d.sh` stops with the install line when puppeteer-core is missing | `tools/tests/test_render3d_prereq.py` |
| suites | every browser suite is listed in `layers/tests/run-all.sh`, every node-only suite is a CI step | `tools/tests/test_suites_listed.py` |
| docs and site | README counts are current; every catalog media link resolves | `tools/count.py --check`, `tools/pages_site.py` |

## Local only (GPU, Chrome or Blender), not run by CI

| what | how to run | why not in CI |
|---|---|---|
| WebGL layers: Finisher, overlays, looks, grades, the GL overlay kinds (`layers/overlay.js` KINDS, `fx2.js`) | `bash layers/tests/run-all.sh` (needs `npm i --no-save puppeteer-core gsap@3.14.2 three@0.160.0` in the repo root) | hardware WebGL; software GL is refused |
| DOM transitions in a real page (26 back-ends + 23 approximations, endpoints pixel-exact) and GL transition shaders | `node transitions/tests/dom-sheet.mjs` (in run-all), GL renders via `transitions/tools/` | Chrome / WebGL |
| kinetic type presets in the DOM, cards, gfx contact sheets, camera 2D / 3D pages, the `--chrome` modes of r45 and r45type | `bash layers/tests/run-all.sh` | Chrome |
| three.js objects, kit and the 3D templates (film-scene, character-spot) | `templates/_shared/render3d.sh <dir> scene.html wide` | GPU render |
| HyperFrames renders of the DOM templates and demos (`demo-*` pages are built by `make.mjs` together with their mix and media) | `node templates/<name>/make.mjs` then `hyperframes render` | Chrome render, staged media |
| Blender renders | `bash blender/tests/smoke.sh`, `blender/tests/determinism.sh` | Blender 5.2.x |
| physics bake | `cd physics && npm install && node bake.mjs …` | npm install (CI checks only the player against the committed table) |
| terminal (cbirds) bake | `bash terminal/tests/smoke.sh` | fetches and builds cbirds |
| any page is seek-safe | `node skills/motion-stack/scripts/seekcheck.mjs page.html` | Chrome |

## Known limits of what CI proves

- **Sound shas are per platform.** x86-64 Linux synthesises 248 of the 301 sounds one 24-bit LSB apart from arm64 macOS (-138 dBFS) with the same pinned packages, so CI compares every manifest field except `sha`. The committed shas are the arm64 macOS build.
- **The cross-process gate is a net, not a proof.** It catches state hidden by a module-level cache and call counters within about 9x the set's own call volume; a counter with a larger threshold, or nondeterminism that only shows in a browser, needs the browser suites.
- **Node renders are not pixels.** gfx parts are compared as SVG strings and Canvas2D kinds as recorded draw calls; text measurement in node is an estimate. Pixel identity is checked by the browser suites only.
