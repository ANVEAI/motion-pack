# blender/art.voxelWave: a field of bars under travelling waves (integer harmonics of the loop, so seamless) with
# glowing tops coloured by height. Optional --beats <music sidecar.json>: kicks pump the field and launch expanding
# rings (hits wrap modulo the loop; render.json says whether the loop is still seamless). MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import art as AR, beats as BT, camera as CM, materials as MT, studio as ST
from lib.ease import TAU
from lib.util import coll

from . import _common as C

ID = "blender/art.voxelWave"
NAME = "Voxel wave loop"
DOC = "Bars under travelling waves, height-coloured glowing tops; beat-reactive from a motion-pack music sidecar."
USE = "Music visual beds, beat edits, the 'data / compute' metaphor behind a title, loops for socials."
AVOID = "Reading as a real chart (it is not data); beat mode with a plate length that is not whole beats."
LOOP = True
DEFAULTS = dict(seconds=4.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "grid": {"type": "int", "default": 26, "doc": "bars per side"},
    "pitch": {"type": "float", "default": 0.042, "doc": "bar spacing (m)"},
    "amp": {"type": "float", "default": 0.16, "doc": "wave height (m)"},
    "low": {"type": "color", "default": MT.VIOLET_AGX, "doc": "colour of low tops (linear)"},
    "high": {"type": "color", "default": (1.0, 0.30, 0.02), "doc": "colour of high tops (linear)"},
    "glow": {"type": "float", "default": 2.4, "doc": "top emission (keep <= ~3: AgX desaturates hotter tops)"},
    "beat_gain": {"type": "float", "default": 1.0, "doc": "how hard the kicks pump (with --beats)"},
    "pulse_every": {"type": "float", "default": 0.0, "doc": "without --beats: a ring every N s (0 = 4 per loop)"},
    "az": {"type": "float", "default": 32.0, "doc": "camera azimuth (deg)"},
    "el": {"type": "float", "default": 30.0, "doc": "camera elevation (deg)"},
    "sway": {"type": "float", "default": 7.0, "doc": "azimuth sway per loop (deg, seamless)"},
    "lens": {"type": "float", "default": 60.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 4.0, "doc": "aperture"},
}


def build(ctx):
    p = ctx.p
    ST.world_dark((0.0012, 0.0012, 0.0015))
    fm = MT.floor_polished("floor", half=(p["grid"] * p["pitch"] / 2,) * 2, falloff=0.25, spec=0.2)
    ST.cyclorama(coll("set"), mat=fm)
    H = AR.voxel_wave(coll("art"), p["grid"], p["pitch"], 0.16, 0.02, p["amp"], p["low"], p["high"], p["glow"], ctx.seed)
    col = coll("lights")
    key = ST.area("key", col, (2.0, 0.5), (-1.2, -1.0, 1.6), (0, 0, 0), 18.0, (1.0, 0.97, 0.93), 100)
    rim = ST.area("rim", col, (2.4, 0.08), (0.6, 1.6, 0.9), (0, 0, 0.05), 14.0, (0.85, 0.9, 1.0), 90)
    ST.link_to([key, rim], [H["ob"]], "voxel_recv")          # the polished floor never mirrors the strips
    if ctx.beats_path:
        H["B"] = BT.load(ctx.beats_path, ctx.fps, ctx.N, loop=True)
        ctx.report["beats"] = H["B"]["info"]
    else:
        every = p["pulse_every"] or ctx.seconds / 4.0
        n = max(1, int(round(ctx.seconds / every)))
        H["B"] = {"hits": [i * ctx.N / n for i in range(n)], "accents": [], "n": ctx.N, "loop": True,
                  "info": {"synthetic": True, "every_s": every}}
    span = H["span"]
    dist = CM.fit_dist(span * 1.15, span * 0.7, p["lens"], ctx.W, ctx.H, 0.92 if ctx.tall else 0.8)
    H["cam"] = CM.make()
    H["s0"] = CM.state(target=(0, 0, 0.05), az=p["az"], el=p["el"], dist=dist, lens=p["lens"], fstop=p["fstop"])
    H["s0"]["focus"] = Vector((0, 0, 0.06))
    return H


def frame(H, ctx, f, K):
    p = ctx.p
    P = C.phase(ctx, f)
    fr = f % ctx.N
    e = BT.envelope(H["B"], fr) * p["beat_gain"]
    rg = BT.rings(H["B"], fr, speed=H["span"] / 14.0, tau=12.0, amp=0.55 * p["beat_gain"])
    AR.voxel_frame(H, K, P, e, rg)
    s = CM.clone(H["s0"])
    s["az"] = p["az"] + p["sway"] * math.sin(TAU * P)
    CM.apply(H["cam"], s, K)
