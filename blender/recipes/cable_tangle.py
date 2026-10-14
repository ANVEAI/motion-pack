# blender/cableTangle: a practical metaphor plate for "everything is connected" problems. A dark tabletop set: a
# seeded pile of bevelled cables knotted in the middle, each bulb cable running out of the knot to a warm clear-glass
# filament bulb on a socket. One cable (the feed, tinted) is pulled: in mode=off it slides out of the knot along its own
# path and the bulbs go out one after another on a plan; in mode=on it lifts and untangles and the bulbs come on in
# sequence. Only the pulled cable and its plug move; every bulb level is keyed per WHOLE frame from the plan (stagger,
# an explicit schedule, or a beats sidecar), and render.json carries the plan frames plus every bulb's screen position
# per frame so a test can measure the bulbs in the PNGs. Generic, original set (no reference footage copied).
# MIT (see blender/LICENSE).
import math
import random

import bpy
from mathutils import Vector

from lib import beats as BT, camera as CM, materials as MT, studio as ST
from lib.ease import E, seg, lerp
from lib.util import coll, cyl, obj_from

from . import _common as C

ID = "blender/cableTangle"
NAME = "Cable tangle and bulbs"
DOC = ("Dark set: a seeded tangle of cables feeding warm filament bulbs; one cable is pulled and the bulbs go out in "
       "sequence (mode=off) or light as it untangles (mode=on). Bulb frames come from a plan and are written to render.json.")
USE = ("The 'everything is connected' problem beat: one dependency pulled and the system goes dark; the fix beat with "
       "mode=on; pairs with an untangle diagram or a dependency graph; bulb-off frames sync to sfx hits via --beats.")
AVOID = ("Literal electrical advice (the set is a metaphor, not wiring); slots under ~3 s (the sequence needs air); "
         "fast cuts mid-sequence (the stagger is the point).")
LOOP = False
DEFAULTS = dict(seconds=5.0, size=(1920, 1080), engine="cycles")
LOOKS = {   # --preset: bulb filament / light colour (linear), glass glow tint, cable rubber, the pulled cable
    "tungsten": dict(light=(1.0, 0.46, 0.16), fil=(1.0, 0.55, 0.22), cable=(0.010, 0.010, 0.011), pulled=(0.20, 0.028, 0.020)),
    "amber": dict(light=(1.0, 0.33, 0.07), fil=(1.0, 0.42, 0.10), cable=(0.012, 0.010, 0.009), pulled=(0.16, 0.06, 0.02)),
    "daylight": dict(light=(1.0, 0.82, 0.62), fil=(1.0, 0.86, 0.70), cable=(0.010, 0.010, 0.012), pulled=(0.03, 0.06, 0.16)),
}
PARAMS = {
    "mode": {"type": "str", "default": "off", "doc": "off = pulled out, bulbs go out in sequence | on = untangles, bulbs light"},
    "bulbs": {"type": "int", "default": 5, "doc": "number of bulbs (2-9)"},
    "cables": {"type": "int", "default": 3, "doc": "extra loose cables through the knot (besides one per bulb and the feed)"},
    "pull_start": {"type": "int", "default": 24, "doc": "frame the pull starts (frames at the plate fps)"},
    "pull_frames": {"type": "int", "default": 40, "doc": "duration of the pull / untangle (frames)"},
    "pull": {"type": "float", "default": 0.0, "doc": "mode=off slide distance (m); 0 = the plug clears the knot"},
    "lag": {"type": "int", "default": 12, "doc": "frames from the pull start to the first bulb change"},
    "stagger": {"type": "int", "default": 12, "doc": "frames between bulb changes"},
    "schedule": {"type": "str", "default": "", "doc": "explicit change frames 'f1,f2,...' in sequence order (overrides lag/stagger/beats)"},
    "order": {"type": "str", "default": "ltr", "doc": "which bulb changes first: ltr | rtl | out (centre first) | in | seeded"},
    "flicker": {"type": "float", "default": 0.25, "doc": "mode=off: dip depth of the 2-frame stutter before a bulb dies (0 = clean cut)"},
    "bulb_w": {"type": "float", "default": 2.2, "doc": "light power per bulb (W)"},
    "filament": {"type": "float", "default": 60.0, "doc": "filament emission strength"},
    "glow": {"type": "float", "default": 0.35, "doc": "lit-glass glow strength"},
    "ambient": {"type": "float", "default": 1.0, "doc": "scale of the cool top + back light (keeps the dark set legible with the bulbs off)"},
    "radius_mm": {"type": "float", "default": 4.5, "doc": "cable radius (mm)"},
    "az": {"type": "float", "default": 8.0, "doc": "camera azimuth (deg, 0 = dead front)"},
    "el": {"type": "float", "default": 0.0, "doc": "camera elevation (deg; 0 = 24 wide / 34 tall)"},
    "lens": {"type": "float", "default": 40.0, "doc": "mm on a 24 mm vertical sensor"},
    "fstop": {"type": "float", "default": 5.6, "doc": "aperture (focus on the knot)"},
    "fill": {"type": "float", "default": 0.0, "doc": "set fill of the frame (0 = 0.84 wide / 0.86 tall)"},
    "push": {"type": "float", "default": 0.04, "doc": "slow push-in over the plate (fraction of the distance; 0 = locked off)"},
}
R_KNOT = (0.13, 0.085)       # knot half-extents (m)
BULB_H = 0.118               # glass height (m)


