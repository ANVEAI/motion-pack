# Reference study: Base44 launch film (via a public breakdown, Oct 2026)

**Source.** Studied from a [breakdown post](https://x.com/fakharkamario/status/2109928658031002091) by @fakharkamario (13 Oct 2026). It is 51.7 s at 1440×1080, and the breakdown wraps the original in a chapter timeline (Intro / Problem / Features / Demo / Outro).

**Reception.** The poster says the original "got more than 14M views". This is unverified: we have not read the original post. The breakdown itself: 4.2K views, 121 bookmarks.

**Use.** Craft reference only. Learn the techniques; never reuse its footage, brand or sequence.

## Structure: SaaS "agency" demo film, about 52 s, 5 chapters

| chapter | beats | treatments |
|---|---|---|
| Intro | "Your clients" → "Your clients dream big" | A small centred sentence on warm paper (#F0EEE9-ish) builds word by word, then **explodes into a scatter collage**: words spread across the frame among stickers, badges, a hand-drawn arrow, numbered pink dots and tiny photos (zine or scrapbook). The brand logo then comes in on its own |
| Problem | Office B-roll, keyboard close-up | Live action, warm, shallow depth of field, held about 1 s each |
| Features | **Word wheel**: "Products / Apps / Websites / **Build it all** / Design / Notion / Automations" | A vertical list rolls; the active word is bold and black, the rest faded grey |
| Features | Product output for a fictional client brand ("Open Fields") | App screens stack and slide in. Then the **generated brand system**: a logo over aerial footage, **oversized cropped type** ("pen F" bleeding off frame), colour blocks, merch and posters. The client's palette (green, blue, orange) takes over |
| Features | "AI at work" | A three-panel split (code, brand mark, **checklist ticking**: "Using your strategy ✓ Adapting content ✓ …"). Then "Building… / Connecting to database / Syncing client assets / Preparing preview" beside dashboard cards (donut "34 active projects", progress bar "18/36 tasks"), then a full dashboard on the brand's orange |
| Features | Editorial big numbers | "15 Players" with an "Expand" label, small UI crops and a red tag block. A **mosaic explosion** of dozens of tiny asset thumbnails |
| Demo | "Automate" | A **workflow node graph draws itself**: a trigger card, then action cards, yes/no branches and elbow connectors. The camera pans along the graph |
| Demo | UI in the real world | A Gmail notification card overlaid on live action; isometric booking UI over aerial pitch footage; UI panels slide |
| Demo | Prompt to result | A prompt bar ("Recap client feedback and send it on slack!") and a cursor click lead to sticky-note comments, a Slack message from the product's agent, and a big-number overlay ("43 Total Players") on live action |
| Outro | "It's already done" | Small type on paper with an orange dot, then a **full-bleed orange brand field** with the logo |

## What to learn

1. **Sentence-first storytelling.** Small type on warm paper carries the narrative; everything else is evidence around it.
2. **Show the output, not the tool.** The film builds a believable client brand and lets its artefacts (logo, merch, app, dashboard) prove the product.
3. **Each "AI at work" state is a visible checklist or progress UI.** That is honest motion for invisible work.
4. **UI in the world.** Overlay cards on live action and isometric UI over aerial shots tie software to real outcomes.
5. **Two palettes, kept apart.** The product's brand (paper plus orange) frames the film; the demo client's brand lives inside the demo.
6. **About 1 s per beat, with the chapter rhythm** Intro → Problem → Features → Demo → Outro.

## Pack coverage

| technique | pack | status |
|---|---|---|
| Word-by-word sentence build | `type/` presets (`wordStagger`) | exists |
| Stickers, badges, arrows | `sticker.place`, `callout.handArrow` | exists (verify the collage density) |
| Progress bar, donut | `chart.donut`, progress | exists |
| **Scatter collage** (sentence explodes into a field of stickers, words and photos) | none | gap: `layout.scatterCollage` |
| **Word wheel / slot list** (active word bold, others faded) | `counter.wheel` is numeric | gap: `type` preset `wordWheel` |
| **AI checklist** (ticking steps, "Building…" states) | sound only: `sfx/ui/agent_working` loop + `sfx/device/loading_tick` (2026-10-14) | gap: `ui.checklist` |
| **Node graph that draws itself** (cards plus elbow connectors, camera pan) | none | gap: `diagram.nodeGraph` |
| **Isometric UI tilt** (flat UI to an isometric plane) | none | gap: `cam2d.isometricTilt` or `layout.isometric` |
| **Oversized cropped brand type** bleeding off frame | type sizes | gap (small): `type/gfx` `bleedWord` |
| **Mosaic explosion** of many thumbnails | none | gap: `layout.mosaicBurst` |
| **UI card overlaid on footage** | `layout.pip`, `device.*` | partial: no tracked or corner-pinned overlay |
