---
name: motion-pack
description: Make finished, platform-ready videos with an AI agent from motion-pack, an open-source kit of deterministic, seek-safe parts rendered with HyperFrames - transitions, kinetic type and captions, synthesised sound and music, overlays and film looks, camera moves, three.js objects, Blender plates and genre templates - steered by a playbook of graded rules learned from studied films. Use this skill whenever the user wants to make or edit a video of any kind - an ad, launch film, product promo, explainer, reel, short or TikTok, short film, character spot, talking-head edit, beat-synced edit, kinetic title or sonic logo - even if they never mention motion-pack. It picks a format from the brief, writes a plan that already carries the learnings (mp brief, mp plan), renders, then lints the plan and the delivered file against every enforceable rule (mp lint, mp study) until nothing fails. For outside libraries (GSAP, three.js, Lottie, Rapier, Remotion), load motion-stack alongside.
license: MIT
compatibility: Node 22+ with npx (HyperFrames 0.8.142 renders the compositions), ffmpeg, Python 3.11 in a venv with `pip install -r requirements.txt` (numpy, scipy, numba, soundfile, Pillow, matplotlib, jsonschema, pytest; 3.10 to 3.12 install the pins, 3.13+ cannot), Chrome or Chromium; the three.js templates and GPU tests also need `npm i --no-save puppeteer-core` and a hardware GPU; Blender 5.2 only for photoreal plates. Works in Claude Code and in any agent that reads Agent Skills.
metadata:
  version: 3.1.0
  author: ANVE (anveai.com)
  repository: https://github.com/ANVEAI/motion-pack
---

# motion-pack: start from the playbook, end with a clean lint

Every part in the pack is code and a pure function of time `t`, so a frame renders the same whichever frame came before. On top of the parts sits the **playbook** (`playbook/`): every learning from the studied films and our own renders as an atomic, graded rule, bundled into **formats**. You do not read the research. `mp brief` and `mp plan` write the learnings into your plan as defaults, and `mp lint` tells you which ones the film kept and which it broke.

## Find the pack

The user can be in any folder; the pack lives in one place and their project folders live where they work. Run this first and use the `PACK` it prints:

```bash
sh <this skill's folder>/scripts/find-pack.sh      # prints PACK=<folder>
```

It looks, in order, at `MOTION_PACK_HOME`; the clone this skill sits in (a git checkout, never the plugin cache); `~/.motion-pack/<version>`; and otherwise runs `mp init`, which downloads that release's tarball from GitHub into `~/.motion-pack/<version>` and checks it against the release's `SHA256SUMS` before unpacking. Then:
- **The CLI:** `"$PACK/tools/mp"` (or link it onto PATH: `ln -s "$PACK/tools/mp" ~/.local/bin/mp`). `mp` itself resolves the pack the same way, so a linked shim works from any folder. `mp doctor` checks the machine.
- **First film on a fresh pack:** build the sound libraries once (`python3 "$PACK/sfx/build_library.py" && python3 "$PACK/music/build_music.py"`).
- Every path below is relative to `PACK`. Projects go in the user's folder (`mp new <template> ./film`), never inside the pack.

## When to use

- **Use it** for any request to produce or edit video. Load `hyperframes` alongside it if available; it holds the composition contract and the render CLI. This skill decides *what to make and with which parts*; the renderer decides *how the page becomes frames*.
- **Do not use it** for still images or thumbnails alone, or for pure diagram explainers (a diagram or math tool makes the plates; come back here for sound, type and the finish).
- **Paid generation** (text-to-video models, avatar services, stock libraries) is never needed. Use it only when the user asks and has seen the cost.

## The flow (every video)

```
mp brief ──> research-pack.md ──> story-script ──> frame-design ──> mp render ──> mp lint / mp study ──> fix until no FAIL ──> social-video
              + plan.json (mp plan)
```

### 1. Pick a format: `mp brief`

```bash
mp brief brief.md --goal launch --platform x --out work/     # or a one-line idea in quotes
```

It classifies the brief by each format's `signals` (keywords, product types, goals, platforms) and asks at most two questions, only when two formats score alike (it exits 3; answer with `--goal`, `--platform` or `--format`). It writes `work/research-pack.md` and `.json`: the format and why, the rules grouped by beat with their params and grades, the closest measured exemplars, recommended parts per beat, hook options, the sound shape and bed, the post plan and the honesty checklist. Then it runs `mp plan`.

To choose by hand, `mp formats` lists them (length range, aspects, template, when to use). The usual picks:

