#!/usr/bin/env python3
"""motion-pack / tools / human / voice_chain.py: a loudness-safe voice chain with deterministic ffmpeg filters (your own recording in, a clean voice WAV out).

    python3 tools/human/voice_chain.py talk.mp4 voice.wav                 # HPF 80 Hz -> de-ess -> compressor -> gain to -14 LUFS-I -> limiter -> true peak <= -1.5 dBTP
    python3 tools/human/voice_chain.py talk.wav voice.wav --no-loudness   # the tone chain only (a stem that music/mixer.py masters later: the human templates do this)
    python3 tools/human/voice_chain.py talk.wav voice.wav --target -16 --ceiling -2 --hpf 100 --deess 0.5 --ratio 2.5 --threshold-db -22 --json report.json

Order and why (one fixed order, every stage named in the report):
  1 highpass   (ffmpeg highpass, 2 poles, default 80 Hz): rumble, handling noise and desk thumps out before the compressor reacts to them
  2 de-esser   (ffmpeg deesser, intensity 0.35): tames sibilance that the compressor and the limiter would otherwise exaggerate
  3 compressor (ffmpeg acompressor, -20 dBFS threshold, 3:1, 8 ms attack, 120 ms release, soft knee): steadier level so captions-on-mute viewers who unmute are not shocked
  4 loudness   (the pack's own BS.1770 meter, sfx/mpaudio/meter.py): one linear gain to the target LUFS-I (no dynamic loudnorm: that pumps)
  5 limiter    (ffmpeg alimiter, lookahead 5 ms, release 50 ms) then a 4x-oversampled true-peak check; if the check is over the ceiling the gain is trimmed and 4-5 run again (<= 6 rounds)
Determinism: ffmpeg filters with fixed parameters and the same build give identical samples; the gain is computed from the meter, so two runs of the same input are byte-identical (the tests check it).
Not included on purpose: noise reduction (afftdn changes timbre and is a taste call: add --denoise if you want it), and any voice changing. This chain never alters WHAT was said."""
import argparse, hashlib, json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'sfx'))
from mpaudio import meter  # noqa: E402

SR = 48000


def tone_filter(hpf=80.0, deess=0.35, threshold_db=-20.0, ratio=3.0, attack=8.0, release=120.0, denoise=False):
    thr = 10 ** (threshold_db / 20)
    f = [f'highpass=f={hpf:g}:poles=2']
    if denoise:
        f.append('afftdn=nr=10:nf=-50')
    if deess > 0:
        f.append(f'deesser=i={deess:g}:m=0.5:f=0.5:s=o')
    f.append(f'acompressor=threshold={thr:.6f}:ratio={ratio:g}:attack={attack:g}:release={release:g}:knee=2.8:makeup=1')
    return ','.join(f)


def run_ffmpeg(src, af, start=None, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-nostdin', '-threads', '1']
    if start is not None:
        cmd += ['-ss', '%.4f' % start]
    if dur is not None:
        cmd += ['-t', '%.4f' % dur]
    cmd += ['-i', src, '-vn', '-af', af, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def limit(y, ceiling_db):
    """ffmpeg alimiter on a float buffer (stdin pipe): sample-peak limiting with lookahead; true peak is checked by the caller"""
    lim = 10 ** ((ceiling_db - 0.3) / 20)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-threads', '1', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-af', f'alimiter=limit={lim:.6f}:attack=5:release=50:level=disabled',
                        '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], input=y.astype(np.float32).tobytes(), capture_output=True, check=True)
    z = np.frombuffer(p.stdout, np.float32).reshape(-1, 2).astype(np.float64)
    return z[:len(y)] if len(z) >= len(y) else np.concatenate([z, np.zeros((len(y) - len(z), 2))])


def process(src, target=-14.0, ceiling=-1.5, loudness=True, **kw):
    af = tone_filter(**kw)
    y = run_ffmpeg(src, af)
    rep = {'filter': af, 'lufs_after_tone': round(meter.lufs_integrated(y), 2) if len(y) else None, 'target_lufs': target if loudness else None, 'ceiling_dbtp': ceiling if loudness else None, 'rounds': 0}
    if loudness and len(y) and np.any(y):
        g = 10 ** ((target - meter.lufs_integrated(y)) / 20)
        for r in range(6):
            z = limit(y * g, ceiling)
            tp = meter.true_peak_db(z)
            rep['rounds'] = r + 1
            if tp <= ceiling + 1e-3:
                break
            g *= 10 ** ((ceiling - tp - 0.05) / 20)
        y = z
        if meter.true_peak_db(y) > ceiling:   # last resort: a plain gain trim (never clips, may land under target)
            y = y * 10 ** ((ceiling - meter.true_peak_db(y) - 0.01) / 20)
    if len(y) and np.any(y):
        rep.update({'lufs_i': round(meter.lufs_integrated(y), 2), 'true_peak_dbtp': round(meter.true_peak_db(y), 2), 'reached_target': (abs(meter.lufs_integrated(y) - target) <= 0.5) if loudness else None})
    return y, rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--target', type=float, default=-14.0); ap.add_argument('--ceiling', type=float, default=-1.5); ap.add_argument('--no-loudness', action='store_true')
    ap.add_argument('--hpf', type=float, default=80.0); ap.add_argument('--deess', type=float, default=0.35); ap.add_argument('--threshold-db', type=float, default=-20.0); ap.add_argument('--ratio', type=float, default=3.0)
    ap.add_argument('--denoise', action='store_true'); ap.add_argument('--json')
    a = ap.parse_args(argv)
    if not os.path.exists(a.src):
        sys.exit(f'voice_chain: no such file {a.src}')
    y, rep = process(a.src, a.target, a.ceiling, not a.no_loudness, hpf=a.hpf, deess=a.deess, threshold_db=a.threshold_db, ratio=a.ratio, denoise=a.denoise)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    wavfile.write(a.out, SR, y.astype(np.float32))   # scipy: no PEAK chunk (libsndfile stamps the write time into float WAVs, so two identical runs would differ in bytes)
    rep['out'] = a.out; rep['sha256'] = hashlib.sha256(open(a.out, 'rb').read()).hexdigest()
    if a.json:
        json.dump(rep, open(a.json, 'w'), indent=1)
    print(json.dumps(rep))


if __name__ == '__main__':
    main()
