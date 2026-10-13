#!/usr/bin/env python3
"""lint_shotlist.py: check a story-script shotlist.json before frame-design and motion-pack read it.

usage: python3 lint_shotlist.py shotlist.json [--strict] [--quiet]

Prints one line per finding (FAIL or WARN) and a summary. Exit codes: 0 = no FAIL (warnings allowed),
1 = at least one FAIL (or any WARN with --strict), 2 = the file cannot be read or is not JSON.

Every threshold below is a HOUSE DEFAULT taken from the motion-pack conventions (type-module reading rules,
the virality checklist, the short-film scale ladder). None is a platform rule. Override per file with a
top-level "lint": {"hook_max_words": 9, ...} object, or edit DEFAULTS.
Standard library only.
"""
import json
import re
import sys

DEFAULTS = {
    'hook_max_words': 7,          # on-screen words in the first shot and in each hook variant
    'poster_max_words': 4,        # words on a hook's poster frame (cover)
    'words_per_sec': 3.5,         # reading-speed ceiling for on-screen text
    'hold_base_s': 0.35,          # minimum hold = max(min_hold_s, hold_base_s + hold_per_word_s * words)
    'hold_per_word_s': 0.28,
    'min_hold_s': 0.5,
    'end_hold_s': 1.8,            # the last shot (end card) holds at least this long
    'same_scale_run': 3,          # no more than this many same-scale shots in a row
    'turn_window': [0.30, 0.80],  # the turn sits between these fractions of the runtime
}
FORMATS = {'ad', 'launch', 'short-film', 'character-spot', 'chat-skit', 'explainer', 'reel'}
SCALES = {'EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'INSERT', 'OTS', 'POV', '2S', 'SCREEN', 'CARD'}
ARCHETYPES = {'payoff-first', 'pattern-break', 'claim-or-question', 'in-medias-res', 'curiosity-gap', 'social-proof', 'problem-agitate'}
TEXT_KINDS = {'super', 'in_world', 'label', 'card'}
SEND_FORMATS = {'reel', 'chat-skit', 'character-spot'}
BAD_OPEN = re.compile(r'\b(black|logo|fade[- ]?in|title card|slate|bumper|blank)\b', re.I)

findings = []


def fail(msg):
    findings.append(('FAIL', msg))


def warn(msg):
    findings.append(('WARN', msg))


def words(s):
    return len([w for w in re.split(r'\s+', (s or '').strip()) if w])


def has_digit(s):
    return bool(re.search(r'\d', s or ''))


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    strict, quiet = '--strict' in argv, '--quiet' in argv
    if not args:
        print(__doc__)
        return 2
    try:
        with open(args[0], encoding='utf-8') as fh:
            doc = json.load(fh)
    except (OSError, ValueError) as e:
        print(f'cannot read {args[0]}: {e}')
        return 2
    if not isinstance(doc, dict):
        print('top level must be a JSON object')
        return 2
    L = dict(DEFAULTS)
    L.update(doc.get('lint') or {})

    # ---- top level ----
    for k in ('title', 'format', 'length_s', 'fps', 'aspect', 'logline', 'stake', 'turn', 'payoff', 'shots', 'hooks'):
        if k not in doc:
            fail(f'missing top-level field "{k}"')
    fmt = doc.get('format')
    if fmt is not None and fmt not in FORMATS:
        warn(f'format "{fmt}" is not one of {sorted(FORMATS)}')
    fps = doc.get('fps') or 30
    length = doc.get('length_s')
    shots = doc.get('shots') or []
    if not isinstance(shots, list) or not shots:
        fail('shots must be a non-empty list')
        shots = []
    if not doc.get('sound_off'):
        warn('no "sound_off" sentence: write "After one watch with the sound off, a viewer can say: ..."')

    # ---- shots ----
    ids, t, run_scale, run_len = set(), 0.0, None, 0
    turn = doc.get('turn') or {}
    turn_at = turn.get('at_s') if isinstance(turn, dict) else None
    claims = doc.get('claims') or []
    sourced = [c.get('text', '') for c in claims if isinstance(c, dict) and c.get('source')]
    banned = [b.lower() for b in (doc.get('banned') or [])]
    for i, s in enumerate(shots):
        sid = s.get('id') or f'#{i + 1}'
        if sid in ids:
            fail(f'{sid}: duplicate id')
        ids.add(sid)
        for k in ('beat', 'dur_s', 'scale', 'action', 'sound'):
            if k not in s or s.get(k) in (None, ''):
                fail(f'{sid}: missing "{k}"')
        dur = s.get('dur_s') or 0
        if not isinstance(dur, (int, float)) or dur <= 0:
            fail(f'{sid}: dur_s must be a positive number')
            dur = 0
        if 'start_s' in s and isinstance(s['start_s'], (int, float)) and abs(s['start_s'] - t) > 0.5 / fps:
            warn(f'{sid}: start_s {s["start_s"]} does not match the running sum {t:.3f}')
        scale = (s.get('scale') or '').upper()
        if scale and scale not in SCALES:
            warn(f'{sid}: scale "{s.get("scale")}" not in {sorted(SCALES)}')
        if scale and scale == run_scale and scale != 'CARD':
            run_len += 1
            if run_len == L['same_scale_run'] + 1:
                warn(f'{sid}: more than {L["same_scale_run"]} "{scale}" shots in a row (break the pattern)')
        else:
            run_scale, run_len = scale, 1
        text = s.get('text') or ''
        kind = s.get('text_kind') or 'super'
        if kind not in TEXT_KINDS:
            warn(f'{sid}: text_kind "{kind}" not in {sorted(TEXT_KINDS)}')
        n = words(text)
        if n and dur:
            need = max(L['min_hold_s'], L['hold_base_s'] + L['hold_per_word_s'] * n)
            if dur + 1e-9 < need:
                warn(f'{sid}: {n} words need at least {need:.2f} s on screen, shot is {dur:.2f} s')
            if n / dur > L['words_per_sec'] + 1e-9:
                warn(f'{sid}: {n / dur:.1f} words/s exceeds {L["words_per_sec"]}')
        if kind in ('super', 'card') and has_digit(text):
            backed = any(text.strip() and (text.strip() in c or c in text) for c in sourced)
            if not backed and not s.get('honesty'):
                fail(f'{sid}: on-screen digits "{text}" need a sourced claim or an honesty label')
        for b in banned:
            if b and b in text.lower():
                fail(f'{sid}: banned word "{b}" in on-screen text')
        tr = s.get('transition') or {}
        if isinstance(tr, dict) and tr.get('kind') not in (None, 'cut') and not tr.get('reason'):
            fail(f'{sid}: transition "{tr.get("kind")}" has no reason (EMOTION, STORY, RHYTHM, ENERGY, REVEAL, PLACE)')
        if fmt != 'ad' and s.get('role') == 'product' and isinstance(turn_at, (int, float)) and t < turn_at - 1e-6:
            warn(f'{sid}: the product appears at {t:.2f} s, before the turn at {turn_at} s: is it pitching?')
        t += dur

    # ---- first and last shot ----
    if shots:
        s0 = shots[0]
        if (s0.get('beat') or '').upper() != 'HOOK':
            warn(f'first shot beat is "{s0.get("beat")}", expected HOOK')
        if BAD_OPEN.search(s0.get('action') or ''):
            fail(f'first shot action "{s0.get("action")}": frame 0 must be the stake in motion, not black, a logo, a fade-in or a title card')
        if words(s0.get('text')) > L['hook_max_words']:
            fail(f'first shot carries {words(s0.get("text"))} words; the hook allows {L["hook_max_words"]}')
        last = shots[-1]
        if (last.get('dur_s') or 0) + 1e-9 < L['end_hold_s'] and (last.get('role') == 'card' or (last.get('beat') or '').upper() in ('CARD', 'END', 'CTA')):
            warn(f'last shot holds {last.get("dur_s")} s; the end card wants at least {L["end_hold_s"]} s')

    # ---- runtime ----
    if isinstance(length, (int, float)) and shots:
        if abs(t - length) > 1.0 / fps + 1e-9:
            fail(f'shots sum to {t:.3f} s but length_s is {length} (tolerance one frame at {fps} fps)')

    # ---- turn and payoff ----
    if isinstance(turn_at, (int, float)) and isinstance(length, (int, float)) and length > 0:
        frac = turn_at / length
        lo, hi = L['turn_window']
        if not (lo <= frac <= hi):
            warn(f'turn at {turn_at} s is {frac:.0%} of the runtime; house window is {lo:.0%}-{hi:.0%}')
        roles = [(s.get('role'), i) for i, s in enumerate(shots)]
        ti = next((i for r, i in roles if r == 'turn'), None)
        pi = next((i for r, i in roles if r == 'payoff'), None)
        if ti is None:
            warn('no shot has role "turn"')
        if pi is None:
            warn('no shot has role "payoff"')
        elif ti is not None and pi < ti:
            fail('the payoff shot comes before the turn')
    elif doc.get('turn') is not None:
        fail('turn must be {"at_s": number, "what": string}')

    # ---- hooks ----
    hooks = doc.get('hooks') or []
    if len(hooks) != 3:
        warn(f'{len(hooks)} hook variants; write three on one body')
    arch = [h.get('archetype') for h in hooks if isinstance(h, dict)]
    for h in hooks:
        a = h.get('archetype')
        if a not in ARCHETYPES:
            fail(f'hook {h.get("id")}: archetype "{a}" not in {sorted(ARCHETYPES)}')
        if words(h.get('text')) > L['hook_max_words']:
            fail(f'hook {h.get("id")}: {words(h.get("text"))} words on screen; max {L["hook_max_words"]}')
        if words(h.get('poster_text')) > L['poster_max_words']:
            fail(f'hook {h.get("id")}: poster has {words(h.get("poster_text"))} words; max {L["poster_max_words"]}')
        if not h.get('frame0'):
            fail(f'hook {h.get("id")}: describe frame 0')
        if a == 'social-proof' and not sourced:
            fail(f'hook {h.get("id")}: social-proof needs a claim with a source')
    if len(set(arch)) < len(arch):
        warn('two hooks share an archetype: that tests wording, not the hook')

    # ---- claims, send line ----
    for c in claims:
        if isinstance(c, dict) and has_digit(c.get('text')) and not c.get('source'):
            fail(f'claim "{c.get("text")}" contains a digit and has no source')
    if fmt in SEND_FORMATS and not doc.get('send_line'):
        warn('no send_line: name the person a viewer would send this to')

    # ---- report ----
    nf = sum(1 for k, _ in findings if k == 'FAIL')
    nw = sum(1 for k, _ in findings if k == 'WARN')
    if not quiet:
        for k, m in findings:
            print(f'{k}  {m}')
    asl = (t / len(shots)) if shots else 0
    print(f'{doc.get("title", "?")}: {len(shots)} shots, {t:.2f} s, ASL {asl:.2f} s | {nf} FAIL, {nw} WARN | '
          + ('FAIL' if nf or (strict and nw) else 'PASS'))
    return 1 if nf or (strict and nw) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
