# motion-pack/blender: three owned low-poly vignettes for blender/diorama (one prop + mood light + sky each). Faceted
# primitives only (lib/env.py lowpoly kit), seeded jitter, and a frame(P) that animates them with integer harmonics of
# the loop so frame N equals frame 0. Each builder returns {'half': (w, h), 'target': z, 'anim': fn(K, P)}.
#   lighthouse  rock islet on a night sea, striped tower, warm lantern, a rotating beam, moon and stars
#   campfire    a clearing at dusk: log fire with flickering flames and light, a stone ring, pines behind
#   island      a floating island at sunset: one round tree, a rock, drifting low-poly clouds
# MIT (see blender/LICENSE).
import math
import random

import bpy
from . import env as EN, materials as MT
from .ease import TAU, loop_sines
from .util import obj_from


def _beam_material(name, color, strength, length):
    """additive cone light: bright at the apex (object z = 0), fading along the beam"""
    m, _ = MT.pure_emission(name, color, strength)
    em = [n for n in m.node_tree.nodes if n.type == "EMISSION"][0]
    sep = MT.nd(m, "ShaderNodeSeparateXYZ")
    MT.ln(m, MT.coord(m), sep.inputs[0])
    fall = MT.math_(m, "EXPONENT", MT.math_(m, "MULTIPLY", sep.outputs[2], -2.6 / length))
    MT.ln(m, MT.math_(m, "MULTIPLY", fall, strength), em.inputs["Strength"])
    return m


