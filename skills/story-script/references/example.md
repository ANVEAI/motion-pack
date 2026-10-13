# Worked examples (fictional)

Both products are fictional placeholders. "Orbit" is the placeholder brand motion-pack's templates already use, so example 1 can be built straight away.

## Example 1: "Every draft, saved" · 16 s wordless character spot

Built for motion-pack's `templates/character-spot`, whose beats are hook 2.5 s, setup 2.5, escalation 3.0, despair 2.0, twist 1.5, reaction 1.5, message 3.0. The full lint-clean shot list is `assets/shotlist.example.json`.

**The four lines**
- **Logline:** a worker deep in a draft knocks coffee onto the laptop, and the dead screen comes back with every word still there.
- **Stake:** an afternoon's draft, a full mug at the elbow.
- **Turn (10.0 s):** the dead screen wakes on its own, the draft restored, the cursor where it stopped.
- **Payoff:** the soaked laptop shows the whole draft; the worker cheers.
- **Sound-off sentence:** "He spilled coffee on his laptop, thought the draft was gone, and it came back saved."

**Why it passes the rubric:** the stake is an object you can see (the draft next to the mug); the product never appears as a thing, only as the state change at the turn; the payoff is the stake resolved; the end line names the feature in three words ("Every draft, saved."); the fine print says "Illustration · fictional product".

**Beat sheet → template CONFIG**

| shot | beat | s | what happens | `templates/character-spot` CONFIG |
|---|---|---|---|---|
| s01 | HOOK | 0-2.5 | typing at speed; the mug edges closer with each keystroke | `beats[0]` hook, 2.5 |
| s02 | SETUP | 2.5-5.0 | a big stretch; the arm sweeps past the mug | `beats[1]` setup, `events.stretch` 2.6 |
| s03 | ESC | 5.0-8.0 | clink, flood, the screen dies, freeze | `beats[2]` escalation; `events.knock` 5.6, `spill`, `dark` 6.7, `freeze` 6.85 |
| s04 | FREEZE | 8.0-10.0 | the face; shoulders drop | `beats[3]` despair, `tx: transitions/smash` + reason |
| s05 | TURN | 10.0-11.5 | the screen wakes with the draft | `beats[4]` twist, `events.restore` 10.0 |
| s06 | PAYOFF | 11.5-13.0 | wow, then the cheer | `beats[5]` reaction, `events.cheer` 12.2 |
| s07 | CARD | 13.0-16.0 | end line, logo, fine print, sting | `beats[6]` message, `brand.line` |

**Hooks (one body from 2.5 s):** A `curiosity-gap`, the mug creeping toward the laptop (poster "ONE SIP AWAY"); B `payoff-first`, the restored draft and the cheer, then a flash rewind ("IT CAME BACK"); C `pattern-break`, one coffee drop falling toward a key in slow motion ("DON'T.").

**Send line (for the caption):** "send this to the friend who keeps coffee next to their laptop".

## Example 2: "The Shoebox" · 60 s short film, 9:16 lead

A fictional receipt-scanning app, "Tally".

**The four lines**
- **Logline:** a bakery owner has until midnight to file her taxes and a shoebox of faded receipts; her teenage daughter, supposedly asleep, quietly clears the box with her phone.
- **Stake:** a late-filing penalty, and a promise to be at her daughter's school play at nine the next morning.
- **Turn (30 s):** the daughter sits down opposite her and starts sweeping receipts with her phone, one tick per receipt.
- **Payoff:** 8:58 AM, the mother slides into a seat in the school hall as the curtain opens; on her phone, "Filed".
- **Sound-off sentence:** "Mum was buried in receipts before a deadline; her daughter scanned them all, so Mum made it to the play."

**Beat sheet (60 s)**

| s | beat | what we see |
|---|---|---|
| 0-3 | cold open | receipts sliding off the counter in an empty, lit bakery; the wall clock reads 11:02 PM [in-world text] |
| 3-12 | world and want | flour on her sleeves; the tax portal open; on the fridge, a school-play flyer: "Thursday 9 AM" |
| 12-27 | obstacle | faded ink; a calculator total that will not match; she rubs her eyes; the clock jumps to 11:31 |
| 27-33 | **turn** | a chair scrapes: her daughter in pyjamas, phone out, sweeping the pile; a soft tick per receipt |
| 33-50 | consequence and payoff | the box empties; the portal's progress bar fills [screens recreated · demo data]; they share a tired laugh; "Filed" at 11:54 |
| 50-56 | button | 8:58 AM, school hall; she slides into a seat; the curtain opens; her phone, face-down, buzzes once |
| 56-60 | card | "Receipts, handled." · Tally · fine print: "Fictional app. Screens recreated with demo data." |

**Notes for frame-design:** the hero of the cold open is the falling receipts, not the woman; the turn shot is a two-shot across the counter; the payoff is a wide of the hall with her small in frame, the phone a small insert. Freeze the bakery clock while the app works: the film must not imply how long scanning takes.

**Hooks:** A `in-medias-res`, the receipt avalanche ("11:02 PM. Due at midnight."); B `payoff-first`, the curtain opening and the phone reading "Filed", then rewind ("She made it."); C `problem-agitate`, three fast inserts of faded ink ("Every receipt. Faded.").
