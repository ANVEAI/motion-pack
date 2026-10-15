# templates/course-lesson

**One lesson of a course**, 16:9 (the course page, YouTube), with a 9:16 re-layout for a lesson teaser. The lesson is a list of sections, each with its own layout, and each cut on the word that starts it:

| section | 16:9 | 9:16 |
|---|---|---|
| `presenter` | you, full frame | you, full frame |
| `slide` | the slide full frame, you in a circle PiP | the slide on top, you below |
| `split` | slide 1180 px wide, you on the right | slide and you stacked half and half |
| `quiz` | a quiz card: the question, a **pause ring while the viewer answers** (the autocut keeps the pause: `hold` on the last word), then the answer lights up | same card, sized from the shorter side |
| `recap` | recap card, items tick in turn | same |

A **lesson progress bar** runs across the top, with a tick at every section. The slides are drawn from **your text** (`text.slides`: title + bullets that reveal on words), or are **your images** (`media.slides[i].src`).

```bash
node make.mjs                                   # 16:9 -> index.html
npx -y hyperframes@0.8.142 render . -o out/course-lesson.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16                 # -> tall/index.html
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/course-lesson-tall.mp4 --crf 23 -w 1)
```

## Honesty

- **The demo has no footage and no people:** a labelled silhouette presenter, a guide signal at the hand-timed words of `transcript.example.srt`, and an example lesson of fictional copy (`Example lesson`).
- **No numbers on screen** besides the progress bar, which measures the video itself.
