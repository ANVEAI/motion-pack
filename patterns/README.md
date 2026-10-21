# motion-pack / patterns

Craft from very high-view launch videos, trailers, tutorials, vlogs, Shorts and podcast clips, turned into data the templates and skills can apply and check. The evidence for every number is in `docs/evidence/launch-video-patterns.md` (named examples, sources, access dates, contradictions and gaps); these files carry no brand names and link only to the help pages of the platforms the pack targets.

| file | what | used by |
|---|---|---|
| `structures.json` | 18 beat sheets: `saas-launch`, `saas-feature-drop`, `explainer`, `hardware-reveal`, `teaser`, `trailer`, `title-sequence`, `tutorial`, `vlog`, `podcast-clip`, `founder-story`, `short-film`, `ad-15`, `ad-30`, plus the pack's own `character-spot`, `documentary-launch`, `proof-film`, `beat-edit`. Each section has a start and end as % of runtime, a target ASL, a words-per-second ceiling, music intensity 0-1 and its sound-design role; each structure has a length range, a hook rule, a CTA window and, where it applies, the sections a 6 / 15 / 30 / 45 / 60 s cut-down keeps. `template_map` says which pattern scores which shipped template (or why none does) | `tools/structure_check.py`, story-script (beat sheets), motion-pack (template CONFIGs) |
| `hooks.json` | 13 hook archetypes (the seven the ad template and story-script already use, plus `live-demo`, `cold-open`, `light-from-dark`, `provocative-line`, `promise`, `founder-to-camera`), each with when to use it, its frame-0 requirement and three original, generic example lines | story-script (three hook variants), the ad template's `hook.archetype` |
| `ctas.json` | where the CTA goes, how long it holds and how it is worded, per platform (YouTube end screens, ad end cards, TikTok's close, the Reels safe zone) and per format (launch, founder, trailer, podcast clip, loop) | social-video, the templates' end cards, `structure_check` |
| `lengths.json` | platform limits (Shorts, Reels, TikTok, X, LinkedIn, YouTube ad formats) and format sweet spots (trailer corpus mean, launch films, founder videos, podcast clips, lesson chunks) | social-video, story-script, `structure_check` |

**Grades.** Every structure, hook and row carries one: `platform` (the platform publishes it), `study` (measured), `practitioner` (belief from practice), `inference` or `house` (our tunable default). No source measures beat timings as % of runtime, so every beat percentage is `practitioner` or `inference`: a default to tune by eye and by your own analytics, never a law.

## Check a plan

```bash
python3 tools/structure_check.py templates/ad/out/plan.json                 # the pattern comes from the plan's template and length
python3 tools/structure_check.py templates/ad/out/plan.json --pattern ad-30 # force one
python3 tools/structure_check.py --all                                      # every genre template's committed plan
python3 tools/structure_check.py --list                                     # the patterns and the template map
```

It reads a plan only (stdlib, no browser, no render) and scores five things, weighted into 0-100 (pass: 70):
- **timing:** each required section found by name or alias, in order, inside the tolerance;
- **pace:** ASL against the pattern and per section; for a continuous film, the gap between motion events;
- **text:** words per second, characters per second (17) and the time-on-screen floor;
- **hook:** no logo or black first shot, hook text by 0.3 s where the pattern needs it, the first sound by frame 3 or a planned quiet open;
- **CTA:** inside its window and held long enough.

Every miss prints a fix with seconds. Frame-0 motion, safe zones and contrast are measured from the MP4 by `eyes`, not here.

A plan can name its pattern and sections explicitly, which wins over the shot labels:

```json
"structure": {"pattern": "saas-launch", "sections": [{"name": "hook", "t": [0, 6]}, {"name": "reveal", "t": [12, 18]}, {"name": "demo", "t": [16, 42]}, {"name": "cta", "t": [52, 60]}]}
```

Tests: `python3 -m pytest -q tools/tests/test_structure_check.py` (a good plan scores high, one broken plan fails every check, each single mutation lowers its own check), and `python3 tools/mutation_check.py tools/tests/structure_check.mutants.json` (15 mutants of the scorer, all killed).
