"""motion-pack/tools/check_ids.py: every cross-module id referenced anywhere in the pack must resolve.
    python3 tools/check_ids.py                # code, config and data files; exit 1 if any reference is unresolved
    python3 tools/check_ids.py --docs         # also every Markdown file (ids inside `backticks` and code fences); CI runs this
    python3 tools/check_ids.py [--docs] PATH  # scan these files or folders instead of the whole pack (your own scratch build)
Scans .js .mjs .py .json .html .sh (and, with --docs, .md; not renders, not node_modules) for the nine id families of SKILL.md hard rule 1, plus template and gfx ids:
  transitions/<name>   sfx/<cat>/<name>  snd.<cat>.<name>   music/<id>  music.<id>   type/<preset>   layers/<kind>   objects/<name>   blender/<recipe>
  cam2d.<move>  cam3d.<move>   cuts/<group>/<name>   cuts/retime/<preset>   templates/<name>
and resolves them against the module registries (sfx/mpaudio registry, music/manifest.json, transitions/catalog.json + aliases, type/presets.js PRESET_IDS + the ids of type/gfx/index.js GFX_IDS,
layers/manifest.json, objects/index.js, camera/manifest.json, cuts/patterns.json + cuts/retime.json, templates/*/, blender/manifest.json). In code a reference is a quoted string; in Markdown it is any id inside a `code span` or a
code fence. A bare layers/, objects/, cuts/, templates/, transitions/ or blender/ name that is a real folder or file in the pack (a path such as `layers/tests` or `blender/tests`) also resolves; names with an extension are paths and are not
checked. Placeholders (`<name>`, `*`, `...`) are skipped. NOT covered: the part ids of type/gfx (`ui.promptBar`, `counter.statCard`, `layout.cornerPin`, ...), which are looked up at run time by the
gfx registry (an unknown id is a run-time error there) and carry style names (`sticker.bell`, `caption.karaoke`) a text scan cannot tell from ids. Prints unresolved ids with file:line."""
import os, re, sys, json, importlib, subprocess, collections
PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(PACK, 'sfx'))
from mpaudio import registry
import recipes
for m in recipes.MODULES: importlib.import_module('recipes.' + m)
J = lambda p: json.load(open(os.path.join(PACK, p)))
def node_json(expr):
    return json.loads(subprocess.run(['node', '-e', "import('%s/%s').then(m=>console.log(JSON.stringify(%s)))" % (PACK, expr[0], expr[1])], capture_output=True, text=True).stdout)
SFX = set(registry.SOUNDS)
MUSIC = {i['id'] for i in J('music/manifest.json')['items']}
TX = {t['key'] for t in J('transitions/catalog.json')['transitions']}
TX_ALIAS = J('transitions/aliases.json')['aliases'] if os.path.exists(os.path.join(PACK, 'transitions/aliases.json')) else {}
TXOK = TX | set(TX_ALIAS) | {'cut'}
TYPE = set(node_json(('type/presets.js', 'm.PRESET_IDS')))
# type/<name> also resolves to the SVG kinetic pieces registered as 'type.<name>' in type/gfx/index.js (wordWheel, inlineMedia, marquee, ...)
GFX = set(node_json(('type/gfx/index.js', 'm.GFX_IDS')))
TYPE |= {i[5:] for i in GFX if i.startswith('type.')}
_BM = os.path.join(PACK, 'blender/manifest.json')
BLENDER = set(J('blender/manifest.json')['recipes']) if os.path.exists(_BM) else set()
OBJECTS = set(re.findall(r"'objects/([a-z0-9-]+)': r\(", open(os.path.join(PACK, 'objects/index.js'), encoding='utf-8').read()))
_LC = [c['id'] for c in J('layers/manifest.json')['components']]   # overlay.grain, look.duotone, grade.warm-film, background.dotGrid, layers.hexMosaic ...: `layers/<kind>` names the kind with or without its family prefix
LAYERS = set(_LC) | {i.split('.', 1)[1] for i in _LC if '.' in i}
CAM = {c['id'] for c in J('camera/manifest.json')['components']}
CAM |= {i.rsplit('.', 1)[0] for i in CAM if i.count('.') > 1}   # cam2d.dutchRoll.presets is part of cam2d.dutchRoll
_CP = J('cuts/patterns.json'); CUTS = {g: set(v) for g, v in _CP.items() if isinstance(v, dict)}
if os.path.exists(os.path.join(PACK, 'cuts/retime.json')): CUTS['retime'] = set(J('cuts/retime.json')['presets'])   # cuts/retime/heroRamp (cuts/retime.py presets)
isdir, exists = (lambda *p: os.path.isdir(os.path.join(PACK, *p))), (lambda *p: os.path.exists(os.path.join(PACK, *p)))
# one pattern per family; group 1 is the id. `B`/`E` are the boundaries: a quote in code, a non-id character in Markdown (so `objects/index.js` and `layers/<kind>` never match)
Q = ("['\"`]", "['\"`]"); MD = (r"(?<![A-Za-z0-9_./<-])", r"(?![A-Za-z0-9_./*<>-])")
def families(B, E):
    return [('sfx', re.compile(B + r"(sfx/[a-z0-9_]+/[a-z0-9_]+)" + E)), ('snd', re.compile(B + r"(snd\.[a-z0-9_]+\.[a-z0-9_]+)" + E)),
      ('music', re.compile(B + r"(music[/.](?:bed|sting|logo)_[a-z0-9_]+)" + E)), ('tx', re.compile(B + r"(transitions/[A-Za-z0-9_-]+)" + E)),
      ('type', re.compile(B + r"(type/[A-Za-z0-9_]+)" + E)),
      ('blender', re.compile(B + r"(blender/(?:art\.)?[a-z][A-Za-z0-9]*)" + E)),   # recipe ids only: file paths (blender/run.py) never match
      # layers ids may be dotted (layers/overlay.grain) and objects ids are matched in any case (objects/logoExtrude), so an off-style typo is reported, never skipped
      ('layers', re.compile(B + r"(layers/[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)?)" + E)), ('objects', re.compile(B + r"(objects/[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9]+)?)" + E)),
      ('cam', re.compile(B + r"(cam[23]d\.[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?)" + E)),
      ('cuts', re.compile(B + r"(cuts/[A-Za-z_]+(?:/[A-Za-z][A-Za-z0-9_-]*)?)" + E)), ('templates', re.compile(B + r"(templates/[A-Za-z0-9_-]+)" + E))]
