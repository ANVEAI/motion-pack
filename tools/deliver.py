#!/usr/bin/env python3
"""motion-pack / tools / deliver.py: delivery and export profiles. Each preset is a PURE function from (source, output, options) to an ffmpeg
argument list; the CLI measures loudness first, builds the command, runs it and checks the file it wrote.

    python3 tools/deliver.py out/film.mp4 --preset youtube --out dist/          # measure, encode, verify
    python3 tools/deliver.py out/film.mp4 --preset broadcast-prores --region atsc --dry-run
    python3 tools/deliver.py --list

Every video preset writes BT.709 colour tags (primaries, transfer, matrix, limited range) and MP4 / MOV get +faststart (the index at the
front, so playback starts before the download ends). Loudness per preset, with its source, is in LOUDNESS; a master already within 0.5 LU
of the target and under the true-peak ceiling keeps its audio stream (copied for AAC targets), otherwise two-pass loudnorm (linear mode,
dynamics kept) brings it there. The pack rule: true peak <= -1 dBTP on the delivered file, so lossy outputs aim at -1.5 (the AAC decode
can overshoot by about half a dB)."""
import argparse
import json
import os
import re
import struct
import subprocess
import sys

TAGS = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
SCALE709 = 'scale=out_color_matrix=bt709:out_range=tv'
TAG709 = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'   # ffmpeg 7+ takes the stream tags from the frames; -color_* alone is not enough
PACK_MASTER = 'pack master spec (skills/motion-pack SKILL.md rule 5: -14 LUFS-I, delivered MP4 <= -1.0 dBTP)'

LOUDNESS = {   # target integrated loudness (LUFS / LKFS), true-peak ceiling (dBTP) and where the number comes from
    'pack': {'i': -14.0, 'tp': -1.0, 'lra': 11.0, 'grade': 'house', 'src': PACK_MASTER},
    'youtube': {'i': -14.0, 'tp': -1.0, 'lra': 11.0, 'grade': 'practitioner',
                'src': 'YouTube publishes no target; about -14 LUFS is reported by audio-tool makers (docs/research/launch-video-patterns.md); the pack master is -14 anyway'},
    'social': {'i': -14.0, 'tp': -1.0, 'lra': 11.0, 'grade': 'house',
               'src': 'Instagram, TikTok, X and LinkedIn publish no loudness target (skills/social-video references/platforms.md); one -14 master is the safe choice'},
    'web': {'i': -16.0, 'tp': -1.0, 'lra': 11.0, 'grade': 'house', 'src': 'templates/_shared/plan.mjs preset hero.web (lufs -16): a page plays at the listener\'s volume'},
    'ebu': {'i': -23.0, 'tp': -1.0, 'lra': 15.0, 'grade': 'platform', 'src': 'EBU R128: -23 LUFS integrated (+-0.5 LU), maximum true peak -1 dBTP (https://tech.ebu.ch/docs/r/r128.pdf)'},
    'atsc': {'i': -24.0, 'tp': -2.0, 'lra': 15.0, 'grade': 'platform',
             'src': 'ATSC A/85 (US broadcast): -24 LKFS integrated, true peak -2 dBTP; check the current revision and the broadcaster\'s own spec sheet'},
}

YT_SRC = 'YouTube Help "Recommended upload encoding settings" (support.google.com/youtube/answer/1722171): H.264 High, progressive, 4:2:0, closed GOP of half the frame rate, 2 B-frames, AAC-LC 48 kHz, moov at the front'


