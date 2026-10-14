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
    assert re.search(r'Release zips lag', r) and 'python3 sfx/build_library.py' in r and 'python3 music/build_music.py' in r
    i = r.index('# 1. Build the sound library')
    assert 'supported path' in r[i:i + 200]
