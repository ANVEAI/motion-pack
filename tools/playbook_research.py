#!/usr/bin/env python3
"""motion-pack / tools / playbook_research.py: `mp brief` and `mp study`: the research, selected per video.

    python3 tools/playbook_research.py brief <brief.md | "one-line idea"> [--goal G] [--platform P] [--format F] [--length N] [--aspect A] [--out DIR] [--pick-top]
        classify the brief to a format by its `signals` (keywords, product types, goals, platforms), then write DIR/research-pack.json and
        research-pack.md (the format and why, the rules by beat with params and grade, the closest exemplars, recommended parts per beat, hook
        options from patterns/hooks.json, the sound shape and bed, the post plan, the honesty checklist) and call `mp plan` (DIR/plan.json,
        DIR/project.json; plan.playbook.research points at the pack). When two formats score alike it asks at most two questions and exits 3
        (answer with --goal / --platform / --format, or take the top pick with --pick-top).
    python3 tools/playbook_research.py study <video.mp4 | x-status-url | study.json> [--format F] [--ours | --reference] [--slug S] [--out DIR] [--whisper M]
        run tools/refstudy.py (once: an existing study.json is reused), lint the measurements against the closest format, then
          our render (a local MP4 with <render>.plan.json, or --ours): the gaps against the format's exemplars and rules, with fixes;
          a reference (a URL, or --reference): candidate rules in playbook/inbox/<date>-<slug>.json (status candidate, brand-free, never
          the account), for `mp rules promote`.
Both take --playbook DIR. Exit 0 ok, 1 the lint found a FAIL (study of our render), 2 usage, 3 the brief is ambiguous."""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import playbook_lib as L  # noqa: E402
import playbook_checks as K  # noqa: E402
import playbook_lint as PL  # noqa: E402

GOALS = ('awareness', 'launch', 'explain', 'sell', 'proof', 'entertain', 'teach', 'recruit')
HONESTY = ['every number on screen is a claim with a source that says where it comes from (lint.proof)',
           'placeholder UI, demo data and fictional brands are labelled in frame',
           'no studied account, handle or brand name in the film or its files (check_names)',
           'a reference is studied for craft, never copied (shots, lines, music)',
           'AI-made footage or voice is disclosed where the platform asks (social-video)',
           'no TODO left in the plan (mp lint)']


# ---------------------------------------------------------------- brief

def _has(text, phrase):
    return re.search(r'(?<![a-z0-9])%s(?![a-z0-9])' % re.escape(phrase.lower()), text) is not None


# words that say little about the format: a "film", a "hype" reel, a "brand" or "music" are in almost every brief, so they count a quarter of a keyword
WEAK = {'film', 'films', 'series', 'hype', 'video', 'videos', 'edit', 'reel', 'reels', 'brand', 'music', 'season', 'coming', 'tour', 'story', 'people', 'ship'}
# a negated phrase is not a signal: "no voice-over", "not a book-a-demo", "without music", "never a trailer" (the negator to the next punctuation, 5 words at most)
NEG_RX = re.compile(r"(?<![a-z0-9])(?:no|not(?: an?)?|without|never|nor|avoid|don'?t (?:want|use|need)|isn'?t(?: an?)?)\s+((?:[a-z0-9-]+\s*){1,5})")
# brief fields (markdown "**Field:** text" or "Field: text" lines): which carry signals and how
FIELD_RX = re.compile(r'^\s*[-*]?\s*\**\s*([A-Za-z][A-Za-z /-]{1,30}?)\s*:?\**\s*:\s*(.*)$')
META = ('tone', 'brand', 'style', 'look', 'voice', 'music', 'sound', 'constraints', 'notes', 'references', 'deliverables', 'format notes')
AUDIENCE = ('who', 'audience', 'for whom', 'viewers', 'target')
# who watches, mapped to the formats made for them (weighted above words like "film" or "hype")
AUDIENCE_FORMATS = {
    'business': (r'partners?|firms?|founders?|builders?|teams?|buyers?|customers?|clients?|developers?|engineers?|managers?|b2b|enterprises?|ctos?|ceos?|professionals?|accountants?|lawyers?|operators?',
                 ('launch-film', 'saas-feature-drop', 'proof-clip', 'explainer', 'screen-life')),
    'entertainment': (r'fans?|gamers?|readers?|moviegoers?|audiences? of|kids|music lovers|followers',
                      ('trailer', 'beat-edit', 'character-spot', 'short-film', 'chat-skit')),
}


