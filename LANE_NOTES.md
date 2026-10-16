# Lane notes (XP round, 16 Oct 2026)

Per-lane merge notes live in docs/lane-notes/<lane>.md. Shared-doc edits listed there are applied in the integration pass.

## Structure scores (tools/structure_check.py, lane 5 patterns)

Every human plan now carries `plan.structure.sections` (its own beats, named with the pattern's section names or aliases, timed from the transcript words that start them) and `plan.texts` (the hook, card and CTA text, so the hook check and the reading-speed check see them). Scores at both aspects (pass 70):

| template | pattern | before | after | what changed in buildPlan |
|---|---|---|---|---|
| tutorial | tutorial | 93 | **98** / 98 | hook text at 0 s in `plan.texts`; step cards hold 1.0 s (they read at 3.5 words/s before); the end screen holds 5.4 s (was 4.4) |
| vlog-personal | vlog | 59 | **85** / 85 | `beats` in CONFIG on words (cold open, setup, journey, cost = the loud moment, change, sign-off); the sign-off holds over 5 s (end hold 3.2 s) |
| podcast-clip | podcast-clip | 54 | **100** / 100 | NEW: `hookLine`, the sharpest line pulled to the open (a verbatim run, gated like the founder quote), then the clip from its start; beats hook / context (the host's question) / payoff (the answer) / button (the last line + "full episode"); end card 2.3 s (it read at 2.9 words/s) |
| founder-story | founder-story | 60 | **90** / 90 | `beats` on words (hook, why, problem, chapter, ask); the end card line is the spoken ask "Come and see" (4 words: it reads at <= 1.5 words/s) |
| course-lesson | explainer | 53 | **99** / 99 | each section names its explainer beat (`beat:` question, setup, context, reframe, example, takeaway); hook / quiz / recap text in `plan.texts`; end hold 3.0 s |

**Where the pattern does not fit, kept as is:**
- **vlog (sign-off and CTA):** the vlog pattern is a long-form shape (60-1800 s). It puts the sign-off at 95-100% and also wants it held for 5 s, which only fits films of 100 s or more. The demo is a 20 s Short, so its sign-off ("Same time tomorrow? Follow along." plus the follow card) starts at 73%. Moving it to 95% would mean cutting the sign-off to 1 s or padding the film with 60 s of nothing. CTA scores 0.4 for that reason.
- **founder-story (the ask):** the ask is the spoken line ("If that sounds like how you want to work, come and see") followed by the brand field. It starts at 71% of a 21 s demo; in a 45-180 s film the same 6 s sits at 88% or later. Proportional timing on a compressed demo cannot match the long shape, so I did not stretch the hold to game the number.
- **course-lesson -> explainer:** there is no lesson pattern. Mapping the two "models" (laptop, cloud) onto "wrong model" is approximate: a lesson compares two right answers rather than correcting a wrong one, and a quiz is an exercise, not proof. A `lesson` pattern (hook / objective, concept, example, check (quiz), recap, next) would score lessons on their own terms.
- **Every demo is shorter than its pattern's length range** (20-31 s against 45-1800 s). The checker reports it, but it barely moves the score, because the length falloff is relative to the upper bound.
