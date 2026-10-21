# Outside assets and cloud audio

> Moved unchanged from `skills/motion-pack/SKILL.md` in v0.5 (optional, never vendored; paid cloud audio). The skill itself is now a short router: pick a format, `mp plan`, story, design, render, `mp lint` (`../SKILL.md`, `playbook/README.md`).

## Outside assets (optional, never vendored)

The pack ships what it generates, plus three bundled OFL font families (Manrope, IBM Plex Mono, STIX Two Text; `THIRD_PARTY.md` section 1). It ships no third-party icon, emoji, audio or library file.
- **Third-party CC0/MIT/ISC sets:**
  - Fluent Emoji (MIT), Lucide (ISC), Phosphor (MIT);
  - Kenney audio (CC0), OwlishMedia foley (CC0).
- **Fetching them:** `scripts/fetch-external.sh` downloads them from pinned URLs, verifies checksums, and writes an `ORIGIN.txt` per set.
- **Imported audio:** pass `python3 sfx/tools/check_origin.py DIR` (licence allow-list; exit 2 = refused), then `python3 sfx/tools/catalog_import.py DIR --category NAME`. It lands in `sfx/library_ext/`, tagged `source:ext`, and never in `sfx/manifest.json`.
- **HyperFrames registry items** (`npx hyperframes add <name>`) are remote, third-party files: the pack never vendors them and ships owned equivalents (grain, vignette, leaks, captions, social cards, stickers). Adding one to YOUR project folder is a download: name the item, read its `registry-item.json` licence, and ask first; it has no pack id, so `check_ids.py` and the plan lint do not see it (`docs/evidence/visual.md`, `docs/evidence/expansion-skills.md`).
- **Avoid:**
  - Apple Color Emoji (not licensed);
  - OpenMoji (CC BY-SA, share-alike);
  - stock-site clips (no redistribution);
  - any pack without written licence terms.

## Cloud audio (optional, paid): `cloud/`

When the user asks for generated music, a voiceover, or "use Lyria / Gemini", use `cloud/` (full notes: `references/cloud-audio.md`). It runs on the user's own Google Cloud project, billed to them. State the cost before generating.

- **Setup:** `MP_GCP_PROJECT` (Vertex AI on, billing on), `gcloud auth login`, `pip install -r requirements-cloud.txt`. Never write a project id or key into the repo or a plan.
- **Music:** `python3 cloud/lyria.py "<parts, BPM, instruments>" --seed N --out bed.wav`. About US$0.06 per 32.8 s take. Describe the instruments and tempo, not just the feeling. Make 2–3 seeds.
- **Judge it:** `python3 cloud/gemini_mood.py bed.wav --brief "..."`. Keep takes with `brief_fit` ≥ 7. Use it for feel only; timing and BPM come from local DSP.
- **Voice:** `python3 cloud/gemini_voice.py lines.json --out vo --voice Charon --verify`. The model is `gemini-live-2.5-flash-native-audio`. `--verify` checks every line word for word with Whisper.
- **Mix:** give `music/mixer.py` the bed and the voice. Never ship raw Lyria (about −24 LUFS with 0 dBFS peaks).
- **Disclose:** AI music and synthetic voices are AI content. Never imitate a real person's voice.
