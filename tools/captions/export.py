#!/usr/bin/env python3
"""motion-pack / tools / captions / export.py: export any template's caption track to SRT, WebVTT (positioned), TTML/IMSC1.1 and a burned-in MP4.

    python3 tools/captions/export.py --plan templates/tutorial/out/plan.json --out out/captions
    python3 tools/captions/export.py --words words.json --frame 1080x1920 --platform reels --sdh --audience kids
    python3 tools/captions/export.py --plan out/plan.json --burn out/film.mp4 --burn-out out/film-captioned.mp4

Writes <out>/captions.<lang>.srt / .vtt / .ttml, captions.<lang>.events.json (the events with their boxes and notes) and a validator report
(<out>/captions.<lang>.report.json). With --sdh the files are named sdh.<lang>.* and carry speaker IDs and [sound] tags from the plan.
The sidecar files use the 42-character line; the burned-in pass re-segments with the line length that fits the platform safe width at the
burn-in size (64 px at 1080 wide on 9:16, 48 px at 1080 high on 16:9). Exit 1 when the validator reports a fail."""
import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from a11y import safezones                    # noqa: E402
from captions import burn, core, formats, validate  # noqa: E402


def make_track(plan, words, W, H, fps, audience='adult', profile='sidecar', sdh=False, platform=None, sdh_level='key'):
    o = core.options(fps=fps, audience=audience, profile=profile, W=W, H=H, platform=platform, sdh=sdh, sdh_level=sdh_level)
    evs = core.build(words, o, plan)
    evs = core.place(evs, plan, W, H, o)
    return evs, o


def write_all(evs, o, out, stem, duration=None):
    os.makedirs(out, exist_ok=True)
    paths = {}
    for ext, text in (('srt', formats.srt(evs)), ('vtt', formats.vtt(evs, kind='captions', voices=o.get('sdh'))), ('ttml', formats.ttml(evs))):
        p = os.path.join(out, '%s.%s' % (stem, ext))
        open(p, 'w', encoding='utf-8').write(text)
        paths[ext] = p
    issues = validate.validate(evs, o, duration)
    rep = {'status': validate.summary(issues), 'events': len(evs), 'limits': {k: o[k] for k in ('max_chars', 'max_lines', 'cps', 'min_dur', 'max_dur', 'gap_frames', 'fps')},
           'issues': issues}
    p = os.path.join(out, '%s.events.json' % stem)
    json.dump({'events': evs, 'options': {k: v for k, v in o.items()}}, open(p, 'w', encoding='utf-8'), indent=1)
    paths['events'] = p
    p = os.path.join(out, '%s.report.json' % stem)
    json.dump(rep, open(p, 'w', encoding='utf-8'), indent=1)
    paths['report'] = p
    return paths, rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--plan', help='a template plan.json (transcript, cues, music, texts, size)')
    ap.add_argument('--words', help='words.json ([{w, s, e, speaker?}] or {words: [...]}) instead of the plan transcript')
    ap.add_argument('--out', default='out/captions')
    ap.add_argument('--lang', default='en')
    ap.add_argument('--fps', type=float)
    ap.add_argument('--frame', help='WxH (default: from the plan, else 1920x1080)')
    ap.add_argument('--platform', help='a row of type/safezones.js or a plan.mjs preset (default: the plan, else the aspect default)')
    ap.add_argument('--audience', default='adult', choices=['adult', 'kids'])
    ap.add_argument('--sdh', action='store_true', help='speaker IDs and [sound] tags (from plan cues and music)')
    ap.add_argument('--sdh-level', default='key', choices=['key', 'all'])
    ap.add_argument('--speaker', action='append', default=[], help='ID=Name (repeatable)')
    ap.add_argument('--burn', help='an MP4 to burn the captions into')
    ap.add_argument('--burn-out', help='output MP4 for --burn (default <out>/<name>-captioned.mp4)')
    ap.add_argument('--dry-run', action='store_true', help='print the burn command instead of running it')
    a = ap.parse_args(argv)
    plan = json.load(open(a.plan, encoding='utf-8')) if a.plan else {}
    spk = dict(x.split('=', 1) for x in a.speaker)
    words = core.load_words(a.words, plan=plan, speakers=spk)
    if not words:
        print('captions: no words (the plan has no transcript and no --words file)', file=sys.stderr)
        return 2
    W, H = (int(x) for x in a.frame.split('x')) if a.frame else safezones.frame_size(plan)
    fps = a.fps or float(plan.get('fps') or 30)
    dur = float(plan.get('seconds') or 0) or None
    stem = ('sdh.%s' if a.sdh else 'captions.%s') % a.lang
    evs, o = make_track(plan, words, W, H, fps, a.audience, 'sidecar', a.sdh, a.platform, a.sdh_level)
    paths, rep = write_all(evs, o, a.out, stem, dur)
    print('captions: %s  %d events -> %s' % (rep['status'], rep['events'], ', '.join(sorted(paths.values()))))
    for i in rep['issues']:
        if i['severity'] != 'note':
            print('  %-4s %7.2f-%-7.2f %-15s %s' % (i['severity'], i['t'][0], i['t'][1], i['rule'], i['what']))
    status = rep['status']
    if a.burn:
        bev, bo = make_track(plan, words, W, H, fps, a.audience, 'burn', a.sdh, a.platform, a.sdh_level)
        bpaths, brep = write_all(bev, bo, a.out, stem + '.burn', dur)
        items = burn.render_pngs(bev, os.path.join(a.out, 'burn-png'), bo)
        dst = a.burn_out or os.path.join(a.out, os.path.splitext(os.path.basename(a.burn))[0] + '-captioned.mp4')
        args = burn.burn_args(a.burn, items, dst)
        print('burn: %s  %d events (line max %d chars)' % (brep['status'], brep['events'], bo['max_chars']))
        if a.dry_run:
            print('ffmpeg ' + ' '.join(args))
        else:
            r = subprocess.run(['ffmpeg'] + args)
            if r.returncode:
                return r.returncode
            print('burned -> %s' % dst)
        status = 'fail' if 'fail' in (status, brep['status']) else status
    return 1 if status == 'fail' else 0


if __name__ == '__main__':
    sys.exit(main())
