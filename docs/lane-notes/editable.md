# Lane 6 "editable" (branch xp-editable): notes for the merge

The goal of this lane is to make the whole pack editable by anyone, including non-coders and agents. It delivers one project file, one CLI, every genre template retrofitted, and multi-aspect output.

## What shipped (new files)

| file | job |
|---|---|
| `templates/_shared/project.schema.json` | the project file contract (JSON Schema 2020-12): brand, text, media slots, voice, music, length, platforms, aspects, claims, overrides, template; `//` keys are comments |
| `templates/_shared/project.mjs` | the loader. It validates against the schema (a built-in subset validator, no dependencies). It runs the honesty checks and resolves files, then applies PROJECT_MAP, then overrides, then `--set`. `loadConfig(dir)` serves `cues.mjs` and `make.mjs`, and `resolve(dir, args)` serves the tests and `mp` |
| `templates/_shared/relayout.mjs` | the GENERIC re-layout for card templates designed at 16:9. It re-fits the text into the safe rect of the target aspect (`type/safezones.js`), with sizes chosen from a width model and the frame-design floors |
| `tools/mp.mjs` + `tools/mp` (shim) | the CLI: `list`, `new`, `set`, `build`, `render`, `check`, `brand`, `doctor` |
| `tools/mp_brand.py` | palette candidates from a logo (SVG or raster), checked with frame-design `contrast.py`; it suggests an accent, ink and paper |
| `tools/tests/project.test.mjs` | node: 68 checks, covering loader errors, the PROJECT_MAP of every template, and the identical-plan regression |
| `tools/tests/test_mp_cli.py` | pytest: 11 tests of the CLI in `$TMPDIR` (paths compared by realpath, the shim run through a symlink) |
| `docs/EDIT-WITHOUT-CODE.md` | the 10-minute path to a branded 16:9 + 9:16 video, the aspect table, the error table, and notes for agents and template authors |
| `examples/project.example.json` + `examples/project-assets/fernwick-mark.svg` | the commented demo project ("Fernwick", a fictional brand, CC0 mark) that drives `ad` and `proof-film` |

## Edits to existing files (all additive; default output unchanged and proven)

- **The seven genre templates' `config.mjs`** (ad, beat-edit, character-spot, film-scene, multi-voice-doc, proof-film, talking-head):
  - Each gets `export const PROJECT_MAP` and `export const ASPECTS`, appended right after the CONFIG block.
  - **ad** also gains:
    - the CONFIG fields `aspect: '16:9'`, `brand.logo: null` and `hook/problem/product.label`;
    - aspect-aware platform, size and placeholder fields in `buildPlan`, which are emitted only when the aspect is not 16:9 or a slot is null;
    - `media` accepts an absolute path.
  - **talking-head** accepts an absolute `words` path.
- **Five `make.mjs` files** (ad, beat-edit, multi-voice-doc, proof-film, talking-head):
  - The inline `--set` loop is replaced with `const C = await loadConfig(DIR)`.
  - **ad/make.mjs** also gains:
    - the aspect layout through `relayout.mjs`;
    - the placeholder card for a null slot;
    - the logo on the end card;
    - `plan.texts` boxes for eyes on re-laid aspects;
    - absolute media paths.
  - At 16:9, `index.html` is byte-identical to main; this was checked with a diff and by `test_mp_cli.py::test_build_with_an_empty_project_gives_the_committed_plan`.
- **`templates/_shared/cues.mjs`:** `loadConfig` replaces the inline `--set` loop, which adds `--project` and `--aspect`.
  - **Behaviour change:** `--set` on a key that does not exist now exits 2 with a suggestion. It used to create the key silently.
  - An optional field on a list item (`proof.0.source`) is still allowed.
  - `true`, `false`, `null` and JSON values are parsed; `key=a=b` keeps everything after the first `=`.
- **`templates/_shared/render3d.sh`:** with `MP_PROJECT=/abs/project.json` set, cues gets `--project` and the page gets `?config=out/config.resolved.json`. Without it, the behaviour is unchanged.
- **`templates/character-spot/scene.html` and `templates/film-scene/scene.html`:** with `?config=<json>` they read the resolved CONFIG; without it they import `config.mjs` as before (2 lines each).

## Shared-file edits MADE (exact text)

