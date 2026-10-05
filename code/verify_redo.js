#!/usr/bin/env node
/* Studio redo verification (2026-10-04): tab bar on every page, front-door links,
   single-member gzip index, client hardening. Exit 0 = all pass. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), zlib = require("zlib");
const HERE = path.dirname(path.dirname(path.resolve(__filename)));
let pass = 0, fail = 0;
const pending = [];
function t(name, fn) {
  pending.push((async () => {
    try { await fn(); pass++; console.log("  ok " + name); }
    catch (e) { fail++; console.log("  FAIL " + name + " :: " + e.message); }
  })());
}
function assert(c, m) { if (!c) throw new Error(m || "assert"); }

const TABS = ["index.html","maker1.html","maker2.html","maker3.html","addon-sfx.html",
  "addon-backup.html","addon-chorus.html","studio-setup.html","songs.html","beats.html","library.html"];

// 1. every tab page exists, has #studionav near top, loads studio-core.js + theme css
for (const f of TABS) {
  t(f + " exists + tab bar slot + core assets", () => {
    const p = path.join(HERE, f);
    assert(fs.existsSync(p), "missing file");
    const s = fs.readFileSync(p, "utf8");
    assert(/id="studionav"/.test(s), "no #studionav");
    assert(/studio-core\.js/.test(s), "no studio-core.js");
    assert(/studio-theme\.css/.test(s), "no studio-theme.css");
    const bodyAt = s.indexOf("<body"), navAt = s.indexOf('id="studionav"');
    assert(navAt - bodyAt < 3000, "tab bar too far from top");
  });
}

// 2. SigStudio.nav renders 12 tabs, highlights current, links all others
t("tab bar renders 12 tabs with current highlighted", () => {
  const src = fs.readFileSync(path.join(HERE, "assets/studio-core.js"), "utf8");
  const sandbox = { window: {}, self: undefined };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const nav = sandbox.SigStudio.nav;
  for (const f of TABS) {
    const h = nav(f);
    const tabCount = (h.match(/role="tab"/g) || []).length;
    assert(tabCount === 12, f + ": got " + tabCount + " tabs");
    assert(/class="tab here"/.test(h), f + ": no highlighted tab");
    for (const g of TABS) if (g !== f) assert(h.indexOf('href="' + g + '"') >= 0, f + ": missing link to " + g);
  }
  const h0 = nav("index.html");
  assert(/Quick Song/.test(h0) && /Guided Builder/.test(h0) && /Full Studio/.test(h0), "kid-simple labels missing");
});

// 3. front door: hero + tab bar + start-here cards, NO record tables (Manon 2026-10-05 rule)
t("front door clean: tab bar + cards, no record tables", () => {
  const s = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  assert(/id="studionav"/.test(s), "no tab bar");
  assert(/id="startdoor"/.test(s), "no start-here cards");
  for (const g of TABS) if (g !== "index.html") assert(s.indexOf('href="' + g + '"') >= 0, "front door missing link " + g);
  for (const old of ['id="makestudio"', 'id="beatmaker"', 'id="songwriter"', 'id="vocalstudio"', 'id="cdmaker"', 'id="songgrid"', 'id="beatgrid"', 'id="staticcat"', 'STATIC-CAT-START', 'STATIC-CAT-END'])
    assert(s.indexOf(old) < 0, "record table/piled section still present on front door: " + old);
});

// 3b. archive tab page (songs.html) owns the static catalog: collapsed lazy groups
t("archive page owns static catalog: collapsed lazy groups", () => {
  const s = fs.readFileSync(path.join(HERE, "songs.html"), "utf8");
  assert(/STATIC-CAT-START/.test(s) && /STATIC-CAT-END/.test(s), "static catalog markers missing from songs.html");
  assert(/id="staticcat"/.test(s), "no #staticcat section on songs.html");
  for (const k of ["songs", "beats"]) {
    assert(new RegExp('<details class="catgroup" id="cat-' + k + '">').test(s), "catgroup details missing: " + k);
    const blob = s.match(new RegExp('<script type="application\\/json" id="catdata-' + k + '">([\\s\\S]*?)<\\/script>'));
    assert(blob && blob[1], "JSON blob missing: " + k);
    const rows = JSON.parse(blob[1]);
    assert(rows.length === 20, k + ": expected 20 rows, got " + rows.length);
    assert(!new RegExp('<details[^>]*open[^>]*id="cat-' + k + '"').test(s), "catgroup not collapsed by default: " + k);
  }
  assert(/<noscript>.*<table class="statictable"/s.test(s), "no-JS fallback table missing");
  assert(/details\.catgroup/.test(s) && /addEventListener\("toggle"/.test(s), "lazy toggle script missing");
});

// 4. index.json.gz is a SINGLE gzip member, all rows parse, chunks exist
t("compact index: browser DecompressionStream accepts it, rows valid, chunks resolve", () => {
  const p = path.join(HERE, "data/index/index.json.gz");
  const data = fs.readFileSync(p);
  return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then((txt) => {
    const lines = txt.split("\n").filter(Boolean);
    assert(lines.length > 20000, "too few rows: " + lines.length);
    const seen = new Set(); let badChunk = 0;
    for (const l of lines) {
      const r = JSON.parse(l);
      assert(r[0] && r[1] && r[2] && r[3], "bad row shape");
      seen.add(r[0]);
      if (!fs.existsSync(path.join(HERE, "data/records", r[3]))) badChunk++;
    }
    assert(badChunk === 0, badChunk + " rows point at missing chunks");
    console.log("    index rows: " + lines.length + " unique ids: " + seen.size);
  });
});

// 5. drip.py never appends to the index
t("drip.py writes index with wt (no append)", () => {
  const s = fs.readFileSync(path.join(HERE, "code/drip.py"), "utf8");
  assert(!/gzip\.open\(idx_path,\s*"at"/.test(s), "still appends!");
  assert(/"wt"/.test(s), "no wt rewrite");
});

// 6. songs.html: retry wrapper + random button never silently dies
t("songs.html hardened loader", () => {
  const s = fs.readFileSync(path.join(HERE, "songs.html"), "utf8");
  assert(/gunzipRetry/.test(s), "no retry wrapper");
  assert(!/if\s*\(!SONGS\.length\)\s*return;/.test(s), "random still silently returns");
  assert(/Archive still loading/.test(s), "no loading feedback on random");
});

(async () => {
  await Promise.all(pending);
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
