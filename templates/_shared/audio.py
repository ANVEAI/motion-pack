"""motion-pack/templates/_shared/audio.py: render a template's SFX cue sheet (out/plan.json) to a measured WAV with the sfx module.
    python3 templates/_shared/audio.py <dir>/out/plan.json <out.wav> [--target -14] [--ceiling -1.5]
Ids: sfx/<cat>/<name> -> sfx module id snd.<cat>.<name> (motion-pack/sfx/mpaudio registry). Missing ids are reported as TODO, never faked.
Placement (v9 contract, docs/research/sound.md): the sound's anchor sample lands on (frame + 1) * SR / fps, frame = round(t * fps).
Music: plan.music = 'music/<bed id>' (music/manifest.json) hands the whole mix to music/mixer.py (bed + cues, over-bed levels, TP limiter,\nAAC probes). Without a bed this file places the cues itself (SFX-only mix; --stem for a stem under dialogue).
Master: sum -> gain to target LUFS-I (default -14; --stem skips it) -> true-peak ceiling -2.0 dBTP (lands <= -1.5 after AAC) (simple 4x-oversampled peak gain, no limiter: if the
cues are too dense to reach target under the ceiling, the report says so). Writes <out>.json with LUFS-I, TP, per-cue placement."""
import sys, os, json, argparse
import numpy as np
from scipy.io import wavfile
PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(PACK, 'sfx'))
from mpaudio import registry, meter, dsp  # the sfx module (reuse, never duplicate)
import importlib, recipes
MISSING_MODULES = []
for _m in recipes.MODULES:   # importing a recipe module registers its sounds; modules still being built are reported, not faked
    try: importlib.import_module('recipes.' + _m)
    except Exception as e: MISSING_MODULES.append(f'{_m}: {type(e).__name__}')
SR = registry.SR

def sid(pid):
    p = pid.split('/')
    return 'snd.' + '.'.join(p[1:]) if p[0] == 'sfx' else pid

MUSIC = os.path.join(PACK, 'music')

def music_bed_file(mid):
    """music/<name> or music.<name> -> the library WAV of the music module (manifest.json), or None"""
    man = os.path.join(MUSIC, 'manifest.json')
    if not mid or not os.path.exists(man): return None
    key = 'music.' + mid.split('/', 1)[1] if mid.startswith('music/') else mid
    for it in json.load(open(man))['items']:
        if it['id'] == key: return os.path.join(MUSIC, it['file'])
    return None

