# Reference study, rounds 4 + 5: 29 launch and motion films (14 Oct 2026)

There are 29 studies here: 9 from round 4 and 20 from round 5. All were measured with `tools/refstudy.py`, every contact sheet was looked at, and the loudness timelines of the pieces whose sound shape matters most were opened. The full per-beat studies and the gap list stay in the intake folder outside the repository; this page is the paraphrased summary.

**Use:** craft reference only. Never copy a brand, footage, character, wording, music or an exact sequence; each piece is described by what it does. Stills, transcripts and measurements stay outside the repository (`skills/motion-pack/references/reference-intake.md`). The patterns that recur across the batch are in `skills/motion-pack/references/success-patterns.md` section 9.

**Field key:**
- **tier:** `tools/refstudy.py grade` on each `meta.json` (thresholds in `tools/refstudy_tiers.json`). A proven organic, A− saves-strong, B boosted-looking, B′ solid for a big account, R account-size reach, C weak or neutral; `*` = claim-driven (provocative post text, like rate under 0.4%). The rules reproduce the hand grades for all 29.
- **x:** views ÷ followers. **like% / bm%:** likes or bookmarks ÷ views, at study time.
- **sync:** the share of hard cuts within 2 frames of an audio onset; omitted when a piece has no cuts.
- **open / tail:** the quieter of the first two seconds, and the last 2 s, against the body median (`study.json` `quiet`); `quiet_open` is ≤ −6 dB, `quiet_tail` ≤ −10 dB. The end shape is the refstudy label (slam, quiet hold, decay).

## Counts

| tier | n | pieces |
|---|---|---|
| A | 11 | googlegemma, xadisingh, kenbwork, fofrai, ramp, alexandr-wang, sandbar, anabology, spacex, chetaslua\*, alexdanilowicz\* |
| A− | 2 | 0xmovez, firecrawl |
| B | 4 | digitalocean, elevencreative, maxjmeier, gakkuai |
| B′ | 1 | googledeepmind |
| R | 4 | sundarpichai, netflix, google-a, google-b |
| C | 7 | higgsfield, avstorm, runway, fomo, gamma, cognition, kiteai |

- **Sound (28 with audio; firecrawl is silent):** −24.8 to −9.6 LUFS, median −15.1; 8 of 28 peak at or above 0 dBFS; bass share median 33%; cut sync median 47.5% over the 18 pieces with at least 10 cuts.
- **Quiet open:** 13 of 28 (refstudy measure). **Quiet tail:** 17 of 28. Both match the hand counts.
- **Continuous pieces:** 7 of 29 have at most 4 cuts, and 5 of those 7 are tier A or A−.

## Round 4 (9)

