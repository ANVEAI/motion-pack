# templates/proof-film

The **proof film** (storyboard shape I, launch-playbook L8): a claim, the name, a method card, ONE builder, head-to-head rows, big numbers, three stat cards and a URL, 36-60 s, 16:9 with a 9:16 re-layout. One continuous camera (`camera/cam2d.js`) travels between the panels: there are no hard cuts unless you ask for one and give the reason.

Its one rule: **every number needs a source AND a method, or the build fails.**

```bash
node make.mjs                                   # gate -> plan -> mix -> index.html (16:9)
npx -y hyperframes@0.8.142 render . -o out/proof-film.mp4 --crf 23
node make.mjs --set format=tall                 # the 9:16 re-layout -> tall/index.html (its own HyperFrames project), out/plan-tall.json
(cd tall && npx -y hyperframes@0.8.142 render . -o ../out/proof-film-tall.mp4 --crf 23)
node make.mjs --set builder.kind=trace          # or table (trace is 16:9 only)
node proof-film.test.mjs                        # the gate, plan, camera, labels, safe zone and VO mechanics (CI runs it)
python3 ../../ears/listen.py out/proof-film.mp4 --plan out/plan.json
```

## The film

| stage | what | part |
|---|---|---|
| claim | at most 6 words, one `*accent*` word; the words spring in from frame 0 | drawn here |
| name | the mark, "Introducing", the name, a one-line promise | drawn here |
| method card | what was measured, on what, against whom, and the counts (each a number field) | drawn here |
| builder | ONE of `scatter` (cost vs score, a frontier line, a starred hero), `trace` (parallel checks, one wrong fork turns red and the red runs to the result), `table` (builds under a one-line finding) | `chart.scatterFrontier`, `ui.branchTrace`, `ui.dataTable` |
| head-to-head | rows against the alternative, the ours column highlighted (skipped when the builder is the table: it already is one) | `ui.dataTable` |
| big numbers | 1 to 3, counting up, each with its own source and method line | drawn here |
| three stat cards | better / leaner / cheaper, each with a bar against the alternative | drawn here |
| end card | the name and the URL held still: a quiet hold, no stinger | drawn here |

**A hard cut is the exception:** `cut: { 'builder>h2h': 'EMOTION: the failure lands, so the next idea starts clean' }` in `config.mjs` turns that boundary into a jump (a zero-length leg and a `sfx/tx/cut_tick`). The reason starts with its Murch reason in capitals or the gate refuses it.

## The honesty gate (`honesty.mjs`)

