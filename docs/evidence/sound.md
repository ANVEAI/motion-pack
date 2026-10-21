# motion-pack / research / sound

Scope: SFX taxonomy and synthesis recipes, mixing rules, platform loudness, music (beds, stingers,
tempo-to-cut maps, procedural composition). Everything below is owned synthesis (numpy/scipy, optional numba; ffmpeg for
verification only). No samples, no downloads, no TTS, no speech.

How to read this: every recommendation names the component to build (`snd.*` id), its parameters and its default values.
Defaults are starting points derived from standard DSP practice and from what already works in our v9 film pipeline. They have
NOT been auditioned in this session. The builder must (1) render, (2) measure with the checks in section 9, (3) listen once, and
(4) adjust defaults in the component and in this file. Where a number comes from a source, the source is in section 12 with an
evidence grade. Where a number is my own starting value, it says "start".

---

## 0. What already exists (reuse, do not duplicate)

| Existing asset | What it gives us | How motion-pack uses it |
|---|---|---|
| v9 launch-film `sfx9.py` (217 lines) | `rng(seed)`, `noise`, TPT state-variable filter `svf(x, fc, q, kind)` (per-sample cutoff, numba), `env_ad`, `pitch_fn`, `tone(pitch, partials, attack, decay, length, tail)`, `noise_burst`, `click`, `sparkle`, `bloom`, `low_body`, `pan_st`, `make_ir`, `convolve_st`, constants `SR=48000`, `FPS=30`, `SPF=1600` | Lift into `sound/core/dsp.py` as is (copy the code, it is ours). All new recipes sit on these primitives. |
| `voices9.py` (191 lines) | named components: click, lock, paper, gulp, tick, thud(+body,+low), pop(+drops), zero_tick, chime(+bloom), slam(+low,+whirr), snap(+crack,+low), glide, whoosh, slide, plug(+fric,+blip), ignite(+tone) | Port to `sound/sfx/` as the first 20 library entries (tagged `source:v9`). Do not rewrite. |
| `mix9.py` (442 lines) | the hit contract (visual frame F, peak on sample (F+1) x 1600), grouping, K-weighted "over bed" solver (3..6 dB, bounded least squares), 5 ms look-ahead true-peak limiter, 4x true-peak, AAC probes, 24-bit write, silent tail | Generalise into `sound/mix/place.py` + `solve.py` + `master.py`. Keep the contract identical. |
| `mix8.phone_voice` | phone-speaker voicing: low shelf -9 dB at 100 Hz, peaks +2.5 dB at 1.7 kHz (Q 0.8) and +1.0 dB at 650 Hz (Q 0.9), mono below 220 Hz, sides x0.72 | `sound/mix/phone.py` = the "phone check" render used in every QA. Also the vertical (9:16) master voicing. |
| a Web Audio score engine (separate skill, not included) | JS twin: voices tone/noise/texture/click/creak/swish/boing/sparkle/whoosh/pad/bass/shaker, wrap-around OfflineAudioContext (seamless loops), linear stems | Use only when a project needs a seamless audio loop rendered in-browser. Otherwise Python is the source of truth (deterministic, no GPU or browser dependence). |
| a BS.1770 meter script (separate skill, not included) | BS.1770 K-weighting (48 kHz coefficients), gated LUFS-I, 4x true peak, per-hit timing and level over bed, `--tune` solver | Import its K-weight/LUFS/TP functions into `sound/mix/measure.py`. One implementation of the meter in the whole pack. |
| `hyperframes-audio` skill | `data-fx-chain` (gain, EQ, compressor, limiter, gate, saturate, delay, reverb, chorus, phaser, bitcrush), `data-automation`, `<hf-audio-group>` bus, `scripts/carve.mjs` voiceover carve, constant `data-playback-rate` and a rate lane for speed ramps | Integration mode B (section 10): place one-shots as `<audio>` clips and let HyperFrames do ducking/carve for quick jobs. Mode A (offline single-WAV master) is the default for anything measured. |
| beat-sync editing practice | `frames_per_beat = 60/BPM x fps`, cut on 2/4/8-beat phrases, biggest visual on the drop | Section 8 extends it with a tempo-snapping rule and a cut-map generator. |
| v9 learned rules | HyperFrames render lowers the whole track if AAC overshoots -1 dBTP, so probe AAC, not just the WAV | Section 5 house ceiling -1.5 dBTP, verified on the WAV and on two AAC probes. |

The ffmpeg 8-series build used for this research has `ebur128`, `loudnorm`, `alimiter`, `sidechaincompress`, `sidechaingate`, `aecho`, `asubboost`
(checked with `ffmpeg -filters`). No `sox`. numpy 1.26.4, scipy 1.11.4, numba 0.59.0, soundfile 0.13.1 import fine.

---

## 1. Architecture of the sound pack

```
sound/
  core/    dsp.py        primitives (osc, noise colours, svf, biquad, envelopes, FM, modal, KS, grains, formants, IR, resample)
           grid.py       fps/SR math: frame<->sample, tempo_snap, bar/beat grids
           io.py         24-bit WAV/FLAC write, stereo helpers, equal-power pan, Haas
  sfx/     whoosh.py impacts.py risers.py ui.py foley.py liquid.py cartoon.py voices.py ambience.py stingers.py transitions.py gags.py
  music/   drums.py harmony.py compose.py presets.py logo.py
  mix/     place.py (cue sheet -> stems)  solve.py (over-bed solver)  duck.py  master.py  measure.py  phone.py
  library/ (generated, gitignored) one-shots rendered from recipes + manifest.json (tags, measured stats)
  cues/    cue-sheet JSON schema + examples
  demo/    demo_sfx_reel.py (20 s reel proving every family), demo_mix.py (bed + VO stand-in + cues -> -14 LUFS master)
```

Component contract (all sound components):

- Pure function `render(params: dict, seed: int) -> np.ndarray[float32, (n, 2)]` at 48000 Hz. Same params + seed gives the same
  bytes (test: render twice, compare SHA-256 of the float32 buffer).
- `anchor` attribute (sample index of the designated peak/impact inside the buffer) and `kind in {tonal, noise, scatter}`, so the
  placer can align exactly as the v9 contract requires (tonal crest anchor error 0 samples; noise peaks 2 ms earlier in a mixed
  group; scatter never timed).
- Library entry = recipe id + param preset + seed + tags + measured stats (peak, TP, LUFS-M max, LUFS-S, centroid, crest, duration,
  anchor). Stored in `library/manifest.json`. The one-shot WAVs are regenerable and are not committed.
- Library level convention: normalise each one-shot to -6.0 dBFS sample peak (headroom for layering), record true peak. Actual
  level in a film is set by the over-bed solver or the default gain table (section 3), never by the library level.
- Variation: `variant(seed_offset)` gives round-robin takes (section 3 rule 9).
- Format: 48 kHz, stereo, float32 in memory, 24-bit WAV on disk; FLAC for the cache to save disk (soundfile writes FLAC).
- Sample-rate/fps: 48 kHz is fixed. The fps is a project parameter (24/30/60); `grid.frame_to_sample(f, fps) = round(f * 48000 / fps)`.
  v9 used 30 fps (1600 samples/frame). 60 fps gives 800 samples/frame.

Why Python offline, not Web Audio: determinism, measurability, no browser/GPU, the over-bed solver already lives in Python, and
HyperFrames just plays a WAV. The compositions stay seek-safe because audio is a finished file, not a live graph.

---

## 2. Primitive toolbox (build first, `sound/core/dsp.py`)

| Component | Signature (defaults) | Notes |
|---|---|---|
| `snd.core.noise` | `noise(n, seed, colour='white')`; colours: white, pink (Voss-McCartney 16 rows, or FFT 1/f shaping), brown (cumulative sum, leaky 0.999, normalised) | pink via FFT shaping: `X(f) *= 1/sqrt(f)` over full-length rfft; circular, so loops are seamless |
| `snd.core.svf` | existing (TPT, per-sample `fc`, `q`, modes lp/bp/hp) | add `notch` and `peak`; add 2-pole cascade helper `svf2` for 24 dB/oct |
| `snd.core.biquad` | RBJ cookbook: lowpass, highpass, bandpass, peaking, low/high shelf, allpass | for static EQ, mix8 has one; port it |
| `snd.core.env` | `ad(a, tau)`, `adsr(a, d, s, r)`, `exp_decay(tau)`, `bell(rise, fall, power)`, `sin2_attack(a)`, `curve(points, kind='exp')` | all envelopes functions of time arrays, so no state |
| `snd.core.osc` | `sine`, `tri`, `saw_polyblep`, `square_polyblep`, `pulse(width)`; phase by integration of a frequency array (so glides/vibrato are exact) | band-limited via PolyBLEP; for aliasing-free saws above 2 kHz use 2x oversample + `resample_poly` |
| `snd.core.fm` | 2-operator: `y = sin(2*pi*fc*t + I(t)*sin(2*pi*fm*t))`, `I(t)` an envelope; ratio `fm/fc` | Chowning bell/ping/clang family (section 4.5) |
| `snd.core.modal` | `modal(f0, ratios, amps, decays_t60, excitation, length)`: sum of exponentially decaying sines (or 2-pole resonators driven by a short noise burst); per-mode T60 | the engine for glass, metal, wood, bells, bars, drums. Ratios table in 4.5 |
| `snd.core.ks` | Karplus-Strong plucked string / rubber band: delay line length `round(SR/f0)`, loop filter `0.5*(x[n]+x[n-1])*g`, `g` 0.996-0.9995 | pizzicato, boing-string, plucks, harp |
| `snd.core.grain` | `grains(source, rate_fn, dur_ms, jitter, window='hann', pan_spread)`: Poisson (or jittered periodic) grain cloud from a source buffer | paper, crumple, rain, sizzle, glitch stutter |
| `snd.core.formant` | Klatt-style parallel/cascade formant bank: `formant(source, [(F1,B1,A1),(F2,B2,A2),...])` as 2-pole resonators; glottal source `rosenberg(f0_array, open=0.6)` | character voices (section 4.9) |
| `snd.core.ir` | `make_ir(seconds, decay, predelay, seed)` (existing) + `room_ir(kind)` presets: `tiny` 0.12 s, `room` 0.45 s, `hall` 1.4 s, `plate` 1.8 s bright, `cavern` 4.0 s | exponentially decaying noise with HF damping rising over time (one-pole whose cutoff falls 12 kHz to 1.5 kHz across the tail); energy-normalised so stems stay linear |
| `snd.core.sat` | `soft_clip(x, drive)` tanh, `fold(x, k)`, `bitcrush(x, bits, rate_div)` | NOT used on anchored hit voices (the v9 rule: a waveshaper moves the crest). Allowed on risers, glitch, bass, ambience. Oversample 4x when `drive > 3`. |
| `snd.core.pan` | equal-power `pan_st(m, p)` (existing), `haas(x, ms=0.4..12)`, `widen(x, amount)` (mid/side) | movement panning for whooshes: pan(t) follows object x position |
| `snd.core.pitch` | `glide(f_start, f_end, t, shape='exp')`, `vibrato(rate, depth_cents)`, `semitones(st)` | exponential glides are the natural default (equal ratio per time) |

Acceptance for every primitive: finite output, no DC (mean < 1e-4), deterministic, unit test with a known spectrum (e.g. 1 kHz sine
filtered by LP at 1 kHz is -3 dB +- 0.3).

---

## 3. Mixing rules (the house rules, binding for every cue sheet)

