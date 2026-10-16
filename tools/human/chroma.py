#!/usr/bin/env python3
"""motion-pack / tools / human / chroma.py: green-screen (or blue-screen) compositing with deterministic ffmpeg filters: chromakey + spill suppression over your background.

    python3 tools/human/chroma.py sample fg.mp4 [--at 0.5]                      # the key colour, measured from the frame border (median of the edge pixels)
    python3 tools/human/chroma.py key fg.mp4 out.mp4 --bg bg.mp4|bg.png|#0E0E14  # composite: key -> despill -> overlay on the background, x264 CRF 18, the fg's own audio kept
          [--color auto|0x00B140] [--similarity 0.14] [--blend 0.05] [--spill 0.55] [--size 1920x1080] [--fps 30] [--crf 18]
    python3 tools/human/chroma.py alpha fg.mp4 out.mov                          # keyed foreground with alpha (ProRes 4444) for an editor, or a folder -> PNG frames (out/matte_%05d.png)

Filters (one fixed order, all in the report): format=yuva444p -> chromakey=<colour>:<similarity>:<blend> -> despill=type=green|blue:mix=<spill>:expand=0 -> overlay.
  similarity: how far from the key colour still counts as background (raise it for uneven light); blend: soft edge width; spill: how much green / blue cast is pulled off hair and edges.
Determinism: fixed parameters, -threads 1 for the filter graph, so the same input gives the same composited frames (tools/tests/test_human_tools.py hashes the raw frames twice).
Not here on purpose: ML background removal (no pinned open model is vendored; see docs/bring-your-footage.md), and any change to the person in frame."""
import argparse, json, os, subprocess, sys
import numpy as np


def probe(src):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', src], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)['streams'][0]
    n, d = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(n) / float(d or 1)


def frame_rgb(src, at=0.5):
    w, h, _ = probe(src)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', '%.3f' % at, '-i', src, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def sample(src, at=0.5):
    """median colour of a 4%-wide border (a green screen fills the edges; the subject rarely touches all four)"""
    f = frame_rgb(src, at)
    h, w, _ = f.shape
    b = max(2, int(min(w, h) * 0.04))
    edge = np.concatenate([f[:b].reshape(-1, 3), f[-b:].reshape(-1, 3), f[:, :b].reshape(-1, 3), f[:, -b:].reshape(-1, 3)])
    c = np.median(edge, axis=0).astype(int)
    kind = 'green' if c[1] >= c[2] else 'blue'
    return {'color': '0x%02X%02X%02X' % tuple(c), 'rgb': [int(v) for v in c], 'despill': kind, 'at': at}


def key_chain(color, similarity, blend, spill, kind):
    return f'format=yuva444p,chromakey=color={color}:similarity={similarity:g}:blend={blend:g},despill=type={kind}:mix={spill:g}:expand=0'


def bg_input(bg, size, fps, dur):
    W, H = size
    if bg.startswith('#') or bg.startswith('0x'):
        hexv = bg.lstrip('#').replace('0x', '')
        return ['-f', 'lavfi', '-i', f'color=c=0x{hexv}:s={W}x{H}:r={fps:g}:d={dur:.3f}']
    if os.path.splitext(bg)[1].lower() in ('.png', '.jpg', '.jpeg', '.webp'):
        return ['-loop', '1', '-framerate', f'{fps:g}', '-t', f'{dur:.3f}', '-i', bg]
    return ['-stream_loop', '-1', '-i', bg]


def duration(src):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', src], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def key_graph(a, kind, size, fps):
    W, H = size
    return (f'[0:v]fps={fps:g},scale={W}:{H}:flags=bicubic,{key_chain(a.color, a.similarity, a.blend, a.spill, kind)}[fg];'
            f'[1:v]fps={fps:g},scale={W}:{H}:force_original_aspect_ratio=increase:flags=bicubic,crop={W}:{H},setsar=1,format=yuva444p[bg];[bg][fg]overlay=shortest=1:format=yuv444,format=yuv420p[v]')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sp = ap.add_subparsers(dest='cmd', required=True)
    s1 = sp.add_parser('sample'); s1.add_argument('src'); s1.add_argument('--at', type=float, default=0.5)
    for name in ('key', 'alpha'):
        s = sp.add_parser(name); s.add_argument('src'); s.add_argument('out')
        s.add_argument('--color', default='auto'); s.add_argument('--similarity', type=float, default=0.14); s.add_argument('--blend', type=float, default=0.05); s.add_argument('--spill', type=float, default=0.55)
        s.add_argument('--at', type=float, default=0.5); s.add_argument('--fps', type=float, default=None); s.add_argument('--size', default=None)
        if name == 'key':
            s.add_argument('--bg', required=True); s.add_argument('--crf', type=int, default=18); s.add_argument('--raw', action='store_true', help='write raw rgb24 frames instead of an MP4 (tests)')
    a = ap.parse_args(argv)
    if not os.path.exists(a.src):
        sys.exit(f'chroma: no such file {a.src}')
    if a.cmd == 'sample':
        print(json.dumps(sample(a.src, a.at)))
        return
    W, H, fps0 = probe(a.src)
    size = tuple(int(v) for v in a.size.split('x')) if a.size else (W, H)
    fps = a.fps or fps0
    s = sample(a.src, a.at)
    if a.color == 'auto':
        a.color = s['color']
    kind = s['despill']
    rep = {'cmd': a.cmd, 'color': a.color, 'similarity': a.similarity, 'blend': a.blend, 'spill': a.spill, 'despill': kind, 'size': list(size), 'fps': fps}
    if a.cmd == 'alpha':
        chain = f'fps={fps:g},scale={size[0]}:{size[1]},' + key_chain(a.color, a.similarity, a.blend, a.spill, kind)
        if os.path.splitext(a.out)[1].lower() in ('.mov', '.mkv'):
            cmd = ['ffmpeg', '-v', 'error', '-y', '-nostdin', '-filter_threads', '1', '-i', a.src, '-vf', chain, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-an', a.out]
        else:
            os.makedirs(a.out, exist_ok=True)
            cmd = ['ffmpeg', '-v', 'error', '-y', '-nostdin', '-filter_threads', '1', '-i', a.src, '-vf', chain + ',format=rgba', os.path.join(a.out, 'matte_%05d.png')]
        rep['filter'] = chain
    else:
        dur = duration(a.src)
        graph = key_graph(a, kind, size, fps)
        cmd = ['ffmpeg', '-v', 'error', '-y', '-nostdin', '-filter_threads', '1', '-filter_complex_threads', '1', '-i', a.src, *bg_input(a.bg, size, fps, dur), '-filter_complex', graph, '-map', '[v]']
        cmd += (['-f', 'rawvideo', '-pix_fmt', 'rgb24', a.out] if a.raw else ['-map', '0:a?', '-c:v', 'libx264', '-crf', str(a.crf), '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', a.out])
        rep['filter'] = graph
    subprocess.run(cmd, check=True)
    rep['out'] = a.out
    print(json.dumps(rep))


if __name__ == '__main__':
    main()
