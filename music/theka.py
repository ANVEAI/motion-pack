"""motion-pack / music / theka.py : tabla theka loops (and a bhangra dhol chaal) on a frame-exact grid.
A theka is the spoken-stroke skeleton of a tala. Each matra (beat) is a whole number of frames (music/grid.py snap), the loop is a whole number of tala cycles, the
ring-out of the last strokes is folded onto the head, so the loop is seamless. A tanpura cycle (Pa-Sa-Sa-Sa) runs under the tabla thekas.
render_theka(name, fps, cycles, seed) -> {"mix", "events", "meta"}; events carry frame numbers for every matra, the sam (beat 1) and the khali (empty) beat.
Thekas (standard, public-domain bol sequences):
  teental (16): Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha
  keherwa (8):  Dha Ge Na Ti | Na Ka Dhi Na
  dadra (6):    Dha Dhi Na | Dha Ti Na"""
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, indian as IN, instruments as I
from mpaudio.dsp import SR
import grid

THEKAS = {
    "teental": {"bols": ["dha", "dhin", "dhin", "dha", "dha", "dhin", "dhin", "dha", "dha", "tin", "tin", "na", "na", "dhin", "dhin", "dha"], "khali": 8, "vibhag": [0, 4, 8, 12],
                "bpm": 100, "fill_every": 2},
    "keherwa": {"bols": ["dha", "ge", "na", "te", "na", "ka", "dhin", "na"], "khali": 4, "vibhag": [0, 4], "bpm": 110, "fill_every": 4},
    "dadra": {"bols": ["dha", "dhin", "na", "dha", "tin", "na"], "khali": 3, "vibhag": [0, 3], "bpm": 120, "fill_every": 4},
}
SA_TABLA = IN.SA


def _fold(buf, n):
    out = buf[:n].copy()
    t = buf[n:]
    out[:len(t)] += t[:n]
    return out


