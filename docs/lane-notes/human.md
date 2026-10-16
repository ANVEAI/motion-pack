# LANE_NOTES: lane 4 "human" (branch `xp-human`)

Personal, tutorial and human-blended videos: real footage (the user's own) edited with pack graphics and sound. No person, voice or recording is ever generated; every missing input renders as a labelled placeholder.

## What is new (all new files unless listed under "shared-file edits")

| path | what |
|---|---|
| `templates/tutorial/` | screen recording + webcam PiP (corner, shape, auto-hide), step cards + step counter, zoom-follow-cursor (recorded track, or estimated from click times), key-combo overlay, highlight box + spotlight, code callout with line highlights, result reveal, end screen with labelled next-video slots; 16:9 root, 9:16 in `tall/` |
| `templates/vlog-personal/` | talking head + keyword B-roll slots with J / L split edits, location / date card, emphasis captions, punch-in planner, map route insert, sticker reactions on words, bed ducked under the voice, follow CTA; 9:16 root, 16:9 in `wide/` (inserts alternate cutaway / split-screen reaction layout) |
| `templates/podcast-clip/` | 9:16 first: hook card on frame 0, stack / split / active layouts, active-speaker emphasis from words.json speaker tags (L-cut lag, minimum shot, minimum turn), speaker lower thirds in each panel, waveform from the voice stem, karaoke captions; 16:9 in `wide/` |
| `templates/founder-story/` | talking head + photos with Ken Burns, a year timeline (each year a sourced claim), ONE pull quote gated as a verbatim run of the transcript (exit 2 otherwise), brand-field CTA; 16:9 root, 9:16 in `tall/` |
| `templates/course-lesson/` | presenter / slide + PiP / split / quiz / recap sections cut on words, slides drawn from the user's text, quiz with a pause the autocut keeps, lesson progress bar; 16:9 root, 9:16 in `tall/` |
| `templates/_shared/human/` | the shared kit: `core.mjs` (SRT / VTT -> words, the filler marker, the breath-keeping autocut that extends `plan.mjs autocut`, `--set`, `applyProject` + PROJECT_MAP check, the quote gate), `screen.mjs` (cursor from clicks, zoom keys, zoom-follow view, PiP state), `edit.mjs` (punch-in planner, B-roll slot planner, speaker turns + active speaker, speaker lower thirds, sticker reactions, J / L windows, THE CAPTION STYLE PICKER shared by every template), `plates.mjs` (labelled procedural placeholders: silhouette, fictional desktop, photo, B-roll, drawn slides), `page.mjs` (the HyperFrames page: one director draw(t)), `voice.py` (the voice stem + per-frame level envelope), `kit.mjs`, `build.mjs`, `human.test.mjs` |
| `type/gfx/human.js` | 15 gfx parts: `ui.keyCombo`, `callout.highlightBox`, `ui.codeCallout`, `ui.stepCounter`, `ui.cursorTrack`, `ui.waveform`, `title.locationCard`, `title.yearTimeline`, `caption.pullQuote`, `ui.quizCard`, `title.recapCard`, `title.hookCard`, `title.endScreen`, `callout.resultReveal`, `title.stepCard` (sized from the shorter frame side) |
| `tools/human/human.mjs` | CLI: `words` (SRT / VTT -> words.json), `fillers`, `autocut`, `punchins`, `broll`, `cursor`, `captions` (the picker) |
| `tools/human/voice_chain.py` | HPF -> de-ess -> compressor -> gain to -14 LUFS-I -> limiter, true peak <= -1.5 dBTP; deterministic (byte-identical reruns) |
| `tools/human/chroma.py` | green / blue screen: sample the key colour, chromakey + despill over a background, alpha export; deterministic |
| `tools/human/conform.py` | probe (VFR detection, A/V offsets), VFR -> CFR, mic sync by onset cross-correlation |
| `tools/human/breaths.py` | breath detection in the gaps between words (feeds the autocut) |
| `tools/human/fillers.txt` | the user-editable filler list (hard / soft) |
| `tools/tests/test_human_tools.py` | pytest on synthetic signals (runs inside the existing `tools/tests` CI step) |
| `docs/bring-your-footage.md` | formats, frame rates, VFR -> CFR, audio sync, transcripts, fillers, breaths, the voice chain, green screen, the background-blur note (no ML segmentation shipped) |
| `templates/<5>/.gitignore` | MP4s, staged assets per aspect folder, env.json, critic reports, HyperFrames work folders |

## Shared-file edits made on this branch (all additive)

1. **`type/gfx/index.js`:**
   - after `import { DOC } from './doc.js';` add `import { HUMAN, HUMAN_CUES, HUMAN_LIM } from './human.js'; Object.assign(GFX_LIM, HUMAN_LIM);`;
   - `GFX = { ..., ...R6, ...HUMAN }`;
   - `ACTION_CUES = { ..., ...R6_CUES, ...HUMAN_CUES }`;
   - append to `GFX_SFX`:
   ```
   'ui.keyCombo': ['sfx/device/keyboard_mech_clack', 5, -4], 'callout.highlightBox': ['sfx/ui/slide', 0, -4], 'ui.codeCallout': ['sfx/whoosh/swish_xs', 0, -4], 'ui.stepCounter': ['sfx/ui/count_tick', 1, -5], 'ui.cursorTrack': ['sfx/device/mouse_click', 0, -4],
   'ui.waveform': ['sfx/ui/blip', 0, -10], 'title.locationCard': ['sfx/whoosh/swish_s', 0, -3], 'title.yearTimeline': ['sfx/ui/slide', 0, -4], 'caption.pullQuote': ['sfx/paper/flip', 3, -4], 'ui.quizCard': ['sfx/ui/pop', 1, -3],
   'title.recapCard': ['sfx/ui/pop', 15, -4], 'title.hookCard': ['sfx/hit/soft', 0, -2], 'title.endScreen': ['sfx/whoosh/whoosh_in_m', 0, -3], 'callout.resultReveal': ['sfx/tx/mask_reveal', 0, -3], 'title.stepCard': ['sfx/whoosh/whoosh_in_m', 0, -3]
   ```
2. **`type/tests/honesty-defaults.test.mjs` ALLOW:** add `'ui.stepCounter': 'the tutorial step ordinal n / total, computed from the part\'s own steps list (lane human)'`.
3. **`.github/workflows/ci.yml`:** after the proof-film step:
   ```yaml
         - name: "human kit (lane human: subtitles to words, fillers, breath-keeping autocut, cursor and zoom-follow, punch-ins, B-roll slots, active speaker, captions, placeholder labels, the five human templates at both aspects; node, no browser)"
           run: node templates/_shared/human/human.test.mjs
   ```
4. **`skills/motion-pack/SKILL.md`:**
   - a decision-tree line under the RECIPE H lines (`a screen tutorial, a vlog, a podcast clip, a founder story or a course lesson (YOUR footage)? -> RECIPE U ...`);
   - one "Reach for X" row (tutorial / personal furniture -> the 15 parts);
   - a new section `### RECIPE U: personal, tutorial and human-blended videos (your own footage)` placed before RECIPE B.
5. **`templates/README.md`:** five rows appended to the genre table (text below, with the measured numbers).
6. **`catalog/build.py` TPL:** five entries appended (see below).
7. **Generated, regenerate at merge (merge procedure order):** `node layers/tests/make-manifests.mjs` (type/manifest.json gains the 15 parts), then `python3 catalog/build.py`, then `python3 tools/count.py --write`, then `--check`.

## Suggested (not made)

- **`layers/tests/make-manifests.mjs` GFX_FAM:** map `HUMAN_IDS` to a `human` family, and render `type/demo/out/gfx-human.png` with `type/tests/gfx-sheet.mjs` (browser). Until then the 15 parts point at their prefix family's sheet.
- **`skills/motion-pack/references/apis.md`:** a `type/gfx/human.js` row.

## Findings outside this lane (not fixed here)

- `templates/talking-head/make.mjs` calls `mix(planJson, wav, '--stem')`. `compose.mix`'s third argument is the PYTHON executable, so this spawns `--stem` as a program. It looks broken since `mix()` gained that signature.
- `templates/multi-voice-doc/vo.py` writes its float WAV with soundfile. libsndfile writes a PEAK chunk with a time stamp into float WAVs, so two identical builds differ in bytes. `scipy.io.wavfile` does not (the human kit uses it).
- `type/captions.js` emphasis style: an emphasised word scaled 1.12 eats the 0.28 em gap to its neighbour ("favouritehour"). The vlog template sets `emphScale: 1.05` through the picker's override; a fix belongs in `type/dom.js` (gap from the scaled width).

## Renders: what was measured, what is pending

The disk fell under the 10 GiB render floor at 02:43 (then to 4 GiB). Every final render, every `eyes` / `ears` pass and every sheet below is **PENDING**.

**Measured earlier,** from the delivered MP4s with `templates/_shared/sheet.py`. These came from builds before the last label and layout fixes; the stills were looked at and fixed in code:

| demo | length | LUFS-I | TP (dBTP) | notes |
|---|---|---|---|---|
| tutorial 16:9 | 30.3 s | -14.05 | -1.95 | 5.2 MB at CRF 23. Fixed since: step cards (the stock chapter card overflowed 9:16), highlight-box geometry, PiP over the label, key combo over the captions |
| tutorial 9:16 | 30.3 s | -14.05 | -2.04 | 4.8 MB |
| vlog-personal 9:16 | 19.1 s | -14.13 | -1.96 | fixed since: the map insert timing, the emphasis gap, the 16:9 card over the captions |
| vlog-personal 16:9 | 19.1 s | -14.13 | -1.96 | |

**Pending, through the shared lock, one at a time** (each line rebuilds its page first; run from `~/Developer/mp-xp-human/templates/<t>`):

```bash
cd ~/Developer/mp-xp-human/templates/tutorial && node make.mjs && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/tutorial.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/tutorial && node make.mjs --set aspect=9:16 && cd tall && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/tutorial-tall.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/vlog-personal && node make.mjs && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/vlog-personal.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/vlog-personal && node make.mjs --set aspect=16:9 && cd wide && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/vlog-personal-wide.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/podcast-clip && node make.mjs && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/podcast-clip.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/podcast-clip && node make.mjs --set aspect=16:9 && cd wide && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/podcast-clip-wide.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/founder-story && node make.mjs && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/founder-story.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/founder-story && node make.mjs --set aspect=9:16 && cd tall && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/founder-story-tall.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/course-lesson && node make.mjs && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o out/course-lesson.mp4 --crf 23 -w 1
cd ~/Developer/mp-xp-human/templates/course-lesson && node make.mjs --set aspect=9:16 && cd tall && ~/Developer/motion-pack-xp/render-lock.sh npx -y hyperframes@0.8.142 render . -o ../out/course-lesson-tall.mp4 --crf 23 -w 1
```

Or the whole batch, which stops on the first disk refusal: the session script `/private/tmp/claude-501/-Users-adarshkant-Documents-voice-forms/2b69758e-3956-429e-9f93-32bae7c71bce/scratchpad/renderall.sh` (`JOBS="podcast-clip:9:16:. podcast-clip:16:9:wide"` picks a subset; it is in a scratch folder and may be gone).

**Then, per MP4** (heavy, also through the lock), for example the tutorial:

```bash
python3 ../_shared/sheet.py out/tutorial.mp4 out/sheet.jpg 0,1.5,4.5,6.7,9.8,12.3,14.8,18.4,20.5,22.2,24,27
~/Developer/motion-pack-xp/render-lock.sh python3 ../../ears/listen.py out/tutorial.mp4 --plan out/plan.json --transcript out/transcript.json --md out/ears.md
~/Developer/motion-pack-xp/render-lock.sh python3 ../../eyes/look.py out/tutorial.mp4 --plan out/plan.json --md out/eyes.md
```

The 9:16 / 16:9 variants use `out/plan-tall.json` / `out/plan-wide.json` and `out/transcript-tall.json` / `out/transcript-wide.json`. Commit `out/sheet*.jpg` with the plans (the MP4s are gitignored per template). Then fill the measured numbers into the `templates/README.md` rows.

## Update 6d401c2 (merged into xp-integrate after 2a563d6)

### Structure scores (tools/structure_check.py, lane 5 patterns)

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
