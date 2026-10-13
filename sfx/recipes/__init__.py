"""recipes: importing a module registers its sounds in mpaudio.registry.SOUNDS. load_all() imports every recipe module."""
import importlib

MODULES = ["whoosh", "impacts", "risers", "ui", "materials", "liquid", "cartoon", "voices", "ambience", "stingers", "drums", "transitions",
           "indian", "foley", "device", "fx_extra", "ambience2"]          # 2026-10-13 expansion


def load_all():
    for m in MODULES:
        importlib.import_module("recipes." + m)
