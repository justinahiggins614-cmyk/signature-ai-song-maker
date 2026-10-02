
/* Signature Music Studio — console (faders + VU) + beat archive (part 4) */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl;

  /* ---------- console faders: shape every demo mix + vocal render ---------- */
  var MIX = { drums: 1, bass: 1, chords: 1, lead: 1, vocal: 1 };
  window.__mixOf = function () { return { drums: MIX.drums, bass: MIX.bass, chords: MIX.chords, lead: MIX.lead, vocal: MIX.vocal }; };
  document.querySelectorAll("#faders input[data-bus]").forEach(function (f) {
    f.addEventListener("input", function () {
      var b = f.getAttribute("data-bus");
      MIX[b] = (+f.value) / 100;
      var lab = document.querySelector('[data-fv="' + b + '"]');
      if (lab) lab.textContent = f.value;
    });
  });

  /* ---------- live VU meter on the master bus ---------- */
  var vuC = document.getElementById("vumaster"), vuX = vuC.getContext("2d"), vuPeak = 0;
  function drawVU() {
    var W = vuC.width, H = vuC.height, lvl = 0;
    try { lvl = S.meterLevel(); } catch (e) {}
    vuPeak = Math.max(lvl, vuPeak * 0.985);
    vuX.clearRect(0, 0, W, H);
    // scale arc
    vuX.fillStyle = "#0d0a14"; vuX.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H - 8, R = H - 18, a;
    vuX.strokeStyle = "#3a2f55"; vuX.lineWidth = 2;
    for (a = -1.1; a <= 1.1; a += 0.22) {
      vuX.beginPath(); vuX.moveTo(cx + Math.sin(a) * (R - 12), cy - Math.cos(a) * (R - 12)); vuX.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R); vuX.stroke();
    }
    function needle(v, color, w) {
      var ang = -1.1 + Math.min(1, v) * 2.2;
      vuX.strokeStyle = color; vuX.lineWidth = w; vuX.beginPath(); vuX.moveTo(cx, cy);
      vuX.lineTo(cx + Math.sin(ang) * (R - 4), cy - Math.cos(ang) * (R - 4)); vuX.stroke();
    }
    needle(vuPeak, "#9b7bff", 2);
    needle(lvl, lvl > 0.85 ? "#ff5a5a" : "#f5c542", 3);
    vuX.fillStyle = "#b9aec9"; vuX.font = "10px Arial"; vuX.fillText("VU", 6, 12);
    requestAnimationFrame(drawVU);
  }
  drawVU();

  /* ---------- beat archive browser ---------- */
  window.__initBeats = function (idx) {
    var rows = idx.filter(function (r) { return r[2] === "beat"; });
    var styles = {};
    rows.forEach(function (r) {
      var rec = D.genBeat(parseInt(r[0].slice(-7), 10));
      styles[rec.style] = 1;
    });
    Object.keys(styles).sort().forEach(function (s) { var o = document.createElement("option"); o.value = s; o.textContent = s.replace(/-/g, " "); $("beatstyle").appendChild(o); });
    function draw() {
      var fs = $("beatstyle").value, q = $("beatq").value.toLowerCase(), h = "", c = 0, i;
      for (i = 0; i < rows.length && c < 60; i++) {
        var rec = D.genBeat(parseInt(rows[i][0].slice(-7), 10));
        if (fs && rec.style !== fs) continue;
        if (q && (rec.name + " " + rec.desc).toLowerCase().indexOf(q) === -1) continue;
        c++;
        h += '<div class="card"><h4>' + esc(rec.name) + '</h4><div class="id">' + esc(rec.id) + " · " + esc(rec.style.replace(/-/g, " ")) + " · " + rec.bpm + ' BPM</div>' +
          '<p><button class="btn ghost" data-bplay="' + esc(rec.id) + '">▶</button> <button class="btn ghost" data-bopen="' + esc(rec.id) + '">Open →</button></p></div>';
      }
      $("beatgrid").innerHTML = h || '<div class="card">No beats match — try clearing filters.</div>';
    }
    draw("");
    $("beatstyle").onchange = draw;
    $("beatq").oninput = draw;
    $("beatgrid").addEventListener("click", function (e) {
      var p = e.target.closest("[data-bplay]"), o = e.target.closest("[data-bopen]");
      if (p) { try { S.unlockAudio(); } catch (e2) {} }
      if (p) window.__findRecord(p.getAttribute("data-bplay")).then(playBeatRec);
      if (o) { location.search = "?beat=" + o.getAttribute("data-bopen"); }
    });
  };
  function playBeatRec(rec) {
    var pat = S.patternFor(rec.name, rec.style, rec.bpm);
    S.renderBuffer(16 * (60 / rec.bpm / 4) * 4 + 0.3, function (c, dest, t0) { S.scheduleBeat(c, dest, t0, pat, 4, 1); })
      .then(function (buf) { S.playBuffer(buf, "beatat"); });
  }
  window.__playBeatRec = playBeatRec;
})();
