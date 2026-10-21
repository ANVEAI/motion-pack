#!/usr/bin/env python3
"""motion-pack / tools / structure_check.py: score a template's out/plan.json against a beat-sheet pattern (patterns/structures.json) and print fixes.

    python3 tools/structure_check.py templates/ad/out/plan.json                 # pattern picked from the plan's template + length
    python3 tools/structure_check.py templates/ad/out/plan.json --pattern ad-30 # force a pattern
    python3 tools/structure_check.py --all                                      # every genre template's committed plan; table + reasons
    python3 tools/structure_check.py plan.json --json                           # machine-readable report
    python3 tools/structure_check.py --list                                     # the patterns and what they apply to

WHAT IT SCORES (each 0..1, weighted into 0..100; weights live in patterns/structures.json "weights"):
  timing   every required section of the pattern is found in the plan (by name or alias), in order, and starts/ends within the pattern's
           tolerance (percent of runtime). Drift up to `tolerance_pct` scores 1, falling to 0 at 3x the tolerance; a missing section scores 0.
  pace     cut films: ASL (runtime / shots) inside the pattern's `asl_s` range, and per section where the section sets its own range.
           Continuous films (no cuts: plan.audio.mode "continuous", or every shot a camera move): the mean gap between motion events
           (plan.audio.events) against `change_every_s_max` instead, because a one-camera film has no shots to average.
  text     every on-screen text (plan.texts, shots[].text + textDur, captions, story.captions, words) reads at or under the section's
           words-per-second ceiling and the characters-per-second ceiling (structures.json "text"), and stays on screen at least the floor:
           max(min_s, per_word_s x words), or `one_word_frames` for a one-word slam. Captions that follow speech are left to ears and the caption rules.
  hook     frame 0 is not a logo, title card, black or dip shot; when the pattern needs hook text, text is up by `hook.text_by_s` with at most
           `hook.max_words` words; the first sound lands by frame 3 OR the plan marks a quiet open (plan.audio.quiet kind open, <= 2 s).
           Frame-0 MOTION (first visible change by frame 6) is measured from the MP4 by eyes/frame0, not here.
  cta      the call-to-action / end-card section starts inside the pattern's `cta.start_pct` window and holds at least `cta.min_hold_s`.

WHERE SECTIONS COME FROM (first that exists): plan.structure.sections [{name, t: [a, b]}] (explicit, opt-in), plan.story.sections (frames, from
cutgen story shapes), then the shots grouped by label: shots[].sec, a string shots[].beat, else the shot id without its suffix ("problem0" ->
"problem", "chapter-b" -> "chapter"). Contiguous shots with one label make one section.

It reads plans only (no browser, no render, stdlib only). The pattern numbers are tunable defaults with evidence grades; the reasoning and sources
are in docs/evidence/launch-video-patterns.md. A low score is a prompt to look, not a verdict on taste.
Exit: 0 = score >= --min (default: the pattern's pass_score), 1 = below, 2 = usage / unreadable plan / unknown pattern."""
import argparse
import glob
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PATTERNS = os.path.join(REPO, 'patterns', 'structures.json')
LOGO_LABELS = {'logo', 'bumper', 'ident', 'black', 'slate', 'leader', 'titlecard', 'title_card'}


def load_patterns(path=PATTERNS):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------- plan -> timeline

def _label(s):
    if isinstance(s.get('sec'), str) and s['sec']:
        return s['sec'].lower()
    if isinstance(s.get('beat'), str) and s['beat']:
        return s['beat'].lower()
    sid = str(s.get('id') or 'shot').lower()
    sid = re.sub(r'[-_][a-z0-9]{1,2}$', '', sid)      # chapter-b, face-p, hook_1
    m = re.match(r'^([a-z][a-z_-]{2,}?)\d+[a-z]?$', sid)   # problem0, proof1 (never h2h: the stem must be >= 3 letters)
    if m:
        sid = m.group(1)
    return sid or 'shot'


def _frames_or_seconds(vals, seconds):
    """a list of times that exceed the runtime is in frames (the multi-voice-doc supers and overlays)"""
    return any(v is not None and v > seconds + 1 for v in vals)