# ------------------------------------------------------------------------------------------------ polylines
def _cr(P, per=14):
    """Catmull-Rom through the design points (interpolating), as a dense polyline."""
    P = [Vector(p) for p in P]
    ext = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for k in range(per):
            t = k / float(per)
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1].copy())
    return out


def _cum(poly):
    c = [0.0]
    for a, b in zip(poly, poly[1:]):
        c.append(c[-1] + (b - a).length)
    return c


def _at(poly, cum, s):
    """Point at arc length s; beyond either end the line continues straight along the end tangent."""
    if s <= 0.0:
        d = (poly[0] - poly[1]).normalized()
        return poly[0] + d * (-s)
    if s >= cum[-1]:
        d = (poly[-1] - poly[-2]).normalized()
        return poly[-1] + d * (s - cum[-1])
    lo, hi = 0, len(cum) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if cum[mid] <= s:
            lo = mid
        else:
            hi = mid
    k = (s - cum[lo]) / max(1e-9, cum[hi] - cum[lo])
    return poly[lo].lerp(poly[hi], k)


def _resample(poly, step):
    cum = _cum(poly)
    n = max(4, int(round(cum[-1] / step)) + 1)
    return [_at(poly, cum, cum[-1] * i / (n - 1)) for i in range(n)]


def _resolve(cables, r, iters=3):
    """Over-under: each cable is laid on top of the cables before it (points closer than 2.1 r get lifted), then the
    lifts are smoothed along the cable so they read as humps. Deterministic (fixed order, grid hash)."""
    cell = 2.2 * r
    grid = {}
    gap = 2.1 * r
    for ci, pts in enumerate(cables):
        for _ in range(iters):
            lift = [0.0] * len(pts)
            for i, p in enumerate(pts):
                gx, gy = int(math.floor(p.x / cell)), int(math.floor(p.y / cell))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        for q in grid.get((gx + dx, gy + dy), ()):
                            dh = ((p.x - q.x) ** 2 + (p.y - q.y) ** 2) ** 0.5
                            if dh < gap and p.z < q.z + gap:
                                need = q.z + (gap * gap - dh * dh) ** 0.5 - p.z
                                lift[i] = max(lift[i], need)
            if max(lift) <= 1e-6:
                break
            w = 6
            sm = [max(lift[max(0, i - w):i + w + 1]) for i in range(len(pts))]
            sm = [sum(sm[max(0, i - w):i + w + 1]) / len(sm[max(0, i - w):i + w + 1]) for i in range(len(pts))]
            for i, p in enumerate(pts):
                p.z += max(lift[i], sm[i])
        for p in pts:
            grid.setdefault((int(math.floor(p.x / cell)), int(math.floor(p.y / cell))), []).append(p)
    return cables


def _nurbs(name, pts, col, mat, r, order=3):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    cu.twist_mode = "MINIMUM"
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for q, c in zip(sp.points, pts):
        q.co = (c.x, c.y, c.z, 1.0)
    sp.order_u = order
    sp.use_endpoint_u = True
    sp.resolution_u = 3
    sp.use_smooth = True
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    cu.materials.append(mat)
    return ob, sp