1. **`.github/workflows/ci.yml`:** one step inserted before the "proof film template" step:
   ```yaml
   - name: "the shared project file (templates/_shared/project.mjs): loader errors name the field, every PROJECT_MAP lands on a real CONFIG path, and an empty project builds the identical plan for every genre template (node, no browser)"
     run: node tools/tests/project.test.mjs
   ```
   `tools/tests/test_mp_cli.py` runs inside the existing `python3 -m pytest ... tools/tests` step. It builds the `bed_tech_pulse_loop8` WAV on demand through `mp_build.ensure_bed`.
2. **`.gitignore`:** appended:
   ```
   # --- the shared project file (templates/_shared/project.mjs): what a --project / --set build resolved, per template ---
   templates/*/out/config.resolved.json
   templates/*/out/project.report.json
   templates/*/out/voice.words.json
   ```

## Shared-file edits NEEDED at merge (not made here)

- **`templates/README.md`:** append this section:

  > ## One project file for every template
  >
  > `templates/_shared/project.schema.json` is ONE file a person or an agent edits. Each genre template's `config.mjs` exports `PROJECT_MAP`, which maps the project's `brand.*`, `text.*`, `media.*`, `voice.*`, `music`, `claims`, `length`, `aspect` and `platform` onto its CONFIG. It also exports `ASPECTS`: native, relayout or manual, for each of 16:9, 9:16, 1:1 and 4:5.
  >
  > `node make.mjs --project p.json [--aspect 9:16] [--set k=v]` applies the project, then the per-template `overrides`, then `--set`. An empty project builds the byte-identical plan (`node tools/tests/project.test.mjs`).
  >
  > The `mp` CLI (`tools/mp`) wraps it all: `mp new ad ~/Movies/x`, `mp set ...`, `mp render`, `mp check`. See `docs/EDIT-WITHOUT-CODE.md`.
  >
  > The ad template's 9:16, 1:1 and 4:5 come from the generic card re-layout (`_shared/relayout.mjs`): type is re-fitted into the safe rect, not cropped.

  Also add `_shared/project.mjs`, `_shared/project.schema.json` and `_shared/relayout.mjs` rows to the "Shared files" table:
  - `project.mjs`: load and validate a project file, apply PROJECT_MAP, overrides and `--set`; clear errors (unknown key, missing file, digit without source, unsupported aspect, required slot).
  - `project.schema.json`: the contract.
  - `relayout.mjs`: the generic safe-zone re-layout for card templates.
- **`README.md` (pack root):** in the quickstart, after the library build, add:

  > **No code:** `tools/mp new ad ~/Movies/my-ad && cd ~/Movies/my-ad && mp brand logo.svg --write && mp render` (`docs/EDIT-WITHOUT-CODE.md`).

  `tools/count.py` is unaffected: no new template or part ids.
- **`skills/motion-pack/SKILL.md`:** see the proposed text below.
- **`skills/motion-pack/references/apis.md`:** append under the templates section:
  > `templates/_shared/project.mjs`: `loadConfig(dir, argv)`, `resolve(dir, {project, aspect, sets})`, `applyProject(CONFIG, PROJECT_MAP, project, {template, aspect, platform, ASPECTS})`, `applySets(C, sets, {MAP})`, `loadProject(file)`, `honesty(project)`, `readWords(file)` (words.json or SRT). `templates/_shared/relayout.mjs`: `layoutFor(aspect, safeFrac)`, `fitPx(text, {w, maxPx, minPx, lines})`, `wrapLines`, `cardCss(L, brand)`, `roleSize(L, role, text)`.
- **`skills/motion-pack/references/gotchas.md`:** append two entries:
  - `--set` on a CONFIG key that does not exist now exits 2 (it used to add the key silently); an optional field of a list item (`proof.0.source`) is still allowed.
  - A 4:5 aspect has no `plan.mjs` SIZES or PLATFORMS entry: eyes copies those tables and its tests fail on drift, so adding one means editing `plan.mjs`, `eyes/manifest.json` and the eyes test together. The ad takes `linkedin.video`'s safe fractions for 4:5.

## For the other lanes (the contract they build against)

