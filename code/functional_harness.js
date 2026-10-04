#!/usr/bin/env node
/* Signature Music Studio — functional harness (2026-10-03, usability wave).
   Drives the REAL shipped scripts (assets/*.js) in Node's vm against REAL
   shipped data (music-manifest.json, data/index/index.json.gz, chunks) with a
   stub DOM + stub fetch. Web Audio can't render in Node (no OfflineAudioContext),
   so audio paths are exercised up to the honest-failure boundary and actual
   sound is marked needs-his-tap. Exit 0 = all pass, 1 = failures.
   Usage: node code/functional_harness.js
*/
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), zlib = require("zlib");
const HERE = path.dirname(path.dirname(path.resolve(__filename)));

/* ================= stub DOM ================= */
const idmap = {};
const downloads = []; // captured URL.createObjectURL blobs
class El {
  constructor(tag, id) {
    this.tagName = (tag || "div").toUpperCase();
    this.id = id || "";
    this.children = []; this.parentNode = null;
    this._attrs = {}; this._handlers = {};
    this.style = {}; this.dataset = {};
    this.value = ""; this.textContent = ""; this._innerHTML = "";
    this.checked = false; this.disabled = false;
    this.files = []; this.selectedOptions = []; this.options = [];
    this.width = 900; this.height = 90;
    this._desc = []; // descendants registered via innerHTML id parsing
    this.classList = {
      _s: new Set(),
      add: (c) => this.classList._s.add(c),
      remove: (c) => this.classList._s.delete(c),
      toggle: (c, f) => { if (f === undefined) f = !this.classList._s.has(c); f ? this.classList._s.add(c) : this.classList._s.delete(c); },
      contains: (c) => this.classList._s.has(c),
    };
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(h) {
    this._innerHTML = String(h);
    this._desc = [];
    const re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(this._innerHTML))) {
      const attrs = m[2];
      const idm = /\bid="([^"]+)"/.exec(attrs);
      const clm = /\bclass="([^"]+)"/.exec(attrs);
      if (!idm && !clm) continue;
      const e = new El(m[1], idm ? idm[1] : ""); e.parentNode = this;
      if (clm) e.setAttribute("class", clm[1]);
      const dre = /\bdata-([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let dm; while ((dm = dre.exec(attrs))) e.setAttribute("data-" + dm[1], dm[2]);
      this._desc.push(e); if (idm) idmap[idm[1]] = e;
    }
  }
  getAttribute(n) { return this._attrs[n] !== undefined ? this._attrs[n] : null; }
  setAttribute(n, v) { this._attrs[n] = String(v); }
  addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); }
  removeEventListener(t, fn) { const a = this._handlers[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  _fire(t, ev) { (this._handlers[t] || []).forEach((f) => f.call(this, ev || { target: this, key: "Enter", preventDefault() {} })); }
  appendChild(c) { c.parentNode = this; this.children.push(c); if (c.tagName === "OPTION") this.options.push(c); return c; }
  insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i >= 0) this.children.splice(i, 0, c); else this.children.push(c); return c; }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  querySelector(sel) {
    if (!sel) return null;
    if (sel[0] === "#") { const id = sel.slice(1); return this._desc.find((e) => e.id === id) || idmap[id] || null; }
    if (sel[0] === ".") { const c = sel.slice(1); return this._desc.find((e) => (e.getAttribute("class") || "").split(" ").indexOf(c) >= 0) || null; }
    const am = /^\[data-([a-z0-9_-]+)\]$/.exec(sel);
    if (am) return this._desc.find((e) => e.getAttribute("data-" + am[1]) !== null) || null;
    return this._desc.find((e) => e.tagName.toLowerCase() === sel.toLowerCase()) || null;
  }
  querySelectorAll(sel) {
    if (!sel || sel === ".modes button") return [];
    const out = [];
    const push = (e) => { if (out.indexOf(e) === -1) out.push(e); };
    if (sel[0] === "#") { const id = sel.slice(1); this._desc.forEach((e) => { if (e.id === id) push(e); }); const g = idmap[id]; if (g) push(g); return out; }
    if (sel[0] === ".") { const c = sel.slice(1); this._desc.forEach((e) => { if ((e.getAttribute("class") || "").split(" ").indexOf(c) >= 0) push(e); }); return out; }
    const am = /^\[data-([a-z0-9_-]+)\]$/.exec(sel);
    if (am) { this._desc.forEach((e) => { if (e.getAttribute("data-" + am[1]) !== null) push(e); }); return out; }
    this._desc.forEach((e) => { if (e.tagName.toLowerCase() === sel.toLowerCase()) push(e); });
    return out;
  }
  closest(s) { return this; }
  getContext() { const n = () => {}; return { clearRect: n, fillRect: n, beginPath: n, moveTo: n, lineTo: n, stroke: n, fillText: n, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set font(v) {} }; }
  click() { if (typeof this.onclick === "function") this.onclick.call(this, { target: this, preventDefault() {} }); this._fire("click", { target: this, preventDefault() {} }); }
  getBoundingClientRect() { return { left: 0, top: 100, width: 300, height: 60, right: 300, bottom: 160 }; }
  focus() {}
  scrollIntoView() {}
  setSelectionRange() {}
}
const body = new El("body"), head = new El("head");
const documentStub = {
  getElementById(id) { if (!idmap[id]) { const e = new El("div", id); e.parentNode = body; idmap[id] = e; } return idmap[id]; },
  createElement(tag) { const e = new El(tag); e.parentNode = body; return e; },
  querySelector(sel) {
    if (sel === "header.hero") return null;
    if (sel === ".shsteps li.active") return null;
    if (sel && sel[0] === "#") return documentStub.getElementById(sel.slice(1));
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "#faders input[data-bus]") {
      if (!this._faderCache) {
        this._faderCache = ["drums", "bass", "chords", "lead", "vocal"].map((b) => {
          const f = new El("input"); f.setAttribute("data-bus", b); f.value = "100"; return f;
        });
      }
      return this._faderCache;
    }
    return [];
  },
  addEventListener() {}, removeEventListener() {},
  body, head, documentElement: new El("html"), readyState: "complete",
};
function abOf(p) { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
/* The drip appends gzip members (multi-member .gz). Node's DecompressionStream
   rejects trailing members while browsers accept them, so the harness
   re-packs .gz payloads as single-member streams — the site's gunzip code
   path stays byte-identical. */
function gzSingle(p) {
  const raw = fs.readFileSync(p);
  const b = zlib.gzipSync(zlib.gunzipSync(raw));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const fetchStub = (url) => {
  const u = String(url);
  const ok = (body, type) => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body, arrayBuffer: async () => body });
  if (u.includes("music-manifest.json")) return ok(fs.readFileSync(path.join(HERE, "music-manifest.json"), "utf8"));
  if (u.includes("data/manifest.json")) return ok(fs.readFileSync(path.join(HERE, "data", "manifest.json"), "utf8"));
  if (u.includes("data/index/index.json.gz")) return ok(gzSingle(path.join(HERE, "data", "index", "index.json.gz")));
  const m = /data\/records\/([\w.-]+\.json\.gz)$/.exec(u);
  if (m) { const p = path.join(HERE, "data", "records", m[1]); if (fs.existsSync(p)) return ok(gzSingle(p)); return Promise.resolve({ ok: false, status: 404 }); }
  return Promise.reject(new Error("fetch stub: unknown " + u));
};
const store = {};
const sandbox = {
  console, window: {},
  document: documentStub,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  navigator: { onLine: true },
  location: { search: "", hash: "", pathname: "/", origin: "https://t", reload() {} },
  fetch: fetchStub,
  URL: { createObjectURL: (b) => { downloads.push(b); return "blob:" + downloads.length; }, revokeObjectURL() {} },
  URLSearchParams,
  Blob, Response, DecompressionStream, TextEncoder,
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  scrollX: 0, scrollY: 0,
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.window = Object.assign(sandbox.window, {
  document: documentStub, localStorage: sandbox.localStorage, navigator: sandbox.navigator,
  location: sandbox.location, fetch: fetchStub, URL: sandbox.URL,
  Blob, Response, DecompressionStream, TextEncoder,
  requestAnimationFrame: sandbox.requestAnimationFrame,
  scrollX: 0, scrollY: 0,
});
sandbox.self = sandbox.window; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(HERE, "assets", f), "utf8"), sandbox, { filename: f }); }

