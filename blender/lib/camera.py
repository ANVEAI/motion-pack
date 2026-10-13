# motion-pack/blender: camera rig and move presets, mirroring motion-pack camera/cam3d.js (orbit, pushIn, crane,
# dollyZoom, whipPan, truck, rackFocus) so a move reads the same in the three.js kit and in Blender. A camera STATE is a
# plain dict; every move is a pure function (state, u in 0..1, params) -> state; apply() writes it to a Blender camera
# through the Keyer. Conventions: z up, the product faces -Y; az 0 = dead front, + az swings camera-right; el in degrees
# above the horizon; lens in mm on a 24 mm VERTICAL sensor (so lens fixes the vertical FOV in every aspect).
# MIT (see blender/LICENSE).
import math

import bpy
from mathutils import Vector, Quaternion

from .ease import ease, lerp, seg, E

SENSOR_H = 24.0


def state(target=(0.0, 0.0, 0.1), az=20.0, el=6.0, dist=2.6, lens=100.0, shift=(0.0, 0.0), roll=0.0, focus=None,
          fstop=2.8):
    return {"target": Vector(target), "az": az, "el": el, "dist": dist, "lens": lens, "shift": tuple(shift),
            "roll": roll, "focus": focus, "fstop": fstop}


def clone(s):
    o = dict(s)
    o["target"] = Vector(s["target"])
    if isinstance(s.get("focus"), Vector):
        o["focus"] = Vector(s["focus"])
    return o


def dirv(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


def position(s):
    return s["target"] + dirv(s["az"], s["el"]) * s["dist"]


def fit_dist(half_w, half_h, lens, W, H, fill=0.5):
    """Distance at which a subject of half extents (half_w across, half_h up) fills `fill` of the limiting frame
    dimension: the same recipe re-lays out for 16:9, 9:16 and 1:1 instead of cropping."""
    tv = (SENSOR_H / 2.0) / lens
    th = tv * W / float(H)
    return max(half_w / (th * fill), half_h / (tv * fill))


# ------------------------------------------------------------------------------------------------ moves (cam3d names)
def orbit(s, u, deg=40.0, e="sine", parallax=0.005):
    o = clone(s)
    k = ease(e)(u)
    o["az"] += deg * k
    o["dist"] *= 1.0 + parallax * math.sin(math.pi * k)
    return o


def turntable(s, u, deg=360.0):
    """Constant angular speed (linear): seamless over u 0 -> 1 when deg is a multiple of 360."""
    o = clone(s)
    o["az"] += deg * u
    return o


def push_in(s, u, ratio=0.88, e="hero"):
    o = clone(s)
    o["dist"] *= lerp(1.0, ratio, ease(e)(u))
    return o


def crane(s, u, el_to=24.0, dist_mul=1.1, e="move"):
    o = clone(s)
    k = ease(e)(u)
    o["el"] = lerp(s["el"], el_to, k)
    o["dist"] *= lerp(1.0, dist_mul, k)
    return o


def truck(s, u, delta=(0.06, 0.0, 0.0), e="cam"):
    o = clone(s)
    o["target"] = s["target"] + Vector(delta) * ease(e)(u)
    return o


def macro_slide(s, u, delta=(-0.05, 0.0, 0.0), focus_delta=None, e="glide"):
    """A slow macro slide along a surface: the target travels `delta` metres; the focus point rides with it (or
    travels its own focus_delta, a built-in rack)."""
    o = truck(s, u, delta, e)
    if isinstance(s.get("focus"), Vector):
        o["focus"] = s["focus"] + Vector(focus_delta if focus_delta is not None else delta) * ease(e)(u)
    return o


def dolly_zoom(s, u, lens_to=28.0, e="sine"):
    """Vertigo: the lens changes and the camera moves so the subject keeps its size (size ~ lens / dist)."""
    o = clone(s)
    l0, d0 = s["lens"], s["dist"]
    o["lens"] = lerp(l0, lens_to, ease(e)(u))
    o["dist"] = d0 * o["lens"] / l0
    return o


def whip(s, u, deg=70.0, mode="out", roll_deg=2.0):
    """7-frame quint whip (cam3d.whipPan): 'out' leaves the shot (0 -> deg), 'in' arrives (-deg -> 0). Cut on u 0.5."""
    o = clone(s)
    k = E["quint"](u)
    o["az"] += deg * k if mode == "out" else -deg * (1.0 - k)
    o["roll"] += roll_deg * math.sin(math.pi * u) * (1 if deg >= 0 else -1)
    return o


def rack(s, u, focus_a, focus_b, e="move"):
    o = clone(s)
    o["focus"] = Vector(focus_a).lerp(Vector(focus_b), ease(e)(u))
    return o


def breathe(s, t, amp=0.006, period=4.0):
    o = clone(s)
    o["dist"] *= 1.0 - amp * 0.5 * (1.0 - math.cos(2.0 * math.pi * t / period))
    return o


MOVES = {"orbit": orbit, "turntable": turntable, "pushIn": push_in, "crane": crane, "truck": truck,
         "macroSlide": macro_slide, "dollyZoom": dolly_zoom, "whip": whip, "rack": rack}


def window(t, at, dur):
    return seg(t, at, at + dur)


# ------------------------------------------------------------------------------------------------ the Blender camera
def make(name="cam", clip=(0.01, 400.0), blades=9):
    cd = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(cam)
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = SENSOR_H
    cd.clip_start, cd.clip_end = clip
    cd.dof.use_dof = True
    cd.dof.aperture_blades = blades
    cd.dof.aperture_rotation = math.radians(12)
    cam.rotation_mode = "XYZ"
    bpy.context.scene.camera = cam
    return {"ob": cam, "prev": None}


def apply(C, s, K):
    """Write a state to the camera through the Keyer (location, rotation with euler continuity, lens, shift, DOF)."""
    cam, cd = C["ob"], C["ob"].data
    pos = position(s)
    fwd = (s["target"] - pos).normalized()
    q = fwd.to_track_quat("-Z", "Y")
    if s.get("roll"):
        q = q @ Quaternion((0.0, 0.0, 1.0), math.radians(s["roll"]))
    eul = q.to_euler("XYZ", C["prev"]) if C["prev"] is not None else q.to_euler("XYZ")
    C["prev"] = eul.copy()
    K.set(cam, "location", pos)
    K.set(cam, "rotation_euler", eul)
    K.set(cd, "lens", s["lens"])
    K.set(cd, "shift_x", s["shift"][0])
    K.set(cd, "shift_y", s["shift"][1])
    f = s.get("focus")
    fd = (f - pos).dot(fwd) if isinstance(f, Vector) else (f if f else (s["target"] - pos).length)
    K.set(cd.dof, "focus_distance", max(0.02, fd))
    K.set(cd.dof, "aperture_fstop", s.get("fstop") or 128.0)
    return pos
