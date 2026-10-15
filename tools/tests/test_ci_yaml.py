"""The CI workflow must stay valid YAML. A step name with an unquoted ': ' (for example 'context: rise') is read as a new
mapping key, GitHub refuses the whole file ('workflow file issue') and no job runs, while every local test still passes because
the steps are run from their commands. This test fails on that before a push."""
import os
import re

import pytest

CI = os.path.join(os.path.dirname(__file__), '..', '..', '.github', 'workflows', 'ci.yml')


def test_no_unquoted_step_value_contains_colon_space():
    bad = []
    for n, line in enumerate(open(CI, encoding='utf-8'), 1):
        m = re.match(r'^\s*(?:-\s*)?(name|run):\s*(.*)$', line.rstrip('\n'))
        if not m:
            continue
        v = m.group(2)
        if v and v[0] not in '"\'|>' and ': ' in v:
            bad.append('%d: %s' % (n, line.strip()[:120]))
    assert not bad, 'quote these values (an unquoted ": " breaks the YAML):\n' + '\n'.join(bad)


def test_ci_yaml_parses():
    yaml = pytest.importorskip('yaml')
    d = yaml.safe_load(open(CI, encoding='utf-8'))
    jobs = d.get('jobs') or {}
    assert jobs, 'no jobs parsed'
    for name, job in jobs.items():
        assert job.get('steps'), 'job %s has no steps' % name
