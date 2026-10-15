#!/usr/bin/env python3
"""Licence statements must match what is tracked (audit D9, H3): the licence docs may not say "nothing third-party is vendored" while fonts are committed, every bundled
font family is listed with its licence in README, LICENSE-MEDIA and THIRD_PARTY.md and has its OFL text beside it, and every set whose artwork appears in a committed image
has its notice in licenses/. Run: python3 -m pytest -q tools/tests/test_licences.py"""
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT_EXT = ('.ttf', '.otf', '.woff', '.woff2')


def tracked():
    return subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split('\n')


def read(p):
    return open(os.path.join(ROOT, p), encoding='utf8').read()


def families():
    out = {}
    for p in tracked():
        if p.endswith(FONT_EXT):
            fam = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', re.split(r'[-.]', os.path.basename(p))[0])   # IBMPlexMono-SemiBold.ttf -> IBMPlexMono
            out.setdefault(re.sub(r'\s+', '', fam).lower(), set()).add(os.path.dirname(p))
    return out


def test_every_bundled_font_family_is_listed_with_its_licence_and_has_its_ofl_text():
    fams = families()
    assert len(fams) == 3, 'bundled font families changed: update THIRD_PARTY.md, README, LICENSE-MEDIA and this test: ' + str(sorted(fams))
    docs = {p: re.sub(r'\s+', '', read(p)).lower() for p in ('README.md', 'LICENSE-MEDIA', 'THIRD_PARTY.md')}
    for fam, dirs in fams.items():
        key = re.sub(r'text$', '', fam)                                     # stixtwotext -> stixtwo
        for p, text in docs.items():
            assert key in text, f'{p} does not list the bundled font family {fam}'
        for d in dirs:
            assert any(f.startswith(d + '/OFL-') and key in f.lower().replace('-', '') for f in tracked()), f'no OFL text for {fam} in {d}'
    assert 'ofl' in docs['THIRD_PARTY.md'] and 'sil open font license' in read('README.md').lower()


def test_no_document_claims_nothing_third_party_is_vendored_or_forbids_the_bundled_fonts():
    bad = [r'nothing third-party is vendored', r'vendors no third-party library, media or icon set', r'pack ships only what it generates', r'do not commit third-party[^.]*\bfonts\b']
    for p in ('README.md', 'THIRD_PARTY.md', 'CONTRIBUTING.md', 'LICENSE-MEDIA', 'skills/motion-pack/SKILL.md'):
        for rx in bad:
            assert not re.search(rx, read(p), re.I), f'{p}: false statement /{rx}/ while font files are tracked'


def test_sets_shown_in_committed_images_have_notices_and_the_cc0_grant_excludes_them():
    tp, lm = read('THIRD_PARTY.md'), read('LICENSE-MEDIA')
    assert '1b' in tp and 'lab' in lm and re.search(r'lab/\*/sheets', lm) and 'not cover' in lm.lower()
    for f, needle in (('licenses/lucide-ISC-and-feather-MIT.txt', 'ISC License'), ('licenses/phosphor-MIT.txt', 'Phosphor Icons'), ('licenses/fluent-emoji-MIT.txt', 'Microsoft Corporation')):
        assert needle in read(f) and os.path.basename(f) in tp, f


def test_readme_does_not_send_users_to_a_stale_release_as_the_default():
    """audit H4 / D5 / C9: the Release WAV zips lag main (288 / 64 vs 301 / 65 when found); the README must say the build scripts are the version-matched path"""
    r = read('README.md')
    assert 'download the WAV masters from the latest Release' not in r
    assert re.search(r"Release's zips match its own tag, not `main`", r) and 'python3 sfx/build_library.py' in r and 'python3 music/build_music.py' in r
    i = r.index('# 1. Build the sound library')
    assert 'supported path' in r[i:i + 200]


def test_release_lag_statement_cannot_go_stale():
    """verifier: a hand-written "main has 301 and 65" goes stale as sounds are added. The README states only each Release's fixed counts and points at the
    generated table; a Release's counts can never exceed the manifests (main only grows), and every pointer at a Release must say it matches its own tag only"""
    import json
    r = read('README.md')
    found = re.findall(r'Release (v\d+\.\d+\.\d+) \(tag[^)]*\) holds (\d+) sound effects and (\d+) music pieces', r)
    assert found, 'README "Heavy media" must state each Release\'s counts'
    sfx = len(json.loads(read('sfx/manifest.json'))['sounds'])
    music = len(json.loads(read('music/manifest.json'))['items'])
    for ver, a, b in found:
        assert int(a) <= sfx and int(b) <= music, f'README says Release {ver} holds more than main: fix README "Heavy media"'
    for p in ('README.md', '.gitignore', 'tools/make_previews.py', 'sfx/README.md', 'music/README.md', 'LICENSE-MEDIA'):
        t = read(p)
        assert not re.search(r'`?main`? has \d+', t), f'{p}: hand-written count for main; point at the generated table instead'
        for hit in re.finditer(r'(?i)(?:download[^.\n]{0,40}GitHub Release|from the (?:latest )?Release)', t):
            ctx = t[max(0, hit.start() - 300):hit.end() + 300]
            assert re.search(r'(?i)own tag|tag only|lags? main|v0\.1\.0', ctx), f'{p}: points at the Release without saying it matches its own tag only: {hit.group()!r}'



def test_every_committed_lab_image_has_a_provenance_row_and_only_permissive_credited_sets():
    """audit H3 + verifier: a committed sheet showed a third-party sample whose licence is not stated. lab/provenance.json now lists every tracked lab
    image and the third-party sets it shows; each set needs a permissive licence, its notice in licenses/ and a row in THIRD_PARTY.md section 1b"""
    import json
    prov = json.loads(read('lab/provenance.json'))
    imgs = {p for p in tracked() if p.startswith('lab/') and p.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm'))}
    listed = set(prov['images'])
    assert imgs - listed == set(), 'tracked lab images with no row in lab/provenance.json: ' + str(sorted(imgs - listed))
    assert listed - imgs == set(), 'lab/provenance.json lists images that are not tracked: ' + str(sorted(listed - imgs))
    allowed, sets = set(prov['allowed_licences']), prov['sets']
    assert allowed <= {'CC0-1.0', 'MIT', 'ISC', 'Apache-2.0', 'OFL-1.1'}
    tp, lr = read('THIRD_PARTY.md'), read('licenses/README.md')
    sec = tp[tp.index('## 1b.'):tp.index('## 2.')]
    for sid, s in sets.items():
        assert s['licence'] and set(s['licence']) <= allowed, f'{sid}: licence {s["licence"]} is not permissive; do not commit a render of it'
        assert os.path.isfile(os.path.join(ROOT, s['notice'])) and s['notice'] in tracked(), f'{sid}: notice {s["notice"]} is not tracked'
        base = os.path.basename(s['notice'])
        assert base in sec and base in lr, f'{sid}: {base} must be named in THIRD_PARTY.md section 1b and licenses/README.md'
    for img, shown in prov['images'].items():
        assert set(shown) <= set(sets), f'{img}: unknown set {set(shown) - set(sets)}'
        for sid in shown:
            assert os.path.basename(img) in sec or os.path.dirname(img) + '/' in sec, f'{img} shows {sid} but THIRD_PARTY.md 1b does not name it or its folder'
    used = {sets[s]['notice'] for v in prov['images'].values() for s in v}
    notices = {p for p in tracked() if p.startswith('licenses/') and p.endswith('.txt')}
    assert notices == used, 'licenses/ and lab/provenance.json disagree: ' + str(sorted(notices ^ used))
