# Determinism — Signature Music Studio

Formal statement of "the same request always makes the same music"
(`index.html` honesty banner; `assets/engine.js` header: *"Same seed ->
same record, forever"*).

## Definitions

- **ORIGINAL-REQUEST** — the user's raw input: a theme string ("midnight
  highway"), a beat prompt ("gritty 90s boom-bap"), a song ID, a mix/fader
  setup. Whatever the user typed or picked, verbatim.
- **NORMALIZED-REQUEST** — the canonical string the engine actually hashes.
  E.g. for theme→ID mapping: `"songtheme:" + theme` (see `themeToN` in
  `assets/app2.js`). For beats: `prompt + "|" + genre + "|" + bpm` (see
  `patternFor` in `assets/synth.js`).
- **SEED** — the record number `n` (integer ≥ 1), or the unsigned 32-bit
  integer returned by the seed hash. Archive records are seeded by their
  number: `rngFrom("songrec:" + n)`, `rngFrom("beatrec:" + n)`,
  `rngFrom("soundrec:" + n)`, `rngFrom("gearrec:" + n)` (`assets/engine.js`).
- **SEED-ALGORITHM** — the hash behind `SigSynth.hashSeed` / `rngFrom`.
  `rngFrom(str)` = `mulberry32(xmur3(str)())` (`assets/synth.js`).
  (Fixed 2026-10-03: the manifest/builder label now correctly says xmur3.
  Behavior is locked by `code/test_vectors.json` — 40 vectors, verified by
  `code/verify_test_vectors.py`.)
- **ENGINE-VERSION** — `SIGMUSIC-V1` (current). Recorded in
  `music-manifest.json` → `engine.version`.
- **SOUND-LIBRARY-VERSION** — `SIGSOUND-V1`. Recorded in
  `music-manifest.json` → `engine.sound_library_version`.
- **VOICE-VERSION** — per-voice version in `SigSynth.CREATED_VOICES`.
  Current: `v1` on Nova, Ember, Drift, Stone.
- **OUTPUT-HASH** — `sha256` of the **canonical record JSON**:
  `json.dumps(record, sort_keys=True, ensure_ascii=False,
  separators=(",", ":"))` encoded UTF-8. This is what `code/test_vectors.json`
  stores per record. It hashes the record *spec*, not rendered audio.

## Request → seed → record

1. Theme → record number: `n = 1 + hashSeed("songtheme:" + theme) % 1000000`
   (`themeToN`, `assets/app2.js`). Same theme → same `n`, always.
2. Record number → record: `SigData.gen(kind, n)` — `genSong`, `genBeat`,
   `genSound`, `genGear` (`assets/engine.js`). All randomness comes from the
   seeded RNG; `assets/engine.js` and `assets/lyrics.js` contain **no
   `Math.random()`** (verified by grep). Same `n` → same record, byte for
   byte, forever — including lyrics (`writeLyrics(rng, theme)`), chord
   progressions, beat patterns, patch guides.
3. Request → beat pattern: `patternFor(prompt, genre, bpm)` seeds from
   `prompt|genre|bpm`; vintage-era patterns (`eraSteps`) are seeded too.

## What "same" guarantees — exactly

Given the **same seed `n` (or same ORIGINAL-REQUEST), same ENGINE-VERSION,
same SOUND-LIBRARY-VERSION, and same VOICE-VERSION**:

- ✅ The full **record spec** is bit-identical: title, genre, mood, tempo,
  key, lyrics, chords, structure (`genSong`); name, style, bpm, era
  (`genBeat`); name, subtype, cat, voice, bright, warm, attack
  (`genSound`); name, cat, patch guide (`genGear`).
- ✅ The full **composition plan** is bit-identical: chord voicings
  (`chordsFor`), melodies (`melodyFor`), 16-step drum patterns
  (`patternFor`), section plans (`sectionPlan`, `songPlan`,
  `studioSections`), vocal note placements (`renderStudioSong`).
- ✅ The **song spec is version-independent**: per `music-manifest.json`
  `provenance.composition_stable`, the spec (notes/chords/lyrics/structure)
  stays valid and reproducible even if the render engine improves.
- ✅ Rendered **WAV bytes are bit-identical** across renders on the same
  engine version: every randomness source is seeded, including the drum/FX
  noise layer (`noiseBuffer` uses `mulberry32(0xC0FFEE)` — fixed 2026-10-03;
  previously `Math.random()`). OUTPUT-HASH covers the record spec; the
  scheduled audio (notes, patterns, envelopes, seeded reverb, FX chain) plus
  the seeded noise floor reproduce the same WAV every time.
- ℹ️ Any `JAH-SONG|SOUND|GEAR|BEAT-#######` ID resolves to a record even
  outside the archived range: `findRecord` (`assets/app.js`) falls back to
  deterministic regeneration (`detGen` → `SigData.gen(kind, n)`). The
  session registry (`window.__genSongs`) takes precedence: an AI-written
  song resolves to the exact record the user saw, not the archive version.

## Engine versioning policy

- Current: **SIGMUSIC-V1**. Old engine versions are **preserved**, not
  overwritten: a new engine ships as `SIGMUSIC-V2` (new files), and records
  keep reproducing under the version named in the manifest that shipped
  them.
- Because the record spec is version-independent, a `SIGMUSIC-V1` spec
  remains a valid, reproducible composition under newer engines; only the
  render layer may improve.
- Voice versions advance independently (`VOICE-VERSION` per voice); a voice
  ID (`JAH-VOICE-######`) is never reused when its version advances.
