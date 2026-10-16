"""motion-pack / music / presets.py : genre / mood presets and structure templates.
BPM ranges are rules of thumb for each style (docs/research/sound.md section 8.3), not measurements. All keys default to A (the pack's house key); change `key` to retune."""

PRESETS = {
    "tech_pulse": dict(bpm=118, key=9, scale="dorian", prog="tech", drums="four_floor_soft", bass="saw", harmony="pad+pluck", lead="lead", swing=0.0, humanize=0, pump=True, lead_at=0.85,
                       loop_energy=0.8, mood=["tech", "confident"], use=["launch", "ad"], desc="soft four-on-the-floor, plucks, pad, sub; SaaS and launch films"),
    "uplift_corporate": dict(bpm=112.5, key=9, scale="major", prog="uplift", drums="clap_shaker", bass="sub", harmony="keys+pluck", lead="bell", swing=0.0, humanize=0, pump=False, lead_at=0.85,
                             loop_energy=0.75, mood=["warm", "optimistic"], use=["ad", "talking_head", "launch"], desc="keys, pluck arp, shaker, claps; product ads and explainers"),
    "hype_house": dict(bpm=128, key=6, scale="minor", prog="tension", drums="four_floor", bass="saw", harmony="stab", lead="lead", swing=0.0, humanize=0, pump=True, lead_at=0.85,
                       loop_energy=0.95, mood=["hype", "tension"], use=["beat_edit", "ad"], desc="four-floor kick, offbeat hats, saw stabs; beat edits (F# minor)"),
    "trap_half": dict(bpm=140, key=9, scale="minor", prog="cinematic", drums="half_time", bass="808", harmony="pad", lead="bell", swing=0.0, humanize=0, pump=False, lead_at=0.85,
                      loop_energy=0.85, mood=["edgy", "hype"], use=["beat_edit"], desc="half-time trap feel: 808, hat rolls, clap; beat edits and edgy hooks"),
    "cinematic_drone": dict(bpm=75, key=9, scale="minor", prog="pedal", drums="cinema", bass="drone", harmony="pad", lead="none", swing=0.0, humanize=0, pump=False, lead_at=2.0,
                            loop_energy=0.6, mood=["cinematic", "tense"], use=["short_film", "launch"], desc="drones, sub hits, toms, reverse cymbals; short films and trailers"),
    "playful_bounce": dict(bpm=120, key=9, scale="pent_major", prog="comedic", drums="bounce", bass="pizz", harmony="marimba", lead="marimba", swing=0.08, humanize=3, pump=False, lead_at=0.7,
                           loop_energy=0.8, mood=["playful", "comic"], use=["mime", "ad"], desc="pizzicato, marimba, woodblock, cowbell; mime-style character spots"),
    "lofi_warm": dict(bpm=75, key=9, scale="dorian", prog="uplift", drums="lofi", bass="sub", harmony="keys", lead="keys", swing=0.12, humanize=4, pump=False, lead_at=0.9,
                      loop_energy=0.6, mood=["warm", "calm"], use=["talking_head", "short_film"], desc="soft keys, brushed hats, mellow kick; talking-head beds"),
    "desi_bounce": dict(bpm=100, key=9, scale="mixolydian", prog="comedic", drums="desi", bass="pluck", harmony="pluck", lead="bell", swing=0.05, humanize=2, pump=False, lead_at=0.8,
                        loop_energy=0.85, mood=["playful", "warm"], use=["ad", "mime"], desc="own-synthesis hand-drum groove, shaker, plucks; India-market ads (no sample imitation)"),
    "suspense_tick": dict(bpm=95, key=9, scale="harmonic_minor", prog="tension2", drums="tick", bass="drone", harmony="cluster", lead="none", swing=0.0, humanize=0, pump=False, lead_at=2.0,
                          loop_energy=0.6, mood=["tense", "curiosity"], use=["short_film", "ad"], desc="clock tick per beat, drone, heartbeat; thriller and curiosity hooks"),
    "anthem_build": dict(bpm=120, key=9, scale="major", prog="uplift", drums="four_floor", bass="saw", harmony="stab", lead="lead", swing=0.0, humanize=0, pump=True, lead_at=0.7,
                         loop_energy=0.9, mood=["triumphant"], use=["launch", "ad"], desc="snare-roll builds, claps, brass-like stabs; finales and CTA"),
}

