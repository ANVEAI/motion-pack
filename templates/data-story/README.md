# data-story: a data-journalism short with honest axes

45-90 s, 16:9 master + a 9:16 re-layout. Structure: `data-story` (new in `patterns/structures.json`: hook, context, evidence, detail, takeaway). structure_check: **100 / 100** at both aspects.

**Demo:** "Are people borrowing books again?" by the fictional "Orbit Data Desk" (Orbit City is not a real place). The datasets are invented, the footer says so, and every chart frame prints DEMO DATA. 61.4 s.

## Shape

| section | demo time | what happens | parts |
|---|---|---|---|
| hook | 0-5.6 s | the question by 0.3 s over a line chart already drawing, a quarter at a time | `title.hookCard`, `chart.story` (line, `show`) |
| context | 5.6-20 s | this year against last year (dashed `compare`); annotation leaders on July and December; the line is highlighted | `chart.story`, `callout.datum` |
| evidence | 20-33 s | the number that matters (14.3 lakh, counted up in Indian words), then the yearly totals as zero-based bars with a callout | `counter.hero`, `chart.story` (bar, `agg: 'sum'`), `callout.datum` |
| detail | 33-54 s | a scrolly column steps beside the branch chart (the highlight follows the text), then a hex-tile map of the zones | `layout.scrolly`, `chart.story`, `map.hexTile` |
| takeaway | 54-61.4 s | one line, plus every dataset's source and method, held | `title.takeaway`, `chart.sourceFooter` |

## The honesty gate

This is the point of the template. `make.mjs` exits 2, naming the field, before anything is built, when:
- a dataset in `data` has no `source`, or a generic or filler one ("internal data", "n/a");
- a dataset has no `method`, or a method that repeats the source;
- a chart has no unit (`unit` or `yLabel`);
- a bar or area chart asks for `yMin` other than 0;
- a line or scatter axis starts above zero without a `truncated` label (the part always draws an axis break and a label too);
- a chart sets `footer: false`;
- a chart names a column or dataset that does not exist, or a value that is not a number.

`buildPlan` throws `HonestyError` on the same problems. Every number on screen is read from `data/*` and becomes a claim carrying that dataset's source, so lint.proof checks it too. **Limit:** the gate checks that a source and a method say something, not that they are true.

## Edit the CONFIG

- **`data`**: `{ id: { file: 'data/x.csv' | .json, source, method, unit, demo } }`.
  - In a JSON file the source and method can live inside the file (`data/zones.json`).
  - Set `demo: false` once the data is real. The DEMO DATA pill then goes, and the source line stays.
- **`locale`**: `'in'` gives 12,34,567, lakh and crore. `'intl'` gives 1,234,567, K and M. `'eu'` and `'si'` are also available. Formatting is written out by rule (`type/gfx/numfmt.js`), not `Intl`, so every browser prints the same characters.
- **`beats`** are `{ t | word, sec, kind, ... }`, where `kind` is one of:
  - `hook`;
  - `chart` (`chart: { data, kind: bar | line | area | scatter, x, y: [cols], names, compare, show: [[t, n]], hl: [[t, index | label]], yMin, truncated, agg }`, plus `callouts: [{ t, datum: [row, series], label, sub, dx, dy }]`);
  - `hero` (`data`, `column`, `agg`, `label`, `compact`);
  - `scrolly` (`chart` + `steps: [{ t, text, hl }]`);
  - `map` (`data` with `id q r label short value`, `hls: [[t, [ids]]]`);
  - `caption`;
  - `takeaway`.
- **Maps:** hex tiles are built in code from axial `q, r` coordinates (`map.hexTile`). Nothing is fetched or vendored. For a real geography, lay out one tile per region in your own CSV or JSON.

## Build and render

```
node make.mjs [--set aspect=9:16] [--set locale=intl] [--set data.monthly.file=/abs/your.csv --set data.monthly.source="..." --set data.monthly.method="..."]
```

**Measured:**
- Mix at both aspects: -14.01 LUFS-I, -3.9 dBTP (WAV), 27 cues on `music/bed_documentary_marimba_loop8`.
- The page loads with no console errors.
- **Not rendered yet.**

**Ids:**
- gfx: `chart.story`, `callout.datum`, `counter.hero`, `layout.scrolly`, `map.hexTile`, `chart.sourceFooter`, `title.hookCard`, `title.takeaway`.
- sfx: `sfx/ui/count_run`, `sfx/ui/tick`, `sfx/ui/slide`, `sfx/ui/pop`, `sfx/hit/soft`, `sfx/sparkle/shimmer`.

**Limits:**
- No GeoJSON choropleth: hex tiles only.
- Scatter x-axes may start anywhere (they are always ticked and labelled), and only the y axis is gated for truncation.
- Value labels on grouped bars switch to compact form when they would not fit.
