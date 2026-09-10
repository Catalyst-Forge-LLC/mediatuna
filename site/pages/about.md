---
title: |-
  So the files
  still play.
description: Hard to play, hard to date, hard to find. A local pass that makes the pile playable.
order: 1
---

A home archive is a pile of formats that take extra software or extra work to play, dates that broke after a copy, files scattered across folders, and no record of what you already converted. **MediaTuna** is the local workflow that makes that pile playable.

One pass. A look at what will change before anything is written. Skip work that is already done. Deletes only after you confirm.

<div class="cta-row">
  <a class="cta cta-primary" href="/docs/">Read the docs →</a>
  <a class="cta cta-secondary" href="/install">Install</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/mediatuna">View on GitHub</a>
</div>

<p class="kicker">Stays 100% local · a local assistant can run it</p>

## First archive

Keep a backup you can restore. Preview, try a short clip, then write the new files somewhere other than the originals.

```bash
mediatuna "./archives/sample-shelf" --dry-run --output "./converted"
mediatuna "./archives/sample-shelf" --sample 20 --output "./samples"
mediatuna "./archives/sample-shelf" --output "./converted"
```

A fictional shelf (`2010-09-24-Recording011.AVI`, `16-05-24-17-19-01.MOV`, `picnic-clip.wav`, `porch-talk.mp3`) shows planned names, date sources, and the next-run `skip (exists)` / `skip (normalized)` result in [Archive example](/docs/archive-example/).

## What you get

- Camcorder and home video → MP4
- Old audio → MP3, or skip when it is already fine
- Dates from tags or filenames when those exist, not guessed clocks
- Skip work that is already done
- Help when recovered files have no names

The format list and the rest of the options live in the [docs](/docs/).

## Important caveats

<div class="mesh-panel">
  <p>The new files are not a perfect copy of the old ones. Treat MediaTuna as a tool on top of a backup, not as the backup. Safety is <a href="/docs/safety/">not a guarantee</a>.</p>
</div>

<p class="kicker">Media + tune-a. You cannot tune a fish. You can make the files play.</p>

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Get started →</a>
  <a class="cta cta-secondary" href="/writing">Read the posts</a>
</div>

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
