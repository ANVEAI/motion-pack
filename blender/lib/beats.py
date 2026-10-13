# motion-pack/blender: beat-reactive input from a motion-pack music sidecar (music/library/beds/<bed>.json: meta.fps,
# meta.length_frames, meta.loop, kick_frames, clap_snare_frames, beat_frames, bar_frames, drop_frames). Frames are
# converted to the plate's fps; for a loop the hits wrap modulo the plate length, which is seamless only when the
# plate length is a whole number of the bed's beats (checked and reported, never silently). MIT (see blender/LICENSE).
import json
import math


def load(path, fps, n_frames, loop=True, key="kick_frames"):
    d = json.load(open(path))
    meta = d.get("meta", {})
    src_fps = float(meta.get("fps", fps))
    k = fps / src_fps
    hits = [float(x) * k for x in (d.get(key) or d.get("beat_frames") or [])]
    fpb = float(d.get("tempo", {}).get("frames_per_beat", meta.get("frames_per_beat", 0)) or 0) * k
    info = {"path": path, "key": key, "bpm": d.get("tempo", {}).get("bpm", meta.get("bpm")), "frames_per_beat": fpb,
            "hits_in_file": len(hits), "src_fps": src_fps, "loop": loop}
    if loop:
        hits = sorted({round(h % n_frames, 4) for h in hits if h < max(n_frames, float(meta.get("length_frames", n_frames)) * k)})
        info["seamless"] = bool(fpb) and abs(n_frames / fpb - round(n_frames / fpb)) < 1e-6
        if not info["seamless"]:
            info["warning"] = ("plate length %d f is not a whole number of beats (%.3f f/beat): the beat pattern breaks at "
                               "the loop seam" % (n_frames, fpb))
    else:
        hits = [h for h in hits if h < n_frames + 30]
    accents = [float(x) * k for x in (d.get("bar_frames") or [])]
    if loop:
        accents = sorted({round(a % n_frames, 4) for a in accents})
    return {"hits": hits, "accents": accents, "n": n_frames, "loop": loop, "info": info}


def _dts(B, f):
    """Frames since each hit at or before f (cyclic for loops), nearest first."""
    out = []
    for h in B["hits"]:
        dt = f - h
        if B["loop"]:
            dt = dt % B["n"]
        if dt >= -1.0:
            out.append(dt)
    return sorted(out)


def envelope(B, f, attack=1.0, decay=8.0):
    """0..1: a 1-frame rise ending on each hit, an exponential-ish decay over `decay` frames (ease.js env)."""
    if not B:
        return 0.0
    m = 0.0
    for h in B["hits"]:
        cands = [f - h] + ([f - h - B["n"], f - h + B["n"]] if B["loop"] else [])
        for dt in cands:
            if -attack <= dt <= 0:
                m = max(m, (dt + attack) / attack)
            elif 0 < dt <= decay:
                q = dt / decay
                m = max(m, math.exp(-4.0 * q) * (1.0 - q))
    return m


def rings(B, f, speed=0.018, tau=14.0, amp=0.6, count=2):
    """The last `count` hits as expanding rings: (radius m, amplitude) with radius = speed x frames since the hit."""
    out = []
    for dt in _dts(B, f)[:count] if B else []:
        dt = max(0.0, dt)
        out.append((speed * dt, amp * math.exp(-dt / tau)))
    while len(out) < count:
        out.append((0.0, 0.0))
    return out
