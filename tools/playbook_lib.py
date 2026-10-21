"""motion-pack / tools / playbook_lib.py: read the playbook (playbook/rules/<area>.json, playbook/formats/<id>.json, playbook/inbox/*.json).

Shared by tools/playbook_build.py (validate + generate the index), tools/playbook_checks.py (mp lint) and tools/playbook.py (mp formats, mp rules,
mp brief, mp study). Stdlib only. The playbook folder is playbook/ in the pack, or MP_PLAYBOOK / --playbook DIR (the tests point it at
tools/tests/fixtures/playbook). Nothing here reads a clock or writes a file."""
import glob
import json
import os
import re

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AREAS = ('hook', 'story', 'pacing', 'sound', 'music', 'type', 'visual', 'motion', 'honesty', 'delivery', 'platform', 'distribution')
GRADES = ('measured-A', 'measured', 'craft', 'house', 'inferred')
STATUSES = ('enforced', 'default', 'part', 'prose-only', 'candidate')
GRADE_WEIGHT = {'measured-A': 3, 'house': 3, 'measured': 2, 'craft': 1, 'inferred': 0}


def playbook_dir(arg=None):
    d = arg or os.environ.get('MP_PLAYBOOK') or os.path.join(PACK, 'playbook')
    return os.path.abspath(d)


def _load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def strip_comments(v):
    if isinstance(v, dict):
        return {k: strip_comments(x) for k, x in v.items() if not k.startswith('//')}
    if isinstance(v, list):
        return [strip_comments(x) for x in v]
    return v


def load_rules(pb, sub='rules'):
    """[(file, rule)] for every rule in <pb>/<sub>/*.json (arrays; a file that is one object counts as one rule)"""
    out = []
    for f in sorted(glob.glob(os.path.join(pb, sub, '*.json'))):
        data = _load(f)
        for r in (data if isinstance(data, list) else [data]):
            out.append((f, r))
    return out


def rules_by_id(pb):
    return {r['id']: r for _, r in load_rules(pb) if isinstance(r, dict) and 'id' in r}


def load_formats(pb):
    """{id: format} from <pb>/formats/*.json (comments stripped)"""
    out = {}
    for f in sorted(glob.glob(os.path.join(pb, 'formats', '*.json'))):
        fm = strip_comments(_load(f))
        fm['_file'] = f
        out[fm.get('id') or os.path.basename(f)[:-5]] = fm
    return out


def format_rule_ids(fm):
    """every rule id a format applies: the film-wide list, then each beat's, then the post rules (order kept, no repeats)"""
    ids = list(fm.get('rules') or [])
    for b in fm.get('beats') or []:
        ids += b.get('rules') or []
    ids += (fm.get('post') or {}).get('rules') or []
    seen, out = set(), []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def beat_of_rule(fm, rid):
    for b in fm.get('beats') or []:
        if rid in (b.get('rules') or []):
            return b
    return None


SHAPE_KEYS = ('quiet_open_db', 'quiet_open_s', 'bass_entry_pct', 'name_silence_s', 'tail')


def norm_params(p):
    """a *_pct range written in percent ([23, 52]) becomes fractions ([0.23, 0.52]); the checks and mp plan read fractions"""
    out = dict(p)
    for k, v in p.items():
        if k.endswith('_pct') and isinstance(v, list) and len(v) == 2 and all(isinstance(x, (int, float)) for x in v) and max(v) > 1:
            out[k] = [v[0] / 100.0, v[1] / 100.0]
    return out


def rule_params(rule, fm=None, defaults=None):
    """the numbers a check reads: the check's defaults <- the rule's params <- the format's sound_shape (a format specialises a rule)
    <- the beat's text.max_words when the rule sits on a beat"""
    p = dict(defaults or {})
    p.update(norm_params(rule.get('params') or {}))
    if fm:
        for k, v in (fm.get('sound_shape') or {}).items():
            if k in p or k in SHAPE_KEYS:
                p[k] = v
        p.setdefault('length_s', fm.get('length_s'))
        b = beat_of_rule(fm, rule.get('id'))
        if b and (b.get('text') or {}).get('max_words') is not None:
            p['beat_max_words'] = b['text']['max_words']
    return norm_params(p)


def closest_format(formats, seconds=None, signals_text=None):
    """the format whose length range is nearest `seconds` (ties: the first id); used by mp study when no --format is given"""
    best, bd = None, None
    for fid, fm in sorted(formats.items()):
        lo, hi = (fm.get('length_s') or [0, 0])[:2]
        d = 0.0 if seconds is None or lo <= seconds <= hi else min(abs(seconds - lo), abs(seconds - hi))
        if bd is None or d < bd:
            best, bd = fid, d
    return best


TODO_RX = re.compile(r'\bTODO\b')


def todo_paths(obj, at=''):
    """every path in a JSON value whose string carries a TODO marker"""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if not k.startswith('//'):
                out += todo_paths(v, '%s.%s' % (at, k) if at else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += todo_paths(v, '%s[%d]' % (at, i))
    elif isinstance(obj, str) and TODO_RX.search(obj):
        out.append(at)
    return out
