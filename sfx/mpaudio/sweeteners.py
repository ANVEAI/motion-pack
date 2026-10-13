"""motion-pack / sfx / mpaudio / sweeteners.py : transition kind -> sound cue(s). The audio half of 'every motion component comes with sound'.
sweeten(kind, frame, duration_frames, energy, direction) returns cue dicts {id, frame, tier, gain_db, over_bed_db} where `frame` is the VISUAL frame the sound's anchor must
serve (the mixer adds the one-frame rule). Table is data (sweeteners.json is generated from it, so a JS planner can read it too). Placement notes follow docs/research/sound.md 4.10:
whoosh anchors at the blur midpoint; riser-type sweeteners end on the first frame of the next scene; hard cuts get a tick so they are not sterile."""
import json
import os

# kind: (sound id, where the anchor goes: 'start' | 'mid' | 'end' (relative to the transition duration), tier, over_bed_db or None=library default)
TABLE = {
    "hardCut": [("snd.tx.cut_tick", "start", 3, 0.0)],
    "whip": [("snd.whoosh.whip_pan", "mid", 2, 2.0)],
    "push": [("snd.tx.push", "mid", 3, 1.0)],
    "scalePunch": [("snd.tx.scale_punch", "start", 3, 3.0)],
    "zoomThrough": [("snd.tx.zoom_through", "end", 2, 3.0)],
    "flash": [("snd.tx.flash_swell", "mid", 2, 2.0)],
    "lightLeak": [("snd.tx.light_leak", "mid", 2, 2.0)],
    "filmBurn": [("snd.tx.film_burn", "mid", 2, 2.0)],
    "glitch": [("snd.tx.glitch_stutter", "start", 2, 3.0)],
    "dissolve": [("snd.tx.dissolve_pad", "mid", 3, -2.0)],
    "dipToBlack": [("snd.tx.dip_to_black", "start", 2, -2.0)],
    "blurCross": [("snd.tx.blur_cross", "mid", 3, 0.0)],
    "match": [("snd.tx.match_link", "start", 3, 1.0)],
    "morph": [("snd.tx.morph_warble", "mid", 3, 1.0)],
    "ink": [("snd.tx.ink_bloom", "mid", 2, 2.0)],
    "iris": [("snd.tx.iris_close", "mid", 3, 1.0)],
    "lumaWipe": [("snd.tx.luma_wipe", "mid", 2, 2.0)],
    "maskReveal": [("snd.tx.mask_reveal", "end", 3, 2.0)],
    "speedRamp": [("snd.tx.speed_ramp", "mid", 2, 2.0)],
    "freezeHold": [("snd.tx.freeze_hit", "start", 2, 3.0)],
    "smash": [("snd.tx.smash_cut", "start", 1, 4.5)],
    "jcut": [],
    # the 5 pairings that were pending (transitions/catalog.json kinds with no sweetener row), closed 2026-10-13; same ids as the catalog's sfx lists
    "shutter": [("snd.whoosh.swish_s", "start", 3, 1.0), ("snd.camera.shutter", "mid", 3, 3.0)],
    "swipeUp": [("snd.whoosh.swish_xs", "mid", 3, 1.0)],
    "spin": [("snd.whoosh.whoosh_m", "mid", 2, 2.0)],
    "pagePeel": [("snd.paper.flip", "mid", 3, 1.0)],
    "pixelSort": [("snd.tx.glitch_stutter", "start", 2, 2.0), ("snd.sizzle.grain", "start", 3, -2.0)],
    "dip": [("snd.tx.dip_to_black", "start", 2, -2.0)],                     # transitions/ id for dipToBlack
}
ENERGY_HIGH_EXTRA = {"hardCut": ("snd.hit.low_thump", "start", 3, 2.0)}   # hard cut at energy >= 0.7 also gets a low thump


_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CAT_ALIAS = {"transition": "tx", "ambience": "amb", "riser": "lift", "sparkle": "sizzle", "hit": "hit"}
_CACHE = {}


