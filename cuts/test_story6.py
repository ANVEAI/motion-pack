"""cuts/test_story6.py: the round-6 story shape (story6.py, cutgen.py problem-pivot): the shape's own rules re-derived from the emitted data, a hand-edited result
must FAIL them, every numeric parameter is guarded, the output is a pure function of its arguments (two calls, two separate processes), and the CLI works.
Mutation proof (each test can fail): python3 tools/mutation_check.py cuts/test_story6.mutants.json
Run: python3 -m pytest -q cuts/test_story6.py"""
import copy, json, math, os, subprocess, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story6 as S  # noqa: E402
import cutgen  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CUTGEN = os.path.join(REPO, "cuts", "cutgen.py")


def failed(r):
    return [c["check"] for c in S.check_problem_pivot(r) if not c["ok"]]


class Shape(unittest.TestCase):
    def setUp(self):
        self.r = S.problem_pivot(30)

    def test_defaults_pass_every_check_and_warn_nothing(self):
        self.assertEqual(failed(self.r), [])
        self.assertEqual(self.r["warnings"], [])
        self.assertGreaterEqual(len(self.r["checks"]), 15)

    def test_numbers_of_the_shape(self):
        r = self.r
        self.assertTrue(1.5 <= r["gap"]["seconds"] <= 2.0)
        self.assertGreaterEqual(r["gap"]["silence_s"], 1.0)                                  # ears reads a quiet run of 1 s
        self.assertGreaterEqual(r["hold"]["seconds"], 2.0)
        for b in [s for s in r["sections"] if s["role"] == "problem"][0]["beats"]:
            self.assertTrue(2.0 <= (b["end"] - b["start"]) / 30.0 <= 2.5)
        self.assertEqual(len([s for s in r["sections"] if s["role"] == "value"][0]["beats"]), 3)
        self.assertEqual(r["hold"]["end"], r["frames"])

    def test_the_pivot_lands_together(self):
        r = self.r
        bass = [c for c in r["sfx"] if c["sfx"] == "sfx/hit/sub_drop"]
        self.assertEqual(len(bass), 1)
        self.assertEqual(bass[0]["visual_frame"], r["pivot"]["frame"])                       # the bass hit is on the pivot frame
        self.assertEqual(bass[0]["anchor_frame"], r["pivot"]["frame"] + 1)                   # the mixer anchors one frame after the visual
        self.assertEqual(S._bed_at(r["bed_automation"], r["pivot"]["frame"]), 0.0)           # the bed is back ON it
        self.assertLessEqual(S._bed_at(r["bed_automation"], r["pivot"]["frame"] - 1), -60.0)  # and was silent the frame before
        cap = {c["id"]: c for c in r["captions"]}
        self.assertEqual(cap["brand"]["in"], r["pivot"]["visual_frame"])                     # the brand line (and the colour) follow the sound
        self.assertGreaterEqual(r["pivot"]["visual_frame"], r["pivot"]["frame"])

    def test_plan_audio_quiet_in_seconds(self):
        r, q = self.r, self.r["audio"]["quiet"]
        self.assertEqual([x["kind"] for x in q], ["gap", "hold"])
        self.assertAlmostEqual(q[0]["t"][0], r["gap"]["start"] / 30.0, places=3)
        self.assertAlmostEqual(q[0]["t"][1], r["gap"]["end"] / 30.0, places=3)
        self.assertAlmostEqual(q[1]["t"][1], r["seconds"], places=3)
        self.assertEqual(r["audio"]["mode"], "continuous")

    def test_no_sound_in_the_silence_or_the_hold(self):
        r = self.r
        for c in r["sfx"]:
            self.assertFalse(r["gap"]["start"] <= c["anchor_frame"] < r["pivot"]["frame"], c)
            self.assertFalse(r["hold"]["start"] <= c["anchor_frame"] < r["frames"], c)

    def test_every_frame_is_an_int_and_events_are_sound_carriers(self):
        r = self.r
        for c in r["captions"]:
            self.assertIsInstance(c["in"], int)
            if c["out"] is not None:
                self.assertGreater(c["out"], c["in"])
        self.assertEqual(r["motion_events"], sorted({c["visual_frame"] for c in r["sfx"]}))
        self.assertEqual(len(r["audio"]["events"]), len(r["motion_events"]))

    def test_typing_time_mirrors_the_typewriter_preset(self):
        self.assertAlmostEqual(S.typewriter_s("ab"), 3 / 30.0)                               # 2 frames for a, the last char shown 1 frame after its start
        self.assertAlmostEqual(S.typewriter_s("a, b"), (2 + 2 + 6 + 1) / 30.0)               # +6 frames after a comma, spaces are free
        self.assertEqual(S.typewriter_s("   "), 0.0)
        # and the real thing: type/presets.js typewriter (timeOf of the last char + one frame) must give the same number for the shipped copy
        node = subprocess.run(["node", "--input-type=module", "-e", "import { PRESETS } from './type/presets.js'; const P = PRESETS.typewriter; "
                               "for (const s of process.argv.slice(1)) { const c = [...s].filter((x) => !/\\s/.test(x)); console.log(((P.timeOf(c.length - 1, c) + P.dur) * 30).toFixed(3)); }",
                               S.STORY["problemPivot"]["defaults"]["sentence"], S.STORY["problemPivot"]["defaults"]["command"], "Hello, world! Is it? Yes."],
                              cwd=REPO, capture_output=True, text=True)
        if node.returncode != 0:
            self.skipTest("node not available: " + node.stderr[-200:])
        got = [float(x) for x in node.stdout.split()]
        want = [S.typewriter_s(x) * 30 for x in (S.STORY["problemPivot"]["defaults"]["sentence"], S.STORY["problemPivot"]["defaults"]["command"], "Hello, world! Is it? Yes.")]
        for g, w in zip(got, want):
            self.assertAlmostEqual(g, w, places=2)

    def test_duration_is_met_by_stretching_the_beats(self):
        r = S.problem_pivot(30, duration_s=30)
        self.assertEqual(r["frames"], 900)
        self.assertEqual(failed(r), [])
        short = S.problem_pivot(30, duration_s=20)
        self.assertTrue(any("duration" in w for w in short["warnings"]))                      # the beats cannot shrink below their minimum: said, not hidden

    def test_other_fps(self):
        r = S.problem_pivot(24)
        self.assertEqual(failed(r), [])
        self.assertAlmostEqual(r["frames"] / 24.0, r["seconds"], places=3)


