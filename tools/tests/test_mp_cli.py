"""The `mp` CLI (tools/mp.mjs, shim tools/mp): list, new, set, build, brand, check, doctor, in project folders under $TMPDIR (on macOS /var -> /private/var, a
symlink, so every path is compared by realpath). Nothing renders here (renders need a GPU: docs/EDIT-WITHOUT-CODE.md); `mp build` runs make.mjs, which needs the
music bed WAV, built on demand like test_worked_example.py does.
Run: python3 -m pytest -q tools/tests/test_mp_cli.py"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_build import REPO, NODE, env, ensure_bed  # noqa: E402

MP = os.path.join(REPO, 'tools', 'mp')
EXAMPLE = os.path.join(REPO, 'examples', 'project.example.json')
LOGO = os.path.join(REPO, 'examples', 'project-assets', 'fernwick-mark.svg')
GENRE = ['ad', 'beat-edit', 'character-spot', 'film-scene', 'multi-voice-doc', 'proof-film', 'talking-head']
pytestmark = pytest.mark.skipif(NODE is None, reason='node not installed')


def mp(*args, cwd=None):
    e = env()
    e['PYTHON'] = sys.executable
    return subprocess.run([MP, *args], cwd=cwd, capture_output=True, text=True, env=e, timeout=900)


@pytest.fixture()
def tmp():
    d = tempfile.mkdtemp(prefix='mp-cli-', dir=os.environ.get('TMPDIR') or None)   # under $TMPDIR on purpose: a symlinked path on macOS
    yield d
    shutil.rmtree(d, ignore_errors=True)


def test_list_shows_every_genre_template_with_its_fields_and_aspects():
    r = mp('list', '--json')
    assert r.returncode == 0, r.stderr
    rows = {t['template']: t for t in json.loads(r.stdout)}
    for t in GENRE:
        assert t in rows, t
        assert '16:9' in rows[t]['aspects']
    assert rows['ad']['fields']['text.headline']['to'] == ['hook.line']
    assert rows['talking-head']['fields']['media.input.src']['required'] is True
    assert rows['proof-film']['aspects']['1:1']['how'] == 'manual'
    assert 'brand.accent' in mp('list', 'ad').stdout


def test_new_scaffolds_outside_the_pack_with_a_copy_and_links(tmp):
    d = os.path.join(tmp, 'my video')   # a space in the path on purpose
    r = mp('new', 'ad', d)
    assert r.returncode == 0, r.stderr + r.stdout
    for f in ('project.json', 'mp.json', 'renders'):
        assert os.path.exists(os.path.join(d, f)), f
    copy = os.path.join(d, 'build', 'templates', 'ad')
    assert os.path.isdir(copy) and not os.path.islink(copy)                               # the chosen template is a real copy (copy-on-write where it can)
    assert os.path.realpath(os.path.join(d, 'build', 'templates', '_shared')) == os.path.realpath(os.path.join(REPO, 'templates', '_shared'))
    assert os.path.realpath(os.path.join(d, 'build', 'type')) == os.path.realpath(os.path.join(REPO, 'type'))
    assert os.path.realpath(os.path.join(d, 'build', 'templates', 'film-scene')) == os.path.realpath(os.path.join(REPO, 'templates', 'film-scene'))
    meta = json.load(open(os.path.join(d, 'mp.json')))
    assert os.path.realpath(meta['pack']) == os.path.realpath(REPO) and meta['templates'] == ['ad']
    assert mp('new', 'ad', d).returncode == 2                                              # not into a non-empty folder
    assert mp('new', 'nope', os.path.join(tmp, 'x')).returncode == 2                       # an unknown template
    r = mp('new', 'ad', os.path.join(REPO, 'templates', 'zz-not-here'))
    assert r.returncode == 2 and 'OUTSIDE the pack' in r.stderr


def test_new_from_a_project_rebases_its_paths(tmp):
    d = os.path.join(tmp, 'demo')
    r = mp('new', 'ad,proof-film', d, '--project', EXAMPLE)
    assert r.returncode == 0, r.stderr
    p = json.load(open(os.path.join(d, 'project.json')))
    assert os.path.realpath(p['brand']['logo']) == os.path.realpath(LOGO)
    assert p['media']['product']['src'] is None and os.path.exists(p['media']['hook']['src'])
    assert p['template'] == ['ad', 'proof-film'] and p['//'].startswith('ONE file')        # comments survive


def test_set_edits_the_project_and_refuses_bad_values(tmp):
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d).returncode == 0
    assert mp('set', 'brand.name', 'Fernwick', cwd=d).returncode == 0
    assert mp('set', 'aspects', '16:9,9:16,1:1', cwd=d).returncode == 0
    assert mp('set', 'text.headline', 'Every note, *found*.', cwd=d).returncode == 0
    assert mp('set', 'config.ad.length', '30', cwd=d).returncode == 0
    p = json.load(open(os.path.join(d, 'project.json')))
    assert p['brand']['name'] == 'Fernwick' and p['aspects'] == ['16:9', '9:16', '1:1'] and p['overrides']['ad']['length'] == 30
    r = mp('set', 'brand.colour', '#fff', cwd=d)
    assert r.returncode == 2 and 'unknown key' in r.stderr
    r = mp('set', 'text.headline', 'Saves 40% of your time', cwd=d)
    assert r.returncode == 2 and 'digit' in r.stderr and 'claims' in r.stderr
    r = mp('set', 'brand.accent', 'teal', cwd=os.path.join(d, 'renders'))                 # found from a sub-folder, refused for the value
    assert r.returncode == 2 and 'brand.accent' in r.stderr
    assert json.load(open(os.path.join(d, 'project.json')))['text']['headline'] == 'Every note, *found*.'   # a refused set changes nothing


def test_build_with_an_empty_project_gives_the_committed_plan(tmp):
    ensure_bed('bed_tech_pulse_loop8')
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d).returncode == 0
    json.dump({'version': 1, 'template': 'ad'}, open(os.path.join(d, 'project.json'), 'w'))
    r = mp('build', '--aspect', '16:9', cwd=d)
    assert r.returncode == 0, r.stdout[-1500:] + r.stderr[-1500:]
    built = open(os.path.join(d, 'build', 'templates', 'ad', 'out', 'plan.json')).read()
    assert built == open(os.path.join(REPO, 'templates', 'ad', 'out', 'plan.json')).read()
    assert open(os.path.join(d, 'build', 'templates', 'ad', 'index.html')).read() == open(os.path.join(REPO, 'templates', 'ad', 'index.html')).read()


def test_build_applies_the_project_and_re_lays_out_9x16(tmp):
    ensure_bed('bed_tech_pulse_loop8')
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d, '--project', EXAMPLE).returncode == 0
    r = mp('build', '--template', 'ad', '--aspect', '9:16', cwd=d)
    assert r.returncode == 0, r.stdout[-1500:] + r.stderr[-1500:]
    out = os.path.join(d, 'build', 'templates', 'ad')
    plan = json.load(open(os.path.join(out, 'out', 'plan.json')))
    assert plan['aspect'] == '9:16' and plan['size'] == [1080, 1920] and plan['platform'] == 'reels.organic'
    assert all(65 <= t['box'][0] and t['box'][2] <= 960 and 269 <= t['box'][1] for t in plan['texts'])   # every text box inside the conservative 9:16 safe rect
    html = open(os.path.join(out, 'index.html')).read()
    assert 'data-width="1080" data-height="1920"' in html and 'Fernwick' in html and 'placeholder: Fernwick on a laptop' in html
    rep = json.load(open(os.path.join(out, 'out', 'project.report.json')))
    assert 'text.intro' in rep['ignored'] and any(a['from'] == 'brand.name' for a in rep['applied'])
    r = mp('build', '--template', 'ad', '--aspect', '9:16', cwd=d)                         # a second build is the same plan (pure)
    assert json.load(open(os.path.join(out, 'out', 'plan.json'))) == plan


def test_a_bad_project_stops_the_build_with_the_field_named(tmp):
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d).returncode == 0
    json.dump({'template': 'ad', 'text': {'hedline': 'Hi'}}, open(os.path.join(d, 'project.json'), 'w'))
    r = mp('build', '--aspect', '16:9', cwd=d)
    assert r.returncode == 2 and 'did you mean text.headline' in (r.stdout + r.stderr)


def test_brand_suggests_a_contrast_checked_palette(tmp):
    r = mp('brand', LOGO)
    assert r.returncode == 0, r.stderr
    assert 'accent #0F766E' in r.stdout and 'FAIL' not in r.stdout
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d).returncode == 0
    assert mp('brand', LOGO, '--write', cwd=d).returncode == 0
    b = json.load(open(os.path.join(d, 'project.json')))['brand']
    assert b['accent'] == '#0F766E' and os.path.realpath(os.path.join(d, b['logo'])) == os.path.realpath(LOGO)
    pale = os.path.join(tmp, 'pale.svg')
    open(pale, 'w').write('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#FFE98A"/></svg>')
    r = mp('brand', pale)
    assert r.returncode == 0 and 'nearest passing accent' in r.stdout                      # a pale logo colour is moved (same hue) until it reads


def test_check_runs_ids_and_honesty_without_renders(tmp):
    d = os.path.join(tmp, 'p')
    assert mp('new', 'ad', d, '--project', EXAMPLE).returncode == 0
    r = mp('check', '--template', 'ad', cwd=d)
    assert r.returncode == 0, r.stdout + r.stderr
    assert 'check_ids 0 unresolved' in r.stdout and 'no banned demo words' in r.stdout
    p = json.load(open(os.path.join(d, 'project.json')))
    p['text']['product'] = 'A planned feature.'
    json.dump(p, open(os.path.join(d, 'project.json'), 'w'))
    r = mp('check', '--template', 'ad', cwd=d)
    assert r.returncode == 1 and 'banned demo words' in r.stdout


def test_doctor_reports_every_row(tmp):
    r = mp('doctor')
    assert r.returncode in (0, 1)                                                          # CI has no GPU Chrome: a FAIL row is expected there, never a crash
    for row in ('node', 'python', 'ffmpeg', 'sound library', 'music library', 'disk'):
        assert row in r.stdout, row


def test_the_shim_works_through_a_symlink(tmp):
    os.symlink(MP, os.path.join(tmp, 'mp'))
    r = subprocess.run([os.path.join(tmp, 'mp'), 'list', 'ad'], capture_output=True, text=True, env=env(), timeout=120)
    assert r.returncode == 0 and 'text.headline' in r.stdout, r.stderr
