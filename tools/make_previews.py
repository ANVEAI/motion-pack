#!/usr/bin/env python3
"""motion-pack / tools / make_previews.py: small, browser-friendly previews of the heavy media, so the repository stays small.

    python3 tools/make_previews.py --audio            # sfx/library/**.wav -> sfx/previews/**.mp3, music/library/**.wav -> music/previews/**.mp3
    python3 tools/make_previews.py --images           # PNG renders and sheets -> JPEG next to them
    python3 tools/make_previews.py --images --move-originals DIR   # also move each converted PNG to DIR/<same path> (release zip)
    python3 tools/make_previews.py --check            # exit 1 if a WAV master or PNG render has no up-to-date preview

What is committed: the previews (MP3, JPEG). What is not: WAV masters (sfx/library, music/library: regenerate them with
sfx/build_library.py and music/build_music.py, the version-matched path; each GitHub Release's zips match its own tag only, not later
commits, see README "Heavy media") and full-size PNG renders
(gitignored once converted). The catalog (catalog/build.py) prefers the preview when the original is absent.

Audio previews are for listening only: MP3 adds encoder delay and padding, so timing-critical work (anchors, beat grids,
mixing) always uses the WAV masters. Needs ffmpeg with libmp3lame, and Pillow for images."""
import argparse, os, shutil, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AUDIO = [('sfx/library', 'sfx/previews'), ('music/library', 'music/previews')]
IMAGE_DIRS = ['transitions/renders', 'layers/demo/out', 'type/demo/out', 'camera/demo/out', 'objects/qa', 'sfx/demo/stills', 'music/demo/stills', 'terminal/previews']
KEEP_PNG = {'layers/demo/out/plate-test.png',   # an input: layers/tools/looks_sheet.py grades it with every cube
            'type/demo/out/icons.png'}           # tiny line-art sheet, PNG is smaller than JPEG
MP3_BITRATE = '128k'
JPEG_QUALITY = 82
STILL_MAX_W = 960      # transitions/renders/stills/<key>/fNNNN.png
SHEET_MAX_W = 2400     # contact sheets and demo outputs


def walk(rel_dir, ext):
    base = os.path.join(REPO, rel_dir)
    for root, _, files in os.walk(base):
        for f in sorted(files):
            if f.lower().endswith(ext):
                yield os.path.relpath(os.path.join(root, f), REPO)


def stale(src, dst):
    return not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)


def audio(check=False):
    todo, n = [], 0
    for lib, prev in AUDIO:
        for rel in walk(lib, '.wav'):
            out = os.path.join(REPO, prev, os.path.relpath(rel, lib))[:-4] + '.mp3'
            if stale(os.path.join(REPO, rel), out):
                todo.append(rel)
                if check:
                    continue
                os.makedirs(os.path.dirname(out), exist_ok=True)
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(REPO, rel), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, out], check=True)
                n += 1
    return todo, n


def images(check=False, move_to=None):
    from PIL import Image
    todo, n = [], 0
    for d in IMAGE_DIRS:
        for rel in walk(d, '.png'):
            if rel in KEEP_PNG:
                continue
            src = os.path.join(REPO, rel)
            out = src[:-4] + '.jpg'
            if not stale(src, out):
                if move_to:
                    _move(rel, move_to)
                continue
            todo.append(rel)
            if check:
                continue
            im = Image.open(src).convert('RGB')
            cap = STILL_MAX_W if '/stills/' in rel and rel.startswith('transitions/') else SHEET_MAX_W
            if im.width > cap:
                im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
            im.save(out, quality=JPEG_QUALITY, optimize=True, progressive=True)
            n += 1
            if move_to:
                _move(rel, move_to)
    return todo, n


def _move(rel, move_to):
    dst = os.path.join(move_to, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(os.path.join(REPO, rel), dst)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--audio', action='store_true'); ap.add_argument('--images', action='store_true')
    ap.add_argument('--check', action='store_true'); ap.add_argument('--move-originals', metavar='DIR')
    a = ap.parse_args()
    if not (a.audio or a.images or a.check):
        ap.error('pick --audio, --images or --check')
    rc = 0
    if a.audio or a.check:
        todo, n = audio(a.check)
        print(f'audio: {n} previews written' if not a.check else f'audio: {len(todo)} WAV masters without an up-to-date preview')
        rc |= bool(a.check and todo)
    if a.images or a.check:
        todo, n = images(a.check, os.path.abspath(a.move_originals) if a.move_originals else None)
        print(f'images: {n} JPEG previews written' if not a.check else f'images: {len(todo)} PNG renders without an up-to-date JPEG')
        rc |= bool(a.check and todo)
    sys.exit(1 if rc else 0)