def timeline(plan):
    """normalise the template plan shapes the pack ships into one timeline:
    {T, fps, shots: [{start, end, label, text, hold, tx}], sections: [{name, a, b, shots}], texts: [{text, a, b, src}], cues: [t], quiet: [...],
     events: [t], continuous: bool, first_label}"""
    T = float(plan.get('seconds') or 0)
    fps = float(plan.get('fps') or 30)
    story = plan.get('story') if isinstance(plan.get('story'), dict) else None
    if not T and story and story.get('frames'):
        T = story['frames'] / fps
    shots = []
    for s in plan.get('shots') or []:
        if s.get('start') is None or not s.get('dur'):
            continue
        a = float(s['start'])
        shots.append({'start': a, 'end': a + float(s['dur']), 'label': _label(s), 'id': s.get('id'), 'kind': str(s.get('kind') or '').lower(),
                      'text': s.get('text') if isinstance(s.get('text'), str) else '', 'textDur': s.get('textDur'), 'hold': bool(s.get('hold')),
                      'tx': str(s.get('tx') or s.get('transition') or ''), 'move': s.get('move')})
    shots.sort(key=lambda x: x['start'])
    audio = plan.get('audio') if isinstance(plan.get('audio'), dict) else {}
    continuous = audio.get('mode') == 'continuous' or bool(shots and all(x['move'] and not x['tx'] for x in shots)) or (not shots and bool(story))

    sections = []
    st = plan.get('structure') if isinstance(plan.get('structure'), dict) else None
    if st and st.get('sections'):
        for x in st['sections']:
            t = x.get('t') or [x.get('start'), x.get('end')]
            sections.append({'name': str(x['name']).lower(), 'a': float(t[0]), 'b': float(t[1])})
    elif story and story.get('sections'):
        for x in story['sections']:
            if x.get('role') == 'gap':           # a sound shape laid over the problem beats, not a picture section
                continue
            sections.append({'name': str(x['role']).lower(), 'a': x['start'] / fps, 'b': x['end'] / fps})
    else:
        for s in shots:
            if sections and sections[-1]['name'] == s['label'] and abs(sections[-1]['b'] - s['start']) < 1e-3:
                sections[-1]['b'] = s['end']
                sections[-1]['shots'] += 1
            else:
                sections.append({'name': s['label'], 'a': s['start'], 'b': s['end'], 'shots': 1})
    for x in sections:
        x.setdefault('shots', sum(1 for s in shots if s['start'] >= x['a'] - 1e-3 and s['start'] < x['b'] - 1e-3))

    texts = []
    for i, x in enumerate(plan.get('texts') or (plan.get('eyes') or {}).get('texts') or []):
        t = x.get('t')
        if not t:
            a = x.get('start', x.get('at'))
            b = x.get('end', (a + x['dur']) if a is not None and x.get('dur') is not None else None)
            t = [a, b] if a is not None and b is not None else None
        if t and len(t) == 2 and str(x.get('text', '')).strip():
            texts.append({'text': str(x['text']), 'a': float(t[0]), 'b': float(t[1]), 'src': 'plan.texts', 'role': (x.get('role') or 'read').lower()})
    if not texts:
        for s in shots:
            if s['text'].strip():
                d = float(s['textDur'] or (s['end'] - s['start']))
                texts.append({'text': s['text'], 'a': s['start'], 'b': s['start'] + d, 'src': 'shots[].text', 'role': 'read'})
        for c in plan.get('captions') or []:
            if isinstance(c, dict) and isinstance(c.get('words'), list) and c.get('start') is not None and c.get('end') is not None:
                texts.append({'text': ' '.join(str(w.get('w', '')) for w in c['words']), 'a': float(c['start']), 'b': float(c['end']), 'src': 'captions[]', 'role': 'caption'})
        if story:
            for c in story.get('captions') or []:
                a = c.get('in_s')
                b = c.get('out_s') if c.get('out_s') is not None else T
                if a is not None and str(c.get('text', '')).strip():
                    texts.append({'text': str(c['text']), 'a': float(a), 'b': float(b), 'src': 'story.captions', 'role': str(c.get('role') or 'read')})
        for st in plan.get('stages') or []:
            d = st.get('data') if isinstance(st.get('data'), dict) else {}
            a = st.get('at', st.get('t0'))
            b = st.get('until')
            if a is None or b is None:
                continue
            for f in ('text', 'title', 'brand', 'line', 'url'):
                if isinstance(d.get(f), str) and d[f].strip():
                    texts.append({'text': d[f], 'a': float(a), 'b': float(b), 'src': 'stages[].data.' + f, 'role': 'read'})
        for w in plan.get('words') or []:
            if isinstance(w, dict) and w.get('text') and w.get('t') is not None:
                texts.append({'text': str(w['text']), 'a': float(w['t']), 'b': float(w['t']) + float(w.get('dur') or 0.5), 'src': 'words[]', 'role': 'read'})
        sup = plan.get('supers') or []
        if sup and isinstance(sup[0], dict) and 'at' in sup[0]:
            fr = _frames_or_seconds([x.get('at') for x in sup], T)
            k = 1 / fps if fr else 1
            for x in sup:
                line = ' '.join(str(x.get(f)) for f in ('name', 'role') if x.get(f))
                if line:
                    texts.append({'text': line, 'a': x['at'] * k, 'b': (x['at'] + x.get('dur', 0)) * k, 'src': 'supers[]', 'role': 'lowerthird'})
        ov = [x for x in plan.get('overlays') or [] if isinstance(x, dict) and x.get('line') and x.get('start') is not None]
        if ov:
            k = 1 / fps if _frames_or_seconds([x['start'] for x in ov] + [x.get('end') for x in ov], T) else 1
            for x in ov:
                texts.append({'text': str(x['line']), 'a': x['start'] * k, 'b': x['end'] * k, 'src': 'overlays[]', 'role': 'read'})
    for t in texts:
        t['text'] = re.sub(r'<[^>]+>|\*', '', t['text']).strip()

    cues = []
    for c in plan.get('cues') or []:
        if isinstance(c, dict) and c.get('t') is not None:
            cues.append(float(c['t']))
    if story:
        for c in story.get('sfx') or []:
            if c.get('visual_frame') is not None:
                cues.append(c['visual_frame'] / fps)
    # the bed, the voice and the plan's own audio segments are sound too, not only cues
    if isinstance(plan.get('music'), str) and plan['music'] and float(plan.get('fadeInMs') or 0) <= 100:
        cues.append(0.0)
    tr = plan.get('transcript')
    if isinstance(tr, list) and tr and isinstance(tr[0], dict) and tr[0].get('s') is not None:
        cues.append(float(tr[0]['s']))
    segs = plan.get('audio') if isinstance(plan.get('audio'), list) else []
    if segs and isinstance(segs[0], dict) and segs[0].get('start') is not None:
        st0 = [x.get('start') for x in segs if isinstance(x, dict) and x.get('start') is not None]
        k = 1 / fps if _frames_or_seconds(st0 + [x.get('end') for x in segs if isinstance(x, dict)], T) else 1
        cues.append(min(st0) * k)
    events = [float(e) for e in (audio.get('events') or [])]
    if continuous and not events:
        events = sorted({s['start'] for s in shots})
    first_label = sections[0]['name'] if sections else (shots[0]['label'] if shots else '')
    return {'T': T, 'fps': fps, 'shots': shots, 'sections': sections, 'texts': texts, 'cues': sorted(cues), 'quiet': audio.get('quiet') or [],
            'events': sorted(events), 'continuous': continuous, 'first_label': first_label, 'first_shot': shots[0] if shots else None,
            'template': plan.get('template')}


