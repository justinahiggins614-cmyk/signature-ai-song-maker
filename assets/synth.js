/* ============================================================
   SigSynth — deterministic client-side music engine for
   The Signature Song Maker AI. Everything is synthesized with
   the Web Audio API: no samples, no network, no keys.
   Honest design: voices are synthesized, never human singers.
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------- deterministic RNG ---------- */
  function xmur3(str) {
    var h = 1779033703 ^ str.length, i = 0;
    for (; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function rngFrom(str) { return mulberry32(xmur3(String(str))()); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------- audio context (lazy) ---------- */
  var _ctx = null, _master = null, _noiseBuf = null, _analyser = null;
  function ac() {
    if (!_ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error("Web Audio is not supported in this browser.");
      _ctx = new AC();
      _master = _ctx.createGain(); _master.gain.value = 0.9;
      _analyser = _ctx.createAnalyser(); _analyser.fftSize = 512;
      _master.connect(_analyser); _analyser.connect(_ctx.destination);
    }
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  }
  /* live VU level: 0..1 RMS off the master analyser */
  var _vuBuf = null;
  function meterLevel() {
    if (!_analyser) return 0;
    if (!_vuBuf || _vuBuf.length !== _analyser.fftSize) _vuBuf = new Uint8Array(_analyser.fftSize);
    _analyser.getByteTimeDomainData(_vuBuf);
    var s = 0, i;
    for (i = 0; i < _vuBuf.length; i += 2) { var v = (_vuBuf[i] - 128) / 128; s += v * v; }
    return Math.min(1, Math.sqrt(s / (_vuBuf.length / 2)) * 2.2);
  }
  /* per-render mixer buses: mx = {drums,bass,chords,lead,vocal} gain nodes */
  function makeBuses(c, dest, mix) {
    var mx = {}, names = ["drums", "bass", "chords", "lead", "vocal"], i;
    for (i = 0; i < names.length; i++) {
      var g = c.createGain();
      g.gain.value = (mix && mix[names[i]] != null) ? mix[names[i]] : 1;
      g.connect(dest); mx[names[i]] = g;
    }
    return mx;
  }
  function busDest(mx, dest, name) { return (mx && mx[name]) ? mx[name] : dest; }
  function noiseBuffer(c) {
    if (_noiseBuf && _noiseBuf.sampleRate === c.sampleRate) return _noiseBuf;
    var b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0), i;
    for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (c === _ctx) _noiseBuf = b;
    return b;
  }

  /* ---------- drum voices (destination-aware, work live or offline) ---------- */
  function kick(c, dest, t, v) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.95 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
  }
  function snare(c, dest, t, v) {
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
    var f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1600;
    var g = c.createGain(); g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.2);
    var o = c.createOscillator(), g2 = c.createGain(); o.type = "triangle"; o.frequency.value = 190;
    g2.gain.setValueAtTime(0.35 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g2); g2.connect(dest); o.start(t); o.stop(t + 0.12);
  }
  function hat(c, dest, t, v, open) {
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
    var f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
    var g = c.createGain(), d = open ? 0.32 : 0.05;
    g.gain.setValueAtTime(0.28 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + d + 0.02);
  }
  function clap(c, dest, t, v) {
    var i, tt;
    for (i = 0; i < 3; i++) { tt = t + i * 0.018; (function (t2) {
      var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
      var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 1.4;
      var g = c.createGain(); g.gain.setValueAtTime(0.4 * v, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.09);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t2); n.stop(t2 + 0.12);
    })(tt); }
  }
  function tom(c, dest, t, v, midi) {
    var o = c.createOscillator(), g = c.createGain(), f0 = midiHz(midi || 55);
    o.type = "sine"; o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.1);
    g.gain.setValueAtTime(0.7 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32);
  }
  function shaker(c, dest, t, v) {
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 5500; f.Q.value = 2;
    var g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.15);
  }

  /* ---------- melodic voice ---------- */
  var VOICE_DEFAULTS = {
    bass:    { type: "sawtooth", cutoff: 900,  attack: 0.005, decay: 0.28, sustain: 0.7,  rel: 0.08, level: 0.5 },
    sub:     { type: "sine",     cutoff: 400,  attack: 0.008, decay: 0.3,  sustain: 0.85, rel: 0.1,  level: 0.65 },
    keys:    { type: "triangle", cutoff: 3200, attack: 0.004, decay: 0.5,  sustain: 0.45, rel: 0.25, level: 0.42 },
    epiano:  { type: "sine",     cutoff: 2400, attack: 0.003, decay: 0.7,  sustain: 0.3,  rel: 0.4,  level: 0.4, trem: 4.5 },
    pluck:   { type: "square",   cutoff: 2600, attack: 0.002, decay: 0.22, sustain: 0.2,  rel: 0.12, level: 0.34 },
    lead:    { type: "sawtooth", cutoff: 4200, attack: 0.01,  decay: 0.4,  sustain: 0.6,  rel: 0.15, level: 0.36 },
    strings: { type: "sawtooth", cutoff: 2200, attack: 0.25,  decay: 0.6,  sustain: 0.8,  rel: 0.4,  level: 0.3, detune: 6 },
    brass:   { type: "sawtooth", cutoff: 1800, attack: 0.08,  decay: 0.3,  sustain: 0.75, rel: 0.2,  level: 0.34 },
    pad:     { type: "sawtooth", cutoff: 1200, attack: 0.6,   decay: 0.8,  sustain: 0.85, rel: 0.8,  level: 0.26, detune: 8 },
    flute:   { type: "sine",     cutoff: 3000, attack: 0.06,  decay: 0.4,  sustain: 0.7,  rel: 0.2,  level: 0.38, vib: 5.5 },
    marimba: { type: "sine",     cutoff: 2000, attack: 0.002, decay: 0.35, sustain: 0.1,  rel: 0.15, level: 0.44 },
    koto:    { type: "triangle", cutoff: 3600, attack: 0.002, decay: 0.5,  sustain: 0.15, rel: 0.3,  level: 0.4 }
  };
  function tone(c, dest, t, midi, dur, voice, vel, bus) {
    var P = VOICE_DEFAULTS[voice] || VOICE_DEFAULTS.keys, v = (vel == null ? 1 : vel);
    var out = bus || dest;
    function one(det) {
      var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = P.type; o.frequency.value = midiHz(midi); if (det) o.detune.value = det;
      f.type = "lowpass"; f.frequency.setValueAtTime(P.cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, P.cutoff * 0.55), t + dur);
      var a = P.attack, peak = P.level * v;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.setTargetAtTime(peak * P.sustain, t + a, P.decay / 3);
      g.gain.setValueAtTime(peak * P.sustain, t + Math.max(a, dur - P.rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + P.rel);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + P.rel + 0.05);
      if (P.trem) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = P.trem; lg.gain.value = peak * 0.18; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + dur + P.rel + 0.05); }
      if (P.vib) { var l2 = c.createOscillator(), lg2 = c.createGain(); l2.frequency.value = P.vib; lg2.gain.value = 6; l2.connect(lg2); lg2.connect(o.detune); l2.start(t); l2.stop(t + dur + P.rel + 0.05); }
    }
    one(0); if (P.detune) { one(P.detune); one(-P.detune); }
  }

  /* ---------- FX ---------- */
  function riser(c, dest, t, dur, v) {
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c); n.loop = true;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    var g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + 0.1);
  }

  /* ---------- deterministic beat patterns (pure math: testable without audio) ---------- */
  var GENRES = ["hip-hop", "house", "trap", "pop", "rock", "lofi", "techno", "jazz", "ambient", "drum-and-bass", "reggae", "funk"];
  var MOODS = ["dark", "bright", "chill", "epic", "smooth", "driving", "dreamy", "gritty"];
  function hashSeed(s) { return xmur3(String(s))(); }

  function patternFor(prompt, genre, bpm) {
    var seed = String(prompt || "untitled") + "|" + (genre || "hip-hop") + "|" + (bpm || 92);
    var rng = rngFrom(seed), pat = { kick: [], snare: [], hat: [], clap: [], tom: [], shaker: [] }, i;
    for (i = 0; i < 16; i++) { pat.kick[i] = 0; pat.snare[i] = 0; pat.hat[i] = 0; pat.clap[i] = 0; pat.tom[i] = 0; pat.shaker[i] = 0; }
    function on(arr, steps) { var s, k; for (s = 0; s < steps.length; s++) arr[steps[s] % 16] = 1; }
    switch (genre) {
      case "hip-hop": on(pat.kick, [0, 7, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 0) ? 1 : (rng() < 0.3 ? 1 : 0); break;
      case "trap": on(pat.kick, [0, 6, 10]); on(pat.snare, [8]); for (i = 0; i < 16; i++) pat.hat[i] = rng() < 0.75 ? 1 : 0; on(pat.tom, [14]); break;
      case "house": on(pat.kick, [0, 4, 8, 12]); on(pat.clap, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 1) ? 1 : 0; on(pat.shaker, [2, 6, 10, 14]); break;
      case "techno": on(pat.kick, [0, 4, 8, 12]); on(pat.hat, [2, 6, 10, 14]); on(pat.snare, [4, 12]); break;
      case "pop": on(pat.kick, [0, 8, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 4 === 2) ? 1 : (rng() < 0.4 ? 1 : 0); break;
      case "rock": on(pat.kick, [0, 8]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = 1; break;
      case "lofi": on(pat.kick, [0, 7, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (rng() < 0.55 ? 1 : 0); on(pat.shaker, [14]); break;
      case "jazz": on(pat.kick, [0, 10]); on(pat.snare, [4]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 3 === 2) ? 1 : (rng() < 0.25 ? 1 : 0); on(pat.shaker, [6, 12]); break;
      case "drum-and-bass": on(pat.kick, [0, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 0) ? 1 : (rng() < 0.5 ? 1 : 0); break;
      case "reggae": on(pat.kick, [4, 12]); on(pat.snare, [0, 8]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 0) ? 1 : 0; break;
      case "funk": on(pat.kick, [0, 3, 8]); on(pat.snare, [4, 12, 15]); for (i = 0; i < 16; i++) pat.hat[i] = 1; on(pat.clap, [12]); break;
      default: on(pat.kick, [0, 8]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 0) ? 1 : 0;
    }
    // seeded human-ish variation
    var k;
    for (k = 0; k < 4; k++) { var s = Math.floor(rng() * 16); if (rng() < 0.5) pat.hat[s] = pat.hat[s] ? 0 : 1; }
    return { genre: genre, bpm: bpm, steps: pat, seed: seed };
  }
  function scheduleBeat(c, dest, t0, pattern, bars, vel, mx) {
    var step = 60 / pattern.bpm / 4, b, i, t, v = (vel == null ? 1 : vel);
    var dd = busDest(mx, dest, "drums");
    for (b = 0; b < bars; b++) for (i = 0; i < 16; i++) {
      t = t0 + (b * 16 + i) * step; var s = pattern.steps;
      if (s.kick[i]) kick(c, dd, t, v); if (s.snare[i]) snare(c, dd, t, v);
      if (s.hat[i]) hat(c, dd, t, v * 0.9, i % 4 === 3); if (s.clap[i]) clap(c, dd, t, v);
      if (s.tom[i]) tom(c, dd, t, v, 50); if (s.shaker[i]) shaker(c, dd, t, v);
    }
    return t0 + bars * 16 * step;
  }

  /* ---------- harmony helpers (pure math) ---------- */
  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function noteName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  var PROGS = {
    "pop": [[0, 5, 3, 4], [0, 4, 5, 3]], "hip-hop": [[0, 0, 3, 4], [5, 4, 0, 0]],
    "rock": [[0, 3, 5, 4], [0, 5, 3, 4]], "jazz": [[1, 4, 0, 5], [5, 1, 4, 0]],
    "house": [[0, 0, 5, 4], [3, 4, 0, 5]], "ambient": [[0, 3, 5, 4], [0, 5, 3, 5]],
    "lofi": [[0, 8, 3, 4], [5, 3, 0, 4]], "default": [[0, 5, 3, 4]]
  };
  function chordsFor(keyRoot, genre, rng) {
    var bank = PROGS[genre] || PROGS.default, prog = bank[Math.floor(rng() * bank.length)];
    return prog.map(function (deg) {
      var root = keyRoot + deg, third = root + (deg === 1 || deg === 2 || deg === 5 ? 3 : 4);
      return [root, third, root + 7];
    });
  }
  function melodyFor(chords, bars, rng) {
    var mel = [], b, beat, chord, toneChoice;
    for (b = 0; b < bars; b++) {
      chord = chords[b % chords.length];
      for (beat = 0; beat < 4; beat++) {
        if (rng() < 0.82) {
          toneChoice = pick(rng, [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[0] + 24]);
          mel.push({ midi: toneChoice, len: rng() < 0.25 ? 0.5 : 1 });
        } else mel.push({ midi: -1, len: 1 });
      }
    }
    return mel;
  }

  /* ---------- offline render + WAV ---------- */
  function renderBuffer(seconds, scheduleFn) {
    var rate = 44100, OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OC) return Promise.reject(new Error("Offline rendering not supported."));
    var c = new OC(2, Math.ceil(seconds * rate), rate);
    return new Promise(function (res, rej) {
      try { scheduleFn(c, c.destination, 0.05); } catch (e) { rej(e); return; }
      c.startRendering().then(res, rej);
    });
  }
  function bufferToWav(buf) {
    var n = buf.length, ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, i, c;
    var bytes = 44 + n * ch * 2, ab = new ArrayBuffer(bytes), dv = new DataView(ab), off = 44;
    function wstr(s, o) { var k; for (k = 0; k < s.length; k++) dv.setUint8(o + k, s.charCodeAt(k)); }
    wstr("RIFF", 0); dv.setUint32(4, bytes - 8, true); wstr("WAVE", 8); wstr("fmt ", 12);
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    wstr("data", 36); dv.setUint32(40, n * ch * 2, true);
    var d0 = buf.getChannelData(0), d1 = ch > 1 ? buf.getChannelData(1) : d0;
    for (i = 0; i < n; i++) for (c = 0; c < ch; c++) {
      var s = (c === 0 ? d0 : d1)[i]; s = Math.max(-1, Math.min(1, s));
      dv.setInt16(off, s < 0 ? s * 32768 : s * 32767, true); off += 2;
    }
    return new root.Blob([ab], { type: "audio/wav" });
  }

  /* ---------- full-song render ---------- */
  function songPlan(song) {
    var rng = rngFrom("song:" + song.id), keyRoot = 48 + Math.floor(rng() * 12);
    var chords = chordsFor(keyRoot, song.genre, rng);
    var secs = { intro: 4, verse: 16, chorus: 16, bridge: 8, outro: 4 };
    var order = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"];
    var totalBars = 0, si; for (si = 0; si < order.length; si++) totalBars += secs[order[si]] / 4 * 2;
    var melody = melodyFor(chords, totalBars, rng);
    var bassline = [];
    (function () { var b; for (b = 0; b < totalBars; b++) { var ch = chords[b % chords.length]; bassline.push(ch[0] - 12, ch[0] - 12, ch[2] - 12, ch[0] - 12); } })();
    return { keyRoot: keyRoot, chords: chords, melody: melody, bassline: bassline, totalBars: totalBars, bpm: song.tempo, genre: song.genre, beat: patternFor(song.title, song.genre, song.tempo) };
  }
  function renderSong(song, seconds, mix) {
    var plan = songPlan(song), beatLen = plan.totalBars * (60 / plan.bpm);
    var dur = seconds || Math.min(150, beatLen + 2);
    return renderBuffer(dur, function (c, dest, t0) {
      var mx = makeBuses(c, dest, mix);
      scheduleBeat(c, dest, t0, plan.beat, plan.totalBars, 0.9, mx);
      var step = 60 / plan.bpm, bi, ch;
      for (bi = 0; bi < plan.totalBars; bi++) {
        ch = plan.chords[bi % plan.chords.length];
        tone(c, dest, t0 + bi * 4 * step, ch[0] - 12, 3.6 * step, "bass", 0.9, mx.bass);
        tone(c, dest, t0 + bi * 4 * step, ch[1], 3.8 * step, "pad", 0.5, mx.chords);
        tone(c, dest, t0 + bi * 4 * step, ch[2], 3.8 * step, "pad", 0.4, mx.chords);
      }
      var mi, mt = t0;
      for (mi = 0; mi < plan.melody.length && mt < t0 + dur - 1; mi++) {
        var n = plan.melody[mi];
        if (n.midi > 0) tone(c, dest, mt, n.midi, n.len * step * 0.92, "lead", 0.75, mx.lead);
        mt += n.len * step;
      }
    });
  }

  /* ---------- vocal synth (honest: synthesized voices, labeled as such) ---------- */
  var CREATED_VOICES = [
    { id: "nova",  name: "Nova",  desc: "Bright airy synthesized soprano", formants: [600, 1400, 2800], vib: 5.5, level: 0.5 },
    { id: "ember", name: "Ember", desc: "Warm synthesized alto",           formants: [480, 1100, 2400], vib: 5.0, level: 0.55 },
    { id: "drift", name: "Drift", desc: "Soft breathy synthesized tenor",  formants: [420, 1000, 2600], vib: 6.0, level: 0.48 },
    { id: "stone", name: "Stone", desc: "Deep resonant synthesized bass",   formants: [340, 850, 2200],  vib: 4.5, level: 0.6 }
  ];
  var BACKUP_TYPES = [
    { id: "soprano", name: "Soprano section", shift: 12, desc: "High harmony line, octave shimmer" },
    { id: "alto",    name: "Alto section",    shift: 7,  desc: "Warm third-above harmony" },
    { id: "tenor",   name: "Tenor section",   shift: 4,  desc: "Mid harmony under the lead" },
    { id: "bass",    name: "Bass section",    shift: -12, desc: "Low octave foundation" },
    { id: "choir",   name: "Choir stack",     shift: 0,  desc: "Full stacked choir, detuned unison + octaves" },
    { id: "adlibs",  name: "Ad-libs",         shift: 0,  desc: "Seeded improvised riffs between phrases" }
  ];
  function singNote(c, dest, t, midi, dur, voice, vel, bus) {
    var v = (vel == null ? 1 : vel), P = voice, f = midiHz(midi);
    var out = bus || dest;
    function layer(detune, gainScale, formantSet) {
      var o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = detune;
      var lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = P.vib; lg.gain.value = 7;
      lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.1);
      var last = o, fi;
      for (fi = 0; fi < formantSet.length; fi++) {
        var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = formantSet[fi]; bp.Q.value = 6;
        last.connect(bp); last = bp;
      }
      var a = 0.06, peak = P.level * v * gainScale;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + Math.max(a, dur - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
      last.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.15);
    }
    layer(0, 1, P.formants); layer(5, 0.5, P.formants); layer(-5, 0.5, P.formants);
  }
  function melodyNotes(melody, step, t0) {
    var out = [], t = t0, i;
    for (i = 0; i < melody.length; i++) { var n = melody[i]; if (n.midi > 0) out.push({ t: t, midi: n.midi, dur: n.len * step * 0.92 }); t += n.len * step; }
    return out;
  }
  function renderVocal(melody, voiceId, backupIds, seconds, mix) {
    var voice = null, i;
    for (i = 0; i < CREATED_VOICES.length; i++) if (CREATED_VOICES[i].id === voiceId) voice = CREATED_VOICES[i];
    voice = voice || CREATED_VOICES[0];
    var step = 60 / 92, notes = melodyNotes(melody, step, 0.05);
    var dur = seconds || (notes.length ? notes[notes.length - 1].t + 2 : 8);
    var rng = rngFrom("adlib:" + voiceId + notes.length);
    return renderBuffer(dur, function (c, dest, t0) {
      var mx = makeBuses(c, dest, mix), vb = mx.vocal;
      var n;
      for (n = 0; n < notes.length; n++) singNote(c, dest, t0 + notes[n].t, notes[n].midi, notes[n].dur, voice, 1, vb);
      var b;
      for (b = 0; b < (backupIds || []).length; b++) {
        var bt = null, k;
        for (k = 0; k < BACKUP_TYPES.length; k++) if (BACKUP_TYPES[k].id === backupIds[b]) bt = BACKUP_TYPES[k];
        if (!bt) continue;
        for (n = 0; n < notes.length; n++) {
          var m = notes[n].midi + bt.shift;
          if (bt.id === "adlibs") { if (rng() < 0.3) singNote(c, dest, t0 + notes[n].t, m + 12, notes[n].dur * 0.7, voice, 0.5, vb); }
          else if (bt.id === "choir") { singNote(c, dest, t0 + notes[n].t, m, notes[n].dur, voice, 0.55, vb); singNote(c, dest, t0 + notes[n].t, m + 12, notes[n].dur, voice, 0.35, vb); }
          else singNote(c, dest, t0 + notes[n].t, m, notes[n].dur, voice, 0.6, vb);
        }
      }
    });
  }

  /* ---------- own-voice resynthesis: pitch-map a recorded sample onto a melody ---------- */
  function renderOwnVoice(melody, sampleBuffer, seconds) {
    var step = 60 / 92, notes = melodyNotes(melody, step, 0.05);
    var dur = seconds || (notes.length ? notes[notes.length - 1].t + 2 : 8);
    return renderBuffer(dur, function (c, dest, t0) {
      var n, src, g, seg = Math.min(0.5, sampleBuffer.duration / Math.max(1, notes.length));
      for (n = 0; n < notes.length; n++) {
        src = c.createBufferSource(); src.buffer = sampleBuffer; src.loop = true;
        // naive re-pitch: map sample's rough center (~220Hz) to target
        src.playbackRate.value = midiHz(notes[n].midi) / 220;
        g = c.createGain(); var t = t0 + notes[n].t;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
        g.gain.setValueAtTime(0.7, t + Math.max(0.05, notes[n].dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + notes[n].dur);
        src.connect(g); g.connect(dest); src.start(t, (n * seg) % Math.max(0.01, sampleBuffer.duration - seg), notes[n].dur + 0.05);
      }
    });
  }

  /* ---------- pitch detection (autocorrelation) + vocal cleanup ---------- */
  function detectPitch(buffer, sr) {
    var d = buffer.getChannelData(0), size = Math.min(d.length, sr), best = -1, bestCorr = 0, lag;
    var rms = 0, i; for (i = 0; i < size; i++) rms += d[i] * d[i]; rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1;
    for (lag = Math.floor(sr / 800); lag <= Math.floor(sr / 60); lag++) {
      var corr = 0; for (i = 0; i < size - lag; i += 4) corr += d[i] * d[i + lag];
      if (corr > bestCorr) { bestCorr = corr; best = lag; }
    }
    return best > 0 ? sr / best : -1;
  }
  function nearestMidi(freq) { return freq > 0 ? Math.round(69 + 12 * Math.log2(freq / 440)) : -1; }
  function cleanupVocal(buffer) {
    // honest cleanup: highpass de-rumble, gentle noise gate, EQ presence, compression, normalize
    var rate = 44100, OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var c = new OC(2, buffer.length, rate), src = c.createBufferSource(); src.buffer = buffer;
    var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 80;
    var pres = c.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 4000; pres.gain.value = 3;
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    src.connect(hp); hp.connect(pres); pres.connect(comp); comp.connect(c.destination); src.start(0);
    return c.startRendering().then(function (out) {
      var d0 = out.getChannelData(0), peak = 0, i;
      for (i = 0; i < d0.length; i += 7) peak = Math.max(peak, Math.abs(d0[i]));
      var g = peak > 0 ? 0.89 / peak : 1, ch;
      for (ch = 0; ch < out.numberOfChannels; ch++) { var dd = out.getChannelData(ch); for (i = 0; i < dd.length; i++) dd[i] *= g; }
      return out;
    });
  }

  /* ---------- live playback helpers ---------- */
  var _live = {};
  function playBuffer(buf, id) {
    stopLive(id || "main");
    var c = ac(), src = c.createBufferSource(); src.buffer = buf; src.connect(_master); src.start();
    _live[id || "main"] = src; return src;
  }
  function stopLive(id) { var s = _live[id || "main"]; if (s) { try { s.stop(); } catch (e) {} delete _live[id || "main"]; } }
  function playTone(midi, dur, voice) { var c = ac(); tone(c, _master, c.currentTime + 0.02, midi, dur || 1, voice || "keys", 1); }
  function playDrum(name) { var c = ac(), t = c.currentTime + 0.02; ({ kick: kick, snare: snare, hat: function (cc, dd, tt, vv) { hat(cc, dd, tt, vv, false); }, clap: clap }[name] || kick)(c, _master, t, 1); }

  /* ---------- public API ---------- */
  root.SigSynth = {
    rngFrom: rngFrom, pick: pick, midiHz: midiHz, noteName: noteName,
    GENRES: GENRES, MOODS: MOODS, hashSeed: hashSeed,
    patternFor: patternFor, scheduleBeat: scheduleBeat,
    chordsFor: chordsFor, melodyFor: melodyFor, songPlan: songPlan,
    renderBuffer: renderBuffer, bufferToWav: bufferToWav, renderSong: renderSong,
    CREATED_VOICES: CREATED_VOICES, BACKUP_TYPES: BACKUP_TYPES,
    renderVocal: renderVocal, renderOwnVoice: renderOwnVoice,
    detectPitch: detectPitch, nearestMidi: nearestMidi, cleanupVocal: cleanupVocal,
    playBuffer: playBuffer, stopLive: stopLive, playTone: playTone, playDrum: playDrum,
    ensureCtx: ac, meterLevel: meterLevel, makeBuses: makeBuses
  };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));
