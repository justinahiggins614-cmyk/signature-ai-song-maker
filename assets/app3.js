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
  window.__buildZip = buildZip;

  /* ---------- melody from lyrics (scale follows genre) ---------- */
  function melodyFromLyrics(lines, genre) {
    var rng = S.rngFrom("lyr:" + lines.join("|")), mel = [], li, ni;
    var minorish = /hip-hop|trap|00s-crunk|90s-boombap|dark|gritty/i.test(genre || "");
    var penta = minorish ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9], base = 60 + Math.floor(rng() * 5), deg = 2;
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
  /* 2026-10-03: audio validation — duration / sample-rate / peak / clipping.
     Honest numbers about any decoded buffer (voice sample or cleanup upload). */
  window.__validateAudio = function (buf) {
    if (!buf || !buf.getChannelData) return "No audio to validate.";
    var d = buf.getChannelData(0), peak = 0, i, clip = 0;
    for (i = 0; i < d.length; i += 7) { var a = Math.abs(d[i]); if (a > peak) peak = a; if (a >= 0.999) clip++; }
    var db = peak > 0 ? (20 * Math.log10(peak)).toFixed(1) : "-inf";
    return "Audio check: " + buf.duration.toFixed(1) + "s · " + buf.sampleRate + " Hz · peak " + db + " dBFS" +
      (clip ? " · ⚠️ clipping detected (" + clip + " hot samples) — re-record quieter" : " · no clipping");
  };
  function voiceConsent() {
    var c = $("vconsent");
    if (c && !c.checked) { $("vinfo").textContent = "Please tick the voice-privacy consent box first — your sample never leaves this browser."; return false; }
    return true;
  }
  (function () {
    $("vrec").onclick = function () {
      var b = this;
      if (_recorder) { try { _recorder.stop(); } catch (e) {} _recorder = null; b.textContent = "🔴 Record my voice"; return; }
      if (!voiceConsent()) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $("vinfo").textContent = "Microphone not available in this browser."; return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var rec = new MediaRecorder(stream), chunks = [];
        _recorder = rec;
        rec.ondataavailable = function (e) { chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          _recorder = null; b.textContent = "🔴 Record my voice";
          new Blob(chunks, { type: rec.mimeType || "audio/webm" }).arrayBuffer().then(function (ab) {
            S.ensureCtx().decodeAudioData(ab).then(function (buf) { ownSample = buf; $("vinfo").textContent = "Voice sample recorded (" + buf.duration.toFixed(1) + "s). " + window.__validateAudio(buf) + " Now press Sing it."; },
              function () { $("vinfo").textContent = "Couldn't decode the recording."; });
          });
        };
        rec.start(); b.textContent = "⏹ Stop recording"; $("vinfo").textContent = "Recording… sing or speak a few seconds.";
      }).catch(function () { $("vinfo").textContent = "Microphone permission denied."; });
    };
    $("vupload").onclick = function () { if (!voiceConsent()) return; $("vfile").click(); };
    $("vdel").onclick = function () {
      ownSample = null; vocalBuf = null;
      $("vinfo").textContent = "Voice sample deleted — nothing of your voice remains on this page.";
    };
    $("vfile").onchange = function () {
      var f = this.files[0]; if (!f) return;
      /* Gemini fix 4 (2026-10-02): 10 MB upload cap, honest words. */
      if (f.size > 10 * 1024 * 1024) { $("vinfo").textContent = "That file is over the 10 MB upload limit — pick a shorter sample."; this.value = ""; return; }
      f.arrayBuffer().then(function (ab) { S.ensureCtx().decodeAudioData(ab).then(function (buf) { ownSample = buf; $("vinfo").textContent = "Sample loaded (" + buf.duration.toFixed(1) + "s) — stays on this device only. " + window.__validateAudio(buf); }); });
    };
    function selBackups() { return Array.prototype.map.call($("vbackup").selectedOptions, function (o) { return o.value; }); }
    $("vsing").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      var lines = $("vlyrics").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { $("vinfo").textContent = "Type some lyrics first."; return; }
      var genre = window.__resolveGenre(lines.join(" "), $("vgenre").value, D.BEAT_STYLES);
      var mel = melodyFromLyrics(lines, genre), voice = $("vvoice").value, backs = selBackups(), b = this;
      b.textContent = "Rendering…";
      try { S.setPlayerLabel("Synthesized vocal — " + voice); S.setBusy("Rendering vocal…"); } catch (e) {}
      var mix = window.__mixOf ? window.__mixOf() : null;
      $("vinfo").textContent = voice === "own" ? "Resynthesizing your voice onto the melody…" : "Synthesizing vocal (" + voice + ", " + genre.replace(/-/g, " ") + " melody)…";
      var p = voice === "own" && ownSample ? S.renderOwnVoice(mel, ownSample, 90) : S.renderVocal(mel, voice === "own" ? "nova" : voice, backs, 90, mix);
      if (voice === "own" && !ownSample) { $("vinfo").textContent = "Record or upload your voice first — using Nova meanwhile."; p = S.renderVocal(mel, "nova", backs, 90, mix); }
      p.then(function (buf) { vocalBuf = buf; S.playBuffer(buf, "vocal"); b.textContent = "🎤 Sing it"; $("vinfo").textContent = "Done — synthesized vocal" + (backs.length ? " with " + backs.join(", ") : "") + ". Labeled synthesized, always."; })
       .catch(function (e) { b.textContent = "🎤 Sing it"; $("vinfo").textContent = "Couldn't render: " + e.message; });
    };
    $("vplay").onclick = function () { try { S.unlockAudio(); } catch (e) {} if (vocalBuf) S.playBuffer(vocalBuf, "vocal"); };
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
      try { S.unlockAudio(); } catch (e) {}
      if (!chosenBackups.length) { $("bkspec").textContent = "Pick at least one type first."; return; }
      var mel = [{ midi: 64, len: 1 }, { midi: 67, len: 1 }, { midi: 69, len: 2 }, { midi: 67, len: 1 }];
      S.renderVocal(mel, "ember", chosenBackups, 20).then(function (buf) { try { S.setPlayerLabel("Backup singers demo"); } catch (e) {} S.playBuffer(buf, "backup"); });
    };
  })();

  /* ---------- vocal cleanup ---------- */
  var upBuf = null, cleanBuf = null;
  (function () {
    $("cup").onclick = function () { $("cufile").click(); };
    $("cufile").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (ab) { S.ensureCtx().decodeAudioData(ab).then(function (buf) { upBuf = buf; $("cuinfo").textContent = "Vocals loaded. " + window.__validateAudio(buf); }); });
    };
    $("cuclean").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
      if (!upBuf) { $("cuinfo").textContent = "Upload your vocals first."; return; }
      var b = this; b.textContent = "Cleaning…";
      S.cleanupVocal(upBuf).then(function (buf) { cleanBuf = buf; try { S.setPlayerLabel("Cleaned vocals"); } catch (e) {} S.playBuffer(buf, "clean"); b.textContent = "✨ AI: Clean it up"; $("cuinfo").textContent = "Cleaned: de-rumble, de-hiss, compression, normalized. Honest work — no magic."; });
    };
    $("curesing").onclick = function () {
      try { S.unlockAudio(); } catch (e) {}
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
    $("cuplay").onclick = function () { try { S.unlockAudio(); } catch (e) {} if (cleanBuf) S.playBuffer(cleanBuf, "clean"); };
    $("cuwav").onclick = function () { if (cleanBuf) dl(S.bufferToWav(cleanBuf), "signature-vocal-clean.wav"); };
  })();

  /* ---------- Make a CD (album maker) ----------
     2026-10-03: full album playback added (Manon's order — "doesnt play song
     ai made after generates"). Rendered tracks stay in memory with per-track
     Play / Prev / Next / Stop; "Add my latest AI song" bridges generate -> album.
     AI-generated songs resolve via window.__genSongs (the exact record the AI
     just made), so the album plays YOUR song, not a lookalike. */
  (function () {
    var cdTracks = [], cdIx = -1, cdTimer = null;
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
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
      var g = "BURNING GUIDE \u2014 Signature Music Studio disc image\n================================================\n\nYou downloaded: signature-cd.zip\n  - signature-cd.wav  (all tracks, CD-quality 44.1 kHz / 16-bit stereo)\n  - disc.cue          (cue sheet marking each track start)\n\n";
      g += has === "yes" ? "Your system has a CD burner. Steps:\n1. Unzip signature-cd.zip.\n2. Open your burner software (e.g. ImgBurn on Windows: 'Write image file to disc' -> pick disc.cue; on Mac: use Burn or Disk Utility with the .cue).\n3. Insert a blank CD-R, burn at 8x-16x for best audio quality.\n4. Finalize the disc so it plays in any CD player.\n"
        : has === "no" ? "No burner on this system \u2014 no problem:\n1. Keep the .wav as your master.\n2. Burn later on any computer with a CD/DVD burner using the steps above.\n3. Or upload the .wav to any online CD-printing service.\n"
        : "Not sure about a burner:\n1. On Windows, open File Explorer > This PC \u2014 a DVD/CD RW drive means you have one.\n2. On Mac, Apple menu > About This Mac > System Report > Disc Burning.\n3. Then follow the Yes/No path above.\n";
      g += "\nBrowsers cannot drive a CD burner directly \u2014 this package prepares everything; your burner software does the burning.\n";
      return g;
    }
    function clearTimer() { if (cdTimer) { clearTimeout(cdTimer); cdTimer = null; } }
    function playTrack(i) {
      if (i < 0 || i >= cdTracks.length) return;
      try { S.unlockAudio(); } catch (e) {}
      clearTimer();
      cdIx = i;
      var t = cdTracks[i];
      try { S.setPlayerLabel("\uD83D\uDCBF CD track " + (i + 1) + "/" + cdTracks.length + " \u2014 " + t.title); } catch (e2) {}
      var src = S.playBuffer(t.buf, "cd");
      if (src && t.buf && t.buf.duration) {
        cdTimer = setTimeout(function () { if (cdIx === i) playTrack(i + 1 < cdTracks.length ? i + 1 : 0); }, Math.max(500, t.buf.duration * 1000));
      }
      drawCdOut();
    }
    function stopCd() { clearTimer(); cdIx = -1; try { S.stopLive("cd"); } catch (e) {} drawCdOut(); }
    function drawCdOut() {
      if (!cdTracks.length) { $("cdout").innerHTML = ""; return; }
      var h = '<div class="hit"><b>\uD83D\uDCBF DISC IMAGE READY</b> \u2014 not "burned": browsers can\u2019t drive a CD burner, so this is the finished disc image (.zip + cue sheet) for your own burner software.<br><span class="seqlab">' +
        cdTracks.map(function (t) { return esc(t.title); }).join(" \u00B7 ") + "</span></div>";
      h += '<div class="cdtracks" role="group" aria-label="CD tracks">';
      h += '<p><button class="btn ghost" data-cd="prev" aria-label="Previous track">\u23EE</button> ' +
        '<button class="btn ghost" data-cd="stop" aria-label="Stop">\u23F9</button> ' +
        '<button class="btn ghost" data-cd="next" aria-label="Next track">\u23ED</button> ' +
        '<span class="seqlab">' + (cdIx >= 0 ? "Playing track " + (cdIx + 1) + " of " + cdTracks.length : cdTracks.length + " tracks ready") + "</span></p>";
      cdTracks.forEach(function (t, i) {
        h += '<div class="cdtrack' + (i === cdIx ? " now" : "") + '"><button class="fplay" data-cd="play" data-i="' + i + '" aria-label="Play ' + esc(t.title) + '">' +
          (i === cdIx ? "\u23F8 Pause track" : "\u25B6 Play") + "</button> " +
          '<span><b>' + (i + 1) + ".</b> " + esc(t.title) + '</span> <span class="id">' + esc(t.id) + "</span></div>";
      });
      h += "</div>";
      $("cdout").innerHTML = h;
    }
    $("cdout").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cd]"); if (!b) return;
      var act = b.getAttribute("data-cd");
      if (act === "play") { var i = +b.getAttribute("data-i"); if (i === cdIx) stopCd(); else playTrack(i); }
      else if (act === "next") playTrack(cdIx + 1 < cdTracks.length ? cdIx + 1 : 0);
      else if (act === "prev") playTrack(cdIx - 1 >= 0 ? cdIx - 1 : cdTracks.length - 1);
      else if (act === "stop") stopCd();
    });
    var addLatest = $("cdaddlatest");
    if (addLatest) addLatest.onclick = function () {
      var rec = window.__lastPromptRec || (window.__genSongs && Object.keys(window.__genSongs).length ? window.__genSongs[Object.keys(window.__genSongs).pop()] : null);
      if (!rec) { $("cdinfo").textContent = "No AI song generated yet this visit — make one above first."; return; }
      var ta = $("cdlist"), cur = ta.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (cur.indexOf(rec.id) === -1) { cur.push(rec.id); ta.value = cur.join("\n"); }
      $("cdinfo").textContent = "Added your latest AI song: " + rec.title + " (" + rec.id + "). Hit Render my CD.";
      ta.focus();
    };
    $("cdrender").onclick = function () {
      var ids = $("cdlist").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!ids.length) { $("cdinfo").textContent = "Add at least one song ID."; return; }
      stopCd(); cdTracks = [];
      var b = this; b.textContent = "Rendering\u2026"; $("cdinfo").textContent = "Rendering " + ids.length + " songs to CD quality\u2026";
      var chain = Promise.resolve(), tracks = [], start = 0;
      ids.forEach(function (id) {
        chain = chain.then(function () {
          return window.__findRecord(id).then(function (rec) {
            if (!rec || rec.kind !== "song") throw new Error(id + " is not a song");
            return S.renderSong(rec, 150, window.__mixOf ? window.__mixOf() : null).then(function (buf) {
              var t = { id: rec.id, title: rec.title, buf: buf, start: start };
              tracks.push(t); cdTracks.push(t);
              start += buf.duration + 2; // 2s gap
              $("cdinfo").textContent = "Rendered " + tracks.length + "/" + ids.length + ": " + rec.title;
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
        b.textContent = "\uD83D\uDCBF Render my CD";
        $("cdinfo").textContent = "Done \u2014 signature-cd.zip: " + tracks.length + " tracks, cue sheet, burning guide. Tap \u25B6 on any track to play it right here.";
        drawCdOut();
      }).catch(function (e) { b.textContent = "\uD83D\uDCBF Render my CD"; $("cdinfo").textContent = "Couldn't render: " + e.message; });
    };
  })();

  /* ---------- init browsers after data loads (called by app.js) ---------- */
  window.__initAll = function (idx) {
    if (window.__initAll.done) return; window.__initAll.done = true;
    window.__initLibrary(idx); window.__initGear(idx); window.__initSongs(idx); window.__initBeats(idx);
  };
})();
