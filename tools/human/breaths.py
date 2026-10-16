#!/usr/bin/env python3
"""motion-pack / tools / human / breaths.py: find the BREATHS in the gaps between words, so the silence autocut keeps them (a cut that eats every breath sounds airless and robotic).

    python3 tools/human/breaths.py talk.mp4 words.json [--out breaths.json]
    node tools/human/human.mjs autocut words.json --breaths breaths.json      # keeps each detected breath whole (up to 450 ms before the next word)

Method (a measurement, not a model): 10 ms RMS of the 300-6000 Hz band. In each gap between words that is at least 0.2 s long, a breath is a run of frames louder than the
gap noise floor + 6 dB and quieter than the median speech level - 6 dB, lasting 0.12-0.9 s. The floor is the 10th percentile of all gap frames (the room); the speech level is
the median of the frames inside words. It reports a confidence per breath (dB over the floor). It can mistake a short non-speech sound (a chair, a sniff) for a breath: listen."""
import argparse, json, os, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt

SR = 16000
HOP = 160   # 10 ms


def load_words(p):
    d = json.load(open(p))
    W = d['words'] if isinstance(d, dict) else d
    return sorted([(float(w.get('s', w.get('start'))), float(w.get('e', w.get('end')))) for w in W], key=lambda x: x[0])


def level(src):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src, '-vn', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    y = sosfilt(butter(4, [300, 6000], 'bandpass', fs=SR, output='sos'), x)
    n = len(y) // HOP
    r = np.sqrt(np.mean(y[:n * HOP].reshape(n, HOP) ** 2, axis=1))
    return 20 * np.log10(r + 1e-9)


def detect(db, words, min_gap=0.2, min_len=0.12, max_len=0.9, over_floor=6.0, under_speech=6.0):
    fr = lambda t: int(round(t * SR / HOP))
    inside = np.zeros(len(db), bool)
    for s, e in words:
        inside[max(0, fr(s)):min(len(db), fr(e))] = True
    gaps = [(words[i - 1][1], words[i][0]) for i in range(1, len(words)) if words[i][0] - words[i - 1][1] >= min_gap]
    gap_frames = np.concatenate([db[fr(a):fr(b)] for a, b in gaps]) if gaps else np.array([])
    floor = float(np.percentile(gap_frames, 10)) if len(gap_frames) else -90.0
    speech = float(np.median(db[inside])) if inside.any() else -20.0
    lo, hi, out = floor + over_floor, speech - under_speech, []
    for a, b in gaps:
        i0, i1 = fr(a) + 2, fr(b) - 2          # stay 20 ms clear of the words' own tails
        if i1 <= i0:
            continue
        m = (db[i0:i1] > lo) & (db[i0:i1] < hi)
        k = 0
        while k < len(m):
            if not m[k]:
                k += 1
                continue
            j = k
            while j < len(m) and (m[j] or (j + 1 < len(m) and m[j + 1])):   # bridge one-frame dips
                j += 1
            L = (j - k) * HOP / SR
            if min_len <= L <= max_len:
                seg = db[i0 + k:i0 + j]
                out.append({'s': round((i0 + k) * HOP / SR, 3), 'e': round((i0 + j) * HOP / SR, 3), 'db_over_floor': round(float(np.median(seg) - floor), 1)})
            k = j
    return {'breaths': [[b['s'], b['e']] for b in out], 'detail': out, 'floor_db': round(floor, 1), 'speech_db': round(speech, 1), 'gaps': len(gaps)}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('src'); ap.add_argument('words'); ap.add_argument('--out')
    a = ap.parse_args(argv)
    for f in (a.src, a.words):
        if not os.path.exists(f):
            sys.exit(f'breaths: no such file {f}')
    r = detect(level(a.src), load_words(a.words))
    s = json.dumps(r, indent=1)
    if a.out:
        open(a.out, 'w').write(s + '\n')
    print(s if not a.out else a.out)


if __name__ == '__main__':
    main()
