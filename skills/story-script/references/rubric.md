# Script review rubric

Score every draft before it leaves this skill. Each criterion is 0, 1 or 2. **Ship at 16 of 22 or more, with no zero on Stake, Turn, Payoff or Honesty** (house thresholds; raise them for hero films). Write the table into `script.md` with one line of evidence per score.

| # | criterion | 0 | 1 | 2 |
|---|---|---|---|---|
| 1 | **Stake** | none, or abstract ("efficiency") | stated in words, not felt | shown on screen early and felt: money, a client, a deadline, a secret, a promise |
| 2 | **Turn** | none, or several | present but late, muddy or unfilmable | one turn, one filmable verb, where the format wants it |
| 3 | **Product as the quiet turn** | it pitches, explains or performs | present but not what changes the story | it quietly causes the turn and never asks for attention |
| 4 | **Payoff** | a generic cheer or a logo | partly resolves the stake | the stake from the opening, visibly resolved |
| 5 | **Clarity** | the sound-off sentence cannot be written | needs sound or captions to follow | the muted test passes (3 of 5 people can say what happened) |
| 6 | **Hook** | black, logo, title card or a name in the first second | a situation label or a still face | the stake in motion on frame 0, with a sound on frame 0 |
| 7 | **Honesty** | an invented number, quote or review; a concept passed off as real | a label or source missing somewhere | every digit sourced; every illustration, demo figure and planned feature labelled in frame and in copy |
| 8 | **Economy** | a feature parade, or every note added | one or two passengers | nothing left to cut; nothing after the button except the brand |
| 9 | **Originality** | a replica of a reference | recognisably derivative | the craft absorbed into our own story |
| 10 | **Ending** | trails off, or a coda after the button | lands, but flat | a button with wit or feeling; the card held long enough to read |
| 11 | **Sendability** | nobody to send it to | a generic audience | a specific person comes to mind; the send line names them |

## Failure to fix

| symptom | likely cause | fix |
|---|---|---|
| "It has no story" | beats are vignettes; no one wants anything | give one person one want and one clock; cut every beat that does not move that want |
| "It's a feature list" | several features compete | one feature per film; the others become a series |
| "It feels like an ad" | the product explains or performs | make the product the cause of the turn; move the explanation to the caption |
| "I don't get it" (muted) | meaning lives in the voice-over or in text | stage the meaning: a visible state change, a reaction, light that flips |
| Viewers leave in 2 s | slow open, a label or a still face on frame 0 | open on the stake in motion; flash-forward the conflict for vertical cuts |
| The turn lands at 70%+ | too much setup | compress the setup to the rule of three; start in the middle |
| The payoff is a cheer | the stake was never concrete | rewrite the stake as an object you can show resolved (the bill, the file, the empty chair) |
| Labels kill the mood | labels are too big, too many or too late | one small designed label per shot that needs it, held 2 s; fine print on the end card |
| It looks like AI slop | abstract imagery (glowing nodes, floating cards) | replace with concrete artefacts the story already uses |
| It grew to twice the length | every review note was added | subtract to the spine, then add only what the spine lacks |
| The mascot is remembered, the feature is not | the gag resolves on the character, not the product | the payoff is the feature's state change; name the feature in the end line |

## Case study: three rejections and two favourites

Generalised from one maker's launch-film and short-film rounds. The verdicts were blunt; the reasons are the reusable part.

1. **A film built on a format conceit** (an "audit record" of AI use, with real screenshots as exhibits and a cable pulled as proof). It was honest and technically careful, and it was rejected in the strongest terms. Nobody in it wanted anything: the documents were the subject, the screenshots read as static paperwork, and the labels were so frequent that the film read like a compliance file. **Fix that worked:** one small firm, one matter, one clock ("due 9:00 AM"); every scene moved the matter forward and carried a time; the drop resolved the story ("Filed."); the button was wit.
2. **The same film after many rounds of notes**: it had grown to over a minute, with more than a dozen supers, cards everywhere, two languages and a voice-over. Rejected as "not good". **Fix:** subtract. One scene, one problem, one solution; one language; music and sound design only; one photographed hero shot of the product.
3. **The clean version, built as five problem-to-solution vignettes.** Each beat was clear; the whole had "no storylining". **Fix:** a through-line: one protagonist and one turn, or one continuous place, with every fix accumulating instead of resetting.
4. **The favourites** were two short films with the same shape: a named, sympathetic protagonist with a concrete stake (a bill that keeps arriving; a confidential file one click from a public chatbot at midnight), the product arriving as a quiet turn (left on a shelf, noticed in a sudden quiet), a payoff that resolved the stake (the bill reads zero; at dawn the boss leaves tea and switches off her lamp), and honesty labels in frame that did not break the spell ("demo figures", "fictional chatbot · demo data").

## Hand-off checklist

- [ ] The four lines and the sound-off sentence are in `script.md`.
- [ ] `python3 scripts/lint_shotlist.py shotlist.json` exits 0, and you read its warnings.
- [ ] Three hook variants with different archetypes, on an identical body.
- [ ] Every digit in a super, card or claim has a `source`, or the shot carries a label.
- [ ] Every honesty label is listed in `script.md` with where it appears.
- [ ] The rubric table is filled in, scores 16 or more, and has no zero on Stake, Turn, Payoff or Honesty.
- [ ] The notes for frame-design name the hero of each key frame and the lead aspect.
