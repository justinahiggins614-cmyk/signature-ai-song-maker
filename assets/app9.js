/* ============================================================
   Signature Music Studio (part 9) — 2026-10-02:
   Gemini corrected fixes:
   (1) Single obvious "Start Here" path: Describe → Create →
       Listen → Edit → Download. Sits atop all existing features.
   (6) My Projects: save a song project, return to it later
       (localStorage); Export Project: downloadable .zip package
       (spec JSON + lyrics + MIDI + README) with permanent ID +
       reproducible seed.
   ============================================================ */
(function () {
  "use strict";
  if (!window.__S) return;
  var S = window.__S, D = window.__D, dl = window.__dl;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function u8(str) { var s = unescape(encodeURIComponent(String(str))), a = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

  /* ---------- Start Here banner ---------- */
  var STEPS = ["Describe your song", "Create", "Listen", "Edit", "Download"];
  var stepState = 0; /* 0-based active step */
  function injectStartHere() {
    var sec = $("makestudio");
    if (!sec || $("starthere")) return;
    var css = ".starthere{border:2px solid var(--gold,#d4af37);border-radius:12px;padding:12px 14px;margin:0 0 16px;background:rgba(212,175,55,.06)}" +
      ".starthere h3{margin:0 0 8px;color:var(--gold,#d4af37)}" +
      ".shsteps{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}" +
      ".shsteps li{flex:1 1 120px;min-width:110px;border:1px solid #555;border-radius:10px;padding:8px 10px;font-size:14px;color:#bbb;background:#111}" +
      ".shsteps li b{display:block;font-size:12px;color:#888;font-weight:normal}" +
      ".shsteps li.active{border-color:var(--gold,#d4af37);color:#fff;box-shadow:0 0 10px rgba(212,175,55,.35)}" +
      ".shsteps li.active b{color:var(--gold,#d4af37)}" +
      ".shsteps li.done{border-color:#4caf50;color:#cfc}.shsteps li.done b{color:#4caf50}" +
      ".shmsg{margin:8px 0 0;font-size:14px;color:#cfc}";
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var h = '<div class="starthere" role="region" aria-label="Start here"><h3>🌟 New here? Start Here — 5 steps to your first song</h3>' +
      '<ol class="shsteps">' + STEPS.map(function (s, i) {
        return '<li data-sh="' + i + '"' + (i === 0 ? ' class="active"' : "") + '><b>Step ' + (i + 1) + "</b>" + esc(s) + "</li>";
      }).join("") + '</ol><p class="shmsg" id="shmsg">Step 1: type what you imagine in the box below, then hit <b>✨ Create my song</b>.</p></div>';
    var h2 = sec.querySelector("h2");
    if (h2 && h2.nextSibling) h2.parentNode.insertBefore((function () { var d = document.createElement("div"); d.innerHTML = h; return d.firstChild; })(), h2.nextSibling);
    else sec.insertBefore((function () { var d = document.createElement("div"); d.innerHTML = h; return d.firstChild; })(), sec.firstChild);
  }
  var SHMSG = [
    "Step 1: type what you imagine in the box below, then hit <b>✨ Create my song</b>.",
    "Step 2: the AI is creating your song — full 5:00 standard, rhyming lyrics.",
    "Step 3: your song is ready — tap <b>▶ Play my song</b> to hear it.",
    "Step 4: want changes? Tap <b>🎧 Refine in walkthrough</b> to edit it step by step.",
    "Step 5: love it? Grab the <b>.wav</b>, <b>MIDI</b>, <b>stems</b>, or <b>📦 Export project</b> below.",
    "🎉 Done — your song is out in the world. It's saved in <b>My Projects</b> below."
  ];
  function setStep(i) {
    stepState = i;
    Array.prototype.forEach.call(document.querySelectorAll(".shsteps li"), function (li) {
      var ix = +li.getAttribute("data-sh");
      li.className = ix < i ? "done" : (ix === i ? "active" : "");
    });
    var m = $("shmsg");
    if (m) m.innerHTML = SHMSG[Math.min(i, SHMSG.length - 1)];
    var first = document.querySelector(".shsteps li.active");
    if (first && i > 0) { try { first.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }
  }

  /* ---------- My Projects: save + return (localStorage) ---------- */
  var LSKEY = "sigstudio.projects", MAXP = 12;
  function loadProjects() {
    try { var p = JSON.parse(PS.get(LSKEY) || "[]"); return Array.isArray(p) ? p : []; } catch (e) { return []; }
  }
  function storeProjects(list) {
    try { PS.set(LSKEY, JSON.stringify(list.slice(0, MAXP))); } catch (e) {}
  }
  function saveProject(rec) {
    if (!rec || !rec.id) return;
    var list = loadProjects().filter(function (p) { return p.id !== rec.id; });
    rec._savedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    list.unshift(rec);
    storeProjects(list);
    renderProjects();
  }
  function renderProjects() {
    var box = $("myprojects");
    if (!box) return;
    var list = loadProjects(), h;
    if (!list.length) {
      box.innerHTML = '<p class="seqlab">No saved projects yet — create a song above and it lands here automatically. Stored on this device only.</p>';
      return;
    }
    h = list.map(function (p, i) {
      return '<div class="card"><h4>' + esc(p.title || p.id) + '</h4><div class="id">' + esc(p.id) +
        (p.n != null ? ' · seed <b>' + esc(p.n) + '</b>' : "") + ' · saved ' + esc(p._savedAt || "") + '</div>' +
        '<p><button class="btn ghost" data-popen="' + i + '">📂 Open</button> ' +
        '<button class="btn teal" data-pexp="' + i + '">📦 Export project</button> ' +
        '<button class="btn ghost" data-pdel="' + i + '">🗑 Delete</button></p></div>';
    }).join("");
    box.innerHTML = '<div class="grid">' + h + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll("[data-popen]"), function (b) {
      b.onclick = function () {
        var p = loadProjects()[+b.getAttribute("data-popen")];
        if (p && window.__renderPromptResult) { window.__renderPromptResult(p, "", "ai"); try { $("promptout").scrollIntoView(); } catch (e) {} }
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-pexp]"), function (b) {
      b.onclick = function () { var p = loadProjects()[+b.getAttribute("data-pexp")]; if (p) window.__exportProject(p); };
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-pdel]"), function (b) {
      b.onclick = function () {
        var list = loadProjects(); list.splice(+b.getAttribute("data-pdel"), 1);
        storeProjects(list); renderProjects();
      };
    });
  }
  function injectProjectsPanel() {
    var out = $("promptout");
    if (!out || $("myprojects")) return;
    var d = document.createElement("div");
    d.innerHTML = '<h3 style="color:var(--gold,#d4af37);margin-top:18px">💾 My Projects — save & return</h3>' +
      '<p class="seqlab">Your created songs are saved here automatically. Reopen one any time — same ID, same seed, same song. Stored on this device only.</p>' +
      '<div id="myprojects"></div>';
    out.parentNode.insertBefore(d, out.nextSibling);
    renderProjects();
  }

  /* ---------- Export Project: downloadable .zip package ---------- */
  window.__exportProject = function (rec) {
    try {
      if (!window.__buildZip) { alert("Project export isn't ready yet — reload the page and try again."); return; }
      var files = [];
      var pkg = {
        id: rec.id, kind: rec.kind, seed: (rec.n != null ? rec.n : null),
        title: rec.title || rec.name, genre: rec.genre || rec.style, tempo: rec.tempo || rec.bpm,
        mood: rec.mood, key: rec.key, chords: rec.chords, structure: rec.structure,
        createdBy: "Signature Music Studio", studio: "https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/",
        reproducible: "Same ID + same seed always makes this exact record. Audio is synthesized live in your browser — no samples.",
        spec: rec
      };
      files.push({ name: rec.id + ".json", data: u8(JSON.stringify(pkg, null, 2)) });
      if (rec.lyrics) files.push({ name: rec.id + "-lyrics.txt", data: u8(rec.lyrics) });
      if (rec.kind === "song" && window.__midiBytes) {
        try { files.push({ name: rec.id + ".mid", data: new Uint8Array(window.__midiBytes(rec)) }); } catch (e2) {}
      }
      files.push({ name: "README.txt", data: u8(
        "SIGNATURE MUSIC STUDIO — project package\n" +
        "=========================================\n\n" +
        "Project: " + rec.id + " — " + (rec.title || rec.name || "") + "\n" +
        "Seed: " + (rec.n != null ? rec.n : "n/a") + " (same ID always makes this exact record)\n\n" +
        "Contents:\n" +
        "  " + rec.id + ".json        full song/beat spec (the permanent record)\n" +
        (rec.lyrics ? "  " + rec.id + "-lyrics.txt  lyrics, plain text\n" : "") +
        (rec.kind === "song" ? "  " + rec.id + ".mid        melody + chords + drums (import into any DAW)\n" : "") +
        "\nAll audio is synthesized live in your browser by the Signature engine.\n" +
        "Original Signature composition — Justin Addam Higgins.\n") });
      dl(window.__buildZip(files), rec.id + "-project.zip");
      try { if (window.__palSay) window.__palSay("Project package exported — " + rec.id + "-project.zip: spec, lyrics, MIDI, and README."); } catch (e3) {}
    } catch (e) {}
  };

  /* ---------- wiring ---------- */
  function boot() {
    injectStartHere();
    injectProjectsPanel();
    var pc = $("promptcreate");
    if (pc) pc.addEventListener("click", function () { setStep(1); });
    var out = $("promptout");
    if (out && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (out.querySelector(".card")) {
          setStep(2);
          setTimeout(function () { setStep(3); }, 600);
          if (window.__lastPromptRec) saveProject(window.__lastPromptRec);
        }
      });
      mo.observe(out, { childList: true, subtree: true });
    }
    if (out) out.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.id) return;
      if (t.id === "promptplaybtn" || t.id === "promptplay") setStep(3);
      else if (t.id === "promptwalk") setStep(4);
      else if (t.id === "promptwav" || t.id === "promptmidi" || t.id === "promptstems" || t.id === "promptexp") setStep(5);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
