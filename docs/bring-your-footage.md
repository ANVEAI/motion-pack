# Bring your footage

The human templates (`tutorial`, `vlog-personal`, `podcast-clip`, `founder-story`, `course-lesson`) edit footage that **you** recorded: your face, your screen, your photos, your voice. The pack never makes a person, a voice or a recording up. Until you give a template a file, it draws a labelled placeholder: a silhouette marked SPEAKER PLACEHOLDER, a fictional desktop marked PLACEHOLDER RECORDING, or a card marked YOUR B-ROLL HERE. It also plays a guide signal, which is shaped noise at the word timings and plainly not speech.

This page covers what to record, how to get it edit-ready, and how to hand it to a template.

## 1. What each template wants

| template | footage | words | optional |
|---|---|---|---|
| `tutorial` | `media.screen.src`, your screen recording. Set `media.screen.size` to its pixel size. `media.webcam.src` is your face cam. | `voice.words` | `cursor.track`, a recorded pointer track `[[t, x, y, click?], ...]` in screen fractions. Without it, the template estimates a track from `cursor.clicks`. |
| `vlog-personal` | `media.talk.src`, the talking head (its audio is the voice). `media.broll.<key>.src` are your cutaways. | `voice.words` | `voice.breaths` (section 5) |
| `podcast-clip` | `media.host.src` and `media.guest.src` (two synced angles). `media.mix.src` is the episode audio. | `voice.words` with speaker tags | `clip.from` / `clip.to`, the excerpt in source seconds |
| `founder-story` | `media.talk.src`. `media.photos[i].src` are your photos, at any aspect: the Ken Burns move pans inside them. | `voice.words` | `text.years` with a real `source` each |
| `course-lesson` | `media.presenter.src`. `media.slides[i].src` (images) replace the drawn slides. | `voice.words` | |

Set a value with `node make.mjs --set media.talk.src=/abs/talk.mp4`. Each template prints the render command at the end of its build. Run `--set aspect=9:16` (or `16:9`) for the second aspect: that is its own project folder (`tall/` or `wide/`), with its own layout.

## 2. Formats

- **Container and codec:**
  - MP4 or MOV with H.264 or HEVC video.
  - ProRes works but is large.
  - VP9 / WebM works in the browser renderer.
  - Photos: JPEG, PNG or WebP.
- **Resolution:**
  - 1080p is enough for a 1080p delivery.
  - 4K gives the punch-ins (1.12-1.2x) and the zoom-follow (1.35-1.8x) room without softening.
  - A 9:16 delivery shown from a 16:9 recording is a crop. Frame the face with room to spare.
- **Audio:**
  - 48 kHz WAV or AAC.
  - An external mic (lavalier or USB) beats any camera mic.
  - Record 10 seconds of room tone at the start: it helps you judge the noise floor and the breath detector.
- **Colour:** shoot in a standard (Rec. 709) profile. Log footage goes through a `layers/looks/log.<camera>-to-709.cube` LUT first (frame-design skill).

## 3. Frame rate: variable to constant (VFR to CFR)

Phones and screen recorders usually record **variable frame rate**: frames arrive at uneven times to save space. Editors and renderers that count frames then disagree about which instant "frame N" is, and lip sync drifts over a long clip. The pack's maths (frame-exact cuts, cues on frame F + 1, zoom keys) assumes a **constant** rate.

```bash
python3 tools/human/conform.py probe talk.mp4          # vfr: true/false, the frame-interval spread, rotation, audio rate, A/V start offset, advice
python3 tools/human/conform.py cfr talk.mp4 talk-30.mp4 --fps 30
```

`cfr` puts the video on a constant grid (the `fps` filter duplicates or drops to the nearest frame) and stretches the audio onto the video clock (`aresample=async`). It resamples to 48 kHz and resets start times to 0. Use `talk-30.mp4` from then on. Pick the delivery rate (30 for most social video; 24 or 25 if the whole project is at that rate) and keep it for every clip.

## 4. Audio sync (a separate mic)

```bash
python3 tools/human/conform.py sync camera.mp4 mic.wav                 # offset_s > 0: the mic started late; confidence: how clear the match is
python3 tools/human/conform.py sync camera.mp4 mic.wav --apply mic-synced.wav
```

The tool cross-correlates the onset envelopes of the camera's own sound and the mic. A clap at the start makes the match unambiguous. Under about 5 confidence, check by ear: line up a clap or a hard consonant. Then give the template the synced file as the voice source (for the podcast clip, `media.mix.src`).

## 5. The transcript (words.json)

