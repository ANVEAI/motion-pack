"""offline tests for motion-pack/cloud (no network, no credentials)"""
import json
import os
import re
import shutil
import subprocess
import sys
import wave

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import _gcp  # noqa: E402
import lyria  # noqa: E402
import gemini_voice  # noqa: E402
import gemini_mood  # noqa: E402


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


# ---------------------------------------------------------------- no project ids, keys or tokens in the repo (audit H5, D14)
# The old test looked for two hard-coded names (and published them). This one knows the SHAPE of a Google Cloud project id (6-30 chars: a letter, then
# letters / digits / hyphens, ending in a letter or digit) and refuses one that is assigned, passed as a keyword, defaulted in an env lookup or written into
# an endpoint in any cloud/*.py. The maintainers' own project names live in tools/name_denylist.txt as hashes (tools/check_names.py), so no name is in this file.
PID = r"[a-z][a-z0-9-]{4,28}[a-z0-9]"
PID_RULES = [
    ("a project id assigned or passed as a literal", re.compile(r"""(?i)\b\w*project\w*["']?\s*[:=]\s*["']%s["']""" % PID)),
    ("a non-empty default for MP_GCP_PROJECT", re.compile(r"""(?:environ\.get|getenv)\(\s*["']MP_GCP_PROJECT["']\s*,\s*["'][^"']+["']""")),
    ("a literal project in an endpoint", re.compile(r"projects/(?![%{$<])" + PID + r"/(?:locations|models)")),
]
SECRET_RULES = [("a Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35}")), ("an OAuth access token", re.compile(r"ya29\.[0-9A-Za-z_-]{20,}")),
                ("a private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")), ("a billing account id", re.compile(r"\b[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}\b"))]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(HERE)


def pid_problems(src):
    return [name for name, rx in PID_RULES if rx.search(src)]


def test_project_id_rules_catch_the_audit_repro_and_leave_the_real_code_alone():
    bad = ['PROJECT = "acme-prod-482113"', 'client = Client(project="demo-proj")', 'p = os.environ.get("MP_GCP_PROJECT", "acme-prod-482113")',
           'u = "https://x/v1/projects/acme-prod-482113/locations/us-central1/models/m"', "gcp_project: 'my-sandbox-1'"]
    ok = ['p = os.environ.get("MP_GCP_PROJECT", "").strip()', "genai.Client(vertexai=True, project=project(), location=location())",
          '"/projects/%s/locations/%s/publishers/google/models/%s:predict"', 'u = f"projects/{p}/locations/{l}/models/m"', "project = os.environ['MP_GCP_PROJECT']"]
    assert all(pid_problems(s) for s in bad), [s for s in bad if not pid_problems(s)]
    assert not any(pid_problems(s) for s in ok), [s for s in ok if pid_problems(s)]


def test_no_project_id_in_any_cloud_module():
    for f in sorted(os.listdir(HERE)):
        if f.endswith(".py"):
            assert not pid_problems(open(os.path.join(HERE, f)).read()), f


def test_appending_a_project_id_to_a_real_module_is_caught(tmp_path):
    """the audit's repro: the old test still printed 'passed' after PROJECT = "acme-prod-482113" was appended to cloud/_gcp.py"""
    src = open(os.path.join(HERE, "_gcp.py")).read()
    assert not pid_problems(src) and pid_problems(src + '\nPROJECT = "acme-prod-482113"\n')


def test_no_key_token_or_billing_id_in_any_tracked_file():
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    hits = []
    for rel in filter(None, files):
        p = os.path.join(ROOT, rel)
        if rel.endswith((".cube", ".jpg", ".png", ".mp3", ".mp4", ".wav", ".ttf", ".gif", ".webp", ".woff2")) or not os.path.isfile(p) or os.path.getsize(p) > 3_000_000:
            continue
        raw = open(p, "rb").read()
        if b"\0" in raw[:4096]:
            continue
        s = raw.decode("utf8", "replace")
        hits += [f"{rel}: {name}" for name, rx in SECRET_RULES if rx.search(s)]
    assert not hits, hits


# ---------------------------------------------------------------- every paid tool prints an estimate first and has --dry-run (audit H6, D14)
class Boom(AssertionError):
    pass


def no_network(monkeypatch):
    """any attempt to reach Google, load credentials or call the model fails the test"""
    def boom(*a, **k):
        raise Boom("network or credential access in a dry run")
    monkeypatch.setattr(_gcp, "genai_client", boom)
    monkeypatch.setattr(_gcp, "access_token", boom)
    monkeypatch.setattr(lyria.urllib.request, "urlopen", boom)
    monkeypatch.setattr(gemini_voice, "render", boom)
    monkeypatch.setattr(gemini_mood, "judge", boom)
    monkeypatch.delenv("MP_GCP_PROJECT", raising=False)


