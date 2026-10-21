"""motion-pack / music / compose.py : deterministic procedural composer.
compose(preset, structure, seed, fps, ...) -> dict(stems={drums,bass,harmony,lead,fx}, events=[...], meta={...}); each stem is a float32 (n,2) buffer so the
mix can mute / solo / duck stems separately. Everything is an owned synthesis (mpaudio.instruments); no samples.
Design (docs/evidence/sound.md 8.2): scales + progressions, Euclidean drums (Bjorklund), root-fifth-octave bass locked to the kick, voice-led triads, motif + variation
melody (seeded Markov over scale degrees: 70% steps, leaps <= a fifth, ends on chord tones), energy ladder per section (which layers play), a pre-drop gap, tempo
snapped so one beat is a whole number of frames, optional sidechain pump, seamless loops by folding the ring-out tail onto the head."""
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, instruments as I, meter, indian as IN, instruments_ext as X
from mpaudio.dsp import SR
import grid
from presets import PRESETS, PROGRESSIONS, STRUCTURES, TRIMS_DB

SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10], "mixolydian": [0, 2, 4, 5, 7, 9, 10], "pent_major": [0, 2, 4, 7, 9],
          "pent_minor": [0, 3, 5, 7, 10], "harmonic_minor": [0, 2, 3, 5, 7, 8, 11], "lydian": [0, 2, 4, 6, 7, 9, 11], "whole": [0, 2, 4, 6, 8, 10]}
SCALES.update({"raga_" + k: v for k, v in IN.RAGA_SCALES.items()})          # raga_bilawal, raga_kafi, raga_khamaj, raga_bhairav, raga_yaman, raga_bhupali, raga_asavari
ROMAN = {"i": 0, "ii": 1, "iii": 2, "iv": 3, "v": 4, "vi": 5, "vii": 6}
# chord-building scale: pentatonic presets build chords from the parent diatonic scale (a pentatonic cannot stack thirds)
PARENT = {"pent_major": "major", "pent_minor": "minor", "raga_bhupali": "major"}


def bjorklund(k, n):
    """Euclidean rhythm E(k, n) as a list of 0/1 of length n (Toussaint / Bjorklund)"""
    if k <= 0:
        return [0] * n
    if k >= n:
        return [1] * n
    pat = [[1] for _ in range(k)] + [[0] for _ in range(n - k)]
    while True:
        rem = len(pat) - k
        if rem <= 1:
            break
        m = min(k, rem)
        pat = [pat[i] + pat[k + i] for i in range(m)] + pat[m:k] + pat[k + m:]
        k = m if rem >= k else k
        if rem < k or m == 0:
            break
    flat = [x for p in pat for x in p]
    return flat[:n] if len(flat) >= n else flat + [0] * (n - len(flat))


def scale_note(root, scale, deg):
    s = SCALES[scale]
    o, i = divmod(deg, len(s))
    return root + 12 * o + s[i]


def parse_roman(r):
    flat = r.startswith("b")
    r = r.lstrip("b")
    idx = ROMAN[r.lower()]
    return idx, r.islower(), (-1 if flat else 0)


def chord_midi(root, scale, roman, octave_shift=0, seventh=False):
    """triad (optionally 7th) from the parent scale, stacked in thirds. root = tonic MIDI note. returns list of midi notes (low to high)"""
    ps = PARENT.get(scale, scale)
    idx, _, fl = parse_roman(roman)
    degs = [idx, idx + 2, idx + 4] + ([idx + 6] if seventh else [])
    return [scale_note(root, ps, d) + fl + 12 * octave_shift for d in degs]


def voice_lead(prev, chord):
    """nearest-note voicing: choose the inversion/octave of `chord` closest (sum of |semitone move|) to the previous voicing; keeps notes in 52..76"""
    if prev is None:
        return sorted(chord)
    best, bd = None, 1e9
    for inv in range(3):
        for oc in (-12, 0, 12):
            c = sorted([(n + 12 if k < inv else n) + oc for k, n in enumerate(sorted(chord))])
            if min(c) < 52 or max(c) > 79:
                continue
            d = sum(abs(a - b) for a, b in zip(c, prev))
            if d < bd:
                bd, best = d, c
    return best or sorted(chord)


