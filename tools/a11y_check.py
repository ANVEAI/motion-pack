#!/usr/bin/env python3
"""motion-pack / tools / a11y_check.py: accessibility lint for a plan, a design.json, a caption track and (optionally) the delivered MP4.

    python3 tools/a11y_check.py --plan out/plan.json [--design design.json] [--captions out/captions/captions.en.events.json]
                                [--mp4 out/film.mp4] [--caption-style burn|plain] [--json report.json] [--md report.md]

Checks (numbers and sources in tools/a11y/standards.py and eyes/manifest.json; nothing is duplicated from eyes, it is called):
  a11y/flash-plan     flash-like events the plan schedules (flash transitions, impact / invert frames, shots marked flash) counted in any 1 s
                      window, BEFORE a render: more than 3 fails (WCAG 2.3.1). With --mp4 the measured eyes/flashes result is added (general + red).
  a11y/caption-contrast  each caption box against the real frames behind it (--mp4): the caption colour over the scrim blended onto the
                      picture, worst of the lightest and darkest background pixels (4.5:1 passes, under 3:1 fails, the eyes thresholds).
  a11y/text-size      plan.texts fontPx per role against the frame-design floors for the aspect (eyes/manifest.json readability.floors_px_1080).
  a11y/reading-time   plan.texts time on screen against max(0.5, 0.35 + 0.28 s per word) and 3.5 words/s; caption events against the caption validator.
  a11y/colour-blind   design.json palette under protan / deutan / tritan simulation: role pairs that are distinct for typical vision but collapse
                      (CIEDE2000 under 10), and text pairs whose WCAG ratio falls under 4.5 when simulated.
  a11y/colour-only    meaning carried only by colour: state colours (success, warning, error...) with no declared non-colour cue in
                      design.json a11y.cues, and plan parts that colour-code several items (`colors` lists) without `labels` of the same length.
Exit 1 when any check fails."""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, PACK)
from a11y import cvd, safezones              # noqa: E402
from a11y.standards import CVD, FLASH        # noqa: E402

EYES = json.load(open(os.path.join(PACK, 'eyes', 'manifest.json'), encoding='utf-8'))['spec']
ORDER = {'n/a': -1, 'pass': 0, 'note': 0, 'warn': 1, 'fail': 2}
STATE_ROLES = ('success', 'warning', 'warn', 'error', 'danger', 'alert', 'ok', 'fail', 'positive', 'negative', 'info')
FLASH_TX = ('transitions/flash', 'transitions/strobe', 'transitions/invertFlash', 'transitions/impactFrame', 'transitions/flashCut', 'transitions/whiteFlash')
FLASH_KEYS = ('impactFrame', 'invertFlash', 'strobe')


def issue(sev, t, what, fix):
    return {'severity': sev, 't': t, 'what': what, 'fix': fix}


def result(cid, measured, issues, target, status=None):
    st = status or max((i['severity'] for i in issues), key=ORDER.get, default='pass')
    return {'id': cid, 'status': st if st != 'note' else 'pass', 'measured': measured, 'target': target, 'issues': issues}


# ------------------------------------------------------------------------------------------------ flashes
def flash_events(plan):
    """times of the flash-like events a plan schedules: flash transitions (at the shot start), shots with flash: true, and any item whose id or
    kind names an impact / invert / strobe frame, with `at` or `t`"""
    out = []
    for s in plan.get('shots') or []:
        if not isinstance(s, dict):
            continue
        t = float(s.get('start', 0))
        if s.get('tx') in FLASH_TX or s.get('flash') is True:
            out.append(round(t, 4))

    def walk(o):
        if isinstance(o, dict):
            name = ' '.join(str(o.get(k, '')) for k in ('id', 'kind', 'type'))
            at = o.get('at', o.get('t'))
            if any(k in name for k in FLASH_KEYS) and isinstance(at, (int, float)):
                out.append(round(float(at), 4))
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk({k: v for k, v in plan.items() if k not in ('shots', 'cues')})
    return sorted(set(out))


def check_flash_plan(plan, mp4=None):
    lim = FLASH['max_per_s']['v']
    ev = flash_events(plan)
    worst, at = 0, None
    for a in ev:
        n = sum(1 for x in ev if a <= x < a + 1.0 - 1e-9)
        if n > worst:
            worst, at = n, a
    iss = []
    if worst > lim:
        iss.append(issue('fail', [at, round(at + 1, 3)], '%d planned flashes in one second (WCAG 2.3.1 allows %d)' % (worst, lim),
                         'space flash transitions at least %.2f s apart, or swap some for a hard cut' % (1.0 / lim)))
    elif worst == lim:
        iss.append(issue('warn', [at, round(at + 1, 3)], '%d planned flashes in one second: at the limit' % worst, 'leave margin: drop one'))
    measured = {'planned_flashes': len(ev), 'max_per_s': worst}
    if mp4:
        from eyes import look
        rep = look.analyze(mp4, plan=plan, only=['flashes'])
        fl = rep['checks'][0]
        measured['eyes'] = fl['measured']
        for i in fl['issues']:
            iss.append(issue(i['severity'], i['t'], 'measured: ' + i['what'], i['fix']))
    return result('a11y/flash-plan', measured, iss, 'at most %d flashes in any 1 s (WCAG 2.3.1): planned events, and measured with --mp4 (eyes/flashes)' % lim)