def _empty(name, col, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    col.objects.link(e)
    e.location = loc
    return e


# ------------------------------------------------------------------------------------------------ lighthouse
def lighthouse(col, lights, seed):
    r = random.Random(seed)
    EN.sky_world(ground=(0.004, 0.006, 0.016), horizon=(0.07, 0.05, 0.16), mid=(0.025, 0.03, 0.10), zenith=(0.004, 0.006, 0.03),
                 sun_dir=EN.dirv(-38.0, 14.0), sun_color=(0.5, 0.55, 0.7), sun_glow=0.0, sun_size=0.9999, halo=0.4, stars=3.0)
    sea = MT.principled("sea", (0.006, 0.014, 0.035), 0.16, 0.0, Specular_IOR_Level=0.6)
    obj_from("sea", [(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [(0, 1, 2, 3)], col, [sea])
    rock = EN.flat_mat("rock", (0.05, 0.05, 0.055), 0.85)
    EN.ico("islet", col, rock, 0.42, 1, (0, 0.02, 0.0), (1.0, 0.8, 0.32), 0.18, r.randint(1, 999), flat_bottom=-0.06)
    EN.ico("rock_a", col, rock, 0.13, 1, (0.42, -0.18, 0.0), (1, 0.8, 0.6), 0.2, r.randint(1, 999), flat_bottom=-0.04)
    EN.ico("rock_b", col, rock, 0.08, 1, (-0.38, -0.22, 0.0), (1, 1, 0.7), 0.2, r.randint(1, 999), flat_bottom=-0.04)
    white = EN.flat_mat("paint_white", (0.62, 0.6, 0.56), 0.6)
    red = EN.flat_mat("paint_red", (0.42, 0.025, 0.02), 0.55)
    z, h, r0, r1, bands = 0.1, 0.62, 0.11, 0.074, 5
    for i in range(bands):
        a, b = r0 + (r1 - r0) * i / bands, r0 + (r1 - r0) * (i + 1) / bands
        EN.frustum("tower_%d" % i, col, white if i % 2 == 0 else red, a, b, h / bands, 10, (0, 0, z + h * i / bands))
    top = z + h
    EN.frustum("gallery", col, red, 0.1, 0.1, 0.022, 10, (0, 0, top))
    lamp = EN.flat_mat("lantern", (0.3, 0.25, 0.15), 0.3, emit=(1.0, 0.72, 0.38), strength=9.0)
    EN.frustum("lantern", col, lamp, 0.052, 0.052, 0.075, 10, (0, 0, top + 0.022))
    EN.frustum("cap", col, red, 0.075, 0.0, 0.07, 10, (0, 0, top + 0.097))
    lz = top + 0.06
    EN.point("lantern_light", lights, (0, 0, lz), 6.0, (1.0, 0.72, 0.4), 0.03)
    rot = _empty("beam_rot", col, (0, 0, lz))
    bm = _beam_material("beam", (1.0, 0.86, 0.6), 0.22, 3.2)
    for k, ang in enumerate((0.0, math.pi)):
        b = EN.frustum("beam_%d" % k, col, bm, 0.02, 0.26, 3.2, 14)
        b.visible_shadow = False
        b.parent = rot
        b.rotation_euler = (math.pi / 2, 0.0, ang)            # local +Z (the beam axis) turned horizontal
    moon = EN.flat_mat("moon", (0.5, 0.5, 0.45), 0.9, emit=(0.95, 0.93, 0.85), strength=4.0)
    EN.ico("moon", col, moon, 0.9, 2, (-11.0, 26.0, 6.5), (1, 1, 1), 0.0, 1)
    EN.sun("moonlight", lights, EN.dirv(-160.0, 22.0), 0.5, (0.65, 0.72, 1.0), 2.0)
    EN.sun("lantern_kick", lights, EN.dirv(30.0, 35.0), 0.12, (1.0, 0.8, 0.55), 10.0)
    fl = loop_sines(seed, (3, 7, 11), (1.0, 0.6, 0.3), 1.0)

    def anim(K, P):
        K.set(rot, "rotation_euler", (0.0, 0.0, TAU * P))
        K.set(MT.P(lamp).inputs["Emission Strength"], "default_value", 9.0 * (1.0 + 0.06 * fl(P)))
    return {"half": (0.62, 0.48), "target": 0.36, "anim": anim, "cam": {"az": 24.0, "el": 9.0}}


# ------------------------------------------------------------------------------------------------ campfire
def campfire(col, lights, seed):
    r = random.Random(seed)
    EN.sky_world(ground=(0.012, 0.01, 0.012), horizon=(0.85, 0.28, 0.1), mid=(0.2, 0.08, 0.22), zenith=(0.015, 0.02, 0.07),
                 sun_dir=EN.dirv(-10.0, -1.0), sun_color=(1.0, 0.45, 0.15), sun_glow=0.6, halo=0.8, stars=1.5)
    grass = EN.flat_mat("grass", (0.022, 0.04, 0.018), 0.9)
    obj_from("ground", [(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [(0, 1, 2, 3)], col, [grass])
    EN.frustum("clearing", col, EN.flat_mat("dirt", (0.05, 0.03, 0.018), 0.95), 0.62, 0.58, 0.012, 11, (0, 0, 0), seed, 0.08)
    stone = EN.flat_mat("stone", (0.07, 0.07, 0.075), 0.85)
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.1, 0.1)
        EN.ico("stone_%d" % i, col, stone, 0.045, 1, (0.2 * math.cos(a), 0.2 * math.sin(a), 0.012), (1.2, 1, 0.75), 0.2, r.randint(1, 999),
               flat_bottom=-0.02)
    wood = EN.flat_mat("log", (0.07, 0.035, 0.015), 0.85)
    for i in range(4):
        a = TAU * i / 4 + 0.4
        lg = EN.frustum("log_%d" % i, col, wood, 0.022, 0.018, 0.26, 6, (0.0, 0.0, 0.03))
        lg.rotation_euler = (0.0, math.radians(72), a)
        lg.location = (-0.12 * math.cos(a), -0.12 * math.sin(a), 0.02)
    flames = []
    for k, (hh, rr, c, s) in enumerate(((0.26, 0.07, (1.0, 0.32, 0.04), 7.0), (0.19, 0.05, (1.0, 0.55, 0.12), 9.0),
                                        (0.12, 0.035, (1.0, 0.82, 0.35), 12.0))):
        m = EN.flat_mat("flame_%d" % k, (0.0, 0.0, 0.0), 0.5, emit=c, strength=s)
        fo = EN.frustum("flame_%d" % k, col, m, rr, 0.0, hh, 6, (0.0, 0.0, 0.04), rot=0.3 * k)
        fo.visible_shadow = False
        flames.append(fo)
    fire = EN.point("fire", lights, (0, 0, 0.16), 26.0, (1.0, 0.5, 0.18), 0.05)
    pine = EN.flat_mat("pine", (0.012, 0.03, 0.02), 0.85)
    bark = EN.flat_mat("bark", (0.04, 0.025, 0.015), 0.9)
    for i in range(6):
        a = math.radians(40 + 100 * i / 5) + r.uniform(-0.12, 0.12)
        d = r.uniform(0.7, 1.05)
        x, y, hgt = d * math.cos(a), d * math.sin(a), r.uniform(0.55, 0.95)
        EN.frustum("trunk_%d" % i, col, bark, 0.025, 0.02, hgt * 0.25, 6, (x, y, 0))
        for j in range(3):
            EN.frustum("pine_%d_%d" % (i, j), col, pine, hgt * (0.28 - 0.06 * j), 0.0, hgt * 0.45, 7,
                       (x, y, hgt * (0.18 + 0.22 * j)), rot=r.uniform(0, 1))
    EN.sun("dusk", lights, EN.dirv(-160.0, 6.0), 1.4, (1.0, 0.5, 0.25), 3.0)
    EN.sun("dusk_sky", lights, EN.dirv(20.0, 50.0), 0.25, (0.45, 0.4, 0.8), 30.0)
    f1 = loop_sines(seed, (5, 9, 14), (1.0, 0.7, 0.4), 1.0)
    f2 = loop_sines(seed + 1, (6, 11, 17), (1.0, 0.6, 0.4), 1.0)

    def anim(K, P):
        for k, fo in enumerate(flames):
            a = f1(P + 0.13 * k)
            b = f2(P + 0.21 * k)
            K.set(fo, "scale", (1.0 + 0.08 * b, 1.0 + 0.08 * a, 1.0 + 0.16 * a))
            K.set(fo, "rotation_euler", (0.05 * b, 0.05 * a, 0.3 * k + 0.2 * b))
        K.set(fire.data, "energy", 26.0 * (1.0 + 0.18 * f1(P)))
    return {"half": (0.55, 0.5), "target": 0.3, "anim": anim, "cam": {"az": 0.0, "el": 9.0}}


# ------------------------------------------------------------------------------------------------ floating island
def island(col, lights, seed):
    r = random.Random(seed)
    sun_dir = EN.dirv(-60.0, 9.0)
    EN.sky_world(ground=(0.22, 0.1, 0.12), horizon=(1.0, 0.46, 0.26), mid=(0.5, 0.28, 0.48), zenith=(0.08, 0.13, 0.36),
                 sun_dir=sun_dir, sun_color=(1.0, 0.62, 0.35), sun_glow=3.0, halo=1.2)
    earth = EN.flat_mat("earth", (0.12, 0.06, 0.03), 0.9)
    grass = EN.flat_mat("grass", (0.08, 0.2, 0.04), 0.85)
    root = _empty("island", col)
    obs = [EN.frustum("island_rock", col, earth, 0.06, 0.52, 0.48, 9, (0, 0, -0.5), seed, 0.12),
           EN.frustum("island_top", col, grass, 0.55, 0.52, 0.05, 9, (0, 0, -0.03), seed, 0.06)]
    bark = EN.flat_mat("bark", (0.09, 0.05, 0.025), 0.85)
    obs.append(EN.frustum("trunk", col, bark, 0.035, 0.022, 0.34, 6, (0.05, 0.04, 0.0)))
    for j, (c, rr, off) in enumerate((((0.06, 0.2, 0.03), 0.17, (0.05, 0.04, 0.42)), ((0.09, 0.26, 0.04), 0.12, (-0.06, 0.0, 0.36)),
                                      ((0.05, 0.16, 0.025), 0.11, (0.15, -0.02, 0.33)))):
        obs.append(EN.ico("crown_%d" % j, col, EN.flat_mat("leaf_%d" % j, c, 0.8), rr, 1, off, (1, 1, 0.9), 0.15, r.randint(1, 999)))
    obs.append(EN.ico("boulder", col, EN.flat_mat("rock", (0.15, 0.14, 0.13), 0.8), 0.07, 1, (-0.26, -0.18, 0.02), (1.2, 1, 0.8), 0.2,
                      r.randint(1, 999), flat_bottom=-0.02))
    for ob in obs:
        ob.parent = root
    cloud = EN.flat_mat("cloud", (0.85, 0.75, 0.75), 0.9)
    clouds = []
    for i in range(5):
        a0 = TAU * i / 5 + r.uniform(-0.3, 0.3)
        rad = r.uniform(1.0, 1.6)
        z = r.uniform(-0.55, 0.2)
        ob = EN.ico("cloud_%d" % i, col, cloud, r.uniform(0.12, 0.2), 1, (0, 0, 0), (2.0, 1.0, 0.7), 0.2, r.randint(1, 999))
        clouds.append((ob, a0, rad, z, r.uniform(0, TAU)))
    EN.sun("sun", lights, sun_dir, 3.2, (1.0, 0.66, 0.42), 2.0)
    EN.sun("sky_fill", lights, EN.dirv(150.0, 50.0), 0.5, (0.6, 0.7, 1.0), 20.0)

    def anim(K, P):
        K.set(root, "location", (0.0, 0.0, 0.025 * math.sin(TAU * P)))
        K.set(root, "rotation_euler", (0.0, 0.0, 0.06 * math.sin(TAU * P + 0.5)))
        for ob, a0, rad, z, ph in clouds:
            a = a0 + 0.12 * math.sin(TAU * P + ph)
            K.set(ob, "location", (rad * math.cos(a), rad * math.sin(a) + 0.4, z + 0.03 * math.sin(TAU * P * 2 + ph)))
    return {"half": (0.6, 0.62), "target": -0.08, "anim": anim, "cam": {"az": 18.0, "el": 12.0}}


SCENES = {"lighthouse": lighthouse, "campfire": campfire, "island": island}
