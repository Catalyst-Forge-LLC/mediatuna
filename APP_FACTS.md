---
app_facts_version: 0.1.0
name: MediaTuna
type: CLI tool
status: active
license: MIT
version: 1.22.18
homepage: https://mediatuna.dev
repository: https://github.com/Catalyst-Forge-LLC/mediatuna
stack:
  language: JavaScript
  runtime: Node.js
  tooling: pnpm
key_dependencies:
  - name: cli-progress
    purpose: Declared in package.json.
    registry: npm
  - name: glob
    purpose: Declared in package.json.
    registry: npm
build:
  package_manager: pnpm
  test: "node --test test/**/*.test.js"
  ci: "GitHub Actions (ci.yml)"
generated:
  date: 2026-09-29
  generator: "appfacts-cli v0.1.0 (scaffold)"
  inputs_fingerprint: 0f5022e3799486fd
credits:
  generated_with: https://appfacts.dev
  built_by: "Catalyst Forge — https://www.catalystforge.com/"
---

# MediaTuna

`CLI tool` · **active** · MIT

Make sure the old files can still play. Local convert to MP4 and MP3, dates kept.

**[Open visual label →][appfacts-label]** · or scan `APP_FACTS.png`

[Homepage](https://mediatuna.dev) · [Repository](https://github.com/Catalyst-Forge-LLC/mediatuna)

### Stack

| Layer | Choice |
| --- | --- |
| Language | JavaScript |
| Runtime | Node.js |
| Tooling | pnpm |

### Key dependencies

- `cli-progress` (npm) — Declared in package.json.
- `glob` (npm) — Declared in package.json.

### Build

- **Package Manager** — pnpm
- **Test** — node --test test/**/*.test.js
- **CI** — GitHub Actions (ci.yml)

---
*Generated with [AppFacts](https://appfacts.dev) · Built by [Catalyst Forge](https://www.catalystforge.com/) · [Visual label][appfacts-label]*

[appfacts-label]: https://appfacts.dev/v#af1.eNqVUcFOwzAM_ZXqnWBKW3HNDQ0BQ4MLuyGEvDTKwtIkSpxK1bR_R1lBcOUSOfZ7z372CRPkjYCnUUPiWQ-WdsUTBHiONbXebhoOwUEgM3HJkCDFdtIQcFZpny_MzW5BqCPkCY68KWRq5YkmelXJRoZAKp7tpdVLGHT3mWujEJz1BhLRxxFngUHHDPl2goeEcraNKZikc0VHSNxp5SjpobG-iaSOZKpU8B0EqvYis9CNC_v_0N4F9sW6obr4Bn2M5Mno9DOhAOvMlRAG3bRt_TX16VerftXVaHGmLCQeLD-WfXOr2Aafmytlu3l019XnIYw6Lls6MMcs-36sF-DiqRv0VBemY8iWQ5r_gIzlQ9l3Koz9mpjcnLm9D8nodrtd_0rg_AVnv50e