# ------------------------------------------------------------------------------------------------ caption contrast
def blend(bg, scrim_rgb, alpha):
    """scrim over the picture, in sRGB values (how a browser or ffmpeg overlay composites)"""
    import numpy as np
    return bg.astype(np.float32) * (1 - alpha) + np.array(scrim_rgb, np.float32) * alpha


def caption_contrast(crop, fg='#FFFFFF', scrim=None):
    """worst WCAG ratio between the caption colour and the background behind the caption box: P5 and P95 of the background luminance after the
    scrim (rgb, alpha) is composited. crop: (h, w, 3) uint8 of the frame under the box."""
    import numpy as np
    from eyes import core as ecore
    bg = crop if scrim is None else np.clip(np.rint(blend(crop, scrim[0], scrim[1])), 0, 255).astype(np.uint8)
    lum = ecore.rel_lum(bg).ravel()
    p5, p95 = np.percentile(lum, [5, 95])
    fl = cvd.rel_lum(fg)
    r = min((max(fl, x) + 0.05) / (min(fl, x) + 0.05) for x in (p5, p95))
    return float(r), float(p5), float(p95)


STYLES = {'burn': {'fg': '#FFFFFF', 'scrim': ((0, 0, 0), 194 / 255.0), 'note': 'tools/captions/burn.py default: white on a 76% black box'},
          'plain': {'fg': '#FFFFFF', 'scrim': None, 'note': 'white text with no box (type/captions.js styles draw a thin stroke and shadow, which WCAG does not count)'}}


def check_caption_contrast(events, mp4, style='burn'):
    if not events or not mp4:
        return result('a11y/caption-contrast', {}, [], 'caption colour vs the frame behind it, 4.5:1', status='n/a')
    from eyes import core as ecore
    st = STYLES.get(style, STYLES['burn'])
    info = ecore.probe(mp4)
    W, H, fps = info['width'], info['height'], info['fps'] or 30.0
    idx = {}
    for k, e in enumerate(events):
        if e.get('box'):
            idx.setdefault(int(round((e['start'] + e['end']) / 2 * fps)), []).append(k)
    worst, iss = None, []
    for i, fr in ecore.iter_select(mp4, list(idx), W, H):
        for k in idx[i]:
            e = events[k]
            fw, fh = e.get('frame') or (W, H)
            x0, y0, x1, y1 = [int(round(v * (W / fw if j % 2 == 0 else H / fh))) for j, v in enumerate(e['box'])]
            crop = fr[max(0, y0):max(y0 + 1, y1), max(0, x0):max(x0 + 1, x1)]
            if crop.size == 0:
                continue
            r, p5, p95 = caption_contrast(crop, st['fg'], st['scrim'])
            worst = r if worst is None else min(worst, r)
            sp = EYES['readability']
            if r < sp['contrast_pass']:
                sev = 'fail' if r < sp['contrast_fail'] else 'warn'
                iss.append(issue(sev, [round(e['start'], 3), round(e['end'], 3)], 'caption "%s" at %.1f:1 over the frame behind it' % (' / '.join(e['lines'])[:60], r),
                                 'add or darken the scrim box (burn style), or move the caption off the bright area'))
    return result('a11y/caption-contrast', {'worst_ratio': None if worst is None else round(worst, 2), 'style': style, 'style_note': st['note'], 'events': len(events)}, iss,
                  'caption colour vs the pixels behind it, %.1f:1 (warn under, fail under %.1f:1)' % (EYES['readability']['contrast_pass'], EYES['readability']['contrast_fail']))


# ------------------------------------------------------------------------------------------------ text size + reading time
def check_text_size(plan):
    W, H = safezones.frame_size(plan)
    tall = H > W
    k = 1080.0 / min(W, H)
    floors = EYES['readability']['floors_px_1080']
    iss, n = [], 0
    for x in plan.get('texts') or []:
        if not isinstance(x, dict) or not x.get('fontPx'):
            continue
        n += 1
        role = x.get('role', 'read')
        floor = floors.get(role, floors['read'])['tall' if tall else 'wide']
        px = float(x['fontPx']) * k
        if px < floor - 0.5:
            iss.append(issue('fail', x.get('t'), '"%s" is %.0f px at 1080 (%s floor %d px on %s)' % (str(x.get('text'))[:50], px, role, floor, '9:16' if tall else '16:9'),
                             'set fontPx to at least %d' % int(round(floor / k + 0.49))))
    return result('a11y/text-size', {'texts': n, 'aspect': '%dx%d' % (W, H)}, iss, 'frame-design size floors per role and aspect (eyes/manifest.json)',
                  status=None if n else 'n/a')


