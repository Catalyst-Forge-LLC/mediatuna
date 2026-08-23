# MediaTuna

Turn a folder of old tapes, camcorders, and ripped audio into playable **MP4** and **MP3** — without losing the dates, tags, and already-finished work that make the archive usable.

Home media usually fails in two ways: the files will not play on anything modern, or they play but you cannot tell *when* they were recorded or *which* ones you already converted. MediaTuna is a local CLI that batch-converts legacy video and audio, verifies the output, and keeps metadata plus filesystem timestamps so a twenty-year pile of AVI, WMV, MOD, FLAC, and WMA becomes something you can browse, search, and keep.

It is built for overnight archive runs: a preflight table before anything is written, skip of files that are already good, post-encode checks, `--resume` after an interrupt, and delete-originals only after you confirm.

## Why it exists

ffmpeg can convert one file. A home archive is hundreds of files, mixed types, interlaced DV, missing tags, Windows “Created” dates that broke after a copy, and a PhotoRec dump with no folder names. MediaTuna is the workflow around that:

- **One pass** over a folder of video and audio (or video-only / audio-only).
- **Safe by default** — dry-run, verify duration, Recycle Bin for deletes, hash before recup cleanup, confirm large batches.
- **Dates survive** — container `creation_time`, filename encodings, and Windows Created/Modified (with a heuristic when Created is clearly a copy time).
- **Already done stays done** — skip normalized MP3s, skip existing outputs, `--resume` a long batch.
- **Recovery helpers** — find other copies with Everything, or rebuild a folder tree from a flattened PhotoRec dump.

Runs entirely on your machine. Nothing is uploaded.

## Safety

MediaTuna is built to be as careful as a batch converter can be: dry-run first, a preflight table before writes, skip of outputs that already look good, duration verify after encode, Recycle Bin for deletes, SHA-256 before recup cleanup, and extra confirms for large batches, `--force` overwrites, and in-place date stamps. Defaults prefer preview and keep sources unless you ask to remove them.

That is not a guarantee. Encoding is lossy, “same file” is usually size or duration rather than a bitstream compare, and a wrong path, full disk, or confirmed delete can still lose work. **Keep a local and/or cloud backup you can restore from** before you convert, rename, or clean up an archive. Treat MediaTuna as a tool that sits on top of that backup, not as the backup.

## Features

- NVIDIA NVENC when available, libx264 fallback (tiny phone frames skip NVENC automatically)
- Video: AVI, MOV, MOD, VOB, MTS, M2TS, MPG, MPEG, WMV, 3GP, 3G2 → MP4
- Audio: MP3, FLAC, WAV, AIFF, APE, M4A, AAC, ALAC, OGG, Opus, WMA, AC3, DTS, AMR, QCP → MP3
- Smart deinterlace for old DV / tape captures (`auto` / `on` / `off`)
- Preflight table, quality presets (`high` / `medium` / `fast`), `--jobs N` parallel encodes
- `--resume` after interrupt; `--force` to overwrite
- Album art embed (default on); `--prefer-mtime` when tags have no date
- Skip already-normalized MP3s; optional `--extract-audio` from video
- Date prefix on new MP4 names; `--stamp-dates` to rename sources only
- `--dupe-report` and `--recup-map` for copies and PhotoRec dumps
- Interactive `--delete-originals` / `--cleanup-originals` after verified success (Recycle Bin by default)

## Requirements