STYLE_RX = re.compile(r"\b(?:in|with) (?:the |a |an )?(?:[a-z0-9-]+ ){1,3}(?:style|look)\b")


def _negate(t):
    """the text with every negated phrase blanked: "no voice-over" and "not a book a demo" are not signals"""
    return NEG_RX.sub(lambda m: ' ' * len(m.group(0)), t)


def brief_fields(text):
    """split a brief into (signal text, goal text, audience text, platform text): field lines about tone, brand, sound or notes are meta and carry no format
    signal; the audience line says who watches (AUDIENCE_FORMATS), not what the film is; a brief with no fields is all signal text"""
    sig, goal, aud, plat, found = [], [], [], [], False
    text = re.sub(r'<!--.*?-->', ' ', text or '', flags=re.S)   # comments are notes about the brief, not the brief
    for line in text.split('\n'):
        m = FIELD_RX.match(line)
        if not m:
            sig.append(line)
            continue
        key, body = m.group(1).strip().lower(), m.group(2).lstrip('* ')
        found = True
        if key.startswith('goal') or key in ('objective', 'purpose', 'aim'):
            goal.append(body); sig.append(body)
        elif any(key.startswith(a) for a in AUDIENCE):
            aud.append(body)
        elif key.startswith('platform') or key in ('channels', 'where'):
            plat.append(body)
        elif any(key.startswith(x) for x in META):
            continue
        else:
            sig.append(body)
    return '\n'.join(sig), '\n'.join(goal), '\n'.join(aud), '\n'.join(plat), found


def classify(text, formats, goal=None, platform=None, length=None):
    """-> [(score, fid, why[])] best first. Pure.
    Signals: keywords and product types +2 each (WEAK words +0.5), from the brief minus negated phrases and meta fields (tone, brand, sound, notes);
    goals: --goal, else the goals named in the brief's Goal field (the first named is primary, +4; the others +2), else any goal word (+3);
    audience: a business or entertainment audience in the Who / Audience field +3 for the formats made for it; naming the format itself ("a launch
    film", "an explainer") +4; platform +1; a length in range +1."""
    sig, gtext, aud, ptext, fielded = brief_fields(text)
    t, gt, at = _negate(STYLE_RX.sub(' ', sig.lower())), _negate(gtext.lower()), _negate(aud.lower())   # "in the Documentary Grain style" names a look, not a format
    named = sorted(((m.start(), g) for g in GOALS for m in [re.search(r'(?<![a-z0-9])%s' % g, gt)] if m)) if gt else []
    goals_found = [goal] if goal else [g for _, g in named]
    aud_class = [k for k, (rx, _) in AUDIENCE_FORMATS.items() if re.search(r'(?<![a-z0-9])(?:%s)(?![a-z0-9])' % rx, at)]
    out = []
    for fid, fm in formats.items():
        s = fm.get('signals') or {}
        why, sc = [], 0.0
        for k in s.get('keywords') or []:
            if _has(t, k):
                w = 0.5 if k.lower() in WEAK else 2
                sc += w
                why.append('keyword "%s"%s' % (k, ' (weak)' if w < 2 else ''))
        for k in s.get('product_types') or []:
            if _has(t, k):
                w = 0.5 if k.lower() in WEAK else 2
                sc += w
                why.append('product "%s"%s' % (k, ' (weak)' if w < 2 else ''))
        names = {fid.replace('-', ' '), (fm.get('title') or '').split('(')[0].strip().lower()} - {''}
        if any(_has(t, n) for n in names):   # the brief names the format itself ("a launch film", "an explainer", "a 15-second ad")
            sc += 4
            why.append('names the format')
        fg = s.get('goals') or []
        if goals_found:
            for i, g in enumerate(goals_found):
                if g in fg:
                    sc += 4 if i == 0 else 2
                    why.append('goal %s%s' % (g, '' if i == 0 else ' (second)'))
        else:
            g = [x for x in fg if _has(t, x)]
            if g:
                sc += 3
                why.append('goal %s' % g[0])
        for k in aud_class:
            if fid in AUDIENCE_FORMATS[k][1]:
                sc += 3
                why.append('audience %s' % k)
        if platform and platform in (s.get('platforms') or []):
            sc += 1
            why.append('platform %s' % platform)
        if length and fm.get('length_s') and fm['length_s'][0] <= length <= fm['length_s'][1]:
            sc += 1
            why.append('length %g s fits %g-%g s' % (length, fm['length_s'][0], fm['length_s'][1]))
        out.append((sc, fid, why))
    out.sort(key=lambda x: (-x[0], x[1]))
    return out