def hold_need(words):
    sp = EYES['readability']
    return max(sp['hold_min_s'], sp['hold_base_s'] + sp['hold_per_word_s'] * words)


def check_reading_time(plan, events=None, cap_opts=None):
    sp = EYES['readability']
    iss, n = [], 0
    for x in plan.get('texts') or []:
        if not isinstance(x, dict) or not x.get('t') or not x.get('text'):
            continue
        n += 1
        words = len(str(x['text']).split())
        d = float(x['t'][1]) - float(x['t'][0])
        need = hold_need(words)
        if d + 1e-6 < need:
            iss.append(issue('fail', x['t'], '"%s" is on screen %.2f s; %d words need %.2f s' % (str(x['text'])[:50], d, words, need), 'hold it longer or cut words'))
        elif words / max(d, 1e-3) > sp['words_per_s_max']:
            iss.append(issue('warn', x['t'], '"%s" asks for %.1f words/s (max %.1f)' % (str(x['text'])[:50], words / d, sp['words_per_s_max']), 'hold it longer'))
    measured = {'texts': n}
    if events:
        from captions import core as ccore, validate as cval
        o = cap_opts or ccore.options()
        ci = [i for i in cval.validate(events, o) if i['rule'] in ('cps', 'min_duration', 'max_duration')]
        measured['caption_events'] = len(events)
        iss += [issue(i['severity'], i['t'], 'caption: ' + i['what'], i['fix']) for i in ci]
    return result('a11y/reading-time', measured, iss, 'on-screen text: max(%.2f, %.2f + %.2f s/word), <= %.1f words/s; captions: cps and duration rules' %
                  (sp['hold_min_s'], sp['hold_base_s'], sp['hold_per_word_s'], sp['words_per_s_max']), status=None if (n or events) else 'n/a')


# ------------------------------------------------------------------------------------------------ colour
def palette_of(design):
    pal = {}
    for k, v in (design.get('palette') or {}).items():
        try:
            cvd.parse(v)
            pal[k] = v
        except (ValueError, TypeError):
            continue
    return pal


def check_colour_blind(design):
    pal = palette_of(design)
    if len(pal) < 2:
        return result('a11y/colour-blind', {}, [], 'palette pairs stay apart under protan / deutan / tritan simulation', status='n/a')
    collapse, distinct = CVD['collapse_de']['v'], CVD['distinct_de']['v']
    iss, rows = [], []
    text_pairs = [(p['fg'], p['bg']) for p in (design.get('contrast') or {}).get('pairs') or [] if p.get('use') == 'text' and p.get('fg') in pal and p.get('bg') in pal]
    neutral = {'paper', 'ink', 'muted', 'accent_ink', 'scrim', 'caption', 'background', 'text'}
    extra = [tuple(x) for x in ((design.get('a11y') or {}).get('distinguish') or []) if len(x) == 2 and x[0] in pal and x[1] in pal]
    roles = [r for r in pal if r not in neutral]
    pairs = sorted({tuple(sorted((a, b))) for i, a in enumerate(roles) for b in roles[i + 1:]} | {tuple(sorted(x)) for x in extra})
    for a, b in pairs:
        d0 = cvd.de2000(pal[a], pal[b])
        if d0 < distinct:
            continue
        sims = {k: round(cvd.de2000(cvd.simulate(pal[a], k), cvd.simulate(pal[b], k)), 1) for k in cvd.KINDS}
        rows.append({'pair': [a, b], 'de': round(d0, 1), 'sim_de': sims})
        bad = [k for k, v in sims.items() if v < collapse]
        if bad:
            iss.append(issue('warn', None, '%s %s and %s %s are %.0f apart, but %s under %s' % (a, pal[a], b, pal[b], d0, ' / '.join('%.1f' % sims[k] for k in bad), ' / '.join(bad)),
                             'separate them in lightness (not only hue), or pair each with a label, icon or pattern'))
    for fg, bg in text_pairs:
        for k in cvd.KINDS:
            r = cvd.wcag(cvd.simulate(pal[fg], k), cvd.simulate(pal[bg], k))
            if r < 4.5 <= cvd.wcag(pal[fg], pal[bg]):
                iss.append(issue('warn', None, 'text %s on %s drops to %.2f:1 under %s simulation' % (fg, bg, r, k), 'raise the lightness difference'))
    return result('a11y/colour-blind', {'pairs_tested': len(rows), 'pairs': rows, 'model': CVD['model']['v']}, iss,
                  'role pairs distinct for typical vision (CIEDE2000 >= %.0f) stay >= %.0f under each simulation' % (distinct, collapse))


