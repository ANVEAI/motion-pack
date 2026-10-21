# LANE_NOTES: xp-explainer (lane 7, 16 Oct 2026)

Branch `xp-explainer`, from the integration head 18056bf. The lane ran CODE-ONLY because the data volume held 2.7-3.6 GiB free: no renders, no Blender, and no eyes or ears runs.

## What this lane adds

| area | new files | ids |
|---|---|---|
| templates | `templates/explainer-diagram/`, `templates/data-story/` (+ `data/*.csv|json`, fictional demo data), `templates/process-howto/`: config.mjs (CONFIG + buildPlan + PROJECT_MAP + ASPECTS) + make.mjs + README.md + index.html + tall/index.html + out/plan.json + out/plan-tall.json + .gitignore | `templates/explainer-diagram`, `templates/data-story`, `templates/process-howto` |
| shared template kit | `templates/_explain/core.mjs` (beats, voice words, cues, plan.texts, finish), `build.mjs` (honesty gate first, then stage, voice, mix, page; `--no-audio`), `honesty.mjs` (the data gates, `HonestyError`), `dataset.mjs` (CSV / JSON loader, aggregate), `explain.test.mjs` (77 checks) | |
| gfx parts | `type/gfx/explain.js`, `type/gfx/explain-data.js`, `type/gfx/explain-icons.js` (17 owned icons), `type/gfx/explain-lim.js` (limits) | `diagram.graph`, `diagram.flow`, `layout.scrolly`, `title.takeaway`, `process.steps`, `process.beforeAfter`, `chart.story`, `callout.datum`, `map.hexTile`, `counter.hero`, `chart.sourceFooter` |
| pure modules | `type/gfx/numfmt.js` (intl / Indian lakh-crore / eu / si, no `Intl`), `type/gfx/graph.js` (deterministic layered layout + DSL) | exported from `type/gfx/index.js` |
| research | `docs/evidence/explainer-data-patterns.md` | |
| example | `templates/explainer-diagram/words.example.json` (hand-timed fictional VO words for the voice test) | |

### How the brief maps to the code
- The diagram graph layout is `graph.js` `layoutGraph`:
  - longest-path layers;
  - cycles broken by a DFS in input order;
  - dummy slots for long edges;
  - fixed median sweeps with total-order tie-breaks;
  - 0.01 px rounding;
  - caps of 200 nodes and 600 edges, reported in `dropped`.
- The edge flow animation is `flowSVG` (dash run + dots by arc length), used by `diagram.graph` and by `diagram.flow`.
- The callout leader-to-datum is `callout.datum`. It recomputes `chartGeom` from the same chart params, so the dot lands on the exact bar top or point.
- Locale number formatting is `numfmt.js`, with one scale per axis (`fmtAxis(..., { ref, ticks })`).
- The source footer is `chart.sourceFooter`. Every chart part also draws it itself (`footerSVG`), on every visible frame.
- The scrolly reveal is `layout.scrolly`, and its steps drive `chart.story` `hl`.
- Honest axes:
  - `chart.story` draws bars and areas from zero whatever `yMin` says;
  - a truncated line or scatter always gets an axis break and a label;
  - units go in `yLabel`;
  - the gate (`templates/_explain/honesty.mjs`) makes each of these a build failure (exit 2).
- The map is a hex-tile choropleth built in code (`map.hexTile`, axial q / r). No GeoJSON is fetched or vendored.

## Commits on xp-explainer

fd8b396, 0c9fc0f, 0721a5f, bef9e3b, cfecd07, 3d97eed, 5c85c74, 4f8fe35, 380fcfa, a3e83d4, c488e5b, b66f1d2, plus the commit that adds this file. The WIP commits are kept on purpose; squash at merge if wanted.

## Tests (all node, no browser)

| command | result |
|---|---|
| `node templates/_explain/explain.test.mjs` | **77/77**: numfmt, graph determinism (in-process and a fresh process, same bytes), the honesty gates (`make.mjs` exits 2 on 8 cases), the footer on every visible frame, plan purity, committed plans current, structure_check >= 70 at both aspects, word-anchored beats, labelled media slots, every new part a pure function of t |
| `node tools/tests/fuzz-params.test.mjs --only <11 new ids>` | pass: 3744 degenerate renders, none hung or threw, 0 NaN |
| `node tools/tests/fuzz-params.test.mjs --quick` | 7/7 (the whole registry, 158 gfx ids) |
| `node tools/tests/template-plans.test.mjs` | 47/47 (includes the 3 new templates) |
| `node tools/tests/project.test.mjs` | 68/68 |
| `node type/tests/honesty-defaults.test.mjs` | 30/30 (with the ALLOW entry below) |
| `node type/tests/ids.test.mjs` | 8/8 |
| `node templates/_shared/human/human.test.mjs` | 77/77 |
| `python3 tools/check_ids.py` and `--docs` | 0 unresolved |
| `python3 tools/check_names.py` | 0 hits |

