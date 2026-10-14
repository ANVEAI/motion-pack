"""cuts/test_story45.py: the round-4/5 story shapes (story45.py) on synthetic word timings: every shape, determinism, no cut inside a word,
timing bounds, CLI. Run: python3 -m pytest -q cuts/test_story45.py"""
import json, math, os, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story45 as S  # noqa: E402
import cutgen  # noqa: E402

CUTGEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cutgen.py")


def say(text, t0=0.0, word=0.22, space=0.04, gap=0.4):
    """synthetic words.json: fixed word length, small spaces, a pause after every sentence"""
    out, t = [], t0
    for sent in [x.strip() for x in text.split("|") if x.strip()]:
        ws = sent.split()
        for k, w in enumerate(ws):
            out.append({"w": w, "s": round(t, 4), "e": round(t + word, 4)})
            t += word + (space if k + 1 < len(ws) else gap)
    return out


def inside(t, words):
    return [w for w in words if w["s"] + 1e-9 < t < w["e"] - 1e-9]


WALK = say("First the input card arrives. | Four agents each read one kind of data. | Every step has forks and only one is right. "
           "| A fifth agent makes the decision. | One wrong fork turns the line red. | The red runs down to a wrong decision.")


class Walkthrough(unittest.TestCase):
    def test_steps_in_gaps(self):
        r = S.walkthrough(WALK, 30)
        self.assertEqual(len(r["steps"]), 6)                                    # one per sentence
        for st in r["steps"][1:]:
            a, b = st["gap"]
            self.assertTrue(a < st["frame"] / 30.0 <= b)                        # inside the speech gap
            self.assertEqual(st["frame"], math.ceil(a * 30 - 1e-9) + 2)         # gap start + 2 frames
            self.assertFalse(inside(st["frame"] / 30.0, WALK))
        for c in r["camera"]:
            self.assertFalse(any(inside(f / 30.0, WALK) for f in range(c["start"], c["end"])))   # the re-frame never runs under a word
        self.assertEqual(r["captions"][1]["text"], "Four agents each read one kind of data.")
        hold = (r["end_card"]["end"] - r["end_card"]["start"]) / 30.0
        self.assertTrue(3.0 <= hold <= 8.0)
        self.assertLessEqual(min(p["gain_db"] for p in r["bed_automation"]), -20)

    def test_steps_n_and_long_sentence_warning(self):
        r = S.walkthrough(WALK, 30, steps=3)
        self.assertEqual(len(r["steps"]), 3)
        long = say("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix. | Short.")
        self.assertTrue(any("split it" in w for w in S.walkthrough(long, 30)["warnings"]))
        tight = [{"w": "One.", "s": 0, "e": 0.5}, {"w": "Two.", "s": 0.6, "e": 1.0}]
        self.assertTrue(any("no room" in w for w in S.walkthrough(tight, 30)["warnings"]))

    def test_deterministic(self):
        self.assertEqual(json.dumps(S.walkthrough(WALK, 30, steps=4)), json.dumps(S.walkthrough(WALK, 30, steps=4)))


class QueryLadder(unittest.TestCase):
    def test_sums_and_order(self):
        r = S.query_ladder(40, 30, rungs=["code:5", "video:1", "pdf:3", "podcast:2", "lang:4"])
        secs = r["sections"]
        self.assertEqual(secs[0]["start"], 0)
        self.assertEqual(secs[-1]["end"], 1200)                                 # sums to the duration
        for x, y in zip(secs, secs[1:]):
            self.assertEqual(x["end"], y["start"])
        self.assertEqual([x["difficulty"] for x in r["rungs"]], [1, 2, 3, 4, 5])  # hardest last
        self.assertTrue(any("re-ordered" in w for w in r["warnings"]))
        for g in r["rungs"]:
            self.assertLessEqual(g["type"][1] - g["type"][0], 36)               # typing <= 1.2 s
            self.assertEqual(g["resolve"][1] - g["resolve"][0], 12)             # 0.4 s blur resolve

    def test_downbeats(self):
        r = S.query_ladder(37.5, 30, rungs=5, bpm=120)                          # 30 s of rungs: 6 s = 3 bars each
        for g in r["rungs"]:
            self.assertLessEqual(abs(g["downbeat_delta_frames"]), 2)
            self.assertTrue(4.0 <= (g["end"] - g["start"]) / 30.0 <= 7.0)
        self.assertEqual(r["sections"][-1]["end"], 1125)
        r = S.query_ladder(48, 30, rungs=5, bpm=120)                            # 8.1 s rungs: still on downbeats, but warned as too long
        self.assertTrue(all(abs(g["downbeat_delta_frames"]) <= 2 for g in r["rungs"]))
        self.assertTrue(any("holds" in w for w in r["warnings"]))

    def test_vo_led(self):
        W = say("a dog barking on the beach. | where they talk about sleep. | the clause about pets in the lease. | a zebra in another language. | code that retries with backoff.",
                t0=0.5, word=0.3, gap=4.0)
        r = S.query_ladder(40, 30, rungs=5, words=W)
        for s in r["sections"]:
            self.assertFalse(inside(s["start"] / 30.0, W))
        self.assertEqual(r["rungs"][2]["vo_line"], "the clause about pets in the lease.")
        r2 = S.query_ladder(40, 30, rungs=5, words=W, bpm=120)
        self.assertEqual(json.dumps(r2), json.dumps(S.query_ladder(40, 30, rungs=5, words=W, bpm=120)))
        for s in r2["sections"]:
            self.assertFalse(inside(s["start"] / 30.0, W))


