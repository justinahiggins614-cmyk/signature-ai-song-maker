/* Studio Session part 6b: stage panes + DAW popup (appended) */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl,
      openModal = window.__openModal, closeModal = window.__closeModal;
  var PROJ = window.__proj();

  function stagePane() { return $("stagepane"); }
  function doneBtn(n) {
    return '<p><button class="btn teal" data-done="' + n + '">✓ Stage ' + n + ' done — next →</button></p>';
  }

  /* ----- Stage 1: Sounds ----- */
  function stage1() {
    var idx = window.__getIdx ? window.__getIdx() : [];
    var rows = idx.filter(function (r) { return r[2] === "sound"; });
    var az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    var h = "<h3>Stage 1 — Sounds</h3><p>Browse A–Z. Every file <b>pops open</b> — preview it, then save the keepers to <b>My Library</b>.</p>" +
      '<div class="az">' + az.map(function (l) { return '<button data-s1az="' + l + '">' + l + "</button>"; }).join("") + "</div>" +
      '<div class="grid" id="s1grid" style="margin-top:10px"></div>' + doneBtn(1);
    stagePane().innerHTML = h;
    function draw(letter) {
      var g = "", c = 0, i;
      for (i = 0; i < rows.length && c < 24; i++) {
        if (letter && rows[i][1][0].toUpperCase() !== letter) continue;
        c++;
        g += '<div class="card"><h4>' + esc(rows[i][1]) + '</h4><div class="id">' + esc(rows[i][0]) + '</div>' +
          '<p><button class="btn ghost" data-s1pop="' + esc(rows[i][0]) + '">👁 Pop open</button></p></div>';
      }
      $("s1grid").innerHTML = g || '<div class="card">Nothing under ' + esc(letter || "—") + " in this slice.</div>";
    }
    draw("");
    if (!stagePane().__s1wired) {
      stagePane().__s1wired = 1;
      stagePane().addEventListener("click", function s1(e) {
      var b = e.target.closest("[data-s1az]");
      if (b) {
        Array.prototype.forEach.call(stagePane().querySelectorAll("[data-s1az]"), function (x) { x.classList.remove("on"); });
        b.classList.add("on"); draw(b.getAttribute("data-s1az")); return;
      }
      var p = e.target.closest("[data-s1pop]");
      if (p && window.__openSoundModal) window.__openSoundModal(p.getAttribute("data-s1pop"));
      var d = e.target.closest("[data-done]");
      if (d) { markDoneStage(1); gotoStage(2); }
      });
    }
  }

  /* ----- Stage 2: Beat ----- */
  function stage2() {
    var h = "<h3>Stage 2 — Beat</h3>" +
      '<div class="row"><div><label>Describe your beat (try "Nas type beat" or "Eminem type beat")</label><input type="text" id="s2prompt" placeholder="e.g. dark trap banger, Nas type beat…"></div>' +
      '<div><label>Genre</label><select id="s2genre"><option value="">Any — surprise me</option></select></div>' +
      '<div><label>BPM</label><input type="number" id="s2bpm" value="92" min="60" max="180"></div></div>' +
      "<p><button class='btn' id='s2make'>🤖 Make my beat</button> " +
      "<button class='btn ghost' id='s2inst'>🎹 Pick instruments (popup)</button> " +
      "<button class='btn ghost' id='s2guides'>📖 Beat guides — every genre</button></p>" +
      "<p class='seqlab' id='s2info'></p><p class='seqlab' id='s2instlist'></p>" + doneBtn(2);
    stagePane().innerHTML = h;
    D.BEAT_STYLES.forEach(function (g) { var o = document.createElement("option"); o.value = g; o.textContent = g.replace(/-/g, " "); $("s2genre").appendChild(o); });
    if (PROJ.instruments.length) $("s2instlist").textContent = "Instruments: " + PROJ.instruments.length + " picked.";
    $("s2inst").onclick = function () {
      window.__openInstrumentPicker(function (ids) {
        PROJ.instruments = ids; saveProjSafe();
        $("s2instlist").textContent = "Instruments: " + ids.length + " picked.";
        window.__palSay("Nice — " + ids.length + " instruments locked in for the session.");
      }, true);
    };
    $("s2guides").onclick = function () { if (window.__openGuides) window.__openGuides(); };
    $("s2make").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var prompt = $("s2prompt").value || "session groove";
      var styleRef = D.parseStyleRequest ? D.parseStyleRequest(prompt) : null;
      var genre = styleRef ? styleRef.genre : (window.__resolveGenre ? window.__resolveGenre(prompt, $("s2genre").value, D.BEAT_STYLES) : "hip-hop");
      var bpm = Math.max(60, Math.min(180, +$("s2bpm").value || 92));
      PROJ.beat = { prompt: prompt, genre: genre, bpm: bpm, bars: 8, style: styleRef ? styleRef.name + " type" : null };
      PROJ.genre = genre; PROJ.bpm = bpm; saveProjSafe();
      var pat = S.patternFor(prompt, genre, bpm);
      $("s2info").innerHTML = (styleRef ? "🎯 <b>" + esc(styleRef.name) + " type beat</b> — original Signature composition, not affiliated. " : "") +
        "Rendering " + esc(genre.replace(/-/g, " ")) + " at " + bpm + " BPM…";
      S.renderBuffer(8 * 16 * (60 / bpm / 4) + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 8, 1); })
        .then(function (buf) { S.playBuffer(buf, "s2beat"); $("s2info").innerHTML += " Playing. 🎶"; markDoneStage(2); });
    };
    stagePane().querySelector("[data-done]").onclick = function () { markDoneStage(2); gotoStage(3); };
  }

  /* ----- Stage 3: Lyrics ----- */
  function stage3() {
    var h = "<h3>Stage 3 — Lyrics</h3>" +
      "<p><button class='btn ghost' id='s3search'>🔎 Search the song archive (popup)</button> " +
      "<button class='btn' id='s3ai'>🤖 AI: draft lyrics</button></p>" +
      "<div><label>Your lyrics (one line per phrase)</label><textarea id='s3lyrics' rows='8' style='width:100%'>" + esc(PROJ.lyrics || "") + "</textarea></div>" + doneBtn(3);
    stagePane().innerHTML = h;
    $("s3search").onclick = function () {
      window.__openSongSearch(function (id) {
        window.__findRecord(id).then(function (rec) {
          PROJ.lyrics = rec.lyrics; PROJ.song = rec; saveProjSafe();
          $("s3lyrics").value = rec.lyrics;
          window.__palSay("Pulled '" + rec.title + "' from the archive — its lyrics are in your editor. Make them yours.");
        });
      });
    };
    $("s3ai").onclick = function () {
      var theme = ($("s2prompt") && $("s2prompt").value) || "midnight highway";
      var rec = window.__writeSong ? window.__writeSong(theme, PROJ.genre || undefined, undefined) : null;
      if (rec) { PROJ.lyrics = rec.lyrics; PROJ.song = rec; saveProjSafe(); $("s3lyrics").value = rec.lyrics; window.__palSay("Drafted '" + rec.title + "' — edit it to taste."); }
    };
    $("s3lyrics").oninput = function () { PROJ.lyrics = this.value; saveProjSafe(); };
    stagePane().querySelector("[data-done]").onclick = function () { markDoneStage(3); gotoStage(4); };
  }

  /* ----- Stage 4: Singing ----- */
  function stage4() {
    var h = "<h3>Stage 4 — Singing</h3>" +
      "<p class='seqlab'>Lead vocal, backup singers, vocal edits — synthesized voices, labeled honestly, always.</p>" +
      '<div class="row"><div><label>Lead voice</label><select id="s4voice"><option value="nova">Nova — bright airy (synth)</option><option value="ember">Ember — warm alto (synth)</option><option value="drift">Drift — soft breathy (synth)</option><option value="stone">Stone — deep resonant (synth)</option></select></div>' +
      '<div><label>Backup singers</label><select id="s4backup" multiple size="4"><option value="soprano">Soprano section</option><option value="alto">Alto section</option><option value="tenor">Tenor section</option><option value="bass">Bass section</option><option value="choir">Choir stack</option><option value="adlibs">Ad-libs</option></select></div></div>' +
      "<p><button class='btn violet' id='s4sing'>🎤 Sing my lyrics</button> " +
      "<button class='btn ghost' id='s4tovocal'>Open full Vocal Studio →</button></p>" +
      "<p class='seqlab' id='s4info'></p>" + doneBtn(4);
    stagePane().innerHTML = h;
    $("s4voice").value = PROJ.vocal.voice;
    Array.prototype.forEach.call($("s4backup").options, function (o) { if (PROJ.vocal.backups.indexOf(o.value) !== -1) o.selected = true; });
    $("s4tovocal").onclick = function () { document.getElementById("vocalstudio").scrollIntoView({ behavior: "smooth" }); };
    $("s4sing").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var lines = (PROJ.lyrics || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { $("s4info").textContent = "Write lyrics in stage 3 first."; return; }
      var voice = $("s4voice").value;
      var backs = Array.prototype.map.call($("s4backup").selectedOptions, function (o) { return o.value; });
      PROJ.vocal = { voice: voice, backups: backs }; saveProjSafe();
      var rng = S.rngFrom("s4mel:" + lines.join("|")), mel = [], li;
      for (li = 0; li < lines.length; li++) { var n = 3 + Math.floor(rng() * 4), ni; for (ni = 0; ni < n; ni++) mel.push({ midi: 60 + Math.floor(rng() * 12), len: 1 }); }
      $("s4info").textContent = "Synthesizing vocal (" + voice + ")…";
      S.renderVocal(mel, voice, backs, 60, PROJ.mix).then(function (buf) {
        S.playBuffer(buf, "s4vocal"); $("s4info").textContent = "Done — synthesized vocal" + (backs.length ? " with " + backs.join(", ") : "") + ".";
        markDoneStage(4);
      });
    };
    stagePane().querySelector("[data-done]").onclick = function () { markDoneStage(4); gotoStage(5); };
  }

  /* ----- Stage 5: Mix/Master ----- */
  var MASTER_PRESETS = {
    radio: { name: "📻 Radio", fx: ["glue", "limiter", "normalize", "eqbright"], desc: "Loud, bright, broadcast-ready." },
    club: { name: "🔊 Club", fx: ["glue", "limiter", "normalize", "eqwarm"], desc: "Heavy low end, maximum punch." },
    tape: { name: "📼 Tape", fx: ["tape", "glue", "normalize"], desc: "Warm analog saturation." },
    stream: { name: "🎧 Streaming", fx: ["glue", "normalize"], desc: "Gentle, dynamic, platform-safe." }
  };
  function stage5() {
    var h = "<h3>Stage 5 — Mix / Master blend</h3>" +
      "<p class='seqlab'>Ride the buses, then pick a master. This blend applies to every render from here on.</p>" +
      '<div class="checklist">' + ["drums", "bass", "chords", "lead", "vocal"].map(function (b) {
        return '<div><label>' + b + ' <span data-s5v="' + b + '">' + Math.round(PROJ.mix[b] * 100) + '</span>%</label>' +
          '<input type="range" min="0" max="150" value="' + Math.round(PROJ.mix[b] * 100) + '" data-s5bus="' + b + '" style="width:100%"></div>';
      }).join("") + "</div>" +
      "<h4>Master preset</h4><div class='row'>" + Object.keys(MASTER_PRESETS).map(function (k) {
        return '<div><button class="btn ghost" data-master="' + k + '">' + MASTER_PRESETS[k].name + "</button><br><span class='seqlab'>" + MASTER_PRESETS[k].desc + "</span></div>";
      }).join("") + "</div>" +
      "<p><button class='btn' id='s5hear'>▶ Hear the blend</button> <span class='seqlab' id='s5info'></span></p>" + doneBtn(5);
    stagePane().innerHTML = h;
    Array.prototype.forEach.call(stagePane().querySelectorAll("[data-s5bus]"), function (f) {
      f.addEventListener("input", function () {
        var b = f.getAttribute("data-s5bus"); PROJ.mix[b] = (+f.value) / 100; saveProjSafe();
        var lab = stagePane().querySelector('[data-s5v="' + b + '"]'); if (lab) lab.textContent = f.value;
      });
    });
    Array.prototype.forEach.call(stagePane().querySelectorAll("[data-master]"), function (b) {
      b.onclick = function () {
        var p = MASTER_PRESETS[b.getAttribute("data-master")];
        PROJ.fx = p.fx.map(function (id) { return { id: id }; }); saveProjSafe();
        $("s5info").textContent = "Master: " + p.name + " — " + p.desc;
        window.__palSay("Master set: " + p.name + ".");
      };
    });
    $("s5hear").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var songLike = PROJ.song || { id: "s5:preview", title: "mix preview", genre: PROJ.genre || "hip-hop", tempo: PROJ.bpm };
      $("s5info").textContent = "Rendering blend…";
      S.renderFullSong(songLike, PROJ.mix, PROJ.fx.map(function (f) { return { id: f.id }; })).then(function (buf) {
        S.playBuffer(buf, "s5"); $("s5info").textContent = "That's your blend. Adjust and hear again.";
      });
    };
    stagePane().querySelector("[data-done]").onclick = function () { markDoneStage(5); gotoStage(6); };
  }

  /* ----- Stage 6: Filters ----- */
  function stage6() {
    var h = "<h3>Stage 6 — Filters & effects</h3><p class='seqlab'>Universal, tape, stage — and a whole rack more. Tap to stack.</p>" +
      '<div class="fxgrid">' + S.FX_DEFS.map(function (f) {
        var on = PROJ.fx.some(function (x) { return x.id === f.id; });
        return '<div class="fxcard' + (on ? " on" : "") + '" data-fx="' + f.id + '"><b>' + esc(f.name) + "</b>" + esc(f.desc) + "</div>";
      }).join("") + "</div>" +
      "<p><button class='btn' id='s6hear'>▶ Hear with filters</button> <span class='seqlab' id='s6info'></span></p>" + doneBtn(6);
    stagePane().innerHTML = h;
    Array.prototype.forEach.call(stagePane().querySelectorAll("[data-fx]"), function (el) {
      el.onclick = function () {
        var id = el.getAttribute("data-fx"), ix = -1, i;
        for (i = 0; i < PROJ.fx.length; i++) if (PROJ.fx[i].id === id) ix = i;
        if (ix === -1) PROJ.fx.push({ id: id }); else PROJ.fx.splice(ix, 1);
        el.classList.toggle("on"); saveProjSafe();
      };
    });
    $("s6hear").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var songLike = PROJ.song || { id: "s6:preview", title: "filter preview", genre: PROJ.genre || "hip-hop", tempo: PROJ.bpm };
      $("s6info").textContent = "Rendering with " + PROJ.fx.length + " filters…";
      S.renderFullSong(songLike, PROJ.mix, PROJ.fx.map(function (f) { return { id: f.id }; })).then(function (buf) {
        S.playBuffer(buf, "s6"); $("s6info").textContent = "That's your filter stack.";
      });
    };
    stagePane().querySelector("[data-done]").onclick = function () { markDoneStage(6); gotoStage(7); };
  }

  /* ----- Stage 7: Burn CD ----- */
  function stage7() {
    var h = "<h3>Stage 7 — Burn CD</h3>" +
      "<p class='seqlab'>Order your songs, name the album and artist — the disc gets tagged.</p>" +
      '<div class="row"><div><label>Album name</label><input type="text" id="s7album" value="' + esc(PROJ.cd.album) + '" placeholder="e.g. Midnight Sessions"></div>' +
      '<div><label>Artist name</label><input type="text" id="s7artist" value="' + esc(PROJ.cd.artist) + '" placeholder="e.g. Signature"></div></div>' +
      "<div id='s7tracks'></div>" +
      "<p><button class='btn ghost' id='s7add'>+ Add song by ID</button> <button class='btn ghost' id='s7mine'>+ Add my session song</button></p>" +
      "<p><button class='btn' id='s7burn'>💿 Tag & build my CD</button> <span class='seqlab' id='s7info'></span></p>" +
      "<div id='s7out'></div>";
    stagePane().innerHTML = h;
    function drawTracks() {
      var t = "<ol>";
      PROJ.cd.tracks.forEach(function (id, i) {
        t += "<li><span class='id'>" + esc(id) + "</span> " +
          (i > 0 ? "<button class='btn ghost' data-mv='" + i + ":-1'>↑</button>" : "") +
          (i < PROJ.cd.tracks.length - 1 ? "<button class='btn ghost' data-mv='" + i + ":1'>↓</button>" : "") +
          " <button class='btn ghost' data-rmt='" + i + "'>✕</button></li>";
      });
      $("s7tracks").innerHTML = t + "</ol>" || "<p class='seqlab'>No tracks yet.</p>";
    }
    drawTracks();
    $("s7album").oninput = function () { PROJ.cd.album = this.value; saveProjSafe(); };
    $("s7artist").oninput = function () { PROJ.cd.artist = this.value; saveProjSafe(); };
    $("s7add").onclick = function () {
      window.__openSongSearch(function (id) { PROJ.cd.tracks.push(id); saveProjSafe(); drawTracks(); });
    };
    $("s7mine").onclick = function () {
      if (PROJ.song && PROJ.song.id) { PROJ.cd.tracks.push(PROJ.song.id); saveProjSafe(); drawTracks(); }
      else window.__palSay("Make a song first (stages 2–3), then add it here.");
    };
    $("s7burn").onclick = function () { buildTaggedCD(); };
    if (!stagePane().__s7wired) {
      stagePane().__s7wired = 1;
      stagePane().addEventListener("click", function s7(e) {
        var mv = e.target.closest("[data-mv]"), rm = e.target.closest("[data-rmt]");
        if (mv) {
          var p = mv.getAttribute("data-mv").split(":"), i = +p[0], j = i + (+p[1]);
          var t = PROJ.cd.tracks.splice(i, 1)[0]; PROJ.cd.tracks.splice(j, 0, t); saveProjSafe(); drawTracks();
        }
        if (rm) { PROJ.cd.tracks.splice(+rm.getAttribute("data-rmt"), 1); saveProjSafe(); drawTracks(); }
      });
    }
  }

  function saveProjSafe() { try { localStorage.setItem(PKEY, JSON.stringify(PROJ, function (k, v) { return k === "micBuf" ? null : v; })); } catch (e) {} }

  /* ----- tagged CD build (album/artist/track order in the cue sheet) ----- */
  function buildTaggedCD() {
    var ids = PROJ.cd.tracks.slice();
    if (!ids.length) { $("s7info").textContent = "Add at least one track."; return; }
    try { S.unlockAudio(); } catch (e) {}
    $("s7info").textContent = "Rendering " + ids.length + " tracks…";
    var chain = Promise.resolve(), tracks = [], start = 0;
    ids.forEach(function (id) {
      chain = chain.then(function () {
        return window.__findRecord(id).then(function (rec) {
          var songLike = rec.kind === "song" ? rec : { id: id, title: rec.name || id, genre: "hip-hop", tempo: 92 };
          return S.renderFullSong(songLike, PROJ.mix, PROJ.fx.map(function (f) { return { id: f.id }; })).then(function (buf) {
            tracks.push({ title: songLike.title, buf: buf, start: start });
            start += buf.duration + 2;
          });
        });
      });
    });
    chain.then(function () {
      var rate = 44100, total = Math.ceil(start * rate);
      var ch0 = new Float32Array(total), ch1 = new Float32Array(total);
      tracks.forEach(function (t) {
        var off = Math.floor(t.start * rate), d0 = t.buf.getChannelData(0), d1 = t.buf.numberOfChannels > 1 ? t.buf.getChannelData(1) : d0, i, n = Math.min(d0.length, total - off);
        for (i = 0; i < n; i++) { ch0[off + i] = d0[i]; ch1[off + i] = d1[i]; }
      });
      var fake = { length: total, sampleRate: rate, numberOfChannels: 2, getChannelData: function (ch) { return ch === 0 ? ch0 : ch1; } };
      return S.bufferToWav(fake).arrayBuffer().then(function (ab) { return { ab: ab }; });
    }).then(function (r) {
      var album = PROJ.cd.album || "Signature Sessions", artist = PROJ.cd.artist || "Signature";
      var cue = 'PERFORMER "' + artist.replace(/"/g, "") + '"\nTITLE "' + album.replace(/"/g, "") + '"\nFILE "signature-cd.wav" WAVE\n', i;
      for (i = 0; i < tracks.length; i++) {
        var ms = Math.floor(tracks[i].start * 75);
        var mm = String(Math.floor(ms / 4500)).padStart(2, "0"), ss = String(Math.floor(ms / 75) % 60).padStart(2, "0"), ff = String(ms % 75).padStart(2, "0");
        cue += "  TRACK " + String(i + 1).padStart(2, "0") + " AUDIO\n    TITLE \"" + tracks[i].title.replace(/"/g, "") + "\"\n    PERFORMER \"" + artist.replace(/"/g, "") + "\"\n    INDEX 01 " + mm + ":" + ss + ":" + ff + "\n";
      }
      var guide = "BURNING GUIDE — " + album + " by " + artist + "\n" + "=".repeat(40) + "\n\nYou downloaded signature-cd.zip:\n- signature-cd.wav (all tracks, 44.1 kHz / 16-bit)\n- disc.cue (tagged: album \"" + album + "\", artist \"" + artist + "\")\n\nBurn with your burner software (browsers can't drive a burner directly). ImgBurn: 'Write image file to disc' -> disc.cue. Burn at 8x-16x, finalize the disc.\n";
      function u8(s) { return new TextEncoder().encode(s); }
      var files = [
        { name: "signature-cd.wav", data: new Uint8Array(r.ab) },
        { name: "disc.cue", data: u8(cue) },
        { name: "BURNING-GUIDE.txt", data: u8(guide) }
      ];
      if (window.__buildZip) dl(window.__buildZip(files), "signature-cd.zip");
      else $("s7info").textContent = "Zip builder unavailable — use the main Make-a-CD section below.";
      $("s7info").textContent = "Done — '" + album + "' by " + artist + ", " + tracks.length + " tracks, tagged and zipped.";
      markDoneStage(7);
      window.__palSay("CD done! '" + album + "' by " + artist + " — " + tracks.length + " tracks, tagged. That's a finished record. 🎉");
    }).catch(function (e) { $("s7info").textContent = "Couldn't build: " + e.message; });
  }

  function markDoneStage(n) {
    var b = document.querySelector('#stagebtns [data-stage="' + n + '"]'); if (b) b.classList.add("done");
  }
  window.__markDoneStage = markDoneStage;

  /* ----- wire the session ----- */
  function gotoStage(n) {
    PROJ.stage = n; saveProjSafe();
    Array.prototype.forEach.call(document.querySelectorAll("#stagebtns button"), function (b) {
      b.classList.toggle("on", +b.getAttribute("data-stage") === n);
    });
    var R = { 1: stage1, 2: stage2, 3: stage3, 4: stage4, 5: stage5, 6: stage6, 7: stage7 };
    (R[n] || stage1)();
    if (window.__palSay) window.__palSay(({
      1: "Stage 1 — Sounds: browse the library A–Z, pop any file open, preview it, and save the keepers to My Library.",
      2: "Stage 2 — Beat: make your beat (try an 'Eminem type beat'!) and pick your instruments from the popup.",
      3: "Stage 3 — Lyrics: search the song archive in a popup, or write your own — the AI can draft too.",
      4: "Stage 4 — Singing: lead vocal, backup singers, and vocal edits. Your voice or a created voice.",
      5: "Stage 5 — Mix/Master: blend the buses, then pick a master — radio, club, tape, streaming.",
      6: "Stage 6 — Filters: universal, tape, stage, and a whole rack more. Tap to stack.",
      7: "Stage 7 — Burn CD: order your songs, name the album and artist, tag the disc, burn it."
    })[n] || "");
  }
  window.__gotoStage = gotoStage;
  Array.prototype.forEach.call(document.querySelectorAll("#stagebtns button"), function (b) {
    b.onclick = function () { gotoStage(+b.getAttribute("data-stage")); };
  });
  $("palgo").onclick = function () { window.__palSay(palAnswer($("palq").value)); $("palq").value = ""; };
  $("palq").addEventListener("keydown", function (e) { if (e.key === "Enter") { window.__palSay(palAnswer($("palq").value)); $("palq").value = ""; } });
  $("palauto").onclick = function () { window.__autoProject($("palq").value || "a great song"); };
  $("paldaw").onclick = function () { openDAW(); };

  /* ----- My Library shelf ----- */
  window.__renderMyLib = function () {
    var l = window.__myLib(), h = "";
    if (!l.length) h = '<div class="card">Your shelf is empty — save sounds from any pop-open card and they\'ll live here.</div>';
    l.forEach(function (x) {
      h += '<div class="card"><h4>' + esc(x.name) + '</h4><div class="id">' + esc(x.id) + " · " + esc(x.kind) + '</div>' +
        '<p><button class="btn ghost" data-myopen="' + esc(x.kind) + "|" + esc(x.id) + '">👁 Open</button> ' +
        '<button class="btn ghost" data-myrm="' + esc(x.id) + '">✕</button></p></div>';
    });
    var g = $("mylibgrid"); if (!g) return; g.innerHTML = h;
  };
  $("mylibgrid").addEventListener("click", function (e) {
    var o = e.target.closest("[data-myopen]"), r = e.target.closest("[data-myrm]");
    if (o) {
      var p = o.getAttribute("data-myopen").split("|");
      if (p[0] === "sound" && window.__openSoundModal) window.__openSoundModal(p[1]);
      else if (p[0] === "gear" && window.__openGearModal) window.__openGearModal(p[1]);
      else location.search = "?" + p[0] + "=" + p[1];
    }
    if (r) { window.__myLibRemove(r.getAttribute("data-myrm")); window.__renderMyLib(); }
  });

  /* ================= DAW POPUP (Cakewalk-type) ================= */
  var dawMicBuf = null, dawRec = null, dawStream = null;
  function openDAW() {
    try { S.unlockAudio(); } catch (e) {}
    var lanes = [
      { id: "drums", name: "🥁 Drums", color: "#f5c542" },
      { id: "bass", name: "🎸 Bass", color: "#4fe3c1" },
      { id: "chords", name: "🎹 Chords", color: "#9b7bff" },
      { id: "lead", name: "🎺 Melody", color: "#ff9d5a" },
      { id: "vocal", name: "🎤 Vocal", color: "#ff5a8a" },
      { id: "mic", name: "🎙️ Mic", color: "#5ad1ff" }
    ];
    var daw = { muted: {}, solo: {}, vol: { drums: 1, bass: 1, chords: 1, lead: 1, vocal: 1, mic: 1 }, bpm: PROJ.bpm || 92 };
    var h = '<div class="daw-transport">' +
      '<button data-t="play" title="Play">▶</button><button data-t="stop" title="Stop">⏹</button>' +
      '<button data-t="rec" class="rec" title="Record mic to the Mic lane">⏺ REC</button>' +
      '<label style="font-size:13px">BPM <input type="number" id="dawbpm" value="' + daw.bpm + '" min="60" max="180" style="width:64px"></label>' +
      '<span class="seqlab" id="dawinfo">Multitrack studio — arm REC, sing into your mic, then play the mix.</span></div>' +
      '<div id="dawlanes">' + lanes.map(function (L) {
        return '<div class="daw-lane"><div class="lname">' + L.name + '</div>' +
          '<div class="daw-region" data-lane="' + L.id + '"><div class="blk" data-blk="' + L.id + '" style="left:4%;width:88%;background:' + L.color + '"></div></div>' +
          '<button data-m="' + L.id + '" title="Mute">M</button><button data-s="' + L.id + '" title="Solo">S</button>' +
          '<input type="range" min="0" max="150" value="100" data-v="' + L.id + '"></div>';
      }).join("") + "</div>" +
      "<p><button class='btn teal' data-t='export'>⬇ Export mix .wav</button> <span class='seqlab'>Mic allowance: the browser will ask for microphone permission when you arm REC.</span></p>";
    var body = openModal("🎛️ Studio DAW — multitrack", h, true);
    function info(t) { var el = body.querySelector("#dawinfo"); if (el) el.textContent = t; }
    body.addEventListener("click", function (e) {
      var t = e.target.closest("[data-t]"), m = e.target.closest("[data-m]"), s = e.target.closest("[data-s]");
      if (m) { var id = m.getAttribute("data-m"); daw.muted[id] = !daw.muted[id]; m.classList.toggle("on", daw.muted[id]); return; }
      if (s) { var id2 = s.getAttribute("data-s"); daw.solo[id2] = !daw.solo[id2]; s.classList.toggle("on", daw.solo[id2]); return; }
      if (!t) return;
      var act = t.getAttribute("data-t");
      try { S.unlockAudio(); } catch (e2) {}
      if (act === "stop") { S.stopLive("daw"); info("Stopped."); }
      if (act === "play") { info("Rendering session…"); renderDAW(daw).then(function (buf) { S.playBuffer(buf, "daw"); info("Playing the mix — mute/solo/volume shape it live on re-render."); }); }
      if (act === "export") { info("Rendering…"); renderDAW(daw).then(function (buf) { dl(S.bufferToWav(buf), "signature-session.wav"); info("Exported signature-session.wav."); }); }
      if (act === "rec") { toggleMicRec(t, daw, info, body); }
    });
    body.addEventListener("input", function (e) {
      var v = e.target.closest("[data-v]"); if (v) daw.vol[v.getAttribute("data-v")] = (+v.value) / 100;
      if (e.target.id === "dawbpm") daw.bpm = Math.max(60, Math.min(180, +e.target.value || 92));
    });
  }
  window.__openDAW = openDAW;

  function toggleMicRec(btn, daw, info, body) {
    if (dawRec) {
      try { dawRec.stop(); } catch (e) {}
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { info("Microphone not available in this browser."); return; }
    info("Requesting microphone…");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      dawStream = stream;
      var rec = new MediaRecorder(stream), chunks = [];
      dawRec = rec;
      btn.classList.add("armed"); btn.textContent = "⏹ STOP"; info("Recording to the Mic lane — sing or play, then stop.");
      rec.ondataavailable = function (e) { chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        dawRec = null; btn.classList.remove("armed"); btn.textContent = "⏺ REC";
        new Blob(chunks, { type: rec.mimeType || "audio/webm" }).arrayBuffer().then(function (ab) {
          S.ensureCtx().decodeAudioData(ab).then(function (buf) {
            dawMicBuf = buf; info("Mic take recorded (" + buf.duration.toFixed(1) + "s) — press play to hear it in the mix.");
            var blk = body.querySelector('[data-blk="mic"]'); if (blk) blk.style.width = "92%";
          }, function () { info("Couldn't decode the mic take."); });
        });
      };
      rec.start();
    }).catch(function () { info("Microphone permission denied — the Mic lane stays empty."); });
  }

  function renderDAW(daw) {
    var genre = PROJ.genre || "hip-hop", bpm = daw.bpm, bars = 8;
    var songLike = PROJ.song || { id: "daw:" + genre, title: "daw session", genre: genre, tempo: bpm };
    var anySolo = ["drums", "bass", "chords", "lead", "vocal", "mic"].some(function (k) { return daw.solo[k]; });
    function audible(k) { if (daw.muted[k]) return false; if (anySolo) return !!daw.solo[k]; return true; }
    var mix = {
      drums: audible("drums") ? daw.vol.drums * PROJ.mix.drums : 0,
      bass: audible("bass") ? daw.vol.bass * PROJ.mix.bass : 0,
      chords: audible("chords") ? daw.vol.chords * PROJ.mix.chords : 0,
      lead: audible("lead") ? daw.vol.lead * PROJ.mix.lead : 0,
      vocal: audible("vocal") ? daw.vol.vocal * PROJ.mix.vocal : 0
    };
    var fx = (PROJ.fx || []).map(function (f) { return { id: f.id }; });
    return S.renderFullSong(songLike, mix, fx).then(function (buf) {
      if (dawMicBuf && audible("mic")) {
        // lay the mic take over the mix at 4s in
        var rate = 44100, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        var c = new OC(2, buf.length, rate), src = c.createBufferSource(); src.buffer = buf;
        var mic = c.createBufferSource(); mic.buffer = dawMicBuf;
        var mg = c.createGain(); mg.gain.value = daw.vol.mic;
        src.connect(c.destination); mic.connect(mg); mg.connect(c.destination);
        src.start(0); mic.start(4);
        return c.startRendering();
      }
      return buf;
    });
  }

  /* ----- boot the session ----- */
  gotoStage(PROJ.stage || 1);
  if (window.__renderMyLib) window.__renderMyLib();
})();