def questions(ranked, formats, goal, platform):
    """at most two questions, only when the top two formats score alike (or nothing matched)"""
    if not ranked:
        return []
    top = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None
    if top[0] > 0 and (second is None or second[0] < top[0] - 1):
        return []
    cands = [r[1] for r in ranked[:3]]
    qs = []
    if not goal:
        gs = sorted({g for c in cands for g in (formats[c].get('signals') or {}).get('goals', [])}) or list(GOALS)
        qs.append('What is the film for: %s? (--goal)' % ' / '.join(gs))
    if not platform:
        ps = sorted({p for c in cands for p in (formats[c].get('signals') or {}).get('platforms', [])}) or ['x', 'reels', 'shorts', 'site']
        qs.append('Where does it run first: %s? (--platform)' % ' / '.join(ps))
    if not qs:
        qs.append('Which format: %s? (--format)' % ' / '.join(cands))
    return qs[:2]


def _hooks(fm):
    H = json.load(open(os.path.join(L.PACK, 'patterns', 'hooks.json'), encoding='utf-8'))['hooks']
    want = fm.get('hooks') or []
    tpl = os.path.basename(fm.get('template', ''))
    return [h for h in H if h['id'] in want] or [h for h in H if fm['id'] in h.get('pairs_with', []) or tpl in h.get('pairs_with', [])]


def research_pack(fm, rules, ranked, length, aspect, platform, brief_src):
    def row(r):
        en = r.get('enforce') or {}
        return {'id': r['id'], 'title': r.get('title'), 'statement': r.get('statement'), 'grade': r.get('grade'), 'status': r.get('status'),
                'params': L.rule_params(r, fm), 'check': en.get('check'), 'default': en.get('default'), 'part': en.get('part')}
    by_beat = {'film': [row(rules[i]) for i in fm.get('rules') or [] if i in rules]}
    for b in fm.get('beats') or []:
        by_beat[b['id']] = [row(rules[i]) for i in b.get('rules') or [] if i in rules]
    by_beat['post'] = [row(rules[i]) for i in (fm.get('post') or {}).get('rules') or [] if i in rules]
    ex = sorted(fm.get('exemplars') or [], key=lambda e: abs(e.get('length_s', 0) - length))
    parts = fm.get('recommended_parts') or {}
    honesty = HONESTY + [rules[i]['statement'] for i in L.format_rule_ids(fm) if i in rules and i.startswith('honesty.')]
    top = next(r for r in ranked if r[1] == fm['id']) if ranked else (0, fm['id'], ['--format'])
    return {
        'schema': 'motion-pack research-pack/1', 'brief': brief_src,
        'format': {'id': fm['id'], 'title': fm.get('title'), 'use_when': fm.get('use_when'), 'score': top[0], 'why': top[2] or ['chosen with --format'],
                   'alternatives': [{'id': r[1], 'score': r[0]} for r in ranked if r[1] != fm['id']][:3], 'template': fm.get('template')},
        'length': length, 'aspect': aspect, 'platform': platform,
        'beats': [{'id': b['id'], 'at': b['at'], 's': [round(b['at'][0] * length, 2), round(b['at'][1] * length, 2)], 'purpose': b['purpose'],
                   'text': b.get('text'), 'sound': b.get('sound'), 'parts': parts.get(b['id'], [])} for b in fm.get('beats') or []],
        'rules_by_beat': by_beat, 'exemplars': ex[:3], 'recommended_parts': parts, 'hooks': _hooks(fm),
        'sound': {'shape': fm.get('sound_shape') or {}, 'beds': [p for v in parts.values() for p in v if p.startswith('music/')], 'end_shapes': fm.get('end_shapes') or []},
        'post': fm.get('post'), 'honesty': honesty, 'plan': 'plan.json', 'project': 'project.json',
    }


