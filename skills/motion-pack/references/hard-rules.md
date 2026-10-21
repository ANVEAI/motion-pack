# Hard rules, production gates and banned defaults

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (the full text of the hard rules the router states in short form). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Hard rules (every video)

1. **Ids, not copies.**
   - Reference parts as `transitions/<name>`, `sfx/<cat>/<name>`, `music/<id>`, `type/<preset>`, `layers/<kind>`, `objects/<name>`, `blender/<recipe>`, `cam2d.*` / `cam3d.*` and `cuts/<group>/<name>`.
   - Run `python3 tools/check_ids.py` before rendering; it must report 0 unresolved. It resolves all nine families above (and `templates/<name>`) in code, config and data; `--docs` also reads the `code spans` of Markdown. It does not scan the part ids of `type/gfx` (`ui.*`, `counter.*`, `layout.*`, ...): a wrong one throws `unknown gfx <id>` when the page draws it, while `gfxCues` quietly returns a generic pop cue for it, so look at the stills.
2. **Plan first.**
   - One `plan.json` drives the picture, the sound and the checks: shots, transitions with reasons, the cue sheet, and lint.
   - Start from the closest template in `templates/`. Its `CONFIG` block covers the stock structure. For another aspect (the ad template is 16:9), story-specific sound cues or new scenes, copy its `make.mjs` next to your CONFIG and extend it, keeping every reference an id.
   - Build inside your clone of the pack, for example in `templates/<your-video>/`. Templates find the pack two folders up, and `tools/check_ids.py` scans the pack it sits in (pass a folder path to scan a build kept elsewhere). On macOS, `cp -c -R` makes an instant copy-on-write clone of the whole pack for a scratch build.
3. **Default to the hard cut and motivate everything else.** Every non-cut transition carries a reason (`EMOTION`, `STORY`, `RHYTHM`, `ENERGY`, `REVEAL`, `PLACE`, ...). Lint refuses unmotivated transitions: `make.mjs` exits 2 before it builds anything (`--allow-lint` waives it and records the waiver in `plan.lint.allowed`).
4. **Sound is half the cut.**
   - A cue for visual frame F puts its anchor sample on `(F + 1) x 48000 / fps`.
   - A whoosh peaks on the cut. A riser ends one frame before the hit.
   - Every transition has a paired sweetener (`transitions/catalog.json` `sfx`, `sfx/sweeteners.json`).
5. **Master spec:**
   - −14 LUFS-I, and true peak ≤ −1.5 dBTP on the WAV master. Use −2.0 if clicky transients push the AAC probe over.
   - The delivered MP4 decodes to ≤ −1.0 dBTP. HyperFrames lowers the whole track if its AAC goes over −1, so check the probe, not just the WAV.
   - This is the one loudness contract of the pack: **−1.5 dBTP on the WAV master, ≤ −1.0 dBTP decoded from the delivered AAC / MP4.** A doc or study that says "true peak ≤ −1 dBTP" means the delivered file; the 0.5 dB between them is the AAC overshoot. A plan's `ceilingDb` (−2.0 to −2.5 on clicky films) only moves the master lower, never the delivered limit.
   - The last 0.15 s is digital zero.
   - Use `music/mixer.py`. Never gain SFX by hand (an editor, ffmpeg `volume`): the library is normalised to −6 dBFS peak and the level is set in the plan: `overBedDb` / `overVoDb` on a cue for the mixer, or `gainDb` on a cue when there is no bed (`templates/_shared/audio.py`).
6. **Honesty.**
   - No invented stats, quotes, reviews or logos. A claim containing a digit needs a `source` that says where the number comes from: `lint.proof` checks the plan's `claims` (a template's proof lines or number fields) and `make.mjs` exits 2 on a miss; it refuses a blank, filler or generic source such as "internal benchmark" (it checks the form, not the truth). Keep every stat in a claim with its source, never in a headline.
   - Part defaults are never findings: a part that ships a default number prints `source: placeholder data` in frame until you pass a real `source` (`node type/tests/honesty-defaults.test.mjs`).
   - Label placeholders and concept renders where a viewer could mistake them for real.
   - Use original characters only. References are craft to learn from, never designs to copy.
7. **Measure the delivered file, not dev stills.**
   - `templates/_shared/sheet.py` gives a contact sheet plus LUFS and TP decoded from the MP4.
   - Look at the stills before you call anything done.
8. **Render somewhere safe.**
   - Work outside cloud-synced folders (iCloud, OneDrive, Dropbox): sync daemons can stall file reads mid-render.
   - Check free disk space before renders and stop under 10 GiB.
   - Render demos at `--crf 23`.

## Production gates (pass them in order; long or unattended runs stop at each for approval)

1. **References and assets approved.** Real logo, UI, type, colours and audio are in hand; each reference has a study (`references/reference-intake.md`). A missing asset means stop and ask, never fake it.
2. **Style guide and shot list approved.** Palette, type, shot lengths, transitions, camera and grain (frame-design), plus the shot list (story-script). Both before any code.
3. **Storyboard approved.** `python3 storyboard/board.py shotlist.json --design design.json` draws the sheet (one panel per shot: scale, camera move, the text at its real size, safe zone, sound intent, transition and reason, honesty label) after running the story-script linter. The person who owns the story signs off the sheet and its animatic (`storyboard/README.md`) before any template is built. Warnings on the sheet (reading speed, text outside the safe zone, a label on screen under 2 s) are fixed in the shot list, not in the render.
4. **Stills per shot, critiqued.** One still per shot at final layout, read at 360 px. With a built composition, `storyboard/board.py --plan out/plan.json` shows real key frames on the same sheet.
5. **960x540 animatic.** Timing, cuts and placeholder audio; check the hook and the cut rhythm here, while changes are cheap. `storyboard/board.py` makes the first one from the shot list (the panels timed to the shot durations, the sound intent as real sounds, -14 LUFS, timecode burnt in); the later one is cut from the real stills. **Eyes:** `python3 eyes/look.py animatic.mp4 --plan out/plan.json --draft` has no fail on `eyes/frame0`, `eyes/frames`, `eyes/flashes` or `eyes/pacing` (`--draft` waives the resolution and bit-rate rules).
6. **Full pass.** Polish, the mixed sound, then the critic loop (`references/critic.md`) until every score is 8 or more. **Eyes:** `eyes/look.py` on the delivered MP4 shows no fail and no category under 8 that you cannot explain.
7. **Formats, loop, poster, README.** 16:9 / 9:16 / 1:1 by re-layout, the loop check, a poster frame, and a README with the ids used and the measured loudness.

## Banned defaults (each needs a written reason in `plan.json` to appear)

- A centred title on a gradient.
- Everything fading in. Give each element one entrance verb, and let some arrive by cut.
- Corner labels and decorative captions nobody reads.
- Glow on UI.
- A logo bumper first. The logo belongs at the end.
- A black frame 0. Frame 0 is a strong image already in motion (the first visible change lands by frame 6).
- Invented UI or numbers. Use real screens and sourced numbers, or label the placeholder.
- Clipping. Master through `music/mixer.py` (−14 LUFS-I, ≤ −1.5 dBTP WAV, ≤ −1.0 dBTP delivered).
