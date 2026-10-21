#!/usr/bin/env python3
"""motion-pack / tools / playbook_build.py: validate the playbook and generate its index.

    python3 tools/playbook_build.py                 # validate, then write playbook/README.md (and docs/evidence/INDEX.md when docs/evidence exists)
    python3 tools/playbook_build.py --check         # validate, and exit 1 when a generated file is stale (CI)
    python3 tools/playbook_build.py --playbook DIR  # another playbook folder (the tests use tools/tests/fixtures/playbook)

VALIDATES every rule (playbook/rules/<area>.json, arrays) against playbook/schema/rule.schema.json and every format (playbook/formats/<id>.json)
against format.schema.json (jsonschema, Draft 2020-12), then: rule ids are unique and start with their file's area; the area is one of the twelve;
status matches enforce (enforced has a check, default a plan default, part a part id; prose-only has none; candidate only in playbook/inbox);
every enforce.check is a registered check (tools/playbook_checks.py), every enforce.default a plan default (tools/playbook_plan.mjs --defaults),
every part id and recommended part resolves (tools/check_ids.py families, or a type/gfx id); conflicts_with ids exist; a source that names a
repo file exists; a format's id matches its file, its template exists, its rules and beat rules exist, its beats start at 0, end at 1 and do not
overlap, its lead aspect is one of its aspects, its hooks exist in patterns/hooks.json. Candidates in playbook/inbox/*.json are schema-checked.
STYLES (playbook/styles/<id>.json) validate against style.schema.json; every part id they name resolves (tools/check_ids.py) and `recipes` lists
each one they use; the palette passes skills/frame-design/scripts/contrast.py and palette.contrast holds the ratios it measures (written here,
STALE under --check); every format and the demo's format and template exist; every signature check is a registered check or "review"; a demo
marked rendered has its committed preview (under 2 MB) and poster.
Exit 0 = valid (and current with --check), 1 = a problem, 2 = usage."""
import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import playbook_lib as L  # noqa: E402

PACK = L.PACK
SCHEMA_DIR = os.path.join(PACK, 'playbook', 'schema')


def _schema(name):
    with open(os.path.join(SCHEMA_DIR, name), encoding='utf-8') as f:
        return json.load(f)


def _validator(name):
    import jsonschema
    return jsonschema.Draft202012Validator(_schema(name))


def defaults_registry():
    r = subprocess.run(['node', os.path.join(HERE, 'playbook_plan.mjs'), '--defaults'], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('node tools/playbook_plan.mjs --defaults failed: %s' % r.stderr.strip()[-200:])
    return json.loads(r.stdout)


_CI = None


def part_ok(pid):
    """a pack id resolves: one of check_ids.py's families (quoted, as in code), or a type/gfx part id (ui.appWindow)"""
    global _CI
    if _CI is None:
        import check_ids as CI
        _CI = CI
    for kind, rx in _CI.RX:
        hit = rx.findall("'%s'" % pid)
        if hit and hit[0] == pid:
            return bool(_CI.ok(kind, pid))
    return pid in _CI.GFX


def _rel(p):
    return os.path.relpath(p, PACK) if p.startswith(PACK) else p


CONTRAST = os.path.join(PACK, 'skills', 'frame-design', 'scripts', 'contrast.py')
PREVIEW_MAX = 2 * 1024 * 1024


def measure_contrast(pal):
    """contrast.py --json on a palette -> ({ink_on_paper, accent_on_paper, muted_on_paper}, ok, problems)"""
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(pal, f)
    try:
        r = subprocess.run([sys.executable, CONTRAST, f.name, '--json'], capture_output=True, text=True)
    finally:
        os.unlink(f.name)
    try:
        d = json.loads(r.stdout)
    except ValueError:
        return {}, False, ['contrast.py did not run: %s' % (r.stderr or r.stdout)[-160:]]
    got = {}
    for p in d.get('pairs') or []:
        key = '%s_on_%s' % (p.get('fg'), p.get('bg'))
        if key in ('ink_on_paper', 'accent_on_paper', 'muted_on_paper'):
            got[key] = round(float(p.get('ratio', 0)), 2)
    bad = ['%s on %s %.2f:1 (%s)' % (p.get('fg'), p.get('bg'), p.get('ratio', 0), p.get('use')) for p in d.get('pairs') or [] if not p.get('pass')]
    return got, r.returncode == 0, bad


_UNITS = None


def preset_units():
    """{preset id: split unit} from type/presets.js (a line-unit preset paints a whole line one colour, so an *accent* word on that line loses its colour)"""
    global _UNITS
    if _UNITS is None:
        r = subprocess.run(['node', '-e', "import('%s/type/presets.js').then((m) => console.log(JSON.stringify(Object.fromEntries(Object.entries(m.PRESETS).map(([k, v]) => [k, v.unit])))))" % PACK],
                           capture_output=True, text=True)
        _UNITS = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}
    return _UNITS


