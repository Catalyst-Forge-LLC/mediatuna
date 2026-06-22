# MediaTuna rebrand + audio M1/M2 (completed)

**Status:** Shipped 2026-06-22  
**Archived from:** [mediatuna.md](../mediatuna.md)

---

## Rebrand

- CLI, package, repo: **MediaTuna** / `Catalyst-Forge-LLC/mediatuna`
- Logs: `mediatuna-log.txt`, `mediatuna-failed.txt`
- No `vidtuna` binary or alias

## Phase M1 — Audio MVP

- `--audio-only` mode; LAME VBR via shared `--quality`
- Audio discovery, probe, MP3 encode, skip-if-exists
- Preflight **Type** column; lossy warnings (FLAC/WAV → MP3)
- `-map_metadata 0`; filesystem timestamps; duration verify

## Phase M2 — Metadata polish

- Album art embed (default on); `--no-embed-art`
- Tag-drop warnings on verify; `--prefer-mtime` for missing dates
- Cover-art streams classified as audio, not video

## Supported formats (baseline at ship)

**Video → MP4:** AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG (WMV/3GP added later — see M3 doc)

**Audio → MP3:** MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS
