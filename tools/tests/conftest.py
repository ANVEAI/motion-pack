"""Fixtures for the template-build tests: a scratch copy of the README's worked-example template inside templates/ (templates find the pack two folders up, so the copy has to live there)
and a `make` runner for `node make.mjs`. Nothing is rendered."""
import os
import shutil
import subprocess
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp_build import EXAMPLE, NODE, REPO, ensure_bed, env  # noqa: E402


@pytest.fixture()
def brewly():
    """a scratch templates/wx-brewly-*/ holding a copy of the example template, exactly the README's `cp examples/brewly-teaser/template/* templates/brewly/`; removed afterwards"""
    if NODE is None:
        pytest.skip("node is not installed")
    ensure_bed()
    d = tempfile.mkdtemp(prefix="wx-brewly-", dir=os.path.join(REPO, "templates"))
    for f in os.listdir(EXAMPLE):
        shutil.copy(os.path.join(EXAMPLE, f), d)
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


@pytest.fixture()
def make():
    """make(dir, *args, extra_env={}) -> CompletedProcess of `node make.mjs *args` run inside dir"""
    def run(d, *args, extra_env=None):
        return subprocess.run([NODE, "make.mjs", *args], cwd=d, capture_output=True, text=True, env={**env(), **(extra_env or {})}, timeout=600)
    return run