## structure_check (`python3 tools/structure_check.py templates/<t>/out/plan*.json`)

| template | 16:9 | 9:16 | pattern |
|---|---|---|---|
| explainer-diagram | 100 | 100 | `explainer` (existing) |
| data-story | 100 | 100 | `data-story` (new) |
| process-howto | 100 | 100 | `process-howto` (new) |

**Measured without a render:** the mixes come from `node make.mjs` with `music/library` symlinked from another clone of the pack.

| template | LUFS-I | TP (WAV) | cues |
|---|---|---|---|
| explainer-diagram | -14.01 | -2.35 dBTP | 24 |
| data-story | -14.01 | -3.9 dBTP | 27 |
| process-howto | -14.02 | -2.0 dBTP | 13 |

The mix WAVs were deleted again to save disk.

All three pages (16:9 and tall/) load in Chrome from a local HTTP server with no console errors. `window.__ready` and `__seek` work, and the process-howto slots show their PLACEHOLDER PHOTO labels.

I checked stills of every section at both aspects (SVG frames rasterised by QuickLook, a fallback font) and fixed what read badly. The fixes:
- an axis scale mix (80K under 1 L);
- a legend colliding with the y label;
- the footer overlapping the x labels;
- tiny TB diagram nodes;
- the camera zooming out past the overview;
- icons overlapping node labels;
- the hex legend colliding with the footer.

## Shared-file edits MADE on this branch (all additive)

| file | edit | merge |
|---|---|---|
| `type/gfx/index.js` | after the `HW_GFX` import: `import { EXPLAIN, EXPLAIN_CUES } from './explain.js'; import { EXPLAIN_DATA, EXPLAIN_DATA_CUES } from './explain-data.js'; import { EXPLAIN_LIM } from './explain-lim.js'; Object.assign(GFX_LIM, EXPLAIN_LIM);` ; `GFX` gains `...EXPLAIN, ...EXPLAIN_DATA` at the end; after the hw export line: `export { fmtNumber, fmtAxis, groupDigits, compactParts, LOCALES } from './numfmt.js'; export { parseGraph, layoutGraph, edgeKey } from './graph.js'; export { chartGeom, datumXY, niceDomain, hexLayout, footerSVG } from './explain-data.js'; export { diagramTimes, camAt, scrollyGeom, stepActive, baGeom, wrap as wrapText } from './explain.js'; export { ICONS, ICON_NAMES, iconSVG } from './explain-icons.js';` ; `GFX_SFX` gains `diagram`, `diagram.flow`, `chart.story`, `chart.sourceFooter`, `callout.datum`, `map.hexTile`, `counter.hero`, `layout.scrolly`, `title.takeaway`, `process`, `process.beforeAfter` (after the hw block) ; `ACTION_CUES` gains `...EXPLAIN_CUES, ...EXPLAIN_DATA_CUES` | union (the round-3 union script) |
| `type/tests/honesty-defaults.test.mjs` | `ALLOW` gains `'process.steps': 'the step ordinals (1, 2, 3) that number the part\'s own steps list (lane explainer)',` after `ui.stepCounter` | union |
| `patterns/structures.json` | `structures` gains `data-story` and `process-howto` (appended); `template_map` gains `explainer-diagram` -> `explainer`, `data-story` -> `data-story`, `process-howto` -> `process-howto` | union (JSON keys); then `python3 tools/structure_check.py --all` and the mutation check `tools/tests/structure_check.mutants.json` |

## Shared edits NEEDED, not made (exact text)

1. **`.github/workflows/ci.yml`**, after the human kit step:
   ```yaml
      - name: "explainer templates (explainer-diagram, data-story, process-howto: graph layout determinism, honesty gates exit 2, footers on every chart frame, plans current, structure >= 70, voice anchors, labelled media; node, no browser)"
        run: node templates/_explain/explain.test.mjs
   ```
