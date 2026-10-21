# motion-pack / research / expansion-audio

Date: 2026-10-13. Scope: music and SFX we may use commercially on YouTube, Instagram, LinkedIn and X, plus ways to keep the owned synthesised library growing.
Method: read-only web research (web pages and curl to stdout). Every claim below carries its source URL. Where a page could not be read, the entry says so and the source is treated as NOT cleared.

How this repo uses the results: no third-party audio is vendored. The CC0 subsets selected here (the Kenney audio packs and the OwlishMedia pack) are fetched by `scripts/fetch-external.sh` into a folder outside git and imported with `sfx/tools/check_origin.py` then `sfx/tools/catalog_import.py --category <cat>`. Every other source below is licence information only.

## 0. Decision summary (read this first)

| Verdict | Source | One line |
|---|---|---|
| CLEARED (selected packs fetched by `scripts/fetch-external.sh`) | Kenney audio packs (CC0) | 10 packs, small, no attribution, lowest Content ID risk of any third-party source |
| CLEARED (OwlishMedia pack fetched by `scripts/fetch-external.sh`) | OpenGameArt, CC0-only items (e.g. OwlishMedia pack 142.4 MB) | Check the licence field per item, not the search filter |
| CLEARED per item | Freesound sounds licensed CC0 only | Login required; verify licence on each sound page; CC-BY goes to the flag list |
| CLEARED WITH CAVEATS | Sonniss GDC 2026 bundle, 7.47 GB+ | Commercial, no attribution; no redistribution as SFX, no AI/ML training; Content ID not addressed |
| CONDITIONAL | Mixkit Free licence (SFX and music) | Secondary sources say commercial and no attribution, but the licence text itself could not be read: open the licence page before use |
| CONDITIONAL, SFX only | Pixabay (SFX yes, music avoid for monetised channels) | Pixabay Content Licence is not CC0, and anyone can upload, so retroactive Content ID claims on music are real |
| YOUTUBE-ONLY | YouTube Audio Library | No Content ID claims on YouTube; Google gives no guidance for use off YouTube; some tracks need CC-BY credit |
| FLAG (attribution) | Incompetech / Kevin MacLeod (CC-BY 4.0) | Usable only with visible credit; no credit slot on most short-form posts |
| REFUSE | BBC Sound Effects (RemArc: research, education, personal), any CC-BY-SA / NC / ND item, FMA "Limited" licence, Looperman-type loop sites | Not licensed for our videos |
| NOT USABLE | FreePD (site closed 2025), Zapsplat and Musopen (pages blocked, unverified), Meta Sound Collection (terms text not retrievable), unlicensed Indian-instrument sample packs | Cannot verify, so no |

## 1. Third-party candidates, with licence facts

Licence rule used here (the same allow-list `sfx/tools/check_origin.py` enforces): accept CC0, public domain, MIT, Apache-2.0, OFL, or "royalty-free commercial, no attribution" that is verifiable on the source page. Flag CC-BY. Refuse CC-BY-SA, NC, ND, "personal use" and unclear.

