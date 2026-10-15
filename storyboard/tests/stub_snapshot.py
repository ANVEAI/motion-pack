#!/usr/bin/env python3
"""A stand-in for `hyperframes snapshot` (tests only; no browser): writes frame-NN-at-<t>s.png, a flat colour per frame, the way the real tool names its files.
Called as: stub_snapshot.py snapshot <dir> --at t1,t2 --no-end --describe false -o <out>. STUB_FAIL=1 makes it exit 3 (an unavailable browser)."""
import os
import sys

from PIL import Image

a = sys.argv[1:]
if os.environ.get('STUB_FAIL'):
    print('no browser', file=sys.stderr)
    sys.exit(3)
assert a[0] == 'snapshot' and '--describe' in a and a[a.index('--describe') + 1] == 'false', a    # frames must never go to a cloud model
times = a[a.index('--at') + 1].split(',')
out = a[a.index('-o') + 1]
os.makedirs(out, exist_ok=True)
for i, t in enumerate(times):
    Image.new('RGB', (1920, 1080), (200, 30 + i * 10, 30)).save(os.path.join(out, 'frame-%02d-at-%ss.png' % (i, t)))
