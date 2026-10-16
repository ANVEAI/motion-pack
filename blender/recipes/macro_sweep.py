# blender/macroSweep: a macro on the band where it bends round the front-right chamfer (the launch film's poster
# crop): a slow macro slide along the face while the feathered strip travels across the box, so one specular line
# sweeps the top chamfer and the band corner. f/8, focus on the band corner. MIT (see blender/LICENSE).
from mathutils import Vector

from lib import camera as CM, device as DV, studio as ST
from lib.ease import E, seg, lerp

from . import _common as C

ID = "blender/macroSweep"
NAME = "Macro light sweep"
DOC = "Macro on the band corner; the key strip travels 1.2 m across the box (the glint sweeps the chamfers); macro slide."
USE = "Hook frames, detail beats between wides, a poster still at the glint's peak, under a short super."
AVOID = "Wides or establishing shots; holding it past ~4 s (macro detail tires fast); busy type over the glint."
LOOP = False
DEFAULTS = dict(seconds=4.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "az": {"type": "float", "default": 38.0, "doc": "camera azimuth (deg)"},
    "el": {"type": "float", "default": 9.0, "doc": "camera elevation (deg)"},
    "dist": {"type": "float", "default": 0.0, "doc": "camera distance m (0 = fit ~ 20 cm of the corner across)"},
    "lens": {"type": "float", "default": 100.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 8.0, "doc": "aperture (f/8 keeps the band corner sharp)"},
    "slide_mm": {"type": "float", "default": 36.0, "doc": "macro slide along the front face (mm, toward camera-left)"},
    "sweep_from": {"type": "float", "default": -1.0, "doc": "key strip x at the start (m)"},
    "sweep_to": {"type": "float", "default": 0.6, "doc": "key strip x at the end (m)"},
    "sweep_at": {"type": "float", "default": 0.3, "doc": "sweep start (s)"},
    "sweep_dur": {"type": "float", "default": 3.2, "doc": "sweep duration (s)"},
    "key_w": {"type": "float", "default": 70.0, "doc": "key strip energy (W, all three feathers)"},
    "band_strength": {"type": "float", "default": None, "doc": "override the preset's band strength"},
    **C.MODEL_PARAMS,
}


def build(ctx):
    p = ctx.p
    D = C.device_from(ctx, p)
    S = C.product_studio(ctx, D, key=(p["sweep_from"], -0.3), key_w=p["key_w"])
    corner = C.look_point(D, "front_right_band")
    tgt = corner + Vector((-0.012, 0.0, 0.016))
    dist = p["dist"] or CM.fit_dist(0.1, 0.056, p["lens"], ctx.W, ctx.H, 0.9)
    cam = CM.make(clip=(0.005, 200.0))
    s0 = CM.state(target=tgt, az=p["az"], el=p["el"], dist=dist, lens=p["lens"], fstop=p["fstop"])
    s0["focus"] = corner
    return {"D": D, "S": S, "cam": cam, "s0": s0, "corner": corner}


def frame(H, ctx, f, K):
    p = ctx.p
    D, S = H["D"], H["S"]
    t = C.t_of(ctx, f)
    u = C.u_of(ctx, f)
    C.set_band(D, K, 1.0, 1.0, 0.0)
    k = E["glide"](seg(t, p["sweep_at"], p["sweep_at"] + p["sweep_dur"]))
    x = lerp(p["sweep_from"], p["sweep_to"], k)
    ST.move_key(S["rig"], K, Vector((x, -0.3, 0.95)), Vector((0.45 * x, 0.0, 0.08)))
    s = CM.macro_slide(H["s0"], u, delta=(-p["slide_mm"] / 1000.0, 0.0, 0.0), focus_delta=(0, 0, 0), e="glide")
    CM.apply(H["cam"], s, K)
