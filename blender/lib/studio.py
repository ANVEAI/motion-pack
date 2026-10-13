# motion-pack/blender: the studio. A cyclorama sweep (floor -> cove -> wall, no horizon line), worlds (near-black, or a
# procedural reflection dome that the camera never sees, for chrome), and photographer lighting: feathered strip
# softboxes, a floor-only pool, a high rim, an accent rim, a dim fill. Positions, sizes and energies are the launch
# film's calibrated hero rig for a ~0.3 m product; `scale` re-sizes the rig for other subjects.
# The strips are light-linked to the product, so the polished floor never mirrors them as a grey sheet.
# MIT (see blender/LICENSE).
import math

import bpy
from mathutils import Vector, Matrix

from . import materials as MT
from .util import obj_from


# ------------------------------------------------------------------------------------------------ the sweep
def cyclorama(col, width=12.0, front=-8.0, wall=4.0, radius=1.6, height=4.0, mat=None, seg=24):
    """Floor (z = 0) from y = front to the cove, a quarter-circle cove of `radius`, then a wall at y = wall."""
    prof = [(front, 0.0), (wall - radius, 0.0)]
    for i in range(1, seg + 1):
        a = 0.5 * math.pi * i / seg
        prof.append((wall - radius + radius * math.sin(a), radius - radius * math.cos(a)))
    prof.append((wall, height))
    xs = (-width / 2, width / 2)
    verts = [(x, y, z) for (y, z) in prof for x in xs]
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(prof) - 1)]
    ob = obj_from("cyclorama", verts, faces, col, [mat] if mat else None, smooth=True)
    ob.data.polygons[0].use_smooth = False
    return ob


# ------------------------------------------------------------------------------------------------ worlds
def world_dark(color=(0.0016, 0.0017, 0.0019), name="world_dark"):
    w = bpy.data.worlds.new(name)
    bpy.context.scene.world = w
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (*color, 1.0)
    bg.inputs[1].default_value = 1.0
    return w, bg


def world_reflection(boxes=None, camera_color=(0.0016, 0.0017, 0.0019), dome=0.012, horizon=0.04, name="world_refl"):
    """A procedural photo studio seen only in reflections (Light Path 'Is Camera Ray' -> the camera sees
    camera_color): a dim dome, a horizon band and rectangular softboxes. Each box: (az, el, half_w, half_h, energy,
    color) in degrees, az 0 = behind the camera (the product faces -Y), so chrome always has edges to draw.
    Verified in 5.2.2: EEVEE renders the camera-ray branch as background and the other branch in reflections."""
    w = bpy.data.worlds.new(name)
    bpy.context.scene.world = w
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    boxes = boxes if boxes is not None else [
        (0.0, 38.0, 34.0, 7.0, 6.0, (1.0, 0.97, 0.93)),        # the overhead strip, front
        (-70.0, 14.0, 6.0, 30.0, 4.0, (0.95, 0.97, 1.0)),      # a tall strip camera-left
        (75.0, 10.0, 5.0, 26.0, 3.0, (1.0, 0.96, 0.92)),       # a tall strip camera-right
        (180.0, 30.0, 40.0, 5.0, 2.0, (0.9, 0.93, 1.0)),       # a back rim strip
    ]
    d = MT.coord(w, "Generated")
    sep = MT.nd(w, "ShaderNodeSeparateXYZ")
    MT.ln(w, d, sep.inputs[0])
    up = MT.math_(w, "MAXIMUM", sep.outputs[2], 0.0)
    col = MT.mix_rgb(w, MT.math_(w, "POWER", up, 0.6), (horizon, horizon, horizon * 1.05, 1.0), (dome, dome, dome * 1.08, 1.0))
    total = col
    for az, el, hw, hh, en, c in boxes:
        if not (0 < hw < 80 and 0 < hh < 80):      # a gnomonic patch: tan() wraps at 90 deg; split wide boxes
            raise ValueError("world_reflection box half-sizes must be in (0, 80) deg, got %r x %r" % (hw, hh))
        a, e = math.radians(az), math.radians(el)
        cdir = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        right = Vector((0, 0, 1)).cross(cdir).normalized() if abs(cdir.z) < 0.99 else Vector((1, 0, 0))
        upv = cdir.cross(right).normalized()

        def dot(v):
            n = MT.nd(w, "ShaderNodeVectorMath")
            n.operation = "DOT_PRODUCT"
            MT.ln(w, d, n.inputs[0])
            n.inputs[1].default_value = tuple(v)
            return n.outputs["Value"]
        dc = MT.math_(w, "MAXIMUM", dot(cdir), 1e-3)
        x = MT.math_(w, "ABSOLUTE", MT.math_(w, "DIVIDE", dot(right), dc))
        y = MT.math_(w, "ABSOLUTE", MT.math_(w, "DIVIDE", dot(upv), dc))
        tx, ty = math.tan(math.radians(hw)), math.tan(math.radians(hh))
        mx = MT.maprange(w, x, tx, tx * 0.82, 0.0, 1.0)
        my = MT.maprange(w, y, ty, ty * 0.82, 0.0, 1.0)
        front = MT.maprange(w, dot(cdir), 0.05, 0.15, 0.0, 1.0)
        mask = MT.math_(w, "MULTIPLY", MT.math_(w, "MULTIPLY", mx, my), front)
        add = MT.nd(w, "ShaderNodeMix")
        add.data_type = "RGBA"
        add.blend_type = "ADD"
        MT.ln(w, total, add.inputs[6])
        add.inputs[7].default_value = (c[0] * en, c[1] * en, c[2] * en, 1.0)
        MT.ln(w, mask, add.inputs[0])
        total = add.outputs[2]
    lp = MT.nd(w, "ShaderNodeLightPath")
    final = MT.mix_rgb(w, lp.outputs["Is Camera Ray"], (0, 0, 0, 1), (*camera_color, 1.0))
    # mix_rgb's A input is a constant: wire the studio colour into it
    MT.ln(w, total, final.node.inputs[6])
    MT.ln(w, final, bg.inputs["Color"])
    bg.inputs[1].default_value = 1.0
    return w, bg


