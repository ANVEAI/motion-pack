# motion-pack/blender: the procedural device generator. A rounded or chamfered box: base plinth, an emissive band
# (a recessed frosted light pipe), two U-shaped shells meeting on a hairline parting line, a machined lid with an
# optional perforated top, real-size ports, feet, and internals (board, cooler, fan, PSU) for the exploded view.
# Every dimension is a parameter (metres). PRESETS holds four looks, among them `matte-copper` (matte
# black, copper-amber band). Parts hang off six empties (tray, shellL, shellR, board, cooler, lid) so explode() can
# move them on the launch film's cascade (cover first out, last home). The band's spill on the plinth and
# floor comes from four thin area strips just outside the diffuser (EEVEE emissive meshes cast no light).
# MIT (see blender/LICENSE).
import copy
import math

from mathutils import Vector, Euler

from . import materials as MT
from . import device_parts as DP
from .ease import E, seg
from .util import coll, empty, prism, outline, inset_corner, weighted_bevel, bevel, cyl

# the launch-film box in metres (scaled x 0.23): 299 x 225 x 219 mm
BASE = dict(
    w=0.299, d=0.2254, h=0.2185, corner="chamfer", corner_size=0.0101, wall=0.0078,
    base_h=0.0338, band_h=0.00575, band_inset=0.0017, lid_h=0.0184, split="lr", parting=0.0000575,
    feet=dict(n=0, h=0.003, r=0.011, inset=0.032),
    rounds=dict(lid=(0.00345, 4, {"top": 1.0, "vert": 0.62, "bot": 0.16}),
                shell=(0.00276, 3, {"top": 0.22, "vert": 0.82, "bot": 0.22, "part": 0.02}),
                base=(0.00276, 3, {"top": 0.4, "vert": 0.82, "bot": 0.72})),
    body=dict(mat="matte_coat"), base_mat=dict(mat="matte_coat", color=(0.019, 0.019, 0.019), rough=(0.47, 0.53)),
    lid_mat=dict(mat="matte_coat"), top=dict(mat="anodised", perf=dict(pitch=0.00431, hole=0.31, margin=0.0205)),
    deck=dict(mat="plastic", color=(0.014, 0.014, 0.015), rough=0.72),
    band=dict(edge=(1.0, 0.16, 0.0), core=(1.0, 0.30, 0.02), strength=1.25, albedo=(0.22, 0.11, 0.05), spill=1.35,
              spill_color=(1.0, 0.45, 0.12), core_frac=0.16),
    ports=[dict(face="right", kind="rj45", u=-0.27, z=0.0533), dict(face="front", kind="led", u=0.445, z=0.0196)],
    internals=True,
)

PRESETS = {
    # machined matte-black powder coat, perforated anodised lid, copper-amber band
    "matte-copper": {},
    # brandless looks
    "studio-white": dict(corner="round", corner_size=0.022, body=dict(mat="ceramic", color=(0.80, 0.80, 0.78)),
                         base_mat=dict(mat="ceramic", color=(0.72, 0.72, 0.70), rough=0.4), lid_mat=dict(mat="ceramic", color=(0.80, 0.80, 0.78)),
                         top=dict(mat="ceramic", color=(0.78, 0.78, 0.76)),
                         band=dict(edge=(0.55, 0.75, 1.0), core=(0.85, 0.93, 1.0), strength=1.1, albedo=(0.5, 0.52, 0.55),
                                   spill=1.0, spill_color=(0.75, 0.85, 1.0)),
                         ports=[dict(face="back", kind="usbc", u=0.2, z=0.06), dict(face="back", kind="dc", u=-0.25, z=0.06),
                                dict(face="front", kind="led", u=0.0, z=0.0196, color=(0.9, 0.95, 1.0), strength=1.2)]),
    "graphite-teal": dict(corner="round", corner_size=0.012, h=0.17,
                          body=dict(mat="brushed_metal", color=(0.16, 0.165, 0.17), rough=0.34),
                          lid_mat=dict(mat="brushed_metal", color=(0.16, 0.165, 0.17), rough=0.34),
                          top=dict(mat="anodised", color=(0.03, 0.032, 0.034), perf=dict(pitch=0.005, hole=0.3, margin=0.022)),
                          band=dict(edge=(0.0, 0.55, 0.45), core=(0.2, 1.0, 0.85), strength=1.0, albedo=(0.05, 0.12, 0.11),
                                    spill=1.1, spill_color=(0.2, 1.0, 0.8)),
                          ports=[dict(face="right", kind="usbc", u=-0.2, z=0.06), dict(face="right", kind="usbc", u=0.0, z=0.06),
                                 dict(face="back", kind="vent", u=0.0, z=0.1, n=11)]),
    "puck-violet": dict(w=0.2, d=0.2, h=0.09, corner="round", corner_size=0.06, base_h=0.018, lid_h=0.012, split="none",
                        feet=dict(n=4, h=0.0025, r=0.009, inset=0.045),
                        body=dict(mat="plastic", color=(0.022, 0.022, 0.024), rough=0.38), lid_mat=dict(mat="plastic", color=(0.022, 0.022, 0.024), rough=0.38),
                        top=dict(mat="plastic", color=(0.018, 0.018, 0.02), rough=0.55),
                        band=dict(edge=MT.VIOLET_AGX, core=(0.55, 0.35, 1.0), strength=1.2, albedo=(0.06, 0.03, 0.15), spill=0.9,
                                  spill_color=(0.45, 0.25, 1.0)),
                        ports=[dict(face="back", kind="usbc", u=0.0, z=0.045)], internals=False),
}


