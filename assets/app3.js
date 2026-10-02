/* Signature Music Studio — vocal studio, cleanup, CD maker (part 3) */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl;

  /* ---------- minimal stored ZIP builder (no compression) ---------- */
  function crc32(bytes) {
    var t = crc32.t, i, j, c;
    if (!t) { t = []; for (i = 0; i < 256; i++) { c = i; for (j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } crc32.t = t; }
    c = 0xFFFFFFFF;
    for (i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function buildZip(files) {
    // files: [{name, data: Uint8Array}]
    var parts = [], central = [], offset = 0, i, f;
    function le16(v, arr) { arr.push(v & 255, (v >> 8) & 255); }
    function le32(v, arr) { arr.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255); }
    for (i = 0; i < files.length; i++) {
      f = files[i]; var nameB = Array.prototype.map.call(f.name, function (ch) { return ch.charCodeAt(0); });
      var crc = crc32(f.data), lh = [];
      le32(0x04034b50, lh); le16(20, lh); le16(0, lh); le16(0, lh); le16(0, lh); le16(0, lh);
      le32(crc, lh); le32(f.data.length, lh); le32(f.data.length, lh); le16(nameB.length, lh); le16(0, lh);
      var head = new Uint8Array(lh.concat(nameB));
      parts.push(head, f.data);
      var chd = []; le32(0x02014b50, chd); le16(20, chd); le16(20, chd);
      le16(0, chd); le16(0, chd); le16(0, chd); le16(0, chd); le32(crc, chd);
      le32(f.data.length, chd); le32(f.data.length, chd); le16(nameB.length, chd);
      le16(0, chd); le16(0, chd); le16(0, chd); le16(0, chd); le32(0, chd); le32(offset, chd);
      central.push(new Uint8Array(chd.concat(nameB)));
      offset += head.length + f.data.length;
    }
    var cdStart = offset, cdSize = 0;
    central.forEach(function (c) { parts.push(c); cdSize += c.length; });
    var end = []; le32(0x06054b50, end); le16(0, end); le16(0, end); le16(files.length, end); le16(files.length, end);
    le32(cdSize, end); le32(cdStart, end); le16(0, end);
    parts.push(new Uint8Array(end));
    var total = parts.reduce(function (a, p) { return a + p.length; }, 0), out = new Uint8Array(total), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return new Blob([out], { type: "application/zip" });
  }
  function wavToBytes(blob) { return blob.arrayBuffer().then(function (ab) { return new Uint8Array(ab); }); }

  /* ---------- melody from lyrics ---------- */
  function melodyFromLyrics(lines) {
    var rng = S.rngFrom("lyr:" + lines.join("|")), mel = [], li, ni;
    var penta = [0, 2, 4, 7, 9], base = 60 + Math.floor(rng() * 5), deg = 2;
    for (li = 0; li < lines.length; li++) {
      var words = lines[li].trim().split(/\s+/).filter(Boolean).length || 4;
      var count = Math.max(2, Math.min(8, words));
      for (ni = 0; ni < count; ni++) {
        deg += Math.floor(rng() * 5) - 2; deg = Math.max(0, Math.min(9, deg));
        var oct = Math.floor(deg / 5), pc = penta[deg % 5];
        mel.push({ midi: base + oct * 12 + pc, len: rng() < 0.2 ? 2 : 1, line: li });
      }
    }
    return mel;
  }

  /* ---------- vocal studio ---------- */
  var ownSample = null, vocalBuf = null, _recorder = null;
  (function () {
    $("vrec").onclick = function () {
      var b = this;
      if (_recorder) { try { _recorder.stop(); } catch (e) {} _recorder = null; b.textContent = "🔴 Record my voice"; return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $("vinfo").textContent = "Microphone not available in this browser."; return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var rec = new MediaRecorder(stream), chunks = [];
        _recorder = rec;
        rec.ondataavailable = function (e) { chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          _recorder = null; b.textContent = "🔴 Record my voice";
          new Blob(chunks, { type: rec.mimeType || "audio/webm" }).arrayBuffer().then(function (ab) {
            S.ensureCtx().decodeAudioData(ab).then(function (buf) { ownSample = buf; $("vinfo").textContent = "Voice sample recorded (" + buf.duration.toFixed(1) + "s). Now press Sing it."; },
              function () { $("vinfo").textContent = "Couldn't decode the recording."; });
          });
        };
        rec.start(); b.textContent = "⏹ Stop recording"; $("vinfo").textContent = "Recording… sing or speak a few seconds.";
      }).catch(function () { $("vinfo").textContent = "Microphone permission denied."; });
    };
    $("vupload").onclick = function () { $("vfile").click(); };
    $("vfile").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (ab) { S.ensureCtx().decodeAudioData(ab).then(function (buf) { ownSample = buf; $("vinfo").textContent = "Sample loaded (" + buf.duration.toFixed(1) + "s)."; }); });
    };
    function selBackups() { return Array.prototype.map.call($("vbackup").selectedOptions, function (o) { return o.value; }); }
    $("vsing").onclick = function () {
      var lines = $("vlyrics").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { $("vinfo").textContent = "Type some lyrics first."; return; }
      var mel = melodyFromLyrics(lines), voice = $("vvoice").value, backs = selBackups(), b = this;
      b.textContent = "Rendering…";
      $("vinfo").textContent = voice === "own" ? "Resynthesizing your voice onto the melody…" : "Synthesizing vocal (" + voice + ")…";
      var p = voice === "own" && ownSample ? S.renderOwnVoice(mel, ownSample, 90) : S.renderVocal(mel, voice === "own" ? "nova" : voice, backs, 90);
      if (voice === "own" && !ownSample) { $("vinfo").textContent = "Record or upload your voice first — using Nova meanwhile."; p = S.renderVocal(mel, "nova", backs, 90); }
      p.then(function (buf) { vocalBuf = buf; S.playBuffer(buf, "vocal"); b.textContent = "🎤 Sing it"; $("vinfo").textContent = "Done — synthesized vocal" + (backs.length ? " with " + backs.join(", ") : "") + ". Labeled synthesized, always."; })
       .catch(function (e) { b.textContent = "🎤 Sing it"; $("vinfo").textContent = "Couldn't render: " + e.message; });
    };
    $("vplay").onclick = function () { if (vocalBuf) S.playBuffer(vocalBuf, "vocal"); };
    $("vwav").onclick = function () { if (vocalBuf) dl(S.bufferToWav(vocalBuf), "signature-vocal.wav"); };
  })();

  /* ---------- backup singers grid (to spec) ---------- */
  var chosenBackups = [];
  (function () {
    var h = "";
    S.BACKUP_TYPES.forEach(function (b) {
      h += '<div class="card"><h4>' + esc(b.name) + '</h4><p>' + esc(b.desc) + '</p><p><button class="btn ghost" data-bk="' + b.id + '">+ Add to spec</button></p></div>';
    });
    $("backupgrid").innerHTML = h + '<div class="card"><h4>Your backup spec</h4><p id="bkspec">None selected yet.</p><p><button class="btn teal" id="bkhear">▶ Hear them</button></p></div>';
    $("backupgrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bk]"); if (!b) return;
      var id = b.getAttribute("data-bk");
      if (chosenBackups.indexOf(id) === -1) chosenBackups.push(id);
      $("bkspec").textContent = "Backup singers to spec: " + chosenBackups.join(", ");
    });
    $("bkhear").onclick = function () {
      if (!chosenBackups.length) { $("bkspec").textContent = "Pick at least one type first."; return; }
      var mel = [{ midi: 64, len: 1 }, { midi: 67, len: 1 }, { midi: 69, len: 2 }, { midi: 67, len: 1 }];
      S.renderVocal(mel, "ember", chosenBackups, 20).then(function (buf) { S.playBuffer(buf, "backup"); });
    };
  })();

  /* ---------- vocal cleanup ---------- */
  var upBuf = null, cleanBuf = null;
  (function () {
    $("cup").onclick = function () { $("cufile").click(); };
    $("cufile").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (ab) { S.ensureCtx().decodeAudioData(ab).then(function (buf) { upBuf = buf; $("cuinfo").textContent = "Vocals loaded (" + buf.duration.toFixed(1) + "s)."; }); });
    };
    $("cuclean").onclick = function () {
      if (!upBuf) { $("cuinfo").textContent = "Upload your vocals first."; return; }
      var b = this; b.textContent = "Cleaning…";
      S.cleanupVocal(upBuf).then(function (buf) { cleanBuf = buf; S.playBuffer(buf, "clean"); b.textContent = "✨ AI: Clean it up"; $("cuinfo").textContent = "Cleaned: de-rumble, de-hiss, compression, normalized. Honest work — no magic."; });
    };
    $("curesing").onclick = function () {
      if (!upBuf) { $("cuinfo").textContent = "Upload your vocals first."; return; }
      var b = this; b.textContent = "Detecting…";
      // detect pitch across windows, quantize to a melody, re-sing with the synth
      var sr = upBuf.sampleRate, d = upBuf.getChannelData(0), win = Math.floor(sr * 0.25), mel = [], i;
      for (i = 0; i + win < d.length && mel.length < 64; i += win) {
        var sub = { getChannelData: function () { return d.slice(i, i + win); }, sampleRate: sr, length: win, numberOfChannels: 1 };
        var f = S.detectPitch(sub, sr), m = S.nearestMidi(f);
        if (m > 0) mel.push({ midi: m, len: 1 });
      }
      if (!mel.length) { b.textContent = "🎤 AI: Re-sing it clean"; $("cuinfo").textContent = "Couldn't detect a melody — try a clearer recording."; return; }
      b.textContent = "Singing…";
      S.renderVocal(mel, "nova", [], 60).then(function (buf) { cleanBuf = buf; S.playBuffer(buf, "clean"); b.textContent = "🎤 AI: Re-sing it clean"; $("cuinfo").textContent = "Re-sung clean: detected " + mel.length + " notes and sang them back with the Nova synth voice."; });
    };
    $("cuplay").onclick = function () { if (cleanBuf) S.playBuffer(cleanBuf, "clean"); };
    $("cuwav").onclick = function () { if (cleanBuf) dl(S.bufferToWav(cleanBuf), "signature-vocal-clean.wav"); };
  })();

  /* ---------- Make a CD ---------- */
  (function () {
    function cueSheet(tracks) {
      var out = 'FILE "signature-cd.wav" WAVE\n', i;
      for (i = 0; i < tracks.length; i++) {
        var ms = Math.floor(tracks[i].start * 75);
        var mm = String(Math.floor(ms / 4500)).padStart(2, "0"), ss = String(Math.floor(ms / 75) % 60).padStart(2, "0"), ff = String(ms % 75).padStart(2, "0");
        out += "  TRACK " + String(i + 1).padStart(2, "0") + " AUDIO\n    TITLE \"" + tracks[i].title.replace(/"/g, "") + "\"\n    INDEX 01 " + mm + ":" + ss + ":" + ff + "\n";
      }
      return out;
    }
    function guide(has) {
      var g = "BURNING GUIDE — Signature Music Studio disc image\n================================================\n\nYou downloaded: signature-cd.zip\n  - signature-cd.wav  (all tracks, CD-quality 44.1 kHz / 16-bit stereo)\n  - disc.cue          (cue sheet marking each track start)\n\n";
      g += has === "yes" ? "Your system has a CD burner. Steps:\n1. Unzip signature-cd.zip.\n2. Open your burner software (e.g. ImgBurn on Windows: 'Write image file to disc' -> pick disc.cue; on Mac: use Burn or Disk Utility with the .cue).\n3. Insert a blank CD-R, burn at 8x-16x for best audio quality.\n4. Finalize the disc so it plays in any CD player.\n"
        : has === "no" ? "No burner on this system — no problem:\n1. Keep the .wav as your master.\n2. Burn later on any computer with a CD/DVD burner using the steps above.\n3. Or upload the .wav to any online CD-printing service.\n"
        : "Not sure about a burner:\n1. On Windows, open File Explorer > This PC — a DVD/CD RW drive means you have one.\n2. On Mac, Apple menu > About This Mac > System Report > Disc Burning.\n3. Then follow the Yes/No path above.\n";
      g += "\nBrowsers cannot drive a CD burner directly — this package prepares everything; your burner software does the burning.\n";
      return g;
    }
    $("cdrender").onclick = function () {
      var ids = $("cdlist").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!ids.length) { $("cdinfo").textContent = "Add at least one song ID."; return; }
      var b = this; b.textContent = "Rendering…"; $("cdinfo").textContent = "Rendering " + ids.length + " songs to CD quality…";
      var chain = Promise.resolve(), tracks = [], start = 0;
      ids.forEach(function (id) {
        chain = chain.then(function () {
          return window.__findRecord(id).then(function (rec) {
            if (rec.kind !== "song") throw new Error(id + " is not a song");
            return S.renderSong(rec, 150).then(function (buf) {
              tracks.push({ title: rec.title, buf: buf, start: start });
              start += buf.duration + 2; // 2s gap
            });
          });
        });
      });
      chain.then(function () {
        var rate = 44100, total = Math.ceil(start * rate), out = { length: total, sampleRate: rate, numberOfChannels: 2, getChannelData: function (ch) { return chData[ch]; } };
        var chData = [new Float32Array(total), new Float32Array(total)];
        tracks.forEach(function (t) {
          var off = Math.floor(t.start * rate), d0 = t.buf.getChannelData(0), d1 = t.buf.numberOfChannels > 1 ? t.buf.getChannelData(1) : d0, i, n = Math.min(d0.length, total - off);
          for (i = 0; i < n; i++) { chData[0][off + i] = d0[i]; chData[1][off + i] = d1[i]; }
        });
        return S.bufferToWav(out).arrayBuffer();
      }).then(function (ab) {
        var has = $("burnerq").value;
        var files = [
          { name: "signature-cd.wav", data: new Uint8Array(ab) },
          { name: "disc.cue", data: new TextEncoder().encode(cueSheet(tracks)) },
          { name: "BURNING-GUIDE.txt", data: new TextEncoder().encode(guide(has)) }
        ];
        dl(buildZip(files), "signature-cd.zip");
        b.textContent = "💿 Render my CD";
        $("cdinfo").textContent = "Done — signature-cd.zip: " + tracks.length + " tracks, cue sheet, burning guide.";
        $("cdout").innerHTML = '<div class="hit"><b>Your CD is ready.</b><br><span class="seqlab">' + tracks.map(function (t) { return esc(t.title); }).join(" · ") + '</span></div>';
      }).catch(function (e) { b.textContent = "💿 Render my CD"; $("cdinfo").textContent = "Couldn't render: " + e.message; });
    };
  })();

  /* ---------- init browsers after data loads (called by app.js) ---------- */
  window.__initAll = function (idx) {
    if (window.__initAll.done) return; window.__initAll.done = true;
    window.__initLibrary(idx); window.__initGear(idx); window.__initSongs(idx);
  };
})();
