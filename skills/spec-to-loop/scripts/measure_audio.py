#!/usr/bin/env python3
"""spec-to-loop audio measurement + mastering (numpy/scipy only). MEASURE, do not guess.

usage: python3 measure_audio.py <out_dir> [--tune] [--write] [--quiet]
  reads  <out_dir>/audio/{bed,hits,iso}.f32 + meta.json   (written by score.mjs)
  prints per hit group: isolated peak sample vs target (F+1) x SR/fps (800 at 48 kHz, 60 fps; ms error), in-mix peak, K-weighted level over the bed
         in the first 60 ms, limiter gain reduction; then the master: integrated LUFS, true peak (4x), seam discontinuity.
  --tune   rewrites <out_dir>/audio/trims.json: one bounded least-squares solve over all groups puts every 60 ms window on
           levelTarget, keeps each group's own level >= ownMin, and caps groups the limiter squeezed past maxGrDb. Run by
           `score.mjs --rounds N`.
  --write  writes <out_dir>/<name>-master.wav (24-bit seamless), audio/loop_faded.wav (2 ms raised cosine on the first and
           last 96 samples ONLY, for the single-loop MP4), audio/two_loops.wav (master twice, no fades) and audio/report.json.
Exit status 0 = every number passes, 3 = a measured failure, anything else = the script itself failed."""
import json, os, sys, struct
import numpy as np
from scipy.signal import lfilter, resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d

D = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else sys.exit(__doc__)
A = os.path.join(D, 'audio'); TUNE = '--tune' in sys.argv; WRITE = '--write' in sys.argv; QUIET = '--quiet' in sys.argv
meta = json.load(open(os.path.join(A, 'meta.json'))); SR = meta['SR']; N = meta['N']; SPF = meta['spf']
MS = meta.get('master', {}); LUFS_T = MS.get('lufs', -14.0); CEIL = MS.get('ceilingDb', -1.2); MAXGR = MS.get('maxGrDb', 1.5)
LV = MS.get('level', [3.0, 6.0]); LT = MS.get('levelTarget', 4.5); LTO = {int(k): v for k, v in meta.get('levelTargets', {}).items()}
OWN_MIN = MS.get('ownMin', -6.0)   # a transient's 60 ms mean understates it: -6 dB on its own still reads
st = lambda f: np.fromfile(os.path.join(A, f), dtype='<f4').astype(np.float64).reshape(-1, 2)
bed, hits = st('bed.f32'), st('hits.f32'); assert bed.shape[0] == N and hits.shape[0] == N, (bed.shape, N)
iso = np.fromfile(os.path.join(A, 'iso.f32'), dtype='<f4').astype(np.float64)
own = np.fromfile(os.path.join(A, 'own.f32'), dtype='<f4').astype(np.float64).reshape(-1, 2) if os.path.exists(os.path.join(A, 'own.f32')) else None
ownby = {o['frame']: o['offset'] for o in meta.get('own', [])}

# ---------- ITU-R BS.1770 K-weighting (48 kHz coefficients), circular: filter three tiled loops, keep the middle ----------
B1, A1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
B2, A2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
def kw(x):
    y = np.concatenate([x, x, x], 0); return lfilter(B2, A2, lfilter(B1, A1, y, axis=0), axis=0)[N:2 * N]
def lufs(x, k=None):
    z = kw(x) if k is None else k; blk, hop = int(0.4 * SR), int(0.1 * SR); zz = np.concatenate([z, z[:blk]], 0)
    ms = np.array([np.sum(np.mean(zz[s:s + blk] ** 2, axis=0)) for s in range(0, N, hop)]); l = -0.691 + 10 * np.log10(ms + 1e-20)
    g1 = ms[l > -70]
    if len(g1) == 0: return -70.0
    g2 = ms[l > -0.691 + 10 * np.log10(np.mean(g1)) - 10]; return -0.691 + 10 * np.log10(np.mean(g2))
def true_peak(x, os_=4):
    y = np.concatenate([x[-2048:], x, x[:2048]], 0); up = resample_poly(y, os_, 1, axis=0)[2048 * os_:-2048 * os_]
    return 20 * np.log10(np.max(np.abs(up)) + 1e-20)