| you are making | format | template |
|---|---|---|
| a product or release hero film | `launch-film` | `saas-launch` |
| one claim proved by one graphic or one run | `proof-clip` | `proof-film` |
| one new feature of an existing product | `saas-feature-drop` | `saas-feature-drop` |
| a story told on one desktop or phone screen | `screen-life` | `saas-feature-drop` |
| a comedy told in a chat thread | `chat-skit` | `character-spot` |
| how something works, one diagram built step by step | `explainer` | `explainer-diagram` |
| a device teased before or at launch | `hardware-teaser` | `hardware-teaser` |
| a direct-response or brand ad for feeds | `ad` | `ad` |
| a montage cut to a track | `beat-edit` | `beat-edit` |
| a wordless cartoon or mime spot | `character-spot` | `character-spot` |
| a person speaking to camera | `talking-head` | `talking-head` |
| a people-led launch in several voices | `documentary` | `multi-voice-doc` |
| a story film with a named person and a stake | `short-film` | `short-film` |
| a film, series or big-release trailer | `trailer` | `trailer` |

No format fits? Work from the decision tree and recipes in `references/recipes.md`, then still run `mp lint` (it falls back to every registered check).

### 1b. Pick a style: `mp styles`

A format says what happens when; a **style** says what it looks and sounds like, and the two are independent. `mp styles` lists the named styles (`playbook/styles/`: palette measured by contrast.py, type, motion personality, transitions by reason, overlay stack, bed and sounds, signature features); `mp styles <id>` prints one with its copy-ready prompt. When the user names a look ("blueprint", "neon", "like a magazine"), pass `--style <id>` to `mp brief` or `mp plan`; otherwise skip it and art-direct with frame-design. The style never changes the story or the beats.

### 2. The plan: `mp plan`

```bash
mp plan launch-film --length 35 --aspect 16:9 --out plan.json --project-out project.json
mp plan ad --style blueprint --length 10 --out plan.json --project-out project.json   # the same, with a named style laid over it
```

With `--style`, `plan.style` holds the style and what it set: the brand palette, fonts and bed in `project.json`, and, where the template's CONFIG has the block, its type presets, sounds, overlay stack and one transition per REASON as `overrides`. `plan.style.not_applied` names what the template has no slot for (art-direct those by hand). `mp lint` then checks the style's signature features (`lint.style.palette`, `.type`, `.transitions`, `.sound`) and lists the ones to look at by hand.

