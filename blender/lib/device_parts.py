# motion-pack/blender: device parts: real-size ports (cut into the shell with an exact boolean, a dark cavity, a
# metal shield rim, pins) and the internals the exploded view reveals (board, chips, cooler fin stack, heat pipes, fan,
# PSU). Generalised from the launch film's teardown, with a darkened palette
# (inner parts read as dark anodised metal; green PCBs and bright copper read cheap).
# MIT (see blender/LICENSE).
import math
import random

from mathutils import Vector

from . import materials as MT
from .util import box, cyl, prism, rrect, curve_obj, empty, bevel

PORT_KINDS = ("rj45", "usbc", "dc", "led", "vent")


def internal_materials():
    M = {}
    M["pcb"] = MT.principled("dev_pcb", (0.011, 0.012, 0.013), 0.32, Coat_Weight=0.2, Coat_Roughness=0.3)
    M["chip"] = MT.principled("dev_epoxy", (0.012, 0.012, 0.013), 0.42)
    M["die"] = MT.principled("dev_die", (0.05, 0.055, 0.07), 0.08, 0.7)
    M["substrate"] = MT.principled("dev_substrate", (0.018, 0.02, 0.018), 0.35)
    M["steel"] = MT.brushed_metal("dev_steel", (0.42, 0.42, 0.43), 0.28)
    M["nickel"] = MT.brushed_metal("dev_nickel", (0.5, 0.5, 0.51), 0.25)
    M["gold"] = MT.principled("dev_gold", (1.0, 0.76, 0.36), 0.2, 1.0)
    M["fin"] = MT.principled("dev_fin", (0.05, 0.05, 0.055), 0.48, 0.75, Anisotropic=0.4)
    M["fan"] = MT.plastic("dev_fan", (0.03, 0.03, 0.03), 0.5)
    M["label"] = MT.principled("dev_label", (0.16, 0.16, 0.16), 0.5)
    M["black"] = MT.principled("dev_cavity", (0.002, 0.002, 0.002), 0.9)
    M["psu"] = MT.matte_coat("dev_psu", (0.05, 0.05, 0.052), (0.4, 0.5))
    M["mlcc"] = MT.principled("dev_mlcc", (0.42, 0.31, 0.17), 0.45)
    return M


# ------------------------------------------------------------------------------------------------ ports
def _face_frame(D, face, u):
    """(point on the face at fraction u in -0.5..0.5, outward normal, along-face axis) for front/back/left/right."""
    w, d = D["w"], D["d"]
    if face == "front":
        return Vector((u * (w - 2 * D["corner_size"]), -d / 2, 0)), Vector((0, -1, 0)), Vector((1, 0, 0))
    if face == "back":
        return Vector((-u * (w - 2 * D["corner_size"]), d / 2, 0)), Vector((0, 1, 0)), Vector((-1, 0, 0))
    if face == "right":
        return Vector((w / 2, u * (d - 2 * D["corner_size"]), 0)), Vector((1, 0, 0)), Vector((0, 1, 0))
    return Vector((-w / 2, -u * (d - 2 * D["corner_size"]), 0)), Vector((-1, 0, 0)), Vector((0, -1, 0))


def _oriented(ob, nrm):
    """Rotate a part built facing +X (depth along X) so it faces the outward normal."""
    ob.rotation_euler = (0, 0, math.atan2(nrm.y, nrm.x))
    return ob