- **Every number field has a `source` and a `method` that say something.** A number field is a setting count, a scatter point (`x`, `y`), a table value, a big number, a stat card (and its `alt`). A field inherits from its container (`builder.scatter.source`, `h2h.method`; a row may override with its own). Missing, `''`, whitespace-only and non-string values count as missing; so do filler (`n/a`, `tbd`, `.`, `xxxx`), a source under two distinct letters, a method under eight letters or two words, and a method that repeats the source (`weak()`). A filler on a container is one message naming the container.
- **`node make.mjs` exits 2** with every problem, each naming the field (`cards[1] ("Leaner"): no `method`...`), before it stages, mixes or writes anything. `cues.mjs` and `buildPlan` fail the same way (`HonestyError`); a CONFIG of the wrong shape (a string where a list belongs, `hero.callout: 'text'`) is a message too, never a stack trace.
- **A number only appears through a number field.** Not in the claim, the brand name, the URL, a label, a card line, diagram text, a table bar title, an axis prefix or suffix, and not in the VOICE. "A number" is a digit in ANY script (`6`, `６`, `٦`, `६`, `²`, `½`, `①`, `Ⅷ`), a currency sign, a percent sign, or a number word (`sixty`, `ten-times`, `percent`, `twice`, `double`, `half`, `tenfold`, `zero`). `one` is allowed (it is a pronoun as often as a count), as are ordinals. A domain with a digit in it (`forms2go.example`) needs `brand.urlHasNumber: true`. `unit` is a token the parts format (`'' K M % $ s ms dur`), not prose.
- **The voice is checked too.** `config.mjs gateProblems` reads `vo.words` (the transcript you give) and refuses any spoken number: `vo.words[12] ("sixty" at 4.2 s)`. Say it without the figure ("a lower cost") and let the number sit on screen with its source and method. The gate reads the transcript, not the audio: a recording that says more than its words.json is on you.
- **The claim** is at most 6 words with exactly one accent word. **Three** stat cards, **one** builder of a known kind, `illustrative: false` only when no source still says placeholder, a hard cut only with a Murch reason (`EMOTION: ...`, one of EMOTION, STORY, RHYTHM, ENERGY, REVEAL, PLACE, EYE_TRACE, SCREEN_PLANE, SPACE, and a why of a few words).
- **In frame:** the source and method print beside the numbers (the scatter and table parts print their own footnote at 17-19 px; the method line, the cards, the numbers and the method card are drawn here at 24 px, 30 px on 9:16), and the honesty label `ILLUSTRATIVE · PLACEHOLDER DATA` is drawn on EVERY number panel, the builder (scatter, trace or table) and the end card: a mono pill, **28 px on 16:9 and 30 px on 9:16** (frame-design frames.md section 5), at the same spot (bottom-left of the safe rect), in before the first number is on screen, held for the whole panel. The sources and methods are fully visible 1.2 s after a panel starts. The demo is "Acme Reader", a fictional brand, with the source `illustrative placeholder, replace` on every number. To go real: write the real source and method on every field, set `illustrative: false`, rebuild (the pill then draws nowhere).
- **Not detected (limits):** whether a source is TRUE (the gate refuses empty, filler and repeated text, not lies), a made-up brand, `one`, ordinals and vague quantities ("a lot cheaper"), and anything a recording says beyond its transcript. Read the sheet before you publish and listen once.

## Config (the CONFIG block of `config.mjs`)

`format`, `brand` (`accent` / `ink` / `paper` / `muted` map to frame-design's `palette`, see `skills/frame-design/references/design-json.md`; `urlHasNumber`), `claim`, `name`, `setting`, `builder` (`kind` plus one block per kind), `h2h`, `numbers`, `cards`, `end`, `tail` (the hold: `holdS`, the bed's `bedDb` and the room tone's `roomDb`), `timing` (the camera's `travelS`, `ease`, `dip`, `push`, `enterS`, the seconds of build per stage; stages round up to whole beats of the bed; `minS` 36 and `maxS` 60 are the window of a proof film: a film shorter than `minS`, such as a table builder that skips the head-to-head stage, gets its dwell lengthened across the content stages), `cut`, `vo`, `music` + `bpm`, `sfx`, `layers`. Everything the film shows is in it.

## 16:9 and 9:16

9:16 is a **re-layout**: the panels are re-composed for a tall frame inside the conservative safe zone (x 65-960, y 269-1248 of 1080 x 1920), and the camera travels down instead of across. The timeline is identical, so one stage list and one mix serve both (`out/plan.json`, `out/plan-tall.json`). The fine print is 30 px on 9:16 (24 px on 16:9), the pill 30 px (28 px). The camera's slow dwell push moves a point at the edge of a safe rect out of it, so the content uses the rect pulled in by `1 + push` (`panels.mjs safeInset`). Every variant (scatter, table; 16:9 and 9:16) runs 36-60 s, tested. The 9:16 page is its own HyperFrames project, `tall/index.html` with its own `assets/`: two root compositions in one folder are a `hyperframes lint` error.

**`ui.branchTrace` is landscape-only, so `builder.kind: trace` is 16:9 only: the gate refuses it on 9:16** (on a 1080 px wide frame its 15 px labels would print at 7 px). Use `scatter` or `table` for a 9:16 post, or post the 16:9 master. The trace builder on 16:9 prints its labels at 15 px at 1080: fine on a TV or a laptop, small on a phone.

## Camera (`panels.mjs cameraFor`)

