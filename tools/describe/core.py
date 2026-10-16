"""motion-pack / tools / describe / core.py: an audio-description SCRIPT from a plan, placed in the gaps between speech. Pure functions.

    items = describe_items(plan, shotlist=None)     # what to say, per shot: the author's own lines first, else a DRAFT built from the plan
    rep   = place(items, words, duration, opts)     # standard AD: each line in a speech gap inside or near its shot; what cannot fit is listed
    ext   = extend(rep, words, opts)                # extended AD: the picture pauses at a word boundary for each line that did not fit

No voice is made here (no TTS). The script is text and a WebVTT descriptions track; a describer voices it, or a screen reader / the player
reads the track. Auto-built lines are marked draft: a human checks them against the picture, because a plan says what was planned,
not what a viewer sees."""
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from a11y.standards import AD                 # noqa: E402

OPTS = {k: v['v'] for k, v in AD.items()}
_TEXT_KEYS = ('headline', 'title', 'text', 'name', 'role', 'label', 'line', 'sub', 'caption', 'step', 'word', 'place', 'location', 'date', 'cta', 'url', 'value')
FAMILY = {   # gfx family -> the noun a describer would use. Names never come from a part id alone; visible strings come from its params
    'title': 'a title card', 'lowerThird': 'a name caption', 'chart': 'a chart', 'ui': 'an interface panel', 'callout': 'a highlight',
    'hw': 'a product label', 'map': 'a map', 'sticker': 'a sticker', 'social': 'a social button', 'counter': 'a number', 'caption': 'a caption',
    'layout': 'a layout change', 'type': 'animated text', 'device': 'a device screen', 'fx': 'an effect', 'reaction': 'a reaction',
}
SKIP_FAMILY = {'fx', 'reaction'}


def _clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'[*_]', '', str(s))).strip()


def _sec(v, plan):
    """plan times are seconds; a few overlay lists (multi-voice-doc supers) count frames: a value past the plan length is read as frames"""
    v = float(v)
    secs = float(plan.get('seconds') or 0)
    return v / float(plan.get('fps') or 30) if secs and v > secs + 1e-6 else v


def _strings(params):
    out = []
    for k in _TEXT_KEYS:
        v = (params or {}).get(k)
        if isinstance(v, str) and v.strip() and not v.startswith(('/', 'http')) and len(v) < 90:
            out.append(_clean(v))
    return out


def _walk_gfx(o, acc):
    if isinstance(o, dict):
        i = o.get('id')
        if isinstance(i, str) and '.' in i and 'at' in o and not i.startswith(('sfx/', 'music/', 'transitions/', 'cam', 'snd.')):
            acc.append(o)
        for v in o.values():
            _walk_gfx(v, acc)
    elif isinstance(o, list):
        for v in o:
            _walk_gfx(v, acc)
    return acc


def shots_of(plan, shotlist=None):
    """[(id, start, end, shot)] from the plan's shots (start + dur), else the shot list (start_s + dur_s)"""
    out = []
    for s in (plan or {}).get('shots') or []:
        if isinstance(s, dict) and 'start' in s and 'dur' in s:
            out.append((s.get('id'), float(s['start']), float(s['start']) + float(s['dur']), s))
    if not out and shotlist:
        for s in shotlist.get('shots') or []:
            out.append((s.get('id'), float(s['start_s']), float(s['start_s']) + float(s['dur_s']), s))
    return out


