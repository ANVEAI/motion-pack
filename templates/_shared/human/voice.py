"""motion-pack / templates/_shared/human/voice.py: the VOICE stem of a human-led edit, laid on the output timeline from out/plan.json (48 kHz stereo float WAV), plus its level envelope.

    python3 templates/_shared/human/voice.py <dir>/out/plan.json <dir>/out/vo.wav

plan.voice = { fps, sources: { <id>: { src, chain } }, segments: [{ source, src_in, src_out, start, speaker, words: [[s, e], ...] (source s), gainDb }], nat: [...], placeholder: 'guide' | 'none' }
  * a segment whose source has a src -> decoded with ffmpeg from YOUR recording (through tools/human/voice_chain.py's tone chain when chain is true; the mixer masters loudness)
  * no src -> a GUIDE signal: band-limited noise shaped per word at the transcript's timings, one band per speaker. It is plainly not a voice and never imitates a person;
              it lets the mixer duck the bed and lets ears measure the duck and the speech gaps on a placeholder build.
  * plan.voice.nat = [{ source | null, amb, mediaStart, audioIn, audioOut, pictureIn, gainDb }]: an insert's own sound for J / L split edits (your clip's audio, or a pack
              ambience id for a placeholder), faded 80 ms at each end, summed into this stem so the bed ducks under it too.
Writes <out> (scipy WAV: byte-identical across runs), <out>.json (what was used) and <out_dir>/env.json ({ fps, all: [...], by: { speaker: [...] } } per-frame levels 0..1 for ui.waveform)."""
import json, os, subprocess, sys, zlib
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(PACK, 'tools', 'human'))
BANDS = [(300, 3400), (220, 2600), (380, 4200), (260, 3000)]


def decode(src, t0, t1, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-nostdin', '-threads', '1', '-ss', '%.4f' % max(0.0, t0), '-t', '%.4f' % max(0.001, t1 - t0), '-i', src, '-vn']
    if af:
        cmd += ['-af', af]
    raw = subprocess.run(cmd + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def guide(words, t0, n, seed, band):
    rng = np.random.default_rng(seed)
    y = sosfilt(butter(4, list(band), 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    env = np.zeros(n)
    for s, e in words:
        a, b = max(0, int(round((s - t0) * SR))), min(n, int(round((e - t0) * SR)))
        if b - a < 8:
            continue
        x = np.linspace(0, 1, b - a)
        env[a:b] = np.sin(np.pi * x) ** 0.6 * (0.75 + 0.25 * np.sin(2 * np.pi * 5.0 * x * (b - a) / SR))
    y = y * env
    on = env > 0.05
    rms = np.sqrt(np.mean(y[on] ** 2)) if on.any() else 1.0
    y *= 10 ** (-20 / 20) / max(rms, 1e-9)
    return np.stack([y, y], 1)


def fade(y, ms=8):
    f = min(len(y) // 2, int(ms / 1000 * SR))
    if f:
        r = np.linspace(0, 1, f)[:, None]
        y[:f] *= r
        y[-f:] *= r[::-1]
    return y


def amb_file(aid):
    man = json.load(open(os.path.join(PACK, 'sfx', 'manifest.json')))
    key = 'snd.' + '.'.join(aid.split('/')[1:])
    for s in man['sounds']:
        if s['id'] == key:
            return os.path.join(PACK, 'sfx', s['file'])
    return None


def main():
    plan_path, out = sys.argv[1], sys.argv[2]
    P = json.load(open(plan_path))
    V = P.get('voice') or {}
    fps, N = P['fps'], int(round(P['seconds'] * SR))
    y = np.zeros((N, 2))
    rep, by = [], {}
    chained = {}
    try:
        from voice_chain import tone_filter
    except Exception:   # the tools folder is optional at render time; without it the raw recording is used and the report says so
        tone_filter = None
    for i, s in enumerate(V.get('segments', [])):
        at, n = int(round(s['start'] * SR)), int(round((s['src_out'] - s['src_in']) * SR))
        src = ((V.get('sources') or {}).get(s.get('source')) or {}).get('src')
        if src:
            af = tone_filter() if ((V.get('sources') or {}).get(s['source']) or {}).get('chain') and tone_filter else None
            z = decode(src, s['src_in'], s['src_out'], af)[:n]
            kind = 'recording' + (' + tone chain' if af else '')
        elif V.get('placeholder', 'guide') == 'guide':
            spk = str(s.get('speaker', 'A'))
            band = BANDS[sorted(set(str(q.get('speaker', 'A')) for q in V['segments'])).index(spk) % len(BANDS)]
            z = guide(s.get('words', []), s['src_in'], n, zlib.crc32(('%s:%d' % (spk, i)).encode()), band)
            kind = 'guide (placeholder, not a voice)'
        else:
            continue
        z = fade(z * 10 ** (s.get('gainDb', 0) / 20))
        m = min(len(z), N - at)
        if m <= 0:
            continue
        y[at:at + m] += z[:m]
        spk = str(s.get('speaker', 'A'))
        by.setdefault(spk, np.zeros(N))[at:at + m] += np.abs(z[:m, 0])
        rep.append({'segment': i, 'start_s': s['start'], 'samples': int(m), 'kind': kind, 'speaker': spk})
    for k, q in enumerate(V.get('nat', [])):
        a, b = int(round(q['audioIn'] * SR)), min(N, int(round(q['audioOut'] * SR)))
        if b - a < 64:
            continue
        src = ((V.get('sources') or {}).get(q.get('source')) or {}).get('src')
        if src:
            lead = q['pictureIn'] - q['audioIn']
            z = decode(src, q.get('mediaStart', 0) - lead, q.get('mediaStart', 0) - lead + (b - a) / SR)
            kind = 'insert sound from your clip'
        elif q.get('amb') and amb_file(q['amb']) and os.path.exists(amb_file(q['amb'])):
            import soundfile as sf   # reading is fine with libsndfile; only its float WRITES carry a time stamp
            w, sr = sf.read(amb_file(q['amb']), always_2d=True)
            w = w if w.shape[1] == 2 else np.repeat(w[:, :1], 2, 1)
            z = np.concatenate([w] * ((b - a) // len(w) + 1))
            kind = 'pack ambience ' + q['amb'] + ' (placeholder sound)'
        else:
            continue
        z = fade(z[:b - a].copy(), 80) * 10 ** (q.get('gainDb', -14) / 20)
        y[a:a + len(z)] += z
        rep.append({'nat': k, 'audioIn': q['audioIn'], 'audioOut': q['audioOut'], 'kind': kind})
    y[N - int(0.15 * SR):] = 0.0
    wavfile.write(out, SR, y.astype(np.float32))
    json.dump({'segments': rep, 'placeholder': V.get('placeholder', 'guide')}, open(out + '.json', 'w'), indent=1)
    # per-frame level (RMS over one frame), normalised by the 97th percentile, for ui.waveform
    hop = SR // fps

    def frames(x):
        n = len(x) // hop
        r = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1))
        ref = np.percentile(r[r > 1e-6], 97) if np.any(r > 1e-6) else 1.0
        return [round(float(v), 3) for v in np.clip(r / max(ref, 1e-9), 0, 1)]
    env = {'fps': fps, 'all': frames(y[:, 0]), 'by': {k: frames(v) for k, v in by.items()}}
    json.dump(env, open(os.path.join(os.path.dirname(os.path.abspath(out)), 'env.json'), 'w'))
    print(out, len(rep), 'pieces', sum(1 for r in rep if str(r.get('kind', '')).startswith('recording')), 'from your recordings')


if __name__ == '__main__':
    main()