def style_problems(where, sid, st, formats, checks, styles):
    out = []
    units = preset_units()
    for role in ('headline', 'card'):   # the lines that carry the accent word
        pid = ((st.get('type') or {}).get('presets') or {}).get(role, '')
        u = units.get(pid.split('/', 1)[-1])
        if u == 'line':
            out.append('%s: type.presets.%s %s splits by line, so the accent word on that line loses its colour: use a word or char preset' % (where, role, pid))
    if sid != os.path.basename(st['_file'])[:-5]:
        out.append('%s: id "%s" does not match the file name' % (where, sid))
    used, named = L.style_parts(st)
    for pid in used + named:
        if not part_ok(pid):
            out.append('%s: %s does not resolve to a pack id' % (where, pid))
    rec = set(st.get('recipes') or [])
    for pid in used:
        if pid not in rec:
            out.append('%s: recipes does not list %s (the style uses it)' % (where, pid))
    for pid in rec:
        if not part_ok(pid):
            out.append('%s: recipe %s does not resolve' % (where, pid))
    for f in st.get('formats') or []:
        if f not in formats:
            out.append('%s: format %s is not in the playbook' % (where, f))
    demo = st.get('demo') or {}
    if demo.get('format') and demo['format'] not in formats:
        out.append('%s: demo.format %s is not in the playbook' % (where, demo['format']))
    if demo.get('format') and demo['format'] not in (st.get('formats') or []):
        out.append('%s: demo.format %s is not one of the style formats' % (where, demo['format']))
    if demo.get('template') and not os.path.exists(os.path.join(PACK, demo['template'], 'config.mjs')):
        out.append('%s: demo.template %s has no config.mjs' % (where, demo['template']))
    if demo.get('status') == 'rendered':
        for k in ('preview', 'poster'):
            f = demo.get(k)
            if not f or not os.path.exists(os.path.join(PACK, f)):
                out.append('%s: demo is rendered but demo.%s %s is missing' % (where, k, f))
        pv = demo.get('preview')
        if pv and os.path.exists(os.path.join(PACK, pv)) and os.path.getsize(os.path.join(PACK, pv)) > PREVIEW_MAX:
            out.append('%s: demo.preview %s is over 2 MB' % (where, pv))
    if st.get('tier') == 'hero':   # a hero is a film language: craft numbers, a world, and its demo on the scene template that takes them
        if not st.get('craft') or not st.get('world'):
            out.append('%s: a hero style needs craft and world (templates/style-scene)' % where)
        if (st.get('demo') or {}).get('template') != 'templates/style-scene':
            out.append('%s: a hero style demo is made with templates/style-scene' % where)
        if not any(f.get('check') == 'lint.style.craft' for f in st.get('signature_features') or []):
            out.append('%s: a hero style names lint.style.craft in its signature' % where)
    for t in (st.get('apply') or {}):
        if not os.path.exists(os.path.join(PACK, t, 'config.mjs')):
            out.append('%s: apply names %s, which has no config.mjs' % (where, t))
    for sf in st.get('signature_features') or []:
        c = sf.get('check')
        if c and c != 'review' and c not in checks:
            out.append('%s: signature check %s is not a registered check (python3 tools/playbook_lint.py --list)' % (where, c))
    for n in st.get('not') or []:
        if n.get('style') == sid:
            out.append('%s: not names the style itself' % where)
    return out


