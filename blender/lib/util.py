# motion-pack/blender: scene helpers shared by every recipe: collections, procedural mesh builders (prism, rounded and
# chamfered outlines, cylinders, curves), weighted bevels, the per-frame Keyer, and small file utilities. Geometry
# builders follow ANVE's launch-film pipeline, generalised to metres. MIT (see blender/LICENSE).
import math
import os
import json
import hashlib

import bpy
import bmesh
from mathutils import Vector


# ------------------------------------------------------------------------------------------------ collections, objects
def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def empty(name, col, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    col.objects.link(e)
    e.empty_display_size = 0.05
    if parent is not None:
        e.parent = parent
    e.location = loc
    return e


def obj_from(name, verts, faces, col, mats=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    for m in mats or []:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return ob


# ------------------------------------------------------------------------------------------------ 2D outlines (CCW)
def area2(pts):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))


def octo(w, d, c):
    """Chamfered rectangle: corner legs c."""
    x, y = w / 2, d / 2
    return [(-x + c, -y), (x - c, -y), (x, -y + c), (x, y - c), (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c)]


def rrect(w, d, r, seg=6):
    """Rounded rectangle, corner radius r (seg + 1 points per corner)."""
    r = max(1e-5, min(r, w / 2 - 1e-5, d / 2 - 1e-5))
    x, y = w / 2 - r, d / 2 - r
    pts = []
    for cx, cy, a0 in ((x, -y, -90), (x, y, 0), (-x, y, 90), (-x, -y, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def outline(kind, w, d, c, seg=8):
    return octo(w, d, c) if kind == "chamfer" else rrect(w, d, c, seg)


def inset_corner(kind, c, t):
    """Corner size of an outline inset by t (a chamfer leg shrinks by (sqrt2 - 1) t, a radius by t)."""
    return max(0.0008, c - 0.586 * t) if kind == "chamfer" else max(0.0008, c - t)


# ------------------------------------------------------------------------------------------------ solids
def prism(name, pts, z0, h, col, mats=None, cap_top=None, cap_bot=None):
    """Extrude a closed 2D polygon (x, y) from z0 to z0 + h. cap_top / cap_bot: material index for the caps."""
    pts = list(pts)
    if area2(pts) < 0:
        pts = pts[::-1]
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z0 + h) for x, y in pts]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = obj_from(name, verts, faces, col, mats)
    if cap_top is not None:
        ob.data.polygons[1].material_index = cap_top
    if cap_bot is not None:
        ob.data.polygons[0].material_index = cap_bot
    return ob


def box(name, size, loc, col, mat, bev=0.0, rot=None):
    sx, sy, sz = (s / 2 for s in size)
    ob = prism(name, [(-sx, -sy), (sx, -sy), (sx, sy), (-sx, sy)], -sz, 2 * sz, col, [mat])
    if bev > 0:
        bevel(ob, bev, 2, 30)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    return ob


def cyl(name, r, h, loc, col, mat, n=32, bev=0.0, rot=None, r2=None):
    """Cylinder along local Z, centred on loc (r2: top radius for a taper)."""
    r2 = r if r2 is None else r2
    verts = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), -h / 2) for i in range(n)]
    verts += [(r2 * math.cos(2 * math.pi * i / n), r2 * math.sin(2 * math.pi * i / n), h / 2) for i in range(n)]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = obj_from(name, verts, faces, col, [mat], smooth=True)
    if bev > 0:
        bevel(ob, bev, 2, 40)
    else:
        ob.data.polygons[0].use_smooth = False
        ob.data.polygons[1].use_smooth = False
        sm = ob.modifiers.new("sharp", "EDGE_SPLIT")
        sm.split_angle = math.radians(40)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    return ob


def curve_obj(name, pts, col, mat, radius, res=4, parent=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.resolution_u = 24
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    cu.materials.append(mat)
    if parent is not None:
        ob.parent = parent
    return ob


# ------------------------------------------------------------------------------------------------ bevels
def bevel(ob, w, seg=3, angle=30.0, harden=True, profile=0.5):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = w
    m.segments = seg
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.use_clamp_overlap = True
    m.profile = profile
    m.harden_normals = harden
    for p in ob.data.polygons:
        p.use_smooth = True
    return m


def weighted_bevel(ob, width, segs, weights, part_x=None, angle=30.0):
    """Edge-class bevel: every sharp edge gets a weight by class: 'top' (both verts on the top
    plane), 'bot', 'vert' (a vertical edge), 'part' (the parting line at |x| = part_x). Width x weight = the round."""
    me = ob.data
    zs = [v.co.z for v in me.vertices]
    z0, z1 = min(zs), max(zs)
    att = me.attributes.get("bevel_weight_edge") or me.attributes.new("bevel_weight_edge", "FLOAT", "EDGE")
    bm = bmesh.new()
    bm.from_mesh(me)
    vals = []
    lim = math.radians(angle)
    for e in bm.edges:
        v = 0.0
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim:
            a, b = e.verts[0].co, e.verts[1].co
            if part_x is not None and abs(abs(a.x) - part_x) < 1e-5 and abs(abs(b.x) - part_x) < 1e-5:
                v = weights.get("part", 0.0)
            elif abs(a.z - b.z) > 1e-6:
                v = weights.get("vert", 0.0)
            elif abs(a.z - z1) < 1e-6:
                v = weights.get("top", 0.0)
            elif abs(a.z - z0) < 1e-6:
                v = weights.get("bot", 0.0)
        vals.append(v)
    bm.free()
    att.data.foreach_set("value", vals)
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segs
    m.limit_method = "WEIGHT"
    m.profile = 0.5
    m.use_clamp_overlap = True
    m.harden_normals = True
    for p in me.polygons:
        p.use_smooth = True
    return m


# ------------------------------------------------------------------------------------------------ the per-frame keyer
class Keyer:
    """Everything that moves is a pure function of the frame: a recipe's frame(H, f) sets values through K.set, and
    flush(f) keyframes every touched property (LINEAR keys at whole frames; motion blur samples between them)."""

    def __init__(self):
        self.items = {}

    def set(self, owner, prop, value):
        if prop.startswith('["'):
            owner[prop[2:-2]] = value
        else:
            setattr(owner, prop, value)
        self.items[(owner.as_pointer(), prop)] = (owner, prop)
        return value

    def flush(self, f):
        for owner, prop in self.items.values():
            owner.keyframe_insert(prop, frame=f)


def all_fcurves(idb):
    """F-curves of an ID's action (Blender 5 layered actions: layers -> strips -> channelbags)."""
    ad = getattr(idb, "animation_data", None)
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for lay in act.layers:
        for st in lay.strips:
            for cb in st.channelbags:
                out += list(cb.fcurves)
    return out


def set_interpolation(ids, kind="LINEAR"):
    for idb in ids:
        for fc in all_fcurves(idb):
            for kp in fc.keyframe_points:
                kp.interpolation = kind


# ------------------------------------------------------------------------------------------------ files
def sha256_file(path, n=16):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:n]


def write_json(path, obj):
    tmp = path + ".part"
    with open(tmp, "w") as fh:
        json.dump(obj, fh, indent=1, sort_keys=False)
    os.replace(tmp, path)


def srgb_to_lin(c):
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)


def hex_lin(h):
    h = h.lstrip("#")
    return srgb_to_lin(tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)))
