# blender/knolling: the model comes apart, every part flies to a tidy overhead flat-lay grid (knolling: laid flat,
# square to the frame, largest first, twins side by side) while the camera cranes from a 3/4 view to straight down;
# the grid holds; then the parts fly home in reverse order and the model reassembles. Light studio, soft overhead box,
# real contact shadows. Model: the kit flyer (lib/kit.py, 21 primitive parts). MIT (see blender/LICENSE).
from mathutils import Vector

from lib import camera as CM, kit as KT, materials as MT, studio as ST
from lib.ease import E, seg, lerp
from lib.util import coll

from . import _common as C

ID = "blender/knolling"
NAME = "Knolling flat-lay"
DOC = "Exploded parts settle into an overhead flat-lay grid (camera cranes to top-down), hold, then reassemble."
USE = "'Every part is separate / editable' proof beats, teardown and bill-of-parts moments, product anatomy posts."
AVOID = "Presenting concept parts as a real bill of materials (label it); slots shorter than ~4 s (the move needs air)."
LOOP = False
DEFAULTS = dict(seconds=6.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "open_at": {"type": "float", "default": 0.4, "doc": "parts start to separate (s)"},
    "settle_at": {"type": "float", "default": 1.0, "doc": "first part leaves for its slot (s)"},
    "settle_dur": {"type": "float", "default": 1.8, "doc": "from the first part leaving to the last part landing (s)"},
    "fly": {"type": "float", "default": 0.75, "doc": "flight time of one part (s)"},
    "reassemble_at": {"type": "float", "default": 3.9, "doc": "first part leaves the grid (s); <= 0 = stay laid out"},
    "reassemble_dur": {"type": "float", "default": 1.6, "doc": "from first leaving to last seated (s)"},
    "spread": {"type": "float", "default": 0.7, "doc": "explode distance (x the part's offset from the centre)"},
    "arc": {"type": "float", "default": 0.07, "doc": "lift of each flight (m)"},
    "gap": {"type": "float", "default": 0.03, "doc": "space between laid-out parts (m)"},
    "az": {"type": "float", "default": 32.0, "doc": "3/4 camera azimuth (deg)"},
    "el": {"type": "float", "default": 20.0, "doc": "3/4 camera elevation (deg)"},
    "el_top": {"type": "float", "default": 88.0, "doc": "overhead elevation (deg; < 90 keeps the frame upright)"},
    "lens": {"type": "float", "default": 50.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 11.0, "doc": "aperture"},
    "floor": {"type": "color", "default": (0.22, 0.22, 0.23), "doc": "table colour (linear)"},
    "body": {"type": "color", "default": (0.62, 0.57, 0.48), "doc": "body colour (linear)"},
    "accent": {"type": "color", "default": MT.VIOLET_AGX, "doc": "accent colour (linear)"},
}


def build(ctx):
    p = ctx.p
    ST.world_dark((0.03, 0.03, 0.033))
    tm = MT.principled("table", p["floor"], 0.7, 0.0, Specular_IOR_Level=0.3)
    ST.cyclorama(coll("set"), mat=tm, front=-6.0, wall=3.0)
    M = KT.build(coll("model"), lambda n, look: KT.full_material("k_" + n, look, p["body"], p["accent"]))
    parts = M["parts"]
    aspect = (ctx.W / float(ctx.H))
    hw, hd = KT.knolling_layout(parts, p["gap"], aspect)
    col = coll("lights")
    ST.area("softbox", col, (1.6, 1.2), (0.0, 0.1, 1.9), (0.0, 0.0, 0.0), 55.0, (1.0, 0.98, 0.95), 100)
    ST.area("key", col, (1.0, 0.4), (-1.1, -0.9, 0.8), (0, 0, 0.1), 30.0, (1.0, 0.96, 0.9), 120)
    ST.area("rim", col, (1.4, 0.1), (0.6, 1.1, 0.6), (0, 0, 0.12), 25.0, (0.88, 0.93, 1.0), 100)
    info = M["info"]
    cen = info["centre"]
    d_a = CM.fit_dist(info["span"] / 2 * (1 + p["spread"] * 0.6), info["height"] / 2 + 0.06, p["lens"], ctx.W, ctx.H,
                      0.86 if ctx.tall else 0.66)
    d_k = CM.fit_dist(hw, hd, p["lens"], ctx.W, ctx.H, 0.9 if ctx.tall else 0.84)
    for q in parts:
        off = (q["home_loc"] - cen) * p["spread"]
        q["exp"] = q["home_loc"] + off + Vector((0, 0, 0.05 + 0.04 * p["spread"]))
    n = len(parts)
    ctx.report["parts"] = n
    ctx.report["layout_m"] = [round(2 * hw, 3), round(2 * hd, 3)]
    return {"parts": parts, "cam": CM.make(), "d_a": d_a, "d_k": d_k, "cen": cen, "n": n}


def _fly(a, b, k, arc):
    return a.lerp(b, k) + Vector((0, 0, arc * 4.0 * k * (1.0 - k)))


def frame(H, ctx, f, K):
    p = ctx.p
    t = C.t_of(ctx, f)
    n = H["n"]
    span = max(0.0, p["settle_dur"] - p["fly"])
    ra = p["reassemble_at"]
    rspan = max(0.0, p["reassemble_dur"] - p["fly"])
    for q in H["parts"]:
        i = q["order"]
        ue = E["move"](seg(t, p["open_at"], p["open_at"] + 0.6 + 0.02 * i))
        exp_pos = q["home_loc"].lerp(q["exp"], ue)
        s0 = p["settle_at"] + span * i / max(1, n - 1)
        ks = E["move"](seg(t, s0, s0 + p["fly"]))
        loc, rot = _fly(exp_pos, q["slot"], ks, p["arc"]), q["home_rot"].slerp(q["flat_rot"], ks)
        if ra > 0:
            r0 = ra + rspan * (n - 1 - i) / max(1, n - 1)
            kr = E["move"](seg(t, r0, r0 + p["fly"]))
            if kr > 0:
                loc, rot = _fly(q["slot"], q["home_loc"], kr, p["arc"]), q["flat_rot"].slerp(q["home_rot"], kr)
        KT.pose(q, K, loc, rot)
    # camera: 3/4 -> overhead while the parts travel, back down for the reassembly
    c_up = E["move"](seg(t, p["open_at"] + 0.2, p["settle_at"] + p["settle_dur"]))
    c_dn = E["move"](seg(t, ra, ra + p["reassemble_dur"])) if ra > 0 else 0.0
    k = c_up * (1.0 - c_dn)
    el = lerp(p["el"], p["el_top"], k)
    az = lerp(p["az"], 0.0, k)
    dist = lerp(H["d_a"], H["d_k"], k)
    tgt = H["cen"].lerp(Vector((0, 0, 0.0)), k)
    s = CM.state(target=tgt, az=az, el=el, dist=dist, lens=p["lens"], fstop=p["fstop"])
    s["focus"] = Vector(tgt)
    CM.apply(H["cam"], s, K)
