#!/bin/bash
# Run every browser test of layers/, type/, camera/ and the DOM transitions (real Chrome + hardware WebGL). Exit 1 on any failure.
# Needs puppeteer-core and Chrome (see tools/chrome.mjs), gsap (npm) for the DOM pages, and a hardware GPU: software GL is refused.
# Suites with a node mode for CI and a --chrome mode (r45, r45type) run here with --chrome. tools/tests/test_suites_listed.py (CI) fails when a
# browser suite (a *.test.mjs that opens Chrome through layers/tests/harness.mjs, or has a --chrome mode) is missing from this list.
cd "$(dirname "$0")/../.." || exit 1
rc=0
SUITES=(
  "layers/tests/layers.test.mjs"
  "layers/tests/l7.test.mjs"
  "layers/tests/r3.test.mjs"
  "layers/tests/r45.test.mjs --chrome"
  "type/tests/type.test.mjs"
  "type/tests/r45type.test.mjs --chrome"
  "type/tests/cards.test.mjs"
  "camera/tests/camera.test.mjs"
  "camera/tests/camera2d.test.mjs"
  "camera/tests/camera3d.test.mjs"
  "layers/tests/overlay2-sheet.mjs"
  "type/tests/gfx-sheet.mjs"
  "transitions/tests/dom-sheet.mjs"
)
for s in "${SUITES[@]}"; do echo "=== $s"; node $s 2>&1 | grep -E "FAIL|passed|pass \(|rendered|mounted|Error|not found" ; [ ${PIPESTATUS[0]} -eq 0 ] || rc=1; done
exit $rc
