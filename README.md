# MediaTuna

**The FineTuna companion for old media**  
Fast, metadata-preserving batch converter for legacy video → MP4 (audio → MP3 on the roadmap).

Perfect for digitizing DV tapes, camcorder footage, and other home media.

## Features

- Automatic NVIDIA GPU acceleration (NVENC) with CPU fallback
- Preserves embedded metadata + file timestamps (Created + Modified)
- Supports: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG
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
```

## Options

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version and installed script path |
| `--output <folder>` | Write MP4s to a different folder |
| `--log <file>` | Append log to this file (default: `./mediatuna-log.txt` in cwd) |
| `--quality <preset>` | `high`, `medium`, or `fast` (default: `medium`) |
| `--recursive` | Scan subfolders for video files |
| `--flat` | Scan top-level folder only (default) |
| `--force` | Overwrite existing MP4s |
| `--dry-run` | Show what would happen (no changes) |
| `--deinterlace <mode>` | `auto` (default), `on`, or `off` |
| `--no-verify` | Skip post-encode ffprobe verification (on by default) |
| `--keep-partial` | Keep incomplete MP4 if an encode fails (removed by default) |
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

Audio normalization (FLAC, WAV, M4A → MP3) is spec'd in [`specs/mediatuna.md`](specs/mediatuna.md) — not implemented yet. Video behavior today matches the original VidTuna scope.

## Notes

- Output MP4s are placed in the same folder as each source file (or the `--output` folder).
- Works great with old DV captures (includes smart deinterlacing).
- Corrupt or unreadable files are skipped before ffmpeg runs.

## Privacy

MediaTuna runs entirely on your machine — nothing is uploaded. Log files may contain full local file paths; treat them as private if folder names are sensitive.
