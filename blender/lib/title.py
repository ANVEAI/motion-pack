# motion-pack/blender: 3D extruded titles. One mesh per glyph (so letters animate on their own), laid out with
# Blender's own advances (measured: width('|' + prefix + '|') - width('||'), kerning included), extruded and bevelled,
# then converted to meshes so the caps and the sides can carry different materials (chrome face, violet sides...).
# Fonts: the pack's OFL fonts (motion-pack/templates/_shared/fonts). Blender loads a variable font at its DEFAULT
# instance (Manrope-Variable = ExtraLight 200, measured in 5.2.2), so a static instance at the requested weight is cut
# with fontTools (system python3) into a cache folder at run time; without fontTools the variable font is used with a
# thickening curve offset (reported in render.json). MIT (see blender/LICENSE).
import hashlib
import math
import os
import shutil
import subprocess

import bpy
import bmesh
from mathutils import Vector

from . import materials as MT

_IN_PACK = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates", "_shared", "fonts")
# inside the pack (blender/lib) the fonts sit at ../../templates/_shared/fonts; MPB_FONTS overrides the folder
PACK_FONTS = os.environ.get("MPB_FONTS", _IN_PACK)
DEFAULT_FONT = os.path.join(PACK_FONTS, "Manrope-Variable.ttf")
_INSTANCER = ("import sys\nfrom fontTools.ttLib import TTFont\nfrom fontTools.varLib.instancer import instantiateVariableFont\n"
              "f = TTFont(sys.argv[1])\ninst = instantiateVariableFont(f, {'wght': float(sys.argv[2])}, updateFontNames=False)\n"
              "inst.save(sys.argv[3])\n")


def python3():
    for p in (shutil.which("python3"), "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"):
        if p and os.path.exists(p):
            return p
    return None


def font_at_weight(path, weight, cache):
    """Static instance of a variable font at `weight` (cached by source hash + weight). Returns (path, note)."""
    if not path.lower().endswith(".ttf") or "variable" not in os.path.basename(path).lower():
        return path, "static font"
    h = hashlib.sha256(open(path, "rb").read()).hexdigest()[:10]
    out = os.path.join(cache, "%s-wght%d-%s.ttf" % (os.path.splitext(os.path.basename(path))[0], int(weight), h))
    if os.path.exists(out):
        return out, "instance (cached)"
    os.makedirs(cache, exist_ok=True)
    py = python3()
    if py:
        r = subprocess.run([py, "-c", _INSTANCER, path, str(weight), out + ".part.ttf"], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out + ".part.ttf"):
            os.replace(out + ".part.ttf", out)
            return out, "instance cut with fontTools"
        return path, "fontTools failed: " + r.stderr.strip()[-160:]
    return path, "no python3: variable font default instance"


def _measure(font, text):
    cu = bpy.data.curves.new("_m", "FONT")
    cu.body, cu.font, cu.size = text, font, 1.0
    ob = bpy.data.objects.new("_m", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    wdt = ob.dimensions.x
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return wdt


def layout(font, lines, size, line_gap=1.12, tracking=0.0):
    """[(char, x, y, line)] in metres for left-to-right lines, each centred; y of line 0 = 0 (baseline), lines below."""
    base = _measure(font, "||")
    out = []
    for li, text in enumerate(lines):
        adv = [(_measure(font, "|" + text[:i] + "|") - base) * size + tracking * size * i for i in range(len(text) + 1)]
        total = adv[-1] - tracking * size
        for i, ch in enumerate(text):
            if ch.strip():
                out.append((ch, adv[i] - total / 2, -li * line_gap * size, li))
    return out


def _sharp_by_angle(me, deg=38.0):
    bm = bmesh.new()
    bm.from_mesh(me)
    sharp = [bool(len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(deg)) for e in bm.edges]
    bm.free()
    att = me.attributes.get("sharp_edge") or me.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
    att.data.foreach_set("value", sharp)
    for p in me.polygons:
        p.use_smooth = True


def build(col, text_lines, font_path=DEFAULT_FONT, weight=800, size=0.24, extrude=0.03, bevel=0.006, bevel_res=4,
          offset=0.0, face_mat=None, side_mat=None, cache=None, tracking=0.02):
    """Letters standing on z = 0 (baseline at z = 0 for the last line), facing -Y. Returns a handle with per-letter
    pivots (empties at each glyph's ink centre) to animate."""
    cache = cache or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "fonts")
    fpath, note = font_at_weight(font_path, weight, cache)
    font = bpy.data.fonts.load(fpath, check_existing=True)
    if "instance" not in note and "static" not in note and offset == 0.0:
        offset = 0.012 * (weight - 200) / 600.0          # thicken the default-instance glyphs instead
    face_mat = face_mat or MT.chrome("title_face")
    side_mat = side_mat or face_mat
    lines = text_lines if isinstance(text_lines, (list, tuple)) else [text_lines]
    L = layout(font, lines, size, tracking=tracking)
    nlines = len(lines)
    letters = []
    dg = bpy.context.evaluated_depsgraph_get()
    for i, (ch, x, y, li) in enumerate(L):
        cu = bpy.data.curves.new("glyph_%02d" % i, "FONT")
        cu.body, cu.font, cu.size = ch, font, size
        cu.extrude, cu.bevel_depth, cu.bevel_resolution, cu.offset = extrude, bevel, bevel_res, offset
        cu.resolution_u = 6
        tmp = bpy.data.objects.new("glyph_tmp", cu)
        col.objects.link(tmp)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        bpy.data.objects.remove(tmp)
        me.materials.append(face_mat)
        me.materials.append(side_mat)
        for p in me.polygons:
            p.material_index = 0 if abs(p.normal.z) > 0.985 else 1
        _sharp_by_angle(me)
        # glyph local: x right, y up (text plane), z = extrusion -> stand it up with a proper rotation (+90 deg about X:
        # (x, y, z) -> (x, -z, y)), so the front cap faces -Y (the camera) and the winding stays outward
        vs = [v.co.copy() for v in me.vertices]
        cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
        cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
        for v in me.vertices:
            v.co = Vector((v.co.x - cx, -v.co.z, v.co.y - cy))
        me.update()
        pivot = bpy.data.objects.new("letter_%02d_%s" % (i, ch if ch.isalnum() else "sym"), None)
        col.objects.link(pivot)
        pivot.empty_display_size = size * 0.3
        rest = Vector((x + cx, 0.0, y + cy + (nlines - 1) * 1.12 * size))
        pivot.location = rest
        ob = bpy.data.objects.new("glyph_%02d" % i, me)
        col.objects.link(ob)
        ob.parent = pivot
        letters.append({"ch": ch, "pivot": pivot, "ob": ob, "rest": rest.copy(), "line": li,
                        "half": Vector(((max(v.x for v in vs) - min(v.x for v in vs)) / 2, extrude / 2,
                                        (max(v.y for v in vs) - min(v.y for v in vs)) / 2))})
    xs = [lt["rest"].x - lt["half"].x for lt in letters] + [lt["rest"].x + lt["half"].x for lt in letters]
    zs = [lt["rest"].z - lt["half"].z for lt in letters] + [lt["rest"].z + lt["half"].z for lt in letters]
    return {"letters": letters, "font": fpath, "font_note": note, "offset": offset,
            "bounds": (min(xs), max(xs), min(zs), max(zs)), "size": size}
