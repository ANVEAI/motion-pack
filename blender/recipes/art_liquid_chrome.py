# blender/art.liquidChrome: a seamless liquid-chrome loop. Metaballs on closed Lissajous orbits (integer harmonics of
# the loop) merge and split; the chrome draws a procedural studio dome the camera never sees, plus a polished floor's
# soft reflection. Seeded. MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import art as AR, camera as CM, materials as MT, studio as ST
from lib.ease import TAU
from lib.util import coll

from . import _common as C

ID = "blender/art.liquidChrome"
NAME = "Liquid chrome loop"
DOC = "Seeded metaball cluster on integer-harmonic orbits: merges and splits, polished chrome, seamless."
USE = "Abstract hero loop behind a title, transition plates, music visual beds (render 2 loops for a 8 s bed)."
AVOID = "Product truth shots; tiny frames (needs ~40 % of the frame to read as liquid); under dense type."
LOOP = True
DEFAULTS = dict(seconds=4.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "blobs": {"type": "int", "default": 11, "doc": "metaball count (1 core + satellites)"},
    "size": {"type": "float", "default": 0.22, "doc": "core radius (m)"},
    "resolution": {"type": "float", "default": 0.0055, "doc": "render polygonisation (m); lower = smoother, slower"},
    "film": {"type": "float", "default": 0.0, "doc": "thin-film iridescence (nm, 0 = pure chrome; ~300 = oil slick)"},
    "tint": {"type": "color", "default": (0.93, 0.93, 0.95), "doc": "chrome base colour (linear)"},
    "rough": {"type": "float", "default": 0.03, "doc": "roughness"},
    "turns": {"type": "float", "default": 1.0, "doc": "slow camera yaw sway cycles per loop (integer = seamless)"},
    "lens": {"type": "float", "default": 70.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 5.6, "doc": "aperture"},
    "floor": {"type": "bool", "default": False, "doc": "a polished black floor under the blob (soft reflection)"},
    "accent": {"type": "color", "default": MT.VIOLET_AGX, "doc": "one accent softbox colour in the dome"},
}


def build(ctx):
    p = ctx.p
    # contrast sells liquid metal: a near-black dome, one thin bright horizon line, hard-edged cards, one accent
    boxes = [(0.0, 40.0, 40.0, 8.0, 7.0, (1.0, 0.97, 0.93)), (-75.0, 12.0, 7.0, 34.0, 5.0, (0.95, 0.97, 1.0)),
             (78.0, 8.0, 5.0, 28.0, 3.0, p["accent"]), (180.0, 28.0, 50.0, 6.0, 2.5, (0.92, 0.94, 1.0)),
             (-150.0, -5.0, 30.0, 4.0, 1.2, (1.0, 0.6, 0.3)), (0.0, -9.0, 32.0, 2.2, 5.0, (1.0, 1.0, 1.0)), (-62.0, -9.0, 32.0, 2.2, 5.0, (1.0, 1.0, 1.0)),
             (62.0, -9.0, 32.0, 2.2, 5.0, (1.0, 1.0, 1.0)),
             (-30.0, 72.0, 30.0, 14.0, 3.5, (1.0, 1.0, 1.0))]
    ST.world_reflection(boxes, camera_color=(0.0011, 0.0011, 0.0014), dome=0.004, horizon=0.015)
    H = AR.liquid_chrome(coll("art"), ctx.seed, p["blobs"], p["size"], p["resolution"], p["tint"], p["rough"], p["film"])
    if p["floor"]:
        fm = MT.floor_polished("floor", half=(p["size"], p["size"]), falloff=0.3, spec=0.3)
        ST.cyclorama(coll("set"), mat=fm)
    r = p["size"] * 1.25
    H["center"] = (0.0, 0.0, p["size"] * 2.3)
    dist = CM.fit_dist(r, r * 0.8, p["lens"], ctx.W, ctx.H, 0.78 if ctx.tall else 0.62)
    H["cam"] = CM.make()
    H["s0"] = CM.state(target=H["center"], az=0.0, el=7.0, dist=dist, lens=p["lens"], fstop=p["fstop"])
    H["s0"]["focus"] = Vector(H["center"]) + CM.dirv(0.0, 7.0) * p["size"]
    return H


def frame(H, ctx, f, K):
    p = ctx.p
    P = C.phase(ctx, f)
    AR.liquid_frame(H, K, P, H["center"])
    s = CM.clone(H["s0"])
    s["az"] = 9.0 * math.sin(TAU * p["turns"] * P)
    s["el"] = 7.0 + 2.0 * math.sin(TAU * P + 1.0)
    CM.apply(H["cam"], s, K)
