"""motion-pack/catalog/build.py: offline gallery of every component in the pack.
    python3 catalog/build.py        ->  catalog/index.html (one self-contained page, zero external requests)
Reads the module manifests (they are the source of truth) and writes one JSON blob into the page. Media is referenced by
relative path (../<module>/...), so open the page from disk (file://) or any static server rooted at the pack.
SFX and music cards carry a tiny waveform computed here from the WAV (peak envelope, 48 points), or from the MP3 preview when the WAV
masters are absent. Media resolves to the committed previews (tools/make_previews.py): .png -> .jpg, <module>/library/*.wav -> <module>/previews/*.mp3."""
import os, re, json, glob, wave, html, subprocess
import numpy as np

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(PACK, 'catalog', 'index.html')
def preview_of(p):
    """the committed browser preview of a media file: <m>/library/<x>.wav -> <m>/previews/<x>.mp3, <x>.png -> <x>.jpg"""
    r = os.path.relpath(p, PACK)
    for lib, prev in (('sfx/library/', 'sfx/previews/'), ('music/library/', 'music/previews/')):
        if r.startswith(lib) and r.endswith('.wav'): return os.path.join(PACK, prev + r[len(lib):-4] + '.mp3')
    return p[:-4] + '.jpg' if r.endswith('.png') else None


def rel(p):
    """URL (relative to catalog/) of the file the page loads: the preview when there is one, else the original"""
    if not p: return None
    for c in (preview_of(p), p):
        if c and os.path.exists(c): return '../' + os.path.relpath(c, PACK)
    return None
J = lambda p: json.load(open(os.path.join(PACK, p)))


def wave_env(path, n=48):
    if not os.path.exists(path):          # no WAV master: decode the MP3 preview with ffmpeg
        pv = preview_of(path)
        if not pv or not os.path.exists(pv): return None
        try: raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', pv, '-f', 'f32le', '-ac', '2', '-'], capture_output=True, check=True).stdout
        except Exception: return None
        a = np.abs(np.frombuffer(raw, '<f4').reshape(-1, 2)).max(1)
        e = np.array([s.max() if len(s) else 0 for s in np.array_split(a, n)]); m = e.max() or 1
        return [round(float(x / m), 2) for x in e]
    try:
        with wave.open(path) as w:
            ch, sw, fr = w.getnchannels(), w.getsampwidth(), w.getnframes()
            raw = w.readframes(fr)
        if sw == 2: a = np.frombuffer(raw, '<i2').astype(np.float32) / 32768
        elif sw == 3:
            b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
            a = ((b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16)) << 8 >> 8) / 8388608.0
        elif sw == 4: a = np.frombuffer(raw, '<f4') if 'float' in path else np.frombuffer(raw, '<i4') / 2147483648.0
        else: return None
        a = np.abs(a.reshape(-1, ch)).max(1)
        seg = np.array_split(a, n)
        e = np.array([s.max() if len(s) else 0 for s in seg]); m = e.max() or 1
        return [round(float(x / m), 2) for x in e]
    except Exception:
        return None


items = []
def add(cat, id, name, tags=(), desc='', thumb=None, video=None, audio=None, params=None, pairs=None, meta=None, use=None, avoid=None, wave_=None, file=None, grid=None):
    items.append({k: v for k, v in dict(cat=cat, id=id, name=name, tags=sorted(set(t for t in tags if t)), desc=desc, thumb=thumb, video=video, audio=audio,
                                         params=params, pairs=pairs, meta=meta, use=use, avoid=avoid, wave=wave_, file=file, grid=grid).items() if v not in (None, '', [], {})})


