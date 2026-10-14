#!/usr/bin/env python3
"""Sound bundles: a named palette per video type, mapping CUE ROLES to library ids + a bed preset + mix numbers (docs/research/sound.md section 7).
`python3 bundles.py` validates every id against manifest.json / music/manifest.json and writes bundles.json (readable from JS / the skill)."""
import json
import os
HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLES = {
    "launch_film": {"desc": "launch / hype film: tiers 1-3, one hero hit per 8-10 s, end on logo + 0.15 s silence", "bed": ["tech_pulse", "anthem_build"], "bpm": [110, 124], "lufs": -14,
                    "roles": {"hero_hit": "snd.hit.cinema", "title_in": "snd.stinger.reveal", "scene_change": "snd.whoosh.whoosh_l", "transition": "snd.whoosh.whoosh_m", "build": "snd.riser.noise_2bar",
                              "drop": "snd.hit.stab", "after_hit": "snd.lift.down", "ui": "snd.ui.pop", "number": "snd.ui.count_run", "payoff": "snd.metal.ping", "logo": "snd.logo.hybrid", "ring": "snd.sparkle.shimmer"}},
    "mime_spot": {"desc": "wordless character comedy: one gag + one product feature, one sound per action beat, comic pause of 4-8 frames before the punchline", "bed": ["playful_bounce"], "bpm": [118, 140], "lufs": -14,
                    "roles": {"sneak": "snd.cartoon.tiptoe", "walk": "snd.cartoon.walk_bounce", "react_small": "snd.voice.chirp", "react_question": "snd.voice.huh", "react_surprise": "snd.voice.oh", "take": "snd.cartoon.pop_eye",
                              "hop": "snd.cartoon.slide_whistle_up", "fall": "snd.cartoon.slide_whistle_down", "slip": "snd.cartoon.slip", "hit": "snd.cartoon.bonk", "spring": "snd.cartoon.boing", "vanish": "snd.cartoon.poof",
                              "freeze": "snd.cartoon.record_scratch", "fail": "snd.cartoon.sad_brass", "win": "snd.stinger.win", "button": "snd.cartoon.rimshot", "gag_pause_frames": 6}},
    "beat_edit": {"desc": "music / beat-synced edits: cuts on beats, sfx on the off-beats, biggest visual on the drop", "bed": ["hype_house", "trap_half"], "bpm": [128, 150], "lufs": -14,
                  "roles": {"cut": "snd.tx.cut_tick", "accent": "snd.hit.punch", "zip": "snd.whoosh.zip", "whip": "snd.whoosh.whip_pan", "glitch": "snd.tx.glitch_stutter", "build": "snd.riser.supersaw_2bar", "snare_build": "snd.drum.snare_roll",
                            "drop": "snd.hit.low_thump", "crash": "snd.drum.crash", "after_drop": "snd.lift.down", "freeze": "snd.tx.freeze_hit"}},
    "talking_head": {"desc": "human / talking-head retention edit: voice first, sfx are punctuation 12-24 dB under the voice, no tier 1 except the end logo", "bed": ["lofi_warm", "uplift_corporate"], "bpm": [100, 120], "lufs": -14,
                     "roles": {"keyword_pop": "snd.ui.pop", "punch_in": "snd.tx.scale_punch", "jump_cut": "snd.tx.cut_tick", "broll_in": "snd.whoosh.swish_s", "broll_out": "snd.whoosh.swish_out", "stat": "snd.ui.count_run",
                              "list_item": "snd.ui.blip", "breath": "snd.lift.inhale", "interrupt": "snd.stinger.alert", "hook_word": "snd.hit.punch", "end_card": "snd.logo.hybrid", "room_tone": "snd.amb.room_tone"},
                     "levels_re_voice_db": {"keyword_pop": -14, "punch_in": -14, "jump_cut": -22, "broll_in": -18, "stat": -16, "list_item": -18, "interrupt": -16}},
    "short_film": {"desc": "animated / live short film: sound leads the cut (J/L), room tone under every shot, rare hero hit, LRA 10-15 LU, no whoosh transitions", "bed": ["cinematic_drone", "suspense_tick"], "bpm": [60, 95], "lufs": -14,
                   "roles": {"room": "snd.amb.room_tone", "night": "snd.amb.night", "rain": "snd.amb.rain", "wind": "snd.amb.wind", "drone": "snd.amb.tension_drone", "step": "snd.cloth.footstep", "door": "snd.wood.door_knock",
                             "creak": "snd.wood.creak", "paper": "snd.paper.rustle", "glass": "snd.glass.tap", "hit": "snd.hit.deep_impact", "scene_cut": "snd.hit.soft", "to_black": "snd.stinger.cut_to_black", "tension": "snd.riser.shepard"},
                   "master_note": "festival / broadcast master = -23 LUFS-I / -1 dBTP kept separate from the -14 social cut"},
    "product_ad": {"desc": "product ad: tactile micro-sounds locked to close-ups, logo 0.2 s after the last visual", "bed": ["uplift_corporate", "tech_pulse", "desi_bounce"], "bpm": [100, 120], "lufs": -14,
                   "roles": {"tap": "snd.ui.click", "toggle": "snd.ui.toggle_on", "success": "snd.ui.success", "pour": "snd.liquid.pour", "clink": "snd.glass.clink", "shutter": "snd.camera.shutter", "cash": "snd.cash.ka_ching",
                             "reveal": "snd.stinger.reveal", "build": "snd.riser.noise_1bar", "whoosh": "snd.whoosh.whoosh_m", "logo": "snd.logo.hybrid"}},
    "kinetic_type": {"desc": "kinetic typography: one sound per word appear, +3 dB on emphasised words, no sound on pure fades", "bed": ["tech_pulse"], "bpm": [118, 124], "lufs": -14,
                     "roles": {"word": "snd.ui.pop", "type": "snd.ui.type_key", "typing": "snd.ui.typing_burst", "swish": "snd.whoosh.swish_xs", "title_word": "snd.hit.punch", "cut": "snd.tx.cut_tick", "end": "snd.logo.hybrid"}},
    "loop_short": {"desc": "seamless social loop: audible event on frames 0-3, tail wraps into the first 300 ms, state-change loop", "bed": ["lofi_warm", "playful_bounce"], "bpm": [90, 128], "lufs": -14,
                   "roles": {"hook": "snd.hit.stab", "tick": "snd.ui.tick", "swell": "snd.tx.dissolve_pad", "wrap_ring": "snd.sparkle.shimmer"},
                   "notes": "use the loop8 beds (seamless); render the cue tail with circular placement or crossfade the master"},
    # 2026-10-13 expansion
    "india_festive": {"desc": "India-market ad / festive spot: tabla or dhol groove, one shehnai or sitar phrase, conch or temple bell only on the hero moment", "bed": ["indian_fusion", "festive_dhol", "bhangra_hype"],
                      "bpm": [95, 130], "lufs": -14,
                      "roles": {"hero_hit": "snd.indian.nagara_hit", "accent": "snd.indian.tabla_dha", "fill": "snd.indian.tabla_tirakita", "sparkle": "snd.indian.ghungroo", "phrase": "snd.indian.sitar_meend",
                                "call": "snd.indian.shehnai_note", "blessing": "snd.indian.ghanta_temple_bell", "announce": "snd.indian.shankh_conch", "clink": "snd.foley.chai_cup_clink",
                                "dhol_hit": "snd.indian.dhol_bhangra_hit", "plate": "snd.indian.thali_clang", "drone": "snd.amb.tanpura_drone", "street": "snd.amb.indian_street_horns", "logo": "snd.logo.hybrid"},
                      "notes": "music beds: music/bed_indian_fusion_loop8, bed_festive_dhol_loop8, bed_bhangra_dhol_loop, bed_tabla_keherwa_loop; sonic logo music/logo_sitar_orbit"},
    "voice_agent_demo": {"desc": "voice-assistant product demo / screen recording: mic on, listening loop under the waveform, think pulse, reply bloom; device sounds on every UI action", "bed": ["corporate_bright", "deep_house", "lofi_warm"],
                       "bpm": [110, 124], "lufs": -14,
                       "roles": {"mic_on": "snd.ui.mic_on", "listening": "snd.ui.listening_loop", "mic_off": "snd.ui.mic_off", "thinking": "snd.ui.ai_think_pulse", "reply": "snd.ui.ai_reply",
                                 "click": "snd.device.mouse_click", "type": "snd.device.keyboard_mech_soft", "notify": "snd.device.notify_soft", "sent": "snd.device.message_sent", "received": "snd.device.message_received",
                                 "progress": "snd.device.progress_fill", "success": "snd.device.achievement", "card": "snd.device.card_flip", "logo": "snd.logo.hybrid"},
                       "levels_re_voice_db": {"mic_on": -12, "listening": -24, "thinking": -16, "reply": -12, "click": -20, "type": -22}},
    "office_comedy": {"desc": "office short film / comedy series: foley on every contact, word-free crowd reactions, comic stings on the turn; room tone under every shot",
                      "bed": ["comedy_pizzicato", "jazz_walk", "documentary_marimba"], "bpm": [120, 140], "lufs": -14,
                      "roles": {"room": "snd.amb.room_tone", "office": "snd.amb.office", "murmur": "snd.amb.crowd_murmur", "step": "snd.foley.footstep_wood", "door_in": "snd.foley.door_open", "door_out": "snd.foley.door_close",
                                "chair": "snd.foley.chair_creak", "stamp": "snd.foley.stamp", "pen": "snd.foley.pen_click", "file": "snd.foley.book_thud", "drawer": "snd.foley.drawer", "chai": "snd.foley.chai_cup_clink",
                                "phone": "snd.device.phone_buzz", "laptop_shut": "snd.foley.laptop_close", "typing": "snd.device.keyboard_mech_clack", "laugh_turn": "snd.cartoon.surprise_sting",
                                "aww": "snd.crowd.aww_synth", "cheer": "snd.crowd.cheer_synth", "boo": "snd.crowd.boo_synth", "bonk": "snd.cartoon.bonk_pitch", "button": "snd.cartoon.rimshot"},
                      "notes": "foley ids have 4 round-robin takes (repeat an id and the mixer changes the take); keep crowd reactions 6-10 dB under the bed's loudest moment"},
    # 2026-10-14: the two storyboard shapes in skills/motion-pack/references/success-patterns.md (sentence-led product film, mockumentary)
    "saas_launch": {"desc": "sentence-led SaaS / AI product film: a UI tick on every state change, card whooshes, the agent-at-work texture under step lists, a soft slam on the brand colour field, logo last",
                    "bed": ["tech_pulse", "corporate_bright", "deep_house"], "bpm": [120, 136], "lufs": -14,
                    "roles": {"word": "snd.ui.tick", "state_change": "snd.ui.tick", "click": "snd.device.mouse_click", "type": "snd.device.keyboard_mech_soft", "send": "snd.device.message_sent",
                              "card_move": "snd.whoosh.swish_s", "card_fly": "snd.whoosh.whoosh_m", "card_riffle": "snd.paper.card_riffle", "card_settle": "snd.paper.card_shuffle_settle",
                              "scan": "snd.ui.scan_sweep", "working": "snd.ui.agent_working", "step_done": "snd.device.loading_tick", "result": "snd.ui.success", "number": "snd.ui.count_run",
                              "pixel_wipe": "snd.tx.pixel_dissolve", "letters": "snd.sparkle.letter_assemble", "brand_field": "snd.hit.brand_field_slam", "logo": "snd.logo.hybrid"},
                    "notes": "target >= 60% of cuts within 2 frames of an onset (cuts/cutgen.py snap); end the 'working' loop at the result frame (mixer add_cue until_frame); one slam only, on the cut to the brand field"},
    "mockumentary": {"desc": "documentary-parody comedy: room tone under every interview, hard dialogue cuts, a record scratch or tape stop on the format break, deadpan stingers, silence before the punchline",
                     "bed": ["documentary_marimba", "comedy_pizzicato", "suspense_tick"], "bpm": [90, 120], "lufs": -14,
                     "roles": {"room": "snd.amb.room_tone", "office": "snd.amb.office", "format_break": "snd.cartoon.record_scratch", "tape_stop": "snd.tx.tape_stop", "jump_cut": "snd.tx.cut_tick",
                               "deadpan": "snd.stinger.bump", "doubt": "snd.stinger.question", "to_black": "snd.stinger.cut_to_black", "title_card": "snd.hit.soft", "reaction_take": "snd.cartoon.pop_eye",
                               "aww": "snd.crowd.aww_synth", "typing": "snd.device.keyboard_mech_clack", "phone": "snd.device.phone_buzz", "proof_wall": "snd.ui.count_run", "logo": "snd.logo.hybrid",
                               "punchline_pause_frames": 9},
                     "levels_re_voice_db": {"room": -30, "deadpan": -14, "jump_cut": -24, "format_break": -8},
                     "notes": "dialogue drives the cut (cuts/patterns.json mockumentaryReaction: 0.3-0.5 s reaction inserts); the stinger lands after the line, never over it"},
    # 2026-10-14 round 3
    "archive_open": {"desc": "archive / heritage opening into a late drop: projector clatter under archive footage, a typewriter line on all-caps credit cards, near-silence on the turn, the beat drops on the product name",
                     "bed": ["cinematic_drone", "suspense_pulse", "tech_pulse"], "bpm": [72, 120], "lufs": -14,
                     "roles": {"projector": "snd.amb.projector", "crackle": "snd.amb.vinyl_crackle", "credit_line": "snd.foley.typewriter", "stamp": "snd.foley.stamp", "burn": "snd.tx.film_burn",
                               "tape_stop": "snd.tx.tape_stop", "beam": "snd.ui.hologram_beam", "riser": "snd.riser.noise_1bar", "drop": "snd.hit.sub_drop", "to_black": "snd.stinger.cut_to_black",
                               "logo": "snd.logo.hybrid"},
                     "notes": "cuts/patterns.json lateDrop: projector + typewriter only until the drop (no beat, no bass); the bed enters on the turn line; end with preStingSilence (1-3 s, room tone at most) before to_black"},
    # 2026-10-14 gap sfx/elec/arc: electric / neon outline type and power-on moments
    "neon_power_on": {"desc": "electric / neon look: an arc zap on the frame the outline strikes, the crackle loop under the lit sign (stop it with until_frame), flicker on a glitch, zap-off on the frame the light dies",
                      "bed": ["synthwave", "tech_pulse", "suspense_pulse"], "bpm": [100, 124], "lufs": -14,
                      "roles": {"power_on": "snd.elec.arc", "live": "snd.elec.crackle_loop", "power_off": "snd.elec.zap_off", "flicker": "snd.tx.glitch_stutter", "sizzle": "snd.sizzle.grain",
                                "switch": "snd.ui.toggle_on", "beam": "snd.ui.hologram_beam", "build": "snd.riser.noise_1bar", "hit": "snd.hit.punch", "to_black": "snd.stinger.cut_to_black",
                                "logo": "snd.logo.hybrid"},
                      "notes": "one arc per outline strike (the id is rr:4: a repeated cue gets a different strike); the buzz is tuned to A2 (110 Hz), so it sits under A-major beds; levels over the bed: arc +3.5 dB (manifest over_bed_db), zap-off about +2, the crackle loop about 10 dB under the bed, ended on the zap-off frame"},
}


def validate():
    sf = json.load(open(os.path.join(HERE, "manifest.json")))
    ids = {d["id"] for d in sf["sounds"]}
    mm = json.load(open(os.path.join(os.path.dirname(HERE), "music", "manifest.json")))
    presets = {i["preset"] for i in mm["items"] if i["kind"] == "bed"}
    bad = []
    for name, b in BUNDLES.items():
        for role, sid in b["roles"].items():
            if isinstance(sid, str) and sid.startswith("snd.") and sid not in ids:
                bad.append((name, role, sid))
        for p in b["bed"]:
            if p not in presets:
                bad.append((name, "bed", p))
    return bad


if __name__ == "__main__":
    bad = validate()
    if bad:
        raise SystemExit("unknown ids: %s" % bad)
    json.dump(BUNDLES, open(os.path.join(HERE, "bundles.json"), "w"), indent=1)
    print("bundles.json:", len(BUNDLES), "bundles, all ids valid")
