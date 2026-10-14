"""motion-pack / cuts / test_cutgen.py: python3 -m unittest test_cutgen (run from cuts/)."""
import json, os, subprocess, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cutgen


class T(unittest.TestCase):
    def test_integer_bpm_is_exact(self):
        r = cutgen.beat_cuts(120, 30, "every_beat", 8)
        self.assertEqual(r["max_abs_err_ms"], 0)
        self.assertEqual([c["frame"] for c in r["cuts"][:4]], [0, 15, 30, 45])
        self.assertEqual(len(r["cuts"]), 32)

    def test_128_rounds_within_half_frame_and_snap_is_exact(self):
        r = cutgen.beat_cuts(128, 30, "every_beat", 16)
        self.assertLessEqual(r["max_abs_err_ms"], 1000 / 30 / 2 + 0.001)
        s = cutgen.beat_cuts(128, 30, "every_beat", 16, snap=True)
        self.assertEqual(s["max_abs_err_ms"], 0)
        self.assertAlmostEqual(s["bpm_used"], 128.571429, places=5)

    def test_frames_never_drift(self):            # cumulative rounding never exceeds half a frame, even far out
        r = cutgen.beat_cuts(140, 24, "every_beat", 400)
        self.assertLessEqual(r["max_abs_err_ms"], 1000 / 24 / 2 + 0.001)

    def test_patterns(self):
        self.assertEqual(cutgen.beat_positions("tresillo_332", 1), [0, 1.5, 3])
        self.assertEqual(cutgen.beat_positions("backbeat", 2), [1, 3, 5, 7])
        self.assertEqual(len(cutgen.beat_positions("eighths", 1)), 8)
        for k in cutgen.PATTERNS["beat"]:
            self.assertTrue(cutgen.beat_positions(k, 4), k)

    def test_section_hero_on_downbeat(self):
        r = cutgen.section_cuts(120, 30, "build_accelerate")
        self.assertEqual(r["hero"]["beat"], 24)
        self.assertEqual(r["hero"]["frame"], 360)
        self.assertEqual([s["cuts"] for s in r["segments"]], [2, 4, 4, 8])

    def test_tx_window_on_beat(self):
        if not os.path.exists(cutgen.CATALOG_PATH):
            self.skipTest("catalog.json not built")
        r = cutgen.beat_cuts(120, 30, "every_bar", 4, tx="whip")
        for c in r["cuts"]:
            w = c["tx"]
            self.assertEqual(w["cut"], c["frame"])
            self.assertEqual(w["end"] - w["start"], w["frames"])
            self.assertTrue(w["start"] <= w["cut"] <= w["end"])
        self.assertEqual(r["warnings"], [])
        dense = cutgen.beat_cuts(150, 30, "eighths", 1, tx="ink")
        self.assertTrue(dense["warnings"])

    def test_split(self):
        j = cutgen.split("J", 120, 30)
        self.assertEqual(j["audio_cut_frame"], 108)
        self.assertEqual(j["audio_cut_sample"], int(round((4.0 - 0.4) * 48000)))
        l = cutgen.split("L", 120, 30)
        self.assertEqual(l["audio_cut_frame"], 138)
        b = cutgen.split("broll_lead", 120, 30)
        self.assertEqual(b["picture_cut_frame"], 116)

    def test_talking(self):
        r = cutgen.talking([0, 60, 120, 200, 330], 30, end_frame=400, claims=[30, 90, 250])
        s = r["segments"]
        self.assertEqual([x["scale"] for x in s], [1.0, 1.15, 1.0, 1.25, 1.0])
        self.assertIn("punch_in", s[0])
        self.assertIn("punch_in_skipped", s[1])          # 2 s after the first: inside the 4 s gap
        self.assertIn("punch_in", s[3])
        self.assertNotIn("slow_push", s[3])               # has a punch-in instead
        long = cutgen.talking([0, 200], 30, end_frame=400)["segments"]
        self.assertIn("slow_push", long[0])               # 6.7 s static shot gets a slow push

    def test_smash_and_interrupts(self):
        m = cutgen.smash(120, 30)
        self.assertEqual(m["impact"]["anchor_frame"], 121)
        self.assertEqual(m["silence_start_sample"], int(round(3.8 * 48000)))
        a, b = cutgen.interrupts(30, 30, 7), cutgen.interrupts(30, 30, 7)
        self.assertEqual(a, b)
        ev = a["events"]
        self.assertTrue(all(y["time_s"] - x["time_s"] >= 0.6 for x, y in zip(ev, ev[1:])))
        maj = [e["time_s"] for e in ev if e["level"] == 3]
        self.assertTrue(all(y - x >= 6.0 for x, y in zip(maj, maj[1:])))

    # ---- story shapes + onset snapping (2026-10-14)
    def test_story_patterns_present(self):
        for k in ("interruptOpen", "verbLadder", "mockumentaryReaction", "sentenceLed"):
            self.assertIn(k, cutgen.PATTERNS["story"])
        self.assertEqual(cutgen.PATTERNS["onset_snap"]["tolerance_frames"], 2)

    def test_interrupt_open(self):
        r = cutgen.interrupt_open(30)
        setup, freeze, new = r["shots"]
        self.assertEqual((setup["start"], setup["end"]), (0, 90))
        self.assertEqual(freeze["start"], 90)
        self.assertEqual(freeze["end"], 99)                     # 300 ms freeze = 9 frames
        self.assertEqual(new["start"], freeze["end"])
        self.assertEqual(r["sfx"][0]["anchor_frame"], 91)       # stop sound on the stop frame + 1
        self.assertEqual(r["warnings"], [])
        self.assertTrue(cutgen.interrupt_open(30, setup_s=12)["warnings"])

    def test_verb_ladder_one_beat_each(self):
        r = cutgen.verb_ladder(["Build it all.", "Expand.", "Automate.", "Multiply."], 120, 30)
        self.assertEqual([s["start"] for s in r["shots"]], [0, 15, 30, 45])
        self.assertEqual(r["shots"][-1]["end"], 75)              # the last verb holds 2 beats
        self.assertEqual([c["sfx"] for c in r["sfx"]], ["sfx/ui/tick"] * 3 + ["sfx/hit/punch"])
        fast = cutgen.verb_ladder(["a", "b"], 240, 30)            # 250 ms beat < 300 ms readable: one verb every 2 beats
        self.assertEqual(fast["beats_per_verb"], 2)
        self.assertTrue(fast["warnings"])

    def test_mockumentary_reactions(self):
        r = cutgen.mockumentary([(0, 75), (90, 160), (200, 260)], 30)
        roles = [s["role"] for s in r["shots"]]
        self.assertEqual(roles, ["interview", "reaction", "interview", "reaction", "interview"])
        for s in r["shots"]:
            if s["role"] == "reaction":
                self.assertTrue(9 <= s["end"] - s["start"] <= 15, s)   # 0.3-0.5 s at 30 fps
        for x, y in zip(r["shots"], r["shots"][1:]):
            self.assertEqual(x["end"], y["start"])                # contiguous picture
        last = r["shots"][-1]
        self.assertTrue(last["payoff"])
        self.assertEqual(last["end"], 260 + 36)                   # 1.2 s deadpan hold
        self.assertEqual(r["sfx"][0]["visual_frame"], last["end"])
        self.assertEqual(r["silence"], {"start": 191, "end": 200, "note": r["silence"]["note"]})
        self.assertEqual(r["warnings"], [])

    def test_sentence_led(self):
        r = cutgen.sentence_led("Your clients dream big".split(), 120, 30)
        self.assertEqual(r["word_every_beats"], 1.0)              # half beats at 120 BPM = 4 words/s > 3.5: doubled
        self.assertEqual([w["frame"] for w in r["words"]], [0, 15, 30, 45])
        self.assertEqual(r["result"]["beat"] % 4, 0)              # result on a downbeat
        self.assertGreaterEqual(r["result"]["start"], r["full_sentence"]["hold_until_frame"])
        slow = cutgen.sentence_led(["a", "b", "c"], 90, 30)
        self.assertEqual(slow["word_every_beats"], 0.5)           # 3 words/s at 90 BPM half beats: allowed
        self.assertTrue(cutgen.sentence_led("one two three four five six seven eight".split(), 100, 30)["warnings"])

    def test_snap_cuts_to_onsets(self):
        r = cutgen.snap_cuts_to_onsets([0, 44, 91, 140], [0.0, 1.5, 3.1, 5.5], 30)
        self.assertEqual(r["frames_out"], [0, 45, 93, 140])
        self.assertEqual(r["moved"], 2)
        self.assertEqual(r["share_snapped"], 0.75)
        self.assertTrue(r["meets_target"])
        far = cutgen.snap_cuts_to_onsets([10, 50], [1.0], 30)       # 3 frames away: outside +-2
        self.assertEqual(far["frames_out"], [10, 50])
        self.assertEqual(far["share_snapped"], 0.0)
        clash = cutgen.snap_cuts_to_onsets([30, 32], [1.0], 30)     # both want frame 30: the second is refused
        self.assertEqual(clash["frames_out"], [30, 32])
        self.assertIn("refused", clash["cuts"][1])
        self.assertEqual(cutgen.snap_cuts_to_onsets([10], [], 30)["frames_out"], [10])

    def test_snap_cli_reads_a_study(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "study.json")
            json.dump({"audio": {"onsets": [0.5, 1.0], "beats": [0.5]}}, open(p, "w"))
            out = subprocess.run([sys.executable, cutgen.__file__, "snap", "--cuts", "16,29", "--fps", "30", "--study", p], capture_output=True, text=True, check=True).stdout
            self.assertEqual(json.loads(out)["frames_out"], [15, 30])

    def test_cli(self):
        out = subprocess.run([sys.executable, cutgen.__file__, "beats", "--bpm", "100", "--fps", "30", "--pattern", "every_2", "--bars", "2"], capture_output=True, text=True, check=True).stdout
        self.assertEqual([c["frame"] for c in json.loads(out)["cuts"]], [0, 36, 72, 108])


if __name__ == "__main__":
    unittest.main()
