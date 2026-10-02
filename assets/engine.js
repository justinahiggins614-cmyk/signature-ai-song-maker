/* ============================================================
   SigData — deterministic record engine for
   The Signature Song Maker AI.
   ID schemes: JAH-SONG-###### / JAH-SOUND-###### / JAH-GEAR-######
   Same seed -> same record, forever. All content original.
   ============================================================ */
(function (root) {
  "use strict";
  var S = root.SigSynth;

  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }
  /* 7-digit IDs: the catalogs march to 1,000,000, so 6 digits are not enough. */
  var songId = function (n) { return "JAH-SONG-" + pad(n, 7); };
  var soundId = function (n) { return "JAH-SOUND-" + pad(n, 7); };
  var gearId = function (n) { return "JAH-GEAR-" + pad(n, 7); };

  /* ---------- word pools (all original phrasing) ---------- */
  var TITLE_A = ["Neon", "Velvet", "Copper", "Midnight", "Amber", "Silver", "Crimson", "Golden", "Electric", "Quiet", "Paper", "Static", "Hollow", "Bright", "Distant", "Wild", "Slow", "Restless", "Patient", "Bold"];
  var TITLE_B = ["Highway", "River", "Static", "Morning", "Engine", "Lantern", "Compass", "Harbor", "Wire", "Garden", "Signal", "Horizon", "Thunder", "Meadow", "Orbit", "Flame", "Echo", "Tide", "Summit", "Drift"];
  var LYRIC_OPEN = ["Woke up with the sunrise in my pocket", "The city hums a tune I almost know", "Dust on the dashboard, miles to go", "Your laughter lingers in the hallway", "Streetlights painting shadows on the wall", "I found a melody in the rain", "The radio static sounds like home", "Barefoot summer on a wooden floor", "We chased the daylight down the coast", "Old guitar leaning by the door"];
  var LYRIC_MID = ["And every road keeps calling out my name", "So sing it louder than the thunder", "We are golden in the afterglow", "Hold the night, don't let it go", "The rhythm of the wheels keeps time", "Whisper secrets to the open sky", "Dance until the morning breaks", "Every heartbeat finds its rhyme", "We rise like smoke into the blue", "The chorus carries me to you"];
  var LYRIC_END = ["And the song goes on and on", "Forever in this melody", "We will remember this refrain", "The music never fades away", "Sing it back to me again", "Underneath the same old stars", "This is where we belong", "The night is ours to keep", "Let the harmony remain", "We are the song we sing"];
  var GENRE_LIST = S.GENRES;
  var MOOD_LIST = S.MOODS;

  function genSong(n) {
    var rng = S.rngFrom("songrec:" + n), id = songId(n);
    var title = S.pick(rng, TITLE_A) + " " + S.pick(rng, TITLE_B);
    var genre = S.pick(rng, GENRE_LIST), mood = S.pick(rng, MOOD_LIST);
    var tempo = 70 + Math.floor(rng() * 70), keyIx = Math.floor(rng() * 12);
    var keyName = S.noteName(48 + keyIx).replace(/[0-9-]/g, "") + (rng() < 0.7 ? " major" : " minor");
    var v1 = S.pick(rng, LYRIC_OPEN), v2 = S.pick(rng, LYRIC_OPEN);
    var c1 = S.pick(rng, LYRIC_MID), c2 = S.pick(rng, LYRIC_MID), e = S.pick(rng, LYRIC_END);
    while (v2 === v1) v2 = S.pick(rng, LYRIC_OPEN);
    while (c2 === c1) c2 = S.pick(rng, LYRIC_MID);
    var lyrics = "[Verse 1]\n" + v1 + "\n" + v2 + "\n\n[Chorus]\n" + c1 + "\n" + c2 + "\n\n[Verse 2]\n" + v2 + "\n" + v1 + "\n\n[Chorus]\n" + c1 + "\n" + c2 + "\n\n[Outro]\n" + e;
    var progBank = [[0, 5, 3, 4], [0, 4, 5, 3], [5, 3, 0, 4], [1, 4, 0, 5]][Math.floor(rng() * 4)];
    var chords = progBank.map(function (d) { return S.noteName(48 + keyIx + d).replace(/[0-9-]/g, ""); }).join(" - ");
    var structure = "Intro (4 bars) / Verse (16) / Chorus (16) / Verse (16) / Chorus (16) / Bridge (8) / Chorus (16) / Outro (4)";
    var desc = "A " + mood + " " + genre + " song at " + tempo + " BPM in " + keyName + ", written by the Signature song engine.";
    return { id: id, kind: "song", n: n, title: title, genre: genre, mood: mood, tempo: tempo, key: keyName, lyrics: lyrics, chords: chords, structure: structure, desc: desc };
  }

  /* ---------- sound library ---------- */
  var SOUND_TYPES = [
    ["Deep Kick", "drum", "kick"], ["Punchy Kick", "drum", "kick"], ["Soft Kick", "drum", "kick"],
    ["Crack Snare", "drum", "snare"], ["Rim Snare", "drum", "snare"], ["Brush Snare", "drum", "snare"],
    ["Closed Hat", "drum", "hat"], ["Open Hat", "drum", "hat"], ["Shaker Loop", "drum", "shaker"],
    ["Hand Clap", "drum", "clap"], ["Low Tom", "drum", "tom"], ["High Tom", "drum", "tom"],
    ["Sub Bass", "bass", "sub"], ["Saw Bass", "bass", "bass"], ["Funk Bass", "bass", "bass"], ["Reese Bass", "bass", "bass"],
    ["Grand Keys", "keys", "keys"], ["Rhodes Keys", "keys", "epiano"], ["Toy Piano", "keys", "keys"], ["Music Box", "keys", "marimba"],
    ["Nylon Pluck", "pluck", "pluck"], ["Sitar Pluck", "pluck", "pluck"], ["Harp Gliss", "pluck", "koto"],
    ["String Ensemble", "strings", "strings"], ["Solo Cello", "strings", "strings"], ["Pizzicato", "strings", "pluck"],
    ["Brass Stab", "brass", "brass"], ["Soft Horns", "brass", "brass"], ["Trumpet Lead", "lead", "brass"],
    ["Analog Pad", "pad", "pad"], ["Choir Pad", "pad", "pad"], ["Glass Pad", "pad", "pad"],
    ["Saw Lead", "lead", "lead"], ["Flute Lead", "lead", "flute"], ["Whistle Lead", "lead", "flute"],
    ["Bamboo Flute", "world", "flute"], ["Koto String", "world", "koto"], ["Marimba Bar", "world", "marimba"], ["Steel Drum", "world", "marimba"],
    ["Riser FX", "fx", "riser"], ["Impact Hit", "fx", "impact"], ["Vinyl Crackle", "fx", "vinyl"], ["Tape Hiss", "fx", "vinyl"]
  ];
  var SOUND_CATS = ["drum", "bass", "keys", "pluck", "strings", "brass", "pad", "lead", "world", "fx"];
  /* The library marches to 1,000,000: every record is an individual sound,
     an instrument, a sound set, or a sound pack — "all options covered". */
  var LIB_SUBTYPES = ["sound", "instrument", "set", "pack"];
  var SET_NAMES = ["Starter", "Studio", "Stage", "Midnight", "Neon", "Voyager", "Analog", "Digital", "Acoustic", "Electric", "Cosmic", "Urban"];
  function genSound(n) {
    var rng = S.rngFrom("soundrec:" + n), id = soundId(n);
    var subtype = LIB_SUBTYPES[n % LIB_SUBTYPES.length];
    var base = SOUND_TYPES[Math.floor(rng() * SOUND_TYPES.length)];
    var variant = ["I", "II", "III", "IV", "V"][Math.floor(rng() * 5)];
    var name, desc;
    var bright = Math.floor(rng() * 100), warm = Math.floor(rng() * 100), attack = (rng() * 0.4).toFixed(2);
    if (subtype === "sound") {
      name = "Signature " + base[0] + " " + variant;
      desc = "A " + base[1] + "-family synthesized sound (" + base[2] + " voice). Brightness " + bright + "/100, warmth " + warm + "/100, attack " + attack + "s. Preview and download as .wav.";
    } else if (subtype === "instrument") {
      name = "Signature " + base[0] + " Instrument " + variant;
      desc = "A playable " + base[1] + "-family instrument built on the " + base[2] + " voice engine. Full velocity response, " + (2 + Math.floor(rng() * 5)) + "-octave range. Ready for songs.";
    } else if (subtype === "set") {
      name = "Signature " + S.pick(rng, SET_NAMES) + " " + base[1] + " Set " + variant;
      desc = "A curated sound set: " + (4 + Math.floor(rng() * 9)) + " " + base[1] + "-family sounds sharing one mix character. Load the whole set into any song.";
    } else {
      name = "Signature " + S.pick(rng, SET_NAMES) + " " + base[1] + " Pack " + variant;
      desc = "A sound pack for song makers: " + (12 + Math.floor(rng() * 25)) + " " + base[1] + "-family sounds, loops, and one-shots, all mix-ready.";
    }
    return { id: id, kind: "sound", subtype: subtype, n: n, name: name, cat: base[1], voice: base[2], bright: bright, warm: warm, attack: attack, desc: desc };
  }

  /* ---------- studio equipment ---------- */
  var GEAR = [
    ["instrument", "Signature Parlor Acoustic Guitar", "Six-string dreadnought-style acoustic, solid top, warm midrange."],
    ["instrument", "Signature Stage Electric Guitar", "Dual-coil electric, maple neck, stage-ready output."],
    ["instrument", "Signature Upright Piano", "88-key weighted upright with felted hammers."],
    ["instrument", "Signature Synth Workstation", "61-key workstation, 400 onboard synthesized voices."],
    ["instrument", "Signature Drum Shell Pack", "Five-piece shell pack, birch shells, 22-inch kick."],
    ["instrument", "Signature Violin Outfit", "4/4 violin with bow, rosin, and shaped case."],
    ["instrument", "Signature Tenor Saxophone", "Brass body, high-F# key, leather pads."],
    ["instrument", "Signature Trumpet", "Bb trumpet, monel valves, lacquered brass."],
    ["instrument", "Signature Flute", "Closed-hole C flute, silver-plated body."],
    ["instrument", "Signature Bass Guitar", "Four-string long-scale electric bass."],
    ["mic", "Signature SM-1 Dynamic Mic", "Cardioid dynamic for vocals and amps, handles high SPL."],
    ["mic", "Signature CM-2 Condenser Mic", "Large-diaphragm condenser for studio vocals."],
    ["mic", "Signature RM-3 Ribbon Mic", "Figure-8 ribbon for room and brass warmth."],
    ["mic", "Signature DM-4 Drum Mic Kit", "Seven-piece drum mic set with clips and mounts."],
    ["preamp", "Signature PA-1 Mic Preamp", "Two-channel clean preamp, 60 dB gain, phantom power."],
    ["preamp", "Signature PA-2 Tube Preamp", "Single-channel tube preamp with drive control."],
    ["interface", "Signature IO-8 Audio Interface", "Eight-input USB interface, 24-bit/192 kHz."],
    ["interface", "Signature IO-2 Portable Interface", "Two-input bus-powered interface for travel rigs."],
    ["monitor", "Signature NM-5 Studio Monitors", "Five-inch nearfields, matched pair."],
    ["monitor", "Signature NH-1 Headphones", "Closed-back tracking headphones."],
    ["patch", "Signature Patch-16 Patch Bay", "Sixteen-point balanced patch bay, normalled rows."],
    ["patch", "Signature Cable Kit", "Twenty-four balanced cables, color-coded."],
    ["processor", "Signature EQ-4 Parametric EQ", "Four-band parametric equalizer."],
    ["processor", "Signature CP-2 Compressor", "Two-channel VCA compressor with sidechain."],
    ["processor", "Signature RV-1 Reverb Unit", "Studio reverb with plate, hall, and room modes."]
  ];
  function genGear(n) {
    var rng = S.rngFrom("gearrec:" + n), id = gearId(n);
    var base = GEAR[n % GEAR.length], rev = Math.floor(n / GEAR.length) + 1;
    var name = base[1] + (rev > 1 ? " Mk " + rev : "");
    var patch = "Patch guide: " + name + " -> " + S.pick(rng, ["Patch-16 top row", "Patch-16 bottom row", "direct to interface"]) + " -> " + S.pick(rng, ["PA-1 preamp", "PA-2 tube preamp", "straight to IO-8"]) + " -> IO-8 input " + (1 + Math.floor(rng() * 8)) + ". Set gain so peaks hit -12 dB.";
    var desc = base[2] + " " + patch;
    return { id: id, kind: "gear", n: n, name: name, cat: base[0], desc: desc, patch: patch };
  }

  function gen(kind, n) {
    if (kind === "song") return genSong(n);
    if (kind === "sound") return genSound(n);
    return genGear(n);
  }

  root.SigData = { songId: songId, soundId: soundId, gearId: gearId, gen: gen, genSong: genSong, genSound: genSound, genGear: genGear, pad: pad };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));

