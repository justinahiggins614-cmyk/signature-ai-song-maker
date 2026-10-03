# Signature Music Record Standard v1.0

Machine-readable record law for **The Signature Music Studio**
(`signature-ai-song-maker`). Every field below is grounded in the code that
produces it — `assets/engine.js`, `assets/synth.js`, `assets/app*.js`,
`code/drip.py`, `code/seed.py`, `code/build_site_files.py`. Nothing here is
invented. JSON Schemas for each record type live in `schemas/`.

## 1. ID schemes — all ten

IDs are **permanent and never reused**. Deleting a record never frees its ID.
The reproducible seed for every archive record is its number `n`
(`SigData.gen(kind, n)`; `rngFrom("<prefix>:" + n)`).

| Kind | ID format | Status (2026-10-03) | Canonical deep link |
|---|---|---|---|
| Song | `JAH-SONG-%07d` | Live (counts: `music-manifest.json`) | `?song=JAH-SONG-0000001` |
| Beat | `JAH-BEAT-%07d` | Live (counts: `music-manifest.json`) | `?beat=JAH-BEAT-0000001` |
| Sound (library) | `JAH-SOUND-%07d` | Live (counts: `music-manifest.json`) | `?sound=JAH-SOUND-0000001` |
| Equipment | `JAH-GEAR-%07d` | Live (counts: `music-manifest.json`) | `?gear=JAH-GEAR-0000001` |
| Voice | `JAH-VOICE-%06d` | Live, 4 issued (Nova/Ember/Drift/Stone) | — (no per-voice page) |
| Project | `JAH-PROJECT-%07d` | **Reserved** — no IDs issued | — |
| CD | `JAH-CD-%07d` | **Reserved** — no IDs issued | — |
| Mix | `JAH-MIX-%07d` | **Reserved** — no IDs issued | — |
| Cleanup | `JAH-CLEANUP-%07d` | **Reserved** — no IDs issued | — |
| Patch | `JAH-PATCH-%07d` | **Reserved** — no IDs issued | — |

Canonical URLs are the site base
(`https://justinahiggins614-cmyk.github.io/signature-ai-song-maker/`) plus the
query above. The record router (`assets/app.js` `route()`) resolves exactly
one of `song`, `sound`, `gear`, `beat`. ID regexes:
`^JAH-(SONG|SOUND|GEAR|BEAT)-\d{7}$`, `^JAH-VOICE-\d{6}$`. IDs march toward
1,000,000 per catalog, hence 7 digits (6 for the four voices).

## 2. Required vs optional fields per record type

The generators return fixed shapes — there are no optional fields on issued
archive records. "Optional" appears only where the UI adds session-only data.

- **Song** (`schemas/song.schema.json`): all required — `id, kind, n, title,
  genre, mood, tempo, key, lyrics, chords, structure, desc`.
  Session-written songs (`window.__writeSong`, `assets/app2.js`) keep the full
  shape but may override `title`, `genre`, `mood`; they may add a session-only
  `styleNote` (never archived).
- **Beat** (`schemas/beat.schema.json`): all required — `id, kind, n, name,
  style, bpm, era, desc`.
- **Sound** (`schemas/sound.schema.json`): all required — `id, kind, subtype,
  n, name, cat, voice, bright, warm, attack, desc`. Note: `attack` is a
  **string** (`(rng()*0.4).toFixed(2)`, e.g. `"0.23"`); `subtype` cycles
  deterministically as `n % 4` → `sound | instrument | set | pack`.
- **Equipment** (`schemas/equipment.schema.json`): all required — `id, kind,
  n, name, cat, desc, patch`.
- **Voice** (`schemas/voice.schema.json`): all required — `id, jahId,
  version, name, desc, formants[3], vib, level`. The `desc` must state the
  voice is synthesized (see §6).
- **Mix** (`schemas/mix.schema.json`): all required — the 5 bus gains
  `drums, bass, chords, lead, vocal` (0–1, default 1).
- **Project** (`schemas/project.schema.json`): the Studio Session shape from
  `freshProject()` (`assets/app6.js`) — `sounds, beat, instruments, lyrics,
  song, vocal, mix, fx, cd, genre, bpm, stage` all present (`beat`/`song` may
  be `null`). `micBuf` (recorded mic AudioBuffer) is **runtime-only** and is
  excluded from localStorage persistence by the replacer in `saveProj()`.
- **CD track** (`schemas/cd-record.schema.json`): `title` + `start` required;
  `id` present in the album-maker flow, absent in the stage-7 tagged build;
  `buf` is a runtime-only Web Audio AudioBuffer, never serialized.