def test_voice_estimate_and_preview():
    lines = [{"id": "a", "text": "One."}, {"id": "b", "text": "Two.", "voice": "Kore", "style": "calm"}]
    assert gemini_voice.estimate_usd(lines) == pytest.approx(0.02)
    pv = gemini_voice.request_preview(lines, "Charon")
    assert [p["voice"] for p in pv] == ["Charon", "Kore"] and pv[1]["system_instruction"].endswith("Style: calm") and pv[0]["text"] == "One."
    assert pv[0]["model"] == gemini_voice.MODEL


def test_mood_estimate_and_preview():
    assert gemini_mood.estimate_usd(0) == gemini_mood.estimate_usd(30) == 0.01 and gemini_mood.estimate_usd(30.5) == 0.02 and gemini_mood.estimate_usd(95) == 0.04
    pv = gemini_mood.request_preview("bed.wav", "calm", 12.5)
    assert pv["model"] == gemini_mood.MODEL and pv["prompt"].endswith("Brief: calm") and pv["audio"]["duration_s"] == 12.5 and pv["temperature"] == 0


def test_voice_dry_run_prints_the_estimate_and_the_request_and_calls_nothing(monkeypatch, capsys, tmp_path):
    no_network(monkeypatch)
    gemini_voice.main(["--line", "Hello there.", "--out", str(tmp_path / "vo"), "--voice", "Kore", "--dry-run"])
    cap = capsys.readouterr()
    assert "Gemini Live voice: 1 line(s), at most about US$0.01" in cap.err
    req = json.loads(cap.out)
    assert req[0]["text"] == "Hello there." and req[0]["voice"] == "Kore" and not os.path.exists(tmp_path / "vo")


def test_voice_estimate_is_printed_before_the_first_call(monkeypatch, capsys, tmp_path):
    seen = {}
    monkeypatch.setattr(gemini_voice, "render", lambda *a, **k: (seen.setdefault("err_at_call", capsys.readouterr().err), ([], []))[1])
    gemini_voice.main(["--line", "Hi.", "--out", str(tmp_path)])
    assert "US$" in seen["err_at_call"], "the estimate must be on stderr before render() runs"


def wav(path, seconds=1):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b"\0\0" * 8000 * seconds)
    return str(path)


@pytest.mark.skipif(shutil.which("ffprobe") is None, reason="ffprobe not on PATH")
def test_mood_dry_run_prints_the_estimate_and_the_request_and_calls_nothing(monkeypatch, capsys, tmp_path):
    no_network(monkeypatch)
    gemini_mood.main([wav(tmp_path / "a.wav", 2), "--brief", "calm", "--dry-run"])
    cap = capsys.readouterr()
    assert "Gemini mood judge: 1 clip of 2.0 s, at most about US$0.01" in cap.err
    req = json.loads(cap.out)
    assert req["prompt"].endswith("Brief: calm") and req["audio"]["duration_s"] == pytest.approx(2.0, abs=0.1)


def test_mood_dry_run_without_ffprobe_still_works(monkeypatch, capsys):
    no_network(monkeypatch)
    monkeypatch.setattr(gemini_mood, "duration", lambda p: (_ for _ in ()).throw(FileNotFoundError("ffprobe")))
    gemini_mood.main(["nope.wav", "--dry-run"])
    cap = capsys.readouterr()
    assert "1 clip, at most about US$0.01" in cap.err and json.loads(cap.out)["audio"]["duration_s"] is None


def test_mood_estimate_is_printed_before_the_call(monkeypatch, capsys):
    monkeypatch.setattr(gemini_mood, "duration", lambda p: 10.0)
    seen = {}
    monkeypatch.setattr(gemini_mood, "judge", lambda *a, **k: (seen.setdefault("err_at_call", capsys.readouterr().err), {"ok": 1})[1])
    gemini_mood.main(["x.wav"])
    assert "US$" in seen["err_at_call"]


def test_lyria_dry_run_prints_the_estimate_and_calls_nothing(monkeypatch, capsys, tmp_path):
    no_network(monkeypatch)
    lyria.main(["a bed", "--out", str(tmp_path / "b.wav"), "--takes", "2", "--dry-run"])
    cap = capsys.readouterr()
    assert "Lyria: 2 take(s), about US$0.12" in cap.err and json.loads(cap.out)["parameters"] == {"sample_count": 2}


def test_every_paid_tool_advertises_dry_run():
    for tool in ("lyria.py", "gemini_voice.py", "gemini_mood.py"):
        r = subprocess.run([sys.executable, os.path.join(HERE, tool), "--help"], capture_output=True, text=True)
        assert r.returncode == 0 and "--dry-run" in r.stdout, tool