2. **`layers/tests/make-manifests.mjs` `GFX_FAM`**: add as the first test `/^(diagram\.|process\.|chart\.story|chart\.sourceFooter|callout\.datum|map\.hexTile|counter\.hero|layout\.scrolly|title\.takeaway)/.test(id) ? 'explain' :`. Then run `node layers/tests/make-manifests.mjs`, which regenerates `type/manifest.json`. The parts already carry `file:`.
3. **`type/tests/gfx-sheet.mjs` `fam()`**: the same test returning `'explain'`, so a sheet `type/demo/out/gfx-explain.png` is drawn. This is a browser render: run it through the render lock (below).
4. **`catalog/build.py` `TPL`**:
   ```python
   'explainer-diagram': ('How-it-works explainer, 16:9 + 9:16 re-layout (question over a diagram already drawing, the wrong model, the mechanism built node by node with a moving camera, a zoom INTO one node, one item traced, recap, takeaway; JSON or DSL diagrams, deterministic layered layout, optional VO word sync)', 'out/explainer-diagram.mp4', 'out/sheet.jpg'),
   'data-story': ('Data-journalism short, 16:9 + 9:16 re-layout (honest axes enforced: zero baselines, labelled truncation, units, a source footer on every chart frame; the number that matters, annotation leaders, scrolly breakdown, hex-tile map, lakh / crore or international formatting; build fails without source + method)', 'out/data-story.mp4', 'out/sheet.jpg'),
   'process-howto': ('Numbered how-to, 16:9 + 9:16 re-layout (steps on a timeline with owned icons, tip cards, before / after with your photos, a checklist end card)', 'out/process-howto.mp4', 'out/sheet.jpg'),
   ```
5. **`templates/README.md` table rows**:
   ```
   | How-it-works explainer 60-120 s, 16:9 + a 9:16 re-layout (question over a diagram already drawing, wrong model, the mechanism built step by step with a camera moving region to region, highlight + dim, flowing edges, notes synced to VO words, a zoom INTO one node, recap, takeaway) | `explainer-diagram/` | HyperFrames, `diagram.graph` (type/gfx/graph.js layout) |
   | Data story 45-90 s, 16:9 + a 9:16 re-layout (sourced dataset or the build fails, honest axes, the number that matters in lakh / crore or K / M, annotation leaders, scrolly breakdown, hex-tile map, takeaway with every source) | `data-story/` | HyperFrames, `chart.story`, `map.hexTile` |
   | Process how-to 30-60 s, 16:9 + a 9:16 re-layout (numbered steps on a timeline with icons, tip cards, before / after with labelled photo slots, checklist end card) | `process-howto/` | HyperFrames, `process.steps`, `process.beforeAfter` |
   ```
   Also the README.md module row "15 genre templates" becomes 18. Do not hand-edit counts: run `python3 tools/count.py --write` after the catalog.
6. **`skills/motion-pack/SKILL.md`**:
   - Decision tree: replace `├─ Diagram / "how it works" / data / math ──> a diagram animation tool for the plates, then type, layers and sound here` with:
     `├─ "How it works" / process diagram ──> RECIPE E (templates/explainer-diagram); data story / chart-led news short ──> RECIPE D (templates/data-story); numbered how-to ──> templates/process-howto; math animation ──> a math tool (manimgx) for the plates`
   - Recipe text:
     ```
     ### RECIPE E / D: explainer, data story, how-to (templates/explainer-diagram, data-story, process-howto)
     1. One canvas, no hard cuts: every change is a camera beat, a node landing or a highlight (plan.audio.events; no gap over 3.5 s outside a planned hold).
     2. Explainer: question on frame 0 over a diagram already drawing -> the wrong model -> the mechanism built node by node (diagram.graph steps / cam / focus / flow / notes) -> zoom INTO the hardest node -> trace one item -> recap -> takeaway. Diagrams are JSON or the graph DSL; the layout is deterministic (LR on 16:9, TB on 9:16).
     3. Data story: every dataset needs `source` AND `method` (make.mjs exits 2 otherwise); bars and areas start at zero; a truncated line axis needs its `truncated` label; every chart frame prints the source footer (and DEMO DATA for demo data). Numbers come from the data files, never from copy; `locale: 'in'` prints 12,34,567 and lakh / crore.
     4. How-to: 2-8 steps (<= 5 words each) with owned icons, a tip card per step, before / after with your photos (null = labelled placeholder), a checklist end card held >= 3 s.
     5. Optional VO: voice.words (+ voice.audio); beats with `word` land on the word, captions follow the voice, the bed ducks 12 dB.
     6. Check: node templates/_explain/explain.test.mjs; python3 tools/structure_check.py templates/<t>/out/plan.json; then sheet.py, ears and eyes on the render.
     ```
   - "Reach for X when" rows:
     - `| a "how it works" diagram | diagram.graph (steps, focus, flow, cam, notes, zoom into a node), diagram.flow | JSON or DSL spec; graph.js layoutGraph is deterministic |`
     - `| an honest chart for a data story | chart.story (bar / line / area / scatter; show, hl, compare), callout.datum, counter.hero, map.hexTile, chart.sourceFooter, layout.scrolly | source + method required; zero baselines; numfmt.js for lakh / crore |`
     - `| a numbered how-to | process.steps, process.beforeAfter (media windows: baGeom), title.takeaway | icons from type/gfx/explain-icons.js |`
