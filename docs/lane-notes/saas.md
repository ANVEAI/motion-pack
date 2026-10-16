# LANE_NOTES: lane 1 (saas), branch `xp-saas`

Base `bbd7da9` (v0.3.0). Clone `~/Developer/mp-xp-saas`. Never pushed.

## What shipped (new files)

| area | files |
|---|---|
| SaaS kit parts (13 ids, `type/gfx`) | `type/gfx/ui-saas.js`: `ui.appWindow` (light/dark chrome, screenshot / HTML / placeholder screen slot, cover fit, ken-burns `kb`, zoom-to-region `zoom: [{t, rect}]`, window `move` keys, `appWindowGeo` + `map()`), `ui.cursorJourney` (JSON path: eased arcs, per-key `arc`, click press + ripples, hover highlight, drag with a carried chip, hand cursor, `win` = screen space of a window through its zoom; `cursorAt`, `cursorLeg`), `callout.uiHighlight`, `callout.arrowLabel`, `ui.commandBar` (typed query filters the list, selection, enter closes), `ui.aiAnswer` (prompt typed, thinking, streaming answer with caret, Apply -> Applied, long answers scroll like a chat), `ui.shortcutChip` (owned glyph paths for ⌘ ⇧ ⌥ ⌃ ↵ ⌫, sequenced presses, optional plate). `type/gfx/ui-saas2.js`: `ui.pricingCards`, `ui.integrationGrid` (neutral category glyphs, never marks), `ui.beforeAfterSplit`, `ui.notifyStack`, `ui.dashboardAssemble`, `device.mock` (device.laptop / device.phone reused as the frame + a screen insert). Reused instead of duplicated: `callout.spotlight`, `counter.countUp` / `counter.statCard` (proof), `device.laptop` / `device.phone` (frames), the UI KIT helpers of `ui.js`, `layout.beforeAfter` stays the DOM-shot version |
| SaaS UI sounds (12, CC0, synthesised) | `sfx/recipes/saas_ui.py`: `sfx/ui/hover_tick`, `drag_lift`, `drop_snap`, `zoom_in`, `highlight_draw`, `palette_open`, `stream_tick`, `success_chime`, `key_chord`, `toast_in`, `price_reveal`, `connect` (key A major; `rr:4` on ticks/snaps/toasts). `sfx/qa.py`: 313 sounds, 0 FAIL. Never auditioned by a person |
| Shared SaaS runtime | `templates/_shared/saas/`: `screens.mjs` (placeholder HTML screens of the FICTIONAL "Acme Flow": inbox (chaos -> routed, selection, bulk bar), flows, builder (nodes build, drag, test run), runs, team chat, tracker sheet, mobile inbox; `stateAt` keyframes incl. the cursor's `cam` curve), `kit.mjs` (scene renderer: kinetic headlines with accent runs, kickers, mark reveal, end card, captions), `plan-kit.mjs` (scenes -> plan: sequence, transition sweeteners, per-item cues, `winOf` references, `plan.texts` for eyes, media slots, digit-in-copy gate), `make.mjs` (the whole build: lint gate, stage, VO, mix, one-director page; `--no-mix`; `?t=` stills), `saas-templates.test.mjs` |
| Genre templates (CONFIG + buildPlan + PROJECT_MAP + make.mjs, 16:9 + 9:16 re-layouts) | `templates/saas-launch/` (45/60/75 s; config, scenes, make, README, design.json, out/plan.json, out/plan-tall.json, index.html, tall/index.html), `templates/saas-feature-drop/` (15/20/30 s), `templates/saas-explainer/` (60/70/90 s; captions; optional VO via words.json, `words.example.json` = labelled placeholder timing) |
| Tests | `type/tests/saas.test.mjs` (123 checks), `templates/_shared/saas/saas-templates.test.mjs` (144 checks); both are CI steps |
| Research | `docs/research/saas-video-craft-2026-10.md` (maps the already-studied software launch films onto the template choices; no new figures, no new names) |

## Commits on `xp-saas`
`4cee57c` kit, sounds, runtime, first launch build · `5762fef` launch layouts + measured screen spots · `c9121ad` kit tests, inbox selection states · `a781dff` saas-feature-drop · `4ce753e` saas-explainer, template tests, CI steps · `046a819` saas_ui bundle, catalog, counts, apis.md · `65cd325` ui.test exclusion · `7a2a33b` design.json, contrast · `c533f6a` READMEs · then this notes commit. `git log --oneline bbd7da9..xp-saas` lists them all.

## Verified (code-only mode: no renders were possible)
- `node type/tests/saas.test.mjs` 123/123; `node templates/_shared/saas/saas-templates.test.mjs` 144/144; `node tools/tests/template-plans.test.mjs` 31/31; `node tools/tests/fuzz-params.test.mjs --only <the 13 ids>` pass; `node tools/tests/xproc-hash.test.mjs` 8/8; `type/tests` ui 81/81, r6 153/153, r3 112/112, r45ui 194/194, r45type 94/94, ids 8/8, honesty-defaults 30/30, dom-t0 4/4; `templates/proof-film/proof-film.test.mjs` 332/332; `python3 -m pytest -q tools/tests sfx/tests` 180 passed; `python3 tools/check_ids.py --docs` 0 unresolved; `python3 tools/check_names.py` 0 hits; `python3 tools/count.py --check` up to date; ci.yml parses (yaml.safe_load).
- Determinism of the page: `skills/motion-stack/scripts/seekcheck.mjs` on `templates/saas-launch/index.html`, 1800 frames, 24 samples: same twice = true, cold = warm = true, order: 3 mismatches at 98-105 dB (GPU noise; the harness labels it "noise only, >= 60 dB").
- Stills: every scene of all three templates looked at in both aspects through `index.html?t=` (Chrome, the real page, fonts loaded) and fixed (descender clip, measured screen hot spots, 9:16 zoom-to-region, kicker width, chip plate, chat-scroll of long answers, toasts z-order).
- Palette: `templates/saas-launch/design.json` through frame-design `contrast.py`: 0 FAIL (the success green was darkened to `#06A260` to pass 3:1 as UI).

## PENDING renders (disk at 4 GiB free; run when there is space, one at a time, through the lock)

```bash
source ~/Developer/.venvs/motion-pack311/bin/activate
L=~/Developer/motion-pack-xp/render-lock.sh
# 1. saas-launch 16:9 + 9:16 (60 s)
cd ~/Developer/mp-xp-saas/templates/saas-launch
node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/saas-launch-60.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16 && (cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/saas-launch-tall-60.mp4 --crf 23 -w 1)
# 2. saas-feature-drop 16:9 + 9:16 (20 s)
cd ../saas-feature-drop
node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/saas-feature-drop-20.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16 && (cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/saas-feature-drop-tall-20.mp4 --crf 23 -w 1)
# 3. saas-explainer 16:9 + 9:16 (70 s, captions, no VO)
cd ../saas-explainer
node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/saas-explainer-70.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16 && (cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/saas-explainer-tall-70.mp4 --crf 23 -w 1)
# 4. measure every delivered file (sheet + LUFS/TP, ears, eyes); <t> = the plan's shot starts + mid-transition times
for T in saas-launch:60 saas-feature-drop:20 saas-explainer:70; do n=${T%%:*}; s=${T##*:}; cd ~/Developer/mp-xp-saas/templates/$n
  python3 ../_shared/sheet.py out/$n-$s.mp4 out/sheet.jpg $(node -e "const p=require('./out/plan.json');console.log(p.scenes.map(x=>(x.start+Math.min(1.2,(x.end-x.start)/2)).toFixed(2)).join(','))")
  python3 ../_shared/sheet.py out/$n-tall-$s.mp4 out/sheet-tall.jpg $(node -e "const p=require('./out/plan-tall.json');console.log(p.scenes.map(x=>(x.start+Math.min(1.2,(x.end-x.start)/2)).toFixed(2)).join(','))")
  $L python3 ../../ears/listen.py out/$n-$s.mp4 --plan out/plan.json --md out/ears.md
  $L python3 ../../eyes/look.py out/$n-$s.mp4 --plan out/plan.json --md out/eyes.md
  $L python3 ../../eyes/look.py out/$n-tall-$s.mp4 --plan out/plan-tall.json --platform reels.organic --md out/eyes-tall.md
done
```
After the renders: copy the LUFS-I / TP and eyes / ears scores into each template README "demo" line and the templates/README.md rows (they say "render pending"), commit `out/sheet*.jpg` (the MP4s are gitignored), then move the MP4s to `~/.Trash` if disk is short. Optional, VO mechanics: `cd saas-explainer && node make.mjs --set voice.words=words.example.json` (writes out/vo.wav, a guide signal) then render to `out/saas-explainer-vo.mp4` and run ears with `--transcript out/transcript.json`.

## Shared-file edits (all additive; exact text)

1. `type/gfx/index.js` (4 inserted lines + 1 block before `export const sfxFor`):
   - after the `ui-proof.js` import: `import { SAAS, SAAS_CUES } from './ui-saas.js'; import { SAAS2, SAAS2_CUES } from './ui-saas2.js';`
   - after `export const GFX = {...}`: `Object.assign(GFX, SAAS, SAAS2);`
   - after `const ACTION_CUES = {...}`: `Object.assign(ACTION_CUES, SAAS_CUES, SAAS2_CUES);`
   - before `export const sfxFor`: `Object.assign(GFX_SFX, { 'ui.appWindow': [...], ... 'device.mock': [...] });` and `export { appWindowGeo, screenMap, cursorAt, cursorLeg, spaceOf, commandTimes, answerTimes, labelPill, unit as saasUnit, WIN_D } from './ui-saas.js'; export { GLYPHS, pricingTimes, intTimes, dashTimes, deviceScreenGeo } from './ui-saas2.js';`
   (The SaaS ids are deliberately NOT added to the round-1 `UI` / `UI_CUES` tables; `gfxCues` reaches their cues through `ACTION_CUES`.)
2. `type/tests/ui.test.mjs`: one line before `const R45UI`: `const SAASUI = Object.keys(GFX).filter((k) => /ui-saas2?\.js$/.test(GFX[k].file || ''));` and `...SAASUI` appended to the `R45UI` list (the SaaS parts have their own suite).
3. `sfx/recipes/__init__.py`: `"elec"]` -> `"elec",` + new line `"saas_ui"]`.
4. `sfx/bundles.py`: new bundle `"saas_ui"` appended after `neon_power_on`; regenerated `sfx/bundles.json` (16 bundles).
5. `tools/tests/test_lint_gate.py` (`test_every_make_runs_the_gate_before_it_stages_and_mixes_through_mix`): a make.mjs that calls `makeSaas(` and not `runPlan(` is checked in `templates/_shared/saas/make.mjs` instead (3 lines).
6. `.github/workflows/ci.yml`: two steps before "physics table player": `node type/tests/saas.test.mjs` and `node templates/_shared/saas/saas-templates.test.mjs` (names quoted).
7. `catalog/build.py`: `TPL.update({...})` with the three SaaS templates, inserted before `IDRX = re.compile(...)`.
8. `skills/motion-pack/references/apis.md`: bundle list ends `..., \`neon_power_on\` and \`saas_ui\`.`; a "SaaS UI (xp-saas)" bullet after "Electric (round 4/5)"; a "SaaS kit (xp-saas ...)" paragraph after the Round 6 type paragraph.
9. `templates/README.md`: three table rows after the round-6 problem-pivot row.
10. `.gitignore`: `templates/saas-*/out/*.mp4`, `templates/saas-*/tall/assets/`, `templates/saas-*/out/sheet-dev*.jpg`, `templates/saas-*/out/build*.log`.
11. Regenerated (take ours, regenerate in the merge order): `sfx/manifest.json`, `sfx/qa_report.json`, `sfx/README.md` (make_readme.py), `type/manifest.json` (layers/tests/make-manifests.mjs), `catalog/index.html`, README counts + inline counts (`tools/count.py --write`).

## Skill recipe text (for `skills/motion-pack/SKILL.md`; not edited here)

Decision tree, under "Sell a product": `software / SaaS launch, feature drop or explainer with a cursor through the product? -> RECIPE S (templates/saas-launch, saas-feature-drop, saas-explainer)`.

"Reach for X when" row: `| a SaaS product demo: a window you zoom into, a cursor that clicks / hovers / drags, a command palette, an AI answer that streams, a shortcut, pricing, "works with", a before / after, toasts, a dashboard that assembles, a device with your screen | ui.appWindow (zoom: [{t, rect}], move, kb; appWindowGeo), ui.cursorJourney (path JSON; win = a window's screen space), callout.uiHighlight, callout.arrowLabel, ui.commandBar, ui.aiAnswer, ui.shortcutChip, ui.pricingCards, ui.integrationGrid, ui.beforeAfterSplit, ui.notifyStack, ui.dashboardAssemble, device.mock (type/gfx/ui-saas*.js); sounds: bundle saas_ui | screens are YOUR screenshots / recordings or the labelled HTML placeholders of templates/_shared/saas/screens.mjs (fictional Acme Flow), never image-model UI; prices and dashboard figures print placeholder labels; glyphs are categories, never marks |`

RECIPE S: SaaS films, templates `templates/saas-launch` (45/60/75 s), `saas-feature-drop` (15/20/30 s), `saas-explainer` (60/70/90 s)
1. Pick the film: a launch (pain -> reveal -> one-window UI tour -> three features -> works with -> before / after payoff -> one sourced number -> pricing -> CTA), a feature drop (payoff-first, before, after with the shortcut, compare, the keys, where it is live), or an explainer (question, wrong model, reframe, three steps, result; captions always, VO optional).
2. Edit only CONFIG: `brand`, `text` (no digits: numbers go to `claims` with a source), `media` (screenshots fill the window's screen slot; recordings become a zoomed `<video>` layer in the content rect), `claims`, `pricing`, `integrations`, `transitions` (with reasons), `music`. `--set aspect=9:16` builds the vertical re-layout in `tall/` (each window zooms to its readable region).
3. Screen hot spots (`scenes.mjs` SPOT, measured with getBoundingClientRect on the 1440 x 900 screen) drive the cursor, the highlight and the zoom rects; when you swap in your own screenshot, re-measure them on yours.
4. Explainer VO: `--set voice.words=/abs/words.json` (one narration line per scene, in order); scene changes land in the breaths, the bed ducks, the captions light the spoken word.
5. Build `node make.mjs`, look at stills through `index.html?t=<s>` before rendering, render, then `sheet.py`, `ears`, `eyes` on the delivered MP4.

## What is weaker than I would like
- **No rendered MP4 yet** (disk): no measured LUFS / TP from a delivered file, no eyes / ears scores, no `sheet.jpg`. The mix was built for the 60 s launch (mixer report -14.01 LUFS-I, -2.5 dBTP on the WAV) but no AAC probe through HyperFrames. Everything visual was checked on Chrome stills of the real page, not on decoded frames.
- **The 12 new sounds are measured, not heard.** `drop_snap` is bass-heavy (centroid 325 Hz); `stream_tick` may read as clutter under a busy answer.
- **Video media slots are wired but untested in a render**: the `<video>` sits in the scene layer and hard-swaps at transition windows rather than moving with the DOM transition.
- **Mid-rise headline frames** (about 3 frames per head) can show stray punctuation of words still under their mask.
- **9:16 in-window UI is still small** where a whole screen must be seen (the payoff split, the builder at its widest); captions sit over the windows in the explainer at 9:16.
- **Hot spots are tied to the placeholder screens**: a user who swaps in a screenshot must re-measure SPOT, or the cursor clicks empty space.
- The research note adds no new studied films; a fresh study of high-reach SaaS launch videos belongs to the research lane.