def pack_md(rp):
    f = rp['format']
    out = ['# Research pack: %s, %g s at %s' % (f['title'], rp['length'], rp['aspect']), '',
           'Read this before writing the script (story-script reads it first). Generated by `mp brief`; the plan is `%s`.' % rp['plan'], '',
           '## Format', '', '**%s** (`%s`, template `%s`): %s' % (f['title'], f['id'], f['template'], f['use_when']), '',
           'Why: %s.%s' % ('; '.join(f['why']), '  Alternatives: ' + ', '.join('%s (%g)' % (a['id'], a['score']) for a in f['alternatives']) if f['alternatives'] else ''), '',
           '## Beats, rules and parts', '']
    for b in rp['beats']:
        out.append('### %s, %.1f-%.1f s: %s' % (b['id'], b['s'][0], b['s'][1], b['purpose']))
        if b.get('text'):
            out.append('- text: at most %s words' % b['text'].get('max_words', '?'))
        if b.get('sound'):
            out.append('- sound: %s%s' % (b['sound'].get('level', ''), (' (' + ', '.join(b['sound'].get('events', [])) + ')') if b['sound'].get('events') else ''))
        if b['parts']:
            out.append('- parts: ' + ', '.join('`%s`' % p for p in b['parts']))
        for r in rp['rules_by_beat'].get(b['id'], []):
            out.append('- rule `%s` (%s, %s): %s' % (r['id'], r['grade'], r['status'], r['statement']))
        out.append('')
    for k, title in (('film', 'Whole film'), ('post', 'Post')):
        if rp['rules_by_beat'].get(k):
            out += ['### %s' % title] + ['- rule `%s` (%s, %s): %s' % (r['id'], r['grade'], r['status'], r['statement']) for r in rp['rules_by_beat'][k]] + ['']
    if rp['exemplars']:
        out += ['## Closest exemplars', '']
        for e in rp['exemplars']:
            m = ', '.join('%s %s' % (k, e[k]) for k in ('lufs', 'quiet_open_db', 'quiet_tail_db', 'cuts_per_min', 'bass_entry_pct', 'end_shape') if e.get(k) is not None)
            out.append('- **%s** (%s): %s' % (e['label'], e['grade'], m))
            for b in e.get('beats') or []:
                out.append('  - %g-%g: %s%s%s' % (b['at'][0], b['at'][1], b['purpose'], ' / text: ' + b['text'] if b.get('text') else '', ' / sound: ' + b['sound'] if b.get('sound') else ''))
        out.append('')
    if rp['hooks']:
        out += ['## Hook options (patterns/hooks.json)', ''] + ['- **%s** (%s): %s Frame 0: %s' % (h['label'], h['id'], h.get('use_when', ''), h.get('frame0', '')) for h in rp['hooks']] + ['']
    s = rp['sound']
    out += ['## Sound', '', '- shape: ' + (', '.join('%s %s' % (k, v) for k, v in s['shape'].items()) or 'none set'), '- beds: ' + (', '.join('`%s`' % b for b in s['beds']) or 'pick one (music/manifest.json)'),
            '- end: ' + (' or '.join(s['end_shapes']) or 'any'), '']
    if rp.get('post'):
        out += ['## Post', '', '- ' + rp['post'].get('pattern', ''), '']
    out += ['## Honesty checklist', ''] + ['- [ ] ' + h for h in rp['honesty']] + ['']
    return '\n'.join(out)


