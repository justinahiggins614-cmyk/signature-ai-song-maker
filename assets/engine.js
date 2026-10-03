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
  /* ---------- rhyming lyric engine lives in assets/lyrics.js ----------
     One theme per song, real rhyming couplets, one coherent story.
     (His order 2026-10-02: rhyme and make sense.) */

  function genSong(n, themeText) {
    var rng = S.rngFrom("songrec:" + n), id = songId(n);
    var title = S.pick(rng, TITLE_A) + " " + S.pick(rng, TITLE_B);
    var genre = S.pick(rng, S.GENRES), mood = S.pick(rng, S.MOODS);
    var tempo = 70 + Math.floor(rng() * 70), keyIx = Math.floor(rng() * 12);
    var keyName = S.noteName(48 + keyIx).replace(/[0-9-]/g, "") + (rng() < 0.7 ? " major" : " minor");
    var lw = root.SigData.writeLyrics ? root.SigData.writeLyrics(rng, themeText) : { lyrics: "[Verse 1]\nLa la\n\n[Chorus]\nLa la", theme: "untitled" };
    var lyrics = lw.lyrics;
    var progBank = [[0, 5, 3, 4], [0, 4, 5, 3], [5, 3, 0, 4], [1, 4, 0, 5]][Math.floor(rng() * 4)];
    var chords = progBank.map(function (d) { return S.noteName(48 + keyIx + d).replace(/[0-9-]/g, ""); }).join(" - ");
    var structure = "Intro (4 bars) / Verse (18) / Chorus (12) / Verse (18) / Chorus (12) / Bridge (12) / Chorus (12) / Chorus (12) / Outro (4)";
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
  /* ---------- "type beat" style references ----------
     Original sonic profiles keyed by well-known style names. A profile
     describes ONLY the sound: pattern genre, tempo range, mood, and a
     short sonic note. Same request -> same beat, forever. Results are
     always labeled original Signature compositions "in the style of" —
     never affiliated with or endorsed by the artist, never reproducing
     any copyrighted melody or lyrics. */
  var STYLE_REFS = [
    { name: "Nas", aka: ["nas"], genre: "90s-boombap", bpm: [85, 94], mood: "gritty", note: "dusty 90s New York boom-bap: hard head-nod drums, jazzy chop feel" },
    { name: "Jay-Z", aka: ["jay-z", "jay z", "jigga"], genre: "90s-boombap", bpm: [88, 98], mood: "smooth", note: "polished 90s boom-bap: soulful chops, confident pocket" },
    { name: "The Notorious B.I.G.", aka: ["notorious b.i.g.", "notorious big", "biggie", "biggie smalls"], genre: "90s-boombap", bpm: [88, 96], mood: "smooth", note: "mid-90s Bad-Boy-era bounce: plush drums, swagger pocket" },
    { name: "Wu-Tang Clan", aka: ["wu-tang clan", "wu tang", "wu-tang"], genre: "90s-boombap", bpm: [85, 95], mood: "gritty", note: "raw Shaolin-era boom-bap: grimy drums, minor-key menace" },
    { name: "A Tribe Called Quest", aka: ["a tribe called quest", "tribe called quest"], genre: "jazz", bpm: [90, 100], mood: "chill", note: "jazzy native-tongues bounce: warm electric-piano groove" },
    { name: "Outkast", aka: ["outkast"], genre: "funk", bpm: [90, 100], mood: "driving", note: "southern-fried funk bounce: rubbery bass, party drums" },
    { name: "Tupac", aka: ["tupac", "2pac"], genre: "90s-boombap", bpm: [90, 100], mood: "epic", note: "west-coast 90s bounce: anthemic drums, rolling groove" },
    { name: "J. Cole", aka: ["j. cole", "j cole"], genre: "hip-hop", bpm: [85, 95], mood: "chill", note: "soulful conscious-rap bounce: warm keys, steady pocket" },
    { name: "Kendrick Lamar", aka: ["kendrick lamar", "kendrick"], genre: "hip-hop", bpm: [88, 100], mood: "epic", note: "west-coast art-rap bounce: jazzy chords, hard drums" },
    { name: "Kanye West", aka: ["kanye west", "kanye", "ye"], genre: "hip-hop", bpm: [88, 100], mood: "epic", note: "soul-sample chipmunk-era bounce: pitched vocal-style chops" },
    { name: "Drake", aka: ["drake"], genre: "hip-hop", bpm: [90, 100], mood: "smooth", note: "late-night Toronto bounce: moody pads, minimal drums" },
    { name: "Future", aka: ["future"], genre: "trap", bpm: [130, 150], mood: "dark", note: "astronaut-status trap: rolling hats, booming low end" },
    { name: "Migos", aka: ["migos"], genre: "trap", bpm: [130, 150], mood: "driving", note: "triplet-flow trap: machine-gun hats, bouncing 808 feel" },
    { name: "Metro Boomin", aka: ["metro boomin", "metro boomin'"], genre: "trap", bpm: [140, 150], mood: "dark", note: "cinematic super-producer trap: dark bells, trunk-rattling low end" },
    { name: "Travis Scott", aka: ["travis scott", "travis"], genre: "trap", bpm: [130, 150], mood: "dreamy", note: "psychedelic rage-trap: hazy synths, rolling drums" },
    { name: "21 Savage", aka: ["21 savage"], genre: "trap", bpm: [140, 150], mood: "dark", note: "menacing minimal trap: sparse piano-style stabs, heavy low end" },
    { name: "Pop Smoke", aka: ["pop smoke"], genre: "drill", bpm: [140, 150], mood: "dark", note: "Brooklyn drill bounce: sliding low-end feel, sparse menace" },
    { name: "Beyoncé", aka: ["beyonce", "beyoncé"], genre: "rnb", bpm: [90, 110], mood: "epic", note: "queen-tier R&B: thunderous drums, stacked harmony feel" },
    { name: "The Weeknd", aka: ["the weeknd", "weeknd"], genre: "rnb", bpm: [95, 115], mood: "dark", note: "after-hours alt-R&B: moody synths, driving pulse" },
    { name: "SZA", aka: ["sza"], genre: "rnb", bpm: [85, 100], mood: "dreamy", note: "ctrl-era alt-R&B: floaty groove, off-kilter swing" },
    { name: "Usher", aka: ["usher"], genre: "rnb", bpm: [95, 110], mood: "smooth", note: "confessions-era smooth R&B: silky groove, crisp snaps" },
    { name: "Alicia Keys", aka: ["alicia keys"], genre: "rnb", bpm: [85, 100], mood: "smooth", note: "piano-led soulful R&B: warm keys, gentle pocket" },
    { name: "Frank Ocean", aka: ["frank ocean"], genre: "rnb", bpm: [85, 100], mood: "dreamy", note: "blonde-era art-R&B: hazy drift, minimal groove" },
    { name: "Taylor Swift", aka: ["taylor swift"], genre: "pop", bpm: [95, 120], mood: "bright", note: "eras-era pop: sparkling drums, stadium-ready lift" },
    { name: "Michael Jackson", aka: ["michael jackson"], genre: "pop", bpm: [100, 120], mood: "driving", note: "quincy-era pop-funk precision: razor drums, tight groove" },
    { name: "Dua Lipa", aka: ["dua lipa"], genre: "pop", bpm: [110, 125], mood: "bright", note: "disco-pop shimmer: four-on-the-floor sparkle" },
    { name: "Bruno Mars", aka: ["bruno mars"], genre: "funk", bpm: [100, 115], mood: "bright", note: "retro funk-pop showmanship: horn-stab energy, party drums" },
    { name: "Doja Cat", aka: ["doja cat"], genre: "pop", bpm: [100, 120], mood: "bright", note: "playful planet-pop bounce: bouncy drums, candy synths" },
    { name: "Billie Eilish", aka: ["billie eilish"], genre: "ambient", bpm: [70, 90], mood: "dark", note: "whisper-pop minimalism: sub-bass hush, skeletal groove" },
    { name: "Queen", aka: ["queen"], genre: "rock", bpm: [100, 120], mood: "epic", note: "arena-rock stomp and pomp: thunder drums, operatic lift" },
    { name: "Nirvana", aka: ["nirvana"], genre: "rock", bpm: [110, 130], mood: "gritty", note: "grunge quiet-loud dynamics: sludge verses, explosive choruses" },
    { name: "Foo Fighters", aka: ["foo fighters"], genre: "rock", bpm: [120, 135], mood: "driving", note: "modern arena-rock drive: relentless drums, big guitars feel" },
    { name: "The Rolling Stones", aka: ["rolling stones", "the rolling stones"], genre: "rock", bpm: [110, 130], mood: "driving", note: "blues-rock swagger: loose shuffle, barroom stomp" },
    { name: "Calvin Harris", aka: ["calvin harris"], genre: "house", bpm: [122, 128], mood: "bright", note: "festival-house euphoria: piano-house lift, four-on-the-floor" },
    { name: "Skrillex", aka: ["skrillex"], genre: "techno", bpm: [140, 150], mood: "epic", note: "aggressive festival-electro energy: sawtooth mayhem feel" },
    { name: "Daft Punk", aka: ["daft punk"], genre: "house", bpm: [115, 125], mood: "driving", note: "french-house filtered disco loop: robot-rock groove" },
    { name: "Deadmau5", aka: ["deadmau5"], genre: "techno", bpm: [125, 130], mood: "dark", note: "progressive electro pulse: hypnotic arps, driving four-floor" },
    { name: "Miles Davis", aka: ["miles davis"], genre: "jazz", bpm: [90, 120], mood: "smooth", note: "cool-jazz modal drift: brushed swing, blue trumpet feel" },
    { name: "John Coltrane", aka: ["john coltrane", "coltrane"], genre: "jazz", bpm: [110, 140], mood: "epic", note: "sheets-of-sound swing: urgent ride cymbal, spiritual lift" },
    { name: "Kirk Franklin", aka: ["kirk franklin"], genre: "gospel", bpm: [95, 115], mood: "epic", note: "stomping choir-driven gospel: hand-clap thunder, testify energy" },
    { name: "Aretha Franklin", aka: ["aretha franklin"], genre: "60s-soul", bpm: [90, 112], mood: "epic", note: "queen-of-soul testify groove: deep pocket, sanctified swing" },
    { name: "Johnny Cash", aka: ["johnny cash"], genre: "country", bpm: [90, 110], mood: "driving", note: "boom-chicka-boom train rhythm: steady freight-train strum" },
    { name: "Dolly Parton", aka: ["dolly parton"], genre: "country", bpm: [95, 115], mood: "bright", note: "nashville sunshine bounce: sparkling shuffle, storyteller swing" },
    { name: "Burna Boy", aka: ["burna boy", "burna"], genre: "afrobeats", bpm: [100, 110], mood: "bright", note: "afro-fusion log-drum groove: rolling percussion, sunny bounce" },
    { name: "Wizkid", aka: ["wizkid", "wiz kid"], genre: "afrobeats", bpm: [98, 108], mood: "smooth", note: "starboy afrobeats glide: silky shaker groove, mellow bounce" },
    { name: "Fela Kuti", aka: ["fela kuti", "fela"], genre: "afrobeats", bpm: [100, 115], mood: "driving", note: "afrobeat horn-driven polyrhythm: hypnotic percussion storm" },
    { name: "Daddy Yankee", aka: ["daddy yankee"], genre: "reggaeton", bpm: [95, 100], mood: "driving", note: "classic dembow riddim: the gasolina bounce" },
    { name: "Bad Bunny", aka: ["bad bunny"], genre: "reggaeton", bpm: [90, 100], mood: "smooth", note: "perreo-pop dembow bounce: moody and melodic" },
    { name: "Sean Paul", aka: ["sean paul"], genre: "dancehall", bpm: [100, 105], mood: "bright", note: "dutty-rock dancehall bounce: bashment bubble" },
    { name: "Bob Marley", aka: ["bob marley"], genre: "reggae", bpm: [75, 90], mood: "chill", note: "one-drop roots groove: skanking offbeat, heavy heartbeat bass" },
    { name: "Eminem", aka: ["eminem", "slim shady"], genre: "hip-hop", bpm: [88, 100], mood: "gritty", note: "relentless Detroit rap bounce: driving piano-style stabs, machine-tight drums" },
    { name: "Dr. Dre", aka: ["dr. dre", "dr dre", "dre"], genre: "hip-hop", bpm: [90, 100], mood: "smooth", note: "G-funk west-coast glide: whining synth lead feel, deep rolling bass" },
    { name: "Snoop Dogg", aka: ["snoop dogg", "snoop"], genre: "hip-hop", bpm: [90, 98], mood: "chill", note: "laid-back G-funk flow: lazy drawl groove, smooth funk bounce" },
    { name: "50 Cent", aka: ["50 cent", "fifty cent"], genre: "hip-hop", bpm: [88, 98], mood: "driving", note: "early-00s club-rap bounce: catchy synth hooks, hard drums" },
    { name: "Lil Wayne", aka: ["lil wayne", "weezy"], genre: "hip-hop", bpm: [90, 100], mood: "driving", note: "mixtape-era southern bounce: syrupy synths, triplet flows feel" },
    { name: "Nicki Minaj", aka: ["nicki minaj", "nicki"], genre: "hip-hop", bpm: [95, 110], mood: "bright", note: "playful barbie-era bounce: bouncy drums, animated delivery feel" },
    { name: "Cardi B", aka: ["cardi b", "cardi"], genre: "hip-hop", bpm: [95, 105], mood: "driving", note: "bronx bodak bounce: brash drums, club-ready energy" },
    { name: "Post Malone", aka: ["post malone", "posty"], genre: "hip-hop", bpm: [85, 100], mood: "dreamy", note: "guitar-tinged melodic rap: hazy chords, sad-boy bounce" },
    { name: "Rihanna", aka: ["rihanna", "riri"], genre: "pop", bpm: [95, 115], mood: "smooth", note: "island-pop royalty bounce: dancehall-inflected groove" },
    { name: "Adele", aka: ["adele"], genre: "pop", bpm: [70, 90], mood: "epic", note: "soul-ballad grandeur: piano-led, powerhouse lift" },
    { name: "Ed Sheeran", aka: ["ed sheeran"], genre: "pop", bpm: [95, 110], mood: "bright", note: "loop-pedal folk-pop: acoustic bounce, catchy lift" },
    { name: "Prince", aka: ["prince"], genre: "funk", bpm: [95, 115], mood: "driving", note: "minneapolis funk mastery: linn-style drums, falsetto-ready bounce" },
    { name: "Stevie Wonder", aka: ["stevie wonder", "stevie"], genre: "funk", bpm: [95, 110], mood: "bright", note: "soul-funk genius bounce: clavinet-style groove, joyful swing" },
    { name: "James Brown", aka: ["james brown"], genre: "funk", bpm: [95, 110], mood: "driving", note: "godfather-of-soul funk: the hardest working drums in show business" },
    { name: "Marvin Gaye", aka: ["marvin gaye", "marvin"], genre: "60s-soul", bpm: [85, 100], mood: "smooth", note: "what's-going-on soul: silky groove, socially conscious warmth" },
    { name: "The Beatles", aka: ["the beatles", "beatles"], genre: "pop", bpm: [110, 130], mood: "bright", note: "british-invasion bounce: jangly lift, timeless songcraft" },
    { name: "Jimi Hendrix", aka: ["jimi hendrix", "hendrix"], genre: "rock", bpm: [100, 120], mood: "epic", note: "psychedelic guitar-fire groove: wah-drenched bounce" },
    { name: "Led Zeppelin", aka: ["led zeppelin", "zeppelin"], genre: "rock", bpm: [100, 120], mood: "epic", note: "thunder-god rock: Bonham-style stomp, riff monoliths" },
    { name: "Pink Floyd", aka: ["pink floyd"], genre: "rock", bpm: [90, 110], mood: "dreamy", note: "cosmic prog drift: spacious groove, atmospheric lift" },
    { name: "David Bowie", aka: ["david bowie", "bowie"], genre: "rock", bpm: [100, 120], mood: "driving", note: "stardust art-rock: chameleon bounce, theatrical lift" },
    { name: "Elton John", aka: ["elton john", "elton"], genre: "pop", bpm: [95, 115], mood: "bright", note: "piano-man pop-rock: rolling ivories, rocket lift" },
    { name: "Madonna", aka: ["madonna"], genre: "pop", bpm: [115, 125], mood: "bright", note: "queen-of-pop dance: synth-pop strut, vogue-ready groove" },
    { name: "Coldplay", aka: ["coldplay"], genre: "pop", bpm: [95, 115], mood: "epic", note: "stadium-anthem lift: shimmering guitars, skyward build" },
    { name: "Linkin Park", aka: ["linkin park"], genre: "rock", bpm: [100, 120], mood: "gritty", note: "nu-metal hybrid drive: rap-rock bounce, electronic edge" },
    { name: "Red Hot Chili Peppers", aka: ["red hot chili peppers", "rhcp", "chili peppers"], genre: "funk", bpm: [100, 115], mood: "bright", note: "cali funk-rock slap: bouncy bass, party energy" },
    { name: "Guns N' Roses", aka: ["guns n' roses", "guns n roses", "gnr"], genre: "rock", bpm: [110, 130], mood: "driving", note: "sunset-strip sleaze rock: swaggering shuffle, screaming lift" }
  ];
  /* Detect "[name] type beat" / "[name]-type beat" / "[name] style beat" /
     "in the style of [name]" phrasing in a request. Returns the matched
     style reference or null. */
  D.parseStyleRequest = function (prompt) {
    var p = " " + String(prompt || "").toLowerCase().replace(/[''']/g, "'") + " ";
    if (p.indexOf("type beat") === -1 && p.indexOf("type-beat") === -1 &&
        p.indexOf("style beat") === -1 && p.indexOf("in the style of") === -1 &&
        p.indexOf("type song") === -1 && p.indexOf("type-song") === -1 &&
        p.indexOf("type track") === -1 && p.indexOf("style song") === -1) return null;
    var i, j, ak, ref;
    for (i = 0; i < STYLE_REFS.length; i++) {
      ref = STYLE_REFS[i];
      for (j = 0; j < ref.aka.length; j++) {
        ak = " " + ref.aka[j] + " ";
        if (p.indexOf(ak + "type beat") !== -1 || p.indexOf(ak + "type-beat") !== -1 ||
            p.indexOf(ak.replace(/ $/, "-") + "type beat") !== -1 ||
            p.indexOf(ak + "type song") !== -1 || p.indexOf(ak + "type-song") !== -1 ||
            p.indexOf(ak + "type track") !== -1 || p.indexOf(ak + "style song") !== -1 ||
            p.indexOf(ak + "style beat") !== -1 || p.indexOf(ak + "style") !== -1 ||
            p.indexOf("in the style of" + ak) !== -1) return ref;
      }
    }
    return null;
  };
  D.STYLE_REFS = STYLE_REFS;
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
