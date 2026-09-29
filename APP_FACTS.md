---
app_facts_version: 0.1.0
name: mediatuna
type: CLI tool
status: active
license: MIT
version: 1.22.15
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

# mediatuna

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

[appfacts-label]: https://appfacts.dev/v#af1.eNqVkU9PxCAQxb9K8066oW28cjNr1DWrF70ZY6Z0wuJSIGXapNn43Q3Wf1cvBIbfe8MbTpihLxQCDQyNgXtHMgWCgiyplLb7XSUxeihkIZkyNMiImxkK3hkOuWD3u6eVMEfoEzwFO5EtN3c006MZXRIojFMQ99nqIfbcvOXSKEbvgoVGCmnAu0LPKUM_nxCgYbyr0xjtyLnQCRpXbDyN3FcuVInMkWyxiqGBQvFebVa59bH7j-xFoZuc70uKL-h1oECWx-8XKghnKYLYc1XX5VSVpd1s2k1Tdmsy46Bx4-R26qpLIy6GXJ0Z1yyDPy85D3HgtE7pIJKybtufH2h6nsvAOMXsJI7LH8g6OUxdY-LQbknIL1nq6zharvf77a8F3j8A2x-dXg
