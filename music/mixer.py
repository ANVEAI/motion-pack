#!/usr/bin/env python3
"""motion-pack / music / mixer.py : the mixer helper. A cue sheet (JSON) + a bed (+ optional voice) -> measured master.

The v9 hit contract, generalised (ported from ideas in the ANVE v9 launch-film mixer):
  * a cue whose VISUAL frame is F puts its anchor sample on (F + 1) x SR / fps  (one frame after the picture; risers end one frame BEFORE the hit anchor)
  * level over the bed is measured K-weighted (BS.1770) in the 60 ms after the anchor (200 ms before it for risers): hits stem vs bed stem; tier targets
    +3..+6 dB (hero hit +4.5, whoosh +2, ui +4, logo +5; library manifest `over_bed_db`), solved in closed form per cue
  * bed ducks under voice (deterministic envelope: depth 9 dB, look-ahead 80 ms, attack 15, hold 120, release 350) plus a mid carve; tier-1 cues get a 3 dB pre-hit vacuum,
    tier-2 cues a 2 dB make-room dip (140 ms); levels are always measured against the UN-dipped bed (conservative)
  * master: -14 LUFS-I, true-peak limiter (5 ms look-ahead, 80 ms release) ceiling -1.5 dBTP, AAC probes (aac / aac_at) so HyperFrames never has to lower the track,
    last 0.15 s digital zero; limiter gain reduction per cue is budgeted (<= 1.5 dB tier 1-2, <= 1.0 dB tier 3) and the offender is lowered, not the limiter
  * bed automation (optional): "bed": {"automation": [{"frame": f, "gain_db": g}, ...]} breakpoints, linear in dB between them, held outside them;
    applied after the voice-relative bed level and before the duck (dropouts, a trailer's near-silent question, a quiet end-card hold: cuts/story45.py)
  * duck depth (optional): "vo": {"duck_db": 12} (default 9; ears measures the duck against the bed next to the line, so a documentary mix wants a little margin over 9)
  * stems: music.wav + sfx.wav + vo.wav sum EXACTLY to the master pre-limiter; nomusic.wav for re-scoring; phone-voiced check of every cue
usage:  python3 mixer.py cuesheet.json --out DIR
cue sheet:  {"fps":30,"length_s":20,"bed":{"file":"...wav","gain_db":0,"loop":true,"start_frame":0},"vo":{"file":"...","start_frame":0},
             "cues":[{"id":"snd.hit.thud","frame":120,"tier":2,"over_bed_db":4.5,"gain_db":0,"pan":0}],
             "transitions":[{"kind":"whip","frame":90,"duration_frames":8,"energy":0.6}], "master":{"lufs":-14,"ceiling_db":-1.5}}"""
import json
import os
import subprocess
import sys
import tempfile
import numpy as np
import soundfile as sf
from numba import njit
from scipy.ndimage import minimum_filter1d, uniform_filter1d, maximum_filter1d
from scipy.signal import resample_poly

import _path  # noqa: F401
from mpaudio import dsp, meter
from mpaudio.dsp import SR
from mpaudio import sweeteners

SFX_DIR = _path.SFX
GR_BUDGET = {1: 1.5, 2: 1.5, 3: 1.0}


# ---------------------------------------------------------------------------------------------------------------- library
class Library:
    def __init__(self, sfx_dir=SFX_DIR):
        self.dir = sfx_dir
        self.man = json.load(open(os.path.join(sfx_dir, "manifest.json")))
        self.by_id = {d["id"]: d for d in self.man["sounds"]}
        self._cache = {}

    def entry(self, sid):
        if sid not in self.by_id:
            raise KeyError("unknown sound id " + sid)
        return self.by_id[sid]

    def audio(self, sid, seed=None):
        """stereo float64. seed=None loads the library WAV; a seed re-renders the recipe (round-robin variation, same peak normalisation)"""
        if seed is None:
            if sid not in self._cache:
                y, sr = sf.read(os.path.join(self.dir, self.entry(sid)["file"]))
                assert sr == SR
                self._cache[sid] = y
            return self._cache[sid]
        import recipes
        from mpaudio import registry
        recipes.load_all()
        y, a, s = registry.render(sid, seed)
        return y.astype(float), a


