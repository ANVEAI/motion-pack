# What makes these launch and motion films work: hooks, sound, motion, storyboard, climax, CTA

These patterns come from the founder's 10 shared references (13–14 Oct 2026) plus the 15-launch study in `docs/research/launch-films-2026.md`.

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
| Cuts on a sound onset | 45–80% (Pinterest 80%, Customer.io 75%, Animala 75%, Base44 53%, Clueso 45%) | **Cut on hits.** Target ≥ 60% of cuts within 2 frames of an onset (`cuts/cutgen.py snap`) |
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

## 7. For ANVE, specifically

- **Pre-launch hype:** the sentence-led film (pattern A) with honest labels, and the mockumentary (pattern B) for the Munshi-ji universe. Clueso shows that office-pain comedy plus a documentary parody travels.
- **Agent-at-work UI** is the strongest honest motion for an AI box: real steps from the product's own call log.
- **Avoid:** clipping, 1.5 s black opens, fake UI, invented proof numbers.