Every template edits from word timings: `[{ "w": "word", "s": start, "e": end, "speaker"?: "Host" }]`, in seconds of the source clip.

- **From whisper** (word timestamps on): the JSON works as is (`words` or `segments[].words`).
- **From subtitles** you already have:

  ```bash
  node tools/human/human.mjs words talk.srt --out words.json
  ```

  This also takes `.vtt`. VTT inline word times (`<00:01.200>`) are used exactly. Without them, the words of each cue share its time in proportion to their length, and every such word is marked `est: true`. Templates also read an `.srt` or `.vtt` directly in `voice.words`.
- **Speakers:** tags come from VTT `<v Name>`, from an ALL-CAPS `NAME:` at the start of an SRT cue, or from diarisation. The podcast clip uses them for the active speaker and the lower thirds. It never guesses a speaker from a face.
- **Fillers:**

  ```bash
  node tools/human/human.mjs fillers words.json --list tools/human/fillers.txt
  ```

  This lists every "um" (hard filler) and "you know" (soft filler) with its time. **Nothing is cut until you choose:** `fillers.cut: 'hard'` in CONFIG, or `--cut hard`. A soft filler is often meaning ("I like it"), so `hard` never touches soft ones. Edit `fillers.txt` for your own habits.
- **Breaths:**

  ```bash
  python3 tools/human/breaths.py talk.mp4 words.json --out breaths.json
  ```

  Put the file in `voice.breaths`. The autocut then keeps each detected breath (up to 450 ms before the next word) instead of cutting to dead air. Without it, the autocut keeps 120 ms of air before each line.

## 6. Voice: the tone chain

The templates run your recording through `tools/human/voice_chain.py`'s tone chain: a high-pass at 80 Hz, a de-esser, then a 3:1 compressor. `music/mixer.py` then masters the whole mix to -14 LUFS-I with a true peak at or below -1.5 dBTP (the delivered MP4 at or below -1.0). To clean a voice on its own:

```bash
python3 tools/human/voice_chain.py talk.mp4 voice.wav            # tone chain + one gain to -14 LUFS-I + limiter, true peak <= -1.5 dBTP
python3 tools/human/voice_chain.py talk.mp4 voice.wav --no-loudness --hpf 100 --deess 0.5
```

The chain never changes what was said and never alters the voice's identity. Noise reduction (`--denoise`) is off by default: it changes the timbre, so it is your call.

## 7. Green screen

```bash
python3 tools/human/chroma.py sample me-green.mp4                         # the key colour, measured from the frame border
python3 tools/human/chroma.py key me-green.mp4 me-comp.mp4 --bg studio.png  # chromakey + spill suppression over your background (image, video or #hex)
python3 tools/human/chroma.py alpha me-green.mp4 me.mov                   # keyed with alpha (ProRes 4444) for an editor, or a folder -> PNG frames
```

- **Light it:** light the screen evenly and keep the subject a metre or more in front of it (less spill).
- **Tuning:**
  - Raise `--similarity` (default 0.14) for an unevenly lit screen.
  - Raise `--blend` (0.05) for softer hair edges.
  - Raise `--spill` (0.55) when edges stay green.
- **Use the result:** the keyed PNG frames work as the supplied matte that `type/behindSubject` needs (giant type behind you).

## 8. Background blur: none shipped, on purpose

The pack ships **no ML person segmentation**, so there is no "blur my background" button. There is no pinned, tested open model in the pack: a segmentation model would have to be fetched at a pinned version and checksum (as `scripts/fetch-external.sh` does for icons) and then pass the determinism gates. None has been through that yet. Until then:

- shoot with real depth of field (a wide aperture, distance between you and the wall);
- use a green screen and composite over a blurred plate: blur the background file first, for example `ffmpeg -i bg.png -vf gblur=sigma=18 bg-blur.png`, then pass `--bg bg-blur.png`;
- or make the matte in your editor and bring it in as PNG alpha frames.

## 9. Before you render

- [ ] Every clip is constant frame rate (`conform.py probe`: `vfr: false`) at the project rate.
- [ ] The voice and any separate mic are in sync (`conform.py sync`, confidence above 5, or by ear).
- [ ] `words.json` matches what was said (read it once), with speaker tags if there are two people.
- [ ] Fillers reviewed (`human.mjs fillers`), and cut only by choice.
- [ ] `node make.mjs` prints no `warning:` lines you have not read, and lists no placeholder slots you meant to fill.
- [ ] After the render: `templates/_shared/sheet.py` (stills + loudness), then `ears/listen.py` and `eyes/look.py` with `--plan`.