# ---------------------------------------------------------------------------------------------------------------- dynamics / mastering
@njit(cache=True)
def _release(g, rel):
    out = g.copy()
    for i in range(1, g.shape[0]):
        up = out[i - 1] + (1.0 - out[i - 1]) * rel
        out[i] = min(g[i], up)
    return out


def tp_envelope(x, os_=4):
    pad = 512
    y = np.concatenate([np.zeros((pad, x.shape[1])), x, np.zeros((pad, x.shape[1]))], 0)
    up = np.max(np.abs(resample_poly(y, os_, 1, axis=0)), axis=1)
    return up.reshape(-1, os_).max(axis=1)[pad:-pad]


def limiter(x, ceiling_db=-1.5, look_ms=5.0, rel_ms=80.0):
    """true-peak look-ahead limiter. returns (y, gain)"""
    c = 10 ** (ceiling_db / 20.0)
    pk = tp_envelope(x)
    req = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    look = int(look_ms * SR / 1000)
    g = minimum_filter1d(req, size=2 * look + 1, mode="nearest")
    g = uniform_filter1d(g, size=look + 1, mode="nearest")
    g = np.minimum(g, req) if False else g
    g = _release(np.ascontiguousarray(g), 1.0 - np.exp(-1.0 / (rel_ms * SR / 1000)))
    g = np.minimum(g, 1.0)
    return x * g[:, None], g


def master(pre, lufs=-14.0, ceiling_db=-1.5):
    """gain to land `lufs` integrated AFTER the limiter. returns (out, G, gain_curve)"""
    G = dsp.db(lufs - meter.lufs_integrated(pre))
    for _ in range(8):
        y, g = limiter(pre * G, ceiling_db)
        L = meter.lufs_integrated(y)
        if abs(L - lufs) < 0.03:
            break
        G *= dsp.db(lufs - L)
    return y, G, g


def _decode(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True)
    return np.frombuffer(r.stdout, dtype="<f4").astype(np.float64).reshape(-1, 2)


def aac_probe(x, enc="aac", bitrate="256k"):
    """encode with ffmpeg (aac or aac_at), decode, measure. returns dict(I, TP) or None when the encoder is missing"""
    with tempfile.TemporaryDirectory() as td:
        w, m = os.path.join(td, "a.wav"), os.path.join(td, "a.m4a")
        sf.write(w, x.astype(np.float32), SR, subtype="FLOAT")
        r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", w, "-c:a", enc, "-b:a", bitrate, m], capture_output=True)
        if r.returncode != 0 or not os.path.exists(m):
            return None
        y = _decode(m)
    return {"enc": enc, "lufs_i": round(meter.lufs_integrated(y), 2), "true_peak_db": round(meter.true_peak_db(y), 2)}


from mpaudio.phone import phone_voice  # noqa: E402


def duck_envelope(vo, depth_db=9.0, look_ms=80.0, attack_ms=15.0, hold_ms=120.0, release_ms=350.0, thr_rel_db=-38.0):
    """linear gain curve for the bed under a voice track (deterministic, not a compressor)"""
    mono = np.abs(vo).max(axis=1) if vo.ndim == 2 else np.abs(vo)
    if mono.max() < 1e-6:
        return np.ones(len(mono))
    w = int(0.010 * SR)
    rms = np.sqrt(np.maximum(uniform_filter1d(mono ** 2, w), 0.0))
    gate = (rms > rms.max() * dsp.db(thr_rel_db)).astype(float)
    la = int(look_ms * SR / 1000)
    gate = np.concatenate([gate[la:], np.zeros(la)])                    # duck starts BEFORE the first syllable
    gate = maximum_filter1d(gate, size=int(hold_ms * SR / 1000) * 2 + 1)
    a = 1 - np.exp(-1.0 / (attack_ms * SR / 1000))
    r = 1 - np.exp(-1.0 / (release_ms * SR / 1000))
    env = _follow(np.ascontiguousarray(gate), a, r)
    return dsp.db(-depth_db * env)


