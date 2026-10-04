/* ============================================================
   SigStudio — shared core for the Signature Music Studio pages.
   Studio page order (Manon's 2026-10-04 order):
     front door -> Song Maker Option 1 -> Option 2 -> Option 3 ->
     add-ons (Sound Effects, Backup Singers, Chorus) ->
     Full Studio Setup -> Song Archive -> Beat Archive -> Sound Library.
   ES5-safe. Depends on assets/synth.js (SigSynth) and
   assets/engine.js (SigData). Optional: assets/lame.min.js (lamejs)
   for MP3 encoding — WAV always works without it.
   ============================================================ */
(function (root) {
  "use strict";
  var S = root.SigSynth, D = root.SigData;

  var BASE = "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- the studio page order ---------- */
  var PAGES = [
    { file: "index.html", emoji: "\uD83C\uDFE0", label: "Front Door", blurb: "Start here \u2014 pick how you want to make music." },
    { file: "maker1.html", emoji: "\uD83C\uDFB5", label: "Quick Song", blurb: "Song Maker Option 1 \u2014 the AI host makes you a beat right now \u2014 a couple of taps." },
    { file: "maker2.html", emoji: "\uD83C\uDFA4", label: "Guided Builder", blurb: "Song Maker Option 2 \u2014 guided step by step \u2014 build a full song together." },
    { file: "maker3.html", emoji: "\uD83C\uDFA7", label: "Full Studio", blurb: "Song Maker Option 3 \u2014 the full workstation \u2014 tracks, mixer, library." },
    { file: "addon-sfx.html", emoji: "\u2728", label: "Sound Effects", blurb: "Echo, reverb and more on your song." },
    { file: "addon-backup.html", emoji: "\uD83C\uDF99\uFE0F", label: "Backup Singers", blurb: "Add backup singers to your song." },
    { file: "addon-chorus.html", emoji: "\uD83C\uDFB5", label: "Chorus", blurb: "Build a big chorus." },
    { file: "studio-setup.html", emoji: "\uD83D\uDD0C", label: "Studio Setup", blurb: "The complete studio: gear, wiring, presets." },
    { file: "songs.html", emoji: "\uD83D\uDC80", label: "📀 1 Million Archive", blurb: "Every finished song \u2014 search and play." },
    { file: "beats.html", emoji: "\uD83E\uDD41", label: "Beats", blurb: "Every beat \u2014 search and play." },
    { file: "library.html", emoji: "\uD83C\uDF9B\uFE0F", label: "Sound Library", blurb: "Every sound, instrument, set and pack." }
  ];

  function nav(currentFile) {
    var h = '<nav class="studionav" aria-label="Studio tabs"><div class="tabbar" role="tablist">';
    for (var i = 0; i < PAGES.length; i++) {
      var p = PAGES[i];
      if (p.file === currentFile) {
        h += '<span class="tab here" role="tab" aria-selected="true">' + p.emoji + " " + esc(p.label) + "</span>";
      } else {
        h += '<a class="tab" role="tab" aria-selected="false" href="' + p.file + '" title="' + esc(p.blurb) + '">' + p.emoji + " " + esc(p.label) + "</a>";
      }
    }
    return h + "</div></nav>";
  }

  /* ---------- 27-site JAH network nav (canon, same as front door) ---------- */
  var JNAV = [
    ["Signature Math", "signature-math"], ["Signature Universal Paradox Immune Calculator", "jah-calculator"], ["The Signature Dictionary", "jah-dictionary"],
    ["JAH Wiki", "jah-wiki"], ["JAH-N Wiki", "jah-n-wiki-leaks"], ["Signature Llama: The Fully Cyber Utilizable AI", "signature-llama"],
    ["The Signature AI Phone Book", "jah-ai-models"], ["Globally Rejustered Patent Catalog", "cyber-patent-catalog"], ["Signature Spec Catalog Pending Patents", "signature-one-archive/specs.html"],
    ["The Signature PC System Depository", "jah-computer-systems"], ["The Signature Book Depository", "signature-books"], ["The Signature Comic Store", "signature-comics"],
    ["The Signature Global Newspaper Archive", "signature-newspapers"], ["The Signature AI Mad Scientist Creation Lab", "signature-backend"], ["The Signature Boundless Generator Archive", "signature-boundless-generators"],
    ["The Signature AI Mix Lab", "signature-ai-mixlab"], ["AI Olypics", "signature-ai-olypics"], ["The Signature Computer Chip Maker and Archive", "signature-chip-maker"],
    ["The Signature App Archive", "signature-app-archive"], ["The Signature AI Robot Matcher", "signature-ai-robot-matcher"], ["The Signature Experiment Solver", "signature-experiment-solver"],
    ["Signature AI Pixel", "signature-ai-image-video-maker"], ["Signature Music Studio", "signature-ai-song-maker"], ["The Signature Mr Fix-It", "signature-fixit"], ["The Signature University", "signature-university"],
    ["The Signature Cyber Mega-Mall", "signature-cyber-mega-mall"], ["The Signature 3D Print Mega Mall", "signature-3d-print"]
  ];
  function jahNav(elId, hereLabel) {
    var el = document.getElementById(elId);
    if (!el) return;
    var h = "<b>THE JAH NETWORK</b> ", i;
    for (i = 0; i < JNAV.length; i++) {
      h += '<a href="https://justinahiggins614-cmyk.github.io/' + JNAV[i][1] + '/">' + (i + 1) + " " + esc(JNAV[i][0]) + "</a>";
    }
    h += '<span class="here">23 Signature Music Studio' + (hereLabel ? " \u00b7 " + esc(hereLabel) : "") + " \u2014 YOU ARE HERE</span>";
    el.innerHTML = h;
  }

  /* ---------- audio unlock (in-app browsers start suspended) ---------- */
  function unlock() { try { if (S && S.unlockAudio) S.unlockAudio(); } catch (e) {} }

  /* ---------- deterministic renders ----------
     2026-10-04 (his "Make my beat does nothing" report): these must NEVER
     throw synchronously and NEVER hang silently. A sync throw inside a tap
     handler used to die uncaught with zero feedback. Now: every failure —
     bad engine state, missing OfflineAudioContext, or a render that never
     settles — becomes a rejected promise with a plain-words message, and a
     60s watchdog guarantees the promise always settles. */
  function withWatchdog(promise, what) {
    var ms = 60000;
    return new Promise(function (res, rej) {
      var done = false;
      var to = setTimeout(function () {
        if (!done) { done = true; rej(new Error(what + " is taking too long — your browser may have paused background audio. Tap again.")); }
      }, ms);
      promise.then(function (v) { if (!done) { done = true; clearTimeout(to); res(v); } },
        function (e) { if (!done) { done = true; clearTimeout(to); rej(e); } });
    });
  }
  function renderSongBuffer(songLike, mix) {
    // songLike: {id,title,genre,mood,tempo,key,lyrics,chords,structure,desc}
    return withWatchdog(Promise.resolve().then(function () {
      if (!S || !S.renderFullSong) throw new Error("The sound engine did not load — reload the page and try again.");
      return S.renderFullSong(songLike, mix || {}, null);
    }), "Rendering the song");
  }
  function renderBeatBuffer(beatLike, bars) {
    // beatLike: {id,name,style,bpm,desc}
    return withWatchdog(Promise.resolve().then(function () {
      if (!S || !S.patternFor || !S.renderBuffer) throw new Error("The sound engine did not load — reload the page and try again.");
      var style = beatLike.style || "hiphop";
      var bpm = Math.max(60, Math.min(200, +beatLike.bpm || 92));
      var b = Math.max(1, Math.min(32, +bars || 4));
      var pat = S.patternFor(String(beatLike.desc || beatLike.name || "signature beat"), style, bpm);
      var secs = b * 16 * (60 / pat.bpm / 4) + 0.3;
      return S.renderBuffer(secs, function (c, dest, t0) {
        S.scheduleBeat(c, dest, t0, pat, b, 1);
      }).then(function (buf) { buf._seed = pat.seed; buf._bpm = pat.bpm; return buf; });
    }), "Making the beat");
  }
  function playBuffer(buf, id) { unlock(); return S.playBuffer(buf, id || "studio"); }
  function stopLive(id) { try { S.stopLive(id || "studio"); } catch (e) {} }

  /* ---------- downloads: WAV (built-in) + MP3 (lamejs if vendored) ---------- */
  function wavBlob(buf) { return S.bufferToWav(buf); }
  function mp3Ready() {
    return !!(root.lamejs && root.lamejs.Mp3Encoder);
  }
  function floatTo16(data) {
    var out = new Int16Array(data.length), i, v;
    for (i = 0; i < data.length; i++) {
      v = Math.max(-1, Math.min(1, data[i]));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    return out;
  }
  function mp3Blob(buf, kbps) {
    return new Promise(function (res, rej) {
      if (!mp3Ready()) { rej(new Error("MP3 encoder not loaded on this page \u2014 the .wav download works right now.")); return; }
      try {
        var ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, kb = kbps || 128;
        var enc = new root.lamejs.Mp3Encoder(ch, sr, kb);
        var left = floatTo16(buf.getChannelData(0));
        var right = ch > 1 ? floatTo16(buf.getChannelData(1)) : left;
        var parts = [], FR = 1152, i, chunk;
        for (i = 0; i < left.length; i += FR) {
          var l = left.subarray(i, i + FR), r = right.subarray(i, i + FR);
          chunk = ch > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
          if (chunk.length) parts.push(new Uint8Array(chunk));
        }
        chunk = enc.flush();
        if (chunk.length) parts.push(new Uint8Array(chunk));
        res(new Blob(parts, { type: "audio/mpeg" }));
      } catch (e) { rej(e); }
    });
  }
  function download(blob, filename) {
    var url = (root.URL || root.webkitURL).createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { document.body.removeChild(a); (root.URL || root.webkitURL).revokeObjectURL(url); } catch (e) {} }, 4000);
  }

  /* ---------- archive data: compact index + on-demand chunks ---------- */
  var INDEX = null, CHUNKS = {};
  function fetchT(url, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var to = setTimeout(function () { if (!done) { done = true; rej(new Error("timeout")); } }, ms || 25000);
      fetch(url).then(function (r) {
        if (done) return; done = true; clearTimeout(to);
        if (!r.ok) rej(new Error("HTTP " + r.status)); else res(r);
      }, function (e) { if (!done) { done = true; clearTimeout(to); rej(e); } });
    });
  }
  function gunzip(url) {
    return fetchT(url).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); });
  }
  // Retry with backoff: phones on flaky connections get 3 attempts before an error surfaces.
  function gunzipRetry(url, tries) {
    tries = tries || 3;
    function attempt(n) {
      return gunzip(url).catch(function (e) {
        if (n < tries) return new Promise(function (res) { setTimeout(res, 800 * n); }).then(function () { return attempt(n + 1); });
        throw e;
      });
    }
    return attempt(1);
  }
  function loadIndex() {
    if (INDEX) return Promise.resolve(INDEX);
    return gunzipRetry("data/index/index.json.gz").then(function (txt) {
      INDEX = [];
      txt.split("\n").forEach(function (l) {
        if (!l.trim()) return;
        try { INDEX.push(JSON.parse(l)); } catch (e) {}
      });
      return INDEX;
    });
  }
  function loadChunk(name) {
    if (CHUNKS[name]) return Promise.resolve(CHUNKS[name]);
    return gunzip("data/records/" + name).then(function (txt) {
      var recs = [];
      txt.split("\n").forEach(function (l) {
        if (!l.trim()) return;
        try { recs.push(JSON.parse(l)); } catch (e) {}
      });
      CHUNKS[name] = recs;
      return recs;
    });
  }
  // index rows: [id, titleOrName, kind, chunkName]
  function findRecord(id) {
    id = String(id).toUpperCase().trim();
    return loadIndex().then(function (idx) {
      for (var i = 0; i < idx.length; i++) {
        if (String(idx[i][0]).toUpperCase() === id) {
          var chunk = idx[i][3];
          return loadChunk(chunk).then(function (recs) {
            for (var j = 0; j < recs.length; j++) {
              if (String(recs[j].id).toUpperCase() === id) return recs[j];
            }
            return null;
          });
        }
      }
      return null;
    });
  }
  function searchIndex(q, kind, limit) {
    q = String(q == null ? "" : q).toLowerCase().trim();
    return loadIndex().then(function (idx) {
      var out = [];
      for (var i = 0; i < idx.length && out.length < (limit || 60); i++) {
        var r = idx[i];
        if (kind && r[2] !== kind) continue;
        if (!q || String(r[0]).toLowerCase().indexOf(q) >= 0 || String(r[1]).toLowerCase().indexOf(q) >= 0) out.push(r);
      }
      return out;
    });
  }

  /* ---------- My Songs shelf (this device) ---------- */
  var SHELF_KEY = "jah-my-songs-v1";
  var mySongs = {
    list: function () { try { return JSON.parse(localStorage.getItem(SHELF_KEY) || "[]"); } catch (e) { return []; } },
    push: function (item) {
      var l = mySongs.list();
      item.savedAt = new Date().toISOString();
      l.unshift(item);
      try { localStorage.setItem(SHELF_KEY, JSON.stringify(l.slice(0, 200))); } catch (e) {}
      return l;
    },
    remove: function (ix) {
      var l = mySongs.list(); l.splice(ix, 1);
      try { localStorage.setItem(SHELF_KEY, JSON.stringify(l)); } catch (e) {}
    }
  };

  /* ---------- AI host widget ---------- */
  // cfg: {greeting, onAsk(text)->string|Promise<string>, actions:[{label, run(say)}]}
  function host(el, cfg) {
    cfg = cfg || {};
    var box = typeof el === "string" ? document.getElementById(el) : el;
    if (!box) return null;
    function line(who, text) {
      var d = document.createElement("div");
      d.className = "hostline " + who;
      d.innerHTML = (who === "ai" ? "<b>\uD83E\uDD16 Studio host:</b> " : "<b>You:</b> ") + esc(text);
      box.querySelector(".hostlog").appendChild(d);
      box.querySelector(".hostlog").scrollTop = 1e6;
    }
    box.innerHTML = '<div class="hostlog" style="max-height:220px;overflow:auto"></div>' +
      '<div class="hostactions"></div>' +
      '<div class="row"><input type="text" class="hostask" placeholder="Ask the host\u2026 (e.g. make it faster)" aria-label="Ask the studio host" style="flex:1">' +
      '<button class="btn hostsend">Ask</button></div>';
    var log = box.querySelector(".hostlog"), acts = box.querySelector(".hostactions");
    function say(t) { line("ai", t); }
    if (cfg.greeting) say(cfg.greeting);
    (cfg.actions || []).forEach(function (a) {
      var b = document.createElement("button");
      b.className = "btn ghost"; b.textContent = a.label; b.style.margin = "2px";
      b.onclick = function () { unlock(); try { a.run(say); } catch (e) { say("Hmm, that hit a snag: " + e.message); } };
      acts.appendChild(b);
    });
    function ask() {
      var inp = box.querySelector(".hostask"), t = inp.value.trim();
      if (!t) return;
      unlock(); line("you", t); inp.value = "";
      say("On it\u2026");
      Promise.resolve().then(function () { return cfg.onAsk ? cfg.onAsk(t, say) : "Try one of the buttons below."; })
        .then(function (r) { if (r) say(r); }, function (e) { say("Hmm, that hit a snag: " + (e && e.message || e)); });
    }
    box.querySelector(".hostsend").onclick = ask;
    box.querySelector(".hostask").addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });
    return { say: say, line: line };
  }

  /* ---------- stamped counts ---------- */
  function stampCounts() {
    fetchT("data/state.json", 15000).then(function (r) { return r.json(); }).then(function (st) {
      var map = { song: st.song - 1, sound: st.sound - 1, beat: st.beat - 1, gear: st.gear - 1 };
      Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (el) {
        var k = el.getAttribute("data-count");
        if (map[k] != null) el.textContent = Number(map[k]).toLocaleString("en-US");
      });
    }, function () {});
  }

  /* ---------- record card (play + wav + mp3) ---------- */
  function recordCard(rec, opts) {
    opts = opts || {};
    var title = rec.title || rec.name || rec.id;
    var sub = rec.kind === "song"
      ? [rec.genre, rec.mood, rec.tempo ? rec.tempo + " BPM" : "", rec.key].filter(Boolean).join(" \u00b7 ")
      : rec.kind === "beat"
        ? [(rec.style || "").replace(/-/g, " "), rec.bpm ? rec.bpm + " BPM" : ""].filter(Boolean).join(" \u00b7 ")
        : (rec.family || rec.type || rec.category || "");
    return '<div class="card reccard" data-id="' + esc(rec.id) + '" data-kind="' + esc(rec.kind || "") + '">' +
      '<b>' + esc(title) + '</b><br><span class="seqlab">' + esc(rec.id) + (sub ? " \u00b7 " + esc(sub) : "") + "</span>" +
      '<div class="row" style="margin-top:6px">' +
      '<button class="btn ghost act-play">\u25B6 Play</button>' +
      '<button class="btn teal act-wav">\u2B07 .wav</button>' +
      '<button class="btn teal act-mp3">\u2B07 .mp3</button>' +
      (opts.extra || "") + "</div><div class=\"seqlab act-msg\"></div></div>";
  }
  // wireCards(root, {onPlay(rec)->Promise<AudioBuffer>, filename(rec,ext)->string})
  function wireCards(root, cfg) {
    cfg = cfg || {};
    function msg(card, t) { var m = card.querySelector(".act-msg"); if (m) m.textContent = t; }
    Array.prototype.forEach.call(root.querySelectorAll(".reccard"), function (card) {
      var id = card.getAttribute("data-id");
      function needRec() { return findRecord(id); }
      card.querySelector(".act-play").onclick = function () {
        unlock(); msg(card, "Loading\u2026");
        needRec().then(function (rec) {
          if (!rec) { msg(card, "Couldn't find " + id + "."); return null; }
          msg(card, "Rendering\u2026");
          return cfg.onPlay(rec);
        }).then(function (buf) {
          if (!buf) return;
          msg(card, "Playing \u2014 tap \u25B6 again to replay.");
          playBuffer(buf, "card-" + id);
        }, function (e) { msg(card, "Couldn't play: " + (e && e.message || e)); });
      };
      function dl(kind) {
        unlock(); msg(card, "Rendering " + kind.toUpperCase() + "\u2026");
        needRec().then(function (rec) {
          if (!rec) { msg(card, "Couldn't find " + id + "."); return null; }
          return cfg.onPlay(rec);
        }).then(function (buf) {
          if (!buf) return null;
          if (kind === "wav") return { blob: wavBlob(buf), ext: "wav" };
          return mp3Blob(buf).then(function (b) { return { blob: b, ext: "mp3" }; });
        }).then(function (r) {
          if (!r) return;
          var fn = cfg.filename ? cfg.filename(id, r.ext) : (id.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "." + r.ext);
          download(r.blob, fn);
          msg(card, r.ext.toUpperCase() + " downloaded.");
        }, function (e) { msg(card, (e && e.message) || "Download failed."); });
      }
      card.querySelector(".act-wav").onclick = function () { dl("wav"); };
      card.querySelector(".act-mp3").onclick = function () { dl("mp3"); };
    });
  }

  root.SigStudio = {
    PAGES: PAGES, BASE: BASE, esc: esc,
    nav: nav, jahNav: jahNav, unlock: unlock,
    renderSongBuffer: renderSongBuffer, renderBeatBuffer: renderBeatBuffer,
    playBuffer: playBuffer, stopLive: stopLive,
    wavBlob: wavBlob, mp3Ready: mp3Ready, mp3Blob: mp3Blob, download: download,
    findRecord: findRecord, searchIndex: searchIndex, loadIndex: loadIndex, loadChunk: loadChunk,
    mySongs: mySongs, myProjects: mySongs, host: host, stampCounts: stampCounts,
    recordCard: recordCard, wireCards: wireCards
  };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));
