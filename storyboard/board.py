#!/usr/bin/env python3
"""motion-pack / storyboard / board.py: a storyboard sheet and an animatic from shotlist.json, so the story is approved before the full render.

    python3 storyboard/board.py shotlist.json [--design design.json] [--plan out/plan.json] [--music music/<bed> | --bpm 96] [--out storyboard-out]
                                [--safe <zone>] [--real auto|always|never] [--project <composition folder>] [--hero-frac 0.6]
                                [--allow-lint] [--no-animatic] [--no-pdf] [--cut-ticks]

Writes into --out: storyboard.png (the sheet), storyboard.html (live text), storyboard.pdf, panels/<shot>.png, report.json, animatic.plan.json, animatic.mp4 (+ .wav).
  1. the story-script linter runs first: a FAIL stops the drawing (exit 1, nothing written) unless --allow-lint, which records the waiver in report.json
  2. one panel per shot: the board frame, shot id, beat, time range, action, sound intent, transition and reason, camera, honesty label, and that panel's warnings
       - on-screen text laid out at its real size in the design's fonts; reading speed per line (<= 3.5 words/s, the linter's own limit); text outside the platform safe zone
       - with --plan (and a built composition and Chrome), REAL key frames from HyperFrames snapshot at each shot's hero time instead of the schematic
  3. the animatic: the panels timed to the shot durations (hard cuts; a fade or push where the shot asks for one), sound intent as real pack sounds (or the plan's cue sheet),
     the locked bed or a click track, mastered by music/mixer.py (-14 LUFS-I, <= -1.0 dBTP decoded from the MP4), burnt-in timecode and shot id
Exit: 0 drawn (warnings are in the report), 1 refused by the linter, 2 unreadable input."""
import argparse
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from storyboard import animatic, checks, core, draw, real, sheet  # noqa: E402


