#!/usr/bin/env python3
"""Demo of the 2026-10-13 audio expansion: a 24 s India-market spot track built only from the pack.
Bed = music/library/beds/bed_indian_fusion_loop8.wav (20.3 s, LOOPED to 24 s: exercises the fixed stereo tiling in Mix.add_bed), cues from the new families
(tabla, sitar, shehnai, foley, device + voice-assistant UI set, crowd, impacts, risers), the formerly pending sweeteners (pagePeel, swipeUp, spin, shutter, pixelSort)
and two catalog-derived ones (cube, swirl), ending on the sitar-and-tanpura sonic logo. Mastered -14 LUFS-I / <= -1.5 dBTP.
Writes demo/out/expansion/{master.wav, stems, master_report.json, cuesheet.json}. usage: python3 demo/demo_expansion.py"""
import json
import os
import sys
import numpy as np
import soundfile as sf
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import _path  # noqa: F401
from mpaudio.dsp import SR
import mixer
import logo

FPS = 30
OUT = os.path.join(HERE, "demo", "out", "expansion")
os.makedirs(OUT, exist_ok=True)
bed, sr = sf.read(os.path.join(HERE, "library", "beds", "bed_indian_fusion_loop8.wav"))
assert sr == SR and bed.ndim == 2
mx = mixer.Mix(FPS, 24.0)
mx.add_bed(bed, 0, 0.0, loop=True)
cues = [  # (id, visual frame, tier)
    ("snd.indian.tabla_dha", 0, 2), ("snd.ui.mic_on", 45, 3), ("snd.device.keyboard_mech_soft", 60, 3), ("snd.device.keyboard_mech_soft", 66, 3),
    ("snd.device.keyboard_mech_soft", 71, 3), ("snd.ui.ai_think_pulse", 95, 3), ("snd.ui.ai_reply", 130, 2), ("snd.foley.chai_cup_clink", 200, 3),
    ("snd.foley.footstep_wood", 240, 3), ("snd.foley.footstep_wood", 256, 3), ("snd.foley.footstep_wood", 272, 3), ("snd.foley.door_open", 290, 3),
    ("snd.indian.sitar_meend", 330, 3), ("snd.device.phone_buzz", 390, 2), ("snd.crowd.aww_synth", 430, 2), ("snd.riser.snare_roll_build", 539, 2),
    ("snd.hit.taiko", 540, 1), ("snd.indian.shehnai_note", 560, 3), ("snd.crowd.cheer_synth", 600, 2), ("snd.device.achievement", 640, 3),
]
for sid, f, tier in cues:
    mx.add_cue(sid, f, tier=tier)
for kind, f, d in (("pagePeel", 160, 10), ("swipeUp", 300, 8), ("spin", 360, 10), ("shutter", 470, 6), ("pixelSort", 500, 8), ("cube", 610, 12), ("swirl", 655, 14)):
    mx.add_transition(kind, f, d, 0.6)
y, anchor, info = logo.render_logo_sitar(name="Orbit", seed=3)
logo_frame = 680
lg = np.zeros_like(mx.bed)
mixer.dsp.add_at(lg, y, (logo_frame + 1) * (SR // FPS) - anchor, 0.35)
mx.bed += lg                                              # the logo rides on the music layer
rep = mx.render(OUT)
sheet = {"fps": FPS, "length_s": 24, "bed": {"file": "library/beds/bed_indian_fusion_loop8.wav", "loop": True}, "cues": [{"id": c[0], "frame": c[1], "tier": c[2]} for c in cues],
         "transitions": [{"kind": k, "frame": f, "duration_frames": d, "energy": 0.6} for k, f, d in (("pagePeel", 160, 10), ("swipeUp", 300, 8), ("spin", 360, 10), ("shutter", 470, 6),
                                                                                                     ("pixelSort", 500, 8), ("cube", 610, 12), ("swirl", 655, 14))],
         "logo": {"music_id": "music.logo_sitar_orbit", "frame": logo_frame}}
json.dump(sheet, open(os.path.join(OUT, "cuesheet.json"), "w"), indent=1)
keys = [k for k in ("lufs_i", "true_peak_db", "aac_probes", "limiter_max_gr_db") if k in rep]
print("master", {k: rep[k] for k in keys} if keys else list(rep)[:12])
