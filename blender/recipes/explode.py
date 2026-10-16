# blender/explode: the exploded-view rig. Sealed hero -> the launch film's cascade (lid first out, 0.08 s apart, each
# on its own 0.8-0.9 s E.move) -> a held, breathing teardown while the camera cranes up -> the exact time-mirror
# reassembly (the lid seats last) -> one band flare on contact. MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import camera as CM, device as DV, model as MD
from lib.ease import E, seg, hermite

from . import _common as C

ID = "blender/explode"
NAME = "Exploded view"
DOC = "Sealed -> cascade open -> breathing hold with a crane -> mirrored reassembly -> band flare on the seal."
USE = "The 'what is inside' beat of a launch film; spec call-outs over the held stack (type from the pack)."
AVOID = "Showing hardware that is not real without a 'planned configuration' label; very short slots (< 3.5 s)."
LOOP = False
DEFAULTS = dict(seconds=5.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "open_at": {"type": "float", "default": 0.45, "doc": "cascade start (s)"},
    "seal_at": {"type": "float", "default": 4.55, "doc": "lid seats (s); <= 0 = stay open"},
    "spread": {"type": "float", "default": 1.0, "doc": "offset scale (1 = the film's teardown)"},
    "speed": {"type": "float", "default": 1.15, "doc": "cascade speed (1 = the film's 0.8-0.9 s per part)"},
    "az": {"type": "float", "default": 24.0, "doc": "camera azimuth at the start (deg)"},
    "az_end": {"type": "float", "default": 12.0, "doc": "camera azimuth at the end (deg)"},
    "el": {"type": "float", "default": 7.0, "doc": "elevation while sealed (deg)"},
    "el_open": {"type": "float", "default": 15.0, "doc": "elevation while exploded (deg, the crane)"},
    "lens": {"type": "float", "default": 85.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 8.0, "doc": "aperture"},
    "fill": {"type": "float", "default": 0.0, "doc": "fill of the exploded stack (0 = 0.62 wide / 0.86 tall)"},
    "band_strength": {"type": "float", "default": None, "doc": "override the preset's band strength"},
    **C.MODEL_PARAMS,
}


def build(ctx):
    p = ctx.p
    D = C.device_from(ctx, p)
    S = C.product_studio(ctx, D)
    hw, hd, h = DV.footprint(D)
    k = h / 0.2185
    open_h = h + 0.17 * k * p["spread"]
    open_w = hw + 0.101 * k * p["spread"]
    if D.get("model"):   # your model: the parts travel 0.45 x its largest side
        big = max(D["w"], D["d"], D["h"])
        open_h, open_w = h + 0.6 * big * p["spread"], hw + 0.45 * big * p["spread"]
    fill = p["fill"] or (0.86 if ctx.tall else 0.62)
    d_open = CM.fit_dist(open_w, open_h * 0.55, p["lens"], ctx.W, ctx.H, fill)
    d_seal = d_open * 0.86
    cam = CM.make()
    seal = p["seal_at"] if p["seal_at"] > 0 else None
    return {"D": D, "S": S, "cam": cam, "d_open": d_open, "d_seal": d_seal, "seal": seal, "h": h, "open_h": open_h}


def frame(H, ctx, f, K):
    p = ctx.p
    D = H["D"]
    t = C.t_of(ctx, f)
    T = ctx.seconds
    to, ts = p["open_at"], H["seal"]
    mid_open = to + 0.95 / p["speed"]
    hold_end = (ts - 0.95 / p["speed"]) if ts else T
    br = math.sin(math.pi * seg(t, mid_open, hold_end)) ** 2 if hold_end > mid_open else 0.0
    if D.get("model"):
        MD.explode(D, K, t, to, ts, p["spread"], br, p["speed"])
    else:
        DV.explode(D, K, t, to, ts, p["spread"], br, p["speed"])
    # the seal flare: a fast rise on contact, a 0.3 s fall
    fl = 0.0
    if ts:
        fl = E["soft"](seg(t, ts - 1 / 30.0, ts + 1 / 30.0)) * (1 - E["soft"](seg(t, ts + 1 / 30.0, ts + 0.33)))
    C.set_band(D, K, 1.0 + 0.6 * fl, 1.0, 0.0)
    # camera: a crane up for the exploded stack, back down for the seal; distance follows the stack; a slow yaw
    tz0, tz1 = H["h"] * 0.47, H["open_h"] * 0.5
    end = ts if ts else T
    keys_el = [(0.0, p["el"], 0.0), (mid_open, p["el_open"], 0.0), (hold_end, p["el_open"] + 1.5, 0.0), (end, p["el"] - 0.5, 0.0)]
    keys_d = [(0.0, H["d_seal"], 0.0), (mid_open, H["d_open"], 0.0), (hold_end, H["d_open"] * 1.02, 0.0), (end, H["d_seal"], 0.0)]
    keys_z = [(0.0, tz0, 0.0), (mid_open, tz1, 0.0), (hold_end, tz1, 0.0), (end, tz0, 0.0)]
    tc = min(t, end)
    az = p["az"] + (p["az_end"] - p["az"]) * E["sine"](seg(t, 0.0, T))
    s = CM.state(target=(0, 0, hermite(keys_z, tc)), az=az, el=hermite(keys_el, tc), dist=hermite(keys_d, tc),
                 lens=p["lens"], fstop=p["fstop"])
    s["focus"] = Vector((0, 0, hermite(keys_z, tc))) + CM.dirv(az, s["el"]) * (D["d"] * 0.35)
    CM.apply(H["cam"], s, K)
