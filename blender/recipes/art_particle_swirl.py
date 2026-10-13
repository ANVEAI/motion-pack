# blender/art.particleSwirl: a seeded vortex of glowing streaks. Every particle sits on an orbit with a whole number
# of revolutions per loop and a whole-number bob, so the loop is seamless; streak length follows speed (motion read
# without relying on motion blur). MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import art as AR, camera as CM, materials as MT, studio as ST
from lib.ease import TAU
from lib.util import coll

from . import _common as C

ID = "blender/art.particleSwirl"
NAME = "Particle swirl loop"
DOC = "Seeded vortex of emissive streaks on integer-revolution orbits; palette by particle; seamless."
USE = "Energy / AI / 'thinking' metaphors, backgrounds under type, transition plates, loops for socials."
AVOID = "Literal data or physics claims; flashy use under body copy (keep glow low behind text)."
LOOP = True
DEFAULTS = dict(seconds=6.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "count": {"type": "int", "default": 2000, "doc": "particles"},
    "radius": {"type": "float", "default": 0.62, "doc": "outer radius (m)"},
    "streak": {"type": "float", "default": 9.0, "doc": "streak length vs speed"},
    "glow": {"type": "float", "default": 2.6, "doc": "emission"},
    "size": {"type": "float", "default": 0.0028, "doc": "particle radius (m)"},
    "c1": {"type": "color", "default": MT.VIOLET_AGX, "doc": "palette 1 (linear)"},
    "c2": {"type": "color", "default": (1.0, 0.30, 0.02), "doc": "palette 2 (linear)"},
    "c3": {"type": "color", "default": (0.55, 0.7, 1.0), "doc": "palette 3 (linear)"},
    "el": {"type": "float", "default": 24.0, "doc": "camera elevation (deg)"},
    "lens": {"type": "float", "default": 50.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 2.8, "doc": "aperture (shallow: near streaks bloom into bokeh)"},
}


def build(ctx):
    p = ctx.p
    ST.world_dark((0.0006, 0.0006, 0.0009))
    H = AR.particle_swirl(coll("art"), ctx.seed, p["count"], 0.08, p["radius"], 0.32, p["size"], p["streak"],
                          (p["c1"], p["c2"], p["c3"]), p["glow"])
    H["ob"].location = (0, 0, 0)
    r = p["radius"]
    dist = CM.fit_dist(r * 1.05, r * 0.75, p["lens"], ctx.W, ctx.H, 0.95 if ctx.tall else 0.82)
    H["cam"] = CM.make()
    H["s0"] = CM.state(target=(0, 0, 0), az=0.0, el=p["el"], dist=dist, lens=p["lens"], fstop=p["fstop"])
    H["s0"]["focus"] = Vector((0, 0, 0))
    return H


def frame(H, ctx, f, K):
    P = C.phase(ctx, f)
    AR.swirl_frame(H, K, P)
    s = CM.clone(H["s0"])
    s["az"] = 6.0 * math.sin(TAU * P)
    CM.apply(H["cam"], s, K)