# ------------------------------------------------------------------------------------------------ the bulb
def _lathe(name, prof, col, mat, segs=40):
    """Surface of revolution of (r, z) pairs; the last pair with r = 0 closes the top with a pole."""
    pole = prof[-1][0] <= 1e-9
    ring = prof[:-1] if pole else prof
    n = len(ring)
    verts, faces = [], []
    for j in range(segs):
        a = 2.0 * math.pi * j / segs
        for rr, z in ring:
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for j in range(segs):
        j2 = (j + 1) % segs
        for i in range(n - 1):
            faces.append((j * n + i, j2 * n + i, j2 * n + i + 1, j * n + i + 1))
    if pole:
        verts.append((0.0, 0.0, prof[-1][1]))
        top = len(verts) - 1
        for j in range(segs):
            faces.append((j * n + n - 1, ((j + 1) % segs) * n + n - 1, top))
    return obj_from(name, verts, faces, col, [mat], smooth=True)


def _clear(m):
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    return nt, [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]


def _glass_mat(name, tint):
    """Thin clear bulb glass: transparent (shadow rays pass, so the light inside lights the set) + a dielectric
    reflection + a keyed warm glow for the lit look. Returns (material, glow strength socket)."""
    m = MT._new_mat(name)
    nt, out = _clear(m)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.94, 0.93, 0.91, 1.0)
    sp = nt.nodes.new("ShaderNodeBsdfPrincipled")
    sp.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    sp.inputs["Roughness"].default_value = 0.04
    sp.inputs["IOR"].default_value = 1.5
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*tint, 1.0)
    em.inputs["Strength"].default_value = 0.0
    a1 = nt.nodes.new("ShaderNodeAddShader")
    a2 = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], a1.inputs[0])
    nt.links.new(sp.outputs[0], a1.inputs[1])
    nt.links.new(a1.outputs[0], a2.inputs[0])
    nt.links.new(em.outputs[0], a2.inputs[1])
    nt.links.new(a2.outputs[0], out.inputs["Surface"])
    for k, v in (("surface_render_method", "BLENDED"), ("use_transparent_shadow", True)):
        if hasattr(m, k):
            setattr(m, k, v)
    return m, em.inputs["Strength"]


def _emit_mat(name, color):
    m = MT._new_mat(name)
    nt, out = _clear(m)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = 0.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m, em.inputs["Strength"]


GLASS = [(0.0125, 0.0), (0.0128, 0.010), (0.0175, 0.024), (0.0250, 0.040), (0.0300, 0.057), (0.0318, 0.072),
         (0.0302, 0.088), (0.0245, 0.102), (0.0155, 0.112), (0.0065, 0.1170), (0.0, 0.118)]


def _bulb(i, loc, scale, col, mats, look):
    """Bakelite base + brass collar + clear glass + filament on two leads + a point light at the filament."""
    x, y = loc
    base_h, collar_h = 0.026, 0.022
    z0 = base_h + collar_h
    base = cyl("bulb%d_base" % i, 0.028 * scale, base_h * scale, (x, y, base_h * scale / 2), col, mats["bakelite"], n=40, bev=0.0025)
    collar = cyl("bulb%d_collar" % i, 0.0135 * scale, collar_h * scale, (x, y, (base_h + collar_h / 2) * scale), col, mats["brass"], n=40,
                 r2=0.0128 * scale)
    gm, glow = _glass_mat("bulb%d_glass" % i, look["fil"])
    glass = _lathe("bulb%d_glass" % i, [(r * scale, z * scale) for r, z in GLASS], col, gm)
    glass.location = (x, y, z0 * scale)
    sub = glass.modifiers.new("smooth", "SUBSURF")
    sub.levels = sub.render_levels = 1
    fm, fil = _emit_mat("bulb%d_filament" % i, look["fil"])
    zc = (z0 + 0.060) * scale
    coil = []
    for k in range(161):
        t = k / 160.0
        a = 2.0 * math.pi * 11.0 * t
        coil.append(Vector((x + (-0.0095 + 0.019 * t) * scale, y + 0.0011 * scale * math.cos(a),
                            zc + (0.0011 * math.sin(a) + 0.006 * math.sin(math.pi * t)) * scale)))
    fob, _ = _nurbs("bulb%d_filament" % i, coil, col, fm, 0.00035 * scale, order=2)
    leads = []
    for sx in (-1.0, 1.0):
        pts = [Vector((x + sx * 0.004 * scale, y, (z0 + 0.004) * scale)), Vector((x + sx * 0.0095 * scale, y, zc))]
        lob, _ = _nurbs("bulb%d_lead%d" % (i, int(sx > 0)), pts, col, mats["lead"], 0.00045 * scale, order=2)
        leads.append(lob)
    L = bpy.data.lights.new("bulb%d_light" % i, "POINT")
    L.energy, L.color, L.shadow_soft_size = 0.0, look["light"], 0.008 * scale
    lo = bpy.data.objects.new("bulb%d_light" % i, L)
    col.objects.link(lo)
    lo.location = (x, y, zc)
    lo.visible_camera = False
    return {"light": L, "fil": fil, "glow": glow, "centre": Vector((x, y, (z0 + 0.06) * scale)),
            "top": Vector((x, y, (z0 + 0.118) * scale)), "base": Vector((x, y, 0.0)), "scale": scale,
            "objs": [base, collar, glass, fob] + leads}