def validate(pb, checks=None, defaults=None):
    """-> (problems [str], rules [(file, rule)], formats {id: fm}, inbox [(file, rule)])"""
    import playbook_checks as K
    checks = set(K.CHECKS) if checks is None else checks
    defaults = set(defaults_registry()) if defaults is None else defaults
    rv, fv = _validator('rule.schema.json'), _validator('format.schema.json')
    probs, rules, ids = [], L.load_rules(pb), {}
    for f, r in rules:
        where = '%s: %s' % (_rel(f), r.get('id', '?') if isinstance(r, dict) else '?')
        for e in sorted(rv.iter_errors(r), key=lambda e: list(e.path)):
            probs.append('%s: %s%s' % (where, '.'.join(map(str, e.path)) + ': ' if e.path else '', e.message))
        if not isinstance(r, dict) or 'id' not in r:
            continue
        area = os.path.basename(f)[:-5]
        if area not in L.AREAS:
            probs.append('%s: the file area "%s" is not one of %s' % (where, area, ', '.join(L.AREAS)))
        if not r['id'].startswith(area + '.'):
            probs.append('%s: the id must start with "%s." (its file)' % (where, area))
        if r['id'] in ids:
            probs.append('%s: duplicate id (also in %s)' % (where, _rel(ids[r['id']])))
        ids[r['id']] = f
        probs += rule_problems(where, r, checks, defaults, inbox=False)
    for f, r in rules:
        for c in (r.get('conflicts_with') or []) if isinstance(r, dict) else []:
            if c not in ids:
                probs.append('%s: %s: conflicts_with names an unknown rule %s' % (_rel(f), r.get('id'), c))
    inbox = L.load_rules(pb, 'inbox')
    for f, r in inbox:
        for e in rv.iter_errors(r):
            probs.append('%s: %s: %s' % (_rel(f), r.get('id', '?') if isinstance(r, dict) else '?', e.message))
    formats = L.load_formats(pb)
    hooks = {h['id'] for h in json.load(open(os.path.join(PACK, 'patterns', 'hooks.json'), encoding='utf-8'))['hooks']}
    for fid, fm in formats.items():
        where = _rel(fm['_file'])
        body = {k: v for k, v in fm.items() if k != '_file'}
        for e in sorted(fv.iter_errors(body), key=lambda e: list(e.path)):
            probs.append('%s: %s%s' % (where, '.'.join(map(str, e.path)) + ': ' if e.path else '', e.message))
        probs += format_problems(where, fid, fm, ids, hooks)
    return probs, rules, formats, inbox


def validate_styles(pb, formats, checks=None):
    """-> (problems [str], styles {id: style}, contrast {file: measured}): the measured ratios are what palette.contrast must hold"""
    import playbook_checks as K
    checks = set(K.CHECKS) if checks is None else checks
    sv, styles, probs, measured = _validator('style.schema.json'), L.load_styles(pb), [], {}
    for sid, st in styles.items():
        where = _rel(st['_file'])
        body = {k: v for k, v in st.items() if k != '_file'}
        for e in sorted(sv.iter_errors(body), key=lambda e: list(e.path)):
            if list(e.path)[:2] == ['palette', 'contrast'] and not (st.get('palette') or {}).get('contrast'):
                continue   # empty: the build writes the measured ratios in
            probs.append('%s: %s%s' % (where, '.'.join(map(str, e.path)) + ': ' if e.path else '', e.message))
        probs += style_problems(where, sid, st, formats, checks, styles)
        got, ok, bad = measure_contrast(L.style_palette(st))
        if not ok:
            probs.append('%s: the palette fails skills/frame-design/scripts/contrast.py: %s' % (where, '; '.join(bad) or 'see contrast.py'))
        measured[st['_file']] = got
    return probs, styles, measured


def rule_problems(where, r, checks, defaults, inbox):
    out, en, st = [], r.get('enforce') or {}, r.get('status')
    if st == 'candidate' and not inbox:
        out.append('%s: status candidate belongs in playbook/inbox (mp rules promote publishes it)' % where)
    if st == 'enforced' and not en.get('check'):
        out.append('%s: status enforced needs enforce.check' % where)
    if st == 'default' and not en.get('default'):
        out.append('%s: status default needs enforce.default' % where)
    if st == 'part' and not en.get('part'):
        out.append('%s: status part needs enforce.part' % where)
    if st == 'prose-only' and any(en.get(k) for k in ('check', 'default', 'part')):
        out.append('%s: status prose-only, but enforce names %s: set the status it earns' % (where, ', '.join(k for k in ('check', 'default', 'part') if en.get(k))))
    if en.get('check') and en['check'] not in checks:
        out.append('%s: enforce.check %s is not a registered check (python3 tools/playbook_lint.py --list)' % (where, en['check']))
    if en.get('default') and en['default'] not in defaults:
        out.append('%s: enforce.default %s is not a plan default (node tools/playbook_plan.mjs --defaults)' % (where, en['default']))
    if en.get('part') and not part_ok(en['part']):
        out.append('%s: enforce.part %s does not resolve to a pack id' % (where, en['part']))
    if r.get('grade') != 'house' and not r.get('sources'):
        out.append('%s: a %s rule needs at least one source' % (where, r.get('grade')))
    for s in r.get('sources') or []:
        out += source_problems(where, s.get('doc', ''))
    return out


def evidence_ids():
    p = os.path.join(PACK, 'docs', 'evidence', 'ids.json')
    return {k: v for k, v in json.load(open(p, encoding='utf-8')).items() if not k.startswith('//')} if os.path.exists(p) else {}


def source_problems(where, d):
    """a source that names a repo file must exist; docs/evidence/INDEX.md#<id> must be a neutral evidence id (docs/evidence/ids.json) whose file exists"""
    m = re.match(r'^docs/evidence/INDEX\.md#([a-z0-9-]+)$', d)
    if m:
        f = evidence_ids().get(m.group(1))
        if not f:
            return ['%s: source %s names no evidence id in docs/evidence/ids.json' % (where, d)]
        return [] if os.path.exists(os.path.join(PACK, 'docs', 'evidence', f)) else ['%s: evidence id %s points at a missing file %s' % (where, m.group(1), f)]
    if re.match(r'^[\w.-]+(/[\w.-]+)+\.(md|json)$', d) and not os.path.exists(os.path.join(PACK, d)):
        return ['%s: source %s does not exist' % (where, d)]
    return []


