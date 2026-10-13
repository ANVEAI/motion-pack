---
name: frame-design
description: Art-direct every frame of a video before it is built - a tone cell and motion personality, a palette measured for WCAG contrast, a free OFL type pairing, grid and platform safe zones, one hero per frame, the look and grain, and the special frames (title cards, lower thirds, end cards, covers and thumbnails) in 16:9, 9:16 and 1:1. Use this skill whenever the user asks how a video, title card, thumbnail, cover, end card or lower third should look, wants a palette, font pairing, colour grade or look, needs on-screen text to read on a phone or stay inside platform safe zones, or wants real UI screenshots placed into a generated scene, even if they never say art direction. It reads shotlist.json and writes design.json, whose fields map onto real motion-pack template CONFIG keys. It bundles scripts/contrast.py, a WCAG checker and palette linter that also proposes the nearest passing colour.
license: MIT
compatibility: Design skill. Python 3.8+ (standard library only) runs scripts/contrast.py. The CONFIG mapping targets the motion-pack repository's templates. Works in Claude Code and in any agent that reads Agent Skills.
metadata:
  version: 1.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# frame-design: one hero, readable text, measured colour

Every frame should have one thing to look at, words a viewer can read on a phone in the time they are on screen, and colours whose contrast you have measured instead of assumed. This skill makes those decisions once, writes them to `design.json`, and lets the build read them instead of guessing per shot.

## Where this sits in the pipeline

```
brief.md ─▶ story-script ─▶ script.md + shotlist.json ─▶ frame-design ─▶ design.json
        ─▶ motion-pack (+ spec-to-loop, Blender plates) ─▶ plan.json ─▶ MP4 ─▶ social-video ─▶ post/
```

- **Reads:** `shotlist.json` (lead aspect, the action and on-screen text of each shot, honesty labels, hook posters) and `brief.md` (tone, brand assets, platforms).
- **Writes:** `design.json` (schema and the full CONFIG mapping in `references/design-json.md`; a complete example in `assets/design.example.json`). Optionally `frames/` with cover and end-card mock-ups.
- **Next:** motion-pack copies the mapped values into the template's `CONFIG` block (table below). spec-to-loop takes the accent hex for its emissive and rim colours and bakes the display font with its `ttf2typeface.py`. social-video uploads the covers made to this skill's rules.

## When to use, and when not

- **Use it** for the look of any video, before the build; for covers, thumbnails, title cards, lower thirds and end cards; to fix "the text is unreadable", "it looks cheap" or "it looks like AI slop"; to re-lay out a 16:9 master for 9:16 or 1:1.
- **Do not use it** for the story (story-script), the edit and sound (motion-pack) or the post copy (social-video). It does not pick libraries (motion-stack).

## Workflow

1. **Read** `shotlist.json` and `brief.md`. List the key frames: frame 0 of each hook, the turn, the payoff, the end card, the cover.
2. **Pick the tone cell and the motion personality** (next section).
3. **Build the palette by role**, then run `python3 scripts/contrast.py design.json`. Fix every FAIL; the script prints the nearest passing colour.
4. **Choose the type**: one family, or one display plus one text family, free and OFL-licensed, in weights that really exist (`references/type-and-color.md`).
5. **Set the grid and safe zones** for each aspect you deliver.
6. **Name the hero of every key frame** in `design.json` `frames.hero_by_shot`.
7. **Choose the look**: one grade, one grain stock, an optional LUT, all by pack id.
8. **Design the special frames** (`references/frames.md`): cover, title card, lower third, end card, labels.
9. **Write `design.json`**, run `contrast.py` again, and hand off with the CONFIG mapping filled in for the template motion-pack will use.

## Tone cell and motion personality

Pick one cell. The type module tags its kinetic-type presets with these same cells (plus `techy` for `scramble` and `deconstructed` for `glitchSplit`), so the choice carries straight into the build.

| cell | feels like | type presets (`type/<id>`) | transitions | grade (`layers/presets/grades.js`) |
|---|---|---|---|---|
| calm-soft | film, memory, care | `blurIn`, `trackingCollapse` | hard cut, dissolve, dip-to-black | `warm-film`, `documentary`, `nostalgic-print` |
| calm-sharp | premium product, launch | `maskRise`, `charRise`, `weightMorph` | hard cut, push, mask reveal | `premium-product` |
| kinetic-soft | comedy, character, social | `charStagger`, `elasticPop` | whip, scale-punch | `bright-playful` |
| kinetic-sharp | hype, beat edit, sport | `scaleSlam`, `flipSplit` | smash, flash; glitch only on drops | `cool-tech` |
| neutral | explainer, UI, captions | `wordStagger`, `typewriter`, `wipe` | hard cut, push | `neutral`, `documentary` |

