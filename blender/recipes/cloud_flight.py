# blender/cloudFlight: the hero object in the world. A sunset cloud sea (displaced cloud tops), volumetric haze that
# glows round a low sun, a sun disc + halo in the sky shader, an additive anamorphic streak facing the camera, and a
# chase camera that tracks the hero while it flies, banks and bobs. Hero: the kit flyer (lib/kit.py) with a spinning
# propeller. Everything is keyed per frame from t (no simulation). MIT (see blender/LICENSE).
import math

from mathutils import Euler, Matrix, Vector

from lib import camera as CM, env as EN, kit as KT, materials as MT
from lib.ease import E, TAU, seg
from lib.util import coll

from . import _common as C

ID = "blender/cloudFlight"
NAME = "Cloud-sea flight"
DOC = "Sunset cloud sea, volumetric haze, sun flare and a chase camera tracking the hero as it flies, banks and bobs."
USE = "The 'product used in the world' climax; a hero-in-context plate behind a title; the payoff after a teardown."
AVOID = "Real aircraft, liveries or markings; claiming a render is footage; very long holds (the cloud sea is one tile)."
LOOP = False
DEFAULTS = dict(seconds=6.0, size=(1920, 1080), engine="eevee", motion_blur=True)
PARAMS = {
    "speed": {"type": "float", "default": 2.4, "doc": "flight speed (m/s; the hero spans 0.66 m)"},
    "altitude": {"type": "float", "default": 1.7, "doc": "hero height above the cloud datum (m)"},
    "bank": {"type": "float", "default": 14.0, "doc": "peak bank angle (deg)"},
    "bob": {"type": "float", "default": 0.05, "doc": "vertical bob (m)"},
    "prop_rps": {"type": "float", "default": 7.3, "doc": "propeller turns per second (motion blur reads the rest)"},
    "az": {"type": "float", "default": 205.0, "doc": "chase azimuth around the hero at the start (deg; 180 = dead behind)"},
    "az_end": {"type": "float", "default": 150.0, "doc": "chase azimuth at the end (deg)"},
    "el": {"type": "float", "default": 9.0, "doc": "chase elevation (deg)"},
    "dist": {"type": "float", "default": 0.0, "doc": "chase distance (m; 0 = fit the hero to ~0.42 of the frame)"},
    "push": {"type": "float", "default": 0.82, "doc": "distance at the end / at the start (a slow push in)"},
    "lens": {"type": "float", "default": 40.0, "doc": "mm"},
    "fstop": {"type": "float", "default": 4.0, "doc": "aperture"},
    "sun_el": {"type": "float", "default": 5.0, "doc": "sun elevation (deg)"},
    "sun_az": {"type": "float", "default": 12.0, "doc": "sun azimuth (deg; 0 = ahead of the hero)"},
    "haze": {"type": "float", "default": 0.005, "doc": "haze density (per m)"},
    "clouds": {"type": "float", "default": 2.2, "doc": "cloud billow height (m)"},
    "flare": {"type": "float", "default": 5.0, "doc": "streak strength (0 = off)"},
    "body": {"type": "color", "default": (0.62, 0.57, 0.48), "doc": "hero body colour (linear)"},
    "accent": {"type": "color", "default": MT.VIOLET_AGX, "doc": "hero accent colour (linear)"},
}

SUN_COL = (1.0, 0.56, 0.28)


def build(ctx):
    p = ctx.p
    sun_dir = EN.dirv(p["sun_az"], p["sun_el"])
    EN.sky_world(ground=(0.20, 0.10, 0.07), horizon=(1.0, 0.42, 0.16), mid=(0.42, 0.22, 0.30), zenith=(0.05, 0.06, 0.16),
                 sun_dir=sun_dir, sun_color=SUN_COL, sun_glow=6.0, sun_size=0.99986, halo=1.4, strength=1.0)
    set_ = coll("set")
    travel = p["speed"] * ctx.seconds
    sea = EN.cloud_sea(set_, size=140.0, segments=380, height=p["clouds"], seed=ctx.seed)
    sea.location = (0, -travel / 2 - 10.0, -0.6)
    EN.haze_volume(set_, size=(320.0, 320.0, 60.0), centre=(0, -travel / 2, 6.0), density=p["haze"],
                   color=(1.0, 0.78, 0.6), aniso=0.7)
    import bpy
    EN.eevee_volumes(bpy.context.scene, end=260.0)
    lights = coll("lights")
    EN.sun("sun", lights, sun_dir, 5.0, SUN_COL, 0.6)
    EN.sun("sky_fill", lights, EN.dirv(180.0, 60.0), 0.5, (0.45, 0.52, 0.95), 20.0)
    hero_col = coll("hero")
    M = KT.build(hero_col, lambda n, look: KT.full_material("f_" + n, look, p["body"], p["accent"]))
    hero = bpy.data.objects.new("hero", None)
    hero_col.objects.link(hero)
    hub_pos = Vector(M["info"]["hub"])
    hub = bpy.data.objects.new("prop_hub", None)
    hero_col.objects.link(hub)
    hub.parent = hero
    hub.location = hub_pos
    inv_hub = Matrix.Translation(hub_pos).inverted()
    for q in M["parts"]:
        ob = q["ob"]
        if q["name"].startswith("blade") or q["name"] == "spinner":
            ob.parent = hub
            ob.matrix_parent_inverse = inv_hub
        else:
            ob.parent = hero
    card = EN.flare_card(set_, SUN_COL, strength=p["flare"]) if p["flare"] > 0 else None
    span = M["info"]["span"]
    dist = p["dist"] or CM.fit_dist(span / 2, 0.14, p["lens"], ctx.W, ctx.H, 0.62 if ctx.tall else 0.42)
    ctx.report["travel_m"] = round(travel, 2)
    ctx.report["sun_dir"] = [round(x, 4) for x in sun_dir]
    return {"hero": hero, "hub": hub, "cam": CM.make(clip=(0.02, 600.0)), "card": card, "dist": dist, "sun_dir": sun_dir}


def frame(H, ctx, f, K):
    p = ctx.p
    t = C.t_of(ctx, f)
    T = ctx.seconds
    pos = Vector((0.06 * math.sin(TAU * t / (T * 1.5)), -p["speed"] * t, p["altitude"] + p["bob"] * math.sin(TAU * t / 2.3)))
    roll = p["bank"] * math.sin(TAU * (t / (T * 1.2)) + 0.4)
    pitch = 2.0 * math.sin(TAU * t / 2.3 + 1.2)
    K.set(H["hero"], "location", pos)
    K.set(H["hero"], "rotation_euler", Euler((math.radians(pitch), math.radians(roll), math.radians(-0.4 * roll)), "XYZ"))
    K.set(H["hub"], "rotation_euler", Euler((0.0, TAU * p["prop_rps"] * t, 0.0), "XYZ"))
    u = seg(t, 0.0, T)
    az = p["az"] + (p["az_end"] - p["az"]) * E["sine"](u)
    d = H["dist"] * (1.0 + (p["push"] - 1.0) * E["soft"](u))
    tgt = pos + Vector((0.0, -0.08, 0.0))
    s = CM.state(target=tgt, az=az, el=p["el"], dist=d, lens=p["lens"], fstop=p["fstop"],
                 roll=-0.25 * roll)
    s["focus"] = Vector(pos)
    cam_pos = CM.apply(H["cam"], s, K)
    if H["card"] is not None:
        EN.face_card(K, H["card"], cam_pos, H["sun_dir"])
