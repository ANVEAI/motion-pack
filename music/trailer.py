"""motion-pack / music / trailer.py : the trailer-arc bed (music.bed_trailer_arc). NOT a loop.
render_trailer(name="trailer_arc", fps=30, seed=1, act_bars=None) -> dict(stems={drums,bass,harmony,lead,fx}, mix, events=[...], meta={...}, markers={...})
Shape (presets.TRAILERS): act 1 low drone + sub pulse -> act 2 rising 16th ostinato -> act 3 full wall (taiko, strings, brass) -> a planned gap
(sub only, gap_below_wall_db under the wall) -> a crescendo -> the title hit (hard stop: every layer but the hit ends ON the hit sample) -> a quiet hold whose
last 0.15 s is digital zero (applied after mastering by build_music.py: finish()). Every marker is a whole number of beats, so a whole frame at any fps.
Owned synthesis only (sfx/mpaudio instruments + instruments_ext, the noise riser of sfx/recipes/risers.py); deterministic for a seed."""
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, instruments as I, instruments_ext as X
from mpaudio.dsp import SR
import compose as C
import grid
from presets import TRAILERS

STEMS = ("drums", "bass", "harmony", "lead", "fx")
MARKER_DOC = {"act1_start": "act 1: low drone + sub pulse", "act2_start": "act 2: rising 16th ostinato", "act3_start": "act 3: the full wall (crash + impact here)",
              "gap_start": "the wall stops dead; sub-only valley begins", "gap_end": "valley ends (= crescendo_start)", "crescendo_start": "crescendo begins (an audible onset)",
              "hit": "title hit and hard stop: the hit's attack sample is hit x SR/fps", "visual_cut_frame": "cut picture to black here (one frame BEFORE the hit: house rule R1)",
              "quiet_hold_start": "the hit has rung out (< -50 dB under the hit); near-silence from here", "end": "last frame (exclusive); the last 0.15 s is digital zero"}


def markers(name="trailer_arc", fps=30, act_bars=None):
    """marker beats and frames. act_bars: (a1, a2, a3) whole bars (the length rule: trim / extend only before the gap)."""
    p = TRAILERS[name]
    a = tuple(act_bars or p["act_bars"])
    assert len(a) == 3 and all(isinstance(b, int) and b >= 1 for b in a), "act_bars must be three whole bar counts >= 1"
    bpm, fpb = grid.snap_bpm(p["bpm"], fps)
    b = {"act1_start": 0, "act2_start": 4 * a[0], "act3_start": 4 * (a[0] + a[1]), "gap_start": 4 * sum(a)}
    b["gap_end"] = b["crescendo_start"] = b["gap_start"] + p["gap_beats"]
    b["hit"] = b["crescendo_start"] + 4 * p["cresc_bars"]
    b["quiet_hold_start"] = b["hit"] + p["ring_beats"]
    b["end"] = b["quiet_hold_start"] + p["hold_beats"]
    fr = {k: v * fpb for k, v in b.items()}
    fr["visual_cut_frame"] = fr["hit"] - 1
    return {"bpm": round(bpm, 4), "frames_per_beat": fpb, "act_bars": list(a), "beats": b, "frames": fr, "seconds": {k: round(v / fps, 4) for k, v in fr.items()}}