def _plug(col, mats):
    body = cyl("plug_body", 0.0078, 0.028, (0, 0, 0), col, mats["plug"], n=28, bev=0.0015)
    for sx in (-1, 1):
        pr = cyl("plug_prong%d" % int(sx > 0), 0.0016, 0.016, (sx * 0.0035, 0.0, 0.020), col, mats["brass"], n=12)
        pr.parent = body
    body.rotation_mode = "QUATERNION"
    return body


# ------------------------------------------------------------------------------------------------ plan
def _int_list(s):
    return [int(round(float(x))) for x in str(s).replace("|", ",").split(",") if x.strip()]


def _plan(ctx, p, n, rng):
    """Bulb change frames: an explicit schedule > a beats sidecar > lag + stagger. Returns (frames by bulb, source)."""
    first = p["pull_start"] + p["lag"]
    src = "stagger"
    seq = None
    if p["schedule"]:
        seq = _int_list(p["schedule"])
        if len(seq) < n:
            raise SystemExit("schedule has %d frames for %d bulbs" % (len(seq), n))
        seq, src = seq[:n], "schedule"
    elif ctx.beats_path:
        B = BT.load(ctx.beats_path, ctx.fps, ctx.N, loop=False)
        hits = [int(round(h)) for h in B["hits"] if h >= first]
        seq = hits[:n]
        while len(seq) < n:
            seq.append((seq[-1] if seq else first - p["stagger"]) + p["stagger"])
        src = "beats (%s, %d hits at or after frame %d)" % (B["info"]["key"], len(hits), first)
    else:
        seq = [first + k * p["stagger"] for k in range(n)]
    idx = list(range(n))
    o = p["order"]
    if o == "rtl":
        idx = idx[::-1]
    elif o in ("out", "in"):
        mid = (n - 1) / 2.0
        idx = sorted(idx, key=lambda i: (abs(i - mid), i))
        if o == "in":
            idx = idx[::-1]
    elif o == "seeded":
        rng.shuffle(idx)
    elif o != "ltr":
        raise SystemExit("order must be ltr | rtl | out | in | seeded")
    frames = [0] * n
    for rank, b in enumerate(idx):
        frames[b] = int(seq[rank])
    return frames, src, idx


def level(mode, f, f0, flicker):
    """Bulb level 0..1 at whole frame f for a change at f0. off: full, a 2-frame stutter, then at f0 a drop to a
    short orange afterglow (0.32, decaying ~2 frames). on: dark until f0, then 0.7 rising to full (filament warm-up)."""
    if mode == "off":
        if f < f0:
            if flicker > 0 and f == f0 - 3:
                return 1.0 - flicker
            if flicker > 0 and f == f0 - 1:
                return 1.0 - 0.6 * flicker
            return 1.0
        return 0.32 * math.exp(-(f - f0) / 2.2)
    if f < f0:
        return 0.0
    return 1.0 - 0.3 * math.exp(-(f - f0) / 2.0)


def _project(s, p, W, H):
    pos = CM.position(s)
    q = (s["target"] - pos).normalized().to_track_quat("-Z", "Y")
    v = q.inverted() @ (Vector(p) - pos)
    k = s["lens"] / (CM.SENSOR_H / 2.0) * (H / 2.0)
    z = max(1e-6, -v.z)
    return (W / 2.0 + v.x / z * k, H / 2.0 - v.y / z * k), z


