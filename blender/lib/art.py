# motion-pack/blender: abstract art loops. Each is a closed-form function of the loop phase P = frame / N with integer
# harmonics only, so P = 1 is P = 0 exactly (seamless), and every random choice comes from random.Random(seed).
#   liquid_chrome  metaball cluster on closed Lissajous orbits (merging / splitting), polished chrome
#   voxel_wave     a grid of bars (Geometry Nodes) under travelling waves + beat rings (sidecar beats JSON)
#   particle_swirl a seeded vortex of streaks (Geometry Nodes) on integer-revolution orbits
# MIT (see blender/LICENSE).
import math
import random

import bpy
from mathutils import Vector

from . import materials as MT
from .gn import G, points_object, input_slot

TAU = 2.0 * math.pi


# ------------------------------------------------------------------------------------------------ liquid chrome
def liquid_chrome(col, seed=11, n=9, size=0.22, render_res=0.006, tint=(0.93, 0.93, 0.95), rough=0.035, film=0.0):
    rnd = random.Random(seed)
    mb = bpy.data.metaballs.new("liquid")
    mb.resolution = 0.04
    mb.render_resolution = render_res
    mb.threshold = 0.6
    els = []
    for i in range(n):
        el = mb.elements.new()
        core = i == 0
        r0 = size * (1.0 if core else rnd.uniform(0.45, 0.78))
        orb = (0.0, 0.0, 0.0) if core else tuple(size * rnd.uniform(0.38, 0.85) * a for a in (1.0, 0.7, 0.85))
        k = (1, 1, 1) if core else tuple(rnd.choice((1, 1, 2, 2, 3)) for _ in range(3))
        ph = tuple(rnd.random() * TAU for _ in range(4))
        pulse = 0.06 if core else rnd.uniform(0.08, 0.22)
        el.radius, el.stiffness = r0, 2.0
        els.append(dict(el=el, r0=r0, orb=orb, k=k, ph=ph, pulse=pulse, kr=rnd.choice((1, 2))))
    ob = bpy.data.objects.new("liquid_chrome", mb)
    col.objects.link(ob)
    m = MT.chrome("liquid_chrome", tint, rough)
    if film > 0:
        MT.P(m).inputs["Thin Film Thickness"].default_value = film
        MT.P(m).inputs["Thin Film IOR"].default_value = 1.45
    mb.materials.append(m)
    return {"ob": ob, "mb": mb, "els": els, "mat": m}


def liquid_frame(H, K, P, center=(0, 0, 0.45), wobble=0.04):
    c = Vector(center)
    for e in H["els"]:
        ph, k = e["ph"], e["k"]
        off = Vector((e["orb"][0] * math.sin(TAU * k[0] * P + ph[0]), e["orb"][1] * math.sin(TAU * k[1] * P + ph[1]),
                      e["orb"][2] * math.sin(TAU * k[2] * P + ph[2])))
        if e["orb"] == (0.0, 0.0, 0.0):
            off = Vector((wobble * math.sin(TAU * P + ph[0]), wobble * 0.6 * math.sin(TAU * P + ph[1]), wobble * 0.8 * math.sin(TAU * 2 * P + ph[2])))
        K.set(e["el"], "co", c + off)
        K.set(e["el"], "radius", e["r0"] * (1.0 + e["pulse"] * math.sin(TAU * e["kr"] * P + ph[3])))


