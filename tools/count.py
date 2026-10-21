#!/usr/bin/env python3
"""motion-pack / tools / count.py: count what is in the pack from the registries and manifests (never typed by hand).

    python3 tools/count.py            # print the "What's inside" table (Markdown)
    python3 tools/count.py --json     # the raw counts
    python3 tools/count.py --write    # rewrite the table between <!-- counts:start --> and <!-- counts:end --> in README.md, and every inline marker (below)
    python3 tools/count.py --check    # exit 1 if README.md or any inline marker is out of date (CI runs this)

Inline markers keep a number in prose honest: write `<!--n:KEY-->301<!--/n-->` anywhere in a tracked .md file (the comment is invisible when rendered); --write fills in the value, --check fails when it
is stale or the KEY is unknown. KEYs are listed by `python3 tools/count.py --keys`."""
import json, os, re, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
J = lambda p: json.load(open(os.path.join(REPO, p), encoding='utf-8'))


def _tracked(rel):
    """True unless git says the file is untracked (private or local work in an ignored folder must not change the public counts).
    Outside a git checkout everything counts."""
    try:
        r = subprocess.run(['git', '-C', REPO, 'ls-files', '--error-unmatch', rel], capture_output=True)
    except OSError:
        return True
    if r.returncode == 0:
        return True
    inside = subprocess.run(['git', '-C', REPO, 'rev-parse', '--is-inside-work-tree'], capture_output=True)
    return inside.returncode != 0


def _node_json(script):
    """one JSON object from a small ES-module script (counts that live in JS registries); {} if node is missing"""
    try:
        r = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, cwd=REPO, timeout=120)
    except OSError:
        return {}
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}


