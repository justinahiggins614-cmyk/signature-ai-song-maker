/* Signature Music Studio — studio sections (part 2) */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl, readAloud = window.__readAloud;

  /* ---------- waveform ---------- */
  function drawWave(canvas, buffer) {
    var c = canvas.getContext("2d"), W = canvas.width, H = canvas.height, d = buffer.getChannelData(0), i;
    c.clearRect(0, 0, W, H); c.fillStyle = "#4fe3c1";
    var step = Math.max(1, Math.floor(d.length / W));
    for (i = 0; i < W; i++) { var v = Math.abs(d[Math.floor(i * step)] || 0); var h = Math.max(1, v * H); c.fillRect(i, (H - h) / 2, 1, h); }
  }
  function midiForSound(rec) { return 60 + (D.gen("sound", rec.n).n % 24); }

  /* ---------- sound preview / wav ---------- */
  var _cur = { buf: null, id: null };
  function phraseRender(rec) {
    // honest preview: the voice plays a short seeded phrase (drums get a mini-groove)
    return S.renderBuffer(3.2, function (cc, dd, t0) {
      if (rec.cat === "drum") {
        var pat = S.patternFor("preview:" + rec.id, "hip-hop", 100);
        S.scheduleBeat(cc, dd, t0, pat, 2, 1);
        return;
      }
      var rr = S.rngFrom("pvm:" + rec.id), base = 48 + Math.floor(rr() * 24), seq = [0, 4, 7, 12, 7, 4, 2], i2;
      for (i2 = 0; i2 < seq.length; i2++) {
        (function (tt, nn) {
          var o = cc.createOscillator(), g = cc.createGain();
          o.type = "triangle"; o.frequency.value = S.midiHz(base + nn);
          g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.5, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
          o.connect(g); g.connect(dd); o.start(tt); o.stop(tt + 0.45);
        })(t0 + i2 * 0.42, seq[i2]);
      }
    });
  }
  function previewSound(rec) { phraseRender(rec).then(function (buf) { try { S.setPlayerLabel(rec.name || rec.id); } catch (e) {} S.playBuffer(buf, "preview"); _cur = { buf: buf, id: rec.id }; }); }
  function renderSoundWav(rec) { phraseRender(rec).then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); }); }
  window.__previewSound = previewSound;

  /* ---------- library browser ---------- */
  var LIB = { rows: [], fam: "", type: "", q: "", az: "" };
  function libRows() {
    return LIB.rows.filter(function (r) {
      if (r[2] !== "sound") return false;
      if (LIB.fam && r[4] !== LIB.fam) return false;
      if (LIB.type && r[5] !== LIB.type) return false;
      if (LIB.az && r[1][0].toUpperCase() !== LIB.az) return false;
      if (LIB.q && r[1].toLowerCase().indexOf(LIB.q) === -1) return false;
      return true;
    });
  }
  function renderLib() {
    var rows = libRows().slice(0, 60), h = "";
    rows.forEach(function (r) {
      h += '<div class="card"><h4>' + esc(r[1]) + '</h4><div class="id">' + esc(r[0]) + " · " + esc(r[5]) + " · " + esc(r[4]) + '</div>' +
        '<p><button class="btn ghost" data-libplay="' + esc(r[0]) + '">▶</button> <button class="btn ghost" data-libopen="' + esc(r[0]) + '">Open →</button></p></div>';
    });
    $("libgrid").innerHTML = h || '<div class="card">No matches in the loaded index slice — try clearing filters.</div>';
  }
  window.__initLibrary = function (idx) {
    // extend index rows with family/type for sounds: fetch from records lazily is heavy; derive from id deterministically instead
    LIB.rows = idx.map(function (r) {
      if (r[2] !== "sound") return r;
      var rec = D.genSound(parseInt(r[0].slice(-7), 10));
      return [r[0], r[1], r[2], r[3], rec.cat, rec.subtype];
    });
    var fams = {}, i;
    LIB.rows.forEach(function (r) { if (r[2] === "sound") fams[r[4]] = 1; });
    Object.keys(fams).sort().forEach(function (f) { var o = document.createElement("option"); o.value = f; o.textContent = f; $("libfam").appendChild(o); });
    var az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    $("libaz").innerHTML = az.map(function (l) { return '<button data-az="' + l + '">' + l + "</button>"; }).join("");
    $("libfam").onchange = function () { LIB.fam = this.value; renderLib(); };
    $("libtype").onchange = function () { LIB.type = this.value; renderLib(); };
    $("libq").oninput = function () { LIB.q = this.value.toLowerCase(); renderLib(); };
    $("libaz").addEventListener("click", function (e) {
      var b = e.target.closest("[data-az]"); if (!b) return;
      LIB.az = LIB.az === b.getAttribute("data-az") ? "" : b.getAttribute("data-az");
      Array.prototype.forEach.call($("libaz").querySelectorAll("button"), function (x) { x.classList.toggle("on", x.getAttribute("data-az") === LIB.az); });
      renderLib();
    });
    $("libgrid").addEventListener("click", function (e) {
      var p = e.target.closest("[data-libplay]"), o = e.target.closest("[data-libopen]");
      if (p || o) { try { S.unlockAudio(); } catch (e2) {} }
      if (p) window.__findRecord(p.getAttribute("data-libplay")).then(previewSound);
      /* his order: sound files POP open (popup), not page navigation */
      if (o) { if (window.__openSoundModal) window.__openSoundModal(o.getAttribute("data-libopen")); else location.search = "?sound=" + o.getAttribute("data-libopen"); }
    });
    renderLib();
  };

  /* ---------- equipment browser ---------- */
  window.__initGear = function (idx) {
    var rows = idx.filter(function (r) { return r[2] === "gear"; }).slice(0, 60);
    function draw(f, q) {
      var h = "";
      rows.forEach(function (r) {
        var rec = D.genGear(parseInt(r[0].slice(-7), 10));
        if (f && rec.cat !== f) return;
        if (q && (rec.name + " " + rec.desc).toLowerCase().indexOf(q) === -1) return;
        h += '<div class="card"><h4>' + esc(rec.name) + '</h4><div class="id">' + esc(rec.id) + " · " + esc(rec.cat) + '</div><p>' + esc(rec.desc) + '</p>' +
          '<p><button class="btn ghost" data-gearopen="' + esc(rec.id) + '">Open →</button> <button class="btn ghost" data-gearread="' + esc(rec.id) + '">🔊</button></p></div>';
      });
      $("geargird").innerHTML = h || '<div class="card">No matches — try clearing filters.</div>';
    }
    draw("", "");
    $("gearcat").onchange = function () { draw(this.value, $("gearq").value.toLowerCase()); };
    $("gearq").oninput = function () { draw($("gearcat").value, this.value.toLowerCase()); };
    $("geargird").addEventListener("click", function (e) {
      var o = e.target.closest("[data-gearopen]"), r = e.target.closest("[data-gearread]");
      if (o) { if (window.__openGearModal) window.__openGearModal(o.getAttribute("data-gearopen")); else location.search = "?gear=" + o.getAttribute("data-gearopen"); }
      if (r) window.__findRecord(r.getAttribute("data-gearread")).then(function (rec) { readAloud(rec.name + ". " + rec.desc, rec.id); });
    });
  };

  /* ---------- song archive browser ---------- */
  window.__initSongs = function (idx) {
    var rows = idx.filter(function (r) { return r[2] === "song"; });
    var az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    $("songaz").innerHTML = az.map(function (l) { return '<button data-saz="' + l + '">' + l + "</button>"; }).join("");
    function draw(letter) {
      var q = ($("songq") && $("songq").value || "").toLowerCase();
      var h = "", c = 0, i;
      for (i = 0; i < rows.length && c < 60; i++) {
        if (letter && rows[i][1][0].toUpperCase() !== letter) continue;
        if (q && (rows[i][1] + " " + rows[i][0]).toLowerCase().indexOf(q) === -1) continue;
        c++;
        h += '<div class="card"><h4>' + esc(rows[i][1]) + '</h4><div class="id">' + esc(rows[i][0]) + '</div>' +
          '<p><button class="btn ghost" data-songopen="' + esc(rows[i][0]) + '">Open →</button></p></div>';
      }
      $("songgrid").innerHTML = h || '<div class="card">No songs match — try clearing filters.</div>';
    }
    draw("");
    var _curLetter = "";
    if ($("songq")) $("songq").addEventListener("input", function () { draw(_curLetter); });
    $("songaz").addEventListener("click", function (e) {
      var b = e.target.closest("[data-saz]"); if (!b) return;
      Array.prototype.forEach.call($("songaz").querySelectorAll("button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on"); _curLetter = b.getAttribute("data-saz"); draw(_curLetter);
    });
    $("songgrid").addEventListener("click", function (e) {
      var o = e.target.closest("[data-songopen]"); if (o) location.search = "?song=" + o.getAttribute("data-songopen");
    });
  };

  /* ---------- AI beat maker ---------- */
  var beatBuf = null, beatPat = null, beatPrompt = "", beatBars = 4;
  /* ---------- genre selects (every maker gets one + "surprise me") ---------- */
  function fillGenre(sel, styles) {
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Any — surprise me"; sel.appendChild(o0);
    styles.forEach(function (g) { var o = document.createElement("option"); o.value = g; o.textContent = g.replace(/-/g, " "); sel.appendChild(o); });
  }
  function resolveGenre(prompt, selValue, styles) {
    if (selValue) return selValue;
    var rng = S.rngFrom("surprise:" + String(prompt));
    return styles[Math.floor(rng() * styles.length)];
  }
  window.__resolveGenre = resolveGenre;
  (function () {
    var gsel = $("beatgenre"), ssel = $("songgenre"), msel = $("songmood"), vsel = $("vgenre");
    fillGenre(gsel, D.BEAT_STYLES);
    fillGenre(ssel, S.GENRES);
    fillGenre(vsel, D.BEAT_STYLES);
    S.MOODS.forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; msel.appendChild(o); });
    $("beatmake").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var prompt = $("beatprompt").value || "untitled groove";
      var styleRef = (D.parseStyleRequest) ? D.parseStyleRequest(prompt) : null;
      var genre, bpm;
      if (styleRef) {
        genre = styleRef.genre;
        var bpmIn = +$("beatbpm").value || 92;
        if (bpmIn === 92) { var br = S.rngFrom("stylebpm:" + prompt.toLowerCase()); bpm = styleRef.bpm[0] + Math.floor(br() * (styleRef.bpm[1] - styleRef.bpm[0] + 1)); }
        else bpm = Math.max(60, Math.min(180, bpmIn));
        $("beatstyle").innerHTML = "🎯 <b>" + esc(styleRef.name) + " type beat</b> — an <b>original Signature composition</b> in the style of " + esc(styleRef.name) + " (" + esc(styleRef.note) + "). Not affiliated with or endorsed by " + esc(styleRef.name) + "; no melodies or lyrics reproduced. Same request always makes this beat.";
      } else {
        genre = resolveGenre(prompt, gsel.value, D.BEAT_STYLES);
        bpm = Math.max(60, Math.min(180, +$("beatbpm").value || 92));
        $("beatstyle").innerHTML = "";
      }
      var bars = Math.max(1, Math.min(16, +$("beatbars").value || 4));
      beatPat = S.patternFor(prompt, genre, bpm);
      beatPrompt = prompt; beatBars = bars;
      renderBeatBuf();
    };
    function renderBeatBuf() {
      if (!beatPat) return;
      var secs = beatBars * 16 * (60 / beatPat.bpm / 4);
      $("beatinfo").textContent = "Rendering " + beatPat.genre.replace(/-/g, " ") + " beat at " + beatPat.bpm + " BPM (" + beatBars + " bars)…";
      try { S.setPlayerLabel("AI beat — " + beatPat.genre.replace(/-/g, " ")); S.setBusy("Rendering beat…"); } catch (e) {}
      S.renderBuffer(secs + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, beatPat, beatBars, 1); })
        .then(function (buf) { beatBuf = buf; drawWave($("beatwave"), buf); drawPatternGrid(); $("beatinfo").textContent = "Seeded beat ready — same request always makes this beat. Seed: " + beatPat.seed; S.playBuffer(buf, "beat"); })
        .catch(function (e) { $("beatinfo").textContent = "Couldn't render: " + e.message; });
    }
    var LANES = [["kick", "KICK"], ["snare", "SNARE"], ["hat", "HAT"], ["clap", "CLAP"], ["tom", "TOM"], ["shaker", "SHAKER"]];
    function drawPatternGrid() {
      if (!beatPat) return;
      var h = '<table style="border-collapse:collapse;font-family:Arial;font-size:11px">', li, st;
      for (li = 0; li < LANES.length; li++) {
        h += '<tr><td style="padding:3px 8px;color:var(--mut)">' + LANES[li][1] + '</td>';
        for (st = 0; st < 16; st++) {
          var on = beatPat.steps[LANES[li][0]][st];
          h += '<td data-lane="' + LANES[li][0] + '" data-step="' + st + '" style="width:22px;height:22px;border:1px solid var(--line);background:' + (on ? "var(--gold)" : "#1a1428") + ';cursor:pointer;border-radius:3px"></td>';
        }
        h += "</tr>";
      }
      $("patterngrid").innerHTML = h + "</table>";
    }
    $("patterngrid").addEventListener("click", function (e) {
      var td = e.target.closest("[data-lane]"); if (!td || !beatPat) return;
      try { S.unlockAudio(); } catch (e2) {}
      var lane = td.getAttribute("data-lane"), st = +td.getAttribute("data-step");
      beatPat.steps[lane][st] = beatPat.steps[lane][st] ? 0 : 1;
      renderBeatBuf();
    });
    $("beatplay").onclick = function () { try { S.unlockAudio(); } catch (e) {} if (beatBuf) S.playBuffer(beatBuf, "beat"); };
    $("beatstop").onclick = function () { S.stopLive("beat"); };
    $("beatwav").onclick = function () { if (beatBuf) dl(S.bufferToWav(beatBuf), "signature-beat.wav"); };
  })();

  /* ---------- auto song writer ---------- */
  function themeToN(theme) { return 1 + (S.hashSeed("songtheme:" + theme) % 1000000); }
  window.__writeSong = function (theme, genre, mood) {
    var n = themeToN(theme), rec = D.genSong(n, theme);
    if (genre) rec.genre = genre; if (mood) rec.mood = mood;
    rec.title = theme.split(/\s+/).slice(0, 4).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ") || rec.title;
    // session registry (2026-10-03): the album maker / deep links resolve the
    // EXACT record the AI just made, not the deterministic archive version
    try { (window.__genSongs = window.__genSongs || {})[rec.id] = rec; window.__lastPromptRec = rec; } catch (e) {}
    return rec;
  };
  (function () {
    function showSong(rec) {
      var styleLine = rec.styleNote ? '<div class="honest">🎯 ' + esc(rec.styleNote) + "</div>" : "";
      var h = '<div class="rec"><h3 style="color:var(--gold);margin-top:0">' + esc(rec.title) + ' <span class="id">' + esc(rec.id) + '</span></h3>' +
        '<p class="meta">' + esc(rec.genre) + " · " + esc(rec.mood) + " · " + rec.tempo + " BPM · " + esc(rec.key) + '</p>' + styleLine +
        '<p class="chords">' + esc(rec.chords) + '</p><pre class="lyrics">' + esc(rec.lyrics) + "</pre>" +
        '<p><button class="btn" id="swplay">▶ Play demo mix</button> <button class="btn teal" id="swwav">⬇ .wav</button> ' +
        '<button class="btn ghost" id="swtxt">Copy spec</button> <button class="btn ghost" id="swopen">Open record →</button></p></div>';
      $("songout").innerHTML = h;
      $("swplay").onclick = function () { try { S.unlockAudio(); } catch (e) {} this.textContent = "Rendering…"; var b = this; try { S.setPlayerLabel(rec.title || rec.id); S.setBusy("Rendering song…"); } catch (e2) {} S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { S.playBuffer(buf, "song"); b.textContent = "▶ Play demo mix"; }); };
      $("swwav").onclick = function () { this.textContent = "Rendering…"; var b = this; S.renderFullSong(rec, window.__mixOf ? window.__mixOf() : null, null).then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); b.textContent = "⬇ .wav"; }); };
      $("swtxt").onclick = function () { navigator.clipboard.writeText(JSON.stringify(rec, null, 2)); this.textContent = "Copied!"; };
      $("swopen").onclick = function () { location.search = "?song=" + rec.id; };
    }
    $("songwrite").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var theme = $("songtheme").value || "midnight highway";
      var styleRef = (D.parseStyleRequest) ? D.parseStyleRequest(theme) : null;
      var genre = styleRef ? styleRef.genre : window.__resolveGenre(theme, $("songgenre").value, S.GENRES);
      var mood = styleRef ? styleRef.mood : ($("songmood").value || undefined);
      var rec = window.__writeSong(theme, genre, mood);
      if (styleRef) rec.styleNote = styleRef.name + " type song — an original Signature composition in the style of " + styleRef.name + " (" + styleRef.note + "). Not affiliated with or endorsed by " + styleRef.name + "; no melodies or lyrics reproduced.";
      showSong(rec);
    };
    $("songself").onclick = function () {
      var rec = D.genSong(1);
      rec.title = ($("songtheme").value || "My Song"); rec.genre = $("songgenre").value; rec.mood = $("songmood").value;
      rec.lyrics = "[Verse 1]\n(your first line here)\n(your second line here)\n\n[Chorus]\n(your hook here)\n(your hook again)";
      showSong(rec);
    };
  })();
})();
