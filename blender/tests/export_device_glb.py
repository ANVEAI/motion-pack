# Build the procedural device and export it as a GLB (each part a top-level object): the test model for the `model=` path, made by the pack itself
# (no third-party file). blender -b --factory-startup -P blender/tests/export_device_glb.py -- OUT.glb   MIT (see blender/LICENSE).
import os
import sys
import bpy
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from lib import device as DV  # noqa: E402
from lib.util import coll  # noqa: E402
out = sys.argv[sys.argv.index("--") + 1]
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
D = DV.build(DV.spec("graphite-teal"), coll("device"), seed=5)
bpy.context.view_layer.update()
for o in [o for o in bpy.data.objects if o.type == "MESH"]:   # bake modifiers + world transforms so the GLB has plain meshes
    bpy.context.view_layer.objects.active = o
for p in D["parts"].values():
    p.parent = None
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True)
print("MPB_EXPORTED", out, os.path.getsize(out))
