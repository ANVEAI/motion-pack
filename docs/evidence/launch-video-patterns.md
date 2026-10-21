# Launch-video patterns: what very high-view videos and formats do, turned into rules the pack can check

Research for the motion-pack expansion round, 16 Oct 2026 (lane 5). The founder asked the pack to "learn from youtube, launch videos etc, which has attracted millions of views". This file is the evidence. The machine-usable result is in `patterns/` (`structures.json`, `hooks.json`, `ctas.json`, `lengths.json`), and `tools/structure_check.py` scores a template's `out/plan.json` against it.

**How this was made.** Six research passes on 16 Oct 2026 read published analyses, platform help pages, academic papers, trade press and practitioner breakdowns:
1. SaaS, AI and founder launches;
2. hardware reveals, trailers, teasers and title sequences;
3. Shorts, Reels and TikTok retention, plus podcast clips;
4. tutorials, explainers, vlogs and story structure;
5. pacing, reading speed, music and platform specs;
6. commercial template packs (for `pack-gap-analysis.md`).

No video was downloaded or watched for this file. A view count appears only where a page displayed it, with that page named and the date it was read. Every number below was read in the cited source; where only a search-engine summary of a page could be read (the page blocked us), the row says "(summary)". Access date for every URL: **2026-10-16**.

**Honesty rules for this file.** Named videos, brands and people appear here and nowhere else in the pack (`tools/check_names.py`). A named film is an example of a pattern, never proof that the pattern caused its reach: reach depends on distribution, audience size and paid promotion, which none of these sources controls for. Practitioner "breakdowns" are mostly written by studios and tool vendors that sell launch videos; their view counts and results are self-reported.

## Grades

| grade | meaning |
|---|---|
| **platform** | published by the platform itself (help pages, ad specs, guides, or studies the platform publishes and commissions; commissioned studies are flagged) |
| **study** | a measured study: academic, or a corpus with a stated method |
| **practitioner** | editors, creators, agencies, vendors, trade press: belief from practice, not measured |
| **inference** | our synthesis of the sources; every beat percentage in `structures.json` that no source measured is graded this way or practitioner |

**The single most important caveat:** no source measures beat timings as a percentage of runtime for any of these genres. Platforms publish windows (the first 3 s, 6 s, 30 s; the last 5-20 s), studies publish length and pace distributions, and practitioners publish beat orders. The percentages in `structures.json` convert those into numbers a linter can check. They are tunable defaults, and the pack's own analytics outrank them.

<a id="top-findings"></a>
## 1. The fifteen findings the templates and skills should apply

