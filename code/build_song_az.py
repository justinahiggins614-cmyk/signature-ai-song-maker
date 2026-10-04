#!/usr/bin/env python3
"""Build the Song Archive A-Z per-letter index (spec-archive pattern).

Reads data/index/index.json.gz ([id, title, kind, chunk] rows), groups the
song rows by first title letter (A-Z, else '#'), and writes:
  data/index/az/<LETTER>.json.gz   [id, title, chunk] rows, sorted by title
  data/index/az/manifest.json      {total, built, counts}
A letter's file loads only when its <details> opens on songs.html, so phones
never pull the whole archive at once. Always rewrites each gzip as ONE member
(never append) so DecompressionStream accepts it.
Called by code/drip.py after every drip run.
"""
import gzip
import json
import os
from datetime import date

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(HERE, "data", "index", "index.json.gz")
AZDIR = os.path.join(HERE, "data", "index", "az")
LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)] + ["#"]


def letter_of(title):
    t = (title or "").strip()
    if not t:
        return "#"
    c = t[0].upper()
    return c if "A" <= c <= "Z" else "#"


def main():
    buckets = {L: [] for L in LETTERS}
    total = 0
    with gzip.open(IDX, "rt", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            if len(row) < 4 or row[2] != "song":
                continue
            buckets[letter_of(row[1])].append([row[0], row[1], row[3]])
            total += 1
    os.makedirs(AZDIR, exist_ok=True)
    counts = {}
    for L in LETTERS:
        rows = buckets[L]
        rows.sort(key=lambda r: (r[1].lower(), r[0]))
        counts[L] = len(rows)
        # single-member gzip rewrite — never append
        with gzip.open(os.path.join(AZDIR, L + ".json.gz"), "wt", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    manifest = {"total": total, "built": date.today().isoformat(), "counts": counts}
    with open(os.path.join(AZDIR, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh)
    print("song az: %d songs across 27 letters -> data/index/az/" % total)


if __name__ == "__main__":
    main()
