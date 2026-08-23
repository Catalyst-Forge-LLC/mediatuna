---
title: Old tapes, playable files.
description: Local batch convert to MP4 and MP3. Dates stay. Sources stay until you say otherwise.
order: 1
---

Home media fails in two ways: the files will not play on anything modern, or they play but you cannot tell *when* they were recorded or *which* ones you already converted. **MediaTuna** is the local workflow around ffmpeg.

One pass. A preflight table before writes. Skip of work that is already done. Deletes only after you confirm.

<div class="cta-row">
  <a class="cta cta-primary" href="/docs/">Read the docs →</a>
  <a class="cta cta-secondary" href="/install">Install</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/mediatuna">View on GitHub</a>
</div>

<p class="kicker">Node 18+ · ffmpeg · nothing uploaded · your local agent can run it</p>

## What you get

- Video: AVI, MOV, MOD, VOB, MTS, and the rest of the camcorder pile → MP4
- Audio: FLAC, WMA, WAV, and already-good MP3s → MP3, or skip when they are already normalized
- Smart deinterlace for old DV. NVENC when the frame is large enough; libx264 otherwise
- `--sample 20` before a full run. `--output` keeps source folders. `--archive` moves instead of delete
- AAC copy when the source is already AAC LC. `--reencode-audio` if you want 192k on every file
- Everything dupes and PhotoRec folder rebuild when the dump has no names

## First archive

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/tapes" --dry-run
mediatuna "./archives/tapes" --sample 20 --output "./samples"
mediatuna "./archives/tapes" --output "./converted"
```

Flags live in the [docs](/docs/). A local agent can dry-run and convert if you point it at the [skill](/docs/agents/) — it should call `mediatuna`, not invent ffmpeg. Safety is [not a guarantee](/docs/safety/).

<div class="mesh-panel">
  <p>Encoding is lossy. “Same file” is usually size or duration, not a bitstream compare. Treat MediaTuna as a tool on top of a backup, not as the backup.</p>
</div>

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Get started →</a>
  <a class="cta cta-secondary" href="/writing">Read the posts</a>
</div>

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