# ------------------------------------------------------------------------------------------------ voxel wave
def voxel_wave(col, n=26, pitch=0.042, gap=0.16, base=0.02, amp=0.16, low=(0.20, 0.011, 1.0), high=(1.0, 0.30, 0.02),
               glow=6.0, seed=3):
    rnd = random.Random(seed)
    me = bpy.data.meshes.new("voxel_src")
    me.from_pydata([(0, 0, 0)], [], [])
    ob = bpy.data.objects.new("voxel_wave", me)
    col.objects.link(ob)
    g = G("voxel_wave")
    Pin = g.param("Phase", 0.0)
    Ein = g.param("Energy", 0.0)
    R0, A0, R1, A1 = g.param("Ring0", 0.0), g.param("Amp0", 0.0), g.param("Ring1", 0.0), g.param("Amp1", 0.0)
    grid = g.node("GeometryNodeMeshGrid", {"Size X": n * pitch, "Size Y": n * pitch, "Vertices X": n, "Vertices Y": n})
    pos = g.node("GeometryNodeInputPosition").outputs[0]
    x, y, _ = g.sep(pos)
    r = g.math("SQRT", g.math("ADD", g.math("MULTIPLY", x, x), g.math("MULTIPLY", y, y)))
    span = n * pitch / 2

    def wave(arg):          # 0.5 + 0.5 sin(arg)
        return g.math("MULTIPLY_ADD", g.math("SINE", arg), 0.5, 0.5)
    kr, kx, ky = TAU * 2.2 / span, TAU * 1.0 / span, TAU * 0.6 / span
    w1 = wave(g.math("SUBTRACT", g.math("MULTIPLY", r, kr), g.math("MULTIPLY", Pin, TAU * 2)))
    w2 = wave(g.math("ADD", g.math("ADD", g.math("MULTIPLY", x, kx), g.math("MULTIPLY", y, ky)), g.math("MULTIPLY", Pin, TAU)))
    sig = 0.06

    def ring(R, A):
        q = g.math("DIVIDE", g.math("SUBTRACT", r, R), sig)
        return g.math("MULTIPLY", g.math("EXPONENT", g.math("MULTIPLY", g.math("MULTIPLY", q, q), -1.0)), A)
    rings = g.math("ADD", ring(R0, A0), ring(R1, A1))
    edge = g.math("SUBTRACT", 1.0, g.math("POWER", g.math("DIVIDE", r, span * 1.42), 2.0))      # quieter corners
    hgt = g.math("MULTIPLY", g.math("ADD", g.math("ADD", g.math("MULTIPLY", w1, 0.65), g.math("MULTIPLY", w2, 0.35)),
                                    g.math("ADD", rings, g.math("MULTIPLY", Ein, 0.35))), amp)
    hgt = g.math("ADD", g.math("MULTIPLY", hgt, g.math("MAXIMUM", edge, 0.15)), base)
    pts = g.store(grid.outputs["Mesh"], "h", g.math("DIVIDE", g.math("SUBTRACT", hgt, base), amp * 1.4))
    cube = g.node("GeometryNodeMeshCube", {"Size": (pitch * (1 - gap), pitch * (1 - gap), 1.0)})
    lift = g.node("GeometryNodeTransform", {"Geometry": cube.outputs[0], "Translation": (0, 0, 0.5)})
    mat = _voxel_material(low, high, glow)
    setm = g.node("GeometryNodeSetMaterial", {"Geometry": lift.outputs[0], "Material": mat})
    iop = g.node("GeometryNodeInstanceOnPoints", {"Points": pts, "Instance": setm.outputs[0],
                                                  "Scale": g.xyz(1.0, 1.0, hgt)})
    g.output(iop.outputs[0])
    mod = g.attach(ob)
    return {"ob": ob, "mod": mod, "ids": g.inputs, "mat": mat, "span": span}


