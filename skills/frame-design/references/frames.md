# Special frames, product shots, screenshots and generated imagery

## Contents
1. Covers and thumbnails
2. Title cards
3. Lower thirds
4. End cards
5. Honesty labels
6. Product and hero shots
7. Real screenshots in generated scenes
8. Generated people and props
9. Re-layout between aspects

---

## 1. Covers and thumbnails

- **One subject, at most 4 words, readable at 120 px wide.** Scale your cover to 120 px wide; if you cannot read the words or tell what the subject is, it fails.
- **The words carry the stake or the question** ("ONE SIP AWAY", "WHO SENT IT?"), not the title. The subject's face or the object fills a large part of the frame; the background is quiet.
- **High contrast** between the words and what is behind them (`contrast.py`, large-text rule at least), and between the subject and the background.
- **Promise only what the video pays off.** A cover that over-promises trains viewers to skip.
- **Sizes:** YouTube custom thumbnail 1280 x 720 (16:9), JPG or PNG; vertical covers 1080 x 1920, with the subject and words kept in the centre, because profile grids crop vertical covers (to 3:4 on Instagram at the time of writing) and the feed overlays the top and bottom.
- **Make frame 0 poster-worthy too.** Some surfaces show the first frame, and it is the same image the hook needs anyway.
- **Never generate a thumbnail's text or UI with an image model** (section 7). Set the words with real type over a real frame or a composited scene.
- **A cover is one cover.** If you want to test covers, change the words or the subject, not both.

## 2. Title cards

- One line, the type preset that matches the tone cell (`type/maskRise` premium, `type/blurIn` film, `type/elasticPop` playful, `type/scaleSlam` hype, `type/trackingCollapse` brand).
- Hold the fully formed title for at least 9 frames; longer for more words (type-module reading rule).
- A title card never opens a social cut. In feeds, the first second belongs to the stake; put the title later or in the caption (a small name super over moving footage inside 2 s is fine: the hook rule is in motion-pack `references/virality.md` §1).

## 3. Lower thirds

Use the type module's gfx ids: `lowerThird.cleanBar` (interview), `.accentRule` (premium), `.softPill` (creator), `.boldBlock` (ad), `.newsBar` (comedy "breaking"), `.neonBorder` (gaming or night). Name and title only; sit it inside the platform safe rect (`params.platform`); on screen for about 2.5-4 s; the accent colour on one element only.

## 4. End cards

- **Logo, one line, one URL or action, fine print.** The logo file is never altered (no recolouring, stretching or effects that change the mark).
- **Hold at least 1.8 s after the motion settles**; 3 s or more if fine print must be read.
- **One accent word** in the line, marked `*word*` in `design.json` (the ad and character-spot templates render it in the accent colour).
- **Per aspect:** 16:9 centres the stack on the title-safe area; 9:16 keeps the stack between y 269 and 1248 (conservative safe rect) and the URL above the bottom 35%.
- **On a loop**, replace the end card with a small tag at about 0.8 opacity outside the bottom 35%, so the loop survives.

## 5. Honesty labels

- A designed component, not a footnote: the mono family, `palette.muted` or a label colour that passes 4.5:1, at least 28 px (16:9) or 30 px (9:16), inside the safe area, on screen for at least 2 s.
- One vocabulary across a series: "example data", "demo figures", "demo data", "fictional", "screens recreated", "3D render", "render", "in build" (never "in development", "planned" or "illustration").
- Place the label where it does not cover the hero, and keep its position constant across shots so the eye learns where to find it.

## 6. Product and hero shots

These are house defaults from product-shot reviews of rendered hardware; adjust by eye.

- **Long lens** (roughly an 18-22 degree field of view) and the product at about 36-46% of the frame width.
- **A three-plane light rig** with an edge light, so the silhouette separates from the background. Large strip softboxes at a grazing angle put a visible gradient on broad faces; flat, even shading reads as CG.
- **Black is not grey.** A matte black body should sit around 28-40 of 255 on its faces with chamfer highlights at 150-210; lifted blacks look foggy.
- **Glowing parts must not clip to white.** An emissive band that clips loses its colour and reads as a tube. Keep a hot core with darker coloured edges, and let it spill a little light onto nearby surfaces.
- **At least one critically sharp edge** in every still; nothing sharp means nothing to look at.
- **Leave quiet negative space where the type sits**, and move the product (lens shift, camera) rather than the type.
- **One human trace** (a pen cap, a folded corner) makes a desk read as real without clutter.
- **Procedural props age badly next to a photoreal hero.** If the mug, the desk or the laptop are not as good as the product, show the product alone with soft background bokeh.

## 7. Real screenshots in generated scenes

Image and video models garble interface text: labels come back as near-words. So never send a screenshot to a model to "enhance" it.

1. Generate only the scene: an unbranded monitor, laptop or phone whose screen is flat chroma green (`#00FF00`). Do not mention any green object in the prompt.
2. Detect the green region and its four corners.
3. Warp the real screenshot onto it in perspective without stretching; pad any bars with the screenshot's edge colour; clip to the detected screen shape.
4. Remove green spill around the screen and on nearby surfaces (keys, bezels).
5. Label the result "real screens, generated settings" wherever it is published.
6. Keep the raw scenes, so a new screenshot can be composited again at no cost.

If a demo screen shows numbers the product invented, change them in the product (demo data), not by blurring the image.

## 8. Generated people and props

- **Prefer owned CG** (the pack's three.js objects and Blender plates) for anything that must stay consistent.
- **If people are generated:** make a reference sheet (front, three-quarter, profile, a few expressions) and generate every shot from it; one sharp face per shot; hands small in frame, and show the result of an action rather than the hand doing it; check a side-by-side contact sheet for drift before the edit locks, and reject drifting shots.
- **Composite your own product render into a locked generated plate** rather than asking a model to draw it: match key direction, colour temperature, contact shadow, depth of field and grain.
- **Every legible text, logo and clock face** is composited, never generated.
- Disclose generated people on the end card and in the post (social-video handles the platform switches).

## 9. Re-layout between aspects

- **Author the lead aspect natively** and generate the others from layout constants per aspect (positions, sizes, camera distance, lens shift). Never edit the derived aspect by hand; regenerate it.
- **16:9 to 9:16:** pull the camera back or reframe so the hero fits the narrower width; stack type vertically inside the safe rect; move the end-card URL above the bottom 35%.
- **9:16 to 16:9:** fill the width with the scene, not with empty side panels; give the type its own column.
- **1:1:** centre the hero; keep the bottom 10% clear.
- Check every aspect with stills from the delivered file, not only design mock-ups.
