# motion-pack/blender: a procedural multi-part hero model (primitive geometry only) plus the two things the round-3
# recipes do with it: render-pass materials (wireframe -> x-ray -> clay -> full material, wiped across the model by
# one keyed stage value) and a knolling layout (every part laid flat in a tidy overhead grid).
#
# The model ("flyer") is a stylised single-prop aircraft of 21 separate parts: fuselage, cowling, spinner, 3 blades,
# wings, ailerons, tailplanes, fin, rudder, canopy, gear struts, wheels and a tail skid. It is generic on purpose:
# no real aircraft, livery or markings. Each part's mesh is built axis-aligned around its own centre, so the part's
# rotation is its pose and its local extents are its true size (the knolling grid relies on both).
# Coordinates: metres, z up, the nose points -Y (the pack's "faces the camera at az 0"), span along X (~0.66 m).
# MIT (see blender/LICENSE).
import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

from . import materials as MT
from .util import obj_from, bevel

D2R = math.pi / 180.0
WIRE = (0.62, 0.86, 1.0)       # the wireframe / x-ray line colour (cool white-blue, reads on dark and on clay)


# ------------------------------------------------------------------------------------------------ mesh generators
def _ccw(pts):
    a = 0.5 * sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1]))
    return pts if a > 0 else pts[::-1]


def g_slab(pts, thick):
    """closed 2D outline (x, y) extruded through z = -thick/2 .. +thick/2"""
    pts = _ccw(list(pts))
    n = len(pts)
    v = [(x, y, -thick / 2) for x, y in pts] + [(x, y, thick / 2) for x, y in pts]
    f = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return v, f


def g_vslab(pts_yz, thick):
    """an outline in the YZ plane extruded through x = -thick/2 .. +thick/2 (fins, rudders)"""
    v, f = g_slab([(p, q) for p, q in pts_yz], thick)
    return [(z, x, y) for x, y, z in v], f


def g_box(dx, dy, dz):
    return g_slab([(-dx / 2, -dy / 2), (dx / 2, -dy / 2), (dx / 2, dy / 2), (-dx / 2, dy / 2)], dz)


def g_cyl(r, h, n=24, r2=None):
    """along local Z, centred; r at -Z, r2 at +Z (a taper)"""
    r2 = r if r2 is None else r2
    v = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), -h / 2) for i in range(n)]
    v += [(r2 * math.cos(2 * math.pi * i / n), r2 * math.sin(2 * math.pi * i / n), h / 2) for i in range(n)]
    f = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return v, f


def g_ellipsoid(rx, ry, rz, u=20, w=10):
    v = [(0.0, 0.0, -rz)]
    for j in range(1, w):
        th = math.pi * j / w - math.pi / 2
        for i in range(u):
            ph = 2 * math.pi * i / u
            v.append((rx * math.cos(th) * math.cos(ph), ry * math.cos(th) * math.sin(ph), rz * math.sin(th)))
    v.append((0.0, 0.0, rz))
    f = [(0, 1 + (i + 1) % u, 1 + i) for i in range(u)]
    for j in range(w - 2):
        a, b = 1 + j * u, 1 + (j + 1) * u
        f += [(a + i, a + (i + 1) % u, b + (i + 1) % u, b + i) for i in range(u)]
    top, last = len(v) - 1, 1 + (w - 2) * u
    f += [(last + i, last + (i + 1) % u, top) for i in range(u)]
    return v, f


def _shift(v, d):
    return [(x + d[0], y + d[1], z + d[2]) for x, y, z in v]


def _mirror(pts):
    return [(-x, y) for x, y in pts]