def spec(preset="matte-copper", **over):
    """Merge BASE <- preset <- overrides (dicts merge one level deep)."""
    if preset not in PRESETS:
        raise KeyError("unknown device preset %r (have %s)" % (preset, ", ".join(PRESETS)))
    D = copy.deepcopy(BASE)
    for src in (PRESETS[preset], over):
        for k, v in src.items():
            if isinstance(v, dict) and isinstance(D.get(k), dict):
                D[k] = {**D[k], **v}
            else:
                D[k] = copy.deepcopy(v)
    D["preset"] = preset
    return D


def _u_shell(D, sign):
    """Half of the hollow sleeve (x >= gap for sign +1), as one U-shaped polygon: outer outline, then the inner."""
    w, d, c, t, g = D["w"], D["d"], D["corner_size"], D["wall"], D["parting"]
    outer = [p for p in outline(D["corner"], w, d, c) if p[0] > g + 1e-6]
    inner = [p for p in outline(D["corner"], w - 2 * t, d - 2 * t, inset_corner(D["corner"], c, t)) if p[0] > g + 1e-6]
    outer.sort(key=lambda p: math.atan2(p[1], p[0]))
    inner.sort(key=lambda p: math.atan2(p[1], p[0]))
    U = [(g, -d / 2)] + outer + [(g, d / 2), (g, d / 2 - t)] + inner[::-1] + [(g, -d / 2 + t)]
    return [(sign * x, y) for x, y in U]


