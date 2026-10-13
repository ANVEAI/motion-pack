"""motion-pack / music / grid.py : tempo and frame math (fps <-> samples <-> beats).
Tempo snap rule: pick BPM so that one beat is a WHOLE number of frames: n = round(fps*60/bpm), bpm_snap = fps*60/n. Every beat, bar and cut is then frame-exact with
no rounding drift. 120, 100, 90, 75 BPM are already integer at 30 fps; 110, 128, 140 are not (they snap to 112.5, 128.57, 138.46)."""
import json
import os
import _path  # noqa: F401
from mpaudio.dsp import SR

CUT_PATTERNS = {            # in beats; cycled until the requested bars are filled
    "steady_beat": [1],
    "bar_hold": [4],
    "two_beat": [2],
    "accelerate": [4, 4, 2, 2, 1, 1, 1, 1],
    "drop_build": [4, 4, 4, 2, 2, 1, 1, 0.5, 0.5, 0.5, 0.5],
    "syncopated": [1.5, 1.5, 1],
    "half_beat": [0.5],
}


def snap_bpm(bpm, fps):
    """returns (bpm_snapped, frames_per_beat int)"""
    n = max(4, round(fps * 60.0 / bpm))
    return fps * 60.0 / n, n


def samples_per_frame(fps):
    assert SR % fps == 0, "fps must divide 48000 (24, 25, 30, 48, 50, 60)"
    return SR // fps


def frame_to_sample(f, fps):
    return int(round(f * SR / fps))


def beat_samples(bpm, fps):
    b, fpb = snap_bpm(bpm, fps)
    return fpb * samples_per_frame(fps)


def tempo_map(bpm, fps=30, bars=16, beats_per_bar=4, start_frame=0):
    b, fpb = snap_bpm(bpm, fps)
    beats = [start_frame + i * fpb for i in range(bars * beats_per_bar)]
    return {"fps": fps, "bpm_requested": bpm, "bpm": round(b, 4), "frames_per_beat": fpb, "frames_per_bar": fpb * beats_per_bar, "beat_seconds": round(fpb / fps, 5),
            "bar_seconds": round(fpb * beats_per_bar / fps, 5), "samples_per_beat": fpb * samples_per_frame(fps), "bars": bars, "beat_frames": beats,
            "bar_frames": beats[::beats_per_bar], "riser_1bar_s": round(fpb * beats_per_bar / fps, 5), "snap_error_pct": round(100 * (b - bpm) / bpm, 3)}


def tempo_ramp_map(bpm0, bpm1, fps=30, bars=8, beats_per_bar=4, start_frame=0, curve="linear"):
    """accelerating / decelerating tempo that stays frame-exact: tempo changes per BAR (linear in BPM from bpm0 to bpm1 across the bars), and every bar
    snaps to a whole number of frames per beat. Returns per-bar fpb / bpm and every beat and bar frame (integers)."""
    fpbs, bpms, beats, bar_frames = [], [], [], []
    f = start_frame
    for b in range(bars):
        u = b / max(1, bars - 1)
        target = bpm0 + (bpm1 - bpm0) * (u if curve == "linear" else u * u)
        bs, fpb = snap_bpm(target, fps)
        fpbs.append(fpb)
        bpms.append(round(bs, 4))
        bar_frames.append(f)
        for k in range(beats_per_bar):
            beats.append(f + k * fpb)
        f += fpb * beats_per_bar
    return {"fps": fps, "bpm_from": bpm0, "bpm_to": bpm1, "bars": bars, "bar_frames_per_beat": fpbs, "bar_bpm": bpms, "beat_frames": beats, "bar_frames": bar_frames,
            "end_frame": f, "length_s": round((f - start_frame) / fps, 4)}


def cut_map(bpm, fps=30, bars=8, pattern="steady_beat", start_frame=0, drop_on_bar=True):
    """list of cut frames. Cuts snap to the frame grid (integer frames per beat => exact for whole beats). Returns frames and the beat positions."""
    _, fpb = snap_bpm(bpm, fps)
    pat = CUT_PATTERNS[pattern] if isinstance(pattern, str) else list(pattern)
    total = bars * 4.0
    pos, i, cuts = 0.0, 0, []
    while pos < total - 1e-9:
        cuts.append((round(start_frame + pos * fpb), pos))
        pos += pat[i % len(pat)]
        i += 1
    return {"frames": [c[0] for c in cuts], "beats": [c[1] for c in cuts], "pattern": pattern, "frames_per_beat": fpb,
            "end_frame": start_frame + round(total * fpb)}


def write_tempo_maps(path, bpms=(75, 90, 100, 105, 110, 112.5, 120, 128, 138, 140, 150), fps_list=(24, 30, 60)):
    out = {}
    for fps in fps_list:
        for b in bpms:
            tm = tempo_map(b, fps, 8)
            out["%s@%dfps" % (b, fps)] = {k: tm[k] for k in ("bpm", "frames_per_beat", "frames_per_bar", "bar_seconds", "riser_1bar_s", "snap_error_pct")}
    # tempo ramps (frame-exact per bar): anthem 100 -> 128 BPM over 8 and 16 bars, and a slow-down 128 -> 100
    out["ramps"] = {"%s->%s@%dfps/%dbars" % (a, b, fps, bars): {k: v for k, v in tempo_ramp_map(a, b, fps, bars).items() if k not in ("beat_frames",)}
                    for fps in fps_list for (a, b, bars) in ((100, 128, 8), (100, 128, 16), (128, 100, 8))}
    json.dump(out, open(path, "w"), indent=1)
    return out