| # | finding | apply it as | grade | source |
|---|---|---|---|---|
| 1 | The value or proposition belongs in the first 3 s, the hook in the first 6 s; TikTok's own analysis says 90% of ad-recall impact is captured within 6 s | hook section ends by 6 s on ads; `hooks.json` `universal.value_by_s: 3`, `hook_window_s: 6` | platform (TikTok-commissioned) | [TikTok Ads Help](https://ads.tiktok.com/help/article/creative-best-practices); [Creative Codes PDF](https://ads.tiktok.com/business/library/Creative_Codes_ENG.pdf) |
| 2 | Brand effects start inside the first seconds: Nielsen for Facebook found recall lift among people who watched 3 s or less, starting under 1 s; Kantar (Feb 2026) found brand cues in the first 2 s let Instagram match TV-level recall | brand cue inside the action by 2-5 s, never a logo card first (`brand_by_s`) | study (platform-commissioned) | [Marketing Dive](https://www.marketingdive.com/news/brand-lift-happens-in-less-than-1-second-of-video-study-finds/377333/) (summary); [Kantar](https://www.kantar.com/north-america/company-news/kantar-super-bowl-ad-study-15-second-ads-match-30-second-spots) |
| 3 | But early branding has a cost: Google's analysis of skippable ads found a brand in the first 5 s raised recall and also raised skipping; brand "pulsing" (short repeated exposures) reduced zapping against one block of equal total time | brand as a diegetic cue (the product in hand, the UI) and repeated briefly, not one big logo | platform; study | [Think with Google](https://business.google.com/in/think/marketing-strategies/creating-youtube-ads-that-break-through-in-a-skippable-world/); [Teixeira, Wedel & Pieters 2010](https://ideas.repec.org/a/inm/ormksc/v29y2010i5p783-804.html) (summary) |
| 4 | YouTube names one retention checkpoint: the "Intro" key moment is the share still watching at 30 s, and it reads as whether the opening matched the title and thumbnail | the first 30 s (or first 10-15% of a short film) pays off the cover's promise; design cover + title + opening as one unit | platform | [YouTube Help 9314415](https://support.google.com/youtube/answer/9314415) |
| 5 | Surprise level holds attention and the *velocity* of joy holds viewers (zapping + face tracking, 28 ads) | escalate payoffs (each beat a bigger win), put a surprise at the open, avoid a flat middle | study | [Teixeira, Wedel & Pieters 2012](https://research.tilburguniversity.edu/en/publications/emotion-induced-engagement-in-internet-video-ads/) (summary) |
| 6 | Pace has a measured shape, not just a mean: contemporary films start with long shots, shorten through the setup, cut fastest in the climax and lengthen in the epilogue; mean shot length fell from 10.5 s (1930-55) to 7.0 s (1960-85) to 4.3 s (1990-2015) | per-section ASL in `structures.json` (fast in montage, held on the reveal and the end card), not one global rate | study | [Cutting 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5256470/) |
| 7 | TV commercial shots averaged under 2 s by 1991; AI-made social ads in a 2026 preprint averaged about 1.2 s per shot | ad ASL band 0.8-2.2 s | study | [WARC record](https://www.warc.com/Content/421e1376-baa5-472f-aa9d-adc58bea5146) (summary); [arXiv 2608.24329](https://arxiv.org/pdf/2608.24329) (summary) |
| 8 | On-screen text: Netflix caps adult subtitles at 20 characters per second (17 for children), 42 characters a line, 2 lines, each event on screen 5/6 s to 7 s; BBC guidance (via a mirror) is 160-180 wpm and about 0.3 s per word | text ceiling 17 cps for a phone audience; floor max(0.83 s, 0.3 s x words) (`structures.json` `text`) | platform; practitioner | [Netflix style guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide); [Netflix general requirements](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements); [BBC mirror](https://clevercast.com/bbc-subtitling-guidelines) |
| 9 | On-screen text that duplicates narration hurts learning (16 of 16 tests, median d = 0.86); signalling helps (24 of 28, d = 0.41) | explainers and tutorials use keyword callouts and chapter cards, not sentences that repeat the VO (accessibility captions are separate) | study | [Mayer, Cambridge Handbook 2nd ed.](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/C98AB3A6CE760DD63C048936EA0B3B44) |
| 10 | Lessons: median engagement topped out at about 6 min whatever the length (6.9M edX sessions); tutorials are re-watched and skimmed, so they need signposts; drawing-style tutorials engaged 1.5-2x more than slides or screencasts | tutorial chunks under 6 min, a chapter card per step, continuous visual motion (a cursor, a drawing) | study | [Guo, Kim & Rubin 2014](https://pg.ucsd.edu/publications/edX-MOOC-video-production-and-engagement_LAS-2014.pdf) |
| 11 | Trailers: the shape editors and trailer-music houses describe is cold open, act 1 setup, act 2 escalation, act 3 climax, title card, button; music is chosen first and dropped out for jokes and reveals; the corpus mean trailer is 122.8 s | `trailer` beat sheet, a planned gap before the title (`plan.audio.quiet` kind gap), a date card last | practitioner; study | [Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/); [Rare Form Audio](https://www.rareformaudio.com/blog/how-production-music-reveals-trailer-structure); [Stephen Follows](https://stephenfollows.com/p/have-movie-trailers-always-been-this-long) |
| 12 | SaaS and AI launches: practitioners converge on a hook in 3-7 s, the real product on screen by about 10 s, one workflow rather than a feature tour, at most one proof, one CTA; big-brand AI release films in one teardown cluster at 1:00-1:30, often with no problem beat and no voiceover | `saas-launch` and `saas-feature-drop` beat sheets; real UI by 15-25% of runtime | practitioner | [Hound Studio teardown](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas) |
| 13 | AI demos carry a credibility risk: a widely covered 2023 model demo was later acknowledged to have been assembled from still frames and text prompts with shortened outputs; live demos were treated as the strongest evidence in community discussion of a 2024 launch | any sped-up or assembled demo says so in frame ("time-lapse: 12 min shown in 20 s"; "real time, unedited") | practitioner (press) | [Engadget](https://www.engadget.com/google-admits-that-a-gemini-ai-demo-video-was-staged-055718855.html); [HN thread](https://news.ycombinator.com/item?id=40346213) |
| 14 | Founder videos invert the hype cut: practitioners describe the founder on camera with no music and few or no cuts for the first 12-20 s, one sharp sentence, a concrete origin, product footage only where it saves a sentence, the smallest possible ask | `founder-story`: music 0 and ASL 3-12 s in the hook, the ask in the last 8-12% | practitioner | [Flowjam founder-led](https://www.flowjam.com/blog/founder-led-launch-video) |
| 15 | CTAs: YouTube end screens sit in the last 5-20 s of a video at least 25 s long (up to 4 elements); Wistia advises the CTA at the end of videos under 5 min; Meta's Reels safe zone keeps text out of the bottom 35% (the native button lives there) | `ctas.json`; `structure_check` checks the CTA window and the end-card hold | platform | [YouTube end screens](https://support.google.com/youtube/answer/6388789); [Wistia 2024](https://wistia.com/learn/marketing/insights-state-of-video-report); [Meta Reels spec](https://www.facebook.com/business/ads-guide/update/video/instagram-reels) |

Two more that every lane should know, because they change how "millions of views" should be read:
- **A view is now a start.** YouTube counts a Shorts view on every start or replay with no minimum watch time since 31 Mar 2025, keeps "engaged views" for monetisation, and its help page says the start-of-playback rule covers all formats from 24 Aug 2026 [platform: [YouTube Help 2991785](https://support.google.com/youtube/answer/2991785)]. Instagram reportedly counts every Reel start or replay [practitioner: [IZEA](https://izea.com/resources/instagram-views-metrics-changes/)]. A headline view count measures starts, not watching: judge a hook by the 3 s hold rate and average view duration, not by views.
- **Length did not separate hits from misses** in the one sample we could count. A public gallery of launch videos posted on X ([startuplaunchvideos.com](https://www.startuplaunchvideos.com/), read 2026-10-16) listed 53 entries with displayed runtimes and view counts; the median runtime was 72 s (interquartile 48.5-104 s), and the 19 entries showing 1M+ views had a median of 78 s against 71.5 s for the rest [inference, our count; the page is a truncated, non-random list]. Distribution, not runtime, is the likelier driver.

<a id="hooks"></a>
## 2. Hooks (the first 0-6 s), across categories

**What platforms publish:**
- TikTok: introduce the proposition in the first 3 s, prioritise the hook in the first 6 s, use suspense, surprise or emotion; branding early but subtle so it does not weaken the hook; text overlays; sound on; people on screen; a lo-fi native look [platform: [TikTok Ads Help](https://ads.tiktok.com/help/article/creative-best-practices); [Creative Codes PDF](https://ads.tiktok.com/business/library/Creative_Codes_ENG.pdf), which credits suspense with +16% watch time and surprise with 1.7x view-through rate in a TikTok-commissioned study].
- Google ABCD: "start big" (mid-action or a close-up, bright high-contrast imagery, audio), brand early, often and richly; ads following ABCD averaged +30% short-term sales likelihood and +17% long-term brand contribution in a Google/Kantar analysis [platform: [Think with Google](https://business.google.com/us/think/future-of-marketing/youtube-video-ad-creative/)].
- Google's earlier skippable-ad analysis: smiling characters and recognisable faces in the first 5 s helped brand metrics and viewing; calming or action music in the first 5 s was skipped more; "any music in the first five seconds may have a negative impact" on awareness [platform: [Think with Google](https://business.google.com/in/think/marketing-strategies/creating-youtube-ads-that-break-through-in-a-skippable-world/); no effect sizes published].
- Meta (c. 2016): feed video autoplays muted, so put the message up front and make it work without sound [platform, summary: [Social Media Today](https://www.socialmediatoday.com/news/facebook-releases-new-guide-to-help-advertisers-maximize-video-ad-performan/450818)].

**What studies measured:** see findings 2, 3 and 5. A Facebook/MetrixLab study of 759 ads reported TV-style narratives recalled worst and early, strong brand presence correlated with aided recall, while longer view time did not reliably mean more recall [study, summary: [Social Media Today](https://www.socialmediatoday.com/news/facebooks-published-a-new-study-which-highlights-effective-mobile-video-te/512753)]. A frequently repeated "47% of campaign value in the first 3 s" is a misreading of the Nielsen-for-Facebook study, which measured lift among short viewers, not a share of value.

**What practitioners add (per category):**

| category | hook archetypes reported | grade |
|---|---|---|
| SaaS / AI launch | dream outcome, before/after in one shot, persona call-out, problem + dream outcome, social proof, kinetic-text hook, challenge hook, problem skit; "no hook" (straight to the solution) only for warm audiences; write 3-4 hooks per body | practitioner ([Hound Studio](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas)) |
| AI product | a live or one-take demo ("watch it do X"), a typed prompt, a compressed agent run with a progress bar | practitioner ([Hound Studio](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas); [Advids roundup](https://advids.co/blog/30-AI-Launch-Video-Examples-To-Drive-Market-Impact), summary) |
| founder launch | a confessional line, a repositioning line, a credibility line, delivered to camera | practitioner ([Flowjam](https://www.flowjam.com/blog/founder-led-launch-video)) |
| trailer / teaser | the cold open: an out-of-context moment (surprising, action-packed or funny); on social, a title card before 5 s and a cut that works on mute | practitioner ([Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/)) |
| hardware | the hero close-up ("the frame a viewer would screenshot"); a hint by macro, silhouette or a brief flash before the full reveal | practitioner, low weight ([Moonb](https://www.moonb.io/blog/product-launch-video); [Manfrotto](https://www.manfrotto.com/global-uk/stories/how-to-shoot-cinematic-tech-videos-like-apple/), summary) |
| tutorial / explainer | show the end result, then "here's what we'll build"; a question that opens a loop | practitioner ([Summify on Ali Abdaal](https://summify.io/discover/how-to-easily-script-youtube-videos-to-get-more-views-2rzzRxixzq4/); [Creator Essentials](https://www.creatoressentials.com/glossary/open-loop/)) |
| vlog / personal | a cold open at the key moment, then back to the start; the first minute confirms the thumbnail's promise | practitioner ([In Depth Cine on Casey Neistat](https://indepthcine.com/videos/casey-neistat); [Simon Willison quoting the leaked MrBeast production document](https://simonwillison.net/2024/Sep/15/how-to-succeed-in-mrbeast-production/), authenticity only partly confirmed) |
| podcast clip | the most provocative or quotable line first, captions word by word | practitioner ([OpusClip guide](https://www.opus.pro/blog/podcast-to-shorts-api), summary) |

**Frame-0 requirements** (in `hooks.json` per archetype, on top of the pack rule in `skills/motion-pack/references/virality.md` §1): an image already in motion, a face or the product early where the format allows, hook text up by 0.3 s when the hook uses text, the brand inside the action rather than on a card, and the first sound on frames 0-3 or a planned quiet open. These follow from the platform guidance above [inference from platform].

<a id="pace"></a>
## 3. Pace: average shot length and the cut-rate curve

| evidence | figure | grade | source |
|---|---|---|---|
| Popular films, 210 titles | mean shot 10.5 s (1930-55), 7.0 s (1960-85), 4.3 s (1990-2015) | study | [Cutting 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5256470/) |
| Within-film shape (contemporary) | long prologue shots, a negative-exponential shortening through the setup, the shortest shots in the climax, longer again in the epilogue | study | same |
| Neighbouring shots | shot lengths became more correlated with their neighbours, approaching a 1/f spectrum; this is independent of the mean | study | [Cutting, DeLong & Nothelfer 2010](https://journals.sagepub.com/doi/10.1177/0956797610361679) (summary) |
| Shot-length distribution | log-normal, positively skewed, mode near 2 s (two films analysed) | study | [LMU epub](https://epub.ub.uni-muenchen.de/74376/1/pchj.384.pdf) (summary) |
| Genre ASL (features) | action 4 s, adventure 5.1 s, sci-fi 6.2 s, horror 15.7 s | study (data journalism) | [Stephen Follows](https://stephenfollows.com/many-shots-average-movie/) (summary) |
| Individual films (Cutting's reply on Cinemetrics) | a 1995 action film 3.6 s; a 2008 action film 1.71 s | study | [Cinemetrics](https://cinemetrics.uchicago.edu/article/590235ff-85aa-4714-9553-71d4c44fd61c) |
| Trailers, 130 titles 1951-2015 | ASL falling and its variance shrinking over 60 years; shorter shots carry more motion (no seconds readable: the full text was blocked) | study | [Feng 2016, Temple](https://scholarshare.temple.edu/items/0ab4cb95-3dcb-4405-b404-296c897d6ab3) (summary) |
| Trailer editors | shots "mostly last one or two seconds", some under 1 s | practitioner | [Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/); [Film Supply](https://wpengine.fm.co/filmsupply/how-to-cut-the-perfect-film-trailer/) |
| TV commercials | average shot under 2 s by 1991, about half the early-1980s length | study | [WARC](https://www.warc.com/Content/421e1376-baa5-472f-aa9d-adc58bea5146) (summary) |
| AI-made social ads (2026 preprint) | 17.9 s long, 15.2 shots, 1.2 s per shot on average | study | [arXiv 2608.24329](https://arxiv.org/pdf/2608.24329) (summary) |
| Edits and arousal | more edits within a scene raised arousal and memory without overload in the tested range; the limited-capacity model predicts overload past some rate, but no source gives the threshold | study | [Lang et al. 2000](https://scholars.cityu.edu.hk/en/publications/the-effects-of-edits-on-arousal-attention-and-memory-for-televisi/) (summary) |
| Founder videos | "almost no cuts in the first 30 s" in one cited founder film; over-cutting "reads as nervous" | practitioner | [Flowjam](https://www.flowjam.com/blog/founder-led-launch-video) |

**Curves by category** (inference from the rows above, encoded as per-section `asl_s` in `structures.json`):
- **ad / hype:** fastest at the open (three visual states in 3 s), a held hero reveal (1.2-3.5 s), a slower end card.
- **trailer:** act 1 at 2-4 s per shot, act 2 at 1-2 s, act 3 at 0.4-1.2 s, then a held title. This mirrors Cutting's climax shape.
- **founder:** the slowest open (a single take of 12-30 s), faster in the B-roll and demo.
- **feature drop:** mostly continuous screen capture with motion-graphics zooms, not hard cuts. Here the change interval matters more than ASL: the pack's house rule is something visible changes at least every 3.5 s.
- **tutorial / explainer:** 3-10 s per shot under a voice, with the change carried by the cursor or the drawing.

There is no measured "too fast" ceiling; a shot under about 0.5 s outside a montage is a heuristic warning, not a rule.

<a id="text"></a>
## 4. On-screen text density

| rule | value | grade | source |
|---|---|---|---|
| reading speed, adult subtitles | 20 characters per second | platform | [Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) |
| reading speed, children (our phone-audience default) | 17 cps | platform | same |
| line length / lines | 42 characters, 2 lines | platform | same |
| event duration | at least 5/6 s, at most 7 s | platform | [Netflix general requirements](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements) |
| words | 160-180 wpm; about 0.3 s per word minimum | practitioner (BBC via a mirror) | [Clevercast](https://clevercast.com/bbc-subtitling-guidelines) |
| ad text overlays | TikTok recommends 5-10 words per second "when using text" | platform | [TikTok Ads Help](https://ads.tiktok.com/help/article/creative-best-practices) |
| Reels safe zone | text out of the top 14%, bottom 35%, 6% each side | platform | [Meta Reels spec](https://www.facebook.com/business/ads-guide/update/video/instagram-reels) |
| captions and view time | captions raised view time by 12% on average in Facebook's internal tests (c. 2016) | platform, summary | [Business Insider](https://www.businessinsider.in/Facebook-wants-advertisers-to-get-a-lot-better-at-silent-video/articleshow/50936233.cms) |
| redundancy | narration + identical on-screen text hurts learning | study | [Mayer 2014](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/C98AB3A6CE760DD63C048936EA0B3B44) |

TikTok's 5-10 words per second is far faster than any subtitle standard; it describes short overlay bursts in ads, not readable sentences. The pack follows the reading standards: 17 cps and about 3 words/s for a read line (2-2.5 on a reveal or end card, where the line must land), and checks the floor max(0.83 s, 0.3 s x words) [inference from platform]. No published standard exists for kinetic or word-by-word type, so the ceiling applies to the whole string over its whole hold.

<a id="sound"></a>
## 5. Music shape and sound design

| finding | grade | source |
|---|---|---|
| Trailer music runs in three acts: sparse or ambient setup, rhythms and rising tension, then percussion, melody and big hits with energy peaking; library composers write lean builds and chop points so editors can recombine sections | practitioner | [Rare Form Audio](https://www.rareformaudio.com/blog/how-production-music-reveals-trailer-structure); [Sound On Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-7) (summary) |
| A trailer act 1 can be a ~30 s sound-design intro; "reverses and power downs" as sound design; a trend to rhythmic sound design and beds built from SFX | practitioner | [Scripps News interview with a trailer music director](https://www.scrippsnews.com/entertainment/movies/how-companies-pick-music-for-movie-trailers) |
| Title cards and cuts to black are paired with a cymbal riser, a slam or a whoosh; drop the music out for jokes and surprises, then bring it back changed | practitioner | [Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/) |
| The "braaam" (a loud low brass hit) became the blockbuster-trailer signature in the 2010s and signals "something important", often paired with impacts and fades to black; its origin is disputed | practitioner | [Wikipedia: BRAAAM](https://en.wikipedia.org/wiki/BRAAAM) |
| Reveal sound: the riser peaks on the exact reveal frame; "silence then impact"; dead air before a result kills momentum | practitioner (vendors) | [IRPR Sound](https://sounddesign.irpr.agency/styles/trailer-rise/) |
| Launch films without voiceover lean on sound design and ambient texture (several big-brand AI release films in one teardown) | practitioner | [Hound Studio](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas) |
| Founder videos: no music over the first sentence; dramatic music as a failure pattern | practitioner | [Flowjam](https://www.flowjam.com/blog/founder-led-launch-video) |
| Sound-on: 73% of TikTok users said they would "stop and look" at an ad with sound (TikTok/Kantar 2021, method not stated); YouTube is "almost entirely a sound-on experience" (Google) | platform (commissioned) | [Social Media Today](https://www.socialmediatoday.com/news/tiktok-shares-new-insights-into-the-importance-of-sound-for-marketing-promo/601569); [Think with Google](https://business.google.com/us/think/future-of-marketing/youtube-video-ad-creative/) |
| Music congruity with the ad (mood, genre) goes with better affect and recall; one thesis found slow tempo recalled better than fast and music presence reduced recall | study | [Oakes 2007 (WARC)](https://www.warc.com/content/article/jar/evaluating-empirical-research-into-music-in-advertising-a-congruity-perspective/en-gb/85557) (summary) |
| EDM convention: sections in multiples of 4 or 8 bars, an 8-bar build before a drop (producer blogs disagree); at 120 BPM an 8-bar build is 16 s, a whole 15 s ad | practitioner; inference | [SampleFocus](https://samplefocus.com/blog/edm-song-structure-an-essential-guide/) (summary) |
| Loudness: Spotify normalises to -14 LUFS and asks for <= -1 dBTP; EBU R128 is -23 LUFS / -1 dBTP; YouTube's -14 reference is reported by audio-tool makers only | platform; practitioner | [Spotify](https://support.spotify.com/us/artists/article/loudness-normalization/); [EBU R128](https://tech.ebu.ch/docs/r/r128.pdf) |

**Where the drop lands.** No source measures it. The pack's shapes put the hit on the reveal: about 25-35% of a hardware film, 30-45% of an ad, the act-3 peak and then the title hit of a trailer (after a planned gap), and the product name at 15-30% of a SaaS launch. A short ad uses a 2-4 bar build, never a full 8-bar one [inference]. `music` in `structures.json` is the intensity per section (0 = none, 1 = the densest moment), and `sfx_role` names the sound job of each section.

## 6. Per category

Each section lists the beat sheet that `structures.json` encodes. **% = share of runtime.**

<a id="saas-launch"></a>
### 6.1 SaaS product launches (`saas-launch`)

- **Structure (practitioner).** One studio's 60 s formula is hook, solution ("Meet X, the [category] for [audience]"), demo in real UI, features, CTA. Its block menu adds problem, dream outcome, use cases and social proof. Its rules: real product within about 10 s and "something new every few seconds" [practitioner: [Hound Studio](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas)]. A 90 s vendor template runs hook 0-10 s, context 10-25 s, the core workflow 25-60 s, proof 60-75 s, CTA 75-90 s [practitioner, summary: [Moonb](https://moonb.io/blog/demo-video-for-saas)].
- **Beat sheet (ours):** hook 0-10%, context 10-25% (optional), the name 15-30%, demo 25-70%, proof 65-85% (optional), end card 85-100% [inference from practitioner].
- **Named examples (as reported, not verified by us).** The same teardown reports beat orders and YouTube view counts "as of October 2026 per the article":
  - a Notion 3.0 agents film at 1:30 with no voiceover (intro, agent demo, use cases, outro; 15.8M);
  - Cursor 2.0 at 1:04 with no voiceover (9.5M);
  - Lovable 2.0 at 1:20 (a challenge hook, dream outcome, social proof, use-case demos, new features, CTA; 10.7M);
  - an ElevenLabs Studio film at 1:06 with "no hook" (65.9M);
  - a Google AI Studio film at 1:07 (a broad dream-outcome hook, a teaser, a timelapse demo, use cases, CTA; 174.8M).

  Some of these ran as paid ads, so the counts say nothing about craft alone.
- **ASL:** fast at the open, held on UI (2-6 s per demo shot), slower on proof (`asl_s` per section).
- **Text:** the story should work without narration, with on-screen labels carrying context [practitioner: [Screenhance](https://screenhance.com/blog/product-hunt-launch-video-guide)]. Script density about 130-150 words per minute of voiceover [practitioner: Hound Studio].
- **Music and sound:** music running from frame 0 or one hit; a riser over the context that ends on the name; UI sounds per action under the demo; a final hit on the end card [inference from practitioner].
- **CTA:** one CTA, not three. On a launch platform that bans vote requests, ask viewers to try the product or leave feedback [practitioner, summary].
- **Length:** launch or promo 30-60 s (about 45 s called the sweet spot) for social; a site demo 60-90 s; a milestone or funding video 60-120 s; cut-downs of 30, 15 and 6 s [practitioner: Hound Studio]. Platform data agrees completion falls with length: under 1 min, 66% complete (Vidyard 2022 data via [MarketingProfs](https://marketingprofs.com/charts/2023/49949/business-video-benchmarks-retention-rates-by-length), summary), and Wistia reports engagement roughly flat from 1 to 5 min [platform: [Wistia 2024](https://wistia.com/learn/marketing/insights-state-of-video-report)].
- **Cover:** YouTube says 90% of its best-performing videos use custom thumbnails, a correlation [platform: [YouTube Help 12340300](https://support.google.com/youtube/answer/12340300?hl=en)]. No launch-specific thumbnail data was found.
- **Retention:** "engagement peaks in the first 10% of the video, no matter its length" (Vidyard 2021 data via [MarketingCharts](https://www.marketingcharts.com/digital/video-225924)) → put the outcome shot inside the first 10%.

<a id="feature-drop"></a>
### 6.2 Feature drops (`saas-feature-drop`)

Single-feature announcements run intro, demo, (use cases), outro, often 20-70 s, often with no voiceover and ambient or sound-designed audio [practitioner: [Hound Studio](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas)]. Reported examples include a Linear for Agents film at 0:33 (intro, demo, outro, dark UI, ambient sound) and a 20 s studio example split 5 s hook, 10 s demo, 5 s outro (self-reported 97% average watch time). A Linear release reel runs 45-90 s with one job-to-be-done per reel, and Figma conference feature clips are cut to reach "here is the feature working" fast [practitioner: [Arcade](https://www.arcade.software/post/product-launch-video-examples)]. The rule of thumb: "If you just shipped a new feature, skip the story and show the UI" [practitioner, summary: [Vizard](https://vizard.ai/blog/how-to-make-a-launch-video-people-actually-want-to-watch)]. **Beat sheet:** intro 0-15%, demo 15-65%, use cases 60-85% (optional), outro 85-100%; a change at least every 3.5 s when the film is one continuous capture.

<a id="ai-launch"></a>
### 6.3 AI product launches (folded into `saas-launch` and `saas-feature-drop`; hook `live-demo`)

What AI launches do differently [practitioner and press]:
- **Proof of capability:** live or one-take demos.
- **Staff-presented livestreams:** one company ran a weekday series with a launch or demo each day [press: [The Decoder](https://the-decoder.com/openai-launches-12-days-of-openai-livestream-series-promises-big-news/)].
- **"Watch it do X" runs:** compressed agent runs, for example a long coding task shown as a filling progress bar [practitioner, summary: [Advids](https://advids.co/blog/30-AI-Launch-Video-Examples-To-Drive-Market-Impact)].
- **Capability montages:** no problem beat and no CTA, as in one big-brand model film [practitioner: Hound Studio].

The credibility lesson is finding 13. The pack's response:
- A compressed run says so in frame.
- A real-time run may say "real time".
- Never imply speed with an on-screen clock while the product works (story-script already freezes clocks).

Very short X launches (17-24 s) with millions of displayed views exist in the gallery cited above, so a single "watch it do X" clip is a viable format [inference].

<a id="hardware-reveal"></a>
### 6.4 Device and hardware keynote reveals (`hardware-reveal`)

Sourcing is the weakest of all nine categories: no studio or design-press breakdown of a keynote device film was found.

- **Structure [practitioner, low weight]:** hero reveal, then the details, then the product in context [summary: [Manfrotto](https://www.manfrotto.com/global-uk/stories/how-to-shoot-cinematic-tech-videos-like-apple/)].
- **Vendor-blog arcs:**
  - a reveal at about 3-10 s of a short cut, 2-3 feature call-outs held 2-3 s each;
  - an exploded render, then straight to a person using it (a 2023 headset);
  - a colour-coded mechanism that reads on mute (a 2024 floor cleaner) [practitioner: [Moonb](https://www.moonb.io/blog/product-launch-video)].
- **"One more thing":** keynote history dates the line to January 1998 and its first product reveal to July 1999. It is a false ending followed by the biggest news, so it maps to a structural button [practitioner: [VentureBeat](https://venturebeat.com/technology/11-memorable-one-more-thing-announcements-from-steve-jobs-infographic), summary].
- **The pack's own study:** `docs/research/launch-films-2026.md` measured hero sizzles at 42-57 s, with a +11.6 dB hit at 1 s in one and a 5 s dropout before a +20 dB reveal in another. It also records press criticism of a 2024 hardware spot that never showed the product doing its job.
- **Beat sheet [inference]:** dark open 0-6% (light already on an edge; never a black frame 0), macro tease 6-25%, hero reveal on the hit 25-35%, transform or exploded view 35-58% (optional), spec cards 55-80% (optional; one claim per card, 2-3 s holds on the beat), the product doing its job 78-90%, name and price or date 90-100%.
- **Cover:** the hero frame.
- **Sound:** a swell from frame 0, ticks per detail, silence then the hit on the reveal, mechanical foley on the explode, the music falling away under the end card [inference].

<a id="trailer"></a>
### 6.5 Movie trailers (`trailer`)

- **Structure [practitioner]:** cold open, act 1 (introduction), act 2 (escalation), act 3 (climax), the button. The button is one more beat after the end title [[Jonny Elwyn summarising Derek Lieu](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/)].
- **Contrast:** "lows don't look low unless there's a high" [[PC Gamer interview with Derek Lieu](https://pcgamer.com/the-art-of-making-effective-game-trailers), summary].
- **Cold opens vary widely:**
  - a 2019 teaser runs 2:25 with a 9 s cold open;
  - a 2019 action trailer runs 3:35 with a cold open of nearly 45 s;
  - one analysis counts stakes and a joke in about 17.5 s of a 2016 comedy trailer [practitioner: Jonny Elwyn].
- **Length:**
  - the corpus mean is 122.8 s across 6,926 trailers [study: [Stephen Follows](https://stephenfollows.com/p/have-movie-trailers-always-been-this-long)];
  - the trade press reports a voluntary 150 s cap with one or two exemptions a year [practitioner: [JoBlo](https://www.joblo.com/movie-news/theater-owners-propose-new-guidelines-limiting-the-length-and-spoiler-content-of-movie-trailers)];
  - Follows found no official MPA source for that cap.
- **Beat sheet [inference from practitioner]:**

  | beat | % of runtime |
  |---|---|
  | cold open | 0-10% |
  | act 1 | 10-30% |
  | act 2 | 30-65% |
  | act 3 | 65-88% |
  | silence or hard cut, then title | 88-94% |
  | button | 94-97% |
  | date card | 97-100% |

  The pack already has `cuts/story/trailerArc` and `music/bed_trailer_arc` with a planned sub-only gap before the title hit.
- **Text:** card types are logos, date cards, pedigree cards and copy cards. On social, a title card before 5 s and a cut that works on mute ("you have to make that trailer fully watchable, even on mute", Noam Kroll via Jonny Elwyn).
- **CTA:** a date card. A 2014 theatre-owner proposal wanted a release date mandatory on every trailer [practitioner: JoBlo].
- **Cover:** the act-3 peak image or the title [inference; no trailer-specific data found].

<a id="teaser"></a>
### 6.6 Teasers (`teaser`)

- **What a teaser does [practitioner, mixed-quality explainers]:** 15-60 s, the minimum footage, tone or character rather than plot, often one music track, a vague date ("Next Summer") [[thisvsthat](https://thisvsthat.io/teaser-vs-trailer), summary; [Film Supply](https://wpengine.fm.co/filmsupply/how-to-cut-the-perfect-film-trailer/)].
- **Exceptions:** some run past 2 min [practitioner: [Cultural Learnings](https://cultural-learnings.com/2014/11/23/trailer-teasers-and-teaser-trailers-the-internets-jurassic-world-problem/), summary].
- **For products:** a teaser released days earlier can carry the withholding, so the launch film opens directly on the product [practitioner: Moonb]. The pack's L5 teaser is 6-15 s, 1:1 or 9:16, the hero object and a premiere time.
- **Beat sheet [inference]:** hook 0-15%, single-cue build 15-70%, peak hit 70-80% (optional), title 80-92%, date 92-100%.

<a id="title-sequence"></a>
### 6.7 Title sequences (`title-sequence`)

Thin sourcing. Two styles recur:
- **minimal:** cards on black;
- **narrative:** credits over action [practitioner: [Videomaker](https://www.videomaker.com/article/c3/7737-edit-suite-fresh-ideas-for-titles), summary].

TV openings are anecdotally 25-30 s [practitioner, forum]. The main title usually lands at the end [practitioner, student analysis, low weight]. Art of the Title is the main archive (400+ sequences per an older Film Comment review), but no timing analysis was found there.

**Beat sheet [inference]:** motif 0-15%, credit cascade 15-80% (one credit per musical bar), build 80-90% (optional), main title on the final musical resolution 90-100%. The cut rate stays even and the climax is the title, not a montage.

<a id="shorts"></a>
### 6.8 Shorts, Reels and TikTok retention (`ad-15`, `ad-30`, and every 9:16 cut)

- **Platform guidance:** see section 2. On top of it:
  - TikTok's structure code is a hook (the first 6 s), a body, and a close with a strong CTA [platform: Creative Codes].
  - Its "stimulation" code lists fast scene changes, movement, text pop-ups and faster music as attention triggers, from a commissioned neuro study [platform, commissioned].
  - Testing advice is 3-5 creatives per ad group, differing a lot [platform: TikTok Ads Help].
- **Views:** see the note under section 1. A replay counts, so a seamless loop is worth views directly; the pack's loop designs are in `virality.md` §3.
- **Safe zones and lengths:** `lengths.json`, `ctas.json` and `skills/motion-pack/references/platforms.md`.
- **Beat sheet for ad-15 [inference from platform]:**

  | beat | % of runtime |
  |---|---|
  | hook | 0-17% (to 2.5 s) |
  | problem | 17-33% |
  | product reveal | 33-60% |
  | proof | 60-83% |
  | end card | 83-100% (the last 2.0-2.5 s) |

  For ad-30 the hook shrinks to 0-10% (3 s) with the proposition inside it, and the body runs to 85%.

  The house template `templates/ad` already follows this; `structure_check` scores it 94/100 (section 8).
- **Gaps:** no platform publishes an organic sweet-spot length, an ASL, a loop rule or cover conventions. The pack's 15-35 s for organic shorts is a house default.

<a id="tutorial"></a>
### 6.9 Tutorials (`tutorial`)

- **Guo et al. (finding 10) [study]:**
  - Video length was "by far the most significant indicator of engagement".
  - In 0-3 min videos, 75% of sessions lasted over three quarters of the video.
  - Viewers often got less than halfway through videos over 9 min.
  - Faster, enthusiastic speakers engaged more (48-254 wpm, mean 156).
  - Viewers watched 2-3 min of each tutorial on average and re-watched tutorials more than lectures. The paper recommends "visual signposts... such as big blocks of text to signify transitions".
- **YouTube [platform]:**
  - chapters need at least 3 timestamps starting at 00:00, each at least 10 s [[YouTube Help 9884579](https://support.google.com/youtube/answer/9884579)];
  - the 30 s intro moment;
  - end screens in the last 5-20 s.

  Wistia reports 3-5 min instructional videos averaging 74% engagement against 43% for all 3-5 min videos [platform: Wistia 2024].
- **Practitioner frame:** a script frame attributed to Ali Abdaal, via a third-party summary: hook (the promise, mirroring the title), intro (credibility in a line), value (the main points), end-screen pitch.
- **Beat sheet [inference]:** result shown 0-5%, promise 4-10% (optional), steps 8-88% (a chapter card per step, each at least 10 s, chunks under 6 min), recap 85-94% (optional), end screen 94-100% (5-20 s of low-information footage).
- **Text:** keyword callouts and step cards, not sentences that repeat the voice (finding 9).

<a id="explainer"></a>
### 6.10 Explainers (`explainer`)

- **Structure [practitioner]:** story-script's grammar is question, wrong model, right model, proof, so-what.
- **Re-hook:** the leaked production document reportedly places "particularly interesting content" around minutes 3 and 6 of long videos to re-engage viewers [practitioner, authenticity partly confirmed: [Gigazine](https://gigazine.net/gsc_news/en/20240917-mrbeast-youtube-production)]. In a short explainer the equivalent is a complication ("but...") around 40-50% [inference].
- **Anchor:** Johnny Harris's reported principle is a visible anchor (a place, a journey, a person) that makes an abstract idea concrete [practitioner: [DocumentaryTube](https://www.documentarytube.com/blog/johnny-harris-vs-vox-how-their-documentary-styles-differ/)].
- **Signalling and redundancy:** finding 9.
- **Beat sheet [inference]:** question 0-10%, wrong model 10-30%, reframe 30-65%, proof 65-85%, so-what 85-100%.

<a id="vlog"></a>
### 6.11 Personal and vlog storytelling (`vlog`)

- **Structure [practitioner]:** analysts describe one prominent daily vlogger's pieces as:
  - a cold open, a hint of what's coming, the context, the delivery, a wrap-up, with mini-arcs inside;
  - predictable details cut, often mid-sentence;
  - titles for locations [[In Depth Cine](https://indepthcine.com/videos/casey-neistat)].
- **Story rules [practitioner]:**
  - Beats join with "but" or "therefore", never "and then" (Parker and Stone at NYU, date disputed) [[The Hustle](https://thehustle.co/storytelling-secrets-netted-matt-stone-trey-parker-600-million)].
  - Harmon's eight-step circle: you, need, go, search, find, take, return, change [secondary sources].
- **Measured arcs [study]:** six emotional arcs from 1,327 books; "Icarus", "Oedipus" and a double "man in a hole" were the most downloaded [[Reagan et al. 2016](https://arxiv.org/abs/1606.07772)]. That is books, not video.
- **The leaked document [practitioner, authenticity partly confirmed]:**
  - the first minute must show the thumbnail's promise will be met;
  - a "wow" moment arrives about 30 s in;
  - losing 21M of 60M initial clickers in the first minute is described as reasonably good.

  As our arithmetic, that is 65% still watching at 1:00, for one mega-channel only.
- **Beat sheet [inference]:**

  | beat | % of runtime |
  |---|---|
  | cold open at the key moment | 0-8% |
  | setup and want | 8-25% |
  | journey with re-hooks | 25-60% |
  | the cost (Harmon's "take") | 60-78% |
  | the change | 78-95% |
  | sign-off / end screen | 95-100% |

<a id="founder-story"></a>
### 6.12 Founder launch videos (`founder-story`)

- **Structure [practitioner]:** one guide describes:
  - the founder on camera for the first 0-12 s with "no music, no cuts";
  - the sharpest sentence inside 15 s;
  - the origin sentence;
  - B-roll only where it compresses a sentence;
  - the smallest possible CTA;
  - 60-90 s for X and LinkedIn [[Flowjam](https://www.flowjam.com/blog/founder-led-launch-video)].
- **A 60 s skeleton** from guide summaries: hook 5 s, personal why 10-15 s, problem 15-20 s, demo 15-20 s, proof 5-10 s, ask 5-10 s [practitioner, summary: [Vizard](https://vizard.ai/blog/how-to-make-a-launch-video-people-actually-want-to-watch); [Descript](https://www.descript.com/blog/article/product-launch-videos)].
- **Sector heuristic:** trust-heavy sectors lean founder-led, developer tools go straight to the demo [practitioner, summary].
- **Named examples [practitioner, metrics unsourced by the guide]:**
  - a 78 s repositioning film with no music for its first 12 s;
  - a 95 s payments-infrastructure film with almost no cuts in its first 30 s;
  - the canonical 2012 razor-subscription walk-and-talk, which Wikipedia says drew 12,000 orders in its first 48 h [[Wikipedia](https://en.wikipedia.org/wiki/Dollar_Shave_Club)].
- **The pack's own L1 beat sheet:** hook 0-4%, intro 4-12%, thesis 12-33%, reveal ~30-37%, demos 33-87%, vision and end card 87-100% (`launch-playbook.md`).
- **Beat sheet [inference, a blend]:** hook 0-8% (no music), why 8-30%, problem 25-40% (optional), demo 35-82%, proof 75-90% (optional), ask 88-100%.

<a id="podcast-clip"></a>
### 6.13 Podcast clips (`podcast-clip`)

- **No platform guidance found.** Clip tools score candidate windows of about 25-60 s on emotional intensity, completeness, hook strength and audio dynamics [practitioner: [OpusClip](https://www.opus.pro/blog/podcast-to-shorts-api), summary].
- **One reviewer's test [practitioner, self-measured]:** on 50 clips, the higher-scored clips averaged about 2.3x the views, and speaker reframing slipped for 1-2 s with three or more speakers [[Marc Andrews](https://marcandrews.com/opus-clip-review-2026-ai-video-shorts-tool-tested/), summary].
- **Music:** a Short over 60 s with any active copyright claim is blocked [platform: [YouTube Help 15424877](https://support.google.com/youtube/answer/15424877)]. Keep music beds out of long podcast Shorts unless you own them.
- **Beat sheet [inference]:**

  | beat | % of runtime |
  |---|---|
  | the sharpest line (with its key phrase as large captions) | 0-10% |
  | the restored host question / context | 10-25% |
  | the payoff | 25-85% |
  | the punchline and a soft "full episode" pointer | 85-100% |

  Captions word by word inside the safe zone.

<a id="short-film"></a>
### 6.14 Short films (`short-film`), and the pack's own genres

- **`short-film`:** the story-script grammar (cold open image 0-8%, world and want, one obstacle, the turn at 50-60%, consequence, resolution image, a tag of at most 6 s). It is backed by the but/therefore rule and Reagan's arcs above [practitioner; study by analogy].
- **`character-spot`** <a id="character-spot"></a>: RECIPE Z's 15 s wordless beat sheet (hook 0-2 s, setup, escalation, twist at about 60%, a 1.5 s reaction hold, the line and card), from the mime-style spot grammar in `docs/research/edit.md` section 10 [practitioner].
- **`documentary-launch`** <a id="documentary-launch"></a>: launch-playbook L9 (round 4/5 references at 107-185 s; voices cold open, the lead with a name super at 5-6 s, three chapters, proof, availability, the lead closes, a quiet hold) [inference from the pack's references in `reference-round45-2026-10.md`]. The template's demo is a 29 s compression of this shape.
- **`proof-film`** <a id="proof-film"></a>: launch-playbook L8 (a claim, the name, the method, one builder, head-to-head, numbers, three cards, the URL on a quiet hold) [inference from `reference-round45-2026-10.md`].
- **`beat-edit`** <a id="beat-edit"></a>: `cuts/patterns.json` `build_accelerate` and `drop_doubletime`, with pop structure as a sanity check. A Billboard-based analysis found pop songs reaching the first chorus at about 39 s on average and hip-hop at about 30 s [practitioner, summary: [Hit Songs Deconstructed](https://reports.hitsongsdeconstructed.com/articles/hip-hop-vs-pop-which-hooks-you-faster/)].

<a id="ads"></a>
### 6.15 Ads (`ad-15`, `ad-30`)

Covered in section 6.8 and findings 1-3 and 7. Add:
- **Format lengths:** the YouTube bumper is 6 s (at least 5 s), skippable ads can be skipped after 5 s, and non-skippable ads run 15-60 s [platform: [Google Ads Help](https://support.google.com/google-ads/answer/2375464)].
- **Kantar (Feb 2026):** 15 s cuts matched 30 s cuts on brand impact (per its headline; sample and method not disclosed) [study: Kantar].

## 7. Lengths and CTAs

<a id="lengths"></a>
**Lengths** (`patterns/lengths.json`): platform limits come from each platform's help page where it publishes one; X, organic Instagram Reels and organic TikTok limits come from press or search summaries and are marked practitioner. The formats block carries the trailer corpus mean (Follows), the launch-studio ranges (Hound Studio), the founder range (Flowjam), the podcast-clip window (OpusClip), the six-minute lesson chunk (Guo et al.) and the business-video completion curves (Vidyard via MarketingProfs, Wistia). In the shipped JSON these sources are cited as this file, so no vendor name ships outside `docs/research`.

<a id="ctas"></a>
**CTAs** (`patterns/ctas.json`):
- **Platform rules:** YouTube end screens; ABCD "Direction"; TikTok's close; Meta's bottom 35%.
- **Wistia:** the CTA at the end of videos under 5 min, at the start too for longer ones.
- **Practitioner rules:**
  - one CTA, not three;
  - no vote requests on a launch platform that bans them;
  - the founder's smallest ask;
  - the trailer's date card;
  - the podcast clip's soft pointer.
- **House rules:** the ad end card held 1.8 s after it settles, a soft CTA at 60-70%, and a small tag instead of a card on a loop.

No measured study of CTA timing in short-form video was found.

## 8. What the existing templates score

`python3 tools/structure_check.py --all` on the committed plans (16 Oct 2026). A pass is 70 or more.

| template | pattern | score | what it flags |
|---|---|---|---|
| `ad` (15 s) | `ad-15` | 94 | three proof and benefit lines read faster than the ceiling: "Works with the tools you already use." is 21 cps for 1.75 s (over Netflix's adult 20). The fix is to hold it 2.3 s or cut it to 5 words |
| `beat-edit` | `beat-edit` | 100 | none |
| `character-spot` | `character-spot` | 100 | none |
| `multi-voice-doc` | `documentary-launch` | 92 | the name supers hold 1.03 s for a name plus a role (4-5 words; the floor is 1.5 s at 0.3 s/word) |
| `proof-film` (16:9 and 9:16) | `proof-film` | 89 | three stretches of about 4 s with no motion event while the camera drifts (ceiling 3.5 s). The fix is a beat inside each, or mark the stretch as a hold |
| `film-scene` | none | n/a | an 8 s scene is one beat of a short film, not a whole film |
| `talking-head` | none | n/a | the demo is 6.5 s of placeholder talk with no sections; score a real edit with `--pattern podcast-clip`, `vlog` or `tutorial` |
| `demo-*` | none | n/a | part demos, no genre structure |

## 9. Contradictions and gaps (read before trusting a number)

**Contradictions:**
- **Brand timing.** TikTok wants early branding subtle, while Google, Kantar and Facebook want it within 2-5 s, and Google found early branding also raises skipping. The resolution is a diegetic brand cue inside the hook, pulsed, never a logo card [inference].
- **Founder norms vs agency norms.** The founder "no music, founders talking, real screens" norm conflicts with the agency "polish" norm (motion graphics, music, kinetic text). These are two presets, not one [inference]; `founder-story` and `saas-launch` encode them separately.
- **Text density.** TikTok's 5-10 words/s for ad overlays conflicts with reading standards (about 3 words/s). The pack follows the reading standards.
- **Shorts length.** Practitioner guides still say Shorts must be 60 s or under; YouTube allows 3 min since 15 Oct 2024.

**Gaps nobody filled:**
- measured beat percentages;
- measured ASL for launch, SaaS, AI, hardware or trailer films in seconds;
- where the drop lands;
- thumbnail patterns (faces, word count, contrast) from a primary source;
- primary Meta best-practice pages (all Meta sound-on percentages are secondary);
- TikTok's view definition;
- the original leaked production PDF;
- Envato, VideoHive, CapCut and Canva pages (they blocked the fetcher).

## 10. Sources by category (access date 2026-10-16)

- **Platforms:**
  - [TikTok Ads Help, creative best practices](https://ads.tiktok.com/help/article/creative-best-practices) · [TikTok Creative Codes PDF](https://ads.tiktok.com/business/library/Creative_Codes_ENG.pdf) · [TikTok video ad specs](https://ads.tiktok.com/help/article/video-ads-specifications)
  - [Think with Google ABCD](https://business.google.com/us/think/future-of-marketing/youtube-video-ad-creative/) · [Think with Google, skippable world](https://business.google.com/in/think/marketing-strategies/creating-youtube-ads-that-break-through-in-a-skippable-world/) · [Google Ads YouTube formats](https://support.google.com/google-ads/answer/2375464)
  - YouTube Help: [retention key moments](https://support.google.com/youtube/answer/9314415) · [chapters](https://support.google.com/youtube/answer/9884579) · [end screens](https://support.google.com/youtube/answer/6388789) · [thumbnails](https://support.google.com/youtube/answer/72431) · [thumbnail tests](https://support.google.com/youtube/answer/13861714) · [view counting](https://support.google.com/youtube/answer/2991785) · [three-minute Shorts](https://support.google.com/youtube/answer/15424877)
  - [Meta Reels ad spec](https://www.facebook.com/business/ads-guide/update/video/instagram-reels) · [LinkedIn video ad specs](https://www.linkedin.com/help/linkedin/answer/85306) · [X Premium video length](https://help.x.com/en/using-x/premium-longer-videos) (summary)
  - [Netflix timed text](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) · [Netflix general requirements](https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements) · [Spotify loudness](https://support.spotify.com/us/artists/article/loudness-normalization/) · [EBU R128](https://tech.ebu.ch/docs/r/r128.pdf)
  - [Wistia 2024 state of video](https://wistia.com/learn/marketing/insights-state-of-video-report) · [Wistia optimal length](https://wistia.com/blog/optimal-video-length)
- **Studies:**
  - [Cutting 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5256470/) · [Cutting, DeLong & Nothelfer 2010](https://journals.sagepub.com/doi/10.1177/0956797610361679) · [Cutting et al. 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3485803/) · [Cinemetrics reply](https://cinemetrics.uchicago.edu/article/590235ff-85aa-4714-9553-71d4c44fd61c) · [Feng 2016](https://scholarshare.temple.edu/items/0ab4cb95-3dcb-4405-b404-296c897d6ab3)
  - [Stephen Follows, trailer length](https://stephenfollows.com/p/have-movie-trailers-always-been-this-long) · [Stephen Follows, shots per film](https://stephenfollows.com/many-shots-average-movie/)
  - [Guo, Kim & Rubin 2014](https://pg.ucsd.edu/publications/edX-MOOC-video-production-and-engagement_LAS-2014.pdf) · [Mayer 2014 chapter](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/C98AB3A6CE760DD63C048936EA0B3B44) · [Reagan et al. 2016](https://arxiv.org/abs/1606.07772)
  - [Teixeira, Wedel & Pieters 2012](https://research.tilburguniversity.edu/en/publications/emotion-induced-engagement-in-internet-video-ads/) · [Teixeira, Wedel & Pieters 2010](https://ideas.repec.org/a/inm/ormksc/v29y2010i5p783-804.html) · [Lang et al. 2000](https://scholars.cityu.edu.hk/en/publications/the-effects-of-edits-on-arousal-attention-and-memory-for-televisi/)
  - [Kantar Feb 2026](https://www.kantar.com/north-america/company-news/kantar-super-bowl-ad-study-15-second-ads-match-30-second-spots) · [WARC: shot length in TV commercials](https://www.warc.com/Content/421e1376-baa5-472f-aa9d-adc58bea5146) · [arXiv 2608.24329](https://arxiv.org/pdf/2608.24329) · [Oakes 2007](https://www.warc.com/content/article/jar/evaluating-empirical-research-into-music-in-advertising-a-congruity-perspective/en-gb/85557)
- **Practitioners and press:**
  - [Hound Studio teardown](https://hound-studio.com/blog/22-best-product-launch-videos-2026-examples-formulas) · [Arcade](https://www.arcade.software/post/product-launch-video-examples) · [Flowjam founder-led](https://www.flowjam.com/blog/founder-led-launch-video) · [Screenhance](https://screenhance.com/blog/product-hunt-launch-video-guide) · [Moonb](https://www.moonb.io/blog/product-launch-video) · [startuplaunchvideos.com gallery](https://www.startuplaunchvideos.com/)
  - [Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/) · [Film Supply](https://wpengine.fm.co/filmsupply/how-to-cut-the-perfect-film-trailer/) · [Rare Form Audio](https://www.rareformaudio.com/blog/how-production-music-reveals-trailer-structure) · [Scripps News](https://www.scrippsnews.com/entertainment/movies/how-companies-pick-music-for-movie-trailers) · [JoBlo](https://www.joblo.com/movie-news/theater-owners-propose-new-guidelines-limiting-the-length-and-spoiler-content-of-movie-trailers)
  - [Simon Willison](https://simonwillison.net/2024/Sep/15/how-to-succeed-in-mrbeast-production/) · [Gigazine](https://gigazine.net/gsc_news/en/20240917-mrbeast-youtube-production) · [Net Influencer](https://www.netinfluencer.com/mrbeast-productions-leaked-internal-document-rosanna-pansino/) · [In Depth Cine](https://indepthcine.com/videos/casey-neistat) · [The Hustle](https://thehustle.co/storytelling-secrets-netted-matt-stone-trey-parker-600-million)
  - [Engadget](https://www.engadget.com/google-admits-that-a-gemini-ai-demo-video-was-staged-055718855.html) · [OpusClip](https://www.opus.pro/blog/podcast-to-shorts-api) · [Clevercast (BBC mirror)](https://clevercast.com/bbc-subtitling-guidelines)

The working notes from the six passes are not in the repository; every number the pack uses is in this file with its source and grade.
