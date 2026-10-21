#!/usr/bin/env python3
"""motion-pack/tools/check_names.py: no third-party account, handle or brand name from the reference studies may appear in a shipped file.

    python3 tools/check_names.py                     # scan every tracked file; exit 1 on a hit
    python3 tools/check_names.py --hash "Some Name"  # print the denylist line(s) to paste into tools/name_denylist.txt

THE RULE (CONTRIBUTING.md, TRADEMARKS.md): the named, linked, hedged notes on studied accounts and launches live in docs/evidence/ and nowhere else.
Every other shipped file (README, skills, references, templates, tools, catalog, comments) keeps tiers, counts and measured numbers only, so the pack never
publishes who a measurement came from, never calls a named account "boosted" or "paid", and never ties a named film to a cause.

THE DENYLIST (tools/name_denylist.txt) DOES NOT PUBLISH THE NAMES. Each line is the SHA-256 of one normalised name (no salt, so you can add a name with
--hash), its mode (run or phrase) and a tag (handle, brand or person), and nothing else. The hashes are not a secret: anyone who already has a name can check it. The point is only
that the name is not in the repository as searchable text. To add a name: run --hash "<name>" and append the printed line; never commit the name.

HOW A NAME IS MATCHED
  * Normalise: Unicode NFKC, lower case, keep only a-z and 0-9. "Some_Name", "some-name" and "Some.Name" all become "somename".
  * Tokenise each shipped file (and each file path) into runs of a-z0-9. Two modes, stored next to each hash:
      run     a handle, or a brand written as one word: matches a token, or consecutive tokens joined ONLY by _ - . (no space, comma or slash), so
              "a_b_c", "a-b-c" and "a.b" match but "a, b" does not. A handle built from ordinary words ("word_word") therefore never flags prose.
              A run entry tagged brand or person (not handle) also matches its spaced form ("Zor Blaxo" for "zorblaxo"): parts separated by spaces
              tabs or the handle joiners only, never across a comma, a slash or a line break. So one entry covers "ZorBlaxo", "Zor-Blaxo"
              and "Zor Blaxo"; a brand spelled with any other gap needs its own phrase entry.
      phrase  a multi-word brand or a person: matches 2 to 4 consecutive tokens with anything between them ("Name Surname", "Name\nSurname").
  * A path into docs/evidence (docs/evidence/<file>) is removed before tokenising, so a shipped file may POINT at a study whose file name carries a name.
    Plain text outside such a path may not.
  * Matches are reported as file:line plus the first 12 hex digits of the hash and its tag, never as the name.

HOW THE ENTRIES WERE CHOSEN (what is in, what is out)
  * IN: every handle that appears in a docs/evidence link or mention (they are unique strings, so a hit is never a false positive); the brand and product
    names the studies cite as evidence; the people named there; and the multi-word forms ("<brand> <product>") of brands whose bare name is an ordinary
    word.
  * OUT, single words: a bare token that is an ordinary English word (checked against the system word list: --hash warns) or shorter than 5 letters would
    flag normal prose, so only its multi-word form is listed. Names of tools the pack depends on (THIRD_PARTY.md) and of platforms it targets
    (TRADEMARKS.md) are not on the list: naming them to say what the pack works with is allowed; naming a studied account as a source of evidence is not.
  * OUT, credits: a licensed dependency or a named credit (README Credits) is not an evidence source and is not listed.
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys
import unicodedata

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DENYLIST = os.path.join(PACK, 'tools', 'name_denylist.txt')
EXEMPT_DIR = 'docs/evidence/'                    # the one place named studies live (docs/research until v0.5 keeps only a redirect README)
MAX_WINDOW = 4                                   # tokens joined per candidate (a four-word brand or a three-part handle with a suffix)
MAX_LEN = 40                                     # no listed name is longer once normalised
MAX_BYTES = 8_000_000                            # text files only; skip anything bigger
WORDS = '/usr/share/dict/words'
DOCS_PATH = re.compile(r'docs/(?:research|evidence)/[A-Za-z0-9_.\-/]*')
JOINERS = set('_-.')                             # the only characters a handle may have between its parts
SPACES = set(' \t')                              # a one-word brand may also be written spaced ("Zor Blaxo"); a handle may not


def norm(s):
    """normalised form of a name: NFKC, lower case, a-z0-9 only"""
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKC', s).lower())


def hash_name(name):
    return hashlib.sha256(norm(name).encode()).hexdigest()


def load_denylist(path=DENYLIST):
    """{hash: (mode, tag)} from a denylist file (blank lines and lines starting with # ignored)"""
    out = {}
    for line in open(path, encoding='utf8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^([0-9a-f]{64})\s+(run|phrase)(?:\s+#\s*(\w+))?\s*$', line)
        if not m:
            raise ValueError('bad denylist line (want "<sha256> <run|phrase>  # tag"): ' + line[:80])
        out[m.group(1)] = (m.group(2), m.group(3) or 'name')
    return out


def scan_text(text, deny):
    """[(line, hash, tag)] for every denylisted name in `text` (a path into docs/evidence is ignored)"""
    text = unicodedata.normalize('NFKC', DOCS_PATH.sub(' ', text)).lower()
    toks = [(m.group(), m.start(), m.end()) for m in re.finditer(r'[a-z0-9]+', text)]
    hits, cache, seen = [], {}, set()
    for i, (t0, pos, end) in enumerate(toks):
        acc, tight, spaced = t0, True, True
        for k in range(MAX_WINDOW):
            if k:
                if i + k >= len(toks):
                    break
                gap = set(text[toks[i + k - 1][2]:toks[i + k][1]])
                tight = tight and gap <= JOINERS
                spaced = spaced and gap <= JOINERS | SPACES
                acc += toks[i + k][0]
            if len(acc) > MAX_LEN:
                break
            if acc.isdigit():
                continue                                       # no listed name is all digits; skips colour tables and number dumps cheaply
            h = cache.get(acc)
            if h is None:
                h = cache[acc] = hashlib.sha256(acc.encode()).hexdigest()
            if h in deny:
                mode, tag = deny[h]
                if (mode == 'run' and (tight or (spaced and tag != 'handle'))) or (mode == 'phrase' and k >= 1):
                    if (pos, h) not in seen:
                        seen.add((pos, h))
                        hits.append((text.count('\n', 0, pos) + 1, h, tag))
    return hits


def tracked_files(root):
    """paths (relative, '/'-separated) of every tracked file; every non-ignored file when there is no git checkout"""
    try:
        r = subprocess.run(['git', 'ls-files', '-z'], cwd=root, capture_output=True, check=True)
        return [p for p in r.stdout.decode('utf8', 'replace').split('\0') if p]
    except (OSError, subprocess.CalledProcessError):
        out = []
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in ('.git', 'node_modules', '__pycache__')]
            out += [os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/') for f in files]
        return out


def scan_repo(root=PACK, deny=None, denylist_path=None):
    """[(path, line, hash, tag)]: every hit in the shipped tree (paths too); docs/evidence and the denylist itself are skipped"""
    deny = deny if deny is not None else load_denylist(denylist_path or os.path.join(root, 'tools', 'name_denylist.txt'))
    hits = []
    for rel in tracked_files(root):
        if rel.startswith(EXEMPT_DIR) or rel == 'tools/name_denylist.txt':
            continue
        for h in scan_text(rel, deny):                         # the path itself (a file named after an account is a hit too)
            hits.append((rel, 0, h[1], h[2]))
        p = os.path.join(root, rel)
        try:
            if os.path.islink(p) or not os.path.isfile(p) or os.path.getsize(p) > MAX_BYTES:
                continue
            raw = open(p, 'rb').read()
        except OSError:
            continue
        if b'\0' in raw[:8192]:
            continue                                           # binary (images, audio, fonts): nothing to tokenise
        for line, h, tag in scan_text(raw.decode('utf8', 'replace'), deny):
            hits.append((rel, line, h, tag))
    return hits


def advise(name):
    """warnings for a name that would flag ordinary prose as a single token"""
    n, toks = norm(name), re.findall(r'[a-z0-9]+', unicodedata.normalize('NFKC', name).lower())
    warn = []
    if len(toks) == 1:
        if len(n) < 5:
            warn.append('shorter than 5 characters: it would match ordinary text')
        if os.path.exists(WORDS) and n in {w.strip().lower() for w in open(WORDS, errors='ignore')}:
            warn.append('an ordinary English word: list the multi-word form ("<brand> <product>") instead')
    return warn


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--hash', nargs='+', metavar='NAME', help='print the denylist line for each name (add them to tools/name_denylist.txt; never commit the name)')
    ap.add_argument('--tag', default='brand', choices=['handle', 'brand', 'person'], help='tag written next to a --hash line (default brand)')
    ap.add_argument('--mode', default=None, choices=['run', 'phrase'], help='run: one word or handle (default when the name has no space); phrase: several words (default when it has)')
    ap.add_argument('--root', default=PACK, help='tree to scan (default: this pack)')
    ap.add_argument('--denylist', default=None, help='denylist file (default tools/name_denylist.txt under --root)')
    a = ap.parse_args(argv)
    if a.hash:
        for name in a.hash:
            for w in advise(name):
                print('WARNING (%s): %s' % (name[:1] + '...', w), file=sys.stderr)
            print('%s %s  # %s' % (hash_name(name), a.mode or ('phrase' if len(name.split()) > 1 else 'run'), a.tag))
        return 0
    hits = scan_repo(a.root, denylist_path=a.denylist)
    for rel, line, h, tag in hits:
        print('%s:%s: a name on the denylist (%s, entry %s). Move it to docs/evidence, or say it as a tier, a count and a measured number' % (rel, line or 'path', tag, h[:12]))
    print('check_names: %d hit(s) in %d tracked files' % (len(hits), len(tracked_files(a.root))))
    return 1 if hits else 0


if __name__ == '__main__':
    sys.exit(main())
