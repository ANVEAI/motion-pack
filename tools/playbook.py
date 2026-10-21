#!/usr/bin/env python3
"""motion-pack / tools / playbook.py: `mp formats` and `mp rules` (browse the playbook, promote candidates).

    python3 tools/playbook.py formats [--json]                                  # the formats, one line each
    python3 tools/playbook.py rules [--area A] [--status S] [--grade G] [--format F] [--gaps] [--json]
                                                                               # browse the rules; --gaps = prose-only rules (the backlog)
    python3 tools/playbook.py rules promote <inbox.json> [--id CANDIDATE] [--as area.name] [--grade G] [--status S]
                                                                               # publish candidates (mp study writes them) into playbook/rules/<area>.json
Every command takes --playbook DIR (default playbook/, or MP_PLAYBOOK). Promote never deletes: the candidate stays in its inbox file with
promoted_to set, and the rule is appended to its area file. Run python3 tools/playbook_build.py afterwards (it validates and regenerates the index).
Exit 0 ok, 1 nothing matched or a refused promote, 2 usage."""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import playbook_lib as L  # noqa: E402


def cmd_formats(a):
    fm = L.load_formats(L.playbook_dir(a.playbook))
    if a.json:
        print(json.dumps([{k: v for k, v in f.items() if k != '_file'} for f in fm.values()], indent=1))
        return 0
    if not fm:
        print('no formats yet in %s/formats (the playbook-rules branch adds them; tests use tools/tests/fixtures/playbook)' % os.path.relpath(L.playbook_dir(a.playbook)))
        return 1
    for fid, f in sorted(fm.items()):
        print('%-18s %5s s  %-12s %-26s %s' % (fid, '%g-%g' % tuple(f['length_s']), ' '.join(f.get('aspects', [])), f.get('template', ''), f.get('use_when', '')[:90]))
    print('next: mp brief "<idea>"   or   mp plan <format> --length N --aspect A')
    return 0


def select(rules, a, fm=None):
    out = []
    keep = set(L.format_rule_ids(fm)) if fm else None
    for r in rules:
        if a.area and not r['id'].startswith(a.area + '.'):
            continue
        if a.status and r.get('status') != a.status:
            continue
        if a.gaps and r.get('status') != 'prose-only':
            continue
        if a.grade and r.get('grade') != a.grade:
            continue
        if keep is not None and r['id'] not in keep:
            continue
        out.append(r)
    return out


def cmd_rules(a):
    pb = L.playbook_dir(a.playbook)
    rules = [r for _, r in L.load_rules(pb)]
    fm = None
    if a.format:
        fm = L.load_formats(pb).get(a.format)
        if not fm:
            print('mp rules: no format %s' % a.format, file=sys.stderr)
            return 2
    sel = select(rules, a, fm)
    if a.json:
        print(json.dumps(sel, indent=1))
        return 0 if sel else 1
    for r in sel:
        en = r.get('enforce') or {}
        how = en.get('check') or en.get('default') or en.get('part') or '-'
        print('%-34s %-10s %-10s %-28s %s' % (r['id'], r.get('grade'), r.get('status'), how, r.get('title', '')))
    print('%d rule%s%s' % (len(sel), '' if len(sel) == 1 else 's', ' (prose-only: the backlog of learnings no check, default or part carries yet)' if a.gaps else ''))
    return 0 if sel else 1


def promote(pb, inbox_file, ids=None, as_id=None, grade=None, status=None):
    """-> (promoted [rule ids], problems [str]). Pure apart from reading and appending the JSON files."""
    path = inbox_file if os.path.isabs(inbox_file) or os.path.exists(inbox_file) else os.path.join(pb, 'inbox', inbox_file)
    with open(path, encoding='utf-8') as f:
        cands = json.load(f)
    cands = cands if isinstance(cands, list) else [cands]
    pick = [c for c in cands if not c.get('promoted_to') and (not ids or c['id'] in ids)]
    if not pick:
        return [], ['no unpromoted candidate matches in %s' % path]
    if as_id and len(pick) != 1:
        return [], ['--as names one rule: pick one candidate with --id']
    existing = L.rules_by_id(pb)
    done, probs = [], []
    for c in pick:
        rid = as_id or c['id']
        area = rid.split('.')[0]
        if area not in L.AREAS:
            probs.append('%s: area %s is not one of %s (use --as area.name)' % (rid, area, ', '.join(L.AREAS)))
            continue
        if rid in existing:
            probs.append('%s: a rule with that id exists (use --as)' % rid)
            continue
        r = {k: v for k, v in c.items() if k not in ('promoted_to',)}
        r['id'] = rid
        if grade:
            r['grade'] = grade
        en = r.setdefault('enforce', {'check': None, 'default': None, 'part': None})
        r['status'] = status or ('enforced' if en.get('check') else 'default' if en.get('default') else 'part' if en.get('part') else 'prose-only')
        af = os.path.join(pb, 'rules', area + '.json')
        cur = json.load(open(af, encoding='utf-8')) if os.path.exists(af) else []
        cur.append(r)
        os.makedirs(os.path.dirname(af), exist_ok=True)
        with open(af, 'w', encoding='utf-8') as f:
            json.dump(cur, f, indent=2, ensure_ascii=False)
            f.write('\n')
        c['promoted_to'] = rid
        existing[rid] = r
        done.append(rid)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cands, f, indent=2, ensure_ascii=False)
        f.write('\n')
    return done, probs


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:2] == ['rules', 'promote']:
        ap = argparse.ArgumentParser(prog='mp rules promote')
        ap.add_argument('inbox')
        ap.add_argument('--id', action='append')
        ap.add_argument('--as', dest='as_id')
        ap.add_argument('--grade', choices=L.GRADES)
        ap.add_argument('--status', choices=[s for s in L.STATUSES if s != 'candidate'])
        ap.add_argument('--playbook')
        a = ap.parse_args(argv[2:])
        done, probs = promote(L.playbook_dir(a.playbook), a.inbox, a.id, a.as_id, a.grade, a.status)
        for p in probs:
            print('refused: ' + p)
        for d in done:
            print('promoted %s' % d)
        if done:
            print('next: python3 tools/playbook_build.py (validates the rule and regenerates playbook/README.md)')
        return 0 if done and not probs else 1
    ap = argparse.ArgumentParser(prog='mp', description=__doc__.split('\n\n')[0])
    ap.add_argument('cmd', choices=['formats', 'rules'])
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--playbook')
    ap.add_argument('--area', choices=L.AREAS)
    ap.add_argument('--status', choices=L.STATUSES)
    ap.add_argument('--grade', choices=L.GRADES)
    ap.add_argument('--format')
    ap.add_argument('--gaps', action='store_true')
    a = ap.parse_args(argv)
    return cmd_formats(a) if a.cmd == 'formats' else cmd_rules(a)


if __name__ == '__main__':
    sys.exit(main())