7. **`skills/motion-pack/references/apis.md`**: under the type/gfx section, add `fmtNumber(v, { locale: 'in'|'intl'|'eu'|'si', dec, compact: 'short'|'long', unit })`, `fmtAxis(v, { ref, ticks })`, `parseGraph(dsl|json)`, `layoutGraph(spec, { dir, box })`, `chartGeom(params, ctx)` + `datumXY(G, [row, series])`, `baGeom(params, ctx)`, `diagramTimes(params)`.
8. **`.gitignore`, or the repo's `info/exclude`**: `music/library` as a symlink is not matched by `music/library/` (that pattern matches directories only). I symlinked `music/library` to another clone of the pack to measure the mixes, then removed the link again; recreate it before the pending renders. The integration clone's exclude has `sfx/library` only; add `music/library` there too.

## PENDING RENDERS (exact commands; run only when the lock allows, >= 10 GiB free)

```
L=$MP_RENDER_PREFIX; R=templates
# music/library must exist (symlink as above). Each make rebuilds the plan, mix and page right before its render.
cd $R/explainer-diagram && node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/explainer-diagram.mp4 --crf 23 -w 1
cd $R/explainer-diagram && node make.mjs --set aspect=9:16 && cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/explainer-diagram-tall.mp4 --crf 23 -w 1
cd $R/data-story && node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/data-story.mp4 --crf 23 -w 1
cd $R/data-story && node make.mjs --set aspect=9:16 && cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/data-story-tall.mp4 --crf 23 -w 1
cd $R/process-howto && node make.mjs && $L npx -y hyperframes@0.8.142 render . -o out/process-howto.mp4 --crf 23 -w 1
cd $R/process-howto && node make.mjs --set aspect=9:16 && cd tall && $L npx -y hyperframes@0.8.142 render . -o ../out/process-howto-tall.mp4 --crf 23 -w 1
# then, per MP4 (16:9 shown; the tall ones use out/plan-tall.json):
cd $R/explainer-diagram && python3 ../_shared/sheet.py out/explainer-diagram.mp4 out/sheet.jpg 0,3,8,12,18,23,29,33,39,44,48,53,59,64,72 && python3 ../../ears/listen.py out/explainer-diagram.mp4 --plan out/plan.json --md out/ears.md && python3 ../../eyes/look.py out/explainer-diagram.mp4 --plan out/plan.json --md out/eyes.md
cd $R/data-story && python3 ../_shared/sheet.py out/data-story.mp4 out/sheet.jpg 0,3,8,12,17,21,24,28,31,35,39,43,47,51,56,60 && python3 ../../ears/listen.py out/data-story.mp4 --plan out/plan.json --md out/ears.md && python3 ../../eyes/look.py out/data-story.mp4 --plan out/plan.json --md out/eyes.md
cd $R/process-howto && python3 ../_shared/sheet.py out/process-howto.mp4 out/sheet.jpg 0,2,5,8,11,14,17,20,23,26,28.5,30,32,34,37,40,42 && python3 ../../ears/listen.py out/process-howto.mp4 --plan out/plan.json --md out/ears.md && python3 ../../eyes/look.py out/process-howto.mp4 --plan out/plan.json --md out/eyes.md
# the parts sheet (after shared edit 3) and a seek check of one page:
$L node type/tests/gfx-sheet.mjs
cd $R/data-story && $L node ~/.claude/skills/motion-stack/scripts/seekcheck.mjs index.html --w 1920 --h 1080 --fps 30 --frames 120 --stills 0,60,119
```

## Weaker than I would like

- **Nothing is rendered.** The stills I judged were SVG frames rasterised with a fallback font, and the eyes and ears scores do not exist yet. Text widths in Chrome come from canvas `measureText` (exact). In node they are an estimate, so footers and labels may wrap differently than the stills showed. Look at the real sheet first.
- **The 9:16 diagrams are tight.** The conservative safe rect leaves about 780 px of height for 5 layers plus captions. Node labels land at about 30-34 px on 1080 width: readable, not generous. A longer chain should zoom the camera region by region (`cam` beats) rather than show the whole TB graph.
- **The graph layout is good for explainer-sized graphs** (up to about 25 nodes). It does median sweeps, not true crossing minimisation, and long back edges are plain loops.
- **The demo data is invented** (labelled). No public-domain dataset was fetched, because the network and disk were constrained. A CC0 table can go in `data/` with its URL and checksum in `method`.
- The process-howto tip cards reuse `title.hookCard` (an existing human-lane part) rather than a dedicated step-detail part.
- The explainer demo has no voice. The VO path is tested with hand-timed example words, never with a real recording.
