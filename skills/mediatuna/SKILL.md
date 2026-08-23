---
name: mediatuna
description: >-
  Runs the MediaTuna local CLI to batch-convert home video/audio archives to
  MP4 and MP3 (ffmpeg, dates, skip-already-done). Use when the user mentions
  MediaTuna, old camcorder files, PhotoRec dumps, or converting a folder
  of AVI/MOV/MOD/VOB/FLAC/WMA to playable files.
---

# MediaTuna

Local batch convert. Nothing is uploaded. The CLI is the only encoder — do not replace it with a hand-rolled ffmpeg line.

## Before any write

1. `mediatuna --version` (or `node index.js --version` from a checkout). If missing: Node 18+, ffmpeg/ffprobe on PATH, `pnpm install` and `npm link` from the MediaTuna repo. Docs: https://mediatuna.dev/docs/install/
2. Confirm the user has a **restore backup** of the source folder. If they do not, stop and say so.
3. `--dry-run` first. Read the preflight table with them.

```bash
mediatuna "./archives/media" --dry-run
```

4. Then a short sample to a **different** folder:

```bash
mediatuna "./archives/media" --sample 20 --output "./samples"
```

5. Full convert to `--output`, not in-place, until they have checked a sample:

```bash
mediatuna "./archives/media" --output "./converted"
```

## Do not

- `--delete-originals`, `--cleanup-originals`, or `--archive` unless the user explicitly asked **and** the backup exists.
- `--force` on a first run.
- Upload source media, samples, or logs that contain home paths to a remote host beyond what this agent session already does.
- Promise lossless. Encodes are lossy. “Same file” is size or duration, not a bitstream compare.

## Useful flags

| Need | Flag |
|------|------|
| Video or audio only | `--video-only` / `--audio-only` |
| Nested folders | `--recursive` |
| Resume overnight | `--resume` |
| Skip junk paths | `--include "*.avi"` / `--exclude "previews/**"` |
| NVENC parallel | `--jobs 3` (after a single-job sample works) |
| Forced AAC 192k on video | `--reencode-audio` (default copies AAC LC) |
| PhotoRec tree | `--recup-map` — add `--hash` before `--apply` or cleanup |
| Dupes | `--dupe-report` (Everything / `es.exe` on Windows) |

Full list: https://mediatuna.dev/docs/options/ · safety: https://mediatuna.dev/docs/safety/

## Install from a checkout

```bash
pnpm install
npm link
mediatuna --version
```

`pnpm link -g` errors on some setups. After `git pull`, run `npm link` again.
