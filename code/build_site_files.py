#!/usr/bin/env python3
"""Build sitemap.xml, api.json, robots.txt for Signature Music Studio.
Reads data/manifest.json + data/index/index.json.gz for counts and URLs.
Usage: python3 code/build_site_files.py
"""
import json, gzip, os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
BASE = "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/"
TODAY = "2026-10-02"

def main():
    manifest = json.load(open(os.path.join(DATA, "manifest.json")))
    idx_path = os.path.join(DATA, "index", "index.json.gz")
    rows = []
    if os.path.exists(idx_path):
        with gzip.open(idx_path, "rt", encoding="utf-8") as fh:
            rows = [json.loads(l) for l in fh if l.strip()]
    counts = {"song": 0, "sound": 0, "gear": 0, "beat": 0}
    for r in rows:
        counts[r[2]] = counts.get(r[2], 0) + 1
    param = {"song": "song", "sound": "sound", "gear": "gear", "beat": "beat"}
    urls = [BASE, BASE + "#studio", BASE + "#beatmaker", BASE + "#songwriter",
            BASE + "#vocalstudio", BASE + "#backups", BASE + "#cleanup", BASE + "#cdmaker", BASE + "#teacher"]
    for r in rows:
        urls.append("%s?%s=%s" % (BASE, param[r[2]], r[0]))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sm.append("  <url><loc>%s</loc><lastmod>%s</lastmod></url>" % (escape(u.split("#")[0]), TODAY))
    sm.append("</urlset>")
    open(os.path.join(HERE, "sitemap.xml"), "w").write("\n".join(sm) + "\n")
    api = {
        "name": "Signature Music Studio",
        "official_name": True,
        "repo": "signature-ai-song-maker",
        "url": BASE,
        "tagline": "Make music on your own, via AI, or in collaboration with AI.",
        "counts": {
            "records_total": manifest["count"],
            "songs": counts.get("song", 0),
            "library": counts.get("sound", 0),
            "equipment": counts.get("gear", 0),
            "beats": counts.get("beat", 0),
            "songs_goal": 1000000,
            "library_goal": 1000000,
        },
        "ids": {"song": "JAH-SONG-0000001..", "library": "JAH-SOUND-0000001..", "equipment": "JAH-GEAR-0000001..", "beat": "JAH-BEAT-0000001.."},
        "deep_links": {"song": "?song=JAH-SONG-0000001", "library": "?sound=JAH-SOUND-0000001", "equipment": "?gear=JAH-GEAR-0000001", "beat": "?beat=JAH-BEAT-0000001"},
        "audio": "All audio is synthesized client-side with the Web Audio API. Voices are synthesized, never human singers.",
        "network": "THE JAH NETWORK — 25 sites",
    }
    open(os.path.join(HERE, "api.json"), "w").write(json.dumps(api, indent=2))
    open(os.path.join(HERE, "robots.txt"), "w").write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % BASE)
    print("site files built: %d urls, counts %s" % (len(urls), json.dumps(counts)))

if __name__ == "__main__":
    main()