def _h264(crf, fps, preset='slow', tune=None, gop_s=None, closed=False, bf=None):
    a = ['-c:v', 'libx264', '-profile:v', 'high', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p']
    if tune:
        a += ['-tune', tune]
    if gop_s:
        a += ['-g', str(max(1, int(round(fps * gop_s)))), '-keyint_min', str(max(1, int(round(fps * gop_s))))]
    if closed:
        a += ['-flags', '+cgop']
    if bf is not None:
        a += ['-bf', str(bf)]
    return a + TAGS


PRESETS = {
    'youtube': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'youtube', 'aspect': '16:9', 'src': YT_SRC,
                'video': lambda o: _h264(18, o['fps'], gop_s=0.5, closed=True, bf=2), 'audio': ['-c:a', 'aac', '-b:a', '384k', '-ar', '48000']},
    'shorts': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'youtube', 'aspect': '9:16', 'src': YT_SRC + '; Shorts up to 3 minutes (YouTube Help 15424877)',
               'video': lambda o: _h264(18, o['fps'], gop_s=0.5, closed=True, bf=2), 'audio': ['-c:a', 'aac', '-b:a', '384k', '-ar', '48000'], 'max_s': 180},
    'reels': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'social', 'aspect': '9:16', 'src': 'skills/social-video references/platforms.md (H.264 + AAC MP4, 1080 x 1920)',
              'video': lambda o: _h264(19, o['fps'], gop_s=2), 'audio': ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000']},
    'tiktok': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'social', 'aspect': '9:16', 'src': 'skills/social-video references/platforms.md',
               'video': lambda o: _h264(19, o['fps'], gop_s=2), 'audio': ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000']},
    'x': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'social', 'aspect': 'any', 'src': 'skills/social-video: standard accounts 2 min 20 s and 512 MB per video',
          'video': lambda o: _h264(20, o['fps'], gop_s=2), 'audio': ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'], 'max_s': 140, 'max_mb': 512},
    'linkedin': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'social', 'aspect': 'any', 'src': 'skills/social-video: MP4 with H.264 and AAC is the safe container',
                 'video': lambda o: _h264(20, o['fps'], gop_s=2), 'audio': ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000']},
    'broadcast-prores': {'kind': 'mov', 'ext': 'mov', 'loud': 'ebu', 'aspect': 'any', 'src': 'Apple ProRes 422 HQ (prores_ks profile 3), 10-bit 4:2:2, 24-bit PCM 48 kHz; loudness by --region (ebu / atsc)',
                         'video': lambda o: ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le'] + TAGS,
                         'audio': ['-c:a', 'pcm_s24le', '-ar', '48000']},
    'web-h264': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'web', 'aspect': 'any', 'src': 'pack web default: H.264 High CRF 23 (the pack demo setting), faststart',
                 'video': lambda o: _h264(23, o['fps'], gop_s=2), 'audio': ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000']},
    'web-hevc': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'web', 'aspect': 'any', 'src': 'HEVC in MP4 tagged hvc1 (the tag Apple players require); CRF 26',
                 'video': lambda o: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '26', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1',
                                     '-x265-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited:log-level=error'] + TAGS,
                 'audio': ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000']},
    'web-av1': {'kind': 'mp4', 'ext': 'mp4', 'loud': 'web', 'aspect': 'any', 'src': 'AV1 (SVT-AV1) in MP4, CRF 35 preset 8; check your audience\'s browsers decode AV1',
                'video': lambda o: ['-c:v', 'libsvtav1', '-preset', '8', '-crf', '35', '-pix_fmt', 'yuv420p', '-g', str(int(round(o['fps'] * 2)))] + TAGS,
                'audio': ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000']},
    'gif': {'kind': 'gif', 'ext': 'gif', 'loud': None, 'aspect': 'any', 'src': 'two-pass palette (palettegen diff + paletteuse bayer dither), 15 fps, 480 px wide, loops forever',
            'video': None, 'audio': None},
    'webp': {'kind': 'webp', 'ext': 'webp', 'loud': None, 'aspect': 'any', 'src': 'animated WebP (libwebp_anim), quality 75, 15 fps, 480 px wide, loops forever; needs an ffmpeg built with libwebp',
             'video': lambda o: ['-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '75', '-loop', '0'], 'audio': None},
    'alpha-prores4444': {'kind': 'mov', 'ext': 'mov', 'loud': 'pack', 'aspect': 'any', 'alpha': True,
                         'src': 'ProRes 4444 with a 16-bit alpha channel (prores_ks profile 4, yuva444p10le): overlays for editors',
                         'video': lambda o: ['-c:v', 'prores_ks', '-profile:v', '4', '-vendor', 'apl0', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16'] + TAGS,
                         'audio': ['-c:a', 'pcm_s24le', '-ar', '48000']},
    'alpha-webm': {'kind': 'webm', 'ext': 'webm', 'loud': 'web', 'aspect': 'any', 'alpha': True,
                   'src': 'VP9 with alpha in WebM (yuva420p), CRF 30, alt-ref frames off; browsers without VP9-alpha support show it opaque, so test the target browsers',
                   'video': lambda o: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-auto-alt-ref', '0'] + TAGS,
                   'audio': ['-c:a', 'libopus', '-b:a', '128k', '-ar', '48000']},
}


def policy(preset, region='ebu'):
    """the loudness policy of a preset ({i, tp, lra, grade, src}) or None (no audio). Lossy outputs aim 0.5 dB under the ceiling."""
    p = PRESETS[preset]
    key = region if preset == 'broadcast-prores' else p['loud']
    if key is None:
        return None
    pol = dict(LOUDNESS[key], key=key)
    lossy = (p.get('audio') or [None, None])[1] not in ('pcm_s24le',)
    pol['tp_aim'] = pol['tp'] - 0.5 if lossy else pol['tp']
    return pol


def measure_args(src, pol):
    """pass 1 of loudnorm: prints the measured JSON on stderr"""
    return ['-hide_banner', '-nostats', '-i', src, '-vn', '-af', 'loudnorm=I=%.1f:TP=%.1f:LRA=%.1f:print_format=json' % (pol['i'], pol['tp_aim'], pol['lra']), '-f', 'null', '-']


def parse_measure(stderr):
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', stderr, re.S)
    if not m:
        return None
    d = json.loads(m.group(0))
    return {k: float(v) for k, v in d.items() if k in ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset')}


def needs_norm(meas, pol, tol=0.5):
    if not meas or pol is None:
        return pol is not None and meas is None
    return abs(meas['input_i'] - pol['i']) > tol or meas['input_tp'] > pol['tp']


def loudnorm_filter(meas, pol):
    """pass 2: linear loudnorm (one gain, dynamics kept) from the measured values, then back to 48 kHz (loudnorm works at 192 kHz)"""
    return ('loudnorm=I=%.1f:TP=%.1f:LRA=%.1f:measured_I=%.2f:measured_TP=%.2f:measured_LRA=%.2f:measured_thresh=%.2f:offset=%.2f:linear=true:print_format=summary,'
            'aresample=48000' % (pol['i'], pol['tp_aim'], pol['lra'], meas['input_i'], meas['input_tp'], meas['input_lra'], meas['input_thresh'], meas['target_offset']))


def build(preset, src, out, fps=30.0, measured=None, region='ebu', src_codec=None, has_audio=True, width=None, src_alpha_vp9=False):
    """PURE: the ffmpeg argument list (without the program name) for one preset.
    measured: the pass-1 loudnorm JSON (parse_measure) or None (no loudness change: audio is copied when the codec already matches, else re-encoded).
    src_codec: the source audio codec ('aac' allows a copy into an AAC preset). src_alpha_vp9: decode a VP9 WebM with libvpx so its alpha plane survives."""
    p = PRESETS[preset]
    o = {'fps': float(fps)}
    a = ['-y', '-v', 'error']
    if src_alpha_vp9:
        a += ['-c:v', 'libvpx-vp9']
    a += ['-i', src]
    if p['kind'] == 'gif':
        w = width or 480
        g = 'fps=15,scale=%d:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' % w
        return a + ['-filter_complex', g, '-an', '-loop', '0', out]
    if p['kind'] == 'webp':
        return a + ['-vf', 'fps=15,scale=%d:-2:flags=lanczos' % (width or 480), '-an'] + p['video'](o) + [out]
    vf = ([SCALE709] if not p.get('alpha') else []) + [TAG709]
    if width:
        vf.insert(0, 'scale=%d:-2:flags=lanczos' % width)
    a += ['-map', '0:v:0']
    if vf:
        a += ['-vf', ','.join(vf)]
    a += p['video'](o)
    pol = policy(preset, region)
    if has_audio and p.get('audio'):
        a += ['-map', '0:a:0?']
        if measured and needs_norm(measured, pol):
            a += ['-af', loudnorm_filter(measured, pol)] + p['audio']
        elif p['audio'][1] == 'aac' and src_codec == 'aac':
            a += ['-c:a', 'copy']
        else:
            a += p['audio']
    else:
        a += ['-an']
    if p['kind'] in ('mp4', 'mov'):
        a += ['-movflags', '+faststart' + ('+write_colr' if p['kind'] == 'mov' else '')]
    return a + [out]


# ------------------------------------------------------------------------------------------------ verification of the written file
def atoms(path):
    """top-level MP4 / MOV atoms in order (type, offset)"""
    out = []
    with open(path, 'rb') as f:
        size_total = os.path.getsize(path)
        off = 0
        while off + 8 <= size_total:
            f.seek(off)
            hdr = f.read(16)
            n, t = struct.unpack('>I4s', hdr[:8])
            if n == 1:
                n = struct.unpack('>Q', hdr[8:16])[0]
            elif n == 0:
                n = size_total - off
            out.append((t.decode('latin-1'), off))
            if n < 8:
                break
            off += n
    return out


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,codec_tag_string,profile,pix_fmt,width,height,color_primaries,color_transfer,'
                        'color_space,color_range,sample_rate:stream_tags=alpha_mode:format=duration,size', '-of', 'json', path], capture_output=True, text=True)
    return json.loads(r.stdout or '{}')


def loudness(path):
    """integrated LUFS and true peak dBTP of the file's audio (ffmpeg ebur128, true-peak metering)"""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    i = re.findall(r'I:\s+(-?[\d.]+|-inf) LUFS', r.stderr)
    tp = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r.stderr)
    f = lambda v: float('-inf') if v == '-inf' else float(v)  # noqa: E731
    return (f(i[-1]) if i else None, f(tp[-1]) if tp else None)


def verify(path, preset, region='ebu'):
    """[(ok, what)] for the written file: codec, pixel format, BT.709 tags, faststart, alpha, limits, loudness"""
    p = PRESETS[preset]
    d = probe(path)
    v = next((s for s in d.get('streams', []) if s.get('codec_type') == 'video'), {})
    au = next((s for s in d.get('streams', []) if s.get('codec_type') == 'audio'), None)
    out = []
    want = {'mp4': None, 'mov': 'prores', 'gif': 'gif', 'webp': 'webp', 'webm': 'vp9'}[p['kind']]
    if want:
        out.append((v.get('codec_name') == want, 'video codec %s (want %s)' % (v.get('codec_name'), want)))
    if p['kind'] not in ('gif', 'webp'):
        tags = (v.get('color_primaries'), v.get('color_transfer'), v.get('color_space'))
        out.append((tags == ('bt709', 'bt709', 'bt709'), 'colour tags %s/%s/%s (want bt709)' % tags))
    if p['kind'] in ('mp4', 'mov'):
        at = [t for t, _ in atoms(path)]
        ok = 'moov' in at and 'mdat' in at and at.index('moov') < at.index('mdat')
        out.append((ok, 'faststart: moov %s mdat' % ('before' if ok else 'after')))
    if p.get('alpha'):
        amin = alpha_min(path, p['kind'] == 'webm')
        out.append((amin is not None and amin < 250, 'alpha plane decoded (min alpha %s of 255)' % amin))
    dur = float((d.get('format') or {}).get('duration') or 0)
    if p.get('max_s'):
        out.append((dur <= p['max_s'] + 0.05, 'duration %.2f s (max %d s)' % (dur, p['max_s'])))
    if p.get('max_mb'):
        mb = int((d.get('format') or {}).get('size') or 0) / 1e6
        out.append((mb <= p['max_mb'], 'size %.1f MB (max %d MB)' % (mb, p['max_mb'])))
    pol = policy(preset, region)
    if au and pol:
        i, tp = loudness(path)
        if i is not None and dur >= 3.0:
            out.append((abs(i - pol['i']) <= 1.0, 'integrated %.1f LUFS (target %.0f, %s)' % (i, pol['i'], pol['key'])))
        if tp is not None:
            out.append((tp <= pol['tp'] + 1e-6, 'true peak %.2f dBTP (max %.1f)' % (tp, pol['tp'])))
    return out


def alpha_min(path, vp9=False):
    """the smallest alpha value of the first frame, decoded to RGBA (libvpx for VP9, whose alpha the native decoder drops); None when it cannot decode"""
    r = subprocess.run(['ffmpeg', '-v', 'error'] + (['-c:v', 'libvpx-vp9'] if vp9 else []) + ['-i', path, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                       capture_output=True)
    if r.returncode or len(r.stdout) < 4:
        return None
    return min(r.stdout[3::4])


def encoders():
    r = subprocess.run(['ffmpeg', '-hide_banner', '-encoders'], capture_output=True, text=True)
    return set(re.findall(r'^\s*[VAS][\w.]{5}\s+(\S+)', r.stdout, re.M))


def needed_encoder(preset):
    args = build(preset, 'in', 'out')
    return [args[i + 1] for i, x in enumerate(args) if x in ('-c:v', '-c:a') and args[i + 1] != 'copy' and i > args.index('-i')]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('src', nargs='?')
    ap.add_argument('--preset', action='append', help='repeatable; see --list')
    ap.add_argument('--out', default='dist')
    ap.add_argument('--region', default='ebu', choices=['ebu', 'atsc'], help='broadcast loudness standard for broadcast-prores')
    ap.add_argument('--width', type=int, help='scale to this width (keeps the aspect)')
    ap.add_argument('--alpha-src', action='store_true', help='the source is a VP9 WebM with alpha (decode with libvpx so alpha survives)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args(argv)
    if a.list or not a.src:
        for k, p in PRESETS.items():
            pol = policy(k, a.region)
            print('%-18s %-5s %s  loudness: %s' % (k, p['ext'], p['src'], 'none' if pol is None else '%.0f LUFS / %.1f dBTP (%s, %s)' % (pol['i'], pol['tp'], pol['key'], pol['grade'])))
        return 0
    info = probe(a.src)
    au = next((s for s in info.get('streams', []) if s.get('codec_type') == 'audio'), None)
    fr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate', '-of', 'csv=p=0', a.src], capture_output=True, text=True).stdout.strip()
    n, _, dd = fr.partition('/')
    fps = float(n) / float(dd or 1) if n and float(n) else 30.0
    have = encoders()
    os.makedirs(a.out, exist_ok=True)
    bad = 0
    for preset in a.preset or ['youtube']:
        miss = [e for e in needed_encoder(preset) if e not in have]
        if miss:
            print('%s: this ffmpeg has no %s encoder; skipped' % (preset, ', '.join(miss)))
            bad += 1
            continue
        pol = policy(preset, a.region)
        meas = None
        if au and pol:
            r = subprocess.run(['ffmpeg'] + measure_args(a.src, pol), capture_output=True, text=True)
            meas = parse_measure(r.stderr)
        out = os.path.join(a.out, '%s.%s.%s' % (os.path.splitext(os.path.basename(a.src))[0], preset, PRESETS[preset]['ext']))
        args = build(preset, a.src, out, fps, meas, a.region, au.get('codec_name') if au else None, bool(au), a.width, a.alpha_src)
        print('%s: ffmpeg %s' % (preset, ' '.join(args)))
        if a.dry_run:
            continue
        r = subprocess.run(['ffmpeg'] + args)
        if r.returncode:
            bad += 1
            continue
        for ok, what in verify(out, preset, a.region):
            print('  %s %s' % ('ok  ' if ok else 'FAIL', what))
            bad += 0 if ok else 1
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
