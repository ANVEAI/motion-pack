# Lane e-terminal: Terminal and ASCII (cbirds)

**Tested 14 Oct 2026** on the bake-off machine (Apple M3 Pro, macOS 26.4, Apple clang 21.0.0, ffmpeg 8.0.1, HyperFrames 0.8.142, Node 25.9.0).

**Target:** [clainstone/cbirds](https://github.com/clainstone/cbirds), Craig Reynolds' boids in a terminal (MIT, C99, no dependencies).
- **Commit:** `fe6f9f183cd5548c9403d0859ce49856850229ed`, master at test time (2026-10-12, "README: the panel in one sentence"; `cbirds 1.7.0`).
- **Source tarball:** `https://github.com/clainstone/cbirds/archive/fe6f9f1….tar.gz`, 28,189,233 bytes, SHA-256 `593a371da5541c59cd076954fb9d83a313f36454c2e6b36e147f6ab81ab3b640`.
  - Two downloads were byte-identical.
  - The extracted tree is identical, file for file, to the reviewed clone.

**Verdict:** ADOPT-FOR terminal and flock b-roll plates and "flock writes a word" titles, **baked at build time** into a 30 fps MP4 that plays as a HyperFrames `<video>` layer. This is the same pattern as baked Rapier. The live terminal mode is rejected for video.

## Results

ms/frame:
- **E1–E6:** the whole `cbirds --record` process divided by its frames, best of 2 warm runs, at 1080x1920. This includes sprite build and GIF LZW encode.
- **E7:** the whole bake per plate frame: recording 417 simulated frames (117 skipped plus 300 kept), x264 `-preset slow` on one thread, and the PNG master. That is 37.5 s for a 10 s plate. Without `--png`, the encode measured 63 ms/frame (16:9 title bake). The HyperFrames render of the plate took 35 s for 300 frames (117 ms/frame, `-w 2`).
- Only compare within this lane.

| variant | what | G1/G2/G3/G4 | ms/frame | Q | verdict |
|---|---|---|---|---|---|
| E0-live-terminal | live mode in a pseudo-terminal, `--snapshot` | ✗/–/–/– | – | 2 | REJECT |
| E1-record-sprites | `--record` GIF, sprite birds | ✓/✗/✓/– | 17.5 | 4 | ADOPT-FOR flat-sprite flock plates, baked (E7) |
| E2-record-braille | `--record` GIF `--render braille` | ✓/✗/✓/– | 20.8 | 3 | ADOPT-FOR terminal-look b-roll, baked |
| E3-record-say | `--record` GIF `--say ORBIT` | ✓/✗/✓/– | 16.0 | 3 | ADOPT-FOR "flock writes a word" title stings, baked |
| E4-record-3d | `--record` GIF `--3d` (2000 birds) | ✓/✗/✓/– | 18.7 | 4 | ADOPT-FOR murmuration b-roll and transition plates, baked |
| E5-record-cast | `--record` `.cast` (asciinema) | ✓/✗/✓/– | 6.0 | – | REJECT |
| E6-record-text | `--record` GIF `--text FILE` (letters take flight) | ✓/✗/✓/– | 15.6 | 3 | ADOPT-FOR "code that flies" b-roll, baked |
| **E7-bake-plate-hyperframes** | `bake-plate.sh` → 30 fps H.264 → HyperFrames `<video>` | **✓/✓/✓/✓** | 125.1 | 4 | **ADOPT-FOR** plates and word titles, baked |
| E8-cross-build | `-O0`, `-ffp-contract=off`, x86_64 vs default build | ✓/–/✗/– | – | – | REJECT (diagnostic) |

The rows, with one-sentence reasons, are in [`../results.json`](../results.json) (lane `e-terminal`).

## Security review (before anything was built)

**Verdict: safe to build and to run `--record`.** Nothing phones home or downloads. With the options we use, nothing writes outside the output path we give it.

**Makefile.**
- `cbirds` and `test` are plain `$(CC)` compiles. There are no downloads, no shell-outs and no generated code.
- `install` writes `$(PREFIX)/bin` and was not run.
- `asset` runs a locally built `mkasset` to regenerate `sprite_png.h` from `matrix.png`. It was not needed and not run (the header is checked in).

**Grep over all `*.c`/`*.h`, `tests/` and `docs/rules.c`.**
- **Never found:** `system(`, `popen`, any `exec*`, `dlopen`/`dlsym`, `getaddrinfo`, `connect(`, `AF_INET`, `SOCK_STREAM`, `curl`/`wget`, and any `HOME`/config-file read.
- `fork` appears only in `tests/`.
- No URL is used in code.
- `getenv` reads only `COLORTERM`, `XDG_RUNTIME_DIR` and `TMPDIR`, plus the locale through `setlocale(LC_TIME, "")`.

**Sockets.**
- `link.c` binds **AF_UNIX datagram** sockets in `$XDG_RUNTIME_DIR/cbirds`, `$TMPDIR/cbirds-UID` or `/tmp/cbirds-UID`. The directory is created 0700, and cbirds refuses a directory it does not own or that others can write.
- It sends `kill(pid, 0)` liveness probes to other cbirds windows and unlinks stale sockets in that directory.
- All of this happens **only with `--link`** (`sky_join()` returns at once without it). cbirds itself refuses `--link` together with `--record` or `--bench`.

**Files.**
- **Written:** only the `--record` path (GIF or `.cast`) and the `--snapshot` path (PNG).
- **Read:** `--sprite`/`--picture` PNGs (4 MB cap), the `--text` file, stdin when it is not a TTY (text mode), and `/dev/tty` in live mode.
- Kitty graphics go **in band** (base64 PNG on stdout), with no temp files and no shared memory.
- The only `write()` calls go to stdout and the tty.

**Wall-clock reads.**
- The live loop steps on `CLOCK_MONOTONIC` and seeds from `time(NULL)` unless `--seed` is given.
- The `.cast` header carries `time(NULL)`.
- The `--clock` sign starts at `time(NULL)` unless `--clock-at` is given.
- The GIF recorder reads **no clock**:
  - it steps on `1/actual_fps`;
  - `clock_state.seconds = frame / actual_fps`;
  - the seed defaults to 1 when `--seed` is absent.

**Tests that write outside.** `tests/link_test.c` and `tests/boids_test.c` hard-code `/tmp/cbl.XXXXXX` and `/tmp/cbs.XXXXXX`, ignoring `$TMPDIR` because socket paths are limited to 104 bytes on macOS, and bind sockets there. **Both were not run.** The other 11 tests are file-free or honour `$TMPDIR`, and were run with `TMPDIR` inside the lane, which was empty afterwards.

**CI files.** `.github/` (brew tap, apt repo, release `.deb`) is not used by a source build and was not run.

**Provenance note.**
- The README credits Claude (Anthropic) with writing much of the code, tests and docs, under the author's direction.
- The project has a single maintainer.
- There are 239 commits since 2025-09-30, 81 of them since 2026-10-07. Re-review every pin bump.

## Build and tests

- **`make CC=clang cbirds`** (upstream flags `-std=c99 -Wall -Wextra -O3 -g`): 3.9 s, **0 warnings**, a 324 KB arm64 binary, `cbirds 1.7.0`.
- **Upstream CI flags** (`-O2 -g -Wpedantic -Wshadow -Werror`): 2.2 s, clean.
- **Pinned tarball build:** 2.8 s. The pack flags (`-O2 -ffp-contract=off`), `-O0` and x86_64 builds: 0.6–2.5 s each. All had 0 warnings.
- **Tests:** 11 of 13 built in 6.3 s and **all 11 pass** (kitty_graphics, options, png, gif, cells, spatial_grid, sign, picture, vt, letters, sky3d). `link_test` and `boids_test` were skipped (see above).

## Driving it non-interactively

- **Headless export:** `--record FILE.gif` needs no terminal. It runs the flock headless and writes the GIF with cbirds' own encoder, with a global palette taken from frame 0 plus reserved colours. Frames are opaque.
  - `--record FILE.cast` writes asciinema v2 instead.
  - `--snapshot` needs a live terminal.
- **Seed:** `--seed N`, from cbirds' own PRNG (not libc). Without it, `--record` uses seed 1.
- **Frames:**
  - `--record-seconds` takes an int, 1–120.
  - `--record-fps` is rounded to a whole-hundredths GIF delay, so 33 gives delay 3 (33.33 fps), 25 gives 25 and 50 gives 50. **30 fps does not exist in a GIF.** The `.cast` path steps at exactly `1/fps`.
- **Size:** `--record-size COLSxROWS`, 40x14 to 400x120 cells.
  - Sprite and braille cells are 8x16 px, so 135x120 = **1080x1920 exactly**, and 240x68 = 1920x1088 (crop 8 rows for 16:9).
  - Text cells are 12x20 px, so 90x96 = 1080x1920 and 160x54 = 1920x1080.
- **Look:**
  - `--color`: theme, ember, ice, acid, matrix, aurora, prism, potion, dusk, ash, ink. With no terminal, theme and ink fall back to fixed ramps.
  - `-n`, `-s`, `--shape bird|arrow|plane|dot`, `--sprite PNG`, `--hawks`, `--flocks`, `--speed`, `--trails`, `--depth`, `--matrix`, `--preset`, plus the sliders.
- **Ground:** the picture ground is a constant `(18,18,24)`.
- **Modes:**
  - flock;
  - `--3d`;
  - `--say TEXT`, `--clock` (`--clock-at HH:MM[:SS]` for repeatable runs), `--seconds`, `--picture PNG`;
  - `--matrix`;
  - `--text FILE` or a pipe;
  - `--depth`/`--trails`;
  - `--render braille|sextants|blocks`, which paints cells instead of sprites;
  - `--link` (live only).
- **Intro:** a plain flock (no sign, text or 3D) writes **"BOIDS" for its first 3 s**, and no flag skips it. The bake script trims it with `--skip 3.5`.
- **Slider drift:** after 60 s without a key, the sliders start moving themselves, on the virtual clock (deterministic).

## The gates, adapted to a CLI renderer

Commands are in `tools/gates.sh`, and the hashes and timings in `logs/gates.tsv`. stdin was `/dev/null`, because a non-TTY stdin is read as text.

- **G1 same twice: ✓ for all GIF modes.** Two warm runs of each of E1, E2, E3, E4 and E6 gave **byte-identical GIFs**, all at 1080x1920: 300 frames each for E1–E4 and 1133 for E6.
  - `.cast` frame lines are identical (body SHA-256 equal on 3 runs), but the header `timestamp` changes every run.
  - **The live terminal fails G1.** E0 ran three times in a PTY with `--seed 5 --frames 120` and gave three different snapshots, at 27.7 and 28.0 dB against run 1.
- **G2 any order: ✗ for the raw simulation.**
  - Frame N exists only after simulating frames 0..N-1, at about 17.5 ms each. There is no seek or start-frame option, because the flock is stateful.
  - It is **prefix-stable**: a 4 s take's 133 frames equal the first 133 frames of the 9 s take, decoded and compared bit for bit. So the length of a take never changes earlier frames.
  - **Baking fixes G2,** as with Rapier. The plate is indexed by frame, and a HyperFrames render with two workers (chunks out of order) matched it 300/300 (E7).
- **G3 cold = warm: ✓.** The never-run binary built from the pinned tarball produced, on its first run, the same SHA-256 as later warm runs of the clone build, for all five GIF modes. The `.cast` frame lines matched too; only its header timestamp differs.
- **G4 real render: ✓.**
  - **Bake:** `bake-plate.sh` (E1 look, the pack build) produced a 1080x1920 30 fps H.264 file: yuv420p, bt709 range, matrix, transfer and primaries, `moov` before `mdat`, exactly 300 frames.
    - Plate frame n is cbirds frame 117+n, checked bit-exact against the GIF at frames 0, 150 and 299.
    - **Two bakes gave byte-identical GIF and MP4** (`b4ef783d…`).
  - **Plate against its lossless PNG master:** 300/300 frame identity; PSNR 36.9 dB minimum, 38.4 dB mean. The loss is 4:2:0 chroma on small saturated sprites, at CRF 14.
  - **HyperFrames 0.8.142:** a comp with the plate as a framework-owned `<video>` layer was rendered with `--format png-sequence -w 2`, 300 frames in 35 s.
    - Against the plate decoded by ffmpeg: **identity 300/300** (no offset, no drop, no duplicate); PSNR 39.9 dB minimum, 41.6 dB mean.
    - The remaining difference is the decoder's YUV→RGB path, not timing.
    - Sheet: `sheets/g4-plate-vs-hyperframes.jpg`.

### Same flock everywhere? No (E8)

The simulation is chaotic, so every build is deterministic by itself, but different builds fly different flocks:

| build (same source, same command) | first frame that differs from the default `-O3` arm64 build (E1) | 3D (E4) |
|---|---|---|
| `-O3 -ffp-contract=off` (arm64, no FMA) | 50 (1.5 s) | 0 |
| `-O0` (arm64) | 158 | – |
| x86_64 `-O3` (Rosetta), with or without `-ffp-contract=off` (identical to each other) | 50 | 0 |

`-ffp-contract=off` alone does **not** make arm64 match x86_64, so something beyond FMA contraction differs, most likely libm or code generation.

The README's "`--seed` is the same flock on every system" holds for the random numbers, not for the floating-point flight.

**Rule for the pack:**
- Pin the build flags in the fetch script.
- Record the GIF and MP4 SHA-256 in the plate's `.json`.
- Treat the baked MP4 as the artifact, as baked physics tables are. Re-bakes match only on the same CPU architecture and toolchain.

## Quality (judged from 100% crops, `sheets/e-terminal-crops-100pct.jpg`)

- **E1 sprites (4):** crisp, anti-aliased, flat-shaded birds on a dark ground. The ice and prism ramps hold up at 1080p, and the palette (about 220 colours a frame) shows no visible banding. The red hawks lose a little chroma in 4:2:0.
  - It reads as clean "particle flock" tech b-roll.
  - A 9:16 frame needs about 900 birds at `-s 34` to fill.
- **E2 braille (3):** the one mode that looks like a real terminal (2x4-dot cells, 7 colours), and very on-brand for terminal b-roll. The fine dot pattern risks shimmer after platform re-encodes; that was not tested.
- **E3 say (3):** "ORBIT" forms within about 2 s, holds, and the rest of the flock orbits it. That works well for a sting or a transition into a title.
  - The strokes are birds, so it is a dot-matrix title, not typography.
  - At the default `--font-size` the word is about a third of a 16:9 width (34% in the demo). Use `--font-size 10` for bigger letters (not measured here).
- **E4 3D dusk (4):** the most cinematic: 2000 birds with depth falloff and a banking murmuration. It is the best for b-roll and full-frame transitions.
- **E6 text (3):** text at rest lifts off in a wave, flocks and lands back, which suits "code that flies".
  - A 5x7 bitmap font in 12x20 cells gives 90 columns at 1080 px wide, which is small on a phone.
  - A full cycle is 34 s.
- **On-brand?** Yes for tech and terminal b-roll and playful title stings. It is a stylised, flat look: no motion blur, no depth of field and opaque frames. **Pair it with `--ground black` and a screen blend** to lay it over footage. The ground-to-black mapping was verified to give `(0,0,0)`; the blend itself was not rendered here.

## Licence

- **MIT**, `Copyright (c) 2025 clainstone@icloud.com`.
- **Fetching at build time** (never vendored) needs no notice in our repo. A credit line in `THIRD_PARTY.md` and the module README is courteous and recommended.
- **Plates made with `--shape bird` (the default)** contain cbirds' own bird drawing (`matrix.png`, compiled in), and so do signs and hawks.
  - A rendered frame is program output, not a copy of the Software, so MIT's notice condition is not obviously triggered.
  - To keep the art 100% ours, use `--shape arrow|plane|dot` (triangles and dots drawn in code) or `--sprite <our.png>`.
- **The sheets in `sheets/` show cbirds output**, so they are not CC0: the MIT notice travels with them in `licenses/cbirds-MIT.txt` (`THIRD_PARTY.md` section 1b, `lab/provenance.json`).

## Recommended combination (exact versions)

- **cbirds:** commit `fe6f9f183cd5548c9403d0859ce49856850229ed` (1.7.0), tarball SHA-256 `593a371d…b3b640`, built with `make CC=cc CFLAGS="-O2 -ffp-contract=off" cbirds`.
- **Bake:** `terminal/bake-plate.sh`: GIF at `--record-fps 33` (delay 3), trim, `setpts=N/(30*TB)`, x264 `-preset slow -tune animation -crf 14 -threads 1`, yuv420p, bt709 tags through `setparams`, `+faststart`.
- **Comp:** HyperFrames 0.8.142, with the plate as a framework-owned `<video>`.
- **Finals:** the usual ffmpeg two-pass from `output-tools.md`.

## Adapter snippet

```bash
terminal/fetch-cbirds.sh                                     # once: external/cbirds/bin/cbirds
terminal/bake-plate.sh --out plates/flock.mp4 --seed 33 --skip 3.5 --ground black -- -n 900 -s 34 --color ice --hawks 2
```

```html
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="10" data-no-timeline>
  <video id="flock" src="plates/flock.mp4" muted playsinline data-start="0" data-duration="10" data-track-index="0"></video>
</div>
```

Never seek, play or pause the `<video>` yourself: HyperFrames owns it, and frame n of the comp is frame n of the plate.

## Gotchas

1. **Never screen-record cbirds in a terminal.** Live frames step on the wall clock (E0: 3 runs, 3 different frames).
2. **GIF delays are whole hundredths,** so a 30 fps recording does not exist. Record at 33 (delay 3, a 1/33.33 s step) and map frames 1:1 to 30 fps. The flock then plays at 0.9x cbirds' pace, with nothing dropped or doubled.
   - Do not let ffmpeg retime by the GIF's timestamps: that duplicates or drops frames.
3. **A plain flock writes "BOIDS" for 3 s first.** Use `--skip 3.5`, or a sign, text or 3D mode, which skip the intro.
4. **Piped or non-TTY stdin turns on text mode.** Always run with `< /dev/null` (the bake script does).
5. **`--clock` without `--clock-at`** shows the wall time at launch, so two bakes differ.
6. **A `.cast` header has `time(NULL)`,** so its bytes differ every run even though the frames do not.
7. **Builds fly different flocks** (E8). Pin CFLAGS, keep the MP4, and keep its SHA-256.
8. **ffmpeg 8 ignores `-color_trc` and `-color_primaries` here.** Set them with `setparams`, or the plate reports `unknown`.
9. **x264 multithreading is not byte-reproducible.** The bake uses `-threads 1`: 63 ms/frame, or about 98 ms/frame with `--png`.
10. **Two upstream tests write under `/tmp`.** Don't run `make test` in a sandbox that forbids that. Run the 11 others by name with `TMPDIR` set.
11. **The tarball is 28 MB,** mostly README GIFs; the code is about 0.8 MB.

## Not tested, and why

- **Linux, gcc and glibc.** The only measured cross-architecture case is Rosetta x86_64 on the same Mac. Docker was not running, and its daemon is outside this lane.
- **The live `--render kitty` and `--link` modes.** They need Kitty or Ghostty, or several live terminals, and are irrelevant to baking.
- **`--picture`, `--matrix`, `--depth`/`--trails`, sextants and blocks as plates.** These are the same recorder path; only stills were looked at for the main modes.
- **The screen blend of a `--ground black` plate over footage in HyperFrames,** and platform re-encode shimmer of braille.
- **The upstream `boids_test` (12,400 lines) and `link_test`.** They write to hard-coded `/tmp` paths.

## Version rule and downloads

- **The 14-day version rule.** The pinned commit `fe6f9f1` was 2 days old when tested (2026-10-12), so it breaks the rule that a tested version is at least 14 days old. It turns 14 days old on **2026-10-26**. The exception was approved on 14 Oct 2026 after the source review below, and the module landed then.
  - The newest commit at least 14 days old is `400e7bf` (2026-09-30), and the newest release that old is 1.4.0 (`cc446fc`, 2026-09-25). Both predate `--3d` (added 2026-10-11), so the 3D murmuration could not be tested on them.
- **Downloads made.** One source tarball for the pin (twice, for the checksum).

## Evidence

Logs, media and tools stayed on the test machine (see the [lab README](../README.md)); the contact sheets are in `sheets/`.

- **Gates:** `logs/gates.tsv`, `logs/gates.out`, `logs/g4-plate-vs-png.json`, `logs/g4-hf-vs-plate.json`, `logs/g4-hf-vs-master.json`, and the build logs `logs/build-*.log`.
- **Sheets:**
  - `sheets/e-terminal-variants-1080x1920.jpg`
  - `sheets/e-terminal-crops-100pct.jpg`
  - `sheets/g4-plate-vs-hyperframes.jpg`
  - `sheets/demo-orbit-title-16x9.jpg`
  - `sheets/shapes-100pct.jpg` (`--shape bird` against `arrow` and `plane`, 100% crops)
- **Media:**
  - `out/<variant>/{cold,warm1,warm2,build-*}.gif`
  - `out/g4/run-{a,b}/` (GIF, MP4, PNG master, `.json`)
  - `out/hf-g4/` (the comp) and `out/hf-g4-frames/`
  - `out/demo/orbit-title-16x9.mp4`
  - `out/E0-live/`
- **Tools:** `tools/build_variants.sh`, `tools/gates.sh`, `tools/framecmp.py`, `tools/live_pty.py`, `tools/write_results.py`.
- **Module:** [`terminal/`](../../terminal/README.md), the scripts and manifest that came out of this lane.
