#!/usr/bin/env python3
"""Demo: a 21 s launch-ad sound track built ONLY from the pack: procedural bed (tech_pulse, 10 bars at 120 BPM) + a word-free synthetic voice stand-in
(babble, NOT speech) + transition sweeteners + UI cues + riser into the logo, mixed by the mixer helper to -14 LUFS-I / <= -1.5 dBTP.
Writes demo/out/{master.wav, stem_*.flac, nomusic.flac, master_report.json, cuesheet.json} and demo/stills/demo_mix_timeline.png.
usage: python3 demo/demo_mix.py"""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import _path  # noqa: F401
from mpaudio import dsp, meter
from mpaudio.dsp import SR
import compose as C
import mixer
import recipes
recipes.load_all()
from recipes.voices import babble

FPS = 30
OUT = os.path.join(HERE, "demo", "out")
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(HERE, "demo", "stills"), exist_ok=True)

# ---- bed: 10 bars @ 120 BPM = 20 s (+ ring-out), energy ladder intro -> build -> drop -> final -> tail
structure = [("intro", 1, 0.3), ("build", 2, 0.6), ("drop", 4, 1.0), ("final", 2, 0.85), ("tail", 1, 0.2)]
r = C.compose("tech_pulse", structure, seed=3, fps=FPS)
mx = mixer.Mix(FPS, 21.0)
mx.add_bed(r["mix"], 0, 0.0, loop=False)

