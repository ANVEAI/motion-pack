"""recipes: importing a module registers its sounds in mpaudio.registry.SOUNDS. load_all() imports every recipe module."""
import importlib

MODULES = ["whoosh", "impacts", "risers", "ui", "materials", "liquid", "cartoon", "voices", "ambience", "stingers", "drums", "transitions",
           "indian", "foley", "device", "fx_extra", "ambience2",          # 2026-10-13 expansion
           "saas",                                                         # 2026-10-14: cards, scan, pixel dissolve, agent texture, brand slam, letters
           "archive",                                                      # 2026-10-14 round 3: projector loop, typewriter line, hologram beam
           "elec",                                                         # 2026-10-14 gap sfx/elec/arc: arc zap, crackle loop, zap-off power-down
           "saas_ui"]                                                      # 2026-10-16 xp-saas: hover, drag, drop, zoom, highlight, palette, stream, chime, chord, toast, price, connect


def load_all():
    for m in MODULES:
        importlib.import_module("recipes." + m)
