# Type and colour

## Contents
1. Open-licence families that hold up
2. Pairing rules
3. Size and timing table (1080 reference)
4. Contrast: the maths and the video cases
5. Palette recipes by tone cell

---

## 1. Open-licence families that hold up

All of these are published under the SIL Open Font License 1.1 (check the licence file that ships with the copy you download, and keep it next to the font). Weights listed are the ones the family actually ships; request only these.

| family | kind | weights | good for |
|---|---|---|---|
| Manrope | geometric grotesque, variable | 200-800 | display and UI; ships in the pack (`templates/_shared/fonts/`) |
| IBM Plex Sans / Plex Mono | grotesque / mono | 100-700 | technical labels, timecodes, honesty bugs (Plex Mono SemiBold ships in the pack) |
| Geist / Geist Mono | grotesque / mono, variable | 100-900 | product and developer tone |
| DM Sans | low-contrast grotesque, variable | 100-1000 | friendly UI, captions |
| Work Sans | grotesque, variable | 100-900 | captions, explainer text |
| Bricolage Grotesque | expressive grotesque, variable | 200-800 | social titles with character |
| Archivo | grotesque with widths, variable | 100-900 | condensed headlines in 9:16 |
| Atkinson Hyperlegible | high-legibility sans | 400, 700 | captions and labels that must read small |
| Noto Sans / Noto Serif | broad script coverage | 100-900 | any non-Latin script (Devanagari, Arabic, CJK) |
| Source Serif 4 | text serif, variable | 200-900 | documentary and editorial cards |
| Fraunces | soft display serif, variable | 100-900 | warm film titles |
| Instrument Serif | display serif | 400 (+ italic) | elegant title cards, one size only |
| JetBrains Mono | mono, variable | 100-800 | code on screen |

Inter and Space Grotesk are also OFL and well made; they are so common in generated designs that they read as a default rather than a choice, so prefer them for UI text, not as the hero face.

## 2. Pairing rules

- **One family is often enough.** Weight and size do the hierarchy. A second family must differ in kind (a serif with a sans, a mono for labels), never by a little.
- **At most two tone families per piece** (the type module lints this).
- **Pin variable fonts** to exact weights; for three.js text, bake the pinned weight to a typeface JSON (spec-to-loop's `ttf2typeface.py`).
- **No faux bold or faux italic.** If the weight or the italic is not in the family, choose another family.
- **Tracking:** tighten display type slightly (-0.02 to -0.035 em at 96 px and up); open small caps and mono labels slightly (+0.02 em).
- **Script coverage:** test every glyph you will set, including currency signs and diacritics, before you lock the family.

## 3. Size and timing table (1080 reference; house defaults)

| element | 16:9 (1920 x 1080) | 9:16 (1080 x 1920) | rule |
|---|---|---|---|
| Read line (one per shot) | at least 48 px | at least 56 px | at most 6 words |
| Headline | 96-140 px | 96-130 px | at most 7 words in a hook, 4 on a poster |
| Captions | at least 40 px | 64-80 px | at most 2 lines, 18 characters per line, 2-4 words per chunk, active word highlighted |
| Honesty label | at least 28 px | at least 30 px | at least 2 s on screen, inside the safe area |
| End-card fine print | at least 28 px | at least 30 px | held 3-4.5 s |
| In-world text (clocks, ledgers, signs) | at least 28 px at the shot's framing | same | at most 24 characters per row |
| Lower third name | 44-56 px | 48-60 px | name and title, no more |

Reading time: at most 3.5 words per second; hold = max(0.5 s, 0.35 s + 0.28 s x words); exits about 30% faster than entrances; a fully formed hold of at least 9 frames. All are type-module rules.

## 4. Contrast: the maths and the video cases

- **Relative luminance** (WCAG 2.x): linearise each sRGB channel (c/12.92 at or below 0.04045, otherwise ((c + 0.055)/1.055)^2.4), then L = 0.2126 R + 0.7152 G + 0.0722 B. **Contrast** = (L_lighter + 0.05) / (L_darker + 0.05), from 1:1 to 21:1.
- **Minimums:** text 4.5:1; large text 3:1 (at least 24 px regular or 18.66 px bold at 1x); UI components and meaningful graphics 3:1; enhanced (AAA) text 7:1.
- **Reference values** (`contrast.py --selftest` checks them): black on white 21:1; `#767676` on white 4.54:1 (the lightest grey that passes AA text on white); `#777777` on white 4.48:1 (fails).
- **Text over footage:** measure the caption against the lightest and the darkest frames under it. Fixes, in order of preference: a solid box or pill, a 40-60% scrim behind the text block, an outline stroke of about 8% of the font size plus a hard shadow (the pack's `impact` caption style).
- **Thin type needs more:** a light weight at video scale behaves like smaller text; give it more contrast than the minimum, or a heavier weight.
- **Repair, do not guess:** `contrast.py` moves only the CIELAB lightness of the failing foreground (hue and chroma kept) and prints the nearest passing hex.

## 5. Palette recipes by tone cell (starting points; measure them with contrast.py)

| cell | paper | ink | accent | notes |
|---|---|---|---|---|
| calm-soft | warm off-white or deep night blue | near-black or warm white | one warm accent (amber, terracotta) | low saturation overall; let the light carry colour |
| calm-sharp | very dark neutral or pure studio white | white or near-black | one saturated brand colour, used sparingly | the product is the brightest object |
| kinetic-soft | light warm neutral (a white stage) | near-black | one bright accent plus one state colour | characters in mid-value pastels must still reach 3:1 against the stage |
| kinetic-sharp | black or a saturated field | white | one hot accent | flashes and glitches only on the beat; 3 flashes a second at most |
| neutral | white or light grey | near-black | a single UI accent | explainer and UI clarity first |

Keep one accent. State colours (success, warning) are allowed in addition and still need 3:1 against the background they sit on.
