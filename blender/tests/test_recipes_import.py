#!/usr/bin/env python3
"""Every Blender recipe imports and matches blender/manifest.json, without Blender (pytest, CI). run: python3 -m pytest -q blender/tests
CI has no Blender, so `compileall` only proves the files parse. Here bpy / mathutils / bmesh are stand-in modules (any attribute is a no-op object), the
recipes package is imported the way run.py imports it, and recipes.describe() (what `blender ... run.py -- --list` prints and make_manifest.py writes)
must equal the committed manifest entry of every recipe: the same ids, names, docs, defaults and params. A recipe added without a manifest entry, a
manifest entry without a recipe, or a parameter changed without re-running blender/tools/make_manifest.py fails here. Renders are tested by
blender/tests/smoke.sh on a machine with Blender (not in CI)."""
import importlib
import json
import os
import sys
import types
from unittest import mock

BL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(BL) + os.sep


class _Stub(types.ModuleType):
    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError(name)
        return mock.MagicMock(name='%s.%s' % (self.__name__, name))


def _load():
    saved = {k: sys.modules.get(k) for k in ('bpy', 'mathutils', 'bmesh', 'bpy_extras', 'gpu')}
    for k in saved:
        sys.modules[k] = _Stub(k)
    sys.path.insert(0, BL)
    try:
        for k in [m for m in sys.modules if m == 'recipes' or m.startswith('recipes.') or m == 'lib' or m.startswith('lib.')]:
            del sys.modules[k]
        return importlib.import_module('recipes')
    finally:
        sys.path.remove(BL)


def _norm(v):
    """the manifest writes path defaults repo-relative and tuples as lists"""
    if isinstance(v, dict):
        return {k: _norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_norm(x) for x in v]
    if isinstance(v, str) and v.startswith(REPO):
        return v[len(REPO):]
    return v


def test_every_recipe_imports_without_blender_and_matches_the_manifest():
    rec = _load()
    got = _norm(json.loads(json.dumps(rec.describe(), default=str)))
    man = json.load(open(os.path.join(BL, 'manifest.json')))['recipes']
    assert set(got) == set(man), 'recipes vs manifest: only in code %s, only in manifest %s' % (sorted(set(got) - set(man)), sorted(set(man) - set(got)))
    stale = []
    for rid, d in got.items():
        for k, v in d.items():
            if _norm(man[rid].get(k)) != v:
                stale.append('%s.%s' % (rid, k))
    assert not stale, 'manifest out of date for %s: run python3 blender/tools/make_manifest.py (needs Blender) and commit' % stale
    assert len(got) >= 12 and all(m.ID == rid for rid, m in rec.REGISTRY.items())