PROGRESSIONS = {
    "uplift": ["I", "V", "vi", "IV"], "uplift2": ["I", "vi", "IV", "V"], "tech": ["vi", "IV", "I", "V"], "tech2": ["I", "IV", "vi", "V"],
    "tension": ["i", "VI", "III", "VII"], "tension2": ["i", "iv", "VII", "VI"], "cinematic": ["i", "VI", "VII", "i"], "pedal": ["I", "I", "IV", "I"],
    "comedic": ["I", "vi", "ii", "V"], "comedic2": ["I", "bVII", "IV", "I"],
}

# structure templates: (name, bars, energy) ; energy may be (e0, e1) = linear ramp across the section
STRUCTURES = {
    "loop_8": [("loop", 8, None)],                              # energy = preset loop_energy
    "ad_30s": [("intro", 1, 0.25), ("build", 3, 0.55), ("drop", 5, 1.0), ("break", 1, 0.4), ("final", 4, 0.85), ("tail", 1, 0.15)],       # 15 bars = 30.0 s at 120 BPM
    "reel_15s": [("hook", 1, 1.0), ("verse", 2, 0.55), ("build", 1, (0.6, 0.85)), ("drop", 3, 1.0), ("tail", 1, 0.2)],                       # 8 bars ~ 14.9 s at 128.57 BPM
    "cine_60s": [("drone", 4, 0.1), ("rise", 4, (0.2, 0.5)), ("swell", 4, 0.6), ("peak", 4, 0.9), ("fall", 3, 0.3)],                         # 19 bars ~ 60.8 s at 75 BPM
    "cine_30s": [("drone", 2, 0.1), ("rise", 2, (0.2, 0.5)), ("swell", 2, 0.6), ("peak", 2, 0.9), ("fall", 2, 0.3)],                                  # 10 bars = 32 s at 75 BPM
    "hook_6s": [("hit", 1, 1.0), ("tail", 1, 0.4)],
}

TRIMS_DB = {"drums": 0.0, "bass": -2.0, "harmony": -6.0, "lead": -4.0, "fx": -10.0}   # stem balance (relative loudness), docs/research/sound.md 8.2

# ------------------------------------------------------------------------------------------------------------------------------------------------
# 2026-10-13 expansion: data-driven drum patterns (drums="pattern": rows of (voice, 16th steps over pat_bars bars, vel, gain, min energy[, pan])).
# Voices: the kit names above plus t_<bol> (tabla: na tin tun te ge ka dha dhin tirakita), dholak_dha, dholak_ge, manjira, ghungroo, nagara, taiko, ride,
# brush_snare, chip_kick, chip_snare, chip_hat. tuning="ji": Hindustani just intonation relative to Sa (= key). swing8: 8th-note swing. sevenths: 7th chords.
PROGRESSIONS.update({"jazz": ["ii", "V", "I", "vi"], "jazz_minor": ["i", "iv", "VII", "III"], "folk": ["I", "IV", "I", "V"], "doc": ["I", "iii", "IV", "vi"],
                     "epic": ["i", "VI", "III", "VII"], "raga_pedal": ["I", "I", "I", "I"]})
