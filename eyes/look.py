#!/usr/bin/env python3
"""motion-pack / eyes / look.py: look at a delivered video and critique its picture like a careful viewer with a ruler.

    python3 eyes/look.py <video.mp4> [--plan out/plan.json] [--platform <id>|auto] [--format hype_ad|beat_edit|talking_head|mime_spot|short_film]
                         [--draft] [--json out.json] [--md out.md] [--quiet] [--fps 30]

Every check prints a measured value, pass / warn / fail against the pack spec (SKILL.md hard rules and QA checklist, references/platforms.md, frame-design,
type/safezones.js) or a stated house default (eyes/manifest.json "spec"), and a concrete fix with timestamps:
  frame0       not black or flat; the first visible change by frame 6 (0.5 s at the latest); a readable subject (WCAG ratio at the most salient spot)
  frames       black, empty and frozen runs the plan does not call a hold or a dip; a black tail; playback stalls (a timestamp gap over 1.5 frames)
  flashes      WCAG 2.3.1 general and red flash: at most 3 per second (10% luminance swing over a quarter of the frame)
  banding      8-bit staircases in smooth gradients on native-resolution frames, the region and the fix (grain, dither, encode)
  safezones    plan.texts boxes against the platform safe rectangle; without boxes: persistent text-like edges inside the unsafe bands
  readability  text size at 1080 and on a 360 px phone against the frame-design floors, time on screen (0.35 s + 0.28 s per word), WCAG contrast from pixels
  pacing       hard cuts per minute, shot length, the longest static hold, against the plan's format or paceRule
  composition  one hero per key frame (saliency proxy), unplanned letterbox / pillarbox bars, aspect and resolution against the platform
  encode       codec, yuv420p, faststart, colour tags, keyframe interval, bits per pixel, blockiness
Then the top 3 things a viewer would notice and a 1-10 score per category and per critic row (references/critic.md: 8 or more passes).
Exit code: 0 (always, unless the input cannot be decoded); the verdicts are in the report."""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from eyes import core, checks_frames, checks_text, checks_edit, report  # noqa: E402


def analyze(path, plan=None, platform=None, fmt=None, draft=False, fps=None, name=None, only=None):
    """path: a video file. plan: a plan.json dict (texts, shots, holds, paceRule, platform); platform: a plan.mjs preset or type/safezones.js id ('auto' / None: the plan's, else by aspect);
    fmt: a cuts/patterns.json pace format; draft: an animatic (the resolution and bit-rate rules are waived); only: a list of check names to run (tests). -> report dict"""
    info = core.probe(path)
    clip = core.Clip(path, info)
    if fps:
        clip.fps = float(fps)
    pf = core.resolve_platform(platform, plan, clip.W, clip.H)
    ctx = {'clip': clip, 'info': info, 'plan': plan, 'platform': pf, 'draft': draft, 'format': checks_edit.plan_format(plan, fmt),
           'cuts': core.detect_cuts(clip), 'texts': core.plan_texts(plan, clip.W, clip.H)}
    run = [('frame0', checks_frames.frame0), ('frames', checks_frames.frames), ('flashes', checks_frames.flashes), ('banding', checks_frames.banding),
           ('safezones', checks_text.safezones), ('readability', checks_text.readability), ('pacing', checks_edit.pacing), ('composition', checks_edit.composition),
           ('encode', checks_edit.encode)]
    checks = [fn(ctx) for name_, fn in run if only is None or name_ in only]
    rep = {'input': name or os.path.basename(path), 'duration_s': round(clip.dur, 3), 'width': clip.W, 'height': clip.H, 'fps': round(clip.fps, 3), 'platform': pf,
           'plan': bool(plan), 'frames': clip.n, 'checks': checks}
    rep['scores'] = report.scores(checks)
    rep['top_issues'] = report.top_issues(checks)
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument('input')
    ap.add_argument('--plan', help='the composition plan.json: texts (plan.texts boxes), shots, holds, paceRule, platform')
    ap.add_argument('--platform', help='a templates/_shared/plan.mjs preset (tiktok.organic, yt.ad.15, ...) or a type/safezones.js id (conservative, reels, wideTitle, ...); default: the plan\'s, else by aspect')
    ap.add_argument('--format', dest='fmt', choices=['hype_ad', 'beat_edit', 'talking_head', 'mime_spot', 'short_film'], help='the cuts/patterns.json pace format for the shot-length range (default: the plan template\'s)')
    ap.add_argument('--draft', action='store_true', help='an animatic (production gate 4): waive the resolution and bit-rate rules')
    ap.add_argument('--fps', type=float, help='override the frame rate used for frame-based rules (default: the video\'s)')
    ap.add_argument('--json')
    ap.add_argument('--md')
    ap.add_argument('--quiet', action='store_true', help='print nothing (the reports still go to --json / --md)')
    a = ap.parse_args(argv)
    if not os.path.exists(a.input):
        raise SystemExit('eyes: no such file: %s' % a.input)
    rep = analyze(a.input, core.load_json(a.plan), a.platform, a.fmt, a.draft, a.fps)
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        json.dump(rep, open(a.json, 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    md = report.markdown(rep)
    if a.md:
        os.makedirs(os.path.dirname(os.path.abspath(a.md)), exist_ok=True)
        open(a.md, 'w').write(md)
    if not a.quiet:
        print('eyes: %s (%.1f s, %dx%d, platform %s)' % (rep['input'], rep['duration_s'], rep['width'], rep['height'], rep['platform']))
        for c in rep['checks']:
            print('  %-17s %-5s %s' % (c['id'], c['status'], report._measured(c)))
        print('what a viewer would notice:')
        for k, i in enumerate(rep['top_issues'], 1):
            print('  %d. [%s %s] %s  Fix: %s' % (k, i['severity'], report._ts(i['t']), i['viewer'], i['fix']))
        if not rep['top_issues']:
            print('  nothing measurable stands out; look once at a 360 px still and on a phone')
        print('scores: ' + ', '.join('%s %s' % (k, '-' if v is None else v) for k, v in rep['scores'].items()))
    return rep


if __name__ == '__main__':
    main()
