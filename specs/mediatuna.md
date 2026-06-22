# MediaTuna Extension Spec

**Status:** Draft (spec only — not implemented)  
**Last reviewed:** 2026-06-22  
**Depends on:** VidTuna Phase 1–3 (current `index.js`)  
**Related:** [improvements.md](./improvements.md), FineTuna product line

---

## 1. Vision

Extend the current VidTuna CLI into **MediaTuna**: a unified batch normalizer for legacy **home media** that outputs two canonical formats:

| Output | Use case |
|--------|----------|
| **MP4** (H.264 + AAC) | Video — unchanged from VidTuna today |
| **MP3** (LAME VBR) | Audio — music, voice memos, tape rips, CD extracts |

**Normalize** means: predictable outputs, preserved metadata where possible, no silent quality loss beyond what's required for the target format, and safe skip when the file is already in the target format and quality bar is met.

**Not in scope for v1 of this spec:** cloud upload, GUI, streaming, editing, or replacing dedicated archival tools (FLAC preservation, ProRes masters).

---

## 2. Naming & product relationship

### Option A — Rebrand (recommended long-term)

| Before | After |
|--------|-------|
| `vidtuna` CLI | `mediatuna` CLI |
| `VidTuna` | `MediaTuna` |
| Repo `vidtuna` | Repo rename or new `mediatuna` with redirect |

**Tagline:** *The FineTuna companion for old media.*

VidTuna becomes the video profile inside MediaTuna, not a separate product.

### Option B — Umbrella command with sub-modes

Keep `vidtuna` as a thin alias; add `mediatuna` as the primary binary:

```bash
mediatuna ./archive          # video + audio (default: all)
mediatuna ./music --audio    # audio only
mediatuna ./tapes --video    # video only (today's behavior)
```

### Option C — Stay VidTuna, add `--audio`

Minimal rename friction; worse discoverability for audio-only users.

**Recommendation:** Plan for **Option A** with a transition period where `vidtuna` prints a deprecation notice and delegates to `mediatuna --video`.

---

## 3. Goals

1. **One tool** for “convert this folder of old stuff to modern MP4/MP3.”
2. **Metadata-first** — tags, dates, album art, and filesystem timestamps survive when ffmpeg can map them.
3. **Quality-aware** — presets mean “as good as the target format allows,” not “smallest file.”
4. **Same UX** as VidTuna: preflight table, dry-run, quiet console, progress bars, failed-files list.
5. **Reuse** existing pipeline code (probe → classify → encode → verify → log).

---

## 4. Non-goals (initial release)

- Re-encoding MP3 → MP3 “for normalization” unless `--force` or quality check fails
- Lossless audio output (FLAC/ALAC) — future optional profile
- Ripping CDs (TOC/cue sheet) — separate tool or later phase
- Extracting audio tracks from video automatically (optional later; see §8)
- DRM removal
- Parallel jobs (Phase 4 of VidTuna roadmap)

---

## 5. Input & output matrix

### 5.1 Video (unchanged baseline)

| Input | Output | Notes |
|-------|--------|-------|
| AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, … | `.mp4` | Current VidTuna behavior |
| Already H.264/AAC in MP4 | Skip (or copy remux with `--force`) | See §7.3 |

### 5.2 Audio (new)

| Input extensions | Output | Decoder notes |
|------------------|--------|---------------|
| MP3 | `.mp3` | Skip if already meets quality policy |
| FLAC, WAV, AIFF, APE | `.mp3` | Lossy transcode; warn in preflight |
| M4A, AAC, ALAC | `.mp3` | ALAC → lossy; log `[WARN] lossy conversion` |
| OGG, Opus | `.mp3` | |
| WMA | `.mp3` | Requires ffmpeg WMA demux support |
| AC3, DTS (standalone) | `.mp3` | Rare in home archives |

**Probe rule:** classify by ffprobe `codec_type=audio` stream (and no video, or `--audio` with video file = extract audio only — phase 2).

### 5.3 Target encode specs

#### MP4 (video) — existing

| Preset | Video | Audio |
|--------|-------|-------|
| high | NVENC CQ 15 / x264 CRF 16 | AAC 192k |
| medium | NVENC CQ 18 / x264 CRF 18 | AAC 192k |
| fast | NVENC P4 / x264 CRF 23 | AAC 192k |

#### MP3 (audio) — proposed

| Preset | LAME settings | Approx. use |
|--------|---------------|-------------|
| high | `-q:a 0` (V0 ~245 kbps VBR) | Archival listening |
| medium | `-q:a 2` (V2 ~190 kbps VBR) | Default; matches “good” home rip |
| fast | `-q:a 4` (V4 ~165 kbps VBR) | Bulk backlog |

**Optional explicit CBR** for compatibility pedants: `--audio-bitrate 320` overrides VBR.

**Quality preservation principle:** Use VBR quality steps, not arbitrary 128k CBR. Log effective bitrate range in post-encode verify line.