def format_problems(where, fid, fm, ids, hooks):
    out = []
    if fid != os.path.basename(fm['_file'])[:-5]:
        out.append('%s: id "%s" does not match the file name' % (where, fid))
    t = fm.get('template', '')
    if t and not os.path.exists(os.path.join(PACK, t, 'config.mjs')):
        out.append('%s: template %s has no config.mjs' % (where, t))
    for rid in L.format_rule_ids(fm):
        if rid not in ids:
            out.append('%s: rule %s is not in the playbook' % (where, rid))
    beats = sorted(fm.get('beats') or [], key=lambda b: b['at'][0])
    if beats:
        if abs(beats[0]['at'][0]) > 1e-9 or abs(beats[-1]['at'][1] - 1) > 1e-9:
            out.append('%s: the beats must cover 0..1 (first starts %s, last ends %s)' % (where, beats[0]['at'][0], beats[-1]['at'][1]))
        for a, b in zip(beats, beats[1:]):
            if b['at'][0] < a['at'][1] - 1e-9:
                out.append('%s: beats %s and %s overlap' % (where, a['id'], b['id']))
        for b in beats:
            if not b['at'][0] < b['at'][1]:
                out.append('%s: beat %s ends before it starts' % (where, b['id']))
        if len({b['id'] for b in beats}) != len(beats):
            out.append('%s: repeated beat id' % where)
    if fm.get('lead_aspect') and fm.get('lead_aspect') not in (fm.get('aspects') or []):
        out.append('%s: lead_aspect %s is not in aspects' % (where, fm.get('lead_aspect')))
    lo, hi = (fm.get('length_s') or [0, 0])[:2]
    if lo > hi:
        out.append('%s: length_s is reversed' % where)
    for h in fm.get('hooks') or []:
        if h not in hooks:
            out.append('%s: hook %s is not in patterns/hooks.json' % (where, h))
    beat_ids = {b['id'] for b in beats} | {'all'}
    for b, parts in (fm.get('recommended_parts') or {}).items():
        if b not in beat_ids:
            out.append('%s: recommended_parts names an unknown beat %s' % (where, b))
        for pid in parts:
            if not part_ok(pid):
                out.append('%s: recommended part %s does not resolve' % (where, pid))
    for ex in fm.get('exemplars') or []:
        for s in ex.get('sources') or []:
            out += source_problems('%s: exemplar %s' % (where, ex.get('label')), s.get('doc', ''))
    return out


def validate_prompts(pb, formats, styles):
    """playbook/prompts.json: every prompt is 150-250 characters, names an existing format and style, fits the format's lengths and aspects, carries a
    <your product> slot, and `mp brief` routes it to its format with a clear lead (2 points) -> (problems, prompts)"""
    f = os.path.join(pb, 'prompts.json')
    if not os.path.exists(f):
        return [], []
    import playbook_research as R
    ps, probs = json.load(open(f, encoding='utf-8')).get('prompts') or [], []
    seen = set()
    for p in ps:
        w = '%s: %s' % (_rel(f), p.get('id'))
        if p.get('id') in seen:
            probs.append('%s: repeated id' % w)
        seen.add(p.get('id'))
        fm, st, text = formats.get(p.get('format')), styles.get(p.get('style')), p.get('prompt', '')
        if not fm or not st:
            probs.append('%s: unknown format or style' % w)
            continue
        if not 150 <= len(text) <= 250:
            probs.append('%s: the prompt is %d characters (150-250)' % (w, len(text)))
        if '<your product>' not in text or st['title'] not in text:
            probs.append('%s: the prompt needs the <your product> slot and the style name %s' % (w, st['title']))
        if not fm['length_s'][0] <= p.get('length', 0) <= fm['length_s'][1] or p.get('aspect') not in fm.get('aspects', []):
            probs.append('%s: %s s at %s does not fit %s (%s s, %s)' % (w, p.get('length'), p.get('aspect'), fm['id'], fm['length_s'], ', '.join(fm['aspects'])))
        rk = R.classify(text, formats)
        if rk[0][1] != fm['id'] or (len(rk) > 1 and rk[0][0] < rk[1][0] + 2):
            probs.append('%s: mp brief routes it to %s (%s), not %s' % (w, rk[0][1], rk[0][0], fm['id']))
    return probs, ps


