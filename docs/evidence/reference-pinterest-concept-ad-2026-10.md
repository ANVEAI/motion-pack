# Reference study: "a little concept ad for Pinterest" (Oct 2026)

**Source.** [Post](https://x.com/mokshlnq/status/2110017729063424004) by @mokshLNQ (13 Oct 2026). 15 s, 1920×1080.

**Status.** An **unofficial concept ad**, not Pinterest's own. 2.6K views, 90 likes, 54 bookmarks at study time.

**Use.** Craft reference only.

## Structure (15 s)

| t | beat | treatment |
|---|---|---|
| 0–1 s | "Still searching for" | Small grotesk on white builds word by word, with a red-to-black colour settle |
| 1–3 s | "Inspiration [▣] everywhere?" | **Media inline in the sentence:** a fanned **card stack** sits between two words and **riffles** through photos |
| 3–4 s | Logo in the world | The brand mark is **composited onto a train window** facing a mountain, then the wordmark |
| 4–6 s | "Brings [photo] millions of [ideas]" | Inline photo cards around the words; the key word sits in a **brand-red pill** |
| 6–9 s | "Designs", "Inspirations" | **Card rivers:** diagonal streams of photo cards sweep across with motion blur, the words held still in the gaps |
| 9–12 s | "Discover it. / Save it. / Create it." | One held full-bleed landscape; tiny centred text cycles a **verb triad** |
| 12–15 s | Logo build | The icon, then the wordmark slides out, red on white |

## What to learn

1. **The sentence is the layout.** Media sits *inside* the line of text, so reading and watching are one act.
2. **Stillness against flow.** The words stay still while cards stream past; the contrast directs the eye.
3. **A held image under changing words** (the verb triad) gives a calm beat before the logo.
4. **One brand colour,** used for pills, logo and a single word tint. Everything else stays neutral.
5. **Logo in the world.** A mark composited into a real scene reads as an idea, not a bumper.

## Pack coverage

| technique | status |
|---|---|
| Word-by-word build, verb triad over a held image | exists (`type/` presets) |
| Pill highlight on one word | exists (`caption.pill` style; verify inline use) |
| **Inline media in a sentence** (image or card slots that reflow the words) | gap: `type/inlineMedia` |
| **Card-stack riffle** | gap: `objects`/`layout` `cardStack` (its sound exists since 2026-10-14: `sfx/paper/card_riffle`, `sfx/paper/card_shuffle_settle`) |
| **Card river** (diagonal streams, motion blur, seek-safe) | gap: `layout.cardRiver` |
| **Logo or UI corner-pinned into footage** | gap: `layout.cornerPin` (4-point warp from tracked or keyed corners) |