/* Music teacher knowledge base — separate IIFE extending SigData. */
(function (root) {
  "use strict";
  /* ---------- music teacher knowledge base (original text, site-grounded) ---------- */
  var THEORY = [
    { k: ["tempo", "bpm", "speed"], t: "Tempo (BPM)", x: "Tempo is the speed of a song, measured in beats per minute (BPM). A slow ballad sits near 70 BPM, most pop songs live between 95 and 125 BPM, and fast dance music runs 128 BPM and up. On this site every song record lists its tempo, and the beat maker lets you set it before the AI arranges the beat." },
    { k: ["key", "scale", "major", "minor"], t: "Key and scale", x: "The key of a song is its home note — the note everything resolves to. A major key sounds bright, a minor key sounds darker. Every song on this site is written in a named key (for example C major) and its chords and melody are built from that key's scale, so nothing ever clashes." },
    { k: ["chord", "harmony", "progression"], t: "Chords and progressions", x: "A chord is three or more notes played together. Songs move through chord progressions — for example C - G - Am - F. Each song record on this site lists its chord chart, and the demo mix plays the chords on pads and bass so you can hear the movement." },
    { k: ["verse", "chorus", "bridge", "structure", "song form"], t: "Song structure", x: "Most songs follow a form: intro, verse (tells the story), chorus (the big repeatable hook), bridge (a contrasting section), and outro. Every JAH-SONG record on this site lists its full structure in bars, and the rendered mix follows it section by section." },
    { k: ["beat", "drum", "rhythm", "groove"], t: "Beats and rhythm", x: "A beat is the drum pattern that drives a song. The AI Beat Maker builds 16-step patterns: kick, snare, hats, and percussion placed on a grid. Different genres place them differently — house puts the kick on every quarter note, hip-hop swings it. Ask the beat maker for a genre and mood and it arranges one deterministically." },
    { k: ["melody"], t: "Melody", x: "The melody is the tune you sing. On this site melodies are written from the song's chord tones (the 1st, 3rd, and 5th notes of each chord) plus small steps between them, so the tune always fits the chords underneath." },
    { k: ["bass"], t: "Bass", x: "The bass plays the low notes — usually the root of each chord. It glues the drums to the chords. In every demo mix the bass follows the chord roots one octave down." },
    { k: ["vocal", "sing", "voice"], t: "Vocals on this site", x: "All voices on this site are synthesized by the Signature Vocal Synth — formant-filtered oscillators with vibrato, never recordings of human singers. You can pick a created voice (Nova, Ember, Drift, Stone), add backup singer types, or resynthesize your own recorded sample onto a melody." },
    { k: ["backup", "harmony", "choir", "adlib", "ad-lib"], t: "Backup singers", x: "Backup singers sing harmony around the lead vocal. This site offers soprano (octave shimmer), alto (warm third above), tenor (mid harmony), bass (low octave), choir stacks (full detuned unison), and ad-libs (seeded improvised riffs). Select types to spec and they are added to the song's mix." },
    { k: ["clean", "cleanup", "pitch", "noise"], t: "Vocal cleanup", x: "Vocal cleanup on this site does three honest things: it removes low rumble and hiss, evens out the volume with compression, and normalizes the level. The 're-sing clean' option detects your melody's pitches and has the vocal synth sing the same melody back cleanly. It cannot restore a badly clipped recording — record with peaks near -12 dB." },
    { k: ["mix", "master", "eq", "compressor", "reverb"], t: "Mixing basics", x: "Mixing means balancing every sound: set levels so nothing clips, use EQ to give each instrument its own space, compress the vocals so they sit steady, and add a little reverb for room. Every demo mix on this site is pre-balanced; download the .wav and finish it in your own software." },
    { k: ["mic", "microphone", "patch", "preamp", "interface"], t: "Mics and patching", x: "A microphone turns sound into electricity, a preamp boosts it, and an interface turns it into digital audio. Patching is the routing: instrument -> mic -> preamp -> interface input. Every equipment record on this site carries a real patch guide telling you exactly which row and input to use." },
    { k: ["cd", "disc", "burn"], t: "Making a CD", x: "The Make-a-CD flow renders your picked songs to CD-quality audio (44,100 Hz, 16-bit stereo), builds a cue sheet that marks each track, and packages everything into a disc image download with step-by-step burning instructions. Browsers cannot drive a CD burner directly, so you burn the image with your own burner software — the guide walks you through it." },
    { k: ["wav", "download", "format", "audio file"], t: "Downloads", x: "Beats, mixes, vocals, and previews on this site download as .wav files (44,100 Hz, 16-bit) — the same quality CDs use. Song specs download as .txt and .json." },
    { k: ["collab", "collaboration", "ai help", "together"], t: "Three ways to make music", x: "Every studio section offers three modes: make it yourself (you set every control), let the AI make it (one click generates a finished result from a seed), or collaborate (the AI drafts and you adjust). Switch modes any time." }
  ];
  function teach(question) {
    var q = String(question || "").toLowerCase(), best = null, bestScore = 0, i, j;
    for (i = 0; i < THEORY.length; i++) {
      var score = 0, e = THEORY[i];
      for (j = 0; j < e.k.length; j++) if (q.indexOf(e.k[j]) !== -1) score += e.k[j].length;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best && bestScore >= 3) return { title: best.t, text: best.x, covered: true };
    return { title: "Not covered yet", text: "The music teacher only answers from this site's own studio data — music theory basics, the sound library, the equipment catalog, and song records. That question isn't covered yet. Try asking about tempo, chords, beats, vocals, backup singers, mixing, mics, or making a CD.", covered: false };
  }

  root.SigData.THEORY = THEORY;
  root.SigData.teach = teach;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));