def add_port(D, port, target, part, col, M, IM):
    """port: {face, kind, u, z, color?}. target: the mesh the opening is cut into (a shell or the base)."""
    kind = port["kind"]
    p, nrm, _ = _face_frame(D, port["face"], port.get("u", 0.0))
    p.z = port["z"]
    yaw = math.atan2(nrm.y, nrm.x)
    out = []
    if kind == "led":
        c = port.get("color", (0.03, 1.0, 0.62))
        led = MT.emission("dev_led_%d" % len(D["leds"]), c, port.get("strength", 1.6))
        ob = cyl("status_led", 0.0011, 0.0009, p + nrm * 0.0003, col, led, 20, rot=(0, math.pi / 2, yaw))
        ob.parent = part
        D["leds"].append((led, port.get("strength", 1.6)))
        return [ob]
    if kind == "vent":
        n, pitch = port.get("n", 9), port.get("pitch", 0.0042)
        for i in range(n):
            q = p + _face_frame(D, port["face"], 0)[2] * ((i - (n - 1) / 2) * pitch)
            s = box("vent_slot", (0.002, 0.0016, port.get("h", 0.018)), q - nrm * 0.0004, col, IM["black"])
            _oriented(s, nrm).parent = part
            out.append(s)
        return out
    # an opening cut by an exact boolean before the bevel (the stack order matters: boolean, then bevel)
    size = {"rj45": (0.0122, 0.0094), "usbc": (0.0090, 0.0033), "dc": (0.0062, 0.0062)}[kind]
    depth = D["wall"] * 3.2
    if kind == "dc":
        cut = cyl("port_cutter", size[0] / 2, depth, p, col, IM["black"], 32, rot=(0, math.pi / 2, yaw))
    else:
        r = min(size) * (0.48 if kind == "usbc" else 0.08)
        cut = prism("port_cutter", rrect(size[0], size[1], r, 6), -depth / 2, depth, col, [IM["black"]])
        cut.location = p
        cut.rotation_euler = (math.pi / 2, 0, yaw + math.pi / 2)
    cut.hide_render = True
    cut.display_type = "WIRE"
    cut.parent = part
    # (device.build adds every port before any bevel: the stack must read boolean, then bevel)
    bo = target.modifiers.new("port_%s" % kind, "BOOLEAN")
    bo.object = cut
    bo.operation = "DIFFERENCE"
    bo.solver = "EXACT"
    inner = p - nrm * (D["wall"] + 0.004)
    cav = box("port_cavity", (0.008, size[0] + 0.002, size[1] + 0.002), inner, col, IM["black"])
    _oriented(cav, nrm).parent = part
    out.append(cav)
    if kind == "rj45":
        for i in range(8):
            g = box("port_pin", (0.006, 0.0006, 0.0004), p - nrm * (D["wall"] + 0.002), col, IM["gold"])
            g.location += Vector((-nrm.y, nrm.x, 0)) * (-0.004 + i * 0.00115) + Vector((0, 0, -0.0035))
            _oriented(g, nrm).parent = part
            out.append(g)
    if kind == "usbc":
        tongue = box("port_tongue", (0.004, size[0] * 0.7, 0.0007), p - nrm * (D["wall"] * 0.6), col, IM["chip"])
        _oriented(tongue, nrm).parent = part
        out.append(tongue)
    if kind == "dc":
        pin = cyl("port_pin", 0.0011, 0.006, p - nrm * (D["wall"] * 0.9), col, IM["gold"], 16, rot=(0, math.pi / 2, yaw))
        pin.parent = part
        out.append(pin)
    return out


