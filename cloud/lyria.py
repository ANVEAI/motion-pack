#!/usr/bin/env python3
"""motion-pack / cloud / lyria.py : generate an instrumental music bed with Google Lyria (Vertex AI, model lyria-002).

usage:  MP_GCP_PROJECT=<project> python3 cloud/lyria.py "warm minimal electronic bed, 124 BPM, ..." --out out/bed.wav
        [--negative "vocals, distortion"] [--seed 7] [--takes 3] [--dry-run]
writes  <out>.wav (48 kHz stereo, about 32.8 s per take) + <out>.json sidecar (prompt, seed, model, ai_generated: true, measured BPM)

Facts measured 14 Oct 2026 (re-check, models change):
  * one take = 32.768 s, 48 kHz stereo WAV in predictions[i].bytesBase64Encoded; about US$0.06 per take
  * raw output is quiet with full-scale peaks (about -24 LUFS-I, 0 dBFS). NEVER use it raw: give it to music/mixer.py as the bed
  * the prompt steers genre and tempo well, mood less reliably ("confident launch" came back "playful"). Judge every take
    with cloud/gemini_mood.py or by ear before using it, and generate 2-3 seeds
  * instrumental only; lyrics/vocals are not the model's job here. Put the AI-music disclosure in the post copy"""
import argparse
import base64
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gcp  # noqa: E402

MODEL = "lyria-002"
USD_PER_TAKE = 0.06


def endpoint():
    return ("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict"
            % (_gcp.location(), _gcp.project(), _gcp.location(), MODEL))


def request_body(prompt, negative="", seed=None, takes=1):
    inst = {"prompt": prompt}
    if negative:
        inst["negative_prompt"] = negative
    if seed is not None:
        inst["seed"] = int(seed)
    params = {}
    if takes > 1:
        if seed is not None:
            raise ValueError("Lyria accepts either a seed or sample_count > 1, not both; loop over seeds instead")
        params["sample_count"] = int(takes)
    return {"instances": [inst], "parameters": params}


def generate(prompt, out, negative="", seed=None, takes=1):
    body = json.dumps(request_body(prompt, negative, seed, takes)).encode()
    req = urllib.request.Request(endpoint(), data=body, method="POST",
                                 headers={"Authorization": "Bearer " + _gcp.access_token(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    preds = d.get("predictions") or []
    if not preds:
        raise RuntimeError("Lyria returned no audio: " + json.dumps(d)[:400])
    base, _ = os.path.splitext(out)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    paths = []
    for i, p in enumerate(preds):
        raw = base + (".raw%d.wav" % i)
        open(raw, "wb").write(base64.b64decode(p.get("bytesBase64Encoded") or p["audioContent"]))
        dst = out if len(preds) == 1 else "%s.take%d.wav" % (base, i + 1)
        _gcp.to_wav48(raw, dst, channels=2)
        os.remove(raw)
        side = {"model": MODEL, "prompt": prompt, "negative_prompt": negative, "seed": seed, "take": i + 1,
                "ai_generated": True, "disclosure": "AI-generated music (Google Lyria)", "est_usd": USD_PER_TAKE}
        json.dump(side, open(os.path.splitext(dst)[0] + ".json", "w"), indent=2)
        paths.append(dst)
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("prompt")
    ap.add_argument("--out", required=True)
    ap.add_argument("--negative", default="vocals, singing, distortion, harsh noise")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--takes", type=int, default=1)
    ap.add_argument("--dry-run", action="store_true", help="print the request and cost, call nothing")
    a = ap.parse_args()
    n = a.takes
    print("Lyria: %d take(s), about US$%.2f" % (n, n * USD_PER_TAKE), file=sys.stderr)
    if a.dry_run:
        print(json.dumps(request_body(a.prompt, a.negative, a.seed, a.takes), indent=2))
        return
    for p in generate(a.prompt, a.out, a.negative, a.seed, a.takes):
        print(p)


if __name__ == "__main__":
    main()
