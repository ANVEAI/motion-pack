"""cuts/test_story78.py: the xp-r78 story shape (story78.py, cutgen.py ab-replay / verify-picture): the shape's own rules re-derived from the emitted data, a hand-edited result
must FAIL them, every numeric parameter is guarded, the output is a pure function of its arguments (two calls, two separate processes), the CLI works, and the picture check runs on a
real encode (ffmpeg, skipped without it). Run: python3 -m pytest -q cuts/test_story78.py"""
import copy, json, math, os, shutil, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story78 as S  # noqa: E402
import cutgen  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CUTGEN = os.path.join(REPO, "cuts", "cutgen.py")
FFMPEG = shutil.which("ffmpeg")


def failed(r):
    return [c["check"] for c in S.check_ab_replay(r) if not c["ok"]]


class Replay(unittest.TestCase):
    def setUp(self):
        self.r = S.ab_replay(6.0, 30, "replay", lufs_a=-20.5, lufs_b=-22.1)

    def test_defaults_pass_every_check(self):
        self.assertEqual(failed(self.r), [])
        self.assertEqual(self.r["warnings"], [])
        self.assertGreaterEqual(len(self.r["checks"]), 10)

    def test_the_numbers_of_the_shape(self):
        r = self.r
        A, B = r["passes"]
        self.assertEqual((A["start"], A["end"], B["start"], B["end"]), (0, 180, 180, 360))
        self.assertEqual(r["flip"]["frame"], 180)                                      # the flip is the first frame of pass B
        self.assertEqual(r["audio"]["switch_frame"], 180)
        self.assertEqual(r["audio"]["switch_sample"], 180 * 48000 // 30)               # 288000
        self.assertEqual(A["src_in"], B["src_in"])                                     # the same source frames: the picture is identical
        self.assertEqual(r["audio"]["tracks"][1]["gain_db"], 1.6)                      # B is 1.6 dB quieter: lifted onto A
        self.assertTrue(r["audio"]["level"]["matched"])

    def test_the_gap_pushes_pass_b_but_the_flip_stays_on_its_first_frame(self):
        r = S.ab_replay(4.0, 30, "replay", gap_frames=9)
        self.assertEqual((r["passes"][1]["start"], r["flip"]["frame"], r["frames"]), (129, 129, 249))
        self.assertEqual(failed(r), [])
        self.assertTrue(any("gap_frames 9" in w for w in r["warnings"]))

    def test_the_flip_cue_is_on_the_flip_frame_with_its_anchor_one_after(self):
        c = self.r["sfx"][0]
        self.assertEqual((c["visual_frame"], c["anchor_frame"], c["sfx"]), (180, 181, "sfx/ui/toggle_on"))
        self.assertEqual(self.r["plan_audio"]["abReplay"]["flip_frame"], 180)

    def test_level_gain_is_the_difference_clamped_and_reported(self):
        r = S.ab_replay(5, 30, "replay", lufs_a=-20, lufs_b=-35)
        self.assertEqual(r["audio"]["tracks"][1]["gain_db"], 12.0)
        self.assertFalse(r["audio"]["level"]["matched"])
        self.assertTrue(any("NOT level-matched" in w for w in r["warnings"]))
        self.assertIn("the halves are level-matched within tol_db after the gain on stem B", failed(r))
        r2 = S.ab_replay(5, 30, "replay", lufs_a=-20, lufs_b=-24)
        self.assertTrue(any("large correction" in w for w in r2["warnings"]))
        self.assertEqual(failed(r2), [])
        r3 = S.ab_replay(5, 30, "replay", lufs_a=-24, lufs_b=-20)
        self.assertEqual(r3["audio"]["tracks"][1]["gain_db"], -4.0)                     # a louder B is brought down

    def test_unmeasured_level_keeps_gain_zero_and_says_so(self):
        r = S.ab_replay(5, 30)
        self.assertEqual(r["audio"]["tracks"][1]["gain_db"], 0.0)
        self.assertTrue(any("level not measured" in w for w in r["warnings"]))
        self.assertEqual(failed(r), [])

    def test_a_crossfade_is_centred_on_the_flip_and_never_reaches_before_the_picture(self):
        r = S.ab_replay(5, 30, xfade_ms=40)
        self.assertEqual(r["audio"]["crossfade_samples"], 1920)
        self.assertEqual(failed(r), [])
        r["audio"]["crossfade_samples"] = 2 * r["audio"]["switch_sample"] + 2
        self.assertIn("no crossfade reaches back before the picture flip", failed(r))

    def test_flip_share_and_clip_length_are_linted_not_refused(self):
        self.assertTrue(any("40-45" in w or "35-60" in w for w in S.ab_replay(20, 30, "flip", flip_share=0.9)["warnings"]))
        self.assertTrue(any("clip is" in w for w in S.ab_replay(1.0, 30)["warnings"]))


class Flip(unittest.TestCase):
    def test_one_shot_flip_at_the_share(self):
        r = S.ab_replay(10.0, 30, "flip", flip_share=0.42, kind="slider")
        self.assertEqual(r["frames"], 300)
        self.assertEqual(r["flip"]["frame"], 126)
        A, B = r["passes"]
        self.assertEqual((A["end"], B["start"], B["end"]), (126, 126, 300))
        self.assertEqual(B["src_in"], A["src_in"] + 126)                                # the take continues: no replay
        self.assertEqual(failed(r), [])
        self.assertEqual(r["flip"]["kind"], "slider")

    def test_the_flip_never_lands_on_frame_zero_or_the_last_frame(self):
        for sh in (0.05, 0.95):
            r = S.ab_replay(0.6, 30, "flip", flip_share=sh)
            self.assertTrue(0 < r["flip"]["frame"] < r["frames"])


class HandEdited(unittest.TestCase):
    """every rule can fail: edit the emitted plan and the matching check must name it"""

    def edit(self, fn, expect):
        r = copy.deepcopy(S.ab_replay(6.0, 30, "replay", lufs_a=-20, lufs_b=-23))
        fn(r)
        self.assertIn(expect, failed(r))

    def test_swap_not_on_the_flip_frame(self):
        self.edit(lambda r: r["audio"].__setitem__("switch_frame", r["flip"]["frame"] + 1), "the swap is on the flip frame: stem B starts on it")

    def test_wrong_switch_sample(self):
        self.edit(lambda r: r["audio"].__setitem__("switch_sample", r["audio"]["switch_sample"] + 400), "the switch sample is the flip frame's: round(frame * 48000 / fps)")

    def test_passes_of_different_length(self):
        self.edit(lambda r: r["passes"][1].__setitem__("end", r["passes"][1]["end"] - 3), "both passes are the same length")

    def test_picture_not_identical(self):
        self.edit(lambda r: r["passes"][1].__setitem__("src_in", 5), "both passes read the SAME source frames (src_in equal): the replayed picture is frame-identical")

    def test_gain_that_leaves_the_halves_apart(self):
        self.edit(lambda r: r["audio"]["tracks"][1].__setitem__("gain_db", 0.0), "the halves are level-matched within tol_db after the gain on stem B")

    def test_cue_off_the_flip(self):
        self.edit(lambda r: r["sfx"][0].__setitem__("visual_frame", 179), "the flip cue is on the flip frame, anchor +1")

    def test_plan_block_out_of_step(self):
        self.edit(lambda r: r["plan_audio"]["abReplay"].__setitem__("flip_frame", 179), "plan.audio.abReplay (what ears reads) repeats the frames of the passes and the flip")

    def test_a_frame_outside_the_film(self):
        self.edit(lambda r: r["passes"][1].__setitem__("end", r["frames"] + 5), "every frame is a whole number inside the film")

    def test_stem_a_ending_after_b_starts_in_flip_mode(self):
        r = copy.deepcopy(S.ab_replay(6.0, 30, "flip"))
        r["audio"]["tracks"][0]["end"] += 2
        self.assertIn("stem A ends where its pass ends; in flip mode stem B begins right there, in replay mode after the gap", failed(r))


class Guards(unittest.TestCase):
    def test_every_numeric_parameter_rejects_nonsense_with_its_name(self):
        for name, kw in (("clip_s", {"clip_s": float("nan")}), ("clip_s", {"clip_s": 0.1}), ("clip_s", {"clip_s": 1e9}), ("fps", {"fps": 0}), ("fps", {"fps": float("inf")}), ("gap_frames", {"gap_frames": -1}),
                         ("gap_frames", {"gap_frames": 10 ** 9}), ("flip_share", {"flip_share": 0.0}), ("flip_share", {"flip_share": 1.0}), ("tol_db", {"tol_db": 0}), ("tol_db", {"tol_db": 99}),
                         ("xfade_ms", {"xfade_ms": -5}), ("xfade_ms", {"xfade_ms": 1e6}), ("src_in", {"src_in": -1}), ("lufs_a", {"lufs_a": 3.0, "lufs_b": -20}), ("lufs_b", {"lufs_a": -20, "lufs_b": float("nan")}),
                         ("clip_s", {"clip_s": "6"}), ("clip_s", {"clip_s": True})):
            with self.assertRaises(ValueError, msg=str(kw)) as cm:
                S.ab_replay(**{"clip_s": 6.0, **kw})
            self.assertIn(name, str(cm.exception))

    def test_bad_mode_kind_and_labels(self):
        for kw in ({"mode": "sideways"}, {"kind": "spin"}, {"labels": ("only",)}, {"labels": ("a", "")}, {"labels": ("a", "x" * 40)}, {"labels": "ab"}):
            with self.assertRaises(ValueError, msg=str(kw)):
                S.ab_replay(**kw)

    def test_output_is_bounded_whatever_the_clip(self):
        r = S.ab_replay(600.0, 240, "replay", gap_frames=240)
        self.assertEqual(r["frames"], 2 * 144000 + 240)
        self.assertLess(len(json.dumps(r)), 20000)                                     # a plan, never a per-frame list


class Pure(unittest.TestCase):
    def test_same_arguments_same_bytes_and_the_shared_table_is_not_written(self):
        before = json.dumps(S.STORY["abReplay"], sort_keys=True)
        a = json.dumps(S.ab_replay(6, 30, "replay", lufs_a=-20, lufs_b=-21), sort_keys=True)
        b = json.dumps(S.ab_replay(6, 30, "replay", lufs_a=-20, lufs_b=-21), sort_keys=True)
        self.assertEqual(a, b)
        self.assertEqual(before, json.dumps(S.STORY["abReplay"], sort_keys=True))

    def test_two_fresh_processes_agree(self):
        code = "import sys, json; sys.path.insert(0, %r); import story78 as S; print(json.dumps(S.ab_replay(7.3, 24, 'flip', kind='wipe', lufs_a=-19, lufs_b=-21.4), sort_keys=True))" % os.path.join(REPO, "cuts")
        outs = [subprocess.run([sys.executable, "-I", "-c", code], capture_output=True, text=True, check=True).stdout for _ in range(2)]
        self.assertEqual(outs[0], outs[1])
        self.assertEqual(outs[0].strip(), json.dumps(S.ab_replay(7.3, 24, "flip", kind="wipe", lufs_a=-19, lufs_b=-21.4), sort_keys=True))

    def test_patterns_json_holds_the_numbers_and_the_sfx_resolves(self):
        p = cutgen.PATTERNS["story"]["abReplay"]
        self.assertEqual((p["tol_db"], p["flip_tol_frames"], p["xfade_ms"]), (1.0, 1, 0))
        sfx = json.load(open(os.path.join(REPO, "sfx", "manifest.json")))["sounds"]
        self.assertIn("snd." + p["flip_sfx"].split("/", 1)[1].replace("/", "."), {s["id"] for s in sfx})
        ears = json.load(open(os.path.join(REPO, "ears", "manifest.json")))["spec"]["ab_replay"]
        self.assertEqual((ears["tol_db"], ears["tol_db_max"], ears["novelty_prominence"], ears["flip_tol_frames"]), (p["tol_db"], p["tol_db_max"], p["novelty_prominence"], p["flip_tol_frames"]))   # one set of numbers


class Cli(unittest.TestCase):
    def run_cli(self, *args):
        r = subprocess.run([sys.executable, CUTGEN, *args], capture_output=True, text=True)
        return r

    def test_ab_replay_prints_the_plan(self):
        r = self.run_cli("ab-replay", "--clip-s", "5", "--fps", "30", "--lufs-a", "-20", "--lufs-b", "-22")
        self.assertEqual(r.returncode, 0, r.stderr)
        d = json.loads(r.stdout)
        self.assertEqual((d["pattern"], d["flip"]["frame"], d["audio"]["tracks"][1]["gain_db"]), ("abReplay", 150, 2.0))
        self.assertEqual(d["checks"], S.ab_replay(5, 30, "replay", lufs_a=-20.0, lufs_b=-22.0)["checks"])

    def test_a_bad_number_exits_non_zero_with_a_message(self):
        r = self.run_cli("ab-replay", "--clip-s", "0.01")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("clip_s", r.stderr)


@unittest.skipUnless(FFMPEG, "ffmpeg not found")
class Picture(unittest.TestCase):
    """verify-picture on a real file: a clip played twice is identical; the same file with one frame replaced is not"""

    def make(self, d, name, second):
        out = os.path.join(d, name)
        src = "testsrc2=size=160x90:rate=30:duration=1" if second == "same" else "testsrc2=size=160x90:rate=30:duration=1"
        a = os.path.join(d, "a.mkv")
        subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "lavfi", "-i", src, "-c:v", "ffv1", a], check=True)
        parts = [a, a] if second == "same" else [a, os.path.join(d, "b.mkv")]
        if second != "same":
            subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=30:duration=1,hue=h=90", "-c:v", "ffv1", parts[1]], check=True)
        lst = os.path.join(d, name + ".txt")
        open(lst, "w").write("".join("file '%s'\n" % p for p in parts))
        subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "ffv1", out], check=True)
        return out

    def test_a_clip_played_twice_is_frame_identical_and_a_different_second_pass_is_not(self):
        plan = S.ab_replay(1.0, 30, "replay")
        self.assertEqual(plan["frames"], 60)
        with tempfile.TemporaryDirectory() as d:
            same = S.picture_identical(self.make(d, "same.mkv", "same"), plan)
            self.assertTrue(same["identical"])
            self.assertTrue(same["bit_equal"])
            self.assertEqual(same["frames"], 30)
            diff = S.picture_identical(self.make(d, "diff.mkv", "diff"), plan)
            self.assertFalse(diff["identical"])
            self.assertLess(diff["min_psnr"], 30)

    def test_the_flip_mode_is_refused_and_a_missing_file_is_an_error(self):
        with self.assertRaises(ValueError):
            S.picture_identical("x.mp4", S.ab_replay(5, 30, "flip"))
        with self.assertRaises(RuntimeError):
            S.picture_identical("/nonexistent/file.mp4", S.ab_replay(5, 30, "replay"))


if __name__ == "__main__":
    unittest.main()