# ---------- look-ahead true-peak limiter (circular): required gain from the 4x-oversampled peak, min filter, box smoothing ----------
LOOK = 240                                   # 5 ms look-ahead / release window
mix = bed + hits
y3 = np.concatenate([mix, mix, mix], 0)
pk = np.max(np.abs(resample_poly(y3, 4, 1, axis=0)), axis=1).reshape(-1, 4).max(axis=1)   # per-sample true-peak envelope (both channels)
def limit(G):
    c = 10 ** (CEIL / 20); req = np.minimum(1.0, c / np.maximum(G * pk, 1e-12))
    g = uniform_filter1d(minimum_filter1d(req, size=2 * LOOK + 1, mode='wrap'), size=LOOK + 1, mode='wrap')   # g <= req everywhere
    g = np.minimum(g, 1.0)[N:2 * N]; return mix * G * g[:, None], g
lo, hi = 0.01, 8.0
for _ in range(40):
    G = (lo * hi) ** 0.5; yl, gl = limit(G)
    if lufs(yl) > LUFS_T: hi = G
    else: lo = G
G = (lo * hi) ** 0.5; master, gain = limit(G)

# ---------- per hit group ----------
# Level metric (PASS/FAIL): the hits stem over the bed stem, K-weighted, in the 60 ms that start on the target sample, i.e. what is heard
# (this hit plus earlier tails plus any next onset). `own` = the group alone (context, and the basis of the tuner's linear model).
kb, kh = kw(bed), kw(hits)
W60 = int(0.060 * SR); rows = []; fails = []
groups = sorted([g for g in meta['groups'] if g['bus'] == 'hits'], key=lambda g: g['frame'])
targets = sorted(set(g['target'] for g in groups))
isoby = {}
for p in meta['iso']: isoby.setdefault(p['frame'], []).append(p)
hmono = np.max(np.abs(hits), axis=1)
OL, OP = meta.get('ownLen', meta['isoLen']), meta.get('ownPre', meta['isoPre'])
kown = {o['frame']: lfilter(B2, A2, lfilter(B1, A1, own[o['offset']:o['offset'] + OL], axis=0), axis=0) for o in meta.get('own', [])} if own is not None else {}
def own_energy(hf, ht, wt):           # K-weighted energy of group hf (unit trim) inside the 60 ms window that starts at sample wt
    if hf not in kown: return 0.0
    d = (wt - ht) % N; d = d - N if d > N // 2 else d; a, b = max(OP + d, 0), min(OP + d + W60, OL)
    return 0.0 if b <= a else float(np.sum(kown[hf][a:b] ** 2) / W60)
E = lambda k, idx: float(np.sum(np.mean(k[idx] ** 2, axis=0)))
for g in groups:
    F, t = g['frame'], g['target']; idx = np.arange(t, t + W60) % N
    Eb, Eh = E(kb, idx), E(kh, idx); Lb, Lh = 10 * np.log10(Eb + 1e-20), 10 * np.log10(Eh + 1e-20); over = Lh - Lb
    own_over = 10 * np.log10(own_energy(F, t, t) * 10 ** (g.get('trimDb', 0) / 10) + 1e-20) - Lb if kown else None
    gr = -20 * np.log10(np.min(gain[np.arange(t - LOOK, t + W60) % N]) + 1e-20)
    nxt = [x for x in targets if x > t]; end = min(t + W60, (nxt[0] - 96) if nxt else t + W60)
    mi = np.arange(t - 96, max(end, t - 95)) % N; mix_err = (int(mi[int(np.argmax(hmono[mi]))]) - t) % N
    mix_err = mix_err - N if mix_err > N // 2 else mix_err
    parts = []
    for p in isoby.get(F, []):
        w = iso[p['offset']:p['offset'] + meta['isoLen']]; pre = meta['isoPre']
        if p['kind'] == 'texture':
            thr = 1e-4 * np.max(np.abs(w)); nz = np.nonzero(np.abs(w) > thr)[0]; e = (int(nz[0]) - pre) if nz.size else 0; tol = SR * 0.001
        else:
            e = int(np.argmax(np.abs(w[:pre + W60]))) - pre; tol = 1 if p['kind'] == 'tonal' else SPF
        parts.append(dict(part=p['part'], kind=p['kind'], err_samples=e, err_ms=round(e / SR * 1000, 3), ok=abs(e) <= tol))
    tgt = LTO.get(F, LT)
    ok_t = all(p['ok'] for p in parts); ok_l = LV[0] <= over <= LV[1] and (own_over is None or own_over >= OWN_MIN - 0.5); ok_g = gr <= MAXGR
    bad = [n for n, o in (('timing', ok_t), ('level', ok_l), ('limiter', ok_g)) if not o]
    if bad: fails.append(f"f{F}:{'/'.join(bad)}")
    rows.append(dict(frame=F, target=t, ids=g['ids'], parts=parts, mix_peak_err_ms=round(mix_err / SR * 1000, 3), hit_db=round(Lh, 2), bed_db=round(Lb, 2), Eh=Eh, Eb=Eb,
                     over_bed_db=round(over, 2), own_over_bed_db=None if own_over is None else round(own_over, 2), level_target=tgt, lim_gr_db=round(gr, 2), guard_db=g.get('guardDb', 0), trim_db=g.get('trimDb', 0), fail=bad))

