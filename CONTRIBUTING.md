# Contributing to motion-pack

Thanks for helping. The pack stays useful because every part follows the same few rules, so please read these before you open a pull request.

## The rules

1. **Pure functions of time.** A component draws or sounds the same for the same `t` (or frame and fps), whatever was rendered before. No `Date.now()`, no `Math.random()`, no `performance.now()`, no state carried between frames. Use the seeded generators already in the pack (`mulberry32`, `hashf`, `rng(seed)`).
2. **Ids, not paths.** Reference other modules by id (`transitions/<name>`, `sfx/<cat>/<name>`, `music/<id>`, `type/<preset>`, `objects/<name>`, `cuts/<group>/<name>`). Add new ids to the module's registry, then run `python3 tools/check_ids.py`.
3. **Owned or nothing.** Code you write, sound you synthesise, renders you make. Do not commit third-party media, samples, icons, logos, fonts or LUTs. Outside assets go through `scripts/fetch-external.sh` (pinned URL + SHA-256 in `scripts/external.lock`) and, for audio, `sfx/tools/check_origin.py` and `sfx/tools/catalog_import.py`. Only licences that need no attribution (CC0, MIT, ISC, Apache-2.0, OFL) are accepted for fetched sets.
4. **Measured, not claimed.** Numbers in READMEs come from the code (manifests, QA reports, `tools/count.py`). If a README is generated (`sfx/make_readme.py`, `music/make_readme.py`, `transitions/tools/build.mjs`), edit the generator, not the output.
5. **No real people, brands or logos in demos.** Use the fictional placeholders (`Orbit`, `Maya Rao`, ...).

## Before you push

```bash
python3 tools/check_ids.py                      # 0 unresolved
python3 -m pytest -q cuts/test_cutgen.py cuts/test_retime.py sfx/tests music/tests
node transitions/tests/core.test.mjs && node transitions/tools/lint.mjs
node camera/tests/camera.test.mjs
node physics/tests/test-player.mjs
python3 tools/count.py --write                  # refresh the README table if counts changed
```

If you touched `blender/`: `bash blender/tests/smoke.sh` (3 frames per recipe at 480p; needs Blender 5.2.x, set `BLENDER` if it is not on `PATH`), and regenerate its manifest with `python3 blender/tools/make_manifest.py`. If you touched `physics/`: re-bake with `cd physics && npm install && node bake.mjs ...` and commit the table.

If you touched anything visual, also run the browser tests on a machine with a hardware GPU:

```bash
npm i --no-save puppeteer-core gsap@3.14.2 three@0.160.0
bash layers/tests/run-all.sh
```

If you touched sound: `python3 sfx/build_library.py` or `python3 music/build_music.py`, then `python3 sfx/qa.py` / `python3 music/qa.py`, then `python3 tools/make_previews.py --audio`.

## Media in git

Full-size renders (PNG) and WAV masters are not committed. After a sheet or demo script writes PNGs, run
`python3 tools/make_previews.py --images` to make the committed JPEG previews (the PNGs are gitignored), then rebuild the catalog with
`python3 catalog/build.py`. Keep any single file under 10 MB; demo videos should be short H.264 at CRF 22 or higher.

## Pull requests

- One topic per pull request, with a short note on what you measured (QA output, a contact sheet, or a render hash).
- New components need a manifest entry, a demo still or sound preview, and a line in the module README.
- By contributing you agree that your code is released under MIT and your generated media under CC0, as described in `LICENSE` and `LICENSE-MEDIA`.