def describe_items(plan, shotlist=None):
    """[{id, t, until, text, short, draft, source}] one per shot. Order of trust: shot.ad / shot.describe in the plan (author), the shot list's
    `action` (author, from story-script), else a draft from the shot's on-screen text, the plan texts and the overlays live in it."""
    plan = plan or {}
    sl = {s.get('id'): s for s in (shotlist or {}).get('shots') or []}
    texts = [x for x in plan.get('texts') or [] if isinstance(x, dict) and x.get('t') and x.get('text')]
    gfx = _walk_gfx(plan.get('overlays') or [], []) + _walk_gfx(plan.get('scene') or {}, [])
    items = []
    for sid, a, b, s in shots_of(plan, shotlist):
        own = s.get('ad') or s.get('describe')
        if isinstance(own, str) and own.strip():
            items.append({'id': sid, 't': a, 'until': b, 'text': _clean(own), 'short': _clean(own).split('. ')[0], 'draft': False, 'source': 'plan shot.ad'})
            continue
        if sid in sl and _clean(sl[sid].get('action', '')):
            act = _clean(sl[sid]['action'])
            act = act[0].upper() + act[1:]
            act += '' if act.endswith('.') else '.'
            on = _clean(sl[sid].get('text', ''))
            full = act + (' On screen: "%s".' % on if on else '')
            items.append({'id': sid, 't': a, 'until': b, 'text': full, 'short': act.split('; ')[0].rstrip('.') + '.', 'draft': False, 'source': 'shotlist action'})
            continue
        seen = []
        if s.get('text'):
            seen.append('"%s"' % _clean(s['text']))
        seen += ['"%s"' % _clean(x['text']) for x in texts if a - 0.1 <= float(x['t'][0]) < b - 0.05 and '"%s"' % _clean(x['text']) not in seen]
        named, bare = [], []
        for g in gfx:
            at = _sec(g['at'], plan)
            fam = g['id'].split('.')[0]
            if not (a - 0.1 <= at < b - 0.05) or fam in SKIP_FAMILY or float(g.get('dur') or 0) > 8.0:     # long-lived HUD parts are not news in a shot
                continue
            words = _strings(g.get('params')) + ([_clean(g['speaker'])] if isinstance(g.get('speaker'), str) else [])
            noun = FAMILY.get(fam, 'a graphic')
            (named if words else bare).append(noun + (': ' + ', '.join(words[:2]) if words else ''))
        objs = list(dict.fromkeys(named or ([] if seen else bare)))[:3]
        bits = []
        if seen:
            on = 'On screen: ' + '; '.join(seen)
            bits.append(on if on[-2] in '.?!' else on + '.')
        if objs:
            line = '; '.join(objs)
            bits.append(line[0].upper() + line[1:] + ('' if line.endswith(('.', '?', '!')) else '.'))
        if not bits and s.get('kind') in ('plate', 'card') and not (s.get('media') or s.get('label')):
            bits.append('A placeholder plate.')
        if bits:
            short = re.split(r'(?<=[.;])\s', bits[0])[0].rstrip(';') if not seen else bits[0]
            short = short if short.endswith(('.', '?', '!', '"')) else short + '.'
            items.append({'id': sid, 't': a, 'until': b, 'text': ' '.join(bits), 'short': short, 'draft': True, 'source': 'auto from plan (check against the picture)'})
    return items


# ------------------------------------------------------------------------------------------------ placement
def speech_regions(words, merge):
    regs = []
    for w in sorted(words, key=lambda x: x['s']):
        if regs and w['s'] - regs[-1][1] < merge:
            regs[-1][1] = max(regs[-1][1], w['e'])
        else:
            regs.append([w['s'], w['e']])
    return regs


def gaps(words, duration, merge):
    regs = speech_regions(words, merge)
    out, t = [], 0.0
    for a, b in regs:
        if a > t:
            out.append([t, a])
        t = max(t, b)
    if duration and duration > t:
        out.append([t, duration])
    return out


def need(text, o):
    return len(text.split()) / o['wps']


def place(items, words, duration, o=None):
    """standard AD: each item goes in the first speech gap that opens no earlier than 0.5 s before its shot and starts before the shot ends,
    at max(gap start + lead, shot start), if the gap holds the full line (else the short line). Lines never overlap each other or speech.
    Returns {placed: [...], unplaced: [...], gaps: [...]}"""
    o = {**OPTS, **(o or {})}
    gs = [list(g) for g in gaps(words, duration, o['speech_merge_s'])]
    placed, unplaced = [], []
    for it in sorted(items, key=lambda x: x['t']):
        done = False
        for g in gs:
            a = max(g[0] + (o['lead_s'] if g[0] > 0 else 0.0), it['t'])
            if g[1] <= it['t'] - 0.5 or a >= it['until'] or a >= g[1]:
                continue
            room = g[1] - o['tail_s'] - a if g[1] < (duration or 1e9) else g[1] - a
            for kind in ('text', 'short'):
                d = need(it[kind], o)
                if d <= room:
                    placed.append({**it, 'say': it[kind], 'form': 'full' if kind == 'text' else 'short', 'start': round(a, 3), 'end': round(a + d, 3)})
                    g[0] = a + d                                                  # the rest of the gap stays free for the next line
                    done = True
                    break
            if done:
                break
        if not done:
            unplaced.append({**it, 'need_s': round(need(it['text'], o), 3)})
    return {'placed': placed, 'unplaced': unplaced, 'gaps': [[round(a, 3), round(b, 3)] for a, b in gaps(words, duration, o['speech_merge_s'])], 'opts': o}


