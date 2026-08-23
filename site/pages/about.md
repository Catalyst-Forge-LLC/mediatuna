---
title: |-
  So the files
  still play.
description: Hard to play, hard to date, hard to find. A local pass that makes the pile playable.
order: 1
---

A home archive is a pile of formats nothing modern will open, dates that broke after a copy, files scattered across folders and dumps, and no record of what you already converted. **MediaTuna** is the local workflow around ffmpeg.

One pass. A preflight table before writes. Skip of work that is already done. Deletes only after you confirm.

You can't tune a fish. You can make the files play. Media + tune-a.

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
mediatuna "./archives/media" --dry-run
mediatuna "./archives/media" --sample 20 --output "./samples"
mediatuna "./archives/media" --output "./converted"
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
