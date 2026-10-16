#!/usr/bin/env python3
"""tools/deliver.py: every preset is a pure function to an ffmpeg argument list (checked field by field), loudness policies carry a source, and
real encodes run on a 1-second 128x72 synthetic clip (codec, BT.709 tags, faststart, alpha). Run: python3 -m pytest -q tools/tests/test_deliver.py"""
import os
import shutil
import subprocess
import sys

import pytest

TOOLS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, TOOLS)
import deliver as D                                             # noqa: E402

FF = shutil.which('ffmpeg')
VIDEO = [k for k, p in D.PRESETS.items() if p['kind'] in ('mp4', 'mov', 'webm')]


def val(args, flag):
    return args[args.index(flag) + 1]


def test_every_preset_is_pure_and_names_its_source():
    for k, p in D.PRESETS.items():
        a1 = D.build(k, 'in.mp4', 'out.' + p['ext'])
        assert a1 == D.build(k, 'in.mp4', 'out.' + p['ext']), k
        assert a1[-1] == 'out.' + p['ext'] and a1[a1.index('-i') + 1] == 'in.mp4'
        assert len(p['src']) > 20, k
        pol = D.policy(k)
        assert pol is None or (pol['src'] and pol['grade'] in ('platform', 'practitioner', 'house'))


@pytest.mark.parametrize('k', VIDEO)
def test_video_presets_tag_bt709_and_faststart(k):
    a = D.build(k, 'in.mp4', 'out')
    for flag in ('-color_primaries', '-color_trc', '-colorspace'):
        assert val(a, flag) == 'bt709', (k, flag)
    assert val(a, '-color_range') == 'tv'
    assert D.TAG709 in val(a, '-vf')                                  # the frames carry the tags too (ffmpeg 7+)
    if D.PRESETS[k]['kind'] in ('mp4', 'mov'):
        assert '+faststart' in val(a, '-movflags')


def test_codec_specifics():
    yt = D.build('youtube', 'in.mp4', 'o.mp4', fps=30)
    assert val(yt, '-c:v') == 'libx264' and val(yt, '-profile:v') == 'high' and val(yt, '-pix_fmt') == 'yuv420p'
    assert val(yt, '-g') == '15' and val(yt, '-bf') == '2' and '+cgop' in yt                       # closed GOP of half the frame rate
    pr = D.build('broadcast-prores', 'in.mp4', 'o.mov')
    assert val(pr, '-c:v') == 'prores_ks' and val(pr, '-profile:v') == '3' and val(pr, '-pix_fmt') == 'yuv422p10le' and val(pr, '-c:a') == 'pcm_s24le'
    hv = D.build('web-hevc', 'in.mp4', 'o.mp4')
    assert val(hv, '-tag:v') == 'hvc1'
    a4 = D.build('alpha-prores4444', 'in.mov', 'o.mov')
    assert val(a4, '-profile:v') == '4' and val(a4, '-pix_fmt') == 'yuva444p10le' and 'scale=out_color_matrix' not in val(a4, '-vf')
    vp = D.build('alpha-webm', 'in.webm', 'o.webm', src_alpha_vp9=True)
    assert vp.index('libvpx-vp9') < vp.index('-i') and val(vp, '-pix_fmt') == 'yuva420p' and val(vp, '-auto-alt-ref') == '0'
    gif = D.build('gif', 'in.mp4', 'o.gif')
    assert 'palettegen' in val(gif, '-filter_complex') and '-an' in gif and val(gif, '-loop') == '0'


def test_loudness_policies_and_the_true_peak_rule():
    assert D.policy('broadcast-prores', 'ebu')['i'] == -23 and D.policy('broadcast-prores', 'atsc')['i'] == -24
    assert D.policy('broadcast-prores', 'atsc')['tp'] == -2.0
    assert D.policy('youtube')['tp_aim'] == -1.5 and D.policy('broadcast-prores')['tp_aim'] == -1.0       # lossy aims 0.5 dB under the ceiling
    assert D.policy('gif') is None
    for k in ('reels', 'tiktok', 'x', 'linkedin'):
        assert D.policy(k)['grade'] == 'house'                       # no platform publishes a number: the pack says so


def test_loudnorm_only_when_needed_and_copy_otherwise():
    on = {'input_i': -14.2, 'input_tp': -1.6, 'input_lra': 4.0, 'input_thresh': -24.5, 'target_offset': 0.1}
    off = dict(on, input_i=-19.0)
    a = D.build('youtube', 'in.mp4', 'o.mp4', measured=on, src_codec='aac')
    assert val(a, '-c:a') == 'copy' and '-af' not in a              # a -14 master is not touched
    b = D.build('youtube', 'in.mp4', 'o.mp4', measured=off, src_codec='aac')
    af = val(b, '-af')
    assert 'linear=true' in af and 'measured_I=-19.00' in af and 'TP=-1.5' in af and af.endswith('aresample=48000') and val(b, '-c:a') == 'aac'
    hot = dict(on, input_tp=-0.4)
    assert D.needs_norm(hot, D.policy('youtube'))                   # over the ceiling, even at the right loudness
    c = D.build('broadcast-prores', 'in.mp4', 'o.mov', measured=on, region='ebu')
    assert 'I=-23.0' in val(c, '-af')


def test_parse_measure():
    err = 'junk\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-20.50",\n\t"input_tp" : "-3.10",\n\t"input_lra" : "5.20",\n\t"input_thresh" : "-31.00",\n' \
          '\t"output_i" : "-14.0",\n\t"target_offset" : "0.20"\n}\n'
    m = D.parse_measure(err)
    assert m == {'input_i': -20.5, 'input_tp': -3.1, 'input_lra': 5.2, 'input_thresh': -31.0, 'target_offset': 0.2}


# ------------------------------------------------------------------------------------------------ real encodes on a 1-second fixture
@pytest.fixture(scope='module')
def clips(tmp_path_factory):
    if FF is None:
        pytest.skip('ffmpeg not installed')
    d = tmp_path_factory.mktemp('deliver')
    mp4, webm = str(d / 'fx.mp4'), str(d / 'fxa.webm')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=128x72:r=30:d=1', '-f', 'lavfi', '-i', 'sine=f=440:r=48000:d=1',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', mp4], check=True)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red@0.5:s=128x72:r=30:d=1,format=rgba', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                    '-auto-alt-ref', '0', webm], check=True)
    return d, mp4, webm


@pytest.mark.parametrize('k', ['youtube', 'reels', 'broadcast-prores', 'web-h264', 'web-hevc', 'web-av1', 'gif', 'webp', 'alpha-prores4444', 'alpha-webm'])
def test_real_encode(clips, k):
    d, mp4, webm = clips
    miss = [e for e in D.needed_encoder(k) if e not in D.encoders()]
    if miss:
        pytest.skip('this ffmpeg has no %s' % ', '.join(miss))
    alpha = bool(D.PRESETS[k].get('alpha'))
    out = str(d / ('o.%s.%s' % (k, D.PRESETS[k]['ext'])))
    args = D.build(k, webm if alpha else mp4, out, fps=30, src_codec=None if alpha else 'aac', has_audio=not alpha, src_alpha_vp9=alpha)
    subprocess.run([FF] + args, check=True)
    res = D.verify(out, k)
    assert res and all(ok for ok, _ in res), res
