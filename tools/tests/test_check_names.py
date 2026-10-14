#!/usr/bin/env python3
"""The name gate (tools/check_names.py): no studied account, handle or brand name outside docs/research.
Run: python3 -m pytest -q tools/tests/test_check_names.py

The matcher is tested with INVENTED names (never a real one: the repo must not publish them, and this file is shipped). The last test is the real gate:
it scans the whole tracked tree against tools/name_denylist.txt and must find nothing."""
import os
import re
import subprocess
import sys

import pytest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
import check_names as cn  # noqa: E402


def deny_of(*pairs):
    """in-memory denylist from (name, mode, tag) triples"""
    return {cn.hash_name(n): (m, t) for n, m, t in pairs}


D = deny_of(('zorblaxo', 'run', 'brand'), ('grim_vestor', 'run', 'handle'), ('quenby farthing', 'phrase', 'person'), ('word_pair', 'run', 'handle'))


def hits(text):
    return [h[2] for h in cn.scan_text(text, D)]


def test_norm_ignores_case_and_separators():
    assert cn.norm('Zor_Blaxo') == cn.norm('zor-blaxo') == cn.norm('ZOR.BLAXO') == 'zorblaxo'
    assert cn.hash_name('Zor_Blaxo') == cn.hash_name('zorblaxo')
    assert len(cn.hash_name('x')) == 64


def test_run_mode_matches_a_word_or_a_handle_in_any_casing_and_url_form():
    assert hits('We studied Zorblaxo last week.') == ['brand']
    assert hits('https://example.test/GRIM_VESTOR/status/1') == ['handle']
    assert hits('@grim-vestor and @Grim.Vestor') == ['handle', 'handle']
    assert hits('zorblaxo.example') == ['brand']                       # a domain-style mention still names it
    assert hits('ZORBLAXO_final') == ['brand']


def test_run_mode_does_not_join_across_spaces_or_punctuation():
    """a handle built from ordinary words must not flag prose: "word, pair" and "word pair" are not the handle word_pair"""
    assert hits('the next word, pair them up') == []
    assert hits('a word pair is two words') == []
    assert hits('grim vestor and grim, vestor') == []
    assert hits('zor blaxo') == []
    assert hits('x.com/word_pair/status') == ['handle']                # the real handle, with its underscore, is still caught


def test_phrase_mode_needs_all_the_words_but_any_gap():
    assert hits('Quenby Farthing said so') == ['person']
    assert hits('quenby\nfarthing') == ['person']
    assert hits('quenby-farthing') == ['person']
    assert hits('Quenby was alone; Farthing too') == []                # words far apart
    assert hits('quenby') == [] and hits('farthing') == []             # a single word of a phrase is not a hit


def test_a_path_into_docs_research_is_the_only_exception():
    assert hits('see docs/research/reference-zorblaxo-launch-2026-10.md for the study') == []
    assert hits('see docs/research/reference-zorblaxo-launch-2026-10.md; Zorblaxo did it') == ['brand']
    assert hits('docs/zorblaxo/notes.md') == ['brand']                 # only docs/research is exempt


def test_hits_carry_a_line_number_and_never_the_name():
    out = cn.scan_text('one\ntwo\nthree zorblaxo\n', D)
    assert out[0][0] == 3 and re.fullmatch(r'[0-9a-f]{64}', out[0][1])


def test_denylist_file_is_hashes_only():
    path = os.path.join(TOOLS, 'name_denylist.txt')
    deny = cn.load_denylist(path)
    assert len(deny) >= 90
    assert {m for m, _ in deny.values()} <= {'run', 'phrase'} and {t for _, t in deny.values()} <= {'handle', 'brand', 'person'}
    for line in open(path, encoding='utf8'):
        line = line.strip()
        if line and not line.startswith('#'):
            assert re.fullmatch(r'[0-9a-f]{64} (run|phrase)  # (handle|brand|person)', line), 'a denylist line may hold a hash, a mode and a tag only: ' + line[:40]
    assert len(deny) == len([1 for l in open(path, encoding='utf8') if re.match(r'[0-9a-f]{64} ', l)]), 'duplicate hash'


def test_bad_denylist_line_is_refused(tmp_path):
    p = tmp_path / 'd.txt'
    p.write_text('zorblaxo  # brand\n')
    with pytest.raises(ValueError):
        cn.load_denylist(str(p))


def test_hash_cli_prints_a_pasteable_line_and_warns_on_a_short_word(capsys):
    assert cn.main(['--hash', 'Quenby Farthing', '--tag', 'person']) == 0
    assert capsys.readouterr().out.strip() == '%s phrase  # person' % cn.hash_name('quenby farthing')
    assert cn.main(['--hash', 'abc']) == 0
    cap = capsys.readouterr()
    assert 'shorter than 5' in cap.err and cap.out.strip().endswith('run  # brand')


def tree(tmp_path, files):
    for rel, body in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(body if isinstance(body, bytes) else body.encode())
    d = tmp_path / 'deny.txt'
    d.write_text(''.join('%s %s  # %s\n' % (h, m, t) for h, (m, t) in D.items()))
    return str(d)


def test_cli_fails_on_a_shipped_file_and_does_not_print_the_name(tmp_path, capsys):
    d = tree(tmp_path, {'README.md': 'Based on the Zorblaxo launch.\n', 'ok.md': 'nothing to see\n'})
    assert cn.main(['--root', str(tmp_path), '--denylist', d]) == 1
    out = capsys.readouterr().out
    assert 'README.md:1:' in out and 'zorblaxo' not in out.lower() and 'ok.md' not in out


def test_cli_scans_file_paths_too(tmp_path, capsys):
    d = tree(tmp_path, {'templates/zorblaxo-demo/make.mjs': 'plain\n'})
    assert cn.main(['--root', str(tmp_path), '--denylist', d]) == 1
    assert 'path' in capsys.readouterr().out


def test_cli_passes_when_the_name_is_only_in_docs_research_or_a_binary(tmp_path, capsys):
    d = tree(tmp_path, {'docs/research/study.md': 'Zorblaxo, named, linked and hedged here.\n', 'docs/research/reference-zorblaxo.md': 'x\n',
                        'media/a.bin': b'\0\1\2 zorblaxo \0', 'README.md': 'see docs/research/reference-zorblaxo.md\n'})
    assert cn.main(['--root', str(tmp_path), '--denylist', d]) == 0
    assert '0 hit' in capsys.readouterr().out


def test_cli_exit_code_through_a_subprocess(tmp_path):
    d = tree(tmp_path, {'a.md': 'Grim_Vestor wrote this\n'})
    r = subprocess.run([sys.executable, os.path.join(TOOLS, 'check_names.py'), '--root', str(tmp_path), '--denylist', d], capture_output=True, text=True)
    assert r.returncode == 1 and 'a.md:1' in r.stdout and 'vestor' not in r.stdout.lower()


def test_shipped_tree_names_no_studied_account_or_brand():
    """THE GATE: the tracked tree outside docs/research holds none of the names on the denylist (see tools/check_names.py for the rule and how to add one)"""
    found = cn.scan_repo(cn.PACK)
    assert not found, 'names outside docs/research (file:line, denylist entry): ' + '; '.join('%s:%s %s' % (p, l or 'path', h[:12]) for p, l, h, _ in found[:12])
