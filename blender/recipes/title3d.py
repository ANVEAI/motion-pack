# blender/title3d: a 3D extruded title (one mesh per glyph) on a polished black floor: letters flip up into place on
# a stagger (E.hero), a strip light sweeps the chrome, a violet back-glow and violet rims; a slow push. Styles:
# chrome-violet (chrome faces, violet anodised sides), chrome, violet-glow (emissive violet faces, chrome sides),
# matte (satin white). 9:16 re-lays the title on two lines at the hyphen. MIT (see blender/LICENSE).
import math

from mathutils import Vector

from lib import camera as CM, materials as MT, studio as ST, title as TT
from lib.ease import E, seg, lerp
from lib.util import coll, obj_from

from . import _common as C

ID = "blender/title3d"
NAME = "3D extruded title"
DOC = "Per-letter extruded title (pack OFL fonts), stagger flip-up, strip glint across chrome, violet back-glow, push-in."
USE = "Launch title / logo-type beat, end card hero word, chapter cards (2-3 words max)."
AVOID = "Body copy or anything longer than ~14 characters per line; small type (use the pack's type/ module)."
LOOP = False
DEFAULTS = dict(seconds=4.0, size=(1920, 1080), engine="eevee")
PARAMS = {
    "text": {"type": "str", "default": "motion-pack", "doc": "the title ('|' forces line breaks)"},
    "style": {"type": "str", "default": "chrome-violet", "doc": "chrome-violet | chrome | violet-glow | matte"},
    "font": {"type": "str", "default": TT.DEFAULT_FONT, "doc": "TTF path (default: the pack's Manrope, OFL)"},
    "weight": {"type": "float", "default": 800.0, "doc": "variable-font weight (cut with fontTools)"},
    "size": {"type": "float", "default": 0.24, "doc": "em size (m)"},
    "extrude": {"type": "float", "default": 0.034, "doc": "half-depth of the extrusion (m)"},
    "bevel": {"type": "float", "default": 0.0055, "doc": "bevel radius (m)"},
    "stagger": {"type": "float", "default": 0.07, "doc": "per-letter delay (s)"},
    "flip_dur": {"type": "float", "default": 0.75, "doc": "per-letter flip (s)"},
    "in_at": {"type": "float", "default": -0.2, "doc": "first letter starts (s; < 0 = frame 0 is already mid-flip)"},
    "sweep_at": {"type": "float", "default": 1.15, "doc": "glint sweep start (s)"},
    "sweep_dur": {"type": "float", "default": 1.6, "doc": "glint sweep duration (s)"},
    "accent": {"type": "color", "default": MT.VIOLET_AGX, "doc": "accent colour (linear RGB, AgX-lifted violet)"},
    "glow": {"type": "float", "default": 1.0, "doc": "violet back-glow strength (0 = off)"},
    "el": {"type": "float", "default": 4.0, "doc": "camera elevation (deg)"},
    "az": {"type": "float", "default": -8.0, "doc": "camera azimuth at the start (deg)"},
    "az_end": {"type": "float", "default": 4.0, "doc": "camera azimuth at the end (deg)"},
    "lens": {"type": "float", "default": 85.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 5.6, "doc": "aperture"},
    "fill": {"type": "float", "default": 0.0, "doc": "title width fill (0 = 0.74 wide / 0.86 tall)"},
    "lines": {"type": "str", "default": "auto", "doc": "auto (split at '-' for 9:16) | one"},
}


def _materials(style, accent):
    chrome = MT.chrome("title_chrome", (0.94, 0.94, 0.96), 0.03)
    violet_metal = MT.principled("title_violet", tuple(c * 0.85 for c in accent), 0.2, 1.0)
    if style == "chrome":
        return chrome, chrome
    if style == "violet-glow":
        return MT.emission("title_glow", accent, 3.0), chrome
    if style == "matte":
        m = MT.principled("title_satin", (0.82, 0.82, 0.8), 0.35, Coat_Weight=0.4, Coat_Roughness=0.1)
        return m, m
    return chrome, violet_metal


