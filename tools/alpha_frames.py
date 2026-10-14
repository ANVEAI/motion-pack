#!/usr/bin/env python3
"""alpha_frames.py: a video with an alpha channel, or a grey matte video, -> a PNG frame sequence that type.behindSubject takes as its matte.

  python3 tools/alpha_frames.py subject.webm out/matte                 # alpha channel of the video (VP9 alpha, ProRes 4444, QuickTime Animation, PNG-in-MOV)
  python3 tools/alpha_frames.py matte.mp4 out/matte --mode luma        # a grey matte video: white = subject
  options: --fps N (default: the source rate), --scale 0.5 (shrink the matte; it is stretched to the frame), --start S --duration D, --prefix URL

Every frame is a white RGBA PNG whose ALPHA is the matte, so the part's default matteMode ('alpha') reads it as it is. The script prints the params to paste:

  { matte: { frames: 'out/matte/f_%04d.png', fps: 30, count: 90, first: 1 } }

The pack makes no mattes and loads no segmentation model: you bring the video (your own tool, a camera with alpha, a matte pass); this only turns it into frames.
A .webm with alpha is decoded with libvpx-vp9 (the native VP9 decoder drops the alpha plane); ffmpeg must have it for that case.
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")


def probe(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt,r_frame_rate:stream_tags=alpha_mode",
                        "-of", "json", path], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffprobe could not read {path}: {r.stderr.strip()}")
    s = (json.loads(r.stdout).get("streams") or [None])[0]
    if not s:
        raise SystemExit(f"{path}: no video stream")
    n, d = (s.get("r_frame_rate") or "30/1").split("/")
    return {"codec": s.get("codec_name"), "pix_fmt": s.get("pix_fmt") or "", "fps": float(n) / float(d or 1), "alpha_tag": (s.get("tags") or {}).get("alpha_mode") == "1"}


def has_alpha(pix_fmt):
    return any(k in pix_fmt for k in ("yuva", "rgba", "argb", "bgra", "abgr", "gbrap", "ya8", "ya16", "pal8"))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("video")
    ap.add_argument("out_dir")
    ap.add_argument("--mode", choices=("alpha", "luma"), default="alpha")
    ap.add_argument("--fps", type=float)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--start", type=float)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--prefix", help="URL prefix printed in the params (default: the out dir as given)")
    a = ap.parse_args(argv)
    if shutil.which(FFMPEG) is None:
        raise SystemExit("ffmpeg not on PATH")
    info = probe(a.video)
    pre = []
    decoder = []
    if a.mode == "alpha":
        if info["codec"] in ("vp8", "vp9") and info["alpha_tag"]:
            decoder = ["-c:v", "libvpx-vp9" if info["codec"] == "vp9" else "libvpx"]
        elif not has_alpha(info["pix_fmt"]):
            raise SystemExit(f"{a.video}: no alpha channel (pix_fmt {info['pix_fmt']}). If this is a matte video (white = subject), use --mode luma.")
    fps = a.fps or round(info["fps"], 3)
    if a.fps:
        pre.append(f"fps={a.fps}")
    if a.scale != 1.0:
        pre.append(f"scale=trunc(iw*{a.scale}/2)*2:trunc(ih*{a.scale}/2)*2:flags=area")
    chain = ",".join(pre)
    white = "format=rgba,lutrgb=r=255:g=255:b=255"
    if a.mode == "alpha":
        vf = ["-vf", (chain + "," if chain else "") + white]
        graph = []
    else:
        head = f"[0:v]{chain + ',' if chain else ''}split[a][b];"
        vf = []
        graph = ["-filter_complex", head + f"[a]{white}[w];[b]format=gray[m];[w][m]alphamerge,format=rgba[o]", "-map", "[o]"]
    os.makedirs(a.out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(a.out_dir, "f_*.png")):
        os.remove(old)
    cmd = [FFMPEG, "-v", "error", "-nostdin", "-y", *decoder]
    if a.start is not None:
        cmd += ["-ss", str(a.start)]
    cmd += ["-i", a.video]
    if a.duration is not None:
        cmd += ["-t", str(a.duration)]
    cmd += [*vf, *graph, "-start_number", "1", "-vsync", "0", os.path.join(a.out_dir, "f_%04d.png")]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("ffmpeg failed: " + r.stderr.strip()[-600:])
    count = len(glob.glob(os.path.join(a.out_dir, "f_*.png")))
    if count == 0:
        raise SystemExit("no frames written")
    prefix = (a.prefix or a.out_dir).rstrip("/")
    spec = {"frames": prefix + "/f_%04d.png", "fps": fps, "count": count, "first": 1}
    print(json.dumps(spec))
    print("params: { matte: " + json.dumps(spec).replace('"', "'") + " }", file=sys.stderr)
    return spec


if __name__ == "__main__":
    main()