# ------------------------------------------------------------------------------------------------ the model
def flyer_spec(dihedral=5.0):
    """(name, kind, (verts, faces), frame origin, frame rotation deg, look). Verts are in the part's frame; the frame is
    placed at origin with rotation; build() re-centres every mesh on its own bounding-box centre."""
    hub = (0.0, -0.31, 0.16)
    wing = [(0.0, -0.075), (0.30, -0.05), (0.30, 0.035), (0.0, 0.065)]
    ail = [(0.17, 0.049), (0.29, 0.037), (0.29, 0.057), (0.17, 0.069)]
    tail = [(0.0, -0.03), (0.11, -0.01), (0.11, 0.03), (0.0, 0.04)]
    S = [
        ("fuselage", "cyl", g_cyl(0.046, 0.46, 28, 0.022), (0, -0.02, 0.16), (-90, 0, 0), "body"),
        ("cowling", "cyl", g_cyl(0.053, 0.07, 28, 0.050), (0, -0.265, 0.16), (-90, 0, 0), "accent"),
        ("spinner", "cyl", g_cyl(0.026, 0.05, 20, 0.004), (0, -0.325, 0.16), (90, 0, 0), "metal"),
        ("canopy", "round", g_ellipsoid(0.032, 0.07, 0.034), (0, -0.07, 0.198), (0, 0, 0), "glass"),
        ("wing_r", "slab", g_slab(wing, 0.014), (0.03, -0.04, 0.13), (0, -dihedral, 0), "body"),
        ("wing_l", "slab", g_slab(_mirror(wing), 0.014), (-0.03, -0.04, 0.13), (0, dihedral, 0), "body"),
        ("aileron_r", "slab", g_slab(ail, 0.008), (0.03, -0.04, 0.13), (0, -dihedral, 0), "accent"),
        ("aileron_l", "slab", g_slab(_mirror(ail), 0.008), (-0.03, -0.04, 0.13), (0, dihedral, 0), "accent"),
        ("tailplane_r", "slab", g_slab(tail, 0.009), (0.015, 0.17, 0.168), (0, 0, 0), "body"),
        ("tailplane_l", "slab", g_slab(_mirror(tail), 0.009), (-0.015, 0.17, 0.168), (0, 0, 0), "body"),
        ("fin", "slab", g_vslab([(-0.03, 0.0), (0.06, 0.0), (0.06, 0.11), (0.02, 0.11)], 0.009), (0, 0.15, 0.178), (0, 0, 0), "body"),
        ("rudder", "slab", g_vslab([(0.06, 0.0), (0.088, 0.004), (0.082, 0.10), (0.06, 0.11)], 0.008), (0, 0.15, 0.178), (0, 0, 0), "accent"),
        ("strut_r", "slab", g_box(0.008, 0.014, 0.10), (0.072, -0.15, 0.085), (0, -12, 0), "metal"),
        ("strut_l", "slab", g_box(0.008, 0.014, 0.10), (-0.072, -0.15, 0.085), (0, 12, 0), "metal"),
        ("wheel_r", "cyl", g_cyl(0.03, 0.018, 22), (0.085, -0.15, 0.03), (0, 90, 0), "tyre"),
        ("wheel_l", "cyl", g_cyl(0.03, 0.018, 22), (-0.085, -0.15, 0.03), (0, 90, 0), "tyre"),
        ("tail_skid", "slab", g_box(0.006, 0.008, 0.11), (0, 0.2, 0.075), (-18, 0, 0), "metal"),
    ]
    for k in range(3):                                   # blades: built along local Z, pivoting on the hub
        th = 120.0 * k + 15.0
        v, f = g_box(0.02, 0.005, 0.15)
        S.append(("blade_%d" % k, "slab", (_shift(v, (0, 0, 0.085)), f), hub, (0, th, 0), "blade"))
    return S, {"hub": hub, "span": 0.66, "length": 0.66, "height": 0.25}


LOOKS = {   # name -> principled kwargs for the "full" pass (linear colours; AgX look in render)
    "body": dict(color=(0.62, 0.57, 0.48), rough=0.38, metal=0.0, coat=0.5),
    "accent": dict(color=MT.VIOLET_AGX, rough=0.32, metal=0.0, coat=0.6),
    "metal": dict(color=(0.6, 0.6, 0.62), rough=0.25, metal=1.0, coat=0.0),
    "blade": dict(color=(0.03, 0.03, 0.032), rough=0.35, metal=0.0, coat=0.0),
    "tyre": dict(color=(0.015, 0.015, 0.015), rough=0.7, metal=0.0, coat=0.0),
    "glass": dict(color=(0.05, 0.06, 0.08), rough=0.05, metal=0.0, coat=1.0),
}


def full_material(name, look, body=None, accent=None):
    L = dict(LOOKS[look])
    if look == "body" and body:
        L["color"] = tuple(body)
    if look == "accent" and accent:
        L["color"] = tuple(accent)
    return MT.principled(name, L["color"], L["rough"], L["metal"], Coat_Weight=L["coat"], Coat_Roughness=0.08)


