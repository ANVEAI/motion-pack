"""motion-pack / layers / tools / log_cubes.py: camera-log -> Rec.709 conversion cubes + a neutral highlight roll-off, written from published formulae.
    python3 layers/tools/log_cubes.py            -> layers/looks/log.{logc3,slog3,vlog}-to-709.cube, layers/looks/neutral.rolloff-709.cube (33^3)
Pipeline per log cube: log decode (vendor curve) -> camera gamut linear -> 3x3 to Rec.709 linear (D65) -> exposure -> Khronos PBR Neutral tone map
-> clip -> inverse BT.1886 (gamma 1/2.4). Sources (formulae as published; re-verify against the vendor white papers before a grading job):
  ARRI LogC3 EI800 (ARRI 'ALEXA Log C Curve' white paper), Sony S-Log3 / S-Gamut3.Cine (Sony technical summary), Panasonic V-Log / V-Gamut
  (Panasonic V-Log/V-Gamut reference manual), Khronos PBR Neutral tone mapper (KhronosGroup/ToneMapping, Apache-2.0 reference).
  Gamut matrices: each row sums to 1 (checked below). These are starting conversions for proxies and social deliverables, not a colour-managed pipeline."""
import os, sys, numpy as np
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'looks')

def logc3(t):
    cut, a, b, c, d, e, f = 0.010591, 5.555556, 0.052272, 0.247190, 0.385537, 5.367655, 0.092809
    return np.where(t > e * cut + f, (10 ** ((t - d) / c) - b) / a, (t - f) / e)
def slog3(t):
    return np.where(t >= 171.2102946929 / 1023, (10 ** ((t * 1023 - 420) / 261.5)) * (0.18 + 0.01) - 0.01, (t * 1023 - 95) * 0.01125 / (171.2102946929 - 95))
def vlog(t):
    return np.where(t < 0.181, (t - 0.125) / 5.6, 10 ** ((t - 0.598206) / 0.241514) - 0.00873)

M = {'logc3': np.array([[1.617523, -0.537287, -0.080237], [-0.070573, 1.334613, -0.264040], [-0.021102, -0.226954, 1.248056]]),     # ARRI Wide Gamut 3 -> Rec.709
     'slog3': np.array([[1.6269474, -0.5401385, -0.0868089], [-0.1785155, 1.4179409, -0.2394254], [-0.0444361, -0.1959199, 1.2403560]]),  # S-Gamut3.Cine -> Rec.709
     'vlog': np.array([[1.806576, -0.695697, -0.110879], [-0.170090, 1.305955, -0.135865], [-0.025206, -0.154468, 1.179674]])}           # V-Gamut -> Rec.709
DEC = {'logc3': logc3, 'slog3': slog3, 'vlog': vlog}

def pbr_neutral(c):
    """Khronos PBR Neutral (start 0.76, desaturation 0.15), c: (...,3) linear."""
    start, desat = 0.8 - 0.04, 0.15
    x = c.min(-1, keepdims=True); off = np.where(x < 0.08, x - 6.25 * x * x, 0.04); c = c - off
    peak = c.max(-1, keepdims=True); d = 1 - start
    newp = 1 - d * d / (peak + d - start); comp = peak >= start
    cs = np.where(comp, c * (newp / np.maximum(peak, 1e-9)), c)
    g = 1 - 1 / (desat * (peak - newp) + 1)
    return np.where(comp, cs * (1 - g) + newp * g, c)

def grid(n):
    v = np.linspace(0, 1, n); b, g, r = np.meshgrid(v, v, v, indexing='ij'); return np.stack([r, g, b], -1).reshape(-1, 3)   # red fastest

def write(name, rgb, n, title):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        f.write('\n'.join(' '.join(f'{x:.6f}' for x in row) for row in np.clip(rgb, 0, 1)) + '\n')

def convert(cam, rgb_log, exposure=1.0):
    lin = DEC[cam](rgb_log) @ M[cam].T * exposure
    return np.clip(pbr_neutral(np.maximum(lin, 0)), 0, 1) ** (1 / 2.4)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); n = 33
    for k, m in M.items(): assert np.allclose(m.sum(1), 1, atol=1e-5), k
    grey = {'logc3': 0.391007, 'slog3': 0.410557, 'vlog': 0.423311}    # published 18% grey code values
    for cam in M:
        g = convert(cam, np.array([[grey[cam]] * 3]))[0, 0]
        assert 0.40 < g < 0.52, (cam, g)
        write(f'log.{cam}-to-709.cube', convert(cam, grid(n)), n, f'motion-pack {cam} to Rec.709 (PBR Neutral)')
        print(f'log.{cam}-to-709.cube  18% grey -> {g:.3f} display')
    lin = grid(n) ** 2.4; write('neutral.rolloff-709.cube', np.clip(pbr_neutral(lin), 0, 1) ** (1 / 2.4), n, 'motion-pack neutral highlight roll-off (Rec.709 in/out)')
    mid = (pbr_neutral(np.array([[0.18] * 3])) ** (1 / 2.4))[0, 0]; print(f'neutral.rolloff-709.cube  mid-grey 0.18 lin -> {mid:.3f} (identity {0.18 ** (1 / 2.4):.3f})')