def beat_cuts(name, beats):
    b = pat['beat'].get(name)
    if not b: return []
    return [round(c + k * b['cycle_beats'], 3) for k in range(int(beats // b['cycle_beats']) + 1) for c in b['cuts'] if c + k * b['cycle_beats'] < beats]


# ---------- transitions ----------
cat = J('transitions/catalog.json')
for t in cat['transitions']:
    st = sorted({f[:-4] + '.png' for f in glob.glob(os.path.join(PACK, 'transitions', 'renders', 'stills', t['key'], 'f*.*')) if f.endswith(('.png', '.jpg'))})
    add('transitions', 'transitions/' + t['key'], t['name'], t.get('tags', []) + ['gl' if t.get('gl') else '', 'dom' if t.get('dom') else 'dom-approx' if t.get('dom_approx') else 'gl-only'],
        thumb=rel(st[len(st) // 2]) if st else None, video=rel(os.path.join(PACK, 'transitions', t['demo']['mp4'])) if t.get('demo', {}).get('mp4') else None,
        params={k: {kk: v[kk] for kk in ('type', 'default', 'opts', 'min', 'max', 'doc') if kk in v} for k, v in t.get('params', {}).items()},
        pairs={'sfx': [f"{s['id']} @{s['at']}{'+' + str(s['offset_f']) + 'f' if s.get('offset_f') else ''} {s.get('gain_db', 0):+g} dB" for s in t.get('sfx', [])],
               'reasons': t.get('reasons', [])},
        meta={'backends': ', '.join(t.get('backends', [])), 'timing': f"{t['timing']['ms']} ms / {t['timing']['beats']} beat, cut at {t['timing']['cut']}, ease {t['timing']['ease']}, {t['timing'].get('frames_30fps')} f @30"},
        use=t.get('use'), avoid=t.get('avoid'), file='transitions/lib/registry.js')
aliases = J('transitions/aliases.json')['aliases'] if os.path.exists(os.path.join(PACK, 'transitions/aliases.json')) else {}

# ---------- cuts ----------
pat = J('cuts/patterns.json')
for grp in ('beat', 'sections', 'split', 'talking_head', 'story', 'interrupts', 'pace', 'smash', 'onset_snap'):
    v = pat.get(grp)
    if not isinstance(v, dict): continue
    if grp in ('interrupts', 'smash', 'onset_snap'):
        d = v.get('use') or v.get('note') or ''
        add('cuts', f'cuts/{grp}', grp.replace('_', ' '), ['cuts', grp], desc=d if isinstance(d, str) else '', params={k: x for k, x in v.items() if k not in ('use', 'note')}, file='cuts/patterns.json')
        continue
    for k, x in v.items():
        d = x.get('desc') or x.get('use') or x.get('doc') or '' if isinstance(x, dict) else ''
        grid = None
        if grp == 'beat': grid = {'beats': 8, 'cuts': beat_cuts(k, 8)}
        elif grp == 'sections' and isinstance(x, dict) and x.get('segments'):
            t0, cs = 0, []
            for sg in x['segments']:
                n = sg.get('bars', 1) * 4; cs += [t0 + c for c in beat_cuts(sg.get('pattern', ''), n)]; t0 += n
            grid = {'beats': t0, 'cuts': cs} if t0 else None
        add('cuts', f'cuts/{grp}/{k}', k.replace('_', ' '), ['cuts', grp], desc=d if isinstance(d, str) else '', grid=grid,
            params={kk: vv for kk, vv in x.items() if kk not in ('desc', 'use', 'doc')} if isinstance(x, dict) else {'value': x}, file='cuts/patterns.json')

# ---------- retime presets (cuts/retime.json) + ffmpeg xfade modes (transitions/lib/xfade.js via aliases.json) ----------
if os.path.exists(os.path.join(PACK, 'cuts/retime.json')):
    for k, v in J('cuts/retime.json')['presets'].items():
        add('cuts', f'cuts/retime/{k}', 'retime ' + k, ['cuts', 'retime', 'speed-ramp'], desc=v.get('use', ''), params={kk: vv for kk, vv in v.items() if kk != 'use'},
            pairs={'sfx': [f"{x[0]} @{x[1]}+{x[2]}f {x[3]:+g} dB" for x in v.get('sfx', [])]}, meta={'tool': 'python3 cuts/retime.py ffmpeg --preset ' + k}, file='cuts/retime.json')
xf = sorted(k for k in aliases if k.startswith('xfade-'))
if xf: add('transitions', 'transitions/xfade-<mode>', f'ffmpeg xfade modes ({len(xf)})', ['ffmpeg', 'xfade', 'finisher', 'server-render'], desc='Every ffmpeg xfade mode as a pack id; each maps to the nearest pack transition for DOM/GL. xfadeFilter(id, {duration, offset}) in transitions/lib/xfade.js.',
    params={'modes': [k[6:] for k in xf]}, file='transitions/lib/xfade.js')

# ---------- sfx ----------
TXIDS = {t['key'] for t in cat['transitions']} | set(J('transitions/aliases.json')['aliases'] if os.path.exists(os.path.join(PACK, 'transitions/aliases.json')) else {})
sm = J('sfx/manifest.json')
for s in sm['sounds']:
    f = os.path.join(PACK, 'sfx', s['file'])
    cat_, name = s['id'].split('.', 2)[1:]
    add('sfx', f"sfx/{cat_}/{name}", name.replace('_', ' '), s.get('tags', []) + [s['category']] + ['use:' + u for u in s.get('use', [])], desc=s.get('desc', ''),
        audio=rel(f), wave_=wave_env(f),
        meta={'registry id': s['id'], 'duration': f"{s['duration_s']} s", 'LUFS-I': s.get('lufs_integrated'), 'true peak': f"{s.get('true_peak_dbtp')} dBTP",
              'anchor': f"{s.get('anchor_kind')} @ {s.get('anchor_ms')} ms", 'tier': s.get('tier'), 'phone safe': s.get('phone_safe'), 'place rule': s.get('place_rule')},
        pairs={'transitions': ['transitions/' + p for p in s.get('pairs_with', []) if p in TXIDS] + ['edit kind ' + p for p in s.get('pairs_with', []) if p not in TXIDS],
               'roles': s.get('roles', [])}, file='sfx/' + s['file'])
bundles = J('sfx/bundles.json')
for k, b in bundles.items():
    if not isinstance(b, dict): continue
    add('sfx bundles', f'bundles/{k}', k.replace('_', ' '), ['bundle', k], desc=b.get('desc', ''),
        params={'roles': b.get('roles', {}), 'bed': b.get('bed'), 'bpm': b.get('bpm'), 'lufs': b.get('lufs')}, file='sfx/bundles.json')

# ---------- music ----------
mm = J('music/manifest.json')
for m in mm['items']:
    f = os.path.join(PACK, 'music', m['file'])
    meta = {'registry id': m['id'], 'duration': f"{m.get('duration_s', '')} s" if m.get('duration_s') else None, 'bpm': m.get('bpm'), 'key': f"{m.get('key', '')} {m.get('scale', '')}".strip(),
            'LUFS-I': m.get('lufs_i'), 'true peak': m.get('true_peak_db'), 'loop': m.get('loop'), 'frames/beat': m.get('frames_per_beat'), 'drop frames': m.get('drop_frames') or None}
    add('music', 'music/' + m['id'].split('.', 1)[1], m['id'].split('.', 1)[1].replace('_', ' '), m.get('tags', []) + [m['kind']] + m.get('mood', []) + ['use:' + u for u in m.get('use', [])],
        desc=m.get('desc', ''), audio=rel(f), wave_=wave_env(f), meta={k: v for k, v in meta.items() if v not in (None, '')}, file='music/' + m['file'])

# ---------- layers / type / camera ----------
for mod in ('layers', 'type', 'camera'):
    for c in J(f'{mod}/manifest.json')['components']:
        demo = (c.get('demo') or '').split('|')[0].strip()
        if demo and not demo.startswith(mod + '/'): demo = os.path.join(mod, os.path.dirname(c.get('demo', '').split('|')[0].strip()), demo)
        add(mod, f"{mod}/{c['id']}", c['id'], c.get('tags', []) + [c.get('kind', '')], desc=c.get('measured', '') or c.get('doc', ''),
            thumb=rel(os.path.join(PACK, demo)) if demo and not demo.endswith('.mp4') else None,
            video=rel(os.path.join(PACK, demo)) if demo and demo.endswith('.mp4') else None,   # a demo clip plays as video, never as an <img>

            params={k: v for k, v in c.items() if k not in ('id', 'file', 'tags', 'demo', 'test', 'kind', 'measured', 'doc')}, meta={'kind': c.get('kind'), 'test': c.get('test')}, file=c.get('file'))

# ---------- objects (parsed from objects/index.js REGISTRY; three.js is not importable in node) ----------
src = open(os.path.join(PACK, 'objects', 'index.js')).read()
hero = {n: rel(os.path.join(PACK, f'objects/qa/hero-{n}/f0100.png')) for n in ('laptop', 'phone', 'mug')}
hero.update({n: rel(os.path.join(PACK, 'objects/qa/dome-r1/f0110.png')) for n in ('glass-dome', 'icon-orbit', 'clay')})
hero.update({'mascot2d': rel(os.path.join(PACK, 'objects/qa/mascot2d/poses.png')), 'logo-extrude': rel(os.path.join(PACK, 'objects/qa/r3-r1/f0075.png'))})
for m in re.finditer(r"'(objects/[a-z0-9-]+)': r\(.*?\[([^\]]*)\], '([^']*)', '([^']*)'\)", src):
    oid, tags, state, doc = m.group(1), [x.strip(" '") for x in m.group(2).split(',')], m.group(3), m.group(4)
    n = oid.split('/')[1]
    thumb = hero.get(n) or rel(os.path.join(PACK, 'objects/qa/cast-r2/sheet.jpg' if n == 'worker' else 'objects/qa/film-r2/sheet.jpg'))
    add('objects', oid, n, tags + ['three'], desc=doc, thumb=thumb, meta={'state API': state}, file='objects/index.js')
add('objects', 'objects/characters/poses', 'poses + emotions + acts', ['character', 'acts', 'emotions'], desc='45 film poses + 6 generic, 6 emotions (emote), timed acts (doubleTake, shrug, wave, point, cheer, facepalm, slowBurn, slump, jumpScare, danceBob)',
    thumb=rel(os.path.join(PACK, 'objects/qa/cast-r2/sheet.jpg')), file='objects/characters/poses.js')

# ---------- blender: photoreal plates (blender/manifest.json; previews committed in blender/previews/, renders are not) ----------
BM = os.path.join(PACK, 'blender', 'manifest.json')
if os.path.exists(BM):
    bm = json.load(open(BM))
    plates = bm.get('showcase', {})
    for rid, rec in bm['recipes'].items():
        mine = [(k, v) for k, v in sorted(plates.items()) if v.get('recipe') == rid]
        thumb = next((rel(os.path.join(PACK, v['preview'])) for _, v in mine if v.get('preview')), None)
        if not thumb:   # a recipe outside the showcase: its 480p smoke-test still
            thumb = rel(os.path.join(PACK, 'blender', 'previews', rid.split('/', 1)[1] + '-smoke.jpg'))
        sheets = [rel(os.path.join(PACK, v['sheet'])) for _, v in mine if v.get('sheet')]
        timing = '; '.join(f"{k}: {v['mean_s_per_frame']} s/frame at {v['size'][0]}x{v['size'][1]} {v['engine']}" for k, v in mine if v.get('mean_s_per_frame'))
        dfl = rec.get('defaults', {})
        mod = 'blender/recipes/' + re.sub(r'([A-Z])', r'_\1', rid.split('/', 1)[1].replace('art.', 'art_')).lower() + '.py'
        add('blender', rid, rec.get('name', rid), ['blender', 'photoreal', 'plate', 'loop' if rec.get('loop') else '', 'art-loop' if rid.startswith('blender/art.') else 'product'],
            desc=rec.get('doc', ''), thumb=thumb,
            params={k: {kk: v[kk] for kk in ('type', 'default', 'opts', 'min', 'max', 'doc') if kk in v} for k, v in rec.get('params', {}).items()},
            meta={k: v for k, v in {'loop': rec.get('loop'), 'defaults': f"{dfl.get('seconds')} s, {'x'.join(map(str, dfl.get('size', [])))}, {dfl.get('engine')}",
                  'showcase render': timing or None, 'contact sheets': ', '.join(s for s in sheets if s) or None, 'cli': rec.get('cli')}.items() if v not in (None, '')},
            use=rec.get('use'), avoid=rec.get('avoid'), file=mod if os.path.exists(os.path.join(PACK, mod)) else 'blender/run.py')

# ---------- terminal: baked cbirds plates (terminal/manifest.json; JPEG previews committed in terminal/previews/, plates are not) ----------
TM = os.path.join(PACK, 'terminal', 'manifest.json')
if os.path.exists(TM):
    tm = json.load(open(TM))
    eng = tm['engine']
    for rid, rec in tm['recipes'].items():
        dfl = rec.get('defaults', {})
        add('terminal', rid, rec.get('name', rid), ['terminal', 'plate', 'flock', 'baked', 'loop' if rec.get('loop') else ''],
            desc=rec.get('doc', ''), thumb=rel(os.path.join(PACK, 'terminal', 'previews', rid.split('/', 1)[1] + '.jpg')),
            params={k: {kk: v[kk] for kk in ('type', 'default', 'opts', 'min', 'max', 'doc') if kk in v} for k, v in rec.get('params', {}).items()},
            meta={'defaults': f"{dfl.get('seconds')} s, {'x'.join(map(str, dfl.get('size', [])))}, 30 fps",
                  'engine': f"{eng['name']} {eng['version']} @ {eng['commit'][:7]} ({eng['licence']}, fetched by {eng['fetch']})", 'cli': rec.get('cli')},
            use=rec.get('use'), avoid=rec.get('avoid'), file='terminal/bake-plate.sh')

# ---------- templates ----------
TPL = {'ad': ('Ad 15/30 s: hook, problem, product, proof, CTA', 'out/ad-15.mp4', 'out/sheet.jpg'),
       'film-scene': ('Animated short-film scene', 'out/film-scene-wide.mp4', 'out/film-scene-wide-sheet.jpg'),
       'character-spot': ('mime-style character spot 16 s', 'out/character-spot-wide.mp4', 'out/character-spot-wide-sheet.jpg'),
       'talking-head': ('Talking-head / human edit (9:16)', 'out/talking-head.mp4', 'out/sheet.jpg'),
       'beat-edit': ('Music / beat edit', 'out/beat-edit.mp4', 'out/sheet.jpg'),
       'demo-type-layout': ('Type + layout parts demo 17.5 s (sentence-led product film)', 'out/demo-type-layout.mp4', 'out/sheet.jpg'),
       'demo-r3-type': ('Round-3 type + layout parts demo 17.5 s (brand-system tour)', 'out/demo-r3-type.mp4', 'out/sheet.jpg'),
       'demo-r45-type': ('Round-4/5 type + layers parts demo 20 s (many things -> one place)', 'out/demo-r45-type.mp4', 'out/sheet.jpg'),   # MP4 not committed: rebuild it
       'multi-voice-doc': ('Multi-voice documentary launch film (your interview clips + words.json; labelled placeholder demo 29 s)', 'out/multi-voice-doc.mp4', 'out/sheet.jpg')}   # MP4 not committed: rebuild it
IDRX = re.compile(r"['\"`]((?:transitions|sfx|music|type)/[A-Za-z0-9_./-]+)['\"`]")
for k, (name, vid, sheet) in TPL.items():
    cfg = open(os.path.join(PACK, 'templates', k, 'config.mjs')).read()
    used = sorted(set(IDRX.findall(cfg)))
    groups = {}
    for u in used: groups.setdefault(u.split('/')[0], []).append(u)
    add('templates', 'templates/' + k, name, ['template', k], desc=f'node templates/{k}/make.mjs (DOM) or templates/_shared/render3d.sh (three.js); edit the CONFIG block in config.mjs',
        thumb=rel(os.path.join(PACK, 'templates', k, sheet)), video=rel(os.path.join(PACK, 'templates', k, vid)), pairs=groups, file=f'templates/{k}/config.mjs')

counts = {}
for it in items: counts[it['cat']] = counts.get(it['cat'], 0) + 1
data = json.dumps({'items': items, 'counts': counts, 'aliases': sorted(aliases)}, separators=(',', ':')).replace('</', '<\\/')
page = open(os.path.join(PACK, 'catalog', 'page.html')).read().replace('/*__DATA__*/null', data).replace('__TOTAL__', str(len(items)))
assert not re.search(r'src=["\']https?:|<link[^>]+href=["\']https?:', page), 'external resource in the catalog page (plain links are fine)'
open(OUT, 'w').write(page)
print('catalog', OUT, len(items), 'components', counts, f'{len(page) / 1024:.0f} KiB')