class FidelityLadder(unittest.TestCase):
    def test_grid_dropout_reveal(self):
        r = S.fidelity_ladder(100, 30, params=[3, 10, 36, 1024])               # 100 BPM at 30 fps: 18 frames a beat, 72 a bar
        self.assertEqual([s["start"] for s in r["steps"]], [0, 72, 144, 216])
        self.assertEqual(r["max_abs_err_ms"], 0.0)
        drop = next(s for s in r["sections"] if s["role"] == "dropout")
        self.assertEqual(drop["start"], 288)
        self.assertGreaterEqual(drop["seconds"], 3.0)
        self.assertEqual(drop["end"] % 72, 0)                                   # the reveal lands on a bar line
        self.assertLessEqual(min(p["gain_db"] for p in r["bed_automation"]), -20)
        self.assertTrue(any("climb" in w for w in S.fidelity_ladder(100, 30, params=[10, 3, 36])["warnings"]))

    def test_off_grid_bpm(self):
        r = S.fidelity_ladder(99, 30, steps=4)
        bar = 4 * 60.0 / 99
        for st in r["steps"]:
            self.assertEqual(st["start"], cutgen.frame_of(st["bar"] * bar, 30))  # within half a frame of the bar line
            self.assertLessEqual(abs(st["err_ms"]), 1000 / 60.0 + 1e-6)


CLIPS = {"clips": [
    {"id": "a", "src": None, "words": say("so the thing we kept noticing was how often people repeated themselves to it.")},
    {"id": "b", "src": None, "words": say("and honestly I did not expect it to remember the small things.")},
    {"id": "c", "src": None, "words": say("we would test it every single night after dinner for weeks.")},
    {"id": "d", "src": None, "words": say("what surprised me most was the patience it had with me.")},
    {"id": "e", "src": None, "words": say("it felt less like software and more like a colleague.")},
    {"id": "lead", "lead": True, "name": "Lead Speaker", "role": "Placeholder role", "tag": "placeholder tag", "src": None,
     "words": say("We built this to remember what matters to you. | It runs where you are.", t0=0.3)},
]}


class VoicesColdOpen(unittest.TestCase):
    def test_open(self):
        r = S.voices_open(CLIPS, 30)
        self.assertLessEqual(r["open_s"], 6.0)
        self.assertTrue(4 <= r["faces"] <= 6)
        words = {c["id"]: c["words"] for c in CLIPS["clips"]}
        for au in r["audio"]:
            self.assertFalse(inside(au["src_in"], words[au["clip"]]))           # audio edit points between words
            self.assertFalse(inside(au["src_out"], words[au["clip"]]))
            if not au.get("lead"):
                self.assertTrue(0.4 <= (au["end"] - au["start"]) / 30.0 <= 1.45)
                first = words[au["clip"]][0]["s"]
                self.assertGreater(au["src_in"], first)                          # mid-sentence: never the first word
        for x, y in zip(r["audio"], r["audio"][1:]):
            self.assertEqual(x["end"], y["start"])                               # the voices run end to end
        for sh, au in zip(r["shots"][1:], r["audio"][1:]):
            self.assertEqual(sh["start"] - au["start"], sh["j_lead_frames"])     # J: audio leads the picture
            self.assertGreater(sh["j_lead_frames"], 0)
        self.assertEqual(r["shots"][-1]["role"], "lead")
        self.assertTrue(4.0 <= r["supers"][0]["at"] / 30.0 <= 7.0 or r["warnings"])
        self.assertEqual(json.dumps(r), json.dumps(S.voices_open(CLIPS, 30)))

    def test_cap_and_files(self):
        r = S.voices_open(CLIPS, 30, max_open_s=2.5)
        self.assertLessEqual(r["open_s"], 2.5)
        self.assertTrue(any("left out" in w for w in r["warnings"]))
        with tempfile.TemporaryDirectory() as td:
            json.dump(CLIPS["clips"][0]["words"], open(os.path.join(td, "a.words.json"), "w"))
            cl = {"clips": [dict(CLIPS["clips"][0], words="a.words.json")] + CLIPS["clips"][1:]}
            p = os.path.join(td, "clips.json")
            json.dump(cl, open(p, "w"))
            out = subprocess.run([sys.executable, CUTGEN, "voices-open", "--clips", p], capture_output=True, text=True, check=True).stdout
            self.assertEqual(json.loads(out)["audio"], S.voices_open(CLIPS, 30)["audio"])


