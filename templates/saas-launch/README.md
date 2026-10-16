# saas-launch: the SaaS launch film (45 / 60 / 75 s, 16:9 + 9:16)

A launch film for a software product, built from the pack's SaaS kit (`type/gfx/ui-saas.js`, `ui-saas2.js`) and placeholder HTML screens of a fictional product, **Acme Flow** (a request-routing tool). Every screen in the demo is labelled "placeholder UI · demo data"; every figure prints its source ("placeholder data"). Swap in your own screenshots or recordings through `CONFIG.media` and your numbers through `CONFIG.claims`.

## The shape (60 s, 120 BPM bed, hard cuts on the beat unless a transition has a reason)

| s | scene | what happens | parts |
|---|---|---|---|
| 0-3 | hook | the pain on frame 0, already moving: the inbox scrolls, requests land as toasts, "Requests land *everywhere*." | `ui.appWindow` (enter none, ken-burns), `ui.notifyStack` |
| 3-9 | copy, chase, repeat | three problem beats on the bar (copy a request into a chat by hand; nobody owns it; the tracker grows) | `ui.cursorJourney` (drag with a carried chip), `callout.arrowLabel`, screens `chat`, `sheet` |
| 9-13 | reveal | `transitions/whip` (ENERGY); the mark pops, the name assembles, the promise | kit `revealSVG`, `sfx/riser/noise_1bar` into `sfx/hit/soft` |
| 13-29 | UI tour | `transitions/zoom-through` (REVEAL) into ONE window and a cursor journey: open a flow, describe it in a sentence (the AI answer streams while the steps build), read the rule (zoom to region + highlight), drag to adjust (the node follows the cursor exactly), test it (toasts) | `ui.appWindow` (move, zoom keys), `ui.aiAnswer`, `callout.highlightBox`, `callout.arrowLabel`, `ui.cursorJourney` (`win`), `ui.notifyStack` |
| 29-41 | feature trio | one line + a few seconds of UI each, `transitions/push` (STORY): the shortcut and the palette; every run on record; the numbers, live | `ui.shortcutChip`, `ui.commandBar`, `callout.highlightBox`, `ui.dashboardAssemble` |
| 41-45 | works with | neutral category glyphs on a ring, "placeholder marks" in frame | `ui.integrationGrid` |
| 45-49 | payoff | `transitions/blur-cross` (PLACE) back to the hook's inbox, before / after | `ui.beforeAfterSplit` |
| 49-52.5 | proof | one number with its source printed under it, plus a red "placeholder number" note while the source is a placeholder | `counter.countUp` |
| 52.5-56 | pricing | three plans, the featured one lifts; "Prices: placeholder data" | `ui.pricingCards` |
| 56-60 | end card | one slam on the cut, mark + name, the CTA pill, the URL, fine print; the bed falls to a planned quiet hold | kit `endSVG` |

45 s drops feature 2, works-with and pricing and shortens the tour (no drag); 75 s lengthens every beat (`scenes.mjs` BUDGETS).

## Edit

Everything you change is in the `CONFIG` block of `config.mjs`:
- `brand` (name, accent, ink, paper, logo, url, cta, fonts), `aspect` (`'16:9'` or `'9:16'`), `length` (45, 60, 75);
- `text`: every on-screen word (`*word*` takes the accent). A digit here stops the build: numbers live in `claims` with a source;
- `media`: `hook`, `tour`, `runs`, `payoffBefore`, `payoffAfter`; `null` = the labelled HTML placeholder; a `.png/.jpg/.webp` fills the window's screen slot (cover fit, with the scene's zoom keys); a `.mp4/.webm/.mov` becomes a timed `<video>` layer placed in the window's content rect and zoomed with the same maths;
- `claims`, `proof`, `pricing.plans` (+ `source`), `integrations` (glyph names: `mail chat calendar db doc sheet cloud bell code card ...`, never logos);
- `transitions` (`'from>to': [id, REASON]`), `music`, `sfx`, `tail`, `layers`.

`PROJECT_MAP` maps the shared project file (lane 6: `brand.*`, `text.*`, `media.*`, `music`, `aspects`) onto these paths.

## Build and render

```bash
cd templates/saas-launch
node make.mjs                                  # 16:9: out/plan.json (lint gates), assets/media/mix.wav (-14 LUFS), index.html
node make.mjs --set aspect=9:16                # 9:16: its own project in tall/ (out/plan-tall.json)
node make.mjs --set length=45 --set brand.name=Orbit --set media.tour.src=/abs/tour.mp4
npx -y hyperframes@0.8.142 render . -o out/saas-launch-60.mp4 --crf 23
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/saas-launch-tall-60.mp4 --crf 23)
python3 ../_shared/sheet.py out/saas-launch-60.mp4 out/sheet.jpg 0.4,3.6,6.2,8,10.5,15,19.5,22.4,24.8,27.6,30.5,35.8,38.5,43,47,50.3,54,58
```

`--no-mix` rebuilds the page without the (slow) mix; open `index.html?t=12.5` over any static server to see a still at 12.5 s without rendering.

## How the page works

One director `frame(t)` on every `hf-seek`: each scene is its own full-frame layer redrawn as one SVG from the plan (`templates/_shared/saas/kit.mjs` `sceneSVG`: background, gfx items through `renderInner`, kinetic headlines, the mark, the end card, captions); a window's HTML screen is rebuilt each frame from keyframed state (`screens.mjs` `stateAt`), so the cursor, the zoom and the screen all read the same t. Transition windows come from `_shared/txplan.mjs` and run the transitions module's DOM back-end (`applyDom`, styles from p alone). Nothing reads a clock. `seekcheck.mjs` over 1800 frames: same twice and cold = warm exact; three order mismatches at 98-105 dB (GPU noise, under the 60 dB line).

## Honesty

- Acme Flow is fictional, and its screens are HTML we wrote (never an image model's drawing of UI). Each window prints "placeholder UI · demo data" until you give it your own media.
- `buildPlan` refuses a digit in `CONFIG.text`; every number on screen is a claim with a source (`lint.proof`); the counter prints its source and, while the source says placeholder, a red note in frame.
- The integration grid uses generic category glyphs ("Email", "Chat", "Storage"), never a real product's mark; the window chrome has neutral grey dots, not a real OS's.

## Files

`config.mjs` (CONFIG, buildPlan, PROJECT_MAP), `scenes.mjs` (the scene list, LY.wide / LY.tall re-layouts, measured screen spots), `make.mjs`, `design.json` (palette by role, contrast measured: 0 FAIL), `out/plan.json`, `out/plan-tall.json`.
