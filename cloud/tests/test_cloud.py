"""offline tests for motion-pack/cloud (no network, no credentials)"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import _gcp  # noqa: E402
import lyria  # noqa: E402
import gemini_voice  # noqa: E402


def test_project_required(monkeypatch):
    monkeypatch.delenv("MP_GCP_PROJECT", raising=False)
    with pytest.raises(_gcp.CloudConfigError):
        _gcp.project()


def test_location_default(monkeypatch):
    monkeypatch.delenv("MP_GCP_LOCATION", raising=False)
    assert _gcp.location() == "us-central1"


def test_endpoint_uses_env(monkeypatch):
    monkeypatch.setenv("MP_GCP_PROJECT", "demo-proj")
    monkeypatch.setenv("MP_GCP_LOCATION", "europe-west4")
    e = lyria.endpoint()
    assert "projects/demo-proj/locations/europe-west4" in e and e.endswith("lyria-002:predict")


def test_lyria_body_seed_and_takes():
    b = lyria.request_body("bed", "vocals", seed=7)
    assert b["instances"][0] == {"prompt": "bed", "negative_prompt": "vocals", "seed": 7} and b["parameters"] == {}
    assert lyria.request_body("bed", takes=3)["parameters"] == {"sample_count": 3}
    with pytest.raises(ValueError):
        lyria.request_body("bed", seed=1, takes=2)


def test_verbatim_normaliser():
    a = gemini_voice.norm_words("Your office's intelligence, kept in your office. On the record.")
    b = gemini_voice.norm_words("Your office’s intelligence kept in your office on the record")
    assert a == b


def test_no_project_ids_in_repo_code():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for f in os.listdir(here):
        if f.endswith(".py"):
            s = open(os.path.join(here, f)).read()
            assert "zapmind" not in s and "anvevoice-prod" not in s, f
