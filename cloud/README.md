# cloud: optional Google Cloud audio back-ends

Everything else in motion-pack is generated locally and costs nothing. This folder is the exception: three small tools that
call Google Cloud models **on your own project, billed to you**. Nothing in the pack depends on them.

| tool | model (Vertex AI) | makes | cost (measured 14 Oct 2026) |
|---|---|---|---|
| `lyria.py` | `lyria-002` | an instrumental music bed, 32.8 s, 48 kHz stereo WAV + JSON sidecar | about US$0.06 per take |
| `gemini_voice.py` | `gemini-live-2.5-flash-native-audio` | voiceover lines, 48 kHz dual-mono WAV, optional Whisper word-for-word check | under a cent per line |
| `gemini_mood.py` | `gemini-2.5-flash` | a JSON judgement of a track: mood words, energy, valence, genre, fit to a brief | a fraction of a cent per 30 s |

Prices and model ids change. Check Google's pricing page before a large batch; the tools print an estimate first.

## Setup

```bash
pip install -r requirements-cloud.txt            # google-genai (+ google-auth)
gcloud auth login                                # or: gcloud auth application-default login
export MP_GCP_PROJECT=<your-project-id>          # Vertex AI API enabled, billing on
export MP_GCP_LOCATION=us-central1               # optional, this is the default
```

Never commit a project id, key or token. The tools read the environment only; `cloud/tests` fails if a project id appears in the code.
Check that Vertex AI is on without spending anything: a `countTokens` call returns 200, or 403 `SERVICE_DISABLED` when the API is off.

## The pipeline

```bash
python3 cloud/lyria.py "confident cinematic electronic launch bed, 120 BPM, deep warm pulse bass, rising pads, instrumental" \
        --seed 11 --out out/bed.wav
python3 cloud/gemini_mood.py out/bed.wav --brief "confident product launch film, assured not playful"   # keep takes with brief_fit >= 7
python3 cloud/gemini_voice.py lines.json --out out/vo --voice Charon --verify                           # exit 2 if any word differs
python3 music/mixer.py cues.json --out out/mix      # "bed": {"file": "out/bed.wav"}, "vo": {"file": "out/vo/l1.wav", "start_frame": 45}
```

Measured end to end (14 Oct 2026): one Lyria take + one voice line + one hit, mixed for 12 s, gave −14.1 LUFS-I and −1.5 dBTP,
with the stems summing exactly. The mood judge rated the bed "confident, driving", launch film yes, brief fit 9/10.

## Rules that came from testing

- **Never use Lyria output raw.** It comes back at about −24 LUFS with peaks at 0 dBFS. It goes into `music/mixer.py` as the bed, which
  normalises, ducks under the voice and masters to −14 / −1.5.
- **Describe the music, not the feeling.** "Confident launch" alone came back playful (comedy yes, launch no). Naming the parts
  (pulse bass, four-on-the-floor kick, rising pads, BPM) came back confident (launch yes, brief fit 9/10). Generate 2–3 seeds and judge them.
- **Lyria takes either a seed or `--takes N`, not both.** Loop over seeds for reproducible variants.
- **Verify every voice line.** Live is a conversational model. A strict system instruction keeps it to the script, and `--verify`
  checks with Whisper. Re-run any line that fails rather than editing around it.
- **The mood judge is for feel, not timing.** It invented a fade-out at 0:50 on a 32.8 s clip. Take BPM, onsets and loudness from local DSP
  (`cuts/cutgen.py beats`, `music/qa.py`). `gemini_mood.py` asks for no timestamps and drops any it gets.
- **Hold a reference to the genai client.** A temporary `genai.Client(...)` can be closed before the request is sent
  ("Cannot send a request, as the client has been closed").
- **Only some Live model ids exist on Vertex.** `gemini-live-2.5-flash`, `gemini-live-2.5-flash-preview` and
  `gemini-2.0-flash-live-preview-04-09` returned 1008 "publisher model not found". Override with `MP_GEMINI_LIVE_MODEL` when Google renames it.

## Honesty

AI music and synthetic voices are AI content. Say so in the post copy, turn on Instagram's AI label and TikTok's AI-generated setting.
Never present a generated voice as a real person or clone a real person's voice without written consent. Audio sent to the mood judge
goes to Google: do not send unreleased client material without permission.
