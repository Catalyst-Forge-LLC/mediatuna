# VidTuna

**The FineTuna companion for old videos**  
Fast, metadata-preserving batch converter for legacy video files → modern MP4.

Perfect for digitizing DV tapes, camcorder footage, and other home videos.

## Features

- Automatic NVIDIA GPU acceleration (NVENC) with CPU fallback
- Preserves embedded metadata + file timestamps (Created + Modified)
- Supports: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG
- Flat folder scan by default; optional recursive scan
- Pre-flight summary table (duration, size, status per file)
- Safe skipping, dry-run mode with `[n/total]` progress, meaningful exit codes
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
vidtuna --version   # verify which script is running
```

After updating the repo, run `pnpm link -g` again so the global command picks up changes.

## Usage

```bash
vidtuna [folder|file] [options]
# or
node index.js [folder|file] [options]
```

### Examples

```bash
# Current folder (top-level files only)
vidtuna

# Dry run (preview — no encoding, shows summary table)
vidtuna --dry-run

# Include subfolders
vidtuna --recursive

# Single file
vidtuna "camcorder-clip.avi"

# Specific folder
vidtuna "E:\archives\old video"

# Custom output + quality
vidtuna "E:\Old Tapes" --output "E:\Converted" --quality high

# Custom log file location
vidtuna --log "E:\archives\convert.log"

# Overwrite existing MP4s
vidtuna --force
```

## Options

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version and installed script path |
| `--output <folder>` | Write MP4s to a different folder |
| `--log <file>` | Append log to this file (default: `./vidtuna-log.txt` in cwd) |
| `--quality <preset>` | `high`, `medium`, or `fast` (default: `medium`) |
| `--recursive` | Scan subfolders for video files |
| `--flat` | Scan top-level folder only (default) |
| `--force` | Overwrite existing MP4s |
| `--dry-run` | Show what would happen (no changes) |

Unknown flags produce an error. Run `vidtuna --help` for the full list.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (no failures) |
| `1` | One or more files failed or were unreadable |
| `2` | Usage error or missing ffmpeg/ffprobe |
| `130` | Interrupted (Ctrl+C) |

## Logging

Every run appends to **`vidtuna-log.txt` in the current working directory** by default (where you run the command from). Override with `--log <file>`.

The log includes:

- Pre-flight summary table
- Per-file sections with ffmpeg command, elapsed time, and encode speed
- Full ffmpeg stderr on failures (console shows a short error only)

If any files fail, paths are written to **`vidtuna-failed.txt`** next to the log file for easy retry.

## Notes

- Output MP4s are placed in the same folder as each source file (or the `--output` folder).
- Works great with old DV captures (includes deinterlacing).
- Corrupt or unreadable files are skipped before ffmpeg runs.
