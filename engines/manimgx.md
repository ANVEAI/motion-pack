# ManimGX (github.com/academa-labs/manimgx): outside engine, tested 13 Oct 2026

ManimGX is an outside engine and is **not included in this repo**. The pack can hand off to it as the **explainer / diagram / data-viz / math-3D engine**: ManimGX renders a plate, HyperFrames adds type, overlays and sound. Verdict after testing: useful.

## What it is
A Manim-Community-Edition-compatible animation engine for agents: Python scenes (`import manimgx as m`), Rust + wgpu renderer (Metal on macOS), Typst typesetting (so no LaTeX install), x264 MP4 out. **v0.1.1** (PyPI, 7 Oct 2026, pre-1.0, Academa; about 900 stars, 185 commits when checked). Python 3.13 or newer. Extras we did not use: `self.say()` voice-over, `present` slides, a browser (Pyodide + WebGPU) mode.

Install footprint in our test: an isolated venv of 156 MB (wheel 23.8 MB).

## Where it sits in the pack
| Need | Engine |
|---|---|
| Diagrams, architecture, flows, equations, plots, counters, bars, node graphs, 2D camera zoom, math 3D, simple lit abstract 3D | **ManimGX** |
| Type, captions, kinetic text, UI-style motion, overlays, timeline, sound mix | HyperFrames (and the pack's `layers`, `cut`, `tx`, `cap`) |
| Product or stylised 3D with models | three.js studio kit |
| Photoreal hero shots | Blender |

Pipeline: `scene.py` (+ a brand module with the palette and fonts) → plate render → plate MP4 and stills → HyperFrames composition (plate track, type overlays, measured sound). Plates are **opaque and silent by default**; a transparent plate is one extra encode (see "Transparent plates" below). The wrapper scripts used in these tests are not part of this repo.

## What we tested (Apple M3 Pro, engine render time unless noted)
| Scene | Output | Length | Time | Size |
|---|---|---|---|---|
| a: Text, `MathTex`, `MathTypst`, Transform | 1080p60 / 720p30 | 5.2 s | 1.5 s / 0.5 s | 0.13 / 0.06 MB |
| b: 3D surface, axes, cube, orbiting then moving camera | 1080p60 / 720p30 | 7.8 s | 6.5 s / 1.5 s | 2.0 / 1.0 MB |
| c: architecture explainer (zone, devices, box, arrows, pulses, crossed-out cloud) | 1080p30 / 1080p60 | 9.8 s | 0.7 s / 1.1 s | 0.24 / 0.32 MB |
| d: brand counter, bars, `add_sound` | 1080p30 (also 1080x1920) | 3.2 s | 0.6 s / 0.5 s | 0.14 / 0.12 MB |
| e: `Axes.plot`, `DiGraph`, 2D camera zoom | inspect and storyboards only | 2 to 3 s each | n/a | n/a |
| f: PBR-lit 3D (`Material`, `SunLight`, shadows) | 1080p30 | 2.5 s | 1.2 s | 0.3 MB |
| c as VP9-alpha WebM | 1080p30 | 9.8 s | 21 s (VP9 encode) | 0.77 MB |
| c plate + type overlay + audio through HyperFrames 0.8.142 | 1080p30 | 9.8 s | 13 to 14 s | 0.9 to 1.0 MB |

Observations: the explainer scene c renders 9 to 14 times faster than real time at 1080p (60 and 30 fps), the denser text-and-maths scene a about 3.5 times at 1080p60, and 3D about 1.2 times at 1080p60. Three renders of the same scene were **bit-identical** (same file hash and same decoded-frame hash), and the docs say frame k samples exactly k/fps, so scenes behave as pure functions of time, like the rest of the pack. The vendor's own speed claims (90 times faster than Manim CE) were not tested here.

## Component ideas (names follow the pack's namespacing; defaults are [H] house defaults, tune by eye)
Verified = built and rendered in our tests. Idea = not built.

| Component | Story job | Params (defaults [H]) | Status |
|---|---|---|---|
| `mgx.arch` | "How it works" architecture: a zone, device nodes, a hero node, arrows | `nodes[]`, `edges[]`, `zone{label}`, `hero`, `negate[]`, `caption`; zone draw 1.1 s, nodes lag 0.35, arrows lag 0.3 over 0.8 s | Verified (scene c) |
| `mgx.flow` | Requests and responses that stay inside the zone | `rounds` 2, `lag_ratio` 0.3, `dur` 1.0 s, dot r 0.13 mint, ease in-out sine, fade 0.2 s | Verified |
| `mgx.negate` | "Not this": cross out an outside thing | amber cross, width 14, 1.05 scale, cross 0.5 s, dim fill to 0.35 and stroke to 0.45 over 0.7 s | Verified |
| `mgx.counter` | Number that counts up in brand type | `from`, `to`, `decimals`, `unit`, ease out cubic, `dur` 2.0 s; text rebuilt per frame | Verified |
| `mgx.bars` | Compare 3 to 6 values | primitive bars with `GrowFromEdge`, lag 0.2, brand labels; real, sourced values only | Verified |
| `mgx.curve` | A function or trend with a shaded region | `Axes.plot`, area opacity 0.25, draw 1.4 s | Verified |
| `mgx.graph` | Topology of systems (who talks to whom) | `DiGraph` with explicit layout dict, node radius 0.55, recolour one node to flag it | Verified |
| `mgx.zoom` | Detail shot inside a diagram, then pull back | `camera.frame` scale 0.4 in 1.5 s, hold 0.3 s, scale 2.5 out in 1.2 s | Verified |
| `mgx.equation` | A formula reveal with a highlight box | `MathTex` or `MathTypst`, `Write` 1.0 s, box 0.6 s | Verified |
| `mgx.orbit3d` | Abstract 3D: surface and axes, orbit then move camera | ambient rate 0.35, `move_camera` 2.0 s | Verified |
| `mgx.lit3d` | Stylised lit still-life with shadows | `Material` roughness 0.3, metal 0.7/0.25, one `SunLight` plus ambient 0.2; `fill_opacity=1` | Verified, not photoreal |
| `mgx.plate` | The output contract | CFR, tags preserved, three stills, optional alpha WebM or MOV | Verified (with wrapper scripts not included here) |
| `mgx.spec` | Drive scenes from JSON (like the JSON generator of an office-comedy series) | spec to scene builder so the planner never edits Python | Idea |
| `lint.mgx.claims` | Honesty gate for scene files | fail on numerals not in a sourced manifest, on `say(`, on non-palette colours, on default yellow emphasis, on demo markers | Idea |

## Rules for using it in the pack
- **Palette and type**: paper `#f5f2ea`, ink `#111111`, violet `#4a18ed`, amber `#ffa64d`, mint `#34d399`; Manrope (600 and 800) and IBM Plex Mono via `font_paths`. A missing font silently becomes a serif, so look at stills. Keep palette and fonts in one brand module that every scene imports.
- **No voice from `self.say()`**: it sends the script to a hosted text-to-speech model through fal.ai with `FAL_KEY` and caches audio next to the scene. Our scripts stay local; mix voice and music in HyperFrames as separate `<audio id>` lanes.
- **Hand-off to HyperFrames** (verified): plate as a muted `<video>` sibling under the type overlay; render with `--video-frame-format png` (PSNR 49.5 dB versus 45.3 dB for auto); `data-no-timeline` on a static root; plate and composition share size and fps.
- **Transparent plates**: VP9-alpha WebM and ProRes 4444 both worked in HyperFrames. Engine pixels are premultiplied, so the alpha encode has to account for that.
- **Timebase**: 30 fps primary; 60 only for fast motion; tall shorts render with `-r 1080x1920` but layouts must be restacked by hand.
- **Plates are not edited in an NLE without CFR**: static holds are stored as one long frame, so native files are variable frame rate. Normalise to constant frame rate before editing.
- **Margins and room**: keep 0.6 units clear of the frame edge and leave space for HyperFrames type; never set the same words in plate and overlay.
- **No invented numbers**: demo values in scene templates must be marked and replaced by sourced figures.

## Risks and licence
- Young project (v0.1.x): the API may drift; pin the version and keep a few reference scenes as the regression test.
- Native Rust binary (about 54 MB) cannot be audited here. No telemetry found in the Python source or in URL strings of the native library; the only network code is the optional fal.ai voice. Our test install used PyPI wheels only (`--only-binary :all:`), an isolated venv, nothing global, no shell-profile changes.
- Licence (not legal advice): code MIT; the native wheels bundle x264 and are stated to be **GPL-3.0-or-later as a whole**; FFmpeg LGPL-2.1-or-later; bundled fonts OFL and similar. Rendering our own videos is fine. Do not redistribute the venv or wheel, embed it in a shipped product, or copy its source into proprietary code without a licence review.
- Not verified: `say()`, `present`, `preview`, browser mode, `Table`, `Code`, `SVGMobject` and `ImageMobject` (logo import would be the next test), Linux or Windows.