def cmd_brief(a):
    pb = L.playbook_dir(a.playbook)
    formats, rules = L.load_formats(pb), L.rules_by_id(pb)
    if not formats:
        print('mp brief: no formats in %s/formats yet' % pb, file=sys.stderr)
        return 2
    src = a.brief
    text = open(src, encoding='utf-8').read() if os.path.isfile(src) else src
    ranked = classify(text, formats, a.goal, a.platform, a.length)
    if a.format:
        if a.format not in formats:
            print('mp brief: no format %s (formats: %s)' % (a.format, ', '.join(formats)), file=sys.stderr)
            return 2
        fid = a.format
    else:
        qs = questions(ranked, formats, a.goal, a.platform)
        if qs and not a.pick_top:
            print('mp brief: %s: %s' % ('no format clearly matches the brief' if ranked[0][0] <= 0 else 'the brief fits more than one format', ', '.join('%s (%g)' % (r[1], r[0]) for r in ranked[:3])))
            for i, q in enumerate(qs, 1):
                print('  %d. %s' % (i, q))
            print('answer with the flags above and run it again, or take the top pick with --pick-top')
            return 3
        fid = ranked[0][1]
    fm = formats[fid]
    length = a.length or round(sum(fm['length_s']) / 2)
    aspect = a.aspect or fm['lead_aspect']
    out = os.path.abspath(a.out or '.')
    os.makedirs(out, exist_ok=True)
    rp = research_pack(fm, rules, ranked, length, aspect, a.platform, src if os.path.isfile(src) else 'one-line idea: ' + src[:200])
    with open(os.path.join(out, 'research-pack.json'), 'w', encoding='utf-8') as f:
        json.dump(rp, f, indent=1, ensure_ascii=False)
        f.write('\n')
    with open(os.path.join(out, 'research-pack.md'), 'w', encoding='utf-8') as f:
        f.write(pack_md(rp))
    cmd = ['node', os.path.join(HERE, 'playbook_plan.mjs'), fid, '--length', str(length), '--aspect', aspect, '--research', 'research-pack.json',
           '--out', os.path.join(out, 'plan.json'), '--project-out', os.path.join(out, 'project.json'), '--playbook', pb]
    if a.platform:
        cmd += ['--platform', a.platform]
    if getattr(a, 'style', None):
        cmd += ['--style', a.style]   # mp plan lays the named style over the format (playbook/styles)
    if getattr(a, 'template', None):
        cmd += ['--template', a.template]   # the format's beats and rules on another template (a hero style on style-scene)
    if os.path.isfile(src):
        cmd += ['--brief', os.path.abspath(src)]
    print('format %s (%s): %s' % (fid, rp['format']['score'], '; '.join(rp['format']['why'])))
    print('wrote %s and research-pack.md' % os.path.join(out, 'research-pack.json'), flush=True)
    return subprocess.run(cmd, cwd=out).returncode


# ---------------------------------------------------------------- study

def study_ctx(st, plan=None, plan_path=None, aspect=None, fm=None):
    """a lint context from a refstudy study.json: ears-shaped blocks for the checks that read ears (quiet shape, loudness, hits)"""
    q = st.get('quiet') or {}
    au = st.get('audio') or {}
    ears = {'ears/structure': {'status': 'n/a', 'measured': {'quiet_shape': q}},
            'ears/loudness': {'status': 'n/a', 'measured': {'integrated_lufs': (st.get('loudness') or {}).get('integrated_lufs'), 'true_peak_dbtp': (st.get('loudness') or {}).get('peak_dbfs')}},
            'ears/sync': {'status': 'n/a', 'measured': {'hits': sorted(au.get('hits_top10pct') or []), 'first_audible_frame': None}}}
    dur = q.get('duration_s') or (st.get('meta') or {}).get('duration')
    return K.Ctx(plan, ears, None, {'duration': dur}, aspect, fm, plan_path, study=st)


METRICS = (('lufs', lambda s, p: (s.get('loudness') or {}).get('integrated_lufs'), 0.8, 'LU', ('', 'master to %g LUFS-I (the house target, not the reference\'s level)')),
           ('quiet_open_db', lambda s, p: (s.get('quiet') or {}).get('open_2s_vs_body_db'), 3.0, 'dB', ('the open is quieter than the exemplar\'s: let a word or the bed through', 'open quieter: the bed comes in after 1-2 s')),
           ('quiet_tail_db', lambda s, p: (s.get('quiet') or {}).get('tail_2s_vs_body_db'), 4.0, 'dB', ('', 'end on a quiet hold under the end card')),
           ('cuts_per_min', lambda s, p: (s.get('edit') or {}).get('cuts_per_min'), 6.0, '/min', ('cut less often', 'cut more often (shorter shots)')),
           ('bass_entry_pct', lambda s, p: ((p or {}).get('audio') or {}).get('bass_entry_s', None) and p['audio']['bass_entry_s'] / float(p.get('seconds') or 1), 0.08, '', ('let the bass enter later', 'let the bass enter earlier')),
           ('end_shape', lambda s, p: (s.get('quiet') or {}).get('end_shape'), None, '', ('', 'change the ending shape')))
