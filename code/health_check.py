#!/usr/bin/env python3
"""Signature Music Studio — health check / build gate.
Verifies: index chunk pointers, duplicate IDs, orphan records/chunks,
manifest counts vs index, music-manifest.json freshness (sha256), sitemap
URL counts vs index. Exit 0 = healthy, 1 = problems found.
Usage: python3 code/health_check.py
"""
import json, gzip, os, glob, hashlib, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
IDX = os.path.join(DATA, "index", "index.json.gz")
RECDIR = os.path.join(DATA, "records")
BASE = "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/"

problems = []

def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ((" — " + detail) if detail and not cond else ""))
    if not cond:
        problems.append(name + (" — " + detail if detail else ""))

rows = [json.loads(l) for l in gzip.open(IDX, "rt", encoding="utf-8") if l.strip()]
check("index readable", len(rows) > 0, "0 rows")

# chunk pointer correctness
chunk_cache = {}
def chunk_ids(c):
    if c not in chunk_cache:
        ids = set()
        p = os.path.join(RECDIR, c)
        if os.path.exists(p):
            for l in gzip.open(p, "rt", encoding="utf-8"):
                if l.strip():
                    try: ids.add(json.loads(l)["id"])
                    except Exception: pass
        chunk_cache[c] = ids
    return chunk_cache[c]

bad_ptr = [r[0] for r in rows if r[0] not in chunk_ids(r[3])]
check("chunk pointers correct", not bad_ptr, "%d bad (e.g. %s)" % (len(bad_ptr), bad_ptr[:3]))

# duplicate IDs
from collections import Counter
dups = [k for k, v in Counter(r[0] for r in rows).items() if v > 1]
check("no duplicate IDs", not dups, str(dups[:5]))

# orphans: records in chunks missing from index; index rows pointing at missing chunks
indexed = set(r[0] for r in rows)
chunked = {}
for f in glob.glob(os.path.join(RECDIR, "recs-c*.json.gz")):
    c = os.path.basename(f)
    for l in gzip.open(f, "rt", encoding="utf-8"):
        if l.strip():
            try: chunked[json.loads(l)["id"]] = c
            except Exception: pass
orphan_recs = [i for i in chunked if i not in indexed]
missing_chunks = sorted(set(r[3] for r in rows if not os.path.exists(os.path.join(RECDIR, r[3]))))
check("no orphan records", not orphan_recs, "%d orphans" % len(orphan_recs))
check("no missing chunks", not missing_chunks, str(missing_chunks[:5]))
check("chunk coverage complete", set(chunked) == indexed,
      "chunked=%d indexed=%d" % (len(chunked), len(indexed)))

# counts: manifest vs index vs music-manifest
counts = Counter(r[2] for r in rows)
man = json.load(open(os.path.join(DATA, "manifest.json")))
check("manifest.json count matches index", man.get("count") == len(rows),
      "manifest=%s index=%d" % (man.get("count"), len(rows)))
mm_path = os.path.join(HERE, "music-manifest.json")
if os.path.exists(mm_path):
    mm = json.load(open(mm_path))
    a = mm.get("archive", {})
    ok = (a.get("songs") == counts.get("song", 0) and a.get("library_sounds") == counts.get("sound", 0)
          and a.get("equipment") == counts.get("gear", 0) and a.get("beats") == counts.get("beat", 0))
    check("music-manifest counts match index", ok, json.dumps({k: counts.get(k, 0) for k in ("song", "sound", "gear", "beat")}))
    h = hashlib.sha256()
    with open(IDX, "rb") as fh:
        for blk in iter(lambda: fh.read(1 << 20), b""):
            h.update(blk)
    check("music-manifest index sha256 fresh", mm.get("index", {}).get("sha256") == h.hexdigest(), "stale sha — rebuild site files")
else:
    check("music-manifest.json exists", False, "missing")

# sitemap coverage
sm_path = os.path.join(HERE, "sitemap-songs.xml")
if os.path.exists(sm_path):
    n_urls = open(sm_path).read().count("<url>")
    check("sitemap-songs covers all songs", n_urls == counts.get("song", 0), "sitemap=%d songs=%d" % (n_urls, counts.get("song", 0)))
smb = os.path.join(HERE, "sitemap-beats.xml")
if os.path.exists(smb):
    n_urls = open(smb).read().count("<url>")
    check("sitemap-beats covers all beats", n_urls == counts.get("beat", 0), "sitemap=%d beats=%d" % (n_urls, counts.get("beat", 0)))

print("\n%d problem(s)" % len(problems))
sys.exit(1 if problems else 0)
