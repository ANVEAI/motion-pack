"""motion-pack/cuts/retime.py: frame-exact retime plans and ffmpeg chains for the speed-ramp presets in retime.json (stdlib only).
    python3 retime.py plan   --preset heroRamp --anchor 2.0 --dur 6 [--fps 30] [--step 2]      -> JSON: segments, output frames, frame map, sfx cues
    python3 retime.py ffmpeg --preset heroRamp --anchor 2.0 --dur 6 --input in.mp4 --out out.mp4 [--no-audio] [--run]
How: the rate curve (piecewise linear keys, same maths as transitions/lib/tx-core.js speedRamp) is integrated exactly; output time is cut into
`step`-frame pieces, each piece gets the exact source interval [S(t0), S(t1)] and the constant rate (S(t1)-S(t0))/(t1-t0), so the
cumulative source position never drifts (error <= rounding of one trim). Video per piece: trim -> setpts=(PTS-STARTPTS)/rate -> fps -> pad/trim to
exactly K frames. Freeze pieces loop one source frame. Reverse segments use the reverse filter. Audio: atrim + atempo chain (0.5..2 per stage),
silence for freeze and reverse (pitch-shifted audio sounds wrong there; lay the preset's SFX instead)."""
import argparse, json, math, os, shlex, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); P = json.load(open(os.path.join(HERE, 'retime.json')))['presets']

def rate_fn(keys):
    def r(t):
        if t <= keys[0][0]: return keys[0][1]
        if t >= keys[-1][0]: return keys[-1][1]
        for (a, ra), (b, rb) in zip(keys, keys[1:]):
            if a <= t <= b: return ra + (rb - ra) * (t - a) / (b - a)
    return r

def integ(keys, t0, t1):
    """exact integral of the piecewise-linear rate over [t0, t1] (anchor-relative)"""
    pts = sorted({t0, t1, *[k[0] for k in keys if t0 < k[0] < t1]}); r = rate_fn(keys)
    return sum((b - a) * (r(a) + r(b)) / 2 for a, b in zip(pts, pts[1:]))

def plan(preset, anchor, dur, fps=30, step=2):
    pr = P[preset]; segs = []; out_f = 0
    if 'segments' in pr:   # explicit (reverse flash): source starts at the anchor
        src = anchor
        for s in pr['segments']:
            if s['type'] == 'reverse':
                k = round(s['src_dur'] / s['rate'] * fps); segs.append({'type': 'reverse', 'src0': round(max(0, src - s['src_dur']), 6), 'src1': round(src, 6), 'frames': k, 'rate': s['rate']}); src = max(0, src - s['src_dur'])
            else:
                k = round(s['dur'] * fps); segs.append({'type': 'speed', 'src0': round(src, 6), 'src1': round(src + s['dur'] * s['rate'], 6), 'frames': k, 'rate': s['rate']}); src += s['dur'] * s['rate']
            out_f += k
        return {'preset': preset, 'fps': fps, 'segments': segs, 'out_frames': out_f, 'sfx': cues(pr, anchor, fps, 0)}
    keys = pr['keys']; t_lo, t_hi = keys[0][0], keys[-1][0]
    # output timeline: real time before the ramp window, ramp pieces, real time after; anchor-relative output time u maps to source anchor + S(u)
    a0 = anchor + t_lo                      # ramp window starts at the same output and source time
    if a0 > 0: segs.append({'type': 'speed', 'src0': 0.0, 'src1': round(a0, 6), 'frames': round(a0 * fps), 'rate': 1.0})
    n = round((t_hi - t_lo) * fps); f = 0; src = a0
    while f < n:
        k = min(step, n - f); u0, u1 = t_lo + f / fps, t_lo + (f + k) / fps; ds = integ(keys, u0, u1); r = ds / (k / fps)
        segs.append({'type': 'freeze' if r < 1e-6 else 'speed', 'src0': round(src, 6), 'src1': round(src + ds, 6), 'frames': k, 'rate': round(r, 6)}); src += ds; f += k
    rest = dur - src
    if rest > 1e-6: segs.append({'type': 'speed', 'src0': round(src, 6), 'src1': round(dur, 6), 'frames': round(rest * fps), 'rate': 1.0})
    merged = []
    for s in segs:   # merge equal-rate neighbours to keep the filter graph short
        if merged and s['type'] == merged[-1]['type'] == 'speed' and abs(s['rate'] - merged[-1]['rate']) < 1e-9 and abs(s['src0'] - merged[-1]['src1']) < 1e-6:
            merged[-1]['src1'] = s['src1']; merged[-1]['frames'] += s['frames']
        elif merged and s['type'] == merged[-1]['type'] == 'freeze' and abs(s['src0'] - merged[-1]['src0']) < 1e-6: merged[-1]['frames'] += s['frames']
        else: merged.append(dict(s))
    out_f = sum(s['frames'] for s in merged)
    return {'preset': preset, 'fps': fps, 'anchor_out_frame': round((anchor) * fps), 'segments': merged, 'out_frames': out_f, 'source_used_s': round(src, 4), 'sfx': cues(pr, anchor, fps, t_lo)}

