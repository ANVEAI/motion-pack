# What makes these launch and motion films work: hooks, sound, motion, storyboard, climax, CTA

These patterns come from the founder's 10 shared references (13–14 Oct 2026) plus the 15-launch study in `docs/research/launch-films-2026.md`. Section 8 adds round 3: 25 more references studied on 14 Oct 2026 (`docs/research/reference-round3-2026-10.md`). Section 9 adds rounds 4–5: 29 more, graded with `tools/refstudy.py grade` (`docs/research/reference-round45-2026-10.md`).

**Evidence tiers:**
- **Proven reach:** Clueso, 742K views and 1.3K bookmarks.
- **Claimed:** Base44, "14M views" per a breakdown poster.
- **Craft-only:** concept pieces from small accounts at 1–4K views (Stan Launchpad, Pinterest concept, Customer.io concept, abdinmotion, Animala, shapelayer).
- **Method:** the seeco article.

Craft-only references teach technique, not reach.

**Studies:** `docs/research/reference-*-2026-10.md` (Base44, Pinterest concept ad, Stan Launchpad, the seeco method), each with source links, what to learn, what not to copy and pack coverage. How to run a new one: `reference-intake.md`.

**How the measurements were made:** `tools/refstudy.py`.
- Cut counts are inflated on glitch or dither pieces.
- Tempo is an estimate.
- Whisper transcripts were checked for music hallucination.

## 1. Hooks: the first 2 seconds

| hook type | example | why it works |
|---|---|---|
| **Interrupted cliché** | Clueso: a stiff "we raised $10M" announcement, then "This is really boring. Can we try something new?" | It sets up the expected format and breaks it in under 10 s. The viewer is in on the joke |
| **Question to the viewer** | "Is your pet feeling off?" (Animala); "Still searching for inspiration everywhere?" (Pinterest) | It names the viewer's problem in 5 words |
| **Sentence that builds** | "Your clients… dream big" (Base44); "Build your next big thing" (abdinmotion) | Small type, word by word, so the eye reads before it judges |
| **Letters or shapes assembling** | "Meet" from scattered letters and coloured dots (Customer.io); cursor → logo glyph morph (abdinmotion) | Motion with no words needed; the brand forms in front of you |
| **Archival metaphor** | Flight footage, then "Every flight started as a dare" (Stan) | Borrowed emotion; it works only if the payoff is real people |

**Rules:**
- Frame 0 is already in motion.
- The hook names a problem or breaks an expectation.
- At most 7 words on screen.
- Never a logo bumper. Stan's 1.5 s of black cost it.

## 2. Storyboards: the shapes that recur

**A. Sentence-led product film** (Base44, Pinterest, Customer.io, abdinmotion, Animala; 10–52 s):
1. hook sentence;
2. the product world (output, not the tool);
3. **"AI at work" state**: steps ticking, scanning, building;
4. result UI;
5. proof or growth (chart, numbers);
6. one-line promise ("Keep your pets thriving", "It's already done", "Helping you move");
7. brand colour field with the logo.

**B. Mockumentary** (Clueso, 3:05):
1. a format break;
2. a title card in a genre parody (Netflix doc, conspiracy board);
3. 4–6 characters, **one pain each**, escalating to absurd ("Hi" 400 times, sleep-talking);
4. a cut to "what it takes to solve this";
5. **social proof wall** (1,000+ companies), then **investor proof**;
6. a callback to the opening joke;
7. the logo.

**C. Metaphor manifesto** (Stan, 22 s): an archive metaphor in three lines, real people as the payoff, then the title. See playbook L7.

**D. State morph** (seeco method): one container morphs through every state (logo → button → field → loader → check → dashboard → chart → toast → logo) and loops.

**Shot economy:**
- Product films hold each beat 1.5–3 s (Pinterest median shot 3.0 s, Base44 1.7 s).
- Comedy runs on reaction cuts of 0.3–0.5 s (Clueso median 0.37 s, 28.5 cuts/min).

## 3. Motion vocabulary that recurs