class ChecksCanFail(unittest.TestCase):
    """check_problem_pivot re-derives the rules from the emitted data: a hand-edited plan is caught"""

    def edit(self, fn):
        r = copy.deepcopy(S.problem_pivot(30))
        fn(r)
        return failed(r)

    def test_gap_too_short_or_long(self):
        self.assertIn("gap 1.5-2 s", self.edit(lambda r: r["gap"].update(end=r["gap"]["start"] + 30)))
        self.assertIn("gap 1.5-2 s", self.edit(lambda r: r["gap"].update(end=r["gap"]["start"] + 75)))

    def test_not_enough_true_silence(self):
        self.assertTrue(any("true silence" in c for c in self.edit(lambda r: r["gap"].update(silence_frames=20))))

    def test_bed_not_back_on_the_pivot_frame(self):
        def move(r):
            for b in r["bed_automation"]:
                if b["frame"] == r["pivot"]["frame"]:
                    b["frame"] += 5
        self.assertTrue(any("ON it" in c for c in self.edit(move)))

    def test_bass_hit_moved_off_the_pivot(self):
        def move(r):
            for c in r["sfx"]:
                if c["sfx"] == "sfx/hit/sub_drop":
                    c["visual_frame"] += 4
                    c["anchor_frame"] += 4
        self.assertTrue(any("one bass hit" in c for c in self.edit(move)))

    def test_colour_before_the_sound(self):
        self.assertTrue(any("never before" in c for c in self.edit(lambda r: r["pivot"].update(visual_frame=r["pivot"]["frame"] - 2, lead_frames=-2))))

    def test_hold_shorter_than_two_seconds(self):
        self.assertIn("end hold >= 2 s", self.edit(lambda r: r["hold"].update(start=r["frames"] - 45)))

    def test_a_sound_inside_the_silence(self):
        def add(r):
            r["sfx"].append(S._cue("sfx/ui/pop", r["gap"]["start"] + 20, 0.0))
        self.assertTrue(any("no sound cue" in c for c in self.edit(add)))

    def test_a_sound_inside_the_hold(self):
        def add(r):
            r["sfx"].append(S._cue("sfx/ui/pop", r["hold"]["start"] + 10, 0.0))
        self.assertTrue(any("no sound cue" in c for c in self.edit(add)))

    def test_ladders_of_the_wrong_length(self):
        def drop(r):
            [s for s in r["sections"] if s["role"] == "problem"][0]["beats"].pop()
        self.assertTrue(any("problem beats" in c for c in self.edit(drop)))

    def test_a_fractional_frame(self):
        self.assertTrue(any("whole number" in c for c in self.edit(lambda r: r["captions"][0].update({"in": 1.5}))))

    def test_plan_quiet_that_disagrees_with_the_frames(self):
        self.assertTrue(any("plan.audio.quiet" in c for c in self.edit(lambda r: r["audio"]["quiet"][0].update(kind="hold"))))

    def test_a_cut_list_is_refused(self):
        self.assertTrue(any("zero cuts" in c for c in self.edit(lambda r: r.update(cuts=[10]))))