### 1.1 Kenney audio (CC0)
- Page: https://kenney.nl/assets/category:Audio lists 10 packs: Casino Audio, Sci-fi Sounds, Interface Sounds, Impact Sounds, Voiceover Pack (Fighter), Voiceover Pack, Music Jingles, RPG Audio, Digital Audio, UI Audio.
- File counts and licence read on each pack page: Interface Sounds 100 files, CC0 (https://kenney.nl/assets/interface-sounds); Impact Sounds 130, CC0 (https://kenney.nl/assets/impact-sounds); Music Jingles 85, CC0 (https://kenney.nl/assets/music-jingles); Sci-fi Sounds 70, CC0 (https://kenney.nl/assets/sci-fi-sounds); Digital Audio 60, CC0 (https://kenney.nl/assets/digital-audio); RPG Audio 50, CC0 (https://kenney.nl/assets/rpg-audio); UI Audio 50, CC0 (https://kenney.nl/assets/ui-audio). Casino Audio file count and the two Voiceover packs were not read.
- Licence statement: https://kenney.nl/support says all assets are public domain (CC0), commercial use is fine, credit optional, and the Kenney logo must not be used.
- Sizes: not listed on any page I could read. Treat as "small, a few MB to tens of MB, unverified".
- Content ID risk: very low. Short game SFX, not registered music. Recognisable (many indie games use them), so use them as raw material and layer or process them, not as a hero sound.
- What we get: UI clicks, impacts (130 is a good reference set to A/B against `snd.hit.*`), sci-fi blips, 85 short jingles as stinger references, coin/chip sounds (casino).
- Do not take: the Voiceover packs (speech; we have a no-speech rule in the synth kit).

### 1.2 OpenGameArt (CC0 items only)
- Licence menu and FAQ: https://opengameart.org/content/faq (CC0, CC-BY 3.0/4.0, CC-BY-SA, OGA-BY, GPL are offered; previews are not covered by the download licence; uploader must hold the rights; multi-licence items need one licence followed).
- Best verified item: OwlishMedia "Sound Effects Pack", CC0, 142.4 MB zip, one download. Categories: ambient, fabric rustle, footsteps, human sounds (breathing, laughing, coughing), metal/ceramic/dull impacts, paper, UI, synth/sci-fi, technology, water. https://opengameart.org/content/sound-effects-pack
- "Wierd Whooshes" (bosslevelaudio) lists several licences including CC-BY-SA and is one long file: skip unless CC0 is the licence we elect and cutting the long file is acceptable. https://opengameart.org/content/wierd-whooshes (seen in search results, not read).
- Content ID risk: low. Risk is provenance (a user can upload someone else's work). Rule: check the Author field and the licence on the item page, and refuse items that say they were built from Freesound or other-site samples.
- What we get: footsteps, cloth, paper, water, human non-speech foley. These fill gaps (we have 3 cloth, 3 paper, 7 liquid, no footsteps beyond `cloth.footstep`).

### 1.3 Freesound (CC0 only)
- Licences explained at https://freesound.org/help/faq/ : CC0, CC-BY, CC-BY-NC, Sampling+. Under CC0 you can do "pretty much what you want", you cannot claim authorship. CC-BY needs credit. NC and Sampling+ are refused.
- Filtering: the site has a licence filter and a "Free Cultural Works" option that mixes CC-BY and CC0, so do not use that option. The API form is `license:"Creative Commons 0"` (source: https://opensource.creativecommons.org/blog/entries/freesound-intro/). Treat the quoted label as needing a live check.
- Content ID: the Freesound FAQ itself warns that sounds used raw in songs can match Content ID, and the uploader may later get a claim on a video using that sound; the fix is a dispute with proof the upload predates the work. So: use for SFX, process or layer, and never use a raw CC0 loop as a music bed.
- Practical: downloads need a Freesound login. Keep a text file per download: sound URL, author, licence, date. That file is the dispute evidence (`sfx/tools/check_origin.py` asks for the same fields in `ORIGIN.txt`).
- What we get that synthesis does badly: real foley (footsteps by surface, door, drawer, keys, zipper, scissors, tape, coin drop), real animals/birds, real room tones, and reference recordings of tabla, sitar, shehnai, tanpura strokes to tune our own synthesis by ear. A web search for CC0 tabla/sitar/shehnai packs found none with a verifiable CC0 statement (https://loststoriesacademy.com/blogs-and-tutorials/7-sample-libraries-for-indian-instruments-free-paid-in-2025 lists free packs but names no licence). So: single Freesound sounds with the CC0 label only.

### 1.4 Sonniss GameAudioGDC
- Current bundle: GDC 2026, 7.47 GB+, 17 vendors, released around 16 March 2026, free from gdc.sonniss.com. Source: https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/ . The GDC 2024 bundle is 9 zip parts, 23.5 GB (https://sonniss.com/gameaudiogdc , which says no GDC 2025 bundle exists).
- Licence (read at https://sonniss.com/gdc-bundle-license/ ; it states version 2.0, effective 27 August 2026; earlier downloads are governed by the version on the download date): commercial and personal projects, no attribution; films, videos, podcasts and apps all count; you may NOT distribute or sub-license the sounds as sound effects (libraries, sample packs, asset packs, SDKs) and may NOT use them to train AI/ML. The Content ID question is not addressed on either page. https://sonniss.com/gameaudiogdc also lists monetised YouTube as a permitted use.
- Content ID risk: low to medium. I found no reports of claims against Sonniss bundles, but a bundle with 17 vendors is not an exclusive library, so keep the licence PDF per download.
- Hard rules if used: (a) never ship Sonniss files inside any packaged or sold version of motion-pack; (b) never feed them into any model-training or learned-parameter fitting; hand-reading spectra to retune our own synthesis is analysis, not training, but keep that line explicit; (c) keep them in a folder outside the repo, with an `ORIGIN.txt`, and import them only through `sfx/tools/check_origin.py` then `sfx/tools/catalog_import.py --category <cat>`.
- What we get: cinematic impacts, risers, whooshes, real foley, vehicles, weather, UI, in studio quality. This is the single biggest quality jump available.

### 1.5 Mixkit (conditional)
- Secondary sources: Free licence covers commercial projects including YouTube, social media marketing, online ads and music videos; no attribution; items cannot be resold in original form or sub-licensed. https://mixkit.co/llm-info/ (a vendor page written for AI readers, so marketing copy, not licence text). Mixkit has a separate licence per item type (Stock Music Free, Sound Effects Free): https://mixkit.co/license/ . The actual licence text was not retrievable, and Content ID is not addressed anywhere I could read.
- Status: CONDITIONAL. Open "View License" for Sound Effects Free and Stock Music Free and confirm the sentences above before any file is taken.

### 1.6 Pixabay (SFX yes, music avoid)
- Licence summary: free use, no attribution, modification allowed; no standalone sale or distribution; no use in misleading or unlawful ways; audio is covered. https://pixabay.com/service/license-summary/ . Terms section 5 and 8: no standalone distribution including audio files, no bulk or systematic copying. https://pixabay.com/service/terms/ . Neither page mentions Content ID.
- Content ID risk: real for music. Anyone can upload, so tracks can be fingerprinted later and every video using them is claimed at once; the dispute route is the Pixabay licence file. This comes from vendor blogs (some are competitors) and a HeyGen help article, so treat the size of the risk as unquantified: https://hellothematic.com/thematic-vs-pixabay/ and https://help.heygen.com/en/articles/8986144-how-to-remove-your-content-id-claim-in-youtube
- Rule: Pixabay SFX are acceptable (low risk, layered). Pixabay music is NOT a bed for a monetised or client-facing film. Our own beds cover that.

### 1.7 YouTube Audio Library (YouTube only)
- Official text: Audio Library tracks "won't be claimed by a rights holder through the Content ID system"; some tracks are Creative Commons and need credit in the description; YouTube gives no guidance for use off YouTube. https://support.google.com/youtube/answer/3376882
- Rule: usable only in a file that ships on YouTube alone. Do not reuse in an Instagram, LinkedIn or X cut. Our own library is the default for multi-platform films.

### 1.8 Incompetech (CC-BY, flag)
- CC-BY 4.0: credit must be easy to find (title, creator, licence line), edits must be labelled. https://incompetech.com/music/royalty-free/faq.html . It is not public domain.
- FreePD, the CC0 sibling, is closed: page reads "permanently closed", 2008-2025 (https://freepd.com/ read with curl on 2026-10-13). Do not plan around FreePD tracks; old FreePD downloads have an unverified licence.
- Flag: only for long-form YouTube where the description carries credit.

### 1.9 Free Music Archive, ccMixter, Internet Archive
- FMA: mixture of CC licences (BY, BY-SA, BY-ND, BY-NC, CC0). Some artists use Content ID; FMA cannot resolve claims. https://freemusicarchive.org/faq . A dedicated CC0 filter is unconfirmed, so every track needs a manual licence read. Music from FMA is "CC0 only".
- ccMixter: licence differs per track; CC0 is possible; check each track. https://ccmixter.org/terms
- Internet Archive: licence per item, no site-wide guarantee (page read gives no licence information). https://archive.org/details/audio_music
- Verdict: music from these is a last resort. Our own composer should cover beds; use these only to study arrangement.

### 1.10 Refused or unverifiable
- BBC Sound Effects (RemArc): research, education and personal use free; commercial use needs a paid licence; AI/data-mining not included. Press coverage only because the BBC pages blocked fetches: https://musictech.com/news/music/the-bbc-sound-effects-archive-over-33000-free-samples , https://www.prsformusic.com/m-magazine/news/bbc-releases-sample-library-with-thousands-of-sound-effects . Rule: personal/educational only = REFUSE.
- Zapsplat (403) and Musopen (403): pages could not be read, so unverified. Do not use.
- Meta Sound Collection: terms text not retrievable (page returned only a title). Unverified.
- Apple Color Emoji and any commercial sample pack (Loopmasters Instruments India, Cinesamples Shakti, Future Loops tabla pack): paid, licence not CC0; not in scope. https://www.loopmasters.com/genres/147-India/products/14561-Instruments-India
- Anything marked "royalty free" with no licence text (Lost Stories free Indian pack, SampleScience Sounds of India, Rajan Somasundaram's percussion library): no licence named in the sources I found, so refused.

### 1.11 Generative audio (assessed, not used by the pack)
- Stable Audio Open 1.0: Stability AI Community Licence; about 1 B parameters; trained on 472,618 Freesound and 13,874 FMA recordings, all CC0, CC-BY or Sampling+; up to 47 s stereo at 44.1 kHz; better at SFX and field recordings than music; cannot do realistic vocals; model card calls research the primary intended use. https://huggingface.co/stabilityai/stable-audio-open-1.0
- The model page sends commercial users to https://stability.ai/license and gives no revenue threshold in what I read. Read it (and accept it on Hugging Face, which needs an account) before a download.
- Value: generates foley and ambience that synthesis does poorly (footsteps, animals, room tones). Risk: output provenance cannot be proved to be unique; use as raw material layered under our synthesis, not as a hero sound.
- Models with non-commercial licences are out (MusicGen, AudioGen weights are CC-BY-NC from my own knowledge; not verified in this run, treat as refused).

## 2. Download candidates (licence facts)

| # | Candidate | Source | Size | Licence | Notes |
|---|---|---|---|---|---|
| D1 | Kenney Interface Sounds, Impact Sounds, Digital Audio, UI Audio, RPG Audio, Sci-fi Sounds, Music Jingles | kenney.nl/assets/<name> | not listed on the pages, likely under ~100 MB in total | CC0 | 545 short files for A/B, sci-fi and UI layering. Fetched by `scripts/fetch-external.sh` (outside git). |
| D2 | OwlishMedia "Sound Effects Pack" zip | opengameart.org/content/sound-effects-pack | 142.4 MB | CC0 | foley gap fill. Fetched by `scripts/fetch-external.sh` (outside git). |
| D3 | Sonniss GameAudioGDC 2026 | gdc.sonniss.com | 7.47 GB+ | Sonniss licence v2.0 | studio-quality impacts, risers, foley, weather. Not fetched by the repo; see the hard rules in 1.4. |
| D4 | Freesound CC0 sounds, about 40 hand-picked: tabla strokes, sitar pluck, shehnai note, tanpura, footsteps (4 surfaces), door, keys, zipper, bird | freesound.org (login required) | tens of MB | CC0 only | reference recordings to tune synthesis, plus real foley. Not fetched by the repo. |
| D5 | Mixkit SFX | mixkit.co | per file | Mixkit Free (licence text unconfirmed, see 1.5) | optional. Not fetched by the repo. |

Anything imported from this table goes through `sfx/tools/check_origin.py` (an `ORIGIN.txt` with URL, author, licence, licence snapshot, date and archive SHA-256) and then `sfx/tools/catalog_import.py --category <cat>`.

## 3. Content ID: how we keep it safe

1. Prefer the owned synthesised library. It is the only source where no outside party can hold a fingerprint, and the manifest SHA plus git history is proof of authorship for a dispute.
2. Third-party SFX are layered under or over owned sounds, pitched, filtered or trimmed, never used as a lone raw one-shot at a hero moment.
3. No third-party music beds, no raw CC0 loops as a bed (Freesound FAQ warns about exactly that: https://freesound.org/help/faq/ ).
4. One `ORIGIN.txt` per imported pack: URL, author, licence text snapshot, date, SHA of the zip (`sfx/tools/check_origin.py` refuses imports without it). Keep the Pixabay or Sonniss licence file where it is generated.
5. Upload test before relying on a source on a platform: unlisted YouTube upload, a private IG draft; check for claims before the film goes live.
6. Open item already in `sfx/README.md`: platform loudness for IG, TikTok, X and LinkedIn is still unverified; do that empirical upload test.

## 4. Build in-house now (all deterministic, numpy/scipy/numba, no downloads)

The existing kit has 188 sounds in 21 families and 35 music items (14 beds, 10 stingers, 11 logos), 10 genre presets, a Karplus-Strong `pluck`, modal `bell`, `marimba`, `keys`, `pad`, `supersaw`, `dhol_low`/`dhol_rim` (`sfx/mpaudio/instruments.py`). Gaps seen in the manifest: no footsteps (one cloth step), no doors/drawers, no animals, no weather beyond rain/wind, no Indian melodic or hand-drum voices beyond dhol, no phone sounds, few risers by genre, no tempo-ramped beds.

### 4.1 Indian instruments (new family `indian`, tag `region:in`)
Physical references: tabla dayan overtones are near-harmonic (Raman and Kumar 1920, https://repository.ias.ac.in/52555 ; five harmonics, first three most sustained), so a harmonic modal bank with a fast attack is right for `na`/`tin`/`tun`. Bayan hand-pressure glide: a hobbyist model uses an exponential pitch rise 55 to 155 Hz (heuristic, from the search result summary of https://kennethreitz.org/essays/2026-03-29-numpy_as_synth_engine.md); academic grounding for glides from tension modulation is Marogna, Avanzini and Bank (https://dafx.de/paper-archive/details/FF0VCsWcetDbuSbluOmOiQ). Bayan is hard to model physically, so the heuristic envelope is the plan (https://www.rcs.cic.ipn.mx/2015_103/Concatenated%20Tabla%20Sound%20Synthesis%20to%20Help%20Musicians.pdf). Sitar: Karplus-Strong string plus a nonlinear bridge stage (jawari) plus a sympathetic resonator bank; STK has a KS sitar class and a University of Limerick thesis covers it (https://researchrepository.ul.ie/articles/thesis/The_physical_modelling_of_a_sitar/19811827 , https://ccrma.stanford.edu/courses/256a-fall-2014/lectures/5b/stkExample/stk/Sitar.h). No peer-reviewed jawari or bayan physical model was found; both will be tuned by ear against D4 reference recordings (Section 2).

Components to build:
- `snd.indian.tabla_na`, `tabla_tin`, `tabla_tun`, `tabla_te`, `tabla_ge_open` (bayan with glide), `tabla_ka` (bayan slap), `tabla_dha` (na + ge), `tabla_dhin`, `tabla_tirakita` roll.
- Tabla patterns as beds: `bed_tabla_teental_loop`, `bed_tabla_keherwa_loop`, `bed_tabla_dadra_loop` (16, 8 and 6 beats), each snapped to whole frames with the existing `grid.py`.
- `snd.indian.dholak_dha`, `dholak_ge`, `manjira`, `ghungroo`, `nagara_hit`, plus a `bed_bhangra_dhol_loop` built from the existing dhol voices.
- Strings: `snd.indian.sitar_pluck` (jawari buzz), `sitar_meend` (pitch bend), `sitar_jhala` (fast strum), `santoor_hit` (modal hammered strings), `tanpura_drone` as an ambience loop (Pa-Sa-Sa-Sa cycle, jivari buzz).
- Winds and reeds: `shehnai_note` (reed buzz through a formant stack, meend glide), `bansuri_note` (breath noise plus overblown sine), `harmonium_chord` (detuned reed pair, bellows swell), `shruti_drone`, `shankh_conch`, `ghanta_temple_bell` and `thali_clang` (modal metal).
- Tuning: Hindustani melodies sit on just-intonation ratios relative to Sa; add a `scale` option to `compose.py` alongside the A-major default.
- Music presets: `indian_fusion` (tabla + sitar pluck + synth bass), `bhangra_hype`, `raga_calm` (tanpura + bansuri), `festive_dhol`.

### 4.2 New SFX families and sounds (all by recipe, plus manifest entries, plus pairing in `sweeteners.json` where relevant)
- Foley (new `foley` family): `footstep_concrete`, `footstep_wood`, `footstep_gravel`, `footstep_carpet` (noise burst plus resonant thud, 4 round-robin takes), `door_open`, `door_close`, `drawer`, `chair_creak`, `keys_jingle`, `coin_drop`, `cup_set_down`, `pen_click`, `stamp`, `zipper`, `scissors`, `tape_tear`, `book_thud`, `laptop_close`.
- Phone and desktop (extend `ui`): `phone_buzz`, `phone_ring_synth`, `message_sent`, `message_received`, `mouse_click`, `keyboard_mech_soft`, `keyboard_mech_clack`, `loading_tick`, `progress_fill`, `card_flip`, `level_up`, `achievement`, `lock`, `unlock`.
- Voice-assistant set (word-free): `ui.mic_on`, `ui.mic_off`, `ui.listening_loop`, `ui.ai_think_pulse`, `ui.ai_reply` — these give voice-assistant product demos a consistent sonic identity.
- Impacts: `hit.taiko`, `hit.cymbal_swell`, `hit.explosion_small`, `hit.bass_drop_wobble`, `hit.metal_cinematic`, `hit.glass_hit`.
- Risers and whooshes by genre: `riser.siren`, `riser.glitch_stutter`, `riser.snare_roll_build`, `riser.pitch_noise`, `riser.string_tension` (synth strings), `whoosh.blade`, `whoosh.fire`, `whoosh.magic_swirl`, `whoosh.scifi_pass`.
- Nature and ambience: `amb.thunder`, `amb.stream`, `amb.fire_crackle`, `amb.birds_morning` (FM chirps, sparse), `amb.rain_light`, `amb.rain_heavy`, `amb.train_chug`, `amb.indian_street_horns` (synthetic horns only, no crowd voices), `amb.monsoon`.
- Crowd without speech: `crowd.cheer_synth`, `crowd.aww_synth`, `crowd.boo_synth` using the existing word-free formant voices.
- Cartoon extras for mime-style spots: `cartoon.whistle`, `cartoon.bonk_pitch`, `cartoon.slip_long`, `cartoon.surprise_sting`.
- Transition sweeteners: the README lists 5 pairings still pending; finish them as part of this batch so every transition kind has a sound.

### 4.3 Music
- New presets: `lofi_jazz` (7th chords, swing), `synthwave`, `house_four_floor` (exists as hype_house; add deep-house variant), `dnb_170`, `ambient_pad`, `chiptune_8bit` (Content ID safe by construction), `acoustic_folk_pluck`, `documentary_marimba`, `orchestral_synth_epic` (stabs, taiko, braam), `jazz_walk` (walking bass, brushed hat), plus the four Indian presets in 4.1.
- New structure templates: `cold_open_3s`, `explainer_60s`, `sting_only`, `outro_8s`.
- Feature gap from the README: `anthem_build` does not accelerate; add tempo maps (`tempo_maps.json` already exists) and a ramp so `grid.py` supports 100 to 128 BPM.
- Stems: keep drums/bass/harmony/lead/fx stems per bed, so the edit can drop the drums under voice.
- Sonic logos: add a Hindustani-pitched logo option (sitar pluck + tanpura bloom) next to the existing hash-derived motif.

### 4.4 Tooling
- Add a listening checklist (now `sfx/LISTENING_PASS.md`, generated by `sfx/tools/listening_checklist.py`) and run one listening pass per new family, as the READMEs already require.
- Add an `ORIGIN.txt` policy and `sfx/tools/check_origin.py`, which refuses to catalogue any imported file without it.
- Add `sfx/tools/catalog_import.py`, which takes an external WAV that passed the origin check, normalises to -6 dBFS peak, measures the same LUFS/TP/centroid fields as the owned library, and tags it `source:ext` so mixers and lints can treat it differently.
- Stems and sweeteners already exist; reuse `mixer.py` unchanged.

### 4.5 Build order (smallest first, highest value first)
1. Finish the 5 pending sweeteners (no new sounds).
2. Foley family (18 sounds) and phone/AI UI (14 sounds).
3. Indian pack in the order: tabla strokes and 3 theka beds, sitar pluck, tanpura drone, shehnai, harmonium.
4. Risers/whooshes/impacts by genre.
5. Presets: lofi_jazz, chiptune, synthwave, indian_fusion.
6. Tempo ramp in `grid.py`.

## 5. Open questions
- D3 (Sonniss, 7.47 GB) is the largest quality gain but carries the redistribution and AI/ML limits in 1.4.
- The Mixkit licence wording is unconfirmed until the "View License" pages are read (1.5).
- The Stability AI Community Licence must be read and accepted before any model download (1.11).
- YouTube Audio Library is usable only for films that ship on YouTube alone (1.7).

## 6. Source list (every URL used)
- https://sonniss.com/gameaudiogdc
- https://sonniss.com/gdc-bundle-license/
- https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/
- https://pixabay.com/service/license-summary/
- https://pixabay.com/service/terms/
- https://hellothematic.com/thematic-vs-pixabay/
- https://help.heygen.com/en/articles/8986144-how-to-remove-your-content-id-claim-in-youtube
- https://kenney.nl/assets/category:Audio and the individual pack URLs in 1.1
- https://kenney.nl/support
- https://freesound.org/help/faq/
- https://opensource.creativecommons.org/blog/entries/freesound-intro/
- https://opengameart.org/content/faq
- https://opengameart.org/content/sound-effects-pack
- https://opengameart.org/content/wierd-whooshes
- https://support.google.com/youtube/answer/3376882
- https://incompetech.com/music/royalty-free/faq.html
- https://freepd.com/
- https://freemusicarchive.org/faq
- https://ccmixter.org/terms
- https://archive.org/details/audio_music
- https://mixkit.co/license/ , https://mixkit.co/llm-info/
- https://musictech.com/news/music/the-bbc-sound-effects-archive-over-33000-free-samples
- https://www.prsformusic.com/m-magazine/news/bbc-releases-sample-library-with-thousands-of-sound-effects
- https://huggingface.co/stabilityai/stable-audio-open-1.0
- https://repository.ias.ac.in/52555
- https://dafx.de/paper-archive/details/FF0VCsWcetDbuSbluOmOiQ
- https://www.rcs.cic.ipn.mx/2015_103/Concatenated%20Tabla%20Sound%20Synthesis%20to%20Help%20Musicians.pdf
- https://researchrepository.ul.ie/articles/thesis/The_physical_modelling_of_a_sitar/19811827
- https://ccrma.stanford.edu/courses/256a-fall-2014/lectures/5b/stkExample/stk/Sitar.h
- https://kennethreitz.org/essays/2026-03-29-numpy_as_synth_engine.md
- https://loststoriesacademy.com/blogs-and-tutorials/7-sample-libraries-for-indian-instruments-free-paid-in-2025
- https://www.loopmasters.com/genres/147-India/products/14561-Instruments-India

Confidence: licence statements read directly from the source page are high; anything marked "search result summary" or "press coverage" is medium; the Indian instrument modelling ideas are unauditioned starting points.
