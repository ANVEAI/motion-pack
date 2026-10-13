# motion-pack/blender: the material library. Physically based Principled BSDF set-ups with procedural micro-structure
# only (no image files). Values are the launch film's calibrated ones,
# converted from box units to metres (object space is metres here: 1 box unit = 0.23 m).
#   matte_coat     machined powder coat: albedo 0.020 neutral, roughness 0.40-0.46, IOR level 0.6, sub-mm peel only
#   brushed_metal  anisotropic brushing, no marbling noise (it reads as ice cubes)
#   glass          clear / frosted dielectric (EEVEE: raytraced refraction, slab thickness, dithered)
#   ceramic        glazed body: base + clear coat
#   plastic        satin injection-moulded plastic with sub-mm roughness variation
#   chrome         polished metal (needs something to reflect: studio.world_reflection)
#   anodised       satin anodised aluminium, optional perforated vent field
#   emissive_band  frosted diffuser with a hot core (never a neon tube) + a left-to-right ignition sweep
#   floor_polished near-black studio floor whose reflection falls off round the product footprint
# MIT (see blender/LICENSE).
import math

import bpy

# brand violet #4A18ED: linear (0.082, 0.011, 1.0); the red is lifted so AgX keeps it violet, not blue (measured)
VIOLET_AGX = (0.20, 0.011, 1.0)
M_PER_BOX_UNIT = 0.23


# ------------------------------------------------------------------------------------------------ node helpers
def _new_mat(name):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:          # 5.x creates the tree; older builds need use_nodes
        m.use_nodes = True
    return m


def P(m):
    return m.node_tree.nodes["Principled BSDF"]


def nd(m, kind, **props):
    n = m.node_tree.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def ln(m, a, b):
    m.node_tree.links.new(a, b)


def coord(m, space="Object"):
    return nd(m, "ShaderNodeTexCoord").outputs[space]


