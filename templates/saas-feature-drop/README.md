# saas-feature-drop: the changelog / "new in" film (15 / 20 / 30 s, 16:9 + 9:16)

One feature, one film. Built from the SaaS kit and the placeholder HTML screens of the fictional **Acme Flow** ("placeholder UI · demo data" in frame).

| s (20 s cut) | scene | what happens | parts |
|---|---|---|---|
| 0-2.5 | hook | payoff-first: a NEW kicker, the feature's name, and the feature already running on frame 0 (selected rows route in a cascade) | kit `kickerSVG`, `ui.appWindow` |
| 2.5-6.5 | before | `transitions/smash` (EMOTION): the old way at its real slow rhythm, one click per request | `ui.cursorJourney` (`win`), inbox `calm` steps |
| 6.5-11.5 | after | select (click, shift-click), the bulk bar, the shortcut chip on a plate, everything routes, a toast | `ui.shortcutChip` (`plate`), `ui.notifyStack` |
| 11.5-15 | compare | `transitions/push` (STORY): the same inbox before and now | `ui.beforeAfterSplit` |
| 15-17 | shortcut | `transitions/scale-punch` (ENERGY): the keys, big | `ui.shortcutChip` (`stack`) |
| 17-20 | CTA | where it is live, the changelog URL, held; sonic logo | kit `endSVG` |

15 s drops the compare; 30 s lengthens every beat. Bed `music/bed_tech_pulse_loop8` (120 BPM).

Edit the `CONFIG` block (`brand`, `text`, `media.before` / `media.after`, `shortcut`, `claims`, `transitions`, `music`, `sfx`). A digit in `text` stops the build. Build: `node make.mjs [--set length=15|20|30] [--set aspect=9:16]`, then the render command it prints (`npx -y hyperframes@0.8.142 render . -o out/saas-feature-drop-20.mp4 --crf 23`; 9:16 from `tall/`).
