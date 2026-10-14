# blender/diorama: a small stylised low-poly vignette (one prop + mood light + sky) as a seamless loop. Composed for a
# circular-window insert: the subject sits centred inside the inscribed circle (fill 0.62 of the short side by
# default), the sky fills the corners, and nothing important touches the frame edge, so HyperFrames can mask it to a
# disc (accelerating montages of vignettes) or play it full frame. Scenes: lighthouse, campfire, island
# (lib/diorama.py). MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import camera as CM, diorama as DI
from lib.ease import TAU
from lib.util import coll

from . import _common as C

ID = "blender/diorama"
NAME = "Low-poly diorama"
DOC = "Stylised low-poly vignette (lighthouse | campfire | island): one prop, mood light, sky; seamless loop, disc-insert framing."
USE = "Windows / circular inserts in an accelerating montage, a mood beat between UI sections, story vignettes for a short."
AVOID = "Photoreal claims; busy edges (the frame is cropped to a disc); cutting faster than ~0.12 s (it reads as noise)."
LOOP = True
DEFAULTS = dict(seconds=6.0, size=(1080, 1080), engine="eevee")
PARAMS = {
    "scene": {"type": "str", "default": "lighthouse", "doc": "lighthouse | campfire | island"},
    "fill": {"type": "float", "default": 0.62, "doc": "subject size as a share of the inscribed circle"},
    "az": {"type": "float", "default": None, "doc": "camera azimuth (deg; default per scene)"},
    "el": {"type": "float", "default": None, "doc": "camera elevation (deg; default per scene)"},
    "sway": {"type": "float", "default": 6.0, "doc": "azimuth sway per loop (deg, seamless)"},
    "lens": {"type": "float", "default": 50.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 5.6, "doc": "aperture"},
}


def build(ctx):
    p = ctx.p
    if p["scene"] not in DI.SCENES:
        raise SystemExit("scene must be one of %s" % ", ".join(DI.SCENES))
    S = DI.SCENES[p["scene"]](coll("set"), coll("lights"), ctx.seed)
    az = S["cam"]["az"] if p["az"] is None else p["az"]
    el = S["cam"]["el"] if p["el"] is None else p["el"]
    hw, hh = S["half"]
    circle = (CM.SENSOR_H / 2.0) / p["lens"] * min(ctx.W, ctx.H) / float(ctx.H)   # tan of the inscribed circle's half-angle
    dist = max(hw, hh) / (circle * p["fill"])                                       # the subject fits inside that circle
    s0 = CM.state(target=(0.0, 0.0, S["target"]), az=az, el=el, dist=dist, lens=p["lens"], fstop=p["fstop"])
    s0["focus"] = Vector((0.0, 0.0, S["target"]))
    ctx.report["scene"] = p["scene"]
    ctx.report["insert"] = "subject inside the inscribed circle at fill %.2f" % p["fill"]
    return {"S": S, "cam": CM.make(clip=(0.01, 300.0)), "s0": s0}


def frame(H, ctx, f, K):
    p = ctx.p
    P = C.phase(ctx, f)
    H["S"]["anim"](K, P)
    s = CM.clone(H["s0"])
    s["az"] += p["sway"] * math.sin(TAU * P)
    s["el"] += 0.25 * p["sway"] * math.sin(TAU * P + 1.1)
    CM.apply(H["cam"], s, K)
