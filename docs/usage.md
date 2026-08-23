# Usage

```bash
mediatuna [folder|file] [options]
# or
node index.js [folder|file] [options]
```

Default is the current folder, top-level only, video and audio together.

## First archive

Keep a backup you can restore. Preview, then write somewhere other than the source folder:

```bash
mediatuna "./archives/media" --dry-run
mediatuna "./archives/media" --sample 20 --output "./samples"
mediatuna "./archives/media" --output "./converted"
```

In-place convert only after you have checked a preview:

```bash
mediatuna "./archives/media"
```

## Examples

```bash
# Video only, recursive, higher quality
mediatuna "./archives/media" --video-only --recursive --quality high

# Resume an interrupted overnight run
mediatuna "./archives/media" --resume

# Parallel NVENC (try 3–4 jobs on a recent NVIDIA GPU)
mediatuna "./archives/media" --jobs 3

# Write elsewhere (source subfolders are kept under --output)
mediatuna "./archives/media" --recursive --output "./converted" --quality high

# Force AAC 192k on video (default copies AAC LC already in the source)
mediatuna "./archives/media" --video-only --reencode-audio

# Skip preview caches; only AVI
mediatuna "./archives/media" --recursive --include "*.avi" --exclude "previews/**"

# After a verified convert, move sources aside instead of deleting
mediatuna "./archives/media" --output "./converted" --archive "./originals-done"

# Audio folder → MP3
mediatuna "./music" --audio-only
mediatuna "./music" --audio-only --prefer-mtime

# Extract MP3 from video as well as MP4
mediatuna "./archives/media" --extract-audio --audio-quality fast

# Rename sources from metadata / filename dates (no encode)
mediatuna "./camcorder" --stamp-dates --backup "./camcorder-backup"

# Find other copies (Everything)
mediatuna "./inbox" --dupe-report
mediatuna "./inbox" --dupe-report --hash

# Rebuild folders from a PhotoRec dump
mediatuna "./photorec-dump" --recup-map --ext mp3 --apply --hash
mediatuna "./photorec-dump" --recup-map --ext mp3 --cleanup-originals
```

Full flag list: [options](./options.md). Dates, logs, and recovery helpers: [notes](./notes.md).

A local agent can run the same sequence — [Agents](./agents.md).