# ------------------------------------------------------------------------------------------------ lights
def area(name, col, size, loc, aim, energy, color=(1, 1, 1), spread=120.0, camera=False):
    L = bpy.data.lights.new(name, "AREA")
    L.shape = "RECTANGLE"
    L.size, L.size_y = size
    L.energy = energy
    L.color = color
    L.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, L)
    col.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = camera
    return ob


def place_strip(ob, loc, aim, axis=(0.0, 1.0, 0.0)):
    """The light's long side (local X) along `axis`, projected square to the beam; the beam (-Z) toward aim."""
    z = (Vector(loc) - Vector(aim)).normalized()
    ax = Vector(axis)
    x = (ax - z * ax.dot(z)).normalized()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(loc)
    return m


FEATHER = ((0.10, 0.44), (0.22, 0.34), (0.35, 0.22))   # (width m, energy share): a feathered 2.4 x 0.35 m strip


def feathered_strip(name, col, length, loc, aim, energy, color=(1.0, 0.975, 0.945), spread=110.0, axis=(0, 1, 0)):
    obs = []
    m = place_strip(None, loc, aim, axis)
    for i, (wd, share) in enumerate(FEATHER):
        ob = area("%s%d" % (name, i), col, (length, wd), loc, aim, energy * share, color, spread)
        ob.matrix_world = m
        obs.append(ob)
    return obs


def link_to(lights, objects, name):
    """Light-link `lights` so they illuminate only `objects` (a receiver collection outside the scene tree)."""
    rc = bpy.data.collections.new(name)
    for ob in objects:
        rc.objects.link(ob)
    for L in lights:
        L.light_linking.receiver_collection = rc
    return rc


def product_rig(col, product_objects, floor=None, scale=1.0, key_x=-0.42, key_y=-0.62, key_z=0.95, key_w=70.0,
                rim_w=18.0, accent=MT.VIOLET_AGX, accent_w=0.9, fill_w=1.6, pool_w=30.0, side=1):
    """The calibrated hero rig: one feathered 2.4 x 0.35 m strip high camera-left whose long axis runs front-to-back
    (its mirror image is a short bright band on the top chamfer), a thin high rim behind, an accent rim camera-right
    behind (violet by default), a dim specular-free fill, and a floor-only pool under the key. side=-1 mirrors it."""
    k = scale
    s = side
    R = {}
    loc = Vector((s * key_x * k, key_y * k, key_z * k))
    aim = Vector((s * 0.45 * key_x * k, 0.0, 0.08 * k))
    R["key"] = feathered_strip("key", col, 2.4 * k, loc, aim, key_w * k * k)
    R["rim"] = area("rim", col, (1.1 * k, 0.05 * k), (s * 0.1 * k, 0.85 * k, 1.05 * k), (0, 0, 0.16 * k), rim_w * k * k,
                    (0.88, 0.93, 1.0), 90)
    R["accent"] = area("accent", col, (0.04 * k, 0.6 * k), (s * 0.172 * k, 0.6 * k, 0.2 * k), (s * 0.11 * k, 0, 0.11 * k),
                       accent_w * k * k, accent, 70)
    R["fill"] = area("fill", col, (1.4 * k, 0.9 * k), (s * 0.6 * k, -2.1 * k, 0.45 * k), (0, 0, 0.1 * k), fill_w * k * k,
                     (0.95, 0.97, 1.0), 150)
    R["fill"].data.specular_factor = 0.0
    link_to(R["key"] + [R["rim"], R["accent"]], product_objects, "rig_product_recv")
    if floor is not None:
        R["pool"] = area("pool", col, (1.3 * k, 0.9 * k), (loc.x, loc.y, loc.z), (loc.x, loc.y, 0.0), pool_w * k * k,
                         (1.0, 0.975, 0.945), 120)
        R["pool"].data.specular_factor = 0.0
        link_to([R["pool"]], [floor], "rig_floor_recv")
    R["E0"] = {ob.name: ob.data.energy for v in R.values() if not isinstance(v, dict)
               for ob in (v if isinstance(v, list) else [v])}
    return R


def move_key(R, K, loc, aim):
    """Travel the feathered key (and its floor pool) through the Keyer: the specular line sweeps the chamfers."""
    m = place_strip(None, loc, aim)
    eul = m.to_euler("XYZ")
    for ob in R["key"]:
        K.set(ob, "location", m.translation.copy())
        K.set(ob, "rotation_euler", eul)
    if "pool" in R:
        K.set(R["pool"], "location", Vector(loc))