Numbered, because the cue-sheet linter (`sound/mix/lint.py`) should enforce them.

1. **One frame after the picture.** A cue whose visual lands on frame F puts its designated peak on sample (F + 1) x SR/fps (33.3 ms
   later at 30 fps, 16.7 ms at 60 fps). This is the v9 contract and it stays. Rationale: audio-early is detected more readily than
   audio-late (ITU-R BT.1359-1 detectability window is about audio early 45 ms to audio late 125 ms; EBU R37 allows about +40 / -60
   ms at transmitter feeds; ATSC is tighter, 15 ms early / 45 ms late), so one frame late (33 ms) sits inside every window while
   one frame early would not. For talking-head speech lip-sync keep the picture/voice file as recorded; the offset rule is for
   sound effects. Note: BT.1359 evidence is thin (newsreader clips); the one-frame rule is also what measures best by ear in v9.
2. **Over-bed levels (K-weighted, 60 ms from the anchor, hits stem vs bed stem; our measured method).**
   | Cue class | Over bed (dB) | Limiter GR budget |
   |---|---|---|
   | hero impact / hit / logo hit | +4 to +6 (default +4.5) | <= 1.5 dB |
   | transition whoosh (peak window 60 ms) | +1 to +3 (default +2) | <= 1.5 dB |
   | UI blip / pop / click | +3 to +5 | <= 1.0 dB |
   | micro-foley (key ticks, paper, cloth) | +2 to +4 | <= 1.0 dB |
   | riser (last 200 ms before the hit) | +3 to +5 | <= 1.5 dB |
   | stinger / sonic logo | +4 to +6 | <= 1.5 dB |
   | ambience / room tone | -12 to -8 relative to the bed's own K-level (it is a floor, not an event) | n/a |
   If the bed is already loud in the window (v9 learned this), do not push the hit; swap its voicing to a sustained bright partial
   (2.2-5.3 kHz) instead of a decaying low knock. A sustained bright partial buys about 9 dB more K-weighted energy per unit of peak.
3. **Three layers, three bands.** Every non-trivial cue = transient (0-10 ms, 2-8 kHz click/noise), body (10-250 ms, 120-2000 Hz
   tonal or modal), tail (250 ms+, air 4 kHz+ and/or reverb send). Hero impacts add a sub layer (40-90 Hz sine, mono). Nothing
   below 30 Hz (high-pass all layers except sub at 30 Hz, 12 dB/oct). Sub is mono; everything under 120 Hz is summed to mono.
4. **Hierarchy limits.** Tier 1 (hero): at most one per 8-10 s and never within 90 frames at 30 fps of another tier 1. Tier 2
   (transition/section): at most one per 1.5-2 s on average. Tier 3 (micro): any rate, but each one -6 dB under tier 2 and never on
   the same frame as a tier 2 unless it is that tier 2's own layer. A film where everything hits hits nothing.
5. **Ducking (bed under voice).** Deterministic envelope, not a compressor: `gain_db(t) = -depth * smooth(env_vo(t))`; depth 9 dB
   (range 6-12), look-ahead 80 ms (the duck starts before the first syllable), attack 15 ms, hold 120 ms, release 350 ms (range
   250-500). Plus a "carve" on the bed during speech: peaking -3 dB at 250 Hz (Q 0.9) and -3.5 dB at 3 kHz (Q 1.0). In HyperFrames
   mode B the same job is `scripts/carve.mjs` + `data-automation`. ffmpeg quick alternative:
   `sidechaincompress=threshold=0.05:ratio=8:attack=15:release=350:makeup=1`.
6. **Pre-hit vacuum.** Before a tier 1 hit, dip the bed 2-4 dB for 100 ms (3 frames) ending exactly on the hit frame, and end any
   riser 1 frame (33 ms) before the anchor with a hard 5 ms fade-out. The brain reads the gap as "the hit is bigger". Add a
   reverse-reverb swell (200-400 ms) ending at the same instant for cinematic films.
