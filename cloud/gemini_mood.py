#!/usr/bin/env python3
"""motion-pack / cloud / gemini_mood.py : a cloud "mood ear". Gemini 2.5 Flash listens to a track and judges mood and fit.

usage:  MP_GCP_PROJECT=<project> python3 cloud/gemini_mood.py bed.wav [--brief "confident launch film, calm not hype"] [--json out.json]
prints  JSON: mood_words, energy 0-10, valence 0-10, genre, fits {launch film, comedy, calm explainer, hype}, brief_fit 0-10,
        problems, plus the clip duration measured locally

Use it for WHAT the music feels like. Do NOT trust its timestamps or BPM: on a 32.8 s clip it reported a fade-out at 0:50.
Timing, tempo, onsets and loudness come from local DSP (cuts/cutgen.py beats, tools/refstudy.py, music/qa.py).
Cost: a 30 s clip is about 900 input tokens (a fraction of a US cent). The audio is sent to Google; never send unreleased
client audio without permission."""
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gcp  # noqa: E402

MODEL = os.environ.get("MP_GEMINI_MOOD_MODEL", "gemini-2.5-flash")
PROMPT = ("You are a music supervisor for short films. Listen and return JSON only, with keys: mood_words (3 words), "
          "energy (0-10), valence (0-10), genre, fits (object: 'launch film','comedy','calm explainer','hype' each 'yes' or 'no'), "
          "brief_fit (0-10, how well it fits the brief; null if no brief), problems (string). Do not give timestamps or BPM.")


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return round(float(r.stdout.strip() or 0), 3)


def judge(path, brief=""):
    from google.genai import types
    with tempfile.TemporaryDirectory() as td:
        mp3 = os.path.join(td, "a.mp3")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3], check=True)
        data = open(mp3, "rb").read()
    q = PROMPT + ("\nBrief: " + brief if brief else "")
    client = _gcp.genai_client()  # keep a reference: a temporary client is closed before the request is sent
    r = client.models.generate_content(
        model=MODEL, contents=[types.Part.from_bytes(data=data, mime_type="audio/mp3"), q],
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
    out = json.loads(r.text)
    out.pop("structure", None)
    out["duration_s"] = duration(path)
    out["model"] = MODEL
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("audio")
    ap.add_argument("--brief", default="")
    ap.add_argument("--json")
    a = ap.parse_args()
    out = judge(a.audio, a.brief)
    s = json.dumps(out, indent=2)
    print(s)
    if a.json:
        open(a.json, "w").write(s)


if __name__ == "__main__":
    main()
