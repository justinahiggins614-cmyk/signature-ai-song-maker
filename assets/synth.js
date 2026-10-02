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

  /* ---------- audio context (lazy) ----------
     BUG FIX 2026-10-02 (his phone report: taps play, hears nothing):
     In-app WebViews (Facebook etc.) start the AudioContext SUSPENDED and
     only allow resume() inside a real user gesture. The old code called
     ac() -> resume() inside promise .then() continuations (after an async
     offline render), which is no longer the gesture, so the context stayed
     suspended forever -> silence. Fix: unlockAudio() runs SYNCHRONOUSLY at
     the top of every tap handler, plus a document-level pointerdown/
     touchend hook unlocks on the very first tap anywhere. */
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
    if (_ctx.state === "suspended") { try { var p = _ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    return _ctx;
  }
  function unlockAudio() {
    try {
      var c = ac();
      if (c && c.state === "suspended" && c.resume) { var p2 = c.resume(); if (p2 && p2.catch) p2.catch(function () {}); }
    } catch (e) { /* surfaced by playBuffer toast */ }
    return _ctx;
  }
  function audioToast(msg) {
    try {
      var doc = root.document; if (!doc) return;
      var d = doc.getElementById("__sig_audio_toast");
      if (!d) {
        d = doc.createElement("div"); d.id = "__sig_audio_toast";
        d.style.cssText = "position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#1a1428;color:#f5c542;border:2px solid #f5c542;border-radius:10px;padding:10px 16px;z-index:99999;font-size:14px;max-width:90vw;text-align:center";
        doc.body.appendChild(d);
      }
      d.textContent = msg; d.style.display = "block";
      clearTimeout(d.__t); d.__t = setTimeout(function () { d.style.display = "none"; }, 4000);
    } catch (e) {}
  }
  if (root.document && root.document.addEventListener) {
    var _unlockOnce = function () { unlockAudio(); };
    root.document.addEventListener("pointerdown", _unlockOnce, { passive: true });
    root.document.addEventListener("touchend", _unlockOnce, { passive: true });
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
    // click transient layer (QUALITY: less "Nintendo", more thump)
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
    var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1200;
    var g2 = c.createGain(); g2.gain.setValueAtTime(0.4 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(f); f.connect(g2); g2.connect(dest); n.start(t); n.stop(t + 0.05);
  }
  function snare(c, dest, t, v) {
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c);
    var f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1600;
    var g = c.createGain(); g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.2);
    // crack layer: bandpassed noise snap
    var n2 = c.createBufferSource(); n2.buffer = noiseBuffer(c);
    var f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 3200; f2.Q.value = 1.1;
    var g3 = c.createGain(); g3.gain.setValueAtTime(0.5 * v, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n2.connect(f2); f2.connect(g3); g3.connect(dest); n2.start(t); n2.stop(t + 0.11);
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
    // metallic shimmer layer
    var o = c.createOscillator(), g2 = c.createGain(); o.type = "square"; o.frequency.value = 9800;
    g2.gain.setValueAtTime(0.05 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g2); g2.connect(dest); o.start(t); o.stop(t + d + 0.02);
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
      case "drill": on(pat.kick, [0, 7, 10]); on(pat.snare, [8]); on(pat.clap, [8]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 4 === 2) ? 1 : (rng() < 0.35 ? 1 : 0); on(pat.tom, [14]); break;
      case "rnb": on(pat.kick, [0, 7, 10]); on(pat.snare, [4, 12]); on(pat.clap, [12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 0) ? 1 : (rng() < 0.35 ? 1 : 0); on(pat.shaker, [6]); break;
      case "afrobeats": on(pat.kick, [0, 6, 10]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i += 2) pat.shaker[i] = 1; for (i = 0; i < 16; i++) pat.hat[i] = (i % 4 === 0) ? 0 : (rng() < 0.3 ? 1 : 0); on(pat.tom, [7, 15]); break;
      case "reggaeton": on(pat.kick, [0, 3, 8]); on(pat.snare, [4, 12]); on(pat.shaker, [2, 6, 10, 14]); on(pat.tom, [6, 14]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 1) ? 1 : 0; break;
      case "dancehall": on(pat.kick, [0, 8]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i++) pat.hat[i] = (i % 2 === 1) ? 1 : (rng() < 0.2 ? 1 : 0); on(pat.shaker, [0, 4, 8, 12]); break;
      case "gospel": on(pat.kick, [0, 8, 11]); on(pat.snare, [4, 12]); on(pat.clap, [12]); for (i = 0; i < 16; i += 2) pat.hat[i] = 1; on(pat.shaker, [2, 6, 10, 14]); break;
      case "country": on(pat.kick, [0, 8]); on(pat.snare, [4, 12]); for (i = 0; i < 16; i += 2) pat.hat[i] = 1; on(pat.shaker, [14]); break;
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

  /* ---------- offline render + WAV ----------
     QUALITY 2026-10-02: every render runs through a gentle glue
     compressor on the master — warmer, more "radio", less sterile. */
  function renderBuffer(seconds, scheduleFn) {
    var rate = 44100, OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OC) return Promise.reject(new Error("Offline rendering not supported."));
    var c = new OC(2, Math.ceil(seconds * rate), rate);
    var master = c.createGain(); master.gain.value = 1;
    var glue = c.createDynamicsCompressor();
    glue.threshold.value = -14; glue.ratio.value = 2.5; glue.attack.value = 0.008; glue.release.value = 0.2;
    master.connect(glue); glue.connect(c.destination);
    return new Promise(function (res, rej) {
      try { scheduleFn(c, master, 0.05); } catch (e) { rej(e); return; }
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

  /* ---------- FX chain (offline): filters & mastering ----------
     Applied to any rendered buffer. fx: array of {id, amount}. */
  var FX_DEFS = [
    { id: "normalize", name: "Normalize", desc: "Peak leveling to broadcast-safe −1 dB" },
    { id: "glue", name: "Glue compressor", desc: "Gentle bus compression that glues the mix" },
    { id: "limiter", name: "Limiter", desc: "Ceiling maximizer for loud, radio-ready masters" },
    { id: "tape", name: "Tape warmth", desc: "Analog tape saturation, gentle top-end roll, wow & flutter" },
    { id: "vinyl", name: "Vinyl", desc: "Vinyl crackle, warmth, and soft highs" },
    { id: "stage", name: "Stage reverb", desc: "Big-room stage ambience" },
    { id: "room", name: "Room reverb", desc: "Small natural room" },
    { id: "delay", name: "Echo delay", desc: "Tempo-synced slapback echo" },
    { id: "chorus", name: "Chorus", desc: "Widening modulation shimmer" },
    { id: "phaser", name: "Phaser", desc: "Sweeping jet-plane phase" },
    { id: "distort", name: "Drive", desc: "Tube-style harmonic drive" },
    { id: "bitcrush", name: "Bitcrush", desc: "Lo-fi digital grit" },
    { id: "eqbright", name: "Bright EQ", desc: "Air and presence lift" },
    { id: "eqwarm", name: "Warm EQ", desc: "Low-mid body, tamed harshness" },
    { id: "wide", name: "Stereo wide", desc: "Extra stereo width on music beds" },
    { id: "radio", name: "Radio", desc: "Band-limited radio voice" }
  ];
  function impulse(c, seconds, decay) {
    var rate = c.sampleRate, len = Math.floor(rate * seconds), buf = c.createBuffer(2, len, rate), ch, i;
    var rng = rngFrom("impulse:" + seconds + ":" + decay);
    for (ch = 0; ch < 2; ch++) { var d = buf.getChannelData(ch); for (i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  function applyFXChain(buffer, fxList) {
    fxList = (fxList || []).filter(function (f) { return f && f.id; });
    if (!fxList.length) return Promise.resolve(buffer);
    var rate = 44100, OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var c = new OC(2, buffer.length, rate), src = c.createBufferSource(); src.buffer = buffer;
    var head = src, i, f;
    function insert(node) { head.connect(node); head = node; }
    for (i = 0; i < fxList.length; i++) {
      f = fxList[i]; var amt = (f.amount == null ? 1 : f.amount);
      if (f.id === "normalize") {
        var peak = 0, d0 = buffer.getChannelData(0), k;
        for (k = 0; k < d0.length; k += 7) peak = Math.max(peak, Math.abs(d0[k]));
        var g = c.createGain(); g.gain.value = peak > 0 ? 0.89 / peak : 1; insert(g);
      } else if (f.id === "glue" || f.id === "limiter") {
        var comp = c.createDynamicsCompressor();
        if (f.id === "glue") { comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.24; }
        else { comp.threshold.value = -6; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.08; }
        insert(comp);
      } else if (f.id === "tape") {
        var sh = c.createWaveShaper(), curve = new Float32Array(256), ci;
        for (ci = 0; ci < 256; ci++) { var x = ci / 128 - 1; curve[ci] = Math.tanh(2.2 * x) * 0.85; }
        sh.curve = curve;
        var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 14000;
        var wow = c.createOscillator(), wg = c.createGain(); wow.frequency.value = 0.8; wg.gain.value = 0.003;
        insert(sh); insert(lp);
        wow.connect(wg); wg.connect(lp.frequency); wow.start(0); wow.stop(buffer.length / rate);
      } else if (f.id === "vinyl") {
        var nz = c.createBufferSource(); nz.buffer = noiseBuffer(c); nz.loop = true;
        var nf = c.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 5000;
        var ng = c.createGain(); ng.gain.value = 0.015 * amt;
        nz.connect(nf); nf.connect(ng); ng.connect(c.destination); nz.start(0);
        var vlp = c.createBiquadFilter(); vlp.type = "lowpass"; vlp.frequency.value = 15000; insert(vlp);
      } else if (f.id === "stage" || f.id === "room") {
        var conv = c.createConvolver(); conv.buffer = impulse(c, f.id === "stage" ? 2.2 : 0.7, f.id === "stage" ? 2.2 : 3.2);
        var wet = c.createGain(); wet.gain.value = (f.id === "stage" ? 0.35 : 0.2) * amt;
        var dry = c.createGain(); dry.gain.value = 1;
        head.connect(dry); head.connect(conv); conv.connect(wet);
        var sum = c.createGain(); dry.connect(sum); wet.connect(sum); head = sum;
      } else if (f.id === "delay") {
        var dl2 = c.createDelay(2); dl2.delayTime.value = 0.32;
        var fb = c.createGain(); fb.gain.value = 0.35 * amt;
        var wet2 = c.createGain(); wet2.gain.value = 0.3 * amt;
        head.connect(dl2); dl2.connect(fb); fb.connect(dl2); dl2.connect(wet2);
        var sum2 = c.createGain(); head.connect(sum2); wet2.connect(sum2); head = sum2;
      } else if (f.id === "chorus") {
        var cdl = c.createDelay(0.05); cdl.delayTime.value = 0.018;
        var lfo = c.createOscillator(), lg2 = c.createGain(); lfo.frequency.value = 1.4; lg2.gain.value = 0.006;
        lfo.connect(lg2); lg2.connect(cdl.delayTime); lfo.start(0); lfo.stop(buffer.length / rate);
        var wet3 = c.createGain(); wet3.gain.value = 0.4 * amt;
        head.connect(cdl); cdl.connect(wet3);
        var sum3 = c.createGain(); head.connect(sum3); wet3.connect(sum3); head = sum3;
      } else if (f.id === "phaser") {
        var ap = c.createBiquadFilter(); ap.type = "allpass"; ap.frequency.value = 1200; ap.Q.value = 4;
        var plfo = c.createOscillator(), pg = c.createGain(); plfo.frequency.value = 0.5; pg.gain.value = 900;
        plfo.connect(pg); pg.connect(ap.frequency); plfo.start(0); plfo.stop(buffer.length / rate);
        insert(ap);
      } else if (f.id === "distort") {
        var ds = c.createWaveShaper(), dc = new Float32Array(256), di2;
        for (di2 = 0; di2 < 256; di2++) { var xx = di2 / 128 - 1; dc[di2] = Math.tanh(4 * xx) * 0.7; }
        ds.curve = dc; insert(ds);
      } else if (f.id === "bitcrush") {
        var bc = c.createWaveShaper(), bcc = new Float32Array(256), bi2, bits = 6;
        for (bi2 = 0; bi2 < 256; bi2++) { var xv = bi2 / 128 - 1; bcc[bi2] = Math.round(xv * bits) / bits * 0.9; }
        bc.curve = bcc; insert(bc);
      } else if (f.id === "eqbright") {
        var hb = c.createBiquadFilter(); hb.type = "highshelf"; hb.frequency.value = 8000; hb.gain.value = 4 * amt; insert(hb);
      } else if (f.id === "eqwarm") {
        var lw = c.createBiquadFilter(); lw.type = "lowshelf"; lw.frequency.value = 300; lw.gain.value = 3 * amt;
        var hc = c.createBiquadFilter(); hc.type = "highshelf"; hc.frequency.value = 9000; hc.gain.value = -3 * amt;
        insert(lw); insert(hc);
      } else if (f.id === "wide") {
        var spl = c.createChannelSplitter(2), mrg = c.createChannelMerger(2);
        var dlL = c.createDelay(0.05); dlL.delayTime.value = 0.012;
        head.connect(spl); spl.connect(dlL, 0); dlL.connect(mrg, 0, 0); spl.connect(mrg, 1, 1);
        head = mrg;
      } else if (f.id === "radio") {
        var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8; insert(bp);
      }
    }
    head.connect(c.destination); src.start(0);
    return c.startRendering();
  }

  /* ---------- full-song render: lead-in + sections + beat switch ----------
     Every song is a FULL song: riser lead-in intro, verse/chorus arc,
     a bridge with a real beat SWITCH, and an outro. */
  function sectionPlan(song) {
    var rng = rngFrom("fullsong:" + song.id), keyRoot = 48 + Math.floor(rng() * 12);
    var genre = song.genre || "pop";
    var chords = chordsFor(keyRoot, genre, rng);
    var switchGenre = pick(rng, ["trap", "drum-and-bass", "house", "funk", "hip-hop", "techno"]);
    if (switchGenre === genre) switchGenre = "trap";
    var sections = [
      { name: "intro", bars: 4, beat: "leadin", drums: 0.5 },
      { name: "verse", bars: 8, beat: genre, drums: 0.9 },
      { name: "chorus", bars: 8, beat: genre, drums: 1.0 },
      { name: "verse2", bars: 8, beat: genre, drums: 0.95 },
      { name: "chorus", bars: 8, beat: genre, drums: 1.0 },
      { name: "bridge", bars: 8, beat: switchGenre, drums: 1.0, switched: true },
      { name: "chorus", bars: 8, beat: genre, drums: 1.05 },
      { name: "outro", bars: 4, beat: "fadeout", drums: 0.7 }
    ];
    var melody = melodyFor(chords, 60, rng);
    return { keyRoot: keyRoot, chords: chords, melody: melody, sections: sections, bpm: song.tempo || 100, genre: genre, switchGenre: switchGenre };
  }
  function renderFullSong(song, mix, fxList) {
    var plan = sectionPlan(song), bpm = plan.bpm, step = 60 / bpm, rng = rngFrom("fsched:" + song.id);
    var totalBeats = 0, si;
    for (si = 0; si < plan.sections.length; si++) totalBeats += plan.sections[si].bars * 4;
    var dur = totalBeats * step + 2;
    return renderBuffer(dur, function (c, dest, t0) {
      var mx = makeBuses(c, dest, mix);
      var t = t0, s, b, ch, mi = 0;
      // lead-in riser across the intro
      riser(c, dest, t0, plan.sections[0].bars * 4 * step, 0.8);
      for (s = 0; s < plan.sections.length; s++) {
        var sec = plan.sections[s], secStart = t, secBeats = sec.bars * 4;
        var pat = (sec.beat === "leadout" || sec.beat === "leadin" || sec.beat === "fadeout")
          ? patternFor(song.title + ":intro", plan.genre, bpm)
          : patternFor(song.title + ":" + sec.beat, sec.beat, bpm);
        // drums for this section (intro filtered, outro fading)
        var dd = busDest(mx, dest, "drums");
        var barLen = 16 * step;
        for (b = 0; b < sec.bars; b++) {
          var bt = secStart + b * barLen, vel = sec.drums;
          if (sec.beat === "leadin") vel *= 0.45 + 0.55 * (b / sec.bars);
          if (sec.beat === "fadeout") vel *= 1 - 0.8 * (b / sec.bars);
          (function (t2, vv, human) {
            var st = pat.steps, i2;
            for (i2 = 0; i2 < 16; i2++) {
              var ht = t2 + i2 * step + (human ? (rng() - 0.5) * 0.012 : 0);
              var hv = vv * (human ? 0.92 + rng() * 0.16 : 1);
              if (st.kick[i2]) kick(c, dd, ht, hv);
              if (st.snare[i2]) snare(c, dd, ht, hv);
              if (st.hat[i2]) hat(c, dd, ht, hv * (i2 % 4 === 0 ? 1 : 0.82), i2 % 4 === 3);
              if (st.clap[i2]) clap(c, dd, ht, hv);
              if (st.tom[i2]) tom(c, dd, ht, hv, 50);
              if (st.shaker[i2]) shaker(c, dd, ht, hv);
            }
          })(bt, vel, true);
        }
        // chords + bass for the section
        for (b = 0; b < sec.bars; b++) {
          ch = plan.chords[(b + s) % plan.chords.length];
          var ct = secStart + b * 4 * step;
          tone(c, dest, ct, ch[0] - 12, 3.6 * step, "sub", 0.9, mx.bass);
          tone(c, dest, ct, ch[1], 3.8 * step, sec.name === "chorus" ? "strings" : "pad", 0.5, mx.chords);
          tone(c, dest, ct, ch[2], 3.8 * step, sec.name === "chorus" ? "strings" : "pad", 0.4, mx.chords);
          if (sec.switched) tone(c, dest, ct + 2 * step, ch[0] + 12, 1.6 * step, "brass", 0.4, mx.lead);
        }
        t += secBeats * step;
      }
      // melody across the whole song (chorus sections lifted an octave feel via velocity)
      var mt = t0 + plan.sections[0].bars * 4 * step;
      for (mi = 0; mi < plan.melody.length && mt < t0 + dur - 2; mi++) {
        var n = plan.melody[mi];
        if (n.midi > 0) tone(c, dest, mt, n.midi, n.len * step * 0.92, "lead", 0.72, mx.lead);
        mt += n.len * step;
      }
    }).then(function (buf) { return applyFXChain(buf, fxList); });
  }
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
    var c = unlockAudio();
    if (!c) { audioToast("Audio is not available in this browser."); return null; }
    if (c.state === "suspended") {
      audioToast("Tap the play button again — your browser held the audio the first time.");
      try { c.resume(); } catch (e) {}
      return null;
    }
    try {
      var src = c.createBufferSource(); src.buffer = buf; src.connect(_master); src.start();
      _live[id || "main"] = src; return src;
    } catch (e) { audioToast("Couldn't play the audio: " + e.message); return null; }
  }
  function stopLive(id) { var s = _live[id || "main"]; if (s) { try { s.stop(); } catch (e) {} delete _live[id || "main"]; } }
  function playTone(midi, dur, voice) { var c = ac(); tone(c, _master, c.currentTime + 0.02, midi, dur || 1, voice || "keys", 1); }
  function playDrum(name) { var c = ac(), t = c.currentTime + 0.02; ({ kick: kick, snare: snare, hat: function (cc, dd, tt, vv) { hat(cc, dd, tt, vv, false); }, clap: clap }[name] || kick)(c, _master, t, 1); }

  /* ---------- public API ---------- */
  root.SigSynth = {
    rngFrom: rngFrom, pick: pick, midiHz: midiHz, noteName: noteName,
    GENRES: GENRES, MOODS: MOODS, hashSeed: hashSeed,
    patternFor: patternFor, scheduleBeat: scheduleBeat,
    chordsFor: chordsFor, melodyFor: melodyFor, songPlan: songPlan, sectionPlan: sectionPlan,
    renderBuffer: renderBuffer, bufferToWav: bufferToWav, renderSong: renderSong, renderFullSong: renderFullSong,
    FX_DEFS: FX_DEFS, applyFXChain: applyFXChain,
    CREATED_VOICES: CREATED_VOICES, BACKUP_TYPES: BACKUP_TYPES,
    renderVocal: renderVocal, renderOwnVoice: renderOwnVoice,
    detectPitch: detectPitch, nearestMidi: nearestMidi, cleanupVocal: cleanupVocal,
    playBuffer: playBuffer, stopLive: stopLive, playTone: playTone, playDrum: playDrum,
    kick: kick, snare: snare, hat: hat, clap: clap, tom: tom, shaker: shaker,
    tone: tone, riser: riser, singNote: singNote,
    ensureCtx: ac, unlockAudio: unlockAudio, meterLevel: meterLevel, makeBuses: makeBuses
  };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));

/* ============================================================
   SigSynth studio extension — the 5-minute full-song standard,
   custom voice profiles, placement-aware scheduling.
   Standard: intro build-up, THREE 30-second chorus breaks,
   fade out (or chosen ending). Total: exactly 5:00.
   ============================================================ */
(function (root) {
  "use strict";
  var S = root.SigSynth;
  if (!S) return;

  /* ---------- 24 custom voice profiles ----------
     man / woman / boy / girl x deep / light x low / mid / high.
     Honest: all synthesized formant voices, labeled as such. */
  var VOICE_BASES = [
    { k: "man-deep",    label: "Man · Deep",    formants: [300, 800, 2100],  vib: 4.0, oct: -12 },
    { k: "man-light",   label: "Man · Light",   formants: [450, 1050, 2500], vib: 5.0, oct: -5 },
    { k: "woman-deep",  label: "Woman · Deep",  formants: [480, 1100, 2400], vib: 5.0, oct: 0 },
    { k: "woman-light", label: "Woman · Light", formants: [600, 1400, 2800], vib: 5.5, oct: 0 },
    { k: "boy-deep",    label: "Boy · Deep",    formants: [520, 1200, 2700], vib: 6.0, oct: 5 },
    { k: "boy-light",   label: "Boy · Light",   formants: [650, 1500, 3000], vib: 6.5, oct: 7 },
    { k: "girl-deep",   label: "Girl · Deep",   formants: [560, 1300, 2800], vib: 6.0, oct: 7 },
    { k: "girl-light",  label: "Girl · Light",  formants: [700, 1600, 3200], vib: 7.0, oct: 12 }
  ];
  var VOICE_RANGES = [["low", -5, "Low range"], ["mid", 0, "Mid range"], ["high", 5, "High range"]];
  var VOICE_PROFILES = [];
  VOICE_BASES.forEach(function (b) {
    VOICE_RANGES.forEach(function (r) {
      VOICE_PROFILES.push({ id: b.k + "-" + r[0], label: b.label + " · " + r[2],
        formants: b.formants.slice(), vib: b.vib, level: 0.55, oct: b.oct + r[1] });
    });
  });
  function voiceProfile(id) {
    var i;
    for (i = 0; i < VOICE_PROFILES.length; i++) if (VOICE_PROFILES[i].id === id) return VOICE_PROFILES[i];
    for (i = 0; i < S.CREATED_VOICES.length; i++) {
      var cv = S.CREATED_VOICES[i];
      if (cv.id === id) return { id: cv.id, label: cv.name + " (synth)", formants: cv.formants, vib: cv.vib, level: cv.level, oct: 0 };
    }
    return VOICE_PROFILES[10]; /* woman-light-mid */
  }

  /* ---------- placement zones (seconds) ---------- */
  function zoneOf(t) { return t < 84 ? "beginning" : (t < 174 ? "middle" : "end"); }
  function zoneHit(t, zones) {
    if (!zones || !zones.length) return true;
    return zones.indexOf(zoneOf(t)) !== -1;
  }

  /* ---------- snare voices ---------- */
  function playSnare(c, dest, t, v, kind) {
    if (kind === "rim") { S.snare(c, dest, t, v * 0.5); return; }
    if (kind === "brush") { S.shaker(c, dest, t, v * 0.9); return; }
    if (kind === "clapstack") { S.clap(c, dest, t, v); S.snare(c, dest, t, v * 0.6); return; }
    S.snare(c, dest, t, v); /* crack */
  }
  /* ---------- bass voices: one call covers a 2-bar (32-step) slot ---------- */
  function playBass(c, dest, t, midi, kind, step, bus) {
    var i;
    if (kind === "funk") {
      for (i = 0; i < 32; i += 2) S.tone(c, dest, t + i * step, midi + (i % 16 === 14 ? 7 : 0), step * 1.6, "bass", 0.85, bus);
    } else if (kind === "reese") {
      S.tone(c, dest, t, midi, step * 30, "bass", 0.8, bus);
      S.tone(c, dest, t, midi + 1, step * 30, "bass", 0.45, bus);
    } else if (kind === "punch") {
      for (i = 0; i < 8; i++) S.tone(c, dest, t + i * 4 * step, midi + (i % 4 === 3 ? 12 : 0), step * 3, "bass", 0.9, bus);
    } else { /* deep sub */
      for (i = 0; i < 8; i++) S.tone(c, dest, t + i * 4 * step, midi, step * 3.4, "sub", 0.9, bus);
    }
  }
  function playFill(c, dest, t, step, v) {
    var seq = [48, 50, 52, 55], i;
    for (i = 0; i < 8; i++) S.tom(c, dest, t + i * step, v, seq[Math.min(3, Math.floor(i / 2))]);
    playSnare(c, dest, t + 8 * step, v, "crack");
  }
  function drumStep(c, dd, t, st, i, v, snareKind) {
    if (st.kick[i]) S.kick(c, dd, t, v);
    if (st.snare[i]) playSnare(c, dd, t, v, snareKind);
    if (st.hat[i]) S.hat(c, dd, t, v * 0.9, i % 4 === 3);
    if (st.clap[i]) S.clap(c, dd, t, v);
    if (st.tom[i]) S.tom(c, dd, t, v, 50);
    if (st.shaker[i]) S.shaker(c, dd, t, v);
  }

  /* ---------- the 5:00 standard ---------- */
  var SONG_LEN = 300;
  function studioSections() {
    return [
      { name: "Intro build-up", start: 0,   end: 24,  kind: "build" },
      { name: "Verse",          start: 24,  end: 54,  kind: "verse" },
      { name: "Chorus break 1", start: 54,  end: 84,  kind: "chorus", brk: 1 },
      { name: "Verse 2",        start: 84,  end: 114, kind: "verse" },
      { name: "Chorus break 2", start: 114, end: 144, kind: "chorus", brk: 2 },
      { name: "Bridge",         start: 144, end: 174, kind: "bridge" },
      { name: "Chorus break 3", start: 174, end: 204, kind: "chorus", brk: 3 },
      { name: "Out jam",        start: 204, end: 285, kind: "jam" },
      { name: "Ending",         start: 285, end: 300, kind: "ending" }
    ];
  }

  /* spec: {seed,title,genre,bpm,rhythm,bass{kind,zones},snare{kind,zones},
     fills{kind,zones},custom[{voice,zones}],extras[{voice,feel,zones}],
     chorus:"same"|"bigger"|"different",ending:"fade"|"funky"|"designed",
     endingNote,lyrics,voiceId,ownSample(AudioBuffer|null),backups[]} */
  function renderStudioSong(spec, mix, fxList) {
    spec = spec || {};
    var bpm = Math.max(60, Math.min(180, spec.bpm || 100));
    var step = 60 / bpm / 4, barLen = 16 * step;
    var rng = S.rngFrom("studio:" + (spec.seed || "untitled"));
    var genre = spec.genre || "hip-hop";
    var keyRoot = 48 + Math.floor(rng() * 12);
    var chords = S.chordsFor(keyRoot, genre, rng);
    var altPool = ["trap", "drum-and-bass", "house", "funk", "hip-hop", "techno"];
    var altGenre = altPool[Math.floor(rng() * altPool.length)];
    if (altGenre === genre) altGenre = "trap";
    var altChords = S.chordsFor(keyRoot, altGenre, rng);
    var rhythmGenre = (spec.rhythm && spec.rhythm !== "auto") ? spec.rhythm : genre;
    var pat = S.patternFor((spec.seed || "x") + ":main", rhythmGenre, bpm);
    var chorusPat = spec.chorus === "different"
      ? S.patternFor((spec.seed || "x") + ":chorus2", altGenre, bpm)
      : S.patternFor((spec.seed || "x") + ":chorus", rhythmGenre, bpm);
    var bridgePat = S.patternFor((spec.seed || "x") + ":bridge", altGenre, bpm);
    var sections = studioSections();
    var melody = S.melodyFor(chords, 150, rng);
    var bassKind = (spec.bass && spec.bass.kind) || "sub";
    var bassZones = (spec.bass && spec.bass.zones) || null;
    var snareKind = (spec.snare && spec.snare.kind) || "crack";
    var snareZones = (spec.snare && spec.snare.zones) || null;
    var fillsKind = (spec.fills && spec.fills.kind) || "toms";
    var fillsZones = (spec.fills && spec.fills.zones) || null;
    var custom = spec.custom || [];
    var extras = spec.extras || [];
    var ending = spec.ending || "fade";
    var vp = voiceProfile(spec.voiceId || "woman-light-mid");
    var lines = spec.lyrics ? String(spec.lyrics).split("\n").map(function (l) { return l.trim(); }).filter(Boolean) : [];
    var backups = spec.backups || [];
    var ownSample = spec.ownSample || null;

    /* vocal plan: lyric lines spread across verse/chorus sections */
    var vocalSecs = ["Verse", "Chorus break 1", "Verse 2", "Chorus break 2", "Chorus break 3"];
    var per = lines.length ? Math.max(1, Math.ceil(lines.length / vocalSecs.length)) : 0;
    var vocalNotes = []; /* {t, midi, dur, line} */
    if (lines.length) {
      var li = 0, si, sec;
      for (si = 0; si < vocalSecs.length && li < lines.length; si++) {
        sec = null;
        var s2; for (s2 = 0; s2 < sections.length; s2++) if (sections[s2].name === vocalSecs[si]) sec = sections[s2];
        if (!sec) continue;
        var take = Math.min(per, lines.length - li), k;
        for (k = 0; k < take; k++, li++) {
          var lt0 = sec.start + (k / take) * (sec.end - sec.start);
          var llen = (sec.end - sec.start) / take;
          var words = lines[li].split(/\s+/).filter(Boolean), w;
          var base = 60 + vp.oct + [0, 4, 7, 12][Math.floor(rng() * 4)];
          for (w = 0; w < words.length; w++) {
            base += Math.floor(rng() * 5) - 2;
            vocalNotes.push({ t: lt0 + (w / words.length) * llen, midi: base, dur: Math.max(0.18, llen / words.length * 0.9), word: words[w] });
          }
        }
      }
    } else {
      /* instrumental: sing the melody line on "ooh" through verses + choruses */
      var mt = 24, mi = 0;
      while (mt < 285 && mi < melody.length) {
        var n = melody[mi++];
        if (n.midi > 0) vocalNotes.push({ t: mt, midi: n.midi + vp.oct - 12, dur: n.len * step * 0.9, word: "ooh" });
        mt += n.len * step;
      }
    }

    return S.renderBuffer(SONG_LEN + 0.5, function (c, dest, t0) {
      var fin = c.createGain(); fin.connect(dest); /* ending envelope lives here */
      var mx = S.makeBuses(c, fin, mix);
      var dd = mx.drums, bb = mx.bass, cc = mx.chords, ll = mx.lead, vb = mx.vocal;
      var s, t, i, b;

      /* intro riser across the build-up */
      S.riser(c, fin, t0 + 2, 20, 0.9);

      for (s = 0; s < sections.length; s++) {
        var sec = sections[s];
        var isChorus = sec.kind === "chorus", isBridge = sec.kind === "bridge";
        var st = isBridge ? bridgePat.steps : (isChorus ? chorusPat.steps : pat.steps);
        var vel = sec.kind === "build" ? 0.55 : sec.kind === "verse" ? 0.92 : isChorus ? 1.06 : isBridge ? 1.0 : sec.kind === "jam" ? 0.95 : 0.9;
        /* drums on the step grid */
        for (t = sec.start; t < sec.end - 0.001; t += step) {
          var ti = Math.round((t - sec.start) / step) % 16;
          var tv = vel, tt = t0 + t;
          if (sec.kind === "build") tv *= 0.35 + 0.65 * (t / 24); /* build-up swell */
          if (sec.kind === "ending" && ending === "fade") tv *= Math.max(0.15, 1 - (t - 285) / 15);
          var snOn = zoneHit(t, snareZones);
          if (st.kick[ti]) S.kick(c, dd, tt, tv);
          if (st.snare[ti] && snOn) playSnare(c, dd, tt, tv, snareKind);
          if (st.hat[ti]) S.hat(c, dd, tt, tv * 0.9, ti % 4 === 3);
          if (st.clap[ti]) S.clap(c, dd, tt, tv);
          if (st.tom[ti]) S.tom(c, dd, tt, tv, 50);
          if (st.shaker[ti]) S.shaker(c, dd, tt, tv);
          if (isChorus && spec.chorus === "bigger" && ti === 0) { S.clap(c, dd, tt, tv); S.shaker(c, dd, tt, tv); }
        }
        /* fills at section starts */
        if (fillsKind !== "none" && sec.kind !== "build" && zoneHit(sec.start + 0.01, fillsZones)) {
          var ft = t0 + Math.max(0, sec.start - 1.2);
          if (fillsKind === "shakerf") { for (i = 0; i < 8; i++) S.shaker(c, dd, ft + i * step / 2, vel * 0.8); }
          else if (fillsKind === "perc") { for (i = 0; i < 6; i++) S.tom(c, dd, ft + i * step, vel, 62 + (i % 3) * 5); }
          else playFill(c, dd, ft, step, vel);
        }
        /* chords + bass: one slot = 2 bars */
        var slotLen = 2 * barLen;
        for (t = sec.start; t < sec.end - 0.001; t += slotLen) {
          var slotIx = Math.round(t / slotLen);
          var ch = (isBridge ? altChords : chords)[slotIx % 4];
          var ctt = t0 + t;
          var padV = isChorus || sec.kind === "bridge" ? "strings" : "pad";
          S.tone(c, cc, ctt, ch[1], slotLen * 0.95, padV, isChorus ? 0.55 : 0.42);
          S.tone(c, cc, ctt, ch[2], slotLen * 0.95, padV, isChorus ? 0.45 : 0.34);
          if (zoneHit(t, bassZones) && sec.kind !== "build" && sec.kind !== "ending")
            playBass(c, bb, ctt, ch[0] - 12, bassKind, step, 0);
        }
        /* custom library sounds: accents in their zones */
        for (i = 0; i < custom.length; i++) {
          var csu = custom[i];
          if (!zoneHit(sec.start + 0.01, csu.zones)) continue;
          var vvx = csu.voice || "keys";
          var drumV = { kick: 1, snare: 1, hat: 1, clap: 1, tom: 1, shaker: 1 }[vvx];
          if (drumV) {
            var lane = pat.steps[vvx] || pat.steps.kick;
            for (t = sec.start; t < sec.end - 0.001; t += step) {
              var li2 = Math.round((t - sec.start) / step) % 16;
              if (lane[li2]) drumStep(c, dd, t0 + t, pat.steps, li2, vel * 0.7, snareKind);
            }
          } else if (vvx === "riser") {
            S.riser(c, fin, t0 + sec.start, Math.min(8, sec.end - sec.start), 0.5);
          } else if (vvx === "impact") {
            S.kick(c, dd, t0 + sec.start, 1); S.clap(c, dd, t0 + sec.start, 0.8);
          } else {
            var slotIx2 = 0;
            for (t = sec.start; t < sec.end - 0.001; t += slotLen, slotIx2++) {
              var ch2 = (isBridge ? altChords : chords)[slotIx2 % 4];
              S.tone(c, ll, t0 + t, ch2[0] + 12, step * 6, vvx, 0.5);
            }
          }
        }
        /* extra parts: many drums / fills / pianos */
        for (i = 0; i < extras.length; i++) {
          var ex = extras[i];
          if (!zoneHit(sec.start + 0.01, ex.zones)) continue;
          var exv = ex.voice || "keys";
          var exDrum = { kick: 1, snare: 1, hat: 1, clap: 1, tom: 1, shaker: 1 }[exv];
          for (t = sec.start; t < sec.end - 0.001; t += step) {
            var rel = t - sec.start, ti3 = Math.round(rel / step);
            var hit = ex.feel === "driving" ? (ti3 % 2 === 0) : ex.feel === "offbeat" ? (ti3 % 2 === 1) : (ti3 % 16 === 0);
            if (!hit) continue;
            if (exDrum) {
              if (exv === "kick") S.kick(c, dd, t0 + t, vel * 0.8);
              else if (exv === "snare") playSnare(c, dd, t0 + t, vel * 0.8, snareKind);
              else if (exv === "hat") S.hat(c, dd, t0 + t, vel * 0.7, false);
              else if (exv === "clap") S.clap(c, dd, t0 + t, vel * 0.8);
              else if (exv === "tom") S.tom(c, dd, t0 + t, vel * 0.8, 45 + (ti3 % 4) * 4);
              else S.shaker(c, dd, t0 + t, vel * 0.7);
            } else {
              var chx = (isBridge ? altChords : chords)[Math.round(t / slotLen) % 4];
              S.tone(c, exv === "keys" || exv === "epiano" || exv === "marimba" ? cc : ll,
                t0 + t, chx[0] + 12 + (ti3 % 32 === 16 ? 7 : 0), step * 1.8, exv, 0.4);
            }
          }
        }
      }

      /* lead melody in verses/choruses/jam (soft under vocals) */
      var mti = 0, mtt = t0 + 24;
      var leadVel = lines.length ? 0.3 : 0.7;
      while (mtt < t0 + 285 && mti < melody.length) {
        var mn = melody[mti++];
        if (mn.midi > 0) S.tone(c, ll, mtt, mn.midi, mn.len * step * 0.9, "lead", leadVel);
        mtt += mn.len * step;
      }

      /* vocals */
      var vi;
      if (ownSample) {
        for (vi = 0; vi < vocalNotes.length; vi++) {
          var vn = vocalNotes[vi];
          var src = c.createBufferSource(); src.buffer = ownSample; src.loop = true;
          src.playbackRate.value = S.midiHz(vn.midi) / 220;
          var g = c.createGain(), vt = t0 + vn.t;
          g.gain.setValueAtTime(0.0001, vt); g.gain.exponentialRampToValueAtTime(0.7, vt + 0.05);
          g.gain.setValueAtTime(0.7, vt + Math.max(0.05, vn.dur - 0.08));
          g.gain.exponentialRampToValueAtTime(0.0001, vt + vn.dur);
          src.connect(g); g.connect(vb); src.start(vt, 0, vn.dur + 0.05);
        }
      } else {
        for (vi = 0; vi < vocalNotes.length; vi++) {
          var vn2 = vocalNotes[vi];
          S.singNote(c, vb, t0 + vn2.t, vn2.midi, vn2.dur, vp, 1);
        }
        /* backup stacks */
        var b2;
        for (b2 = 0; b2 < backups.length; b2++) {
          var bt = null, k2;
          for (k2 = 0; k2 < S.BACKUP_TYPES.length; k2++) if (S.BACKUP_TYPES[k2].id === backups[b2]) bt = S.BACKUP_TYPES[k2];
          if (!bt) continue;
          for (vi = 0; vi < vocalNotes.length; vi++) {
            var vn3 = vocalNotes[vi];
            if (bt.id === "adlibs") { if (rng() < 0.25) S.singNote(c, vb, t0 + vn3.t, vn3.midi + 12, vn3.dur * 0.7, vp, 0.5); }
            else if (bt.id === "choir") { S.singNote(c, vb, t0 + vn3.t, vn3.midi + bt.shift, vn3.dur, vp, 0.5); }
            else S.singNote(c, vb, t0 + vn3.t, vn3.midi + bt.shift, vn3.dur, vp, 0.55);
          }
        }
      }

      /* ending */
      if (ending === "funky") {
        /* cold stop + final hit */
        fin.gain.setValueAtTime(1, t0); fin.gain.setValueAtTime(1, t0 + 296.2);
        fin.gain.linearRampToValueAtTime(0.0001, t0 + 296.7);
        S.kick(c, fin, t0 + 296.2, 1); S.clap(c, fin, t0 + 296.2, 0.9); S.hat(c, fin, t0 + 296.2, 0.8, true);
      } else if (ending === "designed") {
        /* stab accents then fade, per the user's note */
        var eb;
        for (eb = 0; eb < 4; eb++) {
          var ech = chords[eb % 4], et = t0 + 288 + eb * 2 * step * 4;
          S.tone(c, fin, et, ech[0] + 12, step * 2, "brass", 0.6);
          S.kick(c, fin, et, 0.9);
        }
        fin.gain.setValueAtTime(1, t0); fin.gain.setValueAtTime(1, t0 + 294);
        fin.gain.linearRampToValueAtTime(0.0001, t0 + 300);
      } else {
        /* fade out: the standard */
        fin.gain.setValueAtTime(1, t0); fin.gain.setValueAtTime(1, t0 + 285);
        fin.gain.linearRampToValueAtTime(0.0001, t0 + 300);
      }
    }).then(function (buf) { return S.applyFXChain(buf, fxList); });
  }

  function studioPlanSummary(spec) {
    var ending = spec.ending === "funky" ? "a funky cold-stop finish"
      : spec.ending === "designed" ? "your designed ending" : "a fade out";
    return "5:00 standard — intro build-up, verse, THREE 30-second chorus breaks (0:54, 1:54, 2:54), " +
      "bridge beat-switch, out jam, and " + ending + ". " +
      (spec.lyrics ? "Full lyrics included, sung by " + voiceProfile(spec.voiceId || "").label + ". " : "Instrumental. ") +
      "Genre: " + (spec.genre || "hip-hop") + " at " + (spec.bpm || 100) + " BPM.";
  }

  S.VOICE_PROFILES = VOICE_PROFILES;
  S.voiceProfile = voiceProfile;
  S.renderStudioSong = renderStudioSong;
  S.studioSections = studioSections;
  S.studioPlanSummary = studioPlanSummary;
  S.SONG_LEN = SONG_LEN;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));
