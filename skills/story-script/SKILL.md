---
name: story-script
description: Write the story and script for a short video before any frame is made - logline, stake, beat sheet, shot list, three hook variants and a scored review. Use this skill whenever the user wants to write, outline, punch up or fix a script, concept, treatment, storyboard, hook or shot list for an ad, launch film, animated short film, wordless character spot, chat-skit comedy, explainer, reel, Short or TikTok, or says a video has no story, reads like a feature list or loses viewers in the first seconds, even if they only ask to make a video about something. It turns brief.md into script.md and shotlist.json, the files frame-design and motion-pack read next. It encodes the craft that held up in production - a protagonist with a real stake, one turn, the product as the quiet turn, a payoff that pays off the stake, honesty labels in frame, and references used as craft, never copied.
license: MIT
compatibility: Writing skill. Python 3.8+ (standard library only) runs scripts/lint_shotlist.py. Works in Claude Code and in any agent that reads Agent Skills.
metadata:
  version: 1.0.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# story-script: a story first, then shots

A video that lists benefits is a brochure that moves. People stay for a person who wants something, a moment where it turns, and a payoff they can feel. This skill writes that story, then hands it on as files the rest of the pipeline can read.

## Where this sits in the pipeline

```
brief.md ─▶ story-script ─▶ script.md + shotlist.json ─▶ frame-design ─▶ design.json
        ─▶ motion-pack (+ spec-to-loop, Blender plates) ─▶ plan.json ─▶ MP4 ─▶ social-video ─▶ post/
                                    motion-stack: libraries, tools and QA, whenever needed
```

- **Reads:** `brief.md`. If the user only sent a sentence, write `brief.md` first (template in `references/templates.md`), state your assumptions in it, and show them.
- **Writes:** `script.md` (the human version: the four lines, beat sheet, scenes, hooks, review) and `shotlist.json` (one row per shot, the machine contract).
- **Then, before any build:** `storyboard/board.py` turns `shotlist.json` into a storyboard sheet and an animatic to approve (below, workflow step 10).
- **Next:** frame-design reads `shotlist.json` for the aspect, the hero of each frame, every on-screen line and every honesty label, and returns `design.json`. motion-pack turns `shotlist.json` + `design.json` into `plan.json` (field mapping below). social-video reuses the logline, the stake, the send line and the hook variants for titles and captions.

## When to use, and when not

- **Use it** for every new video before design or build; to fix a draft that "has no story" or "is a feature list"; to re-cut an opening that loses viewers; to write three hook variants for a test; to plan a series (one episode per feature, a bible of characters and callbacks).
- **Do not use it** for the edit (motion-pack), the look of a frame (frame-design) or the post copy (social-video). A pure motion loop with no story (spec-to-loop) needs only its frame table.

## The four lines (write them before anything else)

| line | what it must say | test |
|---|---|---|
| **Logline** | who wants what, what stands in the way, what changes | one sentence, no feature names |
| **Stake** | what is lost if it goes wrong | concrete: money, a client, a deadline, a secret, a promise, pride |
| **Turn** | the one moment the situation reverses | one verb you could film |
| **Payoff** | the image that resolves the stake | it shows the stake from line 2, resolved |

Then write the **sound-off sentence**: "After one watch with the sound off, a viewer can say: ___." If it does not fit in one breath, the story is not ready, and no amount of motion design will fix it.

## The rules that held up in production (and why)

