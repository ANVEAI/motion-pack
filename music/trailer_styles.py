"""motion-pack / music / trailer_styles.py : genre trailer scores that build in three acts, with the sections a trailer is cut on (2026-10-16, film lane).
NOT loops. render_styled(style, fps=30, seed=1, act_bars=None, button_beats=None, tail_beats=None) -> dict(stems, mix, events, meta, markers, ...), the same shape as
trailer.render_trailer, so build_music.py and a template can use either.

Sections (every marker is a whole number of BEATS, so a whole frame at any fps after the tempo snap):
  act1   the world: a low bed and a motif (style-specific: ticking clock, cold arpeggio, music box, piano)
  act2   the inciting turn: a pulse / ostinato enters, braam stabs on downbeats, the filter opens
  act3   the escalation wall: drums, doubled ostinato, a braam on EVERY bar downbeat (montage cuts land there)
  gap    the silence before the hit: everything stops dead on gap_start (a 12 ms fade); horror is digital silence, the others keep a faint sub
  cresc  an optional crescendo of `cresc_bars` bars (0 = the hit lands straight out of the silence)
  hit    the title hit (braam + boom + style colour), hard stop on every other layer
  button the post-title beat: near-silence under the button scene (the template puts the sting there)
  tail   the credit block + release card bed; a final hit on `final_hit` (the release card), then a ring-out to digital zero (last 0.15 s = 0)
Owned synthesis only (sfx/mpaudio instruments, sfx/recipes/trailer.py braams and booms); deterministic for a seed. Craft from docs/evidence/film-trailer-craft.md."""
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, instruments as I, instruments_ext as X
from mpaudio.dsp import SR
import compose as C
import grid
from presets import TRAILERS
from recipes import trailer as TS       # braam(), boom(), tension_riser(), _tick(): the same voices as sfx/trailer/*

STEMS = ("drums", "bass", "harmony", "lead", "fx")
STYLES = ("thriller", "scifi", "horror", "drama")
MARKER_DOC = {"act1_start": "act 1 (the world): bed + motif", "act2_start": "act 2 (the inciting turn): pulse / ostinato, braam stabs on downbeats",
              "act3_start": "act 3 (escalation wall): a braam on every bar downbeat", "gap_start": "everything stops dead: the silence before the hit",
              "crescendo_start": "crescendo (or the hit itself when cresc_bars = 0)", "hit": "title hit (attack sample = hit x SR / fps); cut picture on visual_cut_frame = hit - 1",
              "button_start": "post-title near-silence: the button scene and its sting", "tail_start": "credit block + release card bed", "final_hit": "the release-card hit",
              "end": "last frame (exclusive); the last 0.15 s is digital zero"}


def styled_markers(style, fps=30, act_bars=None, button_beats=None, tail_beats=None):
    p = TRAILERS["trailer_" + style]
    a = tuple(act_bars or p["act_bars"])
    assert len(a) == 3 and all(isinstance(b, int) and b >= 1 for b in a), "act_bars must be three whole bar counts >= 1"
    bb = int(p["button_beats"] if button_beats is None else button_beats)
    tb = int(p["tail_beats"] if tail_beats is None else tail_beats)
    assert bb >= 0 and tb >= 4, "button_beats >= 0, tail_beats >= 4"
    bpm, fpb = grid.snap_bpm(p["bpm"], fps)
    b = {"act1_start": 0, "act2_start": 4 * a[0], "act3_start": 4 * (a[0] + a[1]), "gap_start": 4 * sum(a)}
    b["gap_end"] = b["crescendo_start"] = b["gap_start"] + p["gap_beats"]
    b["hit"] = b["crescendo_start"] + 4 * p["cresc_bars"]
    b["button_start"] = b["hit"] + p["ring_beats"]
    b["tail_start"] = b["button_start"] + bb
    b["final_hit"] = b["tail_start"] + min(tb - 3, p["final_hit_beat"])
    b["end"] = b["tail_start"] + tb
    fr = {k: v * fpb for k, v in b.items()}
    fr["visual_cut_frame"] = fr["hit"] - 1
    return {"style": style, "bpm": round(bpm, 4), "frames_per_beat": fpb, "act_bars": list(a), "button_beats": bb, "tail_beats": tb, "beats": b, "frames": fr,
            "seconds": {k: round(v / fps, 4) for k, v in fr.items()}}