- **Patch** (`schemas/patch.schema.json`): reserved; intended shape —
  `id, kind, equipment_id, equipment_name, patch, guide_class`.
- **Cleanup** (vocal cleanup records, reserved): intended shape grounded in
  `assets/app3.js` — input is a user-uploaded vocal (on-device only, never
  persisted); operations are the honest cleanup chain (`de-rumble`, `de-hiss`
  via gentle gate, `compression`, `normalize`) or `re-sing` (pitch-detected
  notes re-sung by the Nova synth voice).

## 3. Provenance vocabulary

The site's own words, from `assets/app.js` `recStatus()` and the record panel:

- `SIGNATURE ORIGINAL` — equipment only. Every `JAH-GEAR-######` record.
- `GENERATED` — songs, sounds, beats. Every archive song/sound/beat record.
- `SOURCE: Signature Music Studio · studio engine` — the record panel source
  line shown on every record.
- Deterministic seed line: *"reproducible seed **n** — the same ID always
  makes this exact record."*

## 4. Equipment: SIGNATURE-ORIGINAL vs EXTERNAL-REFERENCE

- **SIGNATURE-ORIGINAL**: equipment conceived and specced by the Signature
  studio. All 350 issued gear records are Signature-original (every name
  begins "Signature …", every record carries status `SIGNATURE ORIGINAL`).
- **EXTERNAL-REFERENCE**: reserved classification for equipment *not* made by
  the Signature studio that the catalog might reference in the future (real
  third-party instruments, mics, interfaces). **No EXTERNAL-REFERENCE records
  exist and none are issued by any code on the site.** The vocabulary exists
  so a future external reference is never mislabeled as Signature-original.

## 5. "Real patch guides" — the four honesty classes

Every equipment record carries a generated `patch` guide (routing through a
patch bay row → preamp → interface input, plus a gain note). Patch guides are
classified by what they actually are — never more:

- **conceptual** — a general idea of how a piece *could* be patched, not tied
  to a specific equipment record.
- **documented** — a written routing guide for a specific equipment record.
  This is what the archive's `patch` fields are: deterministic generated text
  written against the named Signature equipment (e.g. *"Patch guide:
  Signature Stage Electric Guitar Mk 3 -> direct to interface -> PA-2 tube
  preamp -> IO-8 input 7. Set gain so peaks hit -12 dB."*). Accurate as
  documentation; not a measurement.
- **simulated** — a routing verified by rendering it through the studio
  engine. Not claimed by any current record.
- **physically-tested** — a routing verified on real hardware. **Not claimed
  by any current record.** Nothing in the code, pages, or schemas asserts
  physical testing.

The music teacher (`assets/engine.js` THEORY, "Mics and patching" entry)
describes the guides as telling the user "exactly which row and input to
use" — that is a description of the *documented* guide content, not a claim
of physical testing.

## 6. The no-human-singers rule

**All voices on this site are synthesized. There are no human singers —
no exceptions.** Stated in: `index.html` (the honesty banner and the vocal
studio/backup/cleanup sections), `assets/synth.js` header ("Honest design:
voices are synthesized, never human singers"), `assets/engine.js` THEORY
("never recordings of human singers"), `music-manifest.json`
(`voices_note`). Every voice record's `desc` states it is synthesized
("Bright airy synthesized soprano", etc.). Re-sung vocals are sung back by
the Nova synth voice, labeled synthesized. The user's own recorded sample is
resynthesized onto the melody — the sample stays on the user's device only.

## 7. AI honesty rule — NOT COVERED, never hallucinate

The site's AIs answer **only** from the site's own data:

- The music teacher (`SigData.teach`, `assets/engine.js`) answers from its
  knowledge base of site-grounded topics. Anything else returns
  *"The music teacher only answers from this site's own studio data …
  That question isn't covered yet."* (`covered: false`).
- The per-record Q&A (`recordQA`, `assets/app.js`) answers only from the
  record's own fields; anything else returns *"I can only answer from this
  record's own data … That isn't covered here."*
- Backup-singer demos are *"Labeled synthesized, always."*
- **Rule: when the data doesn't cover a question, the AI says so and stops.
  It never invents facts, people, history, or capabilities.**

## 8. No license field in JSON-LD

The record-page JSON-LD (`assets/app.js` `__showRecord`) is
`@type: MusicRecording` with `name, identifier, byArtist (Person
"Justin Addam Higgins"), description, url`, plus a computed `duration`
(estimate from bars × tempo — never a claimed audio file) and `genre` /
`recordingOf` for songs. **There is no `license` field, and none may be
added** — nothing on the site grants or claims a license. The same applies to
`music-manifest.json` and `api.json`.