1. **A protagonist with a real stake, and one turn.** Viewers track people, not features. A short has room for about one change; two turns read as two films.
2. **A list of benefits is not a story.** "One problem and one solution per beat" is a clarity rule *inside* a beat. It is not a structure: five clean problem-to-solution vignettes in a row still read as a feature parade. Tie beats together with one person, one place or one clock.
3. **The product is the quiet turn, never the pitch.** It arrives as the turn (placed on a shelf, found, switched on, quietly used) and changes the state of the story. It never speaks, explains itself or performs. Name it once mid-film at most, then on the end card. When the product performs, the audience feels sold to; when it resolves the stake, they credit it.
4. **The payoff pays off the stake.** If the stake was a bill, the payoff is the bill. If it was a confidential file, the payoff is the file safe and the person trusted. A generic cheer is not a payoff.
5. **Honesty labels sit in frame without killing the story.** Small, designed and specific: "demo figures", "fictional app · demo data", "hardware in development". Product claims go in captions and descriptions, not in the film. Never invent numbers, quotes, reviews, customers or logos.
6. **A premise is a claim.** If the story sets a condition ("the internet is down", "nothing leaves the room"), every later scene makes a claim under it. Order scenes so nothing contradicts the premise, or drop the premise.
7. **References are craft, never copies.** When someone shares a reference "to learn from", ask which of *our* deliverables it is for, extract the method (numbers, structure, timing, lighting, sound) and apply it to our story. A literal replica is at most a throwaway technical spike, and only after saying so.
8. **When a draft is rejected, subtract.** Revisions fail by addition: every note becomes another card, super or scene. Cut back to the spine first; add only what the spine is missing.
9. **Concrete artefacts, not abstract "AI" imagery.** Node graphs, glowing threads, orbiting cards, floating UI and holograms read as slop. Use objects the story already has: a stamped page, a ledger, a bill, a sent message, a lamp switched off.
10. **Spine before shots.** Every scene moves one matter forward. A visible clock (time labels, a wall clock) gives a short film its drive; freeze any on-screen clock while the product works, or the film implies a speed claim.
11. **Write for the first second.** Frame 0 shows the stake already in motion. No black frame, logo bumper or title card; a small name super over moving footage inside 2 s is fine. The rule is stated once, in motion-pack's `references/virality.md` §1 (the hook table); follow that, not a copy here.
12. **For pieces that matter, run a writers' room.** Draft three versions independently. Where they converge is the signal; steal the best single line from each.

## Workflow

1. **Brief.** Fill `brief.md`: audience, objective, platform and lead aspect, length, the one thing to remember, proof you actually have, must-not-say words, references (as craft notes).
2. **Story.** Write the four lines and the sound-off sentence. If the brief is a feature list, pick the feature with the sharpest human stake, or plan a series with one feature per episode.
3. **Format.** Pick the format and length from the table below and read its grammar in `references/formats.md`.
4. **Beat sheet** at that length (table below).
5. **Script** scene by scene in `script.md` (template in `references/templates.md`).
6. **Shot list** in `shotlist.json`, then lint it: `python3 scripts/lint_shotlist.py shotlist.json` (exit 0 = no failures).
7. **Hooks.** Write three variants that change only the first one to three seconds.
8. **Honesty pass.** Every claim with a digit has a `source`; every illustration, demo figure and planned feature carries its label.
9. **Review** with `references/rubric.md`. Fix the lowest score by subtraction, then lint again.
10. **Storyboard.** Draw the story before anyone builds it: `python3 storyboard/board.py shotlist.json --out storyboard-out` (add `--design design.json` once frame-design has run). It lints the shot list again, draws one panel per shot (scale, camera move, the text at its real size, the safe zone, sound intent, transition, honesty label), flags lines that read too fast and text outside the safe zone, and cuts an animatic with real sounds. Show the sheet and the animatic to whoever approves the story, fix what they or the warnings find in `shotlist.json`, and re-run. This is motion-pack's "storyboard approved" gate.
11. **Hand off.** Tell the user which files to read and what frame-design should decide next.

## Formats at a glance