def render_theka(name="teental", fps=30, cycles=2, seed=1, bpm=None, tanpura=True):
    th = THEKAS[name]
    b, fpb = grid.snap_bpm(bpm or th["bpm"], fps)
    spb = fpb * grid.samples_per_frame(fps)
    nb = len(th["bols"])
    n = nb * cycles * spb
    tail = SR * 3
    tab = np.zeros((n + tail, 2))
    events = []
    r = np.random.default_rng(seed)
    for c in range(cycles):
        for k, bol in enumerate(th["bols"]):
            pos = (c * nb + k) * spb
            last_cycle = c == cycles - 1
            if last_cycle and k == nb - 1 and (cycles % th["fill_every"] == 0 or cycles >= 2):
                v = IN.tirakita(seed + 97, SA_TABLA, 0.9, gap=spb / SR / 4)       # tirakita fill into the sam
            else:
                vel = 1.0 if k == 0 else (0.85 if k in th["vibhag"] else 0.72)
                v = IN.tabla(bol, seed + c * nb + k, SA_TABLA, vel)
            dsp.add_at(tab, dsp.pan_st(v, 0.12), pos + int(r.integers(-1, 2) * SR / 1000))
            # half-beat ghost strokes keep the groove moving (te on the off-beat, quieter)
            if bol not in ("ka",) and k not in (nb - 1,):
                dsp.add_at(tab, dsp.pan_st(IN.tabla("te", seed + 500 + c * nb + k, SA_TABLA, 0.35), 0.15), pos + spb // 2)
            events.append({"kind": "matra", "sample": (c * nb + k) * spb, "frame": (c * nb + k) * fpb, "bol": bol, "sam": k == 0, "khali": k == th["khali"]})
    stems = {"tabla": _fold(tab, n)}
    if tanpura:
        tp = np.zeros(n)
        cyc_s = 4 * spb / SR if nb % 4 == 0 else 3 * spb / SR * 2
        k = 0
        start = 0.0
        while start < n / SR - 1e-6:
            tp += IN.tanpura_cycle(n, seed + 31 * k, 110.0, start, cyc_s)
            start += cyc_s
            k += 1
        stems["tanpura"] = np.stack([tp, 0.9 * tp], 1)
    stems = {k: np.stack([dsp.fft_filter(v[:, 0], 25.0, None, 2), dsp.fft_filter(v[:, 1], 25.0, None, 2)], 1) for k, v in stems.items()}
    from compose import balance
    st = balance({"drums": stems["tabla"], **({"harmony": stems["tanpura"]} if tanpura else {})})
    mix = sum(st.values())
    meta = {"preset": "theka_" + name, "structure": "%d cycles" % cycles, "seed": seed, "fps": fps, "bpm": round(b, 3), "bpm_requested": bpm or th["bpm"], "frames_per_beat": fpb,
            "frames_per_bar": fpb * nb, "matras": nb, "bars": cycles, "key_midi": 57, "scale": "sa-pa drone", "loop": True, "length_frames": nb * cycles * fpb, "length_s": round(n / SR, 3),
            "sections": [{"name": "cycle%d" % c, "bar0": c, "frame0": c * nb * fpb, "bars": 1, "energy": 0.8} for c in range(cycles)], "tala": name, "bols": th["bols"]}
    return {"mix": mix, "stems": st, "events": events, "meta": meta}


def render_bhangra(fps=30, bars=8, seed=1, bpm=100):
    """bhangra dhol chaal (own dhol voices) on a 12/8 feel: 4 beats x 3 triplets per bar; dagga (bass) on beats 1 and 3 + pickup, tilli (stick) on the triplets;
    a high plucked (tumbi-like) riff on A, mixolydian, every other bar"""
    b, fpb = grid.snap_bpm(bpm, fps)
    spb = fpb * grid.samples_per_frame(fps)
    trip = spb / 3.0
    n = bars * 4 * spb
    dr = np.zeros((n + SR * 2, 2))
    rf = np.zeros((n + SR * 2, 2))
    events = []
    bass = {0, 6, 9}
    stick = {2, 3, 5, 8, 11}
    for bar in range(bars):
        for i in range(12):
            pos = int(bar * 4 * spb + i * trip)
            if i in bass:
                dsp.add_at(dr, dsp.pan_st(I.dhol_low(seed + bar * 12 + i, 1.0 if i != 9 else 0.7), -0.1), pos)
                events.append({"kind": "dhol", "sample": pos, "frame": round(pos * fps / SR, 2)})
            if i in stick:
                dsp.add_at(dr, dsp.pan_st(I.dhol_rim(seed + 300 + bar * 12 + i, 0.9 if i % 3 == 2 else 0.6), 0.15), pos)
        if bar % 2 == 1:
            riff = [(0, 76), (2, 79), (3, 81), (5, 79), (6, 76), (8, 74), (9, 76)]
            for i, m in riff:
                pos = int(bar * 4 * spb + i * trip)
                dsp.add_at(rf, dsp.pan_st(I.pluck(dsp.note_hz(m), 0.18, seed + i, 0.994, 0.9, 0.7, 0.05, 0.9), 0.3), pos)
    from compose import balance
    st = balance({"drums": _fold(dr, n), "lead": _fold(rf, n)})
    mix = sum(st.values())
    meta = {"preset": "bhangra_dhol", "structure": "loop_8", "seed": seed, "fps": fps, "bpm": round(b, 3), "bpm_requested": bpm, "frames_per_beat": fpb, "frames_per_bar": fpb * 4,
            "bars": bars, "key_midi": 57, "scale": "mixolydian", "loop": True, "length_frames": bars * 4 * fpb, "length_s": round(n / SR, 3),
            "sections": [{"name": "loop", "bar0": 0, "frame0": 0, "bars": bars, "energy": 0.95}], "feel": "12/8 triplet chaal"}
    return {"mix": mix, "stems": st, "events": events, "meta": meta}
