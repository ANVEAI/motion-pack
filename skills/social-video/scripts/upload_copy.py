#!/usr/bin/env python3
"""upload_copy.py: make an upload copy of a master MP4 under a size cap (two-pass x264), and measure how close it stays.

Why: some browser-automation tools cap a single file upload (around 10 MB), while a 1080p master can be several times that.
The copy keeps the master's resolution and frame rate, re-encodes the video in two passes to fit the cap, keeps the master's
AAC audio untouched when it can (so the measured loudness and true peak do not change), and reports PSNR against the master.

usage: python3 upload_copy.py <master.mp4> [--out DIR] [--max-mb 9.5] [--tune animation|film|none]
                              [--audio auto|copy|aac] [--abr 128] [--min-psnr 44] [--force] [--json]
  --out       folder for <name>-upload.mp4 (default: an upload/ folder next to the master)
  --max-mb    size cap in MB (10^6 bytes); default 9.5 leaves headroom under a 10 MB limit
  --tune      x264 tune: animation for CG, motion graphics and screen content (default); film for camera footage
  --audio     auto (default) copies AAC audio and re-encodes anything else; copy forces a copy; aac forces a re-encode at --abr
  --min-psnr  house default 44 dB: below it the copy is likely visibly softer, so upload the master by hand instead
  --force     encode even if the master is already under the cap
Exit: 0 = copy under the cap and PSNR at or above --min-psnr (or the master already fits); 1 = could not get under the cap;
3 = under the cap but PSNR below --min-psnr; 2 = bad input or missing ffmpeg/ffprobe.
Needs ffmpeg and ffprobe with libx264 on PATH. Standard library only.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe(path):
    p = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,bit_rate,width,height,r_frame_rate',
             '-of', 'json', path])
    if p.returncode:
        raise SystemExit(f'ffprobe failed on {path}: {p.stderr.strip()}')
    d = json.loads(p.stdout)
    v = next((s for s in d.get('streams', []) if s.get('codec_type') == 'video'), None)
    a = next((s for s in d.get('streams', []) if s.get('codec_type') == 'audio'), None)
    return float(d['format']['duration']), int(d['format'].get('size', 0)), v, a


def psnr(copy, master):
    p = run(['ffmpeg', '-hide_banner', '-nostats', '-i', copy, '-i', master, '-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-'])
    m = re.findall(r'average:([0-9.]+|inf)', p.stderr)
    return float('inf') if m and m[-1] == 'inf' else (float(m[-1]) if m else None)


def main(argv):
    pos = [a for a in argv if not a.startswith('--')]
    opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv and argv.index(k) + 1 < len(argv) else d
    if not pos:
        print(__doc__)
        return 2
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            print(f'{tool} not found on PATH')
            return 2
    master = os.path.abspath(pos[0])
    if not os.path.isfile(master):
        print(f'no such file: {master}')
        return 2
    max_mb = float(opt('--max-mb', 9.5))
    tune = opt('--tune', 'animation')
    audio_mode = opt('--audio', 'auto')
    abr = int(opt('--abr', 128))
    min_psnr = float(opt('--min-psnr', 44))
    out_dir = os.path.abspath(opt('--out', os.path.join(os.path.dirname(master), 'upload')))
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(master))[0]
    out = os.path.join(out_dir, f'{base}-upload.mp4')
    cap = max_mb * 1e6

    dur, size, v, a = probe(master)
    if v is None:
        print('the master has no video stream')
        return 2
    report = {'master': master, 'master_bytes': size, 'duration_s': round(dur, 3), 'cap_bytes': int(cap)}
    if size <= cap and '--force' not in argv:
        report.update({'out': master, 'note': 'the master already fits under the cap: upload the master itself'})
        print(json.dumps(report) if '--json' in argv else f'{master} is {size / 1e6:.2f} MB, under {max_mb} MB: upload the master itself')
        return 0

    copy_audio = a is not None and (audio_mode == 'copy' or (audio_mode == 'auto' and a.get('codec_name') == 'aac'))
    a_kbps = 0
    if a is not None:
        a_kbps = (int(a.get('bit_rate') or 0) // 1000 or 256) if copy_audio else abr
    # video budget: 97% of the cap (container overhead), minus audio; clamped to a sane range
    vk = int(max(300, min(6000, (cap * 8 * 0.97 / dur) / 1000 - a_kbps)))
    audio_args = (['-c:a', 'copy'] if copy_audio else ['-c:a', 'aac', '-b:a', f'{abr}k']) if a is not None else ['-an']
    tune_args = [] if tune == 'none' else ['-tune', tune]
    got = None
    with tempfile.TemporaryDirectory(prefix='upload-copy-') as tmp:      # two-pass logs live and die here
        log = os.path.join(tmp, 'pass')
        for attempt in range(1, 6):
            common = ['-c:v', 'libx264', '-preset', 'slow', *tune_args, '-b:v', f'{vk}k']
            p1 = run(['ffmpeg', '-v', 'error', '-y', '-i', master, *common, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', os.devnull])
            if p1.returncode:
                print('ffmpeg pass 1 failed:', p1.stderr.strip()[-800:])
                return 2
            p2 = run(['ffmpeg', '-v', 'error', '-y', '-i', master, *common, '-maxrate', f'{vk * 18 // 10}k', '-bufsize', f'{vk * 25 // 10}k',
                      '-pass', '2', '-passlogfile', log, '-pix_fmt', 'yuv420p', '-profile:v', 'high', *audio_args, '-movflags', '+faststart', out])
            if p2.returncode:
                print('ffmpeg pass 2 failed:', p2.stderr.strip()[-800:])
                return 2
            got = os.path.getsize(out)
            if got <= cap:
                break
            # shrink the video budget by the measured overshoot (audio and container bytes do not shrink), plus 3% margin
            a_bytes = a_kbps * 1000 / 8 * dur
            vk = max(50, int(vk * max(0.5, (cap - a_bytes) / max(1.0, got - a_bytes)) * 0.97))
    q = psnr(out, master)
    report.update({'out': out, 'out_bytes': got, 'video_kbps': vk, 'audio': 'copied' if copy_audio else (f'aac {abr}k' if a else 'none'),
                   'attempts': attempt, 'psnr_db': None if q is None else (q if q != float('inf') else 'inf'), 'min_psnr_db': min_psnr})
    if '--json' in argv:
        print(json.dumps(report))
    else:
        print(f'{out}  {got / 1e6:.2f} MB (cap {max_mb} MB)  video {vk} kbps  audio {report["audio"]}  PSNR {q if q is not None else "?"} dB  attempts {attempt}')
    if got > cap:
        print('could not get under the cap: shorten the video, lower the resolution, or upload the master by hand')
        return 1
    if q is not None and q < min_psnr:
        print(f'PSNR {q:.1f} dB is under {min_psnr} dB: look at a frame of the copy; if it is soft, upload the master by hand')
        return 3
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