CMDS = say("Move it left. | Now right. | Dark mode. | Bigger. | Make it blue. | Variations. | Undo that. | Center it. | Add a shadow. | Ship it.",
           t0=2.0, word=0.24, space=0.03, gap=0.42)


class CommandBurst(unittest.TestCase):
    def test_response_frames(self):
        r = S.command_burst(CMDS, 30)
        self.assertEqual(r["commands"], 10)
        ends = [s["end"] for s in S.sentences(CMDS)]
        for row, e in zip(r["responses"], ends):
            self.assertEqual(row["response_frame"], math.floor(e * 30 + 1e-9) + 1)   # the frame after the last word ends
            self.assertGreater(row["response_frame"] / 30.0, e)
            self.assertFalse(inside(row["response_frame"] / 30.0, CMDS))
        self.assertEqual(r["warnings"], [])

    def test_warnings_and_beats(self):
        slow = say("Please move the whole thing a little bit further to the left side. | Thanks.")
        self.assertTrue(any("shorten" in w for w in S.command_burst(slow, 30)["warnings"]))
        setup = say("Okay. | So. | Watch.", word=0.3, gap=0.6) + say("Move it left. | Now right.", t0=4.0)
        r = S.command_burst(setup, 30, burst_start=4.0)
        self.assertEqual(r["commands"], 2)
        self.assertGreaterEqual(len(r["silent_beats"]), 2)
        crowded = [{"w": "Left.", "s": 0.0, "e": 0.3}, {"w": "Right.", "s": 0.31, "e": 0.6}]
        self.assertTrue(any("merge" in w for w in S.command_burst(crowded, 30)["warnings"]))


ANA = say("This runs here, | here, | and here. | It even runs here on a phone.")


class Anaphora(unittest.TestCase):
    def test_token(self):
        r = S.anaphora(ANA, 30, token="here")
        starts = [w["s"] for w in ANA if w["w"].lower().strip(",.") == "here"]
        self.assertEqual(r["repeats"], 4)
        for c, s in zip(r["cuts"], starts):
            self.assertLessEqual(c["frame"] / 30.0, s + 1e-9)
            self.assertFalse(inside(c["frame"] / 30.0, ANA))
        self.assertEqual(r["cuts"][1]["frame"], round(starts[1] * 30) - 1)    # token start - 1 frame (in the pause)
        for x, y in zip(r["shots"], r["shots"][1:]):
            self.assertEqual(x["end"], y["start"])

    def test_phrase_auto_and_tight(self):
        W = say("You are paying the rent, | the fees, | the markup, | and the wait.")
        r = S.anaphora(W, 30, phrase="the")
        self.assertEqual([c["slot"] for c in r["cuts"]], ["rent,", "fees,", "markup,", "wait."])
        self.assertEqual(S.anaphora(ANA, 30)["token"], "here")                  # auto: the most repeated non-stop word
        tight = say("here here here", word=0.2, space=0.0)                     # words touch on a frame line: the cut moves onto that line
        for c in S.anaphora(tight, 30, token="here")["cuts"]:
            self.assertFalse(inside(c["frame"] / 30.0, tight))
        jam = say("here here here", word=0.22, space=0.0)                      # touch between frames: no clean frame, so it warns
        self.assertTrue(any("no whole frame" in w for w in S.anaphora(jam, 30, token="here")["warnings"]))
        with self.assertRaises(ValueError):
            S.anaphora(say("no repeats at all."), 30, token="here")


