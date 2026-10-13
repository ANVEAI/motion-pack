# terminal: flocks, word titles and flying code, baked into frame-exact plates

[cbirds](https://github.com/clainstone/cbirds) (MIT, C99, no dependencies) draws Craig Reynolds' boids in a terminal: a flock in braille or sprites, a murmuration in 3D, a flock that writes a word and holds it, and text whose letters take flight and land back on their cells.

It is a live simulation, so it cannot be seeked. Frame 90 exists only after frames 0–89, and in a terminal each frame steps on the wall clock. In our tests, three live runs with the same seed gave three different pictures.

This module runs it **once, at build time**, through cbirds' own headless recorder:
- the recorder steps on its own clock and seeds its own random numbers;
- the module turns every recorded frame into exactly one 30 fps plate frame.

The plate then plays as an ordinary video layer, frame n of the comp is frame n of the plate, and it renders identically in any order. It is the same pattern as `physics/`.

Nothing from cbirds is vendored. `fetch-cbirds.sh` downloads the source at a pinned commit, checks its SHA-256 and builds it into `external/` (gitignored).

| file | what |
|---|---|
| `fetch-cbirds.sh` | downloads cbirds @ `fe6f9f1` (1.7.0), verifies the tarball SHA-256, runs only `make cbirds` with pinned flags, and writes `external/cbirds/bin/cbirds` plus an `ORIGIN.txt` |
| `bake-plate.sh` | cbirds options + a seed → `<name>.mp4` (30 fps H.264, bt709, faststart), `<name>.gif` (the lossless master), `<name>.json` (inputs, pin, frame map, SHA-256s) |
| `manifest.json` | the five looks below, as catalog entries |
| `tests/smoke.sh` | bakes a 1 s plate twice and checks the frame count and that both bakes are byte-identical |

## Use it

```bash
terminal/fetch-cbirds.sh                     # once: external/cbirds/bin/cbirds (needs cc, make, curl)

# a flock (9:16 by default); --skip 3.5 starts after the 3 s in which a plain flock writes "BOIDS";
# --shape arrow draws the birds as triangles in code (no cbirds artwork), and looks like the default bird at this size
terminal/bake-plate.sh --out plates/flock.mp4 --seed 33 --skip 3.5 -- -n 900 -s 34 --color ice --hawks 2 --shape arrow

# the flock writes a word and holds it, 16:9, ground mapped to black for a screen blend over footage
terminal/bake-plate.sh --out plates/title.mp4 --seed 5 --aspect 16:9 --seconds 8 --ground black -- -n 900 --say "ORBIT" --color prism --shape arrow

# a 3D murmuration at dusk
terminal/bake-plate.sh --out plates/dusk.mp4 --seed 45 --aspect 16:9 -- --3d --color dusk --hawks 1 --shape arrow

# the real terminal look: braille cells
terminal/bake-plate.sh --out plates/braille.mp4 --seed 5 --skip 3.5 -- -n 900 -s 34 --color ice --hawks 2 --render braille --shape arrow

# code that flies: the letters of a text lift off, flock and land (a full cycle is 34 s)
terminal/bake-plate.sh --out plates/code.mp4 --seed 5 --seconds 34 -- --text path/to/snippet.txt
```

In a HyperFrames composition, let the renderer own the video. Never seek, play or pause it yourself:

```html
<video id="flock" src="plates/flock.mp4" muted playsinline data-start="0" data-duration="10" data-track-index="0"></video>
```

Over footage, bake with `--ground black` and give the layer `mix-blend-mode: screen`: the ground becomes `(0,0,0)` and only the birds add light.

**Options:**
- `--aspect`: `9:16` (1080x1920), `16:9` (1920x1080) or `1:1` (1080x1080).
- `--seconds`: the plate length.
- `--skip`: drops simulated seconds from the start.
- `--png DIR`: also writes the plate as lossless PNGs.
- `--crf`: the x264 quality, 14 by default (a master; re-encode finals as usual).
- Everything after `--` is a cbirds look option:
  - `-n`, `-s`, `--color`, `--shape`, `--sprite`, `--hawks`, `--flocks`, `--speed`;
  - `--trails`, `--depth`, `--matrix`, `--3d`;
  - `--say`, `--clock-at`, `--seconds`, `--font-size`, `--picture`, `--text`, `--render`.

Run `external/cbirds/bin/cbirds --help` for the full list.

## What was measured (14 Oct 2026, motion-stack lab, lane e-terminal)

- **Same twice:** two bakes gave byte-identical GIF and MP4 files. Every mode tested (flock, braille, `--say`, `--3d`, `--text`) gave byte-identical recordings run to run, and on the first run of a freshly built binary.
- **Exact frame map:** plate frame n is cbirds frame `skip + n`, checked bit for bit; there are no dropped or doubled frames.
- **Prefix-stable:** a shorter take is the start of a longer one, so the length of a plate never changes its earlier frames.
- **Through HyperFrames 0.8.142** (`<video>` layer, two workers), a 300-frame 1080x1920 plate matched 300/300 by frame identity.
- **Cost:** about 18–20 ms a frame to simulate and record at 1080x1920, and 63 ms a frame for the reproducible single-thread x264 encode (98 ms with `--png`). A 10 s plate bakes in about 20–40 s.

## Honest limits

- **Same build, same flock; other builds, other flocks.** The flight is chaotic floating point: an x86_64 build, or one with different optimisation flags, diverges from frame 50 (1.5 s); a 3D sky diverges from frame 0. `fetch-cbirds.sh` pins the flags, and each plate's `.json` keeps the SHA-256 of what was baked. **Keep the MP4,** and treat a re-bake on another machine as a new take.
- **The pace is 0.9x.** A GIF carries delays in hundredths of a second, so cbirds records at 33.33 frames a second. The plate plays those frames at 30, and the flock moves at 0.9x its own pace. Use `--speed` if you want it faster.
- **The look is flat.** Opaque frames, no motion blur, no depth of field, and a GIF palette (about 220 colours a frame, no visible banding in our crops). Small red hawks lose some chroma in 4:2:0 H.264.
- **Signs are made of birds.** A `--say` word is a playful dot-matrix title, not typography, and at the default size it fills about a third of a 16:9 width. Set your real title with `type/`, and use this as the sting or transition into it.
- **The default bird is cbirds' drawing.** With `--shape bird` (the default), plates contain cbirds' own bird sprite (MIT). Use `--shape arrow|plane|dot` (drawn in code) or `--sprite our.png` for art that is entirely ours.
- **Avoid these:**
  - **Wall-clock modes:** `--clock` without `--clock-at`, because it shows the time the bake started.
  - **Live modes:** `--link` and `--render kitty`. Bakes refuse `--link`.
  - **Screen-recording a terminal running cbirds:** it is never frame-exact.

## When not to use it

- **One object on a designed path:** use `camera/` or a GSAP tween.
- **Real 3D birds with lighting:** use `objects/` or a Blender plate.
- **Physical piles and drops:** use `physics/`.
- **Readable titles:** use `type/`.

This module is for stylised flocks: terminal and tech b-roll, a full-frame murmuration transition, a word that a flock writes, or code that flies apart and lands back.

Credit: cbirds by Alessandro Palliccia ([clainstone/cbirds](https://github.com/clainstone/cbirds), MIT), after Craig Reynolds, *Flocks, Herds, and Schools*, SIGGRAPH 1987.
