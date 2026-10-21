# Templates: brief.md, script.md, shotlist.json, hooks, series bible

Copy a block, delete the hints in [brackets], keep the headings so the next skill can find things.

## Contents
1. brief.md
2. script.md
3. shotlist.json (schema and field rules)
4. The hook block
5. Series bible (for episodic formats)

---

## 1. brief.md

```markdown
# Brief: <working title>

- **Who it is for:** [the viewer, in one line; the buyer too, if different]
- **Objective:** [awareness | consideration | action] — [what they should do or feel after]
- **Platform and lead aspect:** [e.g. Shorts + Reels, 9:16 lead; LinkedIn 16:9 second]
- **Length:** [6 | 15 | 30 | 60 | 90 s; plus cut-downs]
- **The one thing to remember:** [one sentence, no feature names]
- **Proof we actually have:** [real numbers with a source, real screens, real quotes with permission; or "none"]
- **Product status:** [runs today | in build | planned | in design] — decides the honesty labels
- **Must say / must not say:** [required words; banned words, competitor names, claims legal will not allow]
- **Tone:** [e.g. warm deadpan, quiet drama, hype]
- **Sound:** [music-led, no voice-over | voice-over | dialogue | chat bubbles]; language on screen: [one language]
- **References (craft only):** [what to learn from each: "the long-lens product light", "the 3-beat escalation"]
- **Assumptions I made:** [list every gap you filled, so the user can correct it]
```

## 2. script.md

```markdown
# <Title> · script v<N>

<format> · <length> s · <fps> fps · <lead aspect> lead · <sound: music-led / VO / dialogue>

## The four lines
- **Logline:**
- **Stake:**
- **Turn:**
- **Payoff:**
- **Sound-off sentence:** After one watch with the sound off, a viewer can say: "..."
- **Send line (social cuts):** "send this to ..." [names an audience; optional for films]

## Characters and world
[one short block per character: look in a few words, want, what they do with their hands and eyes; the one location; the light as a state signal]

## Beat sheet
| beat | s | what happens | what the viewer feels |
|---|---|---|---|

## Scenes
[one paragraph per scene: what we SEE and HEAR, in present tense. No camera jargon unless it carries meaning. On-screen text in quotes, labels in brackets: [demo figures]]

## Hooks
[the hook block, section 4]

## Honesty
| claim or label | where | status | source |
|---|---|---|---|

## Review
[the rubric table from rubric.md with scores, the fixes made, and what is still open]
```

## 3. shotlist.json

One JSON object. Times in seconds; frames are derived from `fps`. `scripts/lint_shotlist.py` checks every rule marked **lint**.

### Top level

| field | type | rule |
|---|---|---|
| `title` | string | working title |
| `format` | string | `ad`, `launch`, `short-film`, `character-spot`, `chat-skit`, `explainer`, `reel` |
| `length_s` | number | **lint:** equals the sum of `shots[].dur_s` within one frame |
| `fps` | number | 24, 25, 30 or 60 |
| `aspect` | string | lead aspect: `16:9`, `9:16`, `1:1`, `4:5` |
| `logline`, `stake`, `payoff`, `sound_off` | string | the four lines and the sound-off sentence |
| `turn` | object | `{ "at_s": number, "what": string }`; **lint:** `at_s` between 30% and 80% of the runtime (house default) |
| `send_line` | string or null | **lint (warn):** expected for `reel`, `chat-skit` and `character-spot` |
| `hooks` | array | **lint:** three entries (section 4) |
| `shots` | array | section below |
| `claims` | array | `{ "text", "source" }`; **lint:** a digit needs a `source` |
| `banned` | array of strings | optional; **lint:** none may appear in any shot `text` |
| `lint` | object | optional per-file overrides of the linter's house defaults |

### Each shot

