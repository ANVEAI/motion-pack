# Film, trailer and title-sequence craft (film lane, 16 Oct 2026)

What the film parts of the pack encode, and why. This is craft knowledge: structure, timing, sound shape and type conventions that recur in film trailers, opening-title sequences and short films. **No trailer, title sequence, score, shot, logo or wording is copied, and no film is named here.** The numbers are house starting values to tune by eye and by retention data, not measurements of any one film, except where a row cites the pack's own earlier study.

## 1. Evidence we have, and its limits

| source | what it gives | grade |
|---|---|---|
| `docs/research/reference-round45-2026-10.md`, the feature-trailer row (one public trailer, measured with `tools/refstudy.py`) | 150 s, 34 cuts (an average shot of about 4.4 s over the whole trailer), integrated loudness about -14 LUFS, a bass share of about 61%, a quiet dialogue open and a decaying tail; shape: quiet dialogue, title cards, wall montage, one line over near-silence, crescendo, hard stop | one reference, measured; the shape is the useful part, the exact numbers describe one trailer only |
| `cuts/patterns.json` `story.trailerArc` (round 4/5) and `music/bed_trailer_arc` | the pack's first trailer shape: section shares, a 2-4 s question over near-silence, a crescendo, a hard stop, a quiet hold | house values derived from the reference above |
| General editing and sound-design practice (trailer houses' published talks and interviews, editing textbooks such as Murch's *In the Blink of an Eye* for J / L cuts) | the conventions in sections 2-6 | conventions widely described in the trade; we did not run a corpus study for this round, so treat them as hypotheses that the renders make easy to test |

What we did NOT do this round: no new reference intake, no view-count or retention claims, no study of a specific trailer's cut list. The film lane builds the parts and templates; a reference study per genre is the obvious next step (`skills/motion-pack/references/reference-intake.md`).

## 2. The trailer shape

| beat | job | house default (full cut at 120 BPM) |
|---|---|---|
| cold open | a strong image already moving and one line of dialogue: the stake before any branding | 2 shots, 8 s, room tone + radio static, the score's act-1 drone |
| production card | the maker's name, after the cold open (a logo bumper first is a banned default in the pack) | 4 s, original six-blade aperture mark, a slow sub drop |
| the world | where we are, said in pictures, one thin title card | 8 s, a dissolve in from the card |
| the inciting beat | the thing that should not happen | a film burn into it (EMOTION), a boom on the cut |
| act 2 montage | pressure: the shot length halves (4 beats -> 2), interstitial cards, braam stabs every second bar | 12 s, "from the makers of" and two thin cards |
| act 3 wall | the escalation: 2 beats -> 1 beat -> 8th notes, a braam on every bar downbeat, cards take the title's weight, a flash frame every second bar | 12 s |
| the silence before the hit | the wall stops dead on a downbeat; 1-3 s of near-silence (or digital silence for horror) with one line | 2 s, a reverse suck ends on the stop frame |
| the title | lands ON the hit frame, by cut, no fade | 3 s, the genre's title style, an anamorphic flare sweep |
| the button | one more beat after the title: a short scene, then a sting on the cut to black | 4 s |
| credit block | the billing block (see 5) under a small title | 4 s |
| release card | the date (or "coming soon") and the url; the score's final hit | 4 s, held |

**Cut-downs come from the same plan.** The 30 s and 15 s cuts keep the cold open, the inciting beat, a shorter wall, the silence, the title and the date; the world beat, the production card (15 s) and the button go first. The music is re-rendered for the exact cut (whole bars per act), so the score and the picture always agree to the frame.

## 3. Cut rate against time

A trailer accelerates. The pack's rule (`cuts/patterns.json` `trailer.accelerate3Act`, `cuts/trailer_plan.py`): beats per shot fall from 8 -> 6 in act 1, 4 -> 2 in act 2 and 2 -> 1 -> 0.5 in act 3; every cut sits on the score's half-beat grid; every act-3 bar downbeat is a cut (the braam lands on it). At 120 BPM that is about 0.25 cuts/s in act 1, 0.6-0.7 in act 2 and about 2 in act 3, ending on 8th notes (4 cuts/s). The fastest stretch stops dead into the silence: the contrast is the point.