class Trailer(unittest.TestCase):
    def test_proportions_scale(self):
        for dur in (40, 60, 80):
            r = S.trailer(dur, 30)
            n = dur * 30
            got = {s["role"]: (s["end"] - s["start"]) / float(n) for s in r["sections"]}
            for k, v in S.STORY["trailerArc"]["shares"].items():
                self.assertAlmostEqual(got[k], v, delta=1.5 / n)
            self.assertEqual(r["sections"][-1]["end"], n)
            self.assertLessEqual(r["question_duck_db"], -30)                     # the question sits >= 30 dB under the body
        r = S.trailer(120, 30)
        q = next(s for s in r["sections"] if s["role"] == "question")
        self.assertEqual(q["end"] - q["start"], 120)                             # clamped to 4 s
        self.assertTrue(r["warnings"])

    def test_dialogue_and_wall(self):
        lines = [{"text": "Line one.", "dur": 3}, {"text": "Line two.", "dur": 3}, {"text": "Line three.", "dur": 3}]
        r = S.trailer(60, 30, dialogue=lines, bpm=120)
        d = r["sections"][0]["lines"]
        self.assertEqual([x.get("dip_to_black") for x in d if "dip_to_black" in x], [[90, 100], [190, 200]])
        wall = r["sections"][2]
        cuts = wall["cuts"]
        self.assertTrue(all(b - a == 30 for a, b in zip(cuts, cuts[1:])))       # 2 beats at 120 BPM = 1 cut per second
        self.assertEqual(len(r["sections"][1]["cards"]), 2)


class StyleLadder(unittest.TestCase):
    def test_swaps_on_grid(self):
        r = S.style_ladder(["live", "look.bw-neutral", "look.pastel", "look.duotone"], 120, 30)
        self.assertEqual([x["frame"] for x in r["swaps"]], [0, 15, 30, 45])
        self.assertEqual(r["swaps"][-1]["until"], 75)                           # the last look holds 2 beats
        self.assertEqual([c["visual_frame"] for c in r["sfx"]], [15, 30, 45])
        self.assertEqual(r["warnings"], [])
        fast = S.style_ladder(["a", "b", "c"], 180, 30)                           # 0.33 s a beat: doubled to 0.67 s
        self.assertEqual(fast["beats_per_style"], 2)
        self.assertTrue(any("unknown look" in w for w in S.style_ladder(["look.nope"], 120, 30)["warnings"]))


class Cli(unittest.TestCase):
    def test_all_subcommands(self):
        with tempfile.TemporaryDirectory() as td:
            wp = os.path.join(td, "w.json")
            json.dump({"words": WALK}, open(wp, "w"))
            cp = os.path.join(td, "c.json")
            json.dump(CMDS, open(cp, "w"))
            ap = os.path.join(td, "a.json")
            json.dump(ANA, open(ap, "w"))
            runs = [["walkthrough", "--words", wp], ["query-ladder", "--dur", "40", "--rungs", "5", "--bpm", "120"],
                    ["fidelity-ladder", "--bpm", "99", "--params", "3,10,36,1024"], ["command-burst", "--words", cp],
                    ["anaphora", "--words", ap, "--token", "here"], ["trailer", "--dur", "60"], ["style-ladder", "--looks", "live,look.pastel", "--bpm", "120"]]
            for r in runs:
                out = subprocess.run([sys.executable, CUTGEN] + r, capture_output=True, text=True, check=True).stdout
                self.assertIn("pattern", json.loads(out))


class MixerAutomation(unittest.TestCase):
    """the dropout / question automation measured on a rendered bed (music/mixer.py bed automation)"""
    def test_bed_automation_depth(self):
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "music"))
            import numpy as np
            import mixer
        except Exception as e:                                                   # pragma: no cover
            self.skipTest("music mixer not importable: %s" % e)
        r = S.fidelity_ladder(100, 30, steps=4)
        m = mixer.Mix(30, r["frames"] / 30.0, lib=object())
        n = m.n
        t = np.arange(n) / 48000.0
        m.add_bed(np.stack([0.3 * np.sin(2 * np.pi * 220 * t)] * 2, 1), loop=False)
        m.automate_bed(r["bed_automation"])
        y = m.bed[:, 0] * m.bed_gain()
        d = next(s for s in r["sections"] if s["role"] == "dropout")
        rms = lambda a, b: float(np.sqrt(np.mean(y[int(a * 1600):int(b * 1600)] ** 2)))
        body = rms(r["steps"][1]["start"], r["steps"][2]["start"])
        dip = rms(d["start"] + 3, d["end"] - 6)
        self.assertGreaterEqual(20 * np.log10(body / dip), 20.0)                # >= 20 dB under the body
        tr = S.trailer(60, 30)
        m2 = mixer.Mix(30, 60, lib=object())
        m2.automate_bed(tr["bed_automation"])
        g = 20 * np.log10(m2.bed_gain())
        q = next(s for s in tr["sections"] if s["role"] == "question")
        w = next(s for s in tr["sections"] if s["role"] == "wall")
        self.assertGreaterEqual(np.median(g[w["start"] * 1600:w["end"] * 1600]) - np.max(g[q["start"] * 1600 + 1:q["end"] * 1600 - 1]), 30.0)


if __name__ == "__main__":
    unittest.main()
