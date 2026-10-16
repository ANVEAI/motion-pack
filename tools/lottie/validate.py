#!/usr/bin/env python3
"""motion-pack / tools / lottie / validate.py: validate a Lottie JSON against the Lottie Animation Community's published JSON Schema.

    python3 tools/lottie/validate.py out/title.lottie.json        # fetches the pinned schema once (checksum-verified), then validates
    python3 tools/lottie/validate.py --fetch                      # just fetch and verify the schema

The schema is NOT vendored. It is fetched from a pinned URL and refused unless its SHA-256 matches; the copy lives in the user cache
($MP_CACHE or ~/.cache/motion-pack/lottie-spec/<version>/). Validation uses the `jsonschema` package (Draft 2020-12) when it is installed
(pin: jsonschema==4.25.1); without it only the structural checks below run and the report says so."""
import argparse
import hashlib
import json
import os
import sys
import urllib.request

VERSION = '1.0.1'
URL = 'https://lottie.github.io/lottie-spec/1.0.1/lottie.schema.json'
SHA256 = 'a6adf87565bfbc94c73b1a5310569fbe53dd7d54df0060dada00559c2a030296'


def cache_path():
    root = os.environ.get('MP_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', 'motion-pack')
    return os.path.join(root, 'lottie-spec', VERSION, 'lottie.schema.json')


def fetch(timeout=20):
    """the verified schema path: the cached copy if its checksum matches, else download, verify, store. Raises on a mismatch."""
    p = cache_path()
    if os.path.exists(p) and hashlib.sha256(open(p, 'rb').read()).hexdigest() == SHA256:
        return p
    data = urllib.request.urlopen(URL, timeout=timeout).read()
    got = hashlib.sha256(data).hexdigest()
    if got != SHA256:
        raise RuntimeError('lottie schema checksum mismatch: got %s, pinned %s (the published file changed; review it, then update the pin)' % (got, SHA256))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.part'
    open(tmp, 'wb').write(data)
    os.replace(tmp, p)
    return p


def structural(doc):
    """checks that need no schema: top-level fields, layer in/out points, keyframes in time order"""
    errs = []
    for k in ('fr', 'ip', 'op', 'w', 'h', 'layers'):
        if k not in doc:
            errs.append('missing top-level %s' % k)
    if errs:
        return errs
    inds = [L.get('ind') for L in doc['layers']]
    if len(set(inds)) != len(inds):
        errs.append('duplicate layer ind')

    def walk(o, path):
        if isinstance(o, dict):
            if o.get('a') == 1 and isinstance(o.get('k'), list):
                ts = [kf.get('t') for kf in o['k'] if isinstance(kf, dict)]
                if not all(isinstance(t, (int, float)) for t in ts):
                    errs.append('%s: keyframe time is not a number' % path)
                elif any(b <= a for a, b in zip(ts, ts[1:])):
                    errs.append('%s: keyframe times not increasing' % path)
            for k, v in o.items():
                walk(v, path + '.' + k)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, '%s[%d]' % (path, i))
    walk(doc, '$')
    for L in doc['layers']:
        ip, op = L.get('ip', 0), L.get('op', 0)
        if not all(isinstance(v, (int, float)) for v in (ip, op)):
            errs.append('layer %s: ip / op are not numbers' % L.get('nm'))
        elif not ip < op:
            errs.append('layer %s: ip >= op' % L.get('nm'))
    return errs


def validate(doc, need_schema=False):
    """[error strings]; empty = valid. Uses the pinned schema with jsonschema when available."""
    errs = structural(doc)
    try:
        import jsonschema
    except ImportError:
        if need_schema:
            raise
        return errs + ([] if not need_schema else ['jsonschema not installed'])
    schema = json.load(open(fetch(), encoding='utf-8'))
    v = jsonschema.Draft202012Validator(schema)
    for e in sorted(v.iter_errors(doc), key=lambda e: list(e.absolute_path)):
        errs.append('%s: %s' % ('/'.join(str(x) for x in e.absolute_path), e.message[:200]))
    return errs


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('file', nargs='?')
    ap.add_argument('--fetch', action='store_true')
    a = ap.parse_args(argv)
    if a.fetch or not a.file:
        print(fetch())
        return 0
    errs = validate(json.load(open(a.file, encoding='utf-8')))
    print('%s: %s' % (a.file, 'valid against lottie-spec %s' % VERSION if not errs else '%d errors' % len(errs)))
    for e in errs[:20]:
        print('  ' + e)
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main())
