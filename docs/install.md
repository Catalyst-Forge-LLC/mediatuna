# Install

## Requirements

- [Node.js](https://nodejs.org/) 18+
- **ffmpeg** and **ffprobe** on PATH ([download](https://ffmpeg.org/download.html))
- **Everything** (`es.exe`) only for `--dupe-report` and `--recup-map` — the index must be running

## Setup

```bash
pnpm install
```

Use **`pnpm install`** for dependencies and **`npm link`** for the global CLI (`pnpm link -g` errors on some setups).

### Global CLI (optional)

```bash
npm link
mediatuna --version   # verify which script is running
```

After updating the repo, run `npm link` again so the global command picks up changes.

## Development

```bash
pnpm test           # unit suite; ffmpeg cases run only if ffmpeg is on PATH
pnpm test:ffmpeg    # synthetic encode checks (requires ffmpeg + ffprobe)
```

Core logic lives in `lib/`; `index.js` is the CLI orchestrator. See [Safety](./safety.md#tests) and [specs/testing.md](../specs/testing.md).
