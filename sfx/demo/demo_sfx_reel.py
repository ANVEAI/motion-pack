#!/usr/bin/env python3
"""20 s sfx reel: one representative of every family, each on its own frame-exact cue, no bed, mastered to -14 LUFS-I / <= -1.5 dBTP by the mixer.
usage: python3 demo/demo_sfx_reel.py  -> demo/out/sfx_reel.wav (+ report) and demo/stills/sfx_reel.png"""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "music"))
import _path  # noqa: F401
import mixer
from mpaudio import meter
SR = 48000
REEL = ["snd.whoosh.whoosh_m", "snd.hit.cinema", "snd.riser.noise_1bar", "snd.ui.pop", "snd.ui.typing_burst", "snd.glass.clink", "snd.metal.ping", "snd.wood.knock", "snd.paper.flip",
        "snd.liquid.drip", "snd.cartoon.boing", "snd.cartoon.tiptoe", "snd.voice.chirp_question", "snd.drum.kick", "snd.drum.snare", "snd.tx.glitch_stutter", "snd.stinger.reveal",
        "snd.sparkle.shimmer", "snd.cash.ka_ching", "snd.logo.hybrid"]
STEP = 28   # frames between cues (0.93 s)
m = mixer.Mix(30, 20.0)
for i, sid in enumerate(REEL):
    m.add_cue(sid, 3 + i * STEP)
rep = m.render(os.path.join(HERE, "demo", "out"), "sfx_reel", stems=False, aac=True, phone=False)
audio = rep.pop("_audio")
os.makedirs(os.path.join(HERE, "demo", "stills"), exist_ok=True)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(2, 1, figsize=(15, 5.2), dpi=70)
mm = audio.mean(axis=1)
ax[0].plot(np.arange(len(mm))[::24] / SR, mm[::24], lw=0.4, color="#4A18ED")
for c in m.cues:
    ax[0].axvline(c["pos"] / SR, color="#f59e0b", lw=0.7)
    ax[0].text(c["pos"] / SR, 0.95, c["id"].replace("snd.", ""), rotation=90, fontsize=6, va="top", ha="right")
ax[0].set_xlim(0, 20)
ax[1].specgram(mm, NFFT=2048, Fs=SR, noverlap=1536, cmap="magma", vmin=-130, vmax=-30)
ax[1].set_ylim(0, 14000)
plt.tight_layout()
plt.savefig(os.path.join(HERE, "demo", "stills", "sfx_reel.png"))
print(json.dumps({k: rep[k] for k in ("lufs_i", "true_peak_db", "aac_probes", "tail_zero_ok")}), "cues", len(m.cues), "last anchor s", m.cues[-1]["pos"] / SR)
