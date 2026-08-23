---
title: Install
description: Node, ffmpeg, and a checkout. Then mediatuna --version.
order: 1
---

**Node.js 18+** and **ffmpeg** / **ffprobe** on PATH. More setup, tests, and the flag list: [docs](/docs/install/).

### Checkout

```bash
git clone https://github.com/Catalyst-Forge-LLC/mediatuna.git
cd mediatuna
pnpm install
npm link
mediatuna --version
```

Use `pnpm install` for dependencies and `npm link` for the global CLI.

### First run

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/tapes" --dry-run
mediatuna "./archives/tapes" --sample 20 --output "./samples"
mediatuna "./archives/tapes" --output "./converted"
```