7. **Tune the library to the bed.** Tonal cues (blips, rings, logo, bells, risers' tonal layer) use the project key. Default key:
   A major (A, C#, E, F#, B), already used by the v9 rings. `project.key` and `project.scale` are inputs to every tonal
   recipe, so a mixed bed + hits never clashes. Non-tonal cues (noise whooshes) get their spectral centre set to a chord tone
   (BP centre at the projected pitch of the bed's root x 2^k) when the bed is tonal and sparse.
8. **Stereo and space.** Whooshes pan with the object (`pan = clamp((x_px - W/2) / (W/2), -0.85, 0.85)`, equal power, sampled at
   10 ms); static UI is centred or 10-20% off; ambience wide (decorrelated L/R noise). Hit reverb send default 0.16 (v9 value),
   UI send 0.06, ambience send 0. Room IR chosen by the scene: `tiny` for UI, `room` for product, `hall` for cinematic.
9. **Round-robin, never the same take.** Each repeated cue id gets `seed = base_seed + index`, pitch +-3% (+-50 cents), gain +-1.5
   dB, timing +-0 (timing is sacred, only variation is in the sound). Same id twice within 8 events uses different seeds. This kills
   the machine-gun effect in typing, footsteps, ticks.
10. **First 300 ms.** A short-form video (Reels/TikTok/Shorts/X/LinkedIn) must have an audible event on frames 0-3 (a hit, a whoosh
    already in motion, or voice). No lead-in silence, no fade-in from zero (a 5 ms de-click only). Silent autoplay is common, so the
    picture and captions must carry meaning with the sound off; sound is the second reward.
11. **Endings.** Hero films end on a ring-out plus true digital silence for the last 0.15 s (v9 rule). Loops (social loops) end with
    a tail that wraps into the first 300 ms (use a wrap-around render or `circular_mix`).
12. **Phone check is part of the mix.** Render `mix_phone.wav` through `phone_voice` and verify every tier 1 and tier 2 cue still
    reads (K over bed >= +2 dB after the voicing) before the mix is final. 9:16 masters use the phone voicing directly (v9 did this).
13. **Deliver stems.** Always export `master.wav`, plus `vo.wav`, `music.wav`, `sfx.wav` (all at the master gain, summing exactly
    to the master pre-limiter), and `sfx_only` + `vo` (no music) for re-scoring. Reason: platform "trending audio" and creators'
    remix flows need a music-free version, and we avoid re-mixing for each platform.

---

## 4. SFX taxonomy and synthesis recipes

Conventions: `f` Hz, `t` seconds. "BP(fc, Q)" = state-variable band-pass, unity peak. "LP/HP" 12 dB/oct unless stated. Envelopes are
`AD(a, tau)` = sin^2 attack of `a` seconds then exponential decay with time-constant `tau` unless stated. Durations are the
default; every recipe takes `size` (0..1) or `length` to scale it. `seed` always an input. Library id pattern: `snd.<family>.<name>`.

### 4.1 Whoosh / swish by size (`sfx/whoosh.py`)

One generic recipe `snd.whoosh.make(size, direction, pan_path, seed)` plus named presets.

Core recipe (white or pink noise `n`):
1. Source: pink noise for `size >= 0.3`, white for smaller (small swishes are brighter).
2. Band-pass sweep: `fc(t) = f_lo * (f_hi/f_lo)^(u(t))`, exponential in `u`, `u` going 0 to 1 over the length; Q = 0.9 (large) to 1.6 (small). Two parallel BPs an octave apart (fc and 2.1 fc, second at -6 dB) widen it.
3. Amplitude: skewed bell `bell(rise, fall, power)`. `direction='in'` (object arrives): peak at 70% of length, rise power 2.0 then abrupt fall power 4 (a "swoosh into frame"). `'out'` (leaves): peak at 30%. `'pass'` (flyby/whip pan): peak at 50%, symmetrical power 2.5, fc glides DOWN in the second half for a Doppler feel: multiply `u(t)` by an extra -0.25 octave over the last 35%.
4. Air layer: HP 6 kHz noise, bell envelope delayed by 8% of length, at -12 dB (size 0.5), -9 dB (size 0.15).
5. Body layer (only `size >= 0.45`): LP 250 Hz pink noise, bell peaking at 55% of length, at -10 dB; sub sine 55 Hz at -18 dB for `size >= 0.8`.
6. Pan: `pan_path(t)`; default `'pass'` goes -0.7 to +0.7, `'in'` goes -0.5 to 0.
7. Fade-out to zero over the last 12 ms; the first 2 ms linear de-click.
Size mapping (continuous, `s` in 0..1): `dur = 0.12 * 13^s` s (0.12 s to 1.56 s); `f_lo = 700 * 0.35^s` Hz; `f_hi = 7500 * 0.55^s` Hz; sub/body weights from step 5.

| Preset id | size | length | direction | start fc to end fc (start) | Use |
|---|---|---|---|---|---|
| `snd.whoosh.swish_xs` | 0.00 | 120 ms | pass | 2.6k to 7.5k | UI swipe, caption slide, hand wave |
| `snd.whoosh.swish_s` | 0.18 | 200 ms | in/out | 1.9k to 6k | element enters/exits, cut with motion |
| `snd.whoosh.whoosh_m` | 0.45 | 450 ms | in/pass | 800 to 4k | whip pan, standard transition |
| `snd.whoosh.whoosh_l` | 0.72 | 800 ms | in/out | 450 to 3k, body layer | scene change, logo reveal in |
| `snd.whoosh.whoosh_xl` | 1.00 | 1.5 s | in | 260 to 2.3k, body + sub | title card swell, hero transition |
| `snd.whoosh.flyby` | 0.6 | 1.1 s | pass+Doppler | 3k to 900 | car, drone, character zoom past |
| `snd.whoosh.zip` | 0.1 | 90 ms | in | 1.5k to 9k, Q 2 | zoom punch-in "zip", speed lines |
| `snd.whoosh.reverse` | 0.5 | 600 ms | in | render a `hit` tail then time-reverse | pre-hit swell |

Alignment: a whoosh's anchor = its loudest sample; in a transition place the anchor at the **midpoint of the motion blur** (the
frame of maximum on-screen velocity), plus the one-frame rule. A whip pan's visual cut is at the blur midpoint; whoosh peak there.

### 4.2 Impacts, hits, booms (`sfx/impacts.py`)

Tonal crest (cosine-phase from the v9 contract) for the knock, noise for the crack, sub for weight. Reuse v9 `thud`, `slam`, `snap`.

| id | Recipe (defaults) | Dur |
|---|---|---|
| `snd.hit.sub_drop` | sine 62 Hz -> 36 Hz exponential glide over 0.28 s; amp `AD(2 ms, 0.38)`; plus click `noise_burst` BP 2.5k Q 1.2, 3 ms | 1.2 s |
| `snd.hit.punch` | sine 140 -> 70 Hz, glide tau 18 ms; `AD(1 ms, 0.07)`; click BP 3k; no tail. Zoom punch-in, jump-cut emphasis | 150 ms |
| `snd.hit.thud` | v9 `thud` (+body +low). Soft object, cabinet, button press weight | 350 ms |
| `snd.hit.slam` | v9 `slam` metal clack = modal bar (ratios 1, 2.756, 5.404; T60 0.35/0.2/0.1 s; f0 420 Hz) + noise crack + 80 Hz body | 600 ms |
| `snd.hit.cinema` | layers: sub_drop (-0 dB) + noise burst through LP sweeping 7 kHz -> 250 Hz over 0.45 s (`AD(2 ms, 0.30)`, -3 dB) + metal modal ring (f0 = key root x 4, ratios 1, 2.76, 5.40, 8.93, T60 1.8 s, -14 dB) + reverse-reverb pre-swell 0.3 s (-10 dB, ends at anchor) + `hall` IR send 0.25 | 2.5 s |
| `snd.hit.boom_meme` | sine 118 -> 34 Hz over 0.5 s with 4x-oversampled tanh drive 2.5 (allowed: unanchored); noise 2 ms; mid layer saw 90 Hz LP 1.2k tau 0.2 s. The meme "boom" for comedic punch-ins | 1.4 s |
| `snd.hit.stab` | brand stab: 3 sawtooth voices (detune +-9 cents) on key triad (A3, C#4, E4), LP envelope 4.5 kHz -> 700 Hz tau 0.12 s, `AD(2 ms, 0.5)` | 900 ms |
| `snd.hit.glass_crack` | see 4.5 glass; transient noise BP 5k Q 2 bursts at 0, 7, 19 ms | 700 ms |
| `snd.hit.rock` | brown noise, LP 350 Hz, `AD(1 ms, 0.12)` + modal low block (f0 90 Hz, ratios 1, 1.9, 3.1) | 500 ms |

Size scaling for any hit: `f_sub = 36 * 1.8^(1-size)` end frequency; tau = 0.15 + 0.45*size; click level -6 dB (hard) to -18 dB
(soft). Hero-hit rule: crest owned by exactly one partial (single cosine crest) so the limiter does not smear it (v9).

### 4.3 Risers and downlifters (`sfx/risers.py`)

Riser length should equal a musical unit: `length = bars x bar` (1, 2 or 4 bars) so it ends on a downbeat (section 8). Silent gap
before the anchor: ends at anchor - 1 frame, 5 ms fade.

| id | Recipe (defaults) |
|---|---|
| `snd.riser.noise` | white noise, BP sweep `fc` 220 Hz -> 9 kHz exponential, Q 1.2 rising to 5.0 as `Q(u) = 1.2 + 3.8u^2`; amp `a(u) = u^2.5` (-30 dB to 0 dB); stereo width grows 0.2 -> 1.0; last 40 ms: LP-free (no filter, full band burst at +2 dB) |
| `snd.riser.supersaw` | 7 saws, detune spread +-14 cents rising to +-30 cents, pitch glide up a perfect 5th to an octave over the length (exp), LP cutoff 500 Hz -> 6 kHz, `a(u)=u^2`; level -6 dB re noise layer. Quantise the final pitch to a key note |
| `snd.riser.shepard` | Shepard-Risset glissando: 9 sines, octave-spaced from 30 Hz up (f_k = 30 * 2^(k + u)), amplitude by a Gaussian over log-frequency centred at 1 kHz with sigma 1.4 octaves; u 0 -> 1 per octave of rise; can run indefinitely (infinite tension, loops) |
| `snd.riser.heartbeat` | sub thumps (`punch`, 60 Hz) at accelerating rate: interval 0.9 s -> 0.18 s (geometric), level -24 dB -> -6 dB; ends on a hit |
| `snd.riser.reverse_cym` | synthesised cymbal (6 square oscillators at the 808 hat ratios 205.3, 304.4, 369.6, 522.7, 540, 800 Hz x 2.5, HP 6 kHz, `AD(1 ms, 0.9)`, plus noise) time-reversed; length 1.2-3 s |
| `snd.riser.tape_up` | the inverse of `tape_stop` (4.10): pitch 0.05 -> 1.0 over 0.5 s exponential, source = held chord |
| `snd.lift.down` (downlifter) | mirror of `riser.noise`: BP 9 kHz -> 180 Hz, amp `a(u) = (1-u)^1.8`, starts exactly on the anchor of the drop, 0.8-1.6 s, -4 dB under the hit; use after a hero hit to carry energy out |
| `snd.lift.inhale` | short riser (200-350 ms): `riser.noise` with fc 500 -> 5k, ends 1 frame before the anchor. The "breath before the word/title" |

### 4.4 Clicks, pops, UI blips, typing (`sfx/ui.py`)

| id | Recipe (defaults) | Dur |
|---|---|---|
| `snd.ui.click` | v9 `click`: BP 3200 Hz burst (2.4 gain, 2.6 ms decay) + 190 Hz thunk (0.55, 20 ms) | 40 ms |
| `snd.ui.tick` | v9 `tick`; or sine 2.2 kHz, `AD(0.5 ms, 4 ms)`, +/-3% pitch jitter | 25 ms |
| `snd.ui.toggle_on` / `toggle_off` | two sine notes 35 ms each, on = key degrees 1 -> 5 (A5, E6), off = 5 -> 1 (descending); `AD(1.5 ms, 14 ms)`; tiny click at note onset | 90 ms |
| `snd.ui.blip` | tri or sine at `pitch` (default A5 880 Hz), `AD(2 ms, 24 ms)`, 2nd partial at x2 -14 dB | 80 ms |
| `snd.ui.success` | arpeggio A5, C#6, E6 (60 ms spacing), sine + 3rd partial, `AD(2 ms, 40 ms)`, ends with `bloom` sparkle at -18 dB; send 0.1 | 450 ms |
| `snd.ui.error` | two buzzes, 190 Hz square-ish (pulse 0.3) LP 900, 80 ms each, 50 ms gap, `AD(2 ms, 60 ms)`, pitch drop -2 semitones on the second | 260 ms |
| `snd.ui.notify` | two-note chime E6 -> B6 (major 5th up), FM bell (4.5), 20 ms apart overlap, T60 0.45 s | 700 ms |
| `snd.ui.pop` | UI pop: sine chirp 380 -> 920 Hz over 28 ms (exp), `AD(1 ms, 18 ms)` + noise click BP 4k 2 ms at -12 dB. Elements appearing, caption word pops | 70 ms |
| `snd.ui.pop_down` | same, chirp reversed (920 -> 380 Hz): element disappears | 70 ms |
| `snd.ui.slide` | v9 `slide`: BP-noise friction, bell-shaped, fc 1.5k -> 2.4k, 180 ms | 200 ms |
| `snd.ui.swipe_ding` | `swish_xs` + a ding E6 at the end of the swipe | 260 ms |
| `snd.ui.type_key` | one key: noise burst HP 2 kHz 6 ms + modal "thock" (single mode f 180-260 Hz random per key, Q 18 => T60 45 ms) at -6 dB; mechanical-switch variant adds a second click 20 ms later (release), 4 kHz BP, -14 dB. Spacebar: f 120 Hz, T60 80 ms, louder 3 dB. |  60 ms |
| `snd.ui.typing(text, wpm=210, seed)` | sequence generator: inter-key interval log-normal, median `60/(wpm*5)` s (210 wpm -> 57 ms), sigma 0.35, 2.5% chance of a 250 ms thinking pause after a space, key class by character (space, enter, regular); each key through `type_key` with round-robin seeds; output positions are returned as a cue list so each key can be locked to a caption character frame | variable |
| `snd.ui.count_tick` | countdown/stat count-up: tick every frame group, pitch rising 3 semitones per 10 ticks, `AD(0.5 ms, 6 ms)`. Pair with a number animation: one tick per displayed increment (never faster than 24 per second or it becomes a buzz) | 20 ms |

### 4.5 Materials: glass, metal, wood, paper, plastic, cloth, liquid

Modal frequency-ratio tables (for `snd.core.modal`; a mode k has frequency `f0 * r_k`, amplitude `a_k`, T60 `d_k`). Ideal-physics
ratios (free-free bar, string, tube, membrane) are textbook values; the others are starting points to tune by ear.

| Object | Ratios (relative to f0) | Notes |
|---|---|---|
| Ideal string / harmonic | 1, 2, 3, 4, 5, ... | KS plucks use delay lines instead |
| Free-free bar (xylophone, metal bar, wood block bar) | 1, 2.756, 5.404, 8.933 | amps 1, 0.5, 0.25, 0.12; T60 shorter for higher modes (0.6x, 0.35x, 0.2x) |
| Marimba (tuned bar) | 1, 4, 10 (undercut tuning) | warm wood mallet; start amps 1, 0.35, 0.08 |
| Closed tube (clarinet-like, bottle blown) | 1, 3, 5, 7 | |
| Circular membrane (drum) | 1, 1.594, 2.136, 2.296, 2.653, 2.918 | tom/kick body; add pitch drop tau 25 ms for kick |
| Church/hand bell (inharmonic) | 1, 2.0, 2.4, 3.0, 4.07, 5.4, 6.8 (approx, "minor third" partial at 2.4) | start values; tune by ear |
| Chowning FM bell | carrier:modulator 1 : 1.4, index 10 -> 0 over the note (envelope), amp `exp(-t/T)`, T = 2-8 s | `snd.core.fm`; higher index at attack gives metal clang, decay to sine |
| Wine glass / glass tap | 1, 2.32, 4.25, 6.63, 9.38 (approx) with very low damping: T60 1.2, 0.9, 0.5, 0.3, 0.2 s | start values; glass = bright, long sinusoidal ring |
| Steel plate / metal sheet / pan | 24 modes at random log-uniform ratios in [1, 14], seeded; amps ~ r^-0.6; T60 0.8 s scaled r^-0.5 | the "clang" family; seed picks the object |
| Wood block / knock | 1, 2.3, 4.1; T60 0.04, 0.02, 0.01 s; excitation 3 ms noise burst | f0 400-1100 Hz by size |
| Plastic tap / rubber stool | 1, 1.8, 2.9; T60 0.03/0.015/0.01; f0 600-1500 Hz; LP 4k | dull and short |
| Ceramic / mug | 1, 2.7, 5.1, 8.2; T60 0.25/0.12/0.06/0.04 | |

Named material components:

| id | Recipe (defaults) | Dur |
|---|---|---|
| `snd.glass.tap` | modal wine glass, f0 1760-2640 Hz seeded, excitation 1.5 ms burst; send 0.1 | 1.2 s |
| `snd.glass.clink` | two `glass.tap` 35 ms apart, f0 ratio 1.12 | 1.0 s |
| `snd.glass.shatter` | noise crack (BP 6k Q 1.5, `AD(0.5 ms, 25 ms)`) + grain cloud of 120-400 short glass modal pings (grain 8-40 ms, f0 uniform 2-9 kHz, rate decaying from 900/s with tau 0.25 s) + low body 180 Hz at -12 dB | 1.4 s |
| `snd.metal.clang` | steel-plate modal, f0 280-520 Hz, strike excitation 2 ms, T60 0.9 s | 1.2 s |
| `snd.metal.ping` | Chowning FM 1:1.4, f0 key tonic x 8 (A6 1760 Hz), T 1.2 s | 1.5 s |
| `snd.metal.scrape` | saw 90 Hz AM'd by noise (depth 0.7) -> BP sweep 900 -> 3k Q 4, 0.35 s | 400 ms |
| `snd.wood.knock` | wood block modal, f0 700 Hz; `snd.wood.tap` softer, f0 450 Hz, LP 3k | 120 ms |
| `snd.wood.creak` | `creak` voice: saw 60-110 Hz with randomly stepped frequency (stick-slip, 25-60 Hz step rate), BP 700-1.2k Q 6 | 500 ms |
| `snd.paper.rustle` | grain cloud: noise grains 0.4-2 ms, Poisson rate 80/s -> 400/s -> 80/s (bell over 0.6 s), each BP 2-7 kHz random, amplitude log-normal; HP 1.2k | 600 ms |
| `snd.paper.crumple` | same, but rate 600-2500/s with bursty modulation (random walk in log rate, correlation 40 ms), plus 0.5 ms hard clicks | 900 ms |
| `snd.paper.flip` | page turn: `swish_s` (white, 1.2k -> 4k) + `paper.rustle` 120 ms + soft thud 120 Hz at the end | 350 ms |
| `snd.cloth.swish` | pink noise BP 300-1.2k Q 0.7, bell 250 ms, no high air; low gain | 300 ms |
| `snd.cloth.flap` | `punch` at 95 Hz low-passed 900 + 80 ms noise, repeated 3 times at 70 ms (decaying) | 350 ms |
| `snd.plastic.click` | plastic tap modal f0 1100, T60 25 ms + 8 ms noise | 80 ms |
| `snd.camera.shutter` | two clicks (open/close) 58 ms apart: BP 3.5k bursts 3 ms + 900 Hz thunk, and a spring: 180 Hz saw 15 ms | 150 ms |
| `snd.cash.ka_ching` | register drawer slide (`metal.scrape` short) + ring: two FM bells at E7 and B7, 60 ms apart | 1.1 s |
| `snd.sparkle` | v9 `sparkle`: 12 random notes from the key, spread 0.3 s, tau 0.07 s | 1.0 s |
| `snd.sizzle` | grain cloud 5-12 kHz BP grains 1 ms at 1500/s, slowly modulated | 1 s |

Liquid (bubble model, `sfx/liquid.py`). Minnaert resonance: an air bubble of radius `r` (metres) in water rings at about
`f = 3.26 / r` Hz (so r = 1 mm gives 3.26 kHz, r = 3 mm gives 1.09 kHz). van den Doel (2005) models a drop/bubble as a damped
sinusoid whose frequency rises slightly during its life, with damping increasing with frequency. Start values: damping
`d = 0.043 f0 + 0.0014 f0^1.5` (1/s), frequency rise about +20% over the bubble's life.
- `snd.liquid.bubble(r)`: sine `f(t) = f0 (1 + 0.2 (1 - exp(-t/ (2/d))))`, amp `exp(-d t)`, 1.5 ms attack, `r` uniform 0.6-4 mm.
- `snd.liquid.pour(rate, seconds)`: Poisson cloud of bubbles, rate 40-250/s, `r` log-normal (median 1.6 mm, sigma 0.5), plus pink noise bed LP 3k at -28 dB. Rate ramps up if filling a container (pitch of the cloud rises because the air column shortens: shift `r` down by 25% over the fill).
- `snd.liquid.drip`: one bubble r = 1.2 mm preceded by a 4 ms noise click (drop impact) BP 3k; send 0.08.
- `snd.liquid.splash`: noise burst `AD(2 ms, 90 ms)` BP 1.6k Q 0.8 + bubble cloud (60 bubbles in 250 ms, rate decaying) + LP 5k.
- `snd.liquid.glug`: 3 big bubbles r 6-9 mm (f 360-540 Hz) 90 ms apart, falling pitch, plus low sine 140 Hz tails.
- `snd.liquid.fizz`: pink noise HP 6k modulated by a grain train 3000/s; carbonation pop clicks at 20/s.

### 4.6 Boing, rubber, spring, squeak, slide whistle, cartoon motion (`sfx/cartoon.py`)

The comic family. Cartoon sound follows the principle that **pitch follows motion** (rises with upward or forward motion, falls with
downward or backward; wobble marks elasticity) and that every on-screen action beat gets exactly one sound (mickey-mousing).

| id | Recipe (defaults) | Dur |
|---|---|---|
| `snd.cartoon.boing` | carrier sine, base `f0` 170 Hz (+ 2nd harmonic at -9 dB); pitch `f(t) = f0 * (1 + A * exp(-t/tau_a) * sin(phi(t)))` with `A` 0.55, `tau_a` 0.28 s, and `phi` the integral of a wobble rate falling 12 Hz -> 5 Hz over 0.7 s; amp `AD(3 ms, 0.30)`; resonant LP 1.1 kHz (Q 3) with cutoff following the pitch. 1-3 boings per bounce, each -3 semitones | 700 ms |
| `snd.cartoon.sproing` | boing with an upward start: `f0` 110 -> 330 Hz exp over 80 ms then wobble | 800 ms |
| `snd.cartoon.spring_ks` | Karplus-Strong on a very low pitch (f0 78 Hz, loop gain 0.9992) with a 2 ms noise pluck, then a comb detune sweep -> metallic spring | 600 ms |
| `snd.cartoon.squeak` | rubber squeak: sine glide 1400 -> 2100 Hz over 70 ms with FM vibrato 55 Hz depth 6%, plus 3rd harmonic -8 dB; BP 2.8k Q 3 formant; `AD(4 ms, 50 ms)` | 130 ms |
| `snd.cartoon.squeeze_toy` | squeak with shorter length and drop in pitch on release (2100 -> 1500 Hz) | 160 ms |
| `snd.cartoon.slide_whistle(f_start, f_end, dur)` | sine glide (exp), vibrato 5.5 Hz depth 18 cents (grows from 0 to full over 0.2 s), breath noise HP 4 kHz at -22 dB, `AD(20 ms, long)`. Up glide for hop/rise, down for fall | 0.4-1.2 s |
| `snd.cartoon.skid` | saw 700 Hz, FM wobble, BP 1.6k -> 800 Hz down 0.4 s with noise 30% (tyre/shoe skid) | 450 ms |
| `snd.cartoon.slip` | slide whistle down 1500 -> 200 Hz over 0.5 s + `thud` low at the end (+ xylophone glissando option) | 700 ms |
| `snd.cartoon.tiptoe(n, tempo)` | sneaky steps: `pizz` notes (KS, f0 from a minor-ish chromatic scale: A3, Bb3, A3, Ab3...) staccato, 90 ms, `AD(1 ms, 55 ms)`, alternating pan +-0.2, step spacing = foot contact frames; bass-pizz 80 ms. Mime-style silent-character comedy relies on this + squeaks, no words | per step 100 ms |
| `snd.cartoon.walk_bounce` | marimba note (modal bar 1:4:10) per footfall on a pentatonic walk, 70 ms | per step |
| `snd.cartoon.bonk` | wood block (f0 520 Hz, T60 90 ms) + 90 ms low thud + 1 cartoon star ring (FM bell 1:1.4 at E6 after 120 ms, -10 dB) | 500 ms |
| `snd.cartoon.pop_eye` | pitched pop up fast (chirp 300 -> 1500 Hz over 35 ms) + boing; for take, eye-bulge | 300 ms |
| `snd.cartoon.gulp` | v9 `gulp` (pitch-down blip + wet 80 ms) | 250 ms |
| `snd.cartoon.zip_run` | rapid stepping: 40 ms alternating ticks with rising pitch + `swish` Doppler + 2 note flute-whistle at the stop | 0.6 s |
| `snd.cartoon.poof` | cloud: noise bell 120 ms LP 2k + sub 90 Hz -> 50 Hz, then sparkle tail 400 ms | 700 ms |
| `snd.cartoon.sad_brass` | "wah wah wah waaah": 4 saw notes (Bb3, A3, Ab3, G3, last note glides down 1 semitone with vibrato 5 Hz), LP envelope per note 2.2k -> 600 Hz, muted wah filter BP 700 -> 1.4k -> 700 Hz per note; 0.28 s per note, last 0.9 s | 1.5 s |
| `snd.cartoon.tada` | trumpet-ish stack: 3 saws on key triad up a fourth, LP 3k, plus cymbal reverse swell, 700 ms | 1.0 s |
| `snd.cartoon.record_scratch` | noise burst + tape-stop (4.10) with fast band-pass on a held chord: pitch 1 -> 0.05 in 220 ms, vinyl crackle grain 800/s; or "scratch" jitter: playback-rate random walk (+-1.5) on a held saw for 250 ms | 400 ms |
| `snd.cartoon.rimshot` | snare (4.11) + tom (membrane, f0 190 Hz) + crash hit 120 ms later | 500 ms |
| `snd.cartoon.crickets` | 4.6 kHz sine bursts 90 ms with 5 Hz AM x 3 pulses, repeated every 700 ms, random per cricket; 3 crickets detuned 40 Hz; background -26 dB | loop |

### 4.7 Character voices without words (`sfx/voices.py`) -- gibberish, chirps, mime-style reactions

Rule: **no speech, no TTS, no intelligible words**. The characters communicate by contour: rising = question/surprise, falling =
resignation/statement, fast flutter = excitement. All owned: glottal source + formant filters.

Engine `snd.voice.babble(character, mood, duration, seed)`:
1. **Source**: Rosenberg glottal pulse (open quotient 0.6) at `f0(t)`; breath noise at -22 dB (mixes in on unvoiced sections).
2. **f0 contour**: syllable grid: syllable rate 4.5-7.5 per second by mood (calm 4.5, excited 7.5); per-syllable `f0 = base * 2^(offset/12)`, offset from a mood-weighted random walk (excited: +-5 semitones; calm +-2); phrase contour: statement = linear fall 3 semitones over phrase, question = rise 4 semitones over the last 30%, surprise = start +5, quick fall. Vibrato 5.5 Hz depth 20 cents on notes > 160 ms. Glide between syllables 25 ms.
3. **Formants** (Klatt parallel; Peterson & Barney 1952 male averages, Hz F1/F2/F3; bandwidths B1/B2/B3 = 60/90/150 Hz):
   - /a/ 730 / 1090 / 2440; /e/ (as in "bet") 530 / 1840 / 2480; /i/ 270 / 2290 / 3010; /o/ 570 / 840 / 2410; /u/ 300 / 870 / 2240.
   - Scale for character size: formant multiplier `k = 0.85` (big, gruff), 1.0 (adult male), 1.17 (adult female), 1.35 (child), 1.6 (tiny creature / chipmunk). Base f0: 85 (big), 120, 210, 300, 520 Hz.
   - Each syllable picks a vowel (weighted random, with 12% dipthong glide to the next), formants move over 30 ms between syllables.
4. **Consonants** (random per syllable onset, 55% of syllables): plosive (noise burst 12 ms, BP centre 800 / 2000 / 4000 Hz for p / k / t), fricative (HP 5.5 kHz noise 60 ms), nasal (voiced with F1 250 Hz, extra anti-resonance at 1.2 kHz, F2 band attenuated 12 dB, 70 ms), approximant (formant glide 50 ms).
5. **Envelope**: syllable `AD(8 ms, 0.12)`, 80 ms minimum gap; phrase pauses at word boundaries (every 2-5 syllables).
6. **Out**: LP 8 kHz (de-esser), light tape sat 1.5x oversampled (optional), pan centred, send 0.06.
Presets: `snd.voice.grunt` (large, k 0.85, f0 85, 1-2 syllables, falling), `snd.voice.chirp` (tiny, k 1.6, f0 520, 3-6 notes, vowels /i/ /e/, upward contour, 60 ms each, vibrato 7 Hz), `snd.voice.mumble_gibberish` (child/adult, 1.5 s, statement), `snd.voice.oh` (surprise: /o/ with fall, 350 ms), `snd.voice.huh` (/a/ then rise, 300 ms), `snd.voice.giggle_synth` (8 bursts of /i/ at 14 Hz with pitch descending 4 semitones, aspirated; stylised, not real laughter), `snd.voice.hmm` (nasal, 280 ms). Mime-style spots (silent comic characters): mostly `chirp`, `huh`, `squeak`, `boing`, `tiptoe` and `pop_eye`, one cue per action beat, never overlapping speech-like sounds.

For lip-sync to a drawn character use syllable timing from the animation: provide the syllable onset frames and the engine snaps syllable starts to frames (then the one-frame rule).

### 4.8 Ambiences and room tones (`sfx/ambience.py`)

All ambiences are rendered seamless-loopable: filter noise in the **frequency domain on the full loop length** (circular), and
slow modulations use integer cycles over the loop length. Level in a film: bed K-level minus 12 dB or -35 to -28 LUFS-S by
itself; always high-passed at 60 Hz.

| id | Recipe (defaults) |
|---|---|
| `snd.amb.room_tone` | pink noise, LP 1.4 kHz (slope 12 dB), -48 dBFS RMS; 50 Hz mains hum + harmonics 100, 150 Hz at -42/-50/-58 dBFS (50 Hz for India; `hum_hz` param, 60 for US); slow +-1.2 dB amplitude drift at 0.15 Hz |
| `snd.amb.office` | room_tone + distant babble (3 `babble` streams at -38 dB, LP 2k, formant-smeared, no onsets above 30 ms) + occasional keyboard (`typing` bursts every 6-14 s, -34 dB) + HVAC brown noise LP 180 Hz -40 dB |
| `snd.amb.studio_air` | very quiet pink, LP 900 Hz, -56 dBFS, plus 8 kHz "air" at -62 dBFS; for film-like silence that is not digital zero |
| `snd.amb.night` | brown LP 250 Hz -44 dB + crickets (4.6 kHz bursts, 12 voices, random detune 120 Hz, pulse rate 28-34 Hz grouped in 3-pulse chirps, AM 4 Hz) -34 dB |
| `snd.amb.rain` | Poisson drops 600-2500/s, each a 2 ms BP 2-8 kHz grain + pink bed LP 6 kHz -32 dB; light/heavy via rate; add 12 sparse window-tap modal events (wood tap f0 800) for interior |
| `snd.amb.wind` | pink noise through BP whose `fc` follows a slow random walk 250-900 Hz (rate 0.2 Hz), Q 1.5, amp modulated by an independent random walk 0.1-0.5 Hz; plus rare gust: bell envelope 3 s to +10 dB |
| `snd.amb.crowd` | 12 `babble` voices at random pitch/formant scales, LP 3 kHz, each gated to 0.3-2 s phrases, pan spread +-0.9, reverb send 0.4: murmur; applause variant: grain claps 0.4 ms-2 ms noise grains 3000/s at 1-5 kHz with level swell |
| `snd.amb.city` | brown LP 300 Hz -38 dB, + 3 kHz noise "traffic hiss" modulated at 0.07 Hz, + distant horn: 2 saws 420/530 Hz at -52 dB for 400 ms every 14-40 s |
| `snd.amb.server_hum` | 120 Hz hum + harmonics, fan noise: pink BP 1.8 kHz Q 1.2 modulated 3% at 0.5 Hz |
| `snd.amb.tension_drone` | saw/sine stack on a tonic fifth (A1 55 Hz + E2) + detuned 0.4 Hz beating, LP 400 Hz -> 900 Hz slow 20 s sweep, level -32 LUFS-S: cinematic underlay |

### 4.9 Stingers and sonic-logo patterns (`sfx/stingers.py`, `music/logo.py`)

A **sonic logo** is a 1.2-2.5 s signature used the same way every time: it identifies the brand and punctuates endings. Recipe
`snd.logo.make(key, motif, voicing, tail)`:
- **Motif**: 3-5 notes, scale degrees as intervals from the tonic. Pattern bank (semitones from tonic, A major default tonic A):
  1. `ascend_land` [0, 4, 7, 12] (maj triad arpeggio resolving up an octave): confident, product launch.
  2. `fifth_lift` [0, 7, 4] (rise a fifth, land on the third; held 1.2 s): friendly, open.
  3. `question` [0, 2, 7] ended on the fifth, unresolved: curious, tutorial teaser, "to be continued".
  4. `pulse_pad` [0, 0, 7, 0]: repeated tonic then rise (rhythm 1 .. 1 .. 1 1): authoritative/tech.
  5. `two_note` [7, 12] (fifth to octave, rising): minimal, any.
  6. `drop_land` [12, 7, 0]: closure for end cards (descending resolution).
- **Voicing**: three layers: FM bell (ratio 1:1.4, index 6 -> 0 over 0.9 s) on the motif; soft pad (2 detuned saw, LP 2.4 kHz, `AD(40 ms, 1.2)`) holding the final chord (tonic triad + 9th at -12 dB); sub at the root (sine, A1 55 Hz or A2 110 Hz, `AD(5 ms, 0.6)`, mono, -10 dB, only on the last note). Rhythm: notes at 0, 140, 280, 560 ms (default; rhythm values in 30 fps frames: 0, 4, 8, 17). Last note sustains 0.9 s.
- **Tail**: `hall` IR send 0.30; ring-out ends in true silence in 2.4 s total at the latest.
- **Brand determinism**: `motif_from_name(name)` hashes a brand name (SHA-256 bytes) to pick a pattern from the bank and rhythm variation, so every new brand gets a stable, original signature without copying anyone's. Hand-picked example, `snd.logo.hybrid`: key A major, `ascend_land` + `pulse_pad` hybrid [0, 0, 7, 12], rings already exist in v9 (`ring()` in voices9.py: reuse as the logo's bell).
- Loudness: logo anchors at over-bed +5 dB; if no bed, level at about -16 LUFS-S so the master lands -14 LUFS-I.
Stingers (shorter than a logo, section punctuation):
| id | Recipe | Dur |
|---|---|---|
| `snd.stinger.reveal` | `lift.inhale` 300 ms into `hit.stab` + `sparkle` | 1.5 s |
| `snd.stinger.win` | `ui.success` + `tada` brass + reverse cymbal 400 ms | 1.4 s |
| `snd.stinger.alert` | 3 pulsing tones E5 at 8 Hz AM, then `hit.punch`; for pattern interrupt | 600 ms |
| `snd.stinger.cut_to_black` | `hit.cinema` truncated: hard 8 ms fade at 350 ms, then 1.2 s of `amb.studio_air`; for film beats | 1.6 s |
| `snd.stinger.question` | logo `question` motif, FM bell only | 1.2 s |
| `snd.stinger.bump` | 2-note hit + sub (comedy beat) | 400 ms |

### 4.10 Transition sweeteners (the sound of each edit type) (`sfx/transitions.py`)

A table the editor (and the cut-map generator) uses to attach sound to a transition automatically: `sweetener(transition_kind, duration_frames, energy)`.
Always attach the anchor per rule 1, and keep tier 2 spacing (rule 4).

| Transition | Sweetener (recipe) | Anchor | Over bed |
|---|---|---|---|
| Hard cut (beat-synced) | none, or `snd.cut.tick`: 6-10 ms noise burst HP 3 kHz at -30 dB re hits (prevents sterile jump) | cut frame + 1 | +0 to +2 |
| Jump cut (talking head) | `cut.tick` + optional `swish_xs` at -18 dB when the zoom changes | cut + 1 | +0 |
| Whip pan / swish pan | `whoosh_m` pass, pan follows direction of the pan | blur midpoint + 1 | +2 |
| Slide / push | `swish_s` in + `ui.slide` | midpoint + 1 | +1 |
| Zoom punch-in (3-6% scale hit) | `hit.punch` (60 Hz) at -3 dB re default + `whoosh.zip` | scale peak + 1 | +3 |
| Zoom-through / dolly | `riser.noise` 6-12 frames ending on the next scene's first frame, then `hit.thud` | next scene frame 0 + 1 | +3 |
| Flash / light leak | air swell (noise HP 3 kHz bell 300 ms, shimmer partials 3.2/4.8/6.4 kHz) + soft `hit.thud` at -9 dB | peak flash + 1 | +2 |
| Glitch / RGB split | `glitch.stutter` (below) | glitch start + 1 | +3 |
| Dissolve / cross-fade | pad swell: two detuned saws on the key triad, LP 1.8 kHz, bell over the dissolve duration, -22 dB re bed; no whoosh | mid-dissolve | -4 to 0 |
| Match cut | no whoosh: a tonal "link": sine glide between the pitch of outgoing and incoming object sounds over the cut (+-60 ms) | cut + 1 | +1 |
| Speed ramp (slow-mo to fast) | `tape_down` then `whoosh_m`: pitch follows rate (rate r gives pitch `12 log2 r` semitones); in HyperFrames use the rate lane (`data-automation` rate) so music and sfx follow | ramp peak | +2 |
| Freeze frame | `tape_stop` 220 ms + low-pass closing 8k -> 400 Hz; `record_scratch` for comedy | freeze frame | +3 |
| Shatter / break | `glass.shatter` or `metal.clang` | impact + 1 | +4 |
| Page turn / reveal | `paper.flip` | midpoint | +1 |
| Scene change (film) | `amb` crossfade (rain to office) 0.6 s + `hit.thud` -12 dB, no whoosh | cut + 1 | n/a |
| Title card in | `lift.inhale` + `hit.stab` | title frame + 1 | +4 |
| Out to black | `lift.down` 0.8 s + `studio_air` | fade start | -2 |

Extra recipes referenced above:
- `snd.cut.tick`: `noise_burst(attack 0.3 ms, release 6 ms)` HP 3 kHz, plus 90 Hz sine 8 ms at -8 dB: tiny "pit".
- `snd.glitch.stutter(length=0.35)`: slice the underlying cue (or noise) into 25-40 ms grains, repeat grain k times (k = 3-6, random), bitcrush to 6-8 bits and sample-rate divide by 6-12 (8 kHz -> 4 kHz), add 2 kHz "zzt" sine bursts with 40% duty cycle, hard gate; the rhythm quantised to 1/16 notes at the bed BPM.
- `snd.tape_stop(length=0.35)` / `tape_down` / `tape_up`: read pointer rate `r(t) = exp(-t/tau)` (tau = length/3) through a held chord with linear interpolation (do not use a sinc filter; the aliasing is part of the sound), LP cutoff `8k * r(t)`.

### 4.11 Drums and music-hit voices (shared with section 8) (`music/drums.py`)

| id | Recipe |
|---|---|
| `snd.drum.kick` | sine 150 -> 48 Hz pitch envelope tau 25 ms (exp), amp `AD(1 ms, 0.28)`; click: noise BP 3.5k 2 ms at -12 dB; optional 2x oversampled tanh drive 1.8 for "punch"; sub variant: end pitch 42 Hz, tau 0.45 |
| `snd.drum.snare` | triangle 185 Hz (pitch 230 -> 180 Hz, tau 15 ms) `AD(1 ms, 0.09)` + white noise BP 1.9 kHz Q 0.9 `AD(1 ms, 0.14)` at -3 dB, + HP 6 kHz air at -14 dB |
| `snd.drum.clap` | 4 noise bursts at 0, 9, 18, 30 ms, each `AD(0.5 ms, 6 ms)`, last one `AD(0.5 ms, 90 ms)`; BP 1.2 kHz Q 1.6, HP 400 Hz; reverb send 0.2 |
| `snd.drum.hat_c` / `hat_o` | 6 square oscillators at 205.3, 304.4, 369.6, 522.7, 540, 800 Hz (808 ratios) summed, HP 7 kHz, `AD(0.5 ms, 35 ms)` closed, `AD(0.5 ms, 250 ms)` open; velocity scales brightness |
| `snd.drum.rim` | 2 sines 1.7 kHz + 480 Hz `AD(0.3 ms, 14 ms)` + click |
| `snd.drum.tom` | membrane modal f0 110-220 Hz with pitch drop 12% over 80 ms, T60 0.4 s |
| `snd.drum.cowbell` | 2 squares at 540 and 800 Hz, BP 1.1 kHz Q 2.5, `AD(0.5 ms, 90 ms)` |
| `snd.drum.shaker` | pink noise HP 5 kHz, bell 60 ms, two bursts per hit (back-and-forth, 35 ms apart) |
| `snd.drum.dhol_like` | membrane modal f0 85 Hz + beater click (low drum) and a high rim "chaati" f0 190 Hz bright: a synthesised stand-in for a hand-drum groove; do not imitate any sample library |
| `snd.drum.808` | sine 55 Hz (key note) with 10 ms attack, glide 1.3x -> 1x over 70 ms, amp `exp(-t/0.9)`, tanh drive 2.5 4x oversampled, notch cleanup at 38 Hz |

---

## 5. Loudness, peaks and platform targets

### 5.1 The measurement standard (one meter for the whole pack)

- Integrated loudness: ITU-R BS.1770-4 K-weighting, 400 ms blocks with 75% overlap, absolute gate -70 LUFS, relative gate -10 LU.
  Our meter implements it with the 48 kHz coefficients; cross-check on every master with ffmpeg:
  `ffmpeg -hide_banner -nostats -i master.wav -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | tail -n 14`
  (reports I, LRA, true peak). The two meters must agree within 0.1 LU on I; if not, the Python meter is wrong, fix the meter.
- True peak: 4x oversampled (BS.1770), so inter-sample peaks are counted. After lossy encoding, peaks can rise: the AAC probe
  catches that (v9 `probe()` runs `aac_at` and `aac` at 256 kbps and reads their I/TP).
- Short-term (3 s) and momentary (400 ms) maxima are recorded per cue in the manifest; LRA reported but not gated.

### 5.2 House master spec (all platforms unless a table row overrides)

| Item | Value |
|---|---|
| Integrated loudness | -14 LUFS-I, +-0.5 (aim +-0.1) |
| True peak ceiling | -1.5 dBTP on the 24-bit WAV and on AAC 256 kbps probes (two encoders) |
| Loudness range | 4-8 LU short-form ad/social; 6-10 LU brand film; 10-15 LU short film (use the dynamics) |
| Format | 48 kHz, stereo, 24-bit WAV master; AAC-LC 256 kbps in the MP4 |
| Silence | last 0.15 s digital zero; first sample not zero when the video opens on a hit (5 ms de-click ramp only) |
| Mono compatibility | sum to mono loses <= 3 dB in 100-120 Hz; no phase cancellation notch deeper than 6 dB in mid (check `corr(L,R) > 0.3` over bed, hits may be wider) |
| Phone check | `phone_voice` render passes the same cue-over-bed table with -1 dB relaxation |

### 5.3 Per platform (what is known, what is not)

The honest state: **only Spotify and YouTube behaviour are documented well enough to quote; Instagram, TikTok, X and LinkedIn do
not publish loudness specs I could find.** Everything about them below is a working assumption to be verified by test uploads
(upload a -14 LUFS clip and a -10 LUFS clip, compare playback level in-app).

| Platform | Documented behaviour | Working target (house) | Evidence grade | Notes |
|---|---|---|---|---|
| YouTube (incl. Shorts) | Playback normalisation toward a reference near -14 LUFS; louder content is turned down; quieter is not boosted (Stats for Nerds "content loudness" shows the dB offset) | -14 LUFS-I, TP <= -1.5 | B (consistent secondary sources; official help page not retrieved) | Mixing hotter than -14 gives no loudness gain and only costs dynamics. Quiet masters stay quiet. So -14 is also the floor of competitiveness. |
| Instagram (Reels/feed/Stories) | No Meta spec found. Blogs say -14; one says "-13 to -10 preferred"; none cite Meta | -14 LUFS-I, TP <= -1.5 | D (unverified) | Re-encoded AAC; keep TP margin. Most viewing on phone speaker: apply `phone_voice` voicing for 9:16 masters. |
| TikTok | No TikTok spec found. Blogs say -14 (some -13..-12 for music-forward) | -14, optional "hot" -13 for beat edits if the limiter cost stays <= 1.5 dB | D | Platform music library clips are mastered loud; a -14 voice-over-first video sits in line. Test. |
| X (Twitter) | No spec found. Video autoplays muted in feed; transcoded | -14, TP <= -1.5; also test a 128 kbps AAC probe | D | Captions are mandatory for comprehension; sound is a bonus. |
| LinkedIn | No spec found. Feed autoplays muted; heavy desktop/work-hours use | -14, LRA <= 7 LU, avoid harsh 3-5 kHz and boomy sub | D | Audience listens in offices; favour dialog-first mixes, soft transients, brand logo at the end, subtitles burned in. |
| Spotify (podcast/music) | Official: normalises to -14 LUFS (ITU 1770), TP <= -1 dBTP for lossy; if master louder than -14 use TP <= -2; Loud/Normal/Quiet listener modes -11 / -14 / -19 LUFS; limiter engages at -1 dB with 5 ms attack, 100 ms decay | -14 / -1.5 | A (support.spotify.com fetched) | Relevant to music beds and audiograms. |
| Broadcast TV / festival short film | EBU R128: -23 LUFS programme loudness (tolerance +-0.5 or +-1 LU depending on source, check current doc), TP -1 dBTP; EBU R128 s2 (2020) for streaming: -23 LUFS unchanged. ATSC A/85 (US): -24 LKFS +-2 | -23 LUFS-I / -1 dBTP master for festival and broadcast; keep a separate -14 social cut | B (EBU pages retrieved; ATSC value from memory) | Do not deliver a -14 master to a broadcaster. Streaming SVOD specs (e.g. Netflix about -27 LKFS dialogue-gated, TP -2 dBTP) are from memory and must be checked against the current delivery spec before use. |
| AES streaming (distributors) | AES TD1004 (2015) recommended -16 to -20 LUFS with TP <= -1 dBTP; superseded by TD1008; Amazon, Spotify, TIDAL, YouTube all landed on -14 | n/a | B | Shows why -14 is the de facto web number. |

Sources are in section 12. The conflicts (e.g. "Instagram prefers -13 to -10 LUFS" versus "-14") should be resolved by the
upload test above, recorded in `research/sound-platform-tests.md` after the test, and the table updated.

### 5.4 Mastering chain (the `master.py` component)

1. Sum stems at their solved trims; measure I with BS.1770.
2. Gain to land -14.0 LUFS-I (v9 `master(pre, ceil)` iterates `G0 = LUFS_T - lufs(pre)`).
3. True-peak limiter: 5 ms look-ahead, release 80 ms (program-dependent: dual release 40/200 ms), ceiling -1.5 dBTP, 4x oversampled detection. Gain reduction on any tier 1 group <= 1.5 dB; otherwise lower the offender, not the limiter.
4. Encode AAC probes (`aac_at` and `aac` 256k), read I and TP; reduce the ceiling by the overshoot + 0.15 dB; repeat (max 8 rounds).
5. 24-bit write; silence the last 0.15 s.
6. Write the report: per hit (bed only / hits only / mix / over-bed / GR / timing error samples), I, LRA, TP (WAV, aac_at, aac), phone render stats.
Never use `loudnorm` as the final step: it can alter dynamics and does not know the hit contract. Use it as an independent measurement only (`loudnorm=print_format=json` in analysis mode).

---

## 6. Dialogue, talking-head and retention-edit sound (human editing videos)

For human/talking-head edits the voice is the program; effects are punctuation at lower level.

| Event | Sound | Level re voice | Timing |
|---|---|---|---|
| Hook word / keyword emphasis | `ui.pop` or `hit.punch` + `lift.inhale` 150 ms before | -16 to -12 dB | pop on the caption word's appear frame + 1 |
| Zoom punch-in | `hit.punch` + `whoosh.zip` | -14 dB | scale-peak frame + 1 |
| Jump cut | `cut.tick` (optionally `swish_xs`) | -24 to -20 dB | cut + 1 |
| B-roll insert | `swish_s` in / out | -18 dB | clip start / end |
| Stat / number reveal | `ui.count_tick` train + `ui.success`-like ding on the final value | -16 dB | per displayed increment |
| List item / bullet | `ui.pop` pitch walks up the key scale each item (A5, B5, C#6, E6...) | -18 dB | item appear + 1 |
| Pattern interrupt every 3-5 s | rotating tier 3 sounds (swish, tick, pop, riser blip), never the same sound twice in a row | -18 to -14 dB | on the visual change |
| Silence cleanup | remove dead air; add a 40-80 ms room tone under every cut so the cut is not a hole | room tone -48 dBFS | continuous under cut |
| Breath/filler | cut, then `cut.tick` | | |
| Music bed | 100-124 BPM instrumental stem, bed -22 to -26 LUFS-S under voice, duck rule 5 | | |
| End card | `logo` at over-bed +5 | | |

Voice chain for recorded speech (offline, `sound/mix/voicechain.py`; the HyperFrames equivalents are in the `hyperframes-audio`
presets): high-pass 80 Hz (12 dB/oct), de-mud peaking -2.5 dB at 250 Hz Q 1.0, presence +2 dB at 3.2 kHz Q 0.9, de-ess (dynamic
-4 dB at 6.5 kHz when the 5-8 kHz energy exceeds -30 dB re speech RMS), compressor ratio 3:1, threshold -20 dBFS, attack 12 ms,
release 120 ms (2-4 dB GR), limiter -3 dBFS true peak, loudness-match to -16 LUFS-S before mixing. This is a reasonable starting
chain from broadcast practice; it has not been listened to in this session.

---

## 7. Cartoon / short-film / ad-specific sound bundles

Bundles are named presets over the library so a new video starts with a mapped palette (`sound/bundles/*.json`: list of cue
roles to `snd.*` ids, bed preset, key, ducking numbers, loudness target).

| Bundle | Palette | Bed | Key rules |
|---|---|---|---|
| `bundle.launch_film` | `hit.stab`, `hit.cinema`, `riser.noise`, `riser.shepard`, `lift.down`, `ui.*`, `logo` | tech pulse 110-124 BPM, minor/major mix, A | tiers 1-3; one hero hit per 8-10 s; end on logo + 0.15 s silence |
| `bundle.mime_spot` | `cartoon.*` (tiptoe, squeak, boing, pop_eye, slip, bonk, poof), `voice.chirp/huh/oh`, `drum.cowbell`, rimshot | playful pizzicato/marimba 118-140 BPM, major, no sub | every action beat has one sound (mickey-mouse); pitch follows motion; no words; comedic pause of 4-8 frames (0.13-0.27 s) before a punchline; punchline `cartoon.bonk`/`boing` + record_scratch for freezes |
| `bundle.beat_edit` | `drum.*` ,`hit.punch`, `riser.noise`, `lift.down`, `glitch.stutter`, `whoosh.zip` | 128-150 BPM (or half-time 64-75) | cut on beats; sfx accents on the off-beats between cuts; sidechain pump on kick; drop = biggest visual |
| `bundle.talking_head` | section 6 table | 100-120 BPM instrumental | voice first; duck 9 dB; no tier 1 except end logo |
| `bundle.short_film` | `amb.*`, `foley` (cloth, steps, wood, paper, glass), `tension_drone`, `hit.cinema` (rare), `stinger.cut_to_black` | sparse score 60-90 BPM, drones | LRA 10-15 LU; room tone under every shot; no whoosh transitions; sound leads the cut (J/L cuts: audio of the next scene starts 12-24 frames before the picture cut) |
| `bundle.product_ad` | `ui.*`, `metal.ping`, `glass.clink`, `liquid.*`, `camera.shutter`, `cash.ka_ching`, `riser`, `logo` | uplift 100-120 BPM | tactile "satisfying" micro-sounds in sync with product close-ups; logo at 0.2 s after the last visual |
| `bundle.kinetic_type` | `ui.type_key`, `ui.pop` (pitch walk), `cut.tick`, `whoosh.swish_*`, `hit.punch` on the title word | 120 BPM pulse | one sound per word appear; louder on emphasised words (+3 dB); no sound on pure fades |
| `bundle.loop_short` | any, but with seamless wrap | | end tail wraps to start (section 3 rule 11) |

Virality-oriented sound practices (practitioner heuristics, not measured by us; test with the real analytics before adopting):
1. Audible event in the first 3 frames and a second payoff inside 1.5 s.
2. Legible without sound (captions) and rewarding with sound; never place meaning only in audio.
3. A recognisable sonic signature: the same 1.2 s `logo` and the same 3 UI sounds across all of a brand's videos (recognition builds with repetition).
4. Loops: seamless audio wrap raises replays; use `loop_short`.
5. Satisfying micro-sound layer (ASMR-like clicks, snaps, pours, paper) on product moments: consistently mentioned by short-form creators as a retention aid.
6. Deliver `sfx_only`/`vo_only` stems so a platform's trending audio or a creator's remix can replace music without losing the effects.
7. No jump scares: no tier 1 hit above +6 dB over bed or above -1.5 dBTP, so viewers do not mute after a loud first second.
8. Keep a "no-music" cut for contexts where licensed music is stripped; our beds are ours, so nothing is muted for copyright.

---

## 8. Music: beds, stingers, tempo-to-cut maps, procedural composition

### 8.1 Tempo and grid math (`core/grid.py`)

- Beat in seconds: `60/BPM`; beat in frames: `fps*60/BPM`; bar (4/4): 4 beats.
- **Tempo snap rule**: choose BPM so that the beat is an integer number of frames, so every beat, bar and cut is frame-exact with no
  rounding drift: `n = round(fps*60/BPM)`, `BPM_snap = fps*60/n`. Max error from the requested BPM is under about 3% for n >= 12
  and usually under 1%. It is inaudible and saves every later rounding decision.
  - 30 fps: n=12 -> 150, 13 -> 138.46, 14 -> 128.57, 15 -> 120, 16 -> 112.5, 17 -> 105.88, 18 -> 100, 19 -> 94.74, 20 -> 90, 24 -> 75.
  - 60 fps: n=24 -> 150, 26 -> 138.46, 28 -> 128.57, 30 -> 120, 32 -> 112.5, 34 -> 105.88, 36 -> 100, 40 -> 90.
  - 24 fps: n=10 -> 144, 11 -> 130.9, 12 -> 120, 13 -> 110.77, 14 -> 102.86, 15 -> 96, 16 -> 90.
- Common BPM table (unsnapped), beat in s and frames:

  | BPM | beat s | frames/beat @30 | @60 | bar s | bar frames @30 |
  |---|---|---|---|---|---|
  | 90 | 0.667 | 20.0 | 40.0 | 2.667 | 80 |
  | 100 | 0.600 | 18.0 | 36.0 | 2.400 | 72 |
  | 110 | 0.545 | 16.36 | 32.73 | 2.182 | 65.45 |
  | 120 | 0.500 | 15.0 | 30.0 | 2.000 | 60 |
  | 128 | 0.469 | 14.06 | 28.13 | 1.875 | 56.25 |
  | 140 | 0.429 | 12.86 | 25.71 | 1.714 | 51.43 |
  (Computed in this session. 120, 100 and 90 BPM are already integer at 30 fps; 110, 128 and 140 are not, so snap them.)
- `grid.cut_map(bpm, fps, bars, pattern)` returns a list of cut frames. Patterns (in beats): `steady_beat` [1]*, `bar_hold` [4]*,
  `two_beat` [2]*, `accelerate` [4,4,2,2,1,1,1,1], `drop_build` [4,4,4,2,2,1,1,0.5,0.5,0.5,0.5] then the drop on a bar line,
  `syncopated` [1.5, 1.5, 1, ...] (3+3+2 feel in 8th notes). Cuts snap to the nearest frame on the grid; hits for cuts anchor on that frame + 1.
- Cut density by video type (rules of thumb; change with experience): launch film/ad: average shot 1.5-2.5 s; hype beat edit: a cut every beat or half-beat in the drop (0.25-0.5 s) and every bar or two in verses; talking-head: a visual change every 2-4 s (jump cut, punch-in, B-roll); cartoon spot: shot length follows gags (1-3 s, longer on reaction); short film: 3-6 s average, long takes on emotion.
- Phrase rule: cuts on beats; scene changes on 2/4/8-beat phrases; the biggest visual on the drop; risers span whole bars so they end on a downbeat: `riser_len = bars x 4 x 60/BPM`; the hit is the downbeat of the next bar.
- Sidechain pump: 1/4-note duck on the bed pad/bass, depth 4-6 dB, attack 5 ms, release 180 ms (tune: release ~ 0.4 beat); only in beat edits.

### 8.2 Procedural music generator (`music/compose.py`)

`compose(bpm, key, scale, mood, bars, structure, energy_curve, seed, fps) -> {stems: drums, bass, harmony, lead, fx}` plus a JSON
event list (note times in frames for beat-sync of visuals). Deterministic. Each stem is a separate float32 buffer so the mix can
mute/solo and duck them separately.

- **Scales**: major (0 2 4 5 7 9 11), natural minor (0 2 3 5 7 8 10), dorian (0 2 3 5 7 9 10), mixolydian, pentatonic major (0 2 4 7 9), pentatonic minor, harmonic minor (0 2 3 5 7 8 11), lydian (0 2 4 6 7 9 11) for wonder/brand optimism, whole-tone for dream.
- **Progressions** (Roman numerals, one chord per bar unless `2/bar`): uplift [I V vi IV], [I vi IV V]; tech/confident [vi IV I V], [I IV vi V]; tension [i VI III VII], [i iv VII VI]; cinematic [i VI VII i], pedal tonic [I I IV I]; comedic bounce [I vi ii V] (turnaround), [I bVII IV I]. Voice-lead: nearest-note voicing with common tones held, closed triads in 200-500 Hz, root in bass octave.
- **Drum patterns** via Euclidean rhythms E(k, 16) (Bjorklund algorithm): kick E(4,16) for four-on-the-floor, E(5,16) for broken; clap/snare on beats 2 and 4 (steps 4, 12); hat E(7..11,16) with accents on off-beats, ghost notes at velocity 0.35; open hat on the "and" of 4. Swing 0-18% on 16ths (default 8% for lo-fi/comedy, 0% for tech). Humanize timing +-3 ms and velocity +-8% (never on hits that must sync to picture: those are the SFX layer).
- **Bass**: root-fifth-octave patterns locked to the kick (play when the kick does, plus passing tones on the off-16ths with 30% probability), `808` voice for hype, saw+sub for tech, `KS` pluck for comedy.
- **Harmony voices**: `pad` (2-3 detuned saws, LP 1.6-3.2 kHz, slow attack 120 ms), `pluck` (KS or FM, chord arpeggio up/down 1/8, gate 0.5), `keys` (FM electric piano 1:1 ratio, index 1.5 -> 0.3), `marimba`, `pizz`, `bell`.
- **Melody**: a motif of 4-8 notes (rhythm from the pattern bank), then variations: transposition by chord (every bar), inversion, rhythmic displacement by an 8th, truncation. Rules: 70% stepwise, leaps <= a fifth, leaps >= a 4th followed by a step in the opposite direction, ends on a chord tone on the downbeat of phrase ends, no more than 3 repeated notes. A first-order Markov chain over scale degrees is enough, seeded.
- **Energy ladder** (`energy` 0..1 per section, controls which stems play): 0.00 pad/drone only; 0.25 + hat/shaker; 0.40 + kick; 0.55 + bass; 0.70 + clap/snare + arp; 0.85 + lead + noise riser bars; 1.00 + extra layer (octave doubling, crash). A drop is a step from 0.1 to 1.0 on a bar line preceded by 1 bar of riser + silence of 1 beat in the drums (the "pre-drop gap").
- **Structure templates** (bars): `ad_30s` @120 BPM: intro 2 (0.25), build 4 (0.55), drop 8 (1.0), break 2 (0.4), final 4 (0.85), tail 1 + logo; `reel_15s` @128: hook 1 bar hit, verse 2, build 1, drop 3.5; `film_52s` per the v8/v9 score. Sections are expressed in bars and converted to frames by the grid.
- **Mix of the bed**: stem trims (relative): drums 0, bass -2, harmony -6, lead -4, fx -10 dB; master of bed -20 LUFS-S when a hero hit and VO share the track (so +4.5 over bed fits under the -14 LUFS-I program), else -15 LUFS-S solo.
- **Seamless loops**: render three times and keep the middle (the wrap-around trick): tails wrap over the seam.
- **Key and logo link**: the bed key equals the project key; `logo` tonic is the bed tonic; final chord of the bed = the logo's chord.

### 8.3 Genre/mood presets (`music/presets.py`)

BPM ranges are rule-of-thumb for each style, not measurements.

| Preset | BPM (default) | Key/scale | Palette | Use |
|---|---|---|---|---|
| `tech_pulse` | 110-124 (118 -> snap) | A minor/major mix, dorian | soft kick, plucks, pad, sub | launch films, SaaS ads |
| `uplift_corporate` | 100-120 (112.5) | A/C/D major | keys, pluck arp, shaker, claps | product ads, explainers |
| `hype_house` | 124-130 (128.57) | F# minor | four-floor kick, offbeat hats, saw stabs, riser | beat edits, sports/fashion |
| `trap_half` | 130-150 played half-time (e.g. 140 felt as 70) | minor | 808, hat rolls (32nd), clap | beat edits, edgy hooks |
| `cinematic_drone` | 60-90 (75) | A minor, pedal tone | drones, sub hits, bowed pad (saw LP), reverse cymbals | short films, trailers |
| `playful_bounce` | 118-140 (120) | C/G major pentatonic | pizzicato, marimba, woodblock, cowbell, shaker | mime-style, kids, comedy |
| `lofi_warm` | 70-90 (75) | dorian | keys, vinyl crackle grain, soft kick, brush hat | talking-head beds, study |
| `desi_bounce` | 96-110 (100) | mixolydian/major | synth dhol-like drum, shaker, plucks | India-market ads (our own synthesis, no sample imitation) |
| `suspense_tick` | 90-100 | chromatic cluster | clock tick (1 per beat), drone, heartbeat riser | thriller/curiosity hooks |
| `anthem_build` | 100 -> 128 accelerando | major | snare roll, clap, brass stab | finale/CTA |

### 8.4 Stingers vs beds vs logos (where each sits)

- Bed: long (15-60 s), continuous, -20 LUFS-S under hits.
- Stinger: 0.6-3 s punctuation placed on a phrase boundary, tonal in the bed's key.
- Logo: the closing signature (1.2-2.5 s).
- A "button" (final hit) falls on the downbeat of the last bar; the bed's tail rings out, not a fade-out (fades read as "the clip ended", ring-outs read as "designed"); exception: loops.

---

## 9. Verification (acceptance tests for every sound component)

Run by `sound/tests/run.py`; all must pass before a component is marked done. Mirror the numbers in the manifest.

| Check | Pass condition |
|---|---|
| Determinism | two renders with the same (params, seed) have equal SHA-256 |
| Finite, no clipping | `isfinite(x).all()`, sample peak <= 1.0 before the library normalisation |
| DC offset | `abs(mean(x)) < 1e-4` per channel |
| Edges | first 0.5 ms and last 5 ms below -60 dBFS unless the cue is designed to start/stop hard (then a 2 ms ramp is applied by the placer) |
| Anchor (timed cues) | the sample peak index equals `anchor` (error 0 samples for tonal crests; noise peaks within +-1 ms; scatter exempt) |
| Sub content | energy below 28 Hz at least 40 dB under total; sub mono (L-R energy below 120 Hz at least 20 dB under the mid) |
| Spectral centroid | within the family's declared range (e.g. `whoosh_m` 1-3 kHz) to catch broken filters |
| Duration | within +-10% of the declared |
| Loudness stats | LUFS-M max, LUFS-S, TP, crest recorded; TP of the normalised one-shot <= -3 dBTP |
| Variation | two seeds produce correlation < 0.6 (not identical takes) |
| Loop (ambience/bed) | wrap discontinuity (|x[0] - x[-1]| and slope jump) below 1e-3 and no audible notch (spectral flux at the seam < 1.5x median) |
| Ducking | measured bed gain during voice = target depth +-0.5 dB; recovery within release x 3 |
| Master | I -14.0 +-0.1 (WAV), AAC probe I within +-0.5, TP <= -1.5, last 0.15 s zero, phone check passes |
| Cross-meter | python vs `ffmpeg ebur128` I within 0.1 LU, TP within 0.2 dB |

Listening checks (human, once per new family): solo, in context over the bed, on `phone_voice`, and with the picture; record one
line in the README entry (what it is good for, what it fights).

---

## 10. Integration with HyperFrames 0.8.142 and the three.js kit

**Mode A (default, measured): offline master.** The scene's timeline JSON (frames) is turned into a cue sheet
`cues/<project>.json`: `[{id: "snd.hit.thud", frame: 120, tier: 2, bus: "hits", gain_db: 0, pan: 0, seed: 7, params: {...}}, ...]`
(`frame` = the VISUAL frame, per the v9 convention; the placer adds the one-frame delay). `place.py` renders stems (bed, hits, vo),
`solve.py` sets trims to the over-bed table, `master.py` writes `master.wav`; the composition has one `<audio src="master.wav">`
track starting at 0. Deterministic and measured. The cue sheet can be written by hand, by a script from a motion timeline, or by
`grid.cut_map`.

**Mode B (quick): HyperFrames-native.** Each one-shot is an `<audio>` clip with `data-start` (seconds = (F+1)/fps), the library
WAV as `src`; the bed is a clip with `data-fx-chain` / `data-automation` for ducking (or `<hf-audio-group>` for submix buses);
`scripts/carve.mjs` for voiceover carve. Constant `data-playback-rate` (0.1..10) is render-safe for matching audio/video, and a
rate lane in `data-automation` gives speed ramps with pitch preserved. Convenience only: no over-bed solving, so use it for drafts.

**three.js kit and shaders.** Visual events publish a timeline of named events `{t_frame, kind, energy, pos}` (kind = hit,
transition, ui, text-word); `sound/mix/from_events.py` maps `kind` to a sweetener (section 4.10 table) and writes the cue sheet.
So a transition component in the visual kit (whip, glitch, zoom, flash) carries its own `sound: "snd.whoosh.whoosh_m"` metadata
and the audio follows automatically. Whoosh pan comes from the 3D object's screen x.

**Seek-safety.** Audio is a baked file, so previews and re-renders never drift. Only cue frames come from the timeline; to change a
timing, rebuild the master (it takes seconds).

---

## 11. Build order and effort (for the sound builder; priority 1 first)

1. P1 `core/dsp.py` + `core/grid.py` + `mix/measure.py` (port from sfx9 and the BS.1770 meter) and tests. Then `place.py`, `solve.py`, `master.py` generalised from mix9. [reuse-heavy]
2. P1 `sfx/whoosh.py`, `impacts.py`, `risers.py`, `ui.py` (sections 4.1-4.4): the eight most-used families; port v9 voices as `source:v9`.
3. P1 `sfx/transitions.py` + `from_events.py` (section 4.10 table): this is what makes motion components "come with sound".
4. P2 `music/drums.py`, `harmony.py`, `compose.py`, `presets.py`, `logo.py` (sections 4.9, 4.11, 8). The demo: a 20 s beat-edit bed + logo at -14 LUFS, three structure templates.
5. P2 `sfx/cartoon.py`, `voices.py`, `liquid.py`, materials in 4.5 (mime-style spots, product ads).
6. P3 `ambience.py`, `stingers.py`, voice chain, loop render, `bundles/*.json`.
7. P3 library manifest + README entries + the demo reel `demo_sfx_reel.py` (<= 20 s; all families once; short and small) + the platform upload test notes.
Disk: library cache as FLAC about 10-15 MB; demo master 24-bit 20 s stereo about 5.8 MB WAV.

README entry template per component (required by the pack rules): one line what, tags, params with defaults, demo command, measured
stats (peak/TP/LUFS-M/centroid/duration), listening note.

Tag vocabulary (for manifest and search): size:{xs,s,m,l,xl}, tier:{1,2,3}, family:{whoosh,hit,riser,ui,glass,metal,wood,paper,cloth,
liquid,cartoon,voice,amb,stinger,logo,drum,music,transition,gag}, mood:{tech,playful,cinematic,tense,warm,comic}, tonal:{yes,no},
anchor:{crest,noise,scatter}, use:{launch,ad,short_film,mime,beat_edit,talking_head,loop}, source:{v9,new}.

---

## 12. Sources and evidence grades

Grades: A = primary/official page retrieved this session; B = consistent secondary sources retrieved this session or a standards
body page; C = standard textbook/practice knowledge from memory (not retrieved this session); D = vendor/blog claims that
conflict or cite nothing; treat as unverified.

Loudness and levels
- Spotify, "Loudness normalization on Spotify" (A): https://support.spotify.com/artists/article/loudness-normalization/ (fetched: -14 LUFS, TP -1 dB lossy, -2 dB if louder, Loud -11 / Normal -14 / Quiet -19, limiter 5 ms/100 ms).
- YouTube normalisation behaviour (B): Production Advice, "Stats for Nerds": https://productionadvice.co.uk/stats-for-nerds/ ; Frame.io workflow guide: https://workflow.frame.io/guide/loudness-for-youtube . YouTube's own help page was not retrieved.
- EBU R128 (-23 LUFS) and streaming supplement R128 s2 (B): https://tech.ebu.ch/loudness , https://knowledgehub.ebu.ch/files/live/sites/tech/files/shared/r/r128s2v1_0.pdf ; tolerance figures differ across pages (+-0.5 vs +-0.2 LU): check the current document before a broadcast delivery.
- AES TD1004 (2015) streaming recommendation and its supersession by TD1008 (B): https://www.production-expert.com/production-expert-1/aes-update-loudness-recommendations-for-audio-only-streaming
- ITU-R BT.1359-1 / EBU R37 / ATSC audio-video sync windows (B-, secondary only): https://www.forasoft.com/learn/audio-for-video/articles-audio/lip-sync-itu-r-bt-1359-tolerance-windows , https://tech.ebu.ch/publications/r037 , https://www.tvtechnology.com/opinions/av-synchronization-how-bad-is-bad . The BT.1359 sign convention differs between sources; the "audio late is less detectable than audio early" direction is consistent. Primary PDFs were not read.
- Instagram / TikTok / X / LinkedIn loudness (D): no official spec found. Third-party claims reviewed: https://cutscore.io/blog/loudness-for-instagram-reels , https://onloopin.com/blog/mastering-for-instagram-and-reels , https://openclip.app/learn/audio-normalization , https://opus.pro/blog/best-loudness-normalizers (claims -12..-10 for Instagram/TikTok; contradicts the -14 majority), https://www.boyamic.com/blogs/wireless-mic-gain-for-youtube-tiktok (-13 LUFS TikTok/Reels). The "-14 LUFS, -1 dBTP, LRA 11" set that circulates as a social spec traces to a code comment in an open-source video tool, not to the platforms. Decision: house -14 / -1.5 plus an empirical upload test.
- BS.1770 K-weighting, gating and 4x true-peak: implemented in our meter; standard text not re-read (C).
- Netflix and ATSC A/85 numbers in the platform table (C): from memory, flagged for verification.

Synthesis
- Farnell, "Designing Sound" (MIT Press, 2010): procedural-audio approach, sound as process (C; book not read this session; the whoosh recipe above is standard practice: band-passed noise, swept resonant filter, amplitude envelope; I did not find it quoted).
- Modal synthesis for impact sounds, perceptual evaluation: https://www.smc2019.uma.es/articles/P1/P1_05_SMC2019_paper.pdf (B; confirms modal filter-bank synthesis is perceptually competitive with recordings).
- van den Doel, "Physically based models for liquid sounds" (2005; ACM Trans. Applied Perception) (C): bubble resonance, damping `d = 0.043 f0 + 0.0014 f0^1.5`, rising frequency. Formula from memory; tune by ear.
- Minnaert bubble resonance f ~ 3.26 / r Hz (C; standard acoustics).
- Chowning, "The synthesis of complex audio spectra by means of frequency modulation" (1973) (C): FM bell with 1:1.4 ratio and decaying index.
- Peterson and Barney (1952) vowel formants (C): values quoted are the commonly reproduced male averages; I did not re-check the table.
- Karplus-Strong (1983), Rosenberg glottal pulse (1971), Klatt cascade/parallel formant synthesis (1980) (C).
- Bjorklund / Toussaint, Euclidean rhythms (2005) (C).
- Shepard (1964) and Risset glissando (C).
- Roland TR-808 hi-hat oscillator ratios 205.3, 304.4, 369.6, 522.7, 540, 800 Hz (C: widely documented circuit analysis; the list is a published design, we only use the ratios as our own synthesis).
- gl-transitions (visual transition shaders) are cited only as inspiration for the visual-sweetener pairing table; nothing vendored or downloaded.

Internal evidence (A, local)
- v9 launch-film scripts (`sfx9.py`, `voices9.py`, `mix9.py`, `mix8.py`), the BS.1770 meter script and the Web Audio score engine: the hit contract, over-bed band 3..6 dB, limiter budget 1.5 dB, -14 LUFS-I with <= -1.5 dBTP on WAV and AAC probes, phone voicing, silent tail 0.15 s.
- `hyperframes-audio` SKILL.md and references (attributes, presets, fx-registry): effect chain, automation, carve, group bus, speed ramp lane.

Open questions the builder should close (in order of value)
1. Platform upload test (section 5.3) to replace the D-grade rows: one 20 s clip at -14 and one at -10 LUFS-I, upload privately to Instagram, TikTok, X, LinkedIn, compare in-app playback loudness on a phone.
2. Listening pass for the `voice.babble` formant engine and `cartoon.boing`; the numbers here are theory-derived and may need retuning.
3. Confirm HyperFrames 0.8.142 mode B attribute names against `hyperframes-audio/references/attributes.md` before writing the integration helper.
