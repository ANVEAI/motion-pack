"""motion-pack / sfx / mpaudio / phone.py : phone-speaker voicing (ported from the ANVE v9 launch-film mixer): low shelf -9 dB at 100 Hz, +2.5 dB at 1.7 kHz (Q 0.8),
+1 dB at 650 Hz (Q 0.9), mono below 220 Hz, sides x0.72. Used for the 'phone check' of every master and for the per-sound `phone_drop_db` manifest field."""
import numpy as np
from . import dsp


def phone_voice(x):
    x = dsp.stereo(np.asarray(x, float))
    y = dsp.biquad(x, "lowshelf", 100.0, 0.7, -9.0)
    y = dsp.biquad(y, "peak", 1700.0, 0.8, 2.5)
    y = dsp.biquad(y, "peak", 650.0, 0.9, 1.0)
    lo = dsp.lp(y.mean(axis=1), 220.0, 2)
    hi = y - dsp.lp(y, 220.0, 2)
    m = hi.mean(axis=1, keepdims=True)
    s = (hi - m) * 0.72
    return np.stack([lo, lo], 1) + m + s