def prompts_md(prompts, formats, styles):
    out = ['# Prompt gallery', '', '<!-- generated by tools/playbook_build.py from playbook/prompts.json and playbook/styles: do not edit by hand -->', '',
           '[简体中文 README](../README.zh-CN.md) · [README](../README.md) · [the styles](../playbook/README.md#styles) · [catalog: Styles and Films tabs](https://anveai.github.io/motion-pack/catalog/)', '',
           '**%d copy-ready prompts**, one per format and style pair. Paste one into Claude Code (or any agent with the motion-pack skill), swap `<your product>` for yours, and the agent runs `mp brief` → `mp plan --style` → render → `mp lint`.' % len(prompts), '',
           '**Tested** means: CI checks that `mp brief` routes each prompt to its format with a clear lead and that `mp plan <format> --style <id>` builds its plan (`tools/playbook_build.py --check`, `tools/tests/test_styles.py`). The preview next to each prompt is that style\'s demo (a hero style: its 13.5 s scene made with `templates/style-scene`; a starter skin: a 10 s `ad` on a placeholder subject), not a film made from that exact prompt. The same prompt makes a different film on every run.', '']
    by = {}
    for p in prompts:
        by.setdefault(p['format'], []).append(p)
    for fid in [f for f in ('character-spot', 'ad', 'launch-film', 'saas-feature-drop', 'proof-clip', 'explainer') if f in by] + sorted(f for f in by if f not in ('character-spot', 'ad', 'launch-film', 'saas-feature-drop', 'proof-clip', 'explainer')):
        fm = formats[fid]
        out += ['## %s (`%s`)' % (fm['title'], fid), '', fm.get('use_when', ''), '']
        for p in by[fid]:
            st, d = styles[p['style']], styles[p['style']].get('demo') or {}
            prev = '[preview: the %s demo](../%s)' % (st['title'], d['preview']) if d.get('status') == 'rendered' and d.get('preview') else 'preview pending (the %s demo is not rendered yet)' % st['title']
            tpl = ' --template %s' % p['template'] if p.get('template') else ''
            out += ['### %s × %s%s, %g s %s' % (fm['title'].split(' (')[0], st['title'], ' (hero scene)' if st.get('tier') == 'hero' and p.get('template') else '', p['length'], p['aspect']), '', '```text', p['prompt'], '```', '',
                    '%s · `mp plan %s --style %s%s --length %g --aspect %s` · %d characters' % (prev, fid, p['style'], tpl, p['length'], p['aspect'], len(p['prompt'])), '']
    out += ['## The style prompts', '', 'Each style also has its own prompt (`mp styles <id>` prints it, with the Chinese version under `--zh`):', '',
            '| style | prompt |', '|---|---|']
    for sid, st in sorted(styles.items()):
        out.append('| `%s` | %s |' % (sid, st['prompt'].replace('|', '/')))
    return '\n'.join(out) + '\n'


# ---------------------------------------------------------------- generated files

