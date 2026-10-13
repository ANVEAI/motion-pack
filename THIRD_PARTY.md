# Third-party software, fonts and sources

motion-pack vendors no third-party library, media or icon set. Its own code is MIT (`LICENSE`), its own generated media is
CC0 (`LICENSE-MEDIA`). This file lists everything else the pack touches, and how.

## 1. Bundled in the repository

| item | where | licence | notes |
|---|---|---|---|
| Manrope 4.505 (variable) | `objects/kit/fonts/`, `templates/_shared/fonts/` | SIL OFL 1.1 | Copyright 2019 The Manrope Project Authors. Licence text: `OFL-Manrope.txt` next to the font. Unmodified. |
| IBM Plex Mono 2.3 (Medium, SemiBold) | same folders | SIL OFL 1.1 | Copyright 2017 IBM Corp., Reserved Font Name "Plex". Licence text: `OFL-IBMPlexMono.txt`. Unmodified. |

## 2. Loaded at use time (never vendored)

| item | how it is loaded | licence |
|---|---|---|
| GSAP 3.14.2 | `https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js` in the HyperFrames template head; tests take it from `node_modules/gsap` or `GSAP_JS` | GSAP Standard "no charge" licence (https://gsap.com/standard-license), not an OSI licence. The pack only references it; check the terms for your own use. |
| three.js 0.160.0 | jsDelivr import map in the three.js pages (`objects/`, `camera/demo/`, three.js templates); tests use `node_modules/three` or `THREE_DIR` | MIT |
| HyperFrames 0.8.142 | `npx --yes hyperframes@0.8.142 ...` | Apache-2.0 |
| puppeteer-core (optional, tests and `tools/render.mjs`) | `node_modules` or the npx cache, see `tools/chrome.mjs` | Apache-2.0 |
| Google Chrome / Chromium | the user's install | vendor terms |
| ffmpeg | the user's install | LGPL-2.1+ or GPL, depending on the build |
| numpy, scipy, numba, soundfile (with libsndfile), Pillow, matplotlib, pytest | `pip install -r requirements.txt` | BSD-3-Clause, BSD-3-Clause, BSD-2-Clause, BSD-3-Clause (libsndfile LGPL-2.1), MIT-CMU, matplotlib licence (PSF-style), MIT |
| Blender 5.2.x (optional, `blender/`) | the user's install; the scripts run inside it (`blender -b --factory-startup -P blender/run.py`) | GNU GPL (Blender's own licence). The `blender/` scripts import Blender's Python API and are MIT (GPL-compatible), see `blender/LICENSE`; renders are CC0 media |
| fontTools (optional, `blender/` 3D title) | the user's Python, to cut a static weight from the variable font at run time (never redistributed) | MIT |
| Rapier, `@dimforge/rapier3d-compat` 0.21.0 (optional, `physics/`) | `cd physics && npm install` (pinned in `physics/package-lock.json`); build time only, never loaded by a page | Apache-2.0 |
| SVGO 4.1.0 (optional) | `npx svgo@4.1.0 --config scripts/svgo.config.mjs ...` to clean fetched icon sets | MIT |
| cbirds @ `fe6f9f183cd5548c9403d0859ce49856850229ed` (1.7.0) (optional, `terminal/`) | `terminal/fetch-cbirds.sh` downloads the GitHub source tarball (SHA-256 pinned), builds it locally with `make cbirds`; build time only, never vendored or shipped | MIT, Copyright (c) 2025 clainstone@icloud.com (licence text in the fetched source). The default `--shape bird` renders cbirds' own bird drawing; the pack's recipes use `--shape arrow` (drawn in code) |

## 3. Formulae and ideas (re-implemented, no code or data copied)

| source | used for | licence of the source |
|---|---|---|
| GL Transitions (https://github.com/gl-transitions/gl-transitions) | the two-inputs-plus-progress interface and the effect ideas of 24 transitions. Our GLSL is written from scratch; each entry's `credit` field in `transitions/catalog.json` names the original idea and author as courtesy attribution. | MIT (two files BSD) |
| ARRI LogC3 (EI 800), Sony S-Log3 / S-Gamut3.Cine, Panasonic V-Log / V-Gamut | log decode curves and gamut matrices in `layers/tools/log_cubes.py` (`layers/looks/log.*-to-709.cube`), typed from the makers' published white papers. No maker LUT file was read or converted. | published formulae; the names are trademarks of their owners, used to say which camera log the cube expects |
| Khronos PBR Neutral tone mapper | the tone map in `log_cubes.py` (`neutral.rolloff-709.cube`), re-implemented from the published description | Apache-2.0 reference implementation (KhronosGroup/ToneMapping) |
| ITU-R BS.1770-4, EBU R128 | K-weighting coefficients and gating in `sfx/mpaudio/meter.py` | standards documents |
| Walter Murch, edit-grammar and platform research | the rules, thresholds and checklists cited in `docs/research/` | cited sources; every claim carries a source and a confidence tag |

## 4. Optional sets fetched by `scripts/fetch-external.sh` (never committed)

The script downloads each set from its original source at a pinned version into `external/` (gitignored), verifies every file
against `scripts/external.lock`, and writes an `ORIGIN.txt`. Imported audio is tagged `source:ext` and `licence:<id>` and stays
in `sfx/library_ext/` (gitignored).

| set | source (pinned) | licence |
|---|---|---|
| Lucide icon subset (111 SVG) | github.com/lucide-icons/lucide @ `3f1255ecfa1b5b3a231e4aeb027781761204e187` | ISC; the Feather-derived icons MIT (Cole Bemis). See the set's `LICENSE`. |
| Phosphor icon subset (108 SVG, regular) | github.com/phosphor-icons/core @ `2b75f3ad12b420c9504ef05df8d2564a28f8500e` | MIT, Copyright (c) 2023 Phosphor Icons |
| Fluent Emoji subset (279 Flat SVG + 279 3D PNG) | github.com/microsoft/fluentui-emoji @ `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` | MIT, Copyright (c) Microsoft Corporation. A few emoji are excluded upstream for trademark reasons. |
| Kenney audio: Interface Sounds, Impact Sounds, UI Audio, Digital Audio, Sci-fi Sounds, RPG Audio, Music Jingles | kenney.nl/assets/... (zip SHA-256 pinned) | CC0 1.0 (attribution not required; do not use the Kenney logo) |
| OwlishMedia Sound Effects Pack | opengameart.org/content/sound-effects-pack (zip SHA-256 pinned) | CC0 1.0 |

Run `scripts/fetch-external.sh --list` for the exact URLs. Optional, for the icon sets: clean them for draw-on animation with
`npx svgo@4.1.0 --config scripts/svgo.config.mjs -r -f external/<set>/svg -o external/<set>/optimized` (for Fluent Emoji the SVGs
are in `external/fluentui-emoji/flat`). The config keeps one drawable element per stroke; see its header for the measurements.
Category names used when importing audio:
`kenney_interface`, `kenney_ui`, `kenney_digital`, `kenney_impact`, `kenney_scifi`, `kenney_rpg`, `kenney_jingles`, `owlish_foley`.

## 5. Trademarks

Platform, product and camera-maker names in the docs describe compatibility or cite sources; see `TRADEMARKS.md`. The pack
ships no third-party logo.