Then write the **motion personality** in one sentence plus four numbers: a base timing unit in frames, an easing family, the largest overshoot allowed, and the hold after every key action. Example: "The hero hurries; the product never does. Base unit 5 frames, soft easing for bodies, a pop only on the turn, at most 7% overshoot, a 15-frame hold after every key action." The contrast in *timing* between characters is what makes comedy read; changing easing alone rarely does. Allow one wow per piece.

## Palette: roles, contrast, discipline

- **Name colours by role, not by hue:** `paper` (background), `ink` (text), `accent` (the one brand colour), `accent_ink` (text on the accent), `muted` (secondary text and labels), `success` or other state colours, `character` (a figure's body), `scrim` and `caption` for text over footage.
- **Measure, never trust a label.** WCAG 2.x minimums are 4.5:1 for text, 3:1 for large text (at least 24 px regular or 18.66 px bold) and 3:1 for UI and meaningful graphics. Video is watched small and in motion, so treat these as floors. When we re-checked a popular open palette collection, 155 of its 161 palettes failed AA on at least one text pair, although its notes said they had been adjusted. Run `contrast.py` on every palette, including the defaults that ship with templates: motion-pack's character-spot default success mint (`#34D399`) measures 1.72:1 on its own white stage.
- **One accent, used with discipline.** A second saturated hue competes with the hero. State colours (success, warning) are the exception, and they still need 3:1.
- **Text over footage** needs a scrim, a box or a stroke. Check the caption colour against the lightest and the darkest frames it crosses, not against the average.
- **Saturated emissives clip.** A bright blue-violet light pushed past the display's range drifts toward magenta. Calibrate glowing brand colours by probing rendered pixels, then look.
- **Colour casts come from the light, never from the material.** A product that changes colour from room to room looks cheap.

## Type: free, licensed, real weights

- **Use OFL (SIL Open Font License) families**, so the font can be embedded in renders and shipped in a repository with its licence. The pack ships Manrope (variable, 200-800) and IBM Plex Mono in `templates/_shared/fonts/`. More families, pairings and the size table: `references/type-and-color.md`.
- **At most two tone families per piece** (one display, one text). A third font is noise.
- **Request only weights the family ships.** Asking for 500 or 600 from a family with 400 and 700 gives synthetic faux-bold, which reads as an AI tell. Pin variable fonts to an exact weight.
- **Sizes at the 1080 reference:** one read line per shot of at most 6 words, at least 48 px in 16:9 and 56 px in 9:16; captions 64-80 px in 9:16 (at least 40 px in 16:9), at most 2 lines and 18 characters per line; honesty labels at least 28 px (16:9) or 30 px (9:16), on screen for at least 2 s; end-card fine print held 3-4.5 s. These are the pack's house defaults, set after reviewers could not read smaller text on a phone.
- **Reading time:** at most 3.5 words per second; hold each line for max(0.5 s, 0.35 s + 0.28 s per word). The type module lints both.

## Grid and safe zones

| aspect | reference size | safe area (source) | grid |
|---|---|---|---|
| 9:16 | 1080 x 1920 | `conservative` in `type/safezones.js`: top 269, bottom 672, left 65, right 120 px, so text lives in x 65-960, y 269-1248 | 4 columns inside the safe rect, 8 px baseline |
| 16:9 | 1920 x 1080 | `wideTitle`: 5% title-safe (96 px sides, 54 px top and bottom); `wideAction` 3.5% | 12 columns, 96 px margins, 24 px gutters |
| 1:1 | 1080 x 1080 | `linkedin.video` in `templates/_shared/plan.mjs`: top 6%, bottom 10%, sides 6% | 6 columns |

- The right side of 9:16 reserves more than the left because the feed's action buttons sit there. The per-platform rows in `type/safezones.js` are working estimates flagged `verify: true`; look at the current app before a paid campaign.
- **Re-layout, never crop.** Each aspect gets its own constants (positions, sizes, camera distance). Move the subject with a lens shift or a camera move, not the type.
- **Faces and key text stay out of the bottom 35% of a vertical frame**, where captions, the title and the buttons sit.

## Hierarchy: one hero per frame

- **One hero** (the gag object, the product, a face), one support (the reaction), and texture (light, grain). Nothing in shot that is not part of the gag.
- **The hero is the brightest or highest-contrast thing at frame 0**, and at least one edge of it is critically sharp.
- **A product hero** reads best at roughly 36-46% of the frame width on a long lens, with quiet negative space where the type will sit. Those numbers are a house default from product-shot reviews; adjust by eye.
- **One hero light effect per shot** (a flare, god rays, a glint sweep), and at most 3 full-frame flashes per second (flash safety).
- **Concrete artefacts, not abstract imagery.** Node graphs, glowing threads, floating cards and holograms read as slop. Put UI on physical screens in the scene, and use the objects the story already has.

## Looks and grain (by pack id)

- **One grade per piece** from `layers/presets/grades.js` (`premium-product`, `warm-film`, `cool-tech`, `retro-vhs`, `nostalgic-print`, `bright-playful`, `noir`, `documentary`), or one LUT from `layers/looks/look.<name>.cube`. A look replaces the genre grade; do not stack them. Send log footage through `layers/looks/log.<camera>-to-709.cube` first.
- **One grain stock** from `layers/presets/stocks.js` (`clean`, `digital-soft`, `film35`, `film16`, `super8`, `vhs`, `upload-safe`). Use `upload-safe` for a clean look that has to survive platform re-encoding, which smears 1-pixel grain.
- **Finish recipes** in `layers/presets/finish.js` bundle grade, bloom, vignette and grain per genre. Stack rule: light leaks below the type; grain over everything except the brand and the letterbox bars.
- **Character comedy and kids' work look best clean:** `bright-playful` with no grain and almost no vignette.

## Never let an image model redraw UI or text

Image and video models garble interface text (real labels came back as nonsense words). Generate only the room or the backdrop, with the device screen as flat chroma green, then detect the four corners and warp the real screenshot onto it in perspective; remove the green spill and label the result "real screens, generated settings". Do not mention green objects in the prompt. Keep the raw scenes, so a re-composite costs nothing. Full method and the rules for generated people (one sharp face per shot, small hands, a reference sheet and a drift check): `references/frames.md`.

## Covers and thumbnails

- **One subject, at most 4 words, readable at 120 px wide.** Test it: scale the cover to 120 px wide and read it.
- **The words carry the stake or the question**, not the title, and promise only what the video pays off.
- **Covers are not the reach lever for Shorts and Reels feeds** (the feed plays the video), but they decide the channel grid, search and profile visits. Make frame 0 poster-worthy too, because some surfaces show it.
- Sizes, crops and per-platform notes: `references/frames.md`. social-video does the upload.

## design.json and the CONFIG mapping

`design.json` holds `tone`, `motion`, `palette`, `contrast.pairs`, `type`, `grid`, `safe`, `look`, `frames` and `config_map`. These are the template keys that exist today (read from each template's `config.mjs`):

| design.json | `templates/ad` | `templates/character-spot` | `templates/talking-head` | `templates/beat-edit` | `templates/film-scene` |
|---|---|---|---|---|---|
| `palette.accent` | `brand.accent` | `brand.accent` | `captions.accent` | - | - |
| `palette.ink` | `brand.ink` | - | - | - | - |
| `palette.paper` | `brand.paper` | `world.paper` | - | - | - |
| `palette.success` | - | `brand.mint` | - | - | - |
| `palette.character` | - | `layout.color` | - | - | `layout.workerColor` |
| `motion.type_presets.*` | `type.headline`, `type.card`, `type.end`, `type.sub` | `type.endLine` | `type.lowerThird` | `type.word`, `type.title` | - |
| `look.grain`, `look.vignette` | `layers` (`grain` with `params.stock`, `vignette`) | - | `layers` | `layers` | `layers`, `stage.grade.vignette` |
| `safe.platform` | `platform` | - | `platform` | `platform` | - |
| captions (`type.sizes`, lines) | - | - | `captions.maxWords`, `captions.maxChars`, `captions.y` | - | - |
| `frames.end_card.line` | `brand.cta` | `brand.line` | - | - | - |
| `frames.lower_third` | - | - | `lowerThird.name`, `lowerThird.title` | - | - |
| `frames.world` (`white` stage) | - | `world.mode` | - | - | - |

No template has a CONFIG key yet for the grade name, the LUT or the font family: motion-pack applies the grade and LUT through the layers module, and the fonts through the files in `templates/_shared/fonts/`. Keep those values in `design.json` anyway; do not invent CONFIG keys for them.

## QA before hand-off

- [ ] `python3 scripts/contrast.py design.json` exits 0.
- [ ] Every key frame names its hero; nothing else competes in brightness or sharpness.
- [ ] Every on-screen line fits the size, word and reading-time rules, inside the safe rect of each delivered aspect (motion-pack's `type/safezones.js` `lintRect` checks rectangles).
- [ ] Honesty labels have a designed style, a minimum size and a minimum time on screen.
- [ ] The cover reads at 120 px wide.
- [ ] No image-model text or UI anywhere; screenshots are real and composited.
- [ ] One grade, one grain, one accent, at most two type families.

## Files in this skill

| path | what |
|---|---|
| `references/design-json.md` | the full `design.json` schema, field rules and the mapping with example values |
| `references/type-and-color.md` | OFL families and their real weights, pairings, the size table, contrast maths, scrims |
| `references/frames.md` | covers and thumbnails, title cards, lower thirds, end cards, labels, product shots, screenshot compositing, generated imagery, re-layout |
| `scripts/contrast.py` | WCAG contrast for every pair, the palette linter and the nearest passing colour; `--selftest`, `--pair`, `--json` |
| `assets/design.example.json` | a complete, passing `design.json` for story-script's 16 s example spot |
