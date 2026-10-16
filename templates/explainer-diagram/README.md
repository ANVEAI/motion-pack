# explainer-diagram: a "how it works" film on one diagram canvas

60-120 s, 16:9 master + a 9:16 re-layout. Structure: `explainer` in `patterns/structures.json` (question, wrong model, reframe, proof, so what). structure_check: **100 / 100** at both aspects.

**Demo:** "How does a letter cross a country?" by the fictional "Orbit Explains". It is a generic hub-and-spoke explainer with no numbers, so it has no claims to source. 76.8 s.

## Shape

| section | demo time | what happens | parts |
|---|---|---|---|
| question | 0-7.4 s | the hook line on frame 0 over a two-node diagram that is already drawing; a flow runs along the edge | `title.hookCard`, `diagram.graph` |
| wrongmodel | 7.4-22 s | the picture most people carry, then the every-town-to-every-town mesh that shows why it fails | `diagram.graph` (DSL) |
| reframe | 22-46 s | the hub network built node by node; the camera moves collect -> hub -> deliver -> overview; flows; a note pinned to the hub | `diagram.graph` steps / cam / flow / notes |
| proof | 46-63 s | the camera dives INTO the hub node and its sub-diagram builds (with two pinned notes); then one letter is traced A -> F | `diagram.graph` zoom, focus, flow |
| sowhat | 63-76.8 s | recap card, then the takeaway held on the end card (planned quiet hold) | `title.recapCard`, `title.takeaway` |

No hard cuts: every change is a camera beat, a node landing, a highlight or a note, listed in `plan.audio.events`. Pace is scored from them (no gap over 3.5 s outside the end hold).

## Edit the CONFIG

- **`diagrams`** holds the diagrams, as JSON `{ nodes, edges, groups }` or the DSL of `type/gfx/graph.js`:
  ```
  Read the address -> Group by region -> Load the truck
  Read the address -> Unclear? : "can't read it"
  node Unclear? "Unclear?" kind=decision
  group core "The core loop"
  ```
  Node kinds: `io` (pill), `decision` (hexagon), `store` (cylinder), default (box). `icon` is a name from `type/gfx/explain-icons.js`.
- **`beats`** are `{ t | word, sec, do, ... }`. `do` is one of:
  - `show` (a diagram from `t` to `until`; `steps: [[t, [ids]]]`);
  - `cam` (frame `ids` or `'all'`);
  - `focus` (highlight `ids`, dim the rest);
  - `flow` (animate `edges`: `'all'` or `['a>b']`);
  - `note` (a pill on a node);
  - `zoom` (dive into `node`, open `into`, back out at `out`; `notes` inside);
  - `hook`, `caption`, `recap`, `takeaway`.
- **`text`** holds all the copy: hook, recap items, takeaway.
- **Voice (optional):** `voice.words` is a words.json, .srt or .vtt of your VO, and `voice.audio` is your recording. A beat with `word: 'hub'` then lands on that word. Captions follow the voice, the caption supers are dropped, and the bed ducks 12 dB under it. Without `voice.audio`, a labelled guide signal stands in. `words.example.json` is a hand-timed example used by the tests.
- **Re-layout:** on 16:9 the diagrams run left to right in a wide box; on 9:16 they run top to bottom inside the conservative safe rect, with captions in the top band and a lower camera zoom limit. Each aspect has its own constants in `LAYOUT`.

## Build and render

```
node make.mjs                      # gate (diagrams parse, nodes exist, no unsourced digit) -> plan -> mix -> index.html
node make.mjs --set aspect=9:16    # tall/index.html
node make.mjs --no-audio           # page check only (no voice, no mix); never render this build
```

Render commands (through the shared render lock): `docs/lane-notes/explainer.md`.

**Measured:**
- Mix at both aspects: -14.01 LUFS-I, -2.35 dBTP (WAV), 24 cues on `music/bed_documentary_marimba_loop8`.
- The page loads with real fonts and no console errors, and `__seek` / `__ready` work.
- **Not rendered yet** (disk); there is no MP4, no sheet, and no eyes or ears scores.

**Ids:**
- gfx: `diagram.graph`, `title.hookCard`, `title.recapCard`, `title.takeaway`.
- sfx (via gfxCues): `sfx/ui/pop`, `sfx/ui/tick`, `sfx/whoosh/swish_xs`, `sfx/whoosh/swish_s`, `sfx/tx/zoom_through`, `sfx/ui/slide`, `sfx/hit/soft`.
- layers: `grain` (`upload-safe`).

**Limits:**
- Edges are cubic curves through layer slots. There is no crossing minimisation beyond median sweeps, so a dense graph (more than about 12 edges between two layers) can tangle.
- The zoom is one level deep.
- Node labels wrap to two lines.
