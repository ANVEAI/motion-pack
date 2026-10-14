# type: kinetic typography, captions, icons, safe zones

State is a pure function `f(preset, params, unit, t)`: no DOM, no clock. Two renderers share the numbers: `render-canvas.js` (2D canvas / three.js overlay) and `dom.js` (DOM spans baked to GSAP with one `tl.set` per changed frame, or driven from `hf-seek`).

| Piece | File | Notes | Tags |
|---|---|---|---|
| `maskRise` | presets.js | words rise 0.6 em inside a line mask, 14 f, stagger 4 f, E.hero | headline, premium, ad |
| `charRise` | | char version, stagger 2 f | short title |
| `wordStagger`, `charStagger` | | opacity + rise + blur, stagger 3 f / 1.5 f | subhead, playful |
| `blurIn` | | line blur 24 px to 0, 18 f | cinematic, end card |
| `scaleSlam` | | 1.35 to 1.00 in 6 f, 8 px shake decaying over 4 f, blur first 2 f, one word per beat (15 f) | hype, hook, CTA |
| `typewriter` | | 2 f per char, +6 f after `. , ? !`, caret blinks 15 f | terminal, tech |
| `trackingCollapse`, `weightMorph`, `wipe`, `flipSplit`, `elasticPop`, `scramble`, `glitchSplit` | | premium title card, variable-font emphasis, broadcast wipe, 3D flip, spring (zeta 0.38 = 27% overshoot, 0.7 = 4.6%), decode, RGB split on hits | |
| `outlineFill` | presets.js | each word (or line: `unit: 'line'`) fades in as an outline (stroke 0.022 em, `params.stroke`) over 7 f, holds as an outline to f 15, fills solid f 15-27 (E.move) while the stroke thins away; stagger 5 f; settles as the plain solid glyph. Exit drains the fill, then fades the outline. DOM: `--mp-fill` / `--mp-stroke` CSS variables per unit (`-webkit-text-fill-color: color-mix(...)`, `-webkit-text-stroke`), canvas: fill alpha + `strokeText`. Demo `demo/out/presets-outline.jpg` | headline, reveal, manifesto |
| highlight-bar super | render-canvas.js `highlight: [wordIdx]` | highlighter bar sweeps behind chosen words in 10 f | emphasis |
| Captions | captions.js | `chunkWords` (2-4 words, breaks at sentence ends and gaps), `captionFrame`; styles `karaoke`, `impact`, `emphasis`, `pill`, `clean` | talking head |
| Emoji pops | icons.js | 15 owned vector icons (burst, star, spark, heart, flame, bolt, thumb, play, speech, tag, check, cross, arrow, wave, zigzag, bracket) + keyword map, pop 8 f | sticker |
| Safe zones | safezones.js | `SAFE` per platform, `safeRect`, `captionBox`, `lintRect`, `lintCaptionStyle` | 9:16, 16:9 |

Rules baked in (`lintType`, `lintPiece`, `lintCaptions`): fully formed hold >= 9 f, <= 3.5 words/s, hold = max(0.5 s, 0.35 + 0.28 s per word), exits 30% faster than entrances, at most two tone families per piece, captions 64-80 px (9:16), <= 2 lines, <= 18 chars per line, active word is exactly the spoken word.

```js
import { drawType, drawCaptions } from './type/render-canvas.js';
drawType(g, { preset: 'maskRise', text: 'Voice that sells', at: 0.2, out: 2.6, font: { size: 124 }, anchor: { x: 0.1, y: 0.25 }, highlight: [1] }, t, { W, H });
const chunks = chunkWords(transcriptWords);                       // Whisper-style [{word,start,end}] works as is
drawCaptions(g, chunks, t, CAPTION_STYLES.karaoke, { W, H, platform: 'conservative' });
// HyperFrames: m = mountType(el, spec); bakeType(tl, m, spec, {dur}); cm = mountCaptions(el, chunks, style, {W,H}); bakeCaptions(tl, cm, chunks, {dur})
```