# ---------- master ----------
L = lufs(master); TP = true_peak(master); SP = 20 * np.log10(np.max(np.abs(master)) + 1e-20)
d1 = np.abs(np.diff(np.concatenate([master, master[:1]], 0), axis=0)).max(axis=1); seam = float(d1[-1]); p999 = float(np.percentile(d1, 99.9))
d2 = np.abs(np.diff(np.concatenate([master[-2:], master, master[:2]], 0), n=2, axis=0)).max(axis=1); seam2 = float(d2[:4].max()); p999_2 = float(np.percentile(d2, 99.9))
summary = dict(integrated_lufs=round(L, 2), true_peak_dbtp_4x=round(TP, 2), sample_peak_dbfs=round(SP, 2), master_gain_db=round(20 * np.log10(G), 2),
               max_limiter_gr_db=round(-20 * np.log10(gain.min()), 2), seam_step=round(seam, 5), p99_9_step=round(p999, 5), seam_2nd_diff=round(seam2, 5), p99_9_2nd_diff=round(p999_2, 5),
               hits_min_over_bed=round(min(r['over_bed_db'] for r in rows), 2) if rows else None, hits_max_over_bed=round(max(r['over_bed_db'] for r in rows), 2) if rows else None)
ok_master = abs(L - LUFS_T) <= 0.5 and TP <= -1.0 and seam <= p999 and seam2 <= p999_2
if not ok_master: fails.append('master')

if not QUIET:
    print(f"\n{'frame':>5} {'target':>7}  {'iso err (ms)':<22} {'mix ms':>7} {'own':>6} {'hit dB':>7} {'bed dB':>7} {'over':>6} {'GR dB':>6} {'trim':>6}  ids")
    for r in rows:
        pe = ' '.join(f"{p['part'][0]}:{p['err_ms']:+.3f}" for p in r['parts'])
        print(f"{r['frame']:5d} {r['target']:7d}  {pe:<22} {r['mix_peak_err_ms']:+7.2f} {(r['own_over_bed_db'] if r['own_over_bed_db'] is not None else float('nan')):+6.2f} {r['hit_db']:7.1f} {r['bed_db']:7.1f} {r['over_bed_db']:+6.2f} {r['lim_gr_db']:6.2f} {r['trim_db']:+6.2f}  {','.join(r['ids'])[:40]}" + ('  <-- ' + ','.join(r['fail']) if r['fail'] else ''))
    for r in rows:
        if r['fail'] and ('limiter' in r['fail'] or ('level' in r['fail'] and r['lim_gr_db'] > 0.6 * MAXGR and r['over_bed_db'] < r['level_target'])):
            print(f"  hint f{r['frame']}: crest-stacked (peak without 60 ms energy). Trims cannot fix it: lower the peaky part (noise riser peak, sub, kick, "
                  f"phase-aligned partials) or raise the sustained part, or move a peak off the crest sample (random-phase bloom).")
    for r in rows:
        if r['fail'] and 'level' in r['fail'] and r['own_over_bed_db'] is not None and r['over_bed_db'] - r['own_over_bed_db'] > 2.0:
            print(f"  hint f{r['frame']}: its window is dominated by a neighbour (mix {r['over_bed_db']:+.1f} vs own {r['own_over_bed_db']:+.1f} dB): shorten or lower the earlier tail, or space the hits.")
    print('\nmaster:', json.dumps(summary))
else:
    print(f"over-bed {summary['hits_min_over_bed']}..{summary['hits_max_over_bed']} dB, max GR {summary['max_limiter_gr_db']} dB, LUFS {summary['integrated_lufs']}, TP {summary['true_peak_dbtp_4x']} dBTP, fails {len(fails)}")
print('RESULT:', 'PASS' if not fails else 'FAIL ' + ' '.join(fails))
json.dump(dict(rows=[{k: v for k, v in r.items() if k not in ('Eh', 'Eb')} for r in rows], master=summary, pass_=not fails, fails=fails), open(os.path.join(A, 'report.json'), 'w'), indent=1)

