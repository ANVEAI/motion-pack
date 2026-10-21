# Expansion research, VISUAL: transitions, overlays, emoji, Lottie, icons, LUTs

Date: 13 Oct 2026. Status: research only. Only web pages and
public GitHub/asset-site APIs (JSON listings, licence headers read in memory) were read. Every figure below carries its source.

How this repo uses the results: no third-party asset is vendored. The selected MIT/ISC subsets (Fluent Emoji, Lucide, Phosphor) are
fetched by `scripts/fetch-external.sh` into a folder outside git. Every other source below is licence information only.

Confidence tags: [verified] = read on the primary source page or file in this run. [secondary] = reported by a third party, not confirmed on
the primary source. [unverified] = could not be confirmed; treat as NOT cleared.

Decision key: CLEAR = licence verified, permissive enough to redistribute with its notice. ATTRIB = usable but needs a credit line
(CC-BY). REFUSE = incompatible or unclear. INTERNAL = free to use in a render but not redistributable inside our pack.

---------------------------------------------------------------------------------------------------------------------

## 0. Bottom line (what to do)

1. **Transitions: a curated MIT subset of gl-transitions is CLEAR.** 123 of its 125 shaders are MIT, 2 are BSD (permissive, keep the
   notice). We already own 23 transitions, so we need the other looks (ripple, swirl, crosswarp, cube, doorway, kaleidoscope, hexagonalize,
   windowslice, polka-dots curtain, TV static, undulating burn, ...). Plain text, about 143 KB for all 125 files. Not vendored in this
   repo: we write our own versions instead (section 9) and also have ffmpeg's built-in `xfade`.
2. **Emoji: Fluent Emoji (MIT) is the one clean, animatable set.** Flat SVG is about 2 KB per emoji, roughly 1,500 emoji. Noto Emoji PNG/SVG is
   Apache-2.0 in the repo. Twemoji and the animated Noto set are CC-BY 4.0 (ATTRIB). OpenMoji is CC-BY-SA (REFUSE). Apple Color Emoji is not ours.
3. **Icons: Phosphor (MIT), Tabler (MIT), Lucide (ISC + MIT for Feather parts), Iconoir (MIT), Simple Icons (CC0, brand logos).** All verified
   through GitHub's licence data. Each is vector, so each can be path-drawn in HyperFrames with GSAP.
4. **Overlays and plates: Pexels/Pixabay/Unsplash/Mixkit footage is "free to use" but is NOT CC0** (no stand-alone redistribution, brand and
   people restrictions). Only ambientCG and Poly Haven are real CC0 (textures, paper, HDRIs; no moving light leaks). Our procedural
   `layers/` already covers grain, dust, leaks, bokeh, scanlines, glitch; the real gain from outside is a few captured plates (real 35 mm
   grain scan, real light-leak footage). Recommend building more procedural ones first (section 9) and treating captured plates as optional.
