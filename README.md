<p align="center">
  <img src="site/static/logo.png" alt="MediaTuna" width="440">
</p>

# MediaTuna

MediaTuna makes older home video and audio easy to play in modern formats. It converts them to **MP4** and **MP3** on your computer and keeps the dates, tags, and work you've already done. The converted copies are not a backup: keep the originals, backed up separately.

A home archive is mixed types, interlaced DV, missing tags, and Windows dates that broke after a copy. One pass. A preflight table. Skip work that is already done. Deletes only after you confirm.

**Docs:** [mediatuna.dev/docs](https://mediatuna.dev/docs) · **Site:** [mediatuna.dev](https://mediatuna.dev)

## Install

[Node.js](https://nodejs.org/) 18+ and **ffmpeg** / **ffprobe** on PATH. [Full install](docs/install.md).

```bash
npm install -g mediatuna
mediatuna --version
```

## Quick start

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/sample-shelf" --dry-run --output "./converted"
mediatuna "./archives/sample-shelf" --sample 20 --output "./samples"
mediatuna "./archives/sample-shelf" --output "./converted"
```

Fictional before and after: [docs/archive-example.md](docs/archive-example.md). More examples: [docs/usage.md](docs/usage.md). Every flag: [docs/options.md](docs/options.md).

## What you get

### Core

- One pass over video and audio (or `--video-only` / `--audio-only`)
- Safety checks: `--dry-run` preview, duration verify on by default, deletes to the Recycle Bin, hash before recup cleanup
- Skip normalized MP3s and existing outputs; `--resume` a long batch
- AAC copy when the source is already AAC LC (`--reencode-audio` to force 192k)

### Data preservation

- Dates survive container tags, filenames, and Windows Created/Modified when those sources exist. Unknown clocks are not invented
- Recovery helpers: Everything dupes, PhotoRec folder rebuild

Stays 100% local. Flags, logging, dates, and recovery live in the [docs](docs/README.md).

## Agents

A **local agent** (Cursor, Claude Code, and the like) can dry-run, sample, and convert for you. It should call `mediatuna`, not invent an ffmpeg command line. [Agents](docs/agents.md).

## Safety

Hardening is care, not a guarantee. Encoding is lossy; “same file” is usually size or duration. **Keep a backup you can restore from.** Details: [docs/safety.md](docs/safety.md).

`pnpm test` is assurance the safety rules still mean what we think they mean, not a certificate for your files. [specs/testing.md](specs/testing.md).

## Development

Checkout, `pnpm install`, and `npm link`: [full install](docs/install.md).

```bash
pnpm test           # unit suite; ffmpeg cases run only if ffmpeg is on PATH
pnpm test:ffmpeg    # synthetic encode checks
```

Core logic is in `lib/`; `index.js` is the CLI. Site (FilePress + docs mount): `pnpm site:dev`. [Install / development](docs/install.md).

## Roadmap

Shipped work and open items: [specs/improvements.md](specs/improvements.md), [specs/mediatuna.md](specs/mediatuna.md), [specs/partial/hardening.md](specs/partial/hardening.md), [specs/testing.md](specs/testing.md). Parked: [output formats](specs/output-formats.md), [agents](specs/agents.md). Post-publish review: [specs/post-publish-review.md](specs/post-publish-review.md).

[See the rest of the Catalyst Forge shelf.](https://catalystforge.com/tools/)