def build(D, col=None, seed=5):
    """Build the device at the origin standing on z = 0. Returns D extended with handles: parts, band nodes, lights."""
    col = col or coll("device")
    D["col"], D["leds"] = col, []
    root = empty("device_root", col)
    parts = {k: empty("part_" + k, col, root) for k in ("tray", "shellL", "shellR", "board", "cooler", "lid")}
    D["root"], D["parts"] = root, parts
    w, d, h, c = D["w"], D["d"], D["h"], D["corner_size"]
    fh = D["feet"]["h"] if D["feet"].get("n") else 0.0
    z0 = fh
    zb = z0 + D["base_h"] + D["band_h"]
    zt = h - D["lid_h"]
    D["z_band_c"], D["z_band_top"], D["z_lid"] = z0 + D["base_h"] + D["band_h"] / 2, zb, zt
    M = {"body": MT.make(D["body"], "dev_body"), "base": MT.make(D["base_mat"], "dev_base"),
         "lid": MT.make(D["lid_mat"], "dev_lid"), "deck": MT.make(D["deck"], "dev_deck")}
    top = dict(D["top"])
    if top.get("perf"):
        pf = dict(top["perf"])
        top["perf"] = {"pitch": pf["pitch"], "hole": pf.get("hole", 0.31),
                       "half": (w / 2 - pf.get("margin", 0.02), d / 2 - pf.get("margin", 0.02) - 0.0035)}
    M["top"] = MT.make(top, "dev_top")
    bd = D["band"]
    M["band"], D["band_nodes"] = MT.emissive_band("dev_band", D["z_band_c"], D["band_h"] * bd.get("core_frac", 0.16),
                                                   w - 2 * D["band_inset"], bd["edge"], bd["core"], bd["strength"], bd["albedo"])
    D["M"] = M
    IM = DP.internal_materials()
    D["IM"] = IM
    base = prism("base", outline(D["corner"], w, d, c), z0, D["base_h"], col, [M["base"]])
    base.parent = parts["tray"]
    ci = inset_corner(D["corner"], c, D["band_inset"])
    pipe = prism("band", outline(D["corner"], w - 2 * D["band_inset"], d - 2 * D["band_inset"], ci), z0 + D["base_h"],
                 D["band_h"], col, [M["band"], M["deck"]], cap_top=1, cap_bot=1)
    pipe.parent = parts["tray"]
    D["band_ob"] = pipe
    shells = {}
    for k, sg in (("shellL", -1), ("shellR", 1)):
        ob = prism("shell_" + k[-1], _u_shell(D, sg), zb, zt - zb, col, [M["body"]])
        ob.parent = parts[k]
        shells[k] = ob
    lid = prism("lid", outline(D["corner"], w, d, c), zt, D["lid_h"], col, [M["lid"], M["top"]], cap_top=1)
    lid.parent = parts["lid"]
    # ports before bevels (the modifier stack must read boolean, then bevel)
    for p in D["ports"]:
        if p["z"] < zb:
            tgt, part = base, parts["tray"]
        else:
            fx = DP._face_frame(D, p["face"], p.get("u", 0.0))[0].x
            tgt, part = (shells["shellR"], parts["shellR"]) if fx >= 0 else (shells["shellL"], parts["shellL"])
        DP.add_port(D, p, tgt, part, col, M, IM)
    R = D["rounds"]
    weighted_bevel(lid, R["lid"][0], R["lid"][1], R["lid"][2])
    part_w = dict(R["shell"][2])
    if D["split"] == "none":
        part_w["part"] = 0.0
    for ob in shells.values():
        weighted_bevel(ob, R["shell"][0], R["shell"][1], part_w, part_x=D["parting"])
    weighted_bevel(base, R["base"][0], R["base"][1], R["base"][2])
    if fh > 0:
        rub = MT.plastic("dev_rubber", (0.02, 0.02, 0.021), 0.6)
        fx, fy = w / 2 - D["feet"]["inset"], d / 2 - D["feet"]["inset"]
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl("foot", D["feet"]["r"], fh, (sx * fx, sy * fy, fh / 2), col, rub, 32, bev=fh * 0.3).parent = parts["tray"]
    if D.get("internals", True):
        DP.build_internals(D, col, parts, IM, seed)
    D["band_lights"] = band_spill(D, col)
    D["meshes"] = [o for o in col.objects if o.type in ("MESH", "CURVE") and not o.hide_render]
    return D


def band_spill(D, col):
    """Four thin area strips 3 mm outside the diffuser, one per face, tilted 65 deg down, spread 120 deg, diffuse
    only: the plinth, the coat and the floor get a real 6-8 cm falloff (generalised from the launch-film band lights)."""
    import bpy
    w, d, c, i = D["w"], D["d"], D["corner_size"], D["band_inset"]
    zc = D["z_band_c"]
    bd = D["band"]
    out = []
    for name, length, loc, yaw in (("front", w - 2 * c, (0, -(d / 2 - i) - 0.003, zc), 0.0),
                                   ("right", d - 2 * c, ((w / 2 - i) + 0.003, 0, zc), 90.0),
                                   ("back", w - 2 * c, (0, (d / 2 - i) + 0.003, zc), 180.0),
                                   ("left", d - 2 * c, (-(w / 2 - i) - 0.003, 0, zc), -90.0)):
        L = bpy.data.lights.new("band_spill_" + name, "AREA")
        L.shape = "RECTANGLE"
        L.size, L.size_y = max(0.01, length), 0.012
        L.energy = bd["spill"]
        L.color = bd["spill_color"]
        L.spread = math.radians(120)
        L.specular_factor = 0.0
        ob = bpy.data.objects.new("band_spill_" + name, L)
        col.objects.link(ob)
        ob.parent = D["parts"]["tray"]
        ob.location = loc
        ob.rotation_euler = (math.radians(-65), 0, math.radians(yaw))
        ob.visible_glossy = False
        ob.visible_camera = False
        out.append(ob)
    return out


