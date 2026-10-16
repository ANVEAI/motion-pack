"""motion-pack / tools / captions / validate.py: check a caption track against the broadcast / streaming rules and report every violation with
its timestamps.

    python3 tools/captions/validate.py out/captions/captions.en.vtt [--audience kids] [--fps 30] [--duration 30.2] [--frame 1080x1920 --platform reels] [--json]
    validate(events, opts, duration=None) -> [{severity, t: [a, b], rule, what, fix}]

Rules (numbers and sources in tools/a11y/standards.py): characters per line, lines per event, characters per second (warn over the limit,
fail over it by more than 15%), minimum and maximum duration, the 2-frame gap, overlaps and order, empty events, events past the end, lines
that end on a word that binds to the next, top-heavy two-line shapes (note), and, when events carry a box or VTT positions and a frame size,
the platform safe rectangle. Exit 1 when anything fails."""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from a11y import safezones                    # noqa: E402
from captions import core, formats            # noqa: E402

ORDER = {'note': 0, 'warn': 1, 'fail': 2}


def _issue(sev, e, rule, what, fix):
    return {'severity': sev, 't': [round(e['start'], 3), round(e['end'], 3)], 'rule': rule, 'what': what, 'fix': fix}


def validate(evs, o, duration=None, platform=None):
    out = []
    fps = o['fps']
    one = 1.0 / fps
    gap = o['gap_frames'] / fps
    safe = None
    for k, e in enumerate(evs):
        lines = [x for x in e.get('lines', [])]
        text = ''.join(lines).strip()
        d = e['end'] - e['start']
        if not text:
            out.append(_issue('fail', e, 'empty', 'event %d has no text' % (k + 1), 'remove the event'))
            continue
        if d <= 0:
            out.append(_issue('fail', e, 'order', 'event %d ends before it starts' % (k + 1), 'fix the times'))
            continue
        for ln in lines:
            if len(ln) > o['max_chars']:
                out.append(_issue('fail', e, 'chars_per_line', '%d characters on a line (max %d): "%s"' % (len(ln), o['max_chars'], ln),
                                  're-break the line at a phrase boundary or split the event'))
        if len(lines) > o['max_lines']:
            out.append(_issue('fail', e, 'lines', '%d lines (max %d)' % (len(lines), o['max_lines']), 'split the event in two'))
        chars = sum(len(x) for x in lines)
        cps = chars / d
        if cps > o['cps'] + 1e-6:
            sev = 'fail' if cps > o['cps'] * 1.15 else 'warn'
            out.append(_issue(sev, e, 'cps', '%.1f characters per second (max %.0f for %s)' % (cps, o['cps'], o.get('audience', 'adult')),
                              'hold the event longer into the gap after it, or condense the wording (a caption may paraphrase fast speech)'))
        if d < o['min_dur'] - 0.5 * one:
            out.append(_issue('fail', e, 'min_duration', 'on screen %.2f s (min %.2f s)' % (d, o['min_dur']), 'extend the end into the gap, or merge with a neighbour'))
        if d > o['max_dur'] + 0.5 * one:
            out.append(_issue('warn', e, 'max_duration', 'on screen %.2f s (max %.1f s)' % (d, o['max_dur']), 'split the event at a phrase boundary'))
        if len(lines) == 2:
            first = lines[0].split()
            if first and core.glue_end(first[-1]):
                out.append(_issue('warn', e, 'line_break', 'line 1 ends on "%s", which binds to the next word' % first[-1], 'move the break before "%s"' % first[-1]))
            if len(lines[0]) > 1.5 * len(lines[1]) and len(lines[0]) > 20:
                out.append(_issue('note', e, 'shape', 'top-heavy two-line shape (%d over %d characters)' % (len(lines[0]), len(lines[1])), 'prefer a bottom-heavy or even split'))
        if k + 1 < len(evs):
            n = evs[k + 1]
            g = n['start'] - e['end']
            if g < -1e-6:
                out.append(_issue('fail', e, 'overlap', 'overlaps the next event by %.3f s' % -g, 'end this event %d frames before the next starts' % o['gap_frames']))
            elif g < gap - 0.5 * one:
                out.append(_issue('fail', e, 'gap', 'gap to the next event %.3f s (min %d frames = %.3f s)' % (g, o['gap_frames'], gap),
                                  'end this event %d frames before the next starts' % o['gap_frames']))
            if n['start'] < e['start'] - 1e-6:
                out.append(_issue('fail', n, 'order', 'starts before the event before it', 'sort the events by start time'))
        if duration is not None and e['end'] > duration + 0.5 * one:
            out.append(_issue('fail', e, 'past_end', 'ends at %.2f s after the video ends (%.2f s)' % (e['end'], duration), 'trim the event'))
        frame = e.get('frame')
        if frame:
            W, H = frame
            safe = safe or safezones.rect(platform or e.get('platform') or safezones.default_platform(W, H), W, H)
            if e.get('box'):
                x0, y0, x1, y1 = e['box']
            elif 'box_edge' in e:
                x0, x1 = e['box_x']
                y0 = y1 = e['box_edge']
            else:
                continue
            bad = [s for s, v in (('left', safe['x0'] - x0), ('right', x1 - safe['x1']), ('top', safe['y0'] - y0), ('bottom', y1 - safe['y1'])) if v > 0.5]
            if bad:
                out.append(_issue('fail', e, 'safe_zone', 'caption box outside the %s safe area (%s)' % (safe['platform'], ', '.join(bad)), 'move it inside the safe rectangle'))
    for e in evs:
        for note in e.get('notes', []):
            out.append(_issue('note', e, 'build', note, 'see the note'))
    return out


def summary(issues):
    worst = max((ORDER[i['severity']] for i in issues), default=0)
    return {0: 'pass', 1: 'warn', 2: 'fail'}[worst]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('track', help='.srt, .vtt, .ttml/.xml, or an events .json from tools/captions/export.py')
    ap.add_argument('--audience', default='adult', choices=['adult', 'kids'])
    ap.add_argument('--fps', type=float, default=30.0)
    ap.add_argument('--duration', type=float)
    ap.add_argument('--frame', help='WxH, to check VTT positions against the safe area')
    ap.add_argument('--platform')
    ap.add_argument('--profile', default='sidecar', choices=['sidecar', 'burn'])
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args(argv)
    W, H = (int(x) for x in a.frame.split('x')) if a.frame else (1920, 1080)
    o = core.options(fps=a.fps, audience=a.audience, profile=a.profile, W=W, H=H, platform=a.platform)
    if a.track.endswith('.json'):
        evs = json.load(open(a.track, encoding='utf-8'))
        evs = evs.get('events', evs) if isinstance(evs, dict) else evs
    else:
        evs = formats.parse(a.track, frame=(W, H) if a.frame else None)
    issues = validate(evs, o, a.duration, a.platform)
    st = summary(issues)
    if a.json:
        print(json.dumps({'status': st, 'events': len(evs), 'issues': issues}, indent=1))
    else:
        print('captions: %s  (%d events, %d issues)' % (st, len(evs), len(issues)))
        for i in issues:
            print('  %-4s %7.2f-%-7.2f %-15s %s  -> %s' % (i['severity'], i['t'][0], i['t'][1], i['rule'], i['what'], i['fix']))
    return 1 if st == 'fail' else 0


if __name__ == '__main__':
    sys.exit(main())