- [Node.js](https://nodejs.org/) 18+
- **ffmpeg** and **ffprobe** on PATH ([download](https://ffmpeg.org/download.html))
- **Everything** (`es.exe`) only for `--dupe-report` and `--recup-map` — the index must be running

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

Core logic lives in `lib/`; `index.js` is the CLI orchestrator.

Use **`pnpm install`** for dependencies and **`npm link`** for the global CLI (`pnpm link -g` errors on some setups).

## Usage

```bash
mediatuna [folder|file] [options]
# or
node index.js [folder|file] [options]
```

Default is the current folder, top-level only, video and audio together.

### Examples

```bash
# First archive: keep a backup, preview, then write to a separate folder
mediatuna "./archives/tapes" --dry-run
mediatuna "./archives/tapes" --output "./converted"

# Convert in place (video + audio) after you have checked a preview
mediatuna "./archives/tapes"

# Video only, recursive, higher quality
mediatuna "./archives/tapes" --video-only --recursive --quality high

# Resume an interrupted overnight run
mediatuna "./archives/tapes" --resume

# Parallel NVENC (try 3–4 jobs on a recent NVIDIA GPU)
mediatuna "./tapes" --jobs 3

# Write elsewhere
mediatuna "./archives/tapes" --output "./converted" --quality high

# Audio folder → MP3
mediatuna "./music" --audio-only
mediatuna "./music" --audio-only --prefer-mtime

# Extract MP3 from video as well as MP4
mediatuna "./tapes" --extract-audio --audio-quality fast

# Rename sources from metadata / filename dates (no encode)
mediatuna "./camcorder" --stamp-dates --backup "./camcorder-backup"

# Find other copies (Everything)
mediatuna "./inbox" --dupe-report
mediatuna "./inbox" --dupe-report --hash

# Rebuild folders from a PhotoRec dump
mediatuna "./photorec-dump" --recup-map --ext mp3 --apply --hash
mediatuna "./photorec-dump" --recup-map --ext mp3 --cleanup-originals
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
| `--delete-originals` | After a conversion run: confirm and move successful sources to Recycle Bin / trash |
| `--cleanup-originals` | After conversion: trash sources whose output already exists and verifies OK. With `--recup-map`: trash recup sources that have a **SHA-256 match** in `proposed-tree/` |
| `--delete-permanent` | With delete/cleanup: unlink instead of trash (type `DELETE`) |
| `--yes` | Skip large-batch, `--force` overwrite, disk-space, and stamp-backup prompts (never skips delete confirm) |
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
| `--dupe-report` | Ask Everything where else each file exists (name+size, then size-only). Writes `mediatuna-dupe-report.txt` |
| `--hash` | With `--dupe-report`: confirm size-only hits with SHA-256. With `--recup-map --apply`: copy only when the recup file and scored copy are byte-identical |
| `--recup-map` | Map a flattened PhotoRec dump to a proposed folder tree from copies found elsewhere |
| `--ext <list>` | With `--recup-map`: comma-separated extensions (default: audio + phone video) |
| `--apply` | With `--recup-map`: copy placed files into `proposed-tree/` (sources stay put; same-size dests are skipped) |

Unknown flags produce an error. Run `mediatuna --help` for the full list.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (no failures) |
| `1` | One or more files failed or were unreadable |
| `2` | Usage error or missing ffmpeg/ffprobe (or Everything, for those modes) |
| `130` | Interrupted (Ctrl+C) |

## Logging

Every run appends to **`mediatuna-log.txt` in the current working directory** by default. Override with `--log <file>`.

The same lines are also mirrored to a **master log** at **`~/.mediatuna/history.log`**. Disable with `--no-master-log` or set a path with `--master-log <file>`.

The log includes preflight tables, ffmpeg commands, and full stderr on failures. Console output is quiet by default; use `--verbose` for per-file detail on screen.

Failed paths are written to **`mediatuna-failed.txt`** next to the run log.

Each convert run also writes **`.mediatuna-state.json`** next to the log. **`--resume`** skips inputs whose outputs still verify. **`--force`** bypasses resume skips. Resume requires verification (do not use `--no-verify`).

## Notes

- **Backups first.** Hardening reduces the chance of a bad surprise; it cannot make a convert or delete safe without a copy you can restore. See [Safety](#safety).
- **Same file?** Size or name+size is not byte-identical. `--hash` is SHA-256 of the **whole file**. Convert `--verify` is duration only (± a few percent). Recup `--cleanup-originals` deletes only on a SHA-256 match. Details: [specs/partial/hardening.md](specs/partial/hardening.md).
- **Deletes** go to Recycle Bin / trash by default. `--delete-permanent` unlinks and still requires typing `DELETE`.
- Failed encodes remove the incomplete output unless `--keep-partial`.
- Video outputs are `.mp4`; audio outputs are `.mp3` (same folder as source, or `--output`).
- Convert prefixes `YYYY-MM-DD_HH-MM-SSZ_` onto the MP4 name when the source name has no date yet. Already-stamped names are left alone. Use `--no-stamp-dates` to keep the original basename. `--stamp-dates` only renames sources and does not encode.
- `--stamp-dates` also rewrites known filename date encodings (`16-05-24-17-19-01`, `2013-01-31-17-45-48`, `VR_2017-10-12_20-31-29`, `AudioNote-2011-09-20_100334`, `20130326 194851`, compact `_HHMMSS`) to `YYYY-MM-DD_HH-MM-SS`. Date-only names (`2010-09-24-Recording011`) become `YYYY-MM-DD_…` with no invented clock. Two-digit years are treated as 20xx.
- Rename and convert copy filesystem times from the source. If Windows Created is more than 30 days after Modified (typical of a copy/move), Created is set to Modified. Modified is not changed.
- Already-good MP3s (bitrate + tags) show `skip (normalized)` and are not re-encoded.
- Old DV captures use smart deinterlacing. Phone clips below the NVENC size floor (about 145×49) use libx264.
- Unreadable files are skipped before ffmpeg runs. A single file with an unknown extension exits `2` (folder scans already skip those names).
- **`--stamp-dates`** reads `creation_time` via ffprobe. Already-stamped names are skipped. `--prefer-mtime` falls back to filesystem mtime with an `MTIME_YYYY-MM-DD_HH-MM-SS_` prefix so it is visibly not a recording time.
- **`--dupe-report`** uses Everything (`es.exe`). Name+size is the strong match. Size-only requires the same extension. `--hash` confirms those hits. Override the CLI path with `MEDIATUNA_ES`.
- **`--recup-map`** walks `recup_dir.*`, asks Everything for same-size+extension copies *outside* the dump, and proposes a tree from the best real path (disk images, cloud sync folders, voice-note trees). Junk paths (AppData, preview caches, other recup dirs) are ignored. Writes `mediatuna-recup-map.txt`.
- **`--delete-originals`** — use *while converting*: encode first, then confirm `[y/N]`. Type `DELETE` only with `--delete-permanent`.
- **`--cleanup-originals`** — use *after converting*: `skip (exists)` pairs that verify, then confirm. Preview with `--dry-run --cleanup-originals`. With `--recup-map`, trashes `recup_dir.*` files that already have a SHA-256 match in `proposed-tree/`.

## Privacy

MediaTuna does not phone home. Log files may contain full local paths; treat them as private if folder names are sensitive.

## Roadmap

Shipped work and open items: [specs/improvements.md](specs/improvements.md), [specs/mediatuna.md](specs/mediatuna.md), [specs/partial/hardening.md](specs/partial/hardening.md).