def build(ctx):
    p = ctx.p
    text = p["text"]
    lines = text.split("|") if "|" in text else [text]
    if p["lines"] == "auto" and ctx.tall and len(lines) == 1 and "-" in text and len(text) > 8:
        a, b = text.split("-", 1)
        lines = [a + "-", b]
    face, side = _materials(p["style"], p["accent"])
    T = TT.build(coll("title"), lines, p["font"], p["weight"], p["size"], p["extrude"], p["bevel"], face_mat=face,
                 side_mat=side, cache=ctx.cache)
    x0, x1, z0, z1 = T["bounds"]
    lift = 0.012 - z0
    for lt in T["letters"]:
        lt["rest"].z += lift
        lt["pivot"].location = lt["rest"]
    zc = (z1 - z0) / 2 + 0.012
    # studio: reflection-only dome (chrome needs edges to draw), black sweep with a polished floor, rims, back-glow
    # the chrome faces look back at the camera: a broad gradient card behind it (el ~10 deg) makes them read bright,
    # the overhead strip draws the top bevels, two tall side strips the verticals, an accent card the violet glints
    boxes = [(0.0, 9.0, 70.0, 9.0, 2.6, (1.0, 0.98, 0.95)), (0.0, -7.0, 75.0, 7.0, 2.2, (1.0, 0.98, 0.96)), (0.0, 40.0, 40.0, 7.0, 5.0, (1.0, 0.97, 0.93)),
             (-70.0, 14.0, 6.0, 30.0, 4.0, (0.95, 0.97, 1.0)), (72.0, 12.0, 5.0, 26.0, 3.0, tuple(p["accent"])),
             (180.0, 30.0, 40.0, 5.0, 2.0, (0.9, 0.93, 1.0))]
    if len(lines) > 1:      # stacked lines see a taller band of the dome: cover it, so every line reads equally bright
        boxes[0] = (0.0, 7.0, 70.0, 15.0, 2.6, (1.0, 0.98, 0.95))
        boxes[1] = (0.0, -10.0, 75.0, 11.0, 2.2, (1.0, 0.98, 0.96))
    ST.world_reflection(boxes, camera_color=(0.0012, 0.0012, 0.0016))
    fm = MT.floor_polished("floor", half=((x1 - x0) / 2 + 0.1, 0.3), falloff=0.3, spec=0.32)   # wide: no line on an empty floor
    floor = ST.cyclorama(coll("set"), mat=fm)
    col = coll("lights")
    obs = [lt["ob"] for lt in T["letters"]]
    key = ST.feathered_strip("key", col, 3.0, (-1.2, -0.9, 1.6), (0, 0, zc), 120.0)
    rimL = ST.area("rim_l", col, (0.06, 1.2), (-1.4, 0.9, 0.6), (0, 0, zc), 40.0, p["accent"], 80)
    rimR = ST.area("rim_r", col, (0.06, 1.2), (1.4, 0.9, 0.6), (0, 0, zc), 40.0, p["accent"], 80)
    top = ST.area("top", col, (2.0, 0.3), (0, 0.4, 1.4), (0, 0, zc), 30.0, (0.9, 0.93, 1.0), 100)
    ST.link_to(key + [rimL, rimR, top], obs, "title_recv")
    glow = None
    if p["glow"] > 0:          # a soft violet halo card far behind the letters (gaussian in z, feathered in x), keyed in
        gm, strength = MT.pure_emission("title_backglow", p["accent"], 0.0)
        span = (x1 - x0) * 1.15
        sep = MT.nd(gm, "ShaderNodeSeparateXYZ")
        MT.ln(gm, MT.coord(gm), sep.inputs[0])
        qz = MT.math_(gm, "DIVIDE", sep.outputs[2], 0.07 * (1.0 + 1.1 * (len(lines) - 1)))
        gz = MT.math_(gm, "EXPONENT", MT.math_(gm, "MULTIPLY", MT.math_(gm, "MULTIPLY", qz, qz), -1.0))
        qx = MT.math_(gm, "DIVIDE", sep.outputs[0], span / 2)
        gx = MT.math_(gm, "EXPONENT", MT.math_(gm, "MULTIPLY", MT.math_(gm, "POWER", MT.math_(gm, "DIVIDE", MT.math_(gm, "ABSOLUTE", qx), 0.62), 4.0), -1.0))
        lvl = MT.value(gm, "glow_level", 0.0)
        MT.ln(gm, MT.math_(gm, "MULTIPLY", MT.math_(gm, "MULTIPLY", gz, gx), lvl.outputs[0]), strength)
        gh = 0.6 * len(lines)
        glow = obj_from("backglow", [(-span / 2, 0, -gh / 2), (span / 2, 0, -gh / 2), (span / 2, 0, gh / 2), (-span / 2, 0, gh / 2)],
                        [(0, 1, 2, 3)], coll("set"), [gm])
        glow.location = (0, 0.9, zc)
        glow.visible_shadow = False
        for k in ("visible_diffuse", "visible_glossy"):
            setattr(glow, k, False)
        glow = lvl
    sweep = ST.area("sweep", col, (0.08, 2.4), (-2.0, -0.7, 1.0), (0, 0, zc), 0.0, (1.0, 0.98, 0.95), 60)
    sweep.visible_diffuse = False
    sweep.data.diffuse_factor = 0.0
    ST.link_to([sweep], obs, "title_sweep_recv")
    width = x1 - x0
    fill = p["fill"] or (0.86 if ctx.tall else 0.74)
    dist = CM.fit_dist(width / 2, (z1 - z0) / 2, p["lens"], ctx.W, ctx.H, fill)
    cam = CM.make()
    return {"T": T, "cam": cam, "dist": dist, "zc": zc, "sweep": sweep, "gm": glow, "width": width}