def resolve_sfx(pid, ids=None):
    """'sfx/<cat>/<name>' (transitions/catalog.json form) -> 'snd.<prefix>.<name>' registry id, or None"""
    if ids is None:
        if "ids" not in _CACHE:
            try:
                man = json.load(open(os.path.join(_HERE, "manifest.json")))["sounds"]
                _CACHE["ids"] = {d["id"]: d["category"] for d in man}
                _CACHE["meta"] = {d["id"]: d for d in man}
            except (OSError, ValueError):
                _CACHE["ids"] = {}
        ids = _CACHE["ids"]
    if pid.startswith("snd."):
        return pid if pid in ids else None
    parts = pid.split("/")
    if len(parts) != 3:
        return None
    _, cat, name = parts
    for pre in (cat, _CAT_ALIAS.get(cat, cat)):
        if "snd.%s.%s" % (pre, name) in ids:
            return "snd.%s.%s" % (pre, name)
    hits = [i for i, c in ids.items() if i.endswith("." + name) and (c == cat or i.split(".")[1] == cat)]
    return hits[0] if len(hits) == 1 else None


def catalog_rows(kind):
    """fallback for a transition kind with no TABLE row: the pairing list of transitions/catalog.json (the visual side's source of truth).
    Rows are (id, where, tier, over_bed_db, frame_offset); 'cut' -> mid; catalog offset_f 1 = the mixer's own one-frame rule, so frame_offset = offset_f - 1.
    Rows whose note starts with 'alt' are alternatives and are skipped."""
    if "cat" not in _CACHE:
        try:
            c = json.load(open(os.path.join(os.path.dirname(_HERE), "transitions", "catalog.json")))
            _CACHE["cat"] = {t["id"].split(".", 1)[1]: t.get("sfx", []) for t in c.get("transitions", [])}
        except (OSError, ValueError):
            _CACHE["cat"] = {}
    out = []
    for r in _CACHE["cat"].get(kind, []):
        if str(r.get("note", "")).startswith("alt"):
            continue
        sid = resolve_sfx(r["id"])
        meta = _CACHE.get("meta", {}).get(sid, {})
        if sid and not meta.get("loop"):                 # a loop (ambience) would run to the end of the mix: not a sweetener
            out.append((sid, {"cut": "mid"}.get(r.get("at", "cut"), r.get("at", "cut")), int(meta.get("tier", 3)), None, int(r.get("offset_f", 1)) - 1, float(r.get("gain_db", 0.0))))
    return out


def sweeten(kind, frame, duration_frames=0, energy=0.5, direction=None):
    out = []
    rows = list(TABLE.get(kind, []))
    if not rows and kind not in TABLE:
        for sid, where, tier, over, foff, g in catalog_rows(kind):
            off = {"start": 0, "mid": duration_frames // 2, "end": duration_frames}.get(where, duration_frames // 2)
            out.append({"id": sid, "frame": int(frame + off + foff), "tier": tier, "gain_db": round(g + (energy - 0.5) * 6.0, 2), "why": "sweetener:%s (catalog)" % kind})
        return out
    if kind in ENERGY_HIGH_EXTRA and energy >= 0.7:
        rows.append(ENERGY_HIGH_EXTRA[kind])
    if kind == "hardCut" and energy < 0.35:
        rows = []                                   # quiet cuts stay clean
    for sid, where, tier, over in rows:
        if kind == "iris" and direction == "open":
            sid = "snd.tx.iris_open"
        off = {"start": 0, "mid": duration_frames // 2, "end": duration_frames}[where]
        c = {"id": sid, "frame": int(frame + off), "tier": tier, "gain_db": round((energy - 0.5) * 6.0, 2), "why": "sweetener:%s" % kind}
        if over is not None:
            c["over_bed_db"] = over
        out.append(c)
    return out


def to_json(path):
    data = {k: [{"id": r[0], "anchor": r[1], "tier": r[2], "over_bed_db": r[3]} for r in v] for k, v in TABLE.items()}
    catalog_rows("")                                   # loads the catalog cache
    for kind in sorted(_CACHE.get("cat", {})):
        if kind not in data:
            rows = catalog_rows(kind)
            if rows:
                data[kind] = [{"id": r[0], "anchor": r[1], "tier": r[2], "over_bed_db": r[3], "frame_offset": r[4], "gain_db": r[5], "source": "transitions/catalog.json"} for r in rows]
    data["_extra_at_energy_ge_0.7"] = {k: {"id": v[0], "anchor": v[1], "tier": v[2], "over_bed_db": v[3]} for k, v in ENERGY_HIGH_EXTRA.items()}
    json.dump(data, open(path, "w"), indent=1)


if __name__ == "__main__":
    to_json(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sweeteners.json"))