## Expansion (2026-10-13): editor-staple graphics (`gfx/`), 56 owned stickers, layouts, draw-on

`gfx/index.js`: `renderSVG(id, t, {at, dur, params}, {W, H, platform})` -> full-frame SVG string; `mountGfx(root, items)` + `bindHF()` for HyperFrames. Every item has an entrance / hold / exit (`gfx/core.js life()`), sits inside the platform safe rect, and is a pure function of t. `GFX_SFX` / `sfxFor(id)` give each one a default sound by id.

| Family | Ids | File |
|---|---|---|
| Lower thirds | `lowerThird.cleanBar`, `.boldBlock`, `.accentRule`, `.softPill`, `.newsBar` (ticker), `.neonBorder` | `gfx/editorial.js` |
| Counters | `counter.countUp`, `.wheel` (odometer), `.statCard`, `.ring`, `.priceSlash` | `gfx/editorial.js` |
| Titles / HUD | `title.chapterCard`, `.slate` (clapper), `.timecodeHUD`, `.letterboxRamp`, `.progressBar`, `.countdown321`, `.recDot` | `gfx/editorial.js` |
| Call-outs | `callout.scribbleCircle`, `.handArrow`, `.underline`, `.bracket`, `.pinLeader`, `.spotlight` | `gfx/callouts.js` |
| Mime-style emotion marks | `fx.emotion.sweat`, `.vein`, `.heartBurst`, `.question`, `.exclaim`, `.dizzy`, `.sparkle`, `.zzz`, `.bulb` | `gfx/callouts.js` |
| Comic impact | `fx.impact.onomatopoeia`, `.speedLines`, `.dustPoof`, `.star`, `.smear` | `gfx/callouts.js` |
| Social (generic, no platform trade dress) | `social.followButton`, `.replyBubble`, `.testimonial` (marked PLACEHOLDER COPY), `.notification`, `.typing`, `.chatBubbles` | `gfx/social.js` |
| Devices | `device.phone` (taps, scroll), `device.laptop` (cursor path, click ripples) | `gfx/social.js` |
| Captions | `caption.meme`, `.replyCard`, `.cinematic`, `.bilingual`, `.oneWordSlam` | `gfx/social.js` |
| Charts + map | `chart.bar`, `.line`, `.donut`, `.race`, `map.route` (abstract map, no tiles; every chart carries a `source` line) | `gfx/social.js` |
| Stickers + reactions | `sticker.place` (56 owned stickers: 12 faces + 44 objects incl. diya, rangoli, kite, chai), `reaction.place`, `reaction.burst`; motions popBounce, wiggle, float, shake, orbit, spin, pulse, rise | `gfx/stickers.js` |
| Doc parody (2026-10-14) | `lowerThird.docSuper` (NAME in condensed caps + role, top-left, soft scrim, deadpan cut-on), `caption.subtitleSpeedGag` (subtitle line, then a generic 0.25 / 0.5 / 0.75 / Normal speed menu pops up, a cursor picks, the line re-reads) | `gfx/doc.js` |
| Card systems (canvas, 2026-10-14) | `layout.cardStack` (fanned stack that riffles: cards flip back -> front one after another and land on top; inline in a sentence or centred), `layout.cardRiver` (diagonal streams, seeded layout, `keepOut` rects so words sit still in the gap, exact multi-sample motion blur), `layout.evidenceBoard` (cork board, pinned photo / paper slots, red string drawn on between the pins, sticky-note title, camera push). `mountCards` / `mountBoard` -> `{ render(t) }`; pure state `cardsAt` / `boardAt`; `placeholderCards(n, seed)` = procedural pictures | `gfx/cards.js`, `gfx/board.js` |
| Corner pin (DOM, 2026-10-14) | `layout.cornerPin`: a 4-point warp of any element (image, UI card, logo, `<video>`) onto a quad; static `corners` or keyframed `keys` (one key per frame for tracked footage or corners exported from a 3D scene); `homography`, `matrix3d`, `cornersAt`, `lintQuad`, canvas `drawQuad` (grid of affine triangles), `mountPin` | `gfx/cornerpin.js` |
| Layouts (DOM shots) | `layout.splitScreen` (vertical / horizontal / diagonal / 3up / grid), `layout.pip`, `layout.beforeAfter`, `layout.freezeFrame` | `gfx/layout.js` |
| UI kit (generic product UI, own layout, no trade dress) | `ui.agentActivity` (agent steps + map card), `ui.promptBar` (typed prompt, cursor click on send), `ui.checklist` (spinner -> check + progress), `ui.nodeGraph` (workflow cards, elbow connectors, camera pan; `nodeGraphCam` for a DOM wrapper), `ui.scanOverlay` (brackets lock, mask sweep, status), `ui.isometricTilt` (flat -> isometric and back, floor shadow; wraps any gfx via `inner`; `isoTiltCss` for DOM), `ui.stateMorph` (one container through many states, cursor clicks, loops) | `gfx/ui.js` |
| Draw-on engine | `prepareDrawOn`, `drawOnAt`, `trimAt`, `bindDrawOn`: stroke-dashoffset, seek-safe, works on licensed icon SVGs (Lucide / Phosphor / Fluent after the ORIGIN check) | `gfx/drawon.js` |

