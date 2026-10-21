# Short gotchas and where things are

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (the full gotchas list is `gotchas.md`). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Gotchas (the full list is in `references/gotchas.md`)

- **HyperFrames hides a timed clip outside `[data-start, data-start + data-duration]`.** Two-layer transitions need overlap windows: `templates/_shared/txplan.mjs` stretches the clips around each cut. Animate an untimed wrapper, never the timed `<video>`.
- **HyperFrames silently lowers the whole track if the AAC is over −1 dBTP.** Use the mixer's AAC probes.
- **GSAP in a composition:** set `gsap.config({ force3D: false })` and do one warm pass (`tl.seek(tl.duration()).seek(0)`) before registering the timeline. Without them, frames carry 1-LSB noise between renders.
- **HyperFrames prints structure warnings** on the stock templates (`timeline_track_too_dense`, `nested_structure_needs_subcomposition`). They are advisory; the render is unaffected.
- **`hyperframes render` defaults to CRF 16** (large files). Pass `--crf 23` for demos.
- **Do not put `z-index` on the `#fx` container.** It kills the overlays' `mix-blend-mode`.
- **DOM transition approximations** keep the timing, the swap frame and the sound, not the exact GL look.
- **The plates already carry bloom, vignette and grain** in `launch-studio`. Do not stack them twice.
- **The sound library is measured, not auditioned.** Listen once before a hero use.
- **Safe zones and per-platform loudness drift over time.** Treat them as defaults and verify against the current apps.
- **No libass in many ffmpeg builds.** Burn captions through the type module (DOM or canvas) or PNG overlays, not `subtitles=`.
- **A hidden browser tab throttles animation** (`document.hidden`). Check `visibilityState` before you debug "broken" motion.

## Where things are

| need | path |
|---|---|
| Templates and the shared plan, compose, audio and sheet helpers | `templates/`, `templates/_shared/` |
| Transition registry, back-ends and id resolver | `transitions/lib/` (`registry*.js`, `tx-*.js`, `ids.js`, `xfade.js`) |
| Cut patterns, the generator and retime | `cuts/patterns.json`, `cuts/cutgen.py`, `cuts/retime.py` |
| SFX, bundles, sweeteners, import gate | `sfx/manifest.json`, `sfx/bundles.json`, `sfx/sweeteners.json`, `sfx/tools/` |
| Music, mixer, thekas, tempo maps | `music/manifest.json`, `music/mixer.py`, `music/presets.py`, `music/theka.py`, `music/tempo_maps.json` |
| Layers, type, camera | `layers/`, `type/` (+ `gfx/`), `camera/` (each with a README, manifest.json and tests); colour grades: 8 genre grades + `neutral` (9 entries in `layers/presets/grades.js` GRADES); film looks: 8 `look.film-<genre>` LUTs (`layers/presets/film-looks.js`), counted with the looks |
| Objects and the character | `objects/index.js`, `objects/characters/poses.js` |
| Blender recipes | `blender/run.py`, `blender/README.md`, `blender/manifest.json` |
| Gallery | `catalog/index.html` |
| Automated listening and critique of the sound | `ears/listen.py`, `ears/README.md`, thresholds in `ears/manifest.json` |
| Automated looking and critique of the picture | `eyes/look.py`, `eyes/README.md`, thresholds in `eyes/manifest.json` |
| Outside assets | `scripts/fetch-external.sh`, `THIRD_PARTY.md` |
| Research behind the defaults | `docs/evidence/` |
| Beat sheets, hooks, CTAs, platform lengths and the structure checker | `patterns/`, `tools/structure_check.py` |
| Edit without code (one project file, the `mp` CLI) | `tools/mp`, `templates/_shared/project.mjs`, `templates/_shared/project.schema.json`, `docs/EDIT-WITHOUT-CODE.md` |
| Captions, audio description, accessibility lint, delivery presets, Lottie export | `tools/captions/`, `tools/describe/`, `tools/a11y_check.py`, `tools/deliver.py`, `tools/lottie/`, `docs/DELIVERY-AND-ACCESSIBILITY.md` |