# ------------------------------------------------------------------------------------------------ build
def build(ctx):
    p = ctx.p
    if p["mode"] not in ("off", "on"):
        raise SystemExit("mode must be off or on")
    look = LOOKS.get(ctx.preset or "tungsten")
    if look is None:
        raise SystemExit("preset must be one of %s" % ", ".join(LOOKS))
    n = max(2, min(9, int(p["bulbs"])))
    r = p["radius_mm"] / 1000.0
    rng = random.Random(ctx.seed * 7919 + 101)
    ST.world_dark((0.0009, 0.0010, 0.0013))
    fm = MT.principled("tabletop", (0.016, 0.015, 0.014), 0.42, Specular_IOR_Level=0.45)
    MT.micro(fm, 0.36, 0.5, 40.0, 900.0, 0.03, 0.0004)
    ST.cyclorama(coll("set"), mat=fm, width=10.0, front=-4.0, wall=3.2, radius=1.4)
    mats = {"cable": MT.principled("cable_rubber", look["cable"], 0.36, Specular_IOR_Level=0.55),
            "pulled": MT.principled("cable_pulled", look["pulled"], 0.34, Specular_IOR_Level=0.55),
            "bakelite": MT.plastic("bakelite", (0.012, 0.011, 0.010), 0.3, 0.6),
            "brass": MT.brushed_metal("brass", (0.80, 0.56, 0.28), 0.3, 0.2),
            "lead": MT.principled("lead_wire", (0.6, 0.55, 0.5), 0.3, 1.0),
            "plug": MT.plastic("plug", (0.020, 0.019, 0.018), 0.35, 0.5)}
    # layout: the knot in front, the bulbs on an arc behind it (9:16: a deeper, narrower two-row arc)
    kc = Vector((0.0, -0.03, 0.0))
    bulbs, cb = [], coll("bulbs")
    for i in range(n):
        u = i / float(n - 1) - 0.5
        if ctx.tall:
            a = math.radians(64.0 * u + rng.uniform(-3, 3))
            R = (0.34 if i % 2 == 0 else 0.56) * (1.0 + rng.uniform(-0.05, 0.05))
        else:
            a = math.radians(122.0 * u + rng.uniform(-4, 4))
            R = 0.40 * (1.0 + rng.uniform(-0.08, 0.08))
        loc = (kc.x + R * math.sin(a), kc.y + R * math.cos(a))
        bulbs.append(_bulb(i, loc, rng.uniform(0.92, 1.08), cb, mats, look))
    # cables: bulb cables (socket -> knot, ends buried), loose cables (frame edge -> knot -> frame edge), the feed
    def knot_walk(m, z_hi):
        th, d = rng.uniform(0, 2 * math.pi), rng.choice((-1.0, 1.0))
        out = []
        for _ in range(m):
            th += d * math.radians(rng.uniform(95.0, 150.0))
            rr = rng.uniform(0.3, 1.0)
            out.append(Vector((kc.x + R_KNOT[0] * rr * math.cos(th), kc.y + R_KNOT[1] * rr * math.sin(th),
                               rng.uniform(r, z_hi))))
        return out

    def entry(towards, k=1.0):
        d = (Vector(towards) - kc)
        d.z = 0.0
        d.normalize()
        return kc + Vector((d.x * R_KNOT[0] * k, d.y * R_KNOT[1] * k, r))

    designs, kinds = [], []
    for b in bulbs:
        s = b["base"] + (kc - b["base"]).normalized() * 0.012
        s.z = r
        e = entry(b["base"], 1.1)
        mid = s.lerp(e, 0.5)
        side = Vector((-(e - s).y, (e - s).x, 0.0)).normalized()
        mid += side * rng.uniform(-0.05, 0.05)
        mid.z = r
        designs.append([s, mid, e] + knot_walk(rng.randint(3, 5), 0.035))
        kinds.append("bulb")
    for j in range(max(0, int(p["cables"]))):
        a0 = math.radians(rng.uniform(-150, -30) if j % 2 == 0 else rng.uniform(150, 210))
        a1 = a0 + math.radians(rng.uniform(70, 160)) * rng.choice((-1, 1))
        far = lambda a: kc + Vector((1.3 * math.cos(a), 1.1 * math.sin(a), r))
        designs.append([far(a0), entry(far(a0), 1.6)] + knot_walk(rng.randint(3, 5), 0.045) + [entry(far(a1), 1.6), far(a1)])
        kinds.append("loose")
    ex = kc + Vector((-0.95, -0.75, r))                       # the feed leaves the frame front-left (camera side)
    feed = [ex, kc + Vector((-0.42, -0.30, r)), entry(kc + Vector((-0.42, -0.30, 0)), 1.2)] + knot_walk(7, 0.03)
    designs.append(feed)
    kinds.append("feed")
    polys = []
    for d in designs:
        poly = _resample(_cr(d), 0.007)
        for q in poly:
            q.z = max(q.z, r)
        polys.append(poly)
    _resolve(polys, r)                                       # the feed is laid last: it sits on top, so it slides free
    cc = coll("cables")
    for k, (poly, kind) in enumerate(zip(polys[:-1], kinds[:-1])):
        _nurbs("cable%02d_%s" % (k, kind), poly, cc, mats["cable"], r)
    # the pulled feed: a fixed resolved path; the cable's control points ride along it (mode off) or blend to a
    # relaxed route lifted over the pile (mode on)
    path = polys[-1]
    cum = _cum(path)
    Lf = cum[-1]
    s_entry = _cum(_resample(_cr(feed[:3]), 0.007))[-1]       # arc length from the frame edge to the knot
    nctl = max(24, int(Lf / 0.014))
    s_ctl = [Lf * i / (nctl - 1) for i in range(nctl)]
    pob, psp = _nurbs("cable_pulled", [_at(path, cum, s) for s in s_ctl], cc, mats["pulled"], r * 1.05)
    knot_len = Lf - s_entry
    pull = p["pull"] if p["pull"] > 0 else knot_len + 0.16
    relaxed = None
    if p["mode"] == "on":
        rd = [ex, kc + Vector((-0.42, -0.30, r)), kc + Vector((-0.12, -0.24, r)), kc + Vector((0.16, -0.26, r)),
              kc + Vector((0.42, -0.36, r)), kc + Vector((0.8, -0.55, r))]
        rp = _resample(_cr(rd), 0.007)
        rcum = _cum(rp)
        relaxed = [_at(rp, rcum, s) for s in s_ctl]             # same arc lengths: the cable keeps its length
    plug = _plug(cc, mats)
    # bulb plan + the measurement aids
    frames, src, seq = _plan(ctx, p, n, rng)
    lift = max(q.z for poly in polys for q in poly) + 0.035
    # light: a dim cool top and a cool back rim (the set stays readable with every bulb out)
    cl = coll("lights")
    amb = p["ambient"]
    ST.area("top", cl, (1.6, 1.2), (0.1, -0.1, 2.0), (0.0, 0.05, 0.0), 9.0 * amb, (0.80, 0.87, 1.0), 90)
    ST.area("rim", cl, (2.0, 0.3), (0.0, 1.5, 0.75), (0.0, 0.0, 0.03), 14.0 * amb, (0.78, 0.86, 1.0), 70)
    # camera: fit every bulb, the knot and the plug's way out (projected), centred
    el = p["el"] or (34.0 if ctx.tall else 24.0)
    pts = [b["top"] for b in bulbs] + [b["base"].copy() for b in bulbs]
    pts += [kc + Vector((sx * R_KNOT[0] * 1.3, sy * R_KNOT[1] * 1.3, 0.0)) for sx in (-1, 1) for sy in (-1, 1)]
    cx = sum(q.x for q in pts) / len(pts)
    cy = sum(q.y for q in pts) / len(pts)
    tgt = Vector((cx, cy, 0.05))
    fill = p["fill"] or (0.86 if ctx.tall else 0.84)

    def fits(d):
        s = CM.state(target=tgt, az=p["az"], el=el, dist=d, lens=p["lens"], fstop=p["fstop"])
        for q in pts:
            (px, py), _ = _project(s, q, ctx.W, ctx.H)
            if abs(px - ctx.W / 2.0) > fill * ctx.W / 2.0 or abs(py - ctx.H / 2.0) > fill * ctx.H / 2.0:
                return False
        return True
    lo_d, hi_d = 0.2, 12.0
    for _ in range(40):
        mid = 0.5 * (lo_d + hi_d)
        lo_d, hi_d = (lo_d, mid) if fits(mid) else (mid, hi_d)
    s0 = CM.state(target=tgt, az=p["az"], el=el, dist=hi_d, lens=p["lens"], fstop=p["fstop"])
    s0["focus"] = kc + Vector((0, 0, 0.03))
    ctx.report["plan"] = {"mode": p["mode"], "source": src, "order": p["order"], "sequence": seq,
                          "change_frames": frames, "pull_start": p["pull_start"], "pull_frames": p["pull_frames"],
                          "pull_m": round(pull, 3) if p["mode"] == "off" else None,
                          "rule": ("off: a bulb is out from its change frame on (level <= 0.32, afterglow); "
                                   "on: lit from its change frame on (level >= 0.7)")}
    late = [f for f in frames if f >= ctx.N]
    if late:
        ctx.report["plan"]["warning"] = "change frames %s are past the last frame %d" % (late, ctx.N - 1)
    ctx.report["bulbs"] = [{"i": i, "world": [round(v, 4) for v in b["centre"]], "change_frame": frames[i]}
                           for i, b in enumerate(bulbs)]
    ctx.report["bulb_px"] = []
    ctx.report["cables"] = {"bulb": n, "loose": max(0, int(p["cables"])), "feed_m": round(Lf, 3), "knot_m": round(knot_len, 3)}
    ctx.report["look"] = ctx.preset or "tungsten"
    return {"bulbs": bulbs, "frames": frames, "psp": psp, "path": path, "cum": cum, "s_ctl": s_ctl, "pull": pull,
            "relaxed": relaxed, "lift": lift, "plug": plug, "cam": CM.make(), "s0": s0, "Lf": Lf, "s_entry": s_entry,
            "note": "dist %.3f m, el %.1f, %d bulbs" % (hi_d, el, n)}