_E8 = list(range(0, 16, 2))
_E16 = list(range(16))
PRESETS.update({
    "indian_fusion": dict(bpm=96, key=9, scale="raga_khamaj", tuning="ji", prog="comedic2", drums="pattern", pat_bars=2, fill="t_tirakita",
                          drum_pat=[("t_dha", [0], 1.0, 0.9, 0.3), ("t_ge", [4], 0.8, 0.8, 0.3), ("t_na", [8, 16, 28], 0.9, 0.8, 0.3), ("t_te", [12], 0.8, 0.8, 0.3),
                                    ("t_ka", [20], 0.8, 0.8, 0.3), ("t_dhin", [24], 0.9, 0.9, 0.3), ("t_te", [2, 10, 18, 26], 0.5, 0.45, 0.7), ("manjira", [0], 0.5, 0.35, 0.8, 0.4)],
                          bass="sub", harmony="tanpura+pad", lead="sitar", swing=0.0, humanize=3, pump=False, lead_at=0.75, loop_energy=0.85,
                          mood=["warm", "festive"], use=["ad", "short_film", "launch"], desc="keherwa tabla theka, tanpura plucks, soft pad, sitar motif (khamaj, just intonation); India-market ads"),
    "bhangra_hype": dict(bpm=112.5, key=9, scale="mixolydian", tuning="ji", prog="comedic2", drums="pattern",
                         drum_pat=[("dhol", [0, 6, 8, 14], 1.0, 1.0, 0.4), ("dhol_rim", [3, 4, 10, 12, 15], 0.8, 0.8, 0.4), ("dhol_rim", [1, 7, 9], 0.45, 0.6, 0.85),
                                   ("clap", [4, 12], 0.9, 0.6, 0.7), ("shaker", _E8, 0.6, 0.5, 0.3)],
                         bass="saw", harmony="harmonium", lead="pluck", swing=0.0, humanize=2, pump=False, lead_at=0.8, loop_energy=0.95,
                         mood=["hype", "festive"], use=["ad", "beat_edit", "mime"], desc="dhol chaal (own synthesis), claps, harmonium, high plucked riff; celebratory India-market hype"),
    "raga_calm": dict(bpm=70, key=9, scale="raga_yaman", tuning="ji", prog="raga_pedal", drums="pattern", pat_bars=2,
                      drum_pat=[("t_tun", [0], 0.7, 0.6, 0.5), ("t_ge", [8, 24], 0.5, 0.45, 0.5), ("t_na", [12, 28], 0.5, 0.4, 0.55)],
                      bass="drone", harmony="tanpura", lead="bansuri", swing=0.0, humanize=4, pump=False, lead_at=0.5, loop_energy=0.6,
                      mood=["calm", "warm"], use=["short_film", "talking_head"], desc="tanpura cycle, bansuri-like flute phrases in yaman (just intonation), sparse tabla"),
    "festive_dhol": dict(bpm=128, key=9, scale="raga_bilawal", tuning="ji", prog="uplift", drums="pattern",
                         drum_pat=[("dholak_dha", [0, 8], 1.0, 0.9, 0.3), ("dholak_ge", [3, 6, 11, 14], 0.8, 0.8, 0.3), ("manjira", [4, 12], 0.6, 0.35, 0.5, 0.3),
                                   ("nagara", [0], 1.0, 0.7, 0.85), ("dhol_rim", _E16, 0.35, 0.35, 0.95), ("ghungroo", [2, 10], 0.5, 0.3, 0.7, -0.4)],
                         bass="sub", harmony="harmonium", lead="shehnai", swing=0.0, humanize=2, pump=False, lead_at=0.75, loop_energy=0.95,
                         mood=["festive", "hype"], use=["ad", "launch", "mime"], desc="dholak groove, manjira, nagara accents, harmonium, shehnai-like lead; festival / wedding energy"),
    "lofi_jazz": dict(bpm=82, key=2, scale="dorian", prog="jazz_minor", sevenths=True, swing8=0.6, drums="pattern",
                      drum_pat=[("kick_soft", [0, 7, 10], 0.9, 0.9, 0.3), ("brush_snare", [4, 12], 0.8, 0.8, 0.45), ("hat", _E8, 0.5, 0.4, 0.3)],
                      bass="upright", bass_steps=[0, 7, 10], harmony="keys", lead="keys", swing=0.0, humanize=6, pump=False, lead_at=0.9, loop_energy=0.65,
                      mood=["calm", "warm"], use=["talking_head", "short_film"], desc="swung lo-fi: 7th chords on soft keys, upright bass, brushed snare (D dorian)"),
    "synthwave": dict(bpm=100, key=9, scale="minor", prog="epic", drums="pattern",
                      drum_pat=[("kick", [0, 8], 1.0, 1.0, 0.35), ("snare", [4, 12], 1.0, 0.9, 0.45), ("clap", [4, 12], 0.7, 0.5, 0.7), ("hat", _E8, 0.6, 0.45, 0.3),
                                ("tom", [13, 14, 15], 0.6, 0.5, 0.9)],
                      bass="saw", bass_steps=_E8, harmony="synthpad", lead="lead", swing=0.0, humanize=0, pump=False, lead_at=0.8, loop_energy=0.85,
                      mood=["retro", "confident"], use=["launch", "ad", "beat_edit"], desc="retro 80s-style drive: 8th-note saw bass, wide detuned pad, gated-style snare"),
    "deep_house": dict(bpm=122, key=2, scale="minor", prog="tension2", sevenths=True, drums="pattern",
                       drum_pat=[("kick", [0, 4, 8, 12], 1.0, 1.0, 0.35), ("clap", [4, 12], 0.8, 0.6, 0.55), ("hat", [2, 6, 10, 14], 0.8, 0.55, 0.3),
                                 ("shaker", _E16, 0.4, 0.3, 0.8), ("rim", [3, 11], 0.6, 0.5, 0.65)],
                       bass="sub", bass_steps=[2, 6, 10, 14], harmony="keys", lead="none", swing=0.0, humanize=0, pump=True, lead_at=2.0, loop_energy=0.85,
                       mood=["tech", "calm"], use=["ad", "launch", "talking_head"], desc="deep-house variant: minor 7th keys, offbeat sub, four-floor, shaker 16ths (D minor)"),
    "dnb_170": dict(bpm=170, key=9, scale="minor", prog="cinematic", drums="pattern",
                    drum_pat=[("kick", [0, 10], 1.0, 1.0, 0.35), ("snare", [4, 12], 1.0, 0.95, 0.4), ("snare_soft", [7, 14], 0.5, 0.4, 0.75), ("hat", _E8, 0.7, 0.45, 0.3),
                              ("hat_o", [6], 0.5, 0.35, 0.85)],
                    bass="saw", bass_steps=[0, 3, 10], harmony="pad", lead="bell", swing=0.0, humanize=0, pump=False, lead_at=0.85, loop_energy=0.9,
                    mood=["hype", "tech"], use=["beat_edit", "ad"], desc="drum & bass two-step at the frame-snapped 163.6 BPM (170 requested), saw bass, pad"),
    "ambient_pad": dict(bpm=60, key=9, scale="lydian", prog="pedal", drums="pattern", drum_pat=[], bass="drone", harmony="synthpad", lead="bell", swing=0.0, humanize=0,
                        pump=False, lead_at=0.55, loop_energy=0.6, mood=["calm", "cinematic"], use=["short_film", "talking_head", "launch"], desc="no drums: slow wide pad, drone, sparse bell motif (A lydian)"),
    "chiptune_8bit": dict(bpm=150, key=9, scale="major", prog="uplift2", drums="pattern",
                          drum_pat=[("chip_kick", [0, 8], 1.0, 0.9, 0.3), ("chip_snare", [4, 12], 1.0, 0.8, 0.4), ("chip_hat", _E8, 0.7, 0.5, 0.3)],
                          bass="chip", harmony="chip_arp", lead="chip", swing=0.0, humanize=0, pump=False, lead_at=0.75, loop_energy=0.9,
                          mood=["playful", "retro"], use=["mime", "ad", "beat_edit"], desc="8-bit: naive square lead / bass, 50 Hz chord arps, noise drums; original melody (Content ID safe by construction)"),
    "acoustic_folk_pluck": dict(bpm=100, key=9, scale="major", prog="folk", drums="pattern",
                                drum_pat=[("kick_soft", [0, 8], 0.9, 0.8, 0.35), ("shaker", _E8, 0.6, 0.5, 0.3), ("clap", [4, 12], 0.8, 0.5, 0.7)],
                                bass="upright", harmony="guitar", lead="pluck", swing=0.0, humanize=5, pump=False, lead_at=0.8, loop_energy=0.8,
                                mood=["warm", "optimistic"], use=["ad", "talking_head", "short_film"], desc="strummed Karplus-Strong guitar, plucked melody, hand claps, upright bass"),
    "documentary_marimba": dict(bpm=90, key=9, scale="lydian", prog="doc", drums="pattern",
                                drum_pat=[("shaker", _E16, 0.4, 0.35, 0.3), ("rim", [4, 12], 0.6, 0.5, 0.45), ("kick_soft", [0], 0.8, 0.7, 0.4)],
                                bass="sub", harmony="marimba+pad", lead="bell", swing=0.0, humanize=3, pump=False, lead_at=0.75, loop_energy=0.75,
                                mood=["curiosity", "optimistic"], use=["talking_head", "ad", "short_film"], desc="curious explainer / documentary: marimba ostinato over a soft pad, light shaker"),
    "orchestral_synth_epic": dict(bpm=90, key=9, scale="minor", prog="epic", drums="pattern",
                                  drum_pat=[("taiko", [0, 6, 8], 1.0, 0.9, 0.45), ("taiko", [11, 14, 15], 0.7, 0.7, 0.85), ("tom", [12, 13], 0.6, 0.6, 0.7), ("crash", [0], 0.6, 0.4, 0.95)],
                                  bass="saw", harmony="strings+stab", lead="brass", swing=0.0, humanize=0, pump=False, lead_at=0.8, loop_energy=0.9,
                                  mood=["cinematic", "triumphant"], use=["launch", "short_film", "ad"], desc="trailer-style: taiko ostinato, string ensemble, brass-like stabs and lead"),
    "jazz_walk": dict(bpm=135, key=5, scale="major", prog="jazz", sevenths=True, swing8=0.67, drums="pattern",
                      drum_pat=[("ride", [0, 4, 6, 8, 12, 14], 0.5, 0.22, 0.3), ("hat", [4, 12], 0.5, 0.25, 0.3), ("brush_snare", [10], 0.4, 0.35, 0.7), ("kick_soft", [0, 4, 8, 12], 0.45, 0.5, 0.3)],
                      bass="walk", harmony="keys", lead="keys", swing=0.0, humanize=6, pump=False, lead_at=0.85, loop_energy=0.8,
                      mood=["playful", "warm"], use=["talking_head", "short_film", "mime"], desc="jazz trio feel: walking upright bass, swung ride, 7th-chord comping (F major ii-V-I-vi)"),
    "comedy_pizzicato": dict(bpm=130, key=2, scale="major", prog="comedic", drums="pattern",
                             drum_pat=[("kick_soft", [0, 8], 0.8, 0.7, 0.35), ("rim", [4, 12], 0.8, 0.7, 0.45), ("tom", [14], 0.6, 0.5, 0.75)],
                             bass="pizz", harmony="marimba", lead="pizz", swing=0.0, humanize=2, pump=False, lead_at=0.7, loop_energy=0.85,
                             mood=["comic", "playful"], use=["mime", "ad", "talking_head"], desc="sneaky comedy: pizzicato bass and melody, marimba, rim clicks (D major)"),
    "corporate_bright": dict(bpm=118, key=4, scale="major", prog="uplift2", drums="pattern",
                             drum_pat=[("kick_soft", [0, 8, 10], 0.9, 0.8, 0.35), ("clap", [4, 12], 0.8, 0.6, 0.6), ("hat", _E8, 0.6, 0.45, 0.3), ("shaker", _E16, 0.35, 0.3, 0.75)],
                             bass="sub", harmony="guitar+synthpad", lead="bell", swing=0.0, humanize=0, pump=False, lead_at=0.8, loop_energy=0.8,
                             mood=["optimistic", "warm"], use=["ad", "talking_head", "launch"], desc="bright corporate: strummed guitar, airy pad, claps, bell hook (E major)"),
    "suspense_pulse": dict(bpm=100, key=9, scale="harmonic_minor", prog="tension2", drums="pattern",
                           drum_pat=[("tick", _E16, 0.35, 0.4, 0.3), ("kick_sub", [0], 0.8, 0.8, 0.45), ("taiko", [0], 0.8, 0.6, 0.85)],
                           bass="saw", bass_steps=_E8, harmony="strings", trem_hz=10.0, lead="none", swing=0.0, humanize=0, pump=False, lead_at=2.0, loop_energy=0.7,
                           mood=["tense", "curiosity"], use=["short_film", "ad"], desc="suspense: 8th-note saw ostinato, tremolo strings, 16th ticks, sub hits"),
    "anthem_ramp": dict(PRESETS["anthem_build"], ramp=(100, 128), desc="anthem_build with a frame-exact tempo ramp 100 -> 128 BPM (per-bar whole-frame beats); finales and CTA"),
})
STRUCTURES.update({
    "cold_open_3s": [("hook", 1, 1.0), ("tail", 1, 0.2)],              # 2 bars: 3.0 s at 160 BPM, 4.0 s at 120 (pick a fast preset or trim)
    "explainer_60s": [("intro", 2, 0.3), ("verse", 8, 0.55), ("lift", 4, (0.6, 0.8)), ("main", 10, 0.85), ("break", 2, 0.4), ("outro", 3, 0.75), ("tail", 1, 0.15)],   # 30 bars = 60 s at 120 BPM
    "sting_only": [("hit", 1, 1.0), ("tail", 1, 0.15)],
    "outro_8s": [("final", 3, 0.8), ("tail", 1, 0.15)],                 # 4 bars = 8.0 s at 120 BPM
    "anthem_ramp_16": [("intro", 2, 0.35), ("build", 6, (0.45, 0.85)), ("drop", 6, 1.0), ("final", 1, 0.8), ("tail", 1, 0.15)],
})

