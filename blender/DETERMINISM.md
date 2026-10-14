# Determinism: what is bit-exact and what is not

These results were measured on 13 Oct 2026 with Blender 5.2.2 LTS (d13f752e3b9c) on an Apple M3 Pro using Metal (GPU, 14 cores). Frames were 960x540. Run the test with `bash blender/tests/determinism.sh`; raw rows are in `tests/out/determinism.json`.

Each case renders frame F in two ways:

- **Cross-process:** in two separate Blender processes.
- **Same process:** in one process, F is rendered, then a different frame, then F again (`run.py --determinism F`).

Comparisons use decoded pixels. PNG metadata stamps are off, so equal pixels also mean equal file hashes.

| case | cross-process | same process | verdict |
|---|---|---|---|
| EEVEE `turntable` (f90, 32 samples, motion blur on) | equal | equal | **bit-exact** |
| EEVEE `art.voxelWave` (f30, Geometry Nodes instances) | equal | equal | **bit-exact** |
| EEVEE `art.liquidChrome` loop seam (frame 120 vs 0, same process, 1080p) | n/a | equal (file hash) | **bit-exact** |
| EEVEE `title3d` (f100) | max 3/255 on 0.52 % of px, PSNR 70.9 dB | max 2/255 on 0.37 % of px, PSNR 72.4 dB | **not bit-exact** (see below) |
| EEVEE `art.voxelWave` loop seam (frame 120 vs 0, 1080p) | n/a | max 1/255 on one pixel, PSNR 111 to 117 dB | near-exact |
| Cycles GPU, OIDN on CPU (default) (`turntable` f90, 128 samples) | max 1/255 on 0.0017 % of px (about 9 px), PSNR 95.7 dB | max 1/255, PSNR 96.3 dB | **not bit-exact**, visually identical |
| Cycles GPU, OIDN on GPU (`--denoise-gpu`) | max 2/255 on 0.48 % of px, PSNR 71.3 dB | max 1/255 on 0.45 %, PSNR 71.6 dB | **not bit-exact** |
| EEVEE `title3d` without the halo card (`--param glow=0`) | max 2/255 on 0.35 % of px, PSNR 72.7 dB | max 2/255 on 0.27 %, PSNR 73.8 dB | **not bit-exact** |
| Cycles GPU, no denoiser (`--no-denoise`) | max 1/255 on 1 pixel, PSNR 111.3 dB | max 1/255, PSNR 111.3 dB | **not bit-exact** (path tracing itself) |

## What makes the module repeatable

- Every animated value is keyed per whole frame from a pure `frame(f)`. Frames -1 to N are keyed, so frame N is the loop seam.
- No drivers, no `#frame` expressions, no unseeded randomness: every random choice is `random.Random(seed)`, and the seed goes into `render.json`.
- Art loops without motion blur key the wrapped phase `(f mod N) / N`, so frame N holds exactly frame 0's values. A CPU check confirmed 0 differing f-curve values over 117 curves.
- PNG stamps are off. Blender writes Date, Time and RenderTime into PNG metadata by default, so identical pixels hashed differently in the first probe.
- Cycles: a fixed seed, `use_animated_seed` off, and no time limit (a wall-clock limit changes the sample count between runs).

## What is not bit-exact, and why (as far as measured)

- **EEVEE `title3d`: cause not isolated.** The title is the only measured EEVEE recipe that drifts: up to 3/255 on 0.5 % of pixels, PSNR about 71 dB, both across processes and within one process.
  - It is **not** the alpha-blended halo card: with `glow=0` it still drifts (72.7 dB).
  - Candidates I did not have time to separate: the chrome letters raytraced in the polished floor (screen-space tracing with temporal and bilateral denoise), the reflection-dome world, and the title's light-linked strips. The turntable uses the same floor and render settings and is bit-exact, so the chrome and dome pairing is the main suspect.
- **EEVEE across renders in one process.** The voxel seam differed by 1/255 on one pixel while every animated value was identical. Some renderer state carries over between renders in one process, probably cached virtual shadow-map pages. It is invisible, but it is not bit-exact.
- **Cycles on the CPU, measured on 14 Oct 2026 (Blender 5.2.2, `blender/cableTangle` frame 48, 854x480, 16 samples, OIDN on the CPU):** two separate processes gave the same PNG file hash, and one process (frame 48, another frame, frame 48 again) gave identical pixels and the same hash. Before the fix described below the pixels were equal but the file hashes were not.
  - **Cause of the hash difference:** Cycles writes `cycles.ViewLayer.total_time`, `render_time` and `synchronization_time` into every PNG as tEXt chunks, whatever the stamp settings. `run.py` now removes every `cycles.*_time` chunk after each render (`lib/util.py` `strip_png_timing`); the pixel data is untouched.
  - Only cableTangle was measured on the CPU; do not assume it for the other recipes.
- **Cycles on the GPU (Metal) is never bit-exact on the full scene.**
  - With no denoiser, 1 pixel in 518,400 differs by 1/255 (PSNR 111 dB), so GPU path tracing itself drifts slightly. A simple 64-sample probe scene was bit-exact.
  - CPU OIDN spreads that to about 9 pixels (96 dB).
  - GPU OIDN gives 0.48 % of pixels at up to 2/255 (71 dB).
  - For hash-level Cycles reproducibility, render on the CPU (`--device cpu`); measured for cableTangle only (above).

Practical meaning: every plate re-renders **visually** identically. The worst measured case is about 71 dB with at most 3/255 on 0.5 % of pixels, which cannot be seen.

Where a **hash-level** match is required (regression tests, splicing a partial re-render into a finished plate), use these EEVEE recipes:
- `turntable`, `macroSweep` and `explode`: the same rig as the bit-exact turntable, not separately measured.
- `art.voxelWave`: bit-exact.
- `art.liquidChrome`: its seam is bit-exact.

Splice the title only at a cut. Cycles GPU is never hash-exact.
