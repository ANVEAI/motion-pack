#!/usr/bin/env python3
"""Origin gate for imported audio (motion-pack/sfx). Nothing external enters the catalogue without provenance.
usage: python3 tools/check_origin.py DIR [DIR ...]      exit 0 = every audio file is covered by a valid ORIGIN.txt, 2 = refused (reasons printed)
An ORIGIN.txt sits in the same folder as the files (or a parent) and has 'key: value' lines:
  url:            the page the files were downloaded from (https)
  author:         creator / publisher as shown on that page
  licence:        one of the ALLOWED ids below, exactly as verified on the page that day
  licence_snapshot: path (relative to ORIGIN.txt) of a saved copy / screenshot of the licence text
  date:           YYYY-MM-DD the file was downloaded
  zip_sha256:     SHA-256 of the archive as downloaded (or 'none' for a single file)
  files:          optional comma list; default = every audio file in the folder
Licences ALLOWED (no attribution needed): CC0-1.0, public-domain, MIT, Apache-2.0, OFL-1.1, royalty-free-no-attribution (only when the page says commercial use
without attribution). ATTRIBUTION (allowed, but the credit line must be in ORIGIN.txt 'credit:' and the item is tagged attr:required): CC-BY-3.0, CC-BY-4.0.
REFUSED: CC-BY-SA, any -NC or -ND, personal-use-only, 'free' without terms, unknown. Apple Color Emoji and any ripped / pirated pack are refused by name."""
import hashlib
import os
import re
import sys

ALLOWED = {"cc0-1.0", "public-domain", "mit", "apache-2.0", "ofl-1.1", "royalty-free-no-attribution"}
ATTRIBUTION = {"cc-by-3.0", "cc-by-4.0"}
REQUIRED = ("url", "author", "licence", "licence_snapshot", "date", "zip_sha256")
AUDIO = (".wav", ".aif", ".aiff", ".flac", ".mp3", ".ogg", ".m4a")
BANNED_WORDS = ("apple color emoji", "ripped", "warez", "torrent", "personal use only", "non-commercial", "noncommercial")


def parse(path):
    d = {}
    for line in open(path, encoding="utf-8", errors="replace"):
        m = re.match(r"\s*([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$", line)
        if m:
            d[m.group(1).lower()] = m.group(2)
    return d


def find_origin(folder, root):
    f = os.path.abspath(folder)
    root = os.path.abspath(root)
    while True:
        p = os.path.join(f, "ORIGIN.txt")
        if os.path.exists(p):
            return p
        if f == root or os.path.dirname(f) == f:
            return None
        f = os.path.dirname(f)


def check_origin(origin_path):
    """returns (ok, reasons, info)"""
    d = parse(origin_path)
    why = ["missing field '%s'" % k for k in REQUIRED if not d.get(k)]
    lic = d.get("licence", "").strip().lower()
    if lic and lic not in ALLOWED | ATTRIBUTION:
        why.append("licence '%s' is not on the allowed list (refuse CC-BY-SA, NC, ND, personal-use, unknown)" % d.get("licence"))
    if lic in ATTRIBUTION and not d.get("credit"):
        why.append("licence %s needs a 'credit:' line" % lic)
    if d.get("url") and not d["url"].startswith("https://"):
        why.append("url must be https")
    if d.get("date") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d["date"]):
        why.append("date must be YYYY-MM-DD")
    sha = d.get("zip_sha256", "")
    if sha and sha != "none" and not re.fullmatch(r"[0-9a-fA-F]{64}", sha):
        why.append("zip_sha256 is not a SHA-256 hex digest")
    snap = d.get("licence_snapshot")
    if snap and not os.path.exists(os.path.join(os.path.dirname(origin_path), snap)):
        why.append("licence_snapshot file not found: %s" % snap)
    text = " ".join(d.values()).lower()
    why += ["banned term '%s'" % w for w in BANNED_WORDS if w in text]
    return not why, why, {"licence": lic, "attribution": lic in ATTRIBUTION, "credit": d.get("credit"), "url": d.get("url")}


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def scan(dirs):
    bad, ok = [], []
    for root in dirs:
        for dp, _, files in os.walk(root):
            for fn in sorted(files):
                if not fn.lower().endswith(AUDIO):
                    continue
                p = os.path.join(dp, fn)
                o = find_origin(dp, root)
                if not o:
                    bad.append((p, ["no ORIGIN.txt in this folder or a parent"]))
                    continue
                good, why, info = check_origin(o)
                listed = parse(o).get("files")
                if listed and fn not in [x.strip() for x in listed.split(",")]:
                    good, why = False, why + ["file not listed in ORIGIN.txt 'files:'"]
                (ok if good else bad).append((p, info if good else why))
    return ok, bad


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    ok, bad = scan(sys.argv[1:])
    for p, info in ok:
        print("ok     ", p, info["licence"], "(attribution required)" if info["attribution"] else "")
    for p, why in bad:
        print("REFUSED", p, "; ".join(why))
    print("%d ok, %d refused" % (len(ok), len(bad)))
    sys.exit(2 if bad else 0)
