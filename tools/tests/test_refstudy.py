#!/usr/bin/env python3
"""Smoke test for tools/refstudy.py on a generated 3 s clip (ffmpeg lavfi, no network, no Whisper): three colour shots cut at 1 s and 2 s over a
sine with a beep every second. Run: python3 -m pytest -q tools/tests"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import pytest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_refstudy_on_a_generated_clip():
    with tempfile.TemporaryDirectory() as td:
        clip = os.path.join(td, "clip.mp4")
        src = ["-f", "lavfi", "-i"]
        subprocess.run([FFMPEG, "-v", "error", "-nostdin", "-y",
                        *src, "color=c=red:s=320x240:r=30:d=1", *src, "color=c=blue:s=320x240:r=30:d=1", *src, "color=c=white:s=320x240:r=30:d=1",
                        *src, "sine=f=220:beep_factor=4:d=3:sample_rate=48000",
                        "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3",
                        "-c:v", "mpeg4", "-q:v", "5", "-c:a", "aac", "-shortest", clip], check=True)
        out = os.path.join(td, "out")
        r = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), clip, out, "--whisper", "none"], capture_output=True, text=True, timeout=180)
        assert r.returncode == 0, r.stderr
        for f in ("meta.json", "sheet.jpg", "timeline.png", "study.json"):
            assert os.path.getsize(os.path.join(out, f)) > 0, f
        st = json.load(open(os.path.join(out, "study.json")))
        assert abs(st["meta"]["duration"] - 3.0) < 0.1
        assert [round(c) for c in st["cuts"]] == [1, 2]                      # the two colour changes
        assert st["edit"]["shot_len_median_s"] == pytest.approx(1.0, abs=0.1)
        assert st["loudness"]["integrated_lufs"] is not None
        a = st["audio"]
        assert a["onsets"] and "_plot" not in a
        assert a["sync"]["cuts"] == 2 and a["sync"]["share_on_onset"] >= 0.5  # the cuts sit on the beeps
        assert st["speech"] is None