def _voxel_material(low, high, glow):
    m = MT.principled("voxel", (0.010, 0.010, 0.012), 0.45, Specular_IOR_Level=0.35, Coat_Weight=0.1, Coat_Roughness=0.2)
    at = MT.nd(m, "ShaderNodeAttribute")
    at.attribute_type = "INSTANCER"
    at.attribute_name = "h"
    geo = MT.nd(m, "ShaderNodeNewGeometry")
    sep = MT.nd(m, "ShaderNodeSeparateXYZ")
    MT.ln(m, geo.outputs["Normal"], sep.inputs[0])
    top = MT.maprange(m, sep.outputs[2], 0.6, 0.9, 0.0, 1.0)
    h = MT.math_(m, "MINIMUM", MT.math_(m, "MAXIMUM", at.outputs["Fac"], 0.0), 1.0)
    # a 3-stop ramp (deep low -> low -> high): a straight linear mix of violet and amber reads pink through AgX
    ramp = MT.nd(m, "ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (low[0] * 0.3, low[1] * 0.3, low[2] * 0.35, 1.0)
    els[1].position, els[1].color = 0.5, (*low, 1.0)
    e3 = els.new(0.92)
    e3.color = (*high, 1.0)
    MT.ln(m, h, ramp.inputs[0])
    col = ramp.outputs[0]
    MT.ln(m, col, MT.P(m).inputs["Emission Color"])
    s = MT.math_(m, "MULTIPLY", MT.math_(m, "MULTIPLY", top, MT.math_(m, "ADD", MT.math_(m, "MULTIPLY", h, 0.85), 0.15)), glow)
    lvl = MT.value(m, "glow_k", 1.0)
    MT.ln(m, MT.math_(m, "MULTIPLY", s, lvl.outputs[0]), MT.P(m).inputs["Emission Strength"])
    m["glow_node"] = lvl.name
    return m


def voxel_frame(H, K, P, energy=0.0, rings=((0.0, 0.0), (0.0, 0.0))):
    mod, ids = H["mod"], H["ids"]
    for name, v in (("Phase", P), ("Energy", energy), ("Ring0", rings[0][0]), ("Amp0", rings[0][1]),
                    ("Ring1", rings[1][0]), ("Amp1", rings[1][1])):
        K.set(*input_slot(mod, ids[name]), float(v))
    H["ob"].update_tag()


# ------------------------------------------------------------------------------------------------ particle swirl
def particle_swirl(col, seed=21, n=2600, r_in=0.08, r_out=0.62, height=0.32, size=0.0045, streak=7.0,
                   palette=((0.20, 0.011, 1.0), (1.0, 0.30, 0.02), (0.85, 0.9, 1.0)), glow=9.0):
    rnd = random.Random(seed)
    pts, A = [], {k: [] for k in ("r", "a0", "k", "z0", "bob", "m", "psi", "s", "hue")}
    for i in range(n):
        u = rnd.random()
        r = r_in + (r_out - r_in) * (u ** 0.7)
        k = rnd.choice((1, 1, 1, 2)) * (1 if r < 0.5 * (r_in + r_out) else 1)
        z0 = rnd.gauss(0.0, height * 0.25 * (1.2 - 0.6 * (r - r_in) / (r_out - r_in)))
        pts.append((0, 0, 0))
        for key, v in (("r", r), ("a0", rnd.random() * TAU + 3.2 * r), ("k", float(k)), ("z0", z0),
                       ("bob", rnd.uniform(0.004, 0.02)), ("m", float(rnd.choice((1, 2, 3)))), ("psi", rnd.random() * TAU),
                       ("s", size * rnd.uniform(0.5, 1.4)), ("hue", rnd.random())):
            A[key].append(v)
    ob = points_object("particle_swirl", col, pts, A)
    g = G("particle_swirl")
    Pin = g.param("Phase", 0.0)
    th = g.math("ADD", g.attr("a0"), g.math("MULTIPLY", g.math("MULTIPLY", g.attr("k"), Pin), TAU))
    rr = g.attr("r")
    x = g.math("MULTIPLY", rr, g.math("COSINE", th))
    y = g.math("MULTIPLY", rr, g.math("SINE", th))
    z = g.math("ADD", g.attr("z0"), g.math("MULTIPLY", g.attr("bob"),
                                            g.math("SINE", g.math("ADD", g.math("MULTIPLY", g.math("MULTIPLY", g.attr("m"), Pin), TAU), g.attr("psi")))))
    setp = g.node("GeometryNodeSetPosition", {"Geometry": g.gi.outputs[0], "Position": g.xyz(x, y, z)})
    sph = g.node("GeometryNodeMeshUVSphere", {"Segments": 10, "Rings": 6, "Radius": 1.0})
    mat = _swirl_material(palette, glow)
    setm = g.node("GeometryNodeSetMaterial", {"Geometry": sph.outputs[0], "Material": mat})
    smooth = g.node("GeometryNodeSetShadeSmooth", {"Geometry": setm.outputs[0]})
    sz = g.attr("s")
    spd = g.math("MULTIPLY", g.math("ABSOLUTE", g.attr("k")), g.math("MULTIPLY", rr, streak))       # streak ~ speed
    scale = g.xyz(g.math("MULTIPLY", sz, g.math("ADD", 1.0, spd)), sz, sz)
    rot = g.xyz(0.0, 0.0, g.math("ADD", th, math.pi / 2))
    iop = g.node("GeometryNodeInstanceOnPoints", {"Points": setp.outputs[0], "Instance": smooth.outputs[0],
                                                  "Rotation": rot, "Scale": scale})
    g.output(iop.outputs[0])
    mod = g.attach(ob)
    return {"ob": ob, "mod": mod, "ids": g.inputs, "mat": mat}


def _swirl_material(palette, glow):
    m = MT.principled("swirl", (0.0, 0.0, 0.0), 0.5)
    at = MT.nd(m, "ShaderNodeAttribute")
    at.attribute_type = "INSTANCER"
    at.attribute_name = "hue"
    ramp = MT.nd(m, "ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (*palette[0], 1.0)
    els[1].position, els[1].color = 0.62, (*palette[1], 1.0)
    e3 = els.new(0.9)
    e3.color = (*palette[2], 1.0)
    MT.ln(m, at.outputs["Fac"], ramp.inputs[0])
    MT.ln(m, ramp.outputs[0], MT.P(m).inputs["Emission Color"])
    lvl = MT.value(m, "glow_k", glow)
    MT.ln(m, lvl.outputs[0], MT.P(m).inputs["Emission Strength"])
    return m


def swirl_frame(H, K, P):
    K.set(*input_slot(H["mod"], H["ids"]["Phase"]), float(P))
    H["ob"].update_tag()
