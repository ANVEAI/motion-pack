"""storyboard/animatic.py: the animatic. The board frames timed to the shot durations, the sound intent as real pack sounds, a locked bed (or a click track), burnt-in timecode.

  frames   shot i lasts timeline()[i].frames frames; the whole file has round(total seconds x fps) frames (the test pins it to the frame)
  cuts     a hard cut by default; a shot's transition kind is shown as a fade or a push of the first frames of the INCOMING shot, so no transition changes the length
           (the animatic shows the kind, not the final transition: the real one comes from transitions/ at the full render)
  sound    plan.json cues when a plan is given; otherwise the shot's `sound` line, clause by clause, through storyboard/sound_intents.json (a clause no rule matches is listed
           as intent only: no sound is invented), plus the paired sweetener of every non-cut transition (sfx/mpaudio/sweeteners.py)
  bed      --music music/<bed> (or plan.music), its sidecar's beat frames reported against the cuts; with none, a click track at --bpm / plan.bpm / 120
  master   music/mixer.py: -14 LUFS-I, true-peak limiter, AAC probes; the delivered MP4 is decoded again and measured, and the mix is lowered until it is <= -1.0 dBTP"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

from storyboard import core, draw

SR = 48000
AN = core.SPEC['animatic']


def _music_modules():
    for p in (os.path.join(core.PACK, 'music'), os.path.join(core.PACK, 'sfx')):
        if p not in sys.path:
            sys.path.insert(0, p)
    import mixer                                  # noqa: E402 (music/mixer.py)
    from mpaudio import meter, sweeteners, registry  # noqa: E402
    import importlib
    import recipes
    for m in recipes.MODULES:
        importlib.import_module('recipes.' + m)
    return mixer, meter, sweeteners, registry


# ---------------------------------------------------------------------------------------------------------------- sound intent -> cues
def _rules():
    return core.load_json(os.path.join(core.PACK, 'storyboard', 'sound_intents.json'))['rules']


def sid(pid):
    p = pid.split('/')
    return 'snd.' + '.'.join(p[1:]) if p[0] == 'sfx' else pid


def clauses(sound):
    return [c.strip() for c in re.split(r';|\bthen\b', sound or '') if c.strip()]


def match(clause, rules):
    low = clause.lower()
    for r in rules:
        if any(re.search(r'(?<![a-z])' + re.escape(w), low) for w in r['words']):
            return r['id']
    return None


def intent_cues(shots, tl, total):
    """cues from each shot's sound line: clause k of n lands n-ways across the shot, the first on its first frame. returns (cues, intent_only)"""
    rules, cues, only = _rules(), [], []
    for s, row in zip(shots, tl):
        cl = clauses(s.get('sound'))
        for k, c in enumerate(cl):
            frame = row['start_frame'] + (k * row['frames']) // max(1, len(cl))
            pid = match(c, rules)
            if pid and frame < total:
                cues.append({'id': pid, 'frame': frame, 'shot': row['id'], 'why': c, 'until_frame': row['start_frame'] + row['frames']})
            elif not pid:
                only.append({'shot': row['id'], 'clause': c})
    return cues, only


def plan_cues(plan, fps, total, registry):
    """the cue sheet of a plan.json (cues[{id, t, why}]): frame = round(t x fps); ambience loops are skipped (the bed replaces them), unknown ids are reported"""
    cues, skipped = [], []
    for c in plan.get('cues') or []:
        if c.get('loopTo'):
            continue
        f = int(round(c['t'] * fps))
        if sid(c['id']) not in registry.SOUNDS:
            skipped.append(c['id'])
        elif f < total:
            cues.append({'id': c['id'], 'frame': f, 'shot': None, 'why': c.get('why', '')})
    return cues, skipped


def tx_render(kind):
    return core.SPEC['transition_render'].get((kind or 'cut'), 'fade')


def transitions(shots, tl, fps):
    """per shot: {kind, reason, render (hard | fade | push), frames}. Frames are the first frames of the incoming shot, at most half of it."""
    out = []
    for i, (s, row) in enumerate(zip(shots, tl)):
        t = s.get('transition') or {}
        kind = t.get('kind') or 'cut'
        r = 'hard' if i == 0 else tx_render(kind)
        k = 0
        if r != 'hard':
            k = int(round(AN['transition_frames']['fade' if r == 'fade' else 'push'] * fps))
            k = max(1, min(k, int(row['frames'] * AN['transition_max_share_of_shot'])))
        out.append({'kind': kind, 'reason': t.get('reason'), 'render': r if k else 'hard', 'frames': k})
    return out


