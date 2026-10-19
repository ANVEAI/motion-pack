# Edit without code: from zero to a branded 16:9 + 9:16 video

This is a 10-minute path, plus render time, for a person who does not write code, and for any AI agent. You edit ONE file, `project.json`. The `mp` command does the rest:
- it copies the template;
- it applies your brand, copy and footage;
- it re-lays the video out for each aspect;
- it renders the MP4s;
- it measures what it delivered.

The steps below use the `ad` template. The same file also drives `proof-film` and every other genre template (`mp list`).

## 0. Once per machine (2 minutes)

```bash
cd ~/Developer/motion-pack            # the pack (keep it out of iCloud-synced folders such as ~/Documents)
ln -s "$PWD/tools/mp" ~/.local/bin/mp        # or call tools/mp by its path
python3 sfx/build_library.py                 # the sound effects (under a minute)
python3 music/build_music.py                 # the music beds (1-2 minutes)
mp doctor                                    # node, python, ffmpeg, Chrome on the GPU, puppeteer-core, sound libraries, disk
```

Every `FAIL` line from `mp doctor` prints the command that fixes it.

## 1. Make a project folder (30 seconds)

```bash
mp new ad ~/Movies/my-ad
cd ~/Movies/my-ad
```

The folder has three things:
- `project.json`: the one file you edit.
- `renders/`: your MP4s, their plans, contact sheets and check reports.
- `build/`: the machinery, which you never edit. It holds a copy-on-write copy of the template; the rest of the pack is linked, not copied, so it costs almost no disk.

To build two templates from the same brand, name both: `mp new ad,proof-film ~/Movies/my-launch`.

To start from a finished example, add `--project <file>`: `mp new ad,proof-film ~/Movies/fernwick --project ~/Developer/motion-pack/examples/project.example.json`.

## 2. Your brand (2 minutes)

```bash
mp brand ~/Desktop/logo.svg --write          # or a PNG
mp set brand.name "Fernwick"
mp set brand.url "fernwick.example"
mp set brand.cta "Try the demo"
```

`mp brand` reads the colours of your logo and suggests three:
- **accent**: the most colourful brand colour;
- **ink**: a near-black;
- **paper**: an off-white.

It measures each pair the way the frame-design skill does (WCAG contrast):
- ink on paper ≥ 4.5:1;
- accent on paper ≥ 3:1;
- white on the accent ≥ 3:1, for the button.

A logo colour that is too pale is moved to the nearest passing colour of the same hue. Your logo file is never changed. `--write` puts the colours and the logo into `project.json`.

## 3. Your words (2 minutes)

```bash
mp set text.headline "Every note, *found*."
mp set text.problem '["Notes everywhere.", "Answers *nowhere*."]'
mp set text.product "One search for *everything* you wrote."
```

- Put `*stars*` around the accent word.
- Keep a line to about 6 words; it has to read on a phone.
- `mp list ad` shows every field the ad uses and its current value.

**Numbers need a source.** A digit on screen (`"Saves 40% of your time"`) is refused until `claims` has the same line with a real source:

```json
"claims": [{ "text": "Saves 40% of your time", "source": "our 12-person diary study, March 2026, docs/study.pdf", "key": "text.headline" }]
```

`mp set` refuses vague sources ("internal benchmark", "our data", "n/a") and names the field. It checks the form of a source, not its truth: a real number with a real source is still your responsibility.

Claims without a `key` become the ad's proof lines.

## 4. Your footage (1 minute)

```bash
mp set media.hook.src ~/Movies/clips/desk.mp4
mp set media.hook.start 2.2                  # seconds into the clip
mp set media.product null                    # no shot yet: a labelled placeholder
```

- A slot set to `null` renders a striped card that says `placeholder: <label>` in frame. It is never a fake shot.
- Paths are relative to `project.json`, or absolute.
- A missing file stops the build and names the path.

## 5. Aspects (10 seconds)

```bash
mp set aspects 16:9,9:16
```

Each aspect is a **re-layout, not a crop**:
- The text is re-fitted inside that aspect's safe zone, at a size that reads on a phone: at least 56 px in 9:16.
- The 9:16 safe zone is the pack's `conservative` zone, x 65-960 and y 269-1248 on 1080x1920, clear of the feed's buttons and captions.
- Footage is re-framed around its centre.

| template | 16:9 | 9:16 | 1:1 | 4:5 |
|---|---|---|---|---|
| ad | native | generic re-layout | generic re-layout | generic re-layout |
| proof-film | native | native (own layout) | manual | manual |
| beat-edit | native | native | native | manual |
| talking-head | native | native (its default) | native | manual |
| multi-voice-doc | native | manual | manual | manual |
| character-spot (3D) | native | native | manual | manual |
| film-scene (3D) | native | native | manual | manual |

- **native:** the template has its own layout for that shape.
- **generic re-layout:** `templates/_shared/relayout.mjs` re-fits the template's cards into the safe rect.
- **manual:** the template has fixed positions for another shape. `mp render` skips it and says why, rather than guessing.

`mp list` prints this table for every template, including templates added after this page was written.

## 6. Render (1-4 minutes per MP4 on an Apple-silicon Mac)

```bash
mp render
```

