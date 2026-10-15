#!/usr/bin/env python3
"""motion-pack / tools / human / conform.py: get your footage edit-ready: probe it, turn variable frame rate (phones, screen recorders) into constant frame rate, and sync a separate mic.

    python3 tools/human/conform.py probe clip.mp4                 # JSON: size, rotation, r_frame_rate vs avg_frame_rate, measured frame-interval spread, VFR yes/no, audio rate, A/V start offset
    python3 tools/human/conform.py cfr clip.mp4 clip-30.mp4 [--fps 30] [--crf 18]
                                                                  # constant frame rate (fps filter: duplicates / drops to the grid), 48 kHz audio stretched onto the video clock
                                                                  # (aresample async), start times reset to 0: HyperFrames and the pack's frame maths assume CFR
    python3 tools/human/conform.py sync camera.mp4 mic.wav [--max 10] [--apply mic-synced.wav]
                                                                  # the offset of the mic against the camera's own audio by envelope cross-correlation (a clap helps);
                                                                  # positive = the mic starts LATE; --apply writes the mic shifted onto the camera's clock

Why: a VFR clip has frames at uneven times, so "frame N" means different instants to different tools and lip sync drifts; screen recorders and phones record VFR to save space.
Determinism: probe and sync are pure measurements; cfr uses fixed filters and x264 settings."""
import argparse, json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile

SR = 48000


def ffprobe(args, src):
    r = subprocess.run(['ffprobe', '-v', 'error', *args, '-of', 'json', src], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def rate(s):
    n, d = (s or '0/1').split('/')
    return float(n) / float(d) if float(d or 0) else 0.0


def probe(src, n=900):
    info = ffprobe(['-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate,start_time,duration:stream_side_data=rotation:format=duration'], src)
    v = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)
    out = {'file': os.path.basename(src), 'duration': float(info['format'].get('duration', 0) or 0)}
    if v:
        fr = ffprobe(['-select_streams', 'v:0', '-read_intervals', '%+#' + str(n), '-show_entries', 'frame=pts_time,best_effort_timestamp_time'], src)['frames']
        ts = np.array([float(f.get('pts_time') or f.get('best_effort_timestamp_time') or 'nan') for f in fr], float)
        ts = np.sort(ts[np.isfinite(ts)])
        d = np.diff(ts) if len(ts) > 2 else np.array([0.0])
        med = float(np.median(d)) if len(d) else 0.0
        spread = float((np.percentile(d, 95) - np.percentile(d, 5)) / med) if med > 0 else 0.0
        rf, af = rate(v.get('r_frame_rate')), rate(v.get('avg_frame_rate'))
        rot = 0
        for sd in v.get('side_data_list', []) or []:
            rot = int(sd.get('rotation', 0) or 0)
        out.update({'width': v.get('width'), 'height': v.get('height'), 'rotation': rot, 'codec': v.get('codec_name'), 'r_frame_rate': round(rf, 4), 'avg_frame_rate': round(af, 4),
                    'frame_interval_median_s': round(med, 5), 'frame_interval_spread': round(spread, 3), 'frames_measured': int(len(ts)),
                    'vfr': bool(spread > 0.15 or (af > 0 and abs(rf - af) / af > 0.01)), 'video_start': float(v.get('start_time', 0) or 0)})
    if a:
        out.update({'audio_rate': int(a.get('sample_rate', 0) or 0), 'audio_start': float(a.get('start_time', 0) or 0)})
    if v and a:
        out['av_start_offset_s'] = round(out['audio_start'] - out['video_start'], 4)
    out['advice'] = ('VFR: run `conform.py cfr` before editing' if out.get('vfr') else 'CFR: ready') + ('; audio is not 48 kHz (cfr resamples it)' if a and out['audio_rate'] != SR else '')
    return out


def cfr(src, out, fps=30, crf=18):
    cmd = ['ffmpeg', '-v', 'error', '-y', '-nostdin', '-i', src, '-vf', f'fps={fps:g}:round=near,setpts=PTS-STARTPTS', '-fps_mode', 'cfr', '-r', f'{fps:g}',
           '-af', 'aresample=async=1:first_pts=0,aresample=48000', '-ar', str(SR), '-c:v', 'libx264', '-crf', str(crf), '-preset', 'medium', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    return probe(out)


def mono(src, sr=8000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src, '-vn', '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def envelope(x, sr=8000, hop=40):
    n = len(x) // hop
    e = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1))
    e = np.log10(e + 1e-6)
    e = np.diff(e, prepend=e[:1])            # onsets matter more than level: a clap aligns, a steady hum does not
    return np.maximum(e, 0)


def sync(ref, other, max_s=10.0, sr=8000, hop=40):
    a, b = envelope(mono(ref, sr), sr, hop), envelope(mono(other, sr), sr, hop)
    n = 1 << int(np.ceil(np.log2(len(a) + len(b))))
    c = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    lag = int(max_s * sr / hop)
    cand = np.concatenate([c[:lag + 1], c[-lag:]])
    lags = np.concatenate([np.arange(lag + 1), np.arange(-lag, 0)])
    k = int(np.argmax(cand))
    peak, mean, sd = cand[k], cand.mean(), cand.std() + 1e-12
    # refine to a sub-hop offset with a parabola through the peak
    i = k
    y0, y1, y2 = cand[i - 1] if i > 0 else peak, peak, cand[(i + 1) % len(cand)]
    frac = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0.0
    off = -(lags[k] + frac) * hop / sr          # positive: `other` starts late (its events come after the reference's)
    return {'offset_s': round(float(off), 4), 'confidence': round(float((peak - mean) / sd), 2), 'max_s': max_s, 'resolution_s': hop / sr}


def apply_offset(other, out, offset):
    """shift `other` onto the reference clock: drop its first `offset` s (late start) or pad silence (early)"""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', other, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2)
    k = int(round(abs(offset) * SR))
    y = y[k:] if offset > 0 else np.concatenate([np.zeros((k, 2), np.float32), y])
    wavfile.write(out, SR, y.astype(np.float32))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('probe'); p.add_argument('src')
    c = sp.add_parser('cfr'); c.add_argument('src'); c.add_argument('out'); c.add_argument('--fps', type=float, default=30); c.add_argument('--crf', type=int, default=18)
    s = sp.add_parser('sync'); s.add_argument('ref'); s.add_argument('other'); s.add_argument('--max', type=float, default=10.0); s.add_argument('--apply')
    a = ap.parse_args(argv)
    for f in [getattr(a, k) for k in ('src', 'ref', 'other') if hasattr(a, k)]:
        if not os.path.exists(f):
            sys.exit(f'conform: no such file {f}')
    if a.cmd == 'probe':
        print(json.dumps(probe(a.src), indent=1))
    elif a.cmd == 'cfr':
        print(json.dumps(cfr(a.src, a.out, a.fps, a.crf), indent=1))
    else:
        r = sync(a.ref, a.other, a.max)
        if a.apply:
            apply_offset(a.other, a.apply, r['offset_s'])
            r['applied'] = a.apply
        print(json.dumps(r, indent=1))


if __name__ == '__main__':
    main()
