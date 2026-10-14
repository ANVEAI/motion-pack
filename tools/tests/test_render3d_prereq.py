#!/usr/bin/env python3
"""templates/_shared/render3d.sh without puppeteer-core must stop at once with the reason and the install line (it used to filter the renderer's
'puppeteer-core not found' away with a case-sensitive grep and fail later with an ffmpeg 'No such file or directory'). Runs the real script with an
empty HOME (no npx cache) and no PUPPETEER_CORE_DIR; skipped when the repo has its own node_modules/puppeteer-core. Run: python3 -m pytest -q tools/tests"""
import os
import subprocess
import tempfile

import pytest

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


@pytest.mark.skipif(os.path.isdir(os.path.join(PACK, 'node_modules', 'puppeteer-core')), reason='puppeteer-core is installed in the repo root')
def test_render3d_names_the_missing_prerequisite_before_doing_anything():
    plan = os.path.join(PACK, 'templates', 'film-scene', 'out', 'plan.json')
    before = os.path.getmtime(plan) if os.path.exists(plan) else None
    with tempfile.TemporaryDirectory() as home:
        env = {k: v for k, v in os.environ.items() if k != 'PUPPETEER_CORE_DIR'}
        env['HOME'] = home
        r = subprocess.run(['bash', 'templates/_shared/render3d.sh', 'templates/film-scene', 'scene.html', 'wide'], cwd=PACK, env=env, capture_output=True, text=True, timeout=120)
    out = r.stdout + r.stderr
    assert r.returncode != 0
    assert 'puppeteer-core not found' in out and 'npm i --no-save puppeteer-core' in out, out[-800:]
    assert 'No such file' not in out, 'the real reason must come first, not an ffmpeg error: ' + out[-800:]
    assert (os.path.getmtime(plan) if os.path.exists(plan) else None) == before, 'the check must run before the plan is written'
