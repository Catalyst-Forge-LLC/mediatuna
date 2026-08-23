---
title: Install
description: Node, ffmpeg, and a checkout. Then mediatuna --version.
order: 1
---

Requires **Node.js 18+** and **ffmpeg** / **ffprobe** on PATH. Everything (`es.exe`) is only for `--dupe-report` and `--recup-map`.

### From a checkout

```bash
git clone https://github.com/Catalyst-Forge-LLC/mediatuna.git
cd mediatuna
pnpm install
npm link
mediatuna --version
```

Use **`pnpm install`** for dependencies and **`npm link`** for the global CLI (`pnpm link -g` errors on some setups). After you pull updates, run `npm link` again.

### First run

```bash
mediatuna "./archives/tapes" --dry-run
mediatuna "./archives/tapes" --sample 20 --output "./samples"
mediatuna "./archives/tapes" --output "./converted"
```

Keep a backup you can restore. Full setup, tests, and the flag list live in the [docs](/docs/).
