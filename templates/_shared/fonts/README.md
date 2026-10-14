# Fonts (not MIT, not CC0)

These fonts are redistributed unmodified under the SIL Open Font License 1.1. Each licence text sits next to the font files.

| file | font | copyright (as embedded in the font) | licence |
|---|---|---|---|
| `Manrope-Variable.ttf` | Manrope 4.505 | Copyright 2019 The Manrope Project Authors (https://github.com/googlefonts/manrope) | OFL-1.1, `OFL-Manrope.txt` |
| `IBMPlexMono-SemiBold.ttf` | IBM Plex Mono 2.3 | Copyright 2017 IBM Corp., Reserved Font Name "Plex" | OFL-1.1, `OFL-IBMPlexMono.txt` |
| `STIXTwoText.ttf`, `STIXTwoText-Italic.ttf` | STIX Two Text 2.13 (variable, wght 400-700) | Copyright 2001-2021 The STIX Fonts Project Authors (https://github.com/stipub/stixfonts) | OFL-1.1, `OFL-STIXTwo.txt` |

The licence texts are the upstream `OFL.txt` files from the Google Fonts repository (`ofl/manrope`, `ofl/ibmplexmono`); `OFL-STIXTwo.txt` is the same standard OFL 1.1 text under the STIX copyright line embedded in the font.
The STIX Two pair is the math-style italic that `type.paramReadout` names first in its font stack. It is not linked into every template by `compose.mjs`: declare it yourself (`@font-face` with `font-style: italic` for `STIXTwoText-Italic.ttf`, normal for `STIXTwoText.ttf`, family `"STIX Two Text"`; `type/demo/gfx.html` shows the two rules) and `document.fonts.load("italic 40px 'STIX Two Text'")` before the first frame.
Documents and videos you make with these fonts are not bound by the OFL. Templates hard-link these files into their `assets/` folder when you run `make.mjs`.