def set_band(D, K, level=None, ignite=1.0, hot=0.0, dim=1.0):
    """Band level (1.0 = the preset's calibrated strength), the left-to-right ignition 0..1 and the glint; the spill
    strips and the status LEDs follow (they wake with the band, never before it)."""
    bd = D["band"]
    lvl = bd["strength"] * (1.0 if level is None else level) * dim
    n = D["band_nodes"]
    K.set(n["level"].outputs[0], "default_value", lvl)
    K.set(n["ignite"].outputs[0], "default_value", ignite)
    K.set(n["hot"].outputs[0], "default_value", hot)
    soft = 0.22 / 1.3
    fr = ignite * (1 + soft)
    frac = {"left": min(1.0, max(0.0, fr / soft)), "front": min(1.0, max(0.0, (fr - 0.5 * soft))),
            "back": min(1.0, max(0.0, (fr - 0.5 * soft))), "right": min(1.0, max(0.0, (fr - 1.0) / soft))}
    for ob in D["band_lights"]:
        side = ob.name.split(".")[0].replace("band_spill_", "")
        K.set(ob.data, "energy", bd["spill"] * (lvl / bd["strength"]) * frac.get(side, 1.0))
    for mat, s0 in D["leds"]:
        K.set(MT.P(mat).inputs["Emission Strength"], "default_value", s0 * min(1.0, ignite * 1.5) * dim)


# ------------------------------------------------------------------------------------------------ the exploded view
CASCADE = {"lid": (0.00, 0.80), "shells": (0.08, 0.85), "cooler": (0.16, 0.80), "board": (0.24, 0.85), "tray": (0.32, 0.90)}
OUT = {"lid": (0, 0, 0.170), "shellL": (-0.101, 0, 0.023), "shellR": (0.101, 0, 0.023), "cooler": (0, 0, 0.138),
       "board": (0, 0, 0.0736), "tray": (0, 0, 0.023)}
TILT = {"lid": (0.035, 0.02, 0.0), "shellL": (0, 0, 0.03), "shellR": (0, 0, -0.03), "cooler": (0, 0, 0.04)}
HOLD = {"lid": (0.10, 0, 0), "board": (0.09, 0, 0)}
PIVOT = {"lid": 0.209, "board": 0.069, "cooler": 0.1035, "shellL": 0.1196, "shellR": 0.1196, "tray": 0.0207}


def explode_q(name, t, t_open, t_seal, speed=1.0):
    """0 sealed -> 1 out, on the cascade; the reassembly is its exact time-mirror about (open + seal) / 2, so the lid
    (first out) seats last, exactly at t_seal. t_seal None = stay open."""
    s, d = CASCADE["shells" if name.startswith("shell") else name]
    s, d = s / speed, d / speed
    rr = t if (t_seal is None or t <= (t_open + t_seal) / 2) else t_open + t_seal - t
    return E["move"](seg(rr, t_open + s, t_open + s + d))


def explode(D, K, t, t_open, t_seal=None, spread=1.0, breathe=0.0, speed=1.0):
    """Pose every part at time t (seconds). spread scales the offsets (1 = the film's teardown), breathe 0..1 opens
    the held stack a few % further."""
    k = D["h"] / 0.2185
    for name, part in D["parts"].items():
        q0 = explode_q(name, t, t_open, t_seal, speed)
        q = q0 * spread * (1 + 0.035 * breathe)
        o = Vector(OUT[name]) * k * q
        tl, hd = TILT.get(name, (0, 0, 0)), HOLD.get(name, (0, 0, 0))
        bump = math.sin(math.pi * q0)
        rot = Euler(tuple(tl[i] * bump + hd[i] * q0 for i in range(3)))
        c = Vector((0, 0, PIVOT[name] * k))
        K.set(part, "location", o + c - rot.to_matrix() @ c)
        K.set(part, "rotation_euler", rot)
    if D.get("blades") is not None:
        K.set(D["blades"], "rotation_euler", (0, 0, 0.6 * t))
    return D


def footprint(D):
    """(half_w, half_d, height) for framing and the floor's reflection falloff."""
    return D["w"] / 2, D["d"] / 2, D["h"]
