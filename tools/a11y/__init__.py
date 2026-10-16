"""motion-pack / tools / a11y: shared pieces of the delivery and accessibility tools (captions, audio description, a11y_check, deliver).

    standards.py   every number the tools enforce, each with where it comes from (platform guide, study, or a pack house default)
    safezones.py   the platform safe rectangles, READ from type/safezones.js (one source of truth, never copied)
    cvd.py         colour-vision-deficiency simulation (protan / deutan / tritan) and CIEDE2000 colour difference

Nothing here reads the clock, the network or a random source: the same inputs give the same report."""
