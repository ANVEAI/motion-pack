# templates/founder-story

A **personal-brand story told by the founder**, 16:9 (YouTube, LinkedIn, the site), with a 9:16 re-layout.

- **The talking head carries it:** a breath-keeping autocut and alternating framing.
- **Your own photos** come in as **Ken Burns** inserts on the words that name them.
- A **timeline of years** steps with the story.
- **ONE quote pull-out** of the speaker's own words.
- The end is a **brand field** with the call to action.

```bash
node make.mjs                                   # the quote gate -> plan -> mix -> index.html (16:9)
npx -y hyperframes@0.8.142 render . -o out/founder-story.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16                 # -> tall/index.html
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/founder-story-tall.mp4 --crf 23 -w 1)
```

## The quote gate

`text.quote` must be a **verbatim run of the transcript**: case and punctuation are ignored, and nothing else is. Otherwise `node make.mjs` exits 2 before anything is built:

```
founder-story quote gate: nothing built
  - text.quote: "it always starts with listening" is not a verbatim run of the transcript: quote the speaker's own words only
```

Captions pause while the quote card is up, because the card is the caption.

## Your inputs (CONFIG)

| key | what |
|---|---|
| `media.talk` | your clip |
| `media.photos[i]` | `src`, a `label`, the word it lands on (`at`), how long it stays (`dur`), and the Ken Burns move as `[scale, focus x, focus y]` from -> to. Your photo can be any aspect: the move pans inside it, cover-fit. |
| `text.years`, `text.yearsAt`, `claims` | your own dates, the words they step on, and a `source` for each one (a date is a claim) |
| `text.name`, `text.role`, `lowerThird.part` | the name super (`lowerThird.accentRule` by default) |
| `text.cta`, `brand` | the brand-field end card (`layers` brandField) |

## Honesty

- **The demo has no footage and no people:** a labelled silhouette, labelled photo cards (`YOUR PHOTO HERE`, with what the photo should be), a guide signal at the hand-timed words of `transcript.example.srt`, and a fictional brand.
- **The years are labelled** `example years · placeholder data`, in frame and in `claims`.
- **The quote** is verbatim from the demo transcript, and the gate keeps it that way.