# ------------------------------------------------------------------------------------------------------------------------------------------------
# 2026-10-14: trailer arc (music/trailer.py, NOT a loop and NOT in PRESETS, so no 8-bar loop bed is built from it). Every marker is a whole number of BEATS,
# so with the tempo snap (one beat = whole frames) every marker is a whole frame at any fps. Length rule: change act_bars (whole bars, acts 1-3 only, before the
# gap); the gap, crescendo, hit and hold keep their beat lengths. Shape (round-4/5 trailer study, craft only): quiet act 1, rising act 2, sustained wall,
# ONE near-silent valley of 2-4 s (sub only), crescendo, title hit with a hard stop, quiet hold.
TRAILERS = {
    "trailer_arc": dict(bpm=120, key=9, scale="minor", act_bars=(4, 4, 4), gap_beats=6, cresc_bars=2, ring_beats=3, hold_beats=7,
                        prog_act1=["i", "i", "i", "i"], prog_act2=["i", "III", "iv", "V"], prog_act3=["i", "VI", "III", "VII"], prog_cresc=["VI", "V"],
                        gap_below_wall_db=38.0, mood=["cinematic", "hype", "tense"], use=["launch", "ad", "short_film"],
                        desc="trailer arc: low drone + sub pulse, rising 16th ostinato, full wall (taiko, strings, brass), a 3 s sub-only valley, "
                             "a 2-bar crescendo, a title hit with a hard stop, a quiet hold; markers in the sidecar"),
}
# 2026-10-16 film lane: genre trailer scores (music/trailer_styles.py). Same marker rule (whole beats), plus a button (post-title near-silence) and a tail
# (credit block + release card bed with a final hit). cresc_bars 0 = the title hit lands straight out of the silence. gap_below_wall_db >= 90 = digital silence.
# Fit a cut with trailer_styles.render_styled(style, act_bars=..., button_beats=..., tail_beats=...): templates/trailer does it from its plan.
TRAILERS.update({
    "trailer_thriller": dict(style="thriller", bpm=120, key=9, scale="minor", act_bars=(4, 4, 4), gap_beats=4, cresc_bars=0, ring_beats=6, button_beats=8, tail_beats=16,
                             final_hit_beat=8, prog_act1=["i", "i", "i", "i"], prog_act2=["i", "VI", "iv", "V"], prog_act3=["i", "VI", "III", "VII"], prog_cresc=["V"],
                             gap_below_wall_db=40.0, mood=["cinematic", "tense", "thriller"], use=["trailer", "short_film", "launch"],
                             desc="thriller trailer score: a ticking clock and a sub pulse, a 16th ostinato with braam stabs, a wall with a braam on every bar, a 2 s silence, "
                                  "the title hit straight out of it, a quiet button, a pulsing credits tail with a final hit"),
    "trailer_scifi": dict(style="scifi", bpm=100, key=9, scale="minor", act_bars=(4, 4, 4), gap_beats=4, cresc_bars=1, ring_beats=5, button_beats=8, tail_beats=16,
                          final_hit_beat=8, prog_act1=["i", "i", "i", "i"], prog_act2=["i", "III", "VII", "iv"], prog_act3=["i", "VI", "III", "VII"], prog_cresc=["V"],
                          gap_below_wall_db=40.0, mood=["cinematic", "cold", "scifi"], use=["trailer", "launch", "short_film"],
                          desc="sci-fi trailer score: a cold add9 pad and a glassy arpeggio, an 8th synth pulse, a wall of kicks, stabs and braams, a silence, a 1-bar crescendo, "
                               "a title hit with a glass bell, a credits tail"),
    "trailer_horror": dict(style="horror", bpm=80, key=9, scale="minor", act_bars=(4, 4, 4), gap_beats=4, cresc_bars=0, ring_beats=4, button_beats=8, tail_beats=12,
                           final_hit_beat=6, prog_act1=["i", "i", "i", "i"], prog_act2=["i", "i", "i", "i"], prog_act3=["i", "i", "i", "i"], prog_cresc=["i"],
                           gap_below_wall_db=120.0, mood=["cinematic", "dark", "horror"], use=["trailer", "short_film"],
                           desc="horror trailer score: a minor-second drone and a music-box line, a heartbeat and cluster swells, a wall of tremolo clusters and metal, "
                                "DIGITAL silence, the shock hit, a music-box tail"),
    "trailer_drama": dict(style="drama", bpm=84, key=9, scale="minor", act_bars=(4, 4, 4), gap_beats=4, cresc_bars=1, ring_beats=4, button_beats=8, tail_beats=12,
                          final_hit_beat=6, prog_act1=["i", "VI", "III", "VII"], prog_act2=["VI", "VII", "i", "V"], prog_act3=["i", "VI", "III", "VII"], prog_cresc=["V"],
                          gap_below_wall_db=40.0, mood=["cinematic", "warm", "drama"], use=["trailer", "short_film", "brand"],
                          desc="drama trailer score: a piano motif over a warm pad, strings and an 8th pulse join, a full string-and-brass wall with taiko, a silence, "
                               "a 1-bar crescendo, a warm title hit, a piano tail"),
})
