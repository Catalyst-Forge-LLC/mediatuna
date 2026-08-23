---
title: Install
description: npm install -g mediatuna. Node, ffmpeg, then mediatuna --version.
order: 1
---

**Node.js 18+** and **ffmpeg** / **ffprobe** on PATH. More setup, tests, and the flag list: [docs](/docs/install/).

### npm

```bash
npm install -g mediatuna
mediatuna --version
```

### First run

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/media" --dry-run
mediatuna "./archives/media" --sample 20 --output "./samples"
mediatuna "./archives/media" --output "./converted"
```

### Development checkout

Working on the repo itself? Clone and `npm link` — the steps are on [docs/install](/docs/install/).