RX, RX_MD = families(*Q), families(*MD)
SKIP_DIRS = {'.git', '.venv', 'venv', 'node_modules', 'renders', 'out', 'library', '__pycache__', 'research', 'fonts', 'media', 'dev1', 'dev2', 'external'}
FILE_EXT = {'js', 'mjs', 'json', 'md', 'py', 'html', 'sh', 'jpg', 'png', 'mp4', 'wav', 'test'}
SCRATCH = {'brewly'}   # template folders a doc tells you to create (examples/brewly-teaser/README.md)
SKIP_FILES = {'RUNLOG.md'}   # a log of one real agent run: it quotes the mistakes it made
def ok(kind, v):
    if kind == 'sfx': return 'snd.' + '.'.join(v.split('/')[1:]) in SFX
    if kind == 'snd': return v in SFX
    if kind == 'music': return 'music.' + re.split(r'[/.]', v, 1)[1] in MUSIC
    n = v.split('/', 1)[-1]   # the name after the folder: transitions/whip -> whip
    if kind == 'tx': return n in TXOK or isdir('transitions', n)
    if kind == 'type': return n in TYPE or isdir('type', n)
    if kind == 'blender': return v in BLENDER or isdir('blender', n)   # a recipe id, or a real folder of blender/ (`blender/tests` is a path, not a recipe id), as for layers/ objects/ cuts/ templates/
    if kind in ('layers', 'objects') and n.rsplit('.', 1)[-1] in FILE_EXT and '.' in n: return True   # a path (layers/README.md, objects/index.js), not an id
    if kind == 'layers': return n in LAYERS or exists('layers', n)
    if kind == 'objects': return n in OBJECTS or exists('objects', n)
    if kind == 'cam': return v in CAM or v.split('.')[1] in FILE_EXT   # cam2d.js, cam3d.js: the camera/ source files, not moves
    if kind == 'cuts':
        g, _, n = v[5:].partition('/')
        return (g in CUTS and (not n or n in CUTS[g])) or (not n and exists('cuts', g))
    if kind == 'templates': return isdir('templates', n) or n in SCRATCH
def md_spans(text):
    """(line number, text) of every `code span` and every line of a code fence in a Markdown file"""
    fence = False
    for n, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith('```'): fence = not fence; continue
        if fence: yield n, line
        else:
            for sp in re.findall(r'`([^`\n]+)`', line): yield n, sp
def scan(path, docs_md, seen, bad, rel):
    text = open(path, errors='ignore').read()
    if docs_md:
        for n, sp in md_spans(text):
            for kind, rx in RX_MD:
                for v in rx.findall(sp): hit(kind, v, rel, n, seen, bad)
    else:
        for n, line in enumerate(text.splitlines(), 1):
            for kind, rx in RX:
                for v in rx.findall(line): hit(kind, v, rel, n, seen, bad)
def hit(kind, v, rel, n, seen, bad):
    if kind == 'sfx' and v.startswith('sfx/demo'): return
    seen[kind] += 1
    if not ok(kind, v): bad[(kind, v)].append(f'{rel}:{n}')
wanted = lambda f, docs: f.endswith(('.js', '.mjs', '.py', '.json', '.html', '.sh')) or (docs and f.endswith('.md') and f not in SKIP_FILES)
def walk(roots, docs):
    for top in roots:
        if os.path.isfile(top):
            if wanted(os.path.basename(top), docs): yield top
            continue
        for root, dirs, files in os.walk(top):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not os.path.islink(os.path.join(root, d))]
            if os.path.relpath(root, PACK).startswith('tools'): continue
            for f in files:
                if wanted(f, docs):
                    p = os.path.join(root, f)
                    if 'assets/mp' in p: continue   # staged copies (compose.mjs); the originals are checked
                    yield p
def main(argv):
    docs = '--docs' in argv; roots = [os.path.abspath(a) for a in argv if not a.startswith('--')] or [PACK]
    bad = collections.defaultdict(list); seen = collections.Counter()
    for p in walk(roots, docs):
        scan(p, p.endswith('.md'), seen, bad, os.path.relpath(p, PACK) if p.startswith(PACK) else p)
    print('references checked:', dict(seen), '| registries: sfx', len(SFX), 'music', len(MUSIC), 'transitions', len(TX), '+', len(TX_ALIAS), 'aliases, type', len(TYPE), 'blender', len(BLENDER),
          'layers', len(LAYERS), 'objects', len(OBJECTS), 'camera', len(CAM), 'cuts', sum(len(v) for v in CUTS.values()), '| markdown', 'scanned' if docs else 'not scanned (--docs)')
    for (k, v), locs in sorted(bad.items()):
        print(f'UNRESOLVED {k:5s} {v:34s} {len(locs)}x  e.g. {locs[0]}')
    print('unresolved:', len(bad)); return 1 if bad else 0
if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
