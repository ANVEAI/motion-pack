"""templates/proof-film/vo.py: the optional sparse voice-over of the proof film, laid on the timeline from out/plan.json (48 kHz stereo float WAV).
    python3 vo.py out/plan.json out/vo.wav [--audio /abs/voice.wav]
  * --audio set -> YOUR recording, decoded with ffmpeg from 0 s and cut or padded to the plan length (8 ms fades at both ends); words.json times are in that recording's own time
  * no --audio  -> a GUIDE signal for a dry run: band-limited noise shaped per word at the words.json timings. It is plainly not a voice and never imitates a person; it only lets the
                   mixer duck the bed and lets ears measure the ducking before you have recorded anything.
templates/_shared/audio.py hands the result to music/mixer.py as the "vo" stem (plan.vo, plan.duckDb): the bed ducks 12 dB under it. If the voice is synthetic, say so in the post
(AI-generated speech is AI content); this template never calls a speech service."""
import argparse, json, os, subprocess, zlib
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

SR = 48000


def decode(src, seconds):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src, '-t', '%.4f' % seconds, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def guide(words, n, seed):
    """shaped noise (300-3400 Hz) under each word: a raised-cosine envelope with a 5 Hz flutter, -20 dBFS RMS while 'speaking'"""
    rng = np.random.default_rng(seed)
    noise = sosfilt(butter(4, [300, 3400], 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    env = np.zeros(n)
    for w in words:
        a, b = max(0, int(round(w['s'] * SR))), min(n, int(round(w['e'] * SR)))
        if b - a < 8:
            continue
        x = np.linspace(0, 1, b - a)
        env[a:b] = np.sin(np.pi * x) ** 0.6 * (0.75 + 0.25 * np.sin(2 * np.pi * 5.0 * x * (b - a) / SR))
    y = noise * env
    on = env > 0.05
    y *= 10 ** (-20 / 20) / max(np.sqrt(np.mean(y[on] ** 2)) if on.any() else 1.0, 1e-9)
    return np.stack([y, y], 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan'); ap.add_argument('out'); ap.add_argument('--audio', default=None)
    a = ap.parse_args()
    P = json.load(open(a.plan))
    if not P.get('voice'):
        raise SystemExit('plan has no voice: set CONFIG.vo = { audio, words }')
    N = int(round(P['seconds'] * SR))
    if a.audio:
        y = decode(a.audio, P['seconds'])[:N]
        kind = 'your recording'
    else:
        y = guide(P['voice']['words'], N, zlib.crc32(b'proof-film'))
        kind = 'guide (placeholder, not a voice)'
    out = np.zeros((N, 2)); out[:len(y)] = y
    f = int(0.008 * SR); r = np.linspace(0, 1, f)[:, None]
    out[:f] *= r; out[len(y) - f:len(y)] *= r[::-1] if len(y) >= f else 1
    sf.write(a.out, out.astype(np.float32), SR, subtype='FLOAT')
    json.dump({'kind': kind, 'seconds': P['seconds'], 'words': len(P['voice']['words'])}, open(a.out + '.json', 'w'), indent=1)
    print(a.out, kind, '%.1f s' % P['seconds'])


if __name__ == '__main__':
    main()