@njit(cache=True)
def _follow(x, a, r):
    y = np.empty(x.shape[0])
    s = 0.0
    for i in range(x.shape[0]):
        s += (x[i] - s) * (a if x[i] > s else r)
        y[i] = s
    return y


def tile_rows(a, need):
    """repeat a mono (n,) or stereo (n, ch) buffer along TIME until it has at least `need` samples. (np.tile(a, k) on a 2-D array tiles the
    channel axis, giving (n, 2k): the old add_bed(loop=True) bug that turned a stereo loop into garbage / a shape error.)"""
    a = np.asarray(a)
    if len(a) >= need or len(a) == 0:
        return a
    reps = int(np.ceil(need / len(a)))
    return np.tile(a, (reps,) + (1,) * (a.ndim - 1))


# ---------------------------------------------------------------------------------------------------------------- mix
class Mix:
    def __init__(self, fps=30, length_s=20.0, lib=None):
        self.fps = fps
        self.spf = SR // fps
        assert SR % fps == 0
        self.n = int(round(length_s * SR))
        self.lib = lib or Library()
        self.bed = np.zeros((self.n, 2))
        self.vo = np.zeros((self.n, 2))
        self.cues = []
        self.has_bed = False
        self.counts = {}
        self.bed_lufs = None
        self.bed_auto = None
        self.duck_db = 9.0                   # depth of the duck under the voice (cue sheet "vo": {"duck_db": 12}: a VO-led documentary carries a deeper duck than the 9 dB minimum)
        self.bed_rel_vo_lu = -1.0          # un-ducked bed integrated loudness relative to the voice (ducked another 9 dB under speech => about -10 LU under the voice)

    # -- inputs
    def add_bed(self, audio, start_frame=0, gain_db=0.0, loop=True, lufs=None):
        """lufs: normalise this bed to an integrated loudness first (otherwise, with a voice present, the bed is set to voice LUFS + bed_rel_vo_lu at render time)"""
        a = np.asarray(audio, float)
        if a.ndim == 1:
            a = np.stack([a, a], 1)
        if lufs is not None:
            a = a * dsp.db(lufs - meter.lufs_integrated(a))
            self.bed_lufs = lufs
        s0 = start_frame * self.spf
        need = self.n - s0
        if loop and len(a) < need:
            a = tile_rows(a, need)
        dsp.add_at(self.bed, a[:need], s0, dsp.db(gain_db))
        self.has_bed = True

    def automate_bed(self, points):
        """points: [{"frame": f, "gain_db": g}] (f may be fractional); linear in dB between breakpoints, held before the first and after the last"""
        pts = sorted(((float(p["frame"]), float(p["gain_db"])) for p in points), key=lambda x: x[0])
        self.bed_auto = pts if pts else None

    def bed_gain(self):
        """per-sample linear gain of the bed automation (ones when there is none)"""
        if not self.bed_auto:
            return np.ones(self.n)
        xs = np.array([f * self.spf for f, _ in self.bed_auto])
        xs = xs + np.arange(len(xs)) * 1e-6                               # equal frames make a step, never a reversed ramp
        return dsp.db(np.interp(np.arange(self.n), xs, [g for _, g in self.bed_auto]))

    def add_vo(self, audio, start_frame=0, gain_db=0.0):
        dsp.add_at(self.vo, np.asarray(audio, float), start_frame * self.spf, dsp.db(gain_db))

    def add_cue(self, sid, frame, tier=None, over_bed_db=None, over_vo_db=None, gain_db=0.0, pan=0.0, seed=None, why="", until_frame=None):
        """until_frame (loops only): the loop stops at that visual frame with a 40 ms fade (e.g. snd.ui.agent_working under one "AI at work" state);
        without it a loop runs to the end of the mix"""
        e = self.lib.entry(sid)
        k = self.counts.get(sid, 0)
        self.counts[sid] = k + 1
        base_seed = e["seed"] if seed is None else seed
        if k > 0 and seed is None:                                        # round-robin: a repeated cue id never reuses the same take
            audio, anchor = self.lib.audio(sid, base_seed + k)
            gain_db += float(np.random.default_rng(base_seed + k).uniform(-1.5, 1.5))
        else:
            audio, anchor = self.lib.audio(sid), e["anchor_sample"]
        tier = e["tier"] if tier is None else tier
        if over_bed_db is None:
            over_bed_db = e.get("over_bed_db")
        pos = (int(frame) + 1 + e.get("anchor_frame_offset", 0)) * self.spf     # sample where the ANCHOR must land
        self.cues.append({"id": sid, "frame": int(frame), "tier": tier, "over_bed_db": over_bed_db, "over_vo_db": over_vo_db, "gain_db": gain_db, "pan": pan, "audio": audio,
                          "anchor": int(anchor), "pos": pos, "cat": e["category"], "loop": e["loop"], "why": why, "kind": e["anchor_kind"], "trim_db": 0.0, "tags": e["tags"],
                          "until": None if until_frame is None or not e["loop"] else int(until_frame) * self.spf})

    def add_transition(self, kind, frame, duration_frames=0, energy=0.5, direction=None):
        for c in sweeteners.sweeten(kind, frame, duration_frames, energy, direction):
            self.add_cue(c["id"], c["frame"], tier=c["tier"], over_bed_db=c.get("over_bed_db"), gain_db=c["gain_db"], why=c["why"])

    # -- internals
    def _cue_signal(self, c, trim_db=None):
        a = c["audio"]
        g = dsp.db(c["gain_db"] + (c["trim_db"] if trim_db is None else trim_db))
        if c["pan"]:
            m = a.mean(axis=1)
            a = dsp.pan_st(m, c["pan"]) * 1.0
            a = a * (np.max(np.abs(c["audio"])) / (np.max(np.abs(a)) + 1e-9))
        return a * g

    def _window(self, c):
        """(start, length) in cue-local samples of the K-level window"""
        if c["cat"] == "riser" and c["id"].startswith("snd.riser"):
            ln = int(0.2 * SR)
            return max(0, c["anchor"] - ln), min(ln, c["anchor"] + 1)
        if c["loop"]:
            return 0, min(len(c["audio"]), int(2.0 * SR))
        tail = len(c["audio"]) - c["anchor"]                       # short transients: measure over what exists, not over 60 ms of silence
        return c["anchor"], int(min(0.06 * SR, max(tail, 0.008 * SR)))

    def _render_sfx(self):
        out = np.zeros((self.n, 2))
        for c in self.cues:
            a = self._cue_signal(c)
            if c["loop"]:
                a = tile_rows(a, self.n - c["pos"] + len(a))
                if c.get("until") is not None:
                    a = dsp.fade_out(a[:max(0, c["until"] - c["pos"])], dsp.ms(40))
                start = c["pos"] - 0
            else:
                start = c["pos"] - c["anchor"]
            dsp.add_at(out, a, start, 1.0)
        return out

    def _bed_with_vacuum(self, bed):
        """tier-1 cues: dip the bed 3 dB over the 100 ms that END on the hit anchor (the brain reads the gap as 'the hit is bigger')"""
        g = np.ones(self.n)
        for c in self.cues:
            if c["loop"] or c["pos"] <= 0:
                continue
            a = c["pos"]
            if c["tier"] == 1:
                s0 = max(0, a - int(0.1 * SR))
                u = np.linspace(0, 1, a - s0)
                g[s0:a] *= 1 - (1 - dsp.db(-3.0)) * np.sin(np.pi / 2 * u) ** 2
            elif c["tier"] == 2:                                     # make-room dip: bed -2 dB for ~140 ms around a tier-2 cue (raised cosine)
                s0, s1 = max(0, a - int(0.02 * SR)), min(self.n, a + int(0.12 * SR))
                u = np.linspace(0, 1, s1 - s0)
                g[s0:s1] *= 1 - (1 - dsp.db(-2.0)) * np.sin(np.pi * u) ** 2
        return bed * g[:, None]

    def solve(self, bed_k, vo_k, rounds=1):
        """closed-form level per cue so that K-weighted (cue window) - (bed window) = target"""
        info = []
        for c in self.cues:
            ws, wl = self._window(c)
            cue_a = c["audio"] * dsp.db(c["gain_db"])
            kc = meter.kweight(cue_a)[ws:ws + wl]
            lc = -0.691 + 10 * np.log10(np.sum(np.mean(kc ** 2, axis=0)) + 1e-20)
            if c["loop"]:
                s0 = c["pos"]
                refw = bed_k[s0:s0 + wl] if c["over_vo_db"] is None else vo_k[s0:s0 + wl]
            else:
                a0 = c["pos"] - (c["anchor"] - ws)
                refw = (vo_k if c["over_vo_db"] is not None else bed_k)[max(0, a0):max(0, a0) + wl]
            lr = -0.691 + 10 * np.log10(np.sum(np.mean(refw ** 2, axis=0)) + 1e-20) if len(refw) else -200.0
            if c["over_vo_db"] is None and lr > -60:
                lr = max(lr, self._bed_I - 10.0)                     # a nearly silent bed window must not make the cue silent: floor = bed integrated level - 10 dB
            tgt = c["over_vo_db"] if c["over_vo_db"] is not None else c["over_bed_db"]
            if c["loop"] and c["over_bed_db"] is None:
                tgt = -10.0
            if tgt is None:
                tgt = 3.0
            if lr < -60:                                              # reference silent here: fall back to a fixed K level of the cue (-24 dB K = a sensible bed-free level)
                trim = -24.0 + (tgt) * 0 - lc if c["over_vo_db"] is None else 0.0
                src = "absolute"
            else:
                trim = lr + tgt - lc
                src = "vo" if c["over_vo_db"] is not None else "bed"
            c["trim_db"] = float(np.clip(trim, -30, 24))
            info.append((c, lc, lr, src))
        return info

    def render(self, out_dir=None, name="master", lufs=-14.0, ceiling_db=-1.5, duck=True, solve=True, aac=True, phone=True, stems=True, tail_zero_s=0.15):
        has_vo = np.max(np.abs(self.vo)) > 0
        if has_vo and self.has_bed and self.bed_lufs is None and np.max(np.abs(self.bed)) > 0:
            self.bed = self.bed * dsp.db(meter.lufs_integrated(self.vo) + self.bed_rel_vo_lu - meter.lufs_integrated(self.bed))
        bed = self.bed.copy()
        if self.bed_auto:
            bed = bed * self.bed_gain()[:, None]
        if duck and has_vo:
            env = duck_envelope(self.vo, depth_db=self.duck_db)
            carved = dsp.biquad(dsp.biquad(bed, "peak", 250.0, 0.9, -3.0), "peak", 3000.0, 1.0, -3.5)
            w = (1 - env) / max(1e-9, 1 - dsp.db(-self.duck_db))
            w = np.clip(w, 0, 1)[:, None]
            bed = (bed * (1 - w) + carved * w) * env[:, None]
        bed_v = self._bed_with_vacuum(bed)
        bed_ref = self.bed if not has_vo else self.bed                      # level reference = un-ducked bed (hits must not lose level when the duck engages)
        bed_k, vo_k = meter.kweight(bed_ref), meter.kweight(self.vo)
        self._vo_k = vo_k
        self._bed_I = meter.lufs_integrated(bed_ref) if np.max(np.abs(bed_ref)) > 0 else -70.0
        info = None
        use_solver = bool(solve and (self.has_bed or any(c["over_vo_db"] is not None for c in self.cues)))
        for rnd in range(4):
            if rnd == 0:
                if use_solver:
                    info = self.solve(bed_k, vo_k)
                else:
                    for c in self.cues:
                        c["trim_db"] = -12.0 if not c["loop"] else -26.0
            sfx = self._render_sfx()
            pre = bed_v + sfx + self.vo
            out, G, g = master(pre, lufs, ceiling_db)
            over = False                                                 # limiter budget: lower the OFFENDING cue, not the limiter
            for c in self.cues:
                if c["loop"]:
                    continue
                a = c["pos"]
                lo_, hi_ = max(0, a - int(0.005 * SR)), a + int(0.06 * SR)
                w = g[lo_:hi_]
                gr = float(-20 * np.log10(w.min() + 1e-12)) if len(w) else 0.0
                c["gr_db"] = round(gr, 2)
                bud = GR_BUDGET.get(c["tier"], 1.5)
                ca = self._cue_signal(c) * G
                cs0 = max(0, c["pos"] - c["anchor"])
                seg = ca[max(0, lo_ - cs0):max(0, hi_ - cs0)]
                own = float(np.max(np.abs(seg))) if len(seg) else 0.0
                tot = float(np.max(np.abs(pre[lo_:hi_] * G))) if hi_ > lo_ else 1.0
                if gr > bud + 0.05 and own >= 0.5 * tot:
                    c["trim_db"] -= (gr - bud) * 0.9
                    over = True
            if not over:
                break
        # AAC probes: lower the ceiling by the overshoot until the AAC true peak is <= -1.0 dBTP (HyperFrames lowers the whole track above that)
        probes = []
        ceil = ceiling_db
        if aac:
            for _ in range(4):
                probes = [p for p in (aac_probe(out, "aac"), aac_probe(out, "aac_at")) if p]
                worst = max([p["true_peak_db"] for p in probes], default=-99)
                if worst <= -1.0:
                    break
                ceil -= (worst + 1.0) + 0.15
                out, G, g = master(pre, lufs, ceil)
        if tail_zero_s:
            nz = int(tail_zero_s * SR)
            nf = int(0.03 * SR)
            out[-nz:] = 0.0
            out[-nz - nf:-nz] *= np.cos(np.linspace(0, np.pi / 2, nf))[:, None] ** 2
        self.stems_out = {"music": bed_v, "sfx": sfx, "vo": self.vo, "G": G}
        rep = self._report(out, pre, G, g, bed_v, sfx, bed_k, ceil, probes, info, phone)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            sf.write(os.path.join(out_dir, name + ".wav"), out, SR, subtype="PCM_24")
            if stems:
                for k, v in (("music", bed_v), ("sfx", sfx), ("vo", self.vo)):
                    sf.write(os.path.join(out_dir, "stem_%s.flac" % k), np.clip(v * G, -1, 1), SR, subtype="PCM_24")
                nm, _ = limiter((sfx + self.vo) * G, ceil)
                sf.write(os.path.join(out_dir, "nomusic.flac"), nm, SR, subtype="PCM_24")
            json.dump(rep, open(os.path.join(out_dir, name + "_report.json"), "w"), indent=1)
        rep["_audio"] = out
        return rep

    def _report(self, out, pre, G, g, bed_v, sfx, bed_k, ceil, probes, info, phone):
        r = {"lufs_i": round(meter.lufs_integrated(out), 2), "true_peak_db": round(meter.true_peak_db(out), 2), "sample_peak_db": round(meter.sample_peak_db(out), 2),
             "ceiling_db_used": round(ceil, 2), "master_gain_db": round(20 * np.log10(G), 2), "aac_probes": probes, "lufs_m_max": round(meter.lufs_momentary_max(out), 2),
             "lufs_s_max": round(meter.lufs_short_max(out), 2), "length_s": round(len(out) / SR, 3), "tail_zero_ok": bool(np.max(np.abs(out[-int(0.15 * SR) + 8:])) == 0.0),
             "stem_sum_error": float(np.max(np.abs((bed_v + sfx + self.vo) - pre))), "cues": []}
        ph_bed = phone_voice(self.bed) if phone and self.has_bed else None
        ph_k = meter.kweight(ph_bed) if ph_bed is not None else None
        for c in self.cues:
            row = {"id": c["id"], "frame": c["frame"], "tier": c["tier"], "target_over_bed_db": c["over_bed_db"], "trim_db": round(c["trim_db"], 2), "gr_db": c.get("gr_db"),
                   "anchor_sample": c["pos"], "anchor_error_samples": 0, "why": c["why"]}
            if not c["loop"] and c["kind"] in ("peak",):
                a = self._cue_signal(c)
                row["anchor_error_samples"] = int(np.argmax(np.max(np.abs(a), axis=1)) - c["anchor"])
            ws, wl = self._window(c)
            a = self._cue_signal(c)
            lc = -0.691 + 10 * np.log10(np.sum(np.mean(meter.kweight(a)[ws:ws + wl] ** 2, axis=0)) + 1e-20)
            a0 = c["pos"] - (c["anchor"] - ws) if not c["loop"] else c["pos"]
            refw = bed_k[max(0, a0):max(0, a0) + wl]
            if len(refw):
                lr = -0.691 + 10 * np.log10(np.sum(np.mean(refw ** 2, axis=0)) + 1e-20)
                if lr > -60 and lr < self._bed_I - 10.0 and c["over_vo_db"] is None:
                    lr = self._bed_I - 10.0                             # same floor as the solver: a near-silent bed window is referenced at (bed integrated - 10 dB)
                    row["bed_floor_applied"] = True
                row["measured_over_bed_db"] = round(lc - lr, 2) if lr > -60 else None
            if c["over_vo_db"] is not None:
                vk = self._vo_k[max(0, a0):max(0, a0) + wl]
                lv = -0.691 + 10 * np.log10(np.sum(np.mean(vk ** 2, axis=0)) + 1e-20) if len(vk) else -200.0
                row["target_over_vo_db"] = c["over_vo_db"]
                row["measured_over_vo_db"] = round(lc - lv, 2) if lv > -60 else None
            if ph_k is not None and c["tier"] <= 2 and not c["loop"] and row.get("measured_over_bed_db") is not None:
                pc = phone_voice(a)
                kc = meter.kweight(pc)[ws:ws + wl]
                lpc = -0.691 + 10 * np.log10(np.sum(np.mean(kc ** 2, axis=0)) + 1e-20)
                rp = ph_k[max(0, a0):max(0, a0) + wl]
                lpr = -0.691 + 10 * np.log10(np.sum(np.mean(rp ** 2, axis=0)) + 1e-20)
                row["phone_over_bed_db"] = round(lpc - lpr, 2)
                row["phone_ok"] = bool(lpc - lpr >= 2.0 - 1.0)
            r["cues"].append(row)
        return r