QUIET_FLOOR_DB = -20.0   # an open or a tail this far under the body reads as silence: -30 and -60 are the same choice


SHAPES = {'quiet-hold': {'quiet hold', 'decay', 'quiet-hold'}, 'sting': {'slam', 'sustained sub', 'sting'}, 'slam': {'slam', 'sting'}}


def gaps(st, plan, fm):
    """-> [{metric, ours, exemplar, label, verdict, fix}] against the exemplar nearest in length. Pure."""
    ex = sorted(fm.get('exemplars') or [], key=lambda e: abs(e.get('length_s', 0) - ((st.get('quiet') or {}).get('duration_s') or 0)))
    if not ex:
        return []
    e = ex[0]
    out = []
    house = (fm.get('sound_shape') or {}).get('master_lufs')
    for key, get, tol, unit, (fix_low, fix_high) in METRICS:
        want, ours = e.get(key), get(st, plan)
        if key == 'lufs' and house is not None:
            want = house                                 # rule delivery.master_house_not_reference: compare with the house master, never the reference's level
        if want is None:
            continue
        if ours is None:
            out.append({'metric': key, 'ours': None, 'exemplar': want, 'label': e['label'], 'verdict': 'unknown', 'fix': 'not measured'})
            continue
        if key == 'end_shape':
            ok = SHAPES.get(str(want), {str(want)}) >= {str(ours)} or str(ours) == str(want)
        elif key in ('quiet_open_db', 'quiet_tail_db') and ours <= QUIET_FLOOR_DB and want <= QUIET_FLOOR_DB:
            ok = True                                    # both read as silence
        elif key == 'quiet_tail_db':
            ok = ours <= want + tol                     # a deeper quiet tail is still a quiet tail
        else:
            ok = abs(ours - want) <= tol
        fix = '' if ok else (fix_low if isinstance(ours, (int, float)) and isinstance(want, (int, float)) and ours < want and fix_low else fix_high)
        if '%g' in fix:
            fix = fix % want
        out.append({'metric': key, 'ours': ours, 'exemplar': want, 'label': e['label'], 'verdict': 'close' if ok else 'gap', 'fix': fix})
    return out


