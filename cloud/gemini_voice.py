#!/usr/bin/env python3
"""motion-pack / cloud / gemini_voice.py : voiceover lines with Gemini 2.5 Live native audio (Vertex AI).

usage:  MP_GCP_PROJECT=<project> python3 cloud/gemini_voice.py lines.json --out out/vo [--voice Charon] [--verify] [--dry-run]
        python3 cloud/gemini_voice.py --line "Your office's intelligence, kept in your office." --out out/vo
prints  the estimated cost to stderr BEFORE any call; --dry-run prints each request (model, voice, system instruction, text) and calls nothing
        (it needs no project and no credentials)
lines.json:  [{"id": "l1", "text": "...", "voice": "Charon", "style": "calm, confident"}]
writes  out/vo/<id>.wav (48 kHz dual-mono stereo s16, what music/mixer.py expects) + out/vo/lines.out.json (id, text, file, duration_s, verified transcript)

Facts measured 14 Oct 2026 (re-check, models change):
  * the Vertex model id that works is gemini-live-2.5-flash-native-audio. gemini-live-2.5-flash, gemini-live-2.5-flash-preview
    and gemini-2.0-flash-live-preview-04-09 return 1008 "publisher model not found" on Vertex
  * output is 24 kHz mono s16 PCM; this tool resamples to 48 kHz for music/mixer.py ("vo": {"file": ...})
  * Live is a conversational model: the system instruction makes it read the line verbatim, but ALWAYS verify (--verify runs
    Whisper and fails on any word difference). A 9-word line came back word for word
  * prebuilt voices include Charon (calm, low), Kore (firm), Puck (bright), Aoede, Fenrir, Leda, Orus, Zephyr
  * a synthetic voice is AI content: disclose it in the post copy, never present it as a real person"""
import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gcp  # noqa: E402

MODEL = os.environ.get("MP_GEMINI_LIVE_MODEL", "gemini-live-2.5-flash-native-audio")
USD_PER_LINE_MAX = 0.01   # an UPPER BOUND from the README's measured "under a cent per line" (14 Oct 2026); billed by audio tokens, so prices and length change it
SYSTEM = ("You are a voiceover artist. Read the user's line exactly, word for word, in the requested style. "
          "Do not add, drop or change any word. Say nothing else.")


async def _speak(client, text, voice, style):
    from google.genai import types
    cfg = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))),
        system_instruction=SYSTEM + (" Style: " + style if style else ""))
    pcm = bytearray()
    async with client.aio.live.connect(model=MODEL, config=cfg) as s:
        await s.send_client_content(turns=types.Content(role="user", parts=[types.Part(text=text)]), turn_complete=True)
        async for m in s.receive():
            if m.data:
                pcm += m.data
            if m.server_content and m.server_content.turn_complete:
                break
    return bytes(pcm)


def estimate_usd(lines):
    """upper bound in US$ for these lines: USD_PER_LINE_MAX each (the README's measured "under a cent"); re-check Google's pricing for a large batch"""
    return round(len(lines) * USD_PER_LINE_MAX, 2)


def request_preview(lines, default_voice="Charon"):
    """what render() would send, one entry per line (no network, no credentials)"""
    return [{"id": ln["id"], "model": MODEL, "voice": ln.get("voice", default_voice), "response_modalities": ["AUDIO"],
             "system_instruction": SYSTEM + (" Style: " + ln["style"] if ln.get("style") else ""), "text": ln["text"]} for ln in lines]


def norm_words(s):
    return re.sub(r"[^a-z0-9' ]+", " ", s.lower().replace("’", "'")).split()


def whisper_text(path):
    exe = os.environ.get("MP_WHISPER") or shutil.which("whisper")
    if not exe:
        return None
    with tempfile.TemporaryDirectory() as td:
        subprocess.run([exe, path, "--model", "base", "--language", "en", "--output_format", "txt", "--output_dir", td],
                       capture_output=True)
        f = os.path.join(td, os.path.splitext(os.path.basename(path))[0] + ".txt")
        return open(f).read().strip() if os.path.exists(f) else None


def render(lines, out_dir, default_voice="Charon", verify=False):
    client = _gcp.genai_client()
    os.makedirs(out_dir, exist_ok=True)
    results, bad = [], []
    for ln in lines:
        pcm = asyncio.run(_speak(client, ln["text"], ln.get("voice", default_voice), ln.get("style", "")))
        if not pcm:
            raise RuntimeError("no audio for line " + ln["id"])
        raw = os.path.join(out_dir, ln["id"] + ".24k.wav")
        with wave.open(raw, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        dst = os.path.join(out_dir, ln["id"] + ".wav")
        _gcp.to_wav48(raw, dst, channels=2)  # dual-mono: music/mixer.py takes stereo voice
        os.remove(raw)
        row = {"id": ln["id"], "text": ln["text"], "voice": ln.get("voice", default_voice), "file": dst,
               "duration_s": round(len(pcm) / 48000.0, 3), "model": MODEL, "ai_generated": True}
        if verify:
            heard = whisper_text(dst)
            row["heard"] = heard
            row["verbatim"] = None if heard is None else norm_words(heard) == norm_words(ln["text"])
            if row["verbatim"] is False:
                bad.append(ln["id"])
        results.append(row)
        print("%s  %.2fs  %s" % (ln["id"], row["duration_s"], "" if not verify else ("OK" if row.get("verbatim") else "CHECK: %r" % row.get("heard"))))
    json.dump(results, open(os.path.join(out_dir, "lines.out.json"), "w"), indent=2)
    return results, bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("lines", nargs="?")
    ap.add_argument("--line", help="a single line instead of a lines.json")
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="Charon")
    ap.add_argument("--verify", action="store_true", help="Whisper-check every line; exit 2 on any word difference")
    ap.add_argument("--dry-run", action="store_true", help="print the requests and the cost, call nothing")
    a = ap.parse_args(argv)
    if a.line:
        lines = [{"id": "line1", "text": a.line}]
    elif a.lines:
        lines = json.load(open(a.lines))
    else:
        ap.error("give lines.json or --line")
    print("Gemini Live voice: %d line(s), at most about US$%.2f (prices change; check Google's pricing page)" % (len(lines), estimate_usd(lines)), file=sys.stderr)
    if a.dry_run:
        print(json.dumps(request_preview(lines, a.voice), indent=2))
        return
    _, bad = render(lines, a.out, a.voice, a.verify)
    if bad:
        print("not verbatim: " + ", ".join(bad) + " (re-run those lines)", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