# ---------------------------------------------------------------------------------------------------------------- bed
def bed_info(music_id, bpm, plan):
    """which bed: a music/<id> (or the plan's), else a click track. returns {kind, id, file, bpm, sidecar, source}"""
    src = '--music'
    if not music_id and plan and plan.get('music'):
        music_id, src = plan['music'], 'plan.music'
    if music_id:
        man = core.load_json(os.path.join(core.PACK, 'music', 'manifest.json'))['items']
        key = 'music.' + music_id.split('/', 1)[1] if music_id.startswith('music/') else music_id
        it = next((i for i in man if i['id'] == key), None)
        if it is None:
            raise SystemExit('unknown music bed "%s" (ids: music/manifest.json)' % music_id)
        f = os.path.join(core.PACK, 'music', it['file'])
        if not os.path.exists(f):
            raise SystemExit('music bed WAV missing: %s\nthe WAV masters are not in git: run `python3 music/build_music.py --only %s` (or the whole library, about a minute)' % (f, it['id'][6:]))
        sc = os.path.join(core.PACK, 'music', it['sidecar']) if it.get('sidecar') else None
        return {'kind': 'music', 'id': music_id, 'file': f, 'bpm': it.get('bpm'), 'sidecar': sc if sc and os.path.exists(sc) else None, 'source': src, 'duration_s': it.get('duration_s')}
    b = float(bpm or (plan or {}).get('bpm') or AN['default_bpm'])
    return {'kind': 'click', 'id': None, 'file': None, 'bpm': b, 'sidecar': None, 'source': '--bpm' if bpm else ('plan.bpm' if plan and plan.get('bpm') else 'default'), 'duration_s': None}


def click_track(bpm, seconds):
    """a soft click on every beat (higher on the bar), 4/4, SR 48k stereo. Deterministic; a placeholder pulse, not music."""
    n = int(round((seconds + 1) * SR))
    y = np.zeros(n)
    beat = 60.0 / bpm
    k = 0
    while k * beat < seconds + 1:
        f0 = 1500.0 if k % 4 == 0 else 1000.0
        i0 = int(round(k * beat * SR))
        L = int(0.02 * SR)
        t = np.arange(min(L, n - i0)) / SR
        y[i0:i0 + len(t)] += 0.5 * np.sin(2 * np.pi * f0 * t) * np.exp(-t * 180.0)
        k += 1
    return np.stack([y, y], 1)


def beat_alignment(cut_frames, bed, fps):
    """information only: how far each hard cut sits from the bed's nearest beat (frames), from the bed's sidecar beat_frames (or the click grid)"""
    if not cut_frames:
        return None
    if bed['sidecar']:
        sc = core.load_json(bed['sidecar'])
        sfps = float(sc['meta']['fps'])
        beats = np.array(sc['beat_frames'], float) / sfps
        loop = (bed['duration_s'] or (beats[-1] + 60.0 / (bed['bpm'] or 120))) if bed['kind'] == 'music' else None
    else:
        beats, loop = np.arange(0, 600) * (60.0 / bed['bpm']), None
    out = []
    for f in cut_frames:
        t = f / fps
        tt = (t % loop) if loop else t
        d = float(np.min(np.abs(beats - tt)))
        if loop:
            d = min(d, float(np.min(np.abs(beats + loop - tt))), float(np.min(np.abs(beats - loop - tt))))
        out.append(int(round(d * fps)))
    return {'cut_frames': list(cut_frames), 'frames_from_nearest_beat': out, 'share_within_2_frames': round(sum(1 for d in out if d <= 2) / len(out), 2)}