def _extra():
    """counts that need the code, not a manifest: type presets, transition internals, character poses, the music presets, the launch-film table"""
    c = {}
    js = _node_json("""
      const u = (p) => import(new URL(p, 'file://' + process.cwd() + '/').href);
      const [t, sx, rx, dx, dom, po] = await Promise.all([u('type/presets.js'), u('transitions/lib/tx-shaders-x.js'), u('transitions/lib/registry-x.js'), u('transitions/lib/tx-dom-x.js'), u('transitions/lib/tx-dom.js'), u('objects/characters/poses.js')]);
      const GENERIC = ['front', 'pointR', 'waveR', 'shrug', 'facepalm', 'armsCrossed'];
      console.log(JSON.stringify({ type_presets: t.PRESET_IDS.length, shaders_x: Object.keys(sx.SHADERS_X).length, registry_x: Object.keys(rx.REGISTRY_X).length, dom_x: Object.keys(dx.DOM_X).length,
        dom_base: dom.DOM_KEYS.length - Object.keys(dx.DOM_X).length, poses: Object.keys(po.POSES).length, poses_film: Object.keys(po.POSES).filter((k) => !GENERIC.includes(k)).length }));""")
    c.update(js)
    import importlib.util
    spec = importlib.util.spec_from_file_location('mp_music_presets', os.path.join(REPO, 'music', 'presets.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    c['music_presets_py'] = len(m.PRESETS); c['music_progressions'] = len(m.PROGRESSIONS)
    lf = os.path.join(REPO, 'docs', 'evidence', 'launch-films-2026.md')
    if os.path.exists(lf):   # one table row per film in sections A, B and C (the header row of each table is not a film)
        sec, rows = '', 0
        for line in open(lf, encoding='utf-8').read().split('\n'):
            if line.startswith('## '): sec = line[3:4]
            elif sec in ('A', 'B', 'C') and line.startswith('|') and not line.startswith('|---') and not line.startswith('| Launch'): rows += 1
        c['launch_films'] = rows
    pb = os.path.join(REPO, 'playbook')   # v0.5 playbook: rules by status, formats, the lint checks that enforce them
    if os.path.isdir(os.path.join(pb, 'rules')):
        rules = [r for f in sorted(os.listdir(os.path.join(pb, 'rules'))) if f.endswith('.json') and _tracked('playbook/rules/' + f)
                 for r in json.load(open(os.path.join(pb, 'rules', f), encoding='utf-8'))]
        for st in ('enforced', 'default', 'part', 'prose-only'):
            c['playbook_' + st.replace('-', '_')] = sum(1 for r in rules if r.get('status') == st)
        c['playbook_rules'] = len(rules)
        c['playbook_formats'] = sum(1 for f in os.listdir(os.path.join(pb, 'formats')) if f.endswith('.json') and _tracked('playbook/formats/' + f)) if os.path.isdir(os.path.join(pb, 'formats')) else 0
        sd = os.path.join(pb, 'styles')   # v0.6: named visual styles and the prompt gallery
        c['playbook_styles'] = sum(1 for f in os.listdir(sd) if f.endswith('.json') and _tracked('playbook/styles/' + f)) if os.path.isdir(sd) else 0
        pj = os.path.join(pb, 'prompts.json')
        c['gallery_prompts'] = len(json.load(open(pj, encoding='utf-8')).get('prompts') or []) if os.path.exists(pj) and _tracked('playbook/prompts.json') else 0
        sys.path.insert(0, os.path.join(REPO, 'tools'))
        import playbook_checks
        c['playbook_checks'] = len(playbook_checks.CHECKS)
    return c


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
    for c_k, c_v in _extra().items():
        c[c_k] = c_v
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
    c['objects_characters'] = sum(1 for line in src.split('\n') if re.match(r"\s*'objects/[a-z0-9-]+': r\(", line)
                                  for tags in [re.search(r"\[((?:'[^']*',?\s*)+)\]", line)] if tags and "'character'" in tags.group(1) and "'material'" not in tags.group(1))   # rigged / flat characters, not the clay material
    tdirs = sorted(d for d in os.listdir(os.path.join(REPO, 'templates')) if os.path.isdir(os.path.join(REPO, 'templates', d)) and not d.startswith('_'))
    c['templates'] = [d for d in tdirs if not d.startswith('demo-') and os.path.exists(os.path.join(REPO, 'templates', d, 'config.mjs')) and _tracked(f'templates/{d}/config.mjs')]   # genre templates
    c['template_demos'] = [d for d in tdirs if d.startswith('demo-') and (_tracked(f'templates/{d}/make.mjs') or _tracked(f'templates/{d}/config.mjs'))]   # part demos (some have a config.mjs, most do not)
    cam = J('camera/manifest.json')['components']
    c['camera_2d'] = sum(1 for x in cam if x['kind'] == 'camera-2d'); c['camera_3d'] = sum(1 for x in cam if x['kind'] == 'camera-3d')
    c['camera_moves'] = c['camera_2d'] + c['camera_3d']; c['camera_helpers'] = len(cam) - c['camera_moves']   # helpers: tools, presets and the HyperFrames binding
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
    em = os.path.join(REPO, 'ears/manifest.json')
    if os.path.exists(em):
        c['ears_checks'] = len(json.load(open(em))['checks'])
    sm = os.path.join(REPO, 'storyboard/manifest.json')
    if os.path.exists(sm):
        c['storyboard_checks'] = len(json.load(open(sm))['checks'])
    pj = os.path.join(REPO, 'patterns', 'structures.json')
    if os.path.isfile(pj):
        c['pattern_structures'] = len(json.load(open(pj))['structures'])
        hj = os.path.join(REPO, 'patterns', 'hooks.json')
        H = json.load(open(hj)) if os.path.isfile(hj) else {}
        c['pattern_hooks'] = len(H.get('hooks', H.get('archetypes', []))) if isinstance(H, dict) else len(H)
    dp = os.path.join(REPO, 'tools', 'deliver.py')
    if os.path.isfile(dp):   # the delivery presets, read from tools/deliver.py PRESETS (stdlib-only module)
        import importlib.util
        spec = importlib.util.spec_from_file_location('mp_deliver', dp); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        c['deliver_presets'] = len(mod.PRESETS)
    ym = os.path.join(REPO, 'eyes/manifest.json')
    if os.path.exists(ym):
        c['eyes_checks'] = len(json.load(open(ym))['checks'])
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
        ('`camera/`', f"{c['camera_moves']} camera moves ({c['camera_2d']} 2D, {c['camera_3d']} 3D) plus {c['camera_helpers']} helpers (lock, sequence, lint, CSS and GSAP export, presets, bake)", '`camera/README.md`'),
        ('`objects/`', f"{c['objects']} three.js props, set pieces and materials, with {c['objects_characters']} characters (a rigged 3D worker and a flat 2D mascot)", '`objects/README.md`'),
        ('`templates/`', f"{n} genre templates: {', '.join(c['templates'])}; plus {len(c['template_demos'])} part demos (`demo-*`) that show the newer parts", '`templates/README.md`'),
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
    if 'ears_checks' in c:
        rows.append(('`ears/`', f"automated listening and critique of a delivered MP4 or WAV: {c['ears_checks']} checks (loudness, clipping, tone, speech, sync scored by edit mode "
                                "(music, VO or continuous), structure with planned quiet judged as shape, repetition, stereo, reference comparison, optional mood), each with a fix and timestamps", '`ears/README.md`'))
    if 'storyboard_checks' in c:
        rows.append(('`storyboard/`', f"a storyboard sheet (PNG, HTML, PDF) and an animatic MP4 drawn from `shotlist.json` before any build: one panel per shot with the text at its real size and the safe zone, "
                                      f"{c['storyboard_checks']} checks (the story-script linter, reading speed, safe zone, label hold, panel count, animatic duration to the frame and loudness), real key frames from a built composition, "
                                      "the sound intent as real sounds mastered to the pack spec", '`storyboard/README.md`'))
    if 'eyes_checks' in c:
        rows.append(('`eyes/`', f"automated looking and critique of a delivered MP4's picture, the visual twin of ears: {c['eyes_checks']} checks (frame 0, black and frozen frames, WCAG flashes, banding, "
                                "safe zones, text size / time / contrast, pacing, composition, encode), each with a fix and timestamps", '`eyes/README.md`'))
    if 'pattern_structures' in c:   # xp research lane: beat sheets + the structure checker
        rows.append(('`patterns/`', f"{c['pattern_structures']} beat sheets (section timing as % of runtime, ASL, text ceilings, music intensity, sound role, CTA window, cut-downs), "
                                    f"{c['pattern_hooks']} hook archetypes with frame-0 rules, CTA placement and platform lengths, all graded and sourced in `docs/evidence/`; "
                                    "`tools/structure_check.py` scores a plan against them", '`patterns/README.md`'))
    if c.get('playbook_rules'):   # v0.5: the learnings as graded rules, bundled into formats
        rows.append(('`playbook/`', f"{c['playbook_rules']} graded rules learned from studied films and our own renders ({c['playbook_enforced']} enforced by {c['playbook_checks']} `mp lint` checks, "
                                    f"{c['playbook_default']} written in by `mp plan`, {c['playbook_part']} carried by a part, {c['playbook_prose_only']} prose-only gaps) and {c['playbook_formats']} formats "
                                    "(beats as fractions of the runtime, sound shape, exemplars, recommended parts, signals)"
                                    + (f", {c['playbook_styles']} named visual styles (palette, type, motion, transitions, layers, sound, signature features) and {c['gallery_prompts']} gallery prompts" if c.get('playbook_styles') else '')
                                    + ": `mp brief`, `mp plan`, `mp styles`, `mp lint`, `mp study`", '`playbook/README.md`'))
    if os.path.isfile(os.path.join(REPO, 'tools', 'deliver.py')):   # xp access lane
        rows.append(('delivery + accessibility', "`tools/captions/`, `tools/describe/`, `tools/a11y_check.py`, `tools/deliver.py`, `tools/lottie/`: captions (SRT / WebVTT / IMSC1.1 TTML / burned in, SDH) "
                     f"to 42 chars, 2 lines, 20 cps (17 kids); an audio-description script (standard + extended, no TTS); an accessibility lint (flash, caption contrast, size, reading time, colour-blind, colour-only); "
                     f"{c['deliver_presets']} platform delivery presets with BT.709 tags, faststart and loudness by source; Lottie export of kinetic type and draw-on icons", '`docs/DELIVERY-AND-ACCESSIBILITY.md`'))
    if os.path.isdir(os.path.join(REPO, 'cloud')):
        rows.append(('`cloud/`', "optional paid Google Cloud audio back-ends (your project, your bill): Lyria music beds, "
                     "Gemini Live voiceover with a word-for-word check, a Gemini mood judge", '`cloud/README.md`'))
    out = ['| module | what | read first |', '|---|---|---|'] + [f'| {a} | {b} | {d} |' for a, b, d in rows]
    if c.get('catalog_total'):
        out.append(f"\nThe catalog lists **{c['catalog_total']}** browsable components. Counts generated by `python3 tools/count.py`.")
    else:
        out.append('\nCounts generated by `python3 tools/count.py`.')
    return '\n'.join(out)


MARK = re.compile(r'<!--n:([a-z0-9_]+)-->(.*?)<!--/n-->', re.S)


def inline_values(c):
    """KEY -> text for the inline markers: every number in counts(), plus the template list sizes"""
    v = {k: str(x) for k, x in c.items() if isinstance(x, int) and not isinstance(x, bool)}
    v['templates_genre'], v['template_demos_n'] = str(len(c['templates'])), str(len(c['template_demos']))
    v['transitions_visual'] = str(c['transitions_dom'] + c['transitions_dom_approx'])   # every transition with a picture effect in the DOM (speedRamp is timing-only)
    return v


def fill(text, vals):
    """(text with every <!--n:KEY-->..<!--/n--> set to vals[KEY], the unknown KEYs)"""
    bad = []

    def one(m):
        if m.group(1) not in vals:
            bad.append(m.group(1)); return m.group(0)
        return f'<!--n:{m.group(1)}-->{vals[m.group(1)]}<!--/n-->'
    return MARK.sub(one, text), bad


def marked_files():
    """tracked Markdown files that carry at least one inline marker"""
    try:
        r = subprocess.run(['git', '-C', REPO, 'ls-files', '*.md'], capture_output=True, text=True, check=True)
        names = [n for n in r.stdout.split('\n') if n]
    except (OSError, subprocess.CalledProcessError):
        names = [os.path.relpath(os.path.join(d, f), REPO) for d, _, fs in os.walk(REPO) if '.git' not in d and 'node_modules' not in d for f in fs if f.endswith('.md')]
    return [n for n in names if os.path.exists(os.path.join(REPO, n)) and '<!--n:' in open(os.path.join(REPO, n), encoding='utf-8').read()]


if __name__ == '__main__':
    c = counts()
    if '--json' in sys.argv:
        print(json.dumps(c, indent=1)); sys.exit(0)
    if '--keys' in sys.argv:
        print('\n'.join(f'{k} = {v}' for k, v in sorted(inline_values(c).items()))); sys.exit(0)
    t = table(c)
    if '--write' in sys.argv or '--check' in sys.argv:
        p = os.path.join(REPO, 'README.md'); s = open(p, encoding='utf-8').read()
        if '<!-- counts:start -->' not in s or '<!-- counts:end -->' not in s:
            sys.exit('README.md has no <!-- counts:start --> / <!-- counts:end --> markers')
        new = re.sub(r'<!-- counts:start -->.*?<!-- counts:end -->', lambda m: '<!-- counts:start -->\n' + t + '\n<!-- counts:end -->', s, flags=re.S)
        vals, stale, unknown, rewrite = inline_values(c), [], [], {}
        for n in marked_files():
            old = new if n == 'README.md' else open(os.path.join(REPO, n), encoding='utf-8').read(); fixed, bad = fill(old, vals)   # README.md: fill the markers on top of the new table, or the write would undo it
            unknown += [f'{n}: <!--n:{k}-->' for k in bad]
            if fixed != old:
                stale.append(n); rewrite[n] = fixed
        if '--check' in sys.argv:
            ok = new == s and not stale and not unknown
            print('README counts', 'up to date' if new == s else 'STALE: run python3 tools/count.py --write')
            print('inline counts', 'up to date' if not stale else 'STALE in ' + ', '.join(stale) + ': run python3 tools/count.py --write', f'({len(marked_files())} files)')
            for u in unknown: print('UNKNOWN KEY', u, '(python3 tools/count.py --keys lists them)')
            sys.exit(0 if ok else 1)
        open(p, 'w', encoding='utf-8').write(rewrite.get('README.md', new)); print('README counts written')
        for n, text in rewrite.items():
            if n != 'README.md': open(os.path.join(REPO, n), 'w', encoding='utf-8').write(text)
        print('inline counts written:', ', '.join(rewrite) or 'nothing to change')
        if unknown: sys.exit('UNKNOWN KEY ' + '; '.join(unknown))
    else:
        print(t)