| study | tier | reach at study time | format | sound (measured) | takeaway (craft only) |
|---|---|---|---|---|---|
| [alexandr-wang](https://x.com/alexandr_wang/status/2109689491300794551) | **A** | 2,604,288 views, 3.23x, like 0.38%, bm 0.09% | 153 s, 42 cuts, sync 40% | -17.4 LUFS, bass 18%, open -9 / tail -20 dB, decay | frontier-model launch as a team documentary: five faces in five seconds before any name; name supers carry one personal detail |
| [googlegemma](https://x.com/googlegemma/status/2110044337849692644) | **A** | 424,982 views, 3.98x, like 1.49%, bm 1.66% | 60 s, 9 cuts, sync 67% | -14.2 LUFS, bass 24%, open -19 / tail -1 dB, slam | local semantic search: the model shown as a space a query enters, then one UI and five escalating inputs with one VO line each (query ladder) |
| [fofrai](https://x.com/fofrai/status/2110043023954284889) | **A** | 343,238 views, 3.91x, like 1.04%, bm 0.36% | 60 s, 0 cuts | -14.3 LUFS, bass 31%, open -32 / tail -2 dB, decay | model-made epicycle drawing: a fidelity ladder, one parameter step per bar with a live error readout, a dropout, then the same figure in 3D |
| [anabology](https://x.com/anabology/status/2110224953287070195) | **A** | 680,722 views, 7.91x, like 0.24%, bm 0.14% | 20 s, 15 cuts, sync 60% | -13.7 LUFS, bass 58%, open -3 / tail +1 dB, slam | music-video bot teaser: a prompt slam, one word per half-second with the background flipping per word, and a late drop at half-time |
| [googledeepmind](https://x.com/googledeepmind/status/2110039274922131792) | **B'** | 2,230,648 views, 1.42x, like 0.25%, bm 0.06% | 165 s, 36 cuts, sync 47% | -17.3 LUFS, bass 34%, open +2 / tail -37 dB, decay | creator explains a model-built 3D scene: the same prompt across three model generations is the honest way to show progress |
| [sundarpichai](https://x.com/sundarpichai/status/2110038898009407584) | **R** | 4,188,607 views, 0.35x, like 0.57%, bm 0.08% | 51 s, 66 cuts, sync 24% | -11.7 LUFS, bass 17%, open -16 / tail -30 dB, decay | model launch montage: real → generated diptychs as the montage unit; a version number on a physical prop |
| [alexdanilowicz](https://x.com/alexdanilowicz/status/2110030443466940671) | **A*** | 367,937 views, 43.29x, like 0.26%, bm 0.18% | 72 s, 79 cuts, sync 28% | -23.6 LUFS, bass 40%, open -2 / tail -17 dB, decay | design-tool comedy: about 16 spoken commands in 17 s, each answered by the UI on the next frame; silent comic beats in the setup |
| [avstorm](https://x.com/avstorm/status/2109997052616667144) | **C** | 165,351 views, 0.81x, like 0.63%, bm 0.14% | 188 s, 100 cuts, sync 48% | -16.3 LUFS, bass 34%, open -32 / tail -68 dB, quiet hold | smart-home spec ad: feature supers in the room's negative space; polish without a stake did not travel |
| [0xmovez](https://x.com/0xmovez/status/2110046218034229730) | **A-** | 14,587 views, 0.34x, like 1.69%, bm 1.47% | 59 s, 21 cuts, sync 52% | -13.9 LUFS, bass 25%, open +1 / tail -10 dB, decay | explorable-game capture: a metronomic 6 s chapter cadence (every 2 bars) reads as a tour; builders saved it |

## Round 5 (20)

| study | tier | reach at study time | format | sound (measured) | takeaway (craft only) |
|---|---|---|---|---|---|
| [ramp](https://x.com/tryramp/status/2110007780589613121) | **A** | 106,810 views, 2.46x, like 0.64%, bm 0.34% | 108 s, 60 cuts, sync 40% | -16.7 LUFS, bass 33%, open +5 / tail -13 dB, decay | finance-workspace launch: the pain as a typed reaction in a spreadsheet cell; a running cost ticker pinned beside a hand |
| [google-a](https://x.com/google/status/2109734787397325099) | **R** | 985,135 views, 0.03x, like 0.23%, bm 0.03% | 30 s, 20 cuts, sync 50% | -15.2 LUFS, bass 55%, open -15 / tail -12 dB, decay | fitness-tracker launch: flanking words that part around the product; a sentence continued across cuts |
| [runway](https://x.com/runwayml/status/2110061567383577037) | **C** | 37,452 views, 0.13x, like 0.59%, bm 0.22% | 64 s, 37 cuts, sync 73% | -15.1 LUFS, bass 42%, open +1 / tail -23 dB, decay | generative video assets: a quiet dip before the product name; spectacle without a job did not travel |
| [xadisingh](https://x.com/xadisingh/status/2110043768405811618) | **A** | 19,490 views, 8.53x, like 1.49%, bm 1.23% | 36 s, 4 cuts, sync 50% | -12.0 LUFS, bass 36%, open -2 / tail -10 dB, decay | coding-agent benchmark: one cost-vs-score scatter with a frontier line and a starred, sourced hero point is the whole argument |
| [higgsfield](https://x.com/higgsfield_ai/status/2110074247569924489) | **C** | 302,693 views, 1.22x, like 0.26%, bm 0.11% | 23 s, 11 cuts, sync 73% | -9.6 LUFS, bass 50%, open -0 / tail -2 dB, slam | video-model promo: a style ladder on one held composition; the offer-plus-deadline framing sat in a weak post |
| [digitalocean](https://x.com/digitalocean/status/2110019661454528711) | **B** | 1,673,532 views, 7.39x, like 0.02%, bm 0.02% | 75 s, 16 cuts, sync 25% | -16.1 LUFS, bass 31%, open -16 / tail -50 dB, decay | summit promo: a typed question with a block cursor as the opener; boosted reach (0.02% likes) |
| [netflix](https://x.com/netflix/status/2110068047700443191) | **R** | 12,472,095 views, 0.43x, like 0.18%, bm 0.03% | 150 s, 34 cuts, sync 38% | -14.2 LUFS, bass 61%, open -20 / tail -35 dB, decay | feature trailer: quiet dialogue → title cards → wall montage → one line over near-silence → crescendo → hard stop (trailer arc) |
| [spacex](https://x.com/spacexsi/status/2109783335296008414) | **A** | 5,389,230 views, 2.59x, like 0.30%, bm 0.07% | 10 s, 0 cuts | -14.4 LUFS, bass 32%, open -5 / tail -9 dB, decay | bundle announcement in 10 s and 0 cuts: outline tiles draw on, fill on hits and collapse into one name |
| [sandbar](https://x.com/sandbar/status/2110060670700097858) | **A** | 9,810 views, 1.94x, like 1.03%, bm 0.38% | 185 s, 51 cuts, sync 59% | -18.6 LUFS, bass 36%, open +6 / tail -3 dB, slam | voice-ring founder update: transcript bubbles anchored to the speaker in the scene, ticking 'captured' |
| [chetaslua](https://x.com/chetaslua/status/2109375245320847702) | **A*** | 1,693,515 views, 41.84x, like 0.39%, bm 0.26% | 51 s, 14 cuts, sync 57% | -14.0 LUFS, bass 20%, open +2 / tail -6 dB, decay | mixed-media animation with a provocative claim: one recurring object ties the media together; a valley and a build |
| [elevencreative](https://x.com/elevencreative/status/2109992635326988365) | **B** | 600,046 views, 60.23x, like 0.05%, bm 0.03% | 32 s, 9 cuts, sync 67% | -16.4 LUFS, bass 28%, open -6 / tail -39 dB, decay | character swap: one take, three characters, as a proof triptych; boosted reach |
| [maxjmeier](https://x.com/maxjmeier/status/2110002072313901522) | **B** | 3,543,555 views, 4017.64x, like 0.04%, bm 0.02% | 106 s, 40 cuts, sync 30% | -20.6 LUFS, bass 18%, open -1 / tail -6 dB, decay | at-cost membership: slot words beside a talking head; a price reveal against a rival needs a source; paid reach |
| [firecrawl](https://x.com/firecrawl/status/2110037671611412523) | **A-** | 36,287 views, 0.4x, like 0.89%, bm 1.31% | 16 s, 0 cuts | silent | silent 16 s loop: prompt → working → a data table that builds under a one-line finding; saves-strong |
| [fomo](https://x.com/fomo/status/2110030298356318680) | **C** | 33,530 views, 0.2x, like 1.55%, bm 0.32% | 33 s, 7 cuts, sync 14% | -17.8 LUFS, bass 44%, open -8 / tail -44 dB, decay | on-chain search: text riding a curved path behind a flying icon; a tab strip as the transition |
| [gakkuai](https://x.com/gakkuai/status/2109987023365005714) | **B** | 222,873 views, 1826.83x, like 0.14%, bm 0.08% | 170 s, 32 cuts, sync 25% | -13.1 LUFS, bass 31%, open -21 / tail -69 dB, decay | children's writing coach: the spoken description paints the world (sketch → render); paid reach |
| [gamma](https://x.com/gammaapp/status/2110046113986380092) | **C** | 5,812 views, 0.09x, like 1.27%, bm 0.19% | 52 s, 4 cuts, sync 100% | -10.5 LUFS, bass 42%, open -7 / tail -4 dB, decay | presentation connectors: a read-and-tick status list over a painted backdrop; a tool tour without a stake |
| [cognition](https://x.com/cognition/status/2110068304383725720) | **C** | 24,170 views, 0.13x, like 0.92%, bm 0.19% | 21 s, 6 cuts, sync 0% | -18.0 LUFS, bass 26%, open +0 / tail -16 dB, decay | partnership announcement: an 'A · B' partner lockup held on a quiet tail |
| [google-b](https://x.com/google/status/2110091767211078119) | **R** | 602,178 views, 0.02x, like 0.43%, bm 0.07% | 155 s, 63 cuts, sync 49% | -24.8 LUFS, bass 15%, open +2 / tail -58 dB, decay | engineering story: a practical cable-tangle metaphor then an abstract untangle diagram; cuts on each repetition of a spoken word |
| [kenbwork](https://x.com/kenbwork/status/2110071571713061145) | **A** | 26,272 views, 3.31x, like 1.25%, bm 1.00% | 80 s, 0 cuts | -16.2 LUFS, bass 24%, open -39 / tail -64 dB, quiet hold | clinical-benchmark explainer: one diagram grows, the VO leaves a gap every ~4 s and the diagram advances in it; a wrong fork turns red and the red propagates; 9 s silent end-card hold |
| [kiteai](https://x.com/gokiteai/status/2109993390964355489) | **C** | 8,491 views, 0.01x, like 0.80%, bm 0.08% | 67 s, 0 cuts | -14.4 LUFS, bass 43%, open +8 / tail -15 dB, decay | agent-to-agent booking walkthrough: headline left, real screen right, honestly framed; clean but no stake |

## Motion sync on the continuous pieces (re-measured with the new refstudy)

The cut sync returns n/a for a piece with no cuts. `refstudy.py` now detects visual events (frame-difference and colour-change peaks, new text via edge-density jumps, 30 fps at 96x54) and reports the share within 2 frames of an audio onset. Four of the continuous pieces were downloaded again and re-measured on 14 Oct 2026 (`--whisper none`):

| piece | tier | cuts | motion events | events / min | motion events on an onset |
|---|---|---|---|---|---|
| fofrai (fidelity ladder) | A | 0 | 41 | 41 | 61% |
| xadisingh (proof film) | A | 4 | 61 | 101 | 44% |
| spacex (bundle construction) | A | 0 | 22 | 132 | 32% |
| kenbwork (diagram explainer, VO) | A | 0 | 32 | 24 | 31% |

Read these as the edit's rhythm, not a score: the music-led fidelity ladder puts most accents on the music, while the VO-led diagram explainer advances its diagram in speech gaps rather than on onsets (its quiet open is −39 dB and it ends on a 9 s quiet hold).

## What changed in the pack

| rule change | where it landed |
|---|---|
| Cut sync (≥ 60% on an onset) applies to music-led, cut-driven pieces only; VO-led films are judged by speech continuity; continuous films by motion events | `references/critic.md` (sync modes table), `ears/listen.py --mode music|vo|continuous` (default `plan.audio.mode`, else music), `SKILL.md` QA and ears sections |
| Hook: a small product-name super over moving footage is not a bumper; the sound may enter 1–2 s after a moving frame 0 | `SKILL.md` virality checklist, `references/virality.md`, `references/critic.md`; ears waives the frame-0 event for a planned quiet open |
| Quiet hold is a first-class end shape | `references/launch-playbook.md` rule 15 (four end shapes); ears reports the end shape |
| Bed bass share by role | `music/README.md`, `references/launch-playbook.md` sound levels, `ears/listen.py --role` |
| Launch archetypes L8 proof film and L9 multi-voice documentary; L4 names the query and fidelity ladders | `references/launch-playbook.md` |
| Evidence grading (A−, R, auto boosted, claim-driven) | `tools/refstudy.py` (`evidence` in `study.json`, `refstudy.py grade`), `tools/refstudy_tiers.json`, `references/reference-intake.md` |
| Offers and deadlines have no organic evidence | `references/success-patterns.md` sections 6 and 9 |

## Pack coverage (built on this branch)

| technique | pack part | status |
|---|---|---|
| motion sync for continuous pieces, quiet open / tail | `tools/refstudy.py` `motion`, `quiet` | added 14 Oct 2026 |
| evidence tier | `tools/refstudy.py` `evidence`, `refstudy.py grade` | added 14 Oct 2026 |
| planned quiet judged as shape | `ears` `plan.audio.quiet` | added 14 Oct 2026 |
| trailer valley then crescendo | `music/bed_trailer_arc` | added 14 Oct 2026 |
| electric numerals' sound | `sfx/elec/*` | added 14 Oct 2026 |
| cable tangle and bulbs metaphor | `blender/cableTangle` | added 14 Oct 2026 |

The visual parts (scatter frontier, data table, branch trace, the story shapes and the documentary template) are planned in parallel in round 4/5 and are not on this branch.
