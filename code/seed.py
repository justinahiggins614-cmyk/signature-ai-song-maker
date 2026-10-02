#!/usr/bin/env python3
"""Seed The Signature Song Maker AI catalog: 1,500 deterministic records.
700 songs (JAH-SONG-######) + 450 sounds (JAH-SOUND-######) + 350 gear (JAH-GEAR-######).
Packs 100/chunk gz, builds compact index + manifest. Deterministic: same input -> same output.
Usage: python3 code/seed.py [--from N]  (continues per-kind counters in data/state.json)
"""
import json, gzip, os, subprocess, sys, math

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
RECDIR = os.path.join(DATA, "records")
IDXDIR = os.path.join(DATA, "index")
CHUNK = 100
DEFAULT_KINDS = [("song", 700), ("sound", 450), ("gear", 350), ("beat", 500)]

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

def gen_records(kind, start, count):
    p = subprocess.run(["node", "-e", DRIVER, kind, str(start), str(count)],
                       capture_output=True, text=True, cwd=HERE)
    if p.returncode != 0:
        raise RuntimeError("node driver failed for %s: %s" % (kind, p.stderr[:500]))
    return [json.loads(l) for l in p.stdout.splitlines() if l.strip()]

def main():
    os.makedirs(RECDIR, exist_ok=True)
    os.makedirs(IDXDIR, exist_ok=True)
    kinds = DEFAULT_KINDS
    if len(sys.argv) == 3:  # python3 code/seed.py beat 500
        kinds = [(sys.argv[1], int(sys.argv[2]))]
    state_path = os.path.join(DATA, "state.json")
    state = {"song": 1, "sound": 1, "gear": 1, "beat": 1}
    if os.path.exists(state_path):
        state.update(json.load(open(state_path)))
    allrecs = []
    for kind, count in kinds:
        start = state.get(kind, 1)
        # only seed the *new* block for this run (drip continues counters)
        recs = gen_records(kind, start, count)
        ids = [r["id"] for r in recs]
        assert len(set(ids)) == len(ids), "duplicate ids in %s block" % kind
        allrecs.extend(recs)
        state[kind] = start + count
    # pack chunks (numbering continues from existing)
    existing = sorted(f for f in os.listdir(RECDIR) if f.startswith("recs-c") and f.endswith(".json.gz"))
    next_c = 1
    if existing:
        next_c = max(int(f.split("recs-c")[1].split(".")[0]) for f in existing) + 1
    manifest_path = os.path.join(DATA, "manifest.json")
    manifest = {"chunks": [], "count": 0}
    if os.path.exists(manifest_path):
        manifest = json.load(open(manifest_path))
    idx_rows = []
    for i in range(0, len(allrecs), CHUNK):
        block = allrecs[i:i + CHUNK]
        cname = "recs-c%05d.json.gz" % (next_c + i // CHUNK)
        with gzip.open(os.path.join(RECDIR, cname), "wt", encoding="utf-8") as fh:
            for r in block:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        manifest["chunks"].append(cname)
        for r in block:
            title = r.get("title") or r.get("name")
            idx_rows.append([r["id"], title, r["kind"], cname])
    manifest["count"] = manifest.get("count", 0) + len(allrecs)
    json.dump(manifest, open(manifest_path, "w"))
    # compact index: append rows
    idx_path = os.path.join(IDXDIR, "index.json.gz")
    prev = []
    if os.path.exists(idx_path):
        with gzip.open(idx_path, "rt", encoding="utf-8") as fh:
            prev = [json.loads(l) for l in fh if l.strip()]
    seen = set(r[0] for r in prev)
    prev.extend(r for r in idx_rows if r[0] not in seen)
    with gzip.open(idx_path, "wt", encoding="utf-8") as fh:
        for r in prev:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    json.dump(state, open(state_path, "w"))
    print("seeded %d records (%d chunks); total %d; state %s" % (len(allrecs), math.ceil(len(allrecs) / CHUNK), manifest["count"], json.dumps(state)))

if __name__ == "__main__":
    main()
