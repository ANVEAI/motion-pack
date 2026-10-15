"""storyboard/real.py: real key frames from a built composition (HyperFrames snapshot) at each shot's hero time.
A plan.json from a template (templates/<name>/out/plan.json) sits next to the composition's index.html; `hyperframes snapshot` opens that page in Chrome and saves a PNG at each time.
It is optional: with no plan, no composition or no browser the board falls back to the schematic frame and says so.
`--describe false` is always passed: HyperFrames sends frames to a cloud vision model by default whenever GEMINI_API_KEY is set, and a storyboard must never do that by accident."""
import glob
import os
import shlex
import subprocess

from PIL import Image

from storyboard import core

HF = 'hyperframes@0.8.142'


class Unavailable(Exception):
    pass


def project_dir(plan_path, override=None):
    """the composition folder: --project, else the folder above the plan's out/ when it holds an index.html, else the plan's own folder"""
    if override:
        return os.path.abspath(override)
    d = os.path.dirname(os.path.abspath(plan_path))
    for c in (os.path.dirname(d), d):
        if os.path.exists(os.path.join(c, 'index.html')):
            return c
    raise Unavailable('no index.html next to %s (pass --project <composition folder>)' % plan_path)


def shot_windows(shots, tl, plan):
    """(start_s, dur_s) of each shot on the COMPOSITION's clock: the plan's own shot timing when it has the shotlist's shot ids (or the same number of shots), else the shotlist's"""
    ps = [p for p in (plan or {}).get('shots') or [] if isinstance(p, dict) and 'start' in p and 'dur' in p]
    by_id = {p.get('id'): p for p in ps}
    if ps and all(s.get('id') in by_id for s in shots):
        return [(float(by_id[s['id']]['start']), float(by_id[s['id']]['dur'])) for s in shots], 'plan shots by id'
    if ps and len(ps) == len(shots):
        return [(float(p['start']), float(p['dur'])) for p in ps], 'plan shots by order'
    return [(r['start_s'], r['dur_s']) for r in tl], 'shotlist timing'


def hero_times(windows, fps, frac):
    """the moment of each shot to show: frac of the way in, kept inside the shot by a frame"""
    out = []
    for st, du in windows:
        t = st + du * frac
        out.append(round(min(max(t, st), st + max(du - 1.0 / fps, 0.0)), 3))
    return out


def snapshot_cmd():
    env = os.environ.get('STORYBOARD_SNAPSHOT_CMD')          # tests point this at a stub; a user can point it at a local hyperframes
    return shlex.split(env) if env else ['npx', '-y', HF]


def snapshot(project, times, out_dir, timeout=300):
    """PNGs of the composition at `times` (seconds). Raises Unavailable when the tool, the browser or the page fails."""
    os.makedirs(out_dir, exist_ok=True)
    for stale in glob.glob(os.path.join(out_dir, 'frame-*.png')):      # frames of an earlier run would be counted as this run's
        os.remove(stale)
    cmd = snapshot_cmd() + ['snapshot', project, '--at', ','.join('%g' % t for t in times), '--no-end', '--describe', 'false', '-o', out_dir]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise Unavailable('hyperframes snapshot did not run: %s' % e)
    if r.returncode != 0:
        raise Unavailable('hyperframes snapshot exit %d: %s' % (r.returncode, (r.stdout + r.stderr)[-300:]))
    files = sorted(glob.glob(os.path.join(out_dir, 'frame-*.png')))
    if len(files) != len(times):
        raise Unavailable('hyperframes snapshot wrote %d frames, %d were asked for' % (len(files), len(times)))
    return [Image.open(f).convert('RGB') for f in files]