Reaction glyphs are placeholders by design: `setGlyphSource(fn)` swaps in a licensed emoji set, for example the Fluent Emoji subset fetched by `scripts/fetch-external.sh` (Apple Color Emoji is not licensed for this use). Candidates read on 2026-10-13 (not downloaded): Noto Emoji (github.com/googlefonts/noto-emoji: README states images under Apache-2.0, font under OFL 1.1, flags separately licensed) and Fluent Emoji (github.com/microsoft/fluentui-emoji: repository licence MIT; the page does not say the licence covers the assets specifically, so confirm before use). Fetched sets arrive with an ORIGIN.txt and pinned checksums; see THIRD_PARTY.md. Card systems, corner-pin maths, the board, doc supers and the flash budget: `node tests/cards.test.mjs` (node maths + a Chrome seek-stability pass; sheet `demo/out/cards.jpg`). Demos: `demo/out/gfx-*.jpg`, `demo/out/gfx-sticker-grid.jpg`; test: `node tests/gfx-sheet.mjs` (every id non-empty at its hero time, empty before its start, identical when rendered twice, no page errors).
Honest limits: text widths are estimated (no DOM measurement), so very long names can overrun a box (check the sheet); Devanagari in `caption.bilingual` falls back to a system font; charts and the testimonial ship with placeholder data / copy.

## UI kit and closed-form springs (2026-10-14)

**Where it lives and why.** The UI kit is the `ui.*` family in `gfx/ui.js`, registered in the same `GFX` registry as `device.*` and `callout.*`. It follows the gfx contract exactly (`svg(L, p, ctx)` -> SVG markup, `life()` entrance / hold / exit, params merged over defaults, `sfxFor(id)`), so `renderSVG`, `mountGfx` + `bindHF`, the gfx demo page and `tests/gfx-sheet.mjs` work on it unchanged. A new top-level module was not needed: the pieces are 2D overlay graphics like the other families, and a module of their own would have duplicated the registry, the safe-zone context and the sheet harness. The motivation is a study of recent product launch films and a published one-prompt motion method (October 2026): agent-at-work lists, self-drawing workflows, prompt-to-result beats, scan overlays, isometric UI and the single morphing container. We took the techniques only, never any brand, footage, copy or sequence.

**Springs** live in `ease.js` (identical copy in `layers/` and `camera/`): `spring(tau, cls)`, `springSettle(cls, eps)`, `springTrack(t, changes, cls)` with `v(t) = v0 + sum_i (v_i - v_{i-1}) * spring(t - t_i)`. A retarget mid-flight keeps the motion running, and the value at t never depends on which t was evaluated before. Values may be numbers or arrays (`[x, y]`, RGB).