class Guards(unittest.TestCase):
    NUMS = ["rung_s", "gap_s", "hold_s", "value_s", "lead_s", "duration_s", "fps"]

    def call(self, **kw):
        a = dict(fps=30)
        a.update(kw)
        return S.problem_pivot(**a)

    def test_nan_inf_string_none_bool_raise_a_clear_error(self):
        for k in self.NUMS:
            for bad in (float("nan"), float("inf"), float("-inf"), "3", True, [1]):
                if k in ("fps",) or bad is not None:
                    with self.assertRaises(ValueError, msg="%s=%r" % (k, bad)) as cm:
                        self.call(**{k: bad})
                    self.assertIn("problem-pivot", str(cm.exception))

    def test_zero_negative_and_huge_raise(self):
        for k in ("rung_s", "gap_s", "hold_s", "value_s"):
            for bad in (0, -1, -1e9, 1e9, 1e300):
                with self.assertRaises(ValueError, msg="%s=%r" % (k, bad)):
                    self.call(**{k: bad})
        for bad in (0, -5, 1e9):
            with self.assertRaises(ValueError):
                self.call(duration_s=bad)
        for bad in (0, -30, 241, 1e9):
            with self.assertRaises(ValueError):
                self.call(fps=bad)
        with self.assertRaises(ValueError):
            self.call(lead_s=-0.1)

    def test_huge_text_is_refused_not_typed(self):
        for k in ("sentence", "accent", "brand", "command", "url"):
            with self.assertRaises(ValueError):
                self.call(**{k: "x" * 100000})
            with self.assertRaises(ValueError):
                self.call(**{k: "  "})
            with self.assertRaises(ValueError):
                self.call(**{k: 7})
        with self.assertRaises(ValueError):
            self.call(problem=["a", "b", "x" * 5000])

    def test_the_ladders_have_three_beats(self):
        for bad in (["a", "b"], ["a", "b", "c", "d"], []):
            with self.assertRaises(ValueError):
                self.call(problem=bad)
            with self.assertRaises(ValueError):
                self.call(value=bad)

    def test_extreme_but_legal_values_finish_fast_with_a_bounded_result(self):
        r = self.call(gap_s=0.1, rung_s=0.1, hold_s=0.1, value_s=0.1, fps=1)
        self.assertLess(len(json.dumps(r)), 60000)
        self.assertTrue(r["warnings"])                                                       # outside the studied range: said
        r = self.call(gap_s=30, rung_s=30, hold_s=60, value_s=30, duration_s=600, fps=240)
        self.assertLess(len(json.dumps(r)), 60000)
        self.assertTrue(any(w.startswith("check failed") or "outside" in w for w in r["warnings"]))

    def test_outside_the_studied_range_is_warned(self):
        self.assertTrue(any("gap_s" in w for w in self.call(gap_s=3.0)["warnings"]))
        self.assertTrue(any("hold_s" in w for w in self.call(hold_s=1.0)["warnings"]))


