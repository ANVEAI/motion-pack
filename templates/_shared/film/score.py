"""motion-pack / templates / _shared / film / score.py: plan -> score + mix for the film templates (2026-10-16, film lane).
    python3 templates/_shared/film/score.py <dir>/out/plan.json <out.wav>
plan.score = {"style": "thriller"|"scifi"|"horror"|"drama", "act_bars": [a1, a2, a3], "button_beats": n, "tail_beats": n, "seed": s}  -> renders the genre trailer score for
  exactly this cut (music/trailer_styles.py render_styled), masters it to the library preview level (-16 LUFS) and uses it as the bed; its markers are checked against the
  plan's (plan.score.markers, frames): a mismatch stops the mix (the picture and the music must agree to the frame).
plan.music = "music/<bed id>" instead -> a library bed (tiled when it is a loop).
Cues: plan.cues [{id: "sfx/<cat>/<name>", t, overBedDb?, untilT?, seed?, pan?, why}] -> music/mixer.py cues (anchor on frame + 1, closed-form over-bed levels, until_frame for loops).
plan.audio.quiet and plan.bedAutomation pass through. Master: -14 LUFS-I, plan.ceilingDb (default -2.0) true peak, last 0.15 s digital zero (mixer). Writes <out>.json."""
import json, os, sys, subprocess, tempfile, shutil
import numpy as np
import soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
MUSIC = os.path.join(PACK, 'music')
sys.path.insert(0, MUSIC)
sys.path.insert(0, os.path.join(PACK, 'sfx'))


def sid(pid):
    p = pid.split('/')
    return 'snd.' + '.'.join(p[1:]) if p[0] == 'sfx' else pid


def bed_from_library(mid, seconds, d):
    man = json.load(open(os.path.join(MUSIC, 'manifest.json')))
    key = 'music.' + mid.split('/', 1)[1]
    it = next((i for i in man['items'] if i['id'] == key), None)
    if not it:
        raise SystemExit('music bed %s is not in music/manifest.json' % mid)
    f = os.path.join(MUSIC, it['file'])
    if not os.path.exists(f):
        raise SystemExit('music bed WAV missing: %s (run python3 music/build_music.py once)' % f)
    y, sr = sf.read(f, always_2d=True)
    n = int(round(seconds * sr)) + sr
    if it.get('loop') and len(y) < n:
        y = np.concatenate([y] * (n // len(y) + 1), axis=0)[:n]
    out = os.path.join(d, 'bed.wav')
    sf.write(out, y, sr, subtype='FLOAT')
    return out, None


def bed_from_score(sc, fps, d):
    import trailer_styles as TS
    import mixer
    r = TS.render_styled(sc['style'], fps, sc.get('seed', 1), tuple(sc['act_bars']), sc.get('button_beats'), sc.get('tail_beats'))
    want = sc.get('markers') or {}
    got = r['markers']['frames']
    bad = {k: (v, got.get(k)) for k, v in want.items() if got.get(k) != v}
    if bad:
        raise SystemExit('score markers do not match the plan (plan frame, score frame): %s' % bad)
    y, _, _ = mixer.master(r['mix'], -16.0, -1.5)
    y = TS.finish(y, fps)
    out = os.path.join(d, 'score.wav')
    sf.write(out, y, 48000, subtype='FLOAT')
    return out, r['markers']


def main():
    plan_path, out = sys.argv[1], sys.argv[2]
    P = json.load(open(plan_path))
    fps = P.get('fps', 30)
    d = tempfile.mkdtemp(prefix='mp-film-')
    if P.get('score'):
        bed, mk = bed_from_score(P['score'], fps, d)
    elif P.get('music'):
        bed, mk = bed_from_library(P['music'], P['seconds'], d)
    else:
        raise SystemExit('plan has neither score nor music')
    shutil.copyfile(bed, os.path.join(os.path.dirname(os.path.abspath(out)), os.path.splitext(os.path.basename(out))[0] + '.bed.wav'))
    cues = []
    for c in P.get('cues', []):
        k = sid(c['id'])
        row = {'id': k, 'frame': int(round(c['t'] * fps)), 'gain_db': float(c.get('gainDb', 0.0)), 'why': c.get('why', '')}
        if c.get('overBedDb') is not None:
            row['over_bed_db'] = c['overBedDb']
        if c.get('untilT') is not None:
            row['until_frame'] = int(round(c['untilT'] * fps))
        for kk in ('seed', 'pan', 'tier'):
            if c.get(kk) is not None:
                row[kk] = c[kk]
        cues.append(row)
    sheet = {'fps': fps, 'length_s': P['seconds'], 'bed': {'file': bed, 'gain_db': P.get('musicGainDb', 0.0), 'loop': False}, 'cues': cues,
             'master': {'lufs': -14.0, 'ceiling_db': P.get('ceilingDb', -2.0)}}
    q = (P.get('audio') or {}).get('quiet')
    if q:
        sheet['quiet'] = q
    if P.get('bedAutomation'):
        sheet['bed']['automation'] = P['bedAutomation']
    if P.get('vo'):   # your dialogue / VO recording, decoded from 0 s: the mixer ducks the bed under it
        vp = P['vo'] if os.path.isabs(P['vo']) else os.path.join(os.path.dirname(os.path.abspath(plan_path)), P['vo'])
        sheet['vo'] = {'file': vp, 'start_frame': 0}
        if P.get('duckDb') is not None:
            sheet['vo']['duck_db'] = P['duckDb']
    sp = os.path.join(d, 'sheet.json')
    json.dump(sheet, open(sp, 'w'))
    r = subprocess.run([sys.executable, os.path.join(MUSIC, 'mixer.py'), sp, '--out', d], capture_output=True, text=True, cwd=MUSIC)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit('music mixer failed')
    for line in r.stdout.splitlines():
        if line.startswith('WARN') or 'R2' in line or 'lint' in line.lower():
            print('mixer', line)
    shutil.copyfile(os.path.join(d, 'master.wav'), out)
    from mpaudio import meter
    x, _ = sf.read(out)
    rep = {'via': 'templates/_shared/film/score.py -> music/mixer.py', 'score': P.get('score', {}).get('style'), 'music': P.get('music'), 'markers': mk and mk['frames'],
           'lufs_i': round(meter.lufs_integrated(x), 2), 'true_peak_dbtp': round(meter.true_peak_db(x), 2), 'cues': len(cues), 'mixer_report': r.stdout[-4000:]}
    json.dump(rep, open(out + '.json', 'w'), indent=1)
    shutil.rmtree(d, ignore_errors=True)
    print(out, 'score' if P.get('score') else 'bed', P.get('score', {}).get('style') or P.get('music'), 'LUFS-I', rep['lufs_i'], 'TP', rep['true_peak_dbtp'], 'cues', len(cues))


if __name__ == '__main__':
    main()