class Piece:
    def __init__(self, preset, structure, seed, fps, bpm=None, key=None, loop=False):
        p = dict(PRESETS[preset])
        self.p = p
        self.preset = preset
        self.seed = seed
        self.fps = fps
        self.loop = loop
        self.bpm_req = bpm or p["bpm"]
        self.bpm, self.fpb = grid.snap_bpm(self.bpm_req, fps)
        self.spb = self.fpb * grid.samples_per_frame(fps)         # samples per beat
        self.bar = self.spb * 4
        self.step = self.spb // 4                                  # 16th
        self.tuning = p.get("tuning", "et")                        # "ji": Hindustani just intonation relative to Sa (= the key tonic)
        self.key = p["key"] if key is None else key
        self.root = 48 + self.key                                  # tonic around C3.. (A = 57)
        self.rng = np.random.default_rng(seed)
        secs = STRUCTURES[structure] if isinstance(structure, str) else structure
        self.sections = []
        bar0 = 0
        for name, bars, e in secs:
            self.sections.append({"name": name, "bar0": bar0, "bars": bars, "energy": p["loop_energy"] if e is None else e})
            bar0 += bars
        self.nbars = bar0
        self.tail = SR * 3 if not loop else SR * 3
        # tempo: constant (one fpb) or a ramp (p["ramp"] = (bpm0, bpm1)): every bar keeps a WHOLE number of frames per beat, bar starts are cumulative
        self.ramp = p.get("ramp") if not loop else None
        if self.ramp:
            rm = grid.tempo_ramp_map(self.ramp[0], self.ramp[1], fps, self.nbars)
            self.bar_fpb = rm["bar_frames_per_beat"]
            self.bpm, self.fpb = rm["bar_bpm"][0], self.bar_fpb[0]
        else:
            self.bar_fpb = [self.fpb] * self.nbars
        spf = grid.samples_per_frame(fps)
        self.bar_pos = [0]
        for f in self.bar_fpb:
            self.bar_pos.append(self.bar_pos[-1] + f * spf * 4)
        self.n = self.bar_pos[-1]
        self.stems = {k: np.zeros((self.n + self.tail, 2)) for k in ("drums", "bass", "harmony", "lead", "fx")}
        self.events = []

    # ---- helpers
    def hz(self, m):
        if self.tuning == "ji":
            return IN.ji_hz(dsp.note_hz(self.root), m - self.root)
        return dsp.note_hz(m)

    def _set_bar_tempo(self, bar):
        f = self.bar_fpb[min(bar, self.nbars - 1)]
        self.spb = f * grid.samples_per_frame(self.fps)
        self.bar = self.spb * 4
        self.step = self.spb // 4

    def energy_at(self, bar):
        for s in self.sections:
            if s["bar0"] <= bar < s["bar0"] + s["bars"]:
                e = s["energy"]
                if isinstance(e, tuple):
                    u = (bar - s["bar0"]) / max(1, s["bars"] - 1)
                    return e[0] + (e[1] - e[0]) * u
                return e
        return 0.0

    def section_of(self, bar):
        for i, s in enumerate(self.sections):
            if s["bar0"] <= bar < s["bar0"] + s["bars"]:
                return i
        return len(self.sections) - 1

    def put(self, stem, sig, pos, gain=1.0, pan=0.0):
        sig = np.asarray(sig, float)
        if sig.ndim == 1:
            sig = dsp.pan_st(sig, pan)
        if self.loop and pos < 0:                 # humanize / swing pulled a bar-0 hit before the loop start: wrap it to the loop end (seamless)
            pos += self.n
        dsp.add_at(self.stems[stem], sig, int(pos), gain)

    def swing_off(self, step_i):
        if self.p.get("swing8"):                                   # 8th-note swing (jazz): the off-beat 8th moves late by swing8 x one 16th (0.67 = triplet feel)
            return int(self.step * self.p["swing8"]) if step_i % 4 == 2 else 0
        return int(self.step * self.p["swing"] * 0.5) if step_i % 2 == 1 else 0

    def jitter(self):
        h = self.p["humanize"]
        return int(self.rng.integers(-h, h + 1) * SR / 1000) if h else 0

    def event(self, kind, pos, **kw):
        self.events.append({"kind": kind, "sample": int(pos), "frame": round(pos * self.fps / SR, 2), **kw})

    # ---- build
    def build(self):
        p = self.p
        prog = PROGRESSIONS[p["prog"]]
        scale = p["scale"]
        chords, prev = [], None
        for bar in range(self.nbars):
            r = prog[bar % len(prog)]
            ch = voice_lead(prev, chord_midi(self.root + 12, scale, r, seventh=bool(p.get("sevenths"))))
            prev = ch
            chords.append((r, ch))
        self.chords = chords
        self.motif = self._motif(scale)
        for bar in range(self.nbars):
            self._bar(bar)
        self._transitions()
        self._pump()
        return self

    def _motif(self, scale):
        r = np.random.default_rng(self.seed + 77)
        n_notes = int(r.integers(5, 8))
        rhythm_bank = [[(0, 3), (3, 1), (4, 3), (8, 2), (10, 2), (12, 4)], [(0, 2), (2, 2), (4, 4), (8, 2), (10, 2), (12, 2), (14, 2)], [(0, 4), (4, 2), (6, 2), (8, 4), (12, 2), (14, 2)]]
        rh = rhythm_bank[int(r.integers(0, len(rhythm_bank)))][:n_notes]
        ps = PARENT.get(scale, scale)
        deg = int(r.integers(2, 5)) + len(SCALES[ps]) // 1
        notes = []
        for k in range(len(rh)):
            notes.append(deg)
            step = int(r.choice([-2, -1, -1, 0, 1, 1, 2, 3, -3], p=[.08, .22, .08, .06, .22, .08, .14, .06, .06]))
            if k > 0 and abs(step) >= 3 and r.random() < 0.5:
                step = -np.sign(step)
            deg = int(np.clip(deg + step, len(SCALES[ps]) - 2, len(SCALES[ps]) * 2 + 2))
        return list(zip(rh, notes))

    def _bar(self, bar):
        p = self.p
        e = self.energy_at(bar)
        self._set_bar_tempo(bar)
        t0 = self.bar_pos[bar]
        style = p["drums"]
        sec = self.sections[self.section_of(bar)]
        last_bar_of_section = bar == sec["bar0"] + sec["bars"] - 1
        nxt = self.energy_at(bar + 1) if bar + 1 < self.nbars else 0.0
        pre_drop = (not self.loop) and last_bar_of_section and (nxt - e >= 0.3)
        gap_from = 12 if pre_drop else 99                      # steps 12..15 (last beat) silent in drums
        self._drums(bar, t0, e, style, gap_from, last_bar_of_section)
        self._bass(bar, t0, e, gap_from)
        self._harmony(bar, t0, e)
        self._lead(bar, t0, e)

    # -------- drums
    def _drums(self, bar, t0, e, style, gap_from, last_bar):
        p = self.p
        seed = self.seed * 1000 + bar
        S = self.step

        def hit(name, step_i, vel=1.0, gain=1.0, pan=0.0, stem="drums"):
            if step_i >= gap_from:
                return
            pos = t0 + step_i * S + self.swing_off(step_i) + self.jitter()
            fn = {"kick": lambda: I.kick(seed + step_i), "kick_soft": lambda: I.kick(seed + step_i, 130.0, 50.0, 0.025, 0.2, 0.12, 0.4),
                  "kick_sub": lambda: I.kick(seed + step_i, 120.0, 42.0, 0.04, 0.45, 0.15, 0.7, 0.8), "snare": lambda: I.snare(seed + step_i, vel),
                  "snare_soft": lambda: I.snare(seed + step_i, 0.55), "clap": lambda: I.clap(seed + step_i, vel), "hat": lambda: I.hat(seed + step_i, False, 0.5 + 0.5 * vel),
                  "hat_o": lambda: I.hat(seed + step_i, True, vel), "rim": lambda: I.rim(seed + step_i, vel), "tom": lambda: I.tom(seed + step_i, 110.0, vel),
                  "cowbell": lambda: I.cowbell(seed + step_i, vel), "shaker": lambda: I.shaker(seed + step_i, vel), "dhol": lambda: I.dhol_low(seed + step_i, vel),
                  "dhol_rim": lambda: I.dhol_rim(seed + step_i, vel), "808": lambda: I.e808(seed + step_i, self.hz(self.root - 12 + 0), 0.8, vel),
                  "tick": lambda: I.rim(seed + step_i, 0.5), "crash": lambda: np.asarray(dsp.lp(I.hat(seed + step_i, True, 1.0, 1.4), 12000))}.get(name)
            sig = fn() if fn else self._xvoice(name, seed + step_i, vel)
            self.put(stem, sig, pos, vel * gain, pan)
            if stem == "drums" and name in ("kick", "kick_soft", "kick_sub", "dhol", "808", "snare", "clap", "crash", "t_dha", "t_ge", "t_dhin", "dholak_dha", "dholak_ge",
                                            "taiko", "nagara", "chip_kick", "chip_snare", "brush_snare"):
                self.event(name, pos)
        k = lambda n_, i: bjorklund(n_, 16)[i]
        if style == "pattern":
            # data-driven: p["drum_pat"] = [(voice, steps over p["pat_bars"] bars of 16ths, vel, gain, min energy[, pan])]
            cyc = p.get("pat_bars", 1)
            base = (bar % cyc) * 16
            for row in p["drum_pat"]:
                voice, steps, vel, gain, emin = row[:5]
                pan = row[5] if len(row) > 5 else 0.0
                if e < emin:
                    continue
                for g in steps:
                    if base <= g < base + 16:
                        hit(voice, g - base, vel, gain, pan)
            if p.get("fill") and last_bar and e >= 0.5:
                for j, i in enumerate((12, 13, 14, 15)):
                    hit(p["fill"], i, 0.6 + 0.1 * j, 0.8)
            return
        if style in ("four_floor", "four_floor_soft"):
            kk = "kick" if style == "four_floor" else "kick_soft"
            if e >= 0.25:
                for i in range(16):
                    if i % 2 == 1 and (i % 4 == 2 or e >= 0.4):
                        hit("hat", i, 0.9 if i % 4 == 2 else 0.5, 0.6)
                if e >= 0.7:
                    for i in (2, 6, 10, 14):
                        pass
            if e >= 0.4:
                for i in (0, 4, 8, 12):
                    hit(kk, i)
            if e >= 0.7:
                for i in (4, 12):
                    hit("clap", i, 1.0, 0.8)
                for i in (14,):
                    hit("hat_o", i, 0.7, 0.5)
            if e >= 0.9 and style == "four_floor":
                for i in (2, 6, 10, 14):
                    hit("hat", i, 0.8, 0.5)
        elif style == "clap_shaker":
            if e >= 0.25:
                for i in range(0, 16, 2):
                    hit("shaker", i, 0.6 if i % 4 else 0.9, 0.7)
            if e >= 0.4:
                for i in (0, 8):
                    hit("kick_soft", i)
                if e >= 0.55:
                    hit("kick_soft", 10, 0.6)
            if e >= 0.7:
                for i in (4, 12):
                    hit("clap", i, 0.9, 0.7)
        elif style == "half_time":
            if e >= 0.25:
                for i in range(16):
                    hit("hat", i, 0.9 if i % 4 == 0 else 0.4, 0.5)
                if last_bar or bar % 4 == 3:
                    for i in range(12, 16):
                        hit("hat", i, 0.7, 0.5)
                        hit("hat", i, 0.5, 0.4) if False else None
            if e >= 0.4:
                for i in (0, 10):
                    hit("kick_sub", i)
            if e >= 0.55:
                hit("clap", 8, 1.0, 0.9)
        elif style == "bounce":
            if e >= 0.25:
                for i in range(0, 16, 2):
                    hit("shaker", i, 0.7, 0.6)
            if e >= 0.4:
                for i in (0, 8):
                    hit("kick_soft", i)
            if e >= 0.55:
                for i in (4, 12):
                    hit("rim", i, 0.9, 0.9)
            if e >= 0.7:
                for i in (6, 14):
                    hit("cowbell", i, 0.5, 0.6)
        elif style == "lofi":
            if e >= 0.25:
                for i in range(0, 16, 2):
                    hit("hat", i, 0.5, 0.45)
            if e >= 0.4:
                for i in (0, 7, 10):
                    hit("kick_soft", i, 0.9)
            if e >= 0.55:
                for i in (4, 12):
                    hit("snare_soft", i, 0.6, 0.6)
        elif style == "desi":
            if e >= 0.25:
                for i in range(0, 16, 2):
                    hit("shaker", i, 0.7, 0.6)
            if e >= 0.4:
                for i in (0, 6, 10):
                    hit("dhol", i, 0.9)
            if e >= 0.55:
                for i in (4, 12, 14):
                    hit("dhol_rim", i, 0.7, 0.8)
        elif style == "cinema":
            if e >= 0.25 and bar % 2 == 0:
                hit("tom", 0, 0.7, 0.8)
            if e >= 0.5 and bar % 4 == 0:
                hit("kick_sub", 0, 0.9)
            if e >= 0.8:
                for i in (8, 12):
                    hit("tom", i, 0.6, 0.7)
        elif style == "tick":
            for i in (0, 4, 8, 12):
                hit("tick", i, 0.6, 0.8)
            if e >= 0.5:
                hit("kick_sub", 0, 0.6, 0.8)
                hit("kick_sub", 3, 0.5, 0.7)
        if e >= 0.7 and bar % 4 == 0 and style not in ("tick",):
            pass

    def _xvoice(self, name, seed, vel):
        """extended drum / percussion voices (Indian percussion, taiko, chiptune, jazz kit)"""
        sa = self.hz(self.root)
        if name.startswith("t_"):
            return IN.tabla(name[2:], seed, sa_hz=sa, vel=1.0)
        return {"dholak_dha": lambda: IN.dholak_dha(seed), "dholak_ge": lambda: IN.dholak_ge(seed), "manjira": lambda: IN.manjira(seed) * 0.5,
                "ghungroo": lambda: IN.ghungroo(seed, shakes=1), "nagara": lambda: IN.nagara(seed), "taiko": lambda: X.taiko(seed, room=False),
                "ride": lambda: X.ride(seed), "brush_snare": lambda: dsp.lp(I.snare(seed, 0.5, 0.25), 5000) * 0.6,
                "chip_kick": lambda: X.chip(110.0, 0.06, 1.0, 0.5, arp=[0, -5, -12]) * 0.9, "chip_snare": lambda: X.chip_noise(seed, 0.09, 1.0, 2),
                "chip_hat": lambda: X.chip_noise(seed, 0.03, 0.6, 1)}[name]()

    # -------- bass
    def _bass(self, bar, t0, e, gap_from):
        p = self.p
        if e < 0.55 and p["bass"] not in ("drone",):
            return
        r, ch = self.chords[bar]
        root_m = ch[0]
        while root_m > 48:
            root_m -= 12
        while root_m < 33:
            root_m += 12
        f = self.hz(root_m)
        kind = p["bass"]
        S = self.step
        if kind == "none":
            return
        if kind == "walk":                                          # walking bass: quarter notes root, 3rd, 5th, chromatic approach to the next root
            nr = self.chords[(bar + 1) % self.nbars][1][0]
            while nr > 48:
                nr -= 12
            while nr < 33:
                nr += 12
            line = [root_m, ch[1] - 12 * ((ch[1] - root_m) // 12), ch[2] - 12 * ((ch[2] - root_m) // 12), nr - 1 if (bar + self.seed) % 2 else nr + 1]
            for k_, (i, m) in enumerate(zip((0, 4, 8, 12), line)):
                if i < gap_from:
                    self.put("bass", X.upright(self.hz(m), self.spb / SR * 0.9, self.seed + bar * 4 + k_), t0 + i * S + self.swing_off(i), 0.9)
            return
        if kind == "chip":
            for k_, i in enumerate((0, 4, 8, 10, 12)):
                if i < gap_from:
                    m = root_m + (12 if k_ in (1, 3) else 0)
                    self.put("bass", X.chip(self.hz(m), S * 1.6 / SR, 0.8, 0.5), t0 + i * S, 0.8)
            return
        if kind == "drone":
            if e >= 0.05:
                self.put("bass", I.pad(self.hz(root_m - 12 if root_m > 38 else root_m), 4 * self.spb / SR, 0.9, self.seed + bar, 4.0, 200.0, 0.4, 0.5, 2), t0, 0.7)
            return
        if kind == "808":
            for i in (0, 10):
                pos = t0 + i * S
                self.put("bass", I.e808(self.seed + bar, f, 0.9, 1.0, 1.8), pos, 0.9)
            return
        steps = [0, 4, 8, 12]
        if p["drums"] in ("four_floor", "four_floor_soft"):
            steps = [2, 6, 10, 14]          # offbeat bass between the kicks
        elif p["drums"] in ("bounce",):
            steps = [0, 4, 8, 12]
        elif p["drums"] in ("lofi",):
            steps = [0, 7, 10]
        elif p["drums"] in ("desi",):
            steps = [0, 6, 10]
        steps = p.get("bass_steps", steps)
        notes = [0, 0, 7, 12, 0, 7, 12, 7]
        for k_, i in enumerate(steps):
            if i >= gap_from:
                continue
            st = notes[(bar + k_) % len(notes)] if kind in ("saw", "pluck") else (0 if k_ % 2 == 0 else 7)
            fb = self.hz(root_m + st)
            pos = t0 + i * S + self.swing_off(i)
            dur = (S * 3) / SR if kind != "pizz" else 0.1
            sig = {"saw": lambda: I.bass_saw(fb, dur, 1.0, self.seed + k_), "sub": lambda: I.bass_sub(fb, dur, 1.0, self.seed + k_), "pluck": lambda: I.pluck(fb, dur, self.seed + k_, 0.996),
                   "pizz": lambda: I.pizz(fb * 2, dur, self.seed + k_), "upright": lambda: X.upright(fb, dur, self.seed + k_)}[kind]()
            self.put("bass", sig, pos, 0.9)

    # -------- harmony
    def _harmony(self, bar, t0, e):
        p = self.p
        r, ch = self.chords[bar]
        kind = p["harmony"]
        S = self.step
        if e < 0.05:
            return
        dur_bar = 4 * self.spb / SR
        voices = kind.split("+")
        if "pad" in voices:
            for j, m in enumerate(ch):
                self.put("harmony", I.pad(self.hz(m), dur_bar, 0.7, self.seed + bar * 3 + j, 9.0, 1600.0 if e < 0.7 else 2400.0, 0.12, 0.35), t0, 0.5, [-0.3, 0.0, 0.3][j % 3])
        if "cluster" in voices:
            for j, m in enumerate((ch[0] - 12, ch[0] - 11, ch[1] - 12, ch[2] - 12 + 1)):
                self.put("harmony", I.pad(self.hz(m), dur_bar, 0.5, self.seed + bar + j, 14.0, 900.0, 0.3, 0.6), t0, 0.5, [-0.5, 0.5, -0.2, 0.2][j])
        if "pluck" in voices and e >= 0.4:
            arp = [0, 1, 2, 1, 0, 1, 2, 1]
            for a_, i in enumerate(range(0, 16, 2)):
                if e < 0.7 and a_ % 2:
                    continue
                m = ch[arp[a_] % len(ch)] + 12
                pos = t0 + i * S + self.swing_off(i)
                self.put("harmony", I.pluck(self.hz(m), 0.25, self.seed + bar * 8 + a_, 0.995), pos, 0.6, -0.25 if a_ % 2 else 0.25)
        if "keys" in voices and e >= 0.25:
            pat = [0, 6, 10] if p["drums"] in ("lofi", "clap_shaker") else [0, 8]
            for i in pat:
                pos = t0 + i * S + self.swing_off(i) + self.jitter()
                for j, m in enumerate(ch):
                    self.put("harmony", I.keys(self.hz(m), 0.6 if i == 0 else 0.35, 0.8, self.seed + bar + j), pos + j * int(0.004 * SR), 0.55, [-0.2, 0, 0.2][j % 3])
        if "stab" in voices and e >= 0.4:
            for i in (0, 6, 10) if p["drums"] == "four_floor" else (0, 8):
                pos = t0 + i * S
                self.put("harmony", I.stab([self.hz(m) for m in ch], 0.25, 1.0, self.seed + bar, 4200.0, 700.0, 0.08), pos, 0.6)
        if "tanpura" in voices:                                       # Pa - Sa - Sa - Sa(low) plucks, one cycle per bar, jivari buzz
            sa = self.root - 12
            for j, (m, beat) in enumerate(((sa - 5, 0), (sa, 1), (sa, 2), (sa - 12, 3))):
                v = IN.jawari(dsp.ks(self.hz(m), int(dur_bar * SR * 1.2), self.seed + bar * 4 + j, g=0.9993, damp=0.7, bright=0.9), 0.75, 0.22)
                self.put("harmony", v, t0 + beat * self.spb, 0.45, [-0.4, 0.2, 0.4, -0.2][j])
        if "harmonium" in voices and e >= 0.25:
            for i in ((0, 8) if e >= 0.6 else (0,)):
                ln = (8 if i == 0 and e >= 0.6 else 16) * S / SR
                self.put("harmony", IN.harmonium_chord([self.hz(m) for m in ch], ln, self.seed + bar), t0 + i * S, 0.5)
        if "santoor" in voices and e >= 0.4:
            for a_, i in enumerate(range(0, 16, 2)):
                if e < 0.7 and a_ % 2:
                    continue
                m = ch[[0, 1, 2, 1][a_ % 4] % len(ch)] + 12
                self.put("harmony", IN.santoor_hit(self.hz(m), 0.9, self.seed + bar * 8 + a_), t0 + i * S + self.swing_off(i), 0.45, -0.3 if a_ % 2 else 0.3)
        if "strings" in voices:
            for j, m in enumerate(ch):
                self.put("harmony", X.strings_trem(self.hz(m), dur_bar + 0.15, self.seed + bar * 3 + j, 0.7, trem_hz=p.get("trem_hz", 0.0), voices=4), t0, 0.45, [-0.4, 0.0, 0.4, 0.2][j % 4])
        if "guitar" in voices and e >= 0.25:
            for k_, i in enumerate((0, 6, 10, 12) if e >= 0.6 else (0, 8)):
                fr = [self.hz(m) for m in ([ch[0] - 12] + list(ch))]
                self.put("harmony", X.guitar_strum(fr, 0.6, self.seed + bar * 4 + k_, 0.7 if k_ else 0.9, 12.0, k_ % 2 == 0), t0 + i * S + self.swing_off(i), 0.5, -0.2)
        if "chip_arp" in voices and e >= 0.25:
            for i in range(0, 16, 4):
                self.put("harmony", X.chip(self.hz(ch[0] + 12), S * 3.6 / SR, 0.5, 0.125, arp=[0, ch[1] - ch[0], ch[2] - ch[0]]), t0 + i * S, 0.35)
        if "synthpad" in voices:
            for j, m in enumerate(ch):
                self.put("harmony", I.pad(self.hz(m), dur_bar, 0.7, self.seed + bar * 3 + j, 18.0, 2200.0 if e >= 0.6 else 1400.0, 0.4, 0.6, 5), t0, 0.5, [-0.5, 0.0, 0.5, 0.0][j % 4])
        if "marimba" in voices and e >= 0.25:
            for a_, i in enumerate((0, 3, 6, 8, 11, 14)):
                m = ch[a_ % len(ch)] + (12 if a_ % 2 else 0)
                pos = t0 + i * S + self.swing_off(i) + self.jitter()
                self.put("harmony", I.marimba(self.hz(m), 0.1, 0.9, self.seed + a_ + bar), pos, 0.6, -0.3 if a_ % 2 else 0.3)

    # -------- lead
    def _lead(self, bar, t0, e):
        p = self.p
        if p["lead"] == "none" or e < p["lead_at"]:
            return
        r, ch = self.chords[bar]
        scale = PARENT.get(p["scale"], p["scale"])
        S = self.step
        shift = {0: 0, 1: 0, 2: 1, 3: -1}[bar % 4] if p["prog"] not in ("pedal",) else 0
        motif = self.motif
        use = motif if bar % 4 != 3 else motif[: max(3, len(motif) - 2)]
        tonic = self.root + 12
        for k_, ((st, ln), deg) in enumerate(use):
            d = deg + shift
            m = scale_note(tonic, scale, d)
            if k_ == len(use) - 1 and (bar % 2 == 1):                           # phrase end lands on a chord tone
                m = min(ch, key=lambda c: abs((c % 12) - (m % 12)) if False else min(abs((c - m) % 12), abs((m - c) % 12)))
                m = m + 12 * round((scale_note(tonic, scale, d) - m) / 12)
            pos = t0 + st * S + self.swing_off(st)
            dur = ln * S / SR * 0.95
            kind = p["lead"]
            sig = {"lead": lambda: I.lead(self.hz(m + 12), dur, 0.9, self.seed + k_), "bell": lambda: I.bell(self.hz(m + 12), max(dur, 0.3), 0.6, 4.0, 0.8, self.seed),
                   "keys": lambda: I.keys(self.hz(m + 12), dur, 0.8, self.seed + k_), "marimba": lambda: I.marimba(self.hz(m + 12), dur, 1.0, self.seed + k_),
                   "pluck": lambda: I.pluck(self.hz(m + 12), dur, self.seed + k_),
                   "sitar": lambda: IN.sitar_pluck(self.hz(m), max(dur, 0.5) + 0.4, self.seed + k_, 0.9, meend=(-1.0, 0.12) if k_ % 3 == 2 else None, sa_hz=self.hz(self.root)),
                   "bansuri": lambda: IN.bansuri_note(self.hz(m + 12), max(dur, 0.2), self.seed + k_, 0.8),
                   "shehnai": lambda: IN.shehnai_note(self.hz(m + 12), max(dur, 0.2), self.seed + k_, 0.8, meend=-1.0 if k_ % 2 == 0 else 0.0, glide_s=min(0.12, dur * 0.4)),
                   "chip": lambda: X.chip(self.hz(m + 12), max(dur, 0.06), 0.8, 0.5),
                   "pizz": lambda: I.pizz(self.hz(m + 12), min(dur, 0.15), self.seed + k_, 1.0),
                   "brass": lambda: X.brass_stab([self.hz(m)], max(dur, 0.2), self.seed + k_, 0.9)}[kind]()
            self.put("lead", sig, pos, 0.8, 0.15 * (1 if bar % 2 else -1))
            self.event("note", pos, midi=int(m + 12))

    # -------- transitions: fx (riser, crash, impact)
    def _transitions(self):
        from recipes.risers import riser_noise
        for i, s in enumerate(self.sections):
            e_now = self.energy_at(s["bar0"])
            e_prev = self.energy_at(s["bar0"] - 1) if s["bar0"] > 0 else 0.0
            t0 = self.bar_pos[s["bar0"]]
            self._set_bar_tempo(max(0, s["bar0"] - 1))
            if i == 0 and not self.loop and e_now >= 0.9:
                self.put("fx", I.kick(self.seed, 120.0, 38.0, 0.05, 0.5, 0.3, 1.0, 0.6), t0, 0.8)       # hook: audible event on frame 0
                self.event("hook_hit", t0)
            if e_now - e_prev >= 0.3 and s["bar0"] > 0 and not self.loop:
                crash = np.asarray(dsp.lp(I.hat(self.seed + i, True, 1.0, 1.6), 12000))
                self.put("fx", crash, t0, 0.8)
                self.put("fx", I.kick(self.seed + i, 120.0, 38.0, 0.05, 0.5, 0.3, 1.0, 0.6), t0, 0.8)
                self.event("drop", t0, section=s["name"])
                # one-bar noise riser ending exactly on the downbeat of this section (ends 1 frame early: 5 ms fade)
                r = riser_noise(self.bar - grid.samples_per_frame(self.fps), self.seed + i, burst=False) * 0.8
                r = dsp.fade_out(r, dsp.ms(5))
                self.put("fx", r, t0 - self.bar, 0.8)
                self.event("riser", t0 - self.bar, bars=1)
            self._set_bar_tempo(s["bar0"])
            if s["name"] == "tail" and not self.loop:
                r, ch = self.chords[min(s["bar0"], self.nbars - 1)]
                tonic = [self.root - 12, self.root, self.root + 7, self.root + 12, self.root + 16 if "major" in self.p["scale"] else self.root + 15]
                for m in tonic:
                    self.put("fx", I.pad(self.hz(m), 1.4, 0.6, self.seed + m, 7.0, 2200.0, 0.02, 1.4), t0, 0.5)
                self.put("fx", I.bell(self.hz(self.root + 12), 1.5, 1.5, 5.0, 0.8), t0, 0.5)
                self.event("button", t0)
        if self.p["drums"] == "cinema" and not self.loop:
            pass

    def _pump(self):
        if not self.p["pump"]:
            return
        kicks = sorted(e["sample"] for e in self.events if e["kind"] in ("kick", "kick_soft"))
        g = np.ones(self.n + self.tail)
        depth = 1.0 - dsp.db(-5.0)
        for kpos in kicks:
            m = min(int(0.6 * SR), len(g) - kpos)
            if m <= 0:
                continue
            t = np.arange(m) / SR
            att = np.clip(t / 0.005, 0, 1)
            g[kpos:kpos + m] *= 1.0 - depth * att * np.exp(-t / 0.06)
        for k in ("harmony", "bass"):
            self.stems[k] *= g[:, None]

    # -------- finish
    def render(self):
        stems = {}
        for k, v in self.stems.items():
            v = v.copy()
            if self.loop:
                tail = v[self.n:self.n + self.tail]
                v = v[:self.n].copy()
                v[:len(tail)] += tail[:self.n]
            if np.max(np.abs(v)) > 0:
                v = np.stack([dsp.fft_filter(v[:, 0], 25.0, None, 2), dsp.fft_filter(v[:, 1], 25.0, None, 2)], 1)   # zero-phase DC / rumble removal (circular: loops stay seamless)
            stems[k] = v
        return stems


def balance(stems, ref_lufs=-18.0):
    """scale each stem to the house relative loudness (TRIMS_DB vs drums) by BS.1770 loudness of the stem; silent stems stay silent"""
    out = {}
    for k, v in stems.items():
        if np.max(np.abs(v)) < 1e-6:
            out[k] = v
            continue
        L = meter.lufs_integrated(v)
        g = dsp.db(ref_lufs + TRIMS_DB[k] - L)
        out[k] = v * g
    return out


def compose(preset="tech_pulse", structure="loop_8", seed=1, fps=30, bpm=None, key=None, loop=None):
    loop = (structure == "loop_8") if loop is None else loop
    pc = Piece(preset, structure, seed, fps, bpm, key, loop).build()
    stems = balance(pc.render())
    mix = sum(stems.values())
    meta = {"preset": preset, "structure": structure if isinstance(structure, str) else "custom", "seed": seed, "fps": fps, "bpm": round(pc.bpm, 3), "bpm_requested": pc.bpm_req,
            "frames_per_beat": pc.fpb, "frames_per_bar": pc.fpb * 4, "bars": pc.nbars, "key_midi": pc.key + 48, "scale": pc.p["scale"], "prog": pc.p["prog"], "loop": loop,
            "length_frames": round(pc.n * fps / SR, 2), "length_s": round(pc.n / SR, 3),
            "sections": [{"name": s["name"], "bar0": s["bar0"], "frame0": s["bar0"] * pc.fpb * 4, "bars": s["bars"], "energy": s["energy"]} for s in pc.sections],
            "chords": [r for r, _ in pc.chords], "tuning": pc.tuning}
    if pc.ramp:
        meta["tempo_ramp"] = {"bpm_from": pc.ramp[0], "bpm_to": pc.ramp[1], "bar_frames_per_beat": pc.bar_fpb,
                              "bar_frames": [round(x * fps / SR) for x in pc.bar_pos[:-1]], "end_frame": round(pc.bar_pos[-1] * fps / SR)}
    return {"stems": stems, "mix": mix, "events": sorted(pc.events, key=lambda e: e["sample"]), "meta": meta}
