#!/usr/bin/env python3
"""motion-pack / tools / describe / export.py: write the audio-description script of a plan as text and a WebVTT descriptions track.

    python3 tools/describe/export.py --plan templates/tutorial/out/plan.json --out out/ad
    python3 tools/describe/export.py --plan out/plan.json --shotlist shotlist.json --words words.json --out out/ad
    python3 tools/describe/export.py --plan out/plan.json --out out/ad --extend-video out/film.mp4     # also renders the extended-AD picture

Writes ad.<lang>.txt (the script with timecodes, DRAFT marks on auto lines), ad.<lang>.vtt (standard AD), ad-extended.<lang>.vtt (the
extended timeline), ad.<lang>.json (placed and unplaced lines, gaps, pauses, ffmpeg arguments for the extended picture).
Load the VTT with <track kind="descriptions" srclang="en" src="ad.en.vtt">. NO VOICE IS SYNTHESISED: a describer records the script, or
the player / a screen reader reads the track."""
import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from captions import core as capcore          # noqa: E402
from captions.formats import ts               # noqa: E402
from describe import core                     # noqa: E402


def vtt(cues, note):
    out = ['WEBVTT', '', 'NOTE kind=descriptions. %s' % note, '']
    for i, c in enumerate(cues, 1):
        txt = c.get('say', c.get('text', '')).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out += ['d%d' % i, '%s --> %s' % (ts(c['start']), ts(c['end'])), txt, '']
    return '\n'.join(out)


def script(rep, ext, title):
    out = ['AUDIO DESCRIPTION SCRIPT: %s' % title, 'No voice is synthesised by the pack. Lines marked DRAFT were built from the plan: check each against the picture.', '',
           'STANDARD (in the gaps between speech)']
    for p in rep['placed']:
        out.append('%s-%s  [%s]%s  %s' % (ts(p['start']), ts(p['end']), p['id'], ' DRAFT' if p['draft'] else '', p['say']))
    if rep['unplaced']:
        out += ['', 'DID NOT FIT A GAP (extended AD pauses the picture for these)']
        for p in ext['pauses']:
            out.append('pause at %s for %.2f s  [%s]%s  %s' % (ts(p['at']), p['dur'], p['id'], ' DRAFT' if p['draft'] else '', p['say']))
    return '\n'.join(out) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--plan', required=True)
    ap.add_argument('--shotlist', help='story-script shotlist.json: its `action` lines are the author descriptions')
    ap.add_argument('--words', help='words.json (else the plan transcript); no words = no speech, every gap is free')
    ap.add_argument('--out', default='out/ad')
    ap.add_argument('--lang', default='en')
    ap.add_argument('--wps', type=float, help='describer pace, words per second (default %.1f)' % core.OPTS['wps'])
    ap.add_argument('--extend-video', help='render the extended-AD picture from this MP4 (freeze frames + silence at each pause)')
    a = ap.parse_args(argv)
    plan = json.load(open(a.plan, encoding='utf-8'))
    sl = json.load(open(a.shotlist, encoding='utf-8')) if a.shotlist else None
    words = capcore.load_words(a.words, plan=plan)
    dur = float(plan.get('seconds') or 0) or (sl or {}).get('length_s')
    o = {'wps': a.wps} if a.wps else {}
    items = core.describe_items(plan, sl)
    rep = core.place(items, words, dur, o)
    ext = core.extend(rep, words, o)
    os.makedirs(a.out, exist_ok=True)
    stem = os.path.join(a.out, 'ad.%s' % a.lang)
    open(stem + '.txt', 'w', encoding='utf-8').write(script(rep, ext, plan.get('template', os.path.basename(os.path.dirname(os.path.abspath(a.plan))))))
    open(stem + '.vtt', 'w', encoding='utf-8').write(vtt(rep['placed'], 'Standard audio description: lines sit in speech gaps. No synthesised voice.'))
    open(os.path.join(a.out, 'ad-extended.%s.vtt' % a.lang), 'w', encoding='utf-8').write(
        vtt(ext['cues'], 'Extended audio description: times are on the EXTENDED timeline (the picture pauses %.2f s in total).' % ext['added_s']))
    ff = core.ffmpeg_extended(a.extend_video or 'IN.mp4', ext['pauses'], os.path.join(a.out, 'extended.mp4'), dur or 0) if ext['pauses'] else None
    json.dump({'items': items, 'standard': rep, 'extended': ext, 'ffmpeg_extended': ff}, open(stem + '.json', 'w', encoding='utf-8'), indent=1)
    drafts = sum(1 for p in rep['placed'] if p['draft'])
    print('describe: %d lines placed (%d draft), %d need a pause (extended AD adds %.2f s) -> %s.{txt,vtt,json}' % (len(rep['placed']), drafts, len(rep['unplaced']), ext['added_s'], stem))
    if a.extend_video and ff:
        r = subprocess.run(['ffmpeg'] + ff)
        if r.returncode:
            return r.returncode
        print('extended picture -> %s' % ff[-1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