def via_music_mixer(P, out, bed, a):
    """delegate to the music module's mixer (closed-form over-bed levels, ducking, TP limiter, AAC probes): never re-implemented here"""
    import subprocess, tempfile, shutil
    fps = P.get('fps', 30); cues = []
    for c in P['cues']:
        if c.get('loopTo'): continue   # the bed replaces ambience loops
        k = sid(c['id'])
        if k not in registry.SOUNDS: continue
        cues.append({'id': k, 'frame': int(round(c['t'] * fps)), 'gain_db': 0.0, 'why': c.get('why', ''), **({'over_vo_db': c['overVoDb']} if c.get('overVoDb') is not None else {}), **({'over_bed_db': c['overBedDb']} if c.get('overBedDb') is not None else {})})   # levels: the mixer solves over-bed dB per tier; plan cue overVoDb (negative dB) sits the cue under the VOICE instead (a cue over the un-ducked bed is as loud as the bed was before it ducked: wrong under a line); plan cue overBedDb (dB, negative = under the bed) sets a LOOP cue's level against the un-dipped bed (a room tone under a quiet hold: the loop default is -10 dB, far too loud there)
    d = tempfile.mkdtemp(prefix='mp-mix-'); import soundfile as sf
    # pre-tile the (seamless) loop bed to the full length here: music/mixer.py add_bed(loop=True) mis-tiles stereo beds shorter than
    # the edit (np.tile on a 2-D array -> 4 channels; reported to the music module). Passing a full-length bed with loop False avoids it.
    y, sr = sf.read(bed, always_2d=True); n = int(round(P['seconds'] * sr)) + sr
    if len(y) < n: y = np.concatenate([y] * (n // len(y) + 1), axis=0)[:n]
    bed_full = os.path.join(d, 'bed.wav'); sf.write(bed_full, y, sr, subtype='FLOAT')
    sheet = {'fps': fps, 'length_s': P['seconds'], 'bed': {'file': bed_full, 'gain_db': P.get('musicGainDb', 0.0), 'loop': False}, 'cues': cues, 'master': {'lufs': a.target, 'ceiling_db': P.get('ceilingDb', P.get('masterCeilingDb', -1.5))}}   # plan.ceilingDb: lower it (-2.0 to -2.5) when clicky UI transients or a hit at the start push HyperFrames' own AAC over -1 dBTP
    if P.get('bedAutomation'): sheet['bed']['automation'] = P['bedAutomation']   # [{frame, gain_db}] breakpoints (cuts/story45.py dropouts, quiet holds)
    if P.get('vo'):   # a dialogue / VO track placed on the timeline (plan.vo = path, relative to the plan's folder): the mixer ducks the bed under it
        vp = P['vo'] if os.path.isabs(P['vo']) else os.path.join(os.path.dirname(os.path.abspath(a.plan)), P['vo']); sheet['vo'] = {'file': vp, 'start_frame': 0}
        if P.get('duckDb') is not None: sheet['vo']['duck_db'] = P['duckDb']   # deeper than the mixer's 9 dB default (VO-led documentary)
    sp = os.path.join(d, 'sheet.json'); json.dump(sheet, open(sp, 'w'))
    r = subprocess.run([sys.executable, os.path.join(MUSIC, 'mixer.py'), sp, '--out', d], capture_output=True, text=True, cwd=MUSIC)
    if r.returncode != 0: print(r.stdout[-2000:], r.stderr[-2000:]); raise SystemExit('music mixer failed')
    shutil.copyfile(os.path.join(d, 'master.wav'), out)
    if P.get('fadeInMs'):   # a bed that starts on a hit leaves a step at sample 0; some AAC encoders overshoot it by several dB (HyperFrames then lowers the whole track)
        import soundfile as sf
        y, sr = sf.read(out, always_2d=True); info = sf.info(out); n = int(sr * P['fadeInMs'] / 1000); y[:n] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(n) / n))[:, None]; sf.write(out, y, sr, subtype=info.subtype)
    rep = {'via': 'music/mixer.py', 'bed': P.get('music'), 'mixer_report': r.stdout[-3000:]}
    import soundfile as sf
    x, _ = sf.read(out)
    rep.update({'lufs_i': round(meter.lufs_integrated(x), 2), 'true_peak_dbtp': round(meter.true_peak_db(x), 2), 'cues': len(cues), 'sfx_modules_missing': MISSING_MODULES})
    json.dump(rep, open(out + '.json', 'w'), indent=1); shutil.rmtree(d, ignore_errors=True)
    print(out, 'via music mixer, bed', P.get('music'), 'LUFS-I', rep['lufs_i'], 'TP', rep['true_peak_dbtp'], 'cues', len(cues))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('plan'); ap.add_argument('out'); ap.add_argument('--target', type=float, default=-14.0); ap.add_argument('--ceiling', type=float, default=-2.0); ap.add_argument('--stem', action='store_true', help='no loudness normalisation: cue gains are absolute (library sounds peak at their registry peak_db); for SFX stems mixed under dialogue')
    a = ap.parse_args(); P = json.load(open(a.plan)); fps = P.get('fps', 30); N = int(round(P['seconds'] * SR)) + SR
    bed = music_bed_file(P.get('music'))
    if P.get('music') and not bed: print('TODO hook: music bed', P.get('music'), 'not found in music/manifest.json: SFX-only mix')
    if bed and not a.stem: return via_music_mixer(P, a.out, bed, a)
    mix = np.zeros((N, 2), np.float32); rep = {'placed': [], 'todo': [], 'sfx_modules_missing': MISSING_MODULES}
    for i, c in enumerate(P['cues']):
        k = sid(c['id'])
        if k not in registry.SOUNDS: rep['todo'].append(c['id']); continue
        y, anchor, _ = registry.render(k, seed=c.get('seed', registry.SOUNDS[k].seed + i % 3))   # round-robin seeds for repeats
        if c.get('loopTo'):   # ambience/bed: tile the (seamless) loop from t to loopTo, no anchor offset
            n = int(round((c['loopTo'] - c['t']) * SR)); y = np.tile(y, (n // len(y) + 1, 1))[:n]; anchor = 0
        f = int(round(c['t'] * fps)); at = int(round((f + 1) * SR / fps)) - anchor if not c.get('loopTo') else int(round(c['t'] * SR))
        g = 10 ** (c.get('gainDb', 0) / 20); s0, s1 = max(0, at), min(N, at + len(y))
        if s1 > s0: mix[s0:s1] += g * y[s0 - at:s1 - at]
        rep['placed'].append({'id': c['id'], 'snd': k, 'frame': f, 'anchor_ms': round(anchor / SR * 1000, 1), 'start_s': round(at / SR, 4)})
    mix = mix[:int(round(P['seconds'] * SR))]
    L = meter.lufs_integrated(mix) if np.any(mix) else -120.0
    gain = 10 ** ((a.target - L) / 20) if (L > -100 and not a.stem) else 1.0
    tp = meter.true_peak_db(mix * gain)
    if tp > a.ceiling: gain *= 10 ** ((a.ceiling - tp) / 20)
    mix *= gain
    rep.update({'lufs_i': round(meter.lufs_integrated(mix), 2), 'true_peak_dbtp': round(meter.true_peak_db(mix), 2), 'sample_peak_dbfs': round(meter.sample_peak_db(mix), 2),
                'target_lufs': a.target, 'ceiling_dbtp': a.ceiling, 'reached_target': abs(meter.lufs_integrated(mix) - a.target) < 0.5, 'stem': a.stem, 'sr': SR})
    wavfile.write(a.out, SR, mix.astype(np.float32)); json.dump(rep, open(a.out + '.json', 'w'), indent=1)
    print(a.out, 'LUFS-I', rep['lufs_i'], 'TP', rep['true_peak_dbtp'], 'placed', len(rep['placed']), 'todo', rep['todo'])

if __name__ == '__main__':
    main()
