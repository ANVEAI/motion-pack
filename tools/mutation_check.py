#!/usr/bin/env python3
"""motion-pack / tools / mutation_check.py: prove that a test CAN fail (2026-10-15).

    python3 tools/mutation_check.py layers/tests/r6.mutants.json          # exit 0 only if the baseline passes and every mutant is killed
    python3 tools/mutation_check.py cuts/test_story6.mutants.json --only 3

A spec is JSON: { "file": "layers/backgrounds-r6.js", "test": ["node", "layers/tests/r6.test.mjs"], "mutants": [ { "name": "...", "find": "<exact text, once>", "replace": "<text>" } ] }
(paths relative to the repo root; "test" is run from the repo root). The tool runs the test on the untouched file (it must pass), then for each mutant writes the
mutated file, runs the test (it must FAIL: the mutant is "killed" and the first FAIL line is printed), and always restores the file byte for byte (try / finally,
checked against a hash at the end). A `find` that is missing or occurs more than once is an error: a mutation that does not apply proves nothing.
A mutant that survives means a check is missing or too weak: exit 1. Stdlib only; never uses rm."""
import hashlib, json, os, subprocess, sys, time

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def run(cmd, timeout):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    try:
        r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=timeout, env=env)
        return r.returncode, (r.stdout or '') + (r.stderr or '')
    except subprocess.TimeoutExpired:
        return 124, 'timeout'


def first_fail(out):
    for line in out.splitlines():
        if line.startswith('FAIL') or line.startswith('FAILED') or ' failed' in line or 'Error' in line[:40]:
            return line.strip()[:170]
    return (out.strip().splitlines() or ['(no output)'])[-1][:170]


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    spec = json.load(open(os.path.join(REPO, argv[0]) if not os.path.isabs(argv[0]) and not os.path.exists(argv[0]) else argv[0]))
    only = int(argv[argv.index('--only') + 1]) if '--only' in argv else None
    path = os.path.join(REPO, spec['file'])
    raw = open(path, 'rb').read()
    digest = hashlib.sha256(raw).hexdigest()
    st = os.stat(path)
    text = raw.decode('utf-8')
    timeout = spec.get('timeout', 600)
    code, out = run(spec['test'], timeout)
    if code != 0:
        print('BASELINE FAILS: the test must pass on the untouched file first\n' + out[-1500:])
        return 2
    print('baseline passes (%s)' % ' '.join(spec['test']))
    survived, rows = [], []
    try:
        for i, m in enumerate(spec['mutants']):
            if only is not None and i != only:
                continue
            n = text.count(m['find'])
            if n != 1:
                print('MUTANT %d "%s": the find text occurs %d times (must be exactly once)' % (i, m['name'], n))
                return 2
            with open(path, 'w', encoding='utf-8') as f:
                f.write(text.replace(m['find'], m['replace'], 1))
            os.utime(path, (st.st_atime, st.st_mtime + 3 * (i + 1)))   # a distinct mtime per mutant: python never reuses a stale .pyc
            t0 = time.time()
            code, out = run(spec['test'], timeout)
            killed = code != 0
            rows.append((i, m['name'], killed, first_fail(out) if killed else ''))
            print('%s  #%d %-58s %s' % ('killed  ' if killed else 'SURVIVED', i, m['name'], ('<- ' + first_fail(out)) if killed else '(%.0fs)' % (time.time() - t0)))
            if not killed:
                survived.append(m['name'])
    finally:
        with open(path, 'wb') as f:
            f.write(raw)
        os.utime(path, (st.st_atime, st.st_mtime))
    if hashlib.sha256(open(path, 'rb').read()).hexdigest() != digest:
        print('RESTORE FAILED: %s differs from the original, restore it from git' % spec['file'])
        return 3
    print('%d/%d mutants killed; %s restored byte for byte' % (len(rows) - len(survived), len(rows), spec['file']))
    return 1 if survived else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
