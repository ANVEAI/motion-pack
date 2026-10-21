# Edit without code: one project file, the mp CLI

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (the project.json path that `mp plan --project-out` and `mp new --project` use). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Edit without code: one project file, the `mp` CLI

For a person who does not code, or an agent that should not touch template code, make the video from ONE `project.json` (schema `templates/_shared/project.schema.json`; walkthrough `docs/EDIT-WITHOUT-CODE.md`):

1. `tools/mp new <template>[,<template>] <dir> [--project p.json]`: a folder OUTSIDE the pack with `project.json`, `renders/` and `build/` (a copy-on-write copy of the template; the rest of the pack is linked).
2. `mp brand logo.svg --write`: accent, ink and paper from the logo, contrast-checked (a failing colour moves in L* to the nearest passing one).
3. `mp set text.headline "..."`, `mp set media.hook.src clip.mp4`, `mp set aspects 16:9,9:16`, `mp set config.<template>.<CONFIG path> <value>`: each one validates the whole file first, so a refused value changes nothing.
4. `mp render [--template <id>] [--workers 1]`: every template of the project in every aspect it supports, as `renders/<template>-<WxH>.mp4` plus its plan and a contact sheet with loudness; a `manual` aspect is skipped with the reason, and a file whose ffprobed WxH is not its aspect's size fails the render (kept as `.WRONG-SIZE.mp4`).
5. `mp check`: project honesty, banned demo words, the name denylist, check_ids, the plan lint, LUFS / TP from the MP4, eyes and ears. Then LOOK at `renders/*.sheet.jpg`.

`mp list [--json]` is the contract for agents: every template, the project fields it uses, their CONFIG targets and values, required slots and aspects. A digit in `text.*`, `brand.cta` or `brand.line` needs a claim with a real source; a null media slot renders a labelled placeholder. Inside a template folder, `node make.mjs --project p.json --aspect 9:16 --set k=v` does the same as `mp build` (project, then `overrides.<template>`, then `--set`).