def check_colour_only(design=None, plan=None):
    iss = []
    pal = palette_of(design or {})
    cues = ((design or {}).get('a11y') or {}).get('cues') or {}
    states = [r for r in pal if r.lower() in STATE_ROLES]
    for r in states:
        if not cues.get(r):
            iss.append(issue('warn', None, 'state colour "%s" (%s) has no declared non-colour cue' % (r, pal[r]),
                             'add design.json a11y.cues.%s (an icon, word or shape that carries the same meaning), and use it wherever the colour signals state' % r))
    found = []

    def walk(o, path):
        if isinstance(o, dict):
            p = o.get('params') if isinstance(o.get('params'), dict) else o
            cols = p.get('colors') if isinstance(p, dict) else None
            if isinstance(cols, list) and len(cols) > 1:
                labels = p.get('labels')
                if not (isinstance(labels, list) and len(labels) >= len(cols)):
                    found.append(path)
                    iss.append(issue('warn', o.get('at'), '%s colour-codes %d items with no labels' % (o.get('id', path), len(cols)),
                                     'pass labels (one per colour) so the meaning does not rest on hue'))
            for k, v in o.items():
                if k != 'params':
                    walk(v, path + '.' + k)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, '%s[%d]' % (path, i))
    walk(plan or {}, 'plan')
    return result('a11y/colour-only', {'state_roles': states, 'declared_cues': sorted(cues), 'colour_coded_parts': len(found)}, iss,
                  'meaning is never carried by colour alone (WCAG 1.4.1): state colours declare a cue; colour-coded parts carry labels',
                  status=None if (states or plan or design) else 'n/a')


# ------------------------------------------------------------------------------------------------ CLI
def run(plan=None, design=None, events=None, mp4=None, caption_style='burn', cap_opts=None):
    plan, design = plan or {}, design or {}
    out = [check_flash_plan(plan, mp4), check_caption_contrast(events, mp4, caption_style), check_text_size(plan), check_reading_time(plan, events, cap_opts),
           check_colour_blind(design), check_colour_only(design, plan)]
    worst = max((ORDER[c['status']] for c in out), default=0)
    return {'status': {-1: 'n/a', 0: 'pass', 1: 'warn', 2: 'fail'}[worst], 'checks': out}


def to_md(rep):
    lines = ['# Accessibility check: %s' % rep['status'], '']
    for c in rep['checks']:
        lines.append('## %s: %s' % (c['id'], c['status']))
        lines.append('target: %s' % c['target'])
        for i in c['issues']:
            t = '' if i['t'] is None else (' @ %s' % (i['t'] if not isinstance(i['t'], list) else '%.2f-%.2f s' % tuple(i['t'])))
            lines.append('- **%s**%s %s. Fix: %s' % (i['severity'], t, i['what'], i['fix']))
        lines.append('')
    return '\n'.join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--plan')
    ap.add_argument('--design')
    ap.add_argument('--captions', help='events .json from tools/captions/export.py (boxes kept), or .srt / .vtt / .ttml')
    ap.add_argument('--mp4')
    ap.add_argument('--caption-style', default='burn', choices=sorted(STYLES))
    ap.add_argument('--audience', default='adult', choices=['adult', 'kids'])
    ap.add_argument('--json')
    ap.add_argument('--md')
    a = ap.parse_args(argv)
    plan = json.load(open(a.plan, encoding='utf-8')) if a.plan else {}
    design = json.load(open(a.design, encoding='utf-8')) if a.design else {}
    events, cap_opts = None, None
    if a.captions:
        from captions import core as ccore, formats
        W, H = safezones.frame_size(plan)
        cap_opts = ccore.options(fps=float(plan.get('fps') or 30), audience=a.audience, W=W, H=H)
        if a.captions.endswith('.json'):
            d = json.load(open(a.captions, encoding='utf-8'))
            events = d.get('events', d) if isinstance(d, dict) else d
        else:
            events = formats.parse(a.captions)
    rep = run(plan, design, events, a.mp4, a.caption_style, cap_opts)
    if a.json:
        json.dump(rep, open(a.json, 'w', encoding='utf-8'), indent=1)
    if a.md:
        open(a.md, 'w', encoding='utf-8').write(to_md(rep))
    print('a11y: %s' % rep['status'])
    for c in rep['checks']:
        print('  %-24s %-5s %s' % (c['id'], c['status'], '; '.join(i['what'] for i in c['issues'][:2])[:150]))
    return 1 if rep['status'] == 'fail' else 0


if __name__ == '__main__':
    sys.exit(main())
