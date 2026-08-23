---
title: Introduction
---

The old files are hard to play, hard to date, and hard to find. **MediaTuna** turns that pile into playable **MP4** and **MP3** without losing the dates, tags, or work you've already done.

A home archive is mixed types, interlaced DV, missing tags, and Windows dates that broke after a copy. Camcorder files (AVI, MOV, MOD, VOB, MTS, and the rest) become MP4. Audio (FLAC, WMA, WAV, already-good MP3s) becomes MP3, or is skipped when it's already fine. One pass, a preflight table, skip of work that is already done, deletes only after you confirm.

Stays 100% local.

## What it is good at

### Core

- One pass over video and audio (or `--video-only` / `--audio-only`)
- Safe defaults — dry-run, duration verify, Recycle Bin, hash before recup cleanup
- Skip normalized MP3s and existing outputs; `--resume` a long batch
- AAC copy when the source is already AAC LC (`--reencode-audio` to force 192k)

### Data preservation

- Dates survive container tags, filenames, and Windows Created/Modified
- Recovery helpers — Everything dupes, PhotoRec folder rebuild

It is **not** a GUI editor, a cloud library, or a backup. Keep a copy you can restore from.

## Agents

A **local agent** can dry-run, sample, and convert — it should call `mediatuna`, not invent an ffmpeg command line. [Agents](/docs/agents/).

## Next

- [Install](/docs/install/) — Node, ffmpeg, `pnpm`, `npm link`
- [Usage](/docs/usage/) — first archive, then the rest of the examples
- [Agents](/docs/agents/) — let Cursor or Claude Code run the CLI
- [Safety](/docs/safety/) — backups, deletes, what the test suite is not