def pause_point(t, words, merge):
    """the first word boundary at or after t (never inside a word): t itself when no word spans it, else the end of the word that does"""
    for w in sorted(words, key=lambda x: x['s']):
        if w['s'] < t < w['e']:
            return w['e']
    return t


def extend(rep, words, o=None):
    """extended AD: every unplaced line pauses the picture (and the programme sound) at a word boundary at or after its shot start, for the time
    the line needs; later times shift by the pauses before them. Returns {pauses: [{at, dur}], cues: [...] on the extended timeline}."""
    o = {**rep['opts'], **(o or {})}
    pauses = []
    for it in rep['unplaced']:
        at = pause_point(it['t'], words, o['speech_merge_s'])
        pauses.append({'at': round(at, 3), 'dur': round(need(it['text'], o) + o['lead_s'] + o['tail_s'], 3), 'id': it['id'], 'say': it['text'], 'draft': it['draft']})
    pauses.sort(key=lambda p: p['at'])

    def shift(t):
        return t + sum(p['dur'] for p in pauses if p['at'] < t - 1e-9)

    cues = [{'start': round(shift(p['start']), 3), 'end': round(shift(p['end']), 3), 'text': p['say'], 'id': p['id'], 'draft': p['draft'], 'paused': False} for p in rep['placed']]
    for p in pauses:
        a = shift(p['at']) + o['lead_s']
        cues.append({'start': round(a, 3), 'end': round(a + p['dur'] - o['lead_s'] - o['tail_s'], 3), 'text': p['say'], 'id': p['id'], 'draft': p['draft'], 'paused': True})
    return {'pauses': pauses, 'cues': sorted(cues, key=lambda c: c['start']), 'added_s': round(sum(p['dur'] for p in pauses), 3)}


def ffmpeg_extended(src, pauses, out, duration, has_audio=True):
    """pure: ffmpeg arguments that freeze the picture (tpad clone) and insert silence (apad) at each pause, so the describer's line has room.
    Segment k runs from pause k-1 to pause k; its last frame is held for pause k's duration."""
    cuts = [0.0] + [p['at'] for p in pauses] + [float(duration)]
    durs = [p['dur'] for p in pauses] + [0.0]
    fg, labels = [], []
    for k in range(len(cuts) - 1):
        a, b, d = cuts[k], cuts[k + 1], durs[k]
        v = '[0:v]trim=start=%.4f:end=%.4f,setpts=PTS-STARTPTS%s[v%d]' % (a, b, (',tpad=stop_mode=clone:stop_duration=%.4f' % d) if d > 0 else '', k)
        fg.append(v)
        labels.append('[v%d]' % k)
        if has_audio:
            fg.append('[0:a]atrim=start=%.4f:end=%.4f,asetpts=PTS-STARTPTS%s[a%d]' % (a, b, (',apad=pad_dur=%.4f' % d) if d > 0 else '', k))
            labels.append('[a%d]' % k)
    n = len(cuts) - 1
    fg.append('%sconcat=n=%d:v=1:a=%d[v][a]' % (''.join(labels), n, 1 if has_audio else 0) if has_audio else '%sconcat=n=%d:v=1:a=0[v]' % (''.join(labels), n))
    args = ['-y', '-v', 'error', '-i', src, '-filter_complex', ';'.join(fg), '-map', '[v]']
    if has_audio:
        args += ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k']
    return args + ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                   '-movflags', '+faststart', out]
