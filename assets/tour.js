/* ============================================================
   Signature Music Studio — first-time spotlight tour + permanent
   "? Guide" panel (2026-10-03 usability wave).
   - 1-minute spotlight tour: localStorage "jah-tour-seen-studio",
     Start/Skip, Next/Back, WHAT / WHAT IT DOES / HOW per step.
   - Permanent "?" guide button: plain-language docs of every feature.
   - Theme untouched: only existing palette/classes (.btn, .card,
     .seqlab, var(--gold)/var(--teal)/var(--panel)/var(--line)).
   - Keyboard: Esc closes, arrows move. Touch-sized buttons.
   - Never blocks content: overlay is pointer-events:none except the
     tooltip card itself; auto-show skipped on ?record= deep links.
   ============================================================ */
(function () {
  "use strict";
  if (window.__studioTourLoaded) return; window.__studioTourLoaded = true;
  var SEEN = "jah-tour-seen-studio";

  var STEPS = [
    { sel: "#promptbox", title: "1 · Create your song",
      what: "The big song box at the top, and the ✨ Create my song button.",
      does: "Describe any song you can imagine — the AI writes a full song to the 5:00 standard (intro build-up, 18-bar verses, four chorus breaks, rhyming lyrics).",
      how: "Type what you imagine, pick a style and lyrics option, hit ✨ Create my song, then ▶ Play my song." },
    { sel: ".modes", title: "2 · Three ways to make music",
      what: "The three buttons under the title: 🎸 Make it yourself · 🤖 Let the AI make it · 🤝 Collaborate with AI.",
      does: "Sets how much the AI does for you — you drive every control, the AI does everything, or the AI drafts and you adjust.",
      how: "Tap one. The line underneath tells you what it means." },
    { sel: "#console", title: "3 · Studio console",
      what: "The mixer: channel faders (drums, bass, chords, lead, vocal), the master VU meter, and the metronome.",
      does: "The faders shape every demo mix you render. The VU needle shows live loudness off the master bus.",
      how: "Drag any fader and re-play a song — hear the mix change. Tap the metronome for a click track." },
    { sel: "#studio", title: "4 · Sound library",
      what: "Every sound the studio can synthesize — drums, bass, keys, strings, world instruments, FX, sound sets and packs.",
      does: "Search, filter by family, browse A–Z, tap ▶ to preview any sound, and save keepers to My Library. 🤖 AI: pick sounds for me chooses six.",
      how: "Type in the search box, or tap ▶ on any card to hear it right here." },
    { sel: "#songs", title: "5 · Song archive",
      what: "Every finished song in the archive — the big 📀 Open the Song Archive button jumps straight here.",
      does: "Search songs, filter by genre, sort newest/oldest, browse A–Z — and every card has one-tap ▶ play.",
      how: "Type a word in Search songs, or tap a letter. Tap ▶ to hear a 30-second preview." },
    { sel: "#beatmaker", title: "6 · AI Beat Maker",
      what: "Describe-the-beat box with tempo and bars.",
      does: "The AI arranges a beat from a deterministic seed — same request, same beat. Click any step in the lane grid to tweak it; download the .wav or the pattern JSON.",
      how: "Describe your beat, hit 🤖 AI: Make my beat. Tempo clamps to 60–180 BPM, bars to 1–16." },
    { sel: "#vocalstudio", title: "7 · Vocal studio",
      what: "Record or upload YOUR voice, or pick a created voice (Nova, Ember, Drift, Stone).",
      does: "The AI sings your lyrics onto a melody with the chosen voice. Your sample never leaves this browser — tick the consent box first. All voices are synthesized; there are no human singers here.",
      how: "Type lyrics, pick a voice, hit 🎤 Sing it. Record needs microphone permission." },
    { sel: "#cdmaker", title: "8 · Make a CD",
      what: "The album maker: a song-ID list, album/artist names, and 💿 Render my CD.",
      does: "Lines up tracks and renders a CD-quality disc image (.zip with the full .wav, a cue sheet, and a burning guide). Each track plays right here with ⏮ ⏹ ⏭ controls.",
      how: "Generate a song above, hit “Add my latest AI song”, name the album, Render my CD." },
    { sel: "#playerbar", title: "9 · The always-on player",
      what: "The slim bar that appears at the bottom whenever audio renders or plays.",
      does: "Shows a spinner while rendering, an EQ while playing — and plain honest words if your browser blocks audio (“Audio is blocked in this browser — tap ▶ again”). It never fakes a now-playing state.",
      how: "Press ▶ anywhere and watch it here. ■ stops, ⏸ pauses." },
    { sel: "#finderq", title: "10 · Finder AI",
      what: "The finder box near the bottom.",
      does: "Type what you want — it pulls up matching songs and beats and PLAYS them right in the results, or takes you to the full record.",
      how: "Try “beat”, “love song”, or “piano” and hit Enter, then tap ▶ Play." }
  ];

  var GUIDE_SECTIONS = [
    ["🎸 The three modes", "Make it yourself (you set every control), Let the AI make it (one click, finished result), Collaborate with AI (the AI drafts, you adjust). Switch any time at the top of the page."],
    ["✨ Make a Song (front door)", "Describe your song, pick a style and lyrics option (AI writes rhyming lyrics / you type them / instrumental), hit ✨ Create my song. You get ▶ Play my song, ⬇ .wav, ⬇ MIDI, ⬇ 5 stems, 📦 Export project, 🔊 Read lyrics, 📄 Open record, and 🎧 Refine in walkthrough. New here? The gold “Start Here” box walks the 5 steps: Describe → Create → Listen → Edit → Download."],
    ["💾 My Projects", "Every song you create is saved here automatically (on this device only, up to 12). Reopen any time — same ID, same seed, same song. 📦 Export project downloads a .zip: the full spec JSON, lyrics, MIDI, and a README."],
    ["🔥 Explore feed", "Fresh from the studio: the newest songs and beats with one-tap ▶ play."],
    ["🎚️ Studio Console", "Five channel faders (drums, bass, chords, lead, vocal) shape every demo mix. The master VU meter shows live loudness. The metronome gives a click track (40–220 BPM)."],
    ["🎛️ Sound Library", "Thousands of synthesizable sounds: search, family filter, type filter, A–Z. ▶ previews, Open pops the record card, 💾 saves to My Library. ⬇/⬆ Export and import your library as a JSON file. 🤖 AI: pick sounds for me chooses six."],
    ["🎚️ Studio Equipment", "Every equipment record carries real instrument and mic patch lists — exactly how to route it. 🤖 AI: recommend my rig assembles a mic/interface/monitor rig."],
    ["🥁 AI Beat Maker", "Describe the beat, pick a genre or type “drake type beat” (original Signature composition in the style of — never affiliated, no real melodies copied), set tempo (60–180 BPM) and bars (1–16). The 16-step lane grid is clickable — your tweaks re-render the beat. ⬇ .wav and ⬇ Pattern JSON (the full machine-readable step record)."],
    ["✍️ Auto Song Writer", "Theme + genre + mood → a full stamped JAH-SONG record: title, lyrics, chord chart, structure, tempo, key — or render it to a playable demo mix."],
    ["🎧 Song Walkthrough", "The guided path: one plain-language question per screen (genre, sounds, rhythm, bass, snare, drums, chorus, ending, lyrics, voice, backups, master). Every screen has an “🤖 AI finish my song” button. Always builds the 5:00 standard."],
    ["🎛️ Studio Session (7 stages)", "The full process as stages: 1 sounds, 2 beat, 3 lyrics, 4 vocals, 5 mix, 6 filters, 7 CD. The AI pal answers questions about any stage and can auto-complete your project (“take over”). The Cakewalk-type DAW popup gives multitrack lanes, transport, mixer, and mic recording."],
    ["🤖 AI Addons", "Six specialist AIs: Arrangement, Groove, Melody & Harmony, Vocal Coach, Mastering, Finisher. Each opens the walkthrough at its step."],
    ["🎤 Vocal Studio", "Four created voices (Nova, Ember, Drift, Stone — all synthesized) or your own: record (needs mic permission) or upload (10 MB cap). Tick the voice-privacy consent box first — your sample never leaves this browser. 🎤 Sing it renders your lyrics onto a melody. Every render reports duration, sample rate, peak dBFS, and clipping honestly."],
    ["🎶 Backup Singers", "Choir, harmonies, ad-libs and more — add types to your spec and ▶ Hear them."],
    ["✨ Vocal Cleanup", "Upload vocals: AI cleans (de-rumble, de-hiss, compression, normalize) or 🎤 AI: Re-sing it clean (detects your melody, sings it back with the Nova synth voice)."],
    ["💿 Make a CD", "Add song IDs (or “Add my latest AI song”), name the album and artist, 💿 Render my CD. You get a .zip: CD-quality 44.1 kHz/16-bit stereo .wav of all tracks, a cue sheet with track starts, and a burning guide tailored to whether your system has a burner. Tracks play right on the page. Browsers can't drive a burner directly — the page prepares everything, your burner software burns it."],
    ["🎓 Music Teacher AI", "Ask plain-language music questions — answers are grounded in the studio's own knowledge, with 🔊 read-aloud."],
    ["📀 Song Archive · 🥁 Beat Archive", "The full archives: songs and beats, searchable, filterable, sortable, A–Z browsable, one-tap play on every card, Open → for the full record page (?song= / ?beat= deep links)."],
    ["🔎 Finder AI", "One box: type a word, get the top 5 matches with ▶ Play right in the results and Take me there → to the record. If audio is blocked it says so plainly instead of faking playback."],
    ["📊 Archive counts", "The 📊 Archive counts drawer shows live totals vs the 1,000,000 goals, stamped from music-manifest.json (the single source of truth). States: ⏳ LOADING, 🟢 LIVE, 🟡 CACHED (last saved copy), 📴 OFFLINE, 🔴 INDEX ERROR — always with a ↻ Retry button."],
    ["🔊 Read-aloud & honesty", "Every sound on this site is synthesized live in your browser with the Web Audio API — no samples. All voices are synthesized; there are no human singers here. If a browser blocks audio or lacks Web Audio, the studio says so in plain words and keeps working where it can."]
  ];

  /* ---------- styles (existing palette only) ---------- */
  var cssDone = false;
  function ensureCSS() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement("style"); st.id = "sigtour-css";
    st.textContent =
      ".sigtour-ring{position:fixed;z-index:99988;border:3px solid var(--gold,#f5c542);border-radius:12px;box-shadow:0 0 0 4000px rgba(10,6,18,.55),0 0 24px rgba(245,197,66,.6);pointer-events:none;transition:all .25s}" +
      ".sigtour-tip{position:fixed;z-index:99989;left:50%;transform:translateX(-50%);bottom:18px;max-width:560px;width:calc(100vw - 32px);background:var(--panel,#241d38);border:2px solid var(--gold,#f5c542);border-radius:14px;padding:16px 18px;color:var(--ink,#f2ecdf);box-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:auto;max-height:62vh;overflow:auto}" +
      ".sigtour-tip h3{margin:0 0 8px;color:var(--gold,#f5c542);font-size:18px}" +
      ".sigtour-tip p{margin:6px 0;font-size:14px;line-height:1.45}" +
      ".sigtour-tip p b{color:var(--teal,#4fe3c1)}" +
      ".sigtour-btns{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}" +
      ".sigtour-btns .btn{min-height:44px;min-width:88px}" +
      ".sigtour-dots{color:var(--mut,#b9aec9);font-size:12px;margin-top:8px}" +
      "#sigtour-guidebtn{position:fixed;z-index:99987;left:16px;bottom:16px;width:52px;height:52px;border-radius:50%;font-size:24px;padding:0;line-height:1;box-shadow:0 4px 18px rgba(0,0,0,.5)}";
    document.head.appendChild(st);
  }

  var ring = null, tip = null, ix = 0, open = false;
  function el(tag, cls, html) {
    var d = document.createElement(tag || "div");
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function killTour() {
    open = false;
    if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
    if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
    ring = tip = null;
    document.removeEventListener("keydown", onKey);
    try { PS.set(SEEN, "1"); } catch (e) {}
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === "Escape") { killTour(); }
    else if (e.key === "ArrowRight") { step(ix + 1); }
    else if (e.key === "ArrowLeft") { step(ix - 1); }
  }
  function place() {
    if (!open || !ring || !tip) return;
    var t = document.querySelector(STEPS[ix].sel), r;
    if (!t) { step(ix + 1); return; }
    try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    setTimeout(function () {
      if (!open) return;
      r = t.getBoundingClientRect();
      ring.style.left = Math.max(4, r.left - 8 + window.scrollX * 0) + "px";
      ring.style.top = Math.max(4, r.top - 8) + "px";
      ring.style.width = Math.max(40, r.width + 16) + "px";
      ring.style.height = Math.max(40, r.height + 16) + "px";
    }, 60);
  }
  function step(i) {
    if (i < 0) i = 0;
    if (i >= STEPS.length) { killTour(); return; }
    ix = i; open = true;
    var s = STEPS[ix];
    ensureCSS();
    if (!ring) { ring = el("div", "sigtour-ring"); ring.setAttribute("aria-hidden", "true"); document.body.appendChild(ring); }
    if (!tip) { tip = el("div", "sigtour-tip"); tip.setAttribute("role", "dialog"); tip.setAttribute("aria-label", "Studio tour"); document.body.appendChild(tip); }
    var last = ix === STEPS.length - 1, first = ix === 0;
    tip.innerHTML =
      "<h3>🌟 " + esc(s.title) + "</h3>" +
      "<p><b>WHAT:</b> " + esc(s.what) + "</p>" +
      "<p><b>WHAT IT DOES:</b> " + esc(s.does) + "</p>" +
      "<p><b>HOW:</b> " + esc(s.how) + "</p>" +
      '<div class="sigtour-btns">' +
      (first ? '<button class="btn big" data-t="start" type="button">▶ Start the tour</button>' : "") +
      (first ? "" : '<button class="btn ghost" data-t="back" type="button">← Back</button>') +
      (last ? '<button class="btn big" data-t="done" type="button">✓ Done</button>'
            : (first ? "" : '<button class="btn" data-t="next" type="button">Next →</button>')) +
      '<button class="btn ghost" data-t="skip" type="button">Skip tour</button>' +
      "</div>" +
      '<div class="sigtour-dots">Step ' + (ix + 1) + " of " + STEPS.length + " · Esc closes · ← → move</div>";
    Array.prototype.forEach.call(tip.querySelectorAll("[data-t]"), function (b) {
      b.onclick = function () {
        var a = b.getAttribute("data-t");
        if (a === "start" || a === "next") step(ix + 1);
        else if (a === "back") step(ix - 1);
        else killTour();
      };
    });
    document.removeEventListener("keydown", onKey);
    document.addEventListener("keydown", onKey);
    place();
  }
  function startTour() { ix = 0; step(0); }
  window.__studioTour = startTour;
  window.__openStudioTour = startTour;

  /* ---------- permanent guide ---------- */
  function openGuide() {
    ensureCSS();
    var h = '<div style="max-height:60vh;overflow:auto">' +
      GUIDE_SECTIONS.map(function (g) {
        return '<h4 style="color:var(--gold,#f5c542);margin:14px 0 4px">' + esc(g[0]) + "</h4>" +
          '<p style="margin:0 0 6px;font-size:14px;line-height:1.5">' + esc(g[1]) + "</p>";
      }).join("") +
      '<p class="seqlab" style="margin-top:14px">Missed the walkthrough? <button class="btn ghost" id="sigguide-tour" type="button" style="min-height:44px">🌟 Replay the 1-minute tour</button></p></div>';
    if (window.__openModal) {
      var body = window.__openModal("📖 Studio guide — every feature, plainly", h, true);
      var rb = document.getElementById("sigguide-tour");
      if (rb) rb.onclick = function () { if (window.__closeModal) window.__closeModal(); setTimeout(startTour, 150); };
    } else {
      alert("Studio guide: " + GUIDE_SECTIONS.map(function (g) { return g[0] + " — " + g[1]; }).join("\n\n"));
    }
  }
  window.__openStudioGuide = openGuide;

  var guideBtnDone = false;
  function injectGuideBtn() {
    if (guideBtnDone) return; guideBtnDone = true;
    ensureCSS();
    var b = el("button", "btn");
    b.id = "sigtour-guidebtn"; b.type = "button";
    b.textContent = "?"; b.setAttribute("aria-label", "Open the studio guide");
    b.title = "Studio guide";
    b.onclick = openGuide;
    document.body.appendChild(b);
  }

  /* ---------- boot ---------- */
  function boot() {
    injectGuideBtn();
    var seen = false, deeplink = false;
    try { seen = !!PS.get(SEEN); } catch (e) {}
    try { deeplink = /[?&](song|sound|gear|beat)=/.test(location.search); } catch (e2) {}
    if (!seen && !deeplink) {
      setTimeout(function () {
        try { if (!PS.get(SEEN)) startTour(); } catch (e3) {}
      }, 1200);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
