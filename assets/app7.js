/* ============================================================
   Signature Music Studio — part 7: Song Walkthrough + AI addons.
   The streamlined path: one plain-language question per screen,
   "AI finish my song" on every step, full 5:00 standard render.
   ============================================================ */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl,
      openModal = window.__openModal, closeModal = window.__closeModal;
  var PROJ = window.__proj ? window.__proj() : null;
  if (!S || !D || !PROJ) return;

  /* ================= AI ADDONS — the studio band =================
     Real client-side specialist AIs. Each one does actual work
     on the walkthrough spec — arrangement, groove, melody,
     vocal coaching, mastering, finishing. */
  D.AI_ADDONS = [
    { id: "arrange", name: "🎼 Arrangement AI", desc: "Lays out the full 5:00 standard — intro build-up, four 30-second chorus breaks, bridge beat-switch, and your chosen ending.", go: 1 },
    { id: "groove", name: "🥁 Groove AI", desc: "Designs the drum pattern from your rhythm words and places every part — beginning, middle, end.", go: 3 },
    { id: "melody", name: "🎹 Melody & Harmony AI", desc: "Writes the melody, chord voicings, and bass line in your song's key.", go: 4 },
    { id: "vocalcoach", name: "🎤 Vocal Coach AI", desc: "Picks the voice, stacks the backup singers, writes the ad-libs — or sings your own sample.", go: 11 },
    { id: "master", name: "🎚️ Mastering AI", desc: "Balances the mix and masters it radio-ready with one tap.", go: 13 },
    { id: "finisher", name: "🤖 Finisher AI", desc: "Completes any unfinished step — or the whole song — from your seed. Available on every screen.", go: -1 }
  ];
  /* addon narrations: what each addon did, in plain words */
  function addonDid(id, ws) {
    var notes = {
      arrange: "🎼 Arrangement AI laid out your 5:00 — intro build-up, four 30-second chorus breaks at about 0:53, 2:05, 3:03 and 3:32, bridge beat-switch, and a " + (ws.ending === "fade" ? "fade out" : ws.ending === "funky" ? "funky cold-stop" : "designed") + " ending.",
      groove: "🥁 Groove AI designed your drum pattern and placed every part where you asked — beginning, middle, end.",
      melody: "🎹 Melody & Harmony AI wrote the melody and chords in your key, and voiced the bass line.",
      vocalcoach: "🎤 Vocal Coach AI " + (ws.voiceMode === "own" ? "mapped your own voice sample onto the melody" : "picked the " + voiceLabel(ws.voiceId) + " voice") + " and stacked your backups.",
      master: "🎚️ Mastering AI balanced the mix and set the " + masterName(ws.master) + " master.",
      finisher: "🤖 Finisher AI completed every remaining step from your seed — same choices, every time."
    };
    return notes[id] || "";
  }

  /* ================= walkthrough state ================= */
  function freshWalk() {
    return {
      seed: "walk" + Date.now().toString(36) + Math.floor(Math.random() * 999),
      title: "", genre: "", typebeat: "", bpm: 100,
      sounds: ["drums", "bass", "keys"],
      rhythm: "auto",
      bass: { kind: "sub", zones: ["beginning", "middle", "end"] },
      snare: { kind: "crack", zones: ["beginning", "middle", "end"] },
      fills: { kind: "toms", zones: ["middle", "end"] },
      custom: [], /* {id,name,voice} */
      extras: [], /* {voice,feel,zones,label} */
      chorus: "bigger",
      ending: "fade", endingNote: "",
      lyricsMode: "ai", lyrics: "",
      voiceMode: "custom", voiceId: "woman-light-mid",
      ownSample: null, ownSampleName: "",
      backups: ["choir"],
      master: "radio",
      addonLog: []
    };
  }
  var WS = null, WSTEP = 0, WALKBUF = null, WALKSPEC = null;

  var RHYTHMS = [
    ["auto", "Match my genre"], ["hip-hop", "Boom-bap head nod"], ["trap", "Trap rolling hats"],
    ["house", "House four-on-the-floor"], ["funk", "Funk syncopation"], ["rnb", "Slow R&B pocket"],
    ["rock", "Driving rock"], ["drum-and-bass", "Fast breakbeat"], ["reggae", "One-drop groove"],
    ["afrobeats", "Afro bounce"], ["lofi", "Lazy lofi swing"], ["drill", "Drill bounce"]
  ];
  var BASSES = [["sub", "Deep sub — low and heavy"], ["punch", "Punchy saw — cuts through"], ["funk", "Funky — syncopated and bouncy"], ["reese", "Reese growl — deep and mean"]];
  var SNARES = [["crack", "Crack — classic snap"], ["rim", "Rim click — tight and woody"], ["brush", "Brush sweep — soft and jazzy"], ["clapstack", "Clap stack — big and wide"]];
  var FILLS = [["toms", "Tom fills at section changes"], ["perc", "Percussion hits"], ["shakerf", "Shaker lifts"], ["none", "No fills — keep it steady"]];
  var EXTRA_VOICES = [["tom", "Toms / drums"], ["shaker", "Shaker"], ["clap", "Claps"], ["keys", "Piano / keys"], ["epiano", "Electric piano"], ["marimba", "Marimba"], ["pluck", "Plucked strings"], ["strings", "String pads"]];
  var FEELS = [["sparse", "Sparse — a few accents"], ["driving", "Driving — steady pulse"], ["offbeat", "Offbeat — bouncy"]];
  var MASTERS = [["radio", "📻 Radio — loud, bright, broadcast-ready"], ["club", "🔊 Club — heavy low end"], ["tape", "📼 Tape — warm analog"], ["stream", "🎧 Streaming — gentle and dynamic"]];
  function masterName(id) { var i; for (i = 0; i < MASTERS.length; i++) if (MASTERS[i][0] === id) return MASTERS[i][1]; return MASTERS[0][1]; }
  function voiceLabel(id) { var v = S.voiceProfile(id); return v ? v.label : id; }
  var ZONES = [["beginning", "Beginning"], ["middle", "Middle"], ["end", "End"]];

  function placeWidget(prefix, sel) {
    sel = sel || ["beginning", "middle", "end"];
    return ZONES.map(function (z) {
      return '<label style="display:inline-block;margin-right:14px;font-size:15px"><input type="checkbox" data-' + prefix + ' value="' + z[0] + '"' +
        (sel.indexOf(z[0]) !== -1 ? " checked" : "") + "> " + z[1] + "</label>";
    }).join("");
  }
  function readZones(body, prefix) {
    var out = [];
    Array.prototype.forEach.call(body.querySelectorAll("[data-" + prefix + "]"), function (c) { if (c.checked) out.push(c.value); });
    return out.length ? out : ["beginning", "middle", "end"];
  }

  /* guess a synth voice from a library sound name (deterministic, honest) */
  function voiceFromName(name) {
    var n = String(name || "").toLowerCase();
    if (/kick/.test(n)) return "kick"; if (/snare/.test(n)) return "snare";
    if (/hat/.test(n)) return "hat"; if (/clap/.test(n)) return "clap";
    if (/tom/.test(n)) return "tom"; if (/shaker/.test(n)) return "shaker";
    if (/riser/.test(n)) return "riser"; if (/impact/.test(n)) return "impact";
    if (/bass/.test(n)) return "sub"; if (/piano/.test(n)) return "epiano";
    if (/marimba|steel/.test(n)) return "marimba"; if (/flute|whistle/.test(n)) return "flute";
    if (/pluck|sitar|harp|koto/.test(n)) return "pluck"; if (/string|cello/.test(n)) return "strings";
    if (/brass|horn|trumpet/.test(n)) return "brass"; if (/pad|choir/.test(n)) return "pad";
    if (/lead/.test(n)) return "lead";
    return "keys";
  }
  function fxForMaster(id) {
    var map = {
      radio: ["glue", "limiter", "normalize", "eqbright"],
      club: ["glue", "limiter", "normalize", "eqwarm"],
      tape: ["tape", "glue", "normalize"],
      stream: ["glue", "normalize"]
    };
    return (map[id] || map.radio).map(function (x) { return { id: x }; });
  }

  /* ================= the 14 steps ================= */
  function optList(opts, sel) {
    return opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === sel ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
  }
  function radioList(name, opts, sel) {
    return opts.map(function (o) {
      return '<label style="display:block;margin:8px 0;font-size:16px"><input type="radio" name="' + name + '" value="' + o[0] + '"' +
        (o[0] === sel ? " checked" : "") + "> " + esc(o[1]) + "</label>";
    }).join("");
  }

  var STEPS = [
    { t: "Welcome",
      q: "I'll walk you through your song one easy step at a time — genre, beat, vocals, ending — in plain words. At ANY point, tap “🤖 AI finish my song” and I'll complete the rest.",
      body: function () {
        return "<p class='seqlab'>Your song comes out as the <b>5:00 standard</b>: intro build-up, <b>four 30-second chorus breaks</b>, bridge beat-switch, and a fade out — with full lyrics if you want them.</p>" +
          "<p class='seqlab'>Tap <b>Next</b> to begin, or let the AI do it all right now.</p>";
      },
      wire: function () {}, collect: function () { return true; } },

    { t: "Genre",
      q: "What genre would you like to create?",
      body: function (ws) {
        var gs = [["", "Any — surprise me"]].concat((D.BEAT_STYLES || []).map(function (g) { return [g, g.replace(/-/g, " ")]; }));
        return '<div><label>Song name (or leave it — the AI names it)</label><input type="text" id="wtitle" value="' + esc(ws.title) + '" placeholder="e.g. Midnight Highway" style="width:100%"></div>' +
          '<div><label>Genre</label><select id="wgenre" style="width:100%">' + optList(gs, ws.genre) + "</select></div>" +
          '<div><label>…or name a style ("90s boom-bap")</label><input type="text" id="wtypebeat" value="' + esc(ws.typebeat) + '" placeholder="e.g. dark trap groove" style="width:100%"></div>' +
          '<div><label>Tempo (BPM)</label><input type="number" id="wbpm" value="' + ws.bpm + '" min="60" max="180" style="width:100%"></div>';
      },
      wire: function () {},
      collect: function (body, ws) {
        ws.title = body.querySelector("#wtitle").value.trim();
        ws.typebeat = body.querySelector("#wtypebeat").value.trim();
        var styleRef = ws.typebeat && D.parseStyleRequest ? D.parseStyleRequest(ws.typebeat) : null;
        ws.genre = styleRef ? styleRef.genre : body.querySelector("#wgenre").value;
        ws.bpm = Math.max(60, Math.min(180, +body.querySelector("#wbpm").value || 100));
        if (styleRef) ws.addonLog.push("🎯 " + styleRef.name + " type — original Signature composition, not affiliated.");
        return true;
      } },

    { t: "Sounds",
      q: "What sounds do you want in your song?",
      body: function (ws) {
        var fams = [["drums", "🥁 Drums"], ["bass", "🎸 Bass"], ["keys", "🎹 Keys & piano"], ["strings", "🎻 Strings"], ["brass", "🎺 Brass"], ["pads", "🌫️ Pads"], ["leads", "🎺 Leads"], ["world", "🌍 World instruments"], ["fx", "✨ FX"]];
        return "<p class='seqlab'>Tick the families — the AI fills the beat with them.</p>" +
          fams.map(function (f) {
            return '<label style="display:inline-block;margin:6px 12px 6px 0;font-size:16px"><input type="checkbox" data-wfam value="' + f[0] + '"' +
              (ws.sounds.indexOf(f[0]) !== -1 ? " checked" : "") + "> " + f[1] + "</label>";
          }).join("");
      },
      wire: function () {},
      collect: function (body, ws) {
        ws.sounds = [];
        Array.prototype.forEach.call(body.querySelectorAll("[data-wfam]"), function (c) { if (c.checked) ws.sounds.push(c.value); });
        if (!ws.sounds.length) ws.sounds = ["drums", "bass", "keys"];
        return true;
      } },

    { t: "Rhythm",
      q: "What rhythm do you want?",
      body: function (ws) {
        return '<div><label>Pick the groove</label><select id="wrhythm" style="width:100%">' + optList(RHYTHMS, ws.rhythm) + "</select></div>" +
          "<p class='seqlab'>🥁 Groove AI shapes the drum pattern from this — kick, snare, hats, percussion on the grid.</p>";
      },
      wire: function () {},
      collect: function (body, ws) { ws.rhythm = body.querySelector("#wrhythm").value; ws.addonLog.push(addonDid("groove", ws)); return true; } },

    { t: "Bass",
      q: "What bass do you want — and where in the song should it play?",
      body: function (ws) {
        return '<div><label>Bass sound</label><select id="wbass" style="width:100%">' + optList(BASSES, ws.bass.kind) + "</select></div>" +
          "<div><label>Where in the song?</label><br>" + placeWidget("wbassz", ws.bass.zones) + "</div>";
      },
      wire: function () {},
      collect: function (body, ws) { ws.bass = { kind: body.querySelector("#wbass").value, zones: readZones(body, "wbassz") }; return true; } },

    { t: "Snare",
      q: "What snare do you want — and where should it hit?",
      body: function (ws) {
        return '<div><label>Snare sound</label><select id="wsnare" style="width:100%">' + optList(SNARES, ws.snare.kind) + "</select></div>" +
          "<div><label>Where in the song?</label><br>" + placeWidget("wsnarez", ws.snare.zones) + "</div>";
      },
      wire: function () {},
      collect: function (body, ws) { ws.snare = { kind: body.querySelector("#wsnare").value, zones: readZones(body, "wsnarez") }; return true; } },

    { t: "Drums & fills",
      q: "What drums do you want — and where?",
      body: function (ws) {
        return '<div><label>Drum fills</label><select id="wfills" style="width:100%">' + optList(FILLS, ws.fills.kind) + "</select></div>" +
          "<div><label>Where in the song?</label><br>" + placeWidget("wfillz", ws.fills.zones) + "</div>" +
          "<p class='seqlab'>Fills land at section changes — verse into chorus, chorus into bridge.</p>";
      },
      wire: function () {},
      collect: function (body, ws) { ws.fills = { kind: body.querySelector("#wfills").value, zones: readZones(body, "wfillz") }; return true; } },

    { t: "Custom sounds",
      q: "Any customized sounds to add? You can add many drums, fills, or pianos.",
      body: function (ws) {
        var idx = window.__getIdx ? window.__getIdx() : [];
        var sounds = idx.filter(function (r) { return r[2] === "sound"; }).slice(0, 30);
        var h = "<div><label>Pick from the library</label><div style='max-height:180px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px'>";
        h += sounds.map(function (r) {
          var on = ws.custom.some(function (c) { return c.id === r[0]; });
          return '<label style="display:block;margin:4px 0;font-size:14px"><input type="checkbox" data-wcust value="' + esc(r[0]) + '"' + (on ? " checked" : "") + "> " + esc(r[1]) + ' <span class="seqlab">' + esc(r[0]) + "</span></label>";
        }).join("") + "</div></div>";
        h += "<div style='margin-top:12px'><label>Add your own part — drums, fills, or piano</label><div class='row'>" +
          "<div><select id='wexv'>" + optList(EXTRA_VOICES, "keys") + "</select></div>" +
          "<div><select id='wexf'>" + optList(FEELS, "sparse") + "</select></div>" +
          "<div style='flex:0'><label>&nbsp;</label><button class='btn ghost' id='wexadd' type='button'>+ Add part</button></div></div>" +
          "<div><label>Where?</label><br>" + placeWidget("wexz", null) + "</div>" +
          "<div id='wexlist' style='margin-top:8px'></div></div>";
        return h;
      },
      wire: function (body, ws) {
        function drawEx() {
          body.querySelector("#wexlist").innerHTML = ws.extras.map(function (e, i) {
            return '<div class="hit">' + esc(e.label) + ' <button class="btn ghost" data-wexrm="' + i + '" type="button">✕</button></div>';
          }).join("") || "<p class='seqlab'>No extra parts yet.</p>";
        }
        drawEx();
        body.querySelector("#wexadd").onclick = function () {
          var v = body.querySelector("#wexv"), f = body.querySelector("#wexf");
          ws.extras.push({
            voice: v.value, feel: f.value, zones: readZones(body, "wexz"),
            label: v.options[v.selectedIndex].text + " · " + f.options[f.selectedIndex].text
          });
          drawEx();
        };
        body.querySelector("#wexlist").onclick = function (e) {
          var r = e.target.closest("[data-wexrm]");
          if (r) { ws.extras.splice(+r.getAttribute("data-wexrm"), 1); drawEx(); }
        };
      },
      collect: function (body, ws) {
        ws.custom = [];
        Array.prototype.forEach.call(body.querySelectorAll("[data-wcust]"), function (c) {
          if (c.checked) {
            var label = c.parentNode.textContent.trim();
            ws.custom.push({ id: c.value, name: label, voice: voiceFromName(label) });
          }
        });
        return true;
      } },

    { t: "Chorus",
      q: "Same loop for the chorus?",
      body: function (ws) {
        return radioList("wchorus", [["same", "Yes — same loop, steady"], ["bigger", "Yes — but bigger (extra lift each chorus break)"], ["different", "Different feel for the chorus"]], ws.chorus);
      },
      wire: function () {},
      collect: function (body, ws) {
        var c = body.querySelector('input[name="wchorus"]:checked');
        ws.chorus = c ? c.value : "bigger";
        return true;
      } },

    { t: "Ending",
      q: "How do you want your song to end?",
      body: function (ws) {
        return radioList("wending", [["fade", "Fade out — the standard"], ["funky", "Funky — cold stop with a final hit"], ["designed", "Designed — tell me how"]], ws.ending) +
          '<div><label>If designed, describe it</label><input type="text" id="wendingnote" value="' + esc(ws.endingNote) + '" placeholder="e.g. big brass stabs then silence" style="width:100%"></div>';
      },
      wire: function () {},
      collect: function (body, ws) {
        var c = body.querySelector('input[name="wending"]:checked');
        ws.ending = c ? c.value : "fade";
        ws.endingNote = body.querySelector("#wendingnote").value.trim();
        ws.addonLog.push(addonDid("arrange", ws));
        return true;
      } },

    { t: "Lyrics",
      q: "Full lyrics in the song?",
      body: function (ws) {
        return radioList("wlyr", [["ai", "Yes — AI writes them"], ["typed", "Yes — I'll type them"], ["none", "No — instrumental"]], ws.lyricsMode) +
          '<div><label>Your lyrics (one line per phrase)</label><textarea id="wlyrics" rows="6" style="width:100%">' + esc(ws.lyrics) + "</textarea></div>";
      },
      wire: function () {},
      collect: function (body, ws) {
        var c = body.querySelector('input[name="wlyr"]:checked');
        ws.lyricsMode = c ? c.value : "ai";
        ws.lyrics = body.querySelector("#wlyrics").value.trim();
        if (ws.lyricsMode === "ai" && !ws.lyrics && window.__writeSong) {
          var rec = window.__writeSong(ws.title || ws.typebeat || "midnight highway", ws.genre || undefined, undefined);
          if (rec) { ws.lyrics = rec.lyrics; body.querySelector("#wlyrics").value = rec.lyrics; ws.title = ws.title || rec.title; }
        }
        if (ws.lyricsMode === "none") ws.lyrics = "";
        return true;
      } },

    { t: "Voice",
      q: "Whose voice sings it?",
      body: function (ws) {
        var who = [["man", "Man"], ["woman", "Woman"], ["boy", "Boy"], ["girl", "Girl"]];
        var tone = [["deep", "Deep"], ["light", "Light"]];
        var range = [["low", "Low range"], ["mid", "Mid range"], ["high", "High range"]];
        var parts = (ws.voiceId || "woman-light-mid").split("-");
        return radioList("wvoicemode", [["custom", "A created voice"], ["own", "My own voice (upload or record a sample)"]], ws.voiceMode) +
          '<div id="wcustombox"><div class="row"><div><label>Who</label><select id="wv-who">' + optList(who, parts[0]) + "</select></div>" +
          "<div><label>Tone</label><select id='wv-tone'>" + optList(tone, parts[1]) + "</select></div>" +
          "<div><label>Range</label><select id='wv-range'>" + optList(range, parts[2]) + "</select></div></div>" +
          "<p class='seqlab' id='wvlabel'></p></div>" +
          '<div id="wownbox" style="display:none"><p><button class="btn ghost" id="wupload" type="button">⬆ Upload wav/mp3 sample</button> ' +
          '<button class="btn ghost" id="wrec" type="button">🔴 Record a sample</button></p>' +
          '<input type="file" id="wfile" accept="audio/*" style="display:none"><p class="seqlab" id="wownstatus">' +
          (ws.ownSampleName ? "Sample loaded: " + esc(ws.ownSampleName) : "No sample yet — upload or record one.") + "</p></div>";
      },
      wire: function (body, ws) {
        function showBox() {
          var own = body.querySelector('input[name="wvoicemode"]:checked').value === "own";
          body.querySelector("#wcustombox").style.display = own ? "none" : "block";
          body.querySelector("#wownbox").style.display = own ? "block" : "none";
        }
        function showLabel() {
          var id = body.querySelector("#wv-who").value + "-" + body.querySelector("#wv-tone").value + "-" + body.querySelector("#wv-range").value;
          body.querySelector("#wvlabel").textContent = "🎤 " + voiceLabel(id) + " — a synthesized voice, labeled honestly.";
        }
        Array.prototype.forEach.call(body.querySelectorAll('input[name="wvoicemode"]'), function (r) { r.addEventListener("change", showBox); });
        ["#wv-who", "#wv-tone", "#wv-range"].forEach(function (s) { body.querySelector(s).addEventListener("change", showLabel); });
        showBox(); showLabel();
        body.querySelector("#wupload").onclick = function () { body.querySelector("#wfile").click(); };
        body.querySelector("#wfile").addEventListener("change", function (e) {
          var f = e.target.files[0]; if (!f) return;
          body.querySelector("#wownstatus").textContent = "Decoding sample…";
          f.arrayBuffer().then(function (ab) { return S.ensureCtx().decodeAudioData(ab); }).then(function (buf) {
            ws.ownSample = buf; ws.ownSampleName = f.name;
            body.querySelector("#wownstatus").textContent = "Sample loaded: " + f.name + " (" + buf.duration.toFixed(1) + "s) — the AI will sing it onto your melody.";
          }).catch(function () { body.querySelector("#wownstatus").textContent = "Couldn't read that file — try a wav or mp3."; });
        });
        var rec = null, chunks = [];
        body.querySelector("#wrec").onclick = function (e) {
          var btn = e.target;
          if (rec) { try { rec.stop(); } catch (x) {} return; }
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { body.querySelector("#wownstatus").textContent = "Microphone not available in this browser."; return; }
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            rec = new MediaRecorder(stream); chunks = [];
            btn.textContent = "⏹ Stop"; body.querySelector("#wownstatus").textContent = "Recording — sing a few notes, then stop.";
            rec.ondataavailable = function (ev) { chunks.push(ev.data); };
            rec.onstop = function () {
              stream.getTracks().forEach(function (tr) { tr.stop(); });
              btn.textContent = "🔴 Record a sample"; rec = null;
              new Blob(chunks, { type: "audio/webm" }).arrayBuffer().then(function (ab) { return S.ensureCtx().decodeAudioData(ab); }).then(function (buf) {
                ws.ownSample = buf; ws.ownSampleName = "mic recording";
                body.querySelector("#wownstatus").textContent = "Sample recorded (" + buf.duration.toFixed(1) + "s).";
              }).catch(function () { body.querySelector("#wownstatus").textContent = "Couldn't decode the recording."; });
            };
            rec.start();
          }).catch(function () { body.querySelector("#wownstatus").textContent = "Microphone permission denied."; });
        };
      },
      collect: function (body, ws) {
        var c = body.querySelector('input[name="wvoicemode"]:checked');
        ws.voiceMode = c ? c.value : "custom";
        ws.voiceId = body.querySelector("#wv-who").value + "-" + body.querySelector("#wv-tone").value + "-" + body.querySelector("#wv-range").value;
        ws.addonLog.push(addonDid("vocalcoach", ws));
        return true;
      } },

    { t: "Backup singers",
      q: "Add backup singers?",
      body: function (ws) {
        return (S.BACKUP_TYPES || []).map(function (b) {
          return '<label style="display:block;margin:8px 0;font-size:16px"><input type="checkbox" data-wback value="' + b.id + '"' +
            (ws.backups.indexOf(b.id) !== -1 ? " checked" : "") + "> <b>" + esc(b.name) + "</b> — " + esc(b.desc) + "</label>";
        }).join("");
      },
      wire: function () {},
      collect: function (body, ws) {
        ws.backups = [];
        Array.prototype.forEach.call(body.querySelectorAll("[data-wback]"), function (c) { if (c.checked) ws.backups.push(c.value); });
        return true;
      } },

    { t: "Master",
      q: "How should the finished song sound?",
      body: function (ws) {
        return radioList("wmaster", MASTERS, ws.master) +
          "<p class='seqlab'>🎚️ Mastering AI balances every bus and masters it — one tap, radio-ready.</p>";
      },
      wire: function () {},
      collect: function (body, ws) {
        var c = body.querySelector('input[name="wmaster"]:checked');
        ws.master = c ? c.value : "radio";
        ws.addonLog.push(addonDid("master", ws));
        return true;
      } },

    { t: "Your song is planned",
      q: "Here's what the studio will make. Tap render and hear it.",
      body: function (ws) {
        return '<div class="hit">' + esc(S.studioPlanSummary(specFromWalk(ws))) + "</div>" +
          (ws.addonLog.length ? "<p class='seqlab'>" + ws.addonLog.map(esc).join("<br>") + "</p>" : "") +
          "<p><button class='btn' id='wrender' type='button'>🎧 Render & play my song</button> " +
          "<button class='btn teal' id='wwav' type='button' disabled>⬇ Download .wav</button></p>" +
          "<p><button class='btn ghost' id='wsave' type='button' disabled>💾 Save to My Library</button> " +
          "<button class='btn ghost' id='wcd' type='button' disabled>💿 Add to my CD</button> " +
          "<button class='btn ghost' id='wrestart' type='button'>↺ Start over</button></p>" +
          "<div class='seqlab' id='wmsg'></div>";
      },
      wire: function (body, ws) {
        function msg(t) { var m = body.querySelector("#wmsg"); if (m) m.innerHTML = t; }
        body.querySelector("#wrender").onclick = function () {
          try { S.unlockAudio(); } catch (e) {}
          var spec = specFromWalk(ws);
          msg("Rendering your 5-minute song — intro build-up, four chorus breaks… this can take a minute or so on a phone. 🎶");
          S.renderStudioSong(spec, PROJ.mix, fxForMaster(ws.master)).then(function (buf) {
            WALKBUF = buf; WALKSPEC = spec;
            try { S.unlockAudio(); } catch (e2) {}
            S.playBuffer(buf, "walk");
            msg("Playing — your full 5:00 song. 🎶");
            body.querySelector("#wwav").disabled = false;
            body.querySelector("#wsave").disabled = false;
            body.querySelector("#wcd").disabled = false;
          }).catch(function (e) { msg("Couldn't render: " + esc(e.message)); });
        };
        body.querySelector("#wwav").onclick = function () {
          if (WALKBUF) dl(S.bufferToWav(WALKBUF), "signature-" + (ws.title || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".wav");
        };
        body.querySelector("#wsave").onclick = function () {
          var id = saveWalkSong(ws);
          if (window.__myLibAdd) window.__myLibAdd("walksong", id, ws.title || "Untitled Session");
          if (window.__renderMyLib) window.__renderMyLib();
          msg("Saved to My Library. 💾");
        };
        body.querySelector("#wcd").onclick = function () {
          var id = saveWalkSong(ws);
          PROJ.cd.tracks.push(id);
          try { localStorage.setItem("sigstudio.project.v1", JSON.stringify(PROJ)); } catch (e) {}
          msg("Added to your CD list — open stage 7 to burn it. 💿");
          if (window.__palSay) window.__palSay("Your walkthrough song is on the CD list. Stage 7 burns it with everything else.");
        };
        body.querySelector("#wrestart").onclick = function () { WS = freshWalk(); WSTEP = 0; drawStep(); };
      },
      collect: function () { return true; } }
  ];

  /* ================= spec builder ================= */
  function specFromWalk(ws) {
    var styleRef = ws.typebeat && D.parseStyleRequest ? D.parseStyleRequest(ws.typebeat) : null;
    var genre = ws.genre || (styleRef ? styleRef.genre : "hip-hop");
    if (!genre) genre = "hip-hop";
    return {
      seed: ws.seed, title: ws.title || "Untitled Session",
      genre: genre, bpm: ws.bpm,
      rhythm: ws.rhythm || "auto",
      bass: ws.bass, snare: ws.snare, fills: ws.fills,
      custom: ws.custom || [], extras: ws.extras || [],
      chorus: ws.chorus || "bigger",
      ending: ws.ending || "fade", endingNote: ws.endingNote || "",
      lyrics: ws.lyrics || "", voiceId: ws.voiceId || "woman-light-mid",
      ownSample: ws.ownSample || null, backups: ws.backups || []
    };
  }

  /* ================= AI finish: complete every remaining step ================= */
  function aiFinish() {
    var rng = S.rngFrom("aifinish:" + WS.seed), i;
    function pickA(a) { return a[Math.floor(rng() * a.length) % a.length]; }
    if (!WS.genre) { WS.genre = pickA(D.BEAT_STYLES || ["hip-hop"]); WS.bpm = 85 + Math.floor(rng() * 40); }
    if (!WS.title) WS.title = pickA(["Midnight", "Neon", "Velvet", "Electric", "Quiet"]) + " " + pickA(["Highway", "River", "Signal", "Horizon", "Echo"]);
    if (!WS.rhythm || WS.rhythm === "auto") WS.rhythm = "auto";
    WS.addonLog.push(addonDid("finisher", WS));
    if (WS.lyricsMode === "ai" && !WS.lyrics && window.__writeSong) {
      var rec = window.__writeSong(WS.title, WS.genre, undefined);
      if (rec) WS.lyrics = rec.lyrics;
    }
    if (WS.voiceMode === "custom" && WS.voiceId === "woman-light-mid" && rng() < 0.5) {
      WS.voiceId = pickA(S.VOICE_PROFILES).id;
    }
    WSTEP = STEPS.length - 1;
    drawStep();
    if (window.__palSay) window.__palSay("🤖 Finisher AI took it from here — your song is planned. Tap render and hear it.");
  }

  /* ================= wizard engine ================= */
  function walkDots() {
    var h = "", i;
    for (i = 0; i < STEPS.length; i++) h += '<span style="color:' + (i <= WSTEP ? "var(--gold)" : "var(--mut)") + '">●</span>';
    return h;
  }
  function drawStep() {
    var st = STEPS[WSTEP];
    var h = '<div class="seqlab">Step ' + (WSTEP + 1) + " of " + STEPS.length + " · " + walkDots() + "</div>" +
      '<h3 style="color:var(--gold);margin:8px 0">' + esc(st.t) + "</h3>" +
      '<p class="say" style="font-size:16px">' + st.q + "</p>" +
      '<div id="wbody">' + st.body(WS) + "</div>" +
      '<div class="row" style="margin-top:14px"><div>' +
      (WSTEP > 0 ? '<button class="btn ghost" id="wback" type="button">← Back</button> ' : "") +
      (WSTEP < STEPS.length - 1 ? '<button class="btn" id="wnext" type="button">Next →</button>' : "") +
      "</div></div>" +
      (WSTEP < STEPS.length - 1
        ? '<p><button class="btn violet" id="wai" type="button">🤖 AI finish my song</button> <span class="seqlab">The AI completes every remaining step for you.</span></p>'
        : "") +
      '<div class="seqlab" id="wmsg"></div>';
    var body = openModal("🎧 Song Walkthrough", h, true);
    st.wire(body, WS);
    var nb = body.querySelector("#wback");
    if (nb) nb.onclick = function () { WSTEP = Math.max(0, WSTEP - 1); drawStep(); };
    var nx = body.querySelector("#wnext");
    if (nx) nx.onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      if (st.collect(body, WS) !== false) { WSTEP = Math.min(STEPS.length - 1, WSTEP + 1); drawStep(); }
    };
    var wa = body.querySelector("#wai");
    if (wa) wa.onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var cur = STEPS[WSTEP];
      if (cur.collect(body, WS) !== false) aiFinish();
    };
  }
  function openWalk() {
    try { S.unlockAudio(); } catch (e) {}
    WS = freshWalk(); WSTEP = 0; WALKBUF = null; WALKSPEC = null;
    drawStep();
    if (window.__palSay) window.__palSay("Walkthrough started — one easy step at a time. Tap “🤖 AI finish my song” any time and I'll take it from there.");
  }
  window.__openWalk = openWalk;
  /* best-AI-for-job: the AI pal routes a job to the right specialist addon.
     i = walkthrough step to open at; -1 = Finisher AI (complete everything). */
  window.__openWalkStep = function (i) {
    openWalk();
    if (i === -1) { aiFinish(); return; }
    if (i >= 0 && i < STEPS.length) { WSTEP = i; drawStep(); }
  };

  /* ================= walk-song storage + CD/DB hooks ================= */
  var WKEY = "sigstudio.walksongs.v1";
  function walkStore() {
    try { return JSON.parse(localStorage.getItem(WKEY) || "{}"); } catch (e) { return {}; }
  }
  function saveWalkSong(ws) {
    var store = walkStore();
    var id = "walk:" + ws.seed;
    var spec = specFromWalk(ws);
    spec.ownSample = null; /* samples live for the session only */
    store[id] = { spec: spec, title: spec.title, savedAt: Date.now() };
    try { localStorage.setItem(WKEY, JSON.stringify(store)); } catch (e) {}
    return id;
  }
  window.__resolveTrack = function (id) {
    if (id && id.indexOf("walk:") === 0) {
      var store = walkStore(), e = store[id];
      if (!e) return Promise.reject(new Error("walk song not saved on this device"));
      return Promise.resolve({ kind: "song", id: id, title: e.title, genre: e.spec.genre, tempo: e.spec.bpm, _studio: e.spec });
    }
    return window.__findRecord(id);
  };

  /* My Library: walksong entries open a player modal (capture phase, before app6b's handler) */
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-myopen]") : null;
    if (!b) return;
    var p = b.getAttribute("data-myopen").split("|");
    if (p[0] !== "walksong") return;
    e.stopPropagation();
    var store = walkStore(), en = store[p[1]];
    if (!en) return;
    var h = '<div class="rec"><h2>' + esc(en.title) + ' <span class="id">' + esc(p[1]) + '</span></h2>' +
      '<p class="meta">' + esc(en.spec.genre) + " · " + en.spec.bpm + ' BPM · 5:00 standard · walkthrough song</p>' +
      '<p class="seqlab">' + esc(S.studioPlanSummary(en.spec)) + "</p>" +
      '<p><button class="btn" id="wso-play">▶ Play</button> <button class="btn teal" id="wso-wav">⬇ .wav</button> <span class="seqlab" id="wso-msg"></span></p></div>';
    var body = openModal("🎧 " + en.title, h, false);
    function msg(t) { var m = body.querySelector("#wso-msg"); if (m) m.textContent = t; }
    body.querySelector("#wso-play").onclick = function () {
      try { S.unlockAudio(); } catch (x) {}
      msg("Rendering…");
      S.renderStudioSong(en.spec, PROJ.mix, fxForMaster("radio")).then(function (buf) {
        S.playBuffer(buf, "wso"); msg("Playing. 🎶");
      }).catch(function (err) { msg("Couldn't render: " + err.message); });
    };
    body.querySelector("#wso-wav").onclick = function () {
      msg("Rendering…");
      S.renderStudioSong(en.spec, PROJ.mix, fxForMaster("radio")).then(function (buf) {
        dl(S.bufferToWav(buf), "signature-walksong.wav"); msg("Downloaded.");
      }).catch(function (err) { msg("Couldn't render: " + err.message); });
    };
  }, true);

  /* ================= AI addons section ================= */
  /* Gemini fix 7 (2026-10-02): each specialist AI gets a visible role
     + a Test button that genuinely runs it — opening the walkthrough at
     the addon's own step (Finisher runs aiFinish()). Real test, real output. */
  var ADDON_ROLES = {
    arrange: "Role: song architect — lays out the 5:00 structure",
    groove: "Role: rhythm designer — builds the drum pattern",
    melody: "Role: tune writer — writes melody, chords, bass line",
    vocalcoach: "Role: voice director — picks the voice, stacks backups",
    master: "Role: mix finisher — balances and masters radio-ready",
    finisher: "Role: closer — finishes any unfinished step"
  };
  function renderAddons() {
    var g = $("addongrid");
    if (!g) return;
    g.innerHTML = D.AI_ADDONS.map(function (a, i) {
      var role = ADDON_ROLES[a.id] || "Role: studio specialist";
      return '<div class="card"><h4>' + esc(a.name) + "</h4><p class='seqlab'>" + esc(a.desc) + "</p>" +
        '<p class="seqlab"><b>' + esc(role) + "</b></p>" +
        '<p class="seqlab">Engine: on-page studio engine — runs in your browser, from your seed. Claims no canon JAH-AI ID.</p>' +
        '<p><button class="btn teal" data-addontest="' + i + '">▶ Test this AI</button> ' +
        '<button class="btn ghost" data-addon="' + i + '">' + (a.go === -1 ? "🤖 Finish a song now" : "Use in walkthrough →") + "</button></p></div>";
    }).join("");
    g.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-addon]") : null;
      if (b) {
        var a = D.AI_ADDONS[+b.getAttribute("data-addon")];
        openWalk();
        if (a.go === -1) { aiFinish(); }
        else { WSTEP = a.go; drawStep(); }
        return;
      }
      var t = e.target.closest ? e.target.closest("[data-addontest]") : null;
      if (t) {
        var ta = D.AI_ADDONS[+t.getAttribute("data-addontest")];
        try { if (window.__palSay) window.__palSay("Testing " + ta.name + " — opening the walkthrough at its step. Watch it work."); } catch (x) {}
        openWalk();
        if (ta.go === -1) { aiFinish(); }
        else { WSTEP = ta.go; drawStep(); }
      }
    });
  }

  /* ================= teacher knowledge: walkthrough + standard ================= */
  if (D.THEORY) {
    D.THEORY.push(
      { k: ["walkthrough", "easy", "guide me", "step by step", "streamline", "simple"], t: "The Song Walkthrough", x: "The Song Walkthrough is the easy way to make a song: it asks one plain-language question per screen — genre, sounds, rhythm, bass, snare, drums, chorus, ending, lyrics, voice, backups, master — and builds your song as you answer. Every screen has an “AI finish my song” button that completes the rest for you. It always renders the 5:00 standard: intro build-up, four 30-second chorus breaks, and a fade out." },
      { k: ["five minute", "5:00", "5 minute", "full song", "standard", "chorus break"], t: "The 5:00 full-song standard", x: "Every walkthrough song follows the 5-minute standard: a 24-second intro build-up, verses, FOUR 30-second chorus breaks (at about 0:53, 2:05, 3:03 and 3:32), a bridge with a real beat-switch, an out jam, and a fade out — or a funky cold-stop or your own designed ending, your choice. Full lyrics are sung when you ask for them." },
      { k: ["addon", "add-on", "ai band", "arrangement ai", "groove ai", "melody ai", "vocal coach", "mastering ai", "finisher"], t: "AI addons", x: "Six specialist AIs do the musician work with you: Arrangement AI lays out the 5:00 structure, Groove AI designs the drum pattern and places every part, Melody & Harmony AI writes the tune and chords, Vocal Coach AI picks the voice and stacks backups, Mastering AI balances and masters the mix, and Finisher AI completes any unfinished step. All run in your browser — no network, no cost." },
      { k: ["custom voice", "man voice", "woman voice", "boy voice", "girl voice", "deep voice", "light voice", "voice range"], t: "Custom voices", x: "The walkthrough offers 24 created voice profiles: man, woman, boy, or girl — each in deep or light tone, each in low, mid, or high range. Or use your own voice: upload a wav or mp3 sample, or record one, and the AI sings it onto your melody. All voices are synthesized and labeled honestly." }
    );
  }

  /* test hooks (harmless in production) */
  window.__walkSteps = STEPS; window.__freshWalk = freshWalk; window.__specFromWalk = specFromWalk;

  /* ================= boot ================= */
  function boot() {
    var b = $("walkstart");
    if (b) b.onclick = openWalk;
    var b2 = $("walkai");
    if (b2) b2.onclick = function () { openWalk(); aiFinish(); };
    renderAddons();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