def build(col, mat_for, dihedral=5.0, bevel_w=0.0015):
    """Build the flyer. mat_for(part_name, look) -> material. Returns {'parts': [...], 'info': {...}}; each part is a
    dict with ob, look, home_loc (Vector), home_rot (Quaternion), extents (local x, y, z sizes)."""
    spec, info = flyer_spec(dihedral)
    parts = []
    for name, kind, (v, f), origin, rot, look in spec:
        xs, ys, zs = zip(*v)
        c = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
        v = [(x - c.x, y - c.y, z - c.z) for x, y, z in v]
        R = Euler(tuple(a * D2R for a in rot), "XYZ").to_matrix()
        ob = obj_from(name, v, f, col, [mat_for(name, look)], smooth=(kind != "slab"))
        if kind == "slab" and bevel_w > 0:
            bevel(ob, bevel_w, 2, 30)
        elif kind == "cyl":
            for p in (ob.data.polygons[0], ob.data.polygons[1]):
                p.use_smooth = False
            m = ob.modifiers.new("sharp", "EDGE_SPLIT")
            m.split_angle = math.radians(40)
        ob.rotation_mode = "QUATERNION"
        q = R.to_quaternion()
        loc = Vector(origin) + R @ c
        ob.location, ob.rotation_quaternion = loc, q
        ext = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        parts.append({"name": name, "ob": ob, "look": look, "home_loc": loc.copy(), "home_rot": q.copy(), "extents": ext})
    info["centre"] = Vector((0.0, -0.04, 0.12))
    return {"parts": parts, "info": info}


# ------------------------------------------------------------------------------------------------ render passes
class _Tree:
    """lets the materials.py node helpers (which expect m.node_tree) build inside a node group"""
    def __init__(self, nt):
        self.node_tree = nt


def pass_group(x0, x1, soft=0.35, name="mpb_pass"):
    """One shader node group shared by every pass material. Inputs: none. Keyed value node 'stage' (0 wire, 1 x-ray,
    2 clay, 3 full; fractions are mid-wipe). Outputs a01, a12, a23: per-pixel blend weights of each step, wiped
    left to right across world X (x0 -> x1) with a soft edge, so a stage change sweeps across the model."""
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    for o in ("a01", "a12", "a23"):
        g.interface.new_socket(o, in_out="OUTPUT", socket_type="NodeSocketFloat")
    T = _Tree(g)
    out = g.nodes.new("NodeGroupOutput")
    st = MT.value(T, "stage", 0.0)
    geo = MT.nd(T, "ShaderNodeNewGeometry")
    sep = MT.nd(T, "ShaderNodeSeparateXYZ")
    MT.ln(T, geo.outputs["Position"], sep.inputs[0])
    xn = MT.maprange(T, sep.outputs[0], x0, x1, 0.0, 1.0)
    for k, o in enumerate(("a01", "a12", "a23")):
        p = MT.math_(T, "SUBTRACT", st.outputs[0], float(k))
        e = MT.math_(T, "SUBTRACT", MT.math_(T, "MULTIPLY", p, 1.0 + soft), xn)
        MT.ln(T, MT.math_(T, "DIVIDE", e, soft, clamp=True), out.inputs[o])
    return g, st


def _group_node(m, g):
    n = m.node_tree.nodes.new("ShaderNodeGroup")
    n.node_tree = g
    return n


def _shader_out(m):
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    return [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]


def _mix(m, fac, a, b):
    x = m.node_tree.nodes.new("ShaderNodeMixShader")
    m.node_tree.links.new(fac, x.inputs[0])
    m.node_tree.links.new(a, x.inputs[1])
    m.node_tree.links.new(b, x.inputs[2])
    return x.outputs[0]


def pass_material(name, g, look, body=None, accent=None, clay=(0.42, 0.42, 0.43), xray=WIRE, xray_gain=1.2):
    """shell material: transparent (wire stage) -> x-ray (rim-weighted emissive coverage) -> clay -> full principled"""
    full = full_material(name, look, body, accent)
    m = full
    nt = m.node_tree
    pb = MT.P(m)
    out = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    gn = _group_node(m, g)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    em = nt.nodes.new("ShaderNodeEmission")       # x-ray: coverage = facing ratio (EEVEE dithered transparency drops the
    em.inputs["Color"].default_value = (*xray, 1.0)  # emission of a fully transparent add-shader, so mix by coverage instead)
    em.inputs["Strength"].default_value = xray_gain
    tr2 = nt.nodes.new("ShaderNodeBsdfTransparent")
    cov = MT.math_(m, "ADD", MT.math_(m, "POWER", lw.outputs["Facing"], 1.4), 0.06, clamp=True)
    xr = _mix(m, cov, tr2.outputs[0], em.outputs[0])
    cl = nt.nodes.new("ShaderNodeBsdfPrincipled")
    cl.inputs["Base Color"].default_value = (*clay, 1.0)
    cl.inputs["Roughness"].default_value = 0.62
    s = _mix(m, gn.outputs["a01"], tr.outputs[0], xr)
    s = _mix(m, gn.outputs["a12"], s, cl.outputs[0])
    s = _mix(m, gn.outputs["a23"], s, pb.outputs[0])
    MT.ln(m, s, out.inputs["Surface"])
    for k, v in (("use_transparent_shadow", True),):
        if hasattr(m, k):
            setattr(m, k, v)
    return m


