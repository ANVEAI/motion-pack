#!/usr/bin/env python3
"""motion-pack / tools / count.py: count what is in the pack from the registries and manifests (never typed by hand).

    python3 tools/count.py            # print the "What's inside" table (Markdown)
    python3 tools/count.py --json     # the raw counts
    python3 tools/count.py --write    # rewrite the table between <!-- counts:start --> and <!-- counts:end --> in README.md
    python3 tools/count.py --check    # exit 1 if README.md is out of date (CI runs this)"""
import json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
J = lambda p: json.load(open(os.path.join(REPO, p), encoding='utf-8'))


def counts():
    c = {}
    tx = J('transitions/catalog.json')['transitions']
    al = J('transitions/aliases.json')['aliases']
    c['transitions'] = len(tx)
    c['transitions_dom'] = sum(1 for t in tx if t.get('dom'))
    c['transitions_dom_approx'] = sum(1 for t in tx if not t.get('dom') and t.get('dom_approx'))
    c['transitions_timing_only'] = sum(1 for t in tx if not t.get('dom') and not t.get('dom_approx') and not t.get('gl'))
    c['transition_aliases'] = len(al)
    c['xfade_modes'] = sum(1 for k in al if k.startswith('xfade-'))
    pat = J('cuts/patterns.json')
    c['cut_patterns'] = sum(len(pat[g]) for g in ('beat', 'sections', 'split', 'talking_head', 'story', 'pace') if isinstance(pat.get(g), dict))
    c['cut_rules'] = sum(1 for g in ('interrupts', 'smash', 'onset_snap') if isinstance(pat.get(g), dict))
    c['retime_presets'] = len(J('cuts/retime.json')['presets']) if os.path.exists(os.path.join(REPO, 'cuts/retime.json')) else 0
    sm = J('sfx/manifest.json')
    c['sfx'] = len(sm['sounds'])
    c['sfx_families'] = len({s['category'] for s in sm['sounds']})
    c['sfx_bundles'] = sum(1 for v in J('sfx/bundles.json').values() if isinstance(v, dict))
    mm = J('music/manifest.json')['items']
    for k in ('bed', 'stinger', 'logo'):
        c['music_' + k + 's'] = sum(1 for m in mm if m['kind'] == k)
    c['music_presets'] = len({m['preset'] for m in mm if m['kind'] == 'bed'})
    for mod in ('layers', 'type', 'camera'):
        c[mod] = len(J(f'{mod}/manifest.json')['components'])
    c['looks'] = len(J('layers/looks/looks.json')['looks'])
    c['lut_files'] = len([f for f in os.listdir(os.path.join(REPO, 'layers/looks')) if f.endswith('.cube')])
    src = open(os.path.join(REPO, 'objects/index.js'), encoding='utf-8').read()
    c['objects'] = len(re.findall(r"'(objects/[a-z0-9-]+)': r\(", src))
    c['templates'] = sorted(d for d in os.listdir(os.path.join(REPO, 'templates')) if os.path.exists(os.path.join(REPO, 'templates', d, 'config.mjs')))
    if os.path.exists(os.path.join(REPO, 'blender/manifest.json')):
        bm = J('blender/manifest.json')
        c['blender_recipes'] = len(bm['recipes'])
        c['blender_art_loops'] = sum(1 for k in bm['recipes'] if k.startswith('blender/art.'))
        c['blender_presets'] = len(bm.get('library', {}).get('lib/device.py', {}).get('presets', []))
        c['blender_previews'] = len(bm.get('showcase', {}))
    pdir = os.path.join(REPO, 'physics/examples')
    if os.path.isdir(pdir):
        c['physics_specs'] = sum(1 for f in os.listdir(pdir) if f.endswith('.spec.json'))
        c['physics_tables'] = sum(1 for f in os.listdir(pdir) if f.endswith('.table.json'))
    tdir = os.path.join(REPO, 'terminal')
    if os.path.exists(os.path.join(tdir, 'manifest.json')):
        c['terminal_recipes'] = len(json.load(open(os.path.join(tdir, 'manifest.json')))['recipes'])
    idx = os.path.join(REPO, 'catalog/index.html')
    if os.path.exists(idx):
        m = re.search(r'const DATA = (\{.*?\});\n', open(idx, encoding='utf-8').read(), re.S)
        if m:
            d = json.loads(m.group(1))
            c['catalog_total'] = len(d['items'])
    return c