| class | zeta | f (Hz) | overshoot | settles to 1% | use |
|---|---|---|---|---|---|
| `ui` | 0.82 | 3.2 | 1.1% | 0.31 s | buttons, presses, chips, small snaps |
| `panel` | 0.9 | 1.6 | 0.15% | 0.60 s | cards, lists, sizes, cursor glides |
| `camera` | 1.0 | 0.9 | none (critically damped) | 1.17 s | pans and pushes |
| `headline` | 0.6 | 4.0 | 9.5% | 0.32 s | big type and check badges that land hard |
| `mascot` | 0.35 | 2.2 | 31% | 0.97 s | characters and playful bounces |

**Every ui item** takes `scale` (multiplies the size unit; real UI is small on a 16:9 frame, 1.3-1.6 reads on a phone), `theme` (`light` / `dark`) and `accent`. **Sound:** `uiCues(id, { at, params })` returns one cue per UI action (keystroke bursts, clicks, ticks, lock-on, sweep, morphs) with sibling sounds round-robined so the mixer's repeat lint stays clean; feed the list into the plan's cue sheet. **Honesty:** the map card and the chart state print a `source` / "(illustrative)" label; replace the placeholder data and cite before real use.

Measured (`tests/ui.test.mjs`, 45 checks, node only, runs in CI): every class gives the same value in forward and shuffled seek order, settles to 0.1% of the span and stays, is continuous through each retarget; overshoot ui 1.11%, panel 0.15%, camera 0, headline 9.5%, mascot 30.9%; all 7 ids render, are empty before `at`, give identical SVG in shuffled seek order and contain no NaN over [-1, 12] s; `scale` grows the type; every cue resolves to a real sfx id; `nodeGraphCam` glides (max 10.9 px/frame); `isoTiltCss` returns flat; `ui.stateMorph` with `loop: true` renders the same frame at the end as at frame 0. Sheet: `demo/out/gfx-ui.jpg`. Demo film: `templates/demo-ui-kit/`.

Honest limits: text widths are estimated (no DOM measurement), so very long chip or card labels can overrun (check the sheet); `ui.isometricTilt` is affine (isometric, no perspective foreshortening) in SVG, while `isoTiltCss` gives true perspective for DOM panels; the colour morph interpolates in RGB, so blue -> green passes through teal for a few frames.

## Expansion (2026-10-14): sentence-led kinetic pieces and field layouts (`gfx/kinetic.js`, `gfx/collage.js`, `gfx/media.js`)

Same gfx contract (pure SVG from `t`, `renderSVG` / `mountGfx` + `hf-seek`). Word and letter positions come from `measure()` (canvas `measureText` in the browser, an estimate in node), so reflow follows the real font. The `type.*` ids also resolve as `type/<name>` (`tools/check_ids.py`, and the template type adapter `templates/_shared/adapters/type.mjs`). Craft learned from public launch films; no reference wording, brand, footage or sequence is reproduced.