def rel(p):
    if not p:
        return None
    a = os.path.abspath(p)
    return os.path.relpath(a, core.PACK) if a.startswith(core.PACK + os.sep) else os.path.basename(a)


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def build(shotlist_path, design_path=None, plan_path=None, out='storyboard-out', safe=None, make_animatic=True, make_pdf=True, allow_lint=False, real_mode='auto',
          project=None, hero_frac=None, music=None, bpm=None, cut_ticks=False, log=print):
    """returns (exit code, report dict). The report is also written to <out>/report.json."""
    try:
        sl = core.load_json(shotlist_path)
        design = core.load_json(design_path) if design_path else None
        plan = core.load_json(plan_path) if plan_path else None
    except (OSError, ValueError) as e:
        log('cannot read an input: %s' % e)
        return 2, {}
    if not isinstance(sl, dict) or not sl.get('shots'):
        log('the shot list has no shots')
        return 2, {}
    lint = core.run_lint(shotlist_path)
    if lint['rc'] == 2:
        log('the linter cannot read the shot list: %s' % lint['summary'])
        return 2, {}
    if lint['rc'] != 0 and not allow_lint:
        for f in lint['findings']:
            log('%s  %s' % (f['level'], f['msg']))
        log('%s\nrefused: fix the shot list (or pass --allow-lint, which is recorded in report.json). Nothing was drawn.' % lint['summary'])
        return 1, {'lint': lint}
    fps = sl.get('fps') or 30
    shots = sl['shots']
    platform = core.pick_platform(design, sl.get('aspect'), safe)
    ctx = draw.Ctx(sl, design, os.path.dirname(os.path.abspath(design_path)) if design_path else None, platform)
    tl = core.timeline(shots, fps)
    L = core.lint_defaults(sl)
    spec = core.SPEC['board']
    frac = spec['hero_frac'] if hero_frac is None else hero_frac
    min_label = float(((design or {}).get('frames') or {}).get('labels', {}).get('min_on_screen_s', spec['label_min_on_screen_s']))
    runs, short_runs = checks.label_runs(shots, fps, min_label)
    short_ids = {i for r in short_runs for i in r['ids']}
    os.makedirs(os.path.join(out, 'panels'), exist_ok=True)
    notes = list(ctx.fonts.notes)

    # real key frames (optional)
    reals, real_from, real_times = [None] * len(shots), None, None
    if plan_path and real_mode != 'never':
        try:
            windows, real_from = real.shot_windows(shots, tl, plan)
            real_times = real.hero_times(windows, fps, frac)
            reals = real.snapshot(real.project_dir(plan_path, project), real_times, os.path.join(out, 'real'))
        except real.Unavailable as e:
            if real_mode == 'always':
                log('real key frames were required and are unavailable: %s' % e)
                return 2, {}
            notes.append('real key frames unavailable, the schematic is drawn: %s' % e)
            reals, real_from, real_times = [None] * len(shots), None, None
    elif real_mode == 'always':
        log('--real always needs --plan')
        return 2, {}

    panels, boards = [], []
    for i, (s, row) in enumerate(zip(shots, tl)):
        sub = draw.subject_rects(s, ctx)
        tlay = draw.layout_text(s, ctx, sub[-1] if sub else None)
        hlay = draw.layout_honesty(s, ctx)
        rd = checks.reading(s, L)
        sz = checks.safe_zone(tlay, hlay, ctx)
        warns = []
        if rd and not rd['ok']:
            warns += ['reading speed: ' + m for m in rd['issues']]
        for v in sz:
            warns.append('%s leaves the %s safe zone: %s by %s px (canvas %dx%d)' % (v['what'], platform, v['side'], v['px'], ctx.W, ctx.H))
        if s.get('id') in short_ids:
            warns.append('honesty label shown %.1f s in a row, under the %.1f s minimum' % (runs[s.get('id')], min_label))
        for f in lint['findings']:
            if f['level'] == 'WARN' and f['msg'].startswith(str(s.get('id')) + ':') and 'need at least' not in f['msg'] and 'words/s' not in f['msg']:
                warns.append('lint: ' + f['msg'].split(':', 1)[1].strip())
        img = draw.render_board(s, {'subject': sub, 'text': tlay, 'honesty': hlay}, ctx, reals[i],
                                'COMPOSITION %.2f s' % real_times[i] if reals[i] is not None else None)
        boards.append(img)
        img.save(os.path.join(out, 'panels', '%s.png' % s.get('id')), optimize=False)
        panels.append({'id': s.get('id'), 'beat': s.get('beat'), 'role': s.get('role'), 'scale': s.get('scale'), 'start_s': row['start_s'], 'dur_s': row['dur_s'],
                       'start_frame': row['start_frame'], 'frames': row['frames'], 'action': s.get('action') or '', 'sound': s.get('sound') or '', 'text': s.get('text') or '',
                       'text_kind': s.get('text_kind') or 'super', 'transition': s.get('transition') or {'kind': 'cut', 'reason': None}, 'camera': s.get('camera') or '',
                       'camera_parsed': draw.parse_camera(s.get('camera'))['kind'], 'honesty': s.get('honesty') or None,
                       'source': 'composition' if reals[i] is not None else 'schematic', 'hero_s': real_times[i] if real_times else None,
                       'text_layout': None if not tlay else {'size_px': tlay['size_px'], 'font': tlay['font'], 'role': tlay['role'], 'lines': tlay['lines'], 'rect': tlay['rect']},
                       'honesty_layout': None if not hlay else {'size_px': hlay['size_px'], 'rect': hlay['rect']},
                       'reading': rd, 'safe_violations': sz, 'warnings': warns, 'png': 'panels/%s.png' % s.get('id')})
    lint_txt = ('waived (%d FAIL)' % sum(1 for f in lint['findings'] if f['level'] == 'FAIL')) if lint['rc'] != 0 else \
        'pass, %d WARN' % sum(1 for f in lint['findings'] if f['level'] == 'WARN')
    total_warn = sum(len(p['warnings']) for p in panels)
    info = {'summary': {'title': sl.get('title', ''), 'format': sl.get('format', ''), 'aspect': sl.get('aspect', '16:9'), 'length_s': sum(r['dur_s'] for r in tl), 'fps': fps,
                        'shots': len(shots), 'platform': platform, 'platform_verify': ctx.safe['verify'], 'lint': lint_txt, 'warnings': total_warn},
            'panels': panels}
    W0 = core.aspect_key(sl.get('aspect'))
    card_w, cols = spec['sheet_card_px'].get(W0, [640, 3])
    sheet_img = sheet.render_sheet(info, boards, card_w, cols)
    sheet_png = os.path.join(out, 'storyboard.png')
    sheet_img.save(sheet_png)
    sheet.render_html(info, os.path.join(out, 'storyboard.html'))
    pdf_pages = sheet.render_pdf(info, boards, os.path.join(out, 'storyboard.pdf')) if make_pdf else 0
    report = {'module': 'storyboard', 'version': core.MANIFEST['version'], 'inputs': {'shotlist': rel(shotlist_path), 'design': rel(design_path), 'plan': rel(plan_path)},
              'lint': {'rc': lint['rc'], 'waived': bool(lint['rc'] != 0 and allow_lint), 'summary': lint['summary'], 'findings': lint['findings']},
              'safe': {'platform': platform, 'verify': ctx.safe['verify'], 'canvas': [ctx.W, ctx.H], 'rect': {k: round(ctx.safe[k], 1) for k in ('x0', 'y0', 'x1', 'y1')}},
              'fonts': {r: {k: v[k] for k in ('file', 'weight', 'family')} for r, v in ctx.fonts.roles.items()},
              'frame_source': 'composition' if real_from else 'schematic', 'real': {'timing': real_from, 'hero_frac': frac} if real_from else None,
              'summary': info['summary'], 'panels': panels, 'files': {'sheet_png': 'storyboard.png', 'sheet_html': 'storyboard.html', 'pdf': 'storyboard.pdf' if make_pdf else None,
                                                                    'pdf_pages': pdf_pages}, 'notes': notes}
    # the animatic
    ap = animatic.build_plan(sl, ctx, tl, report['frame_source'], plan, music, bpm, cut_ticks)
    bed = ap.pop('_bed')
    json.dump(ap, open(os.path.join(out, 'animatic.plan.json'), 'w'), indent=1)
    open(os.path.join(out, 'animatic.plan.json'), 'a').write('\n')
    report['animatic'] = {'plan': 'animatic.plan.json', 'frames': ap['frames'], 'bed': ap['bed'], 'measured': None}
    ap['_bed'] = bed
    if make_animatic:
        m = animatic.build(ap, boards, shots, tl, fps, ctx, out)
        report['animatic']['measured'] = m
        report['animatic']['file'] = m['file']
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), indent=1)
    open(os.path.join(out, 'report.json'), 'a').write('\n')
    log('%s: %d panels, %d warnings, lint %s, safe zone %s, frames %s' % (sl.get('title', ''), len(panels), total_warn, lint_txt, platform, report['frame_source']))
    for p in panels:
        for w in p['warnings']:
            log('  WARN  %s: %s' % (p['id'], w))
    for n in notes:
        log('  NOTE  ' + n)
    log('sheet: %s' % sheet_png)
    if make_animatic:
        m = report['animatic']['measured']
        log('animatic: %s  %d frames (expected %d), %.2f LUFS-I, %.2f dBTP decoded from the MP4' % (m['file'], m['frames'], m['expected_frames'], m['delivered_lufs_i'], m['delivered_true_peak_db']))
        for i in m['sound_lint']:
            log('  SOUND-LINT  ' + i)
    return 0, report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('shotlist')
    ap.add_argument('--design')
    ap.add_argument('--plan')
    ap.add_argument('--music', help='music/<bed id>: the locked bed (needs the library built: python3 music/build_music.py)')
    ap.add_argument('--bpm', type=float, help='click track tempo when there is no bed (default: plan.bpm, then 120)')
    ap.add_argument('--out', default='storyboard-out')
    ap.add_argument('--safe', help='a zone of type/safezones.js (default: the design, then conservative for tall frames and wideTitle otherwise)')
    ap.add_argument('--real', choices=['auto', 'always', 'never'], default='auto', help='real key frames from the composition (needs --plan)')
    ap.add_argument('--project', help='the composition folder (default: found next to the plan)')
    ap.add_argument('--hero-frac', type=float, help='how far into each shot the real key frame is taken (default 0.6)')
    ap.add_argument('--allow-lint', action='store_true', help='draw even when the shot list fails the linter (recorded as a waiver)')
    ap.add_argument('--no-animatic', action='store_true')
    ap.add_argument('--no-pdf', action='store_true')
    ap.add_argument('--cut-ticks', action='store_true', help='also give hard cuts the pack tick (sweeteners: hardCut)')
    a = ap.parse_args(argv)
    code, _ = build(a.shotlist, a.design, a.plan, a.out, a.safe, not a.no_animatic, not a.no_pdf, a.allow_lint, a.real, a.project, a.hero_frac, a.music, a.bpm, a.cut_ticks)
    return code


if __name__ == '__main__':
    sys.exit(main())