# ---------------------------------------------------------------- matching

def pick_pattern(plan, P, forced=None):
    """-> (pattern id or None, why)"""
    if forced:
        if forced not in P['structures']:
            raise KeyError(forced)
        return forced, 'forced with --pattern'
    st = plan.get('structure') if isinstance(plan.get('structure'), dict) else {}
    if st.get('pattern'):
        return st['pattern'], 'plan.structure.pattern'
    tpl = plan.get('template')
    T = float(plan.get('seconds') or 0)
    rule = P.get('template_map', {}).get(tpl)
    if rule is None:
        return None, 'template %r has no pattern in patterns/structures.json template_map: pass --pattern' % tpl
    if isinstance(rule, dict):
        rule = [rule]
    for r in rule:
        lo, hi = r.get('seconds', [0, 1e9])
        if lo <= T <= hi:
            return r.get('pattern'), r.get('why') or 'template_map'
    return None, 'template %r at %.1f s: no template_map rule covers that length' % (tpl, T)


def _norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


def match_sections(tl, pat):
    """for each pattern section, the plan section(s) it covers: every plan section whose name is the pattern name or an alias.
    Several plan sections with one name (problem, problem) merge into their span."""
    out = []
    for ps in pat['sections']:
        names = {_norm(ps['name'])} | {_norm(a) for a in ps.get('aliases', [])}
        hits = [s for s in tl['sections'] if _norm(s['name']) in names]
        if hits:
            a, b = min(h['a'] for h in hits), max(h['b'] for h in hits)
            out.append((ps, {'a': a, 'b': b, 'shots': sum(h.get('shots', 0) for h in hits), 'names': sorted({h['name'] for h in hits})}))
        else:
            out.append((ps, None))
    return out