For each template and each aspect, `mp render` writes these files to `renders/`:
- `ad-16x9.mp4` and `ad-9x16.mp4`;
- the plan each one was built from;
- a contact sheet of the delivered file;
- its measured loudness.

It stops before a render when the disk has under 10 GiB free.

Measured on the Fernwick example: the 15 s ad rendered in about 50 s per aspect.

`mp render --aspect 9:16` renders one aspect, and `mp render --template ad` renders one template.

## 7. Check what you made (1 minute)

```bash
mp check
```

Every line is `ok`, `warn` or `FAIL`, with the reason and the fix. The report is saved as `renders/check.txt`. The checks are:
- **The project:** the file is valid, every file exists, and every digit has a sourced claim.
- **Banned demo words:** "in development", "planned" and "illustration". Say placeholder, demo data, render or example instead.
- **Names:** no studied account or brand name appears (`tools/check_names.py`).
- **Ids:** every sound, music, transition and type id resolves (`tools/check_ids.py`, 0 unresolved).
- **The plan:** the plan lint passes (claims have sources, transitions have reasons).
- **Loudness, from the delivered MP4:** -14 ± 0.5 LUFS-I and a true peak at or under -1.0 dBTP.
- **eyes:** frame 0, black or frozen runs, flashes, banding, safe zones, text size, time on screen and contrast, pacing.
- **ears:** loudness, peaks, sync, dead air, the ending.

Then look at `renders/*.sheet.jpg` yourself. The checks measure; they do not judge taste.

## Errors you may see, and what to do

| message | meaning | fix |
|---|---|---|
| `brand.colour: unknown key (did you mean brand.accent?)` | the field does not exist | use the suggested name; `mp list` shows the fields |
| `text.hedline: ad has no such field (did you mean text.headline?)` | a typo of a field the template uses | fix the spelling |
| `not used by ad: text.intro, ...` | another template's field; fine in a shared project | nothing, or `--strict` to make it an error |
| `text.headline: "Saves 40%..." shows a digit on screen with no sourced claim` | an unsourced number | add the claim with its source, or take the number out |
| `media.hook.src: file not found: /abs/path` | a wrong path | fix the path (relative to `project.json`) |
| `media.input.src: talking-head needs a real file here` | a required slot with no placeholder (a person cannot be faked) | give your clip |
| `aspect 1:1: proof-film needs a MANUAL re-layout` | the template has no layout for that shape | drop the aspect, or build the layout first |
| `overrides.ad.lenght: ... (did you mean length?)` | a wrong raw CONFIG path | use the suggestion |

## For AI agents

- **The contract:**
  - `templates/_shared/project.schema.json` (JSON Schema 2020-12);
  - `mp list --json`, which lists every template, its fields, their CONFIG targets, the current defaults, required slots and the aspects;
  - the exit codes: 0 fine, 1 a check failed, 2 a usage or project error.
- **Edit by command.** Prefer `mp set` to rewriting the file: it validates the whole project before it writes anything, so a refused value changes nothing.
- **Anything the shared fields do not cover** goes in `overrides.<template>.<CONFIG path>`, for example `mp set config.ad.length 30`. The value is checked against the template's CONFIG, and an unknown path is an error with a suggestion.
- **Inside a template folder,** `node make.mjs --project p.json --aspect 9:16 --set key=value` does the same as `mp build`. The project applies first and `--set` (raw CONFIG paths) goes on top. `out/project.report.json` records what was applied and what was ignored.
- **The regression:** an empty project changes nothing. `node tools/tests/project.test.mjs` proves that the plan of every genre template is byte-identical with and without one.

## For template authors (the PROJECT_MAP contract)

A template's `config.mjs` exports these alongside `CONFIG` and `buildPlan`:

```js
export const PROJECT_MAP = {
  'brand.name': ['brand.name', 'product.name'],               // one field to several CONFIG paths
  'text.headline': 'hook.line',
  'text.problem': { to: 'problem.lines', list: true },          // a single string becomes a list
  'media.screen': 'media.screen',                               // a whole slot {src, start, label}
  'music': { to: ['music', 'bpm'], fn: (id, ctx) => [id, ctx.music(id).bpm] },   // a value computed from the pack
  'aspect': { to: 'format', values: { '16:9': 'wide', '9:16': 'tall' } },         // a lookup; anything else is refused
  'media.input.src': { to: 'input', required: true, note: 'your MP4' },           // no placeholder possible
};
export const ASPECTS = { '16:9': { how: 'native' }, '9:16': { how: 'native' }, '1:1': { how: 'manual', note: 'why' } };
```

- **Map keys** are project paths. Two of them are derived rather than written in the file:
  - `aspect`: the aspect being built;
  - `platform`: the first of `project.platforms` that has the shape of that aspect.
- **The longest matching key wins.**
- **A function** gets a `ctx` object: `{ project, template, aspect, defaults, music(id), seconds(file), warn(msg) }`.
- **Tests:** `node tools/tests/project.test.mjs` applies a full sample project to every genre template and fails on a map entry that points at no CONFIG path. Add your template to its `GENRE` list.
- **A three.js template** reads the resolved CONFIG through `scene.html?config=out/config.resolved.json`, which `render3d.sh` passes when `MP_PROJECT` is set. Copy the two lines from `templates/character-spot/scene.html`.
