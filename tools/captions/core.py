"""motion-pack / tools / captions / core.py: word timings in, caption events out. Pure functions; no clock, no network.

    words = load_words(plan=plan)              # plan.transcript, or load_words('words.json'); speakers from plan.supers / voice.segments / word.speaker
    opts  = options(fps=30, audience='adult')  # every limit with its source in tools/a11y/standards.py
    evs   = build_events(words, opts)          # segmentation (dynamic programme over word boundaries) + line breaks + timing
    evs   = add_sdh(evs, plan, opts)           # optional: [sound] tags from the plan's SFX cues and the music bed
    evs   = place(evs, plan, W, H, opts)       # bottom of the platform safe rect, raised to the top when on-screen text is there

An event: {start, end, lines: [str], kind: speech|sound|music, speaker, words, position, box: [x0, y0, x1, y1] in frame px, notes: []}."""
import json
import math
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from a11y import safezones                    # noqa: E402
from a11y.standards import CAPTIONS, CLAUSE_END, GLUE, SENTENCE_END  # noqa: E402

PACK = safezones.PACK


def options(fps=30, audience='adult', profile='sidecar', W=1920, H=1080, **over):
    """the limits for one export. profile 'burn' also caps the line length to what fits the platform safe width at the burn-in size"""
    c = {k: v['v'] for k, v in CAPTIONS.items()}
    o = {'fps': float(fps), 'audience': audience, 'profile': profile, 'max_chars': c['max_chars_line'], 'max_lines': c['max_lines'],
         'cps': c['cps_kids'] if audience == 'kids' else c['cps_adult'], 'min_dur': c['min_dur_s'], 'max_dur': c['max_dur_s'], 'gap_frames': c['gap_frames'],
         'chain_s': c['chain_s'], 'split_gap_s': c['split_gap_s'], 'font_px': (c['burn_px_tall'] * W / 1080.0) if H > W else (c['burn_px_wide'] * H / 1080.0),
         'em': c['em_width'], 'line_h': 1.22, 'pad': 0.35, 'speaker_style': 'colon', 'sdh': False, 'sdh_level': 'key', 'platform': None}
    o.update({k: v for k, v in over.items() if v is not None})
    if profile == 'burn':
        safe = safezones.rect(o['platform'] or ('conservative' if H > W else 'wideTitle'), W, H)
        fit = int((safe['w'] - 2 * o['pad'] * o['font_px']) // (o['em'] * o['font_px']))
        o['max_chars'] = max(8, min(o['max_chars'], fit))
    return o


# ------------------------------------------------------------------------------------------------ words
def _norm(items):
    out = []
    for x in items or []:
        w = str(x.get('w', x.get('word', x.get('text', ''))) if isinstance(x, dict) else '').strip()
        try:
            s, e = float(x.get('s', x.get('start'))), float(x.get('e', x.get('end')))
        except (TypeError, ValueError):
            continue
        if not w or not math.isfinite(s) or not math.isfinite(e):
            continue
        out.append({'w': w, 's': s, 'e': max(e, s + 0.05), 'speaker': x.get('speaker') or x.get('clip')})
    out.sort(key=lambda a: a['s'])
    for a, b in zip(out, out[1:]):
        if b['s'] < a['e']:
            a['e'] = max(a['s'] + 0.04, b['s'])
    return out


def speaker_names(plan):
    """{speaker or clip id: display name} from plan.supers (multi-voice-doc), plan.speakers, or plan.voice.speakers"""
    plan = plan or {}
    names = {}
    for s in plan.get('supers') or []:
        if isinstance(s, dict) and s.get('clip') and s.get('name'):
            names[s['clip']] = s['name']
    for key in ('speakers',):
        v = plan.get(key) or (plan.get('voice') or {}).get(key)
        if isinstance(v, dict):
            names.update({k: (x.get('name') if isinstance(x, dict) else x) for k, x in v.items()})
    return names


def load_words(path=None, plan=None, speakers=None):
    """words [{w, s, e, speaker}] from a words.json (list, or {words: [...]}) or from the plan's transcript; a word without a speaker takes the
    speaker of the plan voice segment it falls in. `speakers` maps ids to names and wins over the plan's names."""
    if path:
        d = json.load(open(path, encoding='utf-8'))
        items = d.get('words', d.get('transcript', [])) if isinstance(d, dict) else d
    else:
        items = (plan or {}).get('transcript') or (plan or {}).get('words') or []
    words = _norm(items)
    segs = [s for s in ((plan or {}).get('voice') or {}).get('segments') or [] if isinstance(s, dict)]
    for w in words:
        if w['speaker'] is None:
            for s in segs:
                a = float(s.get('start', 0))
                b = a + float(s.get('src_out', 0)) - float(s.get('src_in', 0))
                if a - 1e-6 <= w['s'] < b + 1e-6 and s.get('speaker') is not None:
                    w['speaker'] = s['speaker']
                    break
    names = {**speaker_names(plan), **(speakers or {})}
    for w in words:
        if w['speaker'] is not None:
            w['speaker'] = names.get(w['speaker'], w['speaker'])
    return words


# ------------------------------------------------------------------------------------------------ line breaks
def _bare(w):
    return w.strip('"\'“”‘’()[]').lower().rstrip('.,;:!?…—–')


def glue_end(w):
    """True when a line or event should not end on this word (it binds to the next): function words and speaker labels"""
    return w.endswith(':') and w[:-1].isupper() or (w.startswith('[') and w.endswith(']') and not w.endswith('.]')) or _bare(w) in GLUE and not w.endswith(SENTENCE_END + CLAUSE_END)


def break_lines(tokens, max_chars, max_lines=2):
    """([line, ...], cost) for one event, or None when it cannot fit. One line whenever it fits; otherwise the best of every 2-line split:
    after punctuation is good, after a glue word is bad, a bottom-heavy or balanced shape is preferred."""
    text = ' '.join(tokens)
    if len(text) <= max_chars:
        return [text], 0.0
    if max_lines < 2 or len(tokens) < 2:
        return None
    best = None
    for k in range(1, len(tokens)):
        a, b = ' '.join(tokens[:k]), ' '.join(tokens[k:])
        if len(a) > max_chars or len(b) > max_chars:
            continue
        last = tokens[k - 1]
        c = 0.0
        if last.endswith(SENTENCE_END):
            c -= 3.0
        elif last.endswith(CLAUSE_END):
            c -= 2.0
        if glue_end(last):
            c += 5.0
        if len(a) > len(b):
            c += 1.0 + (len(a) - len(b)) / float(max_chars)
        c += abs(len(a) - len(b)) / float(max_chars)
        if best is None or c < best[1]:
            best = ([a, b], c)
    return best


# ------------------------------------------------------------------------------------------------ segmentation + timing
def _label(speaker, style):
    return ('[%s]' % speaker) if style == 'brackets' else ('%s:' % str(speaker).upper())


def _tokens(words, i, j, o, labels):
    toks = [w['w'] for w in words[i:j]]
    if labels and i in labels:
        toks = [labels[i]] + toks
    return toks


def build_events(words, o, labels=None, max_words=18):
    """partition the words into events by a dynamic programme: an event fits max_lines x max_chars, lasts at most max_dur of speech, keeps one
    speaker and no pause over split_gap_s; boundaries after a sentence end cost least and boundaries after a glue word cost most."""
    n = len(words)
    if n == 0:
        return []
    INF = float('inf')
    best, back, lines_of = [0.0] + [INF] * n, [0] * (n + 1), {}
    for j in range(1, n + 1):
        for i in range(max(0, j - max_words), j):
            if best[i] == INF:
                continue
            single = j - i == 1
            if not single:
                if any(words[k]['speaker'] != words[i]['speaker'] for k in range(i + 1, j)):
                    continue
                if words[j - 1]['e'] - words[i]['s'] > o['max_dur'] + 1e-9:
                    continue
                if any(words[k + 1]['s'] - words[k]['e'] > o['split_gap_s'] for k in range(i, j - 1)):
                    continue
            toks = _tokens(words, i, j, o, labels)
            br = break_lines(toks, o['max_chars'], o['max_lines'])
            if br is None:
                if not single:
                    continue
                br = ([' '.join(toks)], 50.0)                                 # a single word longer than a line: kept, flagged by the validator
            c = 3.0 + br[1] + 0.4 * (len(br[0]) - 1)
            room = (words[j]['s'] if j < n else words[j - 1]['e'] + o['max_dur']) - words[i]['s'] - o['gap_frames'] / o['fps']
            if room < o['min_dur']:
                c += 8.0                                                  # cannot stay up for the minimum: prefer joining a neighbour
            chars = sum(len(x) for x in br[0])
            if chars / max(room, 1e-3) > o['cps']:
                c += 2.0 * (chars / max(room, 1e-3) - o['cps']) / o['cps'] * 4
            at_break = len(br[0]) == 2 and br[0][0].split()[-1] if len(br[0]) == 2 else None
            for k in range(i, j - 1):                                     # a sentence or a pause inside an event: allowed at the line break only
                w = words[k]['w']
                inner_gap = words[k + 1]['s'] - words[k]['e']
                if w.endswith(SENTENCE_END):
                    c += 1.0 if w == at_break else 3.5
                if inner_gap >= 0.5:
                    c += 0.5 if w == at_break else 2.5
            if j < n:
                last = words[j - 1]['w']
                gap = words[j]['s'] - words[j - 1]['e']
                c += 0.0 if last.endswith(SENTENCE_END) else 1.0 if (last.endswith(CLAUSE_END) or gap >= 0.3) else 4.0
                if glue_end(last):
                    c += 6.0
            if best[i] + c < best[j]:
                best[j], back[j], lines_of[j] = best[i] + c, i, br[0]
    cuts, j = [], n
    while j > 0:
        cuts.append((back[j], j, lines_of[j]))
        j = back[j]
    evs = []
    for i, j, ln in reversed(cuts):
        evs.append({'start': words[i]['s'], 'end': words[j - 1]['e'], 'lines': ln, 'kind': 'speech', 'speaker': words[i]['speaker'],
                    'words': [dict(w) for w in words[i:j]], 'notes': []})
    return retime(evs, o)


def snap(t, fps):
    return round(t * fps) / fps


def retime(evs, o):
    """reading time and gaps: an event ends at the latest of its last word, start + min_dur and start + chars / cps, but never closer than
    gap_frames to the next event; a gap under chain_s is closed to exactly gap_frames. Times snap to the frame grid."""
    fps, gap = o['fps'], o['gap_frames'] / o['fps']
    evs = sorted(evs, key=lambda e: e['start'])
    for k, e in enumerate(evs):
        e['start'] = snap(e['start'], fps)
        chars = sum(len(x) for x in e['lines'])
        want = max(e['end'], e['start'] + o['min_dur'], e['start'] + chars / o['cps'])
        want = min(want, e['start'] + max(o['max_dur'], e['end'] - e['start']))
        nxt = evs[k + 1]['start'] if k + 1 < len(evs) else None
        if nxt is not None:
            nxt = snap(nxt, fps)
            if nxt - want < o['chain_s']:
                want = nxt - gap
            want = min(want, nxt - gap)
        e['end'] = max(snap(want, fps), e['start'] + 1.0 / fps)
    return evs


# ------------------------------------------------------------------------------------------------ SDH
_SFX = None
# the sound categories captioned at sdh_level 'key' (sounds that carry story); 'all' adds every category but the UI, transition and drum sweeteners
KEY_CATS = {'device', 'foley', 'cartoon', 'crowd', 'cash', 'camera', 'voice', 'logo', 'stinger', 'hit', 'elec', 'glass', 'liquid', 'lift', 'metal', 'wood', 'ceramic', 'cloth', 'plastic', 'paper', 'hw', 'sizzle'}
NEVER = {'ui', 'tx', 'drum', 'whoosh', 'riser', 'sparkle', 'amb'}


def sfx_desc(sid):
    """'[applause]' style tag text for an sfx id from the head of its sfx/manifest.json desc ('applause: dense claps...' -> 'applause')"""
    global _SFX
    if _SFX is None:
        try:
            m = json.load(open(os.path.join(PACK, 'sfx', 'manifest.json'), encoding='utf-8'))
            _SFX = {x['id']: x.get('desc', '') for x in m.get('sounds', [])}
        except (OSError, ValueError):
            _SFX = {}
    key = 'snd.' + '.'.join(sid.split('/')[1:]) if sid.startswith('sfx/') else sid
    d = _SFX.get(key, '')
    head = d.split(':')[0].strip() if d else sid.split('/')[-1].replace('_', ' ')
    return head.lower()


def music_desc(mid):
    try:
        m = json.load(open(os.path.join(PACK, 'music', 'manifest.json'), encoding='utf-8'))
    except (OSError, ValueError):
        return 'music'
    key = mid.replace('music/', 'music.')
    for x in m.get('items', []):
        if x.get('id') == key:
            mood = [t for t in x.get('mood', []) if isinstance(t, str)][:2]
            return ' '.join(mood + ['music']) if mood else 'music'
    return 'music'


def sound_cues(plan, level='key'):
    """[(t, '[tag]')] from plan.cues; a cue's own `sdh` (text) wins and `sdh: false` drops it. Repeats of one tag within 3 s are merged."""
    out = []
    for c in (plan or {}).get('cues') or []:
        if not isinstance(c, dict) or not str(c.get('id', '')).startswith('sfx/'):
            continue
        t = float(c.get('t', 0))
        if c.get('sdh') is False:
            continue
        if isinstance(c.get('sdh'), str) and c['sdh'].strip():
            out.append((t, '[%s]' % c['sdh'].strip().strip('[]')))
            continue
        cat = c['id'].split('/')[1]
        if cat in NEVER or (level == 'key' and cat not in KEY_CATS):
            continue
        out.append((t, '[%s]' % sfx_desc(c['id'])))
    out.sort()
    keep, last = [], {}
    for t, tag in out:
        if tag in last and t - last[tag] < 3.0:
            continue
        last[tag] = t
        keep.append((t, tag))
    return keep


def speaker_labels(words, style='colon'):
    """{word index: label} on the first word of every speaker turn, only when the words have more than one speaker"""
    spk = [w['speaker'] for w in words]
    if len({s for s in spk if s is not None}) < 2:
        return {}
    out, prev = {}, object()
    for i, s in enumerate(spk):
        if s is not None and s != prev:
            out[i] = _label(s, style)
        prev = s
    return out


def build(words, o, plan=None):
    """the full pipeline for one track: speaker labels (SDH), segmentation, then [sound] and [music] tags"""
    labels = speaker_labels(words, o['speaker_style']) if o.get('sdh') else None
    evs = build_events(words, o, labels=labels)
    if o.get('sdh'):
        evs = add_sdh(evs, plan, o)
    return evs


def add_sdh(evs, plan, o):
    """[sound] tags in the gaps between speech events (an event of their own when the gap holds min_dur), else added as a line to the speech
    event they fall in when it has a free line that fits, else dropped with a note on the nearest event. The bed gets one [music] tag at its start."""
    plan = plan or {}
    tags = sound_cues(plan, o.get('sdh_level', 'key'))
    if plan.get('music'):
        audio = plan.get('audio') if isinstance(plan.get('audio'), dict) else {}
        quiet = [q for q in audio.get('quiet') or [] if isinstance(q, dict) and q.get('kind') == 'open']
        t0 = float(quiet[0]['t'][1]) if quiet else 0.0
        tags = sorted(tags + [(t0, '[%s]' % music_desc(plan['music']))])
    fps, gap = o['fps'], o['gap_frames'] / o['fps']
    dur = float(plan.get('seconds') or 0) or None
    evs = sorted(evs, key=lambda e: e['start'])
    new = []
    for t, tag in tags:
        host = next((e for e in evs if e['start'] - 1e-6 <= t < e['end']), None)
        if host is None:
            prev = max((e['end'] for e in evs + new if e['end'] <= t + 1e-6), default=0.0)
            nxt = min((e['start'] for e in evs + new if e['start'] > t), default=dur if dur else t + o['max_dur'])
            a = snap(max(t, prev + gap), fps)
            b = snap(min(nxt - gap, a + max(o['min_dur'], len(tag) / o['cps'])), fps)
            if b - a >= o['min_dur'] - 1e-6:
                new.append({'start': a, 'end': b, 'lines': [tag], 'kind': 'music' if 'music' in tag else 'sound', 'speaker': None, 'words': [], 'notes': []})
                continue
            host = min(evs, key=lambda e: min(abs(e['start'] - t), abs(e['end'] - t))) if evs else None
        if host is not None and len(host['lines']) < o['max_lines'] and len(tag) <= o['max_chars']:
            host['lines'] = [tag] + host['lines'] if t <= host['start'] + 0.3 else host['lines'] + [tag]
            if 'music' in tag and host['kind'] == 'speech':
                host['music'] = True
        elif host is not None:
            host['notes'].append('sound tag %s at %.2f s dropped: no gap of %.2f s and no free line' % (tag, t, o['min_dur']))
    return sorted(evs + new, key=lambda e: e['start'])


# ------------------------------------------------------------------------------------------------ placement
def _overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def place(evs, plan, W, H, o):
    """box and position per event inside the platform safe rect: bottom by default, the top when an on-screen text box of plan.texts (or a
    lower third / title the plan lists with a box) overlaps the bottom box while the event is up. Both blocked: bottom, with a note."""
    plat = o.get('platform') or safezones.default_platform(W, H, plan)
    r = safezones.rect(plat, W, H)
    f, lh, pad = o['font_px'], o['line_h'], o['pad'] * o['font_px']
    texts = [x for x in (plan or {}).get('texts') or [] if isinstance(x, dict) and x.get('box') and x.get('t')]
    for e in evs:
        h = len(e['lines']) * lh * f + 2 * pad
        wmax = max(len(x) for x in e['lines']) * o['em'] * f + 2 * pad
        w = min(r['w'], wmax)
        x0 = (r['x0'] + r['x1']) / 2 - w / 2
        bottom = [x0, r['y1'] - h, x0 + w, r['y1']]
        top = [x0, r['y0'], x0 + w, r['y0'] + h]
        live = [x['box'] for x in texts if x['t'][0] < e['end'] and e['start'] < x['t'][1]]
        if any(_overlap(bottom, b) for b in live):
            if any(_overlap(top, b) for b in live):
                e['position'], e['box'] = 'bottom', [round(v, 1) for v in bottom]
                e['notes'].append('on-screen text at the top and the bottom of the safe area: caption kept at the bottom over it')
            else:
                e['position'], e['box'] = 'top', [round(v, 1) for v in top]
        else:
            e['position'], e['box'] = 'bottom', [round(v, 1) for v in bottom]
        e['frame'] = [W, H]
        e['platform'] = r['platform']
    return evs


def text_of(e):
    return '\n'.join(e['lines'])