def _falloff(err, tol):
    """1 inside the tolerance, linear to 0 at 3x the tolerance"""
    if err <= tol:
        return 1.0
    return max(0.0, 1.0 - (err - tol) / (2.0 * tol))


def _range_err(v, lo, hi):
    return 0.0 if lo <= v <= hi else (lo - v if v < lo else v - hi)


def _words(text):
    return len([w for w in re.split(r'\s+', text) if re.search(r'[A-Za-z0-9]', w)])


# ---------------------------------------------------------------- checks

def check_timing(tl, pat, fixes):
    T = tl['T']
    tol = pat.get('tolerance_pct', 8)
    m = match_sections(tl, pat)
    scores, rows, last_a = [], [], -1
    for ps, hit in m:
        req = ps.get('required', True)
        if hit is None:
            if req:
                scores.append(0.0)
                fixes.append('timing: no "%s" section (aliases: %s). Add a beat named "%s" at %d-%d%% of the runtime (%.1f-%.1f s).'
                             % (ps['name'], ', '.join(ps.get('aliases', [])) or '-', ps['name'], ps['start'], ps['end'], T * ps['start'] / 100, T * ps['end'] / 100))
            rows.append({'section': ps['name'], 'found': False, 'required': req})
            continue
        a_pct, b_pct = 100 * hit['a'] / T, 100 * hit['b'] / T
        drift = max(abs(a_pct - ps['start']), abs(b_pct - ps['end']))
        sc = _falloff(drift, tol)
        if hit['a'] < last_a - 1e-6:
            sc *= 0.5
            fixes.append('timing: "%s" comes before the section the pattern puts ahead of it; reorder the beats.' % ps['name'])
        last_a = max(last_a, hit['a'])
        scores.append(sc)
        rows.append({'section': ps['name'], 'found': True, 'plan_names': hit['names'], 'start_pct': round(a_pct, 1), 'end_pct': round(b_pct, 1),
                     'pattern': [ps['start'], ps['end']], 'drift_pct': round(drift, 1), 'score': round(sc, 2)})
        if drift > tol:
            fixes.append('timing: "%s" runs %.0f-%.0f%% (%.1f-%.1f s); the pattern puts it at %d-%d%% (%.1f-%.1f s), tolerance %d%%.'
                         % (ps['name'], a_pct, b_pct, hit['a'], hit['b'], ps['start'], ps['end'], T * ps['start'] / 100, T * ps['end'] / 100, tol))
    lo, hi = pat.get('length_s', [0, 1e9])
    if not (lo <= T <= hi):
        fixes.append('timing: runtime %.1f s is outside the pattern length %s-%s s (patterns/lengths.json has the per-platform limits).' % (T, lo, hi))
        scores.append(_falloff(_range_err(T, lo, hi) / max(hi, 1) * 100, 10))
    return (sum(scores) / len(scores) if scores else 0.0), {'sections': rows}