def cues(pr, anchor, fps, t_lo):
    at = {'cut': round(anchor * fps), 'start': round((anchor + t_lo) * fps)}
    return [{'id': s[0], 'frame': at.get(s[1], at['cut']) + s[2], 'gain_db': s[3]} for s in pr.get('sfx', [])]

def atempo(r):
    st = []
    while r < 0.5: st.append(0.5); r /= 0.5
    while r > 2.0: st.append(2.0); r /= 2.0
    return ','.join(f'atempo={x:.6f}' for x in st + [r])

def filtergraph(pl, audio=True):
    fps, v, a, parts = pl['fps'], [], [], []
    for i, s in enumerate(pl['segments']):
        K = s['frames']
        if s['type'] == 'freeze':
            f0 = int(round(s['src0'] * fps)); v.append(f"[0:v]trim=start_frame={f0}:end_frame={f0 + 1},setpts=PTS-STARTPTS,loop=loop={K - 1}:size=1:start=0,fps={fps},trim=end_frame={K},setpts=PTS-STARTPTS[v{i}]")
        elif s['type'] == 'reverse':
            v.append(f"[0:v]trim=start={s['src0']}:end={s['src1']},setpts=PTS-STARTPTS,reverse,setpts=PTS/{s['rate']},fps={fps},tpad=stop_mode=clone:stop=-1,trim=end_frame={K},setpts=PTS-STARTPTS[v{i}]")
        else:
            e = max(s['src1'], s['src0'] + 1.5 / fps)   # a near-freeze piece must still contain one source frame (clone-padded to K below)
            v.append(f"[0:v]trim=start={s['src0']}:end={e:.6f},setpts=(PTS-STARTPTS)/{s['rate']},fps={fps},tpad=stop_mode=clone:stop=-1,trim=end_frame={K},setpts=PTS-STARTPTS[v{i}]")
        if audio:
            d = K / fps
            if s['type'] == 'speed' and s['src1'] - s['src0'] > 0.02: a.append(f"[0:a]atrim=start={s['src0']}:end={s['src1']},asetpts=PTS-STARTPTS,{atempo(s['rate'])},apad,atrim=end={d:.6f}[a{i}]")
            else: a.append(f"anullsrc=r=48000:cl=stereo,atrim=end={d:.6f}[a{i}]")
    n = len(pl['segments']); g = ';'.join(v + a)
    g += ';' + ''.join(f'[v{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[vo]'
    if audio: g += ';' + ''.join(f'[a{i}]' for i in range(n)) + f'concat=n={n}:v=0:a=1[ao]'
    return g

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['plan', 'ffmpeg']); ap.add_argument('--preset', required=True, choices=sorted(P)); ap.add_argument('--anchor', type=float, default=1.0)
    ap.add_argument('--dur', type=float, default=4.0); ap.add_argument('--fps', type=int, default=30); ap.add_argument('--step', type=int, default=2)
    ap.add_argument('--input'); ap.add_argument('--out'); ap.add_argument('--no-audio', action='store_true'); ap.add_argument('--run', action='store_true'); a = ap.parse_args()
    pl = plan(a.preset, a.anchor, a.dur, a.fps, a.step)
    if a.cmd == 'plan': print(json.dumps(pl, indent=1)); return
    if not (a.input and a.out): sys.exit('ffmpeg needs --input and --out')
    g = filtergraph(pl, not a.no_audio); cmd = ['ffmpeg', '-v', 'error', '-y', '-i', a.input, '-filter_complex', g, '-map', '[vo]'] + ([] if a.no_audio else ['-map', '[ao]']) + ['-r', str(a.fps), a.out]
    print(' '.join(shlex.quote(c) for c in cmd))
    if a.run: subprocess.run(cmd, check=True)

if __name__ == '__main__': main()
