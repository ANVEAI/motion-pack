"""pytest: cuts/retime.py plans are frame-exact and ffmpeg renders exactly the planned frame count (local ffmpeg, lavfi test source, no downloads)."""
import os, sys, json, subprocess, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import retime

def test_plans_integer_and_monotonic():
    for k in retime.P:
        pl = retime.plan(k, 2.0, 6.0, 30, 2)
        assert all(isinstance(s['frames'], int) and s['frames'] > 0 for s in pl['segments']), k
        if 'keys' in retime.P[k]:
            for a, b in zip(pl['segments'], pl['segments'][1:]): assert abs(a['src1'] - b['src0']) < 1e-5 or b['type'] == 'freeze' or a['type'] == 'freeze', k

def test_source_integral_matches_keys():
    pl = retime.plan('heroRamp', 2.0, 6.0, 30, 2); keys = retime.P['heroRamp']['keys']
    ramp_src = sum(s['src1'] - s['src0'] for s in pl['segments'] if s['type'] == 'speed' and s['rate'] != 1.0)
    assert abs(ramp_src - retime.integ(keys, keys[0][0], keys[-1][0])) < 1e-4

def test_freeze_holds_one_frame():
    pl = retime.plan('freezeStamp', 1.0, 3.0, 30, 2); fr = [s for s in pl['segments'] if s['type'] == 'freeze']
    assert fr and 20 <= sum(s['frames'] for s in fr) <= 24 and len({s['src0'] for s in fr}) == 1   # ~0.8 s of one held source frame

def test_ffmpeg_frame_count():
    if not shutil.which('ffmpeg'): return
    d = tempfile.mkdtemp(prefix='mp-retime-'); src = os.path.join(d, 'src.mp4'); out = os.path.join(d, 'out.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=30:d=4', '-f', 'lavfi', '-i', 'sine=f=440:d=4:r=48000', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src], check=True)
    for k in ('heroRamp', 'freezeStamp', 'reverseFlash'):
        pl = retime.plan(k, 1.5, 4.0, 30, 2); g = retime.filtergraph(pl, True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', g, '-map', '[vo]', '-map', '[ao]', '-r', '30', out], check=True)
        n = int(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip())
        assert n == pl['out_frames'], (k, n, pl['out_frames'])
