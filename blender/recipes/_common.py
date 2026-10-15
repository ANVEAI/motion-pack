# motion-pack/blender recipes: shared pieces (the dark product studio, framing, parameter coercion).
# A recipe module defines ID, NAME, DOC, USE, AVOID, LOOP, DEFAULTS, PARAMS, build(ctx) -> H and frame(H, ctx, f, K).
# frame() must set every animated value from the frame number alone (it is called once per frame, in any order).
# MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import device as DV, studio as ST, materials as MT, camera as CM, model as MD
from lib.util import coll


def coerce(spec, raw):
    t = spec.get("type", "float")
    if t == "float":
        return float(raw)
    if t == "int":
        return int(float(raw))
    if t == "bool":
        return raw if isinstance(raw, bool) else str(raw).lower() in ("1", "true", "yes", "on")
    if t == "list":
        return raw if isinstance(raw, (list, tuple)) else [x for x in str(raw).split("|")]
    if t == "color":
        if isinstance(raw, (list, tuple)):
            return tuple(float(x) for x in raw)
        s = str(raw)
        return MT.VIOLET_AGX if s.lower() in ("violet", "brand") else tuple(float(x) for x in s.split(","))
    return str(raw)


def merge_params(PARAMS, given):
    out = {k: v.get("default") for k, v in PARAMS.items()}
    unknown = []
    for k, v in (given or {}).items():
        if k not in PARAMS:
            unknown.append(k)
            continue
        out[k] = coerce(PARAMS[k], v)
    return out, unknown


def product_studio(ctx, D, key=None, floor_dim=1.0, accent=MT.VIOLET_AGX, accent_w=0.9, key_w=70.0, fill_w=1.6):
    """Dark sweep, polished floor whose reflection fades round the footprint, near-black world, the hero rig."""
    hw, hd, h = DV.footprint(D)
    fm = MT.floor_polished("floor", half=(hw + 0.01, hd + 0.01))
    fm.node_tree.nodes["fdim"].outputs[0].default_value = floor_dim
    floor = ST.cyclorama(coll("set"), mat=fm)      # (--alpha: run.py hides it in EEVEE, makes it a catcher in Cycles)
    world, bg = ST.world_dark()
    kx, ky = key if key else (-0.42, -0.34)
    R = ST.product_rig(coll("lights"), D["meshes"], floor, key_x=kx, key_y=ky, accent=accent, accent_w=accent_w,
                       key_w=key_w, fill_w=fill_w)
    return {"floor": floor, "world": world, "bg": bg, "rig": R, "floor_mat": fm}


def framing(ctx, half_w, half_h, lens, fill_wide, fill_tall):
    return CM.fit_dist(half_w, half_h, lens, ctx.W, ctx.H, fill_tall if ctx.tall else fill_wide)


MODEL_PARAMS = {   # xp-hardware 2026-10-16: YOUR model instead of the procedural device (turntable, macroSweep, explode)
    "model": {"type": "str", "default": "", "doc": "path to your .glb / .gltf / .obj (empty = the procedural device); stood on the floor, centred, scaled to model_size"},
    "model_size": {"type": "float", "default": 0.3, "doc": "the model's width in metres (model_axis w | h | max)"},
    "model_axis": {"type": "str", "default": "w", "doc": "which side model_size measures: w (width), h (height) or max"},
    "model_yaw": {"type": "float", "default": 0.0, "doc": "turn the model at import (deg) so its front faces the camera"},
}


def device_from(ctx, p):
    if p.get("model"):
        return MD.load(p["model"], coll("device"), size=p.get("model_size", 0.3), axis=p.get("model_axis", "w"), yaw=math.radians(p.get("model_yaw", 0.0)))
    over = {}
    if p.get("band_strength") not in (None, ""):
        over["band"] = {"strength": float(p["band_strength"])}
    D = DV.spec(ctx.preset or "matte-copper", **over)
    return DV.build(D, coll("device"), seed=ctx.seed)


def phase(ctx, f):
    """Loop phase. Without motion blur only whole frames are evaluated, so the phase wraps ((f mod N) / N) and frame N
    holds exactly frame 0's values (a bit-exact seam). With motion blur it stays unwrapped (f / N) so the shutter
    interpolates forward across the seam; integer harmonics make P = 1 equal P = 0 up to float rounding."""
    if not getattr(ctx, "motion_blur", True):
        return (f % ctx.N) / float(ctx.N)
    return f / float(ctx.N)


def t_of(ctx, f):
    return f / float(ctx.fps)


def u_of(ctx, f):
    return min(1.0, max(0.0, f / float(max(1, ctx.N - 1))))


def look_point(D, where="front_right_band"):
    hw, hd, h = DV.footprint(D)
    c = D["corner_size"]
    if D.get("model") and where == "front_right_band":   # your model: its front-right top corner (there is no band)
        return Vector((hw - c * 0.5, -(hd - c * 0.5), h * 0.92))
    if where == "front_right_band":
        return Vector((hw - c * 0.5, -(hd - c * 0.5), D["z_band_c"]))
    return Vector((0, 0, h * 0.5))


def set_band(D, K, *a, **k):
    """the band of the procedural device; a no-op on your model (it has none)"""
    if not D.get("model"):
        DV.set_band(D, K, *a, **k)


def deg(x):
    return math.radians(x)