class Styled:
    def __init__(self, style, fps=30, seed=1, act_bars=None, button_beats=None, tail_beats=None):
        assert style in STYLES, "style must be one of %s" % (STYLES,)
        self.style, self.p = style, TRAILERS["trailer_" + style]
        self.fps, self.seed = fps, seed
        self.mk = styled_markers(style, fps, act_bars, button_beats, tail_beats)
        self.fpb = self.mk["frames_per_beat"]
        self.spb = self.fpb * grid.samples_per_frame(fps)
        self.step = self.spb // 4
        self.root = 48 + self.p["key"]                               # A3 = 57
        self.n = self.mk["beats"]["end"] * self.spb
        self.stems = {k: np.zeros((self.n, 2)) for k in STEMS}
        self.hit_layer = np.zeros((self.n, 2))
        self.tail_layer = np.zeros((self.n, 2))
        self.events = []
        self.S = {k: v * self.spb for k, v in self.mk["beats"].items()}

    # ---------------------------------------------------------------- helpers
    def put(self, stem, sig, pos, gain=1.0, pan=0.0):
        sig = np.asarray(sig, float)
        if sig.ndim == 1:
            sig = dsp.pan_st(sig, pan)
        dst = self.hit_layer if stem == "hit" else self.tail_layer if stem == "tail" else self.stems[stem]
        dsp.add_at(dst, sig, int(pos), gain)

    def event(self, kind, pos, **kw):
        self.events.append({"kind": kind, "sample": int(pos), "frame": round(pos * self.fps / SR, 2), **kw})

    def chord(self, roman, octave=0):
        sc = "harmonic_minor" if roman == "V" else self.p["scale"]
        return [m + 12 * octave for m in C.chord_midi(self.root, sc, roman)]

    hz = staticmethod(dsp.note_hz)

    def braam(self, pos, vel=1.0, notes=None, dur=3.0, stem="harmony", seed=0, short=False):
        if short:
            y, a = TS.braam(self.seed + seed, notes or (TS.A1, TS.E2), dur=1.1, bite=2200.0, close=0.22, growl=0.2, sub=0.7, voices=5, drive=1.6, attack=0.012)
        else:
            y, a = TS.braam(self.seed + seed, notes or (TS.A1, TS.E2, TS.A2), dur=dur)
        self.put(stem, y, pos - a, vel)
        self.event("braam", pos)

    def boom(self, pos, vel=1.0, seed=0, stem="drums"):
        self.put(stem, TS.boom(self.seed + seed), pos, vel)
        self.event("boom", pos)

    def kick(self, pos, vel=1.0, seed=0, long=False):
        k = I.kick(self.seed + seed, 92.0, 38.0, 0.05, 0.55, 0.06, 1.6) if long else I.kick(self.seed + seed, 120.0, 40.0, 0.04, 0.42, 0.15, 0.8, 0.6)
        self.put("drums", k, pos, vel)
        self.event("kick", pos)

    def tick(self, pos, vel=0.6, hi=True, seed=0):
        self.put("fx", TS._tick(self.seed + seed, 2100.0 if hi else 1600.0, 1.0), pos, vel, 0.25 if hi else -0.25)
        self.event("tick", pos)

    def strings(self, pos, roman, dur, vel, octave=1, trem=0.0, fc=2600.0, stem="harmony", cluster=None):
        notes = cluster if cluster is not None else self.chord(roman, octave)
        for j, m in enumerate(notes):
            self.put(stem, X.strings_trem(self.hz(m), dur, self.seed + j + int(pos) % 97, 1.0, trem, 4, fc), pos, vel, [-0.4, 0.0, 0.4][j % 3])

    def ostinato(self, bar_t0, roman, vel, fc, double=False, eighths=False):
        r = self.chord(roman)[0] - 12
        while r > 52:
            r -= 12
        offs = [0, 0, 12, 0, 0, 12, 0, 7, 0, 12, 0, 7, 0, 12, 7, 12]
        for i in range(0, 16, 2 if eighths else 1):
            acc = 1.0 if i in (0, 3, 6, 9, 12) else 0.62
            pos = bar_t0 + i * self.step
            f = self.hz(r + offs[i])
            ln = self.step * (1.6 if eighths else 0.78) / SR
            self.put("bass", I.bass_saw(f, ln, 1.0, self.seed + i, fc), pos, vel * acc, -0.15 if i % 2 else 0.15)
            if double:
                self.put("harmony", I.bass_saw(f * 2, ln * 0.8, 1.0, self.seed + 40 + i, fc * 1.6), pos, vel * acc * 0.45, 0.35 if i % 2 else -0.35)

    def riser(self, end, bars, gain):
        y, _ = TS.tension_riser(self.seed + end % 1009, bars)
        y = y[:max(1, len(y) - grid.samples_per_frame(self.fps))]       # ends ONE frame before the downbeat (house rule)
        self.put("fx", dsp.fade_out(y, dsp.ms(5)), end - len(y) - grid.samples_per_frame(self.fps), gain)
        self.event("riser", end - bars * 4 * self.spb, bars=bars)

    def snare_roll(self, c0, end, gain=0.7):
        pos, total, k = c0, max(1, end - c0), 0
        st = self.step
        while pos < end:
            u = (pos - c0) / total
            self.put("drums", I.snare(self.seed + 1200 + k, 0.5 + 0.5 * u, 0.25), pos, (0.35 + 0.45 * u) * gain, 0.2 * np.sin(k))
            self.event("snare", pos)
            pos += 2 * st if u < 0.5 else (st if u < 0.75 else st // 2)
            k += 1

    def bars(self, a, b):
        bar = 4 * self.spb
        return [self.S[a] + i * bar for i in range((self.S[b] - self.S[a]) // bar)]

    # ---------------------------------------------------------------- the arc (shared skeleton, style colour per act)
    def build(self):
        getattr(self, "build_" + self.style)()
        self.hit()
        self.tail()
        return self

    def hit(self):
        h, p = self.S["hit"], self.p
        r = self.root
        self.braam(h, 1.0, (TS.A1, TS.E2, TS.A2, TS.E3) if self.style != "horror" else (TS.A1, 58.27, TS.E2), 4.0, "hit", 900)
        self.put("hit", TS.boom(self.seed + 901, 130.0, 30.0, 0.25, 1.0, 4.0), h, 1.0)
        if self.style in ("thriller", "drama"):
            self.put("hit", X.taiko(self.seed + 902, 50.0, 1.0, room=False), h, 0.9)
        if self.style == "scifi":
            self.put("hit", I.bell(self.hz(r + 24), 3.0, 3.0, 4.0, 1.4, 1.0, self.seed), h, 0.35)
        if self.style == "horror":
            for j, m in enumerate((r, r + 1, r + 6, r + 12)):                         # the shock cluster
                self.put("hit", X.strings_trem(self.hz(m), 1.4, self.seed + 903 + j, 1.0, 0.0, 4, 3000.0), h, 0.35, [-0.4, 0.4][j % 2])
        if self.style == "drama":
            ch = [r - 12, r - 5, r, r + 3, r + 7]
            self.put("hit", X.brass_stab([self.hz(m) for m in ch], 1.2, self.seed + 904, 1.0), h, 0.7)
        self.event("hit", h)

    def tail(self):
        t0, fh, end, p = self.S["tail_start"], self.S["final_hit"], self.S["end"], self.p
        ln = (end - t0) / SR
        r = self.root
        self.put("tail", I.pad(self.hz(r - 24), ln, 1.0, self.seed + 70, 6.0, 260.0, 1.2, 0.4, 3), t0, 0.9)
        self.put("tail", I.pad(self.hz(r - 17), ln, 1.0, self.seed + 71, 6.0, 320.0, 1.6, 0.4, 3), t0, 0.35)
        if self.style in ("thriller", "scifi"):                                       # a low 8th pulse under the credits
            for i in range(0, (fh - t0) // (self.spb // 2)):
                self.put("tail", I.bass_sub(self.hz(r - 24), self.spb / 2 * 0.8 / SR, 1.0), t0 + i * self.spb // 2, 0.55 * (0.5 + 0.5 * i / max(1, (fh - t0) // (self.spb // 2))))
        if self.style == "drama":
            for i, m in enumerate((r, r + 3, r + 7, r + 12)):
                self.put("tail", I.keys(self.hz(m), 0.9, 1.0, self.seed + 80 + i), t0 + i * self.spb, 0.5)
        if self.style == "horror":
            for i, m in enumerate((r + 24, r + 25, r + 31)):
                self.put("tail", I.bell(self.hz(m), 1.4, 1.4, 3.0, 2.0, 1.0, self.seed + 85 + i), t0 + i * self.spb, 0.18)
        y, a = TS.braam(self.seed + 950, (TS.A1, TS.E2, TS.A2), dur=3.0)
        self.put("tail", y, fh - a, 0.9)
        self.put("tail", TS.boom(self.seed + 951), fh, 0.9)
        self.event("final_hit", fh)

    # ---------------------------------------------------------------- styles
    def build_thriller(self):
        S, st, spb, r = self.S, self.step, self.spb, self.root
        dl = (S["gap_start"]) / SR
        self.put("bass", I.pad(self.hz(r - 24), dl, 1.0, self.seed + 1, 6.0, 300.0, 2.5, 0.3, 3), 0, 0.9)
        for i, b0 in enumerate(self.bars("act1_start", "act2_start")):
            for q in range(4):
                self.tick(b0 + q * spb, 0.5, q % 2 == 0, q)
            self.kick(b0, 0.8, i, long=True)
            if i >= 1:
                self.kick(b0 + 2 * spb, 0.45, 50 + i, long=True)
            if i >= len(self.bars("act1_start", "act2_start")) - 2:
                self.strings(b0, "i", 4 * spb / SR, 0.14, 0, 0.0, 900.0)
        a2 = self.bars("act2_start", "act3_start")
        prog = self.p["prog_act2"]
        for i, b0 in enumerate(a2):
            u = i / max(1, len(a2) - 1)
            rom = prog[i % 4]
            self.ostinato(b0, rom, 0.55 + 0.35 * u, 500.0 * (2200.0 / 500.0) ** u, double=i >= len(a2) // 2)
            for q in range(8):
                self.tick(b0 + q * 2 * st, 0.4 + 0.2 * u, q % 2 == 0, 10 + q)
            self.strings(b0, rom, 4 * spb / SR, 0.16 + 0.2 * u, 1, 0.0, 1400.0 + 1000 * u)
            if i % 2 == 0:
                self.braam(b0, 0.55 + 0.3 * u, short=True, seed=20 + i)
            else:
                self.kick(b0, 0.8, 100 + i, long=True)
        self.riser(S["act3_start"], 1, 0.6)
        a3 = self.bars("act3_start", "gap_start")
        prog = self.p["prog_act3"]
        for i, b0 in enumerate(a3):
            rom = prog[i % 4]
            last = i == len(a3) - 1
            self.braam(b0, 1.0, (TS.A1, TS.A2, 130.81, TS.E3) if last else None, 2.2, "harmony", 200 + i)
            for q in (0, 8):
                self.kick(b0 + q * st, 0.9, 500 + i * 16 + q)
            for q in (4, 12):
                self.put("drums", I.snare(self.seed + 600 + i * 16 + q, 1.0), b0 + q * st, 0.55)
            for q in range(16):
                self.tick(b0 + q * st, 0.35, q % 2 == 0, 700 + q)
            self.ostinato(b0, rom, 1.0, 2600.0, double=True)
            self.strings(b0, rom, 4 * spb / SR, 0.45, 1, 10.0, 4000.0)
            self.strings(b0, rom, 4 * spb / SR, 0.25, 2, 10.0, 5000.0)
            for q in (0, 6, 10):
                self.put("drums", X.taiko(self.seed + 400 + i * 16 + q, 60.0, 0.9, room=False), b0 + q * st, 0.8)

    def build_scifi(self):
        S, st, spb, r = self.S, self.step, self.spb, self.root
        dl = S["gap_start"] / SR
        for j, m in enumerate((r - 24, r - 12, r - 5, r + 2)):                       # cold pad: A1 A2 E3 B3 (add9)
            self.put("harmony", I.pad(self.hz(m), dl, 1.0, self.seed + 10 + j, 12.0, 700.0 + 200 * j, 3.0, 0.4, 3), 0, 0.28, [-0.5, 0.5, -0.2, 0.2][j])
        arp = [r + 12, r + 15, r + 19, r + 24, r + 19, r + 15, r + 14, r + 19]
        a1 = self.bars("act1_start", "act2_start")
        for i, b0 in enumerate(a1):
            for q in range(8):
                self.put("lead", I.bell(self.hz(arp[q]), 0.5, 0.9, 2.0, 2.0, 1.0, self.seed + q), b0 + q * 2 * st, 0.16 + 0.04 * (i / max(1, len(a1))), 0.5 * np.sin(q))
            if i % 2 == 0:
                self.kick(b0, 0.7, i, long=True)
        a2 = self.bars("act2_start", "act3_start")
        for i, b0 in enumerate(a2):
            u = i / max(1, len(a2) - 1)
            rom = self.p["prog_act2"][i % 4]
            self.ostinato(b0, rom, 0.5 + 0.35 * u, 600.0 * (3000.0 / 600.0) ** u, double=i >= len(a2) // 2, eighths=True)
            for q in range(16):
                self.put("lead", I.bell(self.hz(arp[q % 8] + (12 if q % 4 == 3 else 0)), 0.25, 0.5, 2.5, 2.0, 1.0, self.seed + 30 + q), b0 + q * st, 0.12 + 0.06 * u, 0.6 * np.sin(q * 0.7))
            if i % 2 == 0:
                self.braam(b0, 0.5 + 0.3 * u, short=True, seed=40 + i)
            self.kick(b0 + 8 * st, 0.6, 60 + i, long=True)
        self.riser(S["act3_start"], 1, 0.6)
        a3 = self.bars("act3_start", "gap_start")
        for i, b0 in enumerate(a3):
            rom = self.p["prog_act3"][i % 4]
            ch = [self.hz(m) for m in self.chord(rom, 1)]
            self.braam(b0, 1.0, None, 2.2, "harmony", 300 + i)
            for q in (0, 4, 8, 12):
                self.kick(b0 + q * st, 0.85, 500 + i * 16 + q)
            for q in (2, 6, 10, 14):
                self.put("harmony", I.stab(ch, 0.18, 1.0, self.seed + 800 + q, 5000.0, 900.0, 0.08), b0 + q * st, 0.35)
            for q in range(16):
                self.put("lead", I.bell(self.hz(arp[q % 8] + 12), 0.2, 0.4, 2.5, 2.0, 1.0, self.seed + 50 + q), b0 + q * st, 0.16, 0.6 * np.sin(q))
            self.ostinato(b0, rom, 1.0, 3200.0, double=True)
            self.strings(b0, rom, 4 * spb / SR, 0.3, 1, 0.0, 3500.0)
        if self.p["cresc_bars"]:
            self.snare_roll(S["crescendo_start"], S["hit"], 0.8)
            self.riser(S["hit"], self.p["cresc_bars"], 0.8)
            for b0 in self.bars("crescendo_start", "hit"):
                self.strings(b0, "V", 4 * spb / SR + 0.05, 0.5, 1, 14.0, 3000.0)

    def build_horror(self):
        S, st, spb, r = self.S, self.step, self.spb, self.root
        dl = S["gap_start"] / SR
        for j, m in enumerate((r - 24, r - 23)):                                       # A1 + Bb1: the minor-second drone
            self.put("bass", I.pad(self.hz(m), dl, 1.0, self.seed + 1 + j, 4.0, 240.0, 3.0, 0.3, 3), 0, 0.55)
        box = [r + 24, r + 27, r + 31, r + 30, r + 27, r + 24, r + 25, r + 24]     # music-box line, the 7th note a flat second
        a1 = self.bars("act1_start", "act2_start")
        for i, b0 in enumerate(a1):
            for q in range(4):
                m = box[(i * 4 + q) % 8]
                self.put("lead", I.bell(self.hz(m) * (1 + 0.003 * np.sin(i + q)), 1.0, 1.4, 3.0, 2.0, 1.0, self.seed + q), b0 + q * spb, 0.16)
            if i % 2 == 1:
                self.boom(b0 + 2 * spb, 0.45, 10 + i)
        a2 = self.bars("act2_start", "act3_start")
        for i, b0 in enumerate(a2):
            u = i / max(1, len(a2) - 1)
            for q in range(4):                                                         # heartbeat on every beat, lub-dub
                self.kick(b0 + q * spb, 0.5 + 0.3 * u, 30 + i * 4 + q, long=True)
                self.kick(b0 + q * spb + int(0.22 * SR), 0.3 + 0.2 * u, 60 + i * 4 + q, long=True)
            self.strings(b0, "i", 4 * spb / SR, 0.12 + 0.25 * u, 0, 6.0, 1200.0 + 1500 * u, cluster=[r - 12, r - 11, r - 6])
            if i % 2 == 1:
                self.put("fx", np.asarray(TS.metal_hit(self.seed + i)), b0 + 3 * spb, 0.4)
        self.riser(S["act3_start"], 1, 0.55)
        a3 = self.bars("act3_start", "gap_start")
        rr = np.random.default_rng(self.seed + 77)
        for i, b0 in enumerate(a3):
            self.braam(b0, 0.9, (TS.A1, 58.27, TS.E2), 2.2, "harmony", 400 + i)
            self.boom(b0, 0.8, 410 + i)
            self.strings(b0, "i", 4 * spb / SR, 0.45, 1, 18.0, 4200.0, cluster=[r, r + 1, r + 6, r + 7])
            self.strings(b0, "i", 4 * spb / SR, 0.3, 2, 18.0, 5200.0, cluster=[r + 12, r + 13, r + 18])
            for q in sorted(rr.choice(16, 5, replace=False)):
                self.put("fx", np.asarray(TS.metal_hit(self.seed + 500 + i * 16 + int(q))), b0 + int(q) * st, 0.35)
            for q in range(0, 16, 2 if i < len(a3) - 1 else 1):
                self.kick(b0 + q * st, 0.55, 600 + i * 16 + q, long=True)

    def build_drama(self):
        S, st, spb, r = self.S, self.step, self.spb, self.root
        prog = self.p["prog_act1"]
        a1 = self.bars("act1_start", "act2_start")
        for i, b0 in enumerate(a1):
            rom = prog[i % 4]
            ch = self.chord(rom, 0)
            self.put("harmony", I.pad(self.hz(ch[0] - 12), 4 * spb / SR, 1.0, self.seed + i, 6.0, 900.0, 0.6, 0.6, 3), b0, 0.25)
            for q, m in enumerate([ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]]):
                self.put("lead", I.keys(self.hz(m), 0.9, 1.0, self.seed + i * 8 + q), b0 + q * 2 * st, 0.32)
        a2 = self.bars("act2_start", "act3_start")
        for i, b0 in enumerate(a2):
            u = i / max(1, len(a2) - 1)
            rom = self.p["prog_act2"][i % 4]
            ch = self.chord(rom, 0)
            self.strings(b0, rom, 4 * spb / SR + 0.1, 0.25 + 0.2 * u, 1, 0.0, 1800.0 + 1200 * u)
            self.ostinato(b0, rom, 0.4 + 0.3 * u, 700.0 + 900 * u, eighths=True)
            for q, m in enumerate([ch[0], ch[1], ch[2], ch[1] + 12]):
                self.put("lead", I.keys(self.hz(m + 12), 0.9, 1.0, self.seed + 100 + i * 4 + q), b0 + q * spb, 0.26)
            if i % 2 == 1:
                self.kick(b0, 0.7, 120 + i, long=True)
        self.riser(S["act3_start"], 1, 0.5)
        a3 = self.bars("act3_start", "gap_start")
        top = [76, 77, 76, 74]
        for i, b0 in enumerate(a3):
            rom = self.p["prog_act3"][i % 4]
            self.strings(b0, rom, 4 * spb / SR + 0.1, 0.55, 1, 0.0, 3800.0)
            self.strings(b0, rom, 4 * spb / SR + 0.1, 0.35, 2, 0.0, 4800.0)
            self.braam(b0, 0.75, None, 2.2, "harmony", 600 + i)
            for q in (0, 8):
                self.put("drums", X.taiko(self.seed + 620 + i * 16 + q, 58.0, 1.0, room=False), b0 + q * st, 0.9)
            self.put("lead", X.brass_stab([self.hz(top[i % 4])], 4 * spb / SR * 0.9, self.seed + 650 + i, 0.9), b0, 0.6)
            self.ostinato(b0, rom, 0.8, 2000.0, double=True, eighths=True)
        if self.p["cresc_bars"]:
            self.snare_roll(S["crescendo_start"], S["hit"], 0.7)
            for b0 in self.bars("crescendo_start", "hit"):
                self.strings(b0, "V", 4 * spb / SR + 0.05, 0.55, 1, 0.0, 3200.0)
                self.strings(b0, "V", 4 * spb / SR + 0.05, 0.35, 2, 0.0, 4200.0)

    # ---------------------------------------------------------------- render: the hard stops, the silence, the crescendo, the hit ring, the tail
    def render(self):
        S, n, p = self.S, self.n, self.p
        gs, c0, h, b0, t0, fh = S["gap_start"], S["crescendo_start"], S["hit"], S["button_start"], S["tail_start"], S["final_hit"]
        trims = {"drums": 0.6, "bass": 0.55, "harmony": 1.4, "lead": 0.9, "fx": 0.5}
        stems = {k: v * trims[k] for k, v in self.stems.items()}
        tt = np.arange(n)
        cut = dsp.ms(12)
        g = np.ones(n)
        g[gs - cut:gs] = np.cos(np.linspace(0, np.pi / 2, cut)) ** 2
        g[gs:c0] = 0.0
        if p["cresc_bars"]:
            u = np.clip((tt - c0) / max(1, h - c0), 0, 1)
            g = np.where(tt >= c0, 10 ** ((-20.0 + 20.0 * u ** 1.6) / 20), g)
        hc = dsp.ms(2)
        g[h - hc:h] *= np.cos(np.linspace(0, np.pi / 2, hc)) ** 2
        g[h:] = 0.0
        for k in stems:
            stems[k] = stems[k] * g[:, None]
        zero_at = n - dsp.ms(150)
        # the hit rings out over the button (it is the button's silence); it is gone by the tail
        hit = dsp.reverb(self.hit_layer, "hall", 0.22, self.seed)[:n] * 1.5
        th = (tt - h) / SR
        ring = np.where(th < 0.4, 1.0, np.exp(-(th - 0.4) / 0.45))
        hit *= ring[:, None]
        hit[:h] = 0.0
        hit[t0:] *= np.cos(np.clip((tt[t0:] - t0) / dsp.ms(300), 0, 1) * np.pi / 2)[:, None] ** 2
        # the tail: fades in from the tail start, the final hit rings to digital zero
        tail = self.tail_layer.copy()
        tail[:t0] = 0.0
        fin = np.clip((tt - t0) / dsp.ms(600), 0, 1) * np.clip((zero_at - tt) / max(1, zero_at - fh - dsp.ms(800)), 0, 1)
        tail *= fin[:, None] * 0.7
        stems["fx"] = stems["fx"] + hit
        stems["harmony"] = stems["harmony"] + tail
        # the gap: horror is digital silence, the others keep a faint sub (gap_below_wall_db under the wall)
        if p["gap_below_wall_db"] < 90:
            gl = c0 - gs
            t = np.arange(gl + dsp.ms(300)) / SR
            sub = np.sin(2 * np.pi * self.hz(self.root - 24) * t) * np.minimum(1.0, t / 0.2) * np.where(t < gl / SR, 1.0, np.cos(np.clip((t - gl / SR) / 0.3, 0, 1) * np.pi / 2) ** 2)
            gsub = np.zeros((n, 2))
            dsp.add_at(gsub, dsp.pan_st(sub, 0.0), gs)
            mix = sum(stems.values())
            wall = np.sqrt(np.mean(mix[S["act3_start"]:gs] ** 2))
            srm = np.sqrt(np.mean(gsub[gs:c0] ** 2))
            stems["bass"] = stems["bass"] + gsub * (wall * 10 ** (-p["gap_below_wall_db"] / 20) / (srm + 1e-12))
        out = {}
        for k, v in stems.items():
            if np.max(np.abs(v)) > 0:
                v = np.stack([dsp.fft_filter(v[:, 0], 25.0, None, 2), dsp.fft_filter(v[:, 1], 25.0, None, 2)], 1)
            v[zero_at:] = 0.0
            if p["gap_below_wall_db"] >= 90:
                v[gs:c0] = 0.0                                                         # digital silence, after the filter (no ringing in)
            out[k] = v
        return out


def render_styled(style, fps=30, seed=1, act_bars=None, button_beats=None, tail_beats=None):
    tr = Styled(style, fps, seed, act_bars, button_beats, tail_beats).build()
    stems = tr.render()
    mix = sum(stems.values())
    mk, p = tr.mk, tr.p
    F = mk["frames"]
    fpbar = tr.fpb * 4
    secs = [("act1", "act1_start", "act2_start", 0.25), ("act2", "act2_start", "act3_start", [0.45, 0.75]), ("act3", "act3_start", "gap_start", 1.0),
            ("gap", "gap_start", "crescendo_start", 0.0 if p["gap_below_wall_db"] >= 90 else 0.02), ("crescendo", "crescendo_start", "hit", [0.3, 1.0]),
            ("hit", "hit", "button_start", 1.0), ("button", "button_start", "tail_start", 0.05), ("tail", "tail_start", "end", [0.3, 0.8])]
    sections = [{"name": s, "frame0": F[a], "frames": F[b] - F[a], "bars": round((F[b] - F[a]) / fpbar, 3), "energy": e} for s, a, b, e in secs if F[b] > F[a]]
    meta = {"preset": "trailer_" + style, "structure": "trailer_styled", "style": style, "seed": seed, "fps": fps, "bpm": mk["bpm"], "bpm_requested": p["bpm"], "frames_per_beat": tr.fpb,
            "frames_per_bar": fpbar, "bars": sum(mk["act_bars"]) + p["cresc_bars"], "key_midi": tr.root, "scale": p["scale"], "prog": "trailer_" + style, "loop": False,
            "length_frames": F["end"], "length_s": round(tr.n / SR, 3), "sections": sections, "tuning": "et", "act_bars": mk["act_bars"]}
    a1, a2, a3 = mk["act_bars"]
    bar_frames = [b * fpbar for b in range(a1 + a2 + a3)] + [F["crescendo_start"] + b * fpbar for b in range(p["cresc_bars"])] + [F["hit"]]
    return {"stems": stems, "mix": mix, "events": sorted(tr.events, key=lambda e: e["sample"]), "meta": meta, "markers": mk, "bar_frames": bar_frames,
            "beat_frames": list(range(0, F["hit"] + 1, tr.fpb))}


def finish(y, fps=30):
    y = np.array(y, copy=True)
    y[len(y) - dsp.ms(150):] = 0.0
    return y


if __name__ == "__main__":
    import sys, json, mixer, soundfile as sf
    style = sys.argv[1] if len(sys.argv) > 1 else "thriller"
    bars = tuple(int(x) for x in sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else None
    r = render_styled(style, 30, 1, bars)
    y, _, _ = mixer.master(r["mix"], -16.0, -1.5)
    out = sys.argv[3] if len(sys.argv) > 3 else "/tmp/trailer_%s.wav" % style
    sf.write(out, finish(y), SR, subtype="PCM_24")
    print(out, json.dumps(r["markers"]["seconds"]))
