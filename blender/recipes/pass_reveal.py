# blender/passReveal: one model shown as its render passes, wireframe -> x-ray -> clay -> full material. Each step is
# a soft wipe across the model (left to right) driven by a single keyed stage value, while the camera orbits slowly.
# --param pass=wire|xray|clay|full holds ONE pass for the whole plate instead: render the four and wipe between them
# in HyperFrames (same camera, same frames, so the plates register exactly). The model is the procedural kit flyer
# (lib/kit.py, 21 primitive parts). MIT (see blender/LICENSE).
from mathutils import Vector

from lib import camera as CM, kit as KT, materials as MT, studio as ST
from lib.ease import E, seg
from lib.util import coll

from . import _common as C

ID = "blender/passReveal"
NAME = "Render-pass reveal"
DOC = "Wireframe -> x-ray -> clay -> full material on one model, each step a soft wipe; or one pass per plate (pass=...)."
USE = "The 'how it is made' beat of an AI-builder or 3D-tool launch; a sketch-to-render reveal; per-pass plates for a wipe."
AVOID = "Implying a real product pipeline you do not have; a pass shown so briefly it reads as a glitch (< 0.6 s)."
LOOP = False
DEFAULTS = dict(seconds=6.0, size=(1920, 1080), engine="eevee")
PASSES = ("wire", "xray", "clay", "full")
PARAMS = {
    "pass": {"type": "str", "default": "", "doc": "'' = timed progression; wire | xray | clay | full = hold that pass"},
    "steps": {"type": "list", "default": [0.9, 2.1, 3.3], "doc": "start of each wipe (s): wire->xray | xray->clay | clay->full"},
    "wipe": {"type": "float", "default": 0.7, "doc": "seconds per wipe"},
    "orbit": {"type": "float", "default": 40.0, "doc": "camera orbit over the plate (deg)"},
    "az": {"type": "float", "default": 28.0, "doc": "camera azimuth at the start (deg)"},
    "el": {"type": "float", "default": 16.0, "doc": "camera elevation (deg)"},
    "lens": {"type": "float", "default": 60.0, "doc": "mm on a 24 mm vertical sensor"},
    "fstop": {"type": "float", "default": 8.0, "doc": "aperture"},
    "fill": {"type": "float", "default": 0.0, "doc": "model fill of the limiting frame side (0 = 0.62 wide / 0.86 tall)"},
    "wire_mm": {"type": "float", "default": 1.6, "doc": "wire thickness (mm; the model spans 660 mm)"},
    "body": {"type": "color", "default": (0.62, 0.57, 0.48), "doc": "body colour of the full pass (linear)"},
    "accent": {"type": "color", "default": MT.VIOLET_AGX, "doc": "accent colour of the full pass (linear; default brand violet)"},
    "bg": {"type": "float", "default": 0.0016, "doc": "world / backdrop level (linear grey)"},
}


def build(ctx):
    p = ctx.p
    if p["pass"] and p["pass"] not in PASSES:
        raise SystemExit("pass must be one of %s (or empty)" % ", ".join(PASSES))
    ST.world_dark((p["bg"], p["bg"], p["bg"] * 1.1))
    fm = MT.floor_polished("floor", half=(0.36, 0.36), falloff=0.3, spec=0.18)
    floor = ST.cyclorama(coll("set"), mat=fm)
    g, stage = KT.pass_group(-0.36, 0.36)

    def mat_for(name, look):
        return KT.pass_material("pass_" + name, g, look, p["body"], p["accent"])
    M = KT.build(coll("model"), mat_for)
    wires = KT.add_wires(M["parts"], coll("wires"), KT.wire_material(g), p["wire_mm"] / 1000.0)
    col = coll("lights")
    objs = [q["ob"] for q in M["parts"]]
    key = ST.area("key", col, (1.6, 0.6), (-0.9, -0.8, 1.1), (0, 0, 0.12), 60.0, (1.0, 0.97, 0.93), 110)
    rim = ST.area("rim", col, (1.8, 0.12), (0.5, 1.0, 0.7), (0, 0, 0.15), 40.0, (0.88, 0.92, 1.0), 100)
    fill = ST.area("fill", col, (1.0, 1.0), (1.2, -0.6, 0.5), (0, 0, 0.12), 6.0, (0.95, 0.97, 1.0), 140)
    ST.link_to([key, rim, fill], objs, "model_recv")
    pool = ST.area("pool", col, (0.9, 0.9), (0, -0.05, 1.4), (0, -0.05, 0), 18.0, (1.0, 0.97, 0.93), 60)
    pool.data.specular_factor = 0.0
    ST.link_to([pool], [floor], "floor_recv")
    info = M["info"]
    fill_k = p["fill"] or (0.86 if ctx.tall else 0.62)
    dist = CM.fit_dist(info["span"] / 2, info["height"] / 2 + 0.04, p["lens"], ctx.W, ctx.H, fill_k)
    cam = CM.make()
    s0 = CM.state(target=info["centre"], az=p["az"], el=p["el"], dist=dist, lens=p["lens"], fstop=p["fstop"])
    s0["focus"] = Vector(info["centre"])
    ctx.report["passes"] = list(PASSES)
    ctx.report["mode"] = p["pass"] or "progression"
    return {"M": M, "stage": stage, "wires": wires, "cam": cam, "s0": s0}


def stage_at(p, t):
    if p["pass"]:
        return float(PASSES.index(p["pass"]))
    steps = [float(x) for x in p["steps"]]
    return sum(E["soft"](seg(t, a, a + p["wipe"])) for a in steps[:3])


def frame(H, ctx, f, K):
    p = ctx.p
    t = C.t_of(ctx, f)
    K.set(H["stage"].outputs[0], "default_value", stage_at(p, t))
    s = CM.orbit(H["s0"], C.u_of(ctx, f), p["orbit"], "sine", 0.0)
    CM.apply(H["cam"], s, K)
