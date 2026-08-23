# Notes

Workflow details that do not belong in the first-run README. Flags: [options](./options.md). Safety and deletes: [safety](./safety.md).

## Logging and resume

Every run appends to **`mediatuna-log.txt` in the current working directory** by default. Override with `--log <file>`.

The same lines are also mirrored to a **master log** at **`~/.mediatuna/history.log`**. Disable with `--no-master-log` or set a path with `--master-log <file>`.

The log includes preflight tables, ffmpeg commands, and full stderr on failures. Console output is quiet by default; use `--verbose` for per-file detail on screen.

Failed paths are written to **`mediatuna-failed.txt`** next to the run log.

Each convert run also writes **`.mediatuna-state.json`** next to the log. **`--resume`** skips inputs whose outputs still verify. **`--force`** bypasses resume skips. Resume requires verification (do not use `--no-verify`).

## Outputs

- Video outputs are `.mp4`; audio outputs are `.mp3` (same folder as source, or `--output`).
- Failed encodes remove the incomplete output unless `--keep-partial`.
- Unreadable files are skipped before ffmpeg runs. A single file with an unknown extension exits `2` (folder scans already skip those names).

## Dates and names

- Convert prefixes `YYYY-MM-DD_HH-MM-SSZ_` onto the MP4 name when the source name has no date yet. Already-stamped names are left alone. Use `--no-stamp-dates` to keep the original basename. `--stamp-dates` only renames sources and does not encode.
- `--stamp-dates` also rewrites known filename date encodings (`16-05-24-17-19-01`, `2013-01-31-17-45-48`, `VR_2017-10-12_20-31-29`, `AudioNote-2011-09-20_100334`, `20130326 194851`, compact `_HHMMSS`) to `YYYY-MM-DD_HH-MM-SS`. Date-only names (`2010-09-24-Recording011`) become `YYYY-MM-DD_…` with no invented clock. Two-digit years are treated as 20xx.
- **`--stamp-dates`** reads `creation_time` via ffprobe. Already-stamped names are skipped. `--prefer-mtime` falls back to filesystem mtime with an `MTIME_YYYY-MM-DD_HH-MM-SS_` prefix so it is visibly not a recording time.
- Rename and convert copy filesystem times from the source. If Windows Created is more than 30 days after Modified (typical of a copy/move), Created is set to Modified. Modified is not changed.

## Audio and video encode

- Already-good MP3s (bitrate + tags) show `skip (normalized)` and are not re-encoded.
- Video convert **copies** the audio track when it is already AAC LC (stereo or mono). HE-AAC, surround, and other codecs are re-encoded to AAC 192k. Use `--reencode-audio` to force that encode on every file.
- Old DV captures use smart deinterlacing. Phone clips below the NVENC size floor (about 145×49) use libx264. NVENC is used only when a one-frame probe succeeds — an encoder listed in `ffmpeg -encoders` is not enough (common on Linux packages with no GPU).

## Recovery helpers

- **`--dupe-report`** uses Everything (`es.exe`). Name+size is the strong match. Size-only requires the same extension. `--hash` confirms those hits. Override the CLI path with `MEDIATUNA_ES`.
- **`--recup-map`** walks `recup_dir.*`, asks Everything for same-size+extension copies *outside* the dump, and proposes a tree from the best real path (disk images, cloud sync folders, voice-note trees). Junk paths (AppData, preview caches, other recup dirs) are ignored. Writes `mediatuna-recup-map.txt`.
