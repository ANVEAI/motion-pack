# motion-pack/blender: outdoor and stylised environments for the round-3 recipes (procedural only, no images):
#   sky_world     gradient sky (ground / horizon / mid / zenith) + a sun glow + optional Voronoi stars, all in the world
#                 shader, so the light, the background and every reflection agree
#   haze_volume   a large box of Principled Volume: aerial perspective, forward scattering round a low sun
#   cloud_sea     a displaced grid of cloud tops (two seeded Blender noise textures), shaded soft and bright
#   flare_card    an additive anamorphic streak card that faces the camera from the sun's direction (keyed per frame)
#   sun           a SUN lamp aimed from a direction (az, el in the camera.py convention)
#   lowpoly       faceted primitives: jittered icospheres, n-gon cones and frusta, flat shaded (the diorama look)
# MIT (see blender/LICENSE).
import math
import random

import bmesh
import bpy
from mathutils import Vector

from . import materials as MT
from .util import obj_from


def dirv(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


# ------------------------------------------------------------------------------------------------ sky
def sky_world(ground, horizon, mid, zenith, sun_dir=None, sun_color=(1.0, 0.7, 0.4), sun_glow=6.0, sun_size=0.9994,
              halo=1.2, stars=0.0, star_scale=260.0, strength=1.0, name="sky"):
    """A gradient sky. Colours are linear RGB. sun_dir: Vector toward the sun (disc + wide halo). stars > 0 adds a
    Voronoi star field above the horizon (strength in emission units). Returns (world, background node)."""
    w = bpy.data.worlds.new(name)
    bpy.context.scene.world = w
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    d = MT.coord(w, "Generated")
    sep = MT.nd(w, "ShaderNodeSeparateXYZ")
    MT.ln(w, d, sep.inputs[0])
    ramp = MT.nd(w, "ShaderNodeValToRGB")
    MT.ln(w, MT.maprange(w, sep.outputs[2], -1.0, 1.0, 0.0, 1.0), ramp.inputs["Fac"])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.40, (*ground, 1.0)
    els[1].position, els[1].color = 0.5, (*horizon, 1.0)
    for pos, c in ((0.50 + 0.001, horizon), (0.58, mid), (1.0, zenith)):
        e = els.new(pos)
        e.color = (*c, 1.0)
    ramp.color_ramp.interpolation = "EASE"
    col = ramp.outputs["Color"]
    if sun_dir is not None:
        dot = MT.nd(w, "ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        MT.ln(w, d, dot.inputs[0])
        dot.inputs[1].default_value = tuple(Vector(sun_dir).normalized())
        cos = dot.outputs["Value"]
        disc = MT.maprange(w, cos, sun_size - 0.0004, sun_size, 0.0, 1.0)
        glow = MT.math_(w, "POWER", MT.math_(w, "MAXIMUM", cos, 0.0), 24.0)
        wide = MT.math_(w, "POWER", MT.math_(w, "MAXIMUM", cos, 0.0), 3.0)
        amt = MT.math_(w, "ADD", MT.math_(w, "MULTIPLY", disc, sun_glow * 8.0),
                       MT.math_(w, "ADD", MT.math_(w, "MULTIPLY", glow, sun_glow * 0.35), MT.math_(w, "MULTIPLY", wide, halo * 0.12)))
        add = MT.nd(w, "ShaderNodeMix")
        add.data_type, add.blend_type = "RGBA", "ADD"
        MT.ln(w, col, add.inputs[6])
        add.inputs[7].default_value = (*sun_color, 1.0)
        MT.ln(w, amt, add.inputs[0])
        add.clamp_factor = False
        col = add.outputs[2]
    if stars > 0:
        vor = MT.nd(w, "ShaderNodeTexVoronoi")
        vor.feature = "F1"
        vor.inputs["Scale"].default_value = star_scale
        vor.inputs["Randomness"].default_value = 1.0
        MT.ln(w, d, vor.inputs["Vector"])
        pt = MT.maprange(w, vor.outputs["Distance"], 0.06, 0.02, 0.0, 1.0)
        bright = MT.maprange(w, vor.outputs["Color"], 0.75, 1.0, 0.0, 1.0)      # only a quarter of the cells hold a star
        up = MT.maprange(w, sep.outputs[2], 0.05, 0.25, 0.0, 1.0)
        amt = MT.math_(w, "MULTIPLY", MT.math_(w, "MULTIPLY", pt, bright), MT.math_(w, "MULTIPLY", up, stars))
        add = MT.nd(w, "ShaderNodeMix")
        add.data_type, add.blend_type = "RGBA", "ADD"
        add.clamp_factor = False
        MT.ln(w, col, add.inputs[6])
        add.inputs[7].default_value = (0.9, 0.93, 1.0, 1.0)
        MT.ln(w, amt, add.inputs[0])
        col = add.outputs[2]
    MT.ln(w, col, bg.inputs["Color"])
    bg.inputs[1].default_value = strength
    return w, bg


def sun(name, col, direction, energy, color, angle_deg=1.0):
    L = bpy.data.lights.new(name, "SUN")
    L.energy, L.color, L.angle = energy, color, math.radians(angle_deg)
    ob = bpy.data.objects.new(name, L)
    col.objects.link(ob)
    ob.rotation_euler = (-Vector(direction)).to_track_quat("-Z", "Y").to_euler()
    return ob


def point(name, col, loc, energy, color, radius=0.02):
    L = bpy.data.lights.new(name, "POINT")
    L.energy, L.color, L.shadow_soft_size = energy, color, radius
    ob = bpy.data.objects.new(name, L)
    col.objects.link(ob)
    ob.location = loc
    return ob


# ------------------------------------------------------------------------------------------------ atmosphere
def haze_volume(col, size=(400.0, 400.0, 120.0), centre=(0, 0, 0), density=0.012, color=(1.0, 0.82, 0.7), aniso=0.55,
                name="haze"):
    """A box of Principled Volume (no surface): aerial perspective and a forward-scattering glow round the sun.
    EEVEE: the recipe sets scene.eevee.volumetric_end to cover it."""
    sx, sy, sz = (s / 2 for s in size)
    v = [(x, y, z) for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    ob = obj_from(name, v, f, col)
    ob.location = centre
    m = MT._new_mat(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Color"].default_value = (*color, 1.0)
    pv.inputs["Density"].default_value = density
    pv.inputs["Anisotropy"].default_value = aniso
    nt.links.new(pv.outputs[0], out.inputs["Volume"])
    ob.data.materials.append(m)
    ob.visible_shadow = False
    return ob, pv


def eevee_volumes(sc, end=400.0, tile="8", samples=48, distribution=0.85):
    e = sc.eevee
    for k, v in (("volumetric_start", 0.1), ("volumetric_end", end), ("volumetric_tile_size", tile),
                 ("volumetric_samples", samples), ("volumetric_sample_distribution", distribution)):
        if hasattr(e, k):
            setattr(e, k, v)


def cloud_sea(col, size=120.0, segments=360, height=1.6, scale=3.2, fine=0.22, seed=3, color=(0.98, 0.95, 0.93), name="cloud_sea"):
    """Cloud tops: a grid displaced by two seeded noise textures (big billows + fine puff detail). The seed moves
    the texture origin, so the same seed gives the same sky. Returns the object."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=segments, y_segments=segments, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    r = random.Random(seed)
    for k, (sc, st, depth, basis) in enumerate(((scale, height, 3, "BLENDER_ORIGINAL"), (scale * fine, height * 0.18, 2, "IMPROVED_PERLIN"))):
        tx = bpy.data.textures.new("%s_noise%d" % (name, k), "CLOUDS")
        tx.noise_scale, tx.noise_depth, tx.noise_basis, tx.noise_type = sc, depth, basis, "SOFT_NOISE"
        e = bpy.data.objects.new("%s_tex%d" % (name, k), None)
        col.objects.link(e)
        e.location = (r.uniform(-500, 500), r.uniform(-500, 500), r.uniform(-50, 50))
        e.hide_render = True
        d = ob.modifiers.new("displace%d" % k, "DISPLACE")
        d.texture, d.strength, d.mid_level = tx, st, 0.5
        d.texture_coords, d.texture_coords_object = "OBJECT", e
    m = MT.principled(name, color, 0.95, 0.0, Specular_IOR_Level=0.15, Sheen_Weight=0.6, Sheen_Roughness=0.6)
    m.node_tree.nodes["Principled BSDF"].inputs["Sheen Tint"].default_value = (1.0, 0.85, 0.7, 1.0)
    me.materials.append(m)
    return ob


def flare_card(col, color=(1.0, 0.62, 0.36), length=140.0, height=5.0, strength=6.0, name="flare"):
    """An additive horizontal streak (gaussian across its height, soft along its length). Place it with face_card()."""
    v = [(-length / 2, 0, -height / 2), (length / 2, 0, -height / 2), (length / 2, 0, height / 2), (-length / 2, 0, height / 2)]
    ob = obj_from(name, v, [(0, 1, 2, 3)], col)
    m, _ = MT.pure_emission(name, color, strength)
    nt = m.node_tree
    em = [n for n in nt.nodes if n.type == "EMISSION"][0]
    sep = MT.nd(m, "ShaderNodeSeparateXYZ")
    MT.ln(m, MT.coord(m), sep.inputs[0])
    qx = MT.math_(m, "DIVIDE", sep.outputs[0], length * 0.22)
    qz = MT.math_(m, "DIVIDE", sep.outputs[2], height * 0.2)
    g = MT.math_(m, "EXPONENT", MT.math_(m, "MULTIPLY", MT.math_(m, "ADD", MT.math_(m, "MULTIPLY", qx, qx),
                                                                     MT.math_(m, "MULTIPLY", qz, qz)), -1.0))
    MT.ln(m, MT.math_(m, "MULTIPLY", g, strength), em.inputs["Strength"])
    ob.data.materials.append(m)
    ob.visible_shadow = False
    return ob


def face_card(K, card, cam_pos, sun_dir, dist=150.0):
    p = Vector(cam_pos) + Vector(sun_dir).normalized() * dist
    q = (Vector(cam_pos) - p).to_track_quat("-Y", "Z")      # the card's normal (-Y) looks back at the camera
    card.rotation_mode = "QUATERNION"
    K.set(card, "location", p)
    K.set(card, "rotation_quaternion", q)


# ------------------------------------------------------------------------------------------------ low-poly kit
def flat_mat(name, color, rough=0.75, emit=None, strength=0.0):
    m = MT.principled(name, color, rough, 0.0, Specular_IOR_Level=0.25)
    if emit is not None:
        MT.P(m).inputs["Emission Color"].default_value = (*emit, 1.0)
        MT.P(m).inputs["Emission Strength"].default_value = strength
    return m


def ico(name, col, mat, r=1.0, subdiv=1, loc=(0, 0, 0), scale=(1, 1, 1), jitter=0.12, seed=1, flat_bottom=None):
    """A faceted rock / crown / cloud: an icosphere with seeded vertex jitter (radial), flat shaded."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    rr = random.Random(seed)
    for v in bm.verts:
        v.co *= 1.0 + rr.uniform(-jitter, jitter)
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        if flat_bottom is not None and v.co.z < flat_bottom:
            v.co.z = flat_bottom
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    me.materials.append(mat)
    ob.location = loc
    return ob


def frustum(name, col, mat, r0, r1, h, n=8, loc=(0, 0, 0), seed=None, jitter=0.0, rot=0.0):
    """n-gon frustum from z = 0 (radius r0) to z = h (radius r1); r1 = 0 makes a cone. Flat shaded."""
    rr = random.Random(seed) if seed is not None else None
    v = []
    for z, r in ((0.0, r0), (h, r1)):
        for i in range(n):
            a = 2 * math.pi * i / n + rot
            k = 1.0 + (rr.uniform(-jitter, jitter) if rr else 0.0)
            v.append((r * k * math.cos(a), r * k * math.sin(a), z))
    f = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = obj_from(name, v, f, col, [mat])
    ob.location = loc
    return ob
