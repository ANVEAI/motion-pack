# Lane 5 (research): notes for the merge

Branch `xp-research`, from `main` bbd7da9. Only new files, except the two shared-file edits below, both additive.

## New files (no conflicts expected)

- `docs/research/launch-video-patterns.md`: the evidence. Nine categories plus the pack's own genres, with the top 15 findings, sources, grades, contradictions and gaps. Named examples live only here.
- `docs/research/pack-gap-analysis.md`: commercial packs and AI tools vs motion-pack today and after this round, as feature categories, with a ranked list.
- `patterns/README.md`, `patterns/structures.json` (18 structures), `patterns/hooks.json` (13 archetypes), `patterns/ctas.json`, `patterns/lengths.json`.
- `tools/structure_check.py`: scores `out/plan.json` against a structure and prints fixes.
- `tools/tests/test_structure_check.py`: 26 tests, run by the existing `tools/tests` pytest step.
- `tools/tests/structure_check.mutants.json`: 15 mutants, all killed.

## Shared-file edits MADE (additive; re-apply on a conflict)

1. **`.github/workflows/ci.yml`:** two steps inserted right after the `tools/check_names.py` step:
   ```yaml
         - name: "structure check (every genre template plan scored against its beat sheet in patterns/structures.json, or reported with a reason)"
           run: python3 tools/structure_check.py --all
         - name: "structure check mutation proof (each scoring rule fails its test when broken)"
           run: python3 tools/mutation_check.py tools/tests/structure_check.mutants.json
   ```
2. **`tools/name_denylist.txt`:** 22 hashed lines appended. They cover the studios, vendors, launches and people that `docs/research/launch-video-patterns.md` and `pack-gap-analysis.md` cite (four tagged `person`). Union-merge: keep every line from both sides. After the merge, `python3 tools/check_names.py` must report 0 hits. If another lane's shipped file trips one of these hashes, that file names a studied source outside `docs/research`: fix the file, never drop the hash.

## Shared-file edits NEEDED (exact text; I did not touch these files)

**A. `README.md` module table.** Add a row after `storyboard/` (do not hand-edit counts):
```
| `patterns/` | 18 beat sheets (section timing as % of runtime, ASL, text ceilings, music intensity, sound role, CTA window, cut-downs), 13 hook archetypes with frame-0 rules, CTA placement and platform lengths, all graded and sourced in `docs/research/launch-video-patterns.md`; `tools/structure_check.py` scores a plan against them | `patterns/README.md` |
```

**B. `skills/motion-pack/SKILL.md`.**
1. In the QA checklist, after the **Ids** item:
   ```
   - [ ] **Structure:** `python3 tools/structure_check.py out/plan.json` scores 70 or more against the genre's beat sheet (`patterns/structures.json`; the template map picks it, `--pattern` forces one), and each printed fix is either applied or answered in the plan.
   ```
2. In "Reach for X when", a new row:
   ```
   | a beat sheet for a genre (SaaS launch, feature drop, explainer, hardware reveal, teaser, trailer, title sequence, tutorial, vlog, podcast clip, founder story, short film, ad 15/30) with section timing, ASL, text ceilings, music shape and the CTA window | `patterns/structures.json`; hooks `patterns/hooks.json`; CTAs `patterns/ctas.json`; lengths `patterns/lengths.json`; check with `tools/structure_check.py` | every number is graded; beat percentages are practitioner or inference, never platform rules (`docs/research/launch-video-patterns.md`) |
   ```
3. Under RECIPE L, step 0, append:
   ```
   For a SaaS, AI, hardware, founder or trailer-shaped launch, start from the matching structure in `patterns/structures.json` and run `tools/structure_check.py` on the plan before rendering.
   ```

**C. `skills/motion-pack/references/virality.md`.** At the end of §1, after the seven archetypes:
```
Six more archetypes, each with its frame-0 rule and generic example lines, are in `patterns/hooks.json`: `live-demo` (AI products: the work already running on frame 0), `cold-open` (trailers), `light-from-dark` (hardware), `provocative-line` (podcast clips), `promise` (tutorials), `founder-to-camera`. Evidence: `docs/research/launch-video-patterns.md` §2.
```
Also in §2, after "Static limit", add:
```
- **Pace shape:** contemporary films start with longer shots, shorten through the setup, cut fastest in the climax and lengthen at the end (a measured 210-film study; `docs/research/launch-video-patterns.md` §3). Set ASL per section (`patterns/structures.json` `asl_s`), not one global rate.
```

**D. `skills/story-script` (SKILL.md, "Hooks: three variants on one body").** Append:
```
- **More archetypes and beat sheets:** `patterns/hooks.json` (13 archetypes with original example lines and frame-0 rules) and `patterns/structures.json` (beat sheets as % of runtime for 18 genres). Use them for the 30/60/90 s tables above when the format is a launch, trailer, tutorial, vlog, podcast clip or founder story.
```

**E. `skills/social-video` (`references/platforms.md`).** Add a line under the platform table:
```
Machine-readable limits and CTA windows with their sources: `patterns/lengths.json` and `patterns/ctas.json` (in the pack). A YouTube or Instagram "view" now counts every start or replay; judge a hook by the 3 s hold and average view duration, not by views.
```

**F. `skills/motion-pack/references/platforms.md`.** Same pointer as E.

## Notes for other lanes (apply when you build a template)

- Name your sections so `structure_check` finds them, or write `plan.structure = {pattern, sections: [{name, t: [a, b]}]}` from `buildPlan`. Add your template to `patterns/structures.json` `template_map`, pointing at a pattern or giving a `why`. The test fails while a genre template has no entry, so each lane appends one line when its template lands.
- **The committed `ad` plan scores 94.** Three proof and benefit lines read faster than 17 cps. The fix is in the ad template's CONFIG (hold 2.0-2.3 s, or cut the line to 4-5 words), not in the checker.
- **`multi-voice-doc` scores 92.** Its name supers hold 1.03 s for 4-5 words; the floor is 1.5 s.
- **`proof-film` scores 89.** Three 4.0-4.3 s stretches have no motion event; the ceiling is 3.5 s.
- All three pass. These are suggestions for whoever owns those templates; I did not change them.
