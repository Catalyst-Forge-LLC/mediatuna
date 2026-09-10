The old files are hard to play, hard to date, and hard to find. **MediaTuna** turns that pile into playable **MP4** and **MP3** without losing the dates, tags, or work you have already done.

A home archive is mixed types, interlaced DV, missing tags, and Windows dates that broke after a copy. Camcorder files (AVI, MOV, MOD, VOB, MTS, and the rest) become MP4. Audio (FLAC, WMA, WAV, already-good MP3s) becomes MP3, or is skipped when it is already fine. One pass, a preflight table, skip work that is already done, deletes only after you confirm.

Stays 100% local.

## Archive workflow

The distinctive part is the shelf, not the codecs. Preview, write somewhere else, then skip completed outputs.

```bash
mediatuna "./archives/sample-shelf" --dry-run --output "./converted"
mediatuna "./archives/sample-shelf" --sample 20 --output "./samples"
mediatuna "./archives/sample-shelf" --output "./converted"
```

A fictional before and after is in [archive-example.md](./archive-example.md). Dates come from an embedded `creation_time`, a known filename encoding, or an explicit `--prefer-mtime` fallback. Unknown clocks are not invented.

## What it is good at

### Core

- One pass over video and audio (or `--video-only` / `--audio-only`)
- Safe defaults: dry-run, duration verify, Recycle Bin, hash before recup cleanup
- Skip normalized MP3s and existing outputs. `--resume` a long batch
- AAC copy when the source is already AAC LC (`--reencode-audio` to force 192k)

### Data preservation

- Dates survive container tags, filenames, and Windows Created/Modified when those sources exist
- Recovery helpers: Everything dupes, PhotoRec folder rebuild

It is **not** a GUI editor, a cloud library, or a backup. Keep a copy you can restore from.

## Agents

A **local agent** can dry-run, sample, and convert. It should call `mediatuna`, not invent an ffmpeg command line. [Agents](./agents.md).

## Next

- [Install](./install.md) — `npm install -g mediatuna`
- [Usage](./usage.md) — first archive, then the rest of the examples
- [Archive example](./archive-example.md) — fictional before and after
- [Agents](./agents.md) — let Cursor or Claude Code run the CLI
- [Safety](./safety.md) — backups, deletes, what the test suite is not
