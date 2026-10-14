"""recipes: importing a module registers its sounds in mpaudio.registry.SOUNDS. load_all() imports every recipe module."""
import importlib

MODULES = ["whoosh", "impacts", "risers", "ui", "materials", "liquid", "cartoon", "voices", "ambience", "stingers", "drums", "transitions",
           "indian", "foley", "device", "fx_extra", "ambience2",          # 2026-10-13 expansion
           "saas",                                                         # 2026-10-14: cards, scan, pixel dissolve, agent texture, brand slam, letters
           "archive"]                                                      # 2026-10-14 round 3: projector loop, typewriter line, hologram beam


def load_all():
    for m in MODULES:
        importlib.import_module("recipes." + m)
