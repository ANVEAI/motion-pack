#!/usr/bin/env python3
"""contrast.py: WCAG 2.x contrast checker and palette linter for frame-design.

usage:
  python3 contrast.py design.json            check design.json "palette" (+ optional "contrast.pairs"), lint, suggest fixes
  python3 contrast.py palette.json           a bare palette: {"paper": "#F5F2EA", "ink": "#111111", ...} or {"palette": {...}}
  python3 contrast.py --pair "#767676" "#FFFFFF" [--use text|large|ui]
  python3 contrast.py --selftest
options: --json (machine-readable report), --quiet (summary only)

Pairs: a list in design.json at contrast.pairs, e.g. [{"fg": "ink", "bg": "paper", "use": "text"}]; fg / bg are role names
from the palette or #hex. Without a list, pairs are derived from role names that exist: ink/paper, muted/paper, accent_ink/accent,
paper/ink, accent/paper (ui), success/paper (ui), caption/scrim (text), label/paper (text).

Thresholds (WCAG 2.x success criteria 1.4.3 and 1.4.11): text 4.5:1, large text 3:1 (at least 24 px regular or 18.66 px bold
at 1x), non-text UI and graphics 3:1; AAA text 7:1. Video is viewed small and in motion, so treat these as floors, not targets.

Linter (house defaults): invalid hex = FAIL; a failing pair = FAIL with the nearest passing foreground (same CIELAB a*, b*, moved
in L*); two roles with the same hex = WARN; two roles closer than dE76 < 5 = WARN (hard to tell apart on a phone); more than one
saturated accent hue = WARN (one accent, used with discipline).
Exit 0 = no FAIL, 1 = at least one FAIL, 2 = bad input. Standard library only.
"""
import json
import math
import re
import sys

MIN = {'text': 4.5, 'large': 3.0, 'ui': 3.0}
AAA = {'text': 7.0, 'large': 4.5, 'ui': 3.0}
HEX = re.compile(r'^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$')
STATE_ROLES = ('success', 'warning', 'danger', 'error', 'info', 'state', 'mint')
DEFAULT_PAIRS = [('ink', 'paper', 'text'), ('muted', 'paper', 'text'), ('accent_ink', 'accent', 'text'), ('paper', 'ink', 'text'),
                 ('accent', 'paper', 'ui'), ('success', 'paper', 'ui'), ('caption', 'scrim', 'text'), ('label', 'paper', 'text')]


def parse_hex(h):
    m = HEX.match(str(h).strip())
    if not m:
        return None
    s = m.group(1)
    if len(s) == 3:
        s = ''.join(c * 2 for c in s)
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def to_hex(rgb):
    return '#%02X%02X%02X' % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def unlin(v):
    v = max(0.0, min(1.0, v))
    return 255.0 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)


def luminance(rgb):
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ---- CIELAB (D65) for distances and for the repair search ----
def rgb_to_lab(rgb):
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def lab_to_rgb(lab):
    L, a, b = lab
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    finv = lambda t: t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) / (24389 / 27)
    x, y, z = finv(fx) * 0.95047, finv(fy), finv(fz) * 1.08883
    r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    g = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    bb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    return tuple(unlin(v) for v in (r, g, bb))


def de76(p, q):
    a, b = rgb_to_lab(p), rgb_to_lab(q)
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def suggest(fg, bg, target):
    """nearest foreground (same a*, b*) whose contrast against bg reaches target; None if impossible"""
    L0, a, b = rgb_to_lab(fg)
    best = None
    for direction in (-1, 1):
        lo, hi = 0.0, 100.0
        end = 0.0 if direction < 0 else 100.0
        cand = lab_to_rgb((end, a, b))
        if ratio(cand, bg) < target:
            continue
        lo, hi = (end, L0) if direction < 0 else (L0, end)
        for _ in range(40):
            mid = (lo + hi) / 2
            ok = ratio(lab_to_rgb((mid, a, b)), bg) >= target
            if direction < 0:
                lo, hi = (mid, hi) if ok else (lo, mid)
            else:
                lo, hi = (lo, mid) if ok else (mid, hi)
        Lp = lo if direction < 0 else hi
        rgb = lab_to_rgb((Lp, a, b))
        hx = to_hex(rgb)
        rgbq = parse_hex(hx)
        while ratio(rgbq, bg) < target and 0 < Lp < 100:          # rounding to 8 bits can land a hair under
            Lp += -0.05 * (1 if direction < 0 else -1)
            hx = to_hex(lab_to_rgb((Lp, a, b)))
            rgbq = parse_hex(hx)
        cand = (abs(Lp - L0), hx, ratio(rgbq, bg))
        if ratio(rgbq, bg) >= target and (best is None or cand[0] < best[0]):
            best = cand
    return best


def hsl(rgb):
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60, s, l


