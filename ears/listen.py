#!/usr/bin/env python3
"""motion-pack / ears / listen.py: listen to a delivered video (or a WAV master) and critique its sound like a careful listener.

    python3 ears/listen.py <video.mp4 | master.wav> [--plan out/plan.json] [--cuts cuts.json] [--transcript study.json|whisper.json]
                           [--ref study.json ...] [--json out.json] [--md out.md] [--loop] [--target-lufs -14] [--fps 30] [--quiet]

Every check prints a measured value, pass / warn / fail against the pack spec (SKILL.md hard rules, music/mixer.py rules) or a stated house
default (ears/manifest.json "spec"), and a concrete fix with timestamps:
  loudness    integrated LUFS (BS.1770-4), short-term curve, LRA, sample + 4x true peak, platform offsets, last 0.15 s digital silence
  clipping    flat-topped runs, samples and true peaks over 0 dBFS, crest factor, PLR
  tone        sub / low / mud / mid / presence / sibilance / air per octave vs the mid band; mud, boomy, thin, harsh, sibilant, dull + where
  speech      speech regions (detector or transcript), speech-to-music ratio 300 Hz-3.4 kHz, ducking depth (>= 9 dB), masking, words per minute
  sync        tempo + confidence, beats, onsets, hits; an event on frames 0-3; cuts on onsets (>= 60 %); cue anchors on F + 1; risers end on F
  structure   energy + novelty sections, drop time as % of runtime (late drop), the breath before the final sting, loop seam (--loop)
  repetition  the same SFX-like onset repeated too often in 10 s; repeated plan cue ids
  stereo      L/R correlation, mono loss, width
  compare     with --ref refstudy study.json files: loudness-curve shape, band shares, tempo, brightness, cuts on onsets
  mood        optional: EARS_CLAP_MODEL=<local CLAP checkpoint> + transformers/torch, or --mood gemini (opt-in cloud, paid);
              otherwise "mood: not available (no local model)"
Then the top 3 issues a listener would notice and a 1-10 score per category (references/critic.md: 8 or more passes).
Exit code: 0 (always, unless the input cannot be decoded); the verdicts are in the report."""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from ears import core, checks_level, checks_time, checks_shape, report, mood  # noqa: E402
from ears.core import SR  # noqa: E402


def analyze(x, fps=30.0, is_master=False, channels=2, plan=None, cuts=None, transcript=None, refs=None, loop=False, target_lufs=None, name='input'):
    """x: (n, 2) float at 48 kHz. plan: a plan.json dict; cuts: [seconds]; transcript: [(s, e, words)]; refs: [(name, study dict)]. -> report dict"""
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
        channels = 1
    y = core.mono(x)
    ctx = {'x': x, 'y': y, 'fps': float(fps), 'is_master': is_master, 'channels': channels, 'loop': loop, 'refs': refs or [],
           'transcript': transcript, 'cues': core.plan_cues(plan, fps) if plan else [],
           'cuts': cuts if cuts is not None else (core.cuts_from(plan, fps) if plan else None)}
    if target_lufs is not None:
        ctx['target_lufs'] = float(target_lufs)
    ctx['S'] = core.stft_power(y, 2048, 480)
    ctx['S_tone'] = checks_level.tone_stft(y)
    on, st, _, _ = core.onsets(y)
    ctx['onsets'], ctx['strengths'] = on, st
    ctx['tempo'] = core.tempo(y)
    checks = [checks_level.loudness(ctx), checks_level.clipping(ctx), checks_level.tone(ctx), checks_time.speech(ctx), checks_time.sync(ctx),
              checks_shape.structure(ctx), checks_shape.repetition(ctx), checks_level.stereo(ctx)]
    ctx['lufs'] = checks[0]['measured'].get('integrated_lufs')
    ctx['cuts_on_onset'] = checks[4]['measured'].get('cuts_on_onset')
    checks.append(checks_shape.compare(ctx))
    secs = checks[5]['measured'].get('sections') or [{'t': [0.0, len(y) / SR]}]
    rep = {'input': name, 'duration_s': round(len(y) / SR, 3), 'channels': channels, 'fps': fps, 'is_master': is_master,
           'checks': checks, 'mood': mood.labels(y, SR, secs)}
    rep['scores'] = report.scores(checks)
    rep['top_issues'] = report.top_issues(checks)
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument('input')
    ap.add_argument('--plan')
    ap.add_argument('--cuts')
    ap.add_argument('--transcript')
    ap.add_argument('--ref', nargs='+', default=[])
    ap.add_argument('--json')
    ap.add_argument('--md')
    ap.add_argument('--loop', action='store_true', help='judge the loop seam (end vs start)')
    ap.add_argument('--target-lufs', type=float, help='integrated loudness target (default -14, the house master)')
    ap.add_argument('--fps', type=float, help='frame rate for frame-based checks (default: plan fps, then the video, then 30)')
    ap.add_argument('--mood', choices=['auto', 'gemini', 'off'], default='auto',
                    help='auto: local CLAP if EARS_CLAP_MODEL is set; gemini: cloud/gemini_mood.py (opt-in, paid, sends audio to Google); off')
    ap.add_argument('--brief', default='', help='with --mood gemini: the brief to judge fit against')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args(argv)
    info = core.probe(a.input)
    x = core.decode(a.input)
    if not len(x):
        raise SystemExit('ears: %s has no audio stream' % a.input)
    plan = core.load_json(a.plan)
    fps = a.fps or (plan or {}).get('fps') or info['fps'] or 30.0
    cuts = core.cuts_from(core.load_json(a.cuts), fps) if a.cuts else None
    tr = core.speech_from(core.load_json(a.transcript)) if a.transcript else None
    refs = [(os.path.basename(os.path.dirname(os.path.abspath(p))) or p, core.load_json(p)) for p in a.ref]
    rep = analyze(x, fps, a.input.lower().endswith(('.wav', '.flac', '.aif', '.aiff')), info['channels'] or 2, plan, cuts, tr, refs, a.loop, a.target_lufs,
                  os.path.basename(a.input))
    if a.mood == 'gemini':
        rep['mood'] = mood.gemini(a.input, a.brief)
    elif a.mood == 'off':
        rep['mood'] = {'available': False, 'reason': 'off', 'text': 'mood: off'}
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        json.dump(rep, open(a.json, 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    md = report.markdown(rep)
    if a.md:
        os.makedirs(os.path.dirname(os.path.abspath(a.md)), exist_ok=True)
        open(a.md, 'w').write(md)
    if not a.quiet:
        print('ears: %s (%.1f s)' % (rep['input'], rep['duration_s']))
        for c in rep['checks']:
            print('  %-16s %-5s %s' % (c['id'], c['status'], report._measured(c)))
        print('  ' + rep['mood']['text'])
        print('what a listener would notice:')
        for k, i in enumerate(rep['top_issues'], 1):
            print('  %d. [%s %s] %s  Fix: %s' % (k, i['severity'], report._ts(i['t']), i['listener'], i['fix']))
        if not rep['top_issues']:
            print('  nothing measurable stands out; listen once on a phone and on headphones')
        print('scores: ' + ', '.join('%s %s' % (k, '-' if v is None else v) for k, v in rep['scores'].items()))
    return rep


if __name__ == '__main__':
    main()
