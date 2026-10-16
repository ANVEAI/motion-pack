# Explainer, data-story and process how-to patterns (lane explainer, 16 Oct 2026)

Evidence notes behind the `explainer` reuse and the two new structures in `patterns/structures.json` (`data-story`, `process-howto`), and behind the honesty rules the three templates enforce. Grade: **inference** (practitioner craft, not a measured study). Every number in the structures is a tunable default. Nothing here was measured on our own videos yet; the renders are pending (see `docs/lane-notes/explainer.md`).

We studied the craft, not any one film. No shots, copy, music or designs were copied. This document names no channel or newsroom on purpose: the patterns below are common practice in the genre, and they are stated as such, hedged.

## What "how it works" explainers tend to do (the `explainer` structure, reused)

- **They open on the question, over a picture that is already moving.** The viewer is told what they will understand, and the first diagram is drawing on frame 0. This matches the pack's hook rule (`skills/motion-pack/references/virality.md` §1).
- **They show the wrong model before the right one.** A simple, wrong picture (one straight trip; every town to every town) gives the viewer something to discard. The reframe then lands as a relief, not a lecture. This is the "wrong model -> reframe" beat of the existing `explainer` pattern.
- **One canvas, many camera moves.** Strong diagram explainers keep one diagram and move a camera across it, instead of cutting between slides. The viewer keeps their place. The template has no hard cuts: every change is a camera beat, a node landing or a highlight, so pace is scored from motion events (`plan.audio.events`, structure_check's continuous mode).
- **Build step by step, then dim what is not being talked about.** A node appears only when it is named; highlight + dim points the eye; a note pinned to a node carries the one phrase the voice says about it.
- **Zoom into one box to explain what is inside it.** The "powers-of-ten" move from the pack (`cam2d.scaleDive`) applied to a diagram: the camera dives until a node fills the frame, and the inside of that node becomes the new diagram. It is used once, on the step that is hardest to picture.
- **Trace one item through the whole system.** After the mechanism is built, one example travels the path (focus + flow on the path edges). That is the proof beat.
- **Recap, then one takeaway line.** A short recap card, then a single sentence held on the end card.

## What data stories tend to do (`data-story`, new)

| section | share of runtime (default) | what happens |
|---|---|---|
| hook | 0-10% | the question on screen by 0.5 s, over a chart already drawing |
| context | 8-34% | the baseline chart, built in steps; one annotation leader on the datum that matters |
| evidence | 32-56% | "the number that matters" counted up, then the honest comparison |
| detail | 54-88% (optional) | a breakdown: a scrolly text column beside a chart that highlights as the text steps; a map |
| takeaway | 84-100% | one line held with every source; CTA window 82-94%, held at least 3 s |

- **One number, made big.** Data-journalism shorts tend to give the single most important number its own frame, large, with its unit and one context line.
- **Annotate the datum, not the chart.** A leader from a short label to the exact bar top or point does more than a legend. `callout.datum` reuses the chart's own geometry, so the dot always lands on the datum.
- **Scrollytelling, adapted to video.** The web pattern (a text column that scrolls past a sticky graphic that changes with each step) translates to a timed column whose active card lines up with a highlight in the chart.
- **Sources on screen.** Newsroom graphics conventionally carry a source line on every chart. The template makes it unconditional.

## What process how-tos tend to do (`process-howto`, new)

| section | share | what happens |
|---|---|---|
| hook | 0-12% | the promise ("X in four steps") while the numbered steps draw on their timeline |
| steps | 10-72% | one step at a time: the timeline fills, the step's icon lights, a tip card; done steps tick |
| result | 68-86% | before / after |
| checklist | 82-100% | what you need, ticked one by one, held as the end card (CTA window 80-93%, >= 3 s) |

- **Show the count up front.** "In four steps" sets the viewer's expectation and the timeline keeps it visible.
- **One step on screen at a time, the rest visible but quiet.** The active step is lit, past steps are ticked, future steps are dimmed.
- **End on something the viewer can save.** A checklist end card is the shareable frame.

## Honest axes and sources (what the templates enforce, and why)

These are widely taught charting rules (data-visualisation textbooks and newsroom style guides state them in various forms). The pack turns them into build failures:

1. **Bars and areas start at zero.** Length and area encode magnitude; a bar that starts at 90 makes 95 look twice as big as 92.5. `chart.story` always draws bars and areas from zero; the gate refuses a non-zero `yMin` (exit 2).
2. **A truncated axis is labelled in frame.** Lines and scatters may start above zero (they encode position, not length), but the frame must say so. The part draws an axis break and a label it cannot hide; the gate refuses a truncated axis without the author's own label text.
3. **Every number has a unit.** No unit, no build.
4. **Every chart frame carries its source, method and (for demo data) a DEMO DATA pill.** The footer is drawn by the chart part itself, so no layout can drop it.
5. **Every on-screen number comes from the dataset file and is claimed with that dataset's source** (lint.proof), never typed into copy.
6. **One axis per chart.** No dual axes (the `dataviz` skill's first anti-pattern); two measures of different scale are two charts.

Limit, stated: the gate checks the *form* of a source and a method (not blank, not generic, not the same text twice). It cannot check that a sentence is true.

## Number formatting

Indian audiences read 12,34,567 and "14.3 lakh" / "3.1 crore"; international audiences read 1,234,567 and "1.2M". `type/gfx/numfmt.js` writes both out by rule instead of using `Intl.NumberFormat`, because ICU builds differ between Node, Chrome and Safari, and a render must not change with the browser. An axis uses one scale for all its ticks (0.2 L ... 1.4 L, never 80K under 1 L).

## What we did not verify

- No retention data of our own: the section shares are inference from common practice, to be tuned once renders are posted and measured.
- The camera-dive length (1.1 s) and the scrolly step spacing (about 3 s) are house defaults chosen by eye on stills, not tested on viewers.
