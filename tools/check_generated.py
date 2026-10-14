"""motion-pack/tools/check_generated.py: a regenerated file must equal the committed one.
    python3 tools/check_generated.py sfx/manifest.json [music/manifest.json ...]   # exit 1 if any of them differs from git HEAD
    python3 tools/check_generated.py --all                                         # every file listed in GENERATED below
    python3 tools/check_generated.py --ignore-field sha sfx/manifest.json           # JSON: compare everything except that key (anywhere in the tree)
Run it right AFTER the generator (CI does: build the sound library, then this, then the tests). The generators rewrite their manifests,
including every sound's SHA-256, so a test that runs after the build compares the code with a manifest the build has just written from that
same code: drift between the committed library and the code is invisible to it. This check closes that gap: if the rebuild changed a
committed file, the commit is stale (or the build is not bit-exact on this machine), and the message says which file and how to regenerate it.
A file that is missing, untracked or deleted counts as changed. Uses only git (diff against HEAD, so staged changes count too).
--ignore-field KEY (JSON files only, repeatable) leaves one key out of the comparison and prints how many of its values moved. CI uses it for the sound
SHA-256s: x86-64 Linux and arm64 macOS synthesise 248 of the 301 sounds one 24-bit LSB apart (-138 dBFS; float last bits, same pinned packages), so the
shas are only bit-exact per platform, while every measured field (anchors, peaks, loudness, durations, ...) must match exactly everywhere."""
import json, os, subprocess, sys
PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# committed file -> the command that regenerates it (keep in step with CONTRIBUTING.md and the CI steps)
GENERATED = {
    'sfx/manifest.json': 'python3 sfx/build_library.py',
    'music/manifest.json': 'python3 music/build_music.py',
    'layers/manifest.json': 'node layers/tests/make-manifests.mjs',
    'type/manifest.json': 'node layers/tests/make-manifests.mjs',
    'camera/manifest.json': 'node layers/tests/make-manifests.mjs',
}


def _strip(v, keys, moved, a=None):
    """v without `keys` (recursively); counts in moved[key] the values that differ from the same path in a"""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            other = a.get(k) if isinstance(a, dict) else None
            if k in keys:
                moved[k] = moved.get(k, 0) + (x != other)
            else:
                out[k] = _strip(x, keys, moved, other)
        return out
    if isinstance(v, list):
        return [_strip(x, keys, moved, a[i] if isinstance(a, list) and i < len(a) else None) for i, x in enumerate(v)]
    return v


def changed(paths, root=None, ignore=()):
    """[(path, why)] for every path whose working-tree content differs from HEAD (or that is not tracked / does not exist).
    ignore: JSON keys left out of the comparison (the file must parse as JSON on both sides)."""
    root = root or PACK; out = []
    for p in paths:
        full = os.path.join(root, p)
        tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', p], cwd=root, capture_output=True).returncode == 0
        if not tracked:
            out.append((p, 'not tracked by git' if os.path.exists(full) else 'missing')); continue
        if not os.path.exists(full):
            out.append((p, 'deleted by the generator')); continue
        if ignore:
            head = subprocess.run(['git', 'show', 'HEAD:' + p], cwd=root, capture_output=True, text=True)
            try:
                old_j, new_j = json.loads(head.stdout), json.load(open(full, encoding='utf-8'))
            except ValueError as e:
                out.append((p, 'not JSON, so --ignore-field cannot apply: %s' % e)); continue
            moved = {}
            a, b = _strip(old_j, set(ignore), {}), _strip(new_j, set(ignore), moved, old_j)
            if a != b:
                out.append((p, 'regenerated content differs from the commit outside %s' % ', '.join(ignore)))
            elif any(moved.values()):
                print('note %s: everything matches the commit except %s (expected across CPU platforms; bit-exact only where the commit was built)'
                      % (p, ', '.join('%d %s value(s)' % (n, k) for k, n in moved.items() if n)))
            continue
        r = subprocess.run(['git', 'diff', '--numstat', 'HEAD', '--', p], cwd=root, capture_output=True, text=True)
        if r.returncode != 0:
            out.append((p, 'git diff failed: ' + r.stderr.strip())); continue
        if r.stdout.strip():
            add, rm = r.stdout.split()[:2]
            out.append((p, 'regenerated content differs from the commit (+%s -%s lines)' % (add, rm)))
    return out


def main(argv):
    argv, ignore = list(argv), []
    while '--ignore-field' in argv:
        i = argv.index('--ignore-field'); ignore.append(argv[i + 1]); del argv[i:i + 2]
    paths = list(GENERATED) if argv[:1] == ['--all'] else argv
    if not paths:
        print(__doc__); return 2
    bad = changed(paths, ignore=ignore)
    for p, why in bad:
        cmd = GENERATED.get(p, 'its generator')
        print('FAIL %s: %s.\n     The committed file is stale against the code, or the build is not bit-exact here. Run `%s`, review `git diff %s`, and commit it'
              ' (if only shas moved, check the pinned versions in requirements.txt first).' % (p, why, cmd, p))
    if not bad:
        print('generated files match the commit: %s' % ', '.join(paths))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
