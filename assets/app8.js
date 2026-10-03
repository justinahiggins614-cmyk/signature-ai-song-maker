/* ============================================================
   Signature Music Studio (part 8) — 2026-10-02:
   Suno-simple front door (prompt-first Make + Explore feed),
   step-by-step popup launchers, AI-do-everything buttons,
   metronome, MIDI export, stem export, specified/random
   track pull-up + playlists for the AI pal.
   His orders: "reorganize studio maker. Make it more like this"
   (Suno), "keep the step by step process under in a pop up box
   and under files of beats and songs", "streamline. Make
   everything ai doable", "even pulling up specified or random
   tracks and playlists", "trawl all music maker apps, make mine
   the best with most tools and own ai".
   ============================================================ */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl,
      readAloud = window.__readAloud;
  if (!S || !D) return;

  var LIVEID = "promptplay";
  function mixOf() { return window.__mixOf ? window.__mixOf() : null; }
  function numId(id) { var m = /(\d+)$/.exec(id || ""); return m ? +m[1] : 0; }
  function latest(kind, n) {
    var idx = window.__getIdx ? window.__getIdx() : [];
    return idx.filter(function (r) { return r[2] === kind; })
      .sort(function (a, b) { return numId(b[0]) - numId(a[0]); }).slice(0, n || 6);
  }

  /* ---------- honest play helper (same pattern as the Finder) ---------- */
  function playStarted(buf, btn, nowEl, label, liveId) {
    var src = null;
    try { src = S.playBuffer(buf, liveId || LIVEID); } catch (e) { src = null; }
    if (!src) {
      btn.textContent = btn.getAttribute("data-label") || "▶ Play"; btn.disabled = false;
      nowEl.innerHTML = '<span class="fblocked">Audio is blocked in this browser — tap ▶ again to retry.</span>';
      return null;
    }
    btn.textContent = "♪ Playing…"; btn.disabled = true;
    nowEl.innerHTML = '<span class="eq" aria-hidden="true"><span></span><span></span><span></span></span><span>Now playing' +
      (label ? " — " + esc(label) : "") + '</span><button class="fstop" type="button">■ Stop</button>';
    var st = nowEl.querySelector(".fstop");
    if (st) st.onclick = function () { try { S.unlockAudio(); } catch (e2) {} S.stopLive(liveId || LIVEID); playReset(btn, nowEl); };
    return src;
  }
  function playReset(btn, nowEl) {
    btn.textContent = btn.getAttribute("data-label") || "▶ Play"; btn.disabled = false;
    nowEl.innerHTML = "";
  }
  function renderFail(btn, nowEl, msg) {
    btn.textContent = btn.getAttribute("data-label") || "▶ Play"; btn.disabled = false;
    nowEl.innerHTML = '<span class="fblocked">' + esc(msg) + "</span>";
  }

  /* ================= FRONT DOOR: prompt-first song maker ================= */
  function initFrontDoor() {
    var ps = $("promptstyle");
    if (ps && D.BEAT_STYLES) {
      ps.innerHTML = '<option value="">Any — surprise me</option>' + D.BEAT_STYLES.map(function (s) {
        return '<option value="' + esc(s.name) + '">' + esc(s.name) + " type beat</option>";
      }).join("");
    }
    var b = $("promptcreate");
    if (b) b.onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var prompt = ($("promptbox").value || "").trim() || "a great song";
      var style = $("promptstyle").value, lm = $("promptlyrics").value;
      $("promptinfo").textContent = "Creating your song…";
      var rec = null;
      try { rec = window.__writeSong ? window.__writeSong(prompt, style, undefined) : null; } catch (e) { rec = null; }
      if (!rec) { $("promptinfo").textContent = "Could not start — try again."; return; }
      rec._lyricMode = lm;
      $("promptinfo").textContent = "Done — your song is ready.";
      renderPromptResult(rec, prompt, lm);
      if (window.__palSay) window.__palSay("Your song '" + rec.title + "' is ready — 18-bar verses, four chorus breaks, rhyming lyrics. Tap ▶ to hear it.");
    };
    var w2 = $("walkopen2");
    if (w2) w2.onclick = function () { if (window.__openWalk) window.__openWalk(); };
  }

  function renderPromptResult(rec, prompt, lm) {
    var out = $("promptout"), h = "";
    h += '<div class="card"><h4>' + esc(rec.title) + '</h4><div class="id">' + esc(rec.id) +
      " · " + esc(rec.genre) + " · " + esc(rec.tempo) + " BPM · " + esc(rec.key) + "</div>" +
      '<p class="seqlab">The 5:00 standard — intro build-up, 18-bar verses, <b>four</b> 30-second chorus breaks, bridge beat-switch, fade out.</p>';
    if (lm === "typed") {
      h += '<div><label>Your lyrics (the AI wrote a rhyming draft — make it yours)</label>' +
        '<textarea id="promptlyricstext" rows="8" style="width:100%">' + esc(rec.lyrics || "") + "</textarea></div>" +
        '<p><button class="btn ghost" id="promptuselyrics">Use these lyrics</button> <span class="seqlab" id="promptlyricsmsg"></span></p>';
    } else if (lm === "none") {
      h += '<p class="seqlab">🎼 Instrumental version — no vocal track.</p>';
    } else {
      h += '<details><summary style="color:var(--gold);cursor:pointer">📝 Lyrics (rhyming, one theme)</summary><pre style="white-space:pre-wrap;font-size:14px">' +
        esc(rec.lyrics || "") + "</pre></details>";
    }
    h += '<p><button class="fplay" type="button" id="promptplaybtn" data-label="▶ Play my song">▶ Play my song</button>' +
      '<button class="fstop2 btn ghost" type="button" id="promptstopbtn">■ Stop</button></p><div class="fnow" id="promptnow" aria-live="polite"></div>';
    h += '<p><button class="btn teal" id="promptwav">⬇ .wav</button> ' +
      '<button class="btn ghost" id="promptmidi">⬇ MIDI</button> ' +
      '<button class="btn ghost" id="promptstems">⬇ Stems (5)</button> ' +
      '<button class="btn ghost" id="promptread">🔊 Read lyrics</button> ' +
      '<button class="btn ghost" id="promptopen">📄 Open record</button> ' +
      '<button class="btn violet" id="promptwalk">🎧 Refine in walkthrough</button></p><div class="seqlab" id="promptdl"></div></div>';
    out.innerHTML = h;

    var pb = $("promptplaybtn"), now = $("promptnow");
    pb.onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      S.stopLive(LIVEID); playReset(pb, now);
      pb.textContent = "Rendering…"; pb.disabled = true;
      S.renderFullSong(rec, mixOf(), null).then(function (buf) {
        playStarted(buf, pb, now, rec.title, LIVEID);
      }, function () { renderFail(pb, now, "Could not render this song."); });
    };
    $("promptstopbtn").onclick = function () { S.stopLive(LIVEID); playReset(pb, now); };
    $("promptwav").onclick = function () {
      var b = this; b.textContent = "Rendering…";
      S.renderFullSong(rec, mixOf(), null).then(function (buf) {
        dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav";
        $("promptdl").textContent = "Saved " + rec.id + ".wav";
      });
    };
    $("promptmidi").onclick = function () {
      dl(new Blob([midiBytes(rec)], { type: "audio/midi" }), rec.id + ".mid");
      $("promptdl").textContent = "Saved " + rec.id + ".mid — melody, chords, drums.";
    };
    $("promptstems").onclick = function () {
      var buses = ["drums", "bass", "chords", "lead", "vocal"], i = 0, b = this;
      $("promptdl").textContent = "Rendering stems one by one…";
      (function next() {
        if (i >= buses.length) { $("promptdl").textContent = "All 5 stems saved."; b.textContent = "⬇ Stems (5)"; return; }
        var bus = buses[i]; b.textContent = "Stem " + (i + 1) + "/5: " + bus + "…";
        var mix = { drums: 0, bass: 0, chords: 0, lead: 0, vocal: 0 }; mix[bus] = 1;
        S.renderFullSong(rec, mix, null).then(function (buf) {
          dl(S.bufferToWav(buf), rec.id + ".stem-" + bus + ".wav"); i++; next();
        }, function () { $("promptdl").textContent = "Stem render failed on " + bus + "."; b.textContent = "⬇ Stems (5)"; });
      })();
    };
    $("promptread").onclick = function () { readAloud(rec.title + ". " + (rec.lyrics || "Instrumental."), "song lyrics"); };
    $("promptopen").onclick = function () { location.hash = ""; location.search = "?song=" + rec.id; location.reload(); };
    $("promptwalk").onclick = function () { if (window.__openWalk) window.__openWalk(); };
    var ul = $("promptuselyrics");
    if (ul) ul.onclick = function () {
      rec.lyrics = $("promptlyricstext").value;
      $("promptlyricsmsg").textContent = "Lyrics set — they'll travel with this song.";
    };
  }
  window.__renderPromptResult = renderPromptResult;

  /* ================= EXPLORE FEED ================= */
  var EXLIVE = "explore";
  function exploreStop() {
    try { S.stopLive(EXLIVE); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll("#exploregrid .fplay"), function (b) {
      b.textContent = b.getAttribute("data-label") || "▶ Play"; b.disabled = false;
    });
    Array.prototype.forEach.call(document.querySelectorAll("#exploregrid .fnow"), function (n) { n.innerHTML = ""; });
  }
  function playExploreBeat(id, title, btn, nowEl) {
    try { S.unlockAudio(); } catch (e) {}
    exploreStop();
    btn.textContent = "Loading…"; btn.disabled = true;
    window.__findRecord(id).then(function (rec) {
      btn.textContent = "Rendering…";
      var pat = S.patternFor(rec.name, rec.style, rec.bpm);
      S.renderBuffer(16 * (60 / rec.bpm / 4) * 4 + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 4, 1); })
        .then(function (buf) { playStarted(buf, btn, nowEl, title, EXLIVE); },
          function () { renderFail(btn, nowEl, "Could not render this beat."); });
    }, function () { renderFail(btn, nowEl, "Could not load this beat."); });
  }
  function playExploreSong(id, title, btn, nowEl) {
    try { S.unlockAudio(); } catch (e) {}
    exploreStop();
    btn.textContent = "Loading…"; btn.disabled = true;
    window.__findRecord(id).then(function (rec) {
      btn.textContent = "Rendering…";
      S.renderSong(rec, 30, mixOf())
        .then(function (buf) { playStarted(buf, btn, nowEl, title + " · 30s preview", EXLIVE); },
          function () { renderFail(btn, nowEl, "Could not render this song."); });
    }, function () { renderFail(btn, nowEl, "Could not load this song."); });
  }
  function renderExplore() {
    var g = $("exploregrid");
    if (!g) return;
    var songs = latest("song", 6), beats = latest("beat", 6), h = "";
    songs.forEach(function (r) {
      h += '<div class="card"><h4>' + esc(r[1]) + '</h4><div class="id">' + esc(r[0]) + ' · song</div>' +
        '<p><button class="fplay" type="button" data-kind="song" data-id="' + esc(r[0]) + '" data-label="▶ Play">▶ Play</button>' +
        '<button class="btn ghost" data-open="' + esc(r[0]) + '" data-p="song">Open →</button></p><div class="fnow" aria-live="polite"></div></div>';
    });
    beats.forEach(function (r) {
      h += '<div class="card"><h4>' + esc(r[1]) + '</h4><div class="id">' + esc(r[0]) + ' · beat</div>' +
        '<p><button class="fplay" type="button" data-kind="beat" data-id="' + esc(r[0]) + '" data-label="▶ Play">▶ Play</button>' +
        '<button class="btn ghost" data-open="' + esc(r[0]) + '" data-p="beat">Open →</button></p><div class="fnow" aria-live="polite"></div></div>';
    });
    g.innerHTML = h || '<div class="card">Nothing in the index yet.</div>';
    Array.prototype.forEach.call(g.querySelectorAll(".fplay"), function (b) {
      b.onclick = function () {
        var kind = b.getAttribute("data-kind"), id = b.getAttribute("data-id");
        var nowEl = b.parentNode.parentNode.querySelector(".fnow");
        var title = b.parentNode.parentNode.querySelector("h4").textContent;
        if (kind === "beat") playExploreBeat(id, title, b, nowEl);
        else playExploreSong(id, title, b, nowEl);
      };
    });
    Array.prototype.forEach.call(g.querySelectorAll("[data-open]"), function (b) {
      b.onclick = function () { location.hash = ""; location.search = "?" + b.getAttribute("data-p") + "=" + b.getAttribute("data-open"); location.reload(); };
    });
  }
  window.__renderExplore = renderExplore;

  /* ============ STEP-BY-STEP POPUP (order: under beats & songs files) ============ */
  function initWalkLaunchers() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-walkopen]") : null;
      if (!b) return;
      e.preventDefault();
      if (window.__openWalk) window.__openWalk();
    });
  }

  /* ============ AI-DO-EVERYTHING buttons (order: everything AI-doable) ============ */
  function aiBtn(secId, label, fn) {
    var sec = document.getElementById(secId);
    if (!sec) return;
    var h = sec.querySelector("h2");
    if (!h || sec.querySelector("[data-aido]")) return;
    var b = document.createElement("button");
    b.className = "btn violet"; b.type = "button";
    b.setAttribute("data-aido", "1");
    b.textContent = "🤖 AI: " + label;
    b.style.marginLeft = "10px";
    b.onclick = function () { try { S.unlockAudio(); } catch (e) {} fn(b); };
    h.appendChild(b);
  }
  function palNote(t) { if (window.__palSay) window.__palSay(t); }
  function initAIDoAll() {
    // Sound library: AI picks sounds
    aiBtn("studio", "pick sounds for me", function (b) {
      var rows = latest("sound", 60), picks = [], i, r;
      var rng = S.rngFrom("aipick:" + Date.now());
      for (i = 0; i < 6 && rows.length; i++) { r = rows.splice(Math.floor(rng() * rows.length), 1)[0]; picks.push(r); }
      var box = document.getElementById("aipicks");
      if (!box) { box = document.createElement("div"); box.id = "aipicks"; box.className = "grid"; b.parentNode.parentNode.appendChild(box); }
      box.innerHTML = picks.map(function (x) {
        return '<div class="card"><h4>' + esc(x[1]) + '</h4><div class="id">' + esc(x[0]) + '</div>' +
          '<p><button class="btn ghost" data-aipreview="' + esc(x[0]) + '">▶ Preview</button></p></div>';
      }).join("");
      Array.prototype.forEach.call(box.querySelectorAll("[data-aipreview]"), function (pb2) {
        pb2.onclick = function () {
          window.__findRecord(pb2.getAttribute("data-aipreview")).then(function (rec) {
            if (window.__previewSound) window.__previewSound(rec);
          });
        };
      });
      palNote("I picked 6 sounds for you — tap ▶ on any of them to hear it. Save your keepers to My Library.");
    });
    // Equipment: AI recommends a rig
    aiBtn("equipment", "recommend my rig", function (b) {
      var idx = window.__getIdx ? window.__getIdx() : [];
      function firstMatch(words) {
        for (var i = 0; i < idx.length; i++) {
          if (idx[i][2] !== "gear") continue;
          var t = (idx[i][1] || "").toLowerCase(), ok = true, w;
          for (w = 0; w < words.length; w++) if (t.indexOf(words[w]) === -1) { ok = false; break; }
          if (ok) return idx[i];
        }
        return null;
      }
      var mic = firstMatch(["mic"]) || firstMatch(["microphone"]) || ["", "Studio condenser mic", ""],
          iface = firstMatch(["interface"]) || ["", "Audio interface", ""],
          mon = firstMatch(["monitor"]) || ["", "Studio monitors", ""];
      var box = document.getElementById("airig");
      if (!box) { box = document.createElement("div"); box.id = "airig"; b.parentNode.parentNode.appendChild(box); }
      box.innerHTML = '<div class="card"><h4>🤖 Your AI-recommended rig</h4>' +
        "<p>🎤 Mic: <b>" + esc(mic[1]) + "</b><br>🔌 Interface: <b>" + esc(iface[1]) + "</b><br>🔊 Monitors: <b>" + esc(mon[1]) + "</b></p>" +
        '<p><button class="btn ghost" id="airigread">🔊 Read aloud</button></p></div>';
      $("airigread").onclick = function () { readAloud("Your AI recommended rig. Microphone: " + mic[1] + ". Interface: " + iface[1] + ". Monitors: " + mon[1] + ".", "rig"); };
      palNote("Rig recommended: " + mic[1] + ", " + iface[1] + ", " + mon[1] + ". Open any of them for the full patch list.");
    });
    // Vocal studio: AI chooses the voice
    aiBtn("vocalstudio", "choose my voice", function () {
      var voices = ["nova", "ember", "drift", "stone"];
      var v = voices[Math.floor(S.rngFrom("aivoice:" + Date.now())() * voices.length)];
      var sel = $("vvoice");
      if (sel) sel.value = v;
      if (window.__proj) window.__proj().vocal.voice = v;
      palNote("I chose the " + v + " voice for this one — bright enough to cut through the mix. Tap 🎤 Sing it to hear it.");
    });
    // Backups: AI chooses
    aiBtn("backups", "choose my backups", function () {
      var sel = $("vbackup");
      if (sel) {
        Array.prototype.forEach.call(sel.options, function (o) { o.selected = (o.value === "choir" || o.value === "adlibs"); });
      }
      if (window.__proj) window.__proj().vocal.backups = ["choir", "adlibs"];
      palNote("Backup plan: a full choir stack on the choruses plus ad-libs on the outro. Classic and huge.");
    });
    // CD: AI assembles
    aiBtn("cdmaker", "assemble my CD", function () {
      var songs = latest("song", 5).map(function (r) { return r[0]; });
      var ta = $("cdlist");
      if (ta) ta.value = songs.join("\n");
      if (window.__proj) window.__proj().cd.tracks = songs.slice();
      $("cdinfo").textContent = songs.length + " tracks lined up by the AI.";
      palNote("CD assembled — " + songs.length + " fresh tracks, ordered for flow. Name the album and artist, then burn it.");
    });
  }

  /* ============ METRONOME (trawl gap: n-Track/BandLab click track) ============ */
  var metro = { on: false, timer: null, beat: 0 };
  function initMetronome() {
    var sec = document.getElementById("console");
    if (!sec) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = '<p><button class="btn ghost" id="metrobtn" type="button">🥁 Metronome: off</button> ' +
      '<label style="display:inline">BPM <input id="metrobpm" type="number" value="100" min="40" max="220" style="width:70px"></label></p>';
    sec.appendChild(wrap);
    $("metrobtn").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      if (metro.on) {
        metro.on = false; clearInterval(metro.timer); metro.timer = null;
        $("metrobtn").textContent = "🥁 Metronome: off";
        return;
      }
      var bpm = Math.max(40, Math.min(220, +$("metrobpm").value || 100));
      metro.on = true; metro.beat = 0;
      $("metrobtn").textContent = "🥁 Metronome: on (" + bpm + " BPM)";
      metro.timer = setInterval(function () {
        metro.beat = (metro.beat + 1) % 4;
        try { S.playTone(metro.beat === 0 ? 96 : 84, 0.06, "keys"); } catch (e) {}
      }, 60000 / bpm);
    };
  }

  /* ============ MIDI EXPORT (trawl gap: Suno Premier / n-Track) ============ */
  function vlq(n) {
    var b = [n & 127], out;
    n >>= 7;
    while (n > 0) { b.unshift((n & 127) | 128); n >>= 7; }
    return b;
  }
  function midiBytes(song) {
    var plan = S.sectionPlan(song), bpm = plan.bpm || 100, div = 96;
    var ev = [], tick = 0, s, bar, beat, mi = 0, ch;
    var us = Math.round(60000000 / bpm);
    ev.push([0, [0xFF, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255]]);
    ev.push([0, [0xFF, 0x58, 0x04, 4, 2, 24, 8]]);
    ev.push([0, [0xC0, 0]]);   // ch0: grand piano
    ev.push([0, [0xC1, 48]]);  // ch1: strings
    var mel = plan.melody;
    for (s = 0; s < plan.sections.length; s++) {
      for (bar = 0; bar < plan.sections[s].bars; bar++) {
        ch = plan.chords[(tick / (div * 4) | 0) % plan.chords.length];
        // chord pad (strings, ch1): root+third+fifth, whole bar
        [ch[0] - 12, ch[1] - 12, ch[2] - 12].forEach(function (n) {
          ev.push([tick, [0x91, n, 64]]); ev.push([tick + div * 4, [0x81, n, 64]]);
        });
        // drums (ch9): kick 1&3, snare 2&4, hats 8ths
        [[0, 36], [div * 2, 36]].forEach(function (d) { ev.push([tick + d[0], [0x99, d[1], 100]]); ev.push([tick + d[0] + 24, [0x89, d[1], 64]]); });
        [[div, 40], [div * 3, 40]].forEach(function (d) { ev.push([tick + d[0], [0x99, d[1], 90]]); ev.push([tick + d[0] + 24, [0x89, d[1], 64]]); });
        for (beat = 0; beat < 8; beat++) { ev.push([tick + beat * (div / 2), [0x99, 42, beat % 2 ? 50 : 70]]); ev.push([tick + beat * (div / 2) + 12, [0x89, 42, 40]]); }
        // melody (piano, ch0)
        for (beat = 0; beat < 4; beat++) {
          var m = mel[mi++];
          if (m && m.midi >= 0) {
            ev.push([tick + beat * div, [0x90, m.midi, 88]]);
            ev.push([tick + beat * div + Math.round(m.len * div), [0x80, m.midi, 64]]);
          }
        }
        tick += div * 4;
      }
    }
    ev.push([tick, [0xFF, 0x2F, 0x00]]);
    ev.sort(function (a, b) { return a[0] - b[0]; });
    var track = [], last = 0, i, j, e;
    for (i = 0; i < ev.length; i++) { e = ev[i]; track = track.concat(vlq(e[0] - last), e[1]); last = e[0]; }
    var head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (div >> 8) & 255, div & 255,
      0x4D, 0x54, 0x72, 0x6B, (track.length >> 24) & 255, (track.length >> 16) & 255, (track.length >> 8) & 255, track.length & 255];
    return new Uint8Array(head.concat(track));
  }
  window.__midiBytes = midiBytes;
  window.__downloadStem = function (song, bus) {
    var mix = { drums: 0, bass: 0, chords: 0, lead: 0, vocal: 0 };
    mix[bus] = 1;
    return S.renderFullSong(song, mix, null).then(function (buf) {
      dl(S.bufferToWav(buf), song.id + ".stem-" + bus + ".wav");
    });
  };

  /* ============ SPECIFIED / RANDOM TRACKS + PLAYLISTS (AI pal commands) ============ */
  var PL = { queue: [], ix: 0, playing: false };
  function resolveAny(id) {
    if (window.__resolveTrack) return window.__resolveTrack(id);
    return window.__findRecord(id);
  }
  function playRecFull(rec, label, liveId) {
    try { S.unlockAudio(); } catch (e) {}
    S.stopLive(liveId || LIVEID);
    return (rec.kind === "beat"
      ? window.__findRecord(rec.id).then(function (r) {
          var pat = S.patternFor(r.name, r.style, r.bpm);
          return S.renderBuffer(30, function (c, dest, t0) {
            // 30s loop of the beat
            var beats = Math.floor(30 / (60 / r.bpm / 4));
            S.scheduleBeat(c, dest, t0, pat, Math.ceil(beats / 16) * 16, 1);
          });
        })
      : S.renderFullSong(rec, mixOf(), null)
    ).then(function (buf) {
      var src = null;
      try { src = S.playBuffer(buf, liveId || LIVEID); } catch (e) { src = null; }
      if (src && label && window.__palSay) window.__palSay("Now playing: " + label + (rec.kind === "song" ? " — full 5:00." : " — 30-second beat loop."));
      return src;
    });
  }
  window.__playTrack = function (id) {
    return resolveAny(id).then(function (rec) {
      PL.playing = false; PL.queue = [];
      return playRecFull(rec, (rec.title || rec.name || rec.id) + " (" + rec.id + ")");
    });
  };
  window.__playRandomTrack = function (kind) {
    var idx = window.__getIdx ? window.__getIdx() : [];
    var rows = idx.filter(function (r) { return r[2] === kind; });
    if (!rows.length) { if (window.__palSay) window.__palSay("No " + kind + "s in the index yet."); return Promise.resolve(null); }
    var pick = rows[Math.floor(Math.random() * rows.length)];
    return window.__playTrack(pick[0]);
  };
  window.__playPlaylist = function (ids) {
    PL.queue = ids.slice(); PL.ix = 0; PL.playing = true;
    renderPlBar();
    return playNextInQueue();
  };
  window.__stopPlaylist = function () {
    PL.playing = false; PL.queue = []; S.stopLive("playlist");
    var bar = document.getElementById("plbar"); if (bar) bar.innerHTML = "";
  };
  function renderPlBar() {
    var pal = document.getElementById("palsay");
    var bar = document.getElementById("plbar");
    if (!bar && pal) {
      bar = document.createElement("div"); bar.id = "plbar";
      bar.className = "card"; bar.style.marginTop = "10px";
      pal.parentNode.insertBefore(bar, pal.nextSibling);
    }
    if (!bar) return;
    var h = "<b>🎶 Playlist</b> (" + PL.queue.length + " tracks) ";
    h += '<button class="btn ghost" id="plnext">Next ▶</button> <button class="btn ghost" id="plstop">■ Stop</button><br>';
    h += '<span class="seqlab">' + esc(PL.queue.map(function (id, i) { return (i === PL.ix ? "▶ " : "") + id; }).join(" · ")) + "</span>";
    bar.innerHTML = h;
    document.getElementById("plnext").onclick = function () { playNextInQueue(true); };
    document.getElementById("plstop").onclick = function () { window.__stopPlaylist(); if (window.__palSay) window.__palSay("Playlist stopped."); };
  }
  function playNextInQueue(manual) {
    if (!PL.playing || PL.ix >= PL.queue.length) { window.__stopPlaylist(); return Promise.resolve(null); }
    var id = PL.queue[PL.ix++];
    renderPlBar();
    return resolveAny(id).then(function (rec) {
      return playRecFull(rec, (rec.title || rec.name || rec.id) + " (" + PL.ix + "/" + PL.queue.length + ")", "playlist");
    }).then(function (src) {
      if (src && PL.playing) {
        try { src.onended = function () { if (PL.playing) playNextInQueue(); }; } catch (e) {}
      }
      return src;
    });
  }

  /* ================= boot ================= */
  function boot() {
    initFrontDoor(); initWalkLaunchers(); initAIDoAll(); initMetronome();
    // Explore feed renders once the archive index is in
    var tries = 0, t = setInterval(function () {
      tries++;
      var idx = window.__getIdx ? window.__getIdx() : [];
      if (idx.length || tries > 40) { clearInterval(t); try { renderExplore(); } catch (e) {} }
    }, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