def readme(pb, rules, formats, inbox, styles=None):
    rs = [r for _, r in rules if isinstance(r, dict) and 'id' in r]
    cnt = lambda key, vals: ', '.join('%d %s' % (sum(1 for r in rs if r.get(key) == v), v) for v in vals)
    out = ['# The playbook', '', '<!-- generated by tools/playbook_build.py from playbook/rules and playbook/formats: do not edit by hand -->', '',
           'Every learning the pack has made, as an atomic, graded rule, and the formats that bundle them. A film starts from `mp brief` or `mp plan <format>`,',
           'which write the learnings in as defaults, and ends with `mp lint`, which shows which learnings it kept and which it broke.', '',
           '```bash', 'mp formats                                  # the formats, one line each', 'mp brief "one-line idea" --goal launch     # pick the format, write research-pack.md, then the plan',
           'mp plan launch-film --length 35 --aspect 16:9   # a plan.json skeleton with the defaults and TODOs', 'mp lint plan.json                           # or a render: mp lint renders/<file>.mp4',
           'mp rules --gaps                             # prose-only rules: the backlog', '```', '',
           '**Grades:** measured-A (measured on tier A/A- references), measured (any tier), craft (seen, not tied to reach), house (a pack rule), inferred (a reading, never a fact).',
           'A failed house or measured-A rule is a FAIL in `mp lint`, measured and craft a WARN, inferred is information only.', '',
           '**Status:** enforced (a check), default (`mp plan` writes it in), part (a pack id implements it), prose-only (a known gap).', '',
           '**%d rules** (%s; %s)%s **%d formats**%s%s.' % (len(rs), cnt('status', ('enforced', 'default', 'part', 'prose-only')), cnt('grade', L.GRADES), ',' if styles else ' and', len(formats),
                                                          ' and **%d styles**' % len(styles) if styles else '', ', %d candidates in playbook/inbox' % len(inbox) if inbox else ''), '']
    if formats:
        out += ['## Formats', '', '| format | length | aspects | template | beats | rules | use when |', '|---|---|---|---|---|---|---|']
        for fid, fm in sorted(formats.items()):
            out.append('| `%s` | %g-%g s | %s | `%s` | %d | %d | %s |' % (fid, fm['length_s'][0], fm['length_s'][1], ' '.join(fm.get('aspects', [])), fm.get('template', ''),
                                                               len(fm.get('beats', [])), len(L.format_rule_ids(fm)), fm.get('use_when', '').replace('|', '/')))
        out.append('')
    if styles:
        out += ['## Styles', '', 'A format says what happens when; a style says what it looks and sounds like. `mp styles` lists them, `mp plan <format> --style <id>` lays one over a format,',
                'and `mp lint` checks the measurable signature features (palette, type, transitions, sound). Schema: `playbook/schema/style.schema.json`.', '',
                'Hero styles are full film languages (a scene, craft numbers checked by `lint.style.craft`, a demo made with `templates/style-scene`); starter skins lay a look and a sound over any format.', '',
                '| style | tier | what it is | palette (paper / ink / accent) | type | bed | demo |', '|---|---|---|---|---|---|---|']
        for sid, st in sorted(styles.items(), key=lambda kv: (kv[1].get('tier') != 'hero', kv[0])):
            p, d = st.get('palette') or {}, st.get('demo') or {}
            demo = '[%s s %s](../%s)' % (d.get('seconds'), d.get('aspect'), d['preview']) if d.get('status') == 'rendered' and d.get('preview') else 'pending'
            out.append('| `%s` %s | %s | %s | `%s` / `%s` / `%s` | %s | `%s` | %s |' % (sid, st.get('title_zh', ''), 'hero' if st.get('tier') == 'hero' else 'starter skin', st.get('line', '').replace('|', '/'), p.get('paper'), p.get('ink'), p.get('accent'),
                                                             (st.get('type') or {}).get('display'), (st.get('sound') or {}).get('bed'), demo))
        out.append('')
    by = {}
    for r in rs:
        by.setdefault(r['id'].split('.')[0], []).append(r)
    if by:
        out += ['## Rules by area', '']
    for area in L.AREAS:
        if area not in by:
            continue
        out += ['### %s' % area, '', '| rule | grade | status | enforced by | statement |', '|---|---|---|---|---|']
        for r in sorted(by[area], key=lambda r: r['id']):
            en = r.get('enforce') or {}
            how = ' '.join('`%s`' % x for x in (en.get('check'), en.get('default'), en.get('part')) if x) or '-'
            out.append('| `%s` | %s | %s | %s | %s |' % (r['id'], r.get('grade'), r.get('status'), how, r.get('statement', '').replace('|', '/').replace('\n', ' ')))
        out.append('')
    out += ['Schemas: `playbook/schema/rule.schema.json`, `playbook/schema/format.schema.json`, `playbook/schema/style.schema.json`. Checks: `python3 tools/playbook_lint.py --list`. Plan defaults: `node tools/playbook_plan.mjs --defaults`.', '']
    return '\n'.join(out)