- **Inline media in sentences:** images or card stacks sit between words.
- **Card systems:** a fanned stack riffles, diagonal rivers stream with motion blur, cards fly in from off-frame.
- **Agent-at-work UI:** a vertical list of verbs (Checking / Writing / Planning / Scraping) with the active row bold and the rest faded. Pair it with a data card (map with points, "5.6k verified leads").
- **Workflows that draw themselves:** trigger → action → condition → yes/no branches with elbow connectors; the camera pans along.
- **Prompt bar → send → result:** the typed prompt is the action beat. A cursor clicks the send button.
- **Scan overlay:** corner brackets, then a coloured segmentation sweep over the subject, then a status line ("Scanning… / Diagnosis ready").
- **Word wheel:** a vertical list with the active word bold.
- **Orbit of logos** around a centred phrase on concentric rings.
- **Giant monospace marquee:** the phrase scrolls horizontally, full-bleed.
- **Pixel or dither checker wipes** between light and dark scenes.
- **Connector labels:** small tags with elbow lines on a light grid ("From the first idea → to the final deploy").
- **Brand colour field:** the last 2–3 s on a solid brand colour, with the logo or a one-liner.
- **Comedy grammar:** name supers (NAME, role), held deadpan close-ups, an invert/negative flash, a subtitle-speed gag, a cut to bed.

## 4. Sound

| measure | range seen | take |
|---|---|---|
| Integrated loudness | −9.2 to −14.9 LUFS, several peaking above 0 dBFS | **Don't copy the clipping.** Keep the pack master at −14 LUFS / ≤ −1 dBTP; it plays back at the same level on platforms that normalise |
| Bass share (<150 Hz) | 32–66%, mostly 40–66% | Warm, bass-led beds; the highs stay low (1–6%) and UI ticks carry the sparkle |
| Cuts on a sound onset | 45–80% (Pinterest 80%, Customer.io 75%, Animala 75%, Base44 53%, Clueso 45%) | **Cut on hits** in a music-led, cut-driven piece: target ≥ 60% of cuts within 2 frames of an onset (`cuts/cutgen.py snap`); VO-led and continuous films are scored by their mode (§9, `critic.md`) |
| Tempo (estimate) | about 120–140 BPM for the product films | 120–136 BPM fits a 1.5–3 s beat cadence |
| Voice | Base44: sparse VO, ~1 line per beat (57 words in 52 s). Clueso: dialogue at 145 wpm. Others: no VO | A product film is text-led or uses a sparse VO "verb ladder" (*Build it all. Expand. Automate. Multiply.*). Comedy uses real dialogue |

**Sound design moves** (pack bundles `saas_launch` and `mockumentary` in `sfx/bundles.json`):
- UI ticks on every state change;
- a rising "working" texture under agent-at-work states (`sfx/ui/agent_working`, `sfx/ui/scan_sweep`);
- a whoosh on card movement (`sfx/paper/card_riffle`, `sfx/paper/card_shuffle_settle`);
- a soft hit on the brand-field slam (`sfx/hit/brand_field_slam`);
- comedy uses room tone, hard dialogue cuts and silence before the punchline (`cuts/story/mockumentaryReaction`).

## 5. Climax

- **Product films:** the climax is **the result arriving**: "Diagnosis ready", the dashboard filling, the chart rising, then the one-line promise.
- **Funding and mockumentary films:** the climax is **proof at scale** (a logo wall of 1,000+ customers, investors doubling down), followed by a **callback** to the opening joke.
- **Manifesto films:** the climax is the **giant-type line breaking apart** (dither disintegration), cut straight to real people.

## 6. CTA and end

- Brand colour field plus logo, held 1.5–3 s (Base44 orange, Animala green, abdinmotion orange).
- A one-line promise before the logo: "It's already done", "Keep your pets thriving", "Helping you move".
- The post copy carries the ask (waitlist, URL). The end card stays clean.
- Funding announcements end on the plain fact, delivered as the joke's payoff ("we just raised $10,000,000").
- **Offers and deadlines have no organic evidence.** Round 3: comment gates drove replies, not purchases. Round 4/5: offer-plus-deadline posts ("60% off", "7 days only") appeared only in tier-C or boosted pieces, and the at-cost price-reveal film was boosted-looking (B). Use an offer only when it is real, with honest terms, and never as the hook (section 9).

## 7. For ANVE, specifically

- **Pre-launch hype:** the sentence-led film (pattern A) with honest labels, and the mockumentary (pattern B) for the Munshi-ji universe. Clueso shows that office-pain comedy plus a documentary parody travels.
- **Agent-at-work UI** is the strongest honest motion for an AI box: real steps from the product's own call log.
- **Avoid:** clipping, 1.5 s black opens, fake UI, invented proof numbers.

## 8. Round 3 (25 references, 14 Oct 2026)

Per-piece studies with source links: `docs/research/reference-round3-2026-10.md`. Reach is judged against followers; bookmarks are the "save to learn" signal.

