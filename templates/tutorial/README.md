# templates/tutorial

A **screen-recording tutorial**: your screen recording and a webcam, cut and dressed for YouTube (16:9) and re-laid out for Shorts and Reels (9:16). The shape:

1. The **result** comes first: frame 0 shows the finished state with a hook card already moving.
2. Numbered **steps**, each opened by a step card.
3. A **step counter** that stays up.
4. **Zoom-follow-cursor** on every click.
5. A **keyboard-shortcut overlay**.
6. A **highlight box** or **spotlight** on what to look at.
7. A **code callout** with line highlighting.
8. The **result reveal**.
9. An **end screen** with labelled next-video slots.

```bash
node make.mjs                                   # plan -> voice stem -> mix -> index.html (16:9)
npx -y hyperframes@0.8.142 render . -o out/tutorial.mp4 --crf 23 -w 1
node make.mjs --set aspect=9:16                 # the 9:16 re-layout -> tall/index.html (its own project), out/plan-tall.json
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/tutorial-tall.mp4 --crf 23 -w 1)
node make.mjs --set media.screen.src=/abs/rec.mp4 --set media.webcam.src=/abs/cam.mp4 --set voice.words=/abs/talk.srt
```

## Your inputs (CONFIG)

| key | what |
|---|---|
| `media.screen.src`, `media.screen.size` | your recording, and its pixel size: the zoom maths and the cursor live in it. Convert VFR recordings first (`docs/bring-your-footage.md`). |
| `media.webcam.src` | your face cam, or `null` for the labelled silhouette. On 16:9 it is a PiP: circle, rounded or square, in any corner, `pip.size`. On 9:16 it is stacked above the screen. |
| `voice.words`, `voice.audio`, `voice.chain` | the transcript (`.json`, `.srt`, `.vtt`); which slot's sound is the voice; the tone chain on or off (`tools/human/voice_chain.py`) |
| `cursor.track` or `cursor.clicks` | a recorded pointer track, or click times anchored to words (`{ at: { word: 'run,' }, target: [x, y] }`). Clicks give an ESTIMATED track: a minimum-jerk arc that settles 140 ms before each click (`tools/human/human.mjs cursor`). The plan records which one it used. `cursor.draw: 'auto'` draws our pointer only over the placeholder, because your recording already has one. |
| `zoom` | the scale per aspect (1.8 on 16:9, 1.35 on 9:16, where the cover-fit already crops), lead, ramp, hold, how close clicks merge, and how many seconds of cursor the view averages (`follow`: it glides, it never jitters) |
| `pip.autoHide` | `['cursor']` fades the PiP when the pointer nears its corner. `'zoom'` hides it while zoomed. `hideOnCards` hides it under the step cards, the code callout and the end screen. |
| `shortcuts`, `highlights`, `code`, `result` | the key combo overlay; the highlight boxes and spotlights (boxes in screen fractions, or a named target of the placeholder desktop); the code callout (lines from your file, highlight ranges on words); the result reveal |
| `text.chapters`, `text.hook`, `text.endSlots` | step cards and counter titles; the hook; the end-screen slot labels. The slots are placeholders for the platform's own end-screen elements, and say so in frame. |
| `captions.style` | per aspect, from the shared picker: `minimal` (46 px) on 16:9, `karaoke` on 9:16 |

Every event time is a word of the transcript (`{ word, nth, offset }`) or seconds, so a re-recorded take re-times the whole edit.

## Re-layout, not crop

| | 16:9 | 9:16 |
|---|---|---|
| screen | full frame, contain-fit | a 1080 x 1000 panel under the webcam, cover-fit: the view pans with the cursor even unzoomed |
| webcam | 300 px PiP, bottom-right, white ring | 1080 x 640 band at the top (under the platform's top bar, so no text there) |
| captions | 46 px, left of the PiP | karaoke 72 px at the foot of the safe zone |
| key combo / code callout | top centre / centred panel | top of the safe zone / a panel over the screen |

## Honesty

- **The demo has no footage and no people.** The screen is a FICTIONAL app drawn in SVG ("Orbit Notes"), labelled `PLACEHOLDER RECORDING · fictional app` in the frame. Its state replays `screenEvents`: typing, a file select, a toggle, terminal lines.
- **The webcam** is a silhouette labelled `WEBCAM PLACEHOLDER`.
- **The voice** is a guide signal at the hand-timed words of `transcript.example.srt`.
- **No numbers are claims:** the step numbers are the tutorial's own ordinals (allowed in `type/tests/honesty-defaults.test.mjs`), and the code callout is labelled `placeholder code`.
