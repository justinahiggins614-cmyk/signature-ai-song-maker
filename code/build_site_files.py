#!/usr/bin/env python3
"""Build sitemap files, api.json, robots.txt, music-catalog.json, and the
static catalog fallback table for Signature Music Studio.
Reads data/manifest.json + data/index/index.json.gz.
Usage: python3 code/build_site_files.py
"""
import json, gzip, os, datetime
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
BASE = "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/"
TODAY = datetime.date.today().isoformat()

PARAM = {"song": "song", "sound": "sound", "gear": "gear", "beat": "beat"}

def sm_url(u):
    return '  <url><loc>%s</loc><lastmod>%s</lastmod></url>' % (escape(u.split("#")[0]), TODAY)

def write_sm(name, urls):
    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'] + \
           [sm_url(u) for u in urls] + ["</urlset>"]
    open(os.path.join(HERE, name), "w").write("\n".join(body) + "\n")

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

    core = [BASE, BASE + "#studio", BASE + "#beatmaker", BASE + "#songwriter",
            BASE + "#vocalstudio", BASE + "#backups", BASE + "#cleanup",
            BASE + "#cdmaker", BASE + "#teacher"]
    per = {"songs": [], "library": [], "beats": [], "gear": []}
    for r in rows:
        u = "%s?%s=%s" % (BASE, PARAM[r[2]], r[0])
        if r[2] == "song":
            per["songs"].append(u)
        elif r[2] == "beat":
            per["beats"].append(u)
        elif r[2] == "sound":
            per["library"].append(u)
        else:
            per["gear"].append(u)
    write_sm("sitemap-core.xml", core)
    write_sm("sitemap-songs.xml", per["songs"])
    write_sm("sitemap-library.xml", per["library"])
    write_sm("sitemap-beats.xml", per["beats"])
    write_sm("sitemap-gear.xml", per["gear"])
    idx = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for s in ["sitemap-core.xml", "sitemap-songs.xml", "sitemap-library.xml",
              "sitemap-beats.xml", "sitemap-gear.xml"]:
        idx.append('  <sitemap><loc>%s%s</loc><lastmod>%s</lastmod></sitemap>' % (BASE, s, TODAY))
    idx.append("</sitemapindex>")
    open(os.path.join(HERE, "sitemap-index.xml"), "w").write("\n".join(idx) + "\n")
    # sitemap.xml kept as the index (crawlers + robots.txt keep working)
    open(os.path.join(HERE, "sitemap.xml"), "w").write("\n".join(idx) + "\n")

    # music-catalog.json: machine-readable feed for crawlers/agents
    feed = [{"id": r[0], "kind": r[2], "title": r[1], "chunk": r[3],
             "url": "%s?%s=%s" % (BASE, PARAM[r[2]], r[0])} for r in rows]
    open(os.path.join(HERE, "data", "music-catalog.json"), "w").write(json.dumps({
        "site": "Signature Music Studio", "updated": TODAY,
        "counts": counts, "records": feed}, ensure_ascii=False))

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
        "ids": {"song": "JAH-SONG-0000001..", "library": "JAH-SOUND-0000001..",
                "equipment": "JAH-GEAR-0000001..", "beat": "JAH-BEAT-0000001.."},
        "deep_links": {"song": "?song=JAH-SONG-0000001", "library": "?sound=JAH-SOUND-0000001",
                       "equipment": "?gear=JAH-GEAR-0000001", "beat": "?beat=JAH-BEAT-0000001"},
        "feeds": {"music_catalog": "data/music-catalog.json",
                  "sitemaps": ["sitemap-core.xml", "sitemap-songs.xml",
                               "sitemap-library.xml", "sitemap-beats.xml", "sitemap-gear.xml"]},
        "audio": "All audio is synthesized client-side with the Web Audio API. Voices are synthesized, never human singers.",
        "network": "THE JAH NETWORK — 25 sites",
    }
    open(os.path.join(HERE, "api.json"), "w").write(json.dumps(api, indent=2))
    open(os.path.join(HERE, "robots.txt"), "w").write(
        "User-agent: *\nAllow: /\nSitemap: %ssitemap-index.xml\n" % BASE)

    build_static_catalog(rows)
    print("site files built: %d urls, counts %s" % (len(core) + len(rows), json.dumps(counts)))

def build_static_catalog(rows):
    """Static HTML fallback table (bot-ingestible, no-JS) injected into
    index.html between the STATIC-CAT markers: first 20 songs + 20 beats."""
    songs = [r for r in rows if r[2] == "song"][:20]
    beats = [r for r in rows if r[2] == "beat"][:20]
    parts = ['<table class="statictable"><thead><tr><th>ID</th><th>Title</th><th>Open</th></tr></thead><tbody>']
    for r in songs + beats:
        url = "?%s=%s" % (PARAM[r[2]], r[0])
        parts.append('<tr><td><span class="id">%s</span></td><td>%s</td>'
                     '<td><a href="%s">Open →</a></td></tr>' % (escape(r[0]), escape(r[1]), escape(url)))
    parts.append('</tbody></table>')
    parts.append('<p class="seqlab">Showing the first 40 archive records. Full machine-readable feed: '
                 '<a href="data/music-catalog.json">data/music-catalog.json</a>.</p>')
    body = "\n".join(parts)
    p = os.path.join(HERE, "index.html")
    h = open(p).read()
    start, end = "<!-- STATIC-CAT-START -->", "<!-- STATIC-CAT-END -->"
    if start not in h or end not in h:
        print("WARNING: static-catalog markers missing from index.html — table not injected")
        return
    h = h.split(start)[0] + start + "\n" + body + "\n" + end + end.join(h.split(end)[1:])
    open(p, "w").write(h)
    print("static catalog table injected (%d songs, %d beats)" % (len(songs), len(beats)))

if __name__ == "__main__":
    main()
