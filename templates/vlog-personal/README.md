# templates/vlog-personal

A **personal vlog**: you talking, cut tight, with your own B-roll. It ships 9:16 first (Shorts and Reels) and re-lays out for 16:9. The layer order is fixed:

1. Silence autocut that keeps breaths, plus the fillers you chose to cut.
2. The punch-in planner: framing alternates on every jump cut, and punch-ins land on emphasis words, one per 4 s at most.
3. A location / date card at the open.
4. B-roll inserts from keywords, as slots you fill, each with a **J / L split edit** on its own sound.
5. A **map route** insert.
6. **Sticker reactions** on trigger words.
7. Captions with **emphasis words**.
8. A music bed **ducked 12 dB under the voice**.
9. A follow CTA.

```bash
node make.mjs                                   # 9:16 -> index.html
npx -y hyperframes@0.8.142 render . -o out/vlog-personal.mp4 --crf 23 -w 1
node make.mjs --set aspect=16:9                 # the 16:9 re-layout -> wide/index.html, out/plan-wide.json
(cd wide && npx -y hyperframes@0.8.142 render . -o ../out/vlog-personal-wide.mp4 --crf 23 -w 1)
node make.mjs --set media.talk.src=/abs/talk.mp4 --set media.broll.coffee.src=/abs/coffee.mp4 --set voice.words=/abs/talk.srt
```

## Your inputs (CONFIG)

| key | what |
|---|---|
| `media.talk` | your talking-head clip. Its sound is the voice, through the tone chain. |
| `media.broll.<key>` | your B-roll: `src`, `start`, a `label` (the shot to film, printed on the placeholder), `nat` (use its own sound as a J / L edit), and `amb` (the pack ambience that stands in until you have the clip) |
| `broll.keywords` | keyword -> slot. `auto: true` also fills up to `coverage` with the longest content words (`tools/human/human.mjs broll` prints the slot list first). On 16:9, `layout16` picks per insert between `cutaway` (full frame) and `split`, the split-screen reaction layout with you on the left and the clip on the right. |
| `autocut`, `fillers`, `voice.breaths` | silence threshold and padding, the 120 ms of air kept, the 450 ms beat hold after a punchline; which fillers to cut; a breaths.json from `tools/human/breaths.py` |
| `framing` | the alternating ladder and the eye-line anchor per aspect, the punch scale and the minimum gap between punch-ins |
| `jl` | how far the insert's sound leads its picture (J, 300 ms) and how far it runs after it (L, 450 ms), and its level |
| `map`, `text.route` | when the route insert plays, and the start, end and distance with a `source` (printed in frame; "placeholder data" until you name yours) |
| `reactions` | `{ match: word, sticker: name }`, from the owned sticker set (`type/gfx/stickers.js`) |
| `captions` | the `emphasis` look from the shared picker; `emph` lists the words that pop |

## Honesty

- **The demo has no footage and no people:** a labelled silhouette, labelled B-roll cards (`YOUR B-ROLL HERE`, with the shot to film), and a guide signal at the hand-timed words of `transcript.example.srt`. The "um" in it is cut by `fillers.cut: 'hard'`; the soft filler stays.
- **The place is fictional** ("Placeholder Harbour").
- **The map distance** is a claim with the source `placeholder data` (in `claims` and in frame).
- **The insert sounds** are pack ambience until you supply your clips.