def candidates(st, slug, fm=None):
    """candidate rules from one reference study: brand-free, status candidate, graded from its reach tier. Pure."""
    ev = st.get('evidence') or {}
    tier = ev.get('tier') or 'D'
    grade = 'measured-A' if tier in ('A', 'A-') else 'inferred' if ev.get('boosted') or tier == 'B' else 'measured'
    q, ed, lo = st.get('quiet') or {}, st.get('edit') or {}, st.get('loudness') or {}
    dur = q.get('duration_s') or (st.get('meta') or {}).get('duration') or 0
    tag = re.sub(r'[^a-z0-9]', '', slug.lower())[:16] or 'ref'
    base = {'grade': grade, 'sources': [{'doc': 'study: %s' % slug, 'locator': 'study.json'}], 'status': 'candidate', 'conflicts_with': [],
            'notes': 'candidate from mp study (one reference, tier %s%s): one film is not a pattern; compare with other references before promoting' % (tier, ', boosted-looking' if ev.get('boosted') else '')}
    who = 'one tier-%s reference, %.0f s%s' % (tier, dur, ' (%s)' % fm['id'] if fm else '')
    out = []
    if q.get('open_2s_vs_body_db') is not None:
        v = q['open_2s_vs_body_db']
        out.append(dict(base, id='sound.quiet_open_' + tag, title='Open at %+.0f dB' % v, statement='The first 2 s sit %+.1f dB against the body.' % v,
                        scope={'formats': [fm['id']] if fm else []}, params={'quiet_open_db': [round(v - 2, 1), round(v + 2, 1)], 'quiet_open_s': [1, 2]},
                        evidence='%s: first 2 s %+.1f dB vs the body' % (who, v), enforce={'check': 'lint.sound.quiet_open', 'default': None, 'part': None}))
    if q.get('end_shape'):
        out.append(dict(base, id='sound.end_shape_' + tag, title='End: %s' % q['end_shape'], statement='The film ends on a %s (last 2 s %+.1f dB vs the body).' % (q['end_shape'], q.get('tail_2s_vs_body_db') or 0),
                        params={'tail': 'quiet-hold' if q.get('quiet_tail') else q['end_shape']}, evidence='%s: end shape %s' % (who, q['end_shape']),
                        enforce={'check': 'lint.sound.tail', 'default': None, 'part': None}))
    if lo.get('integrated_lufs') is not None:
        out.append(dict(base, id='delivery.loudness_' + tag, title='Delivered at %.0f LUFS' % lo['integrated_lufs'], statement='The delivered file measures %.1f LUFS-I.' % lo['integrated_lufs'],
                        params={'lufs': lo['integrated_lufs'], 'lufs_tol': 1.0}, evidence='%s: %.1f LUFS-I' % (who, lo['integrated_lufs']), enforce={'check': 'lint.master.loudness', 'default': None, 'part': None}))
    if ed.get('cuts_per_min') is not None:
        out.append(dict(base, id='pacing.cut_cadence_' + tag, title='%.0f cuts a minute' % ed['cuts_per_min'], statement='The edit cuts %.1f times a minute (median shot %.2f s).' % (ed['cuts_per_min'], ed.get('shot_len_median_s') or 0),
                        params={'cuts_per_min': ed['cuts_per_min']}, evidence='%s: %.1f cuts per minute' % (who, ed['cuts_per_min']), enforce={'check': None, 'default': None, 'part': None}))
    if dur:
        out.append(dict(base, id='pacing.length_' + tag, title='%.0f s long' % dur, statement='The film runs %.0f s.' % dur, params={'length_s': [round(dur * 0.9), round(dur * 1.1)]},
                        evidence='%s' % who, enforce={'check': 'lint.pacing.length', 'default': None, 'part': None}))
    return out