def check_pace(tl, pat, fixes):
    T = tl['T']
    if tl['continuous']:
        ev = tl['events']
        cap = pat.get('change_every_s_max', 3.5)
        if len(ev) < 2:
            fixes.append('pace: a continuous film needs plan.audio.events (one per motion event) so the change rate can be read.')
            return 0.5, {'mode': 'continuous', 'events': len(ev)}
        gaps = [b - a for a, b in zip(ev, ev[1:])] + [T - ev[-1]]
        holds = [q for q in tl['quiet'] if isinstance(q, dict) and q.get('kind') == 'hold']
        long = [(ev[i], g) for i, g in enumerate(gaps) if g > cap and not any(q['t'][0] - 0.5 <= ev[i] + g / 2 <= q['t'][1] + 0.5 for q in holds)]
        mean = sum(gaps) / len(gaps)
        sc = max(0.0, 1.0 - sum((g - cap) / cap for _, g in long))
        for t, g in long[:4]:
            fixes.append('pace: no motion event for %.1f s from %.1f s (continuous film; ceiling %.1f s). Add one (a camera beat, a value landing) or mark the stretch as a hold.' % (g, t, cap))
        return sc, {'mode': 'continuous', 'mean_change_s': round(mean, 2), 'over_ceiling': len(long)}
    n = len(tl['shots'])
    if not n:
        fixes.append('pace: the plan has no shots with start + dur.')
        return 0.0, {'mode': 'cut', 'shots': 0}
    asl = T / n
    lo, hi = pat['asl_s']
    err = _range_err(asl, lo, hi)
    sc = _falloff(err / max(hi, 0.1) * 100, 15)
    if err:
        want = (lo + hi) / 2
        fixes.append('pace: ASL %.2f s (%d shots in %.1f s); the pattern wants %.1f-%.1f s, about %d shots. %s'
                     % (asl, n, T, lo, hi, round(T / want), 'Split long shots or add inserts.' if asl > hi else 'Merge shots or hold the hero longer.'))
    sec_rows = []
    sub = []
    for ps, hit in match_sections(tl, pat):
        if hit is None or not ps.get('asl_s') or not hit['shots']:
            continue
        s_asl = (hit['b'] - hit['a']) / hit['shots']
        e = _range_err(s_asl, *ps['asl_s'])
        ss = _falloff(e / max(ps['asl_s'][1], 0.1) * 100, 25)
        sub.append(ss)
        sec_rows.append({'section': ps['name'], 'asl': round(s_asl, 2), 'pattern': ps['asl_s'], 'score': round(ss, 2)})
        if e and ss < 1:
            fixes.append('pace: "%s" ASL %.2f s vs %.1f-%.1f s for that beat.' % (ps['name'], s_asl, ps['asl_s'][0], ps['asl_s'][1]))
    if sub:
        sc = 0.6 * sc + 0.4 * (sum(sub) / len(sub))
    return sc, {'mode': 'cut', 'shots': n, 'asl': round(asl, 2), 'pattern': [lo, hi], 'sections': sec_rows}


def _section_at(tl, pat, t):
    m = match_sections(tl, pat)
    for ps, hit in m:
        if hit and hit['a'] - 1e-3 <= t < hit['b'] - 1e-3:
            return ps
    return None


def check_text(tl, pat, fixes):
    texts = tl['texts']
    tc = pat.get('_text', {})
    cps_max = pat.get('text_cps_max', tc.get('cps_max', 17))
    fl = tc.get('floor', {})
    min_s, per_word, one_word_frames = fl.get('min_s', 0.833), fl.get('per_word_s', 0.3), fl.get('one_word_frames', 9)
    if not texts:
        return 1.0, {'texts': 0, 'note': 'no on-screen text in the plan'}
    bad, rows = 0, []
    for t in texts:
        d = max(t['b'] - t['a'], 1e-3)
        w = _words(t['text'])
        ps = _section_at(tl, pat, t['a'])
        wps_max = (ps or {}).get('text_wps_max', pat.get('text_wps_max', 3.0))
        if t['role'] in ('caption',):         # captions follow speech; their rate is the voice's, judged by ears / the caption rules
            continue
        wps, cps = w / d, len(t['text']) / d
        floor = one_word_frames / tl['fps'] if w <= 1 else max(min_s, per_word * w)
        ok = wps <= wps_max + 1e-6 and cps <= cps_max + 1e-6 and d >= floor - 1e-6
        rows.append({'text': t['text'][:40], 'at': round(t['a'], 2), 'dur': round(d, 2), 'wps': round(wps, 2), 'cps': round(cps, 1), 'wps_max': wps_max, 'ok': ok})
        if not ok:
            bad += 1
            need = max(w / wps_max, len(t['text']) / cps_max, floor)
            fixes.append('text: "%s" at %.1f s reads at %.1f words/s, %.0f chars/s for %.2f s (ceiling %.1f w/s, %d c/s): hold it %.1f s or cut it to %d words.'
                         % (t['text'][:40], t['a'], wps, cps, d, wps_max, cps_max, need, max(1, int(wps_max * d))))
    n = len(rows)
    return (1.0 - bad / n) if n else 1.0, {'texts': n, 'over_ceiling': bad, 'rows': rows[:30]}