def table(c):
    n = len(c['templates'])
    rows = [
        ('`transitions/`', f"{c['transitions']} transitions: {c['transitions_dom']} with an exact DOM back-end, {c['transitions_dom_approx']} WebGL with a DOM approximation, "
                           f"{c['transitions_timing_only']} timing-only (speed ramp); {c['transition_aliases']} aliases incl. {c['xfade_modes']} ffmpeg xfade modes", '`transitions/README.md`'),
        ('`cuts/`', f"{c['cut_patterns']} cut patterns (beat grids, sections, J/L splits, talking-head, story shapes, pace) + {c['cut_rules']} rule sets + {c['retime_presets']} retime presets", '`cuts/README.md`'),
        ('`sfx/`', f"{c['sfx']} synthesised sounds in {c['sfx_families']} families, {c['sfx_bundles']} role bundles per video type", '`sfx/README.md`'),
        ('`music/`', f"{c['music_beds']} beds from {c['music_presets']} style presets, {c['music_stingers']} stingers, {c['music_logos']} sonic logos, plus the mixer", '`music/README.md`'),
        ('`layers/`', f"{c['layers']} finishing components (overlays, grades, grain stocks, finisher) incl. {c['looks']} looks; {c['lut_files']} `.cube` LUTs", '`layers/README.md`'),
        ('`type/`', f"{c['type']} kinetic-type presets, caption styles, icons, editor graphics and stickers", '`type/README.md`'),
        ('`camera/`', f"{c['camera']} 2D and 3D camera moves", '`camera/README.md`'),
        ('`objects/`', f"{c['objects']} three.js props, set pieces and one rigged character", '`objects/README.md`'),
        ('`templates/`', f"{n} genre templates: {', '.join(c['templates'])}", '`templates/README.md`'),
    ]
    if 'blender_recipes' in c:
        rows.append(('`blender/`', f"{c['blender_recipes']} Blender recipes for photoreal plates ({c['blender_recipes'] - c['blender_art_loops']} product and scene plates, "
                                   f"{c['blender_art_loops']} seamless art loops), {c['blender_presets']} device presets, {c['blender_previews']} showcase previews", '`blender/README.md`'))
    if 'physics_specs' in c:
        rows.append(('`physics/`', f"build-time rigid-body baking (Rapier) with a dependency-free table player; {c['physics_specs']} example specs, "
                                   f"{c['physics_tables']} baked table", '`physics/README.md`'))
    if 'terminal_recipes' in c:
        rows.append(('`terminal/`', f"{c['terminal_recipes']} baked flock looks (cbirds, fetched and built at a pinned commit): "
                     "flock, braille, a word the flock writes, 3D murmuration, code that flies", '`terminal/README.md`'))
    out = ['| module | what | read first |', '|---|---|---|'] + [f'| {a} | {b} | {d} |' for a, b, d in rows]
    if c.get('catalog_total'):
        out.append(f"\nThe catalog lists **{c['catalog_total']}** browsable components. Counts generated by `python3 tools/count.py`.")
    else:
        out.append('\nCounts generated by `python3 tools/count.py`.')
    return '\n'.join(out)


if __name__ == '__main__':
    c = counts()
    if '--json' in sys.argv:
        print(json.dumps(c, indent=1)); sys.exit(0)
    t = table(c)
    if '--write' in sys.argv or '--check' in sys.argv:
        p = os.path.join(REPO, 'README.md'); s = open(p, encoding='utf-8').read()
        if '<!-- counts:start -->' not in s or '<!-- counts:end -->' not in s:
            sys.exit('README.md has no <!-- counts:start --> / <!-- counts:end --> markers')
        new = re.sub(r'<!-- counts:start -->.*?<!-- counts:end -->', lambda m: '<!-- counts:start -->\n' + t + '\n<!-- counts:end -->', s, flags=re.S)
        if '--check' in sys.argv:
            ok = new == s
            print('README counts', 'up to date' if ok else 'STALE: run python3 tools/count.py --write'); sys.exit(0 if ok else 1)
        open(p, 'w', encoding='utf-8').write(new); print('README counts written')
    else:
        print(t)
