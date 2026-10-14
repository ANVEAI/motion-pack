# motion-pack/blender: ONE CLI for every recipe (Blender 5.2, headless, deterministic).
#
#   blender -b --factory-startup -P blender/run.py -- --recipe <id> [--preset NAME] --size 1920x1080 --fps 30 \
#       --seconds 6 --engine eevee|cycles --samples N --out DIR [--alpha] [--beats beats.json] [--param k=v ...]
#   extra: --frames 0:90 | 0,45,89 | smoke (subset)   --seed N   --exposure EV   --depth 8|16   --motion-blur auto|on|off
#          --post none|lens (lens = bloom + vignette baked into the MP4 proxy only)   --crf 18   --force   --no-mp4
#          --determinism F (render frame F twice in-session, compare)   --loop-check (render frame N, compare with 0)
#          --save-blend PATH   --list (recipes + params as JSON)   --denoise-gpu (Cycles: faster, not bit-exact)
#          --no-denoise (Cycles: raw path tracing, for determinism tests)   --device gpu|cpu (Cycles device)
#
# Output: DIR/frames/f0000.png ... (RGBA with --alpha), DIR/<slug>.mp4 (H.264 proxy, alpha flattened on black),
# DIR/sheet.jpg (contact sheet), DIR/render.json (settings, seed, per-frame timings, hashes, checks).
# Everything that moves is keyed per whole frame from the recipe's frame(f) (LINEAR keys, frames -1..N), so any frame
# renders the same alone or in sequence. MIT (see blender/LICENSE).
import os
import sys
import json
import time
import argparse
import subprocess
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy                                   # noqa: E402
from lib import render as RD                 # noqa: E402
from lib.util import Keyer, sha256_file, strip_png_timing, write_json   # noqa: E402
import recipes                               # noqa: E402


class Ctx:
    pass


