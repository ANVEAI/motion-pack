#!/bin/bash
# Run every browser test of layers/, type/, camera/ and the DOM transitions (real Chrome + hardware WebGL). Exit 1 on any failure.
# Needs puppeteer-core and Chrome (see tools/chrome.mjs), gsap (npm) for the DOM pages, and a hardware GPU: software GL is refused.
cd "$(dirname "$0")/../.." || exit 1
rc=0
for t in layers/tests/layers.test.mjs layers/tests/l7.test.mjs type/tests/type.test.mjs camera/tests/camera.test.mjs camera/tests/camera2d.test.mjs camera/tests/camera3d.test.mjs layers/tests/overlay2-sheet.mjs type/tests/gfx-sheet.mjs transitions/tests/dom-sheet.mjs; do echo "=== $t"; node $t 2>&1 | grep -E "FAIL|passed|pass \(|rendered|mounted|Error" ; [ ${PIPESTATUS[0]} -eq 0 ] || rc=1; done
exit $rc
