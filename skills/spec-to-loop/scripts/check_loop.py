#!/usr/bin/env python3
"""spec-to-loop loop QA: determinism (via the page), seam, event stills, 1-fps contact sheet, ffprobe, A/V alignment.

usage: python3 check_loop.py <page.html> <loop.mp4> <qa_dir> [--x2 loop-x2.mp4] [--master master.wav] [--events 0,84,112]
                             [--no-page] [--max-stills 40] [--fps 60]
  1. page: `node render.mjs <page.html> --qa <qa_dir>/page_qa.json` (same frame twice -> same hash, renderAt(0) == renderAt(loop),
     frame 0 == frame N, seam diff vs neighbours, zero console errors). Event frames default to CONFIG.qaFrames.
  2. video: decodes the MP4 (ffmpeg pipe, never a PNG sequence), mean-abs-diff of every consecutive pair at 1/4 size,
     seam pair (last -> first, and N-1 -> N in the x2 file) against the distribution; stills of the event frames (PNG, capped);
     contact_1fps.png and contact_events.png (drawn with PIL, so ffmpeg needs no drawtext or libass).
  3. ffprobe of each file (frames, fps, size, durations); if --master: decoded MP4 audio cross-correlated against the master (lag).
Writes <qa_dir>/check_loop.json. LOOK at the sheets afterwards: numbers do not see a wrong pose."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

args = sys.argv[1:]; pos = [a for a in args if not a.startswith('--')]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
if len(pos) < 3: sys.exit(__doc__)
HTML, MP4, QA = (os.path.abspath(p) for p in pos[:3]); os.makedirs(QA, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__)); R = {'files': {}}; fails = []

def probe(f):
    o = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,duration,duration_ts,sample_rate,channels,bit_rate:format=duration,size', '-of', 'json', f], capture_output=True, text=True, check=True).stdout)
    return o
# ---- 1. page QA ----
if '--no-page' not in args:
    pq = os.path.join(QA, 'page_qa.json')
    p = subprocess.run(['node', os.path.join(HERE, 'render.mjs'), HTML, '--qa', pq], capture_output=True, text=True)
    if not os.path.exists(pq): print(p.stdout[-3000:], p.stderr[-3000:]); sys.exit('page QA failed to run')
    R['page'] = json.load(open(pq))
    if not R['page'].get('pass'): fails.append('page')
    cfg = R['page']['config']
else:
    cfg = {}
fps = int(opt('--fps', cfg.get('fps', 60)))
events = [int(x) for x in opt('--events', ','.join(map(str, cfg.get('qaFrames', []))) or '0').split(',') if x != '']

# ---- 2. video ----
def decode(f, w=None):
    pr = probe(f); vs = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]; W, H = vs['width'], vs['height']
    vf = [] if w is None else ['-vf', f'scale={w}:-2:flags=area']
    ow, oh = (W, H) if w is None else (w, int(round(H * w / W / 2)) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, *vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, oh, ow, 3), pr
small, pr = decode(MP4, 270); n = small.shape[0]
fd = lambda a, b: float(np.mean(np.abs(a.astype(np.int16) - b.astype(np.int16))))
diffs = np.array([fd(small[i], small[i + 1]) for i in range(n - 1)])
seam = fd(small[-1], small[0]); med = float(np.median(diffs)); nb = [float(diffs[-2]), float(diffs[-1]), float(diffs[0]), float(diffs[1])]
R['seam_single'] = dict(frames=n, last_to_first=round(seam, 4), neighbours=[round(x, 4) for x in nb], median=round(med, 4), p95=round(float(np.percentile(diffs, 95)), 4),
                        pass_=seam <= 1.5 * max(nb) + 0.05)
if not R['seam_single']['pass_']: fails.append('seam')
X2 = opt('--x2')
if X2:
    s2, _ = decode(X2, 270); k = n
    if s2.shape[0] >= 2 * n:
        d2 = [fd(s2[k - 2], s2[k - 1]), fd(s2[k - 1], s2[k]), fd(s2[k], s2[k + 1])]
        R['seam_x2'] = dict(frames=int(s2.shape[0]), pair_before=round(d2[0], 4), seam_pair=round(d2[1], 4), pair_after=round(d2[2], 4), frame0_equals_frameN=bool(np.array_equal(s2[0], s2[k])),
                            pass_=d2[1] <= 1.5 * max(d2[0], d2[2]) + 0.05)
        if not R['seam_x2']['pass_']: fails.append('seam_x2')
# contact sheet at 1 fps (from the small decode) and event stills (full size, capped)
def sheet(imgs, labels, out, cols, cell):
    rows = (len(imgs) + cols - 1) // cols; S = Image.new('RGB', (cell * cols, int(cell * imgs[0].height / imgs[0].width) * rows + 0), 'white'); ch = int(cell * imgs[0].height / imgs[0].width); dr = ImageDraw.Draw(S)
    for i, (im, lb) in enumerate(zip(imgs, labels)):
        x, y = (i % cols) * cell, (i // cols) * ch; S.paste(im.resize((cell, ch), Image.LANCZOS), (x, y)); dr.rectangle([x, y + ch - 16, x + 8 * len(lb) + 6, y + ch], fill=(0, 0, 0)); dr.text((x + 3, y + ch - 14), lb, fill=(255, 255, 255))
    S.save(out)
secs = list(range(0, n, fps))
sheet([Image.fromarray(small[i]) for i in secs], [f'f{i} {i / fps:.0f}s' for i in secs], os.path.join(QA, 'contact_1fps.png'), min(6, len(secs)), 270)
ev = [e for e in events if 0 <= e < n][:int(opt('--max-stills', 40))]
if ev:
    sel = '+'.join(f'eq(n\\,{e})' for e in ev)
    pr0 = probe(MP4); vs = [s for s in pr0['streams'] if s['codec_type'] == 'video'][0]; W, H = vs['width'], vs['height']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', MP4, '-vf', f'select={sel}', '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    full = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    ims = []
    for e, fr in zip(sorted(ev), full):
        im = Image.fromarray(fr); im.save(os.path.join(QA, f'ev_{e:04d}.png')); ims.append(im)
    sheet(ims, [f'f{e}' for e in sorted(ev)], os.path.join(QA, 'contact_events.png'), min(6, len(ims)), 300)
    R['stills'] = [f'ev_{e:04d}.png' for e in sorted(ev)]

# ---- 3. ffprobe + A/V ----
for f in [MP4] + ([X2] if X2 else []):
    o = probe(f); v = [s for s in o['streams'] if s['codec_type'] == 'video'][0]; a = [s for s in o['streams'] if s['codec_type'] == 'audio']
    R['files'][os.path.basename(f)] = dict(codec=v['codec_name'], profile=v.get('profile'), size=f"{v['width']}x{v['height']}", pix_fmt=v['pix_fmt'], fps=v['r_frame_rate'], frames=int(v['nb_read_frames']),
        video_s=float(v['duration']), audio=None if not a else dict(codec=a[0]['codec_name'], rate=a[0].get('sample_rate'), channels=a[0].get('channels'), duration_s=float(a[0]['duration']), duration_ts=a[0].get('duration_ts'),
        minus_video_ms=round((float(a[0]['duration']) - float(v['duration'])) * 1000, 2)), bytes=int(o['format']['size']))
MASTER = opt('--master')
if MASTER:
    import wave
    w = wave.open(MASTER, 'rb'); raw = np.frombuffer(w.readframes(w.getnframes()), np.uint8).reshape(-1, 3).astype(np.int32); w.close()
    m = raw[:, 0] | (raw[:, 1] << 8) | (raw[:, 2] << 16); m = np.where(m >= 1 << 23, m - (1 << 24), m).reshape(-1, 2)[:, 0] / 8388607.0
    for f in [MP4] + ([X2] if X2 else []):
        dec = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True, check=True).stdout, '<f4').reshape(-1, 2)[:, 0]
        L = min(96000, len(m) - 4096, len(dec) - 4096); a, b = m[2048:2048 + L], dec[2048:2048 + L]
        lags = range(-2400, 2401); c = [np.dot(a[2400:-2400], b[2400 + k:L - 2400 + k]) for k in lags]
        R['files'][os.path.basename(f)]['av_lag_samples'] = int(list(lags)[int(np.argmax(c))]); R['files'][os.path.basename(f)]['decoded_audio_samples'] = int(len(dec))
        if R['files'][os.path.basename(f)]['av_lag_samples'] != 0: fails.append('av_lag:' + os.path.basename(f))
R['pass'] = not fails; R['fails'] = fails
json.dump(R, open(os.path.join(QA, 'check_loop.json'), 'w'), indent=1)
print(json.dumps({k: v for k, v in R.items() if k != 'page'}, indent=1)); print('page QA:', 'PASS' if R.get('page', {}).get('pass') else ('skipped' if 'page' not in R else 'FAIL'))
print('RESULT:', 'PASS' if not fails else 'FAIL ' + ' '.join(fails))
sys.exit(0 if not fails else 1)