def check_hook(tl, pat, fixes):
    hk = pat.get('hook', {})
    parts = []
    fs = tl['first_shot']
    first = _norm(tl['first_label'] or '')
    kind = _norm((fs or {}).get('kind') or '')
    bumper = first in {_norm(x) for x in LOGO_LABELS} or kind in {_norm(x) for x in LOGO_LABELS} or ('dip' in ((fs or {}).get('tx') or '').lower())
    parts.append(0.0 if bumper else 1.0)
    if bumper:
        fixes.append('hook: frame 0 opens on a %s shot. Open on the hook image already in motion; the logo belongs at the end.' % (fs.get('kind') or tl['first_label']))
    if hk.get('text_required'):
        by = hk.get('text_by_s', 0.3)
        early = [t for t in tl['texts'] if t['a'] <= by + 1e-6]
        if not early:
            parts.append(0.0)
            nxt = min((t['a'] for t in tl['texts']), default=None)
            fixes.append('hook: no hook text by %.1f s (first text %s). Put the hook line up on frame 0-%d.' % (by, ('at %.2f s' % nxt) if nxt is not None else 'never', round(by * tl['fps'])))
        else:
            w = max(_words(t['text']) for t in early)
            mx = hk.get('max_words', 7)
            parts.append(1.0 if w <= mx else 0.5)
            if w > mx:
                fixes.append('hook: the hook text has %d words; keep it to %d.' % (w, mx))
    frame3 = 3.0 / tl['fps']
    sound0 = any(c <= frame3 + 1e-6 for c in tl['cues'])
    quiet_open = any(isinstance(q, dict) and q.get('kind') == 'open' and q.get('t') and q['t'][0] <= frame3 and (q['t'][1] - q['t'][0]) <= 2.0 + 1e-6 for q in tl['quiet'])
    if hk.get('sound_rule', True):
        parts.append(1.0 if (sound0 or quiet_open) else 0.0)
        if not (sound0 or quiet_open):
            first_c = tl['cues'][0] if tl['cues'] else None
            fixes.append('hook: first sound %s. Put a cue on frames 0-3, or mark a planned quiet open (plan.audio.quiet kind "open", <= 2 s) ending on the first visual event.'
                         % (('at %.2f s' % first_c) if first_c is not None else 'never cued'))
    return sum(parts) / len(parts), {'bumper': bumper, 'sound_on_frame_0_3': sound0, 'quiet_open': quiet_open}


def check_cta(tl, pat, fixes):
    c = pat.get('cta')
    if not c:
        return 1.0, {'note': 'pattern has no CTA'}
    T = tl['T']
    names = {_norm(c['section'])} | {_norm(a) for a in c.get('aliases', [])}
    for ps in pat['sections']:
        if _norm(ps['name']) == _norm(c['section']):
            names |= {_norm(a) for a in ps.get('aliases', [])}
    hits = [s for s in tl['sections'] if _norm(s['name']) in names]
    if not hits:
        fixes.append('cta: no CTA / end-card section (%s). End on one, starting at %d-%d%% of the runtime and held >= %.1f s.'
                     % (', '.join(sorted(names)), c['start_pct'][0], c['start_pct'][1], c.get('min_hold_s', 1.8)))
        return 0.0, {'found': False}
    a, b = hits[-1]['a'], hits[-1]['b']
    a_pct = 100 * a / T
    lo, hi = c['start_pct']
    sc_t = _falloff(_range_err(a_pct, lo, hi), c.get('tolerance_pct', 5))
    hold = b - a
    mh = c.get('min_hold_s', 1.8)
    sc_h = 1.0 if hold >= mh - 1e-6 else max(0.0, hold / mh)
    if sc_t < 1 or _range_err(a_pct, lo, hi) > 0:
        fixes.append('cta: the CTA starts at %.0f%% (%.1f s); the pattern puts it at %d-%d%% (%.1f-%.1f s).' % (a_pct, a, lo, hi, T * lo / 100, T * hi / 100))
    if hold < mh:
        fixes.append('cta: the end card holds %.1f s; hold it >= %.1f s after its motion settles.' % (hold, mh))
    if b < T - 0.5:
        fixes.append('cta: %.1f s of picture after the CTA ends; nothing but the brand belongs after the button.' % (T - b))
        sc_h *= 0.8
    return 0.6 * sc_t + 0.4 * sc_h, {'found': True, 'start_pct': round(a_pct, 1), 'hold_s': round(hold, 2)}


CHECKS = [('timing', check_timing), ('pace', check_pace), ('text', check_text), ('hook', check_hook), ('cta', check_cta)]