---

## 6. Metadata preservation

### 6.1 What to preserve

| Media | Container tags | Filesystem | Embedded art |
|-------|----------------|------------|--------------|
| Video → MP4 | `-map_metadata 0` (done today) | mtime + Windows CreationTime (done today) | N/A usually |
| Audio → MP3 | ID3v2 via ffmpeg `-map_metadata 0` + `-id3v2_version 3` | Same as video | Copy attached pictures: `-map 0:v?` → `-c:v copy` into MP3 cover art, or `-write_id3v1 0` |

### 6.2 Tag mapping challenges

| Issue | Approach |
|-------|----------|
| MP4 atoms → ID3 | ffmpeg handles most; log unmapped tags at `--verbose` |
| Missing year/date | Fall back to file mtime as `date` tag (opt-in `--prefer mtime`) |
| Multi-artist / compilation | Preserve raw strings; no smart parsing in v1 |
| Gapless / iTunes flags | Best-effort; document as lossy for MP3 |
| Unicode | UTF-8 ID3; verify with ffprobe post-encode |

### 6.3 Verification (extend FE-25)

After audio encode:

- ffprobe confirms audio stream present, duration within tolerance
- Optional: compare tag keys count (source vs dest) and warn if >N tags dropped
- File size sanity check (MP3 shouldn’t be 0 bytes or 10× source FLAC)

---

## 7. Pipeline architecture

### 7.1 Media type detection

```
ffprobe → streams[]
  has video?  → video candidate
  has audio only? → audio candidate
  neither? → unreadable
  both? → video (default) OR audio extract (future flag)
```

Preflight table adds a **Type** column: `video`, `audio`, `unreadable`.

### 7.2 Shared modules (Phase 4 refactor enables this)

| Module | Video | Audio |
|--------|-------|-------|
| `discover.ts` | ext glob | ext glob (union) |
| `probe.ts` | duration, interlace | duration, bitrate, tags, art |
| `classify.ts` | skip / convert | skip / convert / lossy-warn |
| `encode.ts` | NVENC/x264 pipeline | LAME pipeline |
| `verify.ts` | duration ±5% | duration + optional tag check |
| `metadata.ts` | utimes, Windows | utimes, Windows, ID3 |

### 7.3 Smart skip (avoid needless generation loss)

| Condition | Action |
|-----------|--------|
| Output `.mp4` exists | Skip (today) |
| Output `.mp3` exists | Skip |
| Source is MP3, output MP3, bitrate ≥ preset floor, tags OK | Skip with `[already normalized]` |
| Source is AAC in M4A, user wants MP3 | Convert with lossy warning |
| `--force` | Always re-encode |

### 7.4 Unified preflight table (example)

```
  File                    Type    Duration    Size       Status
  ───────────────────────────────────────────────────────────────
  vacation.mov            video   01:27:54    18.8 GB    convert → mp4
  mixtape.flac            audio   00:45:12    320 MB     convert → mp3 [lossy]
  song.mp3                audio   00:03:45    8.2 MB     skip (normalized)
  corrupt.wma             audio   —           0 B        unreadable
  ───────────────────────────────────────────────────────────────
  12 file(s): 4 → mp4, 3 → mp3, 4 skip, 1 unreadable
```

---

## 8. CLI design

### 8.1 Mode flags

| Flag | Default | Description |
|------|---------|-------------|
| `--video` | on when neither set | Process video files only |
| `--audio` | on when neither set | Process audio files only |
| `--video-only` / `--audio-only` | — | Restrict to one media class |
| (default) | both | Full MediaTuna pass |

When both default on: one folder scan, two output types side by side.

### 8.2 Audio-specific flags

| Flag | Description |
|------|-------------|
| `--audio-quality high\|medium\|fast` | Default: share `--quality` or split if video/audio need different presets |
| `--audio-bitrate <kbps>` | Optional CBR override |
| `--embed-art` / `--no-embed-art` | Album cover in MP3 (default: embed if present) |
| `--extract-audio` | From video files, also write `.mp3` (phase 2; off by default) |

### 8.3 Output layout

| Flag | Video output | Audio output |
|------|--------------|--------------|
| (default) | `<same-dir>/<basename>.mp4` | `<same-dir>/<basename>.mp3` |
| `--output <dir>` | `<dir>/<basename>.mp4` | `<dir>/<basename>.mp3` |
| `--output-video <dir>` | custom | — |
| `--output-audio <dir>` | — | custom |

Open question: mirror subdirectory tree under `--output` when `--recursive` (see improvements.md §7).

### 8.4 Log & artifact names

| Artifact | VidTuna today | MediaTuna |
|----------|---------------|-----------|
| Log | `vidtuna-log.txt` | `mediatuna-log.txt` (or `--log`) |
| Failed list | `vidtuna-failed.txt` | `mediatuna-failed.txt` |
| Binary | `vidtuna` | `mediatuna` (+ alias) |