# ---- voice stand-in: three word-free babble phrases (synthetic formant voice, not speech)
phr = [(45, 2.8, "statement", 11), (195, 2.8, "question", 12), (360, 3.0, "statement", 13), (465, 2.2, "surprise", 14)]
vo = np.zeros((mx.n, 2))
for f0, d, ct, sd in phr:
    v = babble("adult", "normal", d, sd, ct, breath=0.05)
    v = v / (np.max(np.abs(v)) + 1e-9) * dsp.db(-6.0)
    dsp.add_at(vo, dsp.stereo(v), f0 * (SR // FPS), 1.0)
mx.add_vo(vo, 0, 0.0)

# ---- cue sheet
cues = [{"id": "snd.hit.sub_drop", "frame": 0, "tier": 1, "why": "hook: weight on frame 0"}, {"id": "snd.hit.stab", "frame": 0, "tier": 2, "why": "hook: phone-safe mid layer on frame 0"}]
for i, f in enumerate((70, 85, 100)):
    cues.append({"id": "snd.ui.pop", "frame": f, "tier": 3, "over_vo_db": -14.0, "why": "caption word %d" % i})
cues += [{"id": "snd.ui.typing_burst", "frame": 200, "tier": 3, "over_vo_db": -16.0, "why": "typing under voice"},
         {"id": "snd.ui.count_run", "frame": 270, "tier": 3, "over_bed_db": 3.0, "why": "stat counter"},
         {"id": "snd.cash.ka_ching", "frame": 330, "tier": 2, "why": "payoff"}]
transitions = [{"kind": "hardCut", "frame": 60, "energy": 0.5}, {"kind": "whip", "frame": 120, "duration_frames": 8, "energy": 0.6}, {"kind": "scalePunch", "frame": 165, "energy": 0.6},
               {"kind": "hardCut", "frame": 180, "energy": 0.8}, {"kind": "zoomThrough", "frame": 240, "energy": 0.7}, {"kind": "flash", "frame": 300, "duration_frames": 6, "energy": 0.6},
               {"kind": "glitch", "frame": 345, "energy": 0.6}, {"kind": "push", "frame": 390, "duration_frames": 10, "energy": 0.5}, {"kind": "dissolve", "frame": 420, "duration_frames": 20, "energy": 0.4},
               {"kind": "match", "frame": 450, "energy": 0.5}, {"kind": "speedRamp", "frame": 480, "duration_frames": 20, "energy": 0.6}]
cues += [{"id": "snd.riser.noise_1bar", "frame": 540, "tier": 2, "why": "riser: ends one frame before the logo anchor"}, {"id": "snd.logo.hybrid", "frame": 540, "tier": 1, "why": "end card logo"}]
for c in cues:
    mx.add_cue(c["id"], c["frame"], c.get("tier"), c.get("over_bed_db"), c.get("over_vo_db"), 0.0, 0.0, None, c.get("why", ""))
for t in transitions:
    mx.add_transition(t["kind"], t["frame"], t.get("duration_frames", 0), t["energy"])
lint = mixer.lint_cues([{"id": c["id"], "frame": c["frame"], "tier": c["tier"], "over_bed_db": c["over_bed_db"]} for c in mx.cues], FPS, lib=mx.lib)

rep = mx.render(OUT, "master")
audio = rep.pop("_audio")
env = mixer.duck_envelope(vo)
mid = np.arange(int(1.2 * SR), int(2.2 * SR)) + 45 * (SR // FPS)                    # inside phrase 1
rep["duck_envelope_min_db"] = round(float(20 * np.log10(env.min())), 2)
rep["duck_depth_in_phrase_db"] = round(float(20 * np.log10(np.mean(env[mid]))), 2)
rep["lint"] = lint
rep["cue_count"] = len(mx.cues)
json.dump(rep, open(os.path.join(OUT, "master_report.json"), "w"), indent=1)
json.dump({"fps": FPS, "length_s": 21.0, "cues": cues, "transitions": transitions}, open(os.path.join(OUT, "cuesheet.json"), "w"), indent=1)

# ---- still: timeline
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(3, 1, figsize=(15, 8.2), dpi=70, gridspec_kw={"height_ratios": [2.2, 1.3, 1.6]})
m = audio.mean(axis=1)
t = np.arange(len(m)) / SR
ax[0].plot(t[::24], m[::24], lw=0.4, color="#4A18ED")
for c in mx.cues:
    x = c["pos"] / SR
    col = {1: "#e11d48", 2: "#f59e0b", 3: "#10b981"}[c["tier"]]
    ax[0].axvline(x, color=col, lw=0.8, alpha=0.8)
    ax[0].text(x, 0.93, c["id"].replace("snd.", "").replace("whoosh.", "wh.")[:16], rotation=90, fontsize=5.5, va="top", ha="right", color=col)
ax[0].set_xlim(0, 21)
ax[0].set_ylim(-1, 1)
ax[0].set_title("demo_mix: master (-14 LUFS-I, TP %.2f) | cues: red tier 1, amber tier 2, green tier 3 | frame-exact anchors at (F+1)/30 s" % rep["true_peak_db"], fontsize=9)
# short-term loudness curves per stem
def mom(x):
    k = meter.kweight(x)
    w = int(0.4 * SR)
    hop = int(0.1 * SR)
    return np.array([-0.691 + 10 * np.log10(np.sum(np.mean(k[s:s + w] ** 2, axis=0)) + 1e-12) for s in range(0, len(x) - w, hop)])
G = 10 ** (rep["master_gain_db"] / 20.0)
for name, sig, col in (("music (ducked)", mx.stems_out["music"], "#4A18ED"), ("sfx", mx.stems_out["sfx"], "#f59e0b"), ("vo", mx.stems_out["vo"], "#10b981")):
    mm = mom(sig * G)
    ax[1].plot(np.arange(len(mm)) * 0.1 + 0.2, np.maximum(mm, -60), label=name, color=col, lw=1.1)
ax[1].set_ylim(-50, -3)
ax[1].legend(fontsize=7, ncol=3, loc="lower right")
ax[1].set_ylabel("momentary LUFS", fontsize=7)
ax[1].set_xlim(0, 21)
ax[2].specgram(m, NFFT=2048, Fs=SR, noverlap=1536, cmap="magma", vmin=-130, vmax=-30)
ax[2].set_ylim(0, 12000)
ax[2].set_xlim(0, 21)
ax[2].set_ylabel("Hz", fontsize=7)
plt.tight_layout()
plt.savefig(os.path.join(HERE, "demo", "stills", "demo_mix_timeline.png"))
print(json.dumps({k: rep[k] for k in ("lufs_i", "true_peak_db", "aac_probes", "lufs_s_max", "tail_zero_ok", "stem_sum_error", "duck_envelope_min_db", "duck_depth_in_phrase_db", "cue_count")}, indent=1))
print("LINT:", lint)
for c in rep["cues"]:
    print("%-28s f%-4d t%d bed: tgt %-5s got %-6s | vo: tgt %-5s got %-6s | GR %-5s phone %s" % (c["id"][:28], c["frame"], c["tier"], c["target_over_bed_db"], c.get("measured_over_bed_db"), c.get("target_over_vo_db"), c.get("measured_over_vo_db"), c.get("gr_db"), c.get("phone_over_bed_db")))
