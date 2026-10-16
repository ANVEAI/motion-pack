# motion-pack/blender: YOUR OWN product model in the photo-studio recipes (xp-hardware, 2026-10-16).
#   load(path, col, size=0.25, axis="w", yaw=0.0) -> D: the same handles the procedural device gives the recipes
#   (root, meshes, w, d, h, parts, corner_size, z_band_c, model=True), so blender/turntable, blender/macroSweep and blender/explode
#   take `--param model=/abs/device.glb` (or .gltf / .obj) instead of the generated device.
# The model is imported with Blender's own importers (glTF 2.0, OBJ), centred on its footprint, stood on z = 0 and scaled so its width (axis "w"),
# height ("h") or largest side ("max") is `size` metres. Its top-level objects become explode parts: each one moves away from the model centre
# along the line through its own centre (the cascade order = height, top first), the same move vocabulary as the procedural explode
# (lib/device.py): out on the cascade, held, mirrored back in. A model with one object explodes as one part (it lifts).
# Materials are kept as authored. Deterministic: a pure function of the file and the parameters. MIT (see blender/LICENSE).
import math
import os

import bpy
from mathutils import Vector, Matrix

from .ease import E, seg
from .util import empty


def _import(path):
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit("model: %s is not a .glb, .gltf or .obj" % path)
    return [o for o in bpy.data.objects if o not in before]


def _bbox(objs):
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def load(path, col, size=0.25, axis="w", yaw=0.0):
    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise SystemExit("model: file not found: %s" % path)
    new = _import(path)
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
    bpy.context.view_layer.update()
    tops = [o for o in new if o.parent is None]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        raise SystemExit("model: %s has no mesh" % path)
    lo, hi = _bbox(meshes)
    dim = hi - lo
    ref = {"h": dim.z, "max": max(dim)}.get(axis, dim.x)
    k = size / max(ref, 1e-9)
    # one world transform for the whole import: centre the footprint, stand it on z = 0, scale, yaw (applied to every top-level object)
    T = Matrix.Rotation(yaw, 4, "Z") @ Matrix.Diagonal((k, k, k, 1.0)) @ Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for o in tops:
        o.matrix_world = T @ o.matrix_world
    bpy.context.view_layer.update()
    lo, hi = _bbox(meshes)
    dim = hi - lo
    centre = (lo + hi) / 2
    root = empty("model_root", col)
    parts, dirs = {}, {}
    sub_of = lambda o: [m for m in [o] + list(o.children_recursive) if m.type == "MESH"]
    ordered = sorted([o for o in tops if sub_of(o)], key=lambda o: -_bbox(sub_of(o))[1].z)   # the cascade: the highest part leaves first
    for i, o in enumerate(ordered[:32]):
        a, b = _bbox(sub_of(o))
        d = (a + b) / 2 - centre
        if d.length < 1e-6 or len(ordered) == 1:
            d = Vector((0, 0, 1))
        d.normalize()
        d = Vector((d.x, d.y, d.z * 1.3 + 0.15)).normalized()
        holder = empty("model_part_%02d" % i, col, root)      # identity holder: the part's world transform is kept as its local one
        mw = o.matrix_world.copy()
        o.parent = holder
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_basis = mw
        parts["p%02d" % i] = holder
        dirs["p%02d" % i] = (d, i)
    for o in tops:
        if o not in ordered:
            mw = o.matrix_world.copy(); o.parent = root; o.matrix_parent_inverse = Matrix.Identity(4); o.matrix_basis = mw
    bpy.context.view_layer.update()
    return {"root": root, "meshes": meshes, "w": dim.x, "d": dim.y, "h": dim.z, "parts": parts, "dirs": dirs, "model": True, "scale": k,
            "corner_size": 0.08 * min(dim.x, dim.y), "z_band_c": dim.z * 0.12, "blades": None, "path": path}


def explode(D, K, t, t_open, t_seal=None, spread=1.0, breathe=0.0, speed=1.0, dist=None):
    """The procedural explode's vocabulary for any model: part i leaves at t_open + 0.08 i / speed on a 0.85 s E.move, offset along its direction by
    `dist` (default 0.45 x the model's largest side) x spread; the reassembly mirrors it about (open + seal) / 2 (first out seats last)."""
    big = max(D["w"], D["d"], D["h"])
    L = (dist if dist else 0.45 * big) * spread * (1 + 0.035 * breathe)
    for name, h in D["parts"].items():
        d, i = D["dirs"][name]
        s, du = 0.08 * i / speed, 0.85 / speed
        rr = t if (t_seal is None or t <= (t_open + t_seal) / 2) else t_open + t_seal - t
        q = E["move"](seg(rr, t_open + s, t_open + s + du))
        K.set(h, "location", tuple(d * (L * q)))
    return D