| format | length | spine | where the turn sits | grammar |
|---|---|---|---|---|
| Ad | 6, 15 or 30 s | hook, problem, product, proof, CTA | the product reveal answers the problem (about 1/3 in) | `formats.md` Ad |
| Launch film | 30-90 s | one protagonist, one clock; tease, reveal, story-tied montage, end card | the reveal | `formats.md` Launch film |
| Short film | 60-180 s | cold open, want, one obstacle, turn, consequence, resolution image, tag | 50-60% | `formats.md` Short film |
| Wordless character spot | 15-20 s | HOOK, SETUP, ESC, FREEZE, TURN, PAYOFF, LINE, CARD | one product verb, about 45% | `formats.md` Character spot |
| Chat-skit comedy | 10-40 s | hook title, three-beat escalation, twist punchline, callback, send-to close | the punchline | `formats.md` Chat skit |
| Explainer | 30-90 s | question, wrong model, right model, proof, so-what | the reframe | `formats.md` Explainer |
| Reel or hook test | 7-35 s | hook, promise, beats with micro-payoffs, best payoff last, loop or CTA | the payoff | `formats.md` Reel |

All lengths and positions are tunable defaults drawn from the formats' usual practice, not platform rules.

## Beat sheets by length (defaults; tune by eye and by retention data)

| length | beats (seconds) |
|---|---|
| 6 s | 0-2 hook (stake in motion) · 2-4.5 turn or product · 4.5-6 line and brand |
| 15 s | 0-2 hook · 2-5 setup (the stake) · 5-9 escalation · 9-11 turn · 11-12 reaction hold · 12-15 line and card |
| 30 s | 0-3 hook · 3-9 want and stake · 9-18 escalation (rule of three) · 18-22 turn · 22-25 payoff · 25-30 send line and card |
| 60 s | 0-3 cold open of the conflict · 3-12 world and want · 12-27 obstacle and pressure · 27-33 turn · 33-50 consequence and payoff · 50-56 button or callback · 56-60 card |
| 90 s | 0-7 cold open image · 7-22 world and want · 22-45 obstacle · 45-54 turn · 54-76 consequence · 76-85 resolution image · 85-90 card |

- Put the best payoff in the final 20%, and put nothing after the button except the brand.
- Hold the end card at least 1.8 s after its motion settles.
- A 9:16 feed cut of a slow film opens on a 1.5-2.5 s flash-forward of the conflict, then starts the story.
- Hold a reaction for about 1.5 s; the face does the work.

## shotlist.json (the contract with frame-design and motion-pack)

Full schema and a complete example: `references/templates.md` and `assets/shotlist.example.json`. The essentials:

```json
{
  "title": "Every draft, saved", "format": "character-spot", "length_s": 16, "fps": 30, "aspect": "16:9",
  "logline": "...", "stake": "...", "turn": { "at_s": 10.0, "what": "the dead laptop wakes with the draft restored" },
  "payoff": "...", "sound_off": "...", "send_line": null,
  "hooks": [ { "id": "A", "archetype": "in-medias-res", "frame0": "...", "text": "", "poster_text": "SAVED?" } ],
  "shots": [
    { "id": "s01", "beat": "HOOK", "role": "stake", "start_s": 0, "dur_s": 2.5, "scale": "WS",
      "action": "...", "sound": "typing; a pleased hum", "text": "", "text_kind": "super", "honesty": null,
      "transition": { "kind": "cut", "reason": null } }
  ],
  "claims": [ { "text": "...", "source": "..." } ]
}
```

| shotlist field | motion-pack reads it as |
|---|---|
| `beat`, `dur_s` | a beat or section of the template (`beats[].id`, `beats[].dur` in character-spot and film-scene; the hook/problem/product/proof/cta sections in the ad) |
| `transition.kind` + `transition.reason` | `tx` (`transitions/<name>`) + `txReason` (a Murch reason: EMOTION, STORY, RHYTHM, ENERGY, REVEAL, PLACE). A hard cut needs no reason; everything else does |
| `sound` | cue intents; motion-pack resolves them to `sfx/<cat>/<name>` ids and places each on frame F + 1 |
| `text` + `text_kind` | on-screen lines (`super`, `in_world`, `label`, `card`); frame-design sizes them, the type module times them |
| `claims[]` | `claims` with `source` (`lint.proof` refuses a digit without one) |
| `hooks[]` | `hook.archetype` in the ad template; the three variants become three renders on one body |

