#!/usr/bin/env python3
"""Smoke test for tools/refstudy.py on a generated 3 s clip (ffmpeg lavfi, no network, no Whisper): three colour shots cut at 1 s and 2 s over a
sine with a beep every second. Run: python3 -m pytest -q tools/tests"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import pytest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_refstudy_on_a_generated_clip():
    with tempfile.TemporaryDirectory() as td:
        clip = os.path.join(td, "clip.mp4")
        src = ["-f", "lavfi", "-i"]
        subprocess.run([FFMPEG, "-v", "error", "-nostdin", "-y",
                        *src, "color=c=red:s=320x240:r=30:d=1", *src, "color=c=blue:s=320x240:r=30:d=1", *src, "color=c=white:s=320x240:r=30:d=1",
                        *src, "sine=f=220:beep_factor=4:d=3:sample_rate=48000",
                        "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3",
                        "-c:v", "mpeg4", "-q:v", "5", "-c:a", "aac", "-shortest", clip], check=True)
        out = os.path.join(td, "out")
        r = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), clip, out, "--whisper", "none"], capture_output=True, text=True, timeout=180)
        assert r.returncode == 0, r.stderr
        for f in ("meta.json", "sheet.jpg", "timeline.png", "study.json"):
            assert os.path.getsize(os.path.join(out, f)) > 0, f
        st = json.load(open(os.path.join(out, "study.json")))
        assert abs(st["meta"]["duration"] - 3.0) < 0.1
        assert [round(c) for c in st["cuts"]] == [1, 2]                      # the two colour changes
        assert st["edit"]["shot_len_median_s"] == pytest.approx(1.0, abs=0.1)
        assert st["loudness"]["integrated_lufs"] is not None
        a = st["audio"]
        assert a["onsets"] and "_plot" not in a
        assert a["sync"]["cuts"] == 2 and a["sync"]["share_on_onset"] >= 0.5  # the cuts sit on the beeps
        assert st["speech"] is None


def _lavfi_clip(path, vf, af, dur, fps=30):
    subprocess.run([FFMPEG, "-v", "error", "-nostdin", "-y", "-f", "lavfi", "-i", f"color=c=0x202428:s=320x180:r={fps}:d={dur}",
                    "-f", "lavfi", "-i", f"aevalsrc='{af}':s=48000:d={dur}", "-vf", vf, "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264" if _has_x264() else "mpeg4", "-q:v", "3", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", path], check=True)


def _has_x264():
    return "libx264" in subprocess.run([FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout


EVENTS = (1.0, 2.5, 4.0)


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_motion_events_on_a_continuous_clip_land_on_their_frames_and_sync_to_the_clicks():
    """no hard cuts: three boxes appear (a filled panel, an outline 'text' block, a full-width bar) at known times, each with a click"""
    sys.path.insert(0, TOOLS)
    import refstudy
    with tempfile.TemporaryDirectory() as td:
        clip = os.path.join(td, "cont.mp4")
        vf = ("drawbox=x=20:y=20:w=60:h=40:color=0xE8B662:t=fill:enable='gte(t,1.0)',"
              "drawbox=x=120:y=60:w=90:h=30:color=white:t=2:enable='gte(t,2.5)',drawbox=x=130:y=70:w=70:h=2:color=white:t=fill:enable='gte(t,2.5)',"
              "drawbox=x=0:y=140:w=320:h=24:color=0x4A18ED:t=fill:enable='gte(t,4.0)'")
        clicks = "+".join(f"between(t,{t},{t + 0.03})" for t in EVENTS)
        _lavfi_clip(clip, vf, f"0.02*sin(2*PI*110*t)+0.6*sin(2*PI*1500*t)*({clicks})", 6)
        cuts = refstudy.cuts(clip)
        assert cuts == []                                                   # a continuous piece: the cut sync has nothing to measure
        m = refstudy.motion_events(clip, cuts)
        assert len(m["events"]) == 3, m
        for got, want in zip(m["events"], EVENTS):
            assert abs(got - want) <= 1.0 / 30 + 1e-6                       # within one frame
        a = refstudy.audio_analysis(clip, cuts)
        sy = refstudy.motion_sync(m, a["onsets"], None, refstudy.video_fps(clip))
        assert sy["share_on_onset"] == 1.0
        assert sy["reading"] == "above chance" and sy["chance_share"] < 0.2 and sy["z_vs_chance"] >= 2      # 3 of 3 against a few percent of the timeline
        assert a["sync"]["share_on_onset"] is None and "vs_chance_onset" not in a["sync"]
        assert refstudy.motion_events(clip, cuts)["events"] == m["events"]  # deterministic on the same file


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_quiet_open_and_quiet_tail_are_measured():
    """sound enters at 1.5 s over a moving picture and the last 2.5 s hold near-silence (about -60 dBFS) under the end card"""
    sys.path.insert(0, TOOLS)
    import refstudy
    with tempfile.TemporaryDirectory() as td:
        clip = os.path.join(td, "q.mp4")
        _lavfi_clip(clip, "drawbox=x='mod(t*60,300)':y=40:w=20:h=20:color=white:t=fill",
                    "0.001*sin(2*PI*300*t)+0.25*sin(2*PI*220*t)*between(t,1.5,9.5)", 12)
        a = refstudy.audio_analysis(clip, [])
        q = refstudy.quiet_shape(a["loudness_curve_4hz_dbfs"])
        assert q["quiet_open"] and q["open_vs_body_db"] < -30
        assert q["quiet_tail"] and q["tail_2s_vs_body_db"] < -30
        assert q["end_shape"] == "quiet hold"
        assert q["sound_enters_s"] == pytest.approx(1.5, abs=0.25)
        loud = refstudy.quiet_shape([-14.0] * 48)
        assert not loud["quiet_open"] and not loud["quiet_tail"] and loud["end_shape"] == "slam"

def test_chance_level_is_the_covered_share_of_the_timeline():
    sys.path.insert(0, TOOLS)
    import refstudy
    assert refstudy._chance([1.0, 2.0, 3.0], 0.1, 10.0) == pytest.approx(0.6 / 10.0)
    assert refstudy._chance([1.0, 1.05, 1.1], 0.1, 10.0) == pytest.approx(0.3 / 10.0)        # overlapping windows are counted once
    assert refstudy._chance([0.0, 10.0], 0.1, 10.0) == pytest.approx(0.2 / 10.0)             # clipped at the ends
    assert refstudy._chance([], 0.1, 10.0) == 0.0 and refstudy._chance([1.0], 0.1, 0.0) == 0.0
    near = refstudy._vs_chance(5, 10, 0.5)
    assert near["reading"] == "near chance" and near["lift"] == pytest.approx(1.0) and near["z_vs_chance"] == 0.0
    assert refstudy._vs_chance(10, 10, 0.4)["reading"] == "above chance"
    assert refstudy._vs_chance(0, 10, 0.4)["reading"] == "below chance"
    assert refstudy._vs_chance(0, 0, 0.4) == {}


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_a_dense_soundtrack_is_read_as_near_chance_and_a_24_fps_file_uses_its_own_frames():
    """eight visual events against a click every 0.15 s: nearly every event 'hits' a click, and the chance level says so; 24 fps source -> 2 frames = 83 ms"""
    sys.path.insert(0, TOOLS)
    import refstudy
    with tempfile.TemporaryDirectory() as td:
        clip = os.path.join(td, "dense.mp4")
        evs = [1.0, 1.9, 2.6, 3.7, 4.4, 5.3, 6.1, 7.0]
        vf = ",".join(f"drawbox=x={10 + 36 * i}:y={20 + 12 * (i % 3)}:w=30:h=26:color=0xE8B662:t=fill:enable='gte(t,{t})'" for i, t in enumerate(evs))
        clicks = "+".join(f"between(t,{0.15 * i:.2f},{0.15 * i + 0.02:.2f})" for i in range(1, 60))
        _lavfi_clip(clip, vf, f"0.02*sin(2*PI*110*t)+0.5*sin(2*PI*1500*t)*({clicks})", 9, fps=24)
        fps = refstudy.video_fps(clip)
        assert fps == pytest.approx(24.0)
        a = refstudy.audio_analysis(clip, [], fps)
        m = refstudy.motion_events(clip, [])
        sy = refstudy.motion_sync(m, a["onsets"], None, fps)
        assert sy["tolerance_s"] == pytest.approx(2 / 24, abs=1e-3)
        assert sy["onsets_per_s"] > 4 and sy["chance_share"] > 0.4
        assert sy["reading"] != "above chance", sy                           # a share this easy to get by luck is not evidence of sync
        assert refstudy.video_fps("/nonexistent.mp4") == 30.0                # unreadable: the documented default


@pytest.mark.skipif(shutil.which(FFMPEG) is None, reason="ffmpeg not on PATH")
def test_motion_cli_fills_an_existing_study_from_a_local_copy(tmp_path):
    clip = str(tmp_path / "cont.mp4")
    vf = "drawbox=x=20:y=20:w=60:h=40:color=0xE8B662:t=fill:enable='gte(t,1.0)',drawbox=x=0:y=140:w=320:h=24:color=0x4A18ED:t=fill:enable='gte(t,3.0)'"
    clicks = "+".join(f"between(t,{t},{t + 0.03})" for t in (1.0, 3.0))
    _lavfi_clip(clip, vf, f"0.02*sin(2*PI*110*t)+0.6*sin(2*PI*1500*t)*({clicks})", 5)
    d = tmp_path / "study"; d.mkdir()
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), clip, str(d), "--whisper", "none"], capture_output=True, text=True, timeout=180)
    assert r.returncode == 0, r.stderr
    st = json.load(open(d / "study.json")); st.pop("motion"); st["video_fps"] = None
    json.dump(st, open(d / "study.json", "w"))                                # a study made before the motion measure existed
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), "motion", clip, str(d), "--write"], capture_output=True, text=True, timeout=180)
    assert r.returncode == 0, r.stderr
    st = json.load(open(d / "study.json"))
    assert len(st["motion"]["events"]) == 2 and st["motion"]["sync"]["share_on_onset"] == 1.0 and "_curve" not in st["motion"]
    assert st["cuts"] == [] and st["audio"]["onsets"]                         # nothing else was touched
    bad = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), "motion", "https://example.invalid/x.mp4", str(d)], capture_output=True, text=True, timeout=60)
    assert bad.returncode != 0 and "local" in (bad.stderr + bad.stdout)      # a URL is refused: this command downloads nothing



# public reach numbers of the 29 round 4/5 references at study time (views, followers, likes, bookmarks, replies) and the tier the
# intake graded by hand (the table in docs/research/reference-round45-2026-10.md, same order); the keys are numbers on purpose,
# the fixture is about the grading rules and names no account; "*" = claim-driven
R45 = {
    "r01": (2604288, 806738, 10000, 2428, 517, "A"), "r02": (424982, 106691, 6349, 7040, 131, "A"),
    "r03": (343238, 87719, 3570, 1227, 111, "A"), "r04": (680722, 86074, 1661, 969, 175, "A"),
    "r05": (2230648, 1569255, 5651, 1365, 305, "B'"), "r06": (4188607, 11933302, 23989, 3231, 1283, "R"),
    "r07": (367937, 8499, 937, 663, 129, "A*"), "r08": (165351, 203268, 1037, 238, 69, "C"),
    "r09": (14587, 42371, 247, 214, 13, "A-"), "r10": (106810, 43365, 687, 369, 28, "A"),
    "r11": (985135, 31896039, 2315, 332, 138, "R"), "r12": (37452, 293518, 223, 84, 31, "C"),
    "r13": (19490, 2284, 291, 240, 20, "A"), "r14": (302693, 247548, 792, 340, 97, "C"),
    "r15": (1673532, 226568, 366, 270, 91, "B"), "r16": (12472095, 29301982, 23031, 3781, 870, "R"),
    "r17": (5389230, 2081307, 16403, 3814, 1418, "A"), "r18": (9810, 5069, 101, 37, 8, "A"),
    "r19": (1693515, 40476, 6571, 4361, 276, "A*"), "r20": (600046, 9962, 300, 190, 29, "B"),
    "r21": (3543555, 882, 1278, 853, 181, "B"), "r22": (36287, 90916, 323, 476, 13, "A-"),
    "r23": (33530, 165428, 521, 106, 113, "C"), "r24": (222873, 122, 323, 178, 139, "B"),
    "r25": (5812, 67453, 74, 11, 7, "C"), "r26": (24170, 190331, 222, 46, 14, "C"),
    "r27": (602178, 31895927, 2599, 398, 104, "R"), "r28": (26272, 7934, 328, 262, 19, "A"),
    "r29": (8491, 570409, 68, 7, 20, "C"),
}


def test_evidence_tiers_match_the_round45_grading():
    sys.path.insert(0, TOOLS)
    import refstudy
    got = {}
    for k, (v, f, li, bm, rp, _) in R45.items():
        got[k] = refstudy.grade({"views": v, "followers": f, "likes": li, "bookmarks": bm, "replies": rp})["display"]
    assert got == {k: x[-1] for k, x in R45.items()}
    ev = refstudy.grade({"views": 3543555, "followers": 882, "likes": 1300, "bookmarks": 700, "replies": 180})
    assert ev["boosted"] and ev["tier"] == "B" and ev["reasons"]
    assert refstudy.grade({"views": None, "followers": 10})["tier"] == "D"
    miss = refstudy.grade({"views": 9810, "followers": 5069})                                                 # no likes key: missing data, not "zero likes"
    assert miss["tier"] == "D" and not miss["boosted"] and "like count" in miss["reasons"][0]
    nobm = refstudy.grade({"views": 9810, "followers": 5069, "likes": 300})                                   # no bookmarks key: still graded, bm cannot make a tier
    assert nobm["tier"] == "A" and nobm["numbers"]["bm_pct"] is None
    assert refstudy.grade({"views": 9810, "followers": 5069, "likes": 0})["boosted"]                          # an explicit 0 is data
    assert refstudy.grade({"views": 9810, "followers": 5069, "likes": 101}, override="C")["tier"] == "C"      # --tier / meta tier_override
    strict = json.load(open(refstudy.TIERS)); strict["A"]["vf_min"] = 2.0                                      # --tiers: thresholds are data
    assert refstudy.grade({"views": 9810, "followers": 5069, "likes": 101, "bookmarks": 37}, strict)["tier"] == "C"


def test_grade_cli_on_a_study_folder(tmp_path):
    d = tmp_path / "study-a"; d.mkdir()
    json.dump({"views": 26272, "followers": 7934, "likes": 328, "bookmarks": 262, "replies": 19}, open(d / "meta.json", "w"))
    json.dump({"audio": {"loudness_curve_4hz_dbfs": [-60.0] * 3 + [-16.0] * 60 + [-70.0] * 30}}, open(d / "study.json", "w"))
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), "grade", str(d), "--write"], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    assert "study-a" in r.stdout and " A " in r.stdout
    st = json.load(open(d / "study.json"))
    assert st["evidence"]["tier"] == "A" and st["quiet"]["end_shape"] == "quiet hold"


def test_grade_cli_reports_a_mistyped_or_empty_path_and_exits_nonzero(tmp_path):
    good = tmp_path / "good"; good.mkdir()
    json.dump({"views": 26272, "followers": 7934, "likes": 328, "bookmarks": 262, "replies": 19}, open(good / "meta.json", "w"))
    empty = tmp_path / "empty"; empty.mkdir()
    tiers = tmp_path / "t.json"; tiers.write_text(open(os.path.join(TOOLS, "refstudy_tiers.json")).read())
    run = lambda *a: subprocess.run([sys.executable, os.path.join(TOOLS, "refstudy.py"), "grade", *a], capture_output=True, text=True, timeout=60)
    ok = run(str(good), "--tiers", str(tiers))
    assert ok.returncode == 0 and "good" in ok.stdout and ok.stderr == ""           # the value after --tiers is not a study path
    typo = run(str(good), str(tmp_path / "godo"))
    assert typo.returncode == 1 and "not a folder" in typo.stderr and "good" in typo.stdout   # the valid one is still graded
    assert run(str(empty)).returncode == 1 and "no meta.json" in run(str(empty)).stderr
    assert run().returncode != 0 and run("--write").returncode != 0                  # nothing to grade is not a success
