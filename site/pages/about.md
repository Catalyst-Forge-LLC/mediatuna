---
title: Playable files that still know when they were recorded.
description: Local batch convert to MP4 and MP3. Dates stay, and sources stay until you say otherwise.
order: 1
---

Home media fails in two ways: the files will not play on anything modern, or they play but you cannot tell *when* they were recorded or *which* ones you already converted. **MediaTuna** is the local workflow around ffmpeg.

One pass. A preflight table before writes. Skip of work that is already done. Deletes only after you confirm.

You can't tune a fish. You can make the tapes play. Media + tune-a.

<div class="cta-row">
  <a class="cta cta-primary" href="/docs/">Read the docs →</a>
  <a class="cta cta-secondary" href="/install">Install</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/mediatuna">View on GitHub</a>
</div>

<p class="kicker">Node 18+ · ffmpeg · nothing uploaded · your local agent can run it</p>

## What you get

- Video from the camcorder pile (AVI, MOV, MOD, VOB, MTS, and the rest) → MP4
- Audio (FLAC, WMA, WAV, already-good MP3s) → MP3, or skip when it's already fine
- Smart deinterlace for old DV
- Skip work that is already done
- Recovery helpers when the dump has no names

Flags, NVENC, and audio-copy details live in the [docs](/docs/).

## First archive

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/tapes" --dry-run
mediatuna "./archives/tapes" --sample 20 --output "./samples"
mediatuna "./archives/tapes" --output "./converted"
```

A local agent can dry-run and convert if you point it at the [skill](/docs/agents/) — it should call `mediatuna`, not invent ffmpeg. Safety is [not a guarantee](/docs/safety/).

<div class="mesh-panel">
  <p>Encoding is lossy. “Same file” is usually size or duration, not a bitstream compare. Treat MediaTuna as a tool on top of a backup, not as the backup.</p>
</div>

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Get started →</a>
  <a class="cta cta-secondary" href="/writing">Read the posts</a>
</div>

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
