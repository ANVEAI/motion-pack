#!/usr/bin/env python3
"""motion-pack / tools / pages_site.py: assemble the GitHub Pages site for the catalog.

    python3 tools/pages_site.py [OUT]        # default OUT = _site

Copies catalog/index.html and every file it references (thumbnails, demo videos, audio previews), keeping the repository
layout so the page's relative URLs (../<module>/...) resolve, plus a root index.html that redirects to catalog/.
Fails if a referenced file is missing. The site is https://anveai.github.io/motion-pack/catalog/ ."""
import json, os, re, shutil, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, '_site'))

page = open(os.path.join(REPO, 'catalog/index.html'), encoding='utf-8').read()
m = re.search(r'const DATA = (\{.*?\});\n', page, re.S)
if not m:
    sys.exit('catalog/index.html has no DATA blob: run python3 catalog/build.py')
items = json.loads(m.group(1))['items']
refs = sorted({it[k] for it in items for k in ('thumb', 'video', 'audio') if it.get(k)})
missing, size = [], 0
os.makedirs(os.path.join(OUT, 'catalog'), exist_ok=True)
shutil.copyfile(os.path.join(REPO, 'catalog/index.html'), os.path.join(OUT, 'catalog/index.html'))
for r in refs:
    if not r.startswith('../') or '..' in r[3:].split('/'):
        sys.exit('unexpected media path in catalog: ' + r)
    rel = r[3:]
    src = os.path.join(REPO, rel)
    if not os.path.isfile(src):
        missing.append(rel); continue
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst); size += os.path.getsize(src)
open(os.path.join(OUT, 'index.html'), 'w').write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=catalog/">'
                                                 '<title>motion-pack</title><a href="catalog/">motion-pack catalog</a>\n')
open(os.path.join(OUT, '.nojekyll'), 'w').write('')
print(f'pages site: {OUT} | {len(items)} components, {len(refs)} media files, {size / 1e6:.1f} MB')
if missing:
    print('MISSING:', *missing[:20], sep='\n  '); sys.exit(1)
