# Reference study: Stan "Launchpad" film (13 Oct 2026)

Source: [X post](https://x.com/vitaliidodonov/status/2110089541734596952) by Vitalii Dodonov. 21.9 s, 3840×2160, 16:9.
Studied 14 Oct 2026 from stills taken at 2 fps.

**Reception at study time:** 910 views, 14 likes, less than a day after posting. This is a **craft reference, not evidence of performance.**

**Use it as craft, never as a template to copy.** Learn the techniques; don't rebuild the film.

## Structure (a metaphor manifesto in 22 s)

| t | beat | treatment |
|---|---|---|
| 0–1.5 s | black | A cinematic breath. It costs the first impression; the pack's rule is never black on frame 0 |
| 1.5–2.5 s | archive: jets in formation, a bird in flight | Greyscale stock, a tiled repeat of one jet, single subjects on flat sky |
| 2.5–4 s | line 1, "Every flight started as a dare" | Small type inside a violet **perspective wireframe-grid tunnel**. The words assemble at mixed sizes, then the line **scrambles into another script** (Mongolian Cyrillic in a serif) and back |
| 4–5.5 s | patent and blueprint plates | Archival aircraft patent drawings as **white line art on electric violet** (a duotone), cut every ~0.5 s |
| 5.5–7 s | line 2, "It looked insane." | Changing frames carry the type: a thin rectangle, then a circle with a **radial violet gradient**, then a **dot-grid** field. One word ("Insane") jumps to a heavier **weight** |
| 7–9 s | launch-pad archive | A **1-bit threshold** still, then a greyscale shuttle launch with a thin **violet line drawn over** the subject |
| 9–11 s | line 3, "Until it left the ground" | Huge condensed grotesk at mixed sizes in a jumbled grid. "It" reveals **outline first, then fill**. The whole block **disintegrates into violet dither and pixel blocks** |
| 11–15 s | the payoff: real people | Warm documentary photos (barn, laptops, founders in violet hoodies) at ~0.5 s each. A hard cut to a **black brand glyph on white** punctuates the sequence |
| 15–18 s | title | Tiny centred type on white ("No one has ever launched like this"), then a **wide bold all-caps** product name in violet, then a light-weight date |
| 18–21.9 s | sign-off | Small white logo centred on black |

## What to learn

1. **A metaphor carries the argument, real people pay it off.** History of flight → "it looked insane" → the cohort. The archive does the emotional work; the product world appears only after the line lands.
2. **One accent colour does everything.** Electric violet is the duotone of the archive, the grid, the gradient, the type, the wardrobe and the logo, so every disparate source looks like one film. (ANVE's accent is the same family, #4A18ED; measure contrast.)
3. **Every type line gets its own container treatment**: grid tunnel, framed box, circle and gradient, dot field, full-bleed. The type styling varies while the colour and the face stay constant.
4. **Scale contrast is the rhythm.** Tiny type (2–3% of frame height) alternates with type filling the frame. The title card goes tiny, then wide bold, then light.
5. **Texture verbs on type and images**: script scramble, weight jump, outline→fill, dither-pixel disintegration, 1-bit threshold, line-art duotone. Each appears once or twice; none repeats enough to become a gimmick.
6. **Fast archive, slower title.** About 0.5 s per archival or doc shot through the middle; the closing type holds 1–3 s per card.

## Not to copy

- **The loudness:** −9.2 LUFS integrated with +1.1 dBFS peak on the delivered file, which means clipping. The pack masters at −14 LUFS / ≤ −1 dBTP.
- **The 1.5 s of black at the open:** it wastes the first impression on feeds.
- **Its archival footage and patent drawings:** check their licences for your own use. Public-domain patent drawings exist; stock footage needs a licence.

## Pack coverage

| technique | pack part | status |
|---|---|---|
| Script and character scramble | `type/presets.js` scramble (techy) | exists |
| One word's weight jump | `type/weightMorph` | exists |
| Halftone / pixel-sort / glitch accents | `overlay.halftone`, `tx.pixelSort`, `tx.glitch` | exists |
| Hard cut punctuation, fast archive cadence | `cuts/patterns.json`, `cuts/cutgen.py` | exists |
| Violet duotone for archive and line art | `layers/stylize.js` `look.duotone` | built 2026-10-14 (shadow → accent, highlight → paper; swap for light lines on accent) |
| 1-bit threshold still | `layers/stylize.js` `look.threshold1bit` | built 2026-10-14 (ordered Bayer 4 / 8 dither; blue noise not built) |
| Perspective wireframe-grid tunnel | `layers/backgrounds.js` `background.gridTunnel` | built 2026-10-14 |
| Dot-grid field | `layers/backgrounds.js` `background.dotGrid` | built 2026-10-14 |
| Type outline → fill reveal | `type/outlineFill` | built 2026-10-14 |
| Dither / pixel-block disintegration of type | `transitions/ditherDissolve` | built 2026-10-14 (GL + a real DOM back-end; demo `templates/demo-l7`) |