def run_refstudy(src, out, whisper):
    os.makedirs(out, exist_ok=True)
    sj = os.path.join(out, 'study.json')
    if not os.path.exists(sj):
        r = subprocess.run([sys.executable, os.path.join(HERE, 'refstudy.py'), src, out, '--whisper', whisper], capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(sj):
            raise RuntimeError('refstudy failed: %s' % (r.stderr or r.stdout).strip()[-300:])
    return json.load(open(sj, encoding='utf-8'))


def cmd_study(a):
    pb = L.playbook_dir(a.playbook)
    formats, rules = L.load_formats(pb), L.rules_by_id(pb)
    src = a.video
    local = os.path.exists(src)
    if src.endswith('.mp4') and os.path.exists(src[:-4] + '.study.json'):   # a study kept next to the render (the tests keep the measurements, not the MP4)
        st = json.load(open(src[:-4] + '.study.json', encoding='utf-8'))
    elif src.endswith('.json') and local:
        st = json.load(open(src, encoding='utf-8'))
    else:
        out = a.out or (src[:-4] + '.study' if local and src.endswith('.mp4') else 'study-' + hashlib.sha1(src.encode()).hexdigest()[:8])
        try:
            st = run_refstudy(src, out, a.whisper)
        except RuntimeError as e:
            print('mp study: %s' % e, file=sys.stderr)
            return 2
    base = src[:-4] if src.endswith('.mp4') else None
    ours = a.ours or (not a.reference and base is not None and os.path.exists(base + '.plan.json'))
    dur = (st.get('quiet') or {}).get('duration_s') or (st.get('meta') or {}).get('duration')
    fid = a.format or L.closest_format(formats, dur)
    fm = formats.get(fid) if fid else None
    print('study: %.1f s, %s LUFS-I, quiet open %s dB, end %s; closest format %s' % (dur or 0, (st.get('loudness') or {}).get('integrated_lufs'), (st.get('quiet') or {}).get('open_2s_vs_body_db'),
                                                                                    (st.get('quiet') or {}).get('end_shape'), fid or 'none'))
    if ours:
        res = None
        if base and (os.path.exists(base + '.mp4') or os.path.exists(base + '.ears.json')):
            plan, plan_path, ears, eyes, pr, aspect = PL.load_target(base + '.mp4', not a.no_measure)
            ins = PL.find_inputs(base + '.mp4', plan)
            ins['study'] = st
            ctx = K.Ctx(plan, PL._by_id(ears), PL._by_id(eyes), pr, aspect, fm, plan_path, **ins)
        else:
            plan, ctx = None, study_ctx(st, fm=fm)
        res = PL.lint(ctx, rules, fm, not rules)
        print(PL.table(res))
        g = gaps(st, plan, fm) if fm else []
        if g:
            print('\ngaps against the closest exemplar (%s):' % g[0]['label'])
            for x in g:
                print('  %-15s ours %-10s exemplar %-10s %-7s %s' % (x['metric'], x['ours'], x['exemplar'], x['verdict'], x['fix']))
        elif fm:
            print('\nthe format has no exemplars yet: compared with its rules only')
        return 1 if res['counts']['FAIL'] else 0
    slug = a.slug or 'ref-' + hashlib.sha1(src.encode()).hexdigest()[:8]
    if not re.match(r'^[a-z0-9][a-z0-9-]*$', slug):
        print('mp study: --slug must be lower-case letters, digits and hyphens (and never the account name)', file=sys.stderr)
        return 2
    cands = candidates(st, slug, fm)
    if fm:
        res = PL.lint(study_ctx(st, fm=fm), rules, fm, False)
        kept = [r['rule'] for r in res['rows'] if r['verdict'] == 'PASS']
        broke = [r['rule'] for r in res['rows'] if r['verdict'] in ('FAIL', 'WARN')]
        print('against %s: keeps %s; breaks %s' % (fid, ', '.join(kept) or '-', ', '.join(broke) or '-'))
    m = re.match(r'(\w{3}) (\w{3}) (\d{1,2}) .* (\d{4})$', str((st.get('meta') or {}).get('date') or ''))
    day = datetime.datetime.strptime('%s %s %s' % (m.group(4), m.group(2), m.group(3)), '%Y %b %d').date() if m else datetime.date.today()
    inbox = os.path.join(pb, 'inbox')
    os.makedirs(inbox, exist_ok=True)
    path, n = os.path.join(inbox, '%s-%s.json' % (day.isoformat(), slug)), 2
    while os.path.exists(path):
        path, n = os.path.join(inbox, '%s-%s-%d.json' % (day.isoformat(), slug, n)), n + 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cands, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('%d candidate rules -> %s (grade %s; status candidate)' % (len(cands), os.path.relpath(path), cands[0]['grade'] if cands else '-'))
    print('next: compare with other references, then mp rules promote %s --id <candidate> --as <area.name> [--grade G]' % os.path.basename(path))
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(prog='mp', description=__doc__.split('\n\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('brief')
    b.add_argument('brief')
    b.add_argument('--goal', choices=GOALS)
    b.add_argument('--platform')
    b.add_argument('--format')
    b.add_argument('--length', type=float)
    b.add_argument('--aspect', choices=['16:9', '9:16', '1:1', '4:5'])
    b.add_argument('--out')
    b.add_argument('--pick-top', action='store_true')
    b.add_argument('--style', help='a named style (mp styles) laid over the chosen format by mp plan')
    b.add_argument('--template', help='plan the format on this template instead of its own (a hero style: style-scene)')
    b.add_argument('--playbook')
    s = sub.add_parser('study')
    s.add_argument('video')
    s.add_argument('--format')
    s.add_argument('--ours', action='store_true')
    s.add_argument('--reference', action='store_true')
    s.add_argument('--slug')
    s.add_argument('--out')
    s.add_argument('--whisper', default='none')
    s.add_argument('--no-measure', action='store_true')
    s.add_argument('--playbook')
    a = ap.parse_args(argv)
    return cmd_brief(a) if a.cmd == 'brief' else cmd_study(a)


if __name__ == '__main__':
    sys.exit(main())
