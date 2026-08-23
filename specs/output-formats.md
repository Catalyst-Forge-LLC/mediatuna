# Output formats (tentative)

**Status:** Parked. Defaults stay **MP4 (H.264 + AAC)** and **MP3**. Do not implement until a real archive run needs size or a lossless-out path.

MediaTuna’s job is files that play on a TV, a phone, a car stereo, and a relative’s laptop. Extra modern targets are optional later, not a second default. Skip/resume/verify/cleanup all assume one video extension and one audio extension.

## Defaults (shipped)

| Kind | Container | Codec | Why |
|------|-----------|--------|-----|
| Video | `.mp4` | H.264 + AAC (copy AAC LC when already stereo/mono) | Plays everywhere that matters for a home archive |
| Audio | `.mp3` | LAME VBR (`--audio-quality`) | Same. Skip when already normalized |

## Parked — maybe later, opt-in only

| ID | Flag (sketch) | What | When to reopen |
|----|---------------|------|----------------|
| OF-1 | `--codec hevc` | H.265 **inside MP4** (same extension, dates, `faststart`) | Overnight archives where size hurts and playback targets are known-good (phones, recent TVs). FE-14 / HS-49. |
| OF-2 | `--format flac` | Lossless audio out for FLAC/WAV/ALAC **sources only** | Someone is taking the `[lossy]` warning seriously and wants an archivist path. |

OF-1 is the only “more modern” encode that keeps the mental model (“it’s still an MP4”). Document the compatibility caveat if it ships: older TVs and cheap players can choke.

## Parked — later than OF-1 / OF-2

| ID | Idea | Why it waits |
|----|------|----------------|
| OF-3 | AAC `.m4a` as alternate audio target | Better per bit, Apple-native. MP3 already plays there. Not worth a second audio pipeline until OF-1 or OF-2 exists. |

## Out of scope (do not add as defaults)

AV1, WebM, Opus, MKV as a default or as a format menu. Encode cost, spotty living-room playback, messier tags, and a second “already done?” path. Wrong for a family archive.

## What must not break if a parked flag ships

- One dest path per source (skip/exists, resume, `--sample`, `--extract-audio`)
- Verify stays duration/probe, not a bitstream compare
- `--cleanup-originals` / `--archive` / `--delete-originals` still key off the same dest
- Preflight still says `convert → mp4` / `convert → mp3` unless the flag is on

## Pointers

- FE-14: [improvements.md](./improvements.md) §3.2
- HS-49: [partial/hardening.md](./partial/hardening.md) §4
- FLAC out / AAC `.m4a` open questions: [mediatuna.md](./mediatuna.md) §12–14