**Evidence tiers for this batch:**

| tier | pieces | read |
|---|---|---|
| **A. Proven organic** (>= 1.5x followers, or >= 1.5% bookmarks at a healthy like rate) | lexnlin (43K, 3.8% bm), kevin-t-ngo (41K, 2.0x, 1.9% bm), kaif9998 (1.55x), motionbyleo (2.8% bm), austinbauwens (3.1% bm), cleeeeeeeeement (1.9% bm), emmanuel-2m (27K, 1.6% bm) | Technique makers save. Many are "made with a model" posts, so the savers are creators, not buyers |
| **B. Huge reach, boosted-looking** (100-280x followers, 0.15-0.27% likes) | fishaudio (8.9M), fishaudio-2 (6.3M), mutchtaba2 (536K) | The format travelled, but paid or celebrity distribution cannot be separated out; bookmarks and replies are the real signals |
| **B'. Strong for a keynote** | hark-labs (169K, 10x) | An 8-minute film still reached 10x; saves were low (0.29%) |
| **C. Weak or neutral** | hyperframes, motion-so, hanifproduktif | Polish alone did not travel |
| **D. Craft-only** | wolffifx, motionbyflox, quickyaep, shajareditx, athrix-codes, titouangillet, madebykframe, artecapp, isaacedits, notalexdev, imranuxi | Learn the move; ignore the numbers |

**What changed or was added:**

