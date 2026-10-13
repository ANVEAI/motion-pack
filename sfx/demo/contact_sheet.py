#!/usr/bin/env python3
"""Spectrogram contact sheets of the rendered library (visual QA: sweeps, envelopes, bandwidth). usage: python3 demo/contact_sheet.py"""
import json
import os
import sys
import numpy as np
import soundfile as sf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man = json.load(open(os.path.join(HERE, "manifest.json")))
GROUPS = {"a_whoosh_riser_transition": ["whoosh", "riser", "transition"], "b_impact_ui_drum": ["impact", "ui", "drum"], "c_materials": ["glass", "metal", "wood", "paper", "cloth", "plastic", "camera", "cash", "sparkle", "liquid"],
          "d_cartoon_voice": ["cartoon", "voice", "crowd"], "e_amb_logo_stinger": ["ambience", "logo", "stinger"], "f_indian": ["indian"], "g_foley_device": ["foley", "device"]}
os.makedirs(os.path.join(HERE, "demo", "stills"), exist_ok=True)
for name, cats in GROUPS.items():
    items = [d for d in man["sounds"] if d["category"] in cats]
    cols = 6
    rows = int(np.ceil(len(items) / cols))
    fig, axs = plt.subplots(rows, cols, figsize=(cols * 2.6, rows * 1.7), dpi=62)
    axs = np.atleast_2d(axs)
    for ax in axs.ravel():
        ax.axis("off")
    for ax, d in zip(axs.ravel(), items):
        y, sr = sf.read(os.path.join(HERE, d["file"]))
        m = y.mean(axis=1)
        ax.specgram(m, NFFT=1024, Fs=sr, noverlap=768, cmap="magma", vmin=-130, vmax=-30, scale="dB")
        ax.set_ylim(0, 16000)
        ax.axis("on")
        ax.set_xticks([])
        ax.set_yticks([])
        if not d["loop"]:
            ax.axvline(d["anchor_ms"] / 1000.0, color="cyan", lw=0.6)
        ax.set_title(d["id"].replace("snd.", ""), fontsize=6.5, pad=2)
    plt.tight_layout(pad=0.3)
    out = os.path.join(HERE, "demo", "stills", "contact_%s.png" % name)
    plt.savefig(out)
    plt.close(fig)
    print(out, len(items))
