# blender/turntable: the hero device spins on a dark studio sweep under fixed photographer lights, so the strip's
# highlight travels across every face and chamfer; the band glows with a slow, seamless breath. 360 deg = a seamless
# loop. MIT (see blender/LICENSE).
from mathutils import Vector

from lib import camera as CM, device as DV
from lib.ease import TAU, E, seg
import math

from . import _common as C

ID = "blender/turntable"
NAME = "Hero turntable"
DOC = "Procedural device spins 360 deg (or `degrees`) on a polished dark sweep; fixed key / rim / accent; band breath."
USE = "Product hero loop, launch-film reveal plate, end-card background behind type (the left third stays quiet)."
AVOID = "Fast cuts (one turn is slow by design); UI demos (use the three.js objects); anything that must seek live."
LOOP = True
DEFAULTS = dict(seconds=6.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "degrees": {"type": "float", "default": 360.0, "doc": "spin over the plate; a multiple of 360 keeps it a loop"},
    "start_deg": {"type": "float", "default": -30.0, "doc": "device yaw at frame 0"},
    "az": {"type": "float", "default": 18.0, "doc": "camera azimuth (deg, 0 = dead front)"},
    "el": {"type": "float", "default": 6.5, "doc": "camera elevation (deg)"},
    "lens": {"type": "float", "default": 100.0, "doc": "mm on a 24 mm vertical sensor"},
    "fstop": {"type": "float", "default": 7.1, "doc": "aperture (the box stays sharp; the sweep falls off)"},
    "fill": {"type": "float", "default": 0.0, "doc": "subject fill of the limiting frame side (0 = 0.56 wide / 0.78 tall)"},
    "shift_x": {"type": "float", "default": 0.0, "doc": "lens shift, frame heights (+ moves the subject left)"},
    "shift_y": {"type": "float", "default": 0.0, "doc": "lens shift, frame heights (+ moves the subject down)"},
    "breath": {"type": "float", "default": 0.08, "doc": "band breathing depth (0 = steady)"},
    "band_strength": {"type": "float", "default": None, "doc": "override the preset's band strength"},
    "ignite": {"type": "bool", "default": False, "doc": "ignite the band left-to-right over the first 0.9 s (not a loop)"},
    **C.MODEL_PARAMS,
}


def build(ctx):
    p = ctx.p
    D = C.device_from(ctx, p)
    S = C.product_studio(ctx, D)
    hw, hd, h = DV.footprint(D)
    fill = p["fill"] or (0.78 if ctx.tall else 0.56)
    half_w = 0.86 * (hw ** 2 + hd ** 2) ** 0.5
    dist = CM.fit_dist(half_w, h * 0.62, p["lens"], ctx.W, ctx.H, fill)
    cam = CM.make()
    s0 = CM.state(target=(0, 0, h * 0.47), az=p["az"], el=p["el"], dist=dist, lens=p["lens"],
                  shift=(p["shift_x"], p["shift_y"]), fstop=p["fstop"])
    s0["focus"] = Vector((0, 0, h * 0.5)) + CM.dirv(p["az"], p["el"]) * (half_w * 0.55)
    if p["ignite"]:
        ctx.loop = False
    return {"D": D, "S": S, "cam": cam, "s0": s0, "note": "dist %.3f m" % dist}


def frame(H, ctx, f, K):
    p = ctx.p
    D = H["D"]
    P = C.phase(ctx, f)
    t = C.t_of(ctx, f)
    K.set(D["root"], "rotation_euler", (0.0, 0.0, math.radians(p["start_deg"] + p["degrees"] * P)))
    lvl = 1.0 + p["breath"] * math.sin(TAU * P)
    if p["ignite"]:
        ign = E["move"](seg(t, 0.25, 1.15))
        hot = 1.6 * (1 - E["soft"](seg(t, 1.0, 1.5))) if t >= 0.25 else 0.0
        C.set_band(D, K, lvl, ign, hot)
    else:
        C.set_band(D, K, lvl, 1.0, 0.0)
    if D.get("blades") is not None:
        K.set(D["blades"], "rotation_euler", (0, 0, 0.0))
    CM.apply(H["cam"], H["s0"], K)
