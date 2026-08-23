# MediaTuna

The old files are hard to play, hard to date, and hard to find. MediaTuna is the local workflow that turns that pile into playable **MP4** and **MP3** without losing the dates, tags, or work you've already done.

A home archive is mixed types, interlaced DV, missing tags, and Windows dates that broke after a copy. One pass. A preflight table. Skip of work that is already done. Deletes only after you confirm.

**Docs:** [mediatuna.dev/docs](https://mediatuna.dev/docs) · **Site:** [mediatuna.dev](https://mediatuna.dev)

Your **local agent** can run this for you — dry-run, sample, convert. It should call `mediatuna`, not invent an ffmpeg command line. [Agents](docs/agents.md).

## Install

[Node.js](https://nodejs.org/) 18+ and **ffmpeg** / **ffprobe** on PATH. [Full install](docs/install.md).

```bash
pnpm install
npm link
mediatuna --version
```

## Quick start

Keep a backup you can restore. Preview, then write somewhere other than the source folder.

```bash
mediatuna "./archives/media" --dry-run
mediatuna "./archives/media" --sample 20 --output "./samples"
mediatuna "./archives/media" --output "./converted"
```

More examples: [docs/usage.md](docs/usage.md). Every flag: [docs/options.md](docs/options.md).

## What you get

- One pass over video and audio (or `--video-only` / `--audio-only`)
- Safe defaults — dry-run, duration verify, Recycle Bin, hash before recup cleanup
- Dates survive container tags, filenames, and Windows Created/Modified
- Skip normalized MP3s and existing outputs; `--resume` a long batch
- AAC copy when the source is already AAC LC (`--reencode-audio` to force 192k)
- Recovery helpers — Everything dupes, PhotoRec folder rebuild

Runs entirely on your machine. Nothing is uploaded. Flags, logging, dates, and recovery live in the [docs](docs/README.md).

## Safety

Hardening is care, not a guarantee. Encoding is lossy; “same file” is usually size or duration. **Keep a backup you can restore from.** Details: [docs/safety.md](docs/safety.md).

`pnpm test` is assurance the safety rules still mean what we think they mean, not a certificate for your files. [specs/testing.md](specs/testing.md).

## Development

```bash
pnpm test           # unit suite; ffmpeg cases run only if ffmpeg is on PATH
pnpm test:ffmpeg    # synthetic encode checks
```

Core logic is in `lib/`; `index.js` is the CLI. Site (FilePress + docs mount): `pnpm site:dev`. [Install / development](docs/install.md).

## Roadmap

Shipped work and open items: [specs/improvements.md](specs/improvements.md), [specs/mediatuna.md](specs/mediatuna.md), [specs/partial/hardening.md](specs/partial/hardening.md), [specs/testing.md](specs/testing.md). Parked: [output formats](specs/output-formats.md), [agents](specs/agents.md).