- **Hooks still hold** (frame 0 in motion, <= 7 words, no logo bumper). New: a sentence that turns *on the beat drop* (A), motif before meaning (A), a hero-detail cold open (A), a combative claim to camera (B), a personal confession in a void (B'), demo-as-gag (B).
- **New storyboard shapes:**
  - **E. Brand-system tour** (A on saves): construction grid -> mark -> mark on an object -> type specimen -> palette -> in-use mock-ups -> lockup -> **3 s silence** -> a giant cropped sting.
  - **F. Founder live-demo film** (B): talent to camera, a live demo as the spine with explanatory overlays (transcripts, latency badges, receipts), proof over people, offer, a comedic tag. The only seven-figure shape here, and it is talent-led.
  - **G. Accelerando motif film** (A): one motif, windows into vignettes, cuts accelerating 1 -> 0.5 -> 0.25 -> 0.125 s, a mosaic of everything, a 1 s dip, the wordmark (`cuts/sections/build_accelerate`, `blender/diorama`).
  - **H. Pipeline reveal** (A): prompt -> agent plan -> wireframe -> clay -> colour -> exploded, knolled -> file chip -> variants -> the product used in the world -> title (`cuts/story/pipelineReveal`, `blender/passReveal`, `blender/knolling`, `blender/cloudFlight`).
  - Pattern A (sentence-led) holds, upgraded with a late drop and visible self-checks (a score stepping up with its reason).
- **Shot economy:** four pieces have zero hard cuts; continuity comes from shared elements and camera glides (proven by kaif9998). Not sufficient alone (motion-so, C).
- **Motion vocabulary (craft-only unless noted):** accent-word swaps, words split around media, pill counters, strike-outs; tab-pill navigation, live transcripts with per-turn latency, walls of parallel browser windows, failover routing, receipt compares; construction grids, palette columns, backdrop swaps; powers-of-ten dives, pull back to a screen in a room; **soft mesh-gradient fields** (the default background in 6 pieces), grade-in, **sketch / wireframe -> render**; a 2D mascot narrator.

**Sound, measured (22 with audio):**

| measure | this batch | take |
|---|---|---|
| Integrated loudness | -22.5 to -8.1 LUFS, median -16.1; 7 peak at or above 0 dBFS | Keep the -14 LUFS / <= -1 dBTP master; copy neither end |
| Bass share (<150 Hz) | two clusters: music-led motion 52-87%, VO-led live action 14-22% | Pick the bed by format |
| Cuts on an onset | median 40%; tier A music pieces 61-83% | The >= 60% target stands for cut-driven pieces; with few cuts, motion hits carry the sync |
| Tempo (conf >= 0.5) | 60-108 BPM | Half-time feels of 120-180 BPM beds; hits every 1.5-1.7 s suit a 1.5-3 s beat cadence |
| VO rate | 87 (ad read), 145-163 (explainer), 176-188 (founder to camera) | Text-led A pieces use no VO |

- **Late drop** (proven: 2 tier A pieces, 6 in all). The opening runs on UI ticks and texture only and the beat lands on the turn line or product name, at 10-60% of the runtime (lexnlin 25%, kaif9998 58%); two pieces put a 0.5-1 s speech gap before it. Pack: `cuts/story/lateDrop`.
- **Silence before the sting** (A on saves): 1-3 s of near-silence after the lockup, then one sting (motionbyleo 3.0 s, fishaudio-2 ~3 s, kevin-t-ngo a 1 s dip). An end device, unlike the 200 ms smash gag. Pack: `cuts/story/preStingSilence`.
- **Sustained sub under the end card** (lexnlin, motionbyflox): the logo sits on a held low note, not a hit.

**Climax and end:**
- The result arriving still holds. New: **the product used in the world** (A), a mosaic of everything then quiet (A), a visible self-check (A), one word changes (B). Self-referential climaxes ("this film is the tool") have not travelled: use them as a tag.
- End: an install command typed on the end card (developer CTA), a date teaser, an "A x B" partner lockup, a pull-back so the end card plays on a screen in a room. Comment-gated offers drive replies, not purchases (B): use only with a real offer and an honest label.

**Ranked, proven to craft-only:** (1) late drop on the turn line; (2) accelerando montage into a mosaic; (3) continuous no-cut film; (4) visible agent pipeline; (5) brand-system tour with a silent pre-sting; (6) founder live demo + overlays (boosted-looking); (7) live transcript with latency badges (B); (8) mesh gradients, accent-word swaps, pill counters, selection-box hooks (craft-only); (9) 2D mascot, pull-back into a TV, sketch -> render (craft-only).

**For ANVE:** use the late drop on the turn line, an agent pipeline reveal built from the box's real call log, and live transcripts with **measured** per-turn latency (P50 487 ms). A voice-handoff gag (`cuts/story/voiceHandoff`) needs a consented voice and the "(AI voice)" label on every synthetic frame. Avoid clipping, boosted-reach envy, comment gates without a real offer, and self-referential climaxes as the payoff.

## 9. Rounds 4–5 (29 references, 14 Oct 2026)

Per-piece studies, source links and tiers: `docs/research/reference-round45-2026-10.md`. Graded with `tools/refstudy.py grade` (`reference-intake.md`); the rules reproduce the hand grades.

**Evidence tiers for this batch:** A 11 (2 claim-driven: provocative post text, like rate under 0.4%), **A− 2** (saves-strong: ≥ 1.3% bookmarks with less reach), B 4 (boosted: one at 4,018× its followers), B′ 1, **R 4** (account-size reach: millions of views below 1× followers; it proves the account, not the format), C 7. Four of the five best-saved pieces are proof-led.

**Hooks (what is new):**
- Pain as a typed reaction inside the work surface; a prompt slam (one word per 0.5 s, full-bleed, the background flipping per word); a crude first attempt with a live readout; the concept as a space before the product; five faces in five seconds; outline glyphs drawing on (all tier A).
- **A small product-name super over moving footage inside 2 s is common and is not a logo bumper.** None of the 29 opened on a static logo.
- **Sound often enters after the picture:** 13 of 28 open at least 6 dB under the body for 1–2 s while frame 0 moves. Plan it (`plan.audio.quiet`, kind `open`); `ears` then reads it as intended.

**New storyboard shapes** (continuing round 3's E–H):

| shape | what | evidence |
|---|---|---|
| **I. Proof film** | claim (≤ 6 words) → name → method card → **one chart or diagram that builds** → head-to-head rows → numbers with sources → three stat cards → URL; usually 0–4 cuts | tier A on reach and saves; the best-saved shape. Launch archetype **L8** |
| **J. Query ladder** | one UI, five escalating inputs, one VO line each (99 wpm), pull back with benefit chips, the repo | tier A, 1.66% saves. L4's strongest form |
| **K. Fidelity ladder** | crude → resolved, one parameter step per bar with a live readout, a 2–3 s dropout, a new dimension | tier A. L4's other strong form |
| **L. Multi-voice documentary** | 5 faces in 5 s → the lead's thesis → voices with a name super plus one personal detail → flat 2D inserts → customer proof → availability; 107–185 s | three tier-A pieces over 100 s. Launch archetype **L9** |
| **M. Trailer arc** | quiet dialogue → title cards → build → a wall montage → **one line over near-silence (2–4 s)** → crescendo → title, hard stop | R and A (valley and build). `music/bed_trailer_arc` |
| **N. Rapid-command demo** | ~16 spoken commands in 17 s, each answered by the UI on the next frame | A, claim-driven |
| **O. Bundle construction** | outline tiles draw on → cascade → fill on hits → collapse into one name, in 10 s, 0 cuts | A, 5.4M views |

**Motion vocabulary (tier-A craft):** a cost-vs-score scatter with a frontier line and a starred, sourced hero point; a branch diagram where a wrong fork turns red and the red propagates downstream; a data table that builds under a one-line finding; an embedding cloud whose nearest neighbours lift towards a query; a live math readout; electric hand-drawn numerals as chapter marks; a running cost ticker pinned beside a hand; transcript bubbles anchored in the scene. Craft-only: flanking words, a sentence continued across cuts, a style ladder on one composition, a practical cable-tangle metaphor then an abstract untangle diagram (`blender/cableTangle`).

**Sound, measured (28 with audio):**

| measure | this batch | take |
|---|---|---|
| Integrated loudness | −24.8 to −9.6 LUFS, median −15.1; VO-led about −18, music-led about −14.2; 8 of 28 peak at or above 0 dBFS | keep −14 LUFS-I / ≤ −1 dBTP; copy neither the quiet VO films nor the clipping |
| **Bass share by role** (< 150 Hz) | median 33%. Proof and explainer beds 20–36%; hype and trailer 50–61%; VO documentaries 15–34% | pick the bed by role; round 3's 52–87% was the hype case, not a default (`ears/listen.py --role`) |
| Cuts on an onset (≥ 10 cuts) | 24–73%, median 47.5% | **did not predict reach**: the 73% pieces are tier C, tier-A VO films sit at 40–59%. The ≥ 60% rule applies to music-led, cut-driven pieces only (`critic.md`) |
| Cuts under a voice | 61–89% of cuts in VO documentaries fall inside a speech line | the voice is the continuity: judge VO films by speech continuity, not cut sync |
| Continuous pieces | 7 of 29 have ≤ 4 cuts; 5 of those 7 are tier A or A− | score them by **motion events on onsets** (`refstudy` `motion.sync`, read against its `chance_share`; tested on synthetic clips and local films; not yet measured on these references) |
| VO rate | 99 (one line per rung) · 158–177 (explainer) · 184–193 (founders) | the tier-A explainer is the sparsest VO: a 0.3–0.5 s gap every ~4 s, and the diagram advances in it |

**Sound shapes:**
- **Quiet open:** 13 of 28 (above).
- **Mid-film reset dip:** 1–3 s at −39 to −52 dBFS before a reveal or a build; a trailer holds one line over about −55 dBFS for 2–4 s before the crescendo.
- **Quiet ending:** 17 of 28 end at least 10 dB under the body; explainers hold the end card on near-silence for 4–9 s. **Quiet hold is a first-class end shape** alongside the sustained sub and the pre-sting silence (`launch-playbook.md` rule 15). The last 0.15 s is still digital zero.

**Climax:** the strongest honest climax for an AI product is **a failure the method catches** (red propagating down a diagram). Also: the hero point on the frontier, the hardest rung last, a new dimension after a dropout, many marks merging into one name.

**CTA and end:** a URL or repo on the end card is the tier-A norm for builder audiences, with **no spoken CTA** in any tier-A explainer; benefit chips can replace the CTA; a partner lockup held on a quiet tail; a silent end-card hold of 4–9 s. **Offers with deadlines and discount framing showed no organic evidence** (tier C or boosted only; see section 6).

**Pacing:** the median shot is about 2.8 s; four speeds (montage 0.46–0.87 s, product 1.1–2 s, documentary 3–4.4 s, continuous). Tier A is bimodal in length: 10–60 s craft and proof pieces, 107–185 s people-led documentaries, nothing between 60 and 100 s.

**Ranked, proven to craft-only:** (1) proof film; (2) query ladder; (3) fidelity ladder with a dropout; (4) multi-voice documentary; (5) bundle construction in 10 s; (6) rapid-command demo (claim-driven); (7) prompt slam; (8) in-scene transcript bubbles; (9) craft-only: flanking words, sentence across cuts, style ladder, electric numerals, the trailer arc (R).

**For ANVE:** a proof film with **measured** numbers only (no box benchmarks exist yet: measure first, never borrow AnveVoice's); a query ladder over the box's own data ending on "runs on your box · no cloud"; in-scene transcript bubbles and a rapid-command demo recorded for real; the trust gate stopping a wrong action as the failure-caught climax; quiet holds on end cards. A multi-voice documentary waits for real pilot customers. Avoid boosted-reach envy, clipping, unsourced price comparisons and deadline offers as the hook.