| Id | What | Key params | Default sound |
|---|---|---|---|
| `type.wordWheel` | vertical list scrolls; active word bold and opaque, neighbours fade by distance | `words`, `steps: [[t, index], ...]`, `move`, `prefix`, `rows`, `falloff` | `sfx/ui/tick` per step |
| `type.inlineMedia` | a sentence with image / card-stack slots that open and reflow the words; words build one by one; the stack riffles | `text` (`[photo]`, `[stack]`, `*pill*`, `\|` line break), `media: [{href} \| {svg} \| {cards: [...]}]`, `riffle`, `reflow` | `sfx/ui/pop` |
| `type.letterAssemble` | letters scattered with small coloured dots converge into a word; dots line up beside it, then vanish | `text`, `spread`, `hold0`, `fly`, `dots`, `dotColors`, `seed` | `sfx/whoosh/magic_swirl` |
| `type.glyphMorphCursor` | monospace typing; the caret morphs caret -> circle -> square -> triangle -> your mark | `text`, `charRate`, `shapes`, `mark` (SVG path, 100 box; default: an owned spark), `glyph` | `sfx/ui/typing_burst` |
| `type.marquee` | giant monospace full-bleed horizontal scroll; one word in an accent colour or an owned 5x7 pixel face | `text`, `accent`, `accentStyle: 'color' \| 'pixel'`, `size` (x H), `speed` (x W / s), `dir`, `bg` | `sfx/whoosh/swish_s` |
| `type.bleedWord` | oversized word cropped by the frame edges, sliding | `text`, `size` (x H), `from` / `to` ([x, baseline] fractions) | `sfx/whoosh/whip_pan` |
| `layout.scatterCollage` | a centred sentence builds, then explodes into a seeded field of words, stickers, small photos, numbered dots and a hand-drawn arrow, and settles | `text`, `explodeAt`, `fly`, `stickers`, `photos`, `dots`, `arrow`, `media`, `cols` x `rows`, `seed` | `sfx/whoosh/whoosh_m` at the explosion |
| `layout.mosaicBurst` | dozens of thumbnails burst from the centre into a grid, staggered by distance | `cols`, `rows`, `fly`, `spread`, `media`, `kinds`, `seed` | `sfx/whoosh/whoosh_l` |
| `layout.logoWall` | headline plus a grid of logo SLOTS fading in with a seeded stagger | `headline`, `source`, `logos: [{svg} \| {href}]`, `cols`, `rows`, `placeholderNote` | `sfx/ui/pop` |
| `layout.orbitRing` | centred phrase, concentric rings that draw on, icon slots that spiral in and orbit | `text`, `rings`, `speed` (deg/s per ring), `icons: [{name \| svg \| href, label, ring, angle}]` | `sfx/whoosh/swish_s` |
| `callout.connectorLabel` | small tinted tags with elbow connectors that draw on, chained A -> B -> C, over a light grid | `items: [{label, at, tint, ink}]`, `origin`, `step`, `draw`, `grid`, `paper` | `sfx/ui/slide` |

Placeholders (`gfx/media.js`): `photoTile` (seeded abstract art: landscape, shape blocks, a UI card), `MARKS` + `placeholderLogo` (generic geometric marks labelled `LOGO nn`, with a `PLACEHOLDER LOGOS` note), `DEFAULT_MARK`. Never ship third-party logos or real people in a slot without the rights; a digit in a logo-wall headline needs a `source`. Demo sheets: `demo/out/gfx-kinetic.jpg`, `demo/out/gfx-collage.jpg`; worked example: `templates/demo-type-layout` (17.5 s, 8 parts, hard cuts on a 120 BPM grid).
Honest limits: `<image href>` slots re-render each frame, so preload real images (or hand HyperFrames a promise through `hf-seek` `waitUntil`) before a render; the node fallback of `measure()` is an estimate, so judge reflow in the browser; `glyphMorphCursor` morphs point sets for the built-in shapes and pops your mark in (an arbitrary logo path is not point-morphed); the pixel face covers A-Z, 0-9 and `. , - ! ? ' ·`.

## Measured (`tests/type.test.mjs`, 28 checks)
Determinism in any order for all 15 presets; every timing contract above asserted; captions (5 styles x 6 tall platforms x 70 times) never leave the safe zone; DOM bake under random-access seeks equals the pure function (deviation 0) for 8 presets (incl. the `--mp-fill` of `outlineFill`); `outlineFill` timing and its reading-time lint asserted; caption bake within 2%.

## Honest limits
Safe-zone numbers: the research sources conflict and none could be verified against a current official template. `conservative` is the union (top 269, bottom 672, left 65, right 120 px at 1080x1920); every platform row is flagged `verify: true`. `scramble` swaps glyph text: use the canvas renderer or `driveType`, not `bakeType`. Canvas has no 3D, so `flipSplit` is approximated by a vertical squash there (DOM uses real rotateX). Demos: `demo/out/presets1.jpg`, `presets2.jpg`, `captions.jpg`, `icons.png`.
