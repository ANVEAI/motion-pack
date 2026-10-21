#!/usr/bin/env python3
"""The master contract (rules sound.master_ends_in_tp_limiter and sound.no_renderer_lowering, 21 Oct 2026): every master path ends in the 4x-oversampled
true-peak limiter, lands on -14 LUFS-I +/- 0.5 at <= -1.5 dBTP on the WAV, and every AAC probe encode (192k / 256k aac, aac_at) reads <= -1.1 dBTP;
templates/_shared/audio.py's SFX-only path (the film-scene mix stopped at -17.49 LUFS-I behind a peak-gain ceiling) reaches the target too.
Run: python3 -m pytest -q music/tests/test_master_delivery.py"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import _path  # noqa: F401,E402
from mpaudio import dsp, meter  # noqa: E402
import mixer  # noqa: E402
SR = dsp.SR
pytestmark = pytest.mark.skipif(shutil.which('ffmpeg') is None, reason='ffmpeg needed for the AAC probes')


def clicky(seconds=6.0, seed=7):
    """a quiet pad with dense, sharp clicks: the shape whose AAC encode overshoots its WAV peak"""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = 0.02 * np.stack([np.sin(2 * np.pi * 110 * t), np.sin(2 * np.pi * 165 * t)], 1)
    for k in range(int(seconds * 9)):
        a = int(rng.uniform(0.1, seconds - 0.1) * SR)
        c = np.exp(-np.arange(int(0.004 * SR)) / (0.0006 * SR)) * rng.choice([-1, 1])
        x[a:a + len(c)] += 0.9 * c[:, None]
    return x


def test_master_for_delivery_lands_target_ceiling_and_aac():
    out, G, g, ceil, probes = mixer.master_for_delivery(clicky(), -14.0, -1.5)
    assert abs(meter.lufs_integrated(out) + 14.0) <= 0.5
    assert meter.true_peak_db(out) <= -1.5 + 0.05
    assert probes and {p['bitrate'] for p in probes} >= {'192k', '256k'}
    assert max(p['true_peak_db'] for p in probes) <= mixer.AAC_TP_MAX + 1e-9, probes
    assert ceil <= -1.5 and g.min() < 1.0                                            # the limiter worked (dense clicks need gain reduction)


def test_a_peak_gain_only_master_falls_short_where_the_limiter_does_not():
    x = clicky()
    gain = dsp.db(-1.5 - meter.true_peak_db(x))                                         # the old SFX-only path: gain to the peak ceiling, no limiter
    assert meter.lufs_integrated(x * gain) < -16.0                                      # well short of -14 on dense transients
    out = mixer.master_for_delivery(x, -14.0, -1.5, aac=False)[0]
    assert abs(meter.lufs_integrated(out) + 14.0) <= 0.5


def test_the_sfx_only_template_path_reaches_target_through_the_limiter():
    plan = os.path.join(PACK, 'templates', 'film-scene', 'out', 'plan.json')
    lib = os.path.join(PACK, 'sfx', 'library')
    if not os.path.isdir(lib):
        pytest.skip('the sound library is not built (python3 sfx/build_library.py)')
    d = tempfile.mkdtemp(prefix='mp-master-')
    try:
        out = os.path.join(d, 'mix.wav')
        r = subprocess.run([sys.executable, os.path.join(PACK, 'templates', '_shared', 'audio.py'), plan, out], capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr
        rep = json.load(open(out + '.json'))
        assert rep['limiter'] is True and rep['reached_target'] and abs(rep['lufs_i'] + 14.0) <= 0.5, rep
        assert rep['true_peak_dbtp'] <= -1.45 and max(p['true_peak_db'] for p in rep['aac_probes']) <= mixer.AAC_TP_MAX + 1e-9, rep
    finally:
        shutil.rmtree(d, ignore_errors=True)
