"""motion-pack / tools / playbook_checks_style.py: the lint checks of a named style (playbook/styles/<id>.json), registered into
tools/playbook_checks.CHECKS on import.

A style is laid over a format by `mp plan <format> --style <id>`, which writes plan.style (and plan.playbook.style; the template's own plan carries
plan.playbook.style through project.json "playbook"). `mp lint` then runs the checks the style's signature_features name, at each check's grade:
  lint.style.palette       the film's brand colours (project.json brand, or plan.project.brand) are the style's paper / ink / accent, or a change that still
                           passes skills/frame-design/scripts/contrast.py (a WARN: the palette is the character tier); a failing contrast is a FAIL
  lint.style.type          the display family is the style's, and every type preset the plan's shots use is one of the style's presets
  lint.style.transitions   no transition the style bans; every transition is one the style names (by_reason) or a hard cut
  lint.style.sound         the bed is the style's bed or one of its alternates
  lint.style.craft         hero styles: the film craft the template recorded (plan.scene.craft, or the plan's CONFIG overrides craft.*) matches the style's
                           craft numbers: a plain value exactly, {value, min, max} inside the range; and the world (plan.scene.world) is the style's
Each returns N/A when the film has no style, or when the input it reads is absent (never a pass)."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
import playbook_checks as K  # noqa: E402
import playbook_lib as L  # noqa: E402

CONTRAST = os.path.join(L.PACK, 'skills', 'frame-design', 'scripts', 'contrast.py')
ROLE = {'paper': 'paper', 'ink': 'ink', 'accent': 'accent', 'muted': 'muted'}


def style_of(ctx):
    """the style dict the film follows: ctx.style when given, else plan.style (mp plan), else plan.playbook.style looked up in the playbook"""
    if getattr(ctx, 'style', None):
        return ctx.style
    plan = ctx.plan or {}
    st = plan.get('style') if isinstance(plan.get('style'), dict) else None
    sid = (st or {}).get('id') or ((plan.get('playbook') or {}).get('style') if isinstance(plan.get('playbook'), dict) else None)
    if not sid:
        return None
    styles = L.load_styles(L.playbook_dir(getattr(ctx, 'playbook', None)))
    return styles.get(sid) or st


def _project(ctx):
    pr = getattr(ctx, 'project', None)
    if pr:
        return pr
    plan = ctx.plan or {}
    return plan.get('project') if isinstance(plan.get('project'), dict) else None


def _overrides(ctx):
    """the CONFIG overrides the project gives its template(s): {path: value} merged over every template"""
    pr = _project(ctx) or {}
    out = {}
    for _, o in sorted((pr.get('overrides') or {}).items()):
        if isinstance(o, dict):
            out.update({k: v for k, v in o.items() if not k.startswith('//')})
    return out


def palette(ctx, p):
    st = style_of(ctx)
    if not st:
        return 'na', '', ''
    brand = (_project(ctx) or {}).get('brand') or {}
    have = {k: brand.get(k) for k in ('paper', 'ink', 'accent', 'muted') if brand.get(k)}
    if not {'paper', 'ink', 'accent'} <= set(have):
        return 'na', 'no brand paper / ink / accent in the project', 'mp plan --style writes them into the project'
    want = L.style_palette(st)
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(have, f)
    try:
        r = subprocess.run([sys.executable, CONTRAST, f.name, '--json'], capture_output=True, text=True)
    finally:
        os.unlink(f.name)
    try:
        d = json.loads(r.stdout)
    except ValueError:
        return 'fail', 'contrast.py did not run', (r.stderr or '')[-120:]
    ratio = {'%s/%s' % (x.get('fg'), x.get('bg')): x.get('ratio', 0) for x in d.get('pairs') or []}
    val = 'ink/paper %.1f:1, accent/paper %.1f:1' % (ratio.get('ink/paper', 0), ratio.get('accent/paper', 0))
    if r.returncode != 0:
        bad = [x for x in d.get('pairs') or [] if not x.get('pass')]
        return 'fail', val + ' (fails: %s)' % ', '.join('%s on %s' % (x.get('fg'), x.get('bg')) for x in bad), 'use the style palette (%s) or a pair that passes contrast.py' % ', '.join('%s %s' % kv for kv in sorted(want.items()))
    same = all(str(have.get(k, '')).lower() == str(want.get(k, '')).lower() for k in ('paper', 'ink', 'accent'))
    if same:
        return 'pass', val + ' (the %s palette)' % st['id'], ''
    return 'warn', val + ' (differs from %s)' % st['id'], 'the palette is the character tier: keep the style logic (%s)' % (st.get('palette') or {}).get('logic', '')[:80]


def _shot_types(ctx):
    out = []
    for s in (ctx.plan or {}).get('shots') or []:
        if isinstance(s, dict) and isinstance(s.get('type'), str) and s['type'].startswith('type/'):
            out.append(s['type'])
    for k, v in _overrides(ctx).items():
        if k.startswith('type.') and isinstance(v, str) and v.startswith('type/'):
            out.append(v)
    return out


def type_(ctx, p):
    st = style_of(ctx)
    if not st:
        return 'na', '', ''
    want = (st.get('type') or {})
    presets = set((want.get('presets') or {}).values())
    fonts = ((_project(ctx) or {}).get('brand') or {}).get('fonts') or {}
    used = _shot_types(ctx)
    if not used and not fonts:
        return 'na', 'no type presets or fonts in the plan or project', ''
    off = sorted(set(u for u in used if u not in presets))
    font_off = fonts.get('display') and fonts.get('display') != want.get('display')
    val = 'display %s, %d preset uses' % (fonts.get('display') or '(template default)', len(used))
    if off or font_off:
        return 'fail', val + (' (not in the style: %s)' % ', '.join(off) if off else '') + (' (style display: %s)' % want.get('display') if font_off else ''), \
            'use the style type: %s, presets %s' % (want.get('display'), ', '.join(sorted(presets)))
    return 'pass', val, ''


def _transitions(ctx):
    out = []
    for s in (ctx.plan or {}).get('shots') or []:
        if isinstance(s, dict) and isinstance(s.get('tx'), str):
            out.append(s['tx'])
    for k, v in _overrides(ctx).items():
        if k.startswith('transitions.') and isinstance(v, list) and v and isinstance(v[0], str):
            out.append(v[0])
    return out


def transitions(ctx, p):
    st = style_of(ctx)
    if not st:
        return 'na', '', ''
    tr = st.get('transitions') or {}
    allowed = set((tr.get('by_reason') or {}).values()) | {'transitions/cut', 'cut'}
    banned = set(tr.get('banned') or [])
    used = _transitions(ctx)
    if not used:
        return 'na', 'no transitions in the plan', ''
    hit = sorted(set(u for u in used if u in banned))
    if hit:
        return 'fail', 'banned by %s: %s' % (st['id'], ', '.join(hit)), 'use %s' % ', '.join(sorted(allowed - {'cut'}))
    other = sorted(set(u for u in used if u not in allowed))
    if other:
        return 'warn', '%d transitions, %d outside the style: %s' % (len(used), len(other), ', '.join(other[:3])), 'the style names %s' % ', '.join(sorted(allowed - {'cut'}))
    return 'pass', '%d transitions, all the style\'s' % len(used), ''


def sound(ctx, p):
    st = style_of(ctx)
    if not st:
        return 'na', '', ''
    snd = st.get('sound') or {}
    plan = ctx.plan or {}
    bed = plan.get('music') if isinstance(plan.get('music'), str) else None
    bed = bed or (_project(ctx) or {}).get('music')
    if not bed:
        return 'na', 'no bed in the plan or project', ''
    norm = lambda x: str(x).replace('music.', 'music/', 1)
    ok = [norm(snd.get('bed'))] + [norm(b) for b in snd.get('alt_beds') or []]
    if norm(bed) == ok[0]:
        return 'pass', '%s (the style bed)' % norm(bed), ''
    if norm(bed) in ok:
        return 'pass', '%s (a style alternate)' % norm(bed), ''
    return 'warn', '%s is not the %s bed' % (norm(bed), st['id']), 'use %s' % ' or '.join(ok)


def _craft_used(ctx):
    plan = ctx.plan or {}
    sc = plan.get('scene') if isinstance(plan.get('scene'), dict) else None
    if sc and isinstance(sc.get('craft'), dict):
        return dict(sc['craft']), sc.get('world')
    ov = _overrides(ctx)
    used = {k[6:]: v for k, v in ov.items() if k.startswith('craft.')}
    return (used or None), ov.get('world')


def craft(ctx, p):
    st = style_of(ctx)
    if not st or not st.get('craft'):
        return 'na', '', ''
    used, world = _craft_used(ctx)
    if used is None:
        return 'na', 'the plan records no craft (a template without CONFIG.craft)', 'render the style with templates/style-scene, or art-direct the craft by hand'
    bad = []
    for k, want in st['craft'].items():
        got = used.get(k)
        if isinstance(want, dict):
            lo, hi = want.get('min', want['value']), want.get('max', want['value'])
            if not isinstance(got, (int, float)) or isinstance(got, bool) or not lo - 1e-9 <= got <= hi + 1e-9:
                bad.append('%s %s (want %g-%g)' % (k, got, lo, hi))
        elif isinstance(want, bool):
            if bool(got) != want:
                bad.append('%s %s (want %s)' % (k, got, want))
        elif not isinstance(got, (int, float)) or abs(got - want) > 1e-9:
            bad.append('%s %s (want %s)' % (k, got, want))
    if st.get('world') and world and world != st['world']:
        bad.append('world %s (want %s)' % (world, st['world']))
    if bad:
        return 'fail', '; '.join(bad)[:120], 'the %s craft: %s' % (st['id'], ', '.join('%s %s' % (k, v['value'] if isinstance(v, dict) else v) for k, v in st['craft'].items()))
    return 'pass', '%d craft numbers in range%s' % (len(st['craft']), ', world %s' % world if world else ''), ''


K.CHECKS['lint.style.palette'] = K.C(palette, 'house', {}, 'the brand colours are the style palette, or a change that passes contrast.py (playbook/styles)')
K.CHECKS['lint.style.type'] = K.C(type_, 'craft', {}, 'the display family and every type preset are the style\'s (playbook/styles)')
K.CHECKS['lint.style.transitions'] = K.C(transitions, 'house', {}, 'no transition the style bans; the rest are the style\'s or hard cuts (playbook/styles)')
K.CHECKS['lint.style.sound'] = K.C(sound, 'craft', {}, 'the bed is the style bed or one of its alternates (playbook/styles)')
K.CHECKS['lint.style.craft'] = K.C(craft, 'house', {}, 'hero styles: the film craft in the plan (step rate, squash, handheld, rack focus, push, rain, layers, boil, grade) is the style\'s (playbook/styles)')
