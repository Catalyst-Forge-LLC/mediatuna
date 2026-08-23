# Install

## Requirements

- [Node.js](https://nodejs.org/) 18+
- **ffmpeg** and **ffprobe** on PATH ([download](https://ffmpeg.org/download.html))
- **Everything** (`es.exe`) only for `--dupe-report` and `--recup-map` — the index must be running

## npm (usual)

```bash
npm install -g mediatuna
mediatuna --version
```

That prints the version and the installed script path. Your local agent can run `mediatuna` once it is on PATH.

The published package includes the [agent skill](../skills/mediatuna/SKILL.md). Copy it from the global install:

```bash
# Unix / Git Bash
mkdir -p ~/.cursor/skills/mediatuna
cp "$(npm root -g)/mediatuna/skills/mediatuna/SKILL.md" ~/.cursor/skills/mediatuna/SKILL.md
```

On Windows Command Prompt the skill is under `%APPDATA%\npm\node_modules\mediatuna\skills\mediatuna\SKILL.md` (or `$(npm root -g)\mediatuna\skills\mediatuna\SKILL.md` in PowerShell). More: [Agents](./agents.md).

## Development checkout

Use this path when you are changing MediaTuna itself.

```bash
git clone https://github.com/Catalyst-Forge-LLC/mediatuna.git
cd mediatuna
pnpm install
npm link
mediatuna --version
```

Use **`pnpm install`** for dependencies and **`npm link`** for the global CLI (`pnpm link -g` errors on some setups). After `git pull`, run `npm link` again so the global command picks up changes.

## Tests

```bash
pnpm test           # unit suite; ffmpeg cases run only if ffmpeg is on PATH
pnpm test:ffmpeg    # synthetic encode checks (requires ffmpeg + ffprobe)
```

Core logic lives in `lib/`; `index.js` is the CLI orchestrator. See [Safety](./safety.md#tests) and [specs/testing.md](../specs/testing.md).