---

## 9. ffmpeg audio encode sketch

```bash
ffmpeg -hide_banner -loglevel info -n -i input.flac \
  -map_metadata 0 \
  -id3v2_version 3 \
  -map 0:a:0 -c:a libmp3lame -q:a 2 \
  -map 0:v? -c:v copy \   # album art if present
  output.mp3
```

Art mapping is finicky; spec requires a fixture test with FLAC+embedded cover.

---

## 10. UX & messaging

### Lossy conversion warnings

When source is lossless (FLAC/WAV) → MP3:

```
[WARN] mixtape.flac → mixtape.mp3 (lossy; FLAC cannot be recovered from MP3)
```

Preflight status: `convert → mp3 [lossy]`.

### Quiet console (carry forward)

- Table shows type + target format
- Progress bar uses duration HH:MM:SS (same as video)
- Console: `✓ song.mp3` on success; details in log

### Dry-run

```
[DRY] Would convert: album/track01.flac → track01.mp3 (lossy, deinterlace: n/a)
```

---

## 11. Migration from VidTuna

| Step | Action |
|------|--------|
| 1 | Refactor `index.js` into modules (Phase 4 prerequisite) |
| 2 | Introduce `MediaKind` enum and dual pipelines behind shared orchestration |
| 3 | Add audio extensions to discovery; extend preflight table |
| 4 | Ship `mediatuna` binary; keep `vidtuna` as symlink/alias with deprecation notice |
| 5 | Update README, repo description, npm/bin name |
| 6 | Optional: GitHub repo rename `vidtuna` → `mediatuna` with redirect |

**Backward compatibility:** `vidtuna` behavior = `mediatuna --video-only` with identical flags until major version 2.

---

## 12. Implementation phases

### Phase M1 — Audio MVP (3–4 days)

- Audio discovery + probe + MP3 encode (LAME VBR presets)
- `-map_metadata 0`, filesystem timestamps
- Preflight type column; lossy warnings for FLAC/WAV
- Skip if output `.mp3` exists
- Verify duration post-encode

### Phase M2 — Metadata polish (2 days)

- Album art embed
- Tag drop warning on verify
- `--prefer mtime` for missing dates
- `--audio-only` / `--video-only` flags

### Phase M3 — Rebrand & unify (1–2 days)

- `mediatuna` binary, docs, log filenames
- `vidtuna` compatibility alias
- Combined default mode (both media types)

### Phase M4 — Advanced (future)

- `--extract-audio` from video
- Smart skip for already-good MP3
- Separate `--audio-quality` vs `--quality`
- FLAC output profile (`--format flac`) for archivists
- Parallel audio jobs (often I/O bound; lower priority than video NVENC)

---

## 13. Testing strategy

| Test | Type |
|------|------|
| `timeToSeconds`, argv parsing | Unit (existing plan) |
| Probe fixtures: FLAC, MP3, corrupt WMA | Integration (ffprobe JSON fixtures) |
| Metadata round-trip: title/artist/album/date | Integration |
| Album art byte compare | Integration |
| Lossy warning in preflight | Snapshot CLI output |
| Skip normalized MP3 | Integration |

Fixture media must be **synthetic or royalty-free** — no personal home videos in repo.

---

## 14. Open questions

1. **Repo name:** Rename to `mediatuna` or keep `vidtuna` repo with broader scope?
2. **Single `--quality` knob** for both media types, or split `--video-quality` / `--audio-quality`?
3. **MP3 only** for v1, or also **AAC `.m4a`** as alternate audio target for Apple ecosystem?
4. **Extract audio from video** in same pass — desirable for DV tapes with “good enough” audio-only copies?
5. **WMA/legacy DRM** — fail with clear message or attempt ffmpeg decode and often fail?
6. **FineTuna integration** — shared config file (`.finetuna.yml`) for presets across tools?
7. **Generation loss policy:** Allow FLAC → MP3 without `--force` but always warn, or require `--accept-lossy` for batch FLAC folders?

---

## 15. Recommendation summary

| Decision | Proposal |
|----------|----------|
| Product name | **MediaTuna** with `vidtuna` alias |
| Video target | MP4 (no change) |
| Audio target | MP3 VBR via LAME (`high`/`medium`/`fast`) |
| Default mode | Process **both** video and audio in one folder scan |
| Quality philosophy | VBR quality steps + verify; warn on lossy; skip when already normalized |
| Metadata | `-map_metadata 0`, ID3v2, art embed, filesystem dates |
| First ship | Phase M1 after VidTuna Phase 4 module split |

---

## 16. References

- Current video implementation: `index.js`
- VidTuna roadmap: [improvements.md](./improvements.md)
- ffmpeg LAME VBR: `-q:a` scale 0 (best) … 9 (smallest)
- ID3 mapping: ffmpeg wiki “Metadata”
