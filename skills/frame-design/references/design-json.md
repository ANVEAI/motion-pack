# design.json: schema and CONFIG mapping

One JSON object per video. motion-pack reads it when it fills a template's `CONFIG` block; spec-to-loop reads the accent, the display font and the look; social-video reads `frames.cover`. A complete passing example: `assets/design.example.json`.

## Fields

| field | type | rule |
|---|---|---|
| `version` | number | `1` |
| `for` | string | which `shotlist.json` this designs |
| `tone.cell` | string | `calm-soft`, `calm-sharp`, `kinetic-soft`, `kinetic-sharp`, `neutral` |
| `tone.why` | string | one line |
| `motion.personality` | string | one sentence |
| `motion.base_unit_frames` | number | the timing atom (e.g. 5 frames = a third of a beat at 120 BPM and 30 fps) |
| `motion.easing` | string | the family and where the exception lives ("soft for bodies, a pop only on the turn") |
| `motion.overshoot_max` | number | 0-1, e.g. 0.07 |
| `motion.hold_after_key_action_frames` | number | stillness after every key action |
| `motion.camera_still_on_impacts` | boolean | the camera does not move during a drop, snap or stamp |
| `motion.type_presets` | object | `headline`, `card`, `end`, `sub` → `type/<presetId>` ids from the type module |
| `palette` | object | role → `#RRGGBB`; roles: `paper`, `ink`, `accent`, `accent_ink`, `muted`, `success` (and other states), `character`, `scrim`, `caption` |
| `contrast.pairs` | array | `{ "fg": role or hex, "bg": role or hex, "use": "text" | "large" | "ui", "min"?: number }` |
| `contrast.checked_with` | string | `scripts/contrast.py` |
| `type.display`, `type.text`, `type.mono` | object | `{ family, weight, license, file }`; `license` must be an open licence (OFL-1.1 preferred) |
| `type.sizes_px_at_1080` | object | sizes at the 1080 reference (see `type-and-color.md`) |
| `type.max_words_per_line` | number | default 6 |
| `grid` | object | per aspect: margins, columns, gutter, baseline, where the hero sits |
| `safe.platform` | string | a key of `PLATFORMS` in `templates/_shared/plan.mjs` (`tiktok.organic`, `reels.organic`, `shorts.organic`, `yt.ad.15`, `yt.bumper.6`, `meta.ad.9x16`, `x.video`, `linkedin.video`, `hero.web`) |
| `safe.zones_9x16`, `safe.zones_16x9` | string | a key of `SAFE` in `type/safezones.js` (`conservative`, `tiktok`, `reels`, `shorts`, `ytAd`, `metaStory`, `wideTitle`, `wideAction`) |
| `look.grade` | string | a key of `GRADES` (`layers/presets/grades.js`) |
| `look.finish` | string | a key of `FINISH_PRESETS` (`layers/presets/finish.js`) |
| `look.lut` | string or null | `look.<name>` from `layers/looks/looks.json` |
| `look.grain` | string | a key of `STOCKS` (`layers/presets/stocks.js`) |
| `look.vignette` | number | 0-1 |
| `look.flash_max_per_s` | number | 3 (flash safety) |
| `frames.hero_by_shot` | object | shot id → the one hero of that frame |
| `frames.cover` | object | `{ subject, words, max_words, test_width_px }` |
| `frames.end_card` | object | `{ line, hold_s, fine_print }`; `*word*` marks the accent word (the ad and character-spot templates render it in the accent colour) |
| `frames.lower_third` | object or null | `{ gfx: "lowerThird.<style>", name, title }` (type module gfx ids) |
| `frames.labels` | object | `{ style, min_on_screen_s }` |
| `frames.world` | string | optional, e.g. `white` for the character-spot stage |
| `config_map` | object | template path → `{ CONFIG key: design.json field }`; only keys that exist in that template's `config.mjs` |

## The mapping, with the example's values

| CONFIG key | template | from design.json | example value |
|---|---|---|---|
| `world.mode` | character-spot | `frames.world` | `'white'` |
| `world.paper` | character-spot | `palette.paper` | `'#F3F2EF'` |
| `brand.accent` | character-spot, ad | `palette.accent` | `'#C2410C'` |
| `brand.mint` | character-spot | `palette.success` | `'#0F766E'` |
| `brand.line` | character-spot | `frames.end_card.line` | `'Every draft, *saved*.'` |
| `layout.color` | character-spot | `palette.character` | `'#8B82D2'` |
| `type.endLine` | character-spot | `motion.type_presets.end` | `'type/blurIn'` |
| `brand.ink`, `brand.paper` | ad | `palette.ink`, `palette.paper` | `'#141414'`, `'#F3F2EF'` |
| `brand.cta` | ad | `frames.end_card.line` (the ad's end card carries the CTA) | |
| `type.headline`, `type.card`, `type.end`, `type.sub` | ad | `motion.type_presets.*` | `'type/elasticPop'`, ... |
| `layers` | ad, talking-head, beat-edit | `look.grain`, `look.vignette` | `[{ kind: 'vignette', params: {} }, { kind: 'grain', params: { stock: 'digital-soft' } }]` |
| `layers` (string ids), `stage.grade.vignette` | film-scene | `look.grain`, `look.vignette` | `['layers/grain', 'layers/vignette']`, `0.12` |
| `platform` | ad, talking-head, beat-edit | `safe.platform` | `'yt.ad.15'` |
| `brand.accent`, `brand.ink`, `brand.paper`, `brand.muted` | proof-film | `palette.accent`, `palette.ink`, `palette.paper`, `palette.muted` | `'#4a18ed'`, `'#16151B'`, `'#F4F2EE'`, `'#5D5A66'` |
| `claim` (one `*accent*` word, at most 6 words), `end.line`, `brand.url` | proof-film | `frames.cover.words` (the claim), `frames.end_card.line`, `frames.end_card.fine_print` | `'Better answers, *lower* cost.'` |
| `layers` | proof-film | `look.grain` | `[{ kind: 'grain', params: { stock: 'digital-soft' } }]` |
| `captions.accent`, `captions.y`, `captions.maxWords`, `captions.maxChars` | talking-head | `palette.accent`, caption rules in `type` | `'#C2410C'`, `0.56`, `3`, `15` |
| `lowerThird.name`, `lowerThird.title`, `type.lowerThird` | talking-head | `frames.lower_third`, `motion.type_presets.sub` | |
| `type.word`, `type.title` | beat-edit | `motion.type_presets.headline`, `.card` | `'type/scaleSlam'`, `'type/maskRise'` |
| `layout.workerColor` | film-scene | `palette.character` | `'#8B82D2'` |

**No CONFIG key yet** (keep the value in `design.json`; motion-pack applies it elsewhere): the grade and finish names (layers module: `GRADES`, `FINISH_PRESETS`, `toSVGFilter`, `Finisher`), the LUT (`layers/looks/*.cube`), font families and weights (the files in `templates/_shared/fonts/`, staged by `compose.mjs`), the caption font size in the talking-head template (computed from the frame height), and the character-spot vignette (set in its `scene.html`). Do not invent keys; if a value must reach a template that has no key for it, say so in the hand-off note.

## Hand-off note (append to design.json's folder as design-notes.md, optional)

- Which template motion-pack should start from, and the filled `config_map` for it.
- The key frames and their heroes.
- Anything the template cannot express yet (see "No CONFIG key yet").
- The cover brief for social-video.
