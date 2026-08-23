# Options

Unknown flags produce an error. `mediatuna --help` prints this list.

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show usage |
| `-V`, `--version` | Show version and installed script path |
| `--output <folder>` | Write outputs here; source subfolders are preserved |
| `--include <glob>` | Only matching files (repeatable; basename or path relative to the scan root) |
| `--exclude <glob>` | Skip matching files (repeatable; `previews` also skips that folder name) |
| `--archive <folder>` | After verify: confirm and move sources here (safer than delete). Works with convert or `--cleanup-originals` |
| `--sample <seconds>` | Encode only the first N seconds (1–600) to `*.sample.mp4` / `*.sample.mp3` |
| `--log <file>` | Append run log to this file (default: `./mediatuna-log.txt` in cwd) |
| `--no-master-log` | Do not mirror log to `~/.mediatuna/history.log` |
| `--master-log <file>` | Custom master log path (dual-write) |
| `--delete-originals` | After a conversion run: confirm and move successful sources to Recycle Bin / trash |
| `--cleanup-originals` | After conversion: trash sources whose output already exists and verifies OK. With `--recup-map`: trash recup sources that have a **SHA-256 match** in `proposed-tree/` |
| `--delete-permanent` | With delete/cleanup: unlink instead of trash (type `DELETE`) |
| `--yes` | Skip large-batch, `--force` overwrite, disk-space, and stamp-backup prompts (never skips delete confirm) |
| `--quality <preset>` | `high`, `medium`, or `fast` (default: `medium`) — video NVENC / x264 |
| `--audio-quality <preset>` | Audio LAME preset (default: same as `--quality`) |
| `--reencode-audio` | Always re-encode video audio to AAC 192k. Default is to **copy** when the source is already AAC LC (stereo or mono) |
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

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (no failures) |
| `1` | One or more files failed or were unreadable |
| `2` | Usage error or missing ffmpeg/ffprobe (or Everything, for those modes) |
| `130` | Interrupted (Ctrl+C) |
