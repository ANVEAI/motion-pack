#!/usr/bin/env python3
"""motion-pack / cloud / gemini_mood.py : a cloud "mood ear". Gemini 2.5 Flash listens to a track and judges mood and fit.

usage:  MP_GCP_PROJECT=<project> python3 cloud/gemini_mood.py bed.wav [--brief "confident launch film, calm not hype"] [--json out.json] [--dry-run]
        prints the estimated cost to stderr BEFORE any call; --dry-run prints the request (model, prompt, brief, clip length) and calls nothing,
        needing no project and no credentials
prints  JSON: mood_words, energy 0-10, valence 0-10, genre, fits {launch film, comedy, calm explainer, hype}, brief_fit 0-10,
        problems, plus the clip duration measured locally

Use it for WHAT the music feels like. Do NOT trust its timestamps or BPM: on a 32.8 s clip it reported a fade-out at 0:50.
Timing, tempo, onsets and loudness come from local DSP (cuts/cutgen.py beats, tools/refstudy.py, music/qa.py).
Cost: a 30 s clip is about 900 input tokens (a fraction of a US cent; the tool prints an upper bound of US$0.01 per 30 s). The audio is sent to Google; never send unreleased
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


USD_PER_30S_MAX = 0.01   # an UPPER BOUND from the README's "a fraction of a cent per 30 s" (14 Oct 2026)


def estimate_usd(seconds):
    """upper bound in US$ for one judgement of a clip of `seconds`: USD_PER_30S_MAX per started 30 s"""
    return round(max(1, -(-float(seconds) // 30)) * USD_PER_30S_MAX, 2)


def request_preview(path, brief="", seconds=None):
    """what judge() would send (no network, no credentials, no audio bytes)"""
    return {"model": MODEL, "prompt": PROMPT + ("\nBrief: " + brief if brief else ""), "audio": {"file": path, "mime_type": "audio/mp3", "mono_16khz_48kbps": True, "duration_s": seconds},
            "temperature": 0, "response_mime_type": "application/json"}


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
    mw = out.get("mood_words")
    if isinstance(mw, str):  # the model sometimes returns "Techy, Clean, Positive" instead of a list
        out["mood_words"] = [w.strip() for w in mw.split(",") if w.strip()]
    out["duration_s"] = duration(path)
    out["model"] = MODEL
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("audio")
    ap.add_argument("--brief", default="")
    ap.add_argument("--json")
    ap.add_argument("--dry-run", action="store_true", help="print the request and the cost, call nothing")
    a = ap.parse_args(argv)
    try:
        secs = duration(a.audio)
    except (OSError, ValueError):
        secs = None   # no ffprobe or an unreadable file: the estimate assumes one 30 s unit
    print("Gemini mood judge: 1 clip%s, at most about US$%.2f (prices change; check Google's pricing page)"
          % ("" if secs is None else " of %.1f s" % secs, estimate_usd(secs or 0)), file=sys.stderr)
    if a.dry_run:
        print(json.dumps(request_preview(a.audio, a.brief, secs), indent=2))
        return
    out = judge(a.audio, a.brief)
    s = json.dumps(out, indent=2)
    print(s)
    if a.json:
        open(a.json, "w").write(s)


if __name__ == "__main__":
    main()