- **PROJECT_MAP keys are project paths:** `brand.name`, `brand.accent`, `brand.ink`, `brand.paper`, `brand.muted`, `brand.logo`, `brand.url`, `brand.cta`, `brand.line`, `brand.fonts.display` / `brand.fonts.text` (the spelling `brand.font.*` also works), `text.<key>`, `media.<slot>` or `media.<slot>.src` / `.start` / `.label`, `voice.words`, `voice.audio`, `music`, `claims`, `length`, plus the derived `aspect` and `platform`.
- **Values:** a CONFIG path, a list of paths, or `{ to, values, fn, list, split, required, note, create }`; see the header of `project.mjs`.
- **Whole slots:** with the contract shape `CONFIG.media.<slot> = {src, start, label}`, map `'media.<slot>': 'media.<slot>'` once; src, start and label all follow.
- **`--project` for free:** replace the template's inline `--set` loop in `make.mjs` with `import { loadConfig } from '../_shared/project.mjs'; const C = await loadConfig(DIR);`. `cues.mjs` already supports `--project`.
- **Aspects:** export `ASPECTS` (16:9 and 9:16 at least, `how: 'native'`, or `'manual'` with a `note`). Without it, `mp` assumes 16:9 + 9:16 when `CONFIG.aspect` exists.
- **The regression:** add the template id to `GENRE` in `tools/tests/project.test.mjs`. It then gets the identical-plan regression and the "every map entry lands" check.
- **three.js templates:** copy the 2-line `?config=` hook from `templates/character-spot/scene.html`.

## Lane 5 (research) `patterns/structures.json` template_map

This lane adds NO new template, so it needs no new `template_map` entry. The ad, character-spot and proof-film entries already exist on xp-research.
- The other retrofitted genre templates (beat-edit, film-scene, multi-voice-doc, talking-head) keep their ids, so whatever xp-research maps for them still holds.
- The project file changes no template id and no structure: `aspect` is a re-layout of the same beats.
- At merge, `mp check` could also call `tools/structure_check.py` on each render's plan once that tool is on main. That is a two-line addition to `cmdCheck` in `tools/mp.mjs`; it is not done here because the tool is not on this branch.

## Proposed SKILL.md text (motion-pack skill): a new section after "Production gates"

