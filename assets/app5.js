/* ============================================================
   Signature Music Studio — Studio Session (part 5):
   modal popup system, My Library, pop-open record cards,
   instrument picker popup, song-search popup.
   ============================================================ */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl,
      readAloud = window.__readAloud;

  /* ---------- generic modal popup ---------- */
  var modalEl = null, _lockCount = 0;
  function lockScroll() { _lockCount++; document.body.style.overflow = "hidden"; }
  function unlockScroll() { _lockCount = Math.max(0, _lockCount - 1); if (!_lockCount) document.body.style.overflow = ""; }
  function openModal(title, bodyHTML, wide) {
    closeModal();
    modalEl = document.createElement("div");
    modalEl.className = "sigmodal-back";
    modalEl.innerHTML = '<div class="sigmodal' + (wide ? " wide" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="sigmodal-head"><h3>' + esc(title) + '</h3><button class="sigmodal-x" aria-label="Close">✕</button></div>' +
      '<div class="sigmodal-body">' + bodyHTML + "</div></div>";
    document.body.appendChild(modalEl);
    lockScroll();
    modalEl.querySelector(".sigmodal-x").onclick = closeModal;
    modalEl.addEventListener("click", function (e) { if (e.target === modalEl) closeModal(); });
    document.addEventListener("keydown", escClose);
    return modalEl.querySelector(".sigmodal-body");
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; unlockScroll(); }
    document.removeEventListener("keydown", escClose);
  }
  window.__openModal = openModal; window.__closeModal = closeModal;

  /* ---------- My Library (localStorage): the user's showpiece shelf ---------- */
  var LIBKEY = "sigstudio.mylib.v1";
  function myLib() {
    try { return JSON.parse(localStorage.getItem(LIBKEY) || "[]"); } catch (e) { return []; }
  }
  function myLibSave(list) { try { localStorage.setItem(LIBKEY, JSON.stringify(list)); } catch (e) {} }
  function myLibAdd(kind, id, name) {
    var l = myLib();
    if (!l.some(function (x) { return x.id === id; })) { l.push({ kind: kind, id: id, name: name }); myLibSave(l); }
    return l;
  }
  function myLibRemove(id) { myLibSave(myLib().filter(function (x) { return x.id !== id; })); }
  function myLibHas(id) { return myLib().some(function (x) { return x.id === id; }); }
  window.__myLib = myLib; window.__myLibAdd = myLibAdd; window.__myLibRemove = myLibRemove; window.__myLibHas = myLibHas;
  /* 2026-10-03: library export/import, versioned (P1). Format JAH-MYLIB/1. */
  window.__myLibExport = function () {
    var payload = { format: "JAH-MYLIB/1", version: 1, exported_at: new Date().toISOString(), items: myLib() };
    dl(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "signature-my-library.json");
    return payload.items.length;
  };
  window.__myLibImport = function (json) {
    var p = typeof json === "string" ? JSON.parse(json) : json;
    if (!p || (p.format !== "JAH-MYLIB/1" && p.version !== 1 && !p.items)) throw new Error("not a Signature library file");
    var items = p.items || p;
    if (!Array.isArray(items)) throw new Error("not a Signature library file");
    var l = myLib(), added = 0;
    items.forEach(function (x) {
      if (x && x.id && !l.some(function (y) { return y.id === x.id; })) { l.push({ kind: x.kind || "sound", id: x.id, name: x.name || x.id }); added++; }
    });
    myLibSave(l);
    if (window.__renderMyLib) window.__renderMyLib();
    return added;
  };
  (function () {
    var ex = document.getElementById("libexport"), im = document.getElementById("libimport"), fi = document.getElementById("libfile");
    if (ex) ex.onclick = function () { var n = window.__myLibExport(); ex.textContent = "⬇ Exported " + n + " items"; setTimeout(function () { ex.textContent = "⬇ Export library"; }, 2500); };
    if (im && fi) {
      im.onclick = function () { fi.click(); };
      fi.onchange = function () {
        var f = this.files[0]; if (!f) return;
        f.text().then(function (t) {
          try { var n = window.__myLibImport(t); im.textContent = "⬆ Imported " + n + " new"; }
          catch (e) { im.textContent = "⬆ Import failed — not a library file"; }
          setTimeout(function () { im.textContent = "⬆ Import library"; }, 3000);
        });
        this.value = "";
      };
    }
  })();

  /* ---------- pop-open record card (sounds, gear, beats, songs) ---------- */
  function libBtn(kind, id, name) {
    return myLibHas(id)
      ? '<button class="btn ghost" data-librm="' + esc(id) + '">★ In My Library — remove</button>'
      : '<button class="btn teal" data-libadd="' + esc(kind) + "|" + esc(id) + "|" + esc(name) + '">💾 Save to My Library</button>';
  }
  function wireLibBtns(root) {
    root.addEventListener("click", function (e) {
      var a = e.target.closest("[data-libadd]"), r = e.target.closest("[data-librm]");
      if (a) {
        var p = a.getAttribute("data-libadd").split("|");
        myLibAdd(p[0], p[1], p[2]);
        a.outerHTML = '<button class="btn ghost" data-librm="' + esc(p[1]) + '">★ In My Library — remove</button>';
        if (window.__renderMyLib) window.__renderMyLib();
      }
      if (r) { myLibRemove(r.getAttribute("data-librm")); r.outerHTML = '<button class="btn teal" disabled>Removed</button>'; if (window.__renderMyLib) window.__renderMyLib(); }
    });
  }
  window.__libBtn = libBtn; window.__wireLibBtns = wireLibBtns;

  function openSoundModal(id) {
    try { S.unlockAudio(); } catch (e) {}
    window.__findRecord(id).then(function (rec) {
      var body = openModal(rec.name, "", true);
      body.innerHTML =
        '<p class="meta"><span class="id">' + esc(rec.id) + "</span> · " + esc(rec.subtype) + " · " + esc(rec.cat) + " family · " + esc(rec.voice) + " voice</p>" +
        "<p>" + esc(rec.desc) + "</p>" +
        '<p><button class="btn" data-m="play">▶ Preview</button> ' +
        '<button class="btn teal" data-m="wav">⬇ .wav</button> ' +
        '<button class="btn ghost" data-m="read">🔊 Read aloud</button></p>' +
        "<p>" + libBtn("sound", rec.id, rec.name) + "</p>" +
        '<p class="seqlab">Every sound here can live in your library — save it, then use it in the Studio Session below.</p>';
      wireLibBtns(body);
      body.addEventListener("click", function (e) {
        var b = e.target.closest("[data-m]"); if (!b) return;
        var m = b.getAttribute("data-m");
        if (m === "read") readAloud(rec.name + ". " + rec.desc, rec.id);
        if (m === "play") { try { S.unlockAudio(); } catch (e2) {} window.__previewSound(rec); }
        if (m === "wav") {
          S.renderBuffer(3.2, function (cc, dd, t0) {
            var rr = S.rngFrom("pvm:" + rec.id), base = 48 + Math.floor(rr() * 24), seq = [0, 4, 7, 12, 7, 4, 2], i2;
            for (i2 = 0; i2 < seq.length; i2++) {
              (function (tt, nn) {
                var o = cc.createOscillator(), g = cc.createGain();
                o.type = "triangle"; o.frequency.value = S.midiHz(base + nn);
                g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.5, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
                o.connect(g); g.connect(dd); o.start(tt); o.stop(tt + 0.45);
              })(t0 + i2 * 0.42, seq[i2]);
            }
          }).then(function (buf) { dl(S.bufferToWav(buf), rec.id + ".wav"); });
        }
      });
    }, function () { openModal("Not found", "<p>That record could not be loaded.</p>"); });
  }
  window.__openSoundModal = openSoundModal;

  function openGearModal(id) {
    window.__findRecord(id).then(function (rec) {
      var body = openModal(rec.name, "", true);
      body.innerHTML =
        '<p class="meta"><span class="id">' + esc(rec.id) + "</span> · " + esc(rec.cat) + "</p>" +
        "<p>" + esc(rec.desc) + "</p>" +
        (rec.patch ? '<h4>Patch guide</h4><p class="chords">' + esc(rec.patch) + "</p>" : "") +
        '<p><button class="btn ghost" data-m="read">🔊 Read aloud</button></p>' +
        "<p>" + libBtn("gear", rec.id, rec.name) + "</p>";
      wireLibBtns(body);
      body.addEventListener("click", function (e) {
        var b = e.target.closest("[data-m]"); if (!b) return;
        if (b.getAttribute("data-m") === "read") readAloud(rec.name + ". " + rec.desc + (rec.patch ? " Patch guide: " + rec.patch : ""), rec.id);
      });
    });
  }
  window.__openGearModal = openGearModal;

  /* ---------- instrument picker popup (used at every studio step) ---------- */
  function openInstrumentPicker(onPick, multi) {
    var idx = window.__getIdx ? window.__getIdx() : [];
    var rows = idx.filter(function (r) { return r[2] === "sound"; }).slice(0, 400);
    var body = openModal(multi === false ? "Pick an instrument" : "Pick instruments", "", true);
    var picked = [];
    function draw(q) {
      var h = '<div class="row"><div><label>Search instruments</label><input type="text" id="ipq" value="' + esc(q || "") + '" placeholder="e.g. piano, 808, strings…"></div></div><div class="ipgrid">', c = 0, i;
      for (i = 0; i < rows.length && c < 48; i++) {
        var rec = D.genSound(parseInt(rows[i][0].slice(-7), 10));
        if (rec.subtype !== "instrument") continue;
        if (q && (rec.name + " " + rec.cat).toLowerCase().indexOf(q) === -1) continue;
        c++;
        var sel = picked.indexOf(rec.id) !== -1;
        h += '<div class="ipcard' + (sel ? " on" : "") + '" data-ip="' + esc(rec.id) + '"><b>' + esc(rec.name) + '</b><br><span class="seqlab">' + esc(rec.cat) + '</span></div>';
      }
      body.innerHTML = h + '</div><p><button class="btn" id="ipdone">Done — use ' + (picked.length || "these") + "</button></p>";
      var qi = body.querySelector("#ipq");
      if (qi) qi.oninput = function () { draw(this.value.toLowerCase()); var nq = body.querySelector("#ipq"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); };
      Array.prototype.forEach.call(body.querySelectorAll("[data-ip]"), function (el) {
        el.onclick = function () {
          var id = el.getAttribute("data-ip");
          if (multi === false) { picked = [id]; }
          else { var ix = picked.indexOf(id); if (ix === -1) picked.push(id); else picked.splice(ix, 1); }
          el.classList.toggle("on");
          var dn = body.querySelector("#ipdone"); if (dn) dn.textContent = "Done — use " + (picked.length ? picked.length + " instrument" + (picked.length > 1 ? "s" : "") : "these");
        };
      });
      body.querySelector("#ipdone").onclick = function () { closeModal(); onPick(picked); };
    }
    draw("");
  }
  window.__openInstrumentPicker = openInstrumentPicker;

  /* ---------- song-search popup ---------- */
  function openSongSearch(onPick) {
    var idx = window.__getIdx ? window.__getIdx() : [];
    var rows = idx.filter(function (r) { return r[2] === "song"; });
    var body = openModal("Search the song archive", "", true);
    function draw(q) {
      var h = '<div class="row"><div><label>Search songs</label><input type="text" id="ssq" value="' + esc(q || "") + '" placeholder="title, genre, mood, lyric word…"></div></div><div class="grid">', c = 0, i;
      q = (q || "").toLowerCase();
      for (i = 0; i < rows.length && c < 24; i++) {
        var rec = D.genSong(parseInt(rows[i][0].slice(-7), 10));
        var hay = (rec.title + " " + rec.genre + " " + rec.mood + " " + rec.lyrics).toLowerCase();
        if (q && hay.indexOf(q) === -1) continue;
        c++;
        h += '<div class="card"><h4>' + esc(rec.title) + '</h4><div class="id">' + esc(rec.id) + " · " + esc(rec.genre) + '</div>' +
          '<p><button class="btn ghost" data-ss="' + esc(rec.id) + '">Use this song →</button></p></div>';
      }
      body.innerHTML = h + "</div>" + (c ? "" : '<p class="seqlab">No matches — try another word.</p>');
      var qi = body.querySelector("#ssq");
      if (qi) qi.oninput = function () { var v = this.value; draw(v); var nq = body.querySelector("#ssq"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); };
      Array.prototype.forEach.call(body.querySelectorAll("[data-ss]"), function (el) {
        el.onclick = function () { var id = el.getAttribute("data-ss"); closeModal(); onPick(id); };
      });
    }
    draw("");
  }
  window.__openSongSearch = openSongSearch;
})();