# ---------------------------------------------------------------------------------------------------------------- the plan
def build_plan(sl, ctx, tl, boards_source, plan, music_id, bpm, cut_ticks):
    """the animatic plan: a pure function of the inputs (no clock, no paths, no measurements): what is on which frame and which sound goes where"""
    fps = sl.get('fps') or 30
    shots = sl['shots']
    total = core.total_frames(shots, fps)
    tr = transitions(shots, tl, fps)
    mixer, meter, sweeteners, registry = _music_modules()
    notes = []
    if plan and plan.get('cues'):
        cues, skipped = plan_cues(plan, fps, total, registry)
        sound_from, only, sweet = 'plan.json cues', [], []
        if skipped:
            notes.append('plan cue ids not in the sound library, skipped: %s' % ', '.join(sorted(set(skipped))))
    else:
        cues, only = intent_cues(shots, tl, total)
        sound_from, sweet = "each shot's sound line (storyboard/sound_intents.json)", []
        for i, (row, t) in enumerate(zip(tl, tr)):
            if i == 0:
                continue
            kind = t['kind'] if t['kind'] != 'cut' else ('hardCut' if cut_ticks else None)
            if kind and kind in sweeteners.TABLE:
                sweet.append({'kind': kind, 'frame': row['start_frame'], 'duration_frames': t['frames'], 'shot': row['id']})
            elif kind:
                notes.append('%s: transition "%s" has no paired sweetener, silent' % (row['id'], kind))
    bed = bed_info(music_id, bpm, plan)
    cuts = [row['start_frame'] for row, t in zip(tl[1:], tr[1:])]
    out = {'module': 'storyboard', 'version': core.MANIFEST['version'], 'fps': fps, 'size': [ctx.bw, ctx.bh], 'frames': total, 'seconds': round(total / fps, 4),
           'frame_source': boards_source, 'sound_from': sound_from,
           'bed': {'kind': bed['kind'], 'id': bed['id'], 'bpm': bed['bpm'], 'chosen_by': bed['source']},
           'shots': [{'id': s.get('id'), 'beat': s.get('beat'), 'start_frame': row['start_frame'], 'frames': row['frames'], 'start_tc': core.tc(row['start_frame'], fps),
                      'transition': t, 'sound_intent': s.get('sound')} for s, row, t in zip(shots, tl, tr)],
           'cues': sorted(cues, key=lambda c: (c['frame'], c['id'])), 'sweeteners': sweet, 'intent_only': only,
           'beat_alignment': beat_alignment(cuts, bed, fps),
           'master': {'lufs': AN['lufs'], 'ceiling_db': AN['ceiling_db'], 'delivered_tp_max_db': AN['delivered_tp_max_db']}, 'notes': notes}
    out['_bed'] = bed
    return out


# ---------------------------------------------------------------------------------------------------------------- picture
def _frame_stream(ap, boards, shots, tl, fps, ctx):
    """yield the RGB bytes of every frame: the shot's board, a fade or a push over the first frames of an incoming shot, the burnt-in timecode and shot id"""
    font = ctx.fonts.get('mono', max(14, round(ctx.bw / 40)))
    total = ap['frames']
    for i, (row, s) in enumerate(zip(tl, shots)):
        t = ap['shots'][i]['transition']
        for j in range(row['frames']):
            f = row['start_frame'] + j
            cur = boards[i]
            if i > 0 and j < t['frames']:
                prev = boards[i - 1]
                a = (j + 1) / (t['frames'] + 1)
                if t['render'] == 'fade':
                    cur = Image.blend(prev, cur, a)
                else:
                    off = int(round(a * cur.width))
                    im = Image.new('RGB', cur.size)
                    im.paste(prev, (-off, 0))
                    im.paste(cur, (cur.width - off, 0))
                    cur = im
            im = cur.copy()
            d = ImageDraw.Draw(im)
            label = '%s  %s %s  %d/%d' % (core.tc(f, fps), s.get('id'), s.get('beat'), i + 1, len(shots))
            w = font.getlength(label)
            d.rectangle((8, 8, 8 + w + 16, 8 + font.size * 1.7), fill=(20, 20, 20))
            d.text((16, 8 + font.size * 0.3), label, font=font, fill=(255, 255, 255))
            yield im.tobytes()
    assert total == sum(r['frames'] for r in tl)


def encode_video(ap, boards, shots, tl, fps, ctx, out_path):
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (ctx.bw, ctx.bh), '-r', str(fps), '-i', '-',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', str(AN['crf']), '-pix_fmt', 'yuv420p', '-an', '-frames:v', str(ap['frames']),
           '-fflags', '+bitexact', '-flags:v', '+bitexact', '-map_metadata', '-1', out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for b in _frame_stream(ap, boards, shots, tl, fps, ctx):
            p.stdin.write(b)
        p.stdin.close()
        err = p.stderr.read().decode()
        if p.wait() != 0:
            raise RuntimeError('ffmpeg failed: ' + err[-600:])
    finally:
        if p.poll() is None:
            p.kill()


