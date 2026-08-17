# MediaTuna

**The FineTuna companion for old media**  
Fast, metadata-preserving batch converter for legacy video → MP4 and audio → MP3 in one folder pass.

Perfect for digitizing DV tapes, camcorder footage, CD rips, and other home media.

## Features

- Automatic NVIDIA GPU acceleration (NVENC) with CPU fallback
- Preserves embedded metadata + file timestamps (Created + Modified)
- Supports video: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, WMV, 3GP, 3G2 → MP4
- Supports audio: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS, AMR, QCP → MP3
- Flat folder scan by default; optional recursive scan
- Pre-flight summary table (duration, size, status per file)
- Safe skipping, dry-run mode, meaningful exit codes
- Custom output folder + quality presets (`high` / `medium` / `fast`)
- Album art embed in MP3 (default on; use `--no-embed-art` to skip)
- Tag-drop warnings after encode; `--prefer-mtime` for missing dates
- Video → MP4 names get an embedded creation-time prefix when the filename does not already have one
- Smart skip for already-normalized MP3s (bitrate + tags meet preset bar)
- Optional MP3 extract from video (`--extract-audio`)
- Separate audio quality preset (`--audio-quality`)

## Requirements

- [Node.js](https://nodejs.org/) 18+
- **ffmpeg** and **ffprobe** on your PATH ([ffmpeg download](https://ffmpeg.org/download.html))

## Setup

```bash
pnpm install
```

### Global CLI (optional)

```bash
npm link
mediatuna --version   # verify which script is running
```

After updating the repo, run `npm link` again so the global command picks up changes.

### Development

```bash
pnpm test    # unit tests (lib/ helpers, probe fixtures, encode args)
```

Core logic lives in `lib/` (`discover`, `probe`, `encode`, `verify`, `preflight`, `run`, `log`, …); `index.js` is the CLI orchestrator (~380 lines).

Dependencies are managed with `pnpm install`; use **`npm link`** for the global CLI (not `pnpm link -g`, which errors on some setups).

## Usage

```bash
mediatuna [folder|file] [options]
# or
node index.js [folder|file] [options]
```

### Examples

```bash
# Current folder — video + audio (top-level only)
mediatuna

# Video only (skip audio files)
mediatuna --video-only

# Dry run (preview — no encoding)
mediatuna --dry-run

# Include subfolders
mediatuna --recursive

# Single file
mediatuna "camcorder-clip.avi"

# Specific folder
mediatuna "E:\archives\old video"

# Custom output + quality
mediatuna "E:\Old Tapes" --output "E:\Converted" --quality high

# Custom log file location
mediatuna --log "E:\archives\convert.log"

# Overwrite existing MP4s
mediatuna --force

# Resume after interrupt (skips files already completed in a prior run)
mediatuna --resume

# Parallel NVENC (good starting point on RTX Ada: 3–4 jobs)
mediatuna "./tapes" --jobs 3

# Audio folder → MP3 (FLAC, WAV, M4A, etc.)
mediatuna "./music" --audio-only

# Preview audio conversion without encoding
mediatuna "./music" --audio-only --dry-run

# Use file date when tags lack a year; embed album art (default)
mediatuna "./music" --audio-only --prefer-mtime

# Extract MP3 audio tracks from video files (alongside MP4)
mediatuna "./tapes" --extract-audio

# Higher video quality, faster audio preset
mediatuna "./archive" --quality high --audio-quality fast

# Preview: video MP4s get a date prefix if the name lacks one
mediatuna "./camcorder" --video-only --dry-run

# Rename source files in place only (no encode)
mediatuna "./camcorder" --stamp-dates --backup "./camcorder-backup"
```

## Options

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version and installed script path |
| `--output <folder>` | Write outputs to a different folder |
| `--log <file>` | Append run log to this file (default: `./mediatuna-log.txt` in cwd) |
| `--no-master-log` | Do not mirror log to `~/.mediatuna/history.log` |
| `--master-log <file>` | Custom master log path (dual-write) |
| `--delete-originals` | After a conversion run: confirm and delete sources that converted successfully |
| `--cleanup-originals` | After conversion: delete sources whose output already exists and verifies OK (interactive) |
| `--quality <preset>` | `high`, `medium`, or `fast` (default: `medium`) — video NVENC / x264 |
| `--audio-quality <preset>` | Audio LAME preset (default: same as `--quality`) |
| `--extract-audio` | Also write `.mp3` from video files (audio track only) |
| `--video-only` | Process video files only |
| `--audio-only` | Process audio files only → MP3 |
| (default) | Process both video and audio |
| `--recursive` | Scan subfolders |
| `--flat` | Scan top-level folder only (default) |
| `--force` | Overwrite existing outputs |
| `--resume` | Skip files completed in a prior run (uses `.mediatuna-state.json` next to the log) |
| `--jobs <N>` | Encode up to N files in parallel (default: 1; try 3–4 with NVENC) |
| `--dry-run` | Show what would happen (no changes) |
| `--deinterlace <mode>` | `auto` (default), `on`, or `off` |
| `--no-verify` | Skip post-encode ffprobe verification (on by default) |
| `--keep-partial` | Keep incomplete output if an encode fails (removed by default) |
| `--verbose` | Show per-file processing details on console (default: quiet) |
| `--prefer-mtime` | Use file modified date when tags have no date (audio `date` tag, or `MTIME_` filename stamp) |
| `--embed-art` | Embed album cover in MP3 when present (default) |
| `--no-embed-art` | Skip embedding album cover in MP3 |
| `--stamp-dates` | Rename source files in place with ISO creation date/time (no encoding) |
| `--no-stamp-dates` | Keep video output basenames as-is (default is to prefix a date when missing) |
| `--backup <folder>` | With `--stamp-dates`: copy originals here before renaming; writes `mediatuna-stamp-manifest.json` |

Unknown flags produce an error. Run `mediatuna --help` for the full list.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (no failures) |
| `1` | One or more files failed or were unreadable |
| `2` | Usage error or missing ffmpeg/ffprobe |
| `130` | Interrupted (Ctrl+C) |

## Logging

Every run appends to **`mediatuna-log.txt` in the current working directory** by default. Override with `--log <file>`.

The same lines are also mirrored to a **master log** at **`~/.mediatuna/history.log`** (dual-write). Disable with `--no-master-log` or set a custom path with `--master-log <file>`.

The log includes pre-flight tables, ffmpeg commands, and full stderr on failures. Console output is quiet by default; use `--verbose` for per-file detail on screen.

If any files fail, paths are written to **`mediatuna-failed.txt`** next to the run log file.

Each run also writes **`.mediatuna-state.json`** next to the log (same folder as `mediatuna-log.txt`). It records inputs whose outputs verified successfully. Use **`--resume`** on a later run with the same options to skip those files. **`--force`** bypasses resume skips. Resume requires verification (do not use `--no-verify`).

## Roadmap

Combined video+audio default mode and workflow flags are shipped. Active work: [specs/partial/phase-4-engineering.md](specs/partial/phase-4-engineering.md). Full history: [specs/improvements.md](specs/improvements.md), [specs/mediatuna.md](specs/mediatuna.md).

## Notes

- Video outputs are `.mp4`; audio outputs are `.mp3` (same folder as source, or `--output`).
- Video convert prefixes `YYYY-MM-DD_HH-MM-SSZ_` onto the MP4 name when the source name has no date yet. Already-stamped names are left alone (not updated). Convert still runs. Use `--no-stamp-dates` to keep the original basename. `--stamp-dates` only renames sources and does not encode.
- `--stamp-dates` also rewrites known filename date encodings (`16-05-24-17-19-01`, `VR_2017-10-12_20-31-29`, `AudioNote-2011-09-20_100334`, `20130326 194851`, compact `_HHMMSS`) to `YYYY-MM-DD_HH-MM-SS`. Two-digit years are treated as 20xx.
- Rename and convert copy filesystem times from the source. If Windows Created is more than 30 days after Modified (typical of a copy/move), Created is set to Modified. Modified is not changed.
- Already-good MP3s (bitrate + tags) show `skip (normalized)` in preflight and are not re-encoded.
- Works great with old DV captures (includes smart deinterlacing).
- Phone clips below the NVENC size floor (about 145×49) automatically use libx264.
- Corrupt or unreadable files are skipped before ffmpeg runs.
- **`--stamp-dates`** (rename-only) reads `creation_time` via ffprobe and prefixes the source filename. Already-stamped names are skipped, not rewritten. `--prefer-mtime` falls back to filesystem mtime with an `MTIME_YYYY-MM-DD_HH-MM-SS_` prefix (local clock) so it is visibly not a recording time — only a “no later than” bound.
- **`--delete-originals`** — use *while converting*: encodes first, then shows the list of successes and asks `[y/N]` + `DELETE` before removing sources.
- **`--cleanup-originals`** — use *after converting*: finds `skip (exists)` pairs, verifies the MP4/MP3, then deletes the sources (double confirmation). Preview with `--dry-run --cleanup-originals`.

## Privacy

MediaTuna runs entirely on your machine — nothing is uploaded. Log files may contain full local file paths; treat them as private if folder names are sensitive.
