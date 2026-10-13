"""contact sheet of a delivered MP4 (decoded frames, not dev stills) + loudness of its audio track:
    python3 templates/_shared/sheet.py <video.mp4> <out.jpg> t1,t2,...   ->  sheet + prints LUFS-I / TP of the muxed audio (sfx/mpaudio meter)"""
import sys, os, subprocess, tempfile, numpy as np
from PIL import Image, ImageDraw
v, out, ts = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(',')]
tmp = tempfile.mkdtemp(); ims = []
for i, t in enumerate(ts):
    p = os.path.join(tmp, f'{i}.png'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', v, '-frames:v', '1', p], check=True); ims.append(Image.open(p).convert('RGB'))
w, h = ims[0].size; tw = 480 if w >= h else 270; th = round(h * tw / w); cols = 4 if w >= h else 6; rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (tw * cols, th * rows), 'white')
for i, im in enumerate(ims): S.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th)); ImageDraw.Draw(S).text(((i % cols) * tw + 6, (i // cols) * th + 4), f'{ts[i]:.2f}s', fill=(255, 0, 0))
S.save(out, quality=86); print('sheet', out, S.size)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sfx'))
try:
    from mpaudio import meter
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2)
    print('audio' if len(a) else 'NO AUDIO', 'LUFS-I %.2f TP %.2f dBTP dur %.2fs' % (meter.lufs_integrated(a), meter.true_peak_db(a), len(a) / 48000) if len(a) else '')
except Exception as e: print('audio measure failed', e)