class Trailer:
    def __init__(self, name="trailer_arc", fps=30, seed=1, act_bars=None):
        self.p = p = TRAILERS[name]
        self.name, self.fps, self.seed = name, fps, seed
        self.mk = markers(name, fps, act_bars)
        self.fpb = self.mk["frames_per_beat"]
        self.spb = self.fpb * grid.samples_per_frame(fps)          # samples per beat (exact)
        self.step = self.spb // 4                                    # 16th (exact: fpb x 1600 / 4 at 30 fps)
        self.root = 48 + p["key"]                                    # A3 = 57
        self.n = self.mk["beats"]["end"] * self.spb
        self.stems = {k: np.zeros((self.n, 2)) for k in STEMS}
        self.hit_layer = np.zeros((self.n, 2))
        self.events = []
        B = self.mk["beats"]
        self.S = {k: v * self.spb for k, v in B.items()}             # marker samples

    # ---- helpers
    def put(self, stem, sig, pos, gain=1.0, pan=0.0):
        sig = np.asarray(sig, float)
        if sig.ndim == 1:
            sig = dsp.pan_st(sig, pan)
        dsp.add_at(self.stems[stem] if stem != "hit" else self.hit_layer, sig, int(pos), gain)

    def event(self, kind, pos, **kw):
        self.events.append({"kind": kind, "sample": int(pos), "frame": round(pos * self.fps / SR, 2), **kw})

    def chord(self, roman, octave=0):
        scale = "harmonic_minor" if roman == "V" else self.p["scale"]   # a major dominant into the tonic hit
        return [m + 12 * octave for m in C.chord_midi(self.root, scale, roman)]

    @staticmethod
    def hz(m):
        return dsp.note_hz(m)

    def boom(self, pos, vel=1.0, seed=0):
        """low pulse: a long pitched-down sub kick"""
        self.put("drums", I.kick(self.seed + seed, 92.0, 38.0, 0.05, 0.55, 0.06, 1.6), pos, vel)
        self.event("kick", pos)

    def ostinato(self, bar_t0, roman, vel, fc, double=False, steps=range(16)):
        """16th string-like ostinato (saw bass voice), accents 3+3+3+3+4; optional octave doubling"""
        r = self.chord(roman)[0] - 12                                  # around A2 .. E3
        while r > 52:
            r -= 12
        offs = [0, 0, 12, 0, 0, 12, 0, 7, 0, 12, 0, 7, 0, 12, 7, 12]
        for i in steps:
            acc = 1.0 if i in (0, 3, 6, 9, 12) else 0.62
            pos = bar_t0 + i * self.step
            f = self.hz(r + offs[i])
            self.put("bass", I.bass_saw(f, self.step * 0.78 / SR, 1.0, self.seed + i, fc), pos, vel * acc, -0.15 if i % 2 else 0.15)
            if double:
                self.put("harmony", I.bass_saw(f * 2, self.step * 0.6 / SR, 1.0, self.seed + 40 + i, fc * 1.6), pos, vel * acc * 0.45, 0.35 if i % 2 else -0.35)

    def strings(self, pos, roman, dur, vel, octave=1, trem=0.0, fc=2600.0, stem="harmony"):
        ch = self.chord(roman, octave)
        for j, m in enumerate(ch):
            self.put(stem, X.strings_trem(self.hz(m), dur, self.seed + j + int(pos) % 97, 1.0, trem, 4, fc), pos, vel, [-0.4, 0.0, 0.4][j % 3])

    # ---- the arc
    def build(self):
        p, S, st, spb = self.p, self.S, self.step, self.spb
        bar = 4 * spb
        a1, a2, a3 = self.mk["act_bars"]
        # act 1 (and under acts 2-3): drone on A1 + E2, cut at the gap
        dl = (S["gap_start"] - S["act1_start"]) / SR
        self.put("bass", I.pad(self.hz(self.root - 24), dl, 1.0, self.seed + 1, 6.0, 300.0, 2.5, 0.3, 3), S["act1_start"], 0.9)
        self.put("bass", I.pad(self.hz(self.root - 17), dl, 1.0, self.seed + 2, 6.0, 360.0, 3.5, 0.3, 3), S["act1_start"], 0.35)
        for b in range(a1):
            t0 = S["act1_start"] + b * bar
            self.boom(t0, 0.85, b)
            if b >= 1:
                self.boom(t0 + 3 * st, 0.45, 50 + b)                 # heartbeat: the second, softer pulse a dotted 8th later
            if b >= a1 - 2:                                           # dark low strings swell into act 2
                self.strings(t0, p["prog_act1"][b % 4], 4 * spb / SR, 0.12 + 0.08 * (b - (a1 - 2)), 0, 0.0, 900.0)
        # act 2: rising ostinato (roots climb i -> III -> iv -> V), filter opens, taiko enters
        for b in range(a2):
            t0 = S["act2_start"] + b * bar
            u = b / max(1, a2 - 1)
            rom = p["prog_act2"][b % 4]
            self.ostinato(t0, rom, 0.55 + 0.35 * u, 500.0 * (2200.0 / 500.0) ** u, double=b >= a2 // 2)
            self.strings(t0, rom, 4 * spb / SR, 0.18 + 0.2 * u, 1, 0.0, 1400.0 + 1000 * u)
            self.boom(t0, 0.8, 100 + b)
            if b >= a2 // 2:
                for i in (0, 8):
                    self.put("drums", X.taiko(self.seed + 200 + b * 16 + i, 62.0, 0.6 + 0.3 * u, room=False), t0 + i * st, 0.8)
                    self.event("taiko", t0 + i * st)
            if b == a2 - 1:
                for i in (12, 13, 14, 15):
                    self.put("drums", I.tom(self.seed + 300 + i, 110.0, 0.7 + 0.05 * (i - 12)), t0 + i * st, 0.7)
        self._riser(S["act3_start"], 1, 0.7)
        self._crash_impact(S["act3_start"], "drop")
        # act 3: the full wall (taiko ostinato, sub kicks, snares, 16th ticks, ostinato + sub bass, tremolo strings in two octaves, brass stabs + a brass line)
        top = [76, 77, 76, 74]                                        # E5 F5 E5 D5: chord tones of i VI III VII
        for b in range(a3):
            t0 = S["act3_start"] + b * bar
            rom = p["prog_act3"][b % 4]
            for i, v in ((0, 1.0), (6, 0.9), (8, 1.0), (11, 0.7), (14, 0.7), (15, 0.75)):
                self.put("drums", X.taiko(self.seed + 400 + b * 16 + i, 60.0, v, room=False), t0 + i * st, 0.95)
                self.event("taiko", t0 + i * st)
            for i in (0, 8):
                self.put("drums", I.kick(self.seed + 500 + b * 16 + i, 120.0, 40.0, 0.04, 0.42, 0.15, 0.8, 0.6), t0 + i * st, 0.9)
                self.event("kick", t0 + i * st)
            for i in (4, 12):
                self.put("drums", I.snare(self.seed + 600 + b * 16 + i, 1.0), t0 + i * st, 0.6)
                self.event("snare", t0 + i * st)
            for i in range(16):
                self.put("drums", I.hat(self.seed + 700 + b * 16 + i, False, 0.5 if i % 4 else 0.8), t0 + i * st, 0.35, 0.3 if i % 2 else -0.3)
            if b > 0:
                self.put("drums", np.asarray(dsp.lp(I.hat(self.seed + 800 + b, True, 1.0, 1.4), 12000)), t0, 0.45)
            self.ostinato(t0, rom, 1.0, 2600.0, double=True)
            r = self.chord(rom)[0] - 24
            for i in range(0, 16, 2):
                self.put("bass", I.bass_sub(self.hz(r), 2 * st * 0.9 / SR, 1.0), t0 + i * st, 0.9)
            self.strings(t0, rom, 4 * spb / SR, 0.5, 1, 10.0, 4000.0)
            self.strings(t0, rom, 4 * spb / SR, 0.3, 2, 10.0, 5000.0)
            for i in (0, 6, 10):
                fr = [self.hz(m) for m in [self.chord(rom)[0] - 12] + self.chord(rom)]
                self.put("harmony", X.brass_stab(fr, 0.32 if i else 0.5, self.seed + 900 + b * 16 + i, 1.0), t0 + i * st, 0.55)
            self.put("lead", X.brass_stab([self.hz(top[b % 4])], 4 * spb / SR * 0.9, self.seed + 950 + b, 0.9), t0, 0.7)
            self.event("note", t0, midi=top[b % 4])
        # the planned gap: everything above stops dead at gap_start (a 12 ms fade); only a sustained sub on A1 remains (level set in render())
        self.gap_sub = np.zeros((self.n, 2))
        gl = S["crescendo_start"] - S["gap_start"]
        t = np.arange(gl + dsp.ms(400)) / SR
        sub = np.sin(2 * np.pi * self.hz(self.root - 24) * t) * np.minimum(1.0, t / 0.25) * np.exp(-t / 6.0)
        sub *= np.where(t < gl / SR, 1.0, np.cos(np.clip((t - gl / SR) / 0.4, 0, 1) * np.pi / 2) ** 2)   # hands over to the crescendo
        dsp.add_at(self.gap_sub, dsp.pan_st(sub, 0.0), S["gap_start"])
        # crescendo: VI -> V; the first beat is an audible onset (taiko + strings attack); strings, ostinato, snare roll and taiko swell into the hit
        c0, cb = S["crescendo_start"], p["cresc_bars"]
        self.put("drums", X.taiko(self.seed + 1000, 58.0, 0.8, room=False), c0, 0.9)
        self.event("taiko", c0)
        self.boom(c0, 0.9, 1001)
        for b in range(cb):
            t0 = c0 + b * bar
            rom = p["prog_cresc"][b % len(p["prog_cresc"])]
            self.strings(t0, rom, 4 * spb / SR + 0.05, 0.6, 1, 12.0 + 4 * b, 2400.0 + 1200 * b)
            self.strings(t0, rom, 4 * spb / SR + 0.05, 0.35, 2, 12.0 + 4 * b, 3400.0)
            self.ostinato(t0, rom, 0.9, 1800.0 + 1200 * b, double=b > 0)
            r = self.chord(rom)[0] - 24
            for i in range(0, 16, 2):
                self.put("bass", I.bass_sub(self.hz(r), 2 * st * 0.9 / SR, 1.0), t0 + i * st, 0.8)
            taiko_steps = (0, 8) if b < cb - 1 else (0, 4, 8, 10, 12, 13, 14, 15)
            for i in taiko_steps:
                if b == 0 and i == 0:
                    continue
                self.put("drums", X.taiko(self.seed + 1100 + b * 16 + i, 60.0, 0.85, room=False), t0 + i * st, 0.9)
                self.event("taiko", t0 + i * st)
        # snare roll: 8ths, then 16ths, then 32nds over the last 2 beats
        rolls, pos, total = [], c0, S["hit"] - c0
        while pos < S["hit"]:
            u = (pos - c0) / total
            rolls.append(pos)
            pos += 2 * st if u < 0.5 else (st if u < 0.75 else st // 2)
        for k, pos in enumerate(rolls):
            u = (pos - c0) / total
            self.put("drums", I.snare(self.seed + 1200 + k, 0.5 + 0.5 * u, 0.25), pos, 0.35 + 0.45 * u, 0.2 * np.sin(k))
            self.event("snare", pos)
        self._riser(S["hit"], cb, 0.9)
        # title hit (own layer: it alone continues past the hard stop)
        h = S["hit"]
        ch = [self.root - 12, self.root - 5, self.root, self.root + 3, self.root + 7]   # A2 E3 A3 C4 E4: A minor, open voicing
        self.put("hit", X.taiko(self.seed + 1300, 50.0, 1.0, room=False), h, 1.0)
        self.put("hit", I.kick(self.seed + 1301, 130.0, 34.0, 0.06, 0.9, 0.3, 3.0, 0.4), h, 1.0)
        self.put("hit", np.asarray(dsp.lp(I.hat(self.seed + 1302, True, 1.0, 2.0), 11000)), h, 0.8)
        self.put("hit", X.brass_stab([self.hz(m) for m in ch], 0.9, self.seed + 1303, 1.0), h, 0.8)
        for j, m in enumerate((self.root - 24, self.root - 12)):
            self.put("hit", X.strings_trem(self.hz(m), 1.2, self.seed + 1304 + j, 1.0, 0.0, 5, 1200.0), h, 0.6, [-0.3, 0.3][j])
        self.event("hit", h)
        return self

    def _riser(self, end, bars, gain):
        from recipes.risers import riser_noise
        ln = bars * 4 * self.spb - grid.samples_per_frame(self.fps)      # ends ONE frame before the downbeat (house rule)
        r = dsp.fade_out(riser_noise(ln, self.seed + end % 1009, burst=False), dsp.ms(5)) * 0.8
        self.put("fx", r, end - bars * 4 * self.spb, gain)
        self.event("riser", end - bars * 4 * self.spb, bars=bars)

    def _crash_impact(self, pos, kind):
        self.put("fx", np.asarray(dsp.lp(I.hat(self.seed + pos % 991, True, 1.0, 1.6), 12000)), pos, 0.8)
        self.put("fx", I.kick(self.seed + pos % 997, 120.0, 38.0, 0.05, 0.5, 0.3, 1.0, 0.6), pos, 0.8)
        self.event(kind, pos)

    # ---- render: stem balance, the hard cuts, the sub level, the crescendo curve, the hit ring-out
    def render(self):
        S, n = self.S, self.n
        gs, c0, h, hold = S["gap_start"], S["crescendo_start"], S["hit"], S["quiet_hold_start"]
        trims = {"drums": 0.6, "bass": 0.5, "harmony": 2.1, "lead": 0.8, "fx": 0.3}
        stems = {k: v * trims[k] for k, v in self.stems.items()}
        tt = np.arange(n)
        cut = dsp.ms(12)
        g = np.ones(n)
        g[gs - cut:gs] = np.cos(np.linspace(0, np.pi / 2, cut)) ** 2      # the wall stops dead at gap_start
        g[gs:c0] = 0.0                                                      # nothing but the sub in the valley (ring-outs of the wall are cut)
        u = np.clip((tt - c0) / max(1, h - c0), 0, 1)
        cres = 10 ** ((-20.0 + 20.0 * u ** 1.6) / 20)                       # crescendo: -20 dB -> 0 dB into the hit
        g = np.where(tt >= c0, cres, g)
        hc = dsp.ms(2)
        g[h - hc:h] *= np.cos(np.linspace(0, np.pi / 2, hc)) ** 2           # hard stop: every layer ends ON the hit sample
        g[h:] = 0.0
        for k in stems:
            stems[k] = stems[k] * g[:, None]
        # the hit: hall, then a ring-out that is < -50 dB under the hit by quiet_hold_start, and zero by end - 0.15 s
        hit = dsp.reverb(self.hit_layer, "hall", 0.22, self.seed)[:n] * 1.6
        th = (tt - h) / SR
        ring = np.where(th < 0.35, 1.0, np.exp(-(th - 0.35) / 0.32))
        zero_at = n - dsp.ms(150)
        fade = np.clip((zero_at - tt) / max(1, zero_at - hold), 0, 1)
        hit *= (ring * fade)[:, None]
        hit[:h] = 0.0
        stems["fx"] = stems["fx"] + hit
        # the gap sub: gap_below_wall_db under the wall's RMS (measured on the pre-master mix: deterministic)
        mix = sum(stems.values())
        wall = mix[S["act3_start"]:gs]
        wall_rms = np.sqrt(np.mean(wall ** 2))
        sub_rms = np.sqrt(np.mean(self.gap_sub[gs:c0] ** 2))
        sub = self.gap_sub * (wall_rms * 10 ** (-self.p["gap_below_wall_db"] / 20) / (sub_rms + 1e-12))
        stems["bass"] = stems["bass"] + sub
        out = {}
        for k, v in stems.items():
            if np.max(np.abs(v)) > 0:
                v = np.stack([dsp.fft_filter(v[:, 0], 25.0, None, 2), dsp.fft_filter(v[:, 1], 25.0, None, 2)], 1)
                v[zero_at:] = 0.0
            out[k] = v
        return out


def render_trailer(name="trailer_arc", fps=30, seed=1, act_bars=None):
    tr = Trailer(name, fps, seed, act_bars).build()
    stems = tr.render()
    mix = sum(stems.values())
    mk, p = tr.mk, tr.p
    F = mk["frames"]
    fpbar = tr.fpb * 4
    secs = [("act1", "act1_start", "act2_start", 0.2), ("act2", "act2_start", "act3_start", [0.45, 0.75]), ("act3", "act3_start", "gap_start", 1.0),
            ("gap", "gap_start", "gap_end", 0.02), ("crescendo", "crescendo_start", "hit", [0.3, 1.0]), ("hit", "hit", "quiet_hold_start", 1.0), ("hold", "quiet_hold_start", "end", 0.0)]
    sections = [{"name": s, "frame0": F[a], "frames": F[b] - F[a], "bars": round((F[b] - F[a]) / fpbar, 3), "energy": e} for s, a, b, e in secs]
    a1, a2, a3 = mk["act_bars"]
    chords = p["prog_act1"][:a1] + [p["prog_act2"][b % 4] for b in range(a2)] + [p["prog_act3"][b % 4] for b in range(a3)] + p["prog_cresc"][:p["cresc_bars"]] + ["i"]
    bar_frames = [b * fpbar for b in range(a1 + a2 + a3)] + [F["crescendo_start"] + b * fpbar for b in range(p["cresc_bars"])] + [F["hit"]]
    meta = {"preset": name, "structure": name, "seed": seed, "fps": fps, "bpm": mk["bpm"], "bpm_requested": p["bpm"], "frames_per_beat": tr.fpb, "frames_per_bar": fpbar,
            "bars": a1 + a2 + a3 + p["cresc_bars"], "key_midi": tr.root, "scale": p["scale"], "prog": "trailer_arc", "loop": False,
            "length_frames": F["end"], "length_s": round(tr.n / SR, 3), "sections": sections, "chords": chords, "tuning": "et", "act_bars": mk["act_bars"]}
    return {"stems": stems, "mix": mix, "events": sorted(tr.events, key=lambda e: e["sample"]), "meta": meta, "markers": mk, "bar_frames": bar_frames,
            "beat_frames": list(range(0, F["hit"] + 1, tr.fpb))}


def finish(y, fps=30):
    """after mastering: the last 0.15 s is exactly digital zero (the limiter cannot add anything there, this makes it explicit)"""
    y = np.array(y, copy=True)
    y[len(y) - dsp.ms(150):] = 0.0
    return y