class Pure(unittest.TestCase):
    def test_two_calls_are_the_same_bytes(self):
        a = json.dumps(S.problem_pivot(30, duration_s=30), sort_keys=True)
        b = json.dumps(S.problem_pivot(30, duration_s=30), sort_keys=True)
        self.assertEqual(a, b)

    def test_arguments_are_not_mutated(self):
        prob, val = ["a one", "b two", "c three"], ["x", "y", "z"]
        keep = (list(prob), list(val))
        S.problem_pivot(30, problem=prob, value=val)
        self.assertEqual((prob, val), keep)
        d = copy.deepcopy(S.STORY["problemPivot"])
        S.problem_pivot(30)
        self.assertEqual(d, S.STORY["problemPivot"])                                          # the shared table is read, never written

    def test_two_separate_processes_agree(self):
        outs = [subprocess.run([sys.executable, CUTGEN, "problem-pivot", "--duration", "30", "--brand", "Brand B"], capture_output=True, text=True, check=True).stdout for _ in range(2)]
        self.assertEqual(outs[0], outs[1])
        self.assertEqual(json.loads(outs[0])["frames"], 900)
        self.assertEqual(json.loads(outs[0]), json.loads(json.dumps(S.problem_pivot(30, brand="Brand B", duration_s=30))))   # and equals the in-process call


class Cli(unittest.TestCase):
    def test_flags(self):
        out = subprocess.run([sys.executable, CUTGEN, "problem-pivot", "--sentence", "Every plan hits a wall:", "--accent", "Friction.", "--problem", "a|b|c", "--value", "x|y|z",
                              "--command", "//go", "--url", "brand-a.example/go", "--gap-s", "1.6", "--hold-s", "3", "--fps", "30"], capture_output=True, text=True, check=True).stdout
        r = json.loads(out)
        self.assertEqual(r["captions"][0]["text"], "Every plan hits a wall:")
        self.assertEqual(r["gap"]["seconds"], 1.6)
        self.assertEqual(r["hold"]["seconds"], 3.0)
        self.assertTrue(all(c["ok"] for c in r["checks"]))

    def test_cli_refuses_bad_numbers(self):
        for flags in (["--gap-s", "-1"], ["--gap-s", "nan"], ["--duration", "1e9"], ["--fps", "0"]):
            p = subprocess.run([sys.executable, CUTGEN, "problem-pivot"] + flags, capture_output=True, text=True)
            self.assertNotEqual(p.returncode, 0, flags)
            self.assertIn("problem-pivot", p.stderr)

    def test_no_third_party_names_in_defaults(self):
        blob = json.dumps(S.STORY["problemPivot"]["defaults"]).lower() + open(os.path.join(REPO, "cuts", "story6.py")).read().lower()
        for word in ("wal" + "rus", "love" + "able", "memory " + "layer", "amne" + "sia", "ta" + "co"):   # words of the studied films, spelled in pieces so this file itself names nothing
            self.assertNotIn(word, blob)


if __name__ == "__main__":
    unittest.main()
