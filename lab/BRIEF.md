# Motion stack bake-off: shared brief (13 Oct 2026)

**The question:** "have all these and test how things are working in different combinations, or maybe the most suitable one".
"All these" means 20 GitHub repos:
- Remotion, Remotion Skills, Motion Canvas, Motion AI Kit, Motion, GSAP, Anime.js, GSAP Skills, Rive Web, dotLottie Web;
- Three.js, React Three Fiber, Drei, React Three Rapier, React Postprocessing;
- SVGO, Satori, Howler.js, Mediabunny, FFmpeg.

Every lane follows this file.

## Our pipeline (what "suitable" means)

- **Every frame must be a pure function of t.** Nothing may depend on wall-clock time, play history or randomness.
- **2D / DOM compositions** render in HyperFrames 0.8.142:
  - command: `npx --yes hyperframes@0.8.142 render <dir> -o out.mp4 --video-bitrate 26M -w 2 --quiet`;
  - HyperFrames seeks every frame;
  - it has adapters for GSAP (default), Lottie, three (`hf-seek` event plus `window.__hfThreeTime`; root `data-duration` is mandatory), Anime.js, CSS, WAAPI and TypeGPU;
  - read `installed skills: hyperframes-core/SKILL.md`, its `references/determinism-rules.md`, and `installed skills: hyperframes-animation/adapters/` before building a comp.
- **3D / WebGL plates** render with the three.js studio kit, `(a private studio kit, not included)`:
  - three@0.160.0 from jsDelivr;
  - its own post chain: 6-level selective bloom, depth of field, white balance and exposure, a shoulder curve, vignette, and 4-subframe jittered supersampling with a 180-degree shutter.
  - The renderer is `node installed skills: spec-to-loop/scripts/render.mjs <page.html> <out.mp4> <seconds> <fps> [--query ...]`. Its page contract is at the top of that file.
  - `render.mjs --qa qa.json` runs its own determinism checks.
- **Finishing:** ffmpeg 8.0.1 (x264; it has no libass). The master is −14 LUFS, true peak ≤ −1.5 dBTP.
- **The owned component pack is the motion pack (this repo).** It is read-only for you. Its fonts are `templates/_shared/fonts/Manrope-Variable.ttf` and `IBMPlexMono-SemiBold.ttf` (OFL); copy them into your lane.

## The harness (use it for every variant)

`node skills/motion-stack/scripts/seekcheck.mjs <page.html> --root <lane dir> --w 1080 --h 1920 --fps 30 --frames 120 --samples 12 --cold 4 --stills 0,30,60,90,119 --label <variant> [--video preview.mp4]`

**What a page must implement:**
- set `window.__ready = true` when it has booted, or `window.__error = 'msg'` if boot failed;
- `window.__seek(t)` draws the state at t seconds and may return a promise.

**Gates it writes to `report.json`:**
- **G1** `same_twice`
- **G2** `order_independent` (forward, reverse and shuffled orders)
- **G3** `cold_equals_warm` (a fresh page seeked straight to frame N)

Mismatches are saved as PNG pairs with their PSNR. Mismatches above 60 dB are GPU noise; anything below that is a real state error.

**Contact sheets:** `python3 skills/motion-stack/scripts/sheet.py out.jpg --cols 5 --width 300 --title "..." LABEL=path.png ...`

**G4, the production path:** the winner of each comparison must also render through the real pipeline above (HyperFrames, or render.mjs for WebGL) with no errors. Look at a still from that output.

## How to score (one row per variant in `results.json`)

```json
{ "lane": "B", "repo": "GSAP", "package": "gsap", "version": "3.15.0", "licence": "GSAP standard no-charge",
  "variant": "B1-gsap", "gates": { "G1": true, "G2": true, "G3": true, "G4": true },
  "worst_psnr_db": null, "ms_per_frame": 41.2, "quality": 4, "quality_note": "why, from the 100% stills",
  "loc": 120, "deps_mb": 6.3, "needs_bundler": false, "unique": "what it gives that we lack today, or null",
  "verdict": "ADOPT | ADOPT-FOR <niche> | KEEP-CURRENT | REJECT", "why": "one sentence", "evidence": ["paths"] }
```

**Quality, 1–5:** judge it from the stills at 100%, not from the code. Check:
- easing feel and edge quality;
- text rendering and colour;
- any artefacts.

Write down why you gave the score.

**ms_per_frame:** compare variants within your lane only, because other lanes share the GPU. Run the variants back to back and take the better of 2 runs.

**Verdicts:**
- **ADOPT:** our default for that job.
- **ADOPT-FOR:** only for a named niche.
- **KEEP-CURRENT:** what we already have wins.
- **REJECT:** say why (it fails a gate, has a licence problem, duplicates something, or the cost isn't worth it).

**`RESULTS.md` in your lane folder must contain:**
- the table;
- the recommended combination for your lane, with exact versions;
- the adapter snippet: the smallest code that makes the winner seek-safe in HyperFrames or the kit;
- the gotchas you hit;
- what you could not test, and why.

## Rules

1. **Where you work:**
   - Work only under `lab/<your lane>/`.
   - Everything else is read-only: the kit, the motion pack, the Desktop and personal folders.
   - Never edit the kit, the pack or any skill.
2. **Deleting files:**
   - Never run `rm` (or `rm -rf`, `find -delete`). Move discards to `~/.Trash/` with `mv`, or leave them.
   - Do not edit existing files with heredoc scripts. Write a script file, then run it.
3. **Installs:**
   - Use Node 25 for installs and bundlers: `export PATH=/opt/homebrew/bin:$PATH` (node v25.9.0). Node 22 deadlocks esbuild on this Mac.
   - Install inside your lane folder only, with an exact version: `npm i --no-fund --no-audit --save-exact <pkg>@<version>`.
   - Pick a version published at least 14 days ago (`npm view <pkg> time --json`).
   - No global installs.
4. **Downloads:**
   - Allowed: npm packages for the repos you were given, jsDelivr copies of those same packages, and the specific test assets named in your lane brief.
   - For anything else, stop and write it in RESULTS.md under "needs approval".
5. **Disk:** before every render, check `df -h /System/Volumes/Data`. Stop if under 10 GiB free.
6. **Long commands:**
   - Wrap them in `timeout`.
   - Kill every server or Chrome you started before you finish.
   - At most one GPU render at a time in your lane.
7. **Time limits:**
   - About 45 minutes per variant. If a variant is blocked, record the blocker as a finding (that is a result) and move on.
   - The whole lane: about 3 hours.
8. **Never:** post or publish anything, create accounts, or touch credentials or browser profiles.
9. **Licences:** check each library's licence in its repo or package.json. Remotion's Free License covers "evaluating whether Remotion is a good fit".
10. **Your final message is data for the maintainers, not prose for a human.** Give:
    - the path to RESULTS.md and results.json;
    - the recommended combination;
    - a 5-line summary;
    - anything that needs approval.