# ---------------------------------------------------------------------------------------------------------------- lint
def lint_cues(cues, fps=30, short_form=True, voice_first_frame=None, lib=None, quiet=None):
    """house-rule linter (docs/research/sound.md section 3). cues: list of dicts with id, frame, tier. returns list of issue strings.
    quiet: the plan's audio.quiet [{t: [a, b], kind, why}]; a planned quiet OPEN (kind open, starting at frame 0) waives R10 when the first cue lands by its end + 0.25 s, the same rule ears applies"""
    issues = []
    cs = sorted(cues, key=lambda c: c["frame"])
    t1 = [c for c in cs if c.get("tier") == 1]
    for a, b in zip(t1, t1[1:]):
        if b["frame"] - a["frame"] < 3.0 * fps:
            issues.append("R4 tier-1 hits %s@%d and %s@%d are closer than 3 s (hero hit every 8-10 s)" % (a["id"], a["frame"], b["id"], b["frame"]))
    if cs:
        span = max(1.0, (cs[-1]["frame"] - cs[0]["frame"]) / fps)
        if len(t1) / span > 1 / 5.0 and len(t1) > 1:
            issues.append("R4 %d tier-1 cues in %.1f s: more than one per 5 s" % (len(t1), span))
        t2 = [c for c in cs if c.get("tier") == 2]
        if len(t2) > 1 and (t2[-1]["frame"] - t2[0]["frame"]) / fps / (len(t2) - 1) < 1.0:
            issues.append("R4 tier-2 cues average closer than 1.0 s")
    for i, c in enumerate(cs):
        if c.get("over_bed_db") is not None and c["over_bed_db"] > 6.0:
            issues.append("R2 %s@%d over_bed_db %.1f > +6 (no jump scares)" % (c["id"], c["frame"], c["over_bed_db"]))
        recent = [x["id"] for x in cs[max(0, i - 7):i]]
        if recent.count(c["id"]) >= 3:
            issues.append("R9 %s@%d appears 3+ times within 8 events (use round-robin variants or other sounds)" % (c["id"], c["frame"]))
    if lib is not None:                                                    # R12: a tier 1/2 cue that vanishes on a phone speaker needs a phone-safe partner within 3 frames
        for c in cs:
            e = lib.by_id.get(c["id"])
            if e and c.get("tier", e["tier"]) <= 2 and e.get("phone_safe") is False:
                partner = [x for x in cs if x is not c and abs(x["frame"] - c["frame"]) <= 3 and (lib.by_id.get(x["id"]) or {}).get("phone_safe", True)]
                if not partner:
                    issues.append("R12 %s@%d loses %.1f dB on a phone speaker: pair it with a mid-range cue within 3 frames" % (c["id"], c["frame"], e["phone_drop_db"]))
    if short_form and cs and cs[0]["frame"] > 2 and voice_first_frame is None:
        q = next((x for x in (quiet or []) if x.get("kind", "open") == "open" and x["t"][0] <= 1.0 / fps + 1e-6), None)   # a planned quiet open: the sound enters 1-2 s after a moving frame 0
        if q is None:
            issues.append("R10 short-form needs an audible event on frames 0-3 (first cue at frame %d); if the quiet open is intended, plan it: audio.quiet [{\"t\": [0, %.1f], \"kind\": \"open\", \"why\": \"...\"}]" % (cs[0]["frame"], min(2.0, cs[0]["frame"] / fps)))
        elif cs[0]["frame"] / fps > q["t"][1] + 0.25 + 1e-9:
            issues.append("R10 the first cue (frame %d, %.2f s) comes after the planned quiet open (0-%.1f s): the open must end on the first meaningful event" % (cs[0]["frame"], cs[0]["frame"] / fps, q["t"][1]))
    return issues