def frame(H, ctx, f, K):
    p = ctx.p
    t = C.t_of(ctx, f)
    T = ctx.seconds
    n = len(H["T"]["letters"])
    for i, lt in enumerate(H["T"]["letters"]):
        a = p["in_at"] + i * p["stagger"]
        q = E["hero"](seg(t, a, a + p["flip_dur"]))
        drop = (1.0 - q) * H["T"]["size"] * 0.9
        K.set(lt["pivot"], "location", lt["rest"] + Vector((0, 0.0, -drop)))
        K.set(lt["pivot"], "rotation_euler", (math.radians(-95.0) * (1.0 - q), 0.0, math.radians(8.0) * (1.0 - q) * (1 if i % 2 else -1)))
        K.set(lt["pivot"], "scale", (0.001 + 0.999 * min(1.0, q * 4.0),) * 3)
    k = E["glide"](seg(t, p["sweep_at"], p["sweep_at"] + p["sweep_dur"]))
    x = lerp(-H["width"] * 0.9 - 0.4, H["width"] * 0.9 + 0.4, k)
    pk = math.sin(math.pi * k)
    K.set(H["sweep"], "location", Vector((x, -0.7, 1.0)))
    K.set(H["sweep"].data, "energy", 160.0 * pk)
    if H["gm"] is not None:      # the halo arrives as the last letters land
        last = p["in_at"] + (n - 1) * p["stagger"] + p["flip_dur"] * 0.6
        K.set(H["gm"].outputs[0], "default_value", 1.5 * p["glow"] * E["soft"](seg(t, last - 0.5, last + 0.4)))
    u = seg(t, 0.0, T)
    az = lerp(p["az"], p["az_end"], E["sine"](u))
    s = CM.state(target=(0, 0, H["zc"]), az=az, el=p["el"], dist=H["dist"] * lerp(1.06, 1.0, E["cam"](u)), lens=p["lens"],
                 fstop=p["fstop"])
    s["focus"] = Vector((0, -0.04, H["zc"]))
    CM.apply(H["cam"], s, K)
