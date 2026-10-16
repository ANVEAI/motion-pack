# templates/podcast-clip

A **two-person podcast excerpt**, 9:16 first, with a 16:9 re-layout.

- **Frame 0** is a title hook card already moving over both faces.
- **The sharpest line plays first** (`hookLine.quote`): it must be a verbatim run of the transcript, or the build fails. The clip then plays from its start, so the line is heard again in context.
- **Layout:** the speakers are stacked (9:16) or side by side (16:9), or `layout: 'active'` shows one full-frame speaker at a time.
- **Active-speaker emphasis** comes from the speaker tags in the transcript:
  - the talker is at full brightness with an accent ring, and the listener dims;
  - the picture follows the voice with a **220 ms L-cut lag**;
  - each shot holds at least 1.4 s, and a turn under 0.8 s (an "mm-hm") never takes the picture.
- **Lower thirds** are tied to the speaker tags: one per speaker, at their first turn, inside their own panel.
- A **waveform** reads the voice stem's level frame by frame.
- **Captions** are karaoke, on the seam between the faces.
- The **end card** is "full episode".

```bash
node make.mjs                                   # 9:16 -> index.html
npx -y hyperframes@0.8.142 render . -o out/podcast-clip.mp4 --crf 23 -w 1
node make.mjs --set aspect=16:9                 # -> wide/index.html
(cd wide && npx -y hyperframes@0.8.142 render . -o ../out/podcast-clip-wide.mp4 --crf 23 -w 1)
node make.mjs --set media.host.src=/abs/host.mp4 --set media.guest.src=/abs/guest.mp4 --set media.mix.src=/abs/episode.wav --set voice.words=/abs/episode.vtt --set clip.from=1843.2 --set clip.to=1871
```

## Your inputs (CONFIG)

| key | what |
|---|---|
| `media.host`, `media.guest` | the two camera angles, synced on one timeline (`tools/human/conform.py sync` if they are not) |
| `media.mix`, `voice.audio` | `mix` takes the episode audio. `speaker` takes each speaker's own camera audio, only across their own words, so there is no bleed. |
| `speakers` | speaker tag -> `{ name, role, slot }`. The tags come from VTT `<v Name>`, diarisation, or ALL-CAPS `NAME:` lines. A tag with no entry is a build warning. |
| `clip.from` / `clip.to` | the excerpt in source seconds |
| `hookLine`, `button` | the cold-open line (`quote`, padding) and the word that starts the button (the last line before the end card) |
| `layout` | per aspect: `stack`, `split` or `active` |
| `active` | `lagMs`, `minShot`, how far the listener dims, the ring width |
| `waveform`, `captions`, `music` | bars and window; the shared caption picker; a quiet pad ducked 14 dB (`music: null` drops it to -60 dB) |

## Honesty

- **The demo has no footage and no people:** two labelled silhouettes, a guide signal per speaker (two different bands, plainly not voices) at the hand-timed words of `transcript.example.vtt`, and placeholder names ("Host name", "Guest name").
- **The hook and the end card are the clip's own words and the show's call to action.** No view counts, no quotes the speakers did not say.
