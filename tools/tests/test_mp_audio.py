"""tools/mp-audio.mjs (rule sound.no_renderer_lowering): after a render, `mp render` puts the template's own master under the picture when the page plays exactly
one master, so a renderer that lowered the track (v0.4.0: flat 7.4 and 8.7 dB) cannot change what ships; any other page keeps its rendered audio and says why.
And the two lint checks that read the master's own report. Run: python3 -m pytest -q tools/tests/test_mp_audio.py"""
import json
import os
import shutil
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'tools'))
import playbook_checks as K  # noqa: E402
pytestmark = pytest.mark.skipif(shutil.which('ffmpeg') is None or shutil.which('node') is None, reason='needs ffmpeg and node')


def lufs(p):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    return float([ln for ln in r.stderr.splitlines() if ln.strip().startswith('I:')][-1].split()[1])


@pytest.fixture()
def proj(tmp_path):
    d = tmp_path / 'p'
    (d / 'assets' / 'media').mkdir(parents=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=f=440:d=3', '-af', 'volume=-30dB', '-ar', '48000', '-ac', '2', str(d / 'assets' / 'media' / 'mix.wav')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=d=3:s=320x180:r=30', '-f', 'lavfi', '-i', 'sine=f=440:d=3', '-af', 'volume=-6dB',
                    '-c:v', 'libx264', '-c:a', 'aac', '-shortest', str(tmp_path / 'r.mp4')], check=True)
    return d, tmp_path / 'r.mp4'


def page(d, body):
    (d / 'index.html').write_text('<!doctype html><body>%s</body>' % body)


def remux(d, mp4):
    return subprocess.run(['node', os.path.join(REPO, 'tools', 'mp-audio.mjs'), str(d), str(mp4)], capture_output=True, text=True)


def test_one_master_replaces_the_rendered_audio(proj):
    d, mp4 = proj
    page(d, '<video muted src="x.mp4"></video><audio id="mix" src="assets/media/mix.wav" data-start="0" data-duration="3" data-volume="1"></audio>')
    before = lufs(str(mp4))
    r = remux(d, mp4)
    assert r.returncode == 0 and 'remuxed' in r.stdout, r.stdout + r.stderr
    after, master = lufs(str(mp4)), lufs(str(d / 'assets' / 'media' / 'mix.wav'))
    assert abs(after - master) <= 0.5 and before - after > 15, (before, after, master)


@pytest.mark.parametrize('body,why', [
    ('<audio src="assets/media/mix.wav" data-volume="1"></audio><audio src="b.wav"></audio>', '2 audio elements'),
    ('<video src="clip.mp4" data-has-audio="true"></video><audio src="assets/media/mix.wav" data-start="0" data-volume="1"></audio>', 'carries sound'),
    ('<audio src="assets/media/mix.wav" data-start="0" data-volume="0.5"></audio>', 'volume 1 from 0'),
    ('<audio src="assets/media/none.wav" data-start="0" data-volume="1"></audio>', 'no master'),
])
def test_any_other_page_keeps_its_audio_and_says_why(proj, body, why):
    d, mp4 = proj
    page(d, body)
    before = open(mp4, 'rb').read()
    r = remux(d, mp4)
    assert r.returncode == 1 and why in r.stdout and open(mp4, 'rb').read() == before, r.stdout


def report(tmp_path, **kw):
    d = tmp_path / 'build' / 'assets' / 'media'
    d.mkdir(parents=True)
    rep = {'via': 'music/mixer.py', 'limiter': True, 'lufs_i': -14.02, 'true_peak_dbtp': -1.6, 'target_lufs': -14.0, 'aac_probes': [{'enc': 'aac', 'bitrate': '192k', 'true_peak_db': -1.3}]}
    rep.update(kw)
    json.dump(rep, open(d / 'mix.wav.json', 'w'))
    return str(tmp_path / 'build')


def check(cid, page_dir, ears=None):
    return K.run_check(cid, K.Ctx(None, ears, page_dir=page_dir), {})


def test_master_limiter_reads_the_master_report(tmp_path):
    assert check('lint.sound.master_limiter', report(tmp_path / 'a'))[0] == 'pass'
    assert check('lint.sound.master_limiter', report(tmp_path / 'b', limiter=False, via=None, lufs_i=-17.49, true_peak_dbtp=-2.0))[0] == 'fail'   # the v0.4.0 film-scene master
    assert check('lint.sound.master_limiter', report(tmp_path / 'c', aac_probes=[{'true_peak_db': -0.4}]))[0] == 'fail'
    assert check('lint.sound.master_limiter', report(tmp_path / 'd', true_peak_dbtp=-0.9))[0] == 'fail'
    assert check('lint.sound.master_limiter', None)[0] == 'na'


def test_renderer_lowering_compares_the_delivered_file_with_its_master(tmp_path):
    ears = lambda v: {'ears/loudness': {'status': 'pass', 'measured': {'integrated_lufs': v, 'true_peak_dbtp': -1.5}}}
    pd = report(tmp_path)
    assert check('lint.sound.renderer_lowering', pd, ears(-14.2))[0] == 'pass'
    r = check('lint.sound.renderer_lowering', pd, ears(-22.75))                                  # the v0.4.0 explainer-diagram render
    assert r[0] == 'fail' and '-8.7' in r[1]
    assert check('lint.sound.renderer_lowering', pd)[0] == 'na'