## Hooks: three variants on one body

- **Archetypes** (the same ids as motion-pack's `hook.archetype`): `payoff-first`, `pattern-break`, `claim-or-question`, `in-medias-res`, `curiosity-gap`, `social-proof` (needs a sourced number), `problem-agitate`.
- **Frame 0 shows the stake in motion.** Show the stake and hold the twist: no answer in frame 0, in the title or in the first line.
- **One idea, said three ways:** the picture, the on-screen text and the sound agree. At most 7 words on screen in the hook and at most 4 on the poster frame (house defaults).
- **The first sound** lands on frames 0-3, or 1-2 s later on the first meaningful visual event over a moving frame 0 (a planned quiet open, `plan.audio.quiet`; 13 of 28 round 4/5 references did it). A music bed fading in is not a sound event. Details: motion-pack `references/virality.md` §1.
- **Change only the first 1-3 s** between variants. With an identical body, a test tells you which hook worked.

## Honesty inside the story

- **Claims:** keep a register in `shotlist.json` `claims`. A line with a digit needs a `source` the user can show; otherwise cut the digit.
- **Labels:** use a small vocabulary and keep each label on screen for at least 2 s, inside the safe area: "Illustration", "demo figures", "demo data", "fictional", "in development", "planned feature", "screens recreated", "3D render".
- **Fiction:** fictional people, firms and data only. No real company names, logos, badges, insignia or public figures in a comedy or a drama.
- **Generated people:** if a character was made with an image or video model, say so in the end-card fine print and in the post (social-video handles the platform labels).
- **Tone:** no gag depends on harm, humiliation or someone losing their job. The worst outcome is mild embarrassment. If AI is in the story, keep it as a prop inside a human conflict; a joke whose butt is "AI" or that implies "AI replaces your colleague" alienates the people you want to reach.

## Review before hand-off

Score the draft with `references/rubric.md` (eleven criteria, 0-2 each). Ship at 16/22 or more, with no zero on stake, turn, payoff or honesty (house thresholds). The same file has the failure-to-fix table and a case study of a rejected launch film, so you can recognise a feature parade before anyone else has to.

## Gotchas

- **Vignettes disguised as story.** Five tidy problem-to-solution scenes still read as a list. Add a through-line (one person, one clock) or split the film into a series.
- **The character outshines the product.** Viewers remember the mascot and forget the feature. Make the payoff a visible state change caused by the product, and name the feature in the end line in six words or fewer.
- **A late turn in a vertical feed.** If the conflict arrives at 20 s, almost nobody sees it. Re-cut with a cold open.
- **Clocks imply speed claims.** Freeze any on-screen clock or timer while the product works, unless you can prove the time.
- **Callbacks are a series asset.** Track recurring numbers, times and lines in a series bible (`references/templates.md`) and grep it before calling a callback wrong.
- **One language on screen** unless the brief asks for more. Mixed languages in one frame split the audience and the captions.
- **Scripts drift into copy.** If a line explains the product, move it to the caption.

## Files in this skill

| path | what |
|---|---|
| `references/templates.md` | `brief.md`, `script.md`, the full `shotlist.json` schema, hook block, series bible |
| `references/formats.md` | grammar and timing for each format, with what usually goes wrong |
| `references/rubric.md` | the scoring rubric, failure-to-fix table, rejected-film case study, hand-off checklist |
| `references/example.md` | two fictional worked examples (a 16 s character spot that maps onto motion-pack's `templates/character-spot`, and a 60 s short film) |
| `assets/shotlist.example.json` | a complete, lint-clean shot list for the 16 s example |
| `scripts/lint_shotlist.py` | structure, timing, reading-speed, hook, turn and honesty checks; thresholds are named house defaults |
| `storyboard/board.py` (pack root) | the sheet and animatic made from `shotlist.json`; runs this linter first and reuses its thresholds |
