/* ==== JAH global read-aloud controller (one per page): no stacked voices, no orphan audio ==== */
(function(){
if(window.__JAHREAD)return;
var R={audios:[],lastTap:0,lastLabel:""};
R.stopAll=function(){
 try{if(window.speechSynthesis)window.speechSynthesis.cancel();}catch(e){}
 try{if(window.responsiveVoice&&window.responsiveVoice.cancel)window.responsiveVoice.cancel();}catch(e){}
 var i,a;
 for(i=0;i<R.audios.length;i++){a=R.audios[i];try{a.pause();}catch(e){}try{a.removeAttribute("src");}catch(e){}try{a.load();}catch(e){}}
 R.audios.length=0;
 var els=document.querySelectorAll("audio");
 for(i=0;i<els.length;i++){try{els[i].pause();}catch(e){}}
};
R.reg=function(a){if(a&&R.audios.indexOf(a)<0)R.audios.push(a);return a;};
R.playGuard=function(label){
 var now=Date.now();
 if(now-R.lastTap<450&&label===R.lastLabel){R.lastTap=0;R.lastLabel="";R.stopAll();return false;}
 R.lastTap=now;R.lastLabel=String(label||"");
 R.stopAll();return true;
};
try{
 var NativeAudio=window.Audio;
 window.Audio=function(src){var a=src===undefined?new NativeAudio():new NativeAudio(src);R.reg(a);return a;};
 window.Audio.prototype=NativeAudio.prototype;
}catch(e){}
window.__JAHREAD=R;
})();
/* ============================================================
   Signature Music Studio — app wiring.
   ============================================================ */
