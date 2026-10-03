#!/usr/bin/env python3
"""Generate code/test_vectors.json: deterministic test vectors computed with
node over the REAL engine (assets/synth.js + assets/engine.js + assets/lyrics.js),
exactly like code/drip.py does. Nothing is hand-written: every sha256 is
computed from the canonical JSON (sorted keys) of the record the engine
actually returns.

Usage: python3 code/make_test_vectors.py
"""
import json, hashlib, os, subprocess, datetime, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DRIVER = r"""
const fs=require('fs'), vm=require('vm');
const sandbox={window:{}, console:console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('assets/synth.js','utf8'), sandbox);
vm.runInContext(fs.readFileSync('assets/engine.js','utf8'), sandbox);
vm.runInContext(fs.readFileSync('assets/lyrics.js','utf8'), sandbox);
const SigData = sandbox.window.SigData;
const [kind, from, count] = process.argv.slice(1);
const out = [];
for (let n = Number(from); n < Number(from) + Number(count); n++) out.push(SigData.gen(kind, n));
process.stdout.write(out.map(r => JSON.stringify(r)).join('\n'));
"""

SEEDS = list(range(1, 11))          # record numbers n = 1..10, each kind
KINDS = ["song", "beat", "sound", "gear"]

def canonical(rec):
    """Canonical form hashed for the vector: JSON, keys sorted recursively,
    UTF-8, no whitespace, ensure_ascii=False."""
    return json.dumps(rec, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":")).encode("utf-8")

def gen(kind, seeds):
    lo, hi = min(seeds), max(seeds)
    p = subprocess.run(["node", "-e", DRIVER, kind, str(lo), str(hi - lo + 1)],
                       capture_output=True, text=True, cwd=HERE)
    if p.returncode != 0:
        print("FAILED: node driver error for %s: %s" % (kind, p.stderr[:500]),
              file=sys.stderr)
        sys.exit(1)
    recs = [json.loads(l) for l in p.stdout.splitlines() if l.strip()]
    by_n = {r["n"]: r for r in recs}
    return [by_n[n] for n in seeds]

def label(rec):
    kind = rec["kind"]
    if kind == "song":
        return {"title": rec["title"], "genre": rec["genre"]}
    if kind == "beat":
        return {"title": rec["name"], "style": rec["style"]}
    if kind == "sound":
        return {"title": rec["name"], "style": rec["subtype"] + "/" + rec["cat"]}
    return {"title": rec["name"], "style": rec["cat"]}

def main():
    vectors = []
    for kind in KINDS:
        for rec in gen(kind, SEEDS):
            digest = hashlib.sha256(canonical(rec)).hexdigest()
            v = {"kind": kind, "n": rec["n"], "id": rec["id"],
                 "sha256": digest}
            v.update(label(rec))
            vectors.append(v)
    out = {
        "engine": "SIGMUSIC-V1",
        "seed_algorithm": "hashSeed = xmur3 (assets/synth.js); record seed = n via rngFrom('<prefix>:' + n)",
        "canonicalization": "json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(',',':')) -> utf-8 -> sha256",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "vectors": vectors,
    }
    path = os.path.join(HERE, "code", "test_vectors.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
    print("wrote %s (%d vectors)" % (path, len(vectors)))

if __name__ == "__main__":
    main()