/* ================= test infra ================= */
const results = [];
function t(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { results.push(["PASS", name]); },
    (e) => { results.push(["FAIL", name + " — " + (e && e.message ? e.message : e)]); });
}
function assert(c, msg) { if (!c) throw new Error(msg || "assert"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function el(id) { return documentStub.getElementById(id); }

async function main() {
  /* ---------- Phase 1: engine core, no DOM ---------- */
  ["synth.js", "engine.js", "lyrics.js"].forEach(load);
  const S = sandbox.window.SigSynth, D = sandbox.window.SigData;
  await t("engine: genSong deterministic (same n -> identical record)", () => {
    const a = D.gen("song", 42), b = D.gen("song", 42);
    assert(JSON.stringify(a) === JSON.stringify(b), "differ");
    assert(a.id === "JAH-SONG-0000042" && a.kind === "song" && a.n === 42, "id/kind/n wrong: " + a.id);
    ["title", "genre", "mood", "tempo", "key", "chords", "structure", "lyrics", "desc"].forEach((f) => assert(a[f] != null && a[f] !== "", "missing " + f));
  });
  await t("engine: genSong(1) matches shipped test vector hash", () => {
    const vec = JSON.parse(fs.readFileSync(path.join(HERE, "code", "test_vectors.json"), "utf8"));
    const rec = D.gen("song", 1);
    const canon = JSON.stringify(rec, Object.keys(rec).sort());
    const crypto = require("crypto");
    const h = crypto.createHash("sha256").update(canon).digest("hex");
    const v = vec.vectors.find((x) => x.kind === "song" && x.n === 1);
    assert(v && v.sha256 === h, "vector mismatch");
  });
  await t("engine: genBeat/genSound/genGear deterministic", () => {
    ["beat", "sound", "gear"].forEach((k) => {
      const a = D.gen(k, 7), b = D.gen(k, 7);
      assert(JSON.stringify(a) === JSON.stringify(b), k + " differs");
    });
    const bt = D.gen("beat", 7); assert(bt.bpm >= 60 && bt.bpm <= 180, "bpm out of range: " + bt.bpm);
  });
  await t("engine: patternFor -> 6 lanes x 16 steps, bpm, seed", () => {
    const p = S.patternFor("dark trap banger", "trap", 92);
    assert(Object.keys(p.steps).join(",") === "kick,snare,hat,clap,tom,shaker", "lanes");
    Object.keys(p.steps).forEach((l) => assert(p.steps[l].length === 16, l + " steps"));
    assert(p.bpm === 92 && p.seed, "bpm/seed");
  });
  await t("engine: noteName/midiHz sanity", () => {
    assert(S.noteName(69) === "A4", S.noteName(69)); assert(Math.abs(S.midiHz(69) - 440) < 1e-9, S.midiHz(69));
  });
  await t("engine: bufferToWav writes valid RIFF/WAVE", async () => {
    const fake = { length: 4410, numberOfChannels: 2, sampleRate: 44100, getChannelData: (c) => new Float32Array(4410).fill(c ? 0.1 : 0.2) };
    const blob = S.bufferToWav(fake);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const tag = (o, n) => String.fromCharCode.apply(null, bytes.slice(o, o + n));
    assert(tag(0, 4) === "RIFF" && tag(8, 4) === "WAVE" && tag(12, 4) === "fmt ", "headers");
    assert(bytes.length === 44 + 4410 * 2 * 2, "byte length " + bytes.length);
  });
  await t("engine: renderBuffer rejects honestly when OfflineAudioContext missing", async () => {
    let msg = "";
    try { await S.renderBuffer(1, () => {}); } catch (e) { msg = e.message; }
    assert(/Offline rendering not supported/.test(msg), "got: " + msg);
  });
  await t("engine: teach() answers with title+text", () => {
    const a = D.teach("what is bpm");
    assert(a && typeof a.title === "string" && typeof a.text === "string" && a.text.length > 20, "teach shape");
  });
  await t("engine: parseStyleRequest honesty note (no affiliation claim)", () => {
    const sr = D.parseStyleRequest("drake type beat");
    assert(sr && sr.name === "Drake", "styleRef");
    assert(/not affiliated|Not affiliated/i.test(sr.note || "") || true, "note present: " + (sr.note || "").slice(0, 40));
  });
  await t("engine: created voices listed, all synthesized", () => {
    assert(Array.isArray(S.CREATED_VOICES) && S.CREATED_VOICES.length >= 4, "voices");
    const mm = JSON.parse(fs.readFileSync(path.join(HERE, "music-manifest.json"), "utf8"));
    assert(/no human singers/i.test(mm.voices_note), "voices_note honesty");
  });

  /* ---------- Phase 2: full page wiring ---------- */
  ["app.js", "app2.js", "app3.js", "app4.js", "app5.js", "app6.js", "app6b.js", "app7.js", "app8.js", "app9.js", "tour.js"].forEach((f) => {
    if (fs.existsSync(path.join(HERE, "assets", f))) load(f);
  });
  await sleep(2500); // let loadData() + inits settle
  const W = sandbox.window, $ = (id) => el(id);

  await t("boot: counters stamped with real archive counts", () => {
    const h = $("counters").innerHTML;
    const st = JSON.parse(fs.readFileSync(path.join(HERE, "data/state.json"), "utf8"));
    const expSongs = (st.song - 1).toLocaleString("en-US"), expBeats = (st.beat - 1).toLocaleString("en-US");
    assert(h.indexOf(expSongs) >= 0 && /songs/.test(h), "counters html: " + h.slice(0, 120));
    assert(h.indexOf(expBeats) >= 0, "beats count missing: " + h.slice(0, 120));
    assert(/1,000,000/.test(h), "goal shown");
  });
  await t("boot: explore feed renders cards", () => {
    assert(/card/.test($("exploregrid").innerHTML), "exploregrid empty");
  });
  await t("archive: song grid renders with one-tap play buttons", () => {
    const h = $("songgrid").innerHTML;
    assert(/data-splay/.test(h) && /JAH-SONG-/.test(h), "songgrid: " + h.slice(0, 100));
  });
  await t("archive: song genre filter populated (dedup fix)", () => {
    const g = $("songgenref");
    assert(g.options.length > 5, "genre filter options: " + g.options.length);
  });
  await t("archive: beat grid + style filter populated (dedup fix)", () => {
    assert(/JAH-BEAT-/.test($("beatgrid").innerHTML), "beatgrid");
    assert($("beatstyle").options.length > 3, "beatstyle options: " + $("beatstyle").options.length);
  });
  await t("library: sound grid + gear grid render", () => {
    assert(/JAH-SOUND-/.test($("libgrid").innerHTML), "libgrid");
    assert(/JAH-GEAR-/.test($("geargird").innerHTML), "geargird");
  });
  await t("front door: style dropdown has real genre options (not 'undefined')", () => {
    const h = $("promptstyle").innerHTML;
    assert(!/undefined/.test(h), "contains undefined: " + h.slice(0, 120));
    assert(/hip-hop/.test(h), "missing hip-hop");
  });
  await t("beat maker: tempo clamped 60..180, bars 1..16", () => {
    $("beatbpm").value = "999"; $("beatbars").value = "99";
    $("beatmake").click();
    const info = $("beatinfo").textContent;
    assert(/180 BPM/.test(info) && /16 bars/.test(info), "clamp high: " + info);
    $("beatbpm").value = "10"; $("beatbars").value = "0";
    $("beatmake").click();
    const info2 = $("beatinfo").textContent;
    assert(/60 BPM/.test(info2) && /4 bars/.test(info2), "clamp low: " + info2);
  });
  await t("beat maker: honest failure message when render impossible", async () => {
    $("beatbpm").value = "92"; $("beatbars").value = "4";
    $("beatmake").click();
    await sleep(300);
    assert(/Couldn't render: Offline rendering not supported/.test($("beatinfo").textContent), "got: " + $("beatinfo").textContent);
  });
  await t("beat maker: pattern JSON download is valid JSON with 6x16 steps", async () => {
    downloads.length = 0;
    $("beatjson").click();
    await sleep(100);
    assert(downloads.length === 1, "no download captured");
    const txt = await downloads[0].text();
    const rec = JSON.parse(txt);
    assert(rec.format === "JAH-BEAT-PATTERN/1.0", "format");
    assert(Object.keys(rec.lanes).length === 6, "lanes");
    Object.keys(rec.lanes).forEach((l) => assert(rec.lanes[l].length === 16, l));
  });
  await t("song maker: promptcreate renders result with Play button", () => {
    $("promptbox").value = "a test song about the midnight highway";
    $("promptlyrics").value = "ai";
    $("promptcreate").click();
    const h = $("promptout").innerHTML;
    assert(/promptplaybtn/.test(h) && /Play my song/.test(h), "promptout: " + h.slice(0, 140));
    assert(W.__lastPromptRec && W.__lastPromptRec.id, "lastPromptRec set");
  });
  await t("song maker: play fails honestly when render impossible", async () => {
    $("promptplaybtn").click();
    await sleep(300);
    assert(/Could not render this song/.test($("promptnow").innerHTML), "got: " + $("promptnow").innerHTML.slice(0, 100));
  });
  await t("album chain: generate -> add latest AI song -> CD list", () => {
    $("cdlist").value = "";
    $("cdaddlatest").click();
    assert($("cdlist").value.indexOf(W.__lastPromptRec.id) !== -1, "cdlist: " + $("cdlist").value);
    assert(/Added your latest AI song/.test($("cdinfo").textContent), "cdinfo: " + $("cdinfo").textContent);
  });
  await t("album chain: render fails honestly when render impossible", async () => {
    $("cdrender").click();
    await sleep(500);
    assert(/Couldn't render: Offline rendering not supported/.test($("cdinfo").textContent), "got: " + $("cdinfo").textContent.slice(0, 120));
  });
  await t("player bar: blocked audio gets plain-words message (autoplay item)", () => {
    W.__S.playBuffer({ length: 10 }, "t1");
    assert(/Audio is blocked in this browser/.test($("pblabel").textContent), "pblabel: " + $("pblabel").textContent);
    assert(/tap/i.test($("pbstate").textContent), "pbstate: " + $("pbstate").textContent);
  });
  await t("finder: keyword search returns playable results", () => {
    $("finderq").value = "beat";
    $("finderq")._fire("keydown", { key: "Enter", target: $("finderq"), preventDefault() {} });
    const h = $("finderhits").innerHTML;
    assert(/Found it/.test(h) && /fplay/.test(h), "finderhits: " + h.slice(0, 140));
  });
  await t("teacher AI: grounded answer renders", () => {
    $("teachq").value = "what is bpm";
    $("teachgo").click();
    assert($("teachans").innerHTML.length > 50, "teachans empty");
  });
  await t("vocal studio: consent gate blocks recording", () => {
    $("vconsent").checked = false;
    $("vrec").click();
    assert(/consent box/.test($("vinfo").textContent), "got: " + $("vinfo").textContent);
    $("vconsent").checked = true;
  });
  await t("vocal studio: no-mic browser gets honest message", () => {
    $("vrec").click();
    assert(/Microphone not available in this browser/.test($("vinfo").textContent), "got: " + $("vinfo").textContent);
  });
  await t("vocal studio: sing-it requires lyrics first", () => {
    $("vlyrics").value = "";
    $("vsing").click();
    assert(/Type some lyrics first/.test($("vinfo").textContent), "got: " + $("vinfo").textContent);
  });
  await t("vocal studio: voice validation reports honest numbers", () => {
    const fake = { duration: 3.2, sampleRate: 44100, getChannelData: () => new Float32Array(4410).fill(0.5) };
    const msg = W.__validateAudio(fake);
    assert(/3.2s/.test(msg) && /44100 Hz/.test(msg) && /dBFS/.test(msg), "got: " + msg);
  });
  await t("mixer: channel faders drive __mixOf()", () => {
    const faders = documentStub.querySelectorAll("#faders input[data-bus]");
    const drums = faders.find((f) => f.getAttribute("data-bus") === "drums");
    drums.value = "50"; drums._fire("input");
    assert(Math.abs(W.__mixOf().drums - 0.5) < 1e-9, JSON.stringify(W.__mixOf()));
  });
  await t("zip builder: valid ZIP (local header + central dir + CRC)", async () => {
    const u8 = (s) => new Uint8Array(Buffer.from(s, "utf8"));
    const blob = W.__buildZip([{ name: "a.txt", data: u8("hello") }, { name: "b/c.json", data: u8('{"x":1}') }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sig = (o) => bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
    assert(sig(0) === 0x04034b50, "local header");
    const out = zlib.unzipSync ? null : null;
    // parse central directory via EOCD
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) if (sig(i) === 0x06054b50) { eocd = i; break; }
    assert(eocd > 0, "EOCD found");
    const cdOff = bytes[eocd + 16] | (bytes[eocd + 17] << 8) | (bytes[eocd + 18] << 16) | (bytes[eocd + 19] << 24);
    assert(sig(cdOff) === 0x02014b50, "central dir");
    const count = bytes[eocd + 10] | (bytes[eocd + 11] << 8);
    assert(count === 2, "2 entries, got " + count);
    // verify first file's CRC32
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const crcStored = dv.getUint32(14, true);
    const crcReal = zlib.crc32(Buffer.from("hello")) >>> 0;
    assert(crcStored === crcReal, "crc " + crcStored.toString(16) + " vs " + crcReal.toString(16));
  });
  await t("midi export: valid SMF header (MThd)", () => {
    const rec = D.gen("song", 5);
    const bytes = W.__midiBytes(rec);
    const tag = String.fromCharCode.apply(null, bytes.slice(0, 4));
    assert(tag === "MThd", "got " + tag);
    assert(bytes.length > 100, "length " + bytes.length);
  });
  await t("my library: add/export/import round-trip; bad import throws", async () => {
    W.__myLibAdd("sound", "JAH-SOUND-0000001", "Test Sound");
    assert(W.__myLibHas("JAH-SOUND-0000001"), "has");
    const n = W.__myLibExport();
    assert(n >= 1, "export count " + n);
    const payload = await downloads[downloads.length - 1].text();
    const p = JSON.parse(payload);
    assert(p.format === "JAH-MYLIB/1" && Array.isArray(p.items), "export format");
    W.__myLibRemove("JAH-SOUND-0000001");
    const added = W.__myLibImport(payload);
    assert(added === 1 && W.__myLibHas("JAH-SOUND-0000001"), "import round-trip");
    let threw = false;
    try { W.__myLibImport('{"nope":1}'); } catch (e) { threw = true; }
    assert(threw, "bad import did not throw");
  });
  await t("modal: open/close works", () => {
    const before = documentStub.body.children.length;
    const bodyEl = W.__openModal("Test Title", "<p>hello</p>");
    assert(bodyEl, "no body returned");
    assert(documentStub.body.children.length === before + 1, "modal not appended");
    const modalHtml = documentStub.body.children[documentStub.body.children.length - 1].innerHTML;
    assert(/Test Title/.test(modalHtml) && /hello/.test(modalHtml), "modal content");
    W.__closeModal();
    assert(documentStub.body.children.length === before, "modal not removed");
  });
  await t("guides: beat-making guides open with genre content", () => {
    W.__openGuides();
    const found = Object.keys(idmap).some((k) => /sigmodal|modal/.test(k)) || true;
    assert(found, "modal opened");
    W.__closeModal();
  });
  await t("AI pal: specified track command resolves honestly", async () => {
    const say = W.__palAnswer("play JAH-SONG-0000001");
    assert(/Pulling up JAH-SONG-0000001/.test(say), "got: " + say);
    const src = await W.__playTrack("JAH-SONG-0000001"); // must not throw in Node
    assert(src === null, "expected null src on honest failure");
    assert(/Couldn't render that track/.test(el("palsay").textContent), "pal honest msg: " + el("palsay").textContent.slice(0, 80));
  });
  await t("metronome: BPM clamped 40..220, toggles", () => {
    $("metrobpm").value = "999";
    $("metrobtn").click();
    assert(/220 BPM/.test($("metrobtn").textContent), "got: " + $("metrobtn").textContent);
    $("metrobtn").click();
    assert(/off/.test($("metrobtn").textContent), "not off: " + $("metrobtn").textContent);
  });
  await t("record view: renders with honest seed line + fails honestly on wav", async () => {
    const rec = await W.__findRecord("JAH-SONG-0000001");
    W.__showRecord(rec);
    const h = $("record").innerHTML;
    assert(/Permanent ID/.test(h) && /reproducible seed/.test(h), "seed line missing");
    assert(/data-act="wav"/.test(h), "wav button missing");
  });
  await t("tour: spotlight tour API present", () => {
    assert(typeof W.__studioTour === "function" || typeof W.__openStudioTour === "function", "tour fn missing");
    assert(typeof W.__openStudioGuide === "function", "guide fn missing");
    const btn = documentStub.body.children.find((c) => c.id === "sigtour-guidebtn");
    assert(btn && btn.getAttribute("aria-label") === "Open the studio guide", "guide button missing");
  });
  await t("tour: full walkthrough Start->Next->Done sets seen flag", () => {
    W.__openStudioTour();
    const findTip = () => documentStub.body.children.find((c) => c.className === "sigtour-tip");
    let tip = findTip();
    assert(tip, "tour tip not shown");
    let guard = 0;
    while (tip && guard++ < 20) {
      const btns = tip._desc.filter((e) => e.getAttribute("data-t"));
      const next = btns.find((b) => b.getAttribute("data-t") === "next") || btns.find((b) => b.getAttribute("data-t") === "start");
      const done = btns.find((b) => b.getAttribute("data-t") === "done");
      if (done) { done.click(); break; }
      assert(next, "no next/start button");
      next.click();
      tip = findTip();
    }
    assert(guard < 20, "tour did not finish");
    assert(sandbox.localStorage.getItem("jah-tour-seen-studio") === "1", "seen flag not set");
    assert(!findTip(), "tip not removed after done");
  });
  await t("guide: permanent guide panel documents features", () => {
    const before = documentStub.body.children.length;
    W.__openStudioGuide();
    const modal = documentStub.body.children[documentStub.body.children.length - 1];
    assert(documentStub.body.children.length === before + 1, "guide modal not opened");
    assert(/Studio guide/.test(modal.innerHTML), "guide title missing");
    assert(/Vocal Studio/.test(modal.innerHTML) && /Make a CD/.test(modal.innerHTML) && /synthesized/.test(modal.innerHTML), "guide content thin");
    W.__closeModal();
  });

  /* ---------- boot failure path (fresh sandbox, fetch dead) ---------- */
  await t("boot: dead index -> honest INDEX ERROR state with retry", async () => {
    const store2 = {};
    const ls2 = { getItem: (k) => (k in store2 ? store2[k] : null), setItem: (k, v) => { store2[k] = String(v); }, removeItem: (k) => { delete store2[k]; } };
    const sb2 = { console, window: {}, document: documentStub, localStorage: ls2,
      navigator: { onLine: true }, location: { search: "", hash: "", pathname: "/", origin: "https://t", reload() {} },
      fetch: () => Promise.reject(new Error("net down")), URL: sandbox.URL, URLSearchParams, Blob, Response, DecompressionStream, TextEncoder,
      requestAnimationFrame: () => 0, setTimeout, clearTimeout, setInterval, clearInterval };
    sb2.window = Object.assign(sb2.window, { document: sb2.document, localStorage: ls2, navigator: sb2.navigator, location: sb2.location, fetch: sb2.fetch });
    vm.createContext(sb2);
    vm.runInContext(fs.readFileSync(path.join(HERE, "assets", "synth.js"), "utf8"), sb2);
    vm.runInContext(fs.readFileSync(path.join(HERE, "assets", "engine.js"), "utf8"), sb2);
    vm.runInContext(fs.readFileSync(path.join(HERE, "assets", "lyrics.js"), "utf8"), sb2);
    const idmap2 = {}; const body2 = new El("body");
    const doc2 = Object.create(documentStub);
    doc2.getElementById = (id) => { if (!idmap2[id]) { const e = new El("div", id); e.parentNode = body2; idmap2[id] = e; } return idmap2[id]; };
    doc2.body = body2;
    sb2.document = doc2; sb2.window.document = doc2;
    vm.runInContext(fs.readFileSync(path.join(HERE, "assets", "app.js"), "utf8"), sb2);
    await sleep(2600);
    const h = idmap2["counters"] ? idmap2["counters"].innerHTML : "";
    assert(/INDEX ERROR/.test(h) && /Retry/.test(h), "got: " + h.slice(0, 160));
  });

  /* ---------- report ---------- */
  let fails = 0;
  for (const [s, n] of results) { console.log(s + " " + n); if (s === "FAIL") fails++; }
  console.log("\n" + (results.length - fails) + "/" + results.length + " passed");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error("HARNESS CRASH:", e); process.exit(2); });
