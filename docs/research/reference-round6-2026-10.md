# Reference study, round 6: two brand-launch films (14 Oct 2026)

Two more public films, measured with `tools/refstudy.py` and graded with `refstudy.py grade`; both contact sheets were looked at and the loudness timeline of the second was opened. The per-beat studies and stills stay in the intake folder outside the repository (`skills/motion-pack/references/reference-intake.md`); this page is the paraphrased summary.

**Use:** craft reference only. Never copy a brand, footage, mascot, wording, music or an exact sequence. Nothing in the pack's parts, tests, templates or demo copy repeats these films; the pack's own demo uses a placeholder brand and original wording. Named sources appear on this page only.

**Sources (links as stored in each study's `meta.json`):**
- Film A, a 50.8 s 16:9 product-launch film for a no-code AI builder: <https://x.com/lovable/status/2110355248237928857> (125,779 views on a 157,918-follower account at study time).
- Film B, a 30 s 1200 x 1200 typographic explainer for a developer product: <https://x.com/walrusprotocol/status/2062646758568603739> (66,434,787 views on a 347,095-follower account at study time).

## Evidence tiers (read these before the takeaways)

| film | reach | like / bookmark rate | tier | how to read it |
|---|---|---|---|---|
| A | 0.80x its followers | 0.74% / 0.76% | **C** | below follower reach and under the 1.3% saves line: a craft reference, not proof of reach |
| B | 191x its followers | 0.015% / 0.003% | **B (boosted-looking)** | an inference from the like rate and the reach-to-followers ratio; nothing shows that any reach was paid for. Do not read the 66 M as a signal for the format |

So neither film is proof that its shape works. They are two worked examples of craft, and the numbers below are starting values to tune, not findings.

## Film A: product-launch film, no voice (tier C)

- **Edit:** 19 cuts (22.4 a minute), median shot 1.93 s, longest 12.35 s; 42% of cuts on a sound onset, 11% on a beat.
- **Sound:** -12.8 LUFS integrated, peak -1.3 dBFS (louder than the pack's -14); bass 55%, high 9%. It opens quietly (-20.8 dB) and stays low for about 8 s (logo, dock, cursor), then the full bed and hits arrive with the first big UI scene; the tail decays to -32 dB under the logo. No speech. (Its tempo estimate of 68 BPM is a half-time reading of a busy pulse: do not copy it.)
- **Craft takeaways:**
  1. Verb chapter cards (one giant word that settles into a subtitle) as the spine of a feature tour.
  2. One fictional running example carries every scene.
  3. A cursor-led UI with an app-launch moment (a dock icon magnifies as the cursor passes, then opens into the app).
  4. Connection rows whose button turns into a confirmed state with a tick.
  5. A hover tooltip on a bar chart (label, value, a small delta pill).
  6. Light and dark scenes alternate (the ads are shown on a light page after the dark ones).
  7. A quiet first 8 s, then the bed.
- **Climax:** an insight turns into a real artifact (placeholders resolve into the finished cards), then the channels converge on the product mark.

## Film B: 30 s typographic explainer, no voice, zero cuts (tier B, boosted-looking)

- **Edit:** zero cuts; one continuous black page, text typed or blur-swapped in place.
- **Sound:** -11.0 LUFS integrated with a +0.6 dBFS peak (it clips: do not copy that); bass 58%; tempo estimate 112 BPM. **A near-silent gap of about 2 s** (a faint hum, then true silence for about 1 s) sits just before the brand line appears; the bass returns on the reveal. The last 2 s are near-silence (-73.7 dB): a quiet hold under the URL. No speech.
- **Shape (problem, pivot, value, ask), times read from the 2-per-second contact sheet:**
  1. A sentence typed with a cursor, then its one-word answer in the accent colour, blurred in.
  2. A three-beat problem ladder (about 2-2.5 s a beat): each a two-word caption under a small line-icon diagram that **gets worse each beat**; captions swap by a blur-through.
  3. The sound thins to a hum, then true silence; a light-weight lead word appears at the end of it.
  4. The pivot: the brand line in two weights with a glowing **aurora ribbon** rising along the bottom (the first colour in the film) while the bass returns. The black-and-white problem becomes colour only here.
  5. A three-or-more-beat value ladder, each beat a caption with a tiny box diagram that rearranges.
  6. A terminal-style outlined pill types a command, then the address with the path word in the accent colour; the sound stops and the last 2 s hold on near-silence.
- **Climax:** the pivot: the gap, then colour and bass arrive together on the brand line.
- **Craft takeaways:** (a) problem / pivot / value / ask as a continuous film; (b) the accent word as the punchline of a typed sentence; (c) a diagram that degrades across a three-beat problem ladder; (d) a sound gap of about 1.5-2 s into the reveal; (e) an aurora ribbon as the "solution" ground; (f) a typed command pill as the CTA; (g) a square format with generous safe margins.

## What round 6 changes in the pack

1. **Both round-4/5 rules hold again:** a quiet open (film A: -20.8 dB for about 8 s) and a quiet-hold ending (film B: -73.7 dB) are present in both.
2. **Bass by role needs a fourth row, `brand_launch`: 50-60%** (55% and 58% in the two films: a thin base, one of them tier B). Keep "bass follows the role". `ears` reports it with `--role brand_launch` / `plan.audio.role`, and says "round 6 references, craft only"; `music/README.md` lists the beds inside the range.
3. **Loudness reality:** both ship at -11 to -13 LUFS and one clips. The pack keeps -14 LUFS / -1.5 dBTP and a guarded ceiling.
4. **Continuous films are now 8 of 31** (film B adds one more with zero cuts); sync them by motion events, not by cuts (`ears --mode continuous`, `plan.audio.events`).
5. **Planned silence as shape:** film B is the clearest example so far of a mid-film gap of about 1.5-2 s that ends exactly on the reveal. The pack now generates it as data (`cutgen.py problem-pivot`: the bed automation, the `plan.audio.quiet` kind `gap`, the pivot frame, and a check that the bed and a bass hit are back ON that frame).

## What was built from it (this lane)

| gap | built as | where |
|---|---|---|
| `background.auroraRibbon` | a bottom-anchored glowing ribbon (closed-form curves, layered gaussian glows, seeded grain, an exact-seam loop, a rise time with a sound that leads it) | `layers/backgrounds-r6.js`, `layers/tests/r6.test.mjs` (+ `tools/mutation_check.py`) |
| `cuts.story.problemPivot` | a deterministic generator and checker for the continuous shape | `cuts/story6.py`, `cuts/test_story6.py`, `cuts/patterns.json` `story.problemPivot` |
| the round-6 role | `brand_launch` bass range for `ears` and the music README | `ears/manifest.json`, `music/make_readme.py` |
| a worked example | a 30 s square film with a placeholder brand | `templates/demo-r6-pivot` |

Not built here (other lanes or later): the verb chapter card, dock launch, connect rows, hover tooltip, degrading-diagram part and command pill as reusable parts. The demo's diagram and pill are local to the demo and say so.

## Honest limits

- Two films, one tier C and one tier B: the 2-2.5 s problem beats, the 1.5-2 s gap and the 2 s hold are ranges read from one film each. They are defaults to tune, not rules proven by reach.
- Times were read from a 2-per-second contact sheet and a 4 Hz loudness curve: they are good to about half a second.
- The "gets worse each beat" diagram and the ribbon are craft ideas; nothing here measures that they raise retention.
- No human has listened to the demo's mix. `ears` reads its shape; audition it once before a hero use.
