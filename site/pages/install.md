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

```bash
git clone https://github.com/Catalyst-Forge-LLC/mediatuna.git
cd mediatuna
pnpm install
npm link
mediatuna --version
```

Use `pnpm install` for dependencies and `npm link` for the global CLI when you are working on the repo.
