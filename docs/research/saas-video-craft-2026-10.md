# SaaS launch, feature-drop and explainer films: the craft the xp-saas templates encode (16 Oct 2026)

This note maps what the pack already studied about software launch films onto the three SaaS templates (`templates/saas-launch`, `templates/saas-feature-drop`, `templates/saas-explainer`) and the SaaS kit parts (`type/gfx/ui-saas.js`, `ui-saas2.js`). It adds **no new reception figures**: the evidence is the studied set in `docs/research/launch-films-2026.md` (section C, software and UI launches, and its production case) and the beat sheet in `skills/motion-pack/references/launch-playbook.md` (L3, product UI film). Everything marked *pack practice* is our own house default, not a finding. Reception numbers in the source file are public metrics read on one day; they describe what was seen, not why a film travelled, and one entry there is flagged as a possible paid-distribution pattern.

## What the studied software films share (from launch-films-2026.md, section C)

| observation in the studied set | how many of the studied films | template choice |
|---|---|---|
| The claim or headline arrives in the first 2-3 s | several (one states its claim by 3 s) | the hook headline rises at 0.12-0.15 s in all three templates; frame 0 is already moving (enter: none, a scroll and toasts) |
| Real UI carries the film; first real UI between frame 1 and 16 s | the four films the playbook counts for L3 (first UI at 0, 5, 12, 16 s) | saas-launch: problem UI from frame 0, the product UI at 13 s (60 s cut); feature-drop: the feature on frame 0 (payoff-first) |
| Features as a one-line card followed by real UI, with the typed prompt as the action beat for AI products | at least one film in the set states this exactly | the tour's chapter heads ("*Describe* it in a sentence.", "It *builds* the steps.") and `ui.aiAnswer` (prompt typed, answer streams, Apply clicked) |
| One continuous camera over real UI, about 4-11 changes a minute | one film | the 16 s tour is ONE window: zoom-to-region keys, a `move` that makes room for the AI panel, a cursor journey; no cuts inside it |
| A zoom-out or pull-back near the end | two films | the tour returns from the zoom (`rect: null`); the payoff splits the hook's inbox before / after |
| Text-only or wordless films are common; only the audio product used VO | most of the set | saas-launch and saas-feature-drop are text + sound; the explainer works on mute (captions) and takes a VO only when you give one |
| The UI comes from real frames; an agent "cannot invent UI" (the production case) | one production write-up | screens are HTML we wrote for a FICTIONAL product, labelled "placeholder UI · demo data" in frame; `CONFIG.media` swaps in your screenshots or recordings; image models never draw UI |

## Pack practice (house defaults, tune by eye and by retention data)

- **The pain on frame 0** (problem-agitate) for the launch; **payoff-first** for a feature drop (the new thing already happening); **a question** for the explainer. One idea said three ways: picture, headline, sound.
- **Three problem beats on the bar** (2 s each at 120 BPM), hard cuts; the reveal on a whip with a 1-bar riser into a soft hit; the mark pops, the name assembles letter by letter, the promise follows.
- **A cursor that behaves like a person's:** eased arcs (bezier 0.33 0 0.12 1), a dwell after a click, hover before click, a press dip plus two ripple rings, a hand cursor while dragging, and the dragged element on the same easing so it never slides under the pointer (`cursorLeg` + the screen's `cam` curve; tested to 1e-6).
- **Zoom to region** is the vertical version of a desktop demo: the 9:16 re-layouts zoom each window to its readable region from frame 0 instead of shrinking a 1440 px screen into 1000 px.
- **Before / after on the same screen** pays off the stake the hook set (the inbox of the hook, handled).
- **Proof is one number with its source printed under it**; while the source says placeholder, a red note says so in frame. Prices and dashboard figures print "placeholder data" / "demo data".
- **"Works with" uses neutral category glyphs** (Email, Chat, Storage ...), never a real product's mark.
- **Sound:** one quiet sound per UI action (`saas_ui` bundle: hover, click, drag lift, drop snap, zoom, highlight, palette, key chord, stream ticks, toast, chime, price, connect) under a bright bed (`music/bed_corporate_bright_loop8` for the launch, `bed_tech_pulse_loop8` for the drop, `bed_documentary_marimba_loop8` for the explainer); one slam on the cut to the end card; a sonic logo; the bed falls to a planned quiet hold under the held end card; plan `ceilingDb` -2.5 because click transients push the AAC probe.

## What this note does not claim

- That any of these choices make a film travel: the studied set is small, mixed across platforms, and reception is observed, not explained.
- That the synthesised UI sounds suit a given product: they are measured (`sfx/qa.py`, 0 fails) but have not been auditioned by a person.
- That the safe-zone numbers match today's apps: `type/safezones.js` flags them `verify: true`.