`plan.json` is in the plan shape the templates, `structure_check`, eyes and ears already read. It carries the beats scaled to `--length` on whole frames, the sound shape (`plan.audio.quiet`: the quiet open, the silence under the name, the end-card hold; `bass_entry_s`; `first_hit_s`; the master target), the type limits (each text slot's word limit, cut to what its time can be read in), `plan.playbook` (format, rule ids, the defaults written in, the research pack) and `plan.project`: the same film as a `project.json` for the format's template, at the template length nearest yours. **It never writes copy:** every line is a `TODO(<beat>)` marker, and `mp lint` fails while one is left.

### 3. Story: story-script

Read `research-pack.md` first, then write the logline, stake, beats and lines into the TODOs (the plan's `texts` and `project.json`'s `text` fields) with the story-script skill. Keep each beat's word limit; give every number a claim with a source.

### 4. Art direction: frame-design

Palette (contrast-checked), type, safe zones and the special frames, with the frame-design skill (start from `plan.style` when the plan has one). `mp brand logo.svg --write` sets accent, ink and paper from a logo.

### 5. Render: `mp render`

```bash
mp new <template> work/film --project project.json     # a project folder outside the pack
mp render --dir work/film                              # renders/<template>-<WxH>.mp4 + plan + contact sheet + loudness
```

The template comes from the format (`mp formats`; `plan.playbook.template` says when its length differs from yours). Edit copy with `mp set text.headline "..."` (each set validates the whole file); `references/edit-without-code.md` has the full CLI. Template code changes follow `references/recipes.md`. Render outside cloud-synced folders and stop under 10 GiB free.

### 6. Lint until nothing fails: `mp lint`, `mp study`

```bash
mp lint plan.json                                 # before the render: TODOs, honesty, beats, sound shape, type
mp lint work/film/renders/saas-launch-16x9.mp4     # after: + ears, eyes, loudness, true peak, size
mp study work/film/renders/<file>.mp4             # refstudy + lint + the gaps against the format's exemplars
```

The table shows each rule, its grade, PASS / WARN / FAIL / INFO / N/A, the measured value and a fix, then a score. **The grade sets the severity:** a broken house or measured-A rule is a FAIL, measured and craft rules WARN, inferred rules are information only. Fix every FAIL (and every WARN you cannot explain in the plan), re-render, lint again. `--json` is the machine output; `--all-checks` adds every registered check no rule covers. The rules the format applies that no check measures are listed under the table: look at those by hand. Then LOOK at the contact sheet at phone size and listen once on headphones; the lint measures, it does not judge taste.

### 7. Post: social-video

Copy per platform, covers, AI disclosure, upload copies and the release plan, with the social-video skill. The format's `post` block (in the research pack) gives the pattern. Publishing is the user's call.

## Hard rules (short; the full text is `references/hard-rules.md`)

1. **Ids, not copies.** Reference parts as `transitions/<name>`, `sfx/<cat>/<name>`, `music/<id>`, `type/<preset>`, `layers/<kind>`, `objects/<name>`, `blender/<recipe>`, `cam2d.*` / `cam3d.*` and `cuts/<group>/<name>`. `python3 tools/check_ids.py` reports 0 unresolved before a render (`mp lint` runs it as `lint.ids.resolve`); gfx part ids (`ui.*`, `counter.*`) are checked at draw time, so look at the stills.
2. **Plan first.** One `plan.json` drives picture, sound and checks; start it from `mp plan` or the closest template, never from a blank page.
3. **Hard cut by default.** Every other transition carries a reason (`EMOTION`, `STORY`, `RHYTHM`, `ENERGY`, `REVEAL`, `PLACE`); the build refuses one without.
4. **Sound is half the cut.** A cue for frame F puts its anchor on `(F + 1) x 48000 / fps`; whooshes peak on the cut, risers end one frame before the hit; mix through `music/mixer.py`, never by hand.
5. **Master spec:** −14 LUFS-I; true peak ≤ −1.5 dBTP on the WAV master and ≤ −1.0 dBTP decoded from the delivered MP4; the last 0.15 s is digital zero.
6. **Honesty.** No invented stats, quotes, reviews, logos or people. A claim with a digit needs a source that says where it comes from (`lint.proof`, `lint.honesty.claims`); placeholders are labelled in frame; references are craft, never copied; no studied account or brand name in a shipped file.
7. **Measure the delivered file.** `mp lint` on the MP4 (ears, eyes, loudness, size), a contact sheet, one look and one listen. Two renders differ by GPU noise: the README section "What is and is not deterministic" says what to compare.
8. **Render somewhere safe.** Outside iCloud / OneDrive / Dropbox, 10 GiB free, `--crf 23` for demos.

Banned defaults (a logo bumper first, a black frame 0, everything fading in, glow on UI, invented UI or numbers, clipping) and the production gates (references, style and shot list, storyboard, stills, animatic, full pass, formats) are in `references/hard-rules.md`.

## The playbook

- `playbook/README.md`: the generated index of every rule (by area, with grade and status) and every format.
- `playbook/rules/<area>.json`: the rules. Status says how each is carried: **enforced** (a lint check), **default** (`mp plan` writes it in), **part** (a pack id implements it), **prose-only** (a known gap). `mp rules --gaps` lists the backlog; `mp rules --format launch-film` shows one format's rules.
- `playbook/formats/<id>.json`: beats as fractions of the runtime, the sound shape, hooks, end shapes, exemplars, recommended parts, signals, post pattern.
- **New research flows in as rules, not docs:** `mp study <x-status-url> --reference --slug <round-name>` measures a reference and writes candidate rules to `playbook/inbox/` (brand-free, graded from its reach tier); compare with other references, then `mp rules promote <inbox.json> --id <candidate> --as <area.name>`, then `python3 tools/playbook_build.py`.
- The research behind the rules: `docs/evidence/` (with `INDEX.md`, generated). Checks: `python3 tools/playbook_lint.py --list`. Plan defaults: `node tools/playbook_plan.mjs --defaults`.

## References (moved here unchanged from the old skill, plus the long-standing ones)

| file | what is in it |
|---|---|
| `references/recipes.md` | the decision tree, engine choice, "Reach for X when", and every recipe (A ad, L launch, S SaaS, HW hardware, I proof, P Blender, F short film, T trailer, Z character spot, H talking head, U your footage, E explainer, D delivery, B beat edit, kinetic type) |
| `references/hard-rules.md` | the hard rules in full, the production gates, the banned defaults |
| `references/edit-without-code.md` | `mp new`, `mp set`, `mp render`, `mp check`, `mp list` with one `project.json` |
| `references/checklists.md` | the VIRALITY and QA checklists (the human pass after `mp lint`) |
| `references/ears-and-eyes.md` | what ears and eyes judge and cannot judge |
| `references/outside-assets.md` | outside asset sets (never vendored) and paid cloud audio |
| `references/where-things-are.md` | the short gotchas and the path table |
| `references/launch-playbook.md` | launch-film archetypes and beat sheets from <!--n:launch_films-->20<!--/n--> recent launches |
| `references/apis.md`, `platforms.md`, `virality.md`, `gotchas.md`, `success-patterns.md`, `reference-intake.md`, `critic.md`, `cloud-audio.md` | module APIs, platform specs, the hook evidence, the full gotchas, recurring patterns, learning from a reference, the critic loop, cloud audio |

**Library and tool questions** (GSAP vs Anime.js, Lottie players, physics, post effects, Remotion, encoders) are answered in the **motion-stack** skill.