/* Beat archive — separate IIFE extending SigData + SigSynth.
   ALL beats are ORIGINAL Signature compositions. "Vintage-era" records are
   original beats IN THE STYLE OF classic eras — never copies of any real,
   copyrighted song, lyrics, or melody. Public-domain material only where it
   genuinely applies (none is needed: everything here is generated fresh). */
(function (root) {
  "use strict";
  var S = root.SigSynth, D = root.SigData;

  var BEAT_ERAS = [
    { key: "50s-rocknroll", name: "50s rock-and-roll style", bpm: [150, 180], note: "driving backbeat shuffle feel of the 1950s rock-and-roll era" },
    { key: "60s-soul", name: "60s soul style", bpm: [90, 112], note: "warm pocket groove of the 1960s soul era" },
    { key: "70s-funk", name: "70s funk style", bpm: [95, 115], note: "syncopated party groove of the 1970s funk era" },
    { key: "80s-synthpop", name: "80s synth-pop style", bpm: [110, 130], note: "four-on-the-floor machine groove of the 1980s synth-pop era" },
    { key: "90s-boombap", name: "90s boom-bap style", bpm: [85, 96], note: "dusty head-nod groove of the 1990s boom-bap era" },
    { key: "00s-crunk", name: "00s crunk style", bpm: [65, 76], note: "rowdy call-and-response energy of the 2000s crunk era" }
  ];
  var BEAT_ADJ = ["Neon", "Velvet", "Copper", "Midnight", "Amber", "Silver", "Crimson", "Golden", "Electric", "Quiet", "Paper", "Static", "Hollow", "Bright", "Distant", "Wild", "Slow", "Restless", "Patient", "Bold", "Smoky", "Chrome"];
  function pad7(n) { n = String(n); while (n.length < 7) n = "0" + n; return n; }
  var beatId = function (n) { return "JAH-BEAT-" + pad7(n); };

  function genBeat(n) {
    var rng = S.rngFrom("beatrec:" + n), id = beatId(n);
    var useEra = rng() < 0.45, style, bpm, eraNote = "";
    if (useEra) {
      var era = BEAT_ERAS[Math.floor(rng() * BEAT_ERAS.length)];
      style = era.key; eraNote = era.note;
      bpm = era.bpm[0] + Math.floor(rng() * (era.bpm[1] - era.bpm[0]));
    } else {
      style = S.GENRES[Math.floor(rng() * S.GENRES.length)];
      bpm = 70 + Math.floor(rng() * 70);
    }
    var name = "Signature " + S.pick(rng, BEAT_ADJ) + " " + style.replace(/-/g, " ") + " Beat " + ["I", "II", "III", "IV", "V"][Math.floor(rng() * 5)];
    var desc = "An ORIGINAL Signature beat in the " + (useEra ? eraNote : style + " genre") +
      ", " + bpm + " BPM. Same request always makes this beat. Not a copy of any real song — every note generated fresh by the Signature engine.";
    return { id: id, kind: "beat", n: n, name: name, style: style, bpm: bpm, era: useEra, desc: desc };
  }

  /* era patterns hook into the shared pattern builder */
  var _origPatternFor = S.patternFor;
  function eraSteps(pat, era, rng) {
    var i, on = function (arr, steps) { var s; for (s = 0; s < steps.length; s++) arr[steps[s] % 16] = 1; };
    for (i = 0; i < 16; i++) { pat.kick[i] = 0; pat.snare[i] = 0; pat.hat[i] = 0; pat.clap[i] = 0; pat.tom[i] = 0; pat.shaker[i] = 0; }
    switch (era) {
      case "50s-rocknroll": on(pat.kick, [0, 8]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i += 2) pat.hat[i] = 1; on(pat.shaker, [2, 6, 10, 14]); break;
      case "60s-soul": on(pat.kick, [0, 7, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i += 2) pat.hat[i] = 1; on(pat.clap, [12]); break;
      case "70s-funk": on(pat.kick, [0, 3, 8]); on(pat.snare, [4, 12, 15]); for (i = 0; i < 16; i++) pat.hat[i] = 1; on(pat.clap, [12]); break;
      case "80s-synthpop": on(pat.kick, [0, 4, 8, 12]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = 1; on(pat.clap, [4, 12]); on(pat.tom, [14]); break;
      case "90s-boombap": on(pat.kick, [0, 7, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i += 2) pat.hat[i] = (rng() < 0.8 ? 1 : 0); break;
      case "00s-crunk": on(pat.kick, [0, 6, 10]); on(pat.snare, [8]); for (i = 0; i < 16; i++) pat.hat[i] = 1; on(pat.clap, [8]); break;
      default: return false;
    }
    return true;
  }
  S.patternFor = function (prompt, genre, bpm) {
    var eraKeys = {}, i;
    for (i = 0; i < BEAT_ERAS.length; i++) eraKeys[BEAT_ERAS[i].key] = 1;
    if (eraKeys[genre]) {
      var rng = S.rngFrom(String(prompt || "untitled") + "|" + genre + "|" + bpm);
      var pat = { kick: [], snare: [], hat: [], clap: [], tom: [], shaker: [] };
      eraSteps(pat, genre, rng);
      return { genre: genre, bpm: bpm, steps: pat, seed: String(prompt) + "|" + genre + "|" + bpm };
    }
    return _origPatternFor(prompt, genre, bpm);
  };

  D.BEAT_ERAS = BEAT_ERAS;
  D.beatId = beatId;
  D.genBeat = genBeat;
  D.BEAT_STYLES = S.GENRES.concat(BEAT_ERAS.map(function (e) { return e.key; }));
  /* patch the main dispatcher (defined in the earlier IIFE) to route beats */
  var _origGen = D.gen;
  D.gen = function (kind, n) { return kind === "beat" ? genBeat(n) : _origGen(kind, n); };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));
