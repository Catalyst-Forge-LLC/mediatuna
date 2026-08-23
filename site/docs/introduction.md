---
title: Introduction
---

The old files are hard to play, hard to date, and hard to find. **MediaTuna** turns that pile into playable **MP4** and **MP3** without losing the dates, tags, or work you've already done.

A home archive is mixed types, interlaced DV, missing tags, and Windows dates that broke after a copy. One pass, a preflight table, skip of work that is already done, deletes only after you confirm.

Nothing is uploaded. It runs on your machine. A **local agent** can drive the CLI for you — [Agents](/docs/agents/).

## What it is good at

- One pass over video and audio (or `--video-only` / `--audio-only`)
- Safe defaults — dry-run, duration verify, Recycle Bin, hash before recup cleanup
- Dates survive container tags, filenames, and Windows Created/Modified
- Skip normalized MP3s and existing outputs; `--resume` a long batch
- AAC copy when the source is already AAC LC (`--reencode-audio` to force 192k)
- Recovery helpers — Everything dupes, PhotoRec folder rebuild

It is **not** a GUI editor, a cloud library, or a backup. Keep a copy you can restore from.

## Next

- [Install](/docs/install/) — Node, ffmpeg, `pnpm`, `npm link`
- [Usage](/docs/usage/) — first archive, then the rest of the examples
- [Agents](/docs/agents/) — let Cursor or Claude Code run the CLI
- [Safety](/docs/safety/) — backups, deletes, what the test suite is not
