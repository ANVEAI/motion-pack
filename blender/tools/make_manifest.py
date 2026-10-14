#!/usr/bin/env python3
"""Write blender/manifest.json from the recipes themselves (Blender --list: no render, no GPU) plus measured data:
showcase render.json timings and previews, and tests/out/determinism.json when present.
    python3 blender/tools/make_manifest.py [--blender PATH] [--showcase DIR]
MIT (see blender/LICENSE)."""
import argparse
import glob
import json
import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BLENDER = shutil.which("blender") or "/Applications/Blender.app/Contents/MacOS/Blender"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blender", default=os.environ.get("BLENDER", DEFAULT_BLENDER))
    ap.add_argument("--showcase", default=os.path.join(os.path.dirname(HERE), "showcase"))
    a = ap.parse_args()
    r = subprocess.run([a.blender, "-b", "--factory-startup", "-P", os.path.join(HERE, "run.py"), "--", "--list"],
                       capture_output=True, text=True)
    line = [ln for ln in r.stdout.splitlines() if ln.startswith("MPB_RECIPES ")]
    if not line:
        raise SystemExit("blender --list failed:\n" + r.stdout[-2000:] + r.stderr[-2000:])
    recipes = json.loads(line[0][len("MPB_RECIPES "):])
    repo = os.path.dirname(HERE) + os.sep   # path defaults (the title font) are written repo-relative, never absolute
    for rec in recipes.values():
        for p in rec.get("params", {}).values():
            if isinstance(p.get("default"), str) and p["default"].startswith(repo):
                p["default"] = p["default"][len(repo):]
    plates = {}
    for rj in sorted(glob.glob(os.path.join(a.showcase, "*", "render.json"))):
        d = json.load(open(rj))
        name = os.path.basename(os.path.dirname(rj))
        rel = lambda p: os.path.relpath(p, os.path.dirname(HERE))
        mp4 = [m for m in glob.glob(os.path.join(os.path.dirname(rj), "*.mp4"))]
        plates[name] = {"recipe": d["recipe"], "size": d["size"], "fps": d["fps"], "seconds": d["seconds"],
                        "frames": d["frames_total"], "engine": d["engine"], "mean_s_per_frame": d["timings"].get("mean_s"),
                        "render_total_s": d["timings"].get("total_render_s"), "status": d.get("status"),
                        "mp4": rel(mp4[0]) if mp4 else None, "sheet": rel(os.path.join(os.path.dirname(rj), "sheet.jpg")),
                        "loop_check": d.get("loop_check")}
        for key, fn in (("preview", name + ".jpg"), ("sheet", name + "-sheet.jpg")):   # committed previews win (renders are not in git)
            if os.path.exists(os.path.join(HERE, "previews", fn)):
                plates[name][key] = "blender/previews/" + fn
    for rid, rec in recipes.items():
        rec["id"] = rid
        rec["previews"] = [p for p, v in plates.items() if v["recipe"] == rid]
        rec["cli"] = ("blender -b --factory-startup -P blender/run.py -- --recipe %s --size 1920x1080 --fps 30 "
                      "--seconds %g --engine %s --out out/%s" % (rid, rec["defaults"]["seconds"], rec["defaults"].get("engine", "eevee"), rid.split("/")[1]))
    old_p = os.path.join(HERE, "manifest.json")
    old = json.load(open(old_p)) if os.path.exists(old_p) else {}
    if not plates and old.get("showcase"):      # no showcase renders on this machine: keep the measured rows already committed
        plates = old["showcase"]
        for rid, rec in recipes.items():
            rec["previews"] = [p for p, v in plates.items() if v["recipe"] == rid]
    det_p = os.path.join(HERE, "tests", "out", "determinism.json")
    man = {
        "module": "blender", "version": "1.0.0", "schema": "motion-pack/blender@1",
        "blender": "5.2.2 LTS (d13f752e3b9c); binary: $BLENDER or --blender, else blender on PATH or /Applications/Blender.app",
        "license": {"scripts": "MIT (GPL-compatible)", "renders": "CC0 1.0 (pack media)", "fonts": "SIL OFL 1.1 (pack fonts)"},
        "entry": "blender/run.py", "smoke": "bash blender/tests/smoke.sh", "determinism_test": "bash blender/tests/determinism.sh",
        "cable_tangle_test": "bash blender/tests/cable_tangle.sh",
        "id_convention": "blender/<recipe> (art loops: blender/art.<name>)",
        "recipes": recipes,
        "library": {
            "lib/device.py": {"presets": ["matte-copper (matte black, copper-amber band)", "studio-white", "graphite-teal", "puck-violet"],
                              "api": "spec(preset, **over) -> build(D) -> set_band(D, K, level, ignite, hot), explode(D, K, t, t_open, t_seal)"},
            "lib/studio.py": {"api": "cyclorama, world_dark, world_reflection (camera-dark softbox dome), area, feathered_strip, "
                                     "product_rig (key strip / rim / accent / fill / floor pool, light-linked), move_key"},
            "lib/materials.py": {"library": ["matte_coat", "brushed_metal", "glass", "ceramic", "plastic", "chrome", "anodised",
                                             "emissive_band", "floor_polished", "emission", "pure_emission"]},
            "lib/camera.py": {"moves": ["orbit", "turntable", "pushIn", "crane", "truck", "macroSlide", "dollyZoom", "whip", "rack",
                                        "breathe"], "framing": "fit_dist (re-layout 16:9 / 9:16 / 1:1, never crop)"},
            "lib/render.py": {"presets": ["eevee_plate (fast plates)", "cycles_keyart (quality stills)"]},
            "lib/title.py": {"api": "build(col, lines, font, weight, size, extrude, bevel, face_mat, side_mat)"},
            "lib/art.py": {"loops": ["liquid_chrome (metaballs)", "voxel_wave (geometry nodes)", "particle_swirl (geometry nodes)"]},
            "lib/beats.py": {"api": "load(sidecar, fps, n, loop) -> envelope(B, f), rings(B, f)"},
            "lib/kit.py": {"model": "flyer: 21 primitive parts (no real aircraft or markings)",
                           "api": "build(col, mat_for) -> parts; pass_group / pass_material / wire_material / add_wires (render passes); "
                                  "knolling_layout(parts, gap, aspect) -> slots + flat rotations"},
            "lib/env.py": {"api": "sky_world (gradient + sun glow + stars), sun, point, haze_volume, eevee_volumes, cloud_sea, "
                                  "flare_card + face_card, flat_mat, ico, frustum (low-poly)"},
            "lib/diorama.py": {"scenes": ["lighthouse", "campfire", "island"]},
        },
        "showcase": plates,
        "determinism": json.load(open(det_p)) if os.path.exists(det_p) else old.get("determinism", "run bash blender/tests/determinism.sh"),
    }
    out = os.path.join(HERE, "manifest.json")
    json.dump(man, open(out, "w"), indent=1)
    print("manifest", out, "recipes", len(recipes), "plates", len(plates))


if __name__ == "__main__":
    main()
