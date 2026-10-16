#!/usr/bin/env python3
"""tools/lottie: the SVG path parser and bezier conversion, the keyframe reducer (round trip against the sampled pure function within its
tolerance), the export of the example spec, the measured preset matrix, the lossy refusal, and the pinned-schema validation (skipped when the
schema cannot be fetched or jsonschema is missing). Run: python3 -m pytest -q tools/tests/test_lottie.py"""
import json
import math
import os
import shutil
import sys

import pytest

TOOLS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PACK = os.path.dirname(TOOLS)
sys.path.insert(0, os.path.join(TOOLS, 'lottie'))
import geom                                                    # noqa: E402
import validate as V                                           # noqa: E402

NODE = shutil.which('node')
EX = os.path.join(TOOLS, 'lottie', 'examples', 'title.json')
needs_node = pytest.mark.skipif(NODE is None, reason='node not installed')


def _end(sub):
    return sub['segs'][-1][2]


def test_path_parser_absolute_relative_and_shorthands():
    subs = geom.subpaths_from_d('M10 10 h20 v20 H10 z m5 5 l10 0 c0 5 5 5 5 0 s5 -5 5 0 q5 5 10 0 t10 0')
    assert len(subs) == 2 and subs[0]['closed'] and not subs[1]['closed']
    assert _end(subs[0]) == (10.0, 10.0)
    assert _end(subs[1]) == pytest.approx((55.0, 15.0))
    assert all(len(seg) == 3 for s in subs for seg in s['segs'])          # everything is a cubic


def test_arc_becomes_cubics_on_the_circle():
    sub = geom.subpaths_from_d('M0 10 A10 10 0 0 1 10 0')[0]                # a quarter circle around (10, 10)... centre (10,10), r 10
    c1, c2, q = sub['segs'][-1]
    assert q == (10.0, 0.0)
    for t in (0.25, 0.5, 0.75):                                          # points on the cubic stay within 0.03 of the radius
        p0 = sub['start'] if len(sub['segs']) == 1 else sub['segs'][-2][2]
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * c1[0] + 3 * (1 - t) * t * t * c2[0] + t ** 3 * q[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * c1[1] + 3 * (1 - t) * t * t * c2[1] + t ** 3 * q[1]
        assert abs(math.hypot(x - 10, y - 10) - 10) < 0.03


def test_svg_elements_and_closed_bezier():
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="1 1 5 5 9 1"/>' \
          '<rect x="2" y="2" width="4" height="4" transform="rotate(3)"/></svg>'
    els, vb = geom.svg_elements(svg)
    assert vb == (0.0, 0.0, 24.0, 24.0) and [e[0] for e in els] == ['circle', 'polyline', 'rect']
    assert 'transform' in els[2][2]['_note']
    b = geom.to_lottie(els[0][1][0])
    assert b['c'] and len(b['v']) == 4 and len(b['i']) == len(b['o']) == 4     # the closing vertex is merged


def test_keyframe_reducer_round_trip():
    import export as X
    vals = [[math.sin(f / 7.0) * 100, f * 0.5] for f in range(90)] + [[0, 45]] * 30
    p = X.prop(vals, 0.05)
    assert p['a'] == 1 and len(p['k']) < len(vals)                      # the flat tail collapses
    for f, v in enumerate(vals):
        assert all(abs(a - b) <= 0.05 + 1e-6 for a, b in zip(X.value_at(p, f), v)), f
    assert X.prop([3.0] * 10, 0.1, False) == {'a': 0, 'k': 3.0}


@needs_node
def test_export_example_matches_the_sampled_states():
    import export as X
    spec = json.load(open(EX))
    doc, rep = X.export(spec)
    assert doc['fr'] == 30 and doc['op'] == 90 and rep['dropped'] == {} and not V.structural(doc)
    names = [L['nm'] for L in doc['layers']]
    assert names[-1] == 'background' and any(n.startswith('maskRise unit 0: Ship') for n in names)
    # the unit's group position at every frame equals the pack's own unitStates sample (within the reducer tolerance)
    text = next(L for L in spec['layers'] if L['type'] == 'text')
    units = [u['text'] for u in X.text_units(dict(text), 'word')]
    smp = X.sample(30.0, 90, [{'kind': 'type', 'preset': 'maskRise', 'at': text['at'], 'out': text['out'], 'units': units}])[0]
    L0 = next(L for L in doc['layers'] if L['nm'].startswith('maskRise unit 0'))
    tr = L0['shapes'][0]['it'][-1]
    cy = tr['a']['k'][1]
    for f in range(90):
        want = cy + smp['states'][f][0]['y'] * text['size']
        assert abs(X.value_at(tr['p'], f)[1] - want) <= 0.06, f
    assert L0['hasMask'] and L0['ip'] == 9                               # a timed clip: in at `at` (0.3 s), masked to its line box
    draw = next(L for L in doc['layers'] if L['nm'].startswith('drawon'))
    tm = [x for g in draw['shapes'] for x in g['it'] if x['ty'] == 'tm']
    assert len(tm) == 2 and X.value_at(tm[0]['e'], 0) == [0] and X.value_at(tm[0]['e'], 89) == [100]


@needs_node
def test_matrix_is_measured_and_lossy_presets_are_refused():
    import export as X
    m = X.matrix()
    assert m['maskRise']['export'] == 'exact' and m['elasticPop']['export'] == 'exact'
    assert 'blur' in m['blurIn']['drops'] and 'rotX' in m['flipSplit']['drops'] and 'glyph' in m['scramble']['drops']
    spec = {'w': 400, 'h': 200, 'fps': 30, 'seconds': 1, 'layers': [{'type': 'text', 'text': 'Hi', 'preset': 'blurIn', 'at': 0, 'size': 60, 'pos': [200, 80]}]}
    with pytest.raises(X.ExportError):
        X.export(json.loads(json.dumps(spec)))
    doc, rep = X.export(json.loads(json.dumps(spec)), allow_lossy=True)
    assert 'blur' in rep['dropped']['blurIn']


@needs_node
def test_schema_validation_with_the_pinned_file():
    pytest.importorskip('jsonschema')
    try:
        V.fetch(timeout=10)
    except Exception as e:                                               # offline CI: the structural check above still ran
        pytest.skip('schema not fetchable: %s' % e)
    import export as X
    doc, _ = X.export(json.load(open(EX)))
    assert V.validate(doc) == []
    bad = json.loads(json.dumps(doc))
    bad['layers'][0]['ip'] = 'zero'
    assert V.validate(bad)


def test_checksum_pin_is_enforced(tmp_path, monkeypatch):
    monkeypatch.setenv('MP_CACHE', str(tmp_path))
    p = V.cache_path()
    os.makedirs(os.path.dirname(p))
    open(p, 'w').write('{"tampered": true}')

    def boom(*a, **k):
        raise OSError('no network in this test')
    monkeypatch.setattr(V.urllib.request, 'urlopen', boom)
    with pytest.raises(OSError):                                          # a cached file with the wrong hash is not trusted: it re-fetches
        V.fetch()