**Flash safety:** the fast end cuts between plates of similar luminance; white flash frames are at most one every two bars (far under the WCAG limit of 3 per second); `eyes/flashes` measures the delivered file.

## 4. Sound

- **The score is the clock.** A trailer score is built in three acts (a bed and a motif; a pulse or ostinato with stabs; a wall with a hit on every bar), then a hard stop, a silence, the title hit, a near-silent button, and a tail under the credits with a final hit (`music/trailer_styles.py`: thriller, sci-fi, horror, drama; `music/bed_trailer_arc` is the original action arc).
- **Braam:** a low brass-like blast (detuned saw stacks on A1 / E2 / A2, a bite that closes, a growl); the stakes-rising hit. The pack's braams are synthesised and in A, so they sit on the scores.
- **Hit, silence, hit:** the last wall hit, the picture to black on the next frame, 1-3 s of planned silence (a faint ring at most), then the title hit. Shorter than 1 s reads as a stutter, longer than 3 s as a dropout.
- **Risers end one frame before the hit** (the pack's house rule R1); a reverse swell or a reverse braam ends ON the hit.
- **Do not double the score.** The act-3 braams and the title hit are in the score; the plan adds only what the score does not carry (cards, pass-bys, the stop, the button, the room tone and the radio).
- **The button** is quiet on purpose: the title hit rings out and only the scene's own sound is left.

## 5. Type conventions

- **Title cards:** heavy metallic slab caps (action, thriller), thin wide-tracked caps that keep opening (sci-fi, drama), distressed print (horror), letters as windows onto a rising light (drama, epic), a title cut in half along a slice (noir, action). One style per trailer; the act-3 cards take the title's weight, the act-2 cards stay thin.
- **The billing block** is a run of credits in a tall condensed face, role words small and names large, every line justified to one width. The pack has no condensed OFL face bundled, so `credits.billingBlock` compresses Manrope with SVG `textLength` (a synthetic condensed face: pass `font` for a real condensed family).
- **"From the makers of"** is a claim about the maker: the part prints a placeholder label until you name a work you really made.
- **Quote cards only with a source.** No invented reviews, no stars: `card.quote` renders a red "needs a source" card when the source is blank.
- **No rating-board marks, no studio logos, no real titles.** The production card is the user's own company name with an original mark.
- **Opening titles:** a small role over a large name, one name at a time, landing on a beat; the names move around the safe frame; the main title arrives late with its own hit; "directed by" closes.
- **Subtitles:** one or two lines, white with a dark outline and shadow, inside the picture (above the bottom UI band on 9:16), held at least their reading time (0.35 s + 0.28 s per word).

## 6. Looks

One look per piece, and the genre is the look (`layers/presets/film-looks.js`): thriller teal-orange, sci-fi cold, horror crushed, drama warm, documentary natural, noir (monochrome through a red filter), period / vintage (faded warm print), anime ink (cel colour plus a posterise-and-line pass). Each look ships as a generated `.cube` (CC0) and as the SVG filter the DOM page uses, with halation (a red fringe around highlights), gate weave held per film frame, exposure flicker, grain, dust and the letterbox (2.39, 2.0 or 1.85 on 16:9; 9:16 is re-laid out full frame, never letterboxed). The looks were tuned on the pack's procedural plates, not on real footage: re-judge on yours.

## 7. Short films

Scene slugs typed on, chapter cards on black, dialogue as subtitles from a lines or words JSON (no voice is generated), J / L cuts on each scene's sound (the next scene's room tone leads its picture by 0.6 s; the previous one lingers where there is no J), a dissolve for time passing, a dip to black into the end credits, the score entering on emotion (scene two), not on action.
