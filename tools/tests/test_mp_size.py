#!/usr/bin/env python3
"""tools/mp-size.mjs: after every render `mp render` ffprobes the file and fails when its WxH is not the size of the aspect in its name (16 Oct: 1920x1080
files named -9x16 and a 1080x1920 file named -16x9 left the queue as if they were fine). `mp check` runs the same check on every render in renders/.
Run: python3 -m pytest -q tools/tests"""
import os
import re
import shutil
import subprocess

import pytest

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FF = shutil.which('ffmpeg')


def _clip(path, w, h):
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=%dx%d:r=30:d=0.2' % (w, h), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path], check=True)


def _size(mp4, aspect):
    return subprocess.run(['node', os.path.join(PACK, 'tools', 'mp-size.mjs'), mp4, aspect], capture_output=True, text=True)


@pytest.mark.skipif(FF is None or shutil.which('ffprobe') is None, reason='ffmpeg / ffprobe not installed')
def test_the_size_check_passes_the_right_size_and_fails_a_mislabelled_file(tmp_path):
    wide, tall = str(tmp_path / 'x-16x9.mp4'), str(tmp_path / 'x-9x16.mp4')
    _clip(wide, 1920, 1080)
    _clip(tall, 1920, 1080)          # the 16 Oct bug: a 16:9 picture under a 9:16 name
    r = _size(wide, '16:9')
    assert r.returncode == 0 and '1920x1080 = 16:9 ok' in r.stdout, r.stdout + r.stderr
    r = _size(tall, '9:16')
    assert r.returncode == 1 and '1920x1080' in r.stdout and 'needs 1080x1920' in r.stdout, r.stdout + r.stderr
    r = _size(str(tmp_path / 'missing.mp4'), '9:16')
    assert r.returncode == 2


def test_mp_render_and_check_run_the_size_check():
    src = open(os.path.join(PACK, 'tools', 'mp.mjs'), encoding='utf-8').read()
    render = src.split('async function cmdRender', 1)[1].split('\nfunction ', 1)[0]
    assert re.search(r'sizeProblem\(out, a\)', render) and 'WRONG-SIZE' in render, 'mp render must fail (and rename) a file at the wrong size for its aspect'
    check = src.split('async function cmdCheck', 1)[1]
    assert 'sizeProblem(mp4' in check, 'mp check must check the size of every render'