# ------------------------------------------------------------------------------------------------ per frame
def _feed_points(H, p, f):
    u = seg(f, p["pull_start"], p["pull_start"] + p["pull_frames"])
    path, cum, s_ctl = H["path"], H["cum"], H["s_ctl"]
    if p["mode"] == "off":
        d = H["pull"] * E["move"](u)
        taut = math.sin(math.pi * u)                         # the outside run lifts a little while it is under tension
        out = []
        for s in s_ctl:
            q = _at(path, cum, s - d)
            sp = s - d
            if 0.0 < sp < H["s_entry"]:
                q = q + Vector((0.0, 0.0, 0.012 * taut * math.sin(math.pi * sp / H["s_entry"])))
            out.append(q)
        return out
    out = []
    n = len(s_ctl)
    for i, s in enumerate(s_ctl):
        a = 0.55 * i / float(max(1, n - 1))                  # the untangle runs from the pulled end inward
        k = E["move"](seg(u, a, a + 0.45))
        q = _at(path, cum, s).lerp(H["relaxed"][i], k)
        q.z += (H["lift"] - q.z) * math.sin(math.pi * k) if k < 1.0 else 0.0
        out.append(q)
    return out


def frame(H, ctx, f, K):
    p = ctx.p
    pts = _feed_points(H, p, f)
    for q, c in zip(H["psp"].points, pts):
        K.set(q, "co", (c.x, c.y, c.z, 1.0))
    tip, prev = pts[-1], pts[-2]
    tdir = (tip - prev).normalized()
    K.set(H["plug"], "location", tip + tdir * 0.010)
    qn = tdir.to_track_quat("Z", "Y")
    if H.get("q_prev") is not None and qn.dot(H["q_prev"]) < 0:   # keep one hemisphere so keys interpolate the short way
        qn.negate()
    H["q_prev"] = qn.copy()
    K.set(H["plug"], "rotation_quaternion", qn)
    for b, f0 in zip(H["bulbs"], H["frames"]):
        lv = level(p["mode"], f, f0, p["flicker"])
        K.set(b["light"], "energy", p["bulb_w"] * lv)
        K.set(b["fil"], "default_value", p["filament"] * lv)
        K.set(b["glow"], "default_value", p["glow"] * lv)
    s = CM.push_in(H["s0"], C.u_of(ctx, f), 1.0 - p["push"], "sine") if p["push"] else H["s0"]
    CM.apply(H["cam"], s, K)
    if 0 <= f < ctx.N:                                       # measurement aid: each bulb's glass centre on screen
        row = []
        for b in H["bulbs"]:
            (px, py), z = _project(s, b["centre"], ctx.W, ctx.H)
            rad = 0.026 * b["scale"] * s["lens"] / (CM.SENSOR_H / 2.0) * (ctx.H / 2.0) / z
            row.append([round(px, 1), round(py, 1), round(rad, 1)])
        ctx.report["bulb_px"].append(row)
