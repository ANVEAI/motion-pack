# motion-pack/blender recipes: id -> module. Ids follow the pack convention <module>/<name> (resolved by
# motion-pack tools/check_ids.py once integrated). MIT (see blender/LICENSE).
from . import turntable, macro_sweep, explode, title3d, art_liquid_chrome, art_voxel_wave, art_particle_swirl

MODULES = (turntable, macro_sweep, explode, title3d, art_liquid_chrome, art_voxel_wave, art_particle_swirl)
REGISTRY = {m.ID: m for m in MODULES}


def get(rid):
    if rid in REGISTRY:
        return REGISTRY[rid]
    for k in REGISTRY:          # accept the bare name: turntable, art.liquidChrome, ...
        if k.split("/", 1)[1] == rid:
            return REGISTRY[k]
    raise SystemExit("unknown recipe %r (have %s)" % (rid, ", ".join(REGISTRY)))


def describe():
    return {k: {"name": m.NAME, "doc": m.DOC, "use": m.USE, "avoid": m.AVOID, "loop": m.LOOP,
                "defaults": {kk: (list(v) if isinstance(v, tuple) else v) for kk, v in m.DEFAULTS.items()},
                "params": {pk: {kk: (list(vv) if isinstance(vv, tuple) else vv) for kk, vv in pv.items()}
                           for pk, pv in m.PARAMS.items()}} for k, m in REGISTRY.items()}
