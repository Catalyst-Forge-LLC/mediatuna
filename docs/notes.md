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

Precedence for a new output name:

1. An already standard `YYYY-MM-DD_…` name stays.
2. A known filename encoding is normalized (`16-05-24-17-19-01` → `2016-05-24_17-19-01`). Date-only names keep the date and do not invent a clock.
3. Embedded `creation_time` from ffprobe, written as `YYYY-MM-DD_HH-MM-SSZ_`.
4. `--prefer-mtime` uses filesystem mtime with an `MTIME_` prefix so it is visibly not a recording time.
5. If none of those exist, the basename stays. No guessed date.

`--stamp-dates` only renames sources and does not encode. `--no-stamp-dates` keeps the original basename on convert. Two-digit years are treated as 20xx.

Rename and convert copy filesystem times from the source. If Windows Created is more than 30 days after Modified (typical of a copy/move), Created is set to Modified. Modified is not changed. That repair is a moved-copy heuristic, not recovery of an unknown original date.

## Audio and video encode

- Already-good MP3s (bitrate + tags) show `skip (normalized)` and are not re-encoded.
- Video convert **copies** the audio track when it is already AAC LC (stereo or mono). HE-AAC, surround, and other codecs are re-encoded to AAC 192k. Use `--reencode-audio` to force that encode on every file.
- Old DV captures use smart deinterlacing. Phone clips below the NVENC size floor (about 145×49) use libx264. NVENC is used only when a one-frame probe succeeds — an encoder listed in `ffmpeg -encoders` is not enough (common on Linux packages with no GPU).

## Ledger (optional)

`--ledger` remuxes each **new** MP4/MP3 after verify and writes a compact JSON record into a `mediatuna` tag, plus a one-line `comment`. Camcorder files rarely have a precious comment; title and artist are left alone. `--ledger-json` also upserts `.mediatuna/archive.json` under `--output` or the current directory (serialized so `--jobs` cannot race). Skip, resume, and cleanup still key off dest paths. The ledger explains a file; it does not replace a restorable backup. Samples, stamp-dates, dupe-report, and recup-map cannot use it.

## Recovery helpers

- **`--dupe-report`** uses Everything (`es.exe`). Name+size is the strong match. Size-only requires the same extension. `--hash` confirms those hits. Override the CLI path with `MEDIATUNA_ES`.
- **`--recup-map`** walks `recup_dir.*`, asks Everything for same-size+extension copies *outside* the dump, and proposes a tree from the best real path (disk images, cloud sync folders, voice-note trees). Junk paths (AppData, preview caches, other recup dirs) are ignored. Writes `mediatuna-recup-map.txt`.