def wire_material(g, color=WIRE, strength=2.0, name="mpb_wire"):
    """the wireframe line: full at stage 0, ~35 % through the x-ray stage, gone by clay"""
    m = MT._new_mat(name)
    out = _shader_out(m)
    nt = m.node_tree
    gn = _group_node(m, g)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    vis = MT.math_(m, "SUBTRACT", MT.math_(m, "SUBTRACT", 1.0, MT.math_(m, "MULTIPLY", gn.outputs["a01"], 0.65)),
                   MT.math_(m, "MULTIPLY", gn.outputs["a12"], 0.35), clamp=True)
    MT.ln(m, _mix(m, vis, tr.outputs[0], em.outputs[0]), out.inputs["Surface"])
    if hasattr(m, "use_transparent_shadow"):
        m.use_transparent_shadow = True
    return m


def add_wires(parts, col, mat, thickness=0.0016):
    """a wireframe twin of every part (same mesh data, no bevel, WIREFRAME modifier): the model's real topology"""
    out = []
    for p in parts:
        src = p["ob"]
        ob = bpy.data.objects.new(src.name + ".wire", src.data.copy())
        col.objects.link(ob)
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        ob.rotation_mode = "QUATERNION"
        ob.location, ob.rotation_quaternion = src.location.copy(), src.rotation_quaternion.copy()
        w = ob.modifiers.new("wire", "WIREFRAME")
        w.thickness = thickness
        w.use_even_offset = True
        w.use_replace = True
        out.append(ob)
    return out


# ------------------------------------------------------------------------------------------------ knolling
def flat_rotation(ext):
    """Quaternion that lays a part flat: its longest local axis on world X, the shortest on world Z (proper rotation)"""
    order = sorted(range(3), key=lambda i: -ext[i])
    cols = [None, None, None]
    for local, world in zip(order, ((1, 0, 0), (0, 1, 0), (0, 0, 1))):
        cols[local] = Vector(world)
    M = Matrix((cols[0], cols[1], cols[2])).transposed()
    if M.determinant() < 0:
        cols[order[1]] = -cols[order[1]]
        M = Matrix((cols[0], cols[1], cols[2])).transposed()
    return M.to_quaternion()


def knolling_layout(parts, gap=0.03, aspect=16 / 9.0):
    """Shelf-pack every part, laid flat, into rows (largest first; twins next to each other), centred on the origin.
    Adds to each part: flat_rot, slot (Vector, z = half its thinnest extent), order. Returns (half_w, half_d)."""
    rows, area = [], 0.0
    items = []
    for i, p in enumerate(parts):
        e = sorted(p["extents"], reverse=True)
        items.append((round(e[0] * e[1], 5), p["name"].rstrip("_lr0123"), i, e))
        area += (e[0] + gap) * (e[1] + gap)
    items.sort(key=lambda it: (-it[0], it[1], it[2]))
    width = max(max(it[3][0] for it in items), math.sqrt(area * aspect) * 1.02)
    x, row = 0.0, []
    for it in items:
        if row and x + it[3][0] > width:
            rows.append(row)
            row, x = [], 0.0
        row.append(it)
        x += it[3][0] + gap
    rows.append(row)
    y, placed, maxw = 0.0, [], 0.0
    for r in rows:
        depth = max(it[3][1] for it in r)
        x = 0.0
        for it in r:
            placed.append((it[2], x + it[3][0] / 2, y + depth / 2, it[3][2] / 2))
            x += it[3][0] + gap
        maxw = max(maxw, x - gap)
        y += depth + gap
    tot_d = y - gap
    for k, (i, px, py, pz) in enumerate(placed):
        p = parts[i]
        p["flat_rot"] = flat_rotation(p["extents"])
        p["slot"] = Vector((px - maxw / 2, tot_d / 2 - py, pz))      # first row at the top of frame (+Y, far side)
        p["order"] = k
    return maxw / 2, tot_d / 2


def pose(p, K, loc, rot):
    K.set(p["ob"], "location", Vector(loc))
    K.set(p["ob"], "rotation_quaternion", Quaternion(rot))