# ------------------------------------------------------------------------------------------------ internals
def build_internals(D, col, parts, IM, seed=5):
    """Board (+ SoC, memory, M.2, VRM, MLCC rows, standoffs), cooler (fin stack, cold plate, heat pipes, open fan),
    PSU block. Sized from the device's footprint; z from the band top up."""
    rnd = random.Random(seed)
    w, d = D["w"], D["d"]
    sx, sy = w / 0.299, d / 0.2254
    zb = D["z_band_top"]
    by = zb + 0.03 * D["h"] / 0.2185
    own = lambda ob, k: setattr(ob, "parent", parts[k]) or ob
    pw, pd = 0.76 * w, 0.74 * d
    pcb = prism("pcb", rrect(pw, pd, 0.0028, 3), by - 0.0014, 0.0028, col, [IM["pcb"]])
    bevel(pcb, 0.0003, 2, 30)
    own(pcb, "board")
    cpu = Vector((0.0046 * sx, 0.0069 * sy, 0))
    own(box("soc_substrate", (0.046, 0.046, 0.0014), (cpu.x, cpu.y, by + 0.0021), col, IM["substrate"], 0.0002), "board")
    own(box("soc_die_io", (0.025, 0.017, 0.0009), (cpu.x - 0.0046, cpu.y, by + 0.0032), col, IM["die"]), "board")
    for dy in (-0.0104, 0.0104):
        own(box("soc_die_ccd", (0.0104, 0.008, 0.0009), (cpu.x + 0.0138, cpu.y + dy, by + 0.0032), col, IM["die"]), "board")
    for k in range(14):
        for sg in (-1, 1):
            own(box("soc_pad", (0.002, 0.0009, 0.00014), (cpu.x - 0.023 + k * 0.0035, cpu.y + sg * 0.027, by + 0.00145), col,
                    IM["gold"]), "board")
    for i in range(4):
        own(box("mem", (0.018, 0.014, 0.0028), ((-0.037 + i * 0.024) * sx, 0.054 * sy, by + 0.0028), col, IM["chip"], 0.0003),
            "board")
        own(box("mem", (0.016, 0.016, 0.0028), (0.059 * sx, (0.035 - i * 0.021) * sy, by + 0.0028), col, IM["chip"], 0.0003),
            "board")
    own(box("m2", (0.083, 0.016, 0.0009), (0, -0.060 * sy, by + 0.0021), col, IM["pcb"]), "board")
    for k, x in enumerate((-0.025, -0.002)):
        own(box("m2_nand", (0.0195, 0.0127, 0.0014), (x, -0.060 * sy, by + 0.0032), col, IM["chip"], 0.0002), "board")
    own(box("m2_label", (0.037, 0.0115, 0.00014), (-0.014, -0.060 * sy, by + 0.0041), col, IM["label"]), "board")
    for i in range(7):
        own(box("choke", (0.0064, 0.0064, 0.005), (-0.039 * sx, (-0.028 + i * 0.0087) * sy, by + 0.0039), col, IM["psu"], 0.0005),
            "board")
        own(cyl("cap", 0.0025, 0.0055, (-0.049 * sx, (-0.025 + i * 0.0083) * sy, by + 0.0041), col, IM["steel"], 20, bev=0.0003),
            "board")
    for r_ in range(4):
        for k in range(16):
            own(box("mlcc", (0.0017, 0.001, 0.001), ((0.03 + k * 0.0029) * sx, (-0.039 + r_ * 0.005) * sy, by + 0.0019), col,
                    IM["mlcc"]), "board")
    for i in range(22):
        ww, dd = 0.0028 + rnd.random() * 0.0046, 0.0023 + rnd.random() * 0.0032
        own(box("smd", (ww, dd, 0.0012), ((-0.083 + rnd.random() * 0.055) * sx, (-0.046 + rnd.random() * 0.078) * sy,
                                           by + 0.002), col, IM["chip"]), "board")
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            q = (sx_ * (pw / 2 - 0.008), sy_ * (pd / 2 - 0.008))
            own(cyl("standoff", 0.0028, by - zb, (q[0], q[1], (by + zb) / 2), col, IM["nickel"], 6, bev=0.0003), "board")
            own(cyl("washer", 0.0041, 0.0006, (q[0], q[1], by + 0.0017), col, IM["steel"], 32), "board")
    # cooler: fin stack over the SoC, cold plate, heat pipes, an open-frame fan on top
    cy = by + 0.0276
    for i in range(28):
        own(box("fin", (0.00115, 0.083 * sy, 0.023), (cpu.x - 0.046 + i * 0.00357, cpu.y, cy), col, IM["fin"]), "cooler")
    own(box("cold_plate", (0.046, 0.046, 0.0032), (cpu.x, cpu.y, by + 0.008), col, IM["fin"], 0.0005), "cooler")
    for i in range(4):
        y = cpu.y + (0.0345 - i * 0.0184) * sy
        pts = [(cpu.x - 0.018, y, by + 0.0092), (cpu.x + 0.041, y, by + 0.0104), (cpu.x + 0.067, y, cy - 0.0046),
               (cpu.x + 0.062, y, cy + 0.0092), (cpu.x, y, cy + 0.0092)]
        own(curve_obj("heat_pipe%d" % i, pts, col, IM["fin"], 0.0022, 3), "cooler")
    fy = cy + 0.0196
    fan_r = 0.0455 * min(sx, sy)
    own(cyl("fan_ring", fan_r + 0.004, 0.015, (cpu.x, cpu.y, fy), col, IM["fan"], 64, bev=0.0007), "cooler")
    own(cyl("fan_hub", 0.0143, 0.0115, (cpu.x, cpu.y, fy + 0.001), col, IM["fan"], 40, bev=0.0007), "cooler")
    own(cyl("fan_sticker", 0.0104, 0.0002, (cpu.x, cpu.y, fy + 0.0072), col, IM["label"], 40), "cooler")
    blades = empty("fan_blades", col, parts["cooler"], (cpu.x, cpu.y, fy))
    for i in range(7):
        arm = empty("fan_arm%d" % i, col, blades)
        arm.rotation_euler = (0, 0, 2 * math.pi * i / 7)
        bl = box("fan_blade", (fan_r - 0.014, 0.012, 0.0009), ((fan_r + 0.014) / 2, 0, 0), col, IM["fan"], 0.0003)
        bl.parent = arm
        bl.rotation_euler = (0.28, 0, 0)
    psu = prism("psu", rrect(0.115 * sx, 0.078 * sy, 0.002, 2), zb, 0.024, col, [IM["psu"]])
    bevel(psu, 0.0009, 2, 30)
    psu.location = (-0.028 * sx, 0.0046 * sy, 0)
    own(psu, "tray")
    for i in range(14):
        own(box("psu_slot", (0.0028, 0.046 * sy, 0.0005), ((-0.074 + i * 0.0069) * sx, 0.0046 * sy, zb + 0.0243), col, IM["black"]),
            "tray")
    D["blades"] = blades
    D["cpu"] = cpu
    D["board_z"] = by
    return D