def check(palette, pairs, rows, findings):
    colors = {}
    for role, h in palette.items():
        if isinstance(h, dict):          # {"hex": "#..", ...}
            h = h.get('hex')
        rgb = parse_hex(h) if isinstance(h, str) else None
        if rgb is None:
            findings.append(('FAIL', f'palette.{role}: "{h}" is not a #RRGGBB colour'))
        else:
            colors[role] = rgb
    if not pairs:
        pairs = [{'fg': f, 'bg': b, 'use': u} for f, b, u in DEFAULT_PAIRS if f in colors and b in colors]
        if not pairs:
            findings.append(('WARN', 'no pairs to check: add contrast.pairs or use role names ink/paper/accent/accent_ink/muted'))
    for p in pairs:
        use = p.get('use', 'text')
        fgk, bgk = p.get('fg'), p.get('bg')
        fg = colors.get(fgk) or parse_hex(fgk or '')
        bg = colors.get(bgk) or parse_hex(bgk or '')
        if fg is None or bg is None:
            findings.append(('FAIL', f'pair {fgk} on {bgk}: unknown role or bad hex'))
            continue
        r = ratio(fg, bg)
        need = float(p.get('min', MIN.get(use, 4.5)))
        ok = r + 1e-9 >= need
        row = {'fg': fgk, 'bg': bgk, 'use': use, 'fg_hex': to_hex(fg), 'bg_hex': to_hex(bg), 'ratio': round(r, 2), 'min': need,
               'pass': ok, 'aaa': r + 1e-9 >= AAA.get(use, 7.0)}
        if not ok:
            s = suggest(fg, bg, need)
            row['suggest'] = s[1] if s else None
            findings.append(('FAIL', f'{fgk} on {bgk} ({use}): {r:.2f}:1 < {need}:1' + (f'; nearest passing {fgk}: {s[1]} ({s[2]:.2f}:1)' if s else '; no lightness fix exists: change the background')))
        rows.append(row)
    # ---- lint ----
    roles = list(colors)
    for i, a in enumerate(roles):
        for b in roles[i + 1:]:
            if a.endswith('_ink') or b.endswith('_ink'):      # on-colour roles are meant to repeat white or black
                continue
            if colors[a] == colors[b]:
                findings.append(('WARN', f'{a} and {b} are the same colour {to_hex(colors[a])}'))
            elif de76(colors[a], colors[b]) < 5:
                findings.append(('WARN', f'{a} and {b} are nearly identical (dE76 {de76(colors[a], colors[b]):.1f} < 5): hard to tell apart on a phone'))
    hues = []
    for role, rgb in colors.items():
        if any(role.lower().startswith(s) for s in STATE_ROLES):
            continue
        h, s, l = hsl(rgb)
        if s > 0.5 and 0.2 < l < 0.8:
            if all(min(abs(h - x), 360 - abs(h - x)) > 30 for x, _ in hues):
                hues.append((h, role))
    if len(hues) > 1:
        findings.append(('WARN', 'more than one saturated accent hue (' + ', '.join(r for _, r in hues) + '): one accent, used with discipline'))
    return colors


def selftest():
    cases = [(('#000000', '#FFFFFF'), 21.0), (('#FFFFFF', '#FFFFFF'), 1.0), (('#767676', '#FFFFFF'), 4.54), (('#777777', '#FFFFFF'), 4.48)]
    ok = True
    for (a, b), want in cases:
        got = round(ratio(parse_hex(a), parse_hex(b)), 2)
        print(f'{a} on {b}: {got}:1 (expected {want}:1)', 'ok' if abs(got - want) < 0.01 else 'MISMATCH')
        ok &= abs(got - want) < 0.01
    s = suggest(parse_hex('#999999'), parse_hex('#FFFFFF'), 4.5)
    print(f'repair #999999 on #FFFFFF to 4.5:1 -> {s[1]} ({s[2]:.2f}:1)', 'ok' if s and s[2] >= 4.5 else 'FAIL')
    ok &= bool(s and s[2] >= 4.5)
    back = to_hex(lab_to_rgb(rgb_to_lab(parse_hex('#4A18ED'))))
    print(f'Lab round trip #4A18ED -> {back}', 'ok' if back == '#4A18ED' else 'MISMATCH')
    ok &= back == '#4A18ED'
    print('selftest', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main(argv):
    if '--selftest' in argv:
        return selftest()
    as_json, quiet = '--json' in argv, '--quiet' in argv
    use = argv[argv.index('--use') + 1] if '--use' in argv else 'text'
    rows, findings = [], []
    if '--pair' in argv:
        i = argv.index('--pair')
        try:
            pal = {'fg': argv[i + 1], 'bg': argv[i + 2]}
        except IndexError:
            print('usage: contrast.py --pair FG BG [--use text|large|ui]')
            return 2
        check(pal, [{'fg': 'fg', 'bg': 'bg', 'use': use}], rows, findings)
        name = 'pair'
    else:
        files = [a for a in argv if not a.startswith('--') and a not in ('text', 'large', 'ui')]
        if not files:
            print(__doc__)
            return 2
        try:
            with open(files[0], encoding='utf-8') as fh:
                doc = json.load(fh)
        except (OSError, ValueError) as e:
            print(f'cannot read {files[0]}: {e}')
            return 2
        pal = doc.get('palette', doc) if isinstance(doc, dict) else {}
        pal = {k: v for k, v in pal.items() if isinstance(v, (str, dict))}
        pairs = ((doc.get('contrast') or {}).get('pairs') if isinstance(doc.get('contrast'), dict) else None) or []
        check(pal, pairs, rows, findings)
        name = files[0]
    nf = sum(1 for k, _ in findings if k == 'FAIL')
    if as_json:
        print(json.dumps({'file': name, 'pairs': rows, 'findings': [{'level': k, 'msg': m} for k, m in findings], 'pass': nf == 0}, indent=1))
    else:
        if not quiet:
            print(f'{"fg":<12} {"bg":<10} {"use":<6} {"ratio":>7}  {"min":>4}  AAA  verdict')
            for r in rows:
                print(f'{r["fg"]:<12} {r["bg"]:<10} {r["use"]:<6} {r["ratio"]:>6.2f}:1 {r["min"]:>4}  {"yes" if r["aaa"] else "no ":<3}  '
                      + ('PASS' if r['pass'] else f'FAIL  try {r.get("suggest")}'))
            for k, m in findings:
                print(f'{k}  {m}')
        print(f'{name}: {len(rows)} pairs, {nf} FAIL, {sum(1 for k, _ in findings if k == "WARN")} WARN | ' + ('PASS' if nf == 0 else 'FAIL'))
    return 0 if nf == 0 else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
