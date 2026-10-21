# VIRALITY and QA checklists

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (most items are now rules that `mp plan` writes in and `mp lint` checks; the checklists stay as the human pass). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## VIRALITY checklist (the mechanisms are solid; every number is a tunable default)

**Hook (first second)**
- [ ] Frame 0 is a strong image already in motion (the first visible change lands by frame 6): never black, never a logo bumper, never a fade-in. A small product-name super over moving footage inside 2 s is not a bumper. This is the one statement of the hook rule (`references/virality.md` §1 has the table); the sibling skills link to it.
- [ ] The sound may enter 1–2 s after a moving frame 0, on the first meaningful visual event (13 of 28 round 4/5 references, tier A among them). Plan it: `plan.audio.quiet` `[{"t": [0, 1.5], "kind": "open", "why": "..."}]`.
- [ ] Hook text on screen by 0.3 s: at most 7 words, and at most 4 on the poster frame.
- [ ] The picture, the on-screen text and the VO all say the same idea.
- [ ] The hook uses one archetype, and you made 3 hook variants on the same body.

**Hold (retention)**
- [ ] Open a loop in 3–6 s.
- [ ] Use the interrupt ladder (`cuts/interrupts`): minor about every 2.5 s, medium about every 5 s, major about every 9 s. Something visible changes at least every 3.5 s.
- [ ] The best payoff is in the final 20%. Trim a dead last 1–2 s.
- [ ] Captions on every spoken sentence: the video must work on mute. Burn them in for LinkedIn and X.

**Share and replay**
- [ ] One send-worthy beat in the final third that names an audience.
- [ ] Shorts loop: state-return, reveal-to-hook, or ping-pong.

**Platform fit** (`references/platforms.md`)
- [ ] Length: organic shorts 15–35 s, ads 15–30 s, plus a 6 s bumper.
- [ ] Export 9:16, 1:1 and 16:9 by re-layout, not by crop.
- [ ] 9:16 safe zone: text and CTAs inside x 65–960 and y 269–1248 on 1080x1920 (the `conservative` union in `type/safezones.js`; verify against the current apps).
- [ ] Soft CTA at 60–70% of the runtime. The hard CTA end card is in the last 2.5 s.

**Thumbnail and title**
- [ ] The poster frame has one high-contrast subject and at most 4 words, and reads at 120 px wide.
- [ ] Never let an image model redraw UI or text; composite the real screenshot instead.
- [ ] Title: front-load the payoff in about 50 characters, and promise only what the video delivers.

**Distribution**
- [ ] Post at a steady slot rather than in bursts. Volume without reach does nothing: fix the hook and format before scaling.
- [ ] Log hook rate and retention per variant.
- [ ] Draft the post, but publishing is the user's call.

## QA checklist (before calling it done)

- [ ] **Ids:** `python3 tools/check_ids.py` shows 0 unresolved, and `make.mjs` prints `todo: none`.
- [ ] **Structure:** `python3 tools/structure_check.py out/plan.json` scores 70 or more against the genre's beat sheet (`patterns/structures.json`; the template map picks it, `--pattern` forces one; `python3 tools/structure_check.py --all` scores every template), and each printed fix is either applied or answered in the plan (`plan.structure` names the beats when the shot ids cannot).
- [ ] **Stills:**
  - Run `python3 templates/_shared/sheet.py <mp4> <sheet.jpg> <t1,t2,...>` on every cut, mid-transition, the hook, the reveal and the end card, then LOOK at the sheet.
  - Check for clipped or overlapping type, words cut by masks, and text outside the safe zones at 9:16.
- [ ] **Loudness:** the delivered MP4 decodes to −14 ± 0.5 LUFS-I and TP ≤ −1.0 dBTP, with the WAV master at ≤ −1.5 (`sheet.py` prints both).
- [ ] **Sync:** hits land on frame F + 1, risers end one frame before the hit, whooshes peak on the cut, and the last 0.15 s is silent. The edit is scored by its mode (`plan.audio.mode`, `references/critic.md`): music-led cut pieces put ≥ 60% of cuts on an onset; VO-led films keep cuts out of words; continuous films put ≥ 60% of motion events on an onset.
- [ ] **Ears:** `ears/listen.py` on the delivered MP4 shows no fail, and you listened once at phone size.
- [ ] **Eyes:** `eyes/look.py` on the delivered MP4 (with `--plan out/plan.json`) shows no fail: frame 0 not black and moving by frame 6, no unplanned black or frozen run, at most 3 flashes a second, no banding, every text box inside the safe zone and over the size, time and contrast floors, no unplanned bars; and you looked once at a 360 px wide still.
- [ ] **Legibility:**
  - On-screen text that is not speech (titles, cards, supers, kinetic lines): at most 3.5 words/s and held at least **max(0.5 s, 0.35 s + 0.28 s per word)** (eyes, frame-design, story-script). `tools/structure_check.py` also applies its beat-sheet floor, max(0.83 s, 0.3 s per word) with the section's words/s ceiling; the two agree within a frame or two for 2-8 words, and the longer hold wins.
  - Captions of speech follow the speech, never the hold formula: subtitle files (SRT / VTT / TTML from `tools/captions/export.py`) at most 42 characters a line, 2 lines, 20 cps (17 for kids), each event on screen 5/6 s to 7 s; burned-in kinetic captions (`type/captions.js`) at most 18 characters per line and at most 2 lines.
  - The active word is exactly the spoken word.
  - It reads at phone size (360 px wide).
- [ ] **Honesty:** no fabricated numbers, reviews, logos or testimonials. Placeholders and concept renders are labelled.
- [ ] **Flash safety:** no more than 3 full-frame flashes per second (`eyes/flashes` measures it, WCAG 2.3.1).
- [ ] **Accessibility:** `tools/a11y_check.py` has no fail; captions exported and validated (`tools/captions/validate.py` no fail, or every cps warning condensed by hand); for a public release, an AD script reviewed by a person.
- [ ] **Delivery:** each platform file comes from `tools/deliver.py` and its verification lines are all `ok`.
- [ ] **Determinism:**
  - Render twice with `--format png-sequence` and compare the frames. They should be identical, or above 60 dB where blurs add GPU noise.
  - Don't compare two MP4s: the encoder carries GPU capture noise (at most 2/255) to the next keyframe, so two default renders differ (about 44-50 dB) even though every page frame is the same; `--workers 1` is usually but not always byte-identical. The measured numbers are in the README section "What is and is not deterministic".
  - A standalone page can use motion-stack's `seekcheck.mjs`, which needs `window.__ready` and `window.__seek(t)`.
- [ ] **Files:** the demo encode is CRF 23, and a 15 s 1080p file is a few MB.