if TUNE:
    # One linear model, solved: window w's energy ~= sum_h x_h * e[w,h] (x_h = 10^(trim_h/10), e = group h's own unit-trim energy in window w;
    # tonal hits at different pitches and noise add in power). Each round rescales the model by measured/predicted per window (cross terms,
    # reverb), then a bounded least-squares fit puts every window on its target. Groups the limiter is already squeezing get an upper bound.
    from scipy.optimize import lsq_linear
    tp = os.path.join(A, 'trims.json'); trims = json.load(open(tp)) if os.path.exists(tp) else {}
    if not kown or not rows:
        for r in rows: trims[str(r['frame'])] = float(np.clip(trims.get(str(r['frame']), 0.0) + 0.85 * (r['level_target'] - r['over_bed_db']), -30, 30))
    else:
        M = np.array([[own_energy(h['frame'], h['target'], w['target']) for h in rows] for w in rows])
        x0 = np.array([10 ** (trims.get(str(r['frame']), 0.0) / 10) for r in rows]); P = M @ x0
        c = np.clip(np.array([r['Eh'] for r in rows]) / np.maximum(P, 1e-30), 0.25, 4.0)
        b = np.array([r['Eb'] * 10 ** (r['level_target'] / 10) for r in rows])
        # every hit must still read ON ITS OWN: its own level over the bed stays in [OWN_MIN, level max]. Without this floor the solver
        # silences hits whose windows are already filled by a neighbour's tail (numbers pass, the design breaks).
        own_e = np.maximum(np.diag(M), 1e-30); Eb = np.array([r['Eb'] for r in rows])
        lb = Eb * 10 ** (OWN_MIN / 10) / own_e
        # limiter memory: once a group's window needed more than maxGr at trim T, its trim never goes above T - (GR - 0.8 maxGr) again
        ceil = {k: v for k, v in trims.get('_ceil', {}).items()}
        for r in rows:
            if r['lim_gr_db'] > 0.9 * MAXGR: f = str(r['frame']); ceil[f] = min(ceil.get(f, 99.0), trims.get(f, 0.0) - (r['lim_gr_db'] - 0.8 * MAXGR))
        ub = np.minimum(Eb * 10 ** (LV[1] / 10) / own_e, [10 ** (ceil[str(r['frame'])] / 10) if str(r['frame']) in ceil else 1e9 for r in rows])
        lb = np.minimum(lb, ub * 0.999)
        Amat, yv = (c[:, None] * M) / b[:, None], np.ones(len(rows))
        xref = Eb / own_e                                                    # x at which a group alone sits exactly at bed level
        reg = [(k, k + 1) for k in range(len(rows) - 1) if rows[k + 1]['frame'] - rows[k]['frame'] <= 3]   # dense runs: equal own levels, no lumpy ticks
        if reg:
            R = np.zeros((len(reg), len(rows)))
            for i, (k, j) in enumerate(reg): R[i, k], R[i, j] = 0.3 / xref[k], -0.3 / xref[j]
            Amat, yv = np.vstack([Amat, R]), np.concatenate([yv, np.zeros(len(reg))])
        x = lsq_linear(Amat, yv, bounds=(lb, ub)).x
        for k, r in enumerate(rows): cur = trims.get(str(r['frame']), 0.0); trims[str(r['frame'])] = float(np.clip(cur + 0.9 * (10 * np.log10(max(x[k], 1e-6)) - cur), -30, 30))
        trims['_ceil'] = ceil
    json.dump(trims, open(tp, 'w'), indent=1); print('trims written:', tp)

if WRITE:
    def wav24(path, x):
        q = np.clip(np.round(np.clip(x, -1, 1) * 8388607), -8388608, 8388607).astype(np.int64).reshape(-1) & 0xFFFFFF
        raw = np.zeros((q.size, 3), np.uint8); raw[:, 0] = q & 0xFF; raw[:, 1] = (q >> 8) & 0xFF; raw[:, 2] = (q >> 16) & 0xFF; data = raw.tobytes()
        open(path, 'wb').write(b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 2, SR, SR * 6, 6, 24) + b'data' + struct.pack('<I', len(data)) + data)
    name = meta.get('name', 'loop'); mp = os.path.join(D, f'{name}-master.wav'); wav24(mp, master)
    n = 96; w = 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / n)          # 2 ms raised cosine; first sample 0, last sample 0
    fd = master.copy(); fd[:n] *= w[:, None]; fd[-n:] *= w[::-1][:, None]; wav24(os.path.join(A, 'loop_faded.wav'), fd)
    wav24(os.path.join(A, 'two_loops.wav'), np.concatenate([master, master], 0))
    np.save(os.path.join(A, 'master_float.npy'), master.astype(np.float32))
    print('wrote', mp, '+ audio/loop_faded.wav + audio/two_loops.wav')
sys.exit(0 if not fails else 3)          # 3 = measured FAIL (1 would be a crash)
