/* ============================================================
   Signature Music Studio — app wiring.
   ============================================================ */
(function () {
  "use strict";
  var S = window.SigSynth, D = window.SigData;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dl(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  function gunzip(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("fetch " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); });
  }

  /* ---------- 25-site JAH Network nav ---------- */
  var NAV = [
    ["The Signature AI Phone Book", "jah-ai-models"], ["Calculator", "jah-calculator"], ["Dictionary", "jah-dictionary"],
    ["JAH Wiki", "jah-wiki"], ["JAH-N Wiki", "jah-n-wiki-leaks"], ["Patent Catalog", "cyber-patent-catalog"],
    ["Spec Catalog", "signature-one-archive/specs.html"], ["Signature Llama", "signature-llama"], ["PC Depository", "jah-computer-systems"],
    ["Cyber Mega-Mall", "signature-cyber-mega-mall"], ["Signature University", "signature-university"], ["Book Depository", "signature-books"],
    ["Comic Store", "signature-comics"], ["Global Newspaper Archive", "signature-newspapers"], ["3D Print Depository", "signature-3d-print"],
    ["Mad Scientist Lab", "signature-backend"], ["Boundless Generator Archive", "signature-boundless-generators"], ["AI Mix Lab", "signature-ai-mixlab"],
    ["AI Olypics", "signature-ai-olypics"], ["Chip Maker and Archive", "signature-chip-maker"], ["App Archive", "signature-app-archive"],
    ["AI Robot Matcher", "signature-ai-robot-matcher"], ["Experiment Solver", "signature-experiment-solver"], ["Signature AI Pixel", "signature-ai-image-video-maker"]
  ];
  function buildNav(el, selfIx) {
    var h = "<b>THE JAH NETWORK</b> ", i;
    for (i = 0; i < NAV.length; i++) {
      h += '<a href="https://justinahiggins614-cmyk.github.io/' + NAV[i][1] + '/">' + (i + 1) + " " + esc(NAV[i][0]) + "</a>";
    }
    h += '<span class="here">25 Signature Music Studio — YOU ARE HERE</span>';
    el.innerHTML = h;
  }
  buildNav($("jahnet")); buildNav($("jahnet2"));

  /* ---------- mode toggle ---------- */
  var MODE = "self";
  var MODENOTE = { self: "Mode: make it yourself — you set every control.", ai: "Mode: let the AI make it — one click generates a finished result.", collab: "Mode: collaborate — the AI drafts, you adjust." };
  Array.prototype.forEach.call(document.querySelectorAll(".modes button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".modes button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on"); MODE = b.getAttribute("data-mode"); $("modeline").textContent = MODENOTE[MODE];
    });
  });

  /* ---------- tiered read-aloud (speechSynthesis -> ResponsiveVoice -> Google TTS) ----------
     BUG FIX 2026-10-02: Facebook's in-app browser has NO speechSynthesis.
     The old code then waited on a 9-second ResponsiveVoice script timeout
     before falling to Google TTS — the tap appeared dead. Now: no
     speechSynthesis -> straight to Google TTS audio, instantly, inside
     the tap gesture. */
  var readQueue = [], reading = false, readText = "";
  function speakTier(text, done) {
    try {
      if ("speechSynthesis" in window && window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(text); u.rate = 1; u.onend = done; u.onerror = done;
        speechSynthesis.cancel(); speechSynthesis.speak(u); return;
      }
    } catch (e) {}
    tier3(text, done);
  }
  function tier2(text, done) {
    try {
      if (window.responsiveVoice) { responsiveVoice.speak(text, "US English Female", { onend: done, onerror: done }); return; }
    } catch (e) {}
    var s = document.createElement("script");
    s.src = "https://code.responsivevoice.org/responsivevoice.js?key=SUB-KEY";
    s.onload = function () { try { responsiveVoice.speak(text, "US English Female", { onend: done, onerror: done }); } catch (e) { tier3(text, done); } };
    s.onerror = function () { tier3(text, done); };
    setTimeout(function () { tier3(text, done); }, 9000);
    document.head.appendChild(s);
  }
  function tier3(text, done) {
    try {
      var a = new Audio("https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" + encodeURIComponent(text.slice(0, 180)));
      a.onended = done; a.onerror = done; a.play().catch(done);
    } catch (e) { done(); }
  }
  function readAloud(text, label) {
    readText = text; $("readlabel").textContent = "Reading: " + (label || "selection"); $("readbar").style.display = "block";
    speakTier(text, function () { if (reading) nextChunk(); });
    reading = true;
  }
  function nextChunk() { reading = false; $("readbar").style.display = "none"; }
  $("readstop").onclick = function () { try { speechSynthesis.cancel(); } catch (e) {} try { responsiveVoice.cancel(); } catch (e) {} reading = false; $("readbar").style.display = "none"; };
  $("readclose").onclick = $("readstop").onclick;
  $("readplay").onclick = function () { if (readText) readAloud(readText); };

  /* ---------- data ---------- */
  var IDX = [], MANIFEST = null;
  function loadData() {
    return Promise.all([
      fetch("data/manifest.json").then(function (r) { return r.json(); }).then(function (m) { MANIFEST = m; }),
      gunzip("data/index/index.json.gz").then(function (t) { IDX = t.split("\n").filter(Boolean).map(JSON.parse); })
    ]).then(function () {
      var songs = IDX.filter(function (r) { return r[2] === "song"; }).length;
      var lib = IDX.filter(function (r) { return r[2] === "sound"; }).length;
      var gear = IDX.filter(function (r) { return r[2] === "gear"; }).length;
      var beats = IDX.filter(function (r) { return r[2] === "beat"; }).length;
      $("counters").innerHTML = "📀 <b>" + songs.toLocaleString() + "</b> / 1,000,000 songs &nbsp;·&nbsp; 🎛️ <b>" + lib.toLocaleString() + "</b> / 1,000,000 instruments, sets &amp; packs &nbsp;·&nbsp; 🥁 <b>" + beats.toLocaleString() + "</b> beats &nbsp;·&nbsp; 🎚️ <b>" + gear.toLocaleString() + "</b> equipment records";
      $("libcount").textContent = "(" + lib.toLocaleString() + " / 1,000,000)";
    }).catch(function () { $("counters").textContent = "Archive loading…"; });
  }
  function findRecord(id) {
    var row = null, i;
    for (i = 0; i < IDX.length; i++) if (IDX[i][0] === id) row = IDX[i];
    if (!row) {
      // deterministic fallback: generate directly from the ID number
      var m = /^JAH-(SONG|SOUND|GEAR|BEAT)-(\d+)$/.exec(id);
      if (!m) return Promise.reject(new Error("bad id"));
      var kind = m[1] === "SONG" ? "song" : m[1] === "SOUND" ? "sound" : m[1] === "BEAT" ? "beat" : "gear";
      return Promise.resolve(D.gen(kind, parseInt(m[2], 10)));
    }
    return gunzip("data/records/" + row[3]).then(function (t) {
      var lines = t.split("\n"), j;
      for (j = 0; j < lines.length; j++) { if (!lines[j]) continue; var r = JSON.parse(lines[j]); if (r.id === id) return r; }
      throw new Error("not found");
    });
  }

  /* ---------- Finder AI (keyword -> existing search -> top 5 cards, inline play) ----------
     His order 2026-10-02: the Finder AI must PULL UP the beat/song and PLAY it for
     the user right in the results — real action, never an empty promise. Tap ▶ on a
     result: unlockAudio() runs SYNCHRONOUSLY inside the tap gesture (his phone's
     in-app browser suspends AudioContext otherwise), then the real record renders
     and playBuffer starts it. Now-playing state is shown ONLY when playBuffer
     actually returns a live source; if the browser blocks audio we say so in plain
     words — never faked. */
  var STOP = { "the": 1, "and": 1, "for": 1, "with": 1, "from": 1, "that": 1, "this": 1, "what": 1, "make": 1, "song": 1 };
  var _finderLiveId = "finder";
  function finderStopAll() {
    try { S.stopLive(_finderLiveId); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll("#finderhits .fplay"), function (b) {
      b.textContent = b.getAttribute("data-label") || "▶ Play";
      b.disabled = false;
    });
    Array.prototype.forEach.call(document.querySelectorAll("#finderhits .fnow"), function (n) { n.innerHTML = ""; });
  }
  function finderRenderFail(btn, nowEl, msg) {
    btn.textContent = btn.getAttribute("data-label") || "▶ Play";
    btn.disabled = false;
    nowEl.innerHTML = '<span class="fblocked">' + esc(msg) + "</span>";
  }
  function finderPlayStarted(buf, btn, nowEl, label) {
    var src = null;
    try { src = S.playBuffer(buf, _finderLiveId); } catch (e) { src = null; }
    if (!src) {
      // Honest: the browser held the audio. Never fake "now playing".
      finderRenderFail(btn, nowEl, 'Audio is blocked in this browser — tap ▶ again, or use "Take me there →" to play on the record page.');
      return;
    }
    btn.textContent = "♪ Playing…";
    btn.disabled = true;
    nowEl.innerHTML = '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span><span>Now playing' + (label ? " — " + esc(label) : "") + '</span><button class="fstop" type="button">■ Stop</button>';
    var st = nowEl.querySelector(".fstop");
    if (st) st.onclick = function () { try { S.unlockAudio(); } catch (e2) {} finderStopAll(); };
  }
  function finderPlayBeat(rec, btn, nowEl) {
    try { S.unlockAudio(); } catch (e) {} /* synchronous, inside the tap gesture */
    finderStopAll();
    btn.textContent = "Rendering…"; btn.disabled = true;
    var pat = S.patternFor(rec.name, rec.style, rec.bpm);
    S.renderBuffer(16 * (60 / rec.bpm / 4) * 4 + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 4, 1); })
      .then(function (buf) { finderPlayStarted(buf, btn, nowEl, rec.name); },
        function () { finderRenderFail(btn, nowEl, "Could not render this beat."); });
  }
  function finderPlaySong(rec, btn, nowEl) {
    try { S.unlockAudio(); } catch (e) {} /* synchronous, inside the tap gesture */
    finderStopAll();
    btn.textContent = "Rendering…"; btn.disabled = true;
    S.renderSong(rec, 30, window.__mixOf ? window.__mixOf() : null)
      .then(function (buf) { finderPlayStarted(buf, btn, nowEl, (rec.title || rec.id) + " · 30s preview"); },
        function () { finderRenderFail(btn, nowEl, "Could not render this song."); });
  }
  function finderGo() {
    var q = $("finderq").value.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    var words = q.split(/\s+/).filter(function (w) { return w.length >= 3 && !STOP[w]; });
    var scored = IDX.map(function (r) {
      var hay = (r[1] + " " + r[2]).toLowerCase(), s = 0, i;
      for (i = 0; i < words.length; i++) if (hay.indexOf(words[i]) !== -1) s += words[i].length;
      return [s, r];
    }).filter(function (x) { return x[0] > 0; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 5);
    var h = "";
    if (!scored.length) h = '<div class="hit">No matches yet — try "beat", "mic", "love song", "piano", "choir".</div>';
    if (scored.length && (scored[0][1][2] === "beat" || scored[0][1][2] === "song"))
      h += '<div class="freply">🎯 Found it — tap ▶ to hear it right here, or "Take me there →" for the full record.</div>';
    scored.forEach(function (x) {
      var r = x[1], param = r[2] === "song" ? "song" : r[2] === "sound" ? "sound" : r[2] === "beat" ? "beat" : "gear";
      var playable = r[2] === "beat" || r[2] === "song";
      var plabel = r[2] === "song" ? "▶ Play preview" : "▶ Play";
      var playBtn = playable
        ? '<button class="fplay" type="button" data-kind="' + r[2] + '" data-id="' + esc(r[0]) + '" data-label="' + plabel + '">' + plabel + "</button>"
        : "";
      h += '<div class="hit"><b>' + esc(r[1]) + '</b> <span class="id">' + esc(r[0]) + '</span><br><span class="seqlab">' + esc(r[2]) + "</span>" + playBtn + '<button class="go" data-p="' + param + '" data-id="' + esc(r[0]) + '">Take me there →</button><div class="fnow" aria-live="polite"></div></div>';
    });
    $("finderhits").innerHTML = h;
    Array.prototype.forEach.call($("finderhits").querySelectorAll(".go"), function (b) {
      b.onclick = function () { location.hash = ""; location.search = "?" + b.getAttribute("data-p") + "=" + b.getAttribute("data-id"); location.reload(); };
    });
    Array.prototype.forEach.call($("finderhits").querySelectorAll(".fplay"), function (b) {
      b.onclick = function () {
        try { S.unlockAudio(); } catch (e) {} /* synchronous: inside the tap gesture */
        var kind = b.getAttribute("data-kind"), id = b.getAttribute("data-id");
        var nowEl = b.parentNode.querySelector(".fnow");
        b.textContent = "Loading…"; b.disabled = true;
        findRecord(id).then(function (rec) {
          if (kind === "beat") finderPlayBeat(rec, b, nowEl);
          else finderPlaySong(rec, b, nowEl);
        }, function () { finderRenderFail(b, nowEl, "Could not load this record."); });
      };
    });
  }
  $("finderq").addEventListener("keydown", function (e) { if (e.key === "Enter") finderGo(); });

  /* ---------- Music Teacher AI (grounded) ---------- */
  function teachGo() {
    var a = D.teach($("teachq").value);
    $("teachans").style.display = "block";
    $("teachans").innerHTML = "<b style='color:var(--teal)'>" + esc(a.title) + "</b><p>" + esc(a.text) + "</p>" +
      '<button class="btn ghost" id="teachread">🔊 Read aloud</button>';
    $("teachread").onclick = function () { readAloud(a.title + ". " + a.text, "teacher answer"); };
  }
  $("teachgo").onclick = teachGo;
  $("teachq").addEventListener("keydown", function (e) { if (e.key === "Enter") teachGo(); });

  /* ---------- record view ---------- */
  function recordQA(rec) {
    var facts = rec.kind === "song"
      ? [["title", rec.title], ["genre", rec.genre], ["mood", rec.mood], ["tempo", rec.tempo + " BPM"], ["key", rec.key], ["chords", rec.chords], ["structure", rec.structure]]
      : rec.kind === "beat"
      ? [["name", rec.name], ["style", rec.style.replace(/-/g, " ")], ["tempo", rec.bpm + " BPM"], ["original", "yes — an original Signature composition, never a copy of any real song"]]
      : rec.kind === "sound"
      ? [["name", rec.name], ["type", rec.subtype], ["family", rec.cat], ["voice", rec.voice]]
      : [["name", rec.name], ["category", rec.cat], ["patch guide", rec.patch]];
    return function (q) {
      q = q.toLowerCase(); var i;
      for (i = 0; i < facts.length; i++) if (q.indexOf(facts[i][0]) !== -1) return facts[i][0] + ": " + facts[i][1];
      if (q.indexOf("lyric") !== -1 && rec.lyrics) return "Lyrics:\n" + rec.lyrics;
      if (q.indexOf("download") !== -1) return "Use the Download buttons on this record: .txt and .json for the spec" + (rec.kind === "song" ? ", plus the rendered .wav demo mix." : ".");
      return "I can only answer from this record's own data — title, genre, tempo, key, chords, lyrics and the like. That isn't covered here.";
    };
  }
  window.__showRecord = function (rec) {
    var qa = recordQA(rec), h = "";
    var ld = rec.kind === "song"
      ? { "@context": "https://schema.org", "@type": "MusicComposition", "name": rec.title, "identifier": rec.id }
      : { "@context": "https://schema.org", "@type": "Product", "name": rec.title || rec.name, "identifier": rec.id };
    if (rec.kind === "song") {
      h = '<div class="rec"><h2>' + esc(rec.title) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        '<p class="meta">' + esc(rec.genre) + " · " + esc(rec.mood) + " · " + rec.tempo + " BPM · " + esc(rec.key) + '</p>' +
        '<p>' + esc(rec.desc) + '</p><h3>Chords</h3><p class="chords">' + esc(rec.chords) + '</p>' +
        '<h3>Structure</h3><p>' + esc(rec.structure) + '</p><h3>Lyrics</h3><pre class="lyrics">' + esc(rec.lyrics) + "</pre>" +
        '<p><button class="btn" data-act="play">▶ Play demo mix</button>' +
        '<button class="btn teal" data-act="wav">⬇ .wav</button>' +
        '<button class="btn ghost" data-act="read">🔊 Read aloud</button>' +
        '<button class="btn ghost" data-act="txt">Copy .txt</button>' +
        '<button class="btn ghost" data-act="json">Copy .json</button></p>' +
        '<div class="row"><div><label>Ask about this song</label><input type="text" data-qa placeholder="e.g. what is the tempo?"></div></div><div class="ans" data-qaout style="display:none"></div></div>';
    } else if (rec.kind === "beat") {
      h = '<div class="rec"><h2>' + esc(rec.name) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        '<p class="meta">' + esc(rec.style.replace(/-/g, " ")) + " · " + rec.bpm + ' BPM' + (rec.era ? ' · vintage-era style' : '') + '</p>' +
        '<p>' + esc(rec.desc) + '</p>' +
        '<div class="honest">Original Signature composition — in the style of the era, never a copy of any real song.</div>' +
        '<p><button class="btn" data-act="bplay">▶ Play beat</button>' +
        '<button class="btn teal" data-act="bwav">⬇ .wav</button>' +
        '<button class="btn ghost" data-act="read">🔊 Read aloud</button>' +
        '<button class="btn ghost" data-act="txt">Copy .txt</button>' +
        '<button class="btn ghost" data-act="json">Copy .json</button></p>' +
        '<div class="row"><div><label>Ask about this beat</label><input type="text" data-qa placeholder="e.g. what is the tempo?"></div></div><div class="ans" data-qaout style="display:none"></div></div>';
    } else {
      h = '<div class="rec"><h2>' + esc(rec.name) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        '<p class="meta">' + esc(rec.kind === "sound" ? (rec.subtype + " · " + rec.cat + " family · " + rec.voice + " voice") : rec.cat) + '</p><p>' + esc(rec.desc) + '</p>' +
        (rec.kind === "sound" ? '<p><button class="btn" data-act="preview">▶ Preview</button><button class="btn teal" data-act="swav">⬇ .wav</button></p>' : "") +
        '<p><button class="btn ghost" data-act="read">🔊 Read aloud</button>' +
        '<button class="btn ghost" data-act="txt">Copy .txt</button>' +
        '<button class="btn ghost" data-act="json">Copy .json</button></p>' +
        '<div class="row"><div><label>Ask about this record</label><input type="text" data-qa placeholder="Ask from this record\u2019s data…"></div></div><div class="ans" data-qaout style="display:none"></div></div>';
    }
    h += '<script type="application/ld+json">' + JSON.stringify(ld) + "<\/script>";
    $("record").innerHTML = h;
    $("record").scrollIntoView();
    var box = $("record");
    function qain() { var q = box.querySelector("[data-qa]"); return q ? q.value : ""; }
    var qai = box.querySelector("[data-qa]");
    if (qai) qai.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var o = box.querySelector("[data-qaout]"); o.style.display = "block"; o.innerHTML = "<p>" + esc(qa(qai.value)) + "</p>"; }
    });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "play" || act === "bplay" || act === "preview") { try { S.unlockAudio(); } catch (e2) {} }
      if (act === "read") readAloud((rec.title || rec.name) + ". " + rec.desc + (rec.lyrics ? " Lyrics: " + rec.lyrics : ""), rec.id);
      if (act === "txt") navigator.clipboard.writeText(JSON.stringify(rec, null, 2));
      if (act === "json") navigator.clipboard.writeText(JSON.stringify(rec));
      if (act === "play") { b.textContent = "Rendering…"; S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { S.playBuffer(buf); b.textContent = "▶ Play demo mix"; dl(S.bufferToWav(buf), rec.id + ".wav"); }); }
      if (act === "wav") { b.textContent = "Rendering…"; S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav"; }); }
      if (act === "preview") previewSound(rec);
      if (act === "swav") renderSoundWav(rec);
      if (act === "bplay" && window.__playBeatRec) window.__playBeatRec(rec);
      if (act === "bwav") {
        b.textContent = "Rendering…";
        var pat = S.patternFor(rec.name, rec.style, rec.bpm);
        S.renderBuffer(16 * (60 / rec.bpm / 4) * 4 + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 4, 1); })
          .then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav"; });
      }
    });
  };
  function route() {
    var q = new URLSearchParams(location.search);
    var id = q.get("song") || q.get("sound") || q.get("gear") || q.get("beat");
    if (id) findRecord(id).then(window.__showRecord, function () { $("record").innerHTML = '<div class="hit">Record not found.</div>'; });
  }
  window.__findRecord = findRecord;
  window.__esc = esc; window.__dl = dl; window.__readAloud = readAloud; window.__S = S; window.__D = D; window.__$ = $;
  window.__getIdx = function () { return IDX; };

  loadData().then(function () { route(); if (window.__initAll) window.__initAll(IDX); });
})();