def noise(m, vec, scale, detail=4.0, rough=0.5):
    n = nd(m, "ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    ln(m, vec, n.inputs["Vector"])
    return n.outputs["Fac"]


def maprange(m, val, a0, a1, b0, b1, clamp=True):
    r = nd(m, "ShaderNodeMapRange")
    r.clamp = clamp
    r.inputs["From Min"].default_value = a0
    r.inputs["From Max"].default_value = a1
    r.inputs["To Min"].default_value = b0
    r.inputs["To Max"].default_value = b1
    ln(m, val, r.inputs["Value"])
    return r.outputs["Result"]


def math_(m, op, a, b=None, clamp=False):
    n = nd(m, "ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            ln(m, v, n.inputs[i])
    return n.outputs[0]


def bump(m, height, strength, dist):
    b = nd(m, "ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = dist
    ln(m, height, b.inputs["Height"])
    return b.outputs["Normal"]


def mix_rgb(m, fac, a, b):
    """Mix two colours (tuples or sockets) by fac (float or socket). Returns the colour output socket."""
    x = nd(m, "ShaderNodeMix")
    x.data_type = "RGBA"
    for i, v in ((6, a), (7, b)):
        if isinstance(v, tuple):
            x.inputs[i].default_value = v if len(v) == 4 else (*v, 1.0)
        else:
            ln(m, v, x.inputs[i])
    if isinstance(fac, (int, float)):
        x.inputs[0].default_value = fac
    else:
        ln(m, fac, x.inputs[0])
    return x.outputs[2]


def value(m, name, v):
    n = nd(m, "ShaderNodeValue")
    n.name = name
    n.label = name
    n.outputs[0].default_value = v
    return n


def principled(name, color, rough, metal=0.0, **inputs):
    m = _new_mat(name)
    p = P(m)
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    for k, v in inputs.items():
        sock = p.inputs[k.replace("_", " ")]
        sock.default_value = (*v, 1.0) if isinstance(v, tuple) and len(v) == 3 else v
    return m


def micro(m, r_lo, r_hi, r_scale, b_scale, b_strength, b_dist):
    """Roughness varying at a sub-mm scale + a fine bump (powder-coat peel, bead blast). Scales are per metre."""
    v = coord(m)
    ln(m, maprange(m, noise(m, v, r_scale, 3.0), 0.3, 0.7, r_lo, r_hi), P(m).inputs["Roughness"])
    if b_strength > 0:
        ln(m, bump(m, noise(m, v, b_scale, 2.0, 0.55), b_strength, b_dist), P(m).inputs["Normal"])
    return m


# ------------------------------------------------------------------------------------------------ the library
def matte_coat(name, color=(0.020, 0.020, 0.020), rough=(0.40, 0.46), spec=0.6, peel=0.03):
    """No low-frequency colour or roughness noise (it reads as blotchy felt); roughness varies at
    0.5 mm, the orange peel is a 0.2 mm micro-bump. Any colour cast comes from the light, never the material."""
    k = 1.0 / M_PER_BOX_UNIT
    m = principled(name, color, sum(rough) / 2, Specular_IOR_Level=spec)
    return micro(m, rough[0], rough[1], 420.0 * k, 1100.0 * k, peel, 0.0006 * M_PER_BOX_UNIT)


def brushed_metal(name, color=(0.62, 0.63, 0.65), rough=0.28, aniso=0.5, rotation=0.0):
    return principled(name, color, rough, 1.0, Anisotropic=aniso, Anisotropic_Rotation=rotation)


def glass(name, color=(0.95, 0.95, 0.95), rough=0.03, ior=1.5):
    m = principled(name, color, rough, Transmission_Weight=1.0, IOR=ior)
    _eevee_transparent(m, refract=True)
    return m


def _eevee_transparent(m, refract=False):
    for k, v in (("use_raytrace_refraction", refract), ("thickness_mode", "SLAB"), ("surface_render_method", "DITHERED"),
                 ("use_transparent_shadow", True)):
        if hasattr(m, k):
            try:
                setattr(m, k, v)
            except (TypeError, ValueError):
                pass


def ceramic(name, color=(0.86, 0.85, 0.82), rough=0.32, coat=0.8, coat_rough=0.06):
    k = 1.0 / M_PER_BOX_UNIT
    m = principled(name, color, rough, Coat_Weight=coat, Coat_Roughness=coat_rough, Specular_IOR_Level=0.5)
    return micro(m, rough - 0.04, rough + 0.04, 60.0 * k, 0, 0, 0)


def plastic(name, color=(0.03, 0.03, 0.03), rough=0.42, spec=0.5):
    k = 1.0 / M_PER_BOX_UNIT
    m = principled(name, color, rough, Specular_IOR_Level=spec)
    return micro(m, rough - 0.05, rough + 0.06, 30.0 * k, 500.0 * k, 0.05, 0.0005 * M_PER_BOX_UNIT)


def chrome(name, color=(0.93, 0.93, 0.95), rough=0.035, aniso=0.0):
    return principled(name, color, rough, 1.0, Anisotropic=aniso)


def anodised(name, color=(0.026, 0.026, 0.028), rough=0.52, metal=0.15, spec=0.14, perf=None):
    """Satin anodised aluminium (a darkened lid top: less metallic, no white sheet). perf: a perforated vent
    field {pitch, hole (fraction of pitch), half: (hx, hy)} in object metres; holes dark and fully rough."""
    m = principled(name, color, rough, metal, Anisotropic=0.25, Specular_IOR_Level=spec)
    if not perf:
        return m
    v = coord(m)
    sep = nd(m, "ShaderNodeSeparateXYZ")
    ln(m, v, sep.inputs[0])
    pitch, rr = perf["pitch"], perf.get("hole", 0.31)
    hx, hy = perf["half"]
    fx = math_(m, "FRACT", math_(m, "DIVIDE", math_(m, "ADD", sep.outputs[0], hx), pitch))
    fy = math_(m, "FRACT", math_(m, "DIVIDE", math_(m, "ADD", sep.outputs[1], hy + 0.5 * pitch), pitch))
    dx, dy = math_(m, "SUBTRACT", fx, 0.5), math_(m, "SUBTRACT", fy, 0.5)
    d = math_(m, "SQRT", math_(m, "ADD", math_(m, "MULTIPLY", dx, dx), math_(m, "MULTIPLY", dy, dy)))
    hole = maprange(m, d, rr + 0.04, rr - 0.04, 0.0, 1.0)
    e = 0.0005
    inx = maprange(m, math_(m, "ABSOLUTE", sep.outputs[0]), hx + e, hx - e, 0, 1)
    iny = maprange(m, math_(m, "ABSOLUTE", sep.outputs[1]), hy + e, hy - e, 0, 1)
    mask = math_(m, "MULTIPLY", hole, math_(m, "MULTIPLY", inx, iny))
    ln(m, mix_rgb(m, mask, (*color, 1.0), (0.002, 0.002, 0.002, 1.0)), P(m).inputs["Base Color"])
    ln(m, maprange(m, mask, 0, 1, rough, 1.0), P(m).inputs["Roughness"])
    ln(m, maprange(m, mask, 0, 1, metal, 0.0), P(m).inputs["Metallic"])
    ln(m, bump(m, math_(m, "MULTIPLY", mask, -1.0), 0.6, 0.0009), P(m).inputs["Normal"])
    return m


def emission(name, color, strength):
    m = principled(name, (0.0, 0.0, 0.0), 0.4)
    P(m).inputs["Emission Color"].default_value = (*color, 1.0)
    P(m).inputs["Emission Strength"].default_value = strength
    return m


def pure_emission(name, color, strength=1.0):
    """Light only, additive: Emission + Transparent (no BSDF to catch the world or the lights, no occlusion).
    Returns (material, the Emission node's Strength socket)."""
    m = _new_mat(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")     # additive: the card itself never occludes what is behind it
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(em.outputs[0], add.inputs[0])
    nt.links.new(tr.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    for k, v in (("surface_render_method", "BLENDED"), ("use_transparent_shadow", True)):
        if hasattr(m, k):
            setattr(m, k, v)
    return m, em.inputs["Strength"]


def emissive_band(name, zc, half_h, x_span, edge=(1.0, 0.16, 0.0), core=(1.0, 0.30, 0.02), strength=1.25,
                  albedo=(0.22, 0.11, 0.05), edge_weight=0.32):
    """A frosted diffuser: a hot core along the centre line (gaussian in object Z, half-width half_h),
    the edge carrying edge_weight of the core, amber that never clips under AgX at strength ~1.25 (measured
    ~#ffa64d). Handles: 'level' (overall strength), 'ignite' (0 -> 1 left-to-right sweep over x_span), 'hot' (a
    travelling glint riding the sweep front). Returns (material, {'level', 'ignite', 'hot'} value nodes)."""
    m = principled(name, albedo, 0.5, Coat_Weight=0.35, Coat_Roughness=0.22)
    sep = nd(m, "ShaderNodeSeparateXYZ")
    ln(m, coord(m), sep.inputs[0])
    q = math_(m, "DIVIDE", math_(m, "SUBTRACT", sep.outputs[2], zc), half_h)
    prof = math_(m, "EXPONENT", math_(m, "MULTIPLY", math_(m, "MULTIPLY", q, q), -1.0))
    ln(m, mix_rgb(m, prof, (*edge, 1.0), (*core, 1.0)), P(m).inputs["Emission Color"])
    lvl = value(m, "level", strength)
    ign = value(m, "ignite", 1.0)
    hot = value(m, "hot", 0.0)
    soft = 0.22 * x_span / 1.3
    front = math_(m, "MULTIPLY", ign.outputs[0], x_span + soft)
    xl = math_(m, "ADD", sep.outputs[0], x_span / 2)
    mask = math_(m, "DIVIDE", math_(m, "SUBTRACT", front, xl), soft, clamp=True)
    dx = math_(m, "DIVIDE", math_(m, "SUBTRACT", math_(m, "SUBTRACT", front, 0.5 * soft), xl), 0.07 * x_span / 1.3)
    glint = math_(m, "ADD", math_(m, "MULTIPLY", math_(m, "EXPONENT", math_(m, "MULTIPLY", math_(m, "MULTIPLY", dx, dx), -1.0)),
                                  hot.outputs[0]), 1.0)
    s = math_(m, "MULTIPLY", maprange(m, prof, 0, 1, edge_weight, 1.0), lvl.outputs[0])
    ln(m, math_(m, "MULTIPLY", math_(m, "MULTIPLY", s, mask), glint), P(m).inputs["Emission Strength"])
    return m, {"level": lvl, "ignite": ign, "hot": hot}


def floor_polished(name, color=(0.009, 0.009, 0.0095), rough=0.12, half=(0.15, 0.115), falloff=0.11, spec=0.26):
    """Floor: polished near-black at the product, its reflection falling off to nothing ~1.5 product heights
    from the footprint (roughness up, specular down), so there is one soft pool and no grey sheet. 'fdim' fades it."""
    m = principled(name, color, rough, Specular_IOR_Level=0.5)
    sep = nd(m, "ShaderNodeSeparateXYZ")
    ln(m, coord(m), sep.inputs[0])
    dx = math_(m, "MAXIMUM", math_(m, "SUBTRACT", math_(m, "ABSOLUTE", sep.outputs[0]), half[0]), 0.0)
    dy = math_(m, "MAXIMUM", math_(m, "SUBTRACT", math_(m, "ABSOLUTE", sep.outputs[1]), half[1]), 0.0)
    d = math_(m, "SQRT", math_(m, "ADD", math_(m, "MULTIPLY", dx, dx), math_(m, "MULTIPLY", dy, dy)))
    fac = math_(m, "EXPONENT", math_(m, "MULTIPLY", d, -1.0 / falloff))
    fd = value(m, "fdim", 1.0)
    ln(m, math_(m, "MULTIPLY", math_(m, "ADD", math_(m, "MULTIPLY", fac, spec), 0.012), fd.outputs[0]),
       P(m).inputs["Specular IOR Level"])
    ln(m, math_(m, "ADD", math_(m, "MULTIPLY", math_(m, "SUBTRACT", 1.0, fac), 0.45), rough), P(m).inputs["Roughness"])
    return m


LIBRARY = {
    "matte_coat": matte_coat, "brushed_metal": brushed_metal, "glass": glass, "ceramic": ceramic, "plastic": plastic,
    "chrome": chrome, "anodised": anodised, "emission": emission,
}


def make(spec, name):
    """Build a library material from a spec dict {'mat': kind, ...kwargs}."""
    spec = dict(spec)
    kind = spec.pop("mat")
    if kind not in LIBRARY:
        raise KeyError("unknown material %r (have %s)" % (kind, ", ".join(sorted(LIBRARY))))
    return LIBRARY[kind](name, **spec)
