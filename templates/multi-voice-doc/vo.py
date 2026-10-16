"""templates/multi-voice-doc/vo.py: the voice track of the edit, laid on the timeline from out/plan.json (48 kHz stereo float WAV).
    python3 vo.py out/plan.json out/vo.wav [--placeholder guide|none]
Each plan.audio segment is [src_in, src_out] of its clip placed at frame `start`:
  * src set   -> decoded from YOUR clip with ffmpeg (the real voice; 8 ms fades at the edit points, which sit between words)
  * src null  -> a GUIDE signal for the placeholder demo: band-limited noise shaped per word at the transcript's word timings. It is clearly not a
                 voice and never imitates a person; it only lets the mixer duck the bed and lets ears measure ducking on the placeholder build.
music/mixer.py receives it as the "vo" stem (templates/_shared/audio.py, plan.vo), ducks the bed 9 dB under it and masters the sum."""
import argparse, json, os, subprocess, zlib
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile   # not soundfile: libsndfile writes a PEAK chunk with a time stamp into float WAVs, so two identical builds differ in bytes

SR = 48000


def decode(src, t0, t1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', '%.4f' % t0, '-t', '%.4f' % (t1 - t0), '-i', src, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def guide(words, t0, n, seed):
    """shaped noise (300-3400 Hz) under each word: a raised-cosine envelope with a 5 Hz flutter, -20 dBFS RMS while 'speaking'"""
    rng = np.random.default_rng(seed)
    noise = sosfilt(butter(4, [300, 3400], 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    env = np.zeros(n)
    for w in words:
        a, b = int(round((w['s'] - t0) * SR)), int(round((w['e'] - t0) * SR))
        a, b = max(0, a), min(n, b)
        if b - a < 8:
            continue
        x = np.linspace(0, 1, b - a)
        env[a:b] = np.sin(np.pi * x) ** 0.6 * (0.75 + 0.25 * np.sin(2 * np.pi * 5.0 * x * (b - a) / SR))
    y = noise * env
    on = env > 0.05
    rms = np.sqrt(np.mean(y[on] ** 2)) if on.any() else 1.0
    y *= 10 ** (-20 / 20) / max(rms, 1e-9)
    return np.stack([y, y], 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan'); ap.add_argument('out'); ap.add_argument('--placeholder', default='guide', choices=['guide', 'none'])
    a = ap.parse_args()
    P = json.load(open(a.plan))
    here = os.path.dirname(os.path.abspath(__file__))
    cp = P.get('clips') or 'clips.json'   # plan.clips = CONFIG.clips (relative to this folder)
    clips = {c['id']: c for c in json.load(open(cp if os.path.isabs(cp) else os.path.join(here, cp)))['clips']}
    fps, N = P['fps'], int(round(P['seconds'] * SR))
    out = np.zeros((N, 2))
    rep = []
    for i, s in enumerate(P['audio']):
        at = int(round(s['start'] * SR / fps))
        n = int(round((s['end'] - s['start']) * SR / fps))
        if s.get('src'):
            src = s['src'] if os.path.isabs(s['src']) else os.path.join(here, s['src'])
            y = decode(src, s['src_in'], s['src_out'])[:n]
            kind = 'clip'
        elif a.placeholder == 'guide':
            y = guide(clips[s['clip']]['words'], s['src_in'], n, zlib.crc32(('%s:%d' % (s['clip'], i)).encode()))
            kind = 'guide (placeholder, not a voice)'
        else:
            continue
        f = min(len(y) // 2, int(0.008 * SR))
        if f:
            r = np.linspace(0, 1, f)[:, None]
            y[:f] *= r
            y[-f:] *= r[::-1]
        m = min(len(y), N - at)
        out[at:at + m] += y[:m]
        rep.append({'clip': s['clip'], 'start_frame': s['start'], 'samples': int(m), 'kind': kind})
    wavfile.write(a.out, SR, out.astype(np.float32))   # IEEE float, no PEAK chunk: the same plan gives the same bytes
    json.dump({'segments': rep, 'placeholder': a.placeholder}, open(a.out + '.json', 'w'), indent=1)
    print(a.out, len(rep), 'segments', sum(1 for r in rep if r['kind'] == 'clip'), 'from real clips')


if __name__ == '__main__':
    main()
