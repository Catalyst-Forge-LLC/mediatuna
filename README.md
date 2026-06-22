# MediaTuna

**The FineTuna companion for old media**  
Fast, metadata-preserving batch converter for legacy video → MP4 and audio → MP3.

Perfect for digitizing DV tapes, camcorder footage, CD rips, and other home media.

## Features

- Automatic NVIDIA GPU acceleration (NVENC) with CPU fallback
- Preserves embedded metadata + file timestamps (Created + Modified)
- Supports video: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG → MP4
- Supports audio: MP3, FLAC, WAV, AIFF, M4A, AAC, OGG, Opus, WMA, AC3, DTS → MP3
- Flat folder scan by default; optional recursive scan
- Pre-flight summary table (duration, size, status per file)
- Safe skipping, dry-run mode, meaningful exit codes
- Custom output folder + quality presets (`high` / `medium` / `fast`)
- Progress bars with HH:MM:SS and ETA + detailed logging

## Requirements

- [Node.js](https://nodejs.org/) 18+
- **ffmpeg** and **ffprobe** on your PATH ([ffmpeg download](https://ffmpeg.org/download.html))

## Setup

```bash
pnpm install
```

### Global CLI (optional)

```bash
pnpm link -g
mediatuna --version   # verify which script is running
```

After updating the repo, run `pnpm link -g` again so the global command picks up changes.

## Usage

```bash
mediatuna [folder|file] [options]
# or
node index.js [folder|file] [options]
```

### Examples

```bash
# Current folder (top-level files only)
mediatuna

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

# Audio folder → MP3 (FLAC, WAV, M4A, etc.)
mediatuna "./music" --audio-only

# Preview audio conversion without encoding
mediatuna "./music" --audio-only --dry-run
```

## Options

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version and installed script path |
| `--output <folder>` | Write outputs to a different folder |
| `--log <file>` | Append log to this file (default: `./mediatuna-log.txt` in cwd) |
| `--quality <preset>` | `high`, `medium`, or `fast` (default: `medium`) |
| `--video-only` | Process video files only (default) |
| `--audio-only` | Process audio files only → MP3 |
| `--recursive` | Scan subfolders |
| `--flat` | Scan top-level folder only (default) |
| `--force` | Overwrite existing outputs |
| `--dry-run` | Show what would happen (no changes) |
| `--deinterlace <mode>` | `auto` (default), `on`, or `off` |
| `--no-verify` | Skip post-encode ffprobe verification (on by default) |
| `--keep-partial` | Keep incomplete output if an encode fails (removed by default) |
| `--verbose` | Show per-file processing details on console (default: quiet) |

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

The log includes pre-flight tables, ffmpeg commands, and full stderr on failures. Console output is quiet by default; use `--verbose` for per-file detail on screen.

If any files fail, paths are written to **`mediatuna-failed.txt`** next to the log file.

## Roadmap

Audio MVP (`--audio-only`) is implemented. Next up: album art embed, combined video+audio default mode, and smart MP3 skip. See [`specs/mediatuna.md`](specs/mediatuna.md).

## Notes

- Video outputs are `.mp4`; audio outputs are `.mp3` (same folder as source, or `--output`).
- Works great with old DV captures (includes smart deinterlacing).
- Corrupt or unreadable files are skipped before ffmpeg runs.

## Privacy

MediaTuna runs entirely on your machine — nothing is uploaded. Log files may contain full local file paths; treat them as private if folder names are sensitive.