| field | type | rule |
|---|---|---|
| `id` | string | unique, e.g. `s01` |
| `beat` | string | the beat name from the format grammar (`HOOK`, `SETUP`, `ESC`, `FREEZE`, `TURN`, `PAYOFF`, `LINE`, `CARD`, or `problem`, `product`, ...); **lint (warn):** the first shot is `HOOK` |
| `role` | string | optional: `stake`, `turn`, `product`, `proof`, `payoff`, `reaction`, `send`, `card`; **lint (warn):** outside an ad, a `product` shot before the turn is a pitch |
| `start_s` | number | optional; derived from the order if absent |
| `dur_s` | number | **lint:** greater than 0 |
| `scale` | string | `EWS`, `WS`, `MWS`, `MS`, `MCU`, `CU`, `ECU`, `INSERT`, `OTS`, `POV`, `2S`, `SCREEN`, `CARD`; **lint (warn):** no more than 3 same-scale shots in a row |
| `action` | string | what we see, present tense; **lint:** the first shot's action must not be black, a logo, a fade-in or a title card |
| `sound` | string | cue intents in plain words ("pen tap on the beat; riser into the turn"); motion-pack maps them to ids |
| `text` | string | on-screen words, `""` for none; **lint:** at most 7 words in the first shot; reading speed at most 3.5 words/s; hold at least max(0.5, 0.35 + 0.28 x words) s (type-module rules) |
| `text_kind` | string | `super` (default: a statement to the viewer), `in_world` (a clock, a ledger row, a chat bubble inside the fiction), `label` (an honesty label), `card` (end card) |
| `honesty` | string or null | the label shown in this shot, e.g. `"Render · demo figures"`; **lint:** a `super` or `card` with a digit needs a matching sourced claim or a label |
| `transition` | object | `{ "kind": "cut" | "smash" | "dissolve" | "whip" | ..., "reason": null | "EMOTION: ..." }` into this shot; **lint:** anything but `cut` needs a reason |
| `camera` | string | optional, e.g. "locked, 85 mm, 4% push" |
| `notes` | string | optional |

### Minimal valid file

```json
{
  "title": "Untitled", "format": "reel", "length_s": 6, "fps": 30, "aspect": "9:16",
  "logline": "A baker drowning in receipts gets her evening back.",
  "stake": "a tax filing due at midnight",
  "turn": { "at_s": 2.5, "what": "her daughter snaps the whole shoebox with one app" },
  "payoff": "the shoebox closes; the filing confirmation glows on the phone",
  "sound_off": "The receipts were a mess, the kid scanned them all, it got filed.",
  "send_line": "send this to the friend with a shoebox of receipts",
  "hooks": [
    { "id": "A", "archetype": "in-medias-res", "frame0": "receipts avalanche off the table", "text": "11:40 PM. Due at midnight.", "poster_text": "DUE AT MIDNIGHT" },
    { "id": "B", "archetype": "payoff-first", "frame0": "the confirmation glows, then rewind", "text": "Filed. Here's how.", "poster_text": "FILED" },
    { "id": "C", "archetype": "problem-agitate", "frame0": "three fast cuts of faded receipts", "text": "Every receipt. Faded.", "poster_text": "FADED" }
  ],
  "shots": [
    { "id": "s01", "beat": "HOOK", "role": "stake", "dur_s": 2.5, "scale": "WS", "action": "receipts slide off the table onto the floor; the baker freezes", "sound": "paper avalanche on frame 0", "text": "11:40 PM. Due at midnight.", "text_kind": "in_world", "honesty": "Illustration · fictional app", "transition": { "kind": "cut", "reason": null } },
    { "id": "s02", "beat": "TURN", "role": "turn", "dur_s": 1.5, "scale": "CU", "action": "the daughter's phone sweeps the pile; each receipt ticks", "sound": "a soft tick per receipt", "text": "", "text_kind": "super", "honesty": null, "transition": { "kind": "cut", "reason": null } },
    { "id": "s03", "beat": "CARD", "role": "payoff", "dur_s": 2.0, "scale": "CARD", "action": "the shoebox closes; the filing confirmation glows; line and logo", "sound": "two-note sting", "text": "Receipts, handled.", "text_kind": "card", "honesty": "Fictional app · demo data", "transition": { "kind": "smash", "reason": "STORY: relief lands" } }
  ],
  "claims": []
}
```

## 4. The hook block

```markdown
| id | archetype | frame 0 (what we see, already moving) | on-screen text (max 7 words) | poster (max 4 words) | first sound |
|---|---|---|---|---|---|
| A | in-medias-res | | | | |
| B | payoff-first | | | | |
| C | problem-agitate | | | | |
Body: identical from <t> s. Test plan: post A first; B and C only if the hook is the bottleneck (social-video measures it).
```

Pick three different archetypes; two hooks from one archetype test wording, not the hook. `social-proof` needs a number with a `source` in `claims`.

## 5. Series bible (episodic formats)

```markdown
# <Series> bible

- **Format promise:** [one line: what every episode delivers]
- **Grammar:** [the beat grid every episode follows, with seconds]
- **Cast:** [name in the fiction, look, want, signature behaviour; who is the straight man]
- **World rules:** [3-8 invariants, e.g. "the product never speaks", "problems are objects, never cruel people", "light tells the state"]
- **Callbacks:** [recurring numbers, times, lines, props; the episode each started in]
- **Never:** [banned gags, real brands, insignia, languages, words]
- **Labels:** [the label vocabulary and when each applies]
- **Episode list:** [no. · title · feature or topic · stake · status]
```

Recurring callbacks reward the audience that comes back. They only work if they stay consistent, so check the bible before you change one.