# ---------------------------------------------------------------------------------------------------------------- CLI
def mix_from_cuesheet(sheet, base_dir="."):
    fps = sheet.get("fps", 30)
    m = Mix(fps, sheet["length_s"])
    rd = lambda p: sf.read(os.path.join(base_dir, p))[0]
    b = sheet.get("bed")
    if b:
        m.add_bed(rd(b["file"]), b.get("start_frame", 0), b.get("gain_db", 0.0), b.get("loop", True))
        if b.get("automation"):
            m.automate_bed(b["automation"])
    v = sheet.get("vo")
    if v:
        m.add_vo(rd(v["file"]), v.get("start_frame", 0), v.get("gain_db", 0.0))
        if v.get("duck_db") is not None:
            m.duck_db = float(v["duck_db"])
    for c in sheet.get("cues", []):
        m.add_cue(c["id"], c["frame"], c.get("tier"), c.get("over_bed_db"), c.get("over_vo_db"), c.get("gain_db", 0.0), c.get("pan", 0.0), c.get("seed"), c.get("why", ""), c.get("until_frame"))
    for t in sheet.get("transitions", []):
        m.add_transition(t["kind"], t["frame"], t.get("duration_frames", 0), t.get("energy", 0.5), t.get("direction"))
    return m


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "mix_out"
    sheet = json.load(open(path))
    mx = mix_from_cuesheet(sheet, os.path.dirname(os.path.abspath(path)))
    ms_ = sheet.get("master", {})
    rep = mx.render(out, lufs=ms_.get("lufs", -14.0), ceiling_db=ms_.get("ceiling_db", -1.5))
    rep.pop("_audio", None)
    print(json.dumps({k: v for k, v in rep.items() if k != "cues"}, indent=1))
    for issue in lint_cues([{"id": c["id"], "frame": c["frame"], "tier": c["tier"], "over_bed_db": c["over_bed_db"]} for c in mx.cues], fps=sheet.get("fps", 30), lib=mx.lib, quiet=sheet.get("quiet")):
        print("LINT", issue)