# ---------------------------------------------------------------------------------------------------------------- sound
def mix_audio(ap, fps, ceiling_db=None):
    """the master (n x 2, float) from the plan's bed, cues and sweeteners through music/mixer.py, and its report"""
    mixer, meter, sweeteners, registry = _music_modules()
    bed = ap['_bed']
    seconds = ap['frames'] / fps
    mx = mixer.Mix(fps, seconds)
    if bed['kind'] == 'music':
        y, sr = sf.read(bed['file'], always_2d=True)
        assert sr == SR
        mx.add_bed(y, 0, 0.0, True)
    else:
        mx.add_bed(click_track(bed['bpm'], seconds), 0, -6.0, False)
    for c in ap['cues']:
        mx.add_cue(sid(c['id']), c['frame'], why=c.get('why', ''), until_frame=c.get('until_frame'))   # a loop (room tone, rain) stops at the end of its shot
    for s in ap['sweeteners']:
        mx.add_transition(s['kind'], s['frame'], s['duration_frames'], 0.5)
    rep = mx.render(None, lufs=AN['lufs'], ceiling_db=AN['ceiling_db'] if ceiling_db is None else ceiling_db, aac=True, phone=False, stems=False)
    y = rep.pop('_audio')
    lint = mixer.lint_cues([{'id': c['id'], 'frame': c['frame'], 'tier': c['tier'], 'over_bed_db': c['over_bed_db']} for c in mx.cues], fps=fps, lib=mx.lib)
    return y, rep, lint


def decode_mp4(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype='<f4').astype(np.float64).reshape(-1, 2)


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,r_frame_rate,width,height:format=duration',
                        '-of', 'json', path], capture_output=True, text=True)
    j = json.loads(r.stdout)
    return {'frames': int(j['streams'][0]['nb_read_frames']), 'duration_s': float(j['format']['duration']), 'width': j['streams'][0]['width'], 'height': j['streams'][0]['height']}


def mux(video, wav, out, frames, fps):
    cmd = ['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', AN['audio_bitrate'],
           '-t', '%.6f' % (frames / fps), '-fflags', '+bitexact', '-map_metadata', '-1', '-movflags', '+faststart', out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('ffmpeg mux failed: ' + r.stderr[-600:])


def build(ap, boards, shots, tl, fps, ctx, out_dir, name='animatic'):
    """encode the picture, mix the sound, mux, and measure the DELIVERED file. returns the measurement dict (not part of the committed plan)."""
    mixer, meter, sweeteners, registry = _music_modules()
    os.makedirs(out_dir, exist_ok=True)
    vid, wav, mp4 = (os.path.join(out_dir, name + s) for s in ('.video.mp4', '.wav', '.mp4'))
    encode_video(ap, boards, shots, tl, fps, ctx, vid)
    ceil = AN['ceiling_db']
    for attempt in range(4):
        y, rep, lint = mix_audio(ap, fps, ceil)
        sf.write(wav, y, SR, subtype='PCM_24')
        mux(vid, wav, mp4, ap['frames'], fps)
        d = decode_mp4(mp4)
        L, tp = meter.lufs_integrated(d), meter.true_peak_db(d)
        if tp <= AN['delivered_tp_max_db'] and abs(L - AN['lufs']) <= AN['lufs_tolerance']:
            break
        ceil -= max(0.0, tp - AN['delivered_tp_max_db']) + 0.25
    os.remove(vid)
    pr = probe(mp4)
    return {'file': os.path.basename(mp4), 'frames': pr['frames'], 'expected_frames': ap['frames'], 'duration_s': pr['duration_s'], 'size': [pr['width'], pr['height']],
            'audio_samples_master': len(y), 'audio_samples_expected': int(round(ap['frames'] / fps * SR)),
            'delivered_lufs_i': round(L, 2), 'delivered_true_peak_db': round(tp, 2), 'mixer_ceiling_db_used': round(ceil, 2), 'mixer_lufs_i': rep['lufs_i'],
            'mixer_true_peak_db': rep['true_peak_db'], 'cue_trim_warnings': rep.get('warnings', []), 'sound_lint': lint, 'attempts': attempt + 1}