5. **Lottie: no source here is both free of attribution/redistribution limits and worth the vendor effort.** LottieFiles is per-animation,
   no stand-alone redistribution. Build our own animated vectors from SVG + GSAP (HyperFrames' native route) instead.
6. **LUTs: do not download packs.** Every "free LUT pack" found is CC-BY, free-but-no-redistribution, or has no licence statement. The best
   asset is the closed-form grade in `layers/grade.js`, which already emits `.cube`. Generate 40+ more looks in-house.

---------------------------------------------------------------------------------------------------------------------

## 1. Transitions

### 1.1 gl-transitions (CLEAR, curated subset)

| field | value |
|---|---|
| URL | https://github.com/gl-transitions/gl-transitions (gallery https://gl-transitions.com) |
| Licence | Repo `LICENSE` is MIT, "Copyright (c) 2017-present gl-transitions contributors" [verified: raw LICENSE file]. Each shader carries its own `// License:` header. |
| Per-file audit (this run) | I read the headers of all 125 `.glsl` files in `transitions/` in memory: **123 MIT, 1 BSD 3-Clause (`InvertedPageCurl`), 1 BSD 2-Clause (`StereoViewer`)**. None were GPL/CC-NC/unlicensed. [verified: GitHub contents API + raw files] |
| Contributing rule | "License comment on the second line of the file (`// License: MIT`), MIT strongly preferred" [verified: CONTRIBUTING.md] |
| Size | All 125 shaders = about 143 KB of text (measured). GitHub reports the whole repo at about 539 MB, mostly gallery assets, so do NOT clone; fetch single files or the npm JSON. |
| Packaging | npm `gl-transitions` exposes `[{name, glsl, params, description, tags, textures, ...}]` [verified: README]. |
| Interface | `vec4 transition(vec2 uv)` using `getFromColor`, `getToColor`, `progress`, `ratio`. Tiny adapter onto our `tx-gl.js` (not yet written). |

Names present (125): AdvancedMosaic BlockDissolve BookFlip Bounce BowTieHorizontal BowTieVertical BowTieWithParameter Box
ButterflyWaveScrawler CircleCrop ColourDistance CrazyParametricFun CrossZoom DefocusBlur Directional DirectionalScaled DoomScreenTransition
Dreamy DreamyZoom Drop_Zone_Flicker EdgeTransition FilmBurn Fold GlitchDisplace GlitchMemories GridFlip HSVfade HorizontalClose
HorizontalOpen InvertedPageCurl LeftRight LinearBlur Mosaic Overexposure PolkaDotsCurtain PuzzleRight Radial Rectangle RectangleCrop
Revolve_Left Rolls RotateScaleVanish SimpleFlip SimpleZoom SimpleZoomOut Slides StarWipe StaticFade StereoViewer StripDatamoshGlitch Swirl
TVStatic TilesWave TopBottom VerticalClose VerticalOpen WaterDrop ZoomInCircles ZoomLeftWipe ZoomRigthWipe angular burn burn0 cannabisleaf
chessboard circle circleopen colorphase coord-from-in crosshatch crosswarp cube directional-easing directionalwarp directionalwipe
displacement dissolve doorway fade fadecolor fadegrayscale flyeye fragment heart hexagonalize kaleidoscope luma luminance_melt morph
mosaic_transition multiply_blend old_tv_lost_signal parametric_glitch perlin pinwheel pixelize polar_function powerKaleido randomNoisex
randomsquares ripple rotateTransition rotate_scale_fade scale-in splitSlideIn/Out (6 variants) squareswire squeeze static_wipe swap
tangentMotionBlur undulatingBurnOut wind windowblinds windowslice wipeDown wipeLeft wipeRight wipeUp x_axis_translation zoomInOut.

Caveats and curation rules:
- Drop `cannabisleaf` and `heart` for brand reasons (judgement, not licence). Drop anything that needs an external texture (`displacement`,
  `luma`) until we ship our own noise texture.
- Keep each file's header (author + licence line) in our copy and add a `THIRD_PARTY.md` listing them (MIT requires the notice). BSD files
  need their notices too.
- Quality is uneven (community contributions). Pick on the demo, not the name. Our existing 23 stay the premium set; imported ones are the
  "extras" tier.
- Suggested first import (about 30 files, about 35 KB): ripple, swirl, crosswarp, directionalwarp, cube, doorway, kaleidoscope, powerKaleido,
  hexagonalize, windowslice, windowblinds, squeeze, PolkaDotsCurtain, TVStatic, old_tv_lost_signal, undulatingBurnOut, tangentMotionBlur,
  DreamyZoom, CrossZoom, LinearBlur, DefocusBlur, GridFlip, BookFlip, Fold, pinwheel, radial (`Radial`), StarWipe, WaterDrop, wind,
  StripDatamoshGlitch, GlitchMemories, parametric_glitch, Overexposure, luminance_melt.

### 1.2 Other transition sources

| source | licence | verdict |
|---|---|---|
| ffmpeg `xfade` (built into ffmpeg; counted on 8.0.1) | n/a, we run the binary | **58 built-in modes (0..57) plus a `custom` expression mode**, counted from `ffmpeg -h filter=xfade` in this run. Zero download. Use for the ffmpeg finisher path (fade, wipes, slides, circle open/close, dissolve, pixelize, radial, zoomin, hlslice, vuslice, ...). |
| Shadertoy | default CC BY-NC-SA 3.0 unless the author states otherwise [secondary, from general knowledge, not fetched] | REFUSE (non-commercial default). Only usable per shader if an explicit permissive licence is in the code comment. |
| LYGIA shader library | dual "Prosperity" non-commercial + paid commercial [secondary, from general knowledge, not fetched] | REFUSE as a vendor target. |
| The Book of Shaders | CC BY-NC-ND [secondary, general knowledge] | REFUSE. |
| HyperFrames registry (remote, 14 shader transitions + more) | remote | Names for vocabulary only, as `docs/research/visual.md` section 1.4 already decided. Do not vendor. |
| three.js examples post-processing (GlitchPass, FilmPass, HalftonePass, AfterimagePass, RGBShift) | three.js repo is MIT [verified: GitHub API] | CLEAR for ideas and for vendoring single files if wanted; our own versions already cover most. |
| pmndrs/postprocessing | zlib [verified: GitHub API] | CLEAR (permissive). Effects worth porting as GLSL ideas: Glitch, Scanline, ChromaticAberration, DotScreen, Pixelation, Noise, LensFlare, GodRays. 262 MB repo: read, do not clone. |

---------------------------------------------------------------------------------------------------------------------

## 2. Overlays, effects, plates

### 2.1 Licence facts for the stock sites

| site | what the licence says | verdict for our pack |
|---|---|---|
| Pexels https://www.pexels.com/license/ | Free to use for commercial work, no attribution needed, may edit. Cannot sell unmodified copies, cannot redistribute or sell on other stock/wallpaper sites, no implying endorsement, no use as a trademark. Identifiable people must not be shown badly. [verified] | **INTERNAL / clear for use inside finished videos.** NOT CC0. Do not commit the clips into a pack we publish; keep a manifest with URL + date. |
| Pixabay https://pixabay.com/service/license-summary/ | Free to use and modify, attribution not required. No stand-alone redistribution, no commercial use of content showing recognisable brands/logos on goods, no use as a trademark, no misleading use. AI training and Content ID are not covered on the summary page. [verified] | Same as Pexels. Check each clip for brands and people. |
| Unsplash https://unsplash.com/license | Commercial use allowed, no attribution required. Images cannot be sold without significant modification; may not compile photos to recreate a competing service. [verified] | Fine for still textures (bokeh, bokeh-ish plates, dust photos) inside videos. Not CC0. |
| Mixkit https://mixkit.co/license/ | Separate licences per item type (Stock Video Free, Stock Video Restricted, Music Free, SFX Free, Video Templates Free, Art Free). The page I could read lists the names but not the terms. [unverified terms] | **Do not rely.** Read the per-type "View License" text before any use; the "Restricted" video licence exists. |
| Kenney https://kenney.nl/support | Assets on its pages are "public domain licensed (CC0)", commercial use fine, no attribution; Kenney's logo is reserved. [verified] | CLEAR (CC0). See 2.3. |
| ambientCG https://docs.ambientcg.com/license/ | Everything including previews is CC0 1.0, commercial use allowed, attribution optional, redistribution allowed. [verified] | CLEAR (CC0). |
| Poly Haven https://polyhaven.com/license | HDRIs, textures, models are CC0; commercial use, no attribution, redistribution allowed. Site content (logos, example renders, text) is NOT CC0; scraping needs permission. [verified] | CLEAR (CC0). |
| Resource Boy, Rocketstock, Vashi Visuals roundup, Pixel Surplus, Spoongraphics, Free for Video | free downloads under each site's own terms; a roundup says "as far as the author could tell" commercial use is allowed [secondary]; some need e-mail sign-up | REFUSE as vendor sources (no verifiable licence text; some demand sign-up). |
| Freepik/Magnific "free" overlays | free tier usually requires attribution [secondary] | REFUSE. |

### 2.2 CC0 texture and plate sources (what we would get)

| asset | URL | licence | size and count | use for us |
|---|---|---|---|---|
| ambientCG Materials | https://ambientcg.com (API https://ambientcg.com/api/v2/full_json) | CC0 | 2,015 materials, 61 atlases, 433 HDRIs, 127 decals, 5 brushes (counted via the public API in this run). Example: `Paper006` 1K-JPG zip = 4.75 MB, 2K-JPG = 17.9 MB. | Paper, cardboard, fabric, concrete, plaster, leather plates for the `paper` and `texture` layers; displacement/roughness maps give real surface relief. Our `layers/overlay.js` `paper` is procedural; real plates are a quality upgrade for print/collage looks. |
| ambientCG Decals | same | CC0 | 127 | scratches, stains, tape, stickers; alpha-ready. |
| Poly Haven HDRIs | https://polyhaven.com/hdris | CC0 | 997 HDRIs, 868 textures, 521 models (API count in this run); 12 categories incl. Studio | Lighting and reflections for the three.js kit (real studio HDRIs for the product/box plates). 1K HDRI files are small; 4K+ are large (not verified per file). |
| Kenney Particle Pack | https://kenney.nl/assets/particle-pack | CC0 | 80 files listed, size not stated | 2D sprite sheets for sparks, smoke puffs, flares, stars; deterministic particle layers. |
| Unsplash photos | https://unsplash.com | Unsplash licence | per image | bokeh and blurred-light photo plates for the `bokeh` layer. |

### 2.3 Captured motion overlays (light leaks, grain, dust, flares, bokeh) from Pexels/Pixabay

- Pexels returns 150.8K results for "light leak" (search page, this run) but most are unrelated; resolution filter offers 1080p, 4K, 8K.
  Each clip is an H.264 MP4 in the tens of MB at 4K.
- Use only as "screen"-blend plates (black background). HyperFrames can play `<video>`; whether `mix-blend-mode: screen` on a video
  survives the frame-capture render needs one test before we commit [unverified here].
- Verdict: ATTRIB-free and commercially usable, but INTERNAL. Not fetched by this repo; if you use a clip, record its filename, URL and date.
- Why we may not need them: `layers/` already has procedural leaks (screen), dust, bokeh, grain stocks (film35, film16, super8, vhs), scanlines
  and glitch, deterministic and seek-safe. Captured plates are not deterministic across re-edits only if retimed. They are not required.

### 2.4 Things that look free but are not safe

- Internet Archive "film dust/scratch" uploads: licences vary per item [general knowledge, not fetched]: REFUSE unless the item page shows CC0/public domain.
- Wikimedia Commons: per-file licences (CC0 exists but also CC-BY-SA): check file by file.
- NASA media: generally not copyrighted but logos/insignia restricted [general knowledge, not fetched]: only if we need space footage.

---------------------------------------------------------------------------------------------------------------------

## 3. Emoji for animation

| set | URL | licence | size | verdict |
|---|---|---|---|---|
| **Fluent Emoji** | https://github.com/microsoft/fluentui-emoji | **MIT**, Copyright Microsoft Corporation [verified: raw LICENSE + GitHub API] | repo 136 MB. Per emoji folder: `3D/*.png`, `Color/*.svg`, `Flat/*.svg`, `High Contrast/*.svg`. Example `Rocket`: 3D PNG 36 KB, Flat SVG 2.4 KB [verified: contents API]. About 1,500 emoji (one source says 1,538; some are excluded for trademark reasons) [secondary]. No animated files in the official repo [unverified; third-party "animated Fluent" packs are ripped from Emojipedia: REFUSE]. | **CLEAR.** Best choice. Vector Flat/Color SVG animates with GSAP in HyperFrames (pop, wobble, orbit, spring). 3D PNGs give a premium sticker look. Take a subset (about 200 emoji): Flat SVG about 0.5 MB, 3D PNG about 7 MB (`scripts/fetch-external.sh` fetches a subset outside git). |
| Noto Emoji (static) | https://github.com/googlefonts/noto-emoji | Fonts: **SIL OFL 1.1**. "Tools and most image resources" Apache-2.0. Flags in `third_party/region-flags` public domain/exempt [verified: README] | repo 1.5 GB (do not clone); PNG sizes 32/72/128/512 and SVGs inside | CLEAR for PNG/SVG, keep notices. Android-style look. |
| Noto Animated Emoji (Lottie/GIF/WebP) | https://googlefonts.github.io/noto-emoji-animation/ | **CC BY 4.0** per the `animated_emoji` package page [secondary: https://pub.dev/packages/animated_emoji]. Google's own page and its repo could not be read for the licence line. | Lottie JSON files, small each (about 180 designs in the first set) [secondary: Emojipedia via search] | **ATTRIB / unverified at source.** Only use after confirming the licence line on Google's page and agreeing to a credit line. Lottie plays through the HyperFrames Lottie adapter. |
| Twemoji (maintained fork) | https://github.com/jdecked/twemoji | Code MIT; **graphics CC BY 4.0** (`LICENSE-GRAPHICS` is the CC BY 4.0 text) [verified] | repo 841 MB; SVGs are small | **ATTRIB.** Credit line required; fine if we accept credits. Prefer Fluent. |
| OpenMoji | https://github.com/hfg-gmuend/openmoji | **CC BY-SA 4.0** [verified: GitHub API] | 1.6 GB | **REFUSE** (share-alike would bind our derived artwork). |
| Apple Color Emoji | system font | Apple licence, not for redistribution in videos | | **REFUSE.** |
| JoyPixels, EmojiOne (current) | | commercial licence required [general knowledge, not fetched] | | REFUSE. |

Credit-line example for any ATTRIB item: "Emoji: Twemoji (c) Twitter/jdecked, CC BY 4.0" in the video description or end card.

---------------------------------------------------------------------------------------------------------------------

## 4. Lottie and vector animation

| source | licence | verdict |
|---|---|---|
| lottie-web https://github.com/airbnb/lottie-web | MIT [verified: API] | Player. HyperFrames already has a Lottie runtime adapter (per `docs/research/visual.md` section 1.1). No new download needed. |
| dotLottie web player https://github.com/LottieFiles/dotlottie-web | MIT [verified: API] | Player only. Not needed. |
| Rive wasm runtime https://github.com/rive-app/rive-wasm | MIT [verified: API] | Runtime only. Community `.riv` files carry per-file licences. Skip. |
| LottieFiles free animations https://help.lottiefiles.com/animation-licensing-basics- | "Lottie Simple License": free commercial use, attribution encouraged not mandatory; cannot resell/redistribute the original files stand-alone, cannot compile to build a competing service; creators can add their own notes; premium differs [secondary: search summary of help pages, not read in full] | **INTERNAL, per-animation check.** Not vendorable into our pack. Low yield, so skip. |
| Noto animated emoji | see section 3 | ATTRIB, unverified at source. |
| Lordicon, IconScout, Flaticon animated | free tiers need attribution or forbid redistribution [general knowledge, not fetched] | REFUSE. |
| `pqoqubbw/icons` animated icons https://github.com/pqoqubbw/icons | MIT [verified: API], built for React with a motion library | CLEAR licence, but React/motion timing is not `t`-driven, so not seek-safe as is. Use only as design reference. |
| Lucide, Phosphor, Tabler SVG paths | see section 5 | Better route: animate the SVG paths ourselves (stroke-dashoffset draw-on, morph) in GSAP. |

Recommendation: no Lottie vendoring. If we want Lottie output, export our own GSAP/SVG scenes later; players are already available.

---------------------------------------------------------------------------------------------------------------------

## 5. Icon sets

| set | URL | licence (verified via GitHub licence data and LICENSE/lucide.dev) | size | notes |
|---|---|---|---|---|
| **Lucide** | https://github.com/lucide-icons/lucide ; https://lucide.dev/license | **ISC** (Copyright 2026 Lucide Icons and Contributors) plus **MIT for 115 Feather-derived icons** (Copyright Cole Bemis). Keep both notices. | repo 28 MB; each SVG about 0.3 KB | Stroke icons, ideal for draw-on animation. |
| **Phosphor** | https://github.com/phosphor-icons/core | **MIT** | repo 6.5 MB; 6 weights per icon: bold, duotone, fill, light, regular, thin [verified: contents API] | Best range of weights; duotone for stickers. |
| **Tabler** | https://github.com/tabler/tabler-icons | **MIT** | repo 1.1 GB (do not clone; fetch only needed SVGs or the npm package) | Large set, stroke. |
| Iconoir | https://github.com/iconoir-icons/iconoir | MIT; 1,600+ icons [verified: API description] | 13 MB | Pleasant outline set. |
| Heroicons | https://github.com/tailwindlabs/heroicons | MIT | 2.6 MB | Small, UI-style. |
| **Simple Icons** | https://github.com/simple-icons/simple-icons | **CC0-1.0** for the SVG files [verified: API]; the brands' trademarks remain theirs | 69 MB | Brand logos (for showing real app integrations). CC0 is the file licence only; using a logo to show a real product is nominative use, not endorsement. Do not alter logos. |
| Remix Icon | https://github.com/Remix-Design/RemixIcon | GitHub reports NOASSERTION [verified]; project says Apache-2.0 [general knowledge, not fetched] | 35 MB | Check LICENSE before use; low priority. |
| Font Awesome Free | | icons CC BY 4.0, fonts OFL, code MIT [general knowledge, not fetched] | | ATTRIB; skip. |

Pack integration: our `type/icons.js` already ships 15 owned vector icons plus a keyword map. A subset (about 150 icons from Lucide
and Phosphor, 20 KB), with both licence notices kept, gives captions and lower-thirds a real icon vocabulary; this repo fetches it with
`scripts/fetch-external.sh` into a folder outside git instead of vendoring it.

---------------------------------------------------------------------------------------------------------------------

## 6. LUTs

| candidate | licence evidence | verdict |
|---|---|---|
| EditorHub originals and "Surprise LUTs" https://editor-hub.com/assets/luts | Site states originals are CC0 (8 LUTs) and Surprise LUTs are generated on demand [secondary: aggregator page; no source repo, no licence file seen] | Unclear provenance. Not worth a download. We can generate the same kind of thing. |
| FreshLUTs https://freshluts.com | The home page states no licence, no count, no format [verified: page read]. The aggregator that calls it CC0 is not a primary source. | **REFUSE** (unclear). |
| Film-Luts https://github.com/YahiaAngelo/Film-Luts | Repo says MIT, "G'MIC Film Luts Collection" (186 MB), but the README says LUTs "might be subject to copyrights and trademarks of their respective owners", credits "the authors of the LUTs" without naming them, and does not state origin [verified: README + API] | **REFUSE.** The MIT notice covers the maintainer's code, not unnamed third-party LUTs; G'MIC's film CLUT collection is widely a mix of authors and licences. Also film-stock names are trademarks. |
| NativeEnhancer-FE https://github.com/Kriyos4/NativeEnhancer-FE | MIT; 263 LUTs "created in Photoshop with custom Lightroom presets"; aimed at ReShade game screenshots [secondary via search; MIT verified via API] | Licence is clean but the LUTs are Photoshop-made film emulations in unknown colour space; weak value. Skip. |
| slay LUTs https://github.com/slaycamera/luts | CC BY 4.0, 5 LUTs (Amber, Fade, Neon, Film, Portrait), 33x33x33 `.cube`, repo 3.4 MB. Required credit: "LUTs: slay (CC BY 4.0)" with link [verified] | **ATTRIB.** Small and tidy; only if we want credits. Optional. |
| Q-DDL 800+ LUTs https://www.cgchannel.com/2020/01/download-800-free-3d-luts/ | CC BY (Attribution) by Q-DDL, commercial use allowed; download via https://quickddl.net/free_color_luts/ with ad-shortener links [verified: article] | **ATTRIB**, large, ad-shortener download. Not recommended. |
| RocketStock 35, PremiumBeat 180+, Rocket Rooster, FilterGrade | Free, but "no redistribution / not in an app" per the aggregator and FilterGrade's owner statement [secondary] | **INTERNAL at best, REFUSE for the pack.** |
| Freevisuals Mega LUT pack https://www.freevisuals.net/item/mega-lut-pack | "commercial use, no attribution" claimed in prose, no licence named [secondary] | REFUSE (unclear). |
| OpenColorIO-Config-ACES https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES | **BSD-3-Clause**, 946 KB [verified: API] | CLEAR. Technical colour-space transforms (not creative looks). Useful reference to validate our log/709 maths; low priority. |
| Khronos PBR Neutral tone mapper https://github.com/KhronosGroup/ToneMapping | **Apache-2.0**, 1.8 MB [verified: API] | CLEAR. A neutral highlight roll-off for product plates; a ~20-line formula we could write ourselves. |
| RawTherapee film simulation, Pat David / G'MIC colour CLUTs | CC BY-SA 4.0 or mixed [general knowledge, not fetched] | **REFUSE** (share-alike or mixed). |

Conclusion: no downloaded LUT pack beats a parametric one. `layers/grade.js` is a closed-form grade (gain/WB, logistic contrast, ASC CDL,
saturation, split-tone, fade) with a `.cube` emitter and measured accuracy (ffmpeg `lut3d` max 1.34 levels). We add looks as presets:
section 9.

---------------------------------------------------------------------------------------------------------------------

## 7. Download candidates (licence facts)

| # | candidate | URL | licence | size | notes |
|---|---|---|---|---|---|
| 1 | 30 curated gl-transitions shaders (single `.glsl` files) | https://github.com/gl-transitions/gl-transitions/tree/master/transitions | MIT (BSD for 2 skipped) | about 35 KB | 30 extra transitions with headers kept. Not fetched by this repo (own versions instead, section 9). |
| 2 | Fluent Emoji subset (about 200 emoji, Flat SVG + 3D PNG) | https://github.com/microsoft/fluentui-emoji/tree/main/assets | MIT | about 0.5 MB SVG + 7 MB PNG | animatable sticker/emoji set. Fetched by `scripts/fetch-external.sh` (outside git). |
| 3 | Phosphor + Lucide icon subset (about 150 icons) | https://github.com/phosphor-icons/core , https://github.com/lucide-icons/lucide | MIT / ISC (+MIT) | under 100 KB | icon vocabulary for captions and lower-thirds. Fetched by `scripts/fetch-external.sh` (outside git). |
| 4 | Simple Icons subset (about 60 brand logos) | https://github.com/simple-icons/simple-icons | CC0 | under 100 KB | real-app logos for explainers. Not fetched by this repo. |
| 5 | ambientCG paper/cardboard/concrete 1K JPG zips (about 8 materials) | https://ambientcg.com | CC0 | about 5 MB each (Paper006 1K = 4.75 MB) so about 40 MB | real surface plates for paper/collage looks. Not fetched by this repo. |
| 6 | ambientCG decals (about 20) | https://ambientcg.com | CC0 | a few MB | tape, stains, scratches. Not fetched by this repo. |
| 7 | Kenney Particle Pack | https://kenney.nl/assets/particle-pack | CC0 | not stated (small) | spark, smoke, flare sprites. Not fetched by this repo. |
| 8 | Poly Haven studio HDRIs (3 at 1K) | https://polyhaven.com/hdris | CC0 | not verified, likely a few MB each | real lighting for 3D plates. Not fetched by this repo. |
| 9 | Noto animated emoji (Lottie, about 30) | https://googlefonts.github.io/noto-emoji-animation/ | CC BY 4.0 (secondary; confirm) | small | animated reactions; needs a credit line. Not fetched by this repo. |
| 10 | 6 light-leak and 4 dust/grain clips from Pexels or Pixabay (1080p) | https://www.pexels.com / https://pixabay.com | site licence, not CC0 | roughly 10 to 40 MB each | real captured leaks and grain (optional). Not redistributable; not fetched by this repo. |

Not recommended: any LUT pack, LottieFiles, Mixkit (terms unreadable), Twemoji/OpenMoji, Shadertoy/LYGIA.

---------------------------------------------------------------------------------------------------------------------

## 8. Fit with what the pack already owns

- 23 transitions, 4 back-ends (WebGL, DOM 13 of them, three.js, HyperFrames). The DOM templates still hard-cut. Imported gl-transitions
  would be GL-only, which is fine for plate-based and three.js work.
- `layers/` already has finisher + overlay (grain, vignette, leaks, dust, bokeh, glow, paper, scanlines), 8 genre grades + neutral,
  7 grain stocks, `.cube` export.
- `type/icons.js` owns 15 stickers with a keyword map; `objects/` owns the character and 26 props.
- No current gap needs an outside asset to function. Outside assets only raise realism (real paper, real grain) and breadth (emoji, icons).

---------------------------------------------------------------------------------------------------------------------

## 9. Build in-house now (no download, no licence issue)

Transitions (GLSL, own code, aliasing the gl-transitions vocabulary): ripple, swirl, crosswarp, directional warp, cube turn, doorway,
kaleidoscope, hexagonalize, window slice / blinds, squeeze, polka-dots curtain, TV static / lost-signal, undulating burn, tangent motion blur,
dreamy zoom, linear blur, defocus blur, grid flip, book flip, fold, pinwheel, radial wipe, star wipe, water drop, wind, datamosh strip,
luminance melt, overexposure. Plus an `xfade` map (58 modes) for the ffmpeg path and a DOM fallback (clip-path/mask versions) so DOM templates stop hard-cutting.

Overlays and effects (procedural, deterministic, seek-safe): anamorphic lens flare (streak + ghosts + starburst), lens dirt, rain on glass,
fog/haze, god rays, smoke puffs, sparks/embers, confetti, snow, dust motes, film burn variants, hair/scratch variants, gate-edge and sprocket
frame, Polaroid/Instax frame, halftone/comic dots, speed lines, impact frames, radial/zoom blur, ripple distortion, shake, heat haze,
RGB split bursts, timecode/REC HUD, CRT/VHS timecode.

Textures: procedural paper (fold, crumple, torn-edge mask), cardboard, canvas, cloth weave, concrete, brushed metal, noise/displacement maps
for transitions.

Stickers and emoji: expand `type/icons.js` from 15 to about 100 original vector stickers (reaction faces, arrows, underline scribbles,
brackets, burst frames, speech bubbles, check/cross, ticker tape, price tags) with pop/bounce/shake/orbit motions; no external licence.

Icons: path draw-on engine for any SVG (stroke-dashoffset, trim), so fetched Lucide/Phosphor SVGs animate for free.

LUT-style looks: 40+ new parametric presets emitted to GLSL, SVG and `.cube`, with neutral names (no film-stock trademarks): bleach bypass,
cross-process, day-for-night, teal-orange, two-strip, cyanotype, sepia, B&W with red/green/blue filter, faded 90s, matte cool,
golden hour, overcast, neon night, pastel, high-key beauty, kodachrome-style, tobacco-wash. A looks contact-sheet script (reuse the pack's
`sheet.py`) and a log-to-709 conversion pair written from published formulae.

Camera/composition layers that need no assets: 2.5D parallax stack, luma and shape mattes, speed ramp curve presets, freeze-frame with
stroke, zoom-blur whip, Dutch-angle roll presets.

---------------------------------------------------------------------------------------------------------------------

## 10. Sources (all read in this run unless tagged)

- https://github.com/gl-transitions/gl-transitions ; raw LICENSE https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/LICENSE ; README and CONTRIBUTING (licence rule); contents API listing and per-file headers
- https://www.pexels.com/license/ ; https://www.pexels.com/search/videos/light%20leak/
- https://pixabay.com/service/license-summary/
- https://unsplash.com/license
- https://mixkit.co/license/ (terms not readable)
- https://kenney.nl/support ; https://kenney.nl/assets/particle-pack
- https://docs.ambientcg.com/license/ ; https://ambientcg.com/api/v2/full_json (counts and sizes)
- https://polyhaven.com/license ; https://polyhaven.com/hdris ; https://api.polyhaven.com/assets (counts)
- https://github.com/microsoft/fluentui-emoji (+ raw LICENSE, contents API)
- https://raw.githubusercontent.com/googlefonts/noto-emoji/main/README.md ; https://googlefonts.github.io/noto-emoji-animation/ ; https://pub.dev/packages/animated_emoji
- https://github.com/jdecked/twemoji (LICENSE-GRAPHICS) ; https://github.com/hfg-gmuend/openmoji (GitHub licence field)
- https://help.lottiefiles.com/animation-licensing-basics- (via search summary)
- https://lucide.dev/license ; https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE ; https://github.com/phosphor-icons/core ; https://github.com/tabler/tabler-icons ; https://github.com/iconoir-icons/iconoir ; https://github.com/simple-icons/simple-icons (GitHub licence fields)
- https://editor-hub.com/assets/luts ; https://freshluts.com ; https://github.com/slaycamera/luts ; https://github.com/YahiaAngelo/Film-Luts ; https://www.cgchannel.com/2020/01/download-800-free-3d-luts/ ; https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES ; https://github.com/KhronosGroup/ToneMapping
- ffmpeg 8.0.1: `ffmpeg -h filter=xfade`

Open items: whether CC-BY credit lines are acceptable is a per-project choice; confirm the Noto animated licence on Google's page before use.
