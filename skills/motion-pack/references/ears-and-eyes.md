# Ears and eyes: judge the sound and the picture you cannot perceive

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (`mp lint` wraps both reports as lint.ears.* and lint.eyes.*). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Ears: judge the sound you cannot hear

`python3 ears/listen.py out/<video>.mp4 --plan out/plan.json [--transcript words.json] --md ears.md` (`ears/README.md`). `tools/critic_pack.sh` runs it on every review.

- **Mood (optional):** `--mood gemini --brief "..."` adds a whole-track mood and brief-fit read through `cloud/` (paid, sends audio to Google, opt-in only); it varies run to run, so trust only big gaps. Local CLAP via `EARS_CLAP_MODEL` is the free alternative.
- **When:** on every delivered render, before the critic loop, and again after each sound fix. Run it on the WAV master too when the delivered file drifts.
- **What it judges:**
  - loudness, true peak, LRA and the silent tail;
  - clipping and intersample overs;
  - mud, harshness and dullness, with time ranges;
  - ducking and masking under a voice (with a transcript);
  - the edit by mode (`--mode music|vo|continuous`, default `plan.audio.mode`, else music): cuts on onsets, speech continuity (no cut inside a word), or motion events on onsets; and every plan cue on F + 1 (it finds the mixer's exact take, to the sample);
  - a flat mix (the blindfold test), late drops, the breath before the final sting, dead air, and the ending shape (slam, sustained sub, quiet hold, decay);
  - planned quiet is shape, not a fault: mark a quiet open (≤ 2 s), a reset dip or trailer gap (≤ 4 s) or an end-card quiet hold (≤ 9 s) in `plan.audio.quiet` `[{t: [a, b], kind, why}]`;
  - with `--role proof|explainer|hype|trailer|vo_doc|brand_launch` (or `plan.audio.role`), the bed's bass share against the studied range for that role (brand_launch 50-60%, round 6);
  - repeated SFX and mono compatibility.
- **What it cannot judge:** taste, mood without a local CLAP model, whether a sound fits the picture, or a voice's naturalness.
- **It measures; it does not replace one human listen** at phone size and on headphones. Its sound score is a ceiling: listen, then lower it for what you hear.

## Eyes: judge the picture you cannot see

`python3 eyes/look.py out/<video>.mp4 --plan out/plan.json [--platform tiktok.organic] --md eyes.md` (`eyes/README.md`). `tools/critic_pack.sh` runs it on every review.

- **When:** on the animatic (`--draft`), on every delivered render, and again after each picture fix.
- **What it judges** (9 checks, each with a measured value, a pass / warn / fail and a fix with timestamps):
  - frame 0: not black or flat, a readable subject, the first visible change by frame 6;
  - black, empty and frozen runs the plan does not call a hold or a dip, a black tail, playback stalls;
  - flashes: WCAG general and red flash, at most 3 a second;
  - banding in smooth gradients after the encode, with the region and the grain or encode fix;
  - safe zones: every box in `plan.texts` against the platform rectangle, or without boxes the persistent text-like edges inside the unsafe bands;
  - text readability: size at 1080 and on a 360 px phone against the frame-design floors, time on screen (0.35 s + 0.28 s per word), and the WCAG contrast measured from the pixels behind it;
  - pacing against the plan's format or `paceRule`, and the longest static hold; composition: one hero per key frame (a proxy), unplanned letterbox bars, aspect and resolution for the platform; the encode.
- **Give it the plan.** Text checks need `plan.texts [{text, t, box, fontPx, role, fg}]` (the shot's `text` and `textDur` give timing only); a still the plan marks (`shots[].hold`, `plan.holds`, `audio.quiet` kind hold) or a dip (`plan.black`, a `dip` transition) is judged as shape, not a fault.
- **What it cannot judge:** whether the picture is good, what the hero is, whether text says the right thing, taste, or whether motion has intent. Its score is a ceiling: look at the stills, then lower it for what you see.
