# templates/trailer

A film trailer from **one plan**: the full trailer (about 60-75 s, by the score's tempo), a **30 s** and a **15 s** cut-down, each in **16:9 letterboxed** (2.39, 2.0 or 1.85) and as a **9:16 re-layout** (full frame, no bars). The music is the clock: the genre trailer score (`music/trailer_styles.py`) is rendered for exactly this cut, and every section starts on its markers. Craft notes: `docs/evidence/film-trailer-craft.md`.

```bash
node make.mjs                                    # full trailer, 16:9 2.39 letterbox  -> projects/full-16x9/
node make.mjs --set length=30                    # the 30 s cut-down                   -> projects/30-16x9/
node make.mjs --set length=15 --set aspect=9:16  # the 15 s cut-down, re-laid out      -> projects/15-9x16/
node make.mjs --set genre=scifi --set media.coast.src=/abs/your-coast.mp4
npx -y hyperframes@0.8.142 render projects/full-16x9 -o out/trailer-full-16x9.mp4 --crf 23   # make.mjs prints the command for its cut
node trailer.test.mjs                            # the plan's craft rules for every cut, aspect and score (CI runs it)
```

`--no-mix` writes the page only (for a layout check). Every build is its own HyperFrames project under `projects/<cut>-<aspect>/` (one root composition per folder); `out/plan.json` is the default plan (CI compares it), every other cut writes `out/plan-<cut>-<aspect>.json`.

## The trailer

| beat | what | parts |
|---|---|---|
| cold open | frame 0 is a placeholder plate already moving (the radio), one line of dialogue as a subtitle, room tone and radio static | `caption.filmSubtitle`, `sfx/amb/room_tone`, `sfx/trailer/radio_static_loop` |
| production card | YOUR company name (`brand.name`) with an original six-blade aperture mark, after the cold open (never a logo bumper first) | `card.production`, `sfx/trailer/sub_drop_long`, `transitions/dip-to-black` |
| the world | two plates, one thin card, an anamorphic flare on the beacon | `title.trailerThin`, `layers/anamorphicFlare`, `transitions/dissolve` |
| the inciting beat | a film burn peaking ON the cut, a boom, two lines | `layers/filmBurn` + `transitions/film-burn`, `sfx/trailer/boom_hit` |
| act 2 montage | cuts every 4 -> 2 beats, "from the makers of" (labelled placeholder) and thin cards on the braam downbeats, pass-bys | `card.fromTheMakers`, `sfx/trailer/metal_hit`, `sfx/trailer/whoosh_by` |
| act 3 wall | cuts every 2 -> 1 beat -> 8th notes, every bar downbeat a cut (the score's braam lands on it), cards in the title's style, a quote card (placeholder quote, placeholder source), a flash frame every 2nd bar | `card.quote`, `sfx/tx/flash_swell`, `sfx/trailer/boom_metal` |
| the silence | the wall stops dead, a reverse suck ends on the stop frame, 2 s of near-silence with one line | `sfx/trailer/whoosh_suck`, `plan.audio.quiet` kind gap |
| the title | ON the hit frame, by cut, the genre's title style, a flare sweep, a reverse braam ending on the hit | `title.trailerSlab` (thriller), `sfx/trailer/reverse_braam` |
| the button | one more radio shot, a line, the sting on the cut to black | `sfx/trailer/sting_button` |
| credit block + release card | a small title over the placeholder billing block; the date card on the score's final hit, held | `credits.billingBlock`, `card.releaseDate` |

Every cut is on the score's half-beat grid (`cuts/trailer_plan.py`, `cuts/patterns.json` `trailer.accelerate3Act`). The 30 s and 15 s cuts trim whole bars (largest section first) until they fit; the 80-84 BPM scores (horror, drama) keep their silence, title ring and tail in beats, so their 15 s cut runs to about 19.6 s.

## CONFIG (the editable contract)

`brand` (name = your production company, accent, url), `platform` (null = by aspect), `fps`, `length` ('full' | 30 | 15), `aspect` ('16:9' | '9:16'), `genre` (`layers/presets/film-looks.js` FILM_GENRES: the look, grain, halation, weave, letterbox ratio, title style and score follow it), `letterbox`, `film` (title, titleStyle), `text` (ALL on-screen copy: the label, the cold-open and incite lines, the cards, makers, quote, silence line, button line, credits, date), `media` (every footage slot; `src: null` = a labelled placeholder plate), `shots` (which slots play where, the montage pool), `claims`, `cuts` (target seconds per section and cut), `score` (style, seed), `transitions` (id + Murch reason), `flashEvery`, `sfx` (pack ids), `layers`. `PROJECT_MAP` maps the shared project file onto these paths.

## Honesty

The demo is **"THE LAST SIGNAL", a fictional film** by the fictional "ORBIT PICTURES". The frame says so the whole time ("placeholder footage · fictional film" in the bottom letterbox bar, or at the top of the 9:16 safe area), every placeholder plate carries its slot label ("PLACEHOLDER · coast at night"), every name in the billing block is a placeholder ("placeholder credits · fictional names"), "from the makers of" prints "placeholder · name a work you really made", the quote is "PLACEHOLDER QUOTE ..." with "placeholder source", and the date prints "placeholder date". No studio logo, no rating-board mark, no real title. The dialogue is subtitles only: no voice is generated or faked. A `card.quote` with a blank source renders a red "needs a source" card.

## Measured

Pending (the shared disk was full during this round; no render was allowed). The plan, the score and the page are built and checked: `node trailer.test.mjs` (339 checks over 3 cuts x 2 aspects x 4 scores); the mix of the full 16:9 cut measured -14.02 LUFS-I / -2.5 dBTP on the WAV master (`templates/_shared/film/score.py`); stills from the built page were looked at (seek stills, not the delivered file). The delivered MP4s, `sheet.py`, `eyes` and `ears` are still to run (`LANE_NOTES.md` has the commands).

## Honest limits

- The placeholder plates are procedural stand-ins (Canvas2D): moody, moving, labelled, but not footage; the looks were tuned on them, not on real shots.
- The billing block's condensed face is synthetic (Manrope squeezed by SVG `textLength`); pass `font` for a real condensed OFL family.
- The score and the sounds are measured, never auditioned: listen once before a hero use.
- The DOM transitions here are the director's own (cut, dissolve, dip, flash, a crossfade under the canvas film burn); the GL looks of `transitions/` are not used.
