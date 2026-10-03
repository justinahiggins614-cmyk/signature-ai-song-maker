/* ============================================================
   Signature Music Studio — Studio Session (part 6):
   guided 7-stage song process, Cakewalk-type DAW popup with
   mic recording, mix/master, filters, CD tagging, AI pal,
   per-genre beat guides.
   ============================================================ */
(function () {
  "use strict";
  var S = window.__S, D = window.__D, $ = window.__$, esc = window.__esc, dl = window.__dl,
      readAloud = window.__readAloud,
      openModal = window.__openModal, closeModal = window.__closeModal;

  /* ---------- project state (persisted draft) ---------- */
  var PKEY = "sigstudio.project.v1";
  function freshProject() {
    return { sounds: [], beat: null, instruments: [], lyrics: "", song: null,
             vocal: { voice: "nova", backups: [] }, mix: { drums: 1, bass: 1, chords: 1, lead: 1, vocal: 1 },
             fx: [{ id: "glue" }, { id: "normalize" }], cd: { tracks: [], album: "", artist: "" },
             genre: "", bpm: 92, stage: 1, micBuf: null };
  }
  var PROJ = freshProject();
  try { var saved = JSON.parse(localStorage.getItem(PKEY) || "null"); if (saved && saved.stage) PROJ = saved; } catch (e) {}
  function saveProj() { try { localStorage.setItem(PKEY, JSON.stringify(PROJ, function (k, v) { return k === "micBuf" ? null : v; })); } catch (e) {} }
  window.__proj = function () { return PROJ; };

  /* ---------- per-genre beat-making guides (original content) ---------- */
  var GUIDES = [
    ["hip-hop", "85–100 BPM", "Kick on 1, the 'and' of 2, and 3½ · snare on 2 & 4 · swung hats", "Deep sub-bass following the kick", "Minor 7th stabs, soulful", "Leave space — the groove breathes between hits."],
    ["trap", "130–150 BPM", "Sparse kick · snare on 3 · rolling 16th/32nd hats", "Booming 808-style low end gliding between notes", "Dark minor pads or bells", "Hi-hat rolls are the signature — vary velocity."],
    ["drill", "140–150 BPM", "Kick pattern with slides · snare/clap on 3 · counter-melody hats", "Sliding low bass", "Ominous piano-style stabs", "Menace comes from sparseness, not layers."],
    ["rnb", "85–110 BPM", "Soft kick pocket · snare/clap on 2 & 4 · shaker swing", "Round warm bass, legato", "Jazzy 9th chords, Rhodes feel", "Silk, not force — keep drums gentle."],
    ["pop", "95–125 BPM", "Driving kick · big snare on 2 & 4 · sparkling hats", "Punchy mid bass", "I–V–vi–IV and friends", "Clarity wins — every element has its lane."],
    ["house", "120–130 BPM", "Four-on-the-floor kick · clap on 2 & 4 · offbeat hats", "Grooving offbeat bass", "Piano-house stabs", "The kick never stops — sidechain everything to it."],
    ["techno", "125–150 BPM", "Four-floor kick · driving hats · percussive synth stabs", "Rolling low-end pulse", "Hypnotic minor arps", "Repetition with tiny evolution."],
    ["rock", "110–140 BPM", "Kick 1 & 3½ · snare 2 & 4 · straight driving hats", "Bass doubles the guitar riff", "Power chords, big choruses", "Energy over precision — play it loud."],
    ["lofi", "70–90 BPM", "Lazy swung kick · soft snare · dusty hats", "Mellow sub, barely there", "Jazzy 7ths, vinyl warmth", "Imperfection is the aesthetic."],
    ["jazz", "90–140 BPM", "Spang-a-lang ride pattern · feathered kick", "Walking upright-style lines", "Extended harmony, ii–V–I", "Swing lives in the ride cymbal."],
    ["funk", "95–115 BPM", "Syncopated kick · snare cracks on 2 & 4 + ghost notes", "Rubbery syncopated bass is the star", "Clav-style stabs", "The one. Everything lands on the one."],
    ["drum-and-bass", "170–180 BPM", "Two-step: kick-snare-kick-snare at double feel", "Reese-style growling low end", "Dark pads, sparse", "Speed with weight — sub must be clean."],
    ["reggae", "75–95 BPM", "One-drop: kick+snare together on 3 · skanking hats", "Heartbeat melodic bass", "Offbeat bubble stabs", "The bass is the lead instrument."],
    ["afrobeats", "98–112 BPM", "Log-drum bounce · shaker-driven groove", "Bouncy melodic bass", "Sunny plucks", "Polyrhythm — three against two."],
    ["reggaeton", "90–100 BPM", "Dembow: kick 1, 2½, 4 · snare 2 & 4", "Dembow bass bounce", "Simple minor stabs", "The dembow loop is law."],
    ["dancehall", "100–108 BPM", "Kick on 1 · snare 2 & 4 · bubble rhythm", "Deep bubble bass", "Sparse riddim stabs", "Space for the vocal — riddim stays out of the way."],
    ["gospel", "95–120 BPM", "Stomping kick · thunderous claps · driving hats", "Church bass, joyful runs", "Triumphant piano-style chords", "Testify energy — build to the shout."],
    ["country", "90–120 BPM", "Boom-chicka: kick 1 & 3, snare 2 & 4", "Train-beat root-fifth bass", "Storyteller major chords", "The story leads; the band follows."],
    ["ambient", "60–90 BPM", "Barely-there pulse or none", "Deep drone sub", "Slow-evolving pads", "Texture over rhythm."]
  ];
  function openGuides() {
    var h = "<p>How to make every genre's beat — the Signature way. All original guidance.</p>";
    GUIDES.forEach(function (g) {
      h += '<div class="hit"><b>' + esc(g[0]) + '</b> <span class="seqlab">' + esc(g[1]) + '</span><br>' +
        "🥁 " + esc(g[2]) + "<br>🎸 " + esc(g[3]) + "<br>🎹 " + esc(g[4]) + "<br>💡 " + esc(g[5]) + "</div>";
    });
    openModal("📖 Beat-making guides — every genre", h, true);
  }
  window.__openGuides = openGuides;

  /* ---------- stage framework (live implementation in app6b.js) ---------- */

  /* ---------- AI pal ---------- */
  function palSay(t) { $("palsay").textContent = t; }
  window.__palSay = palSay;
  function palAnswer(q) {
    q = (q || "").toLowerCase();
    /* ---- pull up a specified track: "play JAH-SONG-000123" ---- */
    var idm = q.match(/jah-(song|beat)-(\d+)/);
    if (idm) {
      var tid = "JAH-" + idm[1].toUpperCase() + "-" + idm[2];
      if (window.__playTrack) window.__playTrack(tid);
      return "Pulling up " + tid + " — rendering it now, this takes a moment on a phone.";
    }
    /* ---- random tracks ---- */
    if (/random/.test(q) && /beat/.test(q)) { if (window.__playRandomTrack) window.__playRandomTrack("beat"); return "Rolling the dice — a random beat, coming up."; }
    if (/random/.test(q) && /song|track/.test(q)) { if (window.__playRandomTrack) window.__playRandomTrack("song"); return "Rolling the dice — a random song, coming up."; }
    /* ---- playlists ---- */
    if (/playlist|play list/.test(q) && window.__playPlaylist && window.__getIdx) {
      var idx = window.__getIdx(), pool = idx.filter(function (r) { return r[2] === "song"; });
      var gword = null;
      (S.GENRES || []).forEach(function (g) { if (q.indexOf(g) !== -1) gword = g; });
      if (gword) {
        var gp = pool.filter(function (r) { return (r[1] || "").toLowerCase().indexOf(gword) !== -1; });
        if (gp.length >= 3) pool = gp;
      }
      pool.sort(function (a, b) { var ma = /(\d+)$/.exec(a[0]), mb = /(\d+)$/.exec(b[0]); return (+(mb && mb[1])) - (+(ma && ma[1])); });
      var ids = pool.slice(0, 5).map(function (r) { return r[0]; });
      if (ids.length) { window.__playPlaylist(ids); return "Playlist rolling — " + ids.length + " tracks" + (gword ? " of " + gword : "") + ", playing back to back. Use Next ▶ or ■ Stop anytime."; }
      return "No songs in the index yet — make one first and I'll queue it.";
    }
    /* ---- best AI for the job: delegate to the right specialist addon ---- */
    if (/arrang|song structure|structure my/.test(q) && window.__openWalkStep) { window.__openWalkStep(1); return "🎼 Arrangement AI is on it — laying out your 5:00 standard: intro build-up, four 30-second chorus breaks, bridge beat-switch, your chosen ending."; }
    if (/drum pattern|groove|design.*drums|make.*drums/.test(q) && window.__openWalkStep) { window.__openWalkStep(3); return "🥁 Groove AI is on it — designing your drum pattern and placing every part: beginning, middle, end."; }
    if (/write.*melod|melod.*for|chord.*for|harmon/.test(q) && window.__openWalkStep) { window.__openWalkStep(4); return "🎹 Melody & Harmony AI is on it — writing the melody, chord voicings, and bass line in your song's key."; }
    if (/vocal coach|coach.*vocal|pick.*voice|choose.*voice/.test(q) && window.__openWalkStep) { window.__openWalkStep(11); return "🎤 Vocal Coach AI is on it — picking the voice, stacking the backup singers, writing the ad-libs."; }
    if (/master (my|this|the|it)|mix and master|mastering/.test(q) && window.__openWalkStep) { window.__openWalkStep(13); return "🎚️ Mastering AI is on it — balancing the mix and mastering it radio-ready."; }
    if (/finish.*song|complete.*song|finish it|do the rest/.test(q) && window.__openWalkStep) { window.__openWalkStep(-1); return "🤖 Finisher AI is on it — completing every remaining step from your seed."; }
    if (/take over|auto|finish|complete|do it all/.test(q)) { autoProject($("palq").value || "a great song"); return "On it — building your whole project now. Watch the stages light up."; }
    if (/stage 1|sound/.test(q)) return "Stage 1: tap the Sounds stage, browse A–Z, pop a file open with ▶, and hit 'Save to My Library' on the keepers.";
    if (/stage 2|beat/.test(q)) return "Stage 2: describe your beat — even 'gritty 90s boom-bap' or 'dark trap banger' works — then pick instruments from the popup.";
    if (/stage 3|lyric/.test(q)) return "Stage 3: use the song-search popup to borrow structure, or type lyrics and let the AI draft.";
    if (/stage 4|sing|vocal/.test(q)) return "Stage 4: pick a voice (created or your own), add backup singers, then clean up the vocal.";
    if (/stage 5|mix|master/.test(q)) return "Stage 5: ride the faders, then choose a master preset — Radio is the all-rounder.";
    if (/stage 6|filter|effect/.test(q)) return "Stage 6: tape for warmth, stage for space, radio for that broadcast voice. Stack up to a few.";
    if (/stage 7|cd|burn/.test(q)) return "Stage 7: order the tracks, name the album and artist — the cue sheet gets tagged.";
    if (/daw|cakewalk|studio popup/.test(q)) return "The DAW popup is the full multitrack studio: lanes, transport, mixer, and mic recording. Hit 'Open the DAW'.";
    if (/genre/.test(q)) return "Pick a genre anywhere you see the dropdown — or leave it open on 'Any — surprise me'. The beat guides popup teaches every genre's recipe.";
    return "I'm your studio pal — I guide the 7 stages or auto-complete the project. Try 'take over' or ask about any stage.";
  }
  window.__palAnswer = palAnswer;
  function autoProject(prompt) {
    try { S.unlockAudio(); } catch (e) {}
    palSay("Building: " + prompt + " …");
    var styleRef = D.parseStyleRequest ? D.parseStyleRequest(prompt) : null;
    var genre = styleRef ? styleRef.genre : (window.__resolveGenre ? window.__resolveGenre(prompt, "", D.BEAT_STYLES) : "hip-hop");
    var rng = S.rngFrom("autoproj:" + prompt.toLowerCase());
    var bpm = styleRef ? styleRef.bpm[0] + Math.floor(rng() * (styleRef.bpm[1] - styleRef.bpm[0])) : 85 + Math.floor(rng() * 40);
    PROJ.genre = genre; PROJ.bpm = bpm;
    PROJ.beat = { prompt: prompt, genre: genre, bpm: bpm, bars: 8, style: styleRef ? styleRef.name + " type" : null };
    var theme = prompt.replace(/type beat|type song/gi, "").trim() || prompt;
    PROJ.song = window.__writeSong ? window.__writeSong(theme, genre, styleRef ? styleRef.mood : undefined) : null;
    PROJ.lyrics = PROJ.song ? PROJ.song.lyrics : "";
    PROJ.vocal = { voice: "nova", backups: ["choir"] };
    PROJ.fx = [{ id: "glue" }, { id: "normalize" }, { id: "stage" }];
    saveProj();
    if (window.__aiLog) window.__aiLog("auto-project", "Built '" + (PROJ.song ? PROJ.song.title : "untitled") + "' (" + genre + ", " + bpm + " BPM): beat, song, lyrics, vocal=nova+choir, fx=glue/normalize/stage. Stages 1–4 marked done.");
    for (var s = 1; s <= 4; s++) if (window.__markDoneStage) window.__markDoneStage(s);
    if (window.__gotoStage) window.__gotoStage(5);
    palSay((styleRef ? "🎯 " + styleRef.name + " type — original Signature composition, not affiliated. " : "") +
      "Done! Beat at " + bpm + " BPM (" + genre.replace(/-/g, " ") + "), full song '" + (PROJ.song ? PROJ.song.title : "untitled") + "' with lead-in and beat switch, vocal + choir ready. Now: mix it (stage 5), filter it (stage 6), burn it (stage 7) — or open the DAW and press play.");
    // render a preview of the finished project
    renderProjectPreview();
  }
  window.__autoProject = autoProject;

  /* ---------- project preview render (beat + song + vocal skeleton) ---------- */
  function renderProjectPreview() {
    if (!PROJ.beat) return;
    palSay($("palsay").textContent + " Rendering preview…");
    var songLike = PROJ.song || { id: "preview:" + PROJ.beat.prompt, title: PROJ.beat.prompt, genre: PROJ.genre, tempo: PROJ.bpm };
    var fx = (PROJ.fx || []).map(function (f) { return { id: f.id }; });
    var mix = PROJ.mix;
    S.renderFullSong(songLike, mix, fx).then(function (buf) {
      try { S.unlockAudio(); } catch (e) {}
      S.playBuffer(buf, "session");
      palSay("Playing your project preview — full song with lead-in and beat switch. 🎶");
    }).catch(function (e) { palSay("Couldn't render the preview: " + e.message); });
  }
  window.__renderProjectPreview = renderProjectPreview;
})();