> ## Edit without code: one project file, the `mp` CLI
>
> For a person who does not code, or an agent that should not touch template code, make the video from ONE `project.json` (schema `templates/_shared/project.schema.json`; walkthrough `docs/EDIT-WITHOUT-CODE.md`):
>
> 1. `tools/mp new <template>[,<template>] <dir> [--project p.json]`: a folder OUTSIDE the pack. It holds `project.json`, `renders/` and `build/`, which is a copy-on-write copy of the template with the rest of the pack linked.
> 2. `mp brand logo.svg --write`: accent, ink and paper from the logo, contrast-checked with frame-design `contrast.py`; a failing colour is moved in L* to the nearest passing one.
> 3. `mp set text.headline "..."`, `mp set media.hook.src clip.mp4`, `mp set aspects 16:9,9:16`, `mp set config.<template>.<CONFIG path> <value>`: each one validates the whole file first, so a refused value changes nothing.
> 4. `mp render`: every template of the project in every aspect it supports, as `renders/<template>-<WxH>.mp4` plus its plan and a contact sheet with loudness. A `manual` aspect is skipped with the reason. Renders stop under 10 GiB free.
> 5. `mp check`: the project's honesty, banned demo words, the name denylist, check_ids, the plan lint, LUFS and TP from the MP4, eyes and ears. Then LOOK at `renders/*.sheet.jpg`.
>
> `mp list [--json]` is the contract for agents: every template, the project fields it uses, their CONFIG targets and current values, required slots, and the aspects (native, relayout or manual).
>
> Honesty is enforced at the project level as well:
> - A digit in `text.*`, `brand.cta` or `brand.line` needs a claim with a real source.
> - A media slot set to null renders a labelled placeholder.
> - A required slot with no placeholder (a talking-head's footage) refuses null.
>
> Inside a template folder, `node make.mjs --project p.json --aspect 9:16 --set k=v` does the same as `mp build`: the project applies first, then `overrides.<template>`, then `--set`. An empty project changes nothing (`node tools/tests/project.test.mjs`).

Also add to the decision tree:

```
├─ The user wants to change copy, colours or footage themselves, or an agent should not edit template code ──> `mp new` + project.json (docs/EDIT-WITHOUT-CODE.md)
```

## Demo, measurements and limits

### The demo project

`examples/project.example.json` (Fernwick, a fictional brand) drives `ad` and `proof-film` from ONE file:
- the same brand, palette from `mp brand` on the CC0 mark: accent #0F766E, ink #181F1E, paper #F2F6F5;
- the same headline;
- 16:9 + 9:16;
- proof-film keeps its own bed and tempo through `overrides`.

Folder: `mp new ad,proof-film <dir> --project examples/project.example.json`, then `mp render`.

The MP4s are kept outside git. The contact sheets and plans are committed in `examples/project-demo/`.

### Loudness of the delivered files

Decoded from the delivered MP4 with `templates/_shared/sheet.py`:

| file | length | LUFS-I | true peak |
|---|---|---|---|
| ad-16x9.mp4 | 15.0 s | -14.14 | -1.89 dBTP |
| ad-9x16.mp4 | 15.0 s | -14.14 | -1.89 dBTP |
| proof-film-16x9.mp4 | 37.6 s | -14.22 | -1.93 dBTP |
| proof-film-9x16.mp4 | 37.6 s | -14.22 | -1.93 dBTP |

All four are within -14 ± 0.5 LUFS-I and at or under -1.0 dBTP. eyes on ad-16x9 (run before the lock rule): frame0 pass, exit 0.

### What the sheets show (looked at)

- **ad 9:16:** every line re-fitted inside x 65-960 / y 269-1248 at 96-200 px, the null product slot shows the labelled placeholder card, and the end card carries the logo + CTA pill.
- **proof-film:** the brand name flows into the scatter hero, the table column, the findings and the method lines; the ILLUSTRATIVE · PLACEHOLDER DATA pill is on every number panel; the 9:16 uses its own tall layout.

### PENDING (the disk was under 10 GiB and the shared render lock refused; not retried, per the coordinator)

1. Re-render `ad` 16:9 + 9:16. The project now points the problem slot at `plate-cast.mp4`. The current ad MP4s were rendered with `plate-film.mp4`, a pack render whose diegetic "FILES SENT OUT" counter shows digits (partly visible in 16:9). Command:
   ```
   cd <demo dir> && MP_RENDER_PREFIX=$MP_RENDER_PREFIX mp render --template ad --workers 1
   ```
2. `ears` and `eyes` on all four MP4s, and the full `mp check`:
   ```
   MP_RENDER_PREFIX=$MP_RENDER_PREFIX mp check
   ```
   It runs eyes and ears through the lock.
3. Untested so far:
   - a 3D template render from a project: the plan is verified (`mp build` for character-spot applies brand, accent and end line), but the `scene.html ?config=` path is not render-verified;
   - the ad at 1:1 and 4:5: it builds, but has not been rendered.

### Weaker than I'd like

- **Footage in 9:16** is re-framed around its centre (object-position 50%). A 16:9 plate loses its sides. The proper fix is a per-aspect `src`, which the schema does not have yet.
- **The generic re-layout fits text with a width model** (rounded up), not by measuring in the browser. Lines can sit a little narrower than the box, and `plan.texts` boxes are estimates for eyes.
- **4:5 has no `plan.mjs` platform or size.** The ad uses linkedin.video's safe fractions. beat-edit and talking-head mark 4:5 as manual, because `eyes/manifest.json` copies the plan tables and its tests fail on drift.
- **multi-voice-doc 9:16 is marked manual:** it uses fixed 16:9 px sizes.
- **`mp brand` on an SVG** weights colours by how often they appear, not by painted area. A raster logo is weighted by pixel share.
- **Stricter `--set` is a behaviour change:** an unknown CONFIG key now exits 2 with a suggestion. It still allows a field name the CONFIG already uses elsewhere, such as `.source` and `.method` (proof-film's honesty tests rely on that).

## Render findings (16-17 Oct) and fixes in `mp`

- `mp render` passed `--project` + `--aspect`, but templates whose PROJECT_MAP maps the project's `aspects` list never saw the aspect (17 of 24 built the wrong size for one aspect through the project path). Fixed in templates/_shared/project.mjs; the shared builders that parse their own `--set` call `aspectFlag()` (templates/_shared/compose.mjs). Guard: `node tools/tests/aspect-builds.test.mjs` (CI).
- `mp render` now ffprobes every render (tools/mp-size.mjs) and fails a file whose WxH is not its aspect's size, renaming it `.WRONG-SIZE.mp4` (kept); `mp check` runs the same check on every file in renders/. Guard: `tools/tests/test_mp_size.py`.
- ad 16:9 eyes: the "placeholder: Fernwick on a laptop" plate tag sits 11-23 px under the bottom safe edge at 6.0-7.0 s (placeholder label only). Open.