def evidence_index(rules, formats):
    ev = os.path.join(PACK, 'docs', 'evidence')
    ids = evidence_ids()
    doc_of = lambda d: 'docs/evidence/' + ids[d.split('#', 1)[1]] if d.startswith('docs/evidence/INDEX.md#') and d.split('#', 1)[1] in ids else d
    cites, ex_cites = {}, {}
    for _, r in rules:
        for s in (r.get('sources') or []) if isinstance(r, dict) else []:
            cites.setdefault(doc_of(s.get('doc', '')), []).append(r.get('id'))
    for fid, fm in formats.items():
        for ex in fm.get('exemplars') or []:
            for s in ex.get('sources') or []:
                d = s.get('doc', '')
                if d.startswith('docs/evidence/INDEX.md#'):
                    ex_cites.setdefault(d.split('#', 1)[1], set()).add(fid)
    out = ['# Evidence', '', '<!-- generated by tools/playbook_build.py: do not edit by hand -->', '',
           'The research behind the playbook, moved here unchanged. Each document lists the rules that cite it; a document no rule cites is still a backlog of learnings to extract.', '',
           '| document | title | rules citing it |', '|---|---|---|']
    for f in sorted(os.listdir(ev)):
        if not f.endswith('.md') or f == 'INDEX.md':
            continue
        title = next((ln.lstrip('# ').strip() for ln in open(os.path.join(ev, f), encoding='utf-8') if ln.startswith('#')), f)
        rel = 'docs/evidence/' + f
        c = sorted(set(cites.get(rel, [])))
        out.append('| [%s](%s) | %s | %s |' % (f, f, title.replace('|', '/'), ', '.join('`%s`' % x for x in c) or '-'))
    if ids:
        out += ['', '## Evidence ids', '', 'Rules and exemplars cite these %s studies by a neutral id, so the playbook carries no studied name; the id resolves to the file here (`docs/evidence/ids.json`).' % NUM.get(len(ids), len(ids)), '',
                '| id | document | formats whose exemplars cite it |', '|---|---|---|']
        for k in sorted(ids):
            out.append('| <a id="%s"></a>`%s` | [%s](%s) | %s |' % (k, k, ids[k], ids[k], ', '.join(sorted(ex_cites.get(k, []))) or '-'))
    return '\n'.join(out) + '\n'


NUM = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten'}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--playbook')
    a = ap.parse_args(argv)
    pb = L.playbook_dir(a.playbook)
    probs, rules, formats, inbox = validate(pb)
    sprobs, styles, measured = validate_styles(pb, formats)
    probs += sprobs
    pprobs, prompts = validate_prompts(pb, formats, styles)
    probs += pprobs
    for p in probs:
        print('PROBLEM ' + p)
    gen = {os.path.join(pb, 'README.md'): readme(pb, rules, formats, inbox, styles)}
    for f, got in measured.items():   # palette.contrast holds what contrast.py measures: generated, like the index
        if not got:
            continue
        raw = json.load(open(f, encoding='utf-8'))
        if (raw.get('palette') or {}).get('contrast') != got:
            raw['palette']['contrast'] = got
            gen[f] = json.dumps(raw, indent=1, ensure_ascii=False) + '\n'
    if prompts and pb == L.playbook_dir(None):
        gen[os.path.join(PACK, 'docs', 'prompts.md')] = prompts_md(prompts, formats, styles)
    if os.path.isdir(os.path.join(PACK, 'docs', 'evidence')) and pb == L.playbook_dir(None):
        gen[os.path.join(PACK, 'docs', 'evidence', 'INDEX.md')] = evidence_index(rules, formats)
    stale = []
    for path, text in gen.items():
        old = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if old != text:
            if a.check:
                stale.append(_rel(path))
            else:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(text)
    for s in stale:
        print('STALE ' + s + ' (run python3 tools/playbook_build.py)')
    n = sum(1 for _, r in rules if isinstance(r, dict))
    print('playbook %s: %d rules, %d formats, %d styles, %d candidates, %d problems%s' % (_rel(pb), n, len(formats), len(styles), len(inbox), len(probs), ', %d stale' % len(stale) if stale else ''))
    return 1 if probs or stale else 0


if __name__ == '__main__':
    sys.exit(main())