(function () {
  "use strict";
  var S = window.SigSynth, D = window.SigData;
  function $(id) { return document.getElementById(id); }

  /* ---------- persistent sticky player bar (Site #25 diagnostic, fixes 4+5) ----------
     Wraps S.playBuffer / S.stopLive (synth.js untouched) so every play path —
     record views, beat maker, vocal studio, finder — reports to one honest bar.
     The bar shows a spinner while rendering, EQ while playing, and plain honest
     words when the browser blocks audio. Never fakes a "now playing" state. */
  (function playerBar() {
    var bar = $("playerbar"), label = $("pblabel"), state = $("pbstate");
    if (!bar) return;
    var curId = null, busy = false;
    function show() { bar.style.display = "flex"; document.body.classList.add("playerbar-pad"); }
    function hide() { bar.style.display = "none"; document.body.classList.remove("playerbar-pad"); }
    function honestBlocked() {
      bar.classList.remove("playing");
      label.textContent = "Audio is blocked in this browser — tap ▶ again";
      state.textContent = "Your browser held the audio on first tap. Tap ▶ on the song to try again, or use the record page's play button.";
      show();
    }
    var _play = S.playBuffer, _stop = S.stopLive;
    S.playBuffer = function (buf, id) {
      var src = null;
      try { src = _play.call(S, buf, id); } catch (e) { src = null; }
      busy = false;
      if (src) {
        curId = id || "main";
        label.textContent = "Now playing — " + (S._curLabel || curId);
        state.textContent = "";
        bar.classList.add("playing");
        show();
        try { src.onended = function () { if (curId === (id || "main")) { curId = null; bar.classList.remove("playing"); hide(); } }; } catch (e) {}
        S._curLabel = null;
      } else {
        honestBlocked();
      }
      return src;
    };
    S.stopLive = function (id) {
      _stop.call(S, id);
      if (curId && curId === (id || "main")) { curId = null; bar.classList.remove("playing"); hide(); }
      if (!id || id === "main") { bar.classList.remove("playing"); }
    };
    S.setPlayerLabel = function (l) { S._curLabel = l; };
    S.setBusy = function (msg) { busy = true; label.innerHTML = '<span class="spinner"></span>' + esc(msg || "Rendering…"); state.textContent = ""; bar.classList.remove("playing"); show(); };
    S.setIdle = function () { busy = false; if (!curId) hide(); };
    $("pbpause").onclick = function () { try { S.unlockAudio(); } catch (e) {} bar.classList.remove("playing"); state.textContent = "Paused — tap ▶ on any song or beat to replay it here."; };
    $("pbplay").onclick = function () { try { S.unlockAudio(); } catch (e) {} state.textContent = "Tap ▶ on any song or beat to play it here."; };
    $("pbstop").onclick = function () { if (curId) S.stopLive(curId); S.stopLive("main"); bar.classList.remove("playing"); hide(); };
  })();
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dl(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  function gunzip(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("fetch " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); });
  }

  /* ---------- 27-site JAH Network nav ---------- */
  var NAV = [
    ["Signature Math", "signature-math"], ["Signature Universal Paradox Immune Calculator", "jah-calculator"], ["The Signature Dictionary", "jah-dictionary"],
    ["JAH Wiki", "jah-wiki"], ["JAH-N Wiki", "jah-n-wiki-leaks"], ["Signature Llama: The Fully Cyber Utilizable AI", "signature-llama"],
    ["The Signature AI Phone Book", "jah-ai-models"], ["Globally Rejustered Patent Catalog", "cyber-patent-catalog"], ["Signature Spec Catalog Pending Patents", "signature-one-archive/specs.html"],
    ["The Signature PC System Depository", "jah-computer-systems"], ["The Signature Book Depository", "signature-books"], ["The Signature Comic Store", "signature-comics"],
    ["The Signature Global Newspaper Archive", "signature-newspapers"], ["The Signature AI Mad Scientist Creation Lab", "signature-backend"], ["The Signature Boundless Generator Archive", "signature-boundless-generators"],
    ["The Signature AI Mix Lab", "signature-ai-mixlab"], ["AI Olympics", "signature-ai-olypics"], ["The Signature Computer Chip Maker and Archive", "signature-chip-maker"],
    ["The Signature App Archive", "signature-app-archive"], ["The Signature AI Robot Matcher", "signature-ai-robot-matcher"], ["The Signature Experiment Solver", "signature-experiment-solver"],
    ["Signature AI Pixel", "signature-ai-image-video-maker"], ["Signature Music Studio", "signature-ai-song-maker"], ["The Signature Mr Fix-It", "signature-fixit"], ["The Signature University", "signature-university"],
    ["The Signature Cyber Mega-Mall", "signature-cyber-mega-mall"], ["The Signature 3D Print Mega Mall", "signature-3d-print"]
  ];
  function buildNav(el, selfIx) {
    var h = "<b>THE JAH NETWORK</b> ", i;
    for (i = 0; i < NAV.length; i++) {
      if (i === selfIx) continue;
      h += '<a href="https://justinahiggins614-cmyk.github.io/' + NAV[i][1] + '/">' + (i + 1) + " " + esc(NAV[i][0]) + "</a>";
    }
    h += '<span class="here">23 Signature Music Studio — YOU ARE HERE</span>';
    el.innerHTML = h;
  }
  buildNav($("jahnet"), 22); buildNav($("jahnet2"), 22);

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
    if(window.__JAHREAD&&!window.__JAHREAD.playGuard("speakTier"))return;
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
    if(window.__JAHREAD&&!window.__JAHREAD.playGuard("readAloud"))return;
    readText = text; $("readlabel").textContent = "Reading: " + (label || "selection"); $("readbar").style.display = "block";
    speakTier(text, function () { if (reading) nextChunk(); });
    reading = true;
  }
  function nextChunk() { reading = false; $("readbar").style.display = "none"; }
  $("readstop").onclick = function () { try{if(window.__JAHREAD)window.__JAHREAD.stopAll();}catch(e){} try { speechSynthesis.cancel(); } catch (e) {} try { responsiveVoice.cancel(); } catch (e) {} reading = false; $("readbar").style.display = "none"; };
  $("readclose").onclick = $("readstop").onclick;
  $("readplay").onclick = function () { if(window.__JAHREAD&&!window.__JAHREAD.playGuard("readplay"))return; if (readText) readAloud(readText); };

  /* ---------- data ----------
     2026-10-03: authoritative boot. music-manifest.json (tiny) is fetched
     first so counts appear instantly from the single source of truth; the
     index follows with timeout + one retry. States: LOADING / LIVE /
     INDEX ERROR / OFFLINE / CACHED (last saved copy) / NO RECORDS. */
  var IDX = [], MANIFEST = null, MM = null;
  var BOOT = { state: "LOADING", note: "Fetching the archive index…" };
  window.__bootState = function () { return BOOT.state; };
  function fetchT(url, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var to = setTimeout(function () { if (!done) { done = true; rej(new Error("timeout after " + ms + "ms")); } }, ms || 20000);
      fetch(url).then(function (r) {
        if (done) return; done = true; clearTimeout(to);
        if (!r.ok) rej(new Error("HTTP " + r.status)); else res(r);
      }, function (e) { if (!done) { done = true; clearTimeout(to); rej(e); } });
    });
  }
  function renderCountsFromMM() {
    if (!MM || !MM.archive) return;
    var a = MM.archive, g = a.goals || {};
    $("counters").innerHTML = "📀 <b>" + a.songs.toLocaleString() + "</b> / " + (g.songs || 1000000).toLocaleString() + " songs &nbsp;·&nbsp; 🎛️ <b>" +
      a.library_sounds.toLocaleString() + "</b> / " + (g.library_sounds || 1000000).toLocaleString() + " instruments, sets &amp; packs &nbsp;·&nbsp; 🥁 <b>" +
      a.beats.toLocaleString() + "</b> beats &nbsp;·&nbsp; 🎚️ <b>" + a.equipment.toLocaleString() + "</b> equipment records";
    var lc = $("libcount"); if (lc) lc.textContent = "(" + a.library_sounds.toLocaleString() + " / " + (g.library_sounds || 1000000).toLocaleString() + ")";
  }
  function paintBoot() {
    var badge = { "LOADING": "⏳ LOADING", "LIVE": "🟢 LIVE", "INDEX ERROR": "🔴 INDEX ERROR", "OFFLINE": "📴 OFFLINE", "CACHED": "🟡 CACHED", "NO RECORDS": "⚪ NO RECORDS" }[BOOT.state] || BOOT.state;
    var c = $("counters");
    /* 2026-10-03: stamped last-known counts stay visible while loading — the
       chip never boots as a bare "Loading…" when a stamped count exists. */
    if (BOOT.state === "LOADING" && !MM) {
      if (c.getAttribute("data-stamp") && c.getAttribute("data-booting") !== "1") {
        c.setAttribute("data-booting", "1");
        c.innerHTML += ' <span class="spinner" aria-hidden="true"></span><span class="seqlab">loading live…</span>';
      } else if (!c.getAttribute("data-stamp")) {
        c.innerHTML = '<span class="spinner"></span>Loading the archive…';
      }
    }
    else if (BOOT.state === "LIVE" || (BOOT.state === "CACHED" && MM)) { renderCountsFromMM(); if (BOOT.state === "CACHED") c.innerHTML += ' <span class="seqlab">(' + badge + " — " + esc(BOOT.note) + ")</span>"; }
    else if (BOOT.state === "LOADING") renderCountsFromMM();
    else c.innerHTML = badge + ' — ' + esc(BOOT.note || "The archive could not be reached.") + ' <button class="btn ghost" onclick="location.reload()">↻ Retry</button>';
  }
  function setBoot(s, note) { BOOT.state = s; BOOT.note = note || ""; paintBoot(); }
  window.__bootErrorCard = function (what) {
    return '<div class="card" role="alert"><h4>⚠️ ' + esc(what) + ' unavailable</h4><p class="seqlab">' + esc(BOOT.note || "The archive index did not load.") +
      '</p><p><button class="btn" onclick="location.reload()">↻ Retry</button></p></div>';
  };
  function loadIndexOnce() {
    return fetchT("data/index/index.json.gz", 25000).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); })
      .then(function (t) { return t.split("\n").filter(Boolean).map(JSON.parse); });
  }
  function cacheIdx(rows) {
    try { localStorage.setItem("sigstudio_idx_v1", JSON.stringify({ at: new Date().toISOString(), rows: rows })); } catch (e) {}
  }
  function cachedIdx() {
    try { var c = JSON.parse(localStorage.getItem("sigstudio_idx_v1") || "null"); return (c && c.rows && c.rows.length) ? c : null; } catch (e) { return null; }
  }
  function loadData() {
    setBoot("LOADING", "Fetching the archive index…");
    var mmP = fetchT("music-manifest.json", 10000).then(function (r) { return r.json(); }).then(function (m) {
      MM = m; renderCountsFromMM();
      try { localStorage.setItem("sigstudio_mm_v1", JSON.stringify(m)); } catch (e) {}
    }, function () {
      try { MM = JSON.parse(localStorage.getItem("sigstudio_mm_v1") || "null"); } catch (e) { MM = null; }
      if (MM) renderCountsFromMM();
    });
    var manP = fetchT("data/manifest.json", 10000).then(function (r) { return r.json(); }).then(function (m) { MANIFEST = m; }, function () {});
    var idxP = loadIndexOnce().catch(function () {
      return new Promise(function (res) { setTimeout(res, 1500); }).then(loadIndexOnce); // one retry
    }).then(function (rows) { return { rows: rows, cached: false }; }, function (e) {
      var c = cachedIdx();
      if (c) return { rows: c.rows, cached: true, at: c.at };
      throw e;
    });
    return Promise.all([mmP, manP, idxP]).then(function (r) {
      IDX = r[2].rows;
      if (!IDX.length) setBoot("NO RECORDS", "The index loaded but contains no records yet.");
      else if (r[2].cached) { setBoot("CACHED", "showing the last saved copy (" + (r[2].at || "unknown time") + ")."); }
      else { setBoot("LIVE"); cacheIdx(IDX); }
    }).catch(function (e) {
      setBoot(navigator.onLine === false ? "OFFLINE" : "INDEX ERROR",
        (e && e.message ? e.message : "fetch failed") + " — check your connection, then retry.");
    });
  }
  function detGen(id) {
    // deterministic fallback: generate directly from the ID number
    var m = /^JAH-(SONG|SOUND|GEAR|BEAT)-(\d+)$/.exec(id);
    if (!m) return Promise.reject(new Error("bad id"));
    var kind = m[1] === "SONG" ? "song" : m[1] === "SOUND" ? "sound" : m[1] === "BEAT" ? "beat" : "gear";
    return Promise.resolve(D.gen(kind, parseInt(m[2], 10)));
  }
  function findRecord(id) {
    // 1) session registry: AI-generated songs resolve to the EXACT record the
    //    user saw (same title/lyrics), not the deterministic archive version.
    if (window.__genSongs && window.__genSongs[id]) return Promise.resolve(window.__genSongs[id]);
    var row = null, i;
    for (i = 0; i < IDX.length; i++) if (IDX[i][0] === id) row = IDX[i];
    if (!row) return detGen(id);
    return gunzip("data/records/" + row[3]).then(function (t) {
      var lines = t.split("\n"), j;
      for (j = 0; j < lines.length; j++) { if (!lines[j]) continue; var r = JSON.parse(lines[j]); if (r.id === id) return r; }
      // chunk didn't contain the id (stale pointer) — deterministic fallback
      // rather than a dead "not found"
      return detGen(id);
    }, function () { return detGen(id); });
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
    try { S.setPlayerLabel(label); } catch (e) {}
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
  /* ---- batch-E 10-fix pass: status badge, record panel, provenance ---- */
  function recStatus(rec) { return rec.kind === "gear" ? "SIGNATURE ORIGINAL" : "GENERATED"; }
  function recPanelHTML(rec) {
    var seedLine = (rec.n != null) ? 'reproducible seed <b>' + esc(rec.n) + '</b> — the same ID always makes this exact record.' : 'deterministic studio record.';
    return '<div class="recpanel" aria-label="Record panel">' +
      '<span class="rp"><b>STATUS</b> <span class="sbadge">' + recStatus(rec) + '</span></span>' +
      '<span class="rp"><b>ID</b> ' + esc(rec.id) + '</span>' +
      '<span class="rp"><b>VERSION</b> v1.0</span>' +
      '<span class="rp"><b>SOURCE</b> Signature Music Studio · studio engine</span>' +
      '<span class="rp"><b>OPEN</b> <button class="btn ghost" data-act="open">open &#8599;</button></span>' +
      '<span class="rp"><b>SHARE</b> <button class="btn ghost" data-act="share">share</button></span>' +
      '<span class="rp"><b>COPY</b> <button class="btn ghost" data-act="txt">copy</button></span>' +
      '<span class="rp"><b>DOWNLOAD</b> <button class="btn ghost" data-act="dl">download</button></span>' +
      '<span class="rp"><b>READ ALOUD</b> <button class="btn ghost" data-act="read">read</button></span></div>' +
      '<p class="seqlab">&#9881;&#65039; <b>Provenance:</b> generated by the Signature studio engine · ' + seedLine + '</p>';
  }
  window.__showRecord = function (rec) {
    var qa = recordQA(rec), h = "";
    /* Site #25 diagnostic fix 1: MusicRecording schema with duration estimate
       (computed from bars × beats-per-bar ÷ tempo — never a claimed audio file,
       since audio is synthesized live in the browser). */
    function isoDur(sec) { sec = Math.round(sec); return "PT" + Math.floor(sec / 60) + "M" + (sec % 60) + "S"; }
    var durSec = null;
    try {
      var bpm = rec.tempo || rec.bpm || 100;
      if (rec.kind === "song" && rec.structure) {
        var bars = 0, m, rx = /\((\d+)\s*bars?\)/g;
        while ((m = rx.exec(rec.structure))) bars += parseInt(m[1], 10);
        if (bars) durSec = bars * 4 * 60 / bpm;
      } else if (rec.kind === "beat") {
        durSec = 4 * 4 * 60 / bpm;
      }
    } catch (e) {}
    var ld = { "@context": "https://schema.org", "@type": "MusicRecording",
      "name": rec.title || rec.name, "identifier": rec.id,
      "byArtist": { "@type": "Person", "name": "Justin Addam Higgins" },
      "description": rec.desc || "",
      "url": "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/?" + rec.kind + "=" + rec.id };
    if (durSec) ld.duration = isoDur(durSec);
    if (rec.genre) ld.genre = rec.genre;
    else if (rec.style) ld.genre = rec.style.replace(/-/g, " ");
    if (rec.kind === "song") ld.recordingOf = { "@type": "MusicComposition", "name": rec.title, "identifier": rec.id };
    if (rec.kind === "song") {
      /* Gemini fix 6 (2026-10-02): permanent ID + reproducible seed, plain words. */
      var seedLine = (rec.n != null) ? '<p class="seqlab">🔑 Permanent ID <b>' + esc(rec.id) + '</b> · reproducible seed <b>' + esc(rec.n) + '</b> — the same ID always makes this exact song.</p>' : "";
      h = '<div class="rec"><h2>' + esc(rec.title) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        recPanelHTML(rec) +
        '<p class="meta">' + esc(rec.genre) + " · " + esc(rec.mood) + " · " + rec.tempo + " BPM · " + esc(rec.key) + '</p>' + seedLine +
        '<p>' + esc(rec.desc) + '</p><h3>Chords</h3><p class="chords">' + esc(rec.chords) + '</p>' +
        '<h3>Structure</h3><p>' + esc(rec.structure) + '</p><h3>Lyrics</h3><pre class="lyrics">' + esc(rec.lyrics) + "</pre>" +
        '<p><button class="btn" data-act="play">▶ Play demo mix</button>' +
        '<button class="btn teal" data-act="wav">⬇ .wav</button>' +
        '<button class="btn ghost" data-act="proj">📦 Export project</button>' +
        '<button class="btn ghost" data-act="read">🔊 Read aloud</button>' +
        '<button class="btn ghost" data-act="txt">Copy .txt</button>' +
        '<button class="btn ghost" data-act="json">Copy .json</button></p>' +
        '<div class="row"><div><label>Ask about this song</label><input type="text" data-qa placeholder="e.g. what is the tempo?"></div></div><div class="ans" data-qaout style="display:none"></div></div>';
    } else if (rec.kind === "beat") {
      var bseedLine = (rec.n != null) ? '<p class="seqlab">🔑 Permanent ID <b>' + esc(rec.id) + '</b> · reproducible seed <b>' + esc(rec.n) + '</b> — the same ID always makes this exact beat.</p>' : "";
      h = '<div class="rec"><h2>' + esc(rec.name) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        recPanelHTML(rec) +
        '<p class="meta">' + esc(rec.style.replace(/-/g, " ")) + " · " + rec.bpm + ' BPM' + (rec.era ? ' · vintage-era style' : '') + '</p>' + bseedLine +
        '<p>' + esc(rec.desc) + '</p>' +
        '<div class="honest">Original Signature composition — in the style of the era, never a copy of any real song.</div>' +
        '<p><button class="btn" data-act="bplay">▶ Play beat</button>' +
        '<button class="btn teal" data-act="bwav">⬇ .wav</button>' +
        '<button class="btn ghost" data-act="proj">📦 Export project</button>' +
        '<button class="btn ghost" data-act="read">🔊 Read aloud</button>' +
        '<button class="btn ghost" data-act="txt">Copy .txt</button>' +
        '<button class="btn ghost" data-act="json">Copy .json</button></p>' +
        '<div class="row"><div><label>Ask about this beat</label><input type="text" data-qa placeholder="e.g. what is the tempo?"></div></div><div class="ans" data-qaout style="display:none"></div></div>';
    } else {
      h = '<div class="rec"><h2>' + esc(rec.name) + ' <span class="id">' + esc(rec.id) + '</span></h2>' +
        recPanelHTML(rec) +
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
      /* 2026-10-03: honest render failure — a dead click is never acceptable. */
      function renderFail(label) {
        b.textContent = label;
        try { if (S.setIdle) S.setIdle(); } catch (e4) {}
        var n = document.createElement("span");
        n.className = "fblocked"; n.setAttribute("role", "alert");
        n.textContent = "Couldn't render the audio here — this browser can't do offline audio rendering. The record above is still yours to read, copy, and download.";
        try { b.parentNode.appendChild(n); } catch (e5) {}
      }
      if (act === "open") { window.open(location.pathname + "?" + rec.kind + "=" + rec.id, "_blank"); return; }
      if (act === "share") {
        var surl = location.origin + location.pathname + "?" + rec.kind + "=" + rec.id;
        if (navigator.share) { try { navigator.share({ title: (rec.title || rec.name) + " — Signature Music Studio", url: surl }); } catch (e2) {} }
        else if (navigator.clipboard) { try { navigator.clipboard.writeText(surl); } catch (e3) {} }
        return;
      }
      if (act === "dl") { act = rec.kind === "song" ? "wav" : rec.kind === "beat" ? "bwav" : rec.kind === "sound" ? "swav" : "txt"; }
      if (act === "play" || act === "bplay" || act === "preview") { try { S.unlockAudio(); } catch (e2) {} }
      if (act === "read") readAloud((rec.title || rec.name) + ". " + rec.desc + (rec.lyrics ? " Lyrics: " + rec.lyrics : ""), rec.id);
      if (act === "txt") navigator.clipboard.writeText(JSON.stringify(rec, null, 2));
      if (act === "json") navigator.clipboard.writeText(JSON.stringify(rec));
      if (act === "proj" && window.__exportProject) window.__exportProject(rec);
      if (act === "play") { b.textContent = "Rendering…"; try { S.setPlayerLabel(rec.title || rec.id); S.setBusy("Rendering song…"); } catch (e2) {} S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { S.playBuffer(buf); b.textContent = "▶ Play demo mix"; dl(S.bufferToWav(buf), rec.id + ".wav"); }, function () { renderFail("▶ Play demo mix"); }); }
      if (act === "wav") { b.textContent = "Rendering…"; S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav"; }, function () { renderFail("⬇ .wav"); }); }
      if (act === "preview") previewSound(rec);
      if (act === "swav") renderSoundWav(rec);
      if (act === "bplay" && window.__playBeatRec) window.__playBeatRec(rec);
      if (act === "bwav") {
        b.textContent = "Rendering…";
        var pat = S.patternFor(rec.name, rec.style, rec.bpm);
        S.renderBuffer(16 * (60 / rec.bpm / 4) * 4 + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 4, 1); })
          .then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav"; }, function () { renderFail("⬇ .wav"); });
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

  /* 2026-10-03: browser compatibility detection (P1) — graceful, honest.
     Checks the three capabilities the studio needs; degrades with words,
     never silently. */
  function compatCheck() {
    var missing = [];
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) missing.push("Web Audio (sound synthesis & playback)");
    } catch (e) { missing.push("Web Audio (sound synthesis & playback)"); }
    if (typeof DecompressionStream === "undefined") missing.push("gzip decompression (archive index — records still generate deterministically)");
    if (!window.MediaRecorder) missing.push("MediaRecorder (mic recording — uploads still work)");
    if (!missing.length) return;
    var d = document.createElement("div");
    d.className = "honest"; d.setAttribute("role", "alert");
    d.style.margin = "10px auto"; d.style.maxWidth = "900px";
    d.innerHTML = "<b>⚠️ This browser is missing:</b> " + esc(missing.join("; ")) +
      ". The studio keeps working where it can — try a current Chrome, Edge, Firefox, or Safari for the full studio.";
    var hero = document.querySelector("header.hero");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(d, hero.nextSibling);
  }

  loadData().then(function () { compatCheck(); route(); if (window.__initAll) window.__initAll(IDX); });
})();
