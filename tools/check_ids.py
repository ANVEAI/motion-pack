"""motion-pack/tools/check_ids.py: every cross-module id referenced anywhere in the pack must resolve.
    python3 tools/check_ids.py            # exit 1 if any reference is unresolved
Scans source/config/json files (not renders, not node_modules) for the id conventions:
  sfx/<cat>/<name>  snd.<cat>.<name>  music/<id>  music.<id>  transitions/<name>  type/<preset>
and resolves them against the module registries (sfx/mpaudio registry, music/manifest.json, transitions/catalog.json + aliases,
type/presets.js PRESET_IDS). Prints unresolved ids with file:line."""
import os, re, sys, json, importlib, subprocess, collections
PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(PACK, 'sfx'))
from mpaudio import registry
import recipes
for m in recipes.MODULES: importlib.import_module('recipes.' + m)
SFX = set(registry.SOUNDS)
MUSIC = {i['id'] for i in json.load(open(os.path.join(PACK, 'music/manifest.json')))['items']}
TX = {t['key'] for t in json.load(open(os.path.join(PACK, 'transitions/catalog.json')))['transitions']}
TX_ALIAS = json.load(open(os.path.join(PACK, 'transitions/aliases.json')))['aliases'] if os.path.exists(os.path.join(PACK, 'transitions/aliases.json')) else {}
TXOK = TX | set(TX_ALIAS) | {'cut'}
TYPE = set(json.loads(subprocess.run(['node', '-e', "import('%s/type/presets.js').then(m=>console.log(JSON.stringify(m.PRESET_IDS)))" % PACK], capture_output=True, text=True).stdout))
RX = [('sfx', re.compile(r"['\"`](sfx/[a-z0-9_]+/[a-z0-9_]+)['\"`]")), ('snd', re.compile(r"['\"`](snd\.[a-z0-9_]+\.[a-z0-9_]+)['\"`]")),
      ('music', re.compile(r"['\"`](music[/.](?:bed|sting|logo)_[a-z0-9_]+)['\"`]")), ('tx', re.compile(r"['\"`]transitions/([A-Za-z0-9_-]+)['\"`]")),
      ('type', re.compile(r"['\"`]type/([A-Za-z0-9_]+)['\"`]"))]
SKIP_DIRS = {'.git', 'node_modules', 'renders', 'out', 'library', '__pycache__', 'research', 'fonts', 'media', 'dev1', 'dev2'}
def ok(kind, v):
    if kind == 'sfx': return 'snd.' + '.'.join(v.split('/')[1:]) in SFX
    if kind == 'snd': return v in SFX
    if kind == 'music': return 'music.' + re.split(r'[/.]', v, 1)[1] in MUSIC
    if kind == 'tx': return v in TXOK
    if kind == 'type': return v in TYPE
bad = collections.defaultdict(list); seen = collections.Counter()
for root, dirs, files in os.walk(PACK):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not os.path.islink(os.path.join(root, d))]
    if os.path.relpath(root, PACK).startswith('tools'): continue
    for f in files:
        if not f.endswith(('.js', '.mjs', '.py', '.json', '.html', '.sh')): continue
        p = os.path.join(root, f)
        if 'assets/mp' in p: continue   # staged copies (compose.mjs); the originals are checked
        for n, line in enumerate(open(p, errors='ignore'), 1):
            for kind, rx in RX:
                for v in rx.findall(line):
                    if kind == 'sfx' and v.startswith('sfx/demo'): continue
                    seen[kind] += 1
                    if not ok(kind, v): bad[(kind, v)].append(f'{os.path.relpath(p, PACK)}:{n}')
print('references checked:', dict(seen), '| registries: sfx', len(SFX), 'music', len(MUSIC), 'transitions', len(TX), '+', len(TX_ALIAS), 'aliases, type', len(TYPE))
for (k, v), locs in sorted(bad.items()):
    print(f'UNRESOLVED {k:5s} {v:34s} {len(locs)}x  e.g. {locs[0]}')
print('unresolved:', len(bad)); sys.exit(1 if bad else 0)