def score(plan, P, pattern_id):
    pat = dict(P['structures'][pattern_id], _text=P.get('text', {}))
    tl = timeline(plan)
    if tl['T'] <= 0:
        raise ValueError('plan has no runtime (seconds)')
    W = P.get('weights', {'timing': 30, 'pace': 20, 'text': 15, 'hook': 20, 'cta': 15})
    fixes, parts, detail = [], {}, {}
    for name, fn in CHECKS:
        s, d = fn(tl, pat, fixes)
        parts[name] = round(s, 3)
        detail[name] = d
    total = sum(W[k] * parts[k] for k in parts) / sum(W[k] for k in parts) * 100
    return {'pattern': pattern_id, 'template': tl['template'], 'seconds': round(tl['T'], 2), 'continuous': tl['continuous'], 'score': round(total, 1),
            'pass_score': pat.get('pass_score', P.get('pass_score', 70)), 'parts': parts, 'detail': detail, 'fixes': fixes}


def report_text(r):
    out = ['%s vs %s: %.0f / 100 (pass %d)  [%s]' % (r.get('file') or r['template'], r['pattern'], r['score'], r['pass_score'],
                                                     '  '.join('%s %.2f' % kv for kv in r['parts'].items()))]
    if r['continuous']:
        out.append('  continuous film: pace read from motion events, not shots')
    for f in r['fixes']:
        out.append('  fix: ' + f)
    if not r['fixes']:
        out.append('  no fixes')
    return '\n'.join(out)


def run_all(P, min_score=None):
    rows, worst = [], 0
    for f in sorted(glob.glob(os.path.join(REPO, 'templates', '*', 'out', 'plan*.json'))):
        rel = os.path.relpath(f, REPO)
        tdir = rel.split(os.sep)[1]
        if tdir.startswith('demo-') or tdir.startswith('_'):
            rows.append((rel, None, 'part demo (no genre structure): skipped'))
            continue
        plan = json.load(open(f, encoding='utf-8'))
        pid, why = pick_pattern(plan, P)
        if pid is None:
            rows.append((rel, None, why))
            continue
        r = score(plan, P, pid)
        r['file'] = rel
        rows.append((rel, r, why))
        if r['score'] < (min_score if min_score is not None else r['pass_score']):
            worst = 1
    return rows, worst


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('plan', nargs='?')
    ap.add_argument('--pattern')
    ap.add_argument('--patterns', default=PATTERNS)
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--min', type=float)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args(argv)
    try:
        P = load_patterns(a.patterns)
    except (OSError, ValueError) as e:
        print('cannot read patterns: %s' % e)
        return 2
    if a.list:
        for k, v in P['structures'].items():
            print('%-18s %-6s %s' % (k, '%s-%s s' % tuple(v['length_s']), v['label']))
        for k, v in P.get('template_map', {}).items():
            vv = v if isinstance(v, list) else [v]
            print('  template %-16s -> %s' % (k, ', '.join('%s (%s)' % (x.get('pattern'), x.get('seconds', 'any')) for x in vv)))
        return 0
    if a.all:
        rows, code = run_all(P, a.min)
        if a.json:
            print(json.dumps([{'file': f, 'result': r, 'why': w} for f, r, w in rows], indent=1))
        else:
            for f, r, w in rows:
                if r is None:
                    print('%s: not scored: %s' % (f, w))
                else:
                    print(report_text(r))
                    print('  (pattern from %s)' % w)
        return code
    if not a.plan:
        ap.print_help()
        return 2
    try:
        plan = json.load(open(a.plan, encoding='utf-8'))
    except (OSError, ValueError) as e:
        print('cannot read plan: %s' % e)
        return 2
    try:
        pid, why = pick_pattern(plan, P, a.pattern)
    except KeyError as e:
        print('unknown pattern %s (have: %s)' % (e, ', '.join(P['structures'])))
        return 2
    if pid is None:
        print('no pattern: ' + why)
        return 2
    try:
        r = score(plan, P, pid)
    except ValueError as e:
        print('cannot score: %s' % e)
        return 2
    r['file'] = os.path.relpath(a.plan, REPO) if os.path.abspath(a.plan).startswith(REPO) else a.plan
    print(json.dumps(r, indent=1) if a.json else report_text(r))
    return 0 if r['score'] >= (a.min if a.min is not None else r['pass_score']) else 1


if __name__ == '__main__':
    sys.exit(main())
