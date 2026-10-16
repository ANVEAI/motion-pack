# process-howto: numbered steps, before / after, a checklist to save

30-60 s, 16:9 master + a 9:16 re-layout. Structure: `process-howto` (new in `patterns/structures.json`: hook, steps, result, checklist). structure_check: **100 / 100** at both aspects.

**Demo:** "Repot a plant in four steps" by the fictional "Orbit How-To". It is general practice with no numbers. The before and after photos are labelled PLACEHOLDER plates until you set `media.before.src` and `media.after.src`. 43.2 s.

## Shape

| section | demo time | what happens | parts |
|---|---|---|---|
| hook | 0-4.4 s | the promise on frame 0 while the four numbered steps draw on their timeline (one every 0.5 s) | `title.hookCard`, `process.steps` |
| steps | 4.4-29.2 s | one step at a time: the timeline fills, the step's icon lights, a "Step n" tip card; done steps tick; all ticked at 27.6 s | `process.steps`, `title.hookCard` |
| result | 29.2-35.6 s | before / after: your photos in the card windows, and the after card wipes in beside the before one (16:9) or under it (9:16) | `process.beforeAfter` (media windows) + two photo slots |
| checklist | 35.6-43.2 s | what you need, ticked one by one, held as the end card | `ui.checklist` |

## Edit the CONFIG

- **`steps`:** 2-8 items `{ t | word, title (<= 5 words), icon, tip }`. Icons come from the pack's owned set, `type/gfx/explain-icons.js`: gear, drop, timer, cup, check, search, upload, download, edit, lock, chart, leaf, sun, plug, doc, person and dot. The gate refuses an unknown icon.
- **`text`:** hook, step kicker, before / after titles and lines, the checklist.
- **`media.before` / `media.after`:** your photos (null renders a labelled placeholder). The slots are placed exactly in the card windows (`baGeom` in `type/gfx/explain.js`).
- **Times:** `allDoneAt`, `result { t, swap, until }`, `checklist { t, step }`.
- **The gate:** a digit anywhere in the copy needs a sourced claim. A how-to that says "steep for 12 hours" needs a source for the 12, or the copy says "overnight".

## Build and render

```
node make.mjs [--set aspect=9:16] [--set media.before.src=/abs/before.jpg --set media.after.src=/abs/after.jpg]
```

**Measured:**
- Mix at both aspects: -14.02 LUFS-I, -2.0 dBTP (WAV), 13 cues on `music/bed_acoustic_folk_pluck_loop8`.
- The page loads with no console errors, and both slots render their labelled placeholders.
- **Not rendered yet.**

**Ids:**
- gfx: `process.steps`, `process.beforeAfter`, `title.hookCard`, `ui.checklist`.
- sfx: `sfx/ui/count_tick`, `sfx/ui/success`, `sfx/paper/flip`, `sfx/tx/mask_reveal`, `sfx/ui/pop`, `sfx/hit/soft`.
