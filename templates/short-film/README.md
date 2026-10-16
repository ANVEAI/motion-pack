# templates/short-film

A narrative scaffold for a short film (60-180 s) beyond `templates/film-scene`'s single three.js scene: scenes of shots on **your footage**, on **the pack's three.js stage** (the film-scene render as a footage slot) or on labelled placeholder plates; an opening title over the first shot; chapter titles on black; scene slugs typed on; dialogue **subtitles from a lines or words JSON**; a **J / L cut builder** for each scene's sound; a dissolve for time passing; a dip to black into an **end-credits roll**; the genre finish (letterbox, grade, halation, weave, grain).

```bash
node make.mjs                                                     # the demo short, 16:9 -> projects/full-16x9/
node make.mjs --set aspect=9:16                                   # re-laid out             -> projects/full-9x16/
bash ../_shared/render3d.sh templates/film-scene scene.html wide 23   # from the repo root: the three.js stage render -> templates/film-scene/out/film-scene-wide.mp4
node make.mjs --set media.stage.src=$PWD/../film-scene/out/film-scene-wide.mp4 --set lines=$PWD/lines.example.json
node make.mjs --set voice.src=/abs/dialogue.wav                   # your recording: the bed ducks 12 dB under it, plan.audio.mode = vo
npx -y hyperframes@0.8.142 render projects/full-16x9 -o out/short-film-full-16x9.mp4 --crf 23
node short-film.test.mjs                                          # CI runs it
```

## CONFIG

- `scenes: [{ id, slug, chapter?: { kicker, title }, sound: sfx id (room tone, wind ...), tx?: [id, reason], shots: [{ slot, dur, sfx?: [{ id, at }] }] }]`: the story's spine; the shots lay out end to end.
- `lines`: inline `[{ scene, s, e, text, speaker? }]` (times relative to the scene), a path to the same as JSON (`lines.example.json`), or a whisper `words.json` (`[{ w, s, e }]`, grouped into lines of at most 42 characters at sentence ends and 0.6 s pauses: `linesOf()`).
- `jl: { j, l }`: each scene's sound starts `j` s before its picture (J cut); where there is no J, the previous scene's sound lingers `l` s (L cut). `templates/_shared/film/plan-film.mjs jlCut`.
- `media`: every slot; `stage` is the three.js stage slot (null = a labelled placeholder plate that says to render `templates/film-scene`).
- `film` (the opening title), `chapterDur`, `slugDelay`, `credits` (`dur`, `items`), `voice.src`, `music` + `scoreIn` + `bedDb` (the score enters on emotion: -30 dB until scene `scoreIn`, then -8 dB), `sfx`, `genre`, `letterbox`, `aspect`, `claims`, `layers`; `PROJECT_MAP` (`voice.words` -> `lines`).

**Honesty:** a fictional short ("THE LAST SIGNAL"); the dialogue is placeholder text shown as subtitles only (no voice is generated or faked); names in the credits roll are placeholders; plates are labelled. **Measured:** pending (disk full this round; `LANE_NOTES.md`); the stage render was not made in this round, so the demo uses the labelled placeholder for the stage slot.
