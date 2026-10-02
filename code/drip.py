#!/usr/bin/env python3
"""2h drip for The Signature Song Maker AI: +500 new songs per run (JAH-SONG-######).
Silent. 800MB data-dir guard: stages without pushing if tripped (exit 2).
Usage: python3 code/drip.py
"""
import json, gzip, os, subprocess, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
RECDIR = os.path.join(DATA, "records")
IDXDIR = os.path.join(DATA, "index")
CHUNK, N, NB = 100, 500, 250
GUARD = 800 * 1024 * 1024

DRIVER = r"""
const fs=require('fs'), vm=require('vm');
const sandbox={window:{}, console:console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('assets/synth.js','utf8'), sandbox);
vm.runInContext(fs.readFileSync('assets/engine.js','utf8'), sandbox);
const SigData = sandbox.window.SigData;
const [kind, from, count] = process.argv.slice(1);
const out = [];
for (let n = Number(from); n < Number(from) + Number(count); n++) out.push(SigData.gen(kind, n));
process.stdout.write(out.map(r => JSON.stringify(r)).join('\n'));
"""

def gen(kind, start, count):
    p = subprocess.run(["node", "-e", DRIVER, kind, str(start), str(count)],
                       capture_output=True, text=True, cwd=HERE)
    if p.returncode != 0:
        print("DRIP FAILED: node driver error for %s: %s" % (kind, p.stderr[:300])); sys.exit(1)
    recs = [json.loads(l) for l in p.stdout.splitlines() if l.strip()]
    ids = [r["id"] for r in recs]
    assert len(set(ids)) == len(ids), "duplicate ids in " + kind
    return recs

def pack(recs, manifest):
    existing = sorted(f for f in os.listdir(RECDIR) if f.startswith("recs-c") and f.endswith(".json.gz"))
    next_c = max(int(f.split("recs-c")[1].split(".")[0]) for f in existing) + 1 if existing else 1
    for i in range(0, len(recs), CHUNK):
        block = recs[i:i + CHUNK]
        cname = "recs-c%05d.json.gz" % (next_c + i // CHUNK)
        with gzip.open(os.path.join(RECDIR, cname), "wt", encoding="utf-8") as fh:
            for r in block:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        manifest["chunks"].append(cname)
    manifest["count"] += len(recs)
    return manifest["chunks"][-1]

def data_size():
    total = 0
    for dp, _, fns in os.walk(DATA):
        for f in fns:
            total += os.path.getsize(os.path.join(dp, f))
    return total

def main():
    state_path = os.path.join(DATA, "state.json")
    state = json.load(open(state_path))
    manifest = json.load(open(os.path.join(DATA, "manifest.json")))
    songs = gen("song", state["song"], N)
    lib = gen("sound", state["sound"], N)
    beats = gen("beat", state.get("beat", 1), NB)
    last_song_chunk = pack(songs, manifest)
    last_lib_chunk = pack(lib, manifest)
    last_beat_chunk = pack(beats, manifest)
    json.dump(manifest, open(os.path.join(DATA, "manifest.json"), "w"))
    idx_path = os.path.join(IDXDIR, "index.json.gz")
    with gzip.open(idx_path, "at", encoding="utf-8") as fh:
        for r in songs:
            fh.write(json.dumps([r["id"], r["title"], "song", last_song_chunk], ensure_ascii=False) + "\n")
        for r in lib:
            fh.write(json.dumps([r["id"], r["name"], "sound", last_lib_chunk], ensure_ascii=False) + "\n")
        for r in beats:
            fh.write(json.dumps([r["id"], r["name"], "beat", last_beat_chunk], ensure_ascii=False) + "\n")
    state["song"] += N
    state["sound"] += N
    state["beat"] = state.get("beat", 1) + NB
    json.dump(state, open(state_path, "w"))
    # rebuild sitemap + api counts
    subprocess.run(["python3", "code/build_site_files.py"], cwd=HERE, check=True)
    size = data_size()
    print("drip: +%d songs (%s..%s), +%d library (%s..%s), +%d beats (%s..%s), total records %d, data %.1fMB" % (
        N, songs[0]["id"], songs[-1]["id"], N, lib[0]["id"], lib[-1]["id"], NB, beats[0]["id"], beats[-1]["id"],
        manifest["count"], size / 1048576))
    if size > GUARD:
        print("GUARD TRIPPED: data dir exceeds 800MB — staged, NOT pushed"); sys.exit(2)

if __name__ == "__main__":
    main()