def parse(argv):
    ap = argparse.ArgumentParser(prog="blender/run.py")
    ap.add_argument("--recipe")
    ap.add_argument("--preset", default=None)
    ap.add_argument("--size", default=None, help="WxH")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--seconds", type=float, default=None)
    ap.add_argument("--engine", default=None, choices=("eevee", "cycles"))
    ap.add_argument("--samples", type=int, default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--alpha", action="store_true")
    ap.add_argument("--beats", default=None)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--param", action="append", default=[], help="k=v (repeatable)")
    ap.add_argument("--frames", default=None)
    ap.add_argument("--exposure", type=float, default=0.0)
    ap.add_argument("--depth", default="8", choices=("8", "16"))
    ap.add_argument("--motion-blur", default="auto", choices=("auto", "on", "off"))
    ap.add_argument("--post", default="none", choices=("none", "lens"))
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-mp4", action="store_true")
    ap.add_argument("--determinism", type=int, default=None)
    ap.add_argument("--loop-check", action="store_true")
    ap.add_argument("--save-blend", default=None)
    ap.add_argument("--denoise-gpu", action="store_true")
    ap.add_argument("--device", default="gpu", choices=("gpu", "cpu"), help="Cycles device (cpu: slower, for hash-level repeatability)")
    ap.add_argument("--no-denoise", action="store_true", help="Cycles: no OIDN (isolates path-tracing determinism)")
    ap.add_argument("--list", action="store_true")
    return ap.parse_args(argv)


def frames_of(spec, N):
    if not spec:
        return list(range(N))
    if spec == "smoke":                      # first, middle, last
        return sorted({0, N // 2, N - 1})
    if ":" in spec:
        a, b = spec.split(":")
        return list(range(int(a or 0), int(b or N)))
    return [int(x) for x in spec.split(",") if x.strip()]


def python3():
    for p in (shutil.which("python3"), "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"):
        if p and os.path.exists(p):
            return p
    return None


def compare_png(a, b):
    """Pixel comparison inside Blender (numpy ships with it): equality, max abs difference and PSNR (8-bit scale)."""
    import numpy as np
    out = {"file_hash_equal": sha256_file(a) == sha256_file(b)}
    arr = []
    for p in (a, b):
        img = bpy.data.images.load(p, check_existing=False)
        x = np.empty(img.size[0] * img.size[1] * img.channels, np.float32)
        img.pixels.foreach_get(x)
        bpy.data.images.remove(img)
        arr.append(x)
    d = np.abs(arr[0] - arr[1])
    mse = float((d * d).mean())
    out.update(pixel_equal=bool(d.max() == 0), max_abs_8bit=round(float(d.max()) * 255, 3),
               changed_px_frac=round(float((d > 0).mean()), 6), psnr_db=(None if mse == 0 else round(10 * float(np.log10(1.0 / mse)), 2)))
    return out


def render_to(sc, f, path):
    sc.frame_set(f)
    sc.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    dt = round(time.time() - t, 3)
    if path.lower().endswith(".png") and os.path.exists(path):
        strip_png_timing(path)                # Cycles' per-render timing chunks would make equal pixels hash differently
    return dt


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = parse(argv)
    if a.list:
        print("MPB_RECIPES " + json.dumps(recipes.describe()))
        return
    if not a.recipe:
        raise SystemExit("--recipe is required (or --list)")
    rec = recipes.get(a.recipe)
    D = rec.DEFAULTS
    W, H = (int(x) for x in (a.size.lower().split("x") if a.size else D["size"]))
    seconds = a.seconds if a.seconds else D["seconds"]
    N = int(round(seconds * a.fps))
    engine = a.engine or D.get("engine", "eevee")
    given = dict(kv.split("=", 1) for kv in a.param)
    from recipes import _common
    params, unknown = _common.merge_params(rec.PARAMS, given)
    if unknown:
        raise SystemExit("unknown --param %s for %s (have %s)" % (", ".join(unknown), rec.ID, ", ".join(rec.PARAMS)))
    out = os.path.abspath(a.out or os.path.join(os.getcwd(), "out", rec.ID.replace("/", "-")))
    fdir = os.path.join(out, "frames")
    os.makedirs(fdir, exist_ok=True)
    ctx = Ctx()
    ctx.W, ctx.H, ctx.fps, ctx.N, ctx.seconds = W, H, a.fps, N, N / float(a.fps)
    ctx.tall, ctx.engine, ctx.seed, ctx.preset, ctx.p = H > W, engine, a.seed, a.preset, params
    ctx.alpha, ctx.beats_path, ctx.loop, ctx.report = a.alpha, a.beats, rec.LOOP, {}
    ctx.cache = os.path.join(HERE, ".cache")
    mb = {"auto": D.get("motion_blur", not rec.LOOP), "on": True, "off": False}[a.motion_blur]
    ctx.motion_blur = mb
    T0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = a.fps, 1.0
    Hh = rec.build(ctx)
    t_build = time.time() - T0
    t1 = time.time()
    K = Keyer()
    for f in range(-1, N + 1):          # one frame either side: motion blur at the ends, and frame N = the loop seam
        rec.frame(Hh, ctx, f, K)
        K.flush(f)
    sc.frame_start, sc.frame_end = 0, N - 1
    t_bake = time.time() - t1
    if a.alpha:
        for ob in sc.objects:
            if ob.name.startswith("cyclorama"):
                if engine == "cycles":
                    ob.is_shadow_catcher = True
                else:
                    ob.hide_render = True
    if engine == "eevee":
        RD.eevee_adapt(sc)
        S = RD.eevee_plate(sc, W, H, a.samples, mb, a.alpha, exposure=a.exposure, depth=a.depth)
    else:
        S = RD.cycles_keyart(sc, W, H, a.samples, seed=a.seed, alpha=a.alpha, exposure=a.exposure, depth=a.depth,
                             denoise=not a.no_denoise, denoise_gpu=a.denoise_gpu, motion_blur=mb,
                             device=a.device.upper())
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    report = {"recipe": rec.ID, "name": rec.NAME, "preset": a.preset, "params": {k: (list(v) if isinstance(v, tuple) else v)
                                                                                  for k, v in params.items()},
              "seed": a.seed, "engine": engine, "device": RD.describe_device(engine),
              "blender": bpy.app.version_string + " " + str(bpy.app.build_hash, "utf-8", "ignore") if isinstance(bpy.app.build_hash, bytes) else bpy.app.version_string,
              "size": [W, H], "fps": a.fps, "frames_total": N, "seconds": N / float(a.fps), "loop": ctx.loop,
              "alpha": a.alpha, "motion_blur": mb, "depth": a.depth, "exposure": a.exposure, "post": a.post,
              "settings": S.report(), "recipe_report": ctx.report, "license": "renders: CC0 (motion-pack media); scripts: MIT",
              "timings": {"build_s": round(t_build, 3), "bake_s": round(t_bake, 3)}, "outputs": {"frames": "frames/f%04d.png"}}
    if isinstance(Hh, dict) and Hh.get("note"):
        report["note"] = Hh["note"]
    if isinstance(Hh, dict) and Hh.get("T"):
        report["font"] = {"path": Hh["T"]["font"], "note": Hh["T"]["font_note"], "offset": Hh["T"]["offset"]}
    rj = os.path.join(out, "render.json")
    write_json(rj, dict(report, status="rendering"))
    sel = frames_of(a.frames, N)
    times, hashes = {}, {}
    for f in sel:
        p = os.path.join(fdir, "f%04d.png" % f)
        if os.path.exists(p) and not a.force:
            hashes["f%04d" % f] = sha256_file(p)
            continue
        times["f%04d" % f] = render_to(sc, f, p)
        hashes["f%04d" % f] = sha256_file(p)
        print("MPB_FRAME %s f=%d s=%.2f" % (rec.ID, f, times["f%04d" % f]), flush=True)
    vals = list(times.values())
    report["timings"].update(frames=times, rendered=len(vals), first_s=(vals[0] if vals else None),
                             mean_s=(round(sum(vals[1:]) / len(vals[1:]), 3) if len(vals) > 1 else (vals[0] if vals else None)),
                             total_render_s=round(sum(vals), 2))
    report["hashes"] = hashes
    if a.determinism is not None:
        dd = os.path.join(out, "determinism")
        os.makedirs(dd, exist_ok=True)
        pa, pb = os.path.join(dd, "a_f%04d.png" % a.determinism), os.path.join(dd, "b_f%04d.png" % a.determinism)
        ta = render_to(sc, a.determinism, pa)
        other = (a.determinism + max(1, N // 3)) % N
        render_to(sc, other, os.path.join(dd, "between_f%04d.png" % other))   # a different frame in between (state leaks)
        tb = render_to(sc, a.determinism, pb)
        report["determinism"] = dict(compare_png(pa, pb), frame=a.determinism, render_s=[ta, tb], scope="same process")
        print("MPB_DETERMINISM " + json.dumps(report["determinism"]), flush=True)
    if a.loop_check:
        ld = os.path.join(out, "loop")
        os.makedirs(ld, exist_ok=True)
        p0, pn = os.path.join(ld, "f0000.png"), os.path.join(ld, "f%04d_seam.png" % N)
        render_to(sc, 0, p0)
        render_to(sc, N, pn)
        report["loop_check"] = dict(compare_png(p0, pn), note="frame N must equal frame 0 for a seamless loop")
        print("MPB_LOOP " + json.dumps(report["loop_check"]), flush=True)
    slug = "%s-%s%s" % (rec.ID.split("/", 1)[1].replace(".", "-"), "%dx%d" % (W, H), "-" + a.preset if a.preset else "")
    full = len(sel) == N and all(os.path.exists(os.path.join(fdir, "f%04d.png" % f)) for f in range(N))
    py = python3()
    tools = os.path.join(HERE, "tools", "post.py")
    if py and sel:
        sheet = os.path.join(out, "sheet.jpg")
        r = subprocess.run([py, tools, "sheet", "--frames", fdir, "--out", sheet, "--pick", ",".join(str(f) for f in sel),
                            "--label", rec.ID], capture_output=True, text=True)
        report["outputs"]["sheet"] = "sheet.jpg" if r.returncode == 0 else ("failed: " + r.stderr[-300:])
    if py and full and not a.no_mp4:
        mp4 = os.path.join(out, slug + ".mp4")
        cmd = [py, tools, "encode", "--frames", fdir, "--count", str(N), "--fps", str(a.fps), "--out", mp4, "--crf", str(a.crf)]
        if a.post == "lens":
            cmd += ["--lens"]
        t2 = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True)
        report["outputs"]["mp4"] = os.path.basename(mp4) if r.returncode == 0 else ("failed: " + r.stderr[-400:])
        report["timings"]["encode_s"] = round(time.time() - t2, 2)
    report["timings"]["wall_s"] = round(time.time() - T0, 2)
    report["status"] = "done" if full else "partial (%d of %d frames)" % (len(sel), N)
    write_json(rj, report)
    print("MPB_DONE " + json.dumps({"recipe": rec.ID, "out": out, "status": report["status"],
                                    "mean_s": report["timings"]["mean_s"], "wall_s": report["timings"]["wall_s"]}), flush=True)


if __name__ == "__main__":
    main()
