#!/usr/bin/env python3
"""Verify code/test_vectors.json: recompute every vector with node over the
REAL engine and FAIL on any mismatch. Exit 0 = all vectors reproduce.

Usage: python3 code/verify_test_vectors.py
"""
import json, hashlib, os, subprocess, sys

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

def canonical(rec):
    return json.dumps(rec, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":")).encode("utf-8")

def gen(kind, lo, count):
    p = subprocess.run(["node", "-e", DRIVER, kind, str(lo), str(count)],
                       capture_output=True, text=True, cwd=HERE)
    if p.returncode != 0:
        print("FAILED: node driver error for %s: %s" % (kind, p.stderr[:500]),
              file=sys.stderr)
        sys.exit(1)
    return {json.loads(l)["n"]: json.loads(l)
            for l in p.stdout.splitlines() if l.strip()}

def main():
    path = os.path.join(HERE, "code", "test_vectors.json")
    tv = json.load(open(path, encoding="utf-8"))
    by_kind = {}
    for v in tv["vectors"]:
        by_kind.setdefault(v["kind"], {})[v["n"]] = v
    bad = 0
    for kind, want in sorted(by_kind.items()):
        lo, hi = min(want), max(want)
        got = gen(kind, lo, hi - lo + 1)
        for n in sorted(want):
            w = want[n]
            if n not in got:
                print("MISSING: engine did not return %s n=%d" % (kind, n)); bad += 1
                continue
            digest = hashlib.sha256(canonical(got[n])).hexdigest()
            if digest != w["sha256"]:
                print("MISMATCH: %s (%s n=%d)\n  want %s\n  got  %s"
                      % (w["id"], kind, n, w["sha256"], digest))
                bad += 1
            elif got[n]["id"] != w["id"]:
                print("MISMATCH id: %s vs %s" % (got[n]["id"], w["id"])); bad += 1
    if bad:
        print("FAIL: %d vector(s) mismatched" % bad)
        sys.exit(1)
    print("OK: %d vectors verified (engine %s)" % (len(tv["vectors"]), tv["engine"]))

if __name__ == "__main__":
    main()
