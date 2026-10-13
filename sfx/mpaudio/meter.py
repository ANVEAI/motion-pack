"""motion-pack / sfx / mpaudio / meter.py
ONE meter for the whole audio side of the pack: ITU-R BS.1770-4 K-weighting (48 kHz coefficients, the same ones as
ANVE's earlier measure_audio.py), gated integrated LUFS, momentary / short-term maxima, 4x true peak.
Cross-checked against ffmpeg ebur128 by qa.py (python vs ffmpeg must agree within 0.1 LU on programme-length audio)."""
import numpy as np
from scipy.signal import lfilter, resample_poly

SR = 48000
B1, A1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
B2, A2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def _as2(x):
    x = np.asarray(x, float)
    return x[:, None] if x.ndim == 1 else x


def kweight(x):
    x = _as2(x)
    return lfilter(B2, A2, lfilter(B1, A1, x, axis=0), axis=0)


def _block_ms(z, blk, hop):
    n = len(z)
    if n < blk:
        z = np.concatenate([z, np.zeros((blk - n, z.shape[1]))], 0)
        n = blk
    c = np.cumsum(np.concatenate([np.zeros((1, z.shape[1])), z ** 2], 0), axis=0)
    starts = np.arange(0, n - blk + 1, hop)
    return (c[starts + blk] - c[starts]).sum(axis=1) / blk, starts


def lufs_integrated(x):
    """gated integrated loudness (absolute -70, relative -10). short clips (< 400 ms) are zero-padded to one block"""
    z = kweight(x)
    ms_, _ = _block_ms(z, int(0.4 * SR), int(0.1 * SR))
    l = -0.691 + 10 * np.log10(ms_ + 1e-20)
    g1 = ms_[l > -70]
    if len(g1) == 0:
        return -70.0
    thr = -0.691 + 10 * np.log10(np.mean(g1)) - 10
    g2 = ms_[l > thr]
    return float(-0.691 + 10 * np.log10(np.mean(g2))) if len(g2) else -70.0


def lufs_momentary_max(x):
    z = kweight(x)
    ms_, _ = _block_ms(z, int(0.4 * SR), int(0.1 * SR))
    return float(-0.691 + 10 * np.log10(ms_.max() + 1e-20))


def lufs_short_max(x):
    z = kweight(x)
    ms_, _ = _block_ms(z, int(3.0 * SR), int(0.1 * SR))
    return float(-0.691 + 10 * np.log10(ms_.max() + 1e-20))


def k_level(x, start, length):
    """mean-square K-weighted level (dB, BS.1770 style sum over channels) of x[start:start+length]; the filter runs over the whole buffer"""
    z = kweight(x)
    seg = z[start:start + length]
    return float(-0.691 + 10 * np.log10(np.sum(np.mean(seg ** 2, axis=0)) + 1e-20))


def true_peak_db(x, os_=4):
    x = _as2(x)
    pad = 1024
    y = np.concatenate([np.zeros((pad, x.shape[1])), x, np.zeros((pad, x.shape[1]))], 0)
    up = resample_poly(y, os_, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-20))


def sample_peak_db(x):
    return float(20 * np.log10(np.max(np.abs(x)) + 1e-20))


def rms_db(x):
    return float(10 * np.log10(np.mean(np.asarray(x, float) ** 2) + 1e-20))


def centroid_hz(x):
    m = np.asarray(x, float)
    m = m.mean(axis=1) if m.ndim == 2 else m
    w = np.hanning(len(m))
    X = np.abs(np.fft.rfft(m * w)) ** 2
    f = np.fft.rfftfreq(len(m), 1.0 / SR)
    return float((f * X).sum() / (X.sum() + 1e-20))


def crest_db(x):
    return sample_peak_db(x) - rms_db(x)


def band_energy_ratio_db(x, f_hi):
    """energy below f_hi relative to total (dB, negative)"""
    m = np.asarray(x, float)
    m = m.mean(axis=1) if m.ndim == 2 else m
    X = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1.0 / SR)
    return float(10 * np.log10(X[f < f_hi].sum() / (X.sum() + 1e-20) + 1e-20))
