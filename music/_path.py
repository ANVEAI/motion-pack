"""puts motion-pack/sfx on sys.path so music modules can import mpaudio and the sfx recipes"""
import os
import sys

SFX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx")
if SFX not in sys.path:
    sys.path.insert(0, SFX)
