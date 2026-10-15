"""storyboard/checks.py: the per-panel checks. Every threshold comes from the story-script linter's own DEFAULTS (plus shotlist.json lint{}) or storyboard/manifest.json.
  reading speed   words per second of the shot's on-screen line against the shot's duration, and the hold it needs (the linter's rule, here per panel with the numbers)
  safe zone       the text block laid out at its real size, and the honesty label, against the platform safe rect (type/safezones.js)
  label hold      an honesty label shown for at least frames.labels.min_on_screen_s across consecutive shots"""
from storyboard import core


def reading(shot, L):
    """{words, dur_s, wps, hold_needed_s, ok, issues} for the shot's text; None when it has none"""
    n = core.words(core.plain(shot.get('text')))
    if not n:
        return None
    dur = float(shot.get('dur_s') or 0)
    need = max(L['min_hold_s'], L['hold_base_s'] + L['hold_per_word_s'] * n)
    wps = n / dur if dur > 0 else float('inf')
    issues = []
    if dur + 1e-9 < need:
        issues.append('%d words need at least %.2f s on screen, the shot is %.2f s' % (n, need, dur))
    if wps > L['words_per_sec'] + 1e-9:
        issues.append('%.1f words/s exceeds %s' % (wps, L['words_per_sec']))
    return {'words': n, 'dur_s': dur, 'wps': round(wps, 2) if dur > 0 else None, 'wps_max': L['words_per_sec'], 'hold_needed_s': round(need, 2), 'ok': not issues, 'issues': issues}


def safe_zone(text_layout, honesty_layout, ctx):
    """violations of the safe rect by the text block and the honesty label, in canvas px: [{what, side, px}]"""
    out = []
    for what, lay in (('text', text_layout), ('honesty label', honesty_layout)):
        if not lay:
            continue
        for v in core.lint_rect(lay['rect'], ctx.platform, ctx.W, ctx.H):
            out.append({'what': what, 'side': v['side'], 'px': v['px']})
    return out


def label_runs(shots, fps, min_s):
    """consecutive shots with the same honesty label form one run; returns {shot id: run seconds} and the runs shorter than min_s"""
    runs, cur = [], None
    for s in shots:
        h = (s.get('honesty') or '').strip() or None
        dur = float(s.get('dur_s') or 0)
        if h and cur and cur['label'] == h:
            cur['dur'] += dur
            cur['ids'].append(s.get('id'))
        else:
            cur = {'label': h, 'dur': dur, 'ids': [s.get('id')]} if h else None
            if cur:
                runs.append(cur)
    per = {i: r['dur'] for r in runs for i in r['ids']}
    short = [r for r in runs if r['dur'] + 1e-9 < min_s]
    return per, short