Two nested cam2d state functions. `pan` (the world) is one `pan2d` leg per stage change with an eased glide; `zoom` (a frame-sized wrapper around it, about the frame centre) dips 8% while the camera travels and pushes in 3.5% while a stage dwells. A cell's content starts `enterS` (0.15 s) after the camera leaves for it, so something is always moving. Every number in `draw(t)` is a pure function of `t`: the page re-draws on `hf-seek`, and `window.__seek(t)` / `window.__ready` let `skills/motion-stack/scripts/seekcheck.mjs index.html` test it.

## Sound

- **Bed:** `music/bed_playful_bounce_loop8` (120 BPM; bass share 33% in the delivered mix against 20-36% for a proof bed). Stages start on its beats.
- **Cues** (`sfx/` ids from the `saas_launch` / `product_ad` palette): a quiet UI tick per state change, a slide per camera move, the parts' own per-action cues, ONE soft hit (`sfx/hit/soft`) on the number reveal, **nothing on the end card but a tick and the room tone under the hold**. Every cue time is a whole frame.
- **Planned shape** (`plan.audio.quiet`): a quiet open (the picture moves from frame 0, the first sound is the accent word at 1.2 s) and a quiet hold (the bed lifts for 0.8 s, then falls to -40 dB while `sfx/amb/room_tone` takes over: 4.0 s under the end card, no stinger). The room tone is what makes the hold read as a hold: a kick-pulsing bed that only falls is a decay to `ears` (its pulse is 10 dB at any level; refstudy wants the last 2 s flat within 8 dB). `tail.roomDb` (-26) is the room tone's level under the un-dipped bed (plan cue `overBedDb`, passed through `templates/_shared/audio.py`). `plan.audio.mode` is `continuous`, `role` is `proof`.
- **Master:** -14 LUFS-I; `ceilingDb` is -3.0. At -2.0 and -2.5 HyperFrames logged `Audio lowered` for this cue list (delivered -15.2 and -14.9 LUFS): grep the render log after every change.

## Optional sparse VO

Off by default. `--set vo.words=/abs/words.json` (`[{w, s, e}]` in seconds, or `{words: [...]}`; whisper output works) turns it on, `--set vo.audio=/abs/voice.wav` is your recording (decoded from 0 s; without it `vo.py` builds a labelled guide signal for a dry run, never a voice). `cuts/cutgen.py walkthrough` then puts every stage change in a speech gap (never inside a word, one sentence per stage; the camera leaves for the end card after the last word), the bed ducks `duckDb` (16) dB under the voice, and every cue under a word sits under the voice (`overVoDb`). `plan.audio.mode` becomes `vo`; run `ears` with `--transcript out/transcript.json`. `words.example.json` is hand-timed placeholder text at about 160 wpm with a 1.1 s breath after each sentence. A synthetic voice is AI content: say so in the post. Nothing here calls a speech service.

## Measured (the demo, 2026-10-14)

- 37.6 s, 1920 x 1080 and 1080 x 1920, 30 fps, CRF 23 (8.7 MB and 8.2 MB; the MP4s are not in git, `out/plan*.json` and `out/sheet*.jpg` are).
- Decoded from the delivered files: **-14.23 LUFS-I, -1.29 dBTP**, nothing lowered by HyperFrames.
- `ears` (with the plan): every check passes on both, sound scores 10, cue anchors on F + 1 for 100% of the cues it can find, the planned open and hold recognised.
- Determinism (`tools/critic_pack.sh` double render, 1128 frames): 241 frames differ by at most 2 of 255 per pixel (worst PSNR 88.7 dB: GPU blur noise, the pack's bar is 60 dB). `seekcheck.mjs`: same twice and cold = warm pass, the shuffled-order differences are 95-116 dB.
- `node proof-film.test.mjs`: 216 checks.

## Honest limits

- The sound is measured, not auditioned: listen once on a phone before you post.
- `ears` reads the ending as a decay (29 dB under the body) rather than a quiet hold, because the bed's kick still pulses 10 dB at that level and its classifier wants a flat tail; the planned hold passes.
- With a VO, `ears` reads the duck in the band under 100 Hz and the bed's bass pulses: the demo master measures a 11.6 dB median duck with one line warned, and cues under a voice read as masked rather than late.
- The head-to-head and builder numbers are placeholders by design; the template cannot tell a real number from a made-up one, only that it has a source and a method.
