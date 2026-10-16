# templates/title-sequence

Kinetic opening titles, **30-60 s**: a small role over a large name, one name at a time, landing on a beat of the bed, moving around the safe frame over textures or your footage; the main title arrives late with its own hit and "directed by" closes it. 16:9 letterboxed by the genre's ratio, and a 9:16 re-layout (names stack top / centre / bottom inside the conservative safe zone).

```bash
node make.mjs                                   # 40 s, 16:9                         -> projects/40-16x9/
node make.mjs --set aspect=9:16                 # the 9:16 re-layout                 -> projects/40-9x16/
node make.mjs --set length=60 --set genre=noir --set media.t3.src=/abs/your-shot.mp4
npx -y hyperframes@0.8.142 render projects/40-16x9 -o out/title-sequence-40-16x9.mp4 --crf 23
node title-sequence.test.mjs                    # every genre x aspect x length (CI runs it)
```

## Genre presets

| genre | name style (`title.namesOver`) | bed | title | finish |
|---|---|---|---|---|
| thriller | split (the halves slide together) | `music/bed_suspense_pulse_loop8` | `title.trailerSlab` | `look.film-thriller`, film35, 2.39 |
| scifi | drift (slow drift, opening tracking) | `music/bed_ambient_pad_loop8` | `title.trailerThin` | `look.film-scifi` |
| horror | flicker (a failing sign) | `music/bed_cinematic_drone_loop8` | `title.trailerDistressed` | `look.film-horror`, film16, heavy dust |
| drama | glow | `music/bed_orchestral_synth_epic_loop8` | `title.trailerGlow` | `look.film-drama`, 2.0 |
| documentary | type (typed on in mono) | `music/bed_documentary_marimba_loop8` | `title.trailerThin` | `look.film-documentary`, 1.85 |
| noir | drift | `music/bed_jazz_walk_loop8` | `title.trailerCut` | `look.film-noir` |
| period | type | `music/bed_acoustic_folk_pluck_loop8` | `title.trailerGlow` | `look.film-period`, 18 fps weave |
| anime-ink | slam | `music/bed_synthwave_loop8` | `title.trailerCut` | `look.film-anime-ink` + the ink pass |

CONFIG: `brand`, `platform`, `fps`, `length` (30-60), `aspect`, `genre`, `letterbox`, `style` (override), `film` (title, titleStyle), `text` (label, names `[role, NAME, after?]`, directedBy), `media` (texture slots t1-t5; `src: null` = labelled placeholder plates: smoke, beams, coast, ink, signal), `textures`, `perTexture`, `positions`, `secondsPerName` (snapped to whole beats), `music`, `beds`, `styles`, `transitions` (the texture dissolve and its reason), `sfx`, `claims`, `layers`; `PROJECT_MAP`.

**Honesty:** every name is "PLACEHOLDER NAME", the film is fictional, the textures are labelled placeholders, and the frame says "placeholder footage · fictional film · placeholder names". **Measured:** pending (disk full this round; see `LANE_NOTES.md`). Stills from the built page were checked for placement inside the letterbox.
